# IMP-020 — Implementation report

**Item:** make the retention window a filter, not only an ordered `break`.
**Status:** implemented, all 3 ACs met, 77/77 tests pass (baseline was 73).
**Date:** 2026-10-02. Baseline SHA at start: `5ff96a0`.
**Scope touched:** `scripts/build_index.py`, `tests/test_build_index.py`, this report,
`.improve/reports/discovered-IMP-020.md`. Nothing under `web/`, `readme.md`, or
`.improve/FEATURES.md` was touched. No git write commands were run.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `scripts/build_index.py` | `collect_papers` (`build_index.py:210-276`): per-record retention filter + opt-in ordered stop; `main` (`build_index.py:398-407`) passes `assume_newest_first=True`. |
| `tests/test_build_index.py` | +`timedelta` to the existing `datetime` import (line 7); new `CollectPapersRetentionTests` class (`:350-449`), 4 tests. |
| `.improve/reports/impl-IMP-020.md` | this file. |
| `.improve/reports/discovered-IMP-020.md` | findings I did not fix. |

Full `git diff scripts/build_index.py` (the only source change):

```diff
 def collect_papers(
-    categories, retention_days, max_per_category, abstract_chars, failures=None
+    categories,
+    retention_days,
+    max_per_category,
+    abstract_chars,
+    failures=None,
+    assume_newest_first=False,
 ):
@@ docstring @@
+    Retention is enforced one record at a time: a result with no usable
+    ``published`` datetime and a result older than the cutoff are each dropped
+    on their own merits, whatever order the results arrive in.
+    ``assume_newest_first`` is the extra shortcut, not the filter -- it stops
+    reading a category at its first out-of-window result instead of paging
+    through the rest of the feed, which is only sound because arXiv answers
+    newest-first. It is off by default so the filter cannot be defeated by an
+    unexpected order; callers that can vouch for the sort opt in.
@@ body @@
         count = 0
+        undated = 0
         status = arxiv_common.new_status()
         try:
             for result in arxiv_common.iter_results(query, limit, status):
                 published = _result_datetime(result)
-                if published is not None and published < cutoff:
-                    break
+                if published is None:
+                    # Without a datetime there is no age to compare against the
+                    # cutoff, so the record cannot be proven to be in window.
+                    undated += 1
+                    continue
+                if published < cutoff:
+                    # Load-bearing on arxiv_common.py's SubmittedDate/Descending sort.
+                    if assume_newest_first:
+                        break
+                    continue
                 records.append(record_from_result(result, abstract_chars))
                 count += 1
         except arxiv_common.arxiv.ArxivError as exc:
             status.update(failed=True, error=str(exc))
+        if undated:
+            logging.warning(
+                "  dropped %d result(s) with no usable published date for %s",
+                undated,
+                category,
+            )
@@ main() @@
         failures,
+        # This caller knows the query is the one arxiv_common sorts by
+        # submission date, newest first, so it can stop paging early.
+        assume_newest_first=True,
     )
```

---

## 2. How the retention check was made order-independent

The old line was a single compound test with two distinct jobs fused together:

```python
if published is not None and published < cutoff:
    break
```

* `published is not None` — the **filter**. It was a *guard*, not a rule: when
  `_result_datetime` returned `None` (a non-`datetime` `published`) the whole
  condition was false and the record was appended unconditionally. That is the
  `papers-2001-W01.json` symptom.
* `published < cutoff` — the **shortcut**. It `break`s, so it only drops old
  records correctly while the stream is newest-first; out of order it silently
  discards every *newer* record that follows the first old one.

The fix separates them into three per-record branches:

1. `published is None` → `continue` (dropped, counted in a new `undated` tally so
   the per-category count and a `logging.warning` can report it).
2. `published < cutoff` and `assume_newest_first` is **False** → `continue`. This
   is the actual retention rule and it is order-independent: an old record is
   dropped on its own merit, and iteration continues so a fresh record later in
   the stream is still considered.
3. `published < cutoff` and `assume_newest_first` is **True** → `break`. The
   ordered stop survives, but only for a caller that has vouched for the sort.

### Why the shortcut did not simply get deleted

`main()` passes `limit = UNLIMITED = 100000` when `--max-per-category` is 0 (the
default). The ordered `break` is what stops the deploy after the first page that
crosses the retention edge. Measured on this machine: `cat:cs.CV` reports
**207,907 total results**; the newest 2,000 only reach back 14 days
(2026-09-18), and the 60-day window needs roughly 8,000–9,000 results. With no
early stop, `iter_results` would page through ~200,000 results at
`delay_seconds=10` — hours per category, and a hammering of the arXiv API that
PY-13 already flags. So the shortcut is kept for the production path, made
explicit at the call site, documented in the docstring, and **off by default** so
the default behaviour of `collect_papers` is the safe, order-independent one.
AC2's test exercises that default.

This is a judgment call and the one thing a verifier should push back on if they
disagree: the production deploy still relies on the sort. The honest framing is
that the *reliance* is now explicit and switchable rather than implicit, and the
*filter* no longer depends on it. The alternative that removes the reliance
entirely — asking arXiv for the window (`cat:cs.CV AND submittedDate:[... TO ...]`)
so there is nothing to stop early — is a redesign of query construction, not
this item. It is written up in `discovered-IMP-020.md`.

### AC3

`build_index.py:254` is a single physical line naming both the file and the sort:

```python
# Load-bearing on arxiv_common.py's SubmittedDate/Descending sort.
```

`arxiv_common.py:60-61` is the dependency: `sort_by=arxiv.SortCriterion.SubmittedDate`,
`sort_order=arxiv.SortOrder.Descending`. (The FEATURES spec cited `arxiv_common.py:47-48`,
which was the pre-IMP-004 line numbering; the sort itself is unchanged and now sits
at `:60-61`.) 82 characters — the file's longest existing line is 86
(`build_index.py:315`), so this matches surrounding style.

---

## 3. Tests

New class `CollectPapersRetentionTests` (`tests/test_build_index.py:350-449`),
4 tests, hermetic and network-free: `build_index.arxiv_common.iter_results` is
replaced with a generator over `SimpleNamespace` fakes (the existing
`CollectPapersTests` pattern), `tearDown` restores it, and dates are computed
relative to `datetime.now(timezone.utc)` because `collect_papers` has an
un-injectable clock (PY-19, still open — I did not change the signature).

| Test | Asserts |
| --- | --- |
| `test_only_fresh_records_survive_out_of_order_iteration` | **AC2.** Fake yields new, stale (365 days), string-dated, then a *second fresh* record. Only the two fresh ones survive, and every survivor's `published` is on/after the cutoff date. |
| `test_result_without_a_datetime_published_is_dropped` | A string `published` is dropped, and `build_shards` therefore cannot produce `papers-2001-W01.json` — the literal recon symptom. |
| `test_undated_results_are_excluded_from_the_reported_count` | **AC1 "before counting."** The `  %d papers within retention window` log line says `1`, not `3`, and the new `dropped 2 result(s)…` warning is emitted. |
| `test_newest_first_assumption_only_stops_the_stream` | The fast path still short-circuits: with `assume_newest_first=True` over `(stale, fresh)` the generator is suspended after one yield, so the deploy keeps its pagination saving. Guards against the flag becoming dead code. |

**A deviation from AC2's literal wording, deliberate.** AC2 says "yielding (new,
old, string-dated) results out of order, asserting only the new one survives." In
that exact order the assertion is **vacuous**: the pre-fix code appends `new`,
then `break`s on `old`, and never even reaches the string-dated record, so
"only the new one survives" already passed before the fix. To make the test
non-vacuous I kept all three named records in the specified order and appended a
fourth — a *fresh* record after the stale one. That is precisely the record the
ordered `break` destroyed, and it is what makes the test fail without the fix.
The inline comment at `tests/test_build_index.py:386-389` says so.

### Non-vacuity proof (scratch copy under `/tmp`)

```shell
rm -rf /tmp/imp020-scratch && mkdir -p /tmp/imp020-scratch
cp -R scripts tests /tmp/imp020-scratch/
git show HEAD:scripts/build_index.py > /tmp/imp020-scratch/scripts/build_index.py
cd /tmp/imp020-scratch && /usr/local/bin/python3.11 -m unittest discover -s tests -v
```

Result: `Ran 77 tests ... FAILED (failures=3, errors=1)` — all 4 new tests fail
against the pre-fix source, each with the defect's own signature:

```
FAIL: test_only_fresh_records_survive_out_of_order_iteration
  AssertionError: Lists differ: ['2401.00001'] != ['2401.00001', '2401.00004']
  Second list contains 1 additional elements. First extra element 1: '2401.00004'
FAIL: test_result_without_a_datetime_published_is_dropped
  AssertionError: Lists differ: ['2001.00001', '2401.00002'] != ['2401.00002']
FAIL: test_undated_results_are_excluded_from_the_reported_count
  AssertionError: Lists differ: ['2001.00001', '2001.00002', '2401.00003'] != ['2401.00003']
ERROR: test_newest_first_assumption_only_stops_the_stream
  TypeError: collect_papers() got an unexpected keyword argument 'assume_newest_first'
```

Three fail behaviourally (that is the real evidence); the fourth fails with a
`TypeError` because the parameter did not exist before — it is a new-API test, and
its job is to guard the production fast path going forward, not to prove the old
bug.

No existing test was restructured, renamed, or weakened. The only edit outside the
new class is `timedelta` added to the `datetime` import on line 7.

---

## 4. Paper-count comparison — the numbers

**On-disk baseline index (untouched by me, gitignored):**
`web/public/data/index.json` → `totalPapers: 2812`, 2 shards
(`2026-W40` 2549, `2026-W39` 263), `generatedAt 2026-10-02T02:44:04Z`.
I did not regenerate it; every run below went to `/tmp`.

Interpreter `/usr/local/bin/python3.11` (arxiv 2.1.3). `/tmp/rpf-venv` does not
exist on this machine, so the FEATURES "verification method" line that names it
was replaced with the working interpreter from REPO_PROFILE §3.1.

The spec's named comparison (`--max-per-category 300`) turns out to be a **weak**
test: the newest 300 `cs.CV` papers are all inside 60 days, so it never reaches
the retention boundary. I ran it as specified **and** added two runs that do.

| Run | Command | Pre-fix | Post-fix | Identical? |
| --- | --- | --- | --- | --- |
| A (spec-named) | `--category cs.CV --max-per-category 300` | 300 papers, 1 shard (`2026-W40`, 2026-09-30→2026-10-01) | 300 papers, 1 shard (same) | **yes**, id sets equal, 0 only-before / 0 only-after |
| A2 | `--category cs.CV --max-per-category 2000` | 2000 papers, 3 shards (W40 929, W39 871, W38 200) | 2000 papers, 3 shards (same) | **yes**, 0 only-before / 0 only-after |
| B (**crosses the boundary**) | `--category cs.CV --max-per-category 2000 --retention-days 7` | 1208 papers, 2 shards (W40 929, W39 279; 2026-09-25→2026-10-01) | 1208 papers, 2 shards (same) | **yes**, per shard 929/929 and 279/279 |

**The count did not move. It is not over-filtering.** Run B is the informative
one: the ordered stop fires on the 1,209th result and 1,208 land in the index,
identically before and after, per shard. Across the three post-fix runs
(~1,500 real arXiv results inspected) the new `dropped N result(s) with no usable
published date` warning **never fired** — direct evidence that arxiv 2.1.3
returns a real `datetime` for `published` on every result, so the new filter
drops nothing real. Timing was also unchanged (A: 3.2s→0.6s; B: 11.3s→12.0s;
both dominated by the hard-coded 10s arXiv delay).

Output dirs: `/tmp/rpf-imp020-before`, `/tmp/rpf-imp020-after`,
`/tmp/rpf-imp020-before-2k`, `/tmp/rpf-imp020-after-2k`,
`/tmp/rpf-imp020-before-7d`, `/tmp/rpf-imp020-after-7d`.

### The spec's other verification step

`--out-dir /tmp/rpf-retention` with `--max-per-category 20`: superseded by runs
A–B above, which write the same shard set to `/tmp` and are compared against a
pre-fix baseline. In every post-fix output directory `ls` shows only
`index.json` plus shards inside the retention window — no stale-year shard.

---

## 5. Regression checks

Full suite, from the repo root:

```shell
/usr/local/bin/python3.11 -m unittest discover -s tests -v
# Ran 77 tests in 0.056s — OK      (baseline: Ran 73 tests — OK)
```

Per file: `test_arxiv_common.py` 8 (unchanged), `test_build_index.py` 38 → **42**,
`test_paper_collector.py` 27 (unchanged). 73 + 4 = 77.

```shell
/usr/local/bin/python3.11 -m compileall -q scripts tests   # exit 0, no output
```

Targeted re-run of the classes the neighbouring items own (from inside `tests/`;
`tests.test_build_index` is not importable as a dotted path because there is no
`tests/__init__.py`):

```shell
cd tests && /usr/local/bin/python3.11 -m unittest -v \
  test_build_index.WriteIndexOrderingTests test_build_index.CollectPapersTests \
  test_build_index.ParseArgsValidationTests test_build_index.CategoryArgumentTests \
  test_build_index.MainTests test_build_index.CollectPapersRetentionTests
# Ran 26 tests in 0.014s — OK
```

* **IMP-004 (hard fail, write nothing) — not regressed.**
  `MainTests.test_refuses_to_write_index_when_a_category_query_fails` and
  `CollectPapersTests` (4 tests, incl. `ArxivError` classification) pass unchanged.
  The `try/except arxiv_common.arxiv.ArxivError` still wraps the whole loop; the
  new `continue`s are inside it, so a mid-loop failure is still caught and still
  marks the category failed. `if undated: logging.warning(...)` sits *before* the
  `if status["failed"]` branch, so it cannot swallow a failure.
* **IMP-021 (`write_index` ordering) — not regressed.** `write_index` untouched;
  `WriteIndexOrderingTests` (2 tests) pass. Adding `undated` bookkeeping changes
  no argument of anything `main` passes on to `write_index`.
* **IMP-022 (argparse validation) — not regressed.** `parse_args` untouched. Live
  checks: `--retention-days 0` → **exit 2**, `build_index.py: error: argument
  --retention-days: --retention-days accepts 1 or greater, got 0`; `--category
  'cs.CV foo'` → **exit 2**; `--retention-days 1` accepted; default still 60;
  `--help` output unchanged. Neither run created an output directory. Note
  `--retention-days` is now constrained to **>= 1** (IMP-022), which is why run B
  uses 7 rather than 0 to reach the boundary.

CI compatibility: `.github/workflows/ci.yml:15` runs `python-version: "3.x"`, so
any current CPython. The change adds no syntax newer than the file already
requires (`date.fromisoformat` is 3.7+), no new import beyond `timedelta` (already
imported at `build_index.py:24`), and no new dependency.

`git status --porcelain` shows only my two files plus the other agent's `web/`
edits, which I did not touch:

```
 M scripts/build_index.py
 M tests/test_build_index.py
 M web/src/App.tsx                     <- other agent
 M web/src/components/PaperCard.tsx    <- other agent
 ... (web/ only)
```

---

## 6. Uncertain / for the verifier to decide

1. **`assume_newest_first` defaulting to `False` is the main judgment call.** It
   means any *other* caller of `collect_papers` (there are none in-repo; the test
   suite and `main` are the only two) gets the slow-but-safe path. `main` opts in
   explicitly, so production behaviour is unchanged except for the filter. If the
   verifier prefers the production-shaped default (`True`) with the test passing
   `False`, that is a two-line flip — but I chose safe-by-default because AC1 asks
   for order-independence and AC2 describes a test that just calls
   `collect_papers` with no extra argument.
2. **Production still depends on the sort** (see §2). Removing that dependence
   needs a query-level date range, which is a different, larger change.
3. **New `logging.warning` line.** It fires only when a result has no usable
   `published`, i.e. never on today's arXiv. It is deliberately `warning`, not
   `info`, because the spec's own risk note is that this branch is what an
   upstream shape change would trip. If a future arXiv release changes the type
   of `Result.published`, a deploy will now say so in the log instead of quietly
   publishing an empty index.
4. **A recent-but-string `published` is now dropped**, even though its ISO date
   would have landed in the right shard. The record's age cannot be *verified*
   against the cutoff, and AC1 says drop. Measured impact on real data: zero
   (no warning fired in ~1,500 results).
5. `collect_papers` still has an un-injectable clock (PY-19); my tests are
   wall-clock-relative. Harmless at 60-day granularity, but it is why I did not
   use a fixed 2024 date in the fixtures.
6. I did not verify the web suite (`npm test` / `npm run typecheck`), because I
   changed no file under `web/`, and the file-shape contract
   (`record_from_result` → `types.ts`) is untouched — no field added, removed, or
   retyped. REPO_PROFILE trap 1 still applies to any future change there.
7. Related profile rows for a verifier to update: **PY-4 → FIXED**,
   **PY-5 → effectively closed** (see `discovered-IMP-020.md`), and REPO_PROFILE
   §8 trap 8's first paragraph. I am not permitted to edit `REPO_PROFILE.md`, so
   those rows still describe the old code.
