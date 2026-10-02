# IMP-024 — Pass `filter="data"` to `tarfile.extractall` (implementation report, attempt 2)

Status: **done**, addressing every finding in `.improve/reports/verify-IMP-024.md` (verdict was FAIL).
Python suite: **44 tests, OK** (39 pre-existing baseline + 5 in `ExtractSourceArchiveTests`).

## Files changed (2, both in scope)

| File | Change since attempt 1 |
| --- | --- |
| `scripts/paper-collector.py` | Fallback branch is now a **safe hand-rolled screen** (`is_inside`, `rejection_reason`) instead of a bare `extractall`; `mode_str` helper; the data-filter path now **logs rewrites** (relocated absolute names, stripped privileged bits); `except` widened to `(tarfile.FilterError, ValueError)`. `TARFILE_HAS_FILTER`, the pre-screen design and the `filter="data"` call are unchanged. |
| `tests/test_paper_collector.py` | `ExtractSourceArchiveTests` grown from 2 to 5 tests; the fallback test now asserts **safety**; new test pins `filter="data"`; new test pins the rewrite log; new `_write_attack_archive` fixture. |

Not touched: `web/`, `readme.md`, `CONTRIBUTING.md`, `.github/`, `.improve/FEATURES.md`,
`.improve/REPO_PROFILE.md`. No git write commands. No CLI flag, default or output name changed —
`--help` is byte-identical to `HEAD` (verified, see command 8).

## Finding 1 (SECURITY, blocking) — the fallback was fully permissive

`FORCE_FALLBACK=1` measured 21 escape routes in attempt 1 (`file.extractall(dest)` = the
CVE-2007-4559 primitive itself). The fallback now screens every member itself and passes only
survivors to `extractall` (`scripts/paper-collector.py:35-67, 73-96`):

```python
def is_inside(root, path):
    """Return True when ``path`` is ``root`` or sits underneath it."""
    try:
        return os.path.commonpath([root, path]) == root
    except ValueError:
        return False


def rejection_reason(member, dest):
    root = os.path.realpath(dest)
    try:
        if not is_inside(root, os.path.realpath(os.path.join(root, member.name))):
            return "would be extracted outside %s" % root
        if member.issym():
            link = os.path.join(root, os.path.dirname(member.name), member.linkname)
        elif member.islnk():
            link = os.path.join(root, member.linkname)
        else:
            link = None
        if link is not None and not is_inside(root, os.path.realpath(link)):
            return "links to %r, which is outside %s" % (member.linkname, root)
        if link is None and not (member.isfile() or member.isdir()):
            return "is a special file"
    except ValueError as exc:
        return "has an unusable name (%s)" % exc
    return None
```

Design notes:

- **One containment check covers both `..` and symlinked parents.** The check is on
  `realpath(join(root, member.name))`, and `realpath` resolves symlinks in the member's *parent*
  directories, so a member routed through a symlinked directory is caught, not just one that spells
  out `..`. `commonpath` (not `startswith`) is used so `/…/Paper` cannot match `/…/Paper-evil`.
- **Symlink targets** are resolved relative to the member's own directory, **hardlink** targets
  relative to the archive root, mirroring tar semantics and CPython's `data_filter`.
- **Special files** (char/block device, FIFO) are rejected, as `data_filter` does.
- **`ValueError`** is caught both around the containment test and inside `is_inside` (NUL in a name,
  or `commonpath` refusing to mix absolute and relative paths on Windows). Nothing escapes the
  handler and crashes the run.
- **Everything rejected is logged** with the member name, the archive path and a plain-English
  reason, using the same `logging.warning` shape as the pre-screen path.
- The screen runs over `getmembers()` **before** any extraction, so a rejected symlink is never
  created and cannot be used as a stepping stone by a later member.

The one behavioural difference from the data-filter path: `data_filter` **relocates** an absolute
member into the destination, whereas the fallback **rejects** it. Stricter, and it is invisible on
real archives (command 7).

## Finding 2 (MED) — silent rewrites are now logged

The pre-screen now keeps `data_filter`'s return value and reports anything it changed
(`scripts/paper-collector.py:98-116`):

```python
mode_changed = (
    member.mode is not None
    and filtered.mode is not None
    and filtered.mode != member.mode
)
if filtered.name != member.name or mode_changed:
    logging.warning(
        "Sanitized member %r in %s: name %r, mode %s -> %s",
        member.name, archive_path, filtered.name,
        mode_str(member.mode), mode_str(filtered.mode),
    )
```

Two bugs found while implementing this, both caught by the new test rather than by reading:

1. **`data_filter` returns `mode=None` for symlink members** (it uses `None` as "do not chmod the
   link"). A naive `mode %o` in the log call raised `TypeError: %o format: an integer is required,
   not NoneType` inside the logging handler — which would have crashed extraction. Hence `mode_str`.
2. Because `mode=None` is *normal* for links, a naive `filtered.mode != member.mode` comparison would
   have emitted a bogus "sanitized" line for every symlink in every archive. The `mode is not None`
   guards keep symlinks out of the log while still reporting real setuid/setgid/sticky stripping
   (`4755 → 0755`, `6000 → 0600`) and real name relocation (`/etc/x → <dest>/etc/x`).

Also folded in (verifier Issue 5, defence in depth): the pre-screen's handler is now
`except (tarfile.FilterError, ValueError)`.

## Finding 3 (LOW) — `filter="data"` is now pinned by a test

`test_extractall_is_called_with_the_data_filter` wraps `tarfile.TarFile.extractall`, records the
call, and asserts `filter == "data"`, `path == dest`, `"main.tex"` is in the members list and
`"../escape.txt"` is **not**. This is the mutant the verifier could not catch (V3); see mutation M2
below — it is now caught.

## Finding 4 (LOW) — the fallback test no longer pins insecure behaviour

`test_interpreter_without_filter_warns_and_still_extracts` asserted the traversal member *was*
written. It is replaced by two tests:

- `test_interpreter_without_filter_still_blocks_traversal` — forces `TARFILE_HAS_FILTER = False`,
  then asserts **nothing escaped** the destination, `main.tex` and the in-tree `paper.ps` symlink
  **were** extracted (so `--download-sources` still works), and the escape was reported.
- `test_interpreter_without_filter_blocks_every_escape_route` — forces the fallback against
  `_write_attack_archive`, whose every member tries to escape: `../escape.txt`, `../../../pwned_deep.txt`,
  an absolute member, a write routed through a symlinked directory, an absolute symlink, a `../../../`
  symlink, a char device and a FIFO. Asserts zero escapes, the sentinel path was never created,
  `main.tex` and the benign in-tree link survived, and each skipped member was reported by name.

All escape targets live inside the test's own `tempfile` sandbox, so even a reverting mutant cannot
litter `/tmp`.

## Finding 8 (INFO, cosmetic) — fixed

Fixture payload is now `b"% arXiv source\n"`, so the ambiguous `b"\\documentclass{article}\n"` is gone.

## Verification

Python interpreter: `/usr/local/bin/python3.11` = **3.11.8**. All commands from the repo root.

| # | Command | Result |
| --- | --- | --- |
| 1 | `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | **`Ran 44 tests ... OK`** (39 baseline unchanged + 5). No test skipped. |
| 2 | `/usr/local/bin/python3.11 -m compileall -q scripts tests` | exit 0 |
| 3 | `git diff --stat -- scripts/ tests/` | `scripts/paper-collector.py +105/-2`, `tests/test_paper_collector.py +187` |
| 4 | **mutation harness** (`/tmp` copies, repo never touched) — 6 mutants | **6/6 CAUGHT** (table below) |
| 5 | **adversarial harness** — 25 archives × {data-filter path, forced fallback} on 3.11.8 | **TOTAL ESCAPES: 0** on both paths |
| 6 | same harness on 3.8.19 / 3.12.7 / 3.13.0 / 3.14.3 | **TOTAL ESCAPES: 0 / 0** on all four, both paths |
| 7 | 3 **real arXiv source archives** (1706.03762, 1810.04805, 2010.05425) through both paths | identical results: **23 / 28 / 48** files, zero rejections — the fallback does not over-block |
| 8 | `--help` of the new module vs `git show HEAD:scripts/paper-collector.py` (both loaded with the repo `scripts/` on `sys.path`) | **byte-identical**, 20 lines |
| 9 | `git status --porcelain` | only `scripts/paper-collector.py` + `tests/test_paper_collector.py` are mine; the rest is the concurrent `web/` agent and the loop harness |

### 4 — mutation results (each mutant applied to a fresh `/tmp` copy of `scripts/` + `tests/`)

| Mutant | Expected red test | Outcome |
| --- | --- | --- |
| **M1** fallback reverted to bare `file.extractall(dest)` | both fallback tests | **CAUGHT** — `FAIL test_interpreter_without_filter_still_blocks_traversal` (`Lists differ: [.../extracted/escape.txt] != []`) + `ERROR test_interpreter_without_filter_blocks_every_escape_route` |
| **M2** `filter="data"` dropped from the `extractall` call | `test_extractall_is_called_with_the_data_filter` | **CAUGHT** — this is exactly the verifier's V3 mutant, previously invisible |
| **M3** pre-screen inverted (rejected members kept too) | `test_traversal_member_is_skipped…` | **CAUGHT** |
| **M4** sanitized-member log removed | `test_rewritten_member_name_is_reported` | **CAUGHT** |
| **M5** hand-rolled screen reduced to `os.path.isabs` only | `test_interpreter_without_filter_blocks_every_escape_route` | **CAUGHT** (also reds `…still_blocks_traversal`) |
| **M6** hand-rolled screen drops the link-target check | `test_interpreter_without_filter_blocks_every_escape_route` | **CAUGHT** |

Every mutant reddens only the intended test(s); the other 39+ tests keep passing.

### 5/6 — adversarial detail (25 archives, both code paths, 5 interpreters)

Cases: benign-only (6 members incl. nested dirs and an in-tree hardlink), `../evil.txt`, `..//evil.txt`,
`../../../../evil`, `sub/../../evil`, member named `..`, member named `.`, absolute member, absolute
member under `/etc`, absolute directory member, symlink → `/tmp` dir, symlink → `../../../../`,
symlink → `.`, hardlink → `/etc/passwd`, hardlink → `../../etc`, symlinked dir + write through it,
symlinked dir → `..` + write through it, symlink chain `a→b→/tmp`, char device, block device, FIFO,
setuid member, unicode traversal, backslash traversal, benign + traversal mixed.

**0 escapes on 3.11.8, 3.12.7, 3.13.0, 3.14.3 and 3.8.19, on both paths.** Notable behaviours that
are safe in both: the symlinked-directory write-through lands *inside* the destination because the
symlink is rejected and never created; `FileExistsError` from the dangling-link case is an `OSError`
and is caught by `fetch_papers`' existing handler; a member named `.` raises `IsADirectoryError`
(also an `OSError`), pre-existing on both paths.

### Extra proof: the fallback uses **no** filter API at all

`/tmp/no_filter_api.py` deletes `tarfile.data_filter`, `tarfile.FilterError` and the other filter
error classes and replaces `TarFile.extractall` with a two-parameter shim, then forces the fallback —
a faithful simulation of a pre-3.8.17 `tarfile`. Run on **3.8.19** and **3.11.8**:

```
python 3.8.19 | data_filter present: False | FilterError present: False | TARFILE_HAS_FILTER: False
inside dest : ['main.tex', 'main.tex']      # the file plus the in-tree symlink
outside dest: []
RESULT: SAFE
```

with four logged rejections (`../evil.txt`, the absolute member, `../../deep_evil.txt`, the absolute
symlink). The same probe on **3.14.3** cannot be simulated — 3.14's own `extractall` defaults to
`data_filter`, so deleting it raises `NameError` *inside CPython*. That is an artefact of the
simulation, not of this code; 3.8.19 and 3.11.8 are faithful.

## Python-version compatibility reasoning

- `TARFILE_HAS_FILTER` is still a **capability** check, not a version check:
  `"filter" in inspect.signature(tarfile.TarFile.extractall).parameters and hasattr(tarfile, "data_filter")`.
- Measured on this machine: 3.8.19, 3.11.8 (provisioned), 3.12.7, 3.13.0, 3.14.3 **all** report
  `True`. CI's floating `python-version: "3.x"` resolves to 3.14.x, which also has filters, so CI
  takes the data-filter path and the tests run rather than skip.
- The filters were backported to **3.8.17 / 3.9.17 / 3.10.12 / 3.11.4**; before those the fallback is
  the only path — and it is now safe rather than permissive, which is the whole point of this
  revision. Reachable only on EOL or unpatched interpreters, and `requirements.txt` declares no
  `python_requires`.
- The fallback deliberately uses only `os.path` and `TarInfo` predicates (`issym`, `islnk`, `isfile`,
  `isdir`, `linkname`, `name`), all of which exist in every Python 3.x — verified by the
  delete-the-filter-API run above.
- `tarfile.FilterError` is referenced only inside the `TARFILE_HAS_FILTER` branch, so an interpreter
  without it never evaluates that name.

## Things I did not fix (unchanged from attempt 1 unless noted)

1. **`safe_filename("..") == ".."` (IMP-023 / PY-27) is still open** — the filter constrains members
   to `dest`, not `dest` itself. Unchanged; see `discovered-IMP-024.md` D2.
2. **`ci.yml:15` still floats `python-version: "3.x"`** (PE-10) — outside my allowed paths.
3. **Dangling in-tree hardlink → `KeyError`** from `TarFile._find_link_target`, which escapes
   `fetch_papers`' `except (arxiv.ArxivError, OSError, tarfile.TarError)` and aborts the run. The
   verifier confirmed it is pre-existing and identical before/after the fix; it also now applies to a
   hardlink whose target was rejected by the screen. Left alone, recorded in `discovered-IMP-024.md`.
4. `getmembers()` materialises the member index (verifier Issue 7) — irrelevant at arXiv archive
   sizes (largest observed 1.15 MB).
5. `readme.md` does not mention that unsafe members are now skipped (verifier D3 / my D3) — docs only,
   `readme.md` is out of my allowed paths.