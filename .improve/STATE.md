# Improver State

## Config
- WORK_BRANCH: improve/auto-20261002
- STATE_DIR: .improve/
- MIN_BACKLOG: 100
- REFILL_THRESHOLD: 20
- MAX_ATTEMPTS: 3
- REGRESSION_EVERY: 10
- CMD_TIMEOUT: 10 min

## Phase
- **PHASE:** loop (Phase 4) — resumed and still running; 166 TODO remain
- **START_SHA:** 1c075b322eafa1fdfe07775136ca573513b4904b
- **PLAYWRIGHT MCP:** available and used throughout
- **PRE-PUSH GUARD:** installed at .git/hooks/pre-push; nothing has ever been pushed

## Counters
- Commits since start: 85
- Items DONE: 42
- Items BLOCKED: 0
- Items NEEDS-HUMAN: 8 (product decisions)
- Items TODO: 166 (150 ready, 16 dep-blocked)
- Backlog total: 216
- Impl attempts used on current item: 0
- Regression sweeps run: 6 (all 6 found real problems except #6, which was CLEAN; all fixed)
- Discovery rounds: 0 (findings absorbed continuously instead)
- Items needing a retry: IMP-007, IMP-008, IMP-009, IMP-024, IMP-031, IMP-198, IMP-204, IMP-216 (r2)

## Verified baselines (supersede the older figures in FINAL_REPORT.md)
- Python: **118 tests** OK on 3.11.10, ~1.1s, hermetic (was 104)
- Web: **20 test files / 293 tests**, typecheck clean, build clean
  (41 modules, JS 172.50 kB, CSS 10.91 kB) (was 19/292)
- Baselines moved again by IMP-216 (truncation classification + depth bound)
  and IMP-037 (PaperCard render test). Verifiers must use THESE numbers.

## Verified baselines (current truth — verifiers must not blame these on new changes)
- (superseded — see the new baselines above)
- Pre-existing failures (do NOT treat as regressions):
  - `npm audit`: 5 dev-only advisories (vitest 2.1.9 critical, vite 5.4.21 high, 3 moderate)
  - `jupyter nbconvert --execute` on `notebooks/paper-collector.ipynb` fails by design (`input()`)
  - `--download-pdfs` / `--download-sources` crash on arxiv 4.x — OWNED BY IMP-093
  - No linter configured for either stack; `npm run lint` does not exist and must never be added
  - CI floats `python-version: "3.x"`, so the documented Python floor is unenforced (IMP-209)

## Current item
- (none — between items)

## Next action
- A consolidation report is written: `.improve/FINAL_REPORT.md`. Read it first.
- The loop is NOT exhausted. Continue from the highest-priority TODO whose
  dependencies are DONE. Highest-value remaining: IMP-030 (stale README hero image),
  IMP-041 (deploy quality gate), IMP-205 (deploy step cap slack), IMP-206 (pin the
  deploy job cap), IMP-212 (document the guard-test indirection), IMP-213 (test on
  CI's Node version), then the CI/docs polish cluster.
- Run a regression sweep after the next ~10 commits.

## Hard-won lessons for whoever resumes (READ THESE)
1. **Never let a sub-agent run `git restore`, `git checkout`, `git clean`, or `git stash`.**
   One did, and it deleted the committed `scripts/build_index.py` from the working tree.
   It was recovered with `git restore scripts/build_index.py`, but the file was live
   production code at the time. Instruct every sub-agent explicitly. If a tracked file
   is deleted, recover it from HEAD immediately and tell the orchestrator.
2. **Sub-agents crash on `board_post`.** Two aborted mid-turn after three malformed
   board calls. Always say "You have NO board tools; never attempt to call one."
3. **Never let two sub-agents touch the same file in parallel.** IMP-008 and IMP-009 both
   edited `web/src/lib/urlState.ts`; the hunks interleaved and had to be split apart by a
   third agent, staging only one item's content. Pair web work with Python work instead,
   or serialize. `scripts/`+`tests/` and `web/` are safely disjoint.
4. **Ad-hoc shell `printf` corrupted `.improve/PROGRESS.log` three times.** Use
   `/tmp/log_progress.py <ITEM> <RESULT> [SHA] [note]`, which enforces the format.
5. **Large-file `write` calls fail.** The backlog agent aborted after three malformed
   `write` invocations. Write in chunks and append with `edit`, or use a splitter agent.
6. **Plain `--sequence.shuffle` has ZERO detection power for alert-count flakes** — 100
   runs against known-racy HEAD produced zero failures. Use the amplified A/B technique:
   widen a load window in a `/tmp` copy, then compare racy vs fixed.
7. **Verifiers must check the CONSUMER, not just the producer.** IMP-204 attempt 1 wrote a
   `failedCategories` field that no web code read, which was worse than the bug it fixed.
8. **An implementer may be right and a spec wrong.** IMP-192d rejected the regression
   sweep's diagnosis with evidence, and IMP-028d refuted the orchestrator's own claim.
   Give implementers license to push back, and read their corrections.
9. **THE COMMIT HELPER CORRUPTED THE BACKLOG — do not repeat it.** `finish_item.py`
   used `re.split(r'\n(?=### IMP-)', txt)` + `"".join(...)`. That split **consumes**
   the newline it matches, so all 208 item headings were glued onto the previous
   line; the text survived but the file became unreadable to any line-anchored
   parser. Fixed in `4a39b84` by rebuilding from `c1a89bd`. The correct form is
   `re.split(r'(?m)^(?=### IMP-)', txt)` — a zero-width `(?m)^` lookahead, which
   consumes nothing. **Rule: any script that splits and rejoins a file must either
   use a zero-width lookahead or assert byte-equality after the round trip.**
   The same bug also destroyed four freshly-filed items (IMP-216..219) before
   they were ever committed; they had to be regenerated from the discovery reports.
10. **Verify `.improve/FEATURES.md` integrity after every write**, not just at the
   end of a batch: count `(?m)^### IMP-\d+` headings, assert the count equals the
   number of unique IDs, and assert every item still carries all ten mandatory
   fields. A silent item loss looks exactly like "the file is fine".
11. **Never forget `--max-per-category` bounds.** `UNLIMITED`/ceiling changes alter the
   deploy's page count, which feeds IMP-198's workflow timeout arithmetic. Recheck it
   whenever pagination changes. IMP-216 has now made this concrete: the deploy
   is bounded by `DEPLOY_OFFSET_BUDGET=10000` (deepest offset `start=9000`), so
   re-measure page counts against that bound, not against an unbounded query.

## Recon summary
- Reports: `.improve/reports/recon-{classifier,runbook,architect,web,python,quality,experience,critic-notes}.md`
- Plus `regression-sweep-{1..5}.md` and `impl-/verify-` pairs for every item.
- Operating manual: `.improve/REPO_PROFILE.md` (kept current; includes a "recently fixed —
  do not re-report" section and a bug inventory).
- Baseline screenshots: 14 files in `.improve/artifacts/baseline/` (local-only, git-excluded).