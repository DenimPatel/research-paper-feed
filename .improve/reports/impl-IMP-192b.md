# IMP-192b — Fix the two-alert count race in `App.partialShard.test.tsx`

**Scope:** follow-up to IMP-192 §5 / §10.1 ("the same defect, outside my scope").
**Files changed:** `web/src/__tests__/App.partialShard.test.tsx` — 2 hunks, 1 file.
**Branch / HEAD:** `improve/auto-20261002` @ `64ad36a`. No git write command was run, no branch
switched, `.improve/PROGRESS.log` untouched, `App.loadFailure.test.tsx` untouched.

## VERDICT

Flake fixed at both named sites, both `toHaveLength(2)` counts preserved. **But the premise
I was given is wrong and I have to say so up front: the seed `1790961487276` has no power
over this defect.** The racy original passed that seed 12/12, and 40 further distinct seeds
and 30 instrumented runs never once caught it. So the 40/40 clean run battery below does
**not** by itself prove the fix. What proves it is the amplified A/B in §5: same window,
racy 5/5 fail, fixed 8/8 pass. A same-shape third instance was found in a file I may not
touch — see §7.

---

## 1. Root cause

`it("shows both as separate alerts and announces neither twice")`. The two `role="alert"`
nodes come from **two different React states, set by two different effects**, and the test
awaits neither:

| Alert | State | Set by |
|---|---|---|
| shard notice (`Some papers could not be loaded`) | `failedShards` | the papers-load effect, `App.tsx:264` |
| storage notice (`Collections could not be saved`) | `saveFailed` | the save effect, `App.tsx:403-409` |

The pre-fix shape at `:415-416`:

```js
const alerts = screen.getAllByRole("alert");
expect(alerts).toHaveLength(2);
```

Nothing before it waited for either notice. `saveSomething()` (`:214-223`) awaits the
`/^Vision/` heading, clicks back to the feed, and awaits `findByText(W09.title)` — a paper
title, which is not a notice. Worse, the title is the **wrong** thing to await even in
principle: `setPapers(list)` and `setFailedShards(list.failedFiles)` are adjacent statements
in one `.then` (`App.tsx:259-264`), so the W09 title and the shard notice land in a **single**
commit. The awaited signal therefore guarantees *one* of the two alerts and says nothing at
all about the storage notice, whose `setSaveFailed` is dispatched from a passive
`useEffect` on `[collections, storageAvailable]` — i.e. after the paint of the render that
produced the Vision heading. The count assertion at `:416` is a straight race against that
later commit.

At `:432` the same `toHaveLength(2)` is re-asserted after a `fireEvent.change` re-render.
Once `:416` is a `waitFor`, both nodes are mounted and the change is synchronous, so `:432`
is not *independently* racy — but I wrapped it to match the sibling's treatment of the
identical "re-assert after re-render" site (`App.loadFailure.test.tsx:894`) and to keep the
two count assertions symmetric. It cannot mask anything: line `:441` then re-asserts node
identity.

**The defect is in the test, not the product.** `App.tsx:547-556` mounts the storage notice
outside the view branch precisely so the two can coexist, and the app produces exactly two
distinct live regions.

## 2. The fix — 2 hunks, 1 test

`git diff` is mechanical at both sites: add `await waitFor(`, keep the `2`.

```js
-    expect(alerts).toHaveLength(2);
+    await waitFor(() =>
+      expect(screen.getAllByRole("alert")).toHaveLength(2),
+    );
+    const alerts = screen.getAllByRole("alert");
```

```js
-    expect(screen.getAllByRole("alert")).toHaveLength(2);
+    await waitFor(() =>
+      expect(screen.getAllByRole("alert")).toHaveLength(2),
+    );
```

Post-fix the two assertions sit at `:420-422` and `:439-441`, each still literally
`toHaveLength(2)`. This is byte-for-byte the house pattern — the multi-line wrap matches
`App.loadFailure.test.tsx:648-650` and the three sites IMP-192 added, and `waitFor` was
already used in **this** file at `:335-337`.

## 3. Audit of the rest of the file — 5 sites examined, 0 changed

All alert-count sites in `App.partialShard.test.tsx`:

| Site | Asserts | Verdict |
|---|---|---|
| `:272` | `queryByRole("alert")` → `null` | **Opposite shape.** "Must not appear *yet*." Shards are gated behind `release()`, so an alert is impossible before the call — deterministic, and `waitFor` would invert the intent. |
| `:277` | `toHaveLength(1)` | Not racy: papers + `failedShards` share one commit (`App.tsx:259-264`), so the awaited title already implies the notice. Also "must not accumulate" — `waitFor` returns on the current value and would let a late extra alert through. |
| `:315` | `toHaveLength(1)` | Same two reasons; the two `fireEvent.change` calls re-render without re-running the load. |
| `:349` | `queryByRole("alert")` → `null` | Clean load — no failure state is reachable, so nothing can mount late. |
| `:368` | `toHaveLength(1)` | Not racy: on rejection `setFailedShards([])` and `setError(...)` are adjacent (`App.tsx:273-275`), so the panel mounts in one commit and the partial notice never does. "Must not be 2" — `waitFor` would weaken. |

`partialNotice()` (`:192-204`) and `saveFailedBanner()`'s counterpart are *helper filters*
that throw unless exactly one match — already strict, not count assertions.

This is the same reasoning IMP-192 §4 used, and the 4 "must not accumulate" sites are left
alone for the same reason: wrapping them is a strictness loss, not a fix.

## 4. Runs on the fixed file — 40/40, but read §5 before believing it

All from `web/`, `npx vitest run`.

| # | Phase | Command | Runs | Failures |
|---|---|---|---|---|
| 1 | fixed, whole suite, random shuffle | `--sequence.shuffle` | **20** | **0** |
| 2 | fixed, whole suite, the brief's seed | `--sequence.shuffle --sequence.seed=1790961487276` | **10** | **0** |
| 3 | fixed, single file alone, shuffled | `--sequence.shuffle src/__tests__/App.partialShard.test.tsx` | **10** | **0** |

## 5. Sensitivity — the honest version, in two parts

### 5a. The prescribed check FAILED to detect anything

Control setup: scratch project at `/tmp/rpf-shard` (`node_modules` symlinked, `vite.config.ts`
+ `src/` copied). The racy file was restored from HEAD and verified byte-identical to the
pre-fix original:

```
git show HEAD:web/src/__tests__/App.partialShard.test.tsx | diff - /tmp/rpf-shard/src/__tests__/App.partialShard.test.tsx
IDENTICAL: scratch == HEAD original (race fully reintroduced)
```

| # | Control | Runs | Failures |
|---|---|---|---|
| 1 | racy, the brief's seed `1790961487276`, whole suite | 12 | **0** |
| 2 | racy, 40 distinct seeds (101…4040), whole suite | 40 | **0** |
| 3 | racy, random shuffle, **instrumented** to log the count at the assertion point | 30 | 0 observed a count of 1; **30/30 observed 2** |

**82 runs, 0 failures.** The instrumented probe in row 3 is the useful one: it reads the
count the racy assertion actually saw, so this is not "the flake is rare" — the race window
was never once taken in this environment. The brief's advice to "weight seed runs most
heavily" is correct for IMP-192's defect and **wrong for this one**: that seed was found
against `App.loadFailure.test.tsx` and does not transfer. If I had stopped at 40/40 clean
plus a control that never fails, I would be reporting a fix I cannot distinguish from no
fix at all.

### 5b. What does have power: an amplified A/B, same harness, same site

In the scratch copy only, I widened the window the race lives in — `App.tsx:409` became
`setTimeout(() => setSaveFailed(outcome), 25)`, so the storage notice's state settles one
macrotask after the assertion point instead of usually landing first. Same seed, same
harness, same line.

| # | Control | Shape | Runs | Result |
|---|---|---|---|---|
| B | race present | racy (HEAD) file + widened window | **5** whole suite / **5** single file | **5/5 FAIL**, signature exact: `expected [ <p …(4)>…(4)</p> ] to have a length of 2 but got 1` at `App.partialShard.test.tsx:416` |
| C | race removed | **my fixed file** + the *identical* widened window | **8** single file | **8/8 PASS** |
| D | non-vacuity | fixed file + storage notice made unmountable (`{false && saveFailed && (`) | **2** | **2/2 FAIL** at `:421`, `1320ms` |

Control C is run **single-file** deliberately: run whole-suite, control C fails too — but
not on my test. The widened window breaks `App.storage.test.tsx:155`, a genuine third
instance of this defect class. Isolating to my file removes that confound. (See §7.)

Control B vs C is the decisive pair: same seed, same order, same window, same harness —
racy fails every time, fixed passes every time. That is what the 40/40 in §4 cannot show.

**Control D — is the new `waitFor` strict or vacuous?** An always-passing `waitFor` is a
stated fail criterion, so I tested it. The `1320ms` is the `waitFor` timeout: it polled and
then failed. The wait still catches a genuinely missing second alert, and the `2` was not
lowered to `1`.

## 6. Required checks

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **exit 0**, clean |
| Tests | `npm test` | **exit 0 — 253 passed / 16 files** (baseline matched) |
| Build | `npm run build` | **exit 0** — `index.html` 1.00 kB, CSS 10.93 kB, JS 171.45 kB |

Build output is byte-identical to IMP-192 §8, confirming no production file moved.

## 7. Nothing was weakened, skipped or deleted

* `git diff` on the file is **2 hunks**, both the same mechanical change. No count lowered.
  No `.catch(() => {})`. No assertion removed. Grep for `it.skip|it.only|it.todo|describe.skip|.catch(`:
  **0 hits**.
* Both `toHaveLength(2)` assertions survive verbatim at `:421` and `:440`.
* Provably non-vacuous — control D.
* **Test names diffed**, HEAD file vs fixed file: **11 vs 11, identical sets**. Whole suite
  253 vs 253.
* `git status --porcelain`: only `M web/src/__tests__/App.partialShard.test.tsx` is mine
  (`App.loadFailure.test.tsx` and `.improve/PROGRESS.log` are the previous agent's and the
  coordinator's; three untracked sweep reports predate me).

## 8. Follow-ups

1. **`web/src/__tests__/App.storage.test.tsx:154-155`** — a **third** instance of this exact
   class, found by control C rather than by reading. It awaits the `/^Vision/` heading
   (`App.storage.test.tsx:154`, the reducer commit) and then synchronously reads the alert
   (`const banner = saveFailedBanner()`, `:155`) that the *save effect* sets in a later
   passive commit. Same fix: wrap in `await waitFor`. It is 25ms from a real flake and my
   brief excluded the file. **This is the one I would take next.**
2. The `App.loadFailure.test.tsx` class is now closed out at all 5 known sites, but note
   that fixing these tests never made the *detector* work for this file — see §5a. The seed
   in `.improve/reports/` should be documented as file-specific rather than universal.
3. sweep-4 regressions 2 and 3 remain the coordinator's scope.
