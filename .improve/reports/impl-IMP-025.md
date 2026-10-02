# IMP-025 — implementation report

**Outcome: the core code change was already done by IMP-002. I added the missing explicit test
(AC2) and the readme note (AC3). `scripts/paper-collector.py` is byte-for-byte unmodified.**

Item: `--save-csv` must honour `--output-dir`.
Files changed: `tests/test_paper_collector.py`, `readme.md`.
Baseline 77 tests → **78 tests, OK**.

---

## 1. What is in the CURRENT code

`scripts/paper-collector.py` `main()` (lines 302-314, read from the file):

```python
302:    topic_slug = safe_filename(topic)
303:    os.makedirs(args.output_dir, exist_ok=True)
304:
305:    if args.save_csv:
306:        df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)
307:
308:    prefix = datetime.now().strftime("%m-%d-%Y-%H-%M-%S")
309:    filename = os.path.join(
310:        args.output_dir,
311:        f"{topic_slug}-{len(df)}_papers_extracted_on_{prefix}.html",
312:    )
```

**AC1 is already fully satisfied.** Line 306 is exactly
`os.path.join(args.output_dir, ...)`, and line 303's `os.makedirs(..., exist_ok=True)` runs
*before* both writes, so the directory exists by the time the CSV is written. The original
`df.to_csv(topic + "_papers.csv", index=False)` is gone.

This landed as a side effect of **IMP-002** (commit `d3b4a1e`), which routed *both* output
paths through one `safe_filename(topic)` slug joined onto `--output-dir`. The task brief's
hypothesis is confirmed: the earlier IMP-002 verifier recorded this as fixing PY-29.

I did **not** touch this file. `git diff --stat` shows `scripts/paper-collector.py` with zero
changes.

## 2. Acceptance criteria — which were already satisfied, which I completed

| AC | Status | Evidence |
| --- | --- | --- |
| **AC1** — CSV path is `os.path.join(args.output_dir, ...)`; `--output-dir` created before the write | **ALREADY SATISFIED** (IMP-002). Not re-implemented. | `paper-collector.py:303, 306` + §3 probe below |
| **AC2** — test runs `main()` with `--save-csv --output-dir <tmpdir>`, asserts CSV under `<tmpdir>` and no `*_papers.csv` in CWD | **PARTIALLY satisfied → now explicit.** Indirect coverage existed (`MainOutputPathTests.test_csv_and_html_paths_stay_inside_output_dir_for_every_topic`); the test AC2 literally describes did not. **I added it.** | `tests/test_paper_collector.py:244` + §5 non-vacuity proof |
| **AC3** — `readme.md` CLI table still shows the same flag name and description | **SATISFIED, and preserved byte-identically.** I added one clarifying sentence *below* the table; no table row was renamed or reworded. | `git diff readme.md` in §6 |

### AC2 detail

`tests/test_paper_collector.py:244` `test_save_csv_writes_into_output_dir_and_never_the_cwd`,
added to the existing `MainOutputPathTests` class (which already provides the `fetch_papers`
stub, cwd save/restore, and tempdir cleanup in `setUp`/`tearDown`):

- runs `main()` with `--topic cat:cs.CV --save-csv --output-dir <base>/csv-out/nested`, where
  the output dir is **nested and does not exist yet** (`assertFalse(os.path.exists(output_dir))`
  pins that the code must create it — that is half of AC1);
- `assertTrue(os.path.isfile(<output_dir>/cat_cs.CV_papers.csv))` — CSV exists under tmpdir;
- `self._csvs_under(workdir) == []` — no `*_papers.csv` in the process CWD;
- `self._csvs_under(self.base) == [csv_path]` — *exactly one* CSV exists anywhere in the sandbox,
  so a "correct copy + stray CWD duplicate" regression is also caught;
- reads the header and first data row to confirm the CSV has real content, not an empty file.

Supporting helper `_csvs_under` at `:173`, placed next to the existing `_files_under`.

**This test pins EXISTING correct behavior rather than a new fix.** No production code changed.

### AC3 detail

`readme.md:109` (`| \`--save-csv\` | Also save the extracted metadata as a CSV file. | off |`)
and `:106` (`| \`--output-dir\` | Directory the generated HTML feed is written to. | \`results\` |`)
are **unchanged** — the diff has zero deletions and touches no table row. `--save-csv` is not
named in the new sentence either, so the flag's name and description in the table remain
exactly as documented.

I added `readme.md:111-112`:

> Both the HTML feed and the optional `--save-csv` file are written into
> `--output-dir`, which is created if it does not already exist.

The item's *Intent* named `readme.md:103` as defective because `--save-csv` was "documented
without noting the CWD write". The CWD write no longer exists, so the table was not *wrong* —
only silent. This sentence records the now-guaranteed containment without renaming or rewording
anything, which is what AC3 demands. Flagging the judgment call explicitly for the verifier.

## 3. Commands run, with results

### 3.1 Baseline, before any edit

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests
.........................................
Ran 77 tests in 0.044s

OK
```

Matches the stated baseline of 77.

### 3.2 Empirical check of the REAL CLI, network-free

Drove the actual `main()` with `fetch_papers` monkeypatched to a one-row DataFrame, cwd set to
a throwaway `/tmp` sandbox, and `--output-dir` pointed at a **nested, non-existent** path.
No network, nothing written outside `/tmp`:

```
$ /usr/local/bin/python3.11 /tmp/imp025_probe.py
Number of papers extracted :  1
/tmp/imp025-31mplfgw/out/nested/results/cat_cs.CV-1_papers_extracted_on_10-02-2026-15-11-11.html file saved!

files created under the sandbox (relative to sandbox):
   out/nested/results/cat_cs.CV-1_papers_extracted_on_10-02-2026-15-11-11.html
   out/nested/results/cat_cs.CV_papers.csv

stray files in the process CWD: []
CSV under --output-dir: ['out/nested/results/cat_cs.CV_papers.csv']
VERDICT: PASS
```

The probe and its sandbox were deleted afterwards. This is the item's verification-method shape
(`ls /tmp/rpf-csv` + `git status --porcelain`), executed network-free.

### 3.3 Final suite, after both edits

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
----------------------------------------------------------------------
Ran 78 tests in 0.048s

OK
```

**77 → 78.** The only new test is `test_save_csv_writes_into_output_dir_and_never_the_cwd`; no
existing test was renamed, removed, reordered, or weakened.

### 3.4 Syntax check and CLI surface

```
$ /usr/local/bin/python3.11 -m compileall -q scripts tests
compileall exit 0

$ /usr/local/bin/python3.11 scripts/paper-collector.py --help | grep -E "save-csv|output-dir|max-papers"
usage: paper-collector.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
                          [--output-dir OUTPUT_DIR] [--download-pdfs]
                          [--download-sources] [--save-csv]
  --max-papers MAX_PAPERS
  --output-dir OUTPUT_DIR
  --save-csv            Also save the extracted metadata as a CSV file.
```

`--help` wording for existing flags is untouched (the script is unmodified). CI runs
`python-version: "3.x"` (`.github/workflows/ci.yml:15`); the new test uses only `os`, `sys`,
`shutil`, `contextlib`, `io` and the module's own stub — no syntax newer than 3.8, no new
dependency, works on any 3.x.

### 3.5 Clean-tree check

```
$ ls *_papers.csv
zsh:1: no matches found: *_papers.csv

$ git status --porcelain
 M readme.md
 M tests/test_paper_collector.py
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/regression-sweep-4.md

$ git diff --stat
 readme.md                     |  3 +++
 tests/test_paper_collector.py | 39 +++++++++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 42 insertions(+)
```

No `*_papers.csv` in the repo root — the item's stated symptom is gone. The three untracked
`.improve/reports/*` files pre-existed my work (present in `git status` before I started) and
are not mine. Zero deletions; `scripts/paper-collector.py` absent from the diff.

## 4. Regression guard against the landed items

| Item | Check | Result |
| --- | --- | --- |
| IMP-022 (`--max-papers` argparse validation) | `MaxPapersArgumentTests` (5 tests) | all pass; `--help` unchanged |
| IMP-023 (`safe_filename` hardening) | `SafeFilenameTests` (11 tests) | all pass |
| IMP-024 (tar extraction filter) | `ExtractSourceArchiveTests` (5 tests) | all pass |
| IMP-002 (slug-based output paths) | `MainOutputPathTests` (3 pre-existing) | all pass |

The new test reuses `MainOutputPathTests`' existing `fetch_papers` stub rather than inventing a
second fixture, and asserts against the same `safe_filename(topic)` naming IMP-002 established.

## 5. Non-vacuity evidence

Because the production fix pre-existed, the test cannot fail against a missing fix in place.
So I proved it catches the regression directly, in a scratch copy under `/tmp` — the repo was
never modified for this experiment.

```
$ rm -rf /tmp/imp025-scratch && mkdir -p /tmp/imp025-scratch
$ cp -R scripts tests /tmp/imp025-scratch/

# in the SCRATCH copy only, reintroduce the CWD write
$ diff /tmp/imp025-scratch/scripts/paper-collector.py scripts/paper-collector.py
-        df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)
+        df.to_csv(f"{topic_slug}_papers.csv", index=False)

$ cd /tmp/imp025-scratch && /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
FAIL: test_save_csv_writes_into_output_dir_and_never_the_cwd
    ``--save-csv`` must honour ``--output-dir``, creating it if it is absent.
  File ".../tests/test_paper_collector.py", line 261, in test_save_csv_writes_into_output_dir_and_never_the_cwd
    self.assertTrue(os.path.isfile(csv_path), f"{csv_path} was not written")
AssertionError: False is not true : .../csv-out/nested/cat_cs.CV_papers.csv was not written

FAIL: test_csv_and_html_paths_stay_inside_output_dir_for_every_topic (topic='cat:cs.CV')
AssertionError: False is not true : .../work/cat_cs.CV_papers.csv was written outside .../work/results

----------------------------------------------------------------------
Ran 78 tests in 0.044s

FAILED (failures=6)
```

The scratch copy was deleted (`rm -rf /tmp/imp025-scratch`) immediately after.

Reading of this result:

- **My new test fails loudly** on the regression, at the first assertion, naming the exact
  missing path. Non-vacuous.
- The 5 extra failures are subTests of the pre-existing
  `test_csv_and_html_paths_stay_inside_output_dir_for_every_topic`. That means **indirect
  coverage for AC2 already existed** — IMP-002's implementer did write a test. What was
  missing was a test that states AC2's two claims directly and legibly (CSV present under the
  tmpdir; CWD provably free), which is what I added. I am not claiming credit for closing a
  coverage hole that was mostly already covered; I am reporting the honest delta.

## 6. `git diff readme.md`

```diff
@@ -108,6 +108,9 @@ The extracted papers are saved under `results/` as an HTML feed.
 | `--download-sources` | Also download and extract each paper's LaTeX source archive. | off |
 | `--save-csv` | Also save the extracted metadata as a CSV file. | off |
 
+Both the HTML feed and the optional `--save-csv` file are written into
+`--output-dir`, which is created if it does not already exist.
+
 The ArXiv query syntax supports field prefixes and boolean operators, for example:
```

Purely additive, three lines, no table row touched.

## 7. Left alone on purpose

- `scripts/paper-collector.py` — correct already; churning it would have been the failure mode
  this brief warns about.
- `.improve/REPO_PROFILE.md` — §9 still lists **PY-29** as open while §8 trap 5 calls it
  fixed, and its location column cites `paper-collector.py:138` (a 319-line file; the CSV write
  is at `:306`). The profile is outside my allowed files, so this is escalated in
  `.improve/reports/discovered-IMP-025.md` §1 rather than edited.
- PY-31 (`--download-pdfs` / `--download-sources` still write to CWD at
  `paper-collector.py:239-243`) — same defect class, already inventoried, belongs to another
  item. Noted in the discovered report, not fixed.

## 8. Concurrent-edit note for the verifier

My final `git status --porcelain` also showed ` M .github/workflows/ci.yml`. **That is not my
change.** I never wrote to `.github/` — my two edits are `readme.md` and
`tests/test_paper_collector.py`, both listed above with their diffs, and `git diff --stat`
attributed `+42 insertions, 0 deletions` to exactly those two files. The `ci.yml` modification
appeared between my 3.5 check (where the tree was clean apart from my files) and the final run,
so another agent working `.github/` landed it concurrently. A verifier attributing it to
IMP-025 should not; the item's own verification method (`unittest discover`) does not read
`ci.yml`, and my change does not alter the CI command, which remains
`python -m unittest discover -s tests -v`.