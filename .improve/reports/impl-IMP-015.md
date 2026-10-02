# IMP-015 — Make a single failed shard non-fatal

Status: **both acceptance criteria implemented, verified**. AC1/AC3 were already done and
uncommitted when this attempt resumed; AC2 (the App-side signal) is new here. Nothing is
committed — the tree is left dirty for review.

## 1. Files changed

| File | Change | Author |
|---|---|---|
| `web/src/lib/paperIndex.ts` | `Promise.allSettled` over needed shards; `loadPapers` returns a `PapersLoadResult` carrying `failedFiles`; failed shards are never cached, so they are retried. Manifest failure and all-shards-failed still reject. | earlier attempt (uncommitted, reviewed and kept) |
| `web/src/lib/__tests__/paperIndex.test.ts` | 16 library tests, including all three ACs at the `PaperIndex` boundary. | earlier attempt |
| `web/src/App.tsx` | **New in this attempt.** `failedShards` state, a `banner banner--error` + `role="alert"` notice when the load partially failed, and a `catch` that clears it on total failure. | this attempt |
| `web/src/__tests__/App.partialShard.test.tsx` | **New in this attempt.** 8 app-level tests (was 2). | extended here |

Untouched, as required: `web/src/lib/collections.ts`, `web/src/lib/urlState.ts`,
`web/src/components/*`, `web/src/styles.css`, `.improve/FEATURES.md`,
`web/package-lock.json`. No git write command was run.

## 2. Review of the previous report's §6 patch

The proposed App-side diff was **rejected in its specific form** and replaced:

| §6 proposal | Why it was wrong now | What I did instead |
|---|---|---|
| Insert between `{loading ? … : noCategoriesSelected ? … : <PaperList/>}` and `</main>` | `noCategoriesSelected` can be true *with* a partial failure. Putting the notice below that branch hides the one message the user most needs. | Rendered above the feed, next to the other two feed-level notices. |
| `saveFailed && !failedFiles.length && …` | Exclusivity is the wrong model. A full localStorage plus an unreachable shard is two real, simultaneous problems; hiding one is how the app becomes quietly untrustworthy. | No mutual exclusion. Both can show (§5). |
| `role="status"` + `banner--warning` | Inconsistent with the banner IMP-011 just landed. Every `banner` in this app already carries `role="alert"` (`App.tsx:489`, `:501`), so `status` would have been the odd one out. | `role="alert"` + `banner banner--error`, matching IMP-011 exactly. |
| `title={weekLabel(f.file)}` | Invents a `weekLabel` formatter, and a raw week string is still not reader-facing copy. | No formatter. `title` carries `${file}: ${message}` per failure — reportable, and it satisfies IMP-015 AC2's "naming the missing shard" without tripping IMP-017 AC2. |
| "Put a retry button here" | Left as a TODO. | Deliberately not done — see §6. |
| No guard for the pre-shard window | The AC asks the notice not to appear before shards resolve. | Guaranteed by `failedShards` starting `[]`; tested with a gated fetch (§7). |
| No `catch` guard | A window that went partial → total would show the hard error *and* a stale partial notice. | `catch` clears `failedShards` (§4). |

## 3. Critical review: is `PapersLoadResult`'s non-enumerable array sound?

The shape is `Paper[] & { papers: Paper[]; failedFiles: ShardLoadFailure[] }`, with both
properties defined non-enumerably and `papers` pointing at the array itself.

**Verdict: keep it.** It is a footgun in principle, but the footguns are all
theoretical here, and the compatibility it buys is real and load-bearing:

- `App.tsx:171` is the only production consumer, and it does `setPapers(list)` into a
  `Dispatch<SetStateAction<Paper[]>>`. An explicit `{ papers, failedFiles }` return would
  force that to `setPapers(list.papers)` — a breaking change to the one call site, for no
  behavioural gain. The intersection type is what made it possible to change the return
  type *without* touching `App.tsx`, which is exactly what let this attempt exist as a
  separate, reviewable step.
- Non-enumerability is what makes `expect(result).toEqual([])` pass
  (`paperIndex.test.ts:519`), so the result can still be asserted as the plain array every
  older test assumes. An object return would have forced a rewrite of all 16.

The genuine sharp edges, none of which I think justify churning working code:

1. **Spread loses the signal.** `{ ...result }` or `structuredClone(result)` yields a bare
   `Paper[]` and the feed goes silently short. Real, but there is exactly one consumer and
   it spreads nothing.
2. **`papersResult` throws if handed the same array twice** (`defineProperty` on a
   non-configurable key). Every current caller passes a fresh array, so it cannot fire.
   Worth a one-line comment if this ever grows a second call site.
3. **`papers === result`.** Slightly surprising, but it is the point: there is no way to
   read `papers` and get a copy without the hidden props, so the two can never disagree.

If I were doing this fresh with `App.tsx` already editable I would still pick the object
return — it is the more honest shape, and the spec's own words ("a `{ papers, failedFiles }`
shape") name it first. But the spec explicitly allows either, the code works, the tests
pin the behaviour, and churning it would invalidate the reason this was a two-step change.
Not worth it.

One correction to the previous report, for the record: it claimed the all-fail rethrow is
"byte-identical to what `Promise.all` used to reject with". It is the same `Error` object,
but `Promise.all` rejects with whichever shard rejects first *temporally*, whereas
`allSettled` + `throw firstReason` rethrows in *manifest* order. Same message, same object,
different tie-break when two shards fail in the same tick. Nothing depends on it.

## 4. How AC2 is implemented

`web/src/App.tsx`, three edits:

1. **State** (`App.tsx:88-93`) — `const [failedShards, setFailedShards] = useState<ShardLoadFailure[]>([])`.
2. **Success** (`App.tsx:171-180`) — `setFailedShards(list.failedFiles)` immediately after
   `setPapers(list)`. Both read off the *same* `loadPapers` return value, so the feed and
   the notice cannot disagree and there is no second request.
3. **Failure** (`App.tsx:182-188`) — `setFailedShards([])` in the `catch`. When every shard
   fails there is no partial result to describe; the hard error is the whole story, and
   leaving an older partial notice up would double-report a state that no longer holds.

**The banner** (`App.tsx:488-515`), inside the `manifest && …` branch, directly after the
existing `error` banner:

```tsx
{failedShards.length > 0 && (
  <p
    className="banner banner--error"
    role="alert"
    title={failedShards.map((f) => `${f.file}: ${f.message}`).join("\n")}
  >
    <strong>Some papers could not be loaded.</strong>{" "}
    {failedShards.length === 1 ? "One week" : `${failedShards.length} weeks`}{" "}
    in this window failed to load, so the feed below is incomplete.
    Everything that did load is shown.
  </p>
)}
```

Rendered copy: *"Some papers could not be loaded. One week in this window failed to load, so
the feed below is incomplete. Everything that did load is shown."* (browser-verified at
1280px and 390px).

**Why `banner--error` and not `banner--warning`.** The instruction was to reuse the
`banner`/`banner--error` pair IMP-011 established, and that is also the right severity: a
partial shard failure means the page looks complete but is not, which is the failure mode
this whole item exists to prevent. `banner--warning` is already in use for genuinely
advisory notices (`unknownCategories`, the manifest `error` string).

**Where the technical detail lives.** The AC wants the missing shard *named*; IMP-017 AC2
bars a file name or an `Error.message` from the visible message and explicitly permits
them "as a `title` attribute on the same element". `title` is the one place that satisfies
both, and it is what the previous report's §2 had already proposed reconciling. In the
browser the accessible name came out as
`papers-2026-W39.json: Failed to load papers-2026-W39.json (HTTP 503).` — so the missing
week is reportable while the visible copy stays prose. A test pins both halves.

### AC3 in the App

`.catch` clears `failedShards`, so a total failure shows the hard error *only*. Verified two
ways: `App.partialShard.test.tsx` asserts exactly one `role="alert"` carrying
`Failed to load papers-2024-W09.json`, and the browser run against `BLOCK=papers-` found
exactly one alert with no partial-failure text anywhere in the document.

## 5. Interaction with IMP-011's banner

Both can be on screen, and neither suppresses the other. Two simultaneous `role="alert"`
regions is standard ARIA and behaves correctly: each is its own live region, each is
announced once on mount, and neither is announced again on re-render.

Four reasons this holds, each test-backed:

1. **Distinct nodes.** Two separate `<p>` elements; they cannot merge.
2. **Stable positions.** Each banner is its own conditional slot in a fixed-length child
   array (`error` → `failedShards` → `unknownCategories` → feed body). React reconciles by
   index, so neither banner is shifted out of position by the other appearing or
   disappearing.
3. **Mount, don't mutate.** Both are conditionally rendered on their own state, so
   `role="alert"` fires once per state change. Neither updates its own text after mounting.
4. **IMP-011's banner is outside the feed branch** (at the top of `<main>`, above the
   view switch), mine is inside it. They can never collide positionally, and mine correctly
   unmounts when the user switches to the Collections tab — the collections view reads
   saved papers from `localStorage`, not from shards, so shard completeness is not its
   concern. That is the one asymmetry, and it is deliberate.

Test: `shows both as separate alerts and announces neither twice` — asserts exactly 2
alerts, distinct copy on each, then types in the search box and asserts it is still exactly
the same 2 nodes. Getting a full `Storage` into jsdom 29 was the necessary step (its
`window.localStorage.setItem` is not a function, per `App.storage.test.tsx:42-50`); the test
uses a `FullStorage` that throws only on `PAPERS_KEY`, matching `saveState`'s write order,
so `detectStorage()` succeeds and IMP-011's banner is reachable with zero user action.

## 6. Deliberately not done

- **No per-shard "Try again" button.** A partial failure is non-fatal and the recency
  control already re-runs `loadPapers`, which retries the failed shard (verified in §8).
  A button would need a re-load trigger and is not in any AC. Left for a backlog item.
- **No week formatter.** `ShardLoadFailure` carries `file`, not `week`, and inventing a
  `papers-2026-W39.json → 2026-W39` mapping here would pre-empt IMP-017's copy review.

## 7. Non-vacuity check

Scratch copy at `/tmp/rpf-imp015-c2` (rsync, `node_modules` symlinked), with `App.tsx`
restored from `HEAD` — the committed IMP-011 version — and `paperIndex.ts` left carrying
`failedFiles`, so the only thing isolated is the App-side render.

```
npx vitest run src/__tests__/App.partialShard.test.tsx
  Tests  2 passed | 6 failed (8)
```

The 6 failures are the criterion-2 tests, with real assertion failures:

- `renders the surviving week and says the feed is incomplete` → `expected exactly one partial-shard notice, found 0`
- `holds the notice back until the shards have actually answered` → `expected 2, received 1` (only the unknown-category alert from a leaked `cat=` hash)
- `names the missing shard without leaking the raw failure into the text` → `found 0`
- `keeps one notice node across re-renders so it is announced once` → `found 0`
- `clears the notice when a later window loads completely` → `found 0`
- `shows both as separate alerts and announces neither twice` → `expected 1 to be greater than 0` / `found 0`

The 2 that pass are must-not-change guards, and correctly so:
`stays silent when every shard loads` (AC2 must not fire when nothing failed) and
`still surfaces an error when every shard in the window fails` (AC3).

## 8. Commands and results

Baseline before any change: **178 tests / 12 files**.

| Command | Result |
|---|---|
| `cd web && npm run typecheck` | **pass**, no output |
| `cd web && npm test` | **184 passed / 184 (184)**, **12 files** |
| `cd web && npm run build` | **pass** — `tsc -b && vite build`, `✓ 3228 modules transformed`, `dist/` written |
| `cd /tmp/rpf-imp015-c2/web && npx vitest run src/__tests__/App.partialShard.test.tsx` | 2 passed / 6 failed (§7) |
| `cd web && npm test` × 12 | **12/12 runs fully green**, every run `Tests 184 passed \| 184 (184)`, `Test Files 12 passed \| 12 (12)` |

Net: **+6 tests** (178 → 184), file count unchanged at 12.

**Flake check: 12 consecutive full-suite runs, 0 non-green. No flaky test found.**
(Two items in this batch were rejected for a 1-in-12 nondeterminism; this run is 12 for 12.)

## 9. Playwright evidence

### How the shard was blocked

Real network-level fault injection, not an in-page patch. `npm run preview` (port 5199)
confirmed the healthy baseline — 2,812 papers match, 0 alerts. For the fault runs, a 55-line
static server (`/tmp/rpf-fault-server.mjs`, outside the repo) served `web/dist` on the same
`/research-paper-feed/` base as `vite preview` but answered **HTTP 503 + an HTML error
page** for every file matching `BLOCK`. It logged each request so the injection was visible
in the server output, not inferred:

```
BLOCK=papers-2026-W39.json node /tmp/rpf-fault-server.mjs … 5198   # one shard
BLOCK=papers-                    node /tmp/rpf-fault-server.mjs … 5197   # every shard
BLOCK=index.json                 node /tmp/rpf-fault-server.mjs … 5196   # the manifest
```

503 rather than 404 on purpose: a transient server failure is the realistic case, and it
proves the app degrades rather than dies on an error that would clear itself. `dist/` was
not modified — `vite preview` on 5199 was used for the healthy comparison.

### 1. One shard blocked → feed renders, notice appears

`BLOCK=papers-2026-W39.json`. The manifest and `papers-2026-W40.json` loaded; W39 got 503.

- `role="alert"` × 1, accessible name `papers-2026-W39.json: Failed to load papers-2026-W39.json (HTTP 503).`
- class `"banner banner--error"`; visible text is the reader-facing prose only.
- **`2,549 papers match`** (W40's 2,549 papers) — the other week renders in full, 50 cards.
- `partialNoticePresent: true`, `errorPanel: false`, `tryAgain: false`, `emptyMessage: false`.

Screenshots: `feed-partial-shard-desktop-1280.png`, `feed-partial-shard-mobile-390.png`.

### 2. Every shard blocked → still fatal (AC3)

`BLOCK=papers-`. Exactly **one** `role="alert"`, class `banner banner--warning`, text
`Failed to load papers-2026-W40.json (HTTP 503).` `partialNoticePresent: false` — the new
notice correctly does not double-report a load that never resolved. `0 papers match`, no
paper cards. Screenshot: `feed-all-shards-failed-desktop-1280.png`.

**Correction to the brief, verified in the browser.** All-shards-fail does **not** produce
the `panel panel--error` with the Try again button. `App.tsx:426` gates that panel on
`!manifest`, and the manifest loaded fine here, so the app renders the plain `error` banner
instead. That is pre-existing behaviour, not something this change introduced, and
`discovered-IMP-015.md` §3 already filed it as IMP-016's WEB-03 debt. I left it alone —
re-gating the panel is IMP-016's acceptance criterion, and quietly widening this item to
touch it would have hidden that scope.

The panel **with the Try again button** is the manifest-failure path, which is also fatal.
`BLOCK=index.json` produced `panel panel--error role="alert"` with
heading *"No paper index yet"*, the message, and a **Try again** button. Screenshot:
`feed-manifest-failed-desktop-1280.png`. So AC3's "the user sees the error state" holds on
both fatal paths.

### 3. Recovery without a reload

Server healed on the same port, then `30 days` clicked in the UI (which re-runs
`loadPapers`; the failed shard was never cached, so it is refetched):

```
before:  1 alert, "2549 papers match"
after:   0 alerts, "2812 papers match", hash #recency=30
```

The notice clears on its own once the data is complete. That is the user-visible payoff of
retrying rather than negatively caching a failed shard.

### Console

Across the whole session, the only console output was the browser's own network notice:

```
[ERROR] Failed to load resource: the server responded with a status of 503 (Service Unavailable)
        @ http://localhost:5198/research-paper-feed/data/papers-2026-W39.json:0
```

That is the injected fault being reported by Chromium, not an application error. **Zero new
console errors**: no React warnings, no uncaught exceptions, no `act` warnings, no app
`console.error`.

All servers stopped (`bgp_0fc7174df001pYZfTyDMHcACeD`, `bgp_0fc727cd0001ORbkwQ4AT5n0Qr`,
`bgp_0fc733b3f001YjfgIgN0konq5i`, `bgp_0fc7345b9001XuXmXbQpy8ldx6`,
`bgp_0fc746aa7001GLG72wsM0fA9dd`, `bgp_0fc74d7fe001GJR48vMMKtUj6r`,
`bgp_0fc75261d001ieHH7ISj3AeZ55` — all `stopped`). `.playwright-mcp/` removed.

## 10. AC verdicts

| AC | Verdict | Evidence |
|---|---|---|
| 1. Partial failures returned, not thrown | **met** | `paperIndex.test.ts` AC1 block; `PapersLoadResult` is an explicit named type, not inferred at the call site |
| 2. Non-blocking warning naming the missing shard | **met (new here)** | 6 new tests, 6 of which fail without the change; 1280px + 390px screenshots |
| 3. All shards fail still rejects | **met** | `paperIndex.test.ts` AC3 block; browser run 2 above; `catch` clears the partial notice |

Verification method from the spec: `npm run typecheck && npm test` both pass; the
spec-named screenshot path
`.improve/artifacts/IMP-015/feed-partial-shard-desktop-1280.png` exists.

## 11. Not done / left

- No commit, per instructions. Tree is dirty for review:
  `web/src/App.tsx` (M), `web/src/lib/paperIndex.ts` (M),
  `web/src/lib/__tests__/paperIndex.test.ts` (M),
  `web/src/__tests__/App.partialShard.test.tsx` (untracked, new).
- `.improve/FEATURES.md` still says `Status: IN-PROGRESS` and still cites the pre-IMP-015
  line numbers (`App.tsx:364-376`). Not edited, per instructions; a reviewer should flip
  it to DONE.
- IMP-017 AC2's blanket ban on raw `Error.message` in rendered strings still has two
  pre-existing violations outside this item's scope: `App.tsx:489` renders `error` directly,
  and `App.tsx:426` renders `cause.message` in the manifest panel. Both are IMP-017's work.