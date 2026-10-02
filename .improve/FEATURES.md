# IMPROVEMENT BACKLOG — `research-paper-feed`

Recon 2026-10-02 against baseline SHA `1c075b3`. Every item below cites a real path in this
repository and, where the defect is behavioural, an observed symptom from
`.improve/REPO_PROFILE.md` or the six `.improve/reports/recon-*.md` files. No invented
problems, no speculative rewrites.

**Total items: 164** — 148 `TODO`, 7 `NEEDS-HUMAN`, 9 `DONE`.

**Status legend**

| Status | Meaning |
| --- | --- |
| `TODO` | Not started and executable as written. |
| `NEEDS-HUMAN` | Blocked on a product, design, cost, or policy decision that an implementer must not make unilaterally. The decision to make is stated in Notes; the item does not disappear. |

**Priority score** = `impact (1–5) × confidence (1–5) ÷ effort`, where `effort` is `S = 1`,
`M = 2`, `L = 3`. Impact is the user/operator harm removed, confidence is how certain recon is
that the problem exists as written, effort is the honest implementation size. `5 × 5 ÷ 1 = 25.0`
is the best attainable score and `5 × 5 ÷ 2 = 12.5` is the ceiling for any `M`-effort item —
a score above 12.5 on an `M` or `L` item is arithmetically impossible and was corrected during
critique. Items are ordered by score, highest first; a dependency always appears above its
dependents. `NEEDS-HUMAN` items are ordered by score like any other but are not executable as
written.

**Baseline (do not regress; do not claim to have fixed)**
`/usr/local/bin/python3.11 -m unittest discover -s tests -v` → 44 tests OK.
`cd web && npm run typecheck && npm test && npm run build` → all clean, 69 tests across 5 files.
`jupyter nbconvert --execute notebooks/paper-collector.ipynb` → pre-existing failure (PE-7).
`cd web && npm run lint` → does not exist (PE-6/INF-04).

**Verification vocabulary used throughout** (all from `.improve/REPO_PROFILE.md` §3–§4)
Python gate: `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
Web gate: `cd web && npm run typecheck && npm test && npm run build`.
Smoke data run: `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV
--max-per-category 20 --out-dir /tmp/<scratch>`.
Dev server: `cd web && npm run dev -- --port 5199 --strictPort`, app served at
`http://localhost:5199/research-paper-feed/`.
Visual: Playwright at 1280px and 390px, screenshots under `.improve/artifacts/<IMP-ID>/`,
compared against the 14 files in `.improve/artifacts/baseline/`.

**Evidence rules for implementer and verifier reports.** `.improve/` is this loop's only memory,
so an untraceable figure in a report is worse than a missing one — the next implementer reads it as
a baseline. Established after `.improve/reports/verify-IMP-012.md` found three wrong line numbers,
a wrong computed-font-size table, and a build-size figure ("CSS 8.85 kB / JS 382.45 kB") that no
build ever produced, stated next to a "same as baseline" claim its own numbers contradicted (real:
10.93 kB / 163.72 kB). Item IMP-167 owns the process change.
1. **Line numbers** cited in a report must be read from the file they name, not recalled.
2. **Build sizes, test counts, contrast ratios, timings** must appear with the command that produced
   them and its output, quoted verbatim.
3. **A figure not measured is omitted**, never estimated. If it could not be measured, say so and
   say why — that is itself evidence, and it is what `.improve/reports/discovered-IMP-005.md` §2
   did correctly about an unverifiable Node engine floor.

**Never proposed (do-not-touch from profile §6)**
`.kilo/worktrees/mildly-income/`, `.git/hooks/`, `.git/info/exclude`, `LICENSE`,
`web/dist/`, `web/node_modules/`, `web/public/data/`, `results/*.html`, `results/*.csv`,
`*.pyc`, `__pycache__/`, `.DS_Store`. `web/package-lock.json` is touched only by IMP-005 and
IMP-137, which both require it, and only via `npm install`. `readme.md` stays lowercase. No
proposed item renames `scripts/paper-collector.py`.

---

## Contents

| Tier | Score | Items |
| --- | --- | --- |
| 25.0 | `5 × 5 ÷ 1` | IMP-001 … IMP-005, IMP-143, IMP-151, IMP-154 |
| 20.0 | `5 × 5 ÷ 1` / `5 × 4 ÷ 1` | IMP-007 … IMP-040 (IMP-022 absorbs the former IMP-047 and IMP-048; IMP-010 absorbs the former IMP-057) |
| 15.0 | `4 × 4 ÷ 1` … `3 × 5 ÷ 1` | IMP-042 … IMP-092 (less the merged ids), plus IMP-144, IMP-145, IMP-147, IMP-152, IMP-155 … IMP-157 |
| 12.5 | `5 × 5 ÷ 2` | IMP-006, IMP-041, IMP-093, IMP-094 |
| 12.0 | `4 × 4 ÷ 2` | IMP-095 … IMP-097, IMP-146, IMP-153, IMP-158, IMP-159 |
| 10.0 | `3 × 3 ÷ 1` … `2 × 5 ÷ 1` | IMP-098 … IMP-115, IMP-148, IMP-150, IMP-160 … IMP-162, IMP-166, IMP-167 |
| 8.0 | `2 × 4 ÷ 1` … `2 × 5 ÷ 2` | IMP-116 … IMP-126, IMP-149, IMP-164, IMP-165 |
| 7.5 | `3 × 5 ÷ 2` | IMP-127 … IMP-131, IMP-163 |
| 6.7 | `4 × 5 ÷ 3` | IMP-132 |
| 6.0 | `3 × 4 ÷ 2` | IMP-133 … IMP-136 |
| 5.0 | `3 × 4 ÷ 3` / `2 × 5 ÷ 2` | IMP-137 … IMP-140 |
| 4.0 | `2 × 4 ÷ 2` | IMP-141 … IMP-142 |

IDs 47, 48 and 57 were retired by absorption and **must not be reused**; the live range is
IMP-001 … IMP-167 minus those three.

**NEEDS-HUMAN (not executable without a decision).** IMP-027 (deploy cadence), IMP-034 (delete
or rewrite the notebook), IMP-088 (adopt a failing security gate), IMP-096 (`robots.txt`
policy), IMP-125 (date locale), IMP-141 (intermediate breakpoint), IMP-142 (print stylesheet).

**Dependency-critical path.**
- IMP-143 (export and test the hash parser) gates IMP-008, IMP-132 and IMP-133. IMP-157 (batching-safe
  `applyState`) is a second prerequisite for those three, since they add bulk controls and keyboard
  shortcuts — the shapes that trip the bug.
- IMP-005 (make component testing possible) gates IMP-037, and IMP-037 gates IMP-129,
  IMP-130, IMP-131 and IMP-132.
- IMP-004 (fail a partial index) gates IMP-040.
- IMP-034 (resolve the notebook fork) gates IMP-035, IMP-036, IMP-077, IMP-078, IMP-079.
- IMP-015 (one bad shard is non-fatal) gates IMP-038. IMP-058 (no orphan snapshots) gates
  IMP-084. IMP-056 (inject `now`) gates IMP-103. IMP-061 (query debounce) gates IMP-062.
- IMP-063 (memoize `isSaved`) gates IMP-064. IMP-021 (write before delete) gates IMP-099.
- IMP-022 (validate CLI flags) gates IMP-051. IMP-085 (`pyproject.toml`) gates IMP-086.
  IMP-093 (arxiv 4 downloads) gates IMP-104. IMP-137 (ESLint) gates IMP-138.
- IMP-154 (validate `categories`/`published` in `isPaper`) complements IMP-018 (error boundary);
  neither substitutes for the other and neither waits on the other.

---

## Tier 25.0 — the worst problems in the repo

### IMP-001 — Reject non-`http(s)` URLs in imported collection papers
- **Status:** DONE
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:51-62` (`isPaper`), `web/src/lib/collections.ts:206-227` (`parseExportPayload`), `web/src/components/PaperCard.tsx:57,91,100,103`
- **Intent:** A hand-crafted collection export can set `absUrl` or `pdfUrl` to `javascript:alert(1)`. `isPaper` validates only `id`/`title`/`authors[]`/`abstract`, so the payload is persisted to `localStorage` and rendered as a clickable `href` on every later load. React does not block `javascript:` in `href`, so this is live for any user who imports a file someone sent them.
- **Acceptance criteria:**
  1. `parseExportPayload` drops any `Paper` whose `absUrl` or `pdfUrl` is present and does not begin with `https://` or `http://` (case-insensitive, after `String(...).trim()`); a payload whose papers array becomes empty after filtering is still returned with `papers: []` (existing behaviour at `collections.ts:217`) rather than throwing. A paper whose `absUrl`/`pdfUrl` is `undefined` (absent) is kept — `isPaper` at `:51-62` does not require them — but is then rendered without an `href` by criterion 2.
  2. A new test in `web/src/lib/__tests__/collections.test.ts` asserts `parseExportPayload` rejects a payload containing `absUrl: "javascript:alert(1)"` while keeping its valid siblings, and separately asserts `absUrl: "https://arxiv.org/abs/2401.12345"` is kept.
  3. `PaperCard.tsx:57,91,100,103` cannot emit a non-`http(s)` href: each of the four `href={…}` sites either receives a validated `https://` string or omits the `href` attribute entirely (React renders no anchor rather than `href={null}`). `PaperCardProps` types for `absUrl`/`pdfUrl` are not widened in this item — that is IMP-019's scope.
  4. `cd web && npm run typecheck && npm test` passes with the new assertions, and no existing test in `web/src/lib/__tests__/collections.test.ts` needed its expectations weakened. Expect the collections file to report 15–16 tests (14 pre-existing + the new cases).
- **Verification method:** `cd web && npm run typecheck && npm test`; then `cd web && npm run dev -- --port 5199 --strictPort`, open `http://localhost:5199/research-paper-feed/#view=collections`, use the Import control with a hand-written JSON file whose one paper has `"absUrl": "javascript:alert(1)"` and whose sibling has `"absUrl": "https://arxiv.org/abs/2401.12345"`, and confirm (a) the malicious paper is absent from the collection after import, (b) the valid sibling is present, and (c) no `href` attribute in the DOM starts with `javascript:` (`[...document.querySelectorAll('a')].every(a => !a.getAttribute('href')?.startsWith('javascript:'))`). Screenshot to `.improve/artifacts/IMP-001/collections-import-javascript-url-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:**
- **Notes:** commit 0beec1b
### IMP-002 — Sanitize `--topic` before it reaches the CLI output paths
- **Status:** DONE
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:138` (`df.to_csv(topic + "_papers.csv", ...)`), `scripts/paper-collector.py:142` (`filename = f"{args.output_dir}/{topic}-..."`), `scripts/paper-collector.py:21-23` (`safe_filename`)
- **Intent:** The raw `--topic` string is interpolated into two output paths with no sanitization, so `--topic '../../escape'` writes outside `results/` and `--topic 'cat:cs.CV AND (a/b)'` raises `FileNotFoundError`. The readme's own example topic (`readme.md:83`) produces a filename containing `:` and `"`, which is illegal on Windows. Distinct from IMP-023, which fixes the `safe_filename` helper itself; this item is the **call site** — routing `--topic` through that helper at all.
- **Acceptance criteria:**
  1. Both output paths are built from one sanitized slug: `safe_filename(topic)` (after IMP-023 lands) or an equivalent helper. After construction, `os.path.realpath` of each path must start with `os.path.realpath(args.output_dir) + os.sep` — asserted for `../../escape`, `a/b`, `..`, `cat:cs.CV AND "3d reconstruction"` (the readme's own example), and a plain `cat:cs.CV`.
  2. A new test in `tests/test_paper_collector.py` calls `main()` with `--topic '../../escape' --output-dir <tmpdir>` against a stubbed `fetch_papers` and asserts (a) the resolved HTML path is inside `<tmpdir>` and (b) no file was created outside it. The `safe_filename("..")` cases belong to IMP-023 and are **not** duplicated here.
  3. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic '../../escape' --max-papers 2 --output-dir /tmp/rpf-topic-escape` and confirm `find /tmp/rpf-topic-escape -type f` lists every new file, that `/tmp/escape*` and the repo root contain none of them, and that `git status --porcelain` is empty.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:**
- **Notes:** commit d3b4a1e
### IMP-003 — Stop memoizing a rejected manifest promise in `PaperIndex`
- **Status:** DONE
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/paperIndex.ts:62,66-71` (`manifestPromise` assignment), `web/src/lib/paperIndex.ts:73-98` (`fetchManifest`), `web/src/App.tsx:148-166` (manifest effect with `[]` deps)
- **Intent:** `getManifest` assigns `this.manifestPromise = this.fetchManifest()` and only ever checks `if (!this.manifestPromise)`. After one rejection the rejected promise is memoized forever, so every later `loadPapers` re-rejects and the app is unrecoverable without a full page reload — the worst data-loading defect in the app.
- **Acceptance criteria:**
  1. On rejection, `manifestPromise` is reset to `null` (via a `catch` that rethrows after clearing) so a subsequent `getManifest()` performs a fresh `fetch`.
  2. A new test in `web/src/lib/__tests__/paperIndex.test.ts` makes the first `fetch` reject, then resolves on the second call, and asserts the second `getManifest()` resolves to the manifest and that `fetch` was called exactly twice.
  3. `cd web && npm run typecheck && npm test` passes with the existing shard-cache and error-shape tests unchanged.
- **Verification method:** `cd web && npm run typecheck && npm test`; then with `web/public/data/` empty, load `http://localhost:5199/research-paper-feed/`, confirm the error panel appears, restore the index, and confirm a reload (not a second in-page attempt) is still needed only until IMP-007 lands. Screenshot to `.improve/artifacts/IMP-003/feed-index-missing-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:**
- **Notes:** commit pending
### IMP-004 — Refuse to write an index after any category's arXiv query failed
- **Status:** DONE
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/arxiv_common.py:52-59` (`iter_results` swallowing `arxiv.ArxivError`), `scripts/build_index.py:203-221` (`collect_papers` per-category loop and count log), `scripts/build_index.py:186-187` (`manifest["categories"]`), `scripts/build_index.py:289-291` (empty-index refusal)
- **Intent:** A mid-run arXiv failure looks identical to "no new papers": `iter_results` logs and stops, `collect_papers` prints the same cheerful count, `manifest["categories"]` still lists all five requested categories, `generatedAt` is stamped fresh, and the deploy exits 0. A green deploy is currently not evidence the index is complete.
- **Acceptance criteria:**
  1. `iter_results` exposes whether iteration ended by exhaustion or by an `arxiv.ArxivError` (for example a small mutable result holder or a `Result`-carrying exception path), and `collect_papers` records that per category.
  2. `main()` returns a non-zero exit code and writes nothing when any requested category's query failed; the log states which categories failed. Alternatively, if the implementer chooses a degraded index, the failure must be visible in `index.json` and in the UI — pick one and say which in the PR body.
  3. A new test in `tests/test_build_index.py` drives `main()` with a fake `iter_results` that raises `arxiv.ArxivError` for one category and returns records for another, and asserts the non-zero exit and that `index.json` was not written.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-failcheck` still exits 0 on a healthy network, and `echo $?` is `0`; confirm a simulated failure via the new unit test rather than by unplugging the network.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:** Risk is `med` because the failure-reporting shape is a real design choice (hard fail vs. degraded index with a visible flag) and hard-failing could turn a partial outage into a red deploy. The choice must be recorded. | verifier PASS 3/3; 39 py tests

### IMP-005 — Make component and DOM testing possible
- **Status:** DONE
- **Category:** Test coverage & test quality
- **Type:** tooling
- **Area / files:** `web/vite.config.ts:7-10` (`test.environment: "node"`, `test.include: ["src/**/*.test.ts"]`), `web/package.json:6-25` (scripts and devDependencies), `web/package-lock.json`
- **Intent:** `App.tsx` (458 lines) and all four components in `web/src/components/` are untested *by construction*: the vitest environment is `node` and the include glob does not match `.tsx`. This item is the hard prerequisite for every component-test item later in this backlog (IMP-037, IMP-129, IMP-130, IMP-131, IMP-132).
- **Acceptance criteria:**
  1. `jsdom`, `@testing-library/react`, and `@testing-library/user-event` are present in `web/package.json` `devDependencies` and in `web/package-lock.json`, added only via `npm install` from `web/` (never hand-edited).
  2. `web/vite.config.ts` sets `test.environment: "jsdom"` and `test.include` to `["src/**/*.test.ts", "src/**/*.test.tsx"]` (or the equivalent brace glob).
  3. `cd web && npm test` still reports 36 pre-existing tests passing with no failures, and the total test count is 36 (no component test yet — that is IMP-037).
- **Verification method:** `cd web && npm ci && npm run typecheck && npm test`; then `cd web && npm ls jsdom @testing-library/react` and confirm `npm ci` is clean (`npm ci --dry-run` exits 0 with no lockfile drift).
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:** Dependency cost, as required by the profile: three dev-only packages, none shipped in the Pages bundle (`react` + `react-dom` remain the only runtime dependencies). `web/package-lock.json` is on the do-not-touch list, so this item — together with IMP-137 — is one of only two places that may change it, and only via `npm install`. Effort is `S` because the change is three devDependencies plus two config lines; the lockfile regeneration is one command. If `@testing-library/user-event` proves unnecessary for the first smoke test, drop it rather than carrying an unused dep. | commit 894fb9b

### IMP-143 — Export and test `readHash` / `writeHash`
- **Status:** DONE
- **Category:** Test coverage & test quality
- **Type:** refactor
- **Area / files:** `web/src/App.tsx:38-59` (`readHash`, module-private), `web/src/App.tsx:61-85` (`writeHash`, module-private, calling `history.replaceState` at `:83`), new `web/src/lib/urlState.ts`, new `web/src/lib/__tests__/urlState.test.ts`
- **Intent:** The two functions that own the entire URL contract — the `#view=…&q=…&cat=…&recency=…&sort=…` grammar, its defaults, and the push/replace split — are module-private, so the round-trip invariant is untestable. Three other backlog items (IMP-008, IMP-132, IMP-133) are blocked on there being somewhere to put a hash test, and the profile's WEB-37 names this as the defect.
- **Acceptance criteria:**
  1. `readHash` and `writeHash` plus their `HashState` type move to `web/src/lib/urlState.ts` with **named exports only** (profile §5.3), and `App.tsx` imports them. `App.tsx` retains no copy.
  2. A new `web/src/lib/__tests__/urlState.test.ts` asserts, at minimum: `readHash("")` and `readHash("#")` both return `{ view: "feed", query: "", categories: null, recency: 60, sort: "newest" }`; `readHash("#recency=99")` falls back to `60`; `readHash("#view=collections")` returns `view: "collections"`; and `writeHash(readHash(h), "replace").hash` reproduces the same `HashState` for `h` in `#view=collections&q=diffusion&cat=cs.CV,cs.LG&recency=7&sort=relevance`.
  3. `writeHash` is testable without a `window`: the hash string it produces is returned (or captured via an injected writer) rather than only being pushed into history, so no jsdom is required.
  4. `cd web && npm run typecheck && npm test` passes with the 36 pre-existing tests unchanged and the new file reporting at least 6 tests. No new dependency is added.
- **Verification method:** `cd web && npm run typecheck && npm test` (expect 4 files, 42+ tests); then `cd web && npm run build`; then in the browser type a query, toggle a category, switch views, reload, and confirm the address bar still round-trips exactly as before the move. Screenshot to `.improve/artifacts/IMP-143/feed-desktop-1280.png` compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:** This is a pure move plus one new test file; no behaviour may change. The profile forbids moving modules "as a side effect of a feature change" — this item **is** the move, so it is in scope here. `RecencyDays`/`SortMode` stay in `web/src/lib/types.ts` and are imported, not redeclared. | commit 5320dbb

### IMP-151 — Stop `__proto__` from passing the `id in papers` membership check
- **Status:** DONE
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:129` (`mergeImport`'s `.filter((id) => id in papers)`), `web/src/lib/collections.ts:115-117` (`mergeImport`'s `if (!papers[paper.id])` skip), `web/src/lib/collections.ts:283` (`loadState`'s `collection.paperIds.filter((id) => id in papers)`), `web/src/lib/collections.ts:51-62` (`isPaper`, which accepts any string `id`), `web/src/components/PaperCard.tsx:56` (`const canExpand = paper.abstract.length > ABSTRACT_PREVIEW_CHARS`) and `web/src/components/PaperCard.tsx:50` (the same dereference inside the `useMemo`)
- **Intent:** `in` walks the prototype chain, so `"__proto__" in papers` is true for a plain object literal even though no such own key exists. `mergeImport` therefore skips assigning the paper (at `:115`, `papers["__proto__"]` reads `Object.prototype`, which is truthy), but the filter at `:129` keeps `"__proto__"` in `collection.paperIds`. `CollectionsView` then resolves `state.papers["__proto__"]` to `Object.prototype` and hands it to `PaperCard`, where `paper.abstract.length` at `:56` throws `TypeError: Cannot read properties of undefined (reading 'length')`. No error boundary sits above the view, so one crafted import file permanently blanks the collections view for that user until they clear `localStorage`. The same `in` at `:283` lets the poisoned id survive a reload, so the damage is persisted, not one-shot. Confirmed pre-existing: the identical probe run against `git show HEAD:web/src/lib/collections.ts` produces byte-identical output, so this is neither introduced nor worsened by IMP-001.
- **Acceptance criteria:**
  1. Both membership checks become own-property checks — `mergeImport` filters with `Object.hasOwn(papers, id)` at `:129` and `loadState` filters with `Object.hasOwn(papers, id)` at `:283` — and no `in` operator remains anywhere in `web/src/lib/collections.ts`.
  2. `isPaper` (or an equivalent guard inside `parseExportPayload`) rejects prototype-key ids: a paper whose `id` is `"__proto__"`, `"constructor"`, or `"prototype"` is dropped alongside the other `isPaper` rejections, and a payload whose papers array contains only such papers still returns `papers: []` rather than `null`.
  3. `mergeImport` never persists a `paperId` with no own snapshot: importing a payload whose `collection.paperIds` names a paper absent from `papers` yields a stored collection whose `paperIds` excludes that id.
  4. Regression test naming the malicious payload, in `web/src/lib/__tests__/collections.test.ts`: a payload whose `papers` array contains `{ "id": "__proto__", "title": "proto", "authors": [], "abstract": "x" }` plus one valid sibling `{ "id": "2401.00001", … }`, with `"collection": { …, "paperIds": ["__proto__", "2401.00001"] }`. Assert that (a) `parseExportPayload` returns only the sibling, (b) the merged collection's `paperIds` is exactly `["2401.00001"]`, and (c) `Object.prototype.hasOwnProperty.call(state.papers, "__proto__")` is `false`. A second test drives `loadState` with a `Storage` fake whose `rpf.collections.v1` payload names `"__proto__` and asserts the returned collection's `paperIds` is empty.
  5. `cd web && npm run typecheck && npm test` passes with no pre-existing expectation weakened or removed.
- **Verification method:** `cd web && npm run typecheck && npm test` (expect 4 files, 40+ tests); then `cd web && npm run dev -- --port 5199 --strictPort`, open `http://localhost:5199/research-paper-feed/#view=collections`, and import a hand-written JSON containing the `"__proto__"` paper from criterion 4. The collections view must render normally with the sibling card visible, `[...document.querySelectorAll('a')].every(a => !a.getAttribute('href')?.startsWith('javascript:'))` must be `true`, and the console must show no `TypeError`. Screenshot to `.improve/artifacts/IMP-151/collections-import-proto-desktop-1280.png`. Then clear `localStorage` and import the same file again to prove the crash is gone rather than masked by stale state.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:** Same threat model as IMP-001 (a file someone sent you) with higher impact, because IMP-001's `isHttpUrl` filter does not touch this path. IMP-018 (a React error boundary around `<App />`) would blunt the symptom — a crash becomes a `role="alert"` fallback instead of a blank page — but not the defect, since the poisoned id is still written into `paperIds` and `localStorage`; it is a complement, not a substitute. Deliberately scoped to own-property semantics: OBS-1 in `.improve/reports/verify-IMP-001.md` (an array-valued `absUrl` survives `isHttpUrl` because `String(["https://x"])` stringifies to a valid prefix) is not exploitable and belongs with IMP-019's type widening, not here. Found and reported — not fixed — by the independent IMP-001 verifier. | commit pending

### IMP-154 — Validate `categories` and `published` in `isPaper` so a malformed export cannot blank the app
- **Status:** DONE
- **Category:** Data validation
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:68-80` (`isPaper`, which checks only `id`, `title`, `authors`, `abstract`), `web/src/components/PaperCard.tsx:79` (`paper.categories.map((category) => …)`, unguarded), `web/src/components/PaperCard.tsx:73` (`paper.published` → `formatDate`), `web/src/components/PaperCard.tsx:82` (`paper.primaryCategory`)
- **Intent:** `isPaper` is the only gate between a file someone sent you and the renderer, and it validates four of the seven fields `PaperCard` dereferences. An export whose paper omits `categories` throws `TypeError: Cannot read properties of undefined (reading 'map')` at `PaperCard.tsx:79`; with no error boundary above `<App />` the **entire app blanks** — the identical blast radius IMP-151 exists to remove, reached with a payload containing zero prototype keys. The IMP-151 verifier proved this byte-identical on the pre-fix and post-fix trees, so it is pre-existing, independently reachable, and named by no IMP-151 acceptance criterion (none mentions `categories`). It is also the gap that made the verifier's own first attack payload crash: the `{id, title, authors, abstract}` shape is what IMP-151's own criterion-4 payload uses.
- **Acceptance criteria:**
  1. `isPaper` validates every field `PaperCard` dereferences without a guard: `categories` must be `Array.isArray(...)` (of strings), `primaryCategory` must be a `string`, and `published` must be a `string`. The four existing checks and the `PROTOTYPE_KEYS` id check at `:75` are unchanged.
  2. A paper that fails any of those checks is dropped at import exactly like a paper that fails today's checks — silently, per IMP-059's reporting gap — and a payload whose papers all fail still returns `papers: []`, never `null`.
  3. No real shard record is rejected: driving `loadState`/`parseExportPayload` with the committed `web/public/data/papers-2026-W40.json` records must keep all 2,812 papers, because every one of them has all 11 keys with no `null`s. Assert that count in a test rather than by eye.
  4. New tests in `web/src/lib/__tests__/collections.test.ts` cover a payload paper missing `categories`, one missing `published`, and one with `"categories": "cs.CV"` (a string, not an array) — each dropped, each with a fully-populated valid sibling kept, and the sibling present in the merged `paperIds`.
  5. `cd web && npm run typecheck && npm test && npm run build` pass with no pre-existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then at `http://localhost:5199/research-paper-feed/#view=collections` import a payload whose single paper is `{"id": "2401.00009", "title": "No categories", "authors": ["A"], "abstract": "abc"}` — before the fix `#root` has 0 children and the console carries an uncaught `TypeError`; after it, the app renders, the import reports nothing added, and the console is empty per profile §4.2. Screenshot to `.improve/artifacts/IMP-154/collections-import-missing-categories-desktop-1280.png` against `.improve/artifacts/baseline/baseline-collections-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 25.0
- **Notes:** Risk `med` because criterion 1 turns a permissive gate strict and criterion 3 is the guard against silently emptying real collections — that is exactly the failure mode IMP-001 introduced and IMP-151b had to walk back (regression sweep R1), so the "rejected count is zero against the real index" check must be run and reported, not assumed. Deliberately **not** fixed by IMP-018 (a React error boundary): that converts a blank page into a `role="alert"` fallback but still leaves the malformed snapshot in `localStorage`, and it does nothing for the *feed* path. It is a complement, not a substitute. Deliberately **not** fixed by IMP-098, which validates the manifest and shard payloads arriving over the network, not snapshots arriving from a file on disk. The point-of-use guards that would make this class of bug a degraded card rather than a blank page are IMP-160. Recorded as Issue 1 in `.improve/reports/verify-IMP-151.md`, which explicitly asks for its own backlog entry "at the same priority class as IMP-151". | commit pending

## Tier 20.0

### IMP-007 — Add a "Try again" button to the index-unavailable panel
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:364-376` (`.panel--error` block), `web/src/App.tsx:148-166` (manifest effect), `web/src/lib/paperIndex.ts:66-71`
- **Intent:** There is no retry affordance anywhere in the app; a transient network blip on first paint leaves the visitor staring at a dead end until they reload the tab by hand.
- **Acceptance criteria:**
  1. The error panel renders a focusable `<button>` labelled "Try again" that clears `error` and re-invokes the manifest load effect.
  2. Pressing it with the index present on disk transitions the panel to the loading state and then to the feed, without a page reload.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then with `web/public/data/` temporarily moved aside, load `http://localhost:5199/research-paper-feed/`, confirm the button is reachable by Tab, restore `web/public/data/`, click it, and screenshot the recovered feed to `.improve/artifacts/IMP-007/feed-retry-recovered-desktop-1280.png` plus the pre-click panel to `.improve/artifacts/IMP-007/feed-retry-panel-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-003
- **Priority score:** 20.0
- **Notes:**

### IMP-008 — Make relevance sort agree with the Relevance chip
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:215-218` (empty-query short circuit), `web/src/components/FeedControls.tsx:92-99` (`aria-pressed` and `disabled` on the Relevance chip), `web/src/App.tsx:57` (`readHash` accepting `sort=relevance` with no `q`)
- **Intent:** `visiblePapers` short-circuits on an empty query and returns the newest-first list, while the Relevance chip still renders `chip--active` / `aria-pressed="true"`. Clearing the search box, or opening a shared `#sort=relevance` link with no `q`, shows a date-ordered list labelled "Relevance".
- **Acceptance criteria:**
  1. When the trimmed query is empty, the Relevance chip renders with `aria-pressed="false"` and no `chip--active` class, and a visible hint explains that a search term is required.
  2. `readHash` no longer yields `sort: "relevance"` when the hash has no `q` parameter; loading `#sort=relevance` alone produces `sort: "newest"`.
  3. A new test in `web/src/lib/__tests__/urlState.test.ts` (the file IMP-143 creates) asserts `readHash("#sort=relevance")` returns `sort: "newest"`, and a component assertion in `FeedControls` covers the `aria-pressed` flip. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px: type `diffusion`, click Relevance, clear the search box, and confirm the chip is no longer pressed and the list is labelled as date-ordered. Repeat for a URL ending in `#sort=relevance` with no `q`. Screenshots to `.improve/artifacts/IMP-008/feed-relevance-empty-query-desktop-1280.png` and `.improve/artifacts/IMP-008/feed-relevance-hash-only-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-143
- **Priority score:** 20.0
- **Notes:**

### IMP-009 — Validate `#cat=` values against the manifest
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:47-55` (`readHash` passing `cat` through), `web/src/App.tsx:198-201` (`activeCategories`), `web/src/components/FeedControls.tsx:50-51` (chips iterate `categories`, not `selectedCategories`)
- **Intent:** A hash-supplied `#cat=cs.CV,cs.BI` filters by both, but only `cs.CV` renders a pressed chip, so the user cannot see or remove `cs.BI` and gets an unexplained empty feed. A typo or a stale shared link is unrecoverable.
- **Acceptance criteria:**
  1. Once `manifest` is available, `activeCategories` is the intersection of the hash-supplied list with `manifest.categories`, and hash values not present in the manifest are dropped.
  2. When the hash requested at least one category and none of them survive intersection, the UI renders an explicit "unknown category" notice naming the dropped value and offering a reset, rather than a bare empty state.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then load `http://localhost:5199/research-paper-feed/#cat=cs.CV,cs.BI` and confirm only `cs.CV` is pressed and `cs.BI` is reported as unknown; load `#cat=cs.BI` alone and confirm the reset affordance appears. Screenshots to `.improve/artifacts/IMP-009/feed-unknown-category-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-010 — Make the category selection reversible and representable
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:198-201` (`activeCategories`, `urlState.categories ?? manifest?.categories ?? []`), `web/src/App.tsx:253-259` (`toggleCategory`), `web/src/App.tsx:69-71` (`writeHash` permanently emits `cat=` once a selection exists), `web/src/components/FeedControls.tsx:49-64` (category chips)
- **Intent:** With no explicit selection, `activeCategories` is all five and all five chips render pressed. Toggling one chip off converts that to a 4-element array stored in `urlState.categories`, and from then on there is no way back to "all" except re-toggling all five by hand. Worse, deselecting the last chip leaves an empty `Set`, an empty feed reading "No papers match the current filters.", no pressed chip, and no reset control. `writeHash` also permanently writes `cat=` into the URL even when the selection equals the full default. (Absorbs the former IMP-057 — "All categories" is not representable and there is no way back — same root cause, same fix site.)
- **Acceptance criteria:**
  1. `FeedControls` renders a first chip labelled "All" ahead of the per-category chips, with `aria-pressed="true"` exactly when the selection equals `manifest.categories`, and activating it sets the selection to the full set.
  2. When the resulting selection equals `manifest.categories`, `writeHash` omits the `cat` parameter, so the URL for an unfiltered feed contains no `cat=` and `readHash` round-trips it back to `categories: null`.
  3. When the selection is empty, the empty-filter state renders a distinct message ("No categories selected") with a keyboard-reachable "Select all categories" control that restores the full set, instead of the generic "No papers match the current filters."
  4. A new test in the `urlState` suite from IMP-143 asserts `writeHash` omits `cat` for a full selection and emits it for a partial one; `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px deselect one chip, press "All", and confirm all five are pressed and the address bar has no `cat=`; screenshot to `.improve/artifacts/IMP-010/feed-all-categories-desktop-1280.png`. Then deselect all five, screenshot the new state to `.improve/artifacts/IMP-010/feed-no-categories-selected-desktop-1280.png`, activate "Select all categories" and confirm the feed returns. Compare against `.improve/artifacts/baseline/baseline-feed-no-categories-selected-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-143
- **Priority score:** 20.0
- **Notes:** Depends on IMP-143 because criterion 4 needs the extracted, testable `writeHash`. IMP-106 (a broader "Clear filters" action) and IMP-009 (validating hash categories against the manifest) touch adjacent UI; keep the copy unambiguous about which control resets what.

### IMP-011 — Surface `saveState` failure to the user
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:231-235` (save effect discarding the boolean), `web/src/lib/collections.ts:279-292` (`saveState` returning `false`)
- **Intent:** `saveState` deliberately returns `false` instead of throwing, and a test already asserts that (`web/src/lib/__tests__/collections.test.ts:303-306`), but the caller throws the value away. When the 5 MB quota fills, the user gets no warning at all while believing their saves worked.
- **Acceptance criteria:**
  1. The save effect reads `saveState`'s return value and, on `false`, sets a `role="alert"` banner stating that collections could not be saved and that browser storage may be full.
  2. The banner clears on the next successful save.
  3. A new test in `web/src/lib/__tests__/collections.test.ts` confirms the banner path is reachable by exercising `saveState` against a storage fake that throws on the second `setItem` (reuse the existing `THROWING_STORAGE` at `:60-79` or add a quota-specific fake).
- **Verification method:** `cd web && npm run typecheck && npm test`; then in DevTools set `localStorage.setItem` aside and force a throw, save a paper, and screenshot the banner to `.improve/artifacts/IMP-011/collections-save-failed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-012 — Darken `--text-muted` until it clears 4.5:1 on every surface
- **Status:** DONE
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/styles.css:9` (`--text-muted: #7a7a73`), used at `web/src/styles.css:285` (`.controls__count`), `web/src/styles.css:350` (`.tag`), `web/src/components/PaperCard.tsx:61-64` (`.paper__meta`), `web/src/styles.css:703` (`.site-footer p`)
- **Intent:** In light mode `--text-muted` measures 4.32:1 on `--surface`, 3.79:1 on `--surface-muted`, and 4.11:1 on `--bg`, all below the 4.5:1 WCAG 2.1 AA requirement, and it is used at 0.72–0.83 rem for authors, dates, chips, counts, and the footer. Dark mode already passes (5.44–6.48) and must not regress.
- **Acceptance criteria:**
  1. The light-mode `--text-muted` value computes to ≥ 4.5:1 against `--surface`, `--surface-muted`, and `--bg`.
  2. The dark-mode `--text-muted` override is unchanged or improved, and still measures ≥ 4.5:1 on all three dark surfaces.
  3. Ratios are recorded in the PR body as computed values (sRGB relative luminance), not eyeballed.
- **Verification method:** compute the ratios from the token values in `web/src/styles.css:5-46`; then `cd web && npm run build`, run `npm run preview -- --port 5199 --strictPort`, and screenshot the feed and the collections view at 1280px to `.improve/artifacts/IMP-012/feed-desktop-1280.png` and `.improve/artifacts/IMP-012/collections-desktop-1280.png`, comparing against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` and `.improve/artifacts/baseline/baseline-collections-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**
- **Notes:** commit pending
### IMP-013 — Raise `--border` to 3:1 against `--surface`
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/styles.css:7` (`--border: #e6e4dc`), `web/src/styles.css:208-216` (search input, `border: 1px solid var(--border)` at `:214`), `web/src/styles.css:297-299` (`.paper` border at `:299`)
- **Intent:** `--border` on `--surface` measures 1.27:1, far below the 3:1 WCAG 1.4.11 requirement for the boundary of a form control, so the search input and other bordered fields have no perceivable edge.
- **Acceptance criteria:**
  1. The light-mode `--border` token computes to ≥ 3:1 against `--surface`; the dark-mode token meets the same bar against the dark `--surface`.
  2. The search input boundary is visible at 1280px and 390px without any other visual change.
  3. `cd web && npm run build` succeeds and the built CSS grows by less than 1 kB.
- **Verification method:** compute the ratios from `web/src/styles.css:5-46`; then `cd web && npm run build` and screenshot the focused search input at 1280px to `.improve/artifacts/IMP-013/feed-search-border-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-focus-ring-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Raising `--border` also affects `.paper` and `.collection` outlines; check both screenshots before declaring success.

### IMP-014 — Restore the search input's keyboard focus ring
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/styles.css:218-221` (`.controls__search input:focus { outline: none }`) vs. `web/src/styles.css:86-90` (`:focus-visible` outline)
- **Intent:** `outline: none` on `:focus` matches keyboard focus and overrides the global `:focus-visible` rule, so the app's primary input is left with only a 1px accent border tint — a sub-3:1 indicator on the one control every user touches first.
- **Acceptance criteria:**
  1. Tabbing into the search input produces a visible outline matching the app's existing `:focus-visible` treatment (`web/src/styles.css:86-90`), with no `outline: none` left on the input.
  2. Mouse focus on the same input does not gain a ring that the other controls lack (i.e. the fix is `:focus-visible`-scoped, not a blanket `outline`).
  3. `cd web && npm run build` succeeds and no other control's focus appearance changes.
- **Verification method:** `cd web && npm run build`; then `npm run preview -- --port 5199 --strictPort`, Tab from the skip link to the search input at 1280px, and screenshot to `.improve/artifacts/IMP-014/feed-search-focus-ring-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-focus-ring-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-015 — Make a single failed shard non-fatal
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/lib/paperIndex.ts:150-157` (`Promise.all` over needed shards), `web/src/lib/paperIndex.ts:100-127` (`loadShard` throws)
- **Intent:** One 404 or malformed shard rejects the whole `Promise.all` at `paperIndex.ts:150-157`, discarding every other shard that did load. A single bad file empties the entire feed. (The index on disk is 2 shards today; the failure mode scales with shard count, so a retention change that adds shards makes it worse, not better.)
- **Acceptance criteria:**
  1. `loadPapers` resolves with the papers from every shard that loaded, and returns the failures alongside them — either as a second return value or as a `{ papers, failedFiles }` shape. The return type change must be made explicitly, not inferred at the call site.
  2. When at least one shard fails, the returned result carries a partial-failure signal that the app renders as a non-blocking warning naming the missing shard, distinct from the hard error panel at `web/src/App.tsx:364-376`.
  3. When **all** shards fail, the existing rejection path still applies so the user sees the error state rather than a silent empty feed.
- **Verification method:** `cd web && npm run typecheck && npm test`; then delete one `web/public/data/papers-*.json`, load the feed, and confirm the other weeks still render alongside a warning. Screenshots to `.improve/artifacts/IMP-015/feed-partial-shard-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-016 — Distinguish "papers failed to load" from "no papers available"
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:408-433` (warning banner vs. `PaperList emptyMessage`), `web/src/App.tsx:429-432` (`emptyMessage` selection)
- **Intent:** When the manifest loaded but the papers did not, `App.tsx:364` skips the error panel, `:408-412` shows a bare warning, and `PaperList` renders with `papers === []` — so the user reads "No papers are available in this window yet." for what is actually a load failure.
- **Acceptance criteria:**
  1. When `error` is set and `papers.length === 0`, the app renders a load-failure state, never the "no papers are available" empty message.
  2. The "no papers" empty message is reachable only when the load succeeded and genuinely returned nothing for the window.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then corrupt one shard to a non-JSON body, load the feed, and screenshot the load-failure state to `.improve/artifacts/IMP-016/feed-load-failed-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-empty-search-desktop-1280.png` which must still show the genuine empty-search copy.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-017 — Replace the raw `Error.message` with human-readable copy
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:409-411` (raw `error` rendered), `web/src/lib/paperIndex.ts:107-109` and `:121-123` (messages such as `Failed to load papers-2024-W14.json (HTTP 404).`)
- **Intent:** Production visitors see strings like `Failed to load papers-2024-W14.json (HTTP 404).` and `The paper index is malformed and could not be parsed.` with no indication of what to do next.
- **Acceptance criteria:**
  1. Each user-visible failure maps to a reader-facing sentence ("Some paper data could not be loaded. Try again in a moment."), with the technical detail (shard file name, HTTP status) preserved either as a `title` attribute on the same element or in `console.error`, never in the primary visible text. There are exactly three user-reachable failure strings to map: the `INDEX_HELP` paths at `paperIndex.ts:79,86-88,93-96` and the two shard errors at `paperIndex.ts:107-109,121-123`.
  2. No rendered user-facing string contains a raw `Error.message`, a file name, or an HTTP status code in the primary message.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then reproduce each failure state (missing index, one corrupt shard, malformed manifest) and screenshot the rendered copy to `.improve/artifacts/IMP-017/feed-error-copy-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-018 — Add a React error boundary around `<App />`
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** improvement
- **Area / files:** `web/src/main.tsx:12-15` (`createRoot(...).render(<StrictMode><App /></StrictMode>)`), `web/src/App.tsx:207-224` (`visiblePapers` render-time path), `web/src/components/PaperCard.tsx:44-49` (`paper.abstract.length`)
- **Intent:** Any render-time throw — a `Paper` missing `abstract`, a malformed `published`, a bad `authors` array — blanks the whole app to a white page with no message. There is no boundary anywhere in the tree.
- **Acceptance criteria:**
  1. A class component (React has no function-component equivalent in React 18.3.1) named `ErrorBoundary` is defined in `web/src/main.tsx` or a sibling module, implements `componentDidCatch(error: Error, info: React.ErrorInfo)`, and is mounted as the immediate parent of `<App />` inside `<StrictMode>` at `main.tsx:12-16`. Its fallback renders a `role="alert"` element with a `<button>` whose `onClick` calls `window.location.reload()`.
  2. The fallback's `console.error` output is preserved — the boundary must not swallow the error; it renders it, it does not suppress it.
  3. Because the boundary lives in `main.tsx`, it is exercised by hand per the Verification method unless IMP-005 has landed, in which case a test under `web/src/__tests__/` renders `<ErrorBoundary><Thrower/></ErrorBoundary>` and asserts the `role="alert"` node exists. State which of the two applies in the PR body.
  4. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; then copy `web/public/data/` to `/tmp/rpf-boundary`, `python3 -c "import json;p='/tmp/rpf-boundary/<shard>.json';d=json.load(open(p));del d['papers'][0]['abstract'];json.dump(d,open(p,'w'))"`, serve it, and confirm the `role="alert"` fallback renders instead of a blank white page. Screenshot to `.improve/artifacts/IMP-018/feed-error-boundary-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** The boundary is a safety net; it does not replace IMP-098 (runtime validation) — a boundary that silently hides a schema violation would be worse than the bug.

### IMP-019 — Align `web/src/lib/types.ts` nullability with `record_from_result`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/types.ts:10-12` (`primaryCategory: string`, `absUrl: string`, `pdfUrl: string`), `scripts/build_index.py:111-113` (`getattr(result, "primary_category", None)`, `getattr(result, "entry_id", None)`, `getattr(result, "pdf_url", None)`)
- **Intent:** The Python producer writes `null` for any of those three fields when arXiv omits them, and arxiv 4.x declares `Result.pdf_url` as `str | None`. The TS types say `string`, so the compiler actively hides the mismatch and a `null` reaches `PaperCard.tsx:57` as `href={null}`.
- **Acceptance criteria:**
  1. The three TS fields are declared with the nullability the Python side can actually emit (or the Python side is changed to always emit a string — pick one and record which in the PR body).
  2. `PaperCard.tsx` renders without an `href` of `null` for any of the three fields, and a `null` `pdfUrl` simply omits the PDF link rather than throwing.
  3. `cd web && npm run typecheck && npm run build` succeed and a new test in `web/src/lib/__tests__/paperIndex.test.ts` loads a fixture paper with `pdfUrl: null`.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-nullcheck`, grep the shard for `"pdfUrl":null` and `"primaryCategory":null`, and confirm the app renders those papers without a broken link. Screenshot to `.improve/artifacts/IMP-019/feed-null-pdfurl-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Risk `med` because widening the types may surface compile errors in `PaperCard.tsx` and `App.tsx` filter code (`App.tsx:211-212` uses `paper.primaryCategory` in a `Set` lookup, which is fine for `null` but changes the filter semantics subtly). **Advisory carried forward from `.improve/reports/verify-IMP-151b.md` OBS-D, which must survive this item:** widening the types to `string | null` makes it *tempting* to simplify `hasSafeUrls` (`web/src/lib/collections.ts:96-101`) from `url == null || isHttpUrl(url)` down to `isHttpUrl(paper.absUrl)`. Do not. `parseExportPayload` validates a file read off disk, so a `null` is reachable there regardless of what the declared type says, and `PaperCard.tsx:33-35`'s `safeHref(url: string | undefined)` is likewise now inaccurate about what it receives. The `null` exemption is load-bearing for correctness, and `isHttpUrl`'s `(value: unknown)` parameter is what makes it safe — narrowing that parameter to `string` would let a `null` flow straight into an `href`.

### IMP-020 — Make the retention window a filter, not only an ordered `break`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:215-219` (`collect_papers` retention check), `scripts/build_index.py:194-200` (`_result_datetime` returning `None`), `scripts/build_index.py:149-151` (`build_shards` grouping by `iso_week_key`)
- **Intent:** A result whose `published` is not a `datetime` (a string, for example) makes `_result_datetime` return `None`, so the `is not None` guard fails and the record is kept regardless of age. Recon produced `papers-2001-W01.json` inside a 60-day index. The ordered `break` is also load-bearing on `arxiv_common.py:47-48`'s `SubmittedDate/Descending` sort, which is undocumented at the call site.
- **Acceptance criteria:**
  1. Records with no usable `published` datetime are dropped before counting, and records older than the cutoff are dropped even when iteration order is wrong.
  2. A test in `tests/test_build_index.py` drives `collect_papers` with a fake `iter_results` yielding (new, old, string-dated) results **out of order**, and asserts only the new one survives.
  3. The `build_index.py:217` call site carries a one-line comment naming the sort dependency in `scripts/arxiv_common.py:47-48`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-retention` and confirm `ls /tmp/rpf-retention` contains no shard older than the current ISO week.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Risk `med` because dropping non-`datetime` records changes what reaches the index for any upstream shape change; verify a real run still produces ~the same paper count before merging. The baseline index on disk is `totalPapers: 2812` across 2 shards; a smoke run of `--category cs.CV --max-per-category 300` is the comparison to record.

### IMP-021 — Write the manifest before deleting stale shards
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:224-232` (`_clean_old_shards`), `scripts/build_index.py:235-245` (`write_index` order)
- **Intent:** `write_index` deletes every `papers-*.json` first and writes second. A crash, a `KeyboardInterrupt`, or a full disk between the two leaves the still-present `index.json` referencing shards that no longer exist, producing exactly the 404 that `web/src/lib/paperIndex.ts:105-110` throws on.
- **Acceptance criteria:**
  1. `write_index` writes the new shards and the manifest **before** calling `_clean_old_shards`, so a failure mid-write cannot orphan a referenced shard.
  2. A test in `tests/test_build_index.py` monkeypatches `json.dump` to raise on the shard write and asserts that the previously valid `papers-*.json` files are still present on disk.
  3. The existing test `tests/test_build_index.py:189` (stale-shard removal) still passes unchanged.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-order` twice and confirm `ls /tmp/rpf-order` shows one shard plus `index.json` and that `index.json`'s `shards[].file` entries all resolve.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-022 — Validate every CLI flag in both scripts
- **Status:** TODO
- **Category:** Configuration & defaults
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:248-275` (`parse_args`), `scripts/build_index.py:48-53` (`truncate_abstract`, `max_chars <= 0` silently disables truncation), `scripts/build_index.py:208` (`max_per_category > 0` else `UNLIMITED`), `scripts/build_index.py:211` (`query = f"cat:{category}"`), `scripts/paper-collector.py:35-38` (`--max-papers`, default 1000), `scripts/arxiv_common.py:37-38` (non-positive short circuit), `readme.md:42-44` and `readme.md:96-103`
- **Intent:** Neither script validates a single flag. `build_index.py --retention-days 0` makes the cutoff now-or-future, so the retention `break` at `build_index.py:216-217` fires on the first result and the run exits 1 with the misleading `No papers fetched; refusing to write an empty index.`; `--abstract-chars -3` silently disables truncation via `build_index.py:51`; `--max-per-category -9` silently means *unlimited* via `build_index.py:208`; `--category 'cs.CV foo'` produces a query arXiv answers with an empty feed, indistinguishable from "no new papers". In `paper-collector.py`, `--max-papers 0` short-circuits `iter_results` and still writes a zero-paper HTML feed while printing a success message and exiting 0. None of this is documented. (Absorbs the former IMP-047 and IMP-048 — same root cause, same fix site.)
- **Acceptance criteria:**
  1. `build_index.py`: `--retention-days < 1`, `--abstract-chars < 1`, and `--max-per-category < 0` each cause `argparse` to exit with code 2 and a message naming the flag and its accepted range.
  2. `build_index.py`: each `--category` value must match `^[a-zA-Z-]+(\.[a-zA-Z-]+)?$`, otherwise `argparse` exits 2 naming the offending value. The pattern must still accept the real forms `cs.AI`, `stat.ML`, `astro-ph.HE`.
  3. `paper-collector.py`: `--max-papers < 1` causes `argparse` to exit 2 with a message naming the flag. Its default of `1000` and its flag name are unchanged (profile §6 compatibility surface).
  4. Tests in `tests/test_build_index.py` assert `parse_args(["--retention-days", "0"])`, `parse_args(["--abstract-chars", "-3"])`, `parse_args(["--category", "cs.CV foo"])`, and (in `tests/test_paper_collector.py`) `--max-papers 0` each raise `SystemExit` with `code == 2`; plus `parse_args(["--category", "cs.CV", "--category", "cs.LG"]).categories == ["cs.CV", "cs.LG"]` and `parse_args([]).categories is None`.
  5. `readme.md:42-44` and the `readme.md:96-103` flag table are updated in the same change to state the accepted ranges, and `python scripts/build_index.py --help` / `python scripts/paper-collector.py --help` show them.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 scripts/build_index.py --retention-days 0` and `/usr/local/bin/python3.11 scripts/build_index.py --category 'cs.CV foo' --max-per-category 2 --out-dir /tmp/rpf-cat` each exit 2 with a usage message and write nothing; then `/usr/local/bin/python3.11 scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 0` exits 2 and writes no file; finally diff `readme.md`'s flag lists against both `--help` outputs.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Adding validation ranges changes `--help` output, which profile §4.5 requires to be reconciled with `readme.md` in the same change — that is criterion 5. IMP-114 documents `--category` in the readme and should be sequenced with this item.

### IMP-023 — Make `safe_filename` a real sanitizer
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:21-23` (`safe_filename`), `scripts/paper-collector.py:72,79` (slug used as a **directory** name for `extractall`)
- **Intent:** `safe_filename` replaces `\ / : " * ? < > |` but not `.`, so `safe_filename("..") == ".."` and `safe_filename("../../etc") == ".._.._etc"`. The slug is then used as a directory name for `extractall`, so a paper titled `..` extracts into the repository root. There is also no length cap (a 400-char title exceeds the 255-byte filename limit) and no reserved-name handling.
- **Acceptance criteria:**
  1. `safe_filename("..")` and `safe_filename(".")` return a value that is neither `.` nor `..` nor empty, and no input produces a path separator.
  2. The returned slug's UTF-8 encoding is at most 200 bytes (verified as `len(slug.encode("utf-8"))`, not character count — a 400-char CJK title is ~1,200 bytes), and a slug whose stem case-insensitively matches a Windows reserved name (`CON`, `PRN`, `AUX`, `NUL`, `COM1`–`COM9`, `LPT1`–`LPT9`) gains a `_` suffix. Truncation must not split a multi-byte character.
  3. New tests in `tests/test_paper_collector.py` cover `.`, `..`, a 400-character title, and `CON`, and the two existing `SafeFilenameTests` at `:22-31` still pass.
  4. This item, not IMP-024, is what makes the extraction destination safe. IMP-024 (`19f8dbb`) passes `filter="data"`, which guarantees members stay inside `dest` and says **nothing about `dest` itself** — so today `safe_filename("..") == ".."` still makes `dest` the repository root and every member lands there, inside the filter's own boundary, with nothing rejected and nothing logged. Criterion 1 alone closes that hole; do not treat the landed `filter="data"` as a substitute for it (recorded as D2 in `.improve/reports/discovered-IMP-024.md`, which explicitly asks for this note).
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util,sys; s=importlib.util.spec_from_file_location('pc','scripts/paper-collector.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(repr(m.safe_filename('..')), len(m.safe_filename('x'*400)))"`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-024 — Pass `filter="data"` to `tarfile.extractall`
- **Status:** DONE
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:78-79` (`file.extractall(f"./extracted/{title_slug}")`), `.github/workflows/ci.yml:15` (`python-version: "3.x"`)
- **Intent:** `extractall` is called with no `filter=`, the CVE-2007-4559 class of traversal. Python ≤3.11 is fully permissive, 3.12+ warns, and only 3.14 defaults to `data` — while CI pins an unpinned floating `3.x`, so the safety of this line depends on whichever runner Python happens to be current.
- **Acceptance criteria:**
  1. `extractall` is called with `filter="data"` on any interpreter whose `tarfile.TarFile.extractall` accepts `filter` (3.12+, and 3.11.4+ — check with `"filter" in inspect.signature(tarfile.TarFile.extractall).parameters`, not a hardcoded version number), and is guarded by an explicit fallback branch that logs a warning naming the missing-filter condition rather than silently extracting permissively.
  2. A test in `tests/test_paper_collector.py` builds a synthetic tarball in a `tempfile` dir containing a `../escape.txt` member, extracts it through whatever path the implementation takes, and asserts (a) no file appears outside the extraction directory and (b) the member is reported as skipped (either filtered or logged). The test must be skipped-with-reason, not failed, on an interpreter whose `tarfile` lacks `filter` — but the provisioned `/usr/local/bin/python3.11` must be new enough for it to run, and the PR body must state whether it ran or skipped.
  3. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes on 3.11 (the only interpreter here with the deps).
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and state in the PR body whether the traversal test ran or skipped; then `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --download-sources --output-dir /tmp/rpf-sources` and confirm `find /tmp/rpf-sources` contains the extracted tree and that no `escape.txt` exists at `/tmp/escape.txt` or in the repo root.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Risk `med` because a real arXiv source archive may contain members that `filter="data"` rejects, and `--download-sources` is a documented flag. Test against a real source archive before merging and log every rejection so a user can see what was skipped. | commit pending; attempt 2 PASS

### IMP-025 — Make `--save-csv` honor `--output-dir`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:138` (`df.to_csv(topic + "_papers.csv", index=False)`), `readme.md:103` (`--save-csv` documented without noting the CWD write)
- **Intent:** The CSV is written to the current working directory while the HTML honors `--output-dir`, so `--save-csv --output-dir /tmp/out` silently drops `*_papers.csv` in the repo root — which `.gitignore`'s `results/*.csv` rule does not cover.
- **Acceptance criteria:**
  1. The CSV path is `os.path.join(args.output_dir, ...)` and `--output-dir` is created before the write, so the CSV never lands in CWD.
  2. A test in `tests/test_paper_collector.py` runs `main()` with `--save-csv --output-dir <tmpdir>` and asserts the CSV exists under `<tmpdir>` and that no `*_papers.csv` was created in CWD.
  3. `readme.md`'s CLI table still shows the same flag name and description.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --output-dir /tmp/rpf-csv --save-csv` and `ls /tmp/rpf-csv`; then `git status --porcelain` must be empty.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-026 — Add `npm run build` to CI
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:21-38` (`web-tests` job: `npm ci`, `npm run typecheck`, `npm test` only)
- **Intent:** CI never builds. A broken Vite build — bad `vite.config.ts`, wrong `base`, a CSS pipeline error, a missing asset — passes CI and only fails inside `deploy.yml` on `main`, publishing nothing. This is the single biggest CI gap.
- **Acceptance criteria:**
  1. `.github/workflows/ci.yml` runs `npm run build` after `npm test` in the `web-tests` job, and the step references only scripts that exist in `web/package.json:6-13`.
  2. The new build step is the **first** thing in the job that would catch a build break: to prove it is not a no-op, push a scratch branch whose only change is a deliberate syntax error in `vite/vite.config.ts` and confirm the job fails at the build step (not at `typecheck`); then revert and confirm green.
  3. `cd web && npm run build` still succeeds locally and produces `dist/assets/index-*.js` within 1 kB of the 163.72 kB baseline (profile §3.3).
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then `cat -n .github/workflows/ci.yml` and confirm each `run:` line maps to a real `web/package.json` script.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** A broken `npm run lint` step is a bug, not a gate (profile §4.5). Do not add one until IMP-137 creates the script.

### IMP-027 — Reconcile the deploy cron with its comment and `readme.md`
- **Status:** NEEDS-HUMAN
- **Category:** CI & automation
- **Type:** bug-fix
- **Area / files:** `.github/workflows/deploy.yml:5-6` (comment says "every day", cron is `0 6 * * 0` = weekly Sunday), `readme.md:122-123` ("on a daily schedule")
- **Intent:** The comment, the readme, and the cron disagree. The site advertises near-real-time arXiv coverage but rebuilds weekly — so a 60-day rolling index is served from data up to seven days stale, and readers have no way to know.
- **Acceptance criteria:**
  1. The cron expression, the `deploy.yml` comment, and `readme.md:122-123` all state the same schedule; whichever way the decision goes, no two of the three disagree.
  2. If the cron becomes daily, `scripts/arxiv_common.py:16`'s 10s per-page delay (IMP-054) is re-measured and the resulting workflow duration is noted in the PR body.
  3. `cat -n .github/workflows/deploy.yml` shows the final cron and comment side by side.
- **Verification method:** `cat -n .github/workflows/deploy.yml readme.md | grep -n -e 'cron' -e 'daily' -e 'weekly'`; then `gh workflow list` is not required — the change is static text and YAML, verified by reading both files.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** The current weekly cron is the baseline (PE-4). Whichever direction is chosen, the *decision* is the deliverable; do not leave the two files disagreeing.
**NEEDS-HUMAN — decision required.** Cron cadence is an operator/cost decision, not a bug fix: `0 6 * * 0` costs roughly 1/7 the Actions minutes of `0 6 * * *`, and every arXiv page costs `delay_seconds=10` (`scripts/arxiv_common.py:16`), so daily means ~5x the request volume against arXiv's terms of use. Pick weekly (fix only the comment at `deploy.yml:5` and `readme.md:122-123`) or daily (and accept the load), then implement. The minimum deliverable is the doc fix and is two lines.

### IMP-028 — Fail a production web build when the index is absent
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `web/vite.config.ts:4-11`, `web/package.json:8` (`"build": "tsc --noEmit && vite build"`), `web/public/data/` (gitignored, `web/.gitignore:7`)
- **Intent:** `vite build` copies `public/**` only if it already exists. Building with an empty `data/` produces a `dist` with no `dist/data`, and the deployed site then serves "No paper index yet" forever — while `GET /data/index.json` still returns **200** via the SPA fallback, so a naive HTTP health check reports green.
- **Acceptance criteria:**
  1. `vite build` (or the `build` script) fails with a non-zero exit and a message naming `public/data/index.json` when that file is absent, **only** for a production build — `npm run dev` and `npm run test` are unaffected.
  2. Building with a populated `web/public/data/` still succeeds and `ls web/dist/data` lists `index.json` plus the shards.
  3. `cd web && npm run build` succeeds after `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20` has populated `web/public/data/`.
- **Verification method:** `cd web && npm run build` with `web/public/data/` renamed aside (expect a non-zero exit and the naming message), then restore it, rebuild, and confirm `ls web/dist/data`. Also confirm `curl -o /dev/null -w %{http_code} http://localhost:5199/research-paper-feed/data/index.json` still returns 200 with `Content-Type: text/html` when the data is absent — that is the check this item exists to make un-missable.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:**

### IMP-029 — Assert `web/dist/data` exists in the deploy workflow
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/deploy.yml:33-48` (index build at `:33`, `npm run build` at `:48`, upload at `:52-54`)
- **Intent:** The ordering in `deploy.yml` is correct today but load-bearing and unasserted: if `build_index.py` fails softly or the index lands elsewhere, the deploy publishes an error page and every check still looks healthy.
- **Acceptance criteria:**
  1. A step between `npm run build` (`:46-48`) and `actions/upload-pages-artifact` (`:52-54`) runs a plain `run:` shell check that: (a) `test -f web/dist/data/index.json`, and (b) for each `file` named in `shards[].file` of that manifest, `test -f "web/dist/data/$file"`; any failure exits non-zero with the missing path named. No new dependency beyond `python3` (already present on the runner) or plain `test`/`jq`-free shell.
  2. The assertion step is a plain `run:` shell check with no new dependencies.
  3. The `deploy.yml` build-order comment (index before build) is preserved and now has the assertion beside it.
- **Verification method:** `cat -n .github/workflows/deploy.yml` and confirm the new step exists between lines for the build and the upload; locally reproduce with `cd web && npm run build && ls web/dist/data` after a real index build.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Deliberately checks the filesystem, not HTTP — profile §4.5: a `curl -w %{http_code}` health check returns 200 from the SPA fallback and cannot catch this.

### IMP-030 — Replace the stale README hero screenshot
- **Status:** TODO
- **Category:** Documentation
- **Type:** docs
- **Area / files:** `readme.md:11` (`![Example feed](images/feed_example.png)`), `images/feed_example.png` (465 KB, a 2023 screenshot of the legacy CLI's HTML output)
- **Intent:** The README's hero image shows the *legacy Python CLI* output from 2023, not the React feed. It misrepresents the project, and at 465 KB it is the heaviest asset in the repo for an image that is simply wrong.
- **Acceptance criteria:**
  1. `images/feed_example.png` is a screenshot of the current React feed at 1280px, captured with a real index, and `readme.md:11` renders it correctly.
  2. The new file is at most 300 KB, or the hero is converted to a compressed format with a matching `readme.md` reference.
  3. `readme.md` still starts with the live-site link at `readme.md:9` and the feature bullets at `readme.md:13-31` are unchanged by this item.
- **Verification method:** capture with Playwright at 1280px against `http://localhost:5199/research-paper-feed/` after a real index build, save to `images/feed_example.png`, and save the same capture to `.improve/artifacts/IMP-030/feed-desktop-1280.png` for comparison against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** `images/feed_example.png` is on the profile's "do not touch unless the item is specifically about it" list — this is that item.

### IMP-031 — Fix `CONTRIBUTING.md`'s Python command and add a venv step
- **Status:** TODO
- **Category:** Onboarding & developer experience
- **Type:** docs
- **Area / files:** `CONTRIBUTING.md:8` (`pip install -r requirements.txt`) and `CONTRIBUTING.md:10` (`python -m unittest discover -s tests -v`), `readme.md:37-40` and `readme.md:76-78` (same problem)
- **Intent:** The documented command fails on macOS: there is no `python` on `PATH`, and `/opt/homebrew/bin/python3` (3.14.3) has neither `arxiv` nor `pandas`, so the very first step a contributor runs dies. The readme's `pip install -r requirements.txt` also fails under PEP 668 without a virtualenv.
- **Acceptance criteria:**
  1. `CONTRIBUTING.md` instructs the reader to create a virtualenv outside or inside the repo and gives an interpreter-agnostic test command that works on macOS and Ubuntu.
  2. The readme's Quick Start uses the same venv-first sequence.
  3. A fresh venv following the new instructions passes `python -m unittest discover -s tests -v` end to end.
- **Verification method:** `python3 -m venv /tmp/rpf-verify-venv && /tmp/rpf-verify-venv/bin/pip install -r requirements.txt && /tmp/rpf-verify-venv/bin/python -m unittest discover -s tests -v` → 27 tests OK; then confirm `git status --porcelain` is empty (see IMP-037 for the `.gitignore` follow-on).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** The repo has no venv of its own and the profile's working command is `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; the docs should not hardcode that machine-specific path.

### IMP-032 — Document the `web/` test and build workflow in `CONTRIBUTING.md`
- **Status:** TODO
- **Category:** Onboarding & developer experience
- **Type:** docs
- **Area / files:** `CONTRIBUTING.md` (25 lines, no mention of `web/` at all), `web/package.json:6-13`
- **Intent:** A contributor following `CONTRIBUTING.md` has no idea the frontend exists, has tests, or has a typecheck that CI actually runs.
- **Acceptance criteria:**
  1. `CONTRIBUTING.md` documents `cd web && npm ci`, `npm run typecheck`, `npm test`, and `npm run build`, and states that all three must pass before opening a PR.
  2. It states that the Python and web suites are independent, and that `npm test` is the only web test command.
  3. Every command written into `CONTRIBUTING.md` exists in `web/package.json:6-13`.
- **Verification method:** `cat web/package.json` and diff the documented script list against `scripts`; then `cd web && npm ci && npm run typecheck && npm test && npm run build` all succeed.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** If IMP-026 adds a build gate, this is the doc side of it. Combine the two PRs if convenient.

### IMP-033 — Add an upper bound to `arxiv` in `requirements.txt`
- **Status:** TODO
- **Category:** Packaging & installation
- **Type:** bug-fix
- **Area / files:** `requirements.txt:1` (`arxiv>=2.1.0`), `requirements.txt:2` (`pandas>=2.0.0`), `scripts/paper-collector.py:75,77` (the 4.x breakage)
- **Intent:** `arxiv>=2.1.0` resolves to 4.x today, and arxiv 4 removed `Result.download_pdf`/`download_source` — which is precisely why `--download-pdfs` and `--download-sources` are 100% broken while the 27-test suite stays green. There is no lockfile and no upper bound, so a future major can break the deploy unattended.
- **Acceptance criteria:**
  1. `requirements.txt` constrains `arxiv` to the range the code is verified against (`<5`, or narrower), and states the verified version in a comment.
  2. `pip install -r requirements.txt` in a clean venv resolves to that range and the Python suite passes. Record the resolved version in the PR body.
  3. `readme.md` and `CONTRIBUTING.md` need no change to stay accurate.
- **Verification method:** `python3 -m venv /tmp/rpf-pin-venv && /tmp/rpf-pin-venv/bin/pip install -r requirements.txt && /tmp/rpf-pin-venv/bin/pip list | grep -i arxiv && /tmp/rpf-pin-venv/bin/python -m unittest discover -s tests -v`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** This item is a *floor* fix, not a substitute for IMP-093 (replace the removed APIs) — pinning to 2.x would also "fix" the crash while leaving the code on a dead API. State that in the PR.

### IMP-034 — Resolve the notebook's divergent fork and correct `readme.md:113-118`
- **Status:** NEEDS-HUMAN
- **Category:** Documentation
- **Type:** docs
- **Area / files:** `notebooks/paper-collector.ipynb` (9 cells), `readme.md:113-118` ("A Jupyter notebook version of the same workflow"), `scripts/arxiv_common.py`, `scripts/paper-collector.py`
- **Intent:** The notebook is a pre-`arxiv_common` fork that rebuilds its own `arxiv.Client`, its own DataFrame schema, and its own HTML template. It has drifted past the script in every way that matters, and the readme actively tells readers it is "the same workflow". Either it is brought back in line or it is removed and the readme corrected — leaving it as-is is the only unacceptable option.
- **Acceptance criteria:**
  1. Either the notebook is deleted and `readme.md:113-118` is removed or rewritten to point only at `scripts/paper-collector.py`, or the notebook is reduced to a thin wrapper that imports `scripts/arxiv_common.py` and `scripts/paper-collector.py` helpers with no duplicated client, HTML template, or column list.
  2. `readme.md` no longer claims the notebook is the same workflow as the CLI.
  3. `git ls-files` reflects the decision, and every follow-on item in this backlog scoped to the notebook (IMP-035, IMP-036, IMP-077, IMP-078, IMP-079) is either completed or explicitly marked not-applicable in its own file.
- **Verification method:** `git ls-files notebooks/` and `cat -n readme.md | sed -n '110,120p'`; if the wrapper path is taken, `<venv>/bin/jupyter-nbconvert --to notebook --execute notebooks/paper-collector.ipynb` no longer dies with `StdinNotImplementedError` at cell 4.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Risk `med` because deleting a documented artifact is user-visible; the readme and any external links must be corrected in the same change. The notebook is not in CI and not in deploy.
**NEEDS-HUMAN — decision required.** This item's own criteria offer two mutually exclusive outcomes: delete a documented artifact, or rewrite it as a thin wrapper. That is a product decision about whether the notebook is a supported entry point. Until it is made, IMP-035, IMP-036, IMP-077, IMP-078 and IMP-079 are all blocked, because "if the notebook was deleted, mark this not-applicable" is written into each of them.

### IMP-035 — Add `html.escape` to the notebook's generated HTML
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `notebooks/paper-collector.ipynb` cell 8 (`df["Title"][i]` and `df["Summary"][i]` interpolated into HTML with no escaping)
- **Intent:** An arXiv title containing `<script>` becomes live script in the notebook's generated feed. `scripts/paper-collector.py:109-118` was fixed for exactly this and has a test (`tests/test_paper_collector.py:35-44`); the notebook was never updated and has no test.
- **Acceptance criteria:**
  1. Every interpolated field in the notebook's HTML template is passed through `html.escape` with the same defaults as `scripts/paper-collector.py:109-118`.
  2. The notebook's output for a title containing `<script>` and one containing `"` and `'` contains no unescaped markup.
  3. `html` is imported in the notebook.
- **Verification method:** execute the notebook's HTML cell with a synthetic DataFrame row `Title = '<script>alert(1)</script>'` and inspect the produced string; save the output to `.improve/artifacts/IMP-035/notebook-html-escaped.txt` and confirm `&lt;script&gt;` is present and `<script>alert` is not.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-034
- **Priority score:** 20.0
- **Notes:** If IMP-034 deletes the notebook, mark this not-applicable rather than leaving it as dead work.

### IMP-036 — Add `max_results` to the notebook's `arxiv.Search`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `notebooks/paper-collector.ipynb` cell 5 (`arxiv.Search(query=topic, sort_by=..., sort_order=...)` with no `max_results`), cell 1 (`MAX_PAPERS_TO_PULL = 1000`), cell 5 (`if len(all_data) >= MAX_PAPERS_TO_PULL: break` — unreachable)
- **Intent:** `arxiv.Search` defaults `max_results` to 100 in arxiv ≥ 2, so the notebook silently collects 100 papers while `MAX_PAPERS_TO_PULL = 1000` and the trailing `break` imply 1000. This is precisely the regression commit `352e104` fixed in `scripts/arxiv_common.py:43-45`; the notebook still has it.
- **Acceptance criteria:**
  1. The notebook's `arxiv.Search` call passes `max_results=MAX_PAPERS_TO_PULL`, or the notebook imports `scripts/arxiv_common.iter_results` (preferred, and what IMP-034's wrapper path does).
  2. A run for a broad topic such as `cat:cs.CV` returns more than 100 papers when the cap allows it.
  3. No unreachable `break` remains, or it is reachable.
- **Verification method:** execute the notebook with `topic = "cat:cs.CV"` and `MAX_PAPERS_TO_PULL = 150`; confirm the printed count is 150, not 100.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-034
- **Priority score:** 20.0
- **Notes:**

### IMP-037 — Add a component render smoke test
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/components/__tests__/PaperCard.test.tsx` (new), `web/vite.config.ts:7-10`
- **Intent:** Proves the DOM environment actually works end to end, so the four component-test items that depend on this are not built on an unverified foundation. Today zero component behavior is testable.
- **Acceptance criteria:**
  1. A new test renders `PaperCard` from `web/src/components/PaperCard.tsx` with a minimal `Paper` fixture and asserts the title link's `href` equals the fixture's `absUrl` and the publication date renders.
  2. The test file is collected by the widened `test.include` from IMP-005 — `cd web && npm test` reports one more test file and one more test than the 36-test baseline.
  3. `cd web && npm run typecheck` passes.
- **Verification method:** `cd web && npm test` (expect 4 files, 37 tests); then `cd web && npm run build`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-005
- **Priority score:** 20.0
- **Notes:** Follow the repo's 1:1 mirror convention — a component at `web/src/components/PaperCard.tsx` gets tests at `web/src/components/__tests__/PaperCard.test.tsx`, not inline.

### IMP-038 — Add a `paperIndex` test for a single failing shard
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/lib/__tests__/paperIndex.test.ts` (add to the existing `PaperIndex` suite), `web/src/lib/paperIndex.ts:150-157`
- **Intent:** The `Promise.all` all-or-nothing behavior at `paperIndex.ts:150` is completely untested, which is why one bad shard emptying the whole feed went unnoticed. The file already has realistic manifest/shard fixtures at `:11-79` to build on.
- **Acceptance criteria:**
  1. A new test constructs a manifest naming three shards, makes the middle shard's fetch return a 404, and asserts the result contains the papers from the two shards that loaded.
  2. A companion assertion records the failed shard file name in the partial-failure signal.
  3. The suite still passes its 10 pre-existing tests unchanged.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the file to report 12 tests.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-015
- **Priority score:** 20.0
- **Notes:**

### IMP-039 — Add a `paperIndex` test that a rejected manifest can be retried
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/lib/__tests__/paperIndex.test.ts`, `web/src/lib/paperIndex.ts:66-71`
- **Intent:** The memoized-rejection defect (WEB-01) is currently invisible to the suite: nothing asserts what happens on a second `getManifest()` after a failure. This test is the regression lock for IMP-003.
- **Acceptance criteria:**
  1. A new test makes the first manifest `fetch` reject with a network error, then makes the second resolve, and asserts the second `getManifest()` resolves and `fetch` was called exactly twice.
  2. The `IndexUnavailableError` name and `cause` from the first call are still asserted somewhere in the suite.
  3. All 10 pre-existing tests in the file still pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the file to report 11 tests.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-003
- **Priority score:** 20.0
- **Notes:**

### IMP-040 — Add a regression test that a failed category cannot produce a complete manifest
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py` (add to `MainTests`, which currently stubs `collect_papers` with a bare lambda at `:219`)
- **Intent:** Locks IMP-004's behavior. The existing `MainTests` stub `collect_papers` with `lambda *args, **kwargs` and never inspects the arguments, so both the failure policy and the flag pass-through are untested.
- **Acceptance criteria:**
  1. A new test drives `main()` with a fake that reports one category failed and asserts the chosen policy — non-zero exit with nothing written, or a manifest carrying an explicit partial marker.
  2. The test asserts which categories the failure names.
  3. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes with 28 or more tests.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -m compileall -q scripts tests` (exit 0).
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-004
- **Priority score:** 20.0
- **Notes:**

### IMP-041 — Add a quality gate to the deploy `build` job
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/deploy.yml:21-54` (the `build` job runs `build_index.py` at `:33-34` then `npm run build` at `:46-48` with no tests, no typecheck, and no lint)
- **Intent:** Cross-workflow `needs:` is impossible, so anything landing on `main` publishes to Pages whether or not CI is green. A red PR that merges anyway ships an untested, unbuilt site. (Re-scored during critique from 16.0 to 20.0: the effort is honestly `S` — two `run:` lines in one YAML file — so `4 × 5 ÷ 1 = 20.0`, and the previous `M`-effort arithmetic could not produce 16.0.)
- **Acceptance criteria:**
  1. The deploy `build` job runs `python -m unittest discover -s tests -v` (byte-identical to `ci.yml:19`) and `npm run typecheck` (byte-identical to `ci.yml:36`) **before** the `Build the paper index` step, so a red `main` skips publication.
  2. Every `run:` line added references a command that exists: the Python command is stdlib-only and `typecheck` is a real script at `web/package.json:12`. `npm run lint` in particular must **not** be added — it does not exist (profile §4.5; IMP-137 is the item that would create it).
  3. `cat -n .github/workflows/deploy.yml` shows the new steps ahead of `Build the paper index` at `:33`, which must stay ahead of `npm run build` at `:48`.
- **Verification method:** `cat -n .github/workflows/deploy.yml` and read it top to bottom confirming step order; `cat web/package.json` to confirm `typecheck` exists; then run `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and `cd web && npm run typecheck` locally to confirm both exact command strings are runnable.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Risk `med` because duplicating gates across workflows lengthens the deploy path and a slow/flaky suite can now block publication. The `concurrency` block at `deploy.yml:16-18` must keep `cancel-in-progress: false`.

---

## Tier 15.0

### IMP-144 — Reset load progress when a new load starts
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:145` (`useState<LoadProgress>({ loaded: 0, total: 0 })`), `web/src/App.tsx:173` (`setLoading(true)` on a recency change, with no `setProgress`), `web/src/App.tsx:176-180` (the `onProgress` callback), `web/src/App.tsx:416-418` (`Loading papers from {progress.total} weeks… ({progress.loaded}/{progress.total})`), `web/src/lib/paperIndex.ts:140-148` (`latestIndexDate` returning `null` short-circuits `loadPapers` and returns `[]` **before** any progress callback fires)
- **Intent:** `progress` is initialized once and never reset. On a recency change the component sets `loading = true` but leaves `progress` at the previous load's values, so the status line renders the *old* window's totals — "Loading papers from 9 weeks… (9/9)" while three new shards are actually in flight. Separately, when the manifest has no usable `shard.to`, `loadPapers` returns `[]` at `paperIndex.ts:140-142` without ever calling `onProgress`, so the UI has rendered nothing and the status line reads "Loading papers from 0 weeks… (0/0)".
- **Acceptance criteria:**
  1. The same effect that calls `setLoading(true)` at `App.tsx:173` also calls `setProgress({ loaded: 0, total: 0 })`, so no status line ever shows a previous load's counts.
  2. The "0/0" case is unreachable: when `loadPapers` returns early at `paperIndex.ts:140-142` (no reference date, or zero needed shards), the rendered status text names the empty window rather than rendering "{total} weeks… ({loaded}/{total})" with both values zero. Either the counts are omitted when `total === 0`, or `loadPapers` reports a final `{ loaded: total, total }` before returning.
  3. A test in the `urlState`-adjacent App test file is not required (component tests are IMP-132's scope); instead the check is behavioural, per the Verification method.
  4. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px with a throttled network, switch the recency chip from 60 to 30 and screenshot the loading state to `.improve/artifacts/IMP-144/feed-progress-reset-desktop-1280.png` — the week total must match the new window, not the previous one. Then hand-edit a scratch `web/public/data/index.json` so every shard entry has `"to": ""`, reload, and confirm no "0 weeks… (0/0)" string is rendered. Browser console must stay clean (profile §4.2).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Profile WEB-06 and WEB-48 split this defect in two; IMP-067 owns the "0 papers match" half and this item owns the `progress` half. They touch `App.tsx` at adjacent lines — land them in the same change if convenient. Baseline `baseline-feed-preview-build-desktop-1280.png` shows the loading state to compare against.


### IMP-145 — Bound the size of an imported collection file
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/components/CollectionsView.tsx:165-180` (`handleFile`, whose `await file.text()` at `:171` is unbounded), `web/src/components/CollectionsView.tsx:228-232` (where `importError` is rendered)
- **Intent:** `handleFile` reads the chosen file straight into memory with `await file.text()` and then `JSON.parse`s it, with no size check. A multi-gigabyte file freezes the tab with no error and no way back short of killing the tab. The existing error path at `:173` and `:178` already produces the right `role="alert"` copy for two failure kinds, so a third is cheap.
- **Acceptance criteria:**
  1. `handleFile` checks `file.size` **before** calling `file.text()`, and rejects any file larger than a named constant (`MAX_IMPORT_BYTES`, 10 MB is the documented choice; a collection export is a few hundred KB, so this is ~30x headroom).
  2. An oversized file sets `importError` to a third distinct sentence naming the limit, rendered through the same `role="alert"` banner at `:229` as the existing two messages. `await file.text()` is never reached for such a file.
  3. The `accept` attribute and the `.json` extension check are unchanged, and the success path is unchanged.
  4. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in the browser import a hand-made 12 MB `.json` file and confirm the alert appears immediately (no tab freeze) with the wording from criterion 2; screenshot to `.improve/artifacts/IMP-145/collections-import-toolong-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-collections-import-error-desktop-1280.png`. Then import a real export to confirm the success path is untouched.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** The 10 MB figure is a stated constant, not an eyeball. Component tests for these paths are IMP-131's scope; the constant must be exported or at least named so that test can assert it.


### IMP-147 — Remove pandas chained indexing from `build_html_feed`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:108-118` (`for i in range(len(df))` with chained `df["Title"][i]`, `df["Date"][i]`, `df["Summary"][i]`, `df["URL"][i]`), `scripts/paper-collector.py:84` (`return pd.DataFrame(all_data)`)
- **Intent:** `df["Col"][i]` inside a loop is the documented pandas anti-pattern and is deprecated in pandas 3 — `requirements.txt:2` says `pandas>=2.0.0` with no upper bound, so a fresh resolve today installs pandas 3.x and the CLI's render step starts emitting `FutureWarning`s or, on a stricter build, raises. The DataFrame is not needed at all for this use: `build_html_feed` only reads four scalar columns once per row.
- **Acceptance criteria:**
  1. `build_html_feed` performs no chained `df["Col"][i]` access: it iterates rows once (`df.itertuples()` / `df.to_dict("records")` / `df.to_numpy()`) and reads each column as a value, so no `Series.__getitem__` by positional label occurs.
  2. The function keeps its current signature `build_html_feed(df)` and keeps applying `html.escape` to every interpolated field at the same points, so the two existing tests `tests/test_paper_collector.py:35` (`test_escapes_html_in_paper_fields`) and `:46` (`test_uses_https_for_mathjax`) pass **unchanged**.
  3. Running the function under `python -W error::FutureWarning` produces no warning.
  4. `cd web && npm run typecheck` is not relevant; `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -W error::FutureWarning scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 3 --output-dir /tmp/rpf-chain` exits 0 with no warning; then diff the generated HTML at `/tmp/rpf-chain` against the output produced by the pre-change code for the same three papers — the two must be byte-identical.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Touches the same lines as IMP-118 (the malformed `<body>`/`<b>` nesting in the same function); the two should land in one change so the generated output is only re-baselined once. Criterion 2's byte-identical diff is the guard against silently changing rendered output.

### IMP-042 — `dedupe_records` must not mutate its caller's input
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:127` (`merged[paper_id] = dict(record)` — a shallow copy) and `:130-134` (the category union append), `tests/test_build_index.py:92-112`
- **Intent:** The merge is a shallow `dict` copy, so `existing["categories"]` is the same list object as the input record's, and the union loop appends into it. Recon verified that after `dedupe_records([A(cs.CV), A(cs.LG)])` the input's first record has `['cs.CV','cs.LG']` instead of `['cs.CV']`. It is idempotent in the one place it is used today, and the existing test only asserts on the output, so a regression would be invisible.
- **Acceptance criteria:**
  1. After `dedupe_records(records)`, every input record's `categories` list is byte-for-byte what it was before the call.
  2. A new test in `tests/test_build_index.py` asserts the input list is unchanged after a cross-listed merge.
  3. `test_merges_cross_listed_papers_by_id` and `test_preserves_first_seen_metadata` still pass unchanged.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-043 — Preserve legacy arXiv ID prefixes
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:69-74` (`arxiv_id_from_entry`), `scripts/build_index.py:117-135` (`dedupe_records`), `tests/test_build_index.py:70-81` (`ArxivIdTests`)
- **Intent:** `rsplit("/", 1)[-1]` strips the archive prefix, so `https://arxiv.org/abs/hep-th/9901001v1` and `.../math/9901001v1` both become `9901001`. Two distinct papers collide in `dedupe_records` and one paper's metadata is silently dropped. Unreachable for the default `cs.*` categories (post-2007 IDs have no prefix), which is why it has gone unnoticed — but the helper is public and the CLI/notebook paths are unbounded.
- **Acceptance criteria:**
  1. `arxiv_id_from_entry` returns `hep-th/9901001` and `math/9901001` as distinct versionless ids, and still returns `2401.12345` for modern ids.
  2. A new test in `tests/test_build_index.py` asserts the two legacy ids differ and that `dedupe_records` does not merge them.
  3. The two existing `ArxivIdTests` still pass.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-ids` and confirm paper counts are unchanged from the pre-change run for the same query.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because changing the id format changes the `id` value shipped to the browser and stored in existing `localStorage` snapshots (`rpf.papers.v1`). The shape stays "versionless arXiv id" and `PaperCard` keys on it, so the impact is bounded, but say so in the PR.

### IMP-044 — Guard `format_authors`' `str(author)` fallback
- **Status:** TODO
- **Category:** Data validation
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:60` (`name = getattr(author, "name", None) or str(author)`), `scripts/build_index.py:56-66` (`format_authors`), `tests/test_build_index.py:57-67`
- **Intent:** When `author.name` is falsy, the fallback stringifies an arbitrary object, which for a class instance yields `"<module.A object at 0x10a4a67b0>"` — a memory address that gets written into `paper.authors` and shipped to the browser, breaking byte-for-byte reproducibility of the index for that record. It is exactly the branch whose whole purpose is "we don't know".
- **Acceptance criteria:**
  1. `format_authors` never returns a string containing `object at 0x`; an author whose name cannot be resolved is skipped (or replaced with a fixed literal), and the function still returns `[]` for `None`/`[]` input.
  2. A new test in `tests/test_build_index.py` passes an author object with `name = None` and asserts the output contains no `0x` address and that two identical calls return identical strings.
  3. The two existing `FormatAuthorsTests` still pass.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then run the determinism check in IMP-080 twice over the same records and confirm byte-identical output.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-045 — Stop the retention count from over-reporting
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:219` (`count += 1`), `scripts/build_index.py:149-151` (`build_shards` discards records with no `published`)
- **Intent:** `count` is incremented for every appended record, including records `build_shards:149` later discards for having no `published`, so the `%d papers within retention window for %s` line over-reports. That log line is the only per-category signal an operator has, so an over-count is a misleading signal, not just cosmetic.
- **Acceptance criteria:**
  1. The logged per-category count equals the number of records that category contributed to the deduplicated set.
  2. A test in `tests/test_build_index.py` drives the loop with a record lacking `published` and asserts the logged count excludes it.
  3. The log line format is unchanged apart from the corrected number.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-count` and compare the logged per-category count against the papers actually written.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-020
- **Priority score:** 15.0
- **Notes:**

### IMP-046 — Guard `write_index` so an unwritable out-dir returns exit 1
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:298` (`write_index(args.out_dir, ...)` unguarded in `main`), `scripts/build_index.py:237` (`os.makedirs`)
- **Intent:** An unwritable `--out-dir` propagates a raw `OSError: [Errno 30] Read-only file system` traceback out of `main()` instead of a logged error and exit 1, so a misconfigured deploy job dies with a stack trace rather than a diagnosable message.
- **Acceptance criteria:**
  1. `main()` catches `OSError` around `write_index`, logs the out-dir and the exception via `logging.error`, and returns `1`.
  2. A test in `tests/test_build_index.py` points `--out-dir` at a path that cannot be created and asserts `main()` returns `1` rather than raising.
  3. `readme.md` needs no change.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `mkdir -p /tmp/rpf-ro && chmod 555 /tmp/rpf-ro && /tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 2 --out-dir /tmp/rpf-ro/nope` prints exactly one `logging` ERROR line naming the out-dir and exits 1 with no Python traceback (then `chmod 755 /tmp/rpf-ro`).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-049 — Resolve `DEFAULT_OUT_DIR` against the repo root
- **Status:** TODO
- **Category:** Configuration & defaults
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:34` (`DEFAULT_OUT_DIR = os.path.join("web", "public", "data")`), `scripts/paper-collector.py:40` (`--output-dir` default `results`)
- **Intent:** Both defaults are CWD-relative, so running either script from anywhere but the repo root writes to a stray directory that nothing deploys and no gitignore covers. `DEFAULT_OUT_DIR` is never exercised by a test.
- **Acceptance criteria:**
  1. `DEFAULT_OUT_DIR` is derived from `os.path.dirname(os.path.abspath(__file__))` so it always points at `<repo>/web/public/data` regardless of CWD, and `--help` still shows a path a reader recognizes.
  2. A test in `tests/test_build_index.py` asserts the resolved default ends with `web/public/data` and is an absolute path.
  3. `paper-collector.py`'s `--output-dir` default is resolved the same way, or the item states explicitly that only `build_index.py` is in scope.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `cd /tmp && /tmp/rpf-venv/bin/python /Users/denimpatel/Desktop/git/research-paper-feed/scripts/build_index.py --category cs.CV --max-per-category 2` and confirm no `/tmp/web` directory was created.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Do not add a `scripts/__init__.py` or rename `scripts/paper-collector.py` in this change; the profile flags the hyphenated filename as do-not-touch and no item in this backlog restructures the import path.

### IMP-050 — Make downloads and extractions honor `--output-dir`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:74-79` (`f"{title_slug}.pdf"`, `f"{title_slug}.tar.gz"`, `f"./extracted/{title_slug}"`)
- **Intent:** PDFs, tarballs, and the `./extracted/` tree all land in the current working directory, ignoring `--output-dir` entirely. Running the documented `--download-sources` example litters the repo root with untracked multi-MB archives that nothing ignores, and the `.tar.gz` is never deleted after extraction.
- **Acceptance criteria:**
  1. `--download-pdfs`, `--download-sources`, and the `extracted/` tree are written under `args.output_dir`, and the `.tar.gz` is removed once extraction succeeds.
  2. A test in `tests/test_paper_collector.py` runs `fetch_papers` with a fake result and asserts no file is created in CWD.
  3. `readme.md:100` ("Directory the generated HTML feed is written to") is reworded to say the flag governs all output.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then from a scratch CWD run `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --output-dir /tmp/rpf-dl --download-sources` and confirm `ls -R /tmp/rpf-dl` holds every artifact and the scratch CWD is empty.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** IMP-093 repairs the arxiv-4 download API, but IMP-050 deliberately does **not** declare a dependency on it: the unit test in criterion 2 uses a fake result and needs no network, so the two can land in either order. Only the end-to-end verification run needs IMP-093 first.

### IMP-051 — Return a real exit code from `paper-collector.py`
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:149` (`main()` called bare), `scripts/paper-collector.py:125-145` (`main` has no return), `scripts/build_index.py:309` (`sys.exit(main())` — the convention)
- **Intent:** `main()`'s return value is discarded, so the CLI always exits 0. A run that fetched nothing reports success, and nothing in a shell wrapper or CI can detect failure. `build_index.py:309` already does this correctly, so this is an inconsistency with the repo's own convention.
- **Acceptance criteria:**
  1. `main()` returns `0` on success and non-zero when zero papers were fetched or the output could not be written, and the module ends with `sys.exit(main())`.
  2. A test in `tests/test_paper_collector.py` stubs `fetch_papers` to return an empty DataFrame and asserts `main()` returns non-zero.
  3. `python scripts/paper-collector.py --help` still exits 0.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 0 ; echo "exit=$?"` prints `exit=2` (argparse) rather than 0.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-022
- **Priority score:** 15.0
- **Notes:** Depends on IMP-022 (formerly IMP-048) because the end-to-end check reuses `--max-papers 0` to prove the CLI no longer exits 0 on a zero-paper run. Criterion 2 is independent and can land first.

### IMP-052 — Pass `encoding="utf-8"` to the CLI's text writes
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:143` (`open(filename, "w")` with no encoding), `scripts/build_index.py:240,243` (the correct pattern to copy)
- **Intent:** The default platform encoding makes the CLI's HTML writer raise `UnicodeEncodeError` on a non-ASCII paper title under a non-UTF-8 locale. macOS hides this via PEP 538 locale coercion; containers and bare Linux runners do not. arXiv titles contain non-ASCII constantly.
- **Acceptance criteria:**
  1. `open(filename, "w", encoding="utf-8")` is used at `paper-collector.py:143`, and `to_csv` at `:138` is passed `encoding="utf-8"` for symmetry with `build_index.py`.
  2. A test in `tests/test_paper_collector.py` writes a feed whose title contains `é` under `LC_ALL=C PYTHONCOERCECLOCALE=0` and asserts no exception.
  3. The output bytes are identical regardless of the ambient locale.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `LC_ALL=C PYTHONCOERCECLOCALE=0 /tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --output-dir /tmp/rpf-enc` succeeds and `file /tmp/rpf-enc/*.html` reports UTF-8.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-053 — Handle `pdf_url is None` in `build_html_feed`
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:111` (`html.escape(df["URL"][i])`), `scripts/paper-collector.py:66` (`"URL": result.pdf_url`)
- **Intent:** arxiv 4.x declares `Result.pdf_url` as `str | None`, so a record with no PDF makes `html.escape(None)` raise `AttributeError: 'NoneType' object has no attribute 'replace'`, killing the whole run at the render step after the network work is already done.
- **Acceptance criteria:**
  1. A record with `pdf_url is None` renders an abs-page link (or no link) instead of raising.
  2. A test in `tests/test_paper_collector.py` builds a DataFrame whose `URL` column contains `None` and asserts `build_html_feed` returns a string with no traceback.
  3. `html.escape` is still applied to every non-null field.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** The mirror change on the index side is IMP-019 (`types.ts` nullability).

### IMP-054 — Make `DEFAULT_DELAY_SECONDS` configurable
- **Status:** TODO
- **Category:** Configuration & defaults
- **Type:** improvement
- **Area / files:** `scripts/arxiv_common.py:16` (`DEFAULT_DELAY_SECONDS = 10`), `scripts/arxiv_common.py:20-26` (`build_client`), `scripts/build_index.py:248-275`
- **Intent:** The delay is hard-coded at 3x arXiv's stated 3-second minimum, so a full 5-category production run costs roughly 2-5 minutes of pure sleeping. It is not configurable and there is no per-category backoff, so a local smoke run and a production run pay the same 10 s per page.
- **Acceptance criteria:**
  1. The delay is settable from an environment variable (e.g. `ARXIV_DELAY_SECONDS`) or a `--delay-seconds` flag on `build_index.py`, defaulting to the current 10.
  2. A test in `tests/test_arxiv_common.py` asserts `build_client` passes the configured value through, using the existing `_install` harness at `:49-65`.
  3. The default is unchanged unless a value below 3 is rejected.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `time ARXIV_DELAY_SECONDS=3 /tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-delay` completes in roughly 3-4 s rather than 10-11 s.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because lowering the delay toward arXiv's ToU minimum increases the chance of rate limiting. Do not default below 3 seconds; if the value is set lower, log a warning.

### IMP-055 — Move `logging.basicConfig` out of module import scope
- **Status:** TODO
- **Category:** Code health & refactoring
- **Type:** improvement
- **Area / files:** `scripts/arxiv_common.py:13`, `scripts/paper-collector.py:18`, `scripts/build_index.py:40` (three `basicConfig` calls, two different formats)
- **Intent:** Three modules reconfigure the process-wide root logger at import time, with two different formats. `build_index.py:40`'s `format="%(levelname)s %(message)s"` leaks into any other importer, and the test suite inherits the root logger configuration as a side effect of loading a module by path.
- **Acceptance criteria:**
  1. `scripts/arxiv_common.py` attaches a `logging.NullHandler` instead of calling `basicConfig`, and each script calls `basicConfig` exactly once inside `main()` with one shared format.
  2. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` still prints the same two `main()` messages (`No papers fetched...`, the write summary) and does not gain new log noise.
  3. No other behavior changes; the suite count is unchanged at this step.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `grep -n basicConfig scripts/*.py` shows exactly two call sites, both inside `main()`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-056 — Inject a `now` parameter into `collect_papers`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** improvement
- **Area / files:** `scripts/build_index.py:203-221` (`collect_papers`), `scripts/build_index.py:207` (`cutoff = datetime.now(timezone.utc) - timedelta(...)`), `scripts/build_index.py:138-142` (`build_shards` already accepts `generated_at`)
- **Intent:** The cutoff clock is hard-coded with no injection point while `build_shards` *does* accept `generated_at`. That asymmetry is precisely why `collect_papers` — the function that decides whether the deployed site has data — has zero test coverage. This item is the prerequisite for the tests in IMP-059.
- **Acceptance criteria:**
  1. `collect_papers` accepts an optional `now=None` parameter defaulting to `datetime.now(timezone.utc)`, and the cutoff is derived from it.
  2. The existing call site in `main()` at `:282-287` is unchanged in behavior.
  3. A test in `tests/test_build_index.py` calls `collect_papers` with an explicit `now` and a fake `arxiv_common.iter_results` and asserts a record older than `now - retention_days` is excluded.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-058 — Stop the import path from leaking orphan snapshots
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:98-107` (`mergeImport` adds papers *before* the id-collision check) vs. `web/src/lib/collections.ts:78-92` (`prunePapers`), `web/src/lib/collections.ts:150,170` (the only two `prunePapers` call sites)
- **Intent:** On an id collision `mergeImport` returns early *after* merging the payload's papers, and `mergeImport` never prunes. Those unreferenced snapshots live in `state.papers`, get serialized to `localStorage` on the next save, survive `loadState` (which prunes `paperIds` but not `papers`), and are re-saved indefinitely — a slow unbounded growth path.
- **Acceptance criteria:**
  1. After any `mergeImport`, `state.papers` contains no entry that no collection's `paperIds` references.
  2. A new test in `web/src/lib/__tests__/collections.test.ts` imports a payload whose collection id already exists, with papers that no collection references, and asserts `Object.keys(state.papers)` is empty afterwards.
  3. The existing `mergeImport` id-collision test still passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then import the same export twice in the browser and confirm `localStorage` does not grow on the second import.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-059 — Report import success and duplicate ids
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:308-310` (`handleImport` dispatches and nothing else), `web/src/components/CollectionsView.tsx:163,228-232` (only `importError` is rendered), `web/src/lib/collections.ts:105-107` (collision early return)
- **Intent:** A successful import is completely invisible, and importing the same export twice looks like nothing happened because the collection is silently dropped while the papers merge. Neither outcome is reported.
- **Acceptance criteria:**
  1. A successful import renders a `role="status"` confirmation naming the collection and the number of papers.
  2. An import whose collection id already exists renders a distinct message stating the collection was already imported, and the user can tell the two apart.
  3. A `role="status"` line also reports **papers that were discarded as invalid** — the count `parseExportPayload` dropped, or the word "none" — because today the two failure modes are indistinguishable to the user: an XSS-laden export is silently cleaned *and* a `null`-URL export is silently emptied (the shape IMP-151b, `7a2ed82`, had to fix), and both look identical to someone who exported 5 papers and imported 2. Raise the count in `.improve/reports/regression-sweep-1.md` §"Minimal fix", second paragraph.
  4. `cd web && npm run typecheck && npm test` passes, with a new test in `web/src/lib/__tests__/collections.test.ts` covering the duplicate-id outcome and the discarded-paper count.
- **Verification method:** `cd web && npm run typecheck && npm test`; then export a collection, import it once and screenshot the confirmation to `.improve/artifacts/IMP-059/collections-import-success-desktop-1280.png`, import it again and screenshot the duplicate message to `.improve/artifacts/IMP-059/collections-import-duplicate-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-060 — Reject an import whose `version` is unknown
- **Status:** TODO
- **Category:** Data validation
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:206-227` (`parseExportPayload`), `web/src/lib/collections.ts:218-226` (`version: 1` hardcoded), `web/src/lib/types.ts:19`
- **Intent:** `parseExportPayload` hardcodes `version: 1` and never inspects `candidate.version`, so a future incompatible export format would be imported silently and corrupt the user's local state. The `ExportPayload.version` field is declared as the literal type `1`, so nothing forces the producer and consumer to agree.
- **Acceptance criteria:**
  1. A payload whose `version` is present and not `1` is rejected (returns `null`), and a payload with `version` absent is still accepted for backwards compatibility.
  2. A new test in `web/src/lib/__tests__/collections.test.ts` covers both the rejected `version: 2` and the accepted missing-`version` cases.
  3. The existing `parseExportPayload` accept/reject tests still pass unchanged.
- **Verification method:** `cd web && npm run typecheck && npm test`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-061 — Debounce the search query
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/components/FeedControls.tsx:36-43` (`onChange` fires `onQueryChange` per keystroke), `web/src/App.tsx:207-224` (`visiblePapers` memo re-runs `rankPapers` over the whole corpus), `web/src/lib/search.ts:80-91` (`rankPapers`)
- **Intent:** Each character typed re-ranks the entire loaded corpus. The index on disk is 2,812 papers / 1,408,061 characters of abstract across 2 shards, and `scorePaper` builds three fresh lowercase strings plus one combined template string per paper per keystroke — roughly 3.9 MB of string allocation per keystroke at that size, growing linearly with the index.
- **Acceptance criteria:**
  1. The committed value of `query` used for filtering and ranking is debounced by roughly 150-250 ms while the input field itself stays fully responsive (controlled input updated immediately, filter applied on the debounce).
  2. Typing a 10-character query triggers at most two ranking passes, measurable by instrumenting `rankPapers` with a counter in a scratch build.
  3. Result correctness is unchanged: the same query string produces the same result set as before, verified by a screenshot comparison at 1280px.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then at 1280px type `diffusion models` and screenshot the settled result to `.improve/artifacts/IMP-061/feed-search-debounced-desktop-1280.png`, comparing the visible result set against `.improve/artifacts/baseline/baseline-feed-empty-search-desktop-1280.png`'s sibling states; confirm the input text is complete before the list settles.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because debouncing changes user-visible timing and interacts with the hash write (IMP-062) and the live-region announcement (IMP-099). Because a debounce can change which results are shown first, screenshot-verify rather than assume.

### IMP-062 — Coalesce the per-keystroke `history.replaceState`
- **Status:** TODO
- **Category:** Performance
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:241-243` (`setQuery` → `applyState(..., "replace")`), `web/src/App.tsx:61-85` (`writeHash` calling `history.replaceState` at `:83`)
- **Intent:** Every keystroke issues a `history.replaceState`. Browsers throttle history calls (Safari throws "Throttling navigation to prevent the browser from hanging" past roughly 100 calls per 10 s), so a fast typist can produce console errors and dropped history state on the production build.
- **Acceptance criteria:**
  1. Typing 20 characters into the search box issues at most 2 `history.replaceState` calls, measurable with `performance.getEntriesByType` or a patched `history.replaceState` in the console.
  2. The final URL after typing still contains the full `q=` value.
  3. The production build's console stays clean while typing quickly, with no "Throttling navigation" message.
- **Verification method:** `cd web && npm run build` then `npm run preview -- --port 5199 --strictPort`; in the console patch `history.replaceState` with a counting wrapper, type 20 characters, and confirm the count is ≤ 2. Screenshot to `.improve/artifacts/IMP-062/feed-search-hash-coalesced-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-061
- **Priority score:** 15.0
- **Notes:**

### IMP-063 — Memoize `isSaved` as a `Set`
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:261-266` (`isSaved` rebuilding a `some`+`includes` scan per call), `web/src/components/PaperCard.tsx:117` (`isSaved(collection.id, paper.id)` per collection per card), `web/src/components/PaperList.tsx:49` (forwarded to every card)
- **Intent:** The lookup is O(collections × paperIds) and is called once per collection per visible card, per render. With 50 visible cards, 10 collections, and 100 ids each that is ~50,000 string comparisons on every keystroke and every checkbox toggle.
- **Acceptance criteria:**
  1. `isSaved` is backed by a `Set` of `collectionId` + paper id built in a `useMemo` keyed on `collections`, giving O(1) membership.
  2. Saved-state display is byte-identical to the baseline for every card in both views at 1280px and 390px.
  3. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then at 1280px open a save menu with one collection checked and screenshot to `.improve/artifacts/IMP-063/feed-savemenu-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-savemenu-open-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-064 — Wrap `PaperCard` in `React.memo`
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/components/PaperCard.tsx:32` (`export function PaperCard`), `web/src/components/PaperList.tsx:24,49` (forwards props to every card), `web/src/App.tsx:261-266` (`isSaved` identity changes every render)
- **Intent:** Neither `PaperCard` nor `PaperList` is memoized, and `isSaved` is a new closure each render, so all 50 visible cards re-render — re-evaluating their `useMemo` abstract and rebuilding their `<details>` subtree — on every keystroke and every checkbox toggle.
- **Acceptance criteria:**
  1. `PaperCard` is wrapped in `React.memo` and `isSaved` is stabilized (see IMP-063) so that a card whose props are unchanged does not re-render.
  2. Saving a paper to one collection updates that card's checkbox without re-rendering the other 49 cards, measurable with the React DevTools Profiler or a render counter in a scratch build.
  3. Visual output is unchanged at 1280px and 390px.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then at 1280px toggle one checkbox and screenshot the save menu to `.improve/artifacts/IMP-064/feed-savemenu-memo-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-savemenu-open-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-063
- **Priority score:** 15.0
- **Notes:** Risk `med` because memoization is exactly the class of change that produces stale props. Verify the create-and-save path at `PaperCard.tsx:144-165` and the `actionSlot` path used by `CollectionsView.tsx:136-144` after wrapping.

### IMP-065 — Cap what the collections view renders
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/components/CollectionsView.tsx:41-43,131-147` (every saved paper in every collection rendered with no cap)
- **Intent:** The feed pages at 50 with a "Load more" button, but the collections view renders *every* saved paper with no equivalent — a single 500-paper collection mounts 500 full `PaperCard`s with per-card `useState`, which is inconsistent with the feed and can stall the tab.
- **Acceptance criteria:**
  1. `CollectionSection` renders at most 50 papers initially and offers the same "Load … more (N remaining)" affordance the feed uses, reusing `LOAD_MORE_STEP` rather than a new constant.
  2. A saved paper beyond the cap is reachable without a page reload.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then save 60 papers into one collection, open `#view=collections`, and screenshot the capped list with its load-more control to `.improve/artifacts/IMP-065/collections-capped-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-066 — Reset scroll on view switch
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:237-239` (`setView` applies hash and state with no scroll reset), `web/src/styles.css:113-120` (`.site-header`, `position: sticky` at `:114`, 64px tall)
- **Intent:** Switching Feed ↔ Collections keeps the old scroll offset, so the user lands mid-list with the toolbar hidden behind the 64px sticky header. Recon observed this in both directions at 1280px and 390px.
- **Acceptance criteria:**
  1. Activating either nav button sets `window.scrollTo(0, 0)` **and** leaves focus predictable: exactly one mechanism is chosen and stated in the PR body. If scroll reset alone is chosen, assert `window.scrollY === 0` after the switch; if focus move alone, assert `document.activeElement` is the view's `<h1>` and that the toolbar is visible.
  2. The behavior is identical at 1280px and 390px.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then scroll to the bottom of the feed, click Collections, and screenshot to `.improve/artifacts/IMP-066/collections-top-after-switch-mobile-390.png` and `.improve/artifacts/IMP-066/feed-top-after-switch-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-collections-mobile-390.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-067 — Hide the result count while papers are loading
- **Status:** TODO
- **Category:** UI polish & visual consistency
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:405` (`resultCount={visiblePapers.length}`), `web/src/App.tsx:414-419` (loading `<p>`), `web/src/components/FeedControls.tsx:108-110` (the `role="status"` count)
- **Intent:** On first paint the UI shows "0 papers match" directly beside "Loading papers from 2 weeks… (0/2)", so the count contradicts the loading state and two live regions announce at once.
- **Acceptance criteria:**
  1. While `loading` is true, the result count is not rendered as "0 papers match"; either it is omitted or reads as a loading state.
  2. The count reappears with the correct value once the first payload lands.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px throttle the network, load the feed, and screenshot the loading state to `.improve/artifacts/IMP-067/feed-loading-count-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-preview-build-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-068 — Clamp the recency options to `manifest.retentionDays`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/types.ts:25` (`retentionDays`, written by `scripts/build_index.py:186` and read by nothing), `web/src/App.tsx:26` (`RECENCY_VALUES`), `web/src/components/FeedControls.tsx:16` (`RECENCY_OPTIONS`), `web/src/components/FeedControls.tsx:70-80` (the chips)
- **Intent:** The pipeline ships `retentionDays` and the UI never reads it, so an index built with `--retention-days 30` still offers a "60 days" chip that silently returns the same result as 30. The user cannot tell the option is a lie.
- **Acceptance criteria:**
  1. The recency chips are derived from `manifest.retentionDays` and never offer a window longer than the index actually covers.
  2. When `retentionDays` is smaller than 60, the longest offered chip equals `retentionDays` and the others are filtered to values below it.
  3. A test in `web/src/lib/__tests__/paperIndex.test.ts` asserts `windowStart(latestIndexDate(m), 60)` against a manifest whose `retentionDays` is 30 does not produce a window the manifest can satisfy, or the new option-derivation helper is unit-tested for both cases.
- **Verification method:** `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 300 --retention-days 30` into a scratch out dir, serve it, and confirm no "60 days" chip is offered. Screenshot to `.improve/artifacts/IMP-068/feed-recency-clamped-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because the recency union `RecencyDays = 7 | 30 | 60` (`web/src/lib/types.ts:38`) no longer covers the offered set; the type must be widened or the derivation constrained. Do not change the wire format.

### IMP-069 — Add "Copy BibTeX" to `PaperCard`
- **Status:** TODO
- **Category:** Missing features natural to this repo's purpose
- **Type:** new-feature
- **Area / files:** `web/src/components/PaperCard.tsx:98-106` (`.paper__links` with only the arXiv and PDF links)
- **Intent:** A research feed with no citation export is missing the single most obvious feature for its audience. There is currently no way to get a citable reference for a paper without leaving the site and hand-assembling it.
- **Acceptance criteria:**
  1. A "Copy BibTeX" control in `.paper__footer` copies a BibTeX entry to the clipboard. The entry is built by a **pure, exported helper** (e.g. `buildBibTeX(paper)` in a new `web/src/lib/cite.ts`) from exactly five fields — `id`, `title`, `authors`, the year parsed from `published`, and `absUrl` — and the key is the bare id (e.g. `KIM2401.01234`), not a fabricated citation key. Clipboard write uses `navigator.clipboard.writeText`, with the fallback being: if `navigator.clipboard` is undefined, select-and-copy via a temporary `document.execCommand('copy')` on an off-screen textarea, and report the fallback path's failure through the same `role="status"` message as criterion 2.
  2. Success and failure are both announced via a `role="status"` message; no icon-only button is introduced.
  3. A new test in `web/src/lib/__tests__/cite.test.ts` asserts `buildBibTeX` output contains the paper's `id` and `absUrl`, and that a title containing `{` or `}` is brace-balanced so the entry is parseable by BibTeX. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then at 1280px press "Copy BibTeX" on the first card, paste into a text editor, and confirm the entry. Screenshot the confirmation to `.improve/artifacts/IMP-069/feed-copy-bibtex-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` to confirm no layout regression.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** New styling goes in `web/src/styles.css`; never add a `style=` prop. Keep the runtime dependency set at exactly `react` + `react-dom`.

### IMP-070 — Gate the contributor build instructions on `import.meta.env.DEV`
- **Status:** TODO
- **Category:** Content accuracy
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:364-376` (the `.panel--error` block telling any visitor to "Build the index locally" with the same instruction twice), `web/src/lib/paperIndex.ts:26-28` (`INDEX_HELP`, same instruction plus a meaningless `(HTTP 200)` suffix)
- **Intent:** Every visitor of the live Pages site who hits a missing index is told to run `python scripts/build_index.py`, and the panel repeats the instruction twice in adjacent `<pre>` blocks. The `(HTTP 200)` suffix is meaningless because the SPA fallback returned 200 with HTML — which the code already detected.
- **Acceptance criteria:**
  1. In a production build, the panel shows one visitor-facing sentence ("The paper index has not been built yet. It is rebuilt on a schedule.") and no shell command.
  2. In `npm run dev`, the contributor instructions are present below a labelled heading, appear exactly once, and omit the `(HTTP NNN)` suffix.
  3. `cd web && npm run build` then `npm run preview` shows the production copy; the dev server shows the contributor copy.
- **Verification method:** `cd web && npm run build && npm run preview -- --port 5199 --strictPort`, remove `web/public/data/`, and screenshot the production panel to `.improve/artifacts/IMP-070/feed-index-missing-preview-desktop-1280.png`; then `npm run dev -- --port 5199 --strictPort` and screenshot the dev panel to `.improve/artifacts/IMP-070/feed-index-missing-dev-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-index-missing-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** `import.meta.env.DEV` is a Vite built-in already available in `web/src`; `web/tsconfig.json:18` already sets `types: ["vite/client"]`.

### IMP-071 — Give the file-import input a real focus target
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/styles.css:638-644` (`.import-button input[type="file"] { width: 1px; height: 1px; opacity: 0 }`), `web/src/components/CollectionsView.tsx:215-225` (the label-wrapped input)
- **Intent:** The file input is focusable and in the tab order (recon verified tabIndex 0 and an accessible name of "Import collection"), but the `:focus-visible` outline lands on an invisible 1×1 px element, so a keyboard user has no visible focus position at all.
- **Acceptance criteria:**
  1. The import control shows a visible focus indicator of at least 2 px following the app's `:focus-visible` treatment (`web/src/styles.css:86-90`) when reached by keyboard.
  2. The visible label text and the input's accessible name are unchanged ("Import collection").
  3. The 1×1 px input remains visually hidden so the label keeps its current appearance.
- **Verification method:** `cd web && npm run build` then `npm run preview -- --port 5199 --strictPort`; Tab to the import control in `#view=collections` at 1280px and screenshot to `.improve/artifacts/IMP-071/collections-import-focus-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** The standard fix is a `:focus-within` outline on `.import-button`; do not remove the input from the tab order, since a hidden input is the only reason the label is keyboard-operable here.

### IMP-072 — Make `<main id="main">` focusable for the skip link
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:316` (`<a className="skip-link" href="#main">`), `web/src/App.tsx:346` (`<main className="app__main" id="main">`)
- **Intent:** Activating the skip link scrolls to `#main` but does not move keyboard focus, because the target is not focusable. The next Tab can resume from the document top in several browsers, so the link does not do what it promises.
- **Acceptance criteria:**
  1. `<main id="main">` carries `tabIndex={-1}`, and pressing the skip link places keyboard focus on it.
  2. `tabIndex={-1}` does not add `<main>` to the sequential tab order.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px press Tab once (skip link) then Enter, and confirm `document.activeElement.tagName === "MAIN"`. Screenshot to `.improve/artifacts/IMP-072/feed-skiplink-focus-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-073 — Add list semantics to both paper lists
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/components/PaperList.tsx:43` (`<div className="paper-list">` wrapping `<article>`), `web/src/components/CollectionsView.tsx:131` (the same pattern)
- **Intent:** A screen-reader user navigating by list finds nothing in either view, because the container is a plain `div` and each entry is an `<article>`. WCAG 1.3.1 requires the structure be programmatically determinable.
- **Acceptance criteria:**
  1. Both containers expose list semantics — `<ul>`/`<li>` or `role="list"`/`role="listitem"` — and the accessible name/reading order of each card is unchanged.
  2. The class names and therefore all existing CSS selectors (`web/src/styles.css:291-295`, `:687`) still apply, and no styling changes.
  3. `cd web && npm run typecheck && npm run build` succeed with the built CSS growing by less than 1 kB.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then at 1280px screenshot the feed to `.improve/artifacts/IMP-073/feed-list-semantics-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` — the rendered geometry must be unchanged, since only `role` attributes changed. Confirm via the accessibility tree that the container's role is now `list` and that the card count is unchanged.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** `role="list"` on a `div` is the minimal change and avoids touching the CSS; using `<ul>` requires resetting list styling in `web/src/styles.css`, which this item should avoid.

### IMP-074 — Fix the heading hierarchy in both views
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:387` (`<h1>Recent arXiv papers in CS &amp; AI</h1>`), `web/src/components/PaperCard.tsx:56` (`<h3 className="paper__title">`), `web/src/components/CollectionsView.tsx:81` (`<h2 className="collection__title">`)
- **Intent:** The feed jumps `<h1>` → `<h3>`, skipping `<h2>`, and the collections view has **no `<h1>` at all** — it opens straight into a form and then an `<h2>`. Because `PaperCard` is used at both nesting levels, the fix must be a prop-driven heading level, not a tag swap.
- **Acceptance criteria:**
  1. Feed view: exactly one `<h1>` (`App.tsx:387`) followed by `<h2>` per paper — zero `<h3>` in the DOM. Collections view: exactly one `<h1>`, each collection name is an `<h2>` (`CollectionsView.tsx:81`), and each paper within it is an `<h3>`. Stated as DOM queries: `document.querySelectorAll('h3').length === 0` in the feed, and `document.querySelectorAll('h1').length === 1` in both views.
  2. The heading level is driven by a prop on `PaperCard` with a default matching its current usage, and the rendered text is byte-identical to the baseline.
  3. `cd web && npm run typecheck && npm run build` succeed and the built CSS is unchanged apart from any selector rename.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then at 1280px run `document.querySelectorAll('h1,h2,h3,h4').length` per view and screenshot both to `.improve/artifacts/IMP-074/feed-headings-desktop-1280.png` and `.improve/artifacts/IMP-074/collections-headings-desktop-1280.png`, compared against the two baseline collections shots.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because `.paper__title` and `.collection__title` are styled by element-independent class selectors, but any tag change that alters default font sizing will show up. Screenshot both views before and after.

### IMP-075 — Make the reduced-motion block actually disable motion
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/styles.css:755-759` (the `@media (prefers-reduced-motion: reduce)` block setting only `scroll-behavior: auto`), versus the live transitions at `web/src/styles.css:157,265,303,436,439-442`
- **Intent:** The block is dead code: nothing in the stylesheet ever sets `scroll-behavior`, so it has zero effect, while `.paper:hover` `translateY(-2px)` (`:306-310`) and `.button:hover` `translateY(-1px)` (`:439-442`) and four transitions keep animating for users who asked for no motion.
- **Acceptance criteria:**
  1. Inside the existing `@media (prefers-reduced-motion: reduce)` block, every `transition` and `transform` in the stylesheet is neutralized for affected rules.
  2. The block is no longer setting a property nothing uses, or it is kept alongside the new rules with a reason.
  3. No visual change occurs for users who have not requested reduced motion.
- **Verification method:** `cd web && npm run build`; then with the OS/browser reduced-motion preference emulated, hover a card and a button at 1280px and confirm no transform or transition runs; screenshot to `.improve/artifacts/IMP-075/feed-reduced-motion-desktop-1280.png` and compare against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` for the non-reduced case.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Do not delete the block — it is the right place for the fix, and the profile's style discipline forbids reformatting untouched rules.

### IMP-076 — Close save menus on Escape and outside click
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/components/PaperCard.tsx:111-167` (the `<details>`-based save menu), `web/src/styles.css:488` (`.save-menu__body`, absolutely positioned)
- **Intent:** The disclosure is a native `<details>`, so its expanded state is announced, but Escape does not close it, a click outside does not close it, focus is never moved into the panel, and multiple menus can be open at once (recon confirmed all three). On a long feed this leaves stray floating panels behind.
- **Acceptance criteria:**
  1. Pressing Escape while a save menu is open closes it and returns focus to its `<summary>`.
  2. A pointer press outside any open save menu closes every open menu.
  3. At most one save menu is open at a time across the whole list.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px open two save menus, press Escape once and confirm both closed, and screenshot the closed state to `.improve/artifacts/IMP-076/feed-savemenu-escape-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-savemenu-open-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** This changes `<details>` open-state behavior. Verify that the checkbox state inside the panel still reflects `isSaved` after a programmatic close, and that `PaperCard`'s local `expanded` state at `:40` is unaffected.

### IMP-077 — Make the notebook's topic input non-interactive
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `notebooks/paper-collector.ipynb` cell 4 (`topic = input("Enter the topic you need to search for : ")`)
- **Intent:** The bare `input()` makes the notebook structurally non-executable headlessly. `jupyter nbconvert --to notebook --execute notebooks/paper-collector.ipynb` runs cells 0-3 and then dies with `StdinNotImplementedError`, which is the pre-existing baseline failure PE-7 — so nothing about the notebook can be verified automatically.
- **Acceptance criteria:**
  1. The topic comes from a cell-level variable with a sensible default that the reader edits, and the `input()` call is either removed or guarded behind a flag that defaults to off.
  2. With `jupyter nbconvert --to notebook --execute`, cells 0 through the HTML cell execute without `StdinNotImplementedError`, given live arXiv access and the shipped default toggles (`DOWNLOAD_PAPER = False`, `DOWNLOAD_RESOURCES = False` at cell 1).
  3. The notebook still reads as "enter your topic here" to a human reader.
- **Verification method:** `cd /path/to/repo && <venv>/bin/jupyter-nbconvert --to notebook --execute --stdout notebooks/paper-collector.ipynb > /dev/null` (needs network for cell 5); if the notebook was deleted under IMP-034, mark this item not-applicable.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-034
- **Priority score:** 15.0
- **Notes:** `jupyter` on this machine resolves to Homebrew jupyterlab on Python 3.14, not to any venv — use `<venv>/bin/jupyter-nbconvert`. This is a deliberate change to a documented interactive behavior (`readme.md:86-90`); the readme's framing of the CLI is unaffected.

### IMP-078 — Guard the notebook's download block and use `safe_filename`
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `notebooks/paper-collector.ipynb` cell 5 (`result.download_pdf(filename=f"{result.title}.pdf")`, `result.download_source(...)`, `file.extractall(f'./extracted/{result.title}')` with no `try`)
- **Intent:** Two problems in one block: arxiv 4 removed both download methods, and with no `try` at all the `AttributeError` kills the kernel on arxiv ≥ 4 (exactly the failure IMP-093's script-side repair addresses); and the **raw** `result.title` is used as a filename with no `safe_filename`, so any title containing `/ : * ? " < > |` raises, and the same title becomes an extraction directory name.
- **Acceptance criteria:**
  1. Each download is wrapped so that an unavailable API or a failed download logs a warning and continues to the next paper, and the tarfile is closed on the error path.
  2. Filenames come from the shared `safe_filename` (imported from `scripts/paper-collector.py`), not from the raw title.
  3. With the shipped defaults (`DOWNLOAD_PAPER = False`, `DOWNLOAD_RESOURCES = False`) nothing changes about the notebook's default behavior.
- **Verification method:** set `DOWNLOAD_PAPER = True` in cell 1, execute the notebook against a narrow topic, and confirm the kernel survives a download failure; inspect the output to confirm the warning names the paper.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-034
- **Priority score:** 15.0
- **Notes:** Not applicable if IMP-034 deletes the notebook.

### IMP-079 — Switch the notebook's MathJax CDN to https
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `notebooks/paper-collector.ipynb` cell 8 (`src="http://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js?config=..."`)
- **Intent:** The notebook loads MathJax over plain HTTP, which is blocked as mixed content on any HTTPS page. `scripts/paper-collector.py:103` uses `https://` and `tests/test_paper_collector.py:46-49` asserts it — the notebook regressed, or was never fixed, and no test covers it.
- **Acceptance criteria:**
  1. The MathJax `src` in the notebook's template begins with `https://`.
  2. The generated HTML contains no `http://` URL for an external resource.
  3. A test or an explicit assertion in the notebook's committed output records this, so it cannot silently regress again.
- **Verification method:** execute the notebook's HTML cell and `grep -c 'src="http://' <generated file>` must be 0; save the generated file to `.improve/artifacts/IMP-079/notebook-mathjax-https.html`.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-034
- **Priority score:** 15.0
- **Notes:** Not applicable if IMP-034 deletes the notebook. The mirror assertion in `tests/test_paper_collector.py:46-49` is the pattern to copy.

### IMP-080 — Add a determinism regression test for the index
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py` (add to `BuildShardsTests` / `WriteIndexTests`), `scripts/build_index.py:157-160` (the `(published, id)` sort), `scripts/build_index.py:157-160` documented determinism goal
- **Intent:** `build_shards` is deterministic by design — `sorted(groups, reverse=True)` plus the `(published, id)` tiebreak, which matters because arXiv returns many papers sharing an identical `published` second — and nothing asserts it. A refactor that dropped the `id` tiebreak would make the index wobble between runs and no test would notice.
- **Acceptance criteria:**
  1. A test builds shards twice from the same records with a fixed `generated_at` and asserts the two results are byte-identical after `json.dumps(..., sort_keys=True)`.
  2. A second test uses records that share an identical `published` value and asserts the intra-shard order is stable and keyed on `id`.
  3. A third assertion covers non-ASCII titles to lock in `ensure_ascii=False` at `scripts/build_index.py:241,244`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-081 — Assert the arguments `main()` passes to `collect_papers`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py:215-249` (`MainTests`, stub `lambda *args, **kwargs` at `:219`), `scripts/build_index.py:282-287` (the call site)
- **Intent:** The stub swallows every argument, so a regression that passes the wrong `retention_days` or `abstract_chars` through `main()` — or drops `--category` on the floor — is completely invisible. This is the cheapest untested seam in the Python suite.
- **Acceptance criteria:**
  1. A new test captures the arguments `main()` passes and asserts `retention_days`, `max_per_category`, and `abstract_chars` equal the parsed CLI values, and that the category list equals `args.categories or DEFAULT_CATEGORIES` (`:280`).
  2. A second case passes `--category cs.CV --retention-days 7` and asserts those exact values arrive.
  3. `test_refuses_to_write_an_empty_index` and `test_writes_index_when_papers_exist` still pass.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:**

### IMP-082 — Anchor the arXiv error tests to the real exception hierarchy
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_arxiv_common.py:21-24` (`FakeArxivError`), `scripts/arxiv_common.py:58` (`except arxiv.ArxivError`)
- **Intent:** The suite substitutes a `FakeArxivError`, so it cannot detect an upstream restructure of `arxiv.ArxivError`. The provisioned arXiv 2.1.3 does subclass `arxiv.HTTPError` and `arxiv.UnexpectedEmptyPageError` under `ArxivError` (checked by execution), but nothing in CI would catch it if an upgrade broke that — and the swallowed-error path is exactly where IMP-004's fix lives.
- **Acceptance criteria:**
  1. A new test asserts `issubclass(arxiv.HTTPError, arxiv.ArxivError)` and `issubclass(arxiv.UnexpectedEmptyPageError, arxiv.ArxivError)` against the **installed** `arxiv`, skipping with a clear message if `arxiv` cannot be imported.
  2. A second assertion confirms `iter_results` actually catches the real `arxiv.ArxivError` by raising that class from a fake client.
  3. The five existing tests in the file still pass, and the fake-based test remains for hermeticity.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.metadata as m; print('arxiv', m.version('arxiv'))"` to record the version the assertion ran against (`arxiv` exposes no `__version__` attribute, so `arxiv.__version__` raises `AttributeError` — do not use it).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** This is the one test that must not be hermetic; it must `skip` rather than fail when `arxiv` is absent, because the suite is otherwise network- and import-free.

### IMP-083 — Add a test for the malformed-shard branch
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/lib/__tests__/paperIndex.test.ts`, `web/src/lib/paperIndex.ts:111-124` (`loadShard` JSON/array handling and the `missing or malformed` throw)
- **Intent:** Three of the four manifest error paths are covered — 404 (`paperIndex.test.ts` "throws a descriptive error when the manifest is missing"), a network throw, and the HTML fallback — but the fourth, a 200 response whose body is not JSON (`paperIndex.ts:90-97`), is **not** covered, and the shard error paths at `:105-124` have no coverage at all — which is why the truncated-index-on-static-host defense at `paperIndex.ts:96-101` and the malformed-shard throw both went unverified.
- **Acceptance criteria:**
  1. A new test makes a shard's `fetch` return 200 with a body that is neither a `Paper[]` nor an object with a `papers` array, and asserts `loadPapers` rejects with a message naming the shard file.
  2. A second test covers a non-`ok` shard response and asserts the rejection names the file and status.
  3. A third test covers a manifest returning HTTP 200 with a non-JSON body and asserts `IndexUnavailableError` with the message from `paperIndex.ts:93-96`.
  4. All 10 pre-existing tests in the file still pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the file to report 13 tests (10 pre-existing + 3 new).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** These tests double as the regression lock for IMP-015, since the partial-failure path reuses the same messages.

### IMP-084 — Add a test for the `mergeImport` orphan leak
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/lib/__tests__/collections.test.ts` (add to the reducer suite), `web/src/lib/collections.ts:94-125` (`mergeImport`), `web/src/lib/collections.ts:78-92` (`prunePapers`)
- **Intent:** `mergeImport` adds the payload's papers at `:98-103` *before* the id-collision check at `:105` and never prunes, so importing an export whose collection id already exists leaves permanent orphan snapshots. The suite's only `mergeImport` test asserts the collision outcome, not the side effect, so the leak is invisible.
- **Acceptance criteria:**
  1. A new test imports a payload whose collection id already exists and whose papers are not referenced by any collection, then asserts `Object.keys(result.papers)` contains no entry absent from every collection's `paperIds`.
  2. A second test imports a payload that *does* add a new collection and asserts all its papers survive.
  3. The existing `mergeImport` collision test still passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the collections file to report 16 tests (14 pre-existing + 2 new).
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-058
- **Priority score:** 15.0
- **Notes:** This is the regression lock for IMP-058, not an independent test request; criterion 1 is exactly IMP-058's criterion 2.

### IMP-085 — Add a `pyproject.toml`
- **Status:** TODO
- **Category:** Packaging & installation
- **Type:** tooling
- **Area / files:** repo root (no `pyproject.toml`, `setup.cfg`, or `tox.ini` exists), `requirements.txt`
- **Intent:** There is no place for any Python tooling configuration, so `ruff`, coverage, and `requires-python` have nowhere to live except ad-hoc per-workflow flags. This is also the root cause of INF-05 and the reason the `# noqa: E402` markers in `scripts/` enforce nothing.
- **Acceptance criteria:**
  1. A `pyproject.toml` exists at the repo root declaring `requires-python` (matching what CI actually resolves) and a `[tool.ruff]` section with `line-length` and target version.
  2. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` still discovers and runs exactly the same 27+ tests, with no new dependency introduced.
  3. `.github/workflows/ci.yml` is unchanged by this item (the lint step is IMP-086's scope).
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -m compileall -q scripts tests` (exit 0) and `git status --porcelain` shows only the new file.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Do not add `[project]` packaging metadata that implies the repo is installable — it is a scripts repo, and `scripts/paper-collector.py` is not importable under its hyphenated name. Keep this to tool configuration.

### IMP-086 — Add `ruff` and a Python lint step in CI
- **Status:** TODO
- **Category:** Tooling, linting, formatting
- **Type:** tooling
- **Area / files:** `pyproject.toml` `[tool.ruff]` (from IMP-085), `.github/workflows/ci.yml:16-19` (`python-tests` job), `requirements.txt` (or a new dev-requirements file), `scripts/build_index.py:28` and `scripts/paper-collector.py:13-16` (the existing `# noqa: E402` markers)
- **Intent:** The Python side has zero static analysis — no linter, no type checker, no formatter check — while the web side runs `tsc --noEmit`. The `# noqa: E402` markers imply an authorial flake8/ruff intent that was never wired up.
- **Acceptance criteria:**
  1. `ruff check scripts tests` runs clean, and `ruff` is invoked as a step in `.github/workflows/ci.yml` alongside the existing `unittest` step.
  2. The existing `# noqa: E402` markers are honored rather than deleted, and `ruff check` reports 0 errors.
  3. No behavior change: the 27+ Python tests still pass, and `ruff` is installed from a declared dev-requirements file, not from an ambient global.
- **Verification method:** `python3 -m venv /tmp/rpf-ruff && /tmp/rpf-ruff/bin/pip install ruff && /tmp/rpf-ruff/bin/ruff check scripts tests` → "All checks passed!"; then `cat -n .github/workflows/ci.yml` and confirm the new step's install line references a file that is committed in the same change. Use a scratch venv, not `/tmp/rpf-venv`, so the shared environment every other item's verification depends on is untouched.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-085
- **Priority score:** 15.0
- **Notes:** Dependency cost, as required by the profile: `ruff` is a single dev-only wheel, installed only in CI and by contributors — it never ships to Pages and never enters the deploy path (`deploy.yml:31` installs only `requirements.txt`). Risk `med` because a fresh linter will report new findings; if it does, either fix them in the same change or scope the rule set explicitly in `[tool.ruff]` and say why. Do **not** add a formatter (black/ruff-format) check — there is no formatter today and a reformat produces a diff no tool has validated.

### IMP-087 — Add `.github/dependabot.yml`
- **Status:** TODO
- **Category:** Packaging & installation
- **Type:** tooling
- **Area / files:** `.github/dependabot.yml` (does not exist), `web/package-lock.json` (5 open advisories), `requirements.txt`
- **Intent:** Five open npm advisories (1 critical in `vitest`, 1 high in `vite`, 3 moderate) and seven outdated packages have been sitting undetected, with no automation that would ever look. A single missing file would have surfaced the critical advisory.
- **Acceptance criteria:**
  1. `.github/dependabot.yml` configures the `npm` ecosystem with `directory: /web` and the `pip` ecosystem with `directory: /`, on a weekly schedule.
  2. The file is valid YAML and names no nonexistent directory.
  3. No dependency version is changed by this item.
- **Verification method:** `/usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/dependabot.yml')); print([e['package-ecosystem'] for e in d['updates']])"` must print `['npm', 'pip']` (PyYAML is not installed here — install it into a scratch venv if you want a machine check, otherwise read the indentation by hand); then confirm `git status --porcelain` lists only `.github/dependabot.yml`, i.e. `web/package-lock.json` and `requirements.txt` are untouched.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Every one of the seven outdated packages (PE-2) is a breaking-major bump, so the PRs this generates must not be batched. Add `groups` only if that makes it clearer; the per-ecosystem default already opens separate PRs. This item adds automation only — it does not touch a version.

### IMP-088 — Add an `npm audit` gate to CI
- **Status:** NEEDS-HUMAN
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:33-38` (`web-tests` job), `web/package.json` (no `audit` script)
- **Intent:** The critical `vitest` advisory (GHSA-5xrq-8626-4rwp, arbitrary file read/execute in the Vitest UI server) has been open for an unknown period with no CI signal. `npm audit` is not run anywhere.
- **Acceptance criteria:**
  1. A CI step runs `npm audit --audit-level=high` in `web/` and fails the job on any high or critical advisory.
  2. Because the five current advisories are baseline, the step is introduced in a state that passes: either with a documented, time-boxed audit exception, or in the same change as the upgrades that clear them — the choice must be stated in the PR body.
  3. The runtime dependency set is unchanged (`react` + `react-dom` only); all five advisories are dev-server/test-runner transitive packages.
- **Verification method:** `cd web && npm audit` and record the current 5-advisory baseline; `cd web && npm audit --audit-level=high` and record the exit code; then `cat -n .github/workflows/ci.yml` to confirm the step exists in the `web-tests` job.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because introducing a failing gate on a branch that is already red provides no protection. Bump `vitest` and `vite` as separate PRs, one major each, and re-run the full web gate after each.
**NEEDS-HUMAN — policy decision required.** Criterion 2 is self-defeating as written: the five advisories are the baseline (PE-1), so an `npm audit --audit-level=high` step fails on day one and guards nothing, while carving out a time-boxed exception to a security gate is an org policy call. Clearing the gate properly needs a breaking-major bump of `vitest` and `vite` (PE-2: every major here is breaking), which is a separate, riskier change.

### IMP-089 — Add `permissions`, `concurrency`, and `timeout-minutes` to `ci.yml`
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml` (whole file — no `permissions:`, no `concurrency:`, no `timeout-minutes:`, no `path:` filters)
- **Intent:** `GITHUB_TOKEN` inherits the repository default, which may be read/write, while CI only needs `contents: read`. There is no concurrency group, so superseded PR pushes keep burning minutes. And there is no `timeout-minutes`, so a hung job runs to the 6-hour default — which matters because there is no network timeout in the Python path either.
- **Acceptance criteria:**
  1. A top-level `permissions: contents: read` is present.
  2. A `concurrency` group keyed on the workflow and ref with `cancel-in-progress: true` is present.
  3. Both jobs declare a `timeout-minutes` value that is comfortably above the observed job duration (currently a few seconds for tests) and far below 360.
  4. No behavior change to the test commands themselves.
- **Verification method:** `cat -n .github/workflows/ci.yml` and confirm the three keys; then `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and `cd web && npm run typecheck && npm test` both still pass locally, matching what the workflow runs.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** The profile confirms secret handling in this repo is already correct — no `secrets.*`, no PR-string interpolation into `run:`, and `pull_request` rather than `pull_request_target`. Do not change any of that; this item is only about the three missing keys.

### IMP-090 — Extend `.gitignore`
- **Status:** TODO
- **Category:** Tooling, linting, formatting
- **Type:** tooling
- **Area / files:** `.gitignore` (covers `__pycache__/`, `*.pyc`, `results/*.html`, `results/*.csv`, `web/node_modules/`, `web/dist/`, `web/public/data/`, `.DS_Store`, `*.ipynb_checkpoints`), `requirements.txt` instructions at `readme.md:37-40` and `CONTRIBUTING.md:8`
- **Intent:** Following the readme's own instructions (`python3 -m venv .venv`) dirties `git status`, and so does running `pytest`. The CLI's download outputs (`extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv` in CWD) are likewise untracked-and-unignored, so a documented `--download-sources` run litters the repo root.
- **Acceptance criteria:**
  1. `.gitignore` adds `.venv/`, `venv/`, `env/`, `.pytest_cache/`, `.ruff_cache/`, `.mypy_cache/`, `.coverage`, `htmlcov/`, `extracted/`, `*.pdf`, `*.tar.gz`, `*_papers.csv`, `.vscode/`, `.idea/`, `*.log`, and `!results/.gitkeep` at `.gitignore:7` stays effective.
  2. After `python3 -m venv .venv` in the repo root, `git status --porcelain` is empty.
  3. No already-tracked file becomes ignored — `git ls-files` output is unchanged.
- **Verification method:** `python3 -m venv .venv && git status --porcelain` → empty; `mkdir -p extracted && touch extracted/x.pdf foo_papers.csv && git status --porcelain` → empty; then `git check-ignore -v .venv extracted/x.pdf foo_papers.csv` names the new rules; finally `git ls-files | wc -l` is unchanged (38 at baseline `1c075b3`, verified by execution). Remove the scratch `.venv/`, `extracted/`, and `foo_papers.csv` afterwards.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** `*_papers.csv` must not accidentally match anything tracked; verify with `git check-ignore` before committing.

### IMP-091 — Document the manifest and shard JSON schema in `readme.md`
- **Status:** TODO
- **Category:** Documentation
- **Type:** docs
- **Area / files:** `readme.md:42-44` (build_index flags, no schema), `scripts/build_index.py:97-114` (`record_from_result`, the only producer of the wire format), `web/src/lib/types.ts:1-36` (the hand-maintained mirror), `scripts/build_index.py:179-190` (the manifest)
- **Intent:** The Python→TypeScript wire contract is hand-mirrored and completely undocumented outside source docstrings. There is no JSON Schema, no committed sample, and `web/public/data/` is gitignored, so the only concrete instances of either format live in test fixtures. A reader cannot author a compatible tool, and a field rename fails silently in the browser.
- **Acceptance criteria:**
  1. `readme.md` documents the `index.json` manifest shape and the `papers-<YYYY>-W<NN>.json` shard shape, including every field of the 11-field `Paper` record, with a short worked example of each.
  2. The documented field list matches `web/src/lib/types.ts:1-13` and `scripts/build_index.py:102-114` field for field, in the same order.
  3. The section states that the data directory is gitignored and must be generated locally.
- **Verification method:** `cat -n readme.md` and diff the documented field list against `web/src/lib/types.ts:1-13` line by line; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-doc` and confirm the example matches the real output byte-for-byte in shape.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** The example must be a real captured output, not hand-written, or it will drift. The mirror test that locks the two sides together is IMP-094.

### IMP-092 — Flip the save dropdown when it would overflow the viewport
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/components/PaperCard.tsx:111-167` (the `<details>` disclosure), `web/src/styles.css:488` (`.save-menu__body`, absolutely positioned, opens downward)
- **Intent:** `.save-menu__body` always opens downward with no flip and no collision handling, so on the last visible cards the "Create & save" button is cut off at the fold. Recon observed this at 1280×900 and at 390×844.
- **Acceptance criteria:**
  1. The panel opens upward when the downward position would extend past the viewport bottom, and the choice is made per-open rather than once at mount.
  2. "Create & save" is fully visible and clickable on the last card of the feed at both 1280px and 390px.
  3. No inline `style` prop is introduced; the flip is expressed with a class or a data attribute in `web/src/styles.css`.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then `npm run preview -- --port 5199 --strictPort`, load enough papers that "Load more" has been clicked twice, open the save menu on the last card at 1280px and at 390px, and screenshot to `.improve/artifacts/IMP-092/feed-savemenu-flip-desktop-1280.png` and `.improve/artifacts/IMP-092/feed-savemenu-flip-mobile-390.png`, compared against `.improve/artifacts/baseline/baseline-feed-savemenu-open-desktop-1280.png` and `.improve/artifacts/baseline/baseline-feed-savemenu-mobile-390.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because measuring the panel requires a layout read (e.g. `getBoundingClientRect`) inside a component that currently has no DOM measurement; confirm it does not cause a layout thrash on scroll, and that the existing 390px `.save-menu__body { right: auto; left: 0 }` rule at `web/src/styles.css:749-752` still applies.

### IMP-152 — Emit `https://` arXiv `absUrl` values from the index builder
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:111-113` (`"absUrl": getattr(result, "entry_id", None)`, taken verbatim), `tests/test_paper_collector.py` (the shard-writing assertions), `web/src/lib/collections.ts:68-70` (`isHttpUrl`, which accepts `http://` as well as `https://`)
- **Intent:** `arxiv.Result.entry_id` is the arXiv API's canonical identifier and it comes back as `http://arxiv.org/abs/<id>v1`, so `absUrl` is plaintext on every card while `pdfUrl` (from `pdf_url`) is already `https://`. Counting the committed shards shows all 2,812 papers carry an `http` `absUrl` and all 50 visible cards in the running app link over `http://arxiv.org/abs/…`. Every outbound paper link is therefore a silent TLS downgrade — no certificate, no HSTS, no integrity guarantee — and the inconsistency with `pdfUrl` reads as a bug to anyone reading a shard. Recorded as D-1 by IMP-001's implementer, who correctly declined to widen that item's spec, which mandates accepting both schemes.
- **Acceptance criteria:**
  1. `scripts/build_index.py` normalizes `absUrl` to `https://` before the value is written into a shard record — by rewriting a leading `http://` on `entry_id`, not by hand-assembling an arXiv URL, so an absent or `None` `entry_id` still yields `"absUrl": null` and no shard record gains a fabricated url.
  2. `isHttpUrl` in `web/src/lib/collections.ts` keeps accepting both schemes, so the 2,812 already-imported collections that hold `http://` `absUrl` values do not silently lose their paper links.
  3. A test in `tests/test_paper_collector.py` asserts a fake result whose `entry_id` is `http://arxiv.org/abs/2401.00001v1` produces a shard record with `"absUrl": "https://arxiv.org/abs/2401.00001v1"`, and a second case whose `entry_id` is `None` produces `"absUrl": null`. Both use fakes — no network.
  4. `/usr/local/bin/python3.11 -m unittest discover -s tests` and `cd web && npm run typecheck && npm test` pass.
- **Verification method:** `/usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-httpscheck`, then `grep -c '"absUrl": "http://'` on the shard must be `0` and `grep -c '"absUrl": "https://'` must equal the paper count; save the shard to `.improve/artifacts/IMP-152/`. If the repo regenerates the committed shards on deploy rather than by hand, regenerate them here and confirm in the browser that the first card's title `href` begins `https://arxiv.org/abs/` — screenshot to `.improve/artifacts/IMP-152/feed-https-absurl-desktop-1280.png` against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`, which must be visually unchanged.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Overlaps IMP-019, whose `Area / files` names `scripts/build_index.py:111-113` for the *nullability* of `absUrl`/`pdfUrl`/`primaryCategory`; the two changes are compatible but edit the same three lines, so land them together or state the ordering in the PR body. Impact is scored 3 rather than 5 because an `http` destination is a downgrade warning, not an injection — the page still renders and the visitor still reaches arXiv. Criterion 2 is load-bearing: tightening `isHttpUrl` to https-only before the shards are rebuilt would delete the link from all 50 live cards, which is exactly the trap IMP-001 documented.

---

### IMP-155 — Cover `isHttpUrl`'s whitespace/tab-obfuscated `javascript:` rejections
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/lib/collections.ts:86-88` (`isHttpUrl`, exported), `web/src/lib/__tests__/collections.test.ts:266-267` (the existing bare-`javascript:` assertions), `web/src/components/PaperCard.tsx:33-35` (`safeHref`)
- **Intent:** The repository's only coverage of the IMP-001 security property tests the bare string `"javascript:alert(1)"`. The variants that are *actually executable* are untested: real Chromium strips leading C0 controls and space and removes embedded tab/LF, so `" javascript:alert(1)"`, `"\t\n javascript:alert(1)"` and `"java\tscript:alert(1)"` all resolve to protocol `javascript:` on a live anchor. `isHttpUrl` rejects all of them today — but only because the regex is anchored at `^` **after** `.trim()`, and browser URL parsing only ever removes U+0009/U+000A/U+000D, none of which appear in the literal `https`. Deleting that one `.trim()` re-opens the hole and every existing test still passes. This is a coverage gap, not a live defect.
- **Acceptance criteria:**
  1. `web/src/lib/__tests__/collections.test.ts` asserts `isHttpUrl` is `false` for, at minimum: `" javascript:alert(1)"`, `"\t\n javascript:alert(1)"`, `"java\tscript:alert(1)"`, `"JAVASCRIPT:alert(1)"`, and `"data:text/html,<script>x</script>"`, `"vbscript:msgbox(1)"`, `"file:///etc/passwd"`, `"blob:https://x/y"`, `"//evil.example"`, `"httpsx://ok"` — asserted on the exported predicate directly, since that is what makes the mutation detectable.
  2. `isHttpUrl` remains `true` for `"https://ok.example"`, `"HTTP://ARXIV.ORG/ABS/1"`, `"\thttps://ok.example"`, `"http://"` and `"http://arxiv.org/abs/2401.00001"`. The last one is load-bearing: `scripts/build_index.py:111` emits `http://` for every live card, so an https-only assertion would be a false failure.
  3. The full import **and render** path is asserted end to end for at least one whitespace-obfuscated payload: `parseExportPayload` drops the paper, and rendering a `PaperCard` built from the surviving state yields `[...document.querySelectorAll("a")].every(a => !a.getAttribute("href")?.startsWith("javascript:"))` as `true`.
  4. Deleting `.trim()` from `web/src/lib/collections.ts:87` makes at least one of the new assertions fail. Prove this in a `/tmp` copy — do not leave the repo broken — and record the exact failure count in the PR body.
  5. `cd web && npm run typecheck && npm test` pass with no pre-existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then the `/tmp` revert described in criterion 4, confirming the suite goes red; then in the browser import a payload carrying `"absUrl": " javascript:alert(1)"` and confirm zero `javascript:` hrefs and an empty console.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Impact is scored 3, not 5, because nothing is currently broken — this buys *detection* of a regression rather than a fix, and its whole value is criterion 4. Do not fold this into IMP-152 (emit `https://`): that item must leave `isHttpUrl` accepting both schemes, and these tests are what pin the `http` half of that promise. The `null`/`undefined` exemption is already covered by IMP-151b's four tests (`7a2ed82`) and is not duplicated here. OBS-E in `.improve/reports/verify-IMP-151b.md`.

### IMP-156 — Cover `urlState`'s default `hash` argument and its default location writer
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/lib/urlState.ts:16` (`readHash(hash: string = window.location.hash)`), `web/src/lib/urlState.ts:41-47` (`writeToLocation`, the default `HashWriter`), `web/src/lib/urlState.ts:55-59` (`writeHash(…, write = writeToLocation)`), `web/src/App.tsx:64,69,76` (the production call sites that rely on both defaults), `web/src/lib/__tests__/urlState.test.ts`
- **Intent:** All 18 tests in `urlState.test.ts` pass an explicit hash string and an injected writer, so the only code in the module that still touches `window` has zero coverage. Two independent mutations survive the whole suite: replacing the `= window.location.hash` default with `= ""` (M1), and replacing the default writer with a no-op (M7). `App.tsx:64` and `:76` call `readHash()` with no argument and `:69` calls `writeHash(next, mode)` with two — the exact 2-arg shape that appears nowhere in the test file. A future edit that breaks push/replace wiring would be caught by neither the typechecker nor the suite. Since IMP-005 landed (`894fb9b`) there is now a jsdom environment available to close this cheaply.
- **Acceptance criteria:**
  1. A test sets `window.location.hash` and calls `readHash()` with **no** argument, asserting it parsed the live hash; the same case must fail if the `= window.location.hash` default is changed to `= ""`.
  2. A test calls `writeHash(state, "push")` with **no** writer and asserts `window.location.hash` equals the returned `hash`; and calls `writeHash(state, "replace")` with no writer and asserts `window.location.hash` changed while `history.length` is unchanged. Both must fail if the default writer becomes a no-op.
  3. The 2-argument `writeHash(readHash(h), "replace")` form named in IMP-143's criterion 2 appears in the test file — the verifier recorded that it currently appears nowhere.
  4. `urlState.test.ts` keeps its `// @vitest-environment node` docblock for the existing 18 tests; the new cases go in a sibling file (e.g. `web/src/lib/__tests__/urlStateWindow.test.ts`) or a `describe` block that opts into jsdom, so the "no jsdom required" property IMP-143 criterion 3 asked for is not lost.
  5. Each of the two mutations in criteria 1 and 2 is demonstrated to turn the suite red, in a `/tmp` copy, and the exact failed-test count is recorded in the PR body.
  6. `cd web && npm run typecheck && npm test && npm run build` pass; the test count rises from 69 and the module count from 39 only if new runtime code is added, which this item must not do.
- **Verification method:** `cd web && npm run typecheck && npm test`; then the two `/tmp` mutation runs from criteria 1, 2 and 5; then at 1280px in the browser, type a query, click Collections, reload, and confirm the hash round-trips exactly as before (IMP-143's own browser check). Screenshot to `.improve/artifacts/IMP-156/feed-desktop-1280.png` — must be MD5-identical to `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Test-only, so effort is `S` and the bundle must not grow. The two mutations are M1 and M7 in `.improve/reports/verify-IMP-143.md` §8; the implementer disclosed M7 at `impl-IMP-143.md:135-139` and recommended exactly this follow-up. Not a defect and not attributable to IMP-143: IMP-143's criterion 3 only required that `writeHash` be *testable* without a window, which it is. This is the first test item that genuinely needs the jsdom environment IMP-005 added, so it is the cheapest proof that IMP-005 paid for itself. Also see profile WEB-37's "not yet closed" note.

### IMP-157 — Make `applyState` immune to React 18 batching
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:67-73` (`applyState`, a `useCallback` that computes from the render-captured `urlState` and commits with non-functional `setUrlState`), `web/src/App.tsx:183,187,191,195,203` (`setView` / `setQuery` / `setRecency` / `setSort` / `toggleCategory`, all built on it), `web/src/lib/urlState.ts:55-79` (`writeHash`, called eagerly with the same stale base)
- **Intent:** `applyState` reads `urlState` — the value captured in the current render — and commits `setUrlState(next)` non-functionally. Under React 18 automatic batching, two calls dispatched inside one task both read the *same* stale `urlState`, so the second silently discards the first. `writeHash` is called eagerly with the fresh object, so the address bar is briefly correct and then gets rewritten: the **hash** ends up wrong too, not just React state. Reproduced with four dispatches in one `page.evaluate` — `setQuery('diffusion'); toggleCategory(cs.RO); setRecency(30); setSort('relevance'); setView('collections')` settled on `#view=collections&q=diffusion`, losing `cat`, `recency` and `sort` entirely. The same four actions in four separate ticks produce correct cumulative hashes. Latent today because every control is a separate DOM click handler, but it is a one-line fix and it is a forward hazard for exactly the items that add bulk controls or keyboard shortcuts.
- **Acceptance criteria:**
  1. `applyState` derives the next state functionally — `setUrlState((current) => ({ ...current, ...patch }))` — and derives the hash from that same patch rather than from a second, independently-computed object, so the URL and the state cannot diverge.
  2. Two `applyState` calls dispatched in a single JS task compose: dispatching `setQuery("diffusion")` and `setRecency(30)` in one task settles on a hash containing **both** `q=diffusion` and `recency=30`, with `cat` intact.
  3. The push/replace split is unchanged: `setView` still passes `"push"` and every filter setter still passes `"replace"`, so Back behaviour is identical to the baseline. `web/src/lib/urlState.ts` is not modified — `HashState` does not change shape.
  4. A test drives the reducer/setter path with two same-task updates and asserts the composed result. Because `applyState` lives in `App.tsx`, this is either a component test under `web/src/__tests__/` (IMP-037's file, which gates it) or an extraction of the pure merge — if you extract, name the function and keep it in `App.tsx` unless the PR body argues for `urlState.ts`.
  5. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in the browser at 1280px, run `["setQuery","toggleCategory","setRecency","setSort"].forEach(fn => window.__dispatch(fn))` — or whatever hook the test exposes — inside **one** `page.evaluate`, and confirm the settled hash contains every field that was set. Then click through the same four changes as four real user clicks and confirm the hash is identical either way. Screenshot to `.improve/artifacts/IMP-157/feed-desktop-1280.png` against the baseline.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` because switching to a functional update changes *when* `writeHash` is called, and the push/replace split is load-bearing for Back (profile WEB-34) — criterion 3 exists so a verifier checks that rather than assuming it. **Pre-existing, not a regression:** `applyState` and every setter built on it are byte-identical to `fc77a40` (verified by content hash), and IMP-143 only moved `readHash`/`writeHash` out of `App.tsx` while ignoring the new `{ hash }` return value at the call site. Do not credit this to IMP-143. Second prerequisite alongside IMP-143 for IMP-008, IMP-132 and IMP-133 — those add keyboard shortcuts and bulk actions, which are exactly the shapes that trip it. D-1 in `.improve/reports/discovered-IMP-143.md`, independently reproduced in `.improve/reports/verify-IMP-143.md` §7, whose verdict was that it must not block IMP-143 but "should be filed as its own backlog item".

## Tier 12.5

### IMP-006 — Make the two `localStorage` writes crash-consistent
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:279-292` (`saveState`, writing `COLLECTIONS_KEY` at `:287` then `PAPERS_KEY` at `:288`), `web/src/App.tsx:231-235` (the save effect), `web/src/lib/collections.ts:265-271` (`loadState`, whose `.filter((id) => id in papers)` at `:268` drops paperIds with no snapshot)
- **Intent:** `saveState` writes the collection list first and the paper snapshots second. If the second write throws — a full 5 MB quota is the realistic case, since full paper objects including abstracts are persisted — the collections list has already been replaced, so on reload every `paperId` referencing a snapshot that was never written is silently dropped at `loadState:268`. The user's collections come back empty with no error. This is the worst data-loss path in the app. (Re-scored from 25.0 to 12.5 during critique: effort is `M`, and `5 × 5 ÷ 2 = 12.5` is the arithmetic ceiling for any `M` item.)
- **Acceptance criteria:**
  1. One `setItem` failure cannot leave the persisted pair inconsistent. Concretely: either a single combined key holds both documents, or `PAPERS_KEY` is written **before** `COLLECTIONS_KEY` and the test below proves the surviving state is still readable.
  2. A failure surfaces to the user as a `role="alert"` banner instead of being swallowed by `saveState`'s bare `catch` at `collections.ts:290-292` (that reporting change is IMP-011; this item may implement it or depend on it, but the test here must pass either way).
  3. A new test in `web/src/lib/__tests__/collections.test.ts` uses a `Storage` fake whose second `setItem` throws, then calls `loadState` on the same fake and asserts the previously saved collection is still present **with** its paper ids — not an empty collections list.
  4. If a new key name is introduced, `loadState` reads the new key and falls back to the legacy pair when the new key is absent, so an existing reader's `localStorage` is not discarded.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in the browser save ≥ 3 papers into one collection, replace `Storage.prototype.setItem` with a wrapper that throws on the `PAPERS_KEY` (or combined-key) call, toggle a fourth save, reload, and confirm the first three papers are still listed in the collection rather than the collection rendering empty. Screenshot to `.improve/artifacts/IMP-006/collections-storage-failure-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-collections-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.5
- **Notes:** Risk `med` because the fix changes the persistence format or write order, so a migrating reader is required for anyone whose `localStorage` predates the change — criterion 4 makes that explicit. Related growth path, deliberately **not** bundled here: full snapshots with abstracts mean the 5 MB quota is reachable after roughly 2–2.5k saved papers, so a size cap is a reasonable companion item.

### IMP-093 — Repair `--download-pdfs` and `--download-sources` on arxiv 4.x
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:74-79` (`result.download_pdf` / `result.download_source` calls), `scripts/paper-collector.py:80-81` (the `except` tuple), `readme.md:101-102` (both flags documented as supported)
- **Intent:** arxiv 4 removed `Result.download_pdf` and `Result.download_source`, so `--download-pdfs` and `--download-sources` raise `AttributeError` on the very first result. The `except` at `:80` catches only `(arxiv.ArxivError, OSError, tarfile.TarError)`, so the error escapes and aborts the whole run. Two documented flags are broken in CI and on any fresh resolve and no test exercises the path. Verified nuance: the interpreter provisioned here has **arxiv 2.1.3**, where both methods still exist, so the crash does *not* reproduce locally — but `requirements.txt:1` is `arxiv>=2.1.0` with no upper bound, and a fresh resolve today yields 4.x, which is exactly what CI installs.
- **Acceptance criteria:**
  1. Both flags work against the installed `arxiv`, however it provides the URLs: prefer `result.pdf_url` for the PDF and derive the source archive from `result.entry_id` (replace the `/abs/` segment with `/e-print/`), falling back to a `result.source_url` attribute or method only if the installed arxiv exposes one — do not assume `source_url()` exists, it does not in 2.1.3. A per-paper failure logs a warning and continues instead of aborting the run.
  2. The `except` at `:80` is widened so no unexpected exception from an optional download can abort the run, while genuine `tarfile` errors are still reported distinctly.
  3. New tests in `tests/test_paper_collector.py` cover: a result exposing `pdf_url` and `entry_id` (success), a result whose download raises (warning, no abort), and a result missing both (warning, no abort). All three use fakes — no network.
  4. `readme.md:101-102` still documents both flags with the same names and defaults.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then in a **throwaway** venv so the shared `/tmp/rpf-venv` used by every other item's verification is not left on arxiv 4: `python3 -m venv /tmp/rpf-arxiv4 && /tmp/rpf-arxiv4/bin/pip install "arxiv>=4" pandas && /tmp/rpf-arxiv4/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --output-dir /tmp/rpf-dl --download-pdfs --download-sources`; confirm exit 0, that `ls -R /tmp/rpf-dl` contains a `.pdf` and an extracted directory and no leftover `.tar.gz`, and confirm the same command against the pre-change code fails on arxiv 4 with `AttributeError`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.5
- **Notes:** Risk `med` because this introduces direct HTTP downloading in place of the library's helpers, which is a new failure surface (timeouts, redirects, content types). No new dependency is introduced — use `urllib.request` from the standard library, or `requests` which `arxiv` already depends on; say which in the PR body. The arXiv download URL path must carry the same terms-of-use delay as the client (`scripts/arxiv_common.py:16`); do not add a bare hammer loop. Pairs with IMP-033 (upper bound on `arxiv`), which changes which versions this item must support — do not batch them into one PR.

### IMP-094 — Add a Python→TypeScript wire-contract test
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py` (add a contract test), `web/src/lib/__tests__/paperIndex.test.ts` (add a fixture-driven case), `scripts/build_index.py:97-114` (`record_from_result`), `web/src/lib/types.ts:1-36`
- **Intent:** The wire format is hand-mirrored and completely unvalidated: `record_from_result` is the only producer, `web/src/lib/types.ts` is a hand-maintained copy, `fetchManifest` does a bare `as IndexManifest` cast (`web/src/lib/paperIndex.ts:91`), and `loadShard` only checks `Array.isArray(data.papers)`. Renaming a field in Python fails silently and a missing `abstract` throws inside render, blanking the app. No test on either side asserts the contract.
- **Acceptance criteria:**
  1. A committed fixture pair — a real `index.json` and a real `papers-<YYYY>-W<NN>.json` produced by `write_index` — is committed under `web/src/lib/__tests__/fixtures/` (not `tests/`, which is outside the `web/` package and cannot be imported by vitest, and not the gitignored `web/public/data/`). A test in `web/src/lib/__tests__/paperIndex.test.ts` reads it with `node:fs` — legal because Vitest executes on Node in every test environment and only swaps globals; since IMP-005 (`894fb9b`) the global environment is `jsdom`, so either add a `// @vitest-environment node` docblock (the pattern `urlState.test.ts:1` uses) or state that `node:fs` needs no special environment — stubs `fetch` to serve the fixture, and drives `PaperIndex.loadPapers`.
  2. A test in `tests/test_build_index.py` asserts `sorted(record_from_result(fake_result).keys())` equals a literal 11-name list, so a Python-side rename or addition fails in Python CI.
  3. The TS fixture test fails if the fixture's paper is missing any field declared in `web/src/lib/types.ts:1-13`, checked by an explicit key assertion rather than a cast.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and `cd web && npm run typecheck && npm test`; then deliberately rename `absUrl` to `abs_url` in `scripts/build_index.py:112` and confirm the Python test fails, revert, and confirm both suites pass.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.5
- **Notes:** Risk `med` because committing a fixture under `tests/fixtures/` adds a new tracked path and a hand-maintained copy of the schema can itself drift; the point is that the *Python* test regenerates the truth and the *TS* test consumes the committed copy, so a divergence shows up as a failing key assertion rather than as a browser blank page. The fixture must be a real captured output, not hand-written.

## Tier 12.0


### IMP-146 — Revoke the export blob URL after the download has started
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:295-306` (`handleExport`: `anchor.click()` at `:303`, `anchor.remove()` at `:304`, `URL.revokeObjectURL(objectUrl)` at `:305`)
- **Intent:** `URL.revokeObjectURL` is called synchronously immediately after `click()`. In Firefox the download can lose the race against the revoke and the user's collection export silently produces **no file** — a silent data-loss path on a documented feature. The same block also leaves `objectUrl` unreleased if `anchor.click()` throws, and the anchor is appended to the DOM without a `try/finally`.
- **Acceptance criteria:**
  1. `revokeObjectURL` is not called in the same synchronous turn as `click()`: the revoke is deferred (for example inside a `setTimeout(…, 0)`, or after `anchor` removal plus a microtask) so the download has begun first. The exact mechanism must be stated in the PR body.
  2. The revoke happens unconditionally: the block is wrapped so that a throw from `click()` still removes the anchor and revokes the URL.
  3. The downloaded filename (`slugifyFilename(payload.collection.name) + ".json"`) and the blob's `type: "application/json"` are unchanged, so the export file is byte-identical to the baseline.
  4. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then in Firefox and Chromium, export a non-empty collection from `#view=collections` and confirm a file actually lands in the downloads directory with the expected name, then open it and confirm it parses as the `ExportPayload` shape. Repeat after a save-failure reload. Browser console must show no `console.error`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** The failure is engine- and timing-dependent, so it will not reproduce reliably in CI; criterion 3 (unchanged filename and payload) is the checkable part a verifier can rely on, and criterion 1's "no synchronous revoke" is grep-checkable via `grep -n "revokeObjectURL" web/src/App.tsx`.

### IMP-095 — Cap `UNLIMITED` under arXiv's 30,000-result ceiling
- **Status:** TODO
- **Category:** Configuration & defaults
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:38` (`UNLIMITED = 100000`), `scripts/arxiv_common.py:41-49` (`arxiv.Search(max_results=...)`)
- **Intent:** `UNLIMITED` exceeds arXiv's 30,000-result `start` ceiling. Today the retention `break` stops long before that, but if it ever stopped working `arxiv` would raise `HTTPError` after retries and `iter_results` would silently truncate the index.
- **Acceptance criteria:**
  1. `UNLIMITED` is at or below 30,000, or `iter_results` clamps `max_results` to that ceiling and logs when it clamps.
  2. A test in `tests/test_arxiv_common.py` asserts the value passed to `arxiv.Search` never exceeds 30,000, including for `max_results=None`.
  3. `scripts/build_index.py:208`'s mapping from `max_per_category` to `UNLIMITED` is unchanged in behavior for the default `--max-per-category 0`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `grep -n "UNLIMITED" scripts/build_index.py` and confirm the value, and `grep -n "30000\|30_000" scripts/arxiv_common.py` shows the clamp.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Keep this consistent with IMP-020, which removes the ordered-`break` dependency that currently keeps the run well under the ceiling.

### IMP-096 — Add a 404 page and a `robots.txt` for the Pages site
- **Status:** NEEDS-HUMAN
- **Category:** Missing features natural to this repo's purpose
- **Type:** new-feature
- **Area / files:** `web/index.html:1-23` (the only HTML entry), `web/vite.config.ts:4-11` (no multi-page input), `readme.md:9` (the live URL)
- **Intent:** The deployed Pages site has no `404.html`, so any mistyped deep link or stale shard URL under `/research-paper-feed/` returns GitHub's generic 404 with no way back to the feed. There is also no `robots.txt`.
- **Acceptance criteria:**
  1. A `404.html` is emitted into `web/dist/` whose only in-app link is the absolute base path `/research-paper-feed/` (matching `vite.config.ts:5`), renders without a build step (plain HTML, or a copy of `web/index.html` with different copy), and is **not** gitignored (`web/.gitignore` ignores only `node_modules`, `dist`, `dist-ssr`, `public/data`, `*.local`, `.DS_Store`).
  2. A `robots.txt` is emitted that allows crawling and points at the live URL, or that disallows all and states the site is a personal tool — the choice must be recorded.
  3. `cd web && npm run build` places both files in `web/dist/`, and neither is gitignored.
- **Verification method:** `cd web && npm run build && ls web/dist` shows `404.html` and `robots.txt`; then `npm run preview -- --port 5199 --strictPort` and request `http://localhost:5199/research-paper-feed/nope` — note that Vite's SPA fallback will serve the app, so verify the file's presence in `dist` rather than the preview response, and state that caveat in the PR.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Risk `med` because Vite's single-page build does not emit a `404.html` on its own, so this needs either a tiny Vite plugin, a `public/` copy, or a post-build copy step — pick one and say which. Note that GitHub Pages serves `404.html` only for not-found paths, and the SPA fallback in the profile's deploy health check means an HTTP probe cannot confirm it.
**NEEDS-HUMAN — decision required.** Criterion 2 explicitly asks the implementer to choose between a crawlable `robots.txt` and a `disallow: /` personal-tool stance. That is a publishing decision for the site owner. The `404.html` half (criterion 1) does not depend on it and can be split out and started immediately.

### IMP-097 — Add a Python version matrix to CI
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:9-19` (`python-tests` job, `python-version: "3.x"`)
- **Intent:** CI runs a single floating interpreter, so a Python release that breaks the suite is discovered only after it becomes the default, and the repo never verifies the versions contributors actually use.
- **Acceptance criteria:**
  1. `python-tests` runs a matrix of at least two explicit minor versions, with no floating `"3.x"`.
  2. All matrix legs pass and the job's aggregate result is green.
  3. Every version in the matrix installs `requirements.txt` and runs `python -m unittest discover -s tests -v`, and the PR body records the resolved `arxiv` and `pandas` versions for each leg (they will differ, since neither requirement has an upper bound — that is INF-06).
- **Verification method:** `cat -n .github/workflows/ci.yml` and confirm no `python-version` value is a floating `"3.x"`. Locally only one interpreter has the dependencies (`/usr/local/bin/python3.11`, arxiv 2.1.3 / pandas 2.2.1), so per-version proof comes from the matrix job itself; `/opt/homebrew/bin/python3` (3.14.3) will fail with `ModuleNotFoundError` unless a venv is used — that failure is environmental, not a regression.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Risk `med` because pinning reveals version-specific failures (the pandas chained-indexing deprecation and `tarfile.extractall` filtering both differ by version). Add one version at a time and fix what surfaces rather than adding the matrix and the fixes in the same PR.

### IMP-153 — Scrub non-`http(s)` urls already persisted in `localStorage` on load
- **Status:** TODO
- **Category:** Data validation
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:255-291` (`loadState`, whose per-snapshot guard at `:274` calls `isPaper` alone), `web/src/lib/collections.ts:72-77` (`hasSafeUrls`, the import-time filter added by IMP-001), `web/src/components/PaperCard.tsx:33-35` (`safeHref`, the render-time guard)
- **Intent:** IMP-001 filters hostile urls at `parseExportPayload` only. A paper imported before that fix is still in `localStorage`, and `loadState` re-validates every snapshot with `isPaper` (`:274`), which never inspects `absUrl`/`pdfUrl` — so a `javascript:` or `data:text/html` url survives every reload indefinitely. IMP-001's `safeHref` makes such values inert *today* (verified: pre-fix snapshots injected straight into `localStorage` render zero anchors), but that render guard is the only thing holding them, and it guards one consumer. The backlog already plans two more readers of `paper.absUrl` — IMP-133's per-paper deep link and IMP-069's "Copy BibTeX" control, whose `buildBibTeX(paper)` embeds `absUrl` in clipboard text — either of which turns a stored hostile value live again with no test failing.
- **Acceptance criteria:**
  1. `loadState` applies the same value filter `parseExportPayload` uses at `collections.ts:232` to every snapshot it reads at `:274`, so a persisted paper whose `absUrl` or `pdfUrl` is present and does not match `isHttpUrl` is never placed into `state.papers`.
  2. That filter is a single named export shared by both call sites rather than a second copy of the regex; `isHttpUrl` itself is unchanged.
  3. Ordering is explicit: the url filter runs while building `papers` (before `:283`), so the `Object.hasOwn` filter that trims `paperIds` afterwards also drops the id of every discarded paper and no collection is left naming a snapshot that is not in `state.papers`.
  4. A new test in `web/src/lib/__tests__/collections.test.ts` drives `loadState` with a `Storage` fake holding two papers — one with `"absUrl": "javascript:alert(1)"`, one with `"absUrl": "https://arxiv.org/abs/2401.00001"` — and asserts the hostile paper is absent from `state.papers`, the valid one is present, and the collection's `paperIds` is exactly `["2401.00001"]`.
  5. A paper persisted with **no** `absUrl` and no `pdfUrl` at all is still loaded, matching IMP-001's "absent urls are kept" rule.
  6. `cd web && npm run typecheck && npm test` passes with no pre-existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then seed `localStorage` directly (bypassing the import path) under `rpf.papers.v1` with a paper whose `absUrl` is `javascript:alert(1)`, hard-reload `http://localhost:5199/research-paper-feed/#view=collections`, and confirm the card list renders with no `TypeError` in the console and no anchor whose `href` starts with `javascript:`. Trigger one save, then assert `JSON.parse(localStorage.getItem("rpf.papers.v1"))` no longer contains that paper. Console stays clean per profile §4.2.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Risk `med` because this *deletes* user-visible saved papers rather than merely deactivating a field — a user who deliberately saved a paper carrying an odd url loses it, so the PR body must state that trade-off instead of presenting the change as a pure win. Recorded as OBS-2 in `.improve/reports/verify-IMP-001.md`, where the verifier confirmed the render guard already renders these inert and explicitly deferred the scrub to a separate item. Independent of IMP-151: that item fixes the own-property membership check, this one filters url *values*, and they touch `loadState` at different lines — so neither needs to wait for the other.

### IMP-158 — Catch `KeyError` from a dangling in-tree hardlink in the source-extraction path
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:181` (`fetch_papers`'s `except` tuple, currently `(arxiv.ArxivError, OSError, tarfile.TarError)`), `scripts/paper-collector.py:78-123` (`extract_source_archive`, the IMP-024 code), `tests/test_paper_collector.py` (the new `ExtractSourceArchiveTests`)
- **Intent:** `TarFile._find_link_target` raises `KeyError: "linkname 'nope.tex' not found"` for a hardlink whose target is not in the archive. `KeyError` is not in the handler's tuple, so **one crafted or malformed archive kills the run for every remaining paper** — the `--download-sources` loop has no per-paper isolation for this case. `data_filter` correctly *allows* an in-tree hardlink, so this is not something IMP-024 introduced; the behaviour is identical before and after that change. It is now additionally reachable via a hardlink whose target the IMP-024 pre-screen rejected, which means the hardened fallback gained one more route to it.
- **Acceptance criteria:**
  1. `fetch_papers` does not abort the run for a hardlink whose target is missing. Either `KeyError` joins the `except` tuple so that paper logs a warning and the loop continues, or hardlink targets are validated against the surviving member set before extraction. Pick one and record it in the PR body; `KeyError` and `EOFError` (a hostile/truncated header raises `struct.error`) must both be survivable.
  2. The guard is **per paper**, not per run: a run that processes 3 papers where the middle archive is hostile still extracts and reports the other two.
  3. A new test in `tests/test_paper_collector.py` builds an archive with `main.tex` plus a hardlink `alt.tex -> nope.tex`, drives it through `extract_source_archive` (or `fetch_papers` with a stubbed client), and asserts the call returns rather than raising, that `main.tex` was extracted, and that one warning naming `alt.tex` was logged. No network.
  4. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes, and the new test runs rather than skipping on the provisioned interpreter.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --output-dir /tmp/rpf-hardlink --download-sources` on a healthy network must still exit 0 — real arXiv archives contain only valid in-tree links, so this is the no-regression check, and the hostile case is proven by criterion 3's unit test rather than by hunting for a real malicious archive.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Confidence is 4, not 5: the behaviour is confirmed by reading CPython's `_find_link_target` and by the IMP-024 verifier's independent reproduction, but no real arXiv archive has ever been observed to trigger it, so reachability from the actual arXiv corpus is theoretical. Impact is 3, not higher, because the flag is a legacy convenience path (`--download-sources`) that the web app does not use. D6 in `.improve/reports/discovered-IMP-024.md`, restated as R4.1 in `.improve/reports/verify-IMP-024-r2.md`, which classed it HIGH for severity and pre-existing. Pairs with IMP-093 (repair both download flags on arxiv 4) — do not batch, but note that IMP-093's criterion 2 already widens that same `except` tuple, so if both land the tuple must not be widened twice inconsistently.

### IMP-159 — Require `loadState`'s storage key to agree with `paper.id`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:288-296` (`loadState`'s `Object.entries(parsedPapers)` loop, which trusts the record key and ignores `paper.id`), `web/src/lib/collections.ts:229-234` (`exportCollection`), `web/src/lib/collections.ts:132-149` (`mergeImport`, which keys by `paper.id`)
- **Intent:** `loadState` writes `papers[id] = paper` using the **storage key** and never checks that `paper.id` agrees. `rpf.papers.v1` holding `{"foo": {"id": "bar", …}}` yields `state.papers.foo` containing a paper whose own `id` is `"bar"`. Three consequences follow: `mergeImport` merges by `paper.id` while `loadState` keys by the storage key, so a paper saved in one session duplicates under two keys in the next; `exportCollection` then emits `papers: [{id: "bar"}]` inside a collection whose `paperIds` say `"foo"`; and re-importing that file **drops the paper**, because `"foo"` has no own snapshot. The user watches a saved paper vanish across one export/import round trip with no error anywhere. Pre-existing and unrelated to prototype keys.
- **Acceptance criteria:**
  1. `loadState` either requires `paper.id === id` or re-keys on `paper.id`. Re-keying is preferred if the round trip is otherwise affected; skipping is acceptable if the paper is instead dropped. Either way, no entry in `state.papers` may have a key different from its `paper.id`.
  2. A paper whose key and `id` disagree is either re-keyed to `id` or dropped — **never** left under a key that references no matching `paper.id` — and the existing `PROTOTYPE_KEYS`/`hasOwnKey` guard at `:299` is preserved unchanged.
  3. A new test in `web/src/lib/__tests__/collections.test.ts` drives `loadState` with a `Storage` fake whose `rpf.papers.v1` is `{"foo": {"id": "bar", "title": "t", "authors": [], "abstract": "a", "categories": ["cs.CV"], "published": "2024-01-01", "primaryCategory": "cs.CV"}, "bar": {…valid…}}` and asserts the resulting `state.papers` contains no key whose value's `id` differs from that key.
  4. A second test round-trips: export the loaded state and re-import the result, asserting the paper count is preserved and the collection's `paperIds` all resolve to own snapshots.
  5. `cd web && npm run typecheck && npm test` passes with no pre-existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then seed `localStorage` under `rpf.papers.v1` with the mismatched payload above plus a collection naming `"foo"`, load `http://localhost:5199/research-paper-feed/#view=collections`, export that collection, and re-import the exported file — the paper must still be present after the round trip. Screenshot to `.improve/artifacts/IMP-159/collections-storage-key-mismatch-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Impact is 3 and confidence 4 because the only *current* producer of a mismatched key is a hand-edited `localStorage` — every in-app write path (`mergeImport`, `addPaper`, `loadState` itself) keys by `paper.id`, so the key/id invariant already holds in practice. It is recorded because the invariant is real, the consequence is silent data loss, and nothing enforces it, so the first future code path that keys by anything else inherits it. Risk `med` because the fix *deletes* entries in the mismatched case (criterion 1's preferred option does not), so the PR body must say which of the two options was taken and why. D-1 in `.improve/reports/discovered-IMP-151.md`. Distinct from IMP-006 (crash-consistent writes) and IMP-058 (orphan snapshots): those are about write ordering and pruning, not about the key/`id` agreement on read.

## Tier 10.0


### IMP-148 — Announce the empty states with `role="status"`
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/components/PaperList.tsx:35-37` (`return <p className="empty">{emptyMessage}</p>`), `web/src/components/CollectionsView.tsx:126-129` (empty-collection `<p>`), `web/src/components/CollectionsView.tsx:234-238` (no-collections-yet `<p>`)
- **Intent:** All three empty states are bare `<p>` elements. The loading states they replace **do** announce (`role="status"` at `App.tsx:379` and `:415`), so a screen-reader user hears "Loading the paper index…" and then hears nothing at all when the empty state replaces it — the transition from busy to empty is silent. In the collections view the collection count is also embedded in a button label at `App.tsx:340` rather than announced.
- **Acceptance criteria:**
  1. The three `<p className="empty">` elements carry `role="status"`, so the loading→empty transition is announced without a `role="alert"` (an empty list is not an error).
  2. Exactly one live region is present at a time: the loading `role="status"` at `App.tsx:415` and the empty `role="status"` are never mounted together (the existing `loading ? … : <PaperList …>` ternary at `:414-420` already guarantees this).
  3. The visible text of all three messages is unchanged, and no CSS changes (`web/src/styles.css` has no `.empty[role]` rule and none is added).
  4. `cd web && npm run typecheck && npm test && npm run build` pass and the built CSS is unchanged.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then at 1280px search for `zzzqqqnothing` to reach the empty search state and inspect the DevTools accessibility tree to confirm the node's role is `status`; screenshot to `.improve/artifacts/IMP-148/feed-empty-role-status-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-empty-search-desktop-1280.png` (visually identical). Then `#view=collections` with no collections and screenshot `.improve/artifacts/IMP-148/collections-empty-role-status-mobile-390.png` against `baseline-collections-empty-mobile-390.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Distinct from IMP-110, which changes *when* the result count is announced; this item changes whether the empty state is announced at all. Profile WEB-61.


### IMP-150 — Stop installing `pandas` on the deploy path
- **Status:** TODO
- **Category:** CI & automation
- **Type:** improvement
- **Area / files:** `.github/workflows/deploy.yml:30-31` (`pip install -r requirements.txt`), `.github/workflows/ci.yml:16-17` (the same), `requirements.txt:2` (`pandas>=2.0.0`), `scripts/build_index.py` (imports no pandas), `scripts/arxiv_common.py` (imports no pandas)
- **Intent:** `pandas` is installed on every deploy and every CI run, but the only module that imports it is `scripts/paper-collector.py:14`. The deploy job runs `build_index.py` alone, which imports only `arxiv_common` and `arxiv` (`build_index.py:28`) — so every deploy downloads and installs a ~12 MB wheel plus its numpy dependency for nothing. The same install line serves the Python tests, which do need it (via `test_paper_collector.py`), so this is only removable from the **deploy** workflow.
- **Acceptance criteria:**
  1. `.github/workflows/deploy.yml:31` installs the arXiv dependency without pandas — e.g. `pip install "arxiv>=2.1.0"` explicitly, or `pip install arxiv` matched to the same floor — and `ci.yml:17` is left unchanged (the test suite imports pandas).
  2. The constraint installed on deploy matches the constraint in `requirements.txt:1`, so IMP-033's upper bound (if it lands first) is reflected in both places. Say in the PR body which file is the source of truth.
  3. `requirements.txt` is unchanged by this item, and the legacy CLI keeps working under the documented `pip install -r requirements.txt` flow (profile §6 compatibility surface).
  4. `cat -n .github/workflows/deploy.yml` shows the build job's install step before `Build the paper index` at `:33`, unchanged in position.
- **Verification method:** `cat -n .github/workflows/deploy.yml .github/workflows/ci.yml requirements.txt` and diff the constraints; then `python3 -m venv /tmp/rpf-deploycheck && /tmp/rpf-deploycheck/bin/pip install "arxiv>=2.1.0" && /tmp/rpf-deploycheck/bin/python -c "import arxiv; print(arxiv.__name__)"` succeeds while `python -c "import pandas"` in the same venv fails — confirming the deploy path no longer needs it; then `/usr/local/bin/python3.11 -m unittest discover -s tests -v` still reports 27 tests OK.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Saving is the install time and image size on the deploy runner, not correctness. Profile INF-07. The constraint duplication between `deploy.yml` and `requirements.txt` is the cost of this item — an alternative is a `requirements-deploy.txt`, which would be a new tracked file and is not proposed here.

### IMP-098 — Validate the manifest and shard payloads at runtime
- **Status:** TODO
- **Category:** Data validation
- **Type:** improvement
- **Area / files:** `web/src/lib/paperIndex.ts:90-91` (bare `as IndexManifest` cast), `web/src/lib/paperIndex.ts:111-124` (shard checks `Array.isArray(data.papers)` only), `web/src/components/PaperCard.tsx:44-49` (the render-time throw)
- **Intent:** Nothing between the network and the render validates the shape. A shard missing `abstract` makes `paper.abstract.length` throw inside render; a manifest missing `categories` produces a `Set` of `undefined` and an empty feed. Both are silent or catastrophic depending on the field.
- **Acceptance criteria:**
  1. A manifest validator checks `generatedAt` is a string, `categories` is a string array, `shards` is an array of well-formed entries, and `totalPapers` is a number; a failure raises `IndexUnavailableError` with a message naming the offending field.
  2. A paper validator runs over every shard paper and **drops** (never rewrites) entries whose `id`, `title`, `authors`, or `abstract` is missing or the wrong primitive type, logging the count dropped per shard file. Dropping rather than defaulting matters: `PaperCard.tsx:45` reads `paper.abstract.length` and `:63` reads `paper.authors.join`, so a defaulted `[]` or `""` would render a silently wrong card instead of a visible gap.
  3. A new test in `web/src/lib/__tests__/paperIndex.test.ts` feeds a manifest missing `categories` and a shard whose first paper has no `abstract`, asserting the errors are raised and no render-time throw is possible.
- **Verification method:** `cd web && npm run typecheck && npm test`; then hand-edit a scratch copy of a shard to drop one paper's `abstract`, serve it, and confirm the app still renders every other paper. Screenshot to `.improve/artifacts/IMP-098/feed-partial-shard-validated-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Risk `med` because a strict validator will reject data the app currently renders "successfully" (badly). Log every rejection and, on the first run against a real index, confirm the rejection count is zero before tightening.

### IMP-099 — Make index writes atomic
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:237-244` (`open(..., "w")` + `json.dump`), `web/src/lib/paperIndex.ts:93-97` (the downstream "malformed and could not be parsed" defense)
- **Intent:** Files are opened and streamed directly, so a crash, a `KeyboardInterrupt`, or a full disk leaves a truncated `index.json` or shard on the static host. The symptom is already defended against in the browser; the cause is preventable with write-to-temp plus `os.replace`.
- **Acceptance criteria:**
  1. Each shard and the manifest are written to a `<name>.tmp` sibling and moved into place with `os.replace` after a successful `json.dump`.
  2. No `.tmp` file survives a successful run, and a failed run leaves the previous `index.json` byte-identical to what it was.
  3. A test in `tests/test_build_index.py` makes `json.dump` raise on the shard write and asserts the pre-existing `index.json` is unchanged and readable.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-atomic && ls -a /tmp/rpf-atomic` shows no `*.tmp`.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-021
- **Priority score:** 10.0
- **Notes:** Keep `encoding="utf-8"` and `ensure_ascii=False` exactly as they are at `:241,244`; only the file lifecycle changes.

### IMP-100 — Abort in-flight fetches and add a timeout in the browser
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** improvement
- **Area / files:** `web/src/lib/paperIndex.ts:73-77` (`fetchManifest`), `web/src/lib/paperIndex.ts:100-105` (`loadShard`), `web/src/App.tsx:148-165,168-196` (`cancelled` flags)
- **Intent:** There is no `AbortController` or timeout anywhere in `web/src` — grep finds zero occurrences of `AbortController`, `signal`, or `timeout`. A hung shard fetch leaves the app stuck on "Loading papers from N weeks…" forever, `App.tsx`'s `cancelled` flag only discards results rather than aborting requests, and rapid 7→60→7 toggling fans out overlapping duplicate `Promise.all` bursts (worse under `StrictMode`'s double-invoked mount effect).
- **Acceptance criteria:**
  1. `PaperIndex` accepts an `AbortSignal` on both `getManifest` and `loadPapers` and passes it to every `fetch`.
  2. A per-request timeout (on the order of 15-30 s) rejects with an `IndexUnavailableError` naming the request rather than hanging.
  3. `App.tsx`'s effect cleanups abort the in-flight requests instead of only setting a `cancelled` boolean, and a `StrictMode` double-mount issues **one** network burst, not two — measured by counting `fetch` calls with a patched `window.fetch` on a fresh load of the dev server (`main.tsx:13` wraps `<App />` in `<StrictMode>`).
  4. The existing 10 tests in `web/src/lib/__tests__/paperIndex.test.ts` still pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in DevTools throttle the network to offline, load the feed, and confirm an error state appears within the timeout rather than an indefinite spinner. Screenshot to `.improve/artifacts/IMP-100/feed-fetch-timeout-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Risk `med` because aborting changes the shard cache's interaction with the recency filter — a request aborted by a superseded effect must not be cached as a failure, and a re-run must still fetch it.

### IMP-101 — Keep the previous list mounted while a new window loads
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:173-175` (`setLoading(true)` on recency change), `web/src/App.tsx:414-420` (swapping `PaperList` for a `<p>`), `web/src/components/PaperCard.tsx:40` (per-card `expanded` state)
- **Intent:** Every filter or recency change flips `loading` and unmounts the whole list, destroying every card's local `expanded` state and any open save-menu `<details>` — even when the shards are already cached and the reload is effectively instant. Recon recorded this as the "loses card state on filter change" defect.
- **Acceptance criteria:**
  1. Changing the recency window keeps the previously loaded `papers` rendered (optionally with a subtle loading indicator) until the new payload lands, so no card is unmounted.
  2. Card `expanded` state and open save-menu `<details>` survive a recency change for a paper present in both windows — verified by keying the list on `paper.id` (unchanged, `PaperList.tsx:45`) and by confirming in the browser that a card expanded in the 60-day view is still expanded after switching to 7 days and back.
  3. The loading indicator is still announced via `role="status"`.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px expand an abstract, open a save menu, switch 60→7→60 days, and confirm both are still open. Screenshots to `.improve/artifacts/IMP-101/feed-state-preserved-desktop-1280.png` and `.improve/artifacts/IMP-101/feed-state-preserved-mobile-390.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Risk `med` because showing stale papers while loading can be mistaken for the new window's results. The status text must name the window being loaded, and the count must reflect the window (see IMP-067 for the loading-time count and IMP-108 for its formatting).

### IMP-102 — Add a request timeout to the shared arXiv client
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** improvement
- **Area / files:** `scripts/arxiv_common.py:20-26` (`build_client`), `scripts/arxiv_common.py:52-59` (the retry/except path)
- **Intent:** `arxiv.Client` in 4.x calls `requests.Session.get()` with no `timeout=`, and `build_client` has no hook to add one. A half-open TCP connection hangs the deploy job until the 6-hour Actions cap with no diagnostic, and there is no `requests.exceptions.Timeout` retry path either.
- **Acceptance criteria:**
  1. The client is given an explicit request timeout (a connect timeout and a read timeout, or a single documented value), applied through a mechanism the code controls.
  2. A timeout is retried within the existing `num_retries` budget and, if it ultimately fails, is reported distinctly from an HTTP error in the log line at `:59`.
  3. A test in `tests/test_arxiv_common.py` asserts the configured timeout reaches the constructed client, using the existing `_install` harness at `:49-65`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 2 --out-dir /tmp/rpf-timeout` on a healthy network still exits 0; confirm the constructed client carries the timeout with a scratch script that prints `build_client(20)`'s session configuration.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Risk `med` because arxiv 4.x does not expose a `timeout` constructor argument; the honest implementation either subclasses/wraps the session or sets a session default, and a too-aggressive read timeout will cause spurious failures on large pages. Pair with IMP-089's `timeout-minutes` so a hung job fails fast rather than at 6 hours.

### IMP-103 — Add network-free tests for `collect_papers`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py` (new `CollectPapersTests`), `scripts/build_index.py:203-221` (`collect_papers`), `tests/test_arxiv_common.py:49-65` (the existing fake-client pattern)
- **Intent:** `collect_papers` — the function that decides whether the deployed site has data — has zero coverage: the retention `break`, the `_result_datetime` `None` path, the `max_per_category` → `UNLIMITED` mapping, the per-category loop, and the cutoff computation are all untested.
- **Acceptance criteria:**
  1. A new test class drives `collect_papers` with a fake `arxiv_common.iter_results` and an explicit `now`, asserting: a record older than the cutoff is excluded; a record with a non-`datetime` `published` is excluded; `max_per_category <= 0` maps to `UNLIMITED`.
  2. A test asserts one failing category is reported per IMP-004's chosen policy.
  3. No test in the file touches the network, and the suite stays under 1 s.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `time /usr/local/bin/python3.11 -m unittest discover -s tests` and confirm the total is still well under a second.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-056
- **Priority score:** 10.0
- **Notes:** Follow the existing fake-client pattern in `tests/test_arxiv_common.py:11-18,49-65` rather than inventing a new one; monkeypatch and restore in `tearDown` or `try/finally` as the file already does.

### IMP-104 — Add tests for `fetch_papers` including the download-failure path
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_paper_collector.py` (only `safe_filename` and `build_html_feed` are covered today), `scripts/paper-collector.py:58-84` (`fetch_papers`), `scripts/paper-collector.py:73-81` (the download block)
- **Intent:** `fetch_papers` has no coverage at all, which is precisely why the arxiv-4 `download_pdf` crash shipped with two documented flags 100% broken and the 27-test suite stayed green.
- **Acceptance criteria:**
  1. A test drives `fetch_papers` with a fake `iter_results` and asserts the returned DataFrame has the 9 expected columns with Title-Cased names.
  2. A test makes the download step raise and asserts the run continues to the next paper and logs a warning naming the title.
  3. A test asserts the CSV/HTML output paths are correct, which is the behavior `main()` depends on.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-093
- **Priority score:** 10.0
- **Notes:** No network in any of these; the fake result object only needs the attributes `fetch_papers` reads at `:62-70`.

### IMP-105 — Add `content-visibility: auto` to `.paper`
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/styles.css:297-303` (`.paper` block), `web/src/components/PaperList.tsx:39` (unbounded `visibleCount` growth via "Load more")
- **Intent:** "Load more" grows `visibleCount` without a cap, so at a few thousand papers the user can mount thousands of live `<article>` nodes. There is no virtualization and no `content-visibility`, so every off-screen card is laid out and painted.
- **Acceptance criteria:**
  1. `.paper` declares `content-visibility: auto` plus an explicit `contain-intrinsic-size: <W>px <H>px` in the same rule at `web/src/styles.css:297-304`, and the chosen intrinsic height is within ±30% of the measured median card height at 1280px (measure it before writing the value, and record it in the PR body).
  2. Scrolling the feed shows no blank cards or scrollbar jump at 1280px and 390px.
  3. `cd web && npm run build` succeeds and the built CSS grows by less than 200 bytes (baseline: 10.93 kB, gzip 2.86 kB — `two declarations on one selector` is well inside that).
- **Verification method:** `cd web && npm run build`; then load enough papers to require several "Load more" clicks, scroll to the bottom and back, and screenshot to `.improve/artifacts/IMP-105/feed-content-visibility-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-loadmore-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Risk `med` because `content-visibility: auto` changes the scroll height estimate while `contain-intrinsic-size` is approximate, which can cause a visible scrollbar jump. Set `contain-intrinsic-size` to a realistic card height and verify at both viewports. This is the cheap first step; true virtualization is deliberately not proposed because it would add a dependency the profile discourages.

### IMP-106 — Add a "Clear filters" action to the empty-filter state
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/components/PaperList.tsx:33,36` (`emptyMessage`, rendered as a bare `<p className="empty">`), `web/src/App.tsx:429-432` (the two empty messages)
- **Intent:** "No papers match the current filters." appears in a large dashed box with no way out — no clear-search button, no reset link, and no `×` on the search input. A user who narrows too far has to manually undo each change or reload.
- **Acceptance criteria:**
  1. When the list is empty because of filters (not because the window has no data), an action is rendered that resets the query, category selection, and recency to defaults in one step.
  2. The action is keyboard reachable and labelled, and it is not rendered for the "no papers in this window" case.
  3. `cd web && npm run typecheck && npm test` passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px search for `zzzqqqnothing` and screenshot the new state to `.improve/artifacts/IMP-106/feed-empty-with-reset-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-empty-search-desktop-1280.png`; activate the action and confirm the full feed returns.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Distinct from IMP-010, which is specifically the all-categories-deselected dead end. Both may render in the same state; keep the copy unambiguous about what each resets.

### IMP-107 — Enlarge sub-44px tap targets at 390px
- **Status:** TODO
- **Category:** Accessibility
- **Type:** improvement
- **Area / files:** `web/src/styles.css` (`.link-button` for "Show more", `.paper__links a`, `.paper__note a`, `.save-menu__list input[type="checkbox"]`), `web/src/components/PaperCard.tsx:80-87,91,100-105,121-127`
- **Intent:** Recon measured these at 390px: "Show more" 74×22, the `arXiv` link 34×22, the `PDF` link 26×22, "view the full text on arXiv" 156×16, and the save-menu checkbox 13×13. All are below the 24×24 WCAG 2.5.8 floor and far below the 44×44 target-size guidance.
- **Acceptance criteria:**
  1. Every interactive control inside a `.paper` has a hit area of at least 24×24 CSS px at 390px, measured with `getBoundingClientRect`.
  2. The visual size and typography of these controls are unchanged at 1280px — padding is added, not restyled.
  3. No control becomes an icon-only button.
- **Verification method:** `cd web && npm run build`; then at 390px run a script that reports `getBoundingClientRect()` for every `a`, `button`, and `input` inside the first `.paper` and assert the minimum is 24×24. Screenshots to `.improve/artifacts/IMP-107/feed-tap-targets-mobile-390.png` and `.improve/artifacts/IMP-107/feed-tap-targets-desktop-1280.png`, the latter compared against `.improve/artifacts/baseline/baseline-feed-mobile-390.png`'s desktop sibling.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Achieved with padding or a pseudo-element hit area so the rendered text metrics do not move; the one CSS breakpoint is at 520px (`web/src/styles.css:720`), so the padding can be unconditional.

### IMP-108 — Format result counts consistently and pluralize
- **Status:** TODO
- **Category:** UI polish & visual consistency
- **Type:** bug-fix
- **Area / files:** `web/src/components/FeedControls.tsx:108-110` (`{resultCount} paper{resultCount === 1 ? "" : "s"} match`), `web/src/App.tsx:389` (`manifest.totalPapers.toLocaleString()`)
- **Intent:** The hero prints "2,812 papers" with `toLocaleString` while the live count prints "2812 papers match" without it, and the verb is not pluralized — "1 paper match".
- **Acceptance criteria:**
  1. The live count uses the same thousands formatting as the hero, so "2,812" and not "2812".
  2. The count reads "1 paper matches" / "N papers match" with correct agreement, and "0 papers match".
  3. The same helper is used for the hero, so the two cannot diverge again.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px with a full index screenshot the hero and count to `.improve/artifacts/IMP-108/feed-count-format-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`; narrow the query to exactly one result and confirm the singular form.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** `Intl.NumberFormat` is standard; no new dependency. Consider reusing the existing `formatDate` helpers' placement rather than adding a fourth formatting helper in a fourth place (see IMP-117's dedup item).

### IMP-109 — Add `aria-expanded` and `aria-controls` to "Show more"
- **Status:** TODO
- **Category:** Accessibility
- **Type:** improvement
- **Area / files:** `web/src/components/PaperCard.tsx:79-87` (the expander button), `web/src/components/PaperCard.tsx:44-49` (the clamped abstract)
- **Intent:** The button toggles `expanded` and relabels itself "Show more"/"Show less" but exposes no expansion state, so a screen-reader user has no programmatic indication that the abstract is truncated or that it is now expanded.
- **Acceptance criteria:**
  1. The button carries `aria-expanded` reflecting `expanded`, and `aria-controls` pointing at the abstract element's id.
  2. The abstract element has a stable, unique id per card.
  3. The accessible name and the visible text are unchanged.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px Tab to the first card's "Show more", press Enter, and confirm `aria-expanded` flips; screenshot to `.improve/artifacts/IMP-109/feed-show-more-aria-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** The card must generate a unique id; `PaperCard` is rendered in both the feed and the collections view, so the id must not be derived from a global counter that would differ between views.

### IMP-110 — Stop the result count from being a per-keystroke live region
- **Status:** TODO
- **Category:** Accessibility
- **Type:** improvement
- **Area / files:** `web/src/components/FeedControls.tsx:108` (`role="status" aria-live="polite"` — the two are redundant), `web/src/App.tsx:241-243` (the query change path)
- **Intent:** The count is a polite live region, so a screen reader announces "N papers match" after **every character** typed. The `aria-live` attribute also duplicates `role="status"`, which already implies it.
- **Acceptance criteria:**
  1. The count is not re-announced on every keystroke: either it is not a live region, or its announcement is debounced to the same cadence as the search.
  2. The redundant `aria-live="polite"` is removed, keeping exactly one mechanism.
  3. The count remains perceivable to a screen-reader user when the result set settles, and the visual text is unchanged.
- **Verification method:** `cd web && npm run typecheck && npm test`; then with a screen reader or the DevTools accessibility tree, type "diffusion" and confirm at most one announcement after typing stops. Screenshot to `.improve/artifacts/IMP-110/feed-count-live-region-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Interacts with IMP-061 (query debounce) and IMP-067 (the `role="status"` loading region beside the count). If the debounce lands first, re-evaluate whether the count still needs to be a live region at all.

### IMP-111 — Remove the unused `PaperList.renderAction` prop
- **Status:** TODO
- **Category:** Code health & refactoring
- **Type:** improvement
- **Area / files:** `web/src/components/PaperList.tsx:20` (the prop declaration), `web/src/components/PaperList.tsx:32,52` (destructuring and `actionSlot={renderAction?.(paper)}`), `web/src/components/CollectionsView.tsx:136-144` (which uses `actionSlot` directly instead)
- **Intent:** Nothing in the app ever passes `renderAction`; the only caller that needed a per-card action uses `PaperCard`'s `actionSlot` instead. It is an unexercised escape hatch that makes the component's contract look larger than it is.
- **Acceptance criteria:**
  1. Either `renderAction` is removed from `PaperListProps` and its use site, or a real caller passes it; the PR body states which.
  2. `cd web && npm run typecheck && npm test && npm run build` all pass, and the rendered feed is byte-identical to the baseline.
  3. No other component prop is touched in the same change.
- **Verification method:** `cd web && npm run typecheck && npm run build`; `grep -rn "renderAction" web/src` returns nothing (or shows a real caller); then screenshot the feed to `.improve/artifacts/IMP-111/feed-desktop-1280.png` compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** This is listed because `tsc --noEmit` with `noUnusedLocals` cannot see an unused *prop*, and no linter exists yet. Removing a documented-looking extension point is a judgment call — say so in the PR.

### IMP-112 — Make `addPaper` return the same identity when nothing changes
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/lib/collections.ts:154-168` (`addPaper` case), `web/src/App.tsx:231-235` (the save effect keyed on `[collections]`)
- **Intent:** `addPaper` unconditionally returns a new `collections` array and a new `papers` object, so a redundant add (id already present, or a `collectionId` that does not exist) produces a new state identity, which re-renders every card and triggers another full `localStorage` write for no reason.
- **Acceptance criteria:**
  1. `addPaper` returns the **same** `state` object when the paper is already in the target collection and the snapshot is unchanged.
  2. It also returns the same object when `collectionId` matches no collection, and it validates `collectionId` rather than silently no-oping.
  3. A new test in `web/src/lib/__tests__/collections.test.ts` asserts `reducer(state, action) === state` (identity) for both no-op cases, and that the existing add-dedupe test still passes.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in the browser, toggle the same collection checkbox on and off for one paper and confirm `localStorage` writes are not duplicated by watching the DevTools Application panel.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** `CollectionsState` is treated as immutable throughout; identity stability is what makes `React.memo` (IMP-064) and the save effect's dependency array meaningful.

### IMP-113 — Document `npm run typecheck` in `readme.md`
- **Status:** TODO
- **Category:** Documentation
- **Type:** docs
- **Area / files:** `readme.md:61-67` ("Web tests and build" lists only `npm test` and `npm run build`), `web/package.json:12` (`typecheck` script), `.github/workflows/ci.yml:36` (the step CI actually runs)
- **Intent:** The readme documents two of the three web commands a contributor must run. The missing one is the command CI runs, so a contributor who follows the readme locally can still fail CI on a type error.
- **Acceptance criteria:**
  1. `readme.md:61-67` lists `npm run typecheck` alongside `npm test` and `npm run build`, with a one-line note that it is the only lint the project has.
  2. The documented command list matches `web/package.json:6-13` exactly, with no command listed that does not exist.
  3. No other readme section is changed by this item.
- **Verification method:** `cat web/package.json` and diff `scripts` against the readme's list; then `cd web && npm run typecheck && npm test && npm run build`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** If IMP-137 adds a `lint` script later, this readme section needs a second pass.

### IMP-114 — Document `--category` in `readme.md`
- **Status:** TODO
- **Category:** Documentation
- **Type:** docs
- **Area / files:** `readme.md:42-44` (lists `--retention-days`, `--max-per-category`, `--abstract-chars`, `--out-dir`), `scripts/build_index.py:270-274` (`--category`, repeatable)
- **Intent:** `--category` is the only `build_index.py` flag that is not documented, and it is the one a reader most wants: it is how you point the pipeline at a different arXiv category than the five defaults.
- **Acceptance criteria:**
  1. `readme.md:42-44` documents `--category` with its repeatable semantics and its default of the five `cs.*` categories.
  2. Every documented flag still matches `python scripts/build_index.py --help` output.
  3. The example in the readme still runs: `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-doc-cat` exits 0.
- **Verification method:** `/usr/local/bin/python3.11 scripts/build_index.py --help` and diff the flag list against `readme.md:42-44`; then run the example command.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Pair with IMP-022, which adds the accepted-range statement for `--category` that this readme section must then reflect.

### IMP-115 — Fix the `iso_date` docstring and its naive-datetime branch
- **Status:** TODO
- **Category:** Content accuracy
- **Type:** docs
- **Area / files:** `scripts/build_index.py:77-87` (`iso_date`), `scripts/build_index.py:78` (the docstring claiming "normalized to UTC")
- **Intent:** The docstring says the value is "normalized to UTC", but the naive-datetime branch at `:83` calls `.date()` on the value as-is, silently assuming the caller meant UTC. A naive datetime from a different zone produces a date that is off by one.
- **Acceptance criteria:**
  1. The docstring describes what the function actually does, and the naive branch either assumes UTC explicitly (with a named constant) or is documented as assuming the caller already normalized.
  2. A new test in `tests/test_build_index.py` covers all four branches: tz-aware `datetime`, naive `datetime`, `date`, `None`, and a string passthrough.
  3. `record_from_result`'s use of `iso_date` at `:108-109` is unchanged in behavior.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util; s=importlib.util.spec_from_file_location('bi','scripts/build_index.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); import datetime as d; print(m.iso_date(d.datetime(2024,1,8,23,30,-5, tzinfo=d.timezone(d.timedelta(hours=-5)))), m.iso_date(None), m.iso_date('2001-01-01'))"` → `2024-01-09 None 2001-01-01`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** All four branches are currently untested, which is why the docstring drifted without anyone noticing.

### IMP-160 — Guard the collection render path against a paper snapshot it does not own
- **Status:** TODO
- **Category:** Correctness
- **Type:** improvement
- **Area / files:** `web/src/components/CollectionsView.tsx:42-45` (`collection.paperIds.map((id) => state.papers[id]).filter(paper => Boolean(paper))`), `web/src/components/PaperCard.tsx:50` and `:56` (`paper.abstract.length`, inside a `useMemo` and again in the render)
- **Intent:** `CollectionsView.tsx:42` dereferences whatever `state.papers[id]` returns, and `PaperCard` trusts its `Paper`-typed prop with no guard. Both are safe **only because their producer** (`mergeImport` / `loadState`) now filters on own-key membership after IMP-151 — nothing at the point of use defends either. If any future path ever adds a `paperIds` entry without an own snapshot, the inherited value flows straight into `PaperCard` and `paper.abstract.length` throws: with no error boundary the user gets a permanently blank collections view until they clear `localStorage`, which is the exact outcome IMP-151 was written to remove. `isPaper` and `hasSafeUrls` exist precisely because snapshots are untrusted, and the component is the last line of defence with none.
- **Acceptance criteria:**
  1. `CollectionsView.tsx:42-45` filters on **own** key membership before handing a value to `PaperCard`, reusing the same `hasOwnKey` helper `web/src/lib/collections.ts` already exports for IMP-151 rather than writing a third membership idiom.
  2. `PaperCard` no longer throws on a snapshot whose `abstract` is missing or not a string: it renders a visibly degraded card (no "Show more" control, the title still present) rather than raising. Pick the fallback and record it; do not silently substitute `""` for a real field, per IMP-098 criterion 2's reasoning.
  3. New tests, which is why this item is not a one-liner: a test in `web/src/components/__tests__/CollectionsView.test.tsx` (IMP-037's file, which gates it) renders a collection whose `paperIds` names an id with no own snapshot and asserts the component renders without throwing; a test in the same directory renders a `PaperCard` with `abstract` absent and asserts the same. Per profile §5.3, component tests go in `web/src/__tests__/` or a `components/__tests__/` sibling, and `.tsx` must be in the vitest `include` glob — it is, as of `894fb9b`.
  4. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; then seed `rpf.papers.v1` directly with `{"__proto__x": {"id": "__proto__x", "title": "orphan", "authors": [], "abstract": "a", "categories": [], "published": "2024-01-01", "primaryCategory": "cs.CV"}}` plus a collection whose `paperIds` is `["__proto__x"]`, hard-reload `#view=collections`, and confirm the view renders and the console is empty. Screenshot to `.improve/artifacts/IMP-160/collections-orphan-snapshot-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Defence in depth, deliberately **not** scored as a bug: no current code path reaches either site with a bad value, which is why impact is 2. Its value is converting the *next* regression of this class from "permanently blank page until the user clears localStorage" into a degraded card — IMP-151 closed one reachable route and this closes the class. IMP-018 (a React error boundary around `<App />`) is the broader, coarser complement and should be treated as the backstop for anything this and IMP-154 miss; if IMP-018 lands first, criteria 1 and 2 still hold value because a boundary shows a fallback page rather than a working view with one bad card hidden. D-2 and D-3 in `.improve/reports/discovered-IMP-151.md`, restated as Issue 3 of `.improve/reports/verify-IMP-151.md`, which confirmed the current state is safe purely by the producer invariant.

### IMP-161 — Guard `mergeImport`'s `papers[paper.id]` write against a prototype key
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:140` (`papers[paper.id] = paper` inside `mergeImport` — the one remaining untrusted-key `[[Set]]` in the file), `web/src/lib/collections.ts:146-149` (`mergeImport`'s own read, already guarded), `web/src/lib/collections.ts:299` (`loadState`'s analogous write, already guarded)
- **Intent:** IMP-151 guarded the *read* at `:146` and `loadState`'s *write* at `:299`, but left `mergeImport`'s *write* at `:140` unguarded. Dispatching the reducer directly with a `__proto__`-id paper sets the prototype of the live `papers` object: `Object.getPrototypeOf(state.papers)` becomes the attacker's paper object. Measured: own keys `[]`, no crash, no global `Object.prototype` pollution, and **no persistence** (`JSON.stringify` writes own enumerable keys only, so it emits `{}`). It is latent rather than exploitable today — the sole production caller is `CollectionsView.tsx:176 onImport(payload)`, where `payload` is the non-null result of `parseExportPayload`, which rejects prototype-key ids — so this is a symmetry fix, not a live hole.
- **Acceptance criteria:**
  1. `web/src/lib/collections.ts:140` carries the same guard as `:299`: a paper whose id is in `PROTOTYPE_KEYS`, or is already an own key of `papers`, is not written. After the change, `grep -n "papers\[" web/src/lib/collections.ts` shows every assignment guarded by `hasOwnKey` or a `PROTOTYPE_KEYS` check.
  2. `grep -nE '\[\s*paper\.id\s*\]|\[\s*id\s*\]' web/src/lib/collections.ts` reports no unguarded computed write outside `isPaper`/`isCollection`'s own validation.
  3. A new test in `web/src/lib/__tests__/collections.test.ts` dispatches `collectionsReducer` **directly** (bypassing `parseExportPayload`) with a payload containing `{"id": "__proto__", "title": "p", "authors": [], "abstract": "a", "categories": [], "published": "2024-01-01", "primaryCategory": "cs.CV"}` and asserts `Object.getPrototypeOf(state.papers)` is `Object.prototype`, not the attacker's object. This test must fail before the fix and pass after.
  4. No legitimate arXiv id is dropped: importing the committed `web/public/data/papers-2026-W40.json` records keeps all 2,812 papers, and an id of `toString` is still accepted (it is a real own key in that corpus and is deliberately absent from `PROTOTYPE_KEYS`).
  5. `cd web && npm run typecheck && npm test` passes with no pre-existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then import the real 2,812-paper index through the UI and confirm the collection count reads 2812 with an empty console; and run the criterion-3 probe in a `/tmp` copy with the guard removed to confirm the test is not vacuous.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2, not higher, precisely because the verifier measured no global pollution, no crash and no persistence — this is closing a latent inconsistency with IMP-151's own invariant, not a live vulnerability. Note the toolchain constraint recorded by IMP-151's implementer: `Object.hasOwn` is **not** usable here, because `web/tsconfig.json:5` sets `lib: ["ES2020", …]` and it fails with TS2550; use `Object.prototype.hasOwnProperty.call(...)` via the existing `hasOwnKey` helper. Do not introduce `Object.hasOwn`. Issue 2 in `.improve/reports/verify-IMP-151.md`; keep the cited line number current, since the file shifted when IMP-151 landed.

### IMP-162 — Handle `TarInfo.mode is None` and strip privileged mode bits on the fallback path
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:43-67` (`rejection_reason()` and the fallback pre-screen, neither of which inspects `member.mode`), `scripts/paper-collector.py:116-121` (the `Sanitized member` warning, which exists only on the `TARFILE_HAS_FILTER` branch), `scripts/paper-collector.py:123` (the `filter="data"` call that IS told about mode changes)
- **Intent:** The IMP-024 fallback is less strict than `data_filter` in two ways that both concern `member.mode`, and neither is logged. First, `rejection_reason()` never inspects the mode, so on the fallback branch a setuid/setgid/sticky bit survives onto disk — measured on 3.8.19, 3.11.8, 3.12.7 and 3.13.0 with the fallback forced: `suid=0o4755`, `sgid=0o2755`, `sticky=0o1777`, where `data_filter` would yield `0755` **and log it**. Second and more of a trap: `tarfile.data_filter` returns a `TarInfo` whose `.mode` is **`None` for symlink members** (CPython uses `None` to mean "do not chmod this link"), so any `%o` formatting of a filtered member's mode raises `TypeError: %o format: an integer is required, not NoneType` **inside the logging handler** — which would abort extraction of that archive rather than merely losing a log line. The current code dodges both with a local `mode_str()`, but the shape is easy to re-break and neither behavior is pinned by a test.
- **Acceptance criteria:**
  1. On the fallback path, a member whose `member.mode is not None and member.mode & 0o7000` is logged with the same `Sanitized member` shape used on the `TARFILE_HAS_FILTER` branch, and the bit is neutralised to `mode & 0o755` **on the `TarInfo` that is actually written** — the shipped `safe_members` list must carry the *replacement* `TarInfo`, not the original, because it is passed to a filterless `extractall`.
  2. Every mode comparison and every `%o`/`%d` format of a mode in this module is `None`-guarded. No `logging` call in `scripts/paper-collector.py` may raise for any member shape.
  3. New tests in `tests/test_paper_collector.py`, with the fallback forced by stubbing `TARFILE_HAS_FILTER` to `False`: (a) an archive member with mode `0o4755` extracts as `0o755` and the warning names the member; (b) a **symlink** member extracts successfully with no `TypeError` and with no spurious `Sanitized member` warning for it; (c) a plain regular file at `0o644` produces **no** warning, so the item cannot be "fixed" by warning on everything.
  4. The same three assertions pass on the `TARFILE_HAS_FILTER` branch, so both code paths agree.
  5. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes, and the forced-fallback tests **run** rather than skip on the provisioned interpreter.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util,stat,os; s=importlib.util.spec_from_file_location('pc','scripts/paper-collector.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); print(oct(m.TARFILE_HAS_FILTER))"`; and a real extraction check: `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 1 --output-dir /tmp/rpf-modes --download-sources` then `find /tmp/rpf-modes -type f -perm -4000` must print nothing, and the run must exit 0 with no `TypeError`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 because the branch is unreachable on every patched CPython ≥3.8.17 and in CI, and because the extracted file is owned by the user running the tool — a preserved setuid bit grants no privilege and there is no traversal or write-outside-`dest` consequence. It is a hardening/consistency gap, not an escape, and the verifier explicitly recommended accepting IMP-024 with this folded into a follow-up. Do not "fix" it by warning on every member (criterion 3c). Related but deliberately **not** bundled: the fallback *rejects* absolute member names while `data_filter` *relocates* them into the destination — both safe, not equivalent, and only worth reconciling in whichever item eventually removes the fallback (D8 in `.improve/reports/discovered-IMP-024.md`). R1 and D7 in the discovery/verification reports.

### IMP-166 — Pin the Node version in both workflows and declare `engines`
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:30` (`node-version: "20"`), `.github/workflows/deploy.yml:38` (`node-version: "20"`), `web/package.json` (no `engines` field), `web/package-lock.json` (declares `jsdom@29.1.1`'s `engines: {"node": "^20.19.0 || ^22.13.0 || >=24.0.0"}`)
- **Intent:** IMP-005 added `jsdom@29.1.1`, whose declared engine floor is `^20.19.0 || ^22.13.0 || >=24`. Both workflows request the floating `"20"`, which `actions/setup-node@v4` currently resolves to the newest 20.x and therefore satisfies — but only by resolution, not by declaration. There is no `.npmrc` and no `engine-strict`, so a future drift degrades to an `EBADENGINE` **warning** rather than a red build, and nothing in the repo records the requirement a contributor must meet locally. This is the same class of fragility as PE-10's floating `python-version: "3.x"`, on the JavaScript side.
- **Acceptance criteria:**
  1. Both workflows request an explicit minor version (e.g. `node-version: "20.19"` or `"22.13"`), never a bare `"20"`, and the two files agree.
  2. `web/package.json` gains an `engines.node` that matches what CI installs, and `engines` is not a lie: the value must be one the provisioned Node satisfies. Check it with `node -p "process.versions.node"` and record the result in the PR body.
  3. Decision recorded in the PR body: whether to add `engine-strict=true` (via `.npmrc`) so a mismatch fails loudly, or to leave it a warning. Either is acceptable; leaving it undecided is not.
  4. `cd web && npm ci` is clean afterwards (`npm ci --dry-run` exits 0 with no lockfile drift) and `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cat -n .github/workflows/ci.yml .github/workflows/deploy.yml | grep -n 'node-version'`; `cd web && node -p "process.versions.node"`; `cd web && npm ci --dry-run`; `cd web && npm ls jsdom`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 — it cannot fail today. It is included because IMP-005 inherited a floating-version dependency constraint and nothing in the repo will catch it when it does drift, and because the fix is a one-line change in two files. Unverified on the machine that found it: every Homebrew `node@21`/`node@22` keg under `/opt/homebrew/opt/` symlinks into `Cellar/node/25.6.1`, so no real Node 20 was available to test against and the author could only reason about `setup-node`'s resolution, not observe it — criterion 2 exists to close that gap. Do **not** bundle the alternative fix (`npm install --save-dev jsdom@^26`, which declares `node >=18`): that would churn `web/package-lock.json`, which profile §6 restricts to IMP-005 and IMP-137. Recorded as §2 of `.improve/reports/discovered-IMP-005.md`; profile INF-19 records the absence of `engines`/`.nvmrc` but no item owns it.

### IMP-167 — Require every implementer report to quote the command behind each figure
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.improve/reports/impl-IMP-012.md:4, 22, 229` (wrong line number `styles.css:18`, actual `:9`), `.improve/reports/impl-IMP-012.md:220, 222` (wrong computed font sizes: `.hero p` given as `1.05rem`/16.8px, actual `1rem`/16px; `.paper__meta` as 12.25px, actual 13.28px), `.improve/reports/impl-IMP-012.md:338` (fabricated build output: "CSS 8.85 kB (gzip 2.56 kB), JS 382.45 kB (gzip 113.00 kB)" and "Same output sizes as the recorded baseline", when the real build is **CSS 10.93 kB (gzip 2.86 kB), JS 163.72 kB (gzip 52.63 kB)** and the CSS figure matched neither the pre- nor the post-IMP-005 baseline)
- **Intent:** The IMP-012 *code* was correct — one line, `--text-muted: #7a7a73` → `#666661` at `web/src/styles.css:9`, and every contrast ratio in the report reproduced to four decimal places under independent arithmetic. But the report that is supposed to be the record carried a wrong line number three times, a wrong font-size table, and build-size numbers that were never produced by any build, alongside an explicit "same as baseline" claim that its own figures contradict. A human skimming for evidence is misled by exactly that claim, and a downstream agent reading the report inherits 8.85 kB and 382.45 kB as fact. The gap is procedural: nothing requires a report figure to be traceable to a command and its output.
- **Acceptance criteria:**
  1. The three reports above are corrected in place: `impl-IMP-012.md:4, 22, 229` say `styles.css:9`; the `:220, 222` table carries the computed values (`.hero p` 16px, `.paper__meta` 13.28px, `.controls__count` 14.4px, `.collection__count` 14.4px); `:338` carries the real `npm run build` output and drops the "same as baseline" claim in favour of naming the baseline it was compared against. No source file is touched.
  2. A short **"Evidence rules"** block is added to this backlog's header, above the verification vocabulary, stating that (a) any line-number citation must be read from the file it names, (b) any build-size or test-count figure must be quoted with the command that produced it, and (c) a figure the author did not measure must be omitted rather than estimated.
  3. The block is echoed in `.improve/REPO_PROFILE.md` §4.6's definition of done, as a seventh numbered step, so it applies to the verification playbook and not only to implementers.
  4. No existing item's acceptance criteria are weakened by this change; it is a documentation and process change only.
- **Verification method:** `grep -n "styles.css:18\|8\.85 kB\|382\.45" .improve/reports/impl-IMP-012.md` must return nothing; `grep -n "Evidence rules" .improve/FEATURES.md` and `grep -n "Evidence rules" .improve/REPO_PROFILE.md` must each return one hit; `cd web && npm run build` must still print `10.93 kB` and `163.72 kB`, confirming the corrected report matches reality.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 — no user or operator harm, and not one line of shipped code was wrong. The reason to itemize it is that `.improve/` is the memory of this loop: a fabricated figure in a DONE item's report is read by the next three implementers as a baseline, and the loop's whole value is that the baseline is measured. The verifier's judgement was that this "is the most serious report defect, because it is the one that would mislead a human reviewer skimming for evidence" — record that reasoning in the PR body so the item is not dismissed as pedantry. D1, D4 and D5 in `.improve/reports/verify-IMP-012.md`. This item does **not** retroactively invalidate the IMP-012 code change, which passed 7/7 criteria.

## Tier 8.0


### IMP-149 — Give the search field a visible label that fits at 390px
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/components/FeedControls.tsx:33-35` (`<label className="sr-only">Search papers</label>`), `web/src/components/FeedControls.tsx:40` (the 63-character `placeholder`), `web/src/styles.css:207-221` (`.controls__search input`)
- **Intent:** The only visible affordance for the search field is its placeholder, and at 390px that 63-character string is visually truncated by the input width. There is no visible label and no `aria-describedby` hint, so a phone user sees a half-word with no indication of what the field does, while a screen-reader user gets the correct `sr-only` label "Search papers".
- **Acceptance criteria:**
  1. Either the field gains a visible label (a `<label>` that is not `sr-only`, or a `sr-only` label plus a short visible heading) or the placeholder is shortened to at most 30 characters so it is not truncated at 390px. Whichever route is taken, the **accessible name stays exactly "Search papers"**.
  2. At 390px, `input.placeholder` is not clipped: either the shortened text fits, or the visible label above the field does. Verified by screenshot, not by inference.
  3. The input keeps `id="search-input"` and `type="search"` (profile §5.3 accessibility patterns), and no icon-only control is introduced.
  4. The `--accent`-based focus treatment from IMP-014 still applies to this field at 1280px, and `cd web && npm run typecheck && npm run build` succeed with the built CSS growing by less than 1 kB.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then at 390px assert `document.querySelector('#search-input').placeholder.length <= 30` (if route 2) or that a non-`sr-only` label is visible, and screenshot to `.improve/artifacts/IMP-149/feed-search-label-mobile-390.png` compared against `.improve/artifacts/baseline/baseline-feed-mobile-390.png`; confirm no horizontal overflow (`document.documentElement.scrollWidth === clientWidth`).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Profile WEB-63. Distinct from IMP-121 (a clear × control) and IMP-106 (a reset action): this item is about *labelling*, not about clearing. If IMP-121 lands first and the placeholder is replaced by a clear affordance, re-check whether a visible label is still needed.

### IMP-116 — Correct the readme's "only the week shards it needs" claim
- **Status:** TODO
- **Category:** Content accuracy
- **Type:** docs
- **Area / files:** `readme.md:22` ("fetching only the week shards it needs"), `web/src/lib/paperIndex.ts:54-59` (`selectShards` uses `shard.to >= windowStart`)
- **Intent:** The selection is boundary-inclusive, so a 7-day window still pulls the older boundary shard. Recon observed the 7-day window selecting both locally available shards. The readme's claim is a bandwidth promise the code does not keep.
- **Acceptance criteria:**
  1. `readme.md:22` describes the actual behavior, including that a window may pull the week shard that straddles its start boundary.
  2. `selectShards` is unchanged by this item — the doc is corrected, not the behavior.
  3. The claim is verifiable: a 7-day window against a multi-shard index selects `1 + (number of boundary-straddling shards)` shards.
- **Verification method:** `cat -n readme.md | sed -n '19,25p'`; then with a multi-shard index in `web/public/data/`, select 7 days in the UI and count the shard fetches in the DevTools Network panel.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Deliberately a docs fix. Changing `selectShards` to an exclusive boundary would silently drop papers published inside the window that happen to sit in an earlier shard, which is worse.

### IMP-117 — Stop returning the shared `EMPTY_STATE` singleton
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:33` (`export const EMPTY_STATE`), returned at `:245` and `:274`, `web/src/lib/__tests__/collections.test.ts:286-290` (a `toEqual(EMPTY_STATE)` assertion)
- **Intent:** `EMPTY_STATE` is a shared mutable module object returned on every failure path. It is safe today only because the reducer is copy-on-write, and the test that would catch an aliasing bug passes trivially because it compares the same reference.
- **Acceptance criteria:**
  1. Each failure path returns a fresh object, either via a `makeEmptyState()` factory or a frozen constant that is never handed out by reference.
  2. The existing test that compared against `EMPTY_STATE` is updated to compare against a structurally equal literal, not the module singleton.
  3. A new test asserts two consecutive `loadState` calls on a throwing storage return objects that are not `===` each other.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the collections file to report 15 tests (14 pre-existing + 1 new).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** The exported `EMPTY_STATE` is part of the module's public surface; if it is removed, check that nothing in `web/src` imports it.

### IMP-118 — Fix the malformed legacy-CLI HTML and the `Mathedemo` title
- **Status:** TODO
- **Category:** Content accuracy
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:88-122` (`build_html_feed`), `scripts/paper-collector.py:91` (`<title>Mathedemo</title>`), `scripts/paper-collector.py:112-118` (the `<b>`/`<font>` nesting)
- **Intent:** The template closes `</body>` without ever opening `<body>` (a tag scan gives opens `['html','head']`, closes `['head','body','html']`), nests `<b>…</b> </font>` incorrectly, and keeps a `Mathedemo` placeholder title and 400px left+right margins. Browsers recover, so this is correctness and presentation, not an injection — `html.escape` is applied correctly at `:109-118` and tested.
- **Acceptance criteria:**
  1. The generated HTML has balanced tags (an opening `<body>` exists) and valid `<b>`/`<font>` nesting.
  2. `<title>` reflects the actual feed rather than the `Mathedemo` placeholder.
  3. The two existing `BuildHtmlFeedTests` (escaping at `:35-44` and the https MathJax assertion at `:46-49`) still pass, and a new assertion checks tag balance.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 3 --output-dir /tmp/rpf-html` and validate the output with a tag-balance script; open it in a browser at 390px and screenshot to `.improve/artifacts/IMP-118/cli-feed-mobile-390.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** The lowest-value fix in this tier. The SPA has replaced this output path, but `readme.md:96-104` still documents the CLI as supported, so it should render correctly. IMP-147 (pandas chained indexing) edits the same lines and the same function — land both in one change so the generated HTML is re-baselined once.

### IMP-119 — Make the two-stage abstract truncation explicit and correct the copy
- **Status:** TODO
- **Category:** Content accuracy
- **Type:** docs
- **Area / files:** `scripts/build_index.py:48-53` (`truncate_abstract`, default 500 + `…`, sets `abstractTruncated`), `web/src/components/PaperCard.tsx:5` (`ABSTRACT_PREVIEW_CHARS = 260`), `web/src/components/PaperCard.tsx:44-49` (the clamp), `web/src/components/PaperCard.tsx:88-96` (the "Abstract truncated" note)
- **Intent:** Truncation happens twice, in two languages. The pipeline caps at 500 chars and the card clamps *that already-capped* string at 260. So "Show more" can never reveal more than ~500 characters, and there is no full abstract anywhere in the app — it lives only on arXiv. The relationship between the two budgets is documented nowhere.
- **Acceptance criteria:**
  1. The relationship is stated where a maintainer will see it: a comment at `PaperCard.tsx:5` and a note in the readme or the `build_index.py` docstring, naming both budgets.
  2. The card's "Abstract truncated — view the full text on arXiv" note is shown whenever the text is actually truncated, including when truncation happened only in the browser, not just when the pipeline set `abstractTruncated`.
  3. A test in `web/src/lib/__tests__/search.test.ts` or a new card-level test asserts the preview budget is strictly less than the pipeline budget, so the two cannot be set in the wrong order by accident.
- **Verification method:** `cd web && npm run typecheck && npm test`; then load a feed and confirm the truncation note appears on every paper whose abstract is clamped. Screenshot to `.improve/artifacts/IMP-119/feed-abstract-truncation-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** The complete fix — shipping the full abstract in the index — is IMP-139. This item only makes the current two-layer behavior honest and testable.

### IMP-120 — De-duplicate `PAGE_SIZE` and `LOAD_MORE_STEP`
- **Status:** TODO
- **Category:** Code health & refactoring
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:24` (`PAGE_SIZE = 50`), `web/src/components/PaperList.tsx:6` (`LOAD_MORE_STEP = 50`), `web/src/App.tsx:424` (the increment uses `PAGE_SIZE`), `web/src/components/PaperList.tsx:62` (the label uses `LOAD_MORE_STEP`)
- **Intent:** The increment uses one constant and the button *label* uses the other, so if they ever diverge the label lies about how many items will appear. Nothing guards the equality.
- **Acceptance criteria:**
  1. There is exactly one page-size constant, imported where it is needed, and the increment and the label both read it.
  2. The "Load more" label is unchanged from the baseline ("Load 50 more (N remaining)").
  3. `cd web && npm run typecheck && npm run build` succeed and no other constant is consolidated in the same change.
- **Verification method:** `grep -n "= 50" web/src/App.tsx web/src/components/PaperList.tsx` shows one definition; then `cd web && npm run build`, click "Load more" and confirm the label and the added card count agree. Screenshot to `.improve/artifacts/IMP-120/feed-loadmore-desktop-1280.png` compared against `.improve/artifacts/baseline/baseline-feed-loadmore-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** A module-level constant in `web/src/lib/types.ts` or a small `constants.ts` is fine; the profile forbids moving modules as a side effect of this change.

### IMP-121 — Add a clear (×) button to the search field
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/components/FeedControls.tsx:32-44` (the search input), `web/src/styles.css:207-221` (`.controls__search` and its input)
- **Intent:** The field is `type="search"` at `FeedControls.tsx:38`, so some engines already draw their own clear affordance — but it is not present in every engine, there is no `Escape`-to-clear anywhere, and the visible label is `sr-only`, so nothing guarantees a keyboard or screen-reader user has any way to clear a long query in one action. Reconcile with what the reference engine actually renders before adding anything.
- **Acceptance criteria:**
  1. A clear control appears inside the search field whenever the query is non-empty, is keyboard reachable, and clears the query in one activation.
  2. The control is not an icon-only button with no accessible name — it has a visible text label or an `aria-label`. If the reference engine already renders a native `type="search"` clear affordance, prefer styling that affordance (or handling `Escape`) over adding a duplicate custom control, and say which in the PR body.
  3. No layout shift occurs at 1280px or 390px when the control appears or disappears.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then type a query and screenshot to `.improve/artifacts/IMP-121/feed-search-clear-desktop-1280.png` and `.improve/artifacts/IMP-121/feed-search-clear-mobile-390.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` and `.improve/artifacts/baseline/baseline-feed-mobile-390.png`; clear and confirm the full feed returns.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** New styling goes in `web/src/styles.css`; never add a `style=` prop. A native `<input type="search">` already renders a browser clear affordance in some engines, so confirm whether this duplicates it before adding a custom control.

### IMP-122 — Validate the create-collection name and clear the input
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** improvement
- **Area / files:** `web/src/components/CollectionsView.tsx:192-202` (the create form, which silently no-ops on an empty name), `web/src/components/PaperCard.tsx:144-165` (the in-menu create form, same pattern), `web/src/lib/collections.ts:137-148` (`renameCollection` already rejects blank)
- **Intent:** Submitting an empty "New collection name" does nothing at all — no error, no message, no focus move — in both create forms. The rename path already rejects blank names via the reducer, so the create path is the inconsistent one.
- **Acceptance criteria:**
  1. An empty or whitespace-only submission renders an inline validation message tied to the input via `aria-describedby` or `aria-invalid`, and the input keeps focus.
  2. A successful creation clears the input (it already calls `event.currentTarget.reset()` at `:202` and `:152`) and the new collection appears in both the collections view and any open save menu.
  3. Both create forms behave identically.
- **Verification method:** `cd web && npm run typecheck && npm run build`; then at 1280px submit the empty create form and screenshot the validation message to `.improve/artifacts/IMP-122/collections-create-validation-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-collections-empty-mobile-390.png`; then create a real collection and confirm the field clears.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** The profile's baseline note that the input is "not cleared after submitting" does not hold for the code as written — both forms do call `reset()` on the success path. Only the empty-submit path is silent, so this item is scoped to that.

### IMP-123 — Add `-webkit-backdrop-filter`
- **Status:** TODO
- **Category:** UI polish & visual consistency
- **Type:** improvement
- **Area / files:** `web/src/styles.css:118` (`backdrop-filter: saturate(180%) blur(10px)` on `.skip-link`/`.site-header`)
- **Intent:** The unprefixed property is ignored by Safari, which needs `-webkit-backdrop-filter`, so the sticky header renders with a transparent background on Safari while every other browser gets the frosted effect. The translucent `color-mix` background still applies, so the header is readable — but visibly different.
- **Acceptance criteria:**
  1. The `-webkit-` prefixed declaration immediately precedes the unprefixed one on the same rule.
  2. The rendered result in Chromium is byte-identical to the baseline.
  3. The built CSS grows by less than 100 bytes.
- **Verification method:** `cd web && npm run build` and `grep -c "webkit-backdrop-filter" web/dist/assets/*.css` returns 1; screenshot the sticky header at 1280px to `.improve/artifacts/IMP-123/feed-header-backdrop-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Keep this item to the `-webkit-` prefix only. Any `@supports` fallback would belong in a separate item, and none is proposed here.

### IMP-124 — Add Open Graph, canonical, and `theme-color` metadata
- **Status:** TODO
- **Category:** Documentation
- **Type:** improvement
- **Area / files:** `web/index.html:3-18` (only `title`, `description`, favicon, and the font preconnects), `readme.md:9` (the canonical live URL)
- **Intent:** Sharing a paper or the site in a chat or on social produces a bare link with no preview, no image, and no site name. There is no canonical URL and no `theme-color`, so the browser chrome does not match the design.
- **Acceptance criteria:**
  1. `web/index.html` carries `og:title`, `og:description`, `og:type`, `og:url` (the live URL from `readme.md:9`), `og:image`, `twitter:card`, `<link rel="canonical">`, and `<meta name="theme-color">` matching the `--bg` token.
  2. `og:image` points at a committed asset under `web/public/` (a screenshot of the feed is the natural candidate) and is not in a gitignored directory.
  3. `cd web && npm run build` succeeds and the built `dist/index.html` contains all the tags.
- **Verification method:** `cd web && npm run build && grep -c "og:\|twitter:\|canonical\|theme-color" web/dist/index.html`; then `cat web/dist/index.html`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Depends on a real image asset. If IMP-030 is landing in the same cycle, the 1280px feed capture it produces can double as the OG image — copy it into `web/public/` rather than linking `images/`, which is outside the build's `public/` root.

### IMP-125 — Pin or document the date locale
- **Status:** NEEDS-HUMAN
- **Category:** Internationalization
- **Type:** docs
- **Area / files:** `web/src/components/PaperCard.tsx:20-30` (`formatDate` → `toLocaleDateString(undefined, ...)`), `web/src/App.tsx:106-116` (`formatGeneratedAt`, the same call), `web/index.html:2` (`<html lang="en">`)
- **Intent:** The interface is English-only (`<html lang="en">`, all strings inline), but dates render in the *visitor's* locale with no way to predict or test the format. Two identical helpers do the same thing in two files, so a locale decision has to be made twice.
- **Acceptance criteria:**
  1. The date-formatting decision is explicit: either the locale is pinned (for example `toLocaleDateString("en-US", ...)`) so output is testable and matches the rest of the English UI, or it is left locale-dependent and that is documented in the code with a reason.
  2. Both call sites make the same choice, and the duplicated helper is consolidated into one place.
  3. `cd web && npm run typecheck && npm run build` succeed, and a rendered card date is unchanged from the baseline in the reference locale.
- **Verification method:** `cd web && npm run build`; then in a browser set `navigator.language = "de-DE"` and confirm the card date format either matches the baseline (pinned) or changes predictably (documented). Screenshot to `.improve/artifacts/IMP-125/feed-date-locale-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Risk `med` because pinning the locale is a visible behavior change for non-US visitors. This is the only genuinely applicable i18n item in the repo: the site is English-only by design and has no message catalog, so proposing a localization framework would be out of scope. The related machine-readable-date gap is folded into the acceptance criteria for the hero date in this item's own verification.
**NEEDS-HUMAN — decision required.** Criterion 1 offers "pin the locale" or "leave it visitor-dependent and document why". Pinning to `en-US` is a visible change for every non-US reader of a research paper feed, and is the owner's call, not an implementer's.

### IMP-126 — Add a `--log-level` flag to `build_index.py`
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** improvement
- **Area / files:** `scripts/build_index.py:40` (`logging.basicConfig(level=logging.INFO, ...)` at import), `scripts/build_index.py:248-275` (`parse_args`), `scripts/paper-collector.py:18`
- **Intent:** Log verbosity is fixed at `INFO` at import time, with no way to quiet the per-category progress lines or turn them up. In CI the `INFO` noise is interleaved with the run summary, and a local `--max-per-category 2` smoke run emits as much output as a full production run.
- **Acceptance criteria:**
  1. `--log-level` accepts `DEBUG`/`INFO`/`WARNING`/`ERROR` and is applied inside `main()`, not at import.
  2. `python scripts/build_index.py --help` lists the flag with its accepted values.
  3. A test in `tests/test_build_index.py` asserts the flag parses and that the level is applied to the module logger.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 scripts/build_index.py --log-level ERROR --category cs.CV --max-per-category 2 --out-dir /tmp/rpf-log` prints only errors, and `--help` shows the flag.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Pairs with IMP-055 (move `basicConfig` out of import scope); without that, the flag cannot take effect because the import-time call already configured the root logger.

### IMP-164 — Treat an empty-string URL as "no URL" rather than unsafe
- **Status:** TODO
- **Category:** Data validation
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:86-88` (`isHttpUrl`, where `String("").trim()` is `""` and fails the regex), `web/src/lib/collections.ts:96-101` (`hasSafeUrls`, which therefore rejects the paper), `web/src/lib/collections.ts:249-257` (`parseExportPayload`'s `filter(isPaper).filter(hasSafeUrls)` chain)
- **Intent:** `hasSafeUrls` already exempts `null` and `undefined` — "absent, not hostile" — after IMP-151b. An **empty string** falls on the wrong side of that line: `""` is present, so it goes to `isHttpUrl`, whose `String(value).trim()` is still `""`, which fails `/^https?:\/\//`, so the whole paper is discarded. The user exports 5 papers, imports a file where one was hand-edited to `"absUrl": ""`, and silently gets 4 with no message. This is the same data-loss shape as the `null` regression that IMP-151b had to fix, and it is worth closing now rather than letting a verifier rediscover it. Latent rather than live: `build_index.py:113-114` uses `getattr(result, …, None)`, so the producer emits `null`, never `""`.
- **Acceptance criteria:**
  1. `hasSafeUrls` treats an empty or whitespace-only url the same as `null`/`undefined` — exempt, not hostile — so the paper is kept. The exemption is whitespace-trimmed, so `"   "` behaves like `""` and not like `" javascript:alert(1)"`, which must still be rejected.
  2. `isHttpUrl` itself is **unchanged**. It answers "is this string an `http(s)` url", and `""` is correctly not one; the fix belongs in the exemption set at `hasSafeUrls`, which is exactly the split IMP-151b's verifier insisted on ("widens the *exempt* set … leaves the *accepted* set exactly as IMP-001 defined it"). Widening `isHttpUrl` to return `true` for `""` would re-open the hole IMP-001 closed.
  3. New tests in `web/src/lib/__tests__/collections.test.ts` assert a payload paper with `"absUrl": ""` is **retained**, one with `"pdfUrl": "   "` is retained, and one with `"absUrl": " javascript:alert(1)"` is still dropped beside them.
  4. `cd web && npm run typecheck && npm test` passes with no pre-existing expectation weakened, and the 41-payload attack table in `.improve/reports/verify-IMP-151b.md` §7 still yields **zero** unsafe hrefs.
- **Verification method:** `cd web && npm run typecheck && npm test`; then import a payload with an empty-string `absUrl` and confirm the paper appears in the collection; then re-run the `javascript:`/leading-space import and confirm the paper is dropped and no `javascript:` href exists in the DOM.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** OBS-A in `.improve/reports/verify-IMP-151b.md`, which called it "latent, not live" and "arguably correct-by-design" — that judgement is the reason this sits at 8.0 rather than higher. The argument for doing it anyway: the exemption set already contains `null` and `undefined` for exactly the same reason, so an empty string is an inconsistency in a rule rather than a new rule. The argument against: an export carrying `"absUrl": ""` may signal a producer that is not `build_index.py`, and silently keeping such a paper is more permissive than silently dropping it. Whichever way the implementer decides, decide it **explicitly** and record it in the PR body; the acceptance criteria above take the permissive side because it matches IMP-151b's stated posture. Do not fold this into IMP-153, which filters the `localStorage` read path; this is the import path.

### IMP-165 — Reject tab, LF and CR inside `isHttpUrl`
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:86-88` (`isHttpUrl`, the single regex to tighten), `web/src/components/PaperCard.tsx:33-35` (`safeHref`, which trims and then hands the raw string to `href`), `web/src/lib/__tests__/collections.test.ts` (the assertion set from IMP-155)
- **Intent:** `isHttpUrl` accepts `"https://x\n@evil.example"` and `safeHref` writes that raw string into the `href`; Chromium silently strips the newline and resolves it to `https://x@evil.example/` — userinfo `x`, **host `evil.example`**. The `^https?://` anchor makes this *not* an XSS: the scheme is always `http` or `https`, because browser URL parsing only ever removes U+0009/U+000A/U+000D and none of those appear in the literal `https`. It is a phishing / defence-in-depth gap: a reader sees a plausible arXiv link in the visible text and lands on a different host. The verifier measured it and explicitly ruled it out of scope for the regression it was reviewing, noting that a hardening "is behaviour-changing and belongs to its own item" — this is that item.
- **Acceptance criteria:**
  1. `isHttpUrl` returns `false` for any candidate containing `\t`, `\n` or `\r` anywhere in the string, in addition to its existing prefix requirement. Equivalently and preferably, `safeHref` refuses to emit a url containing them — pick one place, say which in the PR body, and do not leave the two disagreeing.
  2. `String(value).trim()` still runs **before** the prefix test, so `"\thttps://ok.example"` and `" https://ok.example"` remain accepted; only *interior* control characters are newly rejected. Getting this backwards would drop legitimate urls.
  3. New tests in `web/src/lib/__tests__/collections.test.ts` assert `isHttpUrl` is `false` for `"https://x\n@evil.example"`, `"https://x\t@evil.example"` and `"https://x\r@evil.example"`, and still `true` for `"https://arxiv.org/abs/2401.00001"` and `"http://arxiv.org/abs/2401.00001"` — the `http` case matters because `build_index.py:111` emits it for every live card.
  4. A named constant or a single named predicate holds the control-character set, so IMP-155's assertions and this one reference the same rule rather than two regexes.
  5. `cd web && npm run typecheck && npm test && npm run build` pass.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in the browser import a payload whose `absUrl` is `"https://arxiv.org/abs/2401.00001\n@evil.example"` and confirm `[...document.querySelectorAll('a')].every(a => !(a.getAttribute('href') || '').includes('@evil.example'))` is `true`; then import the committed 2,812-paper index and confirm the first card's `href` is still `http://arxiv.org/abs/…` and renders — screenshot to `.improve/artifacts/IMP-165/feed-normal-absurl-desktop-1280.png` against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Risk `med` because this is the one change in this group that alters what the app accepts on a path that currently works: a paper whose url carries an interior control character would stop rendering a link. Criterion 2 is the safety valve — if an implementer misreads the trim ordering they will reject every whitespace-padded url instead. Impact is 2 and confidence 4 deliberately: the verifier proved the *mechanism* in real Chromium but also proved the scheme cannot change, so this is defence in depth and the score must not be inflated to suggest an open XSS. OBS-B in `.improve/reports/verify-IMP-151b.md`, which stated the obligation this item discharges. Do not tighten the scheme requirement in the same change — `http` must stay accepted until IMP-152 has shipped and the shards have been rebuilt.

## Tier 7.5

### IMP-127 — Precompute a lowercased search haystack
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/lib/search.ts:55-58` (three `toLowerCase()` calls plus a combined template string per paper per keystroke), `web/src/App.tsx:207-224` (`visiblePapers` memo)
- **Intent:** `scorePaper` rebuilds the lowercase title, authors, and abstract — and a combined string joining all three — for every paper on every keystroke. At the index actually on disk (2,812 papers, 1,408,061 characters of abstract) that is ~1.4 M characters lowercased three times over plus a combined copy per keystroke — roughly 3.9 MB of string allocation — with no precomputed index and no `useDeferredValue`. The cost is linear in index size, so it degrades as retention grows.
- **Acceptance criteria:**
  1. A precomputed normalized representation (a lowercased haystack, or an index built once per `papers` change) is used by `scorePaper` instead of rebuilding it per call.
  2. Scoring results are **identical** for the same papers and tokens — a test in `web/src/lib/__tests__/search.test.ts` asserts the ranking output matches a fixed expectation for a fixture set.
  3. `cd web && npm run typecheck && npm test && npm run build` pass, and the built JS grows by less than 2 kB.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then at 1280px run a fixed query against a full index and screenshot the result order to `.improve/artifacts/IMP-127/feed-search-ranking-desktop-1280.png`, comparing the top 50 titles against the pre-change run — the order must be identical, since a scoring change alters user-visible results.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 7.5
- **Notes:** Risk `med` because the search index changes the shape of the scored data, so a subtle bug changes result order for every user without failing a test. Screenshot-verify the ranking, do not assume.

### IMP-128 — Debounce the `saveState` writes
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:231-235` (the effect keyed on `[collections]`, no debounce), `web/src/lib/collections.ts:279-292` (two `JSON.stringify` of all collections plus every stored snapshot)
- **Intent:** Every dispatch synchronously re-serializes the entire state on the main thread — potentially hundreds of KB — and then writes it. One checkbox click costs a full serialize of every saved paper snapshot, and the two `setItem` calls also contend for quota (the failure mode IMP-011 surfaces).
- **Acceptance criteria:**
  1. Writes are coalesced so a burst of dispatches in one tick produces a single `saveState` call.
  2. The write still happens promptly after the last change (a trailing debounce, not a lost write), and the effect still runs on unmount-flush or a `beforeunload` if that is the chosen mechanism.
  3. `saveState`'s existing tests in `web/src/lib/__tests__/collections.test.ts:303-306` still pass, and the debounce is implemented in `App.tsx` or a hook, not inside the pure `collections.ts` module.
- **Verification method:** `cd web && npm run typecheck && npm test`; then toggle three collections' checkboxes in quick succession and confirm one write in the DevTools Application panel rather than three, and confirm a reload still restores all three.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 7.5
- **Notes:** Risk `med` because debouncing persistence can lose the last change if the page unloads mid-debounce; the flush path must be explicit. This item must not move persistence into `collections.ts` — the profile's testability argument for the explicit `Storage` injection depends on `saveState` staying a plain function.

### IMP-129 — Add component tests for `PaperCard`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/components/__tests__/PaperCard.test.tsx` (extend the file created by IMP-037), `web/src/components/PaperCard.tsx:41-51,79-96,111-167`
- **Intent:** `PaperCard`'s behavior is entirely untested: the save-menu gating at `:41-42`, the abstract preview/expand threshold at `:44-51`, the truncation note at `:88-96`, and the create-and-save form at `:144-165`. The optional-props design is the component's most valuable property and nothing proves it works.
- **Acceptance criteria:**
  1. Tests assert: with no save props, no "Save to collection" control renders; with all four save props, it does.
  2. A test asserts "Show more" appears only when the abstract exceeds the preview budget, and that expanding reveals the full text.
  3. A test asserts the truncation note renders when `abstractTruncated` is true and not otherwise.
  4. A test drives the create-and-save form and asserts `onCreateCollection` receives the trimmed name and the paper.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the PaperCard test file to report at least 8 tests.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-037
- **Priority score:** 7.5
- **Notes:** Follow the 1:1 mirror convention. `PaperCardProps` is deliberately not exported, so the tests must render the component rather than construct props against a type.

### IMP-130 — Add component tests for `FeedControls`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/components/__tests__/FeedControls.test.tsx` (new), `web/src/components/FeedControls.tsx:50-104` (the three chip groups)
- **Intent:** The relevance-disabled-when-empty-query logic at `:92-99` and the `aria-pressed` state of every chip are untested. The relevance/empty-query contradiction (IMP-008) is exactly the kind of bug a chip-state test catches.
- **Acceptance criteria:**
  1. Tests assert the Relevance chip is `disabled` and `aria-pressed="false"` with an empty query, and enabled with a non-empty one.
  2. Tests assert every chip in each group carries `aria-pressed` and that activating one calls the matching handler with the right value.
  3. Tests assert the result count renders with the corrected formatting and pluralization from IMP-108.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the `FeedControls` test file to report at least 6 tests.
- **Effort:** M    **Risk:** low
- **Depends on:** IMP-037
- **Priority score:** 7.5
- **Notes:** The component is presentational and takes everything through props, so no store or router setup is needed.

### IMP-131 — Add component tests for `CollectionsView`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/components/__tests__/CollectionsView.test.tsx` (new), `web/src/components/CollectionsView.tsx:165-180` (`handleFile`), `:192-202` (create form), `:99-121` (rename/delete/export)
- **Intent:** The import file-parsing and error paths, the rename/cancel flow, the delete confirmation, and the export disabled state are all untested. The import error path is the one with a real user-visible contract (`role="alert"` plus the three distinct messages at `:173,178`).
- **Acceptance criteria:**
  1. Tests cover: a valid export file calls `onImport`; an invalid JSON file renders the "Could not read that file as JSON" alert; a non-collection JSON renders "That file does not look like a collection export".
  2. Tests cover: Rename swaps the header for the form, Save calls `onRename` with the trimmed name, Cancel restores the original name; Delete calls `onDelete` only after `window.confirm` returns true.
  3. Tests assert the Export button is disabled when the collection is empty.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the `CollectionsView` test file to report at least 8 tests. Compare the alert copy against `.improve/artifacts/baseline/baseline-collections-import-error-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-037
- **Priority score:** 7.5
- **Notes:** Risk `med` because `window.confirm` must be stubbed, and stubbing it incorrectly makes the delete tests pass vacuously. Assert both the confirmed and the cancelled branch.

### IMP-163 — Close the three IMP-024 extraction-regression test gaps
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_paper_collector.py:195` (`_write_attack_archive`, whose `../../../pwned_deep.txt` member escapes the test's own sandbox), `tests/test_paper_collector.py:230-236` (`_files_outside`, an `os.walk(self.base)` that cannot see an escape into `$TMPDIR`), `tests/test_paper_collector.py:334` (the log assertion that accidentally catches one mutant), `scripts/paper-collector.py:46-50` (`rejection_reason`'s docstring, whose `commonpath`-not-`startswith` claim is unpinned)
- **Intent:** IMP-024's test suite is genuinely load-bearing — 15 of 16 mutants caught — but three holes remain, and two of them are false confidence rather than mere absence. First, `_files_outside` only walks `self.base`, while the attack archive's `../../../pwned_deep.txt` member resolves from `base/extracted/A Paper Title` to **`$TMPDIR/pwned_deep.txt`**, outside `self.base`; the verifier proved the blind spot by showing mutant M16 still wrote that file into the real temp directory even though the suite passed. Second, the docstring's claim that `commonpath` stops `/…/Paper` matching `/…/Paper-evil` is not pinned — mutant M10 (`commonpath(...) != '/'`) passes all 44 tests, so nothing would catch a regression to a `startswith` prefix check. Third, no test pins the `errorlevel` trap: a bare `extractall(dest, filter="data")` raises on the first rejected member and discards every later one, so a regression to that form would silently lose a legitimate arXiv tarball's tail.
- **Acceptance criteria:**
  1. The escape assertion covers the real escape surface. Either a sentinel member is targeted inside `self.base` (e.g. `../pwned_deep.txt` with a dedicated `self.sentinel/pwned_deep.txt` destination), or `$TMPDIR` is snapshotted around the extraction and diffed, or the absolute `$TMPDIR` path is asserted not to exist afterwards. Whichever is chosen, no file may be created outside the test's own tempdir by **any** code path — the verifier had to delete the stray file itself.
  2. A sibling-prefix member is added to `_write_attack_archive` — `../A Paper Title-evil/sibling_evil.txt` — and the test asserts it is rejected. Deleting the `commonpath` call in favour of a `startswith` prefix check must turn this test red; prove it in a `/tmp` copy and record the failed-test count.
  3. A test builds an archive whose **last** member is hostile and whose earlier members are benign, and asserts every benign member was extracted and exactly one warning names the hostile one. This pins the pre-screen design (pass `members=safe_members` to `extractall`) against a regression to a bare `extractall(dest, filter="data")`, which aborts on the first rejection.
  4. The same three assertions are exercised on the forced-fallback branch (`TARFILE_HAS_FILTER` stubbed to `False`) as well as the `filter="data"` branch, so the two code paths are held to one contract.
  5. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` passes (44 pre-existing + the new cases), **none of them skipping**, and no pre-existing expectation is weakened or removed.
  6. All escape targets stay inside the test's own `tempfile` sandbox, so a reverting mutant cannot litter `$TMPDIR` — this is the claim `impl-IMP-024.md:126` made and the verifier disproved.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `ls $TMPDIR | grep -i pwned` must print nothing after a full run; then in a `/tmp` copy revert each of the three shapes in turn (M10's `commonpath` swap, the `filter="data"` bare call, and the `is_inside` relaxation) and confirm the suite goes red each time, recording the counts in the PR body.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 7.5
- **Notes:** Effort is `M`, not `S`, because all three gaps must be closed and the fallback branch driven separately — three test changes plus a second code path, not one assertion. Impact is 3 and confidence 5: every claim here was measured by mutation testing on five interpreters, not inferred. The value is entirely criterion 6 — an escape test that cannot see its own escape is worse than no test, because it converts a live hole into a documented pass. R2 and R3 in `.improve/reports/verify-IMP-024-r2.md`, D1 and D9 in `.improve/reports/discovered-IMP-024.md`. Test-only: no file under `scripts/` may change except the docstring wording in criterion 2's target, and a docstring change must be paired with the test that makes it true.

## Tier 6.7

### IMP-132 — Add component tests for `App`'s load, error, and retry states
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/components/__tests__/App.test.tsx` (new), `web/src/App.tsx:148-166` (manifest effect), `:364-382` (the three top-level states), `:408-435` (error, loading, list)
- **Intent:** `App.tsx` is 458 lines and entirely untested: the three-state rendering (loading, error, results), the recency effect's cancellation, and the retry path. The defects in IMP-007, IMP-015, and IMP-016 all live here, so without this the render layer can regress silently.
- **Acceptance criteria:**
  1. Tests cover all three manifest states: loading (`role="status"` with the loading text), error (the `.panel--error` block), and loaded (the hero with `totalPapers`).
  2. A test covers the paper-load failure path and asserts the message is **not** the "no papers are available" copy.
  3. A test clicks the "Try again" control and asserts a second fetch is issued.
  4. `fetch` is stubbed in every test; no test touches the network.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the `App` test file to report at least 6 tests.
- **Effort:** L    **Risk:** med
- **Depends on:** IMP-037, IMP-143
- **Priority score:** 6.7
- **Notes:** Effort is `L` because `App` owns hash routing, a reducer, blob/anchor/revoke export plumbing, and a `PaperIndex` held in a ref; stubbing `fetch` and seeding `location.hash` is most of the work. IMP-143's `web/src/lib/urlState.ts` should land first so seeding `location.hash` in these tests is a one-liner against a pure function rather than a `window.history` dance.

## Tier 6.0

### IMP-133 — Add per-paper deep links
- **Status:** TODO
- **Category:** UX flows & interactivity
- **Type:** new-feature
- **Area / files:** `web/src/App.tsx:38-59` (`readHash`), `web/src/App.tsx:61-85` (`writeHash`), `web/src/components/PaperCard.tsx:54-60` (the card article)
- **Intent:** There is no per-paper anchor, so an individual paper cannot be linked, bookmarked, or cited from inside the tool, and `#main` is the only fragment target. For a research feed this is a real sharing gap.
- **Acceptance criteria:**
  1. A `#paper=<id>` hash parameter is read on load and written when a card's link is activated, and the target card is scrolled into view and visually marked.
  2. An unknown `paper` id in the hash produces a clear "not in this view" state rather than a silent no-op.
  3. The parameter round-trips through `writeHash` and survives a reload, and `web/src/lib/__tests__/urlState.test.ts` asserts the round trip for a `#paper=<id>` hash.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px activate a card's link, reload, and confirm the same card is marked and scrolled to. Screenshot to `.improve/artifacts/IMP-133/feed-paper-deeplink-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-143
- **Priority score:** 6.0
- **Notes:** Risk `med` because it adds a hash parameter to a hand-rolled parser. That is exactly why it depends on IMP-143, which extracts and covers `readHash`/`writeHash` first. Scope note: this is a feature, not a defect — it can be deferred without leaving the app broken.

### IMP-134 — Pin the GitHub Actions to commit SHAs
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:12,13,27,28` and `.github/workflows/deploy.yml:24,26,36,50,52,65` (all actions referenced by mutable `@v4`/`@v5` tags)
- **Intent:** Every action is pinned to a mutable major tag, so a compromised or re-pointed tag silently changes what runs in a workflow that has `pages: write` and `id-token: write`. The profile confirms secret handling is otherwise clean, so this is the only supply-chain surface in the repo.
- **Acceptance criteria:**
  1. Every `uses:` in both workflows references a full 40-character commit SHA with a trailing `# vN` comment naming the tag.
  2. Both workflows still run green.
  3. The SHAs are the ones for the currently referenced major versions, verified against the upstream release.
- **Verification method:** `grep -n "uses:" .github/workflows/ci.yml .github/workflows/deploy.yml` and confirm every line ends in a 40-hex SHA; then run both workflows once on a branch.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 6.0
- **Notes:** Risk `med` is maintenance, not security: pins must be updated deliberately, and dependabot (IMP-087) is what will keep them current. Do not combine this with a version bump in the same PR.

### IMP-135 — Add a shard and manifest cache TTL
- **Status:** TODO
- **Category:** Performance
- **Type:** improvement
- **Area / files:** `web/src/lib/paperIndex.ts:62,64` (`manifestPromise`, `shardCache` live for the page's lifetime), `web/src/lib/paperIndex.ts:77` (`cache: "no-cache"` on the manifest) vs. `:105` (default caching on shards)
- **Intent:** The two caching policies are inconsistent for two files from the same deploy, and neither expires. A long-lived tab never sees a new index after a deploy, and the manifest is force-revalidated while its shards are not.
- **Acceptance criteria:**
  1. A TTL (or a check against `manifest.generatedAt`) bounds how long a memoized manifest and a cached shard are trusted.
  2. The manifest and its shards use one consistent caching policy, stated in a comment.
  3. A test in `web/src/lib/__tests__/paperIndex.test.ts` asserts a second call after the TTL issues a fresh `fetch`, and that the existing shard-cache-reuse test (`:182-192`) still passes unchanged.
- **Verification method:** `cd web && npm run typecheck && npm test`; expect the file to report 11 tests (10 pre-existing + 1 new).
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 6.0
- **Notes:** Keep the existing within-session cache benefit — the point is bounding staleness, not removing caching. The shard-cache-reuse test asserts `fetch` call counts, so a TTL change must not make it flaky.

### IMP-136 — Add word-boundary-aware search scoring
- **Status:** TODO
- **Category:** Correctness
- **Type:** improvement
- **Area / files:** `web/src/lib/search.ts:62,68-74` (three `String.includes` calls), `web/src/lib/search.ts:56` (authors joined with a single space)
- **Intent:** Matching is pure substring, with no word boundaries and no stemming, so `net` matches "network" and `inert` matches "inertia". It also mis-assigns the weight tier: a term that appears only as a substring of an author's name counts as an *author* match at weight 2, so a title/abstract-only relevance boost is silently lost. Neither behavior is documented in `readme.md:19-20`.
- **Acceptance criteria:**
  1. Matching is word-boundary aware (or prefix matching within a word) and the README's search-semantics bullet describes the actual behavior.
  2. The weight tier is assigned by where a whole word matches, not by a substring of an author's name.
  3. A multi-word author query can span a name boundary — authors are no longer joined into one string for matching purposes.
  4. A test in `web/src/lib/__tests__/search.test.ts` covers each of these, and the 12 existing tests still pass with their expectations intact.
- **Verification method:** `cd web && npm run typecheck && npm test`; then at 1280px run `net`, `inert`, and a two-word author query and screenshot each result set to `.improve/artifacts/IMP-136/feed-word-boundary-desktop-1280.png` against a pre-change capture.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 6.0
- **Notes:** Risk `med` because this **changes user-visible result order for every query**. Screenshot-verify against a pre-change capture, and consider shipping it behind the same release as IMP-127 so the two ranking changes land together.

## Tier 5.0

### IMP-137 — Add an ESLint config and an `npm run lint` script
- **Status:** TODO
- **Category:** Tooling, linting, formatting
- **Type:** tooling
- **Area / files:** `web/package.json:6-13` (no `lint` script), `web/package.json:18-25` (no `eslint`, `typescript-eslint`, or `eslint-plugin-react-hooks`), `web/` (no `eslint.config.*`)
- **Intent:** `npm run lint` does not exist, so CI has no way to catch the code it cannot see: an unused prop (`renderAction` at `web/src/components/PaperList.tsx:20`), a no-op override (`web/src/lib/collections.ts:121`), a mutable module singleton, and unread type fields (`web/src/lib/types.ts:18-25`). `tsc --noEmit` is the only static analysis and cannot detect any of those.
- **Acceptance criteria:**
  1. `eslint` with `typescript-eslint` and `eslint-plugin-react-hooks` is a devDependency in `web/package.json` and `web/package-lock.json`, added only via `npm install`.
  2. A flat `eslint.config.*` exists in `web/` and `npm run lint` exits 0.
  3. The rules cover the repo's stated conventions: double quotes, semicolons, trailing commas, and the React hooks rules. No formatting rule set is added (see the Notes).
  4. The runtime dependency set is unchanged (`react` + `react-dom` only).
- **Verification method:** `cd web && npm install --save-dev eslint typescript-eslint eslint-plugin-react-hooks && npm run lint` → exit 0; then `cd web && npm run typecheck && npm test && npm run build` still pass; `npm ls --depth=0` shows the three new dev packages.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Dependency cost, as required by the profile: three dev-only packages, none shipped to Pages. Risk `med` because turning on new rules will report existing violations — that is IMP-138's work, and the two should land together. Do **not** add Prettier or a formatting rule set: the profile forbids mass-reformatting, and there is no formatter today, so a reformat would produce a diff no tool has validated.

### IMP-138 — Fix the violations the new linter finds
- **Status:** TODO
- **Category:** Tooling, linting, formatting
- **Type:** improvement
- **Area / files:** `web/src/components/PaperList.tsx:20` (unused `renderAction`), `web/src/lib/collections.ts:121` (the `name:` override), `web/src/lib/collections.ts:33` (the shared `EMPTY_STATE` singleton), `web/src/lib/types.ts:18-25` (fields written but never read)
- **Intent:** Enabling ESLint surfaces real dead code. Each finding needs a decision — delete it, use it, or document why it stays — rather than a blanket disable. Doing this separately from IMP-137 keeps the linter-adoption change reviewable.
- **Acceptance criteria:**
  1. Every violation the config reports is either fixed or has a narrowly scoped, commented disable with a reason; no file-level or rule-level blanket disable is added.
  2. `cd web && npm run lint` exits 0 and `npm run typecheck && npm test && npm run build` all pass.
  3. The unread fields in `web/src/lib/types.ts:18-25` (`ShardManifestEntry.week`/`.from`/`.count`, `ShardFile.week`/`.from`, `Paper.updated`, `IndexManifest.retentionDays`) are each either consumed by the UI or explicitly retained as part of the wire contract, with the decision recorded in the PR body.
  4. The rendered feed and collections views are unchanged; screenshots at 1280px and 390px match the baseline.
- **Verification method:** `cd web && npm run lint` → exit 0 with no warnings; then `cd web && npm run build` and screenshot the feed to `.improve/artifacts/IMP-138/feed-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-137
- **Priority score:** 5.0
- **Notes:** Risk `med` because some findings are judgment calls about a hand-maintained wire contract. Do not "fix" a finding by deleting a field from `web/src/lib/types.ts` that `scripts/build_index.py` legitimately emits — that is the Python→TypeScript drift IMP-094 exists to prevent.

### IMP-139 — Ship the full abstract so "Show more" can reveal it
- **Status:** TODO
- **Category:** Missing features natural to this repo's purpose
- **Type:** new-feature
- **Area / files:** `scripts/build_index.py:48-53` (`truncate_abstract`), `scripts/build_index.py:97-114` (`record_from_result`), `web/src/lib/types.ts:1-13` (`Paper`), `web/src/components/PaperCard.tsx:44-49,79-96`
- **Intent:** "Show more" can never reveal more than ~500 characters because the pipeline truncates before the browser sees the text, and the only full abstract in existence is on arXiv. For a research feed, reading the actual abstract without leaving the page is the core use case, and today the app cannot serve it.
- **Acceptance criteria:**
  1. The pipeline emits the untruncated abstract alongside the existing truncated preview — for example a new `abstractFull` field — and `web/src/lib/types.ts` declares it, so the wire contract grows in both places in the same change.
  2. "Show more" reveals `abstractFull` when present and falls back to the existing behavior when absent, so old indexes keep working.
  3. The "Abstract truncated" note changes to link out only when the *pipeline* truncated, and says so accurately.
  4. The measured size delta is recorded, not estimated. Baseline on disk: `index.json` names 2 shards totalling 2,631,708 bytes, of which 1,408,061 bytes are the already-truncated abstracts. The PR body states the post-change `du -sk web/public/data` and the percentage increase, and `readme.md:27-28`'s scope statement is re-checked against the new payload.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and `cd web && npm run typecheck && npm test && npm run build`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 300` and compare `du -sh web/public/data` against the pre-change size; screenshot a fully expanded card to `.improve/artifacts/IMP-139/feed-abstract-full-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** L    **Risk:** med
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Effort is `L` because this is a wire-format change across two languages plus a payload-size decision plus the shard-weight impact on the browser. The cheaper precursor — making the current two-stage truncation explicit and honest — is IMP-119. If the index size proves unacceptable, the alternative is to raise `--abstract-chars` and say so; record which path was taken.

### IMP-140 — Remove the dead `name:` override and the dead `yielded` counter
- **Status:** TODO
- **Category:** Code health & refactoring
- **Type:** improvement
- **Area / files:** `web/src/lib/collections.ts:121` (`{ ...payload.collection, name: payload.collection.name, paperIds }` — the explicit key overrides the identical spread value), `scripts/arxiv_common.py:51,55-57` (a `yielded` counter that duplicates `arxiv`'s own `islice` limit)
- **Intent:** Two pieces of dead code that mislead a reader about intent. The `name:` override is a leftover from an unimplemented rename/dedupe idea; the `yielded` counter can never fire before `arxiv`'s own limit, so `test_stops_after_max_results` passes on either implementation and the redundancy is untestable by design.
- **Acceptance criteria:**
  1. The `name:` override is removed and the spread is the only source of `name`, with the import behavior unchanged.
  2. The `yielded` counter and its guard are removed, and `test_stops_after_max_results` (`tests/test_arxiv_common.py:82-88`) still passes — proving `arxiv.Search(max_results=...)` alone enforces the cap.
  3. No behavior change on either path: `mergeImport` and `iter_results` produce identical results.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and `cd web && npm run typecheck && npm test`; then `grep -n "yielded" scripts/arxiv_common.py` returns nothing and `grep -n "name: payload.collection.name" web/src/lib/collections.ts` returns nothing.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** The profile warns against cosmetic churn, and this is the smallest item in the backlog — it is here because both pieces actively mislead, and because removing them is a prerequisite for ESLint reporting zero findings honestly (IMP-138). The `import` version check that belongs in the same neighborhood is IMP-060.

## Tier 4.0

### IMP-141 — Add an intermediate layout breakpoint
- **Status:** NEEDS-HUMAN
- **Category:** Responsiveness
- **Type:** improvement
- **Area / files:** `web/src/styles.css:720-753` (the only breakpoint, `@media (max-width: 520px)`), `web/src/styles.css:20` (`--max-width: 1000px`), `web/src/styles.css:223-227` (`.controls__row`, `display: flex; flex-wrap: wrap;` over three unequal fieldsets)
- **Intent:** There is one breakpoint at 520px and a max content width of 1000px, so everything between is an unserved range. In that band the three control fieldsets have unequal intrinsic widths and the chip rows wrap raggedly, which recon recorded as a visible layout problem.
- **Acceptance criteria:**
  1. At 768px and at 900px the controls row lays out without ragged wrapping, and no horizontal overflow occurs (`scrollWidth === clientWidth`).
  2. No change at 390px, 520px, or 1280px relative to the baseline screenshots.
  3. The new rule lives in `web/src/styles.css` next to the existing `@media` block, and no inline styles are introduced.
- **Verification method:** `cd web && npm run build`; then at 390, 520, 768, 900, and 1280 px assert `document.documentElement.scrollWidth === clientWidth` and screenshot each to `.improve/artifacts/IMP-141/feed-{390,520,768,900,1280}.png`, comparing the endpoints against `.improve/artifacts/baseline/baseline-feed-mobile-390.png` and `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 4.0
- **Notes:** Risk `med` because adding a breakpoint touches the shared token-driven layout, and the profile's de-facto viewports are 1280 and 390 — a new intermediate layout is untested ground. Verify at least three widths before merging, and do not re-indent the existing `520px` block.
**NEEDS-HUMAN — design decision required.** This is a subjective layout overhaul in a width band the repo has never been reviewed at. The profile's de-facto viewports are 1280 and 390 with one breakpoint at 520px, so there is no baseline to improve against and no evidence that any reader is unserved between 520px and 1000px. A maintainer must first decide whether an intermediate layout is wanted at all.

### IMP-142 — Add `@media print` styles
- **Status:** NEEDS-HUMAN
- **Category:** Missing features natural to this repo's purpose
- **Type:** new-feature
- **Area / files:** `web/src/styles.css` (no `@media print` block), `web/index.html:1-23` (no print stylesheet link)
- **Intent:** Printing a reading list emits the sticky translucent header, the `backdrop-filter`, hover transforms, and a full page of truncated abstracts with no pagination or link targets — useless for the one thing a researcher might print a paper list to do.
- **Acceptance criteria:**
  1. A `@media print` block hides the header, nav, filters, footer chrome, and every save/expander control, and renders each paper's title, authors, date, categories, abstract, and arXiv link.
  2. The paper list avoids breaking a card across pages, and the title link's URL is printed or the abs URL is shown.
  3. No change to the screen rendering; the built CSS grows by less than 1 kB.
- **Verification method:** `cd web && npm run build`; then in a headless print preview of `http://localhost:5199/research-paper-feed/` at 1280px, confirm the header and controls are absent and each entry is readable, and save the print preview to `.improve/artifacts/IMP-142/feed-print-preview.pdf`.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 4.0
- **Notes:** Lowest-priority item in the backlog and honestly speculative about whether anyone prints this. It is included only because it is a natural capability for the repo's purpose and costs a single stylesheet block.
**NEEDS-HUMAN — product decision required.** The item's own Notes concede it is "honestly speculative about whether anyone prints this". No reader of a browser-based research feed is known to print it. Needs an owner decision before spending a change on it.

