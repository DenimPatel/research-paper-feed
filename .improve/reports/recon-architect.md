# Recon: Architecture (Architect sub-agent)

Repo: `/Users/denimpatel/Desktop/git/research-paper-feed`
Scope: `scripts/*.py`, `web/src/**`, `web/index.html`, `web/vite.config.ts`, `notebooks/paper-collector.ipynb`, `.github/workflows/*`

---

## 1. Component / module map

### Python pipeline (`scripts/`)

| File | LOC | Responsibility |
| --- | --- | --- |
| `scripts/arxiv_common.py` | 59 | Shared arXiv client factory + result generator; owns rate-limit/retry/sort constants. No CLI. |
| `scripts/build_index.py` | 309 | The GitHub Pages data pipeline: query categories → normalize → dedupe → ISO-week shard → write `web/public/data/*.json`. Owns every public field name. |
| `scripts/paper-collector.py` | 149 | Legacy standalone CLI: query one topic → pandas DataFrame → hand-built static HTML dump in `results/` (+ optional CSV/PDF/LaTeX). Independent of the web app. |
| `notebooks/paper-collector.ipynb` | 339 | Jupyter prototype of `paper-collector.py`, cell-by-cell. Does **not** import `arxiv_common`. |
| `tests/test_arxiv_common.py` | 104 | Unit tests for client sizing / `max_results` passthrough / error tolerance (stubs `arxiv`). |
| `tests/test_build_index.py` | 253 | Unit tests for the pure helpers + `main()` happy/empty paths. |
| `tests/test_paper_collector.py` | 53 | Tests only `safe_filename` and `build_html_feed` escaping. |

### Web app (`web/src/`)

| File | LOC | Responsibility |
| --- | --- | --- |
| `web/src/main.tsx` | 16 | React entry: mounts `<App/>` into `#root` under `StrictMode`. |
| `web/src/App.tsx` | 458 | Container/controller: hash-URL state machine, index loading, filter+search+sort derivation, collection reducer wiring, export/import download plumbing. |
| `web/src/components/PaperList.tsx` | 67 | Renders a windowed slice of `Paper[]` as `PaperCard`s + "Load more". |
| `web/src/components/PaperCard.tsx` | 173 | One paper: title link, date, authors, category chips, clamped abstract, arXiv/PDF links, "Save to collection" menu. |
| `web/src/components/FeedControls.tsx` | 113 | Search input + category/recency/sort chip groups + live result count. |
| `web/src/components/CollectionsView.tsx` | 254 | Collections screen: create/rename/delete/export, JSON import, per-collection paper lists. |
| `web/src/lib/types.ts` | 40 | The TS mirror of the JSON contract. Types only, no runtime code. |
| `web/src/lib/paperIndex.ts` | 164 | Network layer: manifest + shard fetching, shard cache, recency-window filtering, progress reporting. |
| `web/src/lib/search.ts` | 91 | Client-side tokenizer, weighted scorer (title > author > abstract), ranker. |
| `web/src/lib/collections.ts` | 293 | localStorage-backed collections: reducer, validation, prune, export/import serialization. |
| `web/src/styles.css` | 759 | All styling; BEM-ish `block__element--modifier` classes + dark-mode media query. |
| `web/src/lib/__tests__/*.test.ts` | 629 | Vitest coverage for `search`, `collections`, `paperIndex` (node env, no DOM). |
| `web/index.html` | 23 | Vite HTML entry; loads fonts, favicon, `/src/main.tsx`. |
| `web/vite.config.ts` | 11 | `base: "/research-paper-feed/"`, React plugin, vitest config. |

**Total production LOC: 3,552** (Python 517 + web 3,035 incl. CSS).

---

## 2. DATA FLOW (end to end)

### 2.1 Branch A — the web feed (the only path that feeds the deployed app)

```
arXiv API
  │  arxiv_common.iter_results(query="cat:<CATEGORY>", max_results)
  │  sort_by=SubmittedDate, sort_order=Descending
  ▼
build_index.collect_papers()            scripts/build_index.py:203
  │  per category, per result:
  │  _result_datetime()  → UTC cutoff check vs now()-retention_days  (:194, :216)
  │  break out of category as soon as one result is older than cutoff
  │  record_from_result()                                                (:97)
  ▼
raw record list (cross-listed papers appear once per queried category)
  │  dedupe_records()   → by `id`, union `categories`, keep first metadata  (:117)
  ▼
build_shards()  → group by iso_week_key(published) = "YYYY-WNN"           (:138)
  │  within each shard: sort by (published, id) descending
  ▼
write_index()   → _clean_old_shards() deletes every papers-YYYY-WNN.json   (:224)
  │  then writes shards, then the manifest
  ▼
web/public/data/index.json                 (git-ignored: .gitignore:12, web/.gitignore:7)
web/public/data/papers-<YYYY>-W<NN>.json
  │  Vite copies public/** verbatim into web/dist/data/** at build time
  ▼
browser: PaperIndex.getManifest()          web/src/lib/paperIndex.ts:66
  │  GET ${BASE_URL}/data/index.json          BASE_URL = "/research-paper-feed/"
  │  fetch(..., {cache:"no-cache"})
  │  → IndexUnavailableError on network error / !ok / content-type text/html / bad JSON
  ▼
PaperIndex.loadPapers(recencyDays)         web/src/lib/paperIndex.ts:134
  │  reference = latestIndexDate(manifest) = max(shard.to)                 (:36)
  │  start     = windowStart(reference, days)                              (:47)
  │  needed    = selectShards(manifest, start)  → shard.to >= start       (:54)
  │  Promise.all over needed shards, each cached in `shardCache` (Map<file, Paper[]>)
  │  flatten → filter(published >= start) → sort published DESC           (:159)
  ▼
App: visiblePapers = category filter → tokenize/scorePaper (or rankPapers) web/src/App.tsx:207
  ▼
PaperList (slice 0..visibleCount) → PaperCard[]                            web/src/components/PaperList.tsx:39
  ▼
localStorage: "rpf.collections.v1" (Collection[]), "rpf.papers.v1" (Paper map)
  web/src/lib/collections.ts:3-4
```

### 2.2 Branch B — the legacy CLI (does **not** touch the web app)

```
arXiv API → arxiv_common.iter_results (paper-collector.py:60)
  → fetch_papers() → dict per result, Title-Cased keys (paper-collector.py:61-71)
  → pandas DataFrame
  → build_html_feed() → single .html string (paper-collector.py:87)
  → results/<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html   (:142)
  (optional) <topic>_papers.csv written to CWD, not to --output-dir       (:138)
  (optional) ./<title_slug>.pdf, ./<title_slug>.tar.gz, ./extracted/<slug>/ (:75-79)
```

Note both `--save-csv` and the HTML filename embed the **raw `--topic` string** in a path, unslugged, while PDF/source downloads go through `safe_filename()`.

### 2.3 Data file schemas (authoritative — emitted by `record_from_result`, `build_shards`, `write_index`)

**`web/public/data/index.json`** — `json.dump(..., indent=2)` (`build_index.py:244`)

```jsonc
{
  "generatedAt": "2024-03-05T00:00:00Z", // UTC, microsecond=0, "+00:00"→"Z"  (:180)
  "retentionDays": 60,                    // echoed --retention-days
  "categories": ["cs.CV","cs.LG","cs.CL","cs.AI","cs.RO"], // requested list, not observed
  "shards": [                             // sorted by week, DESC
    { "week": "2024-W09",                 // ISO week, "YYYY-WNN"        (:94)
      "from": "2024-03-01",               // min(published) in shard     (:165)
      "to":   "2024-03-01",               // max(published) in shard     (:166)
      "count": 1,
      "file":  "papers-2024-W09.json" }
  ],
  "totalPapers": 1                        // sum(shard.count)
}
```

**`web/public/data/papers-<YYYY>-W<NN>.json`** — `json.dump(..., separators=(",",":"))`, no indent, `ensure_ascii=False` (`build_index.py:241`)

```jsonc
{ "week": "2024-W09", "from": "2024-03-01", "to": "2024-03-01",
  "papers": [ /* Paper[], published DESC, id DESC tiebreak */ ] }
```

**`Paper`** — the single record shape shared by shards, localStorage, and the export file
(`build_index.py:102-114` ≡ `web/src/lib/types.ts:1-13`)

| Field | Python source | Type | Notes |
| --- | --- | --- | --- |
| `id` | `arxiv_id_from_entry(entry_id)` | `string` | versionless, e.g. `2401.12345`, `0309136`; `""` if missing → dropped by dedupe |
| `title` | `collapse_whitespace(result.title)` | `string` | whitespace normalized |
| `authors` | `format_authors(result.authors)` | `string[]` | ≤ 8 names, literal `"et al."` appended past the cap (`:65`) |
| `abstract` | `truncate_abstract(result.summary, 500)` | `string` | collapsed whitespace, ≤500 chars + `…` |
| `abstractTruncated` | from truncate | `boolean` | drives the "Abstract truncated" note in `PaperCard.tsx:88` |
| `published` | `iso_date(result.published)` | `string` | `YYYY-MM-DD`, converted to **UTC** (`:83`) |
| `updated` | `iso_date(result.updated)` | `string` | same format; **written but never read by the UI** |
| `categories` | `list(result.categories)` | `string[]` | unioned across cross-listings by `dedupe_records` |
| `primaryCategory` | `result.primary_category` | `string` | drives `tag--primary` and the category filter |
| `absUrl` | `result.entry_id` | `string` | full entry URL, keeps the `vN` suffix |
| `pdfUrl` | `result.pdf_url` | `string` | arXiv-rendered PDF URL |

**`ExportPayload`** — download produced by `App.handleExport` (`App.tsx:290`), re-read by
`CollectionsView.handleFile` → `parseExportPayload` (`collections.ts:206`)

```jsonc
{ "version": 1, "exportedAt": "<ISO-8601>", "collection": Collection, "papers": Paper[] }
```

**`Collection`** (`collections.ts:6`): `{ id, name, createdAt, paperIds: string[] }`
**`CollectionsState`** (`collections.ts:13`): `{ collections: Collection[], papers: Record<PaperId, Paper> }`

**`results/*.csv`** (branch B, optional) — one row per paper, `Title,Date,Id,Summary,URL,Authors,Primary_category,Categories,Links`. Note this is a *different, Title-Cased* schema from `Paper`; `Authors`/`Categories`/`Links` are Python list objects stringified by pandas.

---

## 3. Entry points

| Kind | Entry | Trigger |
| --- | --- | --- |
| CLI | `python scripts/paper-collector.py` → `main()` `paper-collector.py:125` | manual. Prompts for `--topic` via `input()` when omitted (`:127`). Flags: `--topic --max-papers(1000) --output-dir(results) --download-pdfs --download-sources --save-csv` (`:26-55`) |
| CLI | `python scripts/build_index.py` → `main(argv=None)` `build_index.py:278` | CI + manual. Flags: `--out-dir(web/public/data) --retention-days(60) --max-per-category(0=unlimited) --abstract-chars(500) --category(repeatable)` (`:248-275`). Exits 1 on empty result set (`:291`) |
| Shared lib | `scripts/arxiv_common.py` | no CLI; imported by both scripts |
| Notebook | `notebooks/paper-collector.ipynb` | Jupyter/Colab, cell-by-cell; `MAX_PAPERS_TO_PULL/DOWNLOAD_*/SAVE_CSV/GENERATE_HTML` toggles in cell 1, interactive `topic = input(...)` in cell 4 |
| Web | `web/index.html` → `/src/main.tsx` → `createRoot(#root).render(<App/>)` | `npm run dev` / `npm run build` / Pages |
| Build | `npm run build` = `tsc --noEmit && vite build` (`web/package.json:8`) | |
| Test | `python -m unittest discover -s tests -v`; `cd web && npm test` (`vitest run`) | |
| CI | `.github/workflows/ci.yml` — python-tests (push/PR to main) + web-tests (typecheck, vitest) | |
| Deploy | `.github/workflows/deploy.yml` — `pip install -r requirements.txt` → `python scripts/build_index.py` → `npm ci` → `npm run build` → `actions/upload-pages-artifact` (`path: web/dist`) → `actions/deploy-pages`. Triggers: `schedule: cron "0 6 * * 0"`, push to `main`, `workflow_dispatch` |

Python scripts both do `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))` (`paper-collector.py:11`, `build_index.py:26`) so `import arxiv_common` and path-based test loading work.

---

## 4. Public surfaces

### 4.1 `scripts/arxiv_common.py`
| Symbol | Kind | Signature / value |
| --- | --- | --- |
| `DEFAULT_PAGE_SIZE` | const | `1000` |
| `DEFAULT_DELAY_SECONDS` | const | `10` |
| `DEFAULT_NUM_RETRIES` | const | `5` |
| `build_client(max_results)` | fn | → `arxiv.Client(page_size=clamp(1..1000, max_results), delay_seconds=10, num_retries=5)` |
| `iter_results(query, max_results)` | generator | yields `arxiv.Result`; `max_results is not None` → passed through to `arxiv.Search`; `None` means unlimited; `arxiv.ArxivError` is logged and **ends iteration without raising** |

Side effect at import: `logging.basicConfig(level=logging.INFO)` (`:13`).

### 4.2 `scripts/build_index.py` — pure (network-free, unit-tested) helpers
`DEFAULT_CATEGORIES = ["cs.CV","cs.LG","cs.CL","cs.AI","cs.RO"]` · `DEFAULT_RETENTION_DAYS = 60` · `DEFAULT_ABSTRACT_CHARS = 500` · `DEFAULT_MAX_AUTHORS = 8` · `DEFAULT_OUT_DIR = web/public/data` · `UNLIMITED = 100000`

| Function | Signature | Behavior |
| --- | --- | --- |
| `collapse_whitespace` | `(text) -> str` | `" ".join(text.split())` |
| `truncate_abstract` | `(abstract, max_chars) -> (str, bool)` | cap + `…`; `<=0` or short → unchanged |
| `format_authors` | `(authors, max_authors=8) -> list[str]` | `"et al."` appended when capped |
| `arxiv_id_from_entry` | `(entry_id) -> str` | strips URL + `v\d+` suffix |
| `iso_date` | `(value) -> str \| None` | datetime→UTC date ISO; `date`→ISO; else `str(value)` |
| `iso_week_key` | `(published_iso) -> "YYYY-WNN"` | `date.fromisoformat(...).isocalendar()` |
| `record_from_result` | `(result, abstract_chars=500) -> Paper` | the schema factory |
| `dedupe_records` | `(records) -> list[Paper]` | by `id`, union `categories`, first-seen metadata, insertion order preserved |
| `build_shards` | `(records, generated_at=None, retention_days=60, categories=None) -> (manifest, {filename: shard})` | ISO-week grouping + intra-shard sort |
| `write_index` | `(out_dir, manifest, shard_files) -> manifest_path` | cleans stale shards, writes shards then manifest |

Network/IO layer: `collect_papers(categories, retention_days, max_per_category, abstract_chars)` (`:203`), `_result_datetime(result)` (`:194`), `_clean_old_shards(out_dir)` (`:224`), `parse_args(argv=None)` (`:248`), `main(argv=None) -> int` (`:278`).

### 4.3 `scripts/paper-collector.py`
`safe_filename(title) -> str` (replaces `[\\/:"*?<>|]+` with `_`) · `parse_args()` · `fetch_papers(topic, max_papers, download_pdfs=False, download_sources=False) -> DataFrame` · `build_html_feed(df) -> str` · `main()`

### 4.4 `web/src/lib/types.ts`
`Paper`, `ShardManifestEntry`, `IndexManifest`, `ShardFile`, `RecencyDays = 7|30|60`, `SortMode = "newest"|"relevance"`. `PaperListProps`/`PaperCardProps` etc. are **not** exported.

### 4.5 `web/src/lib/paperIndex.ts`
| Export | Kind | Signature |
| --- | --- | --- |
| `IndexUnavailableError` | class | `extends Error`, adds `readonly cause?: unknown` |
| `LoadProgress` | interface | `{ loaded: number; total: number }` |
| `latestIndexDate` | fn | `(manifest) => string \| null` — max of `shard.to` |
| `windowStart` | fn | `(referenceDate: string, days: number) => string` |
| `selectShards` | fn | `(manifest, start) => ShardManifestEntry[]` — `shard.to >= start` |
| `PaperIndex` | class | `getManifest(): Promise<IndexManifest>` (memoized promise) · `loadPapers(days, onProgress?): Promise<Paper[]>`; private `fetchManifest`, `loadShard`, `shardCache: Map<string, Paper[]>` |

Module-private: `dataBase()` (`:30`) — `` `${import.meta.env.BASE_URL.replace(/\/$/,"")}/data` `` — and the `INDEX_HELP` string (`:26`).

### 4.6 `web/src/lib/search.ts`
`SearchToken { text; phrase }` · `RankedPaper { paper; score }` · `tokenize(query) -> SearchToken[]` (regex `/"([^"]*)"|(\S+)/g`, lowercased, unterminated quote degrades to a plain term) · `scorePaper(paper, tokens) -> number` (implicit AND; `0` if any token missing; `0` tokens → `1`) · `rankPapers(papers, query) -> RankedPaper[]` (score DESC, then `published` DESC)
Private weights: `TITLE_WEIGHT=5`, `AUTHOR_WEIGHT=2`, `ABSTRACT_WEIGHT=1`, `PHRASE_BONUS=2` (`:13-16`).

### 4.7 `web/src/lib/collections.ts`
`COLLECTIONS_KEY = "rpf.collections.v1"` · `PAPERS_KEY = "rpf.papers.v1"` · `Collection` · `CollectionsState` · `ExportPayload` · `CollectionsAction` (6 variants: `addCollection` `renameCollection` `deleteCollection` `addPaper` `removePaper` `mergeImport`) · `EMPTY_STATE` · `newId()` · `createCollection(name, now?, id?)` · `collectionsReducer(state, action)` · `exportCollection(state, collectionId, now?)` · `parseExportPayload(raw) -> ExportPayload \| null` · `loadState(storage?)` · `saveState(state, storage?) -> boolean`
Module-private validators: `isPaper` (checks only `id`/`title`/`authors[]`/`abstract`, `collections.ts:51`), `isCollection` (`:64`), `prunePapers` (`:78`), `mergeImport` (`:94`), `defaultStorage()` (`:229`).

### 4.8 React component props (all local, non-exported interfaces)
- `PaperListProps` (`PaperList.tsx:8`): `papers: Paper[]`, `visibleCount: number`, `onLoadMore(): void`, `collections?: Collection[]`, `isSaved?: (collectionId, paperId) => boolean`, `onToggleCollection?: (collectionId, paper, nextSaved) => void`, `onCreateCollection?: (name, paper) => void`, `renderAction?: (paper) => ReactNode`, `emptyMessage?: string`
- `PaperCardProps` (`PaperCard.tsx:7`): same save-related subset + `paper: Paper`, `actionSlot?: ReactNode`
- `FeedControlsProps` (`FeedControls.tsx:3`): `query`, `onQueryChange`, `categories: string[]`, `selectedCategories: string[]`, `onToggleCategory`, `recency: RecencyDays`, `onRecencyChange`, `sort: SortMode`, `onSortChange`, `resultCount: number`
- `CollectionsViewProps` (`CollectionsView.tsx:10`): `state: CollectionsState`, `storageAvailable: boolean`, `onCreate`, `onRename`, `onDelete`, `onRemovePaper`, `onExport`, `onImport(payload)`
- `CollectionSectionProps` (`CollectionsView.tsx:21`): local to that file

### 4.9 URLs / routes
- Site: `https://denimpatel.github.io/research-paper-feed/` (readme.md:9)
- Vite `base: "/research-paper-feed/"` (`web/vite.config.ts:5`) → `BASE_URL`; data root `/research-paper-feed/data/`
- Data endpoints the browser fetches: `…/data/index.json`, `…/data/<shard.file>`
- Outbound: `paper.absUrl`, `paper.pdfUrl` (`target="_blank" rel="noreferrer"`), `https://arxiv.org/` footer link, Google Fonts (`Manrope`, `Inter`), MathJax CDN **only in the branch-B HTML output** (`paper-collector.py:103`)
- **No router.** All view state is the URL hash, parsed by `readHash()` (`App.tsx:38`) and written by `writeHash()` (`:61`): `#view=collections`, `#q=…`, `#cat=cs.CV,cs.LG`, `#recency=30`, `#sort=relevance`. Defaults are omitted from the hash; `recency` only accepts 7/30/60, `sort` only `relevance`, `view` only `collections`.
- localStorage keys: `rpf.collections.v1`, `rpf.papers.v1`, plus the transient probe `rpf.__storage_test__` (`App.tsx:89`)

---

## 5. Design intent per module

- **`arxiv_common.py`** — exists so the CLI and the index builder cannot drift on rate limiting, retry count, page size, and `SubmittedDate/Descending` sort. The explicit `max_results` passthrough is deliberate: `arxiv.Search` defaults to 100 in arxiv≥2, which would silently cap every query to one page (comment at `:43-45`). Swallowing `ArxivError` preserves `paper-collector.py`'s historical "partial results are still useful" behavior; `build_index` fails loudly downstream via its empty-record guard (`:289-291`).
- **`build_index.py`** — deliberately splits *pure* helpers (truncate, author format, dedupe, shard, ID/date/week) from `collect_papers`, the only function that touches the network, so the whole normalization contract is unit-testable with synthetic records (docstring `:11-13`). Sharding by ISO week is a bandwidth optimization: the browser fetches only the weeks overlapping the chosen recency window. `_clean_old_shards` is what keeps the git-ignored `public/data` directory from accumulating unbounded history across runs. Refusing to write an empty index protects the deployed site from a wiped feed on an arXiv outage.
- **`paper-collector.py`** — the original one-shot tool, kept for users who want an arbitrary query dumped as a standalone HTML file. Its value is the download/extract options (PDF, LaTeX source tarball → `./extracted/`), which the web app intentionally excludes (readme.md:27-28). `safe_filename` and `html.escape` are the two things that make arbitrary arXiv titles safe in a path and in HTML.
- **notebook** — the cell-by-cell prototype `paper-collector.py` was extracted from. It is a documentation/teaching artifact, not a supported pipeline: it duplicates the client config, has no escaping, and uses an `http://` MathJax CDN.
- **`lib/paperIndex.ts`** — owns every network concern so `App.tsx` stays declarative. Three specific defenses: the `content-type: text/html` check catches Vite's SPA dev fallback answering a missing file with HTTP 200 (`:82-89`); the manifest promise and the shard `Map` cache mean widening the recency window only fetches newly-needed weeks; `onProgress` drives a real loading message because shard fetches are `Promise.all` over several files.
- **`lib/search.ts`** — client-side because the index is already fully downloaded for the chosen window. Implicit AND plus field weights make "3d reconstruction" behave like a title-biased search rather than a substring soup match.
- **`lib/collections.ts`** — a pure reducer plus explicit `Storage` injection so it is testable without a DOM (`vite.config.ts` sets vitest `environment: "node"`). `prunePapers` keeps localStorage from growing without bound as papers are removed; `isPaper`/`isCollection`/`parseExportPayload` treat an imported file as untrusted input; `saveState` returns `false` instead of throwing when storage is blocked (private-browsing / quota).
- **`App.tsx`** — the only component with real state. Hash-as-state makes any feed view shareable and survives reload; `cancelled` flags in both effects prevent stale fetches from overwriting newer ones; a single `PaperIndex` instance is held in a `useRef` so its cache survives re-renders.
- **Components** — `PaperList`/`PaperCard`/`FeedControls`/`CollectionsView` are presentational and take all behavior through props, so the reducer and search logic stay testable without rendering.

---

## 6. Coupling, shared constants, and duplicated logic

### 6.1 The Python ⇄ TypeScript contract (highest-risk seam)
`build_index.record_from_result` (`build_index.py:102-114`) is the *only* producer of the wire format, and `web/src/lib/types.ts:1-36` is a hand-maintained copy of it. There is **no schema generation, no JSON Schema, and no runtime validation of the manifest or shard shape** — `fetchManifest` does a bare `as IndexManifest` cast (`paperIndex.ts:91`) and `loadShard` only checks `Array.isArray(data.papers)` (`:115-119`). Renaming a field in Python fails silently: `undefined` flows straight into rendering. This is the single most important thing for any refactor to preserve or formalize.

### 6.2 Duplicated constants across the language boundary
| Constant | Python | TypeScript | Consequence |
| --- | --- | --- | --- |
| Retention / default recency | `DEFAULT_RETENTION_DAYS = 60` (`build_index.py:31`) | `DEFAULT_RECENCY: RecencyDays = 60` (`App.tsx:25`) | Two independent 60s. The UI never reads `manifest.retentionDays` even though the manifest ships it, so lowering `--retention-days` silently caps what the 60-day default can ever find. |
| Recency options | — | `RECENCY_VALUES = [7,30,60]` (`App.tsx:26`) **and** `RECENCY_OPTIONS = [7,30,60]` (`FeedControls.tsx:16`) plus the `RecencyDays` union (`types.ts:38`) | The same list is written down three times in TS. |
| Default categories | `DEFAULT_CATEGORIES` (`build_index.py:30`) | none — the UI reads `manifest.categories` (`App.tsx:199, 398`) | Correctly data-driven. The list is *also* hardcoded in prose at `readme.md:21`. |
| Page size | — | `PAGE_SIZE = 50` (`App.tsx:24`) and `LOAD_MORE_STEP = 50` (`PaperList.tsx:6`) | The increment uses `PAGE_SIZE`; the button *label* uses `LOAD_MORE_STEP`. Two constants that must stay equal. |
| Shard filename pattern | `papers-{week}.json` (`build_index.py:162`) and the cleanup regex `papers-\d{4}-W\d{2}\.json` (`:228`) | assembled only from `manifest.shards[].file` (`paperIndex.ts:105`) | Safe on the read side, but the naming convention lives in two Python places. |
| ISO week key | `iso_week_key` → `"YYYY-WNN"` (`build_index.py:90-94`) | not reimplemented — TS compares `shard.to >= start` as plain ISO strings (`paperIndex.ts:58, 161`) | TS depends on `YYYY-MM-DD` sorting correctly; it never parses the week string, so the week label is display-only. |

### 6.3 Duplicated logic *within* the TS app
- **Descending sort comparator written three times:** `paperIndex.ts:162` (`a.published < b.published ? 1 : -1`), `search.ts:89` (same form), plus the Python `key=..., reverse=True` in `build_index.py:157-160`. The TS forms return `-1` for equal keys rather than `0` (never actually equal here, but not a total order).
- **Date formatting written twice:** `PaperCard.formatDate` (`PaperCard.tsx:20`) and `App.formatGeneratedAt` (`App.tsx:106`) both do `new Date(\`${v}T00:00:00Z\`)` → `toLocaleDateString({year, month:"short", day:"numeric"})`. Identical bodies.
- **localStorage availability checked twice:** `App.detectStorage()` (`App.tsx:87`) writes a probe key, while `collections.defaultStorage()` (`collections.ts:229`) try/catches property access. `App` uses the former to decide whether to persist, and `loadState` uses the latter.
- **Filename slugging twice, in two languages:** `safe_filename` (`paper-collector.py:21`) and `slugifyFilename` (`App.tsx:98`) solve the same problem with different rules (the Python one is filesystem-illegal-char replacement, the TS one is a lowercase hyphen slug for the download attribute).

### 6.4 Double truncation (Python and TS both clamp the abstract)
`build_index` caps the abstract at 500 chars + `…` and sets `abstractTruncated` (`build_index.py:48-53`); `PaperCard` then clamps *that already-capped* string at `ABSTRACT_PREVIEW_CHARS = 260` (`PaperCard.tsx:5, 44-49`). So "Show more" can only ever reveal up to ~500 characters — the full abstract is never available in the UI, only on arXiv. Two different preview budgets, in two languages, with the tighter one downstream.

### 6.5 Notebook ⇄ `paper-collector.py` divergence
`notebooks/paper-collector.ipynb` cell 5 constructs its own `arxiv.Client(page_size=min(1000, N), delay_seconds=10, num_retries=5)` rather than importing `arxiv_common`, and cell 8 duplicates the HTML template **without** `html.escape` and with an `http://` MathJax CDN (`paper-collector.py:103` uses `https://`). It also uses `result.title` raw as the download filename, where the script uses `safe_filename(result.title)`. The notebook is a stale fork of the script's logic, not a peer implementation.

### 6.6 Schema drift risk inside the Python layer
`paper-collector.py:61-71` builds a **Title-Cased** record (`Title`, `Date`, `Id`, `Summary`, `URL`, `Authors`, `Primary_category`, `Categories`, `Links`) while `build_index.py:102-114` builds a **camelCase** one (`id`, `title`, `published`, `abstract`, `pdfUrl`, `authors`, `primaryCategory`, `categories`). Both are derived from the same `arxiv.Result`. Nothing reconciles them, and both are "the paper record" within the repo.

### 6.7 Deploy-config observation
`.github/workflows/deploy.yml:5-6` comments "every day at 06:00 UTC" but the cron is `0 6 * * 0` — **weekly on Sunday**, not daily. The pipeline is otherwise idempotent, so a shorter interval would only cost arXiv API time (5 categories × `delay_seconds=10`).

### 6.8 Test-surface asymmetry
- Vitest is configured with `environment: "node"` and `include: ["src/**/*.test.ts"]` (`vite.config.ts:8-9`) — so there are **no component/DOM tests at all**; `App.tsx`, all four components, and `main.tsx` are untested by construction.
- Python: `tests/test_paper_collector.py` covers only `safe_filename` and `build_html_feed`; `fetch_papers` and `main` (including the CSV/HTML path handling) are uncovered.
- `build_index.format_authors`'s `max_authors` parameter and `DEFAULT_MAX_AUTHORS` are not exposed as a CLI flag, unlike `--abstract-chars` — a deliberate-looking but inconsistent asymmetry.
- `results/*.html` and `results/*.csv` are git-ignored (`.gitignore:7-8`), so branch-B output is never committed; `web/public/data/` is ignored too (`.gitignore:12`), so **the committed repo contains no example of either data format**. The only concrete instances of the schema are the test fixtures in `tests/test_build_index.py:23-41` and `web/src/lib/__tests__/paperIndex.test.ts:11-79`.

---

## 7. Quick reference — where each field is touched

| Field | Produced | Consumed |
| --- | --- | --- |
| `manifest.generatedAt` | `build_index.py:180` | `App.tsx:391` via `formatGeneratedAt` |
| `manifest.retentionDays` | `build_index.py:186` | **unused** (`types.ts:25` only) |
| `manifest.categories` | `build_index.py:187` | `App.tsx:199` (default selection), `:390` (hero), `:398` (chips) |
| `manifest.shards[].week` | `build_index.py:171` | **unused** outside types |
| `manifest.shards[].from` | `build_index.py:172` | **unused** outside types |
| `manifest.shards[].to` | `build_index.py:173` | `paperIndex.ts:39-41` (reference date), `:58` (shard select) |
| `manifest.shards[].count` | `build_index.py:174` | **unused** outside types |
| `manifest.shards[].file` | `build_index.py:175` | `paperIndex.ts:105` (fetch URL) |
| `manifest.totalPapers` | `build_index.py:189` | `App.tsx:389` |
| `paper.id` | `build_index.py:103` | dedupe key `:122`; React key `PaperList.tsx:46`; collections key `collections.ts:166`; export/import |
| `paper.title` | `build_index.py:104` | `PaperCard.tsx:58`; search `search.ts:55` |
| `paper.authors` | `build_index.py:105` | `PaperCard.tsx:63` (`join(", ")`); search `search.ts:56` |
| `paper.abstract` | `build_index.py:106` | `PaperCard.tsx:44-51`; search `search.ts:57` |
| `paper.abstractTruncated` | `build_index.py:107` | `PaperCard.tsx:88` |
| `paper.published` | `build_index.py:108` | shard key `:151`, sort `:158`, TS filter `paperIndex.ts:161`, display `PaperCard.tsx:62` |
| `paper.updated` | `build_index.py:109` | **unused** in UI |
| `paper.categories` | `build_index.py:110` | filter `App.tsx:212`; chips `PaperCard.tsx:68` |
| `paper.primaryCategory` | `build_index.py:111` | filter `App.tsx:211`; chip highlight `PaperCard.tsx:71` |
| `paper.absUrl` | `build_index.py:112` | `PaperCard.tsx:57, 91, 100` |
| `paper.pdfUrl` | `build_index.py:113` | `PaperCard.tsx:103` |
