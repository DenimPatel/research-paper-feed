# Verify IMP-204 — Stop the weekly deploy's uncapped index build from paging past arXiv's limits

**VERDICT: FAIL — 4 of 5 criteria met.** Criterion 2 fails on the consumer side: the
partial index is written correctly and the field really does land in `index.json`, but
**nothing in `web/` reads it**, and the site affirmatively *misreports* which categories it
contains. For a site visitor this change is **worse** than the IMP-004 hard-fail it weakens.
Everything else — the bound, the total-failure path, the deploy default, the tests, the docs —
holds up under independent reproduction.

Verified 2026-10-02. Read-only throughout; no source file was modified, no git write command was
run, no board tool was called, and **no live arXiv request was made** (every arXiv interaction
below is against a localhost stand-in).

---

## 1. CRITERION 1 — the bound. **MET.**

### 1.1 The two limits were NOT conflated. This is the part the implementer got right.

The spec warned that 30,000 and 2,000 "may apply to different parameters". They do. Verified
against the installed package source, `/Library/Frameworks/Python.framework/Versions/3.11/
lib/python3.11/site-packages/arxiv/__init__.py`:

- `Client.page_size` (`:508-514`): *"Maximum number of results fetched in a single API request …
  **The API's limit is 2000 results per page.**"* → the 2,000 is the **per-request slice**.
- `Client._format_url` (`:602-614`) writes `url_args.update({"start": start, "max_results":
  page_size})`. So **only `page_size` reaches the wire** — `Search.max_results` never does.
- `arxiv_common.build_client` sizes `page_size = max(1, min(DEFAULT_PAGE_SIZE=1000,
  max_results))` (`scripts/arxiv_common.py:83`), i.e. **always ≤ 1000, already inside the
  2,000-slice limit before this change**.

So the pre-fix "HTTP 400 from `max_results > 30000`" path was **structurally unreachable** in this
repo; the real exposure was always the deep `start` offsets. The implementer's report §2 says
exactly this and does not claim credit for fixing a 400 that could not fire. That is the honest
framing, and it matters: it means criterion 1's real content is the `start`-offset bound, which
is what actually got fixed.

### 1.2 30,000 is the right number, and the code stops at it.

`UNLIMITED = 30000` (`scripts/build_index.py:61`). Empirically, one category, stub serving full
1000-entry pages, totalResults 200000, stub 500s at `start >= 30000`:

```
######## PRE-FIX (HEAD source) ########
INFO Querying cat:cs.CV (limit 100000) ...
ERROR ArXiv search failed for 'cat:cs.CV': ...&start=30000&max_results=1000
ERROR Refusing to write an index: the arXiv query failed for cs.CV.
REPRO pre-ceiling: {"exit_code": 1, "requests": 36,
  "distinct_starts": [0,1000,2000,...,28000,29000,30000],
  "max_start_plus_max_results": 31000, "out_dir_exists": false, "index_json": false}

######## POST-FIX (working tree) ########
INFO Querying cat:cs.CV (limit 30000) ...
INFO Wrote 30000 papers across 1 shards to ...
REPRO post-ceiling: {"exit_code": 0, "requests": 30,
  "distinct_starts": [0,1000,2000,...,27000,28000,29000],
  "max_start_plus_max_results": 30000, "out_dir_exists": true, "index_json": true}
```

**The implementer's claim that the pre-fix request was `start=10000&max_results=1000` is WRONG.**
That figure is in the spec's Intent, from a different stub threshold. The pre-fix code pages
until it hits the API's refusal — with a 30,000 wall it reaches `start=30000&max_results=1000`,
i.e. `31000`, then dies. Same conclusion (above the ceiling, exit 1, nothing written), wrong
number. Not a criterion failure; the report should not have repeated the spec's `10000` as its own
finding without re-deriving it.

**The ceiling is respected: worst case is exactly 30,000, never above.** The cap does bind the
paging.

### 1.3 One honest caveat: the 30,000 guarantee is conditional, not absolute.

`tests/test_build_index.py:33-45`'s `requested_pages()` advances `start += page_size`, i.e. it
models a feed that returns **full** pages. But `arxiv.Client._results` (`:595-600`) advances
`offset += len(feed.entries)` — the number of entries **actually returned**. With a short
non-empty page, `start` is no longer a multiple of `page_size` and `start + max_results` can
exceed 30,000. Reproduced, same harness, stub answering 200-entry pages:

```
distinct_starts: [0, 200, 400, ..., 29600, 29800]
max_start_plus_max_results: 30800        <-- above the ceiling
```

Practical impact is small (that request 400s → `iter_results` catches it → the category is marked
failed → and under this item it now degrades instead of aborting), but the claim in
`build_index.py:55-56` — "sends `start` as a multiple of it, so a 30,000 bound can never ask for
a start+max_results above 30,000" — is **too strong as written**. It should say "as long as arXiv
returns full pages."

### 1.4 The comment cites the manual. **MET.**

`build_index.py:45-60` (spec cited `:43-44`; the constant is now at `:61`):

```
# arXiv's API user manual (§3.1.1.2, "the maximum number of results returned
# from a single call (max_results) is limited to 30000 in slices of at most
# 2000 at a time", and "a request with max_results >30,000 will result in an
# HTTP 400 error code") caps one query at 30,000 results, so that is the most a
# category query can ever return and the highest number of requests that can
# earn an answer.
```

Verbatim quotes with a section number, and it distinguishes the slice limit from the window
limit. The old comment ("The retention window is the real bound; this only prevents an unbounded
run") implied the constant was free; that is gone. **Criterion 1 met.**

### 1.5 The clamp on an explicit cap

`build_index.py:252`:
```python
limit = min(max_per_category, UNLIMITED) if max_per_category > 0 else UNLIMITED
```
Correct, and it closes `--max-per-category 100000`. But see §5 — it does **not** cover
`paper-collector.py`, which is IMP-095's AC2 (§6 below).

---

## 2. CRITERION 2 — per-category degradation. **NOT MET. This is the decisive failure.**

### 2.1 The good half: the field really does land in `index.json`

My harness, four categories healthy and `cs.RO` 500ing from `start=0` (so `cs.RO` contributes
**zero** papers), `build_index.main()` with the real `build_client`, real page size, real retry
count, real 60 s timeout, only `delay_seconds=0` and `query_url_format` repointed:

```
ERROR Wrote an index missing 1 of 5 categories; index.json records them under 'failedCategories': cs.RO
INFO Wrote 20000 papers across 1 shards to /tmp/v204/out-postfix-degrade0
REPRO postfix-degrade0: {"exit_code": 0, "requests": 106,
  "max_start_plus_max_results": 5800, "out_dir_exists": true, "index_json": true}
MANIFEST keys=['categories', 'failedCategories', 'generatedAt', 'retentionDays', 'shards', 'totalPapers']
  totalPapers=20000
  categories=['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']     <-- cs.RO is STILL LISTED
  failedCategories=['cs.RO']
```

So: the field is in the written file, not just the log; **exit code 0**; the out-dir is created.

### 2.2 THE CRITICAL FINDING: the consumer ignores it, and the UI affirmatively lies

```
$ grep -rn "failedCategories" web/
(no matches)
```

- `web/src/lib/types.ts:34-40` — `IndexManifest` has five fields: `generatedAt`,
  `retentionDays`, `categories`, `shards`, `totalPapers`. **No `failedCategories`.**
- `web/src/lib/paperIndex.ts:202` — `return body as IndexManifest;`, a bare cast. The extra key
  is silently dropped on the floor.
- Nothing in `web/src` reads `manifest.failedCategories`. There is no banner, no `role="alert"`,
  nothing.

**And it is worse than silence, because `categories` still lists the failed category.**

`build_index.py:457-461` calls `build_shards(..., categories=categories)` with the **full
requested list**, and `build_index.py:210` writes `"categories": list(categories or
DEFAULT_CATEGORIES)`. The failed category is therefore advertised as present. Then:

- `web/src/App.tsx:616-620` renders the hero:
  `{manifest.totalPapers.toLocaleString()} papers from {manifest.categories.join(", ")} · index generated {…}`
- `web/src/App.tsx:626` passes `manifest.categories` to `<FeedControls>`, which renders one chip
  per category (`web/src/components/FeedControls.tsx:73`).

**Exactly what a visitor sees:**

> **20,000 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO** · index generated Oct 2, 2026 …

Five category chips, all appearing healthy, all selected by default (`App.tsx:314`,
`activeCategories` defaults to `manifest?.categories`). A reader clicks **cs.RO** — the site has
just told them it has cs.RO papers — and gets, from `App.tsx:799-803`:

> **No papers match the current filters.**

That sentence is false, and it blames the reader's filter instead of the pipeline. There is no
other signal anywhere: `App.tsx:264`'s `setFailedShards(list.failedFiles)` is the **shard**
failure path (`paperIndex.ts:279-294`), which does not fire here — the shards loaded perfectly;
a whole category is simply absent. The `loadFailed` banner at `App.tsx:637+` likewise does not
fire. The shortfall is invisible and the site states the opposite of the truth, permanently, with
a **green** Actions run.

### 2.3 A test ENSHRINES the lie

`tests/test_build_index.py:605-610`:

```python
# The categories that did answer are still in the index, and
# the requested list is untouched so the site's category filter
# keeps offering every category.
self.assertEqual(manifest["categories"], build_index.DEFAULT_CATEGORIES)
```

The new contract is pinned as "keep advertising cs.RO so the site offers a filter that returns
nothing". This is the exact mechanism of the harm, locked in as intended behaviour.

### 2.4 Is this an improvement over IMP-004's hard-fail? For the reader, **no — it is worse.**

| | IMP-004 (HEAD) | IMP-204 (this change) |
|---|---|---|
| Deploy step | exit 1 | exit 0, **green** |
| `deploy` job | `needs: build` never runs → Pages keeps previous deployment | runs, publishes |
| Live site | previous week's **complete** index, ~7 days stale | **permanently short** index |
| Hero text | accurate | claims `cs.RO`, which it has 0 of |
| Category filter | accurate | offers a filter that returns nothing |
| Reader's explanation for a missing category | none (it isn't missing) | **"No papers match the current filters"** — false |

IMP-004's stated rationale, preserved verbatim in the module docstring before this change, was
that *"a truncated index is indistinguishable from a complete one once deployed."* That remains
**exactly true** of the deployed artifact. The implementer's report §3 argues the guarantee moved
onto the artifact because `failedCategories` "travels with the deployment" — true, and irrelevant:
**`index.json` is read by the app, not by a human.** The spec's phrase is "a reader of `index.json`
can tell"; this item satisfies the letter and defeats the purpose, because the site's actual
readers are people.

Note this is not a quibble about scope. The repo already contains the exact pattern needed:
`App.tsx:637+` renders a `role="alert"` banner for partial failures, `web/src/lib/__tests__/
failureCopy.test.ts` exists, `PapersLoadResult.failedFiles` (`paperIndex.ts:71-74`) is the
precedent for carrying a partial-failure list to the UI. This item stopped one step short of its
own criterion.

### 2.5 What would make criterion 2 sound

Either route satisfies the spec; (A) is ~15 lines and is what criterion 2 is actually asking for:

**(A) Surface it.** Three small edits, all additive:
1. `web/src/lib/types.ts:34` — add `failedCategories?: string[];` to `IndexManifest`.
2. `web/src/App.tsx:610` — render a `role="alert"` banner beside the hero when
   `manifest.failedCategories?.length`, naming the categories, mirroring the existing shard-failure
   banner. Add the copy to `web/src/lib/__tests__/failureCopy.test.ts`.
3. **`build_index.py:210`** — decide what `manifest["categories"]` should mean. Either keep all
   five (then the banner is mandatory, because the filter must not offer a dead chip) or set it to
   the categories that actually contributed. Either way `test_build_index.py:608` must stop
   asserting the current behaviour as correct, and a test must pin the banner.

**(B)** Revert to IMP-004's hard-fail for the partial case. Honest, but it re-creates the empty
deploy IMP-204 exists to remove, and the spec explicitly wanted the papers.

**Minimum to un-block:** (A) steps 1–3. Until then this item's central design claim — that the
shortfall is made visible — is unsupported.

### 2.6 Exit code: partial = 0, and Pages IS updated

Confirmed: **exit 0** on a partial failure (§2.1). And the deploy topology I resolved from the
YAML:

```
JOB build   | timeout: 90 | continue-on-error: None
   3. Build the paper index        if=None coe=None
   8. actions/upload-pages-artifac if=None coe=None
JOB deploy  | timeout: 15 | continue-on-error: None
   0. Deploy to GitHub Pages       if=None coe=None
```

`build_index` and the Pages upload are **the same job**; `deploy` is a separate job that `needs:
build`. So the implementer's §3 argument is mechanically correct: a non-zero exit at step 3 would
skip the artifact upload *and* the `deploy` job, and Pages would keep the previous deployment.
**Exit 0 is the only way to publish the four categories' papers.** There would be no "red X but
Pages updated" split here — the two outcomes are cleanly separated. The implementer chose
correctly on this axis; the problem is that the thing exit 0 publishes lies to the reader (§2.2).

### 2.7 The TOTAL failure path is genuinely intact. Reproduced.

All five categories 500 from `start=0`:

```
ERROR Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO.
REPRO postfix-total: {"exit_code": 1, "requests": 30, "out_dir_exists": false, "index_json": false}
$ ls -la /tmp/v204/out-postfix-total
ls: /tmp/v204/out-postfix-total: No such file or directory
```

**Exit 1, no out-dir at all, no partial file.** IMP-004's core guarantee is intact. Also intact
and reproduced: partial failure where the surviving category produced nothing in-window → exit 1,
nothing written (`build_index.py:447-455`).

---

## 3. IMP-004's TESTS. **The rewrite is sound. The vacuity premise in the brief is not borne out.**

### 3.1 The rewrite asserts strictly more than a bare `assertTrue`

`tests/test_build_index.py:558-615`, `MainTests.test_a_failed_category_no_longer_discards_the_others`
asserts **seven** things: exit code `== 0`; `index.json` exists on disk;
`manifest["failedCategories"] == [failed]`; the failed category is named in the ERROR log;
`manifest["categories"] == DEFAULT_CATEGORIES`; `totalPapers > 0`; and the four surviving paper
ids are read back **out of the written shard files**. Nothing about it is a stub or a
tautology. **Not weakened.**

### 3.2 It is NOT vacuous — I reproduced the failure against pre-fix source

The brief states the implementer "claims the replacement passes against pre-fix source too".
**They do not.** `.improve/reports/impl-IMP-204.md` §4 lists that test among the six that FAIL
pre-fix, and my own scratch copy agrees (§5 below):

```
FAIL: test_a_failed_category_no_longer_discards_the_others
AssertionError: 1 != 0
```

What the implementer actually claimed (§3) is that the **new control**
`test_refuses_to_write_index_when_every_category_query_fails` passes pre-fix — which is the right
claim for a control, and which I confirmed. `test_a_failed_category_no_longer_discards_the_others`
is **non-vacuous**. The brief misread the report.

### 3.3 The control is stronger than the test it replaces

```
HEAD:        self.assertNotEqual(exit_code, 0)     # weak
POST-FIX:    self.assertEqual(exit_code, 1)         # stronger
             self.assertIn("cs.CV", log); self.assertIn("cs.LG", log)   # both, was one
             self.assertEqual(os.listdir(out_dir), [])
```

IMP-004's guarantee was not merely re-asserted; it was tightened. That satisfies criterion 2's
"must either still pass unmodified **or** be deliberately rewritten" — and criterion 2's own
sanction covers the *contract* change, while the guarantee itself is preserved and improved.

### 3.4 The other pinned test is unmodified

`MainTests.test_refuses_to_write_an_empty_index` — `git show HEAD:tests/test_build_index.py`
lines 459-472 vs current 543-556 are **byte-identical**. Passes. ✓

---

## 4. CRITERION 3 — the deploy default. **MET, with a gap in "what it costs".**

### 4.1 Retention really is 60 days

`--retention-days` default is `DEFAULT_RETENTION_DAYS` (`build_index.py:392-395`); `--help`
prints `(default: 60; 1 or greater)`. IMP-020 changed the retention *check*, not the default.
**60 days confirmed.**

### 4.2 The deploy no longer leans on `0 = no cap`

```yaml
timeout-minutes: 75
run: python scripts/build_index.py --max-per-category 12000
```
Resolved from the YAML with `yaml.safe_load`. Confirmed 12 pages per category, worst request
`start=11000&max_results=1000` = 12,000:
```
REPRO deploycap: {"exit_code": 0, "requests": 60,
  "distinct_starts": [0,1000,...,9000,10000,11000],
  "max_start_plus_max_results": 12000}
```
✓

### 4.3 The YAML comment states origin and cost. Mostly. ✓

`deploy.yml:43-55` names the source ("cs.AI 10,785 papers, from opensearch totalResults, measured
2026-10-02"), lists all five measured counts, states the headroom, and states the cost ("the same
38 pages … now 12 pages per category instead of 30"). **Criterion 3 met.**

### 4.4 The 11% margin is NOT durable — this is a new tripwire with no alarm

- cs.AI measured 10,785 → cap 12,000 = **+11.25%**.
- IMP-205's own spec measures growth at **~9% per 60-day window** and shows
  `70 × P + 1800 ≤ 4500` already broke at **P = 39** — i.e. ~9% growth in a *single* window.

So the cap is roughly **one window of growth** from binding. And when it binds it is **silent**:
`deploy.yml:53-55` says so in the item's own words ("If the cap ever binds, the index is short and
nothing says so"). Crucially, **criterion 2's `failedCategories` does not catch this** — a
cap-bound truncation is not a query failure, so no category is marked failed and `index.json`
carries no signal at all. The implementer flags this as "uncertain #3" and declines to fix it
("not in any acceptance criterion"). That is defensible scoping, but it leaves the item's own
deploy default resting on an alarm that does not exist.

**A defensible margin** would be 2–3× the largest measured window — 22,000–30,000, i.e. simply
`UNLIMITED`/the arXiv ceiling. It costs nothing today, because the *retention window* is what
stops a healthy run (38 pages either way) and the ceiling is 30 pages/category. Setting the deploy
cap to `30000` makes it unfalsifiable instead of 11% from binding. (Trade-off: a 30,000 cap makes
the worst case 5 × 30 = 150 pages, which is well past the step cap — see §4.5 — so this needs to
land with IMP-205's cap raise, not before it.)

### 4.5 IMP-198's timeout arithmetic, recomputed. The cap is now UNDERSIZED.

IMP-198's model (`verify-IMP-198-r2.md:158`): `70 × P + 1800`, where 70 s = 60 s timeout + 10 s
inter-page delay, P = total pages across the 5 categories, cap = 4500 s.

| case | P | arithmetic | seconds | vs 4500 s cap |
|---|---|---|---|---|
| healthy (unchanged — retention break still binds first) | 38 | `70×38 + 1800` | **4460 s** | 1.009× — **40 s spare** (unchanged) |
| total partition | — | `5×6×60` | 1800 s | 2.50× (unchanged) |
| **cap binds on all 5 categories** | **5 × 12 = 60** | `70×60 + 1800` | **6000 s** | **0.75× — 1500 s OVER** |

The healthy path really is unchanged — the retention window, not the cap, stops a healthy deploy,
so 38 pages either way. That part of the report is correct. But the **worst case is now 60 pages,
not 38**, and under IMP-198's own compound model that is **6000 s against a 4500 s cap**. When the
cap binds, GitHub kills the step with a generic timeout — precisely the outcome
`deploy.yml:38-41` says the cap exists to prevent.

The implementer states this number in report §6 and **correctly declines to touch
`timeout-minutes`**, because IMP-205 owns the step cap and its Notes say to land IMP-204 first.
That is the right call. **But two things should have been done and were not:**

1. `deploy.yml:67-68` was left asserting *"75 min = 4500 s is 2.5x that 1800 s worst case… so
   ~15x headroom."* That was already wrong before this item (1.009×, which is exactly IMP-205's
   finding), and this item makes it materially worse (0.75×) **without touching it**, inside a
   comment block this item rewrote three lines above. Non-blocking — IMP-205 owns the value — but
   the PR body should have said so.
2. Criterion 3 asks the comment to state **"what it costs"**. The comment states the cost only on
   the healthy path (38 pages) and omits the cap-binding cost (60 pages → 6000 s → killed).
   That omission is what makes the 12000 choice look free.

`DeployStepTimeoutTests` still asserts `1800 s < 75 min` and passes **unmodified**. It is
structurally unable to catch this: it tests the total-partition case, not the page-count case.

---

## 5. CRITERION 5 — docs and regressions. **MET** (with one claim that is false of the deployed site).

### 5.1 `readme.md` describes the new default, not the workaround ✓

`readme.md:74-79`:
> `--max-per-category 0` is a bound, not the absence of one. arXiv's API user manual limits a
> single query to 30,000 results, returned in slices of at most 2,000 at a time, and answers a
> request above that with HTTP 400 — so 0 means "up to that ceiling" (30,000), and a larger
> explicit value is clamped to it.

The old `cs.AI` / `start=9000` workaround paragraph is gone, replaced by the mechanism and the
code-side cause. This is exactly what IMP-211's Notes ask for ("close it as absorbed"). ✓
`readme.md:81-84` documents the deploy cap and says 12000 covers the 60-day window. ✓

### 5.2 readme ↔ `--help` stay reconciled ✓ (IMP-022 / IMP-031's rule)

| | readme `:66` | `--help` |
|---|---|---|
| default | `0` | `default: 0` |
| range | `0 or greater` | `0 or greater` |
| meaning of 0 | "as many results as arXiv will serve for one query" | "no cap beyond arXiv's own 30000-result-per-query limit" |

Same default, same range token, same meaning. ✓

### 5.3 But `readme.md:81-84` repeats the false claim

> …and `index.json` names what is missing under `failedCategories` — **a short index says so
> instead of looking complete.**

True of the file. False of the site, which looks complete and says the wrong thing (§2.2). Once
criterion 2 is fixed this sentence becomes true; today it is the second place the item asserts a
guarantee the consumer does not deliver.

### 5.4 Suite results — exactly as claimed

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 98 tests in 1.101s
OK

$ cd web && npm run typecheck      # tsc --noEmit -> clean, no output
$ cd web && npm test
Test Files  16 passed (16)
     Tests  253 passed (253)
  Duration  4.52s
```
✓ 98 and 253 as claimed.

---

## 6. NON-VACUITY, INDEPENDENTLY CONFIRMED. **6 of 98 fail pre-fix — none vacuous.**

My own scratch copy (`/tmp/v204/pre`: repo `tests/` + `git show HEAD:scripts/build_index.py` +
`git show HEAD:.github/workflows/deploy.yml` + `git show HEAD:readme.md`, `__pycache__` cleared):

```
Ran 98 tests in 1.100s
FAILED (failures=6)

FAIL: DeployStepCommandTests.test_the_comment_documents_the_number_the_command_uses
FAIL: DeployStepCommandTests.test_the_index_step_caps_what_it_fetches_within_the_ceiling
FAIL: MainTests.test_a_failed_category_no_longer_discards_the_others            AssertionError: 1 != 0
FAIL: QueryCeilingTests.test_a_cap_above_the_ceiling_is_clamped_instead_of_paging_past_it   [100000] != [30000]
FAIL: QueryCeilingTests.test_no_single_request_exceeds_the_slice_or_the_window            100 != 30
FAIL: QueryCeilingTests.test_the_uncapped_default_is_the_documented_ceiling              [100000] != [30000]
```

**Actual count: 6.** Matches the implementer exactly. Every one of the nine added tests is either
non-vacuous (6) or an intentional control (3 + the pre-existing timeout tests). **No added test is
vacuous.**

The green-in-both controls, and why that is correct rather than a weakness:
- `test_refuses_to_write_index_when_every_category_query_fails` — proves IMP-004's guarantee is
  **unregressed**, which is the whole point of criterion 2's "must survive".
- `test_refuses_to_write_an_empty_index` — unmodified, byte-identical.
- `test_a_failed_category_is_still_fatal_when_nothing_else_has_papers` — pins the "never empty"
  boundary.
- `test_a_complete_index_records_no_failed_categories`, `test_a_cap_below_the_ceiling_is_passed_through` —
  pin that a healthy index's key set is byte-identical to what it always was.

### 6.1 Inventory: 10 added, 1 removed (the sanctioned rewrite)

```
REMOVED: test_refuses_to_write_index_when_a_category_query_fails
ADDED (10): test_a_cap_above_the_ceiling_is_clamped_instead_of_paging_past_it
            test_a_cap_below_the_ceiling_is_passed_through
            test_a_complete_index_records_no_failed_categories
            test_a_failed_category_is_still_fatal_when_nothing_else_has_papers
            test_a_failed_category_no_longer_discards_the_others
            test_no_single_request_exceeds_the_slice_or_the_window
            test_refuses_to_write_index_when_every_category_query_fails
            test_the_comment_documents_the_number_the_command_uses
            test_the_index_step_caps_what_it_fetches_within_the_ceiling
            test_the_uncapped_default_is_the_documented_ceiling
```
89 + 10 − 1 = **98**. ✓ All 88 surviving pre-existing test names are accounted for.

**No test was deleted (beyond the sanctioned rewrite), skipped, or `expectedFailure`-marked.**
The only `skipTest` calls in the tree are pre-existing in `tests/test_paper_collector.py`
(`:413`, `:419`, `:431`, `:459`) and are untouched by this diff.

`DEPLOY_INDEX_RUN` was broadened from `^\s*run:\s*python scripts/build_index\.py\s*$` to
`(?:\s|$)`. Necessary and correct — the bare-command matcher would stop finding the step the moment
criterion 3 adds a flag. The lost tripwire (bare command) is replaced by a stronger one:
`DeployStepCommandTests._cap_on_the_command_line` fails if the flag is removed.

### 6.2 Criterion 4's conditional tests correctly untouched

`ParseArgsValidationTests.test_max_per_category_zero_still_means_no_cap` and
`test_defaults_are_unchanged` appear nowhere in the diff — correct, because criterion 3 put the cap
on the **workflow command line**, not in `parse_args`, so no default changed. The report states
this. ✓

---

## 7. CONFLICT WITH IMP-095. **No numeric conflict. But IMP-095 is only half discharged and its Notes are now stale.**

### 7.1 Criterion 1's "must not each set a different number" — SATISFIED

IMP-204 set `UNLIMITED = 30000`. IMP-095 AC1 requires "`UNLIMITED` is at or below 30,000".
**Same number.** No conflict. A future IMP-095 implementer must not re-set it.

### 7.2 IMP-095 AC2 is UNMET, and its exposure is still live

IMP-095 AC2: *"A test in `tests/test_arxiv_common.py` asserts the value passed to `arxiv.Search`
never exceeds 30,000, **including for `max_results=None`**."*

- `scripts/arxiv_common.py:96-141` has **no clamp**. Line `:120` passes it straight through:
  `arxiv.Search(query=query, max_results=max_results, …)`.
- `grep -rn "30000\|30_000" tests/` → hits only in `test_build_index.py`. **`test_arxiv_common.py`
  contains no such assertion.**
- The exposure is real: `scripts/paper-collector.py:224` calls
  `arxiv_common.iter_results(topic, max_papers)` with `--max-papers` **unbounded above**, and
  `paper-collector.py` never calls `collect_papers`. So
  `python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 100000` still hands
  `arxiv.Search` a value above the documented ceiling. IMP-204's clamp
  (`build_index.py:252`) is downstream of `collect_papers` and does not cover this path.

IMP-095 AC1's alternative route — "`iter_results` clamps `max_results` to that ceiling **and logs
when it clamps**" — is also entirely absent (`grep -n "min(" scripts/arxiv_common.py` returns one
hit, `:83`, which is the `page_size` sizing and unrelated).

### 7.3 What must be reconciled

1. **Do not re-set the constant.** `UNLIMITED = 30000` is settled by IMP-204.
2. **Do not close IMP-095 as absorbed.** Its AC2 (and the `iter_results` clamp + clamp-log) are
   unaddressed. Either implement them in `arxiv_common.iter_results` — which is the genuinely
   correct layer, since it covers `paper-collector.py` and `max_results=None` — or formally retire
   AC2 with a stated reason.
3. **Update IMP-095's Notes.** They still read *"Superseded in scope by IMP-204 (TODO, 12.5) —
   read that item first"*, and its status is still `TODO`. IMP-204 is now IN-PROGRESS and has
   moved the constant. `.improve/FEATURES.md` was edited for **exactly one line** in this
   diff — IMP-204's own `Status: TODO → IN-PROGRESS` — so IMP-095's text was left describing a
   superseded state. IMP-204's Notes demand "a PR-body line saying the constant moved here";
   report §7 has it, but it needs to land in `FEATURES.md` when the status flips to DONE.

---

## 8. Deterministic reproduction method (as mandated by the spec)

Harness: `/tmp/v204/harness/` — mine, written from scratch, **edits nothing in `scripts/`**.
`StubClient(arxiv.Client)` overrides **only** the `query_url_format` instance attribute (a
format string, per `Client._format_url`'s `self.query_url_format.format(urlencode(args))` —
`:614`) and passes `delay_seconds=0.0`. `page_size`, `num_retries=5` and the 60 s
`install_request_timeout` session hook are the shipped values, verified live in the request URLs:
`…&start=29000&max_results=1000`. `build_index.main()` is invoked normally; `State` records every
`(category, start, max_results)`.

Cases run: **degrade** (cs.RO 500s from start=2000), **degrade0** (from start=0 → zero papers),
**total** (all 5 fail), **ceiling** (500 at start≥30000), **deploycap** (`--max-per-category
12000`). Results quoted in §1.2, §2.1, §2.7, §4.2.

**Bare command** (`--max-per-category 0`, i.e. HEAD's deploy command) at the 30,000 wall:
> `INFO Querying cat:cs.CV (limit 100000) ...`
> `ERROR Refusing to write an index: the arXiv query failed for cs.CV.`
> `{"exit_code": 1, "requests": 36, "max_start_plus_max_results": 31000, "out_dir_exists": false, "index_json": false}`

**Bounded command** (`--max-per-category 12000`):
> `INFO Querying cat:cs.CV (limit 12000) ...`
> `INFO Wrote 60000 papers across 1 shards to …`
> `{"exit_code": 0, "requests": 60, "max_start_plus_max_results": 12000, "out_dir_exists": true, "index_json": true}`

No-regression smoke (`--category cs.CV --max-per-category 300`) was run by the implementer as the
single live call; I did not repeat it, per the brief's instruction not to hammer the API.

---

## 9. Criteria scorecard

| # | Criterion | Verdict |
|---|---|---|
| 1 | Bound in force, respects arXiv's ceiling, comment cites the manual | **MET** (§1) — with a minor overstatement in the comment (§1.3) |
| 2 | Per-category degradation, shortfall **visible** | **NOT MET** (§2) — field is written, consumer ignores it, UI misreports `categories` |
| 3 | Documented, deliberate deploy default | **MET** (§4) — "what it costs" omits the cap-binding case |
| 4 | Tests cover the three required cases; the two conditional tests untouched | **MET** (§6) |
| 5 | Docs follow the code; suites green; nothing deleted/skipped | **MET** (§5) |

**4 / 5.**

---

## 10. Issues, most important first

1. **[BLOCKING — criterion 2] The consumer ignores `failedCategories` and the site misreports
   `categories`.** `web/src/lib/types.ts:34` + `paperIndex.ts:202` drop the key;
   `build_index.py:210` keeps the failed category in `manifest["categories"]`, which `App.tsx:616`
   renders and `App.tsx:626` turns into a filter chip. A visitor is told the index has `cs.RO`,
   clicks it, and is told *"No papers match the current filters."* Green Actions run, nothing on
   screen. **Fix:** declare `failedCategories?: string[]` in `types.ts`, render an `role="alert"`
   banner from `App.tsx` (the pattern already exists at `:637+` for shard failures), and change
   what `manifest["categories"]` means — then repin `tests/test_build_index.py:608`, which
   currently asserts the lie.

2. **[NON-BLOCKING] The 11% deploy margin is one window of growth from binding, silently.**
   cs.AI 10,785 → 12,000 is +11.25% against a measured ~9%/window growth rate (IMP-205). When the
   cap binds, `failedCategories` does **not** fire (a cap-bound truncation is not a query
   failure), so there is no signal anywhere. Defensible margin: 22,000–30,000 (2–3×, i.e. the
   arXiv ceiling), which costs nothing on the healthy path — but land it with IMP-205's cap raise.

3. **[NON-BLOCKING, IMP-205-owned] `--max-per-category 12000` raises the modelled worst case past
   the step cap.** `70 × 60 + 1800 = 6000 s` vs the unchanged 4500 s cap (healthy path stays 4460 s).
   Correctly deferred to IMP-205, but `deploy.yml:67-68` still claims "2.5x … ~15x headroom", and
   criterion 3's "what it costs" should have stated the 60-page case. `DeployStepTimeoutTests`
   cannot catch this — it only tests the partition case.

4. **[NON-BLOCKING] `iter_results` still has no clamp** (`arxiv_common.py:120`), so
   `paper-collector.py --max-papers 100000` still exceeds the ceiling and `max_results=None`
   remains unbounded. This is IMP-095 AC2, **not** IMP-204's — but IMP-095 must not be closed as
   absorbed, and its Notes need updating (§7.3).

5. **[NIT] `build_index.py:55-56` overstates the guarantee.** "sends `start` as a multiple of it,
   so a 30,000 bound can never ask for a start+max_results above 30,000" holds only while arXiv
   returns full pages; `arxiv`'s `_results` advances `offset += len(feed.entries)` (`:595-600`),
   and a short page pushes it to 30,800 in my harness. Qualify it.

6. **[NIT] Report §4 misquotes the pre-fix request.** It was `start=30000&max_results=1000`
   (= 31,000), not the spec's `start=10000&max_results=1000`. Same conclusion, and the conclusion
   is right; the number was inherited from the spec's Intent rather than re-derived.

7. **[NIT] `readme.md:81-84` states the guarantee the consumer does not deliver** ("a short index
   says so instead of looking complete"). True of the file, false of the site, until issue 1 lands.