# Verification — IMP-023 "Make `safe_filename` a real sanitizer"

**Verifier:** independent, skeptical. Read-only; no source file touched, no git write command run.
**Scope reviewed:** `git diff -- scripts/ tests/` + untracked files in those trees (none — `git status` shows
no untracked entries under `scripts/` or `tests/`). `web/` ignored entirely per instruction.

```
$ git diff --numstat -- scripts/ tests/
41	2	scripts/paper-collector.py
83	0	tests/test_paper_collector.py
```

`web/src/**` entries in `git status` belong to the concurrent IMP-010 agent; not read, not reviewed.

---

## 1. Acceptance criteria

### Criterion 1 — `.`/`..`/empty/`path separator` — **MET**

`safe_filename` at `scripts/paper-collector.py:52-71`.

```
$ /usr/local/bin/python3.11 -c "import importlib.util; s=importlib.util.spec_from_file_location('pc','scripts/paper-collector.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(repr(m.safe_filename('..')), len(m.safe_filename('x'*400)))"
'_' 200
```

Trace for `".."` (`:60-63`): no control chars → illegal-char `re.sub` leaves `..` → `.strip()` → `..` →
`.strip(". ")` → `""` → `FALLBACK_SLUG = "_"`. Same for `"."`, `""`, `"  "`, `"..."`, `"/"`, `"a\x00"`.
`/` and `\` are consumed by the `r'[\\/:"*?<>|]+'` pass at `:61`, so no separator can survive — and
`safe_filename("/") == "_"`, so the absolute-path case is a non-empty component, not a root.

**End-to-end (criterion 4's D2 hole), synthetic one-member tarball through
`extract_source_archive`, cwd = `<sandbox>/work`, `./extracted` pre-created:**

```
=== '..'
  OLD slug='..' dest=./extracted/..   extract=ok  files=['src.tar.gz', 'work/main.tex']          <- escaped
  NEW slug='_'  dest=./extracted/_    extract=ok  files=['src.tar.gz', 'work/extracted/_/main.tex']
=== '.'
  OLD slug='.'  dest=./extracted/.    extract=ok  files=['src.tar.gz', 'work/extracted/main.tex']  <- wrong dir
  NEW slug='_'  dest=./extracted/_    extract=ok  files=['src.tar.gz', 'work/extracted/_/main.tex']
=== 'x'*400
  OLD  extract=OSError: [Errno 63] File name too long: './extracted/xxx…'   files=['src.tar.gz']
  NEW  extract=ok  files=['src.tar.gz', 'work/extracted/xxx…(200)/main.tex']
=== '深'*400
  OLD  extract=OSError: [Errno 63] File name too long: './extracted/深深…'   files=['src.tar.gz']
  NEW  extract=ok  files=['src.tar.gz', 'work/extracted/深深…(198 bytes)/main.tex']
```

The implementer's §5.1 claim reproduces exactly. `filter="data"` at `paper-collector.py:162` (IMP-024) is
untouched and, as the spec says, constrains members only — criterion 1 is what closes the destination.

**Fuzz coverage.** `/tmp/v023_property2.py`, 5300 inputs (random over `string.printable` + CJK/emoji/RTL/
ZWSP/astral-plane + `.`/`/`/`\`/`:`/`*`/`?`/`<`/`>`/`|`/`"`/NUL/newline/DEL + `CON`/`con`/`NUL`/`aux`/
`COM1`/`LPT9` + whitespace + shell metacharacters + 300–1200-char repeats), asserting
non-empty ∧ ∉{`.`,`..`} ∧ no separator ∧ no NUL/control ∧ ≤200 bytes ∧ not absolute ∧ no trailing dot/space:

```
fuzz inputs: 5300, property failures: 0
mojibake round-trip failures: 0
```

`/tmp/v023_property.py` additionally built all 934 outputs as real directories (`os.makedirs`,
`exist_ok=False`, `rmdir`): **filesystem round-trip failures: 0**.

### Criterion 2 — 200 **UTF-8 bytes** / reserved names / no split characters — **MET, with one caveat**

* **Byte cap, not char cap** — `:44-49` encodes, slices **bytes**, decodes with `errors="ignore"`, so a
  partial trailing character is dropped rather than mangled.
  `"x"*400` → exactly 200 bytes. `"深"*400` → `"深"*66` = 198 bytes. `"😀"*400` → 200 bytes / 50 chars.
* **Exhaustive boundary property** (`/tmp/v023_property2.py`): for each of 6 multi-byte chars
  (`é 深 😀 𝄞 ß א`) × every prefix length 0–209 (1260 cases), assert output ≤ 200 bytes **and** byte-identical
  to `utf8[:200].decode("utf-8","ignore")`:
  ```
  boundary exhaustive checks: 1260, failures=0
  ```
* **Worst-case suffix budget** — `{slug}-{1000}_papers_extracted_on_02-02-2026-10-12-33.html` stays ≤ 255
  bytes for every one of the 934 inputs (asserted in `/tmp/v023_property.py`, 0 violations). 200 leaves
  ~46 bytes of headroom for the `.tar.gz` / `.pdf` / `_papers.csv` suffixes.
* **Reserved names** — `:37-41` builds the 22 names, `:65` matches `cleaned.split(".")[0].upper()`
  (stem before the **first** dot, i.e. the correct Windows rule). Verified all 22 × {lower, title, upper}:
  `CON→CON_`, `com9→com9_`, `LPT9→lpt9_`, and correctly leaves `CONSORTIUM`/`com10`/`lpt0`/`auxiliary
  losses` untouched.

**Caveat (issue I1, low severity): extension forms are not actually neutralized on Windows.** The `_` is
appended to the **end of the whole slug** (`:67`), so for a name that already has an extension the device
stem survives:

```
'con.txt'          -> 'con.txt_'          stem='CON'   STILL_DEVICE=True
'NUL.tar.gz'       -> 'NUL.tar.gz_'       stem='NUL'   STILL_DEVICE=True
'con.tar.gz'       -> 'con.tar.gz_'       stem='CON'   STILL_DEVICE=True
'aux.md'           -> 'aux.md_'           stem='AUX'   STILL_DEVICE=True
'COM1.json'        -> 'COM1.json_'        stem='COM1'  STILL_DEVICE=True
'lpt9.csv'         -> 'lpt9.csv_'         stem='LPT9'  STILL_DEVICE=True
'CON' / 'con'      -> 'CON_' / 'con_'     stem='CON_'  STILL_DEVICE=False   (correct)
'CONSORTIUM'       -> 'CONSORTIUM'        (correct)
```

Windows takes the device name from the portion before the first dot and ignores the extension, which is
exactly why Microsoft documents `NUL.txt` and `NUL.tar.gz` as reserved. `con.txt_` still resolves to the
console device. Appending to the **stem** (`con_.txt`, `NUL_.tar.gz_`) would fix it. This is **not a
regression** — the old helper returned `con.txt`, equally a device — and the criterion's literal wording
("gains a `_` suffix") is satisfied, so I score criterion 2 MET. But the stated intent is only
partially achieved on Windows.

**Test-coverage gap that lets I1 through:** `test_reserved_name_before_a_long_extension_is_still_suffixed`
(`tests/test_paper_collector.py:109-112`) asserts only `startswith("CON.x")` and a byte bound; it never
asserts that the result is no longer a device name, and no test covers `con.txt` / `NUL.tar.gz` at all.

*Ordering claim verified:* the reserved check runs on the untruncated string and the cap after; truncation
only removes a suffix, so the before-first-dot prefix is unchanged and the two orders are equivalent.

### Criterion 3 — new tests cover `.`, `..`, 400-char, `CON`; two existing tests still pass — **MET**

`tests/test_paper_collector.py:46-127` — 9 new methods appended to `SafeFilenameTests`:
`.`/`..` at `:46`, 400-char at `:73`, `CON` + all 21 siblings at `:95`, long-extension form at `:109`.
The two pre-existing tests (`:36` `test_strips_illegal_filesystem_characters`, `:42`
`test_leaves_normal_titles_unchanged`) are byte-identical and both pass.
`git diff --numstat` = `83 0` — **zero deletions**, `git diff -U0 | grep -c '^-[^-]'` = **0**. No assertion
loosened, no test skipped, none deleted. `git show HEAD:tests/… | grep -n skipTest` shows the only
`skipTest` is at HEAD:252 (pre-existing, IMP-024) — no new skips.
Test count in the file: **12 → 21**.

*Spec nit:* `.improve/FEATURES.md:513` points at "the two existing `SafeFilenameTests` at `:22-31`"; at HEAD
those lines are `make_frame()`/blank — the tests are at HEAD `:35-44`. Stale reference in the spec, not an
implementer error.

### Criterion 4 — this item, not IMP-024, makes the destination safe — **MET**

`filter="data"` at `paper-collector.py:162` untouched (IMP-024's diff is not in this change).
Demonstrated above: `slug='..'` under the old helper lands `main.tex` at the process CWD *with nothing
rejected and nothing logged*; under the new helper it lands inside `./extracted/_/`.

---

## 2. Case-insensitive-filesystem safety

This machine's filesystem is case-insensitive (APFS default), confirmed empirically
(`/tmp/v023_property2.py` → `filesystem case-insensitive: True`). All outputs are non-empty, dot-free,
separator-free and creatable, so nothing escapes. Collisions observed:

| pair | same dir on disk? | new? |
| --- | --- | --- |
| `"Report"` / `"report"` | yes | pre-existing (old helper collided too) |
| `"A Study"` / `"A study"` | yes | pre-existing |
| `"NUL"` / `"nul"` | yes (`nul_`) | pre-existing |
| `"CON"` / `"CON_"` | yes (`con_`) | **new** — the `_` suffix scheme now collides with a paper literally titled `CON_` (also `NUL`/`NUL_`, …), on a case-sensitive FS too |
| `".."` / `"."` / `"///"` / any paper titled `_` | yes, all → `_` | same class as above; disclosed by the implementer (§8) |

Consequence is bounded: the collision merges two papers' `./extracted/<slug>` directories and makes the
second `download_source(filename=f"{slug}.tar.gz")` overwrite the first. No traversal, no escape. Impact
is negligible in practice (real paper titles), and every alternative fallback name has the same property.
**Issue I2 — informational, not blocking.**

## 3. Over-mangling check — the real risk to the user

**Real arXiv corpus, not synthetic.** 2812 real titles pulled from `web/public/data/papers-2026-W39.json`
and `papers-2026-W40.json` and pushed through `safe_filename`:

```
real arXiv titles found: 2812
titles whose slug is 'destroyed' (no alnum, or <50% char prefix kept): 2
    keep=0.06 'BLT*: Informed Belief Localization Trees…'          -> 'BLT_ Informed Belief Localization Trees…'
    keep=0.18 'Science or Slop?: Benchmarking and Mitigating…'    -> 'Science or Slop_ Benchmarking and Mitigating…'
over 200 bytes: 0
titles whose leading/trailing dots/spaces were stripped: 0 []
most-replaced chars: [(':', 1837), ('?', 137), (' ', 18), …, ('/', 7), ('\\', 6), …]
sample slugs:
   'Conformal Factuality Control for Multi-Hop Retrieval-Augment' -> 'Conformal Factuality Control for Multi-Hop Retrieval-Augment'
   'TutlAit v1: a crowdsourced Moroccan Tamazight speech dataset'  -> 'TutlAit v1_ a crowdsourced Moroccan Tamazight speech dataset'
```

The 2 flagged rows are artifacts of my prefix-alignment heuristic (one `*`/`?` replaced early in the
string shifts everything); both outputs are fully readable. Nothing is collapsed to `_`; **0 titles
exceed the cap; 0 titles lose a leading/trailing dot or space.** The only characters touched are the
pre-existing `:`/`?`/`/`/`\`/`*` set.

**The task's required examples** (`/tmp/v023_mangle.py`, old vs new side by side):

```
'cat:cs.CV'                       -> 'cat_cs.CV'                      = (unchanged)
'cat:cs.LG / transformers'        -> 'cat_cs.LG _ transformers'        = (unchanged)
'diffusion models'                -> 'diffusion models'                = (unchanged)
'computer-vision'                 -> 'computer-vision'                 = (unchanged)
'graph neural networks'           -> 'graph neural networks'           = (unchanged)
'cat:cs.CV AND "3d reconstruction"' -> 'cat_cs.CV AND _3d reconstruction_' = (unchanged)
'cs.CV'                           -> 'cs.CV'                           = (unchanged)
'Retinal vessel segmentation with U-Net' -> unchanged                   =
'A Simple Paper Title'            -> unchanged                          =
```

Prefix-retention for every realistic topic is **1.00**. The readme's own example
(`readme.md:83`, `cat:cs.CV AND "3d reconstruction"`) is byte-identical to before. **PASS on
over-mangling.**

Visible behaviour changes, all intentional and documented in the report's §9:

* `Vol. 1.` → `Vol. 1`, `.gitignore` → `gitignore` (`:61`/`:71` strip leading/trailing dots). Neither
  pattern occurs in the 2812-title corpus; both are Windows-correct (trailing dots are trimmed silently
  there; a leading dot is a hidden file).
* Truncation is a plain byte cut, so a >200-byte title loses its tail mid-word. Required by the spec.

## 4. Documented flags and `--help`

`argparse` block `:166-194` is not in the diff.

```
$ diff /tmp/v023-help-old.txt /tmp/v023-help-new.txt && echo "HELP IDENTICAL"
HELP IDENTICAL            # both --help runs exit 0
```

**IMP-002's single-slug structure is intact.** `paper-collector.py:277` computes
`topic_slug = safe_filename(topic)` once and both paths derive from it, joined onto `--output-dir`:
`:281` `os.path.join(args.output_dir, f"{topic_slug}_papers.csv")` and `:284-287`
`os.path.join(args.output_dir, f"{topic_slug}-{len(df)}_papers_extracted_on_{prefix}.html")`.
Verified live with a stubbed `fetch_papers` — baseline and new produce **identical** filenames:

```
base: ['cat_cs.CV AND _3d reconstruction_-1_papers_extracted_on_10-02-2026-…html',
       'cat_cs.CV AND _3d reconstruction__papers.csv']
new:  ['cat_cs.CV AND _3d reconstruction_-1_papers_extracted_on_10-02-2026-…html',
       'cat_cs.CV AND _3d reconstruction__papers.csv']
```

`test_plain_topic_keeps_documented_html_naming` (`:225`) still passes. The extraction path
(`:211` → `:214`, `:216`, `:218`) also uses the new sanitizer for all three of its uses.

## 5. Exit codes and CLI ergonomics — unchanged

`--topic ''` still hits the interactive prompt; **not** accidentally fixed:

```
base: /usr/local/bin/python3.11 …/paper-collector.py --topic '' --output-dir … </dev/null  → exit=1, EOFError
new:  /usr/local/bin/python3.11 …/paper-collector.py --topic '' --output-dir … </dev/null  → exit=1, EOFError
```

`:267` (`args.topic or input(...)`) is outside the diff, so the pre-existing `''`/EOF behaviour is
untouched. Correctly out of scope for IMP-023 — a sanitizer change must not alter CLI semantics.
Exit code remains 0 on success because `main()` is still called bare at `:294` (pre-existing D3).

## 6. Non-vacuity — independently reproduced

Scratch copy under `/tmp/v023`: baseline `scripts/paper-collector.py` from `git show HEAD:` (old
one-liner `safe_filename` verified present at `:30-32`) + the **new** test file.

```
$ cd /tmp/v023 && /usr/local/bin/python3.11 -m unittest discover -s tests -p "test_paper_collector.py" -k SafeFilename
Ran 11 tests in 0.004s
FAILED (failures=77)
```

| failing test (vs old helper) | subTest failures |
| --- | --- |
| `test_caps_the_slug_by_utf8_bytes_not_characters` | 1 |
| `test_dot_only_titles_are_never_directory_references` | 5 |
| `test_replaces_control_characters` | 1 |
| `test_reserved_name_before_a_long_extension_is_still_suffixed` | 1 |
| `test_truncation_never_splits_a_multibyte_character` | 3 |
| `test_windows_reserved_names_gain_an_underscore_suffix` | 66 |

**Exactly 6 of the 9 new tests fail against the old helper** — matches the report's claim. The 3 that
pass both ways (`test_no_input_produces_a_path_separator`,
`test_names_that_only_start_like_a_device_are_untouched`, `test_documented_topics_stay_readable`) are
disclosed regression guards, and I agree they are appropriate: they pin the properties the change must
not break.

## 7. Suite run from repo root

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 53 tests in 0.049s

OK
```

Baseline re-measured from a pristine `git archive HEAD` checkout in `/tmp/v023base`:

```
$ cd /tmp/v023base && /usr/local/bin/python3.11 -m unittest discover -s tests
Ran 44 tests in 0.031s

OK
```

**44 → 53, 9 added, 0 failures, 0 errors, 0 skips.** Matches the report.

## 8. Python-version compatibility

`.github/workflows/ci.yml:15` pins a floating `python-version: "3.x"`; the only locally provisioned
interpreter with deps is `/usr/local/bin/python3.11` (REPO_PROFILE §3.1). The change uses only
`re.sub`, `frozenset`, f-strings, `str.encode`, `bytes.decode(errors="ignore")`, `str.split`/`strip`/
`rstrip` — all present since 3.0. No walrus in a comprehension, no `match`, no `str.removeprefix`, no
tarfile-version branch, no `sys.version_info` gate. The sanitizer slice was `exec`'d from the real file
under three interpreters with **byte-identical** results:

```
/usr/bin/python3        3.9.6  {'dotdot':'_','dot':'_','empty':'_','len400':200,'cjk':('深'*66,198),
                                'emoji400':(200,50),'CON':'CON_','con.txt':'con.txt_','NUL.tar.gz':'NUL.tar.gz_',
                                'cat:cs.CV':'cat_cs.CV','diffusion':'diffusion models','reserved400':(200,'xxx_')}
/usr/local/bin/python3.11 3.11.8  (identical)
/opt/homebrew/bin/python3 3.14.3 (identical)
```

Nothing newer than 3.0 is used; **3.9.6 is already a floor comfortably below both the provisioned 3.11 and
the floating 3.x CI resolves to.** (`/usr/bin/python3` cannot import the module itself — it lacks
`arxiv`/`pandas` — so the slice was exec'd, matching the profile's documented workaround.)

---

## 9. Issues

| # | Severity | Issue |
| --- | --- | --- |
| **I1** | low | `paper-collector.py:67` appends the reserved-name `_` **after** any extension, so `con.txt` → `con.txt_`, `NUL.tar.gz` → `NUL.tar.gz_`, `COM1.json` → `COM1.json_`. Windows resolves a device name from the stem before the **first** dot and ignores the extension (Microsoft explicitly lists `NUL.txt`/`NUL.tar.gz` as reserved), so these results are still device names. **Fix:** append to the stem — `con` → `con_.txt` / `NUL_.tar.gz_`. Not a regression (the old helper was equally broken) and criterion 2 is literally met, so this does not fail the item, but the intent is not fully delivered on Windows. |
| **I2** | low / informational | `tests/test_paper_collector.py:109-112` asserts only `startswith("CON.x")`, so I1 is invisible to the suite. Add a case asserting the *result* is not a device name for `con.txt`, `NUL.tar.gz`, `COM1.json`, and an implementation fix per I1. |
| **I3** | informational | Collision surface widened by the suffix scheme: a paper titled `CON_` now shares `./extracted/CON_` and the same `{slug}.tar.gz` filename with a paper titled `CON`; likewise every dot-only title (`..`, `.`, `///`) and any title literally `_` share `FALLBACK_SLUG = "_"`. On this APFS volume `CON`/`con_`, `Report`/`report`, `A Study`/`A study`, `NUL`/`nul` all resolve to one directory (`os.path.samefile` → `True`). Bounded to overwriting a download; no traversal. Acceptable, but worth a one-line note in the module docstring since the slug is now a de-facto primary key for the extraction tree. |
| **I4** | informational | Leading dashes are preserved: `safe_filename("-rf") == "-rf"`, `safe_filename("--topic") == "--topic"`. Not a hazard here — the slug is only ever handed to `open()`, `Result.download_pdf/download_source(filename=…)` and `tarfile`, never to a shell or `subprocess`, and `f"{slug}.pdf"`/`f"{slug}.tar.gz"` always carry a suffix so they cannot be parsed as options. Pre-existing behaviour, consciously retained; no test pins it. |
| **I5** | process | `.improve/FEATURES.md:505` still reads `Status: IN-PROGRESS` for IMP-023 rather than `DONE`. Separately, REPO_PROFILE §4.6 item 6 requires every §9 line a change touches to be fixed by id or consciously left; the report never mentions **PY-28** (`REPO_PROFILE.md:806`), which still describes the topic→filename defect as live even though IMP-002 closed the traversal half and this item closes the dot/byte/reserved half. |

**No blockers.** Nothing in the change is a security regression, no existing test was weakened, no
flag/default/command changed, and no legitimate topic is over-mangled (0 of 2812 real arXiv titles
damaged).

## 10. Verdict

**PASS.** 4/4 acceptance criteria met. `safe_filename` is now a real sanitizer: no input yields `.`,
`..`, empty, a separator, an absolute path, a control character, or more than 200 UTF-8 bytes; truncation
never splits a character (1260 exhaustive boundary cases); the 22 Windows device names are matched
case-insensitively on the stem. 53/53 tests pass against a 44-test baseline, 6 of the 9 new tests are
proven non-vacuous, `--help` is byte-identical, exit codes and the `--topic ''` prompt behaviour are
unchanged, and the code is identical on Python 3.9.6/3.11.8/3.14.3. Three low-severity findings above
(I1/I2 stem-suffix, I3 collisions, I5 bookkeeping) are worth a follow-up but do not block this item.

---

### Commands run (all read-only; scratch work confined to `/tmp`)

```
git status --porcelain
git diff -- scripts/ tests/
git diff --numstat -- scripts/ tests/
git diff -U0 -- tests/test_paper_collector.py | grep -c '^-[^-]'          # 0
git show HEAD:scripts/paper-collector.py | grep -n "def safe_filename" -A3
git show HEAD:tests/test_paper_collector.py | grep -c "    def test_"     # 12
grep -c "    def test_" tests/test_paper_collector.py                      # 21
git show HEAD:tests/test_paper_collector.py | grep -n skipTest             # 252 only (pre-existing)
git diff -- .improve/FEATURES.md
cat -n .github/workflows/ci.yml
sed -n '305,325p' .improve/REPO_PROFILE.md

/usr/local/bin/python3.11 -m unittest discover -s tests -v                  # Ran 53, OK
cd /tmp/v023base && /usr/local/bin/python3.11 -m unittest discover -s tests # Ran 44, OK
cd /tmp/v023 && … -p "test_paper_collector.py" -k SafeFilename              # Ran 11, FAILED (failures=77)
/usr/local/bin/python3.11 scripts/paper-collector.py --help                 # vs baseline: identical
/usr/local/bin/python3.11 /tmp/v023_property.py                             # 934 inputs, 0 FS failures
/usr/local/bin/python3.11 /tmp/v023_property2.py                            # 5300 inputs, 0 failures
/usr/local/bin/python3.11 /tmp/v023_mangle.py                               # old-vs-new table
/usr/local/bin/python3.11 /tmp/v023_e2e.py                                  # tar extraction harness
for p in /usr/bin/python3 /usr/local/bin/python3.11 /opt/homebrew/bin/python3;
    do $p /tmp/v023_xver2.py; done                                           # 3.9.6/3.11.8/3.14.3 identical
```