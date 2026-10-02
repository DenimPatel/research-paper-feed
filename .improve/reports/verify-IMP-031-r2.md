# Verification round 2 — IMP-031 + IMP-032 (docs onboarding)

**Verifier:** independent, read-only. No source file modified; no git write command run. My only
write is this report.
**Item reports:** `.improve/reports/impl-IMP-031.md`, `.improve/reports/discovered-IMP-031.md`.
**Supersedes:** `.improve/reports/verify-IMP-031.md` (VERDICT: FAIL).
**Date:** 2026-10-02. **Host:** macOS (darwin), `/opt/homebrew/bin/python3` = 3.14.3, node v25.6.1,
npm 11.9.0.

## VERDICT: PASS

6/6 acceptance criteria met. The previously-fatal D-1 working-directory break is fixed and proven
by executing both documents verbatim. Every finding from the round-1 verdict (D-1…D-7) is resolved
or correctly disclosed as out-of-scope and filed.

**One finding must not be lost, though: the newly disclosed `build_index.py` defect is real,
pre-existing, and it affects the production deploy path — not just local dev.** See §3. It does not
block this item (`scripts/` is outside its scope and the readme's new prose about it is accurate and
disclosed), but it must be re-prioritised as a bug, not left as a doc footnote.

---

## 1. CHECK 1 — the central one: onboarding executed verbatim

Scratch copies made with `rsync` excluding `.git`, `node_modules`, `.kilo`,
`.improve/artifacts`, `.playwright-mcp`. Each document was executed in **one continuous shell
session** with `pwd` echoed before every step and every exit code recorded. **No `cd` was executed
that the document does not itself write.** `set -e` was deliberately not used so the full table
would be captured.

### 1a. `CONTRIBUTING.md`, one continuous session (`/tmp/rpf-A`)

| # | Step (doc line) | `pwd` before | Exit | Observed |
| --- | --- | --- | --- | --- |
| 1 | "Fork … then `cd` into the repository root" (`:16`) | `/tmp/rpf-A` | n/a | already at root (the harness `cd`, per instruction) |
| 2 | `python3 --version` (`:21`) | `/tmp/rpf-A` | **0** | `Python 3.14.3` |
| 3 | `python3 -m venv .venv` (`:22`) | `/tmp/rpf-A` | **0** | |
| 4 | `source .venv/bin/activate` (`:23`) | `/tmp/rpf-A` | **0** | |
| 5 | `python -m pip install -r requirements.txt` (`:24`) | `/tmp/rpf-A` | **0** | `arxiv 3.0.0 pandas 3.0.6 numpy 2.5.3` |
| 6 | `python -m unittest discover -s tests -v` (`:50`) | `/tmp/rpf-A` ← **root** | **0** | `Ran 89 tests` / `OK` |
| 7 | `cd web` (`:61`) | `/tmp/rpf-A` | **0** | |
| 8 | `npm ci` (`:62`) | `/tmp/rpf-A/web` | **0** | |
| 9 | `npm run typecheck` (`:69`) | `/tmp/rpf-A/web` | **0** | silent |
| 10 | `npm test` (`:70`) | `/tmp/rpf-A/web` | **0** | `16` files, **`253 passed (253)`** |
| 11 | `npm run build` (`:71`) | `/tmp/rpf-A/web` | **0** | 41 modules, built in 751 ms |

**11/11 exited 0.** Step 6 ran from `/tmp/rpf-A` — the repository root — and the only `cd web` is
step 7, which happens after it.

### 1b. `readme.md` Quick Start, one continuous session (`/tmp/rpf-B`)

| # | Step (doc line) | `pwd` before | Exit | Observed |
| --- | --- | --- | --- | --- |
| 1 | `python3 --version` (`:42`) | `/tmp/rpf-B` | **0** | `Python 3.14.3` |
| 2 | `python3 -m venv .venv` (`:43`) | `/tmp/rpf-B` | **0** | |
| 3 | `source .venv/bin/activate` (`:44`) | `/tmp/rpf-B` | **0** | |
| 4 | `python -m pip install -r requirements.txt` (`:45`) | `/tmp/rpf-B` | **0** | |
| 5 | `python scripts/build_index.py --category cs.CV --max-per-category 300` (`:46`) | `/tmp/rpf-B` ← **root** | **0** | `Wrote 300 papers across 1 shards to web/public/data`; wrote `index.json` + `papers-2026-W40.json` (live arXiv, single page `start=0&max_results=300`) |
| 6 | `cd web` (`:81`) | `/tmp/rpf-B` | **0** | |
| 7 | `npm install` (`:82`) | `/tmp/rpf-B/web` | **0** | |
| 8 | `npm run dev` (`:83`) | `/tmp/rpf-B/web` | serves | long-running server; harness started it, probed, killed. `GET /` → **200**, `GET /data/index.json` → **200** at the documented Pages base path |
| 9 | `npm run typecheck` (`:99`) | `/tmp/rpf-B/web` | **0** | silent |
| 10 | `npm test` (`:100`) | `/tmp/rpf-B/web` | **0** | `16` files, **`253 passed (253)`** |
| 11 | `npm run build` (`:101`) | `/tmp/rpf-B/web` | **0** | built in 390 ms |
| 12 | `cd ..` (`:109`, written by the doc as prose) | `/tmp/rpf-B/web` | **0** | |
| 13 | `python -m pip install -r requirements.txt` (`:116`) | `/tmp/rpf-B` ← **root** | **0** | already satisfied |
| 14 | `python scripts/paper-collector.py --topic "cat:cs.CV AND \"3d reconstruction\"" --max-papers 200` (`:117`) | `/tmp/rpf-B` | **0** | `200 papers extracted`, HTML written to `results/` |
| 15 | `python scripts/paper-collector.py` (`:123`, interactive) | `/tmp/rpf-B` | `EOFError` → **0** | `EOFError` is the correct response to a closed stdin, not a doc defect. Re-run with a piped topic (`echo "cat:cs.LG" \| …`): `1000 papers extracted`, exit 0 |

**Every documented step exits 0** once the interactive prompt is given the input the document says
it wants. The readme's own handoff is coherent: it labels step 2 "From the repository root", says
"You are in `web/` after step 2" (`:95`), and has the Python CLI section `cd ..` first (`:109`).

### 1c. D-1 — was the working-directory break fixed?

**Yes, definitively.** Round 1 reproduced `ImportError: Start directory is not importable: 'tests'`
and `zsh: no such file or directory: web` (exit 1) by following the numbered list. Neither error
reproduces. Three independent mechanisms now prevent it:

1. **The Python spine is entirely root-based and completes before the only `cd web`.**
   `CONTRIBUTING.md` steps 1–4 never leave the root; the `cd web` is step 7 of the transcript above.
2. **The invariant is stated once, up front** — `:10-12` "every command below runs from the
   **repository root** unless its block says otherwise. The web commands are the only exception".
3. **Every block restates its directory anyway** — `:47` "Run the Python tests, from the repository
   root:", `:58` "From the repository root:", `:65` "The next three commands run from `web/`".

The attempt-1 failure mode is structurally unreachable, not merely avoided by luck.

---

## 2. CHECK 2 — findings from the round-1 verdict

| # | Finding | Status | Evidence |
| --- | --- | --- | --- |
| **D-1** | HIGH — `cd web` persisted and broke the Python test step | **FIXED** | §1a, §1c. Test step ran from the root, exit 0, `Ran 89 tests / OK`. |
| **D-2** | MEDIUM — "two independent projects" contradicted an unconditional `cd web` step 3 | **FIXED** | Web setup is no longer a numbered step. It is `## Setting up the web app` (`:53`) opening "Only needed if you are changing `web/`" (`:55`). `:5-8` now reads "you only need to set up and run the one you are changing". The two tracks never interleave. |
| **D-3** | MEDIUM — documented floor untested; workflows float `3.x` | **DISCLOSED, still open (out of scope)** | Still `ci.yml:15`, `ci.yml:34`, `deploy.yml:32` = `"3.x"` (line numbers shifted by IMP-198's additions). Correctly filed as **discovered D-8** with all three lines and a fix. `.github/` is another agent's file. Correct scoping; see my note in §5. |
| **D-4** | LOW/MED — "3.11 or newer is required" overstated | **FIXED** | New wording (`CONTRIBUTING.md:27-30`, `readme.md:49-52`), verbatim: "**Python 3.10 and newer** can install the dependencies. This project is *verified on Python 3.11 and 3.14*; on 3.10 pip resolves an older major of `pandas` than on 3.11+, so that combination is not the one these steps were tested against. Python 3.9 and older cannot install the dependencies at all." **Judge: correct.** It separates the *installable* floor (3.10, evidenced by a full-set resolution + a green suite under pandas 2.3.3) from the *verified* floor (3.11 and 3.14, both measured), names the concrete 3.10 caveat instead of hiding it, and states the hard exclusion (3.9 and older) with its reason. Badge moved `3.11+` → `3.10+` (`readme.md:4`), the weaker and better-supported claim. |
| **D-5** | LOW — stock macOS 3.9 venv dead-ends on a resolver error | **FIXED** | `python3 --version   # must be 3.10 or newer` is now the **first line of the venv block in both files** (`CONTRIBUTING.md:21`, `readme.md:42`), and both explain the failure and give a concrete remedy for macOS *and* Ubuntu (`brew install python@3.12`; `sudo apt install python3.12 python3.12-venv`). |
| **D-6** | LOW — `CONTRIBUTING.md` had lost its trailing newline | **FIXED** | `tail -c 12 CONTRIBUTING.md \| xxd` → `6170 706c 6963 6162 6c65 2e0a` = `applicable.\n`, byte-identical to `git show HEAD:CONTRIBUTING.md`. `readme.md` also ends `0a`. |
| **D-7** | NIT — `npm run lint` documented but non-existent | **FIXED (removed)** | `grep -n 'run lint' CONTRIBUTING.md readme.md` → no matches. `:74-78` now states positively: "This project has no linter for either stack, so there is no lint step to run — `npm run typecheck` (`tsc --noEmit`) is the web stack's only static analysis, and the Python suite is the only Python gate." I confirmed the claim: no `eslint.config.*`, `.eslintrc*`, `prettier`, `ruff.toml`, `.flake8`, `pylint`, `pyproject.toml` or `setup.cfg` anywhere in the repo. This also removes round 1's only literal AC3 exception. |

D-8 ("Every other command below is unchanged.", no referent) is also gone — the sentence was
deleted. Round 1's D-9 ("86 tests" unreproducible at HEAD) is resolved by removing the number
entirely; see §4.

---

## 3. CHECK 3 — the newly disclosed `build_index.py` defect

### What was injected

A localhost stand-in for `export.arxiv.org` on `127.0.0.1:8731` (**the real API was never
contacted**), reproducing exactly one upstream behaviour:

- `start < 10000` → HTTP 200 with a valid Atom page of in-window (`2026-09-05`) entries;
- `start >= 10000` → **HTTP 500**.

In a scratch copy (`/tmp/rpf-C`) I pointed the client at it by subclassing `arxiv.Client` and
overriding its `query_url_format` instance attribute in a wrapper that then `runpy`-executes
`scripts/build_index.py`. Nothing in `scripts/` was edited; every decision below was made by the
repo's own code. Only the client's inter-page `delay` was zeroed, for runtime — pagination offsets,
retry count and error handling are untouched by that.

### Results

**Bare `python scripts/build_index.py`** (what attempt 1 documented) → **exit 1, nothing written.**

```
pages the client actually requested:
  start=0&max_results=1000 … start=9000&max_results=1000   -> HTTP 200
  start=10000&max_results=1000  x6  (1 + num_retries=5)   -> HTTP 500
ERROR:root:ArXiv search failed for 'cat:cs.LG': Page request resulted in HTTP 500 (…start=10000&max_results=1000)
… identical for cs.CV, cs.CL, cs.AI, cs.RO …
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO.
$ ls /tmp/rpf-C/out-bare
ls: /tmp/rpf-C/out-bare: No such file or directory
```

**Capped `python scripts/build_index.py --category cs.CV --max-per-category 300`** (what the readme
now documents) → **exit 0, index written.**

```
pages requested: start=0&max_results=300   (exactly one)
INFO:root:Wrote 300 papers across 1 shards to /tmp/rpf-C/out-capped
$ ls /tmp/rpf-C/out-capped -> index.json  papers-2026-W36.json
```

### Is this a REAL pre-existing bug, or an injection artifact?

**Real, and pre-existing.** The stub supplied only the 5xx. Everything that made it a failure came
from the repo:

1. `scripts/build_index.py:45` — `UNLIMITED = 100000` is the "no cap" bound. arXiv's own API manual
   (§3.1.1.2, read from the docs, not the API) says: *"A request with max_results >30,000 will
   result in an HTTP 400 error code"* and *"We recommend to refine queries which return more than
   1,000 results… For bulk metadata harvesting… the OAI-PMH interface is more suitable."* So
   `UNLIMITED = 100000` is an **unachievable bound by construction** — `--max-per-category 0`,
   which is the **default**, names a limit the upstream API explicitly refuses and documents as
   unsupported for bulk use. That is a code-side contract error, not an upstream surprise.
2. `collect_papers` / `main` are **all-or-nothing**: one 5xx on page 11 marks the category failed,
   and `main()` returns 1 writing *nothing* — including discarding the four categories that
   succeeded. There is no offset ceiling, no per-category degradation, no bounded "page as far as
   arXiv will allow and note the gap".
3. It is **pre-existing**: `git diff --name-only -- scripts/build_index.py` is empty. This item
   changed `CONTRIBUTING.md` and `readme.md` only.

**Severity is higher than the report implies.** `.github/workflows/deploy.yml:55` runs the **bare,
uncapped** `python scripts/build_index.py` as the weekly production index build (all 5 default
categories, 60-day retention, `page_size` 1000). So this is not only a local-dev footgun: when the
deep-offset failure fires, the deploy job fails and the live site stays on the previous index.
`deploy.yml:43-53` reasons about the bare run's cost but not about its reachability.

**Honest limit on my evidence:** I confirmed the *mechanism* and the *code-side* defect
deterministically, and I confirmed the upstream constraint from arXiv's manual. I did **not**
independently confirm the implementer's specific live observation (`start=10000` → 500 while
`start=9000` → 200), because I was instructed not to hit the real API for this check. The specific
failure offset, and the attribution to `cs.AI` specifically, remain implementer-only. The exact
trigger threshold is a function of how many in-window papers a category holds, so it drifts as
arXiv grows — which strengthens rather than weakens the case that the default cannot be relied on.

### Is documenting a capped command the right response?

**Acceptable as a disclosed mitigation; not a fix, and it does not protect production.**

What the implementer got right:
- `scripts/` is outside this item's scope, so no code fix was available.
- The readme states the cause instead of quietly swapping a flag: `readme.md:73-76` — *"`--max-per-category`
  is not only a speed knob here: a full uncapped run pages `cs.AI` past `start=9000`, and arXiv's
  API answers deep offsets with HTTP 500, which aborts the whole run before anything is written.
  Capping keeps a local build on the first page."* That is an honest, evidence-cited explanation,
  not papering-over.
- The default still fails, loudly, rather than silently writing a partial index.

What remains wrong, and is why this must be filed as a bug and not closed as a doc note:
- **The documented workaround does not apply to the path that actually matters.**
  `deploy.yml:55` still runs the bare command, so the production failure mode is untouched.
- **The Quick Start no longer demonstrates the real command.** It now builds a 300-paper,
  single-category (`cs.CV`) index, which is a dev sample, not the index the pipeline produces. A
  reader following it gets a valid app but not a representative dataset.
- **The correct fix is upstream, not in prose**: bound the paging at a defensible offset (or use
  `submittedDate` ranges instead of deep offsets), and/or default `--max-per-category` to a value
  the API can actually serve, and/or degrade per-category instead of discarding a whole run.
  Discovered **D-9** already proposes the first and third. It should be re-prioritised: a
  production deploy that cannot complete is a higher-severity item than a docs nit.

---

## 4. CHECK 4 — everything else

| Check | Result |
| --- | --- |
| **Machine-specific paths** | `grep -nE '/usr/local\|/opt/homebrew\|/usr/bin/python\|python3\.(9\|1[0-9])\|/Users/\|C:\\'` over both files returns only `brew install python@3.12` and `sudo apt install python3.12 python3.12-venv` — portable **package names in install instructions**, present on any machine, satisfying the stated 3.10+ floor. The profile's only-working-command trap (`/usr/local/bin/python3.11 -m unittest …`) appears **nowhere**. No usernames, no drive letters, no interpreter paths. **PASS.** |
| **Hardcoded stale test count** | `grep -nE '[0-9]+ (tests\|test)\b\|Ran [0-9]+\|[0-9]+ tests'` over both files → **no matches**. Correct, and the right call: I measured the live tree at `Ran 89 tests` while round 1 measured 86 at HEAD 78, so any hardcoded number is already stale. |
| **readme ↔ `--help` reconciliation** | Both `--help` outputs captured fresh from a venv built by the documented sequence (`COLUMNS=100`). See table below. **Zero discrepancies introduced.** |
| **Only `CONTRIBUTING.md` + `readme.md` changed by this item** | `git diff --name-only` = `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.improve/FEATURES.md`, `CONTRIBUTING.md`, `readme.md`, `scripts/arxiv_common.py`, `tests/test_arxiv_common.py`, `tests/test_build_index.py`. The workflow/code/test files are IMP-198's (another agent). The item's own changes are the two docs. **PASS.** |
| **Spec integrity** | `.improve/FEATURES.md` diff is **status flips only** (`TODO`→`IN-PROGRESS` for IMP-031, IMP-032, and IMP-198). No acceptance criterion, intent, area, or notes text altered. **PASS.** |
| **Internal links / anchors** | `LICENSE`, `images/feed_example.png`, `notebooks/paper-collector.ipynb`, `CONTRIBUTING.md`, `requirements.txt`, `web/package-lock.json` — all exist. Anchor `#run-the-web-app-locally` → `readme.md:34` `## Run the web app locally`. **PASS.** |
| **Web command inventory (IMP-032 AC3)** | `web/package.json` scripts: `dev→vite`, `build→tsc --noEmit && vite build`, `preview→vite preview`, `test→vitest run`, `test:watch→vitest`, `typecheck→tsc --noEmit`. Every web command written into the docs resolves: `cd web`+`npm ci`, `npm install`, `npm run dev`, `npm run typecheck`, `npm test`, `npm run build`, `npm run test:watch`. **`npm run lint` is gone — zero literal exceptions remain.** |
| **Working tree left clean** | `git status --porcelain` identical before and after my run; my only write is this report. |

### `readme.md` ↔ `--help`, reconciled against fresh captures

**`build_index.py`** — readme `:64-71` prose vs `--help`:

| Flag | `--help` says | Verdict |
| --- | --- | --- |
| `--out-dir` | "Directory for index.json and shards (default: web/public/data)." | ✅ matches "any writable directory, default `web/public/data`" |
| `--retention-days` | "(default: 60; 1 or greater)" | ✅ |
| `--max-per-category` | "Dev escape hatch: cap results fetched per category (default: 0; 0 or greater, 0 = no cap)." | ✅ |
| `--abstract-chars` | "(default: 500; 1 or greater)" | ✅ |
| `--category` | repeatable, `cs.AI`/`stat.ML`/`astro-ph.HE`, defaults `cs.CV, cs.LG, cs.CL, cs.AI, cs.RO` | ✅ identical content |

**`paper-collector.py`** — readme `:132-137` table vs `--help`:

| Flag | Verdict |
| --- | --- |
| `--topic`, `--max-papers`, `--download-pdfs`, `--download-sources`, `--save-csv` | ✅ all match |
| `--output-dir` | ✅ matches `--help` **verbatim** — but both are wrong (help omits the `--save-csv` file that also lands there). **Pre-existing code defect at `scripts/paper-collector.py:205`, not introduced by this item**, and correctly filed as discovered D-1. The readme's prose at `:139-143` states the true behaviour. Leaving the table row matching `--help` was the right call inside this item's scope: rewriting only the readme would have *created* a new divergence. **Must stay open for the next item.** |

---

## 5. Criteria review

| Item | AC | Requirement | Met | Evidence |
| --- | --- | --- | --- | --- |
| IMP-031 | 1 | venv inside or outside the repo + interpreter-agnostic test command working on macOS and Ubuntu | **YES** | Both placements: `CONTRIBUTING.md:22` (`.venv`) and `:40-43` (`../research-paper-feed-venv`). Test command `:50` runs from the root, exit 0, macOS 3.14.3 and (round 1) 3.11.8, Ubuntu-shaped by construction — `source`/`venv`, no interpreter path, no `python` on `PATH`. Round 1 marked this **PARTIAL**; the restructure closes it. |
| IMP-031 | 2 | readme Quick Start uses the same venv-first sequence | **YES** | `readme.md:42-45` is character-identical to `CONTRIBUTING.md:21-24`. Both carry the same version gate, the same Windows/POSIX activation pair, the same `python -m pip install -r requirements.txt`. |
| IMP-031 | 3 | a fresh venv following the new instructions passes `python -m unittest discover -s tests -v` end to end | **YES** | Built and executed verbatim in a fresh rsync copy, one continuous session: `Ran 89 tests in 1.106s` / `OK`, exit 0. |
| IMP-032 | 1 | documents `cd web && npm ci`, `npm run typecheck`, `npm test`, `npm run build`; all three must pass before a PR | **YES** | `CONTRIBUTING.md:60-63`, `:68-72`, and `:74` "All three must pass before you open a pull request." |
| IMP-032 | 2 | Python and web suites independent; `npm test` is the only web test command | **YES** | `:5-8` "two independent projects… you only need to set up and run the one you are changing"; `:74-75` "`npm test` is the only web test command". No longer contradicted by an unconditional step (D-2). |
| IMP-032 | 3 | every command written into `CONTRIBUTING.md` exists in `web/package.json:6-13` | **YES — now with zero literal exceptions** | All web commands resolve (table in §4). `npm run lint` removed, so round 1's single flagged exception is gone. |

**6/6.**

---

## 6. Findings

| # | Severity | Finding | Action |
| --- | --- | --- | --- |
| **R-1** | **HIGH** *(pre-existing, not this item's code)* | `scripts/build_index.py:45` `UNLIMITED = 100000` is an unachievable bound — arXiv's manual documents `max_results >30,000` as HTTP 400 and recommends OAI-PMH for bulk. A deep-offset 5xx marks the category failed and `main()` discards **all five**, writing nothing (exit 1). `.github/workflows/deploy.yml:55` runs the bare uncapped command, so this can stall the weekly production deploy. Reproduced deterministically via a localhost stub (§3); `scripts/build_index.py` is untouched by this item. | Promote discovered **D-9** above doc-nit priority. Fix belongs in `scripts/build_index.py`: bound the offset, or degrade per-category, or default `--max-per-category` to a servable value. Re-measure the real failure offset before fixing. |
| **R-2** | MEDIUM | `readme.md:46` now makes the Quick Start's first command a **300-paper, single-category** sample. Correct as a dev workaround, but it is no longer the command that produces the shipped index, and a reader who assumes otherwise gets a non-representative dataset. The readme does explain why (`:73-76`), so this is a comprehensibility nit, not a falsehood. | Accept for this item; resolve with R-1. Consider labelling the step explicitly as a local dev sample once R-1 lands. |
| **R-3** | MEDIUM | The documented Python floor is still unenforced: `ci.yml:15`, `ci.yml:34`, `deploy.yml:32` all float `"3.x"`. The docs now say "verified on 3.11 and 3.14", which is honest, but `3.x` floats *upward* and will never test the floor. Correctly filed as discovered D-8 and correctly out of scope (`.github/` belongs to another agent). | Carry forward as-is. Pin to `"3.11"` or a matrix `["3.11", "3.x"]` in all three locations. |
| **R-4** | LOW | `readme.md:73-76`'s specific claim (`cs.AI`, "past `start=9000`") is implementer-only evidence. Mechanism and code-side defect are independently confirmed by me; the exact live offset and the `cs.AI`-specific attribution are not. | Keep the prose; soften to "deep offsets" (no category or offset named) unless someone re-verifies against live arXiv. |
| **R-5** | LOW *(carried, out of scope)* | `scripts/paper-collector.py:205`'s `--output-dir` help omits the `--save-csv` file that also lands in that directory. Known-wrong user-facing string. The readme row is left matching `--help` deliberately, with the truth in prose at `:139-143`. | Dedicated one-line item, as round 1 recommended. Do not let it drift. |
| **R-6** | NIT | `deploy.yml:5`'s comment says "every day at 06:00 UTC" while its cron is `0 6 * * 0` (weekly). The readme's "weekly schedule (Sunday at 06:00 UTC)" is the correct half. Outside this item. | Another agent's file (`.github/`). |
| **R-7** | NIT | Neither `npm run test:watch` nor `.venv\Scripts\Activate.ps1` was executed (interactive watcher; no Windows host). Disclosed honestly by the implementer. Both resolve to real things (`package.json:11`; standard `venv` layout). | Accept. |

### Explicitly *not* findings

- The `EOFError` from `python scripts/paper-collector.py` with stdin closed is correct behaviour for
  an interactive prompt, not a broken documented step. Verified working with a piped topic.
- `npm run dev` not self-terminating is expected of a dev server; verified serving HTTP 200 on the
  documented URL and path.
- Round 1's D-6–D-9, and every round-1 nit, are resolved.

---

## 7. Scope discipline

Read-only throughout. No source file modified, no git write command run. Scratch copies live in
`/tmp/rpf-A`, `/tmp/rpf-B`, `/tmp/rpf-C`, `/tmp/stub_arxiv.py`, `/tmp/rpf-docs-check`. The stub
server process was stopped. `.kilo/worktrees/mildly-income` was neither read nor modified. This
report is my only write.

## 8. Verdict

**PASS.** IMP-031 and IMP-032 are complete: 6/6 criteria, D-1 through D-7 resolved or correctly
disclosed and filed, every documented command exits 0 in a single verbatim session, and the scope
is exactly two documentation files.

**Do not lose R-1.** The disclosed `build_index.py` pagination defect is real, pre-existing, and on
the production deploy path. It is correctly out of scope here and correctly described in the docs —
but the doc note must not be allowed to stand in for the fix.