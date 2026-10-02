# IMP-143 — implementer report

**Item:** export + test the URL-hash state serialization (`readHash` / `writeHash`).
**Result:** done. `npm run typecheck` exit 0 · `npm test` **5 files, 60 passed** (42 pre-existing
unchanged + 18 new) · `npm run build` exit 0. Browser round-trip verified, screenshot MD5-identical
to baseline.

---

## 1. Files changed (exact list)

| File | Change |
| --- | --- |
| `web/src/lib/urlState.ts` | **new** (86 lines) — `readHash`, `writeHash`, `HashState`, `View`, `HashWriter`; named exports only |
| `web/src/lib/__tests__/urlState.test.ts` | **new** (137 lines) — 18 tests |
| `web/src/App.tsx` | modified — deleted the local `readHash`, `writeHash`, `HashState`, `View`, `DEFAULT_RECENCY`, `RECENCY_VALUES`; added one import block. `git diff --stat` = **6 insertions, 61 deletions** |

Nothing else. No git write commands. `scripts/` + `tests/` dirt in `git status` is the concurrent
Python agent's; `.improve/reports/discovered-IMP-002.md` is another agent's untracked report.

Artifacts written: `.improve/artifacts/IMP-143/feed-desktop-1280.png` and
`.improve/artifacts/IMP-143/feed-filtered-desktop-1280.png` (the directory is git-excluded via
`.git/info/exclude`, so `git status` stays clean).

## 2. Approach

**Pure move first.** `readHash`, `writeHash`, `HashState`, `View`, `DEFAULT_RECENCY` and
`RECENCY_VALUES` moved verbatim from `App.tsx` into `web/src/lib/urlState.ts`. `RecencyDays` /
`SortMode` stay in `lib/types.ts` and are imported, as the spec's Notes require. `View` had to move
too — `HashState.view` references it, and leaving a second copy in `App.tsx` would create exactly
the kind of duplicated-constant drift the profile's trap 2 warns about. `App.tsx` imports it back.

**Three signature changes, all required by the acceptance criteria.** The task brief says "do not
change behavior — only export and test"; the spec's criteria 2 and 3 make both signatures
mandatory, so I followed the spec and am flagging it here explicitly:

1. `readHash(): HashState` → `readHash(hash: string = window.location.hash): HashState`.
   Criterion 2 calls `readHash("")` / `readHash("#")`. The default preserves the existing
   zero-argument call exactly (`App.tsx` still calls `readHash()` in two places).
2. `writeHash(...): void` → `writeHash(...): { hash: string }`. Criterion 2 asserts
   `writeHash(...).hash`; criterion 3 requires the hash be returned rather than only pushed into
   history. `App.tsx` ignores the return value.
3. `writeHash` gained an optional third parameter `write: HashWriter = writeToLocation`, where
   `writeToLocation` is the original `if (mode === "push") … else …` block extracted verbatim.
   This is the spec's second sanctioned option ("or captured via an injected writer") and it is
   what makes criterion 3's "so no jsdom is required" literally true rather than aspirational.

**Why criterion 3 dictated the test environment.** The test file opens with
`// @vitest-environment node`, overriding the global `jsdom` from `vite.config.ts:8`. All 18 tests
therefore run with **no `window` in scope at all** — one test asserts `typeof window === "undefined"`
and then round-trips a full hash. That is the strongest available evidence for criterion 3. The
cost: `readHash` is always called with an explicit hash string and `writeHash` with an injected
`IGNORE_LOCATION` writer, so criterion 2's call appears as
`writeHash(readHash(h), "replace", IGNORE_LOCATION).hash`. One extra argument; the assertion is
identical.

`test-setup.ts` still loads under the `node` environment (it imports `@testing-library/react` and
registers `afterEach(cleanup)`); with nothing rendered, `cleanup()` is a no-op. Verified by
execution, not assumed.

**Test coverage (18 tests, minimum was 6).** Criterion 2's five required assertions are all
present, plus: each allowed recency window survives, unknown `view` and `sort` fall back, an empty
`#cat=` reads as an empty selection rather than the default, `#cat=cs.CV,,cs.LG` drops empty
entries, a **percent-encoded** `cat` list reads back correctly (this is the guard for `writeHash`'s
`URLSearchParams` encoding — commas come back as `%2C`), an explicit `categories: []` writes as
`#cat=`, and the writer receives both the serialized hash and the mode for each of push/replace.

## 3. Commands and results

All from `web/`, with timeouts.

```
npm run typecheck    -> exit 0, no output
npm test             -> Test Files 5 passed (5)
                        Tests     60 passed (60)
                        search 12 | collections 16 | paperIndex 11 | domEnvironment 3 | urlState 18
                        Duration  ~1.3s
npm run build        -> exit 0, 39 modules transformed (was 38)
                        dist/assets/index-<hash>.css  10.93 kB  gzip 2.86   (unchanged)
                        dist/assets/index-<hash>.js  163.55 kB  gzip 52.57  (was 163.50 / 52.55)
```

Baseline before the change, same machine, same session: `npm test` -> 4 files, 42 passed; `npm run
build` -> 38 modules, JS 163.50 kB, CSS 10.93 kB. The four pre-existing test files are untouched
(`git diff` shows zero deletions in any test file).

### Build output is NOT byte-identical — reported as required

JS grew by **54 minified bytes** (163.50 → 163.55 kB) and the module count by one. The CSS asset,
`favicon.svg`, and all three `dist/data/*.json` files are byte-identical (same SHA-256). Only
`dist/index.html` differs, and only because it references the new JS filename.

I rebuilt the pre-change tree in `/tmp` from `git show HEAD:web/src/App.tsx` and reproduced the
baseline bundle byte-for-byte (`SHA-256 d56f0a94…`, filename `index-CzjWDLvR.js`), so the
comparison below is against a verified-identical baseline. Emitted, minified:

```js
// before
const Zl=50,xc=60,Ep=[7,30,60];
function bu(){const e=window.location.hash.replace(/^#/, ""), …}
function Cp(e,t){ … t==="push"?window.location.hash=r:window.history.replaceState(null,"",r)}

// after
const xc=60,Ep=[7,30,60];                      // Zl=50 (=50) emitted later, after the module boundary
function bu(e=window.location.hash){const t=e.replace(/^#/, ""), …}   // default param
function Cp(e,t){…}                              // the extracted default writer, body identical
function _p(e,t,n=Cp){ …const l=`#${r.toString()}`;return n(l,t),{hash:l}}  // 3rd param + return
```

Every hunk is one of the three signature changes above or a module-boundary artifact. The
parsing/serialization logic is character-for-character the same. This is the "export surface" delta
the task brief predicted, and it is why the JS asset hash changed.

### Browser round-trip (spec's verification method)

`npm run dev -- --port 5199 --strictPort`, Playwright at 1280×900. Console clean — zero messages,
no `console.error`, no failed request.

| Action | Resulting hash | history.length |
| --- | --- | --- |
| load `#q=diffusion&cat=cs.CV,cs.LG&recency=7&sort=relevance` | restored verbatim; chips/recency/sort/149-match count all correct | — |
| toggle `cs.AI` on | `#q=diffusion&cat=cs.CV%2Ccs.LG%2Ccs.AI&recency=7&sort=relevance` | 2 (replace) |
| switch to Collections | `#view=collections&q=diffusion&cat=…&recency=7&sort=relevance` | 3 (**push**) |
| reload that URL | Collections view restored from the hash | — |
| load bare `#` | all defaults restored: 60 days, Newest, every category pressed, 2,812 match | — |

Push/replace semantics are unchanged: view switches push, filter changes replace.

`.improve/artifacts/IMP-143/feed-desktop-1280.png` is **MD5-identical** to
`.improve/artifacts/baseline/baseline-feed-desktop-1280.png`
(`4b6b8c709a9f7c0ce3eb579ab1580886`).

## 4. Uncertain / for the verifier and the coordinator

1. **`writeHash`'s default writer has no unit test.** Under the `node` environment nothing exercises
   `writeToLocation`. Its body is a verbatim extraction and the browser check above covers it, but a
   jsdom-env file asserting `window.location.hash` after `"push"` and an unchanged `history.length`
   after `"replace"` would close this properly. **Recommendation: IMP-008 / IMP-132 / IMP-133
   should add it** — they are the items that build on this module.
2. **`// @vitest-environment node` is a per-file override of the global `jsdom`** that IMP-005
   established. It is load-bearing for criterion 3; do not let a future config cleanup strip it
   without moving these assertions.
3. **Stale references in `REPO_PROFILE.md` that this item invalidates** (I did not edit the
   profile — out of my scope): §5.3's "Routing is a hand-rolled `location.hash` parser —
   `readHash()` (`:38`) and `writeHash()` (`:61`)", the constants list at §5.3
   (`DEFAULT_RECENCY = 60` (`App.tsx:25`), `RECENCY_VALUES` (`App.tsx:26`)), bug **WEB-37**
   (`App.tsx:38, 61`) — that row is now fixed and should be struck or annotated, and WEB-33 /
   WEB-34 / WEB-36 / WEB-14 / WEB-15 / WEB-16 all cite `App.tsx` line numbers for code that has
   moved to `web/src/lib/urlState.ts`.
4. **`dist/index.html` changed hash** purely because the JS asset filename changed. Not a content
   regression.

## 5. Out-of-scope finding

One genuine defect surfaced during the browser check and is written up in
`.improve/reports/discovered-IMP-143.md` — `applyState` in `App.tsx` clobbers itself when two
filter changes land in the same React tick. Not fixed here.