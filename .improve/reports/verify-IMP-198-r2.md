# Verify IMP-198 (retry 2) — re-verification of the internal-inconsistency fix

**Verified 2026-10-02.** Independent skeptical verifier. **No source file was modified**; the only
file written is this report. All probes live in `/tmp/v198r2`. Interpreter
`/usr/local/bin/python3.11` (3.11.8), `arxiv 2.1.3`, `requests 2.32.3` — the system interpreter,
not a venv, and the numbers below were reproduced from scratch rather than taken from
`.improve/reports/impl-IMP-198.md`. `readme.md` and `CONTRIBUTING.md` were ignored (another
agent's). `.kilo/worktrees/mildly-income` was never read. No git write command was run; nothing was
pushed or committed.

## VERDICT: **PASS** — 9/9 criteria met; 5 non-blocking findings

---

## 0. Summary

| # | Check | Result |
| --- | --- | --- |
| 1 | Worst case re-derived from the real config | **CONFIRMED** — 6 attempts × 60 s; measured **360.06 s** (retry claimed 360.08 s) |
| 2 | Every cap in **both** files > the worst case | **CONFIRMED** — 900 s vs 360.06 s; 4500 s vs 1800.3 s; all three job caps larger still |
| 3 | Caps are real bounds, not rubber stamps | **CONFIRMED** — 15 < 25 and 75 < 90; 4.8× / 4.0× tighter than GitHub's 360-min default; happy path measured 0.49 s |
| 4 | 2.5× margin defensible, not arbitrary | **DEFENSIBLE** for the failure path (case A). One quantified caveat → **F-1** |
| 5 | Deploy step's worst case fits in 75 min | **FITS** — 1800.3 s (case A) / 4460 s (case B, real page counts) vs 4500 s → **F-1** |
| 6 | I-4: `deploy.yml` capped, right granularity, nothing disturbed | **CONFIRMED** — `+25 / −0`, byte-identical otherwise, `cancel-in-progress: false` intact |
| 7 | I-2: the 60 s value pinned | **CONFIRMED** — 60→600, 60→5, 60→59, 60→30 all **CAUGHT ×3**; fast (0.000 s) and hermetic (0 sockets) |
| 8 | IMP-004 / IMP-020 not regressed | **CONFIRMED** — exit 1, nothing written, message names all 5 categories, measured live; 13 targeted tests OK |
| 9 | `delay_seconds` / `num_retries` untouched, no client-side sleeps | **CONFIRMED** — both are context lines in the diff; pacing still observed live (10.2 s between requests) |
| 10 | No test weakened / skipped / deleted | **CONFIRMED** — 0 deletions, 0 skips added, 0 test names removed; 78 → 86 → 89 |
| 11 | Both YAMLs parse, keys resolve | **CONFIRMED** — all five caps resolve at the right level |
| 12 | Out-of-scope items reported, not silently fixed | **CONFIRMED** — §8 |

---

## 1. THE MATH — derived independently from the real config

### 1.1 The inputs, read from source

`scripts/arxiv_common.py:16-19`:

```
DEFAULT_PAGE_SIZE = 1000
DEFAULT_DELAY_SECONDS = 10
DEFAULT_NUM_RETRIES = 5
DEFAULT_REQUEST_TIMEOUT_SECONDS = 60
```

`build_client` (`:82-87`) passes `num_retries=DEFAULT_NUM_RETRIES` to `arxiv.Client`, so the
retry budget is **5**, and `page_size = max(1, min(1000, max_results))`.

`inspect.getsource(arxiv.Client._parse_feed)` on the installed **2.1.3** (not from memory):

```python
except (HTTPError, UnexpectedEmptyPageError, requests.exceptions.ConnectionError) as err:
    if _try_index < self.num_retries:
        return self._parse_feed(url, first_page=first_page, _try_index=_try_index + 1)
```

`_try_index` runs 0…5 ⇒ **6 attempts**. Exception MROs, printed:

```
ConnectTimeout ['ConnectTimeout','ConnectionError','Timeout','RequestException','OSError',...]  -> retried
ReadTimeout    ['ReadTimeout','Timeout','RequestException','OSError',...]                      -> NOT retried
```

And `Client._Client__try_parse_feed` in 2.1.3:

```python
if self._last_request_dt is not None:            # pacing branch
    ...time.sleep(to_sleep)
resp = self._session.get(url, headers={"user-agent": "arxiv.py/2.1.3"})
self._last_request_dt = datetime.now()          # assigned ONLY after a successful get
```

A request that raises never reaches that assignment, so `_last_request_dt` stays `None` and the
`delay_seconds` branch is skipped on **every** retry. **The retries are not spaced.** The upstream
retry-pacing gap is real, pre-existing, and correctly left unfixed.

### 1.2 Measured, at the shipped 60 s default

`/tmp/v198r2/connect_probe.py 60` — drives the repo's own `build_client()` at RFC 5737 TEST-NET-1
(`192.0.2.1`, unroutable, SYN dropped — verified with a raw `socket.connect` that times out), and
counts real `HTTPAdapter.send` calls:

```
timeout                : 60.0 s
num_retries            : 5   delay_seconds: 10
session class          : TimeoutSession
HTTPAdapter.send calls : 6
attempt offsets        : [0.0, 60.0, 120.0, 180.0, 240.1, 300.1]
elapsed                : 360.06 s
ratio to per-req timeout: 6.00x
error                  : ConnectTimeout: ... (connect timeout=60.0)
```

**The retry's 360.08 s is reproduced (I measured 360.06 s; both are 6.00×, i.e. zero pacing).**
Offsets are exactly one per-request timeout apart with `delay_seconds = 10` configured and never
applied. Scaled cross-check at `timeout=5`: 6 attempts, offsets `0/5/10/15/20/25`, elapsed
**30.03 s = 6.01×**.

Read path, shipped 60 s, through the real `main()` (`/tmp/v198r2/blackhole.py read 60`):

```
main() returned      : 1        out-dir created : False
connections accepted : 5        (one per category; every log line shows "try: 0")
elapsed              : 300.05 s (5 x 60.01 s)
error                : ReadTimeout ... (read timeout=60)
```

So the AC3 case the spec named costs **60.01 s**, one connection, and is never retried.

**Worst case = 360.0–360.08 s for one page fetch.** Every timeout in the repo must exceed it.

### 1.3 Timeout value table — every cap in both files

| where | line | value | seconds | governing worst case | × worst case | real bound? |
| --- | --- | --- | --- | --- | --- | --- |
| `ci.yml` `web-tests` job | `:26` | 25 | 1500 | step 900 + ~120 of other steps | 4.17× the 360 s page | yes (600 s spare vs ~120 s measured CI overhead) |
| `ci.yml` `Build the paper index` step | `:65` | 15 | 900 | **360.06 s** (measured) | **2.4993×** | yes — 15 < 25; ~1800× the 0.49 s happy path |
| `deploy.yml` `build` job | `:26` | 90 | 5400 | step 4500 + ~120 | 15.0× | yes — 75 < 90; 4.0× tighter than the 360-min default |
| `deploy.yml` `Build the paper index` step | `:54` | 75 | 4500 | **1800.3 s** (case A, measured) | **2.4993×** | yes — 4.8× tighter than the 360-min default |
| `deploy.yml` `deploy` job | `:83` | 15 | 900 | n/a (deploy-pages) | — | yes — `deploy-pages` takes tens of s; with `cancel-in-progress: false` a wedge would block every later deploy |

Old values: `ci.yml` job 10 → **25**, `ci.yml` step 5 → **15**; `deploy.yml` had **no** cap at any
level → 90 / 75 / 15. I-1 and I-4 are both genuinely closed, not papered over.

**Is each cap longer than the worst case? Yes, for every one of the five**, by 2.5× at the step
level and more at the job level. **Is each a real bound? Yes** — every step cap sits strictly inside
its job cap, and the whole set is 4.0–4.8× tighter than GitHub's 360-minute default. A 75-minute
cap that no legitimate run can approach is still a bound: the deploy step's *measured* healthy cost
is dominated by 5 category queries at ~0.2–0.8 s each, and the 60-day index it builds is ~2,800
papers.

### 1.4 Does the deploy step's worst case fit inside 75 minutes? — Yes, twice over

A deploy runs `python scripts/build_index.py` with `--max-per-category` unset ⇒
`limit = UNLIMITED = 100000` (`build_index.py:45`), `page_size = 1000`, all
**5** `DEFAULT_CATEGORIES` (`build_index.py:32`), and `collect_papers` records a failed category
and moves on (`:268-273`), so a partition costs one worst-case page fetch per category.

**Real page counts, measured** (`/tmp/v198r2/page_count.py`, one live API request per category,
`opensearch totalResults` for a `submittedDate`-ranged query over the 60-day retention window —
`assume_newest_first=True` stops paging at the first out-of-window record, so pages per category =
papers-in-window / 1000):

| category | papers in 60 d | pages @ 1000 |
| --- | --- | --- |
| cs.CV | 6,742 | 7 |
| cs.LG | 9,723 | 10 |
| cs.CL | 5,213 | 6 |
| cs.AI | 10,785 | 11 |
| cs.RO | 3,275 | 4 |
| **total** | 35,738 | **38** |

| case | computation | seconds | vs 4500 s cap |
| --- | --- | --- | --- |
| **A. total partition** (the case the cap exists for) | 5 × 6 × 60 s | **1800.3 s = 30.0 min** | **2.50× headroom** |
| **C. pages at the measured ~1 s, then the query hangs** | Σ(pages×11 s) + 5×360 s | **2218 s = 37.0 min** | 2.03× headroom |
| **B. every page burns its full 60 s bound, then the query hangs** | Σ(pages×70 s) + 5×360 s | **4460 s = 74.3 min** | **1.009× — 40 s spare** → F-1 |

Case B is the compound pathological case: it needs every one of the 38 pages to take the *entire*
60 s client bound and still succeed (a slow-loris or a ~30 kB/s link), and then the query to hang.
It **still fits today, by 40 s**, so it is not a FAIL — but see **F-1**: the 2.5× headline margin is
2.5× of case A only, and the compound case is at 99.1 % of the cap.

### 1.5 Is the 2.5× margin defensible, or arbitrary? — Defensible

- It is **stated, uniform and reproducible**: both step caps are `2.5 × (num_retries+1) × timeout`
  (900 s and 4500 s), and both YAML comments carry the arithmetic a reader can re-derive from
  `arxiv_common.py:18-19`. The same factor is asserted in test code
  (`worst_case = 360`, `1800`), so the margin is not just prose.
- It is **not arbitrary in the sense of round-number inflation**: 900 s is 2.5× of 360 s and 4500 s
  is 2.5× of 1800 s, and the *tests* enforce "strictly greater than the worst case" rather than
  "equal to 2.5×", so the safety property does not depend on the chosen factor.
- It is **defensible as a backstop, not a flake guard**: the cap's remaining job is the slow-drip
  case a float `requests` timeout cannot bound (per socket op, not per request), and the happy path
  is 1800× under the cap, so the margin costs nothing in reliability.
- Where I **disagree** with the report's framing: the justification bullet *"A step can exceed one
  page fetch even on the CI step … a realistic mixed worst case is ≈ 430 s, not 360 s"* applies to
  the CI step (1 page) and is fine, but the deploy step's equivalent is not 2.5×1800 s — it is
  2.48× of the 4460 s compound case. That is F-1, a documentation/robustness gap, not a wrong cap.

---

## 2. I-4 — `deploy.yml`, read in full and diffed line by line

`git --no-pager diff -- .github/workflows/deploy.yml` → **`25 +++++ / 0 −`**, and
`git diff -U0 -- .github/workflows/ | grep -c '^-[^-]'` → **0** across both workflow files.
Every change is an addition; no existing line was modified or removed.

The three additions, at the right granularity:

```yaml
  build:
    runs-on: ubuntu-latest
+    # Job-wide backstop. The index step below may use up 75 of these, …
+    timeout-minutes: 90
    steps:
      …
      - name: Build the paper index
+        # … 5 categories x (num_retries 5 + 1) x 60 s = 1800 s …
+        timeout-minutes: 75
        run: python scripts/build_index.py
  deploy:
    needs: build
    runs-on: ubuntu-latest
+    timeout-minutes: 15
```

Verified undisturbed (`yaml.safe_load` + diff, not eyeballing):

| aspect | value now | status |
| --- | --- | --- |
| triggers | `{schedule: [{cron: "0 6 * * 0"}], push: {branches: [main]}, workflow_dispatch}` | unchanged |
| `permissions` | `{contents: read, pages: write, id-token: write}` | unchanged |
| `concurrency` | `{group: pages, cancel-in-progress: False}` | **intact** |
| `deploy.needs` | `build` | unchanged |
| `build` steps, in order | `checkout@v4`, `setup-python@v5`, `Install Python dependencies`, `Build the paper index`, `setup-node@v4` (node 20, cache npm), `Install web dependencies`, `Build the web app`, `configure-pages@v5`, `upload-pages-artifact@v3` (path `web/dist`) | 9 steps, original names/`uses`/`with`/order |
| `deploy` job | `environment: {name: github-pages, url: ${{…page_url}}}`, step `id: deployment` `uses: actions/deploy-pages@v4` | unchanged |
| `continue-on-error` / `\|\| true` | none anywhere | none introduced |

No action version was bumped, no `uses:` touched, no `with:` changed. The `timeout-minutes` key is
the real one at both levels (`jobs.<id>.timeout-minutes`, `jobs.<id>.steps[*].timeout-minutes`; the
step cap is a sibling of `run:` inside the same mapping, which is where the deploy test looks for
it). **I-4 is closed.**

---

## 3. I-2 — are the values pinned now? — Yes; my own mutation matrix

My own scratch trees under `/tmp/v198r2/mut` (`scripts/`, `tests/`, `.github/` copied; **the repo
was only read**), one edit per tree, `python -m unittest discover -s tests` in each. Baseline
`Ran 89 … OK`.

| mutant | verdict | caught by |
| --- | --- | --- |
| **M9** `DEFAULT_REQUEST_TIMEOUT_SECONDS` 60 → **600** (the verifier's I-2) | **CAUGHT ×3** | pin + `worst_case == 360` + deploy worst case |
| **M10** 60 → **5** (the verifier's I-2) | **CAUGHT ×3** | same three |
| M19 60 → 59 | **CAUGHT ×3** | same three |
| M20 60 → 30 | **CAUGHT ×3** | same three |
| M11 `num_retries` 5 → 2 | **CAUGHT ×3** | pacing pin + both timeout tests |
| M24 `num_retries` 5 → 10 | **CAUGHT ×3** | same |
| **M13** `ci.yml` index step 15 → **5** (the original I-1 defect, replayed) | **CAUGHT** | `test_no_workflow_cap_is_tighter_than_the_client_worst_case` |
| M25 `ci.yml` index step 15 → 6 (exactly 360 s) | **CAUGHT** | same — `assertGreater`, so equal fails |
| M15 `deploy.yml` index step 75 → 30 | **CAUGHT** | `test_the_index_step_outlasts_a_whole_pipeline_failure` |
| M17 `deploy.yml` index-step cap deleted | **CAUGHT** | same |
| M30 `deploy.yml` `deploy` job 15 → 5 | **CAUGHT** | workflow cap test |
| M21 `ci.yml` job 25 → 5 | **CAUGHT** | workflow cap test (a *job* cap below 360 s is caught too) |
| M31/M32 `DEFAULT_CATEGORIES` 5 → 4 / 6 (**cross-file**) | **CAUGHT** | deploy test's `assertEqual(worst_case, 1800)` |
| M14 `ci.yml` step 15 → 10 | *survives* | not a defect: 600 s still exceeds 360 s, so IMP-004 still reports |
| M27 `deploy.yml` step 75 → 31 | *survives* | not a defect: 1860 s still exceeds 1800.3 s |
| **M16** rename `timeout-minutes:` → `timeout:` on the **ci step only** | *survives* | see **F-2** — the implementer reported M16 as CAUGHT |
| **M26** delete the **ci.yml index step** cap | *survives* | see **F-2** |
| M22 delete the `ci.yml` job cap | *survives* | step cap still holds; the step is the unit that matters |
| **M28** `deploy.yml` `build` job 90 → 20 | *survives* | see **F-3** (the implementer's M18) |
| M29 delete both `deploy.yml` job caps | *survives* | step cap still holds |

**I-2 is genuinely fixed**: the two mutants the previous verifier flagged (60→600, 60→5) are now
each caught three times over, and so is every other mutation of the value, of `num_retries`, of
either step cap, and of the cross-file category count.

**Are the 3 new tests fast?** Yes — the three run in **`0.000 s`** (`real 0.51 s` wall including
interpreter start); the whole suite is `Ran 89 tests in 1.090 s`, and the only test above 12 ms is
the pre-existing loopback black-hole test.

**Are they hermetic?** Yes — with `socket.connect`, `socket.create_connection` and
`socket.getaddrinfo` all replaced by a raiser (`/tmp/v198r2/hermetic.py`), the three new tests
report `ran=3 failures=0 errors=0 blocked_calls=0` — they open two repo files and assert constants.
The whole suite under the same block: `ran=89 failures=1 errors=0` — the single failure is the
pre-existing `BlackHoleRequestTests`, which binds `127.0.0.1:0` on purpose (accepted in round 1).
Neither new test imports PyYAML, so the CI dependency set (`requirements.txt` only) is enough.

---

## 4. No regression on the landed Python items

**Full suite:** `Ran 89 tests in 1.090 s / OK`. Baseline at HEAD, in a throwaway `git archive`
tree: `Ran 78 tests / OK` ⇒ 78 + 8 (round 1) + 3 (this round) = 89, arithmetically consistent.

**IMP-004 (hard-fail: exit 1, write nothing, readable message) — reproduced live.** Loopback black
hole, real `build_index.main()`, 2 s timeout (`/tmp/v198r2/blackhole.py hardfail 2`):

```
main() returned      : 1        out-dir created : False
connections accepted : 5        elapsed : 10.03 s
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO.
```

and at the shipped 60 s default, the same probe: `rc=1`, no out-dir, 5 connections,
**300.05 s = 5 × 60.01 s**, same message. And the happy path still writes
(`build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/v198r2/smoke` → `real 0.49`,
exit 0, `index.json` 287 B + `papers-2026-W40.json` 4586 B, `totalPapers 5`), so the refusal is a
failure path, not a blanket refusal.

**IMP-020 (order-independent retention) — intact.** `MainTests`, `CollectPapersRetentionTests`,
`BuildShardsTests`, `DeployStepTimeoutTests` → `Ran 13 tests in 0.004 s / OK`.
`scripts/build_index.py` is **unmodified** in this diff (`git diff --numstat -- scripts/` shows
only `arxiv_common.py`), so the retention filter and the one-record-at-a-time enforcement are
byte-identical to the verified baseline.

---

## 5. Pacing and retries were not "fixed" by adding sleeps — confirmed

`git --no-pager diff -- scripts/arxiv_common.py` shows `DEFAULT_DELAY_SECONDS = 10` and
`DEFAULT_NUM_RETRIES = 5` as **context lines, not `+`/`-` lines** — the only constant added is
`DEFAULT_REQUEST_TIMEOUT_SECONDS = 60`. There is no `time.sleep`, no retry decorator and no
client-side pacing added anywhere in `scripts/` (grep: `time.sleep` appears only inside the
`arxiv` package, and the diff of `iter_results` adds one exception type and comments). Pacing is
still applied by the library on the happy path: my live page-count probe logged **10.2 s** between
successive category requests, and the log line `INFO:arxiv:Sleeping: …` behaviour is untouched.

The upstream gap (arXiv records `_last_request_dt` only after a *successful* `get`, so a raising
request never engages `delay_seconds`) is **pre-existing**, is correctly reported and **not**
silenced with client-side sleeps. That was the right call: adding sleeps would change request
pacing toward arXiv, which is their terms-of-use decision, not this item's. It remains a real,
unfiled question for the orchestrator (the new timeout makes each attempt *terminate* sooner, so
the retries get denser, not sparser).

---

## 6. No test was weakened, skipped, or deleted

```
$ git diff --numstat -- tests/
283   0   tests/test_arxiv_common.py
 66   0   tests/test_build_index.py
$ git diff -U0 -- tests/ | grep -c '^-[^-]'          -> 0
$ git diff -U0 -- tests/ | grep -E '^\+.*(skipTest|@unittest\.skip|expectedFailure)'  -> none
```

`def test_*` names, HEAD vs working tree (programmatic diff):

| file | HEAD | worktree | removed | added |
| --- | --- | --- | --- | --- |
| `test_arxiv_common.py` | 8 | 18 | **none** | 10 (8 from round 1 + `test_the_request_timeout_value_is_pinned`, `test_no_workflow_cap_is_tighter_than_the_client_worst_case`) |
| `test_build_index.py` | 42 | 43 | **none** | 1 (`test_the_index_step_outlasts_a_whole_pipeline_failure`) |
| `test_paper_collector.py` | 28 | 28 | **none** | 0 |

All **86** tests present when this retry started survive under the same names, alongside the 3 new
ones. No duplicate names. The one pre-existing `skipTest` (`test_paper_collector.py`) is untouched.

---

## 7. YAML validation

`yaml.safe_load` (PyYAML 6.0.1) on both files — both parse; every key resolves at the level the
schema defines:

```
ci.yml    PARSED OK   job python-tests  timeout-minutes=None
                    job web-tests     timeout-minutes=25
                        step Build the paper index   timeout-minutes=15  (=900s)
deploy.yml PARSED OK  job build         timeout-minutes=90
                        step Build the paper index   timeout-minutes=75  (=4500s)
                    job deploy        timeout-minutes=15
                    triggers {schedule cron "0 6 * * 0", push main, workflow_dispatch}
                    concurrency {'group': 'pages', 'cancel-in-progress': False}
                    permissions {'contents': 'read', 'pages': 'write', 'id-token': 'write'}
resolved caps: 5 total (was 2 in ci.yml, 0 in deploy.yml); every step cap inside its job cap
```

Both keys are the real ones — `steps[*].timeout-minutes` and `jobs.<id>.timeout-minutes` — whose
schema definitions carry `additionalProperties: false` (confirmed against
`https://json.schemastore.org/github-workflow.json` in the previous round; inherited here, not
re-fetched). **5 caps resolve; no `continue-on-error`; no `|| true`.**

---

## 8. Out of my scope — reported, not fixed

**R-1 — `requirements.txt` does not declare `requests`, which `scripts/arxiv_common.py:12` imports
directly.** `requirements.txt` is exactly `arxiv>=2.1.0,<4` and `pandas>=2.0.0`; `grep -i requests
requirements.txt` → nothing. `importlib.metadata.requires('arxiv')` on 2.1.3 →
`['feedparser ~=6.0.10', 'requests ~=2.32.0']`, so it is a *declared* dependency of `arxiv` on both
admitted majors and `import requests` cannot fail where `import arxiv` (one line earlier) has not.
But the repo has no lockfile and no hashes, so the version is resolved transitively and unpinned
(2.32.3 here; the previous round saw 2.33.1 in a clean venv on the same day), and the new
`except requests.exceptions.Timeout` branch plus the `isinstance` guard depend on it. **Action:
add `requests>=2.31.0`** (2.31 is where `ConnectTimeout`/`ReadTimeout` split from
`ConnectionError` — the branch the retry worst case rides on).

**R-2 — `.improve/REPO_PROFILE.md` claims 78 tests; the truth is 89.** Lines **96** (`# 78 tests,
OK, ~0.05s`), **99** (`Baseline: Ran 78 tests / OK`), **102-104** (`Fully offline and hermetic …
Confirmed hermetic by re-running with socket.connect / create_connection / getaddrinfo blocked:
78 run, 0 failures. Breakdown: test_arxiv_common.py (8), test_build_index.py (42),
test_paper_collector.py (28)`), **112** (`pytest -q  # WORKS — 78 passed`) and **909**
(`Python 78/78 OK`) are all stale. Measured truth: **89 run, 1 failure** under the socket block
(the pre-existing `BlackHoleRequestTests`), breakdown **(18), (43), (28)**, suite time ~1.1 s. The
substantive falsehood is the "Fully offline and hermetic … 78 run, 0 failures" sentence at
101-104 — it has been false since round 1, and it is the exact sentence a future verifier reads to
decide hermeticity. Line 106's neighbouring claim that the suite passes identically on `arxiv`
2.1.3, 3.0.0 **and 4.0.1** also deserves a re-check, since the landed hook is the one arXiv touch
point that is not faked.

---

## 9. Findings (all non-blocking; none defeats an acceptance criterion)

**F-1 — the deploy step's 2.5× margin is 2.5× of case A only; the compound case sits at 99.1 % of
the cap.** The YAML comment and the report both justify 75 min as "2.5 × 1800 s". But a deploy run
fetches **38 pages** across the 5 categories at today's volumes (measured, §1.4), and the
per-page bound is `timeout + delay_seconds = 70 s`, not 60 s. If every page consumed its full bound
*and then* the query hung, the step needs **4460 s** against a **4500 s** cap — 40 s of slack, and
`70 × P + 1800 ≤ 4500` breaks at **P = 39** pages, i.e. one page (~1,000 papers, ~9 % of a 60-day
window) of arXiv growth. The failure path the cap exists for (case A, 1800.3 s) has 2.5× of
headroom and is safe, so this is not a FAIL; but the margin is volume-dependent, and the honest fix
is either to state case B in the comment or to raise the deploy step cap to 90 min (its job cap is
already 90 — the step would then equal the job, so the job would need raising too, e.g. 120/110).

**F-2 — two mutants the implementer's matrix reports as CAUGHT are not, in the fine-grained form.**
`git`-level their M16 was a *whole-file* key rename (that is caught, by the "each workflow must
contribute at least one cap" guard). Renaming only the **`ci.yml` index step's** key
`timeout-minutes:` → `timeout:` **survives**, and **deleting the `ci.yml` index step's cap
entirely survives** (my M16/M26) — with the job cap of 25 min still above 360 s, no safety property
is violated, so nothing is preempted and the step is still bounded; but the CI step-level cap, which
is what AC2 asked for, can be silently removed and the suite stays green. The deploy step cap has
exactly the right test (`test_the_index_step_outlasts_a_whole_pipeline_failure` fails when the cap is
absent); **the CI step has no equivalent.** A `CIIndexStepTimeoutTests` asserting
`15 min > 360 s` at `ci.yml`'s index step, written the same way, would close it.

**F-3 — a job-level cap below its own step cap is undetectable (the implementer's M18; confirmed
by me as M28).** Setting `deploy.yml`'s `build` job to `timeout-minutes: 20` leaves the suite green
while making the *effective* step budget 1200 s — **below** the 1800 s worst case, which would
preempt IMP-004's message. The shipped values are correct (75 < 90), and the hazard needs PyYAML or
a structural parse to detect. Recorded, as the implementer did; closing it means adding a
dependencies-free structural check or accepting the risk.

**F-4 — the comment in `ci.yml:51-64` says the happy path is "~0.3 s" and the cap is "~3000× the
happy path"; I measured 0.49 s** for the exact CI command (so ~1800×, not ~3000×). The direction of
the claim is unaffected — 900 s is still ~1800× the real cost and cannot flake a healthy run. The
same comment says "15 min = 900 s is 2.5x that 360 s worst case" while the value it pins is
2.4993× of the *measured* 360.06 s; both are fine, but the comments present rounded ratios as exact.

**F-5 — `ci.yml`'s `python-tests` job is still uncapped** (and so is every other job in the repo).
It runs no network call, and neither AC2 nor I-1/I-2/I-4 asked for it, so this is correctly out of
scope — noting it only because the report's "resolved caps: 5" table could read as "all jobs are
capped".

---

## 10. What I could not fully settle

- The connect-timeout measurement is not pure loopback: `192.0.2.1` (RFC 5737 TEST-NET-1) is
  unroutable, so the SYN is dropped somewhere between this machine and the void. It is not a
  controlled black hole. Everything else (the read path, IMP-004, the suite, the mutations) is pure
  loopback or offline.
- I did not re-validate the two timeout keys against `json.schemastore.org` (inherited from the
  previous round); I confirmed the keys resolve at the correct levels via PyYAML and that GitHub's
  360-minute job default makes the reported ratios coherent.
- Case B in §1.4 is a *bound*, not a measurement: I did not make 38 pages each take the full 60 s
  (that would take 74 minutes of wall clock). The per-category page counts, however, are measured.
- I did not run the `web/` suite (`npm test` / `typecheck` / `build`): `web/dist` is a write target
  outside my read-only scope, and the previous round's figures (1.80 s / 5.83 s / 2.15 s) are
  inherited where the job-cap headroom argument uses them. Nothing in this round's diff touches
  `web/`.
