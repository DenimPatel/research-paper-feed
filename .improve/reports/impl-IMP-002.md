# IMP-002 — Implementation report

## Files changed (only these two; both inside my allowed paths)

| File | Change |
| --- | --- |
| `scripts/paper-collector.py` | `main()` (lines 137-147): one `topic_slug = safe_filename(topic)` now feeds **both** output paths, and both are `os.path.join`ed onto `args.output_dir`. `os.makedirs(args.output_dir, exist_ok=True)` moved above the CSV write. |
| `tests/test_paper_collector.py` | Added `make_frame()` helper + `MainOutputPathTests` (3 tests, lines 65-151). |

Nothing under `web/`, `readme.md`, `CONTRIBUTING.md`, `.gitignore`, `notebooks/`, or
`.improve/FEATURES.md` was touched. No git write command was run.

## The change (`scripts/paper-collector.py:137-147`)

Before:

```python
    if args.save_csv:
        df.to_csv(topic + "_papers.csv", index=False)

    prefix = datetime.now().strftime("%m-%d-%Y-%H-%M-%S")
    os.makedirs(args.output_dir, exist_ok=True)
    filename = f"{args.output_dir}/{topic}-{len(df)}_papers_extracted_on_{prefix}.html"
```

After:

```python
    topic_slug = safe_filename(topic)
    os.makedirs(args.output_dir, exist_ok=True)

    if args.save_csv:
        df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)

    prefix = datetime.now().strftime("%m-%d-%Y-%H-%M-%S")
    filename = os.path.join(
        args.output_dir,
        f"{topic_slug}-{len(df)}_papers_extracted_on_{prefix}.html",
    )
```

Rationale, mapped to the acceptance criteria:

- **AC1 (one sanitized slug, both paths inside `--output-dir`).** `safe_filename` replaces
  `\ / : " * ? < > |`, so the slug can never contain a path separator; the slug is only ever a
  *substring* of a filename (`<slug>_papers.csv`, `<slug>-<N>_papers_extracted_on_<ts>.html`), so
  even the un-fixed `safe_filename("..") == ".."` case is safe here — the resulting components are
  `.._papers.csv` and `..-0_papers_extracted_on_….html`, ordinary files, not the `..` directory.
  That is why this item does **not** need IMP-023 to land first and does not duplicate its tests.
- **AC1 requires the realpath of *each* path to start with `realpath(output_dir) + os.sep`,** which
  is only satisfiable if the CSV is also written under `--output-dir`. Today the CSV is written to
  CWD (`topic + "_papers.csv"`), which is profile bug **PY-29**. Routing it through `output_dir` is
  therefore not optional scope creep — it is what the criterion states, it is the reason
  `results/*.csv` exists in `.gitignore:6`, and it fixes PY-29 as a side effect. No flag name,
  default, or help string changed, so no `readme.md` update is required (and `readme.md` is outside
  my allowed paths anyway).
- `os.makedirs` had to move above the CSV write, otherwise `--save-csv` into a not-yet-created
  `--output-dir` would raise `FileNotFoundError` (`check_parent_directory`).
- `os.path.join` replaces the f-string `"/"` join so the documented naming is byte-identical for
  ordinary topics while a trailing slash on `--output-dir` no longer yields a doubled separator.

**Deliberately NOT done (out of scope):** `safe_filename` itself (IMP-023 / PY-27), the exit code
(PY-32), the missing `encoding=` on `open()` (PY-36), the CWD-relative `--download-*` targets
(PY-31), the HTML validity bugs (PY-33/PY-34), and the notebook fork. `notebooks/paper-collector.ipynb`
is explicitly **not** in scope and was not touched (profile trap 6: a fix to one is not a fix to the
other).

## Tests added (`tests/test_paper_collector.py`)

`MainOutputPathTests` — hermetic, offline, no arXiv call: `fetch_papers` is swapped for a lambda
returning a one-row frame, `sys.argv` is patched to drive `parse_args()`, stdout is captured with
`contextlib.redirect_stdout`, and CWD is moved into a `tempfile.mkdtemp()` sandbox
(`<base>/<sandbox>/work`, `--output-dir` = `<sandbox>/work/results`) so that a regression writes into
temp instead of dirtying the repo root. Each run gets a fresh sandbox and the *set difference* of
files under the sandbox is the exact set of files that run created — that is what makes "no file was
created outside it" (AC2b) assertable.

- `test_traversal_topic_stays_inside_output_dir` — **AC2**: `--topic '../../escape'`, asserts exactly
  one HTML file, that it is inside `<tmpdir>` by `os.path.realpath`, and that its content is real
  output.
- `test_csv_and_html_paths_stay_inside_output_dir_for_every_topic` — **AC1**: `subTest` over all five
  required topics (`../../escape`, `a/b`, `..`, `cat:cs.CV AND "3d reconstruction"`, `cat:cs.CV`)
  with `--save-csv`; every created file must satisfy
  `realpath(path).startswith(realpath(output_dir) + os.sep)`, and the single CSV must be named
  `safe_filename(topic) + "_papers.csv"`.
- `test_plain_topic_keeps_documented_html_naming` — pins the documented
  `<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html` name for a plain topic
  (`cat_cs.CV-1_papers_extracted_on_…​.html`), i.e. the readme compatibility surface survives
  sanitization.

Per AC2, no `safe_filename(".")`/`safe_filename("..")` unit test was added — those belong to IMP-023.
Style follows REPO_PROFILE §5.2: `tempfile` imported inside the methods that use it, `unittest`
`TestCase`s, monkeypatching restored in `tearDown`, 4-space indent, double quotes, no type
annotations.

## Commands run and results

| Command | Result |
| --- | --- |
| `/usr/local/bin/python3.11 -m unittest discover -s tests -v` (before) | `Ran 27 tests … OK` — baseline confirmed |
| `/usr/local/bin/python3.11 -m unittest discover -s tests -v` (after) | **`Ran 30 tests … OK`** (27 pre-existing + 3 new), ~0.02 s |
| `/usr/local/bin/python3.11 -m compileall -q scripts tests` | exit 0 |
| Mutation check: copy of `scripts/` + `tests/` in `/tmp/…/kilo/imp002-mutation` with `main()` reverted to the pre-fix body, same suite | **`FAILED (failures=6, errors=1)`** — all 3 new tests fail pre-fix (`escape-1_papers_extracted_on_….html was written outside …/work/results`, `cat:cs.CV_papers.csv was written outside …/work/results`, naming regex mismatch, and `OSError: Cannot save file into a non-existent directory: 'a'` for `--topic a/b`, which is the item's `FileNotFoundError` symptom as pandas raises it). The 27 pre-existing tests still passed. Scratch copy deleted. |
| `/usr/local/bin/python3.11 scripts/paper-collector.py --topic '../../escape' --max-papers 2 --save-csv --output-dir /tmp/rpf-topic-escape` | `find /tmp/rpf-topic-escape -type f` → `.._.._escape_papers.csv`, `.._.._escape-0_papers_extracted_on_10-02-2026-00-17-58.html`. `/tmp/escape*`: none. Repo root `*_papers`/`escape`: none. (`git status --porcelain` unchanged apart from intended files.) |
| `/usr/local/bin/python3.11 scripts/paper-collector.py --topic 'cat:cs.CV AND "3d reconstruction"' --max-papers 1 --save-csv --output-dir /tmp/rpf-topic-readme` | 1 paper; wrote `cat_cs.CV AND _3d reconstruction_-1_papers_extracted_on_….html` + `cat_cs.CV AND _3d reconstruction__papers.csv`, both inside the output dir. No `FileNotFoundError`; no `:`/`"` left in any filename. |
| `/usr/local/bin/python3.11 scripts/paper-collector.py --topic 'a/b' --max-papers 1 --save-csv --output-dir /tmp/rpf-topic-slash` | 1 paper; wrote `a_b-1_papers_extracted_on_….html` + `a_b_papers.csv` inside the output dir. Previously this crashed. |
| `… -c "…parse_args() with sys.argv=['paper-collector.py']"` and `--help` | Defaults unchanged: `--output-dir` `results`, `--max-papers` `1000`, `--topic` `None`, three boolean flags `False`; flag names and help text byte-identical to before. |
| `git status --porcelain` | `M .improve/FEATURES.md` (the loop's status flip), `M scripts/paper-collector.py`, `M tests/test_paper_collector.py`, `M web/src/lib/paperIndex.ts`, `M web/src/lib/__tests__/paperIndex.test.ts`, `?? .improve/reports/impl-IMP-003.md` — the `web/` files and `FEATURES.md` belong to the concurrent IMP-003 agent, not me. All temp output dirs deleted. |

## Uncertain / for the verifier

1. **The CSV moving from CWD into `--output-dir` is a deliberate behaviour change** forced by AC1
   ("`os.path.realpath` of each path must start with `os.path.realpath(args.output_dir) + os.sep`").
   It is not mentioned in the Intent paragraph and it also resolves PY-29. If the loop prefers to
   keep PY-29 for its own item, AC1 has to be reworded instead — the two cannot both hold.
2. `readme.md:100` and the `--output-dir` argparse help still say "Directory the generated HTML feed
   is written to", which is now incomplete (the CSV lands there too). I did not edit either: the
   help text lives in `scripts/` (allowed) but `readme.md` does not (forbidden), and editing one
   without the other would desynchronize the documented flag table. Left as a discovery.
3. The verification command in the spec names `/tmp/rpf-venv/bin/python`, which does not exist on
   this machine; I used `/usr/local/bin/python3.11` (the interpreter REPO_PROFILE §3.1 designates).
4. During the live `../../escape` run the arXiv API answered **HTTP 429**, so that run fetched 0
   papers and still wrote a 0-paper HTML file. That is pre-existing `iter_results` behaviour
   (profile trap 3 / IMP-004), not a regression, and it does not affect the path assertions — which
   is why the unit tests stub `fetch_papers` instead.
5. No linter exists for Python (PE-6), so `compileall` plus the suite is the whole gate; no
   `npm`/Playwright work was needed because nothing under `web/` changed.
