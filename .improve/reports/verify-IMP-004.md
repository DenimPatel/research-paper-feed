# VERIFY — IMP-004 — Refuse to write an index after any category's arXiv query failed

**Verifier:** independent sub-agent (did not write the change)
**Date:** 2026-10-02
**Scope reviewed:** `git diff -- scripts/ tests/` + untracked files under `scripts/`/`tests/`
**Baseline SHA:** `1c075b3` equivalent (`HEAD` = pre-change)

---

## VERDICT: **PASS** (with 4 non-blocking observations, 0 blocking defects)

All 3 acceptance criteria are met, the hard-fail policy is the one the spec asks for and is
recorded, the exit code genuinely propagates to the process status, `deploy.yml` would notice,
the new tests are hermetic and fast, and 7 of the 9 new tests provably fail when the fix is
reverted.

---

## 1. Scope and hygiene

`git status --porcelain --untracked-files=all -- scripts/ tests/` returns **only** four tracked
modifications — no new files, no strays:

```
 M scripts/arxiv_common.py
 M scripts/build_index.py
 M tests/test_arxiv_common.py
 M tests/test_build_index.py
```

The other entries in the repo-root `git status` (`web/package*.json`, `web/vite.config.ts`,
`web/src/__tests__/`, `web/src/test-setup.ts`, `.improve/reports/*`) belong to the concurrent
IMP-005 agent and the loop; they are out of scope and were not reviewed.

Diff size: `scripts/arxiv_common.py` +13/−2, `scripts/build_index.py` +28/−8,
`tests/test_arxiv_common.py` +25/−0, `tests/test_build_index.py` +~100/−0. Nothing else touched.

* **No scope creep.** `scripts/paper-collector.py` (the §6 compatibility surface) is untouched;
  `record_from_result`, `build_shards`, `write_index`, `parse_args`, and every wire field are
  untouched. No wire-format change ⇒ no `web/src/lib/types.ts` mirror obligation.
* **No debug code / TODOs / secrets / prints.** Scanned every added line for
  `TODO|FIXME|XXX|HACK|print(|breakpoint|pdb|api_key|secret|token|password|sleep(|time.|assert False`
  — the only hit is `datetime.now(timezone.utc)` in the new test helper `make_result`
  (`tests/test_build_index.py:43`), which is expected (see nit N-3).
* **No real-time sleeps.** The whole suite runs in **0.023 s**. No `time.sleep`, no `unittest.skip`
  on network.
* `git status --porcelain` is byte-identical before and after running the suite and
  `compileall`. `scripts/__pycache__/*.pyc` is gitignored (profile PE-15, pre-existing noise).
* Style matches profile §5.2: double quotes, 4-space indent, `"""` docstrings, no new comments
  except one `# pragma: no cover` on an otherwise-puzzling bare `yield`
  (`tests/test_build_index.py:279`), `import tempfile` inside the test bodies that need it,
  monkeypatches restored in `tearDown` or `try/finally`.
* `new_status()` is a new public helper in `scripts/arxiv_common.py` and is covered by 3 tests in
  the 1:1 mirror `tests/test_arxiv_common.py` — satisfies profile §4.3 item 3.

---

## 2. Acceptance criteria, one by one

### AC1 — `iter_results` exposes exhaustion vs. `ArxivError`; `collect_papers` records it per category

**MET.**

* `scripts/arxiv_common.py:29-31` — `new_status()` returns `{"failed": False, "error": None}`.
* `scripts/arxiv_common.py:34` — `iter_results(query, max_results, status=None)`; the holder is a
  third optional positional argument, so `scripts/paper-collector.py:60`
  (`iter_results(topic, max_papers)`) is unaffected — **verified by grep: `paper-collector.py` is
  the only other caller and passes two arguments.**
* `scripts/arxiv_common.py:48-49` — reset on entry, deliberately **before** the
  `max_results <= 0` early return. Empirically confirmed (probe 1 below): `max_results=0` leaves
  `{"failed": False, "error": None}`, i.e. no false failure.
* `scripts/arxiv_common.py:71-73` — on `arxiv.ArxivError`, sets `failed=True` and records `str(exc)`.
* `scripts/build_index.py:224-239` — one fresh holder per category; the failure is appended to the
  `failures` out-list, logged at ERROR with the error text, and the loop `continue`s so *all*
  failed categories are named, not just the first.

**Does the caught class cover real arXiv outages?** `arxiv 2.1.3` installed here.
`arxiv.HTTPError.__mro__ = (HTTPError, ArxivError, Exception, …)` and
`arxiv.UnexpectedEmptyPageError.__mro__ = (UnexpectedEmptyPageError, ArxivError, …)`; both
`issubclass(..., arxiv.ArxivError) is True`. Those are the two classes a dead/blocked endpoint
actually produces, and `build_client` sets `num_retries=5`, so transient blips retry first. The
hard-fail gate is not bypassed by a real outage.

### AC2 — `main()` returns non-zero, writes nothing, log names the failed categories

**MET.** Hard-fail is the spec's **first-listed** option
(`.improve/FEATURES.md:145`: "`main()` returns a non-zero exit code and writes nothing when any
requested category's query failed; the log states which categories failed"). The degraded-index
alternative is explicitly not required and is correctly not taken — it would have needed a new
`index.json` field plus reader-side UI in `web/`, i.e. the trap-1 wire-format change.

`scripts/build_index.py:310-315`:

```python
if failures:
    logging.error(
        "Refusing to write an index: the arXiv query failed for %s.",
        ", ".join(failures),
    )
    return 1
```

Observed on a real subprocess run with one failing category:

```
ERROR:root:ArXiv search failed for 'cat:cs.LG': HTTP 503: simulated outage (…)
ERROR:root:  query failed for cs.LG: HTTP 503: simulated outage (…)
ERROR:root:Refusing to write an index: the arXiv query failed for cs.LG.
EXIT=1     out-dir exists=no
```

The design choice is recorded in `.improve/reports/impl-IMP-004.md:15-31`, satisfying
"pick one and say which". No CLI flag, default, or `--help` text changed (`--help exit=0`, output
identical).

### AC3 — new test drives `main()` with a fake `iter_results` that **raises** for one category

**MET.** `tests/test_build_index.py:304-330`,
`MainTests.test_refuses_to_write_index_when_a_category_query_fails`: a fake `iter_results`
**raises** the real `arxiv.ArxivError` for `cat:cs.LG` and yields `make_result("2401.00001")` for
`cat:cs.CV`; asserts `exit_code != 0`, `os.listdir(out_dir) == []` (stronger than "index.json not
written"), and that `cs.LG` appears in the captured ERROR log. Exactly what the criterion asks for.

---

## 3. Critical scrutiny — data-integrity pipeline

### 3.1 Exit code is NOT swallowed (the recon's concern)

`scripts/build_index.py:336-337` is `sys.exit(main())`. I confirmed via `git show HEAD:scripts/build_index.py`
that this line is **pre-existing and unmodified by this item**, so the return value has always
propagated. Confirmed empirically by invoking the real script as a subprocess:

| scenario | exit |
|---|---|
| healthy, 2 categories | **0** |
| `cs.LG` query fails | **1** |
| `cs.CV` fails, other 4 succeed (default 5 categories) | **1** |
| only `cs.RO` (last of the 5 defaults) fails | **1** |
| `--help` | **0** |
| `--max-per-category 0` | **0** |

### 3.2 Would CI/deploy notice?

`.github/workflows/deploy.yml:33-34` runs `python scripts/build_index.py` with **no**
`continue-on-error`, no `if: always()`, and no `|| true`; `deploy` has `needs: build`
(`deploy.yml:57`). A non-zero exit therefore fails the step, fails the `build` job, and skips the
deploy — the previously published site keeps serving its last complete index. `.github/workflows/ci.yml:18-19`
runs `python -m unittest discover -s tests -v`, which now contains the regression test. Confirmed
the `build` step is the *first* consumer of the result and nothing downstream re-runs it.

### 3.3 It does NOT fail on success paths, and partial-but-successful runs work

Six targeted in-process probes (hermetic fakes), all passing:

```
1) max_results<=0                -> status {'failed': False, 'error': None}   (no false failure)
2) empty-but-successful category -> failures []  | records 1                (0 papers ≠ failure)
3) retention `break` mid-stream  -> failures []  (generator close ≠ failure)
4) duplicate --category          -> failures ['cs.CV', 'cs.CV']             (cosmetic, nit N-2)
5) partial-but-successful run    -> failures ['cs.AI'] | records still returned to the caller
6) main(), only cs.RO fails      -> exit 1 | out-dir contents []
```

Probe 5 answers the "does `collect_papers` still return partial data to callers that need it"
question: **yes.** It returns every record it gathered *and* the `failures` list; `main()` is the
only caller and discards both on the failure path. No caller is deprived of data it needs.

### 3.4 Hermeticity

No new test touches the network. Every one of the 9 new tests substitutes `iter_results`,
`build_client`, or `collect_papers`. Suite wall time **0.023 s** for 39 tests. No sleeps.

### 3.5 Other callers — nothing broken

* `scripts/paper-collector.py:60` — the only other `iter_results` caller; passes 2 args, so
  `status=None` and its legacy swallow-and-continue contract is preserved exactly.
* `collect_papers` — only caller is `main()` (`build_index.py:303`). The two pre-existing
  `MainTests` stub it with `lambda *args, **kwargs` (`tests/test_build_index.py:293, 367`); the
  out-parameter design keeps both passing **unchanged**, as claimed.
* `notebooks/paper-collector.ipynb` builds its own client and never imports `arxiv_common` — no
  coupling (profile trap 6).

### 3.6 Stale shard files / the `write_index` path

The new early return at `build_index.py:315` fires **before** `dedupe_records`, `build_shards`,
and `write_index` (`build_index.py:326`), so `_clean_old_shards` (`build_index.py:244-252`) is
never reached on the failure path. Verified: a failing run over a previously successful index left
the directory **byte-identical** —

```
before: index.json papers-2026-W40.json | manifest sha: c1939b066771
after:  index.json papers-2026-W40.json | manifest sha: c1939b066771
every shard referenced resolves: True
orphan papers-*.json not in manifest: []
```

So the site keeps serving the last *complete* index — no stale-shard/404 window is opened, and
this is strictly better than the old behaviour (which published a truncated index). This is the
same "leave the previous good output alone" property the pre-existing empty-index refusal already
had, so **no new failure mode**.

---

## 4. Do the new tests assert what they claim? (empirical revert)

Scratch harness: `/tmp/verify-imp004/{current,reverted,baseline}`. `current` = copies of the repo's
`scripts/` + `tests/`; `reverted` = same tests but with `scripts/arxiv_common.py` and
`scripts/build_index.py` restored from `git show HEAD:…` (byte-compared against HEAD: identical);
`baseline` = HEAD scripts **and** HEAD tests. The repo was never modified.

### Baseline (HEAD scripts + HEAD tests)
```
HEAD baseline -> exit=0 Ran 30 tests in 0.019s OK
  HEAD test_arxiv_common = 5 | test_build_index = 18 | test_paper_collector = 7
```

### After the change
```
/usr/local/bin/python3.11 -m unittest discover -s tests -v
EXIT=0
Ran 39 tests in 0.023s
OK
  test_arxiv_common = 8 | test_build_index = 24 | test_paper_collector = 7
```

Baseline 30 → 39, **+9**, implementer's claim of 39 confirmed; per-file composition also matches
`impl-IMP-004.md:77-78` exactly.

### New tests against the reverted source
```
EXIT=1
Ran 39 tests … FAILED (errors=7)
ERROR: test_status_holder_reports_a_failed_query
ERROR: test_status_holder_reports_an_exhausted_query
ERROR: test_status_holder_is_reset_for_each_query
ERROR: test_records_failed_categories_separately_from_records
ERROR: test_healthy_categories_report_no_failures
ERROR: test_arxiv_error_raised_by_iter_results_is_classified_as_failure
ERROR: test_refuses_to_write_index_when_a_category_query_fails
```

**7 of 9 new tests fail on revert, for the right reasons:**

* `test_refuses_to_write_index_when_a_category_query_fails` → the `arxiv.ArxivError` escapes
  `collect_papers` and `main()` entirely (traceback points at the reverted `build_index.py:214`
  `for result in arxiv_common.iter_results(query, limit):`). That *is* the pre-fix defect.
* `test_healthy_categories_report_no_failures` / `test_records_failed_categories_separately_from_records`
  → `TypeError: collect_papers() takes 4 positional arguments but 5 were given`.
* The three `test_status_holder_*` → `AttributeError: module 'arxiv_common' has no attribute 'new_status'`.

**The 2 that do not regress-detect (both benign):**
* `test_writes_index_when_every_category_query_succeeds` — by design a *guard* against the new
  check firing on a healthy run; it must pass before and after.
* `test_failures_list_is_optional` (`tests/test_build_index.py:268-270`) — passes on the reverted
  code too, because the reverted `collect_papers` accepts 4 args and the fake yields nothing, so
  `records == []` holds either way. It documents the optional-parameter contract but detects
  nothing. Weak, harmless.

### Mutation testing (fix removed piecewise, current tests kept)
```
MUT1  delete status.update(failed=True,…) in arxiv_common.py  -> exit=1  FAILED (failures=2)
        FAIL test_status_holder_reports_a_failed_query
        FAIL test_status_holder_is_reset_for_each_query
MUT2  main(): "if failures:" -> "if False:"                    -> exit=1  FAILED (failures=1)
        FAIL test_refuses_to_write_index_when_a_category_query_fails
```
Every load-bearing piece of the fix is individually pinned by at least one test. (A third
mutation — deleting the `except ArxivError` in `collect_papers` — leaves a `try:` with no handler
and is a `SyntaxError`, i.e. not a valid mutation; its coverage is already established by the full
revert.)

### Assertions read line by line — they are honest
No test asserts a tautology. `MainTests` asserts a real directory listing, a real manifest
`totalPapers == 2`, a real `categories` list, and a real captured ERROR log. `CollectPapersTests`
asserts the exact `failures` list value, not truthiness.

---

## 5. Item's `Verification method`

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
  EXIT=0   Ran 39 tests in 0.023s   OK
```

```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests
  compileall exit=0
```

Live-network smoke (spec names `/tmp/rpf-venv/bin/python`, but `/tmp/rpf-venv` does not exist on
this machine — profile PE-5's documented substitute is used, exactly as the implementer did):

```
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 \
      --out-dir /tmp/rpf-failcheck
LIVE EXIT=0
  INFO:arxiv:Got first page: 5 of 207907 total results
  INFO:root:  5 papers within retention window for cs.CV
  INFO:root:Wrote 5 papers across 1 shards to /tmp/rpf-failcheck
  files: index.json papers-2026-W40.json
  categories: ['cs.CV'] totalPapers: 5 generatedAt: 2026-10-02T04:44:54Z
```
`echo $?` is `0`. Simulated failure confirmed via the new unit test, as the spec directs (not by
unplugging the network), **plus** the stronger offline subprocess harness in §3.1/§3.6.

---

## 6. Observations (none blocking)

**N-1 — Docstring self-contradiction in `scripts/arxiv_common.py:37-40`.** The first paragraph still
says the swallow "lets the index builder fail loudly later when it has zero records" — that was
the *pre-fix* behaviour and is now wrong; the index builder fails because the holder says so, not
because the record set is empty. The second paragraph (added by this change) correctly documents
the holder but does not retract the first. Suggest deleting "…and lets the index builder fail
loudly later when it has zero records." from line 39-40.

**N-2 — Duplicate `--category` values are reported twice.** `main(["--category","cs.CV","--category","cs.CV"])`
logs `the arXiv query failed for cs.CV, cs.CV.` (`failures` is appended per loop iteration, not
per unique category). Cosmetic; `parse_args` does not dedupe and never did.

**N-3 — `make_result()` uses the real clock** (`tests/test_build_index.py:43`,
`datetime.now(timezone.utc)`), so the new tests depend on wall time staying within the default
60-day retention window. Flakiness risk is effectively zero and it is a test-only helper, but it
sidesteps profile PY-19 (`collect_papers` has no injectable clock). Not a regression.

**N-4 — No committed test wires the *real* `iter_results` holder through `main()`.**
`MainTests.test_refuses_to_write_index_when_a_category_query_fails` uses a fake that **raises**, so
it exercises the `except ArxivError` branch at `build_index.py:232-233`, not the status-holder
branch; the holder→`collect_papers` wiring is covered by `CollectPapersTests`. AC3's literal
wording prescribes the raising fake, so this is compliant — and MUT1/MUT2 show both halves are
individually pinned — but a single test that drives the real `iter_results` (via the existing
`FakeClient` + `SimpleNamespace` swap in `tests/test_arxiv_common.py:49-65`) through `main()`
would close the composition gap. The implementer's "unreachable `except` branch" note
(`impl-IMP-004.md:105-108`) overstates it: the branch is what AC3's mandated test drives.

---

## 7. Items for the coordinator (outside this item's allowed paths)

1. **`.improve/REPO_PROFILE.md` is now stale and actively misleading.** §8 trap 3 ("A partially-failed
   index deploys silently with exit 0"), §3.4 line 168 ("A run that *partially* fails exits 0 with a
   silently truncated index"), and §9 `PY-6` all describe the defect this change fixed. The
   implementer flagged this correctly (`impl-IMP-004.md:100-102`) and §9's own preamble requires the
   row be updated by whoever fixes it. **PY-18 remains open** and was consciously left alone
   (correctly — it is its own backlog item).
2. **Operational amplification of the hard-fail risk.** The spec itself notes "hard-failing could
   turn a partial outage into a red deploy", and the choice was correctly recorded. But
   `deploy.yml:5-6` schedules `0 6 * * 0` — **weekly** — while its own comment says daily (PE-4 /
   INF-02). So after this change a single transient arXiv failure costs up to **seven days** of
   stale site content instead of one. If the coordinator wants to soften this, the natural pairing
   is a `--retry-on-category-failure`/degraded-index follow-up, or fixing INF-02 first. Not a
   defect of IMP-004.
3. `README`/`CONTRIBUTING.md` document no exit codes today, so nothing became stale. `readme.md`
   does describe `build_index` flags (`:42-44`); no flag changed.

---

## 8. Reproduce everything in this report

```sh
cd /Users/denimpatel/Desktop/git/research-paper-feed
/usr/local/bin/python3.11 -m unittest discover -s tests -v          # EXIT=0, Ran 39, OK
/usr/local/bin/python3.11 -m compileall -q scripts tests            # EXIT=0
git status --porcelain --untracked-files=all -- scripts/ tests/     # 4 modified files, nothing untracked

# revert-the-fix proof (scratch only; repo untouched)
rm -rf /tmp/verify-imp004/reverted && cp -R /tmp/verify-imp004/current /tmp/verify-imp004/reverted
for f in scripts/arxiv_common.py scripts/build_index.py; do
  git show "HEAD:$f" > "/tmp/verify-imp004/reverted/$f"; done
(cd /tmp/verify-imp004/reverted && /usr/local/bin/python3.11 -m unittest discover -s tests -v)
#   -> EXIT=1, Ran 39, FAILED (errors=7)

# end-to-end exit-status proof with an offline arxiv stand-in
PYTHONPATH=/tmp/verify-imp004/fakearxiv RPF_FAIL_CATEGORIES="cs.LG" \
  /usr/local/bin/python3.11 /tmp/verify-imp004/current/scripts/build_index.py \
  --category cs.CV --category cs.LG --out-dir /tmp/verify-imp004/out-f2
echo $?     # 1, and the out-dir was never created
```