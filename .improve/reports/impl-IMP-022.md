# IMP-022 — Validate every CLI flag in both scripts

**Status:** implemented. Suite: **73 tests, OK** (baseline was 55; **+18** new tests, no
existing test changed, none weakened). No git write command was run; no commit.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `scripts/build_index.py` | +`CATEGORY_PATTERN` (`:41`); +`int_at_least()` (`:284`), +`category()` (`:311`); `--retention-days` / `--max-per-category` / `--abstract-chars` / `--category` now carry a validating `type=` and range-bearing `help=` (`:335`, `:341`, `:347`, `:353`) |
| `scripts/paper-collector.py` | +`int_at_least()` (`:165`); `parse_args()` → `parse_args(argv=None)` (`:190`, returns `parser.parse_args(argv)` at `:219`) so the parser is testable without `sys.argv`; `--max-papers` gains a validating `type=` and a range-bearing `help=` (`:200`) |
| `tests/test_build_index.py` | +`import contextlib, io`; +`ParseArgsValidationTests` (7 tests) and `CategoryArgumentTests` (5 tests) |
| `tests/test_paper_collector.py` | +`MaxPapersArgumentTests` (6 tests) |
| `readme.md` | `:43-48` `build_index` flag list rewritten to state every accepted range (and to document `--category`, closing the readme half of INF-14 for this flag); `:105` `--max-papers` table row now states its range |
| `.improve/reports/impl-IMP-022.md` | this report |
| `.improve/reports/discovered-IMP-022.md` | 5 things found and deliberately **not** fixed |

Nothing else was touched. `web/`, `notebooks/`, `CONTRIBUTING.md`, `.improve/FEATURES.md`
and the sibling worktree were not read or modified. No new file in a gitignored location.
`git status --porcelain` (verbatim, at the end):

```
 M readme.md
 M scripts/build_index.py
 M scripts/paper-collector.py
 M tests/test_build_index.py
 M tests/test_paper_collector.py
 M web/src/App.tsx
 M web/src/lib/paperIndex.ts
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
```

(`web/src/*` and the two untracked reports belong to other agents.)

---

## 2. Every flag validated, and its accepted range

| Script | Flag | Accepted | Default (unchanged) | Rejected → exit 2 |
| --- | --- | --- | --- | --- |
| `build_index.py` | `--retention-days` | `>= 1` | `60` | `0`, `-1`, `-60`, `sixty` |
| `build_index.py` | `--abstract-chars` | `>= 1` | `500` | `0`, `-3` |
| `build_index.py` | `--max-per-category` | `>= 0` (`0` = no cap) | `0` | `-1`, `-9` |
| `build_index.py` | `--category` | `^[a-zA-Z-]+(\.[a-zA-Z-]+)?$` | `None` → `DEFAULT_CATEGORIES` | `cs.CV foo`, `cs..CV`, `cs.CV.BOGUS`, `cs.CV;`, `cat:cs.CV`, `""`, `cs.CV\nfoo`, `cs.CV AND ti:robot`, `123` |
| `paper-collector.py` | `--max-papers` | `>= 1` | `1000` | `0`, `-5`, `lots` |
| `build_index.py` | `--out-dir` | **not validated** — see `discovered-IMP-022.md` D1 | `web/public/data` | — |

**No default value was changed.** The two new helpers are pure `argparse` `type=`
callables, so validation happens while parsing, i.e. **before** `main()` reaches
`collect_papers` and before any `os.makedirs` — a rejected flag cannot make a network call
or write a file. Two independent checks of that ordering are in the suite
(`test_main_does_not_query_arxiv_for_a_rejected_category` installs a `collect_papers`
that calls `self.fail`) and in §5 below.

### Implementation notes

- `int_at_least(flag, minimum)` raises `argparse.ArgumentTypeError`, which argparse turns
  into `parser.error()` → `sys.exit(2)`. It distinguishes "not a number"
  (`--flag expects a whole number, got 'abc'`) from "out of range"
  (`--flag accepts 1 or greater, got 0`), and bakes the flag name into the message so the
  requirement "naming the flag and its accepted range" holds on any interpreter, not just
  on versions that prefix `argument <flag>:`. The resulting line names the flag twice —
  that redundancy is deliberate, see `discovered-IMP-022.md` D4.
- `category()` uses `CATEGORY_PATTERN.fullmatch(value)`, not `.match()`. The spec's
  pattern is kept **verbatim** (`^[a-zA-Z-]+(\.[a-zA-Z-]+)?$`, `build_index.py:41`),
  but `fullmatch` closes the `$`-matches-before-a-trailing-newline hole that would let
  `cs.CV\nfoo` through a `cat:` query. Verified: that value exits 2.
- The pattern still accepts every real form: `cs.AI`, `stat.ML`, `astro-ph.HE` (tested),
  and it also accepts the bare subject `cs` and the bare archive `astro-ph`, both of which
  are valid arXiv query targets.
- `parse_args(argv=None)` in `paper-collector.py` is an **additive** signature change, not
  a behavior change: `main()` still calls `parse_args()` with no argument, so it still
  reads `sys.argv`, and the module is still loadable by the existing
  `importlib.util.spec_from_file_location` test loader. No documented flag, name, default
  or output-naming behavior was touched.
- `int_at_least` is deliberately duplicated in the two scripts rather than moved into
  `arxiv_common.py`; rationale and the drift risk are recorded as D5.

---

## 3. The item's own verification method, run verbatim

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
----------------------------------------------------------------------
Ran 73 tests in 0.040s

OK

$ /usr/local/bin/python3.11 scripts/build_index.py --retention-days 0
  exit=2  build_index.py: error: argument --retention-days: --retention-days accepts 1 or greater, got 0

$ /usr/local/bin/python3.11 scripts/build_index.py --category 'cs.CV foo' --max-per-category 2 --out-dir /tmp/rpf-cat
  exit=2  build_index.py: error: argument --category: --category value 'cs.CV foo' is not an arXiv category; expected a subject such as cs or cs.AI, or an archive/subject pair such as stat.ML or astro-ph.HE

$ /usr/local/bin/python3.11 scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 0
  exit=2  paper-collector.py: error: argument --max-papers: --max-papers accepts 1 or greater, got 0

  writes: /tmp/rpf-cat -> ls: /tmp/rpf-cat: No such file or directory
```

The `ls` is the "write nothing" half of the check: `--out-dir /tmp/rpf-cat` was never
created, because parsing failed first. Full sweep of every bad value:

```
### scripts/build_index.py --retention-days 0 --out-dir /tmp/rpf-cat
exit=2  ... --retention-days accepts 1 or greater, got 0
### scripts/build_index.py --retention-days -1 ...            exit=2  ... got -1
### scripts/build_index.py --retention-days abc ...            exit=2  ... expects a whole number, got 'abc'
### scripts/build_index.py --abstract-chars -3 ...              exit=2  ... --abstract-chars accepts 1 or greater, got -3
### scripts/build_index.py --max-per-category -9 ...            exit=2  ... --max-per-category accepts 0 or greater, got -9
### scripts/build_index.py --category cs.CV foo ...             exit=2  ... is not an arXiv category ...
### scripts/build_index.py --category cs..CV ...               exit=2
### scripts/build_index.py --category cs.CV.BOGUS ...          exit=2
### scripts/build_index.py --category '' ...                   exit=2
### scripts/build_index.py --category <"cs.CV\nfoo"> ...        exit=2
### scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 0     exit=2
### scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers -5    exit=2
### scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers lots  exit=2
```

### Each original bad behavior, before → after

| Bad behavior (pre-fix) | After |
| --- | --- |
| `--retention-days 0` → cutoff now-or-future, retention `break` fires on the first result, `No papers fetched; refusing to write an empty index.`, exit 1 | exit 2, usage + range message, nothing fetched, nothing written |
| `--abstract-chars -3` → truncation silently disabled (`truncate_abstract` `max_chars <= 0`) | exit 2, range message |
| `--max-per-category -9` → silently unlimited (`UNLIMITED`) | exit 2, range message. `0` still means unlimited and is still the default |
| `--category 'cs.CV foo'` → query arXiv answers with an empty feed, then `No papers fetched…` exit 1 | exit 2, message names the offending value, before the request |
| `paper-collector.py --max-papers 0` → short-circuit, zero-paper HTML feed, success message, exit 0 | exit 2, no file written |

### IMP-004 not regressed

`arxiv_common.iter_results` and the `failures`-list hard-fail are untouched; the two
existing `MainTests` that cover them (`test_refuses_to_write_index_when_a_category_query_fails`,
`test_writes_index_when_every_category_query_succeeds`) still pass unmodified. Exit 1 now
only means "arXiv or the run failed"; a malformed flag is a distinct exit **2** that
happens strictly earlier.

### Free syntax check

```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests
compileall exit=0
```

---

## 4. Test suite

`/usr/local/bin/python3.11 -m unittest discover -s tests -v` → **Ran 73 tests … OK**
(baseline 55, **+18**). Breakdown of the additions — all hermetic, no network, no clock,
no filesystem beyond `tempfile`, matching the existing style (`unittest.TestCase`,
`test_<behavior>_<expectation>`, `contextlib.redirect_stderr` to swallow argparse's usage
spill, assertions on the captured message as well as the exit code):

`tests/test_build_index.py` — `ParseArgsValidationTests` (7): retention `0`/`-1`/`-60`
rejected; non-numeric rejected; `abstract-chars 0`/`-3` rejected;
`max-per-category -1`/`-9` rejected; **`--max-per-category 0` still accepted and still
means no cap**; all four defaults unchanged; `7 / 1 / 2` accepted.
`CategoryArgumentTests` (5): real forms `cs.AI`, `stat.ML`, `astro-ph.HE`, `cs`,
`astro-ph` accepted; 9 malformed values rejected with the value named in the message;
**`parse_args(["--category","cs.CV","--category","cs.LG"]).categories == ["cs.CV","cs.LG"]`**;
**`parse_args([]).categories is None`**; `main()` with a bad category exits 2 without
calling `collect_papers`.

`tests/test_paper_collector.py` — `MaxPapersArgumentTests` (6): `--max-papers 0` and
`-5` rejected with exit 2; `lots` rejected with the "whole number" message; default still
`1000`; the README's documented example argv parses to
`topic='cat:cs.CV AND "3d reconstruction"'`, `max_papers=200`, `output_dir='results'`;
`parse_args([]).topic is None` (the interactive prompt is intact).

No existing test was restructured, renamed or weakened.

### Non-vacuity — proven in a scratch copy under `/tmp`

`/tmp/imp022-scratch/` holds a copy of `scripts/` + `tests/` with the **new tests** and the
**pre-fix sources**, where the source-side fix was mechanically reverted. The reverted
files were diffed against `git show HEAD:` to prove they are byte-identical to the
pre-change sources:

```
$ diff /tmp/imp022-scratch/head_build_index.py /tmp/imp022-scratch/scripts/build_index.py
build_index scratch == HEAD (pre-fix restored exactly)
$ diff /tmp/imp022-scratch/head_paper_collector.py /tmp/imp022-scratch/scripts/paper-collector.py
paper-collector scratch == HEAD (pre-fix restored exactly)
```

`/usr/local/bin/python3.11 -m unittest discover -s tests -v` there →
`Ran 73 tests … FAILED (failures=18, errors=6)`. 18 failures are the behavioral ones:

```
FAIL: test_retention_days_below_one_is_rejected (value='0' / '-1' / '-60')
FAIL: test_retention_days_must_be_a_whole_number
FAIL: test_abstract_chars_below_one_is_rejected (value='0' / '-3')
FAIL: test_max_per_category_below_zero_is_rejected (value='-1' / '-9')
FAIL: test_malformed_categories_are_rejected (all 9 values, incl. 'cs.CV\nfoo')
FAIL: test_main_does_not_query_arxiv_for_a_rejected_category
```

The 6 `errors` were all `TypeError: parse_args() takes 0 positional arguments` — i.e. the
`argv` signature, not the behavior. To isolate the behavior, I then shimmed **only** the
signature in the scratch copy (`parse_args(argv=None)` → `parser.parse_args(argv)`, still
no validation) and re-ran:

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -p 'test_paper_collector.py' -k MaxPapersArgumentTests -v
FAIL: test_zero_max_papers_is_rejected
  AssertionError: SystemExit not raised
FAIL: test_negative_max_papers_is_rejected
FAIL: test_non_numeric_max_papers_is_rejected
  AssertionError: 'whole number' not found in "... error: argument --max-papers: invalid int value: 'lots'"
Ran 6 tests … FAILED (failures=3)
```

So `--max-papers 0` was genuinely accepted before the fix, and the non-numeric case used to
emit argparse's own `invalid int value` (exit 2, but no flag-naming range message). The
3 `MaxPapersArgumentTests` that pass both before and after (`default is 1000`,
`documented example parses`, `topic stays None`) are regression guards, not vacuous
assertions. The same split holds in `test_build_index.py`: the 6 "no regression" tests
pass on the pre-fix sources, the 12 behavioral ones fail.

---

## 5. Backward compatibility of the legacy CLI

**The README's own commands, extracted from `readme.md` and fed to the real parsers**
(shlex-tokenized, no network):

```
readme.md:39  python scripts/build_index.py
  -> OK argv=[]
     Namespace(out_dir='web/public/data', retention_days=60, max_per_category=0, abstract_chars=500, categories=None)
readme.md:89  python scripts/paper-collector.py --topic "cat:cs.CV AND \"3d reconstruction\"" --max-papers 200
  -> OK argv=['--topic', 'cat:cs.CV AND "3d reconstruction"', '--max-papers', '200']
     Namespace(topic='cat:cs.CV AND "3d reconstruction"', max_papers=200, output_dir='results',
               download_pdfs=False, download_sources=False, save_csv=False)
readme.md:95  python scripts/paper-collector.py
  -> OK argv=[]
     Namespace(topic=None, max_papers=1000, output_dir='results', download_pdfs=False, download_sources=False, save_csv=False)
```

The escaped-quote topic survives tokenization intact, and the bare invocation leaves
`topic=None`.

**The interactive prompt, proven end to end** (in-process, `fetch_papers` stubbed,
`input()` captured, run in a `tempfile` dir — no network):

```
prompt shown: ['Enter the topic you need to search for : ']
files: ['cat_cs.CV-1_papers_extracted_on_10-02-2026-11-20-13.html']
```

`main()` still prompts and still writes the documented
`<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html` name. (The `FileNotFoundError`
at the end of that snippet is my throwaway script calling `os.chdir` back after the temp
dir was already removed — after all evidence printed. No repo file involved.)

Every other documented flag is byte-for-byte unchanged: `--topic`, `--output-dir`
(default `results`), `--download-pdfs`, `--download-sources`, `--save-csv`, and the
`<topic>-<N>_papers_extracted_on_<...>.html` output naming (profile §6 compatibility
surface). `--topic` is deliberately **not** validated — it is a full arXiv query, not a
category; see `discovered-IMP-022.md` D3 for the residual.

---

## 6. `--help` ↔ `readme.md` reconciliation (AC5)

Both scripts' `--help` output was captured from the real scripts and cross-checked against
`readme.md` — every flag in either `--help` appears in the readme, and every range is
stated in both places:

| Flag | Script | Token | in `--help` | in `readme.md` |
| --- | --- | --- | --- | --- |
| `--retention-days` | build_index | `1 or greater` | yes | yes |
| `--abstract-chars` | build_index | `1 or greater` | yes | yes |
| `--max-per-category` | build_index | `0 or greater` | yes | yes |
| `--category` | build_index | `cs.AI`, `astro-ph.HE` | yes | yes |
| `--out-dir` | build_index | `web/public/data` | yes | yes |
| `--max-papers` | paper-collector | `1 or greater` | yes | yes |
| `--output-dir` | paper-collector | `results` | yes | yes |
| `--topic` | paper-collector | prompted | `--help` says "Prompted for interactively if omitted.", readme says "If omitted, you'll be prompted interactively." — pre-existing wording, equivalent meaning, unchanged by this item |

The readme's own new paragraph, verbatim (`readme.md:43-48`):

```
   Useful flags, with the values they accept: `--retention-days` (1 or greater,
   default `60`), `--max-per-category` (0 or greater, default `0` = no cap — pass
   a small number for fast dev runs), `--abstract-chars` (1 or greater, default
   `500`), `--category` (repeatable; each value must look like `cs.AI`,
   `stat.ML` or `astro-ph.HE`, defaulting to `cs.CV`, `cs.LG`, `cs.CL`, `cs.AI`,
   `cs.RO`), and `--out-dir` (any writable directory, default
   `web/public/data`). An out-of-range or malformed value is rejected before
   anything is fetched or written.
```

and the table row (`readme.md:105`):

```
| `--max-papers` | Maximum number of papers to pull. Must be 1 or greater. | `1000` |
```

I used prose rather than adding a second table to that spot, to keep the diff small and
readable. `readme.md` is unchanged in filename (lowercase) and structure otherwise.

---

## 7. CI compatibility

`.github/workflows/ci.yml:15` pins a floating `python-version: "3.x"`, so the code must
work on any recent CPython. My changes use nothing version-specific: f-strings (3.6+),
`re.fullmatch` (3.4+), `argparse.ArgumentTypeError` (3.0+), `raise … from None` (3.3+).
To be certain about argparse's *error wording* across versions, I ran a standalone probe
(`/tmp/imp022-scratch/argparse_probe.py`) replicating `int_at_least`/`category` verbatim on
every interpreter present on this machine:

| Interpreter | 4 bad inputs | good values |
| --- | --- | --- |
| `/opt/homebrew/bin/python3.8` (3.8.19) | `SystemExit(2)` ×4 | accepted |
| `/usr/bin/python3` (3.9.6) | `SystemExit(2)` ×4 | accepted |
| `/usr/local/bin/python3.11` (3.11.8) | `SystemExit(2)` ×4 | accepted |
| `/opt/homebrew/bin/python3.12` (3.12.7) | `SystemExit(2)` ×4 | accepted |
| `/opt/homebrew/bin/python3.13` (3.13.0) | `SystemExit(2)` ×4 | accepted |
| `/opt/homebrew/bin/python3.14` (3.14.3) | `SystemExit(2)` ×4 | accepted |

The full suite itself can only run on 3.11 here (3.12–3.14 have neither `arxiv` nor
`pandas` — profile §3.1/PE-5), which is also the only interpreter CI-equivalent command
works with on this machine. The tests use nothing newer than 3.8 either
(`contextlib.redirect_stderr`, `assertLogs`, `subTest`, f-strings).

No web-side check applies (`web/` untouched), so `npm run typecheck/test/build` were not
run — they are not part of this item's gate, and another agent is editing `web/src`.

---

## 8. Acceptance criteria, one by one

1. ✅ `--retention-days < 1`, `--abstract-chars < 1`, `--max-per-category < 0` each exit 2
   with a message naming the flag and its accepted range (verbatim evidence in §3).
2. ✅ `--category` must match `^[a-zA-Z-]+(\.[a-zA-Z-]+)?$` or exit 2 naming the offending
   value; `cs.AI`, `stat.ML`, `astro-ph.HE` still accepted (asserted in
   `test_real_category_forms_are_accepted`).
3. ✅ `paper-collector.py --max-papers < 1` exits 2 naming the flag; name and default
   (`1000`) unchanged.
4. ✅ `SystemExit` with `code == 2` asserted for `--retention-days 0`,
   `--abstract-chars -3`, `--category 'cs.CV foo'` and `--max-papers 0`; plus
   `categories == ["cs.CV","cs.LG"]` for the repeated case and `categories is None` for
   `parse_args([])`.
5. ✅ `readme.md:43-48` and `readme.md:105` updated in the same change to state the
   accepted ranges; both `--help` outputs show them (§6).

---

## 9. Uncertain / left open

- **Message wording** is my choice; AC1/AC2 only require the flag and the range to be
  named. The double flag name (argparse's prefix plus mine) is deliberate but a reviewer
  may prefer one of them dropped — see D4.
- **Error output goes to stderr** (argparse's default). A user piping stdout only still
  sees exit 2 and no message. Nothing in the item asks for a friendlier path, and changing
  the stream is a judgment call I left to argparse.
- **The helper's `<= 0` branches inside the pure functions are untouched** (`truncate_abstract`,
  `collect_papers`, `iter_results`). The CLI can no longer reach them, but a programmatic
  caller still can. I judged turning them into errors to be out of scope and untested
  territory; recorded as D2 with the exact locations.
- **`--out-dir`/`--output-dir` remain unvalidated** (D1) — the fourth case named in profile
  row PY-10, but no acceptance criterion covers it, and the real defect there is PY-9
  (unhandled `OSError`), not a range check.
- **Not executed for lack of a network-free path:** a live `--topic` that returns zero
  papers (D3). The claim is read from `main()`'s code path, not measured.
- The scratch copy at `/tmp/imp022-scratch/` is throwaway; nothing in it is needed by the
  repo. It is outside the workspace and outside any gitignored path.
