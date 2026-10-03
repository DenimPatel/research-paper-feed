# Verification report — IMP-028 and IMP-029

**Date:** 2026-10-03
**Verifier:** independent, skeptical. Did not write the change.
**Verdict:** **PASS**, with three minor, non-blocking issues (one doc, one
robustness asymmetry, one coverage gap).

**Method note / safety.** No destructive git command was run. No `git write`
command was run. No repository file was deleted or moved. Every fixture that
required removing an index was created inside `/tmp` copies of the tree
(`/tmp/imp028-sim`, `/tmp/imp028-fx`); the repository's own
`web/public/data/` was only ever read. `shasum -a 256` of all three files in
`web/public/data/` was taken before and after the real `npm run build` and the
three hashes are identical
(`c1ce0e60…`, `bcce73f6…`, `cb064145…`).

---

## 1. Does the guard actually gate the deploy?

### 1.1 The build script, read not assumed

`web/package.json:8`

```json
"build": "tsc --noEmit && node scripts/require-index.mjs && vite build"
```

A plain `&&` chain. There is no `|| true`, no `;`, no subshell, no `set +e`,
no `2>/dev/null`, no `||`-fallback anywhere in the string, and
`node scripts/require-index.mjs` sits **before** `vite build`, so a non-zero
guard exit short-circuits the whole script and `vite build` is never spawned.

### 1.2 Every production build path, in BOTH workflows

`grep -n "run: .*build\|npm run\|vite" .github/workflows/*.yml`:

```
.github/workflows/ci.yml:46:        run: npm run typecheck
.github/workflows/ci.yml:66:        run: python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
.github/workflows/ci.yml:68:        run: npm run build
.github/workflows/deploy.yml:75:        run: python scripts/build_index.py --max-per-category 30000
.github/workflows/deploy.yml:94:        run: npm run build
```

There are exactly **two** production build invocations in the repository, and
both are the literal string `npm run build`. There is no `npx vite build`, no
`npm run build --mode …`, no `npm exec vite build`, and no second `build`
script alias. `.github/workflows/` contains only `ci.yml` and `deploy.yml`.
The guard cannot be bypassed by a different production path, because there is no
other production path.

Two further checks on the argument question:

- `npm run build -- --mode staging` → **exit 0**. npm appends extra arguments
  to the *end* of the whole command string
  (`… && vite build --mode staging`), so the guard receives no positional
  argument and defaults to `public/data`. The script's optional
  `<dir>` argument is therefore unreachable from `npm run build`.
- `npm run build -- public/data` → the guard still printed
  `Paper index present: public/data/index.json with 1 shard(s).` (i.e. it used
  the default, correctly) and the failure came from `vite build public/data`
  treating the token as a Vite root. No guard false positive.

### 1.3 The deploy step's position, from the parsed YAML

```python
d = yaml.safe_load(open('.github/workflows/deploy.yml'))
steps = d['jobs']['build']['steps']
```

```
idx  step                                              if:   working-dir
0    actions/checkout@v4                               None  -
1    actions/setup-python@v5                           None  -
2    Install Python dependencies                       None  -
3    Build the paper index                             None  -
4    actions/setup-node@v4                             None  -
5    Install web dependencies                          None  web
6    Build the web app            <-- guarded build   None  web
7    Assert the paper index reached the build output   None  -   (workspace root)
8    actions/configure-pages@v5                        None  -
9    actions/upload-pages-artifact@v3                  None  path: web/dist
```

- Step 7 is strictly between the build (6) and the upload (9). The only step in
  between is `actions/configure-pages@v5`, which only writes
  `github-pages` outputs and touches no file.
- **Every step from 7 onward has `if:` absent** (`[None, None, None]`), so
  there is no conditional path around the gate, and
  `actions/upload-pages-artifact@v3` has no `if:` either.
- The deploy job has no `continue-on-error`, and the step inherits the job's
  failure semantics: a non-zero `run:` ends the job, so the upload never runs.
- `deploy.yml` has **no `defaults:` block at workflow or job level**, so the
  assert step runs from the workspace root and its literal
  `data_dir="web/dist/data"` resolves exactly as IMP-029 AC1 words it.
- `jobs.deploy.needs: build`, so the publication job is downstream of the
  gate as well.

**No path around the gate.** The gate is not decorative.

---

## 2. Independent proof that the guards bite

All of the following ran in `/tmp/imp028-sim` (an `rsync` copy of the tree with
`.git`, `node_modules`, `dist`, `.improve` excluded and `web/public/data/`
**removed**, i.e. a genuine fresh-checkout state — `ls web/public` shows only
`favicon.svg`).

### 2.1 The build guard, via the real `npm run build`

| # | Fixture | Exit | Message (verbatim head) |
|---|---|---|---|
| 1 | `data/` absent entirely | **1** | `No paper index to build against: public/data/index.json does not exist.` |
| 2 | `index.json` = 0-byte file | **1** | `public/data/index.json could not be read as an index manifest: Unexpected end of JSON input` |
| 3 | `index.json` = whitespace only | **1** | (same message as 2) |
| 4 | `index.json` = a **directory** | **1** | `public/data/index.json could not be read as an index manifest: EISDIR: illegal operation on a directory, read` |
| 5 | `shards: []`, `totalPapers: 0` | **1** | `public/data/index.json names no shards, so there is no index to ship.` |
| 6 | `index.json` = `{ not json` | **1** | `… could not be read as an index manifest: …` |
| 7 | `{"totalPapers": 3}` (no `shards`) | **1** | `… has no "shards" list, so it is not an index manifest.` |
| 8 | shard named but file absent | **1** | `The paper index at … names a shard that is not there: papers-2026-W40.json` |
| 9 | malformed root types `null`/`123`/`"s"`/`[]`/`[1,2]`/`true` | **1** (all six) | (see §2.4) |

Case 1 additionally proves `vite build` cannot run:

```
$ cd /tmp/imp028-sim/web && npm run build ; echo EXIT=$?
… No paper index to build against: public/data/index.json does not exist. …
EXIT=1
$ test -e dist && echo "dist EXISTS" || echo "dist ABSENT"
dist ABSENT (vite build never ran)
```

Every failure message names `public/data/index.json` (or the offending shard),
which is what IMP-028 AC1 requires.

### 2.2 The deploy step, extracted from the YAML — not retyped

The `run:` string was pulled out with PyYAML (1080 characters), written
verbatim to `/tmp/imp028-assert.sh`, and executed with `bash`. Fixtures are
`/tmp` copies of the repository's real `web/dist/data/` (2,812 papers, 2
shards).

| Fixture | Expected | Got | `::error::` line |
|---|---|---|---|
| **real populated `dist`** | PASS | **PASS** | — (`Paper index present: 2 shard(s).`) |
| **one shard deleted** | FAIL | **FAIL** | `Shard named by web/dist/data/index.json is missing from the build output: web/dist/data/papers-2026-W39.json` |
| `dist/data/` removed | FAIL | FAIL | `No paper index in the build output: web/dist/data/index.json is missing.` |
| empty `dist/data/` | FAIL | FAIL | same as above |
| `shards: []` | FAIL | FAIL | `…names no shards, so there is no index to publish.` |
| `{ not json` | FAIL | FAIL | `…could not be read as an index manifest.` |
| `{"totalPapers": 3}` | FAIL | FAIL | `…could not be read as an index manifest.` |
| shard entry without `file` | FAIL | FAIL | `…could not be read as an index manifest.` (Python `KeyError: 'file'`) |
| `index.json` is a directory | FAIL | FAIL | `…index.json is missing.` (`test -f` rejects a dir) |
| `index.json` 0-byte | FAIL | FAIL | `…could not be read as an index manifest.` |

**15/15 fixtures behave as required, 0 mismatches.**

Note the third-from-last group closes a real fail-open shape: if `python3` had
failed, `$(…)` would yield the empty string, the `while read` loop would run
zero times, and the step would have exited **0**. The `if ! shards=…` guard
turns that into a failure. Confirmed by rows 6–8 above.

### 2.3 The shard list comes from the manifest — proof, not assertion

Two fixtures, same `dist/data` directory shape, different manifest:

- `oddname`: `index.json` names `wk-2026-W01.json`; that file exists →
  **PASS** (`Paper index present: 1 shard(s).`).
- `oddname-neg`: `index.json` names `papers-2026-W40.json`; only
  `wk-2026-W01.json` exists → **FAIL**, naming
  `web/dist/data/papers-2026-W40.json`.

So the list is read out of `shards[].file` at runtime and nothing is
hardcoded to `papers-*.json`.

### 2.4 One cosmetic rough edge (still fail-closed)

`index.json` containing the literal `null` produces an uncaught `TypeError`
stack trace at `require-index.mjs:73` instead of the friendly message:

```
index.json=null  -> EXIT=1 | file:///…/require-index.mjs:73
```

Exit code is 1, so it fails closed; only the message is unfriendly. The other
five malformed roots (`123`, `"str"`, `[]`, `[1,2]`, `true`) all print the
proper `has no "shards" list` message, because only `null` survives the
property access.

---

## 3. Manifest shape vs. IMP-204's current writer — no mismatch

`scripts/build_index.py`:

- `:186` `filename = f"papers-{week}.json"`
- `:195-201` the shard dict is built with `"file": filename`
- `:203-214` `manifest = {generatedAt, retentionDays, categories, shards, totalPapers}`
- `write_index` `:334-370`: `os.makedirs`, then **`for filename, shard in shard_files.items(): … json.dump(shard)`** (shards first), then `:362-363` `if failed_categories: manifest["failedCategories"] = …`, `:364-365` `if truncated_categories: manifest["truncatedCategories"] = …`, then `:366-368` `json.dump(manifest, index.json)`, then `_clean_old_shards(out_dir, keep=shard_files)`.

The deploy step reads `shard["file"]` — **exactly** the key the writer emits.
The app's own type agrees: `web/src/lib/types.ts:26-32` `ShardManifestEntry {
week; from; to; count; file: string }` and `:33-53` `IndexManifest` declares
`failedCategories?` and `truncatedCategories?`.

Because `write_index` writes shards **before** the manifest and sweeps stale
shards **after**, a manifest on disk always implies its shards are on disk.
The shard loop therefore cannot fire on a legitimate run — which is why the
stronger-than-`test -f`-the-manifest check is safe, not a flake source.
Empirically confirmed: the CI-produced manifest
(`{"…","truncatedCategories":["cs.CV"]}`) passed both gates.

---

## 4. No false positives

### 4.1 Manifests IMP-204 now legitimately publishes

| Manifest | Build guard | Deploy step |
|---|---|---|
| `failedCategories: ["cs.LG","stat.ML"]` added to a real 2,812-paper index | **exit 0** (`Paper index present … with 2 shard(s).`) | **PASS** (`2 shard(s).`) |
| `truncatedCategories: ["cs.AI"]` added to the same | **exit 0** | **PASS** |
| both fields present | **exit 0** | **PASS** |

Neither guard reads either field, so neither can reject them. A real
`build_index.py` run under `--max-per-category 5` (the CI flag) emits
`truncatedCategories` and was accepted — §5.

### 4.2 `npm test`, `npm run typecheck`, `npm run dev`

Run in `/tmp/imp028-sim/web`, exact exit codes:

| Command | data PRESENT | data ABSENT |
|---|---|---|
| `npm test` | **exit 0**, `Test Files 17 passed (17)` / `Tests 266 passed (266)` | **exit 0**, `Test Files 17 passed (17)` / `Tests 266 passed (266)` |
| `npm run typecheck` | exit 0 | **exit 0** |
| `npm run build` | exit 0 | **exit 1** (intended) |

`npm run dev` — `vite` is not wrapped by the guard (the guard is only in the
`build` string), started as tracked background processes and probed:

```
data PRESENT   (port 5311)
  /research-paper-feed/                      200 text/html
  /research-paper-feed/data/index.json       200 application/json
  /research-paper-feed/data/papers-2026-W40.json  200 application/json

data ABSENT    (port 5312)
  /research-paper-feed/                      200 text/html
  /research-paper-feed/data/index.json       200 text/html   <-- SPA fallback
```

Both dev servers started cleanly (`VITE v5.4.21 ready in 148 ms` / `140 ms`),
both were stopped, nothing is left listening. The second table reproduces the
exact trap IMP-028 exists to make un-missable, and confirms AC1's "only for a
production build" holds in both directions.

---

## 5. THE CI SIMULATION — reproduced end to end, passes

Fresh `/tmp` copy, `web/public/data/` absent. Every step of `ci.yml`'s
`web-tests` job, in order:

```
1  npm ci                                        exit 0  (101 packages)
2  npm run typecheck                             exit 0   1.31 s
3  npm test                                      exit 0   Test Files 17 / Tests 266   4.47 s (vitest)
4  python scripts/build_index.py \
       --category cs.CV --max-per-category 5 \
       --out-dir web/public/data                 exit 0   0.32 s
     WARNING:root:  cs.CV hit the 5-result cap; older papers in the window may be missing
     INFO:root:Wrote 5 papers across 1 shards to web/public/data
5  npm run build                                 exit 0   1.87 s
     Paper index present: public/data/index.json with 1 shard(s).
     ✓ 41 modules transformed.
     dist/assets/index-G-YE6pVt.css  10.93 kB │ gzip:  2.86 kB
     dist/assets/index-B28RVUhO.js  172.50 kB │ gzip: 55.22 kB
     ✓ built in 378ms
6  ls web/dist/data
     index.json 331   papers-2026-W40.json 4586
7  bash /tmp/imp028-assert.sh   (the exact deploy.yml step)
     Paper index present: 1 shard(s).          exit 0
```

Python env: 3.11.8 venv from `requirements.txt` (pandas 3.0.6, arxiv <4), i.e.
the same `pip install -r requirements.txt` CI performs. The manifest the index
step produced:

```json
{"generatedAt":"2026-10-03T00:59:35Z","retentionDays":60,"categories":["cs.CV"],
 "shards":[{"week":"2026-W40","from":"2026-10-01","to":"2026-10-01","count":5,
            "file":"papers-2026-W40.json"}],
 "totalPapers":5,"truncatedCategories":["cs.CV"]}
```

**`truncatedCategories` does not trip either guard and CI stays green.** The
implementer's claim reproduces exactly.

Negative direction, same copy: with the index output removed, CI's
`npm run build` exits **1** with the naming message (§2.1 case 1) — so if the
index step were ever dropped, renamed, or made to fail softly, the guard is a
real backstop rather than a comment.

---

## 6. Scope and safety

```
$ git diff --stat
 .github/workflows/deploy.yml | 58 ++++++++++++++++++++++++++++++++++++++++++++
 .improve/FEATURES.md         |  4 +--
 web/package.json             |  2 +-
 3 files changed, 61 insertions(+), 3 deletions(-)
```

| Must be untouched | Result |
|---|---|
| `web/src/**` | **untouched** (`git diff --stat -- web/src` empty) |
| `scripts/` | **untouched** |
| `tests/` | **untouched** |
| `readme.md` | **untouched** |
| `CONTRIBUTING.md` | **untouched** |
| `requirements.txt` | **untouched** |
| `web/package-lock.json` | **untouched** — no new dependency |
| `.gitignore` / `web/.gitignore` | **untouched** |
| `.github/workflows/ci.yml` | **untouched** |
| `web/vite.config.ts` | **untouched** |

`.improve/FEATURES.md` is modified only by the coordinator's
`Status: TODO → IN-PROGRESS` flips for IMP-028 and IMP-029 (4 changed lines,
no content change). Untracked additions: `web/scripts/require-index.mjs` (the
new guard) and four `.improve/reports/*.md` reports. `git status` after all of
my verification is identical to `git status` before it.

---

## 7. No regression to landed work (IMP-198)

Diffed against `git show HEAD:.github/workflows/deploy.yml`.

`git diff --numstat -- .github/workflows/deploy.yml` → **`58  0`** — purely
additive. Zero removed lines. Of the 58 added lines, 25 are payload (the step
name plus the 24-line `run:` body) and 33 are comments; the only pre-existing
text that was touched is a **5-line comment added above the existing
`working-directory: web` / `run: npm run build` keys of `Build the web app`** —
no existing key's value changed.

### 7.1 The IMP-198 values, line by line

| Key | HEAD | Now |
|---|---|---|
| `timeout-minutes` (job `build`) | `:26 90` | **`:26 90`** — unchanged |
| `timeout-minutes` (step `Build the paper index`) | `:74 75` | **`:74 75`** — unchanged |
| `timeout-minutes` (job `deploy`) | `:103 15` | `:161 15` — unchanged value, shifted 58 lines |
| `concurrency.group` | `:17 pages` | **`:17 pages`** — unchanged |
| `concurrency.cancel-in-progress` | `:18 false` | **`:18 false`** — unchanged |
| `ci.yml` job `web-tests` | `:26 25` | untouched, `:26 25` |
| `ci.yml` index step | `:65 15` | untouched, `:65 15` |

The `deploy.yml:37-73` build-order comment block is byte-identical.

### 7.2 Everything else, structurally

```python
a = yaml.safe_load(open('/tmp/deploy-head.yml'))   # HEAD
b = yaml.safe_load(open('.github/workflows/deploy.yml'))  # working tree
sa = a['jobs']['build']['steps']
sb = [s for s in b['jobs']['build']['steps'] if s.get('name') != 'Assert …']
# compare element-by-element
```

```
HEAD build steps : 9    WORKING (minus new): 9
pre-existing build steps differing: 0
jobs.deploy identical: True
workflow-level keys: name SAME · permissions SAME · concurrency SAME · on: SAME
```

Every pre-existing step compares **byte-equal as parsed YAML** — same `uses`,
same `with`, same `run`, same `timeout-minutes`, same `working-directory`.
`permissions: {contents: read, pages: write, id-token: write}` unchanged.
Triggers unchanged (`schedule: 0 6 * * 0`, `push: branches: [main]`,
`workflow_dispatch`). `jobs.deploy` — `needs: build`, `runs-on`,
`timeout-minutes: 15`, `environment`, `actions/deploy-pages@v4` — identical.
Action versions unchanged: `checkout@v4`, `setup-python@v5`, `setup-node@v4`,
`configure-pages@v5`, `upload-pages-artifact@v3`, `deploy-pages@v4`.

**No new `timeout-minutes` was added to the new step** — a deliberate choice
that is also required: `tests/test_arxiv_common.py:346-395`
(`WorkflowTimeoutTests.test_no_workflow_cap_is_tighter_than_the_client_worst_case`)
asserts *every* `timeout-minutes` in both workflows exceeds 360 s, so a tight
cap on this millisecond step would turn the Python suite red. The step is
bounded by the job's existing 90-minute cap. Confirmed: the suite is green
(§8).

---

## 8. Test commands (exact results, durations)

| Command | Result | Duration |
|---|---|---|
| `/usr/local/bin/python3.11 -m unittest discover -s tests` | **`Ran 104 tests` — `OK`**, exit 0 | 1.11 s (1.8 s wall) |
| `cd web && npm run typecheck` | exit 0, no output | **1.30 s** |
| `cd web && npm test` | exit 0 — **`Test Files 17 passed (17)`**, **`Tests 266 passed (266)`** (vitest `Duration 3.86 s`) | **4.31 s** |
| `cd web && npm run build` | exit 0 — `Paper index present: public/data/index.json with 2 shard(s).`, `✓ 41 modules transformed`, `index-G-YE6pVt.css 10.93 kB`, `index-B28RVUhO.js 172.50 kB`, `✓ built in 385ms` | **1.81 s** |

`ls web/dist/data` after that build: `index.json` 495 B,
`papers-2026-W39.json` 248,344 B, `papers-2026-W40.json` 2,383,763 B — the
manifest plus both shards (IMP-028 AC2, cross-checked against the manifest's
own `shards[].file` list, not against `ls`).

Asset hashes `index-G-YE6pVt.css` / `index-B28RVUhO.js` and the 41-module
count are identical to the pre-change figures, confirming the guard adds
nothing to the bundle.

YAML validation:

```
.github/workflows/deploy.yml -> parses OK; name='Deploy to GitHub Pages' jobs=['build','deploy']
.github/workflows/ci.yml     -> parses OK; name='CI' jobs=['python-tests','web-tests']
```

---

## 9. Testability — the gap, and whether it matters

`web/scripts/require-index.mjs` is **outside the TypeScript project**:

- `web/tsconfig.json` `"include": ["src", "vite.config.ts"]`, and `allowJs` is
  unset. `tsc --showConfig` confirms `include = ['src', 'vite.config.ts']`,
  `allowJs = None`.
- Empirically: `npx tsc --noEmit --listFiles | grep -c scripts/require-index`
  → **`0`**. `npm run typecheck` never sees the file, so it is neither checked
  nor excluded-by-error — it is simply invisible.

And **outside the vitest project**: `web/vite.config.ts` sets
`test.include: ["src/**/*.test.ts", "src/**/*.test.tsx"]`. `grep -rl
"require-index" web/src tests scripts` → **NONE**.

So **no automated test covers either guard**. Deleting
`web/scripts/require-index.mjs`, or deleting the whole deploy step, turns
nothing red: the 104-test Python suite does not reference either (it greps only
`timeout-minutes` from the workflow *as text*, `tests/test_arxiv_common.py:22-51`,
and it has no `build`-script assertion), and the 266 vitest tests never load it.

**Should it have a test? Yes — and it is cheap**, because both guards are pure
and text-addressable, and this repository already has the exact precedent:
`workflow_timeouts()` reads `deploy.yml` as text with no PyYAML dependency, and
`CONTRIBUTING.md:85-86` already asks for tests in `tests/` for changes under
`scripts/`. Two assertions would pin the guards:

1. `web/package.json`'s `scripts.build` matches
   `tsc --noEmit && node scripts/require-index.mjs && vite build` — or, less
   brittlely, that `build` contains `require-index` **before** `vite build`.
2. `deploy.yml` contains a step between `Build the web app` and
   `actions/upload-pages-artifact` whose `run:` mentions
   `web/dist/data/index.json` and `exit 1`.

**Does being outside the TS project matter?** Not for correctness — the script
is plain Node ESM with three `node:` imports and no type surface to check, and
`vite build` does not bundle it (it runs before Vite). It matters for
*protection*: an untested, type-invisible, unlinted file is one refactor away
from being deleted without any signal. That is the gap worth filing, and the
report should be explicit that it is a **follow-up, not a criteria failure** —
neither IMP-028 nor IMP-029 has an AC requiring a test.

---

## 10. Issues found

### Issue 1 (minor, doc) — `readme.md:115` now misdescribes the build script

```shell
npm run build       # tsc --noEmit && vite build
```

The script is now `tsc --noEmit && node scripts/require-index.mjs && vite
build`. The inline comment is wrong, and it is the one place a reader is told
what the command does. `readme.md:186` and `CONTRIBUTING.md:71`/`:89` are
still accurate (`npm run build`, plus CI generating an index first), so this is
a single stale comment.

**Action:** update `readme.md:115` to
`# tsc --noEmit && node scripts/require-index.mjs && vite build`.

### Issue 2 (minor, robustness asymmetry) — the build guard's shard check uses `existsSync`, not `isFile`

`require-index.mjs:90`:

```js
if (!existsSync(join(dataDir, name))) {
```

A **directory** named `papers-2026-W40.json` satisfies `existsSync`, so the
build guard passes it. Proven:

```
index.json names papers-2026-W40.json; papers-2026-W40.json is a directory
  -> "Paper index present: public/data/index.json with 1 shard(s)."   guard EXIT=0
```

The deploy step's `[ ! -f "${data_dir}/${shard}" ]` rejects that same state,
so the **last** gate before publication is stricter and the overall system still
fails closed — this cannot ship. `build_index.py` cannot produce such a state
either (`:342` writes a JSON file). Severity is therefore low, and the
asymmetry is in the safe direction.

**Action:** `require-index.mjs:90` → `statSync(join(dataDir, name)).isFile()`,
matching the deploy step, and keep `existsSync` only for the manifest itself
(where `readFileSync`/`JSON.parse` already discriminates, and which was proven
to reject a directory at §2.1 case 4).

### Issue 3 (minor, coverage) — neither guard has a test

See §9. Both guards are pure and text-addressable; this repo already has the
pattern. Nothing is red if either is removed. **Action:** two text-level
assertions in `tests/` (one on `web/package.json`'s `build` string, one on the
step's presence and position in `deploy.yml`), following
`tests/test_arxiv_common.py:workflow_timeouts`. File as a separate backlog item;
neither AC requires it.

### Explicitly checked and NOT issues

- **`npm run build -- <args>`**: npm appends args after `vite build`, so the
  guard's positional `<dir>` argument is unreachable from the build script. No
  false positive.
- **Empty/`data`-absent shard** — a **0-byte** shard file passes both guards
  (`test -f` and `existsSync` both accept it). `build_index.py` only ever
  writes a populated shard for a week that has papers, and `write_index` writes
  shards before the manifest, so this state cannot arise from a real run. Noted
  for completeness, not filed.
- **Bash dependency** — the step uses `<<<` and `pipefail`, and GitHub's
  default `run:` shell on `ubuntu-latest` is `bash -e {0}`, so this is safe. The
  implementer chose not to add an explicit `shell: bash` for consistency with
  the workflow's other steps; that judgement is correct.
- **`.improve/FEATURES.md`** — modified by the coordinator, not by this change.
- The stronger-than-required "empty `shards` list is a failure" rule (declared
  as a deviation in the implementer's §7.1) is safe: `build_index.py` writes
  `shards: []` exactly when a run collects no papers, which the site renders as
  an empty feed rather than as a missing index — the exact quiet failure these
  two items exist to prevent.

---

## 11. Verdict

**PASS.** Both guards bite, and I proved it independently in `/tmp` copies
rather than accepting the implementer's numbers: 10 build-guard fixtures all
exit non-zero with a path-naming message, `vite build` provably never runs,
15 deploy-step fixtures all behave as required with 0 mismatches, the shard
list provably comes from the manifest (non-`papers-*` name passes, mismatched
name fails), the field name matches `build_index.py:199` and
`types.ts:26-32`, every IMP-204 partial-index manifest passes both gates, and
the **full CI sequence reproduces green end to end** including a real
`--max-per-category 5` index carrying `truncatedCategories`. Scope is clean,
no dependency was added, `deploy.yml` is **58 additions / 0 deletions** with
IMP-198's `timeout-minutes: 90` / `75` / `15` and
`concurrency.cancel-in-progress: false` byte-intact and **zero** pre-existing
steps differing as parsed YAML. 104 Python tests, 266 web tests across 17
files, typecheck, build and both YAML parses are all green. Three minor
issues above are documented with concrete fixes; none of them can let a
missing or partial index reach production.