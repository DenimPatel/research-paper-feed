# Verify IMP-041 — Add a quality gate to the deploy `build` job

**Verified 2026-10-03** against working tree `improve/auto-20261002` at `c1a89bd`, unstaged changes.
Verifier is independent of the implementer. Scratch copy for destructive experiments:
`/tmp/imp041-verify` (rsync of the working tree; `deploy.yml` sha256 verified identical to the
real one before any mutation). **No git write command was run in the repo** — no `restore`,
`checkout`, `clean`, or `stash`. Every mutation below happened in `/tmp/imp041-verify`.

**VERDICT: PASS** (3/3 criteria met; 4 minor non-blocking findings)

---

## 0. Executive summary

The change does what the spec asks. Both gates are in the right place in the right order, both
`run:` scalars are byte-identical to their `ci.yml` counterparts (verified by parsing, not by
eye), `npm run lint` was correctly *not* added, `concurrency.cancel-in-progress: false` is intact,
and the `setup-node` / `npm ci` reorder is **necessary, not optional** — I proved by experiment
that `npm run typecheck` exits **127** without `web/node_modules`.

The gates are **non-vacuous**: I made each one fail in a `/tmp` copy and watched the deploy job
abort before `Build the paper index`, before `npm run build`, and before the Pages upload. A full
green end-to-end replay of all twelve steps also passes.

D-1 (nothing pins the duplication) is **real and I reproduced it** — deleting both gate steps
leaves Python at 104/104 OK and the web suite at 292/292 green. But the item as specified does
**not** require a pin, so this does not fail the item. See §5.

---

## 1. Scope, and what actually changed

```
$ git -C /Users/denimpatel/Desktop/git/research-paper-feed diff --stat
 .github/workflows/deploy.yml |  56 +++++++++++++++++++++++++++++++++----------
 images/feed_example.png      | Bin 465201 -> 112406 bytes
 2 files changed, 44 insertions(+), 12 deletions(-)
```

Two files differ. **Only `deploy.yml` is IMP-041's work.** The PNG is IMP-030's:

- `images/feed_example.png` mtime `Oct 3 06:05`; `.improve/reports/impl-IMP-030.md` documents
  exactly `Bin 465201 -> 112406 bytes` (mtime 06:07).
- `.improve/reports/impl-IMP-041.md` is timestamped `05:43` — **before** the PNG changed.

So `impl-IMP-041.md` §0's "`Nothing else`… `git diff --stat` reports `1 file changed, 44
insertions(+), 12 deletions(-)`" was **true when written**. Flagging only because the sentence is
now stale and a reviewer diffing today sees `2 files changed` (see Finding 1).

Within `deploy.yml` the diff is three hunks and nothing else:

| Hunk | Nature |
| --- | --- |
| Job-header comment `:23-26` | rewording so the enumeration stays truthful |
| New block above `Install Python dependencies` | `setup-node` (moved), `Run Python tests` (new), `Install web dependencies` (moved), `Typecheck` (new) |
| Deleted block below `Build the paper index` | `setup-node` + `Install web dependencies` originals |

The two deleted blocks and their added replacements are **byte-identical in content** — only
position changed. Confirmed by parsing both revisions (§6).

**No scope creep, no debug leftovers, no secrets.** Scanned every added line for
`token|secret|key|password|console.log|print(|TODO|FIXME|XXX|DEBUG|bypass`:

```
$ git diff -U0 .github/workflows/deploy.yml | grep '^+' | grep -viE '^\+\+\+' \
    | grep -inE "token|secret|key|password|console\.log|print\(|TODO|FIXME|XXX|DEBUG|bypass"
none found
```

Hygiene: 0 trailing-whitespace lines, 0 tab characters, all 44 added lines ≤ 80 columns, file ends
in a newline. `actionlint` / `yamllint` are not installed on this host, so YAML validity was
checked with PyYAML instead (§6).

---

## 2. Criterion 1 — step order. **MET**

### 2.1 `cat -n .github/workflows/deploy.yml`, top to bottom

```
    16  concurrency:
    17    group: pages
    18    cancel-in-progress: false
    20  jobs:
    21    build:
    22      runs-on: ubuntu-latest
    27      timeout-minutes: 90
    28      steps:
    29        - uses: actions/checkout@v4
    31        - uses: actions/setup-python@v5
    35        - uses: actions/setup-node@v4          <- moved up
    41        - name: Install Python dependencies
    42          run: pip install -r requirements.txt
    44        - name: Run Python tests               <- NEW GATE
    54          run: python -m unittest discover -s tests -v
    56        - name: Install web dependencies       <- moved up
    62          run: npm ci
    64        - name: Typecheck                      <- NEW GATE
    77          run: npm run typecheck
    79        - name: Build the paper index
   116          timeout-minutes: 75
   117          run: python scripts/build_index.py --max-per-category 30000
   119        - name: Build the web app
   126          run: npm run build
   128        - name: Assert the paper index reached the build output
   181        - uses: actions/configure-pages@v5
   183        - uses: actions/upload-pages-artifact@v3
   187    deploy:
   188      needs: build
   193      timeout-minutes: 15
```

Order is exactly as required: **gates (`:44`, `:64`) → `Build the paper index` (`:79`) →
`npm run build` (`:126`)**.

### 2.2 Both gates actually gate — proven by failure, not asserted

I built `/tmp/imp041-verify/replay_deploy.py`, which parses `deploy.yml` and replays the `build`
job's steps in order under GitHub's fail-fast rule (a non-zero `run` aborts the job; later steps
never execute). It is an emulation of the one property under test, **not** a GitHub Actions
emulator — stated here so the evidence is not over-read. `uses:` steps are reported as NOOP. The
two dependency-install steps are stubbed because local `pip install` is blocked by PEP 668 (see
§7); both are pre-existing steps that this item did not touch.

**Negative control A — failing Python test.** Added
`tests/test_zz_deliberate_failure.py` containing a real `unittest.TestCase` that asserts `1 == 2`:

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
FAIL: test_a_failing_test_proves_the_deploy_gate_gates (test_zz_deliberate_failure...)
Ran 105 tests in 1.120s
FAILED (failures=1)
```

```
$ /usr/local/bin/python3.11 replay_deploy.py
[4] RUN    Run Python tests   (cwd=.)
        $ /usr/local/bin/python3.11 -m unittest discover -s tests -v
        -> EXIT 1  ** JOB FAILED HERE **

build job: FAILED at step 4 (Run Python tests)
steps that NEVER executed: ['Install web dependencies', 'Typecheck', 'Build the paper index',
  'Build the web app', 'Assert the paper index reached the build output',
  'actions/configure-pages@v5', 'actions/upload-pages-artifact@v3']
deploy job needs: build -> blocked: build did not succeed, so actions/deploy-pages@v4 does not run
```

**Negative control B — failing typecheck.** Added `web/src/__typecheck_probe.ts` with
`export const probe: number = "this is a string, not a number";`. First confirmed the file is
inside the project (`tsconfig.json` → `include: ["src", "vite.config.ts"]`), so this is not a
file `tsc` ignores:

```
[6] RUN    Typecheck   (cwd=web)
        $ npm run typecheck
        > tsc --noEmit
        src/__typecheck_probe.ts(1,14): error TS2322: Type 'string' is not assignable to type 'number'.
        -> EXIT 2  ** JOB FAILED HERE **

build job: FAILED at step 6 (Typecheck)
steps that NEVER executed: ['Build the paper index', 'Build the web app',
  'Assert the paper index reached the build output',
  'actions/configure-pages@v5', 'actions/upload-pages-artifact@v3']
deploy job needs: build -> blocked: build did not succeed, so actions/deploy-pages@v4 does not run
```

Both gates are real. Neither `continue-on-error`s, neither is skipped, and `actions/deploy-pages@v4`
never runs. `TS2322` is a genuine type error caught by a genuine non-zero `tsc` exit.

### 2.3 No escape hatches

Parsed every step of every job in `deploy.yml` for `continue-on-error`, `if:`, `|| true`:

```
escape hatches: []
```

Also confirmed no duplicate `uses:` in a single job (`build` uses are exactly
`checkout, setup-python, setup-node, configure-pages, upload-pages-artifact`; `duplicates: none`).

---

## 3. Criterion 2 — byte-identical commands, and `lint` absent. **MET**

Extracted programmatically with PyYAML (6.0.1, `/usr/local/bin/python3.11`) by comparing the
parsed `run:` scalars — **not** by eyeballing:

```
$ /usr/local/bin/python3.11 - <<'PY'
... ci_py = [s['run'] for s in ci['jobs']['python-tests']['steps'] if ...]
... dp_py = [s['run'] for s in dp['jobs']['build']['steps'] if ...]
... print("BYTE-IDENTICAL python:", ci_py == dp_py and len(ci_py)==1 and len(dp_py)==1)
... print("BYTE-IDENTICAL typecheck:", ci_tc == dp_tc and len(ci_tc)==1 and len(dp_tc)==1)
PY

ci  python scalar repr: ['python -m unittest discover -s tests -v']
dp  python scalar repr: ['python -m unittest discover -s tests -v']
BYTE-IDENTICAL python: True
ci  typecheck repr: ['npm run typecheck']
dp  typecheck repr: ['npm run typecheck']
BYTE-IDENTICAL typecheck: True

deploy runs mentioning lint: []
ci runs mentioning lint: []
```

Each string occurs **exactly once** in each file, so the equality is not satisfied by an empty
list. No trailing space, no quoting difference, no `--` flag difference.

**Commands exist.**
- `typecheck` is a real script at `web/package.json:12` (counted: line 12 of the file is
  `"typecheck": "tsc --noEmit"`).
- `python -m unittest discover -s tests -v` is stdlib `unittest` only. The suite is hermetic: no
  live network (loopback `socket` servers at `tests/test_arxiv_common.py:238`, fake `iter_results`
  in `tests/test_build_index.py`), no `subprocess` calls anywhere in `tests/`.
- **`npm run lint` was NOT added** — `deploy runs mentioning lint: []`, and `web/package.json`
  still has no `lint` key. Criterion 2's prohibition respected in both directions: no lint step
  in the workflow and no lint script invented to justify one.

### 3.1 The spec's own line reference is wrong, and the implementer corrected it

The spec (`.improve/FEATURES.md`, IMP-041 criterion 2) says `typecheck` must be
"byte-identical to `ci.yml:36`". **`ci.yml:36` is not the typecheck step.** Actual `ci.yml`:

```
    35      - name: Install dependencies
    36        working-directory: .
    37        run: pip install -r requirements.txt
    ...
    45      - name: Typecheck
    46        run: npm run typecheck
```

The real typecheck is `ci.yml:45-46`. Taking `ci.yml:36` literally would have required making the
deploy's gate string `pip install -r requirements.txt` — duplicating a step that already exists at
`deploy.yml:41-42` and gating nothing. The implementer matched the **actual command** and cited
`ci.yml:46` (`impl-IMP-041.md` §2, and the in-file comment at `deploy.yml:65`). That is the correct
reading; the spec's pointer is stale drift, the same class of drift as criterion 3's `:33`/`:48`,
which the implementer also flagged. The spec's `ci.yml:19` for the Python command **is** correct.

Note also that the byte-identity is preserved while the *working directory* is expressed
differently: `ci.yml`'s `web-tests` job supplies it via `defaults.run.working-directory: web`
(`ci.yml:27-29`), whereas `deploy.yml`'s `build` job has **no** `defaults` block and so uses a
per-step `working-directory: web` — the pattern every other web step in `deploy.yml` already
uses. Confirmed: `deploy build defaults.run: None`.

---

## 4. Criterion 3 and the notes. **MET**

| Requirement | Status | Evidence |
| --- | --- | --- |
| `concurrency.cancel-in-progress: false` intact | **MET** | parsed: `{'group': 'pages', 'cancel-in-progress': False}`; `deploy.yml:16-18` appears in no diff hunk |
| No `continue-on-error` | **MET** | `escape hatches: []` across all steps of both jobs |
| No `\|\| true` | **MET** | same parse; the only `run:` block (`Assert the paper index…`) contains `set -euo pipefail`, which *tightens* failure, pre-existing |
| Deploy job's own `timeout-minutes: 15` untouched | **MET** | `deploy.yml:193` = 15, unchanged; no diff hunk reaches it. `build` job 90 and index step 75 also unchanged |
| `Build the paper index` before `npm run build` | **MET** | index at step 7, web app at step 8 |
| No new `timeout-minutes` | **MET** | only `90` and `75` present. Matters: `tests/test_arxiv_common.py:361` rejects any cap ≤ 360 s |

Criterion 3's literal line numbers (`:33`, `:48`) do not match the file (they are `:79` and `:126`).
As with `ci.yml:36`, these are pre-existing drift in the spec text; the requirement is ordering,
and ordering is met. The implementer flagged this explicitly in §3 of the report rather than
silently reinterpreting it.

---

## 5. Non-vacuity: the gates work; D-1 is real but out of scope

### 5.1 The gates are non-vacuous — demonstrated, not asserted

Beyond the two negative controls in §2.2 (each gate observed **failing** and observed halting
publication) and the green full run in §6.4, there is a further point worth recording: `unittest
discover` really does collect this suite. My first negative control was **invalid** and I am
recording it so nobody mistakes it for a near-miss: I initially wrote the failing case as a plain
class `class DeliberateFailure:` with a method, and `Run Python tests` exited **0** — correctly,
because `unittest` only collects `TestCase` subclasses. Rewritten as a real `TestCase`, discovery
went 104 → 105 tests and `FAILED (failures=1)`. Nothing about the workflow was wrong; the
demonstration was. The corrected runs are the ones quoted in §2.2.

### 5.2 D-1 reproduced: deleting the gates is completely silent

In `/tmp/imp041-verify` I deleted both gate steps (35 lines) from `deploy.yml`. The file still
parses and still runs the index build:

```
$ grep -cE "python -m unittest discover|npm run typecheck" .github/workflows/deploy.yml
0
$ /usr/local/bin/python3.11 -c "import yaml; ... print([...steps...])"
valid YAML, steps: ['actions/checkout@v4', 'actions/setup-python@v5', 'actions/setup-node@v4',
  'Install Python dependencies', 'Build the paper index', 'Build the web app',
  'Assert the paper index reached the build output', 'actions/configure-pages@v5',
  'actions/upload-pages-artifact@v3']

$ /usr/local/bin/python3.11 -m unittest discover -s tests
Ran 104 tests in 1.107s
OK

$ cd web && npm test
 Test Files  19 passed (19)
      Tests  292 passed (292)
```

**D-1 is accurate.** Nothing in the shipped suites fails when the duplication is removed.

### 5.3 Does this item require a pin? — No, and the omission is defensible

Reading the spec strictly, the three acceptance criteria constrain the **contents and ordering of
one YAML file**:

1. the two gates run before `Build the paper index`, before `npm run build`;
2. every referenced command exists, and `npm run lint` specifically must not be added;
3. `cat -n` shows the ordering.

The stated **Verification method** is `cat -n` plus two local command runs — a manual inspection,
which by construction cannot fail later. `Effort: S` and the intent paragraph both frame the change
as "two `run:` lines in one YAML file". **No criterion says a test must fail if the step is
removed**, and the item's `Area / files` names only `.github/workflows/deploy.yml`.

So a pin is not required, and adding one would have been scope creep into `tests/` — which is
precisely the judgement the implementer made and documented. **This does not fail IMP-041.**

It is, however, a genuine regression risk with a strong in-repo precedent: `web/src/__tests__/
indexGuardRegistration.test.ts` exists because a deleted `test.include` glob left `npm test` green
with 23 tests silently dropped (IMP-028c), and `DeployStepCommandTests` / `DeployStepTimeoutTests`
exist because the deploy's index command and cap were unpinned (IMP-028/029). D-1 names the fix
precisely — a `DeployQualityGateTests` asserting both `run:` strings are present in the `build`
job and that both line numbers are **less than** the `build_index.py` line — and estimates it at
~30 lines of text parsing in the style already present. **Recommendation: raise D-1 as its own
backlog item rather than reopening IMP-041.**

---

## 6. Whole-system coherence — verified independently

### 6.1 Python suite, in the real working tree

```
$ cd /Users/denimpatel/Desktop/git/research-paper-feed
$ /usr/local/bin/python3.11 -m unittest discover -s tests
----------------------------------------------------------------------
Ran 104 tests in 1.121s

OK
PY_EXIT=0
```

104 tests, matching the profile's §3.2 baseline. (`-v` omitted here for brevity; the verbose run
in §2.2 shows the same 104.) Run from the repo root, which is what the step's implicit working
directory is — `deploy.yml`'s `build` job sets no `defaults.run`, so GitHub's default
`$GITHUB_WORKSPACE` applies, matching `ci.yml`'s `python-tests` job.

### 6.2 Typecheck, in the real working tree

```
$ cd web && npm run typecheck
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit

TC_EXIT=0
```

Exit 0, no output — the documented clean result (profile §3.3).

### 6.3 YAML validity and step order, parsed from the real working tree

```
$ /usr/local/bin/python3.11 -c "import yaml; ..."
  0 actions/checkout@v4
  1 actions/setup-python@v5
  2 actions/setup-node@v4
  3 Install Python dependencies
  4 Run Python tests
  5 Install web dependencies
  6 Typecheck
  7 Build the paper index
  8 Build the web app
  9 Assert the paper index reached the build output
 10 actions/configure-pages@v5
 11 actions/upload-pages-artifact@v3
ORDER OK: gates (4, 6) < index 7 < web app 8
concurrency: {'group': 'pages', 'cancel-in-progress': False}
build timeout: 90 | deploy timeout: 15 | index step cap: [75]
```

Valid YAML; ordering is exactly what the diff claims.

**Two environment notes for the record.** PyYAML 6.0.1 is installed for `/usr/local/bin/python3.11`
but **not** for the Homebrew `python3` (3.14.3) on this host:

```
$ /opt/homebrew/bin/python3 -c "import yaml"
ModuleNotFoundError: No module named 'yaml'
$ /usr/local/bin/python3.11 -c "import yaml; print(yaml.__version__)"
yaml ok 6.0.1
```

I used 3.11 for all YAML parsing. Separately, **the shipped tests must not depend on PyYAML** —
confirmed: `grep -rn "import yaml|yaml.safe_load" tests/ web/scripts/ web/src/` finds nothing, so
both suites stay stdlib/Node-only. PyYAML was used for *my* verification only, never shipped.

### 6.4 Full green end-to-end replay of the deploy `build` job

```
$ /usr/local/bin/python3.11 replay_deploy.py
[4] RUN    Run Python tests        -> EXIT 0     (Ran 104 tests in 1.103s / OK)
[6] RUN    Typecheck               -> EXIT 0
[7] RUN    Build the paper index   -> EXIT 0     (live arXiv build, 9 shards)
[8] RUN    Build the web app       -> EXIT 0
[9] RUN    Assert the paper index reached the build output -> EXIT 0
      Paper index present: 9 shard(s).
[10] NOOP  actions/configure-pages@v5
[11] NOOP  actions/upload-pages-artifact@v3
build job: SUCCEEDED through all steps -> upload-pages-artifact would run -> deploy job runs
```

This ran the real `build_index.py` against the live arXiv API and the real `vite build`. The
ordering change does not break the happy path.

---

## 7. The design choice: is the reorder correct, necessary, and minimal?

### Necessary — proven

`npm run typecheck` is `tsc --noEmit`. With `web/node_modules` moved aside:

```
$ cd web && mv node_modules node_modules.bak && npm run typecheck
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit
sh: tsc: command not found
EXIT_WITHOUT_NODE_MODULES=127
$ mv node_modules.bak node_modules && npm run typecheck
EXIT_WITH_NODE_MODULES=0
```

`which tsc` → *not found* on this host, so `tsc` resolves only from `web/node_modules`. Since
criterion 1 puts the gate above `Build the paper index`, and the install used to sit *below* the
index build, the install had to move. **The reorder is forced, not stylistic.** The implementer's
reasoning in report §5 is correct.

The rejected alternative is also correctly rejected: `GitHub Actions rejects a duplicated `uses:`
in one job` is **true** — parsed, `duplicates: none` for both jobs, so a second `setup-node` was
never an option; and a second bare `npm ci` would have doubled a ~30 s install.

### Correct — nothing broken

- `npm ci` does not clobber the index output directory. Verified with a sentinel:
  `web/public/data/PROBE_SENTINEL.json` survived `npm ci` (exit 0) alongside the existing shards,
  and `web/package.json` has **no** `preinstall`/`install`/`postinstall`/`prepare` lifecycle
  script that could do so. The index step also runs *after* `npm ci` now, so its output cannot be
  wiped regardless.
- The index build reads only `scripts/`, `requirements.txt`, and the arXiv API, and runs from the
  repo root either way — confirmed by the green step 7 above.
- `pip install -r requirements.txt` still precedes the Python gate (`:41` before `:44`), and
  `python -m unittest discover` needs only stdlib besides it.
- Cache behaviour is unchanged: `cache: npm` + `cache-dependency-path: web/package-lock.json`
  moved verbatim, and `setup-node` still runs after `actions/checkout`.

### Minimal? — Functionally yes; verbose in commentary

The functional change is the minimum the criteria permit: two new steps, two moved steps. But
**26 of the 44 added lines are explanatory comments** (~2.4× the functional lines), which the
report does not quantify.

That said, this matches the file's established house style — `Build the paper index` already
carries a 30-line comment (`:80-115`) justifying its cap and its `--max-per-category`, and
`Assert the paper index…` carries 22 more. Comment density of this kind is the local convention,
so this is **verbosity, not scope creep**, and the content is accurate rather than restating the
obvious. Noted for the record only; I would not ask for it to be cut.

The one-line comment rewrite at `:23-26` is justified: the old text enumerated "checkout, both
dependency installs, the npm build and the Pages artifact upload" and would have been silently
wrong once two steps were inserted into that list. Notably the implementer **carried the original
`~120 s on CI` forward rather than inventing a new total** — correct under the profile's
evidence rules, since the gates were never timed on a real runner.

---

## 8. Risk assessment — the spec's `Risk: med`

**Added path length: acceptable.** Measured locally across five runs: Python suite 1.103–1.143 s
(`Ran 104 tests`), `tsc --noEmit` ~2 s. The `build` job's `timeout-minutes: 90` with the index
step's `75` still leaves ~15 minutes for everything else, and the comment keeps the original
`~120 s on CI` plus "a few seconds per gate". No unmeasured total is quoted anywhere. Even at a
10× pessimism (Python ~11 s, typecheck ~20 s on a cold runner) the added cost is well under a
minute against ~15 minutes of headroom. **Acceptable.**

**Flake risk: lower than the item assumes.** The suite is hermetic — no live network
(loopback `socket` servers at `tests/test_arxiv_common.py:238-272`, fake `iter_results` in
`tests/test_build_index.py`), no `subprocess`, 1.1 s wall clock, no timing assertions of its own
beyond a 0.05 s socket timeout used *against itself*. A network blip cannot redden it. So the
"slow or flaky suite blocks publication" risk is real in principle but low in fact. Note the
honest corollary the implementer got right in report §7: **nothing here retries or tolerates a
flake** — no `continue-on-error`, no `|| true` — which is the correct posture for a gate.

**`concurrency` still prevents overlapping deploys: yes.** `group: pages`,
`cancel-in-progress: false` means a second `push`/`schedule` run **queues** rather than cancelling
the in-flight one. The gates run inside each queued run, so a red gate blocks *that* run's
publication without disturbing a deploy already in progress — precisely the intended semantics. The
block is untouched by this change (not in any diff hunk), so the new gates inherit it rather than
bypassing it. The separate `deploy` job's `timeout-minutes: 15` (`:193`) is the backstop against a
wedged publication blocking the queue forever, and it is unchanged.

**Floating `python-version: "3.x"` — the report slightly overstates this.** Report §7 presents the
float as a risk the *gate* introduces. It does not: `ci.yml:15` and `ci.yml:34` both use
`python-version: "3.x"` too, so a 3.14-only failure turns CI red and the deploy red **at the same
time**, from the same commit. The deploy gate adds no Python-version risk that CI does not already
carry, and it *reduces* total exposure by refusing to publish what CI would have rejected. The
underlying float is real and is IMP-097 / IMP-209's to pin. (Locally I could not test under 3.14:
`/opt/homebrew/bin/python3 -c "import arxiv"` → `ModuleNotFoundError`.)

---

## 9. Findings

**No blocking issues.** Four non-blocking findings, in priority order:

### Finding 1 — `impl-IMP-041.md` §0's "Nothing else" is now stale (documentation)
`git diff --stat` today reports `2 files changed`; `images/feed_example.png`
(`Bin 465201 -> 112406 bytes`) is also modified. **This is not IMP-041's change** — the PNG's
mtime (06:05) postdates the report (05:43) and `impl-IMP-030.md` documents that exact byte delta.
**Action:** none for IMP-041. Do not attribute the PNG to this item, and do not revert it; it is
IMP-030's work in the same working tree.

### Finding 2 — the report never states plainly that it overrode the spec's `ci.yml:36`
The implementer used `ci.yml:46` (correct — `:36` is `working-directory: .`) and cited it in §2 and
in the `deploy.yml:65` comment, but a reviewer cross-checking against the spec will see a
mismatch and has to re-derive the reasoning. **Action:** in the final/state report, note in one
line that IMP-041's criterion-2 pointer `ci.yml:36` is stale and `:46` is the real typecheck line.

### Finding 3 — D-1 should be promoted to its own item
Duplication is unpinned; deleting either gate is silent (§5.2). Out of scope here and correctly
deferred. **Action:** raise `DeployQualityGateTests` as a separate backlog item, per D-1's own
description (~30 lines, text-parsing, same style as `DeployStepCommandTests`).

### Finding 4 — 26 of 44 added lines are comments
Defensible against this file's convention (see §7); recorded so the ratio is on the record.
**Action:** none.

---

## 10. Commands used, and reproducibility

Read-only git in the repo (`git status`, `git diff`, `git log`) only. All mutation in
`/tmp/imp041-verify`. Suite and typecheck runs: ~1.1 s and ~2 s. Longest command was the full
green replay (network index build + `vite build`), well inside the 10-minute cap.

```
rsync -a --exclude '.git' <repo>/ /tmp/imp041-verify/     # scratch copy; deploy.yml sha256 verified identical
/usr/local/bin/python3.11 -m unittest discover -s tests    # 104 tests, OK, exit 0
cd web && npm run typecheck                                # exit 0
/usr/local/bin/python3.11 replay_deploy.py                 # green replay + both negative controls
```

Scratch artifacts left in place for re-inspection: `/tmp/imp041-verify/replay_deploy.py`,
`/tmp/removed_block.txt` (the 35 deleted gate lines), `/tmp/tc_out.txt`.