# Discovered during IMP-022 — NOT fixed here

Found while implementing `IMP-022` (validate every CLI flag in both scripts). None of
these are in the item's five acceptance criteria, so they are recorded here and left for
their own item. Line numbers are from the post-IMP-022 working tree.

---

## D1 — `--out-dir` is still unvalidated (the fourth case of PY-10)

`scripts/build_index.py:332` still takes `--out-dir` as a bare string. A typo'd directory
(`--out-dir web/public/data/`) or a read-only path is not caught by argparse; it surfaces
much later from `write_index` (`:308`) as a raw `OSError` traceback, because `main()`
has no error handling around the write (PY-9). The same is true of
`scripts/paper-collector.py:203 --output-dir`, where `os.makedirs` (`:303`) raises
straight out of `main()`.

`IMP-022` AC1/AC2/AC3 enumerate the numeric and category flags only, so this is
deliberately untouched. A `--out-dir` range/format check is not really expressible as a
range either; the honest fix is PY-9's "log and return 1", which is a different item.

**Not executed** — I did not run a failing `--out-dir` to avoid creating stray
directories; this is read from the code.

## D2 — The non-positive short circuits are still live for programmatic callers

`IMP-022` closes the *CLI* surface. The three underlying "silently means something else"
branches are unchanged, deliberately:

| Location | Behavior for a non-CLI caller | Reachable from the CLI now? |
| --- | --- | --- |
| `scripts/build_index.py:58` | `truncate_abstract(text, 0)` returns the full text with `truncated=False` | no (`--abstract-chars` rejects `< 1`) |
| `scripts/build_index.py:222` | `collect_papers(..., max_per_category=-9, ...)` uses `UNLIMITED` | no (`--max-per-category` rejects `< 0`) |
| `scripts/arxiv_common.py:50-51` | `iter_results(query, 0)` returns immediately, no request | no (`--max-papers` rejects `< 1`) |

I left all three as the defensive guards they were written as. Turning them into errors
would change the contract of a pure helper that tests call directly, and
`tests/test_build_index.py` has no coverage for either behavior. If a future item wants
them to raise, it needs its own tests for the helper contract.

## D3 — The legacy CLI's `--topic` still accepts a query that returns nothing

`--max-papers 0` is now rejected, but the other way to get a zero-paper feed is untouched:
`scripts/paper-collector.py:196 --topic` takes any string, `fetch_papers` (`:222`) turns
whatever arXiv answers into a frame, and `main()` (`:300-315`) prints
`Number of papers extracted :  0`, writes a 564-byte HTML feed and exits 0 with a success
message. A typo'd field prefix (`--topic 'cat:cs.CVV'`) or a nonsense query is
indistinguishable from "arXiv has nothing new".

`--topic` is a full arXiv query, not a category, so it cannot be validated by the
`CATEGORY_PATTERN` this item introduced — validating it would mean reimplementing arXiv's
query grammar. I did not touch it. **Not executed** (needs the network); this is read from
the code path.

## D4 — Redundant flag name in the argparse error line

```
build_index.py: error: argument --retention-days: --retention-days accepts 1 or greater, got 0
```

`int_at_least` bakes the flag name into the `ArgumentTypeError` message, which argparse
then prefixes with `argument <flag>:`. The name therefore appears twice. That is
intentional: the item requires "a message naming the flag and its accepted range", and
baking the name in guarantees it regardless of the interpreter's argparse wording. I
verified the prefix is present on 3.8, 3.9, 3.11, 3.12, 3.13 and 3.14
(`/tmp/imp022-scratch/argparse_probe.py`), so this could be simplified to a
`f"accepts {accepted}, got {value}"` message — but the item's wording is a hard
requirement, so I kept the redundancy.

## D5 — `int_at_least` is duplicated in the two scripts

`scripts/build_index.py:284` and `scripts/paper-collector.py:165` hold identical copies
(20 lines). The obvious shared home is `scripts/arxiv_common.py`, which both scripts
already import, but that module's docstring scopes it to "shared arXiv client construction
and result iteration" and it does not import `argparse` today. Each script also keeps its
own `parse_args`, its own HTML/JSON writer and its own record schema (PE-14 / trap 6), so
local copies match the existing structure; the alternative widens a module whose stated
role is the API client. Flagging it as drift risk, not a defect.

## Non-issues checked and dismissed

- `results/.gitkeep` and the empty `results/` directory are pre-existing and gitignored.
  No new directory was created by any `IMP-022` run (every rejected run exits in
  `parse_args`, before `os.makedirs`).
- `git status` also shows `web/src/App.tsx` and `web/src/lib/paperIndex.ts` as modified.
  Those are another agent's files; `IMP-022` did not touch `web/`.
- `truncate_abstract`'s and `iter_results`'s `<= 0` guards are not dead code that a
  linter will flag — they are load-bearing for direct callers, see D2.
