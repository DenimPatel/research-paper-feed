# Independent verification — IMP-143 (export and test `readHash` / `writeHash`)

**Verdict: PASS** (with two non-blocking test-coverage gaps, both disclosed by the implementer)

Reviewer did not write the change. Scope: `git diff -- web/` plus untracked files under `web/` only.
The concurrent `scripts/` + `tests/` (Python) dirt and `.improve/reports/*IMP-024*` were ignored.
No repo source file was modified. Mutation testing was done in `/tmp` on copies.

---

## 1. Criteria scorecard

| # | Acceptance criterion (`.improve/FEATURES.md:175-179`) | Status | Evidence |
|---|---|---|---|
| 1 | Move `readHash`/`writeHash`/`HashState` to `web/src/lib/urlState.ts`, **named exports only**, `App.tsx` imports them and retains no copy | **MET** | §2.1 |
| 2 | New test file asserts `readHash("")`, `readHash("#")`, `readHash("#recency=99")`, `readHash("#view=collections")`, and `writeHash(readHash(h), "replace").hash` round-trips | **MET** (with a documented 3rd injected-writer arg — required by criterion 3) | §3.2 |
| 3 | `writeHash` testable without a `window` — hash returned, or captured via injected writer; no jsdom required | **MET** | §3.3 |
| 4 | `typecheck && npm test` pass, ≥6 tests in the new file, pre-existing tests unchanged, no new dependency | **MET** | §4, §5 |
| — | Verification method: build, browser round-trip, 1280px screenshot vs baseline | **MET** | §5, §6 |

---

## 2. Refactor fidelity — line-by-line diff of the moved code

### 2.1 `git diff -- web/src/App.tsx` is exactly the move

```
$ git diff --stat -- web/
 web/src/App.tsx | 67 ++++++---------------------------------------------------
 1 file changed, 6 insertions(+), 61 deletions(-)
```

- `git diff --name-status -- web/` → only `M web/src/App.tsx`
- Untracked under `web/`: `web/src/lib/urlState.ts`, `web/src/lib/__tests__/urlState.test.ts` — nothing else.
- The 6 insertions are the import block (`web/src/App.tsx:23-28`) plus the trailing blank; the 61
  deletions are `PAGE_SIZE`-adjacent `DEFAULT_RECENCY`, `RECENCY_VALUES`, `type View`,
  `interface HashState`, `readHash`, `writeHash`.

**No copy retained:**
```
$ grep -nE "^(function|const|type|interface|export function) (readHash|writeHash|HashState|View|DEFAULT_RECENCY|RECENCY_VALUES)" web/src/App.tsx
NONE - no copy retained
```

**Named exports only** (profile §5.3 rule):
```
$ grep -nE "^export" web/src/lib/urlState.ts
6:export type View = "feed" | "collections";
8:export interface HashState {
16:export function readHash(hash: string = window.location.hash): HashState {
39:export type HashWriter = (hash: string, mode: "push" | "replace") => void;
55:export function writeHash(
```
No `export default` anywhere.

**Types not redeclared** (spec Notes require `RecencyDays`/`SortMode` to stay in `types.ts`):
`web/src/lib/types.ts:38,40` still own them; `urlState.ts:1` does `import type { RecencyDays, SortMode } from "./types";`.

### 2.2 `readHash` — pre-change `HEAD:web/src/App.tsx:38-59` vs `urlState.ts:16-37`

Body compared line by line. **Identical**, with exactly one substitution:

| Pre-change | New | Delta |
|---|---|---|
| `function readHash(): HashState {` | `export function readHash(hash: string = window.location.hash): HashState {` | `export` + default param (delta 1) |
| `const raw = window.location.hash.replace(/^#/, "");` | `const raw = hash.replace(/^#/, "");` | the same delta |
| lines 20-38 (params, recency fallback, view/query/categories/sort) | `urlState.ts:18-35` | **character-for-character identical** |

Semantics check on the default parameter: JS default parameters are evaluated **at call time**, so
`window.location.hash` is still read fresh on every zero-arg call. Not hoisted. Equivalent to the
original, which read it inside the body. No drift.

### 2.3 `writeHash` — pre-change `HEAD:web/src/App.tsx:61-85` vs `urlState.ts:41-80`

Serialization body (`urlState.ts:60-77`) is **character-for-character identical** to
`HEAD:App.tsx:42-60` (same `params.set` order, same `if` guards, same `const hash = \`#${params.toString()}\``).

The tail changed:

| Pre-change (`HEAD:App.tsx:60-65`) | New |
|---|---|
| `const hash = ...;` | `const hash = ...;` (`urlState.ts:77`) |
| `if (mode === "push") { window.location.hash = hash; } else { window.history.replaceState(null, "", hash); }` | extracted verbatim into `writeToLocation` (`urlState.ts:41-47`), called as `write(hash, mode)` (`urlState.ts:78`) |
| (implicit `undefined`) | `return { hash };` (`urlState.ts:79`) |

`writeToLocation`'s body is the original if/else **verbatim**, and it is invoked at the same point in
the sequence (after `hash` is computed, before the function returns). `App.tsx:69` calls
`writeHash(next, mode)` with two args and ignores the return. **Behavior identical.**

### 2.4 The three signature deltas are all spec-required and correctly implemented

| Delta | Spec basis | Correct? |
|---|---|---|
| 1. `readHash(hash = window.location.hash)` | Criterion 2 calls `readHash("")` and `readHash("#")`; a zero-arg-only signature cannot satisfy that | Yes. Default preserves the existing zero-arg call at `App.tsx:64` and `App.tsx:76` |
| 2. `writeHash(...): { hash: string }` | Criterion 2 asserts `.hash`; criterion 3 says "the hash string it produces is returned" | Yes. `App.tsx` ignores it; no caller behavior change |
| 3. `write: HashWriter = writeToLocation` (3rd, optional) | Criterion 3 verbatim: "or captured via an injected writer … so no jsdom is required" | Yes. Defaulted, so `App.tsx`'s 2-arg call is unchanged; injection is opt-in |

The task brief's "do not change behavior" is satisfied: all three deltas are additive/defaulted, none
alters the serialization or the push/replace split.

### 2.5 `App.tsx` still behaves the same — imports and call sites

```
$ grep -n "readHash\|writeHash\|HashState\|View\b" web/src/App.tsx
24:  readHash,
25:  writeHash,
26:  type HashState,
27:  type View,
64:  const [urlState, setUrlState] = useState<HashState>(() => readHash());
69:      writeHash(next, mode);
76:    const onHashChange = () => setUrlState(readHash());
182:  const setView = (next: View) => {
```
`RecencyDays`/`SortMode` are still imported at `App.tsx:22` and still used at `App.tsx:190,194`, so
no `noUnusedLocals` violation. `typecheck` confirms (exit 0).

---

## 3. Review of the 18 new tests — `web/src/lib/__tests__/urlState.test.ts`

18 `it()` blocks, 25 `expect()` calls, **zero** `.skip` / `.todo` / `.only` / bare `expect(true)`.
No assertion is shape-only: every `writeHash` assertion pins the exact serialized string
(`:99`, `:104-106`, `:125`, `:131`, `:137`, `:144`), and both writer tests assert the exact
`{ hash, mode }` tuple, not merely that the writer was called.

### 3.1 Empirical mutation testing (this is the real answer to "would they fail if broken?")

Copied `urlState.ts` + the test + `types.ts` + `vite.config.ts` + `test-setup.ts` into
`/tmp/imp143-mut` (node_modules symlinked), reproduced the baseline (**18 passed**), then applied 14
independent breakages one at a time and re-ran:

```
MUTATION                                                  RESULT           VITEST SUMMARY
M1  readHash default -> "" (drop location)                 *** SURVIVED *** Tests  18 passed (18)
M2  ignore hash arg (always parse empty)                   CAUGHT           Tests  9 failed | 9 passed (18)
M3  always return DEFAULT_STATE                            CAUGHT           Tests  9 failed | 9 passed (18)
M4  never call the writer                                  CAUGHT           Tests  2 failed | 16 passed (18)
M5  return a wrong/empty hash                              CAUGHT           Tests  4 failed | 14 passed (18)
M6  un-encode: split on %2C not ,                          CAUGHT           Tests  5 failed | 13 passed (18)
M7  default writer is a no-op                              *** SURVIVED *** Tests  18 passed (18)
M8  categories null-vs-[] distinction lost                 CAUGHT           Tests  3 failed | 15 passed (18)
M9  recency fallback -> 30                                 CAUGHT           Tests  8 failed | 10 passed (18)
M10 drop the leading-# strip                               CAUGHT           Tests  9 failed | 9 passed (18)
M11 force mode=replace to the writer                       CAUGHT           Tests  1 failed | 17 passed (18)
M12 drop cat for a full selection                          CAUGHT           Tests  1 failed | 17 passed (18)
M13 swap view/sort acceptance                              CAUGHT           Tests  5 failed | 13 passed (18)
M14 writeHash returns state, not hash                      CAUGHT           Tests  6 failed | 12 passed (18)
--- restored, sanity re-run ---                     Tests  18 passed (18)
```

**12 of 14 breakages caught**, including "always return the default", "ignore the `hash` argument",
"drop the encoded round-trip", "never call the writer", and a full no-op `writeHash`. The suite is
genuinely load-bearing.

### 3.2 The two survivors — real, small, and disclosed

- **M7 — the default writer is untested.** Changing the default from `writeToLocation` to a no-op
  leaves all 18 tests green. The production call shape `writeHash(state, mode)` (2 args, exactly what
  `App.tsx:69` does) is never exercised, so `urlState.ts:41-47` — the only code in this module that
  still touches `window` — has **zero** unit coverage. A future edit that breaks push/replace wiring
  would be caught by neither the typechecker nor this suite.
  *Actionable:* add one jsdom-env case asserting `location.hash` changed after `"push"` and that
  `history.length` is unchanged after `"replace"`.
- **M1 — `readHash`'s default is untested.** All 18 tests call `readHash` with an explicit string, so
  the `= window.location.hash` default (used at `App.tsx:64,76`) has no coverage. Same one-line fix
  class: a jsdom case that sets `location.hash` then calls `readHash()`.
  *Actionable:* same case can cover both — `writeHash`/`readHash` with the default writer in jsdom.

Neither violates an acceptance criterion: criterion 3 only asks that `writeHash` be *testable*
without a window, which is satisfied. The implementer disclosed M7 in
`.improve/reports/impl-IMP-143.md:135-139`. Both should be picked up by IMP-008 / IMP-132 / IMP-133.

### 3.3 Criterion 3 — "no jsdom required" is real, not aspirational

`web/src/lib/__tests__/urlState.test.ts:1` is `// @vitest-environment node`, overriding the global
`environment: "jsdom"` at `web/vite.config.ts:8`. Test `:140-146` asserts `typeof window === "undefined"`
and then round-trips a full hash. I reproduced the file standalone in `/tmp` and it passed with
`environment 0ms` (no jsdom instantiated). `src/test-setup.ts` does load under `node` and its
`afterEach(cleanup)` is a no-op — verified by execution, as the implementer claimed.

### 3.4 Minor observations (non-blocking)

- Criterion 2's literal call `writeHash(readHash(h), "replace").hash` is written as the 3-arg
  `writeHash(readHash(FULL_HASH), "replace", IGNORE_LOCATION)` at `:110`. Substantively equivalent and
  forced by criterion 3, but the 2-arg form appears nowhere.
- `// @vitest-environment node` is load-bearing and undocumented in-file; a future config cleanup that
  drops it would silently flip this file to jsdom and make the `typeof window` assertion fail loudly
  (good), but the "no jsdom" property would be lost. The implementer flagged this at
  `.improve/reports/impl-IMP-143.md:140-142`.
- `DEFAULT_RECENCY` and `RECENCY_VALUES` (`urlState.ts:3-4`) are **not exported**, and duplicate
  `RECENCY_OPTIONS` in `FeedControls.tsx:16`. That duplication predates this change; not in scope.

---

## 4. Existing tests unmodified — confirmed byte-for-byte

```
$ for f in web/src/lib/__tests__/{search,paperIndex,collections}.test.ts \
           web/src/__tests__/domEnvironment.test.tsx web/src/test-setup.ts web/vite.config.ts; do
    compare $(git show HEAD:$f | shasum) $(shasum $f); done
IDENTICAL  web/src/lib/__tests__/search.test.ts
IDENTICAL  web/src/lib/__tests__/paperIndex.test.ts
IDENTICAL  web/src/lib/__tests__/collections.test.ts
IDENTICAL  web/src/__tests__/domEnvironment.test.tsx
IDENTICAL  web/src/test-setup.ts
IDENTICAL  web/vite.config.ts
```
No test file appears in `git diff`. No weakening, no skipping, no deletion, no config change that
would relax the environment. **42 pre-existing tests (12 search + 11 paperIndex + 16 collections +
3 domEnvironment) all still pass.**

---

## 5. Commands — exact results (all from `web/`, all with timeouts)

```
$ npm run typecheck
> tsc --noEmit
(no output)                                                    exit 0, 1.13s

$ npm test
> vitest run
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web
 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 7ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests) 8ms
 ✓ src/lib/__tests__/collections.test.ts (16 tests) 5ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 132ms
 Test Files  5 passed (5)
      Tests  60 passed (60)
   Duration  1.28s                                        exit 0

$ npm run build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.52 kB
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-Bu7uj54f.js   163.55 kB │ gzip: 52.57 kB
✓ built in 412ms                                        exit 0
```

Baseline was **4 files / 42 tests**; now **5 files / 60 tests** (42 + 18). Matches the claim.
Module count 38 → 39 and JS +54 minified bytes are the export-surface delta described in
`.improve/reports/impl-IMP-143.md:87-112`; CSS 10.93 kB and all three `dist/data/*.json` unchanged.

**No new dependency:** `git diff --name-only | grep -i package` → `NO PACKAGE CHANGES`
(`web/package.json` and `web/package-lock.json` untouched).

---

## 6. Runtime behavior check (Playwright, `npm run preview` on port 4187)

Server started from the built `dist/`, viewport **1280×900**, stopped afterwards.

### 6.1 Hash round-trip via the UI — `history.length` distinguishes push from replace

```
initial                      #q=CtrlWAM                                              histLen 3
toggle cs.CV OFF             #q=CtrlWAM&cat=cs.LG%2Ccs.CL%2Ccs.AI%2Ccs.RO           histLen 3  (replace)
toggle cs.CV ON              …&cat=cs.LG%2Ccs.CL%2Ccs.AI%2Ccs.RO%2Ccs.CV            histLen 3  (replace)
sort = Relevance             …&sort=relevance                                       histLen 3  (replace)
recency = 7 days             …&recency=7&sort=relevance                             histLen 3  (replace)
view = Collections           #view=collections&q=…&…&recency=7&sort=relevance        histLen 4  (PUSH)
view = Feed                  #q=…&…&recency=7&sort=relevance                       histLen 5  (PUSH)
BACK                         #view=collections&q=…&…&recency=7&sort=relevance        ✓
BACK x2                      #q=…&…&recency=7&sort=relevance                       ✓
FORWARD                      #view=collections&q=…&…&recency=7&sort=relevance        ✓
```
Exactly the pre-change contract: filter changes **replace**, view switches **push**. Commas are
percent-encoded as `%2C` on the way out and decoded on the way back, matching the unit tests.

### 6.2 Crafted / malformed hashes — graceful degradation, no crash, no blank

`#view=collections&q=test&cat=cs.CV&sort=bogus` → Collections view rendered normally, `sort=bogus`
ignored. No error boundary, no blank page.

Harsher: `#cat=,,,&recency=abc&view=nonsense&sort=&q=%E0%A4%A&extra=1&cat=cs.CV` →
feed view, all five category chips **unpressed** (`cat=,,,` → `""` → `filter(Boolean)` → `[]` = explicit
empty selection, the documented `cat=` semantics), "60 days" pressed (`recency=abc` → 60),
"Newest" pressed (`sort=` → newest), `view=nonsense` → feed, invalid percent-encoding rendered as a
replacement char without throwing, unknown `extra` ignored, duplicate `cat` resolved first-wins.
Rendered **"No papers match the current filters."** — a real empty state, not a crash.

### 6.3 Console / network

`playwright_browser_console_messages` was called twice across the whole session (after the
interaction sweep and after the malformed-hash navigations): **zero messages**, no `console.error`,
no warnings. `playwright_browser_network_requests`: **every request 200 OK**, no failures.

**Zero new console errors versus `.improve/artifacts/baseline/`.**

### 6.4 Screenshot comparison

`.improve/artifacts/IMP-143/verify-feed-desktop-1280.png` — my own capture, 1280×900, bare feed:

```
$ md5 -q .improve/artifacts/IMP-143/verify-feed-desktop-1280.png
4b6b8c709a9f7c0ce3eb579ab1580886
$ md5 -q .improve/artifacts/baseline/baseline-feed-desktop-1280.png
4b6b8c709a9f7c0ce3eb579ab1580886
$ md5 -q .improve/artifacts/IMP-143/feed-desktop-1280.png        (implementer's)
4b6b8c709a9f7c0ce3eb579ab1580886
```

All three are **byte-identical**. Visually nothing changed: same header, same control cluster
(5 category chips pressed, 60 days, Newest, Relevance disabled with no query), same
"2812 papers match" status, same first card. Independent reproduction of the implementer's claim.

---

## 7. The reported `applyState` batching bug — **PRE-EXISTING, not a regression**

`.improve/reports/discovered-IMP-143.md` D-1 and `.improve/reports/impl-IMP-143.md:153-157`
describe it. I reproduced it independently and then established provenance.

**Real?** Yes. Four filter changes dispatched in one JS task (React 18 auto-batching) collapse to a
single stale `urlState`:

```js
// one task: setQuery('diffusion'); toggleCategory(cs.RO); setRecency(30); setSort('relevance'); setView('collections')
immediateHash: "#view=collections&q=diffusion"
settledHash:   "#view=collections&q=diffusion"
```
`cs.RO`, `recency=30`, and `sort=relevance` are all silently lost — from the hash as well as from
React state, because `applyState` (`web/src/App.tsx:67-73`) writes eagerly with a stale base. The same
four actions one tick apart (§6.1) produce correct cumulative hashes.

**Regression introduced by IMP-143?** No. Proven by content hash, not by reading:

```
$ git show HEAD:web/src/App.tsx | sed -n '/const applyState = useCallback/,/^  );/p' | md5
c2d97b82178995f7a8bd10655d089dc3
$ sed -n '/const applyState = useCallback/,/^  );/p' web/src/App.tsx | md5
c2d97b82178995f7a8bd10655d089dc3

$ ... setView … toggleCategory blocks, same method ...
bc8f8369a3d32c631e1a6275a866ab72   (HEAD)
bc8f8369a3d32c631e1a6275a866ab72   (worktree)
```

`applyState` and every setter built on it are **byte-identical** to `HEAD`. The only `web/` diff is
the removal of the two hash functions and one import. `writeHash`'s new `{ hash }` return value is
ignored at the `App.tsx:69` call site, so it cannot affect this path.

**Verdict: pre-existing, latent, and it must NOT block IMP-143.** It should be filed as its own
backlog item. It is genuinely latent today — every control is a separate DOM click handler and a
human cannot dispatch two clicks in one JS task; it needs a programmatic loop, a future bulk control,
or a keyboard-shortcut layer. That makes it a real forward risk for exactly the items IMP-008 /
IMP-132 / IMP-133, which build on this module. The one-line fix the report sketches
(`setUrlState((current) => ({ ...current, ...patch }))`, deriving the hash from the same patch) is
sound and needs no change to `urlState.ts`.

I did **not** create the backlog entry — that is the coordinator's call, not this review's scope.

---

## 8. Issues

**Blocking: none.**

Non-blocking, actionable:

1. `web/src/lib/urlState.ts:41-47` (`writeToLocation`) has zero unit coverage — mutation M7 (default
   writer replaced by a no-op) passes all 18 tests. Add one jsdom-env case in
   `web/src/lib/__tests__/urlState.test.ts` (or a sibling file) asserting `location.hash` changes
   after `writeHash(state, "push")` and that `history.length` is unchanged after
   `writeHash(state, "replace")`. This is the only remaining `window`-touching code in the module and
   it is what `App.tsx:69` actually exercises. Implementer already recommended this at
   `.improve/reports/impl-IMP-143.md:135-139`; it has not landed.
2. `web/src/lib/urlState.ts:16` — the `= window.location.hash` default is untested; mutation M1
   (`= ""`) passes all 18 tests. A jsdom case that sets `location.hash` and then calls `readHash()`
   with no arguments closes it. Same test file, same environment fix as issue 1.
3. Housekeeping, not a defect: `.improve/REPO_PROFILE.md` still points at `App.tsx` for code that
   moved. §5.3's routing note (`readHash()` `:38`, `writeHash()` `:61`), the constants list
   (`DEFAULT_RECENCY` `App.tsx:25`, `RECENCY_VALUES` `App.tsx:26`), and bug rows WEB-33 / WEB-34 /
   WEB-36 / WEB-14 / WEB-15 / WEB-16 all cite dead line numbers; **WEB-37 is now fixed and should be
   struck.** Out of the implementer's scope to edit the profile, so correctly escalated rather than
   silently changed. Owner: whoever maintains `REPO_PROFILE.md`.

None of 1-3 are acceptance criteria; 1 and 2 are follow-up work, not rework of this item.

---

## 9. Artifacts

- `.improve/artifacts/IMP-143/verify-feed-desktop-1280.png` — verifier capture, 1280×900, bare feed
- Baseline: `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`
- MD5 of all three files: `4b6b8c709a9f7c0ce3eb579ab1580886` (identical)
- Preview server on port 4187 was stopped; browser closed; `/tmp/imp143-mut` removed.
- No repo source file was modified by this verification.