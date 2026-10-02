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
- **PHASE:** loop (Phase 4)
- **START_SHA:** 1c075b322eafa1fdfe07775136ca573513b4904b
- **PLAYWRIGHT MCP:** available (playwright_browser_* tools present in orchestrator session)
- **PRE-PUSH GUARD:** installed at .git/hooks/pre-push

## Counters
- Commits since start: 0
- Items DONE: 0
- Items BLOCKED: 0
- Items NEEDS-HUMAN: 7
- Items TODO: 140
- Backlog total: 147
- Impl attempts used on current item: 0
- Commits since last regression sweep: 0
- Discovery rounds: 0

## Current item
- (none yet)

## Next action
- Commit backlog, then begin loop at IMP-001.

## Recon summary
- Reports: `.improve/reports/recon-{classifier,runbook,architect,web,python,quality,experience}.md` + `recon-critic-notes.md`
- Operating manual: `.improve/REPO_PROFILE.md` (includes bug inventory + pre-existing failures)
- Baseline screenshots: 14 files in `.improve/artifacts/baseline/`
- Baseline green: 27 Python tests, `tsc --noEmit` clean, 36 web tests.

## Notes
- `.improve/artifacts/` excluded via `.git/info/exclude` (local only).
- Pre-existing sibling worktree at `.kilo/worktrees/mildly-income` — DO NOT TOUCH.
- `web/dist/` exists but is gitignored (build output, do not edit).
