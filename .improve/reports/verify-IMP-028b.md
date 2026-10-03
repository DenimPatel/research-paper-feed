# verify-IMP-028b — closing the three findings from the IMP-028 verification

**Base commit:** `b2447c5` (`chore(improve): mark IMP-029 done`)
**Under review:** uncommitted working-tree change to `readme.md`,
`web/scripts/require-index.mjs`, `web/vite.config.ts`, plus new
`web/scripts/__tests__/indexGuards.test.mjs`
**Implementer's report:** `.improve/reports/impl-IMP-028b.md`
**Prior verdict:** `.improve/reports/verify-IMP-028.md`

## VERDICT: **PASS** — 3/3 findings closed

No guard was weakened, no dependency was added, nothing was committed, no
repository file was moved or deleted. The production build is byte-identical
before and after. Eight residual observations are recorded in §8; none of them
defeats any of the three findings, and the two that are actionable (§8.1, §8.4)
are strictly smaller than what was fixed.

**Safety compliance.** No `git restore` / `checkout` / `clean` / `stash` / `add`
/ `commit` / `push` was run at any point. `git show`, `git diff`, `git log`,
`git status`, `git ls-files` (all read-only) were the only git commands used.
Isolation was done with `rsync` and `cp -a` into `/tmp/v028b/`. `.kilo/worktrees`
was excluded from every `rsync` and never read. No repository file was created,
deleted or moved; the only writes to the repository tree in this verification
were `web/dist/**` (gitignored, produced by the required `npm run build`) and
this report.

---

## 1. Finding 1 — the stale `readme.md` build description: **CLOSED**

### 1.1 The specific line

`readme.md:115` now reads:

```
npm run build       # tsc --noEmit && node scripts/require-index.mjs && vite build
```

`web/package.json:8` is, byte for byte after `npm run build  #`:

```
tsc --noEmit && node scripts/require-index.mjs && vite build
```

**Exact match.** The two other commands in the block are also accurate:
`readme.md:113` `npm run typecheck   # tsc --noEmit` == `package.json:13`;
`readme.md:114` now says `npm test  # vitest: search, collections, index loading,
components, guards`, which is true — 266 pre-existing tests across search /
collections / paperIndex / components, plus the 23 new guard tests.

### 1.2 Every other `readme.md` passage that describes the build or the guards

I read all 209 lines and re-verified each claim against the code, not against
the implementer's table.

| Line | Passage | Verdict |
| --- | --- | --- |
| `103-105` | "If the data files are missing, the app shows a clear 'no paper index yet' message instead of failing — so `npm run dev` still renders without a network build." | **Still true, and now agrees with the new paragraph rather than contradicting it.** Verified live in §5.4: with `public/data` absent, `npm run dev` serves the app's own "No paper index yet" page. Dev is lenient; the build is not. The two passages are complementary. |
| `118-123` | The new paragraph: `npm run build` fails unless the index is in `web/public/data/`; `vite build` copies `public/data` verbatim only when the directory exists; a `dist` with no `dist/data` reads "No paper index yet" forever; `npm run dev` and `npm test` do not check. | **All four claims verified true.** Fail-closed reproduced (§5.5). `package.json:7,11` show `dev: vite` and `test: vitest run`, neither of which can invoke the guard. |
| `191-193` | "CI … runs the Python `unittest` suite and, for the web app, `npm ci`, `npm run typecheck`, `npm test`, a small paper-index build and then `npm run build`." | **Still true.** `ci.yml:43-68` is exactly `npm ci`, `npm run typecheck`, `npm test`, `build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data`, `npm run build`, in that order. The new tests are inside `npm test`, so this line is *more* true than before, not less. |
| `63` | "This writes `web/public/data/index.json` plus `data/papers-<YYYY>-W<NN>.json`." | **Pre-existing inaccuracy, NOT introduced here and NOT fixed here.** `scripts/build_index.py:38` is `DEFAULT_OUT_DIR = os.path.join("web", "public", "data")` and `write_index` (`:358-366`) writes every shard and the manifest into that one directory — so both files land in `web/public/data/` and the second path is missing its prefix. Confirmed pre-existing: `git show b2447c5:readme.md \| grep -n 'papers-<YYYY>'` returns line 63 unchanged. Filed, not smuggled in. See §8.5. |
| `46, 64-71, 73-90` | `build_index.py` flags, `failedCategories` / `truncatedCategories` prose | Untouched by this change; no interaction with the guard. |

**No stale passage remains** that this change made stale.

### 1.3 `readme.md` ↔ `web/package.json` reconciliation

The profile's rule (`REPO_PROFILE.md:379`) is: *"If you change a flag, a default,
or a command, update `readme.md` and `CONTRIBUTING.md` in the same change."*

- `readme.md` — reconciled (§1.1). `web/package.json` is **unchanged** by this
  item (`git diff --exit-code -- web/package.json` → clean), so no flag or
  default drifted.
- `CONTRIBUTING.md` — **unchanged, and still accurate.** `:69-71` lists the bare
  command names `npm run typecheck` / `npm test` / `npm run build` with no inline
  description of what the build does, so it cannot go stale the way
  `readme.md:115` did. `:88-89` ("it also generates a small paper index before
  `npm run build`") is still true.
- **The reconciliation is now enforced, not just asserted.** Test
  `documents the build command the package actually runs`
  (`indexGuards.test.mjs:353-368`) reads `readme.md`, collects every line
  beginning `npm run build`, and requires each to contain `require-index.mjs`.
  Mutation **M6** (reword the readme back to `# tsc --noEmit && vite build`)
  turns exactly that one test red (§4).

**Finding 1: closed, and pinned against regression.**

---

## 2. Finding 2 — the directory hole: **CLOSED, and better than the ask**

`web/scripts/require-index.mjs:97` now calls `shardProblem()`
(`:124-137`), which wraps `statSync` in `try`/`catch` and folds the outcome into
a phrase. The `try`/`catch` is load-bearing, and I was ready to find that
`statSync` throws on a broken symlink — it does.

### 2.1 Reproduction in my own `/tmp` copy

Each row is a fresh `mktemp -d` with `public/data/index.json` naming
`papers-2026-W40.json`, and only the shard's filesystem shape varies. `GUARD` is
`/tmp/v028b/work/web/scripts/require-index.mjs`, a copy of the working-tree
file. Crash detection greps stderr for `/^\s+at /m`, `Node.js v\d`, `ENOENT`,
`EACCES`, `throw `.

| # | shard shape | exit | message | crash signature |
| --- | --- | --- | --- | --- |
| A | **directory** `papers-2026-W40.json/` | **1** | `…names a shard that is a directory, not a file: papers-2026-W40.json` | none |
| B | **regular file** | **0** | `Paper index present: public/data/index.json with 1 shard(s).` | none |
| C | **broken symlink** → `never-written.json` | **1** | `…names a shard that is not there: papers-2026-W40.json` | **none — no stack frame, no `ENOENT`, no Node banner** |
| D | symlink → real file | 0 | present | none |
| E | absent entirely | 1 | `is not there` | none |
| F | FIFO | 1 | `is not a regular file` | none |

**The hole itself, on the pre-change code.** I extracted the old guard with
`git show b2447c5:web/scripts/require-index.mjs` and ran row A against it:

```
OLD A shard = DIRECTORY   EXIT=0   "Paper index present: … 1 shard(s)."
```

Exit 0 on a directory — the IMP-028 verifier's finding, reproduced independently.
The new code refuses it with a diagnosis.

**The broken symlink is the case `statSync` gets wrong by default, and it is
handled.** Row C exits 1 with a *diagnosis*, not a crash. The test suite asserts
this rather than trusting observation: `expectRefused`
(`indexGuards.test.mjs:105-118`) additionally requires stderr to **not** match
`/^\s+at /m`, `/\bENOENT\b/`, or `/Node\.js v\d/`. Mutation **M7** — reverting
to the task's own suggested bare `statSync(shardPath).isFile()` — makes exactly
those assertions fire (§4).

### 2.2 The new guard now agrees with the deploy step, on every shape

The *reason* the fix is right is that it stops the two gates disagreeing. The
deploy step's gate is `test -f "${data_dir}/${shard}"`
(`deploy.yml:141`). Three-way comparison, same fixtures:

| shard shape | old build guard | **new build guard** | deploy `test -f` | new vs deploy |
| --- | --- | --- | --- | --- |
| regular file | PASS | **PASS** | PASS | agree |
| **directory** | **PASS** | **FAIL** | FAIL | agree (**fixed**) |
| broken symlink | FAIL | **FAIL** | FAIL | agree |
| symlink to real file | PASS | **PASS** | PASS | agree |
| absent | FAIL | **FAIL** | FAIL | agree |
| FIFO | **PASS** | **FAIL** | FAIL | agree (**fixed**) |
| symlink → `/dev/null` | **PASS** | **FAIL** | FAIL | agree (**fixed**) |

The old guard was **greener than the publish gate on 3 of 7 shapes** — meaning a
build that would be rejected at publish time exited 0. The new guard is never
greener than the publish gate on any shape. `statSync` follows symlinks, which
is precisely `test -f` semantics; the FIFO and `/dev/null` rows are the bonus
that follows from choosing "regular file" over "exists".

**Finding 2: closed. The `existsSync`/`test -f` disagreement is eliminated, not
just the directory case.**

---

## 3. Finding 3 — test coverage: **CLOSED**

`web/scripts/__tests__/indexGuards.test.mjs`, 369 lines, **23 tests**
(I counted the `it(` blocks: 13 refusal + 6 acceptance + 4 wiring = 23 — the
report's 23 is right; the "22" in my task brief is not).

### 3.1 Both guards are covered

- **`require-index.mjs`, behaviourally (19 tests).** Every branch of
  `readManifest` (absent dir, absent manifest, empty manifest, manifest is a
  directory, malformed JSON, dangling-symlink manifest), every branch of
  `checkShardFiles` (no `shards` key, empty `shards`, missing shard, **shard is
  a directory**, **shard is a dangling symlink without crashing**, shard entry
  with no `file`, shard entry with non-string `file`), and every acceptance path
  (regular file, multiple shards, the **no-argument invocation `npm run build`
  actually makes**, symlink-to-file, **`failedCategories` +
  `truncatedCategories`**, absolute-path form). The tests **spawn**
  `node scripts/require-index.mjs` as a child process rather than importing it —
  correct, because the guard reads `process.argv` and calls `process.exit` at
  module scope, so an import would kill the vitest worker or test something
  other than what the build runs.
- **The deploy guard, IMP-029 (1 test, `:332-351`).** Asserts on
  `deploy.yml` **content**, not on a display name: `run: npm run build` exists,
  `actions/upload-pages-artifact` comes after it, and the text *between* them
  contains `web/dist/data` and `exit 1`. A renamed step does not break it; a
  deleted step does (mutation **M5**).
- **The wiring (3 tests, `:313-368`).** The guard is in `scripts.build` and
  *before* `vite build` (order asserted, not just presence); it is in neither
  `scripts.dev` nor `scripts.test`; and the readme documents what the package
  runs (Finding 1's regression guard).

The second guard is covered *in the same file and the same runner* as the first,
which is why this file is about both rather than only `web/scripts/`.

### 3.2 The 23 tests are genuinely distinct — every one is uniquely pinned

I ran **24 targeted mutations** (§4) and built a sensitivity matrix. Every one
of the 23 tests is the *unique* discriminator for at least one mutation, so none
is a copy of another:

| test | mutation that catches it **and only it** |
| --- | --- |
| refuses a data directory that is not there at all | M3 (fail-open on missing `index.json`) |
| refuses a data directory that holds no `index.json` | M3 |
| refuses an `index.json` that is empty | R3 (reword the manifest-read refusal) |
| refuses an `index.json` that is a directory | R3 |
| refuses an `index.json` that is malformed JSON | R3 |
| refuses an `index.json` that is a dangling symlink | M3 |
| refuses a manifest with no `shards` key | R1 (drop the `Array.isArray` check) |
| refuses a manifest whose `shards` list is empty | M2 (delete the empty-list check) |
| refuses a manifest naming a shard that is not there | M7 (bare `statSync`) |
| **refuses a shard that is a directory** | **M11 (`if (stats) return null` — the exact `existsSync` hole)** |
| refuses a shard that is a dangling symlink, without crashing | M7 |
| refuses a shard entry with no `file` name | R5 (default a missing `file`) |
| refuses a shard entry whose `file` is not a string | M12 (loosen the string check) |
| accepts a manifest whose shard is a regular file | A3 (`lstatSync`) |
| accepts a manifest naming several shards | A1 (require exactly 1 shard) |
| accepts an index at the default path, the way `npm run build` calls it | A4 (break the cwd-relative default) |
| accepts a shard that is a symlink to a regular file | A3 |
| **accepts `failedCategories` + `truncatedCategories`** | **A2 (refuse an incomplete index)** |
| accepts the same index by absolute path | A3 |
| runs the guard in the build script, before `vite build` | M4 (drop it from `package.json`) |
| never runs the guard from `npm run dev` or `npm test` | M13 / M14 (add it to `dev` / `test`) |
| has the deploy workflow assert the index | M5 (delete the `deploy.yml` step) |
| documents the build command the package actually runs | M6 (stale readme) |

The three that share an expected message (`could not be read as an index
manifest`) are three **different malformed inputs** to the same `readFileSync` /
`JSON.parse` path — empty, EISDIR, and a truncated `{`, which is the point of
having three. The two that share `does not exist` are likewise different inputs
(no file, dangling symlink). That is input coverage, not duplication.

### 3.3 Hermeticity

Every fixture is a fresh `mkdtempSync` under the OS temp dir, removed in
`afterEach` (`:53-57`). No network, no `vite build`, nothing written inside the
repository. Verified: after a full `npm test` in the repository,
`git status --porcelain --untracked-files=all` shows no new path, and no
`index-guard-*` directory survives in `$TMPDIR`. Whole file runs in ~1.4-2.1 s.
`// @vitest-environment node` (`:1`) opts out of jsdom, matching the existing
`src/lib/__tests__/urlState.test.ts:1` pattern, and that file also proves
`setupFiles: ["src/test-setup.ts"]` is safe under a `node` environment.

**Finding 3: closed, with both guards and their wiring covered, and every test
independently load-bearing.**

---

## 4. Non-vacuity — my own mutations, in my own `/tmp` copy

Harness `/tmp/v028b/mutate.sh` + `/tmp/v028b/sens.sh` + `/tmp/v028b/sens2.sh`.
Each mutation: `rm -rf /tmp/v028b/{work,sens}` → `cp -a pristine` → one surgical
edit (asserted applied) → `npx vitest run scripts/__tests__/indexGuards.test.mjs`.
**No git command of any kind.** **Actual counts, as measured by me:**

| # | mutation | result | caught by |
| --- | --- | --- | --- |
| **M0** | **control, unmutated** | **23 passed (23), 1 file** | — (control green) |
| M1 | reinstate `existsSync` for the shard check | 3 failed / 20 passed | missing shard, **shard is a directory**, dangling symlink |
| M2 | delete the empty-`shards`-list check | 1 failed / 22 | `shards` list is empty |
| M3 | guard never fails on a missing `index.json` (fail-open) | 3 failed / 20 | no data dir, no `index.json`, dangling-symlink `index.json` — **and correctly *not* by the malformed-JSON test**, which fails in the `JSON.parse` path |
| M4 | drop the guard from `scripts.build` | 1 failed / 22 | guard in the build script, before `vite build` |
| M5 | delete `deploy.yml`'s `dist/data` assertion step | 1 failed / 22 | deploy workflow assertion |
| M6 | reword readme back to `# tsc --noEmit && vite build` | 1 failed / 22 | readme documents the build command |
| M7 | revert to the **task's own** bare `statSync(p).isFile()` | 2 failed / 21 | missing shard, **dangling symlink without crashing** |
| **M8** | **`rm` the guard file entirely** | **19 failed / 4 passed (23)** | all 19 behavioural tests; the 4 survivors are exactly the wiring tests, which never spawn it |
| M10 | `shardProblem` always returns `null` | 3 failed / 20 | missing shard, **directory**, dangling symlink |
| **M11** | **`if (stats) return null` — the precise `existsSync` hole** | **1 failed / 22** | **exactly `refuses a shard that is a directory`** |
| M12 | loosen the non-string-`file` check | 1 failed / 22 | shard entry whose `file` is not a string |
| M13 | add the guard to `scripts.dev` | 1 failed / 22 | never runs the guard from dev or test |
| M14 | add the guard to `scripts.test` | 1 failed / 22 | never runs the guard from dev or test |
| R1 | drop the `Array.isArray(manifest.shards)` check | 1 failed / 22 | manifest with no `shards` key |
| R3 | reword the manifest-read refusal | 3 failed / 20 | empty / directory / malformed `index.json` |
| R4 | write refusals to **stdout** instead of stderr | 13 failed / 10 | 13 of the 13 refusal tests |
| R5 | default a shard entry's missing `file` name | 1 failed / 22 | shard entry with no `file` name |
| A1 | require exactly one shard | 1 failed / 22 | accepts a manifest naming several shards |
| A2 | refuse an index carrying `failedCategories`/`truncatedCategories` | 1 failed / 22 | **accepts an incomplete index** |
| A3 | `lstatSync` instead of `statSync` | 7 failed / 16 | the 6 acceptance tests + the directory test |
| A4 | break the cwd-relative default path | 2 failed / 21 | **accepts an index at the default path**, no data dir |
| A5 | break the relative one-argument form | 14 failed / 9 | 14 tests |
| *(R2)* | *my mis-targeted mutation (defaulted a null shard, not a missing `file`)* | *23 passed* | *superseded by R5, which catches the intended test* |

**Totals: 24 valid mutations, 24 caught. Zero survivors.** M0 is green, M8
deletes the guard outright and takes 19 tests with it — so the suite fails
loudly if the guard is *removed*, not merely mutated.

**M11 is the decisive one** and it behaves exactly as the implementer reported
for their M1: reinstating the `existsSync` hole is caught by **exactly one
test**, and that test is `refuses a shard that is a directory`
(`indexGuards.test.mjs:195-204`). A suite in which every mutation tripped every
test would be indistinguishable from a suite asserting nothing in particular;
this one discriminates sharply.

---

## 5. The config change — blast radius

`git diff web/vite.config.ts` adds **one glob inside `test.include`** and an
11-line explanatory comment. Nothing else. `plugins`, `base`, `environment`,
and `setupFiles` are untouched, and `exclude` was **not** set (so vitest keeps
its defaults — confirmed below).

### 5.1 The production build is byte-for-byte identical

`vite.config.ts` is read by both `vite build` and `vitest`, so I built the same
tree twice in `/tmp`, once with `git show b2447c5:web/vite.config.ts` and once
with the new file, everything else identical:

| | OLD config | NEW config |
| --- | --- | --- |
| modules transformed | **41** | **41** |
| JS | `dist/assets/index-B28RVUhO.js` 172.50 kB (gzip 55.22) | **identical name and size** |
| CSS | `dist/assets/index-G-YE6pVt.css` 10.93 kB (gzip 2.86) | **identical name and size** |
| `dist/index.html` | 1.00 kB | 1.00 kB |
| file count | 7 | 7 |

`sha256` of all 7 files, old vs new:

```
4c977f90…  dist/assets/index-B28RVUhO.js
6220a3f3…  dist/assets/index-G-YE6pVt.css
c1ce0e60…  dist/data/index.json
bcce73f6…  dist/data/papers-2026-W39.json
cb064145…  dist/data/papers-2026-W40.json
94fc3ee7…  dist/favicon.svg
d26092a9…  dist/index.html
```

`diff` of the two sorted hash lists: **empty — byte-for-byte unchanged.** The
asset *content hashes are the filenames*, so identical names are the strongest
possible statement that the bundle is unchanged. `diff -r dist/data public/data`
→ identical. No `.mjs`, no test file, and nothing from `scripts/` appears in
`dist` (`find dist -name '*.mjs' -o -name '*test*'` → empty).

**Mechanically:** `test` is a vitest-only key that `vite build` never reads, and
the change is confined to `test.include`. There is no code path by which
`vite build` can observe it. The measurement agrees with the reasoning.

### 5.2 The widened glob's collection surface — probed, not assumed

`web/scripts/` contains exactly two entries: `require-index.mjs` and
`__tests__/indexGuards.test.mjs`. To find out what the glob *could* match, I
planted **9 canary files** in a `/tmp` copy, each containing
`it("CANARY …", () => expect(1).toBe(999))` — i.e. each fails loudly if it is
ever collected — and ran the full suite:

| canary | collected? | why |
| --- | --- | --- |
| `scripts/node_modules/canary.test.mjs` | **no** | `defaultExclude` `**/node_modules/**` |
| `scripts/dist/canary.test.mjs` | **no** | `defaultExclude` `**/dist/**` |
| `scripts/__tests__/helper.mjs` | **no** | not `*.test.mjs` |
| `scripts/plain.mjs` | **no** | not `*.test.mjs` |
| `scripts/canary.ts` | **no** | not `.mjs` |
| `scripts/canary.test.ts` | **no** | glob is `.mjs`-only |
| `scripts/canary.test.mjs.bak` | **no** | suffix |
| `scripts/canary.spec.mjs` | **no** | `.spec`, not `.test` |
| `scripts/nested/deep/deeper/x.test.mjs` | **yes** | `**` is recursive — correct |
| `scripts/__tests__/sub/y.test.mjs` | **yes** | recursive — correct |

Result: `Test Files 2 failed | 18 passed (20)`, `Tests 2 failed | 289 passed
(291)` — only the two intentionally-collected canaries. **The glob cannot reach
`node_modules`, build output, non-test files, or `.ts`/`.spec` files.** And
vitest's own startup banner during the M9 run confirms `exclude` was not
clobbered: `exclude: **/node_modules/**, **/dist/**, **/cypress/**,
**/.{idea,git,cache,output,temp}/**, **/{karma,rollup,…}.config.*`.

**Assessment: the blast radius on the production build is zero, and the
collection surface is exactly `scripts/**/*.test.mjs` minus `node_modules` and
`dist`.** The change is minimal and correct.

### 5.3 Two objections considered and answered

**"`scripts/**/*.test.mjs` only matches `.mjs`, so a future `.ts` test in
`scripts/` would silently not run."** True, and recorded as §8.8. Today the only
candidate is `.mjs` by necessity (§5.4), so this is a latent trap rather than a
live defect.

**"The config change was avoidable, so its risk was not worth taking."** I
tested this: I reverted `vite.config.ts` to `b2447c5`, moved the suite to
`web/src/__tests__/requireIndex.guard.test.ts` (which is where
`CONTRIBUTING.md:84-85` says `web/` tests belong, and which needs **no** config
change), and ran `npm run typecheck`. It **fails with 11 errors**:

```
src/__tests__/requireIndex.guard.test.ts(84,28): error TS2591:
  Cannot find name 'process'. Do you need to install type definitions for node?
+ 10 × TS7006/TS7031 implicit-any on strict
```

because `tsconfig.json` sets `"types": ["vite/client"]` and **`@types/node` is
not installed** (`web/node_modules/@types/` contains only react/react-dom and
Babel/aria types; no file under `web/src` uses `node:` or `process` today). So
the `.ts`-under-`src/` route needs either a new dependency — which this item
forbids — or `// @ts-nocheck` shims. **The implementer's chosen route was the
better one**, and the config change was the minimal registration available.
Their *stated reason* was imprecise (see §8.3) but the conclusion holds and I
verified the real blocker myself.

---

## 6. False positives — the thing that matters most

A guard that breaks legitimate deploys is worse than no guard. Every row below
exits **0**.

### 6.1 Manifest shapes

| manifest | exit |
| --- | --- |
| `failedCategories` only | **0** |
| `truncatedCategories` only | **0** |
| **`failedCategories` + `truncatedCategories`** | **0** |
| both keys present but **empty arrays** | **0** |
| real 2-shard manifest in `build_index.py`'s exact shape (`week`/`from`/`to`/`count`/`file`) | **0** |
| 3 shards | **0** |
| unknown extra top-level keys (`extra: {anything: true}`) | **0** |
| shard name with a `./` prefix | **0** |
| shard in a subdirectory, directory present | **0** |
| shard in a subdirectory, directory absent | 1 (`is not there` — correct) |
| **the repository's own real `web/public/data`**, copied verbatim | **0**, `2 shard(s)` |

The `shards`-as-plain-strings shape fails, but `build_index.py:199` always
writes `{"file": filename}` dicts, and the deploy step's own python
(`deploy.yml:129`) reads `shard["file"]` too — so **both gates reject it** and
the two remain in agreement. Not a false positive.

### 6.2 The CI-like sequence, on a fresh-runner copy

`/tmp/v028b/ci`, built by `rsync` excluding `.git`, `web/node_modules`,
`web/dist`, **`web/public/data`** and `__pycache__` — so it starts with no index
and no `dist`, like a fresh runner. Run in `ci.yml`'s order:

| step | result |
| --- | --- |
| `npm ci` | exit 0, 2.2 s (lockfile untouched by this item) |
| `npm run typecheck` | **exit 0**, no output |
| `npm test` — **with `public/data` absent** | **18 files / 289 tests passed**, 5.57 s |
| `build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data` (real network) | exit 0, `Wrote 5 papers across 1 shards`; manifest carries a genuine **`"truncatedCategories": ["cs.CV"]`** |
| `npm run build` | **exit 0** — `Paper index present: public/data/index.json with 1 shard(s).`, 41 modules, 455 ms |
| `ls dist/data` | `index.json`, `papers-2026-W40.json` |
| `diff -r dist/data public/data` | identical |

### 6.3 The second guard, extracted from `deploy.yml` and run for real

I extracted the `run:` block of `Assert the paper index reached the build output`
(`deploy.yml:118-147`) verbatim, de-indented (29 lines) and ran it with `bash`
from the copy's root:

| scenario | result |
| --- | --- |
| against the real `dist` | `Paper index present: 1 shard(s).` — **exit 0** |
| `dist/data` absent | `::error::No paper index in the build output…` — **exit 1** |
| shard is a **directory** in `dist` (Finding 2's shape) | `::error::Shard … is missing from the build output…` — **exit 1** |
| shard missing from `dist` | **exit 1** |
| restored | **exit 0** |

**The whole chain — `build_index.py` → build guard → `vite build` → deploy
guard — is green on a genuinely truncated index.** The build guard now refuses
the directory shape *before* a `dist` is ever produced, so the publish gate
cannot be the first to discover it.

### 6.4 The guards still fail closed

With the index moved aside (in `/tmp` only):

```
npm run build   -> exit 1
grep -c "vite v5" log   ->  0        # vite never ran
ls -d dist               ->  No such file or directory
… No paper index to build against: public/data/index.json does not exist. …
    Generate the index first, from the repository root:
        python scripts/build_index.py
mv data back && npm run build  ->  exit 0
```

### 6.5 `npm run dev` and `npm test`, data present **and** absent

`npm test`: **289 passed / 18 files** with `public/data` **absent** (fresh
runner) and again with it **present** — identical counts either way. The guard
is reachable only from `scripts.build`.

`npm run dev`, in the fresh-runner copy:

- **data present** — HTTP 200 at `/research-paper-feed/`, `data/index.json` 200
  (331 B, the real manifest). Playwright snapshot: heading *"Recent arXiv papers
  in CS & AI"*, *"5 papers from cs.CV · index generated Oct 2, 2026"*, category
  chips, 7/30/60-day group, Newest/Relevance control, and — because this index
  really is truncated — the app's own alert *"This index is incomplete. cs.CV was
  cut off at this index's per-category limit…"*. Console clean apart from Vite's
  connect messages and React's DevTools notice.
- **data absent** — HTTP 200, and Playwright shows the app's own empty-index
  page: heading **"No paper index yet"**, the explanatory paragraph, a "Try
  again" button, and the `python scripts/build_index.py` / `cd web && npm run dev`
  instructions. The single console error is the app's own
  `IndexUnavailableError`, the pre-existing baseline for this state.

Also re-confirmed in the **repository** (data present): dev 200, `index.json`
200 / 495 B / `2 shards, 2812 papers`.

This is exactly what `readme.md:103-105` promises and what the new
`readme.md:118-123` paragraph now contrasts it with. Both are true, and they no
longer read as contradictory.

---

## 7. No regression

### 7.1 Only the intended paths changed

```
$ git diff --stat HEAD
 readme.md                     | 11 ++++++++--
 web/scripts/require-index.mjs | 49 +++++++++++++++++++++++++++++++++++++------
 web/vite.config.ts            | 13 +++++++++++-
 3 files changed, 64 insertions(+), 9 deletions(-)
```

| path | status |
| --- | --- |
| `web/src/**` | **UNCHANGED** |
| `scripts/` | **UNCHANGED** |
| `tests/` (Python) | **UNCHANGED** |
| `requirements.txt` | **UNCHANGED** |
| `CONTRIBUTING.md` | **UNCHANGED** |
| `.github/**` | **UNCHANGED** |
| `notebooks/` | **UNCHANGED** |
| `web/tsconfig.json` | **UNCHANGED** |
| `web/package.json` | **UNCHANGED** |
| `web/package-lock.json` | **UNCHANGED** — no new dependency, zero added lines |

`web/scripts/__tests__/indexGuards.test.mjs` is the only new file. The four
untracked `.improve/reports/*.md` entries were already untracked at the start
(this verification's first `git status`), and are not the implementer's.

### 7.2 No existing test weakened, skipped, or deleted

`vitest --reporter=json` on the **old** config/guard vs the **new** one, in the
same `/tmp` copy, compared by `(file, fullName)`:

```
OLD:  17 files, 266 assertions, statuses {passed: 266}
NEW:  18 files, 289 assertions, statuses {passed: 289}

PRE-EXISTING tests MISSING from the new run: 0
NEWLY ADDED tests:                            23
STATUS CHANGES on pre-existing tests:         0
```

**All 266 pre-existing test names survive with identical `passed` status.** No
`pending` or `todo` in either run, and no `it.skip` / `it.todo` / `.only`
anywhere in the new file or under `web/src`. Python: 104 tests, **no skips, no
expected failures** (the single grep hit for "skipped" is a *test name*,
`test_traversal_member_is_skipped_logged_and_stays_inside_dest`, which passes).

### 7.3 `web/public/data` is byte-identical

```
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  web/public/data/index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2d999c3888246a86d7369e  web/public/data/papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  web/public/data/papers-2026-W40.json
```

Identical to the baseline I captured before running anything. The whole
verification did its destructive work in `/tmp`, per the safety rule.

---

## 8. Residual observations

None of these blocks any finding. The two actionable ones are much smaller than
what was fixed.

1. **ACTIONABLE — the test *registration* is unpinned, and this is the exact
   risk the guard's own header claims to defeat.** Deleting the
   `"scripts/**/*.test.mjs"` glob from `vite.config.ts` returns `npm test` to
   **`Test Files 17 passed (17)` / `Tests 266 passed (266)`, exit 0** — silently
   green with **zero** guard coverage, and nothing in the suite can notice,
   because the suite is the thing that stopped running. Meanwhile
   `require-index.mjs:20-23` says the script was written as plain Node ESM
   rather than a Vite plugin "so that a config-file change cannot silently stop
   gating." That is now only half true: the *script* is insulated from a
   Vite-plugin change, but the *wiring of its tests* is not. **Fix:** an
   assertion that `vite.config.ts` still contains the `scripts/**/*.test.mjs`
   glob, placed in a file the `src/` globs already collect (e.g.
   `web/src/__tests__/…`), or as a text assertion in the Python `tests/` suite
   alongside the existing `deploy.yml` text checks.
2. **`web/scripts/require-index.mjs:27-30`** (the new comment) asserts the suite
   "runs on every `npm test` in CI." True today; subject to §8.1.
3. **The report's stated reason for `.mjs`-not-`.ts` is imprecise.**
   `impl-IMP-028b.md:166-168` says a `.ts` test "could not reference the `.mjs`
   guard without breaking `npm run typecheck`." The test never references the
   guard — it `spawn`s it by path. The real blocker, which I measured (§5.3), is
   that `tsconfig.json` pins `"types": ["vite/client"]` and `@types/node` is not
   installed, so a `.ts` guard test under `src/` fails typecheck with 11 errors
   (`Cannot find name 'process'` + implicit-`any` under `strict`). The
   **conclusion** is right; the **reason** is wrong. Worth correcting so the next
   person does not "fix" it by adding `@types/node`.
4. **`npm test` now reads files outside `web/`** — `readme.md` and
   `.github/workflows/deploy.yml`, via `../../../` (`:45-46`). Correct on CI
   (`ci.yml:32` `actions/checkout@v4` at the repo root) and locally, but a
   web-only checkout would fail. A one-line comment saying so would help.
5. **Pre-existing, not introduced: `readme.md:63`** documents the shard output as
   `data/papers-<YYYY>-W<NN>.json`, missing the `web/public/` prefix;
   `build_index.py:38` puts both the manifest and every shard in
   `web/public/data/`, so the readme names a repository-root `data/` that never
   exists. Confirmed present at `b2447c5` (§1.2). The implementer found it and
   correctly declined to bundle an unrelated fix — a pre-existing doc bug for
   the backlog, and it makes step 1 look like it writes outside the web app.
6. **`.improve/REPO_PROFILE.md:153-154` (tracked) is now factually wrong:**
   `npm test # vitest run -> 16 files, 253 tests passed` and
   `npm run build # tsc --noEmit && vite build`. Both stale. It is the
   coordinator's document, so leaving it was right, but it is a live inaccuracy
   in a tracked file and it now lags by +36 tests and +1 file. Its test table
   (`:186-203`) likewise does not list the new file.
7. **`CONTRIBUTING.md:84-85`** directs contributors to put `web/` tests in
   `web/src/lib/__tests__/` or `web/src/__tests__/`. The guard test is at
   `web/scripts/__tests__/`. Justified by §5.3, but a contributor following the
   document will not look there. One sentence in `CONTRIBUTING.md` would close it.
8. **The new glob is `.mjs`-only.** A future `scripts/**/*.test.ts` would be
   silently uncollected — a latent version of §8.1. Today there is no such file.

---

## 9. Every command run, with results

### 9.1 Python (from the repository root)

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 104 tests in 1.107s
OK
exit 0      (wall 2.13 s; 81 top-level "ok" lines, 0 skips, 0 expected failures)
```

### 9.2 Web (from `web/`)

```
$ npm run typecheck
> tsc --noEmit
exit 0, no output

$ npm test
 ✓ scripts/__tests__/indexGuards.test.mjs (23 tests) 2127ms
 Test Files  18 passed (18)
      Tests  289 passed (289)
   Duration  9.55s
exit 0

$ npm run build
> tsc --noEmit && node scripts/require-index.mjs && vite build
Paper index present: public/data/index.json with 2 shard(s).
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-B28RVUhO.js   172.50 kB │ gzip: 55.22 kB
✓ built in 467ms
exit 0
```

266 → 289 and 17 → 18 files, exactly +23 tests and +1 file.

### 9.3 Integrity

```
$ shasum -a 256 web/public/data/*
c1ce0e60…  index.json
bcce73f6…  papers-2026-W39.json
cb064145…  papers-2026-W40.json
IDENTICAL to the baseline captured before anything ran

$ git status --porcelain
 M readme.md
 M web/scripts/require-index.mjs
 M web/vite.config.ts
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/impl-IMP-028b.md
?? .improve/reports/regression-sweep-4.md
?? web/scripts/__tests__/
```

Only the intended paths. (This report is a fifth entry in
`.improve/reports/`.)

---

## 10. Bottom line

- **Finding 1 (stale readme):** closed. `readme.md:115` is byte-accurate against
  `web/package.json:8`; every other build/guard passage in the file re-verified
  true; `CONTRIBUTING.md` unaffected; the coupling is now enforced by a test
  (M6 proves it bites). One pre-existing inaccuracy left visible at `readme.md:63`
  and correctly not bundled in.
- **Finding 2 (directory hole):** closed, and the fix is *semantically* the right
  one — a three-way matrix shows the new guard agrees with the deploy step's
  `test -f` on all 7 filesystem shapes where the old one disagreed on 3. The
  broken-symlink case exits 1 with a diagnosis and no stack trace, and the suite
  asserts the absence of a trace rather than trusting an observation.
- **Finding 3 (no tests):** closed. 23 tests, both guards, their wiring, every
  test independently load-bearing under 24 targeted mutations (24/24 caught,
  zero survivors), M8 proving the suite fails loudly if the guard is *removed*,
  and M11 proving the original hole is pinned by exactly the right test.
- **The config change:** the risk was real but is **zero in practice**. The
  production build is byte-for-byte identical, verified by building with the old
  and new config and diffing all seven `dist` files by `sha256`. The glob's
  collection surface was probed with 9 canary files and is exactly
  `scripts/**/*.test.mjs` minus `node_modules` and `dist`. I also showed the
  change was *not* avoidable: the alternative (`web/src/**/*.test.ts`, per
  `CONTRIBUTING.md`) fails `npm run typecheck` with 11 errors because
  `@types/node` is absent.
- **False positives:** the full CI sequence is green end-to-end on a **real
  truncated index**, and every manifest shape a legitimate run can produce
  passes. The extracted `deploy.yml` step passes on the real `dist` and fails on
  the three states it is meant to fail on. `npm run dev` and `npm test` are
  unaffected with the data present **and** absent.

**PASS.** The change is minimal, correct, hermetic, and does not weaken any
guard or any existing test. Commit as-is; the one thing I would add before or
soon after is §8.1, a test pinning the `scripts/**/*.test.mjs` glob, because a
registration that can be deleted with exit 0 is the same class of silent failure
this item exists to eliminate.
