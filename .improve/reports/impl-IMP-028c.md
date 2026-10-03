# IMP-028c — pin the index-guard suite's registration

## The hole

`web/scripts/__tests__/indexGuards.test.mjs` holds 23 tests whose only job is
to keep `web/scripts/require-index.mjs` honest, and that guard is what makes
`npm run build` fail closed instead of shipping a `dist` with no `dist/data` (see
the comment at `web/scripts/require-index.mjs:1-30`).

Those 23 tests run *only* because `web/vite.config.ts`'s `test.include` reaches
outside `src/` to collect them. The registration itself was unpinned: a verifier
deleted the `scripts/**/*.test.mjs` glob and `npm test` still exited 0, reporting
17 files / 266 tests instead of 18 / 289. Twenty-three tests guarding every
production deploy went quiet with nothing red.

## What was pinned

Three new files, all inside `web/src/__tests__/` — deliberately, because that is
the directory the **original** two globs already collected. A pin placed under
`scripts/__tests__/` would be dropped by exactly the narrowing it exists to
catch.

| File | Collected by | Role |
| --- | --- | --- |
| `web/src/__tests__/indexGuardRegistration.test.ts` | `src/**/*.test.ts` (pre-existing glob) | the pin: 4 assertions |
| `web/src/__tests__/collectWithVitest.mjs` | *not collected* | probe: spawns the real runner |
| `web/src/__tests__/collectWithVitest.d.mts` | *not collected* | types for the probe |

`vite.config.ts` needed **no** change. `web/scripts/**`, `web/src/lib/**`,
`App.tsx`, `components/**`, the Python suite and the workflows were not touched.
`git diff --stat` on tracked files is empty; `git status` shows only the three new
untracked files.

### Why `.mjs` for the probe

`tsconfig.json` pins `"types": ["vite/client"]` and this tree has **no
`@types/node`** (`node_modules/@types/` holds only `aria-query`, `babel__*`,
`estree`, `prop-types`, `react`, `react-dom`). A `.ts` file under `src/` therefore
cannot import `node:child_process` without failing `npm run typecheck` — which I
confirmed before restructuring:

```
src/__tests__/indexGuardRegistration.test.ts(3,27): error TS2307: Cannot find module 'node:child_process' or its corresponding type declarations.
src/__tests__/indexGuardRegistration.test.ts(4,42): error TS2307: Cannot find module 'node:fs' ...
src/__tests__/indexGuardRegistration.test.ts(87,22): error TS2503: Cannot find namespace 'NodeJS'.
src/__tests__/indexGuardRegistration.test.ts(89,45): error TS2591: Cannot find name 'process'.
```

So the Node work lives in an untyped `.mjs` probe with a `.d.mts` declaration, and
the pin itself stays a clean `.ts` under the original glob. Adding `@types/node`
would have meant editing `package.json` *and* `package-lock.json` (out of scope)
and widening the type surface of every file in `src/`.

## Why these assertions, and not others

**The strongest form is not "assert the config value" — it is asking the runner.**
So the primary witness spawns `vitest list` against the real tree and asserts what
it actually collects. Behaviour, not configuration: it survives `include` being
rewritten in any equivalent form (including being deleted outright, since
vitest's default pattern already collects `scripts/**/*.test.mjs`), and no string
that merely appears in a comment can satisfy it.

**Import the config, do not parse it.** This was the decisive finding, not a
stylistic preference. `vite.config.ts` documents `scripts/**/*.test.mjs` in the
comment block at lines 9-15, *four lines above* the `include` array it lives in.
So a test that read the file and regex-matched the glob would still find
`scripts/**/*.test.mjs` after the real glob is deleted, and would pass green over
a suite that is no longer running. Only the evaluated module knows which strings
are patterns and which are prose. Proven below: after deleting the glob, the copy's
`vite.config.ts` still contains the string at line 11.

**Both, not either.** The config-value witness fails with a message that names the
glob, which is the one a human fixing it wants to read; the behavioural witness is
what actually holds. The partial-narrowing experiment below shows exactly why one
is not enough: an edit that keeps a `scripts/` anchor but stops matching the guard
file passes the config-value witness and fails both behavioural ones.

**A count *and* names.** `GUARD_SUITE_MINIMUM_CASES = 23` is a floor, not an
equality — it can only fail if the guard suite *loses* cases, never if a later
change adds some — and two cases are named outright
(`... > runs the guard in the build script, before vite build`,
`... > has the deploy workflow assert the index after the build and before the
upload`) because a bare count is satisfied by any 23 unrelated tests.

**Both listings, for two different jobs.** `vitest list --filesOnly` is
unfiltered and cheap (~0.3 s: it globs without importing a module) — that is the
load-bearing witness. `vitest list scripts/__tests__ --json` costs ~0.75 s and
answers "which cases does the suite contribute"; unfiltered `--json` costs ~4.7 s
because it collects all 18 files.

### Two non-obvious details in the probe, both verified

- **Argument order.** `--json` takes an *optional path*, so `list --json scripts`
  reads `scripts` as the output file and dies with `EISDIR`. `--json` goes last:
  `list scripts/__tests__ --json`.
- **A filter only narrows.** I verified that a positional filter cannot
  reintroduce a file `include` excluded. With the glob deleted,
  `vitest list --filesOnly scripts` prints nothing, and
  `vitest list scripts/__tests__/indexGuards.test.mjs --json` prints `[]` — not
  the guard file. That is why the cheap *unfiltered* listing can stay the primary
  witness while the filtered one is only an enhancement.
- Parent `VITEST*` env vars (pool id, worker id, mode) are stripped, so the child
  configures itself from the files rather than inheriting a worker it is not in.

### Bypass resistance

| Single narrow edit | Caught by |
| --- | --- |
| Delete the `scripts/**/*.test.mjs` glob | witnesses 1, 3, 4 — **proven below** |
| Narrow it to a path that misses the guard file, keeping a `scripts/` anchor | witnesses 1 and 3 — **proven below**; witness 4 alone would pass |
| Rename/move `indexGuards.test.mjs` | witnesses 1 and 3 (path constant no longer collected) |
| Delete the `include` array entirely | **not** a failure, by design: vitest's default pattern still collects the guard suite, so the guards still run. Witness 4 explicitly treats this as legitimate so it does not cry wolf. |
| Delete `indexGuards.test.mjs` itself | witnesses 1, 3, 4 |
| Edit the config *and* this file | unavoidable, and unchanged by any single-pin design |

The one hole no in-repo pin can close is deleting the pin itself; nothing in
`src/` or `scripts/` may assert its own existence without the same circularity.

## The `/tmp` deletion experiment

Full copy of `web/` (including `node_modules`) at `/tmp/imp028c/web-copy`. The
repository was never modified for this — `git diff --stat` is still empty.

The edit, in the copy only, deleting one line from `vite.config.ts`:

```
     include: [
       "src/**/*.test.ts",
       "src/**/*.test.tsx",
-      "scripts/**/*.test.mjs",
     ],
```

`vite.config.ts` in the copy still contains the literal `scripts/**/*.test.mjs`
at line 11, in the comment. That is the text a parse-based pin would have matched.

### Exact failure — `npx vitest run src/__tests__/indexGuardRegistration.test.ts`

```
 ❯ src/__tests__/indexGuardRegistration.test.ts (4 tests | 3 failed) 595ms
   × ... > collects the guard suite, so the tests guarding every deploy actually run 311ms
     → scripts/__tests__/indexGuards.test.mjs is not collected, so the 23 tests guarding every
       production build are not running. vitest's test.include no longer reaches scripts.:
       expected [ …(18) ] to include 'scripts/__tests__/indexGuards.test.mjs'
   × ... > collects the guard suite's cases, not just its file 281ms
     → scripts/__tests__/indexGuards.test.mjs should be collected: expected [] to include
       'scripts/__tests__/indexGuards.test.mjs'
   × ... > keeps an include pattern anchored at scripts/ in vite.config.ts 1ms
     → vite.config.ts's test.include no longer reaches scripts/, so
       scripts/__tests__/indexGuards.test.mjs stops being collected: expected false to be true

 Test Files  1 failed (1)
      Tests  3 failed | 1 passed (4)
```

`AssertionError` sites: `indexGuardRegistration.test.ts:89`, `:109`, `:136`. The
fourth test — that the pin collects *itself* — correctly still passes, which is
the point of its being under `src/`.

### Exact failure — `npm test` in the same copy

```
 Test Files  1 failed | 17 passed (18)
      Tests  3 failed | 267 passed (270)
```
exit code **1**.

Before the pin, that same deletion gave **exit 0 / 17 files / 266 tests**. Now it
is exit 1 / 18 files / 270 tests, and the guard suite is gone from the collection.

### Partial narrowing, second experiment (same copy, glob restored then narrowed)

```
-      "scripts/**/*.test.mjs",
+      "scripts/__tests__/indexGuard.test.mjs",
```

```
   × ... > collects the guard suite, so the tests guarding every deploy actually run 285ms
   × ... > collects the guard suite's cases, not just its file 274ms
      Tests  2 failed | 2 passed (4)
```

The two `scripts/`-anchored witnesses pass here and the two behavioural ones
fail — which is the argument for having both, measured rather than asserted.

## Verification, from `web/`

| Command | Result |
| --- | --- |
| `npm run typecheck` | **exit 0** |
| `npm test` (before) | 18 files / **289** tests passed, 7.79 s |
| `npm test` (after) | **19 files / 293 tests passed**, exit 0, 6.00 s |
| `npm test` ×5 | exit 0 every time, `19 passed (19)` / `293 passed (293)` each — no flake |
| `npm run build` | **exit 0**, `41 modules transformed` (unchanged) |
| `dist` comparison | **byte-identical** — 7 files, every sha256 equal to the pre-change baseline |
| `npm run dev` | `VITE v5.4.21 ready in 195 ms`, http://localhost:5173/research-paper-feed/ |

`dist` asset hashes before and after, unchanged:

```
index-B28RVUhO.js   172.50 kB │ gzip: 55.22 kB
index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
+ dist/index.html, dist/favicon.svg, dist/data/{index.json,papers-2026-W39.json,papers-2026-W40.json}
```

The pin adds 4 tests (289 → 293) and one file (18 → 19). The 23 guard tests are
untouched, and `require-index.mjs` was not edited.

## What this change does not do

It does not change what the guards do, does not remove any of the 23 guard tests,
does not add a dependency, and does not alter `package.json`, `package-lock.json`,
`tsconfig.json`, `vite.config.ts` or any workflow. It is a test-only change whose
whole effect is that narrowing `test.include` stops being silent.