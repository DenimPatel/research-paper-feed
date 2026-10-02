# IMP-007 — Independent verification report

**Item:** `IMP-007` — Add a "Try again" button to the index-unavailable panel.
**Spec:** `.improve/FEATURES.md:244-258`.
**Implementer's report:** `.improve/reports/impl-IMP-007.md`.
**Verifier:** independent, read-only. Repo source untouched; the only files written are this
report and `.improve/artifacts/IMP-007/verify-*.png`.
**Scope reviewed:** `git diff -- web/src/App.tsx web/src/lib/paperIndex.ts
web/src/lib/__tests__/paperIndex.test.ts` plus the new `web/src/__tests__/App.retry.test.tsx`.
`collections.ts` / `collections.test.ts` / `malformedImport.test.tsx` (concurrent IMP-154) ignored.

## VERDICT: **FAIL**

**3/3 written acceptance criteria are met.** All three gates pass, all eight new tests are
non-vacuous, the control is a properly accessible `<button>`, and the *first* activation works
end-to-end in a real browser.

**But the change ships a blocking defect that defeats the item's stated intent:** the retry
control is **single-use**. `retryingRef` is a latch with no reset path, so after the first
activation the "Try again" button is permanently dead for the rest of the page's life — even
after the index becomes available. Reproduced in a real browser with the index confirmed
serving `200 application/json` and **zero** network requests on the second click.

This is precisely the half-finished-work signature the brief predicted: an over-broad guard
introduced for same-tick anti-spam that was never given its reset.

---

## Issue 1 (BLOCKING) — `retryingRef` is a permanent latch; the retry button works exactly once

**Location:** `web/src/App.tsx:94` (declaration), `web/src/App.tsx:129-139` (handler).

```ts
 94:  const retryingRef = useRef(false);
...
129:  const handleRetryManifest = () => {
130:    if (retryingRef.current) {
131:      return;
132:    }
133:    retryingRef.current = true;      // <-- only write in the file; never reset
134:    retriedRef.current = true;
135:    setError(null);
136:    setLoading(true);
137:    setRetrying(true);
138:    setManifestAttempts((attempts) => attempts + 1);
139:  };
```

Exhaustive grep of every occurrence in the file:

```
$ grep -n "retryingRef\|retriedRef\|setRetrying\|manifestAttempts" web/src/App.tsx
 92:  const [manifestAttempts, setManifestAttempts] = useState(0);
 93:  const [retrying, setRetrying] = useState(false);
 94:  const retryingRef = useRef(false);
 95:  const retriedRef = useRef(false);
103:      ?.refreshManifest()
107:          setRetrying(false);
114:          setRetrying(false);
120:  }, [manifestAttempts]);
123:    if (manifest && retriedRef.current) {
124:      retriedRef.current = false;
130:    if (retryingRef.current) {
133:    retryingRef.current = true;
134:    retriedRef.current = true;
137:    setRetrying(true);
```

`retryingRef.current = false` **does not exist anywhere in the file.** `setRetrying(false)` at
`:107` and `:114` resets the *state* (which drives `disabled`/`aria-busy`), not the *ref* (which
drives the early return). The comment at `:100-101` explains the memo semantics but says nothing
about the latch's lifetime, and nothing else in the diff hints at a reset.

The intent (per `impl-IMP-007.md` §2c and D6) was a **same-tick** double-click guard. The
implementation blocks *every* click after the first, forever.

### Reproduction A — unit level (`/tmp` scratch, repo untouched)

A probe test rendering `<App />` with `fetch` always answering `index.json` with the SPA HTML
fallback, clicking "Try again" four times:

```
FAIL  src/__tests__/probeSecondClick.test.tsx > issues a fresh index.json request on every click, including the second
AssertionError: expected 2 to be 3 // Object.is equality

FAIL  src/__tests__/probeSecondClick.test.tsx > PROBE-latch: reports how many requests each click produced
AssertionError: expected 2 to be 5 // Object.is equality

 Test Files  1 failed (1)
      Tests  2 failed (2)
```

`indexRequests()` stays at **2** (initial paint + click 1) after clicks 2, 3 and 4. Every
subsequent click is a **silent no-op**: no `fetch`, no state change, no error.

### Reproduction B — real browser, production preview

`web/` → `npm run build` → `dist/data` temporarily moved aside (`web/dist` is gitignored per
`web/.gitignore:5`, so the tree stays clean) → `npm run preview -- --port 4199 --strictPort`.

Missing index reproduces the transient-failure shape via the SPA fallback:

```
$ curl -s -w "\nstatus=%{http_code} type=%{content_type}\n" .../4199/research-paper-feed/data/index.json
</html>
status=200 type=text/html
```

Page load → panel → Tab×4 reaches `button "Try again"` → **Enter** (keyboard activation works):

```
GET /research-paper-feed/                    200
GET /assets/index-Y0hD1buQ.js                200
GET /assets/index-G-YE6pVt.css               200
GET /data/index.json                         200    <- first paint (HTML fallback -> panel)
GET /data/index.json                         200    <- the retry
```

Click again (network still broken): **network log unchanged — still exactly two `index.json`
requests.** Then restore the data and click a third time:

```
$ curl -s -o /dev/null -w "status=%{http_code} type=%{content_type}\n" .../4199/research-paper-feed/data/index.json
status=200 type=application/json        <-- index IS available

GET /data/index.json  200    <- click 1
GET /data/index.json  200    <- click 2   (network still broken at the time)
<click 3: NO REQUEST AT ALL>
```

The panel stays on screen with a fully enabled, focusable, correctly-labelled "Try again" button
and the feed never renders — **with the index sitting on disk being served correctly.** Screenshot
of exactly that state, at both widths:

- `.improve/artifacts/IMP-007/verify-DEAD-BUTTON-index-available-desktop-1280.png`
- `.improve/artifacts/IMP-007/verify-DEAD-BUTTON-index-available-mobile-390.png`

### Why this is worse than no button

The item's intent (`.improve/FEATURES.md:249`) is that "a transient network blip on first paint
leaves the visitor staring at a dead end until they reload the tab by hand". A **flaky** network
is the target case: the natural user behaviour is press, wait, press again. After this change
the second press does nothing and gives no feedback whatsoever — no request, no state change, no
disabled styling, no message. The visitor concludes the button is broken and is *more* likely to
reload than before, so the fix buys nothing in its main scenario. It also fails the brief's own
explicit instruction to "trace the error path" for a stuck control: the *visual* disabled state
clears correctly, but the functional one does not, which is strictly worse because it is
invisible.

### Fix

Reset the ref when the attempt settles — in both arms of the manifest effect, alongside the
existing `setRetrying(false)`:

```ts
// App.tsx:104-116
.then((next) => {
  if (!cancelled) { setManifest(next); setRetrying(false); retryingRef.current = false; }
})
.catch((cause: unknown) => {
  if (!cancelled) { setError(...); setLoading(false); setRetrying(false); retryingRef.current = false; }
})
```

or delete `retryingRef` entirely. The anti-spam guarantee does not need it: `disabled={retrying}`
(`:346`) already blocks the control once `retrying` is true, and `PaperIndex.refreshManifest()`
(`paperIndex.ts:92-98`) already shares an in-flight request instead of duplicating it — so a
rapid second activation cannot stampede the network even without the ref. `impl-IMP-007.md`
§2b/D6 already concedes no test kills this mutant.

### Required new test (the hole this fell through)

`App.retry.test.tsx:165-183` ("restores an enabled Try again button when the retry fails too")
asserts only that the re-rendered button has `disabled === false` and `aria-busy === "false"`.
It **never clicks the button a second time**, which is why the suite is green on a control that
is already dead. It needs to assert the observable behaviour, not the attribute:

```ts
fireEvent.click(button);                      // 1st: index still broken
const again = await screen.findByRole("button", { name: /try again/i });
fireEvent.click(again);                       // 2nd: MUST re-fetch
expect(indexRequests()).toBe(3);               // currently 2
```

---

## Issue 2 (LOW, disclosed by the implementer) — `"Retrying…"` label and `aria-busy` are unreachable dead code

`App.tsx:346-349`:

```tsx
disabled={retrying}
aria-busy={retrying}
>
  {retrying ? "Retrying…" : "Try again"}
```

`handleRetryManifest` calls `setError(null)` at `:135`, and the panel is gated on
`{!manifest && error && ...}` at `:337`. The button therefore unmounts in the same commit that
sets `retrying = true`, so `{retrying ? "Retrying…" : "Try again"}` can **never** render and
`aria-busy="true"` is never observable. The implementer discloses this (`impl-IMP-007.md` §2c and
§7.3) and argues the `role="status"` loading panel is the real busy affordance — reasonable, but
it is still a branch and two attributes that exist only to be false. Either drop them, or keep
them only if Issue 1's fix ever makes the button survive the click (it will not, because clearing
`error` is what AC1 requires). Not blocking.

## Issue 3 (LOW, disclosed) — `refreshManifest()` sits on the mount path

`App.tsx:103` calls `refreshManifest()` on **every** run of the effect, including initial mount,
rather than only when `manifestAttempts > 0`. Behaviourally identical on mount
(`manifestPromise === null`, `manifestSettled === false` ⇒ straight through to `getManifest()`),
so it is harmless, but a method whose job is "force a re-fetch" being on the cold-start path is
slightly misleading. Disclosed at `impl-IMP-007.md` §7.1. Not blocking.

---

## Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Focusable `<button>` labelled "Try again" that clears `error` and re-invokes the manifest load effect | **MET** | `App.tsx:341-351`; real `<button type="button">`, accessible name `"Try again"`, inside `role="alert"`; keyboard-reachable at **Tab 4** from a blurred body; Enter activates it; handler clears `error` (`:135`) and bumps `manifestAttempts` (`:138`), the effect's only dep (`:120`). |
| 2. Pressing it with the index present on disk transitions panel → loading → feed, no page reload | **MET (literal)** | Ran the spec's own verification method exactly: data moved aside, load, Tab to button, **restore** data, click **once**. Feed rendered 2,812 papers, focus handed to the `<h1>` (`[active]`), network log shows **no** second request for the document, JS or CSS. **Caveat:** only true on the *first* activation — see Issue 1. |
| 3. `cd web && npm run typecheck && npm test` passes | **MET** | `TYPECHECK_EXIT=0`; `Test Files 7 passed (7)` / `Tests 92 passed (92)`. |

## Gates — exact output

```
$ cd web && npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0

$ cd web && npm test
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web

 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 6ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 7ms      <- concurrent IMP-154
 ✓ src/lib/__tests__/search.test.ts (12 tests) 5ms
 ✓ src/lib/__tests__/paperIndex.test.ts (14 tests) 10ms       <- 11 baseline + 3 new
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 52ms      <- concurrent IMP-154
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 118ms
 ✓ src/__tests__/App.retry.test.tsx (5 tests) 216ms            <- new file, 5 new

 Test Files  7 passed (7)
      Tests  92 passed (92)
   Duration  1.55s

$ cd web && npm run build
> tsc --noEmit && vite build
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-Y0hD1buQ.js   164.59 kB │ gzip: 52.83 kB
✓ built in 384ms
BUILD_EXIT=0
```

92 tests / 7 files as the brief anticipated. **15 of those 92 are the concurrent IMP-154 agent's**
(`collections.test.ts` 25→35, plus 5 in `malformedImport.test.tsx`) and are **not** attributed to
IMP-007. IMP-007's own contribution is **+8**: `paperIndex.test.ts` 11→14 and 5 in the new
`App.retry.test.tsx` (69 baseline + 8 = 77 attributable, matching the implementer's §4b).

CSS asset hash `index-G-YE6pVt.css` is unchanged from HEAD, confirming `styles.css` was not
touched.

## Non-vacuity — independently confirmed, all 8 new tests are load-bearing

Performed in a throwaway `/tmp/rpf-v7` copy of `web/` (since deleted). Repo never modified.

**Run A — the 5 `App.retry.test.tsx` tests against HEAD's `App.tsx` + HEAD's `paperIndex.ts`:**

```
× renders a focusable native button labelled Try again inside the error panel
  → Unable to find an accessible element with the role "button" and name `/try again/i`
× clears the error panel, shows the loading status, and refetches the index
  → Unable to find an accessible element with the role "button" and name `/try again/i`
× recovers into the feed on retry without a reload and moves focus to it
  → Unable to find an accessible element with the role "button" and name `/try again/i`
× issues a single retry when the button is clicked twice in one tick
  → Unable to find an accessible element with the role "button" and name `/try again/i`
× restores an enabled Try again button when the retry fails too
  → Unable to find role="button" and name `/try again/i`

 Test Files  1 failed (1)
      Tests  5 failed (5)
```

**Run B — the 3 new `paperIndex` tests against HEAD's `paperIndex.ts`:**

```
× refetches the manifest on refresh, even after it resolved      → index.refreshManifest is not a function
× shares an in-flight manifest request with a retry instead of duplicating it → index.refreshManifest is not a function
× refetches the manifest on refresh after a rejection             → index.refreshManifest is not a function

 Test Files  1 failed (1)
      Tests  3 failed | 11 passed (14)
```

All 8 fail without the fix. **No pre-existing test was weakened or removed**:
`git diff --stat` for `paperIndex.test.ts` is `48 insertions(+)`, zero deletions, and a grep for
`.skip` / `.todo` / `.only` / `it.fails` across all four in-scope files returns nothing. `App.tsx`
and `paperIndex.ts` contain no `console.log`, no `TODO`, and no comment claiming behaviour the code
does not have — the one comment that *is* misleading is not a comment but the latch itself (Issue 1).

## Network semantics review

| Question | Finding |
| --- | --- |
| After IMP-003 a **rejected** promise is cleared, so retry works. What about a **resolved** memo? | Handled. `manifestSettled` (`paperIndex.ts:64`) is set `true` only in the fulfilment arm (`:73`), and `refreshManifest()` (`:92-98`) nulls the memo only when `manifestSettled === true`. A resolved memo therefore really re-fetches. Verified live: click produced a second `GET /data/index.json`. |
| Is `manifestSettled` reachable in the failing UI path anyway? | No. The panel is gated on `!manifest && error` (`:337`); `error` is set only by the manifest effect's `.catch` (`:112`) and the papers effect's `.catch` (`:162`), and the papers effect early-returns unless `manifest` is non-null (`:142`). So when the panel is visible the manifest fetch rejected. The resolved-memo path is defensive, not load-bearing — the implementer's §2a analysis is correct. |
| In-flight request: shared or duplicated? | **Shared**, correctly. `refreshManifest` only drops a *settled* memo; while in flight it returns the promise `getManifest()` would have returned. Covered by `paperIndex.test.ts` *"shares an in-flight manifest request with a retry instead of duplicating it"*, which fails if the guard is removed. |
| Click during an in-flight request — stampede? | Cannot occur: `setError(null)` (`:135`) unmounts the button immediately, and `refreshManifest` would share the request anyway. The attempted same-tick guard is what breaks it instead (Issue 1). |
| Rapid clicking spamming the network? | No stampede — but only because the latch blocks *all* clicks. Over-corrected. |
| Is the busy/disabled state wired to real state? | Yes — `disabled={retrying}` and `aria-busy={retrying}` both track the `retrying` state, which `setRetrying(false)` clears in both settle arms (`:107`, `:114`). The **state** cannot get stuck. The **ref** can, and does. |
| Memo reset after a successful retry? | Correct. On success `manifestSettled === true`, `manifestPromise` holds the fresh result, and `loadPapers` (`:165`) consumes that memo — confirmed live: exactly 2 `index.json` requests for the successful path, then the two shard requests, no third manifest fetch. |
| Does the busy state clear if the retry fails again? | **Visually** yes (`setRetrying(false)` at `:114`, button returns to enabled with `aria-busy="false"`). **Functionally** no — the click is swallowed by the latch. The button returns to an *enabled but dead* state, which is worse than a stuck-disabled one. **FAIL.** |

## Accessibility review

Verified by real key presses in a production preview build, not just by reading markup.

- **Real `<button>`** — `<button type="button">` at `App.tsx:342-350`; confirmed
  `tagName === "BUTTON"` and `type === "button"` in the accessibility snapshot.
- **Keyboard reachable and activatable** — from a blurred body: Tab 1 → `link "Skip to content"`,
  Tab 2 → `button "Feed"`, Tab 3 → `button "Collections"`,
  **Tab 4 → `button "Try again"` `[active]`**. Real `keyboard.press("Enter")` fired the retry and
  the network log confirmed a second `GET /data/index.json`. No `tabIndex` gymnastics needed on the
  control itself.
- **Accessible name** — `"Try again"`, exposed via the accessibility tree and matched by
  `getByRole('button', { name: 'Try again' })`.
- **Busy state** — `disabled={retrying}` + `aria-busy={retrying}` are truthful in markup, but as
  Issue 2 notes, `aria-busy="true"` is unobservable because the control unmounts in the same
  commit. The visible busy affordance is the pre-existing `<p className="panel" role="status">`
  loading state, which is the file's existing convention.
- **Focus handling** — the button unmounts on activation, so `App.tsx:122-127` hands focus to the
  feed `<h1>` (`tabIndex={-1}`, `:371`) only when `retriedRef.current` is set, so initial page load
  never steals focus. Confirmed live: after a successful single-click retry the feed heading carries
  `[active]`. The handoff is correct and does not trap focus; the `<h1>` is not in the tab order.
- **Roles** — `role="alert"` on the panel and `role="status"` on the loading paragraph are
  pre-existing and unchanged; the new button is inside the alert, so it is announced as part of
  the error. No `role` was added or removed. Sound.
- **Console** — `playwright_browser_console_messages` returned an **empty list** on the error panel,
  on the failed retry, and on the recovered feed. Every network request was 200/304. Matches the
  profile's clean-console expectation.

## Visual review — does the button look bolted on?

**No. It fits.** The button reuses the existing `.button` class (`styles.css:424-449`), which
supplies `appearance: none`, the pill radius, the `:focus-visible` ring (`:86-90`) and
`.button:disabled { opacity: 0.5; cursor: not-allowed }`. The built CSS asset hash is
**byte-identical** to HEAD (`index-G-YE6pVt.css`, 10.93 kB), which is machine-checkable proof that
`styles.css` was not opened.

At 1280px and 390px the dark pill reads as part of the panel's visual language, not as an
addition — correct contrast against the red-bordered error surface, correct weight next to the
`Build the index locally:` line, and it sits above the two `<pre>` blocks rather than competing
with them.

Pixel diffs (`/usr/local/bin/python3.11` + Pillow, 1280×900):

```
BASELINE (baseline-feed-index-missing-desktop-1280) vs IMP-007 panel
   168215/1152000 px (14.602%), max delta 229, bbox (140, 32, 1140, 869)
HEAD control panel vs IMP-007 panel
   158450/1152000 px (13.754%), max delta 229, bbox (140, 130, 1140, 523)
```

The HEAD-control comparison is the informative one: its bbox starts at **y=130**, i.e. *nothing
above y=130 differs at all* — the site header, the panel's red border, its background, the `<h1>`
and the error paragraph are pixel-identical to pre-change. The 13.754% band is the new button row
plus the ~44 px downward shift of the two `<pre>` blocks beneath it. Max delta 229 is the dark
filled button against the white panel. The larger baseline bbox additionally contains the
pre-existing `--text-muted` drift introduced by IMP-012 (`#7a7a73` → `#666661`, 20/255), which is
not attributable to IMP-007.

## Screenshot inventory (all written by me)

- `.improve/artifacts/IMP-007/verify-panel-desktop-1280.png` — panel with focused "Try again"
- `.improve/artifacts/IMP-007/verify-panel-mobile-390.png` — panel at 390×844
- `.improve/artifacts/IMP-007/verify-feed-recovered-desktop-1280.png` — feed after one successful retry
- `.improve/artifacts/IMP-007/verify-DEAD-BUTTON-index-available-desktop-1280.png` — **Issue 1**: enabled button, index serving `200 application/json`, no recovery
- `.improve/artifacts/IMP-007/verify-DEAD-BUTTON-index-available-mobile-390.png` — same at 390px

Pre-existing implementer artifacts in the same directory were left untouched. No baseline was
overwritten.

## Cleanup

- Preview server on port 4199 stopped; `lsof -nP -iTCP:4199 -sTCP:LISTEN` returns nothing.
- Browser closed.
- `web/dist/data` **restored** — `index.json`, `papers-2026-W39.json`, `papers-2026-W40.json` all
  present. The directory was only ever moved aside *after* a build, so `web/public/data` (the
  gitignored source) was never touched.
- `/tmp/rpf-v7`, `/tmp/rpf-v7-data` and scratch files deleted.
- `.playwright-mcp/` scratch directory removed (IMP-001's path-mangling finding re-confirmed:
  `filename: "/tmp/rpf-v7-shots/verify-panel-desktop-1280.png"` was written as
  `.playwright-mcp/-tmp-rpf-v7-shots-verify-panel-desktop-1280.png`; files were `mv`'d into place).
- `git status --porcelain=v1` is byte-identical to the pre-verification listing. No source file was
  modified. No git write command was run.

## Recommendation

Do not close IMP-007. Apply the Issue 1 fix (reset `retryingRef.current` in both settle arms at
`App.tsx:104-116`, or remove the ref — `disabled={retrying}` plus `refreshManifest`'s in-flight
sharing already provide the anti-spam guarantee), add the second-click assertion to
`App.retry.test.tsx`, and re-run this verification's Issue 1 reproduction. Issue 2 and Issue 3 are
optional cleanups already disclosed by the implementer.