# Discovered during IMP-031 / IMP-032 — code and config defects not fixed

Found while reconciling `CONTRIBUTING.md` / `readme.md` against the source and the workflows. Every
item below needs a change to a file outside my permitted scope (`scripts/`, `.github/`,
`.gitignore`), so none was fixed. Each is a docs-adjacent truth that a contributor will hit.

**Attempt 2 additions: D-8 (CI never pins the documented Python floor) and D-9 (an uncapped index
build fails against live arXiv).** D-1 through D-7 are carried over from attempt 1 unchanged.

---

## D-8 — CI floats `python-version: "3.x"`, so no documented Python floor is ever tested

**`.github/workflows/ci.yml:15`, `.github/workflows/ci.yml:31`, `.github/workflows/deploy.yml:28`**

```yaml
          python-version: "3.x"
```

This is the finding behind verifier D-3. IMP-031 attempt 1 asserted "**Python 3.11 or newer is
required**" in both docs while every workflow floats `3.x` — a promise to contributors that
nothing in the repository verifies, and one that `3.x` will never catch either, because it floats
*upward* (CI will drift to 3.15/3.16 and never exercise a 3.11 floor).

Attempt 2 chose to soften the docs rather than keep an unenforceable claim: both files now say
"**verified on Python 3.11 and 3.14**", and "**Python 3.10 and newer** can install the
dependencies". That wording is defensible without any workflow change. But it is a workaround, not
a fix, and the fix belongs in the workflows.

**Fix:** pin `python-version` in all three locations — to `"3.11"`, or a matrix
`["3.11", "3.x"]` so the floor *and* the newest interpreter are both covered. Once pinned, the word
"required" becomes earned and the docs can be tightened again.

---

## D-9 — an uncapped `python scripts/build_index.py` fails against live arXiv (HTTP 500 at deep offsets)

**`scripts/arxiv_common.py` paging + `scripts/build_index.py` `collect_papers`**
(reachable from profile rows PY-17 / trap 8)

Attempt 1 documented the bare `python scripts/build_index.py` in the readme Quick Start. Executing
it verbatim fails **2 out of 2 attempts**, deterministically:

```
INFO:root:  6744 papers within retention window for cs.CV
INFO:root:  9730 papers within retention window for cs.LG
INFO:root:  5215 papers within retention window for cs.CL
ERROR:root:  query failed for cs.AI: Page request resulted in HTTP 500
  (…/api/query?search_query=cat%3Acs.AI…&start=10000&max_results=1000)
INFO:root:  3276 papers within retention window for cs.RO
ERROR:root:Refusing to write an index: the arXiv query failed for cs.AI.
EXIT=1
```

**It is arXiv's API, not repo logic** — reproduced with `curl`, no repo code involved:

```
$ curl -s -o /dev/null -w "%{http_code}" "…cat%3Acs.AI…&start=10000&max_results=1000"   -> 500
$ curl -s -o /dev/null -w "%{http_code}" "…cat%3Acs.AI…&start=9000&max_results=1000"    -> 200
$ curl -s -o /dev/null -w "%{http_code}" "…cat%3Acs.AI…&start=0&max_results=1000"       -> 200
```

`cs.AI` has enough 60-day papers that an uncapped run pages past `start=9000`. `DEFAULT_MAX_PER_CATEGORY`
is `0` = no cap, so `iter_results` keeps paging until arXiv 500s; IMP-004's hard-fail then turns
that into exit 1 with **nothing written**. Only `cs.AI` trips it — the other four default
categories complete.

**Impact:** this is not only a docs issue. `deploy.yml` runs the uncapped form, so **the scheduled
deploy is currently failing on the same arXiv-side 500**, and per IMP-004 it now hard-fails rather
than publishing a truncated index. That is the intended fail-loud behaviour, but the index is not
being refreshed.

**Docs workaround applied:** the readme Quick Start now uses
`python scripts/build_index.py --category cs.CV --max-per-category 300` (verified: exit 0, 300
papers, 1.4 s) and explains in prose why the cap matters. `scripts/` was outside my scope, so the
underlying behaviour is unfixed.

**Fix:** treat a mid-paging HTTP 500 as a per-category failure that still writes what it has
(contradicting IMP-004's hard-fail) **or** — better, and cheaper — bound `max_results` so a
category query cannot page past arXiv's deep-offset limit, and add a `--max-per-category` default
for local runs. The `UNLIMITED = 100000` sentinel (PY-17) and `DEFAULT_PAGE_SIZE = 1000`
interaction deserve a look regardless.

---

## D-1 — `paper-collector.py --help` understates `--output-dir` (IMP-002 / IMP-025 residue)

**`scripts/paper-collector.py:203-206`**

```python
parser.add_argument(
    "--output-dir", default="results",
    help="Directory the generated HTML feed is written to (default: results).",
)
```

The behaviour is now: `--save-csv` writes into `--output-dir` too, and `os.makedirs` runs
unconditionally before both writes (`paper-collector.py:303, 306`, fixed by IMP-002 `d3b4a1e` and
locked in by IMP-025 `058acc0`). Only the help string was left behind.

**Verified live:** `--output-dir /tmp/rpf-cli-out --save-csv` put *both*
`cat_cs.CV-2_papers_extracted_on_…html` and `cat_cs.CV_papers.csv` in `/tmp/rpf-cli-out`, with
nothing in the CWD.

**Why the readme table row still says "HTML feed" only:** changing it would make `readme.md`
contradict `--help`, which the profile forbids. The readme instead documents the CSV behaviour in
the prose note under the table. The two surfaces should be reconciled in the *source*, not by
drifting the docs apart.

**Fix:** change the help string to mention the HTML feed and the optional CSV file.

---

## D-2 — `--download-pdfs` / `--download-sources` `--help` omits where files land

**`scripts/paper-collector.py:207-214`**, behaviour at `:239-244`

```python
result.download_pdf(filename=f"{title_slug}.pdf")
result.download_source(filename=f"{title_slug}.tar.gz")
extract_source_archive(f"{title_slug}.tar.gz", f"./extracted/{title_slug}")
```

Bare relative paths — the PDF, the `.tar.gz`, and `./extracted/` all land in the **current working
directory**, not `--output-dir`. Neither `--help` nor the readme's flag table said so until this
change added it to the readme prose note; `--help` is still silent. This is profile row **PY-31**
(also: the `.tar.gz` is never deleted after extraction, so `--download-sources` accumulates
multi-MB archives in the CWD).

**Fix:** state the destination in the help strings, and ideally make the behaviour match
`--output-dir` (PY-31's real fix) and delete the archive after extraction.

---

## D-3 — `deploy.yml` comment contradicts its own cron (INF-02, other half)

**`.github/workflows/deploy.yml:5-6`**

```yaml
    # Rebuild the arXiv index and redeploy every day at 06:00 UTC.
    - cron: "0 6 * * 0"
```

`0 6 * * 0` is **weekly, Sunday 06:00 UTC**, not daily. I corrected the readme half
(`readme.md:147-151`) in this change; the workflow comment is the other half and `.github/` was
both outside my scope and being actively edited by another agent during this work.

**Fix:** either correct the comment to "every Sunday at 06:00 UTC", or — if daily was the
intent — change the cron to `0 6 * * *`. The intent is not recoverable from the file.

---

## D-4 — `.venv/` is not gitignored, so the conventional setup dirties `git status`

**`.gitignore`** (12 lines: `*.ipynb_checkpoints`, `.DS_Store`, `__pycache__/`, `*.pyc`,
`results/*.html`, `results/*.csv`, `!results/.gitkeep`, `web/node_modules/`, `web/dist/`,
`web/public/data/`)

```
$ git check-ignore -v .venv
NOT IGNORED: .venv/ would appear in git status as untracked
```

Profile row **INF-11** also lists `venv/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`,
`.coverage`, `htmlcov/`, `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv` (CWD), `.vscode/`,
`.idea/`, `*.log`.

This matters directly to IMP-031, whose own verification method asserts
`git status --porcelain` is empty. Following the most conventional setup (`python3 -m venv .venv`)
fails that check. I worked around it in documentation — both files state the caveat and offer
`python3 -m venv ../research-paper-feed-venv` — but the durable fix is a `.gitignore` entry.

**Fix:** add the INF-11 list to `.gitignore`.

---

## D-5 — no declared Python floor anywhere in the repo, while the deps impose one

There is no `pyproject.toml`, no `setup.cfg`, no `python_requires`, and no CI matrix — `ci.yml:15`
and `:30` both use a floating `python-version: "3.x"`. Nothing in the repo states a minimum.

The effective floor is real and was measured:

| Interpreter | `arxiv` | `pandas` |
| --- | --- | --- |
| 3.11.8 | 3.0.0 — `Requires-Python: >=3.10` | 3.0.6 — `>=3.11` |
| 3.14.3 | 3.0.0 — `Requires-Python: >=3.10` | 3.0.6 — `>=3.11` |

`pandas>=2.0.0` is unbounded and resolves to a 3.x that requires 3.11, with no lockfile to hold it
lower — but 3.10 is *not* excluded: pip backtracks `pandas` to 2.3.x there, and the verifier
measured that set green. So the honest statement is "**3.10+ can install; verified on 3.11 and
3.14**", which is what the docs now say. The gap is that nothing *declares* it: attempt 1 over-claimed
"3.11 or newer is required", attempt 2 under-claims only in the sense that no artifact enforces it.
See **D-8** for the workflow half.

The durable fix is a declared floor plus a lockfile or a `pandas` upper bound, so the floor cannot
drift upward on its own. Profile rows **INF-05** (no `pyproject.toml`) and **INF-06**'s "still no
lockfile" half.

---

## D-6 — no declared Node version, while CI pins Node 20

**`web/package.json`** has no `engines` field, and there is no `.nvmrc` (profile **INF-19**).
Node 20 is pinned only inside the workflows (`ci.yml:36`), and `jsdom@29` is newer than Node 20's
GA window, so a clean `npm ci` on Node 20 can emit `EBADENGINE` warnings with no `engine-strict`
to make them fatal.

IMP-032's acceptance criteria require `CONTRIBUTING.md` to document `npm ci`; it does, but a
contributor on Node 18 or 24 gets no signal about which version this project expects.

**Fix:** add `"engines": { "node": ">=20" }` to `web/package.json`, or commit a `.nvmrc`.

---

## D-7 — `readme.md` still advertises the notebook as "the same workflow" (INF-12)

**`readme.md:138-143`**

> A Jupyter notebook version of the same workflow is available at
> `notebooks/paper-collector.ipynb` …

It is a divergent pre-`arxiv_common` fork, and materially differs: `arxiv.Search()` without
`max_results` (silently caps at 100, so `MAX_PAPERS_TO_PULL = 1000` is unreachable — profile NB-1),
no `html.escape` (live XSS in generated output — NB-2), MathJax over plain `http://` (NB-3), a bare
`input()` that kills `nbconvert --execute` (NB-4), and no `os.makedirs("results/")` (NB-5).

Left alone deliberately: it is outside IMP-031/IMP-032's scope, and a correct fix needs
substantive rewording about what the notebook actually does rather than a one-word patch. Half-fixing
it would be worse than leaving the profile row to own it.