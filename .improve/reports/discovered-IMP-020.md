# Discovered while implementing IMP-020 — NOT fixed

Found while implementing `IMP-020` (retention window as a filter). Per the task
boundary these are reported, not fixed. Line numbers are from `5ff96a0` plus the
IMP-020 change.

---

## D1. The ordered stop can only be removed by changing the query, not the loop

`scripts/build_index.py:235` (unchanged by IMP-020)

`collect_papers` still calls `iter_results` with `limit = UNLIMITED = 100000` when
`--max-per-category` is 0 (the default), and relies on the ordered stop to avoid
paging through a whole category. Measured: `cat:cs.CV` reports **207,907 total
results**, and the newest 2,000 only reach back 14 days, so a 60-day window
needs roughly 8,000–9,000. Without the early stop that is ~200,000 results at
`delay_seconds=10` — hours per category, and an arXiv-ToU problem on top of
PY-13.

**Candidate fix (own item):** push the window into the query —
`cat:cs.CV AND submittedDate:[<cutoff UTC> TO <now UTC>]`. arXiv then returns only
in-window results, `max_results` becomes irrelevant, and the sort dependency
disappears entirely (the query is order-free by construction). Costs: it rewrites
query construction, interacts with the IMP-022 `--category` validation (the
category and the date clause must be assembled so the category is still exactly
the validated token), and `submittedDate` has its own submitted-vs-announced
semantics worth testing. It also changes the paper count if the two notions of
"published" ever disagree, so it needs its own count comparison.

## D2. PY-17 is now the load-bearing failure mode for the ordered stop

`scripts/build_index.py:45` / `scripts/arxiv_common.py`

`UNLIMITED = 100000` is far above arXiv's 30,000-result `start` ceiling. Today the
ordered stop hides this. Any future change that lengthens the window, changes
`UNLIMITED`, or removes the stop turns it into a silent truncation: the run
succeeds, logs a plausible paper count, and ships a partial index — exactly the
IMP-004 failure mode IMP-004 was written to prevent. Worth clamping `UNLIMITED`
to something arXiv can actually serve, or raising `ArxivError` when a page
returns fewer results than requested before the end.

## D3. PY-19 — `collect_papers` still has an un-injectable clock

`scripts/build_index.py:235` (`datetime.now(timezone.utc)`)

`build_shards` takes `generated_at`; `collect_papers` does not, which is why
IMP-020's tests have to build fixtures relative to wall-clock time. One extra
`now=None` parameter (as `build_shards` already has) would make the retention
tests deterministic and would let a future test assert an exact cutoff. Not
changed: it is PY-19's own item and touching the signature here was out of scope.

## D4. Profile rows that are now stale (I cannot edit `REPO_PROFILE.md`)

* **PY-4** (`build_index.py:216-217`) — fixed by IMP-020; the row still describes
  the old `is not None and … break` line.
* **PY-5** (`build_index.py:219`, "retention count over-reports") — effectively
  closed as a side effect. `count` now only increments for records that are
  appended, and every appended record went through `_result_datetime`, so its
  `iso_date` is always a real ISO date. `build_shards:156`'s
  `if not published: continue` is therefore now unreachable from
  `collect_papers` — defensive only.
* **REPO_PROFILE §8 trap 8** — first paragraph (the undocumented ordered stop)
  is stale; the dependency is now documented at `build_index.py:254` and the
  behaviour is behind a flag.
* **REPO_PROFILE §4.3** lists `collect_papers` and `_result_datetime` as
  untested high-risk functions. IMP-020 adds 4 tests covering `collect_papers`;
  `_result_datetime` is now covered indirectly (datetime, naive, non-datetime).

## D5. Trivial style gap next to the change

`scripts/build_index.py:201` — `_result_datetime` is the only function in
`build_index.py` with no docstring; every other one has a one-line explanation of
intent. It is now the function that decides what gets dropped from the index, so
a one-liner would be worth adding. Left alone to keep the diff to the item.

## Checked and NOT affected

* `scripts/paper-collector.py` — no retention window and no ordered stop at all;
  it only writes `result.published` into a CSV `Date` column (`:227`). The
  IMP-020 bug class does not exist there.
* `notebooks/paper-collector.ipynb` — no date filtering either (no retention
  logic; one unrelated `break` in a pandas loop). Consistent with REPO_PROFILE
  trap 6: a fix to one surface is not a fix to the other, but here there is
  nothing to fix.
* `web/src/lib/types.ts` ↔ `record_from_result` — IMP-020 changes no field name
  or type, so the hand-mirrored wire contract (trap 1) is untouched.
