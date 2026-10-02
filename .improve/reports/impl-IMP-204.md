# Implement IMP-204 — attempt 2: surface the shortfall, re-derive the cap, clamp at the point of use

**Implemented 2026-10-02, in response to `.improve/reports/verify-IMP-204.md` (VERDICT: FAIL, 4/5
criteria).** The blocking defect is accepted without reservation: `failedCategories` reached
`index.json` and nothing read it, while `categories` still advertised the failed category, so the
site claimed `cs.RO` and then told a reader who clicked it that their own filter was wrong. That is
worse than the hard fail it replaced, and the criterion asked for a **visible** shortfall. All ten
issues in the verifier's §10 are addressed below, each against its finding number.

No git write command was run. `.improve/FEATURES.md` shows as modified in `git status` — that is the
orchestrator's `Status: TODO → IN-PROGRESS` flip (one line, `@@ -1821,7 +1821,7 @@`), not mine.

---

## 1. Finding 1 — BLOCKING: the consumer ignored the field and the UI lied

### 1a. What now reads it

| File | Change |
| --- | --- |
| `web/src/lib/types.ts:34` | `IndexManifest` gains `failedCategories?: string[]` and `truncatedCategories?: string[]`, each documented with *why* a failed category is absent from `categories`. |
| `web/src/lib/failureCopy.ts` | New `IncompleteIndexNotice` and `describeIncompleteIndex(failed?, truncated?)` beside `describeLoadFailure`, which is where IMP-011/016/017 put reader-facing copy. Returns `null` when there is nothing to report, so the banner is gated on the answer itself and a complete index renders the screen it always did. |
| `web/src/App.tsx:316` / `:698` | `incompleteIndex` is a `useMemo` over the manifest, rendered as `<p className="banner banner--warning" role="alert" aria-label={headline} title={detail}>` — the house pattern from the shard-failure banner and the unknown-category banner, so no `styles.css` rule was added. `aria-label` keeps the category lists in the tooltip out of the announcement, which is the IMP-015 bug (`role="alert"` takes its accessible name from the author). |

`web/src/lib/paperIndex.ts` needed **no change**, and that is worth stating precisely: `return body as
IndexManifest` (`paperIndex.ts:202`) is a *compile-time* cast, so it never stripped the property at
runtime — the field was arriving in the app the whole time. What made it unreachable was the missing
declaration on the type. Field-level manifest validation was deliberately **not** added; that is
IMP-098's scope, so `describeIncompleteIndex` instead normalises what it is handed (`Array.isArray`,
string-only, non-empty) and renders nothing for a malformed value rather than throwing.

### 1b. The chip decision — drop the failed category, and why

**`main()` now passes only the categories that answered to `build_shards`** (`build_index.py:491-502`),
so `manifest["categories"]` means "categories this index has papers for".

The verifier's evidence points here and I agree. A chip is a promise — `FeedControls` renders one per
entry and `App.tsx:314` selects them all by default. The alternative (keep the chip, make the empty
state honest) requires the paper list to know *which* categories failed before it can say anything,
which is per-category awareness in `PaperList.emptyMessage` for a state the notice already explains
better. Dropping it also makes the hero stop claiming the category, so both lies ("papers from cs.RO"
in the header, "No papers match the current filters" after the click) go at once.

The deep-link case is already handled by existing work rather than by new code: a stale
`#cat=cs.RO` now resolves through IMP-009's `resolveCategories` to an unknown category, which renders
its own honest banner — "This index does not have that category". `App.incompleteIndex.test.tsx`
pins that coexistence, and the fourth case in that file is exactly the verifier's click-through.

A *truncated* category is treated differently on purpose: it has papers, so it keeps its chip, and the
notice says older papers from it may be missing.

### 1c. Verified in a real browser

`/tmp/rpf204-repro/stub_run.py` produced a real partial index (cs.RO 500 from `start=0`, so zero
papers; the other four healthy), which was copied into a `/tmp` copy of `web/`, built with
`npm run build`, and served over `http.server`. **No live arXiv request.** Screenshots:
`.improve/artifacts/IMP-204/incomplete-index-1280.png`, `incomplete-index-390.png` (that directory is
excluded via `.git/info/exclude`, per the repo's artifact convention).

Accessibility tree at 1280px:

```
paragraph: 2,000 papers from cs.CV, cs.LG, cs.CL, cs.AI · index generated Oct 2, 2026
group "Categories":  All  cs.CV  cs.LG  cs.CL  cs.AI          <- no cs.RO chip
alert "This index is incomplete"
  strong: This index is incomplete.
  text:   cs.RO could not be fetched from arXiv when this index was built, so it has no
          papers here and no filter to browse.
status: 2000 papers match
```

The 390px screenshot matters on its own: at that width the category names are in the visible text
rather than only in `title`, which is the same failure IMP-015's banner was fixed for.

---

## 2. Finding 4 — margin: the cap re-derived

`--max-per-category 12000` is **replaced by 30000** — arXiv's ceiling, i.e. the deploy now says what
it means. Reasoning, in the order I reached it:

1. **A cap of 12,000 was one growth step from a silent cut.** The largest measured 60-day window is
   cs.AI at 10,785 (IMP-198's verifier, 2026-10-02, from `opensearch totalResults`); 12,000 is
   +11.25% against a measured ~9% per window (IMP-205). And a cap-bound truncation marked no category
   failed, so `failedCategories` could not catch it either. That is a tripwire with no alarm.
2. **The cap is a safety bound against the API ceiling, not a content budget.** It exists because
   arXiv answers `max_results > 30000` with HTTP 400 and refuses the offsets past it. Sizing it "just
   above" a measured window conflates those two jobs and makes it the thing that breaks when arXiv
   grows — the API ceiling does not move. 30,000 is 2.8× the largest measurement and cannot be
   outgrown on any horizon a 60-day window implies.
3. **Nothing is lost by raising it.** A healthy run is stopped by the retention window, not the cap:
   38 pages today either way (IMP-198's per-category in-window counts 7+10+6+11+4 at
   `page_size=1000`). The cap only bites once a category outgrows it.
4. **The alternative — a cap small enough to fit the timeout arithmetic (§3) — was rejected** because
   ≤7,000 would truncate cs.AI (10,785) and cs.LG (9,723) *today*, and before this change that
   truncation would have been silent. It would trade a stated risk for a guaranteed product
   regression.

`DeployStepCommandTests.test_the_cap_stays_clear_of_the_real_window_sizes` now asserts
`cap >= 2 * 10785`, so a future edit cannot quietly walk the cap back down to 12,000. The 30,000 side
is already pinned by `QueryCeilingTests` and `test_the_index_step_caps_what_it_fetches_within_the_ceiling`.

### A cap-bound truncation is now recorded, not silent (verifier §4.4)

`collect_papers` counts results received per category and, when a category spends its whole
allowance, appends it to a new `truncated` list (`build_index.py:294-309`) with a WARNING naming the
category and the limit. `main()` records it as `truncatedCategories` (`write_index`,
`build_index.py:341-343`) and the site renders it in the same banner. Spending the allowance is the
only evidence available that more results existed, so it is reported as "may be missing" rather than
guessed at — nothing distinguishes "the cap cut it off" from "the category had exactly this many",
and both mean the same thing to a reader. Reproduced end-to-end:

```
$ FAIL_FROM_START=999999 TOTAL_RESULTS=9000 stub_run.py <repo>/scripts/build_index.py \
      --max-per-category 2000 --out-dir /tmp/rpf204-repro/out-cap
WARNING:root:  cs.CV hit the 2000-result cap; older papers in the window may be missing
WARNING:root:  cs.LG hit the 2000-result cap; ...
  categories         : ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']   <- keeps its papers
  failedCategories   : (absent)
  truncatedCategories: ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
```
Browser-verified as `truncated-index-1280.png`: all five chips present, banner reads "cs.CV, cs.LG,
cs.CL, cs.AI, cs.RO were cut off at this index's per-category limit, so older papers from them may be
missing."

---

## 3. Finding 3 — the timeout arithmetic, recomputed and corrected in the comment

The verifier is right that `deploy.yml:67-68` still claimed "2.5x … ~15x headroom" for a bound the
comment three lines above had made worse. Recomputed, with 70 s = 60 s request timeout + 10 s
inter-page delay and P = pages across the 5 categories:

| case | P | arithmetic | seconds | vs the 4500 s (75 min) step cap |
| --- | --- | --- | --- | --- |
| A. total partition — **what the cap is sized for, and what `DeployStepTimeoutTests` asserts** | — | `5 × 6 × 60` | 1800 | **2.50×** (true, unchanged) |
| C. pages at ~1 s, then a hang | 38 | `38 × 11 + 1800` | 2218 | 2.03× (unchanged) |
| B. every page burns its 60 s bound and succeeds | 38 | `70 × 38 + 1800` | 4460 | 1.009× — 40 s spare. **This is IMP-205's finding F-1, not this item's** |
| cap binds | 38 today | `min(ceil(W/1000), ceil(30000/1000))` per category | 38 | identical to HEAD |

**The important correction to my attempt-1 report:** the "6,000 s worst case" was an artefact of
picking 12,000. Page count is `min(ceil(W/1000), ceil(cap/1000))` per category, and because the
retention break (`assume_newest_first`) fires first at today's volumes, **the healthy path is 38 pages
under every cap ≥ 11,000 — including HEAD's 100,000.** So this item can no longer make the worst case
worse than the branch it started from; at 30,000 it is exactly HEAD's. The cap-binding case B is
reachable only for a category holding 30,000 papers in a 60-day window (2.8× cs.AI, ~12 windows of
growth), and it is arXiv itself that would refuse the offset first.

I did **not** touch `timeout-minutes` (step 75, job 90). Raising it would weaken the protection
IMP-198 added and eat the job budget, and IMP-205 owns the value with its own derivation. What I did
is make the comment honest: it now states the 1800 s the cap is sized against, the 4460 s compound
case with 40 s of slack and an explicit pointer to IMP-205, the page count, and the 2–5 min healthy
runtime. The false "2.5x … 15x" claim is gone.

`DeployStepTimeoutTests` passes **unmodified** (part of the 104). It structurally cannot catch the
page-count case — the verifier says so and I agree; that is IMP-205's test to extend.

---

## 4. Finding 5 — the clamp, at the layer where every limit passes through

`scripts/arxiv_common.py:21-36` now defines `RESULTS_CEILING = 30000` with the manual's quotation, and
`iter_results` clamps a finite over-ceiling limit to it *and logs at WARNING when it does*
(`arxiv_common.py:113-121`). `build_index.UNLIMITED = arxiv_common.RESULTS_CEILING` — one number, one
owner, so the two modules cannot drift.

I verified the exposure the verifier identified before touching it. `grep -rn "iter_results" scripts/`
gives two callers: `build_index.py:265` (already clamped downstream) and
`paper-collector.py:224`, which passes `--max-papers` — `int_at_least(..., 1)`, **no upper bound**, and
`paper-collector.py` never calls `collect_papers`. So `python scripts/paper-collector.py --topic
'cat:cs.CV' --max-papers 100000` really did hand `arxiv.Search` a value above the documented ceiling.
It is clamped now, and the clamp is in `iter_results` rather than in `build_index` precisely so that
path is covered too. Nothing about the timeout or pacing changed: `build_client` is still called
once, still sized from the (now capped) limit, `DEFAULT_DELAY_SECONDS`, `DEFAULT_NUM_RETRIES` and
`DEFAULT_REQUEST_TIMEOUT_SECONDS` are untouched, and `BuildClientTests`' pinned `page_size == 1000`
assertion still holds.

**`max_results=None` was left alone, deliberately, and this is IMP-095's to decide.** `None` means
"no limit"; the library then pages until `offset >= total_results`, which for `cat:cs.CV` (207,907
total results, from the single live call in attempt 1) means it walks into the same 30,000 wall and
*fails the category*. Clamping `None` to the ceiling would make that path robust — but it requires
rewriting `test_arxiv_common.IterResultsTests.test_unlimited_queries_pass_none_and_use_default_page_size`,
which asserts `assertIsNone(search_kwargs["max_results"])`. That is an intentional contract change to
an existing test on **another item's** acceptance criterion, so I am not making it here.

### Finding 8 — IMP-095 reconciliation (do not close it as absorbed)

IMP-095's AC1 is **satisfied**: `RESULTS_CEILING = 30000` and `UNLIMITED` is that same value, so the
two items cannot set different numbers. Its **AC2 is still unmet** and its Notes are now stale. What
an IMP-095 implementer must know:

1. **Do not re-set the number.** `RESULTS_CEILING` lives in `scripts/arxiv_common.py` and
   `build_index.UNLIMITED` is defined *from* it. There is no second literal to reconcile.
2. **The finite-limit clamp of AC1's alternative route is done** (with a log line, as that route
   requires), so only **`max_results=None`** remains.
3. **That remaining piece costs a test rewrite** — `test_unlimited_queries_pass_none_and_use_default_page_size`
   currently pins `None` through to `arxiv.Search`. Deciding it means changing that test to assert the
   clamped value. IMP-204 deliberately did not, so the two items cannot be closed as mutually
   complete by accident.
4. IMP-095's Notes still read "Superseded in scope by IMP-204 (TODO, 12.5)"; that is now wrong on
   both counts — IMP-204 is IN-PROGRESS and the scope split is AC1-done / AC2-open.
5. Per IMP-204's own Notes, the PR body must carry: *the constant moved into this PR, and
   `UNLIMITED` is now `arxiv_common.RESULTS_CEILING` rather than a literal in `build_index.py`.*

---

## 5. Finding 6 — the overstated comment, corrected

`build_index.py:45-61` no longer claims the 30,000 bound "can never" exceed 30,000. It now says what
is true: **a full page never carries a request past 30,000**, and a *short* page can push
`start + max_results` to 30,800, because `arxiv.Client._results` (`:595-600`) advances `offset` by
`len(feed.entries)` rather than by `page_size`. That request is then refused, which terminates the
category — under this item it degrades instead of taking the run down. The verifier's short-page
harness observation (30,800) is the source of the corrected wording. My attempt-1 report's
`start=10000` was wrong: the real pre-fix last request is `start=30000&max_results=1000` = 31,000,
which is what the spec's own ceiling stub produces and what §6 reproduces below.

---

## 6. Commands and results

### Python
```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 104 tests in 1.119s   OK     (three consecutive runs: 1.119s / 1.135s / 1.130s — all OK)
```
Baseline for this attempt was 98; **+6** (`89 → 98 → 104`). Breakdown: 2 `MainTests` truncation cases,
1 `DeployStepCommandTests` margin invariant, 3 `IterResultsTests` clamp cases.
```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests          # exit 0
$ python scripts/build_index.py --help | grep -A2 max-per-category
  Cap results fetched per category (default: 0; 0 or greater, 0 = no cap beyond arXiv's own
  30000-result-per-query limit).
```
`--help` and `readme.md:66` still agree on the default (`0`), the range (`0 or greater`) and the
meaning of `0` (IMP-022 / IMP-031's reconciliation rule).

### Web
```
$ cd web && npm run typecheck        # tsc --noEmit -> clean, no output
$ npm test
  Test Files  17 passed (17)          (16 before)
  Tests       266 passed (266)         (253 before)
$ npm run build                      # ✓ built in 421ms
```
266 = 253 + 8 `describeIncompleteIndex` cases + 6 `App.incompleteIndex` cases − 1 (the
`describeIncompleteIndex()` no-arg call counted once). `web/src/**` is otherwise untouched:
no change to `paperIndex.ts`, `FeedControls`, `PaperList`, `styles.css`, `collections.ts` or
`urlState.ts`.

### Non-vacuity — new tests against the pre-fix sources
`/tmp/rpf204-revert` = repo `tests/` + `git show HEAD:` for both `scripts/*.py` and `deploy.yml`:
```
Ran 104 tests in 1.106s
FAILED (failures=9, errors=1)
FAIL: test_a_limit_above_the_api_ceiling_is_capped_and_said_so
ERROR: test_a_limit_at_the_ceiling_is_left_alone        (AttributeError: RESULTS_CEILING)
FAIL: test_the_cap_stays_clear_of_the_real_window_sizes
FAIL: test_the_comment_documents_the_number_the_command_uses
FAIL: test_the_index_step_caps_what_it_fetches_within_the_ceiling
FAIL: test_a_category_that_spends_the_whole_allowance_is_recorded
FAIL: test_a_failed_category_no_longer_discards_the_others
FAIL: test_a_cap_above_the_ceiling_is_clamped_instead_of_paging_past_it
FAIL: test_no_single_request_exceeds_the_slice_or_the_window
FAIL: test_the_uncapped_default_is_the_documented_ceiling
```
Ten, all non-vacuous. Green in both copies, correctly, and worth naming as controls:
`test_refuses_to_write_index_when_every_category_query_fails` (IMP-004's guarantee — unregressed),
`test_refuses_to_write_an_empty_index` (unmodified, byte-identical),
`test_a_failed_category_is_still_fatal_when_nothing_else_has_papers`,
`test_a_complete_index_records_no_failed_categories`,
`test_a_category_short_of_the_allowance_is_not_recorded_as_truncated`,
`test_a_limit_below_the_ceiling_is_untouched`, and `DeployStepTimeoutTests`.

Non-vacuity of the web change, `/tmp/rpf204b-web` = repo `web/` with `git show HEAD:web/src/App.tsx`:
```
Test Files  1 failed (1)
     Tests  4 failed | 2 passed (6)
× tells the reader the index is incomplete and names the category
    → Unable to find an accessible element with the role "alert"
× keeps the notice across re-renders so it is announced once
× keeps the missing week out of a deep link instead of emptying the feed silently
× says the category may be missing older papers, and keeps it filterable
```
The 2 that pass without the banner are `offers no filter for the category it could not fetch` and the
complete-index control. Being exact: the first is **not independently non-vacuous for the web
change** — it passes because the fixture's `categories` already omits cs.RO, which is the *Python*
contract, and that half is pinned independently by
`MainTests.test_a_failed_category_no_longer_discards_the_others` (asserts
`assertNotIn(failed, manifest["categories"])` and the exact four-category list; fails pre-fix). The
end-to-end assertion is still worth having — it pins the chain manifest → hero → chips — but it is
the Python test, not this one, that carries the weight.

### The defect reproduced, hermetically (`/tmp/rpf204-repro/stub_run.py`)
127.0.0.1 stand-in serving real Atom, honouring `opensearch:totalResults`; `runpy.run_path` on
`scripts/build_index.py`; real `build_client`, real page size, real retry count, real 60 s request
timeout, `query_url_format` repointed and `delay_seconds = 0` as the only changes.

**Degradation** (cs.RO 500 from `start=0`, i.e. zero papers; the other four 200):
```
PRE-FIX  ERROR:root:Refusing to write an index: the arXiv query failed for cs.RO.
         REPRO {"exit_code": 1, "requests": 14}      index.json: no
POST-FIX ERROR:root:Wrote an index missing 1 of 5 categories; index.json records them under
                'failedCategories': cs.RO
         REPRO {"exit_code": 0, "requests": 14}
         categories         : ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI']     <- cs.RO dropped
         failedCategories   : ['cs.RO']
         totalPapers        : 2000
```
**Ceiling** (stub 200 below `start=30000`, 500 at/above; one category): pre-fix
`last_start: cat:cs.CV start=30000 max_results=1000`, `max_start_plus_max_results: 31000`, exit 1,
nothing written — the correct number, replacing attempt 1's misquote of the spec's `10000`. Post-fix:
last request `start=29000&max_results=1000`, `max_start_plus_max_results: 30000`, exit 0.

### No live arXiv request this attempt
Everything above is localhost. The one live call remains attempt 1's mandated smoke run
(`--category cs.CV --max-per-category 300` → 300 papers, one shard, the five original manifest keys,
`failedCategories` absent, exit 0). I did not repeat it.

---

## 7. Test inventory

Removed: none beyond attempt 1's sanctioned IMP-004 rewrite.
**Added this attempt (10):** `MainTests.test_a_category_that_spends_the_whole_allowance_is_recorded`,
`…_is_not_recorded_as_truncated`; `DeployStepCommandTests.test_the_cap_stays_clear_of_the_real_window_sizes`;
`IterResultsTests.test_a_limit_above_the_api_ceiling_is_capped_and_said_so`,
`…_at_the_ceiling_is_left_alone`, `…_below_the_ceiling_is_untouched`;
`describeIncompleteIndex` × 8 in `failureCopy.test.ts`; `App.incompleteIndex.test.tsx` × 6.
**Modified (2):** `MainTests.test_a_failed_category_no_longer_discards_the_others` — the
`categories` assertion now asserts the *absence* of the failed category instead of pinning the list
including it (the verifier's §2.3); everything else it asserts is unchanged, and it still fails
pre-fix. `failureCopy.test.ts` — import line only.

`tests/test_arxiv_common.py:TestIterationStopsAtLimit` is untouched and still green.

## 8. Open questions for a reviewer

1. **The partial run still exits 0.** That is unchanged and I still argue for it (§ the verifier
   confirmed the deploy topology: `build_index` and the Pages upload are the same job, so a non-zero
   exit would skip both and leave the previous deployment — the empty deploy IMP-204 exists to
   remove). What changed is that the thing exit 0 publishes now tells the reader it is short, which
   was the whole gap.
2. **`failedCategories` and `truncatedCategories` are additive manifest keys.** No existing field was
   renamed or retyped, so the hand-mirrored wire contract is unbroken; `web/src/lib/types.ts` is the
   mirror and it is updated here. Surfacing the notice inside the existing banner system means no
   `styles.css` change.
3. **A stale `web/public/data` in a local working tree** will render the notice until rebuilt. That is
   the honest reading of the data, not a bug.
4. **IMP-205 still owns the 40-second slack** on the compound case B. This item no longer spends it
   and no longer makes it worse, but it does not fix it.
5. `DEPLOY_INDEX_RUN` in `tests/test_build_index.py` is still broadened from `^\.\.\.$` to
   `(?:\s|$)` (attempt 1). `DeployStepCommandTests` fails if the flag is ever removed, so the
   tripwire is preserved by a stronger test.