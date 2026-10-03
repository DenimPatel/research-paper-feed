# Regression Sweep 4

**Range:** `fc77a40..HEAD` (`64ad36a`) — 49 commits, 25 improvement items.
**Date:** 2026-10-02
**Mode:** read-only. No source file was modified. The preview server was stopped, the
browser closed, and every scratch file and `/tmp` out-dir I created was deleted.
No git write command was run at any point; no worktree was needed.

## VERDICT: REGRESSIONS

Three regressions, all reproducible and all attributable to commits inside the range.
**No product-code regression was found.** The feed, load path, all nine error surfaces,
every recovery affordance, the category flow, the save path, and the error boundary behave
correctly in every state exercised, and **nothing silently stopped persisting** — the
regression-3 dispatch gate holds up under a real quota failure and a real reload.

Two of the three are `PROGRESS.log` defects; one is an order-dependent test flake that has
been live since IMP-016 and still bites.

`.improve/REPO_PROFILE.md` §7 states the baseline explicitly: *"All four baseline checks are
GREEN. There are zero failing checks."* Every finding below is therefore new, not a
re-baselined pre-existing failure.

---

## 1. Suites

| Suite | Command | Expected | Result |
|---|---|---|---|
| Python | `/usr/local/bin/python3.11 -m unittest discover -s tests` | 77 OK | **77 OK** |
| Python (oldest runnable) | same on 3.11 | 77 OK | **77 OK** — 3.11 is the oldest interpreter with `arxiv`/`pandas` installed |
| Python 3.8 / 3.12 / 3.13 / 3.14 | same on each | 77 OK | **3 import errors each** — `ModuleNotFoundError: arxiv`, `ModuleNotFoundError: pandas` |
| Python syntax | `compileall scripts tests` on 3.8 and 3.14 | clean | **OK on both** |
| Typecheck | `cd web && npm run typecheck` | clean | **clean**, exit 0 |
| Web tests | `cd web && npm test` | 253 / 16 files | **253 passed / 16 files** |
| Build | `cd web && npm run build` | OK | **OK** — `index.html` 1.00 kB, CSS 10.93 kB, JS 171.45 kB |

**Oldest-interpreter note (not a regression).** Both workflows pin `python-version: "3.x"`,
which resolves to the newest CPython, so CI never exercises 3.8. On this machine
`arxiv`/`pandas` exist **only** for `/usr/local/bin/python3.11`, so 3.11 is the oldest
interpreter that can actually import the suite, and it is green. The 3.8/3.12/3.13/3.14
failures occur during third-party import, before any project code runs.
`compileall` on 3.8 and 3.14 confirms the batch introduced no syntax-level incompatibility.

### Repeat / shuffle runs

| Mode | Runs | Failures |
|---|---|---|
| `npm test` (plain, fixed order) | **7** | **0** |
| `npx vitest run --sequence.shuffle` (whole suite) | **18** | **3** — all one test |
| `--sequence.seed=1790961487276` (the failing seed) | 2 | **2** — deterministic |
| `npx vitest run --sequence.shuffle src/__tests__/App.loadFailure.test.tsx` alone | 8 | **0** |

Total web runs: **35**, plus the seed replays. The flake is **strictly order-dependent**:
it never fires when the file runs alone, and never fires in the fixed order CI uses. So
`npm test` in CI is green and stays green — this is regression 1 below, not a red build.

---

## 2. REGRESSION 1 — order-dependent flake still live in `App.loadFailure.test.tsx`

* **Offending commit:** `166066d` — `fix(web): distinguish load failure from genuinely no papers [IMP-016]`
* **Location:** `web/src/__tests__/App.loadFailure.test.tsx:899-912`, assertion at `:906`
* **Severity:** test-only. No shipped-code impact, but it makes the suite
  non-deterministic and intermittently reds any run that shuffles.

**Reproduction (deterministic once a failing seed is known):**

```
cd web
npx vitest run --sequence.shuffle --sequence.seed=1790961487276
```

```
 FAIL  src/__tests__/App.loadFailure.test.tsx > the load failure alongside the other notices
       > coexists with the unknown-category banner as two distinct alerts
AssertionError: expected [ <p …(2)>…(2)</p> ] to have a length of 2 but got 1
 ❯ src/__tests__/App.loadFailure.test.tsx:906:42
```

Failing rate: **3 of 18** whole-suite shuffled runs (~17%). It does **not** reproduce with
`npx vitest run` (0/7) nor by shuffling that file alone (0/8) — another test file's timing
is what lets the second alert lose the race.

**Cause.** Line 904 awaits only the **first** alert, then line 906 immediately asserts there
are **two**:

```js
await screen.findByRole("alert");
expect(screen.getAllByRole("alert")).toHaveLength(2);
```

The unknown-category banner only renders once the manifest has resolved and
`resolveCategories` has dropped `cs.BI`, which can land after the load-failure panel. The
assertion races that arrival.

**Attribution.** The file does not exist at the backlog commit
(`git cat-file -e fc77a40:web/src/__tests__/App.loadFailure.test.tsx` → "does NOT exist").
`git log --diff-filter=A` gives `166066d`, and `git blame -L 899,912` attributes every line
of the block — including `:906` — to `166066d`. No later commit touched it.

**Same latent race nearby.** The sibling test at `App.loadFailure.test.tsx:872-897` has the
identical `await … ; expect(getAllByRole("alert")).toHaveLength(2)` shape, and re-asserts at
`:894` after a search `change`. It is exposed to the same race and has simply not fired yet.

**Minimal fix** — wait for the count instead of racing it, in all three places:

```js
await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));
```

This is already the fix recommended in `.improve/reports/verify-IMP-019.md:566`; it was
recorded as out of scope there and never landed.

---

## 3. REGRESSION 2 — `PROGRESS.log` line 23 fuses two records onto one line

* **Offending commit:** `fa4cbcb` — `chore(improve): log regression sweep 3 fix [REGRESSION-3]`
* **Location:** `.improve/PROGRESS.log:23`

```
2026-10-02T14:02:33Z | REGRESSION-3 | FOUND    | …(IMP-011)2026-10-02T14:25:58Z | REGRESSION-3 | FIXED | 819a6d9
```

The `FIXED` row was appended **without a leading newline**, gluing it to the `FOUND` row.
`awk -F'|' '{print NF}'` reports **7 fields** on line 23 where every other row has 4. The
file holds 29 physical lines but **30 logical records**, so any parser keyed on
one-record-per-line silently drops the REGRESSION-3 `FIXED` entry — the very entry that
records this repo's last fix.

`git show fa4cbcb -- .improve/PROGRESS.log` shows the single added line already containing
both records. `819a6d9` wrote the `FOUND` row correctly, newline-terminated.

**Minimal fix** — split the line and re-pad the `FIXED` row to match rows 1–22:

```
2026-10-02T14:02:33Z | REGRESSION-3 | FOUND    | …(IMP-011)
2026-10-02T14:25:58Z | REGRESSION-3 | FIXED    | 819a6d9
```

---

## 4. REGRESSION 3 — three `PROGRESS.log` rows have timestamp and sha swapped

* **Offending commits:** `59cac9d` (IMP-021), `5ff96a0` (IMP-022), `e736104` (IMP-020) —
  the three `chore(improve): mark … done, log progress` commits at the end of the range.
* **Location:** `.improve/PROGRESS.log:25`, `:27`, `:29`

```
25: ee95af3 | IMP-021 | DONE |      <- should be: <timestamp> | IMP-021 | DONE     | ee95af3
27: 298d3b1 | IMP-022 | DONE |      <- should be: <timestamp> | IMP-022 | DONE     | 298d3b1
29: 8801da8 | IMP-020 | DONE |      <- should be: <timestamp> | IMP-020 | DONE     | 8801da8
```

Three defects in one row: field 1 holds the **sha** where the timestamp belongs, the
**timestamp is gone entirely**, field 4 is **empty**, and the whole row has **no column
padding** — plus a trailing space after the final `|`.

This regresses a convention established *inside this same range*: `47c562f`
(`rewrite progress log with correct field order`, IMP-012) put the file on
`timestamp | item | result | sha`, and `59086ce` (`normalize progress log`, IMP-010)
re-padded the columns. Rows 1–23 still follow it. The last three logging commits put it back
to the broken shape — **the third occurrence of this exact class** in this file's history.

Related: rows **24, 26, 28** (IMP-018, IMP-173, IMP-019) are correctly ordered but also
drop the column padding, so the file is now internally inconsistent even where it is valid.

**Minimal fix** — rewrite rows 24–29 in the rows-1–23 form, restoring the timestamps the
commit log implies and re-padding the `item` and `result` columns:

```
2026-10-02T15:04:35Z | IMP-018      | DONE     | 45e24ed
2026-10-02T15:1x:xxZ | IMP-021      | DONE     | ee95af3
2026-10-02T15:57:08Z | IMP-173      | DONE     | 64bd3f1
2026-10-02T15:5x:xxZ | IMP-022      | DONE     | 298d3b1
2026-10-02T16:29:50Z | IMP-019      | DONE     | 8bc73f9
2026-10-02T16:3x:xxZ | IMP-020      | DONE     | 8801da8
```

The three broken rows all come from the same writer shape, so the durable fix is to have the
logger always emit four fields in one order — e.g. a single
`logRow(ts, item, result, sha)` helper — rather than three call sites each formatting the
string by hand.

---

## 5. Data persistence — nothing silently stopped saving

This was the highest-risk area: the regression-3 fix gates the save effect on a
"user-caused dispatch", so a silent persistence failure is the worst possible outcome.
Every check below was driven in a real browser against a production build, with a **real**
`Storage` quota failure injected and then a real page reload.

| Check | Action | After reload | Verdict |
|---|---|---|---|
| Save a paper | create collection `PersistA` + paper `2610.00848` from a card | `PersistA:1`, paper present | **persists** |
| Rename | rename to `Renamed-ZZZ` | heading reads `Renamed-ZZZ (1)` | **persists** |
| Remove a paper | remove from collection | `Renamed-ZZZ:0`, papers map pruned to `[]` | **persists** |
| Import | import a 1-paper collection | `Imported-Col:1`, headings correct | **persists** |
| Import malformed | `{not json` | alert "Could not read that file as JSON." | **recovers** — a good import clears the error |

**Save failure.** With `localStorage.setItem` throwing `QuotaExceededError` for the two real
keys (and the app's own `rpf.__storage_test__` probe deliberately left working so
`detectStorage()` still returns true):

* the banner fires — exactly **1** `role="alert"`: *"Collections could not be saved. This
  browser's storage may be full or blocked, so anything you just changed will be lost when
  you reload this page."*
* `localStorage.getItem('rpf.collections.v1')` is **`null`** — nothing was written, and the
  UI does not claim otherwise.
* across four re-renders (`#view=collections` ⇄ feed) the alert count stays pinned at **1** —
  no duplication, no double-announce.
* after a reload with the failure still active: no alert, and the collection is correctly
  gone. The app never asserts a save it did not make.
* with the fault removed, the next save **clears** the banner (`0` alerts) and persists
  (`AfterRecovery:1`).

**Cold boot.** With nothing stored, a cold load raises **no** save-failure alert — the
regression-3 gate works, and the banner is earned only by a real change.

---

## 6. Browser sweep

Production build (`npm run build` → `npm run preview`), real index (2,812 papers, 2 shards),
at **1280×900** and **390×844**. ~50 states per width; 98 screenshots in
`.improve/artifacts/regression-4/`.

**Console errors: zero** outside deliberately injected faults. All 22 recorded console
errors map 1:1 to an injected fault, and every one is either a resource-level message or
App's own deliberate `console.error` for developer diagnosis (IMP-017's intent).

| Area | States | Result |
|---|---|---|
| Feed default | 1 | 2812 papers match, 50 cards, 0 alerts |
| Sort | `newest`, `relevance` (w/ query), relevance chip disabled without query | correct; `#sort=relevance` with no query self-normalizes to Newest |
| Recency | 7 / 30 / 60 | all load, chip pressed state correct |
| Search | real (`transformer` → 104), zero-match (→ 0, no crash), whitespace-only (`    ` → 2812) | correct; whitespace writes `q=++++` and correctly keeps Relevance unpressed |
| Categories | none, explicit all, `#cat=cs.CV,cs.BI`, `#cat=cs.BI`, `#cat=` empty, duplicates | all correct |
| Deep links | garbage, duplicate keys, unicode keys, `sort` w/o query, bad `recency` | all parsed safely, no crash |
| localStorage | fresh, corrupted JSON, populated | corrupted → empty state, no crash |
| Error surfaces | manifest 404, HTML-200, JSON `null`, array, string, malformed, one shard 500, one shard corrupt, all shards blocked | 9/9 correct |
| Recovery | "Try again" on manifest failure and on load failure, both × 2 widths | 9/9 recover to 50 cards |
| Collections | empty and populated | correct |

Notable correct behaviours confirmed:

* `#cat=cs.CV,cs.BI` → *"Unknown category: cs.BI … so those papers are hidden."* +
  **Keep only indexed categories**; keeps its 783 papers (IMP-009).
* `#cat=cs.BI` → *"…so nothing can match."* + **Reset category filter**; feed body renders
  nothing, so the notice is not double-explained (IMP-010).
* `#cat=` → *"No categories selected"* + **Select all categories**; the two states stay
  distinct (`[]` vs `null`) (IMP-010).
* `#cat=cs.CV,cs.CV,cs.LG` de-duplicates to `cs.CV,cs.LG`.
* Unicode key `#cat=cs.😀` is treated as unknown and named verbatim in the notice.
* One corrupt shard → *"One week in this window failed to load (Sep 24 – Sep 27, 2026), so
  the feed below is incomplete"* with 2549 papers still shown (IMP-015, IMP-016).
* All shards blocked → the hard-failure panel, not a lie about an empty window (IMP-016).

---

## 7. Alert / role hygiene

For every state I counted live regions and compared against the intended one.

| State | `role="alert"` | Expected | Verdict |
|---|---|---|---|
| Feed loaded | 0 | 0 | clean |
| Unknown category (partial / total) | 1 | 1 | the one notice |
| Save failure | 1 | 1 | the one banner |
| Save failure **+** unknown category | 2 | 2 | two genuinely distinct facts |
| Partial shard failure | 1 | 1 | the incomplete-feed notice |
| Partial shard failure **+** save failure | 2 | 2 | distinct |
| Manifest failure (all 5 modes) | 1 | 1 | the index panel |
| All shards blocked | 1 | 1 | the load-failure panel |
| `role="status"` regions | 1 (`N papers match`, always present) | 1 | never a second failure announcement |

**No double-announce across a re-render.** Toggling the unknown-category notice on and off
four times in a row yields `1, 0, 1, 0` alerts — it mounts and unmounts cleanly rather than
accumulating. The all-shards-blocked panel likewise stays at exactly 1 across a
7 → 30 → 60 → 7 recency cycle.

The two deliberate stand-downs both hold: in the hard-failure path the partial-shard notice
is explicitly cleared (`App.tsx:273`), and the bare warning banner stands down for the
panel (`App.tsx:637`), so a hard failure is announced exactly once. IMP-017's `aria-label`
work is intact — the partial-shard notice is announced as *"Some papers could not be
loaded"*, not as a file name.

---

## 8. Recovery paths — all four work, none interfere

1. **Try again (manifest failure)** — present on all 5 manifest failure modes; recovering
   to 50 cards every time.
2. **Try again (load failure)** — present on the all-shards-blocked panel; recovers to 50
   cards.
3. **Select all categories** — from `#cat=`, clears the empty state, drops `cat=` from the
   URL, both recoveries land.
4. **Category reset** — from `#cat=cs.CV,cs.BI` it writes `#cat=cs.CV`, keeps the surviving
   papers, and removes the notice.

Checked for interference specifically: the manifest retry does not stampede
(`refreshManifest` shares an in-flight request), the papers retry re-requests only the
missing shards (nothing is cached for a failed one), and neither retry disturbs the other
attempt counter. The malformed-import error clears on the next successful import.

### Set-but-never-reset audit

Every boolean and ref that can latch, checked for a reset on the same path that sets it:

| Flag | Set at | Reset at | Verdict |
|---|---|---|---|
| `unsavedChanges` (App.tsx:385) | `dispatch` | save effect, immediately before writing | **resets** |
| `retriedRef` (App.tsx:154) | `handleRetryManifest` | manifest effect, on success | **intentional** — a pending focus must survive a failed attempt; never read otherwise |
| `manifestAttempts` / `papersAttempts` | retry handlers | never (monotonic counters used as effect deps) | **intentional** — resetting would re-fire the effect |
| `saveFailed` | `setSaveFailed(!saveState(…))` | same call, on the next successful save | **resets** |
| `manifestPromise` (paperIndex.ts:126) | `getManifest` | `.catch` nulls it; `refreshManifest` nulls a settled one | **resets** |
| `manifestSettled` | on resolve | cleared when a new fetch starts | **resets** |
| `shardCache` | on shard success | never cleared, but nothing is cached for a failed shard | **correct** — proven by the retry recovering |
| `importError` | `handleFile` failure | first line of `handleFile` | **resets** |
| `editing` / `draftName` | Rename click | Cancel and on entering edit | **resets** |
| `indexRef` | lazy init | never — correct singleton | **intentional** |

**No instance of the bug that shipped twice and was rejected twice.**

---

## 9. Cold-load flash (IMP-173's `useLayoutEffect`)

Measured with a `requestAnimationFrame` loop **and** a `MutationObserver` installed via
`addInitScript` (i.e. before any app script), across **6 cold loads**. Frames are checked
for three wrong intermediate states: *"No papers are available"*, *"No papers match the
current filters"*, and *"No categories selected"*.

| Run | frames captured | wrong-state frames | phase sequence |
|---|---|---|---|
| 1 | 9 | **0** | bare → loading → cards:50 |
| 2 | 8 | **0** | bare → loading → cards:50 |
| 3 | 7 | **0** | bare → loading → cards:50 |
| 4 | 8 | **0** | bare → loading → cards:50 |
| 5 | 8 | **0** | bare → loading → cards:50 |
| 6 | 7 | **0** | bare → loading → cards:50 |

**The flash is gone.** The reader only ever sees a loading line, then the feed. No empty
feed, no "No papers are available", no spinner flash. `useLayoutEffect` is doing its job.

---

## 10. Python pipeline end-to-end

Real arXiv queries, real `/tmp` out-dirs.

| Run | Command | Exit | Result |
|---|---|---|---|
| Single category | `--category cs.CV --max-per-category 4` | **0** | 4 papers, 1 shard |
| Multi category | `--max-per-category 300` (all 5 defaults) | **0** | 1,207 papers, 1 shard |
| Full defaults, unbounded | *(no caps)* | **1** | **correctly refused to write anything** |

The unbounded run failed mid-flight with `cs.AI` erroring, and `main()` returned 1 having
written nothing. That is **IMP-004 working as designed**: a partial index is
indistinguishable from a complete one once deployed, so the run refuses. Confirmed the
out-dir was left empty rather than holding a truncated index.

**Index contract validated** on every generated index and on the shipped one:

* `index.json` exists and parses.
* every `shards[].file` resolves to a real file.
* declared `count` == actual `papers.length` for **every** shard.
* `sum(shards[].count) == totalPapers`.
* **no shard older than the retention window** (shipped index: newest 1 day old, oldest 8
  days old, `retentionDays: 60`).
* no orphan `papers-*.json` left in the out-dir that the manifest does not list — IMP-021's
  write-order fix holds (`write_index` writes shards, then the manifest, then sweeps).

Shipped baseline matches the profile exactly: **`totalPapers: 2812` across 2 shards**
(2549 + 263), which the browser renders as *"2,812 papers"* with 50 cards.

**Flag validation (IMP-022)** — all exit **2** as required:

| Command | Exit |
|---|---|
| `--retention-days 0` | **2** |
| `--category 'cs.CV foo'` | **2** |
| `--abstract-chars -3` | **2** |
| `--max-per-category -1` | **2** |
| `--help` | 0 |

---

## 11. Visual judgement

Looked at the screenshots, and measured layout programmatically rather than by eye alone
(`scrollWidth` vs `innerWidth`, per-element bounding boxes, `scrollHeight` vs `clientHeight`
on every node, computed font sizes).

**No layout breakage found at either width.**

* **390px overflow: none.** `scrollWidth === innerWidth` in every state at both widths.
  The only element crossing the left edge is `a.skip-link` at `left: -9999px` — the standard
  visually-hidden-until-focused technique, intentional.
* **Clipped text: none.** The only clipped node is `label.sr-only` (`clientHeight: 1`), the
  standard screen-reader-only pattern.
* **Tiny text: none.** No element under 11px computed font size.
* **Banner stacking: correct.** With the save-failure banner and the unknown-category
  banner up at once, both render as distinct nodes with no geometric overlap
  (1280: y=-496 h=70 and y=30 h=64; 390: h=116 and h=110, no intersection).
* **Hierarchy preserved.** The `<h1>` hero, filter groups, banner, and cards keep their
  order at both widths; chips wrap onto multiple lines instead of overflowing; a banner's
  recovery button wraps onto its own line at 390px.
* One benign observation: the search input's long placeholder is visually elided at 390px
  (normal input behaviour, full text still in the DOM and the accessible name).

---

## 12. History hygiene

* **Commits are atomic.** Every one of the 49 commits carries exactly one item tag
  (`[IMP-0xx]`, `[REGRESSION-3]`) and touches one concern: its source files, its tests, and
  its own report set. No commit mixes two items' source changes.
* **No stray or junk tracked files.** No `.DS_Store`, `__pycache__`, `.pyc`, `node_modules`,
  build output, editor backups, or scratch logs were added anywhere in the range. (The
  `.DS_Store` and `__pycache__` on disk are untracked and gitignored — profile PE-15.)
* **`git status --porcelain` is clean** apart from three untracked report files
  (`discovered-IMP-002.md`, `discovered-IMP-009.md`, `regression-sweep-4.md`), all of which
  belong to `.improve/reports/`.
* **`.improve/PROGRESS.log`: 3 of 29 rows are malformed** — regressions 2 and 3 above. All
  other 26 rows are correctly formatted `timestamp | item | result | sha` on their own line.
  The format itself has now broken three times in this file's history.

---

## 13. Corrections to my own harness

Three of my early measurements were wrong and I want them on the record rather than
quietly dropped, because each would have produced a false finding:

1. **`storage-populated` appeared empty.** I had navigated to a URL identical to the current
   one; Chrome treats that as a same-document navigation, so the app never re-ran
   `loadState()`. Re-tested with real reloads — populated storage loads correctly.
2. **The save-failure banner appeared absent.** My stub threw on `rpf.__storage_test__`,
   App's own storage probe, so `detectStorage()` returned `false`, no save was attempted,
   and there was nothing to fail. Fixed by excluding the probe key.
3. **The `Storage.prototype.setItem` override never intercepted.** Chromium's
   `localStorage` **shadows** `setItem` with an own property, so patching the prototype
   alone is a no-op; it needs `Object.defineProperty(window.localStorage, 'setItem', …)`.
   Verified with a direct probe (`NO THROW` → `THREW QuotaExceededError`) before trusting the
   result.

Each of these was caught because the app behaved *correctly* in a situation my harness had
made impossible.

---

## 14. What was checked, so the absence of findings is meaningful

1. Python suite on **5 interpreters**; `compileall` on 3.8 and 3.14.
2. `tsc --noEmit`, `vite build`, `npm test` ×**7**, `--sequence.shuffle` ×**18**, plus the
   failing seed replayed twice and the flaky file shuffled alone ×8.
3. **Data persistence** across four real reloads (save / rename / remove / import), a real
   quota failure with a real recovery, and a corrupted-storage boot.
4. **~100 browser states** across two widths from a production build: all sort modes, all
   recency windows, real/zero/whitespace search, six category states, five deep links,
   three localStorage states.
5. **All 9 error surfaces × 2 widths**, each with its recovery affordance actually clicked
   and the post-recovery state asserted.
6. Live-region counts for 9 distinct alert states, plus two re-render cycles to prove no
   double-announce.
7. All 4 recovery affordances exercised individually and checked for mutual interference.
8. Cold-load flash measured with rAF + MutationObserver over **6** cold loads.
9. **Set-but-never-reset audit** of all 10 latching flags/refs across `App.tsx`,
   `paperIndex.ts`, `CollectionsView.tsx`, `PaperCard.tsx`.
10. Real arXiv ETL runs (single-category, multi-category, full-defaults), the index contract
    validated field by field, and all 5 flag exit codes checked.
11. Programmatic layout audit (overflow / clipping / font-size / banner overlap) at both
    widths, plus screenshots read and judged.
12. Commit atomicity, junk-file scan, `git status`, and `PROGRESS.log` field-by-field parsing.

**Pre-existing and explicitly NOT regressions:** profile PE-1…PE-16 (npm audit/outdated
noise, no `npm run build` in CI, weekly-vs-daily cron, `CONTRIBUTING.md` command, no lint,
notebook `nbconvert` failure, `arxiv` 4.x `download_pdf` breakage, unpinned
`requirements.txt`, `.venv/` not ignored, the legacy CLI's duplicate client), WEB-33
(bare `#` in the URL), and WEB-24 (non-atomic two-key storage write — now at least surfaced
by IMP-011's banner rather than silent). None of these are attributable to this range.