# Verification — IMP-010 "Make the category selection reversible and representable"

**Verifier:** independent sub-agent (did not write the change)
**Date:** 2026-10-02
**Scope reviewed:** `git diff -- web/` only (6 files). The concurrent `IMP-023` work in
`scripts/` and `tests/` was deliberately ignored and never opened beyond a two-line
`grep` of `scripts/build_index.py` needed to settle reachability of one edge case (§6.3).
**Working tree at exit:** unchanged by me — `git status --porcelain` shows only the
implementer's `web/` edits plus the other agent's `scripts/`, `tests/`,
`.improve/FEATURES.md` changes. No git write command was run.

---

## VERDICT: PASS — 4/4 acceptance criteria met

Two non-blocking observations are recorded in §6.3 and §7.1. Neither is reachable
through the shipped pipeline and neither breaks an acceptance criterion.

---

## 1. Acceptance criteria

### Criterion 1 — "All" chip, first in the group, correct pressed state, restores the full set
**MET.**

`web/src/components/FeedControls.tsx:65-77` renders the chip first inside the existing
`.chips` container:

```tsx
<button
  key="all"
  type="button"
  className={`chip ${allSelected ? "chip--active" : ""}`}
  aria-pressed={allSelected}
  onClick={onSelectAllCategories}
>
  All
</button>
```

- Position: DOM-first child of `.chips`, ahead of `manifest.categories.map(...)`.
- `allSelected = isFullSelection(selectedCategories, categories)`
  (`FeedControls.tsx:43`) — the *same* helper `writeHash` uses
  (`urlState.ts:192`), so chip state and URL encoding cannot drift.
- `onSelectAllCategories` → `App.tsx:266-268` `applyState({ ...urlState, categories: null }, "replace")`.

Browser, real index (`cs.CV, cs.LG, cs.CL, cs.AI, cs.RO`), 1280px:

| action | `aria-pressed` on All | pressed category chips | hash | live count |
|---|---|---|---|---|
| bare `/` | `true` | all 5 | `""` | 2812 |
| click `cs.CV` | `false` | 4 | `#cat=cs.LG%2Ccs.CL%2Ccs.AI%2Ccs.RO` | 2412 |
| click `All` | `true` | all 5 | `""` | 2812 |
| `#cat=cs.BI` load | `false` | none | `#cat=cs.BI` | 0 |
| click `All` | `true` | all 5 | `""` | 2812 |

### Criterion 2 — full selection writes no `cat=` and reads back as `null`
**MET.**

`web/src/lib/urlState.ts:191-194`:

```ts
if (
  state.categories !== null &&
  allCategories !== null &&
  !isFullSelection(state.categories, allCategories)
) {
  params.set("cat", state.categories.join(","));
}
```

`readHash` (`urlState.ts:139-141`) still branches on `params.has("cat")` and hands back
`[]` for `cat=` and the split list for a non-empty value, so the omitted parameter maps
to `categories: null` by absence.

`allCategories` is passed from exactly one call site, `App.tsx:95`
(`manifest?.categories ?? null`). `writeHash` has no other production caller
(`grep -rn "writeHash" web/src --include="*.ts*" | grep -v __tests__` returns only
`App.tsx:24,26,95`). Before the manifest arrives `allCategories` is `null`, so the guard
degrades to "always emit `cat=`" — conservative, and it means the pre-manifest window
can never lose a live filter.

Observed in browser: bare `/` → `hash === ""`; after `All` → `hash === ""`;
`#cat=` → stays `#cat=`. `null` and `[]` are distinct in the address bar.

### Criterion 3 — distinct "No categories selected" message + keyboard-reachable "Select all categories"
**MET.**

`web/src/App.tsx:483-500`:

```tsx
) : noCategoriesSelected ? (
  <>
    <p className="empty">No categories selected</p>
    <p>
      <button type="button" className="button" onClick={selectAllCategories}>
        Select all categories
      </button>
    </p>
  </>
) : (
```

`noCategoriesSelected = manifest !== null && activeCategories.length === 0`
(`App.tsx:197-198`). It sits in the render chain *after* `error ?` and `loading ?`
(`App.tsx:440,477`), so an index failure or an in-flight load is never mislabelled.

Verified in browser by deselecting all five chips one at a time:

```
#                        All  cs.CV  cs.LG  cs.CL  cs.AI  cs.RO  live count
(none)                   true  true   true   true   true   true   2812 papers match
cs.CV off                false false  true   true   true   true   2412 papers match
+cs.LG off               false false  false  true   true   true   1965 papers match
+cs.CL off               false false  false  false  true   true   1562 papers match
+cs.AI off               false false  false  false  false  true    700 papers match
+cs.RO off               false false  false  false  false  false     0 papers match
                        -> <p class="empty">No categories selected</p>
                        -> <button type="button" class="button">Select all categories</button>
```

`document.body.textContent.includes("No papers match the current filters")` was `false`
in every one of the states probed, including `#cat=`, `#cat=cs.BI`,
`#view=collections&cat=`, and after chip-by-chip deselection.

Loading `#cat=` directly (fresh page load, not a click path) produced the identical
state: all six chips un-pressed, `0 papers match`, empty panel + recovery button.

### Criterion 4 — new `urlState` tests; `typecheck && npm test` pass
**MET.** See §5 and §7.

---

## 2. THE CRITICAL INVARIANT — `null` vs `[]`

### 2.1 Distinctness at each layer

| layer | file:line | `null` ("no explicit selection" = all) | `[]` ("explicitly empty" = zero papers) |
|---|---|---|---|
| `resolveCategories` | `urlState.ts:42-68` | returns `{ selected: null, unknown: [] }` — the `categories === null` branch at `:47` | returns `{ selected: [], unknown: [...] }` — falls through to the intersect branch at `:62`, which yields `[]` |
| `readHash` | `urlState.ts:139-141` | parameter absent → `categories: null` | `params.has("cat")` true, `value === ""` → `value.split(",").map(trim).filter(Boolean)` → `[]` |
| `writeHash` | `urlState.ts:191-194` | `state.categories !== null` short-circuits → **no `cat=`** | falls to the `isFullSelection` check, which is `false` for `[]` → `params.set("cat", "")` → `cat=` |
| App state | `App.tsx:186` | `activeCategories = selected ?? manifest.categories` (all 5) | `activeCategories = selected` → `[]` |
| App empty state | `App.tsx:197-198` | `activeCategories.length === 5` → false | `=== 0` → true |
| Chip pressed state | `FeedControls.tsx:43` | `isFullSelection(manifest.categories, manifest.categories)` → `true` | `isFullSelection([], manifest.categories)` → `false` |

`resolveCategories`'s `null` branch is a hard early return before the intersect
(`urlState.ts:47`), so it is structurally impossible for the intersect to convert
`null` into `[]`. The two are distinguished by an early return, not by a value check.

### 2.2 A full selection serialises as NO `cat=`

`isFullSelection` (`urlState.ts:96-108`) is set-based, order-insensitive,
duplicate-insensitive:

```ts
const valid = new Set(all);
const chosen = new Set(selected);
return chosen.size === valid.size && all.every((category) => chosen.has(category));
```

- full list in any order → `true` → no `cat=`.
- full list plus a duplicate (`[...manifest, "cs.CV"]`) → `chosen.size === valid.size` → `true`.
- full list plus an unknown (`[...manifest, "cs.BI"]`) → `chosen.size` 6 vs 5 → `false` → `cat=` retained, so the unknown value stays visible to IMP-009's notice.

Browser confirmation that order/duplicates do not matter:
`#cat=cs.RO%2Ccs.AI%2Ccs.CL%2Ccs.LG%2Ccs.CV` → all five chips pressed, All pressed,
2812 papers, and the URL is **not** rewritten on load (the app does not clobber a
hand-written full URL until the user acts — verified).

### 2.3 An explicitly empty selection does NOT collapse to "all"

Browser, fresh load of `#cat=`:
- `hash === "#cat="` (unchanged, no normalisation to bare `#`)
- All six chips `aria-pressed="false"`
- `No categories selected` + a live `Select all categories` button
- `0 papers match`

So `[]` stayed `[]`, stayed representable in the URL, and stayed a *user* selection
(visible as un-pressed chips) rather than silently becoming the full default.
The dead end did not reappear in the new form: pressing **Enter** on the focused
recovery button restored `#` and 2812 papers; pressing **Space** did the same (§4).

### 2.4 Exhaustive `writeHash` → `readHash` round-trip — 480 combinations

I wrote my own harness (not the implementer's) at
`/tmp/vimp010/src/lib/__tests__/zz-verifier-roundtrip.test.ts`, copying `web/` out of
the repo so I never touched a source file. It enumerates the full cross product:

```
view        (2)   feed | collections
query       (4)   "" | "diffusion" | "   " | "a,b&c=d"
categories  (10)  null | [] | full | full-rev | full-dup | 1-of-5 | 2-of-5 | 4-of-5
                    | full+unknown | only-unknown
recency     (3)   7 | 30 | 60
sort        (2)   newest | relevance
= 480 states
```

For each: `writeHash(state, "replace", noop, MANIFEST)` → `readHash(hash)` → re-serialize
→ compare. Assertions per case: hash is parseable; re-serialization is byte-identical;
`view`/`query`/`recency` survive exactly; `sort` survives modulo IMP-008's intended
`relevance` + blank-query → `newest` normalisation; the **effective** category set
(`selected ?? MANIFEST`, i.e. exactly what `App.tsx:186` computes) is unchanged;
`null` states emit no `cat=` and read back `null`; `[]` states emit `cat=` and read back `[]`.

```
$ npx vitest run src/lib/__tests__/zz-verifier-roundtrip.test.ts
 Test Files  1 passed (1)
      Tests  2 passed (2)
   Duration  ...
```

`covered every combination (480) and never conflated null with []` — asserted
`rows.filter(r => r.includes("REWRITE:")).length === 0`, i.e. **zero** of the 480
hashes failed to re-serialize to themselves. Representative rows from the encoding
table the harness dumped:

```
null              | #                                          | null        | IDEMPOTENT
empty             | #cat=                                      | []          | IDEMPOTENT
full              | #                                          | null        | IDEMPOTENT
full-rev          | #                                          | null        | IDEMPOTENT
full-dup          | #                                          | null        | IDEMPOTENT
partial-1         | #cat=cs.CV                                 | ["cs.CV"]   | IDEMPOTENT
partial-4         | #cat=cs.CV%2Ccs.LG%2Ccs.CL%2Ccs.AI         | 4 items     | IDEMPOTENT
superset-unknown  | #cat=cs.CV%2C...%2Ccs.BI                   | 6 items     | IDEMPOTENT
only-unknown      | #cat=cs.BI                                 | ["cs.BI"]   | IDEMPOTENT
```

Two extra cases in the same harness:

- `#cat=cs.RO%2Ccs.AI%2Ccs.CL%2Ccs.LG%2Ccs.CV` (a full list `readHash` accepts but the
  writer never emits) → `isFullSelection` `true` → re-serializes to no `cat=`. No stuck state.
- `writeHash` called **without** `allCategories` over every non-`null` selection in the
  matrix → `cat=` present in every case. The writer cannot silently drop a filter.

**Conclusion for §2:** the reader reproduces every hash the writer produces, `null` and
`[]` are never conflated in any of the four layers, and no state the reader accepts is a
state the writer cannot write back.

---

## 3. Regression check on IMP-008 and IMP-009

### 3.1 IMP-008 — relevance/chip agreement
**INTACT.** Real browser session, real index, 1280px:

| scenario | hash | Newest | Relevance | `disabled` | first paper |
|---|---|---|---|---|---|
| `#sort=relevance` deep link, no query | `#sort=relevance` | `true` | `false` | `true` | Geometric Similarity in VLM Low-Level Vision Representations |
| whitespace-only query `"   "` | `#q=+++` | `true` | `false` | `true` | (unchanged) |
| empty query | `""` | `true` | `false` | `true` | (unchanged) |
| real typing `"segmentation"` | `#q=segmentation` | `true` | `false` | `false` | Lang3DSeg … |
| click Relevance | `#q=segmentation&sort=relevance` | `false` | `true` | `false` | MIRTO … (order changed) |
| Relevance + deselect `cs.CV` | `#q=segmentation&cat=cs.LG%2Ccs.CL%2Ccs.AI%2Ccs.RO&sort=relevance` | `false` | `true` | `false` | MIRTO … |
| Relevance + `All` | `#q=segmentation&sort=relevance` | `false` | `true` | `false` | MIRTO … (37 papers) |

Chip state, URL and feed agreed at every step. `App.relevance.test.tsx` still has its
3 original test names, unmodified (see §5.2).

### 3.2 IMP-009 — unknown-category notice
**INTACT.** Loading `#cat=cs.BI` against the real 5-category manifest produced
`[role="alert"]` with exactly:

> `Unknown category: cs.BI. This index does not have that category, so nothing can match. Reset category filter`

- names the dropped value (`cs.BI`) ✓
- the reset control is present and functional ✓
- clicking it produced `hash === ""`, all six chips pressed, `alert` gone, 2812 papers ✓
- the notice copy correctly took the *second* branch at `App.tsx:186-190`
  ("no categories are selected, so no papers are shown") because `activeCategories`
  was `[]` ✓

### 3.3 IMP-009's `toggleCategory` re-seeding fix
**INTACT.** `App.tsx:254-260` seeds from `activeCategories`, never from
`urlState.categories`:

```ts
const toggleCategory = (category: string) => {
  const current = activeCategories;          // the INTERSECTED list
  const next = current.includes(category)
    ? current.filter((item) => item !== category)
    : [...current, category];
  applyState({ ...urlState, categories: next }, "replace");
};
```

`activeCategories` is `categoryResolution.selected` (`App.tsx:186`), i.e. already
intersected with the manifest. So with `#cat=cs.CV,cs.BI` → `selected = ["cs.CV"]`,
deselecting `cs.CV` yields `next = []`, and `writeHash` writes `cat=` — `cs.BI` is
never reintroduced. Traced and confirmed in the browser (§3.2 walk-through: after the
reset and after the `All` press, `cs.BI` never re-entered the URL).

### 3.4 The "All" chip cannot inject an unvalidated category
**CONFIRMED.** `selectAllCategories` (`App.tsx:266-268`) assigns `categories: null` and
nothing else — it takes no arguments and consults no list, so there is no path by which
it could write a category value. Verified live: at `#cat=cs.BI` the `All` chip was
un-pressed; pressing it produced `hash === ""` (no `cat=`, so `cs.BI` is gone), the
notice disappeared, and all five validated chips plus `All` became pressed.

### 3.5 The new chip does not break existing chip keyboard/ARIA behaviour
**INTACT.** Real Tab walk of the live page (1280px), DOM tabbable order:

```
link "Skip to content" -> button "Feed" -> button "Collections (2)"
 -> searchbox "Search papers"
 -> button "All"        <-- new chip, first in the Categories group, reachable
 -> button "cs.CV" -> "cs.LG" -> "cs.CL" -> "cs.AI" -> "cs.RO"
 -> button "7 days" -> "30 days" -> "60 days"
 -> button "Newest" -> button "Relevance" [disabled, correctly skipped]
 -> button "Select all categories"   <-- new recovery control
 -> article "Show more" …
```

The disabled `Relevance` chip is still skipped; the new chip did not disturb the
`fieldset`/`legend` grouping (accessibility snapshot still shows
`group "Categories"` containing exactly `All, cs.CV, cs.LG, cs.CL, cs.AI, cs.RO`).

---

## 4. Accessibility of the new affordances (verified by keyboard, not markup)

| control | tag | `type` | accessible name | pressed/selected state | Tab | Enter | Space |
|---|---|---|---|---|---|---|---|
| `All` chip | `BUTTON` | `button` | text content `"All"` | `aria-pressed="true"` exactly when `isFullSelection(activeCategories, manifest.categories)` | yes (1st in Categories group) | yes (via `applyState`) | yes (native `<button>`) |
| `Select all categories` | `BUTTON` | `button` | text content `"Select all categories"`; `aria-pressed` correctly `null` (it is an *action*, not a toggle) | n/a | yes — immediately after `Newest`, since disabled `Relevance` is skipped | **yes, verified** | **yes, verified** |

Evidence:

1. `Shift+Tab` from the feed's first paper link landed on
   `button "Select all categories"` (highlighted as the active element), then a real
   `playwright_browser_press_key Enter` changed `#cat=` → `#`, set all six chips to
   `aria-pressed="true"`, and restored `2812 papers match` with the article list back.
2. `focus()` on the button followed by a real
   `playwright_browser_press_key Space` produced the same restoration
   (`hash ""`, 2812 papers).
3. The accessible-name check: `{ tag: "BUTTON", type: "button", disabled: false,
   ariaPressed: null, hasAriaLabel: false, accessibleText: "Select all categories" }`
   — the text content *is* the accessible name, so `hasAriaLabel: false` is correct, not
   a gap.
4. No `aria-pressed` on the recovery button is right: it does not represent a persistent
   state, so exposing one would be the bug. The `All` chip, which *does* represent a
   state, does expose `aria-pressed`.

---

## 5. Test-integrity audit

### 5.1 Non-vacuity — revert to HEAD in a scratch copy

Scratch tree at `/tmp/vimp010-revert` (copy of `web/src`, `public/`, configs, with
`node_modules` symlinked). I verified each reverted file byte-matches
`git show HEAD:web/<file>` and each kept test file byte-matches the working tree:

```
OK  src/App.tsx == HEAD
OK  src/components/FeedControls.tsx == HEAD
OK  src/lib/urlState.ts == HEAD
OK  src/lib/__tests__/urlState.test.ts == new tests kept
OK  src/__tests__/feedControls.test.tsx == new tests kept
OK  src/__tests__/App.categories.test.tsx == new tests kept
```

```
$ cd /tmp/vimp010-revert && npm test
 Test Files  5 failed | 5 passed (10)
      Tests  21 failed | 139 passed (160)
```

**The implementer's "21 failed / 139 passed" claim is exact.** Arithmetic reconciles:
140 pre-existing + 20 new = 160; 21 failures = 17 brand-new tests + 4 pre-existing
IMP-009 tests whose *intermediate* assertion was updated (see §5.3); 139 passes =
136 untouched pre-existing + 3 new `writeHash` tests that are deliberate
behaviour-preservation guards.

The 21 failures, by name:

```
urlState.test.ts  (6)  isFullSelection > treats a selection containing every category as a full one
                           > ignores order
                           > counts a duplicated category once
                           > rejects a selection that also names a category the index lacks
                           > is false for an explicitly empty selection
                           > is false when the index has not been read
             (1)   writeHash > omits cat for a selection that covers the whole index
feedControls (6)  All chip > renders it ahead of the per-category chips
                         > presses it exactly when the selection covers every category
                         > stays unpressed for a partial selection
                         > stays unpressed for an explicitly empty selection
                         > calls the select-all handler when activated
                         > renders no per-category chips when the manifest is unavailable
App.categories(4) > reaches the empty state by deselecting every chip in turn
                  > names and reverses an explicitly empty selection
                  > presses All for a bare feed and drops cat= once it is pressed again
                  > treats a reordered full list from a deep link as no filter
App.categories(4) PRE-EXISTING, assertion-updated (see §5.3)
                  > intersects the hash list with the manifest, not the raw hash list
                  > renders a named notice with a usable reset instead of a bare empty state
                  > recovers the whole feed when the reset is clicked
                  > does not claim anything about an explicit empty selection
```

The 3 new `writeHash` tests that correctly pass against HEAD are the guards named in the
report: "emits cat for a partial selection", "keeps an explicitly empty selection its
own cat=", "still emits cat when the index's category list is not in hand". They assert
behaviour that must NOT change, so passing on HEAD is the intended result.

### 5.2 No existing test was weakened, skipped, deleted, or renamed

Machine diff of every `it(...)` title, HEAD vs working tree, across **all** test files:

```
TOTAL it() HEAD: 133   CURRENT: 153   (+20, matching the reported 20 new tests)
ANY PRE-EXISTING TEST NAME MISSING: false
```

Per file:

| file | HEAD | now |
|---|---|---|
| `web/src/__tests__/App.categories.test.tsx` | 11 | 15 |
| `web/src/__tests__/App.relevance.test.tsx` | 3 | 3 (untouched) |
| `web/src/__tests__/App.retry.test.tsx` | 7 | 7 (untouched) |
| `web/src/__tests__/domEnvironment.test.tsx` | 3 | 3 (untouched) |
| `web/src/__tests__/feedControls.test.tsx` | 8 | 14 |
| `web/src/__tests__/malformedImport.test.tsx` | 3 | 3 (untouched) |
| `web/src/lib/__tests__/collections.test.ts` | 30 | 30 (untouched) |
| `web/src/lib/__tests__/paperIndex.test.ts` | 16 | 16 (untouched) |
| `web/src/lib/__tests__/search.test.ts` | 12 | 12 (untouched) |
| `web/src/lib/__tests__/urlState.test.ts` | 40 | 50 |

Skip markers introduced anywhere in the diff:

```
$ git diff -- web/ | grep -nE "^\+.*(\.skip|\.only|\.todo|xit\(|xdescribe\()"
none
```

Named spot-checks requested by the brief — **all present with their original titles**:

- IMP-143 `urlState` suite: all **40** original titles still present (`readHash > …` 15,
  `resolveCategories > …` 14, and the rest), plus 10 new. *(Note: the brief said "18
  urlState tests"; the file actually carried 40 at HEAD and carries 50 now. Zero titles
  were removed, which is the property that matters. Read `IMP-143` in `FEATURES.md:189`
  as "Export and test `readHash` / `writeHash`" — the 18 figure does not correspond to
  any count in that file or in its report.)*
- IMP-008 `App.relevance.test.tsx`: 3/3 untouched.
- IMP-009 category tests: all 11 original `App.categories.test.tsx` titles and all 8
  original `feedControls.test.tsx` titles still present.

### 5.3 The 4 modified assertions — each justified, none a weakening

1. `App.categories.test.tsx:157` — `expect(window.location.hash).toBe("#cat=cs.CV%2Ccs.LG")`
   → `expect(window.location.hash).not.toContain("cat=")`.
   The old exact string is now *factually wrong*: that test's manifest has only two
   categories, so selecting both **is** a full selection and criterion 2 requires `cat=`
   to be omitted. The replacement forbids strictly more (any `cat=` at all, so `cs.BI`
   leaking is caught), and the same test still asserts
   `pressedCategoryLabels(group) === ["cs.CV","cs.LG"]` and
   `allChip.aria-pressed === "true"`, so the effective state is still pinned. The
   `%2C` encoding it used to cover is still covered by
   `urlState.test.ts` "emits cat for a partial selection of the same index".
2. `App.categories.test.tsx:237` — `findByText(/No papers match the current filters/)`
   → `findByText("No categories selected")` **plus** a new negative assertion
   `queryByText(/No papers match the current filters/) === null`.
   Criterion 3 mandates replacing the generic line. The added negative assertion makes
   this test *stronger*, and all the IMP-009 assertions it guarded (the `"Unknown
   category: cs.BI."` copy, `BUTTON`, `type="button"`, `disabled === false`,
   `focus()` → `activeElement`, `pressedCategoryLabels === []`) are unchanged.
3. `App.categories.test.tsx:263` — only the intermediate `findByText` in the
   before/after pair changed; every post-click assertion (`hash === ""`,
   `queryByRole("alert") === null`, `CV_PAPER`, `LG_PAPER`, both chips pressed) is
   byte-identical.
4. `App.categories.test.tsx:320` — same generic-line swap as (2); the
   `queryByRole("alert")).toBeNull()` guard is retained.

`pressedCategoryLabels` was changed to filter out the `"All"` chip
(`App.categories.test.tsx:24`), which is required for it to keep meaning "which category
chips are pressed". The `"All"` chip's state is asserted separately by the six new
`feedControls` tests and by four new `App.categories` assertions on
`allChip(group).getAttribute("aria-pressed")`.

---

## 6. Flake check

### 6.1 Fourteen independent full runs

```
$ for i in $(seq 1 14); do npm test; done   # script /tmp/vimp010-flake.sh
run  1 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  2 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  3 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  4 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  5 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  6 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  7 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  8 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run  9 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run 10 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run 11 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run 12 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run 13 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
run 14 exit=0 ::  Tests  160 passed (160)  ::  Test Files  10 passed (10)
```

**14/14 clean, 0 failures, 2240 test executions total.** The implementer claimed 12/12;
I exceeded it. Timings stayed in the 3.4–4.1 s range with no outliers, and no run
emitted a `FAIL` line.

### 6.2 Sensitivity of my harness — established

A green 14/14 is only meaningful if the harness can go red. The revert-to-HEAD run in
§5.1 used the *same* `npm test` command in the *same* vitest/jsdom environment and
produced **21 failed / 139 passed**, deterministically, naming the exact tests. I
re-ran it a second time and got the identical 21 failures. So the harness has proven
sensitivity; the 14/14 is a real result, not a stuck runner.

### 6.3 The one place `null` can still be presented as `[]` (non-blocking)

`noCategoriesSelected` (`App.tsx:197-198`) is guarded only by `manifest !== null`, not
by "the manifest actually has categories". I probed it directly with a stubbed
zero-category manifest (`/tmp/vimp010/src/__tests__/zz-verifier-zerocat.test.tsx`):

```
[ZERO-CATEGORY INDEX] hash=""  status=0 papers match
                       emptyPanel="No categories selected"  selectAllButtonPresent=true
```

With `manifest.categories === []`, a **bare URL with no filter at all**
(`categories === null`, i.e. "all categories") renders "No categories selected" plus a
"Select all categories" button that cannot change anything — a nominal collapse of the
distinction IMP-009 established, in a form the item forbids.

**It is unreachable through the shipped pipeline, so it is not a blocking defect.**
`scripts/build_index.py:189` writes `list(categories or DEFAULT_CATEGORIES)` and
`:300` computes `categories = args.categories or DEFAULT_CATEGORIES`; a falsy list
falls back to the five defaults, so the built manifest can never carry an empty
`categories`. `PaperIndex.fetchManifest` (`paperIndex.ts:118`) only casts, it does not
validate, so a hand-placed index *could* trigger it.

Optional one-line hardening, for whoever touches this file next:
`App.tsx:197` → `manifest !== null && manifest.categories.length > 0 && activeCategories.length === 0`.

---

## 7. Commands and results

### 7.1 Required gates

```
$ cd web && npm run typecheck
> tsc --noEmit
(exit 0, no output)

$ cd web && npm test
 Test Files  10 passed (10)
      Tests  160 passed (160)
   Duration  3.55s

$ cd web && npm run build
> tsc -b && vite build
vite v6.3.5 building for production...
✓ 12 modules transformed.
dist/index.html                 0.46 kB │ gzip:  0.30 kB
dist/assets/index-DBES0YCS.css  5.99 kB │ gzip:  1.87 kB
dist/assets/index-Bm5qMMdA.js  158.03 kB │ gzip: 52.99 kB
✓ built in 1.43s
(exit 0)
```

Exactly the expected 160 tests / 10 files.

### 7.2 Verification-only files I created (all outside the repo, all disposable)

```
/tmp/vimp010/                          scratch copy of web/ + my round-trip harness
/tmp/vimp010/src/lib/__tests__/zz-verifier-roundtrip.test.ts
/tmp/vimp010/src/__tests__/zz-verifier-zerocat.test.tsx
/tmp/vimp010-revert/                   revert-to-HEAD control
/tmp/vimp010-flake.sh                  14-run flake driver
```

No file inside the repository was modified. `git status --porcelain` at exit shows only
the implementer's `web/` edits and the concurrent IMP-023 agent's `scripts/`, `tests/`,
`.improve/FEATURES.md` changes.

---

## 8. Playwright — real behaviour, my own session

Server: `cd web && npm run preview -- --port 5199 --strictPort`, started as a tracked
background process, waited on port readiness, and **stopped** at the end
(`lsof -nP -iTCP:5199 -sTCP:LISTEN` → `port 5199 closed`). Real index:
2,812 papers, 5 categories, `index generated Oct 1, 2026`.

### 8.1 Deselect every category via the UI
Chip-by-chip deselection, verified in §1 criterion 3. Ended at `#cat=` with
`No categories selected`, `0 papers match`, all six chips un-pressed. Recovery by
**real `Enter`** keypress → `#`, all six chips pressed, 2812 papers, article list
restored. Recovery by **real `Space`** keypress → identical result.

### 8.2 Load `#cat=` directly
Fresh page load of `http://localhost:5199/research-paper-feed/#cat=`: all six chips
`aria-pressed="false"`, `0 papers match`, `No categories selected` + a live
`Select all categories` `<button type="button" disabled=false>`. Activating it →
`hash === ""`, 2812 papers. Also verified as a *destination*: navigating from
`#view=collections&cat=` back to `#cat=` produces the same recoverable state.

### 8.3 The "All" chip
- From a bare feed: `All` pressed, `hash === ""` — **no `cat=`** — full feed.
- From `#cat=` (all un-pressed): pressing `All` → `hash === ""`, all five category chips
  pressed, `2812 papers match`.
- From `#cat=cs.BI`: pressing `All` → `hash === ""`, notice gone, all five validated
  chips + `All` pressed, 2812 papers.

### 8.4 UI / URL / feed always agree
Checked at 15 distinct states across bare, `#cat=`, `#cat=cs.BI`, `#cat=` + hand-written
full lists (forward and reversed), 60/30/7-day recency, relevance + partial category
combinations, and the collections view. At every point the chip pressed set, the `cat=`
parameter, the live `papers match` count and the rendered first article were mutually
consistent. I found **no** state where the chips show one thing and the list shows
another. The dead-end string `"No papers match the current filters"` was absent from
`document.body.textContent` in all 15 states.

Related, and correct: `#view=collections&cat=` renders the collections view, which has no
category UI and shows its own distinct empty state ("No papers saved yet. Use "Save to
collection" on any paper in the feed."). The empty-selection branch is unreachable there
and correctly so.

### 8.5 Console errors
`playwright_browser_console_messages` polled after each phase. **Zero errors, zero
warnings, across the entire session** — including the load, the deselection walk, both
keyboard recoveries, the unknown-category walk, the relevance walk, and the 390px pass.

### 8.6 Screenshots

Written by me into `.improve/artifacts/IMP-010/` (the implementer's four files remain
alongside; mine are prefixed `verify-`):

| file | width | state |
|---|---|---|
| `.improve/artifacts/IMP-010/verify-feed-all-categories-desktop-1280.png` | 1280 | all six chips pressed, full feed |
| `.improve/artifacts/IMP-010/verify-feed-no-categories-selected-desktop-1280.png` | 1280 | `#cat=`, empty panel + recovery button |
| `.improve/artifacts/IMP-010/verify-feed-all-categories-mobile-390.png` | 390 | all six chips pressed, `All` wraps to its own line |
| `.improve/artifacts/IMP-010/verify-feed-no-categories-selected-mobile-390.png` | 390 | `#cat=`, empty panel + recovery button |

**Design judgement — intentionally designed, not bolted on.** Compared against
`.improve/artifacts/baseline/baseline-feed-no-categories-selected-desktop-1280.png`
(which is the dead end: a dashed panel containing only the centred generic line):

- The `"All"` chip reuses the **existing** `.chip` / `.chip--active` classes
  (`web/src/styles.css:254`, `:273`) and is visually indistinguishable in kind from
  `cs.CV`…`cs.RO` — same pill geometry, same active fill, same disabled styling. At 390px
  it simply joins the same wrapping row. It reads as the first member of the group, not
  as a new widget.
- The recovery control reuses the **existing** `.button` class
  (`web/src/styles.css:424`), the same solid dark treatment IMP-007's "Try again"
  already uses. **No `styles.css` line was added or changed by this item**
  (`git status -- web/src/styles.css` → clean).
- Both new controls use the same `type="button"` discipline, the same
  `className={cond ? "a" : "a b"}` idiom, and the same `.chips` container as their
  neighbours.

One cosmetic observation, not a defect: in the empty state the centred
`No categories selected` line sits inside the dashed `.empty` panel while the
`Select all categories` button sits *outside* it, left-aligned to the page gutter. That
reads as an intentional "message, then action" hierarchy, but it is the one place where
the new markup is a touch less tidy than it could be — folding the `<p><button></p>` up
into the `.empty` panel (the way `App.tsx:391-399` does for the retry button) would
centre it with the message. Purely cosmetic; the current form is fully usable and
correctly keyboard-reachable as shipped.

---

## 9. Summary

- 4/4 acceptance criteria met, each verified in code, in a browser, and against a
  reverted-source control.
- The IMP-009 `null` / `[]` distinction is intact and structurally protected: `null`
  short-circuits in `resolveCategories` before the intersect ever runs, and the writer's
  guard is `state.categories !== null && allCategories !== null && !isFullSelection(...)`.
- **All 480 combinations** of view / query / category-selection / recency / sort round-trip
  `writeHash` → `readHash` → `writeHash` byte-identically, and no effective category set
  changes across the trip. A state the reader cannot reproduce would have failed this.
- An explicitly empty selection still serialises as `cat=`, still reads back as `[]`,
  still renders the user-facing "No categories selected" state, and does **not** silently
  become the full default.
- IMP-008 and IMP-009 both intact; the new chip cannot inject an unvalidated category;
  tab order, disabled-chip skipping, and ARIA pressed state all verified by real keyboard
  interaction, not markup reading.
- 20 new tests, 17 of which fail against reverted sources; 3 are deliberate
  behaviour-preservation guards. Zero pre-existing test names removed (133 → 153 `it()`
  blocks, no deletions, no `.skip`/`.only`/`.todo`). The 4 modified assertions are all
  forced by criterion 2 or 3 and none is weaker.
- 14/14 clean full-suite runs, with proven harness sensitivity (21 deterministic failures
  on the reverted control).
- `typecheck` 0 errors, `test` 160/160 in 10 files, `build` clean, 0 console errors.

**Blocking issues: none.**
