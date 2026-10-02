# IMP-004 — Refuse to write an index after any category's arXiv query failed

## Files changed (all under `scripts/` or `tests/`)

| File | Change |
| --- | --- |
| `scripts/arxiv_common.py` | `new_status()` holder factory; `iter_results(query, max_results, status=None)` resets the holder on entry and fills it in on `arxiv.ArxivError`. |
| `scripts/build_index.py` | `collect_papers(..., failures=None)` records per-category query failures; `main()` refuses to write and returns `1` when any category failed; one-line module-docstring note on the publish policy. |
| `tests/test_arxiv_common.py` | 3 new tests for the status holder (failure, exhaustion, reset between queries). |
| `tests/test_build_index.py` | `make_result()` helper; new `CollectPapersTests` (4 tests) and 2 new `MainTests` driving `main()` through a fake `iter_results`. |

No other file was touched. `web/` changes visible in `git status` belong to the concurrent
agent (IMP-005), not to this item.

## Design choice (required by acceptance criterion 2): **hard fail**

A degraded index was **not** chosen. `main()` returns `1` and writes nothing when any requested
category's query fails. Rationale:

* The alternative requires a new field in `index.json` plus reader-side UI in `web/`, which is
  outside this item's allowed paths and would need its own wire-format change (profile trap 1).
* Hard fail is the default the item names first, and it is already what the pipeline does for a
  completely empty result set (`build_index.py` "refusing to write an empty index"), so this is
  one consistent policy rather than two.
* `deploy.yml:33-34` runs `python scripts/build_index.py` with no `continue-on-error` and no
  `if: always()` on any later step, so a non-zero exit aborts the `build` job before
  `npm run build` / `upload-pages-artifact`. The previously published site keeps serving its last
  complete index. A partial outage therefore cannot publish a truncated index, and it surfaces as a
  red Actions run rather than as silent data loss.

No CLI flag and no default value was added or changed. `--help` output is unchanged.

## Implementation notes

* `iter_results` keeps its existing contract (errors logged, iteration terminated, partial results
  yielded) so `scripts/paper-collector.py:60`, which calls it with two arguments, is unaffected.
  The `status` holder is a third optional positional argument.
* The holder is a plain `dict`, matching the repo's plain-dict style (no dataclasses anywhere).
  It is reset on entry so a caller may reuse one holder across queries, and it is reset *before*
  the `max_results <= 0` early return so a caller that gets nothing still sees `failed: False`.
* `collect_papers` takes an optional `failures` list rather than changing its return type. A
  return-type change would have broken the two existing `MainTests` that stub
  `collect_papers = lambda *args, **kwargs: [...]`; the out-parameter keeps both passing unchanged.
* `collect_papers` also catches `arxiv_common.arxiv.ArxivError` escaping the loop. With the real
  `iter_results` that branch is unreachable, but acceptance criterion 3 requires a fake
  `iter_results` that *raises* `arxiv.ArxivError`, and it keeps a substituted or future
  implementation from turning a classified failure into a raw traceback (the PY-9 complaint).
  Both paths are covered by tests.
* A failing category is logged at ERROR with its error text and the run continues to the remaining
  categories, so the log names *all* failed categories, not just the first.

## Commands run

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v      # before: Ran 30 tests ... OK
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v      # after:  Ran 39 tests ... OK
$ /usr/local/bin/python3.11 -m compileall -q scripts tests       # exit 0
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV \
      --max-per-category 5 --out-dir /tmp/rpf-imp004-check       # exit 0, 5 papers, 1 shard written
```

Real-network smoke run (the item's verification method, with `/usr/local/bin/python3.11` in place
of the absent `/tmp/rpf-venv`): fetched 5 cs.CV papers over the live arXiv API and wrote
`index.json` + `papers-2026-W40.json`, exit 0 — the healthy pipeline is unaffected.

Simulated failure end-to-end, run as a one-off script (no test dependency, no network):

```
INFO:root:Querying cat:cs.CV (limit 100000) ...
INFO:root:  1 papers within retention window for cs.CV
INFO:root:Querying cat:cs.LG (limit 100000) ...
ERROR:root:  query failed for cs.LG: simulated outage
ERROR:root:Refusing to write an index: the arXiv query failed for cs.LG.
EXIT = 1 | out-dir exists: False | files: None
```

Suite composition after the change: `test_arxiv_common` 8, `test_build_index` 24,
`test_paper_collector` 7 = 39.

## New tests (hermetic — every one uses a fake, no network)

`tests/test_arxiv_common.py` (uses the existing `FakeClient` + `SimpleNamespace` `arxiv` swap):
`test_status_holder_reports_a_failed_query`, `test_status_holder_reports_an_exhausted_query`,
`test_status_holder_is_reset_for_each_query`.

`tests/test_build_index.py`:
`CollectPapersTests.test_records_failed_categories_separately_from_records`,
`..._test_healthy_categories_report_no_failures`,
`..._test_failures_list_is_optional`,
`..._test_arxiv_error_raised_by_iter_results_is_classified_as_failure`,
`MainTests.test_refuses_to_write_index_when_a_category_query_fails` (acceptance criterion 3: real
`arxiv.ArxivError` raised by a fake `iter_results` for `cs.LG`, records returned for `cs.CV`;
asserts non-zero exit, that the out-dir is completely empty, and that the failing category appears
in the ERROR log),
`MainTests.test_writes_index_when_every_category_query_succeeds` (guards against the new check
firing on a healthy run).

## Uncertain / for the coordinator

1. **The profile is now stale.** `REPO_PROFILE.md` §8 trap 3 and §9 `PY-6` describe exactly this
   defect. They should be marked fixed; I could not edit that file (outside `scripts/` and `tests/`).
2. **Residual gap, deliberately not addressed (PY-18).** `--category` is still unvalidated, so a
   typo'd or malformed category yields zero papers, still indistinguishable from "no new papers",
   and still lands in `manifest["categories"]`. IMP-004 closes the *query failed* case only.
3. **`collect_papers` has an unreachable `except` branch** against the real `iter_results`. It is
   required by acceptance criterion 3's literal wording and is tested, but a reviewer may consider it
   dead code. Removing it would force acceptance criterion 3's test to fake the status holder
   instead of raising, which is weaker.
4. No readme/`CONTRIBUTING.md` update was made or possible: both are outside the allowed paths, and
   neither documents exit codes today, so nothing there became stale.
