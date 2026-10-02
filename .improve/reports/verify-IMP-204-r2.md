# Verify IMP-204 — re-verification (round 2)

**Verdict: PASS** — 5/5 acceptance criteria met. The blocking defect from
`.improve/reports/verify-IMP-204.md` is genuinely fixed and was reproduced in a
real browser. Three non-blocking issues are recorded in §10.

Independent verifier. No source file was modified. Scratch work under
`/tmp/rpf204/`. The live arXiv API was not contacted; every reproduction used a
stubbed `iter_results` or a local static server.

---

## 1. The central check — is the reader actually told? YES

This is the whole verdict, so it was checked in the DOM, not by reading source.

### 1.1 `failedCategories` is declared and reaches the app

- `web/src/lib/types.ts:47` — `failedCategories?: string[]` on `IndexManifest`,
  with the comment naming the chip hazard.
- `web/src/lib/types.ts:53` — `truncatedCategories?: string[]`.
- `web/src/lib/failureCopy.ts:88` — `describeIncompleteIndex(failed, truncated)`
  is the only thing that turns either field into text; it returns `null` when
  both are empty, so a complete index renders exactly as before.
- `web/src/App.tsx:326-333` — `useMemo(() => describeIncompleteIndex(manifest?.failedCategories, manifest?.truncatedCategories), [manifest])`.
- `web/src/App.tsx:717-734` — the `<p className="banner banner--warning" role="alert" aria-label={headline} title={detail}>`.

**On the bare cast at `paperIndex.ts:202`** (`return body as IndexManifest`): a
TypeScript cast is compile-time only and drops nothing at runtime — the parsed
JSON object *is* the manifest, and any extra key on it survives. The previous
verdict's phrase "dropped by the bare cast" describes a type-level gap, and the
consequence was real: with no declaration in `types.ts` and no reader in `App.tsx`
the field had no path to the screen. Both halves are now closed — it is declared
(`types.ts:47`) and it is read (`App.tsx:329`). Browser evidence below is the
decisive part. (The runtime shape check at `paperIndex.ts:199` is unchanged; field
validation remains IMP-098's scope.)

### 1.2 Browser reproduction (real build, real HTTP, real DOM)

Built with `npx vite build --outDir /tmp/rpf204/dist` (no source write), copied
to `/tmp/rpf204/serve/research-paper-feed/`, served by
`python3.11 -m http.server 5399`. `index.json` was edited **in /tmp only** to
name `cs.RO` in `failedCategories` and omit it from `categories`.

**(a) notice visible and names cs.RO** — at 1280px:

```
- alert "This index is incomplete":
  - strong: "This index is incomplete."
  - text:   "cs.RO could not be fetched from arXiv when this index was built,
             so it has no papers here and no filter to browse."
```

`role="alert"` is present (the accessibility snapshot renders it as `alert`,
accessible name `This index is incomplete` because of the `aria-label`). It
reuses the existing `banner banner--warning` class shared with the
unknown-category notice below it in the tree — criterion satisfied literally, not
by a new pattern. Screenshot: `.playwright-mcp/-tmp-rpf204-desktop-1280.png`.

**(b) no cs.RO chip** — `chips.includes('cs.RO') === false`; the chip row is
`All, cs.CV, cs.LG, cs.CL, cs.AI`. The header claim also drops it:
`"2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI · index generated Oct 1, 2026"`.
The previous verdict's exact reproduced lie — "20,000 papers from cs.CV, cs.LG,
cs.CL, cs.AI, cs.RO" with cs.RO empty — is no longer reachable.

**(c) a visitor is never told "No papers match" for cs.RO** — two probes:
- `document.body.innerText.includes("No papers match the current filters") === false`.
- Navigating to `#cat=cs.RO` (the only remaining way to ask for it — a shared or
  bookmarked link) renders IMP-009's existing banner instead:
  `alert` → *"Unknown category: cs.RO. This index does not have that category, so
  nothing can match."* plus a "Reset category filter" button. The `.empty`
  paragraph at `App.tsx:839` is **not** rendered. Two alerts appear together and
  the cause is named twice.

390px screenshot (`.playwright-mcp/-tmp-rpf204-mobile-390.png`): the notice is
fully visible in the prose, not clipped into a tooltip, and there is still no
cs.RO chip. This is the specific claim in the `App.tsx:717-723` comment and it
holds.

### 1.3 `truncatedCategories` — not a second invisible field

Checked because that was the exact shape of the failure being guarded against.
Written at `build_index.py:365`, declared at `types.ts:53`, read at `App.tsx:330`.
Reproduced in the browser with the served manifest swapped to
`truncatedCategories: ["cs.LG","cs.AI"]`, `categories` complete:

```
- alert "This index is incomplete":
  "cs.LG, cs.AI were cut off at this index's per-category limit, so older papers
   from them may be missing."
```

with all five chips still present — correct, since a truncated category does have
papers behind it. The two states are distinguished in the copy, not merged.

---

## 2. The test that pinned the lie

The previous verdict's `tests/test_build_index.py:608` was
`MainTests.test_refuses_to_write_index_when_a_category_query_fails`, which
asserted `assertNotEqual(exit_code, 0)` and that `cs.LG` appeared in the ERROR
log — i.e. it pinned the behaviour that produced the lie.

It has been deliberately rewritten, which criterion 2 explicitly permits, and
split in two (`tests/test_build_index.py:556-`):

- `test_a_failed_category_no_longer_discards_the_others` — exit 0, `index.json`
  exists, `manifest["failedCategories"] == [failed]`, the category appears in the
  captured ERROR log, `assertNotIn(failed, manifest["categories"])`, `totalPapers
  > 0`, and the four surviving categories' ids are all present in the shards. The
  docstring argues the exit-0 trade-off explicitly (a non-zero exit fails the
  deploy step and reproduces the stale live site). Non-vacuous: it fails pre-fix.
- `test_refuses_to_write_index_when_every_category_query_fails` — IMP-004's
  guarantee in the shape it was written for. Passes both pre- and post-fix.

Six deleted lines exist in `tests/` (`git diff -U0 -- tests/ | grep -c '^-[^-]'`
= 6): one regex widening (`DEPLOY_INDEX_RUN`), the old test's `def` line, its
`cat:cs.LG` branch, its `yield`, and its two assertions. All inside the rewritten
test. No other expectation was weakened; no test was skipped or
`expectedFailure`-marked anywhere in the change.

### 2.1 Pre-fix failure counts (my own scratch copy)

`/tmp/rpf204/prefix` = working tree with **HEAD** restored for
`scripts/build_index.py`, `scripts/arxiv_common.py`,
`.github/workflows/deploy.yml`, `readme.md`, `web/src/App.tsx`,
`web/src/lib/types.ts`, `web/src/lib/failureCopy.ts`, keeping the shipped tests.

**Python — `9 failures, 1 error` of 104** (`FAILED (failures=9, errors=1)`):

```
FAIL  test_arxiv_common.IterResultsTests.test_a_limit_above_the_api_ceiling_is_capped_and_said_so
ERROR test_arxiv_common.IterResultsTests.test_a_limit_at_the_ceiling_is_left_alone
FAIL  test_build_index.DeployStepCommandTests.test_the_cap_stays_clear_of_the_real_window_sizes
FAIL  test_build_index.DeployStepCommandTests.test_the_comment_documents_the_number_the_command_uses
FAIL  test_build_index.DeployStepCommandTests.test_the_index_step_caps_what_it_fetches_within_the_ceiling
FAIL  test_build_index.MainTests.test_a_category_that_spends_the_whole_allowance_is_recorded
FAIL  test_build_index.MainTests.test_a_failed_category_no_longer_discards_the_others
FAIL  test_build_index.QueryCeilingTests.test_a_cap_above_the_ceiling_is_clamped_instead_of_paging_past_it
FAIL  test_build_index.QueryCeilingTests.test_no_single_request_exceeds_the_slice_or_the_window
FAIL  test_build_index.QueryCeilingTests.test_the_uncapped_default_is_the_documented_ceiling
```

`[100000] != [30000]` and `AssertionError: 100 != 30` are the two headline ones.

**Web — `11 failed | 255 passed` of 266** across 2 files: the 7 new
`describeIncompleteIndex` unit cases and all 4 `App.incompleteIndex` cases.

Both suites are non-vacuous. No test asserts something that happened to hold
before the change.

---

## 3. The margin — is 30,000 a real fix or a relabeling?

**Plainly: for the number itself, a relabeling; for the item, a real fix.**

Read off the installed `arxiv` 2.1.3 (`arxiv/__init__.py`):
- `_format_url` (`:611`) always writes `"max_results": page_size` — the search's
  `max_results` never appears in a request URL, so the item's "HTTP 400 for
  `max_results > 30,000`" was never a request this code could make.
- `results()` (`:572`) applies `itertools.islice(..., search.max_results - offset)`
  over `_results`, which stops at the feed's own `total_results`.

So `UNLIMITED` was never the mechanism that failed. For any real 60-day window
(cs.AI measured at 10,785) `UNLIMITED = 100000` and `UNLIMITED = 30000` page
identically — 11 pages either way. The 100,000→30,000 move reduces the *maximum*
offset from ~99,000 to ~29,000 and nothing else. What actually fixed the deploy is
criterion 2's per-category degradation, which is implemented, tested and
browser-verified above. Criterion 1 as written ("the value … is at or below 30,000
… no single request exceeds … 2,000 at a time or a `start + max_results` above
30,000") is met: `page_size = min(1000, 30000) = 1000`, max `start = 29,000`,
`start + max_results = 30,000`. The comment at `build_index.py:43-60` now cites
the manual and explains why a short page can still push `start` off a multiple of
`page_size`.

**Is the cap sized to current demand?** No, and that is the right call. 30,000 /
10,785 = 2.78× the largest measured window. At ~9% growth per window, a 12,000
cap (which is what the previous attempt used) is roughly one growth step from
truncating — the previous verdict's objection. Sitting *at* the API ceiling means
the binding constraint is always the 60-day retention window, never the flag, and
the flag cannot start silently cutting papers before some future reader has to
re-derive why.

**IMP-095:** its criterion 1 is satisfied twice over — `UNLIMITED` is at 30,000
*and* `iter_results` clamps with a `logging.warning`. Only one number exists in
the tree (`arxiv_common.RESULTS_CEILING = 30000`), so the "must not each set a
different number" prohibition holds. But IMP-095's row still reads **TODO** and
was not marked absorbed — see §10, issue 2.

---

## 4. Deploy timeout arithmetic, recomputed independently

`deploy.yml` index step: `timeout-minutes: 75` = 4,500 s. **Unchanged.**
`build` job `timeout-minutes: 90`. **Unchanged.** `ci.yml` is untouched by this
change (`git diff --stat -- .github/workflows/ci.yml` empty; job 25, step 15).
IMP-198's protection was not weakened.

**Pages with `--max-per-category 30000`:** `page_size = 1000`, so
`ceil(30000/1000) = 30` pages per category, `start ∈ {0, 1000, …, 29000}` — the
last request is `start=29000&max_results=1000`, and `islice` stops the generator
before `start=30000` is ever requested. 5 categories ⇒ **150 pages maximum**,
capped by each category's `total_results` long before that in practice.

**Worst case against the cap:** at IMP-198's 70 s/page bound (60 s timeout + 10 s
`DEFAULT_DELAY_SECONDS`), 150 × 70 = **10,500 s**, i.e. 2.33× the 4,500 s step
cap. The `+1800 s` per-category retry tail is mutually exclusive with full paging
(a dead category stops paging), so the true bound is `max(10,500, 1,800)`.

**What the comment says, and whether it is true:**
- `5 categories x (num_retries 5 + 1) x 60 s = 1800 s` — inherited verbatim from
  IMP-198, unchanged, still the number `DeployStepTimeoutTests` asserts against.
  (It is a conservative over-estimate: `requests.exceptions.Timeout` is not in
  arxiv's retry tuple at `arxiv/__init__.py:627-631`, so a black hole costs one
  60 s per category, not six. Pre-existing to IMP-198, not this change's claim.)
- `75 min = 4500 s is 2.5x it` — 4500/1800 = 2.500 exactly. **True.**
- `70 x 38 pages + 1800 s = 4460 s` — 70 × 38 = 2,660; + 1,800 = 4,460. **True**,
  and it correctly names IMP-205's finding F-1 rather than re-litigating it.
- The false `~15x headroom` claim is **gone**.
- `30,000 is 2.8x that measurement` — 30,000/10,785 = 2.78. **True.**
- `38 pages across the 5 categories today, the same 38 this command paged before
  the flag existed` — **true**, and stated for the right reason (the cap does not
  bite at today's window sizes).

The one number the comment does not state is the flag-imposed ceiling of 150
pages / ~10,500 s, which is 2.33× the step cap. It is unreachable for these five
categories at 60-day retention (cs.AI alone would need ~12 more growth windows,
~3 years, and the four others would have to reach it simultaneously; arXiv does
not publish 150,000 papers per 60 days anywhere), and the step timeout still
bounds the cost at 75 minutes regardless. Non-blocking; recorded as issue 1.

---

## 5. The clamp

`scripts/arxiv_common.py:136-141` — `iter_results` clamps `max_results` to
`RESULTS_CEILING` with a `logging.warning` naming the old value and the ceiling,
*after* the `max_results <= 0` short-circuit (so `--max-per-category 0` reaching
`iter_results` as 0 still returns immediately, unchanged).

Does not regress IMP-198: `build_client` and `install_request_timeout` are
untouched; the clamp only lowers a value that arxiv's `_format_url` never put in a
URL anyway. Pacing untouched — `DEFAULT_DELAY_SECONDS = 10` and
`DEFAULT_NUM_RETRIES = 5` are unchanged, and clamping makes the run strictly
shorter, never longer.

**Legacy CLI covered:** `scripts/paper-collector.py:224` passes `max_papers`
straight into `arxiv_common.iter_results`, so `--max-papers 999999` is clamped.
Documented flags are byte-unchanged: `--help` still shows "Maximum number of
papers to pull (default: 1000; 1 or greater)" and the readme row at
`readme.md:147` matches. `paper-collector.py` is not in the diff at all.

---

## 6. Total failure still fatal — reproduced

Stubbed every category to fail (`iter_results` raising `ArxivError`):

```
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO.
EXIT CODE: 1
out-dir exists: False
index.json exists: False
```

The guard at `build_index.py:475` is `if failures and len(failures) == len(categories)`.
No out-dir is created at all, so the previously deployed index is untouched. The
secondary guard (`if not records: … return 1`, `:479-486`) still catches the case
where one category survives but contributes nothing in-window, and now logs the
failed categories in that message too.

---

## 7. Suites — exact results

| Command | Result | Duration |
|---|---|---|
| `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | **Ran 104 tests — OK** | 1.10 s tests / 1.93 s wall |
| `cd web && npm run typecheck` | clean (`tsc --noEmit`, no output) | — |
| `cd web && npm test` | **17 files, 266 passed (266)** | 3.76 s |
| `cd web && npm run build` | `tsc --noEmit && vite build` → `✓ built in 390ms`, `dist/assets/index-B28RVUhO.js` 172.50 kB │ 55.22 kB gzip | ~1 s |

Counts match the brief's expectations exactly (104, 266).

---

## 8. No regressions

- **Deleted tests:** 6 deleted lines in `tests/`, all inside the one IMP-004 test
  criterion 2 authorises rewriting plus the widened `DEPLOY_INDEX_RUN` regex. No
  other expectation touched. `web/src` has exactly 1 deleted line — a reformatted
  `import { describeLoadFailure }` that became
  `import { describeLoadFailure, describeIncompleteIndex, … }`.
- **Skips / `expectedFailure`:** none added. The only `skipTest` in the tree is
  `tests/test_paper_collector.py:413` inside `_skip_without_filter`, which is
  pre-existing and in an unmodified file.
- **IMP-004 total-failure contract:** reproduced in §6, and
  `MainTests.test_refuses_to_write_index_when_every_category_query_fails` pins it.
- **IMP-020 retention filtering:** `CollectPapersRetentionTests` untouched and
  green; the `cutoff`/`break` logic in `collect_papers` is unchanged — the diff
  adds only `truncated` bookkeeping around it. New test
  `test_a_category_short_of_the_allowance_is_not_recorded_as_truncated` guards the
  interaction (a category that stops on retention is *not* reported as truncated).
- **IMP-009/IMP-010 category chips:** browser-verified above — chips come from
  `manifest.categories`; `#cat=cs.RO` produces the unknown-category alert with a
  reset button, not an empty feed.
- **IMP-011/016/017 banner patterns:** the new notice reuses
  `banner banner--warning` + `role="alert"` from the existing unknown-category
  banner, side by side in the same `<main>`; both render together without
  collision.
- **IMP-019 type nullability:** `types.ts` gained two **optional** fields only;
  `absUrl`/`pdfUrl` untouched, so every existing `IndexManifest` literal in the
  17 test files still typechecks (`npm run typecheck` clean, 266 pass).

---

## 9. Docs and IMP-095

`readme.md:64-90` replaces the workaround paragraph ("a full uncapped run pages
`cs.AI` past `start=9000`") with the mechanism — which is what IMP-211 asks for
and what IMP-204's Notes require ("describe the new default rather than a
workaround"). It states the 30,000 ceiling, the 2,000 slice, that `0` is a bound
not an absence, that a larger explicit value is clamped, and that the 60-day
window is the real stop. `readme.md:175-184` adds the deploy cap with the
10,785 measurement.

**Reconciled with `--help`:** `--max-per-category` help reads "(default: 0; 0 or
greater, 0 = no cap beyond arXiv's own 30000-result-per-query limit)"; readme
reads "(0 or greater, default `0` = as many results as arXiv will serve for one
query)". Same range, same default, same meaning. `--max-papers` help "1 or
greater, default 1000" ≡ readme `readme.md:147` "Must be 1 or greater / `1000`".
`--retention-days`, `--abstract-chars`, `--category`, `--out-dir`, `--topic`,
`--download-pdfs`, `--download-sources`, `--save-csv` all unchanged and consistent.
No drift introduced.

**IMP-095:** substance landed (ceiling enforced in one shared constant *and*
clamped in `iter_results`, with tests for both), row not reconciled — issue 2.

---

## 10. Issues (none blocking)

1. **`deploy.yml`'s comment omits the flag-imposed page ceiling.** The block
   reasons from "38 pages today" and explicitly defers the compound case to
   IMP-205, but never states the bound *this flag* creates: 30 pages/category ×
   5 = 150 pages → 150 × 70 s = 10,500 s, which is 2.33× the 4,500 s step cap.
   Unreachable at 60-day retention and the timeout is unchanged, so nothing
   breaks; but a reader checking the margin finds a 4,460 s figure where the
   flag's own worst case is 10,500 s. **Fix:** one sentence — "a category that
   reached the cap would page 30 times, 150 pages across the five, ~10,500 s at
   the 70 s/page bound, which is why the step cap is IMP-205's to raise" — or
   have IMP-205 state it. (This is the same *shape* as the previous verdict's
   objection, in the one place the number is still unstated.)
2. **IMP-095 is not reconciled.** Its substance is done inside IMP-204
   (`RESULTS_CEILING`, plus the `iter_results` clamp and two new tests in
   `tests/test_arxiv_common.py`), but its row in `.improve/FEATURES.md` still
   reads **TODO** and still points at `build_index.py:38` `UNLIMITED = 100000`,
   which no longer exists. **Fix:** mark it DONE/absorbed with IMP-204's
   reference, or correct the cited location.
3. **The item's framing over-credits the number.** `build_index.py:43-60`'s new
   comment is careful, but `readme.md:73-77` and the module docstring can read as
   though 30,000 is what stops the deep-offset 500. It is not: for every window
   this pipeline sees, `UNLIMITED` never appears in a request URL and paging stops
   at `total_results` long before either value. What stops the deploy being
   emptied is criterion 2. Not a defect — the comment at
   `build_index.py:53-58` says exactly this — but worth recording so a later
   reader does not "fix" the constant again and assume that was the mechanism.

---

## Criterion summary

| AC | Met | Basis |
|---|---|---|
| 1. Bound in force, respects the ceiling | **yes** | `UNLIMITED = arxiv_common.RESULTS_CEILING = 30000`; `page_size = 1000 ≤ 2000`; max `start + max_results = 30,000`; comment cites the manual; explicit over-caps clamped; single number in the tree |
| 2. Per-category degradation | **yes** | exit 0 + `logging.error` naming each failure + `failedCategories`; IMP-004 total-fail preserved and reproduced (§6); old test deliberately rewritten with the trade-off argued; browser-verified |
| 3. Documented deploy default | **yes** | `--max-per-category 30000` on the step, commented with the 10,785 measurement, ~9% growth, 2.8×, and what it costs; no reliance on `0 = no cap` |
| 4. Tests | **yes** | 104 green; pre-fix `9 failures + 1 error`; ceiling, partial-failure, total-failure, truncated/not-truncated, clean-manifest, workflow-flag and `iter_results`-clamp cases all present |
| 5. Docs follow the code, nothing regresses | **yes** | `readme.md:64-90`, `:175-184`; both suites green; no test deleted/skipped/`expectedFailure` outside the one authorised rewrite |
