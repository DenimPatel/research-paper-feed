# Verification — IMP-193 (independent verifier)

**Item:** `.improve/FEATURES.md:1784-1800`
**Implementation under review:** `.github/workflows/ci.yml` only, `+9` lines (verified purely additive)
**Implementer report:** `.improve/reports/impl-IMP-193.md`
**Verdict:** **PASS** — all 5 acceptance criteria met. One real, actionable risk found that is
**not** the implementer's fault (it is a hole in the spec's own risk model), plus three cosmetic
nits. Nothing here blocks the merge.

I did not write the change and did not trust the report's numbers: every figure below is from my own
runs. Read-only throughout; the only file I wrote is this report. No git write command was run. The
sibling worktree `.kilo/worktrees/mildly-income` was never read or written.

---

## 1. The flakiness question — the central risk, assessed honestly

### 1.1 Client configuration, read from source

`scripts/arxiv_common.py:15-26`:

```
15  DEFAULT_PAGE_SIZE = 1000
16  DEFAULT_DELAY_SECONDS = 10
17  DEFAULT_NUM_RETRIES = 5
...
22      return arxiv.Client(
23          page_size=max(1, min(DEFAULT_PAGE_SIZE, max_results)),
24          delay_seconds=DEFAULT_DELAY_SECONDS,
25          num_retries=DEFAULT_NUM_RETRIES,
26      )
```

With `--max-per-category 5`: `page_size = 5`, `Search(max_results=5)`. The whole run is **one HTTP
request**. I confirmed the count empirically, not by reading (see §1.2).

**There is no timeout, anywhere, on any version this repo can resolve.** The request line is
`self._session.get(url, headers=...)` with no `timeout=` argument:

- locally installed `arxiv 2.1.3`: `/Library/Frameworks/Python.framework/Versions/3.11/lib/python3.11/site-packages/arxiv/__init__.py:660`
- `arxiv 3.0.0` (what CI actually resolves — see §1.5): `/tmp/verify-imp193-venv/lib/python3.11/site-packages/arxiv/__init__.py:729`

`arxiv.Client.__init__(page_size, delay_seconds, num_retries)` exposes no timeout knob either, so
nothing in `scripts/` can bound this request without patching `client._session`. **This is the one
finding I would file as a follow-up item**, and §1.4 measures what it costs.

### 1.2 Five runs of the exact CI command — timings, request counts, exit codes

CI resolves `requirements.txt` into a fresh interpreter, so I built my own clean venv rather than
trusting the implementer's:

```
$ /usr/local/bin/python3.11 -m venv /tmp/verify-imp193-venv
$ /tmp/verify-imp193-venv/bin/pip install -r requirements.txt
arxiv 3.0.0  feedparser 6.0.14  numpy 2.4.6  pandas 3.0.6  requests 2.33.1  urllib3 2.8.0
```

Scratch tree (`/tmp/verify-imp193-proof`, an rsync of the working tree with `web/public/data` removed,
`node_modules` symlinked, `ci.yml` verified `IDENTICAL` to the repo copy — a faithful stand-in for a
fresh CI runner). Command run verbatim from the repo root, as `ci.yml:47` declares:

```
RUN 1 exit=0 elapsed=0.292s http_requests=1 rate_limit_sleeps=0 files=[index.json papers-2026-W40.json ]
RUN 2 exit=0 elapsed=0.314s http_requests=1 rate_limit_sleeps=0 files=[index.json papers-2026-W40.json ]
RUN 3 exit=0 elapsed=0.212s http_requests=1 rate_limit_sleeps=0 files=[index.json papers-2026-W40.json ]
RUN 4 exit=0 elapsed=0.250s http_requests=1 rate_limit_sleeps=0 files=[index.json papers-2026-W40.json ]
RUN 5 exit=0 elapsed=0.217s http_requests=1 rate_limit_sleeps=0 files=[index.json papers-2026-W40.json ]
```

**5/5 green, 0.212–0.314 s, one HTTP request each, zero rate-limit sleeps.** The implementer's "0.24 s
and one request" is accurate; I measured 0.257 s mean.

**AC3's premise is wrong and the implementer said so.** AC3 asserts the flags make the client "sleep
`delay_seconds=10` between pages exactly once". Measured: **zero** sleeps. `arxiv 3.0.0:719` guards
the sleep with `if self._last_request_dt is not None:` and `:730` only sets it *after* a request, so
the first request never sleeps. One page ⇒ one request ⇒ no sleep. Disclosing this instead of
quietly matching the wording is correct behaviour, and AC3's *intent* ("bound to one small arXiv
page") is exceeded. I score AC3 met, with the "exactly once" clause recorded as a defect in the spec.

### 1.3 IMP-004's hard-fail is confirmed, and I measured the cost

I exercised the real code path (only the endpoint URL was redirected; `build_client` → `arxiv.Client`
→ `_parse_feed` retries → `iter_results` → `collect_papers` → `main` are all the repo's own
unmodified functions) against a local server answering **HTTP 500** — the realistic transient case:

```
INFO:root:Querying cat:cs.CV (limit 5) ...
INFO:arxiv:Requesting page (first: True, try: 0..5)     <- 6 attempts = 1 + num_retries
ERROR:root:ArXiv search failed for 'cat:cs.CV': Page request resulted in HTTP 500
ERROR:root:  query failed for cs.CV: Page request resulted in HTTP 500
ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV.
EXIT=1
HTTP_500_RESPONSES=6
OUT_DIR_EXISTS=False CONTENTS=None

real 50.760s
```

So: **a transient arXiv 5xx turns the `web-tests` job red, after ~51 s, writing nothing** — exactly
IMP-004's designed behaviour (`build_index.py:405-410`). Confirmed, not assumed. Note the retry
tuple at `arxiv 3.0.0:696-700` catches `HTTPError`, `UnexpectedEmptyPageError` and
`requests.exceptions.ConnectionError`, so 429/503/connection resets **are** retried up to 5 times
with a 10 s gap each. That is a genuine mitigation, and it is better than the implementer's report
implies.

### 1.4 The unmitigated failure mode: a hang, not a fast failure

Because no `timeout=` is passed (`,729`/`:660`), a server that accepts the connection and never
answers blocks the step **forever**. Measured, not inferred — a black-hole server (accepts, then
sleeps 600 s), killed after 30 s:

```
$ /tmp/verify-imp193-venv/bin/python /tmp/verify-imp193-hangprobe.py
calling build_index.main() with no timeout of its own ...
INFO:root:Querying cat:cs.CV (limit 5) ...
INFO:arxiv:Requesting page (first: True, try: 0): http://127.0.0.1:60266/api/query?%s
REQUEST_RECEIVED -- now sending nothing, ever
STILL BLOCKED AFTER 30s -> no HTTP timeout in the client
```

Consequence: not a 51 s red, but a job that runs to GitHub's **360-minute** job limit. That burns
six runner-hours per occurrence and, once IMP-028 lands (§7), it blocks the required check on
*every* PR meanwhile. A flaky red is annoying; a six-hour hang is a bill.

**Actionable, and cheap — the spec did not forbid it.** Either of these, both `ci.yml`-only, both
zero new dependencies:
- prefix the step: `run: timeout 60 python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data`
  (coreutils `timeout` is present on `ubuntu-latest`; it is already relied on by nothing here, so
  verify on first run), or
- add `timeout-minutes: 10` to the `web-tests` job.

A source-level fix would be to give `scripts/arxiv_common.py:20-26` a real request timeout, but
that is outside this item's file scope and belongs in its own backlog item. I did not make any of
these changes.

### 1.5 Does the spec genuinely mandate a network call? Yes — I read it myself

I did not take the implementer's reading on trust. AC1 (`FEATURES.md:1791`):

> the `web-tests` job runs `python scripts/build_index.py` into `web/public/data/` before the
> `Build` step … with **bounded flags — `--category cs.CV --max-per-category 5 --out-dir
> web/public/data`** … state which, because a wrong resolution writes the index somewhere the build
> cannot see.

AC3 (`:1793`):

> The step is bounded to one arXiv page and **fails the job** if it cannot produce an index … and the
> flags are small enough that **the client** sleeps `delay_seconds=10` between pages
> (`scripts/arxiv_common.py:16`) exactly once.

Both name the script, the flags, *and* the client. A heredoc fixture writes `index.json` without
running `scripts/build_index.py` and without a client, so it fails AC1's verb, fails AC3's verb
("fails the job **if it cannot produce an index**" only has meaning against the real ETL), and
leaves AC5's `ls web/dist/data` check satisfied by a hand-written second copy of a wire format the
profile already flags as hand-mirrored and unvalidated (`REPO_PROFILE.md` §8 trap 1).

**Judgement: the implementer did not over-read the criteria. A network-free fixture would NOT
satisfy them.** The tension is real and belongs in the report, but it is the *spec's* tension: the
backlog author chose a live-network gate and priced it at `Risk: med` in the item's own Notes
(`:1800`, "the step adds a **network** call to a job that is currently offline and deterministic, so
an arXiv outage turns a green PR red"). An implementer who follows that is not at fault.

### 1.6 Two corrections to the spec's risk model, in the item's favour

1. **The `web-tests` job was never offline.** `npm ci` (`ci.yml:39-40`) fetches
   `registry.npmjs.org` on any cache miss, and `setup-node`'s `cache: npm` (`:37-38`) is itself a
   network fetch from the Actions cache. This change adds **PyPI and arXiv**, not "the first
   network call". The marginal blast radius is smaller than `FEATURES.md:1800` claims.
2. **The repo's own standing guidance already blesses this shape.** `REPO_PROFILE.md:253-260`:
   *"Do not add a test that hits the network"* → *"prefer a network-free test … If a network test is
   genuinely unavoidable, fall back to a tiny smoke run: `python scripts/build_index.py --category
   cs.CV --max-per-category 20 --out-dir /tmp/<something>` and check exit 0 + an `index.json` was
   written."* IMP-193 is a small `20` in that very template. It is not against house style.

**Net judgement on the tradeoff: acceptable, and the spec is the binding constraint — but it should
be bounded.** One request per run, 0.26 s, six retries on 5xx, one category, five papers. The
residual failure modes are (a) a fast red on sustained arXiv failure (~51 s) and (b) an unbounded
hang. (a) is the cost AC3 explicitly asks for. (b) is a genuine gap, is not covered by any AC, and
is worth a `timeout` (see §1.4). I do not think it blocks this item; I would file it.

---

## 2. The step is load-bearing — reproduced independently in `/tmp`

Scratch: `/tmp/verify-imp193-proof` (`web/public/` contained only `favicon.svg`; `dist` removed).

**A. Without the index step — today's `ci.yml`, i.e. IMP-026's gate:**

```
$ rm -rf web/public/data web/dist && npm --prefix web run build
BUILD_EXIT=0
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXju.js   171.45 kB │ gzip: 54.92 kB
✓ built in 402ms
$ ls web/dist            ->  assets  favicon.svg  index.html
$ ls web/dist/data       ->  ls: web/dist/data: No such file or directory
```

**B. With the index step, run exactly as `ci.yml:45-47` declares:**

```
$ python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
INDEX_EXIT=0
INFO:root:Wrote 5 papers across 1 shards to web/public/data
$ ls web/public/data      ->  index.json  papers-2026-W40.json
$ npm --prefix web run build
BUILD_EXIT=0
dist/assets/index-D7spZXju.js   171.45 kB │ gzip: 54.92 kB
✓ built in 379ms
$ ls -la web/dist/data
-rw-r--r--    1  287  index.json
-rw-r--r--    1 4586  papers-2026-W40.json
```

Confirmed on my own runs: **exit 0 and no `dist/data` without the step; `dist/data/index.json` plus a
`papers-*.json` shard with it (AC5).** The JS asset content hash `index-D7spZXju.js` is **identical**
in both states (171.45 kB), which proves the gate was *silent*, not merely lenient — matching the
item's Intent and IMP-026's finding. The step is load-bearing and the new gate can now fail closed.

---

## 3. Step ordering, path resolution, `npm ci`, and `pip install` interference

Resolved job as PyYAML sees it (`web-tests`, `defaults.run.working-directory: web`):

```
   actions/checkout@v4              wd=None
   actions/setup-python@v5          wd=None   with={'python-version': '3.x'}
   Install dependencies             wd='.'    run='pip install -r requirements.txt'
   actions/setup-node@v4            wd=None   with={'node-version': '20', 'cache': 'npm', 'cache-dependency-path': 'web/package-lock.json'}
   Install dependencies             wd=None   run='npm ci'
   Typecheck                        wd=None   run='npm run typecheck'
   Run tests                        wd=None   run='npm test'
   Build the paper index            wd='.'    run='python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data'
   Build                            wd=None   run='npm run build'
```

- **Ordering correct:** index step at `:45-47` is immediately before `Build` at `:48-49`. This is
  the order IMP-193's own Verification method demands (`Install dependencies → Typecheck → Run tests
  → index build → Build`) and the order `deploy.yml:33-34 → :46-48` already uses.
- **`working-directory: .` is correct, and both branches of AC1's disjunction are impossible.** AC1
  permits "`web` + relative flags" or "unset + `web/public/data`". AC1 also fixes the command as
  `python scripts/build_index.py`. There is no `web/scripts/`, so from `web/` the command cannot
  resolve; and leaving `working-directory` unset means `web/`, where it also cannot. The only
  correct form is the repo root, which is what step-level `working-directory` gives: GitHub docs
  §`jobs.<job_id>.steps[*].working-directory` — *"you can specify the working directory of where to
  run the command"*, overriding `defaults.run.working-directory`, resolved against `github.workspace`.
  I verified both halves empirically in the scratch tree (§2B): files landed in
  `web/public/data` and Vite copied them into `dist/data`. `DEFAULT_OUT_DIR` at
  `build_index.py:36` is the same path, so the explicit `--out-dir` is a no-op-safe restatement.
  AC1 asks the implementer to *state which* was used; `impl-IMP-193.md` §1.1 does. Not a violation —
  a forced, documented correction to a defective criterion.
- **`npm ci` ordering:** `npm ci` (`:39-40`) runs well before `Build` (`:48-49`). It is also
  irrelevant to the index step, which is pure Python and needs no `node_modules`. No dependency
  ordering hazard either way.
- **`pip install` cannot shadow or conflict:** it installs `arxiv`, `pandas` (+ `numpy`, `requests`,
  `feedparser`, `certifi`, `urllib3`) into `setup-python`'s site-packages. It touches no `PATH`
  entry node/npm resolution depends on, installs nothing named like a node tool, and
  `requirements.txt` is the same file `python-tests` already installs. The only ordering effect: a
  PyPI outage now fails the job before `npm ci` instead of after — strictly cheaper, since `npm ci`
  would have failed too.
- **AC2 byte-identity:** the new step's `name:` (`Install dependencies`) and `run:`
  (`pip install -r requirements.txt`) are byte-identical to `ci.yml:16-17`; only `working-directory:
  .` is inserted between them, which is required for the same reason as above. `actions/setup-python@v5`
  + `python-version: "3.x"` matches `deploy.yml:26-28` and `ci.yml:13-15` exactly. No new action
  version, no new dependency. **AC2 met.**

---

## 4. No new dependency, no gitignore change, no committed fixture

```
$ git --no-pager diff --stat
 .github/workflows/ci.yml      |  9 +++++++++
 .improve/FEATURES.md          |  4 ++--      (coordinator status flips; IMP-025 + IMP-193)
 readme.md                     |  3 +++        (concurrent agent, IMP-025)
 tests/test_paper_collector.py | 39 ++++++...  (concurrent agent, IMP-025)
```

- `requirements.txt` **not modified** (absent from the diff; mtime Sep 10/Oct 2 00:48 predates this
  work; its `arxiv>=2.1.0,<4` upper bound is IMP-033's, not this item's).
- **No lockfile added.** `web/package-lock.json` is tracked and unmodified; `git ls-files` on
  lock/requirement/constraint patterns returns exactly `requirements.txt` and
  `web/package-lock.json`, both pre-existing.
- `.gitignore` **not touched** (absent from the diff; mtime `Sep 11 02:03:18`, i.e. pre-existing
  `web/public/data/` at root `.gitignore:12` and `web/.gitignore:9` are intact).
- `.git/info/exclude` **not touched** — its 52 lines are all pre-existing Kilo/`.improve` entries,
  mtime `Oct 2 00:34:12`, well before this change (`ci.yml` mtime `Oct 2 15:12:49`).
- `git ls-files web/public/` → **`web/public/favicon.svg` only.** No index, no shard, no fixture.
- `git status --porcelain --ignored -- web/public/` → `!! web/public/data/` — still ignored.
- **AC "no fixture committed" holds; the index remains purely a CI-run artifact.**

---

## 5. CI-only vs the developer's local experience — unchanged

```
$ cd web && npm run typecheck          -> tsc --noEmit, no output
TYPECHECK_EXIT=0
$ cd web && npm test
 Test Files  16 passed (16)
      Tests  253 passed (253)
   Duration  4.32s
$ cd web && npm run build
✓ 41 modules transformed.
dist/assets/index-D7spZXju.js   171.45 kB │ gzip: 54.92 kB
✓ built in 443ms
BUILD_EXIT=0
```

Unchanged, as it must be: the diff touches one workflow file and no `web/` source, no
`vite.config.ts`, no `package.json`. `web/public/data` in the working tree is **untouched** —
still `index.json` 495 B, `papers-2026-W39.json` 248,344 B, `papers-2026-W40.json` 2,383,763 B
(mtimes `Oct 2 15:13`, before my session). I deliberately ran every `build_index.py` probe against
`/tmp` so I never clobbered the developer's local index. Local developers keep their existing
`build_index.py` → `npm run build` workflow unchanged.

---

## 6. YAML validity and every `run:` line

```
$ /usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml'))"
YAML OK
top keys: ['name', True, 'jobs']        # True == the `on:` key, YAML 1.1 boolean quirk, pre-existing
permissions: None
triggers: {'push': {'branches': ['main']}, 'pull_request': None}
jobs: ['python-tests', 'web-tests']
```

`web/package.json` scripts: `['build', 'dev', 'preview', 'test', 'test:watch', 'typecheck']`.

| `run:` line | resolves to | ok |
| --- | --- | --- |
| `:17 pip install -r requirements.txt` | `requirements.txt` at repo root | ✅ |
| `:19 python -m unittest discover -s tests -v` | `tests/` at repo root | ✅ |
| `:33 pip install -r requirements.txt` | same, `wd='.'` | ✅ |
| `:40 npm ci` | npm built-in (not a package script) | ✅ |
| `:42 npm run typecheck` | `typecheck` in package.json | ✅ |
| `:44 npm test` | `test` = `vitest run` | ✅ |
| `:47 python scripts/build_index.py …` | `scripts/build_index.py` at repo root | ✅ |
| `:49 npm run build` | `build` = `tsc --noEmit && vite build` | ✅ |

- **`npm run lint` was NOT added** — `grep -rn "npm run lint" .github/` returns nothing, and no
  `lint` script exists in `web/package.json`. (This also satisfies `REPO_PROFILE.md:297-298`: "A
  `npm run lint` step is a bug, not a gate.")
- **Nothing pre-existing was weakened:** `git diff -U0 -- .github/workflows/ci.yml | grep -c '^-[^-]'`
  → **0**. Every removed-line count is zero; the change is purely additive. Comparing against
  `git show HEAD:.github/workflows/ci.yml`: `name`, `on` (push-main + pull_request), both job ids,
  `runs-on: ubuntu-latest`, `python-tests`' four steps, `web-tests`' `defaults.run.working-directory: web`,
  `actions/checkout@v4`, `actions/setup-node@v4` + `node-version: "20"` + `cache: npm` +
  `cache-dependency-path: web/package-lock.json`, and the `npm ci`/`typecheck`/`test`/`build` steps
  are all byte-identical.
- **Triggers, permissions, caching, action versions: unchanged.** `permissions` is still absent
  (default token scope) exactly as at HEAD; caching is still the single `setup-node` npm cache;
  the one new `uses:` is `actions/setup-python@v5`, the same version and `python-version` already
  used at `ci.yml:13-15` and `deploy.yml:26-28`. No SHA-pinning regression (IMP-134's job,
  untouched).
- **No duplication:** `python -m unittest discover -s tests -v` appears only in `python-tests`
  (`:19`), never in `web-tests` — IMP-041's job in `deploy.yml` is not pre-empted. **AC4 met.**
- **Cosmetic nit (non-blocking):** the job now has two steps both named `Install dependencies`
  (`:31` pip, `:39` npm). Legal; `deploy.yml:30,42` avoids it with `Install Python dependencies` /
  `Install web dependencies`. A one-word rename would be clearer in the UI. AC2's byte-identity
  requirement is the reason, and I would not reopen the item over it.

---

## 7. IMP-028 compatibility

IMP-028 (`FEATURES.md:604-618`, TODO, 20.0) AC1: *"`vite build` (or the `build` script) fails with
a non-zero exit … when that file [`public/data/index.json`] is absent"*, and its Area names
`web/vite.config.ts:4-11` and `web/package.json:8` (`"build": "tsc --noEmit && vite build"`).

- The guard therefore fires **inside `npm run build`**, i.e. inside `ci.yml:48-49`.
- The index step at `:45-47` writes `web/public/data/index.json` **before** that, so once IMP-028
  lands the guard passes. **Ordering is right; IMP-193 does satisfy IMP-028's prerequisite and IMP-028
  can now ship safely.** This is the item's load-bearing ordering constraint (`:1800`) and it holds.
- `deploy.yml` is unaffected: its index step (`:33-34`) already precedes its build (`:46-48`).
- **Failure does stop the job — verified.** My HTTP-500 probe returned `EXIT=1` (§1.3); PyYAML shows
  `continue-on-error=None` on **every** step in both jobs, and the `run:` string contains no
  `|| true`, no `;`, no `set +e`. GitHub Actions skips subsequent steps after a non-zero step exit
  by default, so `Build` never runs and the job goes red. AC3's "no `continue-on-error`, no
  `|| true`" is satisfied.
- **One consequence worth stating for IMP-028's implementer:** after IMP-028 lands, this network
  step becomes load-bearing for the *required check on every PR*, not just for deploys. That raises
  the value of bounding the hang (§1.4) from "nice" to "should do before or with IMP-028".

---

## 8. Python suite unaffected

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 78 tests in 0.047s
OK
```

78 tests, 0 failures, 0 errors. The suite is untouched by this item — the diff contains no `tests/`
change attributable to IMP-193 (`tests/test_paper_collector.py`'s `+39` is a concurrent agent's
IMP-025 work, present in the working tree but unrelated; it explains the 78 vs the 77 figure the
brief quoted, and the implementer flagged the same discrepancy).

---

## 9. Findings summary

**Blocking: none.**

| # | Severity | Finding | Actionable? |
| --- | --- | --- | --- |
| 1 | med | **No HTTP timeout on the arXiv client** (`arxiv 3.0.0:729`, `2.1.3:660`), so a slow/hung endpoint blocks the step indefinitely — measured still blocked at 30 s; a real CI occurrence would burn the 360-minute job limit. Not covered by any AC. | **Yes.** `timeout 60 python …` on `ci.yml:47`, or `timeout-minutes:` on the job. Worth doing before or with IMP-028. |
| 2 | info | **Spec defect, not implementation:** AC3's "sleeps `delay_seconds=10` … exactly once" is false — measured 0 sleeps (`arxiv 3.0.0:719`). Implementer disclosed rather than faked. | Already handled correctly; record for whoever owns the spec. |
| 3 | info | **Spec defect, not implementation:** AC1's `working-directory` disjunction has no correct branch (no `web/scripts/`). `working-directory: .` is the only correct form, and AC1's "state which" was honoured. | None. |
| 4 | info | **Spec risk model is overstated:** `FEATURES.md:1800` calls `web-tests` "offline and deterministic", but `npm ci` already requires `registry.npmjs.org` and the setup-node cache is itself a network fetch. Marginal risk is smaller than stated. | None — noted for the record. |
| 5 | cosmetic | Two steps named `Install dependencies` in `web-tests` (`:31`, `:39`). | Optional rename to match `deploy.yml:30,42`. |
| 6 | cosmetic | `pip install` is uncached in `web-tests`, duplicating ~10–40 s of install that `python-tests` already pays. | Optional `cache: pip` on `setup-python` (AC2 constrains the version, not `with:`). |
| 7 | doc drift | `REPO_PROFILE.md:302` and `readme.md:122-125` still describe CI as not building an index. Already stale after IMP-026; no AC requires the update. | Out of scope; hand to the coordinator. |

**On the question I was asked to press hardest — should this step be network-free?** No, not as
specified. AC1 and AC3 name `scripts/build_index.py`, its flags, and the client by path and line, so
a fixture is non-compliant, and the repo's own `REPO_PROFILE.md:253-260` explicitly sanctions this
exact tiny smoke run as the fallback when a network check is unavoidable. The implementer's reading
of the criteria was correct and the residual flakiness is the spec author's choice, priced at
`Risk: med` in the item itself. What the implementer could reasonably have added — and did not — is
a bound on the one failure mode the spec never mentions: the unbounded hang. One `timeout 60`
prefix closes it. Everything else about this change is correct, minimal, additive, and correct in
its ordering.

**Verification hygiene:** read-only except this report. No source file modified; no `git add`,
`commit`, `push`, or any remote interaction; `.kilo/worktrees/mildly-income` never accessed.
Scratch artifacts confined to `/tmp/verify-imp193-venv`, `/tmp/verify-imp193-proof`,
`/tmp/verify-imp193-500probe.py`, `/tmp/verify-imp193-hangprobe.py`, `/tmp/verify-imp193-*.log`.
`git status --porcelain` at the end differs from the start only by other agents' report files.
