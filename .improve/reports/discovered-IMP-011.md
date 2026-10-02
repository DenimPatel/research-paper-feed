# Discovered while implementing IMP-011 — NOT FIXED

None of these were touched. Recorded so a later item can pick them up.

## 1. The two storage keys are still written non-atomically (recon row WEB-24) — out of the IMP-011 spec

`collections.ts:339-345` still does:

```ts
storage.setItem(COLLECTIONS_KEY, JSON.stringify(state.collections));
storage.setItem(PAPERS_KEY, JSON.stringify(state.papers));
```

IMP-011's three acceptance criteria are all about *surfacing* the failure, not about
preventing it: criterion 3 explicitly asks for a test that exercises `saveState`
"against a storage fake that throws on the second `setItem`", which is the partial-write
case, and my new `quotaStorage()` fake pins that behaviour in a test rather than changing it.
I therefore deliberately left the write order alone.

The consequence is still live: when the second write throws, `rpf.collections.v1` has already
been replaced with the new collection (including the new `paperIds`) while `rpf.papers.v1`
still holds the old snapshot map. `loadState` drops ids with no snapshot
(`collections.ts:318-323`), so on the next reload the collection **reappears but empty** —
a worse symptom than "nothing was saved", and the new banner does not explain it (it says
storage may be full, which is true, but not that the collection is now half-written).

A fix would have to either write papers first (so a failure leaves collections pointing at
paper ids that do not exist yet — `loadState` also drops those, so the collection still
appears empty: order alone does not fix it), or stage both keys under a single versioned
key and write once. That is a data-format change to `loadState` as well, so it wants its own
item rather than a side effect of a bug-fix about surfacing an error.

## 2. `detectStorage()` masks the "storage blocked entirely" case before `saveState` ever runs

`App.tsx:33-42` probes `localStorage` with a one-byte write at mount and stores the result
in `storageAvailable`. When that probe throws, the save effect returns early
(`App.tsx:237-239`) and `saveState` is never called, so the new `saveFailed` banner stays
silent in exactly the case where the policy blocks storage outright. That case is *not*
unreported — `CollectionsView.tsx:184-189` renders "Browser storage is unavailable, so
collections will not persist after you reload" — but only on the Collections tab. A user who
never opens that tab sees nothing. Worth a follow-up that hoists the unavailable notice to
`<main>` alongside the new one; I did not do it because it is a different message for a
different failure and adding it would double the alerts in the same view.

## 3. The banner cannot be dismissed without a successful save

There is no close control on the banner, by design (criterion 2 says it clears on the next
successful save, and adding a dismiss would need its own state). Consequence: if the user
frees up space by other means and then does nothing that dispatches, the banner stays up
until they save or unsave something. An export (WEB-21/WEB-31 have no success feedback at
all) does not clear it either. Judged acceptable — the banner is accurate as long as no save
has succeeded — but a user reading it as "still broken" after they have fixed the quota is
a plausible complaint.

## 4. `saveState` still throws for a caller that passes a storage fake with no `setItem`

Unrelated to this item, noted because it bit me while writing the tests: jsdom 29 hands back
a `window.localStorage` object whose `setItem` is `undefined` (recorded in
`malformedImport.test.tsx:32`). `saveState` catches the `TypeError` and returns `false`, so
that case is handled — but `detectStorage()` also catches it and reports
`storageAvailable === false`, which means no component-level test can reach the save path
until it installs its own `Storage`. The workaround is documented in the docblock of
`web/src/__tests__/App.storage.test.tsx`.

## 5. Concurrent, unrelated edits in the working tree (not a defect — for the verifier's benefit)

While IMP-011 was in flight, another agent modified `web/src/lib/paperIndex.ts`,
`web/src/lib/__tests__/paperIndex.test.ts` and added
`web/src/__tests__/App.partialShard.test.tsx` in the same working tree. `git diff web/src/App.tsx`
contains only the IMP-011 change. The full-suite count therefore moved from 167/11 to 178/12
between two of my runs; **+11 of those tests and the extra file are not mine.**