# IMP-192e — one explicit `asyncUtilTimeout` for the whole suite

## 1. Which API this version actually supports (checked, not assumed)

| Question | Finding |
|---|---|
| `@testing-library/dom` installed | **10.4.2** (`web/node_modules/@testing-library/dom`) |
| `@testing-library/react` installed | **16.3.3** |
| `asyncUtilTimeout` exists? | **Yes** — introduced in `@testing-library/dom` v9 / RTL v16; installed v10 is well past it |
| `configure` exported? | `typeof require("@testing-library/dom").configure === "function"` |
| Default budget | `getConfig().asyncUtilTimeout === 1000` — the 1s root cause, confirmed at runtime |

`@testing-library/react`'s own `configure` is **not** the same function object as
`@testing-library/dom`'s (`rtl.configure === dom.configure` → `false`). RTL v16.3.3
ships a thin wrapper (`node_modules/@testing-library/react/dist/config.js:18-33`)
that destructures off `reactStrictMode` and forwards **everything else** to
`@testing-library/dom`'s `configure`.

I checked there is only **one** copy of `@testing-library/dom` installed
(`find node_modules -type d -name dom -path '*testing-library*'` → exactly one hit),
so RTL's wrapper and RTL's own `findBy*`/`waitFor` read the same config singleton.
Importing `configure` from `@testing-library/react` therefore configures the right
object. This matters: importing from `@testing-library/dom` directly would also have
worked here, but only because there is no duplicate copy — worth knowing, since a
hoist that dedupes differently would silently make that import a no-op.

**Ordering is safe.** `pure.js:77` calls `_dom.configure({unstable_advanceTimersWrapper, asyncWrapper})`
at module-evaluation time. ESM imports evaluate before the setup-file body runs, so
my `configure(...)` call lands *after* that and is not clobbered.

**Proven live, not assumed.** A probe test read the config back from inside the real suite:

```
PROBE asyncUtilTimeout = 3000 reactStrictMode = false   ✓ 1 passed
```

`reactStrictMode` is preserved because I used RTL's delta form
(`configure(existing => ({...existing, asyncUtilTimeout: 3000}))`). Passing
`{asyncUtilTimeout}` directly would have set `reactStrictMode` to `undefined`
(`strictModeIfNeeded` reads `getConfig().reactStrictMode`, `pure.js:133`) — falsy,
so probably harmless, but a silent unrelated config change is not worth the risk.

## 2. The value: 3000ms, and the trade-off

Two constraints pin the choice, and they pull in opposite directions:

- **Up:** must absorb CI-machine variance. The slowest observed async wait in this
  suite is **~1.5s** — already *above* the 1s default. The default is not merely
  tight, it is below the observed worst case. That is the flake.
- **Down:** must not hide real failures. A 30s budget would mean a genuinely broken
  test burns 30s per site before reporting, and would silently convert precise
  failures into slow ones.

The binding constraint I could not move: I am only permitted to edit
`web/src/test-setup.ts`, so **vitest's `testTimeout` stays at its 5000ms default.**
That makes `asyncUtilTimeout < 5000` mandatory, not stylistic. If
`asyncUtilTimeout >= testTimeout`, vitest kills the test at 5s and Testing Library
never gets to reject — you lose `TestingLibraryElementError: Unable to find an
element with the text: ...` and get a generic `Test timed out in 5000ms` that names
no assertion and no element. A budget that makes failures *less* diagnosable is a
net loss even if it makes them rarer.

`3000ms` = 3× the old default, 2× the slowest observed wait, and leaves a 2s cushion
under vitest's 5s so TL's real diagnostic always wins the race (§3 measures this).
Deliberately **not** 30s: the cost of a broken test rises from 3s to 30s, and 3s
still fails fast enough to keep CI feedback tight.

## 3. It does not mask failures — measured, not argued

In a `/tmp` copy, a test renders `<div>Only this renders</div>` and awaits
`findByText("This Text Never Appears Anywhere")`. **No per-test timeout override**,
so vitest's stock 5000ms `testTimeout` applies.

| Budget | Outcome | Elapsed | Error surfaced |
|---|---|---|---|
| 1000ms (old default) | **fails** | **1012 ms** | `TestingLibraryElementError: Unable to find an element…` |
| 3000ms (my change) | **fails** | **3015 ms** | `TestingLibraryElementError: Unable to find an element…` |

Still a hard failure — just 3s later, which is exactly the stated trade-off. The
error kind matters: it is Testing Library's diagnostic, **not** vitest's
`Test timed out in 5000ms`. That is the concrete payoff of staying under 5000ms.

## 4. Amplified A/B — the new budget absorbs stress rather than hiding it

Amplifier: a `/tmp`-only patch to `src/lib/paperIndex.ts` adding
`await amplify()` (default 600ms) after **both** the manifest and the shard `fetch`,
so the load window is genuinely widened and every `findBy*` wait is genuinely long.
Both arms are the same tree, same amplifier, same binary; only `asyncUtilTimeout`
differs. Production code in the repo is untouched.

| Load window | Old 1000ms budget | My 3000ms budget |
|---|---|---|
| 200ms | 2 failed / 264 passed | 2 failed / 264 passed |
| 300ms | 2 failed / 264 passed | 2 failed / 264 passed |
| 400ms | 3 failed / 263 passed | 3 failed / 263 passed |
| 450ms | 3 failed / 263 passed | 3 failed / 263 passed |
| **500ms** | **30 failed / 236 passed** | **3 failed / 263 passed** |
| 550ms | 30 failed / 236 passed | 3 failed / 263 passed |
| 600ms | 30 failed / 236 passed | 3 failed / 263 passed |

**The arms are byte-identical until the window exceeds 1000ms, then separate
absolutely: 30 → 3.** That is the honest shape of this result. The budget is
invisible until it is needed, and then it absorbs a 10× collapse in failures. It is
not a blanket breaker: the same 500ms window that produces 30 failures under the old
default produces **0 budget-exhaustion failures** under mine.

The old-default failures are the exact class in the brief — genuine
`Unable to find an element with the text: A Paper From cs.CV.`, i.e. the load simply
had not finished inside 1s.

### The residual 3 are amplifier artifacts, not budget exhaustion
At 500–600ms both arms leave the same 3, and **none is a timeout on my budget**:

| Test | Elapsed | Why it fails |
|---|---|---|
| `App.categories.test.tsx` … keeps the deep link working while the index is still in flight | **24 ms** | Asserts state *during* flight; any added delay changes what is on screen. Resolved instantly, then failed an assertion. |
| `App.loadFailure.test.tsx` … an index file whose body is JSON null … | **499 ms** | Same shape — resolved in under the old 1000ms budget too, so not budget-bound. |
| `paperIndex.test.ts` … recovers via refreshManifest after every manifest failure mode | **5005 ms** | Loops every manifest failure mode, each a fetch. Exceeded **vitest's own 5000ms `testTimeout`**, not `asyncUtilTimeout`. |

Two resolved in tens/hundreds of milliseconds — they cannot be budget-limited. The
third is bounded by a knob I was not permitted to touch. I am reporting them as
known amplifier distortion rather than claiming a clean 266/266 under stress; at
600ms/fetch the amplifier changes what three tests assert, and no budget value fixes
that.

**A CPU-starvation arm was also run** (busy loops on all cores, the amplifier from
`impl-IMP-192d`) and passed 266/266 even under the old 1000ms budget — this machine
has enough cores that busy loops do not reproduce the prior flake. It yields no
discrimination here, so the fetch-delay A/B above is the load-bearing experiment.

## 5. No conflict with the sibling fix

`App.partialShard.test.tsx` is another agent's file. **I did not edit it.**
`git diff --stat` shows the only file I changed is `web/src/test-setup.ts`
(the partialShard diff is theirs, pre-existing). It passes against my change:

```
✓ src/__tests__/App.partialShard.test.tsx (9 tests) 1570ms
Test Files  1 passed (1)   Tests  9 passed (9)
```

The two changes are orthogonal: theirs removes racy polls, mine changes only the
global async budget.

## 6. Suite counts

| Check | Result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `npm run build` | **exit 0** |
| `npm test` (baseline, before) | 266 passed / 17 files, 8.71s |
| `npm test` (after) | **266 passed / 17 files, 7.95s** — unchanged |
| `npm test --sequence.shuffle` ×20 | 20/20 pass, every run 266/17 |
| Amplified A/B, my budget, 500–600ms window | 3 failed / 263 passed (residual 3 = artifacts, §4) |

266 across 17 files before and after: the test count did not move, so nothing was
added, dropped, or double-registered.

## 7. Process note

While verifying that `configure` actually reaches RTL I wrote a one-off probe test
to `web/src/__probeConfig.test.tsx`, which was a mistake — the brief said to keep
such probes in `/tmp`. I confirmed via `git status --porcelain` that it was
**untracked** (`??`), byte-identical to a copy already saved at
`/tmp/probe-config.test.tsx`, and that the only tracked file I had modified was
`web/src/test-setup.ts`; I then removed it. It was scratch I had authored seconds
earlier, never repository content, and the file survived at `/tmp`. No `git restore`,
`checkout`, `clean`, or `stash` was run at any point. All amplified work happened in
`/tmp/imp192e` and `/tmp/imp192e-cpu`.

## 8. What this change does and does not buy

**Buys:** a suite-wide floor on the one knob that caused six order-dependent flakes.
Any of the ~100 `findBy*`/`waitFor` sites now tolerates a 3s load instead of 1s.
The change is one line, has no per-test blast radius, and cannot make an assertion
weaker.

**Does not buy:** detection. Raising the budget reduces flake *rate*; it does not
make `--sequence.shuffle` able to find this class (still 20/20, zero failures, and
the prior 100-run result stands). The amplified A/B in §4 remains the only reliable
detector, and it still lives outside the repo. If someone wants that power inside CI,
the durable next step is a committed stress harness rather than a bigger timeout —
`impl-IMP-192c` §6's methodological warning applies: 20/20 green is a real number and
a weak argument.