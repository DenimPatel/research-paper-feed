# Verify IMP-216 — independent, skeptical review

**Verdict: PASS.** Six of six acceptance criteria met, the defect is fixed and its worse
consequence (a published falsehood) is unreachable, non-vacuity reproduces, and the gate is green,
hermetic and fast. Seven findings below, none of them blocking; two are wording defects worth
fixing in the same PR, and one corrects the implementer's own cost accounting **in the change's
favour**.

Everything destructive was done in `/tmp/imp216v/`. No `git restore`/`checkout`/`clean`/`stash`
was run; the only git write-adjacent command used was read-only (`git show HEAD:<path>` into a
`/tmp` file). The working tree is byte-identical to how I found it — `git status --porcelain`
still lists exactly the five `M` files and the three untracked `.improve/reports/*.md`.

---

## 1. Scope, hygiene, forbidden-action checklist

```
$ git status --porcelain
 M .github/workflows/deploy.yml
 M .improve/FEATURES.md
 M readme.md
 M scripts/build_index.py
 M tests/test_build_index.py
?? .improve/reports/absorb-2026-10-03-r2.md
?? .improve/reports/absorb-2026-10-03.md
?? .improve/reports/discovered-IMP-216.md
?? .improve/reports/impl-IMP-216.md
```

| Forbidden / checked | Result |
| --- | --- |
| any `timeout-minutes:` added, removed or moved | **none** — `git diff -U0 -- .github/workflows/deploy.yml \| grep -n "timeout-minutes"` → no match, exit 1 |
| new dependency / lockfile entry | **none** — `git status --porcelain -- requirements.txt web/package.json web/package-lock.json` → empty |
| any file under `web/` created, modified or deleted | **none** — `git status --porcelain --untracked-files=all -- web/` → empty |
| debug leftovers (`print(`, `console.log`, `TODO`, `FIXME`, `breakpoint`, `pdb`) in added lines | **none**; the only hits are `Status: TODO` lines of *other* backlog items inside the absorber's FEATURES.md block |
| secrets | `git diff \| grep -iE "sk-[A-Za-z0-9]{10,}\|ghp_\|AKIA[0-9A-Z]{16}\|-----BEGIN"` → empty |
| test hitting the network | **none** — see §5 |
| unrelated files touched | **none** beyond the declared five |

`git diff -U0 -- .github/workflows/` shows exactly one removed non-comment line:

```
-        run: python scripts/build_index.py --max-per-category 30000
+        run: python scripts/build_index.py --max-per-category 10000
```

Every other removed line is a `#` comment. `concurrency.cancel-in-progress: false` untouched, no
`continue-on-error`, no `|| true`.

Style: no Python linter is configured (profile **PE-6**, **INF-05**), and the change adds 13 lines
over 79 chars against 25/26 pre-existing over-long lines in the same two files — consistent with
the surrounding code, not a new violation.

Insertion counts match the report exactly: `60 + 30 + 154 + 425 = 669` across the four code files.

---

## 2. Criteria, one at a time

### Criterion 1 — the depth bound is structural → **MET**

`DEPLOY_OFFSET_BUDGET = 10000` at `scripts/build_index.py:101`, `deploy.yml:141` runs
`--max-per-category 10000`. The test reads the real cap off `deploy.yml` and the real
`page_size` off a constructed client, then asserts `max(requested_pages(cap, page_size)) < budget`.

Criterion 1 names a specific falsifier — a cap of `10001`. I ran it in a throwaway tree:

```
### cap set to 10001 in deploy.yml
FAIL: test_the_deepest_offset_the_deploy_can_request_is_bounded
AssertionError: 10000 not less than 10000 : deploy.yml:141 caps at 10001, whose
deepest request is start=10000 -- at or above DEPLOY_OFFSET_BUDGET (10000), the
offset arXiv has been observed to answer with HTTP 500
Ran 118 tests in 1.096s
FAILED (failures=2)
```

The citation half is a real pin too — deleting only the constant's *name* from the step comment:

```
### "DEPLOY_OFFSET_BUDGET" -> "a depth budget" in the comment only
FAIL: test_the_deepest_offset_the_deploy_can_request_is_bounded
AssertionError: 'DEPLOY_OFFSET_BUDGET' not found in '...': deploy.yml:141 does not
cite DEPLOY_OFFSET_BUDGET, so the comment cannot explain the cap
Ran 118 tests in 1.089s
FAILED (failures=1)
```

The structural argument also survives contact with the code: `page_size` is
`max(1, min(DEFAULT_PAGE_SIZE, max_results))` (`arxiv_common.py:97-101`), so a *small* cap shrinks
the page and the deepest request drops — the relationship holds at every cap, not just 10,000.

### Criterion 2 — a mid-paging death is truncated, not failed → **MET**

`scripts/build_index.py:349-363` splits on the **in-window** count. All three sub-claims hold, and
I verified the "stale results are not a rescue" clause is the load-bearing one by construction:
`count` is incremented only after the retention check, so an out-of-window-only query stays fatal
(`test_a_dead_query_is_not_rescued_by_out_of_window_papers`, and probe **X1/X5** below). The
degraded branch logs at `ERROR`, so IMP-204's signal is not weakened.

### Criterion 3 — the records get the last word → **MET** (adversarially, see §4)

`categories_in_records` (`:387`) unions `categories` **and** `primaryCategory`;
`reconcile_failed_categories` (`:404`) rebuilds both lists in requested order and logs each move at
WARNING. `main` calls it at `:616`, after `dedupe_records` and before `contributing`.

**Why the invariant is structural, not a fixture artefact** — the two readers see the *same* list:

* `reconcile_failed_categories(categories, failures, truncated, records)` is passed the post-dedupe
  `records`;
* `build_shards(records, …)` is passed the same post-dedupe `records`;
* `build_shards` is the only thing that can drop a record (`if not published: continue`,
  `build_index.py:212`) — and `collect_papers` only ever appends records that *have* a usable
  `published` (`build_index.py:355-361`), so on this path that drop can never fire;
* `dedupe_records` drops id-less records and unions `categories` across duplicates — it can only
  make `held` *narrower or equal* to what is written, which is the safe direction.

So `held ⊆ {categories carried by written shard papers}`, and the invariant
`∀ c ∈ failedCategories, c ∉ held` ⇒ `c` is carried by no written shard paper holds by construction,
not by luck.

### Criterion 4 — nothing on screen contradicts the shards → **MET**, with a copy caveat (F5)

`web/src/lib/failureCopy.ts` is unchanged and already renders the two sentences correctly
(`:103-110` missing, `:111-117` short). The chip predicate in `App.tsx:374-381` matches
`primaryCategory !== null && active.has(primaryCategory)` **or** `paper.categories.some(...)` —
i.e. exactly the union `categories_in_records` computes. Manifest and UI therefore cannot
disagree about which categories have papers behind them. Verified end-to-end in §4.

The pre-existing web test `App.incompleteIndex.test.tsx:167` already covers the truncated half
with both required assertions; adding a second case would be the duplicate the report says it is.
`web/` genuinely untouched.

### Criterion 5 — the cap test measures the real windows and points at the live harm → **MET**

Before → after, quoted:

```python
# BEFORE (HEAD)
        self.assertGreaterEqual(
            cap,
            2 * largest_measured_window,          # 2 * 10,785 = 21,570
            "deploy.yml:%d caps at %d, under 2x the largest measured 60-day "
            "window (%d); a cap that close to a real window size truncates on "
            "ordinary arXiv growth" ...
# AFTER (tests/test_build_index.py:1436)
        self.assertLess(
            cap,
            largest_measured_window,              # 10,785
            ...
        )
```

The measurement (10,785, cs.AI, 60-day window, 2026-10-02) is **unchanged**; only its direction
flipped. The docstring (`:1404-1435`) records what it used to require, why that is unsatisfiable
alongside criterion 1, and the papers-lost cost per category. Nothing was deleted or
`expectedFailure`-marked. See §3 for the non-vacuity question, which has a nuance worth stating.

### Criterion 6 — demonstrated, not argued → **MET, independently reproduced**

I wrote my own loopback stub (`/tmp/imp216v/h/stub.py`) rather than reuse the implementer's: a
`ThreadingHTTPServer` on `127.0.0.1` that answers a full Atom page with
`opensearch:totalResults` set to the measured 60-day windows, and **HTTP 500 at `start >= 10000`**,
reached through the public class attribute `arxiv.Client.query_url_format`
(`'https://export.arxiv.org/api/query?{}'` → the loopback). The runner reads the `run:` line out of
**each tree's own** `deploy.yml` and `runpy`-executes that tree's `scripts/build_index.py` with it;
nothing about the command is hard-coded.

```
=== IMP-216 criterion 6, verifier's own loopback reproduction ===

### CASE C  pre-fix tree, ITS OWN deploy.yml command, 500 at start>=10000
    deploy.yml run:     : python scripts/build_index.py --max-per-category 30000
    exit code           : 0
    categories          : ['cs.CV', 'cs.LG', 'cs.CL', 'cs.RO']
    failedCategories    : ['cs.AI']
    truncatedCategories : None
    totalPapers         : 34953  |  papers on disk: 34953
    cs.AI papers in shards: 10000
    offsets requested   : [0, 1000, ..., 9000, 10000]
    deepest per category: {'cs.CV': 6000, 'cs.LG': 9000, 'cs.CL': 5000, 'cs.AI': 10000, 'cs.RO': 3000}
    total HTTP GETs     : 43

### CASE A  fixed tree, its OWN deploy.yml command, 500 at start>=10000
    deploy.yml run:     : python scripts/build_index.py --max-per-category 10000
    exit code           : 0
    categories          : ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
    failedCategories    : None
    truncatedCategories : ['cs.AI']
    totalPapers         : 34953  |  papers on disk: 34953
    cs.AI papers in shards: 10000
    offsets requested   : [0, 1000, ..., 9000]
    deepest per category: {'cs.CV': 6000, 'cs.LG': 9000, 'cs.CL': 5000, 'cs.AI': 9000, 'cs.RO': 3000}
    total HTTP GETs     : 37

### CASE B  fixed tree, shipped command, 500 at start>=5000 (inside the cap)
    categories          : ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
    failedCategories    : None
    truncatedCategories : ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI']
    totalPapers         : 23275

=== cross-check ===
    identical id sets (pre-fix vs fixed): True
```

43 GETs in CASE C = 37 page fetches + the 6 attempts at `start=10000` — the brief's "6 attempts
over ~60 s". The defect is reproduced deterministically, and every number in the report's §5
reproduces exactly, including `totalPapers=34953` and `23275`.

---

## 3. The crux: was criterion 4 really unsatisfiable, and was moving it right?

### Was it unsatisfiable? Yes — provably, given the premise.

`requested_pages` yields `start = 0, 1000, 2000, …` while `start < cap`, so
`deepest = page_size * ceil(cap / page_size) - page_size`. Criterion (original 3) demands
`deepest < 10000` ⇒ `cap <= 10000`. Criterion (original 4) demands `cap >= 2 * 10,785 = 21,570`.
`10,000 < 21,570`: no cap satisfies both. The two invariants genuinely collide, and the round-1
absorber saw the collision itself (`.improve/reports/absorb-2026-10-03.md:57-62`) and wrote
criterion 4 as *"the collision is to be resolved explicitly (one assertion may move, with the
papers-lost cost argued), never by deleting a test."* **Moving one assertion was therefore
sanctioned by the spec, not a liberty taken against it.**

I independently confirmed the collision fires at the boundary: cap `10001` → deepest `10000` →
depth test red; cap `10785` → both the depth test and the moved cap test red.

### Did a better option exist? I looked for one. Three candidates, all worse.

1. **Bound the query window instead of the offset** (IMP-183). This is the one that genuinely
   satisfies *both* original criteria: at a 30-day retention cs.AI needs ~6 pages, deepest offset
   5,000, so the cap could have stayed at 30,000 and criterion 4 stayed intact. It is rejected for
   reasons that hold up: it cuts **every** category's content roughly in half (far more than 785
   papers), the absorber explicitly scoped it to a different item, and at the shipped 60-day
   window it does not help at all — cs.AI still needs its 11th page. Trading 785 papers of
   `cs.AI` for ~18,000 papers across five categories is not the better deal.
2. **Change the page size so the exact offset 10,000 is skipped** (e.g. `page_size=3000` →
   offsets 0/3000/6000/9000/12000). This games the specific number rather than bounding depth: it
   assumes 12,000 is answerable while 10,000 is not, which is unknowable and almost certainly
   false. It would also make the bound a function of an arithmetic coincidence, which is the
   opposite of the structural property criterion 1 asks for.
3. **Retry harder / differently.** Rejected by the spec's own criterion 3 and by measurement: 6
   attempts over ~60 s all 500, because arXiv does not space retries (IMP-208). Correct.

Options (4) keep-the-prefix-and-mark-truncated and (5) treat-a-deep-5xx-as-category-level are
exactly what layer 1 (`collect_papers`) and layer 2 (`reconcile_failed_categories`) implement. So
the resolution is the right one.

### Was moving the assertion right, and is the moved test vacuous?

**Right, and better than the report argues — see F1.** The test is not vacuous:

* cap `30000` (mutation 4) → red; cap `10785` (mutation 6) → red; cap `10001` → red.
* It still reads the shipped cap out of `deploy.yml`, still compares it against the measured
  `10,785`, and its docstring still carries the old requirement and the cost.

**The nuance:** the moved assertion is now *logically implied* by
`test_the_deepest_offset_the_deploy_can_request_is_bounded`, which forces `cap <= 10,000 < 10,785`.
So it cannot fail on its own in the shipped state — it is redundant rather than vacuous, and it is
the depth test, not this one, that is now the live guard. That is the correct ordering; the report
describes it the same way. See F3 for the message defect in it.

---

## 4. Does it actually fix the defect? Adversarial construction

### 4a. Python side — seven cases through the shipped `main()`

`/tmp/imp216v/adv.py` stubs `iter_results`, runs `main()` into a temp dir, then reads back what
was actually written and checks two predicates: (i) no category in `failedCategories` is carried
by any written shard paper, over both `categories` and `primaryCategory`; (ii) no advertised chip
has zero papers behind it.

```
--- X1  cs.AI query dies with NOTHING; a cs.LG paper cross-lists cs.AI in categories[]
    exit=0 categories=['cs.LG', 'cs.AI']
    failedCategories=[] truncatedCategories=['cs.AI'] totalPapers=1 papers_on_disk=1
    INVARIANT (no failed category carried by a shard paper): OK
    advertised chips with no paper behind them: none
--- X2  cs.AI carried ONLY as primaryCategory of a cs.LG-primary paper
    exit=0 categories=['cs.LG', 'cs.AI']
    failedCategories=[] truncatedCategories=['cs.AI']
    INVARIANT: OK      chips with no paper behind them: none
--- X3  cs.AI listed only on the duplicate copy that dedupe_records absorbs
    exit=0 categories=['cs.LG', 'cs.AI']  failedCategories=[]
    INVARIANT: OK      chips with no paper behind them: none
--- X4  the only cs.AI carrier has no arXiv id, so dedupe drops it
    exit=0 categories=['cs.LG']  failedCategories=['cs.AI']
    INVARIANT: OK      chips with no paper behind them: none
--- X5  nothing carries cs.AI -> it must stay failed with no chip
    exit=0 categories=['cs.LG']  failedCategories=['cs.AI']
    INVARIANT: OK      chips with no paper behind them: none
--- X6  two rescued categories keep requested order in the manifest
    exit=0 categories=['cs.AI','cs.RO','cs.LG']  failedCategories=[]
    truncatedCategories=['cs.AI','cs.RO']  totalPapers=2 papers_on_disk=2
    INVARIANT: OK      chips with no paper behind them: none
--- X7  every category dies mid-paging after yielding (the live defect shape)
    exit=0 categories=['cs.CV','cs.LG']  failedCategories=[]
    truncatedCategories=['cs.CV','cs.LG']  totalPapers=6 papers_on_disk=6
    INVARIANT: OK      chips with no paper behind them: none
```

**I could not construct a false "no papers".** X1 is the case the report's reconciliation exists
for and the layer-1 fix cannot see; X3 is the dedupe route; X4 is the one route that makes
`held` narrower than the query saw, and it lands *consistently* (`cs.AI` stays failed precisely
because nothing written carries it).

### 4b. UI side — same manifest, same shards, before and after

`/tmp/imp216v/tree/web/src/__tests__/VerifyIMP216.{adversarial,prefix}.test.tsx` (written in the
`/tmp` copy; the repo's `web/` is untouched) render `<App/>` against the manifest `main()` actually
wrote for X1:

```
✓ src/__tests__/VerifyIMP216.adversarial.test.tsx (1 test)
  — prose matches /no papers here/i?  NO
  — prose matches /older papers .* may be missing/i, naming cs.AI?  YES
  — cs.AI chip present, header "papers from cs.LG, cs.AI"?  YES
  — clicking cs.AI yields the paper, no "no papers match"?  YES
✓ src/__tests__/VerifyIMP216.prefix.test.tsx (1 test)
  — the PRE-FIX manifest for the identical shards: prose matches /no papers here/i
    and /no filter/i, and queryByRole("button", {name:"cs.AI"}) is null
```

The prefix test is the non-vacuity witness: the same shards under the pre-fix manifest really do
produce the false statement and really do remove the chip. The adversarial test's assertion is
therefore not decorative.

### 4c. No double counting, no `totalPapers` drift, no mis-attribution

* `reconcile_failed_categories` mutates only two name lists; `records` is untouched, so
  `totalPapers` cannot move. Confirmed: X6 `totalPapers=2` = `papers_on_disk=2`; CASE A
  `totalPapers=34953` = `papers_on_disk=34953`.
* The category→paper mapping the reader sees is **unchanged** by this fix: the site's predicate
  already matched on `categories` **or** `primaryCategory` (`App.tsx:374-381`), the same union the
  reconciliation uses. The reconciliation only *removes* names from `failedCategories`; it never
  adds a paper to a category the filter would not have shown it under.
* The only new reachable state is a **thin** category (has cross-listed papers, not many). A thin
  chip is not a hollow chip — 0 hollow chips across all seven probes.

---

## 5. The gate, independently run

```
$ time /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 118 tests in 1.096s
OK
```

118 tests, OK, **1.10 s** (baseline 104 / ~1.9 s; implementer's 1.1 s confirmed).

```
$ cd web && npm test
 Test Files  20 passed (20)
      Tests  293 passed (293)
   Duration  6.83s
$ cd web && npm run typecheck
> tsc --noEmit
(clean)
```

**Hermetic — proven, not asserted.** I re-ran the whole suite with `socket.socket.connect`,
`socket.create_connection`, `socket.getaddrinfo` and `urllib.request.urlopen` replaced by
blockers:

```
Ran 118 tests
FAILED (failures=1)
BLOCKED_NETWORK_CALLS=6
```

The single failure is the **pre-existing** loopback test
`test_arxiv_common.BlackHoleRequestTests` — its own error text shows the host was
`127.0.0.1:<ephemeral>` (`tests/test_arxiv_common.py:229-250` binds loopback deliberately). No test
reaches arXiv. The one new test that touches the client,
`test_the_deepest_offset_the_deploy_can_request_is_bounded`, constructs an `arxiv.Client` to read
`page_size` and opens no socket.

**No test is skipped or xfailed to get green.** `grep -c skipped` over `-v` output = 1, and that
match is a test *name* (`test_traversal_member_is_skipped_logged_and_stays_inside_dest`), not a
skip marker. `grep -rn expectedFailure tests/` → none.

**14 added, 0 deleted, 0 weakened.** `grep -c "    def test_"` on
`tests/test_build_index.py`: 55 at HEAD → 69 now. The only removed `def test_` line in the whole
diff is the renamed `test_the_cap_stays_clear_of_the_real_window_sizes`.

**Deploy comment arithmetic re-checked:** `37 × 70 + 1800 = 4390`, `4500 − 4390 = 110 s`; old
`38 × 70 + 1800 = 4460`, `4500 − 4460 = 40 s`. Correct, and `DeployStepTimeoutTests` was not
touched (it asserts only the partition case, which no cap affects).

---

## 6. Non-vacuity — seven mutations, all red, reproduced in `/tmp`

| # | mutation | result (my run) |
| --- | --- | --- |
| 1 | `scripts/build_index.py` reverted to HEAD in full | `FAILED (failures=4, errors=9)` |
| 2 | `collect_papers`: every failed query is a failed category again | `FAILED (failures=2)` |
| 3 | `main`: the records never get the last word | `FAILED (errors=1)` |
| 4 | `deploy.yml` cap back at `30000` | `FAILED (failures=3)` |
| 5 | cap `10001` (criterion 1's named falsifier) | `FAILED (failures=2)` |
| 6 | cap `10785` | `FAILED (failures=3)` |
| 7 | `DEPLOY_OFFSET_BUDGET` name removed from the step comment | `FAILED (failures=1)` |

Mutation 1 (the two most load-bearing cases quoted in full):

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
Ran 118 tests in 1.115s
FAILED (failures=4, errors=9)
```

Mutation 2:

```
FAIL: test_a_query_that_died_after_yielding_is_truncated_not_failed
AssertionError: Lists differ: ['cs.AI'] != []
Ran 118 tests in 1.117s
FAILED (failures=2)
```

Mutation 3 — the reconciliation alone, exactly one test, and it is the cross-listing case that
only reconciliation can catch:

```
ERROR: test_a_cross_listed_paper_cannot_leave_its_own_category_failed
KeyError: 'truncatedCategories'
Ran 118 tests in 1.091s
FAILED (errors=1)
```

Mutation 4:

```
FAIL: test_the_deepest_offset_the_deploy_can_request_is_bounded
AssertionError: 29000 not less than 10000 : deploy.yml:141 caps at 30000, whose
deepest request is start=29000 -- at or above DEPLOY_OFFSET_BUDGET (10000) ...
FAILED (failures=3)
```

Every count in the report's §6 table reproduced exactly. Mutation 1's `Ran 118 tests` also proves
the suite is closed over the revert: reverting the source alone turns 13 tests red rather than
erroring on import.

---

## 7. `readme.md` accuracy

Two paragraphs changed (`:80-93` build script, `:186-204` deployment). Every substantive claim in
them is one I verified:

| Claim | Verdict |
| --- | --- |
| "`--max-per-category 10000`, which bounds how *deep* it pages rather than how many papers it wants" | true — `requested_pages(10000, 1000)` tops out at `start=9000` |
| "a cap of 10,000 makes `start=9000` the deepest request the deploy can ever make — whatever any category grows to" | true, structurally |
| "recorded in `index.json` under `truncatedCategories`, keeps its filter chip, and the site reports that its older papers may be missing" | true — end-to-end in §4b |
| "Whether the category is *absent* or merely *short* depends on what the run actually fetched, never on the query's exit status alone" | true — this is the accurate description of the two-layer fix, and it is the paragraph's best sentence |
| "A category that collected papers before the failure is never described as absent" | true — the invariant, verified seven ways |
| "The cap does cost something on a healthy run — cs.AI … about 785 of 10,785" | true of the cap, but see **F1**: measured, it costs nothing relative to the live defect |
| "What it buys is that a category is never dropped from the index because of a request arXiv declined" | **over-broad — F2** |

No stale `30000` reference survives anywhere in the repo outside `.improve/`.

---

## 8. Findings

### F1 (LOW, and it improves on the report) — the "785 papers" cost is a counterfactual, not a loss

`impl-IMP-216.md` §3 and the readme both present `cs.AI` losing 785 of 10,785 papers as the price
of the depth bound. My CASE C vs CASE A measurement says the price is **zero**, measured, not
reasoned:

```
pre-fix, cap 30000, 500 at start>=10000 : cs.AI papers in shards: 10000
fixed,   cap 10000, 500 at start>=10000 : cs.AI papers in shards: 10000
identical id sets (pre-fix vs fixed)    : True
totalPapers both                        : 34953
```

`cs.AI` held 10,785 in-window papers; the pre-fix run collected ten full pages — 10,000 papers —
and then **died at `start=10000`**. Those 785 were unreachable before the change too, because
arXiv refuses the offset that would deliver them. The cap of 10,000 is simply the largest value
that never requests the refused offset, and it coincides exactly with the prefix arXiv was willing
to serve. So the depth bound buys "never ask again" for no data at all, while the layer-1/layer-2
fix alone would have produced byte-identical shards.

The cost becomes real only if arXiv's refusal threshold moves above 10,000 (or if the fault is
transient). Nothing is wrong with the change; the *framing* is pessimistic, and in one place it is
internally inconsistent: `deploy.yml`'s own comment says "the papers past the offset used to be
unreachable anyway", while `readme.md:194-196` presents them as a fresh loss.

**Actionable:** amend the readme paragraph to say the truncation is announced *and* that nothing
previously fetchable is lost while arXiv keeps refusing that offset, so a maintainer reading
`readme.md` in six months does not re-open the cap to "recover" 785 papers that were never
obtainable. Keep the 785 figure (criterion 5 mandates it) — frame it as the shortfall against the
full window, not as a regression.

### F2 (LOW-MED, documentation) — `readme.md:199` is false as an absolute

> What it buys is that a category is never dropped from the index because of a request arXiv
> declined.

Reproduction (probe **X5**): `cs.LG` answers one paper; `cs.AI`'s query is declined having returned
nothing; nothing in the shards carries `cs.AI`.

```
exit=0  categories=['cs.LG']  failedCategories=['cs.AI']  truncatedCategories=[]
```

`cs.AI` **is** dropped from the index because a request arXiv declined — and the site then
correctly and truthfully says `cs.AI` "has no papers here", which is true. The sentence is
harmless in context (the paragraph is about the deep-offset fault) but it is an unqualified
absolute about behaviour that does not hold.

**Actionable:** change to the scoped claim the code actually guarantees — "a category that
collected papers before the fault is never dropped from the index and never described as having
none" — which is precisely what §4 proved.

### F3 (LOW, test quality) — the moved cap test's failure message names the wrong offset

`tests/test_build_index.py:1438-1443`:

```python
"60-day window (%d) -- so the cap is asking for a page at or past "
"start=%d, the offset arXiv answered with HTTP 500 on 2026-10-02"
% (index + 1, cap, largest_measured_window, largest_measured_window),
```

With `largest_measured_window = 10785` this prints "start=10785, the offset arXiv answered with
HTTP 500". The refused offset was **`start=10000`**; 10,785 is a paper *count*. Reproduced at
mutation 6:

```
AssertionError: 10785 not less than 10785 : deploy.yml:141 caps at 10785, which is at or
above the largest measured 60-day window (10785) -- so the cap is asking for a page at or
past start=10785, the offset arXiv answered with HTTP 500 on 2026-10-02
```

Only reachable when the depth test is already failing, so it cannot mislead a green run — but it is
a factual error in the one message a future maintainer will read. Fix: interpolate
`build_index.DEPLOY_OFFSET_BUDGET`, not `largest_measured_window`.

Related, and worth stating rather than hiding: the moved assertion is now **implied** by
`test_the_deepest_offset_the_deploy_can_request_is_bounded` (which forces `cap <= 10,000 <
10,785`), so it adds no independent coverage in the shipped state. That is redundancy, not
vacuity — it is red for caps 10,001 / 10,785 / 30,000 when the depth test is absent — but the
depth test, not this one, is now the live guard. That is the correct ordering and the report
describes it accurately.

### F4 (LOW, test quality) — `test_raising_the_retries_does_not_stand_in_for_a_depth_bound` has an unfalsifiable assertion

`tests/test_build_index.py:1395-1401`:

```python
self.assertEqual(build_index.arxiv_common.DEFAULT_NUM_RETRIES, 5)
self.assertNotEqual(
    build_index.arxiv_common.DEFAULT_NUM_RETRIES,
    build_index.DEPLOY_OFFSET_BUDGET, ...)
```

`assertNotEqual(5, 10000)` cannot fail, so the assertion the test's name advertises does no work.
The test is not vacuous overall — `assertEqual(..., 5)` is a real pin and it goes red on mutation 1
(where the module no longer exposes the constant at all). But as written it overstates what it
guards. Either drop the `assertNotEqual` and let the name refer to the `== 5` pin, or make the
relationship real (e.g. assert the deploy command still carries no retry flag and that
`DEFAULT_NUM_RETRIES` is not derived from `DEPLOY_OFFSET_BUDGET`).

### F5 (LOW, copy) — a reconciliation-rescued category is told the wrong *cause*

`failureCopy.ts:113-115` says `"<names> was cut off at this index's per-category limit, so older
papers from it may be missing."` For a category rescued by cross-listing (probes X1/X2/X3) that is
the wrong reason: nothing was cut off at a limit — the category's own query returned *nothing*, and
it is short because a handful of its papers were cross-listed into another category's results.

This is **spec-mandated** (criterion 4 names that exact sentence) and `failureCopy.ts` is
explicitly out of scope, so it is not a criterion failure. It also errs in the safe direction: it
understates the shortfall. Recorded so the next item that touches this copy knows there is a third
state (query died, rescued by cross-listing) the two-sentence vocabulary cannot express.

### F6 (INFO, disclosed) — profile row PY-17 is still stale

`REPO_PROFILE.md:960` still says the deploy "runs the bare uncapped command every week" at
`deploy.yml:55` and that a deep-offset 5xx makes `main()` "discard all five categories and exit 1
with nothing written". Both have been false since IMP-204 and are false again here. Correctly
disclosed as **D-2** of `discovered-IMP-216.md` and left to IMP-195; `REPO_PROFILE.md` was not in
this item's file list. No action for this PR.

### F7 (INFO, report accuracy) — the report's `FEATURES.md` attribution is not supported by the diff

`impl-IMP-216.md` §9 claims `.improve/FEATURES.md` — "**one additive paragraph** at the end of the
IMP-216 `Notes`". The diff shows the whole IMP-216 entry (Status, Area, Intent, all six criteria,
Verification method, Effort, Priority, Notes) as an addition, inside a
**74 insertions / 0 deletions** block that adds exactly the four items the round-2 absorber's own
report lists (IMP-216, IMP-217, IMP-218, IMP-219), and that absorber's §3 quotes the spec-conflict
and cost paragraphs in its own words. So the attribution is at best unverifiable and most likely
wrong: the FEATURES.md content was authored by the absorber from the report. The *effect* is
correct — the record in `FEATURES.md` is accurate and IMP-216's Notes do carry the resolution — so
this is a bookkeeping inaccuracy in the report, not a defect in the change.

---

## 9. Criterion-by-criterion summary

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | deploy paging depth bounded, structurally; cap 10001 fails; comment cites the constant | **MET** (mutations 5 and 7) |
| 2 | mid-paging death is truncated, not failed; in-window count decides; ERROR kept | **MET** |
| 3 | records get the last word; invariant over `categories` + `primaryCategory`; WARNING logged; requested order | **MET**, structurally (X1-X7) |
| 4 | nothing on screen contradicts the shards; no `web/` change | **MET**; copy caveat F5 |
| 5 | cap test measures the real windows, asserts `cap < 10,785`, records the cost | **MET**; redundancy + message defect F3 |
| 6 | loopback reproduction both ways, four reverts quoted, suite green/offline, `requirements.txt` untouched, no `timeout-minutes` moved | **MET**, independently reproduced (§2, §5, §6) |

## 10. Evidence

* Gate: `Ran 118 tests in 1.096s / OK`; `Test Files 20 passed (20)` / `Tests 293 passed (293)`;
  `tsc --noEmit` clean; hermeticity proven with `BLOCKED_NETWORK_CALLS=6`, all `127.0.0.1`.
* Adversarial probe: `/tmp/imp216v/adv.py`, output `/tmp/imp216v/adv.out`.
* Loopback reproduction (mine, not the implementer's): `/tmp/imp216v/h/{stub.py,run.py,all.py}`,
  trees `/tmp/imp216v/hprefix` (HEAD source + HEAD `deploy.yml`) and `/tmp/imp216v/hfixed`.
* UI witnesses: `/tmp/imp216v/tree/web/src/__tests__/VerifyIMP216.adversarial.test.tsx` and
  `VerifyIMP216.prefix.test.tsx`.
* Mutations: `/tmp/imp216v/mut1` … `mut7`.
* Key source lines: `scripts/build_index.py:101` (`DEPLOY_OFFSET_BUDGET`), `:349-363`
  (classification), `:387` / `:404` / `:616` (reconciliation), `.github/workflows/deploy.yml:141`,
  `tests/test_build_index.py:486` / `:600` / `:1045` / `:1350` / `:1389` / `:1403`.