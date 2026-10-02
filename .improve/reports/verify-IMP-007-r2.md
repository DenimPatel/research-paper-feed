# IMP-007 — Independent re-verification (round 2)

**Item:** `IMP-007` — Add a "Try again" button to the index-unavailable panel.
**Spec:** `.improve/FEATURES.md:244-258`.
**Implementer's report:** `.improve/reports/impl-IMP-007.md` (attempt 2 of 3).
**Previous verdict (FAIL):** `.improve/reports/verify-IMP-007.md`.
**Verifier:** independent, read-only, hostile to the fix. No source file was modified; the only
files written are this report and four `r2-*.png` files under `.improve/artifacts/IMP-007/`
(a gitignored path — `.git/info/exclude:51`). No git write command was run.
**Scope reviewed:** `git diff -- web/src/App.tsx web/src/lib/paperIndex.ts
web/src/lib/__tests__/paperIndex.test.ts` plus `web/src/__tests__/App.retry.test.tsx`.
`collections.ts` / `collections.test.ts` / `malformedImport.test.tsx` ignored as instructed.

---

## VERDICT: **PASS**

**All 3 written acceptance criteria met. All 4 previous findings resolved for real, not by
workaround. All 12 new tests are load-bearing. Gates green at the expected 96 tests / 7 files.**
I attacked the network semantics specifically, because that is what failed last round: 17
mutants, 6 independent adversarial probes, and a real-browser run with per-click request
counting. The latch class of bug is gone — including from the three places it could have moved
to. Two cosmetic observations remain, neither of which is a defect, listed in §5.

The previous round's blocking reproduction (an enabled, correctly-labelled button that silently
swallows every click after the first) no longer reproduces under any condition I could construct:
not on repeated failures, not with the index present on disk, not at 390px, not after eight
consecutive failed retries.

---

## 1. Re-check of each previous finding

### 1.1 (BLOCKING) `retryingRef` — deleted, and **not replaced anywhere**

`grep -n "retryingRef\|setRetrying\|aria-busy\|Retrying\|disabled=" web/src/App.tsx` → **no match.**
The handler (`App.tsx:135-140`) has no guard:

```tsx
135:  const handleRetryManifest = () => {
136:    retriedRef.current = true;
137:    setError(null);
138:    setLoading(true);
139:    setManifestAttempts((attempts) => attempts + 1);
140:  };
```

### 1.1.1 Exhaustive sweep for a *replacement* latch — every `useRef` and every boolean in `App.tsx`

```
$ grep -n "useRef"  web/src/App.tsx      $ grep -n "\.current\s*="  web/src/App.tsx
 81:  const indexRef = useRef<PaperIndex>();      83:    indexRef.current = new PaperIndex();
 93:  const retriedRef = useRef(false);          126:      retriedRef.current = false;
 94:  const feedHeadingRef = useRef<HTMLHeadingElement>(null);
                                                 136:    retriedRef.current = true;

$ grep -n "= true\|= false" web/src/App.tsx
 97:    let cancelled = false;      <- manifest effect, cleanup-local
120:      cancelled = true;          <- set ONLY in that effect's cleanup
126:      retriedRef.current = false;
136:    retriedRef.current = true;
146:    let cancelled = false;      <- papers effect, cleanup-local
168:      cancelled = true;          <- set ONLY in that effect's cleanup
```

Line by line:

| Flag | Set `true` at | Reset on | Verdict |
| --- | --- | --- | --- |
| `cancelled` (manifest effect, `:97`) | `:120`, **only inside its own cleanup** | n/a — the effect is being torn down | Correct. Not a latch. |
| `cancelled` (papers effect, `:146`) | `:168`, **only inside its own cleanup** | n/a | Correct. Not a latch. |
| `indexRef` (`:81`) | `:83`, guarded by `if (!indexRef.current)` at `:82` | never — it is a lazy singleton, `PaperIndex` is stateless w.r.t. identity | Correct. Not a latch. |
| `feedHeadingRef` (`:94`) | n/a (DOM ref) | n/a | Correct. |
| `retriedRef` (`:93`) | `:136` (retry click) | `:126`, **only when `manifest` becomes truthy** | **Structurally a sticky-true flag.** See below — I traced it exhaustively and it has **no** user-visible consequence. |

`retriedRef` is the *only* candidate for a same-class replacement latch, so I traced every path
that can move it or read it. Its single reader is `App.tsx:125`, gated on `manifest` being
truthy; the only writer of `manifest` is `setManifest(next)` at `App.tsx:110`, reached only when
the manifest fetch fulfils. Therefore:

* `retriedRef.current` can only be observed after the flag has just been reset on the same
  commit — so it can never cause a spurious focus steal.
* On a cold load it is `false`, so a successful first paint never steals focus. Verified live:
  the recovered feed carried `[active]` on the `<h1>`, a plain cold reload carries it on `<body>`.
* Staying `true` across failures is inert. The next successful attempt resets it.
* Narrow race (click retry, hit **Collections** during the ~ms window): `feedHeadingRef.current`
  is `null` → `?.focus()` no-ops, and `:126` still resets the flag. Result is "no focus move",
  which is benign.

Mutant **M12** (delete `retriedRef.current = false` at `:126`, leaving the flag permanently
`true` after the first success) **survives all 96 tests** — so this is *not* covered by the
suite. It is nonetheless not a bug. Recorded as a LOW informational note in §5.1 rather than a
finding, because "no test kills this mutant" is exactly the inference that caused the last
failure, and I am explicitly not repeating it: I have a positive reachability argument, not an
absence of evidence.

### 1.2 (TEST HOLE) the second-click assertion — present, and it kills the attempt-1 code

`web/src/__tests__/App.retry.test.tsx:211-221`:

```tsx
211:  it("refetches on a second click after a failed retry, then recovers", async () => {
212:    const feed = installScriptedFetch(["fallback", "fallback", "json"]);
...
215:    fireEvent.click(first);
216:    const second = await screen.findByRole("button", { name: /try again/i });
217:    fireEvent.click(second);
219:    expect(feed.indexRequests()).toBe(3);
```

and `:223-243` walks three consecutive failures then recovers on the fourth. Both assert
**request counts**, not attributes, and `clickRetryExpectingAnotherFailure` (`:120-124`)
re-queries the button each iteration, so a remount cannot make a later click a silent no-op.

Empirical proof they would fail against attempt-1 code — the latch reinstated verbatim in a
throwaway `/tmp` copy (`git show HEAD:` was *not* used for this; the latch was patched back into
the current `App.tsx`):

```
$ npx vitest run src/__tests__/App.retry.test.tsx
× refetches on a second click after a failed retry, then recovers 16ms
    → expected 2 to be 3 // Object.is equality
× keeps accepting retries across three consecutive failures 22ms
    → expected 2 to be 4 // Object.is equality
 Test Files  1 failed (1)
      Tests  2 failed | 5 passed (7)
```

`expected 2 to be 3` is byte-for-byte the previous verdict's failure signature. A second latch
shape (set-flag-instead-of-guard, `M2b`) is also killed by the same two tests.

### 1.3 (LOW) unreachable `"Retrying…"` / `aria-busy` / `disabled` — **removed, not relocated**

`App.tsx:343-349` is now:

```tsx
343:                  <button
344:                    type="button"
345:                    className="button"
346:                    onClick={handleRetryManifest}
347:                  >
348:                    Try again
349:                  </button>
```

The `retrying` state, `setRetrying`, `disabled`, `aria-busy` and the ternary label are all gone.
Verified in the live DOM, not just by reading: `disabled: false`, `aria-busy` attribute
**absent**, `textContent` exactly `"Try again"` — no `"Retrying…"` string anywhere in the file.
The real busy affordance is the pre-existing `<p className="panel" role="status">Loading the
paper index…</p>` (`App.tsx:361-365`), which is what replaces the panel on click; asserted by
`App.retry.test.tsx:156-158`. This is a real fix, not a relocation.

### 1.4 (LOW) `refreshManifest()` on the mount path — **now split, and the split is correct**

`App.tsx:105-106`:

```tsx
const attempt =
  manifestAttempts > 0 ? index.refreshManifest() : index.getManifest();
```

Assessment: the mount branch (`manifestAttempts === 0`) calls `getManifest()`, which is exactly
what HEAD did — so the cold-start path is now visibly a plain, legible fetch and the "force a
re-fetch" method is off it. The retry branch calls `refreshManifest()`. **Honest finding: the
retry branch's distinguishing behaviour is unreachable from this UI.** When the panel is visible
`manifest` is `null`, which means the manifest fetch *rejected*, which means
`paperIndex.ts:78-81` already nulled `manifestPromise` and `manifestSettled` is `false`, so
`refreshManifest()` at `:92-98` falls straight through to `getManifest()`. I confirmed this by
mutation: **M8** (collapse the ternary to `index.getManifest()`) **survives all 96 tests**, and
survives my 6 probes and the real-browser run as well.

That is *not* a defect — it is defensive correctness that costs one line — but it is dead
weight, and the implementer discloses it (`impl-IMP-007.md` §5, M8). I record it in §5.2 as a
nit. The `refreshManifest()` capability itself **is** covered by two killing unit tests and I
verified independently (§3.2, M4/M5/M10/M17), so keeping it is defensible.

---

## 2. Network semantics — adversarial review

### 2.1 Rapid clicking: 10 clicks, 2 different regimes

**Same-tick burst.** 10 synthetic `MouseEvent` clicks dispatched on the live button inside one
`evaluate`, on a page with the index missing:

```
10 clicks dispatched  ->  wrapper-recorded index.json requests for that burst: 1
```

Ten same-tick activations produce **one** network request. React 18 batches
`setManifestAttempts(a => a + 1)`, the panel unmounts in the same commit, and every later click
lands on a detached node. No stampede.

**Genuinely sequential clicks.** Because a same-tick burst is degenerate, I also forced six
*real* cycles — click, wait for the panel to unmount, wait for the request, wait for the panel to
remount, click again — with the network still broken:

```
click 1..6:  requestsThisClick: 1, 1, 1, 1, 1, 1
             sawPanelUnmount:   true ×5 (6th too fast to sample)
             panelBack:        true ×6
             btnDisabled:      false ×6
             btnLabel:         "Try again" ×6
total index.json requests: 7, all status 200, all content-type text/html
```

**One request per click, six clicks, six requests.** Rapid clicking is safe.

### 2.2 Click while a request is already in flight — no double-fetch

Held the `index.json` response open so the retry stayed in flight, then hammered the (now
detached) button 10×:

```
sawPanelUnmountDuringFlight:      true
buttonsInPanelDuringFlight:       0        <- there is no control to click
requestsForTheClick:              1
extraRequestsFrom10HammerClicks:  0        <- not one
totalButtonsInDocDuringFlight:    2        <- Feed, Collections (nav only)
```

The request is *shared*, not duplicated, and structurally so: the control unmounts before the
response lands, so a duplicate activation is unreachable. Belt-and-braces: `refreshManifest()`
also shares an in-flight promise (`paperIndex.ts:93-97`), which mutant **M17** confirms is
load-bearing (killed by `paperIndex.test.ts:237-251`).

### 2.3 Repeated failure — the button never gets stuck

Real browser, network deliberately left broken, **nine** consecutive failed retries
(1 real `click`, then 8 via the sequential harness), then data restored:

| Attempt | panel returned | button `disabled` | button label | request fired |
| --- | --- | --- | --- | --- |
| 1–8 | yes | `false` | `Try again` | yes |
| 9 (data restored) | feed rendered | n/a | n/a | yes |

Accessibility-snapshot node refs advanced on every single failure (`e12` → `e25` → `e35` →
`e45` → `e55` → `e65` → `e75` …) — machine-checkable proof that each attempt produced a
genuinely new render, not a silent no-op. My own probe `PROBE-C` does the same in jsdom across
**eight** consecutive failures and asserts `indexRequests()` reaches 9 then 10; it **fails**
(`expected 2 to be 9`) against the attempt-1 latch.

There is no disabled/busy state to get stuck, because there is no disabled state at all — see
§1.3. The disabled-state trace is: *the control is unmounted for the whole duration of the
attempt, and remounts enabled on failure.* That is a stronger guarantee than a reset flag.

### 2.4 Memo freshness after a successful retry — proven against a real HTTP server

The brief asks for the underlying data file to be mutated between two successful loads. I did
that with a real `node:http` server and real files on disk (`/tmp` scratch, no `fetch` mock; the
only shim prefixes the origin onto the relative URL `PaperIndex` builds):

```
1. write index.json -> version A (shard papers-A.json), write papers-A.json
   index.getManifest()          -> A.shards[0].file === "papers-A.json"
   index.loadPapers(30)         -> ["Paper A"]
   index.json requests: 1

2. *** rewrite index.json -> version B (shard papers-B.json), write papers-B.json ***
   index.refreshManifest()      -> B.shards[0].file === "papers-B.json"
   index.loadPapers(30)         -> ["Paper B"]     <- later caller sees the FRESH memo
   index.json requests: 2

3. index.refreshManifest() again, no file change -> still B
   index.json requests: 3                       <- a real refetch, not a replay
```

**Passes.** Killed by the stale-memo mutant (**M10**): `expected [ 'Paper A' ] to deeply equal
[ 'Paper B' ]`. In the live app this is also visible: after the successful retry the log shows
`index.json → 200 application/json` followed by the two shard fetches and **no** third
`index.json` — the memo served `loadPapers`, so the retried manifest is what the feed renders.

Note: the *resolved-memo* refresh path is not reachable from the UI (the panel requires
`!manifest`, so the first attempt must have rejected). It is covered where it belongs — directly
on `PaperIndex` — by `paperIndex.test.ts:226-235`, `:253-264`, `:266-311`, `:313-355`, all
independently mutation-verified below.

### 2.5 All four failure modes recover

Verified at the **App level** by my own probe `PROBE-E` (independent of the implementer's
`paperIndex.test.ts:313-355`), each asserting the paper title renders and
`indexRequests() === 2`:

| Mode | Recovered |
| --- | --- |
| `fetch` rejects with `TypeError` (network error) | yes |
| `200 text/html` SPA fallback | yes |
| `404` | yes — panel showed `(HTTP 404)`, retry recovered |
| `200 application/json` with a malformed body | yes |
| valid-but-**empty** manifest (`shards: []`, `totalPapers: 0`) — `PROBE-D` | yes — recovers to the feed with "No papers are available in this window yet.", **not** a dead end |

---

## 3. Non-vacuity — 17 mutants, 15 killed

Run in a throwaway `/tmp/imp007-v2` copy of `web/` (`node_modules` symlinked, repo never
touched, scratch deleted afterwards). Mutations applied by guarded string replacement with
`assert old in s`, so a silent no-op substitution cannot fake a result.

### 3.1 Matrix vs `src/__tests__/App.retry.test.tsx`

| # | Mutation | Killed by |
| --- | --- | --- |
| M2 | **reintroduce the attempt-1 `retryingRef` latch** | **2** — `expected 2 to be 3`, `expected 2 to be 4` |
| M2b | latch as "set-flag-and-skip" instead of early-return | **2** |
| M3 | handler never bumps `manifestAttempts` | 6 |
| M6 | delete the focus-handoff effect (`:124-129`) | 1 |
| M7 | remove `onClick` (inert button) | 6 |
| M9 | `paperIndex` rejection arm no longer clears the memo | 5 |
| M14 | handler never sets `retriedRef` (focus never handed) | 1 |
| M15 | relabel the button "Retry" | 7 |
| M16 | handler does not clear `error` | 2 |
| M4 | `refreshManifest` clears the memo unconditionally | 0 (killed by `paperIndex` only) |
| M5 | `refreshManifest` never drops a resolved memo | 0 (killed by `paperIndex` only) |
| M10 | `refreshManifest` refetches but leaves a stale memo | 0 (killed by `paperIndex` only) |
| M17 | `refreshManifest` duplicates the in-flight request | 0 (killed by `paperIndex` only) |
| M8 | mount-path ternary collapsed to `getManifest()` | **0 — inert, see §1.4 / §5.2** |
| M12 | `retriedRef` never reset after success | **0 — benign, see §1.1.1 / §5.1** |
| M13 | drop `setLoading(true)` in the handler | **0 — dead write, see §5.3** |

### 3.2 Matrix vs `src/lib/__tests__/paperIndex.test.ts`

| # | Mutation | Killed by |
| --- | --- | --- |
| M4 | `refreshManifest` clears the memo unconditionally (duplicates in-flight) | 1 — *"shares an in-flight manifest request…"* |
| M5 | `refreshManifest` never drops a resolved memo | **2** — `:226` and `:253` |
| M9 | rejection arm no longer clears the memo | **3** — incl. *"recovers via refreshManifest after every manifest failure mode"* |
| M10 | `refreshManifest` refetches but leaves a stale memo | 1 — *"leaves the memo holding the refreshed manifest…"* |
| M17 | duplicates the in-flight request | 1 — *"shares an in-flight…"* |

Every substantive `paperIndex` mutation is killed. My independent real-HTTP probe `PROBE-F`
likewise fails only on M10.

### 3.3 All 12 new tests fail against HEAD's source

In `/tmp`, with `git show HEAD:web/src/App.tsx` and `git show HEAD:web/src/lib/paperIndex.ts`:

```
× PaperIndex > refetches the manifest on refresh, even after it resolved
× PaperIndex > shares an in-flight manifest request with a retry instead of duplicating it
× PaperIndex > refetches the manifest on refresh after a rejection
× PaperIndex > leaves the memo holding the refreshed manifest for later callers
× PaperIndex > recovers via refreshManifest after every manifest failure mode
× index-unavailable panel retry > renders a focusable native button labelled Try again inside the error panel
× index-unavailable panel retry > clears the error panel, shows the loading status, and refetches the index
× index-unavailable panel retry > recovers into the feed on retry without a reload and moves focus to it
× index-unavailable panel retry > issues a single retry when the button is clicked twice in one tick
× index-unavailable panel retry > restores the Try again button when the retry fails too
× index-unavailable panel retry > refetches on a second click after a failed retry, then recovers
× index-unavailable panel retry > keeps accepting retries across three consecutive failures
 Test Files  2 failed (2)
      Tests  12 failed | 11 passed (23)
```

All 12 fail; all 11 pre-existing `paperIndex` tests still pass against HEAD's `paperIndex.ts`.

### 3.4 No existing test weakened, skipped, or deleted

```
$ git diff --stat -- web/src/lib/__tests__/paperIndex.test.ts
 web/src/lib/__tests__/paperIndex.test.ts | 139 +++++++++++++++++++++++++++++++
 1 file changed, 139 insertions(+)          <- ZERO deletions

$ git diff -- web/src/lib/__tests__/paperIndex.test.ts | grep '^-' | grep -v '^---'
(no output)

$ grep -rn "\.skip\|\.todo\|\.only\|it\.fails\|describe\.skip" \
    web/src/__tests__/App.retry.test.tsx web/src/lib/__tests__/paperIndex.test.ts
(no output)

$ grep -n "aria-busy\|disabled=\|Retrying" web/src/App.tsx
(no output)
```

`App.retry.test.tsx` is untracked (created by this item) so it has no git baseline. The
implementer discloses removing two `getAttribute("aria-busy") === "false"` assertions
(`impl-IMP-007.md` §4). I verified the removal was **mandatory, not opportunistic**: `aria-busy`
does not exist anywhere in `App.tsx` (grep above), so those assertions would have evaluated
`null === "false"` and failed for a reason unrelated to behaviour. Net effect is +2 tests
(5 → 7) and `textContent` assertions replacing the attribute checks. No coverage was traded away.

---

## 4. Gates — exact output, run from `web/`

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
```

```
$ npm test
 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 5ms
 ✓ src/lib/__tests__/paperIndex.test.ts (16 tests) 11ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 8ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 44ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 133ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 311ms

 Test Files  7 passed (7)
      Tests  96 passed (96)
   Duration  1.57s
TEST_EXIT=0
```

```
$ npm run build
> tsc --noEmit && vite build
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.52 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-DqdzZy6m.js   164.47 kB │ gzip: 52.82 kB
✓ built in 368ms
BUILD_EXIT=0
```

**96 tests / 7 files — exactly as the brief anticipated.** `collections.test.ts` (35) and
`malformedImport.test.tsx` (5) are the concurrent IMP-154 agent's and are not attributed to
IMP-007. IMP-007's own contribution is **+12** (5 → 7 in `App.retry.test.tsx`, 11 → 16 in
`paperIndex.test.ts`).

`git diff --stat -- web/src/styles.css` is **empty** and the built CSS asset hash
`index-G-YE6pVt.css` is unchanged from HEAD — machine-checkable proof `styles.css` was not
opened, which is what makes the visual verdict in §6 meaningful.

---

## 5. Residual observations (LOW — none blocking, none a defect)

### 5.1 `retriedRef` is a sticky-true flag on the failure path

`App.tsx:93`, set at `:136`, reset only at `:126` (guarded by `manifest` truthy). After a
*failed* retry it stays `true`. Structurally this is the shape that caused the last failure, and
mutant M12 shows no test pins it. I traced it to a positive reachability argument (§1.1.1) and
found no consequence: single consumer, reset on the same commit that makes it observable, and
`manifest` can only become truthy through a user-initiated retry. Suggest (optional) resetting it
in the `.catch` arm at `App.tsx:113-118` for symmetry, or a one-line comment saying why
stickiness is safe. **Not a finding.**

### 5.2 The `manifestAttempts > 0 ? refreshManifest() : getManifest()` ternary is inert

`App.tsx:105-106`. Mutant M8 kills nothing, anywhere. Collapsing it to `index.getManifest()`
changes no behaviour and breaks no test. Harmless and arguably clearer as written. **Not a
finding.**

### 5.3 `setLoading(true)` at `App.tsx:138` is a dead write

`loading` is read at exactly one place, `App.tsx:399`, inside `{manifest && …}`. Whenever the
panel is visible `manifest` is `null`, so `loading` is never observed in this branch. Mutant M13
(deletions survive all 96 tests). Defensive and consistent with `:147`. **Not a finding.**

---

## 6. Playwright — real behaviour, verified by me

`npm run build`, then `mv web/dist/data /tmp/…` (only the gitignored `dist` was ever touched —
`web/public/data` was never moved; confirmed present and unchanged at the end), then
`npm run preview -- --port 4241 --strictPort`. Missing index reproduced the transient-failure
shape through the SPA fallback (`index.json status=200 type=text/html`), as the profile's §8
trap 7 requires.

### 6.1 Control, live DOM

```json
{ "tag": "BUTTON", "type": "button", "className": "button",
  "disabled": false, "ariaBusyAttr": null, "text": "Try again",
  "parentRole": "alert", "tabIndex": 0,
  "computed": { "background": "rgb(28, 28, 26)", "color": "rgb(250, 249, 246)",
                "borderRadius": "999px", "fontFamily": "Manrope, …", "fontWeight": "700",
                "cursor": "pointer", "appearance": "none" } }
```

Native `<button type="button">`, in the tab order, accessible name exactly `Try again`, inside
`role="alert"`, **no `aria-busy` attribute present**.

### 6.2 Keyboard

Real key presses from a blurred body, tab order enumerated live:
`Skip to content` → `Feed` → `Collections` → **`Try again` `[active]`** (Tab 4).
Real `keyboard.press("Enter")` on it produced exactly **1** `index.json` request and the panel
remounted (`e12` → `e25`). No `tabIndex` gymnastics, no ARIA key handling.

### 6.3 Network log for the full sequence

Initial paint + real `Enter` + real click after restoring the data:

```
/research-paper-feed/                     200
/assets/index-DqdzZy6m.js                 200
/assets/index-G-YE6pVt.css                200
/data/index.json                          200  text/html          <- paint -> panel
/data/index.json                          200  text/html          <- Enter (still broken)
/data/index.json                          200  application/json  <- click, data restored
/data/papers-2026-W40.json                200  application/json
/data/papers-2026-W39.json                200  application/json
```

Exactly one document, one JS, one CSS fetch across all activations — machine-checkable proof of
"no page reload" for AC2. After recovery `document.activeElement` was
`H1 / "Recent arXiv papers in CS & AI"`, i.e. the focus handoff works and does not trap focus.

### 6.4 Console

`playwright_browser_console_messages` returned an **empty list** after the panel, after nine
failed retries, after the 404 path, and after the recovered feed. Every request was 200.

### 6.5 Visual — intentionally designed, not bolted on

The control reuses the existing `.button` class, so it inherits the site's own pill geometry,
Manrope 700 at 13.6px, `appearance: none` and the `:focus-visible` ring. In the 1280px capture
the dark pill sits between the error paragraph and `Build the index locally:`, reads as part of
the panel's visual language, and carries a visible green focus ring. At 390px it is 92×40 at
`x=41`, does not overflow (`overflowsHorizontally: false`), and after **three failed retries**
still renders enabled and in place. Verdict: matches the panel styling; a legitimate "unstyled
control in a styled panel" finding does **not** apply.

### 6.6 Screenshots I captured (all fresh, this run)

- `.improve/artifacts/IMP-007/r2-panel-keyboard-focus-desktop-1280.png` — 1280×900, Tab-focused
- `.improve/artifacts/IMP-007/r2-panel-after-3-failed-retries-mobile-390.png` — 390×844, after 3 failures
- `.improve/artifacts/IMP-007/r2-feed-recovered-after-3-activations-desktop-1280.png` — 1280×900, recovered
- `.improve/artifacts/IMP-007/r2-feed-recovered-after-3-activations-mobile-390.png` — 390×844, recovered

The spec's own filenames (`feed-retry-recovered-desktop-1280.png`,
`feed-retry-panel-desktop-1280.png`) were already produced by the implementer; I prefixed mine
`r2-` so this round's evidence cannot be confused with it. No pre-existing artifact was
overwritten or deleted. `.playwright-mcp/` (the recurring path-mangling scratch directory,
IMP-001) was removed after `mv`-ing the files into place.

---

## 7. Acceptance criteria

| AC | Verdict | Evidence |
| --- | --- | --- |
| 1. Focusable `<button>` labelled "Try again" that clears `error` and re-invokes the manifest load effect | **MET** | `App.tsx:343-349` (native `<button type="button">`, accessible name `Try again`, inside `role="alert"`); handler `:135-140` clears `error` (`:137`) and bumps `manifestAttempts` (`:139`), the effect's only dep (`:122`). Live: Tab 4, `Enter` fires a request. |
| 2. Pressing it with the index present transitions panel → loading → feed, with no page reload | **MET — on every press, not just the first** | Six sequential retries → 6 requests (§2.1); nine failures then success → feed with 2,812 papers, focus on the `<h1>`, exactly one document/JS/CSS fetch (§6.3). The previous round's caveat is closed. |
| 3. `cd web && npm run typecheck && npm test` passes | **MET** | `TYPECHECK_EXIT=0`; `Test Files 7 passed (7)` / `Tests 96 passed (96)`. |

## 8. Recommendation

**Close IMP-007.** The blocking latch is gone from the source and from every place it could
have moved to; the test hole is closed with an assertion that provably fails on the old
behaviour; the dead busy-state code is deleted rather than relocated; and the network semantics
hold up under a same-tick burst, a click during an in-flight request, nine consecutive failures,
and four distinct failure modes. §5.1–§5.3 are optional polish and should not block.

---

## 9. Cleanup

* Preview server on 4241 stopped; `lsof -nP -iTCP:4241 -sTCP:LISTEN` → free. Browser closed.
* `web/dist/data` **restored**: `index.json`, `papers-2026-W39.json`, `papers-2026-W40.json` all
  present. `web/public/data` was never moved.
* `/tmp/imp007-v2`, `/tmp/imp007-m2`, `/tmp/imp007-r2-data{,2,3}` deleted. `.playwright-mcp/`
  removed.
* No git write command was run (`commit` / `add` / `push` / `checkout` / `reset` / `stash`).
* `git status --porcelain` after verification:

```
 M web/src/App.tsx
 M web/src/lib/__tests__/paperIndex.test.ts
 M web/src/lib/paperIndex.ts
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-007.md
?? .improve/reports/impl-IMP-007.md
?? .improve/reports/verify-IMP-007.md
?? web/src/__tests__/App.retry.test.tsx
```

Byte-identical to the pre-verification listing, plus nothing of mine (my report and screenshots
are `.improve/` paths; `.improve/artifacts/` is gitignored via `.git/info/exclude:51`). No
source file was modified.