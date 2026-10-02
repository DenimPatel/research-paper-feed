# Verification report — IMP-024, round 2 (re-verification after a FAIL)

Verifier: independent, skeptical sub-agent. **No repo source file was modified.** No git write
command was run. Scope: `git diff -- scripts/ tests/` + untracked files in those dirs. `web/`
ignored (concurrent agent). Scratch artifacts only under `/tmp/imp024r2/`.

**VERDICT: PASS** (with one MEDIUM non-blocking residue).

Attempt 1's verdict was FAIL because the CVE-2007-4559 primitive was still shipped at
`scripts/paper-collector.py:46` as a bare `file.extractall(dest)` on the fallback branch, which I
broke 21 ways. That branch is gone. All four previous findings are addressed. One gap remains: the
fallback branch does not strip or log privileged mode bits (Issue R1 below). It does not reopen the
CVE and it lives on a branch that no patched CPython can reach.

---

## 1. Previous findings — re-checked one by one

### Finding 1 (SECURITY, was blocking) — **FIXED**

The fallback is no longer a bare `extractall`. `scripts/paper-collector.py:78-95` now screens every
member through a hand-rolled `rejection_reason()` (`:43-67`) built on `is_inside()`
(`:35-40`, `os.path.commonpath`) and passes **only survivors** to
`file.extractall(dest, members=safe_members)` (`:94`). `grep -n warnings scripts/paper-collector.py
tests/test_paper_collector.py` → `none`: there is no `warnings.warn`; the `logging.warning` at
`:79-83` is a notice, not the control.

I rebuilt the exact attack class that produced 21 leaks in attempt 1, in
`/tmp/imp024r2/harness.py` — 34 archives driven through the **real** `extract_source_archive` on a
fresh `mkdtemp` sandbox per case, with `arxiv`/`pandas`/`arxiv_common` stubbed into `sys.modules`
so the repo module loads on every interpreter (repo never touched). Cases include
`../evil.txt`, `..//evil2.txt`, 12-deep `../../`, absolute members (`$TMPDIR` and `/etc`), absolute
directory members, symlinks to an absolute canary dir and to `/etc` and to `../../..`, 2- and
3-hop symlink chains then writing through them, hardlinks to `/etc/passwd` / `../../etc/passwd` /
an absolute path, char/block devices, FIFO, setuid/setgid/sticky, unicode traversal, backslash
traversal, members named `..`, `.`, `""`, `sub/../../x`, a symlinked **intermediate** directory
(the attempt-1 exploit), GNU long names, a PAX name with a NUL byte, and a `dest`-reuse case with a
pre-planted hostile symlink.

```
$ /usr/local/bin/python3.11 harness.py          # data-filter path
TOTAL ESCAPES: 0   (python 3.11.8, filter=data)
$ FORCE_FALLBACK=1 /usr/local/bin/python3.11 harness.py
TOTAL ESCAPES: 0   (python 3.11.8, filter=FORCED-FALLBACK)
```

All five interpreters present on this machine, both paths, 340 runs, **0 escapes**:

```
/opt/homebrew/bin/python3.8  3.8.19   filter_in_sig=True data_filter=True  DATA 0  FALLBACK 0
/usr/local/bin/python3.11    3.11.8   filter_in_sig=True data_filter=True  DATA 0  FALLBACK 0
/opt/homebrew/bin/python3.12 3.12.7   filter_in_sig=True data_filter=True  DATA 0  FALLBACK 0
/opt/homebrew/bin/python3.13 3.13.0   filter_in_sig=True data_filter=True  DATA 0  FALLBACK 0
/opt/homebrew/bin/python3.14 3.14.3   filter_in_sig=True data_filter=True  DATA 0  FALLBACK 0
```

Attempt 1 measured **21** escape routes on this path. Now zero. The design holds up under
scrutiny: `realpath(join(root, member.name))` resolves symlinks in the member's *parent*
directories, so a member routed through a symlinked directory is caught, not just one that spells
`..`; `commonpath` (not `startswith`) blocks the `Paper` vs `Paper-evil` sibling prefix — verified
directly in `/tmp/imp024r2/sibling.py`, where the shipped code rejects
`../A Paper Title-evil/sibling_evil.txt` on both paths and the file does not land in the sibling
directory. Symlink targets resolve relative to the member's directory, hardlink targets relative
to the archive root, matching tar semantics and `data_filter`. `ValueError` is caught in both
`is_inside` (`:39-40`) and around the whole screen (`:65-66`), so a NUL byte in a name is rejected
and logged (`it has an unusable name (embedded null byte)`) instead of crashing the run.

Residual behaviours, all safe and all pre-existing (each is an `OSError`, caught by the unchanged
`except (arxiv.ArxivError, OSError, tarfile.TarError)` at `scripts/paper-collector.py:181`):
`FileExistsError` from the dangling-symlink and symlink-then-write cases, `IsADirectoryError` from
a member named `.`, and the previously recorded `KeyError` from a dangling in-tree hardlink.

### Finding 2 (MED, silent rewrites) — **FIXED on the data path, partially on the fallback**

`scripts/paper-collector.py:100-121` now keeps `data_filter`'s return value and logs anything it
changed. Captured `WARNING` lines on 3.11.8, data-filter path:

```
Skipped unsafe member '../evil.txt' in <arc>: '../evil.txt' would be extracted to '<...>/escape.txt', which is outside the destination
Skipped unsafe member 'sdir' in <arc>: 'sdir' is a link to an absolute path
Skipped unsafe member 'hl' in <arc>: 'hl' is a link to an absolute path
Skipped unsafe member 'up' in <arc>: 'up' would link to '/private/var/.../imp024r2-xxxxx', which is outside the destination
Skipped unsafe member 'chardev' in <arc>: 'chardev' is a special file
Skipped unsafe member 'blkdev' in <arc>: 'blkdev' is a special file
Skipped unsafe member 'fifo' in <arc>: 'fifo' is a special file
Skipped unsafe member '../../pwned\x00nul.txt' in <arc>: embedded null byte
Sanitized member '<TMPDIR>/.../abs_evil.txt' in <arc>: name 'var/folders/.../abs_evil.txt', mode 644 -> 644
Sanitized member '/etc/imp024_evil' in <arc>: name 'etc/imp024_evil', mode 644 -> 644
Sanitized member 'suid' in <arc>: name 'suid', mode 4755 -> 755
Sanitized member 'sgid' in <arc>: name 'sgid', mode 2755 -> 755
Sanitized member 'sticky' in <arc>: name 'sticky', mode 1777 -> 755
```

The two classes attempt 1 reported as silent are now reported: **absolute-path members** (both as
`Sanitized member` on the data path and as `Skipped unsafe member … it would be extracted outside`
on the fallback) and **privileged mode bits** (`4755 -> 755`, `2755 -> 755`, `1777 -> 755`). I
enumerated every rejection the fallback emits and **every rejected member carries the member name,
the archive path and a plain-English reason** — no silent class remains on either path. See Issue
R1 for the one thing still not stripped.

`mode_str` (`:70-73`) exists for a real reason: `data_filter` returns `mode=None` for link members,
so a naive `%o` raised `TypeError` inside the logging handler. The `mode is not None` guards at
`:112-114` correctly avoid both the crash and a spurious "Sanitized" line per symlink. I confirmed
no spurious lines: my benign archive with 3 symlinks and 2 hardlinks produced `sanitize=0`.

### Finding 3 (LOW, `filter="data"` unpinned) — **FIXED**

`tests/test_paper_collector.py:269-295` wraps `tarfile.TarFile.extractall`, records the call, and
asserts `filter == "data"`, `path == dest`, `"main.tex" in members`, `"../escape.txt" not in
members`. Verified by mutation, in a scratch copy under `/tmp`, repo untouched:

```
M2 filter='data' removed from extractall                 RED (caught)
      Ran 44 tests in 0.029s | FAILED (failures=2)
      reddened: test_extractall_is_called_with_the_data_filter, test_rewritten_member_name_is_reported
```

This is exactly the mutant attempt 1's verifier could not catch (its V3 passed `Ran 41 tests ... OK`).

### Finding 4 (LOW, test pinned the insecure fallback) — **FIXED**

`tests/test_paper_collector.py:313-322` now asserts the fallback is **safe**: `escaped == []`,
`main.tex` present, `paper.ps` still a symlink, and the traversal reported. It no longer requires
the escape to be written, so an implementer who instead refuses to extract on a filterless
interpreter would not be blocked. `:324-337` adds
`test_interpreter_without_filter_blocks_every_escape_route`. Verified:

```
M1 fallback = bare extractall(dest)                     RED (caught)
      Ran 44 tests in 0.030s | FAILED (failures=1, errors=1)
      reddened: test_interpreter_without_filter_blocks_every_escape_route, test_interpreter_without_filter_still_blocks_traversal
```

Full revert (`git show HEAD:scripts/paper-collector.py` into a `/tmp` copy, tests unchanged) →
`Ran 44 tests … FAILED (errors=5)`. The tests are non-vacuous.

---

## 2. Mutation testing — 16 mutants, 15 caught

`/tmp/imp024r2/mutate.py` applies each mutant to a **fresh** `/tmp` copy of `scripts/` + `tests/`
and runs the whole suite. Baseline on the unmutated copy: `OK`, `Ran 44 tests`.

| Mutant | Result | Reddened |
| --- | --- | --- |
| M1 fallback → bare `file.extractall(dest)` | RED | both `interpreter_without_filter_*` |
| M2 `filter="data"` removed from `extractall` | RED | `…called_with_the_data_filter`, `…rewritten_member_name…` |
| M3 data pre-screen inverted (rejected kept) | RED | `…data_filter`, `…traversal_member_is_skipped…` |
| M4 sanitized-member log removed | RED | `…rewritten_member_name_is_reported` |
| M5 fallback screen weakened to `isabs`-only | RED | both `interpreter_without_filter_*` |
| M6 fallback screen drops link-target check | RED | `…blocks_every_escape_route` |
| M7 fallback screen drops special-file check | RED | `…blocks_every_escape_route` |
| M8 fallback rejects silently | RED | both `interpreter_without_filter_*` |
| M9 data path skips silently | RED | `…data_filter`, `…traversal_member_is_skipped…` |
| **M10 `is_inside` uses `startswith` not `commonpath`** | **GREEN (MISSED)** | — |
| M11 fallback logs but keeps the member | RED | both `interpreter_without_filter_*` |
| M12 `is_inside` always `True` | RED | both `interpreter_without_filter_*` |
| M13 fallback rejects everything (over-block) | RED | both `interpreter_without_filter_*` |
| M14 fallback only screens names containing `..` | RED | both `interpreter_without_filter_*` |
| M15 fallback drops all members | RED | both `interpreter_without_filter_*` |
| M16 `is_inside` allows anything except `/` | RED | both `interpreter_without_filter_*` |

M13/M15 are the anti-over-block guards: a screen that rejects everything, or one that extracts
nothing, is caught by the `main.tex` / `paper.ps` existence assertions. M10 is the only survivor —
see Issue R3.

---

## 3. Benign archives still extract correctly — no over-blocking

`/tmp/imp024r2/benign.py` builds an arXiv-shaped archive (nested `sub/`, `sub/figs/`, `sub/deep/`;
in-tree symlink `paper.ps -> main.tex`; in-tree symlink `sub/alt.tex -> sub/figs/img.png`; in-tree
**hardlink** `hard.tex -> main.tex`; a unicode directory `図/論文é.tex`) and checks every member
lands inside `dest` on both paths.

```
python 3.11.8 | data-filter path     extracted=10/10 missing=none symlink=True hardlink=True sublink=True rejects=0 sanitize=0
python 3.11.8 | forced-fallback path extracted=10/10 missing=none symlink=True hardlink=True sublink=True rejects=0 sanitize=0
python 3.8.19 | both paths           identical
python 3.14.3 | both paths           identical
```

**In-tree symlinks and hardlinks must work and do.** Neither the spec nor `readme.md` requires them,
but they are the realistic arXiv pattern (a `.ps` or alternate-format alias next to the main file),
and `data_filter` permits them, so dropping them would be a correctness regression. Directory modes
are still applied via `extractall`'s deferred pass; `02750` dirs become `0755` on the data path. The
only over-block is intentional and documented by the implementer: the fallback **rejects** an
absolute member where `data_filter` would relocate it — stricter, and invisible on real archives.

I could not reproduce the implementer's claim of testing 3 real arXiv source archives (no cached
tarballs in the repo, and I did not go to the network); my synthetic archive of the same shape is
the substitute, plus the harness's "benign + traversal mixed" case, which keeps `main.tex`,
`sub/keep.tex` and `sub/link.ps` while dropping `sub/../../pwned_mixed.txt`.

---

## 4. Suite, skips, and no test weakening

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
test_extractall_is_called_with_the_data_filter ... ok
test_interpreter_without_filter_blocks_every_escape_route ... ok
test_interpreter_without_filter_still_blocks_traversal ... ok
test_rewritten_member_name_is_reported ... ok
test_traversal_member_is_skipped_logged_and_stays_inside_dest ... ok
----------------------------------------------------------------------
Ran 44 tests in 0.032s

OK
```

- **44 tests, exit 0.** `git archive HEAD tests scripts` + run → `Ran 39 tests … OK`, so
  44 = 39 baseline + 5 new. The implementer's count is accurate.
- **No skips.** No `skipped`/`expected failure` marker appears in the -v output; `grep -ci skipped`
  returns 1, and that single hit is the substring in the test *name*
  `test_traversal_member_is_skipped_logged_and_stays_inside_dest`. `TARFILE_HAS_FILTER` evaluates
  `True` on every interpreter here, so `_skip_without_filter` (`:250-255`) never fires here.
- **No test weakened or deleted.** `git diff --numstat -- tests/` → `187 0
  tests/test_paper_collector.py`; the only `-` line in the whole tests diff is the `--- a/…` file
  header. The change is a pure append of `ExtractSourceArchiveTests` at
  `tests/test_paper_collector.py:154`.
- `/usr/local/bin/python3.11 -m compileall -q scripts tests` → exit 0.
- `/usr/local/bin/python3.11 -W error::DeprecationWarning -m unittest discover -s tests` → `Ran 44
  tests … OK`, so the fix introduces no deprecation noise on 3.11.
- `--help` is byte-identical to `HEAD` apart from argparse's `usage:` line wrapping, which differs
  only because `argv[0]` is `head_pc.py` instead of `paper-collector.py`. No flag, default, or output
  name changed. `parse_args`, `build_html_feed`, `main` and the
  `<topic>-<N>_papers_extracted_on_<stamp>.html` naming are untouched; the `with tarfile.open(...)`
  context manager moved into the helper, so `tarfile.TarError` still reaches the unchanged handler
  at `:181`.

---

## 5. CI compatibility

`.github/workflows/ci.yml:13-15` — `actions/setup-python@v5` with a **floating**
`python-version: "3.x"`, one job, no matrix. That resolves to the newest stable CPython, i.e.
**3.14.x** today. `requirements.txt` is `arxiv>=2.1.0`, `pandas>=2.0.0`; there is no
`python_requires` anywhere, so no floor is declared.

- `extractall(filter="data")` is still accepted on 3.14.3 — confirmed by execution:
  `extractall(out, members=…, filter='data')` → `explicit filter=data OK on 3.14: True`.
- All 5 new tests **run, not skip**, on 3.14.3 (CI's interpreter), and also on 3.13.0 and 3.8.19
  (`arxiv`/`pandas` stubbed via `PYTHONPATH`, since only 3.11/3.12 have the real deps here):
  ```
  3.14.3  Ran 5 tests in 0.020s  OK
  3.13.0  Ran 5 tests in 0.024s  OK
  3.8.19  Ran 5 tests in 0.021s  OK
  ```
- The 34-archive harness reports 0 escapes on all five interpreters on both paths (§1).
- `TARFILE_HAS_FILTER` (`:24-27`) remains a capability check —
  `"filter" in inspect.signature(tarfile.TarFile.extractall).parameters and hasattr(tarfile,
  "data_filter")` — no hardcoded version number, matching criterion 1.
- On 3.13 the fallback's filterless `extractall` emits CPython's `DeprecationWarning` about the
  default filter. That branch is unreachable on 3.13, so it cannot affect CI.
- 3.12.7 cannot run this repo's suite here (`ModuleNotFoundError: No module named 'arxiv'`) — but
  that is **pre-existing**: `git archive HEAD` + 3.12 gives the identical `Ran 3 tests … FAILED
  (errors=3)`. Not a regression, and CI installs `requirements.txt`.

Reachability of the fallback is unchanged from attempt 1: the filters were backported to
3.8.17 / 3.9.17 / 3.10.12 / 3.11.4, so the branch is reachable only on EOL or unpatched
interpreters. What changed is that it is now safe when reached.

---

## 6. Remaining issues

### R1 — the fallback does not strip or log privileged mode bits (MEDIUM, non-blocking)
`scripts/paper-collector.py:43-67`. `rejection_reason()` never inspects `member.mode`, so on the
fallback branch setuid/setgid/sticky survive onto disk. Measured on 3.11.8, 3.8.19, 3.12.7, 3.13.0
(forced fallback), identical:

```
HIGH BITS PRESERVED: sandbox/extracted/A Paper/suid=0o4755, sdir=0o2755, sgid=0o2755, twd=0o1777, sticky=0o1777
```

and **nothing is logged for them** — the only reason `Sanitized member` exists (`:116-121`) is on
the `TARFILE_HAS_FILTER` branch. So the item's Notes requirement to "log every rejection" is met,
but the fallback is still less strict than `data_filter` in one respect: it lets a `04755` file
through where `data_filter` yields `0755` **and** logs it.

Why it is not blocking: the branch is unreachable on every patched CPython ≥3.8.17 and in CI; the
extracted file is owned by the user running the tool, so a preserved setuid bit grants no privilege;
and there is no traversal or write-outside-`dest` consequence. It is a hardening/consistency gap,
not an escape. **Fix (3 lines):** in the fallback loop, log and neutralise when
`member.mode is not None and member.mode & 0o7000` —
`logging.warning("Sanitized member %r in %s: mode %s -> %s", member.name, archive_path,
mode_str(member.mode), mode_str(member.mode & 0o755))` and pass
`member.replace(mode=member.mode & 0o755, deep=False)` to `extractall` so the stripped mode is the
one written. Note the shipped `safe_members` list is passed to a filterless `extractall`, so it must
carry the *replacement* `TarInfo`, not the original.

### R2 — the new tests' escape detection is scoped to `self.base` (LOW, test soundness)
`tests/test_paper_collector.py:230-236` builds `escaped` from `_files_under_base()`, an
`os.walk(self.base)`. But `_write_attack_archive` includes the member `../../../pwned_deep.txt`
(`:195`), which from `dest = base/extracted/A Paper Title` resolves to **`$TMPDIR/pwned_deep.txt`,
outside `self.base`** — so an escape there is invisible to `_files_outside`. I proved this is a real
blind spot: mutant **M16** (`is_inside` → `commonpath(...) != '/'`) is still caught (by the log
assertion at `:334`, which requires `pwned_deep.txt` to be reported), but it actually wrote
`/var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/pwned_deep.txt` into `$TMPDIR`. (I removed that
file.) This contradicts `.improve/reports/impl-IMP-024.md:126` ("All escape targets live inside the
test's own `tempfile` sandbox, so even a reverting mutant cannot litter `/tmp`"). **Fix:** either
target a sentinel inside `self.base` (`../pwned_deep.txt` plus a dedicated
`self.sentinel/"pwned_deep.txt"` member), or snapshot `$TMPDIR` around the extraction, or add
`../../../pwned_deep.txt` to a second assertion that checks the file does not exist at the absolute
`$TMPDIR` path.

### R3 — the docstring's `commonpath`-not-`startswith` claim is unpinned (LOW, coverage)
`rejection_reason`'s docstring (`scripts/paper-collector.py:46-50`) and the implementer's design
note both claim `commonpath` prevents `/…/Paper` matching `/…/Paper-evil`, but mutant **M10** passes
the whole suite (`Ran 44 tests … OK`). The shipped code is correct — I confirmed it rejects
`../A Paper Title-evil/sibling_evil.txt` on both paths — so this is a coverage gap, not a live hole.
**Fix:** add the sibling-prefix member to `_write_attack_archive` and assert on it.

### R4 — pre-existing, unchanged (INFO, not attributable to IMP-024)
1. A dangling **in-tree** hardlink (`alt.tex` → `nope.tex`, which `data_filter` correctly allows)
   raises `KeyError` from `TarFile._find_link_target`, which is not in `fetch_papers`' except tuple
   (`scripts/paper-collector.py:181`) and aborts the run for all remaining papers. Identical before
   and after this change. It now also applies to a hardlink whose target the screen rejected.
2. `getmembers()` (`:85`, `:101`) materialises the member index; pre-fix `extractall(members=None)`
   iterated lazily. Irrelevant at arXiv archive sizes.
3. `readme.md` still does not mention that unsafe members are now skipped. `readme.md` was outside
   the implementer's allowed paths.
4. `ci.yml:15` still floats `python-version: "3.x"` (PE-10). Outside scope.

---

## 7. Bottom line

Attempt 1's blocking finding is genuinely closed. The fallback branch is no longer a control that
merely complains — it is a real containment screen, and I attacked it with the same 21-way battery
that broke it before, plus 13 more cases, on all five interpreters available here, on both code
paths: **0 escapes in 340 runs**. A `warnings.warn` is not used anywhere as a substitute for a
control. Every rejected member on either path is logged with name, archive and reason; the two
classes attempt 1 found silent (absolute paths, privileged bits) are now reported on the data path
and, for absolute paths, on the fallback too. The `filter="data"` call is now pinned by a test that
fails when the argument is removed, and the fallback tests assert safety rather than pinning the
insecure behaviour. 15 of 16 mutants are caught, including the anti-over-block direction. The
benign-archive check confirms nested directories, in-tree symlinks and in-tree hardlinks still
extract intact on both paths — no correctness regression. CI runs one floating `3.x` (3.14.3);
the fix is verified safe there and on 3.8.19 / 3.12.7 / 3.13.0.

Recommended disposition: **accept**. Fold R1 (mode-bit stripping on the fallback) into a follow-up
item; R2 and R3 are cheap test-hygiene additions to the same file.

---

## 8. Commands run

```
git status --porcelain ; git diff -- scripts/ tests/ ; git diff --numstat -- scripts/ tests/
git show HEAD:scripts/paper-collector.py
git archive HEAD tests scripts | tar -x -C /tmp/imp024r2/base   # HEAD baseline = 39 tests
cat -n .github/workflows/ci.yml ; cat requirements.txt
for py in 3.8 3.11 3.12 3.13 3.14: $py -c "inspect.signature(tarfile.TarFile.extractall) …"
/usr/local/bin/python3.11 -m unittest discover -s tests -v                     # Ran 44 … OK
/usr/local/bin/python3.11 -m compileall -q scripts tests                        # exit 0
/usr/local/bin/python3.11 -W error::DeprecationWarning -m unittest discover -s tests
/opt/homebrew/bin/python3.12 -m unittest discover -s tests                      # pre-existing ImportError
PYTHONPATH=/tmp/imp024r2/stubs {3.8,3.13,3.14} -m unittest tests.test_paper_collector.ExtractSourceArchiveTests -v
python3.11 harness.py            /  FORCE_FALLBACK=1 python3.11 harness.py     # 34 archives
{3.8,3.12,3.13,3.14} harness.py  /  FORCE_FALLBACK=1 {…} harness.py            # 0 escapes everywhere
{3.11,3.8,3.14} benign.py                                                       # 10/10 both paths
python3.11 sibling.py                                                           # commonpath vs startswith
python3.11 mutate.py                                                            # 16 mutants, 15 caught
full revert of scripts/paper-collector.py from HEAD into /tmp                  # FAILED (errors=5)
diff <(head_pc.py --help) <(paper-collector.py --help)
```

Scratch artifacts, all outside the repo: `/tmp/imp024r2/{harness,benign,sibling,mutate}.py`,
`/tmp/imp024r2/stubs/`. Sandboxes are `tempfile.mkdtemp` and are removed per case. The one leaked
`$TMPDIR/pwned_deep.txt` from mutant M16 was deleted. **The only file I created in the repo is this
report.**