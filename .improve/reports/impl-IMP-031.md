# IMP-031 + IMP-032 — implementation report (attempt 2)

**Item:** IMP-031 (venv-first Python onboarding) + IMP-032 (document the `web/` workflow).
**Supersedes:** the attempt-1 report, rejected on IMP-031 AC1 (working-directory incoherence).
**Files touched:** `CONTRIBUTING.md`, `readme.md`, and this report plus
`discovered-IMP-031.md`. No code, config, workflow, or notebook file.

---

## 0. Verifier findings → disposition

| # | Finding | Disposition |
| --- | --- | --- |
| **D-1** | **BLOCKING.** `CONTRIBUTING.md` step 3 `cd web` persisted, so step 5's Python command died (`ImportError: Start directory is not importable: 'tests'`, exit 1) and the second `cd web` also failed. No working directory ever stated. | **Fixed.** Restructured into an explicit root-based Python spine plus a separate web section. Every block now states its working directory, and the guide's opening states the invariant. Proven by executing the whole file verbatim in one shell session (§2). |
| **D-2** | `:3-8` claims the projects are independent, but step 3 made `cd web && npm ci` an unconditional numbered step. | **Fixed.** Web setup moved out of the numbered spine into its own `## Setting up the web app` section, opened with "Only needed if you are changing `web/`". `:5-8` now reads "you only need to set up and run the one you are changing". |
| **D-3** | The 3.11 floor is untested; `ci.yml:15`, `ci.yml:31`, `deploy.yml:28` all float `python-version: "3.x"`. | **Addressed via option (a): softened.** I chose to soften rather than keep an unenforceable promise, because I may not edit the workflows. The docs now say "**verified** on Python 3.11 and 3.14" instead of "required". The CI-pinning need is recorded as **D-8** in the discovered report with the exact lines. |
| **D-4** | "3.11 or newer is required" overstates — 3.11 is the *verified* floor, not a proven requirement. | **Fixed.** See §5. Wording is now "**Python 3.10 and newer** can install the dependencies. This project is *verified on Python 3.11 and 3.14*". Badge moved `3.11+` → `3.10+`. |
| **D-5** | `python3 -m venv .venv` on stock macOS Python 3.9 dead-ends with a resolver error instead of a clear message. | **Fixed.** `python3 --version   # must be 3.10 or newer` is now the **first line of the venv block** in both files, with the failure mode explained and a concrete remedy for macOS and Ubuntu. |
| **D-6** | `CONTRIBUTING.md` lost its trailing newline. | **Fixed.** `tail -c 20 \| xxd` → `6c65 2e0a` = `le.\n`. Both files now end with a newline. |
| **D-7** | `npm run lint` written into `CONTRIBUTING.md:59` but does not exist; a literal reading of AC3 is broken. | **Fixed — removed the command name entirely.** `:76-78` now says "This project has no linter for either stack, so there is no lint step to run". `grep 'run lint'` over both files returns nothing. |
| **D-8** | `:29` "Every other command below is unchanged." has no referent. | **Fixed — deleted.** |
| **D-9** | "86 tests" does not reproduce at `HEAD`; 86 was the live-tree count including another agent's uncommitted work. | **Addressed.** **Neither doc hardcodes a test count** (`grep -E '[0-9]+ tests'` → nothing). §4 below reports all three counts with provenance. |

**New finding surfaced by my own verification** (not in the verifier's report): the readme's
documented `python scripts/build_index.py` fails 100% of the time against live arXiv. See §3 and
**D-9** in the discovered report.

---

## 1. The restructured onboarding

### `CONTRIBUTING.md`

```
 1  # Contributing
 5-8   two independent projects … you only need to set up and run the one you are changing
10-12  **Where to run things:** every command below runs from the **repository root** unless
       its block says otherwise. The web commands are the only exception, and they run from `web/`.
14  ## Getting started
16  1. Fork … then `cd` into the repository root.
18  2. Create a virtualenv and install the Python dependencies:
20-25    python3 --version / venv / activate / pip install          ← runs from the ROOT
45  3. Make your changes.
47  4. Run the Python tests, from the repository root:
49-51    python -m unittest discover -s tests -v                    ← runs from the ROOT
53  ## Setting up the web app
55  Only needed if you are changing `web/`. …                        ← fixes D-2
58  From the repository root:
60-63    cd web
         npm ci
65  The next three commands run from `web/`, so stay there — or run `cd ..` first …
68-72    npm run typecheck / npm test / npm run build                ← runs from web/
74-78 All three must pass before you open a pull request. `npm test` is the only web test
       command; `npm run test:watch` reruns the same tests interactively … no lint step.
80  ## Pull requests        (unchanged except the test-path bullet)
92  ## Reporting issues    (unchanged)
```

Three properties, all deliberate:

1. **The invariant is stated once, up front** (`:10-12`), so no reader has to infer a working
   directory from context.
2. **The two tracks never interleave.** The Python spine (steps 1–4) is entirely root-based and
   completes before the web section begins, so the step-3 `cd web` of attempt 1 cannot poison
   step 4. The web section ends with an explicit `cd ..` instruction for anyone returning.
3. **Every block restates its directory anyway** ("From the repository root:", "run `web/` from
   `web/`"), so a reader who jumps mid-page is never guessing.

### `readme.md` — same treatment

The readme had the identical defect (its `### Web tests and build` block repeated `cd web` while a
reader who had followed step 2 was already in `web/`, and `## Python CLI` then ran `python
scripts/…` from `web/`). Now:

- `## Run the web app locally` opens with "Step 1 runs from the repository root; steps 2 and
  everything after it run from `web/`."
- Step 1 → "**From the repository root:**"; step 2 → "**From the repository root:**".
- `### Web tests and build` → "You are in `web/` after step 2. If you are not, get there first
  (`cd web` from the repository root)". Its `cd web` line is **gone**.
- `### Python CLI` → "These commands run from the repository root, so `cd ..` first if you are
  still in `web/`."

**IMP-031 AC2 (same venv-first sequence) re-verified byte-identical:**

```
$ sed -n '/^   python3 --version/,/python -m pip install/p' CONTRIBUTING.md | sed 's/^   //' > /tmp/c.txt
$ sed -n '/^   python3 --version/,/python -m pip install/p' readme.md       | sed 's/^   //' > /tmp/r.txt
$ diff /tmp/c.txt /tmp/r.txt
AC2: venv blocks BYTE-IDENTICAL - pass
```

---

## 2. From-scratch execution transcript — `CONTRIBUTING.md`, verbatim, one shell session

Run in a fresh `rsync` copy of the live tree at `/tmp/rpf-proof-contrib` (a copy, so the real
working tree stayed clean). `set -e`; **no `cd` was executed that the document does not write**;
`pwd` echoed at every transition so the transcript itself proves the working directory.

```
### STEP 1 — clone + cd into repository root
pwd: /tmp/rpf-proof-contrib

### STEP 2 — create venv + install Python deps   [CONTRIBUTING.md block, verbatim]
Python 3.14.3
…
Successfully installed arxiv-3.0.0 … pandas-3.0.6 numpy-2.5.3 …
STEP2_EXIT=0

### STEP 4 — run the Python tests, from the repository root
pwd: /tmp/rpf-proof-contrib
----------------------------------------------------------------------
Ran 86 tests in 1.099s

OK
STEP4_EXIT=0

### WEB SETUP — from the repository root
pwd: /tmp/rpf-proof-contrib
Run `npm audit` for details.
WEBSETUP_EXIT=0
pwd now: /tmp/rpf-proof-contrib/web

### WEB TESTS — from web/
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit
TYPECHECK_EXIT=0
 Test Files  16 passed (16)
      Tests  253 passed (253)
TEST_EXIT=0
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
✓ built in 380ms
BUILD_EXIT=0

### ALL DOCUMENTED STEPS EXITED 0
OVERALL_EXIT=0
```

`pwd` is `/tmp/rpf-proof-contrib` for the Python suite and `/tmp/rpf-proof-contrib/web` for the web
commands — exactly what the document says. **The attempt-1 failure mode cannot occur here**: step 4
precedes the only `cd web`, and runs from the root.

### Outside-the-repo venv variant (also documented, at `:40-43`)

```
$ python3 -m venv ../rpf-oor && source ../rpf-oor/bin/activate
Python 3.14.3
Ran 86 tests in 1.135s
OK
```

---

## 3. From-scratch execution transcript — `readme.md` Quick Start, verbatim, one session

```
### PREAMBLE — clone + cd into repository root
pwd: /tmp/rpf-proof-readme

### STEP 1 — build an index, from the repository root
pwd: /tmp/rpf-proof-readme
Python 3.14.3
INFO:root:Wrote 300 papers across 1 shards to web/public/data
STEP1_EXIT=0
index.json
papers-2026-W40.json

### STEP 2 — start the dev server, from the repository root
pwd: /tmp/rpf-proof-readme
INSTALL_EXIT=0
pwd now: /tmp/rpf-proof-readme/web

### WEB TESTS AND BUILD — from web/
TYPECHECK_EXIT=0
 Test Files  16 passed (16)   Tests  253 passed (253)
TEST_EXIT=0
✓ built in 385ms
BUILD_EXIT=0

### PYTHON CLI — cd .. back to the repository root
pwd: /tmp/rpf-proof-readme
COLLECTOR_HELP_EXIT=0
Ran 89 tests in 1.138s
OK
### ALL DOCUMENTED STEPS EXITED 0
OVERALL_EXIT=0
```

`npm run dev` separately confirmed to start and serve:

```
> vite
  VITE v5.4.21  ready in 213 ms
  ➜  Local:   http://localhost:5173/research-paper-feed/

$ curl -w "%{http_code}" http://localhost:5173/research-paper-feed/
200
$ curl http://localhost:5173/research-paper-feed/data/index.json | head -c 60
{
  "generatedAt": "2026-10-02T20:44:17Z",
  "retentionDays": 60,
```

### 3.1 The index-build command had to change — and why (new finding)

Attempt 1 documented the bare `python scripts/build_index.py`. Executing it verbatim **fails**:

```
$ python scripts/build_index.py ; echo EXIT=$?
INFO:root:  6744 papers within retention window for cs.CV
INFO:root:  9730 papers within retention window for cs.LG
INFO:root:  5215 papers within retention window for cs.CL
ERROR:root:  query failed for cs.AI: Page request resulted in HTTP 500
  (…search_query=cat%3Acs.AI…&start=10000&max_results=1000)
INFO:root:  3276 papers within retention window for cs.RO
ERROR:root:Refusing to write an index: the arXiv query failed for cs.AI.
EXIT=1
```

Reproducible — identical failure on 2/2 attempts. **Root cause is arXiv's API, proven with no repo
code involved:**

```
$ curl -o /dev/null -w "%{http_code}" "…cat%3Acs.AI…&start=10000&max_results=1000"   -> HTTP 500
$ curl -o /dev/null -w "%{http_code}" "…cat%3Acs.AI…&start=9000&max_results=1000"    -> HTTP 200
$ curl -o /dev/null -w "%{http_code}" "…cat%3Acs.AI…&start=0&max_results=1000"       -> HTTP 200
```

A full uncapped run pages `cs.AI` past `start=9000` and hits arXiv's deep-offset 500, which
IMP-004's hard-fail turns into exit 1 with nothing written.

I could not fix `scripts/`, so the readme now documents the working bounded form and says why:

```shell
python scripts/build_index.py --category cs.CV --max-per-category 300
```

Verified: `EXIT=0`, `Wrote 300 papers across 1 shards`, **1.4 s**. The docs add one sentence
explaining that the cap is not merely a speed knob. The underlying defect is filed as **D-9** in
`discovered-IMP-031.md`.

---

## 4. Test counts — three numbers, with provenance (verifier D-9)

**No test count is hardcoded in either doc** (`grep -E '[0-9]+ tests|Ran [0-9]+'` → no matches).
The count is moving under me during this loop, which is exactly why it must not live in prose.

| Provenance | Command | Result |
| --- | --- | --- |
| Committed `HEAD` | `/usr/local/bin/python3.11 -m unittest discover -s tests` in a `git archive HEAD` copy | `Ran 78 tests in 0.061s` / `OK` |
| Live tree, earlier this session | same, on the working tree | `Ran 86 tests` / `OK` |
| **Live tree, now** | `/usr/local/bin/python3.11 -m unittest discover -s tests -v` | **`Ran 89 tests in 1.126s` / `OK`** |

89 > 86 > 78 because other agents are landing tests concurrently. Both are green; the committed
baseline is **78**. The backlog's own verification method ("27 tests") is stale by three
generations.

---

## 5. Corrected Python-floor wording, and the evidence

**Old (rejected):** "**Python 3.11 or newer is required**" / badge `3.11+`.
**New:** "**Python 3.10 and newer** can install the dependencies. This project is *verified on
Python 3.11 and 3.14*; on 3.10 pip resolves an older major of `pandas` than on 3.11+, so that
combination is not the one these steps were tested against. Python 3.9 and older cannot install the
dependencies at all." Badge now `3.10+`.

Each clause is tied to evidence:

| Clause | Evidence |
| --- | --- |
| "3.10 and newer can install" | `pip download -r requirements.txt --python-version 3.10` resolves the whole set (verifier-measured: `pandas 2.3.3`, `numpy 2.2.6`, `arxiv 3.0.0`); and the suite is green under `pandas 2.3.3` (verifier-measured). My own `arxiv 3.0.0 → Requires-Python: >=3.10` and `pandas 3.0.6 → >=3.11` readings agree that 3.10 is *not* excluded. |
| "verified on 3.11 and 3.14" | Measured, not asserted: 3.14.3 venv → `Ran 86 tests / OK`; 3.11.8 venv → `Ran 86 tests / OK`. Both in §2/§4. |
| "3.10 resolves an older major of pandas" | `pandas>=2.0.0` is unbounded and has no lockfile; on 3.11+ pip takes 3.0.6, on 3.10 it must backtrack to 2.3.x. |
| "3.9 and older cannot install" | Verifier-measured: `pip download --python-version 3.9` → `ERROR: Could not find a version that satisfies the requirement sgmllib3k … No matching distribution found`. That is a `feedparser` transitive. |

**Why "verified on 3.11 and 3.14" instead of "3.10+" as a promise:** `ci.yml:15`, `ci.yml:31` and
`deploy.yml:28` all float `python-version: "3.x"`. A hard floor in the docs that CI never pins is a
commitment nothing checks, and `3.x` floats *upward* — it will never test 3.10 either. So the docs
state what was measured and leave the enforcement to the workflow-pinning item (**D-8** in the
discovered report). This is also why the version check is actionable: a contributor on an older
stock Python learns what to do in the same paragraph, instead of hitting a resolver error one
command later (**verifier D-5**).

---

## 6. Every documented command and its measured result

### Python (all from the repository root, with the venv activated)

| Command | Where | Result |
| --- | --- | --- |
| `python3 --version` | `CONTRIBUTING.md:21`, `readme.md:41` | ✅ `Python 3.14.3` |
| `python3 -m venv .venv` | `:22` / `:42` | ✅ |
| `source .venv/bin/activate` | `:23` / `:43` | ✅ `which python` → venv python |
| `.venv\Scripts\Activate.ps1` | `:23` / `:43` | ⚠️ not run — no Windows host |
| `python -m pip install -r requirements.txt` | `:24`, `readme.md:44, :117` | ✅ exit 0; `arxiv 3.0.0 pandas 3.0.6 numpy 2.5.3` |
| `python3 -m venv ../research-paper-feed-venv` + activate | `CONTRIBUTING.md:42` | ✅ §2 |
| `python -m unittest discover -s tests -v` | `CONTRIBUTING.md:50` | ✅ **Ran 86 / 89, OK** |
| `python scripts/build_index.py --category cs.CV --max-per-category 300` | `readme.md:44` | ✅ exit 0, 300 papers, 1.4 s |
| `python scripts/paper-collector.py --help` | `readme.md` CLI section | ✅ exit 0 |
| `python scripts/paper-collector.py --topic … --max-papers 200` | `readme.md:119` | ⏭ network-heavy, pre-existing, unchanged |
| `npm run dev` | `readme.md:79` | ✅ ready in 213 ms, HTTP 200 at the documented URL |

### Web — mapping to `web/package.json` scripts (IMP-032 AC3)

`web/package.json` scripts, read from the file: `dev → vite`, `build → tsc --noEmit && vite build`,
`preview → vite preview`, `test → vitest run`, `test:watch → vitest`, `typecheck → tsc --noEmit`.

| Written in my doc edits | Occurrences | Resolves to | Exists? |
| --- | --- | --- | --- |
| `cd web` + `npm ci` | 2 | npm built-in (`web/package-lock.json` present) | ✅ |
| `npm run typecheck` | 5 | `tsc --noEmit` (`:12`) | ✅ |
| `npm test` | 5 | `vitest run` (`:10`) | ✅ |
| `npm run build` | 5 | `tsc --noEmit && vite build` (`:8`) | ✅ |
| `npm run test:watch` | 1 (prose) | `vitest` (`:11`) | ✅ |
| `npm run dev` | 1 | `vite` (`:7`) | ✅ |
| `npm run lint` | **0** | — | **removed per D-7** |

Live-tree re-run at the end: `typecheck` exit 0 · `Tests 253 passed (253)` across `16` files ·
`build` 41 modules, `index-D7spZXJu.js` 171.45 kB (gzip 54.92), CSS 10.93 kB.

### Reproducing the PEP 668 failure the docs exist to prevent

```
$ /opt/homebrew/bin/python3.14 -m pip install -r requirements.txt
error: externally-managed-environment   … See PEP 668
```

### Argparse ranges the readme documents (IMP-022), re-confirmed

```
$ python scripts/build_index.py --retention-days 0
error: argument --retention-days: --retention-days accepts 1 or greater, got 0
$ python scripts/build_index.py --abstract-chars -3
error: argument --abstract-chars: --abstract-chars accepts 1 or greater, got -3
$ python scripts/build_index.py --max-per-category -9
error: argument --max-per-category: --max-per-category accepts 0 or greater, got -9
$ python scripts/build_index.py --category "cs.CV foo"
error: argument --category: … is not an arXiv category; expected a subject such as cs or cs.AI…
$ python scripts/paper-collector.py --max-papers 0
error: argument --max-papers: --max-papers accepts 1 or greater, got 0
```

### Machine-specific paths — clean

```
$ grep -nE '/usr/local|/opt/homebrew|python3\.(9|1[0-4])|/Users/' CONTRIBUTING.md readme.md
CONTRIBUTING.md:32:  `brew install python@3.12` on macOS, or `sudo apt install python3.12
CONTRIBUTING.md:33:  python3.12-venv` on Ubuntu — and re-run this step.
readme.md:54:        macOS, `sudo apt install python3.12 python3.12-venv` on Ubuntu) and re-run this step.
```

The only hits are **package names in install instructions** — `brew install python@3.12` and
`sudo apt install python3.12 python3.12-venv` — which are portable and present on any machine.
No interpreter path, no Homebrew prefix, no username, no `/usr/local/bin/python3.11`. The
profile's only-working-command trap appears nowhere in either file.

---

## 7. `readme.md` ↔ `--help` reconciliation (unchanged by attempt 2)

Re-confirmed against freshly captured `--help` output; attempt 2 changed no flag text.

**`build_index.py`** — `--out-dir` ✅ · `--retention-days` "(default: 60; 1 or greater)" ✅ ·
`--max-per-category` "(default: 0; 0 or greater, 0 = no cap)" ✅ · `--abstract-chars`
"(default: 500; 1 or greater)" ✅ · `--category` (repeatable, `cs.AI`/`stat.ML`/`astro-ph.HE`,
defaults `cs.CV, cs.LG, cs.CL, cs.AI, cs.RO`) ✅. **Zero discrepancies.**

**`paper-collector.py`** — `--topic` ✅ · `--max-papers` "(default: 1000; 1 or greater)" ✅ ·
`--output-dir` ✅ **verbatim** · `--download-pdfs` ✅ · `--download-sources` ✅ · `--save-csv` ✅.

Discrepancies **not** introduced by this item, all previously filed and still open:
`paper-collector.py:205`'s `--output-dir` help omitting the CSV file (discovered **D-1**);
`:208-213` download-destination help (discovered **D-2**). The readme row is still left matching
`--help` deliberately — rewording it would manufacture a new divergence.

**One new readme claim I introduced in attempt 2**, disclosed: the note that an uncapped run
pages `cs.AI` past `start=9000` and gets HTTP 500. Verified by direct `curl` (§3.1), so it is
evidence-backed rather than inferred.

---

## 8. Still unverified / disclosed

| Item | Why | Status |
| --- | --- | --- |
| `.venv\Scripts\Activate.ps1` | no Windows host | Standard `venv` layout; POSIX form run and green |
| `npm run test:watch` | interactive watcher | Existence confirmed (`:11`); underlying `vitest run` run 253/253 |
| `python scripts/paper-collector.py --topic … --max-papers 200` | live network, 200 papers | `--help` exit 0; a 2-paper run earlier wrote HTML + CSV into `--output-dir` with nothing in the CWD |
| Python 3.10 *execution* | no 3.10 interpreter on this host | Indirect evidence only (resolution probe + green under `pandas 2.3.3`, both measured by the verifier). The docs say "can install", not "verified". |

## 9. Judgment calls, offered for independent rejection

1. **Two-track structure over subshells.** `(cd web && npm ci)` would be bulletproof but reads as
   shell trivia in a file whose audience includes first-time contributors. Explicit "From the
   repository root:" labels plus one opening invariant sentence is clearer, and §2 proves it works.
2. **Changing the readme's index command** from bare to `--category cs.CV --max-per-category 300`
   (§3.1). The bare command cannot work today, and shipping a Quick Start whose first command
   exits 1 is the exact failure IMP-031 exists to remove. This is the one place I changed *what*
   the readme recommends rather than just *how* it is phrased — flagged so it can be reverted.
3. **Softening the floor rather than keeping "required"** (verifier's option (a)) — because I may
   not pin the workflows, and an unenforced promise is worse than a measured one.
4. **Attempt 2 kept the readme corrections from attempt 1** (`npm run typecheck`, the weekly
   deploy schedule, the CI description, the `--output-dir`/download-destination note, the shard
   wording). The verifier re-verified each and marked them accurate.