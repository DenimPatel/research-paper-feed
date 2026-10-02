# VERIFY — IMP-002 — Sanitize `--topic` before it reaches the CLI output paths

Verifier: independent sub-agent. Verdict: **PASS** (3/3 acceptance criteria met; 5 advisory
follow-ups, 0 blocking defects).

Scope reviewed: `git diff -- scripts/ tests/` plus untracked files under those paths (none).
`web/**` and `.improve/FEATURES.md` are the concurrent IMP-003 agent's / the loop's and were
excluded. No source file was modified; no git write command was run.

---

## 0. What was actually changed

```
$ git diff --stat -- scripts/ tests/
 scripts/paper-collector.py    |  11 +++--
 tests/test_paper_collector.py | 102 ++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 110 insertions(+), 3 deletions(-)

$ git status --porcelain -- scripts/ tests/ | grep '^??'
(none)                     # no new untracked files under scripts/ or tests/
```

Full diff of `scripts/paper-collector.py` (the only source change):

```diff
+    topic_slug = safe_filename(topic)
+    os.makedirs(args.output_dir, exist_ok=True)
+
     if args.save_csv:
-        df.to_csv(topic + "_papers.csv", index=False)
+        df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)

     prefix = datetime.now().strftime("%m-%d-%Y-%H-%M-%S")
-    os.makedirs(args.output_dir, exist_ok=True)
-    filename = f"{args.output_dir}/{topic}-{len(df)}_papers_extracted_on_{prefix}.html"
+    filename = os.path.join(
+        args.output_dir,
+        f"{topic_slug}-{len(df)}_papers_extracted_on_{prefix}.html",
+    )
```

`tests/test_paper_collector.py` is **purely additive** (102 insertions, 0 deletions) — no existing
assertion was weakened, removed, or reworded. `SafeFilenameTests` and `BuildHtmlFeedTests` are
byte-identical.

Narrowness confirmed. `safe_filename` (`scripts/paper-collector.py:21-23`) is untouched — the
spec explicitly carves it out to IMP-023. `notebooks/paper-collector.ipynb`, `readme.md`,
`CONTRIBUTING.md`, `.gitignore`, and all of `web/` are untouched. `parse_args` (`:26-55`) is
untouched, so no flag name/default/help changed (verified in §3).

---

## 1. Acceptance criteria, one at a time

### AC1 — Both output paths built from ONE sanitized slug, and each `realpath` starts with `realpath(output_dir) + os.sep`, for `../../escape`, `a/b`, `..`, `cat:cs.CV AND "3d reconstruction"`, `cat:cs.CV` — **MET**

* Code: one `topic_slug = safe_filename(topic)` at `scripts/paper-collector.py:137` feeds both the
  CSV (`:141`) and the HTML (`:144-147`); both use `os.path.join` onto `args.output_dir`.
* A slug cannot contain a path separator (`safe_filename` replaces `\/:"*?<>|`), and the slug is
  only ever a *substring* (`{slug}_papers.csv`, `{slug}-{N}_papers_extracted_on_{ts}.html`), so
  even the un-fixed `safe_filename("..") == ".."` cannot become a directory reference. Confirmed
  empirically: `--topic ..` → `..-0_papers_extracted_on_….html` and `.._papers.csv`, both inside
  `--output-dir`.
* Test: `tests/test_paper_collector.py:125-140` runs `subTest` over exactly the five required
  topics with `--save-csv` and asserts `os.path.realpath(path).startswith(realpath(output_dir)+os.sep)`
  for **every** file created. Independently reproduced at scale in §5 (34 adversarial topics).
* One deliberate, criterion-mandated side effect: the CSV moved from CWD to `--output-dir`. This is
  literally required by AC1 ("`os.path.realpath` of *each* path"), it fixes profile bug **PY-29**,
  and `.gitignore:6` (`results/*.csv`) already assumed that location. See Advisory A2.

### AC2 — New test calls `main()` with `--topic '../../escape' --output-dir <tmpdir>` against a stubbed `fetch_papers`, asserting (a) the resolved HTML path is inside `<tmpdir>` and (b) no file was created outside it; no duplicated `safe_filename("..")` unit test — **MET**

* `tests/test_paper_collector.py:117-123` (`test_traversal_topic_stays_inside_output_dir`) →
  `_run_main` at `:90-106` patches `paper_collector.fetch_papers` to a 1-row frame (`:75`), drives
  `parse_args()` via a patched `sys.argv` (`:101-102`), silences stdout with
  `contextlib.redirect_stdout` (`:103`), and relocates CWD into a `tempfile.mkdtemp()` sandbox so
  any CWD-relative write is captured rather than dirtying the repo.
* (a) `:119` + `_assert_created_inside` `:108-115` uses `os.path.realpath`.
* (b) `created` is the **set difference of every file under the whole sandbox tree** before/after
  the run (`:99`, `:106`) — so "no file was created outside it" is asserted against a superset of
  the output dir, not just the output dir. `_assert_created_inside` also has `assertTrue(created)`
  at `:110`, so it cannot pass vacuously on an empty set.
* Network-free and hermetic — `fetch_papers` is stubbed, no clock is faked, no arXiv call.
* Correctly does **not** duplicate IMP-023: there is no `safe_filename(".")`/`safe_filename("..")`
  unit test. The `".."` topic appears only as an *output-path* case.
* Monkeypatching restored in `tearDown` (`:77-81`) — `fetch_papers`, `sys.argv`, CWD, and the temp
  tree. Style matches REPO_PROFILE §5.2: `tempfile` imported inside the methods that use it, plain
  `unittest.TestCase`, no type annotations, 4-space indent, double-quoted delimiters.

### AC3 — `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes — **MET**

```
Ran 30 tests in 0.019s
OK
```

Baseline was 27; 27 + 3 new = 30, matching the implementer's claim. All 27 pre-existing tests still
pass and none was modified. The 3 new tests:

```
test_csv_and_html_paths_stay_inside_output_dir_for_every_topic ... ok
test_plain_topic_keeps_documented_html_naming ... ok
test_traversal_topic_stays_inside_output_dir ... ok
```

(`/usr/local/bin/python3.11 -m compileall -q scripts tests` → exit 0.)

---

## 2. Are the new tests real? (mutation testing, in `/tmp`, never in the repo)

### Mutation A — revert the whole fix (pre-fix `main()` body restored)

Scratch copy: `/tmp/verify-imp002/{scripts,tests}` (repo files copied, fix reverted with a
`str.replace` script; the repo itself was never touched).

```
$ cd /tmp/verify-imp002 && /usr/local/bin/python3.11 -m unittest discover -s tests
Ran 30 tests in 0.020s
FAILED (failures=6, errors=1)
```

All three new test methods fail, with the right diagnostics:

* `test_traversal_topic_stays_inside_output_dir`:
  `AssertionError: False is not true : …/tmpsx76mrtw/escape-1_papers_extracted_on_10-02-2026-00-24-25.html was written outside …/work/results`
  → the traversal is genuinely caught.
* `test_plain_topic_keeps_documented_html_naming`:
  `Regex didn't match: '^cat_cs\.CV-1_papers_extracted_on_…\.html$' not found in 'cat:cs.CV-1_papers_extracted_on_10-02-2026-00-24-25.html'`
  → the slug assertion is real, and the expected name is a **hardcoded literal**, not derived from
  the function under test (so it is not tautological).
* `test_csv_and_html_paths_stay_inside_output_dir_for_every_topic`: 4 subTest failures naming the
  escaped CSV (`…/work/cat:cs.CV_papers.csv was written outside …/work/results`, etc.) plus
  `ERROR … (topic='a/b')` — pandas raising the item's `FileNotFoundError` symptom
  (`Cannot save file into a non-existent directory: 'a'`).

The 27 pre-existing tests still passed in the mutated tree, so the failures are attributable to the
reverted fix, not to collateral damage.

### Mutation B — partial fix (HTML sanitized, CSV left in CWD)

```
FAILED (failures=5)
AssertionError: False is not true : …/work/cat_cs.CV_papers.csv was written outside …/work/results
```

The CSV assertion is therefore not dead weight — it pins the second half of AC1 independently.

**Conclusion: no new test is vacuous or tautological.** All three fail with the fix reverted; all
three pass with it applied.

---

## 3. Legacy CLI compatibility surface (REPO_PROFILE §6)

`parse_args` is untouched, verified by execution rather than by reading:

```
$ /tmp/rpf-venv/bin/python scripts/paper-collector.py --help
usage: paper-collector.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
                          [--output-dir OUTPUT_DIR] [--download-pdfs]
                          [--download-sources] [--save-csv]
… (help text unchanged; identical to the pre-change output)

$ parse_args() with argv ['paper-collector.py']
Namespace(topic=None, max_papers=1000, output_dir='results', download_pdfs=False,
          download_sources=False, save_csv=False)
```

* `--topic`, `--max-papers` (1000), `--save-csv`, `--output-dir` (results), `--download-pdfs`,
  `--download-sources` — all present, all names and defaults intact.
* Documented naming `<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html` preserved and
  pinned by `tests/test_paper_collector.py:142-151`; the real run in §4 produced
  `.._.._escape-2_papers_extracted_on_10-02-2026-00-26-36.html`, matching that shape.
* Default `--output-dir results` run (sandbox CWD, `--max-papers 0 --save-csv`):
  `results/cat_cs.CV-0_papers_extracted_on_….html` + `results/cat_cs.CV_papers.csv`. Both land in
  `results/`, which `.gitignore:5-6` already ignores — so the new CSV location is *more* consistent
  with the repo than the old CWD location (PY-29).
* `--download-pdfs` still dispatches into `fetch_papers`; live run on the venv
  (`arxiv 4.0.1`) dies with `AttributeError: 'Result' object has no attribute 'download_pdf'`.
  That is **pre-existing PE-8 / PY-26** (the `except` at `:80` catches only
  `(arxiv.ArxivError, OSError, tarfile.TarError)`), untouched by this diff, and mapped in
  REPO_PROFILE §7 — **not** a regression from IMP-002.
* Trailing-slash / non-existent nested `--output-dir /tmp/.../a/b/c/` now works
  (`os.makedirs` creates parents, `os.path.join` avoids a doubled separator that the old f-string
  join produced).
* `--download-*` targets remain CWD-relative (PY-31) — explicitly out of the item's Area/files.

---

## 4. Verification method from the spec, executed EXACTLY

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
Ran 30 tests in 0.019s
OK
```

`/tmp/rpf-venv` did not exist; per REPO_PROFILE §3.1 I created it exactly as the profile prescribes
(`python3 -m venv /tmp/rpf-venv && /tmp/rpf-venv/bin/pip install -r requirements.txt` → `arxiv
4.0.1`, `pandas 3.0.6`) so the spec's literal command could be run. (The implementer's note 3
records the same substitution.)

```
$ cd /Users/denimpatel/Desktop/git/research-paper-feed
$ /tmp/rpf-venv/bin/python scripts/paper-collector.py --topic '../../escape' --max-papers 2 --output-dir /tmp/rpf-topic-escape
INFO:arxiv:Requesting page (first: True, try: 0): https://export.arxiv.org/api/query?search_query=..%2F..%2Fescape&…&max_results=2
INFO:arxiv:Got first page: 2 of 12572 total results
Number of papers extracted :  2
/tmp/rpf-topic-escape/.._.._escape-2_papers_extracted_on_10-02-2026-00-26-36.html file saved!
EXIT=0

$ find /tmp/rpf-topic-escape -type f
/tmp/rpf-topic-escape/.._.._escape-2_papers_extracted_on_10-02-2026-00-26-36.html
```

* Traversal payload **neutralized**: `../../escape` became the literal filename
  `.._.._escape-2_papers_extracted_on_….html` inside `/tmp/rpf-topic-escape`. `find` lists every new
  file, and there is exactly one.
* `/tmp/escape*` → none. Repo root → no `*_papers*`, no `*escape*`, no `extracted/`, no `*.pdf`,
  no `*.tar.gz`.
* `git status --porcelain` before and after the CLI run was **identical** — no strays:

```
 M .improve/FEATURES.md                                  <- the loop's TODO->IN-PROGRESS flip
 M scripts/paper-collector.py                             <- IMP-002
 M tests/test_paper_collector.py                          <- IMP-002
 M web/src/lib/__tests__/paperIndex.test.ts               <- IMP-003 (other agent, out of scope)
 M web/src/lib/paperIndex.ts                              <- IMP-003 (other agent, out of scope)
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/impl-IMP-002.md
?? .improve/reports/impl-IMP-003.md
```

  The spec's "confirm `git status --porcelain` is empty" cannot literally hold for an uncommitted
  loop change; the meaningful form is *no new entries after the run*, which holds.

* Noted: the repo's `results/` directory (containing only the committed `results/.gitkeep`, mtime
  Sep 11) was **not** touched by the run.

---

## 5. Adversarial `--topic` values (34 cases, real CLI, real argparse, real `open()`)

Harness: real `scripts/paper-collector.py` invoked as a subprocess in a per-case sandbox with
`--max-papers 0` (short-circuits `arxiv_common.iter_results:37-38`, so path handling is exercised
end-to-end with zero network) and `--save-csv`. Every file under the case tree was then checked
against `realpath(output_dir) + os.sep`. Canary paths (`/tmp/pwned`, `/tmp/verify-imp002/OUTSIDE_ABS`,
`CMDBACKDO_*`) were checked for existence after every case.

| # | `--topic` | rc | files | outcome |
| --- | --- | --- | --- | --- |
| 0 | `../../escape` | 0 | 2 | `.._.._escape_papers.csv`, `.._.._escape-0_papers_…html` — inside |
| 1 | `/tmp/pwned` (absolute) | 0 | 2 | `_tmp_pwned*` — inside; `/tmp/pwned` never created |
| 2 | `../../../../../../etc/pwned` | 0 | 2 | `.._x6_etc_pwned*` — inside |
| 3 | `..` | 0 | 2 | `..-0_…html`, `.._papers.csv` — literal filenames, inside |
| 4 | `.` | 0 | 2 | `.-0_…html`, `._papers.csv` — inside |
| 5 | `...` | 0 | 2 | inside |
| 6 | `a/b` | 0 | 2 | `a_b*` — **previously crashed**; fixed |
| 7 | `cat:cs.CV AND "3d reconstruction"` (readme's own example) | 0 | 2 | `cat_cs.CV AND _3d reconstruction_*` — no `:`, no `"`; Windows-legal |
| 8 | `` (empty) | 1 | 0 | `EOFError` from the interactive `input()` prompt — see Advisory A4, pre-existing |
| 9 | `   ` (whitespace) | 0 | 2 | `-0_…html`, `_papers.csv` — inside |
| 10 | `\ttab\t` | 0 | 2 | inside |
| 11 | `line\nbreak` | 0 | 2 | inside (newline legal on POSIX) |
| 12 | `$(touch /tmp/verify-imp002/CMDBACKDO_dollar)` | 0 | 2 | literal `$()` in filename; canary **not** created |
| 13 | `` `touch …/CMDBACKDO_tick` `` | 0 | 2 | literal backticks; canary **not** created |
| 14 | `; touch …/CMDBACKDO_semi` | 0 | 2 | canary **not** created |
| 15 | `&& touch …/CMDBACKDO_and` | 0 | 2 | canary **not** created |
| 16 | `$HOME` | 0 | 2 | literal, no expansion |
| 17 | `~` | 0 | 2 | literal, no tilde expansion |
| 18 | `~root` | 0 | 2 | literal |
| 19 | `../../../../../../tmp/verify-imp002/OUTSIDE_ABS` | 0 | 2 | inside; canary **not** created |
| 20 | `%2e%2e%2f%2e%2e%2f` (URL-encoded) | 0 | 2 | inside, no decode |
| 21-24 | `con`, `nul`, `aux`, `prn` (Windows reserved) | 0 | 2 | inside — see Advisory A3 |
| 25 | `ünïcødé ✓ 🎉 日本語` | 0 | 2 | inside, UTF-8 preserved |
| 26 | `../../ünïcødé/✓` | 0 | 2 | inside |
| 27 | 300 × `A` | 1 | 0 | `OSError [Errno 63] File name too long` — see Advisory A3, pre-existing |
| 28 | `../../` + 300 × `B` | 1 | 0 | same, no escape |
| 29 | `sp ace` | 0 | 2 | inside |
| 30 | `trailing space   ` | 0 | 2 | stripped, inside |
| 31 | `-leading-dash` | 2 | 0 | argparse `expected one argument` (needs `--topic=-x`) — pre-existing |
| 32 | `--looks-like-a-flag` | 2 | 0 | same |
| 33 | `aaaa\x01ctrl` | 0 | 2 | control char retained in filename — see Advisory A3 |

**Global sweep after all 34 cases:** canaries present: **none**. `/tmp/escape*`: **none**.
Repo-root `*_papers*` / `*.html`: **none**. Zero files escaped `--output-dir` in any case; zero
shell-injection canaries fired (the script never passes the topic to a shell, and `subprocess` was
used with an argv list anyway); no filename contained `\ / : " * ? < > |` in any *new* path.

The three non-zero exits (#8, #27/#28, #31/#32) were **reproduced identically against the reverted
pre-fix copy**, proving they are pre-existing behavior, not regressions:

```
$ /usr/local/bin/python3.11 /tmp/verify-imp002/scripts/paper-collector.py --topic "" …            -> EOFError
$ … --topic "AAAA…(300)" …                                                                       -> OSError [Errno 63] File name too long
$ … --topic "-leading-dash" …                                                                    -> error: argument --topic: expected one argument
```

---

## 6. Hygiene / style sweep

| Check | Result |
| --- | --- |
| New `print()` debug statements | none (grep of added lines) |
| `TODO` / `FIXME` / `XXX` / `HACK` / `breakpoint()` / `import pdb` / `console.log` | none |
| Secrets / tokens / credentials | none |
| Tabs in added lines | none |
| Single-quoted string delimiters in added lines | none (matches §5.1 "double quotes in Python too") |
| Comments added to source | none added to `scripts/paper-collector.py`; test docstring at `:66` uses a one-line `"""` explaining *why*, matching §5.1 |
| Comments left in `tests/` | only the pre-existing header path setup; new code is uncommented, matching the sparsely-commented house style |
| Reformatting / mass-quote churn | none — 3 deleted lines total, all of them the lines being replaced |
| Files touched outside `scripts/`+`tests/` by this item | none |
| New untracked files under `scripts/`+`tests/` | none |
| Line length | longest added line is `tests/test_paper_collector.py:150` (the regex), consistent with the file's existing style |

---

## 7. Findings

**Blocking defects: none.**

### Advisories (non-blocking; none is a regression)

* **A1 — doc drift on `--output-dir`.** `scripts/paper-collector.py:41` still says "Directory the
  generated HTML feed is written to (default: results)" and `readme.md:100` repeats it, but
  `--save-csv` now also lands there. REPO_PROFILE §4.5 asks for a docs update in the same change as
  a flag behavior change. `readme.md` was outside this item's allowed paths; the argparse help
  string at `:41` was inside them and could have been reworded. **Actionable, cosmetic.**
* **A2 — unstated behavior change (CSV moved from CWD to `--output-dir`).** Required by AC1's
  literal wording and disclosed in the implementer report, but absent from the Intent paragraph. It
  resolves **PY-29** as a side effect; REPO_PROFILE §4.6.6 wants the bug inventory row updated to
  say so. Risk is low: nothing in the repo consumes the CSV (PY-38), `readme.md:103` documents no
  CSV location, and `.gitignore:6` already assumed `results/*.csv`.
* **A3 — `safe_filename` is still not a sanitizer (PY-27, IMP-023's scope, explicitly carved out by
  this item's spec).** Observed: no length cap (cases #27/#28 → `ENAMETOOLONG`, so no file is
  created at all — nothing escapes, but the run dies), control characters and newlines survive into
  filenames (#11, #33), and Windows reserved names (`con`/`nul`/`aux`/`prn`) are not handled
  (#21-24). All pre-existing, all reproduced identically on the pre-fix copy.
* **A4 — `--topic ''` still falls through to the interactive prompt.** `paper-collector.py:127`
  (`args.topic or input(...)`) is untouched by this diff; an empty string is falsy, so it prompts
  and dies with `EOFError` on a closed stdin. Pre-existing; belongs to CLI-flag validation
  (IMP-022 / PY-10).
* **A5 — theoretical limit of the AC2(b) assertion.** `tests/test_paper_collector.py:99-106` scopes
  the "nothing created outside it" check to the `tempfile` sandbox tree, so a hypothetical *absolute*
  escape beyond that tree would go unobserved. Not exploitable here: the code only ever
  `os.path.join`s onto `args.output_dir`, and the AC2(b) check did catch the CWD-relative write in
  Mutation B. Noted for completeness, not a defect.

### Stray artifact (not IMP-002's, but the loop should clean it)

`.playwright-mcp/traces/` exists in the repo root (empty, created 00:28 during this session). It is
**not** in `git status` only because git does not report empty directories — the first Playwright
trace written would surface it as an untracked path. It was not created by this verification (no
Playwright tool was invoked here); it is almost certainly the concurrent IMP-003 agent's. Flagging
for the loop; not a defect of IMP-002.

---

## 8. Commands run (for reproduction)

```shell
# spec
/usr/local/bin/python3.11 -m unittest discover -s tests -v                        # Ran 30 tests, OK
python3 -m venv /tmp/rpf-venv && /tmp/rpf-venv/bin/pip install -r requirements.txt
/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic '../../escape' --max-papers 2 --output-dir /tmp/rpf-topic-escape
find /tmp/rpf-topic-escape -type f ; ls -d /tmp/escape* ; git status --porcelain

# diff / hygiene
git diff -- scripts/ tests/ ; git diff --stat -- scripts/ tests/
git status --porcelain -- scripts/ tests/
git diff -U0 -- scripts/ tests/ | grep -nE '^\+' | grep -iE 'TODO|FIXME|XXX|HACK|breakpoint\(|pdb|console\.log'
/usr/local/bin/python3.11 -m compileall -q scripts tests                          # exit 0

# mutation testing (scratch copies under /tmp; repo never modified)
/usr/local/bin/python3.11 /tmp/verify-imp002/revert.py   # revert fix
cd /tmp/verify-imp002 && /usr/local/bin/python3.11 -m unittest discover -s tests -k MainOutputPathTests   # FAILED (failures=6, errors=1)
cd /tmp/verify-imp002b && /usr/local/bin/python3.11 -m unittest discover -s tests                          # FAILED (failures=5)
cd /Users/denimpatel/Desktop/git/research-paper-feed && /usr/local/bin/python3.11 -m unittest discover -s tests -k MainOutputPathTests  # Ran 3 tests, OK

# adversarial
/usr/local/bin/python3.11 /tmp/verify-imp002/adversarial.py                        # 34 cases, 0 escapes, 0 canaries
```

All `/tmp` scratch artifacts created by this verification
(`/tmp/verify-imp002`, `/tmp/verify-imp002b`, `/tmp/rpf-topic-escape`, `/tmp/rpf-venv`) were deleted
afterwards. The repository was never modified and no git write command was executed.

---

## 9. Verdict

**PASS — 3/3 acceptance criteria met.**

The fix is minimal, correctly placed at the call site the spec names, uses a single sanitized slug
for both output paths, keeps the documented CLI surface byte-identical, and adds three hermetic,
network-free tests that all demonstrably fail when the fix is reverted. The traversal payload is
neutralized in a real CLI run and across 34 adversarial `--topic` values, with zero canary hits and
zero path escapes. No scope creep, no debug code, no weakened assertions, no strays.

The five advisories are cosmetic (A1/A2 doc drift) or belong to the item the spec explicitly
excludes (A3 → IMP-023, A4 → IMP-022), or are theoretical (A5). None blocks merge.
