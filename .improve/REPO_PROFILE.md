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
is deliberate and should be preserved when adding modules. On the web side the 1:1 mirror holds
under `web/src/lib/__tests__/`; cross-module and DOM tests live in `web/src/__tests__/` (see §5.3).

**Maturity.** Early but actively maintained. 85 commits — 59 of them since this loop's own baseline
`fc77a40` — real tests on both stacks, strict
TypeScript, conventional commits, gitignored build output, docs that mostly match reality.
No external contributors, no releases, no issue templates.

---

## 3. Verified commands

Every command below was executed. Dir is noted. **All four baseline checks are green.**

### 3.1 Python environment

The repo has **no committed venv, no `pyproject.toml`, no `setup.cfg`, no lockfile**. As of
**IMP-031 / IMP-032 (`299d753`, 2026-10-02)** both `CONTRIBUTING.md` and `readme.md` document a
**venv-first, root-based workflow**: `python3 --version` (a `3.10 or newer` gate stated as the first
line of the block) → `python3 -m venv .venv` → `source .venv/bin/activate` → `python -m pip install
-r requirements.txt`, with every block naming its working directory and the only `cd web` coming
*after* the Python test step. That guidance was executed verbatim on a clean copy: **every documented
step exits 0**, and the suite ran from the repository root as the document says.

**The floor is documented but still unenforced.** Both docs say "**Python 3.10 and newer** can
install the dependencies. This project is *verified on Python 3.11 and 3.14*… Python 3.9 and older
cannot install the dependencies at all." That wording is honest and was measured (3.11.8 and 3.14.3
both green; 3.10 resolves `pandas` 2.3.x by backtracking, which is why it is stated as installable
rather than verified). But **no workflow pins any of it**: `ci.yml:15`, `ci.yml:34` and
`deploy.yml:32` are all `python-version: "3.x"`, and `"3.x"` floats *upward*, so CI will drift to
3.15/3.16 and will never once exercise the 3.11 floor the docs name. Do not read the docs' floor as
a tested one. Backlog: **IMP-097** (add a matrix) and **IMP-209** (the matrix must include the
documented floor, and the two floating sites outside IMP-097's area).

**On this machine** the interpreter with the dependencies is still `/usr/local/bin/python3.11` (the
only one: `arxiv 2.1.3`, `pandas 2.2.1`, `numpy 1.26.4`); `/opt/homebrew/bin/python3` (3.14.3) has
neither `arxiv` nor `pandas` outside a venv, so the documented venv block is required here, not
optional:

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

`requirements.txt` is `arxiv>=2.1.0,<4` and `pandas>=2.0.0`, with **no lockfile**. The `arxiv`
upper bound is IMP-033's (`bbe2d18`); `pandas` still has no upper bound. A fresh resolve today
yields `arxiv 3.0.0` / `pandas 3.0.6`. **Before that pin, a fresh resolve yielded `arxiv 4.0.1`**,
which is exactly how PY-1 existed — 4.x removed `Result.download_pdf` / `download_source`, so
`--download-pdfs` and `--download-sources` crashed. The bound makes 4.x *uninstallable*; it does
**not** repair those two flags (IMP-093 owns that).

### 3.2 Python tests

```shell
# from repo root
/usr/local/bin/python3.11 -m unittest discover -s tests -v     # 89 tests, OK, ~1.1s
```

Baseline: **`Ran 89 tests` / `OK`, exit 0.** *(Re-measured 2026-10-02: `Ran 89 tests in 1.104s` /
`OK`, exit 0, from the command above. This row has read 44, then 78, then 89 as agents landed tests,
and **each of those numbers was accurate when written** — re-measure, do not trust any of them.)*
Almost entirely offline and hermetic — every test injects a fake arXiv client; no network, no real
clock, no filesystem beyond `tempfile`. Under a socket block (`socket.connect` /
`create_connection` / `getaddrinfo` replaced by a raiser) the suite reports **89 run, 1 failure** —
the single failure is the pre-existing `BlackHoleRequestTests`, which deliberately binds
`127.0.0.1:0` to measure a real read timeout and so trips any blanket socket block. Breakdown:
`test_arxiv_common.py` (18), `test_build_index.py` (43), `test_paper_collector.py` (28) — 18 + 43 +
28 = 89. **This sentence previously read "78 run, 0 failures" and was false**; it was also the exact
sentence a future verifier reads to decide hermeticity, so do not restore it without re-running the
block.

Note the suite is hermetic in the strong sense: it passes identically on `arxiv` 2.1.3, 3.0.0 **and
4.0.1**, because every arXiv touch point is a fake and no test constructs a real `arxiv.Result`. A
green suite therefore proves nothing about the installed `arxiv` version — do not use it as evidence
for a dependency pin (IMP-033's verifier drew exactly this conclusion).

```shell
python -m pytest tests -q        # WORKS — 89 passed, but ONLY after `pip install pytest`
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
npm test             # vitest run            -> 16 files, 253 tests passed, ~4.2s
npm run build        # tsc --noEmit && vite build -> 41 modules, ~0.4s
```

Baseline artifact sizes (useful for spotting an accidental bundle regression), all re-measured
2026-10-02: **JS 171.45 kB** (171,472 B, gzip 54.92), **CSS 10.93 kB** (10,927 B, gzip 2.86),
**41 modules**.

> **The historical baseline figure that used to live here — "163.72 kB, 39 modules" — was wrong at
> the commit it was measured against.** A read-only rebuild of `1c075b3` (the restyle commit it was
> attributed to) measures **163,185 B / 163.19 kB / 38 modules**, off by 535 bytes and one module
> before any of this loop's work landed. It is recorded here so the correction is auditable rather
> than silently overwritten: the true historical baseline is 163.19 kB / 38 modules, the true
> current figure is 171.45 kB / 41 modules, and the +8.29 kB delta is 100% attributable to the
> commits in between (IMP-019/IMP-173/IMP-020 rewrote `App.tsx` and added three runtime modules).
> **`.github/workflows/ci.yml` contributes 0 bytes** — proven three ways: it is not an input to
> `vite build`; a tree carrying the modified `ci.yml` emits a byte-identical bundle (same content
> hash `index-D7spZXJu.js`) as a clean `git archive HEAD`; and the `node_modules` rendered total is
> identical (147,232 B) at both `1c075b3` and HEAD. No YAML-only change can move a bundle, which is
> why this correction is a profile fix and not an IMP-026 defect.

The JS figure drifts a few hundred bytes per feature commit as modules gain exports — at 53 commits
that mechanism produced the full 8.29 kB, so the old "±1 kB" tolerance no longer holds and should be
read as historical, not enforced. The CSS figure remains stable at 10.93 kB (measured delta exactly 0
across the same range). **Data presence does not affect the bundle at all**: the index is copied in as
files, never inlined, so the JS and CSS content hashes are identical whether `web/public/data` is
present, absent, or empty.

Test files, **253 tests across 16** — re-measured 2026-10-02, and **re-confirmed 2026-10-02 after
IMP-031/IMP-032 and IMP-198 landed**: `Test Files  16 passed (16)` / `Tests  253 passed (253)`,
duration 4.19 s. Unchanged by those three commits (this table previously read 69 tests across 5 and
was accurate only at the commit that created it):

| File | Tests | Environment |
| --- | --- | --- |
| `web/src/lib/__tests__/urlState.test.ts` | 50 | `node` (`// @vitest-environment node` docblock — the hash module needs no DOM) |
| `web/src/lib/__tests__/collections.test.ts` | 41 | jsdom (global default) |
| `web/src/lib/__tests__/paperIndex.test.ts` | 28 | jsdom (global default) |
| `web/src/lib/__tests__/search.test.ts` | 12 | jsdom (global default) |
| `web/src/lib/__tests__/failureCopy.test.ts` | 8 | jsdom (global default) |
| `web/src/__tests__/App.loadFailure.test.tsx` | 26 | jsdom, RTL |
| `web/src/__tests__/App.categories.test.tsx` | 21 | jsdom, RTL |
| `web/src/__tests__/feedControls.test.tsx` | 14 | jsdom, RTL |
| `web/src/__tests__/errorBoundary.test.tsx` | 11 | jsdom, RTL |
| `web/src/__tests__/App.partialShard.test.tsx` | 9 | jsdom, RTL |
| `web/src/__tests__/App.storage.test.tsx` | 8 | jsdom, RTL |
| `web/src/__tests__/App.retry.test.tsx` | 7 | jsdom, RTL |
| `web/src/__tests__/paperCardNullUrls.test.tsx` | 7 | jsdom, RTL |
| `web/src/__tests__/malformedImport.test.tsx` | 5 | jsdom, RTL |
| `web/src/__tests__/App.relevance.test.tsx` | 3 | jsdom, RTL |
| `web/src/__tests__/domEnvironment.test.tsx` | 3 | jsdom, RTL |

**The test layout spans BOTH directories, and the verified baseline includes component/DOM tests.**
139 of the 253 live under `web/src/lib/__tests__/` (pure-module, mirroring `web/src/lib/<module>.ts`)
and 114 under `web/src/__tests__/` (cross-module and component tests, including 111 that drive React
components through `@testing-library/react`). `App.tsx` alone is covered by 74 tests across six
`App.*.test.tsx` files; every one of the four components has its own file. So "component tests are
structurally impossible here" (INF-08) and "`App.tsx` and all four components are still untested"
(PE-13) were both true when written and are **both false now** — see the rows below and §10.

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
- A run that *partially* fails now exits **1** and writes nothing (IMP-004, commit `468b80d`),
  logging `  query failed for <category>: <error>` — see §8 trap 3. An exit 1 is therefore no longer
  a proof of a network failure alone: it means "no papers at all" *or* "some category's query
  failed". Read the log line to tell them apart.

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
- **Component/DOM tests are possible as of IMP-005** (commit `894fb9b`). `vite.config.ts:7-10` now
  sets `environment: "jsdom"`, `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]` and
  `setupFiles: ["src/test-setup.ts"]`, with `jsdom`, `@testing-library/react` and
  `@testing-library/user-event` as devDependencies. So a component change can be verified by
  `@testing-library/react` render assertions *in addition to* typecheck, build and eyeballing.
  Coverage is **no longer** thin — **this paragraph was stale for a full loop.** As of 2026-10-02,
  111 of the 253 tests under `web/src/__tests__/` drive React components through
  `@testing-library/react`: `App.tsx` alone has 74 across six `App.*.test.tsx` files
  (categories 21, loadFailure 26, partialShard 9, relevance 3, retry 7, storage 8), and
  `feedControls` (14), `errorBoundary` (11), `paperCardNullUrls` (7) and `malformedImport` (5)
  each have their own file. `domEnvironment.test.tsx` (3 tests) is now a *fixture check* rather than
  the only DOM test. Items IMP-037 and IMP-129 through IMP-132 remain the owners of whatever is left.
  **Caveat:** both workflows still request floating
  `node-version: "20"` and there is no `engine-strict`, so a `jsdom@29` engine mismatch would be an
  `EBADENGINE` warning, not a hard failure.
- A JS file that needs real Node APIs (e.g. `node:fs`) may opt out of jsdom with a
  `// @vitest-environment node` docblock on the first line — the pattern `urlState.test.ts:1` uses.
  Vitest runs on Node in every environment and only swaps globals.

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
2. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` — 44+ tests OK, if you touched Python.
3. Playwright at 1280 and 390, screenshots in `.improve/artifacts/<IMP-ID>/`, console clean, if you
   touched anything visible.
4. Mirror test added or updated alongside any behavior change.
5. No new file in a gitignored location; `git status` shows only intended files.
6. Every line in §9 that your change touches is either fixed (say so explicitly, with the id) or
   consciously left alone.
7. **Evidence rules** (added after the IMP-012 verifier found fabricated build figures in that
   item's report — see `.improve/FEATURES.md` header and IMP-167): any line number cited in a
   report is read from the file it names; any build size, test count, contrast ratio or timing is
   quoted with the command that produced it and its verbatim output; a figure that was not measured
   is omitted rather than estimated. An untraceable number in `.improve/` becomes the next
   implementer's baseline, so this is a correctness rule for the report, not a style preference.

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
  `location.hash` parser — `readHash()` and `writeHash()` now live in **`web/src/lib/urlState.ts`**
  (moved out of `App.tsx` by IMP-143, commit `5320db6`) and operate over `URLSearchParams`,
  `#view=collections&q=…&cat=…&recency=30&sort=relevance`, with defaults omitted. `urlState.ts:16`
  is `readHash(hash = window.location.hash)`; `:41-47` is the default `writeToLocation` writer;
  `writeHash(state, mode, write = writeToLocation)` returns `{ hash }` so tests need no `window`.
  `App.tsx:64,76` call `readHash()` and `:69,183-203` call `writeHash`/`applyState`. Collections
  state is a `useReducer` over a pure reducer in `lib/collections.ts`. Network concerns live in
  `lib/paperIndex.ts`; search in `lib/search.ts`; persistence in `lib/collections.ts`.
- Constants in TS: `PAGE_SIZE = 50` (`App.tsx:24`), `DEFAULT_RECENCY: RecencyDays = 60` and
  `RECENCY_VALUES = [7,30,60]` (**module-private, now in `urlState.ts:3-4`**), `LOAD_MORE_STEP = 50`
  (`PaperList.tsx:6`), `RECENCY_OPTIONS = [7,30,60]` (`FeedControls.tsx:16`),
  `ABSTRACT_PREVIEW_CHARS = 260` (`PaperCard.tsx:5`), `TITLE_WEIGHT=5 / AUTHOR_WEIGHT=2 /
  ABSTRACT_WEIGHT=1 / PHRASE_BONUS=2` (`search.ts:13-16`), `COLLECTIONS_KEY = "rpf.collections.v1"`,
  `PAPERS_KEY = "rpf.papers.v1"` (`collections.ts:3-4`). `PROTOTYPE_KEYS` (`collections.ts:40`)
  and `hasOwnKey` now guard every object-keyed membership test in `collections.ts`.
- CSS: a token layer at `styles.css:1-26`, a dark-mode override at `:28-45` under
  `prefers-color-scheme`, BEM-ish `block__element--modifier` class names, one `@media
  (max-width: 520px)` block at `:720-753`, one `:focus-visible` rule at `:86-90`, zero inline
  styles. **New styling goes in `styles.css`; never add a `style=` prop.**
- Tests: the 1:1 source mirror holds in **two** directories, and both are live:
  - **`web/src/lib/__tests__/<module>.test.ts`** — mirrors `web/src/lib/<module>.ts` exactly
    (`search`, `collections`, `paperIndex`, `urlState`). `describe`/`it`, `expect` from vitest.
    `collections.test.ts` ships reusable `MemoryStorage` (`:32-58`) and `THROWING_STORAGE`
    (`:60-79`) fakes — reuse them, don't write new ones.
  - **`web/src/__tests__/`** — cross-module / DOM tests that mirror no single module, currently
    `domEnvironment.test.tsx` (`.tsx` because it mounts with `@testing-library/react`). Put a new
    test here when it needs a DOM or spans modules; put it under `lib/__tests__/` when it tests one
    lib module's pure logic. `describe`/`it`, `expect` from vitest, `render`/`screen` from RTL.
  - `web/src/test-setup.ts` runs before every test file and calls RTL's `afterEach(cleanup)`.
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
surface of a static site. `jsdom` + `@testing-library/react` + `@testing-library/user-event` have
since been added as dev-only dependencies (IMP-005, commit `894fb9b`) — `react` + `react-dom`
remain the only **runtime** dependencies, and the bundle did not grow. For Python, the repo has no
lockfile and no upper bounds, so a new requirement is a live CI risk. If an item adds any further
dependency (e.g. `ruff`/`mypy`, `@vitest/coverage-v8`), the item must state
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
| PE-13 | **~~Zero component/DOM test coverage, and it is structurally impossible today.~~ FIXED — infrastructure by IMP-005 (commit `894fb9b`), coverage by the items in §10.** `vite.config.ts:7-10` is `environment: "jsdom"` with `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]` and `setupFiles: ["src/test-setup.ts"]`, with `jsdom` / `@testing-library/react` / `@testing-library/user-event` as devDependencies. **The coverage half is also closed** — the "still open" clause here was true when written and is false as of 2026-10-02: 111 component/DOM tests now exist under `web/src/__tests__/`, including 74 against `App.tsx`. **`@vitest/coverage-v8` is still absent**, so there is no coverage *report* — line and branch percentages remain unmeasured, and that is what IMP-037 / IMP-129–IMP-132 are for. | `vite.config.ts`; `web/package.json`; `web/src/__tests__/` | fixed (infrastructure and coverage) / live (coverage report) |
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

3. **~~A partially-failed index deploys silently with exit 0.~~ FIXED by IMP-004 (commit `468b80d`).**
   `arxiv_common.iter_results` (`arxiv_common.py:52-59`) no longer swallows `arxiv.ArxivError`; it
   records the failure in a per-category status holder, and `collect_papers`
   (`build_index.py:233-237`) logs `  query failed for %s: %s` and `main()` returns **1** without
   writing anything (`build_index.py:312-315`). A truncated-but-successful run is still not marked
   failed (an early retention `break` raises `GeneratorExit`, not `ArxivError`). **What remains
   open:** the choice was *hard fail*, so a partial arXiv outage now turns the whole deploy red
   rather than publishing a partial index, and there is no retry/backoff. The legacy CLI's own
   `fetch_papers` path is untouched and still reports "0 papers extracted" on a 429.

4. **Abstract truncation happens twice, in two languages.** `build_index` caps at 500 chars +
   `…` and sets `abstractTruncated` (`build_index.py:48-53`); `PaperCard` then clamps that
   *already-capped* string at `ABSTRACT_PREVIEW_CHARS = 260` (`PaperCard.tsx:5, 44-49`). So
   "Show more" can never reveal more than ~500 chars. There is **no full abstract anywhere in the
   app** — it lives only on arXiv. Changing one budget without the other silently changes the UI.

5. **`safe_filename` is weak, and it is not a sanitizer — still open, item IMP-023.**
   `paper-collector.py:30` replaces `\ / : " * ? < > |` but **not `.`**, so `safe_filename("..") == ".."`
   and `safe_filename("../../etc") == ".._.._etc"`. The slug is then used as a **directory name** at
   `:172` (`extract_source_archive(f"./extracted/{title_slug}")`). No length cap (a 400-char title
   exceeds the 255-byte filename limit), no reserved-name handling. `filter="data"` (IMP-024) keeps
   members inside `dest`; it says nothing about `dest` itself, so a paper titled `..` still puts the
   repository root inside the filter boundary and every member lands there unlogged.
   **Fixed half:** the raw `--topic` is no longer interpolated into the output paths — both are built
   from `safe_filename(topic)` at `paper-collector.py:238` (IMP-002, commit `d3b4a1e`), and
   `--save-csv` now honours `--output-dir` as a side effect. That closed the traversal *call site*;
   the helper is still weak.

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

11. **~~A rejected manifest promise is memoized forever.~~ FIXED by IMP-003 (commit `768a5ae`).
    `paperIndex.ts:70-75` now resets `this.manifestPromise = null` inside a `.catch` that rethrows,
    so a later `getManifest()` re-fetches and `loadPapers` is retry-safe. **What remains open is
    the other half — the absent retry affordance:** there is still no "Try again" button anywhere,
    and the manifest effect (`App.tsx:148-166`, `[]` deps) runs once, so a user whose first paint
    failed has no in-page recovery and must reload the tab by hand. That is item **IMP-007**.

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
| WEB-01 | **FIXED (memoized promise) / OPEN (no retry UI) — IMP-003 + IMP-007.** The rejected `manifestPromise` is no longer cached: `paperIndex.ts:70-75` clears it in a `.catch` that rethrows, so a second `getManifest()` re-fetches. The *other* half is still live: no "Try again" affordance exists in `App.tsx:364-376`, so a first-paint failure still requires a manual page reload. That half is **IMP-007**. Commit `768a5ae`. | `paperIndex.ts:62, 70-75`; `App.tsx:364-376` |
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
| WEB-20 | **FIXED — IMP-001 / IMP-151b.** `javascript:` URL injection via imported export is closed. `collections.ts:86-88` exports `isHttpUrl` (`/^https?:\/\//i.test(String(value).trim())` — anchored *after* the trim, so the leading-space/tab-obfuscated forms Chromium actually executes are all rejected), `hasSafeUrls` (`:96-101`) applies it to both `absUrl` and `pdfUrl` on the import path only, and `isPaper` (`:68-80`) now also rejects prototype-key ids. `PaperCard.tsx:33-35` `safeHref` is the independent render-time guard, so `loadState` hydration is safe without import-time validation. `http:` is still accepted on purpose: `build_index.py:111` emits `http://arxiv.org/abs/…`. Commits `0beec1b`, `7a2ed82`. **Residual (tracked separately):** `isPaper` still does not validate `categories` / `published`, and `PaperCard.tsx:79` does `paper.categories.map` unguarded, so a malformed export still blanks the whole app. | `collections.ts:68-80, 86-88, 96-101`; `PaperCard.tsx:33-35, 79` |
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
| WEB-33 | Bare `#` is always written, so the default view's canonical URL is `…/#`. **Still open** — IMP-143 was a pure move, no behavior changed. Re-pointed: the serialization is `urlState.ts:77` (`const hash = \`#${params.toString()}\``), not `App.tsx:79`. | `urlState.ts:77`; callers `App.tsx:69,183-203` |
| WEB-34 | History semantics inconsistent: `setView` pushes, all filter changes replace → Back can't undo a filter change. **Still open** — IMP-143 was a pure move. Re-pointed: the push/replace split is the `mode` argument of `writeHash` (`urlState.ts:55-79`) and the default `writeToLocation` writer (`urlState.ts:41-47`); the call sites are `App.tsx:183` (`"push"`) and `App.tsx:187,191,195,203` (`"replace"`). | `urlState.ts:41-47, 55-79`; `App.tsx:183-203` |
| WEB-35 | Collections are not deep-linkable (`#collection=<id>`) and the view fully unmounts on tab switch, discarding rename drafts / import state | `App.tsx:347`; `CollectionsView.tsx` |
| WEB-36 | No per-paper deep link (`#paper=<id>`). **Still open** — item IMP-133. Re-pointed: the hash grammar that would need a `paper=` key is `readHash`/`writeHash` in `urlState.ts:16-79`; `PaperCard.tsx` renders no such affordance. | `urlState.ts:16-79`; `PaperCard.tsx` |
| WEB-37 | **FIXED — IMP-143, commit `5320db6`.** `readHash`/`writeHash` are now exported from the new `web/src/lib/urlState.ts` and covered by `web/src/lib/__tests__/urlState.test.ts` (18 tests) asserting the round-trip invariant. `App.tsx` retains no copy. **Not yet closed:** `urlState.ts:16`'s `= window.location.hash` default and `:41-47`'s default writer still have zero coverage, because every one of the 18 tests passes an explicit hash and an injected writer. | `web/src/lib/urlState.ts:16, 41-47, 55-79`; `web/src/lib/__tests__/urlState.test.ts` |
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
| WEB-52 | **A11y: contrast failures in light mode — half FIXED (IMP-012, commit `0ad375c`).** `--text-muted` was darkened from `#7a7a73` to `#666661` at `styles.css:9`, which takes it from 4.32:1 (`--surface`), 3.79:1 (`--surface-muted`) and 4.11:1 (`--bg`) to 5.77 / 5.06 / 5.48 — all clear the 4.5 floor. Dark mode (`styles.css:35`, `#9b9b94`) was already passing and is unchanged. **Still open, item IMP-013:** `--border` on `--surface` is 1.27:1, below the 3:1 requirement for input boundaries. | `styles.css:9, 7, 214` |
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
| PY-6 | **FIXED — IMP-004, commit `468b80d`.** `iter_results` no longer swallows `arxiv.ArxivError`; it records the failure per category, `collect_papers` (`build_index.py:233-237`) logs `  query failed for %s: %s`, and `main()` returns 1 and writes nothing (`build_index.py:312-315`). A green deploy is now evidence the query completed. **Residual:** a hard fail means a partial arXiv outage turns the whole deploy red with no retry/backoff, and the legacy CLI's own fetch path still reports "0 papers extracted" on a 429. | `arxiv_common.py:52-59`; `build_index.py:233-237, 312-315` |
| PY-7 | Non-atomic writes — a crash mid-`json.dump` leaves a truncated `index.json`/shard on the static host (the symptom is defended against in `paperIndex.ts:96-101`; the cause is not prevented) | `build_index.py:237-244` |
| PY-8 | `_clean_old_shards` deletes first, writes second — a failure between them leaves `index.json` referencing deleted shards → 404s | `build_index.py:224-232` |
| PY-9 | No error handling around `write_index`; an unwritable `--out-dir` propagates a raw `OSError` traceback instead of `logging.error` + `return 1` | `build_index.py:298` |
| PY-10 | Zero CLI argument validation: `--retention-days -1/0`, `--abstract-chars -3` (silently disables truncation), `--max-per-category -9` (means unlimited), any `--out-dir` | `build_index.py:248-275` |
| PY-11 | `DEFAULT_OUT_DIR` is CWD-relative, so running outside the repo root writes a stray `web/public/data` nothing deploys | `build_index.py:34` |
| PY-12 | **FIXED — IMP-198, commit `b7e23a8`.** The request timeout now exists: `DEFAULT_REQUEST_TIMEOUT_SECONDS = 60` at `arxiv_common.py:19`, installed by `install_request_timeout` (`:48-77`) as `TimeoutSession`, a `requests.Session` subclass whose `request()` does `kwargs.setdefault("timeout", …)`. It is a **floor, not a guarantee** — it reaches into the library's private `Client._session` and raises `TimeoutNotInstalled` rather than running unbounded if that attribute ever changes shape. `requests` applies the value per socket operation, so a slow-drip server can still outlast it; the workflow-level `timeout-minutes` on the index step is what bounds that case. **Residual:** the deploy step's cap is 1.009× the compound worst case (38 pages × 70 s + 5 × 360 s = 4460 s vs a 4500 s cap — 40 s of slack, breaking at 39 pages). Backlog **IMP-205**, **IMP-206**. | `arxiv_common.py:16-19, 26-45, 48-77, 80-88`; `deploy.yml:23-26, 37-55` |
| PY-13 | `DEFAULT_DELAY_SECONDS = 10` is 3× arXiv's stated ToU minimum of 3s, unconfigurable, with no per-category backoff | `arxiv_common.py:16` |
| PY-14 | `logging.basicConfig` at **import** time in three modules, with three different formats; a library module reconfigures the root logger process-wide | `arxiv_common.py:13`; `paper-collector.py:18`; `build_index.py:40` |
| PY-15 | `iso_date` docstring claims "normalized to UTC" but the naive-datetime branch does not convert | `build_index.py:77-87` |
| PY-16 | Dead `yielded` counter that duplicates `arxiv`'s own `islice` limit — untestable by design | `arxiv_common.py:51, 55-57` |
| PY-17 | `UNLIMITED = 100000` exceeds arXiv's 30,000-result ceiling. **The line cite was stale (`build_index.py:38` → now `:45`; `limit` is resolved at `:236`) and the row understates the problem.** arXiv's own API manual (§3.1.1.2) states "A request with max_results >30,000 will result in an HTTP 400 error code" and recommends OAI-PMH for bulk harvesting. `--max-per-category 0` is the **default**, and `.github/workflows/deploy.yml:55` runs the bare uncapped command every week. When a deep-offset 5xx fires, `collect_papers` records the failure and `main()` **discards all five categories** and exits 1 with nothing written — reproduced deterministically against a stubbed upstream (6 attempts at `start=10000`, then exit 1, no out-dir). So this is a live production-deploy defect, not a latent one. **Backlog: IMP-095 (the constant) and IMP-204 (the bound + per-category degradation + the deploy default).** | `build_index.py:43-45, 236, 261-273`; `deploy.yml:55` |
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
| PY-27 | ~~`safe_filename` is not a sanitizer~~ **FIXED — IMP-023, commit `297ed71`.** It is now a real sanitizer: `MAX_SLUG_BYTES = 200` caps the slug (which becomes both a filename and a directory name), `truncate_to_bytes` cuts on UTF-8 boundaries, `FALLBACK_SLUG = "_"` covers inputs that leave nothing usable, and `WINDOWS_RESERVED_NAMES` defuses `CON`/`PRN`/`AUX`/`NUL`/`COM1-9`/`LPT1-9`. Verified: `safe_filename("..") == "_"`, `"." == "_"`, `"   " == "_"`, `"CON" == "CON_"`, and a 300-character input is capped to 200 bytes. | `paper-collector.py:30-45, 55-60` |
| PY-28 | Path traversal: the raw `--topic` is interpolated into both output paths with no sanitization — `--topic '../../escape'` writes outside `results/`; a `/` in the topic raises `FileNotFoundError`; the readme's own example topic produces a filename with `:` and `"` (illegal on Windows) | `paper-collector.py:138, 142`; `readme.md:83` |
| PY-29 | ~~`--save-csv` ignores `--output-dir` — the CSV lands in CWD~~ **FIXED — IMP-002, commit `d3b4a1e`, and locked in by IMP-025, commit `058acc0`.** The CSV path is `os.path.join(args.output_dir, f"{topic_slug}_papers.csv")` and `os.makedirs(args.output_dir, exist_ok=True)` runs unconditionally **before** the write, so the directory exists first and the CSV never lands in the CWD. `.gitignore:6` (`results/*.csv`) covers the default location. IMP-025 added a non-vacuous test (`MainOutputPathTests.test_save_csv_writes_into_output_dir_and_never_the_cwd`) that fails on the old bare-CWD write, on a stray CWD duplicate, and if `makedirs` is moved after the write. **This row said "open" and cited `paper-collector.py:138`, which is the write's former line — it is `:306`, with `makedirs` at `:303`.** Re-raise only against a regression, not against this row. | `paper-collector.py:303, 306` |
| PY-30 | **FIXED — IMP-024, commit `19f8dbb`.** `tarfile.extractall` now receives `filter="data"` on interpreters that have it (`paper-collector.py:123`, gated on the `TARFILE_HAS_FILTER` capability constant at `:24`, which uses `inspect.signature`, not a version check). Members are pre-screened so one rejected member cannot abort the rest of the archive, and each rejection is logged. **Residual (tracked separately):** the hand-rolled fallback for pre-3.8.17 interpreters preserves privileged mode bits, and its test helper's escape scan misses writes outside its own tempdir. | `paper-collector.py:24, 43-67, 78-123`; `ci.yml:15` |
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
| INF-01 | ~~CI never runs `npm run build`~~ **FIXED — IMP-026, commit `2ec06d0`.** The `web-tests` job now ends with a `Build` step running `npm run build`, and IMP-193 (`5684b1b`) added the index build at `ci.yml:45-47` immediately before it, so the gate runs in the same populated state as the deploy build it pre-screens. **Verified load-bearing**, not decorative: in a `/tmp` copy, a missing `./__missing-asset.png` import in `src/main.tsx` gives typecheck 0 / test 0 / **build 1**. **Known limits, do not over-claim:** (a) a plain CSS **syntax** error is *not* caught — Vite/PostCSS tolerates an unterminated rule and the build still exits 0, shipping an 11.86 kB CSS instead of 10.93 kB; only CSS *resolution/pipeline* errors fail it; (b) CI pins `node-version: "20"` and every local verification ran a different major, so the exact CI runtime is untested. | `ci.yml:45-49` |
| INF-02 | Deploy cron is `0 6 * * 0` (weekly, Sunday) while its own comment and the readme both say daily | `deploy.yml:5-6`; `readme.md:122-123` |
| INF-03 | `CONTRIBUTING.md`'s documented Python command fails on macOS and it never mentions the `web/` app, its tests, or its build | `CONTRIBUTING.md:2-4` |
| INF-04 | No lint configured for either stack; no lint step in either workflow; `npm run lint` does not exist | `web/package.json:6-13` |
| INF-05 | No `pyproject.toml` at all, so no `[tool.ruff]`/`[tool.pytest]`/coverage config can live anywhere | repo root |
| INF-06 | **Partly fixed — IMP-033, commit `bbe2d18`.** `arxiv` now carries a real upper bound (`arxiv>=2.1.0,<4`), with a comment block explaining that 4.0.0 removed `Result.download_pdf`/`download_source` and that the bound is a **floor, not the fix** (IMP-093 owns the port). Still open: `pandas` has no upper bound, and there is **still no lockfile and no hashes** for either stack. Note that `<4` makes 4.x *uninstallable* rather than *supported* — `--download-pdfs`/`--download-sources` remain broken in principle (PY-26/IMP-093) and the Python suite cannot detect it, since it passes on 4.0.1 too. | `requirements.txt:1-13` |
| INF-07 | `pandas` is installed on every deploy but is only needed by `paper-collector.py`; `build_index.py` never imports it | `deploy.yml:31`; `paper-collector.py:14` |
| INF-08 | ~~Component tests are structurally impossible~~ **FIXED — IMP-005, commit `894fb9b`.** `vite.config.ts:7-10` is now `environment: "jsdom"` with `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]` and `setupFiles: ["src/test-setup.ts"]`; `jsdom` / `@testing-library/react` / `@testing-library/user-event` are devDependencies. **`@vitest/coverage-v8` is still absent**, so there is no coverage report. | `vite.config.ts`; `web/package.json` |
| INF-09 | CI has no coverage, no Python matrix, no pip cache, no `permissions:`, no `concurrency:`, no `timeout-minutes:`, no `path:` filters; actions pinned to mutable tags, not SHAs | `ci.yml` |
| INF-10 | Deploy has no quality gate — it publishes to Pages whether or not CI is green | `deploy.yml:21-54` |
| INF-11 | `.gitignore` misses `.venv/`, `venv/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.coverage`, `htmlcov/`, `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv` (CWD), `.vscode/`, `.idea/`, `*.log` | `.gitignore` |
| INF-12 | `readme.md:113-118` advertises the notebook as "the same workflow", which is materially false | `readme.md:113-118` |
| INF-13 | `readme.md:61-67` documents `npm test` and `npm run build` but **not** `npm run typecheck` (which is what CI actually runs) | `readme.md:61-67`; `ci.yml:36` |
| INF-14 | `readme.md:42-44` documents the `build_index` flags but **not** `--category` | `readme.md:42-44`; `build_index.py:270-274` |
| INF-15 | `readme.md:30` claims the recency filters "fetch only the week shards they need"; `selectShards` uses `shard.to >= windowStart` (boundary-inclusive), so a 7-day window still pulls the older boundary shard | `readme.md:30`; `paperIndex.ts:54-59` |
| INF-16 | `readme.md:133-134` says CI runs "the Python `unittest` suite and the web typecheck/tests" — accurate as far as it goes, but it now omits two things CI does: the **web build** (IMP-026) and the **paper index generation** (IMP-193), which is a live network call. Never lints, correctly — no lint exists. The line cite here was `readme.md:122-125`, which now points at the notebook paragraph after earlier readme edits shifted it. | `readme.md:133-134`; `ci.yml:45-49` |
| INF-17 | The README hero image is a 2023 screenshot of the *legacy CLI's* HTML output, not the React feed; 465 KB and misleading | `readme.md:11`; `images/feed_example.png` |
| INF-18 | 5 open npm advisories (1 critical vitest, 1 high vite, 3 moderate) and no `.github/dependabot.yml` | `web/package-lock.json` |
| INF-19 | 7 outdated npm packages, every one a breaking-major bump; no `engines` field and no `.nvmrc` (Node 20 is pinned only inside the workflows) | `web/package.json` |
| INF-20 | `readme.md` is lowercase; no `docs/`, no changelog, no issue/PR templates, no CODEOWNERS, no release process | repo root |

### Baseline (do not "fix" without being asked)
Zero failing checks at HEAD: **Python 89/89 OK**, `tsc --noEmit` clean, **vitest 253/253 across 16
files**, `npm run build` clean (**41 modules, JS 171.45 kB, CSS 10.93 kB**). Re-measured
2026-10-02; this paragraph previously read "Python 44/44 … vitest 69/69 across 5 files … 39 modules,
JS 163.72 kB", which was accurate when written and is now stale — re-measure rather than trusting
either number. The Python figure is the one that moves every time an agent lands tests (44 → 78 →
89 across this loop), so **treat 89 as of 2026-10-02, not as a permanent fact**. The only genuine
command-level failures are the notebook (PE-7) and the missing `npm run lint` script (PE-4/INF-04),
both absences by design rather than regressions.

**Two non-flaky "green" results are weaker than they look — do not treat them as coverage.**
(1) The Python suite passes identically on `arxiv` 2.1.3, 3.0.0 and 4.0.1, so it cannot detect the
4.x API removal that breaks `--download-pdfs`. (2) `npm test` runs in **fixed order**; the
order-dependent alert-count race that lived in `App.loadFailure.test.tsx` was invisible to it and
only appeared under `--sequence.shuffle` (IMP-192 fixed it). A green plain run is evidence that the
fixed order passes, not that the suite is order-independent.

---

## 10. Recently fixed — do not re-report

**Thirty-four items are committed** (`git log --oneline fc77a40..HEAD` is 64 commits; roughly a
third are `chore(improve)` bookkeeping). Each was implemented, then independently verified; the
verifier's acceptance criteria all passed. **A verifier who re-raises any of these as a new defect is
reporting a fixed bug.** Re-verify against the current source before believing either the row or this
list — several rows in §9 were stale for a full loop after their fix landed, so the drift runs in
both directions.

| Item | Commit | What landed | Profile rows closed |
| --- | --- | --- | --- |
| IMP-001 / IMP-151b | `0beec1b`, `7a2ed82` | `javascript:` (and `data:`/`vbscript:`/`file:`/`blob:`) URLs rejected on the **import** path by `isHttpUrl` (`collections.ts:86-88`) + `hasSafeUrls` (`:96-101`); null/absent URLs treated as "no URL" rather than hostile | WEB-20 |
| IMP-002 | `d3b4a1e` | `--topic` routed through `safe_filename` before either CLI output path; `--save-csv` now honours `--output-dir` (write at `paper-collector.py:306`, `makedirs` at `:303`) | trap 5 (half), PY-28, PY-29 |
| IMP-003 | `768a5ae` | `paperIndex.manifestPromise` cleared in a `.catch` that rethrows — a rejected manifest is no longer memoized | WEB-01 (half), trap 11 (half) |
| IMP-004 | `468b80d` | `iter_results` surfaces `ArxivError`; the index build hard-fails with exit 1 and writes nothing on any failed category (verified: HTTP 500 → 6 attempts → exit 1 → empty out-dir, ~51 s) | PY-6, trap 3 |
| IMP-005 | `894fb9b` | Component/DOM testing enabled: `jsdom` + `@testing-library/react` + `@testing-library/user-event`, `vite.config.ts` `environment: "jsdom"`, `src/test-setup.ts`, `src/__tests__/domEnvironment.test.tsx` | PE-13 (infrastructure half), INF-08 |
| IMP-007 | `ac1fae2` | "Try again" button on the index-unavailable panel, wired to `refreshManifest` | WEB-26 (half) |
| IMP-008 | `67ee0a4` | Relevance sort agrees with the Relevance chip; `#sort=relevance` without a query self-normalizes to Newest | WEB-29 (half) |
| IMP-009 | `228d48d` | Hash categories validated against the manifest; an unknown category is named and hidden rather than silently emptying the feed | WEB-24 (half) |
| IMP-010 | `42e0edb` | Category selection is reversible and representable: `cat=` empty and absent are distinct; "Select all" and "Reset category filter" both work | WEB-16, WEB-17, WEB-18 |
| IMP-011 | `2e3f6e8` | `localStorage` save failures surface as a `role="alert"` banner instead of a silent optimistic update | WEB-24 (half) |
| IMP-012 | `0ad375c` | `--text-muted` darkened to `#666661` — clears WCAG AA (4.5:1) on `--bg`, `--surface` and `--surface-muted` | WEB-52 (muted-text half) |
| IMP-015 | `ff3f331` | A single failed shard is non-fatal: the feed shows an "incomplete feed" notice and the papers that did load | WEB-13 |
| IMP-016 | `166066d` | Load failure (no shard could be loaded) is distinguished from genuinely-no-papers; the hard-failure panel never claims a window is empty | WEB-14, WEB-15 |
| IMP-017 | `8aceee1` | Raw loader errors replaced with reader-facing copy (`failureCopy.ts`); the partial-shard notice announces "Some papers could not be loaded", not a file name | WEB-19 |
| IMP-018 | `45e24ed` | React `ErrorBoundary` around the app (`ErrorBoundary.tsx`), mounted from `main.tsx` | (new surface — previously unowned) |
| IMP-019 | `8bc73f9` | `Paper` type nullability aligned with the Python producer | WEB-39 (half) |
| IMP-020 | `8801da8` | Retention window made order-independent | PY-5 (half) |
| IMP-021 | `ee95af3` | Index manifest written **before** stale shards are swept, so a crash mid-sweep cannot leave a manifest pointing at deleted files | PY-7 |
| IMP-022 | `298d3b1` | Every flag validated in both scripts: `--retention-days 0`, `--category 'cs.CV foo'`, `--abstract-chars -3`, `--max-papers -1` all exit 2 | PY-1, PY-2, PY-3, PY-4 |
| IMP-023 | `297ed71` | `safe_filename` made a real sanitizer: `MAX_SLUG_BYTES = 200`, `truncate_to_bytes`, `FALLBACK_SLUG`, `WINDOWS_RESERVED_NAMES` | PY-27 |
| IMP-024 | `19f8dbb` | `filter="data"` on `tarfile.extractall` with a hand-rolled, tested fallback for pre-3.8.17 interpreters; members pre-screened so one rejection cannot abort the archive | PY-30 |
| IMP-026 | `2ec06d0` | `npm run build` added to CI's `web-tests` job — a missing asset now fails there first, not only on `main` in `deploy.yml` | INF-01 |
| IMP-031 / IMP-032 | `299d753` | `CONTRIBUTING.md` and `readme.md` rewritten as a **venv-first, root-based** workflow — every documented step exits 0 when executed verbatim in one continuous session, the only `cd web` now comes *after* the Python test step, the non-existent `npm run lint` removed, and no test count hardcoded in prose. Before this, `CONTRIBUTING.md`'s numbered list left the shell inside `web/` when it reached the Python test command, which failed outright | (no §9 row — the defect lived in this profile's own §3.1 prose, corrected there) |
| IMP-033 | `bbe2d18` | `arxiv>=2.1.0,<4` — 4.0.0 removed `Result.download_pdf`/`download_source` and swapped `feedparser` for `lxml`; the bound is a **floor, not the fix** (IMP-093) | INF-06 (half), PY-1 (half) |
| IMP-143 | `5320db6` | `readHash`/`writeHash` moved to `web/src/lib/urlState.ts` with tests (now 50); no behavior change | WEB-37 |
| IMP-151 | `34ea96c` | Prototype-key membership checks replaced with `PROTOTYPE_KEYS` + `hasOwnKey` throughout `collections.ts` | (was WEB-20's sibling route) |
| IMP-154 | `2367a80` | `isPaper` validates `categories` and `published`, not just URLs | WEB-21 (half) |
| IMP-173 | `64bd3f1` | A JSON `null` manifest no longer hangs the app forever | WEB-02 |
| IMP-192 | `2c73ec9` | Order-dependent alert-count flakes fixed: `findByRole("alert")` + `getAllByRole("alert")).toHaveLength(2)` replaced with a settling `waitFor` | (test-quality; see §3.3 caveat) |
| IMP-193 | `5684b1b` | CI generates the paper index (`--category cs.CV --max-per-category 5 --out-dir web/public/data`) before `Build`, so the build gate is no longer green on an empty checkout. **Adds a live network call to `web-tests`** — the timeout this needed is IMP-198, below | INF-16 (half) |
| IMP-198 | `b7e23a8` | **The arXiv client now bounds its own requests.** `DEFAULT_REQUEST_TIMEOUT_SECONDS = 60` at `scripts/arxiv_common.py:19`, installed by `install_request_timeout` (`:48-77`) by swapping `TimeoutSession` in as the class of the library's own `Client._session` — private and version-fragile by construction, and it raises rather than degrades. **Both workflows are capped**: `ci.yml` `web-tests` job 25 min / index step 15 min; `deploy.yml` `build` job 90 min / index step 75 min / `deploy` job 15 min. Measured worst case for one page fetch: **360.06 s** (6 attempts × 60 s). **Read the caveat below before quoting that margin.** | (no §9 row — the stale bullet claiming otherwise is superseded in the notes under this table) |
| IMP-025 | `058acc0` | Non-vacuous test that `--save-csv` writes inside `--output-dir` and never the CWD; `readme.md` note added below the flag table | PY-29 (locked in) |
| REGRESSION-1 | `7a2ed82` | Null-URL papers are no longer dropped on collection import | WEB-20 (half) |
| REGRESSION-3 | `819a6d9` | Duplicate recovery control removed; no save-failure alert on a cold boot with nothing stored | (found by sweep 3) |

**Five things in this table are still worth knowing, and none of them are defects:**
- **`arxiv`'s upper bound (IMP-033) is a floor, not a fix.** `--download-pdfs` / `--download-sources`
  are still written against helpers a future major can remove, and the Python suite cannot detect it
  (it passes on 4.0.1 too). IMP-093 owns the port.
- **`web-tests` performs a live network call** (IMP-193), and it is now bounded — but **read the
  margin honestly.** IMP-198 (`b7e23a8`) added `DEFAULT_REQUEST_TIMEOUT_SECONDS = 60` plus
  `timeout-minutes` on both workflows, and both are real. Two caveats a verifier must not skip:
  **(a) the client caps are 2.5× the measured worst case, and only of the *simple* case.** Both step
  caps are `2.5 × 6 × 60 s` (900 s and 4500 s) — correct for a *total partition*, measured at 360.06 s
  per page fetch with zero inter-retry spacing. **(b) The deploy step's slack is thin.** A deploy
  fetches **38 pages** across the 5 categories at today's volumes (measured from
  `opensearch:totalResults`), the per-page bound is `timeout + delay_seconds = 70 s`, so the compound
  worst case is `38 × 70 + 5 × 360 = 4460 s` against the `4500 s` cap — **40 s of slack**, and
  `70 × P + 1800 ≤ 4500` breaks at **P = 39**, about 9 % arXiv growth in a single window. So do not
  quote "2.5× headroom" for the deploy step; quote 1.009× for the compound case. Backlog:
  **IMP-205** (raise or derive the cap), **IMP-206** (the job-level caps are unpinned by any test).
- **arXiv does not space its retries, and that gap is deliberately left open.** `arxiv` records
  `_last_request_dt` only *after* a successful `get`, so a raising request never engages the
  `delay_seconds` branch: measured attempt offsets were `0/60/120/180/240/300` s with
  `delay_seconds = 10` configured. Patching it with client-side `time.sleep` would change request
  pacing toward arXiv, which is arXiv's terms-of-use decision, so it was left alone — **and that
  judgement is recorded only in a `ci.yml` comment, not at the call site in `scripts/arxiv_common.py`.**
  Do not "fix" it. Backlog: **IMP-208** (document it at the call site and here).
- **The documented Python floor is unenforced.** Both docs say "verified on Python 3.11 and 3.14", but
  `ci.yml:15`, `ci.yml:34` and `deploy.yml:32` all float `python-version: "3.x"`, and `"3.x"` floats
  upward — CI will never exercise the floor. See §3.1. Backlog: **IMP-097**, **IMP-209**.
- **The Python suite's green is version-agnostic.** Every arXiv touch point is a fake, so it cannot
  observe a library API removal.
- **`npm test` runs in fixed order.** A green plain run says nothing about order-independence; use
  `--sequence.shuffle` when you need that claim.

**Not a defect, by design:** the live index emits `http://arxiv.org/abs/…` (`build_index.py:111`),
so `isHttpUrl` accepts `http:` as well as `https:`. An https-only allowlist would strip every card
link. `scripts/paper-collector.py` and `notebooks/paper-collector.ipynb` are separate surfaces —
a fix to one is not a fix to the other (trap 6).

**Still-open halves of "fixed" items** — do not close these early: IMP-019 (`types.ts` is
nullability-aligned, but `isHttpUrl` must keep taking `unknown`; the manifest/TS wire contract is
still hand-mirrored and unvalidated — trap 1), IMP-024 (the pre-3.8.17 fallback still preserves
privileged mode bits and its own test helper's escape scan misses writes outside its tempdir),
IMP-006 (the two-key `localStorage` write is still non-atomic — IMP-011 made it *visible* as a
banner, which is not the same as fixed), IMP-013 (`--border` contrast), and every NB-1…NB-6 notebook
row, none of which any CLI fix touches.
