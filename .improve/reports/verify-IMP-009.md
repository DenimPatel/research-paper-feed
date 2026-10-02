# IMP-009 — Independent Verification

**Verifier:** sub-agent (did not write the change)
**Date:** 2026-10-02
**Scope:** full diff vs. `.improve/FEATURES.md` → `### IMP-009`, async-correctness of the async
manifest, the `toggleCategory` click-path regression, test non-vacuity, flake, and real-browser
behavior on the port the spec names (5199).

## VERDICT: PASS

The previous attempt's fatal gap — `resolveCategories()` existing in a library file with 19 tests but
never reaching the rendered output — is genuinely closed. `App.tsx` now calls
`resolveCategories(urlState.categories, manifest?.categories)` at **`web/src/App.tsx:288`**, and the
result feeds `activeCategories` (`:290`) and `unknownCategories` (`:291`), which drive
`FeedControls` (`:425`) and the notice (`:443`). I confirmed this in the real browser, not just by
reading the diff.

---

## 1. Acceptance criteria

### AC1 — `activeCategories` is the hash ∩ `manifest.categories`; unknown hash values dropped

**MET.**

- `web/src/lib/urlState.ts:8-25` — `resolveCategories` builds `valid = new Set(manifestCategories)`
  and keeps only requested keys present in that set; `unknown` collects the rest. Order is preserved
  (`Array.from(new Set(selected))`), which is what `writeHash` expects.
- `web/src/App.tsx:288-291`:
  ```ts
  const { selected: resolvedCategories, unknown: unknownCategories } = resolveCategories(
    urlState.categories,
    manifest?.categories,
  );
  const activeCategories = resolvedCategories ?? manifest?.categories ?? [];
  ```
- Note `?? manifest?.categories` at `:290` is dead code — `resolveCategories` returns `string[]`
  (never `null`/`undefined`), so `?? ` can never fire. Harmless, but it implies a nullability that
  the signature does not have. Cosmetic only; flagged as an advisory below.

Real-browser proof (`#cat=cs.CV,cs.BI`, `http://localhost:5199/research-paper-feed/`):

```
cs.CV [pressed]   cs.LG   cs.CL   cs.AI   cs.RO
alert: "Unknown category: cs.BI.This index does not have that category, so nothing can match."
status: "783 papers match"
```

Only `cs.CV` pressed, `cs.BI` named as unknown, and **783 papers actually rendered** (non-empty
feed). AC1 satisfied in the rendered DOM.

### AC2 — explicit notice naming the dropped value(s) with a RESET, not a bare empty state

**MET.** `web/src/App.tsx:443-453` renders, inside the `manifest && …` gate:

- `<strong>Unknown category{plural}: {unknownCategories.join(", ")}.</strong>`
- `<button type="button" className="button button--ghost">Reset category filter</button>` which
  calls `handleResetCategories` (`App.tsx:139-143`) → `resetCategoryFilters()` → full hash clear.

Real-browser proof (`#cat=cs.BI`):

```
alert  -> <strong>Unknown category: cs.BI.</strong>
          This index does not have that category, so nothing can match.
          button "Reset category filter"
status -> "0 papers match"
body   -> "No papers match the current filters."   (notice supplements, does not replace)
```

**Keyboard:** I tabbed 10 times from the search input with real `Tab` presses. Order observed:
search → cs.CV → cs.LG → cs.CL → cs.AI → cs.RO → 7 days → 30 days → 60 days → Newest →
**Reset category filter** (the disabled Relevance chip is correctly skipped). `Enter` on it moved the
URL to `#`, pressed all five chips, and rendered the feed ("2812 papers match"). So it is a native,
focusable, Enter-activatable control in the sequential tab order.

**Mouse:** a real Playwright role locator `getByRole('button', { name: 'Reset category filter' })`
resolved and `.click()` moved the URL to `#`, pressed all five chips, and rendered the full feed.
The role+name lookup is itself independent proof of the accessible name.

**Accessible name:** `button` → `Reset category filter`, `type="button"`, no `disabled`, no
`aria-hidden`. Good.

### AC3 — `npm run typecheck` and `npm test` pass

**MET.**

```
$ cd web && npm run typecheck
> tsc --noEmit
typecheck exit=0        (no output, per REPO_PROFILE.md:119)

$ cd web && npm test
 Test Files  10 passed (10)
      Tests  140 passed (140)
   Duration  2.37s

$ cd web && npm run build
✓ 39 modules transformed.
dist/index.html                   0.46 kB │ gzip: 0.30 kB
dist/index-DXw9SpEZ.js          219.62 kB │ gzip: 71.79 kB
dist/index-G-YE6pVt.css          10.93 kB │ gzip: 2.60 kB
✓ built in 3.71s
```

140 tests / 10 files matches the expectation. `index-G-YE6pVt.css` is byte-identical in name to the
pre-change build hash quoted in `.improve/reports/verify-IMP-141.md` (3f58b96), independently
confirming `web/src/styles.css` was **not** touched — as claimed.

---

## 2. Async-correctness review (the part most likely to be wrong)

The manifest is fetched by the `useEffect` at `App.tsx:48-112`; until it resolves `manifest` is
`null`. Everything downstream is gated on `{manifest && …}` (`App.tsx:315`). This is what makes the
following three properties hold, and I verified each with probes rather than reasoning alone.

### 2a. Deep link while the manifest is IN FLIGHT — no empty flash, no bogus notice

**No flash, and it is structurally impossible, not merely lucky.**

1. `resolveCategories` passes through untouched when the valid set is unavailable
   (`urlState.ts:17-19`): if `valid` is not an array, or any entry is not a string, it returns
   `{ selected: unique, unknown: [] }`. So even if a notice were rendered pre-manifest it would have
   nothing to name.
2. The notice lives *inside* `{manifest && …}` (`App.tsx:315` … `:443`). With `manifest === null`
   the entire feed subtree — controls, notice, list — is absent. The only thing on screen is
   `status="loading"` (`App.tsx:298-300`).

Tested: `web/src/__tests__/App.categories.test.tsx:203-230` gates the manifest fetch on a manually
resolved promise, renders with `#cat=cs.BI,cs.NOPE`, asserts the loading status is present **and**
`queryByRole("alert")` is `null` before releasing the gate, then asserts the notice appears
afterwards. I reproduced this in a scratch copy: it passes on the current code and is genuinely
non-vacuous (see §4).

I could not throttle the network in the MCP browser (no request interception exposed), so this one
claim rests on the jsdom gated-fetch test plus the structural `manifest &&` gate rather than on a
live in-flight observation. That is sufficient: the notice literally cannot render without a
manifest, and a manifest that has not arrived cannot produce `unknown`.

### 2b. Manifest fetch FAILS entirely (offline / 404 / malformed JSON)

**Correct. No incorrect "unknown category" notice.** Traced with three separate probes
(`/tmp` scratch, then removed):

| Scenario | hash after | category chips | `role="alert"` content |
|---|---|---|---|
| `fetch` rejects (`TypeError: Failed to fetch`) | `#cat=cs.CV,cs.BI` **unchanged** | 0 | only `"No paper index yet"` |
| HTTP 404 on `index.json` | `#cat=cs.CV,cs.BI` **unchanged** | 0 | only `"No paper index yet … (HTTP 404)"` |
| Malformed JSON body (`{not json`) | `#cat=cs.BI` **unchanged** | 0 | only `"No paper index yet"` + "The paper index is malformed…" |

The mechanism: on failure `loadManifest` only does `setError(message)`, `setManifestAttempts`,
`setManifestLoading(false)` (`App.tsx:109-111`) and **never sets `manifest`**. So `manifest` stays
`null`, `resolveCategories` returns `unknown: []`, and `App.tsx:315` suppresses the notice block
entirely. The user sees the pre-existing index-missing panel with a Retry, and their URL is left
alone so a later successful load restores their selection. This is exactly the "leave the hash alone
when the index never loads" behaviour AC-adjacent code should have, and it holds.

This is the highest-risk failure mode for this item (an incorrect notice here would be worse than
the original bug) and it is **not** present.

### 2c. Malformed `manifest.categories` must not empty every feed

**Mostly MET, with one pre-existing crash that is not an IMP-009 regression.**

- `categories: ["cs.CV", 7]` (non-string entry) → `urlState.ts:20-22` returns `unknown: []` and
  leaves `selected` intact. Feed rendered the `cs.CV` paper; **zero** alerts. ✅
- `categories: "cs.CV"` (string, not array) or `categories` **absent** → the app **crashes** with
  `TypeError: Cannot read properties of undefined (reading 'join')` at
  **`web/src/App.tsx:407`** (`manifest.categories.join(", ")` in the hero subheading).

  **This is pre-existing, not introduced here.** `git show HEAD:web/src/App.tsx | grep -n "manifest.categories.join"`
  returns the identical expression at HEAD line 375. I ran the string-categories probe against
  `HEAD`'s `App.tsx` and it failed the same way. It belongs to WEB-07 / manifest-shape validation
  (open item), and IMP-009's own guard is strictly defensive: `resolveCategories` itself never
  throws for these inputs, and the crash is downstream in untouched hero code. Not a blocker for
  IMP-009, but it is the sharpest remaining edge and I am recording it.

- `categories: []` (valid array, empty) → `resolveCategories` treats every requested key as unknown
  and the notice fires ("Unknown category: cs.CV", 0 chips, 0 articles). The implementer discloses
  this explicitly. `build_index.py` derives `categories` from papers, so it can never be `[]` in
  practice. Judgment call, correctly flagged, no AC impact.

### 2d. `null` selection ("all") stays distinguishable from an explicitly empty selection

**MET.** `resolveCategories([])` → `{ selected: [], unknown: [] }`; `resolveCategories(undefined)` →
`{ selected: null, unknown: [] }` (`urlState.ts:11-14`). `null` propagates to
`activeCategories ?? manifest.categories` at `App.tsx:290`, so "all chips pressed / full feed" stays
distinct from "`#cat=` / zero chips pressed / empty feed". Note `unknownCategories.length > 0` can
never be true for a `null` request, so "all" can never produce a notice.

UI rendering per hash state, verified in the browser:

| hash | chips pressed | notice | feed |
|---|---|---|---|
| *(none)* | all 5 | none | 2812 papers |
| `#cat=cs.CV,cs.BI` | `cs.CV` | names `cs.BI` | 783 papers |
| `#cat=cs.BI` | none | names `cs.BI` + Reset | 0 papers |

---

## 3. Regression check on `toggleCategory`

The implementer claims the earlier attempt's predicted bug at `App.tsx:228` — re-seeding the
selection from the *unvalidated* hash list — was real and is now fixed. **Confirmed real and fixed.**

`App.tsx:128-137` now reads:

```ts
const current = activeCategories;
```

instead of `urlState.categories ?? activeCategories`. Since `activeCategories` is
`resolveCategories(...)`'s already-intersected output (`:290`), a dropped key is structurally absent
from `current` and therefore cannot be written back by `writeHash(..., { categories: next })`.

The repo's own tests cover only the "add a chip while the notice is showing" direction
(`App.categories.test.tsx:163-183`). That is a click-path gap the original report would not have
caught, so I wrote **my own** probes in a `/tmp` scratch copy (`src/__tests__/Probe.click.test.tsx`,
since deleted) covering all four states. All passed on the current code:

| State | Seed | Action | Resulting hash | Unknown re-introduced? |
|---|---|---|---|---|
| A — all selected | *(no hash)* | click `cs.LG` | `#cat=cs.CV%2Ccs.AI` | no |
| B — none selected | `#cat=` | click `cs.AI` | `#cat=cs.AI` | no |
| C — notice showing | `#cat=cs.CV,cs.BI,cs.NOPE` | click `cs.LG` → `cs.LG` → `cs.CV` → `cs.AI` | `#cat=cs.CV%2Ccs.AI`, notice gone | **no — `cs.BI` never reappeared in any intermediate hash** |
| D — total miss | `#cat=cs.BI` | click `cs.CV` | `#cat=cs.CV`, feed recovers | no |

Plus a runtime `hashchange` probe: setting `#cat=cs.BI,cs.LG` *after* mount correctly re-intersects
to `cs.LG` pressed with the notice naming `cs.BI`.

Reproduced in a real browser too: on `#cat=cs.CV,cs.BI` I clicked `cs.LG`, `cs.LG` again, `cs.CV`,
then `cs.AI`. Settled state: `#cat=cs.CV%2Ccs.AI`, `cs.CV`+`cs.AI` pressed, `cs.LG` released, alert
gone, 1606 papers. `cs.BI` never appeared in any hash.

**Verdict: the regression is closed.** Had the fix not been made, state C would have re-written
`#cat=cs.CV,cs.BI` on the first chip click and the notice would have returned.

Adjacent pre-existing behaviour I checked and deliberately am *not* counting against this item: with
`#cat=cs.CV,cs.BI` the user can deselect `cs.CV` (the last surviving chip) and land on `#cat=` with a
bare "No papers match the current filters." and no explanation. This is WEB-17 / IMP-010 territory
(feedback for an explicitly empty selection) and behaves identically at `HEAD` for the plain
`#cat=cs.CV` case, so it is not a regression.

---

## 4. Non-vacuity of the new tests — independently established

Scratch copy at `/tmp/v009` (full `web/src` + symlinked `node_modules`), with `App.tsx` and
`urlState.ts` restored from `git show HEAD:` and the new test files left in place. Scratch has been
deleted.

`src/__tests__/App.categories.test.tsx` — **11 tests, 8 FAIL against HEAD production code:**

| Test | vs HEAD |
|---|---|
| keeps only categories the index knows about, and names the rest | ✗ |
| warns when none of the requested categories exist | ✗ |
| recovers the whole feed when the reset is clicked | ✗ |
| clicking a chip while the notice is showing does not carry the unknown value back | ✗ |
| surfaces no notice at all while the manifest is still in flight | ✗ |
| leaves the hash and the error panel alone when the index never loads | ✓ *(absence assertion — correctly passes pre-fix)* |
| shows no unknown-category notice for a plain feed | ✓ *(absence assertion)* |
| does not claim anything about an explicit empty selection | ✓ *(absence assertion)* |
| *drops trailing commas* / *tolerates trailing commas and spaces* | ✗ |
| *de-duplicates a repeated category key* | ✗ |
| *never validates cat, because the manifest is not in hand yet* | ✓ *(contract pin — passes both ways by design)* |

The rendered DOM captured from the `#cat=cs.BI` failure against HEAD is the original bug verbatim:
`"0 papers match"` + `"No papers match the current filters."` with **no `role="alert"` at all**.
That is a genuine end-to-end failure, not a missing-export artifact.

`src/lib/__tests__/urlState.test.ts` — **40 tests, 15 FAIL against HEAD** (`resolveCategories` is
`undefined`, so its 14 tests plus the new `de-duplicates a repeated category key` readHash test fail
with `TypeError: resolveCategories is not a function`). The 25 that pass are the 24 pre-existing
`readHash`/`writeHash` tests plus the `never validates cat` contract pin.

### No existing test weakened, skipped, or deleted

```
$ diff <(git show HEAD:web/src/lib/__tests__/urlState.test.ts) src/lib/__tests__/urlState.test.ts | grep '^<'
(no output — zero lines removed; pure addition)

$ grep -rn "\.skip\|\.todo\|\.only" web/src/
(no matches)
```

- `web/src/lib/__tests__/urlState.test.ts`: 24 tests at HEAD → **40** now, `^  it(` count
  24 → 40, all 24 original test names byte-for-byte intact. The IMP-143 additions are all still
  there, including the `// @vitest-environment node` directive at line 1 that its AC3 requires.
- `web/src/__tests__/App.relevance.test.tsx` (IMP-008 relevance) and
  `web/src/components/__tests__/feedControls.test.tsx` are absent from `git status` — i.e.
  **byte-identical to HEAD**. Untouched.
- `git status --porcelain` shows exactly the four expected paths: `M App.tsx`, `M urlState.ts`,
  `M urlState.test.ts`, `?? App.categories.test.tsx`. No deletions, no renames, nothing else.

### One factual error in the implementer's report (does not affect the code)

`.improve/reports/impl-IMP-009.md` claims "All 121 pre-existing tests still pass." The real
pre-change baseline is **113 tests / 9 files**, which I measured by running the suite with the
HEAD versions of `App.tsx`, `urlState.ts`, `urlState.test.ts` and with
`App.categories.test.tsx` removed:

```
 Test Files  9 passed (9)
      Tests  113 passed (113)
```

Arithmetic reconciles exactly: 113 + 16 (urlState) + 11 (App.categories) = 140. So the conclusion
("nothing lost") is right; only the number 121 is wrong.

---

## 5. Flake check — 15 runs, 0 failures

Ten consecutive default-order runs of `npm test` (`npx vitest run`), plus five with randomized test
order:

```
run1:  Tests  140 passed (140)   run6:  Tests  140 passed (140)
run2:  Tests  140 passed (140)   run7:  Tests  140 passed (140)
run3:  Tests  140 passed (140)   run8:  Tests  140 passed (140)
run4:  Tests  140 passed (140)   run9:  Tests  140 passed (140)
run5:  Tests  140 passed (140)   run10: Tests  140 passed (140)
=== SUMMARY: 10 clean / 0 with failures (of 10) ===

seed137:  Tests  140 passed (140)
seed274:  Tests  140 passed (140)
seed411:  Tests  140 passed (140)
seed907:  Tests  140 passed (140)
seed1024: Tests  140 passed (140)
```

**0 failures in 15 runs (10 default order + 5 shuffled).** Shuffle is the meaningful check here:
the pre-existing suites mutate shared module state (FakeCollectionStorage in
`App.relevance.test.tsx`, `beforeEach` adding a `hashchange` listener), so order dependence is the
realistic flake vector, and shuffled runs are stable.

**Pre-fix control sensitivity established — not merely assumed.** The §4 measurements are the
control: the same harness on the same test files, with only the production files reverted, produces
**8 failures in `App.categories.test.tsx`** and **15 failures in `urlState.test.ts`**. The harness is
demonstrably sensitive to the production change, so the 15 clean runs are meaningful.

I also inspected the tests for the usual flake vectors and found none: no shared mutable module
state in `App.categories.test.tsx` (`beforeEach` only assigns `window.location.hash`, `afterEach`
only `vi.unstubAllGlobals()`), no timers, no `act()` warnings, no snapshots, no reliance on
inter-test ordering.

---

## 6. Playwright — real behavior, my own observation

Server: `npm run preview -- --port 5199 --strictPort` from `web/`, ready on
`http://localhost:5199/research-paper-feed/` (matches `REPO_PROFILE.md:212`). Stopped afterwards;
`lsof -ti:5199` reports the port free.

- `#cat=cs.CV,cs.BI` → `cs.CV` only pressed; alert names `cs.BI`; "783 papers match"; papers render.
- `#cat=cs.BI` → notice names `cs.BI`; Reset present; reachable by 10 real `Tab` presses; `Enter`
  recovers; real mouse click recovers. Both paths land on `#`, all five chips pressed,
  "2812 papers match".
- Chip clicks in the live app never re-introduce a dropped category (§3).
- **Console: zero messages of any kind.** `playwright_browser_console_messages` returned empty after
  the initial load, after keyboard activation, after mouse click, and after the chip-click sequence.
  Network request log clean.

### Screenshots

| File | Size |
|---|---|
| `.improve/artifacts/IMP-009/feed-unknown-category-desktop-1280.png` | 1280×900 |
| `.improve/artifacts/IMP-009/feed-unknown-category-mobile-390.png` | 390×844 |
| `.improve/artifacts/IMP-009/verify-partial-desktop-1280.png` | 1280×900 (my own, `#cat=cs.CV,cs.BI`) |

**Screenshot-integrity corroboration:** my independent capture of `#cat=cs.CV,cs.BI` at 1280×900 is
**md5-identical** (`8df74abd45fb8731063d3bea1607bd25`) to the implementer's
`feed-unknown-category-partial-desktop-1280.png`. Same renderer, same viewport, same data, same byte
stream — so the implementer's screenshots are genuine captures of the real app, not mockups.

### Visual judgment — intentionally designed, not bolted on

Compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` and
`baseline-feed-index-missing-desktop-1280.png`.

- The notice reuses the app's own banner tokens: `banner banner--warning` resolves to
  `--warning-soft` background, `--warning-text`, `--radius-sm`, `1px solid var(--border)` at
  `web/src/styles.css:450-460` — the exact treatment `CollectionsView.tsx:185` uses for its
  import-error banner. Consistent, and it reads as a *warning* rather than an error, which is right:
  a mistyped hash is not a broken index.
- The control reuses `button button--ghost` (`styles.css:588-598`, `--accent-soft` / `--accent` /
  `--border`), already the app's established secondary-action pill in **7** places
  (`CollectionsView.tsx:71,91,101,139,215`, `PaperCard.tsx:131`). No new visual language invented.
- Placement is correct: it occupies the slot between the controls card and the result list, and it
  *supplements* rather than replaces "No papers match the current filters." — so the user sees both
  the explanation and the generic empty state.
- Typography matches the house pattern: amber copy at the same 0.9rem scale as
  "No papers match the current filters.", with the dropped key bolded — the same
  `<strong>Heading.</strong> body` shape as the index-missing card.
- At 390px the button wraps below the copy rather than overflowing or clipping. No horizontal
  scroll. Chips wrap as they do in the baseline.

No visual mismatch. Reusing existing classes was the right constraint, and the result does not look
like a workaround.

---

## 7. Findings, ranked

### Blocking
None.

### Non-blocking defects / advisories

1. **`App.tsx:407` crashes on a non-array or absent `manifest.categories`.**
   `manifest.categories.join(", ")` in the hero subheading throws
   `TypeError: Cannot read properties of undefined (reading 'join')`. Verified **pre-existing** (the
   identical expression is at `HEAD` line 375; the probe fails the same way against HEAD).
   `resolveCategories`' own guard is correct and defensive — the crash is entirely in untouched code.
   Belongs to WEB-07. *Actionable:* validate `manifest.categories` once at the fetch boundary in
   `paperIndex.ts` and treat a bad shape as `IndexUnavailableError`, which fixes the crash and gives
   the user a Retry instead of a white screen.

2. **Two `role="alert"` nodes can coexist.** If a *shard* load fails (`App.tsx:426`) while an
   unknown category is present (`App.tsx:443`), two `role="alert"` banners render simultaneously.
   Confirmed by probe: `TestingLibraryElementError: Found multiple elements with the role "alert"`.
   Both alerts are legitimate and both should be announced, so this is not a user-facing bug — but
   the test helper `unknownNotice()` (`App.categories.test.tsx:105`) uses the singular
   `screen.getByRole("alert")` and would break if a future test hit that state.
   *Actionable:* use `getAllByRole("alert")` and match on text content, or give the two banners
   distinct roles (e.g. keep `alert` for the load error and use `role="status"` for the advisory).

3. **`App.tsx:290` dead fallback.** `activeCategories = resolvedCategories ?? manifest?.categories ?? []`
   — `resolveCategories` returns `string[]`, never nullish, so the `??` chain can never fire. It
   implies a nullability the signature does not have. *Actionable:* drop to
   `const activeCategories = resolvedCategories;`.

4. **Report arithmetic.** `.improve/reports/impl-IMP-009.md` states 121 pre-existing tests; the
   real baseline is 113. Conclusion unaffected; the number should be corrected so a future reviewer
   does not chase the 8-test discrepancy.

5. **Disclosed judgment call: `manifest.categories: []`.** Treated as "everything is unknown", so a
   valid hash produces a total-miss notice. Unreachable via `build_index.py` (categories are derived
   from papers, so an empty corpus also means zero shards). Correctly disclosed in the report and
   correctly decided not to be blocked on.

6. **Uncovered by repo tests (I verified it manually, recommend adding it):** the *deselect*
   direction of `toggleCategory` while the notice is showing — i.e. click a chip off, not just on.
   `App.categories.test.tsx:163-183` only covers adding. The bug class this item was rejected for is
   exactly the round-trip re-seeding, and the deselect direction is the other half of it. My probes
   cover it and it passes, but a regression there would not be caught by CI.

---

## 8. Verdict rationale

All three acceptance criteria are met, verified against the **rendered output** rather than a
library function — the precise failure that caused the previous rejection. The async analysis found
no in-flight flash, no incorrect notice on manifest failure (offline / 404 / malformed JSON all leave
the hash untouched and render only the index-missing panel), and correct pass-through for malformed
category lists. The `toggleCategory` regression is genuinely fixed and verified across all four
selection states in both jsdom and a real browser. Every new test was proven non-vacuous by
reverting the production files in a `/tmp` scratch copy. Nothing was weakened, skipped, or deleted;
the HEAD suite is 113 tests and all 113 survive. 15 consecutive and shuffled runs are clean with an
established-sensitive control. The notice is visually consistent with the app and passes keyboard
and screen-reader expectations. Remaining findings are one pre-existing crash outside this item's
scope and four cosmetic or test-hygiene advisories, none of which affect any AC.