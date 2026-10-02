# IMP-024 — discovered, not fixed

Found while implementing IMP-024. **None of these were touched.** Listed so the coordinator can
route them; each needs its own item.

> **Attempt 2 note.** D1 is still accurate. D6–D9 were found while fixing the verifier's findings in
> attempt 2 and are new. D2/D3/D4/D5 are unchanged.

## D6. A dangling in-tree hardlink aborts the whole run with an uncaught `KeyError` (HIGH, pre-existing)

`TarFile._find_link_target` raises `KeyError: "linkname 'nope.tex' not found"` for a hardlink whose
target is not in the archive. `KeyError` is **not** in `fetch_papers`' except tuple
(`arxiv.ArxivError, OSError, tarfile.TarError`), so a single crafted archive kills the run for every
remaining paper. The verifier confirmed the behaviour is identical before and after the fix
(pre-existing, not a regression), and my own adversarial pass reproduced it. After attempt 2 the same
`KeyError` also fires when a hardlink points at a member the screen **rejected** — so the hardened
fallback does not introduce it, but it now has one more way to be reached.
Suggested fix: catch `KeyError` (and `EOFError`/`struct.error` from a hostile header) alongside
`OSError`/`TarError`, or validate hardlink targets against the surviving member set before
extracting. Not done here — out of IMP-024's scope.

## D7. `data_filter` returns `mode=None` for symlink members — a logging landmine (MED, now handled)

`tarfile.data_filter(member, path)` returns a `TarInfo` whose `.mode` is `None` for symlinks (CPython
uses `None` to mean "do not chmod this link"). Any `%o` formatting of `filtered.mode` raises
`TypeError: %o format: an integer is required, not NoneType` **inside the logging handler**, which
would abort extraction of that archive rather than merely losing a log line. It bit me while
implementing the verifier's Issue 2; handled locally via `mode_str()` in
`scripts/paper-collector.py`. Recording it because any future code that logs a filtered member's
mode will hit it again, and it is easy to mistake for a "harmless logging bug".

## D8. The `data` filter *relocates* absolute members rather than rejecting them (MED, documented)

`/etc/passwd` as a member name is silently rewritten to `<dest>/etc/passwd` and extracted; the `data`
filter's job is containment, not rejection. My hand-rolled fallback instead **rejects** absolute
members. Both are safe, but they are not equivalent, so a future change that routes old-Python
extraction through the data filter (or vice versa) changes which benign-ish archives survive. Three
real arXiv source archives contain no such members (23/28/48 files extracted either way), so this is
theoretical today. Worth a note in whichever item eventually removes the fallback.

## D9. Test-fixture escape-target hygiene (LOW, now handled)

The first version of my escape assertions walked the sandbox and compared against a `realpath` prefix.
On macOS `/var` is a symlink to `/private/var`, so every legitimately extracted file inside the
destination was reported as an escape (26 false "leaks"). Any future escape test in this repo must
compare `realpath` on **both** sides, or snapshot before/after and diff. Also note `assertLogs`
raises if nothing was logged, so an assertion inside its block is the only way to make "the file
escaped" fail *before* "no warning was logged".

## D1. `tarfile` filter traps that make the obvious one-line fix wrong (HIGH — verifier trap)

Both are silent-security traps for anyone (including a future agent) editing
`scripts/paper-collector.py:35-62`. Measured on 3.11.8 / 3.12.7 / 3.13.0 / 3.14.3, not from memory.

1. **`file.errorlevel = 0` + `filter="data"` does not block traversal on Python ≤3.13.** With
   `errorlevel = 0`, `TarFile._get_extract_tarinfo` swallows the `FilterError` and leaves `tarinfo`
   bound to the **unfiltered** member, so `../escape.txt` is written anyway. Observed on 3.11.8,
   3.12.7 and 3.13.0; only 3.14.3 (where the *default* is `data`) correctly skips it. Anyone who
   "fixes" the abort problem by lowering `errorlevel` reopens the CVE.
2. **A bare `file.extractall(dest, filter="data")` aborts the archive on the first rejected member.**
   `TarFile.errorlevel` defaults to **1** for read-mode archives and `_handle_fatal_error` re-raises
   whenever `errorlevel > 0`, so a legitimate arXiv tarball with one odd member loses every
   subsequent file, and `fetch_papers`' existing `except (…, tarfile.TarError)` turns that into a
   generic `Failed to download resources for …` warning. That is precisely the silent data loss
   IMP-024's Notes warn about, so the fix screens members first and passes `members=safe_members`.

Suggested action: add a regression test that asserts a tarball whose *last* member is malicious still
yields all of its benign members, so neither trap can be reintroduced.

## D2. The filter does not defend against a hostile *destination* (still open, by design)

`filter="data"` guarantees members stay inside `dest`; it says nothing about `dest` itself.
`safe_filename("..") == ".."` (profile §8 trap 5 / PY-27, i.e. **IMP-023, still TODO**), so a paper
titled `..` yields `dest == "./extracted/.."`, the repository root, and every member lands there —
inside the filter's own boundary, so nothing is rejected and nothing is logged. IMP-023 is
therefore still required, and IMP-024 must not be credited as closing PY-27. Worth an explicit
note in the IMP-023 acceptance criteria that `filter="data"` is not a substitute for sanitising the
slug.

## D3. Docs nit: `--download-sources` no longer guarantees "every member extracted"

`readme.md:101-102` describes `--download-sources` as "download and extract each paper's LaTeX
source archive" with no mention that unsafe members are now skipped (and logged at `WARNING`).
Three real arXiv source archives (1706.03762, 1810.04805, 2010.05425) lost **nothing**, so this is
documentation only. `readme.md` was outside my allowed paths for IMP-024. This also collides with
IMP-022's criterion 5, which already requires a `readme.md` flag-table pass.

## D4. `tarfile.extractall` behaviour that a verifier may mis-assume

- `data_filter` **rewrites** an absolute member name into the destination instead of rejecting it:
  `/abs/path.tex` becomes `<dest>/abs/path.tex`. A test asserting "absolute members are rejected"
  would be wrong.
- `data_filter` **does** reject an escaping symlink/hardlink target
  (`evil-link -> ../../../../etc/passwd`) and any `..` that leaves the destination.
- On interpreters that lack filters, the default remains fully permissive, and the 3.14 default flip
  means a *future* CPython could change behaviour again — which is the argument for the
  capability check over a version check.

## D5. Pre-existing, untouched by me

- **PE-8 / PY-26**: `--download-pdfs` / `--download-sources` still raise `AttributeError` on
  `arxiv>=4` (`download_pdf`/`download_source` were removed), escaping the
  `except (arxiv.ArxivError, OSError, tarfile.TarError)` handler. My end-to-end run only worked
  because the provisioned interpreter has `arxiv 2.1.3`.
- **PE-10 / INF-09**: `ci.yml:15` still floats `python-version: "3.x"`, so "which Python is CI"
  remains unpinned. Fine today (3.13/3.14 both have filters), but the item's own Area line
  `.github/workflows/ci.yml:15` was not addressed because `ci.yml` is outside my allowed paths.
- **PY-31**: downloads and extractions still land in CWD (`./extracted/…`), not `--output-dir`, and
  the `.tar.gz` is never deleted. I ran the live check from a `/tmp` sandbox for this reason.
- Profile §9 row **PY-30** (`tarfile.extractall` with no `filter=`) is now fixed by IMP-024;
  PY-27, PY-28, PY-29, PY-31–PY-39 remain open.