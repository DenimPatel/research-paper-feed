# IMP-198 (retry 2) — Fix the internal inconsistency the verifier found

**Implemented 2026-10-02.** Working interpreter `/usr/local/bin/python3.11` (3.11.8).
Read `.improve/reports/verify-IMP-198.md` in full first; this round exists to resolve
**I-1, I-2 and I-4**, and to report **I-3**, **I-5** and the pacing gap.
Suite: **86 → 89 tests, OK**, 1.125 s.

**No git write command was run. No branch was switched. Nothing was pushed.** `.kilo/worktrees/mildly-income`
was never read or written.

---

## 0. What changed

| File | Change |
| --- | --- |
| `.github/workflows/ci.yml` | **+19 / −0.** `web-tests` job `timeout-minutes: 10 → 25`; `Build the paper index` step `5 → 15`. Each carries a comment with the arithmetic. |
| `.github/workflows/deploy.yml` | **+25 / −0.** `build` job `None → 90`; `Build the paper index` step `None → 75`; `deploy` job `None → 15`. Nothing existing was altered. |
| `tests/test_arxiv_common.py` | **+102** (283 cumulative vs HEAD). New `workflow_timeouts()` reader, `test_the_request_timeout_value_is_pinned`, `WorkflowTimeoutTests.test_no_workflow_cap_is_tighter_than_the_client_worst_case`. |
| `tests/test_build_index.py` | **+66.** New `DeployStepTimeoutTests.test_the_index_step_outlasts_a_whole_pipeline_failure`. |
| `.improve/reports/impl-IMP-198.md` | this report (overwritten) |

**`scripts/arxiv_common.py` was not touched this round.** Its `+70 / −3` diff against HEAD is the
already-landed IMP-198 change, re-verified below but not edited. Consequently `delay_seconds = 10`
and `num_retries = 5` are byte-identical, and neither `scripts/` nor any test of theirs changed.

`readme.md`, `CONTRIBUTING.md` and `.improve/FEATURES.md` show as modified in `git status`; those
are the parallel docs agent's (IMP-031/032), not mine. **Not touched:** `web/`, `requirements.txt`,
`notebooks/`, `.improve/REPO_PROFILE.md`.

---

## 1. I-1 — the cap is now derived from the measured worst case

### 1.1 The worst case, measured by me (not taken from the verifier)

`DEFAULT_NUM_RETRIES = 5` and arxiv retrying while `_try_index < num_retries` gives
`_try_index` 0…5 = **6 attempts**. A `ConnectTimeout` subclasses `ConnectionError`, which *is* in
arxiv's retry tuple, so it is retried; a `ReadTimeout` is not. Two distinct worst cases:

| failure mode | retried by arxiv? | attempts | measured elapsed |
| --- | --- | --- | --- |
| **Read** timeout — loopback black hole, the AC3 case | No (`Timeout` is absent from arxiv's retry tuple) | 1 | **60.01 s** |
| **Connect** timeout — unroutable address | Yes (`ConnectTimeout` → `ConnectionError`) | 6 | **360.08 s** |

Full-scale connect probe, `/tmp/imp198r2/connect_probe.py 60`:

```
timeout              : 60.0 s
num_retries          : 5   delay_seconds: 10
session class        : TimeoutSession
HTTPAdapter.send calls (socket attempts): 6
attempt offsets      : ['0.0', '60.0', '120.0', '180.0', '240.1', '300.1']
elapsed              : 360.08 s
worst case ratio     : 6.00x the per-request timeout
error                : ConnectTimeout: ... (connect timeout=60.0)
```

This reproduces the verifier's 360.08 s independently. `192.0.2.1` is RFC 5737 TEST-NET-1
(unroutable), so the SYN is genuinely dropped — the same caveat the verifier recorded.

**The retries carry zero `delay_seconds` spacing**, confirmed two independent ways:

1. The offsets above are exactly one per-request timeout apart. A scaled run at `timeout=5` gave
   offsets `0.0 / 5.0 / 10.0 / 15.0 / 20.0 / 25.0`, elapsed **30.04 s** — 6.01× — with
   `delay_seconds = 10` configured and never applied.
2. Read from the installed source on **both** admitted majors. `arxiv/__init__.py`,
   `Client._Client__try_parse_feed` (2.1.3 and 3.0.0, byte-identical bodies):

   ```python
   if self._last_request_dt is not None:          # pacing branch
       required = timedelta(seconds=self.delay_seconds)
       ...
   resp = self._session.get(url, headers={"user-agent": "arxiv.py/2.1.3"})
   self._last_request_dt = datetime.now()          # assigned ONLY after a successful get
   ```

   A request that raises never reaches that assignment, so `_last_request_dt` stays `None` and the
   pacing branch is skipped on every retry. **Reported, not fixed — see §6.**

### 1.2 The worst case of each step

**CI index step = one page fetch.** `page_size = min(DEFAULT_PAGE_SIZE, max_results) =
min(1000, 5) = 5`, so the normal run makes exactly **one** request (one
`INFO:arxiv:Requesting page` line per run). A partition therefore costs one failed fetch
sequence: **360.08 s** + process start.

**Deploy index step = five page fetches.** A deploy runs `python scripts/build_index.py` with
`--max-per-category` unset → `limit = UNLIMITED = 100000` → `page_size = 1000`, over all five
`DEFAULT_CATEGORIES`. `collect_papers` records a failed category and **moves on to the next**, so:

```
5 categories x 6 attempts x 60 s = 1800 s
```

Measured directly, `/tmp/imp198r2/deploy_probe.py 2` (real `build_index.main()`, 2 s timeout, 1/30 scale):

```
categories           : 5 ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
per-category cost    : 12.03 s
ratio to one timeout : 6.02x
main() returned      : 1
out-dir created      : False
elapsed              : 60.17 s
projected at 60 s    : 1805.1 s = 30.1 min
```

and the run printed, live:

```
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO.
```

**This is the message I-1 says must survive.** A `timeout-minutes: 30` cap (1800 s) would have cut
it off **5.1 s early**. It now cannot.

### 1.3 The values, and why each number

**One rule for both index steps: the cap is 2.5× the nominal worst case, and every cap is verified
strictly greater than the *measured* worst case.**

| where | nominal worst case | measured worst case | old | **new** | margin | × nominal | × measured |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ci.yml` index step | 6 × 60 = **360 s** | 360.08 s | 5 min (300 s) ❌ | **15 min (900 s)** | +539.9 s | **2.50×** | 2.4993× |
| `deploy.yml` index step | 5 × 6 × 60 = **1800 s** | 1805.1 s | none | **75 min (4500 s)** | +2694.9 s | **2.50×** | 2.4929× |
| `ci.yml` `web-tests` job | — | — | 10 min | **25 min (1500 s)** | step 900 + **600 s** for the rest | | |
| `deploy.yml` `build` job | — | — | none | **90 min (5400 s)** | step 4500 + **900 s** for the rest | | |
| `deploy.yml` `deploy` job | — | — | none | **15 min (900 s)** | for `actions/deploy-pages` | | |

Why 2.5× and not the bare minimum of 2× (720 s / 3600 s):

* **The 0.08 s matters.** 2 × 360.08 = 720.16 s, so a 12-minute cap (720 s) is *already 0.16 s
  short* of the stated factor. Sizing on the measured value and then rounding to whole minutes gives
  an awkward 13 and 61. Sizing on the nominal 6 × 60 = 360 s — which is what the code arithmetic
  actually guarantees — and choosing round 5-minute multiples above it gives clean 900 s and 4500 s,
  and both still exceed the measured value with ~540 s and ~2695 s to spare.
* **A step can exceed one page fetch even on the CI step.** `Results.__next__` asks for another page
  if the first returns fewer entries than `max_results`. A page that *succeeds* costs ≤ 60 s + 10 s
  pacing, so a realistic mixed worst case is ≈ 430 s, not 360 s. 900 s covers that with room;
  a 2.01× cap would not comfortably.
* **2.5× leaves the cap a real backstop.** Its remaining job is the slow-drip case that `requests`
  cannot bound (a float timeout is per socket operation, not per request). 75 minutes is still
  4.8× tighter than GitHub's 360-minute default; the whole set is 4.0× tighter.

I deliberately did **not** take the verifier's alternative of dropping
`DEFAULT_REQUEST_TIMEOUT_SECONDS` to 30 s. It would fit the old 300 s cap (180 s worst case) but
halves the headroom for the deploy path's `page_size = 1000` multi-MB fetches, and 60 s is the
value already verified working on both arxiv 2.1.3 and 3.0.0. I also did not raise the step cap
past its job cap (15 < 25, 75 < 90), as the verifier cautioned.

### 1.4 The caps cannot cut off a legitimate run — measured, with the ratio

The exact CI step, four runs, `--out-dir` redirected to `/tmp` so `web/public/data` was untouched:

```
real 0.32 / real 0.21 / real 0.20 / real 0.27   (one clean run: real 0.27, rc=0)
INFO:root:Wrote 5 papers across 1 shards to /tmp/imp198r2/step-out
```

| happy-path measurement | vs 360 s client worst case | vs 900 s step cap |
| --- | --- | --- |
| **0.32 s** (slowest of my 4) | **1125×** | **2812×** |
| 0.66 s (the verifier's, colder) | 546× | 1364× |

Both ratios are three orders of magnitude, so the cap cannot flake a healthy run even on a cold,
slow, or rate-limited runner. For context on the job caps: the verifier measured `npm run typecheck`
1.80 s, `npm test` 5.83 s, `npm run build` 2.15 s, `npm ci` 2.45 s, giving ~12.9 s local and
≈ 90–120 s with CI-only overhead (checkout ~5 s, setup-python ~10 s, `pip install` ~30 s,
setup-node ~10 s, cold `npm ci` ~25 s). The 600 s left in the `web-tests` job is **5.0×** that; the
900 s left in the deploy `build` job is **7.5×**. (Those npm figures are the verifier's — I did not
run the web suite, since `web/` is out of my write scope and `npm run build` writes `web/dist`.)

### 1.5 The regression is now caught by a test

M13 in §4 replays the exact original defect — `ci.yml` step `15 → 5` — and fails the suite. Before
this round nothing in the repo could notice it.

---

## 2. I-2 — the 60 s value is now pinned

Three tests, all fast (measured **0.000 s** for all three together) and hermetic (all three pass
under the socket block of §5.3):

1. **`BuildClientTests.test_the_request_timeout_value_is_pinned`** —
   `assertEqual(arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS, 60)`, a literal, in the same class and
   the same style as the existing pacing pin. This is exactly what the verifier asked for: no test
   waits 60 s, and none needs to, because pinning a constant is an assertion about the constant.
2. **`WorkflowTimeoutTests.test_no_workflow_cap_is_tighter_than_the_client_worst_case`** — reads
   `ci.yml` and `deploy.yml` and asserts every `timeout-minutes` exceeds
   `(num_retries + 1) × timeout = 360 s`, so no cap can preempt IMP-004's message. This catches the
   timeout being raised (60 → 600 makes the worst case 3600 s) and any cap being tightened below
   the client's own bound.
3. **`DeployStepTimeoutTests.test_the_index_step_outlasts_a_whole_pipeline_failure`** — in
   `test_build_index.py`, because `DEFAULT_CATEGORIES` lives there. Asserts the deploy index step's
   cap exceeds `len(DEFAULT_CATEGORIES) × (num_retries + 1) × timeout = 1800 s`, and fails loudly if
   the step has no cap at all. This is the invariant the old 5-minute cap violated by 360 s.

The workflows are read as **text, not parsed as YAML**, on purpose: PyYAML is not one of this repo's
dependencies, so a test importing it would fail in CI, where `pip install -r requirements.txt` is all
that is installed. Two guards keep that honest — an unparseable `timeout-minutes:` line is reported
rather than skipped, and each workflow must contribute at least one cap, so renaming the key in
either file fails the suite (that is M16 below, which my first version missed).

---

## 3. I-4 — `deploy.yml` is now capped

```
  job build          timeout-minutes=90     (was None)
    step Build the paper index   timeout-minutes=75   (was None)
  job deploy         timeout-minutes=15     (was None)
```

Values come from the same rule and the same measurements as `ci.yml` (§1.3). The verifier's
proposed `20 / 10` would **not** have been safe: 10 min (600 s) is below the 1805 s partition
worst case, so it would have preempted exactly the message this item exists to preserve. Values
are consistent with `ci.yml` — same 2.5× factor on the measured worst case, each step cap inside a
job cap that also covers the rest of that job.

`build.yml`'s existing surface is verified untouched by PyYAML (§5.1): triggers still
`{schedule, push, workflow_dispatch}` with the daily `cron: "0 6 * * 0"`, `permissions` unchanged,
`concurrency` still `{group: pages, cancel-in-progress: False}`, `deploy.needs: build` unchanged,
and all 8 + 1 steps present with their original names, `uses`, `with` and order. The diff is
`+25 / −0` — pure additions, no line removed anywhere in either workflow
(`git diff -U0 -- .github/workflows/ | grep -c '^-[^-]'` → **0**).

`ci.yml`'s `python-tests` job is still uncapped: it runs no network call, and capping it was not
requested.

---

## 4. Non-vacuity — mutation matrix

`/tmp/imp198r2/mutate.py` copies `scripts/`, `tests/` and `.github/` to a throwaway tree, applies
one edit, and runs `unittest discover`. **The repo is only read.** Full output in §8.

| mutant | verdict | note |
| --- | --- | --- |
| M0 baseline | `Ran 89 … OK` | |
| M9 `DEFAULT_REQUEST_TIMEOUT_SECONDS` 60 → **600** | **CAUGHT** ×3 | the verifier's M9, now dead |
| M10 60 → **5** | **CAUGHT** ×3 | the verifier's M10, now dead |
| M11 `num_retries` 5 → 2 | **CAUGHT** ×3 | also caught by the pre-existing pacing pin |
| M13 `ci.yml` index step 15 → **5** | **CAUGHT** | **the original I-1 defect, replayed** |
| M15 `deploy.yml` index step 75 → 30 | **CAUGHT** | would preempt the 1805 s worst case by 5 s |
| M16 `timeout-minutes:` renamed to `timeout:` in `ci.yml` | **CAUGHT** | found by my own first-draft review |
| M17 `deploy.yml` index-step cap deleted | **CAUGHT** | |
| M14 `ci.yml` index step 15 → 10 | *survives* | **not a defect**: 600 s still exceeds the 360 s worst case, so IMP-004's message still lands. The test constrains the safety property, not the chosen margin. |
| M18 `ci.yml` job cap 25 → 12 (under the step cap) | *survives* | **known limitation**, see below |

**M18 is a real but secondary hole, and I did not close it.** Catching it means distinguishing a
job-level cap from a step-level cap, which needs real YAML structure; PyYAML is not a repo
dependency, and an indentation heuristic would be silently wrong if anyone reformatted either file.
The relationship is instead stated in the YAML comment on each job cap ("The index step below may
use up 15 of these"), asserted in §5.1, and left there deliberately rather than papered over with a
fragile parser. Reporting it rather than hiding it.

M14 and M18 surviving is *not* the same as the value being unpinned: M9 and M10, the two mutants the
verifier flagged, are both caught three times over.

---

## 5. Every command, with results

### 5.1 Both workflow YAMLs parse and the caps resolve

`/usr/local/bin/python3.11 /tmp/imp198r2/yaml_check.py` — PyYAML 6.0.1:

```
ci.yml -- PARSED OK
  triggers      : ['pull_request', 'push']
  job python-tests   timeout-minutes=None
  job web-tests      timeout-minutes=25
      step Build the paper index  timeout-minutes=15
deploy.yml -- PARSED OK
  triggers      : ['push', 'schedule', 'workflow_dispatch']
  concurrency   : {'group': 'pages', 'cancel-in-progress': False}
  permissions   : {'contents': 'read', 'pages': 'write', 'id-token': 'write'}
  job build          timeout-minutes=90
      step Build the paper index  timeout-minutes=75
  job deploy         timeout-minutes=15
  -> every step cap is inside its job cap      (both files)

resolved caps:  job ci.yml web-tests 25 / step ci.yml Build the paper index 15
                job deploy.yml build 90 / step deploy.yml Build the paper index 75
                job deploy.yml deploy 15        total 5   (was 2 in ci.yml, 0 in deploy.yml)
```

Both keys are the real ones — `steps[*].timeout-minutes` and `jobs.<job_id>.timeout-minutes`, whose
schema definitions both have `additionalProperties: false`. The verifier already confirmed this
against `json.schemastore.org/github-workflow.json`; I did not re-fetch it, so that specific point
is inherited, not re-verified.

### 5.2 Suite, regressions, compile

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 89 tests in 1.125s
OK                                            (wall 1.85 s)

$ ... discover -s tests -v -k MainTests -k CollectPapersRetentionTests
                    -k BuildShardsTests -k DeployStepTimeoutTests
Ran 13 tests in 0.007s
OK                                            (IMP-004 + IMP-020)

$ /usr/local/bin/python3.11 -m compileall -q scripts tests
exit 0

CI-resolved dependency set (fresh venv from requirements.txt: arxiv 3.0.0, requests 2.33.1):
$ /tmp/imp198r2/venv/bin/python -m unittest discover -s tests
Ran 89 tests in 1.097s
OK
```

Per-test timing, 89 tests measured individually:

```
total measured: 1.128 s      any test > 5 s: False
  1.043s  test_arxiv_common.BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging
  0.012s  (next slowest)
```

The one slow test is the pre-existing loopback black hole (timeout patched to 1 s). My three new
tests run in **0.000 s** and open no socket.

### 5.3 The timeout still fires against a black-holed local address

`/tmp/imp198r2/read_blackhole.py` — binds `127.0.0.1:0`, accepts, never writes a byte, never
closes; loopback only, no DNS, no external host. Driven through `build_client()` and
`iter_results()` at the **shipped 60 s default**:

```
configured timeout   : 60 s
session class        : TimeoutSession
connections accepted : 1
elapsed              : 60.01 s
results              : []
status failed        : True
status error         : HTTPConnectionPool(host='127.0.0.1', port=61821): Read timed out. (read timeout=60)

OK: fired at the configured bound, on the hard-fail path, 1 connection
```

It fails *at* the timeout, not at any external kill, and makes exactly one connection — a read
timeout is not in arxiv's retry tuple, so the bound can only shorten a run, never extend it.

### 5.4 A normal index build still succeeds

```
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV \
      --max-per-category 5 --out-dir /tmp/imp198r2/final-out
INFO:root:Querying cat:cs.CV (limit 5) ...
INFO:root:  5 papers within retention window for cs.CV
INFO:root:Wrote 5 papers across 1 shards to /tmp/imp198r2/final-out
real 0.27      (rc=0)

index.json 287 B, papers-2026-W40.json 4586 B
```

`--out-dir` was redirected to `/tmp` so `web/public/data` was never written. A live run against real
arXiv, in four separate runs.

### 5.5 IMP-004's hard-fail is intact, and only fires on failure

`/tmp/imp198r2/hardfail.py` — real `build_index.main()`, loopback black hole, 2 s timeout:

```
main() returned   : 1
out-dir created   : False
elapsed           : 10.05 s
connections       : 5   (one per category)
  control run     : rc=0, totalPapers=1, shards=1
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO.
```

Exit 1, nothing written, readable message — and a healthy run still writes, so IMP-004's check is a
failure path rather than a blanket refusal. IMP-020's retention filtering is untouched:
`scripts/build_index.py` was not modified and all 13 IMP-004/IMP-020 tests pass.

### 5.6 No test was weakened, skipped, or deleted

```
$ git diff --numstat -- tests/
283   0   tests/test_arxiv_common.py
 66   0   tests/test_build_index.py

$ git diff -U0 -- tests/ | grep -c '^-[^-]'                 -> 0   (zero deletions)
$ git diff -U0 -- tests/ | grep -E '^\+.*(skipTest|@unittest\.skip|expectedFailure)'
                                                              -> none
test names, HEAD vs worktree:
  test_arxiv_common.py   HEAD= 8   worktree= 18   removed: (none)   added: 10
  test_build_index.py    HEAD=42   worktree= 43   removed: (none)   added: 1
  test_paper_collector.py HEAD=28  worktree= 28   removed: (none)   added: 0
duplicate test names anywhere: none
```

78 (HEAD) + 8 (landed) + 3 (this round) = **89**, arithmetically consistent. All 86 tests that
existed when I started are still present under the same names. The one `skipTest` in the suite
(`test_paper_collector.py`) is pre-existing and untouched.

### 5.7 Hermeticity, measured rather than asserted

`/tmp/imp198r2/hermetic.py` blocks `socket.connect`, `socket.create_connection` and
`socket.getaddrinfo`:

```
ran=89 failures=1 errors=0
  NOT-HERMETIC: test_arxiv_common.BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging
Ran 89 tests in 0.101s
```

**88 of 89 pass with sockets blocked.** The single failure is the loopback black-hole test that
already existed before this round; it binds `127.0.0.1:0`, resolves no name, reaches no external
host and closes in `addCleanup`. All three of my new tests pass under the block — they open two
repo files and assert constants. It fails fast (0.101 s), never hangs.

---

## 6. Reported, not changed

### 6.1 arXiv does not space its retries — upstream behaviour, do not "fix" it

`Client._Client__try_parse_feed` assigns `_last_request_dt` **after** a successful
`_session.get(...)`, so a request that raises never updates it and the `delay_seconds` pacing branch
is skipped on every retry. Measured: 6 attempts at offsets `0 / 60 / 120 / 180 / 240 / 300` s.

Consequence: a **connect**-timeout failure issues 6 requests back to back instead of 6 spaced 10 s
apart. On the happy path nothing changes — a live run logged `Sleeping: 9.997043 seconds` between
pages, and the CI step's single request never even reaches the pacing branch.

**This is arXiv's pre-existing retry behaviour, present before IMP-198, and I did not touch it.**
"Fixing" it would mean adding client-side sleeps, which changes request pacing to arXiv and so
touches their rate limit and terms of use — out of scope for this item and not mine to decide.
`DEFAULT_DELAY_SECONDS = 10` and `DEFAULT_NUM_RETRIES = 5` are load-bearing and byte-identical.
**Recommendation for the orchestrator: file this as a separate item** to confirm with arXiv's terms
whether a back-to-back retry storm is acceptable, since the timeout I added makes each attempt
*terminate* faster and therefore makes the retries *denser*, not slower.

### 6.2 I-3 — `requests` is imported directly but not declared (latent defect, still open)

**Verified, both claims settled:**

```
$ grep -in "requests" requirements.txt          -> NOT declared
$ cat requirements.txt                           -> arxiv>=2.1.0,<4 ; pandas>=2.0.0
$ grep -rn "^import requests" scripts/           -> scripts/arxiv_common.py:12  (only hit)

arxiv 2.1.3 requires: ['feedparser ~=6.0.10', 'requests ~=2.32.0']
arxiv 3.0.0 requires: ['feedparser~=6.0.10', 'requests<2.34,>=2.32', ...]
```

**Is it truly transitive? Yes.** `requests` is a *direct, declared* dependency of `arxiv` on **both**
admitted majors — not merely something that happens to be installed. So `import requests` cannot
fail where `import arxiv` (one line earlier) has not already failed, and there is no new
`ImportError` surface today.

**But it is still wrong to ship.** The repo has no lockfile and no hashes, so `requests` is resolved
transitively and unpinned: I observed **2.32.3** (system) and **2.33.1** (a clean venv from
`requirements.txt`) — two different minors on the same day. The timeout hook is load-bearing on
`requests.adapters.HTTPAdapter.send` mapping `MaxRetryError(ConnectTimeoutError)` to
`requests.exceptions.ConnectTimeout` rather than a bare `ConnectionError`; that branch exists in
both versions I have, but it is an unasserted dependency of the new `except` clause.

**I may not edit `requirements.txt`, so this is unfixed. Recommendation for the orchestrator to
file:** add `requests>=2.31.0` (2.31 is where `ConnectTimeout`/`ReadTimeout` split from
`ConnectionError` — the branch the retry worst case depends on).

### 6.3 I-5 — `.improve/REPO_PROFILE.md` is stale, and now staler (I may not edit it)

The file still claims the pre-IMP-198 numbers. Every stale line, with the truth:

| line | claims | truth now |
| --- | --- | --- |
| 96 | `# 78 tests, OK, ~0.05s` | **89 tests, ~1.1 s** |
| 99 | `Baseline: **Ran 78 tests** / OK` | **89** |
| 102–104 | `Fully offline and hermetic … Confirmed hermetic by re-running with socket.connect / create_connection / getaddrinfo blocked: 78 run, 0 failures. Breakdown: test_arxiv_common.py (8), test_build_index.py (42), test_paper_collector.py (28).` | **89 run, 1 failure** (the loopback black-hole test, §5.7); breakdown **(18), (43), (28)** = 89 |
| 112 | `python -m pytest tests -q  # WORKS — 78 passed` | **89** |
| 909 | `Python 78/78 OK` | **89/89** |

The "Fully offline and hermetic" sentence is the substantive one: it is false for exactly one test,
and has been since the landed round. It should read "88 of 89 pass with sockets blocked; the one
exception is `BlackHoleRequestTests`, which binds `127.0.0.1:0` on purpose, resolves no name and
reaches no external host — no mock can demonstrate that a *hang* is bounded." Note the profile's
neighbouring claim that the suite passes identically on arxiv 2.1.3, 3.0.0 **and 4.0.1** also
merits a re-check, since the landed hook is the one arXiv touch point that is *not* faked.

`.improve/REPO_PROFILE.md` is not in my write scope, so this is reported, not fixed.

---

## 7. Acceptance criteria, re-checked

| the landed work | still holds? |
| --- | --- |
| 60 s `TimeoutSession` / `install_request_timeout` hook fires on arxiv 2.1.3 and 3.0.0 | **yes** — 60.01 s `ReadTimeout`, 1 connection, loopback; and 360.08 s / 6 attempts on the connect path, §1.1 |
| `timeout-minutes` on the CI job and step | **yes**, and the step cap is now above the client worst case (§1.3) |
| IMP-004 hard-fail (exit 1, nothing written, readable message) | **yes** — §5.5, and no longer preempted by a step cap |
| IMP-020 retention filtering | **yes** — `build_index.py` unmodified; 13 targeted tests OK |
| No regression to pacing, no extra requests | **yes** — `delay_seconds`/`num_retries` byte-identical; 1 connection on a hang vs 2 on a 500 under a lower retry budget |
| `deploy.yml` capped (AC2) | **now yes** — §3 |
| Timeout value pinned (I-2) | **now yes** — §2, M9/M10 caught |
| Suite green | **89 tests, OK, 1.125 s**; 89 on arxiv 3.0.0 too |

---

## 8. Complete command log

| command | result |
| --- | --- |
| `python3.11 -m unittest discover -s tests -v` (before this round) | `Ran 86 tests` / `OK`, 1.121 s |
| `python3.11 -m unittest discover -s tests -v` (after) | **`Ran 89 tests` / `OK`, 1.125 s**, wall 1.85 s |
| `... -v -k MainTests -k CollectPapersRetentionTests -k BuildShardsTests -k DeployStepTimeoutTests` | `Ran 13 tests` / `OK`, 0.007 s |
| `... -v -k test_the_request_timeout_value_is_pinned -k test_no_workflow_cap... -k test_the_index_step_outlasts...` | `Ran 3 tests` / `OK`, **0.000 s** |
| per-test timing over all 89 | total 1.128 s; none > 5 s; slowest 1.043 s (pre-existing black-hole test) |
| venv `/tmp/imp198r2/venv` + `pip install -r requirements.txt` | `arxiv 3.0.0`, `requests 2.33.1`; `arxiv requires: ['feedparser~=6.0.10', 'requests<2.34,>=2.32', ...]` |
| `/tmp/imp198r2/venv/bin/python -m unittest discover -s tests` | `Ran 89 tests` / `OK`, 1.097 s |
| `importlib.metadata.requires('arxiv')` (system) | `['feedparser ~=6.0.10', 'requests ~=2.32.0']` |
| `inspect.getsourcelines(arxiv.Client._Client__try_parse_feed)` on 2.1.3 and 3.0.0 | pacing branch skipped when `_last_request_dt is None`; assigned only after a successful `get` |
| `connect_probe.py 5` | 6 attempts, offsets `0/5/10/15/20/25`, elapsed **30.04 s** (6.01×) |
| `connect_probe.py 60` | 6 attempts, offsets `0/60/120/180/240.1/300.1`, elapsed **360.08 s** (6.00×) |
| `deploy_probe.py 2` (real `build_index.main()`, 5 categories) | rc=1, no out-dir, 60.17 s, 12.03 s/category, **projected 1805.1 s = 30.1 min** |
| `read_blackhole.py` (loopback, shipped 60 s) | **60.01 s**, `ReadTimeout (read timeout=60)`, 1 connection, `status["failed"]` True |
| `hardfail.py` (loopback hang through `main()`, 2 s) | **rc=1, no out-dir**, 5 connections, 10.05 s; control run rc=0 wrote 1 paper / 1 shard |
| `build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/...` ×4 | rc=0, `real 0.20 / 0.21 / 0.27 / 0.32`, 1 page request per run |
| `yaml_check.py` | both files parse; caps 25 / 15 / 90 / 75 / 15; deploy triggers, `permissions`, `concurrency: cancel-in-progress False`, all step names and order intact; every step cap inside its job cap |
| `mutate.py` (8 mutants) | M9, M10, M11, M13, M15, M16, M17 **CAUGHT**; M14 and M18 survive (documented in §4) |
| `hermetic.py` (sockets blocked) | `ran=89 failures=1` — the pre-existing loopback black-hole test; my 3 new tests pass |
| `compileall -q scripts tests` | exit 0 |
| `git diff --numstat -- tests/` | `283 0` and `66 0` — **zero deletions** |
| `git diff -U0 -- .github/workflows/ \| grep -c '^-[^-]'` | **0** — pure additions in both workflows |
| `git status --short` | my 4 files + the parallel docs agent's `readme.md` / `CONTRIBUTING.md` / `.improve/FEATURES.md` |

No `npm` command was run and no `web/` file was written — `web/` is out of my write scope and
`npm run build` writes `web/dist`. The npm timings in §1.4 are the verifier's.

---

## 9. Open for the orchestrator

1. **File the `requests` declaration** (§6.2). `scripts/arxiv_common.py:12` imports it directly;
   `requirements.txt` does not declare it. Add `requests>=2.31.0`.
2. **File the arXiv retry-pacing question** (§6.1). Retries are not spaced by `delay_seconds`
   because arXiv records `_last_request_dt` only after a successful request. Needs a decision
   against arXiv's terms of use; not something to change in this repo unilaterally.
3. **Refresh `.improve/REPO_PROFILE.md`** (§6.3): lines 96, 99, 102–104, 112 and 909 are stale —
   now 89 tests, breakdown (18)/(43)/(28), and **88 of 89** pass with sockets blocked rather than
   "78 run, 0 failures". Also worth re-checking its claim that the suite passes identically on
   arxiv 4.0.1, since the landed hook is the one arXiv touch point that is not faked.
4. **M18** (§4): a job-level cap set *below* its own step cap would not be caught by a test. Closing
   it needs YAML structure that the repo does not depend on.