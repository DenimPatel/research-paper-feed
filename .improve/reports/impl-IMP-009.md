# IMP-009 — Validate `#cat=` values against the manifest

## Status

Complete. All three acceptance criteria are met end-to-end and verified in a browser against a real
index build.

| Criterion | Met | Evidence |
| --- | --- | --- |
| 1. `activeCategories` is the hash ∩ `manifest.categories` | yes | `App.tsx:173-189`; component test "intersects the hash list with the manifest, not the raw hash list"; Playwright `#cat=cs.CV,cs.BI` → only `cs.CV` pressed |
| 2. Explicit "unknown category" notice naming the dropped value, with a reset | yes | `App.tsx:431-458`; 4 component tests; Playwright `#cat=cs.BI` → notice + `Reset category filter`, feed recovers on click |
| 3. `typecheck` + `test` pass | yes | `tsc --noEmit` exit 0; **140 passed / 140**, 10 files |

Baseline was 132 tests across 9 files; this item is 140 across 10 (+8 net: 11 new component tests,
−5 removed `readHash`-validation tests, +2 new `urlState` tests, and the 2 dedup/wiring adjustments —
see the test table below for the exact accounting).

## Files changed

| File | Change |
| --- | --- |
| `web/src/lib/urlState.ts` | `resolveCategories` kept and hardened; **`readHash`'s `validCategories` parameter removed**. |
| `web/src/App.tsx` | `resolveCategories` wired into render; `toggleCategory` reseeded; unknown-category notice + reset added. |
| `web/src/lib/__tests__/urlState.test.ts` | 43 → 40 tests: −5 for the removed `readHash` parameter, +2 new (no fuzzy matching, `readHash` never validates). |
| `web/src/__tests__/App.categories.test.tsx` | **new**, 11 component tests covering criteria 1, 2 and the async/failed-manifest paths. |

Nothing else was touched. `git status --porcelain`:

```
 M web/src/App.tsx
 M web/src/lib/__tests__/urlState.test.ts
 M web/src/lib/urlState.ts
?? .improve/reports/discovered-IMP-002.md   <- another agent's, not mine
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/impl-IMP-009.md
?? web/src/__tests__/App.categories.test.tsx
```

`.improve/artifacts/` is excluded by `.git/info/exclude`, so the screenshots below do not appear in
`git status`; they are on disk at `.improve/artifacts/IMP-009/`.

`styles.css` was **not** edited, and the CSS bundle is byte-identical before and after
(`index-G-YE6pVt.css` 10.93 kB, gzip 2.86 kB).

## Critical review of the earlier `resolveCategories` work

The previous attempt's lib layer was largely sound. I verified each point the brief asked about and
kept the logic; I changed the API around it, not its behaviour.

**Kept, because it is correct:**

- **`null` vs `[]` stay distinct.** `requested === null` returns `{selected: null}` before any other
  work, so `#cat=` absent (all categories) never collapses into the `[]` an explicit `#cat=` produces.
  This is load-bearing in `App.tsx`: `activeCategories` is
  `categoryResolution.selected ?? manifest?.categories ?? []`, and `??` only fires on `null`. A total
  miss therefore yields `activeCategories === []` (an explained empty feed), not a silent fall back to
  every category.
- **Malformed `manifest.categories` cannot empty every feed.** `manifest.categories` reaches the app
  through a bare `as IndexManifest` cast (`paperIndex.ts:118`, profile trap 1 / WEB-07). The
  `Array.isArray(valid) && valid.every(e => typeof e === "string" && e !== "")` guard treats anything
  else as "not known" and passes the selection through. This is a real guard, not belt-and-braces:
  `new Set("cs.CV")` yields `{"c","s",".","C","V"}`, so trusting a string payload would drop every
  selection for every user — a strictly worse blast radius than the typo being fixed.
- **De-duplication before validation**, so a repeated value cannot be reported twice in the notice.
- **Request order preserved**, not manifest order — the chips and the feed keep the link's ordering.
- **Unicode / look-alike handling is exact-match, and that is right.** I considered and rejected
  normalising: `cs.ＣＶ`, `csv`, `cs.cv` are *not* the category `cs.CV`, and fuzzy-matching them onto it
  would silently invent a filter the user never asked for — reintroducing the bug in a subtler form.
  I added a test (`does not fuzzy-match a near miss onto a category the index does have`) to pin that
  decision, because it is the non-obvious one.

**Changed — two things:**

1. **Removed `readHash`'s optional `validCategories` second parameter.** The previous report called it
   "a pure parser that validates only if the caller already holds the list", but no production caller
   ever holds it: `App.tsx:64` (`useState(() => readHash())`) and `App.tsx:76` (`hashchange`) both run
   before or independently of the manifest, and `setManifest` does not re-run `readHash`. So the
   parameter was dead in production, exercised only by tests. Worse, it was a footgun: `readHash` had
   two behaviours depending on an argument the app never passes, which invites exactly the wrong
   future fix — someone trying to wire this up by passing the manifest to `readHash`, which cannot work
   because the manifest is not there yet. Removing it makes the design decision structural instead of
   a convention: `readHash` parses the URL, `resolveCategories` validates it, one caller, one place.
   The doc comment now says so explicitly.
2. **Tightened `resolveCategories`'s `valid` parameter from `readonly string[] | unknown` to
   `readonly string[] | null | undefined`.** `| unknown` collapses the whole union to `unknown`, so
   the parameter carried no type information at all — `resolveCategories(req, 42)` compiled. It only
   existed so tests could pass a malformed value without a cast. The runtime guard is unchanged and
   still tested; the malformed cases now reach it through explicit `as unknown as string[]` casts in
   the tests, which is where a deliberate lie about a type belongs.

**Kept as-is, flagged as a judgment call:** an *empty* `manifest.categories` (`[]`) is treated as
authoritative — everything requested becomes unknown — rather than as "not known yet".
`build_index.py:189` writes `list(categories or DEFAULT_CATEGORIES)`, so a real build cannot emit `[]`.
The alternative reading would silently preserve this bug on a malformed manifest, which is the exact
failure mode this item exists to remove.

## Where the intersection lives, and why

**In a render-time `useMemo` at the call site in `App.tsx`, not in `readHash`.**

```tsx
const categoryResolution = useMemo(
  () => resolveCategories(urlState.categories, manifest?.categories),
  [urlState.categories, manifest],
);
const activeCategories =
  categoryResolution.selected ?? manifest?.categories ?? [];
const unknownCategories = categoryResolution.unknown;
```

The manifest loads asynchronously, and that single fact decides everything:

- `readHash` cannot validate, ever, because at both of its call sites the manifest is `null` and will
  always be `null` there. Validation inside `readHash` would require either blocking first paint on a
  network round trip, or adding a second effect that re-parses the hash when `setManifest` lands.
  Either way the app blocks on the fetch, which is the deep-link failure the brief forbids.
- A render-time `useMemo` gets it for free: the very render that `setManifest` triggers re-derives
  the intersection. No second fetch, no awaited parse, no effect, no extra render pass, no promise.
- While the request is in flight `manifest?.categories` is `undefined`, so `resolveCategories` passes
  the selection through untouched. If the fetch **fails**, `manifest` stays `null` forever and the
  existing `panel--error` panel renders — the hash is left completely alone. Neither path can blank
  the feed or strand the deep link. Both are asserted (`keeps the deep link working while the index
  is still in flight`, `leaves the hash and the error panel alone when the index never loads`).
- Making `activeCategories` the *single* validated value is what keeps the three consumers from
  disagreeing. `FeedControls` chips, the `visiblePapers` filter and `toggleCategory` all read it.

**`toggleCategory` had to change too.** The previous report claimed `App.tsx:228`
(`const current = urlState.categories ?? activeCategories`) would reinstate the bug. I verified that
claim against the current file: the line was still exactly as described, at exactly that line number.
It is fixed, by seeding from `activeCategories` (which now *is* `selected ?? manifest.categories ?? []`)
instead of the raw hash list. Without it, deselecting the one visible chip from `#cat=cs.CV,cs.BI`
computes `["cs.CV","cs.BI"].filter(c => c !== "cs.CV")` → `["cs.BI"]` and writes the dropped,
unpressable value straight back into the URL — on the very next click, right after the UI has told the
user `cs.BI` is unknown. `never puts the dropped value back into the URL` fails without this fix.

## How criterion 2's notice is implemented

Rendered in `App.tsx` beside the existing `error` banner, inside the `manifest &&` block, whenever
`unknownCategories.length > 0`:

```tsx
{unknownCategories.length > 0 && (
  <p className="banner banner--warning" role="alert">
    <strong>
      Unknown categor{unknownCategories.length === 1 ? "y" : "ies"}:{" "}
      {unknownCategories.join(", ")}.
    </strong>{" "}
    {activeCategories.length === 0
      ? "This index does not have that category, so nothing can match."
      : "This index does not have that category, so those papers are hidden."}{" "}
    <button
      type="button"
      className="button button--ghost"
      onClick={resetUnknownCategories}
    >
      {activeCategories.length === 0
        ? "Reset category filter"
        : "Keep only indexed categories"}
    </button>
  </p>
)}
```

Design decisions, each with a reason:

- **It fires on a partial drop, not only a total one.** Criterion 2's text says "and none of them
  survive", but the item's own verification method requires `#cat=cs.CV,cs.BI` to *report* `cs.BI` as
  unknown, which is a partial drop. The strict reading would fail the stated verification. Suppressing
  it on a partial drop would also leave the user unable to see why some papers are hidden.
- **`role="alert"`**, matching the existing `error` banner at `App.tsx:426` and the
  `panel panel--error` retry panel at `App.tsx:339` — both of which already put a focusable button
  inside a `role="alert"`, so this follows the app's established pattern rather than inventing one.
  `role="status"` is used elsewhere for the non-urgent loading and result counts; a dead-end deep link
  is not non-urgent.
- **A real `<button type="button">`** with visible text as its accessible name, keyboard reachable and
  not disabled. The test asserts `tagName === "BUTTON"`, `type === "button"`, not disabled, and that
  `.focus()` moves `document.activeElement` onto it — the same assertions `App.retry.test.tsx` makes
  for the Try again button.
- **CSS: reused, none added.** `banner banner--warning` for the container and `button button--ghost`
  for the action are both already in `styles.css`, so the off-limits file is untouched. `button--ghost`
  (white surface, `--text` label) on the soft warning background reads as a secondary action, which is
  the right hierarchy next to the alert's own copy. The one thing I could not express without CSS is a
  flex row that keeps the copy and the button baseline-aligned at desktop width; at 1280 px they sit
  inline and at 390 px the button wraps below the text. Both look correct in the screenshots, so this
  is not worth a `styles.css` edit. Verified visually at both widths.
- **The reset keeps the categories the index does have:**

  ```tsx
  categories: activeCategories.length > 0 ? activeCategories : null
  ```

  The partial case drops only the unknown value (`#cat=cs.CV,cs.BI` → `#cat=cs.CV`, chip still pressed,
  filter preserved). The total-miss case falls back to `null` — "all categories" — because the
  surviving list is empty and writing `#cat=` would be an empty-feed trap all by itself (that is
  WEB-17, IMP-010's territory, not this item's to solve). `null` also removes `cat=` from the URL
  entirely via `writeHash`, which is the direction IMP-010 wants.
- **No notice when the hash named no category.** `resolveCategories(null, …)` returns
  `unknown: []`, so a plain feed and an explicit `#cat=` both render no alert. Asserted.

## Tests

`web/src/lib/__tests__/urlState.test.ts` — 43 → **40**.

| Change | Tests |
| --- | --- |
| removed (the `readHash(hash, validCategories)` parameter is gone) | `passes categories through untouched when the manifest is not in hand`, `drops categories the manifest does not list when it is supplied`, `keeps every category the manifest lists`, `leaves the other parameters alone while validating cat`, `round-trips a sanitized hash so the URL self-heals on the next write` |
| added | `never validates cat, because the manifest is not in hand yet` (pins the parser's new contract), `does not fuzzy-match a near miss onto a category the index does have` |
| kept from the earlier attempt | the 19 `resolveCategories` / dedup tests, re-cast for the tightened signature |

`web/src/__tests__/App.categories.test.tsx` — **new, 11 tests**, three describes:

- *a deep link naming a category the index does not have*: intersection is observable on the next
  chip press; the dropped value is named; the link works while the index is in flight; a failed index
  leaves the hash and error panel alone; deselecting the visible chip does not reinstate `cs.BI`.
- *a deep link naming only unknown categories*: notice names `cs.BI` with a real, focusable, named
  reset button instead of a bare empty state; clicking it recovers the whole feed; the partial reset
  clears only the unknown value; multiple dropped values are all named and nothing else is.
- *hashes that name no category*: no false-positive notice on a plain feed; no notice for `#cat=`.

### Non-vacuity

Scratch copy at `/tmp/rpf-imp009` (`node_modules` symlinked, `App.tsx` and `urlState.ts` restored
from `HEAD`, new test file copied in):

| Suite | Fixed | Against `HEAD` |
| --- | --- | --- |
| `App.categories.test.tsx` (11) | 11 pass | **8 fail, 3 pass** |
| `urlState.test.ts` (40) | 40 pass | **15 fail, 25 pass** |

The 3 that pass pre-fix are intentional no-false-positive guards that assert the *absence* of
behaviour — `leaves the hash and the error panel alone when the index never loads`, `shows no
unknown-category notice for a plain feed`, `does not claim anything about an explicit empty
selection`. They must pass before the fix or they would assert nothing. The 25 in `urlState.test.ts`
are the pre-existing `readHash`/`writeHash` tests plus the two pass-through pins.

One of my own tests was vacuous on the first pass and I fixed it. `intersects the hash list with the
manifest…` originally asserted only that `cs.CV` was pressed and the `cs.LG` paper was hidden — which
is **identical before and after the fix**, because the chips are drawn from `manifest.categories` and
an unknown value is in neither list. That is precisely the symptom the backlog item describes, and it
cannot distinguish fixed from broken. The test now presses a second chip, which is where the
intersection becomes observable: fixed yields `#cat=cs.CV%2Ccs.LG`, unfixed yields
`#cat=cs.CV%2Ccs.BI%2Ccs.LG`. It fails pre-fix.

## Commands and results

All from `web/`. `timeout` is not available on this machine (`zsh: command not found: timeout`); each
command was run directly with the tool's own timeout, and every one finishes in ~2 s or less.

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0, no output |
| `npm test` (baseline, before any of my edits) | 9 files, **132 passed** |
| `npm test` (after) | 10 files, **140 passed, 0 failed** |
| `npm test` × 6 consecutive | 140, 140, 140, 140, 140, 140 — identical every run |
| `npx vitest run --sequence.shuffle --sequence.seed=137/274/411` | 140, 140, 140 — no order dependence |
| `npm run build` | 39 modules; `index.html` 1.00 kB (gzip 0.52), CSS 10.93 kB (gzip 2.86, **unchanged**), JS 165.57 kB (gzip 53.15), built in 353 ms |

The 9 consecutive runs (6 plain + 3 shuffled) are the flake check the brief asked for. No test uses a
timer, a random value, a real network call or a wall-clock assertion; every one waits on a Testing
Library query, so there is nothing in the new file that can drift. The shuffle runs specifically rule
out cross-file `window.location.hash` contamination, which was the plausible flake vector here.

## Playwright evidence

`npm run preview -- --port 5199 --strictPort`, serving the real `web/public/data/` index (2,812
papers, `categories: [cs.CV, cs.LG, cs.CL, cs.AI, cs.RO]`). Port 5199 matches the item's verification
method. Server stopped afterwards.

**`#cat=cs.CV,cs.BI` (partial — criterion 1 + the notice)**

- Chips: `cs.CV` `[pressed]`, all four others unpressed. Only `cs.CV`.
- `role="status"`: **783 papers match** (a real `cs.CV` result, not an empty feed).
- `role="alert"`: `Unknown category: cs.BI. This index does not have that category, so those papers are
  hidden.` with a `Keep only indexed categories` button.
- Console: **zero messages, zero errors** across the whole session.

**`#cat=cs.BI` (total miss — criterion 2)**

- No chips pressed. `0 papers match`.
- `role="alert"`: `Unknown category: cs.BI. This index does not have that category, so nothing can
  match.` with a `Reset category filter` button — the notice replaces the bare
  "No papers match the current filters." as an explanation, not as a replacement for it.
- **Clicked `Reset category filter`:** URL went `#cat=cs.BI` → `#`, all five chips pressed,
  `2812 papers match`, papers rendered, alert gone. Feed fully recovered.

**Partial reset, clicked:** `#cat=cs.CV,cs.BI` → `#cat=cs.CV`, `cs.CV` stays pressed, notice gone, 50
cards rendered.

**`hashchange` path:** setting `location.hash` at runtime (rather than reloading) re-derives the
intersection correctly, confirming the `hashchange` listener still works with the fix in place.

### Artifacts

| File | Size | Case |
| --- | --- | --- |
| `.improve/artifacts/IMP-009/feed-unknown-category-desktop-1280.png` | 1280×900 | `#cat=cs.BI` — the required artifact; the canonical criterion-2 case, where the notice replaces a bare empty state |
| `.improve/artifacts/IMP-009/feed-unknown-category-mobile-390.png` | 390×844 | `#cat=cs.BI` |
| `.improve/artifacts/IMP-009/feed-unknown-category-partial-desktop-1280.png` | 1280×900 | `#cat=cs.CV,cs.BI` — the partial case, showing a pressed chip *and* a non-empty feed *and* the notice |
| `.improve/artifacts/IMP-009/feed-unknown-category-partial-mobile-390.png` | 390×844 | `#cat=cs.CV,cs.BI` |

Viewport-sized, matching every file in `.improve/artifacts/baseline/` (1280×900 / 390×844).

### Compared against `.improve/artifacts/baseline/`

Against `baseline-feed-desktop-1280.png`, `baseline-feed-mobile-390.png`,
`baseline-feed-no-categories-selected-desktop-1280.png` and
`baseline-feed-index-missing-desktop-1280.png`: header, nav, hero, the controls card (search box,
category/recency/sort chips, muted count line), card styling, footer and spacing are unchanged. The
`cs.CV` active-chip treatment, the disabled `Relevance` chip and its hint are identical. The only new
element is the warning banner between the controls and the paper list; on the `index-missing` baseline
the corresponding slot is empty, which is where the notice now sits. No reflow, no shifted baselines,
no console errors.

## Uncertain / for the verifier to push on

1. **`#cat=` (explicit empty) still renders a bare empty feed.** `resolveCategories([], …)` returns
   `{selected: [], unknown: []}` — the hash requested zero categories, so there is nothing to report
   as unknown, and the notice correctly stays silent. The empty feed there is WEB-17, which
   `discovered-IMP-009.md` assigns to IMP-010. I deliberately did not collapse `[]` into `null`, because
   that would decide IMP-010's question for it.
2. **The notice shows on partial drops**, which is stricter than criterion 2's literal wording. This is
   forced by the item's own verification method. If a reviewer wants it only on total failure, that is a
   one-line change to the condition — but then `#cat=cs.CV,cs.BI` stops reporting `cs.BI`, which the
   verification method explicitly requires.
3. **The `toggleCategory` fix is outside criterion 1's literal text** and is not listed in the
   acceptance criteria. It is included because without it the fix is undone by the very next click —
   see `discovered-IMP-009.md` §1, which predicted this and which I confirmed still applied verbatim at
   `App.tsx:228` before I edited it.
4. **`resolveCategories` still has no caller other than `App.tsx` and its tests.** That is the point of
   the split, but it does mean the function is currently only as trustworthy as its one call site.
5. **`manifest.categories` remains unvalidated at the source** (`paperIndex.ts:118`, bare cast).
   `resolveCategories` defends its own call site; the general fix — validating the manifest shape —
   is still open and belongs to whoever owns WEB-07.
