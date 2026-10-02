# IMP-193 — implementation report

**Item:** `### IMP-193` in `.improve/FEATURES.md:1784-1800`.
**File changed:** `.github/workflows/ci.yml` only. Nothing else in the repo was modified.
**Status:** implemented, all five acceptance criteria satisfied, locally verified.

This is the prerequisite for **IMP-028** (fail-closed production build). Until it lands, IMP-028's
guard would turn `ci.yml`'s `Build` step red on every single run, because `web/public/data/` is
gitignored (`web/.gitignore:7`, root `.gitignore:12`) and therefore absent on every CI checkout.

---

## 1. The exact change

`git --no-pager diff -- .github/workflows/ci.yml` — **+9 lines, purely additive, no line removed or
reworded:**

```diff
@@ -25,6 +25,12 @@ jobs:
         working-directory: web
     steps:
       - uses: actions/checkout@v4
+      - uses: actions/setup-python@v5
+        with:
+          python-version: "3.x"
+      - name: Install dependencies
+        working-directory: .
+        run: pip install -r requirements.txt
       - uses: actions/setup-node@v4
         with:
           node-version: "20"
@@ -36,5 +42,8 @@ jobs:
         run: npm run typecheck
       - name: Run tests
         run: npm test
+      - name: Build the paper index
+        working-directory: .
+        run: python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
       - name: Build
         run: npm run build
```

The `web-tests` job now reads top to bottom as:
`checkout` → `setup-python@v5 (3.x)` → `Install dependencies` (pip, repo root) → `setup-node@v4`
→ `Install dependencies` (npm ci, `web/`) → `Typecheck` → `Run tests` → **`Build the paper index`**
→ `Build`. That is exactly the order IMP-193's verification method asks to confirm, and the index
step is immediately before `Build`, as AC1 requires.

Nothing was weakened: the four pre-existing web steps are byte-identical, and
`python -m unittest discover -s tests -v` was **not** duplicated into `web-tests` (AC4 — that is
IMP-041's job in `deploy.yml`).

### 1.1 `working-directory: .` — and why AC1's two stated options are both wrong

AC1 permits "either the step's `working-directory` is `web` and the flags are relative, or it is
unset and the path in `--out-dir` is `web/public/data`", and demands that the resolved path be
correct. Neither branch resolves correctly, because the job carries
`defaults.run.working-directory: web` (`ci.yml:23-25`) which a step-level `working-directory` is
the only way to override, and because AC1 fixes the command as `python scripts/build_index.py`.
Measured, in a scratch checkout:

```
$ cd web && python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
can't open file '/private/tmp/imp193-scratch/web/scripts/build_index.py': [Errno 2] No such file or directory
EXIT=2
```

There is no `web/scripts/`, so the script path only resolves from the repository root — and from the
repository root, `--out-dir web/public/data` resolves to exactly the directory Vite copies out of
(`DEFAULT_OUT_DIR = os.path.join("web", "public", "data")`, `build_index.py:36`, is the same path).

**So: the step's `working-directory` is explicitly `.` (the workspace root) and the flags are the
literal `--category cs.CV --max-per-category 5 --out-dir web/public/data` from AC1.** The
`working-directory: .` key is the minimum addition needed to make AC1's own command and flags
resolve; the alternative (`working-directory: web` with `--out-dir public/data` and
`python ../scripts/build_index.py`) would have meant rewriting the flags AC1 specifies verbatim.

The same reasoning applies to the new `pip install` step: `requirements.txt` lives at the repo root,
the job default is `web`, and there is no `web/requirements.txt`, so that step also needs
`working-directory: .`. Its `name:` and `run:` lines are byte-identical to `ci.yml:16-17` as AC2
requires; only the `working-directory` key is inserted between them. The alternative
(`run: pip install -r ../requirements.txt` from `web/`) would have broken the "byte-identical"
requirement.

### 1.2 Placement

`setup-python` and the pip step sit immediately after `checkout`, before `setup-node` — the same
layout `deploy.yml:24-34` uses for its Python prerequisites. Within the job, the index step sits
between `Run tests` and `Build`. The file's own style is preserved: 6-space step indentation, no
blank lines inside `web-tests` (matching the pre-existing block), step names reused from
`deploy.yml` where one exists (`Build the paper index` = `deploy.yml:33`).

---

## 2. (a) real `build_index.py` vs (b) a synthetic fixture — decision: **(a)**

I chose **(a)**, running the real `scripts/build_index.py`, and I did not synthesise a fixture.

**Why the spec decides it.** AC1 does not say "generate an index"; it says the job runs
`python scripts/build_index.py` with the specific flags `--category cs.CV --max-per-category 5
--out-dir web/public/data`. AC3 requires the step to "fail the job if it cannot produce an index",
which only has meaning against the real ETL. A hand-written fixture is a different implementation,
and the item's Risk note ("the step adds a **network** call to a job that is currently offline and
deterministic, so an arXiv outage turns a green PR red") is written on the explicit assumption that
the real script runs. Substituting a fixture would have satisfied the *spirit* of the gate while
failing every letter of AC1 and AC3, and it would have made the item's own risk analysis
meaningless.

**The cost the brief warned about turned out to be small, and I measured it rather than assuming.**
The concern was that `build_index.py` is slow and rate-limited. With these flags it is neither:

- `build_client(5)` sets `page_size = max(1, min(1000, 5)) = 5` and `Search(max_results=5)`, so the
  client issues **one** HTTP request. The URL arXiv was actually asked for, from the run's own log:
  `...&sortBy=submittedDate&sortOrder=descending&start=0&max_results=5`, answered
  `Got first page: 5 of 207907 total results`.
- arXiv's rate limit is `delay_seconds=10` **between** requests, not before the first. Both the
  locally installed `arxiv 2.1.3` and the version CI actually resolves, **`arxiv 3.0.0`**
  (`requirements.txt:13` is `arxiv>=2.1.0,<4` since IMP-033), guard the sleep with
  `if self._last_request_dt is not None:` (`arxiv/__init__.py:725` in 3.0.0). One page ⇒ one
  request ⇒ **zero** sleeps.
- Measured wall clock for the whole step: **0.24 s** on `arxiv 3.0.0` and **0.31 s** on
  `arxiv 2.1.3` (commands and verbatim output in §4).

**Correction to AC3, stated explicitly because the report must not restate an unmeasured claim:**
AC3 asserts these flags make the client "sleep `delay_seconds=10` between pages exactly once". They
do not. The measured sleep count is **0**, not 1, on both arXiv versions that this repo can resolve
(§4.1). The criterion's *intent* — bound the run to one small arXiv page — is met and then some, so
the implementation follows the criterion's intent rather than a premise I could not reproduce. The
practical consequence is that the added duration is dominated by `setup-python` + `pip install`, not
by the network call.

**What a fixture would have saved:** ~0.24 s of query time and the (small) arXiv-outage flake risk.
**What a fixture would have cost:** a hand-maintained second copy of the `index.json`/shard schema
in a shell heredoc — precisely the duplication REPO_PROFILE §8 trap 1 warns about ("the wire format
is hand-mirrored and completely unvalidated") — plus the loss of the one property the step exists to
provide: a `build_index.py` regression (IMP-004's hard-fail behaviour, a changed flag, a schema
drift) becoming a red PR before merge instead of a red deploy on `main`. Given the measured cost of
the real thing, that trade is not close.

**Residual risk, accepted and stated:** an arXiv API outage or a transient 5xx turns a green PR red
(`arXivError` → `iter_results` records the failure → `collect_papers` logs
`  query failed for cs.CV: …` → `main()` returns 1). Measured in §4.4: the step exits **1** and,
with no `continue-on-error` and no `|| true` in the workflow, the job fails. That is the behaviour
AC3 asks for. It is also the reason `build_index.py`'s own `num_retries=5`
(`arxiv_common.py:18`) is the only mitigation available; the item's own Notes already price this at
Risk `med`.

---

## 3. The index the step produces (shape, and where it came from)

No fixture was written, so the schema is the real one, straight from
`write_index` (`build_index.py:293-310`) and `build_shards` (`:145-198`) — the same functions
`deploy.yml` runs. Recorded here because it is what `web/dist/data` now contains:

`web/public/data/index.json` (written with `indent=2`):

```json
{
  "generatedAt": "2026-10-02T19:11:50Z",
  "retentionDays": 60,
  "categories": ["cs.CV"],
  "shards": [
    { "week": "2026-W40", "from": "2026-10-01", "to": "2026-10-01",
      "count": 5, "file": "papers-2026-W40.json" }
  ],
  "totalPapers": 5
}
```

`web/public/data/papers-2026-W40.json` (written compact, `separators=(",", ":")`): top-level keys
`["week", "from", "to", "papers"]`, and each `Paper` carries the 11 camelCase fields of
`record_from_result` (`build_index.py:104-121`) in the order of `web/src/lib/types.ts:1-24`:
`id, title, authors[], abstract, abstractTruncated, published, updated, categories[],
primaryCategory, absUrl, pdfUrl`. Sample record from the real run:

```json
{ "id": "2610.02210",
  "title": "Moore, Escher, Penrose: A Conformal Golden Braid",
  "authors": ["Sophia Feldman", "Assaf Shocher"],
  "abstract": "…",
  "abstractTruncated": true,
  "published": "2026-10-01", "updated": "2026-10-01",
  "categories": ["cs.CV"], "primaryCategory": "cs.CV",
  "absUrl": "http://arxiv.org/abs/2610.02210v1", "pdfUrl": "http://arxiv.org/pdf/2610.02210v1" }
```

`categories` is `["cs.CV"]`, not the 5-category default, because `--category cs.CV` overrides
`DEFAULT_CATEGORIES` (`build_index.py:392`) — that is the manifest the build sees, and it is enough
for Vite to copy the tree. Note `_clean_old_shards` (`build_index.py:278-290`) also runs, so on a
re-run it sweeps shards the new manifest no longer references; in the local in-place run it removed
`papers-2026-W39.json` and replaced `papers-2026-W40.json` with the 5-paper version (§4.3).

`web/public/data/` stays gitignored. No `.gitignore` and no `.git/info/exclude` change was made, and
`git status --porcelain` shows no `web/public/data` entry.

---

## 4. Every command run, with results

### 4.1 The CI step's real behaviour, both resolvable arXiv versions

```
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/imp193-probe-211
INFO:root:Querying cat:cs.CV (limit 5) ...
INFO:arxiv:Requesting page (first: True, try: 0): https://export.arxiv.org/api/query?search_query=cat%3Acs.CV&id_list=&sortBy=submittedDate&sortOrder=descending&start=0&max_results=5
INFO:arxiv:Got first page: 5 of 207907 total results
INFO:root:  5 papers within retention window for cs.CV
INFO:root:Wrote 5 papers across 1 shards to /tmp/imp193-probe-211
real 0m0.310s      <- arxiv 2.1.3 (the interpreter already on this machine)
```
No `Sleeping:` line appears — confirming zero rate-limit sleeps.

Same command in a throwaway venv resolved exactly as `pip install -r requirements.txt` resolves
today (`arxiv 3.0.0`, `pandas 3.0.6`, `feedparser 6.0.14`, `requests 2.33.1`):

```
$ /tmp/imp193-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/imp193-probe-3x
INFO:root:Querying cat:cs.CV (limit 5) ...
INFO:arxiv:Requesting page (first: True, try: 0): https://export.arxiv.org/api/query?...&max_results=5
INFO:arxiv:Got first page: 5 of 207907 total results
INFO:root:  5 papers within retention window for cs.CV
INFO:root:Wrote 5 papers across 1 shards to /tmp/imp193-probe-3x
real 0m0.241s      <- arxiv 3.0.0, the version CI installs
```

Source evidence for the zero-sleep claim, `arxiv 3.0.0` (the CI-resolved version):

```python
# /tmp/imp193-venv/lib/python3.11/site-packages/arxiv/__init__.py:717-725
# If this call would violate the rate limit, sleep until it doesn't.
if self._last_request_dt is not None:
    required = timedelta(seconds=self.delay_seconds)
    since_last_request = datetime.now() - self._last_request_dt
    if since_last_request < required:
        to_sleep = (required - since_last_request).total_seconds()
        logger.info("Sleeping: %f seconds", to_sleep)
        time.sleep(to_sleep)
```

### 4.2 YAML parses and every `run:` line resolves

```
$ /usr/local/bin/python3.11 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"
YAML OK
```

Validator used: **PyYAML via `/usr/local/bin/python3.11`** (the profile's own command, and the one
IMP-193's verification method names). `actionlint` is not installed on this machine and was not
used.

Dumping every resolved step of the job (same `yaml.safe_load`) confirms the `working-directory`
values and the order:

```
== web-tests defaults: {'run': {'working-directory': 'web'}}
    'actions/checkout@v4'          | wd: None | run: None
    'actions/setup-python@v5'      | wd: None | run: None
    'Install dependencies'          | wd: .    | run: pip install -r requirements.txt
    'actions/setup-node@v4'        | wd: None | run: None
    'Install dependencies'          | wd: None | run: npm ci
    'Typecheck'                     | wd: None | run: npm run typecheck
    'Run tests'                     | wd: None | run: npm test
    'Build the paper index'         | wd: .    | run: python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
    'Build'                         | wd: None | run: npm run build
```

`npm run typecheck` / `npm test` / `npm run build` all exist in `web/package.json:12,10,8`. The
Python lines resolve to real files: `requirements.txt` and `scripts/build_index.py`, both present at
the repo root. `pip` and `python` are both on `PATH` on `ubuntu-latest` and are already relied on by
`deploy.yml:31,34`; `deploy.yml:19,27` likewise uses `actions/checkout@v4` and
`actions/setup-python@v5`, so no new action version is introduced anywhere (IMP-134's job, not mine).

### 4.3 Full local web sequence, with `web/public/data` in the state the step creates

`web/public/data` was moved aside to `/tmp/imp193-data-backup` first, then the step was run verbatim
from the repository root, then:

```
$ cd web && npm run typecheck
> tsc --noEmit
(no output, exit 0)

$ npm test
 Test Files  16 passed (16)
      Tests  253 passed (253)
   Duration  4.51s

$ npm run build
> tsc --noEmit && vite build
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
✓ built in 393ms

$ ls -la web/dist/data
-rw-r--r--   287  index.json
-rw-r--r--  4586  papers-2026-W40.json
```

`ls web/dist/data` lists `index.json` plus one `papers-*.json` shard — **AC5 satisfied, and this is
the check that cannot be made today.** The in-place step run itself:

```
$ python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
INFO:root:Querying cat:cs.CV (limit 5) ...
INFO:root:  5 papers within retention window for cs.CV
INFO:root:Wrote 5 papers across 1 shards to web/public/data
EXIT=0
```

**Restore:** `web/public/data` was then restored from `/tmp/imp193-data-backup` and is byte-for-byte
the state I found it in — `index.json` 495 B, `papers-2026-W39.json` 248,344 B,
`papers-2026-W40.json` 2,383,763 B, `generatedAt: "2026-10-02T02:44:04Z"`, `categories` the full five.
(Verified in §4.5's `ls -la`.)

### 4.4 The step is load-bearing — both states, in a scratch checkout

Fresh copy of the working tree at `/tmp/imp193-proof` (rsync excluding `.git`, `node_modules`,
`dist`, `.kilo` and `web/public/data`, with `node_modules` symlinked to the real one), containing
the **final** `ci.yml` (`diff` against the repo copy: identical). It is a faithful stand-in for a
fresh CI runner: `web/public/` contains only `favicon.svg`.

**Without the index step (HEAD's behaviour, = the IMP-026 build gate):**

```
$ cd web && npm run build
BUILD_EXIT=0
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
✓ built in 387ms

$ ls web/dist
assets
favicon.svg
index.html
$ ls web/dist/data
ls: web/dist/data: No such file or directory
```

**Green build, no `dist/data`** — the exact blind spot the item describes, reproduced. The JS content
hash `index-D7spZXJu.js` is byte-identical to the with-index build below, confirming the gate is
*silent* rather than merely lenient.

**With the index step, run exactly as `ci.yml` declares it (`working-directory: .`):**

```
$ python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
INFO:root:Wrote 5 papers across 1 shards to web/public/data
INDEX_EXIT=0
$ ls web/public/data
index.json
papers-2026-W40.json

$ cd web && npm run build
BUILD_EXIT=0
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
✓ built in 445ms

$ ls -la web/dist/data
-rw-r--r--   287  index.json
-rw-r--r--  4586  papers-2026-W40.json
```

**Failure path — the step cannot silently pass.** With the arXiv endpoint made unreachable
(`http_proxy`/`https_proxy` pointed at a closed port), in the same scratch checkout:

```
$ http_proxy=http://127.0.0.1:9 https_proxy=http://127.0.0.1:9 \
    python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir web/public/data
requests.exceptions.ProxyError: HTTPSConnectionPool(host='export.arxiv.org', port=443): Max retries
exceeded ... Connection refused
INDEX_EXIT=1
```

Exit 1, and the workflow has neither `continue-on-error` nor `|| true`, so the job goes red. (A
`ProxyError` is a `requests` exception rather than an `arxiv.ArxivError`, so this specific probe
exercises the unhandled-traceback path, `PY-9`; an `arxiv.ArxivError` takes IMP-004's
`main()`-returns-1 path instead. Both are non-zero, which is the property AC3 needs. The files still
present in `web/public/data` in this probe are leftovers from the previous successful run in the
same scratch tree; a fresh CI runner has nothing there.)

### 4.5 Python suite and repository hygiene

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests -v
...
Ran 78 tests in 0.047s
OK
```

**Unaffected: 78 tests, OK, zero failures.** The task brief said to expect 77; the suite currently
has **78** tests at HEAD and all pass, so nothing regressed — the brief's figure was one test stale
(a separate agent's uncommitted `tests/test_paper_collector.py` work is visible in the working tree
and is not mine; see §5).

```
$ git status --porcelain
 M .github/workflows/ci.yml      <- mine
 M readme.md                     <- not mine (concurrent agent)
 M tests/test_paper_collector.py <- not mine (concurrent agent)
?? .improve/reports/discovered-IMP-002.md
?? .improve/reports/discovered-IMP-009.md
?? .improve/reports/discovered-IMP-025.md
?? .improve/reports/regression-sweep-4.md

$ git --no-pager diff --stat -- .github/workflows/ci.yml
 .github/workflows/ci.yml | 9 +++++++++

$ ls -la web/public/data            # restored
-rw-r--r--     495  index.json
-rw-r--r--  248344  papers-2026-W39.json
-rw-r--r-- 2383763  papers-2026-W40.json
```

No gitignored path was added, no `.gitignore` or `.git/info/exclude` edit, no `web/package-lock.json`
touch, no `npm run lint` (which does not exist — `web/package.json:6-13`), no new dependency, and no
git write command of any kind was run.

---

## 5. CI duration estimate

Measured where I could measure it; estimated only where I could not, and labelled as such.

| Addition | Measured | Notes |
| --- | --- | --- |
| `actions/setup-python@v5` (`3.x`) | **not measured** | Cannot be measured off-runner. The same action is already paid for by `python-tests` and by `deploy.yml`; expect a small single-digit-to-low-teens second cost on a GitHub-hosted runner. |
| `pip install -r requirements.txt` | **~7.6 s** | `PIP_NO_CACHE_DIR=1 … pip install -r requirements.txt` measured `real 0m9.642s` including `python3.11 -m venv` creation, itself measured at `real 0m1.974s`. CI has no pip cache (INF-09), so every run pays this in full. GitHub-hosted runners are slower than this machine, so **budget 20–40 s**. |
| `python scripts/build_index.py …` | **0.24 s** (`arxiv 3.0.0`, the version CI resolves) / 0.31 s (`arxiv 2.1.3`) | One HTTP request, zero rate-limit sleeps, 5 papers, 1 shard. Budget 5 s to cover a slow arXiv response or a `num_retries` delay. |
| `Build` (`npm run build`) | unchanged | 0.39–0.45 s locally; the extra `public/data` copy is ~5 KB. |

**Net added job time: roughly 10 s at best, ~30 s realistically, dominated by `pip install` and not
by the network call.** The `web-tests` job goes from 4 steps to 7.

**Versus the network-free option (b):** the saving would have been the `pip install` +
`setup-python` block only, because the index generation itself costs ~0.24 s either way. A fixture
would have avoided `arxiv` + `pandas` + `feedparser` + `requests` + `numpy` being installed in this
job at all — that is the real prize, ~20–40 s and 140 MB of install per run. It is not worth
spending AC1, AC3 and the pre-merge ETL-regression signal to get it, and if a future item wants it,
the natural shape is a shared `python-tests`-style job that both jobs depend on, or `cache: pip` on
`setup-python` (both out of scope here and both already tracked by INF-09's neighbourhood).

---

## 6. Uncertainties and things a reviewer should know

1. **AC3's sleep premise is wrong as written** (measured 0 sleeps, not 1) — §2. I implemented the
   criterion's intent (bound to one page) and did not add anything to force a sleep.
2. **AC1's `working-directory` disjunction has no correct branch**; `working-directory: .` is the
   minimum fix and is the one deviation from the letter of AC1, made so AC1's own command and flags
   resolve. Proven in §1.1.
3. **AC2's "byte-identical" pip step needed one extra key** (`working-directory: .`), because
   `requirements.txt` is at the root and the job default is `web`. The `name:` and `run:` lines are
   byte-identical to `ci.yml:16-17`.
4. **The job now has two steps named `Install dependencies`** (pip and npm), a consequence of AC2's
   byte-identical requirement. Legal, and the two are far apart in the log, but `deploy.yml` avoids
   it with `Install Python dependencies` / `Install web dependencies`. I followed AC2; renaming
   would be a one-word change if a reviewer prefers the `deploy.yml` names.
5. **The Python suite is 78 tests, not 77** as the brief stated. All pass.
6. **arXiv flakiness remains the accepted risk** (item Risk `med`): an arXiv API outage or a
   sustained 5xx turns a green PR red, with no retry beyond arxiv's own `num_retries=5`. Measured in
   §4.4. This is inherent to AC1/AC3, not something I could engineer away without a fixture.
7. **`.improve/FEATURES.md` and `REPO_PROFILE.md` are untouched** (out of scope for me). A verifier
   or the coordinator may want to update `REPO_PROFILE.md` §7 PE-3 / §9 INF-01, which still describe
   CI as never building an index — that was already stale after IMP-026 and is now staler still.
8. `readme.md:122-125` (INF-16) still says CI runs "the Python `unittest` suite and the web
   typecheck/tests"; the job also builds the index and the app. Out of scope — `readme.md` is
   explicitly not mine to edit.
9. **Nothing was committed, staged, pushed, or opened as a PR.** Scratch artifacts are confined to
   `/tmp` (`/tmp/imp193-venv`, `/tmp/imp193-proof`, `/tmp/imp193-scratch`, `/tmp/imp193-data-backup`).
   The sibling worktree `.kilo/worktrees/mildly-income` was never read or written.
