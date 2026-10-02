# IMP: regression sweep 3 — implementer report

Both real regressions in `.improve/reports/regression-sweep-3.md` are fixed. The
third finding (`.improve/PROGRESS.log` formatting) was already fixed by the
coordinator and was not touched — `git status` shows that file as modified by
someone else, and this batch changed nothing under `.improve/` except this report
and the artifacts directory.

## Files changed

| File | Change |
| --- | --- |
| `web/src/App.tsx` | Both fixes. 59 lines changed. |
| `web/src/__tests__/App.categories.test.tsx` | +2 tests, 2 tests de-pinned (see below). |
| `web/src/__tests__/App.storage.test.tsx` | +3 tests in a new `a cold boot with nothing saved` block. |
| `web/src/__tests__/App.partialShard.test.tsx` | `saveSomething()` helper; one co-existence test now provokes a real save. |
| `web/src/__tests__/App.loadFailure.test.tsx` | `saveSomething()` helper; one co-existence test now provokes a real save. |
| `.improve/artifacts/regression-3-fix/*.png` | 7 screenshots (1280 and 390 for every state). |

No CSS, no `scripts/`, no `tests/`, no `package-lock.json`, no `FEATURES.md`.
No git write commands were run.

---

## Regression 1 — two recovery controls for one condition

### Root cause

`noCategoriesSelected` was derived from `activeCategories.length === 0` alone
(`web/src/App.tsx`, before this change). `resolveCategories` returns an empty
`activeCategories` for two unrelated reasons — the reader selected nothing, or
every value they named was dropped — and IMP-009's banner and IMP-010's empty
state both keyed off the same boolean. IMP-010 (286ea63) therefore added a
button to a state that already had one: the notice said "Unknown category: cs.BI
… nothing can match" with *Reset category filter*, and immediately below it a
panel said "No categories selected" with *Select all categories*. Both write
`categories: null`.

### The judgment call

I removed the misleading message rather than hiding a button. **"No categories
selected" is not the truth in this state**, so the fix is to stop rendering a
sentence that is false, not to stop rendering a button that works. The reader who
landed on `#cat=cs.BI` did not deselect anything; the link they followed named a
category this index does not have. Telling them they had deselected something is
the deeper bug, and hiding the button underneath it would leave the false claim
on screen as the only account of an empty feed.

**Chosen:** split the state. `noCategoriesSelected` now additionally requires
`unknownCategories.length === 0`, so IMP-010's copy and control are reachable
only from a selection the reader actually made. The other half — nothing
selected *because* every named value was unknown — becomes `unknownOnlySelection`
and renders `null` in the feed body, on the grounds that the notice above already
states the cause ("nothing can match"), names the value, and owns the one
recovery. One state, one message, one control.

**Rejected: keep both panels, hide IMP-010's button.** Rejected because it
leaves a heading reading "No categories selected" under a banner saying
"nothing can match" — two different claims about one cause, one of them about an
action the reader never took. It also leaves the worse of the two messages as the
most prominent text on the page, and it does nothing to stop the next person from
copying a control from the wrong panel.

**Rejected: render the generic "No papers match the current filters." instead.**
This is what the feed body would naturally fall through to. It is a third
sentence, it names filters rather than the actual cause, and IMP-009's own
landed test asserts it must not appear for `#cat=cs.BI`.

A partial drop (`#cat=cs.CV,cs.BI`) is deliberately not this state: the reader
has one working category, so `activeCategories.length > 0` and the feed renders
normally. The condition is `activeCategories.length === 0`, not
`unknownCategories.length > 0`, precisely so IMP-009's "Keep only indexed
categories" behaviour keeps its papers.

`web/src/App.tsx:300-323` (the two derivations) and `web/src/App.tsx:769`
(the `unknownOnlySelection ? null :` branch).

---

## Regression 2 — "anything you just changed will be lost" on a cold boot

### Root cause

Not a display problem. The save effect ran on mount:

```ts
useEffect(() => {
  if (storageAvailable) setSaveFailed(!saveState(collections));
}, [collections, storageAvailable]);
```

On a first visit `loadState()` returns the empty state, the effect fires
immediately, and `saveState` attempts a real write. `saveState` reports a blocked
or exhausted quota by returning `false` (it never throws), so a full or blocked
storage turned that mount-time write into `setSaveFailed(true)` and the
`role="alert"` banner — about changes the reader had not made. The condition
under which the effect reported failure was simply "the mount run's write
failed", so the fix had to remove the mount run's write.

### Fix

`web/src/App.tsx:353-390`. The reducer is now driven through a `dispatch` wrapper
that latches `unsavedChanges.current = true`; the effect returns early unless
that latch is set, and clears it before writing. Every path that can change the
collections state goes through this `dispatch` (`handleCreateCollection`,
`handleToggleCategory`/paper, rename, delete, import — `handleRenameCollection`
guards its own no-op), so the latch is exactly "the reader caused this", not a
heuristic about time, storage contents or the first render.

Notes:

- The effect still does not depend on the flag, so `setSaveFailed` bailing out on
  an unchanged value cannot loop.
- One dispatch that batches two reducer actions (create a collection *and* add a
  paper) sets the latch once and the effect saves the settled state once.
- A `renameCollection("")` that the reducer reduces to the same state leaves the
  latch set; the next real change then saves, which is correct.
- Side effect: the app no longer writes `rpf.collections.v1` /
  `rpf.papers.v1` on mount. That is the point — and it is visible below as
  `localStorage` still being completely empty after a cold boot. Corrupt stored
  blobs are no longer silently overwritten at first paint; they stay readable for
  `loadState` to reject, which is the same visible behaviour.

---

## Tests

### Added

| Test | Guards |
| --- | --- |
| `App.categories.test.tsx` → *"offers exactly one control for recovering from it"* | Regression 1. Collects every recovery-labelled button on `#cat=cs.BI` and asserts length 1, that it is `Reset category filter`, and that it lives inside the notice. Failed on the old code: `expected [button, button] to have length 1 but got 2`. |
| `App.categories.test.tsx` → *"keeps its own reversible control, and the unknown-category notice out of it"* | The mirror. `#cat=` must keep exactly one control, `Select all categories`, and no alert. |
| `App.storage.test.tsx` → *"raises no alarm when a save could not have succeeded anyway"* | Regression 2. `storage.full = true` before the first render; asserts no `role="alert"` and no trace of the warning copy. Failed on the old code: the `banner banner--error` node was present. |
| `App.storage.test.tsx` → *"writes nothing, so there is no save to have failed"* | The root cause, not the symptom: `COLLECTIONS_KEY`, `PAPERS_KEY` and `storage.store.size` all stay absent/0. Failed on the old code: `expected true to be false` for `store.has("rpf.collections.v1")`. |
| `App.storage.test.tsx` → *"still reports a failure the reader caused, and clears on the next good one"* | That the feature survives: a real save of a real collection alerts, and the alert clears on the next successful save. This one passes on the old code too, by design — it is a guard against the fix disabling the banner, not an assertion of new behaviour. Same for the `#cat=` control test. |

### Modified (these pinned the defects)

- `App.categories.test.tsx` → *"renders a named notice with a usable reset
  instead of a bare empty state"*: the assertion
  `await screen.findByText("No categories selected")` **required the collision**.
  Inverted to `queryByText(...)` → `null`, with the reset button still checked for
  `BUTTON`/`type="button"`/not disabled/focusable, and the notice still required
  to name `cs.BI`.
- `App.categories.test.tsx` → *"recovers the whole feed when the reset is
  clicked"*: dropped the same `findByText("No categories selected")` wait, which
  was a collision assertion. The recovery itself (hash cleared, alert gone, both
  papers back, all six chips pressed) is unchanged and still asserted.
- `App.partialShard.test.tsx` and `App.loadFailure.test.tsx` → both
  co-existence tests relied on the mount-time save to raise the storage notice
  (the partialShard file even documented the defect: *"`App.tsx:236` runs the save
  effect on mount, which is why the notice is already up with no user action at
  all"*). Each now calls a `saveSomething()` helper — open Collections, create
  "Vision", return to Feed — before counting alerts. What the tests are for (two
  distinct notices coexisting as separate `role="alert"` nodes, neither announced
  twice, neither replaced on re-render) is asserted exactly as before.

### Non-vacuity check

Scratch copy at `/tmp/rpf-reg3-verify` (repo `src` + config, `node_modules`
symlinked, **my new tests** with `App.tsx` restored from `git show HEAD`):

```
Tests  4 failed | 213 passed (217)
```

The 4 failures are exactly the 4 new/changed assertions above, each failing for
its intended reason (2 controls, "No categories selected" present, alert present
on cold boot, key written on cold boot). No other test changed verdict in either
direction, which is the other half of the non-vacuity check.

---

## Commands

```
$ npm test                              # baseline, before any edit
  Test Files  14 passed (14)
       Tests  216 passed (216)

$ npm run typecheck                     # after edits
  tsc -b --noEmit  →  exit 0, no output

$ npm test                              # after edits
  Test Files  14 passed (14)
       Tests  221 passed (221)          # 216 + 5

$ npm run build
  ✓ 2 modules transformed.
  dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip: 3.60 kB
  dist/assets/index-RWGaaTmE.js   170.03 kB │ gzip: 55.99 kB
  ✓ built in 1.42s
  (JS 169.87 → 170.03 kB, +0.16 kB; no new dependencies, no chunk change)

$ npm test                              # flake check, 20 invocations
    run  1..10:  Tests  221 passed (221)   Test Files  14 passed (14)
    run 11..20:  Tests  221 passed (221)   Test Files  14 passed (14)
```

Two batches of 10; every run identical, zero failures, zero skips, zero
retries. The count is deterministic because each test file owns its own storage
and `fetch` fakes and tears them down, and the new `saveSomething()` helpers
await on text that only their own render can produce.

### Landed items re-checked

- **IMP-010** genuine deselect-all keeps its control: *"names and reverses an
  explicitly empty selection"*, *"reaches the empty state by deselecting every
  chip in turn"*, and the new `#cat=` one-control test all pass. Browser: see
  screenshot below.
- **IMP-011** real save failure still alerts and still clears: the 5 existing
  `App.storage.test.tsx` tests pass unchanged, plus the new one. Browser: 1 alert
  after a real failure, 0 after the next good save.
- **IMP-009** notice still names the dropped value and is still actionable:
  `Unknown category: cs.BI` + usable reset; "Keep only indexed categories" on
  partial drops; `#cat=cs.CV,cs.BI` still renders its papers and leaves the URL
  alone. All pass.
- **IMP-016** load-failure panel and **IMP-007** Try again: untouched code, all
  tests in `App.loadFailure.test.tsx` / `App.retry.test.tsx` pass.
- **IMP-015** partial-shard notice: untouched, all tests pass.
- **IMP-007/015/016/017** — no changes to `urlState.ts`, `collections.ts`, or any
  component. `web/src/App.tsx` is the only source file edited.

---

## Playwright evidence

`npm run preview` from `web/` (vite 7.3.1, served at
`http://localhost:4173/research-paper-feed/`, real `dist/` build, real
`localStorage`), stopped afterwards. No `page.addInitScript` was available in
this tool set, so the quota-exhausted-before-load case is covered by the
`storage.full = true` unit tests; the browser proves the same root cause a
different way, by showing storage is never written on mount.

**1. `#cat=cs.BI` — one control, truthful copy.**
`recoveryControls: ["Reset category filter"]` (queried for all three possible
labels across `main`), `[role=alert]` count **1**, `document.querySelector(".empty")`
→ `null`, `.paper-list` absent, no horizontal overflow at 1280 or 390. The notice
reads *"Unknown category: cs.BI. This index does not have that category, so
nothing can match. [Reset category filter]"* — it names the missing category and
says nothing about a deselection, because no deselection happened. Clicking the
reset clears `cat=` and restores both papers and all six pressed chips.
→ `fix-unknown-category-1280.png`, `fix-unknown-category-390.png`

**2. `#cat=` — genuine deselect-all, unchanged.** 0 alerts,
`No categories selected` + `Select all categories` present, visually identical
to the IMP-010 panel style. Clicking **Select all categories** recovered:
hash `#`, `All` and all five category chips pressed, status flipped
`0 papers match` → `2812 papers match`, papers listed.
→ `fix-deselect-all-1280.png`, `fix-deselect-all-390.png`
(Compare `baseline-feed-no-categories-selected-desktop-1280.png`, which predates
IMP-010 and is the generic "No papers match the current filters." panel — the
named panel is IMP-010's landed improvement and this batch does not touch it.)

**3. Cold boot, empty localStorage — no alert.** `localStorage.clear()`, then a
full page load of `/`. Result: `[role=alert]` count **0**, no
`could not be saved` / `will be lost` text anywhere, 50 papers rendered, 2812 in
the index, **0 keys in `localStorage` and `localStorage.length === 0`** — i.e. the
app did not merely hide the notice, it made no write to fail, which is the root
cause.
→ `fix-cold-boot-empty-storage-1280.png`

**4. Real save failure — alert still fires.** With a collection already saved
successfully (`Vision` persisted, 0 alerts), `Storage.prototype.setItem` was
replaced with one throwing a `DOMException` named `QuotaExceededError`, then a
new collection `Robotics` was created. Result: `[role=alert]` count **1**,
copy *"Collections could not be saved. This browser's storage may be full or
blocked, so anything you just changed will be lost when you reload this page."*
Now true: something had just been changed. Restoring `setItem` and creating
`Audio` cleared the banner (0 alerts, `Audio` heading present, `PAPERS_KEY`
written) — the clear-on-success behaviour is intact.
→ `fix-real-save-failure-1280.png`, `fix-real-save-failure-390.png`

**5. Console.** `browser_console_messages` returned **zero messages** — no
errors, no warnings, across all five states, both viewports. Zero horizontal
overflow (`scrollWidth > clientWidth` false) at 1280 and 390 in every state.
