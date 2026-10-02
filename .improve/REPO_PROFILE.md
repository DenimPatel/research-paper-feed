# REPO PROFILE — research-paper-feed

**Operating manual for implementers and verifiers in the autonomous improvement loop.**
Recon date 2026-10-02. Baseline SHA `1c075b3`. Everything below was read from the repo, not
assumed. Where recon and a spot-check disagreed, the spot-check won and is noted.

---

## 1. Purpose and audience

**Purpose.** `research-paper-feed` is a fully static, client-only arXiv reading feed: a scheduled
Python job queries the arXiv API, dedupes and shards a rolling 60-day window of `cs.CV / cs.LG /
cs.CL / cs.AI / cs.RO` papers into JSON, and a React/TypeScript SPA deployed to GitHub Pages lets a
reader search, filter, sort, and save those papers into browser-local collections. There is no
server, no database, and no runtime arXiv call from the browser.

**Primary audience.**
1. **Implementers** in this loop — they need the commands, the conventions, the traps, and the bug
   inventory below to make a correct change without re-reading the whole repo.
2. **Verifiers** — they need §4 (playbook), §7 (pre-existing failures), §8 (traps), §9 (bug
   inventory) to tell a new regression from known debt.

Secondary audience is the site's human visitors (readers of the live site); they are never the
target of a change unless an item explicitly says so.

---

## 2. Repo type: four co-located deliverables, three lifecycles

This is **not** one project. It is a hybrid with a hard boundary. Production LOC ≈ 3,550
(Python 517 + web 3,035 incl. CSS). Nothing imports across the boundary except
`build_index.py` writing files into `web/public/data/`.

| Part | Path | Status | Notes |
| --- | --- | --- | --- |
| **Scheduled Python ETL** | `scripts/build_index.py` (309), `scripts/arxiv_common.py` (59) | **LIVE — the critical path** | Runs in `deploy.yml` every deploy. Only `collect_papers()` (`:203`) touches the network. Emits `web/public/data/index.json` + `papers-<YYYY>-W<NN>.json`. Well-factored: pure helpers separated from IO specifically for testability. |
| **React/TS/Vite SPA** | `web/` (React 18.3.1, TS 5, Vite 5, Vitest 2) | **LIVE — the primary artifact** | Deployed to `denimpatel.github.io/research-paper-feed/`. 3,035 LOC. `base: "/research-paper-feed/"`. |
| **Legacy standalone CLI** | `scripts/paper-collector.py` (149) | **LEGACY but explicitly supported** | `readme.md:71-72` and `CONTRIBUTING` both keep it alive. Independent of the web app. Its unique value is `--download-pdfs` / `--download-sources` (LaTeX tarball → `./extracted/`), which the web app deliberately excludes. **Currently broken on arxiv 4.x (see §9 PY-1).** |
| **Notebook** | `notebooks/paper-collector.ipynb` (9 cells) | **STALE — a divergent fork** | A pre-`arxiv_common` fork of the CLI. `readme.md:113-118` still advertises it as "the same workflow", which is false. Not in CI. **Treat any behavior as unowned and undocumented.** |

**Repo shape.** Two projects sharing one repo: a root-level Python project and a nested `web/` JS
project with its own `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`, and
`.gitignore`. Tests mirror source 1:1 on both stacks (`tests/test_build_index.py` ↔
`scripts/build_index.py`; `web/src/lib/__tests__/search.test.ts` ↔ `web/src/lib/search.ts`) — this
is deliberate and should be preserved when adding modules.

**Maturity.** Early but actively maintained. 25 commits, real tests on both stacks, strict
TypeScript, conventional commits, gitignored build output, docs that mostly match reality.
No external contributors, no releases, no issue templates.

---

## 3. Verified commands

Every command below was executed. Dir is noted. **All four baseline checks are green.**

### 3.1 Python environment

The repo has **no venv, no `pyproject.toml`, no `setup.cfg`, no lockfile**. `CONTRIBUTING.md:2-4`
documents `pip install -r requirements.txt` and `python -m unittest discover -s tests -v`, and
**that documented command fails on this machine**: there is no `python` on `PATH`, and
`/opt/homebrew/bin/python3` (3.14.3) has neither `arxiv` nor `pandas`. This is a real docs bug
(`DOC-1` in §9), and it is CONTRIBUTING's fault, not the repo's.

**The correct working command on this machine** (uses `/usr/local/bin/python3.11`, the only
interpreter with the deps: `arxiv 2.1.3`, `pandas 2.2.1`, `numpy 1.26.4`):

```shell
# from repo root
/usr/local/bin/python3.11 -m unittest discover -s tests -v
```

**Preferred, portable setup** (what a contributor should be told to do, and what an implementer
should use so the working tree stays clean — note `.venv/` is *not* gitignored, see §6):

```shell
# from repo root
python3 -m venv /tmp/rpf-venv          # keep it OUTSIDE the repo
/tmp/rpf-venv/bin/pip install -r requirements.txt
/tmp/rpf-venv/bin/python -m unittest discover -s tests -v
```

`requirements.txt` is two floors with no upper bounds: `arxiv>=2.1.0`, `pandas>=2.0.0`. A fresh
resolve today yields `arxiv 4.0.1` / `pandas 3.0.6` — which is exactly how PY-1 exists.

### 3.2 Python tests

```shell
# from repo root
/usr/local/bin/python3.11 -m unittest discover -s tests -v     # 27 tests, OK, ~0.01s
```

Baseline: **`Ran 27 tests` / `OK`, exit 0.** Fully offline and hermetic — every test injects a fake
arXiv client; no network, no real clock, no filesystem beyond `tempfile`. Breakdown:
`test_arxiv_common.py` (5), `test_build_index.py` (18), `test_paper_collector.py` (4).

```shell
python -m pytest tests -q        # WORKS — 27 passed, but ONLY after `pip install pytest`
```

`pytest` is **not installed** in the provisioned 3.11 (`No module named pytest`) and is **not a
declared dependency**. It works because it picks up the `unittest.TestCase` classes. Note it
creates `.pytest_cache/` in the repo root, which is **not** gitignored. Do not make `pytest` a
required gate.

Free syntax check (no install):

```shell
/usr/local/bin/python3.11 -m compileall -q scripts tests     # exit 0
```

### 3.3 Web

All from **`web/`**. `node_modules` is present and complete (62 packages, lockfile in sync).

```shell
cd web
npm run typecheck    # tsc --noEmit          -> exit 0, no output
npm test             # vitest run            -> 3 files, 36 tests passed, ~0.4-1.1s
npm run build        # tsc --noEmit && vite build -> 38 modules, ~0.6s
```

Baseline artifact sizes (useful for spotting an accidental bundle regression): JS 163.17 kB
(gzip 52.40), CSS 10.93 kB (gzip 2.86).

Other scripts that exist: `npm run dev` (Vite, auto-increments the port — 5173/5174 are often
taken by unrelated local projects here, so prefer `npm run dev -- --port 5199 --strictPort`),
`npm run preview` (serves `dist/`), `npm run test:watch` (interactive).

**There is no lint for either stack.**
- `npm run lint` **does not exist** — `web/package.json:6-13` has no `lint` script, there is no
  `eslint.config.*`/`.eslintrc*` in `web/`, and `eslint` is not in `node_modules` or
  `devDependencies`. Running `npx eslint` as a gate will not work.
- Python: no `ruff`, `black`, `flake8`, `mypy`, `pylint`, or `isort` is configured or installed
  anywhere; no `pyproject.toml`, `setup.cfg`, `tox.ini`, `.flake8`, `.ruff.toml`, or
  `.pre-commit-config.yaml`. The only static analysis is `tsc --noEmit`.
- The `# noqa: E402` markers at `scripts/build_index.py:28` and `scripts/paper-collector.py:13-16`
  imply an authorial flake8/ruff intent that was never wired up. Don't read them as a config.
- `web/tsconfig.json` is already strict (`strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`, `isolatedModules`, `esModuleInterop`, `skipLibCheck`, `noEmit`) —
  that is why no separate linter is needed. `npm run typecheck` **is** the lint substitute.

### 3.4 Data generation (network required)

`build_index.py` is the only thing that produces the app's data. Output goes to
`web/public/data/`, which is **gitignored** (root `.gitignore:12`, `web/.gitignore:7`) — there is
no committed example of either data format anywhere in the repo.

```shell
# smoke run — small, ~10s wall (almost all of it the hard-coded 10s arXiv delay)
/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 \
    --out-dir /tmp/recon-index
# full production run: 5 categories, 60-day retention, no cap
# -> ~2-5 MINUTES, ~2,800 papers, 2 shards, ~6.8 MB. Do not run casually.
```

Flags: `--out-dir` (default `web/public/data`, **CWD-relative**), `--retention-days` (60),
`--max-per-category` (0 = no cap), `--abstract-chars` (500), `--category` (repeatable;
defaults `cs.CV,cs.LG,cs.CL,cs.AI,cs.RO`).

Smoke-run rules for implementers:
- **Always pass a small `--max-per-category` for verification runs.** Each arXiv page costs
  `delay_seconds=10` (`scripts/arxiv_common.py:16`), so `--max-per-category 20 --category cs.CV`
  is ~10s; the full run is minutes.
- A run that fetches nothing logs `No papers fetched; refusing to write an empty index.` and
  **exits 1** (by design, `build_index.py:289-291`, covered by a test). An exit 1 from a network
  failure is not a regression.
- A run that *partially* fails exits 0 with a silently truncated index — see §8 trap 3.

---

## 4. How to verify a change

Pick the row that matches what you touched. Run **all** rows you qualify for. A change that
touches the wire format needs both stacks.

### 4.1 `web/src/lib/**` (TypeScript logic)

```shell
cd web && npm run typecheck && npm test && npm run build
```

All three are required. `typecheck` is the only lint. `build` matters because it is
`tsc --noEmit && vite build` and **CI never runs it** (§7) — a broken Vite build passes CI today.
If you changed anything that emits or consumes `index.json` or a shard, see §8 trap 1.

### 4.2 `web/src/App.tsx` or `web/src/components/**` (component / UI / CSS)

```shell
cd web && npm run typecheck && npm test && npm run build
# then run the app and look at it
python3 -m venv /tmp/rpf-venv && /tmp/rpf-venv/bin/pip install -r requirements.txt
/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 300
cd web && npm run dev -- --port 5199 --strictPort
```

- The app is served at **`http://localhost:5199/research-paper-feed/`**, not at `/`. Hitting the
  bare origin shows Vite's base-path warning page — that is not a bug.
- Use Playwright at **1280px** (desktop) and **390px** (mobile). These two widths are the project's
  de-facto viewports; there is exactly one CSS breakpoint at 520px.
- **Baseline screenshots are at `.improve/artifacts/baseline/` — 14 files.** Compare against
  them before claiming a visual change is an improvement. The 14 states are:
  `feed-desktop-1280`, `feed-mobile-390`, `feed-savemenu-open-desktop-1280`,
  `feed-savemenu-mobile-390`, `feed-loadmore-desktop-1280`, `feed-focus-ring-desktop-1280`,
  `feed-empty-search-desktop-1280`, `feed-no-categories-selected-desktop-1280`,
  `feed-index-missing-desktop-1280`, `feed-preview-build-desktop-1280`,
  `collections-desktop-1280`, `collections-mobile-390`, `collections-empty-mobile-390`,
  `collections-import-error-desktop-1280`.
- **Put your item's screenshots in `.improve/artifacts/<IMP-ID>/`** (create it). Name them
  descriptively with the viewport and state, e.g. `feed-desktop-1280.png`. Never overwrite the
  baseline files.
- Also capture the browser console. Baseline console output is **clean**: production build emits
  zero messages; dev server emits only the Vite `connecting…`/`connected…` debug lines and the
  React-DevTools info notice. Any `console.error` or a failed network request is a regression.
- Regenerate the index between visual checks if your change affects the data path — `web/public/data/`
  is gitignored, so it may be empty or stale in a fresh checkout, and the app then correctly
  renders the "No paper index yet" state (baseline
  `baseline-feed-index-missing-desktop-1280.png`).
- **There are no component tests and none are possible today**: `vite.config.ts:8-9` sets
  `environment: "node"` and `include: ["src/**/*.test.ts"]` (which does not match `.tsx`), and
  `jsdom` / `@testing-library/react` are not installed. So a component change is verified by eye
  and by typecheck, not by a test. If an item *adds* that infrastructure, it must change
  `vite.config.ts:8-9` and `web/package.json` in the same change.

### 4.3 `scripts/**` (Python)

```shell
/usr/local/bin/python3.11 -m unittest discover -s tests -v
```

- The suite is the only gate. It is offline and fast; keep it that way. **Do not add a test that
  hits the network.**
- If you touched anything arXiv- or network-related, prefer a **network-free test** using the
  existing fake-client pattern (`tests/test_arxiv_common.py:11-18, 49-65` swaps the whole `arxiv`
  module for a `SimpleNamespace`; `tests/test_build_index.py:219` monkeypatches
  `build_index.collect_papers` with a lambda). If a network test is genuinely unavoidable, fall back
  to a tiny smoke run: `python scripts/build_index.py --category cs.CV --max-per-category 20
  --out-dir /tmp/<something>` and check exit 0 + a `index.json` was written.
- Add the mirror test. If you add or change a public helper in `scripts/build_index.py`, add or
  update `tests/test_build_index.py` in the same change — `CONTRIBUTING.md` requires it and the
  1:1 mirror is the repo's convention.
- Note the 1:1 mirror uses `importlib.util.spec_from_file_location` (three duplicated copies of a
  `load_module()` helper) because `scripts/paper-collector.py` has a hyphen and `scripts/` has no
  `__init__.py`. Follow that pattern; don't invent a new one.
- Untested Python functions with the highest risk, if your change is near them: `collect_papers`
  (`build_index.py:203`), `_result_datetime` (`:194`), `iso_date` (`:77`), `parse_args` (`:248`),
  `fetch_papers` (`paper-collector.py:58`), `paper-collector.main` (`:125`).

### 4.4 `notebooks/paper-collector.ipynb`

```shell
jupyter nbconvert --to notebook --execute notebooks/paper-collector.ipynb
```

**This FAILS, by design, and that is the pre-existing baseline.** Cells 0–3 run, then cell 4 dies
with `nbclient.exceptions.CellExecutionError` / `StdinNotImplementedError: raw_input was called, but
this frontend does not support input requests` — the notebook calls `input()` for its topic. Cell
5 also needs live arXiv access. It is not in CI and not in deploy. **Record the failure as
pre-existing; do not claim to have fixed it unless the item is specifically about the notebook.**
Also: `jupyter` on this machine resolves to Homebrew jupyterlab 4.5.4 on python 3.14, not to any
venv — use `<venv>/bin/jupyter-nbconvert` if you must.

### 4.5 CI / docs / workflows

```shell
# read the workflow, then confirm every command it references actually exists
cat -n .github/workflows/ci.yml .github/workflows/deploy.yml
cat web/package.json                 # confirm each `npm run X` in the workflow is a real script
python3 scripts/build_index.py --help
python3 scripts/paper-collector.py --help
```

Rules:
- Any `run:` step in a workflow must reference a command that exists *right now*. A
  `npm run lint` step is a bug, not a gate.
- If you change a flag, a default, or a command, update `readme.md` and `CONTRIBUTING.md` in the
  same change and re-check every documented flag against `--help`.
- `readme.md` is lowercase `readme.md` in this repo. Keep it that way.
- Deploy ordering is load-bearing: `build_index` must run **before** `npm run build`, because Vite
  copies `public/**` into `dist/` at build time. If `data/` is absent, `dist/data/` is absent and
  the deployed site silently serves the error page — and `curl -o /dev/null -w %{http_code}` on
  `/data/index.json` still returns **200** because of the SPA fallback, so a naive HTTP health
  check will not catch it. Verify with `ls web/dist/data`.

### 4.6 Definition of done for any change

1. `cd web && npm run typecheck && npm test && npm run build` — all clean, if you touched web.
2. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` — 27+ tests OK, if you touched Python.
3. Playwright at 1280 and 390, screenshots in `.improve/artifacts/<IMP-ID>/`, console clean, if you
   touched anything visible.
4. Mirror test added or updated alongside any behavior change.
5. No new file in a gitignored location; `git status` shows only intended files.
6. Every line in §9 that your change touches is either fixed (say so explicitly, with the id) or
   consciously left alone.

---

## 5. Conventions to follow

### 5.1 Both stacks

- **Conventional commits**, lowercase, imperative, with a scope only when one exists. Real history:
  `fix: pass max_results to arxiv search so index is not capped at 100`,
  `feat: add interactive arXiv feed on GitHub Pages`,
  `refactor: wrap script logic in functions with a main() guard`,
  `test: add smoke tests for safe_filename and build_html_feed`,
  `ci: add GitHub Actions workflow to run tests`, `docs:`, `chore:`, `fix:`, `feat:`. The two
  non-conforming commits are the two "Initial commit"s.
- **4-space indent in Python. 2-space indent in TS/TSX/CSS.** No tabs anywhere.
- **Double quotes in TS/TSX** (verified: only 6 single-quote occurrences in all of `web/src`, and
  they are inside string literals like search query text, not delimiters). Double quotes in Python
  too. Python docstrings use `"""`.
- **Semicolons at the end of every TS/TSX statement.** No semicolons in Python.
- **Trailing commas in multi-line TS literals/parameter lists** — the prevailing style.
- No inline styles anywhere in `web/src` (verified by grep) — all styling lives in
  `web/src/styles.css`.
- No comments in code unless genuinely needed. The existing code is sparsely commented; docstrings
  explain *why* (e.g. `build_index.py:11-13` explains that pure helpers exist to be testable), not
  *what*.

### 5.2 Python

- Module docstring at the top of each script explaining role and, where relevant, the design
  rationale. Then imports, then `sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))`
  with a comment, then `# noqa: E402` on the sibling import, then module-level constants in
  `UPPER_SNAKE_CASE`, then functions.
- Constants: `DEFAULT_CATEGORIES`, `DEFAULT_RETENTION_DAYS = 60`, `DEFAULT_ABSTRACT_CHARS = 500`,
  `DEFAULT_MAX_AUTHORS = 8`, `DEFAULT_OUT_DIR`, `UNLIMITED = 100000`
  (`scripts/build_index.py:30-38`); `DEFAULT_PAGE_SIZE = 1000`, `DEFAULT_DELAY_SECONDS = 10`,
  `DEFAULT_NUM_RETRIES = 5` (`scripts/arxiv_common.py:14-18`).
- **The `Paper` record is a plain `dict` literal, not a dataclass.** There is no `dataclass`,
  `TypedDict`, or `NamedTuple` anywhere in the repo (verified). The shape lives in one factory,
  `record_from_result()` (`build_index.py:97-114`), which uses `getattr(result, field, default)`
  for every field so a Result-like object degrades instead of raising. **Add new fields there and
  in `web/src/lib/types.ts` — nowhere else.**
- Functions are untyped in Python (no annotations anywhere in `scripts/`), have one-line docstrings,
  and return early rather than nesting. Pure helpers take data in and return data out.
- `main(argv=None) -> int` with `if __name__ == "__main__": sys.exit(main())`
  (`build_index.py:278, 309`). `paper-collector.py:149` currently calls `main()` bare — that is
  bug PY-14, not the convention.
- Network code uses `logging`, not `print`. `print()` is used for user-facing CLI output in
  `paper-collector.py` only.
- Tests: `tests/test_*.py`, `unittest.TestCase` subclasses, methods named
  `test_<behavior>_<expectation>`. Module-level `load_module()` via
  `importlib.util.spec_from_file_location` (3 duplicated copies). Fake clients are
  `types.SimpleNamespace` stand-ins; monkeypatching is restored in `tearDown` or `try/finally`.
  `tempfile` is imported inside the test methods that use it, not at module top.

### 5.3 TypeScript / React

- **The `Paper` wire schema is camelCase and lives in `web/src/lib/types.ts:1-13`:**
  `id, title, authors[], abstract, abstractTruncated, published, updated, categories[],
  primaryCategory, absUrl, pdfUrl`. Same 11 fields, same order, as
  `record_from_result` in Python. `IndexManifest` = `generatedAt, retentionDays, categories[],
  shards[{week, from, to, count, file}], totalPapers` (`:23-29`). `ShardFile` = `week, from, to,
  papers[]` (`:31-36`). `RecencyDays = 7 | 30 | 60` (`:38`), `SortMode = "newest" | "relevance"`
  (`:40`).
- **Named exports only.** No default exports in `web/src/lib/*.ts`. `types.ts` is types-only, no
  runtime code.
- **Component file layout**, matching `PaperCard.tsx`: imports → module constants
  (`ABSTRACT_PREVIEW_CHARS = 260` at `:5`) → a local, non-exported `interface XxxProps` → small
  local helpers (`formatDate` at `:20`) → `export function Xxx({ ... }: XxxProps)` → local
  `useState`/`useMemo` → JSX. **Props interfaces are deliberately NOT exported** (`types.ts` and
  every component) — follow that unless you have a reason.
- Optional props gate behavior: `PaperCard` renders its save menu only when all four
  `collections` / `isSaved` / `onToggleCollection` / `onCreateCollection` props are present
  (`:41-42`). `PaperList` exposes a `renderAction?: (paper) => ReactNode` escape hatch (`:20`) and
  `emptyMessage?: string` (`:22`).
- State: `App.tsx` is the only component with real state. Routing is a hand-rolled
  `location.hash` parser — `readHash()` (`:38`) and `writeHash()` (`:61`) over `URLSearchParams`,
  `#view=collections&q=…&cat=…&recency=30&sort=relevance`, with defaults omitted. Collections state
  is a `useReducer` over a pure reducer in `lib/collections.ts`. Network concerns live in
  `lib/paperIndex.ts`; search in `lib/search.ts`; persistence in `lib/collections.ts`.
- Constants in TS: `PAGE_SIZE = 50` (`App.tsx:24`), `DEFAULT_RECENCY: RecencyDays = 60`
  (`App.tsx:25`), `RECENCY_VALUES = [7,30,60]` (`App.tsx:26`), `LOAD_MORE_STEP = 50`
  (`PaperList.tsx:6`), `RECENCY_OPTIONS = [7,30,60]` (`FeedControls.tsx:16`),
  `ABSTRACT_PREVIEW_CHARS = 260` (`PaperCard.tsx:5`), `TITLE_WEIGHT=5 / AUTHOR_WEIGHT=2 /
  ABSTRACT_WEIGHT=1 / PHRASE_BONUS=2` (`search.ts:13-16`), `COLLECTIONS_KEY = "rpf.collections.v1"`,
  `PAPERS_KEY = "rpf.papers.v1"` (`collections.ts:3-4`).
- CSS: a token layer at `styles.css:1-26`, a dark-mode override at `:28-45` under
  `prefers-color-scheme`, BEM-ish `block__element--modifier` class names, one `@media
  (max-width: 520px)` block at `:720-753`, one `:focus-visible` rule at `:86-90`, zero inline
  styles. **New styling goes in `styles.css`; never add a `style=` prop.**
- Tests: `web/src/lib/__tests__/<module>.test.ts`, mirroring the module 1:1. `describe`/`it`,
  `expect` from vitest. `collections.test.ts` ships reusable `MemoryStorage` (`:32-58`) and
  `THROWING_STORAGE` (`:60-79`) fakes — reuse them, don't write new ones.
- Accessibility patterns already present and to be preserved: skip link, semantic
  `header`/`nav`/`main`/`footer`, `aria-current="page"` on nav, `aria-pressed` on every toggle
  chip, `fieldset`+`legend` for control groups, `.sr-only` labels, `<time dateTime>`, `role="status"`
  for loading/count, `role="alert"` for import/storage errors, `target="_blank" rel="noreferrer"`
  on outbound links, and no icon-only buttons anywhere.

### 5.4 Docs

- `readme.md` (lowercase) is user-facing: live-site link, feature bullets, local dev, `build_index`
  flags, CLI flag table for `paper-collector.py`, deployment notes, and the one-time Pages-source
  caveat as a blockquote.
- `CONTRIBUTING.md` is 25 lines: fork → install → test → PR. Add a PR section if you add a
  required check.
- No `docs/` directory, no site generator, no changelog, no issue templates.

---

## 6. Areas to AVOID / do-not-touch

**Hard do-not-touch:**
- **`.kilo/worktrees/mildly-income/`** — a sibling Agent Manager worktree. Never read, never write,
  never `cd` into it.
- **`.git/hooks/`** — contains an installed `pre-push` guard from the loop. Do not edit or delete.
- **`.git/info/exclude`** — it excludes `.improve/artifacts/`. Do not edit.
- **`LICENSE`** (MIT). Do not edit.
- **`web/package-lock.json`** — do not touch unless a dependency change genuinely requires it, and
  then only via `npm install` (never hand-edited, never regenerated with a different npm major).

**Build output / gitignored — never edit, never commit, never read as source of truth:**
`web/dist/`, `web/node_modules/`, `web/public/data/`, `results/*.html`, `results/*.csv`,
`__pycache__/`, `*.pyc`, `.DS_Store`, `*.ipynb_checkpoints`. Also currently untracked-and-unignored
and created by the code: `.venv/`, `.pytest_cache/`, `extracted/`, `*.pdf`, `*.tar.gz`,
`*_papers.csv` in the repo root. If an item adds `.gitignore` entries, it should add these.

**The legacy CLI is a compatibility surface.** `scripts/paper-collector.py` is documented in
`readme.md:96-104` with an exact flag table. Any change there must keep these flags working with
these names, defaults, and behavior: `--topic`, `--max-papers` (default 1000), `--save-csv`,
`--output-dir` (default `results`), `--download-pdfs`, `--download-sources`. Its
`<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html` output naming and its
"remains supported / independent of the web app" framing are documented behavior. Adding a flag is
fine; renaming, removing, or changing a default is a breaking change requiring a readme update in
the same change.

**No new heavy dependencies without written justification in the improvement item.** The web app
is deliberately minimal — exactly `react` + `react-dom` at runtime, and the lockfile is committed
with both workflows using `npm ci`, so a gratuitous dependency permanently changes the security
surface of a static site. For Python, the repo has no lockfile and no upper bounds, so a new
requirement is a live CI risk. If an item does add one (e.g. `jsdom` +
`@testing-library/react` to make component tests possible, or `ruff`/`mypy`), the item must state
the cost, and must update `web/package.json` **and** `web/package-lock.json` together (or
`requirements.txt` and both workflows' install lines).

**Style discipline.**
- **Do not mass-reformat.** There is no formatter configured, so a reformat produces a diff that
  no tool validates and that a verifier must read line by line. If you touch a file, match the
  surrounding style; don't reindent or requote untouched lines.
- **Do not add comments to source unless genuinely needed.** The codebase is sparsely commented
  and the comments that exist explain rationale.
- Don't rename files, move modules, or restructure directories as a side effect of a feature
  change. In particular, do **not** rename `scripts/paper-collector.py` to `paper_collector.py`
  without a shim — the hyphen is load-bearing for the documented CLI path and the test loader.
- Don't touch `images/feed_example.png` unless the item is specifically about it (it is a stale
  2023 screenshot of the legacy CLI output, 465 KB — a real defect, but its own item).

---

## 7. KNOWN PRE-EXISTING FAILURES AND GAPS

**All four baseline checks are GREEN.** There are zero failing checks. Verifiers must not attribute
any of the following to a new change, and must not claim credit for "fixing" an absence.

| # | Pre-existing state | Evidence | Status |
| --- | --- | --- | --- |
| PE-1 | **`npm audit` reports 5 dev-only vulnerabilities**: 1 critical (`vitest` 2.1.9 — GHSA-5xrq-8626-4rwp Vitest UI arbitrary file read/execute, GHSA-82fw-gwwq-j7x9), 1 high (`vite` 5.4.21 — GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff), 3 moderate (`esbuild <=0.24.2`, `@vitest/mocker`, `vite-node`). All transitive dev-server/test-runner only, **none shipped to the Pages bundle**. | `cd web && npm audit` | baseline |
| PE-2 | **7 outdated npm deps**: `@types/react` 18.3.31→19.3.0, `@types/react-dom` 18.3.7→19.3.0, `@vitejs/plugin-react` 4.7.0→6.1.1, `react` 18.3.1→19.3.0, `react-dom` 18.3.1→19.3.0, `typescript` 5.9.3→7.0.2, `vite` 5.4.21→8.3.2, `vitest` 2.1.9→4.1.11. **Every major bump is a breaking change** — do not batch them. | `cd web && npm outdated` | baseline |
| PE-3 | **CI never runs `npm run build`.** `ci.yml:21-38` runs only `npm ci`, `npm run typecheck`, `npm test`. A broken Vite build (bad `vite.config.ts`, bad `base`, missing asset, CSS pipeline error) passes CI and only fails in `deploy.yml` on `main`. Biggest single CI gap. | `ci.yml:35-38` | real bug, fixable |
| PE-4 | **Deploy cron is weekly while docs claim daily.** `deploy.yml:5-6` comments "every day at 06:00 UTC" but the cron is `0 6 * * 0` = **weekly, Sunday 06:00 UTC**. `readme.md:122-123` also says "on a daily schedule". Introduced by commit `44e8fdd Update cron schedule in deploy.yml`. | `deploy.yml:5-6`, `readme.md:123` | real bug, fixable — but the *current* state is the baseline |
| PE-5 | **`CONTRIBUTING.md` documents a Python command that fails.** `CONTRIBUTING.md:2-4` says `pip install -r requirements.txt` then `python -m unittest discover -s tests -v`. On this machine `python` does not exist and `python3` lacks `arxiv`/`pandas`. Correct command: `/usr/local/bin/python3.11 -m unittest discover -s tests -v` (see §3.1). It also never mentions `web/` at all. | verified by execution | real docs bug |
| PE-6 | **No lint configured for either stack**, and no lint step in either workflow. `npm run lint` does not exist. No ruff/black/flake8/mypy for Python. `tsc --noEmit` is the only static analysis. | `web/package.json:6-13`; no config files exist | baseline absence |
| PE-7 | **`jupyter nbconvert --execute` fails on the notebook** with `StdinNotImplementedError` from a bare `input()` in cell 4, plus live-arXiv dependency in cell 5. Not in CI, not in deploy. | verified | by design / pre-existing |
| PE-8 | **`--download-pdfs` / `--download-sources` crash on arxiv 4.x.** `Result.download_pdf` / `download_source` were removed in arxiv 4; the `except` at `paper-collector.py:80` catches only `(arxiv.ArxivError, OSError, tarfile.TarError)`, so `AttributeError` escapes and aborts the whole run on the first result. Both flags are documented as supported (`readme.md:101-102`). | `paper-collector.py:75,77,80`; live-verified by recon | real bug — see PY-1 |
| PE-9 | **`requirements.txt` is unpinned across two majors.** `arxiv>=2.1.0` resolves to 4.x, `pandas>=2.0.0` to 3.x. No lockfile, no upper bounds, no hashes. This is how PE-8 exists. | `requirements.txt` | real risk |
| PE-10 | **CI has no coverage, no Python matrix (single floating `3.x`), no pip cache, no `permissions:`, no `concurrency:`, no `timeout-minutes:`, no `path:` filters, and actions pinned to mutable tags not SHAs.** | `ci.yml` | baseline |
| PE-11 | **Deploy has no quality gate.** The `build` job runs no tests, no typecheck, no lint — it jumps straight to `build_index.py` then `npm run build`. Cross-workflow `needs:` is impossible, so anything landing on `main` publishes whether or not CI is green. | `deploy.yml:21-54` | baseline |
| PE-12 | **`.venv/` and `.pytest_cache/` are not gitignored**, so following the readme's own instructions dirties `git status`. Same for `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv` in the repo root. | root `.gitignore` | baseline |
| PE-13 | **Zero component/DOM test coverage, and it is structurally impossible today.** `vite.config.ts:8-9` sets `environment: "node"` and `include: ["src/**/*.test.ts"]` (doesn't match `.tsx`); no `jsdom`, no `@testing-library/react`, no `@vitest/coverage-v8`. `App.tsx` (458 lines) and all four components are untested by construction. | verified | baseline |
| PE-14 | **`scripts/paper-collector.py` duplicates the `arxiv` client construction that `scripts/arxiv_common.py` was created to centralize**, and uses a *different* record schema (Title-Cased `Title/Date/Id/Summary/URL/…`) than `build_index.py` (camelCase `id/title/published/abstract/…`). | `paper-collector.py:14, 61-71` | baseline |
| PE-15 | Stale `__pycache__/*.pyc` for cpython-311/312/314 on disk; `.DS_Store` present. All correctly gitignored, untracked, harmless. | `git status` clean | noise only |
| PE-16 | The README hero image `images/feed_example.png` is a **2023 screenshot of the legacy CLI's HTML output**, not the React feed — 465 KB, the heaviest asset in the repo, and it misrepresents the project. | `readme.md:11` | real doc bug |

---

## 8. Repo-specific traps for verifiers

1. **The Python → TypeScript wire contract is hand-mirrored and completely unvalidated.**
   `build_index.record_from_result` (`build_index.py:102-114`) is the only producer of the wire
   format; `web/src/lib/types.ts:1-36` is a hand-maintained copy. There is **no schema generation,
   no JSON Schema, and no runtime validation**: `fetchManifest` does a bare `as IndexManifest` cast
   (`paperIndex.ts:91`) and `loadShard` only checks `Array.isArray(data.papers)` (`:115-119`).
   **Renaming a field in Python fails silently** — `undefined` flows straight into rendering, and a
   missing `abstract` throws inside `PaperCard.tsx:45` with no error boundary, blanking the app.
   No test asserts the contract on either side. A verifier MUST grep both sides by hand for any
   change to a field name or type.

2. **Duplicated constants that must stay in sync, and no test guards them.**
   | Constant | Python | TypeScript |
   | --- | --- | --- |
   | retention 60 | `DEFAULT_RETENTION_DAYS = 60` (`build_index.py:31`) | `DEFAULT_RECENCY = 60` (`App.tsx:25`) |
   | recency `[7,30,60]` | — | `RECENCY_VALUES` (`App.tsx:26`) **and** `RECENCY_OPTIONS` (`FeedControls.tsx:16`) **and** `RecencyDays` union (`types.ts:38`) — written three times |
   | page size 50 | — | `PAGE_SIZE = 50` (`App.tsx:24`) and `LOAD_MORE_STEP = 50` (`PaperList.tsx:6`); the increment uses the first, the button *label* uses the second, so divergence makes the label lie |
   | shard filename | `papers-{week}.json` (`build_index.py:162`) **and** cleanup regex `papers-\d{4}-W\d{2}\.json` (`:228`) — two places in Python | read only from `manifest.shards[].file` (`paperIndex.ts:105`) |

   The UI **never reads `manifest.retentionDays`** even though the pipeline ships it, so lowering
   `--retention-days` silently caps what the hardcoded 60-day option can find. `ShardManifestEntry.week`,
   `.from`, `.count`, `ShardFile.week`, `.from`, and `Paper.updated` are all **written but never
   read** by any UI code.

3. **A partially-failed index deploys silently with exit 0.** `arxiv_common.iter_results` swallows
   `arxiv.ArxivError` (`arxiv_common.py:58-59`), so `collect_papers` cannot distinguish "category
   had 0 recent papers" from "the network died mid-pagination" — both log the same cheerful
   `  %d papers within retention window for %s` line, `manifest["categories"]` still lists all five
   requested categories, `generatedAt` is stamped fresh, and the deploy succeeds. Only a *completely*
   empty result set fails (exit 1). **A green deploy is not evidence the index is complete.**

4. **Abstract truncation happens twice, in two languages.** `build_index` caps at 500 chars +
   `…` and sets `abstractTruncated` (`build_index.py:48-53`); `PaperCard` then clamps that
   *already-capped* string at `ABSTRACT_PREVIEW_CHARS = 260` (`PaperCard.tsx:5, 44-49`). So
   "Show more" can never reveal more than ~500 chars. There is **no full abstract anywhere in the
   app** — it lives only on arXiv. Changing one budget without the other silently changes the UI.

5. **`safe_filename` is weak, and it is not a sanitizer.** `paper-collector.py:21-23` replaces
   `\ / : " * ? < > |` but **not `.`**, so `safe_filename("..") == ".."` and
   `safe_filename("../../etc") == ".._.._etc"`. The slug is then used as a **directory name** at
   `:79` (`extractall(f"./extracted/{title_slug}")`). No length cap (a 400-char title exceeds the
   255-byte filename limit), no reserved-name handling. Separately, the raw `--topic` is
   interpolated into the CSV and HTML output paths at `:138` and `:142` with **no sanitization at
   all**, so `--topic '../../escape'` writes outside `results/` and `--topic 'cat:cs.CV AND (a/b)'`
   raises `FileNotFoundError`.

6. **`scripts/paper-collector.py` and `notebooks/paper-collector.ipynb` are divergent forks of the
   same logic.** The notebook rebuilds its own `arxiv.Client`, its own DataFrame column list, and
   its own HTML template inline instead of importing `scripts/arxiv_common.py`. It has drifted in
   every way that matters: it calls `arxiv.Search()` **without `max_results`** so it silently caps
   at 100 (the exact bug commit `352e104` fixed in the shared client), it has **no `html.escape`**
   (a live XSS in generated output), it loads MathJax over plain `http://`, it uses raw
   `result.title` as a filename, and it never creates the `results/` dir it hardcodes. **A fix to
   one is not a fix to the other.** If an item touches the CLI, decide explicitly whether the
   notebook is in scope and say so in the item notes.

7. **Build order is a silent footgun, and the health check lies.** `npm run build` only embeds
   `web/public/data/` if it already exists. Build with an empty `data/` → `dist/data` is absent →
   the deployed site serves "No paper index yet" **and** `GET /data/index.json` returns
   `200 Content-Type: text/html` via the SPA fallback, so `curl -w %{http_code}` reports green.
   `deploy.yml` orders it correctly (index at `:34`, build at `:48`); nothing enforces it locally.
   Verify with `ls web/dist/data`, not with curl.

8. **The retention `break` in `collect_papers` is load-bearing on the sort order and is undocumented
   at the call site.** `build_index.py:217` breaks out of a category as soon as one result is older
   than the cutoff, which is only correct because `arxiv_common` sorts by `SubmittedDate /
   Descending` (`arxiv_common.py:47-48`). Change the sort and the break silently truncates every
   category to zero papers. Also, records whose `published` is not a `datetime` bypass the
   `is not None` guard and land in the index — a string `"2001-01-01"` produced
   `papers-2001-W01.json` during recon.

9. **`dedupe_records` mutates its caller's input** (`build_index.py:127`): the merge is a *shallow*
   `dict(record)`, so `existing["categories"]` is the same list object as the input record's, and
   the union loop appends into it. Idempotent in the one place it's used today, and the existing
   test only asserts on the *output*, so a regression is invisible. Same class of issue in
   `collections.ts:164-167` where `addPaper` returns a new state identity even when nothing changed.

10. **Zero request timeouts on either stack.** `arxiv.Client` in 4.x calls `requests.Session.get()`
    with **no `timeout=`**, and `build_client` (`arxiv_common.py:20-26`) has no hook to add one — a
    half-open TCP connection hangs the deploy job to the 6-hour Actions cap with no diagnostic. In
    `web/src`, grep finds **zero** occurrences of `AbortController`, `signal`, or `timeout`: a hung
    shard fetch leaves the app stuck on "Loading papers from N weeks…" forever, and `App.tsx`'s
    `cancelled` flag only discards results, it does not abort the in-flight requests.

11. **A rejected manifest promise is memoized forever.** `paperIndex.ts:62, 67-70` assigns
    `this.manifestPromise = this.fetchManifest()` and only ever checks `if (!this.manifestPromise)`.
    On rejection the rejected promise stays memoized, so every later `loadPapers` re-rejects, the
    manifest effect runs once (`App.tsx:148-166`, `[]` deps), and there is **no retry button
    anywhere**. The only recovery is a full page reload.

12. **Search re-ranks the entire corpus on every keystroke, with no memoization anywhere.**
    `scorePaper` builds three fresh `toLowerCase()` copies plus a combined template string for
    every paper, every keystroke (`search.ts:55-58`), and `visiblePapers` is memoized on `[papers,
    activeCategories, query, sort]` — i.e. it recomputes exactly when the query changes
    (`App.tsx:207-224`). `PaperCard`/`PaperList` are not `React.memo`, `isSaved` is re-created each
    render and is a nested `Array.includes` scan (`App.tsx:261-266`). `writeHash` calls
    `history.replaceState` per keystroke (`App.tsx:241-243`), which Safari throttles after ~100
    calls / 10 s. **A perf item that adds memoization is easy; a perf item that changes the
    ranking tie-break or the token regex changes user-visible result order and must be
    screenshot-verified.**

13. **Filter changes destroy the list and the scroll position.** `App.tsx:173-175` flips `loading`
    to `true` and `:414-420` swaps `PaperList` for a `<p>`, so every card's local `expanded` state
    and any open save-menu `<details>` are destroyed even when the shards are already cached.
    `setView` (`:237`) does not reset `window.scrollTo`, so switching Feed ↔ Collections keeps the
    old offset and can hide the toolbar under the 64px sticky header.

14. **`loadPapers` failure is reported to the user as absent data.** When the manifest succeeded but
    the papers did not, `App.tsx:364` skips the error panel, `:408-412` shows a bare warning with
    the raw `Error.message` (e.g. `Failed to load papers-2024-W14.json (HTTP 404)`), and
    `PaperList` renders with `papers === []` → the user reads "No papers are available in this
    window yet." Also, `Promise.all` at `paperIndex.ts:150` means **one bad shard discards all the
    shards that did load**.

15. **The "no index yet" panel shows developer instructions to production visitors**, twice:
    `App.tsx:366-374` tells any visitor of the live site to "Build the index locally: `python
    scripts/build_index.py`", and `INDEX_HELP` (`paperIndex.ts:26-28`) says the same, with a
    meaningless `(HTTP 200)` suffix appended.

16. **Relevance sort degrades to date sort while the chip stays lit.** `visiblePapers`
    short-circuits on an empty query (`App.tsx:215-218`), returning the newest-first list, while
    `FeedControls` renders the Relevance chip as `chip--active` / `aria-pressed="true"` whenever
    `sort === "relevance"` (`:92`) and merely *disables* it when the query is empty (`:94`).
    `readHash` accepts `sort=relevance` with no `q` (`App.tsx:57`). Same class: hash-supplied
    `#cat=` values are never intersected with `manifest.categories` (`App.tsx:47-55`), so a typo
    or a stale shared URL produces an invisible, unremovable filter and an empty feed with no
    explanation.

17. **Path defaults are CWD-relative.** `DEFAULT_OUT_DIR = "web/public/data"`
    (`build_index.py:34`) and `--output-dir` default `results` (`paper-collector.py:40`). Running
    from anywhere but the repo root writes to a stray directory nothing deploys. Same class as the
    CSV landing in CWD (`paper-collector.py:138`).

18. **Encoding is inconsistent between the two writers.** `build_index.py:240,243` passes
    `encoding="utf-8"` with `ensure_ascii=False`; `paper-collector.py:143` calls
    `open(filename, "w")` with no `encoding`, which raises `UnicodeEncodeError` on a non-UTF-8
    locale (macOS hides this via PEP 538 coercion; containers do not).

---

## 9. Known bug inventory

Every concrete defect recon found, with a stable id. **Verifiers use this to tell a new regression
from known debt: if a change's failure maps to a row here, it is not new — unless the change was
supposed to fix that row, in which case the row must be updated in this file.**

### Web — data loading (`web/src/lib/paperIndex.ts`, `web/src/App.tsx`)

| ID | Defect | Location |
| --- | --- | --- |
| WEB-01 | Rejected manifest promise memoized forever; no retry possible, only a page reload | `paperIndex.ts:62, 66-71`; no retry UI in `App.tsx:364-376` |
| WEB-02 | One bad shard rejects the whole `Promise.all`, discarding shards that loaded | `paperIndex.ts:150-157` |
| WEB-03 | Paper-load failure surfaces as "no papers available" instead of an error | `App.tsx:408-433` |
| WEB-04 | Raw technical `Error.message` shown to users, no retry affordance | `App.tsx:409-411`; `paperIndex.ts:107,121` |
| WEB-05 | Developer build instructions shown to production visitors, duplicated | `App.tsx:366-374`; `paperIndex.ts:26-28` |
| WEB-06 | `progress` never reset on a new load; shows stale window totals; `0/0` flash when `latestIndexDate` is null | `App.tsx:145, 173`; `paperIndex.ts:140-148` |
| WEB-07 | Shard data validated only by cast; a missing `abstract` throws inside render; no error boundary → white page | `paperIndex.ts:111-114`; `PaperCard.tsx:45`; `main.tsx:12-15` |
| WEB-08 | No `AbortController`/timeout on any fetch; `cancelled` flag discards but does not abort; `StrictMode` double-invokes the first load | `App.tsx:149,194`; `paperIndex.ts:77,105` |
| WEB-09 | Recency change unmounts the whole list, losing scroll, card `expanded` state, and open save menus | `App.tsx:173-175, 414-420` |
| WEB-10 | `manifest.retentionDays` written by Python, read by nothing; `[7,30,60]` hardcoded three times | `types.ts:25`; `App.tsx:26`; `FeedControls.tsx:16` |
| WEB-11 | `ShardManifestEntry.week`/`.from`/`.count`, `ShardFile.week`/`.from`, `Paper.updated` all written but never read | `types.ts:8, 18-20, 32-35` |
| WEB-12 | No shard-cache/manifest TTL; `loadShard` uses default HTTP caching while `fetchManifest` forces `no-cache` | `paperIndex.ts:62-64, 77, 125` |
| WEB-13 | `pdfUrl` is `string` in TS but `str \| None` in arxiv 4.x, so `null` can reach the wire | `types.ts:12`; `build_index.py:113` |

### Web — search, filter, sort

| ID | Defect | Location |
| --- | --- | --- |
| WEB-14 | Relevance sort silently becomes date sort while the chip stays `aria-pressed`; `readHash` accepts `sort=relevance` with no `q` | `App.tsx:57, 215-218`; `FeedControls.tsx:92-94` |
| WEB-15 | Hash `#cat=` values never validated against the manifest; unknown categories become invisible, unremovable filters | `App.tsx:47-55, 198-201`; `FeedControls.tsx:50` |
| WEB-16 | "All categories" is not representable; no way back once an explicit selection is made; `writeHash` permanently emits `cat=` | `App.tsx:199, 253-259, 69-71` |
| WEB-17 | Deselecting every category silently empties the feed with no reset path and no "no categories selected" state | `App.tsx:208`; `FeedControls.tsx` |
| WEB-18 | Substring matching with no word boundaries or stemming; `net` matches "network"; author-tier weights can be mis-assigned | `search.ts:62, 68-74` |
| WEB-19 | Multi-word author search can't span a name boundary (authors joined with a single space) | `search.ts:56` |

### Web — collections / localStorage

| ID | Defect | Location |
| --- | --- | --- |
| WEB-20 | **High: `javascript:` URL injection via imported export.** `isPaper` validates only `id`/`title`/`authors`/`abstract` — not `absUrl`/`pdfUrl`/`published`/`categories` — and `PaperCard` renders them as `href` | `collections.ts:51-62`; `PaperCard.tsx:57, 91, 100, 103` |
| WEB-21 | Import gives zero feedback on success; a duplicate id silently no-ops (papers merged, collection dropped) | `App.tsx:308-310`; `CollectionsView.tsx:163, 228-232`; `collections.ts:105-107` |
| WEB-22 | `mergeImport` adds papers before the collision check and never prunes → permanent orphan snapshots re-saved to localStorage forever | `collections.ts:98-107` vs `prunePapers` at `:78,150,170` |
| WEB-23 | `saveState`'s `false` return is discarded → quota errors are completely silent | `App.tsx:231-235`; `collections.ts:279-292` |
| WEB-24 | The two storage keys are written non-atomically; a quota failure on the second write leaves collections pointing at missing snapshots → the collection reappears **empty** on reload | `collections.ts:287-288`; `loadState:268` |
| WEB-25 | Every dispatch re-serializes the entire state synchronously on the main thread; no debounce | `App.tsx:231-235`; `collections.ts:279-292` |
| WEB-26 | `addPaper` returns a new state identity even when it changes nothing; never validates `collectionId`; never prunes | `collections.ts:164-167` |
| WEB-27 | `EMPTY_STATE` is a shared mutable module singleton returned on every failure path; masked by `toEqual(EMPTY_STATE)` in tests | `collections.ts:33, 245, 274`; `collections.test.ts:286-290` |
| WEB-28 | Dead code: `name: payload.collection.name` overrides the identical spread value; `version` ignored on import (hardcoded to 1 without checking) | `collections.ts:121, 219` |
| WEB-29 | No size bound on the import file; a multi-GB file hangs the tab | `CollectionsView.tsx:171` |
| WEB-30 | `URL.revokeObjectURL` called synchronously after `click()` — Firefox can cancel the download; the `<a>` leaks on a throw | `App.tsx:303-305` |
| WEB-31 | No import/export success feedback, no toast region, no undo for delete (native `window.confirm` only) | `CollectionsView.tsx:111-118`; `App.tsx` |
| WEB-32 | Rename form has no focus restoration; cancel/save leaves focus on `<body>` | `CollectionsView.tsx:64` |

### Web — URL state, performance, a11y, styling, SEO

| ID | Defect | Location |
| --- | --- | --- |
| WEB-33 | Bare `#` is always written, so the default view's canonical URL is `…/#` | `App.tsx:79` |
| WEB-34 | History semantics inconsistent: `setView` pushes, all filter changes replace → Back can't undo a filter change | `App.tsx:238, 242, 247, 251, 258` |
| WEB-35 | Collections are not deep-linkable (`#collection=<id>`) and the view fully unmounts on tab switch, discarding rename drafts / import state | `App.tsx:347`; `CollectionsView.tsx` |
| WEB-36 | No per-paper deep link (`#paper=<id>`) | `App.tsx:38-85`; `PaperCard.tsx` |
| WEB-37 | `readHash`/`writeHash` — the highest-value pure functions in the app — are **not exported**, so the round-trip invariant is untestable | `App.tsx:38, 61` |
| WEB-38 | No memoization anywhere; every visible card re-renders per keystroke | `PaperCard.tsx:32`; `PaperList.tsx:24`; `App.tsx:261-266` |
| WEB-39 | `isSaved` is near-quadratic (papers × collections × ids) per render | `App.tsx:261-266`; `PaperCard.tsx:117` |
| WEB-40 | `scorePaper` re-lowercases the whole corpus per keystroke; no precomputed haystack, no debounce, no `useDeferredValue` | `search.ts:55-58`; `App.tsx:207-224` |
| WEB-41 | `history.replaceState` fires per keystroke; Safari throttles past ~100 calls / 10 s | `App.tsx:241-243` |
| WEB-42 | No virtualization; unbounded "Load more"; no `content-visibility: auto` on `.paper` | `PaperList.tsx:39`; `App.tsx:146, 424`; `styles.css:297` |
| WEB-43 | Collections view has no cap at all — renders every saved paper, inconsistent with the feed's paging | `CollectionsView.tsx:131-147` |
| WEB-44 | `CollectionSection` un-memoized and receives the whole state | `CollectionsView.tsx:30-37, 240-250` |
| WEB-45 | Unused dead API: `PaperList.renderAction` is never passed by anything | `PaperList.tsx:20, 52` |
| WEB-46 | Save dropdown is clipped by the viewport bottom (always opens down, no flip, no collision handling) | `PaperCard.tsx:111-167`; `.save-menu-panel` |
| WEB-47 | Scroll position not reset on view switch; toolbar hides under the 64px sticky header | `App.tsx:237` |
| WEB-48 | Loading state lies: "0 papers match" renders next to "Loading papers from N weeks…" | `App.tsx:405, 415-419`; `FeedControls.tsx:108-110` |
| WEB-49 | Number formatting inconsistent (`2,812` vs `2812`) and no pluralization (`1 paper match`) | `App.tsx:389`; `FeedControls.tsx:109` |
| WEB-50 | **A11y: search input focus ring removed** — `outline: none` on `:focus` matches keyboard focus and overrides the global `:focus-visible` rule; only a sub-3:1 1px border tint remains | `styles.css:218-221` vs `:86-90` |
| WEB-51 | **A11y: file-import input is a 1×1px `opacity: 0` box** — focusable, but the focus ring lands on an invisible element | `styles.css:638-644`; `CollectionsView.tsx:215-225` |
| WEB-52 | **A11y: contrast failures in light mode** — `--text-muted` on `--surface` 4.32:1, on `--surface-muted` 3.79:1, on `--bg` 4.11:1 (need 4.5). Dark mode passes. Separately `--border` on `--surface` is 1.27:1, below the 3:1 requirement for input boundaries | `styles.css:9, 7, 214` |
| WEB-53 | **A11y: no list semantics** — `<div class="paper-list">` wrapping `<article>`; no `role="list"`/`<ul>` | `PaperList.tsx:43`; `CollectionsView.tsx:131` |
| WEB-54 | **A11y: broken heading hierarchy** — feed goes `<h1>`→`<h3>` (skips `<h2>`); the collections view has **no `<h1>` at all** | `App.tsx:387`; `PaperCard.tsx:56`; `CollectionsView.tsx:81` |
| WEB-55 | **A11y: skip-link target not focusable** — `<main id="main">` has no `tabIndex={-1}` | `App.tsx:316, 346` |
| WEB-56 | **A11y: result count is a live region firing on every keystroke**; `aria-live` also duplicates `role="status"` | `FeedControls.tsx:108-110` |
| WEB-57 | "Show more" has no `aria-expanded`/`aria-controls` | `PaperCard.tsx:80-87` |
| WEB-58 | Save disclosure has no Escape/outside-click close, no focus management, no `role="menu"`/`aria-label`; multiple menus can be open at once | `PaperCard.tsx:111-167` |
| WEB-59 | **Reduced-motion block is dead code** — it only sets `scroll-behavior: auto`, and nothing in the stylesheet ever sets `scroll-behavior`; every transition/transform keeps running | `styles.css:755-759` |
| WEB-60 | No `forced-colors` support; the design leans on `box-shadow`, `backdrop-filter`, `color-mix`, all of which collapse in HCM | `styles.css:19, 117-118, 201, 302, 309` |
| WEB-61 | Empty-state `<p>` elements have no `role="status"`, so loading→empty is unannounced; collection count is embedded in a button label | `PaperList.tsx:36`; `CollectionsView.tsx:127,235`; `App.tsx:340` |
| WEB-62 | Tap targets below 44px at 390px: `Show more` 74×22, `arXiv` 34×22, `PDF` 26×22, "view the full text on arXiv" 156×16, save-menu checkbox 13×13 | `PaperCard.tsx`; `styles.css` |
| WEB-63 | Search placeholder visually truncated at 390px; the visible label is `sr-only` | `FeedControls.tsx:33-35` |
| WEB-64 | Empty create-collection input submits silently (no validation, no `required`); input is not cleared after submit | `CollectionsView.tsx:198-201`; `PaperCard.tsx:150-153` |
| WEB-65 | Styling: no spacing scale (~30 hardcoded `rem` values), inconsistent vertical rhythm between feed and collections lists | `styles.css:118,124,176,205,294,301,387,613,696,687,741` |
| WEB-66 | Primary button contrast coupled to `--bg` token; any `--bg` tweak silently inverts it | `styles.css:433-434` |
| WEB-67 | Elevation semantics invert between themes (`--surface-muted` darker than `--surface` in light, lighter in dark) | `styles.css:6, 31` |
| WEB-68 | No `@media print`; no manual theme toggle (only `prefers-color-scheme` despite `color-scheme: light dark` being declared) | `styles.css:2, 28-45` |
| WEB-69 | Only one breakpoint (520px); no intermediate layout between 520px and `--max-width: 1000px`; controls row is ragged | `styles.css:20, 720-753` |
| WEB-70 | `backdrop-filter` without `-webkit-` prefix | `styles.css:118` |
| WEB-71 | Hero "index generated" date is plain locale text with no machine-readable value, while cards use `<time dateTime>` | `App.tsx:106-116, 391`; `PaperCard.tsx:62` |
| WEB-72 | Third-party render-blocking Google Fonts with no local fallback | `index.html:11-16` |
| WEB-73 | No Open Graph / Twitter card tags, no canonical URL, no `theme-color`, no `robots.txt`, no `404.html`, no `<noscript>`; empty `<div id="root">` before hydration | `index.html:3-20` |
| WEB-74 | No citation copy at all (no BibTeX/APA/MLA, no copy-link) — the most obvious missing feature for a research feed | `PaperCard.tsx:99-106` |

### Python — `scripts/build_index.py` and `scripts/arxiv_common.py` (the live pipeline)

| ID | Defect | Location |
| --- | --- | --- |
| PY-1 | `dedupe_records` shallow-copies then mutates the caller's `categories` list | `build_index.py:127` |
| PY-2 | Legacy arXiv ID prefixes dropped → dedup collisions (`hep-th/9901001` and `math/9901001` both become `9901001`) | `build_index.py:69-74` |
| PY-3 | `format_authors`' `str(author)` fallback can emit `<module.X object at 0x7f…>` (a memory address) into `paper.authors`, breaking byte-reproducibility | `build_index.py:60` |
| PY-4 | Retention is only an ordered `break`; a non-`datetime` `published` bypasses it and produces e.g. `papers-2001-W01.json` in a 60-day index | `build_index.py:216-217` |
| PY-5 | Retention count over-reports (incremented for records `build_shards:149` later discards) | `build_index.py:219` |
| PY-6 | A failed category logs a normal count; `iter_results` swallows `ArxivError`, so a partial outage publishes a truncated index with a fresh `generatedAt` and exit 0 | `arxiv_common.py:58-59`; `build_index.py:186-187, 203-221` |
| PY-7 | Non-atomic writes — a crash mid-`json.dump` leaves a truncated `index.json`/shard on the static host (the symptom is defended against in `paperIndex.ts:96-101`; the cause is not prevented) | `build_index.py:237-244` |
| PY-8 | `_clean_old_shards` deletes first, writes second — a failure between them leaves `index.json` referencing deleted shards → 404s | `build_index.py:224-232` |
| PY-9 | No error handling around `write_index`; an unwritable `--out-dir` propagates a raw `OSError` traceback instead of `logging.error` + `return 1` | `build_index.py:298` |
| PY-10 | Zero CLI argument validation: `--retention-days -1/0`, `--abstract-chars -3` (silently disables truncation), `--max-per-category -9` (means unlimited), any `--out-dir` | `build_index.py:248-275` |
| PY-11 | `DEFAULT_OUT_DIR` is CWD-relative, so running outside the repo root writes a stray `web/public/data` nothing deploys | `build_index.py:34` |
| PY-12 | No HTTP timeout anywhere — `arxiv` 4.x issues `session.get()` with no `timeout=`; a hung connection stalls the deploy to the 6h Actions cap | `arxiv_common.py:20-26` |
| PY-13 | `DEFAULT_DELAY_SECONDS = 10` is 3× arXiv's stated ToU minimum of 3s, unconfigurable, with no per-category backoff | `arxiv_common.py:16` |
| PY-14 | `logging.basicConfig` at **import** time in three modules, with three different formats; a library module reconfigures the root logger process-wide | `arxiv_common.py:13`; `paper-collector.py:18`; `build_index.py:40` |
| PY-15 | `iso_date` docstring claims "normalized to UTC" but the naive-datetime branch does not convert | `build_index.py:77-87` |
| PY-16 | Dead `yielded` counter that duplicates `arxiv`'s own `islice` limit — untestable by design | `arxiv_common.py:51, 55-57` |
| PY-17 | `UNLIMITED = 100000` exceeds arXiv's 30,000-result `start` ceiling; if the retention break ever stopped working, `iter_results` would silently truncate | `build_index.py:38`; `arxiv_common.py` |
| PY-18 | `--category` is unvalidated — a malformed category produces a query arXiv answers with an empty feed, indistinguishable from "no new papers" | `build_index.py:248-275` |
| PY-19 | `collect_papers` has a hard-coded, un-injectable clock (`datetime.now(timezone.utc)`, no parameter) while `build_shards` accepts `generated_at` — and therefore has zero test coverage | `build_index.py:203-221` |
| PY-20 | `sys.path.insert(0, ...)` at import time in every script mutates global import state; no `scripts/__init__.py`; three duplicated `load_module()` helpers in tests | `build_index.py:26`; `paper-collector.py:11`; `tests/*.py` |
| PY-21 | Tests substitute a `FakeArxivError` rather than asserting against the real `arxiv.ArxivError` hierarchy, so an upstream exception-hierarchy change is invisible to CI | `tests/test_arxiv_common.py:21-24` |
| PY-22 | `MainTests` stubs `collect_papers` with `lambda *args, **kwargs` and never asserts the arguments, so a wrong `retention_days`/`abstract_chars` pass-through is invisible | `tests/test_build_index.py:215-249` |
| PY-23 | No test asserts determinism (byte-identical output over fixed records), despite determinism being an explicit design goal | `tests/test_build_index.py:115`; `build_index.py:157-160` |
| PY-24 | No Python→TS contract test; a field rename only surfaces in the browser | `web/src/lib/types.ts`; `build_index.py:102-114` |
| PY-25 | No `KeyboardInterrupt` handler; Ctrl-C mid-fetch discards the entire DataFrame and can leave a half-written index | `paper-collector.py:125-145`; `build_index.py:237-245` |

### Python — legacy CLI `scripts/paper-collector.py` and the notebook

| ID | Defect | Location |
| --- | --- | --- |
| PY-26 | **Broken documented feature: `--download-pdfs` / `--download-sources` raise `AttributeError` on arxiv 4.x** (`Result.download_pdf`/`download_source` removed); the handler catches only `(arxiv.ArxivError, OSError, tarfile.TarError)`, so the error escapes and aborts the whole run on the first result | `paper-collector.py:75, 77, 80`; `readme.md:101-102` |
| PY-27 | `safe_filename` is not a sanitizer: doesn't replace `.`, so `safe_filename("..") == ".."`; the slug is used as a **directory name** for `extractall`. No length cap, no reserved-name handling | `paper-collector.py:21-23, 79` |
| PY-28 | Path traversal: the raw `--topic` is interpolated into both output paths with no sanitization — `--topic '../../escape'` writes outside `results/`; a `/` in the topic raises `FileNotFoundError`; the readme's own example topic produces a filename with `:` and `"` (illegal on Windows) | `paper-collector.py:138, 142`; `readme.md:83` |
| PY-29 | `--save-csv` ignores `--output-dir` — the CSV lands in CWD, where the `results/*.csv` ignore rule does not cover it | `paper-collector.py:138` |
| PY-30 | `tarfile.extractall` with no `filter=` (CVE-2007-4559 class); the safe default only landed in Python 3.14 and CI uses an unpinned `3.x` | `paper-collector.py:79`; `ci.yml:15` |
| PY-31 | Downloads and extractions land in CWD, not `--output-dir`; the `.tar.gz` is never deleted after extraction, so `--download-sources` accumulates multi-MB archives | `paper-collector.py:74-79` |
| PY-32 | `exit` code is always 0 — `main()`'s return value is discarded (unlike `build_index.py:309`'s `sys.exit(main())`) | `paper-collector.py:149` |
| PY-33 | `pdf_url` may be `None` (arxiv 4.x declares `str \| None`) → `html.escape(None)` raises `AttributeError` in `build_html_feed` | `paper-collector.py:111` |
| PY-34 | Generated HTML is malformed: `<body>` is never opened but `</body>` is closed, `<b>…</b> </font>` nesting is wrong, `<title>Mathedemo</title>` is a placeholder, 400px left+right margins | `paper-collector.py:88-122` |
| PY-35 | `--max-papers <= 0` silently produces a 564-byte zero-paper HTML feed and prints a success message | `paper-collector.py:36, 127`; `arxiv_common.py:37-38` |
| PY-36 | `open(..., "w")` with no `encoding=` → `UnicodeEncodeError` under a non-UTF-8 locale; disagrees with `build_index.py:240,243` | `paper-collector.py:143` |
| PY-37 | pandas chained indexing `df["Col"][i]` in a loop — the documented anti-pattern, deprecated in pandas 3; the DataFrame is unnecessary for this use | `paper-collector.py:108-118` |
| PY-38 | `Id`, `Authors`, `Primary_category`, `Categories`, `Links` collected and CSV-exported but never rendered | `paper-collector.py:64, 66-70` |
| PY-39 | `except` at `:80` conflates download failure with source-extraction failure (a PDF failure silently skips sources for that paper) | `paper-collector.py:80-82` |
| NB-1 | Notebook: `arxiv.Search()` omits `max_results` → silently caps at 100, making `MAX_PAPERS_TO_PULL = 1000` unreachable (the exact bug commit `352e104` fixed in the shared client) | notebook cell 5 |
| NB-2 | Notebook: **no `html.escape`** on title/summary → live XSS in generated output (the script fixed this; the notebook did not) | notebook cell 7 |
| NB-3 | Notebook: MathJax CDN over plain `http://` (mixed-content blocked on HTTPS); the script uses `https://` and a test asserts it | notebook cell 7 |
| NB-4 | Notebook: calls `download_pdf`/`download_source` with **no `try` at all** → kills the kernel on arxiv ≥4; uses raw `result.title` as a filename; never closes the tarfile on the error path | notebook cell 5 |
| NB-5 | Notebook: hardcodes `'results/'` and never creates it → `FileNotFoundError` if absent; empty `pd.DataFrame(all_data, columns=...)` has no columns → `df["Title"]` raises `KeyError` | notebook cell 7 |
| NB-6 | Notebook: `import numpy as np` never used; `numpy` is not a declared dependency | notebook cell 4 |

### CI / docs / repo hygiene

| ID | Defect | Location |
| --- | --- | --- |
| INF-01 | CI never runs `npm run build` — a broken Vite build only fails on `main` in `deploy.yml` | `ci.yml:21-38` |
| INF-02 | Deploy cron is `0 6 * * 0` (weekly, Sunday) while its own comment and the readme both say daily | `deploy.yml:5-6`; `readme.md:122-123` |
| INF-03 | `CONTRIBUTING.md`'s documented Python command fails on macOS and it never mentions the `web/` app, its tests, or its build | `CONTRIBUTING.md:2-4` |
| INF-04 | No lint configured for either stack; no lint step in either workflow; `npm run lint` does not exist | `web/package.json:6-13` |
| INF-05 | No `pyproject.toml` at all, so no `[tool.ruff]`/`[tool.pytest]`/coverage config can live anywhere | repo root |
| INF-06 | `requirements.txt` has no upper bounds, no lockfile, no hashes; resolves across two majors today | `requirements.txt:1-2` |
| INF-07 | `pandas` is installed on every deploy but is only needed by `paper-collector.py`; `build_index.py` never imports it | `deploy.yml:31`; `paper-collector.py:14` |
| INF-08 | Component tests are structurally impossible: `environment: "node"` + `include: ["src/**/*.test.ts"]` (no `.tsx` match), no `jsdom`, no `@testing-library/react`, no coverage tooling | `vite.config.ts:8-9`; `web/package.json:18-25` |
| INF-09 | CI has no coverage, no Python matrix, no pip cache, no `permissions:`, no `concurrency:`, no `timeout-minutes:`, no `path:` filters; actions pinned to mutable tags, not SHAs | `ci.yml` |
| INF-10 | Deploy has no quality gate — it publishes to Pages whether or not CI is green | `deploy.yml:21-54` |
| INF-11 | `.gitignore` misses `.venv/`, `venv/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.coverage`, `htmlcov/`, `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv` (CWD), `.vscode/`, `.idea/`, `*.log` | `.gitignore` |
| INF-12 | `readme.md:113-118` advertises the notebook as "the same workflow", which is materially false | `readme.md:113-118` |
| INF-13 | `readme.md:61-67` documents `npm test` and `npm run build` but **not** `npm run typecheck` (which is what CI actually runs) | `readme.md:61-67`; `ci.yml:36` |
| INF-14 | `readme.md:42-44` documents the `build_index` flags but **not** `--category` | `readme.md:42-44`; `build_index.py:270-274` |
| INF-15 | `readme.md:30` claims the recency filters "fetch only the week shards they need"; `selectShards` uses `shard.to >= windowStart` (boundary-inclusive), so a 7-day window still pulls the older boundary shard | `readme.md:30`; `paperIndex.ts:54-59` |
| INF-16 | `readme.md:122-125` says CI runs "the Python `unittest` suite and the web typecheck/tests" — accurate but omits that CI never builds and never lints | `readme.md:122-125` |
| INF-17 | The README hero image is a 2023 screenshot of the *legacy CLI's* HTML output, not the React feed; 465 KB and misleading | `readme.md:11`; `images/feed_example.png` |
| INF-18 | 5 open npm advisories (1 critical vitest, 1 high vite, 3 moderate) and no `.github/dependabot.yml` | `web/package-lock.json` |
| INF-19 | 7 outdated npm packages, every one a breaking-major bump; no `engines` field and no `.nvmrc` (Node 20 is pinned only inside the workflows) | `web/package.json` |
| INF-20 | `readme.md` is lowercase; no `docs/`, no changelog, no issue/PR templates, no CODEOWNERS, no release process | repo root |

### Baseline (do not "fix" without being asked)
Zero failing checks at recon time: Python 27/27 OK, `tsc --noEmit` clean, vitest 36/36,
`npm run build` clean. The only genuine command-level failures are the notebook (PE-7) and the
missing `npm run lint` script (PE-4/INF-04), both absences by design rather than regressions.
