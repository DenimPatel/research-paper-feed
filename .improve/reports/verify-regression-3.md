# Verify — Regression Round 3

**Verifier:** independent sub-agent (did not author the change)
**Date:** 2026-10-02
**Base commit:** `a2b2f4b` · **Working tree:** implementer's fix, uncommitted
**Verdict: PASS** — 2/2 regressions genuinely fixed, no landed item regressed, no data-loss path introduced.

---

## 0. Scope reviewed

`git diff -- web/` — 5 files, 206 insertions / 17 deletions:

| File | ± | What changed |
|---|---|---|
| `web/src/App.tsx` | +42 / −8 | state split + save-gate latch |
| `web/src/__tests__/App.categories.test.tsx` | +49 / −2 | 2 new tests + reset co-existence |
| `web/src/__tests__/App.storage.test.tsx` | +58 | 2 new tests |
| `web/src/__tests__/App.partialShard.test.tsx` | +21 / −5 | 2 tests weakened by `saveSomething()` |
| `web/src/__tests__/App.loadFailure.test.tsx` | +19 / −1 | reset co-existence, `saveSomething()` |

Only one source file changed. `web/src/App.tsx:311-324`, `:356-388`, `:690-771`.

---

## 1. Commands run (exact results)

### Typecheck
```
$ npm run typecheck
> tsc --noEmit
  exit=0        (no output)
```

### Build
```
$ npm run build
> tsc --noEmit && vite build
vite v7.3.1 building for production...
✓ 40 modules transformed.
dist/index.html                   1.21 kB │ gzip:  0.63 kB
dist/assets/index-QfN6MKYg.css   10.31 kB │ gzip:  2.90 kB
dist/assets/index-BPWy4bfp.js   164.79 kB │ gzip: 52.87 kB
✓ built in 817ms
  exit=0
```
(`web/dist` is gitignored; no tracked file changed — `git status --porcelain` after the build lists only the implementer's 5 modified files.)

### Test suite
```
$ npm test
 Test Files  14 passed (14)
      Tests  221 passed (221)
```
Exactly the 221 / 14 required.

### Flake check — 14 consecutive runs
```
run 1  | Tests  221 passed (221) | Test Files  14 passed (14)
run 2  | Tests  221 passed (221) | Test Files  14 passed (14)
run 3  | Tests  221 passed (221) | Test Files  14 passed (14)
run 4  | Tests  221 passed (221) | Test Files  14 passed (14)
run 5  | Tests  221 passed (221) | Test Files  14 passed (14)
run 6  | Tests  221 passed (221) | Test Files  14 passed (14)
run 7  | Tests  221 passed (221) | Test Files  14 passed (14)
run 8  | Tests  221 passed (221) | Test Files  14 passed (14)
run 9  | Tests  221 passed (221) | Test Files  14 passed (14)
run 10 | Tests  221 passed (221) | Test Files  14 passed (14)
run 11 | Tests  221 passed (221) | Test Files  14 passed (14)
run 12 | Tests  221 passed (221) | Test Files  14 passed (14)
run 13 | Tests  221 passed (221) | Test Files  14 passed (14)
run 14 | Tests  221 passed (221) | Test Files  14 passed (14)
```
**14/14 clean at 221/221 across 14 files.** No flake. (The implementer's "21 clean runs" claim is not verified by me, but 14 is above the bar the sweep demanded.)

### Pre-fix control — fails under MY harness
Scratch copy `/tmp/rpf-verify3` (its own `src/`, symlinked `node_modules`). Only `src/App.tsx` reverted to `git show HEAD:web/src/App.tsx`; the implementer's 4 test files kept. 3 runs:

```
CONTROL run 1 | Tests  4 failed | 217 passed (221) | Test Files  2 failed | 12 passed (14)
CONTROL run 2 | Tests  4 failed | 217 passed (221) | Test Files  2 failed | 12 passed (14)
CONTROL run 3 | Tests  4 failed | 217 passed (221) | Test Files  2 failed | 12 passed (14)
```
Deterministic, 3/3. The 4 failures:
1. `App.categories.test.tsx` › `renders a named notice with a usable reset instead of a bare empty state`
2. `App.categories.test.tsx` › `offers exactly one control for recovering from it`
3. `App.storage.test.tsx` › `raises no alarm when a save could not have succeeded anyway`
4. `App.storage.test.tsx` › `writes nothing, so there is no save to have failed`

**The implementer's own report understates this** as "4 failed | 213 passed (217)". The real count is `4 failed | 217 passed (221)`. Reporting inaccuracy only — the fix and the tests are unaffected.

---

## 2. REGRESSION 1 — unknown-category state split

### The change
`web/src/App.tsx:311-324` introduces a second, disjoint predicate:

```
311:  const noCategoriesSelected =
312:    manifest !== null && activeCategories.length === 0 && unknownCategories.length === 0;
321:  const unknownOnlySelection =
322:    manifest !== null && activeCategories.length === 0 && unknownCategories.length > 0;
```
and `web/src/App.tsx:769` uses it to suppress **the entire** second panel:
```
769:                ) : unknownOnlySelection ? null : (
```

### Rendered DOM, not source — `#cat=cs.BI` (1280px, real preview)
```
recoveryControls:            ["Reset category filter"]        <- exactly one
alertCount:                  1
alert text:                  "Unknown category: cs.BI. This index does not have that category,
                               so nothing can match.  [Reset category filter]"
hasNoCategoriesSelected:     false     <- copy removed, not just the button
hasNoPapersMatch:            false
hasNoPapersAvailable:        false
.empty node:                 null
.paper-list present:         false
resultCount (role=status):   "0 papers match"
pressedChips:                []        <- no chip claims the reader turned something off
horizontal overflow:         false
```
Screenshot: `.improve/artifacts/regression-3-fix/verify-unknown-total-1280.png` (1280),
`.improve/artifacts/regression-3-fix/v-unknown-total-390.png` (390, `overflow: false`, no offender elements).

**Honesty judgement — the symptom was not hidden.** The implementer did not keep "No categories selected" and merely delete the button. The whole `.empty` panel is gone and the string is absent from `document.body.innerText` in every probe I wrote. Compare to the pre-fix capture at
`.improve/artifacts/regression-3/rec-unknown-total-1280.png`, which shows the collision (yellow unknown banner **and** "No categories selected" **and** a separate "Select all categories" button).

The copy is truthful: it names `cs.BI`, says *why* ("This index does not have that category"), and states the consequence ("nothing can match"). The page is not silent — the notice plus the `role="status"` line "0 papers match" account for the empty feed.

### IMP-010 not over-suppressed (the regression risk)
`#cat=`, real browser:
```
recoveryControls: ["Select all categories"]
body contains "No categories selected": true
alertCount: 0
```
Unchecking **every** chip in the UI (cs.CV → cs.LG → cs.CL → cs.AI → cs.RO), real browser:
```
after cs.CV  : hash #cat=cs.LG,cs.CL,cs.AI,cs.RO
after cs.LG  : hash #cat=cs.CL,cs.AI,cs.RO
after cs.CL  : hash #cat=cs.AI,cs.RO
after cs.AI  : hash #cat=cs.RO
after cs.RO  : hash #cat=   | "No categories selected" | ["Select all categories"] | 0 papers match
click "Select all categories" -> hash "" , 2812 papers match, All+5 chips aria-pressed=true, 0 alerts
```
Screenshots: `v-deselect-all-1280.png`, `v-deselect-all-390.png` (390 matches IMP-010's landed layout exactly — no overflow). IMP-010 intact.

### IMP-009 intact
`web/src/App.tsx:690-709` is untouched except for the `totalDropped` label swap, which **only fires when `activeCategories.length === 0`**:
- `#cat=cs.BI` → "Unknown **category**: cs.BI." + "Reset category filter" → clears to `""`, 2812 papers, 0 alerts. Verified in browser.
- `#cat=cs.BI,cs.NOPE` → "Unknown **categories**: cs.BI, cs.NOPE." + one control. Verified.
- `#cat=cs.CV,cs.BI` → "Unknown category: cs.BI … so those papers are hidden." + "Keep only indexed categories". Verified.

### The partial case — `#cat=cs.CV,cs.BI` (explicitly required)
Real browser:
```
hash:            "#cat=cs.CV,cs.BI"   (URL left untouched until a category action)
recoveryControls:["Keep only indexed categories"]
alertCount:      1
"No categories selected": false
empty .node:     null
.paper-list:     present, 50 cards rendered
resultCount:     "783 papers match"
pressedChips:    ["cs.CV"]  -> papers filtered to cs.CV; cs.LG cards absent
```
Correct partial case, neither special state. Screenshot: `v-partial-unknown-1280.png`.

### Contradiction traces
`toggleCategory` (`App.tsx:426-441`) seeds from `activeCategories` and **replaces** `urlState.categories`, so a deselection cannot leave a stale unknown value in the URL:

| scenario | result (verified in browser + 10 unit probes) |
|---|---|
| `#cat=cs.CV,cs.BI`, uncheck cs.CV | hash → `#cat=`; notice **disappears**; "No categories selected" + "Select all categories" take over. No contradiction. |
| `#cat=cs.BI`, click chip cs.CV | hash → `#cat=cs.CV`; notice disappears; papers show; no empty-state copy. |
| `#cat=cs.BI`, click "All" | `categories: null` → all chips pressed, notice gone. |
| `#cat=cs.BI&q=transformer` | notice only; no empty-state copy, no generic zero-match copy. |
| `#cat=cs.BI` + **hard** shard failure | IMP-016 panel + "Try again" still wins (`loadFailed` is evaluated at `App.tsx:330` and chained at `:768`, **before** `unknownOnlySelection`), unknown notice still present → 2 alerts. The unknown branch cannot swallow a load failure. |
| `#cat=cs.BI` + **partial** shard failure | 2 notices, 1 control, no empty-state copy. |
| save-failure + partial shard + `#cat=cs.BI` | 3 distinct alerts, no empty-state copy. |

**Assessment of the state split: correct in all reachable cases.** `noCategoriesSelected` and `unknownOnlySelection` are disjoint and jointly exhaustive of the `active === 0` case, and the partial case falls outside both by construction.

**Minor observation (not a defect, no action required):** for a *total* drop the feed body now renders nothing at all, so the previous "No papers are available in this window yet." panel is also suppressed when the window is genuinely empty *and* an unknown category was requested. The unknown notice ("so nothing can match") is the more relevant explanation and the `role="status"` line still reports "0 papers match", so the reader is not left without an account. Recorded for the record only.

---

## 3. REGRESSION 2 — the save gate

### Is the gate principled?
```
364:  const unsavedChanges = useRef(false);
365:  const dispatch = (action: CollectionsAction) => {
366:    unsavedChanges.current = true;
367:    rawDispatch(action);
368:  };
382:  useEffect(() => {
383:    if (!storageAvailable || !unsavedChanges.current) { return; }
386:    unsavedChanges.current = false;
387:    setSaveFailed(!saveState(collections));
388:  }, [collections, storageAvailable]);
```

Auditing every dispatch site in the file: `handleToggleCollection` (from a card's checkbox, a collection-view checkbox, and the card's save menu), `handleCreateCollection` (×2), `handleCreate` (save-menu create-and-save, ×2), `onRename`, `onDelete`, `onRemovePaper`, `handleImport`. **`rawDispatch` is not called anywhere outside the wrapper.**

This makes the gate *exactly* equivalent to "the reader changed something":

- `collections` is `useReducer` state, so it can only change through a dispatch.
- A dispatch is only ever raised from a user event handler.
- Therefore `collections` identity changes **only** after a dispatch, i.e. only after a real user action.
- The effect's only other dependency, `storageAvailable`, is `useState(detectStorage)` — a function initialiser, set once, never updated.

**No legitimate non-user path is skipped.** The question the brief raises — "could a state change triggered by loading data, a hash deep link, or a category toggle now be silently skipped?" — is the right question and the answer is no, but for a stronger reason than a heuristic: those code paths **cannot change `collections` at all**. `loadPapers`/`setPapers` touch `papers`/`error`/`failedShards`; `applyState`/`setUrlState` touch `urlState`; category toggles dispatch nothing. Verified by reading the whole file.

The latch being cleared *before* the write (`App.tsx:386`) is correct: `saveState` is synchronous and never throws (it returns `false`), so the write always executes when the effect runs, and a failed save is re-armed by the next real action.

Stale-latch case: a dispatch the reducer reduces to the same state (e.g. `renameCollection("")` → whitespace-trimmed to no-op) leaves the flag `true` with no effect run. Harmless — the next `collections` change still needs a dispatch, which sets the flag again. I probed this explicitly ("a stale no-op dispatch still lets the next real change persist") and it passes.

### The critical inverse — real failure, real action
Browser, with the **real** `Storage.prototype.setItem` stubbed to throw `DOMException('quota exceeded','QuotaExceededError')` for `rpf.papers.v1`, then a real "Create collection" click:
```
afterFail:      alertCount 1
                alert text "Collections could not be saved. This browser's storage may be
                            full or blocked, so anything you just changed will be lost when
                            you reload this page."
afterRecovery:  alertCount 0, stored names ["Vision Lab","Imported Set","Robotics","Audio"]
```
The alert fires after a genuine user-caused change, and clears on the next successful save — and the recovery is a real write, not a cosmetic clear. Screenshots: `v-save-failure-1280.png`, `v-save-failure-390.png` (no overflow).

The copy is now honest: it can only fire after the reader actually changed something, so "anything you just changed" is true.

### DATA-PERSISTENCE (the most important check)
Real browser, real `localStorage`, **real full page reloads** (`page.goto`) between every step:

| action | after reload |
|---|---|
| create "Vision" + save first paper from a card's save menu | `region "Vision"` → `heading "Vision (1)"` + the paper present; `rpf.collections.v1` = `[Vision]`, `rpf.papers.v1` = 1 paper |
| rename "Vision" → "Vision Lab" | `heading "Vision Lab (1)"`; stored name `Vision Lab` |
| remove the paper | `heading "Vision Lab (0)"`; `paperIds: []`; `rpf.papers.v1` = `{}`; copy "No papers saved yet. Use “Save to collection” on any paper in the feed." |
| import a 2-paper export via the real `<input type="file">` (`File` + `DataTransfer` + `change`) | `region "Imported Set"` → `heading "Imported Set (2)"` with both papers; stored `rpf.collections.v1` = `[Vision Lab, Imported Set]`, 2 papers |
| cold boot with `localStorage.clear()` then load | `localStorage.length === 0` — **the app wrote nothing**; 0 alerts; no "could not be saved" copy |
| reload a second time with data present | 0 alerts; all collections still present |

**8 independent jsdom probes** (`/tmp/rpf-verify3/src/__tests__/VerifyPersistence.test.tsx`, reload modelled as `cleanup()` + fresh `render(<App/>)` re-initialising from the same storage) — all 8 pass:
save-from-card persists; rename persists; remove persists; import persists; delete persists; real failure alerts then recovers with a real write; cold boot writes nothing but the very next action writes; a stale no-op dispatch does not block the next save.

**The gate does not trade a false positive for data loss.** There is no path on which a user-caused change fails to persist.

---

## 4. Non-vacuity of the new tests

Verified in my own scratch copy. Exact count: **4 tests fail against `HEAD`'s `App.tsx`** (`4 failed | 217 passed (221)`, 2 files failed, deterministic 3/3).

Well-targetedness — the brief warned a button-counting test could pass while the copy stayed misleading. Checked each:

| new test | asserts copy? | asserts root cause? |
|---|---|---|
| `raises no alarm when a save could not have succeeded anyway` | **yes** — `expect(document.body.textContent).not.toMatch(/could not be saved/i)` and `not.toMatch(/will be lost/i)`, plus `queryAllByRole("alert")` empty | no |
| `writes nothing, so there is no save to have failed` | no | **yes** — `store.size === 0` and neither key written |
| `renders a named notice with a usable reset instead of a bare empty state` | **yes** — `getByText(/Unknown category: cs\.BI\./)`, and `queryByText("No categories selected")` must be `null`. Also `.empty` absent and the Reset button **absent** on pre-fix. | — |
| `offers exactly one control for recovering from it` | indirectly — counts controls but pins the survivor as the button *inside the notice*, so the Select-all button must be gone | — |

Two of the four assert the copy directly; the third also pins the exact label of the surviving control. The count-only concern does not hold.

I also wrote **22 probes of my own** and ran them both ways:

```
FIXED   App.tsx:  Test Files 17 passed (17)   Tests 243 passed (243)
PRE-FIX App.tsx:  Test Files  5 failed | 12 passed (17)
                     Tests 10 failed | 233 passed (243)
```
The 10 pre-fix failures include 4 of mine — `#cat=cs.BI` total drop, two dropped values, unknown drop with a search term, partial shard on `#cat=cs.BI`, save-failure + partial shard + unknown, and cold-boot-writes-nothing. The other 12 of my probes pass on both sides by design: they are the over-suppression and no-data-loss guards, which must be invariant.

---

## 5. Landed-item regression sweep

| item | check | result |
|---|---|---|
| IMP-007 | Try again on index failure — `App.loadFailure.test.tsx` green; verified in a probe that the hard-failure panel with a "Try again" button still wins over the new `unknownOnlySelection` branch on `#cat=cs.BI` | pass |
| IMP-009 | unknown notice names the value, reset works, 2-value form correct | pass |
| IMP-010 | Select all / reversible selection, `null` vs `[]` — `#cat=` and chip-deselect both give the copy + a working control, verified in browser and jsdom | pass |
| IMP-011 | save-failure banner fires only on real failure, clears on the next good save, real quota verified | pass |
| IMP-015 | partial-shard notice; coexists with the unknown notice (`2 alerts`) and with IMP-010's copy | pass |
| IMP-016 | load-failure panel + Try again + `formatWeekRange`; the `loadFailed` branch is chained **before** the new branch so it cannot be swallowed | pass |
| IMP-017 | reader-facing copy, no raw messages, aria-labels — a11y snapshots checked: `region "Feed filters"`, `group "Categories"`, `group "Recency"`, `group "Sort"`, `alert`, `status`, `button "Feed"`, `button "Collections (1)"`, `textbox "New collection name"`, `button "Create collection"`, `button "Import collection"`, `region "Vision"`, `button "Rename"/"Export"/"Delete"/"Remove"` all intact | pass |

**Nothing regressed.**

### Note on the modified pre-existing tests
`App.partialShard.test.tsx` and `App.loadFailure.test.tsx` had two co-existence tests that asserted `not.toHaveLength(2)` on `[role="alert"]` because on a cold boot the storage notice added a second alert. Those now call a `saveSomething()` helper first. This is a **legitimate, disclosed** adaptation — the pair being counted is now "storage notice + one load notice", not "storage notice + two load notices". Both files still assert the substance (the co-existence text, the labels, the absence of a duplicate control). Weakening, but not vacuous, and disclosed. Recorded, not objected to.

---

## 6. Playwright — verified for myself, against the freshly built `dist`

`npm run preview -- --port 4173 --strictPort` in `web/`, served the production bundle, then stopped.

- `#cat=cs.BI` — 1 control, copy names `cs.BI`, no misleading copy. Screenshots 1280 + 390.
- `#cat=cs.CV,cs.BI` — partial case correct. Screenshot 1280.
- `#cat=` and unchecking every chip — "No categories selected" + working Select all; clicking it restored 2812 papers. Screenshots 1280 + 390.
- Cold boot, empty `localStorage` — **0 alerts**, and `localStorage.length === 0` (no write at all). Reload — **0 alerts** again.
- `QuotaExceededError` on a real save — alert present; restored, saved again, alert cleared and the write landed.
- Persistence across real reloads — create+save, rename, remove, import, delete: all survive (table in §3).
- Alerts counted via `document.querySelectorAll('[role="alert"]')` in every state: `#cat=cs.BI` → 1; `#cat=cs.CV,cs.BI` → 1; `#cat=` → 0; cold boot → 0; post-failure → 1; post-recovery → 0.
- Horizontal overflow: `false` at 1280 and at 390 in every state checked.
- **Console messages: none.** Zero console errors or warnings across the whole session.

### Screenshots (all mine, all in `.improve/artifacts/regression-3-fix/`)
| file | state |
|---|---|
| `verify-unknown-total-1280.png` | `#cat=cs.BI` — one control, truthful copy |
| `v-unknown-total-390.png` | same, 390px |
| `v-partial-unknown-1280.png` | `#cat=cs.CV,cs.BI` — partial case, 783 papers |
| `v-deselect-all-1280.png` / `v-deselect-all-390.png` | IMP-010 state + working control |
| `v-save-failure-1280.png` / `v-save-failure-390.png` | real `QuotaExceededError` alert |

### Baseline comparison
`.improve/artifacts/baseline/feed-desktop-1280.png` (pre-IMP-009/010): `#cat=` showed a **generic** panel ("No papers are available in this window yet" / "No papers match the current filters") and **no** recovery control. The current `#cat=` view shows IMP-010's copy **plus** a control — a strict improvement, and IMP-010's landed design. The `#cat=cs.BI` view shows only IMP-009's notice, which the baseline never had. No baseline element was lost.

### Non-blocking nits
1. `web/src/__tests__/App.storage.test.tsx` lost its trailing newline (`\ No newline at end of file` in the diff). Harmless; no lint script exists.
2. The implementer's report line "4 failed | 213 passed (217)" should read "4 failed | 217 passed (221)".
3. The implementer's report says `✓ 2 modules transformed` for the build; the real count is 40. Copy-paste slip in the report only.

---

## 7. Verdict

**PASS.**

- **REGRESSION 1 (286ea63, IMP-010 × IMP-009):** fixed. `#cat=cs.BI` renders exactly one recovery control, the copy names `cs.BI` and explains that the index lacks it, and the misleading "No categories selected" is gone from the DOM — not merely its button. The partial case `#cat=cs.CV,cs.BI` is correct. IMP-010's genuine deselect-all state, IMP-009's notice, and every mixed state still work.
- **REGRESSION 2 (2e3f6e8, IMP-011):** fixed at the root cause. Cold boot writes nothing (`localStorage.length === 0`) and shows no alert; the gate is equivalent to "the reader changed something" because `collections` can only change through the dispatch wrapper; a real `QuotaExceededError` after a real action still alerts and clears on the next good save; and every mutation path — save, rename, remove, import, delete — still persists across real reloads.
- 221/221 tests across 14 files, 14/14 flake runs green, typecheck clean, build clean, 4 new tests non-vacuous, zero console errors, no landed item regressed.
