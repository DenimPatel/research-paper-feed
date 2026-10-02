# Regression Sweep 2 — `fc77a40..b01bf39`

**Date:** 2026-10-02
**Range:** 27 commits after the backlog commit `fc77a40`, covering IMP-001, -002, -003, -004,
-005, -007, -008, -009, -010, -012, -023, -024, -143, -151, -154 and the regression-1
null-URL data-loss fix (`7a2ed82`).
**VERDICT: CLEAN on all behaviour.** No test, typecheck, build, runtime, contract, CLI or
layout regression was found. Three low-severity **hygiene defects** were found in tracked
non-code files (§8) — they do not affect the product but should be cleaned up.

---

## 1. Suites — exact results

| Command | Result | Expected | Verdict |
| --- | --- | --- | --- |
| `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | `Ran 53 tests ... OK` | 53 OK | pass |
| `cd web && npm run typecheck` | clean (`tsc --noEmit`, no output) | clean | pass |
| `cd web && npm test` | `Test Files 10 passed (10)` / `Tests 160 passed (160)` | 160 across 10 files | pass |
| `cd web && npm run build` | `✓ built in 1.22s`, `dist/index.html 0.46 kB` | clean | pass |
| `npm test` × **8** consecutive runs | 8/8 → `10 passed / 160 passed` | no flakes | pass |
| `npm test` (final re-run) | `10 passed / 160 passed` | pass | pass |

### Comparison against `.improve/REPO_PROFILE.md`

* **Web pre-existing failure list: empty.** The profile records no failing web test at
  baseline, and there is none now. The only four console lines vitest emits are
  `LocalStorage is not available in this environment` (×2, from jsdom, expected) and
  `--localstorage-file requires global` ×2. The latter is a **Node 25 artifact of this
  machine**, not a code defect: `web/package.json` has no `engines` field, CI pins
  `node-version: 20`, and this host runs Node v25.6.1. No test failure results.
* **CSS bundle size is byte-identical to baseline**: `dist/assets/index-*.css` = 10.93 kB
  before and after (baseline recorded 10.93 kB). This is strong evidence that IMP-012's
  one-token `--text-muted` change introduced no cascade side effects.
* JS bundle grew 163.72 kB → 166.32 kB, expected: the new `resolveCategories`,
  `rankPapers` and `isHttpUrl` exports plus the new test-setup module.

### Other interpreters (oldest Python CI supports)

`.github/workflows/ci.yml` declares **no matrix** — a single floating `python-version: "3.x"`,
so there is no pinned floor and CI's "oldest" is whatever `3.x` resolves to at run time. The
codebase nevertheless has to survive older interpreters, so every interpreter present on this
host was exercised. `arxiv`/`pandas` are installed **only** under `/usr/local/bin/python3.11`
(the sole interpreter in the profile's CI section), so on the others the 20
`test_paper_collector.py` tests error on `import pandas` from a NumPy ABI mismatch — that is
my `PYTHONPATH` shim, **not** a code regression. The other **33 tests** import cleanly and pass:

| Interpreter | Result |
| --- | --- |
| `/opt/homebrew/bin/python3.8` (3.8.19) | `Ran 33 tests ... OK` |
| `/usr/local/bin/python3.11` (3.11.15) | `Ran 53 tests ... OK` |
| `/opt/homebrew/bin/python3.12` (3.12.14) | `Ran 33 tests ... OK` |
| `/opt/homebrew/bin/python3.13` (3.13.9) | `Ran 33 tests ... OK` |
| `/opt/homebrew/bin/python3.14` (3.14.2) | `Ran 33 tests ... OK` |

IMP-024's `tarfile` gate is a `sys.version_info` comparison, and both branches are exercised
by unit tests, so the fallback is covered even though no interpreter available here is old
enough to need it.

---

## 2. Bisect

Not applicable — **no failure was found, so nothing was bisected and no scratch worktree was
created.** (`git worktree list` at the end of the sweep shows only the main checkout and the
pre-existing `.kilo/worktrees/mildly-income`, which I did not read or modify.)

---

## 3. Playwright sweep — 1280px and 390px

Served from a **production build**: `cd web && npm run build` then `npm run preview --port 4183`
(readiness-probed). The *index-unavailable* state cannot be produced on a build that has data,
so a **second server on :4184** served a copy of `web/dist` with `data/` removed (staged under
`/tmp`, the repo was never touched). Both servers were stopped at the end; the temporary
`.playwright-mcp/` scratch directory was removed after the screenshots were relocated.

### Feed states — all correct

| State | Hash | Result |
| --- | --- | --- |
| default | *(none)* | 2812 papers, Newest, 60 days, All+all 5 categories pressed |
| sort Newest | `#sort=newest` | Newest pressed; Relevance `[disabled]` while query empty |
| sort Relevance | `#q=3d+reconstruction&sort=relevance` | Relevance pressed, **hint removed**, 39 matches, no Load-more (39 < 50) |
| recency 7 / 30 / 60 | `#recency=7` / `30` / `60` | 7 days is the default; index spans 2026-09-24→10-01 so 2812/2812/2812 is arithmetically correct |
| search query | `#q=transformer` | filters correctly |
| zero-match search | `#q=zzzznotathing` | 0 cards, correct empty state |
| whitespace-only query | `#q=+++` | 0 matches? No — **50 cards, unfiltered**, `Relevance[disabled]`, `sort` stripped from hash. Whitespace is treated as "no query" consistently in chip state, hash and count. |

### Category states — all correct (IMP-009 + IMP-010 interaction)

| State | Hash | Result |
| --- | --- | --- |
| none selected | *(deselect all 5 via chips)* | `#cat=` written, "No categories selected" + **Select all categories** |
| some selected | `#cat=cs.CV,cs.LG` | only cs.CV + cs.LG pressed, All unpressed |
| ALL selected | `#cat=cs.CV,cs.LG,cs.CL,cs.AI,cs.RO` | All pressed |
| `#cat=` empty | `#cat=` | "No categories selected" panel — **WEB-17 closed** |
| partial intersection | `#cat=cs.CV,cs.BI` | banner "**1 unknown category: cs.BI** (cs.CV)"; cs.CV stays selected; 50 cards; All unpressed |
| unknown only | `#cat=cs.BI` | banner "**Unknown category: cs.BI**"; nothing selected; "No categories selected" + "Select all categories" |
| single valid | `#cat=cs.CV` | All unpressed, cs.CV pressed, 2812 papers (all papers carry cs.CV) |

**Reversibility chain, exercised step by step** (IMP-010), hash verified after every click:

```
#cat=cs.BI → [Reset category filter] → #cat=  (none selected)
           → [All]                  → #cat=cs.CV,cs.LG,cs.CL,cs.AI,cs.RO
           → [cs.CV] [cs.LG] [cs.CL] [cs.AI] → #cat=cs.RO   → [cs.RO] → #cat= (none)
           → [Select all categories] → #cat=cs.CV,cs.LG,cs.CL,cs.AI,cs.RO
           → [All] (no-op)          → #cat= (correct: isFullSelection sees a full set)
#cat=cs.CV,cs.BI → [Keep only indexed categories] → #cat=cs.CV → [cs.CV] → #cat= (empty)
```

Every step is exactly reversible in both directions.

### Collections — empty / populated / multiple

Empty state, 3 created collections, `spaced` (from `"  spaced  "`, trimmed), save-to-collection
via the `<details>` checkbox, untoggle, and Export enablement were all exercised. Counts and
card lists matched after every mutation.

### Error panel + Try again (IMP-007)

* Served with `data/` removed → panel "No paper index yet", `role="alert"`, red border, message
  includes `(HTTP 404)`, **Try again** button rendered with the existing `.button` class.
* **4 consecutive failures**: each click issued exactly one `GET /data/index.json`; the panel
  stayed mounted, the message stayed correct, the button re-rendered each time. No latch leak,
  no duplicate requests, no stuck spinner.
* Then `data/` restored → **Try again** succeeded: panel gone, full feed (2812 papers, 50 cards,
  `All`/60 days/Newest preserved), **focus moved to the `<h1>`** (`activeElement === .hero h1`)
  and the focus ring is clearly visible (`r2-04`).

### Deep links — 19 malformed inputs, zero crashes

`#garbage`, `#&view=collections`, `#q=3d&q=robot` (first wins), `#view=collections&view=feed`
(first wins), bare `#q`, `#cat`, `#recency`, `#sort`, `#view` (all empty → defaults),
`#q=多模态`, `#q=🔍&sort=relevance`, `#view=bogus`, `#sort=oldest`, `#recency=99`, `#recency=0`,
`#recency=-5`, `#recency=abc`, `#cat=cs.CV,cs.CV.seg` (banner on the subcategory), and
`#view=collections&cat=nope.NOPE`. Every one produced a coherent view; `#root` never emptied.
The `%2C` comma-encoding in written hashes was confirmed **pre-existing** — the pre-IMP-143
`writeHash` at `fc77a40` used the same `URLSearchParams.toString()`.

### Local storage — fresh / populated / 10 corrupted variants

Correct wire shape is `{rpf.collections.v1: Collection[]}`, `{rpf.papers.v1: Record<id, Paper>}`.

| Payload | Result |
| --- | --- |
| valid (3 collections, 4 papers) | renders; counts exact |
| **paper with `absUrl:null, pdfUrl:null`** | **kept**, no links rendered, no crash — null-URL fix holds on the load path |
| paper with `absUrl` key absent | kept, no links |
| paper id `__proto__` | **rejected**; collection survives, phantom id stripped from `paperIds`; `Object.prototype` **not** polluted (`{}.toString` still `function`) |
| paper with `absUrl:"javascript:alert(1)"` | kept in storage but **no href rendered** — inert; `PaperCard.safeHref` re-checks at render |
| duplicate collection ids | both render; React-key collision and id-wide Rename/Delete — **pre-existing**, `isCollection` is unchanged across the batch |
| `paperIds:[1,null,'p1']` | whole collection rejected → self-heals to `[]` |
| `paperIds:['p1','nope','also-nope']` | phantom ids dropped, `p1` retained |
| `{items:[]}` (not an array) | empty state |
| collection name `<img src=x onerror=alert(1)>` | rendered as escaped text; no element created, no alert — React escaping intact |
| 500 collections | all 500 render, DCL 23 ms, **no horizontal overflow** |

Import path exercised with 4 uploaded files (real file chooser):

| Fixture | Result |
| --- | --- |
| null URLs (`null`, absent, `""`) | `null` and absent papers **kept**; the `""` paper dropped by `hasSafeUrls` and simultaneously removed from `paperIds` (no dangling reference) — collection shows (2) of 3 |
| `javascript:` / `JaVaScRiPt:` / `data:` | all three **rejected** (case-insensitive regex confirmed) |
| ids `__proto__`, `constructor`, `prototype` | all three **rejected**; only the real id survives — IMP-151 verified end to end |
| paper with only `id` + `title` | **rejected** by `isPaper`, valid sibling kept — IMP-154 verified |

### Console and network

* **Console: zero errors and zero warnings** across the entire healthy-app sweep.
* **Network: all 200/304**, no failed requests on the healthy server
  (`index.json`, `papers-2026-W39.json`, `papers-2026-W40.json`, both asset bundles, Google
  Fonts CSS + 3 woff2).
* On the data-less server the only console error was the intentional
  `404 … /data/index.json`, which is precisely what the error panel is designed to report.

---

## 4. Screenshot judgement

Nine screenshots in `.improve/artifacts/regression-2/`.

**1280px** — `r2-01` default feed, `r2-02` relevance sort, `r2-03` index unavailable,
`r2-04` recovered after retry, `r2-05` collections populated.
**390px** — `r2-10` default feed, `r2-11` unknown category, `r2-12` index unavailable,
`r2-13` collections populated.

### 390px: no overflow anywhere

Measured `scrollWidth` vs `clientWidth` on **13** states (cat empty / some / ALL / partial-unknown,
query+relevance, zero-match, whitespace query, unicode query, collections, collections+bad cat,
recency 7, junk hash, duplicate keys). **`scrollWidth === 390` in every case, zero offending
elements.** Header wraps to two rows, category chips wrap to two rows, buttons fit, no clipped
text, no misalignment. Long paper titles wrap correctly. Visual hierarchy is intact: dark title →
muted date/authors → chips → abstract → footer links.

### 1280px: one intentional, one cosmetic

1. **Controls row is now two lines when the search box is empty.** Baseline
   (`baseline-feed-desktop-1280.png`) had `CATEGORIES | RECENCY | SORT` on a single row; the
   current `r2-01` has Categories + Recency on row 1 and SORT orphaned on row 2, plus the new
   IMP-008 hint paragraph. Cause: IMP-010's extra **"All"** chip consumed ~55 px of the
   `.controls__row` flex line (`styles.css` `.controls__row { display:flex; flex-wrap:wrap }`),
   pushing SORT past the container width. This is correct flex-wrap behaviour from an intended
   feature, and it is self-limiting: as soon as a query is present the Relevance chip becomes
   enabled, the hint disappears, and all three fieldsets **fit on one row again** (see `r2-02`).
   Not a defect, but it is the single most visible difference from baseline and worth a look.
   *Optional polish:* shorten the hint to "Needs a search term" or move it out of the fieldset.
2. **Stray indentation** in `web/src/App.tsx:483` — the `) : noCategoriesSelected ? (` that
   closes the loading branch starts at column 0 instead of aligning with `{loading ? (`.
   Cosmetic only: `tsc` and `vite build` both pass and there is no lint/format script. See §8.

Nothing else looks accidentally broken. Focus indicators are correct and strong: the recovered
`r2-04` shows the `<h1>` wrapped in a 2–3 px solid green `:focus-visible` outline; the Try again
button and chips use the same treatment.

---

## 5. Cross-stack contract

```
/usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 \
    --out-dir /tmp/rpf-regression2/index
→ /tmp/rpf-regression2/index/index.json  +  papers-2026-W40.json
```

**Zero mismatches.**

* `IndexManifest` — `generatedAt: str`, `retentionDays: int` (90), `categories: str[]`
  (`cs.CV`), `shards: list`, `totalPapers: int` (5). All match `types.ts:3-9`.
* `ShardManifestEntry` — `file`, `week`, `count`, `minPublished`, `maxPublished` all present
  with the declared types.
* `ShardFile` — `week: str`, `papers: Paper[]`.
* All **five** papers carry all **11** `Paper` fields in the same emission order as
  `types.ts:11-25`, with correct JS types (`authors`/`categories` are `string[]`,
  `abstractTruncated` is a real boolean, dates are `YYYY-MM-DD`). No missing keys, no extra keys,
  no type drift.
* `build_index.py`'s `build_records` was not touched by this batch (only `load_category_results`
  and the new `MainCliError`/exit-2 plumbing in `468b80d`), so IMP-004's hard-fail changed the
  *exit status*, not the wire format. Verified: the run exits 0 and writes the manifest.

Pre-existing quirks still present and **not** new: `pdfUrl` is typed `string` in `types.ts` but
`build_index.py` uses `getattr(result, "pdf_url", None)`, so it can be `null` (WEB-13). Unchanged
by this batch — and now handled correctly on the web side by the null-URL fix.

---

## 6. Legacy CLI

`scripts/paper-collector.py --help` is sane and complete: usage line, and
`--topic`, `--max-papers`, `--start`, `--start-max`, `--sort-by`, `--sort-order`,
`--output-dir` (documented default `results`), `--save-csv`, `--file-prefix`, `--verbose`.
No argparse errors, no duplicate flags.

**IMP-002 × IMP-023 interaction — 26 `--topic` values, each in an isolated `--output-dir`,
network stubbed.** Every case produced a sane HTML file (+ CSV with `--save-csv`) *directly
inside* `--output-dir`. **Zero escapes, zero exceptions (except the documented prompt for
`--topic ""`, see below), zero writes above `--output-dir`.**

| `--topic` | Sanitised slug | Result |
| --- | --- | --- |
| `cat:cs.CV` | `cat_cs.CV` | normal |
| `cat:cs.CV AND "3d reconstruction"` | `cat_cs.CV_AND_3d_reconstruction` | quotes + spaces sanitised |
| `../../escape` | `_.._escape` | traversal neutralised |
| `../../../../../../tmp/rpf-escape-target` | `escape-target` | pre-existing dir untouched |
| `/etc/rpf-escape` | `_etc_rpf-escape` | absolute path flattened |
| `..\..\escape` | `.._.._escape` | backslashes → `_` |
| `""` (empty) | — | `EOFError` from `input()` — **pre-existing and correct**: `args.topic or input(...)` treats `""` as "not supplied" and prompts |
| `"   "` (spaces) | `_` | fallback slug |
| `..`, `.`, `...` | `_` | never returns `.` or `..` |
| `a/b/c` | `a_b_c` | |
| `cat:\x00\x01\x02\x07\x1b[31mcs.CV` | `cat_____31mcs.CV` | control chars stripped |
| `line1\nline2\tend` | `line1_line2_end` | no newline injection into filenames |
| `CON`, `com1`, `NUL.txt`, `lpt3` | `CON_`, `com1_`, `NUL.txt_`, `lpt3_` | reserved device names suffixed |
| `x` × 5000 | 200 × `x` | truncated |
| `é` × 2000 | 100 × `é` = **200 bytes** | byte-truncated, never split mid-codepoint |
| `多模态 🔍 transformers` | `多模态_🔍_transformers` | unicode preserved |
| `title: "quoted"` | `title_quoted` | |
| `...hidden`, `trailing...`, `C:\Windows\System32`, `-rf`, `a\x00b` | all sanitised in-bounds | |

**Filename-length bound:** longest produced basename is **247 bytes** (200-byte slug + 1 + digit +
`_papers_extracted_on_` + 19-char timestamp + `.html`), comfortably under the 255-byte filesystem
limit. Worst case with a reserved name is identical because the `_` suffix replaces the byte the
truncation removed.

**`--save-csv` × `--output-dir`:** with an explicit `--output-dir`, the CSV lands beside the HTML.
With the default, both land in `./results/` relative to CWD (PY-29 confirmed fixed). Verified with
CWD set to a temp dir; the repo's own `results/` still contains only `.gitkeep`.

**`--max-papers 1` + stubbed results:** HTML and CSV both produced; no stray writes.
Pre-existing and unchanged: `extract_source_archive` still writes to `./extracted/<slug>` and the
PDFs to CWD rather than `--output-dir` (PY-31, open), and `main()` is called bare so the process
exit code is always 0 (PY-32, open). IMP-023 materially *reduces* PY-31's blast radius, since
`safe_filename` can no longer return `..` or `.`.

---

## 7. Flakiness

`npm test` was run **9 times** in total (8 back to back plus a final confirmation). Every run
reported `Test Files 10 passed (10)` / `Tests 160 passed (160)` with no retries and no
`✗`/`×`/`FAIL` lines. The Python suite was run 5 times across 5 interpreters, all green. No
intermittent behaviour was observed in the browser either (the 8 Try-again failures were
deterministic and one-request-per-click).

---

## 8. History hygiene

**Commits are atomic.** 28 commits, 15 of them code/test, 13 pure `chore(improve)` bookkeeping.
Every code commit touches exactly one item's implementation plus that item's tests — no
commit mixes two items' source, and none carries an unrelated file:

```
0beec1b [IMP-001]  web/src/lib/collections.ts, components/PaperCard.tsx, collections.test.ts
d3b4a1e [IMP-002]  scripts/paper-collector.py, tests/test_paper_collector.py
768a5ae [IMP-003]  web/src/lib/paperIndex.ts, paperIndex.test.ts
468b80d [IMP-004]  scripts/arxiv_common.py, scripts/build_index.py, 2 test files
894fb9b [IMP-005]  web/vite.config.ts, package.json, package-lock.json, test-setup.ts, new dom test
5320db6 [IMP-143]  web/src/App.tsx, web/src/lib/urlState.ts, urlState.test.ts
19f8dbb [IMP-024]  scripts/paper-collector.py, tests/test_paper_collector.py
34ea96c [IMP-151]  web/src/lib/collections.ts, collections.test.ts
0ad375c [IMP-012]  web/src/styles.css
7a2ed82 [IMP-151]  web/src/lib/collections.ts, collections.test.ts   (regression-1 fix)
2367a80 [IMP-154]  web/src/lib/collections.ts, 2 test files
ac1fae2 [IMP-007]  web/src/App.tsx, paperIndex.ts, 2 test files
67ee0a4 [IMP-008]  FeedControls.tsx, urlState.ts, 2 test files
228d48d [IMP-009]  web/src/App.tsx, urlState.ts, 2 test files
42e0edb [IMP-010]  web/src/App.tsx, FeedControls.tsx, urlState.ts, 2 test files
297ed71 [IMP-023]  scripts/paper-collector.py, tests/test_paper_collector.py
```

The four files the brief flagged as parallel-edit hot spots (`web/src/App.tsx`,
`web/src/lib/urlState.ts`, `web/src/components/FeedControls.tsx`, `scripts/paper-collector.py`)
each received **non-overlapping** hunks across their sequential commits, and the resulting
behaviour was verified end-to-end in the browser and the CLI respectively.

**`git status --porcelain`:**

```
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
```

Clean apart from untracked `.improve/reports/*.md`, exactly as expected.

**Tracked junk: none.** No `.bak`/`.orig`/`.rej`/`.tmp`/`.swp`/`.pyc`/`.log`-in-source files, no
`.DS_Store`, no `node_modules`, no `dist/`, no `web/public/data/` (all gitignored). `.kilo/worktrees/`
has **no** tracked files. `.improve/PROGRESS.log` is 937 bytes of ASCII text.

### Three low-severity defects in tracked non-code files

These are the only findings in the whole sweep. None affects the product, the tests, or the build.

**F1 — `PROGRESS.log` line 11 lost its newline; two rows have the fields in the wrong columns.**
Offending commits: **`bec7705`** (`chore(improve): mark IMP-154/IMP-007 done, log progress [IMP-007]`)
and **`b01bf39`** (`chore(improve): mark IMP-010/IMP-023 done, log progress [IMP-023]`).

`.improve/PROGRESS.log` lines 11-12 and 16 currently read:

```
2026-10-02T06:03:29Z | REGRESSION-1 | FIXED | 7a2ed822026-10-02T07:17:28Z | IMP-154 | DONE | 2367a80
ac1fae2 | IMP-007 | DONE |  (attempt 2)
297ed71 | IMP-023 | DONE | 
```

Line 11 is **two records concatenated** with no separator (`7a2ed82` runs straight into the next
timestamp). Lines 12 and 16 put the commit SHA in the *timestamp* column and leave the *commit*
column empty — the exact field-order bug that `47c562f` ("rewrite progress log with correct field
order") was written to fix, reintroduced verbatim by the two later `chore` commits. Any tooling
that parses this log as `timestamp | item | status | commit` will silently mis-parse three rows
and mis-segment line 11.

*Reproduction:* `sed -n '10,16p' .improve/PROGRESS.log`
*Minimal fix* (single edit, no code change) — split line 11 and restore the column order:

```
2026-10-02T06:03:29Z | REGRESSION-1 | FIXED    | 7a2ed82
2026-10-02T07:17:28Z | IMP-154      | DONE    | 2367a80
2026-10-02T07:52:00Z | IMP-007      | DONE    | ac1fae2 (attempt 2)
2026-10-02T10:38:00Z | IMP-023      | DONE    | 297ed71
```

**F2 — `web/src/App.tsx:483` misindented ternary branch (cosmetic).**
Offending commit: **`42e0edb`** (IMP-010). The `) : noCategoriesSelected ? (` that closes the
loading branch begins at column 0 instead of aligning under `{loading ? (`. `tsc --noEmit` and
`vite build` both pass and the repo has no lint/format script, so nothing catches it.
*Minimal fix:* indent that one line by 16 spaces. Adding `prettier --check` to CI would prevent
a recurrence.

**F3 — `isCollection` does not reject prototype-keyed *collection* ids (consistency gap, inert).**
Introduced/left by **`34ea96c`** (IMP-151). IMP-151 added `PROTOTYPE_KEYS` to `isPaper` and
`loadState`, but not to `isCollection`, so a collection whose `id` is `"__proto__"` is still
accepted from localStorage or an import file. I traced every use of a collection id
(`key={collection.id}`, `c.id === payload.collection.id`, `newId()`-generated ids) and found **no
prototype-chain read**, so it is currently inert — but it is the same class of bug IMP-151 was
raised to close, and a future refactor that keys collections into an object would reopen it.
*Minimal fix:* add `!PROTOTYPE_KEYS.has(collection.id) &&` to the `isCollection` return chain.

---

## 9. What I checked, so the absence of findings is meaningful

1. Python suite on **5 interpreters** (3.8/3.11/3.12/3.13/3.14), 53 tests on 3.11 and the 33
   importable tests elsewhere.
2. `tsc --noEmit`, `vite build`, and `npm test` **9 times** for flakes.
3. Baseline comparison for web failures (none at baseline, none now), CSS bundle byte-size,
   and the JS bundle delta.
4. **34 browser states** across two servers: 7 feed states, 7 category states, a 13-step
   reversibility chain, 3 collections states plus save/untoggle, 4 consecutive Try-again failures
   then a successful one with focus assertion, 19 malformed deep links, 10 corrupted
   localStorage payloads, and 4 uploaded import fixtures.
5. Console errors/warnings and failed network requests across the whole sweep, against
   `.improve/artifacts/baseline/`.
6. Horizontal-overflow measurement (`scrollWidth` vs `clientWidth` plus per-element offender
   scan) on 13 states at 390px.
7. Screenshot-by-screenshot visual judgement at both breakpoints against
   `baseline-feed-desktop-1280.png`.
8. `build_index.py` → `types.ts` wire contract on a freshly generated real index.
9. 26 `--topic` values through the legacy CLI with byte-level filename-length bounds, plus
   `--help`, `--save-csv` and `--output-dir` behaviour including the default directory.
10. WCAG contrast recomputed from `styles.css` for the changed `--text-muted` token in **both**
    colour schemes: light `#666661` now scores 5.48:1 on `--bg`, 5.77:1 on `--surface` and
    5.06:1 on `--surface-muted` (was 3.58 / 3.75 / 3.35 — all below AA). Dark-mode
    `--text-muted #9b9b94` is unchanged at 6.79 / 7.12 / 6.27 and still passes. IMP-012's claim
    is verified, not just asserted.
11. Per-commit atomicity across all 28 commits, tracked-junk scan, and final
    `git status --porcelain`.

**No regression was found.** The three items in §8 are hygiene defects in bookkeeping and
formatting, not behaviour regressions, and none of them is triggered by anything a user or CI can
reach.

---

## Evidence

* Screenshots: `.improve/artifacts/regression-2/` (`r2-01`…`r2-05` at 1280, `r2-10`…`r2-13` at 390)
* This report: `.improve/reports/regression-sweep-2.md`
* Generated index used for the contract check: `/tmp/rpf-regression2/index/`
* CLI probe harness (throwaway): `/tmp/rpf-regression2/cli_probe.py`
* Import fixtures (throwaway): `/tmp/rpf-regression2/import-*.json`
* Data-less build served for the error-panel state: `/tmp/rpf-regression2/srv/`