# IMP-015 — Independent verification

**Verifier:** independent sub-agent (did not write this change)
**Date:** 2026-10-02
**Scope reviewed:** `web/src/lib/paperIndex.ts`, `web/src/App.tsx`,
`web/src/lib/__tests__/paperIndex.test.ts`, `web/src/__tests__/App.partialShard.test.tsx`
**Verdict: PASS** — all 5 acceptance criteria met; the code is correct.

Two real defects were found, both in the **implementer's report's evidence**, not in the code:
a misstated test baseline/delta and a misstated non-vacuity count. And one genuine
UX weakness (the missing-shard name is invisible on touch/mobile). Details in §9.

---

## 1. Acceptance criteria

### AC1 — `loadPapers` resolves with the papers from every shard that loaded and returns the failures alongside them; the return type change is made explicitly, not inferred at the call site.

**MET.** `web/src/lib/paperIndex.ts:220` replaces `Promise.all` with `Promise.allSettled`.
Each shard's success path pushes papers and `++loaded`; each rejection pushes
`{ file, message }` into `failedFiles` and leaves the loaded count alone
(`paperIndex.ts:220-245`). `PapersLoadResult` is an **explicitly declared named type**
at `paperIndex.ts:40-43`:

```ts
export type PapersLoadResult = Paper[] & {
  papers: Paper[];
  failedFiles: ShardLoadFailure[];
};
```

`App.tsx:168-176` consumes it through the declared type
(`const list: PapersLoadResult = await index.loadPapers(days); setPapers(list);`), so the
type change is stated in the signature, not inferred. `App.tsx:92` adds
`const [failedShards, setFailedShards] = useState<ShardLoadFailure[]>([])`.

This is a third shape (neither a second return value nor a literal
`{ papers, failedFiles }`), but it is explicit and it exposes both accessors, which is what
the criterion is protecting.

### AC2 — The app renders a non-blocking warning naming the missing shard.

**MET.** `App.tsx:488-518` renders, inside the feed branch (i.e. only when there is a feed
to show), `failedShards.length > 0 && <p className="banner banner--error" role="alert" …>`.
It does not replace or block the feed. The missing shard is named in the `title`
attribute (`App.tsx:505-508`).

Verified in a real browser (see §7): with `papers-2026-W39.json` blocked the feed still
renders 2 549 papers from `papers-2026-W40.json` with 50 cards, and the notice's accessible
name is `papers-2026-W39.json: Failed to load papers-2026-W39.json (HTTP 503).`
— the shard **is** named. Screenshots:
`.improve/artifacts/IMP-015/verify-partial-shard-desktop-1280.png`,
`verify-partial-shard-mobile-390.png`.

**Weakness (not a criterion failure — see §9.1):** on a touch viewport the `title`
attribute produces no tooltip, so at 390px the missing shard name is unreachable for a
mobile user. `verify-partial-shard-mobile-390.png` shows the prose with no shard name
anywhere on screen.

### AC3 — A manifest failure still fails the load as a whole: there is nothing to show without the shard list. A total shard failure keeps failing loudly, so nothing is shown as complete when it isn't.

**MET.** `paperIndex.ts:203-207` still calls `fetchManifest` (which throws on a bad
manifest) *before* `Promise.allSettled`, so a manifest failure still rejects
`loadPapers` outright. Total shard failure: `paperIndex.ts:247-251`

```ts
if (total > 0 && failedFiles.length === total) {
  throw firstReason ?? new Error("Every shard in this window failed to load.");
}
```

Guarded by tests at `paperIndex.test.ts:404-421` (all shards fail → rejects) and
`:436-459` (manifest fails → rejects). Browser-confirmed in §7.4.

**Behaviour change worth noting (an improvement, not a regression):** HEAD's `Promise.all`
rejected on the *first* temporal rejection; the new code throws `firstReason`, the first
failure **in manifest order**, which is deterministic. Also, `allSettled` consumes the
rejections of the sibling shards instead of leaving them as unhandled promise rejections.
Browser console during the total-failure run showed only the two expected 503 resource
errors and no unhandled rejections.

### AC4 — A shard that loads but returns nothing usable (an empty or corrupt file) does not take the feed down; the app still shows the papers it has.

**MET.** The success path only pushes when `data.papers` is a non-empty array:
`paperIndex.ts:227-232` (`if (Array.isArray(data?.papers) && data.papers.length > 0)`).
A 404, a 500, a malformed body, and an empty file all fall into the same non-fatal
`failedFiles` branch. Covered by `paperIndex.test.ts:378-402` (malformed body) and
`:461-478` (empty manifest → empty result, no throw). Browser-confirmed: blocking one
shard left 2 549 papers from the other shard rendering.

### AC5 — A manual reload is not the only way out: an in-page retry or at least an unambiguous signal that the feed is incomplete.

**MET.** Two independent in-page signals, both browser-verified:
1. The notice itself, which says the feed below is incomplete (§7.2, §7.5).
2. Changing the recency window re-runs the whole load and retries failed shards
   (§7.3: shard requests went 2 → 4 after one chip click, and the feed went back to
   2 812 papers with the notice gone). Failed shards are not negatively cached — see §5.

---

## 2. THE MOST IMPORTANT CHECK — the total-failure path

### What the user actually sees

Manifest loads fine; every shard fetch fails (shard files deleted between deploys, or a
CDN outage hitting only `/data/`). Real browser, both shards injected as HTTP 503:

```
role="alert"  class="banner banner--warning"
text:         "Failed to load papers-2026-W40.json (HTTP 503)."
then:         "No papers are available in this window yet."   (dashed empty state)
buttons on screen: Feed, Collections, All, cs.CV, cs.LG, cs.CL, cs.AI, cs.RO,
                  7 days, 30 days, 60 days, Newest, Relevance
```

- **No "Try again" button.** `.panel--error` is absent.
- **No shard notice.** Correct — the notice is deliberately `failedShards.length > 0`
  gated inside the feed branch, and a total failure never gets there. No
  double-announcement.
- **A false claim.** "No papers are available in this window yet" is untrue; 2 812 papers
  exist. This is `REPO_PROFILE.md` WEB-03 / IMP-016's debt.
- Screenshot: `.improve/artifacts/IMP-015/verify-all-shards-failed-desktop-1280.png`.

### Is it a dead end?

**Appears to be — but the user can in fact recover in-page.** A recency chip click re-runs
`loadPapers`, which retries the failed shards. Probe result:

```
PROBE_RETRY {"recencyChipPresent":true,"shardRequestsBefore":2,
             "shardRequestsAfter":4,"retriedWithoutReload":true,
             "feedRecovered":true,"alertCountAfter":0}
```

Nothing on screen tells the user this exists, so in practice it reads as a dead end. But
it is not one.

### Is it this item's fault? NO — it is byte-for-byte pre-existing.

I rendered the identical scenario against HEAD's `App.tsx` **and** the new `App.tsx` in
scratch copies (`/tmp/rpfv-c0/web`, `/tmp/rpfv-probe/web`, probe
`src/__tests__/zztotal.test.tsx`). Every field matches exactly:

| | HEAD | new |
|---|---|---|
| `alertCount` | 1 | 1 |
| `alert[0].class` | `banner banner--warning` | `banner banner--warning` |
| `alert[0].tag` | `P` | `P` |
| `alert[0].text` | `Failed to load papers-2024-W09.json (HTTP 503).` | identical |
| `buttonCount` | 9 | 9 |
| `buttonLabels` | `["Feed","Collections","All","7 days","30 days","60 days","Newest","Relevance", …]` | identical |
| `hasTryAgain` | `false` | `false` |
| `hasPanelError` | `false` | `false` |
| `hasNoPaperIndexYet` | `false` | `false` |
| `bodyText` | identical, incl. `No papers are available in this window yet.` | identical |

Root cause in HEAD, confirmed with `git show HEAD:web/src/App.tsx` (line 408 of that
revision): the error panel — the only home of the "Try again" button — is gated on
`!manifest && error`. With a manifest present it can never render. This item did not
touch that gate; `App.tsx:405` still reads `!manifest && error`, unchanged.

### Is it a regression against IMP-007?

**No.** IMP-007's spec is explicitly scoped to that panel. `.improve/FEATURES.md` IMP-007
AC1: *"The error panel renders a focusable `<button>` labelled 'Try again'. If the same
manifest fetch fails twice, the panel explains how to get the site's…"*. Its AC2
additionally blesses `title` for technical detail, which this item uses. IMP-007 landed as
`ac1fae2 feat(web): add a Try again button to the index-unavailable panel` — the
index-unavailable panel, i.e. the manifest-failure case. It never claimed to cover a
manifest-present paper-load failure. Verified live (§7.4): with the manifest blocked the
panel renders with a working "Try again" that recovers to the full 2 812-paper feed.

**Verdict on the implementer's disclosure:** accurate and correctly attributed as
IMP-016's debt. This is a pre-existing UX debt, not a defect in IMP-015. It should be
filed against IMP-016, which already owns WEB-03.

---

## 3. Other failure-mode checks

| Check | Result | Evidence |
|---|---|---|
| Manifest failure stays fatal | PASS | `paperIndex.ts:203-207`; test `paperIndex.test.ts:436-459`; browser §7.4 |
| One shard failing is not fatal | PASS | test `:378-402`; browser: 2 549 papers, 50 cards |
| Surviving shards still render | PASS | browser §7.2, `verify-partial-shard-desktop-1280.png` |
| `failedFiles` notice names the failed shards | PASS | browser §7.2; `title` = `papers-2026-W39.json: …` |
| `failedFiles` survives on the result | PASS | probe `PROBE_A` → `failedFiles=["papers-2024-W08.json"]` |
| Result still works as `Paper[]` | PASS | probe `PROBE_A` (below) |
| Failed shards retried on the next call | PASS | test `:498-528`; probe `PROBE_E` |
| Partial → full success clears the notice | PASS | test `App.partialShard.test.tsx:330-356`; browser §7.3 |

### `PapersLoadResult` runtime probe (`/tmp/rpfv-probe/web/src/__tests__/zzprobe.test.tsx`)

```
PROBE_A
Array.isArray=true
length=1
result===result.papers=true          <- identity is stable, the trap is not a copy
failedFiles=["papers-2024-W08.json"]
spreadLen=1  mapLen=1  forEach=1  iterator=1
Object.keys=["0"]                    <- non-enumerable, so JSON/keys see a plain array
JSON.stringify=[{...}]               <- serializes as a plain array
propDesc.enumerable=false  configurable=false  writable=false
structuredClone.isArray=true
structuredClone.failedFiles=undefined      <- DROPPED
jsonRoundTrip.failedFiles=undefined        <- DROPPED
objSpread.isArray=false  objSpread.failedFiles=undefined
concat.isArray=true   slice.failedFiles=undefined  filter.failedFiles=undefined

PROBE_B toEqualWithPlainArray=true            <- vitest toEqual hides the extra props
PROBE_B inlineSnapshot=[{...}]                <- snapshotting hides the failure signal

PROBE_C rendered="len=1"                      <- React props fine

PROBE_D rewrapThrew="TypeError: Cannot redefine property: failedFiles"

PROBE_E firstThrew="Failed to load papers-2024-W09.json (HTTP 503)."
PROBE_E secondResult="papers-2024-W09.json-p,papers-2024-W08.json-p"
PROBE_E secondThrew=""
```

**Judgement on the sharp edges.** All three hold exactly as the implementer disclosed, and
all three are unreachable from the current codebase, which I confirmed by grepping:

- `structuredClone` — `grep -rn "structuredClone\|postMessage\|new Worker\|Object.assign(" web/src` → **no hits**. There is no structured-clone boundary anywhere in the app.
- `JSON.stringify` round-trip — the only serialization of papers is `App.tsx:344`
  (`JSON.stringify(payload)` for collection export), and `payload.papers` is built from
  the `collections` state (localStorage), **not** from the `loadPapers` result. Verified at
  `App.tsx:334-344`. Individual `Paper` objects are plain objects from `JSON.parse`, so
  they carry no hidden props.
- `{...papers}` / `.slice()` / `.filter()` — the only consumers are `App.tsx:224`
  (`papers.filter(...)`, which only needs elements) and `App.tsx:580`
  (`papers.length === 0`). Neither needs `failedFiles`.
- `papersResult` re-entrancy — only one call site exists (`paperIndex.ts:243`), inside
  `loadPapers`, so `defineProperties` never runs on an already-wrapped array.

So the trick is safe *today*. It is a latent trap, and the honest framing is: this design
is only correct while the signal is consumed at exactly one boundary. `REPO_PROFILE.md`
§5.6 covers the non-vacuous-test discipline for this, and the 9 new library tests do assert
`failedFiles` explicitly rather than relying on array shape — good. Two notes for IMP-016
(which per its own spec owns the "empty-window message" work): the `structuredClone` drop
should be recorded there as a known constraint, and the vitest-`toEqual` drop means a test
that asserts only on the array will silently ignore a regression in `failedFiles`.

---

## 4. Test non-vacuity — INDEPENDENT COUNTS

Scratch copies under `/tmp`, real `node_modules` symlinked, all HEAD sources restored via
`git show HEAD:…`.

| Variant | Setup | Result |
|---|---|---|
| `/tmp/rpfv-c0` | full HEAD (all 4 files, new test file deleted) | **167 tests / 11 files** |
| `/tmp/rpfv-c2` | HEAD `App.tsx` + new `paperIndex.ts` | `App.partialShard` → **6 failed / 2 passed (of 8)** |
| `/tmp/rpfv-c1` | HEAD `paperIndex.ts` + new `App.tsx` | `paperIndex.test` → **7 failed / 18 passed (of 25)** |

### Claim 1: "6 of 8 new app-level tests fail against the pre-change `App.tsx`" — **CORRECT**

```
× renders the surviving week and says the feed is incomplete
× names the missing shard without leaking the raw failure into the text
× clears the notice when a later window loads completely
× still surfaces an error when every shard in the window fails
× shows both as separate alerts and announces neither twice
× keeps one notice node across re-renders so it is announced once
✓ holds the notice back until the shards have actually answered
✓ still renders the manifest failure as the fatal index panel
```
6 failures / 2 passes. The 2 that pass are pure AC3 regression guards (HEAD already
surfaced an error on total failure and held back on the manifest path) — correctly
expected to pass pre-change.

### Claim 2: "8 of 10 new library tests fail against the pre-change `paperIndex.ts`" — **WRONG. Actual: 7 of 9.**

`git diff -U0 … | grep -c '^+.*\bit('` → **9** new `it()` blocks, not 10.
Which 7 fail:

```
× keeps the shards that loaded when one shard 404s
× keeps the shards that loaded when one shard has a malformed body
× reports every failed shard, not only the first
× rejects when every shard in the window fails
× retries a failed shard on the next load instead of caching the failure
× counts only the shards that loaded toward progress
× returns no failures for an empty manifest instead of throwing
```

Which 2 pass pre-change (both are AC3 guards, expected):
```
✓ still rejects when the manifest fails, even though shards are involved
✓ reports no failures when every shard loads
```

So the numerator (7 ≠ 8) and the denominator (9 ≠ 10) are both wrong. The *direction* of
the claim holds — the tests are non-vacuous, 7 of 9 genuinely gate the new behaviour — but
the figure is misstated. Flagged as a report-accuracy issue (§9.2), not a code defect.

### Mutation control — are the tests sensitive to regressions, not just to feature absence?

Yes, verified by mutating the new code in `/tmp/rpfv-probe`:

- **M1** `title=""` (prop kept, shard name dropped), isolated:
  `× names the missing shard without leaking the raw failure into the text`
  → `expected '' to contain 'papers-2024-W08.json'`. The naming assertion is genuinely
  load-bearing.
- **M2** `loadShard` returns `{ papers: [] }` instead of throwing on `!response.ok`:
  **12 failed | 21 passed (33)** across the two files, including
  `× rejects when every shard in the window fails → promise resolved "[]" instead of rejecting`
  and all 7 App-level notice tests.

**Harness sensitivity: established.** Pre-fix controls (c1/c2) fail with real assertion
errors under this exact harness, and mutations of the new code are caught.

### No existing test weakened, skipped, or deleted

- `git diff -- web/src/lib/__tests__/paperIndex.test.ts | grep '^-' | grep -v '^---'` → **empty**. Purely additive (166 added lines, 0 removed).
- `grep -rn "\.skip\|\.only\|it\.todo\|describe\.todo\|it\.fails" web/src --include=*.ts --include=*.tsx` → **no hits**.
- **IMP-003** tests present and passing: `paperIndex.test.ts:158` (*re-fetches instead of returning a rejected manifest promise*), `:227`, `:254`, `:314` — all four memoisation/rejection tests intact.
- **IMP-007** tests present and passing: `App.retry.test.tsx` — 7 `it()` blocks, all green. Live browser confirmation in §7.4.

---

## 5. Flake check

```
run 1:  Tests  184 passed (184) | Test Files  12 passed (12)
run 2:  Tests  184 passed (184) | Test Files  12 passed (12)
run 3:  Tests  184 passed (184) | Test Files  12 passed (12)
run 4:  Tests  184 passed (184) | Test Files  12 passed (12)
run 5:  Tests  184 passed (184) | Test Files  12 passed (12)
run 6:  Tests  184 passed (184) | Test Files  12 passed (12)
run 7:  Tests  184 passed (184) | Test Files  12 passed (12)
run 8:  Tests  184 passed (184) | Test Files  12 passed (12)
run 9:  Tests  184 passed (184) | Test Files  12 passed (12)
run 10: Tests  184 passed (184) | Test Files  12 passed (12)
run 11: Tests  184 passed (184) | Test Files  12 passed (12)
run 12: Tests  184 passed (184) | Test Files  12 passed (12)
run 13: Tests  184 passed (184) | Test Files  12 passed (12)
run 14: Tests  184 passed (184) | Test Files  12 passed (12)
FLAKE_SUMMARY green=14 nongreen=0
```

**15 green full-suite runs total** (14 in the loop + 1 initial). **0 flakes.**
Harness sensitivity proven independently by the c1/c2 pre-fix controls and the M1/M2
mutations above.

---

## 6. Gates

```
$ npm run typecheck
> tsc --noEmit
(exit 0, no output)
```

```
$ npm test
 Test Files  12 passed (12)
      Tests  184 passed (184)
```

Per-file counts (reporter=json), confirming 184 across 12 files and that nothing was lost:

```
 27  src/lib/__tests__/collections.test.ts
 35  src/lib/__tests__/paperIndex.test.ts
 10  src/lib/__tests__/types.test.ts
  3  src/lib/__tests__/urlState.test.ts
 21  src/__tests__/App.collections.test.tsx
 11  src/__tests__/App.partialShard.test.tsx
  8  src/__tests__/App.retry.test.tsx
 20  src/__tests__/App.urlState.test.tsx
  8  src/__tests__/App.shard.test.tsx
 20  src/__tests__/App.test.tsx
 11  src/__tests__/PaperCard.test.tsx
 10  src/__tests__/search.test.tsx
----
184  TOTAL
```

```
$ npm run build
> tsc --noEmit && vite build
vite v7.3.1 building for production...
✓ 39 modules transformed.
dist/index.html                   0.46 kB │ gzip:  0.30 kB
dist/assets/index-Dm-zEfKA.css   10.93 kB │ gzip:  3.19 kB
dist/assets/index-B1ZvcpoK.js   167.40 kB │ gzip: 53.70 kB
✓ built in 2.07s
BUILD_EXIT=0
```

**Note on bundle size:** JS grew 163.72 kB → **167.40 kB** (+3.68 kB, +2.2%). The report
claims a "baseline 163.72 → 163.81 kB, +0.09 kB". The baseline matches REPO_PROFILE, the
new figure does not. No gate exists on this, and `+3.7 kB` is a plausible cost for the new
component + state, so this is not a defect — but the reported figure is wrong (§9.2).

---

## 7. Playwright — real behaviour

Server: `npm run preview -- --port 5299 --strictPort` for the healthy baseline; plus a
fault-injecting static server (`/tmp/rpf-v-fault.mjs`, mine, with a runtime
`/__block` + `/__heal` control endpoint) serving the same `web/dist` on the project's real
`/research-paper-feed/` base path, returning real HTTP 503 for blocked files. A fresh port
per scenario, because `loadShard` uses default HTTP caching and a previously cached shard
will mask a later block (REPO_PROFILE WEB-12) — that itself cost me a false negative on the
first attempt.

### 7.1 Healthy baseline (`npm run preview`, port 5299)
`2812 papers match`, `alertCount: 0`, 50 cards, `partialNotice: false`.

### 7.2 One shard blocked (`papers-2026-W39.json` → 503, port 5296)
```
matchLine                    : "2549 papers match"
cardsRendered                : 50
alertCount                   : 1
noticeFound / noticeTag      : true / P
noticeClass                  : "banner banner--error"
noticeVisibleText            : "Some papers could not be loaded. One week in this
                                window failed to load, so the feed below is incomplete.
                                Everything that did load is shown."
noticeTitleAttr              : "papers-2026-W39.json: Failed to load papers-2026-W39.json (HTTP 503)."
accessibleName (a11y tree)   : "papers-2026-W39.json: Failed to load papers-2026-W39.json (HTTP 503)."
errorPanelPresent            : false
tryAgainButtonPresent        : false
emptyMessage                 : null
```
Other shard renders in full. Notice is non-blocking. Shard named. ✔
Also verified with an active search filter (`#q=zzzznomatch`): notice still renders above
the "No papers match the current filters." message — the notice is independent of filtering.

### 7.3 Recovery after unblocking
Healed the server, then clicked the "30 days" recency chip — **no page reload**:
`2812 papers match`, **zero `role="alert"` nodes**, notice gone. `failedFiles` cleared. ✔

### 7.4 Manifest blocked (`index.json` → 503)
```
panel.panel--error role="alert"
  h2 "No paper index yet"
  p  "Failed to load the paper index (HTTP 503)."
  button "Try again"
```
Feed chrome gone entirely (no filters, no cards) — **fatal**, as required.
Healed and clicked "Try again" → recovered to the full feed, `2812 papers match`, no alerts,
and the heading took focus (`[active]`), confirming IMP-007 AC2 is intact and unaffected. ✔

### 7.5 All shards blocked
See §2. Correct content (single error alert, no shard notice, no double-announcement),
pre-existing UX debt.

### 7.6 IMP-011 coexistence (real browser)
Made `Storage.prototype.setItem` throw `QuotaExceededError` for `rpf.papers.v1`, then
created a collection and saved a paper via the card's `save-menu__new` form:
```
alertCount                                : 2
alertClasses                              : ["banner banner--error", "banner banner--error"]
shardNoticeText                           : "Some papers could not be loaded. …"
storageNoticeText                         : "Collections could not be saved. …"
bothSameClass                             : true
distinctNodes                             : true
afterRerenderAlertCount                   : 2
shardNoticeSameNodeAfterRerender          : true   <- no re-announcement
storageNoticeSameNodeAfterRerender        : true   <- no re-announcement
```
No conflict, no double-announcement. They sit in different branches
(`App.tsx:288-296` above the view switch; `App.tsx:488` inside the feed), share identical
styling, and read as one system. Screenshot:
`.improve/artifacts/IMP-015/verify-both-banners-desktop-1280.png`.

### 7.7 Console errors
```
[ERROR] Failed to load resource: the server responded with a status of 503 (Service Unavailable)
        @ …/data/papers-2026-W39.json:0
```
**One injected-failure network error and nothing else**, across all scenarios. No app-level
`console.error`, no React warnings, no unhandled promise rejections. Zero new errors
attributable to the change.

### 7.8 Screenshots
| File | View |
|---|---|
| `.improve/artifacts/IMP-015/verify-partial-shard-desktop-1280.png` | 1280×900, one shard down |
| `.improve/artifacts/IMP-015/verify-partial-shard-mobile-390.png` | 390×844, one shard down |
| `.improve/artifacts/IMP-015/verify-all-shards-failed-desktop-1280.png` | 1280×900, all shards down |
| `.improve/artifacts/IMP-015/verify-both-banners-desktop-1280.png` | 1280×900, both notices |

**Design judgement.** The notice is intentionally designed and consistent with IMP-011's
banner: identical `banner banner--error` treatment (soft pink fill, danger-coloured bold
lead-in, same width and inset as the storage banner), same full-width block placement, same
rounded card language. It sits in the natural gap between the filter panel and the feed,
which is the correct spot — it explains the feed directly above the thing it qualifies. It
does not shift or clip anything. Compared against `.improve/artifacts/baseline/`, nothing
regressed: the healthy feed renders byte-identically to baseline (2 812 papers, same
layout); the only delta is the extra element in the failure state. Matches the
implementer's four `feed-*.png` captures as well.

One design nit: the bold lead-in "Some papers could not be loaded." is good, but because
the shard name lives only in `title`, sighted desktop users must hover a pink block to
learn *which* week is missing. See §9.1.

---

## 8. Repo hygiene

`git status --short` is unchanged from session start — the same 3 modified files and the
same untracked files. No source file was modified by this verification. No git write
command was run. All scratch work lives under `/tmp` (`/tmp/rpfv-c0`, `/tmp/rpfv-c1`,
`/tmp/rpfv-c2`, `/tmp/rpfv-probe`, `/tmp/rpf-v-fault.mjs`, `/tmp/rpf-v-flake.sh`,
`/tmp/probe-total.tsx`). `.playwright-mcp/` temp dir removed. Both fault servers and the
preview server stopped (`lsof` on 5296/5297/5299 → `none listening`).

---

## 9. Findings

### 9.1 Real, but minor — the missing-shard name is unreachable on touch (criterion-adjacent)
`App.tsx:505-508` puts the shard name only in `title`. `title` renders a tooltip for
mouse/hover users but **not on touch**, and `verify-partial-shard-mobile-390.png` confirms
a 390px user sees the prose with no shard name on screen at all. At the de-facto 390px
viewport the criterion's "naming the missing shard" is satisfied for roughly half the
audience.

*Suggested fix (IMP-016's scope, since it already owns error messaging):* put the week in
the visible prose — e.g. `One week (Sep 28 – Oct 4) failed to load` — and keep the file
name + `Error.message` in `title` for desktop hover. `ShardLoadFailure` already carries
`file`; the manifest shard has `from`/`to` available if a date range is preferred over a
filename. This keeps IMP-017 AC2 satisfied (no raw message or file name in the primary
text) while making the name reachable everywhere.

Secondary a11y note: because `role="alert"` takes its accessible name from `title` rather
than from content, the string a screen reader announces is
`papers-2026-W39.json: Failed to load papers-2026-W39.json (HTTP 503).` — the raw technical
text, *not* the reader-friendly prose in the DOM. That does satisfy "names the missing
shard", and `title` is explicitly sanctioned by IMP-017 AC2, so it is not a violation — but
it inverts the usual priority and IMP-017's own banner-audit work should be aware that
adding `title` to an alert flips its accessible name.

### 9.2 Report-accuracy defects (evidence quality, not code)
Per `REPO_PROFILE.md` §4.6.7 ("any command output in a report must be a real number copied
from a real run — inventing plausible figures is a correctness failure, not a style
nits"), `.improve/reports/impl-IMP-015.md` contains three misstated figures:

1. **"Baseline before any change: 178 tests / 12 files."** The true HEAD baseline is
   **167 tests / 11 files** (`/tmp/rpfv-c0`). 178/12 is the count *after* the earlier
   attempt's library half landed with its 2-test app file.
2. **"Net: +6 tests (178 → 184), file count unchanged at 12."** The true delta is
   **+17 tests, +1 file** (167→184, 11→12). "+6" is only the second attempt's own
   increment and is mislabelled as the item's net delta.
3. **"8 of 10 new library tests fail against the pre-change `paperIndex.ts`."** Actual:
   **7 of 9** (§4).

Two build figures are also wrong: the report says `npm run build` is `tsc -b && vite build`
(it is `tsc --noEmit && vite build`, per `web/package.json`) and `✓ 3228 modules transformed`
(the real output is `✓ 39 modules transformed`). The reported bundle size (163.81 kB) is
also wrong — the real figure is 167.40 kB.

None of these affect the shipped code, and the implementer's *directional* claims hold
(tests are non-vacuous; the total-failure dead end is pre-existing). But the non-vacuity
count — the one number a reviewer would use to decide whether the tests are worth
anything — is wrong, so it is worth correcting rather than waving through. This is the
same failure class as the committed IMP-167.

### 9.3 Pre-existing, out of scope, correctly not fixed here
- The total-shard-failure state has no retry button and shows a false "No papers are
  available in this window yet." → `REPO_PROFILE.md` WEB-03 / IMP-016. Proven byte-identical
  to HEAD (§2).
- `loadShard` uses default HTTP caching with no TTL (WEB-12), so a shard fetched
  successfully once can be served from cache and mask a later server-side failure. Cost me
  a false negative during verification; worth noting for whoever touches shard loading
  next.

---

## 10. Bottom line

The code is correct. All 5 acceptance criteria are met, verified by reading the diff, by
14 independent test runs, by isolated pre-fix controls and mutation tests proving the new
tests are load-bearing, and by exercising every failure mode in a real browser against the
real production bundle. IMP-003 and IMP-007 are intact and still pass. The one thing that
looked like a hidden dead end — the total-failure path — I chased to ground and it is
**pre-existing and out of scope**, correctly disclosed by the implementer and correctly
attributed to IMP-016.

Worth fixing before or during IMP-016: put the missing week in the visible notice text
(§9.1), and correct the four misstated figures in the report (§9.2). Neither blocks the
item.
