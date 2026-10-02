# Verification — IMP-192 (order-dependent test flake, three files)

**Verifier:** independent re-check. I did not write the change. No source file was
modified. No git write command was run. `.kilo/worktrees/mildly-income` was not read.
`.improve/PROGRESS.log` was not touched.

**Repo:** `/Users/denimpatel/Desktop/git/research-paper-feed` @ `64ad36a`, branch
`improve/auto-20261002`, working tree carrying exactly the three test-file
modifications under review.

**Scope of what I claim.** The three implementers each conceded that plain shuffling
has weak or zero detection power for this defect class, and rested their case on an
amplified A/B. That makes the A/B the load-bearing evidence, so I rebuilt it from
scratch in my own `/tmp` scratch project and re-measured every cell. I also checked the
thing a 40/40-clean claim cannot check: whether the new `waitFor` can fail at all.

---

## VERDICT

**The fixes are load-bearing.** All three remove a real race, not a symptom. In an
amplified window where the racy file fails 100% of the time, the fixed file passes 100%
of the time, in the same harness, differing only in the test file. The new waits are
provably strict: with the expected alert made unmountable, every one of the four fixed
tests fails by `waitFor` timeout, at the new `waitFor` line. No expected count was
lowered, no query was swapped for a null-tolerant variant, no timeout was inflated,
nothing was skipped or deleted, and all 253 test names survive byte-identical against
`HEAD`.

One issue, non-blocking: a *latent* sibling of the fixed defect remains in
`App.partialShard.test.tsx` (see §6). It is not the fixed defect — it is safe today only
because of a React-batching invariant two source statements away — but it is the next
flake in this class and the implementers' reports do not flag it.

---

## 1. Harness

Scratch project `/tmp/ver192/<variant>/`: `node_modules` symlinked to the repo's, `src/`
`vite.config.ts` `tsconfig.json` `index.html` `public/` copied, so the vitest include
glob and every import resolve exactly as in the repo. Two axes:

* **Test file**: `racy` = restored from `HEAD` via `git show HEAD:web/src/__tests__/…`
  and `diff`-verified byte-identical to the pre-fix original; `fixed` = the working tree.
  Verified: `diff` clean for both axes on all three files.
* **Window**: the only edit is to the scratch copy's `src/App.tsx`, on the state the
  racing assertion depends on.
  * `save` delay — `App.tsx:409` `setSaveFailed(!saveState(collections));` becomes
    `const __v = !saveState(collections); setTimeout(() => setSaveFailed(__v), MS);`
  * `panel` delay — `App.tsx:275-276` in the papers-load `.catch` become
    `setTimeout(() => { setError(__e); setLoading(false); }, MS);`
  * unmount controls — `{saveFailed && (` → `{false && saveFailed && (`, and
    `{unknownCategories.length > 0 && (` → `{false && …`.

**Tally method: exit code only.** IMP-192c §6 recorded that a grep-based harness
silently reported false passes because vitest indents its summary line. I used
`if [ $? -ne 0 ]` on every run and cross-checked the aggregate tallies against the
per-run `Tests` lines in the retained logs. They agree everywhere below.

**Total vitest invocations: 188** — 145 in scratch variants, 40 in the repo, 3 for
name-set extraction. Plus `tsc --noEmit` ×1, `vitest run` ×2, `vite build` ×2.

---

## 2. THE CENTRAL QUESTION — are the fixes load-bearing?

### 2a. `App.loadFailure.test.tsx:906` — the reported flake

Two independent amplifiers for this site, because the racing pair is the load-failure
panel vs. the unknown-category banner, not the storage banner.

**Amplifier 1 — the documented seed, no product edit at all.**

| # | Test file | Window | Scope | Runs | Result |
|---|---|---|---|---|---|
| A1 | **racy** (`HEAD`) | none | whole suite, `--sequence.shuffle --sequence.seed=1790961487276` | **10** | **0 pass / 10 FAIL** |
| B1 | **fixed** | none | whole suite, same seed | **10** | **10 pass / 0 FAIL** |

Failure signature, byte-identical to `.improve/reports/regression-sweep-4.md:77-78`:

```
 FAIL  src/__tests__/App.loadFailure.test.tsx > the load failure alongside the other notices
       > coexists with the unknown-category banner as two distinct alerts
AssertionError: expected [ <p …(2)>…(2)</p> ] to have a length of 2 but got 1
 ❯ src/__tests__/App.loadFailure.test.tsx:906:42
```

**Amplifier 2 — my own 25ms product window, so the result does not rest on one seed.**

| # | Test file | Window | Scope | Runs | Result |
|---|---|---|---|---|---|
| A2 | **racy** | panel **25ms** | whole suite | **5** | **0 pass / 5 FAIL** (`1 failed | 25 passed (26)`) |
| B2 | **fixed** | panel 25ms | whole suite | **5** | **5 pass / 0 FAIL** (`26 passed (26)`) |
| A2s | **racy** | panel 25ms | single file | **5** | **0 pass / 5 FAIL** |
| B2s | **fixed** | panel 25ms | single file | **5** | **5 pass / 0 FAIL** |
| A4 | **racy** | panel **100ms** | single file | **3** | **0 pass / 3 FAIL** |
| B4 | **fixed** | panel 100ms | single file | **3** | **3 pass / 0 FAIL** |

The 25ms and 100ms windows produce the **same** signature at the same line
(`App.loadFailure.test.tsx:906:42`), and 25 of 26 tests in the file are unaffected — so
the amplification is targeted, not a blanket breaker.

**Sites `:882` and `:894`** (the save-failure sibling test) fail under the save window:

| # | Test file | Window | Scope | Runs | Result |
|---|---|---|---|---|---|
| A5 | **racy** | save 25ms | whole suite | **5** | **0 pass / 5 FAIL** |
| B5 | **fixed** | save 25ms | whole suite | **5** | **5 pass / 0 FAIL** (`253 passed (253)`) |

Signature: `expected [ <div …(2)>…(3)</div> ] to have a length of 2 but got 1`, at the
pre-fix `coexists with the save-failure banner as two distinct alerts` line.

### 2b. `App.partialShard.test.tsx:416` and `:432`

| # | Test file | Window | Scope | Runs | Result |
|---|---|---|---|---|---|
| C1 | **racy** (`HEAD`) | save **25ms** | single file | **5** | **0 pass / 5 FAIL** — `1 failed \| 8 passed (9)` every run |
| C2 | **fixed** | save 25ms | single file | **8** | **8 pass / 0 FAIL** — `9 passed (9)` every run |
| C3 | **racy** | save 25ms | whole suite | **5** | **0 pass / 5 FAIL** |
| C4 | **racy** | save **250ms** | single file | **3** | **0 pass / 3 FAIL** — `1 failed \| 8 passed (9)` |
| C5 | **fixed** | save 250ms | single file | **3** | **3 pass / 0 FAIL** |
| C6 | **racy** | **none (shipped product)** | single file, `--sequence.shuffle` | **8** | **8 pass / 0 FAIL** |
| C7 | fixed | none (shipped product) | single file, `--sequence.shuffle` | 5 | 5 pass / 0 FAIL |

Signature, at the exact pre-fix line named in my brief:

```
 FAIL  src/__tests__/App.partialShard.test.tsx > the shard notice alongside the storage notice
       > shows both as separate alerts and announces neither twice
AssertionError: expected [ <p …(4)><strong></strong></p> ] to have a length of 2 but got 1
 ❯ src/__tests__/App.partialShard.test.tsx:416:20
```

**C6 is the honest limit, and I confirm it:** the racy file at the shipped timing
passes 8/8. IMP-192b §5a's concession was accurate, and its 40/40 battery indeed proved
nothing on its own. C1-vs-C2 is what proves the fix.

### 2c. `App.storage.test.tsx:154-161`

| # | Test file | Window | Scope | Runs | Result |
|---|---|---|---|---|---|
| D1 | **racy** (`HEAD`) | save **25ms** | single file | **5** | **0 pass / 5 FAIL** — `1 failed \| 7 passed (8)` every run |
| D2 | **fixed** | save 25ms | single file | **8** | **8 pass / 0 FAIL** — `8 passed (8)` every run |
| D3 | **racy** | save 25ms | whole suite | **3** | **0 pass / 3 FAIL** |
| D4 | **fixed** | save 25ms | whole suite | **3** | **3 pass / 0 FAIL** — `253 passed (253)` |
| D5 | **racy** | save **250ms** | single file | **3** | **0 pass / 3 FAIL** |
| D6 | **fixed** | save 250ms | single file | **3** | **3 pass / 0 FAIL** |
| D7 | **racy** | **none (shipped)** | whole suite, `--sequence.shuffle` | **8** | storage test **8/8 PASS** (see below) |

Signature, at the exact pre-fix line named in my brief:

```
 FAIL  src/__tests__/App.storage.test.tsx > a collections save that localStorage refuses
       > warns instead of letting the optimistic update pass as a real save
TestingLibraryElementError: Unable to find an accessible element with the role "alert"
 ❯ src/__tests__/App.storage.test.tsx:155:20
```

**D7 attribution, stated precisely.** One of the 8 runs failed, so the raw tally is
7 pass / 1 fail. I attributed it per run from the log: the single failure is
`App.loadFailure.test.tsx > coexists with the unknown-category banner` at
`loadFailure.test.tsx:906` — the *first* defect, which that variant also carries in its
racy form. The storage test passed in **8 of 8** un-amplified runs. So plain shuffling
has **zero** detection power for the storage defect too, and IMP-192c §5b was correct.

### 2d. The one control that settles all three at once

| Test tree | Window | Scope | Runs | Result |
|---|---|---|---|---|
| **all three racy** (`HEAD`) | save **250ms** | whole suite | 3 | **0 pass / 3 FAIL** — `3 failed \| 250 passed (253)` every run |
| **all three fixed** (working tree) | save **250ms** | whole suite | 3 | **3 pass / 0 FAIL** — `253 passed (253)` every run |

The racy tree's failures are **exactly and only** the three repaired assertions:

```
 FAIL  App.loadFailure.test.tsx   > coexists with the save-failure banner as two distinct alerts
 FAIL  App.partialShard.test.tsx  > shows both as separate alerts and announces neither twice
 FAIL  App.storage.test.tsx       > warns instead of letting the optimistic update pass as a real save
```

250 of 253 tests are completely insensitive to a 250ms delay on the storage notice. That
is the "a widening large enough to break any timing-sensitive test would be useless"
check, and it is answered empirically rather than by assertion.

### 2e. Failure signatures match the brief — no unrelated error

All three racy controls fail at the **exact pre-fix line numbers** named in the task
(`loadFailure:906`, `partialShard:416`, `storage:155`), with the count-1-vs-expected-count
signature, and **only** their own test fails in single-file scope (1 of 26, 1 of 9, 1 of
8). The `loadFailure` signature is byte-identical to `regression-sweep-4.md:77-78`. No
timeout, no unrelated `TypeError`, no cross-file contamination in the isolated runs.

---

## 3. Is ~25ms a legitimate amplification, or a manufactured failure?

**Legitimate. Four independent reasons, each measured.**

1. **It is not a blanket breaker, and that is measured at 10× the margin.** At a 250ms
   window the *fixed* tree passes 253/253 whole-suite, and the *racy* tree still passes
   250/253 — only the three repaired assertions respond. A widening that broke
   timing-sensitive tests generally would have shown up in those 250. It did not.
2. **It is placed where the race lives, and the two arms differ only in the test file.**
   Same window, same seed, same order, same harness, same vitest binary. The racy file
   loses 100% and the fixed file wins 100%. If the fix had been a mechanical lowering of
   the count, the amplified racy file would have passed for the wrong reason. It does
   not — and §4 proves the count is still live.
3. **The verdict is a step function of the window, not a tuned knife edge.** 0ms → racy
   passes; 25ms → racy fails 100%; 100ms → fails 100%; 250ms → fails 100%. I did not
   search for a magic number; the smallest window I tried that separates the two arms is
   25ms, and it separates them absolutely.
4. **25ms is a plausible, arguably conservative, user-perceptible settle time — and on
   the low side of plausible, which is the right direction for this argument.** These
   notices are the reader-facing feedback for a failed write of their collection list or
   the outcome of a shard fetch that spans a network round trip. 25ms is 1–2 frames at
   60Hz and roughly one paint. Any 25–100ms of extra scheduling — a long task from
   reconciling 2,812 papers, a `JSON.parse` of a full shard, a throttled CI runner, a
   loaded dev machine, a React 18 concurrent render that yields — puts the notice visibly
   later than the commit that caused it. Meanwhile the *unfixed* assertion's real margin
   in the shipped product is sub-millisecond: RTL's `asyncWrapper` drains the microtask
   queue before `findByRole` resolves, so the racing effect usually lands first. So 25ms
   is not an extreme perturbation, it is one realistic scheduling hiccup.

**What the amplification does *not* prove, stated plainly.** It does not show the
partial-shard and storage defects would fire in the shipped product. Measured detection
rates for the un-amplified racy controls in this environment: `loadFailure` 10/10 at the
documented seed (and 1/8 incidentally under random shuffle), `partialShard` 0/8,
`storage` 0/8. Only the `loadFailure` defect is an *observed* flake. The other two are
**latent** races that the shipped timing happens to hide. The honest claim is therefore:
the fix removes a dependence on a sub-millisecond margin that the product does not
guarantee. That is a real fix, and it is the fix the defect class calls for — but only
one of these three was ever red.

---

## 4. NON-VACUITY — the new `waitFor` fails when the alert can never reach N

Each expected alert made **unmountable** in the scratch copy only, so it can never reach
N. The test must FAIL, by `waitFor` timeout, at the new `waitFor` line.

| # | Fixed test | Unmounted | Runs | Result | Fails at | Elapsed |
|---|---|---|---|---|---|---|
| N1 | `loadFailure` — *coexists with the save-failure banner* | storage banner | **2** | **0 pass / 2 FAIL** | **`App.loadFailure.test.tsx:886:44`** | 1556ms / 1534ms |
| N2 | `loadFailure` — *coexists with the unknown-category banner* | unknown-category banner | **2** | **0 pass / 2 FAIL** | **`App.loadFailure.test.tsx:920:44`** | 1542ms / 1506ms |
| N3 | `partialShard` — *shows both as separate alerts* | storage banner | **2** | **0 pass / 2 FAIL** | **`App.partialShard.test.tsx:421:44`** | 1301ms / 1335ms |
| N4 | `storage` — *warns instead of letting the optimistic update pass* | storage banner | **2** | **0 pass / 2 FAIL** | **`App.storage.test.tsx:158:11`** | 5357ms |

N1: `AssertionError: expected [ <div …(2)>…(3)</div> ] to have a length of 2 but got 1`
N2/N3: `AssertionError: expected [ <p …(4)><strong></strong></p> ] to have a length of 2 but got 1`
N4: `TestingLibraryElementError: Unable to find role="alert"` — `Tests 5 failed | 3 passed (8)`, the
five banner-dependent tests in that file, all correct for a product that never renders
the notice.

Every failure lands on the **new `waitFor` line**, and the elapsed times are the
`waitFor` timeout being polled to exhaustion (1.3–1.6s per site; 5.36s for N4's five
sequential timeouts). The waits poll and then fail. **None of them swallows failure.**

**Coverage gap I should name.** N1 exercises `:886` but not `:903` — once `:886` throws,
`:903` is never reached. `:903` is bounded by identical `waitFor` semantics, and the
assertion immediately after it (`:906`, `toContain(storage)`) re-checks node identity, so
a vacuous `:903` could not hide a wrong node there. I did not build a separate harness to
reach `:903` in isolation; the residual risk is negligible but it is not zero-proven.

---

## 5. ASSERTIONS NOT WEAKENED

`git diff -- web/src/__tests__/` is **6 hunks across 3 files**: `+20 −5`,
`+11 −2`, `+6 −0`. No `import` line changed — `waitFor` was already imported in all three
files before the change.

| Site (pre-fix) | Before | After | Count |
|---|---|---|---|
| `loadFailure:882` | `expect(screen.getAllByRole("alert")).toHaveLength(2);` | `await waitFor(() =>` …`toHaveLength(2),` `);` | **2 → 2** |
| `loadFailure:894` | same | same | **2 → 2** |
| `loadFailure:906` | `await screen.findByRole("alert");` + `expect(...).toHaveLength(2)` | `await waitFor(() =>` …`toHaveLength(2),` `);` | **2 → 2** |
| `partialShard:416` | `expect(alerts).toHaveLength(2);` | `await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2));` + `const alerts = screen.getAllByRole("alert");` | **2 → 2** |
| `partialShard:432` | `expect(screen.getAllByRole("alert")).toHaveLength(2);` | `waitFor` wrapper | **2 → 2** |
| `storage:155` | `const banner = saveFailedBanner();` where the helper is `screen.getByRole("alert")` (throws on 0 **and** on >1) | `await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(1));` + `const banner = saveFailedBanner();` | **exactly-1 → exactly-1** |

Checked and clean:

* **No lowered count.** Every expected value is byte-identical to the pre-fix value. The
  `storage` change is an equivalence, not a reduction: `getByRole` throws on both 0 and
  >1 matches, and `getAllByRole(...).toHaveLength(1)` is the same assertion made
  waitable. The four `textContent` / `className` assertions after it (`:162-166`) are
  untouched.
* **No `findAllBy*` / `queryAllBy*` substitution.** Grep for
  `findAllBy|queryAllBy` across `src/__tests__/` and `src/lib/__tests__/`: **0 hits**.
  Nothing was swapped in to make a null or empty result pass.
* **No blanket or trivial `waitFor`.** Grep for `waitFor(() => {})`: **0 hits**. Every
  new `waitFor` body is a real `expect` on a real count, and §4 proves each one fails.
* **No swallowed errors.** Grep for `.catch(` across all test files: **0 hits**.
* **No timeout inflation.** Grep for `testTimeout|hookTimeout`: **0 hits**. No
  `vi.setConfig`, no config change, no `build.testTimeout`. `vite.config.ts` is untouched.
* **No skipping or deleting.** Grep for `.skip|.only|.todo` across all test files:
  **0 hits**.
* **The files still assert the same thing**, only with correct waiting. The only
  behavioural deltas are: (a) the three `waitFor` wrappers, and (b) at
  `loadFailure:906` the now-redundant `await screen.findByRole("alert")` was *replaced*
  by the count-wait, which strictly subsumes it — the test still requires ≥2 alerts
  before it proceeds, so it cannot get weaker by proceeding earlier.
* **`loadFailure:877`'s `await screen.findByRole("alert")` was deliberately kept** as the
  mount barrier `saveSomething()` needs before it can click `/^Collections/`. Correct.

**Test names — 253 vs 253, identical sets.** Extracted with `--reporter=json` from the
working tree and from a clean `git archive HEAD` copy of `web/`, then diffed:

```
FIXED total tests: 253 passed: 253 failed: 0 pending: 0 files: 16
HEAD  total tests: 253 passed: 253 failed: 0 pending: 0 files: 16
TEST NAME SETS IDENTICAL   (diff: no output)
```

Per-file counts, summing to 253 across 16 files: `urlState` 50, `collections` 41,
`paperIndex` 28, `App.loadFailure` 26, `App.categories` 21, `feedControls` 14,
`search` 12, `errorBoundary` 11, `App.partialShard` 9, `App.storage` 8, `failureCopy` 8,
`App.retry` 7, `paperCardNullUrls` 7, `malformedImport` 5, `App.relevance` 3,
`domEnvironment` 3. Nothing added, removed, renamed, reordered, or skipped.

---

## 6. COMPLETENESS — full audit of `web/src/__tests__/`

Every alert-query and alert-state-read site in all 11 files under `src/__tests__/`
(139 further tests in `src/lib/__tests__/` are pure logic, no DOM, not applicable).
I report every site, including the ones I judge safe, and say why.

**Racy, now fixed — 6 sites, 0 remaining:**

| File:line (post-fix) | Note |
|---|---|
| `App.loadFailure.test.tsx:886` | the sweep-4 flake's sibling test |
| `App.loadFailure.test.tsx:903` | its re-assert after the search re-render |
| `App.loadFailure.test.tsx:920` | **the reported flake** |
| `App.partialShard.test.tsx:421` | the `:416` site |
| `App.partialShard.test.tsx:440` | the `:432` site |
| `App.storage.test.tsx:159` | the `:155` site |

**Same shape, currently safe by a different invariant — the one thing I would escalate.**
These read alert state after awaiting a *paper title*, which is the literal shape that was
just fixed at `App.partialShard.test.tsx:421`. They are safe **only** because
`App.tsx:262-264` sets `setPapers(list)` and `setFailedShards(list.failedFiles)` as
adjacent statements in one `.then`, and React 18 auto-batches them into a single commit —
so the awaited title implies the notice. Verified sites:

| File:line | Reads | Why safe today |
|---|---|---|
| `App.partialShard.test.tsx:277` | `getAllByRole("alert")).toHaveLength(1)` after `await findByText(W09.title)` at `:276` | single commit, per the batching invariant. Also a "must not accumulate" assertion — `waitFor` would weaken it |
| `App.partialShard.test.tsx:286` | `partialNotice()` (throws unless exactly 1) after `await findByText(W09.title)` at `:284` | same invariant; the helper throws, so it cannot pass vacuously |
| `App.partialShard.test.tsx:315` | `toHaveLength(1)` after `await findByText(W09.title)` at `:304` + two sync `fireEvent.change` | same invariant; re-renders do not re-run the load |
| `App.partialShard.test.tsx:326` | `partialNotice()` after `await findByText(W09.title)` at `:324` | same invariant; helper throws |

**These are not currently failing and I am not calling them defects.** But the guarantee
they rest on is a React batching property two source statements away, not a wait. If
anyone inserts an async hop between `setPapers` and `setFailedShards`, or moves the notice
into its own effect, these four become the next flake in this class. Neither
`impl-IMP-192b.md` §3 nor `impl-IMP-192c.md` §3 lists them.

**Safe, opposite shape — "must not appear yet / ever".** `waitFor` would invert the
intent, so leaving these alone is correct, not an oversight:

`App.loadFailure.test.tsx:262-266` (empty-window claim + `article.paper` count 0, after
`await findByRole("alert")` at `:256`) · `:351` · `:359` (pre-existing
`waitFor(queryByRole→null)`) · `:378` (after `fireEvent.click(tryAgain())`; `healthy=true`
makes the retry succeed, so the panel cannot return) · `:759` · `:778` · `:861` ·
`App.partialShard.test.tsx:272` (shards still gated behind `release()`) · `:337`
(pre-existing) · `:349` · `App.storage.test.tsx:146` (no dispatch yet ⇒ `unsavedChanges`
false ⇒ the save effect returns at `App.tsx:404` before it can arm anything) · `:178`
(pre-existing) · `:222` (storage never fails ⇒ banner unreachable) · `:243` (cold boot) ·
`:269` · `:280` (pre-existing) ·
`App.categories.test.tsx:192` (pre-manifest) · `:295` · `:314` (click inside the already
awaited notice; `fireEvent` is act-wrapped) · `:373` · `:395` · `:525` ·
`App.retry.test.tsx:156` (manifest fetch is gated, so the panel cannot return) ·
`errorBoundary.test.tsx:57`.

**Safe, "already awaited" — the awaited node *is* the node under test:**

`App.loadFailure.test.tsx:324`+`:326` · `:350`+`:359` · `:389`+`:435` · `:447`+`:453` ·
`:468`+`:470` · `:508`+`:501`(`indexPanel()`) · `:629` (panel contains the awaited text) ·
`:648-650` (pre-existing `waitFor` count 1) · `:666` · `:696`+`:699`/`:708` (the awaited
regex is *inside* the alert node) · `App.partialShard.test.tsx:360`+`:368`
(`setFailedShards([])`+`setError(...)` adjacent at `App.tsx:273-275`, one commit) ·
`App.storage.test.tsx:173`+`:178` · `:189`+`:195`/`:198` (a second failed save sets
`saveFailed` to the value it already holds, so the node never unmounts between the two
reads) · `:205`+`:212` (`saveFailed` is app-level; the view switch does not re-run the
effect) · `:273`+`:274` ·
`App.categories.test.tsx:270`+`:277` (the awaited alert *contains* the control) ·
`:288`+`:291` · `:305`+`:308` · `App.retry.test.tsx:92` (`renderUnavailableFeed`).

**Safe, "must not accumulate" — count 1 as a *negative* proof.** Wrapping these in
`waitFor` would be a strictness loss, because `waitFor` returns immediately on the
current value and would let a second alert mounting one tick later go undetected. All
three implementers made this call independently and I agree with it:
`App.loadFailure.test.tsx:440` · `:456` · `:470` · `:708` ·
`App.partialShard.test.tsx:277` · `:315` · `:368` ·
`App.storage.test.tsx:198` · `App.categories.test.tsx:277` · `:371`.

**Helpers that throw unless the count is exactly 1** — already strict, not count
assertions: `App.loadFailure.test.tsx:202` (`failurePanel()`), `:791`
(`partialNotice()`), `App.partialShard.test.tsx:194` (`partialNotice()`),
`App.categories.test.tsx:129` and `App.storage.test.tsx:140` (`getByRole`, throws on 0
*and* >1).

**Fully synchronous, no async anywhere — not candidates:**
`errorBoundary.test.tsx:67`, `:79`, `:93`, `:103`, `:196` (`toHaveLength(1)` on a
synchronously rendered tree) · `malformedImport.test.tsx:132`, `:173` ·
`paperCardNullUrls.test.tsx:70`, `:128`, `:148` · `domEnvironment.test.tsx:30-38` ·
`feedControls.test.tsx` (14 tests, no alert query at all) · `App.relevance.test.tsx`
(3 tests, no alert query at all).

**Conclusion on completeness: no remaining racy site of the reported shape.** The class
is closed at all 6 known sites. The four `App.partialShard.test.tsx` sites in the second
table are the same shape but currently safe, and are the correct next item to look at.

---

## 7. Required checks and run batteries

| Check | Command | Result |
|---|---|---|
| Typecheck | `npm run typecheck` | **exit 0**, clean (`tsc --noEmit`, no output) |
| Tests | `npm test` | **exit 0** — `Test Files 16 passed (16)`, `Tests 253 passed (253)`, 0 pending |
| Build | `npm run build` | **exit 0** — `index.html 1.00 kB`, `index-*.css 10.93 kB`, `index-*.js 171.45 kB`, `✓ built in 469ms` |

Build byte sizes are identical to `regression-sweep-4.md:36` and to all three implementer
reports, which independently confirms no production file moved. `git status --porcelain`
shows only the three test files (mine to review) plus `.improve/PROGRESS.log` and the
untracked reports — all pre-existing.

### Repo-level run batteries (in the real repo, exit-code tallied)

| # | Command | Runs | Failures |
|---|---|---|---|
| 1 | `npm test --sequence.shuffle` | **20** | **0** |
| 2 | `npm test --sequence.shuffle --sequence.seed=1790961487276` | **10** | **0** |
| 3 | `npm test` (plain, no shuffle) | **10** | **0** |
| | **total** | **40** | **0** |

**40/40 clean — and I am explicitly not resting the verdict on it.** Per §2b/§2c, the
un-amplified racy controls for `partialShard` and `storage` also pass 8/8 under plain
shuffle in this environment, so 40 clean runs are consistent with either the fix or no fix
for those two files. The verdict rests on A1/B1, A2/B2, A2s/B2s, A4/B4, A5/B5, C1/C2, C4/C5,
D1/D2, D5/D6, the 250ms whole-suite pair, and N1–N4.

---

## 8. Corrections and additions to the implementers' own claims

Nothing they wrote was materially wrong. Recorded for the file:

1. **IMP-192b §5a and IMP-192c §5b are both confirmed** — plain shuffling has 0/8
   detection power for the `partialShard` and `storage` defects. Their 40/40 and 22/22
   batteries prove nothing on their own, exactly as they said.
2. **IMP-192 §7's "the 20/20 random-shuffle result is real but not conclusive" is
   right**, and I go further: for the two later files it is not even weakly conclusive.
3. **IMP-192b §5b's isolation caveat is real but no longer needed.** It reported having to
   isolate control C to a single file because the widened window broke
   `App.storage.test.tsx:155` — a genuine third instance, since fixed. With the final
   tree, the racy-vs-fixed whole-suite pair at 250ms (§2d) isolates cleanly: 3 failures,
   all and only the three repaired assertions.
4. **IMP-192c §6's methodological warning is correct and I adopted it** — every number in
   this report is tallied on exit code, cross-checked against the retained per-run
   `Tests` lines.
5. **One addition, not a correction:** none of the three reports lists
   `App.partialShard.test.tsx:277`, `:286`, `:315`, `:326` as same-shape sites. They are
   safe today (§6) but rest on the React batching invariant at `App.tsx:262-264`, not on
   a wait. Neither report is wrong to have omitted them from a *racy* list; they belong
   on a watch list.

---

## 9. Verdict

| Criterion | Result |
|---|---|
| `loadFailure:906` (the reported flake) fixed, load-bearing, non-vacuous | **PASS** — A1 0/10 vs B1 10/10 at the seed; A2 0/5 vs B2 5/5 at 25ms; A4 0/3 vs B4 3/3 at 100ms; N2 2/2 fail at `:920` |
| `loadFailure:882` / `:894` fixed, load-bearing | **PASS** — A5 0/5 vs B5 5/5; N1 2/2 fail at `:886` |
| `partialShard:416` / `:432` fixed, load-bearing, non-vacuous | **PASS** — C1 0/5 vs C2 8/8 at 25ms; C4 0/3 vs C5 3/3 at 250ms; N3 2/2 fail at `:421` |
| `storage:154-161` fixed, load-bearing, non-vacuous | **PASS** — D1 0/5 vs D2 8/8 at 25ms; D5 0/3 vs D6 3/3 at 250ms; N4 2/2 fail at `:158` |
| Amplification is legitimate, not manufactured | **PASS** — 250/253 insensitive at 10× the margin; step function 0/25/100/250ms; 25ms is 1–2 frames |
| Failure signatures match sweep-4 and the brief's line numbers | **PASS** — byte-identical, at `:906`, `:416`, `:155` |
| Non-vacuity (all four fixed tests) | **PASS** — N1–N4 all fail by `waitFor` timeout at the new lines |
| No assertion weakened; counts exact; nothing skipped or deleted | **PASS** — 6 hunks, counts byte-identical, 0 hits for every weakening pattern, 253/253 names identical |
| Completeness of the audit | **PASS** — 0 remaining racy sites; 4 same-shape-but-safe sites reported |
| `typecheck` / `npm test` 253/16 / `build` | **PASS** — all exit 0, build bytes identical to baseline |
| Run batteries | **PASS** — 20 shuffle / 10 seed / 10 plain, 40/40 clean; 145 scratch-variant runs |

**VERDICT: PASS.** One follow-up item, non-blocking: `App.partialShard.test.tsx:277`,
`:286`, `:315`, `:326` are the same shape as the fixed defect and are currently safe only
via the `setPapers`/`setFailedShards` batching invariant at `App.tsx:262-264`. Worth a
comment at those four lines recording the invariant they depend on, so the next agent who
splits that pair knows which assertions just became racy.
