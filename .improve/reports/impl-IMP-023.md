# IMP-023 implementation report — make `safe_filename` a real sanitizer

**Status:** implemented, 53/53 Python tests pass (baseline was 44/44).
**First attempt** — `.improve/reports/verify-IMP-023.md` did not exist.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `scripts/paper-collector.py` | +43 / −2. Three module constants (`:32-41`), one new helper `truncate_to_bytes` (`:44-49`), `safe_filename` rewritten (`:52-71`). Nothing else touched. |
| `tests/test_paper_collector.py` | +83 / −0, entirely additive: 9 new methods appended to the existing `SafeFilenameTests` class (`:46-127`). The two pre-existing tests are byte-identical. |

Not touched: `web/` (another agent owns it — `git status` shows `web/src/lib/urlState.ts`
modified by that agent, not by me), `notebooks/paper-collector.ipynb`, `readme.md`,
`CONTRIBUTING.md`, `.improve/FEATURES.md`.

```
$ git status --porcelain          # taken at the end of the run
 M scripts/paper-collector.py
 M tests/test_paper_collector.py
 M web/src/App.tsx                 <- the concurrent web agent's, not mine
 M web/src/components/FeedControls.tsx   <- idem
 M web/src/lib/urlState.ts         <- idem
?? .improve/reports/discovered-IMP-002.md   <- pre-existing, not mine
?? .improve/reports/discovered-IMP-009.md   <- pre-existing, not mine
?? .improve/reports/discovered-IMP-023.md   <- mine
?? .improve/reports/impl-IMP-023.md         <- mine

$ git diff --stat -- scripts tests
 scripts/paper-collector.py    | 43 ++++++++++++++++++++--
 tests/test_paper_collector.py | 83 +++++++++++++++++++++++++++++++++++++++++++
```

The three `web/**` entries belong to the agent working on `web/` in parallel; they changed between
my first and last `git status` and I did not read or write any of them.

## 2. The sanitization rules implemented

`safe_filename(title)` (`scripts/paper-collector.py:52-71`) applies these passes, in order:

1. **Control characters → `_`** — `re.sub(r"[\x00-\x1f\x7f]", "_", title)`. Covers NUL, `\n`,
   `\r`, `\t` and DEL. NUL in particular is not merely ugly: it truncates the name in every
   syscall that receives it.
2. **Illegal filename characters → `_`** — the pre-existing `re.sub(r'[\\/:"*?<>|]+', "_", ...)`,
   unchanged, so `/` and `\` can never survive.
3. **Trim** — `.strip()` (pre-existing behaviour, keeps Unicode whitespace handling) then
   `.strip(". ")` so leading/trailing dots go too.
4. **Empty fallback** — if nothing usable is left (`.`, `..`, `...`, `"   "`, `"/"`, `"a\x00"`),
   return `FALLBACK_SLUG = "_"`, which is neither `.`, nor `..`, nor empty.
5. **Windows reserved device names → `_` suffix** — if `cleaned.split(".")[0].upper()` is in
   `WINDOWS_RESERVED_NAMES` (the 22 names the spec lists: `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`,
   `LPT1`-`LPT9`), append `_`. Splitting on the **first** dot is the correct Windows rule: `CON.txt`
   names the console device too.
6. **UTF-8 byte cap** — `truncate_to_bytes(cleaned, MAX_SLUG_BYTES)` where `MAX_SLUG_BYTES = 200`.
   It encodes to UTF-8, slices the **bytes**, and decodes with `errors="ignore"`, so a multi-byte
   character can never be split (the partial trailing char is dropped, not mangled). In the reserved
   branch it caps at `MAX_SLUG_BYTES - 1` and *then* appends `_`, so the final result still obeys
   the 200-byte cap rather than 201.
7. **Final `rstrip(". ")`** — byte truncation can leave the name ending on a dot (e.g. `"aa.bbbb"`
   cut at 3 bytes → `"aa."`), which Windows silently trims; this keeps the output deterministic.

Ordering note: the reserved-name check (5) runs on the untruncated string and the cap (6) after.
I checked these are equivalent — truncation only removes a tail, so it can only change the
before-the-first-dot prefix when the first dot is itself past byte 200, and in that case neither
version can be one of the 22 short device names.

### Why `MAX_SLUG_BYTES = 200` and not 255

The spec says "at most 200 bytes" and the value also leaves headroom: the slug is used as
`{slug}_papers.csv`, `{slug}.pdf`, `{slug}.tar.gz` and as the extraction directory name, so 200
leaves ≥45 bytes of slack under the 255-byte ext4/APFS/NTFS name limit for every suffix appended.

## 3. Mapping to the acceptance criteria

| # | Criterion | How it is met | Evidence |
| --- | --- | --- | --- |
| 1 | `safe_filename("..")` and `safe_filename(".")` are not `.`/`..`/empty; no input produces a path separator | Steps 2-4. `/`, `\` are replaced (step 2) so no separator can survive; dot-only input collapses to `"_"` (step 4) | `test_dot_only_titles_are_never_directory_references`, `test_no_input_produces_a_path_separator`; `safe_filename("..") == "_"`, `safe_filename(".") == "_"`, `safe_filename("") == "_"` |
| 2 | ≤ 200 UTF-8 **bytes**; reserved stem gains `_`; truncation never splits a multi-byte character | Steps 5-6 + `truncate_to_bytes` | `test_caps_the_slug_by_utf8_bytes_not_characters` (asserts exactly 200 bytes for `"x"*400`, 198 bytes for `"深"*400`), `test_truncation_never_splits_a_multibyte_character` (2-, 3- and 4-byte characters), `test_windows_reserved_names_gain_an_underscore_suffix` (all 22 names × 3 case variants = 66 assertions), `test_reserved_name_before_a_long_extension_is_still_suffixed` |
| 3 | New tests cover `.`, `..`, a 400-character title, `CON`; the two existing `SafeFilenameTests` still pass | 9 new methods; `.`/`..` in the dot-only test, `"x"*400` in the cap test, `CON` (plus all 21 other reserved names) in the reserved test. The two existing tests are unmodified and pass | see §4 and §5 |
| 4 | This item, not IMP-024, is what makes the extraction destination safe | The slug is now a safe path component *before* it is interpolated into `./extracted/{slug}` (`paper-collector.py:211-218`). IMP-024's `filter="data"` is untouched and still only constrains members | see the end-to-end extraction demo in §5 |

## 4. Commands run, verbatim results

### 4.1 Suite — baseline before the change

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 44 tests in 0.031s

OK
```

### 4.2 Suite — after the change

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
test_paper_collector.SafeFilenameTests.test_caps_the_slug_by_utf8_bytes_not_characters ... ok
test_paper_collector.SafeFilenameTests.test_documented_topics_stay_readable ... ok
test_paper_collector.SafeFilenameTests.test_dot_only_titles_are_never_directory_references ... ok
test_paper_collector.SafeFilenameTests.test_leaves_normal_titles_unchanged ... ok
test_paper_collector.SafeFilenameTests.test_names_that_only_start_like_a_device_are_untouched ... ok
test_paper_collector.SafeFilenameTests.test_no_input_produces_a_path_separator ... ok
test_paper_collector.SafeFilenameTests.test_replaces_control_characters ... ok
test_paper_collector.SafeFilenameTests.test_reserved_name_before_a_long_extension_is_still_suffixed ... ok
test_paper_collector.SafeFilenameTests.test_strips_illegal_filesystem_characters ... ok
test_paper_collector.SafeFilenameTests.test_truncation_never_splits_a_multibyte_character ... ok
test_paper_collector.SafeFilenameTests.test_windows_reserved_names_gain_an_underscore_suffix ... ok

----------------------------------------------------------------------
Ran 53 tests in 0.033s

OK
```

**44 → 53 tests, 9 added, 0 failures, 0 errors, 0 skips.** `test_paper_collector.py` 12 → 21.

### 4.3 The spec's own verification command

```
$ /usr/local/bin/python3.11 -c "import importlib.util,sys; s=importlib.util.spec_from_file_location('pc','scripts/paper-collector.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(repr(m.safe_filename('..')), len(m.safe_filename('x'*400)))"
'_' 200
```

### 4.4 Syntax / import check

```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests && echo "compileall exit 0"
compileall exit 0
```

### 4.5 `--help` is byte-identical (flags, defaults, order unchanged)

```
$ /usr/local/bin/python3.11 scripts/paper-collector.py --help
usage: paper-collector.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
                          [--output-dir OUTPUT_DIR] [--download-pdfs]
                          [--download-sources] [--save-csv]

Extract research papers from ArXiv into an HTML feed.

options:
  -h, --help            show this help message and exit
  --topic TOPIC         ArXiv search query, e.g. 'cat:cs.CV AND "3d
                        reconstruction"'. Prompted for interactively if
                        omitted.
  --max-papers MAX_PAPERS
                        Maximum number of papers to pull (default: 1000).
  --output-dir OUTPUT_DIR
                        Directory the generated HTML feed is written to
                        (default: results).
  --download-pdfs       Also download each paper's PDF.
  --download-sources    Also download and extract each paper's LaTeX source
                        archive.
  --save-csv            Also save the extracted metadata as a CSV file.
```

### 4.6 Readability of the documented topics (no over-mangling)

Measured by `test_documented_topics_stay_readable` and cross-checked directly:

| Input | Before | After |
| --- | --- | --- |
| `cat:cs.CV` | `cat_cs.CV` | `cat_cs.CV` (unchanged) |
| `diffusion models` | `diffusion models` | `diffusion models` (unchanged) |
| `computer-vision` | `computer-vision` | `computer-vision` (unchanged) |
| `cat:cs.CV AND "3d reconstruction"` (readme.md:83) | `cat_cs.CV AND _3d reconstruction_` | `cat_cs.CV AND _3d reconstruction_` (unchanged) |
| `A Simple Paper Title` (pre-existing test) | unchanged | unchanged |
| `CON` | `CON` | `CON_` |
| `CONSORTIUM`, `com10`, `auxiliary losses` | unchanged | unchanged |

The documented HTML name for `cat:cs.CV` is still `cat_cs.CV-1_papers_extracted_on_<stamp>.html`;
`MainOutputPathTests.test_plain_topic_keeps_documented_html_naming` (IMP-002) still passes unchanged.

## 5. Non-vacuity — the new tests fail without the fix

A scratch copy of `scripts/` + `tests/` was made in `/tmp/imp023-scratch/`, `safe_filename` there
was reverted to the exact pre-change one-liner, and only `SafeFilenameTests` was run:

```
$ cd /tmp/imp023-scratch && /usr/local/bin/python3.11 -m unittest discover -s tests -p "test_paper_collector.py" -k SafeFilename
FAIL: test_caps_the_slug_by_utf8_bytes_not_characters (...SafeFilenameTests...
FAIL: test_dot_only_titles_are_never_directory_references (...SafeFilenameTests...
FAIL: test_replaces_control_characters (...SafeFilenameTests...
FAIL: test_reserved_name_before_a_long_extension_is_still_suffixed (...SafeFilenameTests...
FAIL: test_truncation_never_splits_a_multibyte_character (...SafeFilenameTests...
FAIL: test_windows_reserved_names_gain_an_underscore_suffix (...SafeFilenameTests...
Ran 11 tests in 0.004s

FAILED (failures=77)
```

6 of the 9 new tests fail against the old helper (77 failures counting `subTest` cases), including
all four cases the spec requires (`.`, `..`, 400-char, `CON`). The other 3 new tests
(`test_no_input_produces_a_path_separator`, `test_names_that_only_start_like_a_device_are_untouched`,
`test_documented_topics_stay_readable`) pass both before and after **by design** — they are
regression guards that pin behaviour the old code already had and that this change must not break.

The scratch copy has been left at `/tmp/imp023-scratch/` (outside the repo) for inspection.

### 5.1 Criterion 4, demonstrated end to end with a real tarball

A synthetic one-member tarball (`main.tex`) extracted through `extract_source_archive`, with
`./extracted` pre-created (the state a real `--download-sources` run reaches), cwd `<sandbox>/work`:

```
=== OLD helper, paper titled '..' ===
  slug='..'  dest=./extracted/..  (cwd = <sandbox>/work)
  files under sandbox: ['src.tar.gz', 'work/main.tex']        <- landed OUTSIDE ./extracted/<slug>

=== NEW helper, paper titled '..' ===
  slug='_'  dest=./extracted/_  (cwd = <sandbox>/work)
  files under sandbox: ['src.tar.gz', 'work/extracted/_/main.tex']
```

This is exactly the D2 hole described in `.improve/reports/discovered-IMP-024.md` and in
criterion 4: `main.tex` lands in the process CWD — the repository root, when the documented
command is run from the repository root — and IMP-024's `filter="data"` accepts it silently,
because the member name itself is perfectly benign and the *destination* is what is wrong.

Same harness, 400-character title:

```
OLD: extract=OSError: File name too long     (ENAMETOOLONG, the bug in the intent paragraph)
NEW: extract=ok, dest=./extracted/pppp…(200 p's)
```

`.` behaves the same way as `..` before the fix (`./extracted/.` → the archive is extracted into
`./extracted/` itself, not into `./extracted/./`) and is now `_` like `..`.

## 6. Works on every Python CI runs

`ci.yml:15` pins a single floating `python-version: "3.x"`, which today resolves to 3.14 — so the
change must be valid on the provisioned 3.11.8 **and** on current 3.x. Nothing in it is
version-sensitive: `str.encode`/`bytes.decode(errors="ignore")`, `re.sub`, `frozenset`, `str.split`/
`strip`/`rstrip`, f-strings — all unchanged since 3.0. There is deliberately no
`tarfile`-version-dependent code and no `sys.version_info` branch (the same reasoning IMP-024
used for its `inspect.signature` check, minus the need for it here).

Verified by executing the sanitizer slice from both interpreters and diffing the results:

```
$ /usr/local/bin/python3.11 /tmp/imp023-xver.py
3.11.8 {'..': '_', '.': '_', 'empty': '_', 'len400': 200, 'bytes400': 200,
        'cjk': ('深'*66, 198), 'CON': 'CON_', 'con': 'con_', 'COM1.txt': 'COM1.txt_',
        'cat:cs.CV': 'cat_cs.CV', 'readme': 'cat_cs.CV AND _3d reconstruction_',
        'diffusion': 'diffusion models', 'sep': 'a_b_c', 'ctrl': "'a_b_c'",
        'exact200_ascii': 200, 'reserved_long': ('CON.xxx…_', 200)}

$ /opt/homebrew/bin/python3 /tmp/imp023-xver.py
3.14.3 {'..': '_', '.': '_', 'empty': '_', 'len400': 200, 'bytes400': 200,
        'cjk': ('深'*66, 198), 'CON': 'CON_', 'con': 'con_', 'COM1.txt': 'COM1.txt_',
        'cat:cs.CV': 'cat_cs.CV', 'readme': 'cat_cs.CV AND _3d reconstruction_',
        'diffusion': 'diffusion models', 'sep': 'a_b_c', 'ctrl': "'a_b_c'",
        'exact200_ascii': 200, 'reserved_long': ('CON.xxx…_', 200)}
```

Identical output on 3.11.8 and 3.14.3. (The slice is `exec`'d from the real file, so the values
above come from the shipped code; `/opt/homebrew/bin/python3` cannot import the module itself
because it lacks `arxiv`/`pandas` — REPO_PROFILE §3.1.)

## 7. Hermetic

No network, no clock dependency, no writes outside `tempfile`/`/tmp`. The new tests are pure
string assertions on `safe_filename` — they touch no filesystem at all, unlike the existing
`MainOutputPathTests`/`ExtractSourceArchiveTests`, which keep their own `tempfile` sandboxes. The
only new `os` use is `os.sep` / `os.altsep`, both already imported at the top of the test file.

## 8. Design decisions worth a reviewer's attention

- **`FALLBACK_SLUG = "_"`** rather than something wordy: every dot-only input (`"."`, `".."`,
  `"//"`, `"\x00"`) collapses to the same name, so two such papers would share an extraction
  directory. I chose the conservative in-family value (`_` is what the illegal-character pass
  already produces) over a word like `untitled`; both satisfy criterion 1. If a reviewer prefers a
  distinguishable fallback it is a one-constant change, but it would change the documented
  `<topic>-…` filename for those topics.
- **`_` suffix vs. `_` infix** for reserved names: the spec says "gains a `_` suffix", so
  `safe_filename("CON.txt") == "CON.txt_"`. Appending to the stem (`CON_.txt`) would be the other
  defensible reading; it is not what the criterion says.
- **Known limitation, deliberate:** Windows also reserves `COM¹`/`LPT¹` with superscript digits.
  The spec enumerates the 22 ASCII names, so matching exactly those is the right scope. Recorded
  as D4 in `.improve/reports/discovered-IMP-023.md`.
- **`truncate_to_bytes` is public** (no leading underscore) because it is a module-level helper in
  the style of `is_inside`/`mode_str`; it is exercised through `safe_filename` rather than directly,
  which keeps the public surface small. It is importable, so a verifier may call it.

## 9. Uncertainties

1. **`.strip(". ")` on both ends is slightly broader than the criteria ask for.** A title like
   `Vol. 1.` loses its trailing dot and a leading-dot title like `.gitignore` becomes `gitignore`.
   This is intentional (Windows silently trims trailing dots/spaces anyway, and a leading dot is a
   hidden file) but it is a visible output change for a small number of titles.
2. **Truncation is a plain byte cut, not a word boundary.** A 400-character title becomes its first
   200 bytes, possibly mid-word (`"The Very Long Title Of…"` → `"The Very Long Title Of A Paper O"`).
   The spec asks only that the cap hold and that characters not be split; word-aware truncation
   would be nicer for humans and is not required.
3. **No readme change.** No flag, default, or command changed, so `readme.md`'s flag table and the
   documented output naming both remain accurate; per REPO_PROFILE §4.5 a readme update is only
   required when a flag/default/command changes.

## 10. Other problems found (recorded, not fixed)

`.improve/reports/discovered-IMP-023.md` — D1 `--download-pdfs`/`--download-sources` ignore
`--output-dir` and hardcode `./extracted/` in the CWD; D2 `open(filename, "w")` with no
`encoding=`; D3 `main()` called bare so the exit code is always 0; D4 superscript device names;
D5 the notebook fork has no sanitizer at all.
