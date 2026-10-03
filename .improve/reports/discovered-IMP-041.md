# Discovered while implementing IMP-041

Found while adding the two quality gates to `.github/workflows/deploy.yml`'s `build` job.
**None of these were fixed** — IMP-041's scope is the two gates, and each item below is either
already owned elsewhere or is a decision, not a bug. Filed 2026-10-03.

---

## D-1 — Nothing pins the duplication, so a future delete is silent

**Where:** `.github/workflows/deploy.yml:44` (`Run Python tests`) and `:64` (`Typecheck`).

IMP-041's whole mechanism is that the gates are *duplicated* from `ci.yml` into `deploy.yml`,
because a workflow cannot depend on another workflow's job. Deleting either step restores exactly
the hole the item exists to close, and **nothing goes red**:

- `tests/test_build_index.py` reads `deploy.yml` as text (`DEPLOY_PATH`, `:15`) but only ever
  asserts about the **index step** — its cap, its comment, its `timeout-minutes`. Nothing asserts
  that a test step exists above it.
- `tests/test_arxiv_common.py`'s `workflow_timeouts()` only harvests `timeout-minutes:` lines.
- The web suite never looks at deploy.yml except `web/scripts/__tests__/indexGuards.test.mjs:338`,
  which asserts about `npm run build` and the artifact upload.

There is a direct precedent for pinning exactly this: `web/src/__tests__/indexGuardRegistration.test.ts`
exists because a deleted `test.include` glob left `npm test` green with 23 tests quietly dropped
(IMP-028c), and `tests/test_build_index.py`'s `DeployStepCommandTests` / `DeployStepTimeoutTests`
exist because the deploy's index command and cap were unpinned. A future `DeployQualityGateTests`
— asserting `run: python -m unittest discover -s tests -v` and `run: npm run typecheck` both appear
in the `build` job, and that both line numbers are **less than** the line number of
`run: python scripts/build_index.py` — would close it for ~30 lines of text-parsing test, in the
same style as what is already there.

**Not fixed:** a new test is a behaviour-pinning change to `tests/`, outside this item.

---

## D-2 — The web test suite is still not a deploy gate

**Where:** `deploy.yml` `build` job; compare `ci.yml:47-48`.

IMP-041 closes the deploy's hole for the Python suite and for typecheck, but not for the 292-test
vitest suite. A PR whose React component tests fail can still be merged and still publish, which is
the same failure mode this item set out to stop, one stack over. Criterion 1 names exactly two
commands, so this was left alone deliberately rather than overlooked.

The cost of closing it is one step and ~6 s locally (`npm test` measured 5.76 s, 19 files,
292 tests, exit 0). The argument against is duplication of a suite that is already ~9 s on CI and
slows every deploy; the argument for is that `typecheck` and the Python suite are duplicated for
precisely the same reason and the deploy is not meaningfully slower for them.

**Not fixed:** out of scope by criterion 1.

---

## D-3 — A future implementer cannot give these gates a `timeout-minutes`

**Where:** `tests/test_arxiv_common.py:361` (`WorkflowTimeoutTests`), versus the two new steps.

`WorkflowTimeoutTests.test_no_workflow_cap_is_tighter_than_the_client_worst_case` harvests **every**
`timeout-minutes:` line in `ci.yml` and `deploy.yml` and fails any of them at or under
`6 × 60 s = 360 s`, the client's worst case for one failed page fetch. So a step added to these
workflows cannot be capped at anything under 7 minutes without turning that test red — even for a
step that has nothing to do with arXiv and takes 5 seconds.

The new gate steps therefore carry **no** per-step cap, which is deliberate and correct (a 360 s cap
on a 5 s step buys nothing, and anything larger is noise). But the docstring of that test says to
narrow the rule "if a future change adds a short cap for an unrelated fast step" — this is exactly
that situation, arriving in the form of *no* cap rather than a short one, so the narrowing has not
been needed yet. Worth knowing before someone adds `timeout-minutes: 2` to a `tsc` step and cannot
work out why the Python suite went red.

**Not fixed:** no defect; recorded so the constraint is not rediscovered the hard way.

---

## D-4 — The deploy's own comment still lies about the cron (pre-existing, PE-4)

**Where:** `.github/workflows/deploy.yml:5-6`.

```yaml
  schedule:
    # Rebuild the arXiv index and redeploy every day at 06:00 UTC.
    - cron: "0 6 * * 0"
```

`0 6 * * 0` is **weekly**, Sunday 06:00 UTC. This is the profile's PE-4 (introduced by `44e8fdd`),
and `readme.md:122-123` repeats the "daily" claim. Noted only because it is three lines above the
job this item rewrote and the comment block around it was already being edited; still untouched,
per scope.

**Not fixed:** PE-4's own item.