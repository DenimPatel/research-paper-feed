# Verify IMP-198 — Bound the arXiv HTTP request with a real timeout and a CI job timeout

**Verified 2026-10-02.** Independent verifier. No source file was modified; all probes live in
`/tmp/v198`. Interpreter `/usr/local/bin/python3.11` (3.11.9). Scope note: `readme.md` and
`CONTRIBUTING.md` are another agent's (IMP-031/032) and were ignored.

## VERDICT: **PASS** (2/2 of the two stated criteria; 5 non-blocking issues below)

---

## 0. Summary table

| # | Check | Result |
| --- | --- | --- |
| 1 | Hook is on the object that issues the request | **CONFIRMED** — `arxiv.Client.__init__` sets `self._session` in exactly one place, and `Session.get` delegates to `Session.request` |
| 1 | Timeout fires on the real call path, before/after | **REPRODUCED** — before: unbounded (killed at 35 s, and again at 180 s); after: 60.01 s `ReadTimeout`, 1 connection, on arxiv **2.1.3 and 3.0.0** |
| 1 | 60 s sane / values mutually consistent | **NO** — measured worst case **360.08 s > 300 s** step cap (issue **I-1**) |
| 2 | Raise-on-vanish correct? | **Yes**, and spec-mandated (`.improve/FEATURES.md` AC1: "a defensive fallback that raises a clear error") |
| 2 | Cannot fire spuriously on CI's arxiv | **CONFIRMED** on 2.1.3 and 3.0.0 |
| 3 | No regression to pacing / no extra requests | **CONFIRMED** — `delay_seconds=10`/`num_retries=5` byte-identical; slow endpoint measured at **1** connection vs 2 for a 500 |
| 4 | IMP-004 / IMP-020 intact | **CONFIRMED** — 500 → exit 1, no out-dir; mid-stream hang → exit 1, no out-dir; retention 12/12 green |
| 5 | Workflow values sane / keys valid | Job 10 min **sane**; step 5 min **preempts** the client bound (I-1); both keys valid per schema |
| 5 | `deploy.yml` gap | **Real, not covered** (I-4) — spec AC2 named it; implementer declared it out of write scope |
| 6 | 8 new tests non-vacuous | **9/12 mutants caught**; 2 real survivors (I-2) |
| 7 | `requests` declared? | **NO** — `requirements.txt` does not declare it (I-3) |
| 8 | Full suite | `Ran 86 tests … OK` |
| 9 | YAML parses, timeouts resolve | `10` / `5` |

---

## 1. THE TIMEOUT ACTUALLY FIRES ON THE REAL CALL PATH

### 1.1 The hook sits on the object that issues the request

Read from the installed packages, not from docs.

`arxiv` **2.1.3** (system `python3.11`),
`/Library/Frameworks/Python.framework/Versions/3.11/lib/python3.11/site-packages/arxiv/__init__.py`:

```
528:    _session: requests.Session
543:        self._session = requests.Session()          # <- the ONLY session construction
660:        resp = self._session.get(url, headers={"user-agent": "arxiv.py/2.1.3"})
```

`arxiv` **3.0.0** (fresh venv I built from `requirements.txt`, `/tmp/v198/myvenv`),
`site-packages/arxiv/__init__.py`:

```
33:    _session: requests.Session
48:        self._session = requests.Session()          # <- still the ONLY session construction
164:        resp = self._session.get(url, headers={"user-agent": "arxiv.py/2.3.2"})
```

`grep -rn "requests.Session()" <arxiv pkg>` on 3.0.0 returns **one** hit (line 613, inside
`Client.__init__`). So `Client._session` is the unique request-issuing session on both admitted
versions, and `scripts/arxiv_common.py:82` is the **only** `arxiv.Client(...)` construction in the
repo (`grep -rn "arxiv.Client(" scripts/*.py` → one hit). The class-swap in
`scripts/arxiv_common.py:75` therefore lands on the object arXiv will actually use.

### 1.2 `Session.get()` really delegates to `Session.request()`

`requests 2.32.3`, `inspect.getsource(requests.Session.get)`:

```python
def get(self, url, **kwargs):
    kwargs.setdefault("allow_redirects", True)
    return self.request("GET", url, **kwargs)
```

An override of `request` is therefore reached by arXiv's `.get()`. **Confirmed.**

### 1.3 Empirical before/after — REPRODUCED

Harness `/tmp/v198/probe.py`: binds `127.0.0.1:0`, `listen(8)`, `accept()`s, **never writes a byte,
never closes**, counts connections; repoints `arxiv.Client.query_url_format` at it; then calls the
real `build_client()` and drives `client.results(...)`. External kill armed via
`Thread.join(timeout=…)` so an unbounded run cannot hang the probe.

**BEFORE** — `git show HEAD:scripts/arxiv_common.py` (`grep -c install_request_timeout` → 0):

```
label           : BEFORE (HEAD arxiv_common.py)
has hook        : False
session class   : Session
page_size/delay/retries: 5 10 5
connections hit : 1
elapsed         : 35.00s (join budget 35s)
outcome         : EXTERNAL KILL -- still running after 35s, the request is UNBOUNDED
probe exit=3
```

A second independent BEFORE probe aimed at `192.0.2.1:80` (dropped SYN, **not** a read-blackhole)
exceeded a **180 s** bash timeout without returning — i.e. unbounded on the connect path too.

**AFTER** — working-tree `scripts/arxiv_common.py`, default 60 s:

```
label           : AFTER (working tree)
has hook        : True
timeout const   : 60
session class   : TimeoutSession
connections hit : 1
elapsed         : 60.01s (join budget 100s)
outcome         : ReadTimeout: HTTPConnectionPool(host='127.0.0.1', port=61138): Read timed out. (read timeout=60)
probe exit=0
```

Repeated on **arxiv 3.0.0 / requests 2.33.1** with my own venv — identical result
(`60.01s`, `ReadTimeout (read timeout=60)`, 1 connection). It fails **at the timeout, not at the
kill** (60.01 s > 35 s budget, and a 100 s budget was armed and did not fire).

### 1.4 The 60 s value — worst-case math (the values are NOT mutually consistent)

`scripts/arxiv_common.py:18` `DEFAULT_NUM_RETRIES = 5`. arXiv's `_parse_feed`
(`arxiv/__init__.py:137`) retries while `_try_index < num_retries`, i.e. `_try_index` 0…5 = **6
attempts**. Two distinct paths:

| failure mode | retried by arXiv? | requests | measured total |
| --- | --- | --- | --- |
| **Read** timeout (accept, never answer) — the spec's AC3 case | **No.** `Timeout` is not in the arXiv tuple `(HTTPError, UnexpectedEmptyPageError, ConnectionError)` (`arxiv/__init__.py:132-136`, `:133` region) | 1 | **60.01 s** |
| **Connect** timeout (SYN dropped / firewall DROP) | **Yes.** `ConnectTimeout` subclasses `ConnectionError` (`MRO: ConnectTimeout → ConnectionError → Timeout → RequestException → OSError`) | 6 | **360.08 s** |

Measured, `/tmp/v198/connect_probe.py` against `192.0.2.1:80` at the shipped 60 s default:

```
timeout     : 60.0
num_retries : 5  delay_seconds: 10
socket ATTEMPTS (HTTPAdapter.send calls): 6
attempt offsets: ['0.0', '60.0', '120.0', '180.0', '240.1', '300.1']
elapsed       : 360.08s
```

**6 × 60 s = 360 s, with ZERO `delay_seconds` spacing between the retries** (offsets are exactly
60 s apart). Reason, read at `arxiv/__init__.py:165-166`: `_last_request_dt` is assigned only
*after* `self._session.get(...)` returns, so a request that raises never updates it and
`__try_parse_feed`'s pacing branch (`arxiv/__init__.py:155`) is skipped. A **5-minute (300 s) step
cap is therefore smaller than the client-level worst case for a single page**, and the step cap fires
~60 s early — replacing IMP-004's readable `Refusing to write an index: the arXiv query failed…`
with GitHub's generic step cancellation. The job still fails inside the 10-minute job cap, so no
hang and no runner-hour burn; the cost is diagnostic quality on the connect-timeout path.

**Not a legitimate-run flake source.** A healthy run of the exact CI step measured **0.66 s** wall
(`/usr/bin/time -p python3.11 scripts/build_index.py --category cs.CV --max-per-category 5
--out-dir /tmp/v198/smoke` → `real 0.66`, exit 0, `index.json` 287 B + `papers-2026-W40.json`
4586 B). 300 s is ~450× that. → issue **I-1**.

---

## 2. THE DEGRADATION CHOICE

### 2.1 Raise is correct, and the spec mandates it

`.improve/FEATURES.md` IMP-198 AC1: *"add … a defensive fallback that **raises a clear error** rather
than silently running unbounded if the attribute is ever absent."* The implementer's
`TimeoutNotInstalled` (`scripts/arxiv_common.py:22-23`, raised at `:66-71`) is exactly that, and the
message names `_session`. My independent judgement agrees: the protected-against failure mode is
the 6-runner-hour hang; a warning would restore it invisibly, and the spec's own Notes call the
hook "a floor, not a fix", so losing the floor must be **visible**. `requirements.txt:13`'s
`<4` bound (IMP-033) means a rename of the private attribute can only arrive as a deliberate major,
which is the right moment for a loud failure.

### 2.2 It cannot fire spuriously on the versions CI installs

- arxiv **2.1.3** + requests 2.32.3: full suite `Ran 86 tests … OK`; probe §1.3 installs cleanly
  (`session class: TimeoutSession`), no raise.
- arxiv **3.0.0** + requests 2.33.1 (my own `/tmp/v198/myvenv`, built from
  `pip install -r requirements.txt`): `Ran 86 tests … OK`; probe §1.3 installs cleanly, no raise.

**The hook works on both.** The `isinstance(session, requests.Session)` guard
(`scripts/arxiv_common.py:66`) passes on both, and arXiv assigns the session exactly once in
`__init__` on both, so there is no window in which `_session` could be missing.

---

## 3. NO REGRESSION ON PACING / RATE LIMITS

- `git diff -- scripts/arxiv_common.py` shows `DEFAULT_DELAY_SECONDS = 10` and
  `DEFAULT_NUM_RETRIES = 5` **untouched**; only `DEFAULT_REQUEST_TIMEOUT_SECONDS = 60` was added
  beside them (`scripts/arxiv_common.py:19`). `build_client` still passes
  `delay_seconds=DEFAULT_DELAY_SECONDS, num_retries=DEFAULT_NUM_RETRIES` (`:84-85`) and still caps
  `page_size` with `min(DEFAULT_PAGE_SIZE, max_results)` (`:83`).
- Pacing observed live: a mid-stream probe logged `INFO:arxiv:Sleeping: 9.997043 seconds` between
  a successful page and the next — `delay_seconds` still applied.
- **Request count on a slow endpoint, measured independently** (`/tmp/v198/hardfail.py`,
  through `build_index.main()`):

```
=== IMP-004: hard fail, exit 1, write nothing ===
HTTP 500, num_retries=1, t/o=60    rc=1  elapsed=10.02s out-dir=<no dir>
   HTTP requests actually received by the server: 2

=== IMP-198 new failure mode: hang -> same hard-fail path ===
black hole, num_retries=5, t/o=2   rc=1  elapsed= 2.01s out-dir=<no dir>
   connections accepted: 1
```

A slow endpoint receives **1** connection where a 500 receives **2** (under a *lower* retry budget,
`num_retries=1`). A timeout cannot add requests — it can only remove them, since it either ends the
request or ends the query. Confirmed at the source level too: `Timeout` is absent from arXiv's retry
tuple.

---

## 4. NO REGRESSION ON LANDED PYTHON ITEMS

**IMP-004 (hard-fail, exit 1, write nothing) — intact, three independent probes:**

| probe | result |
| --- | --- |
| `--category 'cs.CV; rm -rf /'` | argparse rejects, **no out-dir created** |
| HTTP 500, `num_retries=1` | 2 requests served → `main()` → **1**, `out-dir=<no dir>` |
| black hole (read timeout), `num_retries=5` | 1 connection → `main()` → **1**, `out-dir=<no dir>` |
| **mid-stream** (`/tmp/v198/partial.py`: page 1 = 200 + valid Atom feed with 2 records, page 2 hangs) | 2 requests served → `main()` → **1** in 12.01 s, `out-dir exists: False` → **no partial index** |

The last is the one that matters for the new failure mode: a hang *after* records have already
arrived still refuses to write. `scripts/build_index.py` and `tests/test_build_index.py` are
**unmodified** (`git diff --stat` → empty).

**IMP-020 (order-independent retention) — intact.** `CollectPapersRetentionTests`,
`BuildShardsTests`, `MainTests` → `Ran 12 tests … OK`. A live build
(`--max-per-category 40 --retention-days 3`) returned 0 with
`totalPapers=40, retentionDays=3, 1 shard, 4 records in window`. Live source comment at
`scripts/build_index.py:220-229` still enforces retention one record at a time.

---

## 5. WORKFLOW TIMEOUTS

### 5.1 `.github/workflows/ci.yml` — both keys valid, right level

Against the authoritative schema `https://json.schemastore.org/github-workflow.json`
(fetched, not from memory):

```
normalJob.timeout-minutes : {"description": "The maximum number of minutes to let a workflow run before
                                       GitHub automatically cancels it. Default: 360", "oneOf":[number,expression]}
step.timeout-minutes      : {"description": "The maximum number of minutes to run the step before killing
                                       the process.", "oneOf":[number,expression]}
```

Both defs have `additionalProperties: false`, so a wrong key would be rejected — these are the
right keys at the right levels. `normalJob`'s `default: 360` independently confirms the spec's
360-minute job-limit claim. PyYAML 6.0.1 resolution:

```
 job python-tests   timeout-minutes=None
 job web-tests      timeout-minutes=10
    step Build the paper index    timeout=5 continue-on-error=None
 continue-on-error anywhere: False
```

`git diff -U0 -- .github/workflows/ | grep -c '^-[^-]'` → **0** (pure additions, AC5).
No `continue-on-error`, no `|| true` (`grep -n "continue-on-error\||| true" ci.yml` → none).

### 5.2 Is `timeout-minutes: 10` enough for the whole `web-tests` job? — YES

Measured locally, `web/`:

| step | measured |
| --- | --- |
| `npm run typecheck` | **1.80 s** |
| `npm test` | **5.83 s** — `Test Files 16 passed (16)`, `Tests 253 passed (253)` |
| `npm run build` | **2.15 s** — `index-D7spZXJu.js 171.45 kB (gzip 54.92)`, `index-G-YE6pVt.css 10.93 kB (gzip 2.86)` |
| `npm ci` (warm cache) | **2.45 s** |
| `build_index.py --category cs.CV --max-per-category 5` | **0.66 s** |
| **local subtotal** | **~12.9 s** |

Adding CI-only overhead (`checkout` ~5 s, `setup-python` ~10 s, `pip install -r requirements.txt`
~30 s, `setup-node` ~10 s, cold `npm ci` ~25 s) puts a healthy job at **≈ 90–120 s**. 600 s is
**~5–6× headroom** — generous enough for a cold, slow, or cache-missing runner. Not a flake source.

### 5.3 Is `timeout-minutes: 5` on the index step safe? — for legitimate runs, yes; see I-1

- Legitimate cost measured at **0.66 s** → 300 s is ~450× headroom. Also cannot preempt IMP-004's
  fast-fail path (6 attempts at a 10 s gap ≈ 51 s < 300 s).
- But it is **smaller than the client-level worst case (360.08 s)** on the retried connect-timeout
  path → issue **I-1**.

### 5.4 `deploy.yml` was NOT given a timeout — this IS a gap, and the spec asked for it

`.improve/FEATURES.md` IMP-198 lists `.github/workflows/deploy.yml:33-34` in **Area / files**, and
AC2 says: *"Do the same judgement for `deploy.yml:33-34`, which runs the identical script."* The
implementer supplied the judgement and a patch in their report §5 but applied nothing, citing write
scope. Verified still uncapped:

```
--- deploy ---
 job build          timeout-minutes=None
 job deploy         timeout-minutes=None
```

and `.github/workflows/deploy.yml:33-34` is bare:

```yaml
      - name: Build the paper index
        run: python scripts/build_index.py
```

**Partial mitigation, correctly noted by the implementer:** because deploy runs the same
`scripts/build_index.py` → `arxiv_common.build_client`, the source-level change *does* bound
deploy's client requests — it can no longer hang forever. Worst case now:
`DEFAULT_CATEGORIES` = 5 (`scripts/build_index.py:32`), `--max-per-category` defaults to 0 →
`limit = UNLIMITED = 100000` → `page_size = 1000`. A total network partition makes each category
burn 6 × 60 s = 360 s, and `collect_papers` (`scripts/build_index.py:~240-260`) **records the
failure and continues to the next category**, so a partition costs **5 × 360 s = 1800 s = 30
runner-minutes, uncapped**, before `main()` finally exits 1. Bounded, but 3× the CI job cap and 10×
what the deploy's own healthy run needs. → issue **I-4**.

---

## 6. THE 8 NEW TESTS — INDEPENDENT NON-VACUITY CHECK

My own scratch tree `/tmp/v198/mut` (`scripts/` + `tests/` copied, nothing in the repo touched),
mutator `/tmp/v198/mutate.py`. Baseline `Ran 86 tests … OK`.

| mutant | result | verdict |
| --- | --- | --- |
| M0 baseline | `Ran 86 … OK` | — |
| M1 delete only the `install_request_timeout(...)` call from `build_client` | `FAILED (failures=3)` in 20.1 s | **CAUGHT** |
| M2 `setdefault` → hard assignment | `FAILED (failures=1)` | **CAUGHT** |
| M3 remove the `request()` override | `FAILED (failures=2)` | **CAUGHT** |
| M4 `delay_seconds` 10 → 3 | `FAILED (failures=1)` | **CAUGHT** |
| M5 `num_retries` 5 → 2 | `FAILED (failures=1)` | **CAUGHT** |
| M6 page-size cap 1000 → 100 | `FAILED (failures=1)` | **CAUGHT** |
| M7 install degrades silently instead of raising | `FAILED (errors=1)` | **CAUGHT** |
| M8 `iter_results` stops catching `requests…Timeout` | `FAILED (failures=1)` | **CAUGHT** |
| M9 `DEFAULT_REQUEST_TIMEOUT_SECONDS` 60 → **600** | `Ran 86 … OK` | **SURVIVED** → I-2 |
| M10 `DEFAULT_REQUEST_TIMEOUT_SECONDS` 60 → **5** | `Ran 86 … OK` | **SURVIVED** → I-2 |
| M11 assign a fresh plain `requests.Session()` (spec's literal wording) instead of the class swap | `FAILED (failures=4)` | **CAUGHT** |
| M12 add a redundant `get()` override alongside `request()` | `Ran 86 … OK` | equivalent mutant, not a gap |

I reproduce the implementer's 8/8 and add M11. **M9/M10 are genuine survivors** (§9, I-2).

**Against the original source** (`git show HEAD:scripts/arxiv_common.py`): 5 of the 8 error out on
missing `TimeoutSession` / `install_request_timeout` / `DEFAULT_REQUEST_TIMEOUT_SECONDS`. The 3 that
still pass are the additive-`setdefault` guard, the page-size cap, and the pacing pin — all proven
non-vacuous by M2/M4/M5/M6 above.

### 6.1 FAST — confirmed

```
TOTAL 1.108s over 86 tests
any test >5s: False
  1.044s  test_arxiv_common.BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging
  0.011s  …(next slowest)
```

Nothing sleeps 60 s: `tests/test_arxiv_common.py:272` patches
`DEFAULT_REQUEST_TIMEOUT_SECONDS = 1`, and `:295` uses `worker.join(timeout=20)` plus
`assertFalse(worker.is_alive(), …)` at `:298`, so a regression to unbounded **fails in ~20 s**
rather than hanging (visible above as the 20.1 s mutant runs).

### 6.2 HERMETIC — one disclosed, accepted exception

My own socket-blocked run (`/tmp/v198/hermetic.py`, blocking `socket.connect`,
`create_connection`, `getaddrinfo`):

```
HERMETIC RESULT: ran=86 failures=1 errors=0
  NOT-HERMETIC: test_arxiv_common.BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging
```

Exactly the 1 of 86 the implementer disclosed (§7.1 of their report). It binds `127.0.0.1:0`
(`tests/test_arxiv_common.py:165`), resolves no name, reaches no external host, and closes in
`addCleanup` (`:276`). Correct trade: no mock can show that a *hang* is bounded. The other 7 new
tests are fully socket-free (`RecordingAdapter` is mounted, `:243`, `:251`).

**However** `.improve/REPO_PROFILE.md:101-104` still asserts the opposite and was **not** updated
(`git status --short .improve/REPO_PROFILE.md` → clean). → issue **I-5**.

### 6.3 No existing test weakened, skipped, or deleted

- `git diff --numstat -- tests/` → `181  0  tests/test_arxiv_common.py`. **Zero deletions.**
- `git diff -U0 -- tests/ | grep -c '^-[^-]'` → **0**.
- All 8 pre-existing `test_arxiv_common.py` test names survive; 8 new names added; no duplicates
  (programmatic diff of `def test_\w+` between `git show HEAD:` and the working tree).
- `test_build_index.py` (42) and `test_paper_collector.py` (28) are **unmodified**. The one
  `skipTest` in the suite (`test_paper_collector.py:413`) is pre-existing and untouched.
- **78 → 86 = +8**, arithmetically consistent.
- Baseline confirmed at HEAD: 78 tests; working tree: 86.

---

## 7. THE MISSING REQUIREMENT — `requests` is not declared

```
$ grep -in "requests" requirements.txt
NO -- requests is NOT declared (transitive only)
```

`requirements.txt:13-14` is exactly:

```
arxiv>=2.1.0,<4
pandas>=2.0.0
```

`scripts/arxiv_common.py:12` now does `import requests` **directly**, and the hook is load-bearing on
`requests.Session.request` (`:44-45`), the `isinstance` check (`:66`), and
`requests.exceptions.Timeout` (`:133`).

**Is it a real latent defect? Yes, but LOW severity and currently guarded.** Honest assessment:

- **No new `ImportError` surface today.** `arxiv/__init__.py` imports `requests` unconditionally and
  `Client.__init__` calls `requests.Session()`, so `import requests` can only fail where
  `import arxiv` (line 11, one line earlier) already failed. The implementer's §2.3 reasoning is
  correct.
- **Guarded against a `requests` → `httpx` migration inside arxiv.** That migration would be a
  deliberate arxiv major, blocked by `requirements.txt:13`'s `<4` (IMP-033), and
  `scripts/arxiv_common.py:66` would then raise `TimeoutNotInstalled` — a *clear* error, not a
  silent unbounded run. The fail-loud design converts this from a latent defect into a loud one.
- **Still wrong to ship.** The repo has no lockfile and no hashes, so `requests` is resolved
  transitively and unpinned. I observed it at **2.32.3** (system) and **2.33.1** (my
  `requirements.txt` venv) — two different minors in one day. The hook's coverage of the connect
  path depends on `requests.adapters.HTTPAdapter.send` mapping `MaxRetryError(ConnectTimeoutError)`
  to `requests.exceptions.ConnectTimeout` rather than a bare `ConnectionError`; I verified that
  branch exists in **both** installed versions
  (`adapters.py:685` in 2.32.3, `adapters.py:663` in 2.33.1), but it is an unpinned, unasserted
  dependency of the new `except` clause.

**Action:** add `requests>=2.31.0` to `requirements.txt`. It was out of the implementer's declared
write scope and correctly reported rather than silently skipped. → issue **I-3**.

---

## 8. FULL SUITE — exact results

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 86 tests in 1.109s

OK
```

Baseline at HEAD for comparison: `Ran 78 tests / OK`.

Also green under the **CI-resolved** dependency set (my own venv, `arxiv 3.0.0`,
`requests 2.33.1`):

```
$ /tmp/v198/myvenv/bin/python -m unittest discover -s tests
Ran 86 tests in 1.095s
OK
```

Web suite: `npm test` → `Test Files 16 passed (16)`, `Tests 253 passed (253)`;
`npm run typecheck` → exit 0; `npm run build` → exit 0.

## 9. YAML VALIDATION

```
$ /usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); …"
job  web-tests timeout-minutes = 10
step Build the paper index    = 5
```

PyYAML 6.0.1; both files parse; both keys are in the official schema at the correct level (§5.1).

---

## 10. ISSUES (all non-blocking; none defeats either acceptance criterion)

**I-1 — `timeout-minutes: 5` is smaller than the client-level worst case.**
`scripts/arxiv_common.py:18,19` (`num_retries=5`, `60 s`) ⇒ up to **6 attempts × 60 s = 360.08 s
measured** on the connect-timeout path, because `arxiv/__init__.py:165-166` only records
`_last_request_dt` *after* a successful `get`, so `delay_seconds` never spaces the retries. The
300 s step cap at `.github/workflows/ci.yml:48` fires ~60 s early, pre-empting IMP-004's readable
hard-fail message. No hang, no runner-hour burn, and legitimate runs are unaffected (0.66 s
measured, ~450× headroom) — so this is diagnostic quality, not a new flake source. Fix: raise the
job cap to 15 and the step cap to 8 (`5 + 8 = 13 ≤ 15`, still ~700× the legitimate step cost), or
set `DEFAULT_REQUEST_TIMEOUT_SECONDS = 30` (worst case 180 s < 300 s) at the cost of headroom for
the deploy's `page_size=1000` multi-MB fetches. Do **not** simply raise the step cap past the job
cap.

**I-2 — the 60 s value is pinned by no test.** Mutants M9 (60 → 600) and M10 (60 → 5) both leave
`Ran 86 tests … OK`. `tests/test_arxiv_common.py:206` and `:246` both compare against
`arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS` itself, which is vacuous for the *value*; only the
pacing parameters are pinned as literals (`:215-217`, and M4/M5/M6 confirm those work). Since I-1's
fix is exactly a change to this constant, nothing would catch a bad edit. Fix: add
`self.assertEqual(arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS, 60)` to `BuildClientTests`, and a
comment tying the value to the step cap.

**I-3 — `requirements.txt` does not declare `requests`, which
`scripts/arxiv_common.py:12` now imports directly.** See §7. Add `requests>=2.31.0`.

**I-4 — `.github/workflows/deploy.yml:33-34` still has no `timeout-minutes` at either level.** Spec
AC2 named it explicitly and the implementer supplied a patch without applying it (out of declared
write scope, reported not hidden). The source-level timeout does bound deploy's requests, so a
network partition now costs **5 categories × 360 s = 30 runner-minutes uncapped** rather than
unbounded (§5.4). The implementer's proposed values (`timeout-minutes: 20` job / `10` step) are
sane and should be applied.

**I-5 — `.improve/REPO_PROFILE.md:101-104` is now stale.** It still asserts "Fully offline and
hermetic … Confirmed hermetic by re-running with `socket.connect` / `create_connection` /
`getaddrinfo` blocked: 78 run, 0 failures" and gives the breakdown as
`test_arxiv_common.py (8), test_build_index.py (42), test_paper_collector.py (28)`. Measured truth
is **86 run, 1 failure** and **(16), (42), (28)**. The implementer disclosed this in their report
§7.1 but did not update the repo-level profile, which now makes a false claim.

---

## 11. What I could not fully settle

- I could not make the connect-timeout measurement hermetic: `192.0.2.1` (RFC 5737 TEST-NET-1) is
  unroutable, so the SYN is dropped somewhere between this machine and the void. It resolves to a
  loopback-free black hole and returns `ConnectTimeoutError` reliably, but it is not pure loopback.
  The alternative (a `listen(0)` accept-queue overflow) did not blackhole on this kernel — both
  connects succeeded in 0.00 s — so I used TEST-NET-1. Every other probe is pure loopback.
- I did not evaluate whether `timeout-minutes: 5` is the *right* number independent of
  consistency; §5.3 shows only that it cannot cut off a legitimate run.
- `paper-collector.py` builds no client of its own (`grep -rn "arxiv.Client(" scripts/*.py` → one
  hit, `arxiv_common.py:82`), so its download paths inherit the bound. I did not separately probe
  `Result.download_pdf`/`download_source`, which arxiv issues through the same session.