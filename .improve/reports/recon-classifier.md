# Recon Report: Classifier

Repo: `/Users/denimpatel/Desktop/git/research-paper-feed`
Date: 2026-10-02
Method: read `readme.md`, `CONTRIBUTING.md`, `LICENSE` (header), `requirements.txt`,
`web/package.json`, both GitHub workflows, full file tree, script docstrings, notebook
cells, web `src` layout, and git history/tracked-file list.

---

## 1. Repo type(s)

Three co-located deliverables, in decreasing order of current importance:

1. **Static web app (SPA)** — a client-only React + TypeScript app deployed to GitHub
   Pages. No server, no runtime API calls. This is the primary artifact: the live
   site is the README's headline.
2. **Batch data pipeline / ETL job (Python)** — `scripts/build_index.py` queries the
   arXiv API, dedupes cross-listed papers, truncates abstracts, and emits a sharded
   JSON index. It is the only thing that touches the network, and it runs in CI.
3. **CLI utility tool (Python)** — `scripts/paper-collector.py`, an older one-shot
   tool that queries arXiv with a user-supplied topic and writes a static HTML dump
   into `results/`. Explicitly framed as "remains supported" and "independent of the
   web app" — legacy but not deprecated.

Not ML in the modeling sense. It is a *research-paper aggregator*, adjacent to the
ML/CV field rather than an ML pipeline. No training, inference, or model artifacts.

## 2. Primary purpose

An interactive, browser-side feed of recent arXiv papers in `cs.CV`, `cs.LG`, `cs.CL`,
`cs.AI`,
and `cs.RO`, searchable across title/abstract/author with phrase support, filterable by
category and recency window, sortable by date or relevance, and supporting
browser-local
named collections with JSON export/import. A scheduled GitHub Action rebuilds a
sharded
JSON index of a rolling 60-day window each day and redeploys the static site, so the
browser fetches only the week shards it needs.

A secondary purpose is the personal-use CLI: point it at an arbitrary arXiv query and
get a
self-contained HTML feed, optionally with PDFs, LaTeX sources, or CSV.

Scope is explicitly bounded in the README: "Downloading PDFs or extracting figures is
intentionally out of scope" for the web feed. All metadata links out to arXiv rather
than being mirrored.

## 3. Primary audience

Two audiences, in this order:

- **Readers / site visitors** — the primary consumer is a researcher, grad student, or
  ML engineer who wants a low-friction way to browse recent arXiv papers in their area.
  The README is written to them: screenshots, feature bullets, a one-line description
  of the recency window and `localStorage` behavior, out-of-scope disclaimers.
- **The owner as a contributor** — `CONTRIBUTING.md` is a short, conventional
  fork-and-PR document (open an issue for major changes, add tests, wait for CI). It
  presupposes a single-maintainer project and does not describe an external
  contributor onboarding path. No code of conduct, no issue/PR templates, no
  changelog, no release process.

Third-tier audience: anyone who wants to reuse the `build_index.py` pipeline. The
script docstrings are written for that reader (they explain *why* helpers are pure and
network-free specifically so they are testable).

## 4. Maturity: early, trending toward maintained

Evidence for "not a prototype":
- CI on both stacks (`python -m unittest discover -s tests`; `tsc --noEmit` + `vitest`).
- Real tests: 3 Python test files (410 lines) and 3 vitest files (629 lines) covering
  pure logic — dedup, abstract truncation, shard boundaries, search ranking, index
  loading, collection persistence.
- Strict TypeScript (`strict`, `noUnusedLocals`, `noUnusedParameters`,
  `noFallthroughCasesInSwitch`).
- Deliberate error handling and typed domain errors (`IndexUnavailableError` with
  `cause`), loading progress, and a user-facing "no paper index yet" state rather than a
  blank screen.
- Generated artifacts properly gitignored (`web/public/data/`, `results/*.html`,
  `results/*.csv`, `__pycache__/`); a prior commit removed large committed sample
  output.
- Conventional-commit history and PRs (`fix:`, `feat:`, `refactor:`, `docs:`, `ci:`).
- Docs match reality: README commands and flags line up with the actual argparse flags
  and npm scripts.

Evidence for "early":
- 25 commits total, 16 authored by `Claude` and 9 by the owner. Most of the history is
  a single recent consolidation burst (cleanup, tests, CI, then the whole web app in
  `#2`, a bug fix in `#3`, a restyle in `#4`).
- `paper-collector.py` imports `arxiv` and `pandas` directly while `arxiv_common.py`
  exists to centralize exactly that — mild duplication left behind by the refactor.
- `notebooks/paper-collector.ipynb` still has `import numpy as np` and a top-level
  `temp = ` fragment; it is a scratch artifact from the original 2023 script and is not
  maintained in step with `scripts/`.
- No issue/PR templates, no CODEOWNERS, no dependency pinning beyond floors
  (`>=`, not `~=`/lock-driven for Python), no Python version constraint file.
- Zero external contributors or stars signal; no release tags.
- Repo history spans 2023-07 to 2026-09 but all substantive work is recent, consistent
  with a weekend-scale modernization of a 2023 script.

Verdict: **early-stage but actively maintained**, with the practices of a small
maintained OSS project. The web app is young but competently built.

## 5. Languages, frameworks, dependencies

**Python 3.x** — `requirements.txt`, two deps only:
- `arxiv>=2.1.0` — official arXiv API client; paging, rate-limit delay, retries, sort
  criteria. Used by both scripts.
- `pandas>=2.0.0` — DataFrame construction plus CSV export in `paper-collector.py`.
  Not used by the index builder.

Stdlib used heavily: `argparse`, `json`, `logging`, `re`, `datetime`, `os`, `sys`,
`tarfile` (LaTeX source extraction), `html`.

**TypeScript / JavaScript** — `web/package.json`:
- `react`, `react-dom` `^18.3.1` — the only runtime dependencies. Notably no router
  library, no state library, no CSS framework; routing is a hand-rolled
  `location.hash` parser (`readHash` in `App.tsx`) and state is `useReducer`.
- `vite` `^5.4.11` + `@vitejs/plugin-react` — dev server and production bundling. Vite
  `base: "/research-paper-feed/"` encodes the Pages subpath.
- `typescript` `^5.6.3` — typecheck-only (`noEmit`), no emitted JS.
- `vitest` `^2.1.8` — unit tests, `environment: "node"` (the tested layer is pure logic;
  no DOM/component testing library is installed).
- `@types/react`, `@types/react-dom`.

No ESLint or Prettier config in the repo. Formatting is enforced only by human habit.

**Jupyter notebook** — `notebooks/paper-collector.ipynb`, 9 cells, `arxiv` + `pandas` +
`numpy`. A didactic/legacy alternative to the CLI, not part of CI.

**CI/CD** — `actions/checkout@v4`, `setup-python@v5`, `setup-node@v4` (Node 20, npm
cache keyed on `web/package-lock.json`), `configure-pages@v5`,
`upload-pages-artifact@v3`, `deploy-pages@v4`. Standard current major versions.

## 6. Repo layout map

```
.github/workflows/    ci.yml (unit tests, both stacks) · deploy.yml (index build +
                      vite build → GitHub Pages; cron, push to main, dispatch)
images/               feed_example.png — README screenshot only
notebooks/            paper-collector.ipynb — legacy/educational notebook version
results/              CLI HTML+CSV output. Gitignored except .gitkeep; empty in tree
scripts/              Python
  arxiv_common.py     (59)   shared arXiv client + result iteration; rate-limit/retry
                             policy in one place
  build_index.py      (309)  scheduled index builder → web/public/data/. Pure helpers
                             (truncate, dedup, shard, author format) + one networked
                             function
  paper-collector.py  (149)  one-shot CLI → results/*.html; optional PDFs, tarballs, CSV
tests/                3 unittest files (410 lines) mirroring scripts/ 1:1
web/                  the React app (self-contained, own .gitignore)
  index.html          Vite entry
  vite.config.ts      base path, react plugin, vitest node env
  tsconfig.json       strict, noEmit
  public/favicon.svg
  public/data/        generated index (gitignored; built in CI or locally)
  src/App.tsx         (458)  main shell: hash routing, fetch orchestration,
                             pagination (50/page), search/filter/sort wiring
  src/components/     CollectionsView (254) · FeedControls (113) ·
                      PaperCard (173) · PaperList (67)
  src/lib/            collections.ts (293, localStorage + JSON import/export),
                      paperIndex.ts (164, manifest + shard fetching),
                      search.ts (91, tokenize/rank/score), types.ts (40)
  src/lib/__tests__/  3 vitest files (629 lines) mirroring lib/ 1:1
readme.md             user-facing docs, feature list, local dev, CLI flag table,
                      deployment notes, one-time Pages setup caveat
CONTRIBUTING.md       fork/PR/issues
requirements.txt      arxiv, pandas (floors only)
```

Layout signal: the repo is **two projects sharing one repo** — a root-level Python
project and a nested `web/` JS project with its own manifest, lockfile, tsconfig, and
gitignore. Neither half imports the other; the only coupling is that `build_index.py`
writes into `web/public/data` via `DEFAULT_OUT_DIR`.

Tests mirror source 1:1 on both stacks, which is a deliberate and good convention.

## 7. Signals of intent

- **Naming.** `build_index.py` vs `paper-collector.py` (hyphen, not underscore) reflects
  different generations: the hyphenated name is the original 2023 CLI, the underscore
  names are the refactored/newer code. `arxiv_common.py` signals a conscious decision to
  share client setup — its docstring explicitly justifies the split on testability and
  rate-limit-consistency grounds.
- **README framing.** User-first, not contributor-first. It opens with the live site,
  has no "architecture" or "design" section, and spends more words on search semantics
  than on the pipeline. The one-time Pages-source caveat is called out as a blockquote
  because it is the single most likely failure for a fork.
- **Deployment intent.** Explicitly static: "there is no server and no runtime arXiv
  calls." The design goal is that arXiv load happens once per day in CI and the browser
  stays cheap. `deploy.yml` was tuned once already (`44e8fdd Update cron schedule`,
  currently weekly-on-Sunday 06:00 UTC despite a comment saying "every day" — a real
  comment/code drift).
- **Progressive enhancement.** The app renders and explains itself when no index exists,
  so `npm run dev` works without a network build. This is a deliberate contributor-experience
  choice.
- **Bounded scope.** The README states what is *not* doing (PDFs, figures). Saved papers
  store a full metadata snapshot "so a collection keeps working after the paper ages out
  of the index" — a forward-thinking choice that acknowledges the 60-day window is finite.
- **LLM-assisted history.** 16 of 25 commits are authored by `Claude`, and the recent
  commits read as a structured improvement pass (cleanup → tests → CI → feature → fix →
  restyle). Quality is high and conventions are consistent, which is itself evidence
  that the conventions are documented well enough to follow.
- **Styling.** The most recent commit restyled the feed to match a personal design
  system (`denimpatel.github.io`), i.e. the site is a personal research tool with a
  personal brand, not a generic OSS project.
- **No roadmap, no issues template, no releases.** The project reads as actively
  maintained for one person's use with contributors welcome but not actively recruited.

## 8. Friction points worth flagging for later passes

- `.DS_Store` is present in the working tree though gitignored (not committed).
- `scripts/__pycache__/` and `tests/__pycache__/` exist on disk with `cpython-314`
  artifacts; gitignored, so harmless but indicates Python 3.14 locally.
- `web/dist/` exists on disk and is committed-adjacent but gitignored — no, confirmed
  not tracked (`git ls-files` shows no `web/dist`). Good.
- `deploy.yml` comment says "every day" but the cron is `"0 6 * * 0"` (weekly).
- `paper-collector.py` duplicates the `arxiv` import and client construction that
  `arxiv_common.py` was created to centralize.
- `notebooks/paper-collector.ipynb` has an unused `numpy` import and a truncated
  `temp =` line; drifts from `scripts/`.
- `requirements.txt` uses open-ended floors with no upper bounds and no lockfile; CI
  therefore resolves against whatever is newest on each run.
- No lint/format tooling for either language.
