# Discovered during IMP-004 — NOT fixed (out of scope)

Each line is a path plus a one-line description.

1. `tests/test_arxiv_common.py:97-100` — `test_arxiv_errors_terminate_iteration_without_raising` is
   vacuous: it installs `error_after=2` with only two results, so `FakeClient` never raises and the
   test asserts nothing about the `ArxivError` path it names. (IMP-004's new
   `test_status_holder_reports_a_failed_query` does cover it with three results, but the original
   test should still be fixed.)
2. `.improve/REPO_PROFILE.md:504-509` (§8 trap 3) and `.improve/REPO_PROFILE.md:729` (`PY-6`) —
   both describe the exact defect IMP-004 fixes and should be marked fixed; the file is outside the
   paths I may modify.
3. `scripts/build_index.py:270-274` (`--category`, profile `PY-18`) — category strings are still
   unvalidated, so a typo produces a silently empty category in `manifest["categories"]`, which
   IMP-004's failure check cannot detect; "green deploy is not evidence of completeness" is only
   partially fixed.
4. `.github/workflows/deploy.yml:20-54` — a failed `build_index.py` now correctly aborts the deploy,
   but the workflow has no notification path and runs only weekly (`cron: "0 6 * * 0"`, profile
   `INF-02`), so an arXiv outage means the index can go stale for up to a week with the only signal
   being a red dot in the Actions tab.
5. `scripts/arxiv_common.py:71-74` — the `except` handler now writes to the status holder but the
   `yielded` counter it sits next to is still dead (`PY-16`), and `iter_results` has no way to
   report *how many* results arrived before the failure, so a partial page is still only detectable
   as "failed", not quantified.
