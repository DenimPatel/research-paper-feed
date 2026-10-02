# Discovered while implementing IMP-023 — NOT fixed here

Found while making `safe_filename` a real sanitizer. None of these are in IMP-023's acceptance
criteria and none were touched. Line numbers are from `scripts/paper-collector.py` as it stands
after the IMP-023 change.

---

## D1 — `--download-pdfs` / `--download-sources` ignore `--output-dir` entirely (same class as IMP-025)

`fetch_papers` (`:211-219`) writes three artifacts relative to the **current working directory**
and never looks at `args.output_dir`:

```python
title_slug = safe_filename(result.title)
...
result.download_pdf(filename=f"{title_slug}.pdf")
result.download_source(filename=f"{title_slug}.tar.gz")
extract_source_archive(f"{title_slug}.tar.gz", f"./extracted/{title_slug}")
```

So `--output-dir /tmp/foo --download-pdfs` puts the PDFs in the repo root and the extracted trees
under `./extracted/` in the repo root. IMP-002 fixed exactly this for the HTML feed and the CSV
(`:277`, `:282-291`); the three download paths are the remaining half of the same bug, and the
`./extracted/` path is additionally **hardcoded** rather than derived from `--output-dir` at all.

Why it matters beyond tidiness: with 200 papers you get 200 `*.pdf` + 200 `*.tar.gz` files in the
repo root, and `extracted/`, `*.pdf` and `*.tar.gz` are untracked and *not* gitignored (REPO_PROFILE
PE-12), so a `--download-pdfs` run dirties `git status` with hundreds of entries.

**Not fixed here** — it changes the meaning of two documented flags and needs its own item
(they are also the two flags broken by arxiv 4.x, PE-8).

## D2 — `main()` writes the HTML feed with no `encoding=`

`:288` — `with open(filename, "w") as file:`. Under a non-UTF-8 locale (a container, an
`LC_ALL=C` Actions runner) a paper title with a non-ASCII character raises `UnicodeEncodeError`
after the CSV has already been written, leaving a half-finished output dir. The sibling writer
`build_index.py:240` passes `encoding="utf-8"` explicitly. This is the encoding half of
REPO_PROFILE trap 18 (which only records the CSV half, and cites the now-stale `:143`).

**Not fixed here** — one line, but it is not IMP-023's criterion, and it interacts with D1.

## D3 — `main()` is still called bare, so the exit code is always 0

`:294` — `if __name__ == "__main__": main()`. `main()` returns nothing today so this is currently
harmless, but it means `paper-collector.py` cannot report failure via its exit status (unlike
`build_index.py:309`, which does `sys.exit(main())`). Already tracked as REPO_PROFILE §5.2 /
PY-14; recorded here only so the two halves are not lost.

## D4 — Windows also reserves `COM¹`/`LPT¹` (superscript digits)

The IMP-023 rule matches `CON`, `PRN`, `AUX`, `NUL`, `COM1`-`COM9`, `LPT1`-`LPT9` exactly as the
spec lists them, and uses the correct "everything before the first dot" window. Windows additionally
reserves `COM¹`, `COM²`, `COM³` and the `LPT` equivalents (superscript one/two/three), which this
implementation does not catch. The spec names the 22 ASCII names and nothing else, so matching
those exactly is the correct scope for this item; noting the gap so nobody reads the rule as
"all Windows reserved names".

## D5 — `notebooks/paper-collector.ipynb` has the same weakness, independently

The notebook is a divergent fork (REPO_PROFILE trap 6) and builds filenames from raw
`result.title` with no sanitizer at all, so it is *worse* than the pre-IMP-023 CLI. IMP-023 cannot
fix it without making the notebook import `scripts/paper-collector.py`, which is a structural change
to a file that is not in CI. **Explicitly out of scope for IMP-023** — flagged because
`readme.md:113-118` advertises the notebook as "the same workflow".
