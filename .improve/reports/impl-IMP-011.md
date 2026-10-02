# IMP-011 — Surface `saveState` failure to the user

## Status: implemented, verified (first attempt — no prior `verify-IMP-011.md` existed)

## Files changed (4)

| File | Change |
| --- | --- |
| `web/src/App.tsx` | +23 / −2. Save effect now reads `saveState`'s return value into a `saveFailed` state; `<main>` renders a `role="alert"` banner when it is set. |
| `web/src/lib/__tests__/collections.test.ts` | +69. New `quotaStorage()` fake (throws on the *second* key written) + 2 tests. |
| `web/src/__tests__/App.storage.test.tsx` | **new file**, 5 component tests. |
| `.improve/artifacts/IMP-011/collections-save-failed-desktop-1280.png` | new artifact (the spec's verification-method screenshot). |

Nothing else was touched: no `styles.css`, no `collections.ts`, no `scripts/`, no Python
`tests/`, no `web/package*.json`, no `.improve/FEATURES.md`. No git write commands were run.

## The defect, as it read in the code

`App.tsx:228-232` (pre-change) called `saveState(collections)` and threw the boolean away.
`saveState` (`collections.ts:331-346`) deliberately returns `false` instead of throwing so a
blocked or exhausted localStorage cannot take the app down — which meant the only signal
existed and nobody read it. The reducer had already applied, so the checkbox stayed ticked
and the collection was in the list; on the next reload it was gone.

## Approach

### 1. Read the return value (criterion 1)

```tsx
const [saveFailed, setSaveFailed] = useState(false);

useEffect(() => {
  if (storageAvailable) {
    setSaveFailed(!saveState(collections));
  }
}, [collections, storageAvailable]);
```

Setting the flag on *every* effect run (not only on the failing one) is what makes criterion 2
fall out for free: the next successful save writes `false` and the banner unmounts. There is
no latch to reset. `useState` bails out on an unchanged value and the effect does not depend on
`saveFailed`, so the common "storage is fine" path costs no extra render pass and cannot loop.

### 2. The banner

Rendered inside `<main>` at `App.tsx:378-389`, **before** the `view === "collections"` ternary,
so a save that fails from either tab is reported in either tab. It reuses the established
notice pattern verbatim — `className="banner banner--error"` + `role="alert"` + a `<strong>`
lead-in, the same shape `CollectionsView.tsx:228-232` uses for an import error and
`App.tsx:456-475` uses for the unknown-category notice. **No new CSS**: `banner--error`
already exists (`styles.css:605-608`) and its `--danger` on `--danger-soft` measures 5.61:1
light / 6.70:1 dark (sRGB relative luminance), clearing WCAG AA 4.5:1 in both themes.

Text: "**Collections could not be saved.** This browser's storage may be full or blocked, so
anything you just changed will be lost when you reload this page." It names the thing that
failed (collections), gives the cause the spec asks for (storage may be full), and states the
consequence.

### 3. Why it does not spam a screen reader

`role="alert"` is an assertive live region; it announces **when a node with that role enters
the DOM**, and again if its text content changes while it stays. This banner is conditionally
mounted, so:

- it enters the DOM on the failing save and stays for the duration of the failure — one
  announcement per failure episode, not per render;
- its text is a constant string, so a subsequent failing save cannot re-trigger an
  announcement through a text change;
- React keeps the same DOM node across the re-render caused by a *later* failing save, so
  there is no unmount/remount either.

That third point is asserted directly in
`App.storage.test.tsx:170-186` ("keeps one banner node across repeated failures so it is
announced once"): two consecutive failed saves, then `expect(second).toBe(first)` — DOM node
identity — plus `getAllByRole("alert")` having length 1.

## Acceptance criteria, one by one

1. **The save effect reads the return value and sets a `role="alert"` banner on `false`,
   saying collections could not be saved and storage may be full.** Done —
   `App.tsx:227-240` and `App.tsx:378-389`. Covered by
   `App.storage.test.tsx:130-149` (banner text, `role`, `banner--error`) and confirmed live in
   a real browser (§ Verification below).
2. **The banner clears on the next successful save.** Done — the flag is written on every run
   of the effect, so a successful save clears it. Covered by
   `App.storage.test.tsx:151-168`.
3. **A test in `web/src/lib/__tests__/collections.test.ts` exercises `saveState` against a
   storage fake that throws on the second `setItem`.** Done — `quotaStorage()` at
   `collections.test.ts:83-118` (reads succeed, the collections key lands, the papers key
   throws `DOMException("quota", "QuotaExceededError")`), asserted at `:600-618`. A second test
   asserts the same state saves `true` after `succeed()`, which is the recovery the banner
   clears on.

**Deliberately NOT done — atomicity.** The task brief flagged the non-atomic write as "possibly
covered". Re-reading the spec, it is not: all three criteria are about *surfacing* the failure,
and criterion 3 asks for a test that exercises the throw on the **second** `setItem` — i.e. it
pins the partial-write behaviour rather than asking for it to be removed. `saveState` still
writes `COLLECTIONS_KEY` then `PAPERS_KEY`. WEB-24 stays open; reasoning and the follow-up
options are in `.improve/reports/discovered-IMP-011.md` § 1.

## Tests added (7)

**`web/src/lib/__tests__/collections.test.ts`** (+2, `collections.test.ts:600-618`)
- `returns false when the quota fills on the second key it writes` — pins `false` and
  `writes === [COLLECTIONS_KEY, PAPERS_KEY]`, which is what makes the failure reachable at all.
- `reports the next save as successful once the quota is gone` — `false` is a per-attempt
  result, not a latch.

**`web/src/__tests__/App.storage.test.tsx`** (new, 5 tests)

The critical environment fact, found by probing rather than assuming: **jsdom 29 hands back a
`window.localStorage` object whose `setItem` is `undefined`.** `malformedImport.test.tsx:32`
already records this. It means `detectStorage()` returns `false` in every component test, the
save effect returns before calling `saveState`, and the whole feature is unreachable unless the
test installs a working `Storage`. So the file does:

```tsx
Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
```

in `beforeEach`, restoring the original descriptor in `afterEach` (confirmed by probe that
`localStorage` is an own accessor property on the jsdom window, so redefinition works). The
fake's `full` flag throws only on `PAPERS_KEY` — a *quota* shape (the smaller key still fits),
not the blanket "storage blocked" shape that `THROWING_STORAGE` already covers.

| Test | Asserts |
| --- | --- |
| `warns instead of letting the optimistic update pass as a real save` | the created collection is still on screen (optimistic) *and* a `role="alert"` banner names collections + storage being full + carries `banner--error` |
| `clears the banner on the next successful save` | fail → banner, quota lifted → next save succeeds → banner gone, both keys written |
| `keeps one banner node across repeated failures so it is announced once` | two failed saves → the alert is the **same DOM node** and still exactly one |
| `still reports the failure after switching views` | Collections → Feed keeps the banner (it is not tied to one tab) |
| `stays silent while saves succeed` | no alert at all, and both keys are in storage — the guard against an always-on banner |

Driving a save: the Collections tab's "New collection name" form, one dispatch per
`fireEvent.click` on "Create collection", so each test has exactly one save attempt and no
timing dependence.

### Non-vacuity — confirmed by reverting the fix

`web/src/App.tsx` was temporarily replaced with `git show HEAD:web/src/App.tsx` (read-only git;
the file was restored from a copy immediately after, `diff` reported IDENTICAL) and the two
files re-run:

```
Test Files  1 failed | 1 passed (2)
     Tests  4 failed | 38 passed (42)
```

The 4 failures are exactly the four banner tests. The 5th App test ("stays silent while saves
succeed") passes both before and after **by design** — it is the guard against the naive
"always show the banner" fix, and it fails if the banner is ever made unconditional. The two
`collections.test.ts` tests also pass before and after, because `saveState` already returned
`false`; criterion 3 asks for reachability of that path, not for a behaviour change in
`collections.ts`.

## Commands and results (all from `web/`)

| Command | Result |
| --- | --- |
| `npm run typecheck` | **exit 0**, no output (run 3× — after the edit, after the revert experiment, at the end) |
| `npm test` | **11 passed / 11 files, 167 tests passed** at the time of my change |
| `npm run build` | **exit 0** — 39 modules, `index.html` 1.00 kB, CSS 10.93 kB (gzip 2.86, unchanged from the profile baseline), JS 166.61 kB (gzip 53.42) vs the profile's 163.72/52.63 — expected drift, no new deps |
| `npm test` × **12** (flake check) | **12/12 "167 passed", 0 non-green** |
| `npx vitest run` on my two files × **10** | **10/10 "42 passed", 0 non-green** |
| `npm test` (final) | **12 passed / 12 files, 178 tests passed** — see the concurrent-edit note below |

### Baseline reconciliation — read this before scoring the test count

The brief's baseline is **160 tests / 10 files**. Mine adds **+7 tests / +1 file**
(2 in `collections.test.ts`, 5 in the new `App.storage.test.tsx`), which gives exactly
**167 / 11** — the numbers I measured.

A **concurrent agent** modified `web/src/lib/paperIndex.ts`,
`web/src/lib/__tests__/paperIndex.test.ts` and added `web/src/__tests__/App.partialShard.test.tsx`
in this same shared working tree while I was working. Between two of my runs the suite moved
from 167/11 to **178/12**. `git diff web/src/App.tsx` contains **only** the IMP-011 change;
`+11` of the final 178 tests and the extra file are **not mine** and must not be attributed to
this item.

## Verification in a real browser (the spec's method)

`web/public/data/` already held a full index, so no arXiv fetch was needed.

1. `npm run preview -- --port 5199 --strictPort` (production build, `dist/data/` present).
2. Playwright at **1280×900**, `http://localhost:5199/research-paper-feed/` — 2,812 papers, 50
   cards, **0 alerts** at rest.
3. Patched `Storage.prototype.setItem` to throw
   `DOMException("…exceeded the quota.", "QuotaExceededError")` for `rpf.papers.v1` only —
   i.e. the collections key still lands, exactly the case criterion 3 names.
4. Clicked the first paper's "Save to collection" checkbox.
   - Accessibility snapshot: `main > alert > strong "Collections could not be saved."` +
     "This browser's storage may be full or blocked, so anything you just changed will be lost
     when you reload this page."
   - The checkbox reads `checked: true` — the optimistic update is still there, and the banner
     is the only thing telling the user it did not persist.
   - Screenshot saved to
     `.improve/artifacts/IMP-011/collections-save-failed-desktop-1280.png` (the red banner sits
     at the top of `<main>`, above the hero, at 1280px).
5. Restored `setItem`, clicked the same checkbox again (a successful save).
   - `alertsAfterSuccessfulSave: 0` — criterion 2 confirmed live.
6. **Browser console: completely clean** (zero messages), matching the profile's stated baseline.

## No regressions in landed items

- **IMP-001 / IMP-151b (URL safety):** `collections.ts` untouched.
- **IMP-154 (`isPaper`):** untouched.
- **IMP-007 (Try again):** untouched; the new banner is in `<main>` but only when a *save* fails,
  and `App.retry.test.tsx` (7 tests, `queryByRole("alert")).toBeNull()` on the retry path)
  passes. In jsdom, `storageAvailable` is `false` anyway, so the save path is never reached there.
- **IMP-009 / IMP-010 (unknown-category notice, `role="alert"`, chips):**
  `App.categories.test.tsx` (15 tests) passes unchanged, including the two that assert
  `screen.queryByRole("alert")).toBeNull()` and the three that use
  `screen.getByRole("alert")` for the unknown-category notice — those assertions still find
  exactly one alert, because no save fails in that file.
- **IMP-008 (relevance agreement):** `App.relevance.test.tsx` passes.

I deliberately kept the alert count at **one**: the banner and the unknown-category notice can
coexist visually but the two live in different branches and the existing tests still resolve
`getByRole("alert")` unambiguously.

## Anything uncertain

- **Banner wording.** The spec asks for "collections could not be saved" and "browser storage
  may be full"; the copy satisfies both literally, but "or blocked" is my addition because
  `saveState` also returns `false` when `defaultStorage()` yields `null`
  (`collections.ts:336-338`) — a Safari private-browsing / storage-disabled case, which is in
  the item's own intent text.
- **Where the banner lives.** `<main>` before the view branch means it appears above the
  collections list too, not inside it. I judged "visible in both tabs" more useful than
  "inside the view that failed", and it matches how the collections-view storage warning is
  top-anchored. A verifier who prefers the alternative only needs to move the block inside the
  ternary's branches.
- **No dismiss control.** See `discovered-IMP-011.md` § 3 — a deliberate consequence of
  criterion 2, not an oversight.
- **Text uses a typographic apostrophe** (`browser’s`), matching `CollectionsView.tsx:128`
  ("Save to collection"). If the project would rather avoid the curly quote in user copy,
  `"browser storage"` reads the same and only that word changes.
- **`satisfies Storage`** is used in the new test fake (TypeScript 5.9.3, fine here). It is the
  first use of `satisfies` in `web/`; `as unknown as Storage` (the existing
  `THROWING_STORAGE` shape) would match the surrounding style more closely if consistency
  matters more than the type checking.