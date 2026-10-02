# VERIFY — IMP-017 — Replace the raw `Error.message` with human-readable copy

**Verifier:** independent verifier sub-agent (did not write the change)
**Date:** 2026-10-02
**Scope reviewed:** `git diff -- web/` plus new `web/src/lib/failureCopy.ts` and
`web/src/lib/__tests__/failureCopy.test.ts`
**Diffstat:** `4 files changed, 302 insertions(+), 18 deletions(-)` plus 2 untracked new files
(`web/src/lib/failureCopy.ts`, `web/src/lib/__tests__/failureCopy.test.ts`)

# VERDICT: **PASS** — 3/3 acceptance criteria met, all three accumulated findings resolved

No criterion is unmet. Two non-blocking observations are recorded in §8 (LOW/MEDIUM). Nothing in
this report requires a code change to call the item done; §8.1 is the one thing I would queue next.

---

## 0. Command results (exact)

All from `web/`.

```
### npm run typecheck
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit
exit=0                      (no output, exit 0)

### npm test
 Test Files  14 passed (14)
      Tests  216 passed (216)

### npm run build
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-Bau7EVpd.js   169.87 kB │ gzip: 54.45 kB
✓ built in 363ms
```

CSS output is **byte-identical in size to HEAD (10.93 kB)** — this change introduced no new colours,
which is why §7 contrast is inherited rather than introduced.

**Baseline comparison (HEAD restored in `/tmp/imp017-head`):** `Test Files 13 passed (13)` /
`Tests 202 passed (202)`. So the change is **+1 test file, +14 tests, +0 removed**.

---

## 1. AC1 — EXHAUSTIVE STRING AUDIT

### 1.1 Is "exactly three user-reachable failure strings" still true?

The spec (`FEATURES.md:412`) enumerates "`INDEX_HELP` paths at `paperIndex.ts:79,86-88,93-96` and
the two shard errors". **The line numbers are stale** (as the brief warned). Current locations in
`web/src/lib/paperIndex.ts`:

| Spec's stale cite | Current line | Constructed message | Mapped in `failureCopy.ts` |
| --- | --- | --- | --- |
| `paperIndex.ts:79` | **:168** | `INDEX_HELP` (bare) | `indexUnavailableCopy()` |
| `paperIndex.ts:86-88` | **:177** | `` `${INDEX_HELP} (HTTP ${response.status})` `` | `indexUnavailableCopy(status)` |
| `paperIndex.ts:93-96` | **:185** | `MALFORMED` | `indexMalformedCopy()` |
| `paperIndex.ts:107-109` | **:200** | `` `Failed to load ${file} (HTTP ${response.status}).` `` | `shardCopy(status)` |
| `paperIndex.ts:121-123` | **:215** | `` `Shard ${file} is missing or malformed. Try regenerating the index.` `` | `shardCopy()` |

**5 construction sites → 4 distinct messages.** All 4 are mapped in `failureCopy.ts:34-45` and
covered by `failureCopy.test.ts` (4/4 pass). The spec's "exactly three" counts *groups* (3
`INDEX_HELP` cites + 2 shard cites = 5 sites); the enumerative reading is correct and complete.

### 1.2 Every error construction site in `web/src/` (grep, tests excluded)

```
$ grep -rn "throw new" src/ --exclude-dir=__tests__
src/lib/paperIndex.ts:168:    throw new IndexUnavailableError(INDEX_HELP);
src/lib/paperIndex.ts:177:      throw new IndexUnavailableError(`${INDEX_HELP} (HTTP ${response.status})`);
src/lib/paperIndex.ts:185:    throw new IndexUnavailableError(MALFORMED);
src/lib/paperIndex.ts:200:    throw new ShardLoadError(`Failed to load ${file} (HTTP ${response.status}).`);
src/lib/paperIndex.ts:215:      throw new ShardLoadError(`Shard ${file} is missing or malformed. Try regenerating the index.`);
src/main.tsx:9:  throw new Error("Missing <div id=\"root\"> element ...")   // module scope, never rendered
```

`src/main.tsx:9` throws before `createRoot().render()`, so it is never reachable from any rendered
state. Not user-reachable. Out of scope.

### 1.3 Every `.message` read in `web/src/` (tests excluded) — none leak

```
$ grep -rn -B2 "\.message" src/App.tsx src/lib/paperIndex.ts src/components/*.tsx
src/App.tsx:526:                <p title={error.detail}>{error.message}</p>      # visible = PROSE (failureCopy), title = technical
src/App.tsx:594:                    aria-label={error.message}                  # == visible text at :597
src/App.tsx:595:                    title={error.detail}                        # technical in title
src/App.tsx:597:                    {error.message}                             # visible = PROSE
src/App.tsx:632:                  .map((failure) => `${failure.file}: ${failure.message}`)   # inside title={...}
src/App.tsx:701:                <p title={error.detail}>{error.message}</p>      # visible = PROSE, title = technical
src/lib/paperIndex.ts:279:        message: outcome.reason instanceof Error ? outcome.reason.message : ...  # never rendered raw
```

`console.error` sites: `App.tsx:187` and `App.tsx:258`, both taking a `PaperFeedError` whose
`name` + `message` is the diagnostic. **`grep -rn "\.json" src/App.tsx src/components/*.tsx`
returns nothing** — the literal `index.json` appears only at `paperIndex.ts:163` as the fetch URL.

### 1.4 Did recent items (IMP-011 / IMP-015 / IMP-016) add paths this item missed? — **No**

| Path | Source | Verdict |
| --- | --- | --- |
| IMP-011 save failure | `App.tsx:495-499` — a **static string literal**, no interpolation of any error object | Clean. No raw message possible. |
| IMP-015 partial shard | `App.tsx:628-636` — visible text is `PARTIAL_SHARD_HEADING` + `describeFailedWeeks(...)`; `failure.message`/`failure.file` go to `title` only | Clean |
| IMP-016 load failure | `App.tsx:690-711` — `error.message` is prose; `error.detail` in `title` | Clean |
| IMP-010 unknown category | `App.tsx:477-486` — `"Unknown category: {c}."` uses the **user's own URL token**; not an `Error.message`, file name, or status | Outside AC1's enumerated set; see §8.4 |
| CollectionsView import error | `CollectionsView.tsx:213-214` — two static literals | Clean |

`collections.ts` catches every storage error internally and returns `false`; it never surfaces an
exception. `saveState()` therefore has **no technical detail to preserve** — nothing was deleted,
so AC1's preservation clause is vacuous there, not unmet.

### 1.5 OLD → NEW string map (as rendered, verified in-browser)

| State | OLD visible string | NEW visible string |
| --- | --- | --- |
| Index absent (404 / fetch threw) | `No paper index was found. Run \`python scripts/build_index.py\` locally, or wait for the scheduled GitHub Action that builds and deploys the index.` | `The paper index could not be loaded, so there is no feed to show. This is usually temporary, and the page will start working once the index is available again.` |
| Index unreachable w/ status | `No paper index was found. Run \`python scripts/build_index.py\` locally, or wait for the scheduled GitHub Action that builds and deploys the index. (HTTP 404)` | *same as above* (status dropped from text) |
| Manifest malformed | `The paper index is malformed and could not be parsed.` | `The paper index is present, but its contents could not be read, so there is no feed to show. This is not something you can fix by reloading.` |
| One corrupt shard (partial) | `Failed to load papers-2026-W39.json (HTTP 404).` | `Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown.` |
| All shards blocked | `Failed to load papers-2026-W40.json (HTTP 503).` | `Papers could not be loaded. The index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window.` + `Some of the paper data could not be fetched. This is usually temporary, and it does not mean the papers are missing.` |

**AC1: MET.**

---

## 2. AC2 — NO RAW TECHNICAL TEXT VISIBLE (measured on rendered DOM, not source)

Measured with `document.querySelector('main').innerText` in Chromium (not source reading):

| State | `*.json` | `HTTP` | 3-digit status | `Failed to load` | `Error` |
| --- | --- | --- | --- | --- | --- |
| Index missing | false | false | false | false | false |
| Index malformed | false | false | false | false | false |
| One corrupt shard | false | false | false | false | false |
| All shards blocked (missing) | false | false | false | false | false |
| All shards blocked (**HTTP 503**) | false | false | false | false | false |
| Save failure | false | false | false | false | false |
| Unknown category | false | false | false | false | false |

`innerText` (not `textContent`) was used deliberately, so `display:none` / collapsed content cannot
be mistaken for visible text.

**Responsive / hidden-variant check.** `title` is used only on inline `<p>` and `<div>` elements —
it renders a hover tooltip, never text. `<details className="save-menu">` (PaperCard) is the only
other container and holds no error text. No error copy is rendered inside `<pre>`/`<code>`,
`<details>`, or any always-visible element **except one scoped case — see §8.2.**

**AC2: MET** (with the §8.2 boundary, which is IMP-007 landed content the spec explicitly forbids
removing).

---

## 3. TECHNICAL DETAIL PRESERVED — verified, not assumed

Reproduced each failure in a live browser and read the actual `title` attributes and console:

| State | `title` attribute (verbatim, from the DOM) | Console |
| --- | --- | --- |
| Index missing | `No paper index was found. Run \`python scripts/build_index.py\` locally, or wait for the scheduled GitHub Action that builds and deploys the index. (HTTP 200)` | `[ERROR] paper feed: the index could not be loaded. IndexUnavailableError: No paper index was found. … (HTTP 200)` |
| Index malformed | `The paper index is malformed and could not be parsed.` | `[ERROR] paper feed: the index could not be loaded. IndexUnavailableError: The paper index is malformed and could not be parsed.` |
| One corrupt shard | `papers-2026-W39.json: Shard papers-2026-W39.json is missing or malformed. Try regenerating the index.` | *(no line — see note)* |
| All shards blocked | `Shard papers-2026-W40.json is missing or malformed. Try regenerating the index.` | `[ERROR] paper feed: the papers could not be loaded. ShardLoadError: Shard papers-2026-W40.json is mi…` |
| All shards blocked (**HTTP 503**) | `Failed to load papers-2026-W40.json (HTTP 503).` | `[ERROR] paper feed: the papers could not be loaded. ShardLoadError: Failed to load papers-2026-W40.json (HTTP 503).` |

The **filename and HTTP status survive in every case.** (The `(HTTP 200)` on the missing index is
correct: `vite preview`'s SPA fallback serves `index.html` with 200 + `text/html`, so the code
correctly classifies it as "unavailable", not "malformed".)

**Note — a precision correction to the implementer's report.** `impl-IMP-017.md` claims "console.error
with the thrown cause itself — `App.tsx:187` and `App.tsx:258`" for every case. In the **soft /
partial-shard path that is not true**: `loadPapers` swallows the rejection via `allSettled` into
`failedFiles` (`paperIndex.ts:262-269`), `App`'s `catch` never runs, and **no console line is
emitted**. Confirmed empirically — the one-corrupt-shard reproduction produced zero console
messages. This still satisfies AC1, which requires the detail in a `title` **or** `console.error`,
and the title carries it. But the report overstates console coverage for that one path, and any
future refactor that drops the `title` on the partial-shard notice would silently lose the
diagnostics entirely. Recorded in §8.3.

**Not a FAIL:** the implementer did not delete the diagnostics. Every file name and status code is
present and reachable.

---

## 4. AC3 + THE REWRITTEN TESTS

### 4.1 The test that PINNED raw rendering

`HEAD:web/src/__tests__/App.loadFailure.test.tsx:251-265` — confirmed. Line **261** is exactly:
```js
// The underlying cause stays visible: IMP-017 owns rewording it, and
// dropping it here would lose the only specific detail the user gets.
expect(panel.textContent).toContain("Failed to load papers-2024-W10.json");
```

### 4.2 The rewrites are strictly STRONGER, not weakened

`App.loadFailure.test.tsx` (rewritten):
| | HEAD | Now |
| --- | --- | --- |
| positive | 2 | **3** (`/not an empty window/i`, `/paper data could not be fetched/i`) |
| negative | 1 (`/no papers are available/i`) | **4** (`/papers-2024-W10\.json/`, `/HTTP/`, `/Failed to load/`, `/no papers are available/i`) |

The diagnostic-preservation obligation was **not dropped** — it moved into a *new, more specific*
sibling test (below) that asserts both the `title` and the `console.error` payload.

`App.partialShard.test.tsx` (rewritten at `:344`): keeps all 3 HEAD assertions, **adds 4** (reader
copy, the in-panel reader sentence, `getByTitle(/Failed to load papers-2024-W09\.json/)`, and a
console payload check).

### 4.3 Non-vacuity — BOTH claims VERIFIED, actual counts match exactly

**Claim 1 — "reverting `App.tsx` to HEAD fails 8/8 new tests."** Scratch copy `/tmp/imp017-v1`
(`git show HEAD:web/src/App.tsx` + current tests):
```
 Test Files  2 failed (2)
      Tests  8 failed | 24 passed (32)
```
The 8 failures are precisely the 8 new/updated tests:
1. `names the failure and says it is not an empty window`
2. `keeps the technical cause on the element that carries the sentence`
3. `explains an absent index without showing the request that failed`
4. `tells an unreadable index apart from an absent one`
5. `keeps the index detail in the tooltip and the console for both failures`
6. `warns beside the feed in plain words, keeping the cause in the title`
7. `still surfaces an error when every shard in the window fails`
8. `names the notice for a reader, so the tooltip is not its accessible name`

All 24 pre-existing tests in those two files still pass. **Claim 1: TRUE (8/8).**

**Claim 2 — "deleting just the two `aria-label`s fails exactly the 2 accessible-name tests."**
Scratch copy `/tmp/imp017-v2` (`App.tsx:594` and `App.tsx:630` deleted):
```
 Test Files  1 failed | 13 passed (14)
      Tests  2 failed | 214 passed (216)
```
Both are the accessible-name tests:
- `App.loadFailure.test.tsx` › `warns beside the feed in plain words, keeping the cause in the title`
- `App.partialShard.test.tsx` › `names the notice for a reader, so the tooltip is not its accessible name`

**Claim 2: TRUE (2/2).** The new tests are **non-vacuous**.

### 4.4 Nothing else was weakened, skipped, or deleted

- `grep -rn "\.skip\|skipIf\|\.todo\|\.only\|xit(\|xdescribe(" src/` → **no matches** (same at HEAD).
- Test-name diff HEAD→now: `comm -23` (present at HEAD, missing now) → **empty**. **202/202 preserved
  verbatim.** 14 names added.
- Arithmetic: 202 + 8 (`failureCopy.test.ts`) + 6 (net new in the two App files) = **216**. ✓
- IMP-016 tests (`App.loadFailure.test.tsx`, 17 tests) and IMP-015 tests (`App.partialShard.test.tsx`,
  15 tests) both exist and pass.
- `failureCopy.test.ts` (8 tests) is a genuinely new file, correctly mirrored under
  `web/src/lib/__tests__/` per REPO_PROFILE §2 (1:1 lib mirror).

**AC3: MET.**

---

## 5. Accessibility

### 5.1 Computed accessible name of the partial-shard notice

Read from the Chromium accessibility snapshot, **not** from the attribute:
```yaml
- alert "Some papers could not be loaded":
  - strong: Some papers could not be loaded.
  - text: One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown.
```
**Prose, not a filename.** Finding (c) resolved. The accessible name is a strict prefix of the
visible text, so **WCAG 2.5.3 Label in Name is satisfied** — the name contains every visible label.

### 5.2 The other two `aria-label` sites

- `App.tsx:594` `aria-label={error.message}` on the warning banner: the accessible name is
  **byte-identical** to the visible text at `:597`. No contradiction, no duplication mismatch.
- `App.tsx:690` and `App.tsx:519` panels: `role="alert"` with **no** `aria-label` and no `title` on
  the container. Snapshot confirms `- alert [ref=e12]` / `- alert [ref=e42]` — **unnamed**, so the
  contents are announced. This is exactly why `error.detail` sits on the inner `<p>` (`title`) and
  not on the panel: `alert` is a name-from-author role, so a `title` on the panel would have become
  its accessible name. Verified empirically — the snapshot shows the alert unnamed.

### 5.3 Announcement / double-announce

Exactly **1 alert per state** measured in every one of the 7 reproductions, except the deliberate
"save failure + unknown category together" case which is 2 — matching the pre-existing test
`shows both as separate alerts and announces neither twice`. No duplicate `role="alert"` wrappers,
no nested alerts, no `aria-live` conflicts.

### 5.4 Contrast (WCAG AA, computed from the CSS custom properties)

```
 5.62:1  AA-normal PASS   LIGHT .banner--error   #b3261e on #fbeae9
 6.72:1  AA-normal PASS   LIGHT .banner--warning #7a4b00 on #fff3d6
 7.01:1  AA-normal PASS   LIGHT .panel--error <p> #666661 on #ffffff
17.74:1  AA-normal PASS   LIGHT .panel--error h1  #1c1c1a on #ffffff
14.72:1  AA-normal PASS   LIGHT .panel <pre>       #1c1c1a on #f1f0eb
 6.70:1  AA-normal PASS   DARK  .banner--error   #ff8a80 on #3a1d1d
 9.37:1  AA-normal PASS   DARK  .banner--warning #ffd479 on #3a2f12
 7.05:1  AA-normal PASS   DARK  .panel--error <p> #9b9b94 on #1c1f24
16.15:1  AA-normal PASS   DARK  .panel--error h1  #f1f1ee on #1c1f24
13.15:1  AA-normal PASS   DARK  .panel <pre>       #f1f1ee on #22262c

worst ratio across all failure-copy surfaces = 5.62:1  (threshold 4.5)
```
Smallest copy is 0.9rem/14.4px normal weight → the 4.5 threshold applies throughout. All pass.
No new colours were introduced (CSS output unchanged), so this is inherited-good, not new risk.

---

## 6. Flake check

**Treatment (`npm test` in the repo, as-is), 12 consecutive runs:**
```
run 1: Tests  216 passed (216)      run 7:  Tests  216 passed (216)
run 2: Tests  216 passed (216)      run 8:  Tests  216 passed (216)
run 3: Tests  216 passed (216)      run 9:  Tests  216 passed (216)
run 4: Tests  216 passed (216)      run 10: Tests  216 passed (216)
run 5: Tests  216 passed (216)      run 11: Tests  216 passed (216)
run 6: Tests  216 passed (216)      run 12: Tests  216 passed (216)

TREATMENT SUMMARY: 12/12 clean at 216/216; 0/12 not clean
```

**Pre-fix control (`/tmp/imp017-v1` = HEAD `App.tsx` + current tests), same harness, 3 runs:**
```
control run 1: Tests  8 failed | 208 passed (216)
control run 2: Tests  8 failed | 208 passed (216)
control run 3: Tests  8 failed | 208 passed (216)
```
The harness **detects the pre-fix state 3/3** — so the 12 green runs are a real signal, not a
blind loop. **Zero flake observed.** No `.only`, no `--sequence.shuffle`, no time/faker dependency
in the new code (`failureCopy.ts` has no dates, no `Date.now()`, no randomness; `describeFailedWeeks`
is unchanged by this item).

---

## 7. Playwright — independent reproduction of every failure state

Setup: `cd web && npm run preview -- --port 5311 --strictPort` (background), then
`http://localhost:5311/research-paper-feed/`. All mutations were made to `web/dist/` and
`web/public/data/` was never touched; **both were restored byte-identically** (verified with
`shasum -a 256` diff before/after → `IDENTICAL`). `dist/index.html` restored via `diff` → clean.
Server stopped; `curl http://localhost:5311/` → connection refused.

| # | State | How reproduced | Alerts | Visible text (DOM `innerText`) | Technical detail |
| --- | --- | --- | --- | --- | --- |
| 0 | Healthy feed | — | **0** | 2,812 papers | console: **0 messages** |
| 1 | Index missing | `mv dist/data/index.json` | 1 | `The paper index could not be loaded, so there is no feed to show. This is usually temporary, and the page will start working once the index is available again.` | title + console ✓ |
| 2 | Index malformed | `printf '<html>not json' > index.json` | 1 | `The paper index is present, but its contents could not be read, so there is no feed to show. This is not something you can fix by reloading.` | title + console ✓ |
| 3 | One corrupt shard | `printf 'THIS IS NOT JSON' > papers-2026-W39.json` | 1 | `Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown.` (2,549 papers still render — degraded, not dead) | title only ✓ |
| 4 | All shards blocked | both shard files removed | 1 | `Papers could not be loaded. The index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window.` + `Some of the paper data could not be fetched…` | title + console ✓ |
| 5 | All shards blocked, real HTTP | `fetch` stub returning `503` injected into `dist/index.html` | 1 | identical to #4 | title `Failed to load papers-2026-W40.json (HTTP 503).` ✓ |
| 6 | Save failure | `window.localStorage.setItem` overridden to throw `QuotaExceededError`, then created a collection | 1 | `Collections could not be saved. This browser's storage may be full or blocked, so anything you just changed will be lost when you reload this page.` | n/a (no detail exists) |
| 7 | Unknown category | `#cat=cs.BI` | 1 | `Unknown category: cs.BI. This index does not have that category, so nothing can match.` + `Reset category filter` | n/a |

`vite preview`'s SPA fallback returns **HTTP 200 + `text/html`** for a missing file under
`/research-paper-feed/`, which is why state #1 correctly classifies as *unavailable* (and state #4
routes through the *malformed-shard* branch). I therefore added state #5 with a genuine 503 so the
`!response.ok` branch with a real status code was actually exercised, not assumed.

**Console across the entire session: 5 errors, all of them the deliberate diagnostics** listed in
§3. **Zero new console errors** — no React warnings, no hydration errors, no errors in the healthy,
partial-shard, save-failure, or unknown-category states.

**Screenshots written to `.improve/artifacts/IMP-017/`:**
- `verify-index-missing-desktop-1280.png`, `verify-index-malformed-desktop-1280.png`
- `verify-partial-shard-desktop-1280.png`, `verify-partial-shard-mobile-390.png`
- `verify-all-shards-blocked-desktop-1280.png`, `verify-all-shards-blocked-mobile-390.png`
- `verify-save-failure-desktop-1280.png`, `verify-unknown-category-desktop-1280.png`

The spec-mandated `feed-error-copy-desktop-1280.png` **exists and is accurate** — I inspected it: it
shows the IMP-016 hard-failure panel at 1280 with clean visible copy and no technical leak, matching
what I reproduced independently in state #4.

**Baseline comparison** (`.improve/artifacts/baseline/`): the healthy feed renders identically
(filter chips, hero, card density all preserved); `baseline-feed-index-missing-desktop-1280.png`
shows the OLD raw copy (`No paper index was found. Run \`python scripts/build_index.py\`…`), so the
before/after delta is real and the intended one. No layout regression at 390px.

---

## 8. Findings that do **not** block acceptance

### 8.1 MEDIUM — the partial-shard notice's `aria-label` is shorter than its visible text
`App.tsx:630` sets `aria-label="Some papers could not be loaded"` while the visible text is the full
sentence *plus* "One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below
is incomplete. Everything that did load is shown."

This satisfies the finding as written (prose, not a filename) and satisfies WCAG 2.5.3. But
`alert` is a **name-from-author** role, so a shorter accessible name can cause screen readers to
announce only the name and drop the informative tail — the week count, the date range, and the
"the feed below is incomplete" caveat would not reach a non-sighted reader. Note the sibling banner
at `App.tsx:594` gets this right by setting `aria-label={error.message}` (identical to its visible
text).

**Suggested fix (next item, not a blocker):** drop the `aria-label` on the partial-shard notice
entirely — an unnamed `role="alert"` announces its contents, which is what the two hard-failure
panels already do and what contains the most information. Note this would fail
`App.partialShard.test.tsx`'s new test as written, so the test must change with it.

### 8.2 LOW / documented boundary — `index.json` is never in a visible string; `build_index.py` is
The index panel's always-open developer block (`App.tsx:536-541`) renders
`python scripts/build_index.py` and `cd web && npm run dev` as visible text inside `<pre><code>`.
`scripts/build_index.py` **is** a file name, so a literal reading of AC2 ("no file name in a
rendered user-facing string") would flag it. I judge it **out of scope and correct to leave**:
(a) AC2 says "in the **primary** message" — the message `<p>` at `App.tsx:526` is clean and verified;
(b) it is IMP-007 landed content under a `repo` profile convention REPO_PROFILE §6 explicitly
forbids this item from removing ("You may not change the build commands the panel shows in
order to make this item's test pass"); and (c) the implementer's test
`failureCopy.test.ts` scopes its `not.toMatch(/build_index/)` to `message.textContent` rather than
`panel.textContent` — a deliberate, honestly-documented scoping decision, not a concealment.
Flagging so a future verifier does not re-litigate it.

### 8.3 LOW — the partial-shard path has **no** console diagnostic
See §3. `loadPapers` swallows soft failures via `allSettled`; only the `title` carries the file name
and raw message. AC1 is satisfied ("`title` **or** `console.error`"), but the implementer's report
claims console coverage for this path and there is none. A `console.warn` naming the failed shard
files would make the diagnostics robust against the `title` being dropped, and would be
touch-consistent with the `App.tsx:614-616` comment about `title` not rendering on touch — note the
file name is currently **unreachable on mobile**, since a touch user cannot hover a `title`.

### 8.4 LOW — `cs.BI` is rendered visibly in the unknown-category notice
`App.tsx:479`. Not an `Error.message`, not a file name, not an HTTP status, and it is the user's own
URL token echoed back so they can remove it. Outside AC2's enumerated bars and outside this item's
scope (IMP-010). Noted only because it is the one other technical-looking visible token in the app.

### 8.5 INFO — comment volume vs REPO_PROFILE §5.1
`App.tsx` gains ~40 lines of block comments (`:513-525`, `:610-616`, `:641-644`, `:665-670`,
`:677-689`, `:697-700`). REPO_PROFILE says "Do not add comments to source unless genuinely needed"
but also "the comments that exist explain rationale." These do explain rationale (why not a second
`<h1>`, why a plain `<p>`, why the `<details>`, why `aria-label`). Consistent with the convention as
written; flagged only because the density is high for a 768-line file.

---

## 9. Copy quality — read as a reader

| State | Verdict |
| --- | --- |
| **Missing index** — *"The paper index could not be loaded, so there is no feed to show. This is usually temporary, and the page will start working once the index is available again."* | **Excellent.** A non-technical reader learns three things: the feed is empty because of a load failure, it is probably not their fault, and it is not their action to fix. Plus a real `Try again` button and the labelled developer block. Best of the five. |
| **Malformed manifest** — *"The paper index is present, but its contents could not be read, so there is no feed to show. This is not something you can fix by reloading."* | **Very good.** Distinguishing it from "absent" is the hard part and it does so without jargon ("present … could not be read"). "This is not something you can fix by reloading" pre-empts the obvious wrong action. Still ships `Try again`, which slightly contradicts the last clause — minor, and the copy explains *why* the retry is unlikely to help. |
| **One corrupt shard** — *"Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026), so the feed below is incomplete. Everything that did load is shown."* | **Very good.** Tells the reader the feed is *degraded, not broken*, quantifies it ("one week"), dates it, and reassures. A non-technical reader who just arrived can tell the page is not lying to them. |
| **Network / all-shards failure** — *"Papers could not be loaded. The index is available, but no week in this window could be fetched, so there is nothing to show. This is a loading failure, not an empty window."* + *"Some of the paper data could not be fetched. This is usually temporary, and it does not mean the papers are missing."* | **Good, one awkward phrase.** "No week in this window could be fetched" — "week" and "window" are both abstractions a non-technical reader has to hold at once, and "fetched" is a developer verb. The old copy had the same abstraction problem in worse form; this is a large improvement. The follow-up sentence ("it does not mean the papers are missing") is excellent. |
| **Save failure** | **Good.** "This browser's storage may be full or blocked, so anything you just changed will be lost when you reload this page." Names the mechanism (browser storage, not the site), offers two plausible causes, and states the consequence precisely. Unchanged by this item (IMP-011) and already clean. |

**Actionability:** no string is merely vague. Every one names a cause class, a consequence, and a
next step (`Try again` button on 1, 2, 4; the developer block on 1; "Everything that did load is
shown" on 3; "will be lost when you reload" on 6). Nothing anywhere says "something went wrong".

**Grammar / tone / consistency:** checked across all five. Voice is uniformly second-person-neutral
and calm, present tense, `X could not be Y` for what failed and `This is …` for what it means.
Consistent `Title Case.` sentence-leading strongs. The only inconsistency is that the hard-failure
panel's primary sentence is a `<strong>` fragment while the malformed-index copy has no leading
`<strong>` at all — see §8.1's sibling note; cosmetic only.

---

## 10. Summary

| Criterion | Verdict |
| --- | --- |
| **AC1** — every user-visible failure maps to a reader-facing sentence; technical detail in `title` or `console.error` | **MET** — all 5 sites / 4 distinct messages mapped; no recent-item path leaks |
| **AC2** — no raw `Error.message`, file name, or HTTP status in the primary visible text | **MET** — verified on rendered DOM across 7 states; §8.2 boundary documented |
| **AC3** — `typecheck` + `test` pass | **MET** — exit 0; **216/216 across 14 files**; build clean |
| Diagnostics preserved | **MET** — every filename/status confirmed live in `title`; nothing deleted (§8.3 caveat) |
| Tests non-vacuous | **VERIFIED** — 8/8 and 2/2, actual counts match the claims exactly |
| No test weakened/skipped/deleted | **MET** — 202/202 names preserved, zero skips, +14 only |
| Accessibility | **MET** — computed name is prose; contrast worst 5.62:1; 1 alert/state. §8.1 is the follow-up |
| Flake | **NONE** — 12/12 clean; control fails 3/3 |
| Console | **ZERO new errors** in the healthy path; 5 deliberate diagnostics across all reproductions |

**PASS.**