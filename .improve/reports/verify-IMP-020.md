# Verification — IMP-020

**Item:** make the retention window a filter, not only an ordered `break`.
**Verifier:** independent, skeptical (did not write the change).
**Date:** 2026-10-02. Baseline SHA `5ff96a0`. Working tree `improve/auto-20261002`.
**Scope reviewed:** `git diff -- scripts/ tests/` — `scripts/build_index.py` (+38/-4),
`tests/test_build_index.py` (+104/-1). `web/` ignored (concurrent IMP-019).
No git write commands run. No source file modified.

---

## VERDICT: **PASS** — 3/3 acceptance criteria met, no regressions.

The change is correct, better-tested than required, and defensible. The
implementer's central judgment call — the opt-in `assume_newest_first` fast path —
is **justified and safe**, and I reached that conclusion against my own
measurements, not by accepting the report's argument. My independent reproduction
found **one number in the report that does not replicate** (run B: I measured
1205 → 1204, not 1208 → 1208), and I proved that gap is clock drift between
sequential runs rather than over-filtering.

---

## 1. Acceptance criteria

### AC1 — undated dropped before counting; old dropped order-independently — **MET**

`scripts/build_index.py:246-259`. The fused `if published is not None and
published < cutoff: break` (pre-fix `:233-234`) is split into three per-record
branches:

| Branch | Line | Action |
| --- | --- | --- |
| `published is None` | `build_index.py:248-252` | `undated += 1; continue` — **dropped** |
| `published < cutoff`, `assume_newest_first=False` | `:253, :257` | `continue` — **dropped, iteration continues** |
| `published < cutoff`, `assume_newest_first=True` | `:253, :255-256` | `break` — shortcut only |

* "Dropped **before counting**": `count += 1` is at `:259`, reachable only after
  both filters. The `  %d papers within retention window` log (`:274`) therefore
  reports post-filter count. Pinned by
  `tests/test_build_index.py:419-430` (asserts the log says `1`, not `3`).
* "Order-independent": the default path `continue`s rather than `break`s, so a
  fresh record appearing *after* a stale one is still considered. Pinned by
  `test_only_fresh_records_survive_out_of_order_iteration` — and by **mutation
  testing** (§5), which is the only proof that actually matters here.

### AC2 — out-of-order fake-`iter_results` test — **MET**

`tests/test_build_index.py:385-406` installs a fake
`build_index.arxiv_common.iter_results` (pattern already established by
`CollectPapersTests` at `:299-309`) yielding, in order:

1. `2401.00001` — fresh (`now`)
2. `2401.00002` — stale (`now - 365d`)
3. `2401.00003` — string `"2001-01-01"`
4. `2401.00004` — fresh (`now - 1d`)

and asserts `["2401.00001", "2401.00004"]`.

**The implementer's deviation from AC2's literal wording is correct and I endorse
it.** AC2 says "yielding (new, old, string-dated) … asserts only the new one
survives". In that exact 3-tuple the assertion is *vacuous*: pre-fix code appends
`new`, then `break`s on `old`, never reaching the string-dated record, so "only
the new one survives" already passed before the fix. I verified this directly
(§5). Adding a 4th fresh record is the minimum change that makes the test
non-vacuous, and the inline comment at `:386-389` explains exactly why.

### AC3 — one-line comment naming the sort dependency — **MET**

Two comments were added; both name the file and the criterion.

`build_index.py:254` (one physical line, 86 chars):
```python
# Load-bearing on arxiv_common.py's SubmittedDate/Descending sort.
```

`build_index.py:401-402` (at the `collect_papers(...)` call site in `main()`):
```python
# This caller knows the query is the one arxiv_common sorts by
# submission date, newest first, so it can stop paging early.
```

**The comment is accurate about WHERE the sort lives.** Quoting
`scripts/arxiv_common.py:54-62`:
```python
    search = arxiv.Search(
        query=query,
        ...
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,      # arxiv_common.py:60
        sort_order=arxiv.SortOrder.Descending,           # arxiv_common.py:61
    )
```
The spec cited `arxiv_common.py:47-48`; that is stale line numbering (pre-IMP-004).
The real sort is `:60-61`, and it is **unchanged by this diff**. Because the
comment names the *file and the criterion* rather than a line number, it will not
rot. Independently confirmed at runtime — the live request URL from my run A was:

```
https://export.arxiv.org/api/query?search_query=cat%3Acs.CV&id_list=
  &sortBy=submittedDate&sortOrder=descending&start=0&max_results=5
```

`sortBy=submittedDate&sortOrder=descending` — exactly what the comment claims.

**Note on AC3's wording:** "a one-line comment". The `main()` site comment is two
lines; the one-line requirement is satisfied by `:254`. Both are present, so the
criterion is met either way.

---

## 2. The `assume_newest_first` API change — scrutinized

### 2a. Scope creep or justified?

**Justified, and the spec itself sanctions it.** Three reasons:

1. **AC3 is evidence the spec authors wanted the reliance to *survive*.** AC3 asks
   for a comment "naming the sort dependency" at the call site. You do not
   document a dependency you have removed. The spec's intent (`FEATURES.md:477`)
   is "the ordered `break` is also load-bearing … which is undocumented at the
   call site" — i.e. make the reliance *visible and switchable*, not eliminate it.
   `assume_newest_first` is precisely that.
2. **It serves a real efficiency purpose, which I verified.** `main()` passes
   `limit = UNLIMITED = 100000` (`build_index.py:236, :45`) whenever
   `--max-per-category` is 0 (the default, `:372`). My live probe reported
   `Got first page: 5 of 207907 total results` for `cat:cs.CV`. With no early
   stop, a 60-day window would page ~8–9k results/category at
   `delay_seconds=10` (`arxiv_common.py:16`) — hours per category across 5
   categories, and exactly the API hammering PY-13 flags. The fast path is not
   speculative.
3. **It is off by default**, so it cannot silently change any caller's semantics.

The cost of the alternative — deleting the `break` — is a production deploy that
runs for hours. That is a worse trade than an opt-in flag with a documented
precondition.

### 2b. Is the fast path SAFE? — every caller enumerated

`collect_papers` has exactly **two** classes of caller. Full grep over
`*.py` (excluding `.kilo/`):

| Caller | `assume_newest_first` | Receives newest-first? |
| --- | --- | --- |
| `scripts/build_index.py:395` (`main()`) | **`True`** (`:403`) | **YES** — see below |
| `tests/test_build_index.py:317, 326, 332, 345` (`CollectPapersTests`) | default `False` | n/a (safe path) |
| `tests/test_build_index.py:379, 443` (`CollectPapersRetentionTests`) | default `False` / explicit `True` | n/a (fake iterators) |
| `tests/test_build_index.py:457, 531, 663` | stubbed with `lambda *a, **k` | n/a |
| `scripts/paper-collector.py` | **does not call `collect_papers`** | n/a |

**There is exactly ONE production caller: `main()`.** It reaches the network only
through `build_index.py:246` → `arxiv_common.iter_results` →
`arxiv_common.py:60-61` `SubmittedDate/Descending`. Confirmed live by the URL
above.

I did not take this on faith. I captured **2,000 real arXiv results** for
`cat:cs.CV` to `/tmp/v020-probe/stream.pkl` and measured monotonicity:

```
2000 results, 0 out-of-order positions (a newer result appearing after an older one)
strictly non-increasing published: True
span: 2026-10-01T17:59:59+00:00 -> 2026-09-18T06:45:37+00:00
duplicates in stream: 4   (timestamp ties; ties do not violate the break)
```

Zero inversions over 2,000 results. The `break` fires at the correct place.

### 2c. Is the default the safe path? — **YES**

`build_index.py:216`: `assume_newest_first=False`. It is a keyword-or-positional
parameter appended *after* the existing `failures=None`, so all six existing
call sites (`:317`, `:326`, `:332`, `:345`) keep working unchanged and get the
safe path. Confirmed by the full suite passing.

### 2d. Is it documented in the docstring? — **YES**

`build_index.py:229-233`, and it is honest about the precondition rather than
glossing it:
> ``assume_newest_first`` is the extra shortcut, not the filter -- it stops
> reading a category at its first out-of-window result instead of paging through
> the rest of the feed, which is only sound because arXiv answers newest-first.
> It is off by default so the filter cannot be defeated by an unexpected order;
> callers that can vouch for the sort opt in.

### 2e. Verdict on the API change

**Accept.** It is the smaller, more honest change. It converts an *implicit,
undocumented* reliance into an *explicit, documented, off-by-default* one. The
footgun risk the brief anticipated (silent truncation on a wrong caller) is
mitigated by: safe default, single production caller, caller comment, docstring,
live-verified sort, a test guarding that the flag isn't dead code
(`:432-449`), and — importantly — **the filter itself no longer depends on the
flag at all**.

---

## 3. Paper-count regression — reproduced independently

All runs into `/tmp`. Pre-fix copy at `/tmp/v020-before/` (`diff` against
`git show HEAD:scripts/build_index.py` → identical).

### Run A — spec-named, `--category cs.CV --max-per-category 300`

| | before | after |
| --- | --- | --- |
| count | **300** | **300** |
| shards | `2026-W40` 300 | `2026-W40` 300 |
| ID sets | — | **IDENTICAL** (0 only-before, 0 only-after) |

Implementer's 300 → 300 claim **replicates exactly**. But note the implementer's
own point: at 300 results the newest `cs.CV` papers are all inside 60 days, so run
A never reaches the retention boundary and proves nothing about the filter.

### Run B — boundary-crossing, `--max-per-category 2000 --retention-days 7`

| | before | after |
| --- | --- | --- |
| count | **1205** | **1204** |
| shards | W40 929 / W39 276 | W40 929 / W39 275 |
| differing ID | `2609.31454`, published `2026-09-25` | — |

**This does NOT match the report, which claims 1208 → 1208.** I flag it loudly
and then explain it, because the explanation matters more than the number.

`2609.31454` is published `2026-09-25`; today is `2026-10-02`. That is *exactly*
7 days old — sitting on the retention boundary. `cutoff = datetime.now(timezone.utc)
- timedelta(days=retention_days)` (`:235`) uses a **live, un-injectable clock**
(PY-19, still open). The two runs are sequential, ~11 s apart, so the boundary
advances ~11 s and expenses one record.

**Proof by order swap** — I re-ran B with the order reversed (after first):

```
after-B2  (ran FIRST)   totalPapers=1203
before-B2 (ran SECOND)  totalPapers=1203     <-- IDENTICAL when run adjacently
before-B  (ran FIRST)   totalPapers=1205
after-B  (ran SECOND)   totalPapers=1204
```

When the two implementations are run back-to-back with no meaningful gap, they
agree **exactly**. The `1205 vs 1204` gap tracks *which run went first*, not which
implementation ran. Note the monotonic decay 1205 → 1204 → 1203 across the
session: the window is expiring records as wall-clock advances.

**Proof by frozen-clock predicate replay** — decisive and network-free. I applied
the old and new predicates to the *same captured 2,000-result stream* with a
*frozen* cutoff:

```
retention_days=  7: old=1201  new(default)=1201  new(assume_newest_first=True)=1201  | lists byte-identical: True
retention_days= 14: old=1939  new(default)=1939  new(assume_newest_first=True)=1939  | lists byte-identical: True
retention_days= 30: old=2000  new(default)=2000  new(assume_newest_first=True)=2000  | lists byte-identical: True
retention_days= 60: old=2000  new(default)=2000  new(assume_newest_first=True)=2000  | lists byte-identical: True
```

**Identical ID lists, in identical order, at every window.** There is no
over-filtering. The change is a strict behavioural no-op on any real stream.

### Undated-record warning on real data — confirmed never fires

```
captured 2000 real arXiv results
  published type histogram: Counter({'datetime': 2000})
  undated in real stream: 0
```

Across all my runs (300 + 1205 + 1204 + 8025 + 8025 ≈ **18,500 real result
observations**, including 2,000 type-histogramed) the new
`dropped N result(s) with no usable published date` warning **never fired once**.
arxiv 2.1.3 returns a real `datetime` for `published` on every result.

### Full 5-category run — `--max-per-category 2000`, 60-day retention

```
before totalPapers: 8025  [W40 3775, W39 2465, W38 1305, W37 480]
after  totalPapers: 8025  [W40 3775, W39 2465, W38 1305, W37 480]
ID SETS IDENTICAL: True | only-before: [] | only-after: []
```

### On the spec's "2812 across 2 shards" baseline

`web/public/data/index.json` → `totalPapers: 2812`, `generatedAt
2026-10-02T02:44:04Z`, `retentionDays: 60`, shards `2026-W40` 2549
(`2026-09-28`→`2026-10-01`) and `2026-W39` 263 (`2026-09-24`→`2026-09-27`).

**A full run does NOT land near 2812 — mine produced 8025 with only a 2,000/category
cap.** The on-disk figure spans just **8 days** while declaring
`retentionDays: 60`; with `UNLIMITED = 100000` an uncapped 60-day run would yield
far more. So `2812` is a *partial dev artifact* (gitignored, not reproducible by
any documented invocation), and it is internally inconsistent with its own
manifest. **The spec's `2812` is not a sound baseline** — but it is also
irrelevant to this item, because the correct comparison (before vs after) is
**exactly zero difference** on every measurement I took. See F6.

---

## 4. Undated records — is dropping them right?

### 4a. Silent, or logged/counted?

**Not silent.** `build_index.py:243` opens an `undated = 0` tally per category;
`:251` increments it; `:262-267` emits:

```python
if undated:
    logging.warning(
        "  dropped %d result(s) with no usable published date for %s",
        undated, category,
    )
```

`logging.basicConfig(level=logging.INFO, ...)` at `:47` means `WARNING` is
emitted and visible in the deploy log (`deploy.yml:31` runs
`python scripts/build_index.py` as a plain step). So IMP-017's "surface failures
rather than hide them" philosophy **is** honoured, and I confirmed the warning
fires for every non-datetime shape in §4b.

A **total** wipe is loud: every category warns, then `main` hits
`:412-414` → `No papers fetched; refusing to write an empty index.` → exit 1.
That is IMP-004's hard-fail still doing its job.

Residual gap → **F3** below.

### 4b. Complete `_result_datetime` → `None` / comparison shape matrix

`scripts/build_index.py:201-207` is the gate. I drove every realistic shape
through the full `collect_papers` path:

| `published` shape | `_result_datetime` | outcome | logged? |
| --- | --- | --- | --- |
| aware datetime, UTC | aware dt | **KEPT** | — |
| **NAIVE datetime** (fresh) | aware dt (`:206` `replace(tzinfo=utc)`) | **KEPT** | — |
| **NAIVE datetime** (old) | aware dt | **DROPPED (old)** | — |
| aware datetime, `+05:30` | normalized UTC | **KEPT** | — |
| aware datetime, `-08:00`, old | normalized UTC | **DROPPED (old)** | — |
| `datetime` **subclass**, aware / naive | aware dt | **KEPT** | — |
| aware dt, zero-`utcoffset` custom tzinfo | aware dt | **KEPT** | — |
| **`date` object** (no time) | **`None`** | **DROPPED** | **WARNED** |
| **`date`** derived from aware dt | **`None`** | **DROPPED** | **WARNED** |
| `str "2026-09-30"` (fresh!) | **`None`** | **DROPPED** | **WARNED** |
| `str "2001-01-01"` | **`None`** | **DROPPED** | **WARNED** |
| `str "garbage"` | **`None`** | **DROPPED** | **WARNED** |
| `bytes b"2001-01-01"` | **`None`** | **DROPPED** | **WARNED** |
| `None` | **`None`** | **DROPPED** | **WARNED** |
| attribute **entirely missing** | **`None`** | **DROPPED** | **WARNED** |
| `int 0` / `int 1750000000` | **`None`** | **DROPPED** | **WARNED** |
| `float 1.7e9` / `nan` / `inf` | **`None`** | **DROPPED** | **WARNED** |
| `list` / `dict` / `set` / `object()` | **`None`** | **DROPPED** | **WARNED** |
| `bool True` / `complex(1,2)` | **`None`** | **DROPPED** | **WARNED** |
| `datetime.min` naive | aware `0001-01-01` | dropped (old) | — |
| `datetime.max` naive | aware `9999-12-31` | **KEPT** | — |
| `datetime(1970,1,1)` aware | aware | dropped (old) | — |

### 4c. Can `TypeError` escape from the comparison? — **NO**

This is the specific thing the brief asked me to check, because the original bug
*was* a comparison guard. I traced it: `_result_datetime` returns **either an
aware `datetime` (UTC-normalized) or `None`**, never a naive datetime and never a
non-datetime. `:205-206` replaces `tzinfo` on naive input; `:207` `astimezone`s
aware input to UTC. Therefore `published < cutoff` (`:253`) compares
**aware-vs-aware only**, and `None` is intercepted at `:248` before it ever
reaches the comparison.

> **`TypeError: can't compare offset-naive and offset-aware datetimes` is
> structurally unreachable.** Confirmed empirically: the naive rows above
> compare fine.

**OverflowError:** the comparison itself cannot raise. One exotic input can raise
from *inside `_result_datetime`'s `astimezone`* (`:207`):
`datetime.min` with `tzinfo=+14:00` and `datetime.max` with `tzinfo=-12:00` both
raise `OverflowError: date value out of range`. **This is pre-existing and
unchanged by this diff** (`:207` is untouched), is unreachable from the arXiv API
(which never returns year 1 or year 9999), and would be caught by nothing since
`collect_papers` catches only `ArxivError` (`:260`). Recorded as **F4** for the
backlog; **not** a regression from IMP-020.

### 4d. Is dropping them right?

Yes, and it is the spec's explicit instruction (AC1). Age genuinely cannot be
computed from a non-datetime, so a record of unknown age must not be published as
if it were recent. Zero real-world impact (0 of ~18,500 observations). The one
behavioural asymmetry worth noting is **F2** below.

---

## 5. Non-vacuity of the 4 new tests — INDEPENDENT scratch copies

### 5a. All 4 fail against pre-fix source

`/tmp/v020-scratch/` (my own copy; `scripts/build_index.py` replaced with
`git show HEAD:scripts/build_index.py`, verified `diff`-identical to HEAD):

```
FAIL: test_only_fresh_records_survive_out_of_order_iteration
FAIL: test_result_without_a_datetime_published_is_dropped
FAIL: test_undated_results_are_excluded_from_the_reported_count
ERROR: test_newest_first_assumption_only_stops_the_stream
      TypeError: collect_papers() got an unexpected keyword argument 'assume_newest_first'
Ran 77 tests in 0.047s
FAILED (failures=3, errors=1)
```

**Actual count: 4 of 4 fail against pre-fix source — matches the report.** Three
fail *behaviourally* (the real evidence); the fourth fails with `TypeError`
because the parameter is new. I agree with the implementer's framing that test 4
is a forward guard, not a bug reproducer.

### 5b. Does a test genuinely pin ORDER-INDEPENDENCE? — **YES (mutation-proved)**

Claiming a test "would fail with a bare `break`" is cheap; I actually built the
mutant.

**Mutant A** (`/tmp/v020-mutA/`): kept the undated filter, restored the
**unconditional bare `break`** — i.e. re-introduced exactly the
order-dependence this item exists to remove:
```python
if published < cutoff:
    break
```
```diff
Ran 77 tests in 0.044s
FAILED (failures=1)
FAIL: test_only_fresh_records_survive_out_of_order_iteration
```
**Exactly one test catches it, and it is the order-independence test.** A test
feeding only in-order data would have passed the mutant. This test does not.

**Mutant B** (`/tmp/v020-mutB/`): kept the `break`, restored the *original bug*
(undated records appended instead of dropped):
```diff
Ran 77 tests in 0.043s
FAILED (failures=3)
FAIL: test_only_fresh_records_survive_out_of_order_iteration
FAIL: test_result_without_a_datetime_published_is_dropped
FAIL: test_undated_results_are_excluded_from_the_reported_count
```

Both mutants caught. `assume_newest_first=False` is exercised by tests 1–3
(they call `_collect()` with no kwargs → default), and `True` by test 4.

**Test-quality notes (positive):** `test_result_without_a_datetime_published_is_dropped`
(`:408-417`) does not stop at the record level — it asserts `build_shards` cannot
produce `papers-2001-W01.json`, pinning the *literal recon symptom* end-to-end.
`test_undated_results_are_excluded_from_the_reported_count` pins the count log, not
just the returned list. `test_newest_first_assumption_only_stops_the_stream`
(`:432-449`) asserts `len(yielded) == 1` — a genuine generator-suspension check
that guards the production fast path against becoming dead code.

### 5c. No existing test weakened, skipped, or deleted

Name-set diff between HEAD and the working tree:

```
baseline names: 73      current names: 77
present at baseline but MISSING now: 0
NEW: test_newest_first_assumption_only_stops_the_stream
NEW: test_only_fresh_records_survive_out_of_order_iteration
NEW: test_result_without_a_datetime_published_is_dropped
NEW: test_undated_results_are_excluded_from_the_reported_count
```

**All 73 pre-existing test names survive; exactly 4 added.** No
`@unittest.skip`, no `expectedFailure`, no renamed class. The only edit outside the
new class is `timedelta` added to the `datetime` import at
`tests/test_build_index.py:7`. Test counts per file:
`test_arxiv_common.py` 8 (unchanged), `test_build_index.py` 38 → 42,
`test_paper_collector.py` 27 (unchanged).

---

## 6. Regressions against landed Python items

| Item | Check | Result |
| --- | --- | --- |
| **IMP-004** | category failure → exit 1, write **nothing** | `main()` returned **1**, `out-dir exists: False`, nothing written (`cs.LG` failed, `cs.CV` returned a paper) |
| **IMP-021** | manifest written before stale shards swept | `json.dump` raising `OSError` mid-shard-write: `before == after == ['index.json','papers-2026-W40.json']`, `manifest refs all resolve: True` |
| **IMP-022** | `--retention-days 0` → **exit 2** | `error: argument --retention-days: --retention-days accepts 1 or greater, got 0`, **EXIT=2**, `/tmp/v020-rej-rd0` **not created** |
| **IMP-022** | `--category 'cs.CV foo'` → exit 2 | `EXIT=2`, out-dir not created |
| **IMP-022** | `--abstract-chars -3`, `--max-per-category -9` | both **EXIT=2** with the range message |
| **IMP-023** | `safe_filename` sanitizer | `'..'`→`'_'`, `'.'`→`'_'`, `''`→`'_'`, `'../../etc'`→`'_.._etc'`, `'CON'`→`'CON_'`, 400 chars→**200 bytes**, no separator in any |
| **IMP-024** | `tarfile` `filter="data"` | present in `paper-collector.py` |

Structural check on IMP-004: the new `continue` branches are **inside** the
`try/except arxiv.ArxivError` (`:245-261`), so a mid-loop outage is still caught
and still marks the category failed. The `if undated: warning` at `:262` sits
**before** `if status["failed"]` at `:268`, so it cannot swallow a failure. All
four `CollectPapersTests` (incl. `test_arxiv_error_raised_by_iter_results_is_
classified_as_failure`) pass unchanged.

`write_index` (IMP-021) is not touched by this diff, and the added `undated`
bookkeeping changes no argument `main` passes onward (`:395-404` adds only the
keyword).

`readme.md` and `requirements.txt`: **untouched** — correct, since no CLI flag or
record field changed, so IMP-022's AC5 readme duty does not arise here.

---

## 7. Full suite

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 77 tests in 0.043s

OK
```

Python 3.11.8. **77 = 73 baseline + 4**, as expected. Fast (0.043 s; 0.068 s with
sockets blocked).

**Hermetic — proven, not assumed.** I re-ran the whole suite with
`socket.socket.connect`, `create_connection`, and `getaddrinfo` replaced by
raising stubs via a `sitecustomize.py` on `PYTHONPATH`, and separately confirmed
the block was actually armed (a real `create_connection(('export.arxiv.org',443))`
raised `NETWORK ACCESS ATTEMPTED DURING UNIT TESTS`):

```
PYTHONPATH=/tmp/v020-netblock python3.11 -m unittest discover -s tests
Ran 77 tests in 0.068s
OK
```

`/usr/local/bin/python3.11 -m compileall -q scripts tests` → exit 0, no output.

---

## 8. Python version compatibility

`.github/workflows/ci.yml:13-15`:
```yaml
      - uses: actions/setup-python@v5
        with:
          python-version: "3.x"
```
CI runs whatever current CPython `3.x` resolves to (as of writing, 3.13/3.14).

The diff adds **no version-specific syntax**. Construct by construct:
* `datetime.now(timezone.utc) - timedelta(days=...)` — pre-existing, 3.2+.
* `isinstance(published, datetime)` — pre-existing.
* `logging.warning(...)` with %-args — 3.2+.
* A new keyword parameter with a default — 3.0+.
* Tests: `SimpleNamespace` (3.3+), `assertLogs` (3.4+), `subTest` (3.4+),
  `assertGreaterEqual` — all far below any plausible 3.x floor.
* Only new import is `timedelta`, already imported at `build_index.py:24`; the
  test file adds it to its existing `datetime` import.

**No compatibility risk.** Note this does *not* retire PY-19 (`collect_papers`
has an un-injectable clock) — in fact §3 shows PY-19 is the reason the count
comparison is noisy (drift, not over-filtering).

---

## 9. Findings

### F1 — production still depends on the sort (LOW–MED, design; backlog, not a blocker)
`main()` (`:403`) opts into `assume_newest_first=True`, so **the deployed pipeline
is still order-dependent**; only the default path is order-independent. The
original defect (undated records published regardless of age) is fixed on *every*
path, so this is not a correctness hole — it is a residual reliance. It is also
directly sanctioned by AC3.
**Action:** raise a backlog item for a query-level date bound
(`cat:cs.CV AND submittedDate:[YYYYMMDDHHMM TO YYYYMMDDHHMM]`), which removes the
reliance, the pagination cost, and `assume_newest_first` in one change. The
implementer already wrote this up in `discovered-IMP-020.md`; it should be
promoted to a real item rather than left as a note.

### F2 — the filter is stricter than the formatter about `date` (LOW; latent)
`_result_datetime` (`build_index.py:203`) requires `isinstance(published, datetime)`
and returns `None` for a bare `date`, so `date` records are dropped as "undated"
(§4b). But `iso_date()` at **`build_index.py:92-93` explicitly handles `date`**
(`if isinstance(value, date): return value.isoformat()`). If arXiv ever returns
`date`, the shard pipeline could handle it perfectly but the filter discards
every record anyway — loudly, but wrongly.
**Action:** either widen `_result_datetime` to accept `date` (coerce to a
midnight-UTC datetime), or add a comment at `:203` stating `date` is
deliberately rejected. Zero real impact today (0 of ~18,500 observations).

### F3 — undated drops are log-only, not in the manifest (LOW)
`undated` (`:243`) never leaves `collect_papers`' return value, so a deploy that
dropped, say, 40% of one category is **green** and publishes a smaller index with
no machine-readable signal. A *total* wipe is caught (IMP-004's empty-index
refusal, `:412-414`), but a partial one is not.
**Action:** consider a `droppedUndated` counter in `manifest`
(`build_shards` `:186-197`) so `web/` and any future monitor can assert on it.
Related to the carried-forward note at `FEATURES.md:454` (IMP-176: "a boundary
that silently hides a schema violation would be worse than the bug") — a log line
is better than silence but is not a boundary.

### F4 — pre-existing `OverflowError` in `_result_datetime` (INFO; not this diff)
`build_index.py:207` `astimezone` raises `OverflowError` for `datetime.min` at
`+14:00` or `datetime.max` at `-12:00`; nothing catches it (`:260` catches only
`ArxivError`). Unchanged by this diff and unreachable from arXiv.
**Action:** backlog nit; a `try/except (OverflowError, ValueError)` returning
`None` would close it for free.

### F5 — report inaccuracy (INFO, no code impact)
`impl-IMP-020.md:142` states the AC3 comment is "82 characters — the file's longest
existing line is 86 (`build_index.py:315`)". Measured: `build_index.py:254` is
**86** characters, and 86 is now the file's longest line. Cosmetic; the comment
itself is accurate and within the file's existing style (`arxiv_common.py` max is
88).

### F6 — the spec's `2812` baseline is not reproducible (INFO; spec defect)
`web/public/data/index.json` (`totalPapers: 2812`, 2 shards) spans **8 days**
(`2026-09-24`→`2026-10-01`) while its own manifest says `retentionDays: 60`. An
uncapped 60-day run with `UNLIMITED = 100000` cannot produce 2,812; my capped
2,000/category run produced **8,025** (§3). The figure is a partial dev artifact
and is internally inconsistent, so it is not a usable regression target.
**Action:** correct `FEATURES.md:486` (and the equivalent note in any future
item) to name the before/after comparison as the real criterion — which this
change passes with a delta of exactly **0**.

### Observed, no action
* `impl-IMP-020.md:14` lists `.improve/FEATURES.md` as untouched; the working
  tree does show ` M .improve/FEATURES.md`, but the diff is only
  `TODO → IN-PROGRESS` status flips for **IMP-019 and IMP-020** (`:454`, `:472`)
  — correct bookkeeping, not a premature `DONE`. No `DONE` was written.
* The `undated` warning fires even when the category subsequently fails
  (warning at `:262`, failure at `:268`), producing a `WARNING` line just before
  the `ERROR`. Correct, marginally noisy.

---

## 10. Criteria scorecard

| AC | Requirement | Verdict | Evidence |
| --- | --- | --- | --- |
| **1** | Undated dropped **before counting**; old dropped order-independently | **MET** | `build_index.py:248-259`; `count += 1` at `:259` unreachable for dropped records; order-independence **mutation-proved** (§5b) |
| **2** | Test drives `collect_papers` with fake `iter_results`, out of order, only new survives | **MET** | `tests/test_build_index.py:385-406`; 4th record added to escape AC2's vacuous literal, justified at `:386-389` |
| **3** | One-line comment at the call site naming the `arxiv_common.py` sort | **MET** | `build_index.py:254` (one line) and `:401-402` (call site); sort verified at `arxiv_common.py:60-61` + live `sortBy=submittedDate&sortOrder=descending` |

**Regressions:** none. IMP-004, IMP-021, IMP-022, IMP-023, IMP-024 all verified
intact (§6). Suite 77/77 OK, hermetic, 0.043 s (§7). CI `python-version: "3.x"`
compatible (§8).

**No unmet criterion. Recommend merge.**