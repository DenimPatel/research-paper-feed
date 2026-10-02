# IMP-026 — Add `npm run build` to CI

**Implementer report.** Status: implemented. One acceptance criterion is met with a documented
deviation (AC3), and the AC2 proof method was substituted as instructed (no push, no PR, no remote).

Scope of change: **`.github/workflows/ci.yml` only**, +2 lines. No other tracked file was modified.

---

## 1. The change

Exact diff (`git diff -- .github/workflows/ci.yml`):

```diff
@@ -36,3 +36,5 @@ jobs:
         run: npm run typecheck
       - name: Run tests
         run: npm test
+      - name: Build
+        run: npm run build
```

Resulting `web-tests` job (`.github/workflows/ci.yml:21-40`):

```yaml
  web-tests:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: web
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: npm
          cache-dependency-path: web/package-lock.json
      - name: Install dependencies
        run: npm ci
      - name: Typecheck
        run: npm run typecheck
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build
```

### Style conformance (all matched, nothing reformatted)

- Step is appended **last**, i.e. after `npm test`, per AC1.
- 6-space indent for `- name:`, 8-space for `run:`, identical to the three existing steps.
- No per-step `working-directory:` — the job's `defaults.run.working-directory: web` (`:23-25`)
  already scopes every `run:` step, so `npm run build` executes in `web/`. This matches how
  `npm ci` / `npm run typecheck` / `npm test` are already written. (`deploy.yml:42-48` *does* repeat
  `working-directory: web` per step, but that job has no `defaults:` block; `ci.yml` does, so
  repeating it here would be the inconsistency.)
- Step name is terse Title Case like its neighbours (`Install dependencies`, `Typecheck`,
  `Run tests`) → **`Build`**.
- No new actions, no new dependencies, no trigger / permission / caching / concurrency changes,
  no `timeout-minutes`. `python-tests` untouched.

### AC1 — every `run:` maps to a real script

Checked programmatically against `web/package.json:6-13`:

```
npm ci                       -> npm builtin (not a package script; correct as-is)
npm run typecheck            -> EXISTS: tsc --noEmit
npm test                     -> EXISTS: vitest run
npm run build                -> EXISTS: tsc --noEmit && vite build
declared scripts: ['build', 'dev', 'preview', 'test', 'test:watch', 'typecheck']
lint in scripts? False
```

`npm run lint` was **not** added and does not exist (PE-6 / INF-04). The only new invocation is
`npm run build`, which is declared at `web/package.json:8`.

---

## 2. AC2 — the gate is load-bearing (LOCAL substitute; nothing was pushed)

### What I did *not* do

**No push, no PR, no branch, no remote, no `git worktree`, no `git stash`, no `git commit`.** Only
read-only git commands were used (`git status`, `git diff`, `git log`, `git archive`). The
repository's `pre-push` hook was never reached because no push was attempted.

### The local substitute

The spec's method ("push a scratch branch … confirm the job fails at the build step") is replaced
by a **scratch working-tree copy under `/tmp`**, never the repo. The repo itself was not modified
by any experiment; `git status` at the end confirms it (see §5).

```shell
rm -rf /tmp/imp026-proof && mkdir -p /tmp/imp026-proof
cd /Users/denimpatel/Desktop/git/research-paper-feed
rsync -a --exclude node_modules --exclude .git --exclude .kilo --exclude dist ./ /tmp/imp026-proof/
ln -s .../web/node_modules /tmp/imp026-proof/web/node_modules
```

`--exclude .kilo` guarantees the sibling worktree `.kilo/worktrees/mildly-income` was never read.
`node_modules` is a symlink to the repo's (read-only use) to avoid a 200 MB copy. The break is
injected into the scratch copy, then the **exact CI step sequence** is replayed in order
(`npm run typecheck` → `npm test` → `npm run build`) so the result maps 1:1 onto the job.

### Control — unbreaked scratch copy

```
typecheck exit=0
test exit=0
build exit=0
```

### Break A — missing asset import (a class the spec names explicitly)

`src/main.tsx` gets `import "./__missing-asset.png";` prepended. `tsconfig.json:2` sets
`"types": ["vite/client"]` (`:18`), which declares `*.png` modules to TypeScript — so `tsc` is
legitimately blind to this.

```
typecheck exit=0                      <-- passes
test     exit=0   (16 files, 253 tests passed)
build    exit=1
```

Verbatim build failure:

```
vite v5.4.21 building for production...
transforming...
✓ 3 modules transformed.
x Build failed in 29ms
error during build:
Could not resolve "./__missing-asset.png" from "src/main.tsx"
file: /private/tmp/imp026-proof/web/src/main.tsx
    at getRollupError (.../rollup/dist/es/shared/parseAst.js:317:41)
    at ModuleLoader.handleInvalidResolvedId (.../rollup/dist/es/node-entry.js:22002:24)
```

### Break B — CSS pipeline error (the other class the spec names)

`src/styles.css` gets `@import "./__missing-partial.css";` prepended.

```
typecheck exit=0                      <-- passes
test     exit=0                       <-- passes
build    exit=1
```

Failure tail (Vite/PostCSS resolver, not TypeScript):

```
at async compileCSS (.../vite/dist/node/chunks/dep-BK3b2jBa.js:36898:21)
```

### Result: AC2 is satisfied, and more strongly than the literal spec

For both break classes, **`Typecheck` and `Run tests` are green and `Build` is the first and only
red step**. The build step is demonstrably not a no-op: it is the sole line of defence against
missing assets and CSS-pipeline errors, and `web/src/styles.css` + the static-asset graph are
invisible to both `tsc --noEmit` and `vitest` (Vitest applies `css: false` by default and never
runs the Rollup production pipeline).

Both breaks were reverted and the scratch copy returned to green (`typecheck 0 / test 0 / build 0`),
mirroring the spec's "then revert and confirm green".

### Finding worth recording: the spec's *literal* break class is caught by Typecheck, not Build

Break C — the exact experiment the spec prescribes, a syntax error in `web/vite.config.ts`:

```yaml
  base: "/research-paper-feed/",,,,,
```

```
vite.config.ts(5,33): error TS1136: Property assignment expected.
vite.config.ts(5,34): error TS1136: Property assignment expected.
vite.config.ts(5,35): error TS1136: Property assignment expected.
vite.config.ts(5,36): error TS1136: Property assignment expected.
typecheck exit=2
```

It fails at **`Typecheck` (`ci.yml:36`), not at `Build`**, because `web/tsconfig.json:20` is
`"include": ["src", "vite.config.ts"]` — confirmed with `npx tsc --showConfig`, whose `files`
array includes `./vite.config.ts`. So the spec's prescribed experiment would have produced a
*misleading* negative ("the build step did not catch it") when in fact an earlier, equally real
gate caught it.

This does not weaken the change — Breaks A and B prove the build step earns its place — but it
does mean **the spec's own test was the wrong instrument for its own question.** Breaks A and B
are the correct instrument, and they are the ones reported as the AC2 proof.

### Should the separate `typecheck` step be kept, given `build` already runs `tsc --noEmit`?

**Yes — kept, and this experiment is the evidence for why.**

`web/package.json:8` is `"build": "tsc --noEmit && vite build"`, so `tsc` does run inside the
build. It is therefore strictly redundant *as a gate* — but the two steps are not
interchangeable **as diagnostics**, which is exactly what Break C demonstrates: the same
`vite.config.ts` defect reports as four `TS1136` lines naming the file and column under
`Typecheck`, whereas a genuine build break (Breaks A/B) reports a Rollup/PostCSS stack under
`Build`. The two failure vocabularies are disjoint, so keeping both means the red step name alone
tells you which half of the pipeline broke. The spec also requires the step.

Cost of the duplication, measured (`/usr/bin/time -p`):

```
npx tsc --noEmit    real 1.58s
npx vite build      real 0.91s   (✓ built in 417ms)
npm run build       real 2.13s
```

≈1.6 s of redundant `tsc` per CI run. Not worth removing a required step to save. Recorded as a
known, accepted cost — **not** a new defect.

---

## 3. AC3 — build succeeds locally; bundle size vs baseline

`cd web && npm run build` → **exit 0**, `✓ built in 403ms`, `41 modules transformed`.

```
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
```

Exact bytes (`stat -f "%z"`, re-measured with `gzip -c | wc -c`):

| Artifact | Measured | Profile §3.3 baseline | Delta |
| --- | --- | --- | --- |
| `dist/assets/index-D7spZXJu.js` | **171,472 B (171.45 kB)**, gzip 54,942 B | 163.72 kB, gzip 52.63 kB | **+7.75 kB** |
| `dist/assets/index-G-YE6pVt.css` | **10,927 B (10.93 kB)**, gzip 2,878 B | 10.93 kB, gzip 2.86 kB | +0.00 kB ✔ |

The glob `dist/assets/index-*.js` required by AC3 matches exactly one file, `index-D7spZXJu.js`.

### AC3's "within 1 kB" is NOT met — and it is not caused by this change

AC3 is stated against a figure recorded at recon baseline SHA `1c075b3`. 50 commits have landed
since. I rebuilt that exact baseline **read-only** to attribute the drift:

```shell
rm -rf /tmp/imp026-baseline && mkdir -p /tmp/imp026-baseline
git archive 1c075b3 | tar -x -C /tmp/imp026-baseline     # read-only; no worktree, no branch
ln -s .../web/node_modules /tmp/imp026-baseline/web/node_modules
cd /tmp/imp026-baseline/web && npm run build
```

```
✓ 38 modules transformed.
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-C7dmSHFy.js   163.17 kB │ gzip: 52.40 kB
163185 bytes  dist/assets/index-C7dmSHFy.js
```

| Tree | JS bytes | JS kB | CSS bytes |
| --- | --- | --- | --- |
| `1c075b3` (recon baseline, measured now) | 163,185 | 163.19 | 10,927 |
| `HEAD` (with my change) | 171,472 | 171.45 | 10,927 |
| **Delta attributable to 50 commits since recon** | **+8,287** | **+8.29 kB** | **0** |

The growth is from other loop items, not this one — `git diff --stat 1c075b3..HEAD -- web/src`
shows `App.tsx +548/-…`, two new runtime modules (`ErrorBoundary.tsx` from IMP-018 commit
`45e24ed`, `failureCopy.ts` from IMP-017 commit `8aceee1`) and the `urlState.ts` extraction, with
module count 38 → 41. Profile §3.3 itself anticipates drift ("a few hundred bytes per feature
commit"); at 50 commits and 8.29 kB it has outgrown that allowance, so **the profile's 163.72 kB
baseline is stale and should be re-baselined to 171.45 kB** — that is a profile update, not mine
to make (I may not edit `REPO_PROFILE.md`).

**Proof that my change contributes exactly zero bundle bytes:** `.github/workflows/ci.yml` is not
an input to `vite build` — the bundle is produced solely from `web/`. Empirically, the untouched
scratch copy in `/tmp` produced the *same content hash and the same byte count*,
`index-D7spZXJu.js` / 171,472 B, as the repo build above. Identical hash, identical bytes, with a
CI-only YAML file differing.

Minor profile inaccuracy, flagged not claimed: §3.3 records "39 modules"; the `1c075b3` tree
builds **38** modules. Recon likely measured a tree with one uncommitted file. Immaterial.

---

## 4. What happens with an absent data index (for IMP-028's implementer)

CI never has `web/public/data` — it is gitignored (`web/.gitignore:7`) and is produced only by
`build_index.py`. I probed both absent states in the scratch copy. **In both cases the build
SUCCEEDS with exit 0 and emits a `dist` with no data.** This is IMP-028's bug to fix, not this
item's.

**Probe 1 — `web/public/data` removed entirely:**

```
favicon.svg              # `ls public/`
build exit=0
✓ 41 modules transformed.
dist/assets/index-D7spZXJu.js
dist/assets/index-G-YE6pVt.css
dist/favicon.svg
dist/index.html
ls: dist/data: No such file or directory
```

**Probe 2 — `web/public/data` present but an empty directory:**

```
build exit=0
dist/assets/index-D7spZXJu.js
dist/assets/index-G-YE6pVt.css
dist/favicon.svg
dist/index.html
dist/data/               # exists but is EMPTY (0 entries)
```

Two findings for IMP-028:

1. **Adding the build step to CI does not make CI red for a missing index** — a fresh CI checkout
   has no `public/data`, and the build is green. CI will not go red once IMP-028 adds the
   fail-closed check *unless* the workflow is also changed to generate an index first (e.g. a
   `python scripts/build_index.py` step) or the check is scoped to something CI can satisfy. This
   interaction between IMP-026 and IMP-028 is the single most important thing here and is
   **not** something I changed — `ci.yml` has no `build_index` step, and adding one would put
   live arXiv network calls in the PR CI path, which is a separate decision. **IMP-028's
   implementer must be aware of this.**
2. The two absent states are distinguishable and the distinction matters: with no `public/data` at
   all, `dist/data` is **absent**; with an empty `public/data`, `dist/data` **exists but is
   empty**. A guard must check for `public/data/index.json` specifically (as AC1 of IMP-028 says),
   because `os.path.isdir("dist/data")` is true in the empty case and would pass a naive check.
3. Bundle output is **byte-identical with and without the data** (`index-D7spZXJu.js` in all three
   runs), so data presence has no effect on bundle size.

---

## 5. YAML validity and working-tree scope

`PyYAML` is not importable from the default `python3` (Homebrew 3.14). It **is** available on
`/usr/local/bin/python3.11` (PyYAML 6.0.1), so validation was run there rather than falling back
to eyeballing:

```shell
/usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); ..."
```

```
YAML OK. top-level keys: ['name', True, 'jobs']      # `True` is PyYAML 1.1 coercing the `on:` key — normal
web-tests defaults.run.working-directory: web
web-tests steps:
    'actions/checkout@v4'    -> None
    'actions/setup-node@v4'  -> None
    'Install dependencies'   -> 'npm ci'
    'Typecheck'              -> 'npm run typecheck'
    'Run tests'              -> 'npm test'
    'Build'                  -> 'npm run build'
jobs: ['python-tests', 'web-tests']
triggers: {'push': {'branches': ['main']}, 'pull_request': None}
permissions present? False
```

Parses cleanly; the parsed step order and `run:` values are exactly as intended. Triggers,
permissions, caching and the `python-tests` job are unchanged.

`git status --short` at completion:

```
 M .github/workflows/ci.yml          <-- MINE
 M requirements.txt                  <-- NOT MINE, see below
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/regression-sweep-4.md
```

**`requirements.txt` is a concurrent edit by another agent in the loop** (adds `arxiv>=2.1.0,<4`
with a comment referencing IMP-093). It appeared in `git diff` and is **not my work** — I did not
open, read, or modify it. I have left it untouched. Flagging it so the coordinator does not
attribute it to IMP-026. The four `??` entries are pre-existing untracked report files; I created
only `.improve/reports/impl-IMP-026.md`.

No file under `web/`, `scripts/`, `tests/`, `readme.md`, `.improve/FEATURES.md`, or
`web/package-lock.json` was modified. `web/dist/` was regenerated by running the build (gitignored
build output, not a source edit).

---

## 6. Commands run, with results

| # | Command | Result |
| --- | --- | --- |
| 1 | `npm run build` (in `web/`) | exit 0, 41 modules, JS 171.45 kB / CSS 10.93 kB |
| 2 | `git archive 1c075b3 \| tar -x -C /tmp/imp026-baseline` + `npm run build` | exit 0, 38 modules, JS 163.19 kB — attributes the drift |
| 3 | control: `typecheck`/`test`/`build` in scratch copy | 0 / 0 / 0 |
| 4 | Break A missing asset → `typecheck`/`test`/`build` | **0 / 0 / 1** — `Could not resolve "./__missing-asset.png"` |
| 5 | Break B bad CSS `@import` → `typecheck`/`test`/`build` | **0 / 0 / 1** — Vite/PostCSS `compileCSS` throw |
| 6 | Break C `vite.config.ts` syntax error → `typecheck` | **2** — 4× `TS1136`; fails at Typecheck, not Build |
| 7 | revert all breaks → `typecheck`/`test`/`build` | 0 / 0 / 0 |
| 8 | probe: no `public/data` → `npm run build` | **exit 0**, `dist/data` absent |
| 9 | probe: empty `public/data/` → `npm run build` | **exit 0**, `dist/data/` present and empty |
| 10 | `npm run typecheck` | exit 0 |
| 11 | `npm test` | exit 0, 16 files / **253 tests passed**, ~5.9 s |
| 12 | `npx tsc --showConfig` | `include: ['src', 'vite.config.ts']` — root cause of Break C |
| 13 | `/usr/bin/time -p npx tsc --noEmit` / `npx vite build` / `npm run build` | 1.58 s / 0.91 s / 2.13 s |
| 14 | PyYAML `safe_load` on `ci.yml` (python3.11) | valid; steps parsed as intended |
| 15 | `git status --short`, `git diff` | only `ci.yml` mine; `requirements.txt` is another agent's |

Test counts are much higher than the profile's 69 — the ~30 feature items added 12 test files
under `web/src/__tests__/`. Green, not a regression.

---

## 7. Uncertainties and loose ends

1. **AC3 is not literally met** (171.45 kB vs 163.72 kB, +7.75 kB, tolerance 1 kB). Attribution to
   the 50 commits since `1c075b3` is measured, not asserted, and my change's bundle contribution is
   zero bytes. I read the intent of AC3 as *"the build still works and the bundle has not grown
   unexpectedly"*, which holds — but the literal wording is not satisfied and I am not claiming it
   is. A verifier should treat the profile's JS baseline as stale.
2. **The AC2 push experiment was not performed** and cannot be, per the no-push instruction and the
   installed `pre-push` guard. §2 is the local substitute and it is concrete: three injected
   breaks in a `/tmp` copy, with per-step exit codes recorded.
3. **I did not observe GitHub Actions itself run this workflow.** All evidence is local replay of
   the same commands. A verifier with push rights may want one real CI run to confirm the `Build`
   step is green on a fresh checkout — note that on a fresh CI checkout `web/public/data` is
   absent, and per §4 the build is green in that state, so the step should pass.
4. **CI/IMP-028 interaction** (§4) is the highest-value thing in this report: once IMP-028 makes a
   missing index fail-closed, this new build step will start failing on every CI run unless
   something generates an index first. That is a follow-up decision, not a defect in this change.
5. Not touched, out of scope, still true after this change: PE-11/INF-10 (deploy publishes without
   waiting for CI), PE-10/INF-09 (no `permissions:`, no `timeout-minutes:`, floating `node-version:
   "20"`). I deliberately did not add `permissions:` or `timeout-minutes:` since the task forbids
   changes beyond what AC1 requires.
6. Temporary scratch dirs `/tmp/imp026-proof`, `/tmp/imp026-baseline`, and the `.bak` files in
   `/tmp` are outside the repo and disposable.
