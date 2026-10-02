# IMP-173 — implementer report

**Item:** Stop a JSON `null` manifest from hanging the app on "Loading the paper index…" forever
**Status:** all 4 acceptance criteria implemented; one non-mandated change included and justified in §5
**Attempt:** 1 (no `.improve/reports/verify-IMP-173.md` existed at start)
**Baseline:** 232 tests across 15 files → **237 tests across 15 files**

---

## 1. Files changed

Only files under `web/` were touched. Nothing in `scripts/`, `tests/`, `web/package-lock.json`,
`.improve/FEATURES.md`, or the sibling worktree. (`git status` also lists `readme.md`, `scripts/*` and
`tests/*` as modified — those are a concurrent sibling agent's IMP-022 work, not mine.)

| File | Change |
| --- | --- |
| `web/src/lib/paperIndex.ts` | **AC1.** `fetchManifest` now parses into `unknown`, rejects a body that is not a plain object with the existing `IndexUnavailableError(message, "malformed")`, and only casts after that. The malformed message moved into a module constant `INDEX_MALFORMED` (`:92`) because it is now used on two paths; the string is byte-identical, so every existing assertion on it still matches. |
| `web/src/App.tsx` | **AC2** + **§5.** `setLoading(false)` added to the manifest `.then` branch (`:186`); the papers-load effect switched from `useEffect` to `useLayoutEffect` (`:242`) with a rationale comment. |
| `web/src/__tests__/App.loadFailure.test.tsx` | **AC3.** New `describe("an index file whose body is JSON null")` with 3 tests. |
| `web/src/lib/__tests__/paperIndex.test.ts` | AC1 unit coverage: `null` / array / string / number / boolean bodies all rejected as `malformed`; a bare `{}` is still accepted (scope guard); and the 3 non-object bodies were added to the existing "recovers via refreshManifest after every manifest failure mode" list so IMP-003's non-memoization is proven for them too. |

Net test delta: **+5** (232 → 237). 6 new `it` blocks, of which 5 are bug-detectors and 1 is a
deliberate scope guard that passes with and without the fix (see §4).

---

## 2. Root cause trace

Pre-fix, on `GET data/index.json` → `200`, `content-type: application/json`, body `null`:

1. `paperIndex.ts:183` — `return (await response.json()) as IndexManifest;` — `response.json()`
   **resolves**; `null` is valid JSON. The cast is erased at runtime, so nothing inspects it.
   `fetchManifest` resolves with `null`.
2. `App.tsx:181` `.then` → `setManifest(null)`. React bails out (`Object.is(null, null)`), so no
   re-render is scheduled at all. `manifest` is still `null`.
3. `App.tsx:235` papers effect → `if (!manifest) return;` → the papers load never starts.
4. `App.tsx:589` render → `{!manifest && !error && (<p className="panel" role="status">Loading the
   paper index…</p>)}`. The guard consults neither `loading` nor any promise, so this line is the
   steady state.
5. `.then` never called `setLoading(false)`; `.catch` did (`:198`). `.catch` never runs.

Net: the app sits on "Loading the paper index…" **forever**. No `role="alert"`, no "Try again" (the
button lives inside `{!manifest && error && …}` at `:562`), and no path back short of a manual reload.
`refreshManifest()` also cannot help: the promise *resolved*, so `manifestSettled` is `true` and the
memo is a `null` that re-resolves to `null`.

The array / string / number / boolean bodies take the identical path and are equally terminal.

---

## 3. Approach, per criterion

### AC1 — `fetchManifest` rejects a non-plain-object body

```ts
let body: unknown;
try {
  body = await response.json();
} catch (error) {
  throw new IndexUnavailableError(INDEX_MALFORMED, "malformed", { cause: error });
}
if (body === null || typeof body !== "object" || Array.isArray(body)) {
  throw new IndexUnavailableError(INDEX_MALFORMED, "malformed");
}
return body as IndexManifest;
```

Exactly the predicate the spec gives. `kind` is `"malformed"` and the message is the pre-existing one,
so `describeLoadFailure` picks `INDEX_MALFORMED` — the sentence that says retrying will not help,
which is the truthful register for a body that will not parse a second time. The JSON-parse failure
and the shape failure share the message on purpose: both mean "the file is there and is not the index".

Because the rejection now goes through `getManifest`'s existing failure branch
(`paperIndex.ts:140-143`), the memo is cleared, so **IMP-003's non-memoization and IMP-007's retry
machinery apply to this body for free** — no special-casing.

### AC2 — `setLoading(false)` on the success branch

`App.tsx:186`. Literal compliance. See §5 for why this needed one more line to stay safe.

### AC3 — the App-level test

`describe("an index file whose body is JSON null")`, 3 tests, all driven by a `fetch` stub that answers
`/index.json` with `jsonResponse(null)` (HTTP 200, `Content-Type: application/json`) and 404s
everything else:

1. **`replaces the indefinite loading line with the index-unavailable panel`** — awaits
   `findByText("No paper index yet")`, then asserts `queryByText(/Loading the paper index/)` is `null`
   both immediately and again inside a `waitFor` (so "settled", not "momentarily absent"), and that
   neither the hero nor the search box is rendered.
2. **`shows IMP-007's panel and a Try again that re-requests index.json`** — asserts the panel is
   `panel panel--error` with one `role="alert"`, one `BUTTON` labelled "Try again", not `disabled`;
   clicks it and asserts `log.indexRequests` goes 1 → 2 (IMP-003 makes the retry real), that the panel
   comes back, and that `log.shardRequests` is empty (no window was ever requested).
3. **`keeps the reader-facing malformed sentence`** — the `title` is the raw loader message while the
   visible text is `INDEX_MALFORMED`, and it does **not** say "usually temporary" (that is the absent-
   index register, and telling a reader to wait about a file that will not parse is the wrong advice).

### AC4 — scope left to IMP-098 (explicit)

**`fetchManifest` checks only that the body is a plain object. It does not look at `categories`,
`shards`, `totalPapers`, `generatedAt` or `retentionDays`.** No field-level validation was added,
attempted, or moved in from anywhere. The bare `return body as IndexManifest` cast is still there and
still trusts the fields; only the `null`/array/primitive gate sits in front of it. IMP-098 owns
`categories`, `shards` and `totalPapers`.

---

## 4. Commands, with exact results

Run from `web/`.

| Command | Result |
| --- | --- |
| `npm run typecheck` (baseline, before edits) | exit 0, no output |
| `npm test` (baseline) | **15 files, 232 passed (232)**, ~3.35 s |
| `npm run typecheck` (after all edits) | exit 0, no output |
| `npm test` (after all edits) | **15 files, 237 passed (237)**, ~3.19 s |
| `npm run build` | `tsc --noEmit && vite build` → 41 modules, `index.html` 1.00 kB, CSS **10.93 kB (gzip 2.86)** — unchanged from the profile's stable figure — JS 171.40 kB (gzip 54.91), built in 383 ms |

### Non-vacuity (scratch copy under `/tmp`, not in the repo)

`/tmp/rpf-vacuity/web` — an rsync of `web/` with `node_modules` symlinked, both source fixes hand-
reverted (the plain-object guard deleted from `paperIndex.ts`, `setLoading(false)` deleted from
`App.tsx`), new tests left in place:

```
× PaperIndex > recovers via refreshManifest after every manifest failure mode
  → promise resolved "null" instead of rejecting
× PaperIndex > rejects every body that is not a plain object, as malformed
  → null: expected null to be an instance of IndexUnavailableError
× an index file whose body is JSON null > replaces the indefinite loading line …
  → Unable to find an element with the text: No paper index yet. (1015 ms timeout)
× an index file whose body is JSON null > shows IMP-007's panel and a Try again …
  → Unable to find an element with the text: No paper index yet. (1010 ms timeout)
× an index file whose body is JSON null > keeps the reader-facing malformed sentence …
  → Unable to find an element with the text: No paper index yet. (1009 ms timeout)
Test Files  2 failed (2)
     Tests  5 failed | 48 passed (53)
```

The 6th new test, `accepts any plain object as a manifest, however few fields it has`, passes in both
states **by design**: it is the AC4 scope guard, asserting the check is not over-broad. It is not a
bug-detector and is not counted as one.

Isolation runs in the same scratch copy:

- **AC1 reverted only** → the 5 failures above (the loader is what routes `null` to the error path).
- **AC2 reverted only** → `53 passed`. **AC2 has no independently observable failure mode once AC1
  holds**, and I did not manufacture a fake one: `loading` is consumed only inside the
  `{manifest && …}` branch and by the index panel, which does not consult it, so clearing it cannot
  change any rendered outcome on its own. It is a backstop against a future regression of AC1 (any
  manifest value React bails out on). Its value is proven by §5, where it *did* change the screen.

### Flake check

`npm test` **20 consecutive runs on the final code: 20 passed, 0 failed** (every run reported
`Tests  237 passed (237)`; `pass=20 fail=0`). A further 20 runs on the intermediate code (before the
`useLayoutEffect` change in §5) were also 20/20, so 40 green runs in total across the item. No test was
weakened, skipped or retried; no `waitFor` timeout was loosened; the new tests are deterministic
(they await the panel or the request count, never a sleep).

---

## 5. One change the spec does not ask for, and why — please read

AC2 alone **regressed IMP-016**, and I caught it with an instrumented build rather than by inspection.

`setLoading(false)` in the manifest `.then` creates one commit with `manifest` truthy, `loading` false
and `papers` still `[]`. The papers effect then sets `loading` back — but as a **passive** effect, so
React commits and *paints* the intermediate state first. On that frame the `{manifest && …}` branch
falls through to `PaperList` with an empty list and renders:

> **No papers are available in this window yet.**

That is the exact false claim IMP-016's panel exists to make impossible, shown on the one path where
everything is working — on **every** normal page load.

Measured, on a real production build with the real 2,812-paper index, via an injected
`MutationObserver` + `requestAnimationFrame` sampler in a `/tmp` copy of `dist/` (never in the repo):

| Build | samples with "No papers available…" | of which painted frames (`raf`) |
| --- | --- | --- |
| AC1 + AC2, `useEffect` | 2 | **1** |
| AC1 + AC2, `useLayoutEffect` | **0** | **0** |

**Fix:** the papers-load effect is now `useLayoutEffect` (`App.tsx:242`). It runs in the same commit as
the manifest landing, so `loading` is corrected before the browser paints and the intermediate commit
never reaches the screen. AC2's `setLoading(false)` is still there, verbatim, and still fires — the
state transition simply is not observable. Net rendered behaviour on a normal load is identical to
pre-fix: 3 painted frames of "Loading papers from N weeks…" and then the feed.

I judged this in scope because the brief explicitly forbids regressing IMP-016, and because the
alternative — shipping a permanent one-frame lie on the happy path — is worse than the alternative of
one extra `useLayoutEffect`. It is flagged here because it is a deviation from a literal reading of
AC2's blast radius, and a verifier should be able to overrule it.

Side effect worth knowing: on a **recency change** the new loading line now appears before the paint
rather than one frame after it. Strictly better (no stale list shown as if it were the new window),
and IMP-015/IMP-017 behaviour is unchanged.

---

## 6. Playwright evidence

Two production builds served from `/tmp` under the SPA base path (the app is at
`/research-paper-feed/`, not `/`; `python3 -m http.server` needs the dist mounted at that prefix):

- **A — null manifest.** `/tmp/rpf-serve/research-paper-feed` = a copy of `dist/` with
  `data/index.json` overwritten with the literal `null`.
  `curl -i …/data/index.json` → `HTTP/1.0 200 OK`, `Content-type: application/json`,
  `Content-Length: 4`, body `null` — i.e. HTTP 200, JSON content type, wrong body, which is AC3's
  exact stub.
- **B — normal load.** `/tmp/rpf-serve-normal/research-paper-feed` = `dist/` plus the real
  `web/public/data/` (2,812 papers, 2 shards), used for the §5 measurement. `web/public/data/` itself
  was never modified.

**Viewport 1280×900, both.**

A, at `http://localhost:5199/research-paper-feed/`:

- Snapshot at first post-navigation observation: `alert` → `heading "No paper index yet"` → the
  malformed paragraph → `button "Try again"` → the build commands. Panel and button were already on
  screen at the first observation, well inside the 2 s the spec allows (the whole navigation + snapshot
  round trip was sub-second).
- DOM assertion:
  `{ loadingIndexPresent: false, noPaperIndexYet: true, tryAgainButtons: 1, alerts: 1,
  statuses: [], panelClass: "panel panel--error" }` — i.e. **no `role="status"` node of any kind
  remains**, exactly one alert, exactly one "Try again".
- **Try again works.** Network log before the click: one `…/data/index.json` → 200. After
  `getByRole('button', { name: 'Try again' }).click()`: a **second** `…/data/index.json` → 200, and the
  panel is back with a fresh `<h1>No paper index yet</h1>` and one alert. IMP-003's non-memoized
  rejection plus IMP-007's button both function for the JSON-`null` case; the shard files are never
  requested.
- Console: exactly one line, `paper feed: the index could not be loaded. IndexUnavailableError: The
  paper index is malform…`. That is IMP-017 working as specified — the cause is kept in the console and
  out of the reader's prose — and the baseline index-missing state logs the same thing. **No failed
  network request** (`index.json` is a 200), no `TypeError`, no `Uncaught`.
- Screenshot: **`.improve/artifacts/IMP-173/feed-null-manifest-desktop-1280.png`** — compare against
  `.improve/artifacts/baseline/baseline-feed-index-missing-desktop-1280.png`. It is the same panel and
  the same button; the only difference is the paragraph, which correctly says the index "could not be
  read … trying again will not help" (the malformed register) instead of "could not be loaded … usually
  temporary" (the absent-index register). That difference is the intended outcome of routing `null` to
  `kind: "malformed"`.

B, normal load: hero "2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO", feed renders,
`status: 2812 papers match`, all five category chips pressed, Relevance disabled with its hint
(IMP-008), `0` frames of "No papers are available…" (§5).

---

## 7. Non-vacuity of the landed items

Each re-checked, not assumed:

| Item | How it was confirmed |
| --- | --- |
| **IMP-003** (rejected manifest not memoized) | New test 2 asserts `indexRequests` 1 → 2 on click; the `paperIndex` list I extended proves `refreshManifest()` re-asks for `null`/array/string bodies; the browser network log shows a second `index.json`. |
| **IMP-007** (Try again) | Panel is `panel panel--error`, one `role="alert"`, one enabled `BUTTON`; clicking re-requests in both jsdom and Chromium. |
| **IMP-015** (partial shard) | Untouched code path; all 232 pre-existing tests pass 20/20 runs, including the partial-shard notices. |
| **IMP-016** (load-failure panel) | **This is the one at risk from AC2** — §5 documents the regression, the measurement, and the `useLayoutEffect` fix, with before/after frame counts. |
| **IMP-017** (reader-facing copy) | New test 3; the `title`/console split is asserted, and the malformed sentence is not confused with the transient one. |
| **IMP-018** (error boundary) | Untouched; `errorBoundary.test.tsx` 11/11 green in all 20 runs. |
| **regression-3** | Untouched; all pre-existing suites green. |

---

## 8. Plain objects that are still unusable — NOT fixed here, all IMP-098's

These are what the AC1 gate deliberately lets through. Found while reading, **not fixed**; also written
to `.improve/reports/discovered-IMP-173.md` for filing.

1. **`categories` missing or not an array** — `App.tsx:603` `manifest.categories.join(", ")` throws
   during **render**. The commit never happens, so even the papers effect never runs: IMP-018's
   boundary catches it and the reader gets a generic `role="alert"` fallback with **no** "Try again"
   for the index and no way to recover in place. Worst case of the set.
2. **`totalPapers` missing** — `App.tsx:602` `.toLocaleString()` throws in render, same outcome.
3. **`shards` missing or not an array** — `latestIndexDate` does `for (const shard of manifest.shards)`
   inside `loadPapers`, so it rejects with a bare `TypeError`. `describeLoadFailure` has no case for
   it and returns `UNKNOWN`: *"Something went wrong while loading papers. This is usually temporary."*
   — actively wrong advice for a manifest that can never work. The papers panel does render with a
   working Try again, so this one is recoverable, unlike 1 and 2.
4. **`shards: []` or every entry with a falsy `to`** — **already handled**: `loadPapers` short-circuits
   on `!reference` and returns an empty list, which honestly renders "No papers are available in this
   window yet." Not a defect; listed so it is not re-reported.
5. **`shards[i].file` missing** — `loadShard(undefined)` fetches `data/undefined` → 404 →
   `ShardLoadError` → that week shows up in the IMP-015 partial notice. Degraded but **reported**, which
   is the right outcome.
6. **`categories: []`** — the index has shards but claims no categories. The UI would render
   "No categories selected" with a "Select all categories" button that cannot select anything. A
   plausible lie of the same family as 1–3.
7. **`generatedAt` missing** — `formatGeneratedAt(undefined)` returns `undefined` and the hero prints
   nothing. Cosmetic; `generatedAt` is never read for logic.
8. **`totalPapers` a numeric string** — `String.prototype.toLocaleString` exists, so `"2812"` renders
   fine by accident. Worth a check while IMP-098 is in there.

IMP-098's acceptance criteria should cover at least 1, 2, 3 and 6: 1 and 2 need a **render-time**
guard (the boundary alone gives no retry), 3 needs a new `describeLoadFailure` case so a
non-`IndexUnavailableError` stop being described as "usually temporary", and 6 needs a decision about
what an index with shards but no categories is supposed to mean.

---

## 9. Cross-references the verifier should check

- `.improve/reports/regression-sweep-3.md` §2 R4 — the original finding.
- `.improve/reports/verify-IMP-018.md` §9.2 — the independent re-derivation.
- Profile **WEB-07** ("shard data validated only by cast") is *not* closed by this item — the cast
  still stands behind the plain-object gate. Only the deadlock is closed.
- Profile **WEB-06** mentions a "`0/0` flash when `latestIndexDate` is null". §5 changed which frame is
  painted there: previously the manifest commit kept `loading` true so "Loading papers from 0 weeks…
  (0/0)" could paint; now the papers effect has already set the real shard count before the paint. The
  `0/0` flash is gone as a side effect. Pre-existing row, not an item of mine — flagging in case it is
  worth closing.