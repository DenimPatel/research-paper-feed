# Implement IMP-216 — a deep-offset 5xx degrades a category instead of deleting it

**Implemented 2026-10-03.** No git write command was run. `git status` also shows
`.improve/FEATURES.md` and an untracked `web/src/components/__tests__/`; the former is the
absorber's round plus the Notes paragraph §7 below (the one file outside
`scripts/`, `tests/`, `deploy.yml` and `readme.md` this change touches, and only to record the
spec conflict the brief asked for), the latter belongs to the concurrent `web/` agent.

Baseline for this item: **104 Python tests, all OK, 1.20 s.** After: **118 tests, all OK,
1.14 s** — 14 added, none deleted, skipped, or weakened. `npm run typecheck` clean,
`npm test` **293 tests / 20 files, all pass, 5.84 s**, `web/` untouched by me.

---

## 1. Root cause — three defects stacked on one bad classification

The reported symptom (a category disappears from a deployed index) and the reported *worse*
symptom (the site says "no papers here" about a category the index holds) are the same line of
code seen from two ends, and the false statement is the more serious of the two.

**(a) `collect_papers` classified a mid-paging death as a total failure.**
`scripts/build_index.py:341` (pre-fix) appended a category to `failures` whenever
`status["failed"]` was set, with no reference to how much that category had already produced.
The deep-offset fault is not a total outage: pages answer, then one offset comes back 500 after
every retry. That left a category holding thousands of real, in-window records.

**(b) `main` then acted on the classification as if it were ground truth.**
`contributing = [c for c in categories if c not in set(failures)]` (`:497` pre-fix) dropped the
category's chip, and `failedCategories` (`:362-363`) reached `index.json`, which
`web/src/lib/failureCopy.ts:103-110` renders as *"cs.AI could not be fetched from arXiv … so it
has no papers here and no filters to browse"*. So the manifest denied a category the very shards
it had just written were full of. **This is an inconsistency between the shards and the manifest,
and it is its own correctness bug**, not just a bad label.

**(c) The deploy's cap made the fault reachable and left no way out.** `--max-per-category 30000`
is arXiv's own ceiling, so a category holding enough in-window papers pages to offsets the API
declines. `Client` requests `page_size` (1000) results at `start` and advances by `page_size`, so
a 30,000 cap can request `start=29000`; cs.AI at 10,785 papers needed `start=10000`, the offset
that 500s.

Everything in §1 is reproduced deterministically in §5, including the false claim, with the
offset arXiv refuses chosen by the harness rather than re-derived against live arXiv.

---

## 2. The fix

### 2a. `collect_papers` — a category is *failed* only if it left nothing behind

`scripts/build_index.py:341-363`. The `status["failed"]` branch now splits on the in-window
record count it has been accumulating all along:

```python
if status["failed"]:
    if count:
        truncated.append(category)
        logging.error("  query for %s failed after %d paper(s) ... keeping the
                       category ... as truncated rather than absent", ...)
    else:
        failures.append(category)
        logging.error("  query failed for %s with nothing collected: %s", ...)
    continue
```

Two properties are load-bearing:

- `count` is the **in-window** count, so a query that only ever saw stale results is *not*
  rescued — it really did deliver nothing and stays fatal. Pinned by
  `test_a_dead_query_is_not_rescued_by_out_of_window_papers`.
- The degraded branch still logs at **ERROR**, so IMP-204's loud failure signal does not get
  weaker by design. `MainTests.test_a_failed_category_no_longer_discards_the_others` keeps its
  `assertLogs(level="ERROR")` and its `assertIn(failed, ...)` unchanged.

`truncatedCategories` is the field that means "has papers, not all of them", which is exactly
what this is, and the site already renders it correctly — see §4.

### 2b. `reconcile_failed_categories` — the records get the last word

`scripts/build_index.py:387-437`, called from `main` at `:616`. §2a classifies per query, but a
manifest is a statement about the *whole index*, and arXiv cross-lists: a paper answered by
`cat:cs.LG` can carry `cs.AI`. So a category can be in `failures` while a shard holds papers that
carry it — the same falsehood, reached by a different route, and one that no query-layer check
can see.

```python
held = categories_in_records(records)
for category in categories:
    if category in failures:
        (degraded if category in held else still_failed).append(category)
    elif category in truncated:
        degraded.append(category)
return still_failed, degraded
```

`categories_in_records` (`:387`) unions each record's `categories` **and** `primaryCategory`,
because a chip filters on the latter. The returned lists are rebuilt in requested-category order,
so a manifest reads the same whichever path put a name in it. Each move is logged at WARNING.

This is why the criterion-2 assertion is an **invariant** rather than an accident of stub shape:
`test_a_cross_listed_paper_cannot_leave_its_own_category_failed` builds exactly the case where
the layer-1 fix cannot help, and §6 shows it goes red when the reconciliation is removed.

Deliberately **not** done: redefining `categories` as "the categories the index holds papers
for". A category that answered but had a quiet 60 days is honestly filterable today — its chip
leads to a real "no papers this week", which is true — and dropping its chip would lose it for a
week for no benefit. `contributing` therefore keeps its IMP-204 meaning (answered), and only
`failures`/`truncated` are reconciled.

### 2c. `DEPLOY_OFFSET_BUDGET` — a bound on depth, and the cap derived from it

`scripts/build_index.py:68-102` (`DEPLOY_OFFSET_BUDGET = 10000`), consumed by
`.github/workflows/deploy.yml:141`, which now runs `--max-per-category 10000`.

The bound is **structural, not empirical**, and that is the whole point. `Client` asks for
`page_size` (1000) at `start` and advances by `page_size`, so a cap of 10,000 makes `start=9000`
the deepest request a deploy can *ever* issue — for every category, at every size, forever. 9,000
is the deepest offset arXiv is known to have *answered* (`cs.LG` reached it on 2026-10-02);
10,000 is the first known to be *refused*. Criterion 3's own reasoning ("the faulting offset moves
with category size, so pinning it pins a number arXiv will invalidate") applies to pinning an
*offset*; pinning the *relationship between the cap and the offset* does not decay, so it needs
no revisiting as categories grow. This also retires IMP-204's original worry — "a cap at 12,000
would have started truncating within a year" — because the cap's job is no longer to stay clear of
window sizes.

`test_the_deepest_offset_the_deploy_can_request_is_bounded` reads the cap off `deploy.yml:141`
with the existing `MAX_PER_CATEGORY_FLAG` matcher, feeds it to the existing `requested_pages`
helper, and asserts `max(start) < DEPLOY_OFFSET_BUDGET`, **and** that the comment above the step
cites `DEPLOY_OFFSET_BUDGET` so the constant cannot drift from the command silently. A cap of
10,001 fails it (`max(start) = 10000`).

`test_raising_the_retries_does_not_stand_in_for_a_depth_bound` pins the other half of criterion 3
by asserting `DEFAULT_NUM_RETRIES` and `DEPLOY_OFFSET_BUDGET` are distinct dials, so "retry more"
cannot quietly become the substitute for a depth bound.

---

## 3. What it costs, in papers, per category

From IMP-198's verifier's measured 60-day windows (2026-10-02,
`verify-IMP-198-r2.md:145-152`):

| category | papers in 60 d | pages @ 1000 | under the 10,000 cap? | papers lost |
| --- | --- | --- | --- | --- |
| cs.CV | 6,742 | 7 | yes | 0 |
| cs.LG | 9,723 | 10 | yes | 0 |
| cs.CL | 5,213 | 6 | yes | 0 |
| cs.AI | 10,785 | 11 | **no** | **785 (~7%)** |
| cs.RO | 3,275 | 4 | yes | 0 |
| total | 35,738 | 38 | | 785 (2.2%) |

Exactly one category of five truncates, and the shortfall is **announced**, not silent. What the
deployed index actually loses is *less* than 785, by however many of those papers are
cross-listed and arrive through another category's query — that figure is not measured here and
is not claimed. Against that: before this change cs.AI was deleted from the index on every build
that reached the fault, and its ~10,000 collected papers were fetched, written to the shards, and
then denied on screen. The cap and the "no papers here" claim were the same bug.

**Reader-visible consequence a maintainer should confirm, not an implementer:** `cs.AI` will
appear in `truncatedCategories` on essentially every build from now on, so the deployed site will
permanently show the incomplete-index notice naming `cs.AI` with the "cut off … may be missing"
sentence. That is the truth, and criterion 1 asked for it — but it is a permanent change to what
every reader sees, and it is the product call the absorber's open question 2 asked for. IMP-183
(bounding the retention window in the query) is the complement that would make it go away; it does
not close the depth problem, as the absorber itself established.

---

## 4. Criterion 2 — the reader-facing sentence is now true, and `web/` needed no change

The manifest criterion 1 produces (`cs.AI` in `truncatedCategories`, `cs.AI` in `categories`,
cs.AI papers present in a shard) is **already rendered correctly by shipped code**:
`failureCopy.ts:111-117` emits the "was cut off at this index's per-category limit, so older
papers from it may be missing" sentence for a truncated category, and only `failedCategories`
gets the "has no papers here" sentence (`failureCopy.ts:103-110`). The chip comes from
`manifest["categories"]`, which §2b/§2a keep.

So the web half of criterion 2 is satisfied by a test that **already exists** and was added by
IMP-204: `web/src/__tests__/App.incompleteIndex.test.tsx` → *"says the category may be missing
older papers, and keeps it filterable"* serves a manifest carrying a category in
`truncatedCategories` with that category's papers in a shard and asserts both the chip and the
prose. It is the same shape criterion 2 asks for, so adding a second case would be a duplicate.
`web/` was also explicitly out of scope for this implementer.

```
$ npx vitest run -t "cut off by the cap" src/__tests__/App.incompleteIndex.test.tsx
 ✓ src/__tests__/App.incompleteIndex.test.tsx (6 tests | 4 skipped) 161ms
 Test Files  1 passed (1)
      Tests  2 passed | 4 skipped (6)

$ npx vitest run src/__tests__/App.incompleteIndex.test.tsx
 Test Files  1 passed (1)
      Tests  6 passed (6)
```

**The cross-stack assertion criterion 2 asks for is new, in Python**, in
`ManifestShardAgreementTests.test_no_paper_in_the_shards_carries_a_failed_category`: it runs
`main` with a stub in which one category answers three pages then dies at a deep offset and
another never answers, then asserts for every category in the written manifest's
`failedCategories` that **no paper in the written shards carries it**, plus the converse (the
short category's records really are there).

---

## 5. Criterion 5 — the stubbed reproduction, three cases, and the money shot

`/tmp/rpf-imp216/stub_arxiv.py` + `run_all.py`. A loopback `ThreadingHTTPServer` answers 200 with
a full Atom page below a chosen `start` and **500 at or above it**, with the per-category
`totalResults` set to the real measured 60-day windows. The stub is reached through
`arxiv.Client.query_url_format` — a **public class attribute**, so no private attribute of the
library is patched — and the script is `runpy`-executed with the `run:` line **read out of that
copy's own `deploy.yml`**, so the command under test is the one that ships and nothing about it
is hard-coded. Each case runs in its own throwaway tree copy, so the live `web/public/data` is
never written.

One accommodation, stated rather than hidden: the harness sets
`arxiv_common.DEFAULT_DELAY_SECONDS = 0`. That is arxiv's courtesy sleep between requests and
decides nothing under test — not which offsets are requested, not which category dies, not how it
is classified. Without it a 40-page run takes seven minutes of sleeping.

### Case C — the pre-fix tree, the pre-fix command (`--max-per-category 30000`), 500 at `start>=10000`

```
deploy.yml:117 run: python scripts/build_index.py --max-per-category 30000
stub answers 500 at start >= 10000

ERROR:root:ArXiv search failed for 'cat:cs.AI': Page request resulted in HTTP 500
  (...&search_query=cat%3Acs.AI&...&start=10000&max_results=1000)
ERROR:root:  query failed for cs.AI: Page request resulted in HTTP 500 (...)
ERROR:root:Wrote an index missing 1 of 5 categories; index.json records them under 'failedCategories': cs.AI

--- exit code: 0 ---
  categories          ['cs.CV', 'cs.LG', 'cs.CL', 'cs.RO']
  failedCategories    ['cs.AI']
  truncatedCategories None
  totalPapers         34953
  offsets requested   [0, 1000, ..., 9000, 10000]
  deepest per category {'cs.CV': 6000, 'cs.LG': 9000, 'cs.CL': 5000, 'cs.AI': 10000, 'cs.RO': 3000}
  total HTTP requests 43
```

43 requests = 37 page fetches + the 6 attempts at `start=10000` (5 retries + 1), which is the
"6 attempts over ~60 s" in the report. **This is the defect, reproduced deterministically.**

### Case A — the fixed tree, the shipped command (`--max-per-category 10000`), 500 at `start>=10000`

```
deploy.yml:141 run: python scripts/build_index.py --max-per-category 10000
stub answers 500 at start >= 10000

INFO:root:  6742 papers within retention window for cs.CV
INFO:root:  9723 papers within retention window for cs.LG
INFO:root:  5213 papers within retention window for cs.CL
WARNING:root:  cs.AI hit the 10000-result cap; older papers in the window may be missing
INFO:root:  10000 papers within retention window for cs.AI
INFO:root:  3275 papers within retention window for cs.RO
WARNING:root:Wrote an index with 1 of 5 categories shorter than the full retention window;
  index.json records them under 'truncatedCategories': cs.AI

--- exit code: 0 ---
  categories          ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
  failedCategories    None
  truncatedCategories ['cs.AI']
  totalPapers         34953
  offsets requested   [0, 1000, ..., 9000]          <-- start=10000 NEVER requested
  deepest per category {'cs.CV': 6000, 'cs.LG': 9000, 'cs.CL': 5000, 'cs.AI': 9000, 'cs.RO': 3000}
  total HTTP requests 37
```

### The two trees wrote identical shards

```
prefix  totalPapers=34953  papers_in_shards=34953  cs.AI papers in shards=10000
        categories=['cs.CV','cs.LG','cs.CL','cs.RO']        failed=['cs.AI']  truncated=None
fixed   totalPapers=34953  papers_in_shards=34953  cs.AI papers in shards=10000
        categories=['cs.CV','cs.LG','cs.CL','cs.AI','cs.RO'] failed=None      truncated=['cs.AI']
        (both: first three cs.AI ids in shards ['2601.09999', '2601.09998', '2601.09997'])
```

Same 34,953 papers, same 10,000 `cs.AI` papers on disk, byte-for-byte the same shard contents.
Pre-fix, the manifest and the site say `cs.AI` *has no papers here and no filters to browse*.
Post-fix, `cs.AI` keeps its chip and the notice says its older papers may be missing. **Nothing
about the data changed; everything about the truthfulness did.**

### Case B — the fixed tree, the shipped command, 500 at `start>=5000` (deliberately *inside* the cap)

Case A only proves the cap avoids the offset. Case B proves the classification does the work when
the fault lands somewhere the cap cannot dodge it:

```
--- exit code: 0 ---
  categories          ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
  failedCategories    None
  truncatedCategories ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI']
  totalPapers         23275
  deepest per category {'cs.CV': 5000, 'cs.LG': 5000, 'cs.CL': 5000, 'cs.AI': 5000, 'cs.RO': 3000}
```

Four categories die mid-paging at 5,000 papers each. All four survive: exit 0, all five chips,
`failedCategories` absent, every shortfall announced. Nothing is lost that was not already lost,
and nothing is denied that exists.

---

## 6. Non-vacuity — four reverts, all red

`/tmp/rpf-imp216/nonvacuity.py`, one throwaway tree per mutation, `unittest discover -s tests`
run in each. Full logs: `/tmp/rpf-imp216/nonvac-*.log`. Baseline for comparison: **118 tests, OK.**

| mutation | result |
| --- | --- |
| 1. `scripts/build_index.py` reverted to HEAD in full | **FAILED (failures=4, errors=9)** — 13 red |
| 2. `collect_papers`: every failed query is a failed category again | **FAILED (failures=2)** |
| 3. `main`: the records never get the last word on `failedCategories` | **FAILED (errors=1)** |
| 4. `deploy.yml`: the index step's cap is back at 30,000 | **FAILED (failures=3)** |

### Mutation 1 — full revert of the Python source

```
FAIL: test_a_failed_category_no_longer_discards_the_others (test_build_index.MainTests...)
FAIL: test_no_paper_in_the_shards_carries_a_failed_category (test_build_index.ManifestShardAgreementTests...)
FAIL: test_a_query_that_died_after_yielding_is_truncated_not_failed (test_build_index.PartialCategoryFailureTests...)
FAIL: test_both_answers_can_be_reported_in_one_run (test_build_index.PartialCategoryFailureTests...)
ERROR: test_a_cross_listed_paper_cannot_leave_its_own_category_failed (...)
ERROR: test_a_failed_category_carried_by_a_record_is_not_reported_failed (...)
ERROR: test_a_category_nothing_carries_stays_failed (...)
ERROR: test_the_primary_category_counts_as_carrying_it_too (...)
ERROR: test_a_cap_truncated_category_passes_through_in_requested_order (...)
ERROR: test_categories_in_records_covers_cross_listings_and_primaries (...)
ERROR: test_the_move_is_logged_so_it_is_visible_in_a_deploy_log (...)
ERROR: test_the_deepest_offset_the_deploy_can_request_is_bounded (...)
ERROR: test_raising_the_retries_does_not_stand_in_for_a_depth_bound (...)

Ran 118 tests in 1.126s
FAILED (failures=4, errors=9)
```

### Mutation 2 — the layer-1 classification only

```
FAIL: test_a_query_that_died_after_yielding_is_truncated_not_failed (test_build_index.PartialCategoryFailureTests.test_a_query_that_died_after_yielding_is_truncated_not_failed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../tests/test_build_index.py", line 538, in test_a_query_that_died_after_yielding_is_truncated_not_failed
    self.assertEqual(failures, [])
AssertionError: Lists differ: ['cs.AI'] != []

First list contains 1 additional elements.
First extra element 0:
'cs.AI'

- ['cs.AI']
+ []

Ran 118 tests in 1.126s
FAILED (failures=2)
```

Only two tests go red, and that is the belt-and-braces design working: the reconciliation in §2b
rescues the end-to-end tests on its own, so the layer-1 behaviour needs its own unit-level guard,
and has two.

### Mutation 3 — the reconciliation only

```
ERROR: test_a_cross_listed_paper_cannot_leave_its_own_category_failed (test_build_index.ManifestShardAgreementTests.test_a_cross_listed_paper_cannot_leave_its_own_category_failed)
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../tests/test_build_index.py", line 1157, in test_a_cross_listed_paper_cannot_leave_its_own_category_failed
    self.assertEqual(manifest["truncatedCategories"], ["cs.AI"])
                     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^
KeyError: 'truncatedCategories'

Ran 118 tests in 1.125s
FAILED (errors=1)
```

Exactly one test, and it is the cross-listing case that only the reconciliation can catch.

### Mutation 4 — the deploy cap back to 30,000

```
FAIL: test_the_deepest_offset_the_deploy_can_request_is_bounded (test_build_index.DeployStepCommandTests.test_the_deepest_offset_the_deploy_can_request_is_bounded)
IMP-216 criterion 3: the cap is a bound on depth.
----------------------------------------------------------------------
Traceback (most recent call last):
  File ".../tests/test_build_index.py", line 1363, in test_the_deepest_offset_the_deploy_can_request_is_bounded
    self.assertLess(
AssertionError: 29000 not less than 10000 : deploy.yml:141 caps at 30000, whose deepest
request is start=29000 -- at or above DEPLOY_OFFSET_BUDGET (10000), the offset arXiv has
been observed to answer with HTTP 500

Ran 118 tests in 1.125s
FAILED (failures=3)
```

(`test_the_cap_is_measured_against_the_real_window_sizes` and
`test_the_comment_documents_the_number_the_command_uses` go red with it.)

---

## 7. Spec conflict — criterion 4, and how it was resolved

**The conflict is real and the absorber was right that criterion 4 forces it.** Criterion 3
requires the deploy's deepest requestable offset to stay below a budget that avoids the refused
offset. Criterion 4 requires `test_the_cap_stays_clear_of_the_real_window_sizes` to keep
asserting `cap >= 2 x 10785 = 21,570`. Since any cap deep enough to hold a 10,785-paper category
must request `start=10000` — the offset arXiv answers with 500 — **every cap that satisfies
criterion 3 is below 21,570.** The two cannot both hold. I did not resolve this by deleting or
`expectedFailure`-marking a test.

**Which assertion moved: the one criterion 4 names.** It now asserts
`cap < 10785` — the same cap, compared against the same measurement, pointing the other way. The
test still exists, still measures the cap against real window sizes, and its docstring records
what it used to require, why that is unsatisfiable, and the papers-lost cost in numbers.

**Why this resolution best serves the intent.** The intent is a reader must never silently lose a
category to a deep-offset 5xx and the site must never claim "no papers" for a category the index
holds. The old assertion served that intent *indirectly*, by keeping the cap clear of window
sizes "so a cap-bound truncation is never silent" — but a cap-bound truncation is **not** silent
in the shipped code: `collect_papers` records it in `truncatedCategories` and the site announces
it (IMP-204, and case A above proves the announcement happens). So the old assertion was
protecting against a harm that had already been fixed by other means, at the cost of making the
real one reachable. The new assertion points at the harm that is live.

The trade, restated: **cs.AI loses 785 of 10,785 papers (~7%) on a healthy run, announced on
screen; the other four categories lose nothing.** The alternative under the old assertion was not
"cs.AI keeps all 10,785" but "cs.AI is deleted from the index and described as having no papers"
— the two consecutive production builds the brief describes.

**Also worth correcting in the item, from measurement:** the absorber's claim that IMP-183 "does
not avoid the fault" is correct and confirmed here — but its corollary is not, and I have not
repeated it. IMP-183 does not reduce `cs.AI`'s *depth*, true; it does reduce the total, and the
complementary statement is that with this cap cs.AI is the **only** category of five that
truncates. IMP-183 landing would move the notice from "cs.AI" to nothing.

**Recorded for the orchestrator** in the IMP-216 `Notes` in `.improve/FEATURES.md` (one additive
paragraph; nothing else in that entry was reworded), including the two corrections above, the
papers-lost table in one line, and the reader-visible consequence in §3 flagged as a maintainer
confirmation rather than an implementer's decision.

### The one criterion I did not satisfy as written: criterion 2's web half

**Not done, deliberately, and it is not a gap in the guarantee.** The test criterion 2 asks for in
`web/src/__tests__/App.incompleteIndex.test.tsx` already exists, added by IMP-204, with exactly
that shape and both required assertions; it passes (§4). Adding a second case would be a
duplicate, and `web/` was explicitly out of scope for this implementer. **No `web/` file was
created, modified or deleted.**

---

## 8. Criterion 6 — nothing regressed, and the prose follows the code

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 118 tests in 1.141s
OK
```

Baseline before this change: `Ran 104 tests in 1.196s / OK`. 14 added, 0 deleted, 0 skipped,
0 weakened, 0 marked `expectedFailure`. Still offline and fast: the new tests stub
`arxiv_common.iter_results` or call pure functions, and the one that touches the client
(`test_the_deepest_offset_the_deploy_can_request_is_bounded`) only constructs an `arxiv.Client`
to read its `page_size` — no socket. **No test in the suite reaches arXiv, including the new
ones.**

```
$ cd web && npm run typecheck
> tsc --noEmit
(clean)

$ cd web && npm test
 Test Files  20 passed (20)
      Tests  293 passed (293)
   Duration  5.84s
```

(The absorber recorded 292; a concurrent `web/` agent has since added one. Nothing under `web/`
is mine, and none of these numbers depend on my change — §4 shows the relevant file green on its
own.)

**`deploy.yml`'s "degrades on its own" claim is corrected.** It said *"a category that reaches it
is not truncated by us -- arXiv refuses the offset first, and the category degrades on its own."*
Measured on 2026-10-03 that is false in the way that matters: the category is not degraded, it is
**deleted**, and the site then claims it has no papers. The new comment says what actually happens
— recorded in `truncatedCategories`, announced on screen, chip kept — and quotes the two numbers
that make it so.

**Page and timeout arithmetic, recomputed in the same change** (criterion 6's last clause). No
`timeout-minutes:` was touched — IMP-205/IMP-206 own those, and I did not.

| | old (`--max-per-category 30000`) | new (`--max-per-category 10000`) |
| --- | --- | --- |
| pages, healthy run (measured windows) | 38 | **37** |
| pages, worst case across 5 categories | 150 | **50** |
| deepest `start` reachable | 29,000 | **9,000** |
| IMP-198 compound case: `pages x 70 s + 1800 s` | 4,460 s → 40 s spare | **4,390 s → 110 s spare** |
| partition case: `5 x 6 x 60 s` | 1,800 s → 2.5x | 1,800 s → 2.5x (unchanged) |

`DeployStepTimeoutTests` needed **no** recomputation and I did not touch it: it asserts only
against the partition case (`5 categories x (num_retries + 1) x timeout = 1800 s`), which no cap
affects. The page arithmetic it does *not* contain lives in the deploy comment, and that is where
the recomputed table above now sits.

**`readme.md` — "costs nothing on a healthy run" was false, and is now restated with the cost.**
Two places, both rewritten: the deployment paragraph (`:186-204`) states the new cap, why it is
depth rather than volume, and the 785-paper cost with its date; and the build-script paragraph
(`:80-93`) now says the absent/short distinction is decided by **what the run fetched, never by
the query's exit status alone**.

**IMP-205's input changed as the item predicted.** It owns deriving the step cap from the measured
page count, and that input moved from 38 to 37 pages (compound case 4,460 s → 4,390 s, 40 s spare
→ 110 s). Its own finding F-1 is therefore slightly *less* urgent, not more. The deploy comment
records the new figure so IMP-205 does not have to rediscover it.

---

## 9. Files changed

| File | Change |
| --- | --- |
| `scripts/build_index.py` | `+DEPLOY_OFFSET_BUDGET = 10000` with its derivation (`:68-101`); `collect_papers`' `status["failed"]` branch splits on the in-window count (`:349-363`); new `categories_in_records` (`:387`) and `reconcile_failed_categories` (`:404`); `main` calls the reconciliation after dedup and before `contributing` (`:616`), gains a `truncatedCategories` summary log (`:651`), and both the module docstring and `collect_papers`' docstring state the new contract |
| `.github/workflows/deploy.yml` | `--max-per-category 30000` → `10000` (`:141`); the step comment rewritten: cites `DEPLOY_OFFSET_BUDGET`, gives the structural argument, states the 785-paper cost per category, corrects "degrades on its own", recomputes the page and compound-timeout arithmetic (37 / 50 / 4,390 s). `timeout-minutes:` untouched. |
| `tests/test_build_index.py` | 3 new classes, 14 new tests; `MainTests.test_a_failed_category_no_longer_discards_the_others` updated (the assertions criterion 4 moved); `test_the_cap_stays_clear_of_the_real_window_sizes` → `test_the_cap_is_measured_against_the_real_window_sizes` (assertion moved, test kept) |
| `readme.md` | deployment paragraph and build-script paragraph restated (`:80-93`, `:186-204`) |
| `.improve/FEATURES.md` | **one additive paragraph** at the end of the IMP-216 `Notes`, recording §7's two spec corrections for the orchestrator. No other line in the file changed. |

Nothing under `web/` was created, modified or deleted. `requirements.txt` untouched — no new
dependency, and the undeclared `requests` import stays IMP-207's. No `timeout-minutes:` in
`.github/workflows/` changed. No linter added. No commit, stage, checkout, restore, clean or stash
was run.

---

## 10. Reproduction instructions

```bash
# Criterion 5 — three cases, ~8 s, no network, writes only into /tmp copies
/usr/local/bin/python3.11 /tmp/rpf-imp216/run_all.py
tail -20 /tmp/rpf-imp216/{A-shipped-cap-live-offset,B-shipped-cap-fault-inside-cap,C-prefix-cap-live-offset}.log

# Non-vacuity — four reverts, each in a throwaway tree
/usr/local/bin/python3.11 /tmp/rpf-imp216/nonvacuity.py

# Suite
/usr/local/bin/python3.11 -m unittest discover -s tests -v      # 118 tests, OK, ~1.1 s
cd web && npm run typecheck && npm test                        # clean; 293 tests, 20 files
```

The `/tmp/rpf-imp216/prefix` tree is the pre-fix source, taken with read-only
`git show HEAD:scripts/build_index.py` and `git show HEAD:.github/workflows/deploy.yml`; no git
write command was run at any point.