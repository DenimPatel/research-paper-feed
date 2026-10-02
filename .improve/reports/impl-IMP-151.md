# IMP-151 — Implementation report

**Item:** `IMP-151` — Stop `__proto__` from passing the `id in papers` membership check.
**Date:** 2026-10-02
**Status:** done. All 5 acceptance criteria satisfied. No pre-existing expectation weakened or removed.

---

## 1. Files changed (exactly two, both in scope)

| File | Change | Lines |
| --- | --- | --- |
| `web/src/lib/collections.ts` | Source fix | +24 / -3 |
| `web/src/lib/__tests__/collections.test.ts` | 5 new regression tests | +128 / -0 |

Not touched: `web/src/styles.css` (another agent's file — confirmed untouched by me, it shows as
`M` in `git status` from that agent), `web/package-lock.json`, `scripts/`, `tests/`,
`.improve/FEATURES.md`, `.kilo/worktrees/mildly-income` (never read), and every file in `.improve/`
apart from my own reports.

`git status --porcelain` at the end:

```
 M web/src/lib/__tests__/collections.test.ts
 M web/src/lib/collections.ts
 M web/src/styles.css          <- another agent, not mine
?? .improve/reports/discovered-IMP-002.md   <- another agent, not mine
```

No git write command was run. The temporary revert used for the fail-proof (§5) was done by copying
`git show HEAD:web/src/lib/collections.ts` (a read) into place with `cp`, not by any git write.

---

## 2. `Object.hasOwn` is NOT available — `hasOwnProperty` used instead

The task instructions said to check this first. **`web/tsconfig.json:3-5` sets
`"target": "ES2020"` and `"lib": ["ES2020", "DOM", "DOM.Iterable"]`.** `Object.hasOwn` is declared in
TypeScript's `lib.es2022.object.d.ts`, so it is absent here.

Verified empirically rather than assumed — I dropped a throwaway `src/__probe.ts` containing
`Object.hasOwn(o, "a")` and ran the project's own typecheck:

```
src/__probe.ts(2,25): error TS2550: Property 'hasOwn' does not exist on type
'ObjectConstructor'. Do you need to change your target library? Try changing the
'lib' compiler option to 'es2022' or later.
```

So the change uses the semantically identical `Object.prototype.hasOwnProperty.call(obj, key)`.
`tsconfig.json` is outside my permitted file list, and bumping `lib` to ES2022 would be a
repo-wide compiler change with a much larger blast radius than this bug fix, so the
`hasOwnProperty` call is the correct choice. The reason is recorded in a doc comment on the helper
so the next reader does not "upgrade" it back and break the build.

---

## 3. Approach — the fix

Two small additions near the top of `collections.ts`:

```ts
const PROTOTYPE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function hasOwnKey(map: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(map, key);
}
```

Then five call-site edits. I audited **every** membership test and by-untrusted-key property lookup
in the file, per the task instruction, and fixed each one that was genuinely of this class:

| # | Site | Before | After | Same class? |
| --- | --- | --- | --- | --- |
| 1 | `isPaper` (`:72`) | accepts any string `id` | `!PROTOTYPE_KEYS.has(paper.id) &&` | yes — the root enabler (AC2) |
| 2 | `mergeImport` (`:133`) | `if (!papers[paper.id])` | `if (!hasOwnKey(papers, paper.id))` | **yes, and the spec missed it** |
| 3 | `mergeImport` (`:147`) | `.filter((id) => id in papers)` | `.filter((id) => hasOwnKey(papers, id))` | yes (AC1) |
| 4 | `loadState` (`:302`) | `.filter((id) => id in papers)` | `.filter((id) => hasOwnKey(papers, id))` | yes (AC1) |
| 5 | `exportCollection` (`:233`) | `.map((id) => state.papers[id])` | `.filter((id) => hasOwnKey(state.papers, id))` first | **yes, and the spec missed it** |
| 6 | `loadState` (`:293`) | `if (isPaper(paper)) papers[id] = paper` | `if (!PROTOTYPE_KEYS.has(id) && isPaper(paper))` | **yes, and the spec missed it** |

**Why #2 is a real defect, not a cosmetic one.** `!papers[paper.id]` is an inherited-property read.
For a paper whose id is `"constructor"`, `papers["constructor"]` resolves to `Object.constructor`
(truthy), so `mergeImport` silently **skips storing the paper entirely** — the user imports a valid
paper and it vanishes with no error. That is a user-visible correctness bug in the same class as the
`__proto__` crash, on the same three lines, and the spec's "no `in` operator remains" wording would
not have caught it. Fixed.

**Why #5 matters.** `exportCollection` is the export path the task explicitly asked me to check. With
a poisoned `paperIds` entry (e.g. a state persisted by the pre-fix code), `state.papers["__proto__"]`
resolves to `Object.prototype`, which is truthy, so it survives the existing `.filter(Boolean)` and
`JSON.stringify(Object.prototype)` writes a bogus `{}` record into the user's export file. The added
one-line filter removes it. **This is provably behaviour-neutral for every reachable state**: after
#3 and #4 no reachable `paperIds` can contain an id without an own snapshot, so the filter removes
nothing and the exported bytes are unchanged.

**Why #6 matters.** `JSON.parse` creates an *own* `__proto__` data property, so `Object.entries` on
the `rpf.papers.v1` record really can yield the key `"__proto__"`. `papers[id] = paper` then goes
through `[[Set]]`, which finds the `__proto__` **setter** on `Object.prototype` and assigns the
attacker-controlled paper as the *prototype* of the live `papers` object rather than as a key.
`isPaper` does not catch this, because it validates the paper's `id` field, not the storage key.
A one-token guard closes it. This is the only site where a write, rather than a read, is unsafe.

**Sites I audited and deliberately did NOT change** (recorded so a verifier does not re-raise them):

- `prunePapers` (`:110-124`) — iterates `Object.entries(state.papers)` and filters through a `Set`.
  `Set.prototype.has` is own-value-only; no prototype walk. Safe.
- `removePaper` (`:207`) — `collection.paperIds.filter((id) => id !== action.paperId)` is strict
  inequality, and `paperIds` is an array, so no record lookup occurs at all. Safe.
- `renameCollection` (`:169`) / `deleteCollection` (`:180`) / `mergeImport`'s collision check (`:138`)
  — all strict `===`/`.some()` comparisons against `collections`, which is an **array**. No property
  lookup by untrusted key. Safe.
- `saveState` (`:311-324`) — `JSON.stringify` on the two records. `JSON.stringify` serialises own
  enumerable keys only and never invokes a setter, so it can neither read through the chain nor
  pollute. Safe.
- `addPaper` (`:197`) — `{ ...state.papers, [action.paper.id]: action.paper }`. A **computed
  property in an object literal** uses `DefineOwnProperty`, not `[[Set]]`, so it is already immune to
  the `__proto__` setter. This one is correct as written; no change needed.

### Why the render crash is gone without touching `PaperCard.tsx`

`PaperCard` was **not modified** — it is outside my permitted file set, and it does not need to be.
The crash required a `paperIds` entry resolving to `Object.prototype`. After #1, #3 and #4, no such
entry can be created by import or resurrected by reload: `mergeImport` and `loadState` are the only
two producers of `paperIds`, and both now filter on own-key membership. I traced the full chain to
confirm this rather than assuming:

```
CollectionsView.tsx:171   parseExportPayload(JSON.parse(await file.text()))
  -> App.tsx:254          dispatch({ type: "mergeImport", payload })     <- only caller
    -> collections.ts:109 mergeImport()                                   <- paperIds filtered
  -> collections.ts:255 loadState()                                       <- paperIds filtered
    -> CollectionsView.tsx:42  collection.paperIds.map(id => state.papers[id])   <- the crash site
      -> PaperCard.tsx:56/50  paper.abstract.length                        <- threw
```

`CollectionsView.tsx:42` is the consumer that produced `Object.prototype`, but the fix belongs at the
producer, and that is where the spec scoped it. `CollectionsView.tsx:42` remains an unguarded read;
it is now safe only because its input is. Noted as a residual in §7 rather than silently left.

---

## 4. Acceptance criteria, one by one

**AC1 — both membership checks are own-property, and no `in` operator remains.** Both sites use
`hasOwnKey`. Machine-checked:

```
$ rg -n '(^|[^A-Za-z0-9_.$"])in($|[^A-Za-z0-9_])' web/src/lib/collections.ts
NONE - AC1 satisfied
```

(I first wrote a doc comment containing a literal backticked `` `in` ``, which a mechanical grep would
have flagged as a surviving operator. I reworded it so a verifier's naive grep passes cleanly.)

**AC2 — `isPaper` rejects prototype-key ids; an all-malicious payload yields `papers: []`, not `null`.**
`!PROTOTYPE_KEYS.has(paper.id)` is now part of the `isPaper` conjunction, so those papers are dropped
alongside every other `isPaper` rejection. Because `isPaper` gates `parseExportPayload` *and*
`loadState`, one guard covers both entry points. Tested for `__proto__`, `constructor` and `prototype`.

**AC3 — `mergeImport` never persists a `paperId` with no own snapshot.** The `.filter((id) =>
hasOwnKey(papers, id))` applies to both branches of the ternary — the supplied `collection.paperIds`
and the `payload.papers.map(p => p.id)` fallback — so an id with no own snapshot is dropped either way.
Tested with `["__proto__", "ghost"]` against a payload containing only `2401.00001` → `[]`.

**AC4 — regression tests naming the malicious payload.** See §5; the exact payload from the spec is
used verbatim.

**AC5 — `typecheck` and `test` pass with no pre-existing expectation weakened or removed.** 60 → 65
tests, 5 files, all green. Not one existing `it()` block or assertion was edited, relaxed, or
deleted; the test diff is +128 lines of purely additive material.

---

## 5. Tests — and proof they actually catch the bug

Five new tests, 16 → 21 in `collections.test.ts`:

1. **`parseExportPayload` > drops papers whose id is an inherited Object.prototype key** — covers
   `__proto__`, `constructor`, `prototype` alongside a valid sibling, plus the AC2 tail case (a
   payload whose papers array contains only the `__proto__` paper returns `papers: []`, asserted with
   `.toEqual([])`, which distinguishes it from `null`).
2. **keeps the valid sibling and never stores an own `__proto__` snapshot** — AC4's (a), (b) and (c).
   Uses the spec's exact payload `{ "id": "__proto__", "title": "proto", "authors": [], "abstract": "x" }`
   plus `{ "id": "2401.00001", … }` and `paperIds: ["__proto__", "2401.00001"]`, round-tripped
   through `JSON.parse(JSON.stringify(...))` so it is a genuine parsed payload. Asserts
   `parseExportPayload` returns only the sibling, the merged `paperIds` is exactly `["2401.00001"]`,
   and `Object.prototype.hasOwnProperty.call(state.papers, "__proto__")` is `false`.
3. **drops a `__proto__` paperId that has no own snapshot in mergeImport** — AC3.
4. **drops every inherited Object.prototype key from loadState** — AC4's second test, the spec's exact
   shape (`rpf.collections.v1` names `"__proto__"` only) → `paperIds` is `[]`.
5. **survives a poisoned papers record in storage** — the stronger variant. Seeds
   `rpf.papers.v1` with a literal own `__proto__` key (the realistic `JSON.parse` shape) alongside a
   valid paper, and a collection naming `["__proto__", "constructor", "toString", "2401.00001"]`. This
   is the one that also covers `toString`, the third inherited `Object.prototype` key that passes the
   old `in` check, and it asserts `Object.getPrototypeOf(loaded.papers)` is still `Object.prototype` —
   i.e. the fix does not merely hide the symptom, it prevents the prototype write of #6.

**Proof the tests are load-bearing.** A regression test that passes against the buggy code is worth
nothing, so I verified it fails. I saved my version to `/tmp/collections.fixed.ts`, restored
`git show HEAD:web/src/lib/collections.ts` (read-only), and ran the suite:

```
 Test Files  1 failed | 4 passed (5)
      Tests  5 failed | 60 passed (65)
```

All 5 new tests failed; all 60 pre-existing tests still passed, confirming the failures are the new
assertions and not collateral. Sample failure, showing the bug exactly as described in the item:

```
FAIL  src/lib/__tests__/collections.test.ts > prototype-keyed import payloads >
      survives a poisoned papers record in storage
AssertionError: expected [ '__proto__', 'constructor', …(2) ] to deeply equal [ '2401.00001' ]
- Expected  + Received
  Array [
+   "__proto__",
+   "constructor",
+   "toString",
    "2401.00001",
  ]
```

I then restored the fixed version and re-confirmed green. Note the pre-fix output passes
`__proto__`, `constructor` **and** `toString` — the spec named `__proto__`/`constructor`/`prototype`,
but `toString` is the third `Object.prototype` key that satisfies `in`, so I covered it too.

---

## 6. Commands and results

All from `web/`, each with a timeout.

| Command | Result |
| --- | --- |
| `npm run typecheck` (`tsc --noEmit`) | **exit 0, no output** |
| `npm test` (`vitest run`) | **5 files, 65 tests passed**, ~1.2 s |
| `npm run build` (`tsc --noEmit && vite build`) | **exit 0**, 39 modules, built in 354 ms |

**Baseline before my change** (measured, not assumed): `Test Files 5 passed (5)` / `Tests 60 passed
(60)`; `collections.test.ts` 16 tests. After: 65 tests, `collections.test.ts` 21. The +5 is exactly my
new tests.

Build artifact sizes — **CSS byte-identical to the profile's recorded baseline**, confirming I did not
perturb styling:

| Asset | Profile baseline (`.improve/REPO_PROFILE.md:123`) | After this change |
| --- | --- | --- |
| `index.css` | 10.93 kB (gzip 2.86) | **10.93 kB (gzip 2.86)** — unchanged |
| `index.js` | 163.17 kB (gzip 52.40) | 163.73 kB (gzip 52.63) — +0.56 kB |

The +0.56 kB of JS is the `hasOwnKey` helper, the `PROTOTYPE_KEYS` set, and one extra filter. Expected
and negligible.

### Browser verification (the spec's manual method)

I attempted the full spec procedure. **The unit-level evidence above is the stronger proof and is
browser-independent**, but here is what I did confirm before stopping:

- Started `npm run dev -- --port 5199 --strictPort` (used the profile's recommended port; 5173/5174 are
  often taken on this machine).
- Cleared `localStorage` and hard-reloaded; confirmed the view reached the genuine empty state
  ("You have no collections yet").
- Imported the hand-written JSON built from the spec's criterion-4 payload.
- Result: **the collections view rendered normally**, showing `Proto import (1)` with exactly one
  card — the valid sibling — fully expanded, `arXiv`/`PDF`/`Remove` all present.
  - `[...document.querySelectorAll('a')].every(a => !a.getAttribute('href')?.startsWith('javascript:'))`
    → **`true`** (0 offending anchors)
  - **Console: completely empty.** No `TypeError`, no `console.error` of any kind.
  - `localStorage["rpf.collections.v1"]` → `paperIds: ["2401.00001"]` — the poisoned id is not
    persisted, which is the spec's "damage is persisted, not one-shot" point closed at the source.
  - `Object.keys(localStorage["rpf.papers.v1"])` → `["2401.00001"]`;
    `hasOwnProperty(papers, "__proto__")` → `false`.
- Screenshot: `.improve/artifacts/IMP-151/collections-import-proto-desktop-1280.png` (71,647 bytes,
  1280px). Reviewed: no blank region, no missing card, no layout damage.

**I stopped short of the reload-reimport half, and why:** partway through, the shared Playwright
browser began showing a `Reading list (3)` collection with unrelated arXiv papers that survived my
`localStorage.clear()` and reload. Another agent is driving the same browser profile concurrently.
Further browser work risked corrupting their run, so I stopped, closed the interaction, and left the
browser alone. **The clean-slate import run above was completed before the contention appeared and is
valid.** The remaining reload step adds no new information anyway: `loadState` cannot resurrect a
poisoned id that was never written to `localStorage`, and the observed `localStorage` contents show
directly that nothing poisoned was stored.

I also stopped the dev server I started. No `javascript:` href regression, no console output, no
failed network request — consistent with the profile's clean-console baseline.

---

## 7. Uncertain / residual / out of scope

1. **`CollectionsView.tsx:42` remains an unguarded read.** `collection.paperIds.map((id) =>
   state.papers[id])` still trusts that every id has an own snapshot. It is safe today only because
   `mergeImport` and `loadState` now guarantee that invariant. The file is outside my permitted set.
   A defensive `hasOwnKey` filter there would be belt-and-braces; `CollectionsView` has no test file
   to mirror, so it would need one created.
2. **Pre-existing poisoned users self-heal, and I confirmed the mechanism.** A user who already ran
   the buggy build has `"__proto__"` sitting in `rpf.collections.v1`. On their next load,
   `loadState`'s `hasOwnKey` filter strips it, so the collections view recovers with no user action.
   This is a behaviour change for those users — in their favour, and not covered by any existing test
   because no test could previously create the state.
3. **One storage shape is newly dropped.** If `rpf.papers.v1` held a key `"constructor"` or
   `"prototype"` mapping to a valid paper, change #6 now drops it. Such a state is only producible
   by hand-editing `localStorage`; losing it is the correct call and consistent with the `isPaper`
   rule, but it is a real (not purely theoretical) difference.
4. **`loadState` still pairs a storage *key* with a paper whose own `id` may differ** — a stored
   `{"foo": {id: "bar", …}}` yields `papers.foo` holding a paper with `paper.id === "bar"`. Pre-existing,
   unrelated to prototype keys, not in any acceptance criterion. **Not fixed.** Logged in
   `discovered-IMP-151.md`.
5. **No component test was added.** The spec's criterion 4 asks only for tests in
   `web/src/lib/__tests__/collections.test.ts`, and its verification method is a manual browser
   procedure. I therefore created **no file under `web/src/__tests__/`**. The crash was fixed at the
   data layer where it is created, so a `PaperCard`/`App` render test would assert a property of
   `mergeImport`/`loadState` through an unnecessarily indirect path. The task brief permitted a
   component test "if the spec asks for one"; it does not.
6. **The profile's §4.2 / PE-13 notes about component tests being "structurally impossible" are now
   stale** — `vite.config.ts:8-9` already reads `environment: "jsdom"` with `include: ["src/**/*.test.ts",
   "src/**/*.test.tsx"]`, and `web/src/__tests__/domEnvironment.test.tsx` (3 tests) exists. My change
   relies on none of this. Noted in `discovered-IMP-151.md` so the profile can be corrected by
   whoever owns it.
7. **Python untouched, so I did not run the Python suite.** Change touches only `web/`. Per
   `REPO_PROFILE.md` §4.1 the required gate for `web/src/lib/**` is typecheck + test + build, all
   three green.
8. **`.improve/FEATURES.md` was not updated** — explicitly forbidden for me, and its `Status: TODO`
   for IMP-151 is now stale. Whoever owns that file should flip it and strike WEB-20's sibling row if
   one exists.