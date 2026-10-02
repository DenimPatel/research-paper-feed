# Verification — IMP-173

**Item:** Stop a JSON `null` manifest from hanging the app on "Loading the paper index…" forever
**Verifier:** independent, skeptical. Did not write the change.
**Verdict:** **PASS** — 4/4 acceptance criteria met, both disclosed deviations independently
reproduced and judged. Two non-blocking findings are recorded in §9 (one documentation nit in the
implementer's report, one real coverage gap around the `useLayoutEffect` swap).

Scope reviewed: `git diff -- web/` only. The concurrent IMP-022 work in `scripts/`, `tests/` and
`readme.md` was ignored. No source file was modified; no git write command was run. `.kilo/worktrees/
mildly-income` was not read.

---

## 1. Commands, exact results

All from `web/`, against the working tree as the implementer left it.

| Command | Result |
| --- | --- |
| `npm run typecheck` | **exit 0, no output** |
| `npm test` | `Test Files 15 passed (15)` / `Tests 237 passed (237)`, Duration 3.75 s |
| `npm run build` | exit 0 — `41 modules transformed`, `dist/index.html 1.00 kB (gzip 0.51)`, `dist/assets/index-G-YE6pVt.css 10.93 kB (gzip 2.86)`, `dist/assets/index-QfQh4pGz.js 171.40 kB (gzip 54.91)`, built in 376 ms |
| `npm test` × 14 (flake check) | **pass=14 fail=0**, every run `Tests 237 passed (237)` |

The build figures match the implementer's report exactly, including the asset hash
`index-QfQh4pGz.js` — so the `dist/` trees measured in §3 are byte-identical to the repo build.

`web/public/data/` was never modified (`index.json` mtime 10:45, md5 `013d03aac20d775ca76a5bab1132d155`,
same at the end of the session). Only the gitignored `web/dist/` was rebuilt.

---

## 2. Acceptance criteria

### AC1 — `fetchManifest` rejects a non-plain-object body as `malformed` — **MET**

`web/src/lib/paperIndex.ts:181-202`. The predicate is the spec's, verbatim:

```ts
// paperIndex.ts:199
if (body === null || typeof body !== "object" || Array.isArray(body)) {
  throw new IndexUnavailableError(INDEX_MALFORMED, "malformed");
}
return body as IndexManifest;
```

`INDEX_MALFORMED` (`paperIndex.ts:92`) is byte-identical to the string that was inline before, so every
pre-existing assertion on it still matches (confirmed: all 232 pre-existing tests pass).

**All three bodies tested, not just `null`.** `web/src/lib/__tests__/paperIndex.test.ts:369` iterates
`null`, `[MANIFEST]`, `"index.json"`, `7`, `true`, asserting `instanceof IndexUnavailableError`,
`kind === "malformed"`, and the exact message for each. `paperIndex.test.ts:341-343` additionally
pushes the null/array/string bodies into the pre-existing "recovers via refreshManifest after every
manifest failure mode" table, so IMP-003's non-memoization is proven for them as well.

Ordering is right: the `content-type: text/html` / `!response.ok` check at `:179` still runs first, so
a missing index served as an HTML SPA fallback is still `kind: "unavailable"` (transient register),
not `malformed`. Verified live in §4.

### AC2 — `setLoading(false)` on the success branch — **MET**

`web/src/App.tsx:189`, inside the `.then` at `:181-191`, with a comment explaining why. Literal
compliance. Testability judged separately in §6.

### AC3 — App-level test for a `null` manifest — **MET**

`web/src/__tests__/App.loadFailure.test.tsx:581-675`, `describe("an index file whose body is JSON
null")`, three tests. The stub (`:583-598`) answers `/index.json` with `jsonResponse(null)` — HTTP 200,
`Content-Type: application/json` — and 404s everything else.

- `:601` "replaces the indefinite loading line with the index-unavailable panel" — `await
  screen.findByText("No paper index yet")`, then `queryByText(/Loading the paper index/)` is `null`
  immediately **and** again inside a `waitFor` (so "settled", not "momentarily absent"), plus no hero
  and no search box.
- `:621` — asserts the panel is `panel panel--error`, one `role="alert"`, a real `BUTTON` labelled
  exactly `Try again`, not `disabled`, `indexRequests === 1`; clicks it and waits for
  `indexRequests === 2` (IMP-003's non-memoization makes the retry real), asserts the panel returns
  and `shardRequests` is `[]` (no window is ever requested).
- `:657` — the malformed sentence, not the raw loader text; asserts it does **not** say "usually
  temporary".

Counts: **15 test files, 237 tests** (232 + 5). No existing expectation weakened — see §5.

### AC4 — no field-level validation — **MET, and the fix is genuinely minimal**

`fetchManifest` checks **only** that the body is a plain object. It never reads `categories`,
`shards`, `totalPapers`, `generatedAt` or `retentionDays`; the bare `return body as IndexManifest`
cast is still there and still trusts every field. There is no `typeof body.categories` check, no
`Array.isArray(body.shards)`, no `Number.isFinite(body.totalPapers)` anywhere in the file.

The scope boundary is *pinned by a test*, not just asserted in prose: `paperIndex.test.ts:414`
"accepts any plain object as a manifest, however few fields it has" asserts `getManifest()` resolves
`{}`. So an over-broad future "improvement" of this gate fails the suite.

The implementer's report states AC4 explicitly (§3, "AC4 — scope left to IMP-098 (explicit)"), and
`.improve/reports/discovered-IMP-173.md` files the seven still-unusable plain-object cases (missing
`categories`, missing `totalPapers`, unusable `shards`, `categories: []`, …) as IMP-098's, with the
correct note that items 1 and 2 need a **render-time** guard, not just a loader-side check. I
independently reproduced case 1 live: a manifest of `{}` throws
`TypeError: Cannot read properties of undefined (reading 'map')` during render and IMP-018's boundary
catches it (`feed-plain-object-manifest-render-error-desktop-1280.png`). Correctly left alone here.

**Verdict on minimality: the production diff is 3 hunks in 2 files, ~14 lines of code plus comments.
This is as small as the bug allows.**

---

## 3. The `useLayoutEffect` deviation — independently reproduced and judged

### 3.1 The flash is real, and it is exactly one painted frame

Method: `playwright-core` 1.57 driving the cached Chromium 1243 build, with an
`addInitScript` sampler installed **before any app script runs**. It records, per animation frame
(state the browser is about to paint) and per `MutationObserver` callback (state committed, painted
or not), whether the DOM contains `/No papers are available in this window yet/`,
`/Loading the paper index/`, `/Loading papers from/`, and how many `article.paper` cards are mounted.
Three production builds, each with the real 2,812-paper `web/public/data/` mounted:

| Build | cold loads with ≥1 **painted** "No papers are available…" frame |
| --- | --- |
| `prefix` — pre-fix (no AC1, no AC2, `useEffect`) | **0 / 3** |
| `effect` — AC1 + AC2, papers effect reverted to `useEffect` | **6 / 6** |
| `cur` — as shipped (AC1 + AC2, `useLayoutEffect`) | **0 / 6**, and **0 / 4** again on the `vite preview` server |

Painted state sequences, `effect`:

```
--/------/------/p0     (empty document)
IDX/------/------/p0    "Loading the paper index…"
--/NOPAPERS/------/p0   <-- the regression: manifest in hand, loading false, papers []
--/------/PAPERS/p0     "Loading papers from 2 weeks… (0/2)"
--/------/------/p50    the feed
```

Painted state sequences, `cur` — the intermediate commit never reaches the screen:

```
IDX/------/------/p0
--/------/PAPERS/p0
--/------/------/p50
```

**The implementer's claim is accurate and reproducible: 6/6 cold loads paint exactly one frame of
"No papers are available in this window yet."** That is the exact false claim IMP-016's panel exists
to make impossible, on the happy path, on every load. AC2 without the hook change is a real
regression of a landed item, not a theoretical one. With the shipped change the flash is **gone**,
measured on both a `python3 -m http.server` tree and the real `vite preview` server.

### 3.2 Is `useLayoutEffect` the right fix? The costs, checked one at a time

**SSR warning: cannot fire.** `web/index.html` has an empty `<div id="root">` and one module script;
`web/src/main.tsx:14` is `createRoot(container).render(...)`. `grep -rn "renderToString|renderToStaticMarkup|hydrateRoot|prerender|ssr" src index.html vite.config.ts package.json` → **no matches**. This is a client-only static SPA (profile §2), so React's "useLayoutEffect does nothing on the server" warning is unreachable. Risk: theoretical, and would only become real if the app ever gained SSR/prerender.

**Input delay on a large feed: no measurable regression at p50, a tail at p90.** Interleaved A/B/C,
200 cards on screen, recency-chip click → next painted frame, 18 samples each, warm-up discarded:

```
effect (useEffect, current guard)  n=18  min 24  p50 28  p90 29  max 30  mean 28
cur    (useLayoutEffect)           n=18  min 27  p50 29  p90 63  max 64  mean 41
altA   (useEffect + guard fix)     n=18  min 22  p50 29  p90 62  max 63  mean 39
```

An earlier 8×2 interleaved run with 200 cards gave `cur` p50 28 ms vs `effect` p50 29 ms
(delta −1 ms), which is why I re-ran with a warm-up: the honest reading is **p50 identical, p90
roughly doubles to ~63 ms, absolute max 64 ms** — inside the INP "good" band (<100 ms) and far below
the 200 ms "needs improvement" line. Longest `longtask` observed: 56 ms. The metric also flatters
`useEffect`: with a passive effect the first frame after the click shows the *stale* list, which is
already-painted content and therefore cheap. The same work, moved before the paint instead of after
it. Not a defect, but the number is real and should not be reported as zero.

**Effect ordering: checked every other effect in `App`, no hazard found.**

| Effect | Line | Interaction with the phase change |
| --- | --- | --- |
| hashchange listener | `:126` | deps `[]`, mount-only. Unrelated. |
| manifest load | `:169` | deps `[manifestAttempts]`. Does not re-run on the commit where the manifest lands, so hoisting the papers effect past it changes nothing. |
| `retriedRef` heading focus | `:207` | deps `[manifest]`. Fires in the passive phase either way (the layout effect's `setState` is flushed synchronously *before* paint, and the passive queue runs after it), so focus still lands post-paint. No change; IMP-007's recovery test is green in all 14 runs. |
| `setVisibleCount(PAGE_SIZE)` | `:348` | now runs *after* the papers effect rather than before. Bails out when `visibleCount` is already 50; when it is not, the loading panel masks the list, and the 200-card recency run confirms the list comes back at exactly 50. |
| **save effect (regression-3 gate)** | `:398` | **Unaffected.** It is still passive, still gated on `unsavedChanges.current`, which is set only by the `dispatch` wrapper at `:381-384` — i.e. only by a user-caused change. Hoisting the papers effect out of the passive queue does not move the save effect relative to `collections` changes. Verified end-to-end in §7. |
| category/hash-sync (`applyState`, `writeHash`, `activeCategories`, `resolveCategories`) | `:157`, `:299-340`, `:413-420` | all render-time derivations or event handlers; no effect-phase dependency. |

Child effects: `PaperList`, `FeedControls`, `CollectionsView` and `PaperCard` contain no effects that
observe `loading`, `manifest` or `papers`. Layout effects fire child-first, so the hoisted effect runs
*after* every child layout effect either way.

**Double-invocation:** `main.tsx:16` wraps the app in `StrictMode`, so in dev the effect runs
mount→unmount→remount. That was already true of `useEffect`; the layout variant behaves the same and
`setLoading(true)` is idempotent. No change.

### 3.3 A less invasive alternative exists — and I verified it works

The task asked me to look for one. There is one, and it is smaller in blast radius than the hook swap.
Built in a scratch copy at `/tmp/v173/altA` (never in the repo): keep the papers effect as
`useEffect` and stop the *render guard* from claiming emptiness while the current load is unsettled.

```ts
// a. new state: the window whose papers are actually on screen
const [settledKey, setSettledKey] = useState<string | null>(null);

// b. derive the key the effect is loading for, next to `loadFailed`
const papersKey = manifest === null
  ? null
  : `${urlState.recency}:${manifest.generatedAt ?? ""}:${papersAttempts}`;
// True until the load for the *current* key has settled. Deliberately not `loading`:
// `loading` is briefly false between the manifest landing and this effect starting,
// and the guard must not open in that window.
const papersPending = papersKey !== null && settledKey !== papersKey;

// c. record the key in BOTH settle paths (.then at :265 and .catch at :276) —
//    without the catch, a failed load leaves papersPending true and the loading
//    panel masks IMP-016's failure panel forever (14 tests fail until you add it).
setSettledKey(papersKey);

// d. render guard at :722
{loading || papersPending ? ( /* loading panel */ ) : loadFailed ? ( ... )}
```

Measured on a production build of `altA`, same sampler, same server:

| Build | cold loads with ≥1 painted "No papers are available…" frame | painted sequence | tests |
| --- | --- | --- | --- |
| `altA` (useEffect + `settledKey` guard) | **0 / 6** | `IDX → PAPERS → feed` — identical to `cur` | `tsc` clean, **237/237** |

**Assessment.** Both fixes are correct. My verdict is that the implementer's choice is **defensible and
arguably the better engineering**, for a reason worth stating rather than glossing over:

- `useLayoutEffect` is a **one-token change that is self-maintaining**. It cannot drift: whatever
  dependencies the effect acquires later, it still runs before paint.
- `altA` is ~6 lines and introduces a **duplicated description of the effect's dependency list**
  (`papersKey` must be kept in lockstep with `[manifest, urlState.recency, papersAttempts]`). Add a
  dependency to the effect and forget the key, and the guard silently stops covering the new case —
  the exact class of bug being fixed here.
- It also fixes the class rather than one window into it (the same flash would reappear from any other
  source of a settled-but-stale `loading`), which is the stronger argument for it.

Against that: it changes an effect's phase, which is a global property, and it puts a ~35 ms tail on
the first paint after a recency click. Both are small, and the SSR warning is unreachable in this app.

**Neither is wrong. I do not require a change.** The one thing I do require is recorded in §9.2: the
hook choice is currently protected by nothing but a comment, and a future refactor back to
`useEffect` would silently reintroduce a one-frame IMP-016 regression with a fully green suite.

---

## 4. End-to-end: the original hang is actually fixed

Seven states, each served by the real `vite preview` from `web/` (`npm run preview -- --port 5199` for
the normal state; `npx vite preview <tmp-root> --base /research-paper-feed/` over copies of the
repo's own `dist/` for the broken ones, so `web/dist` and `web/public/data` were never touched).
Sampled at 1280×900 and 390×844.

| State | `data/index.json` | settled | `/Loading the paper index/` left | panel | Try again re-requests | page errors |
| --- | --- | --- | --- | --- | --- | --- |
| normal | real | 430 ms | none | — (feed, 50 cards, "2812 papers match") | n/a | 0 |
| **JSON `null`** | `null`, HTTP 200, `application/json` | **343 ms** | **none** (`statusNodes: 0`) | `No paper index yet`, 1 `role="alert"`, `panel--error` | **yes, 1 → 2 requests** | 0 |
| JSON array | `[{…}]` | 433 ms | none | same panel | yes, 1 → 2 | 0 |
| JSON string | `"index.json"` | 389 ms | none | same panel | yes, 1 → 2 | 0 |
| missing | absent → SPA HTML fallback, HTTP 200 | 208 ms | none | same panel, **transient** copy ("usually temporary") | yes, 1 → 2 | 0 |
| corrupt shard | real; `papers-2026-W40.json` = `{ this is not json` | 422 ms | none | IMP-015 partial banner + 50 cards, 0 papers lost silently | n/a | 0 |
| every shard 404 | real | 414 ms | none | IMP-016 "Papers could not be loaded." panel | **yes, 3 → 5 shard requests** | 0 |

Spec's 2-second budget: the `null` manifest panel is on screen in **343 ms** (1280) / **269 ms** (390)
— sub-second including navigation. No state hangs; no state throws uncaught (`pageErrors: 0`
everywhere). The array and string bodies land in the *same* error panel as `null`, confirming AC1's
three-way requirement in a real browser, not only in jsdom.

**No new console errors.** The only console output on the failure states is the single intentional
IMP-017 line, `paper feed: the index could not be loaded. IndexUnavailableError: The paper index is
malformed and could not be parsed.` — one per load (two after a Try-again click). The baseline
index-missing state logs the same class of line. No `Failed to load resource` for the `null`/array/
string states (`index.json` is a 200), no `TypeError`, no `Uncaught`.

**Screenshot comparison** —
`.improve/artifacts/IMP-173/feed-null-manifest-desktop-1280.png` vs
`.improve/artifacts/baseline/baseline-feed-index-missing-desktop-1280.png`: identical panel geometry,
identical heading, identical `<pre>` build steps. The baseline lacks the "Try again" button (it
predates IMP-007) and shows the raw loader message; the new shot has the working button and IMP-017's
reader-facing malformed sentence ("could not be read … trying again will not help until the index is
rebuilt") instead of the transient one. That difference is the intended outcome of routing `null` to
`kind: "malformed"`. 17 screenshots total at 1280 and 390.

---

## 5. Non-vacuity, test integrity, and the test-count claim

Four scratch copies under `/tmp/v173` (`cur`, `prefix`, `effect`, `noac1`, `noac2`), each an rsync of
`web/` with `node_modules` symlinked and the relevant hunk hand-reverted. New tests left in place.

| Variant | Command | Result |
| --- | --- | --- |
| `prefix` (pre-fix control: no AC1, no AC2, `useEffect`) | `npx vitest run` | **`Tests 5 failed \| 232 passed (237)`** — 3/3 runs identical |
| `noac1` (AC1 guard deleted) | `npx vitest run` | `Tests 5 failed \| 232 passed (237)` |
| `noac2` (AC2 `setLoading(false)` deleted) | `npx vitest run` | `Tests 237 passed (237)` — 3/3 runs |
| `effect` (`useLayoutEffect` → `useEffect`) | `npx vitest run` | `Tests 237 passed (237)` — 3/3 runs |

Failing tests under the pre-fix control, verbatim:

```
FAIL src/lib/__tests__/paperIndex.test.ts > PaperIndex > recovers via refreshManifest after every manifest failure mode
     → AssertionError: promise resolved "null" instead of rejecting
FAIL src/lib/__tests__/paperIndex.test.ts > PaperIndex > rejects every body that is not a plain object, as malformed
     → AssertionError: null: expected null to be an instance of IndexUnavailableError
FAIL src/__tests__/App.loadFailure.test.tsx > an index file whose body is JSON null > replaces the indefinite loading line with the index-unavailable panel
     → Unable to find an element with the text: No paper index yet. (1008 ms timeout)
FAIL src/__tests__/App.loadFailure.test.tsx > an index file whose body is JSON null > shows IMP-007's panel and a Try again that re-requests index.json
     → Unable to find an element with the text: No paper index yet. (1010 ms timeout)
FAIL src/__tests__/App.loadFailure.test.tsx > an index file whose body is JSON null > keeps the reader-facing malformed sentence, not the raw loader text
     → Unable to find an element with the text: No paper index yet. (1009 ms timeout)
```

**Actual count: 5 new test names, 232 → 237.** `vitest list` diff, HEAD vs working tree:

```
$ comm -23 <(sort head-tests) <(sort cur-tests)     # in HEAD but not now
(empty — all 232 pre-existing test names survive)

$ comm -13 <(sort head-tests) <(sort cur-tests)     # new
App.loadFailure.test.tsx > an index file whose body is JSON null > replaces the indefinite loading line …
App.loadFailure.test.tsx > an index file whose body is JSON null > shows IMP-007's panel and a Try again …
App.loadFailure.test.tsx > an index file whose body is JSON null > keeps the reader-facing malformed sentence …
paperIndex.test.ts > PaperIndex > rejects every body that is not a plain object, as malformed
paperIndex.test.ts > PaperIndex > accepts any plain object as a manifest, however few fields it has
```

**No existing test was weakened, skipped, or deleted.** `git diff --numstat` over both test directories
reports `71  0  web/src/lib/__tests__/paperIndex.test.ts` — additions only, zero deletions. No
`.skip`, `.todo`, `.only` or `.each` appears in any added line. No `waitFor` timeout was loosened;
the new tests await the panel or the request count, never a sleep.

Of the 5, **4 are bug-detectors** (all four fail without the production change) and 1 is the AC4 scope
guard (`accepts any plain object …`), which passes in both states by design. Separately, the
pre-existing "recovers via refreshManifest" test was *strengthened* with 3 more table rows, so it too
now fails pre-fix — that is a 5th failing test but not a 5th new test.

---

## 6. The AC2-testability gap — the implementer's claim is TRUE

`noac2` (AC1 present, AC2's `setLoading(false)` removed) is **237/237 green, three runs out of three**,
and I could not construct a failing scenario:

- `loading` is read in exactly one place, `App.tsx:722` `{loading ? …}`, which is inside the
  `{manifest && …}` branch. On any path where AC1 holds, either `manifest` is truthy (so the papers
  effect immediately re-sets `loading` and the value is never consulted) or `error` is set (so the
  `{!manifest && !error && …}` index line at `:599` is unmounted and does not consult `loading`
  either). AC1 is the sole producer of the resolved-but-unusable state AC2 defends against, and AC1
  has eliminated every reachable instance of it.

**Verdict: AC2 is genuinely unreachable today, and removing it causes no observable failure.** The
implementer declined to manufacture a fake failure mode, which is the right call.

**But the absence of a test is a real gap, and it is a *specific* one.** The invariant AC2 protects is
not "the app never hangs" (AC1's tests pin that) — it is "no resolved-but-unusable manifest leaves
`loading` true". That invariant is exactly what a future change to AC1's guard could break, and it has
**no test at all**, in either direction. Three ways to close it, cheapest first:

1. **Leave it untested and say so where it will be read.** The comment at `App.tsx:184-188` already
   explains the reason. Extend it with the one sentence that matters to a future author: *"`loading`
   is read only at `:722`, inside the `manifest &&` branch, so this line is unobservable today; it is
   the backstop for a manifest React bails out on."* A verifier or implementer touching the guard then
   knows not to delete it. **This is the minimum acceptable outcome.**
2. **Pin the invariant where it is actually observable** — a test that a manifest React bails out on
   does not wedge the app. There is no such body left, so this has to be written against a
   deliberately-stubbed loader, which risks testing the stub.
3. **Do nothing and accept the residual risk**, on the grounds that AC1 is a hard gate with its own
   tests and any regression of it would be caught by the App-level suite.

I recommend (1). It is not worth a fragile test, but the reasoning is currently only in the
implementer's report, and that report is not where the next author of `App.tsx` will look.

---

## 7. Regression check across landed items

Nothing below is assumed; each was re-exercised.

| Item | Evidence | Result |
| --- | --- | --- |
| **IMP-003** (a rejected manifest is not memoized) | `paperIndex.test.ts:355` re-asks after a `null`/array/string rejection; live network log on the `null` state: 1 → 2 `index.json` after Try again | pass |
| **IMP-007** (Try again) | panel is `panel panel--error`, 1 `role="alert"`, 1 enabled `BUTTON`; clicking re-requests in jsdom (3 new tests) and in Chromium (all 4 manifest failure states) | pass |
| **IMP-008** (Relevance chip) | "Enter a search term to sort by relevance" hint present on the normal load at both viewports | pass |
| **IMP-009/IMP-010** (category chips) | all 5 categories + an "All" chip render; `2812 papers match` | pass |
| **IMP-015** (partial shard) | corrupt `papers-2026-W40.json` → incomplete banner, "263 papers match", 50 cards, `statusNodes: 1`; a genuinely missing `papers-2026-W39.json` → "2549 papers match" with the same banner | pass |
| **IMP-016** (load-failure panel + its own Try again) | every shard 404 → "Papers could not be loaded. … This is a loading failure, not an empty window." with a working Try again that re-requests the shards (3 → 5) and re-raises the panel; 9 `a window where no shard could be loaded` tests green in all 14 runs | pass |
| **IMP-017** (reader-facing copy) | `null` → "could not be read … trying again will not help"; missing → "could not be loaded … usually temporary"; the raw loader message appears only in `title` and the console line | pass |
| **IMP-018** (error boundary) | a plain-object manifest missing `categories` still throws in render and the boundary still replaces the tree with its `role="alert"` fallback; `errorBoundary.test.tsx` 11/11 in all 14 runs | pass |
| **regression-3** (save gate on a user-caused dispatch) | see below | pass |

**Save-and-reload, end to end.** Opened the first card's save menu on a fresh profile, created
collection "IMP-173 check" and saved paper `2610.00848` ("Geometric Similarity in VLM Low-Level Vision
Representations"). `localStorage` afterwards:

```
rpf.collections.v1 = [{"id":"8b6b587a-…","name":"IMP-173 check","createdAt":"2026-10-02T15:42:31.828Z","paperIds":["2610.00848"]}]
rpf.papers.v1     = {"2610.00848":{…}}
```

The mount-run false-positive banner ("Collections could not be saved") count was **0** — the
`unsavedChanges` gate is still doing its job. After a full `page.reload()`: the first card's save-menu
checkbox is `checked: true` with 1 collection listed, and the Collections view reads
`IMP-173 check (1) / Geometric Similarity in VLM Low-Level Vision Representations / Sep 30, 2026 / …`.
**Persistence confirmed** — screenshot `collections-persisted-after-reload-desktop-1280.png`.

**Recency change** (the path the hook change touches): 200 cards on screen, click "30 days" → loading
panel, 50 cards restored, `noPapers` painted frames **0**, no alert, no console error, result count
intact. Repeated 3× per build in the latency harness.

---

## 8. Flake check

`npm test` run **14 consecutive times** in the repo: **pass=14, fail=0**, every run reporting
`Tests  237 passed (237)`.

Pre-fix control under the same harness (`/tmp/v173/prefix`, `npx vitest run`): **5 failed | 232 passed
(237)**, identical on 3 consecutive runs. The harness detects the regression reliably.

Also 3 runs each of `noac2` (237/237) and `effect` (237/237) — see §5.

---

## 9. Findings

Nothing blocking. Two items for the record.

### 9.1 LOW — the implementer's report miscounts its own new tests

`impl-IMP-173.md:23-24` says "**6 new `it` blocks**, of which 5 are bug-detectors and 1 is a
deliberate scope guard". The actual figure from `vitest list` is **5 new `it` blocks**: 4
bug-detectors (3 in `App.loadFailure.test.tsx`, 1 in `paperIndex.test.ts`) plus the scope guard. The
"6th" is the three extra rows added to the *pre-existing* parametrized test
`recovers via refreshManifest after every manifest failure mode` (`paperIndex.test.ts:341-343`), which
adds no test name. The 232 → 237 delta and the 5 pre-fix failures are both correct; only the
bookkeeping sentence is off by one. Two other minor drifts in the same report's supporting file:
`discovered-IMP-173.md:18,32,37` cites `App.tsx:602/603` for `totalPapers.toLocaleString()` and
`categories.join(…)`, which are at `App.tsx:612` and `:613` after the AC2 hunk (pre-change line
numbers). Its `paperIndex.ts` references are correct.

### 9.2 MEDIUM (coverage, not correctness) — the `useLayoutEffect` swap is protected by nothing

The `effect` variant (`useLayoutEffect` → `useEffect`) is **237/237 green**, and jsdom has no paint,
so **no test can fail if this is reverted**. The one-frame IMP-016 regression would return silently.
The 9-line comment at `App.tsx:235-243` is the only defence, and it is good, but comments do not fail
builds. Options, in order of value:

1. Add the reason to `.improve/REPO_PROFILE.md` §8 (traps) as a one-line entry: *"the papers-load
   effect in `App.tsx` is a `useLayoutEffect` on purpose — reverting it to `useEffect` reintroduces a
   one-frame "No papers are available in this window yet." on every cold load, and no test can catch
   it."* The profile is what the next implementer is told to read.
2. If the loop wants a real guard, the only honest one is a browser-level check (Playwright sampler
   like §3.1's), which is outside this repo's current test stack. Not worth adding for this item.
3. Alternatively, adopt the `altA` guard from §3.3, which is testable in jsdom *in principle* — but
   only via a fake, and I would not trade a self-maintaining one-token change for a test that asserts
   its own stub.

This is a documentation/process recommendation. It does not block the item.

### 9.3 Noted, no action — the "0/0" flash is incidentally gone

The implementer flags (report §9) that the manifest commit used to be able to paint
`Loading papers from 0 weeks… (0/0)` before the papers effect ran. With the layout effect that commit
no longer paints. I observed the opposite of a problem in all 12 measured cold loads: the first
papers frame is always `Loading papers from 2 weeks… (0/2)`, i.e. already the real shard count. Profile
WEB-06 can be closed on the strength of this if the loop wants it; it is not this item's to close.

---

## 10. Reproduce this verification

```shell
# gates
cd web && npm run typecheck && npm test && npm run build

# test-name diff (232 -> 237, nothing removed)
git archive HEAD web | tar -x -C /tmp/head
(cd /tmp/head/web && npx vitest list | sort > /tmp/head.txt)
(cd web && npx vitest list | sort > /tmp/cur.txt)
comm -23 /tmp/head.txt /tmp/cur.txt   # empty
comm -13 /tmp/head.txt /tmp/cur.txt   # the 5 new names

# pre-fix control: copy web/ to /tmp, delete the plain-object guard from paperIndex.ts
# and setLoading(false) from App.tsx:189, leave the new tests in place
(cd /tmp/scratch && npx vitest run)   # -> 5 failed | 232 passed (237)

# flash: build the same dist with and without the hook change, serve each, and sample
# every animation frame + every mutation with an addInitScript rAF/MutationObserver
# harness (script: /tmp/v173/pw/measure.mjs, repeat.mjs)
```

Artifacts: `.improve/artifacts/IMP-173/` (17 PNGs, 1280 and 390). The spec-named
`feed-null-manifest-desktop-1280.png` is present. All preview and `http.server` processes were
stopped; `web/public/data/` is byte-identical to its pre-session state; the only thing rebuilt in the
repo is the gitignored `web/dist/`.
