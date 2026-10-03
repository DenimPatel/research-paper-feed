# Regression sweep #7 — `c1a89bd..HEAD`

Range: IMP-030, IMP-041, IMP-037, IMP-216, IMP-219, IMP-042, plus `4a39b84`
(FEATURES.md newline repair) and two bookkeeping commits (`f1c211a`, `3772791`).
Branch `improve/auto-20261002`, working tree clean at sweep start and end.

**VERDICT: CLEAN.** No regression attributable to this batch. Four baselines
hold exactly. Two pre-existing defects were re-confirmed as pre-existing by
building the `c1a89bd` tree and reproducing the identical failure.

---

## 1. Baselines — all four measured, none drifted

| Gate | Command | Measured | Baseline | Verdict |
|---|---|---|---|---|
| Python | `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | **119 tests, OK, 1.185 s** | 119 OK ~1.1 s | hold |
| Web | `cd web && npm test` | **20 files / 293 tests passed**, 8.89 s | 20/293 | hold |
| Typecheck | `cd web && npm run typecheck` | exit 0, no output | clean | hold |
| Build | `cd web && npm run build` | exit 0, 41 modules, JS **172.52 kB**, CSS **10.91 kB** | 172.50 / 10.91 | within noise (see §6.4) |

JS moved 172.50 → 172.52 kB (+0.02 kB). Attribution: IMP-219 adds
`timeZone: "UTC"` to one `Intl.DateTimeFormat` options object plus a 13-line
docblock; that is the whole delta. Not a regression.

`npm audit` → **5 vulnerabilities (3 moderate, 1 high, 1 critical)** — identical
to the recorded pre-existing set (vitest 2.1.9 critical, vite 5.4.21 high).
No new advisories.

### Hermeticity — proven, not asserted

Ran the suite in a child process with `socket.socket.connect`, `create_connection`
and `getaddrinfo` patched to raise `NetworkAccessAttempted` on **any non-loopback**
target:

```
Ran 119 tests in 1.128s
OK
```

Loopback had to stay open: one test fixture binds a fake arXiv server on
127.0.0.1. A first attempt that blocked loopback too produced 1 failure
(`Max retries exceeded ... 127.0.0.1:63222`) — that was my harness, not the
suite. The suite touches no network.

---

## 2. Full-stack web sweep

Built `web/dist` against the real committed index
(`web/public/data/index.json`, 5 shards, `totalPapers` 14,253) and served it two
ways: `vite preview` on :4319, and a controlled Node origin on :4321 that can
serve synthetic manifests. Playwright `chromium` (playwright-core 1.61.0-alpha).

**63 screenshots + 2 JSON state dumps in `.improve/artifacts/regression-7/`.**

### States walked, at both 1280×900 and 390×844

| State | URL / action | Result |
|---|---|---|
| Feed, default | `/` | 14,253 match; 50 cards; chips All+cs.CV/LG/CL/AI/RO; 60 days; Newest |
| Empty search | `#q=zzzznotarealterm` | `0 papers match` |
| Search + relevance | `#q=language+model&sort=relevance` | 3,518 match, Relevance enabled |
| No results | `#q=qqqzzzqqq` | `0 papers match` |
| Each chip | `#cat=cs.CV / cs.LG / cs.CL / cs.AI / cs.RO` | 3412 / 5434 / 2653 / 5710 / 2131 — matches the shard union count exactly for all five |
| No categories | `#cat=` | `0 papers match` |
| Recency | `#recency=7 / 30 / 60` | 6,028 / 14,253 / 14,253; pressed chip moves |
| Sort | `#sort=newest`, `#sort=relevance` (no q) | Relevance stays disabled with its hint |
| Collections, empty | `#view=collections` | "You have no collections yet." |
| Collections, populated | seeded `rpf.collections.v1` + `rpf.papers.v1` | "Smoke Set (3)", Rename/Export/Delete, 3 cards, Remove buttons |
| Save menu open | click Save on card 1 | opens at both widths |
| Garbage deep link | `#view=bogus&cat=cs.NOPE&recency=999&sort=nope` | falls back to Feed; "Unknown category: cs.NOPE… Reset category filter" — recovers, no crash |
| Unknown category on a failed cat | `#cat=cs.RO` under a failed manifest | "Unknown category: cs.RO" — honest |
| Index unavailable | 404 / text-html 200 / `null` / `[]` / `{oops` | "No paper index yet" + Try again (404/html) or the malformed copy (null/[]/badjson) |
| Retry × 3 consecutive failures | click Try again 3× | retry control found and clicked **3/3**, panel persists, recovers |

### Console errors

**No new console error and no unhandled rejection in any state reachable from a
valid or honestly-degraded index.** Two error classes appeared, both confined to
deliberately corrupt manifests and both **pre-existing** (§3):

- `IndexUnavailableError` console noise on 404/html/null/`[]`/bad-json — the
  app's own designed diagnostic, and the panel still renders.
- `TypeError: Cannot read properties of undefined (reading 'map'/'join')` →
  full-page error boundary, only for a 200-JSON manifest missing `shards` or
  `categories`.

I did **not** widen a timing window in `/tmp` for the retry path: 3/3 retries
re-fetched and re-rendered deterministically across both origins. No race
observed.

---

## 3. Pre-existing defects re-confirmed (NOT regressions)

### 3.1 Malformed-but-200 manifest still hard-crashes the page

`fetchManifest` validates only that the body is a plain object, and says so
(`web/src/lib/paperIndex.ts:196-198`: *"Whether that object has the fields the UI
reads is a separate question — IMP-098 owns those checks"*). A 200 JSON
`index.json` that is `{}` or lacks `shards` reaches the UI and crashes it.

Built the pre-batch tree and ran the identical probe against both:

```
### PRE-BATCH (c1a89bd) ###
noShards     crashed=true  TypeError: ... reading 'map'   at index-Cz853rdl.js:41:3409
noCategories crashed=true  TypeError: ... reading 'join'  at index-Cz853rdl.js:41:7655
### HEAD ###
noShards     crashed=true  TypeError: ... reading 'map'   at index-Cn0orISQ.js:41:3409
noCategories crashed=true  TypeError: ... reading 'join'  at index-Cn0orISQ.js:41:7655
```

**Byte-identical failure, same offset, both trees.** Pre-existing, owned by
IMP-098. `shardNotArray` (a shard entry missing `to`) does **not** crash on
either tree. No commit in this range introduced it.

### 3.2 A category that answers with nothing in-window keeps a hollow chip

Pre and post behave **identically** (see the matrix in §4.3, last row): five
chips, zero papers, no `failedCategories`, no `truncatedCategories`. Unchanged
by this batch; and in the real pipeline `main()` refuses to write an index at
all when the total is 0 (`scripts/build_index.py:610-618`), so it is not
shippable. Pre-existing (IMP-204 lineage).

---

## 4. Targeted checks on the risky changes

### 4.1 IMP-219 — UTC publication dates

**Sharded ground truth, 200/200 exact.** Served the real index, widened to
`#recency=60`, loaded more pages, then for every card joined
`href → arXiv id → web/public/data shard record` and compared the rendered text
against `new Date(published + 'T00:00:00Z')` formatted in UTC, plus `dateTime`
against `published`:

```
America/New_York  50 cards  50 matched  0 mismatches
UTC               50 cards  50 matched  0 mismatches
Asia/Tokyo        50 cards  50 matched  0 mismatches
Pacific/Kiritimati 50 cards 50 matched  0 mismatches   (UTC+14)
```

Not shifted the *other* way: every card reads its own shard day, including the
month boundary (shard `papers-2026-W40.json` papers dated `2026-10-01` render
"Oct 1, 2026", and `2026-09-30` renders "Sep 30, 2026").

**The fix is real and observable (positive control).** Same harness, PRE build:

```
PRE : "Sep 30, 2026 | dateTime=2026-10-01"   <- text contradicts its own attribute
HEAD: "Oct 1, 2026  | dateTime=2026-10-01"   <- agree
```

**`formatGeneratedAt` stayed local, as required.** It is deliberately untouched
(`web/src/App.tsx:64-74`, no `timeZone` pin) and measurably still local — the
header's "index generated …" *does* move with the reader's zone while card dates
do not, which is the exact desired split:

```
tz UTC                card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
tz America/Los_Angeles card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
tz Pacific/Honolulu   card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
tz Asia/Kolkata       card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
tz Asia/Kathmandu     card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
tz Pacific/Kiritimati card "Oct 1, 2026 | 2026-10-01"   generated "Oct 4, 2026"  <- +14h crosses midnight
tz Pacific/Midway     card "Oct 1, 2026 | 2026-10-01"   generated "Oct 2, 2026"  <- -11h falls back a day
tz Asia/Tokyo         card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
tz Europe/Berlin      card "Oct 1, 2026 | 2026-10-01"   generated "Oct 3, 2026"
```

10 zones: card date invariant, generated-at local. Both halves of the fix hold.

**Disclosed limitation, re-measured (low severity, not a regression).** The
IMP-037/219 assertion `expect(textContent).toBe("Jan 2, 2024")` is en-US-only.
The previous assertion (`toContain("2024")`) was locale-tolerant; this one is
not:

```
en-US  1 passed
sv-SE  1 failed
de-DE  1 failed
ja-JP  1 failed
fr-FR  1 failed
```

CI sets no `LANG`/`LC_ALL`/`TZ` (checked `ci.yml`), and ubuntu-latest resolves
to `en-US`, so the gate stays green. This is recorded in IMP-219's own Notes
and assigned to IMP-125's locale decision; flagged here only so it is not
rediscovered as a surprise.

### 4.2 IMP-216 — truncation classification and manifest honesty

`index.json`'s `truncatedCategories` / `failedCategories` against the shards, on
the committed index: **both keys absent** (correct — nothing failed, nothing was
capped, and `write_index` omits empty keys, `build_index.py:491-494`). All five
chips have papers:

```
chips cs.CV 3412 · cs.LG 5434 · cs.CL 2653 · cs.AI 5710 · cs.RO 2131
HOLLOW chips (chip but 0 shard papers): []
union count over 14,253 papers == index.totalPapers, 14,253 unique ids
```

Synthetic manifests served to the real app, both widths:

- `truncatedCategories: ["cs.LG"]` → *"This index is incomplete. cs.LG was cut
  off at this index's per-category limit, so older papers from it may be
  missing."* **cs.LG keeps its chip**, and `#cat=cs.LG` still returns
  **5,434 papers**. Truncated ⇒ honest + chip kept + filter works.
- `failedCategories: ["cs.RO"]`, chip dropped → *"cs.RO could not be fetched from
  arXiv when this index was built, so it has no papers here and no filter to
  browse."* `#cat=cs.RO` answers *"Unknown category: cs.RO"*, not "no papers
  match your filter". Honest.

**End-to-end through the real pipeline.** `collect_papers → reconcile →
build_shards → write_index`, `--max-per-category 10000`, with a faked
`iter_results` that pages then raises `ArxivError` at a deep offset. Both trees
run side by side:

| Scenario | PRE `c1a89bd` | HEAD |
|---|---|---|
| cs.AI yields 1,000 papers, **then** deep offset 500s | `failed=['cs.AI']`, **chip removed**, 50 cs.AI papers in shards → **manifest contradicts its own shards** | `truncated=['cs.AI']`, **chip kept**, 0 contradictions ✅ |
| cs.AI 500s with **nothing** collected | `failed=['cs.AI']`, chip removed | identical — unchanged ✅ |
| cs.AI query 500s, cs.LG cross-lists papers carrying cs.AI | `failed=['cs.AI']`, **chip removed**, 50 papers in shards → **contradiction** | `truncated=['cs.AI']`, chip kept, 0 contradictions ✅ |
| cs.AI answers 200 papers, **all out of window** | 5 hollow chips | identical — unchanged (pre-existing, §3.2) |

IMP-216 closes exactly the dishonesty it claims, and changes nothing else.

### 4.3 IMP-042 — `dedupe_records` no longer mutates its caller

Differential harness importing both trees and running 600 randomised inputs
(0–12 records, duplicate ids, overlapping category sets, differing authors):

```
cases=600  output_mismatch=0  input_mutated_NEW=0  input_mutated_OLD=422
```

- **Deduped output unchanged**: 0 of 600 differ, deep-compared as sorted JSON.
- **The hazard was real**: `c1a89bd` mutated the caller's input in 422 of 600
  cases; HEAD in 0.
- **Index totals unchanged**: `build_shards` on 400 records produced a
  byte-identical manifest *and* byte-identical shard contents
  (`totalPapers` 400, shards `[49, 351]`), against `git show c1a89bd:scripts/build_index.py`.
- **Disclosed alias limit unchanged**: output still shares `authors`/`meta`/
  `flags`/`blob` by identity. Unreachable — `dedupe_records` writes only
  `categories`, now cloned.

### 4.4 Order-independence — deliberate, not assumed

The loop has six prior order-dependent flakes, so this got real repetition.

| Suite | Runs | Result |
|---|---|---|
| `npm test` (declared order) | 6 | 20 files / 293 tests passed, every run |
| `npx vitest run --sequence.shuffle` | 5 | 20 files / 293 tests passed, every run |
| `python3.11 -m unittest discover -s tests` | 8 | OK, every run |
| `npm test` under non-loopback network block | 1 | 119 OK |

**11 web runs (6 ordered + 5 shuffled) and 8 Python runs, zero flakes, zero
failures.** `vitest` supports `--sequence.shuffle` and the suite is green under
it. No race suspected, so no timing window needed widening.

### 4.5 `4a39b84` — FEATURES.md rebuild

Structural parse of the current file against `git show c1a89bd:.improve/FEATURES.md`:

```
item headings:  217 now  vs  212 at c1a89bd
ids only in old: []                 <- nothing lost
ids only in cur: IMP-216..IMP-220  <- purely additive
items missing any required field:  0
field bodies that SHRANK vs c1a89bd: 0
```

Every one of the 217 items carries **Status / Category / Type / Intent /
Acceptance criteria / Verification method / Effort / Risk / Priority score /
Depends on / Notes**. Byte hygiene: 0 CR bytes, 0 lone CR, ends with a newline,
3782 lines. Lines >400 chars: 378 (old) → 412 (cur), tracking the 5 added
items; the 6841-char maximum is an IMP-216 `- **Notes:**` prose block following
the file's existing convention, not run-on corruption. **Backlog intact and
parseable; no item content lost.**

### 4.6 IMP-041 — deploy gates, and IMP-030 — README hero

- `deploy.yml` order verified: `Run Python tests` and `Typecheck` both sit
  **above** `Build the paper index`, and `npm ci` precedes typecheck. Gates are
  `python -m unittest discover -s tests -v` and `npm run typecheck` — both exist
  and both pass locally.
- `--max-per-category 10000` matches `DEPLOY_OFFSET_BUDGET = 10000`, and
  `tests/test_build_index.py:1385-1400` pins the workflow against the constant,
  so the two cannot drift silently.
- Doc accuracy spot-check: `deploy.yml:91` says "The client's 5 retries over
  ~60 s"; `scripts/arxiv_common.py:18` is `DEFAULT_NUM_RETRIES = 5`. **Accurate.**
  (IMP-216's *commit message* says "6-attempt retry loop", which counts the
  initial attempt plus 5 retries — prose in a commit body, not shipped code.)
- IMP-030: `readme.md:11` → `images/feed_example.png` exists (112,406 bytes).
  All local readme targets resolve; `MISSING: []`.

---

## 5. Findings

| # | Finding | Severity | New? | Commit |
|---|---|---|---|---|
| 1 | `PaperCard.test.tsx` date assertion is en-US-only; sv/de/ja/fr red (was 5-of-6 locale-tolerant) | low | new limitation, **disclosed** in IMP-219 Notes, CI unaffected | `1243437` |
| 2 | 200-JSON manifest missing `shards`/`categories` hard-crashes the page | medium | **pre-existing**, identical at `c1a89bd` | not this batch (IMP-098) |
| 3 | Category answering with 0 in-window papers keeps a hollow chip | low | **pre-existing**, identical at `c1a89bd` | not this batch |
| 4 | `dedupe_records` output still aliases `authors`/`meta`/`flags`/`blob` | info | pre-existing, disclosed, unreachable | not this batch |
| 5 | `web/src/components/__tests__/PaperCard.test.tsx` has no trailing newline | info | new, cosmetic | `1243437` |

Nothing in 1–5 blocks. Findings 2–4 are confirmed pre-existing by direct
comparison against the `c1a89bd` build.

---

## 6. Notes on method

### 6.1 Why the baseline screenshot cannot be pixel-compared here

Direct PNG comparison of `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`
against my HEAD capture reports 15.46 % of pixels differing, on **820 of 900
rows including row 0** — the header background.

That number is an artefact of the capture environment, not a regression, and the
suite of measurements proves it:

1. Two HEAD captures in one session are **byte-identical (0 px differ)**, so
   my environment is deterministic and the baseline came from a different one.
2. Best-fit vertical offset between baseline and HEAD is **0**; the ink profile
   starts at row 32 (baseline) vs 31 (HEAD) and ends at 899 for both — a **1 px
   text-baseline rasterisation jitter**, plus a 1-unit blue-channel dither in the
   flat background (`250,249,246` vs `250,249,245`, and inconsistent between
   rows of my *own* capture).
3. Decisive control: **baseline vs the `c1a89bd` PRE build differs by 15.4752 %**
   — *more* than baseline vs HEAD. A difference the pre-batch build shares with
   HEAD cannot be attributed to this batch.

The committed baseline was re-captured at 08:24 on Oct 3 by IMP-219's
implementer, in a slightly different rendering environment. It already shows the
*fixed* date ("Oct 1, 2026").

### 6.2 The measurement that does isolate this batch

Both trees captured by me, same environment, proven deterministic:

```
PRE-vs-HEAD desktop: 704 px (0.0611%)  rows=13  bbox=(185,616)-(271,628)
PRE-vs-HEAD mobile:  704 px (0.2139%)  rows=13  bbox=(33,762)-(119,774)
```

The **only** pixels this batch changes are 704, confined to a 13-row band on the
date line, and the box is *narrower* at HEAD (ends at x=271 vs a start at 185)
because "Oct 1" is shorter than "Sep 30". **No layout shift, no reflow, no other
visual difference at either width.** That is the real visual footprint of the
batch.

### 6.3 Anything I could not verify

- The real arXiv 5xx at `start=10000` was **not** re-hit (no network egress by
  design; hermeticity is a hard baseline). IMP-216's behaviour was instead
  driven end-to-end through the real pipeline with a faked paged `iter_results`
  that raises `ArxivError` at a deep offset — the same code path, deterministically.
- Not exercised: `--download-pdfs` / `--download-sources` (pre-existing arxiv
  4.x crash, IMP-093 owns it) and `jupyter nbconvert` (fails by design).
- Deploy quality gates were checked for existence, ordering and the
  constant↔workflow pin, not by running the workflow on a runner.

### 6.4 Re-run of every gate

`python -m unittest discover -s tests -v` → 119 OK ·
`npm test` → 20/293 · `npm run typecheck` → exit 0 ·
`npm run build` → 41 modules, JS 172.52 kB, CSS 10.91 kB ·
`npm audit` → 5 (unchanged) · 11 web suite runs, 8 Python runs, 0 flakes.

---

## Evidence

- Screenshots (63) + state dumps: `.improve/artifacts/regression-7/`
  - `report.json`, `report2.json` — every walked state, status text, chip pressed-state, `<time>` text vs `dateTime`
  - `cmp-PRE-c1a89bd-*.png` / `cmp-HEAD-*.png` — the §6.2 isolation pair
  - `notice-truncated-csLG-*`, `notice-failed-csRO-*` — IMP-216 honesty at both widths
  - `unavail-{404,html,null,array,badjson,noShards}-*`, `unavail-retry-x3-*`
  - `collections-{empty,seeded,detail}-*`, `savemenu-open-*`, `deeplink-garbage-*`
- Harnesses (all outside the repo): `/tmp/sweep7/`
  - `sweep.js`, `sweep2.js` — state walk + console/pageerror capture
  - `crashprobe.js` — malformed-manifest probe, run against both trees
  - `datecontrol.js` — card-date + generated-at capture, both trees, with screenshots
  - `shardcheck.js` — rendered date vs shard `published`, 4 zones
  - `dedupe_diff.py` — 600-case `dedupe_records` / `build_shards` differential
  - `imp216_e2e.py` — 4-scenario pipeline matrix, PRE and HEAD
  - `netguard2.py` — non-loopback network block
  - `pngdiff.py` — dependency-free PNG diff/bbox
- Scratch builds: `/tmp/sweep7/pre/web/dist` (`c1a89bd`), `web/dist` (HEAD)
- Pre-batch reference: `git show c1a89bd:scripts/build_index.py` → `/tmp/sweep7/old_build_index.py`