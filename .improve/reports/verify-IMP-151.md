# IMP-151 — Independent verification report

**Item:** `IMP-151` — Stop `__proto__` from passing the `id in papers` membership check.
**Verifier:** independent sub-agent (did not write the change).
**Date:** 2026-10-02
**Verdict:** **PASS** — 5/5 acceptance criteria met. Two issues found, neither a criterion failure; one is a new crash-class bug in the same blast radius that this change did **not** fix and should be backloged.

**Scope reviewed:** `git diff -- web/src/lib/collections.ts web/src/lib/__tests__/collections.test.ts` (+24/-3 and +128/-0).
`web/src/styles.css` (concurrent IMP-012) ignored entirely, as instructed. No source file was modified. No git write command was run.

---

## 0. Method

Everything below was reproduced independently. Where the implementer's report made a claim, I re-derived it rather than accepting it. Adversarial and mutation work was done in a scratch copy at `/tmp/rpf-verify-151` (rsync of `web/`, `node_modules` symlinked); the repo was never used as a mutation target.

Two independently launched dev servers were used for the browser A/B: **port 5211 = fixed code**, **port 5212 = `git show HEAD:web/src/lib/collections.ts`**. Distinct ports also mean distinct `localStorage` origins, which side-steps the shared-Playwright-profile contention the implementer hit (§6).

---

## 1. Acceptance criteria

### AC1 — both membership checks are own-property; no `in` operator remains — **MET**

```
$ rg -n '\bin\b' web/src/lib/collections.ts
(no matches, exit 1)
```

Note `rg -n ' in '` is a false-positive magnet in this file (`inherits`, `instead`, …). I used a word-boundary token match instead. Both named sites are own-key checks:

- `web/src/lib/collections.ts:147` — `mergeImport` `.filter((id) => hasOwnKey(papers, id))`
- `web/src/lib/collections.ts:302` — `loadState` `.filter((id) => hasOwnKey(papers, id))`

`hasOwnKey` is defined at `collections.ts:48-50`.

### AC2 — `isPaper` rejects prototype-key ids; all-malicious payload yields `papers: []`, not `null` — **MET**

`collections.ts:75` adds `!PROTOTYPE_KEYS.has(paper.id)` to the `isPaper` conjunction (`collections.ts:73-79`), and `PROTOTYPE_KEYS = new Set(["__proto__","constructor","prototype"])` at `collections.ts:40`. Because `isPaper` gates both `parseExportPayload` (`:251`) and `loadState` (`:293`), one guard covers both entry points. Verified directly (scratch):

- `__proto__`, `constructor`, `prototype` all dropped; a valid `2401.00001` sibling survives.
- An all-malicious payload returns `papers: []` (`.toEqual([])`, which distinguishes it from `null`) — asserted at `collections.test.ts:334-343`.

### AC3 — `mergeImport` never persists a `paperId` with no own snapshot — **MET**

`collections.ts:142-149`. The filter sits outside the ternary, so it applies to **both** branches — the supplied `collection.paperIds` (`:145`) and the `payload.papers.map(p => p.id)` fallback (`:146`). Verified with `["__proto__", "ghost"]` against a payload holding only `2401.00001` → `paperIds === []`.

### AC4 — regression tests naming the malicious payload — **MET**

`collections.test.ts:313-437`. The spec's payload is used verbatim: `{ "id": "__proto__", "title": "proto", "authors": [], "abstract": "x" }`, `paperIds: ["__proto__", "2401.00001"]`, round-tripped through `JSON.parse(JSON.stringify(...))` so it is a genuine parsed payload (`:369`). All three required assertions (a)(b)(c) are present at `:370-381`, plus the required second `loadState`-with-`Storage`-fake test at `:401-409`.

### AC5 — `typecheck` and `test` pass; no pre-existing expectation weakened or removed — **MET**

See §4 and §5.

---

## 2. The `Object.hasOwn` claim — VERIFIED, not invented

The implementer claimed `Object.hasOwn` is unavailable. I read `web/tsconfig.json` myself:

```
web/tsconfig.json:3  "target": "ES2020",
web/tsconfig.json:5  "lib": ["ES2020", "DOM", "DOM.Iterable"],
```

`Object.hasOwn` is declared in TypeScript's `lib.es2022.object.d.ts`. I reproduced the failure in the scratch copy with a throwaway probe (repo untouched):

```
$ printf 'export const p = (o: object) => Object.hasOwn(o, "a");\n' > src/__probe.ts && npx tsc --noEmit
src/__probe.ts(1,40): error TS2550: Property 'hasOwn' does not exist on type 'ObjectConstructor'.
Do you need to change your target library? Try changing the 'lib' compiler option to 'es2022' or later.

$ rm src/__probe.ts && npx tsc --noEmit ; echo $?
0
```

**The justification is real.** `Object.hasOwn` also exists at runtime (node v25.6.1: `typeof Object.hasOwn === "function"`), so this is purely a compile-time lib constraint. `Object.prototype.hasOwnProperty.call(map, key)` at `collections.ts:49` is the correct choice under the current config; bumping `lib` would be a repo-wide compiler change well outside this bug fix. The rationale is recorded in a doc comment at `collections.ts:42-47` so the next reader does not "upgrade" it and break the build. Correct call.

---

## 3. Independent enumeration of every membership test and object-keyed access

I enumerated **every** bracket read/write and property access in `collections.ts` mechanically and classified each:

| Line | Access | Verdict |
| --- | --- | --- |
| `49` | `Object.prototype.hasOwnProperty.call(map, key)` | safe by construction |
| `75` | `PROTOTYPE_KEYS.has(paper.id)` | safe — `Set.prototype.has` is own-value only. Empirically: `new Set().has("toString") === false` |
| `119-121` | `prunePapers`: `Object.entries(state.papers)` → `papers[id] = paper` | safe — `Object.entries` yields own enumerable keys only; key space already filtered at `:293`/`:147` |
| **`133-134`** | `mergeImport`: `hasOwnKey(papers, paper.id)` → `papers[paper.id] = paper` | read fixed; **write unguarded — see Issue 2** |
| `138` | `state.collections.some((c) => c.id === payload.collection.id)` | safe — array + `===`, no property lookup |
| `147` | `hasOwnKey(papers, id)` | safe |
| `171-180` | `renameCollection` | safe — array `.map` + `===` |
| `182-186` | `deleteCollection` | safe — array `.filter` + `!==` |
| `190-199` | `addPaper` → `{ ...state.papers, [action.paper.id]: action.paper }` | safe, and correctly so: a computed key in an object literal is `CreateDataProperty`, not `[[Set]]`. Verified: `own __proto__? true, proto intact? true`. Contrast a bare assignment: `own __proto__? false, proto intact? false` |
| `202-215` | `removePaper` | safe — array `.filter(id => id !== …)`, no record lookup |
| `228` | `state.collections.find(...)` | safe — array |
| **`233-234`** | `exportCollection`: `hasOwnKey(state.papers, id)` → `state.papers[id]` | safe — guard added ahead of the read |
| `251` | `candidate.papers.filter(isPaper).filter(hasSafeUrls)` | safe |
| **`293-294`** | `loadState`: `!PROTOTYPE_KEYS.has(id) && isPaper(paper)` → `papers[id] = paper` | safe — the `__proto__` setter is blocked before `[[Set]]` |
| `302` | `hasOwnKey(papers, id)` | safe |
| `321-322` | `saveState`: `JSON.stringify` | safe — own enumerable keys only, never invokes a setter |

**Property-kind census of `Object.prototype`** (why the write guard needs only `__proto__`):

```
constructor            data, writable (own prop created)
toString               data, writable      valueOf               data, writable
hasOwnProperty         data, writable      isPrototypeOf         data, writable
__defineGetter__       data, writable      __defineSetter__      data, writable
toLocaleString         data, writable      propertyIsEnumerable  data, writable
__lookupGetter__       data, writable      __lookupSetter__      data, writable
__proto__              ACCESSOR (setter => [[Set]] swaps prototype)
prototype              NOT an own key of Object.prototype
```

Only `__proto__` is an accessor, so it is the only key where `obj[key] = v` does anything other than create an own property. `PROTOTYPE_KEYS` covers it. `prototype` is not an `Object.prototype` key at all — dead weight, but AC2 names it verbatim, so blocking it is correct.

**The implementer audited more sites than the spec named, and each extra fix is genuine:** `:133` (`!papers[paper.id]` silently *dropped* a paper whose id was `constructor`/`toString`, since the inherited value is truthy — a real data-loss bug on the same three lines), `:233` (export leaked `Object.prototype` into the user's JSON), `:293` (the write that actually hits the setter). I verified all three by reverting to HEAD and observing the failure.

---

## 4. Is the exploit actually reachable, and does the fix close the *real* path?

**Yes — reachable, and the fix closes the real path. Verified in a real browser, both directions.**

First, the reachability question the brief flagged. The brief's parenthetical ("`JSON.parse` does NOT set `__proto__` as an own property") is **half wrong, and the implementer is right**:

```
$ node -e 'const p = JSON.parse(String.raw`{"__proto__":1,"a":2}`);
           console.log(Object.keys(p), Object.prototype.hasOwnProperty.call(p,"__proto__"),
                       Object.getPrototypeOf(p)===Object.prototype, ({}).x)'
[ '__proto__', 'a' ] true true undefined
```

`JSON.parse` uses `CreateDataProperty`, so it **does** create an own `__proto__` data property (unlike an object literal). That is what makes `impl-IMP-151.md` §3 #6 a real write vector through `rpf.papers.v1` in `localStorage`. Confirmed.

For the *import-file* path the payload arrives as an **array element** (`papers: [{id:"__proto__",…}]`), so the exploit is the membership check, not the setter — exactly as the spec describes. The crash chain is `CollectionsView.tsx:171` (`JSON.parse` of the file) → `:176 onImport(payload)` → `App.tsx:254` → `collections.ts:147` filter → `CollectionsView.tsx:42 state.papers[id]` → `PaperCard.tsx:56 paper.abstract.length`.

I drove both builds with the spec's own criterion-4 payload in Chromium via an isolated Playwright instance (`/tmp/rpf-verify-151/browser/check3.mjs`):

```
--- [port 5212 = PRE-FIX HEAD] C: spec AC4 payload (`__proto__` + sibling)
  rootChildren: 0 | cards: 0 []
  ({}).polluted: undefined | console errs: 2 | uncaught: 3
  ["TypeError: Cannot read properties of undefined (reading 'length')"]

--- [port 5211 = FIXED] C: spec AC4 payload (`__proto__` + sibling)
  rootChildren: 1 | cards: 1 ["Valid Sibling"]
  collections: [{"id":"cC","name":"Proto import","paperIds":["2401.00001"]}]
  paperKeys: ["2401.00001"]
  Object.prototype unchanged: true | ({}).polluted: undefined (clean)
  javascript: hrefs: 0 | console error/warn count: 0 | uncaught pageerrors: 0
```

`rootChildren: 0` is the whole app blanked — exactly the persistent-damage mode the spec describes. The fix turns it into a clean render with the sibling surviving. **The real path is closed, not a synthetic one.**

---

## 5. Non-vacuity of the 5 new tests — VERIFIED EMPIRICALLY

Scratch copy, `git show HEAD:web/src/lib/collections.ts` restored (a read) in place of the fixed file:

```
$ cd /tmp/rpf-verify-151 && cp collections.HEAD.ts src/lib/collections.ts && npx vitest run
 Test Files  1 failed | 4 passed (5)
      Tests  5 failed | 60 passed (65)

 × parseExportPayload > drops papers whose id is an inherited Object.prototype key
 × prototype-keyed import payloads > keeps the valid sibling and never stores an own __proto__ snapshot
 × prototype-keyed import payloads > drops a __proto__ paperId that has no own snapshot in mergeImport
 × prototype-keyed import payloads > drops every inherited Object.prototype key from loadState
 × prototype-keyed import payloads > survives a poisoned papers record in storage
 ✓ src/lib/__tests__/urlState.test.ts (18)   ✓ search.test.ts (12)
 ✓ paperIndex.test.ts (11)                   ✓ domEnvironment.test.tsx (3)
```

**Exactly 5 failed / 60 passed** — the implementer's claim is accurate. All 5 failures are the 5 new tests; all 60 pre-existing tests still pass, so the failures are the new assertions and not collateral. One sample:

```
FAIL … > survives a poisoned papers record in storage
AssertionError: expected [ '__proto__', 'constructor', …(2) ] to deeply equal [ '2401.00001' ]
- Expected  + Received
  Array [
+   "__proto__",
+   "constructor",
+   "toString",
    "2401.00001",
  ]
```

Restoring the fixed file returns the suite to 65/65.

**No existing test was weakened, skipped, or deleted.** `git diff --numstat` on the test file:

```
128	0	web/src/lib/__tests__/collections.test.ts
```

128 insertions, **0 deletions** — purely additive. The diff contains exactly one `-` line and it is the `---` file header. No `.skip`, `.only`, `.todo`, `xit(` or `xdescribe(` appears on any added line. `it(` count in the file: 21, matching 16 pre-existing + 5 new.

---

## 6. Gates — exact results

From `web/`:

```
$ npm run typecheck          # tsc --noEmit
exit 0, no output

$ npm test                   # vitest run
 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 4ms
 ✓ src/lib/__tests__/collections.test.ts (21 tests) 6ms
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests) 9ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 5ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 96ms
 Test Files  5 passed (5)
      Tests  65 passed (65)
   Duration  1.39s

$ npm run build              # tsc --noEmit && vite build
exit 0
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-BPuoeLpp.js   163.73 kB │ gzip: 52.63 kB
✓ built in 369ms
```

Baseline was **5 files / 60 tests**; now **5 files / 65 tests**. CSS byte-identical to the profile baseline (10.93 kB / gzip 2.86), confirming no styling perturbation. JS +0.18 kB over IMP-143's 163.55 kB.

---

## 7. Attempting to break the fix

### 7a. Hostile keys through the real import path (browser)

Payload A: all 11 of `__proto__`, `constructor`, `prototype`, `toString`, `valueOf`, `hasOwnProperty`, `isPrototypeOf`, `__defineGetter__`, `propertyIsEnumerable`, `toLocaleString`, `__lookupSetter__` used as **paper ids**, all 11 plus a `"ghost"` id (with no snapshot) plus a duplicated `2401.00001` in `collection.paperIds`; a nested variant with `absUrl: { __proto__: { polluted: 1 } }`; and one file **per key** driven through the real file picker on the fixed build (port 5211).

```
--- [port 5211 = FIXED] A: 11 hostile Object.prototype keys as paper ids
  rootChildren: 1 | cards: 9 ["toString paper","valueOf paper","hop paper","ipo paper",
                               "ddg paper","pie paper","tls paper","lls paper","Valid Sibling"]
  persisted paperIds: ["toString","valueOf","hasOwnProperty","isPrototypeOf","__defineGetter__",
                       "propertyIsEnumerable","toLocaleString","__lookupSetter__","2401.00001"]
  Object.prototype unchanged: true | ({}).polluted: undefined (clean)
  javascript: hrefs: 0 | console error/warn count: 0 | uncaught pageerrors: 0
```

The three `PROTOTYPE_KEYS` ids and the `ghost` id are gone. The other eight are *kept* — and correctly so: each one gets a genuine own snapshot (verified: `ownSnapshot=true, abstract=string`), so `CollectionsView.tsx:42` resolves to a real `Paper` and renders. The sibling survives. `Object.prototype` unchanged, `({}).polluted === undefined`, zero console output, app fully usable.

Same experiment on the pre-fix build, for contrast:

```
--- [port 5212 = PRE-FIX HEAD] A
  rootChildren: 0 | cards: 0 [] | console errs: 11 | uncaught: 21
  ["TypeError: Cannot read properties of undefined (reading 'length')"]
```

### 7b. Hostile keys in the storage records (unit, scratch)

For each of the 11 keys: `rpf.papers.v1` seeded with an own `{"__proto__": …}`-style entry via `JSON.stringify`, `rpf.collections.v1` naming `[key, "toString", "valueOf", "2401.00001"]`, then `loadState`. Result for every key: `Object.getPrototypeOf(loaded.papers) === Object.prototype`, `({}).polluted === undefined`, an exact descriptor-by-descriptor snapshot of `Object.prototype` **identical before and after**, and every surviving `paperId` resolving to a `Paper` with `typeof abstract === "string"` (render-safe). On the pre-fix source this same test fails with `expected { id: '__proto__', … } to be { … }` — i.e. pre-fix, the attacker's paper became the *prototype of the live papers object*. Real, and now closed.

### 7c. Hostile collection ids (unit + browser)

Every one of the 11 keys used as `collection.id`: import, `renameCollection`, `exportCollection`, `deleteCollection` all behave normally (`collections` is an array, so no property lookup occurs). `({}).polluted === undefined` throughout.

### 7d. Legitimate arXiv ids are NOT dropped

14 real id shapes — `2301.12345`, `2301.12345v2`, `hep-th/9901001`, `math.GT/0309136`, `0704.0001`, `cs/9901001`, `cond-mat/0309120`, `physics.optics/0309012`, `astro-ph/9901012`, `nucl-th/9901001`, `2501.13121v3`, `2401.00001`, `1234.56789`, `1701.00001` — all survive `isPaper` **and** `mergeImport` (`paperIds` round-trips exactly). No valid id is dropped. The only newly-rejected ids are `__proto__`, `constructor`, `prototype`, none of which can be an arXiv id.

### 7e. Normal collection behaviour — no regression

Unit (scratch), full flow: create → save 3 papers → rename (whitespace-trimmed) → remove one → export → `JSON.parse(JSON.stringify(export))` → re-import → `loadState` from a `Storage` fake. All assertions pass; export bytes are `{"version":1,"exportedAt":"2024-02-02","collection":{…,"paperIds":["2401.00001","hep-th/9901001"]},"papers":[…]}`.

Browser, against the real feed at 1280px on the fixed build:

```
after create:    [ 'Reading list' ]
after saves:     [ { n: 'Reading list', ids: [ '2610.00848', '2610.00849' ] } ]
after rename:    [ 'Renamed list' ]                       # "  Renamed list  " trimmed
after remove:    [ [ '2610.00849' ] ]   papers: 1        # snapshot pruned correctly
export filename: renamed-list.json | exported paperIds: ["2610.00849"] | exported papers: 1
after re-import: [ { n: 'Renamed list', ids: [ '2610.00849' ] } ] | cards: 1
pageerrors: 0 [] | consoleerrors: 0 []
```

Save a paper, rename a collection, remove a paper, export, re-import — all work, and `prunePapers` correctly garbage-collected the removed snapshot (2 → 1).

### 7f. Browser screenshots

Written to `.improve/artifacts/IMP-151/` (that path is gitignored):

- `verify-collections-import-proto-desktop-1280.png` — the spec's AC4 payload. Renders `Proto import (1)` with exactly the valid sibling card, `arXiv` link and `Remove` button intact, no blank regions.
- `verify-collections-11-hostile-keys-desktop-1280.png` — payload A, `Proto import (9)`.

Both at 1280px, `rootChildren: 1`, 0 pageerrors, 0 console errors. I did not overwrite the implementer's `collections-import-proto-desktop-1280.png`.

---

## 8. Issues

### Issue 1 — MEDIUM, pre-existing, **NOT fixed by this item**: `isPaper` does not validate `categories`, so an ordinary malformed export still blanks the entire app

`isPaper` (`collections.ts:68-80`) validates `id`, `title`, `authors`, `abstract` — and nothing else. `PaperCard` dereferences, unguarded:

- `PaperCard.tsx:79` — `paper.categories.map((category) => …)`
- `PaperCard.tsx:82` — `paper.primaryCategory`
- `PaperCard.tsx:73` — `paper.published` → `formatDate`

So an import whose paper omits `categories` throws `TypeError: Cannot read properties of undefined (reading 'map')`, and with no error boundary above `App` the **whole app blanks** — the identical blast radius IMP-151 exists to remove.

I proved this is not IMP-151's doing with a control payload containing **zero prototype keys**:

```
--- [port 5211 = FIXED]      B CONTROL: no hostile key, paper missing only `categories`
  rootChildren: 0 | cards: 0 | console errs: 1 | uncaught: 3
  ["TypeError: Cannot read properties of undefined (reading 'map')"]

--- [port 5212 = PRE-FIX HEAD] B CONTROL: no hostile key, paper missing only `categories`
  rootChildren: 0 | cards: 0 | console errs: 1 | uncaught: 3
  ["TypeError: Cannot read properties of undefined (reading 'map')"]
```

Byte-identical failure before and after the fix. Pre-existing, unchanged, and not covered by any IMP-151 acceptance criterion (no AC mentions `categories`) and not in the item's stated area (`PaperCard.tsx:50,56` are named for the *`abstract`* crash only). It is a real, high-impact, independently-reachable defect that needs its own backlog item: either validate `categories`/`published` in `isPaper`, or optional-chain in `PaperCard`. The spec itself flags IMP-018 (error boundary) as the symptom-blunter, which would contain this too.

Note this is exactly the gap that let my first, broader payload crash: I built it with the spec's `{id, title, authors, abstract}` shape for the hostile papers, which is precisely the shape the spec's own criterion-4 payload uses. The implementer's tests use a fully-populated `makePaper` helper for siblings, so they never exercise it.

### Issue 2 — LOW, defence in depth: `collections.ts:134` is the only remaining untrusted-key `[[Set]]` and is unguarded

`mergeImport` guards the *read* at `:133` with `hasOwnKey` but not the *write* at `:134`. `loadState`'s analogous write at `:294` **is** guarded (`:293`). Bypassing `parseExportPayload` and dispatching the reducer directly with a `__proto__`-id paper:

```
bypass -> proto swapped: true | own keys: [] | global polluted: undefined
```

i.e. `Object.getPrototypeOf(state.papers)` becomes the attacker's paper object. Mitigating facts, all measured: **no** global `Object.prototype` pollution, **no** crash, and **no** persistence (`JSON.stringify` writes own enumerable keys only, so it emits `{}`). Unreachable in the real app — the sole production caller is `CollectionsView.tsx:176 onImport(payload)` where `payload` is the non-null result of `parseExportPayload(...)` at `:171` (verified: `rg -n "handleImport|onImport"` shows one call chain). So: latent, not exploitable today, and not an AC failure (AC2 is satisfied via `isPaper`). One-token fix for symmetry with `:293`:

```ts
if (!hasOwnKey(papers, paper.id) && !PROTOTYPE_KEYS.has(paper.id)) {
```

### Issue 3 — informational, no action needed

- `CollectionsView.tsx:42` (`collection.paperIds.map((id) => state.papers[id])`) remains an unguarded read — the crash site itself. Correctly out of the implementer's file scope, and I confirmed it is now safe purely by the producer invariant. `impl-IMP-151.md` §7.1 discloses this accurately.
- `PROTOTYPE_KEYS` includes `"prototype"`, which is not an own property of `Object.prototype` at all. Harmless, and AC2 requires it verbatim.
- The implementer's browser pass was left half-finished (they stopped on shared-profile contention). I completed it on an isolated port/origin; see §4 and §7.
- `.improve/FEATURES.md:187` still reads `Status: IN-PROGRESS` for IMP-151. That file is outside both the implementer's and my permitted scope; whoever owns it should flip it to DONE and strike the now-stale profile rows noted in `discovered-IMP-151.md`.
- The brief's own premise that "`JSON.parse` does NOT set `__proto__` as an own property" is incorrect; the implementer's contrary claim is the correct one. Verified directly.

---

## 9. Summary

| Criterion | Result |
| --- | --- |
| AC1 own-property membership, no `in` operator | **MET** (`collections.ts:147`, `:302`; `rg '\bin\b'` → no matches) |
| AC2 `isPaper` rejects prototype-key ids, `papers: []` not `null` | **MET** (`collections.ts:75`) |
| AC3 no persisted `paperId` without own snapshot | **MET** (`collections.ts:142-149`, filter outside the ternary) |
| AC4 regression tests naming the malicious payload | **MET** (`collections.test.ts:313-437`) |
| AC5 gates green, nothing weakened | **MET** (typecheck 0 · 65/65 · build 0; test diff +128/−0) |

The fix is correct, minimal, and closes the real reachable path — confirmed by an A/B in a real browser against HEAD, not only by unit tests. The `Object.hasOwn` justification is real and reproducible, not invented. The five new tests are load-bearing and the diff is purely additive. No legitimate arXiv id is dropped; no normal collection behaviour regresses.

The one thing a reader should not miss: **the app is still one malformed export away from a blank page**, via `PaperCard.tsx:79` and an under-specified `isPaper` (Issue 1). That is a separate defect that this item neither introduced nor addressed, and it deserves its own backlog entry at the same priority class as IMP-151.