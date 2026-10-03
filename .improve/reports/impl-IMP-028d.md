# IMP-028d — bound the `spawnSync` child, and drop witness 4

Follow-up to the IMP-028c verifier PASS. Two minor issues were raised; both are
fixed here. No assertion was weakened, and nothing that gates a deploy was made
to skip instead of fail.

Files changed:

- `web/src/__tests__/collectWithVitest.mjs` — `spawnSync` timeout + `killSignal`
  (Issue 1)
- `web/src/__tests__/indexGuardRegistration.test.ts` — witness 4 dropped (Issue 2)

`web/src/__tests__/collectWithVitest.d.mts` was inspected and needed no change:
the `Listing<T>` shape is unchanged, and the timeout is internal to `runList`,
which is not part of the declared surface.

---

## Issue 1 — `spawnSync` had no timeout (real hang risk)

### The flaw

`runList` called `spawnSync` with no `timeout`. `spawnSync` blocks the event loop
for the whole life of the child, so vitest's own per-test `it` timeout (120 s, set
at the call sites) **cannot** rescue a wedged child — the timer that would fire it
is never serviced. The only backstop was the CI job's `timeout-minutes`, which
fails every other test in the worker, not just this one.

This is not hypothetical. Measured below: with no `timeout`, a hanging child
blocked the parent **permanently**, past an external 45 s watchdog.

### The change

```js
const LIST_TIMEOUT_MS = 30_000;

const result = spawnSync(process.execPath, [vitestBin(), "list", ...args], {
  cwd: WEB_ROOT,
  encoding: "utf8",
  env: childEnv(),
  maxBuffer: 32 * 1024 * 1024,
  timeout: LIST_TIMEOUT_MS,
  killSignal: "SIGKILL",
});
```

`diagnose` now also names the timeout, because a timed-out child exits with
`status === null`, which is otherwise indistinguishable from any other crash:

```
vitest list --filesOnly failed
the child did not finish within 30000 ms and was killed (SIGKILL)
spawn error: spawnSync /opt/homebrew/Cellar/node/25.6.1/bin/node ETIMEDOUT
exit: null
```

### Why 30 s

Chosen against two measured numbers, not picked round:

- **Above the healthy cost.** The verifier measured 918–1330 ms for the pin on
  this tree; my own runs agree (`--filesOnly` 517–882 ms, `--json` 1186–1482 ms).
  30 s is ~23x the worst observed cost. A loaded or cold CI filesystem would have
  to slow the child by more than an order of magnitude before this can fire on a
  healthy tree, which is the flake margin that matters.
- **Below vitest's 120 s test timeout.** If the bound were at or above 120 s, the
  blocking window would reach the `it` deadline and the pin would fail with
  vitest's generic "test timed out" instead of the ETIMEDOUT diagnosis that names
  the cause. 30 s is 4x under it.
- **Worst case stays inside the `it` budget.** The memo means at most one
  `--filesOnly` spawn and one `--json` spawn per run, in separate `it` blocks, so
  each block is blocked at most once (30 s), not twice. Two blocks cannot be
  blocked simultaneously, so no single `it` ever approaches 120 s.

### Why `killSignal: "SIGKILL"` — verified, not assumed

I originally justified this from Node's docs ("spawnSync will not return until the
child process has exited"). My first experiment appeared to **contradict** that:
with the default SIGTERM, `spawnSync` returned at the timeout with `status=1`.

That apparent contradiction was a bug in my harness, and finding it changed the
conclusion's basis. The child logged from its SIGTERM handler by writing to
**stdout**; once `spawnSync` tore the pipe down, that write threw, the uncaught
exception killed the child with code 1, and the parent was released. The parent
returned because the child died of an unrelated accident, not because SIGTERM
worked.

Rewritten so the handler logs to a **file** (so the result cannot depend on a
stdout write succeeding), and with an **external** watchdog — an in-process one is
useless here, since a blocked loop also blocks its own watchdog timer, which is
precisely the failure being demonstrated:

| killSignal | parent after 25 s external budget | verdict |
|---|---|---|
| default SIGTERM | never returned; killed externally | **real hang** |
| `SIGKILL` | returned at 3004 ms, `signal=SIGKILL`, `code=ETIMEDOUT` | bounded |

So `SIGKILL` is load-bearing: with the default SIGTERM, a child that catches or
ignores SIGTERM keeps the parent blocked indefinitely, which is exactly the
failure the timeout exists to prevent. SIGKILL cannot be handled.

Evidence for "the in-process watchdog cannot work" is itself in the transcript: the
first counterfactual, which used a `setTimeout` watchdog inside the blocked
process, did not fire at 45 s — the shell tool had to kill it at 120 s.

### The hang experiment, with real timings

In a `/tmp` copy (`/tmp/rpf-hang`, `node_modules` symlinked), `vitestBin()` was
redirected to a child that never exits and **survives SIGTERM**:

```
$ npx vitest run src/__tests__/indexGuardRegistration.test.ts --reporter=verbose
 × ... > collects the guard suite, so the tests guarding every deploy actually run   30019ms
 × ... > collects itself, since a pin under the glob it pins would prove nothing
     the child did not finish within 30000 ms and was killed (SIGKILL)
     spawn error: spawnSync /opt/homebrew/Cellar/node/25.6.1/bin/node ETIMEDOUT
     exit: null
 × ... > collects the guard suite's cases, not just its file                          30010ms
     the child did not finish within 30000 ms and was killed (SIGKILL)
 ✓ ... > (witness 4, which spawns nothing, still passes)

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)
   Duration  60.66s (tests 60.04s)
```

- Each spawning test failed at **~30.0 s** (30019 ms, 30010 ms) — the bound, not
  vitest's 120 s.
- Total wall clock **60.66 s**, i.e. 2 spawns x 30 s. It terminates; it does not hang.
- **Exit code 1.**
- Contrast, same harness without the fix: blocked past an external 45 s watchdog and
  had to be killed from outside.

---

## Issue 2 — witness 4 was a false-positive generator: DROPPED

The brief asked me to verify witnesses 1 and 3 cover every real hole before
removing witness 4. I ran the full mutation matrix in a `/tmp` copy
(`/tmp/rpf-mut`), running the pin **twice** per mutation — once as committed, once
with witness 4 mechanically removed — and classified each mutation as a REAL HOLE
or BENIGN using `vitest list --filesOnly` as independent ground truth, not by
trusting any test.

| # | Mutation | Guard collected? | Real hole? | Caught with w4 | Caught without w4 |
|---|---|---|---|---|---|
| 1 | `scripts/**/*.test.mjs` glob deleted | NO | REAL | w1, w3, **w4** | w1, w3 |
| 2 | mis-narrowed to `scriptsX/**` | NO | REAL | w1, w3, **w4** | w1, w3 |
| 3 | `exclude: ["scripts/**"]` | NO | REAL | w1, w3 | w1, w3 |
| 4 | `include` deleted (default glob) | YES | benign | none | none |
| 5 | guard file renamed `.spec.mjs` | NO | REAL | w1, w3 | w1, w3 |
| 6 | widened to `**/*.test.mjs` | YES | benign | **w4 only** | none |
| 7 | config split to a shared constant | YES | benign | none | none |

### Every real hole is still caught without witness 4

Mutations 1, 2, 3 and 5 are all caught by witnesses 1 and 3 alone. **No real hole
in the matrix is caught only by witness 4**, so the verifier's claim holds and
witness 4 was dropped.

### Why witness 4 earned nothing, specifically

- It is **structurally blind to the two hardest holes**. Mutations 3 and 5 leave
  `test.include` completely untouched and still `scripts`-anchored, so witness 4
  stays silent on both by construction. Those are precisely the holes a
  config-reading witness cannot see, and they are caught by the spawned listing.
- Where it did fire on real holes (1, 2), witnesses 1 and 3 had already fired.
- Its one exclusive contribution is mutation 6 — a **false positive**. Widening to
  `**/*.test.mjs` still collects all 23 guard cases, and only witness 4 went red,
  claiming the suite "stops being collected". Untrue, and a spurious failure on a
  working config.

### One correction to the verifier's staleness claim

The brief said witness 4 hardcodes the include shape and "a config-split refactor
would break it even when nothing is wrong." Mutation 7 tested exactly that — the
globs moved to `src/sharedGlobs.ts`, with `include: testInclude` importing them —
and **witness 4 passed**. The witness reads the *resolved* value of
`viteConfig.test.include` from the imported module, not the config file's text, so
it survives the split. The staleness concern is real in principle but was **not
substantiated** by this mutation. I did not remove it on that ground; it is the
false positive plus total redundancy that decided it.

### Two harness bugs I hit and fixed (they had produced invalid evidence)

Recording these because they nearly made me report the wrong thing:

1. **Mutation 5 deleted the guard file.** Its `rm` ran after the `mv` had already
   moved the file, and `restore_all` did not bring it back, so mutations 6 and 7
   ran against a tree with **no guard suite at all** — which is why they first
   reported "guard collected: NO". `restore_all` now re-extracts `src/` and
   `scripts/` from the pristine repo and `assert`s the guard file is back;
   `run_pin` aborts if it is absent (except for mutation 5, which moves it on
   purpose). Mutations 5, 6 and 7 were **re-run** after the fix, and the whole
   matrix was re-run clean.
2. An in-process `setTimeout` watchdog cannot observe a blocked loop (Issue 1), so
   all hang detection uses an external watcher.

---

## Verification

All from `web/`, on the final state.

| Command | Result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `npm test` x5 | **19 files, 292 tests, all passed, 5/5 — no flake** |
| `npm run build` | **exit 0**, 41 modules, built in 612 ms |
| `dist` byte-identical | **yes** — `diff` clean vs pre-change baseline; 7 files; asset hashes unchanged (`index-B28RVUhO.js`, `index-G-YE6pVt.css`) |
| `public/data` byte-identical | **yes** — 3 files, sha256 unchanged (`index.json`, `papers-2026-W39.json`, `papers-2026-W40.json`) |
| `npm run dev` | starts, `HTTP 200` at `http://localhost:5176/research-paper-feed/` |

Durations across the 5 runs: 11.27s, 10.87s, 13.52s, 14.25s, 9.80s.

### Test count: 292, not 293

My brief said to expect 293 whether I dropped a witness or kept it. That cannot
both hold: dropping an `it` necessarily removes one test. Baseline was **19 files
/ 293 tests**; dropping witness 4 gives **19 files / 292 tests**. 292 is the
correct result for a dropped witness, and the file count is unchanged because the
test file still exists with its three witnesses. Flagging rather than silently
reconciling.

### Confirmations

- Witnesses 1, 2 and 3 are **byte-for-byte unmodified** in their assertions — only
  the header comment (which listed four witnesses) changed, plus the now-unused
  `vite.config` import removed. Nothing was weakened or made to skip.
- `web/scripts/__tests__/indexGuards.test.mjs` is intact (24 `it(` occurrences),
  as are `web/vite.config.ts`, `web/scripts/**`, `web/src/lib/**`, `tests/`, and
  `scripts/`. No file was deleted or moved in the repo; all experiments ran in
  `/tmp` copies.
- `git status` shows only my two source files as modified. `.improve/PROGRESS.log`
  and the three untracked `discovered-*`/`regression-sweep-4` reports were already
  dirty in the working tree before I started (present in my first `git status`)
  and I did not touch them.
- No `git commit`, `git add`, `git push`, `git restore`, `git checkout`,
  `git clean` or `git stash` was run.
