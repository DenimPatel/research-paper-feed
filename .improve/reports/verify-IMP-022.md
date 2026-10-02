# VERIFY — IMP-022 «Validate every CLI flag in both scripts»

**Verifier:** independent skeptical verifier (did not write this change)
**Date:** 2026-10-02
**Repo root:** `/Users/denimpatel/Desktop/git/research-paper-feed`
**Branch / base:** `improve/auto-20261002` @ `01e103f`
**Scope reviewed:** `git diff -- scripts/ tests/ readme.md` only. `web/` ignored entirely
(another agent owns IMP-173). `.kilo/worktrees/mildly-income` never read. No git write command
was run. No source file was modified; the only file written is this report.

---

## VERDICT: **PASS** — 5/5 acceptance criteria met

Two non-blocking findings, both **spec-conformant** (see §8): an unbounded `--category` length
and a pre-existing test that does not pin IMP-004's exit code to `1`.

---

## 1. Suite: 73 tests, OK, hermetic, fast

```
$ cd /Users/denimpatel/Desktop/git/research-paper-feed
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
----------------------------------------------------------------------
Ran 73 tests in 0.045s

OK
```

Repeated 3×: `Ran 73 tests in 0.039s` / `0.038s` / `0.037s` — all `OK`.

**Hermeticity proved by blocking the network, not by inspection.** I replaced
`socket.socket.connect`, `socket.create_connection`, `socket.getaddrinfo` and
`socket.socket.connect_ex` with raising stubs that record every attempt, then ran the whole suite
in-process:

```
$ /usr/local/bin/python3.11 /tmp/vfy_hermetic.py
Ran 73 tests in 0.062s
OK
testsRun=73 failures=0 errors=0 skipped=0
network attempts during suite: 0 -> True
OK=True
```

**`skipped=0`** — nothing is skipped, hidden or xfailed.

```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests
compileall exit=0
```

**Baseline is 55, not 44.** `REPO_PROFILE.md:91` records 44 at recon; 11 tests have landed since
from other items. I re-measured the true pre-change baseline in my own scratch copy (§4):
**`Ran 55 tests … OK`**. So `55 + 18 = 73` is arithmetically correct and the implementer's
"+18" claim is accurate.

---

## 2. AC-by-AC review

### AC1 — `--retention-days < 1`, `--abstract-chars < 1`, `--max-per-category < 0` → exit 2, message names flag + range — **MET**

Driven through the real `parse_args`, not the CLI wrapper, so the exit code is `SystemExit.code`:

| argv | code | stderr (verbatim) |
| --- | --- | --- |
| `["--retention-days","0"]` | **2** | `argument --retention-days: --retention-days accepts 1 or greater, got 0` |
| `["--retention-days","-1"]` | **2** | `… accepts 1 or greater, got -1` |
| `["--retention-days","-60"]` | **2** | `… accepts 1 or greater, got -60` |
| `["--retention-days","sixty"]` | **2** | `--retention-days expects a whole number, got 'sixty'` |
| `["--abstract-chars","0"]` | **2** | `argument --abstract-chars: --abstract-chars accepts 1 or greater, got 0` |
| `["--abstract-chars","-3"]` | **2** | `… accepts 1 or greater, got -3` |
| `["--abstract-chars","-1000"]` | **2** | `… accepts 1 or greater, got -1000` |
| `["--max-per-category","-1"]` | **2** | `argument --max-per-category: --max-per-category accepts 0 or greater, got -1` |
| `["--max-per-category","-9"]` | **2** | `… accepts 0 or greater, got -9` |
| `["--max-per-category","-0.5"]` | **2** | `--max-per-category expects a whole number, got '-0.5'` |

Every message names the flag **and** its accepted range. Boundaries still accepted (no
over-rejection): `--retention-days 1`→1, `--abstract-chars 1`→1, `--max-per-category 0`→0,
`--max-per-category 1`→1, `--retention-days +1`→1, `--retention-days " 5 "`→5.

Sanity that the new minimum is still functional, not just parseable:
`truncate_abstract("abcdefghij", 1) == ("a…", True)`; `--max-per-category 0` still routes to
`UNLIMITED = 100000` at `scripts/build_index.py:222`.

Implementation: `int_at_least()` at `scripts/build_index.py:284`, wired at
`scripts/build_index.py:335, 341, 347`.

### AC2 — `--category` must match `^[a-zA-Z-]+(\.[a-zA-Z-]+)?$`, else exit 2 naming the value — **MET**

The pattern is byte-identical to the spec's, and is used with `fullmatch`, not `match`
(`scripts/build_index.py:41`, `scripts/build_index.py:317`):

```
CATEGORY_PATTERN source: ^[a-zA-Z-]+(\.[a-zA-Z-]+)?$
byte-equal to spec pattern: True
uses fullmatch (not match): True
```

**Must-accept list — every requested real form is accepted (code 0, stored verbatim):**

| value | result | value | result |
| --- | --- | --- | --- |
| `cs.AI` | **ACCEPT** | `math.AG` | **ACCEPT** |
| `stat.ML` | **ACCEPT** | `eess.SY` | **ACCEPT** |
| `astro-ph.HE` | **ACCEPT** | `q-bio.NC` | **ACCEPT** |
| `cs.CV`/`cs.LG`/`cs.CL`/`cs.RO` | **ACCEPT** | `cs` (bare subject) | **ACCEPT** |
| `astro-ph` (bare archive) | **ACCEPT** | `physics.optics` | **ACCEPT** |
| `q-fin.ST` | **ACCEPT** | `CS.CV` (upper) | **ACCEPT** |

**Must-reject list — all requested injection shapes are rejected with code 2, and the offending
value appears in the message** (column 3 = value present in stderr):

| value | code | value named | value | code | value named |
| --- | --- | --- | --- | --- | --- |
| `cs.CV foo` | 2 | yes | `cat:cs.CV` | 2 | yes |
| `cs.CV;rm -rf /` | 2 | yes | `123` | 2 | yes |
| `cs.CV/../etc` | 2 | yes | `cs.CV;` | 2 | yes |
| `cs..CV` | 2 | yes | `cs.CV.BOGUS` | 2 | yes |
| `.CV` | 2 | yes | `cs.CV AND ti:robot` | 2 | yes |
| `cs.` | 2 | yes | `cs.CV&&whoami` | 2 | yes |
| `""` (empty) | 2 | yes | `$(whoami)` | 2 | yes |
| `cs.CV\nfoo` | 2 | yes | `` `id` `` | 2 | yes |
| `cs.CV\t` | 2 | yes | `cs.CV\|ls` | 2 | yes |
| `cs.CV/`, `/cs.CV`, `..` | 2 | yes | `cs.CV'a`, `cs.CV"a`, `cs\CV` | 2 | yes |
| `é`, `сs.CV` (Cyrillic), `cs.CV\x00` | 2 | yes | `cs.CV%0a` | 2 | yes |
| `cs.CV – foo` (en dash) | 2 | yes | `\n` | 2 | yes |
| **`"a" * 300`** | **0 (ACCEPTED)** | — | | | |

**`fullmatch` closes the `$`-before-trailing-newline hole** (a `.match()` implementation would
let these through). Verified explicitly, because this is the subtle one:

```
'cs.CV\n'   -> code 2   'cs.CV\n\n' -> code 2   'cs\n' -> code 2   'cs.\n' -> code 2
```

**The one gap: a 300-char (or 50 000-char) `--category` is ACCEPTED.** `"a"*300` matches
`^[a-zA-Z-]+(\.[a-zA-Z-]+)?$` — the spec's literal pattern has no `{1,N}` length bound, so the
implementer was correct to keep it verbatim. This is **not an AC2 breach** (AC2 mandates that
exact pattern), but it *is* a residual the implementer did **not** record in
`.improve/reports/discovered-IMP-022.md` (that file covers `--out-dir` D1, the pure-helper
short-circuits D2, `--topic` D3, message redundancy D4, helper duplication D5 — nothing about
category length). See §8 Finding 1 for impact and the exact fix.

Two values are rejected by argparse's own option parser rather than by `category()`, and the
offending value is therefore not echoed — correct outcome, different mechanism:
`-cs.CV` → `argument --category: expected one argument`; `--category` as a value → same.
(`-5` *is* handled by `category()` and names the value.)

### AC3 — `paper-collector.py --max-papers < 1` → exit 2; default 1000; flag name unchanged — **MET**

| argv | code | message |
| --- | --- | --- |
| `["--topic","cat:cs.CV","--max-papers","0"]` | **2** | `argument --max-papers: --max-papers accepts 1 or greater, got 0` |
| `["--max-papers","-1"]` | **2** | `… accepts 1 or greater, got -1` |
| `["--max-papers","-5"]` | **2** | `… accepts 1 or greater, got -5` |
| `["--max-papers","lots"]` | **2** | `--max-papers expects a whole number, got 'lots'` |
| `["--max-papers","0.5"]` | **2** | `… expects a whole number, got '0.5'` |
| `["--max-papers",""]` | **2** | `… expects a whole number, got ''` |
| `["--max-papers","1"] / ["200"] / ["1000"]` | 0 | accepted |
| `[]` | 0 | `max_papers == 1000` |

Default unchanged, flag name unchanged (`--max-papers`, `scripts/paper-collector.py:200`).
Full default namespace: `Namespace(topic=None, max_papers=1000, output_dir='results',
download_pdfs=False, download_sources=False, save_csv=False)` — identical to HEAD.

### AC4 — tests assert `SystemExit` with `code == 2`, plus the two `categories` assertions — **MET**

All four required assertions verified live:

```
parse_args(["--retention-days","0"])      exit code == 2 -> True
parse_args(["--abstract-chars","-3"])     exit code == 2 -> True
parse_args(["--category","cs.CV foo"])    exit code == 2 -> True
parse_args(["--max-papers","0"])          exit code == 2 -> True
parse_args(["--category","cs.CV","--category","cs.LG"]).categories == ['cs.CV','cs.LG'] -> True
parse_args([]).categories is None                                            -> True
```

### AC5 — `readme.md` updated in the same change; both `--help` outputs show the ranges — **MET**

Confirmed in the **same uncommitted change** (none of the three files is committed separately):

```
$ git diff --stat -- scripts/ readme.md
 readme.md                 | 13 ++++++++--
 scripts/build_index.py    | 69 ++++++++++++++++++++++++++++++++++++++++++++++---
 scripts/paper-collector.py| 32 ++++++++++++++++++++++++++++++++
```

- `readme.md:43-50` — the `build_index` flag prose now states every range, and adds `--category`
  (which the readme did not previously document).
- `readme.md:105` — the `--max-papers` table row now reads `Must be 1 or greater.`

Both `--help` outputs were captured from the real scripts and **do** show the ranges
(`scripts/build_index.py:335-357`, `scripts/paper-collector.py:200`).

---

## 3. `--help` ↔ `readme.md` reconciliation (profile §4.5) — done independently, no discrepancy

I captured both `--help` outputs from the real scripts and machine-compared them to
`readme.md` at the **value** level (not keyword level), so a range stated in one place and not
the other would show up:

| flag | default | in `--help` | in `readme.md` | range | in `--help` | in `readme.md` |
| --- | --- | --- | --- | --- | --- | --- |
| `--retention-days` | `60` | yes | yes | 1 or greater | yes | yes |
| `--abstract-chars` | `500` | yes | yes | 1 or greater | yes | yes |
| `--max-per-category` | `0` (= no cap) | yes | yes | 0 or greater | yes | yes |
| `--out-dir` | `web/public/data` | yes | yes | (unvalidated) | n/a | n/a |
| `--max-papers` | `1000` | yes | yes | 1 or greater | yes | yes |
| `--output-dir` | `results` | yes | yes | (unvalidated) | n/a | n/a |

```
flags with a VALUE or RANGE discrepancy: NONE
```

Every flag in either `--help` appears in the readme (5/5 for `build_index`, 6/6 for
`paper-collector`). Every one of `cs.AI / stat.ML / astro-ph.HE` and all five
`DEFAULT_CATEGORIES` (`cs.CV, cs.LG, cs.CL, cs.AI, cs.RO`) appear in **both** `--help` and
`readme.md`, in the same order as `scripts/build_index.py:31`. The readme's claim
"An out-of-range or malformed value is rejected before anything is fetched or written"
(`readme.md:49-50`) is **true** — proved in §5.

**AC5 is NOT covered by a test.** `grep -rn "readme\|--help\|subprocess" tests/` returns
nothing: no test in the suite reads `readme.md` or invokes `--help`. AC5 does not require one, so
this is not a criterion failure — but it means the reconciliation is enforced only by reviewer
discipline, and will silently rot on the next flag change. See §8 Finding 3.

---

## 4. Non-vacuity — reproduced independently in my own scratch copy

I built `/tmp/vfy-imp022/` from scratch (not the implementer's `/tmp/imp022-scratch/`), proved the
reverted sources are byte-identical to HEAD, and ran the **new** tests against the **pre-fix**
sources.

```
$ diff -q /tmp/vfy-imp022/head_build_index.py     /tmp/vfy-imp022/scripts/build_index.py
OK build_index scratch == HEAD
$ diff -q /tmp/vfy-imp022/head_paper_collector.py  /tmp/vfy-imp022/scripts/paper-collector.py
OK paper-collector scratch == HEAD
```

New tests + pre-fix sources:

```
$ cd /tmp/vfy-imp022 && /usr/local/bin/python3.11 -m unittest discover -s tests
Ran 73 tests in 0.037s
FAILED (failures=18, errors=6)
```

**18 failures** (subtest-level), from 6 test methods:

| test method | subtest failures |
| --- | --- |
| `ParseArgsValidationTests.test_retention_days_below_one_is_rejected` | 3 (`0`, `-1`, `-60`) |
| `ParseArgsValidationTests.test_retention_days_must_be_a_whole_number` | 1 |
| `ParseArgsValidationTests.test_abstract_chars_below_one_is_rejected` | 2 (`0`, `-3`) |
| `ParseArgsValidationTests.test_max_per_category_below_zero_is_rejected` | 2 (`-1`, `-9`) |
| `CategoryArgumentTests.test_malformed_categories_are_rejected` | 9 |
| `CategoryArgumentTests.test_main_does_not_query_arxiv_for_a_rejected_category` | 1 |
| **total** | **18** |

Representative failure text (proves the pre-fix code genuinely *accepted* the bad value, not
merely that a message differed):

```
FAIL: test_retention_days_below_one_is_rejected (value='0')
  AssertionError: SystemExit not raised
FAIL: test_retention_days_must_be_a_whole_number
  AssertionError: 'whole number' not found in "…
      error: argument --retention-days: invalid int value: 'sixty'"
```

**The 6 errors are a signature artifact, not behaviour**, and I isolated them rather than
accepting the implementer's account. All 6 are in `MaxPapersArgumentTests`; on pre-fix sources
`paper-collector.parse_args()` takes no `argv` parameter, so the new
`parse_args(["--max-papers","0"])` call raises `TypeError` before the assertion. I shimmed
**only the signature** in my scratch copy (`def parse_args():` → `def parse_args(argv=None):`,
`parser.parse_args()` → `parser.parse_args(argv)`, still no validation) and re-ran:

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -p 'test_paper_collector.py' -k MaxPapersArgumentTests -v
FAIL: test_zero_max_papers_is_rejected
  AssertionError: SystemExit not raised
FAIL: test_negative_max_papers_is_rejected
FAIL: test_non_numeric_max_papers_is_rejected
  AssertionError: 'whole number' not found in "… invalid int value: 'lots'"
Ran 6 tests … FAILED (failures=3)
```

`--max-papers 0` **was** genuinely accepted pre-fix. So:

- **9 of the 18 new tests are behaviour-proving** (6 `test_build_index` methods + 3
  `test_paper_collector` methods) — they fail without the production change.
- **9 of the 18 are regression guards** that pass both before and after
  (`test_max_per_category_zero_still_means_no_cap`, `test_defaults_are_unchanged`,
  `test_valid_values_are_accepted`, `test_real_category_forms_are_accepted`,
  `test_repeated_categories_accumulate_in_order`, `test_categories_is_none_when_unset`,
  `test_default_max_papers_is_unchanged`, `test_documented_example_command_still_parses`,
  `test_no_topic_leaves_the_interactive_prompt_in_place`). These are legitimately non-vacuous as
  *guards* — they are what would catch a default change or a dropped flag — but they are not
  evidence of new behaviour, and should not be counted as such.

**Report-accuracy nit (profile §4.6 item 7).** `impl-IMP-022.md:223-224` says: *"The same split
holds in `test_build_index.py`: the 6 'no regression' tests pass on the pre-fix sources, the 12
behavioral ones fail."* Measured, within `test_build_index.py` alone it is **6 behavioural
methods (18 subtest failures) and 6 guards** — not 12 behavioural. The 12 figure is the
`test_build_index.py` test count, not the behavioural count. The 9-behavioural / 9-guard split
across the whole 18 is the correct figure. The claim errs toward overstating, so it does not
mask a defect, but it is an untraceable number under the profile's evidence rule.

### Test quality — exit code IS asserted everywhere

The specific concern raised: *a test that only asserts `SystemExit` would pass on the wrong exit
code.* It does not happen. All **4** `assertRaises(SystemExit)` sites in the new tests are
followed by an explicit code assertion:

| file:line | assertion |
| --- | --- |
| `tests/test_build_index.py:454,456` | `assertRaises(SystemExit) as raised` → `assertEqual(raised.exception.code, 2, argv)` |
| `tests/test_build_index.py:521,523` | `assertRaises(SystemExit) as raised` → `assertEqual(raised.exception.code, 2, value)` |
| `tests/test_build_index.py:565,572` | `assertRaises(SystemExit) as raised` → `assertEqual(raised.exception.code, 2)` |
| `tests/test_paper_collector.py:243,245` | `assertRaises(SystemExit) as raised` → `assertEqual(raised.exception.code, 2, argv)` |

```
build_index new block:     assertRaises(SystemExit)=3   code==2 asserts=3
paper_collector new block: assertRaises(SystemExit)=1   code==2 asserts=1
```

Both `_assert_rejected` helpers also assert the **flag name** and the **range text** appear in
the captured stderr, so a message that lost its range would fail too. `test_malformed_categories_are_rejected`
additionally asserts `repr(value)` is in the message, satisfying AC2's "naming the offending
value". Style matches the existing suite (`unittest.TestCase`, `test_<behavior>_<expectation>`,
`subTest`, `contextlib.redirect_stderr` to swallow argparse's usage spill).

### No pre-existing test was weakened, skipped or deleted

- `git diff -- tests/test_build_index.py` and `git diff -- tests/test_paper_collector.py` contain
  **zero** `-` lines — both test files are **pure additions**.
- No `skip`, `skipIf`, `expectedFailure`, or `@unittest.*` decorator was added
  (`git diff -- tests/ | grep -E '^\+.*(skip|expectedFailure|@unittest\.)'` → none).
- Suite reports `skipped=0`.
- **All 55 pre-existing test ids survive, by name.** I extracted sorted test-id sets from the
  HEAD suite and the current suite and differenced them:

```
baseline unique test ids: 55
current  unique test ids: 73
=== MISSING from current (would be a deletion/rename) ===
(end)            <-- empty: nothing lost
=== ADDED in current ===  18 ids, all ParseArgsValidationTests /
                        CategoryArgumentTests / MaxPapersArgumentTests
```

- The two IMP-004 tests still pass **unmodified**: `MainTests` is byte-identical to HEAD
  (`test_refuses_to_write_index_when_a_category_query_fails` at
  `tests/test_build_index.py:366`, `test_writes_index_when_every_category_query_succeeds` at
  `:394`).

---

## 5. Backward compatibility — the main risk. No breakage found.

### 5.1 Every documented `readme.md` command still parses

I extracted every `python scripts/…` line from `readme.md` with a regex, `shlex`-tokenized it
(so the escaped-quote topic survives intact), and fed it to the real parser. **No network was
executed.**

| location | argv | result |
| --- | --- | --- |
| `readme.md:39` `python scripts/build_index.py` | `[]` | **OK** → `Namespace(out_dir='web/public/data', retention_days=60, max_per_category=0, abstract_chars=500, categories=None)` |
| `readme.md:89` `python scripts/paper-collector.py --topic "cat:cs.CV AND \"3d reconstruction\"" --max-papers 200` | `['--topic', 'cat:cs.CV AND "3d reconstruction"', '--max-papers', '200']` | **OK** → `topic='cat:cs.CV AND "3d reconstruction"'`, `max_papers=200`, `output_dir='results'` |
| `readme.md:95` `python scripts/paper-collector.py` | `[]` | **OK** → `topic=None`, `max_papers=1000` |

3 of 3 documented commands parse. The escaped-quote topic is preserved byte-for-byte.

### 5.2 Every CI and deploy command still parses — **the deploy is safe**

Exact flags each workflow passes, and the result:

| workflow:line | `run:` | argv to our parser | accepted? |
| --- | --- | --- | --- |
| `ci.yml:19` | `python -m unittest discover -s tests -v` | *(no script invoked)* | **OK** — unaffected by flag validation |
| `deploy.yml:31` | `pip install -r requirements.txt` | — | n/a |
| **`deploy.yml:34`** | **`python scripts/build_index.py`** | **`[]` — NO flags** | **OK** → all-defaults Namespace above |

**`deploy.yml:34` is the critical line and it is safe.** The deploy runs `build_index.py` with
**zero flags**, so it uses `DEFAULT_CATEGORIES` (`scripts/build_index.py:31`) and the stock
defaults — every one of which the new validation accepts (`retention_days=60 ≥ 1`,
`abstract_chars=500 ≥ 1`, `max_per_category=0 ≥ 0`, `out_dir='web/public/data'`). The new
`type=` callables only run on **user-supplied** values; argparse does not type-check defaults.
**No deployed flag value fails validation. The deploy does not break.**

No other workflow step touches `scripts/`. I also checked the two profile-documented smoke-run
recipes (§3.4) since a future contributor or implementer will copy them:

| argv | accepted? |
| --- | --- |
| `["--category","cs.CV","--max-per-category","20","--out-dir","/tmp/recon-index"]` | **OK** |
| `["--category","cs.CV","--max-per-category","300"]` | **OK** |

### 5.3 `paper-collector.py` with NO `--topic` still reaches its interactive prompt

Proved **end to end**, not just at the parser: I stubbed `fetch_papers` with a one-row
DataFrame, captured `builtins.input`, ran `main()` in a temp dir with `--output-dir` pointing
there, and restored `sys.argv`.

```
parse_args([]) -> topic=None -> is None: True
main() with NO --topic: rc=None        (NOT SystemExit 2 — no exit 2 anywhere)
prompt(s) shown: ['Enter the topic you need to search for : ']
files written: ['cat_cs.CV-1_papers_extracted_on_10-02-2026-11-39-03.html']
documented naming preserved: True
stdout: 'Number of papers extracted :  1\n…/cat_cs.CV-1_papers_extracted_on_…html file saved!'
```

The prompt is reached, the documented output naming
`<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html` is preserved, and no exit 2 occurs.
`rc=None` is **pre-existing** PY-14: `scripts/paper-collector.py:319` calls `main()` bare, so the
return value is discarded (profile §5.2 / bug PY-14). Not introduced by IMP-022.

### 5.4 No DEFAULT was changed — byte-compared against `git show HEAD:`

| default | HEAD | working tree | byte-identical? |
| --- | --- | --- | --- |
| `DEFAULT_RETENTION_DAYS` | `60` | `60` | **yes** |
| `DEFAULT_ABSTRACT_CHARS` | `500` | `500` | **yes** |
| `DEFAULT_MAX_AUTHORS` | `8` | `8` | **yes** |
| `DEFAULT_OUT_DIR` | `web/public/data` | `web/public/data` | **yes** |
| `DEFAULT_CATEGORIES` | `['cs.CV','cs.LG','cs.CL','cs.AI','cs.RO']` | same, same order | **yes** |
| `UNLIMITED` | `100000` | `100000` | **yes** |
| `--max-per-category` default | `0` | `0` | **yes** |
| `--out-dir` default | `DEFAULT_OUT_DIR` | `DEFAULT_OUT_DIR` | **yes** |
| `paper-collector --max-papers` | `1000` | `1000` | **yes** |
| `paper-collector --output-dir` | `results` | `results` | **yes** |
| `paper-collector --topic` | no default (`None`) | `None` | **yes** |

Live namespace diff, post-change `parse_args([])` vs HEAD `parse_args([])`:
`out_dir='web/public/data', retention_days=60, max_per_category=0, abstract_chars=500, categories=None`
— **identical to the HEAD namespace printed in `impl-IMP-022.md:236`.** No `type=` is applied to
any `default=`, so no default can be rejected at parse time.

**The legacy-CLI compatibility surface (profile §6) is fully intact:** `--topic`,
`--max-papers` (default 1000), `--save-csv`, `--output-dir` (default `results`),
`--download-pdfs`, `--download-sources` all keep their names, defaults and behaviour; the
`<topic>-<N>_papers_extracted_on_<...>.html` naming is preserved. **The only signature change is
`parse_args()` → `parse_args(argv=None)`, which is strictly additive** — `main()` at
`scripts/paper-collector.py:290` still calls `parse_args()` with no argument, so it still reads
`sys.argv`, and the `importlib.util.spec_from_file_location` test loader still works (proven: the
suite is green). No flag was renamed, removed, or re-defaulted.

---

## 6. IMP-004 interaction — the two exit codes are distinct and neither is confused

**Both codes verified with the network hard-blocked** (`socket.connect`,
`socket.create_connection`, `socket.getaddrinfo` all replaced by raising stubs that count
attempts).

### 6.1 A REJECTED `--category` exits 2 BEFORE any network call or file write

```
$ /usr/local/bin/python3.11 /tmp/vfy_imp004.py
SystemExit code = 2  (expected 2) -> True
network attempts during rejected parse: 0 -> True
/tmp/vfy-out created? False -> expected False
```

Exit 2, **zero** network attempts, and `--out-dir /tmp/vfy-out` was **never created**. This is
structurally guaranteed, not incidental: `main()` calls `parse_args()` as its very first statement
(`scripts/build_index.py:362`), and `os.makedirs` first happens inside `write_index()`
(`scripts/build_index.py:273`). Argument parsing strictly precedes any IO. The readme's promise
at `readme.md:49-50` ("rejected before anything is fetched or written") is **accurate**.

The suite guards this independently:
`CategoryArgumentTests.test_main_does_not_query_arxiv_for_a_rejected_category`
(`tests/test_build_index.py:565`) replaces `build_index.collect_papers` with a lambda that calls
`self.fail(...)` — so any query attempt at all fails the test.

### 6.2 A VALID category whose query FAILS still exits 1 (IMP-004's path), NOT 2

| scenario | result | wrote anything? |
| --- | --- | --- |
| malformed flag, valid everything else | **`SystemExit(2)`** | no dir created |
| valid `cs.CV`, query raises `ArxivError` | **`1`** | **no** |
| valid `cs.CV` + `cs.LG`, `cs.LG` query raises (mixed) | **`1`** | **no** |
| valid `cs.CV`, all queries return 0 papers | **`1`** | no |
| valid `cs.CV`, all queries succeed | `0` + `index.json` + shard written | yes |

Log lines confirming the IMP-004 path is reached and taken:

```
INFO:root:Querying cat:cs.CV (limit 100000) ...
ERROR:root:  query failed for cs.CV: simulated outage (https://export.arxiv.org/api/query)
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV.
```

**The two codes are not confused.** `2` is argparse's contract violation, raised inside
`parse_args` at `scripts/build_index.py:362`, strictly before `collect_papers` at `:366`.
`1` is IMP-004's hard-fail, returned by `main()` at `scripts/build_index.py:373-378` (and by
`:380-382` for the zero-paper case), after the network. IMP-004 was **not** weakened: the
`failures` list, the `except arxiv_common.arxiv.ArxivError` handler at
`scripts/build_index.py:237-238`, the `query failed for %s` log at `:241-243` and the
`return 1` at `:378` are all untouched by the diff, and the happy path still returns 0 and writes
both `index.json` and its shard.

### 6.3 Gap in the pre-existing IMP-004 test (not introduced by IMP-022)

`tests/test_build_index.py:388`, in `test_refuses_to_write_index_when_a_category_query_fails`:

```python
self.assertNotEqual(exit_code, 0)
```

**This would pass if `main()` returned 2.** It is the *only* test guarding IMP-004's own path,
and it does not pin the code. So the "both exit 2 → IMP-004 semantics broken" scenario my brief
asked about would **not** be caught by the suite — only by my §6.2 verification. To be fair to
the implementer: this is **pre-existing** (identical at `HEAD:tests/test_build_index.py:386`) and
the diff does not touch it, so it is not a regression. But since IMP-022 is precisely the change
that introduces a second exit code, tightening this one line is in-scope and cheap. The sibling
test `test_refuses_to_write_an_empty_index` (`tests/test_build_index.py:359`) already does it
correctly with `assertEqual(exit_code, 1)`. See §8 Finding 2.

---

## 7. Python version compatibility

`.github/workflows/ci.yml:15` and `.github/workflows/deploy.yml:28` both pin a **floating**
`python-version: "3.x"` (profile PE-10), so the code must behave on any recent CPython.

**No version-specific syntax.** The new code uses: f-strings (3.6+), `re.fullmatch` (3.4+),
`argparse.ArgumentTypeError` (3.0+), `raise … from None` (3.3+), nested closures, a
`parse.__name__` assignment. The new *tests* use `contextlib.redirect_stderr` (3.4+),
`assertLogs` (3.4+, already in the suite), `subTest` (3.4+). Nothing newer than **3.4** is
required, so the 3.x floor is comfortable.

**`argparse` custom types behave identically on the oldest supported version.** I replicated
`int_at_least`/`category` verbatim and ran 13 bad inputs + 12 good inputs on **every interpreter
on this machine**:

| interpreter | version | bad inputs | good inputs | identical? |
| --- | --- | --- | --- | --- |
| `/opt/homebrew/bin/python3.8` | 3.8.19 | all `SystemExit(2)` | all accepted | **yes** |
| `/usr/bin/python3` | 3.9.6 | all `SystemExit(2)` | all accepted | **yes** |
| `/usr/local/bin/python3.11` | 3.11.8 | all `SystemExit(2)` | all accepted | **yes** |
| `/opt/homebrew/bin/python3.12` | 3.12.7 | all `SystemExit(2)` | all accepted | **yes** |
| `/opt/homebrew/bin/python3.13` | 3.13.0 | all `SystemExit(2)` | all accepted | **yes** |
| `/opt/homebrew/bin/python3.14` | 3.14.3 | all `SystemExit(2)` | all accepted | **yes** |

```
### distinct codes for bad inputs: [2]  ALL_CORRECT=True     (× 6 interpreters)
```

**Message wording is byte-identical on 3.8.19 and 3.14.3** — I diffed the full output, not just
the codes:

```
3.8.19 : build_index.py: error: argument --retention-days: --retention-days accepts 1 or greater, got 0
3.14.3 : build_index.py: error: argument --retention-days: --retention-days accepts 1 or greater, got 0
3.8.19 : … --category value 'cs.CV foo' is not an arXiv category; expected a subject such as cs or cs.AI, …
3.14.3 : … --category value 'cs.CV foo' is not an arXiv category; expected a subject such as cs or cs.AI, …
```

Notably the `argument <flag>:` prefix that argparse adds **is** present on 3.8 through 3.14, so
the implementer's reason for baking the flag name into the message (D4) is belt-and-braces rather
than strictly necessary — but harmless, and it guarantees AC1's "naming the flag" wording holds
on any future argparse. The redundancy is a style choice, not a defect.

`--help` output uses argparse's standard `options:` heading on 3.11 (the `optional arguments:`
→ `options:` rename landed in 3.10). That is argparse's own wording, not this change's, and does
not affect any assertion.

Only 3.11 can run the full suite on this machine (3.12–3.14 lack `arxiv`/`pandas`, profile
PE-5/PE-9), so 3.8+ coverage above is the standalone-helper probe, which is the only part of the
new code with version-sensitive behaviour. `compileall` is clean on 3.11.

---

## 8. Findings

**No blocking issue. No acceptance criterion is unmet.** Three non-blocking observations, in
priority order:

### Finding 1 — `--category` has no length cap; a 300-char (or 50 000-char) value is accepted (LOW, spec-conformant)

`scripts/build_index.py:317` uses `CATEGORY_PATTERN.fullmatch(value)` with the spec's literal
pattern, which has no `{1,N}` bound. Measured: `--category "$(python -c 'print("a"*300)')"` →
**exit 0**, stored verbatim. Also 1 000 / 5 000 / 50 000 chars, all accepted.

**Not an AC2 failure** — AC2 mandates that exact pattern, and keeping it verbatim is the correct
reading. The real arXiv forms are all short, so nothing legitimate is affected.

**Impact:** a 300-char value still reaches `query = f"cat:{category}"`
(`scripts/build_index.py:226`) and produces the arXiv empty-feed response that IMP-022 exists to
eliminate — i.e. it reproduces the original "indistinguishable from no new papers" symptom, just
narrowly. Impact is low (it is a nonsense query, not an injection: the charset is `[a-zA-Z-.]`
only, so no shell, path or query-syntax metacharacter can ride along) but the guard is
incomplete.

**Not documented.** `.improve/reports/discovered-IMP-022.md` records D1 `--out-dir`, D2 pure
helpers, D3 `--topic`, D4 message redundancy, D5 helper duplication — **nothing about category
length**. Per profile §4.6 item 6, an unrecorded residual becomes the next implementer's blind
spot.

**Actionable:** add a length bound, e.g. `^[a-zA-Z-]{1,32}(\.[a-zA-Z-]{1,16})?$` (the longest
real form is `astro-ph.GR`/`q-bio.BM`-class, ~12 chars; 32/16 is generous), or a separate
`if len(value) > 32: raise` in `category()`. Add a subtest with `"a" * 300` to
`test_malformed_categories_are_rejected` and file the residual as D6. Amending `CATEGORY_PATTERN`
needs item-owner sign-off because AC2 quotes it verbatim.

### Finding 2 — the only IMP-004 test does not pin its exit code to 1 (LOW, pre-existing, one line)

`tests/test_build_index.py:388` asserts `assertNotEqual(exit_code, 0)`, which would pass if
`main()` returned 2. This is **pre-existing** (identical at `HEAD:386`) and outside the diff, so
it is not a regression — but IMP-022 is the change that introduces the competing exit code 2, so
the guard should match. `test_refuses_to_write_an_empty_index` at
`tests/test_build_index.py:359` already uses the correct `assertEqual(exit_code, 1)`.
**Actionable:** change line 388 to `self.assertEqual(exit_code, 1)`.

### Finding 3 — the readme ↔ `--help` reconciliation (AC5) is verified but not tested (LOW, informational)

`grep -rn "readme\|--help\|subprocess" tests/` → **no match**. Nothing in the suite reads
`readme.md` or captures `--help`, so the profile §4.5 agreement holds only because the implementer
checked it by hand in this change. The nearest test,
`MaxPapersArgumentTests.test_documented_example_command_still_parses`
(`tests/test_paper_collector.py:262`), hard-codes one readme example's argv rather than parsing
`readme.md` — so if the readme drifts, the test keeps passing.
**Actionable:** consider a test that extracts the `| \`--flag\` |` rows from `readme.md:102-109`
and asserts each flag exists in the parser, and/or that each range token in the readme appears in
`--help`. Would need a `subprocess` call for `--help` or a `build_parser()` refactor; a
readme-row-vs-parser test needs no subprocess and is the cheaper 80%.

### Report-accuracy nit (profile §4.6 item 7)

`impl-IMP-022.md:223-224` claims 12 behavioural tests in `test_build_index.py`; the measured
figure is **6 behavioural methods (18 subtest failures) plus 6 guards** (9 behavioural across the
whole change). Errs toward overstating, so it hides nothing, but the number is untraceable.

---

## 9. Confirmation of scope discipline

- Reviewed only `git diff -- scripts/ tests/ readme.md`. **`web/` was not read or analysed** —
  the `web/src/*` modifications in `git status` belong to the IMP-173 agent.
- `.kilo/worktrees/mildly-income` was never read, written or `cd`-ed into (profile §6).
- **No git write command was run** — no `commit`, `add`, `push`, `checkout`, `reset` or `stash`.
  All HEAD comparisons used read-only `git show HEAD:<path>` and `git diff`.
- **No source file was modified.** The only file written is this report,
  `.improve/reports/verify-IMP-022.md`. All scratch work is under `/tmp`
  (`/tmp/vfy-imp022/`, `/tmp/vfy_*.py`).
- `git status --short` is byte-identical to the status captured at the start of this review
  (same 9 modified + 6 untracked entries; `web/src/__tests__/*` and
  `.improve/reports/discovered-IMP-173.md` appeared from the concurrent agent during the
  review window, and are not mine).
- No network request was made at any point: the suite was run with sockets blocked, the CLI
  verifications used `parse_args` directly, and the one end-to-end `paper-collector` run had
  `fetch_papers` stubbed. `main()` was never allowed to reach a real client.
- No stray artifacts: `/tmp/rpf-cat` does not exist, and no directory was created inside the repo.

---

## 10. Summary

| AC | requirement | verdict |
| --- | --- | --- |
| **AC1** | 3 numeric flags reject out-of-range with exit 2 naming flag + range | **MET** — 12/12 bad values exit 2, every message names flag and range; boundaries accepted |
| **AC2** | `--category` matches the spec pattern, else exit 2 naming the value; real forms still accepted | **MET** — pattern byte-identical and used with `fullmatch`; all 15 real arXiv forms accepted incl. `cs.AI`/`stat.ML`/`astro-ph.HE`/`math.AG`/`eess.SY`/`q-bio.NC`; 30/30 injection shapes rejected with the value named. Residual: no length cap (spec-conformant, Finding 1) |
| **AC3** | `--max-papers < 1` exits 2; default `1000`; flag name unchanged | **MET** — 6/6 bad values exit 2; default 1000; name and all other flags untouched |
| **AC4** | tests assert `SystemExit` **with `code == 2`** + the two `categories` assertions | **MET** — all 4 `assertRaises` sites assert `.code == 2`; both `categories` assertions verified live |
| **AC5** | readme updated in the same change; both `--help` show the ranges | **MET** — same uncommitted change; zero value/range discrepancies across 11 flags. Not test-enforced (Finding 3) |

**Back-compatibility: clean.** 3/3 documented readme commands parse; `deploy.yml:34`
(`python scripts/build_index.py`, **no flags**) parses on stock defaults; `ci.yml` runs no script;
`paper-collector.py` with no `--topic` still reaches its prompt and keeps its documented output
naming; all 11 defaults byte-identical to HEAD; the only signature change is strictly additive.

**IMP-004: not weakened, not confused.** Rejected flag → `SystemExit(2)` with **0** network
attempts and no directory created; failed query on a valid category → **1**, writing nothing;
success → 0. The two codes are structurally separated at `scripts/build_index.py:362` vs `:373-378`.

**Tests: 73 = 55 baseline + 18, non-vacuous.** 9 of the 18 new tests fail against byte-identical
pre-fix sources; 9 are legitimate regression guards. All 55 pre-existing test ids survive; both
test files are pure additions (zero `-` lines); `skipped=0`; the two IMP-004 tests pass unmodified.

**Compatibility across Python 3.8.19 → 3.14.3: identical codes and byte-identical messages.**

**VERDICT: PASS**
