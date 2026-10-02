# IMP-008 — Independent verification

**Verifier verdict: FAIL** (2 of 3 acceptance criteria met; the third fails nondeterministically)
**Item spec:** `.improve/FEATURES.md:260-274`
**Implementer's report:** `.improve/reports/impl-IMP-008.md`
**Tree state:** `improve/auto-20261002`, nothing committed. No git write command was run by this
verifier. No source file was modified by this verifier. `.kilo/worktrees/mildly-income` was not read
or written.

---

## 0. Hunk attribution — which diff lines belong to IMP-008 and which to IMP-009

The working tree carries both items interleaved in `web/src/lib/urlState.ts` and
`web/src/lib/__tests__/urlState.test.ts`. Attribution below is from the implementer's own §1 and
its "Concurrency hazard" note (impl-IMP-008.md:29-46), cross-checked against
`.improve/reports/impl-IMP-009.md:11-28`.

### IMP-008 hunks (verified here)

| Location | Change |
| --- | --- |
| `web/src/lib/urlState.ts:96` | `const query = params.get("q") ?? "";` — hoisted so `sort` can read it |
| `web/src/lib/urlState.ts:103-110` | `sort: query.trim() !== "" && params.get("sort") === "relevance" ? "relevance" : "newest"` |
| `web/src/lib/urlState.ts:148-153` | `writeHash`: `if (state.sort !== "newest" && state.query.trim() !== "")` |
| `web/src/components/FeedControls.tsx:30-35` | `relevanceAvailable` + `effectiveSort` |
| `web/src/components/FeedControls.tsx:94-109` | chips read `effectiveSort`; `title` tooltip removed |
| `web/src/components/FeedControls.tsx:111-117` | visible hint `<p className="controls__count">` |
| `web/src/lib/__tests__/urlState.test.ts:77-93` | the modified *falls back to newest for an unknown sort* body, plus 3 new `readHash` tests (`:82`, `:86`, `:90`) |
| `web/src/lib/__tests__/urlState.test.ts:254-280` | 3 new `writeHash` tests |
| `web/src/__tests__/feedControls.test.tsx` | new file, 8 tests — IMP-008 only |
| `web/src/__tests__/App.relevance.test.tsx` | new file, 3 tests — IMP-008 only |

### IMP-009 hunks — **present, out of scope, deferred to the IMP-009 verifier**

`urlState.ts:16-22` (`CategoryResolution`), `:24-73` (`resolveCategories`), `:75-84` (the
`validCategories` parameter), `:93-95` and `:101` (`categories` routed through
`resolveCategories`); and `urlState.test.ts:11-12` (`MANIFEST_CATEGORIES`), `:113-155` (6 new
`readHash` tests) and `:158-247` (13 new `resolveCategories` tests) — 19 tests, matching
impl-IMP-009.md's own "+19 tests (18 → 37)".

Arithmetic check: HEAD had 18 tests in `urlState.test.ts`; the file now has 43; 18 + 19 (IMP-009) +
6 (IMP-008 new) = 43. Exact. (impl-IMP-008.md:229-230 says "the remaining +2 are IMP-009's" —
that counts only what landed after its 03:22 baseline of 113/7 files, not IMP-009's total. Not an
error, but easy to misread.)

**IMP-009 does not modify `App.tsx`, so `resolveCategories` is not yet wired into the app.**
`App.tsx:64` and `App.tsx:76` still call `readHash()` with no second argument, so
`validCategories` is `undefined` and the `cat=` list is passed through de-duplicated but otherwise
untouched. IMP-009's own report says so. **No action taken — IMP-008 is unaffected.**

---

## 1. Acceptance criteria

### Criterion 1 — empty trimmed query ⇒ Relevance un-pressed, no `chip--active`, visible hint — **MET**

`FeedControls.tsx:33-35` derives `relevanceAvailable = query.trim() !== ""` and
`effectiveSort`, and `:95-96` make `active` and `unavailable` read from those, not from the raw
`sort` prop. Proved three ways:

- Unit: `feedControls.test.tsx:60-98` asserts `aria-pressed="false"`, no `chip--active`,
  `disabled` present, exactly `["Newest"]` pressed, hint present, hint is a real `<P>` with no
  `sr-only`/`hidden`/`aria-hidden`, and the whitespace-only query case.
- Component (App): `App.relevance.test.tsx:86-100`.
- Live browser: probe output in §3, scenario A and B. `Relevance {pressed: "false", active: false,
  disabled: true}`, `pressed: ["Newest"]`, `hintVisible: true`,
  `hintText: "Enter a search term to sort by relevance."`.

The hint is genuinely visible, not a tooltip: `getComputedStyle` reports `font-size 14.4px`,
`color rgb(102, 102, 97)` — identical to the existing `.controls__count` muted style
(`web/src/styles.css:285-289`), and `scrollWidth <= clientWidth` at 390px. Screenshots
`.improve/artifacts/IMP-008/verify-IMP-008-relevance-hash-only-desktop-1280.png` and
`…-mobile-390.png` confirm it renders inside the Sort fieldset, left-aligned with the chips.

### Criterion 2 — `readHash` never yields `sort: "relevance"` with no `q` — **MET**

`urlState.ts:107-110`. Verified by `urlState.test.ts:86-88` (verbatim the spec's assertion),
`:90-93` (blank `q=` and `%20%20`), and `:82-84` (positive control `#q=diffusion&sort=relevance` →
`relevance`). Live: loading `#sort=relevance` cold gives `Newest [pressed]`, `Relevance [disabled]`
un-pressed on **first render** (Playwright snapshot, no interaction).

### Criterion 3 — new `urlState` test + `FeedControls` `aria-pressed` component assertion + `npm run typecheck && npm test` passes — **NOT MET**

Parts (a) and (b) are met (`urlState.test.ts:86-88`; `feedControls.test.tsx:60-67`).
Part (c) is not: **`npm test` fails nondeterministically because of a test IMP-008 added.** Full
detail in §4 below. `npm run typecheck` is clean (exit 0).

**Score: 2/3.**

---

## 2. Non-vacuity — independently reproduced, and the "12 of 17" number is correct

Built a scratch copy at `/tmp/rpf-imp008-verify` (`tar` of `web/` minus `node_modules`/`dist`/
`public`, with `node_modules` symlinked back). Reverted **only** the IMP-008 conditions, so
IMP-009's code stayed intact and IMP-009's tests stayed runnable:

- `src/components/FeedControls.tsx` ← `git show HEAD:web/src/components/FeedControls.tsx`
- `src/lib/urlState.ts:107` ← `sort: params.get("sort") === "relevance" ? "relevance" : "newest"`
- `src/lib/urlState.ts:151` ← `if (state.sort !== "newest")`

Assertions in the check: `query.trim() !== ""` gone from `urlState.ts`; `resolveCategories` and
`validCategories` still present at `:37`, `:79`, `:83`, `:101`; no `effectiveSort`,
`relevanceAvailable` or hint text in the reverted `FeedControls.tsx`.

IMP-008's three test files were then run **unmodified**:

```
$ cd /tmp/rpf-imp008-verify && npx vitest run src/lib/__tests__/urlState.test.ts \
    src/__tests__/feedControls.test.tsx src/__tests__/App.relevance.test.tsx

 × readHash > falls back to newest when sort=relevance arrives with no query
   → expected 'relevance' to be 'newest'
 × readHash > treats a blank or whitespace-only query as no query for sort
   → expected 'relevance' to be 'newest'
 × writeHash > omits a relevance sort that no query could justify
   → expected '#sort=relevance' to be '#'
 × writeHash > omits a relevance sort for a whitespace-only query
   → expected '#q=+++&sort=relevance' to be '#q=+++'
 × writeHash > round-trips a relevance hash whose query was cleared away
 × FeedControls relevance chip > un-presses Relevance and explains why once the query is cleared
   → expected 'true' to be 'false'
 × FeedControls relevance chip > names Newest as the sort in effect when relevance is unavailable
   → expected [ 'Relevance' ] to deeply equal [ 'Newest' ]
 × FeedControls relevance chip > shows a visible hint, not a tooltip, when relevance is unavailable
 × FeedControls relevance chip > treats a whitespace-only query as no query at all
   → expected 'true' to be 'false'
 × FeedControls relevance chip > leaves the default newest sort untouched with no query
 × relevance sort over a deep link > lands on a date-ordered feed for #sort=relevance with no q
   → expected 'true' to be 'false'
 × relevance sort over a deep link > un-presses Relevance when the search box is cleared, and rewrites the hash

 Test Files  3 failed (3)
      Tests  12 failed | 42 passed (54)
```

**12 of IMP-008's 17 tests fail without the relevance hunks.** All 12 are IMP-008's own tests; the
split is 3 `readHash` + 3 `writeHash` + 5 `FeedControls` + 2 of 3 `App.relevance`. IMP-009's 19
tests all passed in the same run, which confirms the revert was surgical. The 5 that pass either
way are the non-regression guards named in impl-IMP-008.md:269-271 — *presses Relevance while a
search term is present*, *keeps the hint out of the way*, *still enables Relevance with a query*,
*still honours #q=…&sort=relevance*, *…and rewrites the hash* (its first assertion). **The
implementer's number and its reasoning are accurate.**

### No existing test weakened, skipped, or deleted

```
$ git show HEAD:web/src/lib/__tests__/urlState.test.ts | rg -o 'it\("[^"]+"' | sed 's/it("//' | sort > /tmp/orig_names.txt
$ rg -o 'it\("[^"]+"' web/src/lib/__tests__/urlState.test.ts | sed 's/it("//' | sort > /tmp/new_names.txt
$ comm -23 /tmp/orig_names.txt /tmp/new_names.txt
(no output)
```

All 18 original test names survive — nothing deleted or renamed. `rg "\.(skip|only|todo)|xit\(|xdescribe\("`
across all three IMP-008 test files: **no matches**. `git status --porcelain` shows the only
pre-existing test file touched is `urlState.test.ts`; `search`, `collections`, `paperIndex`,
`App.retry`, `malformedImport`, `domEnvironment` are all untouched, so nothing there could have
been weakened.

The one in-place body change is disclosed and legitimate: *falls back to newest for an unknown
sort* previously asserted `readHash("#sort=relevance").sort === "relevance"`, which criterion 2
directly reverses. Its replacement keeps both original concerns (`#q=diffusion&sort=oldest` → newest
for an unknown value; `#q=diffusion&sort=` → newest for an empty value) and the deleted assertion's
subject is now covered by a dedicated test at `:86`. Coverage preserved, not weakened.

---

## 3. Consistency proofs — the UI can no longer lie, in every state I could construct

All measured against the **production build** (`npm run build`, then `vite preview` on port 5200),
real 2,812-paper index. `hash` is the literal `location.hash`; chips are
`{label, aria-pressed, chip--active, disabled}`; `firstDates` are the first 8 rendered
`time[datetime]` values.

| # | State | Chip shows | Feed actually does | Hash after | Verdict |
| --- | --- | --- | --- | --- | --- |
| A | empty query, default sort (no hash) | Newest `pressed/active`; Relevance `un-pressed, disabled`; hint shown | 2812 papers, first 8 all `2026-10-01` = date order | `""` | agrees |
| B | `#sort=relevance`, no `q` (cold load) | Newest `pressed/active`; Relevance `un-pressed, disabled`; hint shown | 2812 papers, first card `Geometric Similarity in VLM Low-Level Vision…`, date order | `#sort=relevance` (unchanged) | **agrees**; see note (b) |
| C | `#q=%20%20&sort=relevance` | Newest `pressed/active`; Relevance `un-pressed, disabled`; hint shown; box shows `"  "` | 2812 papers, date order | `#q=%20%20&sort=relevance` (unchanged) | **agrees** — the naive `q === ""` trap is avoided; `trim()` is used in both `urlState.ts:108` and `FeedControls.tsx:33` |
| D | `#q=zzqqxxvvww&sort=relevance` (zero matches) | Relevance `pressed/active`, enabled; hint hidden | 0 papers | unchanged | **agrees** — a query *is* present, so relevance *is* being applied; `rankPapers` filters `score > 0` (`search.ts:84`) so relevance can never surface a non-matching paper. Newest would also yield 0. Not a lie |
| E | `#q=diffusion&sort=relevance` | Relevance `pressed/active`, enabled; hint hidden | 168 papers, first `Hierarchical Continuous Diffusion Language Models` (2610.02193) | unchanged | **agrees and proves relevance ordering is real** — 2610.02193 is *not* the newest paper (the date-ordered list starts at 2610.00848), so the ordering is genuinely by score |
| F1 | type `diffusion`, click Relevance | Relevance `pressed/active` | 168 papers, relevance order | `#q=diffusion&sort=relevance` | agrees |
| F2 | clear the box while Relevance pressed | Newest `pressed/active`; Relevance `un-pressed, disabled`; hint shown | 2812 papers, date order | `""` — **`sort=relevance` removed** | agrees |

Two design judgements to record explicitly:

**(a) Deriving both chips, not just suppressing Relevance, is the right call.** Exactly one chip in
the Sort group is pressed in every row above. Suppressing Relevance alone would have left *no*
pressed chip in rows A/B/C/F2, which is a weaker form of the same lie.

**(b) On the downgrade the URL is NOT scrubbed — and the behaviour is self-consistent.** In rows B
and C the address bar still literally says `sort=relevance` while the app is in newest mode. The
chosen behaviour is nonetheless self-consistent, because:

- the **control and the list agree with each other**, which is the property the spec demands
  ("the Relevance control and the actual sort order always agree"). Neither the chip nor the list
  lies.
- it is **idempotent**: reloading `#sort=relevance` yields the identical state, so there is no
  URL/state oscillation and no history-entry churn.
- it **self-heals on the next write**: row F2 shows `sort=relevance` leaving the URL the moment any
  state change runs through `writeHash`, thanks to `urlState.ts:151`. Any chip click, view switch,
  recency change or keystroke scrubs it.

The residual is cosmetic: a user who shares `#sort=relevance` and never touches the page leaves a
misleading string in their own address bar. No acceptance criterion asks for scrubbing, and
scrubbing on load would need an effect in `App.tsx` (a `replaceState` write after first render),
which is a wider change than the bug warrants. **Recorded as an observation, not a failure.** If a
backlog item wants the address bar to self-heal on load, that is IMP-009/IMP-010's neighbourhood,
not IMP-008's.

**One deliberate behaviour worth knowing (impl-IMP-008.md:128-133):** clearing the box while
relevance is pressed leaves the in-memory `sort` as `"relevance"`, so retyping a query
**re-enables relevance without a second click**. This is truthful — the list is relevance-ordered
again — but it is a UX judgement call, not a bug. The user can also observe the same effect by
pressing Newest (which clears the in-memory sort). Flagged for the backlog owner's awareness.

**`App.tsx` genuinely needed no change — verified, not assumed.** `visiblePapers`
(`App.tsx:181-198`) short-circuits on `const query = urlState.query.trim()` at `:189-192`
*before* it ever reads `urlState.sort` at `:193`. The two predicates that matter,
`App.tsx:189`'s `urlState.query.trim()` and `FeedControls.tsx:33`'s `query.trim()`, are the same
expression over the same string. The only path that can leave `sort: "relevance"` in memory with an
empty query is `setQuery("")` (`App.tsx:215-217`), and on that path the `:190` guard fires first, so
the relevance branch is unreachable. The chip cannot disagree with `visiblePapers` because both ask
the identical question of the identical value.

---

## 4. Commands, verbatim

Node v25.6.1, npm 11.9.0. All from `web/`.

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0          # clean, no output
```

```
$ npm test          # run 1 of 12
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 10ms
 ✓ src/lib/__tests__/paperIndex.test.ts (16 tests) 19ms
(node:98445) Warning: `--localstorage-file` was provided without a valid path
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 70ms
 ✓ src/__tests__/feedControls.test.tsx (8 tests) 376ms
 ❯ src/__tests__/App.relevance.test.tsx (3 tests | 1 failed) 464ms
   × relevance sort over a deep link > still honours #q=…&sort=relevance, so the fix does not disable relevance
     → Unable to find an element with the text: Diffusion Models for Everything.
 ✓ src/lib/__tests__/urlState.test.ts (43 tests) 12ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 532ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 83ms

 Test Files  1 failed | 8 passed (9)
      Tests  1 failed | 131 passed (132)
TEST_EXIT=1
```

**The failure is IMP-008's.** It is in `web/src/__tests__/App.relevance.test.tsx`, a file IMP-008
created, and it is the test whose whole purpose is to prove the fix does not over-reach.

### Flake rate, measured

```
$ for i in $(seq 1 12); do npx vitest run; done
full-run 1..8:   Tests  132 passed (132)
full-run 9:      Tests  1 |          <-- FAILED
full-run 10..12: Tests  132 passed (132)
=> 1 failure in 12 full-suite runs  (~8%)

$ for i in $(seq 1 14); do npx vitest run src/__tests__/App.relevance.test.tsx; done
runs 4, 5, 10 FAILED; the other 11 passed
=> 3 failures in 14 file-only runs (~21%)
   run 10 failed BOTH assertions:
     FAIL … > lands on a date-ordered feed for #sort=relevance with no q
       → Unable to find an element with the text: A Paper About Something Else.
     FAIL … > still honours #q=…&sort=relevance, so the fix does not disable relevance
       → Unable to find an element with the text: Diffusion Models for Everything.
```

### It is not a pre-existing flake

```
$ for i in $(seq 1 14); do npx vitest run src/__tests__/App.retry.test.tsx \
    src/__tests__/malformedImport.test.tsx src/__tests__/domEnvironment.test.tsx; done
PREEXISTING_APP_TESTS_FAILURES=0 / 14
```

### Root cause

`App.relevance.test.tsx:64-68`:

```ts
async function renderFeed(): Promise<HTMLElement> {
  render(<App />);
  await screen.findByRole("heading", { name: /Recent arXiv papers/ });
  return screen.getByRole("group", { name: "Sort" });
}
```

The hero heading is gated on `manifest` (`App.tsx:367`), but `papers` are fetched by a **separate**
effect keyed on `[manifest, urlState.recency]` (`App.tsx:142-170`) that sets `loading = true` and
awaits `loadPapers`. So the heading is on screen one commit before `papers` exists. In that window
`visiblePapers` is `[]` (`App.tsx:181-198`) and `PaperList` renders the loading panel instead of
cards — the captured DOM in the failure shows exactly that: `0 papers match` /
`Loading papers from 0 weeks… (0/0)` alongside a correctly-pressed Relevance chip.

The two racing assertions are `screen.getByText(OTHER.title)` at `App.relevance.test.tsx:99` and
`screen.getByText(DIFFUSION.title)` at `:112`, both synchronous.

The repository's own convention already has the right answer: `App.retry.test.tsx` awaits the
card with `await screen.findByText(PAPER.title)` at lines 174, 192, 220 and 242. IMP-008's new file
did not follow it.

**Fix (mechanical, four characters per assertion):** change `screen.getByText(...)` to
`await screen.findByText(...)` at `App.relevance.test.tsx:99` and `:112` (both are inside `async`
`it` bodies, so `await` is legal), or await the loading panel's disappearance inside `renderFeed`.

```
$ npm run build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-DqqHF7nh.js   164.77 kB │ gzip: 52.92 kB
✓ built in 377ms
BUILD_EXIT=0
```

Build is clean and **reproduces the implementer's asset hashes byte for byte**
(`index-G-YE6pVt.css`, `index-DqqHF7nh.js`), and CSS is 10.93 kB — unchanged, confirming the hint
added no CSS, as claimed.

---

## 5. Playwright verification (production build, `vite preview` on 5200)

- `#sort=relevance` cold load: **Newest `[pressed]`**, **Relevance `[disabled]` and un-pressed**,
  hint paragraph rendered, 2812 papers, date order — on the very first render, before any
  interaction.
- `#q=diffusion&sort=relevance`: **Relevance `[pressed]`**, enabled, hint absent, 168 papers,
  relevance order (top hit `Hierarchical Continuous Diffusion Language Models`).
- Screenshots written to `.improve/artifacts/IMP-008/`:
  `verify-IMP-008-relevance-hash-only-desktop-1280.png`,
  `verify-IMP-008-relevance-hash-only-mobile-390.png`,
  `verify-IMP-008-relevance-active-desktop-1280.png`,
  `verify-IMP-008-relevance-active-mobile-390.png`.
- **Console: `browser_console_messages` returned an empty array after both navigations and all
  hash states.** Zero `console.error`, zero uncaught exceptions, zero failed requests (profile §4.2
  satisfied). `vite preview` is a production build, so there is no Vite HMR noise either.
- Server stopped; port 5200 free (verified with `lsof -ti:5200`); `.playwright-mcp/` scratch removed.
- Cross-check on the implementer's own artifacts: `feed-relevance-empty-query-desktop-1280.png` and
  `feed-relevance-hash-only-desktop-1280.png` are byte-identical
  (`sha256 36d7f53f55d68de5f…`), which is the correct and expected result — the two entry points
  now land on the same state.

### Design judgement on the hint

**It looks intentionally designed, not bolted on.** It sits inside the Sort `<fieldset>` directly
beneath that group's chip row, left-aligned with the chips and with the group's `SORT` legend, at
the same scale and muted grey as the pre-existing `.controls__count` result line further down. It
picks up the block's existing secondary-text hierarchy rather than inventing a new one, and it
disappears entirely once relevance becomes available, so there is no permanent extra line. At 390px
it wraps to nothing — one line, no overflow, no clipping. The disabled Relevance chip keeps the
standard `chip` disabled treatment, so the three states (pressed / available-unpressed /
disabled) are all visually distinct using only styles that already existed.

The only fair criticism is the one the implementer already logged (impl-IMP-008.md:341-342): the
class name `controls__count` is wrong for a hint, and a `.controls__hint` alias would read better.
That is cosmetic and was forced by `styles.css` being out of scope.

---

## 6. Does IMP-009's concurrent work break any IMP-008 behaviour?

**No. Checked directly, not assumed.**

Both agents rewrote the same `return` object literal in `readHash`, which is exactly where a lost
update would hide. I verified all five concurrent hunks are simultaneously present in the working
tree — `resolveCategories` (`urlState.ts:37`), the `validCategories` parameter (`:83`), the
`categories` local (`:94-95`), the `categories:` routing (`:101`), **and** IMP-008's `query` hoist
(`:96`) and `sort` guard (`:107-110`). No hunk was lost in either direction.

The two changes are semantically disjoint: IMP-008's guard reads only `query`; IMP-009's
`resolveCategories` reads neither `query` nor `sort` and is called with `categories` alone
(`:101`). I traced every coupling I could find:

1. **IMP-009's `leaves the other parameters alone while validating cat` test**
   (`urlState.test.ts:140-148`) asserts `sort: "relevance"` survives for
   `#view=collections&q=x&cat=cs.BI&recency=7&sort=relevance`. This test **depends on** IMP-008's
   rule not over-firing — `"x"` is a non-empty query, so it does not. It passes today, but the
   coupling is real: if IMP-008's predicate had been written as "strip relevance whenever any
   category was dropped", IMP-009's test would have caught it. That is a healthy cross-check
   between the two items, not a defect.
2. **`writeHash`'s `if (state.query)` (`urlState.ts:139`) is unchanged from HEAD** and does not
   trim. So a whitespace query still emits `#q=+++` while IMP-008's guard at `:151` drops `sort`.
   `readHash("#q=+++")` returns `{query: "  ", sort: "newest"}` — self-consistent, and both items
   agree.
3. **IMP-009's `round-trips a sanitized hash` test** (`:150-155`) uses a hash with neither `q` nor
   `sort`, so the two guards cannot interact.

**No conflict, and no IMP-008 behaviour is degraded by IMP-009's presence.** IMP-009 remains
incomplete against its own spec (its `App.tsx`/`FeedControls` wiring is absent, so a bad
`#cat=cs.BI` still filters to nothing in the running app) — that is IMP-009's item to close, and
its own report says so at lines 5-9 and 98+. **Not counted against IMP-008 here.**

---

## 7. Findings, ranked

**BLOCKER — `web/src/__tests__/App.relevance.test.tsx:99` and `:112` race the paper load.**
`screen.getByText(...)` is synchronous but the cards appear one commit after
`screen.findByRole("heading", …)` resolves (`App.tsx:367` gates on `manifest`, `App.tsx:142-170`
fills `papers` in a later effect). `npm test` fails ~8% of full-suite runs and ~21% of
`App.relevance.test.tsx` runs — measured, 1/12 and 3/14. This makes acceptance criterion 3
("`cd web && npm run typecheck && npm test` passes") not reliably satisfied, and it contradicts
impl-IMP-008.md:198-202 which reports a clean 132/132 from a single run. **Fix:** use
`await screen.findByText(...)` at both lines, matching `App.retry.test.tsx:174/192/220/242`.
Two-character change per assertion; no product code affected.

**OBSERVATION (not a failure) — the address bar keeps a stale `sort=relevance` after a downgrade
until the next write.** Rows B and C in §3. Self-consistent and idempotent, and the control never
lies; scrubbing on load would require an effect in `App.tsx` that no criterion asks for.

**OBSERVATION (not a failure) — retyping a query silently re-enables relevance** without a second
click, because `setQuery("")` leaves the in-memory `sort` at `"relevance"`. Truthful, but a UX
judgement call; already disclosed by the implementer at impl-IMP-008.md:128-133.

**OBSERVATION — the hint's class name is `controls__count`.** Correct styling, misleading name.
A `.controls__hint` alias would read better; `styles.css` was out of scope.

**OBSERVATION — `effectiveSort` is re-derived in `FeedControls` rather than shared.** A second
consumer of the same rule would duplicate it. `urlState.ts` would be the tidier home.

**Nothing else.** No existing test weakened, skipped or deleted; no product-code regression found;
IMP-009's concurrent hunks are complete and non-interfering.

---

## 8. Commands run by this verifier

```
git status --porcelain=v1 ; git branch --show-current
git diff -- web/src/lib/urlState.ts web/src/lib/__tests__/urlState.test.ts web/src/components/FeedControls.tsx
git show HEAD:web/src/lib/__tests__/urlState.test.ts | rg -o 'it\("[^"]+"' | … | comm -23 orig new
rg "\.(skip|only|todo)|xit\(|xdescribe\(" <the 3 IMP-008 test files>            # no matches
cd web && npm run typecheck                                                  # exit 0
cd web && npm test                                                           # 1 failed / 131 passed, then 12x
cd web && npx vitest run src/__tests__/App.relevance.test.tsx                # 14x, 3 failures
cd web && npx vitest run src/__tests__/{App.retry,malformedImport,domEnvironment}.test.tsx   # 14x, 0 failures
cd web && npm run build                                                      # exit 0, 39 modules
tar scratch → /tmp/rpf-imp008-verify ; revert 3 IMP-008 conditions ; npx vitest run <3 files>  # 12 failed / 42 passed
cd web && npm run preview -- --port 5200 --strictPort                        # stopped
Playwright: navigate / evaluate / resize 1280 & 390 / screenshot x4 / console_messages
shasum -a 256 .improve/artifacts/IMP-008/feed-relevance-*.png                 # identical
rm -rf /tmp/rpf-imp008-verify .playwright-mcp
```

No git write command was run. No source file was modified. `.kilo/worktrees/mildly-income` was not
touched.