# Regression sweep 6 — final sweep across the whole batch

**Date:** 2026-10-03 · **Range:** `fc77a40..HEAD` (76 commits, 38 improvement items) ·
**HEAD:** `ebc47e2` · **Interpreter:** `/usr/local/bin/python3.11` · **Node:** v25.6.1

## VERDICT: CLEAN

No regression found. Every baseline check is green, both deploy guards fail closed on all
17 shapes tested and accept the IMP-204 partial-index contract, all four persistence flows
survive a real reload, the production build emits zero console messages and zero failed
requests in the happy path at both viewports in both themes, and all 23 computed contrast
pairs clear WCAG. Seven non-blocking findings are recorded in §9; none is a regression and
none blocks publication.

---

## 1. Suites

| Check | Command | Expected | Measured | Result |
| --- | --- | --- | --- | --- |
| Python | `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | 104 OK | `Ran 104 tests in 1.082s` / `OK`, exit 0 | pass |
| Web typecheck | `cd web && npm run typecheck` | exit 0, no output | exit 0, no output | pass |
| Web tests | `cd web && npm test` | 292 across 19 files | `Test Files 19 passed (19)` / `Tests 292 passed (292)` | pass |
| Web build | `cd web && npm run build` | exit 0 | exit 0 — guard line + `41 modules`, JS 172,521 B (172.50 kB, gzip 55.22), CSS 10,914 B (10.91 kB, gzip 2.86) | pass |

**Repeated runs — 10 total, all green at 292/292 across 19 files:**

- 5 × `npm test` plain: 292 passed each.
- 5 × `npm test -- --sequence.shuffle`: 292 passed each. No order-dependent flake.

No bisect was needed because there was no failure. Against `.improve/REPO_PROFILE.md` §7,
there are **zero new failures**; §7 itself lists zero failing baseline checks, and all four
remain green. The Python suite's breakdown still reconciles: `test_arxiv_common.py` 21 +
`test_build_index.py` 55 + `test_paper_collector.py` 28 = 104.

Two profile figures to correct, both drift rather than defects:

- §3.3 records the bundle as JS **171.45 kB / gzip 54.92**. Measured now: **172.50 kB /
  gzip 55.22** — the +1.05 kB is IMP-013's three-line CSS-token change plus IMP-019/IMP-173
  churn. 41 modules is unchanged.
- §3.3 records CSS as **10.93 kB**. Measured now: **10.91 kB**, matching IMP-013's own
  commit message. §3.3's "the CSS figure remains stable at 10.93 kB (measured delta exactly
  0)" is now stale.

`scripts/build_index.py` present and intact: 529 lines, `compileall -q scripts tests` exit 0,
all three scripts parse.

---

## 2. Build and deploy guards

`web/scripts/require-index.mjs` driven directly against fixtures in `/tmp` — **17 shapes, 17 as
expected**:

| Input | Exit | Note |
| --- | --- | --- |
| directory absent | 1 | named diagnosis |
| empty directory | 1 | named diagnosis |
| valid manifest, shards present | **0** | `Paper index present: … with 2 shard(s).` |
| `failedCategories` present | **0** | IMP-204 partial index permitted |
| `truncatedCategories` present | **0** | IMP-204 partial index permitted |
| both fields present | **0** | permitted |
| shard file absent | 1 | `is not there` |
| shard is a directory | 1 | `is a directory, not a file` |
| shard is a FIFO | 1 | `is not a regular file` |
| shard is a dangling symlink | 1 | `is not there` |
| shard is a symlink to a real file | **0** | agrees with `test -f` |
| shard entry has no `file` | 1 | named diagnosis |
| `shards: []` | 1 | named diagnosis |
| manifest is `[]` | 1 | named diagnosis |
| manifest is `"hello"` | 1 | named diagnosis |
| manifest is `{oops` | 1 | named diagnosis |
| manifest is empty file | 1 | named diagnosis |
| manifest is JSON `null` | 1 | **stack trace, not a diagnosis** — finding F2 |

**The partial-index contract holds.** A manifest carrying `failedCategories` and/or
`truncatedCategories` passes both guards, deliberately. Confirmed end-to-end from the
producer: `build_index.py --category cs.CV --max-per-category 40` wrote
`truncatedCategories: ["cs.CV"]` with `failedCategories` absent, and CI's own smoke index
(`--category cs.CV --max-per-category 5`) takes the same code path.

`deploy.yml`'s filesystem assertion, extracted verbatim and run against fixtures — **9 shapes,
9 as expected**: good dist `0`; missing shard `1`; no `index.json` `1`; `shards: []` `1`;
malformed `1`; JSON `null` `1`; array `1`; partial (`failedCategories` + `truncatedCategories`)
**`0`**. The `::error::` annotation and `exit 1` fire on every rejection, so
`actions/upload-pages-artifact` never runs on a bad `dist`.

**Data presence is irrelevant to `dev` and `test`, and to the bundle.** In an isolated copy
under `/tmp` (node_modules symlinked, real repo untouched):

| | data absent | data present |
| --- | --- | --- |
| `npm test` | 19 files / 292 passed | 19 files / 292 passed |
| `npm run build` | **exit 1, no `dist` created** | exit 0 |
| `npm run dev` | serves, renders "No paper index yet" + "Try again" | serves, renders the 2,812-paper feed |

Bundle content hashes are byte-identical with data present and absent
(`index-Cz853rdl.js` / `index-DLsgX6w.css` in both), confirming the index is copied as files
and never inlined.

---

## 3. Workflows

Every `run:` line maps to something that exists right now.

- `ci.yml`: `pip install -r requirements.txt`, `python -m unittest discover -s tests -v`,
  `npm ci`, `npm run typecheck`, `npm test`, `python scripts/build_index.py …`,
  `npm run build`. All real. **No `npm run lint`** anywhere in either workflow, and none
  exists to run.
- `deploy.yml`: `pip install`, `python scripts/build_index.py --max-per-category 30000`,
  `npm ci`, `npm run build`, the assertion block, plus `python3 -c …` (runner-provided).
- **No secret** is referenced in either file (`grep 'secrets\.'` → none).
- **No widened trigger.** `ci.yml` is `push: branches [main]` + `pull_request`;
  `deploy.yml` is `schedule` + `push: branches [main]` + `workflow_dispatch` — the original set.
- **Action tags are mutable**, not SHA-pinned: `@v4` ×3, `@v5` ×2, `@v3` ×1. This is
  profile PE-10, the documented pre-existing baseline, not new in this range.

`timeout-minutes` are internally consistent with the measured worst cases:

| Location | Cap | Basis | Headroom |
| --- | --- | --- | --- |
| `ci.yml` index step | 15 min = 900 s | one page, 6 attempts × 60 s = **360 s** measured | 2.5× |
| `ci.yml` `web-tests` job | 25 min | 15 min index + ~120 s of everything else | 600 s vs 120 s |
| `deploy.yml` index step | 75 min = 4,500 s | 5 categories × 6 attempts × 60 s = **1,800 s** | 2.5× |
| `deploy.yml` `build` job | 90 min | 75 min index + ~120 s rest | 900 s vs 120 s |
| `deploy.yml` `deploy` job | 15 min | `deploy-pages` waits tens of seconds | ample |

Both caps sit at 2.5× their worst case and the comments state that arithmetic explicitly, so
the numbers and the prose agree. One prose nit: `ci.yml:25` says the non-index work measures
"~120 s … comfortably >5x headroom" where 600/120 is exactly 5.0×, not comfortably more.
Cosmetic.

---

## 4. Data persistence — the highest-risk user behavior

Driven through the real UI in a real browser against a production build, each flow ending in
a genuine `page.reload()`.

| Flow | Before reload | After reload | Result |
| --- | --- | --- | --- |
| **Save a paper** | `rpf.papers.v1` 1 entry; nav `Collections (1)` | 1 entry; the save-menu checkbox is still `true` for that paper | **pass** |
| **Rename a collection** | `["Rename Me"]` | `["Renamed OK"]`; `<h2>` and the `section[aria-label]` both read `Renamed OK` | **pass** |
| **Remove a paper** | 3 papers; 3 cards in the collection | 2 papers; 2 cards (`rpf.papers.v1` pruned 3→2) | **pass** |
| **Delete a collection** | 1 collection, 2 papers | `[]`; `rpf.papers.v1` pruned to 0; nav `Collections` | **pass** |
| **Import a collection** | 3-paper payload | `Imported Set` survives; 2 cards. The `javascript:` URL paper is **dropped**; the `null`-URL paper is **kept** with no links | **pass** |

Import error paths both fire the right single alert: `{not json` →
`"Could not read that file as JSON."`; `{"hello":"world"}` →
`"That file does not look like a collection export."`

Corrupted `localStorage` (`{broken` / `}}}`) degrades to
`"You have no collections yet. Create one above, or save papers from the feed."` with no
alert and no crash.

**IMP-011's save-failure notice works in the scenario it was written for.** Storage healthy at
boot, then `Storage.prototype.setItem` made to throw: the banner
*"Collections could not be saved. This browser's storage may be full or blocked, so anything
you just changed will be lost when you reload this page."* mounts with `role="alert"`, and it is
the only alert on the page. **But see finding F1** for the adjacent blocked-at-boot case.

---

## 5. Playwright sweep — 56 screenshots, both viewports, production build

All from `npm run build` output served by `vite preview`; a `/tmp` copy of `dist` with a
mutable `data/` let every data error surface be driven for real.

**Feed.** Default feed 2,812 papers / 50 rendered. Load-more control reads
`Load 50 more (2762 remaining)` and goes 50 → 100. Recency 7 / 30 / 60 all correct (see F7).
Relevance is disabled with `"Enter a search term to sort by relevance."` until a query exists,
then sorts and enables. Zero-match search renders the empty state with 0 articles and
`0 papers match`. Whitespace-only query behaves as no query. `visibleCount` resets to
`PAGE_SIZE` on any query/recency/category/sort change (`App.tsx:366-368`) — correct
list-reset-on-filter-change.

**Categories.** All → none selected renders `"No categories selected"` with a
`Select all categories` recovery button, and recovery restores 50 papers. Partial selection
round-trips through the hash (`#cat=cs.CV%2Ccs.CL%2Ccs.AI%2Ccs.RO`) and is reversible.
`#cat=` (empty) degrades to the same none-selected state. `#cat=nope.NOPE` renders the
unknown-category alert naming the value, with a `Reset category filter` button.

**Collections.** Empty state and populated state at both widths; import success and both import
error paths; storage-blocked banner.

**Every error surface, with its recovery path, all verified live:**

| Surface | Rendered | Recovery |
| --- | --- | --- |
| `index.json` absent | `No paper index yet`, 1 alert | `Try again` → verified: restore data, click, feed returns (2,812 papers, 0 alerts) |
| `index.json` = `null` / `[]` / `"hello"` / `{oops` / empty file / HTML body | "The paper index on this site could not be read…", 1 alert each | `Try again` present; verified that a still-broken manifest honestly stays broken and a repaired one heals to the full feed |
| one corrupt shard | non-fatal: `"Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026)…"` | feed continues, 2,549 papers |
| manifest names a non-existent shard | same non-fatal banner | same |
| all shards absent | `"Papers could not be loaded… This is a loading failure, not an empty window."` + `Try again` | verified: restore shards, click, feed returns |
| `shards: []` | `"No papers are available in this window yet."`, 0 alerts | unreachable in production — both guards refuse to build or publish such an index |
| save failure | alert banner, 1 alert | §4 |
| unknown category | alert naming the value | `Reset category filter` |
| storage unavailable | banner on the Collections tab | — (see F1) |

**Incomplete-index notice.** A producer-faithful fixture (`failedCategories: ["cs.RO"]`,
`truncatedCategories: ["cs.CV"]`, and `cs.RO` removed from `categories` exactly as
`build_index.main()` writes it) renders one warning banner:
*"This index is incomplete. cs.RO could not be fetched… no filter to browse. cs.CV was cut off
at this index's per-category limit…"*, with the header reading `2,412 papers from cs.CV, cs.LG,
cs.CL, cs.AI` — the failed category's chip is gone from the filter, as designed. A
two-and-two variant names both lists correctly.

**Deep links.** All eight exercised: `#view=collections`, `#q=…&sort=relevance&recency=30`,
`#cat=cs.AI&recency=7&sort=newest`, `#cat=nope.NOPE`, `#cat=`, `#recency=99` (falls back to 60
days), `#view=bogus` (falls back to feed), `#garbage=%zz` (tolerated).

**Console and network.** **Zero console messages and zero failed requests** from the
production build across four contexts (light/dark × 1280/390) while exercising search,
relevance sort, recency change, category toggle and load-more. Every `console.error` observed
anywhere in the sweep was the app's own deliberate `paper feed: …` diagnostic, one per failure
state and one-to-one with the rendered error. The only `requestfailed` events were
`net::ERR_ABORTED` on `data/*.json`, caused by my own harness navigating away mid-load, plus
two `fonts.gstatic.com` fetches aborted because this sandbox has no outbound access to Google.

**Mobile (390px).** No horizontal overflow in any state — `scrollWidth === clientWidth === 390`
for the feed, search, no-categories, unknown-category, save-menu and collections views.

**Servers stopped.** `vite preview` on 5210 and 5211 both terminated; `vite dev` on 5199/5201
terminated earlier.

---

## 6. Alert / role hygiene

Per state, counted live regions in the DOM and checked which one is visible:

| State | `role="alert"` | `role="status"` | Total live | Verdict |
| --- | --- | --- | --- | --- |
| feed default (1280 and 390) | 0 | 1 (count) | 1 | intended one only |
| no categories selected | 0 | 1 (count) | 1 | correct — this is not an error state |
| unknown category | 1 | 1 (count) | 2 | one alert, no double-announce |
| one corrupt / missing shard | 1 | 1 (count) | 2 | one alert |
| incomplete index | 1 | 1 (count) | 2 | one alert |
| all shards absent | 1 | 1 (count) | 2 | **the warning banner correctly stands down** so the hard-failure panel is the single announcement, exactly as `App.tsx:779-781` intends |
| index missing / `null` / array / string / malformed / empty / HTML | 1 | 0 | 1 | one alert |
| `shards: []` | 0 | 1 (count) | 1 | correct — empty window, not an error |
| save failure | 1 | 1 (count) | 2 | one alert |
| storage unavailable | 1 | 0 | 1 | one alert |

**No state double-announces.** Every `role="alert"` is either the single hard-failure panel or
a single banner, never two error regions at once, and each is mounted only while its condition
holds so the assertive announcement fires once per failure rather than per render.

---

## 7. Accessibility spot-check — computed independently

I implemented the WCAG relative-luminance and contrast-ratio formulas myself
(`/tmp/rpf6-sweep/contrast.js`) rather than trusting a report. **23 of 23 pairs pass.**

`--border` after IMP-013 (`e2af26d`) clears the 3:1 non-text requirement on every surface:

| | vs `--surface` | vs `--bg` | vs `--surface-muted` |
| --- | --- | --- | --- |
| light `#898783` | 3.59:1 | 3.41:1 | **3.14:1** ← worst |
| dark `#6a727e` | 3.40:1 | 3.73:1 | **3.13:1** ← worst |

Worst margin +0.13, i.e. +4.2% over the bar — not a rounding artifact. `--text-muted` still
clears 4.5:1 everywhere: light `#666661` gives 5.77 / 5.48 / 5.06 (and 5.01 against
`--accent-soft`); dark `#9b9b94` gives 5.91 / 6.48 / 5.44. Error and warning text pairs clear
too (5.62 and 6.72 light; 6.70 and 9.37 dark).

**Search focus ring visible on keyboard focus.** Tab reaches the skip link first (`.skip-link`),
and focusing the search input yields `outline: 2px solid rgb(31,111,92)` at
`outline-offset: 2px` with `el.matches(':focus-visible') === true`. The built CSS contains
exactly two `outline` tokens — `outline: 2px solid var(--accent)` and `outline-offset: 2px`, both
in the pre-existing global `:focus-visible` — and **zero `outline: none`**. Confirmed live in
dark mode too (`--accent` `#3aa98a`, input border `#6a727e`).

---

## 8. Python pipeline end-to-end into `/tmp`

`build_index.py --category cs.CV --max-per-category 40 --out-dir /tmp/rpf6-pipe` → **exit 0**,
`Wrote 40 papers across 1 shards`.

- `index.json` exists.
- Every `shards[].file` resolves to a real file.
- No shard older than retention: cutoff 2026-08-04 (60 days before `generatedAt` 2026-10-03);
  oldest paper 2026-10-01. Zero stale.
- Plausible count: `totalPapers` 40 == the 40 papers actually in the shard.
- `truncatedCategories: ["cs.CV"]` present, `failedCategories` **absent** — exactly the
  both-keys-absent-when-nothing-failed contract.
- `categories: ["cs.CV"]`; JSON is well-formed.

Flag validation, from the repository root:

| Command | Exit |
| --- | --- |
| `build_index.py --retention-days 0` | **2** |
| `build_index.py --category 'cs.CV foo'` | **2** |
| `build_index.py --abstract-chars -3` | 2 |
| `build_index.py --max-per-category -1` | 2 |
| `paper-collector.py --max-papers 0` | 2 |
| `paper-collector.py --topic '../x'` | 0, output confined to `results/` — nothing in the repo root or the parent directory |

---

## 9. Docs executed verbatim

`CONTRIBUTING.md` and `readme.md` onboarding run in **one continuous shell** (no subshells, so
`source .venv/bin/activate` actually persists) from a clean `git archive HEAD` copy in
`/tmp/rpf6-docs`. Script: `/tmp/rpf6-sweep/docs2.sh`.

Every documented step exits 0 except two, and both failures are the *correct* documented
behaviour rather than a docs defect:

- `readme.md` step 1, `python scripts/build_index.py --category cs.CV --max-per-category 300`,
  exited 1 with `HTTP 429` from arXiv on all 6 attempts. This machine is rate-limited by
  arXiv after my repeated calls this session; the identical command succeeded earlier in this
  sweep (§8) and a retry after a 4-minute cooldown was still 429. The app behaved exactly as
  IMP-004 specifies: logged `Refusing to write an index: the arXiv query failed for cs.CV.`
  and wrote nothing rather than shipping a short index.
- `npm run build`, which then failed the guard because step 1 produced no index. That is
  IMP-028's gate working, and §2 confirms it passes once an index exists.

Steps that passed, in order: `python3 --version`; `python3 -m venv .venv`;
`source .venv/bin/activate`; `python --version`; `python -m pip install -r requirements.txt`;
`python -m unittest discover -s tests -v` (104, OK); `npm install`; `npm run dev` (HTTP 200 on
`/research-paper-feed/`, served the app); `npm run typecheck` (exit 0); `npm test`
(292/292 across 19); `python -m pip install -r requirements.txt`; both documented
`paper-collector.py` invocations including the interactive one; `build_index.py --help`;
`paper-collector.py --help`; and all five documented rejections exit 2 as advertised.

Every flag in the `readme.md` prose matches `--help`: `--retention-days` (1+, default 60),
`--max-per-category` (0+, default 0, clamped to arXiv's 30,000 ceiling),
`--abstract-chars` (1+, default 500), `--category` (repeatable, `cs.AI`/`stat.ML`/`astro-ph.HE`
shapes), `--out-dir` (default `web/public/data`), and the full `paper-collector.py` table
(`--topic`, `--max-papers` 1+ default 1000, `--output-dir` default `results`, `--download-pdfs`,
`--download-sources`, `--save-csv`).

---

## 10. History hygiene

- **`git status --porcelain`**: exactly three untracked files, all
  `.improve/reports/*.md` (`discovered-IMP-002.md`, `discovered-IMP-009.md`,
  `regression-sweep-4.md`) — pre-existing, not mine. Nothing else.
- **No tracked junk.** No `__pycache__`, `*.pyc`, `.DS_Store`, `dist/`, `node_modules/`,
  `public/data/`, `results/*.html|csv`, `.venv/`, `.pytest_cache/` or `extracted/` path is
  tracked. 192 tracked files.
- **`scripts/build_index.py` present and intact** — 529 lines, parses, `compileall` exit 0,
  working tree byte-identical to HEAD.
- **Commits atomic.** Every commit in the range is scoped to one item; 39 of 76 are
  `.improve`-only bookkeeping commits kept separate from the fix commits. The largest source
  commit is `c968a01` (IMP-204) at 11 files — deploy workflow, both Python scripts, both test
  files, the app, three web tests, `failureCopy.ts` and `types.ts` — all of which are one
  coherent "partial index" change. `894fb9b` (IMP-005) at 5 source files is one coherent
  "enable component tests" change.
- **Conventional commits**: `chore` 38, `fix` 27, `test` 7, `feat` 2, `ci` 2, `style` 1,
  `refactor` 1, `docs` 1, and one `a11y:` — see F5.
- **`.improve/PROGRESS.log`**: 45 rows, all four fields present on every row, every timestamp a
  well-formed ISO-8601 `Z`, every status in `{DONE, FIXED, FOUND, CLEAN, FAIL, PENDING}`, every
  id matching `IMP-N`, `IMP-NX` or `REGRESSION-N`. **44 of 45 well-formed**; the single anomaly
  is F4. Its REGRESSION-5 row correctly records the recovery of `scripts/build_index.py` after
  a sub-agent deleted it — confirmed present and intact above.

---

## Findings (none blocking; none a regression)

**F1 — medium, pre-existing. The Feed tab gives no notice when `localStorage` is unavailable
at boot.**
`App.tsx:422` reads `if (!storageAvailable || !unsavedChanges.current) { return; }`. When
`detectStorage()` (`App.tsx:45-54`) fails, `storageAvailable` is `false`, so the effect returns
before `saveState` is ever called, so `setSaveFailed` never runs and the IMP-011 banner at
`App.tsx:565-576` never mounts. Reproduced in a real browser: with the `localStorage` getter
throwing, creating a collection from a paper card's save menu leaves the reader with
`Collections (1)` in the nav, the collection in memory, and **zero alerts on the Feed tab**.
The only notice is `CollectionsView.tsx:184-189`, on the other tab. This undercuts the intent
stated in the code's own comment — *"Outside the view branch because a save can fail from
either tab"* — because the gate makes the cross-tab case unreachable. Not introduced by this
batch: at `fc77a40` the effect also skipped saving when `!storageAvailable`; what this batch
added is the alert, which the gate then bypasses.
*Minimal fix:* drop `!storageAvailable` from the effect's guard and let `saveState` report the
failure (`defaultStorage()` already returns `null` → `saveState` returns `false` → the banner
shows), or keep the guard and add `if (!storageAvailable && unsavedChanges.current) {
unsavedChanges.current = false; setSaveFailed(true); }`.

**F2 — cosmetic. `require-index.mjs` reports a JSON `null` manifest as a stack trace.**
`checkShardFiles` (`require-index.mjs:79-82`) reads `manifest.shards` before any type check, so
a manifest of `null` throws `TypeError: Cannot read properties of null (reading 'shards')` at
`:80` instead of naming the problem. Exit is still **1**, so the build still fails closed and
`vite build` is still never spawned — no gate hole. Every other malformed shape I tried
(`[]`, `"hello"`, `{oops`, empty file) produces the clean "is not an index manifest" message.
`require-index.mjs:121-123` names this exact failure mode as the one the design exists to avoid.
*Minimal fix:* extend the existing check to
`if (manifest === null || typeof manifest !== "object" || !Array.isArray(manifest.shards))`.

**F3 — cosmetic. `deploy.yml`'s assertion prints a raw Python traceback before its `::error::`
line.** The `if ! shards="$(python3 -c …)"` subshell at `deploy.yml:129` inherits stderr, so a
malformed, array or `null` manifest emits a ~15-line `json.decoder.JSONDecodeError` traceback
into the job log before the clean `::error::` annotation. The annotation and `exit 1` both still
fire and the gate is correct; only the log is noisy.
*Minimal fix:* capture and discard the subshell's stderr, e.g.
`shards="$(python3 -c '…' "${data_dir}/index.json" 2>/dev/null)"`.

**F4 — cosmetic. One malformed `.improve/PROGRESS.log` row.** Line 32:
`2026-10-02T18:45:40Z | REGRESSION-4 | FIXED | pending (flake fixes in 3 test files; PROGRESS.log
normalized)` — the fourth field is `pending` rather than a SHA. Line 33, one second later, records
the real SHA `2c73ec9`, so it is a superseded placeholder rather than lost information.
*Minimal fix:* delete line 32.

**F5 — nit. One conventional-commit type outside the repo's established set.** `e2af26d` uses
`a11y:`. Every other commit in the range uses `chore` / `fix` / `test` / `feat` / `ci` / `style` /
`refactor` / `docs`, which is what `REPO_PROFILE.md` §5.1 records as the real history.

**F6 — nit, documented. The guard suite hard-fails outside a repo-root checkout.**
`web/scripts/__tests__/indexGuards.test.mjs` reads `../../../readme.md` and
`../../../.github/workflows/deploy.yml` with `readFileSync`, so in a `web/`-only clone `npm test`
fails with `ENOENT` on two tests rather than skipping them. `REPO_PROFILE.md` §3.3 documents this,
so it is the pre-existing baseline — but it does mean the two guard tests can only ever run
from a full checkout, on CI and in the working repo.

**F7 — observation, correct behaviour. All three recency windows report the same count on the
shipped index.** 7, 30 and 60 days all show `2812 papers match`. This is arithmetic, not a bug:
`latestIndexDate` is 2026-10-01, the index's oldest paper is 2026-09-24, and
`windowStart("2026-10-01", 7) = 2026-09-24` — so the 7-day window already admits the entire
index. The shipped data is 8 days stale; the windows become distinguishable after the next
deploy. Recorded so a future verifier does not read it as a filter bug.

---

## Evidence

- Report: `.improve/reports/regression-sweep-6.md`
- Screenshots (56): `.improve/artifacts/regression-6/`
- Sweep drivers: `/tmp/rpf6-sweep/{a,b,c,d,e,f}.js`, `contrast.js`, `docs2.sh`
- Guard fixtures and results: `/tmp/rpf6-guard/run.sh`, `/tmp/rpf6-guard/assert.sh`
- Isolated web copies: `/tmp/rpf6-web` (no data), `/tmp/rpf6-root` (repo-root layout),
  `/tmp/rpf6-serve` (mutable `dist`)
- Pipeline output: `/tmp/rpf6-pipe`
- Docs execution tree: `/tmp/rpf6-docs`
- Machine-readable sweep output: `/tmp/rpf6-sweep{1,2,3,4,5}.json`

No repo file was deleted, moved, or restored; no git write command was run; nothing was
pushed; `.kilo/worktrees/mildly-income/` was never read.