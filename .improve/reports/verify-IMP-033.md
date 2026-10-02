# IMP-033 — Independent verification: upper bound on `arxiv` in `requirements.txt`

**Verdict: PASS.** 3/3 acceptance criteria met. No blocking defect found.

**Verifier:** independent sub-agent, did not author the change. **Date:** 2026-10-02.
**Read-only:** no source file modified; no `git add`/`commit`/`push`. Only this report and
venvs under `/tmp` were written. `.kilo/worktrees/mildly-income` was never read.

---

## 0. The change under review

`requirements.txt` (only tracked file this agent owns; `git diff HEAD --name-only`):

```
.github/workflows/ci.yml     <- another agent's IMP-026 (ignored per instructions)
.improve/FEATURES.md         <- IMP-033 status TODO -> IN-PROGRESS
requirements.txt             <- the change
```

`requirements.txt:1-13` is now a 12-line comment block plus `arxiv>=2.1.0,<4`.
`requirements.txt:14` is `pandas>=2.0.0`, **byte-identical** to HEAD (verified with
`xxd`: both `7061 6e64 6173 3e3d 322e 302e 300a`). No lockfile added — `git ls-files`
matches only `web/package-lock.json` (pre-existing, JS side, unrelated). No other
dependency changed. **Scope is clean.**

---

## 1. The bound: neither too loose nor too tight

### 1a. Too loose? No — 4.x is genuinely excluded, enforced by pip

Run in a clean venv against the committed file:

```
$ /tmp/verify-imp033-clean/bin/python -m pip install --dry-run --constraint requirements.txt "arxiv==4.0.1"
ERROR: ResolutionImpossible: for help visit https://pip.pypa.io/en/latest/topics/dependency-resolution/#dealing-with-dependency-conflicts

$ ... "arxiv==4.0.0"
ERROR: ResolutionImpossible: ...

$ ... "arxiv==3.0.0"
Requirement already satisfied: ...
```

The implementer's `ResolutionImpossible` claim for 4.0.1 is **reproduced independently**,
and 4.0.0 is excluded too. `<4` is enforced, not decorative.

### 1b. Too tight? No — 2.1.0 is a genuinely correct floor, and it is live-verified

Enumerated the full API surface the code touches and measured it on isolated installs of
**2.1.0** (the floor), **3.0.0** (what resolves), and **4.0.1**:

| Symbol the code uses | source | 2.1.0 | 3.0.0 | 4.0.1 |
| --- | --- | --- | --- | --- |
| `Client(page_size, delay_seconds, num_retries)` | `arxiv_common.py:22-26` | yes | yes | yes |
| `Client.results(search, offset)` | `arxiv_common.py:66` | yes | yes | yes |
| `Search(query, max_results, sort_by, sort_order)` | `arxiv_common.py:54-62` | yes | yes | yes |
| `SortCriterion.SubmittedDate` | `arxiv_common.py:60` | yes | yes | yes |
| `SortOrder.Descending` | `arxiv_common.py:61` | yes | yes | yes |
| `ArxivError` | `arxiv_common.py:71`, `build_index.py:260` | yes | yes | yes |
| `Result.{entry_id,title,authors,summary,published,updated,categories,primary_category,pdf_url}` | `build_index.py:104-121` | yes | yes | yes |
| `Result.download_pdf` | `paper-collector.py:239` | yes | yes | **NO** |
| `Result.download_source` | `paper-collector.py:241` | yes | yes | **NO** |

The `Result` row was checked on a **real constructed `arxiv.Result`** with a real
`arxiv.Result.Link(title="pdf")`, not via `hasattr` on the class — `pdf_url` is an
*instance* attribute assigned in `__init__` (`arxiv/__init__.py:128`), so a class-level
`hasattr` check is meaningless for it. Real values read back on all three versions:

```
entry_id  'http://arxiv.org/abs/2610.02210v1'      published  '2026-10-01T00:00:00Z'
title     'A Title'                                 updated    '2026-10-01T00:00:00Z'
authors   ['Alice', 'Bob']                          categories ['cs.CV', 'cs.LG']
summary   'An abstract.'                            primary_category 'cs.CV'
pdf_url   'http://arxiv.org/pdf/2610.02210v1'
```

`build_index.record_from_result` produced the **same 11 keys** on 2.1.0, 3.0.0 and 4.0.1
(`absUrl, abstract, abstractTruncated, authors, categories, id, pdfUrl, primaryCategory,
published, title, updated`), so the hand-mirrored Python→TS wire contract
(`web/src/lib/types.ts`) is not disturbed by the version move.

**The minimum arxiv version supporting the deploy path is 2.1.0 — the floor is exactly
right, not too low.** The deploy path was also run *live* (network) on both the floor and
the resolved version:

```
# arxiv 2.1.0
INFO:root:Querying cat:cs.CV (limit 3) ...
INFO:arxiv:Got first page: 3 of 207907 total results
INFO:root:  3 papers within retention window for cs.CV
INFO:root:Wrote 3 papers across 1 shards to /tmp/verify-imp033-index-210

# arxiv 3.0.0
INFO:arxiv:Got first page: 5 of 207907 total results
INFO:root:  5 papers within retention window for cs.CV
INFO:root:Wrote 5 papers across 1 shards to /tmp/verify-imp033-index
```

The 3.0.0 shard carries all 11 fields with a real `pdfUrl`
(`https://arxiv.org/pdf/2610.02210v1`). **The pin is safe for the scheduled deploy.**

`<3` would have been too tight (it would block 3.0.0, the newest version where the
documented flags work) and `<5` would have been too loose (it admits the known-broken
4.0.1). The implementer's reasoning for both rejections is correct.

### 1c. `ArxivError` on 3.0.0 — IMP-004's hard-fail contract intact

Existence is not enough; the catch behaviour was tested functionally on all three versions
by monkeypatching `arxiv.Client.results` to raise a genuine `arxiv.HTTPError`:

```
arxiv.ArxivError exists: <class 'arxiv.ArxivError'>
MRO: ['ArxivError', 'Exception', 'BaseException', 'object']
HTTPError is subclass: True
UnexpectedEmptyPageError is subclass: True

iter_results on HTTPError: returned 0 results,
  status={'failed': True, 'error': 'Page request resulted in HTTP 503 (...)'}
  -> caught by `except arxiv.ArxivError`, status.failed=True  [IMP-004 OK]
build_index.py:260 except clause catches HTTPError -> True (HTTPError)
RuntimeError propagates through `except arxiv.ArxivError` -> correct
```

Identical output on 2.1.0, 3.0.0 and 4.0.1. So `arxiv_common.py:71`'s
`except arxiv.ArxivError` still catches exactly what it should, still records
`status["failed"]`, and still lets non-arXiv errors propagate. **The exception hierarchy
is unchanged across the whole admitted range; the pin cannot affect IMP-004.**

---

## 2. The `--download-*` claim — TRUE, verified both directions

The comment (`requirements.txt:2-3`) asserts arxiv 4.0.0 removed `Result.download_pdf`
and `Result.download_source`. **This is correct and is not misinformation.** Verified by
installing 4.0.0 *and* 4.0.1 and introspecting (no network calls, per instructions):

```
=== arxiv 4.0.0 ===   hasattr(Result, download_pdf)   = False
                      hasattr(Result, download_source) = False
                      hasattr(Result, source_url)      = True    <- replacement
=== arxiv 4.0.1 ===   download_pdf   = False   download_source = False
                      source_url     = True
=== arxiv 3.0.0 ===   download_pdf   = True
                      download_source = True   (control)
=== arxiv 2.1.0 ===   download_pdf   = True    download_source = True
```

At the source level, `arxiv/__init__.py:224` (`def download_pdf`) and `:247`
(`def download_source`) exist on 3.0.0 and are **absent on both 4.0.0 and 4.0.1**; a
recursive `grep "def download"` over the installed package returns hits on 2.1.0/3.0.0 and
**zero hits on either 4.x**.

**The other direction also holds: arxiv 3.0.0 *does* still have both methods**, bound on
the instance, so the comment's implication that `<4` "keeps the documented CLI flags
working" (`requirements.txt:9`) is **accurate**, not an overstatement. The call shape
`paper-collector.py:239` uses also still matches:

```
# 3.0.0
download_pdf    -> bound method (dirpath='./', filename='', download_domain='export.arxiv.org') -> str
download_source -> bound method (dirpath='./', filename='', download_domain='export.arxiv.org') -> str
```

`result.download_pdf(filename=...)` matches by keyword, so no `TypeError` on 3.0.0.
The flags documented at `readme.md:107-108` do work on the version the pin admits.

---

## 3. Floor-fix framing — ADEQUATE

`requirements.txt:10-12`:

```
# This is a floor, not the fix: paper-collector.py is still written against
# APIs a future major can remove. Porting it to the 4.x API is tracked
# separately (IMP-093); do not read this bound as that work being done.
```

Judged against the spec's Notes requirement, this is strong:
- the literal phrase **"This is a floor, not the fix"** is present;
- the only sentence that could read as a fix claim (`requirements.txt:9`, "keeps the
  documented CLI flags working") is on the **immediately preceding line**, not separated
  from the disclaimer;
- the imperative **"do not read this bound as that work being done"** forecloses the
  exact misreading;
- the IMP-093 pointer is **correct** — `FEATURES.md:1803` reads
  `### IMP-093 — Repair --download-pdfs and --download-sources on arxiv 4.x`,
  and `FEATURES.md:698` (IMP-033's own Notes) names IMP-093 as the substitute for this
  work. The cross-reference does not dangle.

A future reader would have to ignore an adjacent, explicitly imperative disclaimer to come
away thinking "the crash is fixed." **Framing requirement met.** See §6 for one optional
improvement, which is a completeness gap, not a framing failure.

---

## 4. AC2 — clean venv, independently created

```
$ rm -rf /tmp/verify-imp033-clean
$ /usr/local/bin/python3.11 -m venv /tmp/verify-imp033-clean
$ /tmp/verify-imp033-clean/bin/python -m pip install -r requirements.txt
Successfully installed arxiv-3.0.0 certifi-2026.7.22 charset-normalizer-3.5.2
 feedparser-6.0.14 feedparser-sgmllib-2.1.0 idna-3.20 numpy-2.4.6 pandas-3.0.6
 python-dateutil-2.9.0.post0 requests-2.33.1 six-1.17.0 urllib3-2.8.0

$ /tmp/verify-imp033-clean/bin/python -m pip list
arxiv              3.0.0        <- resolved version, in range [2.1.0, 4)
pandas             3.0.6        <- resolves, requirement UNCHANGED

$ /tmp/verify-imp033-clean/bin/python -m unittest discover -s tests -v
Ran 77 tests in 0.051s
OK
```

- **Resolved arxiv: 3.0.0** — matches the implementer's report exactly.
- **`pandas` resolves (3.0.6) and its requirement line is untouched** (byte-identical to
  HEAD, §0). Confirmed.
- **Full Python suite: 77 tests, `OK`.** Matches the implementer's report.
- Re-run on **Python 3.14.3** (what CI's `python-version: "3.x"` actually resolves to
  today): `arxiv 3.0.0`, `pandas 3.0.6`, `Ran 77 tests ... OK`.

### 4a. The green suite proves very little — measured, not assumed

The prompt was right to flag this. I tested it directly by running the repo's own suite
against **arxiv 4.0.1**, the version that crashes `--download-pdfs`:

```
$ /tmp/verify-imp033-4x/bin/python -m pip install "pandas>=2.0.0"   # arxiv 4.0.1 in place
$ /tmp/verify-imp033-4x/bin/python -m unittest discover -s tests
Ran 77 tests in 0.056s
OK
```

**77/77 pass on the known-broken version.** The suite is hermetic — `tests/test_build_index.py:294-521`
replaces `build_index.arxiv_common.iter_results` with fakes, and result fixtures are
`SimpleNamespace`-style fakes, never real `arxiv.Result` objects — so it cannot observe
the removed API. **A green suite is not evidence for or against this pin.** The stronger
checks I substituted are §1b (introspection of every referenced symbol on the real
objects), §1c (functional `ArxivError` contract test), §2 (source-level removal check),
and §1b's live index build. The implementer's report makes this same admission at
`impl-IMP-033.md:30-31`, which is a point in its favour.

---

## 5. AC3 — docs stay accurate

```
$ grep -rniE "arxiv[^a-z]|version|pip install|requirements|python 3|3\.[0-9]+" readme.md CONTRIBUTING.md
readme.md:4:[![Python 3.x](...python-3.x-blue.svg)](...)
readme.md:38:   pip install -r requirements.txt
readme.md:83:pip install -r requirements.txt
readme.md:121:A Jupyter notebook version of the same workflow is available at
CONTRIBUTING.md:8:2. Install dependencies: `pip install -r requirements.txt`.
```

**No arxiv version, no pandas version, no upper-bound or API-shape claim** in either file.
`readme.md:4` is a generic "Python 3.x" badge, which the pin does not falsify. Both docs
say only "install `requirements.txt`", which remains correct. **AC3 met; neither file
needs a change, and neither was touched.**

The implementer's further claim that the pin makes `readme.md:107-108` *more* accurate is
supported by §2: those two flags do resolve and work on 3.0.0.

---

## 6. CI compatibility

`.github/workflows/ci.yml` and `.github/workflows/deploy.yml` were both read in full.

- `ci.yml:12-17` and `deploy.yml:26-31` both use `actions/setup-python@v5` with
  `python-version: "3.x"` and `pip install -r requirements.txt`. **Neither workflow
  mentions arxiv or pandas at all** (`grep -rniE "arxiv|pandas|version|python"
  .github/workflows/` returns only the Python setup lines, the node setup lines, and an
  arXiv comment in `deploy.yml:5`). **Neither pins or assumes a specific arxiv version,
  and both get the bound for free from the same file.** No workflow edit was needed and
  none is required by this change.
- **Can CI's Python install arxiv 3.0.0?** Yes. `arxiv 3.0.0` declares
  `Requires-Python: >=3.10`; `3.x` resolves to 3.14.3 today. Confirmed empirically by
  installing `requirements.txt` and running the suite on 3.14.3 (see §4).
- The `web-tests` job is untouched by this change. The `Build` step at `ci.yml:39-40` is
  the other agent's IMP-026 work and is out of scope here.

---

## 7. Findings

### Blocking
None.

### Non-blocking observations

**N1 (advisory, comment completeness).** arxiv **3.0.0's own docstring already deprecates
the two helpers the repo depends on** — `arxiv/__init__.py:235-236`:

> `**Deprecated:** future versions of this client library will not provide download
> helpers (out of scope). Use `result.pdf_url` directly.`

The committed comment (`requirements.txt:10-12`) says the code is "written against APIs a
future major can remove" without citing that **the pinned version already flags them**.
This is not a defect — every claim the comment makes is true — but adding one clause would
strengthen the floor framing and hand IMP-093 a ready-made replacement, since
`Result.pdf_url` and `Result.source_url` are both verified present on 3.0.0 *and* on 4.x
(§2). Suggested amendment, if the author wants it:
`# arxiv 3.0.0 itself deprecates these helpers (arxiv/__init__.py:235) in favour of`
`# Result.pdf_url / Result.source_url, which exist in 3.x and 4.x alike.`

**N2 (spec item, unverifiable by me).** AC2's "Record the resolved version in the PR body"
is a PR-time obligation. `impl-IMP-033.md:4` does record `arxiv 3.0.0`, which I confirm
independently, but the actual PR body cannot be verified from this working tree.

**N3 (pre-existing, out of scope, noted for the record).** `paper-collector.py:245`'s
`except (arxiv.ArxivError, OSError, tarfile.TarError)` does **not** catch
`AttributeError`. I measured this on all three versions — `AttributeError ESCAPES` the
clause everywhere. This is precisely the 4.x crash and it is **unrelated to the pin** (the
pin only makes 4.x uninstallable, it does not fix the handler). Already owned by IMP-093
(`FEATURES.md:1803`, and `FEATURES.md:1972` notes IMP-093's criterion 2 widens that same
tuple). No action for this item; recorded so the next verifier does not mistake it for a
regression introduced by the pin.

### Claims checked and found accurate
- `ResolutionImpossible` for 4.0.1 — reproduced (§1a).
- 4.0.0 removed `download_pdf`/`download_source` — confirmed on both 4.0.0 and 4.0.1 (§2).
- 3.0.0 still has them, so `<4` keeps the documented flags working — confirmed (§2).
- Clean venv resolves arxiv 3.0.0 — reproduced (§4).
- Suite is hermetic and was green on 4.0.1 while the flags were crashing — reproduced (§4a).
- `readme.md` / `CONTRIBUTING.md` state no arxiv version — confirmed (§5).
- `pandas` untouched and still resolving — confirmed, byte-identical line (§0, §4).
- arxiv 4.x swapped `feedparser` for `lxml` — confirmed: `hasattr(arxiv, "feedparser")` is
  `True` on 3.0.0 and `False` on 4.0.1, and the 4.0.1 resolve pulls `lxml-6.1.3` while the
  3.0.0 resolve pulls `feedparser-6.0.14`. An extra, genuinely good reason for `<4`.

No overconfident claim in the implementer's report was found to be false.

---

## 8. Reproduction

```shell
cd /Users/denimpatel/Desktop/git/research-paper-feed

# bound is enforced, both directions
python3.11 -m venv /tmp/v && /tmp/v/bin/pip install -r requirements.txt
/tmp/v/bin/pip install --dry-run --constraint requirements.txt "arxiv==4.0.1"  # ResolutionImpossible
/tmp/v/bin/pip install --dry-run --constraint requirements.txt "arxiv==3.0.0"  # satisfied
/tmp/v/bin/pip list | grep -i arxiv                                             # 3.0.0
/tmp/v/bin/python -m unittest discover -s tests                                # Ran 77 ... OK

# the removed API, without any network call
python3.11 -m venv /tmp/v4 && /tmp/v4/bin/pip install "arxiv==4.0.1"
/tmp/v4/bin/python -c "import arxiv; print(hasattr(arxiv.Result,'download_pdf'))"  # False
/tmp/v/bin/python    -c "import arxiv; print(hasattr(arxiv.Result,'download_pdf'))"  # True

# the suite cannot see any of this
/tmp/v4/bin/pip install "pandas>=2.0.0" && /tmp/v4/bin/python -m unittest discover -s tests  # Ran 77 ... OK
```
