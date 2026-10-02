# IMP-016 — implementation report

**Status:** done. Not a retry — no `.improve/reports/verify-IMP-016.md` existed.

## Files changed

| File | Change |
| --- | --- |
| `web/src/App.tsx` | The fix. Three pieces: a derived `loadFailed` state, a load-failure panel with a Try again button, and the failed week named in the partial-shard notice's prose. |
| `web/src/__tests__/App.loadFailure.test.tsx` | **New**, 18 tests in 4 `describe` blocks. |
| `.improve/artifacts/IMP-016/*.png` | 5 Playwright screenshots (dir is gitignored via `.git/info/exclude`, same as IMP-015's). |
| `.improve/reports/impl-IMP-016.md`, `.improve/reports/discovered-IMP-016.md` | This report; observations I did not fix. |

**No CSS was added.** `styles.css` is byte-identical to HEAD — the build's CSS size is unchanged at 10.93 kB. Every class used already existed (`panel`, `panel--error`, `banner`, `banner--error`, `banner--warning`, `button`, `empty`).

`paperIndex.ts` and `PaperList.tsx` are **untouched**. `PaperIndex.loadPapers` already does the right thing — it does not cache a shard that failed (`this.shardCache.set(shard.file, null)` is skipped for a rejection), so a retry genuinely re-requests. Nothing in the lib needed to change, which is why IMP-015's lib tests are all still green untouched.

## The three defects

### (a) The spec's own defect — the false "no papers" claim

The spec's AC1 is "when `error` is set and `papers.length === 0`, render a load-failure state, never the 'no papers are available' empty message". AC2 is the same condition stated from the other side: the empty message must be reachable only when the load succeeded and genuinely returned nothing.

`App.tsx:300` derives exactly that condition:

```ts
const loadFailed = error !== null && papers.length === 0;
```

It is a branch in the feed-body ternary chain (`App.tsx:641`), placed between `loading` and `noCategoriesSelected`, so **`PaperList` is not rendered at all** in this state. The `.empty` node and the "No papers are available in this window yet." string cannot be produced. AC2 then holds structurally rather than by a second condition: the string is reachable only from the `PaperList` branch, which is now unreachable while `error` is set.

The copy is honest in both directions and names the distinction explicitly:

> **Papers could not be loaded.** The index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window.

A test asserts the panel does **not** match `/no papers are available/i` as well as asserting the false string is absent from the DOM — so the fix cannot be "say the same false thing louder".

### (b) No recovery affordance on the all-shards-failed state

Confirmed the verifier's claim before changing anything: at HEAD the state was a bare `<p className="banner banner--warning" role="alert">{error}</p>` with no interactive child, byte-identical to the pre-existing behavior at the old `App.tsx:408` gate. It is now a `div.panel.panel--error[role="alert"]` in the feed-body slot containing a `<button type="button" className="button">Try again</button>`.

**This reuses IMP-007's established pattern rather than adding a second mechanism.** Concretely:

- Same `panel panel--error` + `button` class pair IMP-007's `No paper index yet` panel established. No new CSS.
- Same handler shape as `handleRetryManifest` (`App.tsx:213`): clear `error`, set `loading`, bump an attempt counter. Same double-click latch reasoning, and the latch is actually sound here for the same reason IMP-007's is — the button is mounted only while `error` is set, so `setError(null)` unmounts it in the same commit and a second activation cannot reach the handler. Covered by a test that fires two clicks in one tick and asserts exactly one extra round of shard requests.
- A separate `papersAttempts` counter, added to the papers effect's deps (`App.tsx:256`), rather than reusing `manifestAttempts`. **A test pins `index.json` to exactly one request across a retry** (`log.indexRequests === 1`, shard requests 3 → 6). This is the concrete proof that no second mechanism was invented: the retry re-requests only the missing shards, because the manifest is already in hand and was never refetched.

**The `!manifest` fatal panel is not broken.** It is untouched, still rendered by the `!manifest && error` gate one level up, with its own heading and its own Try again. A test drives the index-unavailable path and asserts the load-failure panel is *not* rendered at all, that "No paper index yet" still is, and that the fatal panel still carries its own working Try again button. IMP-007's own 7 tests in `App.retry.test.tsx` pass untouched.

One deliberate carry-over: the raw `Error.message` stays visible in the panel's second paragraph. It is `theme.ts`'s copy, owned by IMP-017 (`WEB-04`), and moving or rewriting it here would be IMP-017's call. A test pins that it is still present, and a second pins that the load-failure copy does not leak into a "no papers are available" claim.

### (c) The failed week was only in `title`

The IMP-015 notice said only *"One week"* — a count, not a name — and put the shard's file name in `title`. `title` renders no tooltip on touch, so at 390px nothing on screen named the failed week. Verified in the real browser at 390px: the text now reads

> Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown.

`formatWeekRange` (`App.tsx:79`) turns the manifest shard's `from`/`to` into that range; `describeFailedWeeks` (`App.tsx:101`) composes the sentence and handles 1, 2 and n weeks.

**`title` is unchanged** and still carries `papers-2026-W39.json: Shard … is missing or malformed.` — so IMP-017's AC2 (no file name, no HTTP status in the visible text) is preserved. Tests assert the prose matches `/failed to load \(/` and does **not** contain the file name, `404`, or `Failed to load`.

Two deliberate calls worth flagging:

- **The week range is derived in `App.tsx` from `manifest.shards`, not by extending `ShardLoadFailure`.** That keeps `paperIndex.ts` and its 6 test files untouched. The lookup is by `file`, which is what `loadPapers` keys `failedFiles` on.
- **`formatWeekRange` pins `en-US` and `UTC`, unlike `formatGeneratedAt` above it.** The endpoints are bare `YYYY-MM-DD` days, so a local zone west of Greenwich would print the day *before*, and a reader's locale would change which week the notice claims is missing. Pinning makes the rendered string identical on every machine, which is also why these assertions cannot flake. This is a deliberate inconsistency with the neighbouring function; it is commented in place.

## Not regressing the landed banners

There are now up to four independent `role="alert"` regions. What I did to keep them sound:

1. **The bare `banner--warning` stands down for the load-failure panel** (`App.tsx:566` is now `error && !loadFailed`). Without this the hard failure would render as *two* alerts saying the same thing. With it, the hard-failure state is exactly one alert — the same count HEAD had, which is why IMP-015's own all-shards-failed assertion (`getAllByRole("alert")` length 1, containing the shard file name) still passes untouched.
2. **The bare banner is kept for a real, reachable case it already served**: a window that replaced a loaded one and could not be fetched. There `papers.length > 0`, so `loadFailed` is false and the pre-existing banner + stale feed behavior is unchanged. `loadFailed` is *not* simply `error !== null`, so I did not fold that case into the new panel.
3. **Node identity, not just count.** Each region is gated purely on its own condition, so React reuses the node across unrelated re-renders and the assertive announcement fires once per event, not per keystroke. Two tests assert `expect(failurePanel()).toBe(first)` across a search `change` round-trip, and that `getAllByRole("alert")` still has length 1 afterwards.
4. **Coexistence is tested, not assumed.** New tests drive a `FullStorage` stub (the same root cause as `App.storage.test.tsx:42-50` — jsdom 29's `localStorage` is not a function, so IMP-011's save banner is otherwise unreachable in tests) and assert the save banner and the load-failure panel are two distinct nodes with non-overlapping text, surviving a re-render. A second asserts the same for the unknown-category banner via `#cat=cs.BI`.
5. **IMP-015's own 4 tests in `App.partialShard.test.tsx` pass untouched** — including the one asserting a *partial* failure has no Try again, and the one asserting the notice's `title` contains the file name and `HTTP 404`.

## Commands and results

Baseline before any change, then after. All from `web/`, with timeouts.

| Command | Baseline (HEAD) | After |
| --- | --- | --- |
| `npm run typecheck` | clean, no output | clean, no output |
| `npm test` | **184 passed / 184 (12 files)** | **202 passed / 202 (13 files)** |
| `npm run build` | clean, 39 modules, CSS 10.93 kB, JS 167.40 kB | clean, 39 modules, CSS 10.93 kB, JS 168.69 kB |

+18 tests, +1 file, no failures, no skips. CSS byte-identical; the +1.29 kB of JS is the new state, handler, notice text and helpers. No pre-existing test was edited — the only files I touched are `App.tsx` and the new test file.

### FLAKE CHECK — 12 consecutive full `npm test` runs

```
run  1: 13 passed (13) | 202 passed (202)
run  2: 13 passed (13) | 202 passed (202)
run  3: 13 passed (13) | 202 passed (202)
run  4: 13 passed (13) | 202 passed (202)
run  5: 13 passed (13) | 202 passed (202)
run  6: 13 passed (13) | 202 passed (202)
run  7: 13 passed (13) | 202 passed (202)
run  8: 13 passed (13) | 202 passed (202)
run  9: 13 passed (13) | 202 passed (202)
run 10: 13 passed (13) | 202 passed (202)
run 11: 13 passed (13) | 202 passed (202)
run 12: 13 passed (13) | 202 passed (202)
=== TOTAL: 12 passed, 0 failed out of 12 ===
```

**12/12, 202/202 every time, 0 failures.** (The 12 runs were in addition to the several single runs during development, so ~18 full runs in total.)

Determinism notes, since two items in this batch were rejected for flake: the only new timing-sensitive assertions are around the retry's loading window, and they rely on the same mechanism as IMP-007's already-passing `"clears the error panel, shows the loading status"` test — `fireEvent`'s `act()` flushes effects synchronously while the fetch's promise chain is still pending microtasks. The date assertions are locale- and timezone-pinned (see (c)), and the en-dash is never asserted literally; the tests match `/Feb 19\b/`, `/Mar 4\b/` and `/failed to load \(/` instead.

### Non-vacuity

Built a scratch copy at `/tmp/imp016-vacuity` with `git archive HEAD web`, symlinked `node_modules`, and copied in **only** the new test file — so `App.tsx` was pristine HEAD — then ran the 18 new tests against it:

**13 of 18 FAILED without the fix.** The 5 that pass are exactly the intended regression guards, and they pass before *and* after:

- both "genuinely empty" tests (must keep showing the real copy)
- "keeps the file name and the raw cause in title" (IMP-015's `title` behavior, already satisfied)
- "stays silent about weeks when every shard loaded" (nothing should render on a clean load)
- "leaves the index-unavailable panel to IMP-007" (IMP-007's panel, already correct)

So every test that asserts *new* behavior is load-bearing, and none of the "unchanged" guarantees are tautological.

## Playwright evidence

Method per the spec: the spec's "corrupt one shard" step now yields a *partial* notice, because IMP-015 made one bad shard non-fatal. To reach the hard-failure state I corrupted **every shard in the window**. With this index both shards fall inside all three recency windows, so both had to break. Data was backed up to `/tmp/imp016-data-backup` first and restored afterwards — all three files verified back to their original sha1.

Server: `npm run dev -- --port 5199 --strictPort` (dev, not a `dist` preview, because `vite build` copies `public/` at build time and the built output still holds the pristine shards).

**1. Hard failure, both shards non-JSON, 1280px** → `.improve/artifacts/IMP-016/feed-load-failed-desktop-1280.png`

```json
{ "alertCount": 1,
  "alerts": [{ "cls": "panel panel--error",
    "text": "Papers could not be loaded. The index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window.Shard papers-2026-W40.json is missing or malformed. Try regenerating the index.Try again" }],
  "emptyNodes": [], "paperListPresent": false, "articleCount": 0,
  "tryAgainButtons": [{ "text": "Try again", "cls": "button", "inAlert": true }],
  "hasFalseClaim": false }
```

`hasFalseClaim: false` is defect (a) closed in a real browser: no `.empty` node, no `.paper-list`, 0 articles, and the string absent from the document.

**2. Same state at 390px** → `feed-load-failed-mobile-390.png`. The panel, the copy and the Try again button are all on screen and legible — defect (b) closed at the project's 390px viewport.

**3. Recovery.** Restored both shards, then clicked Try again **with no page reload**:

```json
{ "alertCount": 0, "articleCount": 50, "resultCount": "2812 papers match",
  "hasFalseClaim": false, "tryAgainPresent": false, "heroPresent": true }
```

2 812 papers back, no alert, no button left behind.

**4. Partial failure, only `papers-2026-W39.json` non-JSON** → `feed-partial-shard-named-desktop-1280.png` and `feed-partial-shard-named-mobile-390.png`:

```json
{ "alertCount": 1,
  "visibleText": ["Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown."],
  "titles": ["papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. Try regenerating the index."],
  "classes": ["banner banner--error"],
  "articleCount": 50, "resultCount": "2812 papers match", "tryAgainPresent": false }
```

`Sep 24 – Sep 27, 2026` is the W39 shard's real `from`/`to` from the live manifest, matching `range.expected` for that shard. 2 549 papers showed (2 812 − the 263 in W39) with the feed still incomplete and still named. `title` is unchanged, so the filename and raw message survive for detail. Exactly one alert.

**5. Genuine empty search, 390px** → `feed-genuine-empty-search-mobile-390.png`:

```json
{ "viewport": 390, "alertCount": 0,
  "emptyText": ["No papers match the current filters."],
  "paperListPresent": false, "articleCount": 0, "resultCount": "0 papers match",
  "tryAgainPresent": false, "hasFalseClaim": false }
```

The real empty-search copy still renders, with no alert and no retry — the empty states were not turned into errors.

**Console across all five states:** only the three expected Vite dev-server lines (`[vite] connecting…`, `[vite] connected…`, the React DevTools notice). No errors, no warnings, no React messages.

## Uncertainties and things a verifier should push on

- **`describeFailedWeeks` has a branch that cannot be reached through the UI.** `loadPapers` builds `failedFiles` from `selectShards(manifest, …)`, so every failed shard's `file` is by construction in `manifest.shards` and the lookup always hits. The `named.length === 0` fallback ("One week in this window failed to load") and the `null` in `(string | null)[]` are pure defensiveness. I kept them because a notice that must stay honest is the wrong place to assume, and they cost one branch — but I did not write a test for them, since a test that cannot fail without contrived state would be a fake one. Flagging it as dead-by-construction rather than quietly claiming coverage.
- **`formatWeekRange`'s cross-year branch is also untested.** Two shards in one year is what the fixtures provide; `Dec 29, 2024 – Jan 4, 2025` is not exercised. It is three lines and the format is asserted on the single-year path.
- **The `en-US` pin is a real, deliberate inconsistency** with `formatGeneratedAt`, which uses the ambient locale. If the project would rather have a reader's locale in this notice, that is a one-token change — but it would make the rendered week depend on the viewer's machine, which is the thing I was avoiding.
- **The panel's raw `Error.message` paragraph is unchanged pre-existing debt** (IMP-017 / `WEB-04`: `theme.ts`'s "Shard … is missing or malformed. Try regenerating the index."). I did not touch it, and a test pins that it is still visible, so IMP-017 will need to update that test when it rewrites the copy. Worth knowing before it starts.
- **I did not add a Try again to the partial-failure notice.** The verifier's (b) was specifically about the all-shards-failed state, and `App.partialShard.test.tsx:239-241` asserts a partial failure has no such button. Adding one would be a new feature beyond this item and would contradict a landed assertion.
- **`web/public/data/` is gitignored** (`web/.gitignore:2`), so the corrupted-then-restored shards never entered the working tree. Verified: `git status --porcelain` shows only `M web/src/App.tsx`, `?? web/src/__tests__/App.loadFailure.test.tsx`, and two `discovered-*.md` files that belong to other items. No git write command was run at any point.
- **The `--localstorage-file` Node warning** appears on every test run. Pre-existing, first recorded by INF-15/IMP-011, not touched here.

## Discovered, not fixed

Written up in `.improve/reports/discovered-IMP-016.md`.
