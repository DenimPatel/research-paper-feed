# IMP-018 — independent verification

Verifier: independent sub-agent. Nothing in the source tree was modified by me. Repo state at
start and at end of my run is identical apart from the IMP-018 files the implementer wrote:

```
$ git status --porcelain=v1
 M .improve/FEATURES.md          <- status flip by the loop, not by the implementer's code
 M scripts/build_index.py         <- IMP-021, out of scope
 M tests/test_build_index.py      <- IMP-021, out of scope
 M web/src/main.tsx               <- IMP-018
?? .improve/reports/discovered-IMP-002.md  ... etc
?? .improve/reports/impl-IMP-018.md
?? .improve/reports/impl-IMP-021.md
?? .improve/reports/verify-IMP-021.md
?? web/src/ErrorBoundary.tsx           <- IMP-018
?? web/src/__tests__/errorBoundary.test.tsx  <- IMP-018
```

Scope reviewed: `git diff -- web/src/main.tsx`, `web/src/ErrorBoundary.tsx`,
`web/src/__tests__/errorBoundary.test.tsx`. `scripts/` and `tests/test_build_index.py` (IMP-021)
were ignored.

---

## Verdict

**PASS — 4 / 4 acceptance criteria met.** No blocking defect found. Seven non-blocking findings
are recorded in §9, three of which are inaccuracies in the spec's own claims rather than defects in
this item, and one of which (the newest-first comparator) is a pre-existing bug the spec's
verification method silently depends on.

---

## 1. Acceptance criteria

### AC1 — class component, `componentDidCatch`, mounted as immediate parent of `<App/>` inside `<StrictMode>`, fallback with `role="alert"` + reload `<button>`

**Met.**

- `web/src/ErrorBoundary.tsx:22-25` — `export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState>` (a class component; React 18.3.1 has no function equivalent, so the spec's structural requirement is right).
- `web/src/ErrorBoundary.tsx:39` — `componentDidCatch(error: Error, info: ErrorInfo): void`.
  The spec writes `info: React.ErrorInfo`. I verified these are the *same type* rather than
  assuming it: `@types/react/index.d.ts:4279` declares `interface ErrorInfo` inside
  `declare namespace React` and the module is `export = React` (`index.d.ts:47`). A scratch file
  assigning in both directions compiled clean under the repo's own `tsc`:
  ```
  $ cat > /tmp/verify-imp018/scratch/src/zz-errinfo-identity.ts   # ErrorInfo <-> React.ErrorInfo
  $ npx tsc --noEmit ; echo "tsc exit=$?"
  tsc exit=0
  ```
- `web/src/main.tsx:13-19` — `createRoot(container).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>)`. `<ErrorBoundary>` is the immediate parent of `<App />` and is inside `<StrictMode>`. The whole diff to `main.tsx` is +3/−1 (an import and the wrap).
- Fallback: `ErrorBoundary.tsx:76` `<div className="panel panel--error" role="alert" aria-label={SUMMARY}>` and `ErrorBoundary.tsx:84-90` a real `<button type="button" className="button" onClick={this.handleReload}>Reload the page</button>`, with `ErrorBoundary.tsx:58-60` calling `window.location.reload()`.

React version: `web/package.json` declares `"react": "^18.3.1"`, and the installed tree is
`react 18.3.1 / react-dom 18.3.1` (`node -e "require('./web/node_modules/react/package.json').version"`).
No adaptation was needed and none was made.

### AC2 — `console.error` output preserved, the boundary must not swallow the error

**Met.** The error is neither suppressed nor noisily duplicated. Measured in a real browser against
the **production** bundle (the stricter case, because React's own dev-build log is absent there):

Per page load, Chromium reported the raw uncaught error once, and the boundary added exactly one
identifiable line whose unique content is the React component stack:

```
[ERROR] TypeError: Cannot read properties of undefined (reading 'length')
    at .../assets/index-D_t56JJY.js:40:61394
    at Object.useMemo (...)
    ... (JS stack)
[ERROR] paper feed: a render error escaped the app, so the whole page was replaced. TypeError: Cannot read
    properties of undefined (reading 'length')
    at ... (JS stack)
    at Rc (...)          <- info.componentStack, the React component stack
    at div
    at Vp (...)
    at main
    at div
    at uh (...)
    at ch (...)
```

`ErrorBoundary.tsx:46-49` keeps a private `reported` flag so the line is emitted once per boundary
instance even when every sibling card throws; React's own reporting is untouched, so nothing is
hidden. The `title` tooltip also carries the cause (see §4).

I also confirmed the boundary does **not** swallow a throw in its **own** render, by mutating a
scratch copy so `render()` throws instead of returning the fallback:

```
PROBE selfRenderThrow: alertPresent = false | boundaryLogEmitted = false | threwSynchronously = true
                      | window error events = 2 | console.error call count = 3
```

No fallback is shown, the error propagates out of `render`, and it reaches `console.error` and
`window.onerror`. The failure is loud, which is the correct behaviour (React has no boundary above
this one). The real fallback cannot throw: it only reads `error.name` and `error.message`
(`ErrorBoundary.tsx:68`), both always strings.

### AC3 — a test under `web/src/__tests__/` renders `<ErrorBoundary><Thrower/></ErrorBoundary>` and asserts the `role="alert"` node exists

**Met.** `web/src/__tests__/errorBoundary.test.tsx:10-12` defines `Thrower`, and
`:60-70` renders `<ErrorBoundary><Thrower error={CRASH} /></ErrorBoundary>` and asserts
`screen.getByRole("alert")` plus the named heading. 11 tests in the file, all passing.

### AC4 — `npm run typecheck && npm test && npm run build`

**Met**, from `web/`, exact output:

```
$ npm run typecheck
> tsc --noEmit
                                  (no output)          exit 0

$ npm test
 Test Files  15 passed (15)
      Tests  232 passed (232)
   Duration  3.36s

$ npm run build
> tsc --noEmit && vite build
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.52 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D_t56JJY.js   171.29 kB │ gzip: 54.91 kB
✓ built in 369ms
```

Baseline (HEAD, no boundary), built the same way from a `git archive HEAD` copy:
`40 modules`, `index-*.js 170.01 kB / gzip 54.49 kB`, **CSS `index-G-YE6pVt.css` 10.93 kB with the
identical content hash before and after**. The +1 module / +1.28 kB JS is the boundary; the
stylesheet is byte-identical, which confirms the fallback reuses existing classes and no CSS was
touched. The report's stated figures (40→41 modules, 170.01→171.29 kB, identical CSS hash) match my
measurements exactly.

---

## 2. Is the boundary actually effective? (measured throw-site matrix)

I measured this rather than reasoning from the React docs, with a scratch vitest probe
(`/tmp/verify-imp018/scratch/src/__tests__/zzverify018probe.test.tsx`, since deleted) that throws
from each site inside a real `ErrorBoundary`:

| Throw site | Caught by this boundary? | Evidence |
| --- | --- | --- |
| render body | **YES** | `alertPresent = true` |
| `useMemo` callback | **YES** | `alertPresent = true` — this is `PaperCard.tsx:50`, the exact read the spec names |
| `useEffect` callback | **YES** | `PROBE useEffect: alertPresent = true threw = true` |
| event handler (`onClick`) | **NO** | `PROBE eventHandler: alertPresent after throw = false window error events = 2` |
| `setTimeout` callback | **NO** | `PROBE setTimeout: alertPresent after throw = false` |
| promise / async callback | **NO** | `PROBE asyncCallback: alertPresent after throw = false` |

So the spec's Intent sentence — "Any **render-time** throw … blanks the whole app" — is accurate as
written; every failure mode it actually names is a render-phase throw, and all three are caught
(§3). The task brief's suspicion that the spec "overstates what a boundary can do" is only half
right: it is right about event handlers, timers and async callbacks, which the spec never claims;
it is wrong to suspect the spec claims those. An inaccuracy to record is different and real — see
§9.1 and §9.2: one of the three named *data* defects does not throw at all.

### The named data defects, driven through the real app in a browser

I built the real bundle (`vite build`), served it statically, and mutated the served shard only
(the repo's `web/public/data/` was never touched — see §8):

| Defect | Result |
| --- | --- |
| `Paper` missing `abstract` on a **rendered** card | **caught** — fallback renders; console shows `TypeError: Cannot read properties of undefined (reading 'length')` at `Object.useMemo` |
| bad `authors` (a string, not an array) on a rendered card | **caught** — `TypeError: e.authors.join is not a function`; fallback renders |
| malformed `published: null` on a rendered card | **NOT a throw** — the paper is silently dropped by `paperIndex.ts:294`'s `.filter((paper) => paper.published && …)`; count went `2812 → 2811 papers match`, zero alerts, zero console errors. The boundary correctly does nothing because nothing threw. |

### The pre-fix behaviour was a genuinely blank page (proved, not assumed)

I rebuilt the same tree with the boundary removed (scratch copy of `git archive HEAD`, `main.tsx`
back to `<App />`), served the same mutated shard, and measured:

```
rootExists: true, rootChildCount: 0, rootInnerHTMLLength: 0,
bodyInnerTextLength: 0, alertCount: 0, h1Count: 0, paperCount: 0,
isBlankWhitePage: true
```

Screenshot: `.improve/artifacts/IMP-018/verify-control-before-blank-desktop-1280.png` — visually a
blank cream page. Same fixture, same port pattern, only difference is the presence of the boundary.
**The fix changes real behaviour.**

---

## 3. Honesty: is the fallback loud and actionable?

**Yes on every axis I could measure.** Rendered text below is computed from the DOM
(`document.body.innerText` / `alert.innerText`), not from source.

Visible copy, verbatim from the DOM:

```
The paper feed could not be displayed

This page hit a bug while drawing the feed, so it cannot show anything. Reloading is the quickest
way back. If it keeps happening, the site's published paper data may be malformed; the exact cause
is in the browser console.

Your saved collections are still stored in this browser.

Reload the page
```

- **What happened:** the `<h1>` says so.
- **What to do:** "Reloading is the quickest way back", and the only control on the page is that reload.
- **Loud, not silent:** it names the likely real cause (malformed published data) and says where the detail is.
- **No raw internal text in the primary copy:** I tested the rendered string against
  `/TypeError|Cannot read|undefined|at Object|\.tsx?:\d+/` → `visibleContainsTypeError: false`.
- **The technical detail is available but not as visible copy:** exactly one `[title]` in the
  alert, `ErrorBoundary.tsx:81`:
  `"TypeError: Cannot read properties of undefined (reading 'length')"`, plus the console line.
  This is the same shape IMP-017 established for the other failure surfaces in this app
  (`App.tsx:563`, `App.tsx:632`, `App.tsx:738`).
- **It is not a lie about the data:** nothing in this change validates a `Paper`; the boundary does
  not pretend to have fixed anything.

### Does the fallback collide with the app's existing `role="alert"` regions?

No, and this is structural rather than lucky. A React error boundary renders *instead of* its
children, so every pre-existing alert region (`App.tsx:532` save banner, `:557` index-missing
panel, `:630` window-failure banner, `:666` failed-shards banner, `:685` unknown-category banner,
`:707`/`:727` loading/load-failure panels) is unmounted with the rest of the tree. Measured in the
crash state: `alertCount: 1`, `otherAlertRoles: 0` (no `[role="status"]`, `[role="log"]` or
`[aria-live]` anywhere in the document). Nothing is announced twice and no region is left
half-mounted. The suite pins the general form of this at
`errorBoundary.test.tsx:184-199` (a competing `role="alert"` inside the children; exactly one
survives).

### The implementer's report: one claim I could not reproduce, and its actual cause

The report (`impl-IMP-018.md:224-237`) says the spec's literal step
(`del d['papers'][0]['abstract']`) "did not reproduce on the default view", and attributes it to a
stale cached shard, recommending a cache-bust. **I reproduced the non-reproduction, but the cache
hypothesis is wrong**, and the real cause is worth recording because it makes the spec's
verification method unreliable.

What I measured, on a fresh port that had never served the file before:

- The shard was genuinely served mutated: an in-page `fetch(..., {cache:'no-store'})` returned
  2 460 940 bytes with `papers[0].id = 2610.02210` and `papers[0]` **without** `abstract`.
- The page still rendered **50 cards, zero alerts, zero console errors**, and the mutated paper
  `2610.02210` was **not among them**.
- The same JS comparator the app uses, run in the page over the same 2 549-paper array, put
  `2610.00848` (file index **592**, `published` `2026-10-01`) first, whereas a stable
  `sorted(..., reverse=True)` over the same bytes puts file index 0 (`2610.02210`) first.

`paperIndex.ts:295` sorts with `(a, b) => (a.published < b.published ? 1 : -1)`, which returns
`-1` for *equal* keys — an inconsistent comparator. 593 of the 2 549 papers share the maximum
`published` value, so tie order is implementation-defined rather than file order, and combined
with `PAGE_SIZE = 50` a bad paper outside the first 50 is never rendered and never throws. (The
"Sep 30, 2026" date shown on a card whose `published` is `2026-10-01` is a separate, benign
timezone artifact of `formatDate` using `T00:00:00Z`; it is not evidence of stale data.)

This is a **pre-existing** defect, not something IMP-018 introduced or could fix, but it has a real
consequence: a verifier who follows the spec's verification method literally and sees no crash may
wrongly conclude the boundary is inert. I therefore drove the fixture against the paper that is
genuinely rendered, which is what the boundary then has to catch — and it does.

---

## 4. Accessibility

| Check | Result |
| --- | --- |
| `role="alert"` present and announced | `role="alert"`, no `aria-live` override (assertive is the role's default), exactly one in the document |
| Accessible name | `aria-label="The paper feed could not be displayed"` |
| **Does the `aria-label` match or contradict the visible text?** | **Matches exactly.** `alertAriaLabel === alert.innerText.split("\n")[0]`, and it is also the region's own `<h1>` (label-in-name holds). No mismatch defect. |
| Why the label is needed | `alert` is an author-named role, so without `aria-label` the name would fall back to the `title` — the technical string. This is the exact defect IMP-017 found on the pre-existing alert regions (`App.tsx:622-635`, `App.tsx:657-670`). |
| Reload control | `BUTTON`, `type="button"`, `tabIndex: 0`, no `aria-label` (name from its own text, `Reload the page` — again matching the visible text) |
| Keyboard reachability, real browser | `Tab` from a fresh document moved focus to the button (snapshot showed `button "Reload the page" [active]`); it is the only focusable element |
| Keyboard activation, real browser | `Enter` on that button performed a **real document reload**: a `window.__imp018Probe` set beforehand was `GONE (document reloaded)` afterwards, `performance.getEntriesByType('navigation').length === 1`, `document.readyState === "complete"`. Not a state reset. |
| Focus when the fallback mounts | `document.activeElement === document.body` — acceptable, and **not trapped** (`Tab` reaches the button; there is no focus trap or `autofocus`) |
| Headings | exactly one `<h1>` in the fallback |
| 1280px | `scrollWidth 1280 === clientWidth 1280`, no horizontal overflow |
| 390px | `scrollWidth 390 === clientWidth 390`, no horizontal overflow; button rect 139 × 40 px (comfortable touch target) |

### WCAG contrast (computed from the colours the browser actually resolved)

```
== LIGHT ==
  .panel p  #666661 on #ffffff   5.77:1   (AA normal text needs 4.5)   PASS
  .panel h1 #1c1c1a on #ffffff  17.07:1                                PASS
  button     #faf9f6 on #1c1c1a 16.21:1                                PASS
  --danger border #b3261e on page #faf9f6  6.21:1                       PASS (UI component)
== DARK (prefers-color-scheme: dark) ==
  .panel p  #9b9b94 on #1c1f24   5.91:1                                PASS
  .panel h1 #f1f1ee on #1c1f24  14.60:1                                PASS
  button     #14161a on #f1f1ee 16.01:1                                PASS
  --danger border #ff8a80 on page #14161a  7.93:1                       PASS
```

Button label is 13.6 px / weight 700, so the 4.5:1 threshold is the applicable one; every measured
pair clears it. Dark-mode values are computed from the `styles.css:28-45` token overrides, which is
where the fallback inherits them (it adds no styling of its own).

### Visual consistency with the existing error surfaces

`verify-feed-error-boundary-desktop-1280.png` and `…-mobile-390.png` show the same treatment as the
app's established error panel (`baseline-feed-index-missing-desktop-1280.png`): identical
`panel panel--error` (1 px `--danger` border, `--surface` fill, same padding/radius/shadow), the same
`.panel h1` size, the same muted body copy, the same dark pill `.button`. Zero new CSS, zero inline
styles — consistent with `REPO_PROFILE.md:414-417`.

The one deliberate difference: the fallback omits `site-header`, `site-footer` and the skip link
(`hasHeader: false, hasFooter: false, hasSkipLink: false`, `main#main` present). That is the right
call — the header's `Feed` / `Collections` buttons drive `App` state, and `App` is unmounted, so
keeping them would render dead navigation. The cost is that `#main` becomes an orphan anchor with no
skip link pointing at it, which is harmless (WCAG 2.4.1 bypass-block rules do not require a skip
link when the page is a single short panel).

---

## 5. The 11 new tests are non-vacuous (15 independent mutations, all killed)

The implementer claims 7 mutation probes. I did not use their harness. I made my own scratch copy
of `web/` under `/tmp/verify-imp018/scratch` (node_modules symlinked back, so the repo tree was never
in a broken state), applied each mutation to the copy with a Python script that asserts the target
string exists before replacing it, ran only `src/__tests__/errorBoundary.test.tsx`, then restored
and confirmed byte-identical (`sha256[:16] = 7d616ee7f3b1f95c` for `ErrorBoundary.tsx`,
`b0eedc3149345294` for `main.tsx`).

| # | Mutation | Suite result |
| --- | --- | --- |
| — | CONTROL (unmutated) | 11 passed, exit 0 |
| M1 | `componentDidCatch` removed entirely | RED — 2 failed (`logs the crash…`, `reports the crash once…`) |
| M2 | `role="alert"` removed | RED — 5 failed |
| M3 | reload `<button>` removed | RED — 2 failed |
| M4 | `getDerivedStateFromError` removed | RED — 7 failed |
| M5 | `aria-label` removed | RED — 1 failed |
| M6 | `window.location.reload()` → no-op | RED — 1 failed |
| M7 | `console.error` → `console.info` | RED — 2 failed |
| M8 | once-only report guard removed | RED — 1 failed |
| M9 | `title` detail attribute dropped | RED — 1 failed |
| M10 | crash detail promoted into visible copy | RED — 1 failed |
| M11 | boundary unmounted in `main.tsx` | RED — 1 failed |
| M12 | `reload()` → `setState({error:null})` (state reset, no document reload) | RED — 1 failed |
| M13 | fallback made unreachable (`render` always returns children) | RED — 9 failed |
| M14 | `<button>` `type="button"` removed | RED — 1 failed |
| M15 | `aria-label` changed to a string that **contradicts** the visible text | RED — 1 failed |

**15 / 15 mutations killed, 0 survivors.** M1 needed a second pass to be syntactically valid; with a
clean stub it fails for the right reason (`expected undefined to be defined` at
`errorBoundary.test.tsx:132`, i.e. the AC2 logging assertion), not by accident of a broken build.
Every claim the tests make fails when the code stops making it.

### No pre-existing test was weakened, skipped, or deleted

Baseline extracted read-only with `git archive HEAD | tar -x -C /tmp/verify-imp018/baseline` and
`node_modules` symlinked back:

```
baseline (HEAD):            Test Files 14 passed (14)   Tests 221 passed (221)
current:                    Test Files 15 passed (15)   Tests 232 passed (232)
```

Test-name diff via `npx vitest list | sort` on both trees:

```
$ comm -23 before-tests.txt after-tests.txt      # present before, missing after
(empty)
$ comm -13 before-tests.txt after-tests.txt | wc -l
11
```

**All 221 pre-existing test names survive, byte-for-byte identical strings; exactly 11 added, all
in `errorBoundary.test.tsx`.** A scan for `it.skip` / `describe.skip` / `test.skip` / `.only` /
`todo(` across `web/src` returns nothing.

---

## 6. Regression check (IMP-007/009/010/011/015/016/017 + regression-3)

Nothing regressed, and the boundary did not interfere with the regression-3 save gate.

- **Suite level:** all 221 pre-existing tests still pass, unmodified (§5). That includes
  `App.storage.test.tsx:227` "a cold boot with nothing saved" — the test that pins the
  user-caused-dispatch gate — and the 23 `App.loadFailure` tests, the 17 `App.categories` tests, the
  9 `App.partialShard` tests (IMP-015) and the 8 `lib/__tests__/failureCopy` tests (IMP-017).
- **Browser level, boundary mounted, clean data:** `2812 papers match`, 50 cards, **zero console
  messages of any kind** on load (the navigation reported no new console output), zero alerts.
- **The user-caused-dispatch gate, exercised for real:** I created a collection through a card's save
  menu (`input[name=name]` → form submit). Result: nav label became `Collections (3)`,
  `rpf.collections.v1` was written, and **no `.banner--error[role="alert"]` appeared** — i.e. the
  gated save effect ran on the user-caused dispatch and the write succeeded, and the boundary did not
  interfere with the dispatch or the effect.
- **Other notice surfaces still work with the boundary mounted:** search (`#q=diffusion` → `154 papers
  match`, 50 cards, 0 alerts, no fallback); the category-chip/hash round trip
  (`#cat=cs.CV%2Ccs.LG%2Ccs.CL%2Ccs.AI`); the collections view rendering all three collections with
  working `Rename` / `Export` / `Delete` controls; and the view switch
  (`#view=collections&q=diffusion&cat=…`). `role="alert"` count was 0 in every one of those states.

(Side effect I should disclose: creating that test collection wrote to the *browser profile's*
`localStorage` for `localhost:5211`, so the persistent Playwright context now holds two extra
collections named "Verifier Collection" / "Second Verifier Collection". That is browser state, not
repo state — no file in the repository was touched.)

---

## 7. Flake check

```
$ for i in $(seq 1 12); do npm test; done        # in web/
run 1..12:  Tests  232 passed (232)
=== FLAKE CHECK: 12/12 green, 0/12 with failures ===
```

**12 / 12 green, 0 failures.** The implementer's 12/12 claim reproduces.

**Pre-fix control under the same harness** (to prove the harness is not blind): I removed
`role="alert"` from the scratch copy and ran the *full* suite three times —

```
control run 1: RED   Tests  5 failed | 227 passed (232)
control run 2: RED   Tests  5 failed | 227 passed (232)
control run 3: RED   Tests  5 failed | 227 passed (232)
```

3 / 3 detected, then restored (`md5` back to `b3398b4c4376b9e568f685170e629ec8`) and 232/232 green.
So the 12 green runs are meaningful, not a harness that cannot fail.

---

## 8. Data integrity and cleanup

- `web/public/data/` is gitignored and was **never modified by me**. Its shard
  `md5 = 153a42306d26d41f55b01475ae8587e0` is identical before and after my run;
  `papers-2026-W40.json` has 2 549 papers, 0 missing `abstract`, 0 non-string `published`,
  0 non-list `authors`; `papers[0]` (`2610.02210`) has its `abstract`; `index.json` names the
  original two shard files. The implementer's restore is clean.
- All mutation happened on copies under `/tmp/verify-imp018/` only. The `after` serve tree was
  restored from the repo copy afterwards and re-verified (2 549 papers, 0 missing `abstract`).
- The three static servers (`:5211`, `:5212`, `:5213`) are **stopped**; the Playwright page is
  **closed**.
- `git status` shows only the intended files. `web/dist` and `.playwright-mcp/` are ignored
  (`web/.gitignore:5`, `.git/info/exclude:52`), and `.improve/artifacts/` is excluded
  (`.git/info/exclude:51`), so no new file landed in a tracked location — `REPO_PROFILE.md:315`
  satisfied.

---

## 9. Findings (none blocking)

**9.1 — The spec's own verification method is unreliable (spec inaccuracy, not an item defect).**
`del d['papers'][0]['abstract']` did not reproduce the crash, twice over: for me because
`paperIndex.ts:295`'s comparator is inconsistent for equal `published` values so file order ≠
render order and only the first 50 cards are mounted (§3), and — per the implementer's own account —
because of a stale browser cache on their run. Either way the step is not a dependable check. It
should be replaced with "mutate a paper that is actually among the first 50 rendered cards". The
implementer reported the symptom honestly but attributed it to a cache, which my in-page
`cache:'no-store'` fetch contradicts: the mutated bytes *were* being served.

**9.2 — "A malformed `published`" is not a boundary failure mode at all (spec inaccuracy).**
Measured: `published: null` on a rendered paper is filtered out silently by `paperIndex.ts:294`; the
feed shows `2811 papers match`, no error, no alert. Nothing throws, so the boundary is right to stay
out of it. The real defect there is *silent data loss*, which belongs to runtime validation
(IMP-098), not to a boundary. `formatDate` also degrades silently for a non-date string
(`PaperCard.tsx:20-24` returns the raw value), so a bad `published` shows as a nonsense date rather
than crashing.

**9.3 — Event-handler, timer and async throws are outside the boundary's reach (inherent, correctly
disclaimed).** Measured in §2. The implementer's report states this correctly
(`impl-IMP-018.md:238-241`); the spec never claimed otherwise. No action.

**9.4 — The report does not name the §9 inventory entry it fixes.** `REPO_PROFILE.md:316` requires
"Every line in §9 that your change touches is either fixed (say so explicitly, with the id) or
consciously left alone". The change fixes the "no error boundary → white page" half of **WEB-07**
(`REPO_PROFILE.md:685`) and leaves its other half ("Shard data validated only by cast") open, which
is IMP-098. `impl-IMP-018.md` never mentions WEB-07. A one-line addition to the report (or a tick in
the profile) would close this. Process gap, not a code defect.

**9.5 — Pre-existing, worth filing separately: the newest-first comparator is inconsistent.**
`paperIndex.ts:295` `(a, b) => (a.published < b.published ? 1 : -1)` returns `-1` for equal keys, so
"Newest" ordering within a single publication day is arbitrary rather than file order (measured:
the first rendered card is file index 592 while a stable sort of the same bytes yields index 0).
This does not affect correctness of the feed's contents, but it makes the spec's verification method
non-deterministic and it is the mechanism behind 9.1. Not IMP-018's job; recommend a new item.

**9.6 — Two collections were written to the shared browser profile's `localStorage`** during the §6
regression exercise. Browser state only; no repository file affected. Disclosed for completeness.

**9.7 — Optional, low value:** the fallback could carry a focusable heading
(`tabIndex={-1}` + a ref, the pattern `App.tsx:592` already uses for the feed hero) so a screen-reader
or keyboard user's focus lands on the message rather than on `<body>`. Not a WCAG failure — an
assertive live region is announced on mount regardless — and adding it would mean adding a `ref` and
a lifecycle method to a deliberately minimal component. I would not block on it.

---

## 10. Artifacts

Under `.improve/artifacts/IMP-018/` (excluded from git). The implementer's originals are preserved
with an `impl-` prefix; my independent captures are byte-identical to theirs, which is itself
corroborating.

| File | md5 | Note |
| --- | --- | --- |
| `verify-feed-error-boundary-desktop-1280.png` | `0524d41cf230cb62cf762f509b11ecf3` | my capture; identical to the implementer's |
| `verify-feed-error-boundary-mobile-390.png` | (36 522 B) | my capture; identical to the implementer's |
| `verify-control-before-blank-desktop-1280.png` | `80c542eab1d2791b26b872bc43a20371` | pre-fix blank page; identical to the implementer's |
| `impl-*.png` | — | the implementer's three originals, preserved |

The spec-required path `feed-error-boundary-desktop-1280.png` is present and, per the md5 above,
holds exactly the render I captured independently.
