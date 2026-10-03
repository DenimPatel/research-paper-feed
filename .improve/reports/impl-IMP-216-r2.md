# IMP-216 — round 2 (accuracy defects only)

Targeted follow-up to `impl-IMP-216.md` after `verify-IMP-216.md` passed the implementation with
seven findings. **The design was not redesigned.** Three statements in it were inaccurate or
unfalsifiable; those three, and only those three, are fixed here.

Two files changed: `readme.md` and `tests/test_build_index.py`. `scripts/build_index.py` and
`.github/workflows/deploy.yml` were re-read for the offset/paper-count conflation and needed no
edit (§4). No `git restore` / `checkout` / `clean` / `stash` / `add` / `commit` was run. All
mutation work happened in `/tmp/imp216r2/`.

---

## Defect 1 — `readme.md`'s absolute is false

### The finding

`readme.md:199` (before):

> What it buys is that a category is never dropped from the index because of a request arXiv
> declined.

False as an absolute. Verifier probe **X5** — `cs.LG` answers one paper, `cs.AI`'s query is declined
having returned nothing, nothing in the shards carries `cs.AI`:

```
exit=0  categories=['cs.LG']  failedCategories=['cs.AI']  truncatedCategories=[]
```

`cs.AI` **is** dropped from the index because a request arXiv declined. The site then says
"no papers here", which is true — but the readme's unqualified absolute does not describe that case.

### The fix

Narrowed to the invariant the code actually guarantees, and the cross-listing rescue is named
rather than left implicit. `readme.md:199-203` (after):

> What it buys is that a category the published papers carry keeps its chip and its papers —
> including when its own query came back empty and it survives only because another category
> cross-listed into it. A category that no published paper carries is still dropped and reported as
> having none, which is the truth.

### Full paragraph, before → after

BEFORE (`readme.md:196-201`):

```
dropped, about 785 of 10,785 when measured on 2026-10-02 — and the index says so
on screen: a category that hits the cap is recorded in `index.json` under
`truncatedCategories`, keeps its filter chip, and the site reports that its older
papers may be missing. What it buys is that a category is never dropped from the
index because of a request arXiv declined. The comment above the step records the
measurement, the fault it is avoiding, and the page and timeout arithmetic. CI
```

AFTER (`readme.md:196-204`), only the two sentences changed:

```
dropped, about 785 of 10,785 when measured on 2026-10-02 — and the index says so
on screen: a category that hits the cap is recorded in `index.json` under
`truncatedCategories`, keeps its filter chip, and the site reports that its older
papers may be missing. What it buys is that a category the published papers
carry keeps its chip and its papers — including when its own query came back
empty and it survives only because another category cross-listed into it. A
category that no published paper carries is still dropped and reported as
having none, which is the truth. The comment above the step records the
measurement, the fault it is avoiding, and the page and timeout arithmetic. CI
```

Four lines instead of two; still one README-shaped passage, no specification, same voice as the
rest of the paragraph (which already uses em dashes and states costs rather than gesturing at them).

### Why each clause is true

| clause | evidence |
| --- | --- |
| "a category the published papers carry keeps its chip and its papers" | verifier §4c: `held ⊆ {categories carried by written shard papers}`, and `reconcile_failed_categories` only ever **removes** names from `failedCategories`. 0 hollow chips across probes X1–X7. |
| "its own query came back empty and it survives only because another category cross-listed into it" | X1 (`categories[]` cross-list), X2 (`primaryCategory` only), X3 (cross-list on the duplicate `dedupe_records` absorbs). All three end `failedCategories=[]` with the chip present. |
| "A category that no published paper carries is still dropped and reported as having none" | X5 exactly, and X4 (the only carrier has no arXiv id, so `dedupe_records` drops it → `failedCategories=['cs.AI']`). |
| "which is the truth" | with no written paper carrying the category, `failureCopy.ts:103-110` renders "no papers here" / "no filter", which is accurate rather than a loss. |

### Critical re-read — would a reader be misled?

* **Does the new text still promise too much?** No. It no longer claims anything about a category
  whose query failed and which nothing rescued — that case is now stated, not denied. The three
  clauses map 1:1 onto X1–X5.
* **Is "the published papers" ambiguous for a README reader?** It is the index the site is built
  from, which the surrounding paragraph already calls "the index" and "papers … are dropped". A
  reader could conceivably read "published" as "published *to arXiv*". Considered; the index sense
  is the only one in play, since arXiv is the source and not the subject of the drop. Left as is.
* **Does it drop information a maintainer needs?** The "What it buys" role is preserved — the
  sentence still says what the cap buys, just accurately.
* **Consistency with `deploy.yml`?** The step's comment (`:104-118`) makes the same two-way
  distinction (truncated-with-chip vs. deleted) and its F1 framing ("the papers past the offset used
  to be unreachable anyway") is untouched — see §5.

---

## Defect 2 — a failure message named the wrong quantity

### The finding

`tests/test_build_index.py:1438-1444` interpolated `largest_measured_window` (a **paper count**)
into a slot labelled `start=%d, the offset arXiv answered with HTTP 500`, printing
`start=10785`. The refused offset was **`start=10000`**. `10785` is cs.AI's 60-day paper count.

### The fix

The message now names each quantity for what it is, and reports the offset the cap actually reaches
rather than asserting one:

```python
largest_measured_window = 10785  # cs.AI, 60-day window, 2026-10-02
index, lines = self._index_step()
cap = self._cap_on_the_command_line(index, lines)
# The refused offset and the window size are different quantities, so the
# message names each for what it is instead of printing the paper count
# as though it were the offset.
page_size = build_index.arxiv_common.build_client(cap).page_size
deepest = max(
    (start for start, _ in requested_pages(cap, page_size)), default=0
)
self.assertLess(
    cap,
    largest_measured_window,
    "deploy.yml:%d caps at %d papers per category, at or above the largest "
    "measured 60-day window (%d papers), so the cap reaches the page at "
    "start=%d -- the offset arXiv answered with HTTP 500 on 2026-10-02, "
    "DEPLOY_OFFSET_BUDGET (%d)"
    % (
        index + 1,
        cap,
        largest_measured_window,
        deepest,
        build_index.DEPLOY_OFFSET_BUDGET,
    ),
)
```

The **assertion itself is byte-for-byte the same condition** (`cap < largest_measured_window`); only
the message changed, so no coverage moved. `DEPLOY_OFFSET_BUDGET` (`= 10000`) is now the named
offset, and `deepest` is derived from the cap by the same `requested_pages` / `build_client().page_size`
pair the depth test uses, so the printed offset is computed rather than asserted. `default=0` keeps
the message path safe at `cap == 0` (where `max()` over an empty sequence would raise instead of
failing cleanly).

### Non-vacuity, and the message is now right — mutation M1

`deploy.yml` cap `10000 → 10785`, run in `/tmp/imp216r2`:

```
FAIL: test_the_cap_is_measured_against_the_real_window_sizes
AssertionError: 10785 not less than 10785 : deploy.yml:141 caps at 10785 papers per
category, at or above the largest measured 60-day window (10785 papers), so the cap
reaches the page at start=10000 -- the offset arXiv answered with HTTP 500 on
2026-10-02, DEPLOY_OFFSET_BUDGET (10000)
Ran 118 tests in 1.122s
FAILED (failures=3)
```

`start=10000` — the real refused offset — where the old message said `start=10785`. Both counts
kept, both labelled.

### Was the conflation anywhere else? Checked, and no

`.github/workflows/deploy.yml`, every numeric mention (lines 85-141):

* `:89` "returned HTTP 500 at start=10000" — offset, correct.
* `:98` "10,000 makes start=9000 the deepest request" — offsets, correct.
* `:100-101` "9,000 is the deepest offset arXiv is known to have answered and 10,000 the first
  known to be refused" — offsets, correct, and this is the sentence the message now mirrors.
* `:105-107` "cs.AI held **10,785 papers** inside the 60-day window … truncates it by at least 785
  (~7%)" — paper counts, and 785 = 10,785 − 10,000, correct.
* `:120-125` the page arithmetic — "6,742 / 9,723 / 5,213 / 10,785 / 3,275 = **35,738 papers**, which
  is **38 pages of 1,000**. Under this cap cs.AI's 11th page is never asked for, so a healthy deploy
  pages **37**" — page counts derived from paper counts, with the page/offset boundary stated. No
  conflation; **no edit needed**. `37 × 1,000 = 37,000 ≤ 35,738`? No — the correct reading is 38
  pages to cover 35,738 and 37 to cover 35,738 minus cs.AI's 11th page, which is what the comment
  says; the verifier re-derived `37 × 70 s + 1800 s = 4390 s` and confirmed it.

`tests/test_build_index.py`, every other numeric mention: `:1354` (`start=10000`, correct),
`:1410-1411` ("cs.AI at 10,785 **papers** … needs a page at `start=10000`, which is the offset",
correct — the two quantities are already distinguished in the prose), `:1418` ("10,785 − 10,000 =
785", paper arithmetic, correct), `:1434` (comment labels 10785 "60-day window"), `:702`/`:705` and
`test_arxiv_common.py:127`/`:135` (a 100000 *cap*, unrelated). **No other edit needed.**

---

## Defect 3 — an unfalsifiable assertion, replaced with two real pins

### The finding

```python
self.assertNotEqual(
    build_index.arxiv_common.DEFAULT_NUM_RETRIES,   # 5
    build_index.DEPLOY_OFFSET_BUDGET,              # 10000
    ...
)
```

Two unrelated constants from two modules. `assertNotEqual(5, 10000)` cannot fail; it asserts
nothing while implying the two are related, which is exactly the confusion IMP-205 exists to end.

### The fix — removed, and replaced with what the test's name actually promises

The test is named `test_raising_the_retries_does_not_stand_in_for_a_depth_bound`. The true
statement behind that name is: **retries cannot be raised to cover a deep-offset 5xx, because there
is nowhere to raise them.** The retry lever is not declined on its merits, it does not exist as a
dial. So:

```python
    def test_raising_the_retries_does_not_stand_in_for_a_depth_bound(self):
        # The other half of criterion 3. ``DEFAULT_NUM_RETRIES`` is the lever
        # that looks available and is not: the fault is persistent at the
        # offset and the offset is a function of how many in-window papers a
        # category holds, so arXiv invalidates any pinned number over time and
        # more attempts at a refused offset only cost minutes. What makes it
        # unanswerable rather than merely unattractive is that there is nowhere
        # to turn the dial: the builder exposes no retry option and the deploy
        # passes none, so the attempt count can only change at its source.
        self.assertEqual(build_index.arxiv_common.DEFAULT_NUM_RETRIES, 5)
        options = sorted(vars(build_index.parse_args([])))
        retry_options = [name for name in options if "retr" in name]
        self.assertEqual(
            retry_options,
            [],
            "build_index.py grew a retry option (%s); the attempt count is a "
            "module constant precisely because a per-run dial invites trading "
            "minutes for the deep-offset 5xx that more attempts cannot fix"
            % ", ".join(retry_options),
        )
        index, lines = self._index_step()
        retry_flags = [
            token
            for token in lines[index].split()
            if token.startswith("-") and "retr" in token
        ]
        self.assertEqual(
            retry_flags,
            [],
            "deploy.yml:%d passes a retry flag (%s); a refused deep offset does "
            "not answer on a retry, so the attempt count must not become a "
            "deploy-time dial standing in for the depth bound"
            % (index + 1, ", ".join(retry_flags)),
        )
```

`assertNotEqual` is **gone**. Two new pins replace it, each stating something that can be false:

1. `parse_args([])` exposes no destination whose name contains `retr` — the builder has no retry
   knob, so the only way to change the attempt count is to edit the module constant.
2. The deploy's `run:` line passes no flag containing `retr` — the deploy cannot raise retries at
   the command line.

The `DEFAULT_NUM_RETRIES == 5` pin is kept verbatim; it was already real and is not what the finding
was about.

`"retr"` is the substring shared by `retry`, `retries` and `num_retries` and **absent** from
`retention` (`retention_days`, `--retention-days`) — mutation M4 proves that choice is not a false
positive. This is deliberate: it is the same discriminator a human uses to tell a retry flag from a
retention flag, and it cannot be defeated by renaming the flag.

### Non-vacuity — four mutations, all in `/tmp/imp216r2/`

**M5 — add `--retries` to `scripts/build_index.py`'s parser.** Red, and the *only* red test:

```
FAIL: test_raising_the_retries_does_not_stand_in_for_a_depth_bound
AssertionError: Lists differ: ['retries'] != []
- ['retries']
+ [] : build_index.py grew a retry option (retries); the attempt count is a module
constant precisely because a per-run dial invites trading minutes for the
deep-offset 5xx that more attempts cannot fix
Ran 118 tests in 1.135s
FAILED (failures=1)
```

**M5b — same with `--num-retries`** (proves the check is not keying on one spelling):

```
AssertionError: Lists differ: ['num_retries'] != []
Ran 118 tests in 1.105s
FAILED (failures=1)
```

**M3 — add `--retries 9` to the deploy's `run:` line in `deploy.yml`.** Red, alone:

```
FAIL: test_raising_the_retries_does_not_stand_in_for_a_depth_bound
AssertionError: Lists differ: ['--retries'] != []
- ['--retries']
+ [] : deploy.yml:141 passes a retry flag (--retries); a refused deep offset does not
answer on a retry, so the attempt count must not become a deploy-time dial standing in
for the depth bound
Ran 118 tests in 1.133s
FAILED (failures=1)
```

**M4 — add `--retention-days 60` to the same `run:` line.** Green — the assertion is specific, not
a blanket ban on `ret`-looking flags:

```
Ran 118 tests in 1.115s
OK
```

**M6 — `DEFAULT_NUM_RETRIES = 5 → 8`.** Red, and the retained pin is in the set:

```
FAIL: test_build_client_keeps_the_arxiv_pacing_parameters_pinned (test_arxiv_common...)
FAIL: test_no_workflow_cap_is_tighter_than_the_client_worst_case (test_arxiv_common...)
FAIL: test_raising_the_retries_does_not_stand_in_for_a_depth_bound (test_build_index.DeployStepCommandTests...)
FAIL: test_the_index_step_outlasts_a_whole_pipeline_failure (test_build_index.DeployStepTimeoutTests...)
AssertionError: 2700 != 1800
Ran 118 tests in 1.126s
FAILED (failures=4)
```

### A first attempt at this fix was wrong, and M3 caught it

The initial version of the deploy-line assertion was a regex,
`r"--(?:num-)?ret(?:ry|ies)\b"`. It **silently matched nothing**: `--retries` is `retr` + `ies`, not
`ret` + `ies`. Under M3 the suite came back `Ran 118 tests / OK` — a green run for a broken
assertion, which is the failure mode this whole defect is about. The substring form was adopted
instead because it cannot be defeated by spelling, and M3 was re-run until it was red. Quoted here
because the red output below is only meaningful given that the green one happened first.

---

## 4. Gate

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 118 tests in 1.113s
OK
```

118 tests, OK, 1.11 s — unchanged count and runtime from `verify-IMP-216.md`'s baseline
(118 / 1.096 s). No test removed, renamed, skipped or `expectedFailure`-marked;
`grep -c "    def test_"` on `tests/test_build_index.py` is 69, the same as before this round.

```
$ cd web && npm run typecheck
> tsc --noEmit
(clean)

$ cd web && npm test
 Test Files  20 passed (20)
      Tests  293 passed (293)
   Duration  7.61s

$ cd web && npm run build
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:   0.51 kB
dist/assets/index-DLsgZ6xw.css   10.91 kB │ gzip:   2.86 kB
dist/assets/index-Cz853rdl.js   172.50 kB │ gzip:  55.22 kB
✓ built in 543ms
```

`web/` untouched: `git status --porcelain --untracked-files=all -- web/` → empty.

### Hermetic — re-proven, not assumed

Same approach as the verifier: `socket.socket.connect`, `socket.create_connection`,
`socket.getaddrinfo` and `urllib.request.urlopen` replaced by blockers, whole suite re-run.

```
tests=118 failures=1 errors=0 BLOCKED_NETWORK_CALLS=1
RED: test_arxiv_common.BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging
```

The single failure is the verifier's **pre-existing** loopback test, which binds `127.0.0.1`
deliberately (`tests/test_arxiv_common.py:229-250`). No test reaches arXiv. The two things this
round added that touch new inputs are `parse_args([])` (pure argparse, no I/O) and the run-line
token scan (a string split of a file the suite already reads).

---

## 5. Not done here, on purpose

* **F1** (`readme.md:194-196` frames the 785 as a fresh loss while `deploy.yml:111` says the papers
  past the offset "used to be unreachable anyway") is a *different* finding from the three this round
  was scoped to, and fixing it would move a second sentence of the same paragraph. Left alone; the
  internal inconsistency is real and is now recorded in `discovered-IMP-216.md` as **D-7** so it is
  not lost.
* **F5** (`failureCopy.ts` tells a cross-listing-rescued category it was "cut off at this index's
  per-category limit") — `web/` is out of scope and the sentence is spec-mandated. Recorded by the
  verifier.
* **F6** (stale `REPO_PROFILE.md` PY-17) — already disclosed as **D-2**, owned by IMP-195.
* **F7** (the `FEATURES.md` attribution in `impl-IMP-216.md` §9) — a report-bookkeeping inaccuracy;
  `.improve/FEATURES.md` was not touched in this round, per instructions.
* The moved cap assertion remains logically implied by the depth test (verifier §3 nuance). That is
  redundancy, not vacuity, and re-ordering the two is not one of the three defects.

## 6. Files touched

| file | change |
| --- | --- |
| `readme.md` | Defect 1: two sentences at `:199-203`. |
| `tests/test_build_index.py` | Defect 2: the failure message at `:1453-1474`. Defect 3: `assertNotEqual` removed, two pins added at `:1389-1421`. |
| `.improve/reports/impl-IMP-216-r2.md` | this report (new) |
| `.improve/reports/discovered-IMP-216.md` | one appended entry (D-7) |

`scripts/build_index.py` and `.github/workflows/deploy.yml`: **read, not changed.**

Evidence: `/tmp/imp216r2/` (mutation tree, verified identical to the repo afterwards with
`diff -r -x '__pycache__'`).