# Discovered while implementing IMP-016 — not fixed here

Observations from working on IMP-016 that are outside its scope. Nothing below was
touched. Per `.improve/REPO_PROFILE.md` §1 this is advisory; triage decides.

---

## 1. `title` becomes the accessible name of the `role="alert"` notice — the screen reader is told the file name, not the week

**Where:** `web/src/App.tsx`, the partial-shard notice (`banner banner--error[role="alert"]`).

**Evidence.** With only `papers-2026-W39.json` corrupted, Playwright's accessibility
tree reports the alert as:

```
- 'alert "papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. Try regenerating the index."'
  - strong: Some papers could not be loaded.
  - text: One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown.
```

The visible text now names the week (IMP-016 fixed that), but `title` **overrides**
the element's text for the accessible name computation, so a screen-reader user is
announced the raw file name and HTTP-flavoured message and never hears the prose.
This is the same `title`-as-sole-carrier problem IMP-016 closed for sighted touch
users, still standing for assistive technology — a different audience, same root
cause: a `title` attribute was used as the only place information lived.

**Why not fixed here.** Moving the detail out of `title` into a visible-but-secondary
element, or into `aria-describedby`, changes what is announced and is a judgement
call about a11y priority order. It also collides with IMP-017, which owns rewriting
the `Error.message` copy this `title` is built from. Doing it in IMP-016 would mean
touching either IMP-015's landed notice shape or IMP-017's copy — both out of scope,
and IMP-017 is a better moment for it because the message text is being changed there
anyway.

**Suggested owner:** IMP-017, or a new item.

---

## 2. The load failure keeps stale papers on screen, labelled as the new window

**Where:** `web/src/App.tsx` — the `error && !loadFailed` branch.

**Evidence.** The paper-load effect's `catch` sets `error` but does not clear
`papers`. So: load the 60-day window successfully (2 812 papers), then switch to a
7-day window whose shards all fail. Result: `error` is set, `papers` still holds the
60-day feed, and the user sees the 60-day papers presented as the 7-day window, under
a bare warning banner. `loadFailed` is correctly `false` here (there *is* something
on screen), so the new panel does not apply and the pre-existing banner does.

This is pre-existing behavior and IMP-016 deliberately left it alone — the honest
statement about a stale feed is a different defect from the three IMP-016 owns, and
"papers you are looking at are not the window you selected" is a bigger claim than
"these failed to load". Flagging it because it is the one reachable path where
`error` is set and the feed is populated, i.e. the exact case IMP-016's new branch
does not cover.

**Suggested owner:** new item, or fold into IMP-017 (both are "the copy does not
describe what is on screen").

---

## 3. A genuinely empty window and a load failure are now visually different, but a *partially* loaded window can still read as complete

**Where:** `web/src/App.tsx`, `web/src/components/PaperList.tsx`.

**Evidence.** With one shard failing, the page shows the partial notice **and** a feed
whose `.controls__count` reads "2549 papers match" — a count, not "2549 of 2812". The
notice above it does say the feed is incomplete and names the missing week, so the
information is present; but the count itself never acknowledges that 263 papers are
absent. A reader who only glances at the count is told a complete-looking number.

Not fixed here: it is IMP-015's notice's job rather than IMP-016's, and changing
`resultCount`'s wording would ripple into `App.relevance.test.tsx` and the
`PaperList` prop contract.

**Suggested owner:** new item.

---

## 4. jsdom 29's `localStorage` is still not a function — IMP-011's save banner needs a stub to be reachable at all

**Where:** `web/src/test-setup.ts`, `web/src/lib/storage.ts`.

**Evidence.** The `--localstorage-file` Node warning appears on every test run, and
`detectStorage()` returns `false` under jsdom, so the save effect never runs and
IMP-011's "Collections could not be saved" banner cannot appear in any test without a
stub. First recorded by INF-15 and re-confirmed by IMP-011; it is still open.

IMP-016 did not fix it either — out of scope — but worked around it with a local
`FullStorage` stub in `App.loadFailure.test.tsx` (which *implements* `Storage`
properly, unlike the throw-only stub at `App.storage.test.tsx:63-70`). That stub is
the one place in the suite where a `Storage` exists, which is a hint that the real
fix belongs in `test-setup.ts` so every item stops re-deriving it.

**Suggested owner:** new item; the evidence has now been collected twice independently.
