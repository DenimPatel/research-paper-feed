# Discovered while implementing IMP-042

Items outside IMP-042's scope. Nothing here was fixed; nothing here is claimed to be fixed.

## D-1 — `dedupe_records`' output still aliases the caller's other mutable values

`dedupe_records` (`scripts/build_index.py:180-202`) clones `categories` only, because that is the
only value it writes to. Every other mutable value in a record — `authors` is the only other list
in the published shape — is still **shared by identity** between the input record and the output
copy, since the copy is `dict(record)`.

No defect is reachable today: `dedupe_records` never mutates `authors`, so nothing writes through
the alias. The hazard is that the *shape* of the guarantee is now field-specific — "the input is not
mutated" holds only because the merge happens to touch one field — so a future edit that mutates a
second field would reopen IMP-042's exact bug, and the new regression test (which asserts on
`categories`) would not notice.

Not fixed here on purpose: IMP-042's acceptance criterion 1 names `categories`, and cloning every
value is both a larger change and a speculative one. If a maintainer wants the invariant to be
"output records share nothing mutable with input records", the honest implementation is
`copy.deepcopy(record)` (the record is a plain JSON-able dict per REPO_PROFILE §5.2, so it is safe)
plus a test that pins the whole guarantee rather than one field. **Deliberately left alone.**

## D-2 — No test anywhere constructs a record without a `categories` key

The fix guards its clone with `if "categories" in first` specifically to preserve the old behaviour
for a record that arrives without `categories` (the old code reached `setdefault` and created the
key on the copy). That branch is **not** covered by any test in `tests/`: every fixture in
`test_build_index.py` goes through `make_record`, which always sets `categories`
(`tests/test_build_index.py:69`), and `record_from_result` always sets it too
(`scripts/build_index.py:173`). The path is behaviour-preserving, so this is not a bug — it is an
untested branch in newly written code. A one-line test passing `{"id": "x"}` to `dedupe_records`
would close it. Left alone as out of scope; noting it so the coverage gap is not read as intent.

## D-3 — Not a defect, recorded so a future verifier does not "find" it: the pre-existing `web/` edits

`git status --short` shows `M web/src/components/PaperCard.tsx` and
`M web/src/components/__tests__/PaperCard.test.tsx` alongside IMP-042's two Python files. Those two
belong to a concurrent agent (IMP-219, per its in-file comments) and are **not** part of IMP-042.
Any tree-wide `git diff`, test count, or `npm test` number taken right now mixes both items'
work. IMP-042's own diff is exactly:

```
$ git diff --stat -- scripts/build_index.py tests/test_build_index.py
 scripts/build_index.py    | 11 +++++++++--
 tests/test_build_index.py | 17 +++++++++++++++++
 2 files changed, 25 insertions(+), 3 deletions(-)
```

## D-4 — Spec line-number drift, already corrected in `FEATURES.md`

IMP-042's Area line cited `scripts/build_index.py:127` / `:130-134` and
`tests/test_build_index.py:92-112`; the real locations are `:190` / `:197-200` and `:144-182`
(IMP-216 added ~70 lines above `dedupe_records`). The Area line now carries the corrected numbers
with the reason, rather than the spec being left wrong for the next reader. Worth noting as a
pattern: **several items in `.improve/FEATURES.md` cite `build_index.py` line numbers from before
IMP-216 landed**, and any of them re-verified today will find its citations shifted by the same
offset. That is a docs-accuracy issue for the backlog as a whole, not for IMP-042.