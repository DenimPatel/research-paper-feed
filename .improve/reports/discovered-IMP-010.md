# Discovered during IMP-010

Found while verifying IMP-010. **Not fixed** — outside that item's scope. Recorded so the
backlog can decide.

## 1. `toggleCategory` cannot absorb two toggles in one React batch

`web/src/App.tsx` — `toggleCategory` (pre-existing; untouched by IMP-010)

`toggleCategory` derives its result from the `urlState`/`activeCategories` captured in the
current render closure, then calls `applyState`. If two toggles are dispatched before React
re-renders, both compute from the same stale base and the second overwrites the first — so
N same-tick clicks produce **one** effective toggle, not N.

Reproduced in the browser during IMP-010 verification by dispatching all five chip clicks
in a single `evaluate` tick: only `cs.RO` came off (`#cat=cs.RO`), where five sequential
clicks with awaits in between correctly reached `#cat=`.

**Not user-reachable.** Two real clicks are always separated by a render. This only bites
programmatic/synthetic dispatch — test code that fires several `fireEvent.click`s without
awaiting, or a future batched/keyboard-automation path. IMP-010's new "All" chip does not
have this problem, since it is idempotent.

Worth knowing mainly as a trap for future test authors, who may write a multi-chip test
that silently passes for the wrong reason. Left alone deliberately — fixing it means
switching `toggleCategory` to the functional `setUrlState` updater form, which is a
behavioural change to a freshly landed code path and not something to smuggle into a
different item.

## 2. jsdom reports a bare `#` fragment as no fragment at all

Test-harness detail, not a product bug, but it surprised me and will surprise the next
person.

`writeHash` returns the string `"#"` for an all-defaults state. jsdom's URL parser stores a
URL ending in a bare `#` as an *empty* fragment and reports `window.location.hash === ""`,
where a real browser reports `"#"`. So an App-level assertion of `toBe("#")` on
`location.hash` fails under vitest even though the app is correct.

Existing IMP-009 test already used the right idiom (`not.toContain("cat=")`), which is why
this was not hit before. Recorded so the next person does not "fix" a passing test to
`toBe("")` and cement a jsdom-specific expectation.