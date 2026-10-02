# Recon Runbook — research-paper-feed

Recon date: 2026-10-02. Repo root: `/Users/denimpatel/Desktop/git/research-paper-feed`
Branch HEAD: `1c075b3 Restyle web feed to match denimpatel.github.io design system (#4)`

Repo shape: a **Python data pipeline** (2 CLI scripts + shared helper) that queries the
arXiv API, plus a **static React/TypeScript SPA** (`web/`) deployed to GitHub Pages.
There is no backend server, no database, and no docs generator.

```
scripts/arxiv_common.py       shared arXiv client (rate limit, retries, sort)
scripts/build_index.py        sharded JSON index builder  (CI + deploy entry point)
scripts/paper-collector.py    one-shot HTML feed CLI (interactive topic prompt)
tests/                        unittest suite (27 tests, no network)
web/                          Vite + React 18 + TS 5 + vitest
notebooks/paper-collector.ipynb  interactive notebook (manual only)
.github/workflows/ci.yml      python-tests + web-tests
.github/workflows/deploy.yml  build_index -> npm build -> Pages
```

---

## 0. Environment as measured

| Tool | Version | Notes |
| --- | --- | --- |
| `python3` (system default) | 3.14.3 | `/opt/homebrew/bin/python3` |
| other pythons | 3.8, 3.12.7, 3.13, 3.14 | Homebrew only; no `pyenv`, no `uv` |
| `node` | v25.6.1 | CI pins node **20** |
| `npm` | 11.9.0 | |
| `web/node_modules` | present, 62 packages, complete | `.bin` has `vite`, `vitest`, `tsc` |

Network is reachable (verified): `pypi.org` → 200, `registry.npmjs.org` → 200,
`export.arxiv.org/api/query` → 301 (redirect, then served).

No Python venv, `pyproject.toml`, `setup.cfg`, `tox.ini`, `Makefile`, or `.venv` exists in the
repo. All Python below was validated in throwaway venvs created **outside** the repo so the
working tree stays clean:

```
/var/folders/.../T/kilo/rpf-venv312/bin/python   # 3.12.7
/var/folders/.../T/kilo/rpf-venv314/bin/python   # 3.14.3
```

---

## 1. Python

### 1.1 Create env + install (canonical)

```shell
python3 -m venv .venv          # or python3.12 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

**WORKS.** Needs network (PyPI). `requirements.txt` is only two lines:

```
arxiv>=2.1.0
pandas>=2.0.0
```

Resolved on 2026-10-02 (note the drift — see Finding P1):

```
arxiv 4.0.1, pandas 3.0.6, numpy 2.5.3, requests 2.34.2, lxml 6.1.3,
python-dateutil 2.9.0.post0, certifi 2026.7.22, charset_normalizer 3.5.2,
idna 3.18, urllib3 2.8.0, six 1.17.0
```

Install takes ~15 s warm / ~60 s cold. Works identically on 3.12.7 and 3.14.3.

> Note: there is **no `.venv` in `.gitignore`** (root `.gitignore` covers only
> `__pycache__/`, `*.pyc`, `results/*.html`, `results/*.csv`, `web/node_modules/`,
> `web/dist/`, `web/public/data/`, `.DS_Store`, `*.ipynb_checkpoints`). Creating `.venv`
> inside the repo dirties `git status`. See Finding P4.

### 1.2 Test — canonical command

```shell
python -m unittest discover -s tests -v
```

**WORKS.** `Ran 27 tests in 0.010s / OK`, exit 0. Fully offline — every test injects a fake
arXiv client (`tests/test_arxiv_common.py` monkeypatches `arxiv_common.arxiv` with a
`SimpleNamespace`), so the suite never touches the network.

- Tests: `test_arxiv_common.py` (5), `test_build_index.py` (18), `test_paper_collector.py` (4).
- `paper-collector.py` and `arxiv_common.py` have a **hyphen/dot** in the name, so tests load
  them via `importlib.util.spec_from_file_location` rather than importing by module name.
- Verified on Python **3.12.7** and **3.14.3** — 27/27 on both.

`pytest` also works (it picks up the `unittest.TestCase` classes) but is **not** a declared
dependency:

```shell
pip install pytest && python -m pytest tests -q     # WORKS -> 27 passed in 0.60s
```

Creating `.pytest_cache/` in the repo root — it is **not** gitignored (Finding P4).

### 1.3 Lint / format / type-check — **NONE CONFIGURED**

There is no linter, formatter, or type-checker config anywhere in the repo:

- no `pyproject.toml`, `setup.cfg`, `tox.ini`, `.flake8`, `.ruff.toml`, `.pylintrc`, `.isort.cfg`
- no `[tool.*]` config of any kind
- no `Makefile` / `noxfile.py`
- no `ruff`, `black`, `flake8`, `mypy`, `pylint`, `isort` in `requirements.txt`
- nothing installed globally in any interpreter
- `.github/workflows/ci.yml` runs **only** `pip install` + `unittest` — no lint step
- `.github/workflows/deploy.yml` runs **only** `pip install` + `build_index` — no lint step

Not installed by default. If you want to try one you must install it first:

```shell
pip install ruff    # then: ruff check scripts tests
```

Closest thing to a style contract today is the ad-hoc `# noqa: E402` markers in
`scripts/build_index.py:28` and `scripts/paper-collector.py:13-16` (for imports after
`sys.path.insert`), which imply the author intended flake8/ruff defaults but never wired it up.

### 1.4 Syntax check (free, no install)

```shell
python -m compileall -q scripts tests     # WORKS, exit 0
```

### 1.5 `scripts/build_index.py` — the CI/deploy entry point

CLI (from `parse_args`, `scripts/build_index.py:248`):

| Flag | Default | Meaning |
| --- | --- | --- |
| `--out-dir` | `web/public/data` | where `index.json` + shards go |
| `--retention-days` | `60` | drop papers older than this |
| `--max-per-category` | `0` | dev escape hatch cap per category; `0` = no cap |
| `--abstract-chars` | `500` | abstract truncation length |
| `--category` | `cs.CV,cs.LG,cs.CL,cs.AI,cs.RO` | repeatable override |

**Hits the network — yes.** Only `collect_papers()` (`scripts/build_index.py:203`) touches
arXiv, one `cat:<category>` query per category. `arxiv_common.iter_results` builds an
`arxiv.Client(page_size=min(1000, max_results), delay_seconds=10, num_retries=5)`, sorted
`SubmittedDate` / `Descending`. arXiv errors are swallowed and logged, so a network failure
yields zero records, and `main()` then logs `"No papers fetched; refusing to write an empty
index."` and returns **exit 1** (fail-loud, covered by a test).

Writes `index.json` (manifest) + `papers-<YYYY>-W<NN>.json` (one shard per ISO week), and
first deletes any stale `papers-*.json` in the out dir (`_clean_old_shards`).

Measured runs (gentle caps, one arXiv request each):

```shell
python scripts/build_index.py --help                                        # WORKS, 0.3s
python scripts/build_index.py --category cs.CV --max-per-category 20 \
    --out-dir /tmp/recon-index                                              # WORKS, 10.6s wall
```

The 10.6 s is almost entirely the hard-coded 10 s `delay_seconds`; arXiv itself returned in
well under a second (`Got first page: 20 of 207907 total results`). Output: 1 shard,
18 KB, 20 papers.

**Full production run** (`python scripts/build_index.py`, 5 categories, 60-day retention, no
cap) succeeded during this recon window and produced 2,812 papers across 2 shards
(`2026-W40`: 2549, `2026-W39`: 263) = 6.8 MB of JSON. It finished at `02:44:04Z`, i.e. it had
to page through ~3 pages/category at 10 s/page → **expect roughly 2–5 minutes**, not seconds.
Don't run it casually; use `--max-per-category` for dev.

### 1.6 `scripts/paper-collector.py` — the interactive one-shot CLI

CLI (from `parse_args`, `scripts/paper-collector.py:26`):

| Flag | Default | Meaning |
| --- | --- | --- |
| `--topic` | *(prompted via `input()`)* | arXiv query string |
| `--max-papers` | `1000` | cap |
| `--output-dir` | `results` | HTML output dir |
| `--download-pdfs` | off | also fetch each PDF |
| `--download-sources` | off | also fetch+untar each LaTeX archive |
| `--save-csv` | off | also write a metadata CSV |

**Hits the network — yes**, via the same `arxiv_common.iter_results`. Writes a self-contained
HTML feed (inline CSS + MathJax CDN) into `--output-dir`.

```shell
python scripts/paper-collector.py --help                                     # WORKS, 0.3s
python scripts/paper-collector.py --topic 'cat:cs.CV AND "3d reconstruction"' \
    --max-papers 5 --output-dir /tmp/recon-results --save-csv                # WORKS, 1.4s wall
```

Output: `Number of papers extracted :  5` plus an HTML file named
`<topic>-5_papers_extracted_on_MM-DD-YYYY-HH-MM-SS.html`.

Running with **no `--topic`** blocks on `input("Enter the topic you need to search for : ")`
— it is interactive by design and cannot be scripted.

---

## 2. Web (`web/`)

`web/package.json` scripts — verified names, no `lint` script exists:

| Script | Command | Result |
| --- | --- | --- |
| `npm run dev` | `vite` | **WORKS** (auto-picks a free port) |
| `npm run build` | `tsc --noEmit && vite build` | **WORKS**, ~0.6–0.9 s |
| `npm run preview` | `vite preview` | **WORKS** |
| `npm test` | `vitest run` | **WORKS**, 36 tests, 0.97 s |
| `npm run test:watch` | `vitest` | interactive watcher, not exercised |
| `npm run typecheck` | `tsc --noEmit` | **WORKS** |
| `npm run lint` | — | **DOES NOT EXIST** (see W1) |

### 2.1 Install

`web/node_modules` is already **present and complete** (62 top-level packages;
`npm ls --depth=0` resolves cleanly: react 18.3.1, react-dom 18.3.1, typescript 5.9.3,
vite 5.4.21, vitest 2.1.9, @vitejs/plugin-react 4.7.0, @types/react 18.3.31,
@types/react-dom 18.3.7).

```shell
cd web
npm ci            # not run for real (would wipe/reinstall); validated with:
npm ci --dry-run  # WORKS, exit 0 — lockfile is in sync, only fsevents 2.3.3 would be added
```

**Network is required** for a real `npm ci`/`npm install`. Lockfile is in sync with
`package.json`, so installs should be reproducible.

### 2.2 Typecheck — the lint substitute

```shell
cd web && npm run typecheck      # WORKS, exit 0, no output
```

`web/tsconfig.json` is already strict, which is why there is no separate linter:
`strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`,
`isolatedModules`, `esModuleInterop`, `skipLibCheck`, `noEmit`. `include: ["src", "vite.config.ts"]`.

### 2.3 Tests

```shell
cd web && npm test              # WORKS, exit 0
```

```
✓ src/lib/__tests__/search.test.ts       (12 tests)
✓ src/lib/__tests__/collections.test.ts  (14 tests)
✓ src/lib/__tests__/paperIndex.test.ts   (10 tests)
Test Files  3 passed (3)   Tests  36 passed (36)   Duration  966ms
```

`web/vite.config.ts` sets `test.environment: "node"` and `include: ["src/**/*.test.ts"]`.
Consequence: **only `src/lib/__tests__/*.test.ts` runs.** The four React components
(`App.tsx`, `components/CollectionsView.tsx`, `FeedControls.tsx`, `PaperCard.tsx`,
`PaperList.tsx`) have **zero** component/DOM coverage, and no jsdom/testing-library is
installed. That is a coverage gap, not a failure (see W2).

### 2.4 Build

```shell
cd web && npm run build        # WORKS, exit 0
```

```
✓ 38 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-C7dmSHFy.js   163.17 kB │ gzip: 52.40 kB
✓ built in 564ms
```

**Ordering matters and is easy to get wrong.** `vite build` copies `public/` into `dist/`.
If you build before the index exists, `dist/data/` is absent and the deployed site silently
serves the "no paper index yet" state — the SPA fallback returns `200 text/html` for
`/data/index.json`, so a naive `curl -o /dev/null -w %{http_code}` health check passes anyway.
Verified both directions:

- built with `web/public/data/` empty → `ls dist/data` → **no such dir**
- rebuilt after the index existed → `dist/data/{index.json,papers-2026-W40.json,papers-2026-W39.json}`

`deploy.yml` gets this right (build_index at step 33, `npm run build` at step 48). The
readme's step-1/step-2 ordering is also correct.

### 2.5 Dev server

```shell
cd web && npm run dev
```

**WORKS.** On this machine 5173 and 5174 were already occupied by *unrelated* local projects
(`~/Desktop/macro-economics` and `~/Desktop/learn-micro-gpt`), so Vite printed
`Port 5173 is in use, trying another one... / Port 5174 is in use, trying another one...`
and bound **5175**. That is an environment collision, **not** a repo bug — Vite has no
`strictPort` and auto-increments. For a deterministic port use
`npm run dev -- --port 5199 --strictPort`.

App URL is under the Pages base path (`base: "/research-paper-feed/"` in `vite.config.ts`),
so it is served at <http://localhost:5175/research-paper-feed/> — **not** at `/`.

### 2.6 Preview server (serves `dist/`)

```shell
cd web && npm run preview -- --port 5199 --strictPort   # WORKS, exit 0
```

`GET /research-paper-feed/` → `200`. As noted in 2.4, whether `/research-paper-feed/data/index.json`
resolves depends on whether the build saw the index.

### 2.7 End-to-end render verification (Playwright)

Against `npm run dev` **after** a real index build, the app renders fully:

```
"2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index generated Oct 1, 2026"
"2,812 papers match"
```

with real `article` cards (title links to arXiv abs page, date, authors incl. `et al.`
truncation, category chips, 500-char truncated abstract + "Abstract truncated — view the full
text on arXiv", arXiv + PDF links, "Show more" expander), working
Feed/Collections nav, category multi-select, 7/30/60-day recency, Newest/Relevance sort
(Relevance correctly disabled when the query box is empty), and the footer.
Console shows only the benign React-DevTools notice.

Against a build **without** an index it renders the documented degraded state instead of
failing, matching the readme claim.

---

## 3. Docs site / examples / notebooks

- **No docs site generator.** No `docs/`, no mkdocs/docusaurus/jekyll config. The "live site"
  is GitHub Pages serving `web/dist`, i.e. the React app itself
  (<https://denimpatel.github.io/research-paper-feed/>).
- **Locally serving the built site:** `cd web && npm run preview` (any static file server
  works, but the `/research-paper-feed/` base path must be honoured).
- **No examples directory.** Worked examples live only in `readme.md`.
- **Notebook:** `notebooks/paper-collector.ipynb` (nbformat 4.5, kernel `python3`/ipykernel,
  `language_info.version` recorded as 3.9.13). 9 cells: imports → config constants →
  second import block → markdown topic ideas → **`topic = input(...)`** → arXiv client loop →
  DataFrame + optional CSV → `df.head(1)` → inline HTML template.

  **Cannot be executed headless.** Neither jupyter nor nbconvert is a declared dependency,
  and `pip install jupyter nbconvert ipykernel` had to be done manually to even try.
  `jupyter nbconvert --to notebook --execute notebooks/paper-collector.ipynb` runs cells 0–3
  fine, then dies at cell 4 with
  `nbclient.exceptions.CellExecutionError` / `StdinNotImplementedError: raw_input was called,
  but this frontend does not support input requests.` — the `input()` call makes it structurally
  interactive, and cell 5 also needs live arXiv access.

  It is **not** referenced by CI or deploy. Treat it as a manual/Colab convenience, and be
  aware it is a **fork of the pre-refactor CLI**: it duplicates the arXiv client, DataFrame
  schema, and HTML template inline instead of importing `scripts/arxiv_common.py` or
  `scripts/paper-collector.py`, so it has already drifted (see W4).

---

## 4. CI — exact commands, read from `.github/workflows/ci.yml`

`python-tests` (ubuntu-latest):

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-python@v5   # python-version: "3.x"
- run: pip install -r requirements.txt
- run: python -m unittest discover -s tests -v
```

`web-tests` (ubuntu-latest, `working-directory: web`):

```yaml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4     # node-version: "20", cache: npm,
                                  # cache-dependency-path: web/package-lock.json
- run: npm ci
- run: npm run typecheck
- run: npm test
```

Triggers: `push` to `main`, and every `pull_request`.

**Everything CI runs was reproduced locally and passes.** The only untested delta is the
interpreter/OS matrix (CI = latest `3.x` on Ubuntu + node 20; local = 3.12.7/3.14.3 on
macOS arm64 + node 25). CI runs **no lint step at all**.

## 5. Deploy — exact commands, read from `.github/workflows/deploy.yml`

Triggers: `schedule` `cron: "0 6 * * 0"`, `push` to `main`, `workflow_dispatch`.
Permissions: `contents: read`, `pages: write`, `id-token: write`. Concurrency group `pages`,
`cancel-in-progress: false`.

`build` job:

```yaml
- run: pip install -r requirements.txt
- run: python scripts/build_index.py        # <- the only network step; ~2-5 min
- run: npm ci                               # working-directory: web
- run: npm run build                        # working-directory: web
- uses: actions/configure-pages@v5
- uses: actions/upload-pages-artifact@v3    # path: web/dist
```

`deploy` job: `needs: build`, `environment: github-pages`, `uses: actions/deploy-pages@v4`.

One-time manual setup required: repo **Settings → Pages → Source = GitHub Actions**, otherwise
the first deploy fails (documented in the readme).

---

## 6. Command → verdict table

| Command | Verdict |
| --- | --- |
| `python3 -m venv .venv` | WORKS |
| `pip install -r requirements.txt` | WORKS (needs network) |
| `python -m unittest discover -s tests -v` | WORKS — 27/27, offline, exit 0 |
| `python -m pytest tests -q` | WORKS (after `pip install pytest`) — 27/27 |
| `python -m compileall -q scripts tests` | WORKS, exit 0 |
| `ruff check` / `black` / `flake8` / `mypy` | N/A — not configured, not installed |
| `python scripts/build_index.py --help` | WORKS, 0.3 s |
| `python scripts/build_index.py` (full) | WORKS — **network**, ~2–5 min, 2812 papers / 6.8 MB |
| `python scripts/build_index.py --category cs.CV --max-per-category 20` | WORKS — 10.6 s (10 s is arXiv delay) |
| `python scripts/paper-collector.py --help` | WORKS, 0.3 s |
| `python scripts/paper-collector.py --topic ... --max-papers 5` | WORKS — network, 1.4 s |
| `python scripts/paper-collector.py` (no `--topic`) | BLOCKS on `input()` by design |
| `cd web && npm ci` | not run for real; `npm ci --dry-run` WORKS, lockfile in sync |
| `cd web && npm run typecheck` | WORKS, exit 0 |
| `cd web && npm test` | WORKS — 36/36, 966 ms |
| `cd web && npm run build` | WORKS — 564 ms |
| `cd web && npm run dev` | WORKS — auto-picked 5175 (5173/5174 busy locally) |
| `cd web && npm run preview` | WORKS — serves `dist/` |
| `cd web && npm run lint` | **DOES NOT EXIST** |
| `npm run test:watch` | interactive watcher, not exercised |
| `jupyter nbconvert --execute notebooks/paper-collector.ipynb` | **FAILS** — `input()` → `StdinNotImplementedError`; also needs network |
| `python -m jupyter ...` | **MISLEADING** — resolves to the Homebrew jupyterlab 4.5.4 on python 3.14, not the active venv. Use `<venv>/bin/jupyter-nbconvert`. |

**Pre-existing failures: none.** Every command CI runs passes locally. The only genuine
failures found are (a) the notebook, which is structurally non-executable headlessly and is
not part of CI, and (b) the missing `npm run lint` script, which is an absence rather than a
regression. Everything else is environment friction (ports 5173/5174 occupied by other local
projects; system `jupyter` shadowing the venv).

---

## 7. Findings (ranked, with evidence)

### W1 — No linter for either language, and CI enforces none
There is no lint config anywhere and no lint step in either workflow. Python has zero
static analysis; TypeScript gets only `tsc --noEmit`. `scripts/build_index.py:28` and
`scripts/paper-collector.py:13-16` already carry `# noqa: E402`, implying a flake8/ruff
mental model that was never committed. Cheap win: add a `ruff` config + a `ruff check`
CI step, and an `eslint`/`prettier` config + `npm run lint` on the web side.

### W2 — React components have no test coverage at all
`vite.config.ts` uses `test.include: ["src/**/*.test.ts"]` and `environment: "node"`, so the
36 passing tests only exercise the three pure `src/lib` modules. `App.tsx` and all four
files in `src/components/` are untested, and no DOM environment
(`jsdom`/`happy-dom`) or `@testing-library/react` is installed. The riskiest logic
(recency-window shard fetching in `src/lib/paperIndex.ts`, `localStorage` collections in
`src/lib/collections.ts`) is at least unit-tested; the render layer is not.

### P1 — `requirements.txt` is unpinned across two major versions
`arxiv>=2.1.0` resolved to **4.0.1** and `pandas>=2.0.0` resolved to **3.0.6** on
2026-10-02. The suite passes on both, but `deploy.yml` runs unattended daily-ish and
`paper-collector.py:64-70` reaches into `result.links` / `result.authors`, which is exactly
the kind of surface the `arxiv` 2→4 bump churns. Add upper bounds or a lockfile
(`requirements.lock` / `pip-compile`) so a future `arxiv` release cannot silently break
Pages deploys.

### C1 — `paper-collector.py --save-csv` ignores `--output-dir`
`scripts/paper-collector.py:138` does `df.to_csv(topic + "_papers.csv", index=False)` — a bare
relative path, so the CSV lands in the **current working directory** while the HTML honours
`--output-dir`. Reproduced: with `--output-dir /tmp/recon-results --save-csv`, the HTML went
to `/tmp/recon-results/` and the CSV appeared in the repo root as
`cat:cs.CV AND "3d reconstruction"_papers.csv` (untracked, and **not** covered by
`.gitignore`'s `results/*.csv` rule). Should be
`os.path.join(args.output_dir, ...)`.

### C2 — output filename embeds the raw arXiv query, so a `/` in the topic crashes the CLI
`scripts/paper-collector.py:142` interpolates `topic` straight into the output path.
`safe_filename()` (line 21) is applied only to PDF/tarball names, never to the feed filename.
arXiv query syntax legitimately contains `/` (e.g. `all:/path/` field prefixes, or a phrase
like `"a/b"`), and a topic such as `cat:cs.CV AND (diffusion OR "a/b")` reproduces:
`OSError: [Errno 2] No such file or directory: '.../cat:cs.CV AND (diffusion OR "a/b")-5_papers_extracted_on_....html'`.
Reuse `safe_filename(topic)` for the output name. The readme's own example topic
(`cat:cs.CV AND "3d reconstruction"`) happens to avoid `/`, so it slips through.

### C3 — deploy cron contradicts its own comment and the readme
`.github/workflows/deploy.yml:5-6`:
```yaml
# Rebuild the arXiv index and redeploy every day at 06:00 UTC.
- cron: "0 6 * * 0"
```
`0 6 * * 0` is **weekly, Sunday 06:00 UTC**, not daily. `readme.md:122-123` also says
"on a daily schedule". The comment and readme are both stale — almost certainly left behind
by commit `44e8fdd Update cron schedule in deploy.yml`. Either restore `0 6 * * *` or fix
the comment and readme. Worth deciding deliberately, since the site claims near-real-time
arXiv coverage.

### P4 — `.venv/` and `.pytest_cache/` are not gitignored
Root `.gitignore` omits both, so following the readme's own instructions
(`python3 -m venv .venv`) or running `pytest` dirties `git status`. `.venv/` and
`__pypackages__/`, `.pytest_cache/`, `.ruff_cache/` are the usual additions.

### W4 — `notebooks/paper-collector.ipynb` has drifted from the refactored scripts
The notebook predates `scripts/arxiv_common.py`: it rebuilds its own `arxiv.Client`, its own
DataFrame column list, and its own HTML template inline, and omits the `--download-sources` /
`--max-papers` / `abstract_chars` refinements. It also cannot run headlessly because of a bare
`input()`. Given `CONTRIBUTING.md` requires tests for behaviour changes, the notebook has no
executable test guarding it against silent rot.

### N1 — build order is a silent footgun
`npm run build` only embeds `web/public/data/` if it already exists; otherwise the site
deploys the "no paper index yet" state **and** `/data/index.json` returns
`200 Content-Type: text/html` via the SPA fallback, so naive HTTP health checks look green.
`deploy.yml` orders it correctly, but nothing enforces it locally. A guard in
`vite.config.ts` (warn/fail when `public/data/index.json` is absent for a production build)
would prevent a bad local deploy.

### N2 — `paper-collector.py` HTML output is stylistically broken
`build_html_feed` (`scripts/paper-collector.py:87-122`) emits nested/unbalanced `<font>` tags
(`<b> ... </b> </font>`), a `<title>Mathedemo</title>`, and 400 px left+right margins. It is
tested only for `html.escape` of fields and MathJax-over-HTTPS, so the markup is unverified
and renders poorly on narrow screens. The SPA has since replaced this output path, so the
lowest-value fix is to drop the flag or delegate to the web app.