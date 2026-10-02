# Discovered while implementing IMP-008 — not fixed

Per the brief, nothing outside IMP-008 was changed. These are observations only.

---

## D-1 (highest value) — Concurrent editors on `web/src/lib/urlState.ts` lose updates

**Observed, not inferred.** During my session another agent was mid-change on
`web/src/lib/urlState.ts` and `web/src/lib/__tests__/urlState.test.ts` for IMP-009. My first `Edit`
against `urlState.ts` returned `Could not find oldString in the file` because the file had changed
between my read and my write. I recovered by re-reading and re-applying, but **any agent that reads a
shared file and writes back later can silently clobber another agent's hunk**, and neither of us
would see it in our own diff. This loop runs several agents on one tree with no locking, no
worktrees per item, and no merge step.

The file now carries IMP-009's `resolveCategories` + `validCategories` *and* my `query` hoist +
`sort` gate in the same function body. They happen not to overlap textually. That is luck, not design.

**Suggestion:** one file per item where possible; when two items must share a file, the brief should
say so explicitly rather than relying on agents to notice each other's `git status`. A pre-commit
`tsc --noEmit` gate would catch a *syntax* clobber but not a semantically valid revert.

---

## D-2 — The brief's allowed-modify list contradicts IMP-008's acceptance criteria

The brief says I may only modify `App.tsx`, `FeedControls.tsx`, `search.ts`, their tests, and new
files under `web/src/__tests__/`. Criteria 2 and 3 both mandate changing and testing
`web/src/lib/urlState.ts`. The lists were written assuming `urlState.ts` was off-limits; the item was
written assuming it was the fix site. I followed the item. Worth reconciling so the next agent does
not stall on it.

---

## D-3 — No `.hint`-ish CSS class exists; `.controls__count` is the only muted small-text style

`styles.css` has no generic secondary/hint style (full selector list checked: `.controls__search
input`, `.controls__row`, `.controls__group`, `.controls__group legend`, `.chips`, `.chip*`,
`.controls__count`, then card/panel/banner classes). `.paper__note:373` and `.empty:554` are the only
other muted rules and both belong to other blocks.

So a hint needs either a new `.controls__hint` rule in `styles.css` or reuse of `.controls__count`.
I reused, because `styles.css` was do-not-touch. It looks right (verified at 1280 and 390) but
`class="controls__count"` on a sentence that is not a count is a readability wart. A one-line
`.controls__hint { margin: 0; font-size: 0.9rem; color: var(--text-muted); }` next to
`.controls__count:285` would be the clean fix. **CSS task, not mine.**

---

## D-4 — Relevance preference is remembered in memory but not in the URL

Sequence: type `diffusion` → click Relevance → clear the search box → retype `diffusion`.
The chip re-presses and the list is relevance-ranked again, with no second click. That is because
`App.setQuery` spreads the existing `urlState`, so `sort: "relevance"` survives in memory, while
`writeHash` (after my guard) omits it from the URL.

The state is **consistent** — pressed chip, relevance order — so it is not a lie. But it is
surprising: the URL says nothing, yet the app acts on a preference the user cannot see. If the
intended design is "relevance is a property of the current query and does not persist", then
`App.setQuery` should reset `sort` to `"newest"` when the query empties. If the intent is "remember
the preference", it is working. **This is a product decision, not a bug — I did not change it.**

---

## D-5 — `visiblePapers` agrees with the chip only by coincidence

`App.tsx:181-198` branches on the raw `urlState.sort` after its own `if (!query) return inCategories`
guard. That guard happens to implement the same rule as the chip's `effectiveSort`, which is why the
component needs no knowledge of `App`'s internals. **If anyone reorders those two branches** — e.g.
"apply relevance first, then filter" — the chip will still un-press while the list is relevance-ranked,
and the bug returns. A comment or a shared `effectiveSort` would make the coupling explicit. I left
`App.tsx` untouched because no criterion requires it.

---

## D-6 — The new hint is not announced by screen readers

It toggles as the user types, so adding `role="status"` / `aria-live` would create a second chatty
live region (WEB-56 already flags the result count). I deliberately used plain text. Consequence: a
screen-reader user clearing the search box gets no announcement that Relevance became unavailable.
The pressed state of the Newest chip is discoverable by re-navigating to the Sort group. Arguable
either way; flagging so it is a decision, not an oversight.

---

## D-7 — Trivial: the Relevance chip's `title` tooltip was dead code

Removed as part of this item, but worth recording why it was useless: `title` on a `disabled` button
does not fire `mouseenter` in Chromium, and the button was `disabled` in exactly the state where the
title mattered. There is no other `title` attribute in `web/src`. Checked with
`grep -n "title=" src/components/*.tsx` — none remain.

---

## Not re-reported (already known per `REPO_PROFILE.md`)

PE-1..PE-16 / INF-* rows, `npm run lint` not existing, WEB-33 bare `#`, WEB-34 history semantics,
WEB-48 loading-state count, WEB-49 number formatting. All already documented; none re-raised.
