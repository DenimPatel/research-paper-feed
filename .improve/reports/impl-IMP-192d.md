# IMP-192d — the partial-shard flake was not where the sweep said it was

**Scope:** `web/src/__tests__/App.partialShard.test.tsx` only, plus this report.
No production file, no config file, no other test file was touched.
**Date:** 2026-10-02

---

## Verdict

**Regression-sweep-5's R-1 diagnosis was wrong on both the line and the mechanism,
and its proposed fix is provably inert.** The flake it observed in
`shows both as separate alerts and announces neither twice` is not the
`waitFor` at `:415`; it is `await screen.findByText(W09.title)` immediately after
`render(<App />)` — the async data load, on the same default 1000 ms budget but a
different line. Adding `{ timeout: 3000 }` to that `waitFor` cannot fix it, and an
A/B arm with the sweep's fix applied verbatim fails 5 of 5 under amplification.

The cause is CPU starvation, not settle time: the load genuinely needs more than
1000 ms on a loaded runner, and no `waitFor` in this file was ever a long wait.

I also found that **all three `waitFor` calls in the file were polls whose bodies
were already true on entry**, and the premise in their comments (that the two live
regions "mount on independent ticks") is false. They are gone, replaced by a
specific precondition await and synchronous assertions of the same counts.

---

## 1. Is the default `waitFor` timeout really the budget? (checked, not assumed)

| Source | Finding |
|---|---|
| `web/vite.config.ts:7-11` | `test: { environment, include, setupFiles }` — **no** `testTimeout`, no `hookTimeout` |
| `web/src/test-setup.ts` (9 lines) | `afterEach(cleanup)` only — **no** `configure()` call |
| `grep -rn "asyncUtilTimeout\|configure(\|testTimeout\|timeout:" src/ vite.config.ts package.json` | **zero matches** |
| `node_modules/@testing-library/dom/dist/wait-for.js:16` | `timeout = getConfig().asyncUtilTimeout` → default **1000 ms** |
| vitest default | `testTimeout` **5000 ms** per test |

So yes: `waitFor` and every `findBy*` in this repo run on Testing Library's 1000 ms
`asyncUtilTimeout`, which is independent of vitest's own 5000 ms test timeout.

**A structural fact that decides what a `timeout` can even do.** In the installed
`wait-for.js`, the Promise executor registers `setTimeout(handleTimeout, timeout)`
at line 40, then `setInterval`/`MutationObserver` at lines 91-96, and finally calls
`checkCallback()` **synchronously** at line 97. So a `waitFor` whose predicate already
holds resolves on that first synchronous check and never consumes its budget. A
1000 ms timeout at a site that is already true is unreachable, and widening it to
3000 ms changes nothing at all.

## 2. The flake, reproduced and read

Harness: the file's own failure is rare (1 in 24), so I amplified it — three
concurrent whole-suite `--sequence.shuffle` runs plus six busy loops on eight cores.
**24 runs: 17 pass / 7 fail.** Four of the seven failures were in
`App.partialShard.test.tsx`. Vitest's stack frames name the line exactly:

| Log | Test | Stack frame | Message |
|---|---|---|---|
| `FAIL-8-3.log` | shows both as separate alerts… | `App.partialShard.test.tsx:410:18` | `Unable to find an element with the text: A Paper From The Week That Loaded.` |
| `FAIL-6-2.log` | shows both as separate alerts… | `App.partialShard.test.tsx:410:18` | same |
| `FAIL-6-2.log` | names the missing shard… | `App.partialShard.test.tsx:284:18` | same |
| `FAIL-7-2.log` | clears the notice when a later window loads completely | `App.partialShard.test.tsx:324:18` | same |

Line 410 is `await screen.findByText(W09.title)` — the first await after
`render(<App />)`. **Not** the `waitFor`. Column 18 is `screen`. Every one of the
nine aggregated failure reasons in the amplified batch was either that
`findByText` (7) or an alert count (2, both in `App.loadFailure.test.tsx`).

## 3. Why the wait was long at all — asked before widening

**The `waitFor`s were not long at all.** I instrumented the site in a `/tmp` copy,
logging the alert count on entry and the elapsed time:

```
[PROBE] pre=2 preText=["Collections could not be saved.…","Some papers could not be loaded.…"] waitForMs=4
[PROBE] pre=2 … waitForMs=4        (×3, isolated)
[PROBE] pre=2 … waitForMs=2
[PROBE] pre=2 … waitForMs=14       (whole suite, shuffled)
```

`pre=2` — the predicate was **already true on entry in 14 of 14 runs**, resolving in
2-14 ms. Consistent with `fireEvent`'s `act()` wrapper: the click that arms
`saveFailed` has its passive effect flushed before `fireEvent` returns, so the storage
notice is committed before `saveSomething`'s last `findByText` resolves. The comment's
claim that "the two live regions mount on independent ticks" is **false**.

**The data load is the opposite case.** `findByText(W09.title)` waits on a real
`fetch` of `index.json` plus one request per shard (`App.tsx:246-284`). No cheaper
precondition exists — the test needs the papers. A budget is the only lever, so it
should be sized from measurement. Latency samples for that await, same amplified
window:

```
126 143 168 178 213 217 261 365 450 607 777 839 1123 1390   (ms, n=14)
```

Worst observed **1390 ms** — the 1000 ms default genuinely loses. That is the whole
mechanism: wall-clock budget competing with CPU contention, not slow settle time.

## 4. The fix, and why it is not the alternative

Two different problems, two different fixes.

**(a) The real flake — budget the data waits.** `LOAD = { timeout: 3000 }` plus
`findText()` / `findAlert()` wrappers, applied to every await in the file that follows
a `render` (11 sites). **Why a budget and not a deterministic fix:** the wait is on
fetched data; there is no earlier event that implies it, so no tighter precondition
can replace it. **Why 3000:** 2.2x the worst measured load (1390 ms), and it costs
nothing when the wait is short because `waitFor` polls every 50 ms and resolves on the
first passing check — a ceiling, not a pause. The one `findByText` left on the default
budget is `saveSomething`'s last line, which is a view switch over papers already in
memory, and is commented as such.

**(b) The three `waitFor` polls — delete them, do not widen them.** Widening a poll
whose body is already true is the exact papering-over the sweep proposed. Instead:

| Site | Was | Now | Why it is not weaker |
|---|---|---|---|
| `:420` | `waitFor(count === 2)` | `await findText("Collections could not be saved.")` then `expect(alerts).toHaveLength(2)` | Names the precondition specifically; the count of 2 is still asserted, unchanged. When the notice is missing the test now says *which* notice instead of "got 1" after burning a second. |
| `:439` | `waitFor(count === 2)` after `fireEvent.change` | `expect(screen.getAllByRole("alert")).toHaveLength(2)` | `fireEvent` has flushed the re-render; neither notice is gated on the query (storage one is outside the view branch, `App.tsx:565`; shard one only on `failedShards.length > 0`). The file's **own sibling test** at `:309-316` asserts synchronously after the identical keystroke. |
| `:335` | `waitFor(alert gone)` | `expect(screen.queryByRole("alert")).toBeNull()` | `App.tsx:261-267` calls `setPapers` and `setFailedShards` from the same `.then`, so React batches them into one commit — the paper appearing and the notice unmounting are one render, never two frames. The poll was already true on entry. |

`waitFor` is now imported nowhere in this file; the import was dropped.

## 5. Audit — every file under `web/src/__tests__/`

Hard rule for this task limited me to one test file, so this section is findings,
not fixes. Measured, not read-off-the-code: I instrumented all 10 surviving
`waitFor` calls in `/tmp` and timed each.

| Site | Elapsed | Verdict |
|---|---|---|
| `App.loadFailure.test.tsx:359` | 2 ms | redundant poll (batched commit) |
| `App.loadFailure.test.tsx:612` | 2 ms | redundant poll |
| `App.loadFailure.test.tsx:644` | 1 ms | redundant poll (`fetch` stub increments synchronously inside the `act`) |
| `App.loadFailure.test.tsx:648` | 4 ms | **genuine** — panel returns via a promise `.catch` after the retry |
| `App.loadFailure.test.tsx:885` | 3 ms | redundant poll — the exact sibling of the `:420` I removed |
| `App.loadFailure.test.tsx:902` | 3 ms | redundant poll — sibling of `:439` |
| `App.loadFailure.test.tsx:919` | 11 ms | **genuine and confirmed failing** — no load await precedes it; "expected […] to have a length of 2 but got 1" |
| `App.storage.test.tsx:158` | 5 ms | redundant poll (sibling of `:420`) |
| `App.storage.test.tsx:178` | 2 ms | redundant poll |
| `App.storage.test.tsx:280` | 2 ms | redundant poll |

**The pattern is not gone from the suite.** Two things survive, and both are the
defect class rather than the redundant-poll class:

1. **10 `waitFor` calls still on the default budget**, two of them genuine.
2. **91 bare `await screen.findBy*` awaits** on the default budget
   (`App.categories` 18, `App.loadFailure` 36, `App.storage` 12, `App.retry` 11,
   `App.incompleteIndex` 6, `App.relevance` 5, `App.partialShard` 3 after this fix).
   Every one that follows a `render(<App />)` is a data wait on the 1000 ms default.
   The amplified batch confirmed the ones I happened to hit:
   `App.incompleteIndex.test.tsx:107` and `:140`, `App.loadFailure.test.tsx:841`,
   plus `App.loadFailure.test.tsx:919`.

**Recommended follow-up (one line, out of my scope):** `configure({ asyncUtilTimeout: 3000 })`
in `web/src/test-setup.ts` would cover all 91 awaits and the 10 `waitFor`s in every
file at once, with the same ceiling-not-pause property, and is strictly better than
the per-file constant I had to introduce. It also removes the need to touch five test
files. It is the change I would make next; I was not permitted to edit
`test-setup.ts`.

## 6. Run counts

Repo, `web/`:

| Check | Runs | Result |
|---|---|---|
| `npm test --sequence.shuffle` | **30** | **30 pass / 0 fail** |
| `npx vitest run src/__tests__/App.partialShard.test.tsx` | **20** | **20 pass / 0 fail** |
| `npm test` (plain) | 1 | **266 passed / 17 files** |
| `npm run typecheck` | 1 | exit 0 |
| `npm run build` | 1 | exit 0 — 41 modules, css 10.93 kB, js 172.50 kB (identical to sweep-5) |

Amplified (3 concurrent suites + 6 busy loops on 8 cores), same harness before and
after:

| Test file version | Runs | Whole-suite result | `App.partialShard.test.tsx` failures |
|---|---|---|---|
| HEAD | 24 | 17 pass / 7 fail | **4** (2x `:410`, 1x `:284`, 1x `:324`) |
| this fix | 24 | 19 pass / 5 fail | **0** |

The 5 remaining amplified failures are all in files I could not touch:
`App.incompleteIndex.test.tsx:107` / `:140` and `App.loadFailure.test.tsx:841` / `:920`.

Test-name integrity: the file's 9 test names are **byte-identical to `HEAD`** in the
same order, all `passed`, none skipped or deleted. Total is 266/17.

## 7. Sensitivity

Plain shuffling has weak detection power for this class, and I measured how weak:
**four arms × 25 single-file shuffle runs = 100 runs, 0 failures in every arm**,
including `HEAD`, under four busy loops. Single-file running has **zero** detection
power here. The load-bearing evidence is therefore the targeted window amplifier in
the style of `verify-IMP-192.md` §Amplifier 2 — applied only to `/tmp` copies, never
to the repo.

**Amplifier A — a 1500 ms shard-load window in the single test under study**, added
identically to all four arms (`installFetch` gains a `delayMs`, and only the target
test passes `1500`). 1500 ms sits above the 1000 ms default and below the 3000 ms fix,
so it separates the budgets exactly.

| Arm | Test file | Runs | Result |
|---|---|---|---|
| **R1** | `HEAD` (racy shape, default budgets) | 5 | **0 pass / 5 FAIL** — at `App.partialShard.test.tsx:415:18`, `Unable to find … A Paper From The Week That Loaded` |
| **R2** | fixed shape, `LOAD` narrowed back to `{ timeout: 1000 }` | 5 | **0 pass / 5 FAIL** |
| **R3** | `HEAD` + regression-sweep-5's `{ timeout: 3000 }` on that `waitFor`, verbatim | 5 | **0 pass / 5 FAIL** — same line, same message |
| **F** | this fix | 5 | **5 pass / 0 FAIL** |

The amplification is targeted, not a blanket breaker: **exactly 1 of 9 tests** in the
file fails in R1/R2/R3 (`Tests 1 failed | 8 passed`), and all 9 pass in F.

**R3 is the headline.** The sweep's proposed fix, applied verbatim and amplified,
fails 5 of 5 at the data-load line. It is inert.

**Amplifier B — the storage notice made unmountable** (`FullStorage.setItem` no longer
throws, so `saveState` succeeds and IMP-011's notice never mounts). Proves the new
precondition wait is not vacuously true:

| Arm | Result | Where it failed |
|---|---|---|
| R1 | FAIL | `:420:44` — `expected […] to have a length of 2 but got 1`, after 1076 ms |
| F | FAIL | `:452` — `Unable to find an element with the text: Collections could not be saved.`, after 3066 ms |

The fixed test still fails, and it names the exact missing notice instead of
reporting a count.

**Amplifier C — a third `role="alert"` injected into `document.body`.** Proves the
count assertion still rejects 3:

```
× shows both as separate alerts and announces neither twice 69ms
  → expected [ <p role="alert"></p>, …(2) ] to have a length of 2 but got 3
  ❯ src/__tests__/App.partialShard.test.tsx:462:20        Tests 1 failed | 8 passed
```

Sensitivity is established. A clean run means something: the same harness that fails
`HEAD` 5 of 5 and the narrowed fix 5 of 5 passes this fix 5 of 5, and two further
amplifiers confirm the assertions still bite.

**Caveat, stated plainly:** an interleaved four-arm *whole-suite* A/B under extreme
load (load average 48-92, four concurrent suites) **saturated** — R1 3/5, R2 5/3,
R3 1/7, F 1/7 — and is uninformative. That batch is not reported as evidence. The
targeted amplifiers above replaced it.

## 8. Files changed

- `web/src/__tests__/App.partialShard.test.tsx` — the only repository file modified.
  `git diff --stat`: 62 insertions, 26 deletions, no assertion lowered, no query
  swapped for a null-tolerant variant, nothing skipped or deleted.
- `.improve/reports/impl-IMP-192d.md` — this report.

No git write command was run. `git show HEAD:` and `git diff` were read-only.