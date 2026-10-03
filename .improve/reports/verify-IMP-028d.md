# verify-IMP-028d — independent verification

Verifier: independent sub-agent. Did not write the change. All experiments in
`/tmp/v028d` copies; the repo was never modified, no `rm`/`mv` of any repo file,
no git write command, no push.

**VERDICT: PASS** — 8/8 criteria met.

---

## 0. What actually changed

`git diff --stat` (tracked):

```
 .improve/PROGRESS.log                            |  2 +-
 web/src/__tests__/collectWithVitest.mjs          | 41 +++++++++++++++++
 web/src/__tests__/indexGuardRegistration.test.ts | 56 +++++++---------
```

Two source files, both test-only. `spawnSync` gains `timeout: 30_000` +
`killSignal: "SIGKILL"` and a `spawnErrorCode` passthrough; witness 4 and the now
unused `vite.config` import are removed. Nothing else.

---

## 1. ISSUE 1 — the hang bound

### 1a. Independent hang reproduction (real pin, `/tmp` copy)

I copied the current tree to `/tmp/v028d/hangpin`, symlinked `node_modules`, and
redirected only `vitestBin()` at `/tmp/v028d/hang/child-ignore-term.mjs` — a child
that installs a `SIGTERM` handler that logs and **ignores**, then loops forever.
Nothing else about the pin was changed.

```
FAIL  ... > collects itself, since a pin under the glob it pins would prove nothing
AssertionError: vitest list --filesOnly should succeed: vitest list --filesOnly failed
the child did not finish within 30000 ms and was killed (SIGKILL)
spawn error: spawnSync /opt/homebrew/Cellar/node/25.6.1/bin/node ETIMEDOUT
exit: null
stdout:
stderr:

 Test Files  1 failed (1)
      Tests  3 failed (3)
   Duration  60.69s (transform 37ms, setup 130ms, collect 19ms, tests 60.02s, ...)
```

**It terminates; it does not hang.** Total 60.69 s, of which 60.02 s is test time.
Exit code 1. Matches the implementer's 60.66 s to within 30 ms.

### 1b. SIGKILL is genuinely required — CONFIRMED

I rebuilt the harness independently (`/tmp/v028d/hang/parent.mjs`) rather than
reusing the implementer's, and used an **external** watchdog (`perl -e 'alarm 25'`)
because an in-process timer cannot observe a blocked loop — which is the very
failure being demonstrated.

| # | child | killSignal | timeout | result |
|---|---|---|---|---|
| A | ignores SIGTERM | `SIGKILL` | 3000 ms | **returned 3015 ms**, `status=null`, `signal=SIGKILL`, `errorCode=ETIMEDOUT` |
| B | ignores SIGTERM | default (SIGTERM) | 3000 ms | **never returned**; external watchdog killed the parent (exit 142 = SIGALRM) |
| C | SIGTERM handler writes to **stdout** | default (SIGTERM) | 3000 ms | returned 3029 ms, `status=1` |

**A vs B is the load-bearing pair, and it is decisive.** With the default SIGTERM
the parent is blocked forever, even though the child logged `got SIGTERM, ignoring`
— exactly the indefinite hang the timeout exists to prevent. SIGKILL is not
decorative; it is the only thing that makes the bound a bound.

**Case C independently confirms the implementer's self-correction is accurate.** A
child whose SIGTERM handler writes to stdout comes back with `status=1` under plain
SIGTERM — the write throws once `spawnSync` tears the pipe down, the uncaught
exception kills the child, and the parent is released *by an unrelated accident*.
That is exactly the flaw the implementer describes in their first experiment, and
they were right to discard it. I had to add case C myself to see it; the original
observation was not invented.

**Extra check the implementer did not make:** a residual hang would be possible if
a *grandchild* survived the SIGKILL while holding the inherited stdout pipe, since
`spawnSync` reads until EOF. I tested that directly (case D: direct child spawns a
grandchild inheriting stdout, then hangs; direct child SIGKILLed at 3000 ms) —
**spawnSync still returned at 3009 ms.** So there is no pipe-based residual hang
either. The fix is complete on this axis.

### 1c. 2 x 30 s against the 120 s `it` timeout — and the value

The implementer's claim that each `it` blocks **at most once** is correct, and the
memo is the reason: `guardSuiteListing()` and `guardSuiteCases()` are separate
`once()` keys, so:

- `it` #1 calls `guardSuiteListing()` → 30 s block, memo stores the result.
- `it` #2 calls `guardSuiteListing()` → memo hit, **0 s** block, fails instantly on
  the memoised reason (which is why it shows no elapsed time in the output).
- `it` #3 calls `guardSuiteCases()` → its own key, 30 s block.

Measured: `tests 60.02s`, i.e. 2 x 30 s, **not** 3 x 30 s. So no single `it` ever
approaches its 120 s budget; the worst per-test block is 30 s, a 4x margin, and
the worst *file* total is 60 s. Both comfortably bounded, and the failure surfaces
with the specific ETIMEDOUT diagnosis rather than vitest's generic
"test timed out". The 30 s / 120 s reasoning in the code comment is accurate.

**On whether 30 s is too high:** 60 s of wall clock in a *failing* run is
acceptable. It is failure-path-only, it terminates, it is inside every budget, and
the alternative (a tighter value) buys a faster red build at the cost of flake
margin for no real benefit. A 15 s value would still be ~14x the worst observed
spawn and would halve the failure latency, which is a defensible alternative — but
30 s is not wrong and I do not consider a change warranted.

### 1d. The ETIMEDOUT diagnostic is distinguishable from a crash — CONFIRMED

Same harness, child replaced with one that crashes immediately (exit 7, output on
both streams):

```
vitest list --filesOnly failed
spawn error: none
exit: 7
stdout:
some stdout before the crash
stderr:
boom: config blew up
```

No `did not finish within ...` line, `exit: 7` rather than `exit: null`. Against
the timeout case (`did not finish within 30000 ms and was killed (SIGKILL)` /
`spawn error: ... ETIMEDOUT` / `exit: null`) the two are unambiguous. A reader can
tell *what* happened, which is the whole point.

### 1e. The timeout does not fire spuriously — margin measured, 30 s is safe

My own measurements, `web/`:

| measurement | samples | range |
|---|---|---|
| `vitest list --filesOnly` | 5 | 0.49 – 0.81 s |
| `vitest list scripts/__tests__ --json` | 5 | 0.80 – 1.03 s |
| whole pin file, wall clock | 6 | 1.38 – 2.06 s |
| whole pin file, vitest test time | 6 | 1.00 – 1.43 s |

Worst **single** spawn 1.03 s → **30 s is ~29x** the worst observed cost. On the
whole-test budget the margin is ~21x. For this to fire spuriously a loaded or cold
CI filesystem would have to slow a `vitest list` invocation by more than an order of
magnitude — that is not a realistic flake mode, and a cold `node_modules` is paid
once by the parent too. The child either answers in about a second or it is wedged.

**30 s is safe. No spurious-timeout risk.**

---

## 2. ISSUE 2 — witness 4 dropped

### 2a. Mutation matrix, my own copies

Harness: `/tmp/v028d/mutate.mjs` resets each workdir with `rmSync` + `cpSync` from
a pristine snapshot of the *current* tree (so nothing can leak between mutations and
nothing is ever `rm`'d in place), then applies the mutation, then **hard-asserts the
guard suite is present**, exiting 9 otherwise. Ground truth (`vitest list
--filesOnly` / `list --json`) is measured **from the same mutated workdir**, so it
can never disagree with what the runner actually does. It never aborted. The `w4`
column is the same matrix against the HEAD version of the pin, with witness 4
restored verbatim.

| # | mutation | files collected | guard cases | guard collected? | REAL? | pin **w/o** w4 | pin **with** w4 |
|---|---|---|---|---|---|---|---|
| 0 | control (unmutated) | 19 | 23 | yes | — | **PASS** | PASS |
| 1 | `scripts/**/*.test.mjs` glob deleted | 18 | 0 | **no** | REAL | **FAIL** | FAIL |
| 2 | mis-narrowed to `scriptsX/**/*.test.mjs` | 18 | 0 | **no** | REAL | **FAIL** | FAIL |
| 3 | `exclude: ["scripts/**"]` added | 18 | 0 | **no** | REAL | **FAIL** | FAIL |
| 4 | guard file renamed `.spec.mjs` | 18 | 0 | **no** | REAL | **FAIL** | FAIL |
| 5 | `include` deleted entirely (default glob) | 19 | 23 | yes | benign | **PASS** | PASS |
| 6 | widened to `**/*.test.mjs` | 19 | 23 | yes | benign | **PASS** | **FAIL (w4 only)** |
| 7 | unrelated `tools/**/*.test.mjs` dir added | 20 | 23 | yes | benign | **PASS** | PASS |
| 8 | config split to shared constant | 19 | 23 | yes | benign | **PASS** | PASS |

**Every REAL hole (1, 2, 3, 4) is caught by witnesses 1+3 with witness 4 gone.**
No real hole depends on witness 4.

**Every BENIGN case (5, 6, 7, 8) now passes with witness 4 gone.** Row 0 confirms
the harness itself is not spuriously red, and row 7's file count of 20 shows the
unrelated directory really was added and collected.

### 2b. The false positive is real, verbatim

Mutation 6, with witness 4 restored — the *only* failure out of four:

```
× ... > keeps an include pattern anchored at scripts/ in vite.config.ts
AssertionError: vite.config.ts's test.include no longer reaches scripts/, so
scripts/__tests__/indexGuards.test.mjs stops being collected: expected false to be true
```

while ground truth is **23 guard cases collected, 19 files**. The message is
demonstrably false: the suite is still collected. A spurious red on a working
configuration, in a pin whose job is to be trustworthy. The drop was justified.

### 2c. Is the final mutation evidence trustworthy? YES

The implementer disclosed that an early `rm` destroyed the guard file, so mutations
6–7 first ran against a tree with no guard suite, and that they fixed the restore and
re-ran. That is exactly the right disclosure, and I can confirm the final numbers
are sound rather than taking their word for it: in my independent matrix every late
mutation (6, 7, 8) independently reports **23 guard cases collected** from
`vitest list --json` measured in the mutated tree itself. A tree with no guard suite
reports 0, not 23. The guard suite was demonstrably present throughout.

### 2d. The staleness claim — the implementer's correction is ACCURATE

The brief's claim was that witness 4 hardcodes the include *shape* and "a
config-split refactor would break it even when nothing is wrong."

**It did not.** The removed witness did `import viteConfig from "../../vite.config"`
and read `viteConfig.test?.include` — the **resolved value of the evaluated
module**, not the config file's text. I built the exact refactor (globs moved to
`src/sharedGlobs.ts` as `export const testInclude`, config doing
`import { testInclude }` + `include: testInclude`) and ran the pin with witness 4
restored: **`Tests 4 passed (4)`**.

So the brief's staleness claim was **wrong**, and the implementer's correction is
**right**. The drop therefore rests on the false positive plus total redundancy —
which is sufficient on its own — and the stale-sentence remaining in the surviving
header comment ("its staleness: it asserted a shape of the `include` expression
rather than a fact about collection") is the one clause of that paragraph that its
own evidence does not support. Harmless — it is rationale prose, not an assertion —
but it is the implementer's reasoning being carried past the point their data
reaches. **No change required to the code**; a verifier reading the comment should
know not to re-derive the drop from that sentence.

---

## 3. No production impact — CONFIRMED byte-identical

Built the **pre-change** tree and the **current** tree in two separate `/tmp` copies
(`git show HEAD:<file>` used read-only to reconstitute the two test files in the
base copy; `node_modules` symlinked; `public/data` present in both).

```
base (HEAD files) : 41 modules transformed, built in 519ms
cur  (as-is)      : 41 modules transformed, built in 430ms

$ diff -r base/dist cur/dist   ->  DIST BYTE-IDENTICAL
```

7 files each, all 8 sha256 digests matching, including the asset hashes
`index-B28RVUhO.js` (4c977f90…) and `index-G-YE6pVt.css` (6220a3f3…). Module count
identical. This is a test-only change with no effect on the shipped bundle.

---

## 4. No regressions — CONFIRMED

Paths checked for **any** modification, all zero: `web/vite.config.ts`,
`web/scripts`, `web/src/lib`, `web/src/App.tsx`, `scripts`, `tests` (Python),
`readme.md`, `.github`, `web/package.json`, `web/package-lock.json`,
`web/tsconfig.json`, `web/index.html`.

- `web/scripts/__tests__/indexGuards.test.mjs` is **byte-identical to HEAD**
  (`git diff --quiet` clean). 24 `it(` occurrences, 3 `describe(`.
- **Nothing deleted anywhere**: `git diff --diff-filter=D --name-only HEAD` is empty.
- **Nothing weakened or skipped**: no `.skip`/`.todo`/`.only`/`.concurrent`/`.fails`/
  `xit`/`xdescribe` in either changed file. `collectWithVitest.d.mts` needs no
  change — the declared surface is `guardSuiteListing`/`guardSuiteCases`, and
  `runList`/`diagnose` are not exported.
- Guard suite still collected: 19 files, 23 guard cases, 2 deploy-critical cases
  present.
- Assertion accounting: `it` 4 → 3 and `expect(` 11 → 10 — exactly the one dropped
  witness, nothing else. Witnesses 1, 2 and 3 are unmodified.

---

## 5. Required runs (from `web/`)

| command | result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `npm test` x5 | **19 files / 292 tests, all passed, 5/5, no flake** |
| `npm run build` | exit 0, 41 modules (build comparison in §3) |
| `vitest list --json` (independent) | **292 cases** |

Durations — vitest `Duration`: 11.10s, 14.14s, 11.36s, 9.68s, 12.01s
(wall clock `real`: 11.90, 15.19, 11.89, 10.23, 12.66 s).

**The implementer's 292 is right, and the brief's 293 was wrong.** The diff removes
one `it`, and 292 is independently confirmed both by the runner and by
`vitest list --json`. The file count stays 19 because the file still exists with
three witnesses. The implementer flagged this rather than quietly reconciling it,
which is the correct handling.

---

## 6. Data integrity and working tree

`web/public/data` sha256:

```
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2d999c3888246a86d7369e  papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  papers-2026-W40.json
```

Identical to the three `dist/data` copies in both builds. `git status --porcelain`
shows exactly the two intended test files plus `.improve/PROGRESS.log` and four
untracked `.improve/reports/*` — all `.improve` bookkeeping, no source.

---

## Non-blocking observation

The implementer states it "did not touch" `.improve/PROGRESS.log`. It is in fact
modified in the working tree — one line, the IMP-028C commit reference corrected
from `df53bf5` to `49af325`. Judging by content this belongs to the earlier IMP-028
commit work (it points at an already-committed hash), not to IMP-028d, and it is
documentation, not code. The claim is imprecise rather than false in substance; I
flag it only because a verifier should not take "I did not touch it" as verified.
No action.

---

## Verdict

**PASS, 8/8 criteria met.** The hang is genuinely bounded, `SIGKILL` is genuinely
load-bearing (I demonstrated the indefinite SIGTERM hang myself), the diagnostic
separates a timeout from a crash, 30 s carries a ~29x margin against the worst
observed spawn, dropping witness 4 loses no real coverage and removes one genuine
false positive, and the change is provably test-only.

Both of the implementer's corrections to the brief check out: **292 is correct**
(293 was impossible for a dropped witness), and the **staleness claim was wrong** —
witness 4 read the resolved imported config and passed a config-split refactor. The
only thing I would change is one sentence of rationale prose in a comment that its
own evidence does not support; it changes no behaviour.
