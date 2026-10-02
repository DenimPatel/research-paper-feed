# Verification report — IMP-024 (`filter="data"` for `tarfile.extractall`)

Verifier: independent sub-agent. **No source file was modified.** No git write command was run.
Scope: `git diff -- scripts/ tests/` + untracked files under those dirs only. `web/` ignored (IMP-143).

**Verdict: FAIL** — driven by one narrow but real security gap (the fallback branch is fully
permissive). All 3 acceptance criteria are literally met, and the *primary* filtered code path is
airtight (0 escapes in 110 attack runs). The failure is that the CVE-2007-4559 primitive is left
fully intact on a code path the implementer chose not to harden, when hardening costs ~8 lines.

---

## 1. Acceptance criteria

| # | Criterion | Met? | Evidence |
| --- | --- | --- | --- |
| 1 | `extractall` called with `filter="data"` wherever the signature accepts it; capability check via `inspect.signature`, not a version number; explicit fallback that **logs a warning naming the missing-filter condition** | **Yes (literally)** | `scripts/paper-collector.py:24-27` uses `"filter" in inspect.signature(tarfile.TarFile.extractall).parameters and hasattr(tarfile, "data_filter")` — a capability check, no hardcoded version. `:62` `file.extractall(dest, members=safe_members, filter="data")`. Fallback at `:38-47` logs a warning naming the missing filter. **But the fallback is a bare `file.extractall(dest)` — see Issue 1.** |
| 2 | Test builds a synthetic tarball in a `tempfile` dir with a `../escape.txt` member, extracts through the real path, asserts (a) no file outside the extraction dir and (b) the member is reported as skipped; skip-with-reason (not fail) where `filter` is absent; must RUN on `/usr/local/bin/python3.11` | **Yes** | `tests/test_paper_collector.py:154-236`. `setUp` chdirs into `tempfile.mkdtemp()` (`:161`); `_write_archive` (`:174`) builds in memory via `w:gz` + `addfile(TarInfo, BytesIO)`. Assertions at `:214` (`assertEqual(escaped, [], "a member escaped the extraction directory")`) and `:220` (WARNING naming `escape.txt`). `skipTest` with reason at `:196-200`. **Ran, not skipped, on 3.11.8** (see §3). Skip branch proven separately (§3c). |
| 3 | `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes on 3.11 | **Yes** | `Ran 41 tests ... OK`, exit 0. Baseline 39 + 2 new. |

**3/3 criteria met.** The FAIL is on the security bar, not the checklist.

---

## 2. Security analysis of the fix

### 2a. Is the pre-screening logic correct, or does it screen-then-extract-unfiltered?

**Correct. No gap.** I read `tarfile._get_extract_tarinfo` on the provisioned interpreter
(`/Library/Frameworks/Python.framework/Versions/3.11/lib/python3.11/tarfile.py`) to settle the
critical question — is the `path` argument the pre-screen passes the *same* value `extractall`
passes to the filter at extraction time?

```python
def _get_extract_tarinfo(self, member, filter_function, path):
    ...
    tarinfo = filter_function(tarinfo, path)     # <-- the DESTINATION ROOT, not the member path
```

`extractall` → `_get_extract_tarinfo(member, filter_function, path)` → `filter_function(tarinfo, path)`.
The pre-screen at `scripts/paper-collector.py:55` calls `tarfile.data_filter(member, dest)`.
**Identical arguments ⇒ the two screens agree exactly.** The implementer's reasoning is correct.

Also verified: `tarfile.data_filter` returns `member.replace(**new_attrs, deep=False)` — a **new**
`TarInfo`. The pre-screen discards the return value, so the original member is *not* mutated and the
extract-time filter re-derives the identical verdict. No TOCTOU, no double-mutation.

**The pre-screen passes only `safe_members` to `extractall` (`:62`) — not the full member list.**
The "screen but extract unfiltered" bug the review brief warned about is *not* present.

### 2b. Is every unsafe member type blocked? (22 attack classes × 5 interpreters = 110 runs)

Harness: `/tmp/imp024/adversarial.py`, driving the **real** `paper-collector.extract_source_archive`
(third-party `arxiv`/`pandas`/`arxiv_common` stubbed into `sys.modules` so the actual repo module
loads on every interpreter; the repo was never touched).

Interprobes: `3.8.19 (homebrew)`, `3.11.8 (/usr/local/bin/python3.11, provisioned)`,
`3.12.7`, `3.13.0`, `3.14.3` — all report `extractall params: [self, path, members, numeric_owner, filter]`
and `has data_filter: True`, i.e. `TARFILE_HAS_FILTER == True` on all five.

| # | Attack | Result on all 5 interpreters |
| --- | --- | --- |
| 1 | member `../escape.txt` | blocked, logged |
| 2 | member `/tmp/imp024/pwned_abs.txt` (absolute) | **rewritten** to `<dest>/tmp/imp024/pwned_abs.txt`; no escape; **no log** |
| 3 | member `/etc/pwned_abs` | rewritten into dest; no escape; **no log** |
| 4 | symlink → `/tmp/imp024/pwned_sym` (absolute) | rejected `AbsoluteLinkError` |
| 5 | symlink → `../../../../tmp/imp024/pwned_rel` | rejected `LinkOutsideDestinationError` |
| 6 | `../../../../../../tmp/imp024/pwned_deep` | rejected |
| 7 | char device (`/dev/null`) | rejected `SpecialFileError` |
| 8 | block device | rejected `SpecialFileError` |
| 9 | FIFO | rejected `SpecialFileError` |
| 10 | hardlink → `/etc/passwd` | rejected `AbsoluteLinkError` |
| 11 | hardlink → `../../../../etc/passwd` | rejected |
| 12 | symlink-dir → `/tmp/imp024` then write through it | rejected; nothing written outside |
| 13 | symlink-dir → `../../..` then write through it | rejected |
| 14 | symlink chain `a→b`, `b→/tmp/imp024`, then `a/pwned` | no escape; `FileExistsError` (see §7) |
| 15 | `sub/../../escape_embedded` | rejected |
| 16 | `..//escape_slashes` | rejected |
| 17 | unicode traversal name `../../imp024/../pwned_unicode_é中文` | rejected |
| 18 | backslash traversal `..\..\pwned_bs` | blocked (not a separator on POSIX) |
| 19 | benign nested dirs + one `../../pwned_mixed` | nested files extracted, traversal rejected |
| 20 | absolute **directory** member `/tmp/imp024/absdir/` | rewritten into dest; no escape |
| 21 | member named exactly `..` | rejected |
| 22 | symlink `up→..` then `up/../../pwned_after_sym` | no escape |

**`TOTAL LEAKS: 0` on 3.11.8, 3.12.7, 3.13.0, 3.14.3, 3.8.19.** Sentinel scan covered
`/tmp/imp024`, `/tmp`, the repo root, and the repo's parent; `/etc/pwned_abs` was never created.

**Setuid / setgid / sticky bits** (`/tmp/imp024/modes.py`, all 5 interpreters, identical results):
`4755→0755`, `4155→0755`, `2755→0755`, `1777→0755`, `6000→0600`, `0666→0644`, `0400→0600`,
`02750` dir → `0755`. All high bits stripped.

**Absolute paths are rewritten, not rejected** — that is the `data` filter's documented behaviour
(`_get_filtered_attrs`: `name = member.path.lstrip('/' + os.sep)`). Safe, but see Issue 2.

### 2c. The fallback path is NOT safe. **This is the FAIL.**

`FORCE_FALLBACK=1` (monkeypatching `TARFILE_HAS_FILTER = False` so the real fallback branch runs):

```
1 ../escape.txt            outside=['.../extracted/escape.txt']            <-- ESCAPED dest
2 absolute /tmp/imp024/...                                            LEAK!! /tmp/imp024/pwned_abs.txt
12 symlink dir -> /tmp/imp024, write through it                       LEAK!! /tmp/imp024/pwned_thru_sym
13 symlink dir -> ../../.., write through it                         LEAK!! /tmp/imp024/pwned_thru_rel
14 symlink chain a->b, b->/tmp/imp024                                 LEAK!! /tmp/imp024/pwned_chain
16 name with leading ..//          outside=['extracted/escape_slashes']
19 benign nested + traversal       outside=['pwned_mixed']             <-- at sandbox root
TOTAL LEAKS: 21
```

Identical on 3.11.8 and 3.8.19. `scripts/paper-collector.py:46` — `file.extractall(dest)` — is
precisely the CVE-2007-4559 primitive the item exists to remove. The warning is loud but the
exploit works. **A warning does not close a CVE.**

### 2d. Does it still log rejections usefully?

Mostly yes. Exact `WARNING` lines captured (`/tmp/imp024/final.py`), 7 of 9 attack classes:

```
WARNING:root:Skipped unsafe member '../escape.txt' in <arc>: '../escape.txt' would be extracted to
  '<...>/extracted/escape.txt', which is outside the destination
WARNING:root:Skipped unsafe member 'link' in <arc>: 'link' is a link to an absolute path
WARNING:root:Skipped unsafe member 'hl'  in <arc>: 'hl' is a link to an absolute path
WARNING:root:Skipped unsafe member 'rl'  in <arc>: 'rl' would link to '<...>/etc/passwd', which is outside the destination
WARNING:root:Skipped unsafe member 'dev' in <arc>: 'dev' is a special file
WARNING:root:Skipped unsafe member 'fifo' in <arc>: 'fifo' is a special file
WARNING:root:Skipped unsafe member 'blk' in <arc>: 'blk' is a special file
```

Member name, archive path, **and** the stdlib's own reason string. Genuinely useful.
**Two classes log nothing at all** — see Issue 2.

---

## 3. Python-version compatibility (independent determination)

**What CI runs:** `.github/workflows/ci.yml:13-15` — `actions/setup-python@v5` with
`python-version: "3.x"`, a **floating** spec. That resolves to the newest stable CPython
(3.14.3 today). Single Python, no matrix (profile PE-10). So the *oldest* Python CI runs is 3.14.x.

**Independently measured capability on every interpreter present on this machine:**

| Interpreter | `filter` in `extractall` | `tarfile.data_filter` | `TARFILE_HAS_FILTER` |
| --- | --- | --- | --- |
| `/opt/homebrew/bin/python3.8` (3.8.19) | yes | yes | **True** |
| `/usr/local/bin/python3.11` (3.11.8, provisioned) | yes | yes | **True** |
| `/opt/homebrew/bin/python3.12` (3.12.7) | yes | yes | True |
| `/opt/homebrew/bin/python3.13` (3.13.0) | yes | yes | True |
| `/opt/homebrew/bin/python3.14` (3.14.3, CI's `3.x`) | yes | yes | True |

**Oldest CI Python (3.14):** `extractall(filter=...)` is available *and* is the default — safe.
**Provisioned 3.11.8:** has the 3.11.4 backport — safe, verified by execution, not from memory.

**Reachability of the fallback.** The filters were backported to 3.8.17 / 3.9.17 / 3.10.12 / 3.11.4
(all Sept–Oct 2023). Python 3.7 and earlier went EOL June 2023, and `requirements.txt` declares no
`python_requires`. So the fallback is reachable only on EOL or unpatched 3.8.0–3.8.16 / 3.9.0–3.9.16 /
3.10.0–3.10.11 / 3.11.0–3.11.3. **Unreachable in CI and on the provisioned interpreter** — the
implementer's reachability analysis is correct. It is nonetheless a shipped, live, exploitable
function body, which is why it is Issue 1.

### The design decision is validated — and it was necessary

`/tmp/imp024/errorlevel.py`, 3.11.8 / 3.13.0 / 3.14.3. Archive = `benign1.tex, ok.tex,
../escape.txt, benign2.tex`:

| Strategy | 3.11.8 | 3.13.0 | 3.14.3 |
| --- | --- | --- | --- |
| S1 `extractall(dest, filter="data")` (the literal one-liner) | raises `OutsideDestinationError`, **`benign2.tex` LOST** | same | same |
| S2 `errorlevel = 0` + `filter="data"` (the "obvious workaround") | **ESCAPED=TRUE** | **ESCAPED=TRUE** | skipped |
| **S3 SHIPPED: pre-screen + `extractall(members=safe, filter="data")`** | no escape, all 3 benign kept, no raise | same | same |

`TarFile.errorlevel` defaults to `1` for read-mode archives, and `_handle_fatal_error` re-raises when
`errorlevel > 0`. With `errorlevel = 0` it swallows the `FilterError` **and leaves `tarinfo` pointing
at the unfiltered member**, so the escape file is written anyway. Both of the implementer's
counter-intuitive claims are **independently reproduced and correct**. The naive one-liner named in
criterion 1 would have caused silent data loss on legitimate archives; the pre-screen is the right
call. This is genuinely good engineering, and it is why criterion 1 is met.

---

## 4. Suite results (exact)

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
test_interpreter_without_filter_warns_and_still_extracts (test_paper_collector.ExtractSourceArchiveTests...) ... ok
test_traversal_member_is_skipped_logged_and_stays_inside_dest (test_paper_collector.ExtractSourceArchiveTests...) ... ok
...
Ran 41 tests in 0.024s
OK
```

Baseline was 39; 41 = 39 + 2 new. No pre-existing test regressed. Exit 0.
`/usr/local/bin/python3.11 -m compileall -q scripts tests` → exit 0.

**The traversal test RAN, it did not skip** — no `skipped` marker on either new test, and
`TARFILE_HAS_FILTER` evaluates `True` on 3.11.8.

---

## 5. Non-vacuity — would the tests fail if the fix were reverted?

The repo was never modified. `scripts/` and `tests/` were copied to `/tmp/imp024/revert` and
`git show HEAD:scripts/paper-collector.py` was used to restore the pre-fix module there.

**V1 — full revert** (module identical to HEAD, tests unchanged):
```
Ran 41 tests ... FAILED (errors=2)
AttributeError: module 'paper_collector' has no attribute 'TARFILE_HAS_FILTER'   (both new tests)
```
Fails, but only on the new attribute — a weak signal. So I mutation-tested the assertions themselves.

**V2 — API kept, body reverted to pre-fix `file.extractall(dest)`** (the real non-vacuity test):
```
FAIL: test_traversal_member_is_skipped_logged_and_stays_inside_dest
self.assertEqual(escaped, [], "a member escaped the extraction directory")
AssertionError: Lists differ: ['/var/.../extracted/escape.txt'] != []
Ran 41 tests ... FAILED (failures=1)
```
**The test has teeth: it detects the actual escape, not merely a missing log line.** The implementer's
claim is confirmed.

**V3 — pre-screen kept, `filter="data"` REMOVED from the `extractall` call:**
```
Ran 41 tests ... OK
```
**The suite does not pin criterion 1.** See Issue 3.

**V4 — pre-screen inverted (unsafe members kept):**
```
ERROR: test_traversal_member_is_skipped_logged_and_stays_inside_dest
Ran 41 tests ... FAILED (errors=1)
```
Caught.

**V5 — skip branch** (`TARFILE_HAS_FILTER = False`, tests forced to load the stubbed module):
```
test_traversal_member_is_skipped_logged_and_stays_inside_dest ... skipped
  'tarfile extraction filters need Python 3.8.17+/3.9.17+/3.10.12+/3.11.4+, running 3.11.8'
Ran 2 tests ... OK (skipped=1)
```
`skipTest` with a reason, not an error. Criterion 2's skip requirement met.

---

## 6. Try to break it — adversarial extraction, incl. normal-extraction regression

All 22 cases in §2b are listed there. Additional targeted results:

**NUL-byte name.** A PAX-format tarball with member `../../pwned\x00NUL`: tarfile's PAX parser
truncates the name at the NUL to `../../pwned`, which `data_filter` then **rejects with a
`FilterError` (logged)**. `anything created outside dest? []`. No escape, no uncaught exception.

**Unicode name in-tree** (`図/論文é.tex`): extracted correctly. No over-blocking.

**Corrupt/truncated archive:** `tarfile.ReadError` — a `TarError` subclass, still caught by
`fetch_papers`. No regression.

**NORMAL EXTRACTION NOT BROKEN.** Benign archive with nested directories, run through the shipped
helper on 3.11.8:
```
INSIDE : main.tex, refs.bib, paper.ps (in-tree symlink),
         sub/, sub/figs/, sub/figs/img.png, sub/figs/plot.pdf, sub/deep/, sub/deep/a.sty
OUTSIDE: []
```
All 9 members present, deep nesting intact, directory modes applied (dirs are still collected and
re-`chmod`ed in `extractall`'s deferred pass — verified `02750` → `0755`).
**In-tree hardlinks survive** — the realistic arXiv pattern:
`hardlink alt.tex -> main.tex` → both extracted. `hardlink sub2/alt.tex -> sub/main.tex` → all 4 extracted.
The fix does not over-block.

---

## 7. No regression to the documented CLI

`--help` diffed against HEAD's module (the only difference is `argv[0]`, i.e. the filename):
```
$ diff <(python3.11 /tmp/imp024/head_pc.py --help) <(python3.11 scripts/paper-collector.py --help)
1,3c1,3
< usage: head_pc.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
---
> usage: paper-collector.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
```
All flags, defaults, and help text byte-identical: `--topic`, `--max-papers` (1000),
`--output-dir` (results), `--download-pdfs`, `--download-sources`, `--save-csv`.
`readme.md:96-104`'s flag table matches `--help` exactly. `git diff --stat` shows the change is
confined to `+42 / -2` in `scripts/paper-collector.py`: `+import inspect`, the `TARFILE_HAS_FILTER`
constant, the `extract_source_archive` helper, and the 4-line call-site swap at `:114-119`.
`parse_args`, `build_html_feed`, `main`, and the `<topic>-<N>_papers_extracted_on_<stamp>.html`
naming are untouched.

The `with tarfile.open(...)` context manager moved *into* the helper, so `tarfile.TarError` still
propagates to the unchanged `except (arxiv.ArxivError, OSError, tarfile.TarError)` at `:121`.

`.improve/FEATURES.md` shows as modified in `git status`, but the diff is only the loop harness
flipping `### IMP-024` and `### IMP-143` from `TODO` to `IN-PROGRESS` — **not** an implementer edit.

---

## 8. Issues

### Issue 1 — the fallback branch is a fully permissive extraction (SECURITY; the reason for FAIL)
`scripts/paper-collector.py:38-47`. `file.extractall(dest)` with no filter. Measured **21 escape
routes** (§2c), including `../escape.txt` landing outside the destination, an absolute member
written to `/tmp/imp024/pwned_abs.txt`, and writes through a symlinked directory landing in
`/tmp/imp024/`. The warning at `:39-45` documents the hole rather than closing it.

Unreachable on any patched CPython ≥3.8.17 and in CI — but it is live, shipped, and the CVE this item
exists to close. **Actionable fix, ~8 lines, no new dependency, works on every Python:**
keep `getmembers()`, screen with a hand-rolled containment check that does not need `data_filter`
(`os.path.isabs(name)` / `normpath(name).startswith("..")` for paths, and
`realpath(join(dest, dirname(name), linkname))` + `commonpath(...)` for links), `continue` on failure
with the same `logging.warning`, and pass only survivors to `extractall(dest, members=safe)`.
The second option — refusing to extract and logging an error — also satisfies the item and is
strictly safer, at the cost of `--download-sources` doing nothing on those interpreters.

### Issue 2 — two rejection classes are silent (MEDIUM)
`scripts/paper-collector.py:55-61`. `data_filter` returns a *rewritten* `TarInfo` rather than
raising for two cases, and the pre-screen discards the return value, so **nothing is logged**:
- **absolute paths** — `/etc/pwned` is silently relocated to `<dest>/etc/pwned` (verified: no log
  line; the file appears inside the destination).
- **privileged mode bits** — `04755` silently becomes `0755` (verified: no log line).

Both are *safe*, but the item's Notes explicitly require: *"log every rejection so a user can see
what was skipped."* A user whose archive silently relocated or silently stripped a member has no
signal. **Fix:** keep the return value and log at INFO/DEBUG when
`filtered.name != member.name` or `filtered.mode != member.mode`.

### Issue 3 — the tests do not pin criterion 1 (LOW)
Mutant **V3** (drop `filter="data"` from the `extractall` call, keep the pre-screen) passes the
whole suite: `Ran 41 tests ... OK`. The pre-screen happens to make that mutant safe today, so this
is a coverage gap rather than a live hole — but nothing would catch a regression that removes the
`filter=` argument the criterion names. **Fix:** assert on the call, e.g. wrap
`tarfile.TarFile.extractall` in the test and assert `kwargs["filter"] == "data"`.

### Issue 4 — `test_interpreter_without_filter_warns_and_still_extracts` pins the *insecure* fallback (LOW)
`tests/test_paper_collector.py:222-236` forces `TARFILE_HAS_FILTER = False` and asserts the benign
member **is** extracted. Anyone who fixes Issue 1 by refusing to extract on a filterless interpreter
will turn this test red. Combine with Issue 1: invert the assertion to require the traversal member
to be blocked, whatever the interpreter.

### Issue 5 — the pre-screen catches only `tarfile.FilterError` (INFO)
`scripts/paper-collector.py:56`. `data_filter` can raise `ValueError: embedded null byte` from
`os.path.realpath` on a `TarInfo` whose `name` contains NUL, which the handler would not catch, and
which `fetch_papers`' `except (…, OSError, …)` would also not catch. **Not reachable through a real
archive** — tarfile's header/PAX parsers truncate names at NUL before `data_filter` sees them
(verified), so this is defence-in-depth only. Widening to `except (tarfile.FilterError, ValueError)`
costs nothing.

### Issue 6 — a hostile archive can abort one paper's extraction with an uncaught `KeyError` (PRE-EXISTING, not a regression)
A dangling **in-tree** hardlink (`alt.tex` → `nope.tex`, which `data_filter` correctly *allows*)
raises `KeyError: "linkname 'nope.tex' not found"` from `TarFile._find_link_target`. That is not in
`fetch_papers`' except tuple at `:121`, so it escapes and aborts the run for all remaining papers.
Verified **identical before and after** the fix:
```
PRE-FIX  extractall(dest)        -> KeyError: "linkname 'nope.tex' not found"
POST-FIX extract_source_archive  -> KeyError: "linkname 'nope.tex' not found"
```
Pre-existing, correctly not attributed to IMP-024. Worth a follow-up item.
Similarly, `FileExistsError` from a symlink-then-write-through archive (attack 14) aborts the
remainder of that one archive — but `FileExistsError` **is** an `OSError`, so it is caught and logged
per paper, and no escape occurs.

### Issue 7 — `getmembers()` loads the whole index (INFO)
`scripts/paper-collector.py:53`. Pre-fix, `extractall()` with `members=None` iterated the `TarFile`
lazily. Now the full member list is materialised. For real arXiv source tarballs (largest observed
by the implementer: 1.15 MB) this is irrelevant. No action needed.

### Issue 8 — test fixture cosmetic (INFO)
`tests/test_paper_collector.py:177`: payload is `b"\\documentclass{article}\n"`, so the fixture file
literally begins with a backslash. Harmless (the test only checks existence), but `b"\documentclass..."`
was intended.

---

## 9. Bottom line

The engineering here is **better than the acceptance criteria asked for**: the implementer
independently discovered that the literal one-liner in criterion 1 causes silent data loss on
legitimate archives, and that the obvious workaround (`errorlevel = 0`) re-opens the CVE on every
Python before 3.14 — proved both by execution, on 4 interpreters, before choosing the design. I
reproduced both claims independently and they hold. The pre-screen provably passes the *same*
arguments to the filter that `extractall` will (`_get_extract_tarinfo` → `filter_function(tarinfo, path)`),
so it cannot disagree with the extract-time screen.

Against that: **the CVE is not actually closed**, because `scripts/paper-collector.py:46` still ships
a bare `file.extractall(dest)` that I broke 21 different ways. "Logs a loud warning" is not a
security control. Two further gaps are worth fixing in the same pass: silent rewriting of
absolute-path and setuid members (Issue 2, explicitly required by the item's Notes), and the missing
assertion on `filter="data"` (Issue 3).

**Recommended disposition:** request changes. Fix Issue 1 (mandatory), Issues 2 and 3 (cheap, both
traceable to explicit text in the item). Issues 4–8 are follow-ups.

---

## 10. Commands run

```
git status --porcelain ; git diff -- scripts/ tests/ ; git show HEAD:scripts/paper-collector.py
cat -n .github/workflows/ci.yml                                  # floating python-version: "3.x"
/usr/local/bin/python3.11 -VV                                    # 3.11.8
for py in 3.8 3.11 3.12 3.13 3.14: $py -c "inspect.signature(tarfile.TarFile.extractall) ..."
/usr/local/bin/python3.11 -m unittest discover -s tests -v        # Ran 41 tests ... OK
/usr/local/bin/python3.11 -m compileall -q scripts tests           # exit 0
python3.11 /tmp/imp024/adversarial.py       # 22 cases x 5 interpreters, TOTAL LEAKS: 0
FORCE_FALLBACK=1 python3.11 /tmp/imp024/adversarial.py            # TOTAL LEAKS: 21
python3.11 /tmp/imp024/precise.py           # benign nested + absolute rewrite + hardlinks
python3.11 /tmp/imp024/modes.py             # setuid/setgid/sticky stripping, 5 interpreters
python3.11 /tmp/imp024/errorlevel.py        # S1/S2/S3 strategy comparison, 3 interpreters
python3.11 /tmp/imp024/mutate.py            # V2/V3/V4 mutation tests
python3.11 /tmp/imp024/edge.py              # dangling hardlink, unicode, NUL, corrupt
python3.11 /tmp/imp024/final.py             # pre-existing KeyError, exception coverage, log lines
python3.11 /tmp/imp024/skipcheck.py         # NUL truncation + skipTest branch
diff <(head_pc.py --help) <(paper-collector.py --help)
```

Scratch artifacts, all outside the repo: `/tmp/imp024/` (harnesses), `/tmp/imp024/revert/`,
`/tmp/imp024/mut/`, `/tmp/imp024/head_pc.py`. Sentinels removed. `git status --porcelain` after
verification shows only the two in-scope modifications plus the concurrent agent's `web/` files and
the harness's `.improve/` reports — **this report is the only file I created in the repo.**
