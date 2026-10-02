# Verification — IMP-005 "Make component and DOM testing possible"

**Verifier:** independent sub-agent (did not author the change)
**Date:** 2026-10-02
**Baseline for comparison:** `HEAD` = `24beb16` (`improve/auto-20261002`)
**Scope reviewed:** `git diff -- web/` + untracked `web/src/test-setup.ts`, `web/src/__tests__/domEnvironment.test.tsx`
**Scratch dirs used:** `/tmp/imp005-verify/**` (repo never modified; no git write command run)

## VERDICT: PASS (3/3 acceptance criteria met)

No blocking defect found. Five non-blocking findings are recorded in §8 — one of them
(an installed-but-unimported devDependency) is a legitimate observation the spec itself
contradicts on.

---

## 1. Change surface — exactly what was claimed

```
$ git diff --stat -- web/
 web/package-lock.json | 706 ++++++++++++++++++++++++++++++++++++++++++++++++++
 web/package.json      |   3 +
 web/vite.config.ts    |   5 +-
 3 files changed, 712 insertions(+), 2 deletions(-)

$ git ls-files --others --exclude-standard -- web/
web/src/__tests__/domEnvironment.test.tsx
web/src/test-setup.ts
```

Nothing else. `web/dist/`, `web/node_modules/`, `web/public/data/` are gitignored
(`git check-ignore -v` confirms `web/.gitignore:5,2,9`) and were excluded.

The `web/` diff is 3 files. The other modified files in `git status`
(`scripts/*`, `tests/*`) belong to the concurrent IMP-004 agent and were ignored.

### `web/vite.config.ts` — 3 lines changed, 1 added (`web/vite.config.ts:8-10`)

```diff
   test: {
-    environment: "node",
-    include: ["src/**/*.test.ts"],
+    environment: "jsdom",
+    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
+    setupFiles: ["src/test-setup.ts"],
   },
```

### `web/package.json` — 3 added devDependencies (`web/package.json:19,20,24`)

```diff
   "devDependencies": {
+    "@testing-library/react": "^16.3.3",
+    "@testing-library/user-event": "^14.6.7",
     "@types/react": "^18.3.12",
     ...
+    "jsdom": "^29.1.1",
```

---

## 2. Acceptance criteria, one by one

### Criterion 1 — three packages present in `devDependencies` + lockfile, added only via `npm install` — **MET**

| Requirement | Evidence |
| --- | --- |
| In `devDependencies`, not `dependencies` | `web/package.json:19,20,24` are inside `devDependencies`. `node -e ...dependencies` → `{"react":"^18.3.1","react-dom":"^18.3.1"}` — runtime deps unchanged. |
| In the lockfile | 4 new `node_modules/*` entries, all with `resolved` **and** `integrity` (so npm-generated, not hand-written): `@testing-library/dom@10.4.2`, `@testing-library/react@16.3.3`, `@testing-library/user-event@14.6.7`, `jsdom@29.1.1`, plus `jsdom/node_modules/lru-cache@11.5.3`. Every one carries `"dev": true`. |
| Lockfile not hand-edited | `git diff --numstat -- web/package-lock.json` → **706 insertions, 0 deletions**; `git diff -U0 \| grep -c '^-[^-]'` → **0**. Purely additive. |
| No silent version drift | Lockfile + on-disk: `vite 5.4.21`, `vitest 2.1.9`, `typescript 5.9.3`, `react 18.3.1`, `react-dom 18.3.1`, `@vitejs/plugin-react 4.7.0` — all unchanged from baseline. |
| Lockfile internally consistent | `npm ci --dry-run` → **exit 0**, "up to date in 193ms". Additionally I ran a **real** `npm ci` in `/tmp/imp005-verify/ci-real` (repo's `package.json` + `package-lock.json` copied out): **exit 0**, "added 149 packages, and audited 150 packages", and `npx vitest run` in that clean install → **4 files / 42 tests passed**, `npx tsc --noEmit` → exit 0. So CI reproducibility is proven, not assumed. |
| No `EBADENGINE` noise | `grep -c EBADENGINE /tmp/imp005-verify/ci-real.log` → 0. No `.npmrc` and no `engine-strict` anywhere (`ls .npmrc web/.npmrc` → both missing). |

### Criterion 2 — `environment: "jsdom"` + both include globs — **MET (verbatim)**

`web/vite.config.ts:8` = `environment: "jsdom"`; `:9` = `include: ["src/**/*.test.ts", "src/**/*.test.tsx"]`.
Both load-bearing, proven empirically in §5.

The extra `setupFiles: ["src/test-setup.ts"]` at `:10` is **also load-bearing** — see §5
experiment D. It is justified in `impl-IMP-005.md` §2.3 and I independently confirmed it.

### Criterion 3 — pre-existing tests still pass, none weakened — **MET IN SUBSTANCE, with a documented +3 deviation**

**Pre-existing tests are untouched — this is the important half of the criterion, and it passes cleanly.**

```
$ git diff --stat HEAD -- web/src
(empty — no tracked file under web/src changed)

$ for f in search collections paperIndex; do git show "HEAD:web/src/lib/__tests__/$f.test.ts" | diff -q - "web/src/lib/__tests__/$f.test.ts"; done
search.test.ts: IDENTICAL to HEAD
collections.test.ts: IDENTICAL to HEAD
paperIndex.test.ts: IDENTICAL to HEAD

$ grep -rnE '\.(skip|todo|only|concurrent)|describe\.(skip|only)|exclude' web/src/lib/__tests__/ web/src/__tests__/
NONE FOUND
```

No test was weakened, skipped, `.only`-ed, excluded, or deleted. Nothing was made room for.

**Count: 42, not the 36 the spec text says.** The spec's "36" is stale, and the implementer's
claim of a **39** pre-existing baseline is correct. I traced it across history:

| SHA | search | collections | paperIndex | total | commit |
| --- | --- | --- | --- | --- | --- |
| `1c075b3` (recon baseline) | 12 | 14 | 10 | **36** | Restyle web feed… |
| `0beec1b` | 12 | 16 | 10 | **38** | IMP-001 (`javascript:` URL filter) |
| `768a5ae` | 12 | 16 | 11 | **39** | IMP-003 (manifest promise) |
| `24beb16` (HEAD) | 12 | 16 | 11 | **39** | chore: mark IMP-001 done |

So `36` was correct only at the recon baseline SHA; the three extra tests arrived from two
already-DONE items. Criterion 3's parenthetical *"no component test yet — that is IMP-037"* also
directly contradicts the verifier brief, which required a smoke component test. The implementer
resolved this in favour of the brief and documented the conflict in `impl-IMP-005.md` §2.4 and
§6 row 3. That is the right call and I concur with it.

**No APP/IMP-037 scope theft:** `domEnvironment.test.tsx` asserts only environment facts (a
`document` exists; a component mounts; trees are unmounted between tests). It does not assert
`PaperCard`'s `href` or date rendering, which is exactly IMP-037's deliverable
(`impl-IMP-005.md` §2.4). Correctly scoped.

---

## 3. "Runtime behaviour unchanged" — proven byte-for-byte

The profile's headline baseline (§3.3: JS 163.17 kB / CSS 10.93 kB) is *also* stale. Rather than
compare against a number, I built the pre-change sources and compared bytes.

**Step 1 — export HEAD's `web/` and build it with the old config:**

```
$ git archive HEAD web | tar -x -C /tmp/imp005-verify/repo      # HEAD vite.config.ts: environment "node", include ["src/**/*.test.ts"]
$ cd /tmp/imp005-verify/repo/web && ln -s <repo>/web/node_modules node_modules && npx vite build
vite v5.4.21 building for production...
✓ 38 modules transformed.
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-CzjWDLvR.js   163.50 kB │ gzip: 52.55 kB
```

**Step 2 — compare against the current working-tree build (`rm -rf dist && npm run build`):**

```
$ cmp repo/web/dist/assets/index-CzjWDLvR.js  <repo>/web/dist/assets/index-CzjWDLvR.js  && echo "JS: BYTE-IDENTICAL"
JS: BYTE-IDENTICAL
d56f0a941576db22089dd0d351e47cf0d1d80f37162646afd211f53c3af6b89d  (both)

$ cmp repo/web/dist/assets/index-DhFU7_e3.css <repo>/web/dist/assets/index-DhFU7_e3.css  && echo "CSS: BYTE-IDENTICAL"
CSS: BYTE-IDENTICAL
894c766c9f0320cd8ebaef3da6077f511e051729c4dda5a603fbc30dc2b7800d  (both)

$ cmp repo/web/dist/index.html <repo>/web/dist/index.html && echo "index.html: BYTE-IDENTICAL"
index.html: BYTE-IDENTICAL
```

Same content-derived filenames (`index-CzjWDLvR.js`, `index-DhFU7_e3.css`), same 38 modules,
identical sha256. **The implementer's "byte-identical" claim is true**, and stronger evidence than
the size comparison they used.

---

## 4. `test-setup.ts` does not affect the app; jsdom is not in the bundle

```
$ grep -rn "test-setup" web/src web/index.html
(no hits — only web/vite.config.ts:10 references it)

$ grep -rl 'test-setup' web/dist/
none

$ grep -ciE 'jsdom|testing-library|user-event' web/dist/assets/index-CzjWDLvR.js
0
$ grep -ciE 'jsdom|testing-library' web/dist/assets/index-DhFU7_e3.css
0
```

`web/src/test-setup.ts` is reachable only from `vite.config.ts`, never from
`index.html` → `src/main.tsx`, so Vite's module graph excludes it. It **is** covered by
`tsconfig.json:20` (`include: ["src", "vite.config.ts"]`), so it is typechecked — confirmed by
`npm run typecheck` exit 0 including the new `.tsx` file.

`jsdom` and both `@testing-library/*` packages are `"dev": true` in the lockfile and unreachable
from the app entry, so they cannot enter the Pages bundle. **Confirmed empirically, not assumed.**

---

## 5. Smoke test is not vacuous — three independent counterfactuals

All run in `/tmp/imp005-verify/nodetest` (a copy of the working tree with `node_modules` symlinked).
The repo was never modified.

**Experiment B — revert `environment` to `"node"`, keep the widened include:**

```
× DOM test environment > provides a document to test against
  AssertionError: expected 'undefined' to be 'object'   (domEnvironment.test.tsx:22)
× DOM test environment > renders a component into the document
  ReferenceError: document is not defined                  (domEnvironment.test.tsx:28)
× DOM test environment > unmounts each rendered tree
  ReferenceError: document is not defined                  (domEnvironment.test.tsx:34)
 Test Files  1 failed | 3 passed (4)
      Tests  3 failed | 39 passed (42)
```

All three smoke assertions fail without the fix. The test genuinely renders in a DOM and is
sensitive to the environment. It also independently confirms the 39 lib tests are
environment-agnostic (they pass under `node` too) — supporting the implementer's §2.2 reasoning
for not adding per-file overrides.

**Experiment C — revert `include` to the original glob, keep jsdom:**

```
 ✓ src/lib/__tests__/search.test.ts (12 tests)
 ✓ src/lib/__tests__/collections.test.ts (16 tests)
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests)
 Test Files  3 passed (3)
      Tests  39 passed (39)
```

The `.tsx` file is not collected at all — the exact "untestable by construction" state the item
removes. The widened glob is load-bearing.

**Experiment D — remove `setupFiles` (is the extra config line justified?):**

```
 ❯ src/__tests__/domEnvironment.test.tsx (3 tests | 1 failed)
   × DOM test environment > unmounts each rendered tree
     → expected <article class="paper">…(4)</article> to have a length of +0 but got 1
 Test Files  1 failed | 3 passed (4)
      Tests  1 failed | 41 passed (42)
```

Confirmed: with `globals` unset, `@testing-library/react` v16 does **not** auto-register
`afterEach(cleanup)`, the previous test's tree leaks into `document`, and the third assertion fails.
`setupFiles` is necessary, not cargo-cult. The implementer's §2.3 rationale holds up.

---

## 6. Gates — exact results from `web/`

Node v25.6.1, npm 11.9.0, vitest 2.1.9.

```
$ npm run typecheck
> tsc --noEmit
exit=0                                    (no output)

$ npm test
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/collections.test.ts (16 tests) 4ms
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests) 9ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 98ms
 Test Files  4 passed (4)
      Tests  42 passed (42)
   Duration  1.19s
exit=0

$ npm run build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 38 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.52 kB
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-CzjWDLvR.js   163.50 kB │ gzip: 52.55 kB
✓ built in 381ms
exit=0
```

---

## 7. Dependency review

| Package | Declared | Resolved | Imported? | dev? | Bundled? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| `jsdom` | `^29.1.1` | `29.1.1` | loaded by vitest via `environment: "jsdom"` | yes | **no** | OK |
| `@testing-library/react` | `^16.3.3` | `16.3.3` | yes — `test-setup.ts:1`, `domEnvironment.test.tsx:1` | yes | **no** | OK |
| `@testing-library/user-event` | `^14.6.7` | `14.6.7` | **NO — zero references repo-wide** | yes | **no** | see §8.1 |
| `@testing-library/dom` | (not in `package.json`) | `10.4.2` | transitively | yes | **no** | auto-installed optional peer of `@testing-library/react@16`; recorded with `resolved`+`integrity`, so `npm ci` reproduces it deterministically. Verified by real `npm ci`. |

**Version-pinning style — consistent.** Every pre-existing entry in `web/package.json` uses a caret
(`^18.3.1`, `^18.3.12`, `^4.3.4`, `^5.6.3`, `^5.4.11`, `^2.1.8`). The three additions use carets
(`^16.3.3`, `^14.6.7`, `^29.1.1`). Alphabetical ordering within `devDependencies` is also preserved.
**No style violation.**

**`npm ls` — clean, fully deduped:**

```
├─┬ @testing-library/react@16.3.3
│ └── @testing-library/dom@10.4.2
├─┬ @testing-library/user-event@14.6.7
│ └── @testing-library/dom@10.4.2 deduped
├── jsdom@29.1.1
└─┬ vitest@2.1.9
  └── jsdom@29.1.1 deduped
exit=0
```

**`npm audit` — zero new vulnerabilities.** Compared the JSON vulnerability *sets*, not just the
summary line, against the baseline lockfile (`1c075b3`-era `package.json` + HEAD
`package-lock.json` copied to `/tmp/imp005-verify/baseline-audit`, audited with
`npm audit --package-lock-only`):

```
=== CURRENT (post-IMP-005) ===
moderate  @vitest/mocker <- vitest                    critical  vitest <- direct
moderate  esbuild       <- vite                      high      vite <- @vitest/mocker,vite-node,vitest
moderate  vite-node     <- vitest
totals: {"info":0,"low":0,"moderate":3,"high":1,"critical":1,"total":5}

=== BASELINE (HEAD lockfile) ===
moderate  @vitest/mocker <- vitest                    critical  vitest <- direct
moderate  esbuild       <- vite                      high      vite <- @vitest/mocker,vite-node,vitest
moderate  vite-node     <- vitest
totals: {"info":0,"low":0,"moderate":3,"high":1,"critical":1,"total":5}

=== NAMES DIFF ===
new in current: []
gone from current: []
identical: true
```

Exactly PE-1, no more, no less. None of `jsdom`, `@testing-library/react`,
`@testing-library/user-event`, or `@testing-library/dom` appears in either set.

---

## 8. Findings — non-blocking

### 8.1 `@testing-library/user-event@^14.6.7` is installed but imported nowhere — MEDIUM (documentation/hygiene)

```
$ grep -rn "user-event\|userEvent" web/src web/index.html web/vite.config.ts
NOT IMPORTED ANYWHERE (installed but unused)
```

This is a genuine unused dependency and a real supply-chain cost for a repo whose profile (§6)
treats gratuitous dependencies as a permanent security-surface change to a static site. **However,
the spec itself contradicts on this point**, and the implementer documented the conflict rather than
hiding it:

- **Acceptance criterion 1** names all three packages explicitly as required.
- **The item's Notes** say: *"If `@testing-library/user-event` proves unnecessary for the first
  smoke test, drop it rather than carrying an unused dep."*

Criterion 1 is the graded contract, so keeping it is defensible. **I am not scoring this as a
criterion failure**, but it should be closed out one way or the other rather than left dangling:

- either `cd web && npm uninstall --save-dev @testing-library/user-event` (one command, plus lockfile
  regen; nothing references it — confirmed), or
- have IMP-037's `PaperCard` test use it, so it earns its place.

The implementer already stated the remedy (`impl-IMP-005.md` §3, Caveat). Recommended: **drop it
now** — it is unused at the moment criterion 1 is graded, and a future item re-adding it costs one
command anyway. Low stakes either way.

### 8.2 `jsdom@29` engine floor sits above a bare `node-version: "20"` — LOW (latent, cannot fire today)

`jsdom@29.1.1` declares `engines: {"node":"^20.19.0 || ^22.13.0 || >=24.0.0"}`.
Both `.github/workflows/ci.yml:30` and `.github/workflows/deploy.yml:38` request
`node-version: "20"`, which `actions/setup-node` resolves to the newest 20.x — satisfied today.
Mitigations: no `.npmrc`, no `engine-strict` (verified), so a mismatch degrades to an `EBADENGINE`
*warning*, never a failed install. **I could not verify this empirically** — the machine only has
Node 25.6.1; the `node@20/21/22` Homebrew kegs are symlinks into the 25.6.1 Cellar. This is an
honest gap in the evidence. Belongs to a CI-hardening item (PE-10 already flags the floating
`node-version`), not to IMP-005. Remedy if ever needed: `npm install --save-dev jsdom@^26`
(declares `node >=18`); nothing else in the change depends on jsdom 29.

### 8.3 New top-level test directory deviates from the profile's mirror convention — LOW (style)

`web/src/__tests__/` is new. Profile §5.3 documents tests as `web/src/lib/__tests__/<module>.test.ts`
mirroring modules 1:1, and §6 says *"Don't rename files, move modules, or restructure directories as
a side effect of a feature change."* This file is neither a rename nor a restructure — it is a new
environment smoke test with no module to mirror — so it does not violate the rule. But it establishes
a second test-location convention that the profile does not yet bless. **Recommend updating
`.improve/REPO_PROFILE.md` §5.3** to acknowledge `web/src/__tests__/` for non-mirrored tests.

### 8.4 Smoke test couples to `PaperCard` markup — LOW (future brittleness)

`domEnvironment.test.tsx:29-30,34,36` assert `getByRole("heading", …)` and
`querySelectorAll("article.paper")`, i.e. `PaperCard`'s root element and tag
(`PaperCard.tsx:61`, `:63`). If `PaperCard`'s markup is refactored, this *environment* test fails for
reasons unrelated to the DOM. It also makes the test partly a `PaperCard` test, blurring the IMP-037
boundary the implementer was careful to respect. Consider scoping to
`expect(document.body.children).toHaveLength(n)` if the intent is purely environmental.

### 8.5 Test wall-clock and setup coupling — INFORMATIONAL

`setup 490ms`, `environment 2.56s`; suite 0.31 s → 1.19 s. `test-setup.ts` imports
`@testing-library/react` for *every* file, including the three pure-logic suites that never touch a
DOM. Irrelevant at 42 tests. A two-project split (`node` for `lib/**`, `jsdom` for the rest) is the
fix if it ever matters — and `impl-IMP-005.md` §2.2 has already established that the lib suites are
environment-agnostic, so the split is free whenever wanted.

### 8.6 Comment in `test-setup.ts` — NOT A DEFECT

`web/src/test-setup.ts:4-8` is a 5-line JSDoc block in a 9-line file. Profile §5.1 forbids comments
"unless genuinely needed" but sanctions rationale-comments as the exception. This one explains *why*
(`globals: false` breaks RTL's auto-cleanup) — exactly the sanctioned category. No action.

### 8.7 Stale backlog premise — CONFIRMED, correctly reported not fixed

`.improve/FEATURES.md` (fixture-contract item, ~line 1662) justifies `node:fs` with
*"legal because `vite.config.ts:8` sets `environment: \"node\"`"* — now false. I independently
verified the item is still implementable: experiment B showed the 39 lib tests pass under **both**
environments, so `node:fs` remains importable under jsdom. Correctly reported in
`.improve/reports/discovered-IMP-005.md` §1 rather than silently edited.

---

## 9. Observation: should `vitest` be upgraded? — NOT a defect of IMP-005

`vitest@2.1.9` is the sole **critical** advisory (Vitest UI arbitrary file read/execute,
GHSA-5xrq-8626-4rwp / GHSA-82fw-gwwq-j7x9) and the root of the other four (`@vitest/mocker`
moderate, `vite` high, `vite-node` moderate, `esbuild` moderate). All are dev-server/test-runner
only and **none reach the Pages bundle** (proved in §4).

- `npm audit fix --force` wants `vitest@4.1.11` — **two majors**, and profile PE-2 is explicit:
  *"Every major bump is a breaking change — do not batch them."*
- Correctly out of scope here. IMP-005 is a tooling-enablement item and touching the runner would
  multiply its risk without serving any acceptance criterion.
- **Forward-looking coupling worth noting:** `vitest@2.1.9` declares `jsdom: "*"` as an *optional*
  peer (`node_modules/vitest/package.json`), so there is no hard version coupling today. But a future
  vitest 3/4 bump will re-resolve `jsdom` and `@testing-library/react` in a lockfile that now
  contains them. Whichever item does the vitest upgrade must re-run `npm ci --dry-run`, `npm audit`,
  and the full suite, and must not assume this lockfile survives untouched.
- Recommend a dedicated item: pin `node-version` explicitly (PE-10), then upgrade vitest alone.

---

## 10. Claims audited vs. verdicts

| Implementer claim | Verdict |
| --- | --- |
| Bundle byte-identical to baseline | **TRUE** — proven by building HEAD sources and `cmp`-ing (identical sha256). |
| 39 pre-existing lib tests pass | **TRUE** — traced across `1c075b3`→`0beec1b`→`768a5ae`→`24beb16`; spec's "36" is stale. |
| 42 total tests | **TRUE** — 4 files, 42 passed, exit 0. |
| Lockfile regenerated, never hand-edited | **TRUE** — 706 insertions / 0 deletions, all new entries carry `resolved`+`integrity`. |
| `npm ci --dry-run` clean | **TRUE** — exit 0; plus a real `npm ci` also exit 0. |
| Audit unchanged from PE-1 | **TRUE** — vulnerability name sets `identical: true`. |
| Smoke test fails under `node` | **TRUE** — reproduced independently (3/3 fail). |
| Widened `include` is load-bearing | **TRUE** — reproduced independently (`.tsx` not collected). |
| `setupFiles` needed because `globals: false` | **TRUE** — reproduced independently (test 3 fails without it). |
| `@testing-library/user-event` unimported | **TRUE** — zero references repo-wide (§8.1). |
| No existing test weakened/skipped/deleted | **TRUE** — all three files byte-identical to HEAD; no `.skip`/`.only`/`.todo`. |

---

## 11. Verdict

**PASS — 3/3 acceptance criteria met.**

Criterion 1 MET (three devDependencies, lockfile purely additive and `npm ci`-reproducible, all
`dev: true`, no runtime dep added, caret style consistent). Criterion 2 MET verbatim, plus a
`setupFiles` line I proved necessary. Criterion 3 MET in substance: all 39 pre-existing tests pass
and are byte-identical to HEAD with nothing weakened, skipped, or excluded; total is 42, a documented
+3 that the verifier brief mandated and the spec's stale "36" contradicted.

"No runtime behaviour change" is **proven, not asserted**: the pre- and post-change bundles are
byte-identical (same sha256, same content-derived filenames, same 38 modules), and neither `jsdom`,
`test-setup.ts`, nor any `@testing-library/*` package appears anywhere in `web/dist/`.

**Zero new vulnerabilities** (audit name sets identical to baseline), **no version drift** in any
pre-existing package, and the dependency tree is fully deduped.

None of §8.1–§8.7 should block the commit. The one item worth an explicit decision is **§8.1**
(`@testing-library/user-event` unused) — spec criterion 1 mandates it while the item's Notes tell
you to drop it; the implementer chose criterion 1 and documented the conflict, which is a
reasonable resolution, but it should be closed out rather than left in limbo.