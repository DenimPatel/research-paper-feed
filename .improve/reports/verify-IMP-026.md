# verify-IMP-026 — INDEPENDENT VERIFICATION

**Verifier verdict: PASS** (change is correct and minimal) — **2 of 3 acceptance criteria met literally.**
AC3's size conjunct is not met, and is provably **unmeetable by any YAML-only change**: it is a stale
profile baseline, not an implementer defect. Details and the required follow-up are below.

Verifier did not write the change. All experiments were run in disposable copies under `/tmp`
(now deleted). **No git write command was issued** (no `commit`, `add`, `push`, `checkout`, `reset`,
`stash`, `branch`, `worktree add`). For the baseline build I used `git archive 1c075b3 | tar -x`
rather than the suggested `git worktree add`, because `git worktree add` writes to `.git/worktrees`
and is a git write command. `git archive` is read-only and gives an identical tree.

Repo integrity at completion is byte-identical to session start; see §7.

---

## 1. AC1 — every `run:` line in the whole file maps to a real thing

Read the **entire** `.github/workflows/ci.yml` (40 lines), not just the diff.

| file:line | job | step name | `run:` | exists? | evidence |
| --- | --- | --- | --- | --- | --- |
| `ci.yml:17` | python-tests | Install dependencies | `pip install -r requirements.txt` | **VALID** | `requirements.txt` exists (14 lines; `arxiv>=2.1.0,<4`, `pandas>=2.0.0`) |
| `ci.yml:19` | python-tests | Run tests | `python -m unittest discover -s tests -v` | **VALID** | `tests/` holds `test_arxiv_common.py`, `test_build_index.py`, `test_paper_collector.py` — discovery finds 3 modules. Could **not** execute locally: this sandbox's `python3` has no `arxiv`/`pandas` (`ModuleNotFoundError: No module named 'arxiv'`), so it reports `FAILED (errors=3)`. CI installs those at `:17` first, so the line is sound. Pre-existing, untouched by this change. |
| `ci.yml:34` | web-tests | Install dependencies | `npm ci` | **VALID** | npm builtin, not a package script. Ran a real clean `npm ci` from `web/package-lock.json` → **exit 0** |
| `ci.yml:36` | web-tests | Typecheck | `npm run typecheck` | **VALID** | `web/package.json:12` → `tsc --noEmit` |
| `ci.yml:38` | web-tests | Run tests | `npm test` | **VALID** | `web/package.json:10` → `vitest run` |
| **`ci.yml:40`** | **web-tests** | **Build (NEW)** | **`npm run build`** | **VALID** | `web/package.json:8` → `tsc --noEmit && vite build` |

`web/package.json` declares exactly: `build`, `dev`, `preview`, `test`, `test:watch`, `typecheck`.

### `npm run lint` was NOT added — confirmed

```
$ grep -n "lint" .github/workflows/ci.yml
(none)
```

No `lint` script exists in `web/package.json` either, so nothing references a missing script. This is
the spec's explicit trap (`FEATURES.md` IMP-026 Notes: *"A broken `npm run lint` step is a bug, not a
gate"*) and the implementer avoided it.

### `working-directory` of the new step — correct

The new step carries **no** per-step `working-directory`. It inherits the job-level
`defaults.run.working-directory: web` (`ci.yml:23-25`). PyYAML resolution of every `run:` step in
`web-tests`:

```
Install dependencies -> 'npm ci'          step-wd=None  (job default 'web')
Typecheck            -> 'npm run typecheck' step-wd=None (job default 'web')
Run tests            -> 'npm test'          step-wd=None (job default 'web')
Build                -> 'npm run build'     step-wd=None (job default 'web')
```

This matches how the three pre-existing npm steps are written. `deploy.yml:43,47` *does* repeat
`working-directory: web` per step, but that job has no `defaults:` block — so repeating it here would
have been the inconsistency, not the omission. Correct either way (both resolve to `web`).

**AC1: MET.**

Side observation, not a defect: `build` is `tsc --noEmit && vite build`, so the new step re-runs the
`tsc` that `ci.yml:36` already ran — ~1.6 s of redundancy per run. The spec mandates both steps and
the two failure vocabularies differ (`TS####` vs Rollup/PostCSS stacks), so keeping both is right.

---

## 2. AC2 — is the new step actually load-bearing?

The spec's own AC2 method ("push a scratch branch…") is forbidden, so the substituted local proof is
the right call. **I reproduced it independently**, and made it *stronger* than the implementer's.

Scratch copy via `rsync -a --exclude node_modules --exclude .git --exclude .kilo --exclude dist` into
`/tmp/v026-proof`, so the repo itself was never touched and `.kilo/worktrees/mildly-income` was never
read.

### Exit codes — control and four injected breaks

| experiment | `npm run typecheck` (`ci.yml:36`) | `npm test` (`ci.yml:38`) | `npm run build` (`ci.yml:40`) | first red step |
| --- | --- | --- | --- | --- |
| control (unmodified) | **0** | **0** (16 files / 253 tests) | **0** | — |
| **Break A** — `import "./__missing-asset.png";` prepended to `src/main.tsx` | **0** | **0** | **1** | **Build** ✔ |
| **Break B1** — `@import "./__missing-partial.css";` prepended to `src/styles.css` | **0** | **0** | **1** | **Build** ✔ |
| **Break B2** — *real CSS syntax error*: unterminated rule `.broken { color: red;` + garbage `@@@ !!! ;;;` | **0** | **0** | **0** | **none — build SUCCEEDS** ✘ |
| **Break C** — spec's literal experiment, `vite.config.ts:5` → `base: "/research-paper-feed/",,,,,` | **2** | **1** | **2** | **Typecheck** (not Build) |

Break A verbatim failure:
```
x Build failed in 31ms
error during build:
Could not resolve "./__missing-asset.png" from "src/main.tsx"
```
Break C verbatim failure (confirms the implementer's finding):
```
vite.config.ts(5,33): error TS1136: Property assignment expected.
vite.config.ts(5,34): error TS1136: Property assignment expected.
```

All breaks were reverted and the scratch copy returned to 0/0/0.

### CI-faithful re-run (closes the implementer's biggest methodological gap)

The implementer symlinked the repo's `node_modules` into the scratch copy. I additionally built a
**clean-install** copy from `git archive HEAD` and ran a real `npm ci` (no symlink), then the exact CI
step sequence:

```
npm ci                exit=0
npm run typecheck     exit=0
npm test              exit=0    Test Files 16 passed (16) / Tests 253 passed (253)
npm run build         exit=0    ✓ 41 modules transformed.
                                    dist/assets/index-D7spZXJu.js   171.45 kB
Break A re-injected:  typecheck=0  test=0  build=1   Could not resolve "./__missing-asset.png"
```

Identical results and the **same content hash** as the symlinked copy. The finding is not an artifact
of a borrowed `node_modules`.

### Judgement on the local substitute — adequate, with one honest limit

**Adequate.** It replays the job's command sequence 1:1 and in order, it was reproduced twice
(symlinked `node_modules` **and** a clean `npm ci`), the breaks are the two classes the spec names
("a missing asset", "a CSS pipeline error"), and the reverse direction was checked (revert → green).
For Breaks A/B1 the build step is the **first and only** red step, which is precisely AC2's claim.

**Two limits the local proof cannot close:**

1. **Node major version — unverified.** CI pins `node-version: "20"` (`ci.yml:30`); this machine has
   **node v25.6.1** and no `nvm`/`fnm`/`volta`, so no node-20 run was possible. Risk is low — `tsc` and
   `vite build` are pure JS, no native bindings, no postinstall — but it is genuinely untested.
2. **Platform.** CI is `ubuntu-latest`; this is darwin/arm64. Only path separators and platform
   resolution could diverge, and the injected breaks are platform-independent.

Neither is a defect in the change and neither is blocking.

### New finding the implementer did not report

**Break B2: an ordinary CSS *syntax* error is NOT caught by the build gate.** Vite/PostCSS silently
tolerates an unterminated rule and garbage tokens; the build exits 0 and ships a *larger* CSS file:

```
dist/assets/index-*.css   11.86 kB │ gzip: 2.92 kB     (healthy build: 10.93 kB │ gzip: 2.86 kB)
✓ built in 410ms
```

So the gate catches CSS **resolution/pipeline** errors (missing `@import` partial, B1) but **not**
CSS **syntax** errors. The implementer's Break B is the missing partial, which they labelled
accurately as a "CSS pipeline error" — so their report is not wrong, but the generalisation "a CSS
pipeline error fails the build" is narrower than it reads. `web/src/styles.css` is 2 lines, so nothing
is currently at risk. Worth one sentence in the commit message or the profile, not a code change.

### The spec's prescribed instrument was the wrong one (implementer's §2 claim — independently confirmed)

Break C fails at **`Typecheck` (`ci.yml:36`)**, not `Build`, because `web/tsconfig.json:20` is
`"include": ["src", "vite.config.ts"]`. I additionally found `npm test` also goes red (**exit 1**)
because Vitest loads `vite.config.ts` to configure the jsdom environment — the implementer stopped at
typecheck and did not report this. Following the spec literally would have produced a misleading
negative. Using A/B instead was correct judgment.

**AC2: MET** (substituted method, adequate, independently reproduced and strengthened).

---

## 3. AC3 — the bundle-size claim: is the drift this change's fault, or a stale baseline?

This is the crux. **It is a stale baseline.** The +8.29 kB is 100% attributable to the 53 commits that
preceded this one, and **0 bytes** to this change.

### Measured sizes

| tree | JS bytes | JS kB | JS gzip | CSS bytes | modules |
| --- | --- | --- | --- | --- | --- |
| profile §3.3 stated baseline — `REPO_PROFILE.md:124`, `:852` | (≈163,720 implied) | **163.72** | 52.63 kB | 10.93 kB | "39 modules" |
| **`1c075b3` rebuilt by me, today** | **163,185** | **163.19** | 52,400 | **10,927** | **38** |
| **HEAD** (`git archive HEAD`, clean `npm ci`) | **171,472** | **171.45** | 54,942 | **10,927** | **41** |
| working tree (HEAD + modified `ci.yml`) | **171,472** | 171.45 | 54,942 | 10,927 | 41 — **identical content hash `index-D7spZXJu.js`** |
| **delta `1c075b3` → HEAD** | **+8,287** | **+8.29 kB** | +2,542 | **0** | **+3** |

### The baseline number is not reproducible at its own SHA

`1c075b3` = *"Restyle web feed to match denimpatel.github.io design system (#4)"*, Fri 11 Sep 2026.
Rebuilt today it yields **163.19 kB / 38 modules**, not the recorded **163.72 kB / 39 modules** —
off by **535 bytes and one module before any of this loop's work landed**. The profile figure is
inaccurate at the moment it was captured, quite apart from having gone stale since.

`REPO_PROFILE.md:125` itself says: *"The JS figure drifts a few hundred bytes per feature commit as
modules gain exports."* At 53 commits × ~156 B/commit, 8.29 kB is exactly that acknowledged mechanism.
It has simply outgrown the 1 kB tolerance. The profile also says at `:125-126` *"the CSS figure is
stable at 10.93 kB since recon"* — and my measurements confirm **CSS delta = 0**, which independently
validates the profile's methodology.

### Per-module attribution (empirical, not inferred)

Injected a throwaway `generateBundle` rollup plugin into a `/tmp` copy to read `renderedLength` per
module, and ran it against **both** trees:

| module | `1c075b3` | HEAD | Δ (rendered bytes) | origin |
| --- | --- | --- | --- | --- |
| `App.tsx` | 13,063 | 24,865 | **+11,802** | App rewrite (IMP-019/173/151b) |
| `lib/paperIndex.ts` | 3,639 | 6,534 | +2,895 | shard/manifest hardening (IMP-173) |
| **`lib/urlState.ts`** (new) | 0 | 3,055 | **+3,055** | URL-state extraction (IMP-020 era) |
| **`ErrorBoundary.tsx`** (new) | 0 | 2,159 | **+2,159** | IMP-018, commit `45e24ed` |
| `lib/collections.ts` | 6,049 | 7,464 | +1,415 | storage/validation hardening |
| **`lib/failureCopy.ts`** (new) | 0 | 1,079 | **+1,079** | IMP-017, commit `8aceee1` |
| `components/FeedControls.tsx` | 3,616 | 4,535 | +919 | control fixes |
| `components/PaperCard.tsx` | 5,800 | 6,095 | +295 | null-URL guards |
| `main.tsx` | 308 | 376 | +68 | mounts ErrorBoundary |
| `CollectionsView.tsx`, `PaperList.tsx`, `search.ts` | 7,463 | 7,463 | **0** | untouched |
| **first-party total** | **43,618** | **67,305** | **+23,687** | |
| **node_modules total** | **147,232** | **147,232** | **0** | prod deps unchanged |

(The per-module deltas sum to exactly +23,687 = the first-party total delta.) Rendered lengths are
larger than the file delta because cross-module minification/dedup is not additive; the *direction and
composition* are what matter, and they are unambiguous: three new runtime modules plus a rewritten
`App.tsx`, all committed before this change.

### Test-only dependencies did NOT leak into the production bundle — verified

- `git diff 1c075b3..HEAD -- web/package.json` adds **exactly two** entries, both in
  `devDependencies`: `@testing-library/react`, `jsdom`. **`dependencies` is untouched**
  (`{"react":"^18.3.1","react-dom":"^18.3.1"}` at both SHAs).
- Neither build's rollup module list contains a single `*.test.*` file, `test-setup.ts`, or any
  test-only module.
- Literal grep of the shipped bundle `dist/assets/index-D7spZXJu.js`: `jsdom` → 0, `testing-library`
  → 0, `__tests__` → 0, `describe(` → 0, `vitest` → 0, `happy-dom` → 0.
- `find dist -name "*test*"` → empty. `dist/` contains only `index.html`, `assets/index-*.js`,
  `assets/index-*.css`, `favicon.svg`.

### This change contributes 0 bytes — three independent proofs

1. `.github/workflows/ci.yml` is not an input to `vite build`; the bundle is produced solely from `web/`.
2. The tree carrying the **modified** `ci.yml` emitted a **byte-identical** bundle —
   same content hash `index-D7spZXJu.js`, same 171,472 B — as the clean `HEAD` archive.
3. `node_modules` rendered total is **identical** (147,232 B) at `1c075b3` and HEAD.

### Judgement on AC3

- **`npm run build` still succeeds locally: MET.** Exit 0 on three independent runs (scratch copy,
  clean `HEAD` archive, clean `npm ci` install).
- **"within 1 kB of the 163.72 kB baseline": NOT MET literally** (+7.73 kB vs 163.72; +8.29 kB vs the
  real `1c075b3` measurement; tolerance 1 kB).
- **It is not the implementer's fault, and it was not meetable.** No YAML-only change can move a
  bundle by 0 bytes. The implementer disclosed the failure explicitly rather than claiming it
  ("AC3 is not literally met… I am not claiming it is"), which is the correct behavior.
- **Required follow-up (out of IMP-026's scope):** re-baseline `REPO_PROFILE.md:124` and `:852` to the
  **measured `1c075b3` value of 163.19 kB / 38 modules** for the historical record, and to
  **171.45 kB / 41 modules** as the new live figure. Do not simply write "171.45" over "163.72" —
  the historical baseline number was also wrong by 535 B, which should be corrected on its own terms.

**AC3: 1 of 2 conjuncts met. Verdict: unmet-but-unmeetable; stale baseline, escalate a profile update.**

---

## 4. The missing-index question — what does the NEW CI build step actually do without data?

Run in the `/tmp` scratch copy (byte-identical evidence, zero risk to the repo).
`web/.gitignore:9` ignores `public/data`; it is produced only by `scripts/build_index.py`.

### Probe 1 — `web/public/data` ABSENT (this is exactly what a fresh CI checkout looks like)

```
$ mv public/data /tmp/v026-data-aside && ls public/
favicon.svg
$ npm run build
build exit=0
✓ 41 modules transformed.

dist/assets/index-D7spZXJu.js
dist/assets/index-G-YE6pVt.css
dist/favicon.svg
dist/index.html
dist/data exists? NO
```

Both asset **content hashes are identical to the healthy build** (`index-D7spZXJu.js` 171,472 B,
`index-G-YE6pVt.css` 10,927 B) — the only difference is the absence of `dist/data/`. The data index is
copied as *files*, never inlined into JS or CSS, so its presence cannot affect bundle bytes.

### Probe 2 — `web/public/data` present but EMPTY

```
build exit=0
dist/data isdir? YES
dist/data entries: 0
```

`public/data` was restored immediately; `npm run build` back to exit 0.

### What this means for the new gate — clear and material

1. **The new Build step is GREEN on a fresh CI checkout.** `ci.yml` has no
   `python scripts/build_index.py` step, so `web/public/data` is absent on every CI run and the build
   still exits 0. The new gate **does not catch a missing index** and is not wrong about it — it is
   simply silent, which is precisely IMP-028's problem, not IMP-026's.
2. **Forward-looking breakage.** Once IMP-028 makes a missing index fail-closed, this new step will
   start failing on **every** CI run unless CI first gains an index-generation step (or IMP-028 scopes
   its guard to something CI can satisfy). The implementer flagged this; I confirm it. **IMP-028's
   implementer must know this before shipping the guard.**
3. **The two absent states are distinguishable, and the distinction is a trap.** With no
   `public/data` at all, `dist/data` is **absent**; with an *empty* `public/data`, `dist/data`
   **exists but is empty**. A naive `os.path.isdir("dist/data")` check passes in the empty case. IMP-028
   AC1's requirement to check for `public/data/index.json` specifically is the correct shape.
4. Bundle output is byte-identical with and without data (`index-D7spZXJu.js` in every run) — data
   presence has **zero** effect on bundle size, so nothing in §3 is affected by this.

**Net: the new gate is honest — it does not claim to catch a missing index, and it does not silently
pass one as "built correctly"; it simply reports what Vite does, which is produce a data-less `dist`.
The misleading risk is entirely in the future, at IMP-028.**

---

## 5. YAML syntax validity

**Used PyYAML** — not eyeballing.

```
/usr/local/bin/python3.11 -> PyYAML 6.0.1        (this interpreter)
/usr/local/bin/python3.11 -> PyYAML 6.0.1
python3 (Homebrew 3.14)  -> ModuleNotFoundError (no PyYAML)
/opt/homebrew/bin/python3 -> ModuleNotFoundError
```

`yaml.safe_load('.github/workflows/ci.yml')`:

```
YAML OK. top-level keys: ['name', True, 'jobs']   # `True` = PyYAML 1.1 coercing the `on:` key — normal
triggers: {'push': {'branches': ['main']}, 'pull_request': None}
permissions present: False
concurrency present: False
job python-tests: runs-on=ubuntu-latest timeout-minutes=None
job web-tests:    runs-on=ubuntu-latest timeout-minutes=None
                   defaults.run.working-directory='web'
   run  Install dependencies -> 'npm ci'             step-wd=None
   run  Typecheck            -> 'npm run typecheck'  step-wd=None
   run  Run tests            -> 'npm test'           step-wd=None
   run  Build                -> 'npm run build'      step-wd=None
```

Parses cleanly; step order and `run:` values are exactly as intended.

---

## 6. Nothing else changed

```
$ git diff -U0 .github/workflows/ci.yml
@@ -38,0 +39,2 @@ jobs:
+      - name: Build
+        run: npm run build

$ head -38 .github/workflows/ci.yml | diff - <(git show HEAD:.github/workflows/ci.yml)
(no output)
IDENTICAL: ci.yml lines 1-38 unchanged; only lines 39-40 appended.
```

The diff is a single purely-additive hunk at the end of the `web-tests` job. Therefore **no** change
to: `on.push.branches`, `on.pull_request`, `permissions`, `concurrency`, `runs-on`, job graph /
`needs`, `defaults`, `node-version`, `cache: npm`, `cache-dependency-path`, or any `uses:` action
version. `python-tests` is byte-identical.

```
$ git diff --stat
 .github/workflows/ci.yml |  2 ++
 .improve/FEATURES.md     |  4 ++--
 requirements.txt         | 14 +++++++++++++-
```

**Deviation from the task's stated expectation, flagged not fatal:** `.improve/FEATURES.md` is *also*
modified (4 lines) — `IMP-026` `Status: TODO → IN-PROGRESS` and `IMP-033` `Status: TODO →
IN-PROGRESS`. The IMP-026 half is this implementer's bookkeeping; the IMP-033 half belongs to the
concurrent IMP-033 agent. `requirements.txt` (+14, the `arxiv>=2.1.0,<4` upper bound) is IMP-033's
work — not mine, not IMP-026's, left untouched. Neither touches a source file. No source file under
`web/`, `scripts/`, or `tests/` was modified by anyone in this working tree.

---

## 7. Cross-check against `deploy.yml`

Extracted every `uses:` + `with:` block from both files and compared programmatically.

| shared action | `ci.yml` | `deploy.yml` | |
| --- | --- | --- | --- |
| `actions/checkout@v4` | no inputs | no inputs | **SAME** |
| `actions/setup-node@v4` | `node-version: 20`, `cache: npm`, `cache-dependency-path: web/package-lock.json` | identical | **SAME** |
| `actions/setup-python@v5` | `python-version: 3.x` | `python-version: 3.x` | **SAME** |

Both jobs run `npm ci` then `npm run build` in `web` (ci via `defaults`, deploy via explicit
`working-directory: web` at `:43,47` — same resolution, confirmed by PyYAML).

- **No duplication, no conflict.** ci.yml gains `npm run build`; deploy.yml already had it at `:46-48`.
  That is not redundant work: deploy runs on a **weekly cron** and on push-to-`main`, where a Vite
  failure produces only a red Actions page and **publishes nothing** (`upload-pages-artifact` never
  runs). The CI gate exists precisely to move that discovery from the cron to the pull request. The
  relationship is pre-flight → pre-production, not overlap.
- **Publish-only actions are correctly absent from CI**: `actions/configure-pages@v5`,
  `actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4` appear only in `deploy.yml`. No
  permissions or `pages` scope leaks into `ci.yml`.
- **The one real asymmetry — pre-existing, NOT introduced here:** `deploy.yml:33-34` runs
  `python scripts/build_index.py` *before* the web build, so deploy always has a populated
  `web/public/data`. `ci.yml` has no index-generation step at all. So the new CI Build step runs in a
  **poorer** state than the deploy build it is meant to pre-screen. It still passes (§4), so it is not
  wrong — but it is not equivalent coverage either, and it is precisely why IMP-026 does not pre-screen
  the most common real-world deploy failure. Recorded as a known gap for IMP-027/028, not a defect.
- **Pre-existing and still true (out of scope, unchanged by this diff):** `ci.yml` has no
  `permissions:` block (relies on repo default), no `timeout-minutes:` anywhere, and a floating
  `node-version: "20"`. `deploy.yml` does have a top-level `permissions:` block. Correctly left alone.

---

## 8. Findings summary

| # | finding | severity |
| --- | --- | --- |
| 1 | AC3's literal "within 1 kB of 163.72 kB" is **not met** (171.45 kB, +8.29 kB vs the real `1c075b3`). **Stale profile baseline, not implementer fault** — proven by rebuilding `1c075b3` and by per-module attribution; this change contributes **0 bytes**. | informational → needs a profile re-baseline by someone authorized to edit `REPO_PROFILE.md` |
| 2 | The profile's own recorded baseline is **inaccurate at its own SHA**: 163.19 kB / 38 modules at `1c075b3`, vs the recorded 163.72 kB / 39 modules. Off by 535 B + 1 module. | informational — fix on the record, do not overwrite |
| 3 | **Real CSS *syntax* errors are not caught** by the new build gate (Break B2: exit 0, ships an 11.86 kB CSS vs 10.93 kB healthy). Only CSS *resolution/pipeline* errors are caught (Break B1: exit 1). | informational — no CSS source is at risk today (`styles.css` is 2 lines); worth one clause in the commit message |
| 4 | The spec's prescribed AC2 experiment fails at **Typecheck**, not Build, because `web/tsconfig.json:20` includes `vite.config.ts`; `npm test` also goes red (exit 1). The implementer's substitution was correct and superior. | informational — worth amending the spec's AC2 wording |
| 5 | Once IMP-028 makes a missing index fail-closed, this new Build step will fail on **every** CI run unless CI generates an index first (`deploy.yml:33-34` does; `ci.yml` does not). | **actionable for IMP-028's implementer** — coordinate before shipping that guard |
| 6 | CI runs `node-version: "20"`; local verification ran node v25.6.1 (no version manager available). Pure-JS toolchain, no native deps, so risk is low — but the exact CI runtime is unverified. | low — informational |
| 7 | `ci.yml:19`'s Python job could not be executed locally (no `arxiv`/`pandas` in this sandbox). Commands, paths and discovery all verified; CI installs deps at `:17` first. | none — pre-existing, untouched |

## 9. What I ran (all read-only w.r.t. the repo; scratch dirs deleted)

| # | command (in `/tmp` copies) | result |
| --- | --- | --- |
| 1 | `rsync -a --exclude node_modules --exclude .git --exclude .kilo --exclude dist` → `/tmp/v026-proof` | scratch copy |
| 2 | control `npm run typecheck && npm test && npm run build` | **0 / 0 / 0**, 16 files, 253 tests, 41 modules |
| 3 | Break A (missing asset) | **0 / 0 / 1** — `Could not resolve "./__missing-asset.png"` |
| 4 | Break B1 (missing `@import` partial) | **0 / 0 / 1** |
| 5 | **Break B2 (real CSS syntax error)** | **0 / 0 / 0** — build passes, CSS 10.93→11.86 kB |
| 6 | Break C (`vite.config.ts` syntax error) | typecheck **2**, test **1**, build **2** |
| 7 | revert all breaks | **0 / 0 / 0** |
| 8 | `git archive 1c075b3 \| tar -x` → `/tmp/rpf-baseline`; `npm run build` | exit 0, **38 modules, JS 163,185 B**, CSS 10,927 B |
| 9 | `git archive HEAD` → `/tmp/rpf-head`; `npm run build` | exit 0, **41 modules, JS 171,472 B**, CSS 10,927 B |
| 10 | `git archive HEAD` → `/tmp/v026-cilike`; **`npm ci`** (real install, no symlink) | `npm ci` **0**, typecheck **0**, test **0** (253), build **0**, `index-D7spZXJu.js` 171,472 B; Break A still **0/0/1** |
| 11 | rollup `generateBundle` per-module `renderedLength`, injected in `/tmp` only | first-party 43,618 → 67,305; node_modules 147,232 → 147,232 |
| 12 | test-leak grep of `dist/assets/index-*.js` | `jsdom`/`testing-library`/`__tests__`/`describe(`/`vitest`/`happy-dom` all **0** |
| 13 | Probe: `public/data` absent | build **exit 0**, `dist/data` absent |
| 14 | Probe: `public/data` empty | build **exit 0**, `dist/data` exists, **0 entries** |
| 15 | `/usr/local/bin/python3.11` `yaml.safe_load` on `ci.yml` | valid; step/working-directory resolution as tabled in §5 |
| 16 | ci-vs-deploy `uses:`/`with:` extraction and diff | all shared actions **SAME** version and inputs |
| 17 | `head -38 ci.yml \| diff - <(git show HEAD:.github/workflows/ci.yml)` | identical — only lines 39-40 appended |

**Repo integrity at completion** — identical to session start:

```
 M .github/workflows/ci.yml
 M .improve/FEATURES.md
 M requirements.txt
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/impl-IMP-026.md
?? .improve/reports/impl-IMP-033.md
?? .improve/reports/regression-sweep-4.md
?? .improve/reports/verify-IMP-033.md     <- concurrent agent, not mine
```

`web/` reports clean (`git status --porcelain -- web/` empty). `web/public/data` tree checksum is
unchanged at `88db09010a241dc6cca93d88dee290fa44c96d0f0be0173f1fab84c984461ce1` (recorded before all
experiments and re-verified after; the rename-aside probe was run in the scratch copy, so the repo's
data was never moved).

---

## 10. Verdict

**PASS.**

The change is 2 additive lines, correct in placement, naming, indentation and `working-directory`
resolution; it references only scripts that exist; it does **not** add the non-existent `npm run lint`;
it alters no trigger, permission, cache, action version or job graph; it is consistent with
`deploy.yml`; and it is provably load-bearing for the failure classes the spec names, demonstrated
twice including under a real clean `npm ci`.

The implementer's report was accurate on every claim I could test — the exit codes, the
`1c075b3` baseline size, the 253-test count, the CSS-stability observation, and the Break-C finding —
and it correctly declined to claim AC3's literal criterion while documenting exactly why. That is the
right call, and the one omission I found (Break B2, real CSS syntax errors pass) makes its own case
slightly *more* conservative rather than less.

**The only unmet criterion is AC3's size bound, and it is a stale profile figure that no YAML-only
change could have satisfied.** Escalate the re-baseline rather than blocking this commit.