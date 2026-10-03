# Implementation report — IMP-028 and IMP-029

**Date:** 2026-10-03
**Items:** IMP-028 (fail-closed production build when the index is absent) and
IMP-029 (assert `web/dist/data` in the deploy workflow), landed together.
**Mode:** implementation. No commit, no `git add`, no destructive git command.

---

## 1. What changed

Three files. No dependency was added; `web/package-lock.json` is untouched.

| File | Change |
|---|---|
| `web/scripts/require-index.mjs` | **new**, 121 lines — the production-build guard |
| `web/package.json:8` | `"build": "tsc --noEmit && node scripts/require-index.mjs && vite build"` (was `tsc --noEmit && vite build`) |
| `.github/workflows/deploy.yml:87-152` | comment on the existing `Build the web app` step + one new `run:` assertion step between it and `actions/upload-pages-artifact` |

Nothing else moved. `web/vite.config.ts` was **not** changed (see §2). Neither
`web/src/**`, `scripts/`, `tests/`, `requirements.txt`, the docs, nor
`.improve/FEATURES.md` were touched. (`git status` shows
`.improve/FEATURES.md` modified — that is the coordinator's own `TODO` →
`IN-PROGRESS` flip, present before this task started, and it is not in this
report's diff.)

### 1.1 IMP-028 — `web/scripts/require-index.mjs`

Plain Node ESM, zero imports beyond `node:fs` / `node:path` / `process`. It
resolves the data directory (default `public/data`, overridable as the single
argument so the exact code the build runs can be pointed at a fixture), then:

1. fails if `index.json` is absent, naming the path as the developer would type
   it and printing the command that fixes it;
2. fails if the manifest is not parseable JSON, or has no `shards` list;
3. fails if `shards` is empty;
4. fails, naming the shard, if any `shards[].file` is not on disk;
5. otherwise prints `Paper index present: public/data/index.json with N shard(s).`
   and exits 0.

`package.json:8` runs it **after** `tsc --noEmit` and **before** `vite build`:
after typecheck so a type error is still reported as a type error, before the
build so a missing index costs a second rather than a full bundle.

### 1.2 IMP-029 — the deploy assertion step

A plain `run:` block at `deploy.yml:96-152`, between `Build the web app`
(`:87-94`) and `actions/configure-pages@v5` / `actions/upload-pages-artifact@v3`
(`:154`, `:156`). It runs from the repository root, so the paths are
`web/dist/data/...` exactly as AC1 words them. The full 29-line body is in
§5.1 below; it uses `set -euo pipefail`, `[ ! -f ]`, a `while read` loop, one
`python3 -c` invocation, and nothing else. **No `jq`** — `python3` is on every
`ubuntu-latest` runner, `jq` is not guaranteed.

Failures exit 1 and print a `::error::` annotation naming the missing path:

```
::error::No paper index in the build output: web/dist/data/index.json is missing.
::error::Shard named by web/dist/data/index.json is missing from the build output: web/dist/data/papers-2026-W39.json
```

The step's own comment records the HTTP-vs-filesystem decision (profile §4.5)
and the fact that a truncated-but-present index is a **pass**, deliberately.

---

## 2. Mechanism choice, and why

The task allowed either a script invoked by the `build` npm script or a Vite
plugin in `vite.config.ts`. **The script was chosen.**

- **Testability.** A guard that only exists as a Vite plugin can be exercised
  only by running a real build. The script takes a directory argument, so the
  exact code CI and the deploy run can be pointed at a hand-made fixture in
  §5.3 — six cases, all executed. A plugin gated on `command === "build"` is
  dead code during `vitest` and `vite dev` and would never be unit-tested.
- **Blast radius of a config edit.** `vite.config.ts` is the file most likely to
  be refactored or replaced; a guard that lives there can stop gating without
  any test failing. A guard that is a named command in `package.json`'s `build`
  string fails loudly if removed — the build stops running it and the next build
  with no index ships the error page, which is at least visible in a diff.
- **Separation of concerns.** `web/vite.config.ts` currently holds *both* the
  Vite and the Vitest config, which is exactly why a plugin's build/dev split
  would have to be argued from `command` rather than from anything structural.
  The script has no such coupling: `npm run dev` and `npm test` never invoke it,
  so AC1's "only for a production build" is a property of *where it is called*,
  not of a runtime flag that could be misread.
- **No new file type in the TS project.** The script is `.mjs` and is **outside
  the TypeScript project** — confirmed, not assumed: `web/tsconfig.json` has
  `"include": ["src", "vite.config.ts"]` and no `allowJs`, so
  `npm run typecheck` (`tsc --noEmit`) never sees it. Confirmed empirically in
  §4.2 (typecheck exit 0). It follows the repo's prevailing style anyway —
  double quotes, semicolons, 2-space indent, one exported-free top-level
  script with a `main()` — because there is no formatter or linter configured in
  this repository to disagree.

**Why the deploy step is plain shell rather than a call into the same script.**
Two independent reasons, both deliberate:

1. AC1/AC2 of IMP-029 ask for `test -f` in a `run:` shell check, and the
   criterion is readable as written only if the `test -f` is actually there.
2. The two gates assert **different artifacts at different stages**: the build
   gate reads `public/data` before the build, the deploy gate reads `web/dist/data`
   after it. Sharing one implementation would mean a bug in it — or an edit to
   it — turns both gates off at once, including the last one before publication.
   The deploy gate's independence is worth more than the deduplication. The two
   checks are intentionally consistent in *behaviour* (both require the manifest,
   a non-empty `shards` list, and every named shard on disk) and differ only in
   implementation language.

---

## 3. Manifest and workflow facts confirmed by reading, not assumed

- **Shard field name is `shards[].file`**, and its value is a bare filename
  relative to the out-dir. `scripts/build_index.py:199` writes
  `"file": filename` where `filename = f"papers-{week}.json"`
  (`build_index.py:186`); the list is built at `:177-201` and put on the
  manifest at `:212`.
- Manifest shape (`build_index.py:203-214`, `write_index` at `:334-370`):
  `generatedAt`, `retentionDays`, `categories`, `shards[]`
  (`week`/`from`/`to`/`count`/`file`), `totalPapers`, plus optional
  `failedCategories` (`:363`) and `truncatedCategories` (`:365`).
- `write_index` writes **shards first, then the manifest** (`:334-346`), so a
  manifest on disk implies its shards were written — which is why the shard
  check can never be the thing that breaks a normal run.
- `timeout-minutes` and `concurrency` in `deploy.yml` are byte-identical to
  before: `git diff -U0 -- .github/workflows/ | grep -E '^[-+].*(timeout-minutes|cancel-in-progress|concurrency|group:)'`
  returns **nothing**. The five caps are still `deploy.yml:26` 90, `:74` 75,
  `:161` 15, `ci.yml:26` 25, `ci.yml:65` 15.
- **No `timeout-minutes` was added to the new step, deliberately.**
  `tests/test_arxiv_common.py:386-389` asserts that *every* `timeout-minutes` in
  both workflows is `> 360 s` (`> 6` minutes), so a tight cap on this fast step
  would have turned the Python suite red. The step is milliseconds of work and
  is bounded by the job's existing 90-minute cap.

---

## 4. Verification — every command, with its result

### 4.1 Python suite (unaffected, confirmed green)

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests
Ran 104 tests in 1.114s
OK
```

Re-run from the clean `/tmp` copy with the edited `deploy.yml` (§5.5): also
`Ran 104 tests in 1.111s / OK`. So `DeployStepCommandTests` and
`DeployStepTimeoutTests` both still pass with the new step present.

### 4.2 `web/` typecheck, test, build — data present

```
$ cd web && npm run typecheck     # tsc --noEmit
exit 0
$ cd web && npm test
Test Files  17 passed (17)
     Tests  266 passed (266)
$ cd web && npm run build
> tsc --noEmit && node scripts/require-index.mjs && vite build
Paper index present: public/data/index.json with 2 shard(s).
✓ 41 modules transformed.
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-B28RVUhO.js   172.50 kB │ gzip: 55.22 kB
✓ built in 558ms
exit 0
```

The asset sizes and content hashes are unchanged from
`.improve/reports/regression-sweep-5.md` §1 (`41 modules`, css 10.93 kB, js
172.50 kB), which is the expected result: the guard adds nothing to the bundle.

### 4.3 AC2 — a populated build produces `dist/data` with the manifest + shards

```
$ ls -la dist/data
index.json  495  papers-2026-W39.json  248344  papers-2026-W40.json  2383763
```

Cross-checked against the manifest rather than against `ls`:

```python
names = ['index.json'] + [s['file'] for s in json.load(open('dist/data/index.json'))['shards']]
# -> ['index.json', 'papers-2026-W40.json', 'papers-2026-W39.json']
OK   dist/data/index.json                495
OK   dist/data/papers-2026-W40.json   2383763
OK   dist/data/papers-2026-W39.json    248344
```

### 4.4 AC1 — the guard bites (and the restore)

```
$ cd web && mv public/data /tmp/imp028-data-aside
$ cd web && npm run build ; echo EXIT=$?
EXIT=1

> tsc --noEmit && node scripts/require-index.mjs && vite build

No paper index to build against: public/data/index.json does not exist.

A production build has to ship the paper index, and `vite build` copies
public/data verbatim only when that directory is already there -- so this
build would succeed and produce a dist with no dist/data, and the
deployed site would read "No paper index yet" forever. A 200 from
GET /data/index.json would not reveal it: the single-page-app fallback
answers for any missing path.

Generate the index first, from the repository root:
    python scripts/build_index.py
...
```

Non-zero exit, message names `public/data/index.json`, and `vite build` never
ran (the `dist/data` still on disk is the previous build's, untouched).

**Checksum before and after the rename-aside/restore** (`shasum -a 256`,
recorded in `/tmp/imp028-public-data-before.sha256` and
`/tmp/imp028-public-data-after.sha256`; `diff` of the two files is empty):

```
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  web/public/data/index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2a999c3888246a86d7369e  web/public/data/papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  web/public/data/papers-2026-W40.json
```

`diff before after` → `CHECKSUM IDENTICAL`, and the mtimes are still
`Oct 2 15:13`, so the restore is byte- and metadata-identical. `web/public/data`
is restored and in place.

### 4.5 AC1 — `npm run dev` and `npm test` unaffected, data absent AND present

| | data present | data absent |
|---|---|---|
| `npm test` | **266 passed / 17 files**, exit 0 | **266 passed / 17 files**, exit 0 |
| `npm run dev` | starts, `VITE v5.4.21 ready in 179 ms`, exit path fine | starts, `VITE v5.4.21 ready in 178 ms`, exit path fine |

`npm run dev` HTTP behaviour, data **present**:

```
GET /research-paper-feed/                  -> 200
GET /research-paper-feed/data/index.json   -> 200  Content-Type: application/json
GET /research-paper-feed/data/papers-2026-W40.json -> 200  Content-Type: application/json
```

`npm run dev` HTTP behaviour, data **absent** — this is the trap the item exists
to make un-missable, reproduced:

```
GET /research-paper-feed/                  -> 200
GET /research-paper-feed/data/index.json   -> 200  Content-Type: text/html      <-- SPA fallback
```

A `curl -w %{http_code}` health check on the missing index reports green. Both
dev servers were started as tracked background processes on port 5199 and
stopped after; nothing is left listening.

### 4.6 A populated build still succeeds after a *real* index build (IMP-028 AC3)

Not re-run against the repo's `public/data` (which is the full 2812-paper index
and is byte-preserved by §4.4). Run instead in the clean copy with a real
`build_index.py` invocation — see §5.5, where `--max-per-category 5` produced a
genuine index and `npm run build` exited 0. The `dist/data` listing is §4.3.

---

## 5. IMP-029 — the assertion step, run for real

### 5.1 The exact command, extracted from the YAML rather than retyped

```python
d = yaml.safe_load(open('.github/workflows/deploy.yml'))
[s for s in d['jobs']['build']['steps']
 if s.get('name') == 'Assert the paper index reached the build output'][0]['run']
```

→ 1080 characters, written verbatim to `/tmp/imp028-assert.sh` and executed with
`bash`. Everything in §5.2 is that file, unmodified.

```bash
set -euo pipefail

data_dir="web/dist/data"

if [ ! -f "${data_dir}/index.json" ]; then
  echo "::error::No paper index in the build output: ${data_dir}/index.json is missing." >&2
  echo "The build copies web/public/data verbatim, so this means the index was never built or landed somewhere else. Refusing to publish." >&2
  exit 1
fi

if ! shards="$(python3 -c 'import json, sys; print("\n".join(shard["file"] for shard in json.load(open(sys.argv[1]))["shards"]))' "${data_dir}/index.json")"; then
  echo "::error::${data_dir}/index.json could not be read as an index manifest." >&2
  exit 1
fi

if [ -z "${shards}" ]; then
  echo "::error::${data_dir}/index.json names no shards, so there is no index to publish." >&2
  exit 1
fi

while IFS= read -r shard; do
  [ -n "${shard}" ] || continue
  if [ ! -f "${data_dir}/${shard}" ]; then
    echo "::error::Shard named by ${data_dir}/index.json is missing from the build output: ${data_dir}/${shard}" >&2
    exit 1
  fi
done <<< "${shards}"

echo "Paper index present: $(printf '%s\n' "${shards}" | wc -l | tr -d ' ') shard(s)."
```

### 5.2 Results — the two cases the task requires, plus four more

Each case is an isolated copy of the real `web/dist` under `/tmp` (nothing in the
repository was moved or deleted to make a fixture).

| Case | Fixture | Expected | Result |
|---|---|---|---|
| **healthy** | the repo's real `web/dist`, byte-identical copies of the three data files | **pass** | `Paper index present: 2 shard(s).` **EXIT=0** |
| **no-shard** | `data/papers-2026-W39.json` removed | fail, name it | `::error::Shard named by web/dist/data/index.json is missing from the build output: web/dist/data/papers-2026-W39.json` **EXIT=1** |
| no-manifest | `dist/data/` removed entirely | fail | `::error::No paper index in the build output: web/dist/data/index.json is missing.` **EXIT=1** |
| empty-shards | `index.json` = `{"shards": [], "totalPapers": 0}` | fail | `::error::web/dist/data/index.json names no shards, so there is no index to publish.` **EXIT=1** |
| bad-json | `index.json` = `{ not json` | fail | `::error::web/dist/data/index.json could not be read as an index manifest.` **EXIT=1** |
| no-shards-key | `index.json` = `{"totalPapers": 3}` | fail | `::error::web/dist/data/index.json could not be read as an index manifest.` **EXIT=1** |

The two the task named are `healthy` (pass) and `no-shard` (fail, naming
`web/dist/data/papers-2026-W39.json`). The last four are additions: the
`empty-shards`, `bad-json` and `no-shards-key` cases exist because a shard loop
that is fed by a failed `python3` invocation would otherwise **pass silently** —
`$(...)` yields the empty string, the loop runs zero times, and the step exits 0.
That is the same fail-open shape as the bug this item exists to fix, so it is
closed. The `bad-json` and `no-shards-key` runs print a Python traceback before
the `::error::` line; the traceback is left in on purpose, because the diagnosis
is more useful than a clean line, and the annotation still names the file.

The same six fixtures were run through the build guard:

```
### build guard vs healthy         EXIT=0
### build guard vs no-shard        EXIT=1   names papers-2026-W39.json
### build guard vs no-manifest     EXIT=1   "does not exist"
### build guard vs empty-shards    EXIT=1   "names no shards"
### build guard vs bad-json        EXIT=1   "could not be read as an index manifest"
### build guard vs no-shards-key   EXIT=1   'has no "shards" list'
### build guard, default arg, data present
Paper index present: public/data/index.json with 2 shard(s).   EXIT=0
```

### 5.3 Step placement in the parsed workflow

`yaml.safe_load` step list for `jobs.build` — the assertion is between the build
and the upload, and `configure-pages` / `upload-pages-artifact` are untouched:

```
0 actions/checkout@v4            5 Install web dependencies
1 actions/setup-python@v5        6 Build the web app
2 Install Python dependencies    7 Assert the paper index reached the build output
3 Build the paper index          8 actions/configure-pages@v5
4 actions/setup-node@v4          9 actions/upload-pages-artifact@v3
```

`concurrency: {'group': 'pages', 'cancel-in-progress': False}` and
`build.timeout-minutes: 90` / `deploy.timeout-minutes: 15` read back unchanged.

### 5.4 YAML validity — PyYAML, named

**PyYAML 6.0.1** via `/usr/local/bin/python3.11`, `yaml.safe_load` on both files:

```
deploy.yml parses OK; jobs: ['build', 'deploy']
ci.yml     parses OK; jobs: ['python-tests', 'web-tests']
```

(First attempt raised `TypeError: '<' not supported between instances of 'bool'
and 'str'` from my own `sorted(d.keys())` on the `on:` key, which YAML 1.1 parses
as the boolean `True`. That is a quirk of the probe, not of the workflow; the
load itself succeeded. This repo's own tests deliberately avoid PyYAML —
`tests/test_arxiv_common.py:30-36` says so and reads the YAML as text — so PyYAML
is used here only as an out-of-band syntax check, and nothing in the change
depends on it.)

### 5.5 CI end-to-end simulation — the case that would have broken CI

Clean copy of the working tree at `/tmp/imp028-ci-sim` (`.git`, `node_modules`,
`dist`, `public/data`, `.improve` and `__pycache__` excluded). The checkout
starts with `web/public` holding **only** `favicon.svg` — the real CI state.

```
$ python3.11 -m venv .venv && .venv/bin/pip install -r requirements.txt
python 3.11.8   arxiv 3.0.0   requests 2.33.1        (matches IMP-198's cited versions)

$ .venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
WARNING:root:  cs.CV hit the 5-result cap; older papers in the window may be missing
INFO:root:Wrote 5 papers across 1 shards to web/public/data
exit 0
```

The manifest is exactly the truncated-but-present case
`regression-sweep-5.md` §4 warned about:

```json
{ "generatedAt": "2026-10-03T00:55:12Z", "retentionDays": 60,
  "categories": ["cs.CV"],
  "shards": [ { "week": "2026-W40", "from": "2026-10-01", "to": "2026-10-01",
                "count": 5, "file": "papers-2026-W40.json" } ],
  "totalPapers": 5,
  "truncatedCategories": ["cs.CV"] }
```

Then the rest of `ci.yml`'s `web-tests` job, in order:

```
$ cd web && npm ci            -> added 148 packages, exit 0
$ npm run typecheck           -> exit 0
$ npm test                    -> Test Files 17 passed (17) / Tests 266 passed (266)
$ npm run build
Paper index present: public/data/index.json with 1 shard(s).
✓ 41 modules transformed ... built in 424ms
exit 0

$ ls -la web/dist/data
index.json  331   papers-2026-W40.json  4586

$ bash /tmp/imp028-assert.sh          # the exact deploy.yml step
Paper index present: 1 shard(s).
exit 0
```

**`truncatedCategories` does not trip either guard, and CI stays green.** The
build guard requires the manifest, a non-empty `shards` list, and every named
shard on disk — 1 shard, 1 file, present. The deploy step likewise.

Negative direction, same copy: with the index step's output removed, CI's
`npm run build` exits **1** with the naming message. That is the intended
behaviour — the point of IMP-193 was to make that state unreachable on CI, and
this confirms the guard is the backstop if the index step is ever dropped,
renamed, or made to fail softly.

---

## 6. Acceptance criteria

### IMP-028

| AC | Status | Evidence |
|---|---|---|
| 1. `vite build` / the `build` script fails non-zero, naming `public/data/index.json`, **only** for a production build | **met** | §4.4 (exit 1, message names the file); §4.5 (`npm test` 266 and `npm run dev` both fine with data absent *and* present — the guard is in the `build` string only) |
| 2. A populated `public/data` still builds and `ls dist/data` lists `index.json` plus the shards | **met** | §4.3, cross-checked against the manifest |
| 3. `npm run build` succeeds after `build_index.py` populated `web/public/data` | **met** | §5.5 — a real `build_index.py` run (with `--max-per-category 5` rather than 20, because that is the one that exercises the truncation edge) then `npm run build` exit 0 |
| Verification method, incl. the `curl` demonstration | **met** | §4.5's `HTTP 200 / Content-Type: text/html` on the absent `data/index.json` |

### IMP-029

| AC | Status | Evidence |
|---|---|---|
| 1. A `run:` step between `npm run build` and `actions/upload-pages-artifact` that `test -f`s the manifest and every `shards[].file`, exiting non-zero with the path named, using only `python3`/shell | **met** | §5.3 (placement, parsed), §5.1 (body), §5.2 (`healthy` exit 0; `no-shard` exit 1 naming `web/dist/data/papers-2026-W39.json`; no `jq` anywhere) |
| 2. Plain `run:` shell check, no new dependencies | **met** | §5.1 — `set`, `[`, `read`, `printf`, `wc`, `tr`, `python3`. No package added; `web/package-lock.json` untouched |
| 3. Build-order comment preserved, with the assertion beside it | **met** | The index step's long cap comment (`deploy.yml:37-73`) is byte-identical; a new 5-line comment on `Build the web app` states the ordering and points at the step below it, whose own comment opens by naming both steps |

---

## 7. Deviations, additions, and honest uncertainties

1. **Beyond the literal AC: the guards also require a non-empty `shards` list
   and every named shard to exist.** AC1/AC2 for IMP-029 name the manifest and
   the shards; neither mentions an empty `shards` array. I added it because a
   manifest with zero shards is what `build_index.py` writes when a run collects
   no papers (`:519-524` logs "Wrote 0 papers across 0 shards" and returns 0),
   and the site renders that as an empty feed rather than as a missing index —
   quieter, not louder. Shipping it is the outcome these two items exist to
   prevent, so both guards treat it as absent. If a reviewer disagrees, the two
   blocks to delete are `web/scripts/require-index.mjs:95-105` and
   `deploy.yml:134-138`; nothing else depends on it.
2. **The build guard checks shards, not only the manifest.** AC1 requires the
   manifest check; the shard check is free (the loop is already written) and can
   only fire on a hand-assembled `public/data`, because `write_index` writes
   shards before the manifest. It makes the build gate catch the same
   partial-index case the deploy gate catches.
3. **The build guard checks `public/data`, not `dist/data`.** Checking the
   *output* would duplicate the deploy step and would leave the failure as a
   wasted build; checking the *input* fails in under a second and names the
   thing the developer has to run. This split is also what makes the two items
   independent gates rather than one gate applied twice.
4. **Uncertainty, stated rather than hidden.** (a) The deploy step uses
   `set -o pipefail` and a here-string (`<<<`), which are bash features. The
   default `run:` shell on `ubuntu-latest` is `bash -e {0}`, so this is safe, but
   it is a real bash dependency and I did not add an explicit `shell: bash` key,
   to keep the workflow consistent with its other steps. (b) I could not execute
   this on a GitHub runner; the step was proven by extracting the exact `run:`
   string with PyYAML and running it under `bash` against six fixtures and two
   real builds, which tests the script but not GitHub's step plumbing or the
   `::error::` annotation rendering. (c) `tests/` is outside this task's scope,
   so **no Python test pins either new guard** — nothing in the 104-test suite
   fails if `require-index.mjs` is deleted or the deploy step is removed. That is
   a real gap a reviewer may want filed separately; the guards are currently
   protected only by being part of a command a workflow runs on every build.
5. **`web/dist` in the repository is left populated and healthy** (rebuilt in
   §4.2, its three data files byte-identical to `web/public/data`). It is
   gitignored and is build output, so this is not a tracked change.

## 8. Files

```
 .github/workflows/deploy.yml | 58 ++++++++++++++++++++++++++++++++++++++++++++
 web/package.json             |  2 +-
 web/scripts/require-index.mjs  (new, untracked)
```

`web/vite.config.ts` is unchanged, as is `web/package-lock.json`.
