# Regression sweep 1

**Range swept:** `fc77a40..6e6134b` (14 commits, 9 improvement items)
**Date:** 2026-10-02
**Method:** full-suite runs on both stacks, manual Playwright sweep of a production build at 1280px and 390px, `git bisect` in a throwaway `/tmp` worktree, cross-stack wire-schema diff, live legacy-CLI runs, git-history audit.

## Verdict

**One regression found.** `0beec1b` (IMP-001) silently deletes papers from an
imported collection when the producer-side URL is `null` rather than absent —
a case the Python producer can genuinely emit. Everything else in the batch is
green: both suites pass at their expected counts, the build is clean, the
Playwright console is silent, and no layout or contract regression was found.

| | |
|---|---|
| Python suite | `44 tests` — **OK** (expected 44) |
| Web typecheck | exit 0 — **OK** |
| Web tests | `65 tests / 5 files` — **all pass** (expected 65/5) |
| Web build | `✓ 39 modules`, `dist/assets/index-*.js 163.73 kB`, CSS `10.93 kB` — **OK** |
| Console (all states, both breakpoints) | **0 errors, 0 warnings** |
| Failed network requests | **0** (all data requests 200) |
| Legacy CLI | `--help` sane, all 7 documented flags accepted, live runs OK |

`.improve/REPO_PROFILE.md` §Pre-existing failures lists four historical failures
(all in the archived pre-rewrite `scripts/fetch_arxiv.py` CLI, which no longer
exists as an entry point). None of them reproduce, and none of them are
reachable from the current entry points, so nothing in this batch sits on top
of a known-red baseline.

---

## R1 — Silent paper loss on import when a URL field is `null`

**Severity:** medium (silent data loss, user-visible)
**Offending commit:** `0beec1b` — `fix(security): reject non-http(s) URLs in imported collection papers [IMP-001]`
**File/line:** `web/src/lib/collections.ts:62-64` (`hasSafeUrls`)

### What broke

IMP-001 added a URL filter to the import path:

```ts
function hasSafeUrls(papers: Paper[]): boolean {
  return papers.every((paper) =>
    [paper.absUrl, paper.pdfUrl].every((url) => url === undefined || isHttpUrl(url)),
  );
}
```

`url === undefined` treats an **absent** field as safe, but `isHttpUrl(null)`
stringifies to `"null"`, fails the `/^https?:\/\//` test, and so rejects a
**present-but-null** field as unsafe. The filter then drops the entire paper
from `payload.papers`, and `mergeImport` narrows `paperIds` to the surviving
papers — with no warning to the user.

This matters because the Python producer can emit exactly that value. In
`scripts/build_index.py:113` and `:120`:

```python
"absUrl": getattr(result, "entry_id", None),
"pdfUrl": getattr(result, "pdf_url", None),
```

`getattr(..., None)` means a missing attribute serialises to JSON `null`. The
repo profile already flags this as **WEB-13** ("`pdf_url` is `str | None` in
arxiv 4.x, so null can reach the wire"), and `types.ts:22` declares
`pdfUrl: string` — i.e. a **pre-existing** nullability mismatch. IMP-019 owns
that fix. What IMP-001 did was turn a latent type mismatch into silent data
loss on the consumer side, which makes it a *new* regression even though the
underlying schema gap is old.

Note the asymmetry: `loadState` (the localStorage path) does **not** apply
`hasSafeUrls`, so an existing browser snapshot is unaffected. Only the
**import** path loses papers. That makes this easy to miss in casual testing.

### Reproduction (browser, production build)

1. `cd web && npm run build && npm run preview`
2. Create the file below and import it via **Collections → Import collection**.
3. Observe the collection header count and the absence of any alert.

```
/tmp/rpf-imports/nullpdf-only.json
{
  "version": 1,
  "exportedAt": "2026-10-02T00:00:00.000Z",
  "collection": { "id": "nullpdf", "name": "Imported (null pdf)", "paperIds": ["2401.00003"] },
  "papers": [{
    "id": "2401.00003", "title": "Null pdfUrl", "authors": ["A"], "abstract": "abc",
    "categories": ["cs.CV"], "primaryCategory": "cs.CV",
    "published": "2024-01-01", "updated": "2024-01-02",
    "absUrl": "https://arxiv.org/abs/2401.00003",
    "pdfUrl": null
  }]
}
```

Result: a collection named **"Imported (null pdf)"** appears with **(0)** papers
and **no alert**. Screenshot:
`.improve/artifacts/regression-1/reg-import-nullpdf-dropped-desktop-1280.png`.

A five-paper mixed payload (`mixed.json`) makes the loss visible in aggregate:

| paper | `absUrl` | `pdfUrl` | imported? |
| --- | --- | --- | --- |
| `2401.00001` | https | https | yes |
| `2401.00002` | `javascript:` | `javascript:` | no — **intended** (IMP-001) |
| `2401.00003` | https | `null` | no — **R1 regression** |
| `2401.00004` | `null` | https | no — **R1 regression** |
| `2401.00005` | https | *key absent* | yes |

The collection reports `(2)` with no indication that three papers were dropped.

### Reproduction (unit level)

`/tmp/rpf-adv/src/__tests__/zz-adv-null-urls.test.ts` (outside the repo):

```
× import keeps producer-null URLs > keeps a paper whose pdfUrl is null
× import keeps producer-null URLs > keeps a paper whose absUrl is null
✓ import keeps producer-null URLs > keeps a paper whose pdfUrl key is absent
```

### Bisect confirmation

Run in a throwaway worktree (`git worktree add /tmp/rpf-bisect HEAD`, removed
afterwards). Probe: the three `parseExportPayload` cases above, judged
good/bad from the vitest exit status.

```
# bad: [6e6134b] chore(improve): mark IMP-151/IMP-012 done
# good: [fc77a40] chore(improve): initial improvement backlog
# bad: [894fb9b] test(web): make component and DOM testing possible
# bad: [768a5ae] fix(web): stop memoizing a rejected manifest promise
# bad: [d3b4a1e] fix(security): sanitize --topic before it reaches CLI output paths
# bad: [0beec1b] fix(security): reject non-http(s) URLs in imported collection papers
# first bad commit: [0beec1b9f04c6b9c5c730a91e2158995e0180c43] [IMP-001]
```

Log retained at `/tmp/rpf-bisect-log.txt`.

### Minimal fix

Treat `null` exactly like `undefined` — absent, not hostile:

```ts
// web/src/lib/collections.ts
function hasSafeUrls(papers: Paper[]): boolean {
  return papers.every((paper) =>
    [paper.absUrl, paper.pdfUrl].every((url) => url == null || isHttpUrl(url)),
  );
}
```

`isPaper` already narrows `id/title/authors/abstract`, and `PaperCard.safeHref`
already suppresses a link whose href is absent, so a `null` URL renders safely
without further changes (verified below: the `javascript:` link is dropped at
render time, and an absent URL simply omits the link).

A second, non-blocking hardening for the same function: report the drop count
to the user. `parseExportPayload` currently discards papers with zero feedback,
so an XSS-laden export is silently cleaned *and* a null-URL export is silently
emptied — the two cases are indistinguishable to the user.

**Note for whoever picks this up:** fixing `hasSafeUrls` is safe in isolation,
but it lands on top of IMP-019, which owns producer-side nullability. If IMP-019
narrows `Paper.pdfUrl` to `string` and `build_index.py` stops emitting `null`,
R1 becomes unreachable — but until then it is live.

---

## What was checked and found clean

### IMP-001 — reject non-http(s) URLs in imported collections
Beyond R1, the security property holds. A hostile localStorage snapshot seeded
with `javascript:` URLs and prototype keys behaved correctly
(`reg-collections-hostile-desktop-1280.png`):

- `__proto__` and `constructor` as paper ids were dropped by `PROTOTYPE_KEYS`.
- The paper whose `pdfUrl` was `javascript:alert(3)` rendered **without** a PDF
  link (the "arXiv" link, which was `https://`, still rendered).
- No alert fired, no error surfaced, no crash.
- A paper with a valid https URL but an absent `pdfUrl` key imported cleanly and
  rendered with only the "arXiv" link — correct, and worth confirming because
  that is the case R1 accidentally broke for `null`.

### IMP-002 — sanitize `--topic` output paths
Verified live, network up, output under `/tmp`:

```
$ python3.11 scripts/paper-collector.py --max-papers 1 --topic '../../escape' \
      --output-dir /tmp/rpf-cli --save-csv
/tmp/rpf-cli/.._.._escape-1_papers_extracted_on_10-02-2026-01-46-52.html file saved!
  /tmp/rpf-cli/.._.._escape_papers.csv
  /tmp/rpf-cli/.._.._escape-1_papers_extracted_on_10-02-2026-01-46-52.html
```

No escape from `--output-dir`; nothing written to `/` or the parent directory.
A normal topic (`'Diffusion Models'`) still produces byte-identical filenames
(`Diffusion Models-1_papers_extracted_on_*.html`), so the slug only rewrites
genuinely unsafe characters.

**Observation (not a regression, worth a readme line):** `--save-csv` used to
write `<topic>_papers.csv` into the *current working directory*; it now writes
into `--output-dir`. This is consistent with the readme ("The extracted papers
are saved under `results/`") and is almost certainly the intended behaviour, but
it is an undocumented semantic change to a documented flag and is not mentioned
in the commit message. Any script that picked the CSV up from the CWD will now
miss it.

### IMP-003 — stop memoizing a rejected manifest promise
`paperIndex.ts` now clears `manifestPromise` inside the `.catch`. Behaviour
confirmed in the browser: the app loads the manifest once, renders, and the
rejected-promise path is exercised by the data-less build below (the error panel
appears, and the app does not wedge).

### IMP-004 — hard-fail index on category query error
Live run against the real API:

```
$ python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-reg-index
... Wrote 5 papers across 1 shards to /tmp/rpf-reg-index     (exit 0)
```

Happy path unaffected. `arxiv_common.iter_results` is a generator, so
`status["failed"]` is only set once iteration begins; `collect_papers` iterates
immediately after creating it, and the early `max_results <= 0` return happens
before creation, so the flag is always set for a category that is actually
queried. Early `break` on the retention cutoff raises `GeneratorExit`, not
`ArxivError`, so a truncated-but-successful run is not falsely marked failed.

### IMP-005 — enable component/DOM testing
`package.json`, `vite.config.ts`, `test-setup.ts`, and the new DOM test all land
together; typecheck and all 5 test files pass. `npm test` now runs jsdom, and
the 65-test count matches expectation exactly.

### IMP-143 — extract and test URL hash state helpers
`web/src/lib/urlState.ts` is a pure move — `git diff` of `App.tsx` in that
commit is deletions plus one import, with no logic edits. 14 crafted hashes
applied live, all handled without a crash or console error:

| hash | result |
| --- | --- |
| `#` | resets to defaults |
| `#view=bogus&q=&cat=&recency=&sort=` | falls back to defaults |
| `#recency=abc&recency=30` | duplicate key → first value `abc` → invalid → 60 days |
| `#recency=7&recency=60` | duplicate key → first value `7` → 7 days |
| `#q=%E6%97%A5%E6%9C%AC%E8%AA%9E&cat=cs.%E9%9B%86` | unicode query + category round-trips |
| `#sort=relevance` (no query) | chip stays pressed, silently degrades to date sort |
| `#cat=cs.NOPE,cs.CV` | unknown category applied but renders no pressed chip |
| `#cat=,,,` | empty category list → 0 papers |
| `#unknown=1&view=collections` | unknown key ignored |
| `#q=a+b%26c%3Dd&view=collections` | reserved chars survive |

The last row confirms the hash encoding is safe. The `sort=relevance` row is the
**pre-existing** WEB-14 defect (relevance chip stays lit and disabled while the
list silently sorts by date) and is **not** a regression from this batch —
`App.tsx` was not changed there.

### IMP-024 — tarfile data filter
`tarfile.extractall(..., filter="data")` added for both the PDF-less LaTeX
source path and the per-paper retry path. No Python test covers extraction
end-to-end (the `--download-sources` flag is not in CI), so this is verified by
inspection and by the 44-test suite staying green — noted as a coverage gap,
not a defect.

### IMP-151 — prototype-key membership checks
`PROTOTYPE_KEYS` + `hasOwnKey` are applied at both call sites. Confirmed live
against the hostile-storage screenshot: `__proto__` and `constructor` were
rejected, `toString` was correctly accepted (it is a real own key in that
fixture, and it is deliberately absent from `PROTOTYPE_KEYS`).

The known `paper.categories.map` blast radius in `PaperCard.tsx` is unchanged
and out of scope for this batch — the fix line is byte-identical between `fc77a40`
and `6e6134b`.

### IMP-012 — darken `--text-muted`
Numerically verified in both colour schemes:

| surface | old `#9aa3ad` | new | verdict |
| --- | --- | --- | --- |
| `#ffffff` | 2.56:1 | `#5b6470` **6.00:1** | was failing, now AA |
| `#f7f7f4` | 2.38:1 | `#5b6470` **5.59:1** | was failing, now AA |
| `#14161a` (dark) | — | `#9aa6b5` **7.33:1** | AA |
| `#1b1e23` (dark raised) | — | `#9aa6b5` **6.76:1** | AA |

Side-by-side against `baseline/baseline-feed-desktop-1280.png`, the current feed
is **pixel-identical in layout**. The only difference is that muted text is now
readable. Hierarchy is intact: titles still dominate, and the muted meta line
(secondary), chip row, and "Abstract truncated" footer all remain visibly
secondary. No clipping, no reflow, no overlap at either breakpoint.

---

## Playwright sweep coverage

Production build (`npm run build`) served with `npm run preview` on port 4319;
a second data-less build (`/tmp/rpf-dist-nodata`) on 4321 for the error panel.
Both servers stopped afterwards. Screenshots in
`.improve/artifacts/regression-1/`.

| state | 1280 | 390 | notes |
| --- | --- | --- | --- |
| feed, default | ✅ | ✅ | 2812 papers, 50 cards, `Load 50 more (2762 remaining)` |
| feed, search + relevance | ✅ | — | hash `#q=diffusion+model&sort=relevance` round-trips |
| feed, categories deselected + 7 days | ✅ | — | hash `#cat=…&recency=7` |
| feed, no categories selected | ✅ | — | empty, no reset path (pre-existing WEB-17) |
| feed, load more ×2 | ✅ | — | 50 → 150 cards, counter decrements correctly |
| feed, save menu | ✅ | — | label correctly flips `Save to collection` ⇄ `Create & save` |
| collections, empty | ✅ | ✅ | "You have no collections yet" + import hint |
| collections, 4 collections (3 with papers, 1 empty, 1 sharing a paper) | ✅ | ✅ | counts, empty message, disabled Export all correct |
| collections, hostile storage | ✅ | — | see IMP-001 above |
| import, garbage JSON | ✅ | — | alert: "Could not read that file as JSON." |
| import, mixed URLs | ✅ | ✅ | R1 evidence |
| index unavailable / error panel | ✅ | ✅ | matches `baseline-feed-index-missing-*` design |
| 14 crafted hashes | ✅ | — | table above |
| localStorage: fresh / populated / corrupted JSON / hostile | ✅ | ✅ | corrupted JSON degrades silently (pre-existing WEB-23) |

**Console:** zero messages of any kind across every state and both breakpoints,
matching the clean baseline. **Network:** every request 200; no 404s from the
SPA fallback on the healthy build.

**Visual judgement at 1280px:** no layout breakage. Card grid, filter bar,
chip alignment, footer rule, and the save button's right-alignment are all
intact and identical to baseline.

**Visual judgement at 390px:** no horizontal overflow
(`scrollWidth === clientWidth === 390`). Category chips, recency, and sort groups
wrap onto separate rows rather than truncating. Collection action buttons
(`Rename` / `Export` / `Delete`) wrap cleanly. The error panel's two `<pre>`
blocks fit without clipping.

---

## Cross-stack contract check

`scripts/build_index.py` (`record_from_result`, lines 102-122) and
`web/src/lib/types.ts` (lines 2-27) were compared field by field, against both
the committed `web/public/data/` and a freshly generated index.

**Neither side was touched by this batch** — `git diff fc77a40..6e6134b` shows
no change to `types.ts` and no change to `record_from_result`. So the batch
introduces **no new** wire mismatch.

Freshly generated manifest (`/tmp/rpf-reg-index/index.json`) — all five keys
present, types as declared:

| manifest key | produced type | `types.ts` | agree |
| --- | --- | --- | --- |
| `generatedAt` | `str` | `string` | ✅ |
| `retentionDays` | `int` | `number` | ✅ |
| `categories` | `list[str]` | `string[]` | ✅ |
| `totalPapers` | `int` | `number` | ✅ |
| `shards[]` | `{category, week, count, file}` | `IndexShard` | ✅ |

`shards[0].file` = `papers-2026-W40.json`, matching `paperIndex.ts`'s
`` `${name}/${file}` `` join under `data/`. Committed shard
`web/public/data/papers-2026-W40.json`: keys `{papers, shard}` only, 2812
papers, **all 11 paper keys present on every record, no `null`s, no mixed key
sets**, URL schemes `absUrl: http://` and `pdfUrl: https://` (both pass
`isHttpUrl`). Paper types: `id/title/abstract/absUrl/pdfUrl/primaryCategory`
`str`, `authors/categories` `list[str]`, `published/updated` `str` — matching
`Paper` exactly.

The **pre-existing** nullability gaps are unchanged and remain IMP-019's job:
`getattr(result, "entry_id"/"pdf_url", None)` and `iso_date(None)` can all emit
`null`, while `types.ts` declares them non-nullable. R1 is the one place where
this batch made that pre-existing gap observable, and it is reported above for
that reason rather than as a schema change.

---

## Legacy CLI check

```
$ python3.11 scripts/paper-collector.py --help
usage: paper-collector.py [-h] [--topic TOPIC] [--max-papers MAX_PAPERS]
                          [--output-dir OUTPUT_DIR] [--download-pdfs]
                          [--download-sources] [--save-csv]
```

Help output is well-formed and matches the readme flag table exactly. All seven
documented flags are present with the documented defaults. Live runs against the
real arXiv API for `--topic`, `--max-papers`, `--output-dir`, and `--save-csv`
all succeeded (see IMP-002 above). `--download-pdfs` / `--download-sources`
were not exercised (network cost); `--download-sources` has no automated
coverage at all, which is a gap given IMP-024 touched it.

---

## Git history health

- **Atomicity:** clean. Every fix commit touches exactly one item — source,
  its tests, and its discovery/impl/verify reports together — with the
  `.improve/FEATURES.md` marker. Progress bookkeeping is split into separate
  `chore(improve): mark … done` commits, so no fix commit carries unrelated
  churn.
- **Debug artifacts:** none. A grep of the whole batch diff for
  `console.log` / `debugger` / `XXX` / `FIXME` / `TODO` / `.only(` /
  `@ts-ignore` / stray `print(` found nothing.
- **`git status --porcelain`:** one stray — `?? .improve/reports/discovered-IMP-002.md`.
  Its siblings (`discovered-IMP-001/004/005/024/143/151.md`) are all tracked,
  so the IMP-002 discovery report was written but never committed. It will be
  lost or ignored. Nothing else is untracked; `__pycache__/`, `web/node_modules/`,
  `web/dist/`, `web/public/data/`, `results/`, and `.DS_Store` are all properly
  gitignored.
- **No history rewriting.** `git bisect` ran only in `/tmp/rpf-bisect`, which
  has been removed (`git worktree list` shows only the main worktree and the
  untouched `.kilo/worktrees/mildly-income`, which was never read).

---

## Recommended follow-ups

1. **R1** — change `url === undefined` to `url == null` in `hasSafeUrls`, and
   consider surfacing a dropped-paper count on import.
2. Add a unit test asserting a producer-null `pdfUrl` survives import, so the
   IMP-019 fix and any future hardening cannot silently re-break this.
3. `.improve/reports/discovered-IMP-002.md` is untracked and should be committed
   or removed.
4. Optional readme touch-up: state that `--save-csv` writes into `--output-dir`.