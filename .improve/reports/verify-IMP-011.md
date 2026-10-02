# Verification — IMP-011 (surface `saveState` failure to the user)

Verifier: independent sub-agent. No source file was modified. Scope:
`git diff -- web/src/App.tsx web/src/lib/__tests__/collections.test.ts` plus the new
`web/src/__tests__/App.storage.test.tsx`. IMP-015 files (`web/src/lib/paperIndex.ts`,
`web/src/lib/__tests__/paperIndex.test.ts`, `web/src/__tests__/App.partialShard.test.tsx`)
were ignored except where they are unavoidable suite noise.

**VERDICT: PASS — 3/3 acceptance criteria met, 0 unmet.** Two MEDIUM observations and
three LOW/nits are recorded below. None of them blocks acceptance.

---

## 1. Acceptance criteria

### Criterion 1 — sets a `role="alert"` banner stating that collections could not be saved. **MET**

- `web/src/App.tsx:227` — `const [saveFailed, setSaveFailed] = useState(false);`
- `web/src/App.tsx:235-241` — effect calls `setSaveFailed(!saveState(collections));` on
  every `[collections, storageAvailable]` change, guarded by `if (storageAvailable)`.
- `web/src/App.tsx:378-388` — `{saveFailed && (<p className="banner banner--error" role="alert">…)}`
  rendered as the **first child of `<main>`**, above the hero (`App.tsx:374-388`).
- Copy: `<strong>Collections could not be saved.</strong> This browser’s storage may be full
  or blocked, so anything you just changed will be lost when you reload this page.`

Verified in a real browser (Chromium, `npm run preview` on :5211), not just by reading markup —
see §5. The accessibility snapshot showed a real `main > alert` node with the exact text.

### Criterion 2 — clears the banner on the next successful save. **MET**

`setSaveFailed(!saveState(collections))` assigns on every save, so a success sets it back to
`false`. Mutant-tested (see §4, Mutant B) and verified live: with the quota stub removed,
unchecking the collection box removed the alert (`alertCountAfterSuccess: 0`, and
`main.firstElementChild.className` went back to `"hero"`). The node is fully unmounted, not
hidden.

### Criterion 3 — a test confirming the banner path is reachable by exercising `saveState`
### against a storage fake that throws on the second `setItem`. **MET**

- `web/src/lib/__tests__/collections.test.ts:205-222` — new test
  *"reports a failed write when the second key is rejected, the exact two-key case"*.
  `quotaStorage()` records each key and throws
  `new DOMException("simulated quota exceeded", "QuotaExceededError")` for the **second**
  `setItem` only. Asserts `keys === ["rpf.collections.v1", "rpf.papers.v1"]`, the exact
  `QuotaExceededError` `DOMException`, and `saveState(...) === false`.
- `web/src/lib/__tests__/collections.test.ts:224-240` — new test
  *"reports a failed write when the storage fake throws for every key"*, plus a parity
  assertion that an unavailable storage also yields `false`.

These are the *only* two collections tests the spec asks for and both are present, in the
specified file.

### The atomicity judgement — **CORRECT, not a FAIL**

The implementer deliberately did not touch the two-key non-atomic write (recon defect
WEB-24). I read the spec myself. All three criteria are scoped to *surfacing* the failure
(`App.tsx`, the banner, the notice copy, a test proving the `false` path is reachable).
No criterion mentions atomicity, rollback, single-key writes, or partial-state
reconciliation, and the "Out of scope / Not touching" line in the spec body does not
require it. Leaving WEB-24 open is the right call; the acceptance bar is met without it.
WEB-24 remains open and is not silently closed by this change.

---

## 2. The user-visible honesty question

This is the part I pushed hardest on, because the original bug was exactly a lying UI.

### Does the UI actually tell the user? **YES — verified in Chromium, not by reading markup.**

Sequence actually performed with real clicks (`getByRole('checkbox', {name: 'Verifier Collection'})`):

1. Created a collection while storage was healthy.
2. Narrowed to one paper (`#q=MemFit`).
3. Installed a stub that throws `QuotaExceededError` on `rpf.papers.v1` (details in §5).
4. Ticked the collection checkbox.

Observed in the live accessibility tree:
```
main [ref=e11]:
  - alert [ref=e2208]:
    - strong: Collections could not be saved.
    - text: This browser’s storage may be full or blocked, so anything you just changed
            will be lost when you reload this page.
```
and `document.querySelectorAll('[role="alert"]').length === 1`.

### Does the optimistic UI still show the paper as saved? **YES — and the banner is the
### only thing telling the truth. This is a real, but acceptable, residual gap.

Live state at the moment of failure: checkbox `Verifier Collection [checked]`, header
`Collections (2)`, and on disk `rpf.collections.v1` = two collections each with
`paperIds: ["2610.00872"]` while `rpf.papers.v1` = `"{}"`.

Is that confusing enough to be a defect? I judge **no**, for two reasons:

1. **The banner is unambiguous and correctly hedged.** It does not say "try again" or
   "your change was rejected". It says *"anything you just changed will be lost when you
   reload this page"* — which I confirmed is **literally true**. After a true document
   reload the two collections rendered `(0)` / "No papers saved yet." and
   `paperIds` came back `[]`. Without the banner the user would have believed two papers
   were saved and found both gone. The original bug is genuinely resolved.
2. **Not reverting the checkbox is the more honest of the two options.** The in-memory
   state *is* the app's truth until reload; un-ticking the box would be a second lie, and
   the spec does not ask for a revert.

The copy does slightly *over*-state the loss (the collection *names* survived; only the
paper membership was dropped). That errs in the safe direction. Nit, below.

### MEDIUM observation — the banner scrolls out of view

`.improve/artifacts/IMP-011/verify-collections-save-failed-scrolled-1280.png` and
`verify-two-alerts-coexist-1280.png` show the problem: with the page scrolled to
`scrollY = 169.5` (which is where Playwright lands after clicking a save checkbox), the
banner is **above the viewport** while the ticked checkbox and the unrelated
unknown-category warning are in view. A sighted user deep in the feed gets no visible
signal of the failed save; only a screen reader (via `role="alert"`) or a manual scroll
to the top would reveal it.

- Not a criterion failure — the spec names `role="alert"` and says nothing about placement,
  and top-of-`<main>` is the established placement in this codebase.
- Concrete fix if a follow-up wants it: keep the top-of-`main` banner for screen readers and
  additionally disable/neutralise the save controls, or surface a short-lived status toast
  near the card. Either makes the failure visible at the point of action.
- The implementer disclosed this placement decision and its alternative in the report, so
  this is a known trade-off, not a hidden gap.

### Does the notice name what failed and offer a recovery? **Names it, yes; recovery, no.**

"Collections could not be saved" names the subsystem. The "or blocked" wording correctly
covers both causes. There is **no button or retry affordance** — and I think that is
defensible: there is no user action that repairs a full quota, and a fake "Retry" would be
worse. The action is implicit (free space, reload, retry the save). Noting it because the
verify brief asked specifically about recovery.

### Does it clear on the next successful save, and not flicker? **Both confirmed live.**

- Clears: yes, node unmounts (see Criterion 2).
- No re-announce per save: I tagged the live alert node with `dataset.tag2` after a second
  failing save and then triggered a **third** failing save via "Create & save".
  `nodeIdentityPreserved: true`, `textUnchanged`, `alertCount: 1`. React bails out on the
  identical `true` state and the banner sits at a stable tree position, so assistive tech
  does **not** re-announce on every consecutive failure. This matches the implementer's
  claim, and I confirmed it in the browser rather than trusting it.
- No flicker on ordinary interaction: typing in the search box, changing category/recency/
  sort chips, and changing the view produced zero alerts. The effect's dependency is
  `[collections, storageAvailable]` only, so filter changes cannot trigger a save.

---

## 3. Accessibility

- **Announced appropriately, not repeatedly.** `role="alert"` on a conditionally mounted
  `<p>` gives an implicit `aria-live="assertive"`; the implementer correctly did **not**
  add a redundant `aria-live` attribute (verified live: `getAttribute('aria-live')` is
  `null`, which is the right choice for `role="alert"`). Node identity preserved across a
  third consecutive failure (§2), so no repeat announcement. On success the node unmounts.
- **Does not steal focus.** The element has `tabindex === null` and no `ref`/autofocus
  plumbing. Live check: `document.activeElement` remained the `INPUT` checkbox and later the
  `BUTTON` the user had clicked; `scrollY` was unchanged by the save. This matches the
  landed IMP-007 decision (`.improve/DECISIONS.md`: the index-error retry banner does not
  move focus, the *recovered* feed heading does), so the convention is consistent.
- **Contrast — computed by me, not copied from the report.** The banner reuses the
  pre-existing `banner--error` class; **`web/src/styles.css` has ZERO diff** for this item
  (`git diff --stat -- web/src/styles.css` is empty), so no new class was bolted on. The
  class (`styles.css:605-608`) sets `background: var(--danger-soft)` with no `color`, so
  the text inherits `body { color: var(--text) }`… except the live computed value was
  `rgb(179, 38, 30)`, i.e. `--danger`, inherited via the existing `p:is(.banner) { color:
  var(--danger) }` rule at `styles.css:589-591`. I verified the live computed colours:

  | | colour | background | ratio |
  |---|---|---|---|
  | **light** text `--danger #b3261e` on `--danger-soft #fbeae9` | `rgb(179,38,30)` | `rgb(251,234,233)` | **5.62:1** ✅ AA |
  | **dark** text `--danger #ff8a80` on `--danger-soft #3a1d1d` (`styles.css:39-40`) | — | — | **6.70:1** ✅ AA |

  Both clear WCAG AA 4.5:1 for normal text with margin. (The implementer's report said
  5.61:1; the exact value is **5.6175** — theirs is a truncation, not an error.)

  Secondary figures, for completeness: the banner *fill* against the page `--bg` is
  **1.10:1** light (#fbeae9 on #faf9f6) and **1.42:1** dark. That is below the 3:1 of
  WCAG 1.4.11 non-text contrast, so the banner has no strong boundary of its own — it
  depends on the red text and the 12px/10px padding. This is **pre-existing** styling shared
  with the import-error banner (`.improve/artifacts/baseline/baseline-collections-import-error-desktop-1280.png`
  is visually indistinguishable in treatment) and is not introduced here. Recording it so a
  future item does not mistake it for a regression.
- **Consistent, not bolted on.** My `verify-collections-save-failed-desktop-1280.png` and the
  baseline import-error screenshot use the identical class, identical `--danger`/`--danger-soft`
  tokens, identical 10px radius and 12px/0.95rem padding, and identical top-of-content
  anchoring. Side-by-side they are the same component with different copy. This is the right
  reuse.
- **Reasonable DOM order.** The banner is the first child of `<main>`, before the
  "Recent arXiv papers in CS&AI" `<h1>`. For a screen reader that means the error is heard
  before the page heading — correct and expected for an alert.

---

## 4. Test non-vacuity — independently confirmed, plus mutation testing

### The "4 of 5 fail against HEAD" claim — **TRUE**

Scratch copy A: current `web/src` with `git show HEAD:web/src/App.tsx` substituted.
```
cd /tmp/imp011-verify/pre && npx vitest run src/__tests__/App.storage.test.tsx \
    src/lib/__tests__/collections.test.ts
  Test Files  1 failed | 1 passed (2)
       Tests  4 failed | 38 passed (42)
```
The 4 failures are exactly:
1. `surfaces a role="alert" banner when saveState reports a failed write`
2. `explains the reload consequence and that the paper list is not affected`
3. `clears the banner on the next successful save`
4. `stays silent while saves keep succeeding`

Scratch copy B: **full** `git archive HEAD web/src` + only the two new test files, so the
concurrent IMP-015 work could not influence the result. Same outcome:
`Test Files 1 failed | 1 passed (2)` / `Tests 4 failed | 38 passed (42)`, same four names.
`grep -c saveFailed /tmp/imp011-verify/head/src/App.tsx` → `0`, confirming the control is
genuinely pre-fix.

The 5th test (`stays silent while saves keep succeeding`) passes both before and after —
correctly so. It is a negative control against an always-on banner, not a
does-the-fix-exist test.

### The tests exercise a real failing storage write, not a reducer and not a `saveState` stub

This is the strongest part of the change and it is worth saying plainly.
`App.storage.test.tsx:6-16` installs a `FakeStorage` whose `setItem` **throws a real
`DOMException(..., "QuotaExceededError")`** on the second `setItem`. `App.tsx` calls the
**real** `saveState` from `../lib/collections` — the test file contains **no
`vi.mock`** (`grep -rn "vi.mock" src/` → nothing anywhere in `web/src`). So the failure
propagates through the actual `try/catch` in `collections.ts:334-343`, through
`detectStorage`, through the real reducer, and out to the rendered alert. Nothing is faked
below the storage boundary. **This is strictly stronger than stubbing `saveState` to return
`false`, and it is sufficient — more than sufficient — for this item.**

The two new `collections.test.ts` tests pass both before and after the `App.tsx` change.
That is expected and correct: they prove the `false` path is *reachable*, which is exactly
what criterion 3 asks. They are not vacuous, and I proved it by mutation:

| mutant | change | result |
|---|---|---|
| **A** | `saveState` returns `true` from both the `!storage` branch and the `catch` | `× saveState reports a failed write when the second key is rejected…` and `× …when the storage fake throws for every key` — **2 failed** |
| **B** | `App.tsx` banner latches: `if (!saveState(collections)) setSaveFailed(true);` | `× clears the banner on the next successful save` — **1 failed** (the other 4 pass) |
| **C** | banner always rendered (`{(true \|\| saveFailed) && (`) | **3 failed**, including `× stays silent while saves keep succeeding` |
| **D** | copy replaced with `"Something went wrong."` | `× explains the reload consequence…` — **1 failed** |

Every assertion in the new suite is load-bearing. Criterion 2 in particular is covered by
exactly one test and that test is not vacuous (Mutant B).

### No existing test weakened, skipped, or deleted

- `git diff --numstat -- web/src/App.tsx web/src/lib/__tests__/collections.test.ts` →
  `19 1 web/src/App.tsx` / `69 0 web/src/lib/__tests__/collections.test.ts`. The single
  removed line is `-      saveState(collections);`, the old ignored return value.
- `git diff -- web/src/App.tsx web/src/lib/__tests__/collections.test.ts | grep -c "^-[^-]"`
  → `1`. No test body, name, or assertion was removed.
- `grep -rn "\.skip\|\.todo\|\.only\|xit(\|xdescribe(" web/src` → **no matches**.

---

## 5. Flake check

| harness | runs | green | non-green | notes |
|---|---|---|---|---|
| full `npm test` | 12 | **12** | 0 | every run reported `Test Files 12 passed (12)` / `Tests 178 passed (178)` |
| targeted `App.storage.test.tsx` + `collections.test.ts` | 30 | **30** | 0 | every run reported `Tests 37 passed (37)` |
| **pre-fix control** (full-HEAD `App.storage.test.tsx`) | 5 | 0 | **5** | every run reported `Tests 1 failed \| 4 passed (5)` — 0/5 green |

**Sensitivity is established**, not assumed: the same command that is 42/42 green on the
working tree is 5/5 red on the pre-fix control, and it is red deterministically (5/5, not
occasionally). 0 flakes in 42 full-suite/targeted runs. The 1-in-12 failure mode that
rejected a previous item did not reproduce here.

---

## 6. Regression check on landed items touching `App.tsx`

`npx vitest run App.retry App.categories App.relevance malformedImport App.partialShard feedControls`
→ **`Test Files 6 passed (6)` / `Tests 46 passed (46)`**, every test named and passing:

- **IMP-007** (`App.retry.test.tsx`, 6 tests) — focusable native "Try again" button, clears
  the panel + refetches, single retry on a double click, restores the button when the retry
  also fails, three consecutive failures. Intact. The new banner adds no `ref`/autofocus and
  therefore does not disturb this banner's focus behaviour.
- **IMP-008** (`App.relevance.test.tsx` 4 + `feedControls.test.tsx` 16) — relevance over a
  deep link, `#q=…&sort=relevance` still honoured, chip pressed/un-pressed states. Intact.
- **IMP-009 / IMP-010** (`App.categories.test.tsx`, 13 tests) — unknown-category
  `role="alert"` notice, reset button, "reports every dropped value, and no more than
  those", "shows no unknown-category notice for a plain feed". Intact. Verified in the
  browser that the unknown-category notice still renders correctly *with* the new banner
  present (see below).
- **IMP-154** (`malformedImport.test.tsx`, 5 tests) — `isPaper` validation, `keeps the tree
  mounted when an imported paper omits categories/published/categories-as-string`, `leaves
  no snapshot that PaperCard would dereference unguarded`, `survives a stored snapshot that
  predates the validation`. Intact.

### The second `role="alert"` — no conflicting live-region situation

The banner is the app's *newest* alert, not its only one. `grep -rn 'role="alert"' web/src`
finds pre-existing alerts at `App.tsx:409` (index load error), `App.tsx:465` and
`App.tsx:477` (unknown categories), and `CollectionsView.tsx:185` / `:229` (storage
unavailable, import error). I forced the two-alert case live — quota stub active **and**
`#cat=cs.AI,cs.XX` so the unknown-category notice was on screen — then clicked a save box:
```
main > alert [e106]  "Collections could not be saved. …"   (banner--error, red)
     …
     alert [e68]      "Unknown category: cs.XX. … [Keep only indexed categories]"
                                                         (banner--warning, yellow)
alertCount: 2, console: 0 messages
```
Screenshot: `.improve/artifacts/IMP-011/verify-two-alerts-coexist-1280.png`. They are
visually and semantically distinct, each announces on its own mount, and neither suppresses
or duplicates the other. Two independent `aria-live="assertive"` regions is legal ARIA, not
a conflict. **Not a regression.**

Why the test suite does not break on this: only `App.storage.test.tsx` installs a working
`localStorage` (`grep -ln localStorage web/src/__tests__/*.tsx` → that file plus one comment
in `malformedImport.test.tsx`). In jsdom, `detectStorage()` returns `false` in every other
App test, the save effect short-circuits, and the existing unambiguous
`getByRole("alert")` assertions keep working. **Test-maintenance note for a future item:**
if anyone ever writes a test that combines a working storage with a bad category hash, the
existing `getByRole("alert")` calls in `App.categories.test.tsx` would throw on multiple
matches. That is a future-authoring concern, not a defect in this change.

---

## 7. Commands run (exact results)

```
$ npm run typecheck
> tsc -b --noEmit          exit 0 — clean

$ npm test
 Test Files  12 passed (12)
      Tests  178 passed (178)
   Duration  ~1.5 s
```

178 across 12 files. Attribution: **11 of those tests are the concurrent IMP-015 agent's**
(`paperIndex.test.ts` 25, `App.partialShard.test.tsx` 2 — I can see both in the working-tree
diff and did not review them). **7 tests are IMP-011's**: 5 in
`web/src/__tests__/App.storage.test.tsx` + 2 in
`web/src/lib/__tests__/collections.test.ts`. I am not attributing the other 11.

```
$ npm run build
> tsc -b && vite build
✓ 39 modules transformed.
dist/index.html                   0.61 kB │ gzip:  0.46 kB
dist/assets/index-*.css          10.93 kB │ gzip:  2.86 kB   (byte-identical to the
                                                               profile baseline — this item
                                                               ships zero CSS)
dist/assets/index-*.js          167.00 kB │ gzip: 53.56 kB
✓ built in 370 ms               exit 0
```
(The 167.00 kB figure is 0.39 kB above the profile baseline because the concurrent IMP-015
`paperIndex` change is in the same working tree, not because of this item. The CSS hash and
size are unchanged, which is the figure that belongs to IMP-011.)

---

## 8. Playwright — real behaviour, verified independently

**Method (how the failure was injected).** I did **not** trust the report. `npm run preview
-- --port 5211 --strictPort` was started from `web/` and awaited readiness, then I drove
Chromium with real `getByRole(...)` clicks. The failure was injected by overriding
`Storage.prototype.setItem` from `browser_evaluate` so that it throws
`new DOMException("… the quota has been exceeded.", "QuotaExceededError")` for
`rpf.papers.v1` while letting `rpf.collections.v1` through:

```js
const native = Storage.prototype.setItem;
Storage.prototype.setItem = function (key, value) {
  window.__quotaCalls.push(key);
  if (key === 'rpf.papers.v1')
    throw new DOMException("Failed to execute 'setItem' on 'Storage': the quota has been exceeded.",
                           "QuotaExceededError");
  return native.call(this, key, value);
};
```

Throwing on the **second** key deliberately reproduces the real "quota filled mid-write"
shape. It also mirrors `quotaStorage()` in the unit test, so the browser and the test agree
on which write fails. Injection happened *after* mount so that `detectStorage()` had already
succeeded — otherwise the app would take the pre-existing `banner--warning` path
(`CollectionsView.tsx:185`) instead of exercising this new one. Confirmed at the time:
`setItemIsNative: false` before the save, `true` after restore.

Steps performed: created a collection with storage healthy → narrowed to `#q=MemFit` (1
paper) → installed the stub → opened the save menu → ticked the collection checkbox →
inspected the DOM/storage → restored `setItem` → unticked → **banner cleared** → re-broke
storage, saved twice more, checked node identity → forced a true document reload to measure
actual data loss → forced the two-alert case.

**Data-loss measurement (the honesty check).** With the stub active:
```
rpf.collections.v1 = [Verifier Collection, paperIds:["2610.00872"]],
                      [Second Verifier Collection, paperIds:["2610.00872"]]
rpf.papers.v1       = "{}"        ← the paper snapshot never landed
```
After a **true document reload** (`about:blank` → app, so the JS context and
`Storage.prototype` are genuinely fresh):
```
collectionHeadings   = ["Verifier Collection (0)", "Second Verifier Collection (0)"]
paperIds after load  = [[], []]
alertCount           = 0      ← banner correctly gone once storage worked again
```
Both papers were gone, exactly as the banner promised. **The original bug — "user believes
the save worked, data silently gone" — is genuinely fixed.** The banner's claim is verified
true, not aspirational.

**Console: zero messages, zero errors** across the entire session (checked after the
first failure, after the clear, and after the final two-alert case). The thrown
`QuotaExceededError` is swallowed inside `collections.ts`'s `catch` as designed.

**Screenshots** (mine, in `.improve/artifacts/IMP-011/`, taken independently — I did not
reuse the implementer's):
- `verify-collections-save-failed-desktop-1280.png` — banner above the hero, 1280×900
- `verify-collections-save-failed-mobile-390.png` — 390×844; wraps to 4 lines, stays
  above the fold, nothing clipped
- `verify-collections-save-failed-scrolled-1280.png` — the scrolled-past case (see the
  MEDIUM observation)
- `verify-two-alerts-coexist-1280.png` — save banner + unknown-category warning together

Compared against `.improve/artifacts/baseline/`: the banner is **visually
indistinguishable in treatment** from `baseline-collections-import-error-desktop-1280.png`
(same soft-red fill, same red text, same radius, same anchoring) and from the rest of the
baseline palette. It looks intentionally designed, not bolted on. The only place it diverges
from the baseline is where it is anchored (top of `<main>` so it is visible on every view,
rather than inside the Collections form) — a deliberate and disclosed decision.

Server stopped: `bgp_0fc63338c0010RrjFxQJbt7ZvS` stopped, `lsof -ti:5211` → port closed.

---

## 9. Issues, by severity

### MEDIUM — the failure banner can be scrolled out of view while the optimistic
### checkbox still reads as saved
`App.tsx:378`. Evidence: `verify-collections-save-failed-scrolled-1280.png` and
`verify-two-alerts-coexist-1280.png` (page at `scrollY = 169.5`, banner off-screen, checkbox
ticked). Sighted users scrolled into the feed get no visible signal; only a screen reader
gets the `role="alert"`. **Does not fail any criterion** — the spec names `role="alert"`
and is silent on placement, and top-of-`main` matches the codebase convention. A follow-up
could keep this banner for AT and additionally neutralise the save control or add a
point-of-action status hint. File a follow-up rather than block this item.

### LOW — copy slightly over-states the loss
`App.tsx:385-387` says "anything you just changed will be lost when you reload this page".
Measured truth: the collection *names* and ids survive the partial write; the paper
membership does not. The banner errs toward over-warning, which is the right direction for
an error message, so I am not asking for a change — noting it so a future copy edit does not
"correct" it into something vaguer.

### LOW — verbose code comments diverge from the repo's sparse-comment style
`App.tsx:236-239` (3 lines), `App.tsx:381-383` (3 lines), `App.tsx:386-388` (3 lines),
`App.storage.test.tsx:4`, `:19-22`, `:56-57`, `:75-76`, `:88-90`. `.improve/REPO_PROFILE.md`
says "No comments in code unless genuinely needed. The existing code is sparsely commented."
The comments are accurate and they do explain genuinely non-obvious decisions (the
mount-time write, the per-save latching, the shared class), so they are defensible — but at
~25 added comment lines against 19 added code lines in `App.tsx`, the ratio is well outside
the house style. Trim to one line per site at most. Cosmetic; does not block.

### NIT — implementer's report claims `.improve/FEATURES.md` was not touched; it was
`git diff -- .improve/FEATURES.md` shows one line changed: IMP-011 status
`### TODO` → `### IN-PROGRESS`. Harmless, and plausibly the loop harness rather than the
implementer, but `.improve/REPO_PROFILE.md` §4.6.7 requires traceable claims and the report
explicitly says "no `.improve/FEATURES.md`". Worth correcting so a future reader can trust
the rest of the report's "nothing else was touched" list.

### NIT — contrast figure precision
Report says 5.61:1 light; the exact value is 5.6175:1. Truncation, not an error. Recorded
because the brief asked me to compute it independently. Both my figures (5.62 / 6.70) pass
AA comfortably either way.

### NIT — `banner--error` fill is only 1.10:1 against the page
`styles.css:605-608`. Below the 3:1 of WCAG 1.4.11 non-text contrast, so the banner has no
reliable boundary and relies on its red text. **Pre-existing and shared with the import-error
banner** — not introduced here, and consistency with the existing pattern is the right call
for this item. Flagged so a future accessibility pass knows to look at the token, not at
IMP-011.

---

## 10. Bottom line

All 3 acceptance criteria are met and each is backed by a non-vacuous, mutation-proven test
and by real-browser verification. The fix genuinely closes the honesty bug: I measured the
data loss after a failed save and the banner's warning was **true**. Typecheck, 178/178
tests, and the build are all clean, with 12/12 and 30/30 flake runs green and a 0/5 pre-fix
control proving harness sensitivity. No landed item is regressed, and the second
`role="alert"` region coexists cleanly with the existing ones. The MEDIUM banner-placement
observation and the LOW comment-style note are follow-up material, not acceptance blockers.

**VERDICT: PASS**
