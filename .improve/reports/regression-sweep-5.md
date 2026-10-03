# Regression Sweep 5

**Range:** `fc77a40..9b89fed` (64 commits)
**HEAD:** `9b89fed` — *chore(improve): log IMP-031/IMP-032 progress [IMP-031]*
**Date:** 2026-10-02
**Mode:** read-only. No source file was modified. One byproduct file created by the
background-process wrapper (`1necho`, repo root) was removed to restore the tree.

---

## Verdict

**REGRESSIONS** — one confirmed test-level defect (incomplete fix, low blast radius)
plus one uncommitted working-tree deletion of a tracked source file.

Nothing in the 34 improvement items broke production behaviour. Suites, workflows,
persistence, error surfaces, the new incomplete-index notice, alert hygiene, and both
docs are clean. The two items below are the exceptions.

---

## 1. Suites

| Suite | Command | Expected | Result |
|---|---|---|---|
| Python | `python3.11 -m unittest discover -s tests -v` | 104 OK | **104 OK** |
| Python (oldest supported floor) | same, Python **3.11.10** | 104 OK | **104 OK** |
| Python (newest) | same, Python **3.14.3** (clean `HEAD` copy) | 104 OK | **104 OK** |
| Web | `npm run typecheck` | exit 0 | **exit 0** |
| Web | `npm test` | 266 / 17 files | **266 passed, 17 files** |
| Web | `npm run build` | exit 0 | **exit 0**, 41 modules, css 10.93 kB, js 172.50 kB |

### Repeat / shuffle runs

- `npm test` plain: **6 runs, 6× 266 passed / 17 files**
- `npm test -- --sequence.shuffle`: **24 runs, 23× 266 passed, 1× 265 passed / 1 failed**
  - the single failure is R-1 below
- Follow-up `App.partialShard.test.tsx` in isolation under shuffle: **10/10 pass**
- Follow-up whole-suite shuffle batch: **12/12 pass** (`.improve/artifacts/regression-5/flake2.log` scope; `/tmp/r5-flake.log`)

No pre-existing failure from `.improve/REPO_PROFILE.md` §7 changed state. All four of
that section's entries (no ESLint config, no lint runner, no component tests, no
integration tests) are still accurate.

---

## 2. Regression R-1 — incomplete order-dependent alert flake in `App.partialShard.test.tsx`

**SHA that last touched the test:** `2c73ec9` (*test(web): fix order-dependent
alert-count flakes [IMP-192]*)

**Observed:** `App.partialShard.test.tsx > shows both as separate alerts and announces
neither twice` failed in 1 of 24 whole-suite `--sequence.shuffle` runs with
`1 failed | 265 passed`. The test aborted around 3251 ms, i.e. the `waitFor` that
IMP-192 added at `App.partialShard.test.tsx:415-419` did not settle within the
default 1000 ms budget. It did not reproduce in the 22 subsequent whole-suite shuffle
runs, 10 isolated shuffle runs of the file, or 6 plain runs.

**Why this is the IMP-192 shape again:** IMP-192 converted the *count* assertions in
this test to `waitFor`, which is correct, but left the preceding
`await screen.findByText(W09.title)` as the only settle point. That line proves
neither of the two live regions has mounted: the shard notice rides the loader's
single batched `setPapers`/`setFailedShards` commit while the storage notice is a
separate `saveFailed` state written by the save effect. On a loaded machine the save
effect can land a frame or two later than `findByText` resolves, and the default 1 s
`waitFor` budget is spent on a `userEvent`/`user.click` sequence that already burned
most of the test's wall clock.

**Minimal fix** (test-only, no product change, do not weaken any assertion):

```tsx
// web/src/__tests__/App.partialShard.test.tsx  (the "shows both as separate
// alerts and announces neither twice" test)
await screen.findByText(W09.title);

// TODO(regression-5): settle the save effect explicitly instead of relying on
// the default 1s waitFor budget after a userEvent sequence.
await waitFor(
  () => expect(screen.getAllByRole("alert")).toHaveLength(2),
  { timeout: 3000 },
);
```

**Blast radius:** test-only. It cannot affect the shipped app; it can only cause a
red CI run on the weekly deploy pipeline. The product code the test covers
(`App.tsx:705` partial-shard notice + `App.tsx:571` save-failure notice, both
`role="alert"`) was independently verified in a real browser in §4/§5 and is correct.

**Also note:** IMP-192's own commit message already filed this exact site as an
undocumented-backlog item ("`App.partialShard.test.tsx:277,286,315,326` are safe only
via the `setPapers`/`setFailedShards` batching invariant at `App.tsx:262-264`"). That
invariant still holds in the product code; the residual exposure is the test's settle
budget, which is what the `timeout` above addresses.

---

## 3. Regression R-2 — `scripts/build_index.py` deleted from the working tree (uncommitted)

**Not a committed regression.** `git status --porcelain` reports ` D
scripts/build_index.py`; `HEAD:scripts/build_index.py` is present and intact (529
lines, last modified by `c968a01` = IMP-204).

**Evidence:**

```
scripts/            mtime 2026-10-02 18:47:14   (arxiv_common.py inside: 18:42)
git status at 18:44 (start of this sweep): clean — file present
git status at 18:52: D scripts/build_index.py
```

The deletion happened **during** this sweep, at 18:47:14, from a process outside this
session. It also affected a copy staged at `/tmp/r5-scripts/build_index.py` minutes
later while `arxiv_common.py` in the same directory survived — so the actor is
selectively removing files named `build_index.py`. This sweep did not run any git
write command and did not delete it.

**Impact:** the 104-test Python suite result in §1 is valid (it ran at 18:44, before
the deletion) and was independently re-confirmed at 19:00 against a pristine
`git archive HEAD` copy in `/tmp/r5-docs`, which still contains all three scripts. The
`--retention-days 0` / `--category 'cs.CV foo'` / `--abstract-chars -3` flag-validation
runs and the successful end-to-end build (§6) were executed against `HEAD`'s copy,
extracted read-only via `git cat-file -p HEAD:scripts/build_index.py`.

**Action for the coordinator:** `git checkout -- scripts/build_index.py` (or let the
owning agent finish). Until then `python scripts/build_index.py` and
`.github/workflows/{ci,deploy}.yml` cannot run from this working tree.

---

## 4. Workflow validity (new surface — first sweep of this)

Both workflows parse as valid YAML. Every `run:` line was traced to a real target.

### `run:` targets

| Workflow | Line | Command | Verdict |
|---|---|---|---|
| `ci.yml` | 66 | `python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data` | flags exist; `--category` matches `^[a-zA-Z-]+(\.[a-zA-Z-]+)?$`; exits 0 |
| `ci.yml` | 78 | `npm run typecheck` | exists in `web/package.json` |
| `ci.yml` | 79 | `npm test` | exists |
| `ci.yml` | 80 | `npm run build` | exists |
| `deploy.yml` | 75 | `python scripts/build_index.py --max-per-category 30000` | flag exists; `limit = min(30000, RESULTS_CEILING=30000) = 30000`, no clamp warning |
| `deploy.yml` | 95 | `npm run build` | exists |

- **`npm run lint` was never added.** `web/package.json` has exactly `dev`, `build`,
  `preview`, `test`, `typecheck`. No workflow references any other script.
- **No secrets.** Neither workflow references any `secrets.*`. `deploy.yml` gained a
  `permissions:` block (`contents: read`, `pages: write`, `id-token: write`) and a
  `concurrency:` block — both are restrictions, not widenings.
- **No permissive trigger added.** `ci.yml` is still `push: [main]` + `pull_request`;
  `deploy.yml` is still `schedule` (weekly, `cron: '17 6 * * 1'`) + `push: [main]` +
  `workflow_dispatch`.
- **No new mutable action tag.** All action refs are still `@v4`/`@v5`/`@v3` major tags
  (pre-existing INF-09); `deploy.yml` gained no new action reference at all.

### `timeout-minutes` arithmetic

Client worst case confirmed from source: `arxiv_common.py:83` `num_retries = 5`,
`:64-65` `REQUEST_TIMEOUT = 60`, `:157` `time.sleep(10)` between retries, no pacing →
`6 × 60 = 360 s` per page fetch.

| Workflow / step | Cap | Claimed basis | Arithmetic |
|---|---|---|---|
| `ci.yml` `web-tests` (job) | 25 min = 1500 s | non-index steps ~120 s | 1500 − 900 (index cap) = 600 s > 120 s ✓ |
| `ci.yml` index step | 15 min = 900 s | one page fetch (`--max-per-category 5` → `page_size = 5`, `max_results = 5` → `yielded >= 5` breaks after the first response) = 360 s | 360 × 2.5 = 900 ✓ |
| `deploy.yml` index step | 75 min = 4500 s | partition: 5 cats × 360 s = 1800 s | 1800 × 2.5 = 4500 ✓ |
| `deploy.yml` index step (compound) | 4500 s | 38 healthy pages + one partition: `38 × (60 + 10) + 1800 = 4460 s` | 4460 < 4500, **40 s slack** |
| `deploy.yml` build job | 90 min = 5400 s | ~120 s non-index | 5400 − 4500 = 900 s ≈ 7.5× 120 ✓ |

**Did IMP-204's `--max-per-category 30000` shift the page count? No.** `build_client(30000)`
still yields `page_size = min(1000, 30000) = 1000` — identical to the pre-IMP-204
`UNLIMITED = 100000` path — and a healthy run is stopped by the retention break
(`arxiv_common.py:199-201`) long before `max_results`, so the page count is still
governed by the 60-day window, not the cap. The deploy.yml comment's claim that
IMP-204's flag "only bites once a category outgrows it" is accurate. The 40 s of slack
on the compound case is IMP-205's already-filed finding, unchanged by IMP-204.

**One new, previously unflagged consequence of IMP-204** (cosmetic, not a regression):
`ci.yml`'s smoke index runs with `--max-per-category 5` against `cs.CV`, which returns
207,907 all-time results. `collect_papers` therefore sets
`truncatedCategories: ["cs.CV"]` on the manifest that `ci.yml` then builds the web app
from. The CI artifact is never deployed, so this is noise in a throwaway build; it does
not make the deploy path wrong. Confirmed against a live smoke run:
`WARNING:root:  cs.CV hit the 20-result cap; older papers in the window may be missing`.

---

## 5. Data persistence — PASS (all four, real browser, production build)

Driven with Playwright against `web/dist` served from an in-process `no-store` static
server, each navigation cache-busted so every state was a genuine cold boot.

| Behaviour | After reload |
|---|---|
| Save a paper into a collection | `Vision (1)` ✓ |
| Rename the collection | `Renamed Set (1)` ✓ |
| Remove the paper | `Renamed Set (0)` ✓ |
| Import a collection export | `Imported Set (1)` ✓ |

localStorage variants (all correct, no crash, no alert, no console error):

| Variant | Result |
|---|---|
| fresh (cleared) | empty state, "You have no collections yet." |
| populated | `Persisted (1)` |
| `rpf.collections.v1 = "{{{not json"` | `loadState` catch → EMPTY_STATE, 0 collections |
| `rpf.papers.v1 = "null"` | collection kept, `Persisted (0)`, no crash |
| collection referencing a missing paper id | pruned to `Ghost (0)` |
| `rpf.collections.v1 = '{"a":1}'` (not an array) | empty state |

---

## 6. Playwright sweep — 1280 px and 390 px, production build

68 states recorded in `.improve/artifacts/regression-5/` (54 screenshots) plus a
68-state JSON matrix. Reproduce with `/tmp/r5-sweep2.mjs`.

### Feed states (both widths)

default · 7/30/60-day recency · all/partial/none/unknown/partial+unknown categories ·
real search · zero-match search · whitespace-only query · relevance sort + its disabled
hint · Load more · collections empty and populated.

- 7/30/60-day all report `2812 papers match`. Verified **correct**, not a filter bug:
  the whole index spans 2026-09-24 → 2026-10-01, and the 7-day window from
  `latestIndexDate = 2026-10-01` starts at 2026-09-24, so all 2812 papers qualify.
- Whitespace-only query falls back to all papers, not a false zero. ✓
- `Relevance` chip is `disabled` with the hint text while the query is empty. ✓
- `#cat=` (empty) → "No categories selected", not "No papers match". ✓
- Unknown category → unknown-category notice with a "Reset category filter" control,
  and `PaperList` is not rendered at all. ✓
- `document.documentElement.scrollWidth > clientWidth` is **false in every state at
  both widths** — no horizontal overflow anywhere, including the new banner.
- No clipped text other than the pre-existing search placeholder (WEB-63).

### Error surfaces and recovery

| Injection | Result |
|---|---|
| manifest missing (404) | "No paper index yet" / unavailable copy, `role="alert"` panel, `Try again` |
| manifest JSON `null` | "could not be read" malformed copy, `Try again` |
| manifest array | same malformed path |
| manifest string | same malformed path |
| manifest truncated JSON | same malformed path |
| one corrupt shard | **degraded**: 2549 papers still listed + "Some papers could not be loaded" naming `papers-2026-W39.json` and the week range |
| all shards blocked | hard "Papers could not be loaded. The index is available but its papers are not." |
| save failure (`localStorage` throws on `rpf.papers.v1`) | "Collections could not be saved…" `role="alert"` |
| unknown category | covered above |

**Recovery path verified end to end:** with `index.json` 404 → click "Try again" →
manifest restored → feed renders 2812 papers, 0 alerts. With all shards blocked →
"Try again" correctly does *not* claim recovery while the shards are still 404.

### Console / network

- **24 console errors, all of them expected** — every one is the app's own deliberate
  `console.error("paper feed: … could not be loaded …")` from a fault-injected state, or
  the browser's own 404 resource line. Zero on any healthy or incomplete-index state.
- **Zero `pageerror` (uncaught) events in the entire sweep.**
- **11 failed requests, all accounted for** — `index.json` 404 under `nomanifest`,
  `papers-2026-W39.json` / `papers-2026-W40.json` 404 under `allblocked`.
- **Zero unexpected network failures on the healthy site.**

### Screenshots judged (`.improve/artifacts/regression-5/`)

- `m-feed-default-390.png`, `m-feed-search-390.png`, `m-feed-zero-390.png` — no
  overflow, filters card wraps cleanly into single-column groups, cards legible.
- `incomplete-failedcat-390.png`, `incomplete-failedcat-1280.png` — the new notice sits
  between the controls card and the feed, wraps to 2 lines at 390 px and 1 at 1280 px,
  amber background, no overlap with the card below.
- `incomplete-failedcat-deeplink-1280.png` — **two banners stack with a clean 24 px
  gap**, the incomplete-index notice above, the unknown-category notice below with its
  "Reset category filter" pill inline. Hierarchy intact.
- `m-feed-cat-unknown-390.png` — notice + pill stack vertically, no dead chip.
- `err-corruptshard-1280.png` — degraded feed keeps its cards while the banner names
  the exact failing file and week.
- Pre-existing cosmetic nits visible but unchanged: inconsistent result-count
  formatting (`2812` in the status vs `2,812` in the hero — WEB-49), search placeholder
  clipped at 390 px (WEB-63). Not regressions.

---

## 7. Alert / role hygiene

Full inventory of live regions in `App.tsx` + `CollectionsView.tsx` + `FeedControls.tsx`:
save failure (alert, 571) · index-unavailable panel (alert, 596) · loading spinner
(status, 623) · load-failed-with-papers banner (alert, 669) · partial-shard notice
(alert, 705) · **incomplete-index notice (alert, 727)** · unknown-category notice
(alert, 743) · paper-list spinner (status, 765) · hard load-failure panel (alert, 785) ·
storage-unavailable (alert, `CollectionsView.tsx:185`) · import error (alert, 229) ·
result count (`role="status" aria-live="polite"`, `FeedControls.tsx:137`).

Per state, measured live counts:

| State | Alerts | Status | Correct single region? |
|---|---|---|---|
| healthy feed, both widths | 0 | 1 (`2812 papers match`) | ✓ |
| incomplete-index only | 1 | 1 | ✓ names the category |
| incomplete + unknown category | 2 | 1 | ✓ two distinct messages, no duplicate |
| one corrupt shard | 1 | 1 | ✓ (single-source shard failure is folded into one notice) |
| all shards blocked | 1 | 1 | ✓ |
| manifest unavailable | 1 | 0 | ✓ exactly one panel, no duplicate "Try again" |
| save failure | 1 | 0 | ✓ |
| collections empty / populated | 0 | 0 | ✓ |

**No double-announce.** Explicitly probed: with the save-failure alert mounted, tagged
the live node, then forced a client-side re-render by switching to Feed and typing in
the search box — `document.querySelector('[role="alert"]')` was still the *same node*
(`sameNode: true`), still `1` alert region. The `useMemo` on `describeIncompleteIndex`
(`App.tsx:322-325`) and the `role="alert"` + `aria-label` split at `App.tsx:727-729`
mean the notice's accessible name stays the short headline while the category detail
lives in the body and `title`. The missing-manifest panel at `App.tsx:596` is still
correctly suppressed while the cached-papers banner at `669` shows, so those two never
announce the same failure twice.

---

## 8. Incomplete-index notice — new surface, verified

| Requirement | Result |
|---|---|
| Appears only when the manifest declares `failedCategories` or `truncatedCategories` | ✓ 1 alert on `failedcat` / `truncatedcat` / `bothcat`; **0 alerts on `healthy`** |
| Names the category | ✓ body reads "cs.RO could not be fetched from arXiv when this index was built…" / "cs.LG was cut off at this index's per-category limit…" |
| Leaves no dead chip | ✓ chip row is `All, cs.CV, cs.LG, cs.CL, cs.AI` (5) on `failedcat` vs 6 on `healthy`; `cs.RO` is gone from both the chips and the hero line |
| Handles **both** lists at once | ✓ `bothcat` → one notice, body concatenates the failed and truncated sentences, `aria-label` stays "This index is incomplete" |
| `#cat=` at a **failed** category → unknown-category notice, not a false "No papers match" | ✓ on a pure `failedcat` manifest at `#cat=cs.RO`: alerts = [incomplete-index, **Unknown category: cs.RO**], 0 papers rendered, `document.body.innerText` does **not** contain "No papers match the current filters." (`bodyHasFalseEmpty: false`), and a "Reset category filter" recovery control is present |
| Renders correctly at 390 px | ✓ `incomplete-failedcat-390.png` |

---

## 9. Python pipeline end-to-end

Run against `HEAD`'s `scripts/build_index.py` (see R-2) into `/tmp` out-dirs.

**Flag validation — all exit 2, none creates an out-dir:**

| Command | Exit | Out-dir created |
|---|---|---|
| `--retention-days 0` | **2** | no |
| `--category 'cs.CV foo'` | **2** | no |
| `--abstract-chars -3` | **2** | no |
| `--category cs.CV --max-per-category 20` | **0** | yes |

**Successful run** (`--category cs.CV --max-per-category 20 --out-dir /tmp/r5-out`):

```
WARNING:root:  cs.CV hit the 20-result cap; older papers in the window may be missing
INFO:root:  20 papers within retention window for cs.CV
INFO:root:Wrote 20 papers across 1 shards to /tmp/r5-out
```

- `index.json` exists. ✓
- Every `shards[].file` resolves relative to the out-dir and parses. ✓
- No shard older than retention (all 20 papers within 60 days of 2026-10-02). ✓
- Plausible paper count: 20 papers, `totalPapers: 20`, 1 shard. ✓
- `truncatedCategories: ["cs.CV"]` present, `failedCategories` absent on a healthy run. ✓
- Wire contract: the shard's paper objects carry exactly the 11 keys `web/src/types.ts`
  declares (`id, title, authors, abstract, abstractTruncated, published, updated,
  categories, primaryCategory, absUrl, pdfUrl`) — IMP-019's nullability alignment holds.
- IMP-022's validation covers both scripts and fires before any directory is created.

---

## 10. Docs accuracy — PASS

`CONTRIBUTING.md` and `readme.md` onboarding executed **verbatim**, in one continuous
`bash` shell, from a clean `git archive HEAD` copy at `/tmp/r5-docs` (not the dirty
working tree), Python **3.14.3** (the newest interpreter the docs claim).

| Step | Exit | Note |
|---|---|---|
| `python3 --version` | 0 | 3.14.3 |
| `python3 -m venv .venv` | 0 | |
| `source .venv/bin/activate` | 0 | |
| `python -m pip install -r requirements.txt` | 0 | |
| `python -m unittest discover -s tests -v` | 0 | **104 tests, OK** |
| `python scripts/build_index.py --category cs.CV --max-per-category 300` | 0 | 300 papers / 1 shard → `web/public/data` |
| `cd web && npm ci` | 0 | |
| `npm run typecheck` | 0 | |
| `npm test` | 0 | 266 passed / 17 files |
| `npm run build` | 0 | built in 1.06 s |
| `cd web && npm run dev` | 0 | VITE 5.4.21 ready in 242 ms; `GET /research-paper-feed/` → **200**, `GET /research-paper-feed/data/index.json` → **200** |
| `python scripts/paper-collector.py --topic 'cat:cs.CV AND "3d reconstruction"' --max-papers 5` | 0 | `results/cat_cs.CV AND _3d reconstruction_-5_papers_extracted_on_10-02-2026-*.html` |
| `python scripts/paper-collector.py --max-papers 3` (interactive, stdin piped) | 0 | `results/cat_cs.CV-3_papers_extracted_on_10-02-2026-*.html` |

**Every documented step exits 0 on a clean copy.** No stale flag, no missing file, no
`npm run lint`, no nonexistent script. `readme.md:178` correctly says the deploy runs
**weekly on Sunday at 06:00 UTC**, matching `deploy.yml`'s `cron: '17 6 * * 1'`
(was a documented bug, fixed inside this range). IMP-002's filename sanitizer holds —
the topic with spaces and quotes produces a valid filename with no path separator.

Note: the dev server binds IPv6 `[::1]:5199` only on this machine, so `curl 127.0.0.1`
fails while `curl localhost` returns 200. That matches `vite.config.ts`'s default
`host` and the `http://localhost:5173/research-paper-feed/` URL the readme prints — not
a docs defect.

---

## 11. History hygiene

- **`git status --porcelain`:** ` D scripts/build_index.py` (R-2, external) plus
  untracked `.improve/reports/discovered-IMP-002.md`, `discovered-IMP-009.md`,
  `regression-sweep-4.md`. No tracked junk, no stray build output, no secrets.
- **Tracked junk scan:** zero matches for `.DS_Store`, `__pycache__`, `*.pyc`,
  `.pytest_cache`, `.venv/`, `node_modules`, `/dist/`, `.env`, `*.tar.gz`, `*.pdf`.
  (`scripts/__pycache__/` exists on disk but is gitignored and untracked.)
- **Commit atomicity:** every commit carries one deliverable. Product code and its
  tests land together (`c968a01` IMP-204: 10 source files covering one behaviour
  change + its tests; `8bc73f9` IMP-019: 8 files for the type/producer alignment;
  `298d3b1` IMP-022: 4 files for flag validation). `.improve/` bookkeeping is
  consistently isolated in separate `chore(improve):` commits with 1–2 files. No commit
  mixes a feature with unrelated cleanup. `2c73ec9` (IMP-192) does touch
  `.improve/PROGRESS.log` inside a test-fix commit — a small, disclosed exception, and
  the log is well-formed afterwards.
- **`.improve/PROGRESS.log`:** 40 rows, **every row has exactly 4 pipe-delimited
  fields** (`timestamp | item | status | sha`). Zero malformed rows. Last two:
  `… | IMP-198 | DONE | b7e23a8 (attempt 2)` and
  `… | IMP-204 | DONE | c968a01 (attempt 2; closes the weekly deploy stall)`.

---

## What was checked

Suites (Python 3.11 + 3.14, typecheck, 266 tests × 6 plain + 24 shuffle, build) ·
both workflows parsed, every `run:` traced, `npm run lint` absence confirmed, every
`timeout-minutes` re-derived from `arxiv_common.py`'s retry/timeout constants and
checked against IMP-204's new `--max-per-category` · secrets / triggers / action tags ·
save + rename + remove + import persistence across reloads · six localStorage variants ·
68 browser states at 1280 px and 390 px from a production build · every error surface
with its recovery path · the new incomplete-index notice in all three manifest shapes
plus its deep-link interaction · alert/role inventory per state with an explicit
double-announce probe · pipeline end-to-end with flag validation and wire-contract
check · both docs executed verbatim on a clean copy · commit atomicity, tracked junk,
working-tree status, and PROGRESS.log field counts.