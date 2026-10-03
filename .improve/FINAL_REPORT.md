# Final Report — research-paper-feed improvement loop

**Branch:** `improve/auto-20261002` · **Range:** `1c075b3..HEAD` · **Nothing has been pushed.**

Review with:

```
git log --oneline 1c075b322eafa1fdfe07775136ca573513b4904b..HEAD
```

The loop is **resumable, not finished** — 165 items remain. See "Remaining work".

---

## Numbers

| | |
|---|---|
| Commits | **92** |
| Backlog items DONE | **44** of 217 |
| Items NEEDS-HUMAN | 8 (product decisions, correctly deferred) |
| Items TODO | 165 (149 ready, 16 dep-blocked) |
| Items BLOCKED | **0** |
| Regression sweeps | **7** — #1–#5 each found real problems, #6 and #7 CLEAN |
| Baselines | Python **119 tests OK**; web **20 files / 293 tests**, typecheck clean, build clean |

Baselines moved from 27 Python / 36 web tests at the start to **119 / 293** now.

## Session 2 highlights (9 commits since `c1a89bd`)

**A live production defect, found by accident and fixed properly.** arXiv returns a *reproducible* HTTP 500 at `start=10000` for `cat:cs.AI`, on the exact bare command `deploy.yml` runs — two consecutive full builds lost that category at the identical offset, and the client's 6-attempt retry does not help (6 tries over ~60 s all 500). Worse than the missing category: `index.json` listed it under `failedCategories` while its already-fetched papers sat in the shards, so the site could claim "no papers here" for a category it held papers for. IMP-216 classifies a category that dies mid-paging as *truncated* rather than *failed* and reconciles that against the post-dedupe records, and bounds the deploy's depth below the failing offset. The sweep confirmed the old tree produced `failed=['cs.AI']` with the chip removed and 50 papers in the shards; the new tree produces `truncated=['cs.AI']` with the chip kept and zero contradictions.

**Every card showed the wrong date.** `PaperCard.formatDate` rendered a UTC-anchored publication date in the *viewer's* timezone, so `published: "2024-01-02"` read "Jan 1, 2024" for every reader west of UTC, and the visible text contradicted the card's own `dateTime`. The bug was baked into the committed baseline screenshot. IMP-219 pins UTC for calendar dates and deliberately leaves `formatGeneratedAt` local. Verified across 15 timezones; the sweep confirmed 200/200 cards now match their shard.

**The deploy could publish a red build.** Cross-workflow `needs:` is impossible, so anything landing on `main` published to Pages whether or not CI was green. IMP-041 added the Python suite and typecheck ahead of the index build — byte-identical to `ci.yml`'s commands, proven as YAML-parsed scalars rather than by eye.

**The README showed a product that no longer exists.** Its hero was a 2023 screenshot of the legacy Python CLI (465 KB, the repo's heaviest asset for a picture that was simply wrong). IMP-030 replaced it with a real 1280px capture of the React feed at 112 KB.

**Plus:** `dedupe_records` no longer mutates its caller's input (IMP-042 — the sweep measured input mutated 422 times before, 0 after, across 600 randomised cases with zero output change), and the first component render test, which was the prerequisite for four other items (IMP-037).

## Two things this session got wrong, and what was done about them

**I corrupted the loop's own memory file.** The commit helper split `.improve/FEATURES.md` with `re.split(r'\n(?=### IMP-)')` and rejoined with `"".join(...)` — that split **consumes** the newline it matches, so all 208 item headings were glued onto the previous line. No text was lost, but the backlog became unreadable to any line-anchored parser. Worse, four freshly-filed items (IMP-216…219) were destroyed before ever being committed and had to be regenerated from the discovery reports. Fixed in `4a39b84` by rebuilding from `c1a89bd` and re-applying only the two intended edits — `diff` against the pristine base is four lines. The helper now uses the zero-width `(?m)^` form, and the rule is recorded: any split/rejoin script must assert byte-equality on a round trip, and `FEATURES.md` integrity must be checked after every write.

**Verifiers overturned an implementer's own cost claim.** IMP-216's implementer reported losing ~785 `cs.AI` papers (~7%) to the depth bound. The verifier proved the pre-fix and post-fix trees write *identical* id sets — arXiv refused `start=10000` either way, so those papers were already unreachable. The marginal loss is zero; the defect was that the loss was invisible and dishonest. Recorded that way rather than as accepted collateral damage.

Three smaller accuracy defects that the verifier found were fixed **before** commit rather than after: a false absolute in `readme.md:199`, a test message conflating an offset with a paper count, and an unfalsifiable `assertNotEqual`. IMP-042's own spec line citations were also wrong and were corrected before commit.

## How the work was checked

Every item was implemented by one agent and verified by a **different** agent told to assume the implementer was overconfident, and required to prove assertions non-vacuous — typically by reverting the fix in a scratch copy and quoting the failure. That is what caught the defects the implementers' own green tests were blind to: an over-rejected tarball fallback, a retry button dead after one click, an `Error.message` rendered as visible text, a `failedCategories` field no web code read, a silently green `authors`-alias mutation, an en-US-only date assertion, and a test satisfiable by a no-op stub.

Sweep #7 is the strongest evidence that the fixes are real rather than plausible: it confirmed IMP-219 (200/200 dates across four timezones, pre- vs post-build pixel diff confined to the date line), IMP-216 (the "no papers" lie present before and absent after), IMP-042 (600 randomised cases, zero output change), and `FEATURES.md` (217 items, no field lost) — with 63 screenshots, no console errors, and no order-dependence across 11 web runs including 5 shuffled.

## BLOCKED

None. Every failure was resolved by improving the change.

## NEEDS-HUMAN (8) — genuine product decisions

| ID | Decision |
|---|---|
| IMP-027 | Deploy cron: the comment, the cron (`0 6 * * 0`, weekly) and the readme ("daily") disagree. Daily means ~5× the arXiv request volume against its terms of use. |
| IMP-034 | The notebook is a pre-`arxiv_common` fork the readme calls "the same workflow". Delete a documented artifact, or rewrite it as a wrapper? |
| IMP-088 | Add an `npm audit` gate — fails today on 5 dev-only advisories. |
| IMP-176 | May a feed silently omit a paper with no usable `published` date? |
| IMP-096, IMP-125, IMP-141, IMP-142 | 404 page + `robots.txt`; date locale policy (IMP-219's new en-US-only test assertion is now an input to it); intermediate breakpoint; print styles. |

## Known risks

- **`requests` imported but undeclared** in `requirements.txt`; works transitively via `arxiv`, guarded by the `<4` pin. IMP-207.
- **Python floor unenforced** — 3.10 installable, verified on 3.11/3.14, but CI floats `python-version: "3.x"`. IMP-209.
- **arXiv does not space its retries** — it sets its pacing variable only after a *successful* request, so retries fire back-to-back on failure. Deliberately not "fixed" client-side; documented, IMP-208.
- **Deploy step cap slack** — now bounded by `DEPLOY_OFFSET_BUDGET=10000`, which is a *product* trade, not just arithmetic. IMP-205 must re-derive its numbers against it.
- **Nothing pins the deploy's quality gates** — deleting them leaves the suite fully green. IMP-217.
- **The web suite is still not a deploy gate.** IMP-218.
- **CI runs Node 20; local testing used Node 25.** Unproven on the version CI runs. IMP-213 (blocked on IMP-166).
- Pre-existing and untouched: 5 dev-only npm advisories, `jupyter nbconvert` failing on `input()`, `--download-pdfs`/`--download-sources` broken on arxiv 4.x (IMP-093), a hard crash on an `index.json` missing `shards`/`categories` (IMP-098), and a hollow chip for a category with 0 in-window papers.

## Remaining work

165 TODO items — the loop is **not exhausted**. Highest-value next: **IMP-038, IMP-039, IMP-040** (all 20.0, `paperIndex` tests — serialize them, they share `web/src/lib/__tests__/`), then the 15.0 Python cluster IMP-043…IMP-056 (`scripts/`+`tests/`, disjoint from `web/`, so pair one Python item with one web item to run two implementers in parallel), then IMP-217/IMP-218 (deploy gates), IMP-212 (document the guard-test indirection — which should also mention `web/src/components/__tests__/`, added by IMP-037 and listed in neither `CONTRIBUTING.md:85` nor profile §5.3), IMP-220 (the `authors` alias hazard), and IMP-205/IMP-206.

**To resume:** re-read `.improve/STATE.md` — it carries the current verified baselines, the open risks, and eleven operational lessons learned the hard way, including the two that cost real work this session. Take the highest-priority TODO from `.improve/FEATURES.md` whose dependencies are DONE, and repeat. `.improve/PROGRESS.log` records every item with its commit SHA.

**Nothing has been pushed.** The pre-push guard is installed at `.git/hooks/pre-push` and no remote has ever been contacted.
