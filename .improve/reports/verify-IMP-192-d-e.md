# Verification — IMP-192d + IMP-192e (partial-shard flake)

**Mode:** independent, read-only. No source file was modified; no git write command
was run; `git restore`/`checkout`/`clean`/`stash` were never invoked. All
experiments that needed instrumentation ran in `/tmp` copies
(`/tmp/v192/arm-*`) with `node_modules` symlinked back to the repo. The only file
this verification wrote is this report.

**Date:** 2026-10-03
**Verdict: PASS** — 8/8 criteria met. The diagnosis reversal is correct, the global
timeout bump does not mask failures, and no assertion was weakened.

---

## 1. The diagnosis: IMP-192d is right, regression-sweep-5 is wrong

**Judged by reproduction, not by reading the reports.** Both arms were built in
`/tmp` from `HEAD`'s test file, with an identical load-window amplifier inserted at
both `fetch` sites in `src/lib/paperIndex.ts` (a 600 ms sleep after the manifest
fetch and after each shard fetch ⇒ a real ~1200 ms load window, above the 1000 ms
default and below the 3000 ms fix). The same amplifier bytes are in all three arms
(`diff arm-head/src/lib/paperIndex.ts arm-fixed/src/lib/paperIndex.ts` → identical).

Target test only (`-t "shows both as separate alerts and announces neither twice"`),
5 runs per arm:

| Arm | Test file | `test-setup.ts` | Result |
|---|---|---|---|
| **R1** | `HEAD` (default budgets) | `HEAD` (no `configure`) | **0 pass / 5 FAIL** |
| **R2** | `HEAD` + sweep-5's `{ timeout: 3000 }` on that `waitFor`, **verbatim** | `HEAD` | **0 pass / 5 FAIL** |
| **F** | this fix (`LOAD = { timeout: 3000 }`) | this fix | **5 pass / 0 FAIL** |

**The stack frame settles it.** R1 and R2 both fail at the *same* line, named by
vitest's own frame chain:

```
❯ waitForWrapper  node_modules/@testing-library/dom/dist/wait-for.js:163:27
❯                 node_modules/@testing-library/dom/dist/query-helpers.js:86:33
❯ src/__tests__/App.partialShard.test.tsx:410:18
    408|
    409|     render(<App />);
    410|     await screen.findByText(W09.title);
       |                  ^
```

`query-helpers.js` is the `findBy*` path; line **410** is the first data-load
await after `render`, column 18 is `screen`. The `waitFor` R2 widened is at
**420–422** and is never reached. R2 is the headline: **the sweep's proposed fix,
applied verbatim, is inert** — it buys 2000 ms for a poll that never runs.

**Why the sweep got it wrong.** Sweep-5 §R-1 never had a stack frame. It inferred
the site from the test's *total* elapsed time (3251 ms) — explicitly "i.e. the
`waitFor` … did not settle". That inference is ambiguous: TL's budget is a
`setTimeout(handleTimeout, 1000)` that fires *late* on a starved event loop, so a
`:410` `findByText` timeout can also land near 3 s. Elapsed time cannot separate
the two candidates; only a stack frame can. (Sweep-5 also cited `:415-419` for the
`waitFor`; in `HEAD` it is at 420–422.)

**Sweep-5's secondary claim is also false.** It asserted the two live regions
"mount on independent ticks". `App.tsx:261-267` calls `setPapers(list)` and
`setFailedShards(list.failedFiles)` from the *same* `.then` callback, so React 18's
automatic batching commits them together — the paper appearing and the notice
unmounting are one render. Verified in source at `web/src/App.tsx:259-270`. The
storage notice is also rendered outside the view branch (`App.tsx:567`), so a
search re-render cannot unmount it. Both premises the removed `waitFor`s were
built on are incorrect — which is why replacing them with direct assertions is
correct, not a loosening.

---

## 2. `asyncUtilTimeout: 3000` — does it mask real failures? **No.**

### 2a. Version support — verified by introspection, not by the report

| Question | Measured |
|---|---|
| `@testing-library/dom` installed | **10.4.2** (`web/node_modules/@testing-library/dom/package.json`) |
| `@testing-library/react` installed | **16.3.3** |
| `vitest` installed | **2.1.9** |
| `configure` is a function | yes |
| Copies of `@testing-library/dom` | **exactly one** — so RTL's wrapper and RTL's own `findBy*`/`waitFor` share one config singleton |
| Delta form supported | yes — `node_modules/@testing-library/react/dist/config.js:18-33` destructures `reactStrictMode` and forwards the rest to dom's `configure` |

**Proven live from inside the real suite** (probe run in a `/tmp` copy, reading the
config back through RTL's own `getConfig`):

```
PROBE asyncUtilTimeout=1000 reactStrictMode=false   (arm-1k, no configure)
PROBE asyncUtilTimeout=3000 reactStrictMode=false   (arm-fixed, this change)
PROBE asyncUtilTimeout=6000 reactStrictMode=false   (arm-6k, probe only)
```

`reactStrictMode` is preserved by the delta form, and `asyncUtilTimeout` is a live
key — the timing behaviour below confirms it is read on every wait, not ignored.

### 2b. A wait on something that NEVER renders still fails — measured

Probe: render `<div>Only this renders</div>`, then
`await screen.findByText("This Text Never Appears Anywhere")`. **No per-test
timeout override**, so vitest's stock `testTimeout` applies.

| Budget | Outcome | Elapsed | Error surfaced |
|---|---|---|---|
| 1000 ms (old default) | **FAILS** | **1074 ms** | `TestingLibraryElementError: Unable to find an element with the text: This Text Never Appears Anywhere…` |
| **3000 ms (this change)** | **FAILS** | **3078 ms** | **the same `TestingLibraryElementError`** — not swallowed, not swallowed by a bare `waitFor` body |
| 6000 ms (> `testTimeout`) | **FAILS** | **5077 ms** | `Error: Test timed out in 5000ms.` — **the TL diagnostic is gone** |

(The implementer claimed 3015 ms; I measured 3078 ms with the 25-run shuffle batch
loading the machine concurrently. Same conclusion, ~2 % apart.)

### 2c. The `3000 < testTimeout` relationship — verified, and load-bearing

`web/vite.config.ts` `test: {}` sets only `environment`, `include`, `setupFiles`.
**No `testTimeout`, no `hookTimeout`** ⇒ vitest's 5000 ms default, confirmed
empirically by the 6000 ms arm being killed at exactly 5077 ms with
`Test timed out in 5000ms`.

The relationship is real and the value is on the right side of it:

- `asyncUtilTimeout < testTimeout` ⇒ TL rejects first ⇒ you get
  `TestingLibraryElementError: Unable to find an element with the text: …` naming
  the element, the matcher, and the source line.
- `asyncUtilTimeout > testTimeout` ⇒ vitest kills the test first ⇒ you get
  `Error: Test timed out in 5000ms`, which names no element, no matcher, and no
  assertion. Demonstrated, not hypothesised (the 6000 ms row above).

**Bounded caveat (not a blocker).** 3000 leaves 2000 ms of headroom. Pushing the
load window past the budget — 1600 ms per fetch ⇒ ~3200 ms load — 39 tests fail and
**5 of them surface the generic `Test timed out in 5000ms` instead of the TL
diagnostic**: the three-retry tests, `PaperIndex > recovers via refreshManifest
after every manifest failure mode`, and `PaperIndex > rejects every body that is
not a plain object, as malformed`. All five are *multi-wait* tests whose cumulative
time crosses 5000 ms, not single-wait tests. The remaining 34 still surface the TL
diagnostic at 3003–3019 ms, i.e. exactly the budget. So the bump does narrow the
margin in which a good diagnostic is available — but only in a regime where the
test is already red and 3× slower than the old budget. The unamplified suite's
waits are orders of magnitude below 3000 ms (25/25 shuffle runs and the plain run
are clean, total wall 17.8 s). **If a future test genuinely needs >3 s of waiting,
raise `testTimeout` in `vite.config.ts` in the same change — do not raise
`asyncUtilTimeout` past 5000 alone.**

---

## 3. No assertion was weakened

Read line by line against `HEAD`, plus two amplifiers that try to break it.

**Static checks.**

| Check | Result |
|---|---|
| Test count in the file | **9 before, 9 after** |
| Test names | **byte-identical to `HEAD`, same order** (`diff` of the `it(` lines is empty) |
| `it.skip` / `it.only` / `describe.only` introduced | none |
| `.catch(() => {})` or any swallow | **none** (`grep -n "catch" App.partialShard.test.tsx` → no match) |
| Blanket timeout on a whole test | none — `{ timeout: 3000 }` is passed per *query*, never per *test* |
| `waitFor` bodies that became trivially true | none — all three removed bodies (`count===2`, `count===2`, `alert gone`) are now asserted directly; two are preceded by a **strictly stronger** named await |
| `waitFor` import | dropped (no unused import; typecheck exit 0) |

**Every alert count and node-identity check is preserved verbatim:**

| Site (`HEAD` → now) | Assertion |
|---|---|
| `:303` → `:303` | `expect(screen.getAllByRole("alert")).toHaveLength(1)` — unchanged |
| `:397` → `:397` | `expect(screen.getAllByRole("alert")).toHaveLength(1)` — unchanged |
| `:420-422` → `:453-456` | `waitFor(count === 2)` ⇒ `await findText("Collections could not be saved.")` **then** `expect(alerts).toHaveLength(2)` — count still asserted, unchanged value |
| `:439-441` → `:477` | `waitFor(count === 2)` ⇒ `expect(screen.getAllByRole("alert")).toHaveLength(2)` — unchanged value |
| `:335-337` → `:366` | `waitFor(alert gone)` ⇒ `expect(screen.queryByRole("alert")).toBeNull()` — unchanged value |
| `:341` → `:341` | `toHaveLength(1)` — unchanged |
| `:337`/`:339`/`:478`/`:479` | `toBe(first)`, `toBe(shardNotice)`, `toContain(storageNotice)` — all unchanged |

The only *difference* in strictness is an improvement: when a notice is missing the
test now names which one (`:451 Unable to find … Collections could not be saved.`)
instead of reporting `got 1` after burning a second.

**Empirical — two amplifiers against the fixed file, each in its own `/tmp` copy.
Both isolate to exactly 1 of 9 tests; the other 8 pass:**

| Amplifier | Result | Where it failed |
|---|---|---|
| **B** — `FullStorage.setItem` no longer throws, so IMP-011's notice never mounts | **FAIL (correct)** | `:451` — `Unable to find an element with the text: Collections could not be saved.` (test 3118 ms = ~118 ms setup + the 3000 ms budget). The new precondition await is **not vacuously true**. |
| **C** — a third `role="alert"` injected into `document.body` | **FAIL (correct)** | `:482` — `expected [ <p …(2)>…(1)</p>, …(2) ] to have a length of 2 but got 3` (58 ms). The count assertion **still rejects 3**. |

---

## 4. Independent sensitivity — harness validated first

Prior verification established that plain shuffling has **zero** detection power
for this class. I reproduced that before claiming anything about clean runs.

**Control (no amplifier), 3 runs per arm:** R1 3/3 pass, R2 3/3 pass, F 3/3 pass.
So an unamplified pass is worthless as evidence here, exactly as reported. I
therefore validated the amplifier before using it: at a ~1200 ms load window the
same harness fails R1 5/5 and R2 5/5 and passes F 5/5. **The harness detects the
bug; it is not a blanket breaker** (in the targeted arms exactly 1 of 9 tests
fails, the other 8 pass).

**Whole-suite 3-point decomposition** at the same ~1200 ms load window, one run each
— this also isolates the *global* bump from the *per-file* change:

| Arm | Test file | Global budget | Result |
|---|---|---|---|
| **HEAD** | HEAD | 1000 ms default | **38 failed / 228 passed** |
| **budget only** | HEAD | 3000 ms (`test-setup.ts` only) | **3 failed / 263 passed** |
| **both fixes** | fixed | 3000 ms | **3 failed / 263 passed** |

- The **global `asyncUtilTimeout: 3000` alone removes 35 of the 38** failures. That
  is the load-bearing change, and it reaches all 105 async wait sites
  (91 bare `await screen.findBy*` + 10 `waitFor` + the rest) rather than the 11 in
  one file. It is the better fix, exactly as IMP-192d recommended in §5 of its report.
- The per-file `LOAD` constant is now **redundant** with the global bump — it adds
  0 on top. Harmless, and the more local and more explicit of the two. Not a defect.
- The residual **3 are identical in both fixed arms** and are amplifier artifacts,
  not regressions and not budget exhaustion: two assert state *during* flight
  (`keeps the deep link working while the index is still in flight`, 14 ms; `an
  index file whose body is JSON null`, 613 ms — the latter well under even the old
  1000 ms budget), and one is bounded by vitest's own 5000 ms `testTimeout`
  (`PaperIndex > recovers via refreshManifest after every manifest failure mode`,
  5006 ms — it also fails at `HEAD`, at 5003 ms).
- 39 of 38 differ only because the targeted file's 9 tests overlap the whole suite;
  the counts are whole-suite totals, consistent across the two fixed arms.

**Stated plainly:** 25/25 shuffle runs and the plain run are a real number and, on
their own, a weak argument. The evidence that this change works is the amplified
A/B above, and I validated that harness against the known-racy `HEAD` first.

---

## 5. Suite intact

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **exit 0** |
| Plain test | `npm test` | **266 passed / 17 files**; `Duration 16.50s` (wall `real 17.80s`) — inflated because the 25-run batch was executing concurrently; the implementers recorded 7.95 s and 8.71 s on an idle machine |
| Build | `npm run build` | **exit 0** — 41 modules, `css 10.93 kB`, `js 172.50 kB` — byte-identical sizes to both implementers' reports and to sweep-5 |
| Shuffle | `npm test --sequence.shuffle` × **25** | **25/25 pass**, every run `266 passed / 17 files` |

(Method note: my first runner reported 0/25 because its detector grepped for the
substring `failed`, which matches the test name *"still surfaces an error when every
shard in the window **fails**"*. Vitest's own summary in all 25 runs reads
`Tests 266 passed (266)`. The detector was corrected to `^ *Tests +[0-9]+ failed`
before the A/B work. Flagging it because the raw log of that job is misleading.)

---

## 6. Scope discipline — clean

```
$ git status --porcelain
 M web/src/__tests__/App.partialShard.test.tsx
 M web/src/test-setup.ts
?? .improve/reports/{discovered-IMP-002,discovered-IMP-009,impl-IMP-192d,impl-IMP-192e,regression-sweep-4,regression-sweep-5}.md

$ git diff --stat
 web/src/__tests__/App.partialShard.test.tsx | 88 ++++++++++++++++++++---------
 web/src/test-setup.ts                       | 21 ++++++-
 2 files changed, 81 insertions(+), 28 deletions(-)
```

- Exactly **two** tracked files modified. Nothing staged.
- **No production code** (`git diff --name-only | grep -v __tests__|test-setup` → empty).
- **No Python, no docs, no workflows** (`.py`/`.md`/`.yml` → empty).
- All untracked paths are under `.improve/reports/`. **Nothing untracked outside it.**
- `.kilo/worktrees/mildly-income` was neither read nor modified.

## 7. `scripts/build_index.py` recovered and intact

- **Present, 529 lines** — `wc -l scripts/build_index.py` → `529`.
- `git diff --quiet HEAD -- scripts/build_index.py` → clean (identical to `HEAD`).
- `git status --porcelain` shows **no deleted (`D`) and no unexpected modified**
  tracked file anywhere in the repo — the only tracked modifications are the two
  intended test files.

## 8. Python suite

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 104 tests in 1.288s
OK
```

**104 OK**, as expected. Unaffected by the change; confirms the repo is whole.

---

## Issues (all cosmetic or bounded; none blocking)

1. **Headroom narrowing (bounded).** 3000 ms leaves 2000 ms under vitest's 5000 ms
   `testTimeout`. A *multi-wait* test whose cumulative time crosses 5000 ms loses
   the TL diagnostic and gets `Test timed out in 5000ms`. Measured: 5 of 39
   failures at a ~3200 ms load window. Unreachable in the unamplified suite. Action
   if it ever bites: raise `testTimeout` in `vite.config.ts` alongside, never
   `asyncUtilTimeout` alone.
2. **`test-setup.ts` has no trailing newline** on its last line. Pre-existing on the
   original `afterEach(cleanup);` line and preserved on the new one — cosmetic, but
   a one-character fix whenever that file is next touched.
3. **Wrapper stack frames.** `findText`/`findAlert` mean a future failure in
   `App.partialShard.test.tsx` points at the wrapper (`:65`) rather than the call
   site. Marginally worse locality than the inline `screen.findByText(...)` it
   replaced. Cosmetic; the TL message still names the element and matcher.
4. **Redundancy.** `LOAD = { timeout: 3000 }` in the test file duplicates the global
   `asyncUtilTimeout: 3000`. Two sources of truth for one budget. Defensible as the
   more local and explicit of the two, but it is a value that must be kept in step
   with `test-setup.ts` if either is ever retuned.
5. **Process note, no repo impact.** `impl-IMP-192e.md` §7 discloses that a probe
   test was briefly written to `web/src/__probeConfig.test.tsx` and then removed.
   I confirmed no such file exists and no untracked file sits outside
   `.improve/reports/`. Worth surfacing because it is exactly the class of action
   that previously destroyed a committed source file in this project — the
   discipline held, but the probe did not belong in the repo even briefly.

## Recommended follow-up (not blocking, out of scope for this change)

- Retire or document the remaining 10 `waitFor` calls in
  `App.loadFailure.test.tsx` and `App.storage.test.tsx`; two of them
  (`App.loadFailure.test.tsx:648`, `:919`) are genuine, not redundant polls.
- `git add`/`commit` is **not** done here — no git write command was run.
