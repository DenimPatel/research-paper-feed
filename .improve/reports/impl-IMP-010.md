# IMP-010 — The category filter can be reversed

Status: implemented and verified.

## Files changed

| File | Change |
| --- | --- |
| `web/src/lib/urlState.ts` | New exported `isFullSelection`; `writeHash` takes an optional 4th arg `allCategories` and omits `cat=` for a selection covering the whole index |
| `web/src/components/FeedControls.tsx` | New `onSelectAllCategories` prop and a first "All" chip in the Categories fieldset |
| `web/src/App.tsx` | `applyState` passes the manifest's list to `writeHash`; new `selectAllCategories`; new `noCategoriesSelected` branch rendering the named, reversible empty state |
| `web/src/lib/__tests__/urlState.test.ts` | `isFullSelection` suite (6 tests) + 4 new `writeHash` `cat=` tests |
| `web/src/__tests__/feedControls.test.tsx` | "All" chip suite (6 tests); existing helper passes the new prop |
| `web/src/__tests__/App.categories.test.tsx` | New `choosing between all categories and a subset` suite (4 tests); 3 IMP-009 assertions updated |

No new files, no new CSS rules, no `styles.css` change. Nothing outside `web/src/` was
touched.

## Approach

The dead end had two halves: no control could *express* "all categories" once the last
chip was off, and the URL had no way to *carry* that choice once made. Both are fixed at
the layer where the information already exists — the manifest's own category list.

**One shared definition of "all categories".** `isFullSelection(selected, all)` is
exported from `urlState.ts` and used by both `writeHash` and the "All" chip. These two
must agree — the chip tells the user what is pressed, the writer decides what the address
bar says — so a single function is used for both rather than two comparisons that could
drift. It compares as sets (order-independent, duplicate-proof on both sides) and
re-checks `all` at runtime for the same reason `resolveCategories` does: the manifest
arrives through a bare cast in `paperIndex.ts`.

The failure direction is chosen deliberately. An absent or malformed `all` answers
"no", so `writeHash` keeps emitting the `cat=` it emitted before rather than silently
dropping a live filter. A false positive here is the one unrecoverable error; a false
negative is only a longer URL.

**`writeHash` gained a 4th parameter** rather than normalizing the state in `App.tsx`.
This was the one real design fork. Normalizing in the caller would have left
`writeHash` unable to recognize a full selection, which makes acceptance criterion 4's
required test ("`writeHash` omits `cat` for a full selection") unsatisfiable — there would
be no full selection for it to receive. The parameter keeps the encoding rule inside the
encoder. The call site passes `undefined` for the third argument to keep the default
writer; a comment says so.

`applyState` consequently depends on `manifest` instead of `[]`. It is only ever called
from event handlers, never from a dependency array, so the identity change is inert.

## How the `null` vs `[]` distinction is preserved

This is the constraint I was most careful about, and the new tests pin it from both sides.

- `null` (no explicit selection) and `[]` (explicitly empty) remain distinct states in
  `HashState`, in `resolveCategories`, and in `readHash`. Nothing was collapsed.
- `selectAllCategories` sets `categories: null`, **not** the manifest list. That is the
  important asymmetry: writing `manifest.categories` would be a second spelling of a
  state that already has one, and it would begin drifting the moment the index changed.
- The encoder draws exactly one line — `state.categories !== null` — and inside it only
  the *full* case is elided. `[]` fails `isFullSelection` (a `Set` of size 0 against a
  non-empty manifest), so it keeps its own `cat=` and still reads back as `[]`.
- `readHash` is untouched, so nothing was asked of it that it cannot round-trip.

Resulting encoding, all round-tripped through `readHash` in tests:

| selection | written | read back |
| --- | --- | --- |
| `null` | no `cat=` | `null` |
| `[]` | `cat=` | `[]` |
| full manifest set (any order) | no `cat=` | `null` |
| partial | `cat=cs.CV,cs.LG` | `["cs.CV","cs.LG"]` |
| full, manifest list unknown | `cat=` full list | same list |

The fourth row is the safe fallback from the first paragraph. The third row is the
normalization IMP-010 introduces: a full selection now serializes as the `null` that
means the same thing. It round-trips consistently, which is the property criterion 5
asks for — the state after a reload is the state the writer started from.

## What I changed in IMP-009's tests

IMP-009's behaviour is intact; three of its assertions encoded the *old* dead end and
had to change with it. Each is called out rather than quietly rewritten:

1. `pressedCategoryLabels` now skips the "All" chip. It means "which *category* chips are
   pressed", and every IMP-009 assertion about that is unchanged.
2. Two tests asserted the empty feed read "No papers match the current filters." at
   `#cat=cs.BI` and after that notice's reset. That generic line is exactly what
   acceptance criterion 3 replaces, so both now assert "No categories selected". The
   notice text, the reset button, its focusability, and the post-reset recovery are all
   still asserted in the same tests.
3. `#cat=cs.CV,cs.BI` + pressing `cs.LG` previously asserted `#cat=cs.CV%2Ccs.LG`. That
   selection is now the whole index, so the correct URL has no `cat=` — the assertion
   became `not.toContain("cat=")`, which is a *stronger* claim (it would catch a dropped
   unknown value, which the old exact assertion also did).

## Commands and results

All run from `web/` with timeouts.

| Command | Result |
| --- | --- |
| `npm run typecheck` (baseline) | clean, exit 0 |
| `npm test` (baseline) | **140 passed, 10 files** |
| `npm run build` (baseline) | clean, exit 0 |
| `npm run typecheck` (final) | clean, exit 0 |
| `npm test` (final) | **160 passed (10), 0 failed (10), 20 new** |
| `npm run build` (final) | `✓ 39 modules transformed`, `index-DySWJh-C.js` 166.32 kB / gzip 53.31 kB, `index-G-YE6pVt.css` 10.93 kB, built in 359ms |
| `npm test` ×12 | `160 passed` on 12/12 runs — no flakes |

### Non-vacuity check

The three source files were reverted to `HEAD` in a scratch copy under `/tmp` (new tests
kept, `node_modules` symlinked) and the suite run there:

```
Tests  21 failed | 139 passed (10)
```

21 failures across all three new suites, and **every one of the 139 pre-existing tests
still passed** against the old source — confirming the change did not silently break
IMP-008/IMP-009 tests into passing for a new reason. Of the 21, the 6 `isFullSelection`
tests fail on the missing export (correct — new function) and the rest fail on real
behaviour. Three of the four new `writeHash` tests pass against the old source by design:
they guard the `cat=` and `cat=`-empty encodings that must *not* change.

### One test-harness detail worth knowing

jsdom stores a URL ending in a bare `#` as *no fragment*, so after `writeHash` returns
`"#"` a browser reports `window.location.hash === ""` rather than `"#"`. App-level tests
therefore assert `not.toContain("cat=")` — the repo's existing idiom for this, and
strictly the more meaningful claim. The `writeHash` unit tests assert the exact `"#"`
because there the return value is read directly, not through the address bar.

## Manual verification (Playwright, real 5-category index)

`.improve/artifacts/IMP-010/`

- `feed-all-categories-desktop-1280.png` — "All" renders first, all six chips pressed.
- `feed-no-categories-selected-desktop-1280.png` — at `#cat=`: all six chips un-pressed,
  "No categories selected", "Select all categories" button, generic line gone.
- `feed-all-categories-mobile-390.png` — the extra chip wraps cleanly onto a second row at
  390px; no layout break.
- `feed-unknown-and-no-categories-desktop-1280.png` — `#cat=cs.BI`: IMP-009's notice and
  its reset intact, new state below it.

Interactions confirmed live, not just asserted:

- Deselect `cs.CV` → URL `#cat=cs.LG,cs.CL,cs.AI,cs.RO`, "All" un-pressed.
- Press "All" → URL has no `cat=`, all six chips pressed, count returns to 2812.
- At `#cat=`: button is `BUTTON`, `type="button"`, `tabIndex 0`, not disabled,
  `document.activeElement === button` after `.focus()`.
- **Real** `Enter` keypress on that focused button → URL `#`, all six chips pressed,
  2812 papers, feed fully repopulated.
- Console: no errors (only Vite HMR debug lines).

## Uncertain / for the reviewer

1. **Unknown-category overlap.** At `#cat=cs.BI` the page now shows both IMP-009's notice
   *and* the new empty state. This is required by criterion 3 as written ("when the
   selection is empty", no exception), and the two controls do different, clearly named
   things — "Reset category filter" drops the bad value, "Select all categories" drops
   the filter. It reads acceptably (see the artifact). If you would rather the empty
   state were suppressed when a notice is already explaining the cause, that is a one-line
   condition, but it would weaken criterion 3 literally.
2. **No new CSS.** The state reuses `empty` and `button`, so it matches the existing
   visual language with no `styles.css` rule. The consequence is that "Select all
   categories" is a solid dark button sitting *outside* the dashed `empty` panel (it has
   to be a sibling so it is not inside a live-region-ish container). It reads fine; I
   mention it in case you want it visually attached to the panel.
3. **`applyState`'s dependency change** from `[]` to `[manifest]` is safe today but is a
   real behavioural coupling: if anyone ever puts an `applyState`-produced value into a
   `useEffect`/`useMemo` dependency array, it will now re-run when the manifest loads.
   Not reachable in the current code.
4. I could not test the degenerate case of a manifest with **zero** categories (the "All"
   chip is then never pressed and pressing it changes nothing). No such index exists; I
   chose the safe behaviour rather than invent one.