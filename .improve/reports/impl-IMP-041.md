# IMP-041 — Add a quality gate to the deploy `build` job

**Implemented 2026-10-03.** Working interpreter `/usr/local/bin/python3.11` (3.11.8).
Python suite **104 tests, OK, 1.109 s**, exit 0. `cd web && npm run typecheck` → **exit 0, no
output**. `cd web && npm test` → **19 files / 292 tests passed**, 5.76 s, exit 0.

**No git write command was run.** No `add`, no `commit`, no `checkout`, no `restore`, no `stash`,
no `clean`; read-only `git status` / `git diff` / `git log` only. Nothing was pushed and no branch
was switched. `.kilo/worktrees/mildly-income/` was never read or written.

---

## 0. What changed

| File | Change |
| --- | --- |
| `.github/workflows/deploy.yml` | **+44 / −12.** Two new steps (`Run Python tests`, `Typecheck`) added above `Build the paper index`; `actions/setup-node@v4` and `Install web dependencies` **moved** above them (position only, contents byte-identical); the job-header comment at `:23-26` rewritten to stay truthful. |
| `.improve/reports/impl-IMP-041.md` | this report |
| `.improve/reports/discovered-IMP-041.md` | new — problems found while working, not fixed |

**Nothing else.** `ci.yml`, `web/`, `scripts/`, `tests/`, `readme.md`, `CONTRIBUTING.md`,
`requirements.txt`, `web/package.json` and `.improve/FEATURES.md` are untouched —
`git diff --stat` reports `1 file changed, 44 insertions(+), 12 deletions(-)`.

---

## 1. The diff

```diff
diff --git a/.github/workflows/deploy.yml b/.github/workflows/deploy.yml
index 0ef980e..84e974c 100644
--- a/.github/workflows/deploy.yml
+++ b/.github/workflows/deploy.yml
@@ -21,8 +21,9 @@ jobs:
   build:
     runs-on: ubuntu-latest
     # Job-wide backstop. The index step below may use up 75 of these, leaving
-    # 15 minutes for checkout, both dependency installs, the npm build and the
-    # Pages artifact upload -- together ~120 s on CI, so >7x headroom.
+    # 15 minutes for checkout, both dependency installs, the two quality gates,
+    # the npm build and the Pages artifact upload -- ~120 s on CI plus a few
+    # seconds per gate, so still >7x headroom.
     timeout-minutes: 90
     steps:
       - uses: actions/checkout@v4
@@ -31,9 +32,50 @@ jobs:
         with:
           python-version: "3.x"
 
+      - uses: actions/setup-node@v4
+        with:
+          node-version: "20"
+          cache: npm
+          cache-dependency-path: web/package-lock.json
+
       - name: Install Python dependencies
         run: pip install -r requirements.txt
 
+      - name: Run Python tests
+        # Byte-identical to ci.yml's python-tests job (ci.yml:19), including the
+        # repo-root working directory: this job sets no defaults.run, so the
+        # default applies.
+        #
+        # Duplicated on purpose. A workflow cannot depend on another workflow's
+        # job, so this run cannot see whether CI was green -- which is how a red
+        # main could publish anyway. Repeating the gate above the index build is
+        # the only thing that stops that, so this must stay ABOVE
+        # "Build the paper index".
+        run: python -m unittest discover -s tests -v
+
+      - name: Install web dependencies
+        # Moved above the gates that need it: `npm run typecheck` below runs
+        # against web/node_modules, so the install cannot stay below the index
+        # build. Nothing else moved -- this step and its `uses:` line are
+        # unchanged, only their position.
+        working-directory: web
+        run: npm ci
+
+      - name: Typecheck
+        # Byte-identical to ci.yml's web-tests job (ci.yml:46), which takes its
+        # working directory from that job's defaults.run; deploy.yml has no
+        # defaults.run, so it is spelled out here as every other web step does.
+        #
+        # `npm run typecheck` is `tsc --noEmit` and is the only static analysis
+        # either stack has: there is no lint script in web/package.json and no
+        # Python linter configured, so adding one here would name a command that
+        # does not exist rather than gate anything.
+        #
+        # Deliberately not `npm test`: the 292-test web suite belongs to CI's
+        # web-tests job, and this item is the Python suite plus typecheck.
+        working-directory: web
+        run: npm run typecheck
+
       - name: Build the paper index
         # Same rule as ci.yml's index step: the cap must be looser than the
         # client's worst case, or this dies on GitHub's generic timeout instead
@@ -74,16 +116,6 @@ jobs:
         timeout-minutes: 75
         run: python scripts/build_index.py --max-per-category 30000
 
-      - uses: actions/setup-node@v4
-        with:
-          node-version: "20"
-          cache: npm
-          cache-dependency-path: web/package-lock.json
-
-      - name: Install web dependencies
-        working-directory: web
-        run: npm ci
-
       - name: Build the web app
         # Order matters and is now asserted: the index has to be in
         # web/public/data before this runs, because `vite build` copies that
```

---

## 2. The exact command strings added, and where

| Step | File:line (after this change) | Working directory | `run:` string |
| --- | --- | --- | --- |
| `Run Python tests` | `.github/workflows/deploy.yml:54` | none → repo root (the job sets no `defaults.run`) | `python -m unittest discover -s tests -v` |
| `Typecheck` | `.github/workflows/deploy.yml:77` | `working-directory: web` | `npm run typecheck` |

Source of each string, read from `ci.yml`:

- `python -m unittest discover -s tests -v` — `.github/workflows/ci.yml:19`, step `Run tests` in
  the `python-tests` job. That job has no `defaults.run`, so it runs from the repository root, and
  the deploy `build` job likewise has none, so no `working-directory` key was added.
- `npm run typecheck` — `.github/workflows/ci.yml:46`, step `Typecheck` in the `web-tests` job.
  That job supplies its working directory through `defaults: run: working-directory: web`
  (`ci.yml:27-29`), not through a per-step key. The deploy `build` job has **no** `defaults`
  block, so the string is written with a per-step `working-directory: web` — which is how every
  other web step in `deploy.yml` already does it (`Install web dependencies`, `Build the web app`).

Byte-identity was not eyeballed. Both workflows were parsed with PyYAML and the `run:` scalars
compared as strings:

```
$ /usr/local/bin/python3.11 - <<'PY'   # elided body: load both workflows, collect run: scalars
py  ci: 'python -m unittest discover -s tests -v' == deploy: 'python -m unittest discover -s tests -v' True
tc  ci: 'npm run typecheck' == deploy: 'npm run typecheck' True
ci web-tests defaults.run: {'run': {'working-directory': 'web'}}
deploy build defaults.run: None
deploy has lint step: False
deploy continue-on-error/||true: []
```

Both comparisons are `True`. The last two lines are the criterion-2 and criterion-4 checks:
**no `lint` step exists**, and **no step gained `continue-on-error` or `|| true`**.

---

## 3. `cat -n .github/workflows/deploy.yml` — step order

The steps of the `build` job, with the line numbers the file carries today:

```
    27:    timeout-minutes: 90
    29:      - uses: actions/checkout@v4
    31:      - uses: actions/setup-python@v5
    35:      - uses: actions/setup-node@v4
    41:      - name: Install Python dependencies
    44:      - name: Run Python tests              <-- NEW gate
    54:        run: python -m unittest discover -s tests -v
    56:      - name: Install web dependencies      <-- moved up, unchanged content
    64:      - name: Typecheck                     <-- NEW gate
    77:        run: npm run typecheck
    79:      - name: Build the paper index         <-- must stay below both gates
   116:        timeout-minutes: 75
   117:        run: python scripts/build_index.py --max-per-category 30000
   119:      - name: Build the web app
   126:        run: npm run build
   128:      - name: Assert the paper index reached the build output
   181:      - uses: actions/configure-pages@v5
   183:      - uses: actions/upload-pages-artifact@v3
```

So: gates at `:44` and `:64` → `Build the paper index` at `:79` → `npm run build` at `:126`.
Criterion 3 satisfied (its `:33` / `:48` line numbers are pre-existing drift from this repo's
history; the requirement is the ordering, which is what is measured above).

The same ordering read back out of the parsed YAML, which is what actually executes:

```
$ /usr/local/bin/python3.11 -c "import yaml; ..."   # body elided
job timeout: 90
0 'actions/checkout@v4'                | wd= None   | run= None
1 'actions/setup-python@v5'            | wd= None   | run= None
2 'actions/setup-node@v4'              | wd= None   | run= None
3 'Install Python dependencies'         | wd= None   | run= 'pip install -r requirements.txt'
4 'Run Python tests'                    | wd= None   | run= 'python -m unittest discover -s tests -v'
5 'Install web dependencies'            | wd= 'web'  | run= 'npm ci'
6 'Typecheck'                           | wd= 'web'  | run= 'npm run typecheck'
7 'Build the paper index'               | wd= None   | timeout= 75 | run= 'python scripts/build_index.py --max-per-category 30000'
8 'Build the web app'                   | wd= 'web'  | run= 'npm run build'
9 'Assert the paper index reached the build output' | wd= None | timeout= None
10 'actions/configure-pages@v5'         | wd= None   | run= None
11 'actions/upload-pages-artifact@v3'   | wd= None   | run= None
concurrency: {'group': 'pages', 'cancel-in-progress': False}
```

`concurrency` at `deploy.yml:16-18` is **untouched**: `cancel-in-progress: false` is intact and was
not part of the diff. The `build` job cap `90` and the index step cap `75` are unchanged; **no new
`timeout-minutes` was added anywhere**, which matters because
`tests/test_arxiv_common.py:361 WorkflowTimeoutTests.test_no_workflow_cap_is_tighter_than_the_client_worst_case`
reads every `timeout-minutes:` line in both workflows and fails any cap at or under the 360 s
one-page worst case.

---

## 4. Both commands run locally

### 4.1 The Python suite — the spec's interpreter

```
$ cd /Users/denimpatel/Desktop/git/research-paper-feed
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 104 tests in 1.109s

OK
$ echo $?
0
```

Exit 0, 104 run, 0 failures, 1.109 s — matches the profile's §3.2 baseline (104). Run from the
repository root, which is what the workflow's implicit working directory is.

Three of these tests read `deploy.yml` and all of them still pass, which is the direct check that
moving steps around did not break the ordering assertions already installed over this file:

- `DeployStepCommandTests` (`tests/test_build_index.py:985-1063`) finds the index step by regex
  and reads the comment block between the step's `- name:` and its `run:`. Nothing was inserted
  between `:79` and `:117`, so `_comment_above_the_run_line` still sees only the original comment.
- `DeployStepTimeoutTests.test_the_index_step_outlasts_a_whole_pipeline_failure`
  (`tests/test_build_index.py:1100`) walks backwards from the `run:` line, skipping blanks and
  comments, and requires the first remaining line to be the cap. It still reads `75`.
- `WorkflowTimeoutTests` (`tests/test_arxiv_common.py:346-394`) — unaffected, no cap added.

### 4.2 The typecheck

```
$ cd web
$ npm run typecheck
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit
$ echo $?
0
```

Exit 0, no output, which is the documented clean result (profile §3.3).

### 4.3 Not required, run anyway

`web/scripts/__tests__/indexGuards.test.mjs` reads `.github/workflows/deploy.yml` off disk
(`indexGuards.test.mjs:45`) and asserts that `run: npm run build` precedes
`actions/upload-pages-artifact` with the `web/dist/data` check between them. That file was edited,
so the whole web suite was run to be sure none of those assertions moved:

```
$ cd web && npm test
 ✓ src/lib/__tests__/urlState.test.ts (50 tests) 18ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 137ms
 ✓ src/__tests__/App.relevance.test.tsx (3 tests) 340ms
 ✓ src/__tests__/indexGuardRegistration.test.ts (3 tests) 924ms
 ✓ scripts/__tests__/indexGuards.test.mjs (23 tests) 1636ms
 Test Files  19 passed (19)
      Tests  292 passed (292)
   Duration  5.76s
EXIT=0
```

19 files / 292 tests, matching the profile's §3.3 baseline. The deploy-assertion case
(`has the deploy workflow assert the index after the build and before the upload`) is green.

### 4.4 `typecheck` exists; `lint` does not

```
$ cat web/package.json
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && node scripts/require-index.mjs && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
```

`typecheck` is real (`web/package.json:12`); there is **no `lint` key**, and per criterion 2 none
was added. The deploy workflow now references only commands that exist: `pip install -r
requirements.txt`, `npm ci`, `npm run typecheck`, `npm run build`, `python scripts/build_index.py`,
`python -m unittest discover -s tests -v`, plus the shell/python3 assertion step that was already
there.

---

## 5. Why `setup-node` and `npm ci` moved

This is the one structural consequence worth stating plainly, because it is more than "two `run:`
lines". `npm run typecheck` is `tsc --noEmit`, which resolves `typescript` out of
`web/node_modules`; and `npm ci` sat **below** the index build, at what is now `deploy.yml:56`.
A gate placed above the index build therefore cannot use the install that was below it.

So `actions/setup-node@v4` and `Install web dependencies` were moved up, not rewritten: the diff
shows them as one added block and one deleted block with identical contents, including
`cache: npm` and `cache-dependency-path: web/package-lock.json`. The alternative — a second
`npm ci` above the gate — would have doubled a ~30 s install on every deploy for nothing, and
GitHub Actions rejects a duplicated `uses:` in one job anyway.

Moving them changes nothing about what the index step depends on: it reads only
`scripts/build_index.py`, `requirements.txt` and the arXiv API, and it runs from the repo root
either way.

The job-header comment at `:23-26` was updated in the same commit because it enumerates the steps
in the 15 minutes it leaves over ("checkout, both dependency installs, the npm build and the Pages
artifact upload") and would otherwise have been quietly wrong. The original `~120 s on CI` is
carried forward as-is rather than replaced by a new number — the gates' cost was not measured on
a GitHub runner, and the profile's evidence rules say an unmeasured figure is omitted, not
estimated.

---

## 6. Criteria, one by one

1. **Both gates run before `Build the paper index`.** Measured two ways in §3 — `cat -n` line
   order (`:44`, `:64` → `:79` → `:126`) and the parsed step list. Both command strings are
   byte-identical to `ci.yml`, proven by string comparison in §2.
2. **Every referenced command exists.** `typecheck` at `web/package.json:12`; the Python command is
   stdlib-only `unittest`; `npm run lint` was **not** added and no `lint` script was created —
   criterion 2's prohibition respected in both directions.
3. **`cat -n` shows the new steps ahead of the index build, which stays ahead of `npm run build`.**
   §3.
4. **`concurrency.cancel-in-progress: false` intact; no `continue-on-error`, no `|| true`.**
   Unchanged in the diff, and asserted against the parsed YAML in §2 / §3.

---

## 7. Uncertain, or deliberately not done

- **The web test suite is still not a deploy gate.** `npm test` (292 tests, 5.76 s locally) is not
  run by `deploy.yml`, and criterion 1 names only the Python suite and `npm run typecheck`. So a
  red **web** test on `main` still publishes, and a change that breaks a React component can still
  reach the live site if it was merged without green CI. That is the same class of hole this item
  closes for the other two gates, left open by the item's own scope. Filed in
  `.improve/reports/discovered-IMP-041.md` rather than fixed here. Adding it is a one-line step and
  ~6 s of deploy time — the decision is the reviewer's.
- **`python-version: "3.x"` floats upward** (`deploy.yml:33`, unchanged by this item). The gate now
  runs on whatever the runner picks, so a 3.12/3.13/3.14-only failure would block publication rather
  than pass silently in CI. That is the correct direction for a gate, and it is the failure mode
  IMP-097 / IMP-209 exist to pin down. Not changed here.
- **The gates lengthen the deploy path.** The Python suite measures 1.1 s locally and `tsc
  --noEmit` a few seconds, but neither figure was measured on a GitHub runner, so no total is
  quoted. The job cap `90` still leaves ~15 minutes around the index step's `75`, unchanged.
- **A flaky suite can now block publication.** This is the item's own stated `Risk: med`. Nothing
  here retries or tolerates a flake, deliberately — no `continue-on-error`, no `|| true`.
- **Local run of the suite used `/usr/local/bin/python3.11`, not bare `python`.** The string added
  to the workflow is `python -m unittest discover -s tests -v`, which is what CI runs (its
  `setup-python` provides `python`). This machine has no bare `python` on `PATH` (profile PE-5),
  which is why the verification used the interpreter path the spec names.
- **Not verified here:** the workflow has not been executed by GitHub Actions. Everything above is
  static (YAML parse, step order, string equality, suite runs). First real evidence will be the
  next deploy or a `workflow_dispatch`.