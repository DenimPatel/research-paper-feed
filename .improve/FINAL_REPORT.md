# Final Report — research-paper-feed improvement loop

**Branch:** `improve/auto-20261002` · **Range:** `1c075b3..ebc47e2` · **Nothing has been pushed.**

Review with:

```
git log --oneline 1c075b322eafa1fdfe07775136ca573513b4904b..HEAD
```

The loop is **resumable, not finished** — see "Remaining work" below.

---

## Numbers

| | |
|---|---|
| Commits | **80** (27 `fix`, 7 `test`, 2 `feat`, 2 `ci`, 1 `style`, 1 `refactor`, 38 bookkeeping) |
| Backlog items DONE | **38** of 212 |
| Items NEEDS-HUMAN | 8 (product decisions, correctly deferred) |
| Items TODO | 166 |
| Items BLOCKED | 0 |
| Items that failed verification at least once | **8** (all then passed) |
| Regression sweeps | **6** — every one found real problems; all fixed |
| Baselines | Python **104 tests OK**; web **292 tests / 19 files**, typecheck clean, build clean |

Done by category: Correctness 10 · Error handling 6 · Security 5 · CI/automation 4 · Accessibility 3 · Test coverage 2 · UX flows 2 · Onboarding 2 · plus 6 singletons.
Done by type: 25 bug-fix, 5 tooling, 4 improvement, 3 docs, 1 refactor.

## Highlights

**Security (5).** `javascript:`-URL injection through imported collection exports; prototype-key (`__proto__`) papers that permanently blanked the app; path traversal via `--topic` in the legacy CLI; CVE-2007-4559 tarball traversal — whose first fix leaked 21 ways on the old-Python fallback and was rejected until the fallback was genuinely safe; and `safe_filename("..") == ".."`, which let a paper titled `..` extract into the repo root.

**Data loss and correctness (10).** The pipeline publishing a truncated index as complete; the stale-shard sweep orphaning a live manifest; a `null` URL field silently dropping papers on import; retention filtering that only worked when arXiv returned results newest-first; and the weekly deploy paging past arXiv's ceiling so one bad category discarded the other four — fixed only once the shortfall became visible *to a reader*.

**Error handling (6).** A rejected manifest promise memoized forever; a non-fatal single shard that killed the whole feed; "no papers available" shown for what was a load failure; raw `Error.message` strings shown to visitors; no error boundary at all; and a JSON `null` manifest hanging the app on "Loading the paper index…" forever with no way out.

**Tooling and CI (9).** CI never built the web app; the deploy published without running tests; a production build silently shipped a site with no data; both guards now exist and are themselves pinned so they cannot be silently disabled.

**Honesty in the UI.** Several fixes were about the app telling the truth: the Relevance chip no longer claims an order the list is not using, a failed category no longer renders a chip that yields a false "No papers match", and an undated paper no longer vanishes without a word.

**Test infrastructure.** Component/DOM testing was impossible by construction; it now exists, with 292 tests and six order-dependent flakes found and eliminated — the last of them by fixing the root cause (vitest's 1 s default), not the instances.

## BLOCKED

None. Every failure was resolved by improving the change; nothing was abandoned.

## NEEDS-HUMAN (8) — genuine product decisions, not deferred work

| ID | Decision |
|---|---|
| IMP-027 | Deploy cron: the comment, the cron (`0 6 * * 0`, weekly) and the readme ("daily") disagree. Daily means ~5× the arXiv request volume against its terms of use. |
| IMP-034 | The notebook is a pre-`arxiv_common` fork that the readme calls "the same workflow". Delete a documented artifact, or rewrite it as a wrapper? |
| IMP-088 | Add an `npm audit` gate — it fails today on 5 dev-only advisories. |
| IMP-176 | May a feed silently omit a paper with no usable `published` date? |
| IMP-096, IMP-125, IMP-141, IMP-142 | 404 page + `robots.txt`; date locale policy; intermediate breakpoint; print styles. |

## Known risks and open risks

- **`requests` is imported but undeclared** in `requirements.txt`. It works transitively via `arxiv`, guarded by the `<4` pin. Filed (IMP-207).
- **The documented Python floor (3.10 installable, verified on 3.11 and 3.14) is unenforced** — CI floats `python-version: "3.x"`. Filed (IMP-209).
- **arXiv does not space its retries**: it sets its pacing variable only after a *successful* request, so retries fire back-to-back on failure. Deliberately not "fixed" with client-side sleeps, which would change request pacing against arXiv's terms. Documented in the profile; filed (IMP-208).
- **The deploy step cap has thin slack** — 4,460 s modelled worst case against 4,500 s. Filed (IMP-205).
- **CI runs Node 20; local testing used Node 25.** Unproven on the version CI actually runs (IMP-213).
- Pre-existing and untouched: 5 dev-only npm advisories, `jupyter nbconvert` failing on `input()`, and `--download-pdfs`/`--download-sources` broken on arxiv 4.x (IMP-093, owner of the replacement API work).

## Remaining work

166 TODO items remain — the loop is **not exhausted**. The backlog deliberately over-provisions: 8 NEEDS-HUMAN items are parked, and many TODOs are small. Highest-value next steps: IMP-030 (stale README hero image, 20.0), IMP-041 (deploy quality gate, 20.0), IMP-205/IMP-206 (workflow cap slack and pinning), IMP-212/IMP-213 (document the guard indirection; test on CI's Node), then the CI/docs polish cluster.

**To resume:** re-read `.improve/STATE.md` (it carries the verified baselines and a list of hard-won operational lessons), take the highest-priority TODO from `.improve/FEATURES.md` whose dependencies are DONE, and repeat. `.improve/PROGRESS.log` records every item with its commit SHA.

## How the work was checked

Every item was implemented by a fresh agent and verified by a **different, independent** agent instructed to assume the implementer was overconfident. Verifiers were required to prove assertions non-vacuous — typically by reverting the fix in a scratch copy and confirming the suite fails — and to run the real code, not just read it. That discipline is what caught the defects the implementers' own tests were blind to: an over-rejected tarball fallback, a retry button dead after one click, an `Error.message` rendering as visible text, a `failedCategories` field no web code read, a silent data-loss path that a green suite endorsed, and a test registration that could be deleted without anything failing.

Six full-stack regression sweeps were run. Sweep 1 found a data-loss regression that IMP-001's own verifier had passed; sweeps 3 and 4 found regressions and pre-existing flakes; sweep 5 found the last of six order-dependent flakes; sweep 6 came back clean across 68 browser states.