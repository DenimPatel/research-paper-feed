# Recon report — experience auditor (web app)

Date: 2026-10-01 · Repo: `research-paper-feed` · Scope: `web/` (React 19 + Vite 7, `base: "/research-paper-feed/"`)

## 1. How this was produced (reproducible)

### Data generation (gitignored, local only — never committed)

`web/public/data/` was empty. System Python is PEP-668 "externally managed", so
`python3 -m pip install arxiv pandas` fails; a venv was used:

```bash
python3 -m venv /var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/kilo/rpfvenv
/var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/kilo/rpfvenv/bin/pip install arxiv pandas
/var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/kilo/rpfvenv/bin/python scripts/build_index.py --max-per-category 700
```

No `.improve/reports/recon-runbook.md` existed, so flags were taken from `scripts/build_index.py --help`.

Result: `web/public/data/{index.json, papers-2026-W39.json, papers-2026-W40.json}` —
2,812 papers, 2 weekly shards, `generated: 2026-10-01`.
Caveat: a real deployment has one shard per week (~9 for a 60-day window), so the
"7 / 30 / 60 days" recency filter could not be fully differentiated locally (only 2 shards exist).
`paper-collector.py --output-dir results` was **not** needed — `build_index.py` talks to the arXiv API directly.

### Servers (both were still running when the browser was closed)

| Purpose | Exact command | URL |
| --- | --- | --- |
| dev | `cd web && npm run dev -- --port 5173 --strictPort` | http://localhost:5173/research-paper-feed/ |
| preview (prod build) | `cd web && npm run build && npm run preview -- --port 4173 --strictPort` | http://localhost:4173/research-paper-feed/ |

`npm run build` = `tsc --noEmit && vite build` → clean, `dist/assets/index-*.js` 163 KB (52 KB gzip).
Browser closed. Nothing committed, nothing pushed. `.playwright-mcp/` scratch dir removed.

Note for other agents: visiting `http://localhost:5173/` (no trailing path) shows a raw Vite
"base path" warning page. The README correctly documents `http://localhost:5173/research-paper-feed/`.

## 2. Baseline screenshots

All in `.improve/artifacts/baseline/`.

| File | State |
| --- | --- |
| `baseline-feed-desktop-1280.png` | Feed, default filters, top of page (1280×900) |
| `baseline-feed-mobile-390.png` | Feed, default filters (390×844) |
| `baseline-feed-savemenu-open-desktop-1280.png` | Card "Save to collection" disclosure open, one collection checked |
| `baseline-feed-savemenu-mobile-390.png` | Save menu open at 390px |
| `baseline-feed-loadmore-desktop-1280.png` | Bottom of a 676-result search, "Load 50 more (626 remaining)" |
| `baseline-feed-focus-ring-desktop-1280.png` | Keyboard focus ring on the `cs.CV` chip (after Tab from search) |
| `baseline-feed-empty-search-desktop-1280.png` | `#q=zzzqqqnothing` → 0 results |
| `baseline-feed-no-categories-selected-desktop-1280.png` | All 5 category chips deselected → 0 results |
| `baseline-feed-index-missing-desktop-1280.png` | `data/` removed → "No paper index yet" error panel |
| `baseline-feed-preview-build-desktop-1280.png` | Production build (preview server), `#q=kinematic+meanflow` |
| `baseline-collections-desktop-1280.png` | Collections view, one collection with one paper |
| `baseline-collections-mobile-390.png` | Collections view at 390px |
| `baseline-collections-empty-mobile-390.png` | Collections view, no collections |
| `baseline-collections-import-error-desktop-1280.png` | Import of an invalid JSON file → `role="alert"` banner |

## 3. Console output (verbatim)

**Production build (port 4173):** zero console messages — no errors, no warnings, on feed and collections.

**Dev server (port 5173):** only Vite/React boilerplate, no application errors or warnings:

```
[DEBUG] [vite] connecting... @ http://localhost:5173/research-paper-feed/@vite/client:494
[DEBUG] [vite] connected. @ http://localhost:5173/research-paper-feed/@vite/client:617
[INFO] %cDownload the React DevTools for a better development experience: https://reactjs.org/link/r...
```

**Failed network requests:** none. All fetches (`index.json`, both week shards, Inter + Manrope
from fonts.googleapis.com, favicon.svg) returned 2xx; Google Fonts delivered 200 with
`document.fonts.status === "loaded"`. Google Fonts is an external runtime dependency (offline
deployments silently fall back to system fonts — no `font-display`/local fallback issue observed, but
it is a third-party render dependency).

## 4. Layout / overflow findings

### Desktop 1280×900

* **No horizontal overflow** (`scrollWidth === clientWidth === 1280`) in any state, including the
  longest titles, the 6-author list and the open save dropdown.
* **Scroll position is not reset when switching Feed ↔ Collections** (`App.tsx:237 setView`). Observed
  both ways: on desktop and on 390px you land mid-list, with the "Create collection" toolbar hidden
  behind the 64px sticky header.
* **Save dropdown is clipped by the viewport bottom.** `.save-menu-panel` always opens downward
  (no flip), so on the last visible cards the "Create & save" button is cut off at the fold
  (seen at 1280×900 and 390×844).
* **Count is shown while still loading.** On first paint `FeedControls` renders
  `role="status"` → `"0 papers match"` next to `"Loading papers from 2 weeks… (0/2)"`
  (`App.tsx:405` + `App.tsx:415-419`). No skeleton, and two live regions announce at once.
* **Number formatting is inconsistent:** hero uses `2,812 papers` (`App.tsx:389`,
  `toLocaleString`) while the live count renders `2812 papers match` (`FeedControls.tsx:109`).
* **Grammar:** `1 paper match` (`FeedControls.tsx:109`).
* **Dead end:** deselecting all five category chips yields `0 papers match` with no pressed chip and
  no "select all"/reset control anywhere; the hero still claims "2,812 papers from cs.CV, …".
* **Empty search:** `No papers match the current filters.` in a large dashed box — no clear-search
  button, no "reset filters" link, and the search input has no `×` clear affordance.
* **Create-collection input is not cleared** after submitting, so a second collection requires
  manual re-selection.
* **No heading on the Collections view at all** (see a11y below) — the page opens straight into a form.
* Multiple save menus can be open simultaneously; no Escape or outside-click close (plain `<details>`).

### Mobile 390×844

* **No horizontal overflow** (`scrollWidth === clientWidth === 390`) in feed, collections, save menu,
  empty states or the error panel. No clipped/ellipsised text containers found.
* **Tap targets below 44 px (and below the 24 px WCAG 2.5.8 floor):**
  `Show more` 74×22, `arXiv` link 34×22, `PDF` link 26×22, `view the full text on arXiv` 156×16,
  save-menu checkbox 13×13 (the wrapping label row is ~40 px tall, so that one is only a nit).
* **Search placeholder is visually truncated** at 390px: `Search papers, e.g. 3d reconstruction`
  (full value is `Search papers, e.g. 3d reconstruction or "visual inertial"`); no ellipsis, no
  visible input label (it is `sr-only`).
* Header wraps to two rows (title, then nav) — acceptable, but it pushes the hero down.
* Category chips wrap to two rows; collection toolbar wraps "Import collection" onto its own line — fine.

## 5. Accessibility findings

* **Colour contrast fails WCAG AA** for the muted palette (`--text-muted: #7a7a73`, `styles.css:10`),
  which is used for the author list, dates, "N papers match", "Abstract truncated —" and the footer:
  * `#7a7a73` on page bg `#faf9f6` → **4.11:1** (needs 4.5:1) — 12–13px text.
  * `#7a7a73` on `--surface-muted #f1f0eb` (chips, code blocks) → **4.28:1**.
  * secondary category tags (`.tag` grey-green on `--surface-muted`) → **3.79:1**.
* **No `<h1>` on the Collections view** (`CollectionsView.tsx` renders only `h2` per collection and
  `h3` per paper) — heading order is broken relative to the feed's `h1`.
* **Search input focus indicator is outline-suppressed**: `.controls__search input:focus
  { border-color: var(--accent); outline: none; }` — focus is signalled only by a 1px border tint.
* **Import control is a `<label>` wrapping a 1×1 transparent file input** (`CollectionsView.tsx:215`,
  `styles.css:638`). It is in the tab order (tabIndex 0, name "Import collection"), but the focus
  target is 1×1 px with no visible ring; the label itself is not keyboard-activatable.
* **Skip link target is not focusable:** `<a class="skip-link" href="#main">` → `<main id="main">`
  has no `tabindex="-1"` (`App.tsx:316` / `App.tsx:346`); it only works because Chrome moves the
  sequential-focus start.
* **Good, for the record:** no icon-only button lacks an accessible name (0 found); category/recency/sort
  chips use `aria-pressed`; nav uses `aria-current="page"`; the result count is a polite
  `role="status"`; import/storage errors use `role="alert"`; the file input and both
  "New collection name" fields have accessible names; every card title is a real link with the
  `arxiv.org/abs/...` href; `Relevance` is correctly `disabled` while the query is empty.
* `color-scheme: light dark` + a `prefers-color-scheme: dark` token block exist but were **not**
  exercised (no emulate-media available) — dark mode is an untested surface.
* Delete uses the native `window.confirm` (verified: `Delete "Robotics reading"? This cannot be undone.`)
  — functional, but not stylable and it blocks the main thread.

## 6. README / onboarding

* **Hero image is stale and misleading.** `![Example feed](images/feed_example.png)` is a **2023**
  screenshot of the *legacy Python CLI HTML output* (dotted-rule text list), not the React feed.
  It is 465 KB / 1772×1434 PNG — the heaviest asset in the repo, and it misrepresents the project.
* No screenshot of the Collections view, no mobile screenshot.
* Documented commands all check out: `python scripts/build_index.py`, `npm run dev`,
  `npm run dev -- --port 3000`, `npm run build`, `npm run preview -- --port 4173`,
  `npm test`, and the CLI flag table (`--limit`, `--category`, `--output-dir`, `--no-html`,
  `--max-abstract-chars`) matches `--help` exactly.
* `http://localhost:5173/research-paper-feed/` is documented correctly (the bare origin shows Vite's
  base-path warning page).
* **`--category` is missing from the README "Useful flags" list** for `build_index.py`.
* README claims the recency filters fetch "only the week shards they need"; `selectShards` uses
  `shard.to >= windowStart`, so a 7-day window still pulls the older boundary shard (observed: the
  7-day window selected both shards).
* Quick Start says `pip install -r requirements.txt`; on this machine that fails without a venv
  (PEP 668). A venv step (or `pipx`) would prevent the first-run stumble.
* The visitor-facing error screen repeats contributor instructions
  ("Run `python scripts/build_index.py` locally, or wait for the scheduled GitHub Action") plus a
  meaningless `(HTTP 200)` suffix (Vite's SPA fallback returns 200 with HTML, which is why the status
  code is appended even though the code correctly detected HTML).

## 7. Candidate improvements (each cites what was observed)

1. **Loading state lies about results** — `0 papers match` renders next to `Loading papers from 2 weeks…`
   (`App.tsx:405,415`); suppress/hide the count until the first payload lands and show a skeleton
   instead of a bare paragraph. Baseline: `baseline-feed-preview-build-desktop-1280.png`.
2. **Add a reset path for zero-state filters** — a "Clear filters"/"Select all categories" action on
   `No papers match the current filters.`; today deselecting all 5 chips is unrecoverable without 5 clicks
   (`baseline-feed-no-categories-selected-desktop-1280.png`).
3. **Reset `window.scrollTo(0,0)` (or focus the `<h1>`) in `setView`** (`App.tsx:237`) — switching views
   currently preserves the old offset and hides the toolbar under the sticky header
   (`baseline-collections-mobile-390.png`).
4. **Flip the save dropdown upward when it would overflow** (or clamp to the viewport) — `.save-menu-panel`
   always opens down and is clipped at the fold (`baseline-feed-savemenu-open-desktop-1280.png`).
5. **Fix count copy**: `toLocaleString()` + real pluralisation in `FeedControls.tsx:109`
   (`"2,812 papers match"` / `"1 paper matches"`); today it prints `2812 papers match` and `1 paper match`.
6. **Raise muted-text contrast to ≥4.5:1** (`--text-muted` and the secondary `.tag` colour) — measured
   4.11:1 and 3.79:1 on 12–13px text.
7. **Add an `<h1>` to the Collections view** (e.g. "Collections") — currently the page has none
   (`baseline-collections-desktop-1280.png`).
8. **Restore a visible focus ring on the search input** (drop `outline: none`, or use
   `:focus-visible` like the chips) and give the file input a real focus target
   (`CollectionsView.tsx:215`) instead of a 1×1 transparent box inside a label.
9. **Add `tabindex="-1"` to `<main id="main">`** so the skip link actually moves focus.
10. **Enlarge sub-44px tap targets on mobile**: `Show more` (74×22), `arXiv`/`PDF` links (34×22, 26×22),
    `view the full text on arXiv` (156×16) — pad to ≥44×44 without changing the visual size.
11. **Shorten/duplicate the search hint for narrow viewports** — the placeholder is cut at 390px and the
    visible label is `sr-only`.
12. **Add an `×` clear button to the search field** and clear the "New collection name" input after submit.
13. **Give the import/merge flow feedback** — only `importError` exists (`CollectionsView.tsx:163`); a
    successful import shows nothing, and `mergeImport` silently drops the collection when the id already
    exists (`collections.ts:105-107`). Add success + "already imported" messages.
14. **Validate hash parameters** — `#cat=none&sort=bogus&recency=999` are accepted silently and produce
    0 results with no chip highlighted; fall back to defaults.
15. **Manage collections from the save menu** — the dropdown only lists checkboxes plus "create"; there is
    no rename/delete/manage entry point, so the menu is a partial dead end.
16. **Close save menus on Escape / outside click**, and allow only one open at a time.
17. **Rewrite the "No paper index yet" screen** — drop the `(HTTP 200)` suffix and split the copy into a
    visitor-facing line plus a collapsed contributor section
    (`baseline-feed-index-missing-desktop-1280.png`).
18. **Replace the stale README hero image** with a current 1280px feed screenshot (and add a Collections
    or mobile shot); the current 465 KB 2023 CLI screenshot is both wrong and heavy.
19. **Document `--category` and a venv step in the README**, and correct the "fetches only the week shards
    it needs" claim to match `selectShards`' boundary-inclusive behaviour.
20. **Guard the deploy against a missing index** — `npm run build` succeeds with an empty
    `web/public/data/` and would publish the error page; add a build/CI check that `data/index.json` exists.
21. **Investigate localStorage growth** (inference, not observed here): full paper objects including
    abstracts are persisted (`collections.ts` `addPaper`), so the 5 MB quota is reachable after roughly
    2–2.5k saved papers, and `saveState` failures only surface through the generic "collections could not
    be saved" banner.
22. **Self-host or subset the webfonts** — Inter/Manrope come from `fonts.googleapis.com` at runtime
    (a third-party dependency and a render-blocking external request on a static site).