# IMP-033 — Add an upper bound to `arxiv` in `requirements.txt`

**Status:** implemented. **Files changed:** `requirements.txt` only (plus this report).
**Verified:** 2026-10-02. **Resolved version with the pin in place: `arxiv 3.0.0`.**

---

## 0. Read this first: the pin is a FLOOR, not the crash fix

The spec's Notes are explicit and I am restating them at the top because they are the
easiest thing in this item to get wrong in a PR body:

> **The bound added here does not fix `--download-pdfs` / `--download-sources`.** It only
> makes a *known-broken* version uninstallable. `scripts/paper-collector.py:239,241` is
> still written against `Result.download_pdf` / `Result.download_source`, APIs a future
> major can remove again. Porting that code to the modern arxiv API is **IMP-093** and is
> **not done by this change**.

Concretely, the trap the Notes warn about: pinning to `<3` would have made the
`AttributeError` disappear *and* left the code on an API that is one minor line away from
being dead — the crash would return, silently, at the next major. The chosen bound keeps
3.0.0 installable, which is the newest release where those helpers still exist, so the
pin buys real headroom instead of deferring the breakage.

Two independent reasons the pin must **not** be read as the fix:

1. arxiv 4.x also swapped `feedparser` for **`lxml`** (see §3). Porting `paper-collector.py`
   to 4.x is a real code change with a real new native dependency on the deploy path, and
   nobody has done it.
2. The 27-test/44-test suite is **hermetic** — it never imports `arxiv` for real, so it
   was green on 4.0.1 while the flags were crashing. A green suite is not evidence here.

---

## 1. The bound

`requirements.txt:12`

```diff
-arxiv>=2.1.0
+arxiv>=2.1.0,<4
```

The lower bound is untouched (out of scope; the item is about the ceiling). The comment
block above it names the verified version and the reason.

---

## 2. What the code actually needs — empirical, not assumed

I did not reason from release notes. I installed **every published `arxiv` release from
2.1.0 upward into isolated target directories** and introspected the live objects.

`python3 -m pip index versions arxiv` (all releases):

```
4.0.1, 4.0.0, 3.0.0, 2.4.1, 2.4.0, 2.3.2, 2.3.1, 2.3.0, 2.2.0, 2.1.3,
2.1.2, 2.1.1, 2.1.0, 2.0.0, 1.4.8, ... 0.0.1
```

### 2a. The APIs the LIVE deploy path uses — identical in *every* version 2.1.0 → 4.0.1

`scripts/arxiv_common.py:22-26` (`Client`), `:54-62` (`Search`, `SortCriterion`,
`SortOrder`), `:71` (`ArxivError`); `scripts/build_index.py:260`
(`arxiv_common.arxiv.ArxivError`); `record_from_result` (`:104-121`) reads
`summary/entry_id/title/authors/published/updated/categories/primary_category/pdf_url`.

| Symbol the code uses | 2.1.0 | 2.1.3 | 2.2.0 | 2.3.2 | 2.4.1 | 3.0.0 | 4.0.0 | 4.0.1 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Client(page_size, delay_seconds, num_retries)` | yes | yes | yes | yes | yes | yes | yes | yes |
| `Client.results(search, offset)` | yes | yes | yes | yes | yes | yes | yes | yes |
| `Search(query, id_list, max_results, sort_by, sort_order)` | yes | yes | yes | yes | yes | yes | yes | yes |
| `SortCriterion.SubmittedDate` | yes | yes | yes | yes | yes | yes | yes | yes |
| `SortOrder.Descending` | yes | yes | yes | yes | yes | yes | yes | yes |
| `ArxivError` | yes | yes | yes | yes | yes | yes | yes | yes |
| `Result.{entry_id,updated,published,title,authors,summary,primary_category,categories,links,pdf_url}` | yes | yes | yes | yes | yes | yes | yes | yes |
| **`Result.download_pdf`** | **yes** | **yes** | **yes** | **yes** | **yes** | **yes** | **NO** | **NO** |
| **`Result.download_source`** | **yes** | **yes** | **yes** | **yes** | **yes** | **yes** | **NO** | **NO** |

**arxiv 4.x removed exactly two attributes from `Result` and changed nothing else the
repo touches.** Confirmed at the source level, not just by introspection —
`grep -rn "download_pdf\|download_source\|def download" arxiv-probe/4.0.1/arxiv/` returns
**zero hits**, and 4.0.1's `Result.__init__` still assigns every field
`record_from_result` reads.

### 2b. What breaks, by range

| Range | `build_index.py` + `arxiv_common.py` (the scheduled deploy) | `paper-collector.py --download-pdfs` / `--download-sources` |
| --- | --- | --- |
| `2.1.0` – `3.0.0` | **works** | **works** |
| `4.0.0` / `4.0.1` | **works** (nothing it needs was removed) | **crashes — `AttributeError` on the first result** |

So the two code paths split *exactly* at the 3→4 boundary, and the deploy path does not
split at all.

### 2c. The crash, reproduced offline on 4.0.1

`fetch_papers` is called with a real `arxiv.Result` and a stubbed iterator, so no network
is touched but the real attribute lookup happens:

```
arxiv 4.0.1
RESULT: AttributeError -> 'Result' object has no attribute 'download_pdf'
escapes except at paper-collector.py:245 (catches ArxivError/OSError/TarError only): True
```

This confirms profile row **PY-26 / PE-8**: the `except (arxiv.ArxivError, OSError,
tarfile.TarError)` at `scripts/paper-collector.py:245` does not catch `AttributeError`, so
the error escapes and aborts the entire run. Nothing to do with the pin.

Same harness on the pinned `arxiv 3.0.0`:

```
arxiv 3.0.0
fetch_papers returned (1, 9) row(s); download_pdf resolved to: True
```

---

## 3. Why `<4` and not `<5` — the bound decision, stated explicitly

The prompt warns a verifier will check for a bound that is **too loose** (lets a known-broken
version in) or **too tight** (blocks something the working path needs). Both were tested.

### Rejecting `<5` (too loose)

`<5` is what the spec offered as acceptable (`"<5, or narrower"`). It is **too loose**:

- A clean resolve under `<5` yields **arxiv 4.0.1** — the exact known-broken version.
- `pip install --dry-run --constraint requirements.txt "arxiv==4.0.1"` with a `<5` bound
  succeeds; with `<4` it fails `ResolutionImpossible` (verified both ways in §4).
- So under `<5`, PY-26 is still reachable by a plain `pip install -r requirements.txt`.
  The bound would document the hazard without preventing it.

`<4` also sheds a dependency the deploy does not want. arxiv 4.x replaced `feedparser`
with **`lxml`**:

```
--- arxiv==3.0.0 Requires-Dist ---        --- arxiv==4.0.1 Requires-Dist ---
  feedparser~=6.0.10                        lxml<7.0,>=6.1.0
  requests<2.34,>=2.32                      requests<2.35,>=2.32
  typing-extensions>=4.0.0; py<3.11         typing-extensions>=4.0.0; py<3.11
```

`lxml` is a native-extension wheel — 8.6 MB in the resolve I ran. Introducing it onto a
scheduled job that needs none of it is exactly the kind of unattended change the pin exists
to prevent.

### Rejecting `<3` (too tight)

`<3` would block **3.0.0**, which is the newest version in which the documented
`--download-pdfs` / `--download-sources` flags still work. The profile treats
`scripts/paper-collector.py` as a **compatibility surface** (§6: "Any change there must
keep these flags working"). A bound that makes a currently-working documented flag
unreachable is gratuitous breakage, and it would be *invisible* — the suite would still
pass, exactly as it passes on 4.0.1 today.

### Chosen: `arxiv>=2.1.0,<4`

- **Not too tight:** every version from 2.1.0 to 3.0.0 is admitted, and all of them work for
  the deploy path *and* for the legacy CLI's download flags. The lower bound is unchanged
  from the file's original value, so nothing that installed before is newly blocked except
  the 4.x line — and 4.x was never functional for the flags anyway.
- **Not too loose:** 4.0.0 and 4.0.1 are excluded, and the exclusion is enforced by pip
  (`ResolutionImpossible`, §4), not merely documented.
- **Protects the deploy:** the index build is unaffected by the bound either way (§2b), and
  the bound stops a *future* 5.x from breaking it unattended — which is the item's actual
  intent.

A future `arxiv 5.x` may well remove more; the bound is what forces that to be a deliberate
upgrade with a test run, not a silent Tuesday deploy.

---

## 4. Every command, with results

### 4.1 Clean venv from `requirements.txt` (AC2)

```shell
rm -rf /tmp/rpf-pin-imp033
/usr/local/bin/python3.11 -m venv /tmp/rpf-pin-imp033
/tmp/rpf-pin-imp033/bin/pip install -r requirements.txt
```

exit 0. `/tmp/rpf-pin-imp033/bin/pip list | grep -i arxiv`:

```
arxiv              3.0.0
```

Full resolve (note: `pandas` is untouched per the task, and it still floats to 3.0.6):

```
Package            Version        Package            Version
arxiv              3.0.0          pandas             3.0.6
certifi            2026.7.22      requests           2.33.1
charset-normalizer 3.5.2          setuptools         65.5.0
feedparser         6.0.14         six                1.17.0
feedparser-sgmllib 2.1.0          urllib3            2.8.0
idna               3.20
numpy              2.4.6
python-dateutil    2.9.0.post0
```

### 4.2 The suite in that venv (AC2)

```shell
/tmp/rpf-pin-imp033/bin/python -m unittest discover -s tests -v
```

```
Ran 77 tests in 0.056s

OK
```

Control on the provisioned interpreter (arxiv 2.1.3) — same count, so the bound is
count-neutral and the profile's "44 tests" figure is simply stale:

```shell
/usr/local/bin/python3.11 -m unittest discover -s tests     # Ran 77 tests ... OK
```

### 4.3 The bound is enforced, in both directions

```shell
/tmp/rpf-pin-imp033/bin/pip install --dry-run --constraint requirements.txt "arxiv==4.0.1"
```

```
ERROR: ResolutionImpossible: for help visit https://pip.pypa.io/en/latest/topics/dependency-resolution/#dealing-with-dependency-conflicts
```

```shell
/tmp/rpf-pin-imp033/bin/pip install --dry-run --constraint requirements.txt "arxiv==3.0.0"
```

```
Requirement already satisfied: ...
```

(4.x is rejected, 3.0.0 is accepted. An earlier attempt at this test ran a bare
`pip install arxiv==4.0.1` without `--constraint`, which of course ignored
`requirements.txt` and succeeded — that was my error in constructing the test, not a gap in
the pin. The `--constraint` form is the correct one and is what is quoted above.)

### 4.4 The real deploy path, live (network), on the pinned version

```shell
/tmp/rpf-pin-imp033/bin/python scripts/build_index.py --category cs.CV \
    --max-per-category 20 --out-dir /tmp/rpf-pin-imp033-index
```

```
INFO:root:Querying cat:cs.CV (limit 20) ...
INFO:arxiv:Got first page: 20 of 207907 total results
INFO:root:  20 papers within retention window for cs.CV
INFO:root:Wrote 20 papers across 1 shards to /tmp/rpf-pin-imp033-index
```

`index.json` written, plus `papers-2026-W40.json` (18,961 bytes). The wire record on
`arxiv 3.0.0` carries all 11 fields `web/src/lib/types.ts` declares —
`absUrl, abstract, abstractTruncated, authors, categories, id, pdfUrl, primaryCategory,
published, title, updated` — with `pdfUrl` a real string
(`https://arxiv.org/pdf/2610.02210v1`), so **profile trap 1 (hand-mirrored Python→TS
contract) is not disturbed by this change**: no field is added, removed, renamed, or
changed type by the version move.

---

## 5. AC3 — do `readme.md` and `CONTRIBUTING.md` stay accurate? Verified.

**Yes, both stay accurate. Neither needs a change, and I did not touch either.**

I grepped both documents and both workflows for any version claim:

```shell
grep -rniE "arxiv[><=~ ]*[0-9]|pip install|requirements" readme.md CONTRIBUTING.md .github/workflows/
```

```
readme.md:38:   pip install -r requirements.txt
readme.md:83:pip install -r requirements.txt
CONTRIBUTING.md:8:2. Install dependencies: `pip install -r requirements.txt`.
.github/workflows/deploy.yml:31:        run: pip install -r requirements.txt
.github/workflows/ci.yml:17:        run: pip install -r requirements.txt
```

There is **no arxiv version, no pandas version, and no upper-bound claim anywhere** in
either document. Both simply say "install `requirements.txt`", which is exactly the
version-agnostic instruction that remains correct after this change. The workflows install
from the same file, so both CI and the scheduled deploy get the bound for free — no
workflow edit is needed or made.

**The pin makes `readme.md` strictly *more* accurate, not less.** `readme.md:107-108`
documents `--download-pdfs` and `--download-sources` as working flags. Today, on the
unpinned file resolving to 4.0.1, they crash with `AttributeError` (§2c) — the readme is
currently *wrong*. With `<4` they resolve to an arxiv where they work again, so the readme
becomes correct. That is profile row PY-26 closing at the *install-resolution* level only.

**Nothing to flag as out of scope.** No document in the repo becomes inaccurate as a result
of this change. To be explicit about the two docs the prompt named: if either needed
editing I would have said so loudly rather than editing it — neither does.

---

## 6. `pandas` — deliberately unchanged, and I agree with the profile

I did **not** touch `pandas>=2.0.0`, per instructions and because it is genuinely a
separate concern. Recording my agreement with profile row **INF-07** for whoever picks it
up: `scripts/build_index.py` never imports pandas — only `scripts/paper-collector.py:15`
and `tests/test_paper_collector.py:9` do. So every `deploy.yml` run installs pandas (and
its numpy tree) for a code path that does not use it. `pip list` above shows the full
cost: `pandas 3.0.6` + `numpy 2.4.6` + `python-dateutil` + `tzdata`-class transitive deps
in a job that only needs `arxiv`, `requests`, `feedparser`.

That is a *dependency-graph* question (splitting a legacy-CLI-only dep out of the deploy's
requirements), not a version question, and fixing it changes what the deploy installs —
out of scope here. Flagging, not doing. Also note pandas 3 is a major that makes
`paper-collector.py:108-118`'s chained `df["Col"][i]` indexing (profile PY-37) officially
deprecated; that is a source fix, again not a requirements fix.

---

## 7. Scope hygiene

- Files I modified: `requirements.txt`, and this report under `.improve/reports/`.
- No lockfile added (the spec does not ask for one).
- No `git add` / `commit` / `push` / branch switch. `git status` was used read-only.
- **Note for whoever reviews the tree:** `git status` also shows
  `M .github/workflows/ci.yml` and three untracked `.improve/reports/*` files. Those are
  **not mine** — I did not open `ci.yml`. The untracked reports are other agents' output.
  My only tracked change is `requirements.txt`.
- `.kilo/worktrees/mildly-income/` was never read, written, or `cd`-ed into.
- I did not run the full web suite (`npm test` / `typecheck` / `build`): this change touches
  no file under `web/` and no JS. Per the profile's §4 row-selection rule, the Python suite
  is the applicable gate and it is green. The live index build (§4.4) was run as the extra
  confidence that the Python↔TS wire format is unchanged.

---

## 8. Files changed

```
requirements.txt            +12 −1   (comment block + `,<4` on line 12)
.improve/reports/impl-IMP-033.md        (this file)
```

`git --no-pager diff -- requirements.txt`:

```diff
@@ -1,2 +1,14 @@
-arxiv>=2.1.0
+# Verified against arxiv 3.0.0 (2026-10-02). The upper bound is load-bearing:
+# arxiv 4.0.0 removed Result.download_pdf and Result.download_source, which
+# scripts/paper-collector.py calls for --download-pdfs / --download-sources.
+# Everything the scheduled index build (scripts/arxiv_common.py,
+# scripts/build_index.py) uses -- Client(page_size, delay_seconds,
+# num_retries), Search(query, max_results, sort_by, sort_order),
+# SortCriterion.SubmittedDate, SortOrder.Descending, ArxivError and every
+# Result attribute record_from_result reads -- is unchanged through 4.x, so
+# <4 costs the deploy nothing and keeps the documented CLI flags working.
+# This is a floor, not the fix: paper-collector.py is still written against
+# APIs a future major can remove. Porting it to the 4.x API is tracked
+# separately (IMP-093); do not read this bound as that work being done.
+arxiv>=2.1.0,<4
 pandas>=2.0.0
```

The comment states the verified version (3.0.0) per AC1 and states the floor framing per
the spec's Notes, so that nobody reading the file later takes the pin for a fix to
PY-26 / IMP-093.

---

## 9. How to verify this

```shell
cd /Users/denimpatel/Desktop/git/research-paper-feed
git --no-pager diff -- requirements.txt
grep -n "arxiv" requirements.txt
# -> line 12: arxiv>=2.1.0,<4

rm -rf /tmp/rpf-pin-verify
python3 -m venv /tmp/rpf-pin-verify
/tmp/rpf-pin-verify/bin/pip install -r requirements.txt
/tmp/rpf-pin-verify/bin/pip list | grep -i arxiv        # -> arxiv 3.0.0
/tmp/rpf-pin-verify/bin/python -m unittest discover -s tests    # -> Ran 77 tests ... OK

# the bound is real, not decorative:
/tmp/rpf-pin-verify/bin/pip install --dry-run --constraint requirements.txt "arxiv==4.0.1"
# -> ERROR: ResolutionImpossible

# the legacy CLI's download path still resolves:
/tmp/rpf-pin-verify/bin/python -c \
  "import arxiv; print(arxiv.Result.download_pdf, arxiv.Result.download_source)"
# -> <function download_pdf ...> <function download_source ...>
```

A verifier who wants to check the "not the crash fix" claim should read §0 and §2c: the
`AttributeError` still exists in `scripts/paper-collector.py:239,241`, it is merely
unreachable at the version the constraints admit. That is **IMP-093**, still open.
