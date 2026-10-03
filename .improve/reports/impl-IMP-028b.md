# IMP-028b — close the three findings from the IMP-028 verification

**Item:** IMP-028b (follow-up to the PASS on IMP-028/IMP-029)
**Base commit:** `b2447c5` (chore(improve): mark IMP-029 done)
**Scope:** `readme.md`, `web/scripts/require-index.mjs`, `web/scripts/__tests__/indexGuards.test.mjs`
(new), `web/vite.config.ts`, this report.
**Status:** all three findings closed. No guard was weakened, no dependency added,
`package-lock.json` untouched, nothing committed.

---

## 1. Finding 1 — the stale `readme.md` comment (fixed)

`readme.md:115` documented the build as `# tsc --noEmit && vite build`, which stopped
being true the moment IMP-028 inserted the guard into the `build` script
(`web/package.json:8` is `tsc --noEmit && node scripts/require-index.mjs && vite build`).

**Changed** (`readme.md:112-123`):

```shell
npm run typecheck   # tsc --noEmit
npm test            # vitest: search, collections, index loading, components, guards
npm run build       # tsc --noEmit && node scripts/require-index.mjs && vite build
```

plus a new paragraph under the block:

> `npm run build` fails unless the index from step 1 is already in
> `web/public/data/`: a production build has to ship the index, `vite build` copies
> `public/data` verbatim only when that directory already exists, and a `dist` with
> no `dist/data` deploys a site that reads "No paper index yet" forever. Generate
> it first. `npm run dev` and `npm test` do not check for it, so a missing index
> costs a developer nothing until they are trying to produce something deployable.

**Reconciliation audit** — every `readme.md` passage that describes the build, and
whether it is now true (read at the stated lines, after the edit):

| Line | Passage | Verdict |
| --- | --- | --- |
| `readme.md:115` | `npm run build # …` in the tests-and-build block | **was stale, fixed** — now names the guard |
| `readme.md:103-105` | "If the data files are missing, the app shows a clear 'no paper index yet' message instead of failing — so `npm run dev` still renders without a network build." | **still true**, and re-confirmed live in §5 below (dev renders that page with `public/data` absent). Not changed. It now agrees with the new paragraph rather than contradicting it: the dev server is lenient, the build is not. |
| `readme.md:114` | `npm test # vitest: search, collections, …` | **updated** — the suite now also runs the guard tests, so the list needed the word "guards" |
| `readme.md:118-123` | new paragraph | documents the build's new failure mode, which the readme previously omitted entirely |
| `readme.md:191-193` (Deployment) | "CI … runs the Python `unittest` suite and, for the web app, `npm ci`, `npm run typecheck`, `npm test`, a small paper-index build and then `npm run build`." | **still true** — `ci.yml` does exactly that, in that order, and the new tests are inside `npm test` so this line is now more true than before. Not changed. |
| `readme.md:63` | "This writes `web/public/data/index.json` plus `data/papers-<YYYY>-W<NN>.json`." | **pre-existing, unrelated bug, reported not fixed** — the second path is missing its `web/public/` prefix, so the readme names a file at the repository root that `build_index.py` never writes. It describes `build_index.py`'s output, not `npm run build`, and it predates IMP-028: `git show ba0cedc --stat -- readme.md` is empty, so that commit never touched the readme at all. Filed for the backlog rather than smuggled into this change. |

**And the reconciliation is now enforced, not just asserted:** the new test
`documents the build command the package actually runs` fails if the readme's
`npm run build` line drifts away from `package.json` again. It caught this very
finding during development — see §4.

---

## 2. Finding 2 — the shard check accepted a directory (fixed)

`web/scripts/require-index.mjs:90` used `existsSync`, which is true for a
directory, so a directory named `papers-2026-W40.json` passed the build guard
while the deploy step's `test -f` rejected it.

**Changed** (`web/scripts/require-index.mjs`): `existsSync` is still used for the
manifest itself — where `readFileSync`/`JSON.parse` already discriminates, and
which was already proven to reject a directory — but the shard check now goes
through a new `shardProblem()` that requires a regular file:

```js
function shardProblem(shardPath) {
  let stats;
  try {
    stats = statSync(shardPath);
  } catch {
    return "is not there";
  }
  if (stats.isFile()) {
    return null;
  }
  return stats.isDirectory()
    ? "is a directory, not a file"
    : "is not a regular file";
}
```

Design notes, each of which is a deliberate decision rather than an accident:

- **The `try`/`catch` is load-bearing, not defensive boilerplate.** The task's own
  suggested fix, a bare `statSync(...).isFile()`, turns a *broken symlink* into an
  unhandled `ENOENT`: a stack trace, no diagnosis, and — critically — the same
  exit code 1 as a real refusal, so nothing downstream can tell the two apart.
  Folding the outcome into a phrase makes "not there" and "not a file" two
  different sentences and keeps both distinguishable from a crash. The new tests
  assert the absence of a stack trace (`/^\s+at /m`, `/\bENOENT\b/`,
  `/Node\.js v\d/`) so a regression to the bare form fails the suite.
- **`statSync` follows symlinks, so this matches `test -f` exactly** — the point
  of the change is that the two gates stop disagreeing. A symlink to a real shard
  passes (pinned by a test, so "require a regular file" cannot later be
  misread as "reject every symlink", which would be a new failure mode); a
  dangling one fails with `is not there`.
- The refusal message is the old one, generalized, so the deploy step's
  wording and the build guard's still describe the same class of fault.

**Direct verification** of the three cases the task named, run by hand against the
edited file (each fixture in a fresh `mktemp -d`):

```
A  shard is a directory
   The paper index at …/index.json names a shard that is a directory, not a file: papers-2026-W40.json
   …  EXIT=1
B  shard is a regular file
   Paper index present: …/index.json with 1 shard(s).        EXIT=0
C  shard is a broken symlink
   The paper index at …/index.json names a shard that is not there: papers-2026-W40.json
   …  EXIT=1        (no stack trace, no ENOENT anywhere in stderr)
D  shard is a symlink to a regular file
   Paper index present: …/index.json with 1 shard(s).        EXIT=0
E  shard is absent entirely
   … names a shard that is not there: papers-2026-W40.json  EXIT=1
F  the real web/public/data
   Paper index present: web/public/data/index.json with 2 shard(s).  EXIT=0
```

All six are also covered by the automated suite (§3), and case C's
no-stack-trace property is asserted in code, not just observed here.

---

## 3. Finding 3 — the guards had no tests (closed)

### 3.1 Where the tests live, and why

**`web/scripts/__tests__/indexGuards.test.mjs`**, 23 tests, registered by adding one
glob (`scripts/**/*.test.mjs`) to `test.include` in `web/vite.config.ts`.

The choice was between widening an existing config and adding a dedicated runner.
Four constraints decided it:

1. **A dedicated runner would never run in CI.** `ci.yml`'s `web-tests` job runs
   exactly `npm ci`, `npm run typecheck`, `npm test`, a paper-index build, and
   `npm run build`. A new `test:guards` script, a second vitest config, or a
   `node --test` file would each need an edit to `.github/workflows/ci.yml` to be
   executed — and this item is forbidden from touching `.github/`. A test file
   nothing runs is the same as no test file, and it is the *worst* kind, because
   it looks like coverage. Widening `include` is the only registration that
   reaches CI under the constraints, and it reaches it through the command the
   profile already documents as the web suite.
2. **The Python suite cannot reach these guards meaningfully.** `tests/` runs in
   the `python-tests` job, which installs `requirements.txt` and no Node. Testing a
   Node script there means shelling out to a `node` that job never provisions —
   coverage that depends on an undeclared runtime. (The verifier's own suggestion of
   two *text* assertions in `tests/` is viable and CI-safe; it is a strictly weaker
   kind of test, though — it proves the strings are present, not that the guard
   bites. I put the behavioral tests in JS and kept the wiring assertions next to
   them so both guards are covered in one place, in one runner.)
3. **Blast radius on the existing 266 tests: zero by construction.** `include` is a
   list of globs; the two `src/` globs are byte-identical, so every test that was
   collected before is still collected by the same rule. `environment`,
   `setupFiles`, and `plugins` are untouched. Measured: **17 files / 266 tests
   before, 18 files / 289 tests after** — exactly one file and exactly the 23 new
   tests added, nothing else moved.
4. **The `node` environment is already a repo pattern, not a new axis.**
   `web/scripts/__tests__/indexGuards.test.mjs:1` carries the
   `// @vitest-environment node` docblock that `src/lib/__tests__/urlState.test.ts:1`
   already uses (50 tests) and that `REPO_PROFILE.md:324-326` documents. That file
   also proves `setupFiles: ["src/test-setup.ts"]` is safe under a `node`
   environment — it imports `@testing-library/react`, which is why this is a
   measured decision rather than an assumption.

The file is `.mjs`, not `.ts`, on purpose: `tsconfig.json` has no `allowJs`, so a
`.ts` test could not reference the `.mjs` guard without breaking `npm run typecheck`.
Keeping it `.mjs` also means `include: ["src", "vite.config.ts"]` stays untouched
and the tests are invisible to tsc — zero typecheck blast radius.

### 3.2 How the tests exercise the guard

They **spawn** `node scripts/require-index.mjs` as a child process rather than
importing it. The guard reads `process.argv` and calls `process.exit` at module
scope, so importing it would kill the vitest worker or test something other than
what the build runs. A spawn is the same invocation `npm run build` makes, costs
~30 ms, and exercises `argv`, `cwd`, `process.exit` and the real stream writes.
The whole file runs in **1.4 s**.

Hermetic by construction: every fixture is a fresh `mkdtempSync` under the OS temp
dir, removed in `afterEach`; nothing is written inside the repository; no network;
no `vite build`; no shared state between tests (verified by 23/23 passing in
isolation and in the full suite alike).

### 3.3 Coverage map

Every case the task required, plus what each one is for:

| # | Test | Result asserted |
| --- | --- | --- |
| 1 | refuses a data directory that is not there at all | exit 1, names `public/data/index.json`, tells you to run `build_index.py` |
| 2 | refuses a data directory that holds no `index.json` | exit 1, "does not exist" |
| 3 | refuses an `index.json` that is empty | exit 1, "could not be read as an index manifest" |
| 4 | refuses an `index.json` that is a directory | exit 1, same message (EISDIR) |
| 5 | refuses an `index.json` that is malformed JSON | exit 1, same message |
| 6 | refuses an `index.json` that is a dangling symlink | exit 1, "does not exist", no crash |
| 7 | refuses a manifest with no `shards` key | exit 1, `has no "shards" list` |
| 8 | refuses a manifest whose `shards` list is empty | exit 1, `names no shards` |
| 9 | refuses a manifest naming a shard that is not there | exit 1, "is not there" |
| 10 | **refuses a shard that is a directory** | exit 1, **"is a directory, not a file"** — Finding 2's case |
| 11 | **refuses a shard that is a dangling symlink, without crashing** | exit 1, "is not there", **and no stack frame / no `ENOENT` / no Node banner** |
| 12 | refuses a shard entry with no `file` name | exit 1, `shard entry without a "file" name` |
| 13 | refuses a shard entry whose `file` is not a string | exit 1, same |
| 14 | accepts a manifest whose shard is a regular file | exit 0, `with 1 shard(s).` |
| 15 | accepts a manifest naming several shards | exit 0, `with 2 shard(s).` |
| 16 | **accepts an index at the default path, the way `npm run build` calls it** | exit 0 — the no-argument invocation, the one the build script actually makes |
| 17 | accepts a shard that is a symlink to a regular file | exit 0 — pins the `test -f` equivalence |
| 18 | **accepts an incomplete index carrying `failedCategories` + `truncatedCategories`** | exit 0 — IMP-204's partial index must still build |
| 19 | accepts the same index reached by absolute path | exit 0 |
| 20 | runs the guard in the build script, before `vite build` | `scripts.build` contains `node scripts/require-index.mjs`, and its index is below `vite build`'s |
| 21 | never runs the guard from `npm run dev` or `npm test` | both scripts are guard-free — the property this very suite depends on |
| 22 | has the deploy workflow assert the index after the build and before the upload | **the second guard (IMP-029)**: `run: npm run build` < `actions/upload-pages-artifact`, and the text between them reads `web/dist/data` and can `exit 1` |
| 23 | documents the build command the package actually runs | **Finding 1's regression guard** (readme ↔ `package.json`) |

Test 18 is the one most likely to be got wrong in a "fix", so its reasoning is in
the code: a run where one category died or hit `--max-per-category` still writes
the index it did collect and records the shortfall, and the site renders that as an
on-screen notice. Refusing the build there would take down a feed that is honest
about what it is missing.

Test 22 is the reason this file is about *both* guards rather than only the one in
`web/scripts/`. It is anchored on content (`web/dist/data`, `exit 1`, the position
of the two neighbouring steps) rather than on the step's display name, so renaming
the step does not break it and deleting the step does. This is the same technique
the Python suite already uses on `deploy.yml` (`tests/test_arxiv_common.py`'s
`workflow_timeouts` reads the workflow as text, with no PyYAML dependency).

---

## 4. Non-vacuity evidence

Two independent pieces of evidence.

**(a) The suite was red before the fix, for the right reason.** The first run of
`npm test` after registering the file, with `readme.md` still stale, failed exactly
one test:

```
FAIL  scripts/__tests__/indexGuards.test.mjs > the guards stay wired into the
      commands that run them > documents the build command the package actually runs
AssertionError: readme should describe the guard:
  "npm run build       # tsc --noEmit && vite build": expected … to contain 'require-index.mjs'
 Test Files  1 failed | 17 passed (18)
      Tests  1 failed | 288 passed (289)
```

**(b) Six mutations, each caught by exactly the right test.** Harness:
`/tmp/imp028b-mutate/mutate.py`, applied to a throwaway copy at
`/tmp/imp028b-mutate` with `/tmp/imp028b-pristine` kept to restore between runs
(copies, never a git command — no `restore`/`checkout`/`clean`/`stash` was run at
any point in this item). Each mutation is a single surgical edit to the guard, the
package, the workflow, or the readme, followed by
`npx vitest run scripts/__tests__/indexGuards.test.mjs`:

```
=== M1 revert the shard check to existsSync (the IMP-028 verifier's hole)
    exit=1  Tests  1 failed | 22 passed (23)
    caught by: require-index.mjs refuses an index it must not ship > refuses a shard that is a directory

=== M2 delete the empty-shards-list check
    exit=1  Tests  1 failed | 22 passed (23)
    caught by: … > refuses a manifest whose shards list is empty

=== M3 stop failing on a missing index.json (the core fail-closed property)
    exit=1  Tests  3 failed | 20 passed (23)
    caught by: … > refuses a data directory that is not there at all
    caught by: … > refuses a data directory that holds no index.json
    caught by: … > refuses an index.json that is a dangling symlink

=== M4 drop the guard from the build script
    exit=1  Tests  1 failed | 22 passed (23)
    caught by: the guards stay wired into the commands that run them > runs the guard in the build script, before vite build

=== M5 delete the deploy workflow's dist/data assertion step
    exit=1  Tests  1 failed | 22 passed (23)
    caught by: the guards stay wired into the commands that run them > has the deploy workflow assert the index after the build and before the upload

=== M6 reword the readme back to a build command without the guard
    exit=1  Tests  1 failed | 22 passed (23)
    caught by: the guards stay wired into the commands that run them > documents the build command the package actually runs
```

M1 is the decisive one: it reinstates precisely the hole the IMP-028 verifier
proved, and exactly one test — the directory-shard test — notices.

M3's discrimination is also worth recording: it is caught by the three
"index.json is not there" tests and **not** by the malformed-JSON test, which is
correct, because that one fails in the `JSON.parse` path rather than the
`existsSync` path. A suite where every mutation trips every test would be
indistinguishable from a suite asserting nothing in particular.

---

## 5. Every command run, with results

### 5.1 Baselines, before any edit

```
$ shasum -a 256 web/public/data/*
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  web/public/data/index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2d999c3888246a86d7369e  web/public/data/papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  web/public/data/papers-2026-W40.json

$ git rev-parse HEAD
b2447c5cf97f859d4e64817604a9523205d61706

$ /usr/local/bin/python3.11 -m unittest discover -s tests
Ran 104 tests in 1.139s
OK

$ cd web && npm run typecheck        # exit 0, no output
$ cd web && npm test
 Test Files  17 passed (17)
      Tests  266 passed (266)
   Duration  4.23s
```

### 5.2 The required verification, after the edits

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 104 tests in 1.100s
OK

$ cd web && npm run typecheck        # tsc --noEmit -> exit 0, no output

$ cd web && npm test
 ✓ scripts/__tests__/indexGuards.test.mjs (23 tests) 1418ms
 Test Files  18 passed (18)
      Tests  289 passed (289)
   Duration  5.57s
   # 266 -> 289, 17 -> 18 files: +23 tests, +1 file, nothing else moved

$ cd web && npm run build
> tsc --noEmit && node scripts/require-index.mjs && vite build
Paper index present: web/public/data/index.json with 2 shard(s).
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-B28RVUhO.js   172.50 kB │ gzip: 55.22 kB
✓ built in 406ms
exit=0
# 41 modules / JS 172.50 kB / CSS 10.93 kB == the STATE.md baseline, byte for byte:
# no bundle regression from any of this.

$ diff -r web/dist/data web/public/data     # IDENTICAL
```

### 5.3 `npm run dev` and `npm test` with the data PRESENT (main repo)

```
$ cd web && npm run dev                # ready on :5173
$ curl -s -o /dev/null -w '%{http_code}' http://localhost:5173/research-paper-feed/
200
$ curl … /research-paper-feed/data/index.json
200   (495 bytes, the real manifest)
```

Playwright at 1280×720, console clean apart from Vite's own connect messages and
React's DevTools notice. The snapshot shows the live feed: heading "Recent arXiv
papers in CS & AI", "2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index
generated Oct 1, 2026", all five category chips pressed, the 7/30/60 day group and
the Newest/Relevance sort control. Nothing about the dev path changed.

`npm test` with the data present: **289 passed** (§5.2).

### 5.4 `npm run dev` and `npm test` with the data ABSENT

Done in `/tmp/imp028b-ci` rather than the repository, because the hard safety rule
for this item forbids moving any file in the working tree — so the repository's
`web/public/data` was never touched.

```
$ cd /tmp/imp028b-ci/web && npm test        # web/public/data absent
 Test Files  18 passed (18)
      Tests  289 passed (289)
   Duration  4.91s
```

`npm run dev` with `public/data` absent, same copy: HTTP 200, and Playwright shows
the app's own empty-index page — heading **"No paper index yet"**, "The paper index
could not be loaded, so there is no feed to show…", a "Try again" button, and the
`python scripts/build_index.py` / `cd web && npm run dev` instructions. The single
console error is the app's own `IndexUnavailableError` log, which is the
pre-existing baseline for this state, not a regression. This is what
`readme.md:103-105` promises, and the new readme paragraph at `readme.md:118-123`
now says the same thing about the build being the opposite.

### 5.5 The CI-like sequence in a clean copy — the case that must not break

`/tmp/imp028b-ci`, created with `rsync` from the working tree excluding `.git`,
`web/node_modules`, `web/dist`, `web/public/data` and `__pycache__`, so it starts
with **no index and no `dist`**, exactly like a fresh CI runner. Steps in
`ci.yml`'s order:

```
$ cd /tmp/imp028b-ci/web && npm ci
# lockfile unchanged by this item; install succeeded

$ npm run typecheck
exit=0

$ npm test                                # with web/public/data absent
 Test Files  18 passed (18)
      Tests  289 passed (289)

$ cd /tmp/imp028b-ci && python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
INFO:arxiv:Got first page: 5 of 207907 total results
WARNING:  cs.CV hit the 5-result cap; older papers in the window may be missing
INFO:root:Wrote 5 papers across 1 shards to web/public/data
# a REAL network run; index.json carries "truncatedCategories": ["cs.CV"]

$ cd /tmp/imp028b-ci/web && npm run build
> tsc --noEmit && node scripts/require-index.mjs && vite build
Paper index present: public/data/index.json with 1 shard(s).
✓ 41 modules transformed.
✓ built in 365ms
exit=0
$ ls dist/data    ->  index.json  papers-2026-W40.json
```

The second guard was then run against that real `dist`, extracted verbatim from
`deploy.yml` (31 lines, de-indented, executed with `bash` from the copy's root):

```
$ bash /tmp/imp028b-deploy-step.sh     # in /tmp/imp028b-ci
Paper index present: 1 shard(s).
exit=0
```

So the whole chain — `build_index.py` → build guard → `vite build` → deploy guard —
is green on a real, truncated index.

### 5.6 The guards still fail closed

With the same copy's index moved aside (again, in `/tmp` only):

```
$ npm run build
exit=1
grep -c "vite v5" log   ->  0        # vite never ran
… No paper index to build against: public/data/index.json does not exist. …
   Generate the index first, from the repository root:
       python scripts/build_index.py
$ mv data back && npm run build    ->  exit=0
```

No legitimate configuration was found in which either guard is skipped: the guard
is unconditional in `build`, takes no flag, and the only argument form
(`node scripts/require-index.mjs <dir>`) is unreachable from `npm run build` because
npm appends arguments after `vite build`.

### 5.7 Scope and data integrity

```
$ shasum -a 256 web/public/data/*  > after.txt ; diff before.txt after.txt
IDENTICAL to baseline          # all three files byte-for-byte unchanged

$ git status --porcelain
 M readme.md
 M web/scripts/require-index.mjs
 M web/vite.config.ts
?? web/scripts/__tests__/
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/regression-sweep-4.md
# the three .improve/reports entries were already untracked at the start of this
# item (first `git status` in this session) and are not mine.

$ git diff --stat
 readme.md                     | 11 ++++++++--
 web/scripts/require-index.mjs | 49 +++++++++++++++++++++++++++++++++++++------
 web/vite.config.ts            | 13 +++++++++++-
 3 files changed, 64 insertions(+), 9 deletions(-)
```

Nothing outside the allowed set was modified. Not touched: `web/src/**`,
`scripts/`, `requirements.txt`, `CONTRIBUTING.md`, `.github/**`, `notebooks/`,
`.improve/FEATURES.md`, `.improve/PROGRESS.log`, `web/package.json`,
`web/package-lock.json`, `web/tsconfig.json`, `tests/**`. No dependency was added.
No file was deleted or moved anywhere. No `git` command that writes was run: no
`add`, `commit`, `push`, `restore`, `checkout`, `clean` or `stash` — isolation was
done with `rsync` and `cp` into `/tmp`.

---

## 6. Left for the backlog

1. **`readme.md:63`** — "plus `data/papers-<YYYY>-W<NN>.json`" is missing its
   `web/public/` prefix and names a file `build_index.py` never writes. Pre-existing,
   unrelated to `npm run build`, not fixed here (§1).
2. **`REPO_PROFILE.md:153-154`** still records `npm test # vitest run -> 16 files,
   253 tests` and `npm run build # tsc --noEmit && vite build`, and the test table at
   `:186-203` does not list the new file. `REPO_PROFILE.md` is the coordinator's
   document, not this item's file, so its baseline now lags by exactly +36 tests and
   +1 file (253 → 289 at the time of writing; the coordinator's own numbers should
   win if they have moved since). Left for the profile maintainer.
3. **`tsconfig.json` still cannot see `web/scripts/**`**, so the guard remains
   type-invisible. That is now a much smaller gap than it was — the file has 23
   behavioural tests — but it is unchanged, and adding `allowJs` would widen
   `npm run typecheck` over a file with no type surface to check. Not worth it.
