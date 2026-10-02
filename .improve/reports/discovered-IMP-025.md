# Discovered while implementing IMP-025

Found during IMP-025 (`--save-csv` honours `--output-dir`). **None of these were fixed** —
they are outside IMP-025's scope and outside my allowed files (`scripts/`, `tests/`,
`readme.md`).

## 1. `REPO_PROFILE.md` contradicts itself about PY-29 (documentation drift, should be absorbed)

`.improve/REPO_PROFILE.md` §9 bug inventory still lists PY-29 as an OPEN defect:

> | PY-29 | `--save-csv` ignores `--output-dir` — the CSV lands in CWD, where the
> `results/*.csv` ignore rule does not cover it | `paper-collector.py:138` |

But §8 trap 5, "Fixed half", already says:

> **Fixed half:** the raw `--topic` is no longer interpolated into the output paths — both are
> built from `safe_filename(topic)` at `paper-collector.py:238` (IMP-002, commit `d3b4a1e`), and
> `--save-csv` now honours `--output-dir` as a side effect.

So the profile marks PY-29 fixed in one section and open in another. **IMP-025's AC1 is
therefore a no-op against the current code**, and any future verifier who trusts §9 will
re-report an already-fixed defect.

Action needed from the coordinator (I am not allowed to edit `REPO_PROFILE.md`):
mark PY-29 **FIXED — IMP-002 (commit `d3b4a1e`), pinned by IMP-025's
`tests/test_paper_collector.py:244`**, and re-point its location column at
`paper-collector.py:306` (the line number `:138` is stale; the file is 319 lines).
Both stale references in §8 trap 5 (`:238`) and §8 trap 17 (`paper-collector.py:138`) have the
same problem — they cite pre-IMP-002 line numbers.

## 2. Same defect class still open: `--download-pdfs` / `--download-sources` write to CWD

`scripts/paper-collector.py:239-243` still writes PDFs, `.tar.gz` archives, and the
`./extracted/` tree relative to the **process CWD**, not `--output-dir`:

```python
result.download_pdf(filename=f"{title_slug}.pdf")
result.download_source(filename=f"{title_slug}.tar.gz")
extract_source_archive(f"{title_slug}.tar.gz", f"./extracted/{title_slug}")
```

So the `--output-dir` containment invariant that IMP-025/AC1 now guarantees for the CSV is
**still violated by both download flags**, and `./extracted/` lands wherever the user happened
to be. This is already tracked as **PY-31** in §9 ("Downloads and extractions land in CWD, not
`--output-dir`; the `.tar.gz` is never deleted after extraction") — flagging it only because
IMP-025's spec text ("so the CSV never lands in CWD") could be read as claiming the whole CLI
never writes to CWD, which is not yet true. Not a new defect; a scoping caveat.

Note that `MainOutputPathTests` cannot catch this today because it never passes
`--download-pdfs` / `--download-sources`.

## 3. PE-12 is now stale in one respect

Root `.gitignore` does not cover `*_papers.csv` in the repo root, which was the *observable*
harm of PY-29. With PY-29 closed that stray-file scenario is gone for the CSV (confirmed: the
real CLI run below left the repo root clean). The remaining unignored stray artifacts from the
CLI are the `.pdf` / `.tar.gz` / `extracted/` ones from item 2 above. No action needed for
IMP-025; noted so nobody re-adds a `.gitignore` rule for a bug that can no longer happen.