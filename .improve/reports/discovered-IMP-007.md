# Discovered while implementing IMP-007

Found during IMP-007 ("Try again" button on the index-unavailable panel). **None of these were
fixed** — each is outside the files I was permitted to touch, or outside the item's scope.

---

## D1 — `web/src/__tests__/malformedImport.test.tsx` (concurrent agent) cannot seed `localStorage`

`TypeError: window.localStorage.setItem is not a function`, at
`web/src/__tests__/malformedImport.test.tsx:121`.

**Cause (measured, not assumed).** In this jsdom/Node pairing `window.localStorage` does **not**
resolve to a usable `Storage`. Every vitest run prints
`Warning: --localstorage-file was provided without a valid path`, i.e. Node's own experimental
`localStorage` is winning over jsdom's, and it is not fully constructed. I hit the same wall with
`window.localStorage.clear is not a function` and had to remove that line from my own test.

**Impact.** Any future component test that needs to seed or inspect persisted collections will
fail the same way. `App.tsx:32-41` (`detectStorage`) and `App.tsx:171-180` already catch the
failure and degrade, so **rendering** `App` in a test is fine — only direct `localStorage` access
breaks.

**Workaround that works (I verified it by using it):** either don't touch `window.localStorage` from
the test, or inject the existing `MemoryStorage` fake already in
`web/src/lib/__tests__/collections.test.ts:32-58` via `vi.stubGlobal`.

I messaged the IMP-154 implementer about this over the board at 06:18Z; they had already resolved
their own failure by the time I finished, so this is now a note for whoever writes the next
`App`-level test rather than an open blocker.

**Profile implication.** `REPO_PROFILE.md` §5.3 and §4.2 describe the DOM test setup but do not
mention this. Worth one line.

---

## D2 — `@testing-library/user-event` is gone from `package.json`, but the profile still lists it

`REPO_PROFILE.md` §4.2 states that `jsdom`, `@testing-library/react` **and
`@testing-library/user-event`** are devDependencies as of IMP-005. That is now false.

Measured:

```
$ grep -n "user-event" web/package.json      # no output
$ grep -c "user-event" web/package-lock.json # 0
$ ls web/node_modules/@testing-library/       # dom  react
$ npm ls @testing-library/user-event          # (empty)
```

A "Remove unused dep" agent stripped it. **Consequence for me:** I could not use `userEvent.tab()` /
`userEvent.keyboard()` for the keyboard-reachability check, and instead proved reachability with real
`page.keyboard.press("Tab")` in the browser (see `impl-IMP-007.md` §5) plus a jsdom
`button.focus()` / `document.activeElement` assertion. Both are fine; just be aware the profile's
dependency list is stale on this point.

---

## D3 — The retry affordance does **not** cover the paper-load failure (WEB-04, unchanged)

My button lives in the `!manifest && error` panel (`App.tsx:338`). The other failure shape is
untouched: if the manifest succeeds but a shard 404s, `App.tsx:390-394` shows a bare
`banner--warning` with the raw `Error.message` (e.g. `Failed to load papers-2026-W40.json
(HTTP 404)`), `PaperList` renders `papers === []`, and the user reads "No papers are available in
this window yet." There is still **no retry on that path**, and `Error.message` is still shown raw.

This is `WEB-04` in `REPO_PROFILE.md` §9 and remains open. IMP-007's spec scopes to the
index-unavailable panel only, so I did not touch it. **A reader whose index appears but whose shard
fetch fails is still stuck without an in-page recovery** — arguably the same complaint as IMP-007
raised, in the one place I could not reach.

---

## D4 — WEB-05 is now slightly more self-contradictory

The error panel tells production visitors to run `python scripts/build_index.py`, and *now also*
offers them a "Try again" button — which will not help them, because nothing they can do in the
browser will create the index. This is pre-existing `WEB-05`, now with an extra line attached. The
button is still correct (it genuinely helps on a transient network failure, which is IMP-007's
intent), so I left the text alone.

---

## D5 — Two baseline artifacts are now stale

`.improve/artifacts/baseline/baseline-feed-index-missing-desktop-1280.png` no longer matches the
shipped panel: the "Try again" button is missing from it. Measured delta vs. a HEAD build:
13.718% of pixels, bbox `(140, 128, 1140, 523)`. This is expected — the spec's own verification
method asks for a *new* pre-click panel screenshot — but whoever regenerates baselines next should
know this one cannot be byte-compared to HEAD any more. My replacement lives at
`.improve/artifacts/IMP-007/IMP-007-panel-desktop-1280.png`. Per §4.2 I did **not** overwrite any
baseline file.

---

## D6 — Superseded: the untested guard became a shipping bug

This entry originally read that `retryingRef` (the same-tick double-click guard) was "cheap
insurance, not load-bearing logic" and survived mutation testing. **That was the wrong conclusion,
and the verifier proved it wrong in a real browser:** the ref was set on the first click and never
reset, so every later click was a silent no-op and the "Try again" button was dead for the rest of
the page's life — while `disabled`/`aria-busy`, driven by separate state, showed it as enabled.

Recording it because the failure mode is worth remembering: **a guard that no test can kill is a
guard nobody will notice is broken.** The tests all passed because every one of them clicked once.
The generalisable lesson is that "no mutation kills this, so it must be dead code" is an *inference*,
not a proof — the correct response to an untestable flag was to delete it, not to argue for it. The
fix and its regression tests are in `impl-IMP-007.md` §2 and §3.

## D8 — The `manifestAttempts > 0 ? refreshManifest() : getManifest()` branch is inert and untested

`App.tsx:105-106`. The error panel is only reachable after a manifest *rejection*, and a rejected
memo is already un-memoed by `getManifest`, so `refreshManifest()` cannot change any observable
outcome in the UI. Replacing the ternary with a bare `index.getManifest()` kills no test (mutation
M8). Kept anyway, because it makes the cold-start path visibly a plain `getManifest()` rather than a
force-refetch call. Noted so nobody later mistakes it for load-bearing logic and builds on the
assumption that the retry depends on it.

---

## D7 — Playwright MCP still mangles relative screenshot paths (confirms IMP-001's finding)

`playwright_browser_take_screenshot` with `filename: "IMP-007-panel-desktop-1280.png"` wrote to
`/Users/denimpatel/Desktop/git/research-paper-feed/.playwright-mcp/IMP-007-panel-desktop-1280.png`
— created a `.playwright-mcp/` directory in the repo root, with the leading path component dropped.
Moved the files out and `rm -rf .playwright-mcp` afterwards; `git status` is clean of it. This is
the same trap IMP-001 reported and `REPO_PROFILE.md` §4.2 still documents the naive way.