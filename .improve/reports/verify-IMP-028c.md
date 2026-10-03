# verify-IMP-028c — independent verification of the index-guard registration pin

**Verdict: PASS** (2 minor issues, neither blocking, one of them a genuine
false-positive the implementer's report does not disclose)

Verifier did not write this change. Every number below was produced in a fresh
`/tmp/v028c/*` copy of the repository (rsync of the working tree, including
`node_modules`) or by running the real repo read-only. No git write command was
run; `git diff --stat HEAD` is still empty and no repo file was deleted, moved
or restored.

---

## 1. The pin reproduced independently

The deletion was performed in my own copy
(`/tmp/v028c/exp/web/vite.config.ts`, whole-repo copy, never in the repo).
One line removed from the `include` array:

```
     include: [
       "src/**/*.test.ts",
       "src/**/*.test.tsx",
-      "scripts/**/*.test.mjs",
     ],
```

The literal string `scripts/**/*.test.mjs` still exists in that file at
**line 11, inside the comment block** — I confirmed with `grep -n`. A
regex/text-based pin would still have found it.

### `npm test` on the mutated copy

```
NPM_TEST_EXIT=1

 ❯ src/__tests__/indexGuardRegistration.test.ts (4 tests | 3 failed) 592ms
   × … > collects the guard suite, so the tests guarding every deploy actually run 316ms
     → scripts/__tests__/indexGuards.test.mjs is not collected, so the 23 tests guarding
       every production build are not running. vitest's test.include no longer reaches
       scripts/.: expected [ …(18) ] to include 'scripts/__tests__/indexGuards.test.mjs'
   × … > collects the guard suite's cases, not just its file 274ms
     → scripts/__tests__/indexGuards.test.mjs should be collected: expected [] to include
       'scripts/__tests__/indexGuards.test.mjs'
   × … > keeps an include pattern anchored at scripts/ in vite.config.ts 2ms
     → vite.config.ts's test.include no longer reaches scripts/, so
       scripts/__tests__/indexGuards.test.mjs stops being collected: expected false to be true

 Test Files  1 failed | 17 passed (18)
      Tests  3 failed | 267 passed (270)
```

Assertion sites `indexGuardRegistration.test.ts:89`, `:109`, `:136`.

**File/test counts: 18 files / 270 tests, exit 1.** Before this change the same
deletion gave exit 0 / 17 files / 266 tests. The hole is closed. This is the
whole point and it holds.

Note the 4th test ("collects itself") correctly still passes — the pin lives
under `src/`, so the narrowing it guards cannot reach it. Independently
confirmed: with only the two original globs present, the pin file is still
collected and still executes.

### Pin passes on the unmodified repo

`npm test` from `web/`: **19 files / 293 tests, exit 0**. Same in every
`/tmp` copy whose config was restored (`diff -q` against the pristine config
byte-for-byte before each run).

### Five further narrowing / perturbation experiments

Every row run by me; every config edit confined to my own copy.

| # | Edit to `vite.config.ts` | exit | files / tests | Pin outcome |
| --- | --- | --- | --- | --- |
| A | delete the `scripts/**/*.test.mjs` glob | **1** | 18 / 270 (3 failed) | caught (witnesses 1, 3, 4) |
| B | narrow to `scripts/__tests__/indexGuard.test.mjs` (keeps a `scripts/` anchor, misses the file) | **1** | 18 / 270 (2 failed) | caught (witnesses 1, 3; witness 4 passes) |
| C | add `exclude: ["scripts/**"]`, `include` untouched | **1** | 18 / 270 (2 failed) | caught (witnesses 1, 3) |
| D | delete the `include` array entirely | 0 | 19 / 293 | no failure — **correct**: vitest's default `**/*.{test,spec}.?(c|m)[jt]s?(x)` still collects the guard suite, so all 23 tests still run. Not a hole. |
| G | rename `indexGuards.test.mjs` → `indexGuardsLegacy.test.mjs` | **1** | 19 / 293 (2 failed) | caught (witnesses 1, 3) |
| H | split config: new `vitest.config.ts` with no `include` | 0 | 19 / 293 | no failure — correct, guards still collected |
| H2 | split config: `vitest.config.ts` with the two original globs | **1** | 18 / 270 (2 failed) | caught (witnesses 1, 3) |

Experiment C is the one the implementer's table does not list and it is the
most realistic hole of all — `exclude` wins over `include`, so the guards
silently vanish while the config still *reads* as reaching `scripts/`. The pin
catches it. Good.

---

## 2. Mechanism

### Does it recurse, deadlock or hang? No.

Two independent proofs, both mine:

1. **`vitest list --filesOnly` never imports a module.** I dropped a
   `src/__tests__/zzBoom.test.ts` containing a top-level
   `throw new Error("IMPORT SIDE EFFECT FIRED")` into a copy.
   `list --filesOnly` printed `src/__tests__/zzBoom.test.ts` with **no error**
   (exit 0). The same file through `list … --json` surfaced the import error
   twice. So the load-bearing witness globs only — it cannot execute the pin's
   own `it` bodies, therefore cannot re-enter the probe.

2. **The `--json` witness's filter cannot reach the probe.**
   `vitest list scripts/__tests__ --json` returns exactly **23 cases from
   exactly one file**,
   `/…/web/scripts/__tests__/indexGuards.test.mjs`. The pin file lives in
   `src/__tests__/` and is not in that set. The probe is never re-entered.

Measured, not assumed: sampling `ps` every 150 ms across a full `npm test`
gave a **peak of 1 concurrent `vitest.mjs list` child** (peak 10 processes
total). No fan-out, no unbounded tree.

No deadlock under any of the constrained pools:

| Invocation | Result |
| --- | --- |
| `--pool=threads --poolOptions.threads.singleThread` | 19 / 293, exit 0, 5.09 s |
| `--maxWorkers=1 --minWorkers=1` | 19 / 293, exit 0, 15.99 s |
| `--no-file-parallelism` | 19 / 293, exit 0, 33.87 s |

**Cost.** The pin file itself reports **918–1330 ms** across six runs
(witness 4 ≈ 1–5 ms; witness 1/2 ≈ 290–380 ms; witness 3 ≈ 612–859 ms). The
`once()` memo means the two `--filesOnly` callers pay for one child process,
not two. Whole-suite wall time from `web/`: **5.69 / 5.81 / 6.01 / 6.05 /
7.24 s** (five consecutive runs). A cold-cache whole-repo copy without the pin
measured 9.37 s, so the pin's attributable cost is the ~1 s above, not a
suite-wide regression. Acceptable for what it buys. Note the 23 guard tests
already spawn subprocesses too (`scripts/__tests__/indexGuards.test.mjs`,
2.0 s), so this is an established pattern in this tree, not a new one.

### Is it robust when `vitest` is not on `PATH`? Yes — and it never skips.

`collectWithVitest.mjs` uses `process.execPath` plus
`createRequire(import.meta.url).resolve("vitest/package.json")`, so it needs
neither `PATH` nor `npx`. Verified with a stripped environment:

```
env -i HOME="$HOME" PATH="/nonexistent-bin" node node_modules/vitest/vitest.mjs run \
    src/__tests__/indexGuardRegistration.test.ts
→ Test Files 1 passed (1) / Tests 4 passed (4), exit 0
```

So the `npx` invocation CI or a developer might use works, and a bare `vitest`
binary missing from `PATH` is irrelevant.

**Fail-closed, verified twice.** I pointed the probe at a nonexistent vitest
binary in a scratch copy:

```
BROKENBIN_EXIT=1
   × … > collects the guard suite, so the tests guarding every deploy actually run 63ms
     → vitest list --filesOnly should be runnable: expected 'vitest list --filesOnly failed
       \nspawn…' to be null
   × … > collects itself…  → vitest list --filesOnly should succeed: …
   × … > collects the guard suite's cases… → vitest list --json should succeed: …
 Test Files 1 failed (1) / Tests 3 failed | 1 passed (4)
```

No `skip`, no `todo`, no conditional bail-out anywhere in the pin. And I got a
second, unplanned demonstration: my own copies briefly filled the disk, the
child failed to load its config with `ENOSPC`, and the pin reported the
child's own stderr inside the assertion message and **failed**. If the runner
cannot be asked, the pin is red. That is the correct behaviour for a pin.

`createRequire.resolve` on a missing `vitest` throws
`MODULE_NOT_FOUND` (verified), and a throw inside `it()` is a test failure, so
the unresolvable-install path is also red rather than green.

### Is it robust to a different working directory? Yes.

`WEB_ROOT` is `fileURLToPath(new URL("../../", import.meta.url))` — derived
from the module's own URL, and passed explicitly as `cwd` to `spawnSync`. No
`process.cwd()` anywhere in the probe.

| Invocation | Result |
| --- | --- |
| from `web/` (`npm test`) | 19 / 293, exit 0 |
| from the repo root: `node web/node_modules/vitest/vitest.mjs run --root web` | 19 / 293, exit 0 |
| from `/tmp`, with `--root` absolute | **`indexGuardRegistration.test.ts (4 tests)` passed, 1154 ms** — 4/4 green |

In that last run 16 other files failed, all on one pre-existing cause
(`Failed to load url …/src/test-setup.ts` — a `/tmp` vs `/private/tmp` symlink
artifact of my harness, reproducible without the pin). The pin itself was
unaffected, which is the point: it does not care about the caller's cwd.

### Does the `--json` filter admit misleading names? No.

- `expect(files).toContain(GUARD_SUITE)` is exact string equality on the
  posix-relative path, so only the literal
  `scripts/__tests__/indexGuards.test.mjs` satisfies it.
- `expect(names).toContain(name)` for the two deploy-critical cases is likewise
  exact equality on the full test name — a case that merely *contains* the
  string does not match.

Tested adversarially: renaming the guard file (experiment G) fails the pin on
both the file check and the case check, even though all 23 tests still ran
under the new name. No substring or rename bypass exists.

### Issue 1 (minor, actionable): `spawnSync` has no timeout

`collectWithVitest.mjs:61` calls `spawnSync` with no `timeout` option. It is
synchronous, so a child that ever hung would block the worker's event loop
indefinitely — and vitest's per-test `120_000` timeout could **not** fire,
because a synchronous call never yields. The only backstop would be the CI
job's `timeout-minutes: 25`.

Fix is one line and I verified the semantics it relies on:

```
spawnSync(node, [hang], { timeout: 2000 })
→ elapsed 2007 ms, status = null, signal = 'SIGTERM', error.code = 'ETIMEDOUT'
   status !== 0  → true
```

So adding `timeout: 60_000` to the existing options object makes a hung child
take the existing `status !== 0` branch and **fail** the pin rather than hang
the job. Recommended; not blocking, since every realistic path I could find
either succeeds or exits non-zero.

---

## 3. The backup witness — are the two families independent?

Yes, and I can show they disagree in *both* directions, which is the test for
independence.

| Experiment | Witnesses 1 & 3 (spawn the real runner) | Witness 4 (imports the config) |
| --- | --- | --- |
| A — delete the glob | **fail** | **fail** |
| B — narrow to a `scripts/`-anchored path that misses the file | **fail** | pass |
| C — `exclude: ["scripts/**"]` | **fail** | pass |
| F — replace the glob with `**/*.test.mjs` (still collects) | pass | **fail** |
| G — rename the guard file | **fail** | pass |
| H2 — config split dropping the glob | **fail** | pass |

They read the same `vite.config.ts`, but through different mechanisms and in
different processes (witnesses 1/3 spawn a fresh Node that loads the config
through vite's own resolver; witness 4 evaluates the module in the parent).
No single edit satisfied both trivially in any experiment. Answering the
question directly:

- **Witnesses 1 & 3 alone catch every real hole** — A, B, C, G, H2.
- **Witness 4 alone catches only experiment A**, which 1 & 3 also catch.

Witness 4 is the weak one; see issue 2.

---

## 4. Is the pin over-broad? Mostly no — with one real false positive

**Not over-broad to additive changes.** I added a third test directory with a
real test file:

```
include: [..., "e2e/**/*.test.ts"]  +  web/e2e/smoke.test.ts (1 test)
→ Test Files 20 passed (20) / Tests 294 passed (294), exit 0, zero failures
```

And a third glob with no matching directory: 19 / 293, exit 0. Deleting the
whole `include` array (which still collects the guards) is deliberately
tolerated: 19 / 293, exit 0. The pin is not hard-coding a total test count —
the `23` is a floor scoped to the guard suite's own cases, checked with
`toBeGreaterThanOrEqual`.

### Issue 2 (minor, actionable): witness 4 is a false-positive generator

Experiment **F** — replace the glob with an equivalent, behaviour-preserving one:

```
-      "scripts/**/*.test.mjs",
+      "**/*.test.mjs",
```

```
NPM_TEST_EXIT=1
 Test Files  1 failed | 18 passed (19)
      Tests  1 failed | 292 passed (293)
   × … > keeps an include pattern anchored at scripts/ in vite.config.ts 5ms
     → vite.config.ts's test.include no longer reaches scripts/, so
       scripts/__tests__/indexGuards.test.mjs stops being collected: expected false to be true
```

**All 23 guard tests were collected and ran** (19 files, 293 tests, only the
pin's own assertion red). The pin rejects a config under which the guards are
demonstrably still running, because `includeReachesScripts()`
(`indexGuardRegistration.test.ts:67`) demands a literal `scripts` anchor rather
than asking whether the suite is collected. Its error message is also wrong in
this case — it claims the suite "stops being collected" when it does not.

Two further notes on the same witness:

- It goes stale under a config split: in H2, `vite.config.ts` still declared
  the glob while `vitest.config.ts` (the config vitest actually uses) did not.
  Witness 4 read the wrong file and passed.
- I could not construct any scenario where witness 4 is the *only* catcher.
  Every hole it finds, witnesses 1 & 3 find too; it adds a false positive and a
  stale read, and no unique coverage.

The report's own text overstates this. `impl-IMP-028c.md:58-61` says the
behavioural witness "survives `include` being rewritten in any equivalent form
(including being deleted outright)" — true for witnesses 1/3, **not** for the
file as a whole, because witness 4 fails on that equivalent form. The
"Bypass resistance" table (`:107-114`) lists only single *narrowing* edits and
never mentions this. That is a disclosure gap in an otherwise careful report.

Recommendation: drop witness 4, or narrow it to a non-blocking documentation
assertion. If it is kept, fix its message to say "the include no longer names
`scripts/` — the guard suite is still collected, but nothing in the config
says so", which is the truth in case F. Cost of dropping it: zero measured
coverage. Benefit: no false positive on a legitimate refactor.

Everything else about the pin's targeting is right: it asserts *collection*
(a path the real runner reports and a case list the real runner enumerates),
not an exact config string, and it survives the two glob-deletion routes
(`include` narrowing and `exclude` widening) plus a config split.

---

## 5. Zero production impact — confirmed byte-identical

`dist` built twice from the same `node_modules`: once from a copy **with** the
three new files, once from a copy **without** them.

```
BUILD_FULL_EXIT=0   ✓ 41 modules transformed.  ✓ built in 458ms
BUILD_BASE_EXIT=0   ✓ 41 modules transformed.  ✓ built in 374ms

file lists:  diff clean — 7 files
sha256:      diff clean — every hash equal
diff -r:     RECURSIVE DIFF CLEAN
```

```
4c977f906786460b07f711984bb8616d873139cc567a6a993670d19d1df65a60  ./assets/index-B28RVUhO.js
6220a3f3c02338cecc28f93867c9ac4c346599df1da19728fade90ab2d00cda3  ./assets/index-G-YE6pVt.css
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  ./data/index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2d999c3888246a86d7369e  ./data/papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  ./data/papers-2026-W40.json
94fc3ee72507b152d20279ab8c74eadb4c0f6eb1a9678bb67320bb077e5a7683  ./favicon.svg
d26092a991aa533ec8a71c65fd89acef846036e126e7a3986a30f0093c457ae7  ./index.html
```

The repo's own `npm run build` produces the same seven hashes. Asset names,
sizes, file list and module count (41) are identical. This is a test-only
change.

---

## 6. No regressions

`git diff --stat HEAD` → **empty**. Not one tracked file is modified. Per-path:

```
web/src/lib          UNCHANGED      web/vite.config.ts    UNCHANGED
web/src/App.tsx      UNCHANGED      web/tsconfig.json     UNCHANGED
web/src/components   UNCHANGED      web/package.json      UNCHANGED
web/scripts          UNCHANGED      web/package-lock.json UNCHANGED
tests (Python)       UNCHANGED      web/index.html        UNCHANGED
readme.md            UNCHANGED      requirements.txt      UNCHANGED
.github              UNCHANGED
```

### All 289 pre-existing tests survive, zero status changes

Compared the full vitest JSON reporter output of a copy with the three new
files removed against the copy with them:

```
baseline unique test keys 289   after 293
MISSING (present before, absent after)   0
STATUS CHANGES                            0
TESTS MOVED TO A DIFFERENT FILE           0
ADDED                                     4   (all four are the pin's own)
AFTER non-passed                          0
scripts/__tests__/indexGuards.test.mjs contributes 23 cases (unchanged)
```

The four additions are exactly the four new assertions in
`the index-guard suite is registered with the test runner`. Nothing else moved.

### Python suite

`python -m unittest discover -s tests` → 3 import errors:
`ModuleNotFoundError: No module named 'arxiv'` / `'pandas'`. **Pre-existing and
environmental**, reproduced identically in a copy containing none of this
change's files. Not a regression.

---

## 7. Commands run from `web/`

| Command | Result |
| --- | --- |
| `npm run typecheck` | **exit 0**, 1.554 s |
| `npm test` | **exit 0 — 19 files / 293 tests**, 7.81 s |
| `npm run build` | **exit 0**, 41 modules, 423 ms, dist hashes identical to baseline |
| `npm test` × 5 (flake) | **exit 0 every time**, all `19 passed (19)` / `293 passed (293)` |

```
run1 exit=0 | 19/293 | Duration 6.01s | wall 6.54s
run2 exit=0 | 19/293 | Duration 5.81s | wall 6.27s
run3 exit=0 | 19/293 | Duration 5.69s | wall 6.13s
run4 exit=0 | 19/293 | Duration 6.05s | wall 6.51s
run5 exit=0 | 19/293 | Duration 7.24s | wall 7.74s
```

No flake in five runs, and none across ~15 further full-suite invocations in my
copies under mutated configs, single-thread pools and `--no-file-parallelism`.

**Residual risk not testable here:** CI runs Node 20 and every Homebrew Node
keg on this machine resolves to v25.6.1, so I could not execute the pin under
Node 20. The APIs used (`process.execPath`, `spawnSync`, `createRequire`,
`node:path`, `node:fs`, `node:url`) are long-stable and vitest 2.1.9 declares
`engines: ^18.0.0 || >=20.0.0`, so the risk is low — but it is unverified, not
absent.

---

## 8. Working tree state

`web/public/data` — sha256 captured before any of my runs and again at the end:

```
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2d999c3888246a86d7369e  papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  papers-2026-W40.json
```

**Identical** (`diff` of before/after manifests is empty).

`git status --porcelain`:

```
?? .improve/reports/discovered-IMP-002.md      (not this change)
?? .improve/reports/discovered-IMP-009.md      (not this change)
?? .improve/reports/impl-IMP-028c.md
?? .improve/reports/regression-sweep-4.md      (not this change)
?? web/src/__tests__/collectWithVitest.d.mts
?? web/src/__tests__/collectWithVitest.mjs
?? web/src/__tests__/indexGuardRegistration.test.ts
```

Three new files under `web/src/__tests__/`, plus reports. The three extra
`.improve/reports/*.md` files belong to other tasks and were already present
untracked before this change; they are not part of IMP-028c and do not affect
the build or the suite. `git diff --stat HEAD` is empty. **Nothing unintended.**

---

## Summary

| Criterion | Met |
| --- | --- |
| 1. Pin reproduced independently; passes on unmodified repo; ≥1 extra narrowing | yes (7 configs) |
| 2. Mechanism: recursion, PATH, cwd, filter correctness | yes (2 minor issues) |
| 3. Backup witness genuinely independent | yes |
| 4. Not over-broad | yes, except issue 2 |
| 5. `npm run build` byte-identical | yes |
| 6. No regressions; 289 names intact | yes |
| 7. typecheck / test / build / 5× flake | yes |
| 8. `public/data` + `git status` clean | yes |

**The core claim is true and I reproduced it without relying on the
implementer's numbers.** The pin turns the silent 17-files/266-tests exit-0 into
an 18-files/270-tests exit-1, and it does not rely on `PATH`, on the caller's
cwd, or on the runner being able to execute anything it collects. Two
improvements worth making, neither blocking: add `timeout` to the `spawnSync`
options, and drop or re-message witness 4, which fails on a config under which
the guard tests demonstrably still run.