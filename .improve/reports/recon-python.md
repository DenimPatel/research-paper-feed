# Recon Report — Python Data Pipeline (`scripts/`, `tests/`, notebook)

Scope: `scripts/arxiv_common.py`, `scripts/paper-collector.py`, `scripts/build_index.py`,
`tests/test_*.py`, `requirements.txt`, `notebooks/paper-collector.ipynb`, plus the two
GitHub Actions workflows that consume them. Read-only audit; nothing was modified.

---

## 0. Test suite baseline

Command from repo root (`CONTRIBUTING.md:9`, `.github/workflows/ci.yml:20`):

```
python -m unittest discover -s tests -v
```

Result: **27 tests, all pass, 0.008s** — on Python 3.14.3 with `arxiv 4.0.1` and
`pandas 3.0.6` resolved from `requirements.txt`. The suite is fast and hermetic
(no network, no clock dependence, no filesystem beyond `tempfile`).

Tooling notes:
- `pyflakes scripts/*.py tests/*.py` → **clean** (no unused imports, no undefined names).
- **No linter/type-checker/coverage config exists** anywhere in the repo: no
  `pyproject.toml`, `setup.cfg`, `tox.ini`, `ruff.toml`, `.flake8`, `mypy.ini`,
  `pytest.ini`, or `.pre-commit-config.yaml`. CI runs `unittest` only. So the
  Python side has *zero* static analysis while the web side has `tsc --noEmit`
  (`.github/workflows/ci.yml:38`). Asymmetry.
- `requirements.txt` has **no upper bounds and no lockfile**: `arxiv>=2.1.0`
  resolved to `4.0.1`, `pandas>=2.0.0` to `3.0.6`. This is not hypothetical —
  arxiv 4.0 is what broke `--download-pdfs` (see BUG-1).
- The suite passed *despite* BUG-1 because no test ever exercises
  `fetch_papers` or anything that touches `result.download_pdf`.

---

## 1. `scripts/arxiv_common.py` — shared arXiv client

**Intent.** One place for client construction so rate-limit/retry/sort semantics
stay identical between the CLI and the index builder (docstring `:1-7`). Created
to centralize a real regression (see BUG-9).

### Completeness

| Behavior | Where | Verdict |
| --- | --- | --- |
| Page size | `:23` | Complete. `max(1, min(1000, max_results))`. |
| Rate limiting | `:24` | Complete but **3× over-conservative** (see ROUGH-1). |
| Retries | `:25` | Passed to library; library only retries `HTTPError`, `UnexpectedEmptyPageError`, `requests.ConnectionError` (verified in arxiv 4.0.1 `_parse_feed`). |
| Sort | `:47-48` | `SubmittedDate`/`Descending` — correct, and load-bearing for the retention `break` in `build_index.py:217`. |
| Error handling | `:58-59` | **Deliberately swallowing.** Documented, but see BUG-8. |
| Timeouts | — | **Absent.** See BUG-4. |

### Findings

- **BUG-4 (no HTTP timeout anywhere).** `arxiv.Client` in 4.0.1 issues
  `self._session.get(url, headers={"user-agent": _USER_AGENT})` with **no
  `timeout=` argument** (verified from library source). `build_client`
  (`arxiv_common.py:20-26`) has no hook to add one. A half-open TCP connection
  hangs the process forever; in CI (`deploy.yml:33`, `python scripts/build_index.py`)
  that means a job that sits until the 6-hour Actions cap with no diagnostic.
  No timeout, no `requests.exceptions.Timeout` retry path either.
- **Rough edge: rate-limit delay is not configurable and is 3× the ToU minimum.**
  `DEFAULT_DELAY_SECONDS = 10` (`:16`). arXiv's ToU asks for ≥3s; arxiv's own
  docstring in 4.0.1 says "one request every three seconds". With `page_size=1000`
  and a 60-day window the practical page count is modest (~10-15 pages total), so
  the wall-clock cost is a few minutes — but it is unconfigurable and unjustified
  relative to ToU, and there is no per-category backoff.
- **Dead/redundant code: the manual `yielded` counter (`:51, :55-57`).**
  `arxiv.Client.results()` already returns `itertools.islice(self._results(...), limit)`
  where `limit = search.max_results`. The counter can never fire before arxiv's
  own islice. Harmless, but it duplicates the library contract and `test_stops_after_max_results`
  passes on either implementation, so the redundancy is untestable-by-design.
- **`build_client` page size is coupled to `max_results`** (`:23`). With
  `--max-papers 3` you request `page_size=3`. Works, but the coupling is
  surprising and makes a tiny query still cost one full round-trip. Not a bug.
- **Latent ceiling:** `Search(max_results=UNLIMITED)` (`build_index.py:38`, `UNLIMITED = 100000`)
  exceeds the arXiv API's 30,000-result `start` ceiling. In practice the retention
  `break` stops long before this, but if it ever didn't, arxiv would raise `HTTPError`
  after retries and `iter_results` would **silently truncate** (BUG-8).
- **Missing: no retry/backoff on the *iteration* level.** One failed page ends the
  whole query for that category permanently.
- **Missing: no request-level logging of counts.** `iter_results` logs nothing on
  success, so `build_index.py` per-category counts are the only signal.
- **Side effect at import: `logging.basicConfig(level=logging.INFO)` (`:13`).**
  A shared "library" module reconfiguring the root logger globally. Duplicated in
  both scripts (`:13` and `paper-collector.py:18`), and `build_index.py:40` adds
  a third `basicConfig` with `format="%(levelname)s %(message)s"` that would
  leak into any other importer. Should be a `NullHandler` + explicit config in
  `__main__`.

---

## 2. `scripts/build_index.py` — the pipeline behind GitHub Pages

**Intent.** Nightly sharded JSON index for the web app; pure helpers are
network-free so they can be unit tested (docstring `:2-14`). This is the
well-engineered half of the repo.

### 2.1 Parsing / normalization

- `collapse_whitespace` (`:43-45`) — correct, handles `None`.
- `truncate_abstract` (`:48-53`) — correct, appends `\u2026`, returns a
  `(text, was_truncated)` tuple so the UI can signal truncation.
  **Rough edge:** `max_chars <= 0` silently returns the *full* text with
  `was_truncated=False` (verified). `--abstract-chars -3` therefore does the
  exact opposite of "truncate to -3 chars", with no warning.
- `format_authors` (`:56-66`) — handles the very-long-author-list case correctly:
  caps at `DEFAULT_MAX_AUTHORS=8` and appends a literal `"et al."` string as a
  list element. This matches `PaperCard.tsx:63` which just `join(", ")`s them.
  Tested for 9 and 2 authors.
  **BUG-6: `str(author)` fallback emits non-deterministic output.** When
  `author.name` is falsy, `:60` falls back to `str(author)`, which for an
  arbitrary object is `"<module.A object at 0x7f...>"` — a **memory address**.
  Verified: `format_authors([obj_with_name_None])` →
  `['<__main__.A object at 0x10a4a67b0>']`. That address would be written into
  `paper.authors` and shipped to the browser, breaking byte-for-byte
  reproducibility of the index for that record. `None`/`[]` inputs are handled
  (return `[]`), and plain strings work (`str("Alice")` → `"Alice"`), so the
  fallback is only reachable via a malformed author object — low likelihood,
  but it is exactly the branch whose whole purpose is "we don't know".
- `arxiv_id_from_entry` (`:69-74`) — **BUG-5: legacy arXiv ID prefixes are
  dropped, causing dedup collisions.** `rsplit("/", 1)[-1]` strips the archive
  prefix. Verified: `https://arxiv.org/abs/hep-th/9901001v1` → `"9901001"` and
  `https://arxiv.org/abs/math/9901001v1` → `"9901001"`. Two distinct papers
  collide into one record in `dedupe_records`, and one paper's metadata is
  silently dropped. Unreachable for the default `cs.*` categories (post-2007
  IDs have no prefix), which is why it hasn't been noticed — but the helper is
  public and the notebook/collector paths are unbounded. arxiv 4.x provides
  `Result.get_short_id()` specifically to preserve `hep-th/9901001v1`.
  Also note `arxiv_id_from_entry("not-a-url")` → `"not-a-url"` (no validation).
- `iso_date` (`:77-87`) — correct for tz-aware datetimes (verified:
  `2024-01-08T23:30-05:00` → `"2024-01-09"`), `date`, `None`, and string
  passthrough. **Docstring inaccuracy:** it claims "normalized to UTC", but the
  naive-datetime branch (`:83`) does *not* convert — it calls `.date()` on the
  value as-is, silently assuming the caller meant UTC. All four branches are
  untested.
- `iso_week_key` (`:90-94`) — correct ISO-year semantics (`2023-01-01` →
  `2022-W52`, tested). Throws `ValueError` on non-ISO strings (verified); no
  guard, but all callers pass `iso_date` output.
- `record_from_result` (`:97-114`) — the public record shape. Uses
  `getattr` with defaults throughout, so a `Result`-like object missing any
  field degrades instead of raising. Matches `web/src/lib/types.ts` `Paper`
  exactly, field for field. **Type mismatch:** `pdfUrl` is declared `string`
  in TS but arxiv's `Result.pdf_url` is `str | None` (confirmed in arxiv 4.0.1
  source and in its own docstring). A record with no PDF link serializes
  `pdfUrl: null` into the JSON the app consumes.
- `dedupe_records` (`:117-135`) — **BUG-3: mutates its caller's input.**
  `merged[paper_id] = dict(record)` is a *shallow* copy, so
  `existing["categories"]` is the same list object as `record["categories"]`.
  The merge loop at `:133` then appends into that shared list. Verified: after
  `dedupe_records([A(cs.CV), A(cs.LG)])`, the input's first record's
  `categories` is `['cs.CV','cs.LG']` instead of `['cs.CV']`. Idempotent in the
  one place it's currently used, but it's a hidden side effect and the test
  (`test_build_index.py:99-104`) only asserts on the *output*, so a regression
  here is invisible. Fix is `dict(record, categories=list(record["categories"]))`.

### 2.2 Collection, retention, and pagination

- `collect_papers` (`:203-221`) — per-category loop, `query = f"cat:{category}"`
  (`:211`), retention `break` (`:217`). The `break` is correct *because*
  `arxiv_common` sorts by `SubmittedDate` descending — a load-bearing coupling
  that is not documented at the call site.
  - **BUG-7: the retention filter has no post-filter, so non-datetime
    `published` values bypass it entirely and land in the index.** Verified:
    a result whose `published` is the string `"2001-01-01"` is *kept* by
    `:216` (because `_result_datetime` returns `None`, so the `is not None`
    guard fails) and then sharded as `papers-2001-W01.json` — a 25-year-old
    shard in a "60-day retention" index. Same for `published=None`, though that
    one is silently dropped later by `build_shards:149`. The correct shape is
    to *filter* on `published`, not to rely on an ordered `break`.
  - **BUG-7b (count inflation):** `:219` increments `count` for every appended
    record, including records that `build_shards:149` then discards for having
    no `published`. The "N papers within retention window" log therefore
    over-reports.
  - **BUG-8 interaction: a failed category reports a normal count.**
    `iter_results` swallows `ArxivError` (`arxiv_common.py:58`), so
    `collect_papers` cannot distinguish "this category had 0 recent papers"
    from "the network failed mid-pagination". Both log the same cheerful
    `  %d papers within retention window for %s` line. With 5 categories, a
    partial outage silently produces a feed missing entire categories while
    still stamping `generatedAt` as fresh.
  - **Untested function.** `collect_papers` is the only network-touching
    function besides the client and has **zero** test coverage — not the
    retention `break`, not the `_result_datetime` `None` path, not the
    per-category loop, not `max_per_category` → `UNLIMITED` mapping (`:208`),
    not the cutoff computation.
  - **Un-injectable clock.** `cutoff` comes from `datetime.now(timezone.utc)`
    (`:207`) with no parameter, while `build_shards` *does* accept
    `generated_at`. Asymmetric, and it forces the `collect_papers` tests to be
    monkeypatched wholesale (which is why they don't exist).
  - `limit = max_per_category if max_per_category > 0 else UNLIMITED` (`:208`) —
    negative values silently mean "unlimited". Undocumented.
  - **No category validation.** `--category 'cs.CV foo'` or a category with a
    space/quote produces a malformed query that arXiv answers with an empty
    feed — indistinguishable from "no new papers".

### 2.3 Sharding, output, determinism

- `build_shards` (`:138-191`) — **deterministic.** Verified: two runs over the
  same records with a fixed `generated_at` produce byte-identical manifest and
  shard dicts. The mechanisms that buy this:
  - `sorted(groups, reverse=True)` (`:155`) — week keys are zero-padded
    (`W02`), so lexicographic == chronological. Correct.
  - `papers.sort(key=(published, id), reverse=True)` (`:157-160`) — the `id`
    tiebreaker is what makes same-timestamp batches stable. arXiv returns many
    papers with identical `published` seconds (visible in a live fetch), so
    without this the ordering would wobble run to run. Good.
  - `dedupe_records` returns insertion order (`:119-120, :135`), which is a
    function of the category iteration order — deterministic.
  - Non-determinism is confined to `generatedAt` (`:180`), which is wall-clock
    by design and the only thing that changes between two runs on identical
    input.
- **No seeds are needed** — there is no randomness anywhere in the Python
  pipeline. Recorded explicitly since the brief asked.
- `write_index` (`:235-245`) — **encoding is correct here**: `encoding="utf-8"`
  plus `ensure_ascii=False` (`:241, :244`) for both shards and manifest. This is
  the opposite of `paper-collector.py` (BUG-11).
  - Shards use `separators=(",", ":")` (`:241`) → compact, no pretty-printing.
    Good for payload size; means diffs are unreadable. Deliberate tradeoff.
  - Manifest uses `indent=2` (`:244`) while shards use compact — deliberate
    (manifest is the human-inspectable one).
  - **BUG-9: writes are not atomic.** Files are opened with `open(..., "w")`
    and streamed with `json.dump`. A crash, a `KeyboardInterrupt`, or a full
    disk leaves a **truncated** `index.json` or shard on the static host.
    `web/src/lib/paperIndex.ts:96-101` has to defend against exactly this
    ("The paper index is malformed and could not be parsed") — the symptom is
    already handled downstream, but the cause is preventable with
    write-to-temp + `os.replace`.
  - `_clean_old_shards` (`:224-232`) — correctly ordered *after* `makedirs` and
    *before* writes (`:237-238`). Regex `papers-\d{4}-W\d{2}\.json` is strict, so
    it correctly leaves `papers-2020-W1.json`, `papers-extra.json`,
    `papers-2020-W01.json.bak`, `notes.txt` alone (verified). Its `except OSError`
    → `warning` branch is untested.
  - **Failure mode:** it deletes first, writes second. If `write_index` dies
    between the two, the site loses shards that the still-present `index.json`
    references → 404s in `loadShard` (`paperIndex.ts:105-110`).
- `main` (`:278-305`) — refuses to write an empty index and returns `1`
  (`:289-291`), tested. `sys.exit(main())` at `:309` propagates the exit code
  correctly.
  - **BUG-10: no error handling around the write.** Verified: an unwritable
    `--out-dir` propagates a bare `OSError: [Errno 30] Read-only file system`
    traceback out of `main()` instead of `logging.error(...)` + `return 1`.
    Every CLI arg is unvalidated: `--retention-days -1` and `0` are accepted
    (and make the cutoff now-or-future, so the retention `break` fires on the
    first result → zero records → confusing exit 1); `--abstract-chars -3` is
    accepted and silently disables truncation; `--max-per-category -9` is
    accepted and means unlimited; `--out-dir /proc/nope/deep` is accepted.
  - **BUG-8 (manifest integrity): `manifest["categories"]` (`:187`) is echoed
    from the CLI args, and `retentionDays` (`:186`) from the flag — neither is
    verified against what was actually fetched.** Combined with the swallowed
    errors above, the manifest asserts full coverage it does not have, and the
    app displays it as authoritative (`App.tsx:199`, `:390`, `:398`).
  - `--out-dir` default `DEFAULT_OUT_DIR = "web/public/data"` (`:34`) is
    **relative to CWD**, so running from anywhere but the repo root writes to a
    stray `./web/public/data` that nothing deploys. Same class of bug as the
    CSV path in `paper-collector.py:138`. The default is never exercised by a
    test.

### 2.4 Interaction with the web app

Wiring is correct: `write_index` emits `index.json` + `papers-<YYYY>-W<NN>.json`
into `web/public/data/`, which `vite.config.ts` copies into `web/dist/`, which
`upload-pages-artifact` publishes, which `paperIndex.ts:30-33` fetches via
`${BASE_URL}/data`. The manifest/shard/paper shapes match `types.ts` field for
field. `web/.gitignore` and the root `.gitignore` both exclude `public/data`,
so the index is build-artifact-only — consistent with `deploy.yml:33` building
it before `npm run build`. **One gap:** the Python side has no test asserting the
serialized JSON matches `types.ts`; the two can drift silently.

---

## 3. `scripts/paper-collector.py` — legacy HTML feed CLI

**Intent.** The original one-shot tool (`readme.md:71-72`): query arXiv, dump a
static HTML file into `results/`, independent of the web app.

### Findings

- **BUG-1 (highest severity): `--download-pdfs` and `--download-sources` crash
  on the installed `arxiv` version.** `requirements.txt:1` pins only
  `arxiv>=2.1.0`, which resolves to `arxiv 4.0.1`. In arxiv 4.x,
  **`Result.download_pdf` and `Result.download_source` no longer exist** —
  verified from the library source and live: `hasattr(result, "download_pdf")`
  is `False`, and calling it raises
  `AttributeError: 'Result' object has no attribute 'download_pdf'`.
  `paper-collector.py:75` and `:77` call them. The `except` at `:80` catches
  `(arxiv.ArxivError, OSError, tarfile.TarError)` — **`AttributeError` is none
  of those**, so it escapes and aborts the whole run on the *first* result. Both
  flags are documented as supported (`readme.md:101-102`), so this is a
  documented feature that is 100% broken and untested. Replacement APIs exist:
  `result.pdf_url` + `result.source_url()` (verified present in 4.0.1).
- **BUG-2 (path traversal): `safe_filename` (`:21-23`) is not a sanitizer.**
  It replaces `\ / : " * ? < > |` but not `.`, so verified results:
  `safe_filename("..") == ".."`, `safe_filename(".") == "."`,
  `safe_filename("../../etc") == ".._.._etc"`. The slug is then used as a
  **directory name** at `:79`, `extractall(f"./extracted/{title_slug}")` — so a
  paper titled `..` extracts its LaTeX into the repository root
  (`./extracted/..` → `.`). No arXiv title has done this yet, but titles are
  attacker-influenced via submission. Also: no length cap (a 400-char title
  yields a 400-char filename, over the 255-byte ext4/APFS limit), no
  reserved-name handling (`CON`, `PRN`), and `.`/`..` are not rejected.
- **BUG-11 (`UnicodeEncodeError` under a non-UTF-8 locale).** `open(filename, "w")`
  at `:143` passes no `encoding=`. Verified: with `LANG=C LC_ALL=C
  PYTHONCOERCECLOCALE=0`, writing a feed containing a non-ASCII title raises
  `UnicodeEncodeError: 'ascii' codec can't encode character '\xe9'`. macOS hides
  this because PEP 538 locale coercion silently upgrades `C` to `C.UTF-8`;
  Docker images and bare containers do not. `build_index.py:240,243` passes
  `encoding="utf-8"` — the two writers disagree. (`df.to_csv` at `:138` is fine;
  it defaults to utf-8.)
- **BUG-12: the CSV ignores `--output-dir`.** `:138` writes
  `df.to_csv(topic + "_papers.csv")` relative to **CWD**, while the HTML at
  `:142` honors `--output-dir`. So `--save-csv --output-dir /tmp/out` silently
  drops the CSV in wherever the user happened to be. `readme.md:103` documents
  `--save-csv` without noting this.
- **BUG-13: the raw `--topic` is embedded in both output paths with no
  sanitization.** `:138` and `:142`. Verified consequences:
  - `--topic 'cat:cs.CV AND (a/b)'` → filename
    `results/cat:cs.CV AND (a/b)-200_papers_extracted_on_...html` →
    `FileNotFoundError`, because the intermediate directory
    `results/cat:cs.CV AND (a)` does not exist (`os.makedirs` at `:141` only
    creates `results`).
  - `--topic '../../escape'` → the HTML is written *outside* `results/`.
  - `--topic 'cat:cs.CV AND "3d reconstruction"'` (the exact example in
    `readme.md:83`!) produces a filename containing `:` and `"` — legal on
    macOS/Linux, **illegal on Windows**, and unreadable everywhere.
  `safe_filename` exists in the file and is applied only to PDF/tar names (`:72`),
  never to the output filenames.
- **BUG-14: exit code is always 0.** `:149` calls `main()` bare, discarding the
  return value, unlike `build_index.py:309`'s `sys.exit(main())`. A run that
  fetched nothing still reports success, so nothing in CI or a shell wrapper
  can detect failure.
- **BUG-15: `pdf_url` may be `None` → crash in `build_html_feed`.** `:111`
  `html.escape(df["URL"][i])` raises `AttributeError: 'NoneType' object has no
  attribute 'replace'` when `result.pdf_url` is `None` (a documented `str | None`
  in arxiv 4.0.1). Verified.
- **BUG-16: malformed HTML.** `build_html_feed` emits `<html>`/`<head>…</head>`
  at `:88-107`, then `</body></html>` at `:119-121` — but **`<body>` is never
  opened**. Verified via tag scan: opens `['html','head']`, closes
  `['head','body','html']`. Browsers recover, but the output is invalid and
  would fail any validator. Also `<title>Mathedemo</title>` (`:91`) is a
  placeholder that was never updated.
- **BUG-17: silently ignores `--max-papers <= 0`.** `iter_results`
  short-circuits (`arxiv_common.py:37-38`) → empty DataFrame →
  `build_html_feed` writes a 564-byte HTML file with zero papers and prints
  `"... file saved!"`. No error, no non-zero exit. Verified.
- **`sys.exit` / `KeyboardInterrupt`:** no handler anywhere. Ctrl-C during
  `fetch_papers` discards the entire DataFrame (nothing is written, since
  `main` only writes after the full fetch completes) and prints a traceback.
  For a 1000-paper fetch with `--download-sources` that is a lot of lost work.
- **No bare `except:` and no bare `except Exception:`** — the one handler at
  `:80` is narrowly typed, which is good. But it is **too narrow** (BUG-1) and
  it conflates *download* failure with *source-extraction* failure: if
  `download_pdf` raises, `download_sources` is skipped for that paper, and the
  record is still appended (`:82`), so the log gives no indication that a paper
  is partially fetched.
- **`tarfile.extractall` at `:78-79` passes no `filter=`.** On Python ≤3.11 the
  default is fully permissive (absolute paths and symlinks escape the target).
  On 3.12+ it emits a `DeprecationWarning`; on 3.14 the default is `data`,
  which silently strips absolute paths (verified: an absolute-path member was
  dropped, no error). Since `.github/workflows/ci.yml:14` uses
  `python-version: "3.x"` (unpinned), the safety of this line depends on the
  runner's Python. `tarfile.FilterError` does subclass `TarError`, so the
  strict-mode failures *are* caught at `:80` — but only on 3.12+.
- **The downloaded `.tar.gz` is never deleted** after extraction (`:77-79`), so
  `--download-sources` accumulates N multi-MB archives in the CWD alongside
  `./extracted/`. Both paths are CWD-relative, not `--output-dir`-relative.
- **HTML injection is properly handled** (`:109-118`): `html.escape` with the
  default `quote=True` covers `'` and `"`, and the `href` uses single quotes,
  so attribute breakout is closed. Tested
  (`test_paper_collector.py:35-44`). This was a genuine prior fix.
- **Collected-but-unused fields:** `Id`, `Authors`, `Primary_category`,
  `Categories`, `Links` are put in the DataFrame (`:64-70`) and written to the
  CSV but never rendered in the HTML. Dead weight for the HTML path.
- **Dependency-shape coupling:** the record is built as a dict then handed to
  `pd.DataFrame` (`:61-84`) purely so `build_html_feed` can use
  `df["Title"][i]` positional indexing (`:109-111`). With `pandas 3.0.6` this
  still works (RangeIndex), but it is the fragile chained-`__getitem__` pattern
  that pandas 3 has been deprecating in favour of `.iloc`. Verified working
  today; a pandas upgrade is a live hazard. And the whole DataFrame is
  unnecessary — a list of dicts would remove both the pandas import and the
  fragility. (An *empty* `pd.DataFrame([])` has no columns, so an empty run
  silently produces a zero-paper feed rather than an error — verified.)

### Data output produced by this tool

| Path | Encoding | Sort | Deterministic? |
| --- | --- | --- | --- |
| `<output-dir>/<topic>-<N>_papers_extracted_on_<MM-DD-YYYY-HH-MM-SS>.html` | locale default (**BUG-11**) | arXiv order (newest-first from the API) | **No** — the `datetime.now()` prefix at `:140` changes every run. Also local *naive* time, not UTC, unlike `build_index.py`. |
| `./<topic>_papers.csv` (CWD, **BUG-12**) | utf-8 (pandas default) | same | No (same timestamp-free name, so it *overwrites* the previous run silently). |

`.gitignore:6-7` excludes `results/*.html` and `results/*.csv` (keeping
`.gitkeep`), so none of this is committed. Note the CSV written to CWD is
**not** covered by that ignore rule — it will show up as untracked in
`git status` at the repo root.

---

## 4. `notebooks/paper-collector.ipynb`

**Verdict: yes, it duplicates essentially all of the script's logic, and it is
stale, buggy, and partially broken.** It is a fork of a pre-`arxiv_common`
version of `paper-collector.py` and none of the subsequent fixes were ported.

| Cell | Duplicates | Stale/broken |
| --- | --- | --- |
| 2 (`:7-12`) | `paper-collector.py:36-54` flags | constants only, no CLI |
| 5 (`:38-42`) | `arxiv_common.build_client` | re-implements the client inline instead of importing `arxiv_common` |
| 5 (`:45-47`) | `arxiv_common.iter_results` | **BUG-9: `arxiv.Search(...)` omits `max_results`, so arxiv defaults it to 100.** `MAX_PAPERS_TO_PULL = 1000` and the `if len(all_data) >= MAX_PAPERS_TO_PULL: break` at `:66-67` is therefore **unreachable** — the run always stops at 100 papers. This is precisely the regression `arxiv_common.py:43-45` documents and fixes; the notebook still has it. |
| 5 (`:59-63`) | `fetch_papers` download block | **BUG-1:** calls `result.download_pdf` / `download_source` → `AttributeError` on arxiv 4.x, and it is **not wrapped in `try`** at all, so it kills the kernel. Uses **raw `result.title`** as the filename with no `safe_filename` → immediate crash on any title containing `/ : * ? " < > \|` (BUG-2 in its worse form). Never closes the tarfile on the exception path (`:62-64` closes it only on success). |
| 7 (`:111-115`) | `build_html_feed` | **BUG-16 in full plus unfixed XSS:** `df["Title"][i]` and `df["Summary"][i]` are interpolated into HTML with **no `html.escape`**. The script added escaping (`paper-collector.py:109-118`); the notebook did not. |
| 7 (`:103`) | MathJax CDN | `src="http://cdnjs.cloudflare.com/..."` — **plain HTTP**, mixed-content blocked on HTTPS. The script uses `https://` (`paper-collector.py:103`) and `test_paper_collector.py:46-49` asserts it. The notebook regressed (or was never fixed) and **no test covers the notebook**. |
| 7 (`:120`) | `main()` output | hardcodes `'results/'` and **never creates it** → `FileNotFoundError` if the directory is absent. The script uses `os.makedirs` (`:141`). Only works today because `.gitkeep` is committed. |
| 7 (`:73`) | — | `pd.DataFrame(all_data, columns=column_names)` with `all_data == []` → no columns → `df["Title"]` raises `KeyError`. |
| 4 (`:15`) | — | `import numpy as np` — never used. |
| 3 (`:22-23`) | `paper-collector.py:140` | `datetime.now()` naive local time, same non-determinism. |
| 1 (`:2-3`) | `arxiv_common.py:13` | second `logging.basicConfig` at notebook scope. |

**Does it run?** Only on the happy path with `DOWNLOAD_PAPER=False` /
`DOWNLOAD_RESOURCES=False` (the shipped defaults, `:8-9`), `results/` present,
and an ASCII-only result set — and even then it silently collects **100**
papers while the UI implies 1000. Toggling either download flag kills the kernel
on arxiv ≥ 4. It has no `requirements.txt` story of its own (it uses `numpy`,
which is only a transitive pandas dependency, not declared in
`requirements.txt`).

**`readme.md:115-118` actively directs users to it** ("A Jupyter notebook
version of the same workflow"), which is currently misleading.

---

## 5. Reproducibility summary

- **Seeds:** none needed — there is no `random`, `numpy.random`, `shuffle`, or
  sampling anywhere in `scripts/` or the notebook.
- **`build_index.py` output is deterministic** given fixed records and
  `generated_at` (verified byte-identical across two runs). The only wall-clock
  input is `generatedAt` (`:180`), by design.
- **Ordering hazards that were correctly handled:** the
  `(published, id)` sort key (`:157-160`) is essential — a live fetch showed
  many papers sharing an identical `published` second, so a `published`-only
  sort would wobble between runs.
- **`paper-collector.py` output is not deterministic** (`datetime.now()`
  filename prefix, `:140`), and uses naive local time rather than the UTC used
  by `build_index.py`.
- **`BUILD_INDEX_OUT` is not reproducible across time** even in principle: it
  queries the live arXiv API, and papers are published/updated/withdrawn
  continuously. There is no snapshot/caching layer and no recorded fetch
  timestamp per record.
- **Live environment drift is unmanaged:** no lockfile and no upper bounds in
  `requirements.txt`, which is how `arxiv` 4.x landed and broke BUG-1.

---

## 6. Tests: asserted vs. untested

### What is asserted (27 tests)

| Area | Tests | Notes |
| --- | --- | --- |
| `iter_results` | `test_arxiv_common.py:67-100` (5) | max_results passthrough, `None` → default page size, stop-at-N, non-positive short-circuit, error tolerance |
| `truncate_abstract` | `test_build_index.py:43-54` (2) | short + long |
| `format_authors` | `:58-67` (2) | cap/`et al.`, short list |
| `arxiv_id_from_entry` | `:71-81` (2) | version strip, no version |
| `iso_week_key` | `:85-89` (2) | normal, year boundary |
| `dedupe_records` | `:93-112` (2) | cross-list merge, first-seen metadata |
| `build_shards` | `:130-159` (4) | manifest shape, newest-first shards, bounds/filenames, intra-shard sort |
| `record_from_result` | `:163-185` (1) | full public shape, 9 authors, truncation |
| `write_index` | `:189-211` (1) | writes + removes stale shards |
| `main` | `:215-249` (2) | refuses empty (exit 1), writes on success |
| `safe_filename` | `test_paper_collector.py:23-31` (2) | illegal chars stripped, normal title untouched |
| `build_html_feed` | `:35-49` (2) | HTML escaping, https MathJax |

The pure helpers are genuinely well covered — this is the strongest part of the
Python codebase. `build_index.py`'s module docstring (`:11-13`) says this was
deliberate and it worked out.

### Mocking approach

- Modules are loaded by **file path** via `importlib.util.spec_from_file_location`
  (`test_build_index.py:13-20`, `test_paper_collector.py:12-19`,
  `test_arxiv_common.py:11-18`) rather than imported, because
  `scripts/paper-collector.py` has a **hyphen in its filename** and is
  therefore not importable as a normal module. Three copies of the same
  `load_module()` helper.
- `test_arxiv_common` swaps the whole `arxiv` module for a `SimpleNamespace`
  and stubs `build_client` (`:49-65`), restoring both in `tearDown` (`:45-47`).
- `build_index.collect_papers` is monkeypatched with a lambda in `MainTests`
  (`:219, :238`) with manual `try/finally` restore.
- Consequence: **no test ever exercises the real `arxiv` library.** I verified
  the live library separately and it works (`iter_results("cat:cs.CV", 2)`
  returned 2 records), but that is not in CI. In particular
  `test_arxiv_errors_terminate_iteration_without_raising` asserts against
  `FakeArxivError`, **not** against `arxiv.ArxivError`, so if upstream renamed
  or restructured its exception hierarchy the test would still pass. (I did
  confirm `arxiv.HTTPError` and `arxiv.UnexpectedEmptyPageError` both still
  subclass `ArxivError` in 4.0.1 — but nothing in CI would catch it if they
  stopped.)

### Untested (gaps)

- **`collect_papers`** — the entire function. Retention `break`, cutoff
  computation, `max_per_category` → `UNLIMITED` mapping, per-category loop,
  `_result_datetime` `None` path, the misleading count log.
- **`fetch_papers`** in `paper-collector.py` — the entire function, including
  the BUG-1 crash path and the download `try` block.
- **`main()` in `paper-collector.py`** — argparse, the CSV path bug (BUG-12),
  the filename-sanitization bug (BUG-13), the missing `sys.exit` (BUG-14).
- **`iso_date`** — all four branches (`datetime` tz-aware, naive, `date`,
  `None`, string).
- **`collapse_whitespace`** — never directly.
- **`truncate_abstract`** with `max_chars <= 0` (the silent no-op).
- **`format_authors`** with plain strings, `None`, `[]`, and the
  `name`-is-`None` fallback (BUG-6).
- **`arxiv_id_from_entry`** with `""` and with legacy-style IDs (BUG-5).
- **`_clean_old_shards`** — the regex's near-misses and the `except OSError`
  warning branch.
- **`write_index`** — non-ASCII output (`ensure_ascii=False`), the compact
  separators, atomicity.
- **`MainTests` never asserts the arguments passed to `collect_papers`** — the
  stub is `lambda *args, **kwargs` (`:219`), so a regression that passes the
  wrong `retention_days`/`abstract_chars` through `main` is invisible.
- **`--category` override** (`parse_args`, `:271-274`) — `args.categories or
  DEFAULT_CATEGORIES` (`:280`) has no test.
- **Schema contract between Python output and `web/src/lib/types.ts`** — no
  cross-check exists.
- **The notebook** — zero tests, zero CI.
- **No test asserts determinism** (two identical runs → identical bytes) even
  though determinism was an explicit design goal (`build_index.py:157-160`).

### Flakiness risk: **low**

No network, no real clock assertions (every timestamp in tests is a literal
`datetime`), no shared mutable global state beyond the two monkeypatches that
are both restored in `finally`/`tearDown`, no parallelism, no ordering
dependence (unittest sorts test ids). The only latent flake is
`test_refuses_to_write_an_empty_index`, which writes
`ERROR:root:No papers fetched...` to stderr mid-run — noisy but harmless.
Two style nits: `import tempfile` is repeated *inside* four test methods
(`test_build_index.py:190, 216, 231`) instead of at module top, and
`test_paper_collector.py:47` exceeds typical line length.

---

## 7. Error-handling & hygiene roll-call

| Location | Issue |
| --- | --- |
| `arxiv_common.py:58-59` | Swallows `arxiv.ArxivError` → silent partial results (BUG-8). No distinction between "done" and "gave up". |
| `arxiv_common.py:13` | `logging.basicConfig` at import time; duplicated in 3 modules. |
| `paper-collector.py:18` | Third `logging.basicConfig`; mixes `print()` (`:135, :145`) with `logging`. |
| `paper-collector.py:80` | `except` too narrow (misses `AttributeError` → BUG-1) and too broad in intent (conflates download + extract). |
| `paper-collector.py:143` | `open(..., "w")` with no `encoding` (BUG-11). |
| `paper-collector.py:149` | `main()` return value discarded → always exit 0 (BUG-14). |
| `build_index.py:40` | `logging.basicConfig` with a custom format at import time. |
| `build_index.py:298` | `write_index` unguarded → raw `OSError` traceback (BUG-10). |
| `build_index.py:237-244` | Non-atomic writes (BUG-9). |
| `build_index.py:26`, `paper-collector.py:11` | `sys.path.insert(0, ...)` at import time — global import-state mutation as a side effect; grows `sys.path` on every re-load. |
| all three | No `KeyboardInterrupt` handler anywhere; no cleanup of partially written output. |
| all three | No `--version`, no `--verbose/--quiet`, no `--log-level`; CI gets INFO-level noise interleaved with progress `print()`. |
| CLI args | **Zero validation** anywhere: `--max-papers`, `--retention-days`, `--abstract-chars`, `--max-per-category`, `--out-dir`, `--output-dir`, `--category`, `--topic`. |
| Bare `except:` | **None found** — good. `pyflakes` is clean. |

---

## 8. Dead code

- `arxiv_common.py:51, 55-57` — the `yielded` counter/`break` is redundant with
  arxiv's own `islice` (verified).
- `paper-collector.py:64, 66-70` — `Id`, `Primary_category`, `Categories`,
  `Links` are collected and CSV-exported but never rendered.
- `paper-collector.py:14` — the `pandas` dependency exists only so
  `build_html_feed` can use `df[col][i]`; a plain list of dicts removes it.
- `paper-collector.py:12` `html` is used; `paper-collector.py:7` `sys` used at
  `:11`. Both fine.
- `notebooks/paper-collector.ipynb:15` — `numpy` imported, never used.
- `notebooks/paper-collector.ipynb:66-67` — the `MAX_PAPERS_TO_PULL` break is
  unreachable (100-result cap).
- `build_index.py:189` `totalPapers` is derived from shard counts — correct, and
  the architect report notes the UI does not use `retentionDays`/`week`/`count`.
- `scripts/__pycache__/` and `tests/__pycache__/` exist on disk but are
  correctly gitignored (`.gitignore:4`); nothing stale is tracked.

---

## 9. Candidate improvements (concrete, ordered by value)

1. **Fix the `--download-pdfs` / `--download-sources` crash** —
   `scripts/paper-collector.py:75,77`. arxiv ≥ 4 removed
   `Result.download_pdf` / `Result.download_source`; replace with `result.pdf_url`
   and `result.source_url()` fetched via `requests`, and widen the handler at
   `scripts/paper-collector.py:80` (or catch `Exception` around the optional
   download block so a missing API can never abort the run). Pin the upper bound
   in `requirements.txt:1` meanwhile.
2. **Constrain dependencies** — `requirements.txt:1-2`. Add upper bounds
   (`arxiv>=2.1.0,<5`, `pandas>=2.0.0,<4`) or commit a lockfile. Add a CI smoke
   test that imports `arxiv` and asserts `hasattr(arxiv.Result, "pdf_url")`, so
   an upstream API break fails loudly in `ci.yml` instead of in production.
3. **Sanitize the output filename** — `scripts/paper-collector.py:142,138`.
   Apply `safe_filename` (and a length cap + `.`/`..` rejection) to the topic
   before interpolating it into the HTML/CSV paths, write the CSV under
   `--output-dir`, and stop writing it relative to CWD.
4. **Reject non-positive `--max-papers`** — `scripts/paper-collector.py:36,127`.
   Today `-1` produces an empty feed and a success message; raise
   `parser.error(...)`. Same for `--retention-days < 1`,
   `--abstract-chars <= 0`, and `--max-per-category < 0` in
   `scripts/build_index.py:256-269`.
5. **Add `encoding="utf-8"` to every text write** — `scripts/paper-collector.py:143`
   (and pass `encoding="utf-8"` to `to_csv` at `:138` for symmetry with
   `scripts/build_index.py:240,243`).
6. **Return a non-zero exit code from `paper-collector.py`** —
   `scripts/paper-collector.py:148-149`. Use `sys.exit(main())` and return `1`
   when zero papers were fetched, mirroring `scripts/build_index.py:289-291,309`.
7. **Stop mutating the caller's input in `dedupe_records`** —
   `scripts/build_index.py:127`. Use
   `dict(record, categories=list(record.get("categories") or []))`; add an
   assertion to `tests/test_build_index.py:93` that the input list is unchanged.
8. **Make retention a filter, not only an ordered `break`** —
   `scripts/build_index.py:216-217`. A non-`datetime` `published` currently
   bypasses the window entirely and produces a `papers-2001-W01.json` shard.
   Apply an explicit post-fetch `if published is None or published < cutoff:
   continue` (or a parallel filter in `build_shards`) and only then count, so
   `scripts/build_index.py:219` stops over-reporting records that
   `scripts/build_index.py:149` discards.
9. **Preserve legacy arXiv ID prefixes** — `scripts/build_index.py:69-74`.
   `hep-th/9901001` and `math/9901001` both collapse to `9901001` and silently
   merge two different papers in `scripts/build_index.py:117-135`. Use the
   prefix-aware parse (or arxiv's `Result.get_short_id()`), and add a regression
   test next to `tests/test_build_index.py:71`.
10. **Make the manifest honest about coverage** — `scripts/build_index.py:186-187`
    and `:203-221`. Track per-category success/failure, and either exclude failed
    categories from `manifest["categories"]` or add a `degraded`/`partial` flag,
    so the UI does not present a partial feed as complete. Related: have
    `iter_results` distinguish exhaustion from failure
    (`scripts/arxiv_common.py:58-59`) — e.g. yield a sentinel or return
    `(results, error)`.
11. **Write the index atomically** — `scripts/build_index.py:237-245`. Write to
    `*.tmp` and `os.replace()` each shard and `index.json` last, after
    `_clean_old_shards` has succeeded. This removes the truncated-`index.json`
    case that `web/src/lib/paperIndex.ts:96-101` currently has to defend against.
12. **Add a request timeout** — `scripts/arxiv_common.py:20-26`. arxiv 4.0.1 calls
    `requests.Session.get()` with no `timeout`, so a hung connection stalls CI
    indefinitely. Attach a session with a timeout (or wrap the loop with a
    watchdog) and retry `requests.exceptions.Timeout`.
13. **Guard `format_authors`' `str(author)` fallback** —
    `scripts/build_index.py:60`. It can emit `<module.X object at 0x7f…>`
    (memory address) into `paper.authors`, breaking byte-reproducibility. Skip
    authors whose name cannot be resolved instead of stringifying them.
14. **Cover the untested functions** — add tests for `collect_papers`
    (`scripts/build_index.py:203`) with an injected clock and a fake
    `iter_results`, for `iso_date`'s four branches (`scripts/build_index.py:77`),
    for `truncate_abstract` with `max_chars <= 0` (`scripts/build_index.py:51`),
    for `format_authors` with plain strings and `None`
    (`scripts/build_index.py:56`), and for `fetch_papers`
    (`scripts/paper-collector.py:58`). Also assert the arguments `main` passes to
    `collect_papers` in `tests/test_build_index.py:215-249`.
15. **Anchor the mocking to the real `arxiv` exception types** —
    `tests/test_arxiv_common.py:21-24`. The suite currently substitutes
    `FakeArxivError`, so it cannot detect an upstream change to
    `arxiv.ArxivError`'s hierarchy. Assert `issubclass` against the real classes
    in an added test.
16. **Delete or repair the notebook** — `notebooks/paper-collector.ipynb`.
    It silently collects 100 instead of 1000 (`:45-47`), lacks HTML escaping
    (`:111-115`), uses plain-HTTP MathJax (`:103`), crashes on any download flag
    (`:59-63`), writes raw titles as filenames, and hardcodes an uncreated
    `results/` (`:120`). Either delete it and drop `readme.md:115-118`, or make
    it a 5-line `import paper_collector` wrapper over the CLI.
17. **Sanitize `tarfile.extractall`** — `scripts/paper-collector.py:78-79`. Pass
    `filter="data"` explicitly (the safe default only landed in Python 3.14, and
    CI uses an unpinned `3.x`), and delete the `.tar.gz` after extraction so
    `--download-sources` does not accumulate archives in CWD.
18. **Handle `pdf_url is None`** — `scripts/paper-collector.py:111` crashes with
    `AttributeError`; also emit `absUrl` as a fallback link. Align
    `paper["pdfUrl"]` (`scripts/build_index.py:113`) with
    `web/src/lib/types.ts` by declaring it `string | null`.
19. **Enforce absolute output paths** — `scripts/build_index.py:34` and
    `scripts/paper-collector.py:40`. Both defaults are CWD-relative, so running
    outside the repo root writes a stray `web/public/data` / `results` that
    nothing deploys. Resolve defaults against the repo root derived from
    `__file__`.
20. **Add static analysis to CI** — `.github/workflows/ci.yml:20`. There is no
    `ruff`/`mypy`/`pyproject.toml` anywhere, so the Python side has no lint gate
    while the web side runs `tsc --noEmit`. Add `ruff check` (it will pass today —
    `pyflakes` is clean) plus `mypy --strict` on `scripts/`.
21. **Fix the malformed HTML and stale title** —
    `scripts/paper-collector.py:88-121` closes `</body>` without ever opening
    `<body>`, and `:91` still says `<title>Mathedemo</title>`.
22. **Remove import-time global side effects** — `scripts/arxiv_common.py:13`,
    `scripts/paper-collector.py:11,18`, `scripts/build_index.py:26,40`. Use
    `logging.NullHandler()` in the shared module and a single `basicConfig` in
    each `__main__`; make `scripts/` a real package so the
    `sys.path.insert` hack (and the three duplicated `load_module()` helpers in
    `tests/`) can go away. Renaming `paper-collector.py` → `paper_collector.py`
    would remove the `importlib`-by-path loaders entirely.
23. **Add a `KeyboardInterrupt` handler that preserves partial work** —
    `scripts/paper-collector.py:125-145` currently throws away the entire
    DataFrame on Ctrl-C; `scripts/build_index.py:237-245` can leave a half-written
    index. Wrap both, and consider checkpointing the DataFrame.
24. **Reduce `DEFAULT_DELAY_SECONDS`** — `scripts/arxiv_common.py:16` uses 10s
    where arXiv's ToU asks for ≥3s, tripling CI runtime for no compliance gain.
    Make it a CLI flag / env var and default to 3-5s.
25. **Add a determinism regression test** — `tests/test_build_index.py:115`.
    `build_shards` is deterministic by design (`scripts/build_index.py:157-160`)
    but nothing asserts it; add a test that two `build_shards` + `write_index`
    runs over the same records (with a fixed `generated_at`) produce identical
    bytes, and one that generates non-ASCII titles to lock in the
    `ensure_ascii=False` encoding.