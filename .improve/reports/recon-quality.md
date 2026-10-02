# Recon Report — Quality Auditor

Repo: `/Users/denimpatel/Desktop/git/research-paper-feed`
HEAD: `1c075b3` ("Restyle web feed to match denimpatel.github.io design system (#4)")
Scope: Python scripts, tests, web app, notebook, docs, GitHub Actions.
Mode: read-only. Nothing was modified, committed, or pushed.

---

## KNOWN PRE-EXISTING FAILURES

**There are currently ZERO failing checks.** Every baseline suite is green. Verifiers
must not attribute any of the following to a new change, and equally must not claim
they "fixed" anything:

| # | Check | Command (dir) | Baseline result |
| --- | --- | --- | --- |
| B1 | Python unit tests | `/usr/local/bin/python3.11 -m unittest discover -s tests -v` (repo root) | **PASS** — 27 tests, 0 failures, 0 errors, 0 skips, 0.018s |
| B2 | Web typecheck | `npm run typecheck` (`web/`) | **PASS** — `tsc --noEmit`, 0 errors |
| B3 | Web unit tests | `npm test` (`web/`) | **PASS** — 3 files, 36 tests, 0 failures |
| B4 | Web build | `npm run build` (`web/`) | **PASS** — 38 modules, dist ~163 kB JS / 10.9 kB CSS |

Environment caveats (not repo bugs, but they will bite a verifier):

- **`python` does not exist on this machine.** `/opt/homebrew/bin/python3` is 3.14.3
  and has neither `arxiv` nor `pandas` installed. `python3 -m unittest ...` fails with
  `ModuleNotFoundError: No module named 'arxiv'`. Only `/usr/local/bin/python3.11` has
  the deps (`arxiv 2.1.3`, `pandas 2.2.1`). There is no `.venv` in the repo. Use the
  explicit 3.11 path, or create a venv first.
- **`npm audit` reports 5 pre-existing vulnerabilities** in the pinned dev toolchain
  (1 critical, 1 high, 3 moderate). These are baseline, not regressions:
  - `vitest <=4.1.10` — **critical**, GHSA-5xrq-8626-4rwp (Vitest UI server arbitrary
    file read/execute) + GHSA-82fw-gwwq-j7x9. Installed: `vitest 2.1.9`.
  - `vite <=6.4.2` — **high**, GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3,
    GHSA-fx2h-pf6j-xcff. Installed: `vite 5.4.21`.
  - `esbuild <=0.24.2`, `@vitest/mocker`, `vite-node` — moderate, transitive.
  All are dev-only (dev server / test runner), not shipped to the Pages bundle.
- Stale `__pycache__/*.pyc` exist on disk for cpython-311, 312 and 314 under
  `scripts/` and `tests/`. They are gitignored and untracked (confirmed), so they are
  noise only, not a leak.

---

## 1. CI / CD configuration

### `.github/workflows/ci.yml`
Triggers: `push` to `main`, and every `pull_request`. Two jobs, both on
`ubuntu-latest`.

`python-tests`: checkout@v4, setup-python@v5 with `python-version: "3.x"`,
`pip install -r requirements.txt`, `python -m unittest discover -s tests -v`.

`web-tests`: checkout@v4, setup-node@v4 node 20 with npm cache keyed on
`web/package-lock.json`, `npm ci`, `npm run typecheck`, `npm test`.

What CI **does not** do:
- **No `npm run build`.** Only `typecheck` + `test`. A broken Vite build (bad
  `vite.config.ts`, bad `base`, missing asset, CSS pipeline error) passes CI and only
  fails later inside `deploy.yml` on `main`. This is the single biggest CI gap.
- **No lint of any kind.** No Python linter (ruff/flake8/pylint), no Python formatter
  check, no ESLint, no Prettier — and none are configured anywhere in the repo (no
  `pyproject.toml`, `setup.cfg`, `tox.ini`, `.eslintrc*`, `.prettierrc*`,
  `.pre-commit-config.yaml`, `.editorconfig`). Every `noqa: E402` in `scripts/` is
  aspirational; nothing enforces it.
- **No type checking on Python.** No mypy/pyright, no annotations on most functions.
- **No coverage.** Neither Python coverage nor JS/TS coverage is measured, reported,
  or enforced. `coverage.py`, `pytest-cov`, and `@vitest/coverage-v8` are all absent.
- **No dependency security gate.** `npm audit` / `pip-audit` are not run. The critical
  vitest advisory has been sitting undetected.
- **No Python matrix.** Single floating `"3.x"`; no 3.9/3.10/3.11/3.12/3.13 coverage.
- **No pip caching.** `setup-python` is used without `cache: pip` /
  `cache-dependency-path`, so every run re-downloads `arxiv`+`pandas`.
- **Actions are pinned to mutable tags** (`actions/checkout@v4`,
  `actions/setup-python@v5`, `actions/setup-node@v4`), not commit SHAs. Supply-chain
  drift / tag-repointing risk.
- **No `permissions:` block.** `GITHUB_TOKEN` inherits the repository default, which
  may be read/write. CI only needs `contents: read`.
- **No `concurrency:` group.** Superseded PR pushes keep burning minutes.
- **No `timeout-minutes`.** A hung arXiv/network call stalls the job to the 6h default.
- **No `path:` filters.** Docs-only and image-only PRs run the full Node matrix.

### `.github/workflows/deploy.yml`
Triggers: `cron: "0 6 * * 0"`, `push` to `main`, `workflow_dispatch`.
Permissions: correctly scoped `contents: read`, `pages: write`, `id-token: write`.
Concurrency: `group: pages`, `cancel-in-progress: false` (correct — don't kill a
half-published deploy).

- **The cron comment is wrong.** `deploy.yml:5` says "Rebuild the arXiv index and
  redeploy every day at 06:00 UTC", but `0 6 * * 0` is **weekly, Sundays only**.
  `readme.md:123` compounds this: "deploys the site to GitHub Pages on a daily
  schedule". Both are factually incorrect.
- **No quality gate.** `build` never runs the test suite, typecheck, or lint — it
  jumps straight to `python scripts/build_index.py` then `npm run build`. `deploy.yml`
  does not `needs:` CI (separate workflows can't), so anything landing on `main`
  publishes to Pages whether or not CI is green. There is no environment protection
  or required-check wiring documented.
- **Deploy path is correct.** `actions/upload-pages-artifact@v3` with `path: web/dist`,
  and `npm run build` writes to `web/dist` via Vite's default `outDir`. The base path
  `vite.config.ts:5` `"/research-paper-feed/"` matches the repo name and the live URL
  in `readme.md:9`. Verified correct.
- `configure-pages@v5` is placed after the build (it only injects `base_path`/token
  metadata; it is *not* consumed by this Vite config, so the ordering is harmless but
  the step provides no value here).
- Same unpinned-tag, no `timeout-minutes`, no `python-version` pin issues as CI.
- No artifact retention/rollback story, no `pages: write` least-privilege audit.

### Secret handling
Clean. No `secrets.*` usage anywhere, no tokens, no `GITHUB_TOKEN` interpolation into
shell. No secrets committed (grepped for keys/tokens/passwords/private keys — only
false positives on the word "token"/"SearchToken" in `web/src/lib/search.ts`).
**No GitHub Actions script-injection risk:** no PR title/body/branch/actor strings are
interpolated into `run:` blocks in either workflow, and `pull_request` (not
`pull_request_target`) is used, so a fork PR gets a read-only token and no secrets.
This is a genuinely well-handled area; leave it alone.

---

## 2. Baseline test results (exact)

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 27 tests in 0.018s
OK
```
Python test breakdown (all in `tests/`, all via `unittest`, no pytest):
- `test_arxiv_common.py` (104 lines, 5 tests): `max_results` passthrough to
  `arxiv.Search`, `None` = unlimited + default page size, early stop at
  `max_results`, non-positive short-circuit, `ArxivError` swallowed.
- `test_build_index.py` (253 lines, 15 tests): truncate, author cap + `et al.`,
  arXiv ID stripping, ISO week + year boundary, dedupe (category union, first-metadata
  wins), shard manifest/sorting/bounds, `record_from_result` shape, `write_index`
  stale-shard cleanup, `main()` success + empty-refusal exit 1.
- `test_paper_collector.py` (53 lines, 4 tests): `safe_filename`, HTML escaping,
  MathJax https.

```
$ npm run typecheck   # web/    -> tsc --noEmit, 0 errors
$ npm test            # web/    -> 3 files / 36 tests passed, 1.43s
$ npm run build       # web/    -> 38 modules, index-C7dmSHFy.js 163.17 kB (gzip 52.40)
```

Note: B2/B3/B4 emit **no warnings** — there is no linter configured to warn.

---

## 3. Test coverage

### `tests/` (Python) — good unit coverage of pure helpers, near-zero integration
Covered: whitespace collapse, abstract truncation, author capping, arXiv ID parsing,
ISO-week bucketing, dedupe/merge, shard assembly + manifest, record projection,
manifest/shard writing + stale cleanup, `main()` happy/empty paths, client construction
semantics.

Not covered (real gaps, ordered by risk):
1. `build_index.collect_papers()` (`build_index.py:203-221`) — the actual network
   loop, the retention `break`, and the `UNLIMITED` cap. This is the function whose
   behaviour determines whether the deployed site has data, and it is entirely
   untested. A fake `iter_results` would cover it cheaply.
2. `build_index._result_datetime()` (`build_index.py:194`) — naive vs aware datetime
   handling, never exercised.
3. `build_index.iso_date()` (`build_index.py:77`) — the `datetime`/`date`/`None`/
   fallback branches are only hit incidentally.
4. `build_index.parse_args()` (`:248`) — every flag is untested, including `--category`
   repeat semantics and `--max-per-category 0`.
5. `paper-collector.fetch_papers()` (`paper-collector.py:58`) — PDF/source download,
   tarball extraction and the exception handler are untested.
6. `paper-collector.parse_args()` and `main()` — untested. `main()` contains the two
   unsanitized-`topic` filename writes called out in §4; nothing guards them.
7. `arxiv_common.build_client()` — only reached through a stubbed `build_client`, so
   the real `page_size` clamping arithmetic is never asserted against real `arxiv`.
8. No test loads a *fixture* manifest + shard pair end-to-end. The JS side has
   realistic fixtures; Python has none. Nothing pins the JSON contract between
   `build_index.write_index` and `paperIndex.loadShard` — a field rename would only
   surface at runtime in the browser.

### `web/src/lib/__tests__/` — 36 tests, pure-logic only, **zero component tests**
- `search.test.ts` (118 lines, 12 tests): tokenize (plain/quoted/unterminated/empty),
  scorePaper (implicit AND, title > abstract, phrase bonus, contiguity, empty=neutral),
  rankPapers (filter, score order, newest tie-break, no-match).
- `collections.test.ts` (307 lines, 14 tests): reducer add/dedupe/rename/blank-name/
  prune, mergeImport id collision, exportCollection (hit + miss), parseExportPayload
  (valid + malformed/invalid-paper drop), loadState/saveState (round-trip, malformed,
  dangling ids, storage-throws).
- `paperIndex.test.ts` (204 lines, 10 tests): manifest helpers, and PaperIndex for
  404 / network throw / HTML-fallback / window filtering / newest-first / progress +
  shard caching / empty manifest.

**There are no component or DOM tests at all, and the config makes them impossible
without changes:**
- `vite.config.ts:9` `include: ["src/**/*.test.ts"]` — `.tsx` is excluded, so a
  `PaperCard.test.tsx` would not even be collected.
- `vite.config.ts:8` `environment: "node"` — no `jsdom`.
- No `@testing-library/react`, no `jsdom`/`happy-dom`, no `@vitest/coverage-v8` in
  `devDependencies`; no test-setup file.

Completely untested UI/logic surface:
- `App.tsx` — all 458 lines: `readHash`/`writeHash` URL-state round-trip (the app's
  entire shareable-state feature, including the `RECENCY_VALUES` whitelist and
  default-stripping rules), `detectStorage`, `slugifyFilename`, `formatGeneratedAt`,
  `handleExport` blob/anchor/revoke dance, the category-toggle `?? activeCategories`
  fallback, and both `useEffect` cancellation paths.
- `PaperCard.tsx` — abstract preview/expand threshold, save-menu gating, create-and-save
  form, truncated-abstract note.
- `PaperList.tsx` — `visibleCount` slicing, remaining-count math, `emptyMessage`.
- `CollectionsView.tsx` — import file parsing + error states, rename/cancel, delete
  confirm, export disabled state.
- `FeedControls.tsx` — relevance-disabled-when-empty-query logic.
- `paperIndex.ts` `loadShard`'s non-ok and malformed-payload branches (`:105-124`) are
  untested; the manifest error paths are well covered but the shard error paths are not.

---

## 4. Security smells

No secrets committed. No `dangerouslySetInnerHTML`, no `innerHTML`, no `eval`, no
`new Function`, no `subprocess`/`os.system`, no `pickle`, no unsafe `yaml.load`
anywhere outside `node_modules`. Actions injection risk: none (see §1).

Real findings, most severe first:

1. **HIGH — `javascript:` URL injection via imported collection export.**
   `parseExportPayload` (`web/src/lib/collections.ts:51-62`) validates only `id`,
   `title`, `authors`, `abstract`. It does **not** validate `absUrl`, `pdfUrl`,
   `published`, or `categories`. `PaperCard.tsx:57,91,100,103` renders
   `href={paper.absUrl}` / `href={paper.pdfUrl}` directly. React does not block
   `javascript:` in `href`. So a malicious `.json` export file, imported via
   `CollectionsView`'s file input, renders clickable `javascript:alert(1)` links. It
   is stored in `localStorage` and re-rendered on every load. Fix: validate URL
   fields in `isPaper`/`parseExportPayload` and require an `https://arxiv.org/` (or at
   minimum `http(s)`) scheme, plus add `rel="noopener noreferrer"` and drop
   `target="_blank"` where not needed.

2. **HIGH — path traversal / arbitrary file write from `--topic`.**
   `scripts/paper-collector.py:138`: `df.to_csv(topic + "_papers.csv")` and `:142`:
   `filename = f"{args.output_dir}/{topic}-{len(df)}_papers_extracted_on_{prefix}.html"`.
   `topic` is raw user/CLI input, unsanitized, written into a path. `--topic
   "../../../../etc/cron.d/x"` escapes both the output directory and any reasonable
   expectation of where a "CSV export" lands. Note the file already has
   `safe_filename()` for *paper titles* but never applies it to `topic`. Fix: run
   `topic` through `safe_filename` (and strip separators/leading dots) or hash it for
   the filename.

3. **MEDIUM — `tarfile.extractall` with no `filter=` (CVE-2007-4559 class).**
   `scripts/paper-collector.py:79`: `file.extractall(f"./extracted/{title_slug}")`.
   A malicious arXiv source archive containing `../../` members writes outside the
   target directory. Python 3.12+ emits a DeprecationWarning and 3.14 defaults to
   `filter="data"`, but on 3.11 (the version that actually has the deps here) it is
   silently unsafe. Fix: `file.extractall(path, filter="data")` guarded by a version
   check, or `filter="tar"` if `../` members are tolerated.

4. **MEDIUM — downloads and extractions land in CWD, not the output dir.**
   `scripts/paper-collector.py:74-79` writes `f"{title_slug}.pdf"` and
   `f"{title_slug}.tar.gz"` and `./extracted/...` relative to the current working
   directory, ignoring `--output-dir` entirely. Combined with #3 and the missing
   `.gitignore` entries (§7), running the documented `--download-sources` example
   litters the repo root with untracked PDFs and tarballs.

5. **MEDIUM — the notebook is an unescaped, unpatched fork of the CLI.**
   `notebooks/paper-collector.ipynb`:
   - It builds `<b> ... </font>` HTML with **no `html.escape`**, so an arXiv title
     containing `<script>` becomes live script in the generated feed. `scripts/paper-collector.py`
     fixed this; the notebook was never updated. Same class of bug, still shipped.
   - It still loads MathJax over plaintext `http://cdnjs.cloudflare.com` — the exact
     issue the Python test `test_uses_https_for_mathjax` guards against.
   - It calls `arxiv.Search(...)` **without `max_results`**, so it silently caps at
     100 results. That is literally the bug commit `352e104` fixed in the shared
     client, and `MAX_PAPERS_TO_PULL = 1000` is honoured only by the manual
     `if len(all_data) >= MAX_PAPERS_TO_PULL: break`.
   - It uses raw `result.title` as the PDF/tarball filename (no `safe_filename`), and
     `file.extractall(f'./extracted/{result.title}')` with the same traversal exposure.
   - `readme.md:113-118` advertises it as "a Jupyter notebook version of the same
     workflow", which is now false.

6. **LOW — generated HTML in `build_html_feed` is malformed.**
   `scripts/paper-collector.py:88-122`: `<title>Mathedemo</title>` placeholder, no
   `<body>` open tag, mismatched nesting (`<b> ... </b> </font>` closes in the wrong
   order), and `<hr>` separators instead of semantic markup. Fields are escaped
   correctly, so this is a correctness/accessibility smell rather than an injection.

7. **LOW — `pandas` chained indexing in a loop.**
   `scripts/paper-collector.py:108-118`: `df["Title"][i]` per row inside a
   `range(len(df))` loop. This is the documented anti-pattern (label-based lookups in
   a loop, O(n) each) and breaks under any future index change. `.itertuples()` or
   `zip()` over the columns would be both faster and correct.

8. **INFO — `open(..., "w")` without `encoding` at `paper-collector.py:143`** relies on
   the platform default. Paper titles contain non-ASCII constantly, so this raises
   `UnicodeEncodeError` on a cp1252 Windows console. `build_index.py` correctly passes
   `encoding="utf-8"` everywhere — inconsistent.

9. **INFO — `logging.basicConfig()` at import time in both `scripts/arxiv_common.py:13`
   and `scripts/paper-collector.py:18`.** Importing a module reconfigures the root
   logger for the whole process, and the two configure it with different formats
   (`build_index.py:40` overrides with `%(levelname)s %(message)s`). Library code
   should not call `basicConfig`.

---

## 5. Dependency health

### `requirements.txt` (2 lines, both floating)
```
arxiv>=2.1.0
pandas>=2.0.0
```
- **Zero pinning** (`>=` floors only), **no upper bounds**, **no lockfile**, **no
  hashes**. Two consecutive CI runs a month apart can install different code. This is
  the weakest part of dependency management in the repo.
- **No `requirements-dev.txt` / `[dev]` extras.** No test-runner pin (the suite is
  stdlib `unittest`, so nothing is strictly required), no linter, no type checker, no
  security scanner. Nothing declares what a contributor should install beyond runtime.
- **No `pyproject.toml` at all** — so no `[project]` metadata, no `requires-python`,
  no `[tool.ruff]`/`[tool.pytest]`/coverage config. Packaging and tooling config are
  both absent.
- `pandas` (a heavy transitive dep: numpy, pytz, tzdata) is used in exactly one place,
  `paper-collector.py:14` + `fetch_papers`. `build_index.py` — the CI-critical path —
  does not need it. `deploy.yml:31` installs pandas on every deploy for nothing.
- Installed/resolved: `arxiv 2.1.3`, `pandas 2.2.1`.
- No `.python-version`, no `runtime.txt` — the Python version is whatever `"3.x"`
  resolves to on the runner.

### `web/package.json`
```json
"dependencies":    { "react": "^18.3.1", "react-dom": "^18.3.1" }
"devDependencies": { "@types/react": "^18.3.12", "@types/react-dom": "^18.3.1",
                     "@vitejs/plugin-react": "^4.3.4", "typescript": "^5.6.3",
                     "vite": "^5.4.11", "vitest": "^2.1.8" }
```
- **Dependencies are clean and minimal** — exactly `react` + `react-dom`, both actually
  imported. No unused runtime deps, no duplicate-purpose libraries, no bloat. This is
  the healthiest part of the repo.
- All ranges are `^` (floating), but this is fine in practice because
  **`web/package-lock.json` is committed** (72 KB) and both workflows use `npm ci`.
  That is correct lockfile hygiene.
- **Missing dev deps** relative to what the code and CI imply: no ESLint
  (`eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`), no Prettier, no
  `@vitest/coverage-v8`, no `jsdom`/`happy-dom` + `@testing-library/react`
  (blocking any component test), no `publint`/`arethetypeswrong`, no `npm-run-all`
  or `lint-staged`/`husky` for a single-command check.
- **No `engines` field and no `.nvmrc`.** Node 20 is pinned only inside the two
  workflows, so local development silently drifts. Vite 5 / Vitest 2 require Node
  ≥18.
- **Stale major versions** (`npm outdated`): `react` 18.3.1 → 19.3.0,
  `@types/react` → 19.3.0, `@types/react-dom` → 19.3.0,
  `@vitejs/plugin-react` 4.7.0 → 6.1.1, `typescript` 5.9.3 → 7.0.2,
  `vite` 5.4.21 → 8.3.2, `vitest` 2.1.9 → 4.1.11. Note the manifest floors
  (`typescript ^5.6.3`, resolved 5.9.3) are already two majors behind latest.
- **No Dependabot config** (`.github/dependabot.yml` does not exist) despite 5 open
  advisories and 7 outdated packages. That single missing file would have caught the
  critical vitest advisory.
- **No `scripts.lint`**, so there is no single command that runs the whole local check
  suite; `readme.md` documents `npm test` and `npm run build` but nothing else.

---

## 6. Performance

1. **No debounce on search input — full re-rank per keystroke.**
   `web/src/components/FeedControls.tsx:41` fires `onQueryChange` on every
   `onChange`, and `App.tsx:241` `setQuery` → `writeHash` + `setUrlState` → the
   `visiblePapers` memo (`App.tsx:207-224`) re-runs `rankPapers` over the **entire**
   loaded paper set. With a 60-day window across `cs.CV/LG/CL/AI/RO` that is tens of
   thousands of papers; each `scorePaper` (`search.ts:58`) builds a fresh
   `${title} ${authors} ${abstract}` template string per paper per keystroke. This is
   the dominant client-side cost and is entirely avoidable (debounce ~150-250 ms,
   and/or hoist the lowercased strings onto a precomputed shape).

2. **No virtualization in `PaperList`.** `PaperList.tsx:39` `papers.slice(0, visibleCount)`
   renders every visible card; `visibleCount` grows by 50 per click
   (`App.tsx:424`) with no cap and no windowing. At a few thousand cards this is
   thousands of live `<article>` nodes with per-card `useState`.

3. **`isSaved` is O(collections × paperIds) and called per card per render.**
   `App.tsx:261-266` uses `Array.prototype.some` + `.includes`. Passed to every
   `PaperCard` (`PaperList.tsx:49`), so cost is `papers × collections × ids` on every
   render triggered by (1). A `Set` of `"collectionId:paperId"` built once in a memo
   is O(1).

4. **`fetch` calls have no timeout and no `AbortController`.**
   `web/src/lib/paperIndex.ts:77` and `:105` — grep confirms zero occurrences of
   `AbortController`, `signal`, or `timeout` in `web/src/`. A hung CDN request leaves
   the app stuck on "Loading papers from N weeks…" forever; there is no retry and no
   user-facing cancel. `App.tsx`'s `cancelled` flag only discards results, it does not
   abort the in-flight requests, so switching the recency window leaves orphaned
   downloads running.

5. **No shard-cache invalidation.** `PaperIndex.manifestPromise` (`:62`) and
   `shardCache` (`:64`) live for the page's lifetime with no TTL. After a new deploy
   pushes a fresh `index.json`, a long-lived tab never sees it. Conversely
   `loadShard` uses default HTTP caching while `fetchManifest` forces
   `cache: "no-cache"` (`:77`) — an inconsistent policy for two files from the same
   deploy.

6. **`Promise.all` over all shards, unbounded.** `paperIndex.ts:150-157` fetches every
   shard in the window simultaneously. For 60 days that is ~9 requests, fine — but the
   pattern has no concurrency cap and would fan out badly if retention grew.

7. **`build_index` will be slow in CI.** `arxiv_common.build_client`
   (`arxiv_common.py:20-26`) sets `delay_seconds=10` with `page_size` up to 1000, and
   `collect_papers` (`build_index.py:203-221`) queries 5 categories sequentially. The
   retention `break` saves the tail, but the early pages still cost ~10 s each, so a
   full 5-category run is plausibly tens of minutes of wall clock on the runner —
   with no `timeout-minutes` on the job. This also means `deploy.yml` depends entirely
   on arXiv availability, and `iter_results` (`arxiv_common.py:58-59`) swallows
   `ArxivError`, so a mid-run failure publishes a **silently truncated index** and
   still exits 0. Only a completely empty result set fails the build (`:289-291`).

8. **`dedupe_records` + `build_shards` hold everything in memory** (`build_index.py:117-191`),
   which is fine at current scale (~50k short records) but is O(n) memory with no
   streaming path.

9. **Committed binary:** `images/feed_example.png` is 456 KB, referenced by
   `readme.md:11`. Acceptable for a README hero image, not a bloat problem.

---

## 7. Repo hygiene

**What is correct:** `.gitignore` handles `.DS_Store`, `__pycache__/`, `*.pyc`,
`results/*.html`, `results/*.csv`, `web/node_modules/`, `web/dist/`,
`web/public/data/`, plus `!results/.gitkeep`. Verified via `git ls-files` and
`git check-ignore`:

- `.DS_Store` — **present on disk, correctly ignored, NOT tracked.** Fine.
- `__pycache__` / `.pyc` — **present on disk (cpython-311/312/314), correctly ignored,
  NOT tracked.** Fine. (Moot point given the coverage caveat in the baseline list.)
- `web/dist/` — **present on disk with stale build output
  (`index-CZyXEdzB.css`, `index-sWl3ksVo.js`), correctly ignored, NOT tracked.** Note
  the on-disk `dist` predates HEAD: my `npm run build` emitted
  `index-DhFU7_e3.css` / `index-C7dmSHFy.js`. Local artifacts only.
- `web/node_modules/` — not tracked (0 matches). Good.
- No `results/*.html` or `*.csv` present.

**Gaps in `.gitignore`:**
- `extracted/` — `paper-collector.py:79` creates `./extracted/<slug>/` in CWD.
  Nothing ignores it.
- `*.pdf` and `*.tar.gz` — the download outputs from `:75` and `:77`.
- `*_papers.csv` — `--save-csv` writes `topic + "_papers.csv"` to **CWD**, not to
  `results/`, so the existing `results/*.csv` rule does not cover it.
- `.venv/`, `venv/`, `env/`, `.python-version` — absent, so a contributor's venv is
  committable by accident.
- `.ruff_cache/`, `.mypy_cache/`, `.pytest_cache/`, `.coverage`, `htmlcov/` — absent.
- `.vscode/`, `.idea/` — absent.
- `*.log`
- Root `.gitignore` does not ignore `/web/package-lock.json` (correct — it should be
  tracked, and it is).

**Tracked junk:** none. `git ls-files` returns 43 files, all intentional. No build
output, no lockfile churn, no committed `node_modules`, no `.env`, no editor cruft.

**Documentation accuracy vs. actual code:**
- `readme.md:123` — "deploys the site to GitHub Pages on **a daily schedule**". The
  cron is `0 6 * * 0` = **weekly**. Also `deploy.yml:5`'s own comment repeats the error.
- `readme.md:113-118` — the notebook is described as "the same workflow"; it is
  materially different and less safe (§4.5).
- `readme.md:61-67` — "Web tests and build" documents `npm test` and `npm run build`.
  Accurate. But `npm run typecheck` exists (`package.json:12`) and is what CI actually
  runs, and it is **undocumented**.
- `readme.md:66` — `npm run build  # tsc --noEmit && vite build`. Accurate.
- `readme.md:42-44` — `--retention-days`, `--max-per-category`, `--abstract-chars`,
  `--out-dir`. All exist (`build_index.py:248-275`). Accurate. `--category` exists but
  is **undocumented**.
- `readme.md:96-104` — the CLI options table matches `paper-collector.py:30-54`
  exactly, including the `1000` / `results` defaults. Accurate.
- `readme.md:54-55` — dev server under `/research-paper-feed/`. Matches
  `vite.config.ts:5`. Accurate.
- `readme.md:9` — live URL matches the repo name and the Vite base. Accurate.
- `readme.md:122-125` — "CI runs the Python `unittest` suite and the web typecheck/tests."
  Accurate, though it omits that CI never builds and never lints.
- `readme.md` is named `readme.md`, not `README.md`. GitHub renders it fine, but it is
  an odd deviation from convention.
- No `docs/` directory and no other documentation beyond `readme.md` +
  `CONTRIBUTING.md`. Architecture, the shard format, and the JSON contract are
  undocumented outside source docstrings.

**`CONTRIBUTING.md` quality — thin (25 lines):**
- ✅ Fork/clone, `pip install -r requirements.txt`, `python -m unittest discover -s tests -v`,
  "add or update tests in `tests/`", "make sure CI passes".
- ❌ **The documented test command fails on macOS**: `python` does not exist here
  (only `python3`, and `python3` lacks `arxiv`/`pandas`). It should say `python3 -m
  unittest ...` and point at creating a virtualenv.
- ❌ No mention of the `web/` app at all — no `npm ci`, no `npm run typecheck`, no
  `npm test`, no `npm run build`. A contributor has no idea the frontend has tests.
- ❌ No commit-message convention, no branch naming, no PR template, no
  CODEOWNERS/CODE_OF_CONDUCT.
- ❌ No lint/format instructions (because none exist) and no Python version statement.
- ❌ No `web/README.md`.
- ❌ "For major changes, please open an issue first" is the only design guidance.

**Other:**
- `scripts/` has **no `__init__.py`**, and `scripts/paper-collector.py` has a hyphen in
  its filename, so it is **not importable** as a normal module. Every test therefore
  duplicates an `importlib.util.spec_from_file_location` dance
  (`tests/test_build_index.py:12-18`, `test_arxiv_common.py:11-17`,
  `test_paper_collector.py:11-19`) and each `scripts/*.py` mutates `sys.path` at
  import time (`build_index.py:26`, `paper-collector.py:11`). This is why there is no
  `conftest.py` and no `pytest` config — the layout actively resists a normal test
  setup. Renaming to `paper_collector.py` with a shim, or adding `scripts/__init__.py`,
  would let the tests import normally.
- No `LICENSE` header check; `LICENSE` (MIT) is present and correct.
- No `MANIFEST.in` / packaging — irrelevant for a scripts repo, but no `pyproject.toml`
  at all means no `ruff`/`pytest`/coverage config can live anywhere.

---

## Candidate improvements (concrete, ordered)

1. `web/src/lib/collections.ts:51-62` — validate `absUrl`, `pdfUrl`, `published`,
   `categories` in `isPaper`/`parseExportPayload` and require an `http(s)` scheme
   (prefer `https://arxiv.org/`) to close the `javascript:` URL injection reachable via
   `PaperCard.tsx:57,91,100,103`.
2. `scripts/paper-collector.py:138,142` — sanitize `topic` (reuse `safe_filename`, strip
   separators/leading dots) before interpolating it into CSV and HTML output paths.
3. `scripts/paper-collector.py:79` — `file.extractall(path, filter="data")` with a
   `sys.version_info` guard, and write downloads/extractions under `args.output_dir`
   instead of CWD (`:74-79`).
4. `notebooks/paper-collector.ipynb` cells 5-8 — bring in line with
   `scripts/paper-collector.py`: add `html.escape`, switch MathJax to `https://`, pass
   `max_results` to `arxiv.Search`, use `safe_filename`, add `filter="data"`.
5. `web/src/components/FeedControls.tsx:41` + `web/src/App.tsx:207-224` — debounce query
   input (~200 ms) so `rankPapers` does not re-rank the full corpus per keystroke.
6. `web/src/lib/paperIndex.ts:77,105` — add an `AbortController` (plus a timeout) to
   both `fetch` calls and wire `App.tsx`'s `useEffect` cleanup to abort in-flight
   requests; add a short TTL to `manifestPromise`/`shardCache`.
7. `web/src/App.tsx:261-266` — memoize a `Set` of `"collectionId:paperId"` for `isSaved`
   to remove the per-card O(collections × ids) scan.
8. `web/src/lib/collections.ts:51-52` — preprocess once per search: lowercase and join
   title/authors/abstract into a cached field on load, so `scorePaper`
   (`web/src/lib/search.ts:55-58`) stops allocating three lowercase copies plus a
   combined string per paper per keystroke.
9. `scripts/arxiv_common.py:58-59` — surface partial-failure to the caller (log a
   warning count and let `build_index.main` at `:289` fail when a category returns
   fewer records than expected) so a mid-run arXiv outage cannot publish a silently
   truncated index with exit code 0.
10. `.github/workflows/ci.yml` — add an `npm run build` step after `typecheck` (biggest
    CI gap: a broken Vite build is currently only caught on `main`), plus
    `permissions: contents: read`, `concurrency`, `timeout-minutes`, `path:` filters,
    and a Python version matrix.
11. `.github/workflows/ci.yml` + `deploy.yml` — pin all actions to commit SHAs, and add
    `cache: pip` + `cache-dependency-path: requirements.txt` to `setup-python`.
12. `web/package.json` — add `eslint` + `typescript-eslint` + `eslint-plugin-react-hooks`
    and a `lint` script; add `@vitest/coverage-v8`, and `jsdom` +
    `@testing-library/react` so component tests become possible.
13. `web/vite.config.ts:8-9` — switch `environment` to `jsdom` and widen `include` to
    `["src/**/*.test.ts", "src/**/*.test.tsx"]`, then add the first component tests for
    `PaperCard.tsx`, `PaperList.tsx`, and `App.tsx`'s `readHash`/`writeHash`.
14. `requirements.txt` — pin exact versions with upper bounds (`arxiv>=2.1.3,<3`,
    `pandas>=2.2,<3`), or generate a `requirements.lock` with hashes; add
    `requirements-dev.txt` for ruff/mypy/coverage.
15. Add a `pyproject.toml` — `[project]` metadata with `requires-python`, plus
    `[tool.ruff]`, `[tool.pytest.ini_options]`, and coverage config so tooling has one
    home.
16. `.github/dependabot.yml` — add npm and pip ecosystems; this alone would have
    surfaced the critical `vitest` advisory and the 7 outdated packages.
17. `requirements.txt` / `.github/workflows/deploy.yml:31` — stop installing `pandas` on
    the deploy path; it is only needed by `scripts/paper-collector.py`, not by
    `build_index.py`.
18. `tests/test_build_index.py` — add coverage for `collect_papers`
    (`scripts/build_index.py:203-221`, retention `break` + `UNLIMITED`),
    `_result_datetime` (`:194`), `iso_date` (`:77`), and `parse_args` (`:248`) using a
    fake `iter_results`.
19. `tests/test_paper_collector.py` — add tests for `fetch_papers`
    (`scripts/paper-collector.py:58`, download + extraction error handling) and for
    `main()`'s output paths, which currently encode the unsanitized-`topic` behaviour.
20. Add a JSON-contract fixture test that round-trips a `build_index.write_index`
    manifest + shard through `PaperIndex.loadPapers` so a field rename fails in CI
    rather than in the browser.
21. `.gitignore` — add `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv`, `.venv/`,
    `venv/`, `.ruff_cache/`, `.mypy_cache/`, `.pytest_cache/`, `.coverage`, `htmlcov/`,
    `.vscode/`, `*.log`.
22. `scripts/build_index.py:26` and `scripts/paper-collector.py:11` — replace the
    `sys.path.insert` import hack with `scripts/__init__.py` plus a
    `paper_collector.py` name (keeping a `paper-collector.py` shim if the hyphenated
    path must keep working), so the tests can `import build_index` normally instead of
    repeating `importlib` boilerplate three times.
23. `scripts/arxiv_common.py:13`, `scripts/paper-collector.py:18`,
    `scripts/build_index.py:40` — move `logging.basicConfig` out of module import scope
    into `main()`, and use one shared format.
24. `scripts/paper-collector.py:88-122` — fix the malformed HTML (`<title>`, missing
    `<body>`, mismatched `</b>`/`</font>` nesting) and switch the row loop
    (`:108-118`) off `df["Col"][i]` chained indexing to `itertuples()`/`zip`.
25. `scripts/paper-collector.py:143` — pass `encoding="utf-8"` to `open`, matching
    `scripts/build_index.py:240,243`.
26. `deploy.yml:5` and `readme.md:123` — correct "every day" to the actual weekly
    (`0 6 * * 0`) schedule, or change the cron to `0 6 * * *` if daily was the intent.
27. `CONTRIBUTING.md` — fix the broken `python -m unittest` command to `python3` with a
    virtualenv step, and document the `web/` workflow (`npm ci`, `npm run typecheck`,
    `npm test`, `npm run build`); add commit-message and branch-naming conventions.
28. `readme.md:61-67` — document `npm run typecheck` (what CI actually runs) and the
    undocumented `--category` flag (`scripts/build_index.py:270-274`).
29. `readme.md:113-118` — correct the notebook description once item 4 lands, or mark
    the notebook as unmaintained/legacy and point at the CLI.
30. `web/src/components/PaperList.tsx:39` + `App.tsx:424` — cap `visibleCount` and note
    the virtualization tradeoff; the current unbounded growth will degrade as retention
    widens.