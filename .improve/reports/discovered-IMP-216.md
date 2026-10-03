# Discovered while implementing IMP-216

Out-of-scope problems found on the way through the fix. **Nothing here was fixed**, because each
one belongs to another item, another agent's file, or another stage of this loop. Nothing here is
a regression introduced by IMP-216.

---

## D-1 — `paper-collector.py` has the same deep-offset fault, and this time there is no signal at all (HIGH)

**Where:** `scripts/paper-collector.py:222-249` (`fetch_papers`), called from `main` at `:296`;
`scripts/paper-collector.py:200` (`--max-papers`, `int_at_least("--max-papers", 1)`, default
`1000`).

IMP-216's criterion 3 is deploy-scoped by its own wording ("the deepest offset **a deploy** can
request"), so the shared client is only half-fixed by this item. The other half is unmitigated,
and it is worse in kind than the defect IMP-216 just closed:

```python
def fetch_papers(topic, max_papers, download_pdfs=False, download_sources=False):
    all_data = []
    for result in arxiv_common.iter_results(topic, max_papers):   # <- no status holder
        ...
    return pd.DataFrame(all_data)
```

`arxiv_common.iter_results`'s own docstring states the rule this caller breaks: *"A short result
list is indistinguishable from an exhausted one, so callers that must not act on a partial answer
pass a status holder."* `build_index` passes one; `fetch_papers` does not. So on a deep-offset
5xx, `iter_results` terminates iteration after its retries and returns whatever arrived, and that
partial set is written to the HTML feed and (with `--save-csv`) the CSV **with no marker
whatsoever** — the user gets a complete-looking file of papers that is silently short. That is
precisely the class of defect IMP-216 exists to end ("a field nothing renders would not [count]"),
one level further down.

Reachability is not theoretical. `--max-papers` accepts any integer ≥ 1 with no upper bound of its
own; `iter_results` clamps to `RESULTS_CEILING` internally, so
`python scripts/paper-collector.py --topic 'cat:cs.AI' --max-papers 30000` produces
`page_size = 1000` and can request `start=29000`. `readme.md:66` tells users to "pass a small
number for fast dev runs", and `--max-papers` is a documented, advertised flag.

**Why this was not fixed here.** It is a different entry point with its own contract question
(does the CLI exit non-zero, write a partial file with a warning, or refuse?), it is not on the
deploy path, and IMP-216's scope is the index build. Filing it as its own item is the honest
move — the fix is a status holder plus a decision about exit codes, which is IMP-204's
total-vs-partial policy question applied to a second caller.

**Evidence:** read of `paper-collector.py:222-249` and `:296`; `readme.md:66`;
`arxiv_common.iter_results` docstring (`scripts/arxiv_common.py:118-123`). Profile row **PY-35**
covers only `--max-papers <= 0` (a different defect, already owned by IMP-022) and does **not**
cover the missing status holder. Cross-reference: IMP-216 (the index-build half), IMP-022 (flag
validation on this script), IMP-095 (the `UNLIMITED`/`RESULTS_CEILING` constant).

---

## D-2 — `REPO_PROFILE.md` row **PY-17** is stale again, and wrong in substance (MED)

**Where:** `.improve/REPO_PROFILE.md:960` (PY-17), location column
`build_index.py:43-45, 236, 261-273`; `deploy.yml:55`.

IMP-195 owns stale profile rows, so this is flagged rather than edited. PY-17 needs **three**
corrections, and the third is a claim that is now false twice over:

1. The line cites are stale again. `build_index.py:43-45` is now `:41-47` (`CATEGORY_PATTERN`),
   `:236` is now `:301` (`limit = min(max_per_category, UNLIMITED)`), and `deploy.yml:55` is now
   `:79`.
2. *"When a deep-offset 5xx fires, `collect_papers` records the failure and `main()` **discards
   all five categories** and exits 1 with nothing written"* — already false after IMP-204, which
   made a partial index publishable. This is what made IMP-216 hard to see from the profile: the
   row describes a pre-IMP-204 codebase.
3. *"`.github/workflows/deploy.yml:55` runs the bare uncapped command every week"* — false after
   IMP-204 (which named `--max-per-category 30000`) and false again now (`:141` runs
   `--max-per-category 10000`). The row's "Backlog:" pointer should also gain **IMP-216**.

Suggested replacement text for the row's second half, from this item's measurements: the deploy now
bounds *depth* rather than volume (`DEPLOY_OFFSET_BUDGET = 10000` in `scripts/build_index.py`,
deepest `start=9000` at any category size), and a category whose query dies mid-paging is
recorded in `truncatedCategories` with its chip intact rather than deleted. The remaining truth in
PY-17 is arXiv's own: `RESULTS_CEILING = 30000` with HTTP 400 above it, and the recommendation to
use OAI-PMH for bulk harvesting.

---

## D-3 — IMP-218's title and criterion text already name a stale test count (LOW)

`IMP-218 — Run the 292-test web suite in the deploy build job too` (`.improve/FEATURES.md`, Tier
10.0). The web suite is **293 tests / 20 files** as of this session (`npm test`, 5.84 s) — a
concurrent `web/` agent has added one since the absorber's round. The count appears in the item's
title, in criterion 4's "the measured duration is quoted against the 90-minute job cap", and in
IMP-218's own reference to CI's `web-tests` job. Cheap to amend before IMP-218 is picked up;
worth doing at the same time as §7's two corrections to IMP-216, since both are in the same
backlog edit.

---

## D-4 — `deploy.yml`'s artifact check describes a truncated index as the rare case (LOW, not fixed)

`deploy.yml`'s "Assert the paper index reached the build output" step carries the comment *"A
truncated-but-present index passes, and should: a category that hit its `--max-per-category` cap
records itself in `index.json` under `truncatedCategories` and the site says so on screen."*

The statement is correct and the check is unaffected — `truncatedCategories` is not read by that
step. What changes is its framing: before IMP-216 a truncated index was the exception, and before
IMP-204 it could not exist at all. From this deploy onward it is the **expected shape of every
build** (`cs.AI` sits above the cap, see the impl report §3). I updated the wording to say so in
the same change, because a comment describing the normal path as an aside is the same
documentation defect IMP-216 was filed for. Flagging it here because the reasoning matters more
than the edit: the assertion stays permissive on purpose, and nothing about the check should
become stricter.

---

## D-5 — `arxiv.Client.query_url_format` is the only clean loopback seam, and only in arxiv 2.x (LOW)

**Where:** `/tmp/rpf-imp216/stub_arxiv.py` (IMP-216's criterion-5 harness).

IMP-216 criterion 5 asks for "a local server answering 200 below a chosen `start` and 500 at or
above it", which means redirecting `arxiv.Client` at loopback. The only seam that does this
without patching a private attribute is `Client.query_url_format`, a **public class attribute**
(default `'https://export.arxiv.org/api/query?{}'`) that `_format_url` formats the query string
into. Verified present in the installed **arxiv 2.1.3**. I could not verify it in the 3.0.0 that
`requirements.txt` says CI resolves to, and `verify-IMP-028b.md` notes the Client constructor
differs between the two, so this attribute may well have moved.

That is why criterion 5's reproduction is a **verification harness in `/tmp`, not a committed
test**: committing it would put a possible `AttributeError` into the deploy's own quality gate on
an arxiv version nobody can check here. The repo already has a loopback-server test pattern
(`tests/test_arxiv_common.py` → `BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging`,
which patches `client._session` rather than the URL), so this is a note about *which* seam is
version-stable, not an argument against loopback tests. Whoever maintains the arxiv pin
(`requirements.txt`'s `>=2.1.0,<4`, and IMP-093's 4.x port) should record where this attribute
went; if it is gone in 4.x, every future loopback-arXiv test needs the `_session` route instead.

---

## D-6 — Two IMP-204 boundaries this item did not reopen, recorded so they are not re-litigated (INFO)

IMP-216's Notes say it must not reopen IMP-204's exit-code contract, and it did not. For the
record, the three IMP-204 behaviours that survive unchanged, each with the test that pins it:

| behaviour | pinned by |
| --- | --- |
| every category failing ⇒ exit 1, nothing written | `MainTests.test_refuses_to_write_index_when_every_category_query_fails` (unmodified) |
| a failed category with nothing behind it ⇒ exit 1 | `MainTests.test_a_failed_category_is_still_fatal_when_nothing_else_has_papers` (unmodified) |
| a category that spends its allowance ⇒ `truncatedCategories`, chip kept | `MainTests.test_a_category_that_spends_the_whole_allowance_is_recorded` (unmodified) |

And one thing this item deliberately did **not** change, in case it reads as an oversight later:
`truncatedCategories` is still a **query-level** fact ("the allowance was fully spent", "the query
died"), so a category can in principle be named there while holding no in-window papers — e.g.
`--max-per-category 1` against a category whose only result is out of window. The reconciliation
fixes only the `failed` direction, which is the direction the live defect and criterion 2 are
about. Reconciling the other direction would mean redefining `categories` as "the categories the
index holds papers for", which would drop the chip of any category that had a genuinely quiet
60-day window — a reader-facing loss in exchange for closing a case no reader can reach. Stated
here so the next implementer does not mistake it for an oversight.

---

## D-7 — `readme.md`'s "785 papers" framing contradicts `deploy.yml`'s own comment (LOW, not fixed)

Found while correcting `readme.md`'s false absolute for round 2 (`impl-IMP-216-r2.md`, Defect 1).
This is `verify-IMP-216.md`'s **F1**, still open: round 2 was scoped to three statements and this is
a fourth one, so it was left alone rather than smuggled in.

The same paragraph states two things that do not agree:

* `readme.md:194-196` — "The cap does cost something on a healthy run — `cs.AI` holds more than
  10,000 papers in the shipped 60-day window, so its oldest are dropped, about 785 of 10,785 when
  measured on 2026-10-02". Framed as a loss the cap introduces.
* `.github/workflows/deploy.yml:110-112` — "the papers past the offset used to be unreachable
  anyway". Framed as a shortfall that already existed.

The verifier's measurement settles which is closer to true: pre-fix at cap 30,000 with HTTP 500 at
`start>=10000`, cs.AI put 10,000 papers in the shards; post-fix at cap 10,000, also 10,000, with an
identical id set. The 785 were unreachable before the change too, because arXiv refuses the offset
that would serve them. So the cap costs **zero** papers relative to the live defect, and the readme
overstates the price by 785.

**Why it was not fixed here:** it is a fourth statement in a paragraph this round was told to change
in exactly one place, and the fix requires choosing between "framed as a regression" (misleading) and
"framed as a counterfactual" (needs the arXiv-refuses-that-offset caveat, i.e. a second clause on a
paragraph that is already long). Round 2's own rule was not to touch anything outside the three
named defects.

**Suggested fix for whoever picks it up:** keep the 785 figure (criterion 5 mandates it) but frame it
as the shortfall against the full 60-day window, and note that the papers past the refused offset
were not reachable before the cap either — so the cap buys "never ask again" for no data at all,
while the layer-1/layer-2 fix alone would have produced byte-identical shards. A maintainer reading
`readme.md` in six months should not re-open the cap to "recover" 785 papers that were never
obtainable.