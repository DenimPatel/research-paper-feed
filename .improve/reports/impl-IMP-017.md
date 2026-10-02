# IMP-017 — implementation report

**Status:** implemented. No `.improve/reports/verify-IMP-017.md` existed, so this is a
first implementation of the spec's three acceptance criteria plus the three
accumulated findings handed to me with the task.

## Files changed

| File | Change |
| --- | --- |
| `web/src/lib/paperIndex.ts` | +`IndexFailureKind`, `kind` on `IndexUnavailableError`, new `ShardLoadError`. Error *messages* unchanged. |
| `web/src/lib/failureCopy.ts` | **new** — `LoadFailureNotice` + `describeLoadFailure(cause)`. The single place reader-facing failure copy lives. |
| `web/src/App.tsx` | `error` state is now a `LoadFailureNotice`, not a `string`. Both catch handlers classify + log. Four render sites show `error.message` and keep `error.detail` in `title`. Two `role="alert"` nodes got an explicit `aria-label`. |
| `web/src/lib/__tests__/failureCopy.test.ts` | **new** — 8 unit tests. |
| `web/src/__tests__/App.loadFailure.test.tsx` | rewrote the test that pinned the raw rendering; +4 tests (index copy ×3, the "failure while papers are on screen" banner ×1). |
| `web/src/__tests__/App.partialShard.test.tsx` | rewrote the test that pinned the raw rendering; +1 test for the notice's accessible name. |

No CSS added. `dist/assets/index-*.css` is **10.93 kB, byte-identical to the pre-change
baseline** — every new element reuses `panel`, `panel--error`, `banner`,
`banner--warning`, `banner--error`. No `package.json` / `package-lock.json` change.
`web/src/styles.css`, `PaperList.tsx`, `FeedControls.tsx`, `CollectionsView.tsx` untouched.

## AC1 — each user-visible failure maps to a reader-facing sentence

The three failure strings the spec names, plus the two extra render sites that
landed items added since. `failureCopy.ts` classifies **by type, never by
matching on the message**, so rewording `paperIndex.ts` cannot silently change
which sentence a reader gets.

| Old string (was rendered as visible text) | New visible copy | Rendered at |
| --- | --- | --- |
| `No paper index was found. Run \`python scripts/build_index.py\` locally, or wait for the scheduled GitHub Action that builds and deploys the index.` | "The paper index could not be loaded, so there is no feed to show. This is usually temporary, and the page will start working once the index is available again." | `App.tsx:525` — manifest panel message `<p>` |
| `…(HTTP 404)` / `…(HTTP 503)` (same `INDEX_HELP` + status) | *same sentence as above* | same |
| `The paper index is malformed and could not be parsed.` | "The paper index on this site could not be read, so there is no feed to show. This is a problem with the site's published data rather than with your browser, so trying again will not help until the index is rebuilt." | `App.tsx:525`, same element |
| `Failed to load papers-2024-W14.json (HTTP 404).` | "Some of the paper data could not be fetched. This is usually temporary, and it does not mean the papers are missing." | `App.tsx:700` — load-failure panel message `<p>`; and `App.tsx:594` — the warning banner |
| `Shard papers-2024-W14.json is missing or malformed. Try regenerating the index.` | *same sentence as the row above* | same two sites |

Two deliberate copy decisions:

* **"not there" and "there but broken" are different sentences.** They want
  opposite advice — a 404 usually clears, a body that will not parse will not
  parse on the second try. The malformed copy says so outright instead of
  inviting a reader to click *Try again* until they give up. This is why
  `IndexUnavailableError` gained a `kind` instead of `describeLoadFailure`
  string-matching on `"malformed"`.
* **The shard sentence names no week and no count.** A *hard* failure has no week
  left to name (every shard in the window failed), and the per-week question is
  already answered by IMP-015's partial notice in the soft case. The class of
  cause plus "it does not mean the papers are missing" is the useful part.

### Where the technical detail went — not deleted

AC1 allows `title` **or** `console.error`. I did both, so the detail survives for
someone debugging a deploy with no mouse:

* **`title` on the element carrying the sentence** — `App.tsx:525`,
  `App.tsx:594`, `App.tsx:700`. The shard file name and HTTP status are still one
  hover away, which is what the pre-existing test *"keeps the file name and the
  raw cause in `title` for the detail"* was already asserting.
* **`console.error` with the thrown cause itself** — `App.tsx:187` and
  `App.tsx:258`, not the stringified message, so the error class and stack are
  retained too. Confirmed in-browser:
  `paper feed: the papers could not be loaded. ShardLoadError: Shard papers-2026-W40.json is missing or malformed…`
  and `paper feed: the index could not be loaded. IndexUnavailableError: The paper index is malformed…`.
* **IMP-007's visible `Build the index locally:` block is untouched**, so the
  `python scripts/build_index.py` guidance the old `INDEX_HELP` message carried
  is still on screen for a developer, not only in a tooltip.

## AC2 — no raw `Error.message`, file name, or HTTP status in primary visible text

`failureCopy.test.ts` runs every `message` through a shared `expectNoTechnicalDetail`
helper barring `/\.json/`, `/HTTP/`, `/\b\d{3}\b/`, `/Failed to load/`,
`/IndexUnavailableError/` — including a table-driven test over all four causes.
The App tests re-assert the same bar against real rendered `textContent` at each of
the three failure sites.

## Finding (a) — the spec's own defect

The spec's AC1 said to render `"Papers could not be loaded. Try again in a moment."`
as the single shard sentence. That is not honest copy: it says "try again" and
names no cause, in a panel whose first paragraph already explains the state, and
in a warning banner that has no retry button. I wrote copy that is true in both
render contexts instead. Flagging the deviation rather than burying it.

## Finding (b) — raw `Error.message` as visible text, pinned by a test

`App.tsx:700` rendered `<p>{error}</p>` in the load-failure panel, and
`App.loadFailure.test.tsx:261` asserted `toContain("Failed to load papers-2024-W10.json")`.

Both fixed. The test is **rewritten, not deleted or loosened** — it now asserts
the reader-facing sentence is present *and* that the file name, `HTTP`, and
`Failed to load` are **absent** from `textContent` *and* that the raw string is
still the `title` of the element carrying the sentence. A test that only checked
the new copy would pass just as well against a build that threw the diagnostics
away.

`App.partialShard.test.tsx:344` pinned the same thing for the hard panel via
`installFetchWithoutShards`; rewritten the same way.

## Finding (c) — the partial-shard notice's accessible name was a raw `title`

**Cause, confirmed empirically rather than assumed:** ARIA `alert` is an
*author-named* role — its name is not computed from its contents. With the
`title` as the only author-supplied string, Chromium computed the notice's name
as the technical string. Reproduced before the fix by the IMP-016 verifier as
`alert "papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. Try regenerating the index."`

**Fix — an explicit accessible name, not a tooltip rename.** Added
`aria-label="Some papers could not be loaded"` to the notice (`App.tsx:630`).
`aria-label` is accname step 2B and `title` is step 2I, so the name is now the
label and the tooltip stays a tooltip. The label is the notice's own visible
`<strong>`, so WCAG 2.5.3 (label in name) holds.

The same trap existed in the second place I added a `title` to a `role="alert"`
node — the `error && !loadFailed` warning banner at `App.tsx:590`. Left alone, it
would have *introduced* the exact defect (c) describes. It got
`aria-label={error.message}` for the same reason; that is why it is not merely
decoration, and the test asserts it.

In the two panels the titled element is a **plain `<p>`** (no role), which does
not take a name from `title` — verified in the browser: the panel still renders
as unnamed `alert [ref=e12]`, exactly as the IMP-016 verifier recorded for
IMP-007's panel, so the tooltip did not leak into the name there.

The finding's second half — "gives touch users nothing" — was already fixed by
the landed prose. Confirmed at 390px in
`feed-error-copy-partial-shard-mobile-390.png`: the notice reads *"Some papers
could not be loaded. One week in this window failed to load (Sep 24 – Sep 27,
2026), so the feed below is incomplete."* with no hover required.

## No regression in landed items

All four failure surfaces are distinct nodes and were checked to coexist:

| Node | Element | Owns |
| --- | --- | --- |
| IMP-007 | manifest `panel--error` `role="alert"` | h1 + message + Try again + local build steps |
| IMP-016 | load-failure `panel--error` `role="alert"` | ¶1 state + message + Try again |
| IMP-015 | partial `banner--error` `role="alert"` + `aria-label` | "N weeks … failed to load (…)" |
| IMP-011 | `CollectionsView` save banner | untouched, separate view |

Double-announcing is asserted, not assumed: the hard-failure tests assert
`screen.getAllByRole("alert")).toHaveLength(1)`, and the new banner test asserts
one alert, no `Papers could not be loaded` panel, **and** that the earlier
partial notice has stood down rather than leaving a second alert describing a
window that no longer exists. No landed `describeFailedWeeks` /
`formatWeekRange` / category-notice / save-failure copy was edited.

**A note on reachability that the tests document:** the `error && !loadFailed`
banner is hard to reach, because `loadShard` never re-requests a shard it already
holds, so a window can only fail outright if *every* shard it needs is uncached
— which means the window must have dropped the one shard that loaded. The test
reproduces the real route (a 60-day window where the two newest weeks fail, then
a 7-day window needing exactly those two). Flagging it because a future edit
that adds shard re-validation would make this branch common, and it currently has
only one test.

## Commands and results

Baseline before my changes: **202 tests / 13 files**, typecheck clean, build clean.

| Command | Result |
| --- | --- |
| `npm run typecheck` | clean, no output, twice (after source changes, and final) |
| `npm test` | **216 passed / 216, 14 files passed** (baseline 202/13; +14 tests) |
| `npm run build` | clean — `✓ 40 modules transformed`, built in 367ms, CSS **10.93 kB (unchanged)**, JS 169.87 kB / gzip 54.45 |

### Non-vacuity (scratch copy at `/tmp/imp017-scratch`)

1. **Revert `App.tsx` to `HEAD`, keep the new tests** → **8 of 8** new/updated
   tests fail in the two App files. The tests detect the fix being absent.
2. **Mutation: keep the fix, delete both `aria-label` attributes** → exactly the
   2 accessible-name tests fail (*"names the notice for a reader…"* and
   *"warns beside the feed in plain words…"*). The `aria-label` is load-bearing
   for finding (c), not decoration.

### Flake check

**12/12 consecutive full `npm test` runs passed, 216/216 every run, 0 failures.**
(Baseline for the comparison: two items in this batch were rejected for 1-in-12
nondeterminism. 12 is deliberately at that threshold, so this is a pass at the
bar, not comfortably past it — worth another run or two if a verifier is
suspicious of any of the async assertions. The `findBy*`/waitFor-free new tests
and the awaited `findByText` patterns are the same ones already used by the
landed suites.)

## Playwright evidence

Dev server on `:5199` with the `web/public/data/` fixture mutated between loads
(and restored byte-identical afterwards — `diff -r` clean). Artifacts in
`.improve/artifacts/IMP-017/`.

| State | Artifact | Visible text contains |
| --- | --- | --- |
| all shards fail (IMP-016 panel) | `feed-error-copy-desktop-1280.png` | "Papers could not be loaded. … not an empty window." + "Some of the paper data could not be fetched. This is usually temporary, and it does not mean the papers are missing." No file name, no `HTTP`; `title` = `Shard papers-2026-W40.json is missing or malformed…` |
| one shard corrupt (IMP-015 notice) | `feed-error-copy-partial-shard-desktop-1280.png` | "Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026)…" No file name, no `HTTP`; `title` = `papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed…` |
| same, 390px | `feed-error-copy-partial-shard-mobile-390.png` | full sentence including the week range, no hover needed |
| index absent (IMP-007 panel) | `feed-error-copy-index-missing-desktop-1280.png` | "The paper index could not be loaded, so there is no feed to show. This is usually temporary…" — plus the `Try again` button and the two build commands |
| index unreadable | `feed-error-copy-index-malformed-desktop-1280.png` | "…could not be read… trying again will not help until the index is rebuilt." |

**Finding (c), before → after, in Chromium's accessibility tree:**

```
before (IMP-016 verifier):  alert "papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. Try regenerating the index."
after:                      alert "Some papers could not be loaded"
                             └ strong "Some papers could not be loaded."
                               text "One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown."
```

Console in the healthy feed: clean (only Vite's connect messages and the React
DevTools notice). Console in each failure state: exactly one `paper feed: …` line
carrying the cause.

## Uncertain / worth a second opinion

1. **Copy deviation.** AC1 named `"Papers could not be loaded. Try again in a
   moment."` verbatim; I wrote a different shard sentence because that one is not
   honest in the banner context (no button to press) and duplicates the panel's
   own paragraph. The *intent* of AC1 is met — the spec's own worked example uses
   the word "e.g.". Flagging in case the spec author meant the literal string.
2. **`console.error` on every load failure.** Sanctioned by AC1 as a preservation
   site and it is the only channel that keeps the stack. It does mean the console
   is no longer silent in failure states. The profile's "baseline console output
   is clean" claim is about the *production build* rendering the normal feed,
   which is still true — but if a landed item's verifier treats any new console
   output as a regression, this is the line to look at.
3. **`ShardLoadError.file` is currently written but never read.** The
   classification uses `instanceof`; the file name is already inside `message` and
   reaches the tooltip. It is kept because it is the obvious next thing a caller
   needs, but a reviewer could fairly call it dead weight.
4. **`IndexUnavailableError`'s constructor signature changed** from
   `(message, options?)` to `(message, kind?, options?)`. Nothing constructs it
   outside `paperIndex.ts` today, and `kind` defaults to `"unavailable"`, so an
   out-of-tree `new IndexUnavailableError(msg, { cause })` call would silently
   pass `{cause}` as `kind`. The cause branch is `cause?.cause !== undefined`, so
   it would not throw — it would just drop the cause. Low risk, worth knowing.
5. **No new discovery file.** I found no out-of-scope problem worth writing up, so
   `.improve/reports/discovered-IMP-017.md` does not exist. In particular I
   checked the collections *import* failure copy, which was the only other place
   a load-ish error is rendered: `CollectionsView.tsx` already uses a
   reader-facing "Could not import this list." and never renders an
   `Error.message`, so it is outside AC2 as well as outside this item.
