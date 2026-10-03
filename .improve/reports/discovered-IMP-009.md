# Discovered while working on IMP-009

Found, **not** fixed. Listed so the next item does not rediscover them from scratch.

## 1. `App.tsx:228` `toggleCategory` seeds from the raw hash selection — this defeats IMP-009 at the last step

```ts
const current = urlState.categories ?? activeCategories;
```

`urlState.categories` is the *unvalidated* hash list. Once IMP-009 intersects
`#cat=cs.CV,cs.BI` down to `["cs.CV"]` for rendering, deselecting the `cs.CV` chip computes
`current.filter(...)` over the raw `["cs.CV", "cs.BI"]` and writes `#cat=cs.BI` back into the URL —
recreating the invisible, unremovable filter IMP-009 exists to remove, now with a UI that has just
told the user `cs.BI` is unknown.

This is *not* covered by IMP-009's acceptance criteria, but it is a one-word change
(`resolvedCategories.selected ?? activeCategories`) and leaving it out means the fix is undone by the
very next click. Full context and the paste-ready wiring are in `impl-IMP-009.md`. **Whoever wires
`App.tsx` must not skip this step.**

Owner: whoever applies the IMP-009 wiring. Not fixed here because `App.tsx` is off-limits to me.

## 2. `manifest.categories` has no runtime validation, so it is a live single point of failure for any consumer

`paperIndex.fetchManifest` does `return (await response.json()) as IndexManifest;`
(`paperIndex.ts:118`) — a bare cast. `manifest.categories` is typed `string[]` but nothing checks it.
Today that is invisible because the only consumers are `App.tsx:375` (`.join`) and `FeedControls`
(iterating for chips). Any new code that does `new Set(manifest.categories)` gets character-wise
iteration for a string payload (`new Set("cs.CV")` → `{"c","s",".","C","V"}`), which silently
destroys the value.

This is profile row **WEB-07** / trap 1, already known; not a new finding. Recorded here only because
IMP-009 is the first change to make `manifest.categories` load-bearing in a way that fails quietly.
IMP-009 defends its own call site (`resolveCategories` rejects a `valid` that is not an array of
non-empty strings). The general fix — validating the manifest shape — remains open and is not mine.

## 3. `readHash` is still the only place the hash is parsed, and it is still called at a point where nothing can be validated

`App.tsx:64` (`useState(() => readHash())`) and `App.tsx:76` (`hashchange` → `readHash()`) both run
before/independently of `manifest`, and neither re-runs when `setManifest` lands. Any future hash
parameter that needs real data (a `#paper=<id>` deep link, IMP-033) will hit the same wall, and the
same conclusion applies: validate in a render-time derived helper, never by awaiting inside
`readHash`. Noting it so IMP-033 does not re-derive the analysis.

## Not reported (owned elsewhere, per profile §10)

- `#sort=relevance` with no `q` — IMP-008 / WEB-14.
- `writeHash` permanently emitting `cat=` and "All categories" not being representable —
  IMP-010 / WEB-16, WEB-17.
- `manifest.retentionDays` written but never read — WEB-10.
