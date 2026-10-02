# Regression Sweep 3 — `fc77a40..a2b2f4b`

**Date:** 2026-10-02
**Sweep:** third regression sweep, read-only
**Range:** 19 items + 19 chore/bookkeeping commits after backlog commit `fc77a40`
**Verdict:** `REGRESSIONS` — 1 confirmed history-hygiene regression, 1 confirmed
cross-item UI regression, 1 new low-severity defect, 1 pre-existing defect
correctly ruled out of this batch. **No test-suite regression** (Python and web
both fully green, no flaky tests).

---

## 1. Suites

| Check | Expected | Actual | Verdict |
|---|---|---|---|
| `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | 53 OK | **53 OK** (3 runs) | pass |
| `cd web && npm run typecheck` | clean | **clean**, no output | pass |
| `cd web && npm test` | 216 / 14 files | **216 / 14** on **9 of 9 runs** | pass |
| `cd web && npm run build` | clean | **clean**, 39 modules | pass |

**Flake hunt (9 runs, task asked for ≥6).** All 9 green, identical counts every
time. None of the three known-flaky items (IMP-005 jsdom setup, IMP-008 relevance
race, IMP-009 hash wiring) reproduced. No skipped/only-run tests.

**Oldest interpreter.** `.github/workflows/ci.yml` pins `python-version: "3.x"`,
a floating spec with no lower bound, so "oldest supported" is whatever
`3.x` currently resolves to; 3.11.8 is the oldest interpreter on this machine
and it passes all 53. The only interpreter that fails is Homebrew 3.14.3, and it
fails with `ModuleNotFoundError: No module named 'arxiv'` on 3 test modules —
a missing venv dependency on that interpreter, **not** a code regression.
(The floating `3.x` is logged as a pre-existing profile item, PE-10.)

**Bundle vs baseline:** CSS **10.93 kB / gzip 2.86** — exactly the baseline,
stable as the profile predicts. JS 163.72 → **169.87 kB** (gzip 52.63 → 54.45),
i.e. +6.15 kB over 19 items ≈ 324 B/commit, right in the profile's stated
"few hundred bytes per feature commit" band. Not a regression.

**Pre-existing-failure list.** Every entry in `REPO_PROFILE.md` that is expected
to fail still fails exactly as documented: the Colab notebook fails by design at
cell 4; `npm audit` reports the same 5 dev-only advisories; `npm outdated`
reports the same 7 stale majors. **No new command-level failures.**

---

## 2. Findings

### R1 — REGRESSION: `f2fd2b7` corrupts `.improve/PROGRESS.log`

**Severity:** medium (breaks the log's one-row-per-entry contract, which is the
log's entire purpose). **Item:** IMP-015. **Bisected exactly** via
`git show f2fd2b7 -- .improve/PROGRESS.log`.

`f2fd2b7` ("chore(improve): mark IMP-011/IMP-015 done, log progress") appends to
the file without a leading newline and writes the IMP-015 row with the **commit
SHA in the timestamp column**. The diff:

```
-2026-10-02T11:10:19Z | REGRESSION-2 | CLEAN    | 34 browser states, 160 web tests x9 runs, 53 python tests
+2026-10-02T11:10:19Z | REGRESSION-2 | CLEAN    | 34 browser states, 160 web tests x9 runs, 53 python tests2026-10-02T12:19:14Z | IMP-011 | DONE | 2e3f6e8
+ff3f331 | IMP-015 | DONE |  (attempt 2)
```

Current file: 22 logical rows collapsed onto 21 physical lines. Rows 18–21:

```
18  2026-10-02T11:10:19Z | REGRESSION-2 | CLEAN    | 34 browser states, ...53 python tests2026-10-02T12:19:14Z | IMP-011 | DONE | 2e3f6e8
19  ff3f331 | IMP-015 | DONE |  (attempt 2)
20  2026-10-02T12:58:51Z | IMP-016 | DONE | 166066d
21  2026-10-02T13:25:57Z | IMP-017 | DONE | 8aceee1
```

* **Row 18** has **7 fields instead of 4** — two logical rows on one line. Any
  `split('|')` parser silently produces a garbage note field containing a
  timestamp.
* **Row 19** has **no timestamp at all** (`ff3f331` where the ISO date belongs),
  so the entry cannot be ordered or filtered by date, and its ID/status fields
  are unpadded (`IMP-015` = 9 cols vs the file's 14).
* Rows 20/21 (from `5993ebb` and `a2b2f4b`) are **unpadded** — cosmetic only;
  they still carry a valid timestamp and parse.

This is a genuine *intra-batch* regression: the commit immediately preceding
`f2fd2b7`, `59086ce`, is titled "style(web): fix indentation and **normalize
progress log**" and had just padded every row to `ID | STATUS |`. `f2fd2b7`
re-broke the format it was normalised into three commits earlier.

**Reproduction**

```bash
git show f2fd2b7 -- .improve/PROGRESS.log      # see the two broken + lines
awk -F'|' 'NF!=4 {print NR": "NF" fields"}' .improve/PROGRESS.log   # -> 18: 7 fields
awk -F'|' '$1 !~ /^[0-9]{4}-[0-9]{2}-[0-9]{2}T/ {print NR": "$1}' .improve/PROGRESS.log  # -> 19: ff3f331
```

**Minimal fix** (one-line rewrite of rows 18–19 only):

```
2026-10-02T11:10:19Z | REGRESSION-2 | CLEAN    | 34 browser states, 160 web tests x9 runs, 53 python tests
2026-10-02T12:19:14Z | IMP-011      | DONE     | 2e3f6e8
2026-10-02T12:19:14Z | IMP-015      | DONE     | ff3f331 (attempt 2)
```

Use the real `IMP-015` DONE timestamp (commit `f2fd2b7`'s author date) rather
than `12:19:14Z` if you want strict ordering. Rows 20/21 should be re-padded to
`IMP-016      | DONE     |` / `IMP-017      | DONE     |` for consistency.

**Note:** no code consumes `PROGRESS.log` (grepped `*.py|ts|tsx|js|yml`), so this
is human-read-only today — which is exactly why it drifts unnoticed.

---

### R2 — REGRESSION: `42e0edb` (IMP-010) collides with `228d48d` (IMP-009), producing two buttons that do the same thing

**Severity:** low (cosmetic / confusing-a11y; both buttons work). **Item:** IMP-010.

Deep-linking `#cat=cs.BI` — a category the index does not have, i.e. **all**
requested categories unknown — renders, simultaneously:

```
role=alert  banner--warning  "Unknown category: cs.BI. … nothing can match. [Reset category filter]"
(empty)                      "No categories selected"                        [Select all categories]
```

Both buttons execute the *identical* state transition:

* `resetUnknownCategories` — with `activeCategories.length === 0` it takes the
  `categories: null` branch (`App.tsx:723`).
* `selectAllCategories` — pushes `categories: null` (`App.tsx:741`).

Observed: clicking **Reset category filter** → hash `''`, 0 network requests;
clicking **Select all categories** from the same state → hash `''`, 0 network
requests. Byte-identical outcomes.

**Bisected.** Scratch worktree at `286ea63` (immediately after IMP-009, before
IMP-010) — the same state rendered:

```
emptyMessage = papers.length === 0 ? "No papers are available in this window yet."
```

…with **no button at all**. IMP-009 landed first and introduced the
"Reset category filter" button; IMP-010 then added a second recovery affordance
to the empty state *without accounting for the state IMP-009 had just created*,
so the two now co-occur. Verified at 1280px and 390px
(`regression-3/rec-unknown-total-1280.png`, `...-390.png`).

**Reproduction**

```
open  /research-paper-feed/#cat=cs.BI   → 2 alerts, 2 buttons, both → hash ''
```

**Minimal fix.** Either is one line:

* (a) suppress the empty-state button when `unknownCategories.length > 0`, since
  the banner's own button already covers it:
  ```tsx
  onSelectAll={unknownCategories.length === 0 ? selectAllCategories : undefined}
  ```
* (b) drop the redundant `categories: null` branch by having
  `resetUnknownCategories` always keep the known categories when
  `activeCategories.length === 0`, so the two paths genuinely differ.

(a) is lower risk. Note `App.categories.test.tsx` asserts the button is present
in *some* state, so adjust whichever test pins the collision.

---

### R3 — NEW DEFECT (not a regression of prior behaviour): `2e3f6e8` (IMP-011) shows the save-failure alert on a cold boot with nothing saved

**Severity:** low. **Item:** IMP-011. `App.tsx:347-351`:

```tsx
useEffect(() => {
  if (storageAvailable) {
    setSaveFailed(!saveState(collections));
  }
}, [collections, storageAvailable]);
```

On a cold boot `collections` is the empty state, and this effect **still calls
`saveState`** — which *writes* `rpf.collections.v1 = "[]"` and
`rpf.papers.v1 = "{}"`. With storage present but full (quota exhausted) that
write throws, `saveState` returns `false`, and the red
`role="alert"` banner fires:

> "Collections could not be saved. This browser's storage may be full or blocked,
> so **anything you just changed will be lost** when you reload this page."

Observed at first paint, *before the index even resolves* (announcement order:
`status "Loading the paper index…"` → `alert "Collections could not be saved…"`).
Nothing was changed and nothing was lost, so both the alert and its wording are
false on a fresh session. Confirmed at 1280 and 390
(`regression-3/err-save-failed-boot-1280.png`, `err-save-failed-390.png`).

**Minimal fix.** Only report failures for saves the user actually caused:

```tsx
const dirtyRef = useRef(false);
useEffect(() => {
  if (!storageAvailable) return;
  if (dirtyRef.current) setSaveFailed(!saveState(collections));
}, [collections, storageAvailable]);
```

…setting `dirtyRef.current = true` in the reducer-dispatch wrapper.

---

### R4 — PRE-EXISTING, ruled out of this batch: a manifest that is JSON `null` hangs the app forever with no recovery

**Severity:** medium. **Not a regression** — verified identical at the batch
base. `fetchManifest` does `(await response.json()) as IndexManifest`; a body of
`null` parses successfully and is returned as `null`. `App.tsx:178-193` then does
`.then((next) => { if (!cancelled) setManifest(next); })` with **no
`setLoading(false)`**, and the papers effect at `App.tsx:195-197` early-returns
on `!manifest`. `loading` therefore never flips: the app sits on
"Loading the paper index…" **forever**, with no error, no alert, and no Try again
button (the button only exists behind `error`).

Confirmed structurally at `fc77a40`:

```
$ git show fc77a40:web/src/App.tsx | sed -n '147,166p'
      .then((next) => { if (!cancelled) { setManifest(next); } })   # no setLoading(false)
$ git show fc77a40:web/src/App.tsx | grep -n '!manifest && !error'
378: {!manifest && !error && (        # -> the "Loading the paper index…" panel
```

Same bare-cast / no-validation family as the logged WEB-07 trap. **Left
untouched** — report only. A real manifest is never `null`; only a corrupt one.

---

### R5 — OBSERVATION (cosmetic): partial-shard notice is not cleared when a new window load starts

`ff3f331` (IMP-015) added `failedShards`, and the load effect never resets it at
the *start* of a load (only on success, or cleared on the catch path). Changing
recency therefore leaves the previous window's "Some papers could not be loaded.
… so the feed below is incomplete" banner mounted for the duration of the new
load, while the loading panel — not a feed — is what is actually below it.

Verified **benign in the ways that matter**: the banner is not re-announced (it
stays mounted, so no new `role="alert"` insertion), it does not produce a
duplicate notice, and it clears correctly as soon as the shard loads
(`R6b`: two recency changes → 0 alerts, exactly 1 alert mount for the whole
session). Stale-worded only. A one-line `setFailedShards([])` beside the existing
`setError(null)` in the load effect would remove the window.

---

### R6 — OBSERVATION (cosmetic): the Sort group now wraps to a second row at 1280px

IMP-010 added the `All` chip, widening the Categories group enough that
`flex-wrap` pushes Sort onto its own line (visible in
`regression-3/feed-default-1280.png` vs `baseline/baseline-feed-desktop-1280.png`,
where CATEGORIES/RECENCY/SORT all shared one row). The wrap itself is graceful —
labels and chips stay aligned, nothing is clipped, the card grows by ~28px, and
the controls' padding/inner alignment is unchanged. Judged as a consequence of a
deliberate feature, not breakage.

---

## 3. Alert / role hygiene — every state counted

Instrumented with a `MutationObserver` on `document` recording **every
insertion** of a `[role="alert"], [role="status"]` node, so a re-render that
swaps a node (the real double-announce mechanism) is directly observable rather
than inferred.

| State | `role=alert` | `role=status` | Announce mounts |
|---|---|---|---|
| Feed default | 0 | 1 (count) | — |
| Each sort mode, each recency window | 0 | 1 | — |
| Real search / zero-match / whitespace-only | 0 | 1 | — |
| Categories: none (`#cat=`) | 0 | 1 | — |
| Categories: all / partial (`#cat=cs.CV,cs.BI`) | 1 (unknown) | 1 | 1 |
| Unknown (`#cat=cs.BI`) | 1 (unknown) | 1 | 1 |
| Collections empty / populated | 0 | 0 | — |
| Manifest missing (404) | 1 (panel) | 0 | 1 |
| Manifest HTML fallback | 1 (panel) | 0 | 1 |
| Manifest malformed JSON | 1 (panel) | 0 | 1 |
| Manifest `null` (**R4**) | 0 | 1 | — (stuck) |
| ALL shards blocked (503) | 1 (panel) | 1 (count) | 1 |
| ALL shards corrupt JSON | 1 (panel) | 1 (count) | 1 |
| ONE shard 404 / corrupt | 1 (partial) | 1 (count) | 1 |
| Save failure, feed view | 1 | 1 | 1 |
| Save failure, collections view | 1 | 0 | 1 |
| Storage unavailable, collections view | 1 | 0 | 1 |
| Import bad JSON / wrong shape | 1 | 0 | 1 |
| **Partial shard + unknown category** | **2** | 1 | 2 |
| **Unknown category + hard load failure** | **2** | 1 | 2 |
| **Save failure + partial shard** | **2** | 1 | 2 |

**Result: exactly the intended region fires in every single-intent state.**

The three simultaneous-alert rows above are all *genuinely distinct* conditions
(two different facts to tell the reader), which the project has already
deliberately accepted — `App.loadFailure.test.tsx` and
`App.partialShard.test.tsx` both assert `toHaveLength(2)` with `storageNotice`.
The previously-observed double-announce case is not reproducible in any state not
already covered.

**Mutual exclusion verified where it matters**

* `partial-shard banner` vs `hard-failure panel` — the catch path does
  `setFailedShards([])` before `setError`, so ALL-blocked (E3) and
  both-corrupt (E4c) show **1** alert, never 2. Confirmed.
* `load-failure banner` (`error && !loadFailed`) vs `load-failure panel`
  (`error && !papers.length`) — one condition or the other, never both.
* `saveFailed` vs `storageAvailable banner` — the save effect is gated on
  `storageAvailable`, and `saveFailed` starts `false`, so they can never both
  render. Confirmed empirically (E6a vs E6e).

**Double-announce across re-render: NONE, in any state.** Explicitly forced:

* Toggle a category off then on with a partial-shard alert live
  (`E4-after-two-rerenders`): still **1 alert mount total** for the session.
* Two consecutive recency changes (`R6b`): **1 alert mount total**.
* "Select all categories" with a partial-shard alert live (`R4d`): **0 new
  mounts**.
* "Reset category filter" / "Keep only indexed categories" (`R2`, `R3b`, `R7b`):
  **0 new mounts**.
* The `saveFailed` "bails out on unchanged value" reasoning at `App.tsx:344`
  holds — a steady stream of saves produces no repeat announcement.

---

## 4. Recovery paths — all four, alone and interleaved

| Affordance | Item | Verdict |
|---|---|---|
| Try again (index unavailable) | IMP-007 `ac1fae2` | **works** |
| Try again (papers load failure) | IMP-016 `166066d` | **works** |
| Select all categories | IMP-010 `42e0edb` | **works** (but see R2) |
| Reset category filter / Keep only indexed | IMP-009 `228d48d` | **works** |

* **Index Try again** — recovers from a 404-then-OK manifest; refetches
  `index.json` **exactly once**. Triple- and quadruple-click re-tries while still
  failing: `dataDelta = ["index.json"]`, i.e. **1 extra request for 3 clicks** —
  the `retriedRef` + `manifestAttempts` latch genuinely collapses same-tick
  activations. No stampede. Repeated retries while still broken correctly
  re-announce each time (4 separate failures, 4 announcements — correct).
* **Papers Try again** — refetches **both** shards once, and correctly does
  **not** refetch the memoized manifest. Re-announces once per failure.
* **Select all categories** — 0 network requests (client-side filter change),
  partial-shard notice preserved, 0 new announcements.
* **Reset category filter** — 0 network requests, partial-shard notice
  preserved, 0 new announcements.
* **Interference** — after an index-Try-again that lands a manifest with a
  failing shard, the partial-shard notice appears alone (1 alert). Exercising a
  category recovery afterwards leaves the shard state and its notice untouched,
  and vice versa. **No cross-reset found.**

**Set-but-never-reset sweep.** Audited every `useState`/`useRef`/`useReducer`
introduced by this batch — `retriedRef`, `manifestAttempts`, `paperAttempts`,
`loadStartedAt`, `savedAt` (`App.tsx:139-144`), `storageAvailable`, `saveFailed`,
`failedShards`, `unknownCategories`, `noCategoriesSelected`, `importError`,
`retrying`. Every one is either derived at render time or written on the path
that owns it; no flag is set without a corresponding clear. The previously
rejected set-but-never-reset shape does not recur.

---

## 5. Date / timezone regression (IMP-016 `formatWeekRange`)

Rendered prose for a failed `2026-W39` shard, five timezones:

```
UTC                    → One week in this window failed to load (Sep 24 – Sep 27, 2026)
Pacific/Kiritimati    → One week in this window failed to load (Sep 24 – Sep 27, 2026)   (UTC+14)
Pacific/Midway        → One week in this window failed to load (Sep 24 – Sep 27, 2026)   (UTC-11)
Asia/Kathmandu        → One week in this window failed to load (Sep 24 – Sep 27, 2026)   (UTC+05:45)
America/New_York      → One week in this window failed to load (Sep 24 – Sep 27, 2026)   (UTC-04)
```

**Byte-identical across UTC−11 … UTC+14, including the +05:45 quarter-hour
zone.** Timezone-invariant, as intended.

**Matches the manifest's real `from`/`to`,** verified against both the live data
and a freshly generated index:

```
papers-2026-W40.json  manifest from=2026-09-28 to=2026-10-01 | actual min=2026-09-28 max=2026-10-01  n=2549
papers-2026-W39.json  manifest from=2026-09-24 to=2026-09-27 | actual min=2026-09-24 max=2026-09-27  n=263
/tmp/rpf-idx W40      manifest from=2026-10-01 to=2026-10-01 | actual min=2026-10-01 max=2026-10-01  n=5
```

`formatWeekRange` is driven off the manifest `from`/`to`, which equal the true
min/max `published` in each shard — so the prose names the exact dates of the
week that failed. The `+00:00Z`-anchored parse plus `timeZone: "UTC"` is doing
its job. **No regression.**

---

## 6. Cross-stack contract (`build_index.py` ↔ `types.ts`)

Generated a real index:
`python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-idx`
→ 5 papers, 1 shard, exit 0.

Field names **and order** compared programmatically:

```
Paper         TS == PY == [id,title,authors,abstract,abstractTruncated,published,updated,categories,primaryCategory,absUrl,pdfUrl]   IDENTICAL
IndexManifest TS == PY == [generatedAt,retentionDays,categories,shards,totalPapers]                                                    IDENTICAL
ShardEntry    TS == PY == [week,from,to,count,file]                                                                                    IDENTICAL
ShardFile     TS == PY == [week,from,to,papers]                                                                                       IDENTICAL
```

**No mismatches.** (The `Paper.absUrl`/`pdfUrl` typing in `types.ts` is still a
pre-existing looseness against `isPaper`'s runtime `isHttpUrl` check — logged,
unchanged by this batch.)

---

## 7. Legacy CLI (`scripts/paper-collector.py`)

`--help` sane: all five documented flags present with correct defaults
(`--max-papers 1000`, `--output-dir results`). Documented flags verified
against `README.md` (IMP-002 `d3b4a1e` + IMP-023 `297ed71` interaction):

**20 `--topic` values, each with `--max-papers 1 --output-dir <tmp>`; every one
wrote its HTML inside `<tmp>`; nothing escaped to any other directory.**

| Class | Values | Result |
|---|---|---|
| traversal | `../escape`, `..`, `.`, `...`, `a/b/c`, `/abs/path`, `%2e%2e%2f` | sanitised in-place, exit 0, no escape |
| long | `$(id)y`, `` a`b`c ``, `a;b\|c&d`, `a*b?c[d]` | literal, in-place, no shell expansion |
| control char | tab, **embedded newline** (`a\nb`) | collapsed to `_`, exit 0 |
| reserved name | `CON`, `nul`, `aux.txt` | handled (macOS has no such reservation; suffix `_-` keeps them distinct) |
| empty | `''` | falls through to the interactive prompt → `EOFError` |
| ordinary / unicode | `cat:cs.CV`, `with space`, `ünïcodé`, `   ` | correct, exit 0 |

`--topic ''` → `args.topic or input(...)` treats `''` as omitted and prompts,
raising a bare `EOFError` traceback. **Pre-existing** — the `or` idiom is
untouched by IMP-002/IMP-023, and it is the documented "prompted if omitted"
path. Cosmetic; not filed.

---

## 8. History hygiene

**Atomicity: clean.** 38 commits = 19 items + 19 chores. Every `fix`/`feat`
commit is one item; every `chore(improve): mark … done` commit touches only
`.improve/` metadata. **No stray source files, no bundled edits, no
cross-item contamination in any commit's diff.**

Minor consistency notes (not regressions, no action required):

* `d3b4a1e` (IMP-002) and `7a2ed82` (IMP-151) don't update `FEATURES.md`, while
  every other item does.
* `24beb16` marks IMP-001 done touching only `FEATURES.md`, with no
  `PROGRESS.log` row — IMP-001 has a code commit but no log entry.
* `7a2ed82` bundles `regression-sweep-1.md` into the fix commit rather than
  keeping the report separate.
* `5993ebb` / `a2b2f4b` write **unpadded** PROGRESS.log rows (see R1).

**Tracked junk: none.** Only `.improve/PROGRESS.log` and
`images/feed_example.png` match a binary/artifact pattern; both are intentional
and README-referenced. No spaces or non-ASCII in any tracked filename.

**`git status --porcelain`: clean apart from untracked reports.**

```
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
```

Both are `.improve/reports/*.md` — within the allowance. Worth noting that two
items therefore have a `discovered-*.md` on disk that never reached history, so
IMP-002 and IMP-009 are missing that artefact from the record.

**`.improve/PROGRESS.log` row format: INCONSISTENT — see R1.** 22 logical rows,
21 physical, 4 rows malformed.

---

## 9. Visual review

**68 screenshots** in `.improve/artifacts/regression-3/`, all from a production
`vite preview` build, at 1280×900 and 390×844.

Compared against the 14-file baseline in `.improve/artifacts/baseline/`.

* **Default feed** — identical hierarchy, spacing, chip styling and card layout
  to baseline. Only change is R6 (Sort wrapping to a second row). *(clean)*
* **390px** — **no horizontal overflow in any of the 68 captures**
  (`scrollWidth === clientWidth` at every viewport, every state; additionally
  swept every element's bounding box for `right > clientWidth` — no offenders).
  Chips wrap to 2 rows, banner text wraps to 3–4 lines, nothing clipped, no
  horizontal scroll. *(clean)*
* **Multiple banners stacking** — the worst case is 2 stacked banners
  (partial-shard + unknown-category). Rendered at both widths: consistent
  padding, consistent 8px gutter, red above yellow, no overlap, no collapse.
  The 3-line banners at 390px keep their button inside the box with adequate
  side padding. *(clean)*
* **Error panels** — index-unavailable, malformed-manifest, all-shards-blocked
  and hard-load-failure all render with title / body / `Try again` / hint in
  the same order and hierarchy. The `python scripts/build_index.py` code chip
  does not overflow at 390px. *(clean)*
* **Collections** — empty state and populated state (2 collections, 1 + 4
  papers) both clean at 1280 and 390; save menu open at 1280 and 390 renders
  inside the card without clipping.
* **Focus ring** — 3× Tab lands on the skip link / nav; the ring is visible and
  unclipped.
* **Load-more** — label reads "Load 50 more (2762 remaining)" and behaves.

No layout breakage, no clipped text, no lost hierarchy, no misalignment found.

---

## 10. Console / network

Happy paths at both widths, five states each (default, relevance, recency-30,
`#cat=cs.LG`, collections) — **10/10 runs: 0 console errors, 0 console warnings,
0 page errors, 0 failed requests, 0 HTTP ≥ 400.** Matches the baseline
requirement ("baseline console output is clean").

Deliberately-broken states log exactly the errors they should (the 404/503
network failure plus the app's own `console.error` diagnostic naming the file
and cause) — correct behaviour for an error path, not a regression.

---

## 11. What I checked, with nothing found

* 19/19 commits reviewed individually; no uncommitted source changes.
* Both suites at expected counts; 9× web test runs for flakiness; Python on
  3.11.8 (oldest available) and 3.14.3.
* Every distinct `role="alert"` / `role="status"` site enumerated in `App.tsx`
  and `CollectionsView.tsx` (8 alert sites, 2 status sites) and driven to its
  live state; every one of the 23 states above counted for live regions **and**
  for total announcement mounts.
* All four recovery affordances exercised individually, in sequence, and
  interleaved with each other's failure states, with per-action network
  accounting; all 9 new state/refs audited for set-but-never-reset.
* 20 `--topic` classes plus `--help`, plus the documented flags.
* Deep links: 17 hash variants including duplicate keys, unicode query and
  category, unknown view/sort/recency, `#cat=` empty, `#cat=cs.BI`,
  `#cat=cs.CV,cs.BI`, full selection, whitespace query with `sort=relevance`,
  malformed (`#garbage&&&=x`), and bare `#`. All degrade to a sane state.
* localStorage fresh / populated / corrupted (`{not json`, `<<<`) — corrupted
  state falls back to empty with no error, matching baseline.
* `git status`, tracked-file junk scan, filename charset, PROGRESS.log row
  format, per-commit atomicity.
* Cross-stack field name **and order** parity on all four shared shapes.

## Verdict

**`REGRESSIONS`.** Two confirmed, both introduced by this batch:

1. **`f2fd2b7` (IMP-015)** corrupts `.improve/PROGRESS.log` — two rows
   concatenated onto one line, and the IMP-015 row written with a commit SHA in
   the timestamp column. Regresses the format normalisation from `59086ce`.
2. **`42e0edb` (IMP-010)** collides with `228d48d` (IMP-009): the `#cat=cs.BI`
   state renders two buttons with identical behaviour.

Plus one new low-severity defect (`2e3f6e8` / IMP-011: spurious save-failure
alert on cold boot), one pre-existing defect correctly ruled out of this batch
(manifest `null` → permanent spinner), and two cosmetic observations (R5, R6).

**No product-code test regression.** Python 53/53 and web 216/216 across 14
files on 9 of 9 runs, typecheck clean, build clean, console clean, no overflow at
390px, no cross-stack mismatch, no CLI escape, no path-traversal regression.