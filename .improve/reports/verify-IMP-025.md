# verify-IMP-025 — independent verification

**Verdict: PASS (3/3 criteria met).** The implementer's "already fixed by IMP-002" claim survives
independent scrutiny; the new test is non-vacuous under three separate deliberate regressions; no
production file was churned and no existing test was weakened.

Read-only verification. `scripts/paper-collector.py` was never modified by me. All experiments ran in
`/tmp/imp025_verify/` scratch copies. No git write command was run.

---

## 0. What I checked, and how

| # | Claim under test | Method |
| --- | --- | --- |
| 1 | AC1 already satisfied; CSV honours `--output-dir` | Static trace + two real CLI runs with a stubbed `fetch_papers` |
| 2 | AC2 test is meaningful and non-vacuous | Read `tests/test_paper_collector.py:244-273`, then broke the implementation three different ways in `/tmp` scratch copies |
| 3 | AC3 readme flag table intact; note accurate | `git diff readme.md` (0 deletions), read `readme.md:100-127`, cross-checked against `--help` |
| 4 | No regressions from IMP-002/022/023/024 | `--help` capture, documented-command parse, full suite, blob-hash identity with `HEAD` |
| 5 | No unnecessary churn | `git diff --numstat`, `git hash-object` vs `git rev-parse HEAD:scripts/paper-collector.py` |
| 6 | No existing test weakened; all 77 pre-existing names survive | AST diff of `HEAD:` vs worktree test file; re-ran the `HEAD` suite in a scratch tree to confirm 77 |
| 7 | Suite green, hermetic, fast | `unittest discover -v`, plus a rerun with `socket.connect`/`create_connection`/`getaddrinfo` blocked |

---

## 1. AC1 — "The CSV path is `os.path.join(args.output_dir, ...)` and `--output-dir` is created
## before the write, so the CSV never lands in CWD"

### 1.1 Static trace (independent of the report)

`scripts/paper-collector.py`:

- `:204` — `parser.add_argument("--output-dir", default="results", ...)`. Default is the relative
  string `"results"` (see §1.3).
- `:303` — `os.makedirs(args.output_dir, exist_ok=True)` — **unconditional**, and **before** both
  writes.
- `:305-306` —
  ```python
  if args.save_csv:
      df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)
  ```
  Path is `os.path.join(args.output_dir, ...)`. ✅
- `:308-313` — the HTML filename is likewise `os.path.join(args.output_dir, ...)`.

**Ordering (the specific thing the brief told me to check, not just the path):** `makedirs` is at
`:303`; the CSV write is at `:306`. The directory therefore exists before the write. There is no
code path in which `df.to_csv` runs against a non-existent parent.

**Write-site census.** `grep -rn "to_csv|_papers\.csv" --include=*.py --include=*.ipynb` over the
repo (excluding `.kilo/worktrees`) finds exactly **one** CSV write site in the CLI:
`scripts/paper-collector.py:306`. The only other hit is `notebooks/paper-collector.ipynb`
(cell-source line 57) — see §1.4.

**The claim in the report that "IMP-002 did this" is corroborated:** `.improve/reports/verify-IMP-002.md:31-32`
shows precisely this diff
(`-df.to_csv(topic + "_papers.csv", index=False)` → `+df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)`),
so the change landed in commit `d3b4a1e`, not in this item.

### 1.2 Real CLI runs (network-free; `fetch_papers` stubbed with a one-row DataFrame)

Probe: `/tmp/imp025_verify/probe.py` loads the real script by path, replaces
`pc.fetch_papers` with a stub returning one row, `chdir`s into a throwaway
`tempfile.mkdtemp()` sandbox, then calls the real `main()` with the given argv.

**Run A — `--save-csv --output-dir <nested, non-existent absolute path>`**

```
$ /usr/local/bin/python3.11 /tmp/imp025_verify/probe.py scripts/paper-collector.py \
      --topic 'cat:cs.CV' --save-csv --output-dir /tmp/imp025_verify/out-a/nested
Number of papers extracted :  1
/tmp/imp025_verify/out-a/nested/cat_cs.CV-1_papers_extracted_on_10-02-2026-15-17-04.html file saved!
CSV files under sandbox: []          <-- CWD sandbox: nothing
ALL files under sandbox: []
files directly in CWD: []
$ ls -la /tmp/imp025_verify/out-a/nested/
-rw-r--r--  1 denimpatel  wheel   952  cat_cs.CV-1_papers_extracted_on_10-02-2026-15-17-04.html
-rw-r--r--  1 denimpatel  wheel   109  cat_cs.CV_papers.csv
$ head -2 /tmp/imp025_verify/out-a/nested/cat_cs.CV_papers.csv
Title,Date,Summary,URL
A Paper About 3D Reconstruction,2024-01-01,A summary,https://arxiv.org/pdf/2401.12345
```

**AC1 holds.** The CSV is under `--output-dir`; the directory (two levels deep, absent beforehand)
was created by `:303`; the CWD is empty; the file has real content, not zero bytes.

**Run B — `--save-csv` with NO `--output-dir`**

```
$ /usr/local/bin/python3.11 /tmp/imp025_verify/probe.py scripts/paper-collector.py \
      --topic 'cat:cs.CV AND "3d reconstruction"' --save-csv
results/cat_cs.CV AND _3d reconstruction_-1_papers_extracted_on_10-02-2026-15-17-05.html file saved!
CSV files under sandbox: ['cwd/results/cat_cs.CV AND _3d reconstruction__papers.csv']
files directly in CWD: ['results']
```

The CSV lands at `$CWD/results/<slug>_papers.csv` — **inside a subdirectory, not in the CWD root.**
Judged against the criterion:

- The criterion's literal requirement — "the CSV path is `os.path.join(args.output_dir, ...)`" — is
  satisfied (`"results"` joined with the filename, resolved against CWD).
- "so the CSV never lands in CWD" is satisfied in the sense the criterion means: no `*_papers.csv`
  appears in the working directory itself, which was the defect in the Intent
  ("silently drops `*_papers.csv` in the repo root").
- The default is deliberate, not accidental: `readme.md:98` ("The extracted papers are saved under
  `results/`"), the flag table's Default column `readme.md:106` (`results`), and the pre-existing
  IMP-002 test `tests/test_paper_collector.py:309`
  (`self.assertEqual(args.output_dir, "results")`) all pin it. Changing the default would break
  AC3's readme table and an existing test, and no criterion asks for it.
- And `.gitignore:6` (`results/*.csv`) covers the default location, which is precisely the coverage
  the Intent said was missing for a repo-root write.

So Run B is by-design behaviour, not a residual defect.

### 1.3 Is there any residual AC1 defect?

No. Path construction, ordering, directory creation (including nested parents), and the absence of
any alternate CSV write site are all correct, and the default-value case is consistent with the
documentation and with `.gitignore`.

### 1.4 Out-of-scope observation (not an AC1 failure)

`notebooks/paper-collector.ipynb` still contains `df.to_csv(topic+"_papers.csv", index=False)` and
hardcodes `filename = 'results/' + topic + ...`. It defines **no CLI flags at all** (no argparse, no
`--save-csv`, no `--output-dir`), so it is outside this item's stated Area/files
(`scripts/paper-collector.py`, `readme.md`) and outside AC1's wording ("the CSV path is
`os.path.join(args.output_dir, ...)`" — there is no `args.output_dir` there). Pre-existing, tracked
as a readme-accuracy nit in §3.3.

---

## 2. AC2 — is `tests/test_paper_collector.py:244` meaningful and non-vacuous?

### 2.1 Does it run `main()` end to end?

Yes. `tests/test_paper_collector.py:253-258` sets `sys.argv` to
`["paper-collector.py", "--topic", "cat:cs.CV", "--save-csv", "--output-dir", output_dir]` and calls
`paper_collector.main()` — the real entry point, not a helper. It reuses the class's existing
fixture (`setUp:151-158` stubs `fetch_papers`, `tearDown:160-164` restores `fetch_papers`, `sys.argv`
and the CWD and removes the tempdir), so no test-only machinery duplicates `main()`'s logic.

The `--output-dir` is `<mkdtemp>/csv-out/nested` — deliberately **nested and absent**, pinned by
`:251` (`assertFalse(os.path.exists(output_dir), "output-dir must start absent")`). That pins the
`makedirs`-before-write half of AC1 from inside the AC2 test.

### 2.2 Does it assert both claims, and is the CWD assertion robust?

- CSV exists under tmpdir: `:261` `assertTrue(os.path.isfile(csv_path))`.
- No `*_papers.csv` in CWD: `:267-269` `assertEqual(self._csvs_under(workdir), [], ...)`.
- Plus a stronger third claim at `:262-266`: `assertEqual(self._csvs_under(self.base), [csv_path])`
  — **exactly one** CSV anywhere in the sandbox, so a "correct copy *plus* a stray duplicate"
  regression is caught too.
- Plus content: `:270-273` reads the header and first row (`"Title"`, `"A Paper About 3D
  Reconstruction"`), so an empty/truncated CSV cannot pass.

**Is the CWD check vacuous?** No — and the reason is structural, not incidental. `workdir`
(`<base>/csv-work`) is `os.chdir`'d to at `:249` and it sits **inside `self.base`**, the very tree
`_csvs_under` walks. A relative write such as `df.to_csv("x_papers.csv")` therefore has a real,
reachable destination there. I proved this empirically in §2.3 variant 2: the injected stray file
physically appeared at `.../csv-work/cat_cs.CV_papers.csv`. `:267` is also not redundant with
`:262` — `:262` fires first on a duplicate, but `:267` is the independent statement of AC2's second
claim and would fail on its own if `:262` were ever weakened.

### 2.3 Non-vacuity: three deliberate regressions, reproduced by me

Scratch copies of `scripts/` + `tests/` under `/tmp/imp025_verify/scratch{,2,3}` (the repo was never
touched). In each case I patched **only** the scratch copy.

**Variant 1 — restore the historical bug (bare CWD write):**

```python
-        df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)
+        df.to_csv(f"{topic_slug}_papers.csv", index=False)
```
```
FAIL: test_save_csv_writes_into_output_dir_and_never_the_cwd
  File ".../tests/test_paper_collector.py", line 261, in test_save_csv_writes_into_output_dir_and_never_the_cwd
    self.assertTrue(os.path.isfile(csv_path), f"{csv_path} was not written")
AssertionError: False is not true : /var/folders/.../tmp43n8y87o/csv-out/nested/cat_cs.CV_papers.csv was not written
FAIL: test_csv_and_html_paths_stay_inside_output_dir_for_every_topic (topic='cat:cs.CV')
AssertionError: False is not true : /var/folders/.../work/cat_cs.CV_papers.csv was written outside .../work/results
Ran 78 tests in 0.047s
FAILED (failures=6)
```

The new test **fails loudly at its first assertion**, naming the missing path. Matches the
implementer's reported result (same line 261, same 6 failures) — independently reproduced.

**Variant 2 — the harder case: keep the correct `--output-dir` write AND add a stray CWD duplicate.**
This isolates the CWD half of AC2, which variant 1 cannot reach (it dies at `:261` before the CWD
assertions).

```python
         df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)
+        df.to_csv(f"{topic_slug}_papers.csv", index=False)  # stray CWD duplicate
```
```
FAIL: test_save_csv_writes_into_output_dir_and_never_the_cwd
  File ".../tests/test_paper_collector.py", line 262, in test_save_csv_writes_into_output_dir_and_never_the_cwd
AssertionError: Lists differ: ['/va[57 chars]/csv-work/cat_cs.CV_papers.csv', '/var/folders[81 chars]csv']
                        != ['/va[57 chars]/csv-out/nested/cat_cs.CV_papers.csv']
FAILED (failures=6)
```

`:261` passed (the CSV *is* in `--output-dir`) and the test still failed at `:262` because the
sandbox walk found two CSVs — one of them in `csv-work`, the CWD. **The CWD assertion is not
vacuous.**

**Variant 3 — move `os.makedirs` to *after* the CSV write** (probes the ordering half of AC1):

```
  os.makedirs(args.output_dir, exist_ok=True)   # moved below the to_csv
ERROR: test_save_csv_writes_into_output_dir_and_never_the_cwd
  raise OSError(rf"Cannot save file into a non-existent directory: '{parent}'")
OSError: Cannot save file into a non-existent directory: '/var/folders/.../work/results'
ERROR: test_csv_and_html_paths_stay_inside_output_dir_for_every_topic (topic='../../escape')
OSError: Cannot save file into a non-existent directory: '/var/folders/.../work/results'
```

The nested `assertFalse(os.path.exists(output_dir))` at `:251` is what makes this reachable: without
it the output dir could pre-exist and the ordering would go unpinned. The ordering is genuinely
tested.

**Conclusion: the test cannot pass against a broken implementation. Non-vacuous — confirmed
three independent ways.**

### 2.4 Honest note on credit

The implementer's own report §5 already concedes that indirect coverage existed via
`test_csv_and_html_paths_stay_inside_output_dir_for_every_topic` (`:216-231`) — my variants 1 and 3
confirm that (it fails in the same runs). So IMP-025's real delta is a legible, AC2-shaped test, not
the closure of a total coverage hole. That is exactly how the report describes it; I find no
overclaim.

---

## 3. AC3 — `readme.md`

### 3.1 The flag table is untouched

`git diff --numstat readme.md` → `3  0` (three additions, **zero deletions**). Full diff:

```diff
@@ -108,6 +108,9 @@ The extracted papers are saved under `results/` as an HTML feed.
 | `--download-sources` | Also download and extract each paper's LaTeX source archive. | off |
 | `--save-csv` | Also save the extracted metadata as a CSV file. | off |

+Both the HTML feed and the optional `--save-csv` file are written into
+`--output-dir`, which is created if it does not already exist.
+
 The ArXiv query syntax supports field prefixes and boolean operators, for example:
```

- `readme.md:109` — `| \`--save-csv\` | Also save the extracted metadata as a CSV file. | off |` —
  **byte-identical**, flag name and description both preserved. ✅ AC3 met.
- `readme.md:106` — `| \`--output-dir\` | Directory the generated HTML feed is written to. | \`results\` |` —
  also byte-identical.
- No table row was renamed, reworded, reordered or re-aligned.

### 3.2 Is the added note accurate and useful?

Yes, for the CLI. `:111-112` claims (a) HTML and CSV both go into `--output-dir`, (b) the directory
is created if absent. Both verified against `paper-collector.py:303-313` and by runs A and B. It
closes the item's stated documentation gap (`.improve/FEATURES.md:559` called
`readme.md:103` defective for documenting `--save-csv` "without noting the CWD write") without
touching the protected table row, and it does not contradict `readme.md:98` or `:106`.

### 3.3 Nits (informational, not criterion failures)

- **N1** — the note is unscoped, and `readme.md:124-127` advertises
  `notebooks/paper-collector.ipynb` as "a Jupyter notebook version of the same workflow", whose
  CSV cell still writes `topic+"_papers.csv"` to the CWD and which has no `--output-dir` at all. The
  note is true of the CLI table it sits under; a reader could over-apply it to the notebook. Worth a
  "the CLI" qualifier or a notebook follow-up.
- **N2** — `readme.md:106` still describes `--output-dir` as "Directory the generated **HTML feed** is
  written to", now incomplete given the CSV also lands there. AC3 forbids rewording it and `:111-112`
  supplies the clarification, so the combination is coherent; I record it so the tension is visible.
- **N3** — `.improve/REPO_PROFILE.md` still lists **PY-29** as open in §9 while §8 trap 5 calls it
  fixed, and cites `paper-collector.py:138` (the CSV write is at `:306`). The implementer escalated
  this in `.improve/reports/discovered-IMP-025.md` rather than editing a file outside its scope.
  Correct call; the profile is stale, not the code.
- **N4** — PY-31: `--download-pdfs` / `--download-sources` still write `.pdf`/`.tar.gz` to the CWD
  (`paper-collector.py:239-243`), same defect class, a different inventoried item. Out of scope, not
  a regression from this one.

---

## 4. No regressions on `scripts/paper-collector.py`

The strongest possible evidence: the file is **bit-identical** to `HEAD`.

```
$ git diff --stat HEAD -- scripts/          # (no output)
$ git rev-parse HEAD:scripts/paper-collector.py
c775f593fed09fca8722dd235a1a159dd39d2b29
$ git hash-object scripts/paper-collector.py
c775f593fed09fca8722dd235a1a159dd39d2b29
$ git status --porcelain -- scripts/          # (no output)
```

Since IMP-025 changed nothing there, every prior item's behaviour is trivially intact. Verified
behaviourally anyway:

- **IMP-022 (argparse validation)** — `MaxPapersArgumentTests` (6 tests) all pass: `--max-papers 0`,
  `-5`, `lots` rejected with exit code 2; default `1000`; `--max-papers` help text reads
  "Maximum number of papers to pull (default: 1000; 1 or greater)." Unchanged.
- **IMP-023 (`safe_filename`)** — `SafeFilenameTests` (11 tests) all pass. `--help` is byte-stable.
- **IMP-024 (tar extraction)** — `ExtractSourceArchiveTests` (5 tests) all pass, including
  `test_interpreter_without_filter_blocks_every_escape_route` and the no-filter fallback
  (`paper-collector.py:117-134`). `TARFILE_HAS_FILTER` still computed via
  `inspect.signature(...).parameters` + `hasattr(tarfile, "data_filter")` (`:24-27`), not a hardcoded
  version.
- **IMP-002 (`--topic` slug + both output paths)** — `MainOutputPathTests` passes. A legitimate
  `--topic` still yields a readable filename (run B:
  `cat_cs.CV AND _3d reconstruction__papers.csv`), matching
  `test_documented_topics_stay_readable:119-127`.
- **`--help` output** (full capture, current tree):
  ```
  usage: paper-collector.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
                            [--output-dir OUTPUT_DIR] [--download-pdfs]
                            [--download-sources] [--save-csv]
    --output-dir OUTPUT_DIR
                          Directory the generated HTML feed is written to
                          (default: results).
    --save-csv            Also save the extracted metadata as a CSV file.
  ```
  Every flag's help string matches `readme.md:104-109`.
- **Documented README commands still parse** (via `parse_args`, no network, no execution):
  ```
  ['--topic', 'cat:cs.CV AND "3d reconstruction"', '--max-papers', '200'] -> max=200 out='results' csv=False   (readme.md:89)
  ['--topic', 'cat:cs.CV', '--max-papers', '2', '--download-pdfs']       -> parses
  ['--topic', 'cat:cs.CV', '--max-papers', '2', '--download-sources']   -> parses
  ['--topic', 'cat:cs.CV', '--max-papers', '2', '--output-dir', '/tmp/out', '--save-csv'] -> out='/tmp/out' csv=True
  []  (interactive)                                                       -> topic=None max=1000 out='results'
  ```

---

## 5. No unnecessary churn — and was leaving the script alone the right call?

`git diff --numstat`:

```
9      0      .github/workflows/ci.yml      <-- NOT IMP-025
2      2      .improve/FEATURES.md          <-- status bookkeeping (IMP-025 + IMP-193: TODO -> IN-PROGRESS)
3      0      readme.md                     <-- IMP-025 AC3
39     0      tests/test_paper_collector.py <-- IMP-025 AC2
```

- `scripts/paper-collector.py`: **absent from the diff**, blob hash identical (§4).
- `.github/workflows/ci.yml`: adds `actions/setup-python@v5`, `pip install -r requirements.txt`, and
  a `python scripts/build_index.py …` step. That is verbatim the gap described in
  `.improve/FEATURES.md:577` for **IMP-193** ("no index-generation step"), whose status is likewise
  flipped to IN-PROGRESS in the same `FEATURES.md` diff, and `.improve/reports/impl-IMP-193.md`
  exists untracked. IMP-026's `Build` step was already at `HEAD`. **Not IMP-025 churn.**
- `.improve/FEATURES.md`: status transitions only (IMP-025 and IMP-193). Expected bookkeeping.

**Was not touching `scripts/paper-collector.py` the right call? Yes.** The AC1 criterion's two
literal requirements are met in the landed code (§1.1), a real CLI run confirms it end to end
(§1.2), and the only residual behaviour — `--save-csv` with the default `--output-dir results`
writing to `$CWD/results/` — is documented in the readme, covered by `.gitignore:6`, and pinned by an
existing IMP-002 test. Editing the file would have meant either a no-op comment or a behaviour change
(no criterion asks for one, and changing the `results` default would break AC3 and
`tests/test_paper_collector.py:309`). No defect remained, so nothing was left unfixed.

---

## 6. No weakened tests; all 77 pre-existing names survive

AST comparison of `git show HEAD:tests/test_paper_collector.py` against the worktree copy:

```
HEAD def count: 27
worktree def count: 28
REMOVED: none
ADDED: ['MainOutputPathTests.test_save_csv_writes_into_output_dir_and_never_the_cwd']
ORDER preserved for common: True
```

- `git diff --numstat tests/test_paper_collector.py` → `39  0`: **39 additions, 0 deletions.** No
  pre-existing line was removed or edited, so no assertion could have been loosened.
- `_csvs_under` (`:173-179`) is a new helper; `_files_under` (`:166-171`) is untouched.
- Independent baseline proof — the `HEAD` suite re-run from a scratch tree (`/tmp/imp025_verify/baseline`,
  HEAD's `tests/` + HEAD's `scripts/`):
  ```
  Ran 77 tests in 0.082s
  OK
  ```
  Current tree: **78**. 77 → 78, delta = exactly the one new test.

---

## 7. Full suite

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
test_save_csv_writes_into_output_dir_and_never_the_cwd (test_paper_collector.MainOutputPathTests.test_save_csv_writes_into_output_dir_and_never_the_cwd)
``--save-csv`` must honour ``--output-dir``, creating it if it is absent. ... ok
...
----------------------------------------------------------------------
Ran 78 tests in 0.043s

OK
```

(Also observed at `0.048s` and `0.043s` on repeat runs. Expected 78 = 77 + 1. ✅)

**Hermetic — proven, not assumed.** Re-run with outbound TCP and DNS blocked
(`/tmp/imp025_verify/nonet.py` replaces `socket.socket.connect`, `connect_ex`, `create_connection`
and `getaddrinfo` with raisers):

```
Ran 78 tests in 0.046s
OK
NETWORK-BLOCKED RUN: tests run: 78 failures: 0 errors: 0 skipped: 0
```

Every arXiv touch point is stubbed (`tests/test_arxiv_common.py:49-65` installs a `FakeClient` and a
`SimpleNamespace` arXiv; `tests/test_paper_collector.py:158` replaces `fetch_papers`;
`tests/test_build_index.py` replaces `arxiv_common.iter_results`). Extraction tests build synthetic
tarballs on local disk. Fast (0.04 s) and side-effect-free: `git status --porcelain` after the runs
shows no new files, and `find . -name '*_papers.csv'` (excluding `.kilo/`) returns nothing.

---

## 8. Criteria scorecard

| AC | Requirement | Verdict | Key evidence |
| --- | --- | --- | --- |
| **1** | CSV path is `os.path.join(args.output_dir, ...)`; `--output-dir` created before the write; never in CWD | **MET** (already satisfied by IMP-002; nothing left to fix) | `paper-collector.py:303` (`makedirs`) precedes `:306` (`to_csv(os.path.join(...))`); single write site repo-wide in the CLI; run A put the CSV in the nested tmpdir with an empty CWD; run B (default) put it in `$CWD/results/`, never the CWD root; variants 1 & 3 show the test pins both halves |
| **2** | Test runs `main()` with `--save-csv --output-dir <tmpdir>`; asserts CSV under tmpdir and none in CWD | **MET** | `tests/test_paper_collector.py:244-273` — real `main()` at `:258`, absent/nested dir pinned at `:251`, presence at `:261`, CWD at `:267`, plus "exactly one CSV" at `:262`. Non-vacuous under variants 1, 2 and 3 |
| **3** | `readme.md` CLI table still shows the same flag name and description for `--save-csv` | **MET** | `git diff --numstat readme.md` = `3 0`, no deletions; `readme.md:109` byte-identical; note at `:111-112` verified accurate against `:303-313` |

**3/3.**

## 9. Issues for the implementer (none blocking)

1. *(N1, §3.3)* Consider qualifying `readme.md:111-112` with "the CLI writes…" or filing the
   notebook's CWD CSV write (`notebooks/paper-collector.ipynb` cell-source line 57) as its own item,
   so the note is not over-applied to the notebook advertised at `readme.md:124-127`.
2. *(N2, §3.3)* `readme.md:106`'s `--output-dir` description could eventually mention the CSV, but
   AC3 forbids touching it now; the `:111-112` note is the sanctioned workaround.
3. *(N3, §3.3)* `.improve/REPO_PROFILE.md` is stale on PY-29 (still "open", cites the obsolete line
   `:138`). Correctly escalated rather than edited; whoever owns the profile should close it.