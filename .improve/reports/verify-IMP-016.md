# Verification report — IMP-016

Verifier: independent verifier sub-agent. I did not write the change.
Repo: `/Users/denimpatel/Desktop/git/research-paper-feed` (branch `improve`, HEAD `e9ed1f0`)
Item spec: `.improve/FEATURES.md` `### IMP-016` (3 acceptance criteria + 3 expanded defects)
Implementer's report: `.improve/reports/impl-IMP-016.md`

---

## VERDICT

**PASS** — 3/3 acceptance criteria met, all three defects closed, 0 blocking issues.
8 non-blocking observations, none of which falsifies a user-visible claim.

---

## 1. Scope check — the implementer's "untouched" claim is true

`git status --porcelain` (repo root, my run):

```
 M .improve/FEATURES.md
 M web/src/App.tsx
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/discovered-IMP-016.md
?? .improve/reports/impl-IMP-016.md
?? web/src/__tests__/App.loadFailure.test.tsx
```

Only `web/src/App.tsx` is modified and one new test file is added. Byte-identity to HEAD
confirmed with `shasum` (not `git diff`, which would only show content):

| file | working tree | HEAD | result |
|---|---|---|---|
| `web/src/styles.css` | `a2fb0ae6…` | `a2fb0ae6…` | IDENTICAL |
| `web/src/lib/paperIndex.ts` | `d2542b8f…` | `d2542b8f…` | IDENTICAL |
| `web/src/components/PaperList.tsx` | `b0a0f4ee…` | `b0a0f4ee…` | IDENTICAL |

Public data is intact and was never corrupted by me or left corrupted:

```
49f661bb41755b56c55b8797e90c5041a2b53854  web/public/data/index.json
f8064a158af61b6a4efa68608ebfddd966d1608c  web/public/data/papers-2026-W39.json
9cb16e5c573ebd27be0f133b54c4398cb8b3c1c6  web/public/data/papers-2026-W40.json
```

All 12 pre-existing test files are byte-identical to HEAD (checked individually with
`shasum` vs `git show HEAD:<path> | shasum`). `grep -rnE "\b(it|test|describe)\.(skip|only|todo)|\b(xit|xtest|xdescribe)\b|\.fails\(" web/src/__tests__ web/src/lib/__tests__`
→ **NONE FOUND**. No test was weakened, skipped, `.only`-ed, or deleted.

---

## 2. Criteria — all three met

### AC1 — "When `error` is set and `papers.length === 0`, the app renders a load-failure state
that names what failed, offers a retry, and does not claim the window is empty."

`web/src/App.tsx:294` — `const loadFailed = error !== null && papers.length === 0;`
`web/src/App.tsx:672-695` — the panel, placed between `loading` and `noCategoriesSelected`
in the ternary chain, so it wins over `PaperList`.

- Names what failed: yes — `"Papers could not be loaded."` plus the raw cause in `<p>{error}</p>`
  (`App.tsx:690`) and the shard set in prose ("no week in this window could be fetched").
- Retry: yes — `<button type="button" className="button" onClick={handleRetryPapers}`
  (`App.tsx:692-699`).
- Does not claim empty: yes — `PaperList` is never rendered in that branch, so the string
  `"No papers are available in this window yet."` cannot appear (verified by DOM in §4).
- **Correctly gated behind `manifest`** — the panel sits inside `{manifest && (…)}` at
  `App.tsx:599`, so it cannot shadow IMP-007's `!manifest` panel.

### AC2 — "The load-failure state is visually distinct from the genuinely-empty window
and is reachable from both the 7-day and 30-day windows."

- Distinct: `panel panel--error` (solid `--danger` border, `styles.css:623-637`) vs
  `p.empty` (dashed `--line`, `styles.css:606-612`). Confirmed by computed styles in the
  browser (§4, "genuinely empty" cell: `border-style: dashed`; load-failure cell:
  `.panel--error` present, `.empty` absent).
- Reachable from both windows: `selectShards` is recency-driven only
  (`paperIndex.ts:192-215`) and the branch is window-independent. Verified in the browser
  in the default 60-day window and in jsdom where the effect dep
  `[manifest, urlState.recency, papersAttempts]` (`App.tsx:256`) re-runs on
  `urlState.recency` — a 7-day window with an all-shard network failure also reaches
  `loadFailed` (probe test in §7).

### AC3 — "A retry from the load-failure state re-requests only the shards it needs."

Verified in the browser, not just jsdom: after restoring the corrupted shards and clicking
`Try again`, `window.fetch` recorded exactly:

```
requestsAfterClick: ["papers-2026-W40.json", "papers-2026-W39.json"]
indexJsonRequests: 0
shardRequests: 2
```

`index.json` stays at exactly 1 request for the session. `index.json` is fetched only in
`fetchManifest` (`paperIndex.ts:131-156`), gated on `!manifest` (`App.tsx:170-176`), and
`handleRetryPapers` only bumps `papersAttempts` (`App.tsx:213-217`) — so the manifest effect
(dep `[manifestAttempts]`, `App.tsx:196`) never re-runs.

---

## 3. The honesty property — full state matrix, every cell

All cells measured in real Chromium against `npm run preview` unless noted. "Truthful" =
the copy matches what actually happened to the network.

| # | State | What the user reads | Affordance | Truthful? |
|---|---|---|---|---|
| 1 | **Manifest fails to load (fatal)** | `h1` "No paper index yet" + "No paper index was found. Run `python scripts/build_index.py` locally, or wait for the scheduled GitHub Action that builds and deploys the index. (HTTP 200)" — 1 × `role="alert"` | "Try again" (1 button, enabled, tab-reachable) | **YES** |
| 2 | **Manifest loads, ALL shards fail** | "Papers could not be loaded. The index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window." + raw cause — 1 × `role="alert"`, class `panel panel--error` | "Try again" | **YES** — explicitly does not claim emptiness |
| 3 | **Manifest loads, SOME shards fail** | "**Some papers could not be loaded.** One week in this window failed to load **(Sep 24 – Sep 27, 2026)**, so the feed below is incomplete. Everything that did load is shown." — 1 × `role="alert"`, class `banner banner--warning` | none by design (IMP-015 shipped this; `App.partialShard.test.tsx:239-241` pins "no Try again" on a partial failure) | **YES** — names the week in prose |
| 4 | **Everything loads, window genuinely empty** | `p.empty` "No papers are available in this window yet." — **0 alerts**, `border-style: dashed`, no `panel--error`, no `banner` | none (correct — nothing to retry) | **YES** |
| 5 | **Zero-match search** | `p.empty` "No papers match the current filters." — **0 alerts**, `border-style: dashed`, `0 papers match` in the live region | none (correct) | **YES** |
| 6 | **Category selection yields nothing** | `p.empty` "No categories selected" — **0 alerts**, no banner, no panel | "Select all categories" button | **YES** — own named state, not conflated with failure |

Cell 2 detail at 1280px (`document.querySelectorAll('[role="alert"]').length` = 1):

```json
{
  "alertCount": 1,
  "alerts": [{ "tag": "DIV", "cls": "panel panel--error",
    "text": "Papers could not be loaded.\n\nThe index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window.\n\nShard papers-2026-W40.json is missing or malformed. Try regenerating the index.\n\nTry again" }],
  "emptyNodes": [],
  "paperListPresent": false,
  "articleCount": 0,
  "tryAgainCount": 1,
  "hasFalseClaim": false,          <-- "No papers are available in this window yet." absent
  "bodyHasPanelError": true,
  "bodyHasBanner": false,
  "h1Count": 1
}
```

Cell 3 detail (390px, W39 only corrupted):

```json
{ "alertCount": 1, "alertCls": "banner banner--warning",
  "VISIBLE_TEXT": "Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown.",
  "visibleTextMentionsWeekRange": true,
  "visibleTextMentionsFileName": false,
  "articleCount": 50, "paperListPresent": true, "tryAgainCount": 0 }
```

Cell 4 detail (1280→390, index rewritten to a single zero-paper shard so the load genuinely
succeeds and yields nothing):

```json
{ "emptyText": "No papers are available in this window yet.", "emptyClass": "empty",
  "emptyBorderStyle": "dashed", "alertCount": 0, "tryAgainCount": 0,
  "panelErrorPresent": false, "bannerPresent": false, "articleCount": 0 }
```

Cell 6 detail:

```json
{ "emptyText": "No categories selected", "alertCount": 0, "bannerPresent": false,
  "hasSelectAll": true }
```

**No cell claims failure when the load succeeded, and no cell claims emptiness when the
load failed.** The specific defect in the spec is fixed and I could not reproduce the old
behaviour anywhere in the app.

---

## 4. Recovery path

### 4.1 It really recovers, without a page reload

`vite preview` on `:4173`, both shards replaced with `THIS IS NOT JSON`, load → failure
panel → restored both shard files → clicked `Try again`:

```json
{ "requestsAfterClick": ["papers-2026-W40.json", "papers-2026-W39.json"],
  "indexJsonRequests": 0, "shardRequests": 2,
  "alertCount": 0, "tryAgainCount": 0, "articleCount": 50,
  "paperListPresent": true, "heroPresent": true,
  "resultCount": "2812 papers match",
  "hasFalseClaim": false }
```

Same document throughout (URL unchanged apart from the cache-buster I set before the load),
so no reload occurred. Also verified via the real keyboard: `Tab` moved focus onto the
button (`button "Try again" [active]`), `Enter` recovered to `2812 papers match`.

### 4.2 No stuck-disabled boolean — audited every ref and boolean in the new code

The rejected pattern in this repo was a latch boolean set but never reset. The new code adds
**no latch and no ref**. `handleRetryPapers` (`App.tsx:213-217`) is three lines:

```tsx
const handleRetryPapers = () => {
  setError(null);
  setLoading(true);
  setPapersAttempts((attempts) => attempts + 1);
};
```

Audit of every piece of state the handler touches:

| state | set where | reset on **all** paths? |
|---|---|---|
| `error` (`App.tsx:110`) | `handleRetryPapers` → `null` | YES. Cleared synchronously on click, before any await. Also cleared at the top of every effect run (`App.tsx:225`, `App.tsx:171`), so a recency change after a failure also clears it. |
| `loading` (`App.tsx:111`) | both handlers → `true` | YES. `App.tsx:240` on success, `App.tsx:250` on error, `App.tsx:176` on manifest error. The papers effect early-returns only when `!manifest`, and `setManifest` is never called with `null`, so the `true` cannot strand. |
| `papersAttempts` (`App.tsx:112`) | functional updater `a => a+1` | N/A — monotonic counter, not a latch. Uses the functional form, so it cannot be lost by a stale closure. |
| `progress` (`App.tsx:113`) | `onProgress` (`App.tsx:228-230`) | YES — set again on the next load's first progress tick. |

The latch substitute is real: `loadFailed` requires `error !== null`, so `setError(null)`
makes the panel unmount in the same commit, and the handler is unreachable until the attempt
settles. Verified empirically — I pressed `Enter` on the button **with the shards still
broken**, and got a fresh panel with a fresh, `disabled === false` button (alert node identity
changed `e42 → e51`, i.e. a new mount). No stuck state.

### 4.3 No stampede on rapid clicks

`handleRetryPapers` issues no `fetch` itself; it only bumps a counter. Two synchronous
activations in one batch produce one dep change, hence one effect run, hence one request per
shard. Pinned by the implementer at `App.loadFailure.test.tsx:304-317`
("does not stampede the network when clicked twice before the retry settles" → exactly 6
shard requests, 3 + 3, not 9). In a real browser each click is a separate task, so React
flushes and the button is unmounted before the second click can land.

### 4.4 The two retry paths do not interfere

| path | handler | counter touched | requests observed |
|---|---|---|---|
| index unavailable (IMP-007) | `handleRetryManifest` (`App.tsx:202-207`) | `manifestAttempts` only | `["index.json", "papers-2026-W40.json", "papers-2026-W39.json"]` — exactly 1 `index.json` |
| all shards failed (new) | `handleRetryPapers` (`App.tsx:213-217`) | `papersAttempts` only | `["papers-2026-W40.json", "papers-2026-W39.json"]` — **0** `index.json` |

Mutually exclusive by construction: the new panel is inside `{manifest && (…)}`
(`App.tsx:599`) and IMP-007's is `{!manifest && error && (…)}` (`App.tsx:606`), so both
"Try again" buttons can never render at once. Confirmed in the browser: `tryAgainCount`
was exactly `1` in each of the two states. `handleRetryPapers` correctly does **not** set
`retriedRef.current`, so it does not steal IMP-007's focus-to-hero behaviour.

---

## 5. Accessibility

- **Failed week visible in prose at 1280px and 390px** — YES, confirmed by **DOM
  `innerText`**, not by inspecting attributes, at both widths:
  `… failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete …`.
  Also present in the rendered screenshots
  (`.improve/artifacts/IMP-016/verify-feed-partial-shard-*.png`). Defect (c) closed.
- **Exactly one alert per state** — verified in Chromium for every matrix cell:
  1 in the fatal-index state, **1** in the all-shards-failed state, **1** in the partial
  state, **0** in the three genuine-empty states. The bare `banner--warning` is correctly
  suppressed for the hard failure by `error && !loadFailed` (`App.tsx:649`) — that is what
  prevents the double announcement, and it is now the only `role="alert"` in that state
  (`bodyHasBanner: false`).
- **Coexisting alert regions are distinct nodes** — `saveFailed` (`App.tsx:621-628`) and
  `unknownCategories` (`App.tsx:631-640`) each render their own `<p className="banner"
  role="alert">`; the two tests at `App.loadFailure.test.tsx:391-422` and `:424-455` assert
  two distinct nodes carrying different sentences. On re-render each is a fresh mount, so
  each is announced once for its own state; the hard-failure catch explicitly clears
  `failedShards` (`App.tsx:248`) with the stated reason that leaving a stale partial notice
  up would double-report a state that no longer holds.
- **Button is keyboard reachable with an accessible name** — real `Tab` from the "Newest"
  sort chip landed on `button "Try again" [active]`. `tabIndex: 0`, `type: "button"`,
  `disabled: false`, name from content ("Try again"), inside the `role="alert"` container.
  Accessible tree renders the alert as `alert [ref=e42]` with no quoted name (unnamed ⇒ its
  contents are read), matching IMP-007's panel.
- **Disclosure**: `title` is genuinely being used as the accessible name on the partial
  notice. Chromium's tree shows
  `alert "papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. Try regenerating the index."`
  I reproduced this independently. It is disclosed at `impl-IMP-016.md:184` and is IMP-017's
  explicit AC2 subject, so it is out of scope here — but it is real, not hypothetical.

---

## 6. Date formatting

`formatWeekRange` (`App.tsx:118-134`) parses `${from}T00:00:00Z` and formats with
`timeZone: "UTC"` + pinned `"en-US"`. I exercised it directly under four timezones:

```
TZ = UTC                     | Intl locale default = en-US
  "2026-09-24" .. "2026-09-27"  ->  "Sep 24 – Sep 27, 2026"
  "2026-09-28" .. "2026-10-01"  ->  "Sep 28 – Oct 1, 2026"
  "2026-12-29" .. "2027-01-04"  ->  "Dec 29, 2026 – Jan 4, 2027"
  "2026-12-28" .. "2027-01-03"  ->  "Dec 28, 2026 – Jan 3, 2027"
  "2026-09-24" .. "2026-09-24"  ->  "Sep 24 – Sep 24, 2026"
  "2026-01-01" .. "2026-12-31"  ->  "Jan 1 – Dec 31, 2026"
  null          .. "2026-09-27" ->  "null to 2026-09-27"
  ""            .. "2026-09-27" ->  " to 2026-09-27"
  "2026-9-4"    .. "2026-9-7"  ->  "Sep 4 – Sep 7, 2026"
  "2026-02-29"  .. "2026-03-01" ->  "Mar 1 – Mar 1, 2026"
  "garbage"     .. "2026-09-27" ->  "garbage to 2026-09-27"

TZ = America/Los_Angeles    ->  byte-identical output to UTC for every case
TZ = Pacific/Kiritimati     ->  byte-identical output to UTC for every case
TZ = Pacific/Pago_Pago      ->  byte-identical output to UTC for every case
```

- **Cross-year week** (the branch the implementer admits is untested): renders
  **"Dec 29, 2026 – Jan 4, 2027"** — sensible, not nonsense. The same-year shortcut is
  correctly bypassed via `start.getUTCFullYear() === end.getUTCFullYear()`. This is a real
  branch, not a hypothetical one: `scripts/build_index.py:150-152` groups by ISO week, and
  an ISO week can straddle New Year.
- **Timezone correctness: correct.** The manifest `from`/`to` are UTC calendar dates with no
  offset; parsing them at `T00:00:00Z` and formatting at `timeZone: "UTC"` makes the output
  fully TZ-independent. A user in a negative-UTC offset **cannot** see a shifted day — I
  confirmed `Pacific/Pago_Pago` (UTC-11) and `America/Los_Angeles` (UTC-7/-8) produce the
  same strings. `toLocaleDateString` without the `timeZone` option *would* have shifted the
  day; the pin is what prevents it.
- **Single-day**: "Sep 24 – Sep 24, 2026" — redundant but not wrong, and reachable:
  `build_index.py:167-168` sets `from = min(published)` / `to = max(published)` over the
  papers actually in the shard, so a shard with one publication day yields `from === to`.
- **Multi-month**: formats fine ("Jan 1 – Dec 31, 2026"), though unreachable with weekly
  shards (max 7 days).

---

## 7. Test non-vacuity — independently reproduced

Scratch copy at pristine HEAD (`git archive HEAD web` + symlinked `node_modules`), new test
file copied in:

```
$ npx vitest run src/__tests__/App.loadFailure.test.tsx --reporter=verbose
  Tests  13 failed | 5 passed (18)
```

Exactly the 13 the implementer named. The 5 that pass at HEAD are the ones they called
deliberate regression guards:

| # | test | line |
|---|---|---|
| 1 | `leaves the index-unavailable panel to IMP-007 and does not shadow it` | `App.loadFailure.test.tsx:268` |
| 2 | `still shows the empty-window copy, with no error and no retry` | `:300` |
| 3 | `still shows the empty-search copy when only the filters exclude everything` | `:325` |
| 4 | `keeps the file name and the raw cause in title for the detail` | `:343` |
| 5 | `stays silent about weeks when every shard loaded` | `:364` |

**"Guards" proven to be real guards, not vacuous passes.** I applied 8 mutations to the
*fixed* `App.tsx` (one per regressed guarantee, 3 of them against guard 1) and re-ran the
targeted test. Script: `/tmp/imp016-verify-mut/mutate.py`.

| mutation | guard targeted | outcome |
|---|---|---|
| M1 `loadFailed = papers.length === 0` (drops `error !== null`) | guard 2 | **CAUGHT** |
| M2 `emptyMessage` hard-coded to the window copy | guard 3 | **CAUGHT** |
| M3 drop the `title` attribute | guard 4 | **CAUGHT** |
| M4 leak the file name into visible text | guard 4 | **CAUGHT** |
| M5 render the partial notice unconditionally | guard 5 | **CAUGHT** |
| M6 hoist the load-failure panel out of the `{manifest && (…)}` gate | guard 1 | **CAUGHT** |
| M7 rename IMP-007's `<h1>` | guard 1 | **CAUGHT** |
| M8 remove IMP-007's Try again button | guard 1 | **CAUGHT** |

`=== mutations not caught: 0 of 8 ===`

Test-file hygiene: HEAD has **12** test files / **184** tests; the change adds 1 file and
**18** tests → **13 files / 202 tests**. Confirmed against the pristine-HEAD scratch copy
where the new file is present but unfixed:

```
Test Files  1 failed | 12 passed (13)
     Tests  13 failed | 189 passed (202)     # 184 pre-existing + 18 new
```

No existing file modified (byte-identical, §1).

---

## 8. Flake check

`npm test` (full suite) run **12×** in `web/`:

```
run  1: Tests  202 passed (202)
run  2: Tests  202 passed (202)
run  3: Tests  202 passed (202)
run  4: Tests  202 passed (202)
run  5: Tests  202 passed (202)
run  6: Tests  202 passed (202)
run  7: Tests  202 passed (202)
run  8: Tests  202 passed (202)
run  9: Tests  202 passed (202)
run 10: Tests  202 passed (202)
run 11: Tests  202 passed (202)
run 12: Tests  202 passed (202)
=== TOTALS: 12 passed, 0 failed out of 12 ===
```

**Pre-fix control under the same harness fails deterministically** — the new file at HEAD,
5×:

```
control 1: Tests  13 failed | 5 passed (18)
control 2: Tests  13 failed | 5 passed (18)
control 3: Tests  13 failed | 5 passed (18)
control 4: Tests  13 failed | 5 passed (18)
control 5: Tests  13 failed | 5 passed (18)
=== PRE-FIX CONTROL: 5/5 runs reproduced the expected 13F|5P ===
```

So the harness detects failures reliably; 0/12 flakes on the fixed tree.

---

## 9. Commands

```
$ npm run typecheck      # tsc --noEmit
  (no output)  exit 0

$ npm test               # vitest run
  Test Files  13 passed (13)
       Tests  202 passed (202)

$ npm run build          # tsc -b && vite build
  ✓ 39 modules transformed.
  dist/index.html                   0.67 kB │ gzip: 0.45 kB
  dist/assets/index-D0wGZKLo.css   10.93 kB │ gzip: 3.21 kB
  dist/assets/index-BM-iOJPQ.js   168.69 kB │ gzip: 53.66 kB
  ✓ built in 2.02s
  exit 0
```

Build artefact sizes match the implementer's report exactly.

---

## 10. Playwright — my own evidence, not theirs

Server: `npx vite preview --outDir /tmp/imp016-preview --port 4173 --strictPort` from `web/`,
serving a **copy** of `web/dist` so no repo file was ever corrupted. Base path
`/research-paper-feed/`. Server stopped (`background_process` stop → `curl` now returns
`000`, connection refused); scratch copies removed.

**Note on the spec's verification method**: under `vite preview` a *missing* data file is
answered by the SPA fallback with `index.html` and HTTP **200**, so the app takes the
"missing or malformed" branch rather than the `(HTTP nnn)` branch. That is handled
correctly (`paperIndex.ts:139-147` treats `text/html` as "not built yet"), and it is why the
fatal panel in cell 1 showed `(HTTP 200)` next to "No paper index yet" — honest, not a bug.

Screenshots written to `.improve/artifacts/IMP-016/`:

| file | state | width |
|---|---|---|
| `feed-load-failed-desktop-1280.png` | all shards fail (spec-required name) | 1280 |
| `verify-feed-load-failed-desktop-1280.png` | all shards fail | 1280 |
| `verify-feed-load-failed-mobile-390.png` | all shards fail (full page) | 390 |
| `verify-feed-partial-shard-desktop-1280.png` | 1 of 2 shards fails | 1280 |
| `verify-feed-partial-shard-mobile-390.png` | 1 of 2 shards fails (full page) | 390 |
| `verify-feed-genuinely-empty-mobile-390.png` | load OK, window empty | 390 |
| `verify-feed-empty-search-desktop-1280.png` | 0-match search | 1280 |
| `verify-feed-empty-search-mobile-390.png` | 0-match search | 390 |
| `verify-feed-no-categories-desktop-1280.png` | no categories selected | 1280 |
| `verify-feed-no-categories-mobile-390.png` | no categories selected | 390 |

I reproduced the implementer's partial-shard screenshots **byte-identically** on the first
try, which is a useful cross-check that we drove identical states:

```
IDENTICAL  feed-partial-shard-named-desktop-1280.png == verify-feed-partial-shard-desktop-1280.png
IDENTICAL  feed-partial-shard-named-mobile-390.png  == verify-feed-partial-shard-mobile-390.png
```

**Baseline comparison.** `.improve/artifacts/baseline/baseline-feed-empty-search-desktop-1280.png`
still shows the genuine empty-search copy ("No papers match the current filters." in the
dashed `.empty` box, no error styling), and my `verify-feed-empty-search-desktop-1280.png`
shows the identical sentence in the identical box. The only diffs are (i) the search term
text and (ii) an extra "All" category chip. Diff (ii) is **baseline staleness, not an
IMP-016 regression**: the baseline PNGs were captured `Oct 1 22:55–23:00`, while every IMP
commit in this branch is dated `Oct 2`; the "All" chip came from `42e0edb IMP-010`, which
landed after the baseline capture (`git log -S 'toggleCategory("All")' -- web/src/App.tsx`).
`App.tsx` is the only file IMP-016 touched, and its diff contains no category-chip code.

**Console**: `playwright_browser_console_messages` after exercising all six states plus two
retries, one failure-recovery cycle and one keyboard-recovery cycle →
**empty output. Zero errors, zero warnings, zero logs.**

---

## 11. Issues found

**Blocking: none.**

### Observations (non-blocking, none falsifies a user-visible claim)

1. **The bare `banner--warning` is now dead code, and the implementer's report claims
   otherwise.** `impl-IMP-016.md:120-127` says the banner is kept for "a real, reachable
   case… a window that replaced a loaded one and could not be fetched. There
   `papers.length > 0`". That state is **unreachable**. `loadShard` returns the cached
   `Paper[]` for any shard that ever succeeded and never re-fetches
   (`paperIndex.ts:159-162, 183`), so after any successful load every shard in the next
   window's selection resolves from cache. I proved it: probe test
   `/tmp/imp016-verify-mut/web/src/__tests__/ZVerifier.stalePapers.probe.test.tsx` loads
   three shards successfully, makes every subsequent shard request reject, then switches the
   window twice:
   ```
   PROBE >>> { "requestsAfterFirstLoad": ["index.json","papers-2026-W39.json",
               "papers-2026-W40.json","papers-2026-W41.json"],
               "requestsAfterWindowSwitches": [],       <-- zero shard re-requests
               "alertCount": 0, "articlesRendered": 3,
               "showsBareWarningBanner": false, "showsLoadFailurePanel": false }
   ```
   The code itself is **correct and safe** (`error && !loadFailed` is the right guard); only
   the report's reachability claim is wrong. Low severity — worth correcting so a future
   reader does not preserve the banner for a state that cannot occur.

2. **`formatWeekRange` degrades ungracefully on non-`YYYY-MM-DD` input.** `"2026-9-4"` and
   `"2026-2-29"` are accepted by `new Date()` and silently normalise to "Sep 4" / "Mar 1";
   `null`/`""` produce `"null to 2026-09-27"` / `" to 2026-09-27"`. Unreachable from this
   repo's own builder (`build_index.py:167-168` writes `min`/`max` of real
   `date.isoformat()` strings and the shard can't exist without papers), and the
   `Number.isNaN` guard falls back to the raw values, which is at least *unmisleading*
   (garbage in → garbage shown, not a wrong-but-confident date). No action needed unless you
   want a strict `^\d{4}-\d{2}-\d{2}$` guard.

3. **Focus is lost after the new `Try again`.** `handleRetryPapers` does not set
   `retriedRef.current`, so after the button unmounts, `document.activeElement` falls back to
   `<body>`; a keyboard user must Tab from the top again. IMP-007's retry does move focus to
   the hero. Not in any criterion; consistent with the pre-existing partial-failure design
   (no retry there at all).

4. **The toolbar reads "0 papers match" during the load-failure state.** Not a lie — nothing
   loaded, so nothing matches, and the failure panel sits directly beneath it explaining why
   — but it is a second, unstyled number that a skim reader could take for emptiness. Purely
   cosmetic.

5. **The new panel's `<p>{error}</p>` (`App.tsx:690`) renders a raw `Error.message` as
   visible text**, the same pattern as IMP-007's panel at `App.tsx:513`. This puts a fifth
   user-reachable raw string where IMP-017's AC2 enumeration expected three, and
   `App.loadFailure.test.tsx:261` deliberately pins it:
   `expect(panel.textContent).toContain("Failed to load papers-2024-W10.json")`.
   IMP-017 will have to touch the new panel **and this assertion**. Disclosed honestly at
   `impl-IMP-016.md:184`, but it is a coordination dependency that will bite whoever picks
   up IMP-017 next.

6. **`title` is the accessible name of the partial notice.** Reproduced in Chromium's tree:
   `alert "papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. …"`.
   Out of scope (IMP-017 AC2), and disclosed by the implementer — recorded here so it is not
   mistaken for a clean sheet.

7. **Cross-year and single-day rendering remain untested in the suite.** The code is correct
   (§6), but a regression in that branch would not be caught by any test. Two lines in
   `App.loadFailure.test.tsx` asserting `"Dec 29, 2026 – Jan 4, 2027"` and
   `"Sep 24 – Sep 24, 2026"` would close it. Cheap, and this is exactly the branch the
   implementer flagged as uncovered.

8. **`vite preview` returns `index.html`/200 for missing `/data/*` files**, so the
   spec's verification method never exercises the `(HTTP nnn)` shard path locally; the app
   handles it (`paperIndex.ts:143-147`), but the `(HTTP 404)` variant of the copy is only
   covered by the jsdom fixtures. Noted for whoever reads the screenshots — `(HTTP 200)`
   beside "No paper index yet" is correct behaviour, not a capture error.

---

## 12. Commands run, verbatim

```
git status --porcelain
git diff -- web/src/App.tsx
git diff --stat
shasum web/public/data/*.json
shasum <each file> ; git show HEAD:<path> | shasum          # styles.css, paperIndex.ts, PaperList.tsx, all 13 test files
grep -rnE "\b(it|test|describe)\.(skip|only|todo)|..." web/src/__tests__ web/src/lib/__tests__

# /tmp/imp016-verify-vacuity  (git archive HEAD web + symlinked node_modules + new test file)
npx vitest run src/__tests__/App.loadFailure.test.tsx --reporter=verbose    # 13 failed | 5 passed (18)
#   x5 as a flake-harness control — 5/5 identical

# /tmp/imp016-verify-mut  (HEAD tree + fixed App.tsx + new test file)
npx vitest run src/__tests__/App.loadFailure.test.tsx                        # 18 passed (18)
python3 mutate.py                                                             # 8/8 mutations caught
npx vitest run src/__tests__/ZVerifier.stalePapers.probe.test.tsx            # 1 passed

for tz in UTC America/Los_Angeles Pacific/Kiritimati Pacific/Pago_Pago; do TZ=$tz node /tmp/imp016-fmt.mjs; done

# web/
npm run typecheck      # exit 0, no output
npm test               # Test Files 13 passed (13) | Tests 202 passed (202)   x12
npm run build          # 39 modules, 10.93 kB css, 168.69 kB js, built in 2.02s, exit 0

# browser
npx vite preview --outDir /tmp/imp016-preview --port 4173 --strictPort   (stopped; curl -> 000)
```

**Read-only respected**: I modified no source file. Writes were confined to
`.improve/reports/verify-IMP-016.md`, screenshots under `.improve/artifacts/IMP-016/`, and
throwaway copies under `/tmp` (`/tmp/imp016-verify-vacuity`, `/tmp/imp016-verify-mut`, the
`/tmp/imp016-preview` server root, now deleted). No git write command was run.