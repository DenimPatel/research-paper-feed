# Discovered during IMP-143 — found, not fixed

Scope note: I implemented only IMP-143. This is a defect I ran into while doing that item's
browser verification. It is **not** part of IMP-143 and I did not touch it.

---

## D-1 — `applyState` clobbers itself when two filter changes batch into one React tick

**Severity:** low / latent. No user-reachable path today.
**Location:** `web/src/App.tsx` — `applyState` (`useCallback` over `setUrlState`), and every
`setView` / `setQuery` / `setRecency` / `setSort` / `toggleCategory` built on it.

`applyState` computes the next state from `urlState`, the value captured in the current render,
and commits it with the non-functional `setUrlState(next)`. Under React 18's automatic batching,
two such calls dispatched inside the same task both read the *same* stale `urlState`, so the second
silently discards the first's change. `writeHash` is called eagerly with the fresh object, so the
address bar is right for a moment and then gets rewritten — meaning the *hash* ends up wrong too,
not just the state.

**How it was found.** My first browser probe fired four clicks inside a single `page.evaluate()`
call. Result:

```
after toggling cs.RO off   #q=diffusion&cat=cs.CV%2Ccs.LG%2Ccs.CL%2Ccs.AI   (replace)
after recency=30           #q=diffusion&recency=30                          <-- cat gone
after sort=relevance       #q=diffusion&sort=relevance                      <-- cat gone
after Collections          #view=collections&q=diffusion                    <-- cat, recency, sort gone
```

Every step is exactly `{...staleUrlState, oneField}`. Redoing the same clicks as four separate
tasks (one React tick each) produced the correct cumulative hashes with no lost updates, which
confirms batching is the cause and not the serialization.

**Why it is latent.** Every control is a distinct DOM click handler, and a human cannot dispatch
two clicks in one JS task. It needs a programmatic dispatch loop, a future feature that changes
two filter fields from one handler, or a keyboard-shortcut layer that maps several bindings to one
tick.

**Why it still matters.** IMP-132 / IMP-133 build directly on this module and may well add
keyboard shortcuts or bulk actions — exactly the shapes that trip this. A one-line fix is
available: give `setUrlState` a functional update (`setUrlState((current) => ({ ...current,
...patch }))`) and derive the hash from the same patch, which also stops `writeHash` from being
called with a state that React then overwrites. `HashState`'s shape does not change, so nothing in
`urlState.ts` needs to move.

**Not introduced by IMP-143.** Confirmed: `git show HEAD:web/src/App.tsx` has the identical
`applyState`/`setUrlState` structure; IMP-143 only moved `readHash`/`writeHash` out of the file.
My `writeHash` signature change (returning `{ hash }`) has no bearing on this.

---

## D-2 — profile line references for the URL-state code are now stale

Not a code defect, an accounting one, but it will misdirect whoever works the URL-state items next.

`REPO_PROFILE.md` cites `App.tsx` line numbers for code that now lives in
`web/src/lib/urlState.ts`: §5.3's routing note (`readHash()` `:38`, `writeHash()` `:61`), the
constants list (`DEFAULT_RECENCY = 60` at `App.tsx:25`, `RECENCY_VALUES` at `App.tsx:26`), and bug
rows **WEB-33**, **WEB-34**, **WEB-36**, **WEB-14**, **WEB-15**, **WEB-16** — every one of which
points at the line numbers of `readHash`/`writeHash`. **WEB-37** (the reason this item exists) is
now fixed.

The profile is not in my allowed edit scope, so I left it alone. Whoever owns the profile should
re-point those rows at `web/src/lib/urlState.ts` and strike WEB-37. Details in
`.improve/reports/impl-IMP-143.md` §4.3.