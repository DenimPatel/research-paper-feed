# IMP-018 implementation report — React error boundary

Status: implemented, all four acceptance criteria met, verified in a real browser.

## Files changed

| File | Change |
| --- | --- |
| `web/src/ErrorBoundary.tsx` | **New.** The boundary: class component, `state.error`, `getDerivedStateFromError`, `componentDidCatch`, fallback with `role="alert"`, `aria-label`, heading, two prose paragraphs, and a `Reload the page` button wired to `window.location.reload()`. |
| `web/src/main.tsx` | +3 / −1. Import and wrap: `<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>`. |
| `web/src/__tests__/errorBoundary.test.tsx` | **New.** 11 tests. |

Nothing else in the tree was touched: no CSS change, no `scripts/`, no `tests/`, no
`web/package.json`, no `web/package-lock.json`. `git status` after the work shows
`web/src/main.tsx` modified plus the two new `web/src/**` files, alongside four
report files and two Python files that belong to other agents working in this
shared worktree — I did not touch those.

## React version found

`web/package.json` pins `"react": "18.3.1"` (and `react-dom` 18.3.1). That is
React 18, so the spec's structural requirement — a class component with
`componentDidCatch` — is exactly right; there is no function-component
replacement. No adaptation was needed.

One typing detail: the spec writes the signature as
`componentDidCatch(error: Error, info: React.ErrorInfo)`. The module imports the
named type instead (`import { Component, type ErrorInfo, type ReactNode } from
"react"`), which is this repo's convention and the spec's own structural
requirement ("a React error boundary class component"). I verified the two names
are the same type rather than assuming it: a scratch file assigning in both
directions compiled clean under `npm run typecheck`.

## Module location

`web/src/ErrorBoundary.tsx` — the spec's stated location. I used it verbatim
instead of moving it under `components/`: the spec pins it, the file is a
root-level app-wide wrapper rather than a view, and `main.tsx` importing
`./ErrorBoundary` reads plainly. Named export (`export class ErrorBoundary`), in
keeping with the repo's no-default-export convention.

## How the fallback meets the IMP-017 honesty convention

IMP-017 set the rule for every other failure surface: reader-facing prose, never
a raw technical string as the visible copy; the cause goes in a `title` tooltip
plus a `console.error`. This fallback uses the same three-part shape:

- **Visible copy** is prose only: an `<h1>` summary ("The paper feed could not be
  displayed"), one sentence of explanation that names the actionable next step
  (reload; if it persists, the published paper data may be malformed and the
  exact cause is in the console), and one factual reassurance ("Your saved
  collections are still stored in this browser" — true, since collections live in
  `localStorage` and a render throw cannot clear them).
- **The cause** is `error.name + ": " + error.message` on the `title` attribute
  of the explanation paragraph, plus the boundary's own `console.error` line. The
  full stack never becomes visible copy.
- **`role="alert"` is explicitly named** with `aria-label={SUMMARY}`, the exact
  defect IMP-017 found and fixed on the two pre-existing alert regions: an
  author-named role with only `title` present would take its accessible name from
  the technical string. The summary is also the region's own `<h1>`, so
  label-in-name holds. A test asserts this via
  `getByRole("alert", { name: SUMMARY })`, i.e. a real accessible-name assertion
  through RTL.

The Notes' warning — a boundary that silently hides a schema violation would be
worse than the bug — is honoured on three fronts:

1. It is not quiet: the reader is told what happened, told what to do, and told
   where the detail is.
2. It logs: `componentDidCatch` writes one `console.error` line carrying the
   stack and the React component stack.
3. It does not *hide* anything from a developer — and it does not pretend to fix
   anything. The copy points at the malformed data explicitly, and nothing in this
   change validates a `Paper`; that is IMP-098's job, still open.

### One deliberate deviation, and why

React re-renders the failed subtree, so when every card throws (the real fixture:
`abstract` missing on 2549 papers) `componentDidCatch` is reached **once per
failing sibling**. My first browser run produced ~50 copies of the boundary's own
log line. The boundary now keeps a private `reported` flag and logs only the first
catch per instance; React's own development log still reports every occurrence, so
nothing is suppressed, and in a production bundle the single line is the only one
that carries the component stack at all. A test pins this
(`reports the crash once even when every sibling throws`), and removing the guard
makes that test fail.

### `console.error` and React's own logging (AC2)

I did not assume here, I measured it:

- **Development build:** React logs `The above error occurred in the <PaperCard>
  component:` once per failing component, *plus* the raw `TypeError`. The
  boundary adds exactly one prefixed line.
- **Production bundle** (built with `vite build --outDir /tmp/imp018-dist`,
  served with `vite preview`): React's own line is **absent** — that log is a
  development-build behaviour. The console carries the browser's raw uncaught
  `TypeError` lines and the boundary's single line. I corrected an earlier draft
  of the code comment that had claimed production logs nothing at all; the
  browser still reports the uncaught errors.

So the boundary neither suppresses the error (AC2) nor double-logs noisily: it
adds one identifiable line whose unique contribution is the component stack.

## Recovery: reload, not a boundary reset

The spec asks for `window.location.reload()` and I implemented exactly that. A
`state.error = null` reset would be wrong here and is worth saying why: the cause
is the data the app was handed, which is still in memory and still in the HTTP
cache, so a reset would re-throw the identical error and the reader would be
stuck on a page that flickers between the feed and the fallback. A fresh document
also discards any bad `localStorage` snapshot, which is why the fallback does not
*also* offer a reset. Only one control is offered, consistent with the single-control
rule IMP-017's report recorded.

Keyboard reachability is by construction (a native `<button type="button">`, so it
is in the tab order with an accessible name from its text) and was verified in a
real browser rather than asserted only in jsdom — see below.

## Commands and results

Run from `web/` (Chromium available; `npm run dev -- --port 5199 --strictPort`
health-checked before browser work).

| Command | Result |
| --- | --- |
| `npm run typecheck` (baseline, before changes) | clean, exit 0 |
| `npm test` (baseline, before changes) | **221 passed / 14 files**, as the profile states |
| `npm run typecheck` (after changes) | clean, exit 0 |
| `npm test` (after changes) | **232 passed / 15 files**, 0 failed (221 + my 11) |
| `npm run build` (after changes) | succeeded. `index.html` 1.00 kB, `index-G-YE6pVt.css` 10.93 kB / gzip 2.86 kB, `index-D_t56JJY.js` 171.29 kB / gzip 54.91 kB |

Baseline bundle, measured by building the same tree with the boundary unmounted in
a scratch copy: 40 modules, `index-*.js` 170.01 kB / gzip 54.49 kB, CSS 10.93 kB.
After: 41 modules, 171.23–171.29 kB / gzip 54.89–54.91 kB. **Delta +1.22 kB JS
(+0.40 kB gzip), +1 module, CSS byte-identical** (same content hash
`G-YE6pVt` before and after — the fallback reuses the existing `.panel`,
`.panel--error` and `.button` classes, so no stylesheet edit was needed).

### Flake check — 12 consecutive `npm test` runs

```
run 1..12:  Tests  232 passed (232)
=== FLAKE CHECK: 12/12 runs fully green, 0/12 with failures
```

**12/12 green, 0 failures.** (Three items in this batch were rejected for
1-in-12 flakes; this one is not one of them.)

### Non-vacuity — 7 mutations in a scratch copy under `/tmp`

`/tmp/imp018-scratch` was a full copy of `web/` (minus `node_modules`, symlinked
back) so the repo tree was never in a broken state while probing. Each mutation
was applied to the copy, `src/__tests__/errorBoundary.test.tsx` re-run, then the
file restored and re-verified byte-identical.

| # | Mutation | Result |
| --- | --- | --- |
| A | `main.tsx` back to the original, boundary unmounted | wiring test **fails** (`1 failed, 10 passed`) |
| B | fallback renders `null` instead of the alert | **8 fail** |
| C | `aria-label` removed from the alert | accessible-name test **fails** |
| D | `window.location.reload()` replaced with a no-op | reload test **fails** |
| E | `console.error` downgraded to `console.info` | logging test **fails** |
| F | crash detail promoted to visible copy | honesty test **fails** |
| G | once-only report guard removed | log-once test **fails** |

Every claim the tests make fails when the code stops making it.

## Playwright evidence

Fixture: `abstract` removed from the papers of the newest shard in
`web/public/data/` (gitignored local data), restored afterwards with `cmp`
(`RESTORED byte-identical`; `papers-2026-W40.json` back to 2549 papers with
`abstract` on `papers[0]`, `index.json` naming the original two shard files).

1. **Before (control), no boundary:** `/tmp/imp018-scratch` with the original
   `main.tsx` served on `:5201`. `#root` **0 children**,
   `document.body.innerText.trim().length` **0**, `role="alert"` count **0** — a
   blank white page, with the uncaught
   `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` in the
   console. Screenshot:
   `.improve/artifacts/IMP-018/control-before-blank-page-desktop-1280.png`
2. **After, dev server `:5199`:** the same class of failure now renders
   `#root` 1 child, exactly **one** `[role="alert"]`, accessible name
   `"The paper feed could not be displayed"`, `h1` with the same text, visible
   copy containing no `TypeError`/stack fragment, `title="TypeError: Cannot read
   properties of undefined (reading 'length')"` on the explanation paragraph, and
   `button.tabIndex === 0` labelled `"Reload the page"`. Screenshots:
   `.improve/artifacts/IMP-018/feed-error-boundary-desktop-1280.png` and
   `…-mobile-390.png` (390×844, text wraps without overflow).
3. **Keyboard recovery, real browser:** set `window.__imp018Probe`, pressed
   **Tab** (snapshot showed the button `[active]`), pressed **Enter**. Afterwards
   `window.__imp018Probe` was `null` and the console showed a fresh document load
   (`[vite] connecting…`) — proof of a real `location.reload()`, not a state reset.
4. **Production bundle:** `vite build --outDir /tmp/imp018-dist` + `vite preview
   --port 5202`, mutated fixture copied into the built `data/`. The fallback
   renders identically, and the console shows the boundary's line exactly once
   with no React "The above error occurred in…" line — the production behaviour
   described above.
5. **Healthy path unaffected:** with the fixture restored, `:5199` renders
   "2812 papers match" and 50 cards, and the console carries only the Vite connect
   messages and React's DevTools notice — no errors, no warnings. The boundary
   renders `this.props.children` untouched when nothing throws (also a test).

### The `role="alert"` conflict question

Answered by measurement, not argument: a React error boundary renders *instead
of* its children, so every pre-existing alert/status region in `App.tsx`
(`App.tsx:519`, `:552`, `:705`, `:735`, `:738`) is unmounted with the rest of the
tree. In the crash state the document contained **exactly one** alert — the
boundary's. There is no double announcement and no region left half-mounted. A
test pins the general form of this ("leaves exactly one alert behind, so nothing
is announced twice") by putting a competing `role="alert"` inside the boundary's
children.

Announcement mechanics: the fallback is mounted *with* its content inside a
freshly inserted `role="alert"` (an assertive live region), which is the pattern
the app's own failure panels already use. I verified the accessible name and role
programmatically; I did **not** verify with a real screen reader (no AT available
in this environment), so the actual spoken output is reasoned, not measured.

## Uncertainty, and one honest caveat

- **The single-paper fixture did not reproduce on the default view.** The spec's
  literal verification step is `del d['papers'][0]['abstract']`. On the default
  (no-query) feed that did *not* blank the page during my run: the mutated paper
  was not among the 50 rendered cards. Typing any query then blanked it, via a
  different unguarded read (`search.ts:57`). I widened the fixture to every paper
  in the shard so the crash is unambiguous in both the dev and production runs.
  Likely cause: the long-lived Chromium context served a **stale cached shard** for
  the dev origin — the restored fixture still rendered a paper whose displayed date
  (`Sep 30, 2026`) disagreed with that paper's `published` in the file
  (`2026-10-01`), which no ordering rule in the code can produce. **A verifier who
  sees stale data should cache-bust** (e.g. point `index.json`'s `shards[0].file`
  at `papers-2026-W40.json?v=2`) rather than conclude the fixture did not apply.
  I could not chase this further without a clean browser profile; it is recorded in
  `discovered-IMP-018.md`.
- The boundary cannot catch errors thrown in event handlers, effects, or async
  callbacks. That is inherent to `componentDidCatch` and out of the item's scope;
  the log line at least means those show up in a reader's console with the same
  prefix if they occur inside a render pass.
- No CSS was added, so the fallback inherits the existing error-panel styling.
  There is no separate "crash" visual state to tune, and I did not add one.

## Reproducing this verification

```
cd web && npm run dev -- --port 5199 --strictPort
# mutate web/public/data/papers-2026-W40.json (drop "abstract" from papers)
# open http://localhost:5199/research-paper-feed/
# restore the data file afterwards
```

Artifacts (all under `.git/info/exclude`, so `git status` stays clean):
`.improve/artifacts/IMP-018/feed-error-boundary-desktop-1280.png`,
`…-mobile-390.png`, `…/control-before-blank-page-desktop-1280.png`.