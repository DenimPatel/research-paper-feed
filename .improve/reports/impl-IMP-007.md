# IMP-007 — Implementation report (attempt 2 of 3)

**Item:** `IMP-007` — Add a "Try again" button to the index-unavailable panel.
**Spec:** `.improve/FEATURES.md:244-258`.
**Previous verification:** `.improve/reports/verify-IMP-007.md` — **VERDICT: FAIL**, blocking Issue 1.
**Status:** all four findings addressed and independently re-verified, including a fresh real-browser
run with three activations (not reusing any earlier screenshots).

**The verifier was right and the bug was mine.** `retryingRef.current = true` at `App.tsx:133` was the
only write to that ref in the file. After one click the control was permanently dead, while the
`disabled` / `aria-busy` attributes — driven by separate *state* that did reset — kept it looking
enabled. Attempt 1's report explicitly argued that ref was "insurance, not load-bearing logic" and
untestable. That inference was wrong, and it is precisely why nobody noticed: **every existing test
clicked exactly once.**

---

## 1. Files changed (four, all in scope)

| File | This attempt |
| --- | --- |
| `web/src/App.tsx` | Deleted `retryingRef` and the `retrying` state; deleted `disabled` / `aria-busy` / the `"Retrying…"` branch; made the mount path call `getManifest()` explicitly. |
| `web/src/lib/paperIndex.ts` | **Unchanged this attempt.** `refreshManifest`, `manifestSettled`, and the memo semantics were already correct. |
| `web/src/__tests__/App.retry.test.tsx` | 5 → **7** tests. Two multi-click regression tests + `installScriptedFetch` / `clickRetryExpectingAnotherFailure` helpers. |
| `web/src/lib/__tests__/paperIndex.test.ts` | 14 → **16** tests. Added memo-freshness-after-success and all-failure-modes recovery. |

Cumulative diff vs `HEAD`:

```
 web/src/App.tsx                          | 48 ++++++++++-
 web/src/lib/__tests__/paperIndex.test.ts | 139 +++++++++++++++++++++++++++++++
 web/src/lib/paperIndex.ts                | 34 ++++++--
 3 files changed, 211 insertions(+), 10 deletions(-)
```

Not touched: `web/src/lib/collections.ts` (off limits — IMP-154 committed), `web/src/styles.css`,
`web/src/components/*`, `web/package.json`, `web/package-lock.json`, `.improve/FEATURES.md`,
`.improve/REPO_PROFILE.md`. No git write commands were run.

---

## 2. Finding 1 (BLOCKING) — the latch: deleted, not reset

The handler now has **no flag guard at all** (`App.tsx:131-139`):

```tsx
// No "already retrying" latch: clearing `error` unmounts this button in the
// same commit, so a second activation cannot reach the handler until the
// attempt has settled and the panel is on screen again. Simultaneous
// activations batch into one `manifestAttempts` change, hence one request.
const handleRetryManifest = () => {
  retriedRef.current = true;
  setError(null);
  setLoading(true);
  setManifestAttempts((attempts) => attempts + 1);
};
```

`grep -n "retryingRef\|setRetrying\|aria-busy\|Retrying\|disabled=" web/src/App.tsx` returns **nothing**.

### Why deletion rather than resetting the ref

The verifier offered both options. I chose deletion:

1. **The guard was unreachable in every real path.** `setError(null)` unmounts the button in the same
   commit, so it cannot be activated again until an attempt has settled and the panel has remounted —
   at which point a press is a *legitimate, distinct* retry, not a duplicate. Simultaneous
   activations cannot either: React 18 batches `setManifestAttempts(a => a + 1)`, so N same-tick
   clicks produce one state transition, one effect run, one request. The ref's only real effect was to
   block legitimate retries.
2. **A boolean that must be reset in every future exit path is the exact shape of bug I shipped.**
   Deleting it makes the anti-spam guarantee *structural* — unmount + batching + in-flight promise
   sharing — rather than *remembered*.
3. **It removes the visual/functional asymmetry.** With the ref gone there is no longer a visual state
   and a functional state that can disagree.

Anti-spam is not weakened: `refreshManifest()` shares an in-flight request instead of duplicating it,
and that is covered by a test that kills the mutant when the guard is removed (§4/M4).

---

## 3. Finding 2 (TEST HOLE) — closed, and proven to fail on attempt-1 behaviour

`App.retry.test.tsx:207-222` — the verifier's exact scenario:

```tsx
it("refetches on a second click after a failed retry, then recovers", async () => {
  const feed = installScriptedFetch(["fallback", "fallback", "json"]);
  const first = await renderUnavailableFeed();

  fireEvent.click(first);
  const second = await screen.findByRole("button", { name: /try again/i });
  fireEvent.click(second);

  expect(feed.indexRequests()).toBe(3);
  expect(await screen.findByText(PAPER.title)).toBeTruthy();
});
```

`App.retry.test.tsx:224-243` — four consecutive attempts, three of them failing:

```tsx
for (let attempt = 0; attempt < 3; attempt += 1) {
  await clickRetryExpectingAnotherFailure();   // click, then wait for the panel to return
}
expect(feed.indexRequests()).toBe(4);
const fourth = await screen.findByRole("button", { name: /try again/i });
fireEvent.click(fourth);
expect(feed.indexRequests()).toBe(5);
expect(await screen.findByText(PAPER.title)).toBeTruthy();
```

Both are written as **outcome** assertions (request counts), not attribute checks, so they cannot be
satisfied by a control that merely looks enabled. Each loop iteration **re-queries** the button,
because the panel remounts on every failure and clicking a detached node would be a vacuous no-op.

### Proof they fail against attempt-1 behaviour

Throwaway `/tmp/imp007-v2` copy of `web/` (repo never modified; deleted afterwards). The attempt-1
latch was reproduced exactly — a ref declared, checked at the top of the handler, set on click, never
reset:

```python
s = s.replace("  const retriedRef = useRef(false);",
              "  const retryingRef = useRef(false);\n  const retriedRef = useRef(false);", 1)
s = s.replace("  const handleRetryManifest = () => {\n    retriedRef.current = true;",
              "  const handleRetryManifest = () => {\n    if (retryingRef.current) {\n"
              "      return;\n    }\n    retryingRef.current = true;\n"
              "    retriedRef.current = true;", 1)
```

Result:

```
× index-unavailable panel retry > refetches on a second click after a failed retry, then recovers
  AssertionError: expected 2 to be 3
× index-unavailable panel retry > keeps accepting retries across three consecutive failures
  AssertionError: expected 2 to be 4
 Tests  2 failed | 5 passed (7)
```

That is the verifier's exact failure signature (`expected 2 to be 3`). Restoring the fixed
`App.tsx` in the same scratch → `Tests 7 passed (7)`.

---

## 4. Non-vacuity — 12 mutations, 11 caught, 1 disclosed

All in the `/tmp/imp007-v2` scratch. Mutants applied via python `str.replace` guarded by
`assert old in s`, because a silent no-op substitution produced one meaningless measurement on an
earlier pass and I re-ran it rather than reporting the number.

| # | Mutation | Result |
| --- | --- | --- |
| M0 | none (fix applied) | 7/7 App + 16/16 paperIndex pass |
| M1 | `App.tsx` + `paperIndex.ts` → HEAD | **7/7 App fail**; **5/5 new paperIndex fail**; 11 pre-existing paperIndex pass |
| M2 | **reintroduce the `retryingRef` latch** | **2 App fail** — `expected 2 to be 3`, `expected 2 to be 4` |
| M3 | retry clears `error` but never bumps `manifestAttempts` | **6 App fail** |
| M4 | `refreshManifest` clears the memo unconditionally (duplicates in-flight) | **1 paperIndex fail** |
| M5 | `refreshManifest` never refetches a resolved memo | **2 paperIndex fail** |
| M6 | delete the focus-handoff effect | **1 App fail** |
| M7 | remove `onClick` (inert button) | **6 App fail** |
| M8 | effect always calls `getManifest()` (drop the Issue-3 branch) | **0 fail** — disclosed, §6 |
| M9 | rejection arm no longer clears the memo | **3 paperIndex fail**, incl. the all-failure-modes test |
| M10 | `refreshManifest` refetches but leaves a **stale** memo in place | **1 paperIndex fail** — the memo-freshness test |
| M11 | restore | 7/7 + 16/16 pass |

M10 is worth calling out: it is the only mutation that distinguishes "the retry refetched" from "the
memo now serves fresh data", and only the test added in this attempt kills it.

### No existing test was weakened

- `git diff -- web/src/lib/__tests__/paperIndex.test.ts | grep '^-'` returns **no deleted lines** —
  purely additive (139 insertions, 0 deletions).
- No `.skip` / `.todo` / `.only` / `it.fails` in any in-scope file.
- **Full disclosure of the one exception:** `App.retry.test.tsx` is a file this item created, and I
  removed exactly **two** assertion lines from it — `getAttribute("aria-busy") === "false"` in the
  first test and the same check in the "restores the Try again button" test. Both asserted an
  attribute that Finding 3 removed from the source, so they would have failed for a reason unrelated
  to behaviour. In their place I **added two new** assertions,
  `expect(...textContent).toBe("Try again")`, in both tests. Net effect: two more tests and two more
  assertions; the two deletions are exactly the deleted-attribute checks. Nothing was weakened to
  make anything pass.

---

## 5. Findings 2 (dead code) and 3 (mount path)

### Finding 3 of the verifier's list — unreachable busy state: removed

`App.tsx:341-348` is now:

```tsx
<button type="button" className="button" onClick={handleRetryManifest}>
  Try again
</button>
```

`disabled`, `aria-busy`, the `retrying` state and the `"Retrying…"` branch are all gone. **I
considered making them observable and rejected it:** moving `setError(null)` out of the handler into
the effect *would* expose them, because `useEffect` runs after paint, so one frame would render the
stale error text next to a disabled "Retrying…". That is worse UX (flicker, plus a misleading error
on screen during the retry) and it conflicts with AC1's "clears `error`". `.button:disabled` remains
in `styles.css` for other callers; I never opened that file, and the built CSS asset hash is
byte-identical to HEAD (§8).

### Finding 4 of the verifier's list — `refreshManifest()` off the mount path

Assessed and changed (`App.tsx:97-106`):

```tsx
const index = indexRef.current;
if (!index) {
  return;
}
// A cold start has nothing memoized, so getManifest() is the right call. A
// repeat attempt must re-ask the network: getManifest already un-memoes a
// rejection, and refreshManifest also drops a manifest that resolved.
const attempt =
  manifestAttempts > 0 ? index.refreshManifest() : index.getManifest();
```

The `if (!index) return;` replaces the `indexRef.current?.` chain and lets TypeScript narrow `index`
for the conditional. Behaviour when `indexRef.current` is undefined is unchanged (previously the
optional chain short-circuited leaving `loading` true; the early return also leaves it true).

**Honest disclosure: this branch is provably inert and no test kills it (M8).** The panel is only
reachable after a manifest *rejection*, and a rejected memo is already un-memoed by `getManifest`, so
`refreshManifest` cannot change any observable outcome in the UI. I kept it because it makes the
cold-start path visibly a plain `getManifest()` — the direct, legible answer to the finding — and
because the capability it selects is independently covered by two killing unit tests. A reviewer who
prefers strict minimalism can collapse the ternary to `index.getManifest()` with no test change and
no behaviour change.

---

## 6. Analyses requested: three failure modes, and memo freshness

### After a successful retry, is the memo correctly updated for later callers? — **Yes**

Trace of `paperIndex.ts:68-98`:

`refreshManifest()` sees `manifestSettled === true` (set only in the fulfilment arm at `:72-75`), so it
nulls both `manifestPromise` and `manifestSettled` and calls `getManifest()`, which assigns
`this.manifestPromise = this.fetchManifest().then(...)`. On fulfilment that arm sets
`manifestSettled = true` and returns the **new** manifest — so `manifestPromise` holds fresh data and
stays memoized. `loadPapers()` (`:165`) calls `getManifest()`, gets that memo, and never re-fetches.

Test `leaves the memo holding the refreshed manifest for later callers`
(`paperIndex.test.ts:265-311`) makes the second `index.json` return a **different** manifest with a
**different** shard (`2024-W10`, paper `w10a`), then asserts `loadPapers(30)` returns `["w10a"]` and
that exactly **2** `index.json` requests occurred. That proves later callers see the refreshed
manifest, not the original, with no third request. **Mutant M10 kills only this test**, confirming it
is load-bearing.

### Network error, malformed manifest, 404 — all recoverable

`fetchManifest` (`:100-125`) funnels **every** failure through `IndexUnavailableError`:

| Failure | Caught at | Retry behaviour |
| --- | --- | --- |
| **(a) Network error** — `fetch` rejects with `TypeError` | `try/catch` → `IndexUnavailableError(INDEX_HELP, { cause })` (`:105-107`) | rejection ⇒ `:79` sets `manifestPromise = null` ⇒ next call refetches |
| **(c) 404** — `!response.ok` | `:112-116` → `IndexUnavailableError("… (HTTP 404)")` | same |
| **HTML SPA fallback** — `200` + `text/html` (what a missing index really returns in production) | same branch, `:108-116` | same |
| **(b) Malformed manifest** — `200 application/json` with bad JSON | `response.json()` inside `try` → `IndexUnavailableError("malformed…")` (`:117-124`) | same |

The malformed case matters most: a *transiently truncated* response looks like a permanent parse
failure to the user, and it heals on retry precisely because it arrives as a rejection and rejections
un-memo. Test `recovers via refreshManifest after every manifest failure mode`
(`paperIndex.test.ts:313-355`) drives all four: assert `IndexUnavailableError`, then assert
`refreshManifest()` succeeds, then assert exactly 2 requests — 8 assertions per mode. **Mutant M9**
(dropping `manifestPromise = null` from the rejection arm) fails this test plus two others, so it is
load-bearing for all four modes.

### Still out of scope: WEB-04

None of the above helps the *other* failure shape — manifest OK, shard 404. `App.tsx:390-394` still
shows a bare `banner--warning` with a raw `Error.message`, `PaperList` renders "No papers are
available in this window yet.", and there is still **no retry on that path**. Recorded in
`discovered-IMP-007.md` (D3).

---

## 7. Commands and verbatim results

All from `web/`, after all edits:

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

```
$ npm test
 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 6ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/paperIndex.test.ts (16 tests) 11ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 11ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 45ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 122ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 281ms

 Test Files  7 passed (7)
      Tests  96 passed (96)
   Duration  1.53s
```

```
$ npm run build
> tsc --noEmit && vite build
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.52 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-DqdzZy6m.js   164.47 kB │ gzip: 52.82 kB
✓ built in 349ms
BUILD_EXIT=0
```

**96 = 92 baseline + 4 new** (2 App, 2 paperIndex). IMP-154's 46 tests are in that total and are not
mine; no pre-existing test was altered. **CSS asset hash `index-G-YE6pVt.css` is identical to HEAD** —
machine-checkable proof `styles.css` was never opened.

Source-level confirmation that the bug is gone:

```
$ grep -n "retryingRef\|setRetrying\|aria-busy\|Retrying\|disabled=" src/App.tsx
  NONE FOUND
```

---

## 8. Playwright evidence — fresh run, three activations

Setup: `npm run build`, then **`mv dist/data /tmp/imp007-data`** to force the panel. Only `dist` was
touched (gitignored, `web/.gitignore:5`) — **`public/data` was never moved.** Then
`npm run preview -- --port 4321 --strictPort` (4321 chosen after `lsof` showed 4321/4322/4323/4400/4401
free; 4180 and 4199 were occupied by other agents' servers, which I left alone).

Error state reproduced via the SPA fallback (profile §8 trap 7):

```
$ curl -s -w "\nindex.json status=%{http_code} type=%{content_type}\n" .../4321/.../data/index.json
</html>
index.json status=200 type=text/html
```

### 8a. Button state and keyboard reachability — probed in the live DOM

```json
{
  "focusedIsButton": true, "tag": "BUTTON", "type": "button",
  "disabled": false, "hasAriaBusy": false, "hasAriaBusyAttr": false,
  "label": "Try again", "panelRole": "alert"
}
```

So: native `<button type="button">`, reachable by Tab, **no `aria-busy` attribute anywhere in the
markup**, **not disabled while idle**, label exactly `"Try again"` (no `"Retrying…"`), inside
`role="alert"`. Tab order enumerated in-page: `Skip to content | Feed | Collections | Try again |
arXiv` — "Try again" is 4th, and `tabIndex={-1}` on the feed `<h1>` is correctly absent from the
tab sequence.

### 8b. Three activations: two failures, then success

| Activation | Input | Network still broken? | Outcome | Panel |
| --- | --- | --- | --- | --- |
| paint | load | yes | `200 text/html` → panel | `e12…e21` |
| **#1** | **keyboard `Enter`** | yes | failed, panel returned | **remounted `e25…e34`** |
| **#2** | **mouse click** | yes | failed, panel returned | **remounted `e35…e44`** |
| **#3** | **mouse click** | **no — restored** | **feed, 2,812 papers** | replaced by feed |

Activation #2 is precisely the click attempt 1 made impossible. The changing ref ranges are the
machine-checkable proof that each click produced a genuinely new render rather than a silent no-op.

Data restored before click #3, and verified live first:

```
$ curl -s -o /dev/null -w "index.json status=%{http_code} type=%{content_type}\n" .../data/index.json
index.json status=200 type=application/json
```

Recovery snapshot — note the `[active]` focus handoff to the feed heading:

```
- generic:
  - heading "Recent arXiv papers in CS & AI" [active] [level=1]
    paragraph: 2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index generated Oct 1, 2026
  - region "Feed filters" …
  - status: 2812 papers match
```

### 8c. The decisive network log — every click fired a real request

```
GET /research-paper-feed/               200
GET /assets/index-DqdzZy6m.js           200
GET /assets/index-G-YE6pVt.css          200
GET /data/index.json                    200   <- initial paint (HTML fallback -> panel)
GET /data/index.json                    200   <- activation #1 (Enter)
GET /data/index.json                    200   <- activation #2 (click, still failing)
GET /data/index.json                    200   <- activation #3 (click, now succeeding)
GET /data/papers-2026-W40.json          200
GET /data/papers-2026-W39.json          200
(+ Google Fonts, all 200)
```

**Exactly 4 `index.json` requests = 1 paint + 3 activations**, one per press. And exactly **one**
document request, **one** JS, **one** CSS across all three retries — machine-checkable proof of "no
page reload". Compare the verifier's run, where the third click produced **no request at all**.

### 8d. Console

`playwright_browser_console_messages` returned an **empty list** after the whole three-activation
sequence. All requests 200.

### 8e. Busy state during the retry

The panel is replaced by the pre-existing `<p className="panel" role="status">Loading the paper
index…</p>` the moment the handler clears `error`. On localhost that window is shorter than one
snapshot round-trip, so I could not sample it in the browser — clicking and sampling synchronously in
one `evaluate` already showed the settled panel. That transition is instead asserted deterministically
by the jsdom test *"clears the error panel, shows the loading status, and refetches the index"*, which
gates the response and checks `getByRole("status").textContent` contains "Loading the paper index".
Because the button unmounts during the retry, there is no busy state left stranded on it — which is
precisely why `disabled`/`aria-busy` were dead code and are now removed.

### 8f. Screenshots

`.improve/artifacts/IMP-007/`, all freshly captured in this run:

- `IMP-007-panel-desktop-1280-keyboard-focus.png` — 1280×900, button keyboard-focused
- `IMP-007-panel-after-two-failed-retries-mobile-390.png` — 390×844, panel still fully usable after
  two *failed* retries
- `IMP-007-feed-recovered-after-3-clicks-desktop-1280.png` — 1280×900, recovered on the third click
- `IMP-007-feed-recovered-after-3-clicks-mobile-390.png` — 390×844, same

I removed five attempt-1 artifacts this run supersedes so the directory cannot hold two
contradictory versions of the same panel. The verifier's `verify-*.png` files were left untouched.

### 8g. Cleanup — nothing left moved, nothing left running

- Preview server on 4321 stopped; `lsof -nP -iTCP:4321 -sTCP:LISTEN` returns nothing. Browser closed.
- **`web/dist/data` restored**: `index.json`, `papers-2026-W39.json`, `papers-2026-W40.json` all
  present. **`web/public/data` untouched throughout.** `/tmp/imp007-data` and `/tmp/imp007-v2`
  deleted.
- `.playwright-mcp/` scratch directory removed (IMP-001's path-mangling finding, recurring).
- `git status --short` lists only my four in-scope paths plus reports/artifacts. No source file
  outside scope was modified. No git write command was run.

---

## 9. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Focusable `<button>` labelled "Try again" that clears `error` and re-invokes the manifest load | **met** | `App.tsx:341-348`; handler at `:131-139`. Test 1 asserts `tagName` / `type` / `textContent` / `focus()`. Live: 4th tab stop, `Enter` activates it (§8a, §8b). |
| 2. Pressing it transitions panel → loading → feed, no page reload — **on every press, not only the first** | **met** — the caveat that caused the FAIL is closed | §8b: three consecutive activations, first two failing, third recovering. §8c: 4 `index.json` for 1 paint + 3 presses; single document/JS/CSS fetch. Tests: *"refetches on a second click…"*, *"keeps accepting retries across three consecutive failures"* — both proven to fail on attempt-1 behaviour (§3). |
| 3. `cd web && npm run typecheck && npm test` passes | **met** | `TYPECHECK_EXIT=0`; 7 files / 96 passed. |

---

## 10. Uncertain / for a second opinion

1. **The M8 branch is inert and untested** (§5). Collapsing the ternary changes no behaviour and
   breaks no test; I kept it for legibility of the cold-start path.
2. **Keyboard activation is proven only in the browser**, not in jsdom — jsdom does not emulate native
   `<button>` Enter/Space, and `@testing-library/user-event` is not installed
   (`discovered-IMP-007.md` D2). Real `keyboard.press("Enter")` firing a request is stronger evidence
   than a jsdom assertion would be, but it is not in the suite.
3. **Anti-spam now leans on React 18 batching.** `setManifestAttempts(a => a + 1)` from two same-tick
   handlers collapsing to a single effect run is framework behaviour, not my code. The existing test
   *"issues a single retry when the button is clicked twice in one tick"* pins the observable outcome,
   so a regression would be caught — but the mechanism is framework-provided and I would rather say so
   than imply the code enforces it.
4. **The focus handoff to the feed `<h1>` is a judgement call** the spec does not cover. I chose the
   `<h1>` over the transient loading `<p>` because the latter disappears and would bounce focus back to
   `<body>`. Guarded by `retriedRef` so a cold load never steals focus.
5. **`installScriptedFetch` repeats its last mode** once the list is exhausted. My first draft of the
   three-failure test had an off-by-one there (one `"fallback"` too many) and failed for that reason;
   the failure was loud and the fix mechanical, but the helper's semantics are worth a glance when
   reading `App.retry.test.tsx:224-243`.
6. **`web/dist` was rebuilt** during verification. It is gitignored so the tree is clean, but any
   pre-existing `dist` was replaced by `npm run build`.
7. **Attempt-1's claim that the latch was untestable-but-harmless was the root cause**, and it is now
   recorded as such in `discovered-IMP-007.md` D6. The generalisable lesson: "no mutation kills this,
   so it must be dead code" is an inference, not a proof — the correct response to an untestable flag
   was to delete it, not to argue for it.