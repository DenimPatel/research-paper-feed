# Discovered while implementing IMP-015 — NOT fixed here

IMP-015 was scoped to `web/src/lib/paperIndex.ts` and tests. These are adjacent problems I found while
implementing it and deliberately did **not** touch. Nothing here is a regression from IMP-015.

---

## 1. `PapersLoadResult.failedFiles` has no consumer — the AC2 warning does not exist yet

**Severity:** blocks AC2 of IMP-015 · **Owner:** whoever next owns `web/src/App.tsx`

`loadPapers` now resolves with `result.failedFiles` (`web/src/lib/paperIndex.ts:203-262`), but
`App.tsx:154-171` ignores it:

```tsx
      ?.loadPapers(urlState.recency, (next) => { … })
      .then((list) => {
        if (!cancelled) {
          setPapers(list);          // ← `failedFiles` dropped on the floor
```

So today a partial shard failure renders a **complete-looking feed with no warning at all** — the
papers are right, but nothing tells the reader a week is missing. IMP-015's AC2 ("the app renders as a
non-blocking warning naming the missing shard") is therefore **half-landed**: the signal ships, the
render does not. I was forbidden from editing `App.tsx` (a concurrent agent was working in it), so the
exact 6-line patch is in `impl-IMP-015.md` §6. Please apply it as part of accepting IMP-015, or open a
follow-up item — do not close IMP-015 as fully done on the strength of the library change alone.

## 2. IMP-015 AC2 and IMP-017 AC2 contradict each other on the visible text

**Severity:** spec conflict · **Owner:** whoever writes the warning copy

- IMP-015 AC2 requires the warning to **name the missing shard**.
- IMP-017 AC2 requires that **no rendered user-facing string contains a file name** in the primary
  message, permitting the technical detail only in a `title` attribute or `console.error`.

The reconciliation is mechanical — put `failedFiles.map(f => f.file).join(", ")` in the `title`
attribute of the banner and keep reader-facing prose in the text — but the two items are written as if
each is the only consumer of this state. Worth reconciling in `FEATURES.md` so the next implementer
does not pick one criterion and fail the other. I deliberately did **not** invent a formatter in
`paperIndex.ts` for the same reason: `ShardLoadFailure.message` still carries the raw
`Failed to load papers-2026-W39.json (HTTP 404).` string, and turning that into reader copy is IMP-017's
job, not mine.

## 3. `App.tsx:408` still gates the hard error panel on `!manifest`, so "all shards failed" is a bare banner

**Severity:** known debt (profile WEB-03 / IMP-016) · confirmed still live, not fixed

I confirmed by test (`web/src/__tests__/App.partialShard.test.tsx`, second case) that when **every**
shard in the window fails, the app renders `App.tsx:464-468` — `banner banner--warning role="alert"`
containing the raw `Failed to load papers-2024-W09.json (HTTP 404).` — and `PaperList` with
`papers === []`, i.e. the user reads "No papers are available in this window yet." for what is a total
load failure. This is exactly profile row **WEB-03** and backlog item **IMP-016**, which owns the fix.
No action needed; recorded so a verifier does not attribute it to IMP-015, whose AC3 only required that
the rejection path still *reject* (it does, byte-identically to the old `Promise.all` error).

## 4. The hero's `totalPapers` is the manifest total, not the number actually loaded

**Severity:** cosmetic, pre-existing · **Owner:** unassigned

Observed in the real-browser run with a shard deleted: the hero reads "2,812 papers from cs.CV, cs.LG,
cs.CL, cs.AI, cs.RO · index generated Oct 1, 2026" while the feed correctly shows 2,549 papers match.
`App.tsx:444` prints `manifest.totalPapers`, which is written by `build_index.py` from the *intended*
index. Even with the IMP-015 warning wired up, the hero and the warning will disagree. The warning is
the authoritative source; the hero line arguably should read from the loaded count, or the hero should
be left alone and the warning treated as the caveat. Small, but it will look like a bug once the
warning ships.

## 5. `ShardLoadFailure.message` is a raw technical string — by design, but do not render it

Not a defect; a trap for the follow-up. `message` reproduces `loadShard`'s existing throw text
(`Failed to load X (HTTP 404).` / `Shard X is missing or malformed. Try regenerating the index.`).
It is the right thing to carry in a data structure (it preserves the HTTP status IMP-017 AC1 wants in a
`title` attribute) and the wrong thing to put in the visible banner. If the App wiring prints
`failure.message`, IMP-017's AC2 fails on day one.