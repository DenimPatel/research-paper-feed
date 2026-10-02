# VERIFY-IMP-008 (retry 2) — independent re-verification

**Verifier verdict: PASS** — 3 of 3 acceptance criteria met.

Previous verdict: `.improve/reports/verify-IMP-008.md` = **FAIL** (2/3), on criterion 3's
"`npm test` passes" failing nondeterministically. Implementer's answer: `.improve/reports/impl-IMP-008.md`
§9. Spec: `.improve/FEATURES.md:260-274`.

This is a re-verification of a **test-only** fix. I assumed it was incomplete. It is not: I reproduced the
original flake class from a reconstructed pre-fix file, proved my harness detects it, and then measured the
fixed file against the same harness.

I wrote no source file. Only this report was created. No git write command was run.
`.kilo/worktrees/mildly-income` was never read.

---

## 0. Verdict summary

| # | Acceptance criterion (`FEATURES.md:266-269`) | Previous | This round |
| --- | --- | --- | --- |
| 1 | Empty trimmed query ⇒ `aria-pressed="false"`, no `chip--active`, visible hint | MET | **MET** (re-confirmed independently) |
| 2 | `readHash` never yields `sort: "relevance"` with no `q` | MET | **MET** (re-confirmed independently) |
| 3 | New `urlState` test + `FeedControls` `aria-pressed` component assertion + `npm run typecheck && npm test` passes | **NOT MET** (flake) | **MET** |

---

## 1. THE POINT OF THE RE-VERIFICATION: stress + sensitivity control

### 1.1 My raw run counts (fixed code, real repo `web/`)

```
$ for i in $(seq 1 20); do npm test; done
FULL_PASS=20 FULL_FAIL=0

$ for i in $(seq 1 20); do npx vitest run src/__tests__/App.relevance.test.tsx; done
FILE_PASS=20 FILE_FAIL=0
```

Per-iteration logs `/tmp/rpf-v808/full_{1..20}.log`, `/tmp/rpf-v808/file_{1..20}.log`; wall clock
04:01:30 → 04:02:43 for all 40 processes, so these are 40 real distinct `vitest` processes, not a cached
single run. **40/40 clean.** Add §5's `npm test` (132/132) = 41 full-suite runs, all green.

### 1.2 Sensitivity control — reproduced, and it is stronger than claimed

The implementer claims (impl §9.4/§9.5) that the pre-fix file fails 3/20 under the identical harness. If
that were false, a clean run would prove nothing. I rebuilt the pre-fix file and tested it myself.

**Reconstruction.** `App.relevance.test.tsx` is untracked, so `git` has no pre-fix blob. I rebuilt it by
reversing exactly the three hunks documented in impl §9.3, plus removing the doc comment added to
`renderFeed`: remove the 8-line JSDoc at current `:64-71`, delete the added anchor at current `:128`, and
rewrite `expect(await screen.findByText(` → `expect(screen.getByText(`. Script: `/tmp/rpf-v808/rebuild_prefix.js`.

The reconstruction is corroborated by line numbers landing on the exact lines both prior reports cite:

```
99:    expect(screen.getByText(OTHER.title)).toBeTruthy();          <- previous verifier's ":99"
...
112:    expect(screen.getByText(DIFFUSION.title)).toBeTruthy();     <- previous verifier's ":112"
...
128:    expect(screen.getByText(OTHER.title)).toBeTruthy();          <- implementer's claimed 4th race ":128"
```

All three land exactly. I am confident this is the true attempt-1 file.

**Scratch harness.** `/tmp/rpf-v808/scratch` = `tar` copy of `web/` minus `node_modules`/`dist`/`public`,
with `node_modules` symlinked back, per impl §9.4's method. First I installed the **current fixed** file
there to prove the scratch harness is equivalent to the repo harness:

```
SCRATCH_FIXED_PASS=20 SCRATCH_FIXED_FAIL=0
```

**Control A — faithful pre-fix file, identical harness, 20 runs:**

```
CONTROL_PREFIX_PASS=17 CONTROL_PREFIX_FAIL=3
```

Failures at runs 8, 11, 14. Every failure is the same race, at the same line:

```
$ grep -hoE "App\.relevance\.test\.tsx:[0-9]+" ctrl_*.log | sort | uniq -c
      3 App.relevance.test.tsx:112

FAIL  src/__tests__/App.relevance.test.tsx > relevance sort over a deep link >
      still honours #q=…&sort=relevance, so the fix does not disable relevance
TestingLibraryElementError: Unable to find an element with the text: Diffusion Models for Everything.
 ❯ src/__tests__/App.relevance.test.tsx:112:19
```

This is exactly the defect the previous verdict described: the card renders one commit after the awaited
hero heading, and the synchronous `getByText` runs in that window. **3/20, matching the implementer's
claimed rate and the previous verifier's 3/14.**

**Control B — the implementer's literal method.** impl §9.4 says the control "rewrote only
`expect(await screen.findByText(` → `expect(screen.getByText(` (5 occurrences)", keeping the added anchor.
Reproduced literally:

```
CONTROL_B_PASS=11 CONTROL_B_FAIL=9
```

Two findings, neither affecting the verdict:

- The count in impl §9.4 is **wrong**: the current file has **4**, not 5, occurrences of
  `expect(await screen.findByText(` (`:107`, `:120`, `:128`, `:137`). One of the five hunks is the added
  anchor, not a rewrite.
- Control B fails *more* (9/20) than the faithful reconstruction (3/20), because keeping the added anchor
  as a synchronous `getByText` immediately after `await renderFeed()` creates a fourth, even narrower race.
  So impl §9.5's "CONTROL_PASS=17 CONTROL_FAIL=3" does not follow from the method described in §9.4; the
  number does reproduce for the true pre-fix file, which is what matters.

**Judgement on harness sensitivity.** The harness is sensitive. It reproduces the original bug class at
15–21% on the pre-fix file, deterministically enough that a clean run carries real information. The
40/40 is therefore a genuine signal, not a harness that cannot fail.

### 1.3 Fixed-code totals

| Target | Harness | Runs | Pass | Fail |
| --- | --- | --- | --- | --- |
| `App.relevance.test.tsx` file-only | repo `web/` | 20 | 20 | 0 |
| full suite (`npm test`) | repo `web/` | 21 | 21 | 0 |
| `App.relevance.test.tsx` file-only | scratch (equivalence) | 20 | 20 | 0 |
| my independent behaviour test | scratch2 | 20 | 20 | 0 |

---

## 2. Is the fix correct, or merely timing-dependent?

Read `web/src/__tests__/App.relevance.test.tsx` in full (140 lines). Exact diff pre-fix → current:

```diff
@@ -61,6 +61,14 @@
   );
 }
 
+/**
+ * The hero heading and the controls are gated on `manifest`, but the cards are
+ * filled by a separate effect keyed on `[manifest, urlState.recency]` that flips
+ * `loading` off only once `loadPapers` resolves — so the heading is on screen one
+ * commit before any paper is. Everything gated on `manifest` alone is safe to
+ * assert synchronously; anything gated on `papers` must be awaited. See
+ * `App.retry.test.tsx` for the same split.
+ */
 async function renderFeed(): Promise<HTMLElement> {
@@ -96,7 +104,7 @@
-    expect(screen.getByText(OTHER.title)).toBeTruthy();
+    expect(await screen.findByText(OTHER.title)).toBeTruthy();
@@ -109,7 +117,7 @@
-    expect(screen.getByText(DIFFUSION.title)).toBeTruthy();
+    expect(await screen.findByText(DIFFUSION.title)).toBeTruthy();
@@ -117,6 +125,7 @@
     const group = await renderFeed();
+    expect(await screen.findByText(DIFFUSION.title)).toBeTruthy();
@@ -125,7 +134,7 @@
-    expect(screen.getByText(OTHER.title)).toBeTruthy();
+    expect(await screen.findByText(OTHER.title)).toBeTruthy();
```

Byte-for-byte the hunks documented in impl §9.3. Every change is **strictly strengthening**:

- **3 × sync → awaited.** `getByText` throws immediately if the element is absent; `findByText` retries
  until the default 1000 ms timeout. A conversion can only make an assertion *more* likely to pass, and
  here it makes a correct assertion reliable instead of racy. It is not a timing band-aid: the element
  genuinely does appear, it just appears one commit later.
- **1 × added positive anchor** at `:128`, which had no pre-fix counterpart. Purely additive.
- **1 × doc comment.** Documents the manifest-vs-papers commit split.

### 2.1 Every async-dependent assertion is properly awaited

| Line | Assertion | Depends on | Awaited? |
| --- | --- | --- | --- |
| `:74` | `await screen.findByRole("heading", …)` | `manifest` | yes |
| `:75` | `getByRole("group", {name:"Sort"})` | `manifest` | correct sync — `FeedControls` is in the same `{manifest && …}` block as the hero (`App.tsx:367`, `:380`) |
| `:101` | Relevance `aria-pressed` `"false"` | `urlState` only | correct sync |
| `:102` | `chip--active` absent | `urlState` only | correct sync |
| `:103` | `pressedSortLabels` → `["Newest"]` | `urlState` only | correct sync |
| `:105` | `getByText(/enter a search term…/)` | `query` from `urlState` | correct sync |
| **`:107`** | **`OTHER.title`** | **`papers`** | **`await findByText` — FIXED** |
| `:116` | `pressedSortLabels` → `["Relevance"]` | `urlState` only | correct sync |
| `:118` | `queryByText(hint)).toBeNull()` | `urlState` only | correct sync |
| **`:120`** | **`DIFFUSION.title`** | **`papers`** | **`await findByText` — FIXED** |
| `:121` | `queryByText(OTHER.title)).toBeNull()` | `papers` | see 2.2 |
| **`:128`** | **`DIFFUSION.title`** (added) | **`papers`** | **`await findByText`** |
| `:130` | `getByLabelText("Search papers")` | `manifest` | correct sync |
| `:135`, `:136`, `:138` | chip state / hash after `fireEvent.change` | React state | correct sync — `fireEvent` wraps in `act`, and `applyState` calls `writeHash` synchronously before `setUrlState` (`App.tsx:67-73`) |

No `waitFor` anywhere in the file (`grep -c waitFor` = 0), so there is no blanket always-passes `waitFor`.

### 2.2 The one negative assertion that depends on `papers` — `:121`

`expect(screen.queryByText(OTHER.title)).toBeNull()` at `:121` could pass vacuously if the list had not
rendered. It is sound here: it is ordered immediately after the awaited positive anchor at `:120`, and
`App.tsx:155-160` does `setPapers(list); setLoading(false);` inside a single promise `.then`, which React 18
auto-batches into one render. There is therefore no intermediate state in which a card is on screen but
`papers` is still incomplete — once `DIFFUSION` is found the rendered list is final. Same argument applies to
the `queryByText(hint)).toBeNull()` at `:118`.

### 2.3 No assertion weakened, vague, or dropped

Checked against the pre-fix file specifically, because the failure mode I am hunting for is an assertion
quietly loosened to make a flaky test green:

- **No vague matcher substitution.** The three changed lines still match the **exact literal string**
  (`OTHER.title`, `DIFFUSION.title`). Nothing became `/./`, a function matcher, a regex, or a
  `getAllBy…`. `findByText(OTHER.title)` is exactly as strict as `getByText(OTHER.title)`; only the wait
  differs.
- **No assertion deleted.** `diff` shows 3 replacements, 1 addition, 1 comment. Zero deletions.
- **No blanket `waitFor`.** Zero occurrences.
- **No `.skip` / `.only` / `.todo` / `xit` / `xdescribe` / `fit`:**
  ```
  $ grep -nE "\.(skip|only|todo)\b|\b(xit|xdescribe|fit)\(" \
      src/__tests__/App.relevance.test.tsx src/__tests__/feedControls.test.tsx
  exit=1 (no matches)
  ```
- **Test count is unchanged**: 3 tests before, 3 tests after.

### 2.4 Test-name preservation, via `comm -23`

**(a) `App.relevance.test.tsx`, pre-fix → current** (the file this retry changed):

```
$ grep -oE 'it\("[^"]+"' <pre-fix> | sort > names_prefix.txt
$ grep -oE 'it\("[^"]+"' <current> | sort > names_current.txt
$ comm -23 names_prefix.txt names_current.txt     # names in pre-fix, missing now
<<END — empty>>
$ comm -13 names_prefix.txt names_current.txt     # added
<<END — empty>>
```

Nothing disappeared. Nothing was added.

**(b) `urlState.test.ts`, HEAD → working tree** (the 18-name check; not touched this round):

```
HEAD count: 18   NOW count: 43
$ comm -23 us_head.txt us_now.txt
<<END — empty — all 18 original names survive>>
```

The 25 additions are IMP-008's 6 and IMP-009's 19 (IMP-009 is out of scope and correctly not attributed
here).

**(c) The 11 IMP-008 test names in the two new files** — 3 in `App.relevance.test.tsx`, 8 in
`feedControls.test.tsx`, all present verbatim:

```
lands on a date-ordered feed for #sort=relevance with no q
still honours #q=…&sort=relevance, so the fix does not disable relevance
un-presses Relevance when the search box is cleared, and rewrites the hash
presses Relevance while a search term is present
keeps the hint out of the way when relevance is available
un-presses Relevance and explains why once the query is cleared
names Newest as the sort in effect when relevance is unavailable
shows a visible hint, not a tooltip, when relevance is unavailable
treats a whitespace-only query as no query at all
leaves the default newest sort untouched with no query
still enables Relevance with a query under the newest sort
```

---

## 3. No production code was changed by this retry

`git status --porcelain` at start and at end of this verification is byte-identical:

```
 M .improve/FEATURES.md
 M web/src/components/FeedControls.tsx
 M web/src/lib/__tests__/urlState.test.ts
 M web/src/lib/urlState.ts
?? web/src/__tests__/App.relevance.test.tsx
?? web/src/__tests__/feedControls.test.tsx
(+ untracked .improve/reports/*)
```

`App.relevance.test.tsx` is untracked, so `git diff` cannot show attempt 1 → retry 2. I used mtimes instead:

```
02:45:46  web/src/App.tsx                          <- unchanged since before the FAIL verdict
03:25:55  web/src/lib/urlState.ts
03:26:29  web/src/components/FeedControls.tsx
03:28:09  web/src/lib/__tests__/urlState.test.ts
03:29:01  web/src/__tests__/feedControls.test.tsx
03:47:04  .improve/reports/verify-IMP-008.md        <- previous FAIL verdict written here
03:50:52  web/src/__tests__/App.relevance.test.tsx <- ONLY file modified after the verdict
03:58:55  .improve/reports/impl-IMP-008.md
```

Exactly one source file has an mtime later than the previous verdict, and it is the test file. Every
production file predates it.

### 3.1 Production diffs contain only IMP-008 (+ IMP-009's out-of-scope `urlState` hunks)

- **`web/src/App.tsx` — no diff at all.** `git diff --stat -- web/src/App.tsx` is empty. Correct and
  expected: impl §2.3 explains why `visiblePapers` (`App.tsx:181-198`) needs no change, and the previous
  verifier accepted that reasoning. I re-read `App.tsx:189-198` and agree — `visiblePapers` already
  short-circuits on the trimmed empty query.
- **`web/src/components/FeedControls.tsx`** — only relevance hunks: `relevanceAvailable` /
  `effectiveSort` derivation (`:30-36`), chips reading `effectiveSort` with `disabled={unavailable}`,
  removal of the `title` tooltip, addition of the hint `<p>`. Nothing category-related.
- **`web/src/lib/urlState.ts`** — contains IMP-008's two hunks (`readHash` sort normalization;
  `writeHash` mirror guard) **and** IMP-009's `CategoryResolution` / `resolveCategories` / widened
  `readHash` second parameter. Per the brief, IMP-009's hunks are out of scope and must not fail this item.
  The two IMP-008 hunks do not touch `resolveCategories` and are not entangled with it; the full 43-test
  `urlState` suite passes.

---

## 4. IMP-008 behaviour re-confirmed independently

Because the test file changed, I re-confirmed the behaviour with **my own** test rather than trusting
IMP-008's. Scratch-only, at `/tmp/rpf-v808/Imp008.behavior.verify.test.tsx`; **not** added to the repo.

Key design point: the fixture makes relevance order and date order **disagree**, so the assertions are
discriminating rather than vacuous.

```
MATCH   "Diffusion Models for Everything"  published 2024-03-01  (older, matches "diffusion")
NOMATCH "A Paper About Something Else"     published 2024-03-05  (newer, does not match)

relevance(q=diffusion) -> [MATCH]              (NOMATCH scores 0, dropped by rankPapers)
date-descending        -> [NOMATCH, MATCH]     (read from actual DOM order of <h3> titles)
```

Every scenario asserts the same invariant via one helper: **the pressed chip must equal the order the
papers are actually rendered in**, read from the DOM, never from internal state.

| Scenario | Hash | Pressed chip | Rendered order | Agree? |
| --- | --- | --- | --- | --- |
| 1 — empty query | (none) | Newest | `[NOMATCH, MATCH]` | yes |
| 2 — whitespace-only | `#q=%20%20` | Newest | `[NOMATCH, MATCH]` | yes |
| 2b — whitespace + relevance | `#q=%20%20&sort=relevance` | Newest | `[NOMATCH, MATCH]` | yes; hash loses `sort=relevance` |
| 3 — deep link, no query | `#sort=relevance` | Newest | `[NOMATCH, MATCH]` | yes, on the **first manifest-gated commit** (asserted before any `waitFor`) |
| 4 — real query + relevance | `#q=diffusion&sort=relevance` | Relevance | `[MATCH]` | yes |
| 4b — type then click Relevance | — | Relevance | `[MATCH]` | yes |
| 5 — clear query while pressed | `#q=diffusion&sort=relevance` → clear | Newest | `[NOMATCH, MATCH]` | yes; hash loses `sort=relevance` |
| 5b — retype (D-4) | clear → retype | Newest → Relevance | `[NOMATCH, MATCH]` → `[MATCH]` | yes |

All five scenarios the brief required are covered (1 = empty query, 2 = `#q=%20%20`, 3 = `#sort=relevance`
with no query, 4 = real query with relevance, 5 = clearing while relevance is pressed), plus three extras.

```
$ for i in $(seq 1 20); do npx vitest run src/__tests__/Imp008.behavior.verify.test.tsx; done
BEHAVIOUR_FIXED_PASS=20 BEHAVIOUR_FIXED_FAIL=0
   ✓ src/__tests__/Imp008.behavior.verify.test.tsx (8 tests) 297ms
```

**Non-vacuity of my own test.** I reverted the two production hunks in the scratch copy —
`readHash`'s `query.trim() !== "" && …` gate back to `params.get("sort") === "relevance" ? …`, and
`effectiveSort: SortMode = sort` in `FeedControls`:

```
NONVACUITY_REVERTED_PASS=0 NONVACUITY_REVERTED_FAIL=5
Tests  4 failed | 4 passed (8)

× SCENARIO 2b - #q=%20%20&sort=relevance still falls back to date order
× SCENARIO 3  - deep link #sort=relevance with no q: self-consistent on FIRST render
× SCENARIO 5  - clearing the query while Relevance is pressed
× SCENARIO 5b - retyping re-enables relevance without a second click (D-4)
```

The 4 that still pass are the intended-insensitive ones (empty query, whitespace-only without
`sort=relevance`, real query with relevance, type-then-click). **My behaviour test discriminates**, so its
8/8 is evidence and not a tautology.

This also independently re-confirms criteria 1 and 2, which the previous verdict already accepted.

---

## 5. Required commands, exact results

```
$ npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0                 (no output)

$ npm test
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web

 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 8ms
 ✓ src/lib/__tests__/paperIndex.test.ts (16 tests) 14ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 44ms
 ✓ src/__tests__/feedControls.test.tsx (8 tests) 286ms
 ✓ src/__tests__/App.relevance.test.tsx (3 tests) 322ms
 ✓ src/lib/__tests__/urlState.test.ts (43 tests) 11ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 384ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 84ms

 Test Files  9 passed (9)
      Tests  132 passed (132)
   Duration  2.09s
TEST_EXIT=0
```

**132 tests / 9 files, as expected.** The `(node:…) Warning: --localstorage-file …` lines are
pre-existing Node-build noise, present on baseline runs too.

```
$ npm run build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-DqqHF7nh.js   164.77 kB │ gzip: 52.92 kB
✓ built in 372ms
BUILD_EXIT=0
```

Asset hashes `index-G-YE6pVt.css` and `index-DqqHF7nh.js`, 39 modules, CSS 10.93 kB — byte-identical to
impl §9.7 and to the previous verifier's build. Independent confirmation that **no production byte
changed**.

---

## 6. Issues found

No blocking issue. One documentation inaccuracy, and one carried-forward judgement call.

1. **impl §9.4 miscounts its own control.** It says the control rewrote
   `expect(await screen.findByText(` → `expect(screen.getByText(` **5** occurrences. The current file has
   **4** (`:107`, `:120`, `:128`, `:137`); the fifth hunk is the *added* anchor, not a rewrite. Cosmetic —
   it changes the control's failure rate (9/20 rather than 3/20) but not its conclusion. Worth a one-line
   correction if the report is kept as a durable record.
2. **impl §9.5's "CONTROL_PASS=17 CONTROL_FAIL=3" does not follow from the method described in §9.4.**
   That method yields 9/20; the faithful pre-fix reconstruction yields exactly 3/20. The *number* is right
   for the right file; the *method* attributed to it is not. Again cosmetic — §9.5's conclusion (harness is
   sensitive, therefore 40/40 is meaningful) is correct, and I confirmed it independently.
3. **Carried forward, unchanged, not a defect:** the `writeHash` mirror guard at `urlState.ts:148-153`
   (`state.sort !== "newest" && state.query.trim() !== ""`) is beyond the literal text of criterion 2. It
   was already accepted by the previous verifier; it is exercised by scenario 5 above (the address bar drops
   `sort=relevance` on clear) and is the same class of lie criterion 2 removes, relocated from the chip to
   the URL. I stand behind keeping it.

## 7. Uncertainties and limits of this verification

- **Not a browser check.** I did not run Playwright. No production code changed, so no new visual state
  exists to capture, and the previous verifier already captured and checked the four screenshots under
  `.improve/artifacts/IMP-008/`. My §4 evidence is jsdom-level DOM, not rendered pixels.
- **The control's 3/20 is a rate, not a guarantee.** 3 failures in 20 is enough to prove sensitivity, but a
  harness that fails 1-in-20 would give a weaker signal. Here the failure is *identical* every time
  (same line `:112`, same `Unable to find … Diffusion Models for Everything`), which is the signature of a
  real commit-order race rather than jitter, so I treat the 40/40 as informative. It is still a
  probabilistic argument, not a proof of absence.
- **Two copies of the `trim()` predicate** (`urlState.ts` and `FeedControls.tsx`) can drift. Both agree
  today and my scenario 2b exercises the intersection, but this is impl §8's open note, still open.
- **IMP-009's `urlState.ts` hunks were not re-verified.** Out of scope per the brief. I confirmed only that
  they do not overlap IMP-008's and that the combined 43-test suite is green.

## 8. Verdict

**PASS — 3/3 acceptance criteria met.**

The previous FAIL was a test-authoring bug in a file IMP-008 itself created, and the production code was
correct then and is byte-identical now. The fix is not timing-dependent: it is three
synchronous-to-awaited query conversions plus one added positive anchor, each strictly strengthening, with
no assertion deleted, loosened, or skipped, and with test names preserved (verified by `comm -23` against
the reconstructed pre-fix file). The flake class is real and I reproduced it independently at 3/20 on the
pre-fix file under the identical harness, so the 80 clean runs of the fixed code are a meaningful signal.
