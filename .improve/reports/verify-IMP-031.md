# Verification — IMP-031 + IMP-032

**Verifier:** independent, read-only (no source file modified; no git write command run).
**Item reports:** `.improve/reports/impl-IMP-031.md`, `.improve/reports/discovered-IMP-031.md`.
**Date:** 2026-10-02. **Machine:** macOS (darwin), stock `/usr/bin/python3` + Homebrew 3.12/3.13/3.14
+ `/usr/local/bin/python3.11`. No 3.9/3.10 interpreter exists on this host.

## VERDICT: FAIL

5 of 6 acceptance criteria fully met. IMP-031 AC1 is **partially met**: the documented test
command is correct from the repo root, but the file's own step 3 (`cd web`) leaves the reader in
`web/`, and the step-5 Python command then dies. Reproduced, exit 1. Every doc *claim* I could
independently check is true; the failure is one of sequence coherence, which for a docs item is
the deliverable.

---

## 1. Criteria review

### IMP-031

| AC | Requirement | Met | Evidence |
| --- | --- | --- | --- |
| 1 | venv outside **or** inside repo + interpreter-agnostic test command that works on macOS and Ubuntu | **PARTIAL** | venv both placements: `CONTRIBUTING.md:19-23` (`.venv`), `:26-28` (`../research-paper-feed-venv`). Test command `CONTRIBUTING.md:45`. Works from repo root on 3.11.8 and 3.14.3. **Fails when followed as numbered** — see D-1. |
| 2 | readme Quick Start uses the same venv-first sequence | YES | `readme.md:40-43` is character-identical to `CONTRIBUTING.md:20-22` (`python3 -m venv .venv` / `source .venv/bin/activate` / `python -m pip install -r requirements.txt`). |
| 3 | A fresh venv following the new instructions passes `python -m unittest discover -s tests -v` end to end | YES | Ran literally, fresh venv, pristine `git archive HEAD` copy → `Ran 78 tests in 0.061s` / `OK`. Live tree → `Ran 86 tests` / `OK`. |

### IMP-032

| AC | Requirement | Met | Evidence |
| --- | --- | --- | --- |
| 1 | Documents `cd web && npm ci`, `npm run typecheck`, `npm test`, `npm run build`; states all three must pass before a PR | YES | `:31-36` (`cd web` + `npm ci`), `:48-55` (literal heading "Web (all three must pass)"), `:70-73` ("Make sure the checks above pass before requesting review … `npm run typecheck`, `npm test` and `npm run build` if you touched `web/`"). |
| 2 | States Python and web suites are independent; `npm test` is the only web test command | YES | `:5-8` ("two independent projects … a change to one does not require you to set up or run the other"); `:57` ("`npm test` (which runs `vitest run`) is the only web test command"). |
| 3 | Every command written into `CONTRIBUTING.md` exists in `web/package.json:6-13` | YES (one literal exception, deliberate) | All five runnable commands resolve. `npm run lint` is *written* at `:59` and does **not** exist — written purely as "do not look for it". See D-7. |

---

## 2. Every documented command, executed

| # | Documented command | Location | Working dir implied | Result I measured |
| --- | --- | --- | --- | --- |
| 1 | `python3 -m venv .venv` | `CONTRIBUTING.md:20`, `readme.md:40` | repo root | ✅ `/private/tmp/rpf-literal/.venv/bin/python`, Python 3.14.3 |
| 2 | `source .venv/bin/activate` | `CONTRIBUTING.md:21`, `readme.md:41` | repo root | ✅ `which python` → venv python |
| 3 | `.venv\Scripts\Activate.ps1` (PowerShell) | `CONTRIBUTING.md:21`, `readme.md:41` | — | ⚠️ not run (no Windows host). Standard venv layout; consistent POSIX/Windows pairing. |
| 4 | `python3 -m venv ../research-paper-feed-venv` | `CONTRIBUTING.md:28`, `readme.md:50` | repo root | ✅ standard venv layout (outside-the-repo alternative is well-formed) |
| 5 | `python -m pip install -r requirements.txt` | `CONTRIBUTING.md:22`, `readme.md:42`, `:96` | repo root | ✅ exit 0. `arxiv 3.0.0, pandas 3.0.6, numpy 2.5.3` (3.14) / `numpy 2.4.6` (3.11) |
| 6 | `python -m unittest discover -s tests -v` | `CONTRIBUTING.md:45` | **unstated** | ✅ from repo root: `Ran 78 tests / OK` (HEAD), `Ran 86 tests / OK` (live tree). ❌ **after step 3 as written: `ImportError: Start directory is not importable: 'tests'`, exit 1** — D-1 |
| 7 | `cd web` | `CONTRIBUTING.md:34` | repo root | ✅ but **persists**; see D-1 |
| 8 | `npm ci` | `CONTRIBUTING.md:35` | `web/` | ✅ exit 0 |
| 9 | `cd web` (again, step 5) | `CONTRIBUTING.md:51` | — | ❌ **`no such file or directory: web`, exit 1** if the reader is already in `web/` — D-1 |
| 10 | `npm run typecheck` | `CONTRIBUTING.md:52`, `readme.md:82` | `web/` | ✅ exit 0, silent. Maps to `tsc --noEmit` = `package.json:12` |
| 11 | `npm test` | `CONTRIBUTING.md:53`, `readme.md:83` | `web/` | ✅ exit 0. **`Test Files 16 passed (16)` / `Tests 253 passed (253)`**, 5.65 s. Maps to `vitest run` = `package.json:10` |
| 12 | `npm run build` | `CONTRIBUTING.md:54`, `readme.md:84` | `web/` | ✅ exit 0. 41 modules, `index-D7spZXJu.js` 171.45 kB (gzip 54.92), built in 429 ms. Maps to `tsc --noEmit && vite build` = `package.json:8` |
| 13 | `npm run test:watch` | `CONTRIBUTING.md:58` | `web/` | ✅ exists (`vitest`, `package.json:11`); not run (interactive) |
| 14 | `npm run lint` | `CONTRIBUTING.md:59` | `web/` | ✅ **doc claim correct**: `npm error Missing script: "lint"`, exit 1 |
| 15 | `python scripts/build_index.py` | `readme.md:43` | repo root | ⏭ bare form not run (~2–5 min production run). Same flags verified by implementer. |
| 16 | `npm install` | `readme.md:67` | `web/` | ✅ npm built-in; works (pre-existing, unchanged) |
| 17 | `npm run dev` | `readme.md:68` | `web/` | ⏭ long-running server (pre-existing, unchanged) |
| 18 | `python scripts/paper-collector.py --topic … --max-papers 200` | `readme.md:102` | repo root | ⏭ network + long; pre-existing |

### `npm` → `web/package.json` scripts mapping (AC3)

`cd web && npm ci` → npm built-in, installs exactly from `web/package-lock.json` (present, verified).
`npm run typecheck` → `tsc --noEmit` (`:12`) ✅ · `npm test` → `vitest run` (`:10`) ✅ ·
`npm run build` → `tsc --noEmit && vite build` (`:8`) ✅ · `npm run test:watch` → `vitest` (`:11`) ✅ ·
`npm run lint` → **absent**, and the docs say so.

### `pip install` without a venv (the failure IMP-031 exists to fix) — reproduced live

```
$ /opt/homebrew/bin/python3.14 -m pip install -r requirements.txt --dry-run
error: externally-managed-environment
× This environment is externally managed
```
PEP 668 refusal confirmed. Both files' prose about it is accurate.

---

## 3. Machine-specific paths — clean

```
$ grep -nE '/usr/local|/opt/homebrew|/usr/bin/python|python3\.(9|1[0-4])|/Users/|C:\\' CONTRIBUTING.md readme.md
none

$ git diff -- CONTRIBUTING.md readme.md | grep '^+' | grep -oE '(/[A-Za-z0-9_.@-]+){2,}' | sort -u
/bin/activate          -> suffix of `.venv/bin/activate`
/img.shields.io/badge/python-3.11   -> shields.io badge URL
/src/__tests__         -> `web/src/**/__tests__/`
/src/lib/__tests__     -> `web/src/lib/__tests__/`
/workflows/ci.yml      -> suffix of the relative `.github/workflows/ci.yml`
```
All five are relative-path suffixes or a URL. The prior audit's trap
(`/usr/local/bin/python3.11 -m unittest …`, the profile's only-working-command) appears **nowhere**
in either file. No usernames, no drive letters, no Homebrew paths. **PASS.**

---

## 4. The Python floor claim, scrutinised

### Installed metadata (read from the venv I built, not from the report)

| Package | Version | `Requires-Python` |
| --- | --- | --- |
| `arxiv` | 3.0.0 | `>=3.10` |
| `pandas` | 3.0.6 | `>=3.11` |
| `numpy` (on 3.14) | 2.5.3 | `>=3.12` |
| `numpy` (on 3.11) | 2.4.6 | `>=3.11` |
| `requests` | 2.33.1 | `>=3.10` |

The implementer's `pandas 3.0.6 → >=3.11` claim is **verified**. The `arxiv 3.0.0 → >=3.10` claim
is **verified**.

### Is 3.11 the *binding* floor? No — the requirement set installs on 3.10.

```
$ pip download -r requirements.txt --python-version 3.10 --only-binary=:all: -d /tmp/rpf-resolve310
RESOLVE-3.10 EXIT=0
arxiv-3.0.0-py3-none-any.whl   numpy-2.2.6-cp310-…whl   pandas-2.3.3-cp310-…whl
```

pip resolves the **entire** set for Python 3.10 by backtracking `pandas` to 2.3.3. I then proved
the suite passes on that dependency set:

```
$ /tmp/rpf-pandas2/bin/python -m pip list | grep -Ei 'arxiv|pandas|numpy'
arxiv 3.0.0   numpy 2.4.6   pandas 2.3.3
$ python -m unittest discover -s tests -v
Ran 86 tests in 1.109s
OK
```

So **3.11 is the *verified* floor, not a proven *requirement***. The docs' wording —
`CONTRIBUTING.md:14` "**Python 3.11 or newer is required**" and `readme.md:36` "**Python 3.11 or
newer is required**" — overstates. A 3.10 contributor is not broken; they get a *different, different-
major* dependency set that the docs never mention. Honest scope note: no 3.10 interpreter exists on
this host, so a real 3.10 run is **unverified** — the resolution probe plus the pandas-2.x green
suite are strong but indirect evidence.

The 3.11 floor is nonetheless a *good* call and is itself demonstrated:
`/usr/local/bin/python3.11 -m venv` → install exit 0 → **`Ran 86 tests` / `OK`**.

### Does CI test the documented floor? **No — it floats `3.x`.**

```
.github/workflows/ci.yml:15      python-version: "3.x"    # python-tests job
.github/workflows/ci.yml:31      python-version: "3.x"    # web-tests job
.github/workflows/deploy.yml:28  python-version: "3.x"    # deploy job
```
The `ci.yml` diff is IMP-198's two `timeout-minutes` lines only; `3.x` is pre-existing and untouched.

**A stated floor plus a floating CI is incoherent as a promise.** "Python 3.11 or newer is required"
is a commitment to contributors that *nothing in the repository verifies*. Two concrete consequences:

1. The floor is untested. Nothing catches a future `pandas`/`numpy` release raising its own
   `Requires-Python` above 3.11 — the docs would keep promising 3.11 while `pip install` fails.
2. `3.x` floats **upward**, so CI silently tests 3.15/3.16 and never the floor it advertises. This is
   the exact "figure that was not measured" trap the implementer correctly invoked for 3.10 — applied
   to its own claim, the same rule bites here: the 3.11 number in the docs is unmeasured *by the repo*.

**What is needed to make it honest** (config change ⇒ new item, not a fix inside IMP-031):
- `ci.yml:15` and `ci.yml:31` → `python-version: "3.11"`, or a matrix `["3.11", "3.x"]`; and
- `deploy.yml:28` pinned to match the documented floor; and
- then, and only then, the word "required" in the docs is earned. Otherwise reword to
  "tested on Python 3.11 and 3.14" and let CI float.
The implementer disclosed this honestly as discovered D-5 (`discovered-IMP-031.md:100-121`) without
fixing it. Correct scoping, but it leaves the item's headline claim unenforced.

### Secondary floor gap: the stated floor is not enforced by the documented command

`python3 -m venv .venv` silently creates whatever `python3` happens to be. On a 3.9 interpreter the
very next documented command fails with a resolver error, not the clear "3.11 required" message:

```
$ pip download -r requirements.txt --python-version 3.9 --only-binary=:all:
ERROR: Ignored the following versions that require a different python version: …
ERROR: Could not find a version that satisfies the requirement sgmllib3k (from feedparser) (from versions: none)
ERROR: No matching distribution found for sgmllib3k
```
macOS Command Line Tools ship `python3.9`, so this is the *stock* macOS path. Ubuntu 22.04 ships
`python3.10` → install succeeds, but silently against pandas 2.3.3, i.e. not the configuration the
docs describe. One line fixes it: gate on `python3 --version` before `venv`, or write
`python3.11 -m venv .venv`.

---

## 5. `readme.md` ↔ `--help` reconciliation

Captured both `--help` outputs from my own venv (`COLUMNS=100`) and compared to the readme tables.

### `build_index.py` — `readme.md:53-61`

| Flag | readme | `--help` | Verdict |
| --- | --- | --- | --- |
| `--out-dir` | "any writable directory, default `web/public/data`" | "Directory for index.json and shards (default: web/public/data)." | ✅ |
| `--retention-days` | "1 or greater, default `60`" | "(default: 60; 1 or greater)" | ✅ |
| `--max-per-category` | "0 or greater, default `0` = no cap" | "(default: 0; 0 or greater, 0 = no cap)" | ✅ |
| `--abstract-chars` | "1 or greater, default `500`" | "(default: 500; 1 or greater)" | ✅ |
| `--category` | "repeatable; each value must look like `cs.AI`, `stat.ML` or `astro-ph.HE`, defaulting to `cs.CV`, `cs.LG`, `cs.CL`, `cs.AI`, `cs.RO`" | identical content | ✅ |

No discrepancies. **Zero introduced.**

### `paper-collector.py` — `readme.md:115-122`

| Flag | readme | `--help` | Verdict |
| --- | --- | --- | --- |
| `--topic` | "ArXiv search query. If omitted, you'll be prompted interactively." | "ArXiv search query, e.g. 'cat:cs.CV AND \"3d reconstruction\"'. Prompted for interactively if omitted." | ✅ |
| `--max-papers` | "Maximum number of papers to pull. Must be 1 or greater." / `1000` | "(default: 1000; 1 or greater)" | ✅ |
| `--output-dir` | "Directory the generated HTML feed is written to." / `results` | "Directory the generated HTML feed is written to (default: results)." | ✅ verbatim — but **both are wrong**; see below |
| `--download-pdfs` | "Also download each paper's PDF." | identical | ✅ |
| `--download-sources` | "Also download and extract each paper's LaTeX source archive." | identical | ✅ |
| `--save-csv` | "Also save the extracted metadata as a CSV file." | identical | ✅ |

### Discrepancies, attributed

| # | Discrepancy | Introduced by this change? | Verdict |
| --- | --- | --- | --- |
| A | `--output-dir` help string (`scripts/paper-collector.py:205`) says "the generated HTML feed", omitting the `--save-csv` file that also lands there (`paper-collector.py:303,306`) | **No — pre-existing code defect.** The readme row is untouched by this diff; the diff only *adds* prose at `readme.md:124-128` that states the real behaviour | Real defect; correctly filed as D-1 |
| B | `--download-pdfs` / `--download-sources` help strings (`paper-collector.py:207-214`) do not say where files land; behaviour `:239-243` uses bare relative paths | **No — pre-existing.** This change *fixes the readme half* at `readme.md:125-128` | **New claim verified TRUE by me against source** (`download_pdf(filename=f"{title_slug}.pdf")`, `./extracted/{title_slug}`) |
| C | readme:111 "saved under `results/`" — silent on `--save-csv` | No, pre-existing | Minor |
| D | readme:118 "Must be 1 or greater" is prose the `--help` states inline | No | ✅ consistent |

### Assessment of the `--output-dir` handling

The implementer **deliberately left the table row matching `--help`** and put the truth in prose
below it. I concur with the decision *inside this item's scope*:

- `scripts/` is outside this item's file list, so the stale string could not be fixed here.
- Rewriting only the readme row would have **created** a new readme↔`--help` divergence, breaking the
  profile's reconciliation mandate — a worse outcome than a pre-existing, documented defect.

**But the end state is not acceptable and must stay open.** A known-wrong string in user-facing
`--help` is a defect the *next* item must fix, not something to defer indefinitely. It is a one-line
change at `paper-collector.py:205` and is squarely in D-1. Recommend a dedicated backlog item:
"make `--output-dir` help mention the optional CSV file" + optionally fix the download destination
strings (D-2). Both are one-liners in `scripts/paper-collector.py`.

---

## 6. Doc hygiene

| Check | Result |
| --- | --- |
| Internal file links | `LICENSE` ✅, `images/feed_example.png` ✅, `notebooks/paper-collector.ipynb` ✅, `CONTRIBUTING.md` ✅, `web/src/__tests__/` ✅, `web/src/lib/__tests__/` ✅, `requirements.txt` ✅, `web/package-lock.json` ✅ — all exist |
| Internal anchor | `readme.md:93` → `#run-the-web-app-locally` → heading `## Run the web app locally` (`readme.md:34`) ✅ **valid** |
| New external URLs | Only the badge at `readme.md:4`; shields.io path `python-3.11%2B-blue.svg` — `%2B` correctly encodes `+` ✅. No other new URLs |
| Heading levels | `CONTRIBUTING.md` h1→h2→h2→h2; `readme.md` h1→h2→h3, no skipped levels ✅ |
| Code fences | Balanced: `CONTRIBUTING.md` 8 fences (4 blocks, correctly 3-space indented inside ordered list items); `readme.md` 12 fences (6 blocks) ✅ |
| Tabs / trailing whitespace | 0 in both files ✅ |
| Working directory stated | ❌ **`CONTRIBUTING.md:44-46`** — see D-1. Also `CONTRIBUTING.md:45` is the only command in the file with no `cd` and no "from the repository root" |
| Trailing newline | ❌ **removed** — see D-5 |
| `.gitignore` caveat claim | `CONTRIBUTING.md:25` and `readme.md:48` claim `.venv/` is not ignored. **Verified**: `git check-ignore -v .venv` → `NOT IGNORED` ✅ accurate |
| Linter claim | `CONTRIBUTING.md:59` "There is no linter in either project" — no eslint/prettier/ruff/flake8/pylint/mypy config anywhere ✅ accurate |
| Test-file paths | `web/src/**/__tests__/` and `web/src/lib/__tests__/` — the only two `__tests__` dirs under `web/src` ✅ accurate |
| CI description claim | `readme.md:149-151` ("`npm ci`, `npm run typecheck`, `npm test`, a small paper-index build and then `npm run build`") matches `ci.yml:41-51` exactly ✅ |
| Deploy-schedule claim | `readme.md:148` "weekly schedule (Sunday at 06:00 UTC)" — `deploy.yml:6` cron `0 6 * * 0` = Sunday weekly ✅ **the readme fix is right**; `deploy.yml:5`'s comment ("every day") is the stale half (D-3) |
| Shard-overlap claim | `readme.md:22-23` "week shards that overlap the window" — `web/src/lib/paperIndex.ts:117-123` filters `shard.to >= start` ✅ accurate |
| Unverified claims by implementer | Only the Windows `Activate.ps1` line and `npm run test:watch`/`npm run dev`/bare `build_index.py`, all **disclosed** in `impl-IMP-031.md:335-342` ✅ honest disclosure |

---

## 7. Scope discipline — PASS

`git diff --stat`:

```
 .github/workflows/ci.yml   |   2 +      <- IMP-198 (other agent): 2 timeout-minutes lines
 .improve/FEATURES.md       |   6 +-     <- status flips only
 CONTRIBUTING.md            |  67 ++--   <- this item
 readme.md                  |  41 ++-    <- this item
 scripts/arxiv_common.py    |  73 ++-    <- IMP-198 (other agent)
 tests/test_arxiv_common.py | 181 ++-    <- IMP-198 (other agent)
```

- Only `CONTRIBUTING.md` and `readme.md` were changed by this item ✅
- **No code, config, or `notebooks/` file touched by this item** ✅ (`git status --porcelain` shows
  no `notebooks/` entry; the three non-doc modifications are all IMP-198's)
- `.improve/FEATURES.md`: only `**Status:** TODO → IN-PROGRESS` for IMP-031, IMP-032 (and IMP-198 by
  the other agent). **No acceptance criterion, intent, area, or notes text was altered** ✅ — the
  criterion text I verified against is the original backlog text
- I made no source change; my only write is this report. No git write command was run.

---

## 8. Findings

### D-1 — MEDIUM/HIGH. `CONTRIBUTING.md` steps 3 and 5 break each other; no working directory is ever stated
`CONTRIBUTING.md:34` `cd web` persists in the reader's shell. Following the numbered list in order:

```
$ cd web && python -m unittest discover -s tests -v        # step 5's Python block, as written
ImportError: Start directory is not importable: 'tests'
EXIT=1

$ cd web && cd web                                        # step 5's web block, as written
EXIT=1   (zsh: no such file or directory: web)
```

This is the same class of failure IMP-031 exists to remove ("the very first step a contributor runs
dies"), relocated from step 1 to step 5. Root cause: the file never says "run from the repository
root", and step 3 is written as an unconditional `cd`.

**Fix:** make step 3 `cd web && npm ci` (one line, scoped), and/or add `cd ..`, and/or state the
working directory once above step 5 — e.g. "From the repository root:" before the Python block and
"From `web/`:" before the web block.

### D-2 — MEDIUM. `CONTRIBUTING.md:3-8` contradicts its own step 3
The prose says the two projects are independent and "a change to one does not require you to set up
or run the other" (satisfying IMP-032 AC2), but the numbered list makes `cd web && npm ci` an
unconditional step 3 for every contributor. A Python-only contributor is both told they needn't set
up web and told to set up web. The inconsistency is also the direct cause of D-1.

**Fix:** move web setup out of the numbered spine (own "## Web setup" section, or an explicit
"if you are changing `web/`" qualifier on step 3).

### D-3 — MEDIUM. Documented Python floor (3.11) is untested; CI floats `3.x`
`ci.yml:15`, `ci.yml:31`, `deploy.yml:28`. See §4. Needs its own item: pin to `3.11`, or matrix
`["3.11", "3.x"]`. Until then the docs' strongest new claim is a promise nothing checks.

### D-4 — LOW/MEDIUM. "3.11 or newer is required" overstates; 3.11 is the *verified* floor, not a proven requirement
`pip download --python-version 3.10` resolves the full set (pandas 2.3.3 + numpy 2.2.6 + arxiv 3.0.0)
and the suite is green under pandas 2.3.3 (86 tests, OK). No 3.10 interpreter exists here, so the
3.10 *run* is unverified — but the docs claim a hard requirement and the evidence supports only a
verified floor. **Fix:** "verified on Python 3.11 and 3.14" (or keep 3.11+ only after D-3 pins CI).

### D-5 — LOW. The stated floor is not checked by the documented command
`python3 -m venv .venv` on a 3.9 `python3` (stock macOS CLT) produces a resolver error
(`No matching distribution found for sgmllib3k`) rather than the doc's clear message; on Ubuntu
22.04's `python3.10` it silently installs against pandas 2.3.3. **Fix:** add a `python3 --version`
gate, or document `python3.11 -m venv .venv`.

### D-6 — LOW. `CONTRIBUTING.md` lost its trailing newline
`git show HEAD:CONTRIBUTING.md` ends `applicable.\n`; the working copy ends `applicable.` with no
newline — the diff shows `\ No newline at end of file`. Introduced by this change, unrelated to the
item. **Fix:** restore the newline.

### D-7 — NIT. `npm run lint` is written into `CONTRIBUTING.md:59` but does not exist
A literal reading of IMP-032 AC3 ("every command written into `CONTRIBUTING.md` exists in
`web/package.json:6-13`") is technically broken here. The intent — saving a contributor a failed
command — is good and the "it does not exist" qualifier is unambiguous. Keeping it; flagging for
completeness.

### D-8 — NIT. `CONTRIBUTING.md:29` "Every other command below is unchanged."
No referent for a first-time reader, and nothing below was "changed" for them. Harmless; consider
deleting.

### D-9 — EVIDENCE ACCURACY (not a doc defect). "86 tests" does not reproduce at `HEAD`
`impl-IMP-031.md:37,139-160` quotes 86 as the fresh-venv result. 86 is the **live working tree**
count, which includes another agent's uncommitted IMP-198 additions to `tests/test_arxiv_common.py`.
In a pristine `git archive HEAD` copy the documented sequence gives:

```
Ran 78 tests in 0.061s
OK
```

Both are green, so AC3 is satisfied either way. Recorded so the next agent does not treat 86 as the
committed baseline. (The backlog's own verification method says "27 tests", also stale.)

---

## 9. Items to carry forward

1. **D-1 + D-2** — one focused docs fix in `CONTRIBUTING.md` (working directories + move web setup
   out of the unconditional spine). High value: this is the file IMP-031/032 exist to fix.
2. **D-3** — pin `python-version` in `ci.yml:15`, `ci.yml:31`, `deploy.yml:28` to `3.11` (or add a
   `["3.11", "3.x"]` matrix). Config item; outside this item's scope.
3. **D-4 / D-5** — reword the floor claim, or earn it by landing #2.
4. **Discovered D-1/D-2** — `--output-dir` and download-destination `--help` strings
   (`scripts/paper-collector.py:205,207-214`). One-liners in `scripts/`; the readme half of D-2 is
   already fixed here.
5. **Discovered D-3** — `deploy.yml:5` comment says "every day", cron says weekly.
6. **Discovered D-4** — `.gitignore` lacks `.venv/` (verified NOT IGNORED); both docs work around it.
7. **D-6** — restore `CONTRIBUTING.md`'s trailing newline.