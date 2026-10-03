# Verify — IMP-042 — `dedupe_records` must not mutate its caller's input

**Verdict: PASS** (all three acceptance criteria met, proven by execution). Three advisory
items, none blocking, listed in §8. I did not accept any of the implementer's assertions on
report; every number below was re-measured.

Verifier: independent. No board tools used. Nothing in the working tree was restored, stashed,
cleaned or checked out — every destructive experiment ran in a `/tmp` copy built from
`git archive HEAD`.

---

## 1. What actually changed

```
$ git diff --numstat
3	3	.improve/FEATURES.md
9	2	scripts/build_index.py
17	0	tests/test_build_index.py
14	0	web/src/components/PaperCard.tsx
9	4	web/src/components/__tests__/PaperCard.test.tsx
```

IMP-042 owns the first three rows. **The two `web/` rows are IMP-219's, not this item's** — the
diff is `formatDate` gaining `timeZone: "UTC"` plus the test tightening
`toContain("2024")` → `toBe("Jan 2, 2024")`, and the new test comment opens with `IMP-219:`
(`web/src/components/__tests__/PaperCard.test.tsx:33`). `impl-IMP-219.md:84-85` claims exactly
those two changes. **IMP-042 did not touch `web/`** — the claim in
`impl-IMP-042.md:8-11` holds.

The source change, in full (`scripts/build_index.py:180-205`):

```python
 def dedupe_records(records):
-    """Deduplicate by arXiv ID, unioning categories and keeping first metadata."""
+    """Deduplicate by arXiv ID, unioning categories and keeping first metadata.
+
+    The union appends into ``categories``, so the first-seen record's copy of
+    that list is cloned: the caller's records come back exactly as they went in.
+    """
     merged = {}
     order = []
     for record in records:
         paper_id = record.get("id")
         if not paper_id:
             continue
         existing = merged.get(paper_id)
         if existing is None:
-            merged[paper_id] = dict(record)
+            first = dict(record)
+            if "categories" in first:
+                first["categories"] = list(first["categories"])
+            merged[paper_id] = first
             order.append(paper_id)
             continue
```

Scope, style, hygiene:

- No scope creep: no signature change, no behaviour change outside `dedupe_records`, no
  reformatting of neighbouring code (the diff is 9 added / 2 removed lines, 3 of which are
  docstring). REPO_PROFILE §5.2 "**Do not mass-reformat**" is satisfied.
- No linter is configured for Python (REPO_PROFILE §7 PE-6 / §3.3), so there is no lint gate to
  run; `git diff --check` reports no whitespace errors.
- No debug leftovers: a scan of every added line for `print(`, `breakpoint`, `pdb`, `TODO`,
  `FIXME`, `XXX`, `sleep`, `assert False` returns nothing.
- No secrets, no new dependency: `git diff --name-only | grep -E "requirements|package|lock|
  workflow|\.github"` → no match. `requirements.txt` and `web/package.json` untouched.
- Test conventions (§5.2) followed: `unittest.TestCase`, `test_<behavior>_<expectation>`
  (`test_merge_does_not_mutate_input_records`), reuses the existing `make_record` fixture, no
  new import, no `tempfile` needed.

---

## 2. Acceptance criteria, one at a time

### Criterion 1 — "After `dedupe_records(records)`, every input record's `categories` list is byte-for-byte what it was before the call."

**Met.** Proven three ways.

(a) The new test, run in the real tree:

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v -k DedupeRecords
test_merge_does_not_mutate_input_records ... ok
test_merges_cross_listed_papers_by_id ... ok
test_preserves_first_seen_metadata ... ok
Ran 3 tests in 0.000s
OK
```

(b) A `copy.deepcopy` before/after comparison over four inputs — including nested mutable
fields the shipped shape never has, and a caller that shares one `categories` list and one
`authors` list between two of its own records (`/tmp/imp042-verify/probe_alias.py`):

```
A. published shape only (id/title/authors/categories/...), duplicate id
   input mutated by dedupe_records (deep compare): NO
B. nested mutable fields (meta dict holding a list, tags list, set, bytearray)
   input mutated by dedupe_records (deep compare): NO
C. caller shares one categories list and one authors list across records
   input mutated by dedupe_records (deep compare): NO
D. record with no 'categories' key at all
   input mutated by dedupe_records (deep compare): NO
```

The D probe also confirms the `if "categories" in first` guard preserves the old shape: input
`{'id': 'A', 'authors': ['a']}` + duplicate with `categories` returns
`{'id': 'A', 'authors': ['a'], 'categories': ['cs.LG']}` — a key added by the pre-existing
`setdefault`, on the copy, exactly as before this item.

(c) §5 below: reverting the fix turns that test red.

### Criterion 2 — "A new test in `tests/test_build_index.py` asserts the input list is unchanged after a cross-listed merge."

**Met.** `tests/test_build_index.py:166-182`,
`DedupeRecordsTests.test_merge_does_not_mutate_input_records`. It snapshots
`[record["categories"] for record in records]` before the call and compares after, so the
assertion covers **every** input record, not just the first — confirmed by mutant M6 in §5,
which moves the mutation onto the duplicate record and goes red.

### Criterion 3 — "`test_merges_cross_listed_papers_by_id` and `test_preserves_first_seen_metadata` still pass unchanged."

**Met.** `git diff -- tests/test_build_index.py` touches only added lines (`17	0`, no
deletions); both methods are byte-identical to HEAD, and both pass. Suite total 118 → 119 with
one addition and no removal, skip, or `expectedFailure`
(`tests/test_build_index.py` test-method count 69 → 70; 21 + 70 + 28 = 119 across the three
files).

---

## 3. Does it change behaviour for existing callers?

`dedupe_records` has exactly one production caller, and I ran the real index-building path in
both trees rather than reasoning about it:

```
$ grep -rn "dedupe_records" scripts/          # build_index.py:609 is the only call site
$ /usr/local/bin/python3.11 driver.py /tmp/imp042-base/scripts/build_index.py  out-base
$ /usr/local/bin/python3.11 driver.py /tmp/imp042-fixed/scripts/build_index.py out-fixed
base  exit 0  INFO:root:Wrote 4 papers across 3 shards to .../out-base
fixed exit 0  INFO:root:Wrote 4 papers across 3 shards to .../out-fixed
```

`driver.py` stubs `collect_papers` with a 10-record corpus (cross-listed duplicates, a pure
duplicate, a cross-week pair, an id-less record, an undated record), calls the real
`main(["--out-dir", ...])`, and prints a canonical JSON report: the isolated `dedupe_records`
output, the caller's input `categories` afterwards, the exit code, and the sha256 + bytes of
every file written. Comparing the two reports key by key:

```
keys equal: True
  dedupe_isolated: IDENTICAL
  exit_code: IDENTICAL
  input_categories_after_call: DIFFERS
  written: IDENTICAL
```

and the written index:

```
base   index.json  sha256=2d83e589985091c7 bytes=609
fixed  index.json  sha256=2d83e589985091c7 bytes=609
base   papers-2023-W52.json sha256=8074a90e470c3f8c bytes=397
fixed  papers-2023-W52.json sha256=8074a90e470c3f8c bytes=397
base   papers-2024-W02.json sha256=056071d26af565e4 bytes=711
fixed  papers-2024-W02.json sha256=056071d26af565e4 bytes=711
base   papers-2024-W06.json sha256=1f14ac6e5522d385 bytes=387
fixed  papers-2024-W06.json sha256=1f14ac6e5522d385 bytes=387
```

**Every byte of the shipped index is unchanged**, manifest included. The single difference in
the whole report is the defect itself:

```
base  input_categories_after_call: [['cs.CV', 'cs.LG', 'cs.AI'], ['cs.LG'], ['cs.LG', 'cs.AI']]
fixed input_categories_after_call: [['cs.CV'], ['cs.LG'], ['cs.LG', 'cs.AI']]
```

Nothing depended on the old aliasing. `main` (`scripts/build_index.py:609`) rebinds `records`
to the return value, so the mutated input was discarded unread; `build_shards` sorts a list it
builds itself and mutates no record field; `write_index` is `json.dump`. A grep of every
mutating operation in `scripts/build_index.py` (`.append`, `.extend`, `.sort`, `.update`,
`.pop`, `.remove`, `.insert`, `.setdefault`) shows the only writes into a record dict are
`dedupe_records:198/203`, `build_shards:221` (its own group list) and `:227` (its own list).

---

## 4. Alias probe: the returned records still share the caller's other mutables

**Result: the fix closes the mutation channel, but the output records are still shallow copies.**
Writing through the output aliases mutates the caller's input:

```
A. published shape only
   out['2401.00001']['authors']  <-- same list object as input['2401.00001']['authors']
   after writing to the OUTPUT records, input records that changed:
     records[0] id=2401.00001: authors=['Ada', 'WRITTEN-THROUGH-OUTPUT']
B. nested mutable fields
   out['A']['authors'] / out['A']['blob'] / out['A']['flags'] / out['A']['meta']  <-- all shared
   records[0] id=A: authors=['Ada','WRITTEN-THROUGH-OUTPUT']
                meta={'tags': ['t1','WRITTEN-THROUGH-OUTPUT'], ...}
C. caller shares one list across records
   out['A']['authors'] and out['B']['authors'] are the same object, and the caller's
   records[0] and records[1] change together
```

**I do not treat this as a defect in this item, and I checked the question the brief asks
rather than assuming the answer.** Reasons, all evidence-backed:

1. **The mutation channel is closed.** `dedupe_records` writes to exactly one field
   (`categories`, `:203`), and that field is now cloned on the only record the union can reach
   (the first-seen one — the loop only falls through to the union when `merged` already holds
   the id). The deep-compare in §2(b) is `NO` on all four probe inputs, including nested
   mutables and shared lists. No input reaches this function mutated.
2. **The surviving alias is read-only from the function's side.** `dedupe_records` never writes
   `authors`, so nothing in the shipped code mutates the caller's records through it. The
   write-back in the probe is the *caller* writing into its own list through a handle it kept —
   a different failure mode from the one this item closed, and not reachable in this repo (the
   only production caller discards the input, §3).
3. **No criterion asks for it.** Criterion 1 names `categories` explicitly, and REPO_PROFILE
   §5.2 pins the record as a plain `dict` literal whose shape lives in `record_from_result`;
   cloning every field is a strictly larger change than the item asks for.
4. **It was disclosed, not hidden.** `discovered-IMP-042.md:5-22` (D-1) states the residual
   aliasing, says no defect is reachable, and names `copy.deepcopy` as the honest fix if a
   maintainer wants the wider invariant. `impl-IMP-042.md:271-276` repeats it under
   "Uncertainty".

The real cost is not the alias itself but that **the new test cannot see it** — see M3b in §5.

---

## 5. Non-vacuity — reproduced, not accepted

Six mutants, each built in its own `/tmp` tree from `git archive HEAD` plus the item's test
file, then run with `/usr/local/bin/python3.11 -m unittest discover -s tests`:

| # | Mutation | Suite | Note |
| --- | --- | --- | --- |
| M1 | **Revert the fix** (HEAD's `merged[paper_id] = dict(record)` at `:190` + the new test) | `Ran 119 tests in 1.101s` / **`FAILED (failures=1)`** | red, exactly one failure |
| M2 | **Do no work**: `return [dict(record) for record in records]` | `Ran 119 tests` / **`FAILED (failures=2)`**, `AssertionError: 3 != 2` | red |
| M3 | Reintroduce the mutation on the **duplicate** record's input list (`record["categories"].append(category)`) | **`FAILED (failures=2)`** | red — the test is sensitive on any record |
| M3b | Keep the clone, but also union `authors` through the alias | **`OK` (119 passed)** | **green but wrong** — see below |
| M4 | `return [merged[paper_id] for paper_id in sorted(order)]` | **`OK`** | green but wrong (order contract unpinned) |
| M5 | Unconditional clone: `first["categories"] = list(first.get("categories") or [])` | **`OK`** | green but wrong (adds an empty key where the shape had none) |

M1's failure, verbatim:

```
+ [['cs.CV'], ['cs.LG'], ['cs.LG', 'cs.AI']]
...
- [['cs.CV', 'cs.LG', 'cs.AI'], ['cs.LG'], ['cs.LG', 'cs.AI']]
Ran 119 tests in 1.101s
FAILED (failures=1)
```

M2's failure, verbatim:

```
FAIL: test_merge_does_not_mutate_input_records (test_build_index.DedupeRecordsTests.test_merge_does_not_mutate_input_records)
  File ".../tests/test_build_index.py", line 177, in test_merge_does_not_mutate_input_records
    self.assertEqual(len(merged), 2)
AssertionError: 3 != 2

FAIL: test_merges_cross_listed_papers_by_id ...
    self.assertEqual(len(merged), 2)
AssertionError: 3 != 2

Ran 3 tests in 0.001s
FAILED (failures=2)
```

Both claims in `impl-IMP-042.md` §5a/§5b reproduce exactly, including `3 != 2` at line 177 and
the `failures=1` count for the revert.

**M3b is the "different mutation that keeps the test green but should not" the brief asked for.**
It is a one-line edit of the shipped function — the exact shape of a plausible future change
("also union the authors") — and the full 119-test suite stays green while the caller's input
is provably corrupted:

```python
# added inside the same loop, after the categories union:
for author in list(record.get("authors", [])):
    if author not in existing["authors"]:
        record["authors"].append(author)      # writes into the CALLER's list
```

```
caller input authors after call : [['Ada'], ['Bob', 'Bob']]
caller input categories after   : [['cs.CV'], ['cs.LG']]
MUTATES THE CALLER INPUT        : True
suite: Ran 119 tests / OK
```

Two things make it invisible: the new test asserts only on `categories`, and every fixture goes
through `make_record`, which hard-codes `authors: ["A"]` (`tests/test_build_index.py:64`), so no
test in the suite contains two records for one id with different authors. This is the practical
cost of the field-specific clone and of the field-specific test — see §8. It does not make the
current code wrong (§2, §4); it makes the regression net field-shaped. (An earlier, sloppier
version of M3 that iterated the list it was appending to hung forever at `:206`; that hang was
my mutant's bug, not the shipped code's, and I rebuilt it as M3b.)

---

## 6. The `.improve/FEATURES.md` edit

**The acceptance criteria were not touched.** Diffed field by field, HEAD vs working tree:

| Line | HEAD | Working tree |
| --- | --- | --- |
| `Status:` | `TODO` | `DONE` |
| `Category:` / `Type:` / `Intent:` / `Acceptance criteria:` 1-3 / `Verification method:` / `Effort,Risk` / `Depends on:` / `Priority score` | — | **byte-identical** |
| `Area / files:` | `build_index.py:127` … `:130-134`, `tests/test_build_index.py:92-112` | corrected citations |
| `Notes:` | empty | the implementation's findings |

All three criteria are character-for-character unchanged: criterion 1 still names
`categories`, criterion 2 still demands a test asserting the input list is unchanged, criterion
3 still names both pre-existing tests. Nothing was relaxed, reworded, merged or dropped.

File integrity, per STATE.md rule 10 (count headings, assert uniqueness, assert all ten
mandatory fields):

```
headings: 216   unique: 216   duplicate ids: none
all ten mandatory fields present in every one of the 215 item blocks
(the single "missing" hit is a "Tier" heading, not an item)
HEAD      headings 216 unique 216  {'DONE': 42, 'NEEDS-HUMAN': 8, 'TODO': 166}
WORKTREE  headings 216 unique 216  {'DONE': 43, 'NEEDS-HUMAN': 8, 'TODO': 165}
```

Exactly one status transition, `TODO → DONE`, which is this item. No item lost, none duplicated.

**The correction was warranted — and two of the new numbers are wrong** (see §8.1):

| Citation in the edited Area line | Actual | Verdict |
| --- | --- | --- |
| `build_index.py:190` was the shallow copy (pre-item) | HEAD `:190` ✓ | correct |
| union append at `:197-200` (pre-item) | HEAD `:194-197` (append at `:196`); worktree `:201-204` (append `:203`) | **wrong** |
| `build_index.py:180-202` (`dedupe_records`) | `:180-205` — the `return` is at `:205` | **off by 3** |
| `tests/test_build_index.py:144-182` (`DedupeRecordsTests`) | `:144-182` ✓ | correct |
| new test at `:166-182` | `:166-182` ✓ | correct |

The *direction* of the edit is right and the reasons are real: the original `:127` / `:130-134` /
`:92-112` were stale (IMP-216 added 6 lines above `dedupe_records` and shifted everything after
it, and `tests/test_build_index.py` grew independently). A stale citation left in place would
have been worse. Recording the correction was legitimate; the replacement numbers were then not
re-measured, which REPO_PROFILE §4.6.7 ("any line number cited in a report is read from the file
it names") forbids. Same class of error in `impl-IMP-042.md`, which cites pre-item line numbers
while describing post-item code (`:602` is the HEAD caller line; the file it names now has the
call at `:609`).

---

## 7. Gate, hermeticity, dependencies

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 119 tests in 1.103s

OK
```

119 tests OK — the claim holds. Wall time 1.103 s, matching the profile's "~1.1 s" and the
implementer's 1.107-1.137 s. Every mutant run above also completed in 1.10-1.14 s, so the added
test costs nothing measurable.

Hermeticity, using the profile's own §3.2 check (socket `connect` / `create_connection` /
`getaddrinfo` replaced by a raiser):

```
Ran 119 tests in 0.118s
FAILED (failures=1)
RESULT run= 119 failures= 1 errors= 0
  RED: test_arxiv_common.BlackHoleRequestTests.test_a_hung_request_fails_at_the_timeout_without_hanging
```

One failure, and it is the documented pre-existing one (REPO_PROFILE §3.2: that test deliberately
binds `127.0.0.1:0` to measure a real read timeout, so any blanket socket block trips it). It is
in `test_arxiv_common.py`, untouched by this item, and it is the same single failure the profile
records for the 104-test baseline. **Hermeticity intact; no new network or clock dependency.**

Nothing else was run: no `npm`, no deploy, no notebook. `web/` is untouched by this item (§1),
so REPO_PROFILE §4.6 steps 1 and 3 do not apply. `PROGRESS.log` correctly has no IMP-042 row
yet — its format is `TIMESTAMP | ID | STATUS | <commit sha>`, i.e. written at commit time, and
this item is uncommitted (`impl-IMP-042.md:3`, `discovered-IMP-042.md:35-41`).

---

## 8. Issues (none blocking; the three spec criteria are met)

**8.1 Two wrong line citations in the spec edit (documentation only, no criterion involved).**
`.improve/FEATURES.md:987` says the category union append "was at `:197-200`"; it was at HEAD
`:194-197` (append `:196`) and is now at `:201-204` (append `:203`). The same line scopes
`dedupe_records` as `:180-202` when the function ends at `:205`. Fix both in place.

The *explanation* given in that same line is also wrong, and it is the claim most likely to
mislead the next item: IMP-216 did not "add ~70 lines above this function". Measured:

```
$ git show a17194d --numstat -- scripts/build_index.py
154	12	scripts/build_index.py
$ git show a17194d^:scripts/build_index.py | grep -n "def dedupe_records"   -> 141
$ git show HEAD:scripts/build_index.py     | grep -n "def dedupe_records"   -> 180
a17194d^ -> HEAD: 141 -> 180 = +39 lines
$ git show a17194d^:scripts/build_index.py | grep -n "merged\[paper_id\]"  -> 151
```

So the pre-IMP-216 shallow copy was at `:151`, and the spec's original `:127` was already stale
*before* IMP-216 (it pointed at `record_from_result`'s `"id":` line, `a17194d^:127`) — 24 lines
of earlier drift the spec simply accumulated. The same "~70" figure is repeated at
`impl-IMP-042.md:260-261` and `discovered-IMP-042.md:53`; both should say +39 for IMP-216, and
`tests/test_build_index.py:92-112` was likewise stale from earlier items, not from IMP-216.
`impl-IMP-042.md:49` and `:124` cite the caller as `:602`, which is HEAD's line; the file they
name now has `:609`.

**8.2 The regression net is field-shaped (follow-up candidate, not this item's criterion).**
M3b in §5 keeps all 119 tests green while `dedupe_records` mutates the caller's `authors`.
Two cheap closures, either of which would have caught M3b and M5: give the new test records with
*differing* `authors` and assert `merged[0]["authors"] is not records[0]["authors"]`, and add
the `{"id": "x"}` no-`categories` case that `discovered-IMP-042.md:24-33` (D-2) already flagged
as untested. A future item could take `copy.deepcopy` plus a whole-record guarantee test.

**8.3 M4 (output order) is unpinned** — `[merged[p] for p in sorted(order)]` passes the suite,
though insertion order is part of `dedupe_records`' documented contract
(`recon-architect.md:208`). Pre-existing gap, not introduced here.

**No commit was made by me, and none is implied.** The item is uncommitted in the working tree;
`git status` should still show only the five files above after the implementer commits its two.