# IMP-042 — `dedupe_records` must not mutate its caller's input

**Status:** implemented, uncommitted in the working tree, awaiting verification.
**Files touched by this item:** `scripts/build_index.py`, `tests/test_build_index.py`,
`.improve/FEATURES.md` (this item's `Status`/`Area`/`Notes`), `.improve/reports/impl-IMP-042.md`,
`.improve/reports/discovered-IMP-042.md`.

`git status --short` also shows `M web/src/components/PaperCard.tsx` and
`M web/src/components/__tests__/PaperCard.test.tsx`. **Those are a concurrent agent's work
(IMP-219), not this item's.** Nothing under `web/` or `.github/` was read, written or run for
this fix.

---

## 1. Root cause

`dedupe_records` (`scripts/build_index.py:180-202`) built its working copy of a first-seen record
with a **shallow** `dict(record)`. Every value is therefore shared with the caller's record by
identity, including `categories`, which is the one mutable value the merge writes to:

```python
existing = merged.get(paper_id)
if existing is None:
    merged[paper_id] = dict(record)      # :190 — shallow
    order.append(paper_id)
    continue
seen = set(existing.get("categories", []))          # :197
for category in record.get("categories", []):
    if category not in seen:
        existing.setdefault("categories", []).append(category)   # :200 — appends to the CALLER's list
```

`merged[paper_id]["categories"] is record["categories"]`, so the union at `:200` appends into the
input record's own list.

Reproduced before the fix (`/tmp/repro-042.py`, loading the module by path the same way the test
suite does):

```
input after: [['cs.CV', 'cs.LG'], ['cs.LG']]
before    : [['cs.CV'], ['cs.LG']]
output    : [{'id': 'A', 'categories': ['cs.CV', 'cs.LG'], 'authors': ['x']}]
output categories is a's list? True
input mutated: True
```

Exactly what recon reported, including the identity check.

**Why it was invisible.** `main` is the only production caller (`scripts/build_index.py:602`,
`records = dedupe_records(records)`) and it overwrites `records` with the return value, so the
mutated input was discarded unread — the written index was never wrong. `dedupe_records` is,
however, a public helper of a module whose docstring (`build_index.py:11-13`) says its pure
helpers exist to be testable and reusable, and the two pre-existing tests asserted only on the
output.

---

## 2. The fix

`scripts/build_index.py:180-202` — the first-seen copy clones `categories`, and the docstring records
why:

```python
def dedupe_records(records):
    """Deduplicate by arXiv ID, unioning categories and keeping first metadata.

    The union appends into ``categories``, so the first-seen record's copy of
    that list is cloned: the caller's records come back exactly as they went in.
    """
    merged = {}
    order = []
    for record in records:
        paper_id = record.get("id")
        if not paper_id:
            continue
        existing = merged.get(paper_id)
        if existing is None:
            first = dict(record)
            if "categories" in first:
                first["categories"] = list(first["categories"])
            merged[paper_id] = first
            order.append(paper_id)
            continue
```

Three decisions, each of which is the smallest option that satisfies criterion 1:

1. **Clone `categories`, do not `copy.deepcopy(record)`.** `categories` is the only value this
   function writes to. `authors` (the other list field) is shared between input and output copies
   but never mutated here, so cloning it would be work with no defect behind it — and a deep copy
   would also make the helper start raising on any record carrying a non-copyable value, which the
   plain-dict wire shape does not promise.
2. **The clone goes on the first-seen copy only.** That is the only record the union can reach: the
   loop only falls through to the union when `merged` already holds the id, so later records are
   read and never stored.
3. **Guard the clone with `if "categories" in first`** instead of writing
   `{**record, "categories": list(record.get("categories") or [])}`. The unconditional form adds an
   empty `categories` key to any record that arrived without one — the old code reached `setdefault`
   for precisely that case, so the output shape changed. No acceptance criterion asks for that, and
   the record shape is the wire format (`build_index.py` ↔ `web/src/lib/types.ts`), so it is left
   alone.

**The output is bit-for-bit unchanged** — same keys, same order, same values, same list contents.
Consequently the shards and manifest `build_shards` writes are identical and `dedupe_records`' only
observable behaviour change is that the input survives the call.

---

## 3. Acceptance criteria

| # | Criterion | Met | Evidence |
| --- | --- | --- | --- |
| 1 | After `dedupe_records(records)`, every input record's `categories` list is byte-for-byte what it was before the call | yes | `/tmp/repro-042.py` after the fix: `input after: [['cs.CV'], ['cs.LG']]` / `before: [['cs.CV'], ['cs.LG']]` / `output categories is a's list? False`. Pinned permanently by the new test. |
| 2 | A new test in `tests/test_build_index.py` asserts the input list is unchanged after a cross-listed merge | yes | `DedupeRecordsTests.test_merge_does_not_mutate_input_records`, `tests/test_build_index.py:166-182` |
| 3 | `test_merges_cross_listed_papers_by_id` and `test_preserves_first_seen_metadata` still pass unchanged | yes | Both are byte-identical to before (`git diff` touches only the added method). `/usr/local/bin/python3.11 -m unittest discover -s tests -v -k DedupeRecords` → 3 tests, `OK`. |

---

## 4. Commands and results

Run from the repository root.

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests          # BEFORE
Ran 118 tests in 1.105s
OK
```

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests          # AFTER
Ran 119 tests in 1.122s
OK
```

**118 → 119 tests, all green, one added and none removed, weakened, skipped or
`expectedFailure`-marked.** Wall time unchanged (1.105 s → 1.122 s; the profile's "~1.1 s" holds).

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v -k DedupeRecords
test_merge_does_not_mutate_input_records (test_build_index.DedupeRecordsTests.test_merge_does_not_mutate_input_records) ... ok
test_merges_cross_listed_papers_by_id (test_build_index.DedupeRecordsTests.test_merges_cross_listed_papers_by_id) ... ok
test_preserves_first_seen_metadata (test_build_index.DedupeRecordsTests.test_preserves_first_seen_metadata) ... ok

----------------------------------------------------------------------
Ran 3 tests in 0.000s

OK
```

```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests;  echo "compileall exit=$?"
compileall exit=0
```

No web command was run: nothing under `web/` changed, and the Python suite is the only gate that
covers this item (REPO_PROFILE §4.3). No network test was added — the new test is pure data in,
pure data out. No dependency was added; `requirements.txt` is untouched.

---

## 5. Non-vacuity

### 5a. Reverting the fix turns the suite red

A `/tmp` scratch copy built from the committed tree (`git archive HEAD | tar -x -C /tmp/imp042`),
with only the new test file copied in, so `scripts/build_index.py` is HEAD's unfixed
`merged[paper_id] = dict(record)` at `:190`:

```
$ grep -n "merged\[paper_id\] = " /tmp/imp042/scripts/build_index.py
190:            merged[paper_id] = dict(record)

$ cd /tmp/imp042 && /usr/local/bin/python3.11 -m unittest discover -s tests
['cs.CV', 'cs.LG', 'cs.AI']
['cs.CV']

- [['cs.CV', 'cs.LG', 'cs.AI'], ['cs.LG'], ['cs.LG', 'cs.AI']]
?          ------------------

+ [['cs.CV'], ['cs.LG'], ['cs.LG', 'cs.AI']]

----------------------------------------------------------------------
Ran 119 tests in 1.137s

FAILED (failures=1)
```

The message names the defect: the input's first record now carries the unioned
`['cs.CV', 'cs.LG', 'cs.AI']` where it was `['cs.CV']`. **Exactly one** failure — the new test —
so no existing test had to be touched to make it red.

Copying the fixed file back in and re-running the same command:

```
$ cp .../scripts/build_index.py /tmp/imp042/scripts/build_index.py
$ cd /tmp/imp042 && /usr/local/bin/python3.11 -m unittest discover -s tests
----------------------------------------------------------------------
Ran 119 tests in 1.107s

OK
```

Green again, and the real tree is green too (§4).

### 5b. The test is not satisfiable by a function that does no work

The obvious failure mode of a mutation test is that it passes against an implementation that simply
stopped mutating because it stopped doing anything. A second `/tmp` copy (`/tmp/imp042b`) had
`dedupe_records` replaced wholesale by a vacuous stand-in —

```python
def dedupe_records(records):
    """Vacuous stand-in: copies every record, merges nothing."""
    return [dict(record) for record in records]
```

— leaving the fixed source and the new test in place:

```
$ cd /tmp/imp042b && /usr/local/bin/python3.11 -m unittest discover -s tests -k DedupeRecords
FF.
======================================================================
FAIL: test_merge_does_not_mutate_input_records (test_build_index.DedupeRecordsTests.test_merge_does_not_mutate_input_records)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/private/tmp/imp042b/tests/test_build_index.py", line 177, in test_merge_does_not_mutate_input_records
    self.assertEqual(len(merged), 2)
AssertionError: 3 != 2

======================================================================
FAIL: test_merges_cross_listed_papers_by_id (test_build_index.DedupeRecordsTests.test_merges_cross_listed_papers_by_id)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "/private/tmp/imp042b/tests/test_build_index.py", line 152, in test_merges_cross_listed_papers_by_id
    self.assertEqual(len(merged), 2)
AssertionError: 3 != 2

----------------------------------------------------------------------
Ran 3 tests in 0.003s

FAILED (failures=2)
```

The input-unchanged assertion alone would have passed against that stub, so the test also pins the
merge itself (`len(merged) == 2`, and `merged[0]["categories"] == ["cs.CV", "cs.LG", "cs.AI"]`) plus
the aliasing (`assertIsNot(merged[0]["categories"], records[0]["categories"])`). The new test cannot
be satisfied by a no-op.

Both scratch trees live in `/tmp` and are throwaway; nothing was restored, staged or committed in
the real repository.

---

## 6. Spec accuracy

**No acceptance criterion failed, and no criterion needed rewriting.** Two inaccuracies in the
spec's supporting text, both corrected in place in `.improve/FEATURES.md`'s Area line rather than
argued about in prose:

- The cited `scripts/build_index.py:127` and `:130-134` are stale. IMP-216 added ~70 lines above
  this function, so the shallow copy was at `:190` and the union append at `:197-200`.
- `tests/test_build_index.py:92-112` is stale too; `DedupeRecordsTests` is at `:144-182`.

The spec's Intent, its reproduction, and its claim that the defect "is idempotent in the one place
it is used today" are all confirmed by execution, not just accepted.

---

## 7. Uncertainty

- **Residual aliasing, deliberately left.** After this fix the output record still shares `authors`
  (and any other mutable value a caller put in a record) with the input record. `dedupe_records`
  never writes to those, so no defect is reachable today, but a future edit that mutated another
  field would reopen the same bug. Not fixed here because no acceptance criterion asks for it and
  cloning every field is the larger, speculative change. Recorded as **D-1** in
  `.improve/reports/discovered-IMP-042.md`.
- The `if "categories" in first` guard is exercised by neither the new test nor any existing one;
  a record with no `categories` key has no test anywhere in the suite. That path is unchanged from
  before this item (`setdefault` still creates the key on the copy, and the copy is no longer the
  caller's list), so the guard is behaviour-preserving — but it is untested, and this report does
  not claim otherwise.
- The concurrent `web/` edits in the working tree mean the tree-wide `git diff` contains changes
  that are not mine. My diff is the two Python files, reproducible with
  `git diff -- scripts/build_index.py tests/test_build_index.py`.