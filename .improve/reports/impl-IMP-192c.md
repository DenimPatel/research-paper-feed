# IMP-192c — Fix the save-notice race in `App.storage.test.tsx`

**Scope:** regression sweep 4, follow-up 1 of `impl-IMP-192b.md` §8.1.
**Files changed:** `web/src/__tests__/App.storage.test.tsx` — 1 hunk, 1 file.
**Branch / HEAD:** `improve/auto-20261002` @ `64ad36a`. No git write command was run, no branch
switched, no production file touched. `App.loadFailure.test.tsx` / `App.partialShard.test.tsx`
are the previous agents' and were not modified.

## VERDICT

Race closed at the one site that had it, count unchanged at 1, wait provably non-vacuous.
**The 22/22 clean shuffle battery in §4 proves nothing on its own** — the un-amplified racy
control also passes 20/20 under shuffle, so plain shuffling has *zero* detection power for
this class. The load-bearing evidence is §5: same window, same harness, same file —
**racy 5/5 FAIL, fixed 8/8 PASS**, and at whole-suite scope **racy 3/3 FAIL, fixed 3/3 PASS**.

One methodological warning for the next agent is in §6: my first measurement harness
reported false passes because it grepped for the vitest summary line. Detection must be by
exit code.

---

## 1. Root cause

`it("warns instead of letting the optimistic update pass as a real save")`, at the
pre-fix `:154-155`:

```js
expect(await screen.findByRole("heading", { name: /^Vision/ })).toBeTruthy();
const banner = saveFailedBanner();          // screen.getByRole("alert")
```

Two pieces of state, set by two different commits, and only the first one is awaited:

| Thing | State | Set by |
|---|---|---|
| the `Vision` collection card | `collections` (reducer) | `dispatch` inside the click handler |
| the `Collections could not be saved` banner | `saveFailed` | the save effect, `App.tsx:403-409`, a **passive** `useEffect` on `[collections, storageAvailable]` |

`findByRole` resolves on the first commit — the reducer's optimistic update, which is
precisely the update the test's own comment says has *already* been applied. The banner can
only mount after the passive effect runs and `setSaveFailed(true)` lands. `getByRole("alert")`
is a synchronous throw-if-absent query, so line 155 was a straight race against that later
commit. This is the same defect as IMP-192 §1 and IMP-192b §1, in the same file family: an
awaited signal that guarantees **one** of the two nodes, followed by an assertion about a
node nothing waited for.

**The defect is in the test, not the product.** `App.tsx:547-558` mounts the banner outside
the view branch, and the app produces exactly one alert in this state.

## 2. The fix — 1 hunk, 1 test

```js
     expect(await screen.findByRole("heading", { name: /^Vision/ })).toBeTruthy();
+    // The heading is the reducer's optimistic commit; the banner is a separate
+    // `saveFailed` state set by the save effect on a later passive commit, so
+    // waiting for the card says nothing about the notice. The count is the wait.
+    await waitFor(() =>
+      expect(screen.getAllByRole("alert")).toHaveLength(1),
+    );
     const banner = saveFailedBanner();
```

The expected count is **1 — exactly what the test asserted before**, since `getByRole`
throws on both 0 and >1 matches. Nothing was lowered, and the four copy/`className`
assertions after it are untouched. The shape is byte-for-byte the house pattern from
`App.loadFailure.test.tsx:648-650` and the five sites IMP-192/192b added; `waitFor` was
already used in this very file at `:172` and `:274`.

## 3. Audit of the rest of the file — 8 alert sites examined, 0 further changed

| Site (pre-fix) | Shape | Verdict |
|---|---|---|
| `:146` | `queryByRole("alert")` → `null`, before any save | **Opposite shape.** No dispatch has happened, so no notice is reachable; `waitFor` would invert the intent. |
| `:154-155` | awaits the heading, reads the alert synchronously | **RACY — fixed** (§2). |
| `:167`, `:172` | `findByRole("alert")`, then `waitFor(queryByRole → null)` | Not racy. `findByRole` is the barrier that guarantees the banner is up first, so the `null`-wait afterwards cannot pass vacuously. |
| `:183`, `:189`, `:192` | `findByRole("alert")` then `getByRole` | Not racy. The awaited element *is* the banner, and a second failed save sets `saveFailed` to the value it already holds, so the node never unmounts between the two reads. `:192`'s `toHaveLength(1)` is also a "must not accumulate" assertion — wrapping it in `waitFor` would be a strictness loss, per IMP-192 §4. |
| `:199`, `:205`, `:206` | `findByRole("alert")`, view switch, then `getByRole` | Not racy. `saveFailed` is app-level state and the view switch re-renders without re-running the save effect, so the node is still mounted when it is read. |
| `:215-216` | heading awaited, then `queryByRole → null` | **Opposite shape** (successful save; no failure state is reachable at all), same as `:237`. |
| `:267` | `findByRole("alert")` then `getByRole` | Not racy — `findByRole` already waited for the banner; the second read is a no-op check on the same node. |
| `:235`, `:248`, `:263` | `queryByRole("alert")` → `null` on a cold boot | Not racy. The mount run is gated on `unsavedChanges` (`App.tsx:404`), so with no dispatch the effect returns before it can arm anything. |

Only one site in the file had the shape. The other 7 are "must not appear" or
"already awaited" — wrapping them would weaken the file, not fix it.

## 4. Runs on the fixed file (repo, un-amplified)

| # | Phase | Command | Runs | Failures |
|---|---|---|---|---|
| 1 | fixed, whole suite, random shuffle | `npm test --sequence.shuffle` | **22** | **0** |

Per IMP-192 §7 I am explicitly **not** claiming this is decisive. See §5b: the same battery
run against the *racy* file also comes back 20/20 clean.

## 5. Sensitivity — the A/B, which is the actual proof

### 5a. Amplified A/B — the load-bearing result

Scratch project at `/tmp/rpf-storage-<variant>` (`node_modules` symlinked, `src` +
`vite.config.ts` + `tsconfig.json` copied from the repo). The only edits are to the
**copy's** `App.tsx`:

```js
-    setSaveFailed(!saveState(collections));
+    const outcome = !saveState(collections);
+    setTimeout(() => setSaveFailed(outcome), 25);      // notice settles 25ms later
```

The racy test file is restored from `HEAD` and verified byte-identical to the pre-fix
original (`diff` clean), so the race is fully reintroduced. All runs are on the affected
file unless stated.

| # | Control | Shape | Window | Runs | Result |
|---|---|---|---|---|---|
| A | **race present** | racy (HEAD) test | 25ms | **5** | **0 pass / 5 FAIL** |
| B | **race removed** | **my fixed test** | 25ms | **8** | **8/8 PASS** |
| B2 | race removed | my fixed test | 250ms | **8** | **8/8 PASS** |
| A3 | race present | racy test, **whole suite** | 25ms | **3** | **0/3, 3/3 FAIL** |
| B3 | race removed | my fixed test, **whole suite** | 25ms | **3** | **3/3 PASS** |

Control A's failure is isolated to the site under repair — 1 of 8 tests fails, the other 7
pass, so the signal is not a generic "amplification breaks the file":

```
 FAIL  src/__tests__/App.storage.test.tsx > a collections save that localStorage refuses
       > warns instead of letting the optimistic update pass as a real save
TestingLibraryElementError: Unable to find an accessible element with the role "alert"
 ❯ saveFailedBanner src/__tests__/App.storage.test.tsx:140:17
 ❯ src/__tests__/App.storage.test.tsx:155:20
      Tests  1 failed | 7 passed (8)
```

`:155` is the pre-fix racy line — the exact site in my brief. Controls A3/B3 are the
cleanest pair: **identical window, identical harness, whole suite** — the racy file loses
every time and the fixed file wins every time, and unlike IMP-192b §5b I did not need to
isolate to a single file, because the sibling fixes from IMP-192/192b now survive the
amplified window themselves.

Window sweep, to show the racy test's verdict is a function of the notice's settle time and
not of anything else (5 runs each, single file):

| Window | racy | fixed |
|---|---|---|
| 0ms (product as shipped) | **5/5 pass** | 5/5 pass |
| 25ms | **5/5 FAIL** | 8/8 pass |
| 100ms | **5/5 FAIL** | — |
| 250ms | **5/5 FAIL** | 8/8 pass |

### 5b. The honest limit: plain shuffling has no power here

The un-amplified racy control, whole suite, `--sequence.shuffle`: **20 runs, 0 failures.**
So the defect class is *latent* in the product as shipped — the passive effect lands inside
the microtask drain that RTL's `asyncWrapper` performs before `findByRole` resolves
(`node_modules/@testing-library/react/dist/pure.js:88-99`), which is why the racy assertion
usually wins by a sub-millisecond margin. The fix is not cosmetic: it removes the
dependence on that margin entirely, which is what controls A and B measure. But the 22/22
in §4 is corroboration, not proof, and should be reported as such — this is the same
conclusion IMP-192b §5a reached, now confirmed for a third file.

## 6. Non-vacuity — is the new `waitFor` strict?

An always-passing `waitFor` is a stated fail criterion, so I tested it. The banner was made
unmountable in the scratch copy only (`{saveFailed && (` → `{false && saveFailed && (`), so
it can never reach 1:

| Control | Window | Runs | Result |
|---|---|---|---|
| D | fixed test, banner unmountable | 0ms | **2/2 FAIL** at `App.storage.test.tsx:158` |
| D2 | fixed test, banner unmountable | 25ms | **2/2 FAIL** at `App.storage.test.tsx:158` |

```
TestingLibraryElementError: Unable to find role="alert"
 ❯ src/__tests__/App.storage.test.tsx:158:11
 ❯ src/__tests__/App.storage.test.tsx (8 tests | 5 failed) 5369ms
```

`:158` is the new `waitFor`, and the `5369ms` is five `waitFor` timeouts being polled to
exhaustion — the wait *polls and then fails*, it does not pass. The count was not lowered to
0 or deleted. All 5 banner-dependent tests fail, which is the correct outcome for a product
that never renders the notice.

**Methodological warning.** My first harness tallied results by grepping vitest's summary
line (`grep "Tests .*failed"`) and reported **false passes for all five controls**, including
the vacuity control. Vitest prints `      Tests  5 failed | 3 passed (8)` — the line starts
with `Tests`, so the pattern never matched and every run scored as a pass. Every number in
this report was re-measured with `if [ $? -ne 0 ]` on the **exit code**. Anyone reproducing
these controls should do the same; a grep-based tally will silently invert the result.

## 7. Required checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **exit 0**, clean |
| Tests | `npm test` | **exit 0 — 253 passed / 16 files** (baseline matched) |
| Build | `npm run build` | **exit 0 — `index.html` 1.00 kB, CSS 10.93 kB, JS 171.45 kB** |

Build output is byte-identical to IMP-192 §8 and IMP-192b §6, confirming no production file
moved.

## 8. Nothing was weakened, skipped or deleted

* `git diff` on the file is **1 hunk**: a `waitFor` wrapper plus its comment. The count is
  the `1` the test already asserted. No `.catch(() => {})`, no blanket
  `waitFor(() => {})`, no assertion removed. Grepped for `it.skip|it.only|it.todo|
  describe.skip|describe.only|.catch(() => {})|waitFor(() => {})`: **0 hits**.
* `toHaveLength` sites in the fixed file: `:159` (new, `1`) and `:198` (pre-existing `1`,
  left alone as a "must not accumulate" assertion).
* The new wait is provably non-vacuous — control D.
* **Test names diffed**, HEAD file vs fixed file: **10 vs 10, identical sets**, same order.
  Whole suite 253 vs 253.
* `git status --porcelain` shows only `M web/src/__tests__/App.storage.test.tsx` as mine
  (`.improve/PROGRESS.log` is the coordinator's; `App.loadFailure.test.tsx` and
  `App.partialShard.test.tsx` are the previous agents'; the untracked reports predate me).

## 9. Follow-ups

1. **This class is now closed at all 8 known sites** (IMP-192 ×3, IMP-192b ×2, this ×1) as
   far as the current `web/src/__tests__/` inventory goes.
2. **The detector is still the weak link.** For the second and third instance of this class
   the documented seed had no power, and plain shuffling has none either (20/20 clean on the
   racy control here). Amplified A/B is the only technique with real detection power for
   "awaited signal guarantees node A, assertion is about node B" defects; the seed in
   `.improve/reports/` should be documented as file-specific, not universal.
3. A cheap generalisable guard for future sweeps: any test that awaits one live region and
   then asserts on a count of live regions should use `waitFor` on the count by default.
4. sweep-4 regressions 2 and 3 remain the coordinator's scope.
