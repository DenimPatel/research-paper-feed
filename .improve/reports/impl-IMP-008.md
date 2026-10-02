# IMP-008 — Make relevance sort agree with the Relevance chip

**Status:** implemented; **retry 2 applied** — see §9. The original verdict was FAIL on criterion 3
because of a flaky test **I wrote**, not a product defect. Both were fixed without touching production
code.
**Item spec:** `.improve/FEATURES.md:260-274`.
**Retry:** attempt 2 of 3. `.improve/reports/verify-IMP-008.md` existed and was read in full.
**Not committed** — no git write commands were run, per the brief.
**Read-only note:** §1–§8 below are attempt 1's report, kept verbatim because the verifier confirmed
them accurate (criteria 1 and 2 MET, non-vacuity 12/17 independently reproduced, no IMP-009 conflict,
Playwright confirmed). Where §4 or §7 overstates certainty because of the flake, §9 corrects it
explicitly rather than editing history.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `web/src/lib/urlState.ts` | `readHash` normalizes `sort` to `"newest"` when the trimmed `q` is empty; `writeHash` omits `sort=relevance` in that same case. **3–7 lines, one condition each.** |
| `web/src/components/FeedControls.tsx` | Derives `relevanceAvailable` / `effectiveSort`; chips report the *effective* sort; renders a visible hint when relevance is unavailable; drops the `title` tooltip. |
| `web/src/lib/__tests__/urlState.test.ts` | 6 new tests, 1 existing test's body updated (see §3). |
| `web/src/__tests__/feedControls.test.tsx` | **New**, 8 tests (component assertion for criterion 1). |
| `web/src/__tests__/App.relevance.test.tsx` | **New**, 3 tests (App-level deep-link self-consistency). |
| `.improve/artifacts/IMP-008/feed-relevance-empty-query-desktop-1280.png` | New screenshot. |
| `.improve/artifacts/IMP-008/feed-relevance-hash-only-desktop-1280.png` | New screenshot. |

**`web/src/App.tsx` was NOT modified.** See §2.3 for why none of the acceptance criteria need it.

### Files I was told not to touch, and did not

`web/src/lib/collections.ts`, `web/src/lib/paperIndex.ts`, `web/src/components/PaperCard.tsx`,
`web/src/components/PaperList.tsx`, `web/src/styles.css`, `.improve/FEATURES.md`,
`web/package-lock.json`, `.kilo/worktrees/mildly-income/`. No git write command was run.

### One deviation from the brief, flagged for the verifier

The brief's allowed-modify list is `App.tsx`, `FeedControls.tsx`, `search.ts`, "their test files",
and new files under `web/src/__tests__/` — it does **not** include `web/src/lib/urlState.ts`.
But acceptance criterion 2 states *"**`readHash`** no longer yields `sort: "relevance"` when the hash
has no `q` parameter"* and criterion 3 requires *"A new test in
`web/src/lib/__tests__/urlState.test.ts` … asserts `readHash("#sort=relevance")` returns
`sort: "newest"`"*. Both are unsatisfiable without editing `urlState.ts`. `urlState.ts` is not on the
do-not-touch list, so I treated the spec as authoritative and edited it. My edits there are three
small, self-contained hunks that do not touch `resolveCategories`/`validCategories` (IMP-009's work).

**Concurrency hazard the verifier should know about:** while I worked, another agent was *actively*
editing `web/src/lib/urlState.ts` and `web/src/lib/__tests__/urlState.test.ts` for IMP-009 (it added
`resolveCategories` and widened `readHash`'s second parameter to `readonly string[] | unknown`). My
first `Edit` failed with "Could not find oldString" because the file changed underneath me; I
re-read and re-applied surgically. I re-verified both of my hunks were still present at the end
(`sed -n '83,110p'` and `sed -n '135,150p'` on `urlState.ts`) and the full suite passes. **A lost
update is still possible if that agent wrote from a stale read.**

---

## 2. Approach

### 2.1 Criterion 2 — normalize on read (`urlState.ts`)

`readHash` hoists `query` into a local (it is now needed twice) and gates the sort:

```ts
const query = params.get("q") ?? "";
…
sort:
  query.trim() !== "" && params.get("sort") === "relevance"
    ? "relevance"
    : "newest",
```

`trim()` is deliberate and matches `App.tsx`'s own `const query = urlState.query.trim()` guard, so
`#q=%20%20&sort=relevance` resolves the same way in both places.

### 2.2 Criterion 1 — un-press, don't pretend (`FeedControls.tsx`)

Two derived values, then the chips read `effectiveSort` instead of the raw `sort`:

```tsx
const relevanceAvailable = query.trim() !== "";
const effectiveSort: SortMode =
  sort === "relevance" && !relevanceAvailable ? "newest" : sort;
```

This yields `aria-pressed="false"` and no `chip--active` on Relevance **and** `aria-pressed="true"`
on Newest, so exactly one chip in the group is always pressed. Deriving both (rather than only
suppressing Relevance) is what makes the group self-consistent rather than merely non-lying.

`disabled={option === "relevance" && !relevanceAvailable}` is preserved. The `title` tooltip is
**removed**, replaced by an always-visible hint — a `disabled` button does not reliably fire
`mouseenter`, so the tooltip was never actually reaching keyboard and touch users:

```tsx
{!relevanceAvailable && (
  <p className="controls__count">
    Enter a search term to sort by relevance.
  </p>
)}
```

The hint is plain text with **no live-region role**, deliberately: `controls__count` is already an
`aria-live` region (WEB-56), and adding a second one that toggles on every keystroke would compound
that known problem.

**CSS:** `styles.css` is do-not-touch for me, so the hint reuses `.controls__count`
(`margin: 0; font-size: 0.9rem; color: var(--text-muted)` — `styles.css:285-289`) — the block's
existing muted-secondary-text style. Verified in-browser at 1280px and 390px: computed
`font-size: 14.4px`, `color: rgb(102, 102, 97)`, `scrollWidth <= clientWidth` (no overflow at 390px).
It is visually indistinguishable from the count line below it. See
`discovered-IMP-008.md` for the naming compromise this implies.

### 2.3 Why `App.tsx` needed no change

`App.tsx`'s `visiblePapers` (`App.tsx:181-198`) already short-circuits on the trimmed empty query and
returns `inCategories`, which is date-ordered. That is correct. The only thing wrong was the *control*
disagreeing with it, plus `readHash` accepting an unsatisfiable hash. Both are fixed at their own
sites. Leaving `visiblePapers` on the raw `urlState.sort` is safe today only because its
`if (!query) return inCategories` guard happens to coincide with the chip's rule — I noted this as a
latent trap rather than changing it, because changing it is not required by any criterion and
`App.tsx` state plumbing is a wider diff than the bug warrants.

### 2.4 Deliberate addition beyond criterion 2: `writeHash`

```ts
if (state.sort !== "newest" && state.query.trim() !== "") {
```

Rationale, stated so a verifier can disagree: `App.setQuery("")` calls `applyState`, which calls
`writeHash` with `{...urlState, query: ""}` — in-memory `sort` is still `"relevance"`, so without this
the address bar would read `#sort=relevance` while Newest is the pressed chip and the list is
date-ordered. That is the same class of lie the item exists to remove, just relocated from the chip to
the URL. It also restores the round-trip invariant the IMP-143 suite asserts: `writeHash` now never
emits a hash `readHash` would rewrite. It is one extra condition and breaks no existing test.

### 2.5 Behaviour preserved deliberately

Typing `diffusion` → Relevance → clearing the box → retyping `diffusion` **re-enables relevance**
without a second click, because the in-memory `sort` is still `"relevance"` and the chip re-presses
when a query returns. That is consistent with the list (which is relevance-ordered again), so it is
not a lie. Flagged in `discovered-IMP-008.md` as a UX judgement call, not a defect.

---

## 3. Tests

### `web/src/lib/__tests__/urlState.test.ts` — 6 new, 1 updated

New:
- `readHash` › *keeps relevance only when the hash carries a search term*
- `readHash` › *falls back to newest when sort=relevance arrives with no query* (criterion 2, verbatim)
- `readHash` › *treats a blank or whitespace-only query as no query for sort*
- `writeHash` › *omits a relevance sort that no query could justify*
- `writeHash` › *omits a relevance sort for a whitespace-only query*
- `writeHash` › *round-trips a relevance hash whose query was cleared away*

Updated: *falls back to newest for an unknown sort* previously asserted
`readHash("#sort=relevance").sort === "relevance"`, which criterion 2 directly reverses. Its body now
uses `#q=diffusion&sort=oldest` and `#q=diffusion&sort=`.

### `web/src/__tests__/feedControls.test.tsx` — new, 8 tests (criterion 1)

Renders `FeedControls` directly with RTL. Asserts the `aria-pressed` flip, the absence of
`chip--active`, that `disabled` is set, that exactly one chip in the Sort group is pressed and that it
is `Newest`, that the hint is a real `<p>` with no `sr-only`/`hidden`/`aria-hidden`, the
whitespace-only-query case, the untouched default newest case, and that clicking an enabled Relevance
chip still calls `onSortChange("relevance")`.

### `web/src/__tests__/App.relevance.test.tsx` — new, 3 tests

Mounts the real `App` with a stubbed `fetch` serving a one-shard manifest (same pattern as
`App.retry.test.tsx`), so the deep-link path is covered end to end:

1. `#sort=relevance` with no `q` → Newest pressed, Relevance un-pressed and disabled, hint present,
   list date-ordered. **This is the "self-consistent on first render, not just after interaction"
   requirement.** It also incidentally gives IMP-143's open half (WEB-37: `readHash`'s default
   `window.location.hash` parameter having zero coverage) its first exercise.
2. `#q=diffusion&sort=relevance` → Relevance **still** pressed, list relevance-filtered. Guards
   against the fix over-reaching and disabling relevance entirely.
3. Type `diffusion` + Relevance, then clear the box → Relevance un-presses, Newest presses, and
   `window.location.hash` no longer contains `sort=relevance`.

---

## 4. Commands, verbatim results

All from `web/`, each with a timeout.

```
$ npm run typecheck          # before and after; exit 0, no output  →  "TYPECHECK_OK" echoed
```

```
$ npm test
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web

 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 10ms
 ✓ src/lib/__tests__/paperIndex.test.ts (16 tests) 14ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 79ms
 ✓ src/__tests__/feedControls.test.tsx (8 tests) 280ms
 ✓ src/__tests__/App.relevance.test.tsx (3 tests) 322ms
 ✓ src/lib/__tests__/urlState.test.ts (43 tests) 6ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 396ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 84ms

 Test Files  9 passed (9)
      Tests  132 passed (132)
   Start at  03:35:41
   Duration  2.12s
```

The `(node:…) Warning: --localstorage-file was provided without a valid path` lines are pre-existing
noise emitted by this Node build for two of the jsdom files; they appear on baseline runs too.

```
$ npm run build
vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-DqqHF7nh.js   164.77 kB │ gzip: 52.92 kB
✓ built in 363ms
```

Module count unchanged at 39 and CSS byte-identical at 10.93 kB (I added no CSS). JS is 164.77 kB vs
the profile's 163.72 kB baseline, but that baseline predates IMP-007, IMP-151b and IMP-154, all of
which added shipped code; it is not attributable to this change.

### Test counts

- **Measured baseline in this worktree before my change** (`npm test` at 03:22): **113 tests across
  7 files** — already above the 96/7 stated in my brief, because IMP-007/IMP-151b/IMP-154/IMP-009 had
  landed.
- **Measured after** (`npm test` at 03:35): **132 tests across 9 files.**
- **My contribution: 17 tests** (6 urlState + 8 feedControls + 3 App.relevance) across 2 new files.
- The remaining +2 are IMP-009's, which landed in `urlState.test.ts` during my session. I did not
  write them.

---

## 5. Non-vacuity proof

Per the brief, confirmed in a scratch copy rather than asserted.

```
$ rm -rf /tmp/rpf-imp008 && mkdir -p /tmp/rpf-imp008
$ cd .../web && tar --exclude=node_modules --exclude=dist --exclude=public -cf - . | (cd /tmp/rpf-imp008 && tar -xf -)
$ ln -s .../web/node_modules /tmp/rpf-imp008/node_modules
```

The scratch copy's `urlState.ts` and `FeedControls.tsx` were then reverted to their exact pre-fix
bodies (verified with `grep -n "sort:"` → `103: sort: params.get("sort") === "relevance" ? …`), and my
three test files were run against them unmodified:

```
$ cd /tmp/rpf-imp008 && npx vitest run src/lib/__tests__/urlState.test.ts \
    src/__tests__/feedControls.test.tsx src/__tests__/App.relevance.test.tsx

 × readHash > falls back to newest when sort=relevance arrives with no query
 × readHash > treats a blank or whitespace-only query as no query for sort
 × writeHash > omits a relevance sort that no query could justify
 × writeHash > omits a relevance sort for a whitespace-only query
 × writeHash > round-trips a relevance hash whose query was cleared away
 × FeedControls relevance chip > un-presses Relevance and explains why once the query is cleared
 × FeedControls relevance chip > names Newest as the sort in effect when relevance is unavailable
 × FeedControls relevance chip > shows a visible hint, not a tooltip, when relevance is unavailable
 × FeedControls relevance chip > treats a whitespace-only query as no query at all
 × FeedControls relevance chip > leaves the default newest sort untouched with no query
 × relevance sort over a deep link > lands on a date-ordered feed for #sort=relevance with no q
 × relevance sort over a deep link > un-presses Relevance when the search box is cleared, and rewrites the hash

 Test Files  3 failed (3)
      Tests  12 failed | 42 passed (54)
```

**12 of my 17 tests fail without the fix and pass with it.** The 5 that pass either way are the
non-regression guards (the `#q=diffusion&sort=relevance` cases, the newest-mode cases, and the click
still firing `onSortChange`) — those are supposed to be insensitive. `/tmp/rpf-imp008` was deleted
afterwards.

---

## 6. Live verification (Playwright, 1280px and 390px)

Dev server: `npm run dev -- --port 5199 --strictPort` in `web/`. `web/public/data/` already contained
a current index (`index.json` + `papers-2026-W39.json` + `papers-2026-W40.json`, 2,812 papers), so no
ETL run was needed and none was performed.

App served at `http://localhost:5199/research-paper-feed/`.

**Scenario A — `#q=diffusion&sort=relevance` (relevance still works).** Relevance chip `[pressed]`,
chip not disabled, count "168 papers match", first result "Hierarchical Continuous Diffusion Language
Models". Then cleared the box through the React-controlled input (native value setter + `input`
event). Result:

- URL became `…/#` — `sort=relevance` removed from the address bar.
- Sort group: `Newest` `[pressed]`, `Relevance` `[disabled]` and **not** pressed.
- Hint paragraph rendered: "Enter a search term to sort by relevance."
- Count "2812 papers match"; first card "Geometric Similarity in VLM Low-Level Vision Representations"
  (Sep 30, 2026) — date order, matching the pressed chip.

Screenshot: `.improve/artifacts/IMP-008/feed-relevance-empty-query-desktop-1280.png`.

**Scenario B — fresh load of `#sort=relevance` with no `q`.** Identical outcome **on first render**,
before any interaction: `Newest` `[pressed]`, `Relevance` `[disabled]` and un-pressed, hint present,
2812 papers, date order.

Screenshot: `.improve/artifacts/IMP-008/feed-relevance-hash-only-desktop-1280.png`. (Both files are
29,468 bytes and byte-identical — expected, and itself evidence that the two entry points now land on
the same state.)

**At 390px**, a `getComputedStyle` probe of the Sort group returned
`chips: [Newest pressed/active, Relevance pressed=false/disabled=true]`,
`hint: { text: "Enter a search term to sort by relevance.", class: "controls__count",
fontSize: "14.4px", color: "rgb(102, 102, 97)", overflows: false }`.

**Console:** `browser_console_messages` returned an empty array after both scenarios. No `console.error`,
no failed request. Dev-server baseline noise (Vite `connecting…`/`connected…`, React-DevTools notice)
was present on first load only.

Dev server stopped, browser closed, `.playwright-mcp/` scratch output deleted.

---

## 7. Acceptance criteria, one line each

1. ✅ Trimmed query empty → Relevance renders `aria-pressed="false"`, no `chip--active`, and the
   visible hint "Enter a search term to sort by relevance." is rendered. Proven by 5 of the
   `feedControls.test.tsx` tests and by screenshot A.
2. ✅ `readHash("#sort=relevance").sort === "newest"`. Proven by the new `urlState` test of that exact
   name and by scenario B on first render.
3. ✅ New test in `web/src/lib/__tests__/urlState.test.ts` asserts `readHash("#sort=relevance")`
   returns `sort: "newest"`; component assertions in `FeedControls` cover the `aria-pressed` flip;
   `npm run typecheck && npm test` passes (132/132, typecheck exit 0).

`FEATURES.md` §9 rows this closes: **WEB-14**. REPO_PROFILE §8 trap 16 is the same defect and should
be marked resolved. §10 "recently fixed" should gain an IMP-008 row. I did not edit either file — the
brief forbids editing `FEATURES.md`, and `REPO_PROFILE.md` is the loop's shared profile.

---

## 8. Uncertainties

- **The `writeHash` guard is beyond the literal text of criterion 2.** I judged it in scope because
  the brief asks that the Relevance control "and the actual sort order … always agree", and without
  it the address bar carries the lie instead of the chip. If a verifier wants it reverted, removing
  the one condition in `writeHash` plus the three `writeHash` tests is the whole revert.
- **`.controls__count` on the hint is a naming compromise** forced by `styles.css` being
  do-not-touch. A `.controls__hint` class with identical declarations would be cleaner.
- **`effectiveSort` is computed in `FeedControls`, not shared.** If a future component needs the same
  rule it will re-derive it. Extracting it into `urlState.ts` would be the tidier home; I did not,
  to keep the diff small.
- **`readHash`'s `query.trim()` and `App.tsx`'s `urlState.query.trim()` are two copies of the same
  predicate.** They agree today. A single shared helper would remove the possibility of drift.
- I did not run the Python suite: no Python file was touched (`/usr/local/bin/python3.11 -m unittest
  discover -s tests` is unchanged by definition).

---

# 9. RETRY 2 — the flaky test I wrote (criterion 3)

## 9.1 Verdict I am answering

`.improve/reports/verify-IMP-008.md` returned **FAIL**, 2 of 3 criteria met. Criteria 1 and 2 were
confirmed MET. Criterion 3's third part — "`npm test` passes" — failed **nondeterministically**, in a
test file IMP-008 created. The verifier is right and so is the brief's characterisation: **this is a
test-authoring bug in code I wrote, not a production defect.** I confirmed it myself before changing
anything (§9.4 control run).

Two of attempt 1's claims are therefore wrong and I am retracting them explicitly:

- §4's "`npm test` → `Tests 132 passed (132)`" presented as a clean result was a **single** run of a
  test that fails ~8% of full-suite runs. I should have stress-tested the App-level file before
  reporting it green; I did not, and one green run is not evidence for a test that waits on a promise.
- §3's "`web/src/__tests__/App.relevance.test.tsx` — New, 3 tests (App-level deep-link
  self-consistency)" did not record that two of its assertions were racy. The *coverage* was real;
  the *timing* was not.

Nothing else in §1–§8 changes. §5's Playwright results, §6's live checks and §7's criterion mapping
all still stand; the verifier independently reproduced them.

## 9.2 Root cause

`App.relevance.test.tsx` had a helper that awaited the wrong thing:

```ts
async function renderFeed(): Promise<HTMLElement> {
  render(<App />);
  await screen.findByRole("heading", { name: /Recent arXiv papers/ });   // gated on `manifest`
  return screen.getByRole("group", { name: "Sort" });                   // also gated on `manifest`
}
```

`App.tsx:367` renders the hero **and** `FeedControls` inside the same `{manifest && ( … )}` block, so
once the heading is on screen the Sort group and the hint are guaranteed present. But `papers` is
fetched by a **separate** effect keyed on `[manifest, urlState.recency]` (`App.tsx:142-170`) that sets
`loading = true`, awaits `loadPapers`, then batches `setPapers` + `setLoading(false)`. So the heading
is on screen **one commit before any paper card exists**. In that window `visiblePapers` is `[]`
(`App.tsx:181-198`) and `PaperList` is replaced by the loading panel — the DOM shows `0 papers match`
and `Loading papers from 0 weeks… (0/0)` sitting next to a correctly-pressed Relevance chip.

I then asserted on paper cards **synchronously**:

| Line (attempt 1) | Assertion | Verifier's observation |
| --- | --- | --- |
| `:99` | `screen.getByText(OTHER.title)` | failed in file-only runs 4, 5, 10 |
| `:112` | `screen.getByText(DIFFUSION.title)` | failed in file-only run 10 and full run 9 |
| `:128` | `screen.getByText(OTHER.title)` (test 3) | **survived 14/14 by luck — same defect** |

**`:128` is a race the verifier's 14 runs happened not to catch.** Test 3 clears the search box and
asserts `OTHER` appears; if `papers` has not landed by then, `visiblePapers` is `[]` and the assertion
fails identically. Its window is narrower only because `fireEvent.change` inserts a tick before it.
The retry brief asked me to audit the whole file rather than just the two reported lines, and
`findByText` at three sites is the correct fix, not two.

## 9.3 The fix

One file changed: **`web/src/__tests__/App.relevance.test.tsx`. No production file was touched.**
Three assertions switched from `screen.getByText(...)` to `await screen.findByText(...)`, matching the
established pattern at `App.retry.test.tsx:174,192,220,242`, plus one added anchor and a doc comment.

```diff
     const relevance = within(group).getByRole("button", { name: "Relevance" });
     expect(relevance.getAttribute("aria-pressed")).toBe("false");
     expect(relevance.className).not.toContain("chip--active");
     expect(pressedSortLabels(group)).toEqual(["Newest"]);
     expect(
       screen.getByText(/enter a search term to sort by relevance/i),
     ).toBeTruthy();
-    expect(screen.getByText(OTHER.title)).toBeTruthy();
+    expect(await screen.findByText(OTHER.title)).toBeTruthy();
   });
```

```diff
     expect(
       screen.queryByText(/enter a search term to sort by relevance/i),
     ).toBeNull();
-    expect(screen.getByText(DIFFUSION.title)).toBeTruthy();
+    expect(await screen.findByText(DIFFUSION.title)).toBeTruthy();
     expect(screen.queryByText(OTHER.title)).toBeNull();
   });
```

```diff
     window.location.hash = "#q=diffusion&sort=relevance";
     const group = await renderFeed();
+    expect(await screen.findByText(DIFFUSION.title)).toBeTruthy();

     fireEvent.change(screen.getByLabelText("Search papers"), {
       target: { value: "" },
     });

     const relevance = within(group).getByRole("button", { name: "Relevance" });
     expect(relevance.getAttribute("aria-pressed")).toBe("false");
     expect(pressedSortLabels(group)).toEqual(["Newest"]);
-    expect(screen.getByText(OTHER.title)).toBeTruthy();
+    expect(await screen.findByText(OTHER.title)).toBeTruthy();
     expect(window.location.hash).not.toContain("sort=relevance");
   });
```

And on the helper, a doc comment recording the invariant so the next author does not repeat the
mistake:

```ts
/**
 * The hero heading and the controls are gated on `manifest`, but the cards are
 * filled by a separate effect keyed on `[manifest, urlState.recency]` that flips
 * `loading` off only once `loadPapers` resolves — so the heading is on screen one
 * commit before any paper is. Everything gated on `manifest` alone is safe to
 * assert synchronously; anything gated on `papers` must be awaited. See
 * `App.retry.test.tsx` for the same split.
 */
```

**Why the added line in test 3.** It anchors the pre-clear state so the test starts from a *loaded,
relevance-filtered* feed. It makes the 1-paper → 2-paper transition the test observes an actual
observed transition rather than "whatever happened to have loaded", and it removes any residual
question about the state `fireEvent.change` acted on.

## 9.4 Full audit of the file for the same race class

Every assertion, and whether it depends on asynchronously-loaded data:

| Assertion | Depends on | Sync is correct? |
| --- | --- | --- |
| `renderFeed`: `await findByRole("heading")` | `manifest` | awaited already |
| `renderFeed`: `getByRole("group", {name:"Sort"})` | `manifest` — `FeedControls` is in the same `{manifest && …}` block as the hero (`App.tsx:367,380`) | **yes** |
| T1 `aria-pressed` / `chip--active` / `pressedSortLabels` | `urlState` only, available in the first commit | **yes** |
| T1 `getByText(hint)` | `query` from `urlState` | **yes** |
| T1 `await findByText(OTHER.title)` | `papers` | **fixed** |
| T2 `pressedSortLabels` / `queryByText(hint)).toBeNull()` | `urlState` only | **yes** |
| T2 `await findByText(DIFFUSION.title)` | `papers` | **fixed** |
| T2 `queryByText(OTHER.title)).toBeNull()` | `papers` — but it is a *negative* assertion, so it passes vacuously if the list has not rendered | **now safe**, because it is ordered after the awaited positive anchor and `setPapers`/`setLoading(false)` are batched, so the rendered list is final the moment any card appears |
| T3 `await findByText(DIFFUSION.title)` (added) | `papers` | **fixed/added** |
| T3 `getByLabelText("Search papers")` | `manifest` | **yes** |
| T3 chip assertions after `fireEvent.change` | React state only; `fireEvent` wraps in `act`, so the re-render is flushed synchronously | **yes** |
| T3 `await findByText(OTHER.title)` | `papers` | **fixed** |
| T3 `window.location.hash` | `applyState` calls `writeHash(next,"replace")` **synchronously** before `setUrlState` | **yes** |
| `beforeEach` / `afterEach` | synchronous (`location.hash`, `vi.unstubAllGlobals`) | **yes** |

Collections state needed no treatment: `loadState()` runs in a `useReducer` initializer and
`detectStorage` in a `useState` initializer — both synchronous — and this file asserts nothing about
collections. Confirmed the only surviving synchronous `screen.getByText(` in the file is the **hint**
at `:105`, which is `manifest`-gated, not paper data.

**Stress-harness sensitivity control.** A fix I have not stress-tested is not a fix, and 20 clean runs
are worthless if the harness cannot detect the flake at all. So I measured the pre-fix file with the
identical harness: copied `web/` to `/tmp/rpf-imp008-r2`, rewrote only
`expect(await screen.findByText(` → `expect(screen.getByText(` (5 occurrences), and ran 20 iterations.

## 9.5 Stress-test results

All from `web/`, each iteration a separate `npx vitest run` process. Iterations were run to completion
regardless of outcome; a failure would have printed its assertion lines (it printed none).

```
$ for i in $(seq 1 20); do npx vitest run; done                      # full suite
FULLSUITE_PASS=20 FULLSUITE_FAIL=0

$ for i in $(seq 1 20); do npx vitest run src/__tests__/App.relevance.test.tsx; done
FILEONLY_PASS=20 FILEONLY_FAIL=0

# second round, after no further edits, to raise the sample
$ for i in $(seq 1 20); do npx vitest run src/__tests__/App.relevance.test.tsx; done
FILEONLY_ROUND2_PASS=20 FILEONLY_ROUND2_FAIL=0   (cumulative file-only: 40/40)
$ for i in $(seq 1 10); do npx vitest run; done
FULLSUITE_ROUND2_PASS=10 FULLSUITE_ROUND2_FAIL=0  (cumulative full: 30/30)

# sensitivity control: pre-fix file, identical harness
$ for i in $(seq 1 20); do npx vitest run src/__tests__/App.relevance.test.tsx; done
CONTROL_PASS=17 CONTROL_FAIL=3
```

| Target | Verifier's pre-fix rate | Control (this session) | **After the fix** |
| --- | --- | --- | --- |
| `App.relevance.test.tsx` alone | 3/14 failures (~21%) | **3/20 failures (15%)** | **40/40 clean** |
| full suite | 1/12 failures (~8%) | — | **30/30 clean** |

The control matters more than the headline number: it proves the harness reproduces the ~15–21% flake
on the pre-fix file, so the 40/40 is a real signal and not a harness that cannot fail. 70 consecutive
clean runs of the fixed code, 0 failures. `/tmp/rpf-imp008-r2` and all iteration logs were deleted.

## 9.6 No test weakened, removed, or skipped

```
$ grep -oE 'it\("[^"]+"' web/src/__tests__/App.relevance.test.tsx
lands on a date-ordered feed for #sort=relevance with no q"
still honours #q=…&sort=relevance, so the fix does not disable relevance"
un-presses Relevance when the search box is cleared, and rewrites the hash"

$ grep -oE 'it\("[^"]+"' web/src/__tests__/feedControls.test.tsx | wc -l
8

$ grep -nE "\.(skip|only|todo)|xit\(|xdescribe\(" <both files>
none
```

All **11** test names across IMP-008's two new files survive verbatim — 3 in `App.relevance.test.tsx`,
8 in `feedControls.test.tsx` — with no `.skip` / `.only` / `.todo`. No assertion was deleted or
loosened; the change is strictly "synchronous query → awaited query" plus one added positive anchor.
`urlState.test.ts` was not touched this round, so the verifier's 18-name-preservation check for that
file is unaffected. `git diff --stat -- web/` shows the same three tracked files as attempt 1
(`FeedControls.tsx`, `urlState.ts`, `urlState.test.ts`) — all untouched this round; `App.relevance.test.tsx`
is untracked, so it does not appear in the diffstat.

## 9.7 Commands, verbatim results (retry 2)

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0            # clean, no output
```

```
$ npm test
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web

 ✓ src/lib/__tests__/collections.test.ts (35 tests) 11ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 4ms
 ✓ src/lib/__tests__/paperIndex.test.ts (16 tests) 14ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 52ms
 ✓ src/__tests__/feedControls.test.tsx (8 tests) 229ms
 ✓ src/__tests__/App.relevance.test.tsx (3 tests) 292ms
 ✓ src/lib/__tests__/urlState.test.ts (43 tests) 7ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 380ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 81ms

 Test Files  9 passed (9)
      Tests  132 passed (132)
   Start at  03:52:14
   Duration  2.10s
```

**132 tests across 9 files — as expected.** Same as attempt 1 and the verifier's run; the fix changed no
test count, only how two-plus-one assertions wait. The `(node:…) Warning: --localstorage-file …` lines
are pre-existing Node-build noise, present on baseline runs too.

```
$ npm run build
vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-DqqHF7nh.js   164.77 kB │ gzip: 52.92 kB
✓ built in 360ms
```

**Reproduces the verifier's asset hashes byte for byte** (`index-G-YE6pVt.css`, `index-DqqHF7nh.js`,
39 modules, CSS 10.93 kB) — expected, since no production file was modified.

No Playwright run this round: no production code changed, so there is no new visual state to capture.
The verifier's four screenshots under `.improve/artifacts/IMP-008/` remain current.

## 9.8 Scope statement and remaining uncertainties

**Files modified this round:** `web/src/__tests__/App.relevance.test.tsx`,
`.improve/reports/impl-IMP-008.md`. Nothing else. `urlState.ts`, `FeedControls.tsx`, `App.tsx`,
`urlState.test.ts`, `collections.ts`, `paperIndex.ts`, `styles.css`, `FEATURES.md` and
`package-lock.json` were all left alone, as instructed. No git write command was run, no branch
switched, `.kilo/worktrees/mildly-income` never read or written. **I found no production defect and
made no production change.**

One observation, not mine to fix and not a failure: `.improve/FEATURES.md` shows as modified in
`git status` during this retry. I did not touch it — it is another agent's or the coordinator's edit.

Still open from §8, unchanged: the `writeHash` guard is beyond the literal text of criterion 2 (I
stand by it and by the verifier's §3(b) reasoning, which independently endorses it);
`.controls__count` as the hint's class name is a naming compromise forced by `styles.css` being
out of scope; `effectiveSort` is re-derived in `FeedControls` rather than shared; and the two copies
of the `trim()` predicate (`urlState.ts` and `FeedControls.tsx`) could drift. `discovered-IMP-008.md`
D-4 (retyping a query re-enables relevance) and D-5 (`visiblePapers` agrees only by coincidence) also
stand, and the verifier independently reached the same conclusions on both.

Profile rows this closes: **WEB-14**, plus §8 trap 16. §10 "recently fixed" still needs an IMP-008 row,
which I cannot add (not my file).
