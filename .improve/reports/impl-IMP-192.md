# IMP-192 — Fix the unknown-category banner race in `App.loadFailure.test.tsx`

**Scope:** regression sweep 4, regression 1 (order-dependent flake).
**Files changed:** `web/src/__tests__/App.loadFailure.test.tsx` — 3 hunks, one file.
**Branch / HEAD:** `improve/auto-20261002` @ `64ad36a`. No git write command was run, no
branch was switched, and `.improve/PROGRESS.log` was not touched (it shows as modified in
`git status` because the coordinator is handling it).

## VERDICT

Flake eliminated, and the harness is proven to be capable of detecting it. 42/42 clean runs
on the fixed file; 12/12 failures on a byte-identical racy control at the deterministic seed.
One assertion was still strict (proven by mutation), and no test was weakened, skipped or
deleted.

**One same-shape defect is left unfixed in another file**, because my instructions restricted
me to `App.loadFailure.test.tsx`. It needs a follow-up item — see §5.

---

## 1. Root cause

Both racy tests live in `describe("the load failure alongside the other notices")` and both
assert that **two** `role="alert"` live regions coexist. The two alerts are produced by
**independent effects that settle independently**:

| Alert | Set by |
|---|---|
| load-failure panel (`Papers could not be loaded`) | the papers-load effect rejecting |
| storage banner (`Collections could not be saved`) | the save effect, armed by a reader-caused save |
| unknown-category banner (`Unknown category: cs.BI`) | `resolveCategories` dropping `cs.BI` once the manifest resolves |

The original shape was:

```js
await screen.findByRole("alert");                      // resolves on the FIRST match
expect(screen.getAllByRole("alert")).toHaveLength(2);   // asserts a count nothing waited for
```

`findByRole` resolves as soon as **one** alert exists. It carries no information about the
second, which is still mounting. The count assertion is therefore a race against that
arrival, and it loses whenever the second effect resolves a tick later than the first — which
is order- and timing-dependent, hence strictly order-dependent flakiness (sweep-4: 3 of 18
whole-suite shuffled runs, and never when the file runs alone, because another file's load
changes when the second effect settles).

**The defect is in the test, not the product.** The app is correct in both states: exactly two
alerts, two genuinely distinct facts, correct copy in each. sweep-4 §7 confirms this in a real
browser ("Save failure + unknown category → 2 alerts → two genuinely distinct facts"). The
test was simply observing a settled state without waiting for it.

Attribution per sweep-4 §2: commit `166066d` (IMP-016) introduced every racy line, and the
identical fix was already recommended at `.improve/reports/verify-IMP-019.md:566` and recorded
as out of scope. It never landed.

## 2. What I fixed — 3 sites, 2 tests

All three in `web/src/__tests__/App.loadFailure.test.tsx`:

| Site (pre-fix) | Test | What it asserted |
|---|---|---|
| `:882` | `coexists with the save-failure banner as two distinct alerts` | 2 alerts after `await saveSomething()` |
| `:894` | same test | 2 alerts again, after a search `change` re-render |
| `:906` | `coexists with the unknown-category banner as two distinct alerts` | **the reported flake** — 2 alerts after awaiting only the first |

The diff is 3 hunks and is mechanically identical in each — the wait is added, the count is
not touched:

```js
-    expect(screen.getAllByRole("alert")).toHaveLength(2);
+    await waitFor(() =>
+      expect(screen.getAllByRole("alert")).toHaveLength(2),
+    );
```

At `:906` the now-redundant `await screen.findByRole("alert")` was replaced rather than kept,
since `waitFor` on a count of 2 strictly subsumes it. At `:882` the preceding
`await screen.findByRole("alert")` was **kept**: it doubles as the mount barrier that
`saveSomething()` needs before it can click the `/^Collections/` button.

Post-fix the three assertions are at `:886`, `:903` and `:920`, each still literally
`toHaveLength(2)`.

## 3. The house pattern

`waitFor` is already the idiom **of this very file** — written by the same commit, IMP-016.
`App.loadFailure.test.tsx:648-650`, immediately before the block I edited:

```js
    // Still unreadable, so the panel comes back rather than the app hanging a
    // second time.
    await waitFor(() =>
      expect(screen.getAllByRole("alert")).toHaveLength(1),
    );
```

That is byte-for-byte the shape I used, including the multi-line wrapping the file prefers.
Full inventory of the pre-existing house style:

* `App.loadFailure.test.tsx` — `:359`, `:612-614`, `:644`, `:648-650` (5 sites, including the
  `toHaveLength(1)` form above).
* `App.storage.test.tsx` — `:172`, `:274`.
* `App.partialShard.test.tsx` — `:335-337`.

On the two files named in my brief: `App.retry.test.tsx` and `App.categories.test.tsx` contain
**no** `waitFor` at all. Their established pattern is the async-query equivalent — await the
thing you are about to assert on, then assert (`await screen.findByRole("alert")` at
`App.categories.test.tsx:270`, `:288`; `renderUnavailableFeed()` at `App.retry.test.tsx:90-94`).
That pattern is only expressible when a *specific* element is the subject. For a **count**, no
`findBy*` variant can express "wait for exactly 2" — `findAllByRole` resolves at one, which is
the bug. So the count-aware equivalent of the house pattern is `waitFor`, and the file that
owns these tests already used it. I matched the existing form rather than inventing one.

## 4. Every candidate examined, and why it was or wasn't changed

I audited all 42 `toHaveLength` / alert-query sites in `web/src/__tests__/`.

**Racy (fixed):** the 3 sites in §2.

**Deliberately NOT changed — these are the opposite shape, and `waitFor` would *weaken* them.**
`App.loadFailure.test.tsx:440`, `:456`, `:470`, `:708`, `App.storage.test.tsx:192`,
`App.categories.test.tsx:277`, `:371`. All are "must not accumulate" assertions: the awaited
element **is** the alert under test, and the count is 1 (or the `queryBy*` control list is
exactly 1) to prove no *extra* node appeared. `waitFor` polls until the expectation holds, so
it returns immediately on the current value — wrapping these would let a second alert mounting
one tick later go undetected. That is a strictness loss, not a fix. Left alone.

**Not racy:**
* `errorBoundary.test.tsx:196` — fully synchronous `render`, no async anywhere in the test.
* `App.loadFailure.test.tsx:202` and `:791` — those are the `failurePanel()` / `partialNotice()`
  *helper filters* (`getAllByRole("alert").filter(...)`), not count assertions. Both helpers
  already throw if their count is not exactly 1, which is strict.
* `App.loadFailure.test.tsx:266` — `querySelectorAll("article.paper")).toHaveLength(0)`. Same
  "must not be" direction; noted, not changed, and not a flake source.
* All `toHaveLength` sites in `domEnvironment.test.tsx`, `malformedImport.test.tsx`,
  `paperCardNullUrls.test.tsx`, `errorBoundary.test.tsx:155` — synchronous DOM assertions,
  no alert counting.

## 5. Same-shape defect left unfixed — `App.partialShard.test.tsx` (needs a follow-up)

`App.partialShard.test.tsx:405-435`, `it("shows both as separate alerts and announces neither
twice")` has the **identical race**:

```js
await screen.findByText(W09.title);          // :410  — awaits a paper title, not the alerts
await saveSomething();                       // :413  — arms the storage banner
const alerts = screen.getAllByRole("alert"); // :415
expect(alerts).toHaveLength(2);              // :416  — nothing waited for the 2nd alert
...
expect(screen.getAllByRole("alert")).toHaveLength(2);  // :432  — re-assert after re-render
```

The storage banner is armed by a save effect and the partial-shard notice by the load effect,
so the same independent-settling argument applies. The correct fix is the same two
`waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2))` wrappers at `:416` and
`:432`. **I did not apply it** — my instructions permit modifying only
`App.loadFailure.test.tsx` and my own reports. It is out of scope, not out of minds.

## 6. Verification — the flake is gone

All runs: `cd web && npx vitest run …`, full 16-file suite unless stated.

| # | Phase | Command | Runs | **Failures** |
|---|---|---|---|---|
| 1 | fixed, deterministic failing seed | `--sequence.shuffle --sequence.seed=1790961487276` | **12** | **0** |
| 2 | fixed, whole-suite random shuffle | `--sequence.shuffle` | **20** | **0** |
| 3 | fixed, the one file alone, shuffled | `--sequence.shuffle src/__tests__/App.loadFailure.test.tsx` | **10** | **0** |
| 4 | **control**, racy, failing seed | `--sequence.shuffle --sequence.seed=1790961487276` | **12** | **12** |
| 5 | **control**, racy, random shuffle | `--sequence.shuffle` | **20** | **1** |
| 6 | **control**, fixed + mutation | seed, file alone | 1 | **1 (expected)** |

**Fixed: 42 runs, 42 clean, 0 failures.** Controls: 33 runs, 13 failures.

## 7. Sensitivity — the harness CAN detect this bug

This is the part that decides whether §6 means anything, so I did it properly.

**Control setup.** A scratch copy of the whole `web` project under `/tmp/rpf-flake/web`
(`node_modules` symlinked, `vite.config.ts` and `src/` copied, so imports and the vitest
include glob resolve exactly as in the repo). The racy test file was reconstructed there by
reverting all three sites to the original shape, then **verified byte-identical to the
pre-fix original**:

```
git show HEAD:web/src/__tests__/App.loadFailure.test.tsx > original-from-HEAD.tsx
diff original-from-HEAD.tsx /tmp/rpf-flake/web/src/__tests__/App.loadFailure.test.tsx
IDENTICAL: scratch == HEAD original (race fully reintroduced)
```

**Control 4 — the strong one.** With the race reintroduced, the deterministic seed fails
**12 of 12**, with the exact signature sweep-4 recorded:

```
 FAIL  src/__tests__/App.loadFailure.test.tsx > the load failure alongside the other
       notices > coexists with the unknown-category banner as two distinct alerts
AssertionError: expected [ <p …(2)>…(2)</p> ] to have a length of 2 but got 1
 ❯ src/__tests__/App.loadFailure.test.tsx:906:42
```

The harness therefore detects the bug **deterministically and at 100%** on the known seed. The
12 clean seed runs on the fixed file are decisive: same seed, same order, same timing, bug
gone.

**Control 5 — and here I want to be loud about a limit.** The *random* shuffle only detected
the bug **1/20 (5%)** on the racy copy, consistent with sweep-4's 3/18 (~17%). That means the
20/20 clean random-shuffle result in phase 2 is **real but not conclusive on its own**: if the
bug were still present at that 5% per-run detection rate, the probability of 20 clean runs
anyway is 0.95²⁰ ≈ **36%**. I am not claiming phase 2 proves anything by itself. The case rests
on the phase-1/control-4 pairing, where the control fails 100% of the time and the fix passes
100% of the time. Phase 2 is corroboration, and it also independently shows the fix did not
merely paper over one seed.

**Control 6 — is the new `waitFor` strict, or does it always pass?** A blanket always-passing
`waitFor` is an explicit fail criterion, so I tested it. I took the **fixed** file and mutated
it so the second alert can never mount: the deep link was repointed from `#cat=cs.BI` (a
category the index lacks → banner appears) to `#cat=cs.CV` (indexed → banner never appears),
while the test still expects 2 alerts. Result:

```
AssertionError: expected [ <div …(2)>…(3)</div> ] to have a length of 2 but got 1
 ❯ src/__tests__/App.loadFailure.test.tsx:920:44
 ❯ src/__tests__/App.loadFailure.test.tsx (26 tests | 1 failed) 1500ms
```

The `1500ms` is the `waitFor` timeout: it polled and then failed. So the new wait still
catches a genuinely missing second alert. It is not vacuous, and the `2` was not lowered.

## 8. Required checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **exit 0**, clean |
| Tests | `npm test` | **exit 0 — 253 passed / 16 files** (baseline matched) |
| Build | `npm run build` | **exit 0** — `index.html` 1.00 kB, CSS 10.93 kB, JS 171.45 kB |

Build output is byte-identical to sweep-4's figures, confirming no production file moved.

## 9. Nothing was weakened, skipped or deleted

* `git diff` on the file is **3 hunks**, all the same mechanical change (add `await waitFor(`
  around an untouched `expect(...).toHaveLength(2)`). No count lowered to 1. No `.catch(() =>
  {})`. No assertion removed. No `it.skip` / `it.only` / `it.todo` anywhere in the file
  (grepped: zero hits).
* All three `toHaveLength(2)` assertions survive verbatim at `:886`, `:903`, `:920`.
* The new waits are provably non-vacuous — control 6 in §7.
* **Test names diffed** between the HEAD file and the fixed file, both full suites:
  **253 vs 253, identical sets** — nothing added, removed, or renamed.
* `git status --porcelain` shows only `M web/src/__tests__/App.loadFailure.test.tsx` as my
  change (plus `.improve/PROGRESS.log`, the coordinator's, and three pre-existing untracked
  sweep reports).

## 10. Follow-ups

1. **`App.partialShard.test.tsx:416` and `:432`** — same defect, same fix, outside my scope.
   The most likely next flake after this one, and the only remaining instance of this class in
   the suite.
2. `.improve/PROGRESS.log` regressions 2 and 3 from sweep-4 are untouched here (coordinator's
   scope).
