# Recon Report — WEB AREA (`web/` React + Vite app)

Scope: `web/index.html`, `web/vite.config.ts`, `web/tsconfig.json`, `web/package.json`,
`web/src/main.tsx`, `web/src/App.tsx`, `web/src/styles.css`,
`web/src/components/{CollectionsView,FeedControls,PaperCard,PaperList}.tsx`,
`web/src/lib/{collections,paperIndex,search,types}.ts`,
`web/src/lib/__tests__/{collections,paperIndex,search}.test.ts`.

Read-only recon. Nothing under `web/src` was modified.

---

## 1. Verification command results

Run from `web/`:

| Command | Result |
|---|---|
| `npm test` (`vitest run`) | **PASS** — 3 files, **36 tests**, ~1.1 s |
| `npm run typecheck` (`tsc --noEmit`) | **PASS** — clean, no output |
| `npm run build` (`tsc --noEmit && vite build`) | **PASS** — 38 modules, `dist/assets/index-*.js` 163.17 kB (gzip 52.40 kB), `index-*.css` 10.93 kB (gzip 2.86 kB), ~1.0 s |
| lint | **NO LINT EXISTS.** `package.json:6-13` defines no `lint` script, there is no `eslint.config.*`/`.eslintrc*` in `web/`, and `eslint` is not in `node_modules` or `devDependencies` (`web/package.json:18-25`). `.github/workflows/ci.yml:35-38` runs only typecheck + test. Dead `npx eslint` will not work as a gate. |

Green across the board, so **no defect here will be caught by CI**. Coverage tooling is also absent (`@vitest/coverage-v8` is not a dependency), so coverage cannot be measured without a new install.

---

## 2. Architecture and data loading — how it actually works

Intent (matches `readme.md:13-31`): a fully static site. No browser→arXiv calls ever happen. A
scheduled Python Action runs `scripts/build_index.py`, writes a sharded JSON index into
`web/public/data/` (`build_index.py:34`), and the browser `fetch`es only the week shards it needs.

- Manifest fetch: `PaperIndex.fetchManifest` at `web/src/lib/paperIndex.ts:73-98`, URL from
  `dataBase()` (`paperIndex.ts:30-33`), which correctly honors `import.meta.env.BASE_URL`
  (`web/vite.config.ts:5` sets `base: "/research-paper-feed/"`).
- Manifest promise memoized in `PaperIndex.manifestPromise` (`paperIndex.ts:62`, `66-71`).
- Shard fetch + cache: `loadShard` (`paperIndex.ts:100-127`), cached by `shard.file` in a
  `Map` (`paperIndex.ts:64`, `125`). Widening the window therefore only fetches new weeks —
  a real, correct optimization.
- Window selection: `latestIndexDate` (`paperIndex.ts:36-44`) anchors the window to the newest
  date **in the index**, not to today; `windowStart` (`paperIndex.ts:47-51`) and `selectShards`
  (`paperIndex.ts:54-59`) compute the overlap. String comparison of `YYYY-MM-DD` is
  lexicographically correct.
- All-or-nothing load: `Promise.all` over the needed shards (`paperIndex.ts:150-157`).
- App wiring: `App.tsx:148-196` (manifest, then papers on `[manifest, urlState.recency]`).
- State derivation: `visiblePapers` at `App.tsx:207-224`.

This is a well-chosen design — sharding, caching, and progressive shard selection are all
correct and tested.

---

## 3. Feature-by-feature audit

### 3.1 Data loading: loading / error / empty states

**Intent:** three-state rendering — loading, error, results — for both the manifest and the paper set.

**Complete:** manifest loading (`App.tsx:378-382`) and paper loading (`App.tsx:414-419`) both
have `role="status"` text; the manifest-missing case has a dedicated error panel
(`App.tsx:364-376`); feed-empty and filter-empty are distinguished (`App.tsx:429-433`).

**Bugs and rough edges:**

1. **A rejected manifest is cached forever — no retry is ever possible.**
   `paperIndex.ts:66-71` assigns `this.manifestPromise = this.fetchManifest()` and only ever
   checks `if (!this.manifestPromise)`. On rejection the rejected promise stays memoized, so every
   later `loadPapers` (`paperIndex.ts:138`) re-rejects. The manifest effect runs once
   (`App.tsx:148-166`, `[]` deps), and there is no retry button anywhere. **The only recovery is a
   full page reload.** This is the single most user-visible data-loading defect.

2. **One bad shard kills the whole window.** `paperIndex.ts:150` `Promise.all` — a single 404 or
   malformed shard rejects everything, discarding the 8 shards that did load. No partial results,
   no per-shard tolerance. `loadShard` throws for non-`ok` (`paperIndex.ts:105-110`) and for a
   malformed body (`paperIndex.ts:120-124`).

3. **Error state contradicts itself.** When papers (not the manifest) fail, `manifest` is truthy, so
   the hard error panel is skipped (`App.tsx:364`), a bare warning banner renders
   (`App.tsx:408-412`), `loading` is `false`, and `PaperList` renders with `papers === []` →
   `emptyMessage` resolves to **"No papers are available in this window yet."** (`App.tsx:430-431`).
   So a load failure is reported to the user as *absent data*. Misleading error messaging.

4. **Raw technical text is surfaced verbatim.** `App.tsx:409-411` prints the raw `Error.message`
   from `paperIndex.ts:107`/`121` ("Failed to load papers-2024-W14.json (HTTP 404)."). No
   human-oriented wording, no retry affordance.

5. **Developer instructions are shown to production visitors.** `App.tsx:366-374` tells any visitor
   of the deployed Pages site to "Build the index locally: `python scripts/build_index.py`", and
   `INDEX_HELP` (`paperIndex.ts:26-28`) says the same thing. The panel then *repeats the same
   instruction twice* in `<pre>` blocks (`App.tsx:369-374`). This is useless on the live site and
   should be gated on `import.meta.env.DEV`.

6. **Progress counter shows stale values.** `progress` (`App.tsx:145`) is never reset when a new
   load starts (`App.tsx:173` only does `setLoading(true)`), so switching 60d→7d briefly renders the
   previous window's totals ("Loading papers from 9 weeks… (9/9)"). Also, `latestIndexDate`
   returning `null` early-returns at `paperIndex.ts:140-142` **before** the `onProgress` call at
   `paperIndex.ts:148`, leaving `{loaded:0,total:0}` → "Loading papers from 0 weeks… (0/0)".

7. **Shards validated only by cast.** `paperIndex.ts:111-114` casts the parsed JSON to
   `Paper[]` with no field validation. A shard with a missing `abstract` makes `PaperCard.tsx:45`
   (`paper.abstract.length`) throw **inside render**, and there is no error boundary
   (`main.tsx:12-15` has no `<ErrorBoundary>`), so the whole app blanks to a white page.

8. **No request cancellation.** `App.tsx:149`/`194` use a `cancelled` boolean to ignore stale
   results, but in-flight shard fetches are never aborted (no `AbortController` anywhere). Rapid
   7→60→7 toggling fans out overlapping duplicate `Promise.all` bursts. Under `StrictMode`
   (`main.tsx:13`) mount effects double-invoke, so the first load can double-fetch every shard
   (the `Map` cache only helps once the first `await` resolves).

9. **The whole list unmounts on every recency change.** `App.tsx:173-175` flips `loading` to
   `true`, and `App.tsx:414-420` swaps `PaperList` for a `<p>`. Consequences: scroll position is
   lost, every card's local `expanded` state (`PaperCard.tsx:40`) is destroyed, and any open
   "Save to collection" `<details>` closes — even though the shards are usually already cached and
   the reload is effectively instant. No skeleton, no retention of the previous list.

### 3.2 Search, filtering, sorting

**Intent:** implicit-AND token search with quoted phrases, title > author > abstract weighting,
plus category / recency / sort filters. All three are implemented and unit tested.

**Complete:** `tokenize` (`search.ts:22-43`), `scorePaper` (`search.ts:50-77`), `rankPapers`
(`search.ts:80-91`); the recency filter pushes down into shard selection rather than filtering a
full corpus client-side.

**Bugs and rough edges:**

10. **Relevance sort silently degrades to date sort, with the chip still lit.**
    `visiblePapers` short-circuits on an empty query and returns `inCategories` unchanged
    (`App.tsx:215-218`) — which `loadPapers` sorted newest-first (`paperIndex.ts:159-162`).
    Meanwhile `FeedControls` renders the Relevance chip as `chip--active` / `aria-pressed="true"`
    whenever `sort === "relevance"` (`FeedControls.tsx:92`) and merely *disables* it when the query
    is empty (`FeedControls.tsx:94`). So clearing the search box, or opening a shared
    `#sort=relevance` link with no `q`, produces a date-ordered list that the UI labels
    "Relevance". No message explains the discrepancy. (`readHash` happily accepts
    `sort=relevance` with an empty query — `App.tsx:57`.)

11. **Hash-supplied categories are never validated against the manifest, and unknown ones become
    invisible, unremovable filters.** `readHash` passes `cat` straight through
    (`App.tsx:47-55`) with no intersection with `manifest.categories`. `FeedControls` only iterates
    `categories` (the manifest list, `FeedControls.tsx:50`) while `activeCategories`
    (`App.tsx:198-201`) may contain extras. So `#cat=cs.CV,cs.BI` filters by both, renders only
    cs.CV as pressed, and the user **cannot see or remove `cs.BI` from the UI**. A typo or a
    stale shared URL silently yields an empty feed.

12. **"All categories" is not representable.** With no explicit selection (`categories === null`),
    `activeCategories` becomes all five (`App.tsx:199`), so all five chips render pressed
    (`FeedControls.tsx:51`). Toggling one off converts that to an explicit 4-element array
    (`App.tsx:253-259`) — the UI looks right, but there is then **no way back to "all"** except
    re-toggling all five individually, and once set, `writeHash` (`App.tsx:69-71`) permanently
    emits `cat=` into the URL. There is no explicit "All" affordance.

13. **Deselecting every category silently empties the feed.** `categories: []` →
    `new Set([])` at `App.tsx:208` matches nothing → the generic "No papers match the current
    filters." message. No "you have no categories selected" state.

14. **`retentionDays` is read by nothing.** `types.ts:25` declares it, `build_index.py:186` writes
    it, but no web code consumes it. `FeedControls` hardcodes `[7, 30, 60]`
    (`FeedControls.tsx:16`) and `RECENCY_VALUES` in `App.tsx:26` mirrors it. If the index is built
    with `--retention-days 30`, the "60 days" chip promises data that does not exist and silently
    returns the same result as 30 days. `readme.md:30` documents a 60-day window, but that is a
    default, not a guarantee. Similarly `ShardManifestEntry.count` and `.from`
    (`types.ts:18-20`) and `ShardFile.week`/`.from`/`.to` (`types.ts:32-35`) are never used —
    `paperIndex.ts:58`, `:74-75`, `:117` touch only `.to`, `.file`, `.papers`.

15. **Substring matching, no word boundaries, no stemming.** `search.ts:62`, `:68-74` use
    `String.includes`, so `net` matches "network" and `inert` matches "inertia". Undocumented and
    surprising; it also means the title/author/abstract weight tiers can be mis-assigned (a term
    appearing only as a substring of an author's name counts as an *author* match at weight 2,
    `search.ts:70`).

16. **Multi-word author search is broken by design of the author join.** `search.ts:56` joins
    authors with a single space, so `"visual inertial"` cannot span a name boundary, but
    `tokenize` splits it into two tokens and the abstract fallback usually rescues it — the weight
    tier is then wrong. Minor.

17. **`Paper.updated` is never surfaced.** `types.ts:8` is populated by `build_index.py:109` but no
    component reads it, so a v2 revision of a paper is indistinguishable from v1.

### 3.3 Collections and localStorage

**Intent:** multiple named collections of full paper snapshots, persisted per browser, with JSON
export/import. This is the most thoroughly designed and best-tested part of the app.

**Complete and correct:** runtime validation on both read paths (`collections.ts:51-75`,
`:240-276`), orphan pruning (`collections.ts:78-92`), reference-counted removal
(`collections.ts:169-182`), and defensive storage access (`collections.ts:229-238`,
`:279-292`). `loadState` drops `paperIds` with no snapshot (`collections.ts:268`), which
correctly satisfies the `readme.md:31` snapshot-independence claim.

**Bugs and rough edges:**

18. **Import gives zero feedback, and can silently no-op.** `handleImport` (`App.tsx:308-310`)
    dispatches and nothing else. `CollectionsView` only renders `importError`
    (`CollectionsView.tsx:163`, `:228-232`), so a *successful* import is invisible. Worse,
    `mergeImport` (`collections.ts:105-107`) returns early when the collection id already exists —
    the papers are still merged into `state.papers` (`:98-103`) but no collection is added and the
    user is told nothing. Importing the same export twice looks like nothing happened.

19. **That same path leaks permanent orphan snapshots.** `mergeImport` adds papers at
    `collections.ts:98-103` *before* the collision check, and `mergeImport` never calls
    `prunePapers`. `prunePapers` only runs from `deleteCollection` and `removePaper`
    (`collections.ts:150`, `:170`), so those unreferenced snapshots persist in `state.papers`,
    get serialized to localStorage on the next save, survive `loadState` (`loadState` prunes
    `paperIds` but not `papers`), and are re-saved indefinitely.

20. **`saveState`'s failure return is discarded — quota errors are silent.**
    `saveState` deliberately returns `false` instead of throwing (`collections.ts:279-292`, and it
    is tested: `collections.test.ts:303-306`), but `App.tsx:231-235` ignores the return value.
    When storage fills, the user gets **no warning at all** while believing their saves worked.

21. **The two storage keys are written non-atomically, which can silently lose saved papers.**
    `collections.ts:287-288` writes `rpf.collections.v1` then `rpf.papers.v1` in one `try`. If the
    second `setItem` throws (quota), the collections list is already updated while the snapshots
    are not. On reload, `loadState:268` filters out every `paperId` with no snapshot → **the
    collection reappears empty.** No versioning or ordering fix exists.

22. **Every dispatch triggers a full synchronous re-serialize of the entire state.**
    `App.tsx:231-235` runs on `[collections]`; `saveState` does two `JSON.stringify` of all
    collections plus every stored paper snapshot. One checkbox click therefore serializes
    potentially hundreds of KB on the main thread. No debounce.

23. **`addPaper` mutates state identity even when it changes nothing.**
    `collections.ts:164-167` unconditionally returns `papers: { ...state.papers, [id]: paper }`.
    A redundant `addPaper` (id not in any collection, or already present) still produces a new
    `collections` array and a new `papers` object → new state identity → full re-render of every
    card plus another localStorage write. Also, `addPaper` never validates `collectionId` and never
    prunes, so a stale id silently orphans a snapshot (same class as #19).

24. **`EMPTY_STATE` is a shared mutable module singleton returned on every failure path**
    (`collections.ts:33`, returned at `:245`, `:274`). It is safe *today* only because the reducer
    is copy-on-write. It is a latent aliasing hazard, and the test at
    `collections.test.ts:286-290` (`toEqual(EMPTY_STATE)`) passes trivially because it compares the
    same reference.

25. **Dead code in `mergeImport`.** `collections.ts:121`:
    `{ ...payload.collection, name: payload.collection.name, paperIds }` — the explicit
    `name: payload.collection.name` overrides the spread with the identical value. A leftover from a
    rename/dedupe idea that was never implemented. `version` is also ignored on import
    (`parseExportPayload` hardcodes `version: 1` at `collections.ts:219` without checking
    `candidate.version`), so a future incompatible format would import silently.

26. **No URL scheme validation on imported papers.** `isPaper` (`collections.ts:51-62`) checks only
    `id`/`title`/`authors`/`abstract` — **not `absUrl`/`pdfUrl`**, which are then rendered as
    `href` values at `PaperCard.tsx:57`, `:91`, `:100`, `:103`. A hand-crafted export with
    `absUrl: "javascript:…"` or any unexpected scheme is persisted and rendered as a link. React
    escapes the surrounding text, so this is not HTML injection, but an `https?:` allowlist is
    cheap and clearly missing.

27. **No size bound on the import file.** `CollectionsView.tsx:171` `await file.text()` on an
    arbitrary user-chosen file; a multi-gigabyte file will hang the tab.

28. **`handleExport` revokes the object URL synchronously after `click()`** (`App.tsx:303-305`).
    This is a known cross-browser download hazard (Firefox can cancel the save when the blob URL is
    revoked in the same tick). Standard fix is a deferred revoke. Also, the `<a>` is only removed
    on the happy path — a throw from `click()` leaks it into the DOM.

### 3.4 Deep-linking and URL state

**Intent:** make the feed shareable/bookmarkable. `readHash`/`writeHash` (`App.tsx:38-85`) round-trip
`view`, `q`, `cat`, `recency`, `sort` through `URLSearchParams`, and a `hashchange` listener keeps
them in sync (`App.tsx:130-134`). **Filter state does survive a refresh** — the core requirement is
met, and it degrades safely on unknown values (`App.tsx:43-45`, `:50`, `:57`).

**Rough edges:**

29. **Bare `#` is always written.** `writeHash` (`App.tsx:79`) builds `hash = "#" + params` even when
    every value is at its default, so the canonical URL for the default view becomes `…/#` instead
    of `…/`.

30. **History semantics are inconsistent.** `setView` pushes (`App.tsx:238`), but query, recency,
    sort, and category all replace (`App.tsx:242`, `:247`, `:251`, `:258`). So Back undoes a view
    switch but silently ignores every filter change. Defensible (avoids history spam), but it means
    a Back-heavy workflow cannot undo a category toggle.

31. **Collections are not deep-linkable at all.** There is no `#collection=<id>` and no anchor, and
    `CollectionsView` is fully unmounted when `view === "feed"` (`App.tsx:347`) — so switching tabs
    discards any in-progress rename draft or file-import state. A single collection cannot be shared.

32. **No per-paper deep link.** There is no `#paper=2401.12345` anchor, so no individual paper is
    linkable and `#main` (the skip-link target, `App.tsx:316`) is the only fragment target.

### 3.5 Components: props, responsiveness, virtualization, performance

**`PaperCard`** (`PaperCard.tsx`) — `paper` required; `collections`, `isSaved`,
`onToggleCollection`, `onCreateCollection`, `actionSlot` all optional, and the save menu is
conditionally rendered only when all four callbacks are present (`PaperCard.tsx:41-42`). Clean
optional-API design; `CollectionsView` uses `actionSlot` (`CollectionsView.tsx:136-144`) to inject a
Remove button, and `PaperList` supports a `renderAction` escape hatch (`PaperList.tsx:20`, `:52`) —
**but nothing in the app passes `renderAction`**, so it is unused dead API.

Performance — this is the weakest area:

33. **No memoization anywhere; a full re-render of every visible card on every keystroke.**
    `PaperCard` and `PaperList` are not wrapped in `React.memo` (`PaperCard.tsx:32`,
    `PaperList.tsx:24`), `isSaved` is re-created on every `App` render (`App.tsx:261-266`), and
    `PaperList` forwards it to every card (`PaperList.tsx:49`). With 50 visible cards, **each
    character typed re-renders all 50**, each re-evaluating its `useMemo` abstract (`PaperCard.tsx:44`)
    and rebuilding its `<details>` subtree.

34. **Near-quadratic `isSaved`.** `App.tsx:261-266` scans every collection's `paperIds` with
    `Array.includes`; `PaperCard.tsx:117` calls it once per collection. Per render that is
    `visibleCount × collections × avgPaperIds` string comparisons — e.g. 50 × 10 × 100 = **50,000
    comparisons per keystroke**, and per checkbox toggle.

35. **`scorePaper` re-lowercases everything on every keystroke, with no precomputed index.**
    `search.ts:55-58` builds `title`, `authors`, `abstract` (three `toLowerCase()` calls) plus a
    `combined` template string **for every paper, on every keystroke**. `visiblePapers`
    (`App.tsx:207-224`) is memoized only on `[papers, activeCategories, query, sort]` — i.e. it
    recomputes exactly when the query changes. At a plausible 10k–20k papers in a 60-day window with
    500-char abstracts, that is ~12 M chars lowercased plus ~12 MB of string garbage **per
    keystroke**, and in relevance mode it also `.map()`s and `.sort()`s the whole corpus
    (`search.ts:82-90`). There is no debounce, no `useDeferredValue`, and no precomputed
    normalized/haystack field.

36. **`history.replaceState` fires on every keystroke.** `App.tsx:241-243` → `writeHash` `:83`.
    Browsers throttle history calls (Safari throws *"Throttling navigation to prevent the browser
    from hanging"* past roughly 100 calls / 10 s), so a fast typist can produce console errors and
    dropped history state. A debounced or coalesced hash write is needed.

37. **No virtualization or windowing.** The feed pages by slicing (`PaperList.tsx:39`,
    `visibleCount` from `App.tsx:146`, `:424`) with an unbounded "Load more" — at 5,000 papers the
    user can mount 5,000 full `PaperCard`s. There is no `content-visibility: auto` on `.paper`
    either, which would be a one-line win.

38. **The collections view has no cap at all.** `CollectionsView.tsx:131-147` renders *every* saved
    paper in *every* collection, with no `visibleCount` equivalent. A single collection with 500
    papers mounts 500 full cards — inconsistent with the feed's 50-at-a-time paging.

39. **`CollectionSection` is un-memoized and receives the whole state** (`CollectionsView.tsx:30-37`,
    `:240-250`), so any change to any collection re-renders every section and re-maps all of its
    `paperIds` (`CollectionsView.tsx:41-43`).

40. **Duplicated page-size constants that must agree.** `PAGE_SIZE = 50` (`App.tsx:24`) and
    `LOAD_MORE_STEP = 50` (`PaperList.tsx:6`). `PaperList.tsx:62` prints
    `Load ${Math.min(LOAD_MORE_STEP, remaining)} more` while `App.tsx:424` increments by
    `PAGE_SIZE` — if they ever diverge, the button label lies about how many items appear.

Responsiveness: one breakpoint, `@media (max-width: 520px)` (`styles.css:720-753`), which stacks the
header, reduces card padding, and column-stacks the card footer. Reasonable but coarse — between
520 px and `--max-width: 1000px` (`styles.css:20`) the chip rows and search field get cramped, and
there is no intermediate layout. The "Load more" button uses `align-self: center`
(`styles.css:550-552`) inside a `flex-direction: column` list, which works.

### 3.6 Accessibility

Genuinely good: skip link (`App.tsx:316-318`), semantic `header`/`nav`/`main`/`footer`
(`App.tsx:320-455`), `aria-current="page"` on nav (`App.tsx:327`, `:337`), `aria-pressed` on all
toggle chips (`FeedControls.tsx:57`, `:75`, `:92`), `fieldset`+`legend` grouping
(`FeedControls.tsx:47-105`), `.sr-only` search label (`FeedControls.tsx:33-35`), `<time dateTime>`
(`PaperCard.tsx:62`), `aria-label` on sections (`CollectionsView.tsx:46`,
`FeedControls.tsx:31`), consistent `:focus-visible` ring (`styles.css:86-90`), and no icon-only
buttons anywhere (all buttons are text-labeled), so the SR-label-on-icon-button class of bug does
not apply.

**Real defects (contrast measured, WCAG 2.1 ratios computed from the token values):**

41. **The search input loses its focus ring on keyboard focus.** `styles.css:218-221` sets
    `outline: none` on `.controls__search input:focus`, which matches keyboard focus and overrides
    the global `:focus-visible` outline at `styles.css:86-90`. Only a 1 px `--accent` border-color
    change remains — a sub-3:1, easily missed indicator on the app's primary input.

42. **The file-import input has an effectively invisible focus indicator.**
    `styles.css:638-644` renders the `<input type="file">` at `1px × 1px; opacity: 0`. It remains
    focusable, so a keyboard user *can* reach it, but the `:focus-visible` outline lands on an
    invisible 1 px element. `CollectionsView.tsx:215-225`.

43. **The paper list has no list semantics.** Both `PaperList.tsx:43` and
    `CollectionsView.tsx:131` use `<div className="paper-list">` wrapping `<article>` elements.
    A screen-reader user navigating by list finds nothing; there is no `role="list"`/`<ul>`.

44. **Heading hierarchy is broken in both views.** The feed goes `<h1>` (`App.tsx:387`) → `<h3>`
    (`PaperCard.tsx:56`), skipping `<h2>`. The collections view has **no `<h1>` at all** — it opens
    straight to `<h2>` (`CollectionsView.tsx:81`). Also, `PaperCard` is used at both nesting levels,
    so the correct fix is a prop-driven heading level, not a one-line tag swap.

45. **The skip-link target is not focusable.** `App.tsx:316` links to `#main` and `App.tsx:346` is
    `<main id="main">` with no `tabIndex={-1}`, so activating the skip link does not move keyboard
    focus — the next Tab can resume from the document top in several browsers.

46. **The result count is a live region that fires on every keystroke.**
    `FeedControls.tsx:108-110` is `role="status" aria-live="polite"` (the `aria-live` is redundant
    with `role="status"`), so a screen reader announces "N papers match" after **each character**.
    This should be debounced, or the region should not be live.

47. **"Show more" has no `aria-expanded`/`aria-controls`.** `PaperCard.tsx:80-87` toggles
    `expanded` but exposes no expansion state to assistive tech.

48. **The "Save to collection" disclosure has no focus management or Escape handling.**
    `PaperCard.tsx:111-167` uses a native `<details>`, so the expanded state *is* announced, but
    focus is never moved into the panel, Escape does not close it, and outside clicks do not close
    it. It also renders a checkbox list with no `role="menu"`/`aria-label`, and the popover is
    absolutely positioned with no collision handling against the viewport edge.

49. **Contrast failures in light mode only (dark mode passes: 5.44–6.48).** Measured from the
    tokens in `styles.css:1-45`:

    | pair | ratio | needed | where |
    |---|---|---|---|
    | `--text-muted` on `--surface` | **4.32** | 4.5 | `.paper__meta` authors/date (0.83 rem), `.controls__count`, `.empty`, `.paper__note`, `.panel--error` body, `.collection__count` |
    | `--text-muted` on `--surface-muted` | **3.79** | 4.5 | `.tag` (0.72 rem), inactive `.chip`, `.controls__group legend` (0.72 rem) |
    | `--text-muted` on `--bg` | **4.11** | 4.5 | `.site-footer` |

    Darken `--text-muted` (`styles.css:9`) or shift it per surface to clear 4.5:1. Separately,
    `--border` on `--surface` is **1.27:1**, below the 3:1 WCAG 1.4.11 requirement for the 1 px
    input borders at `styles.css:214` — form field boundaries are not perceivable.

50. **The reduced-motion block is dead code and does not do its job.**
    `styles.css:755-759` only sets `scroll-behavior: auto !important`, and **nothing in the
    stylesheet ever sets `scroll-behavior`** — so the rule has zero effect. Meanwhile every
    transition and transform keeps running for reduced-motion users: `.paper:hover`
    `translateY(-2px)` (`styles.css:306-310`), `.button:hover` `translateY(-1px)`
    (`styles.css:439-442`), and the transitions at `:157`, `:265`, `:303`, `:436`.

51. **No `forced-colors` (Windows High Contrast) support.** The design leans on `box-shadow`
    (`styles.css:19`, `:201`, `:302`), `backdrop-filter` (`:118`), and `color-mix` (`:117`, `:309`)
    — all of which collapse in forced-colors mode, with no `@media (forced-colors: active)` block
    to compensate.

52. **Rename form has no focus restoration.** `CollectionsView.tsx:64` uses `autoFocus`, but neither
    Cancel nor Save moves focus back to the Rename button — the input unmounts and focus falls to
    `<body>`.

53. Minor: `FeedControls.tsx:108` `aria-live` duplicates `role="status"`; empty-state `<p>` elements
    (`PaperList.tsx:36`, `CollectionsView.tsx:127`, `:235`) have no `role="status"`, so the
    loading→empty transition is unannounced; `App.tsx:340` embeds the collection count in the button
    label text.

### 3.7 UX polish

- **No citation copy at all.** `PaperCard.tsx:99-106` offers only "arXiv" and "PDF" links. There is
  no "Copy citation", "Copy BibTeX", or "Copy link". For a research feed this is the most obvious
  missing feature, and it pairs naturally with a per-paper deep link.
- **No export/import success feedback** (#18), no toast region, no undo for delete (only
  `window.confirm`, `CollectionsView.tsx:111-118`).
- **No retry** on any error (#1, #4).
- **Empty create-collection input submits silently** — `CollectionsView.tsx:198-201` and
  `PaperCard.tsx:150-153` both no-op with no validation message and no `required` attribute.
- **Static blank page before hydration** — `index.html:20` is an empty `<div id="root">`, with no
  `<noscript>` fallback and no skeleton.
- **Empty `role="status"` flash on every load** (#6).
- **Loses card state on filter change** (#9).

### 3.8 Styling

Strengths: a real token layer (`styles.css:1-26`) covering color, radii, shadow, fonts, and max-width;
a symmetric dark-mode override (`:28-45`); **zero inline styles anywhere** in `src/` (verified by
grep), so nothing fights the stylesheet; BEM-ish class naming; one consistent focus-ring rule.

**Rough edges:**

54. **No spacing scale.** ~30 distinct hardcoded `rem` values (`:118`, `:124`, `:176`, `:205`,
    `:294`, `:387`, `:613`, `:696`…) with no `--space-*` tokens. The vertical rhythm is
    correspondingly inconsistent: `.paper-list` `gap: 1.1rem` (`:294`) vs `.collection .paper-list`
    `gap: 0.85rem` (`:687`), `.paper` padding `1.4rem 1.5rem` (`:301`) vs `1rem` on mobile (`:741`).
55. **Primary button legibility is coupled to the page-background token.** `.button` uses
    `color: var(--bg)` on `background: var(--text)` (`:433-434`). Both themes happen to clear 16:1
    today, but any future `--bg` tweak silently inverts the primary action's contrast.
56. **Elevation semantics invert between themes.** `--surface-muted` is *darker* than `--surface` in
    light mode but *lighter* in dark (`:6`/`:31`), so `.tag` and `.chip` sit "above" cards in one
    theme and "below" in the other.
57. **No print styles at all** — no `@media print` block. Printing a paper list emits the sticky
    translucent header, `backdrop-filter`, hover transforms, and a full page of abstracts.
58. **No manual theme control** — `prefers-color-scheme` only (`styles.css:28`), no toggle and no
    `:root[data-theme]` override, despite `color-scheme: light dark` already being declared (`:2`).
59. **Only one breakpoint** (`:720`); no landscape/tablet treatment, and the controls row is left
    ragged because the three fieldsets have unequal intrinsic widths.
60. **`backdrop-filter` without `-webkit-` prefix** (`styles.css:118`).
61. **Semantic HTML/date inconsistency:** `PaperCard.tsx:62` uses `<time dateTime>`, but the hero's
    "index generated" date (`App.tsx:391` via `formatGeneratedAt`, `App.tsx:106-116`) is plain text
    in a locale-dependent format with no machine-readable value.
62. **Third-party render-blocking font load** (`index.html:11-16`) with no `font-display` fallback
    beyond `swap`, on a site that otherwise stores everything locally.

### 3.9 SEO / metadata

63. **`index.html` has no Open Graph or Twitter card tags, no canonical URL, no `theme-color`,
    no `robots`/OG image.** Only `title` and `description` (`:17`, `:6-9`). No `robots.txt`, no
    `404.html`. Note: the favicon `href="/favicon.svg"` (`:10`) *is* correctly rewritten by Vite to
    `/research-paper-feed/favicon.svg` in the built output (`dist/index.html:10`), so this one is
    fine.

### 3.10 Test quality

**What the three files actually assert (36 tests, all passing):**

- `search.test.ts` (12 tests) — solid. Covers `tokenize` plain/quoted/unterminated/empty,
  `scorePaper` implicit-AND, title>abstract weighting, phrase bonus, phrase contiguity, empty-token
  neutrality, and `rankPapers` filtering + tie-break ordering. This is the best-written test file.
- `collections.test.ts` (14 tests) — solid. Covers `createCollection`, `addPaper` dedupe,
  rename-blank rejection, orphan pruning across two collections, `mergeImport` id-collision,
  `exportCollection` (incl. unknown id → `null`), `parseExportPayload` accept/reject/drop-invalid,
  and `loadState`/`saveState` round-trip, malformed-JSON tolerance, dangling-`paperId` drop, and
  throwing-storage degradation. It also ships a good `MemoryStorage` fake (`:32-58`) and a
  `THROWING_STORAGE` fake (`:60-79`) — genuinely reusable. Gaps: no test that `saveState`'s
  *partial* write leaves state inconsistent (#21), no test for the `mergeImport` orphan leak (#19),
  no test for the dead `name:` override (#25), and `#24`'s aliasing is masked by `toEqual` on a
  shared singleton.
- `paperIndex.test.ts` (10 tests) — good. Covers `latestIndexDate`, `windowStart`, `selectShards`,
  404 manifest, network-throw manifest, HTML-fallback-as-unavailable (a subtle SPA-fallback case
  handled well at `paperIndex.ts:85`), window filtering, newest-first ordering, progress reporting
  **plus shard-cache reuse** (`fetch` call-count assertion, `:182-192`), and the empty-manifest
  case. Gaps: no test for a **single failing shard rejecting the whole `Promise.all`** (#2), none
  for the **memoized rejected manifest** blocking retry (#1), none for the missing-content-type /
  malformed-JSON shard paths (`paperIndex.ts:111-124`), none for `dataBase()`/`BASE_URL`.

**What is untested — this is the real finding:**

64. **There is no component-test infrastructure at all, and it is structurally impossible today.**
    - `web/package.json:18-25` has **no** `@testing-library/react`, **no** `jsdom`, **no**
      `happy-dom`, **no** `@vitest/coverage-v8`.
    - `web/vite.config.ts:8` sets `environment: "node"` (no DOM), and `:9` sets
      `include: ["src/**/*.test.ts"]` — **the glob does not match `.tsx`**, so a component test
      could not even be collected.
    - Consequence: **`App.tsx` (458 lines), all four components, and every one of their behaviors
      are untested** — hash read/write, `detectStorage`, `slugifyFilename`, `formatGeneratedAt`,
      pagination, the collection create/rename/delete flows, import/export wiring, and all rendering.
    - Worse, `readHash` and `writeHash` (`App.tsx:38-85`) are the highest-value pure functions in the
      app and are **not exported** (`App.tsx:38`, `:61`), so they cannot be unit-tested at all
    without a refactor. They should move to `web/src/lib/urlState.ts`.
    - Nothing asserts the round-trip invariant that matters most: *state written to the hash reads
      back identically*. Bugs #10, #11, #12, and #29 all live in that untested code.
    - CI (`.github/workflows/ci.yml:35-38`) runs typecheck + `npm test` only — no build, no lint.

---

## 4. Candidate improvements (concrete, ordered by severity)

1. **Never memoize a rejected manifest; add retry.** `web/src/lib/paperIndex.ts:66-71` — reset
   `manifestPromise = null` on rejection (or cache-and-rethrow with a retry path) so a transient
   failure is recoverable, and add a "Try again" button at `web/src/App.tsx:364-376`.
2. **Debounce and coalesce search input.** `web/src/App.tsx:241-243` (the `replaceState`-per-keystroke
   path) — debounce ~200 ms and wrap the query in `useDeferredValue`; this also fixes the history
   throttling (#36).
3. **Precompute a lowercased search haystack per paper** instead of rebuilding three lowercase
   strings inside the scoring loop: `web/src/lib/search.ts:55-58`, consumed by
   `web/src/App.tsx:207-224`.
4. **Fix the relevance/empty-query contradiction.** `web/src/App.tsx:215-223` +
   `web/src/components/FeedControls.tsx:92-94` — either auto-coerce `sort` back to `newest` when
   the query empties, or render the chip as not-pressed with an explanatory tooltip.
5. **Validate hash categories against the manifest** and expose the "all" state explicitly:
   `web/src/App.tsx:47-55` (intersect with `manifest.categories`) and `web/src/App.tsx:198-201` /
   `253-259` (add an "All" chip and treat `[]` as "all").
6. **Make a single failed shard non-fatal** with `Promise.allSettled` plus per-shard reporting:
   `web/src/lib/paperIndex.ts:150-157`.
7. **Stop the load-flash from destroying the list.** `web/src/App.tsx:173-175` and `414-420` —
   keep rendering the previous `papers` while refreshing, and reset `progress` at
   `web/src/App.tsx:173`.
8. **Surface `saveState` failures.** `web/src/App.tsx:231-235` — use the boolean
   `web/src/lib/collections.ts:279-292` already returns and show a quota-exceeded banner; consider
   debouncing the two writes so they cannot interleave.
9. **Give import/export real feedback and fix the silent no-op.** `web/src/lib/collections.ts:105-107`
   (collision early-return) and `web/src/App.tsx:308-310`; also prune the orphan snapshots that path
   adds at `web/src/lib/collections.ts:98-103`.
10. **Add `React.memo` to `PaperCard`/`PaperList` and memoize `isSaved`** as a `Set` lookup:
    `web/src/components/PaperCard.tsx:32`, `web/src/components/PaperList.tsx:24`,
    `web/src/App.tsx:261-266`.
11. **Cap or virtualize the collections view**, which currently renders every saved paper:
    `web/src/components/CollectionsView.tsx:131-147`; and add `content-visibility: auto` to `.paper`
    at `web/src/styles.css:297`.
12. **Fix the WCAG contrast failures in light mode.** Darken `--text-muted` at
    `web/src/styles.css:9` so it clears 4.5:1 on `--surface` (currently 4.32), `--surface-muted`
    (3.79), and `--bg` (4.11); raise `--border` contrast to 3:1 for input boundaries at
    `web/src/styles.css:7` / `:214`.
13. **Restore the search input's focus ring** by removing `outline: none` at
    `web/src/styles.css:218-221`.
14. **Fix the dead reduced-motion block.** `web/src/styles.css:755-759` — actually disable the
    transitions/transforms at `:157`, `:265`, `:303`, `:306-310`, `:436`, `:439-442`.
15. **Restore list semantics and fix heading order.** `web/src/components/PaperList.tsx:43`,
    `web/src/components/CollectionsView.tsx:131` (→ `role="list"`/`<ul>`), and add a prop-driven
    heading level at `web/src/components/PaperCard.tsx:56` plus a real `<h1>` for the collections
    view at `web/src/components/CollectionsView.tsx:182`.
16. **Make `#main` focusable** for the skip link: `web/src/App.tsx:346`.
17. **Stop the live region from firing per keystroke**:
    `web/src/components/FeedControls.tsx:108-110`.
18. **Extract `readHash`/`writeHash` into `web/src/lib/urlState.ts` and export them**, then add
    round-trip tests. This unlocks coverage for bugs #10, #11, #12, and #29 and is a prerequisite
    for most of the URL work above.
19. **Stand up component-test infrastructure**: add `@testing-library/react` + `jsdom` and change
    `web/vite.config.ts:8-9` to `environment: "jsdom"` with `include: ["src/**/*.test.{ts,tsx}"]`;
    add `jsdom` tests for `App`, `PaperCard`, and `CollectionsView`. Currently zero component
    behavior is testable.
20. **Add a lint gate.** `web/package.json` has no `lint` script and no ESLint config, so
    `.github/workflows/ci.yml:35-38` cannot catch unused code (which currently includes the unused
    `renderAction` prop at `web/src/components/PaperList.tsx:20`, the no-op override at
    `web/src/lib/collections.ts:121`, and the unread `retentionDays`/`count`/`from` fields at
    `web/src/lib/types.ts:18-25`).
21. **Clamp the recency options to `manifest.retentionDays`** (currently dead data at
    `web/src/lib/types.ts:25`) and de-duplicate the `[7, 30, 60]` lists at
    `web/src/App.tsx:26` and `web/src/components/FeedControls.tsx:16`.
22. **Report errors honestly and with prod-appropriate copy.** Distinguish "load failed" from "no
    papers" at `web/src/App.tsx:408-433`, and gate the `python scripts/build_index.py` instructions
    at `web/src/App.tsx:366-374` on `import.meta.env.DEV`.
23. **Add an error boundary** (`web/src/main.tsx:12-15`) plus runtime validation of shard data
    (`web/src/lib/paperIndex.ts:111-114`) so a malformed paper blanks nothing.
24. **Add citation export and per-paper deep links**: copy BibTeX/APA/MLA plus
    `#paper=<id>` anchoring in `web/src/components/PaperCard.tsx:99-106` and
    `web/src/App.tsx:38-85`.
25. **Make collections deep-linkable and preserve their UI state** (`#collection=<id>`), and stop
    unmounting `CollectionsView` on view switch: `web/src/App.tsx:347`.
26. **Add print styles and a manual theme toggle**: new `@media print` block and
    `:root[data-theme]` overrides in `web/src/styles.css`.
27. **Add a spacing scale and fix the theme-inverted elevation semantics**:
    `web/src/styles.css:1-26` (tokens), `:6`/`:31` (`--surface-muted`), and the `.button`
    color coupling at `:433-434`.
28. **Validate imported URLs and bound the import file size**: `web/src/lib/collections.ts:51-62`
    (allowlist `https?:` for `absUrl`/`pdfUrl`) and `web/src/components/CollectionsView.tsx:171`.
29. **Defer `URL.revokeObjectURL`** so Firefox does not cancel the download:
    `web/src/App.tsx:303-305`.
30. **Add OG/canonical/theme-color metadata, a 404 page, and a `<noscript>` fallback**:
    `web/index.html:3-18` and the Vite/GitHub Pages config at `web/vite.config.ts`.