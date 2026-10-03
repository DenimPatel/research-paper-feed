# IMPROVEMENT BACKLOG — `research-paper-feed`

Recon 2026-10-02 against baseline SHA `1c075b3`. Every item below cites a real path in this
repository and, where the defect is behavioural, an observed symptom from
`.improve/REPO_PROFILE.md` or the six `.improve/reports/recon-*.md` files. No invented
problems, no speculative rewrites.

**Total items: 212** — 168 `TODO`, 8 `NEEDS-HUMAN`, 36 `DONE`. *(Counted from the `**Status:**`
lines on 2026-10-03. The previous reading, "208 — 167 TODO, 8 NEEDS-HUMAN, 33 DONE", was already
stale before this round by 3 TODO / 3 DONE: several items were flipped to `DONE` without the tally
being updated. Re-count rather than trusting either number.)*

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
`*.pyc`, `__pycache__/`, `.DS_Store`. `web/package-lock.json` is touched only by IMP-005,
IMP-137 and IMP-197, which all require it, and only via `npm install`. `readme.md` stays
lowercase. No proposed item renames `scripts/paper-collector.py`.

---

## Contents

| Tier | Score | Items |
| --- | --- | --- |
| 25.0 | `5 × 5 ÷ 1` | IMP-001 … IMP-005, IMP-143, IMP-151, IMP-154 |
| 20.0 | `5 × 5 ÷ 1` / `5 × 4 ÷ 1` / `4 × 5 ÷ 1` | IMP-007 … IMP-040 (IMP-022 absorbs the former IMP-047 and IMP-048; IMP-010 absorbs the former IMP-057), plus IMP-173 |
| 15.0 | `4 × 4 ÷ 1` … `3 × 5 ÷ 1` | IMP-042 … IMP-092 (less the merged ids), plus IMP-144, IMP-145, IMP-147, IMP-152, IMP-155 … IMP-157, IMP-174, IMP-175, IMP-192, IMP-193, IMP-205 |
| 12.5 | `5 × 5 ÷ 2` | IMP-006, IMP-041, IMP-093, IMP-094, IMP-204 |
| 12.0 | `4 × 4 ÷ 2` / `3 × 4 ÷ 1` | IMP-095 … IMP-097, IMP-146, IMP-153, IMP-158, IMP-159, IMP-176, IMP-177 |
| 10.0 | `3 × 3 ÷ 1` … `2 × 5 ÷ 1` | IMP-098 … IMP-115, IMP-148, IMP-150, IMP-160 … IMP-162, IMP-166 … IMP-171, IMP-189, IMP-190, IMP-194 … IMP-196, IMP-206 … IMP-209, IMP-212, IMP-213 |
| 8.0 | `2 × 4 ÷ 1` … `2 × 5 ÷ 2` | IMP-116 … IMP-126, IMP-149, IMP-164, IMP-165, IMP-178 |
| 7.5 | `3 × 5 ÷ 2` | IMP-127 … IMP-131, IMP-163, IMP-182, IMP-183, IMP-197 |
| 6.7 | `4 × 5 ÷ 3` | IMP-132 |
| 6.0 | `3 × 4 ÷ 2` / `2 × 3 ÷ 1` | IMP-133 … IMP-136, IMP-179 |
| 5.0 | `3 × 4 ÷ 3` / `2 × 5 ÷ 2` / `1 × 5 ÷ 1` | IMP-137 … IMP-140, IMP-172, IMP-180, IMP-181, IMP-184 … IMP-188, IMP-191, IMP-210, IMP-211, IMP-214, IMP-215 |
| 4.0 | `2 × 4 ÷ 2` | IMP-141 … IMP-142 |

IDs 47, 48 and 57 were retired by absorption and **must not be reused**; the live range is
IMP-001 … IMP-215 minus those three. (That line previously read "IMP-001 … IMP-204" and had been
lagging since IMP-205 landed.)

**NEEDS-HUMAN (not executable without a decision).** IMP-027 (deploy cadence), IMP-034 (delete
or rewrite the notebook), IMP-088 (adopt a failing security gate), IMP-096 (`robots.txt`
policy), IMP-125 (date locale), IMP-141 (intermediate breakpoint), IMP-142 (print stylesheet),
IMP-176 (may a malformed `published` silently drop a paper).

**Dependency-critical path.**
- IMP-143 (export and test the hash parser) gates IMP-008, IMP-132 and IMP-133. IMP-157 (batching-safe
  `applyState`) is a second prerequisite for those three, since they add bulk controls and keyboard
  shortcuts — the shapes that trip the bug.
- IMP-005 (make component testing possible) gates IMP-037, and IMP-037 gates IMP-129,
  IMP-130, IMP-131 and IMP-132.
- IMP-004 (fail a partial index) gates IMP-040.
- IMP-166 (pin the Node version and declare `engines`) gates IMP-213 (run the web suite on the Node
  CI uses), so the matrix names an explicit minor rather than the floating `"20"` it replaces. This
  mirrors IMP-097 → IMP-209 on the Python side; neither pair may be bundled into one PR.
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

### IMP-173 — Stop a JSON `null` manifest from hanging the app on "Loading the paper index…" forever
- **Status:** DONE
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:179-194` (`fetchManifest(...).then(...)` calls `setManifest(next)` and never `setLoading(false)`), `web/src/App.tsx:583-587` (`{!manifest && !error && (<p className="panel" role="status">Loading the paper index…</p>)}`, which does not consult `loading`), `web/src/lib/paperIndex.ts:183` (`return (await response.json()) as IndexManifest`)
- **Intent:** `fetchManifest` casts the parsed body without inspecting it, so a body of JSON `null` parses successfully and resolves to `null`. `App.tsx:182` then calls `setManifest(null)`, which React treats as no state change, so `manifest` stays `null`; the papers effect at `App.tsx:228-231` early-returns on `!manifest`; and because the `.then` branch at `:180-184` never calls `setLoading(false)` while the `.catch` branch at `:192` does, nothing ever flips. `App.tsx:583` renders purely on `!manifest && !error`, so the app sits on "Loading the paper index…" **forever** — no error, no `role="alert"`, and no "Try again" button, which exists only behind `error` (`App.tsx:557-580`). There is no recovery short of a manual reload.
- **Acceptance criteria:**
  1. `PaperIndex.fetchManifest` (`web/src/lib/paperIndex.ts:162-191`) rejects with `IndexUnavailableError` — kind `"malformed"` and the existing message at `:186` — when the parsed body is not a plain object (`body === null || typeof body !== "object" || Array.isArray(body)`). A body of JSON `null`, a JSON array, and a JSON string all take this path, not the success path.
  2. `web/src/App.tsx:180-184` calls `setLoading(false)` on the success branch as well as the `.catch` branch at `:192`, so no resolved-but-unusable manifest can leave `loading` true.
  3. A new test in `web/src/__tests__/App.loadFailure.test.tsx` stubs `fetch` for `index.json` to return a body of `null` (HTTP 200, `content-type: application/json`), asserts that once the promise settles no element matching `/Loading the paper index/` remains, and asserts the IMP-007 panel (`No paper index yet` plus a `Try again` `<button>`) is rendered. `cd web && npm run typecheck && npm test` passes: 15 test files, at least 233 tests (232 pre-existing plus the new cases), with no existing expectation weakened.
  4. The fix does not absorb IMP-098's scope: `fetchManifest` checks only that the body is a plain object; field-level checks (`categories`, `shards`, `totalPapers`) stay IMP-098's, and the implementer report must say so explicitly.
- **Verification method:** `cd web && npm run typecheck && npm test`; then `npm run build && npm run preview -- --port 5199 --strictPort`, copy `web/public/data/` to `/tmp/rpf-nullmanifest`, write the literal `null` into `/tmp/rpf-nullmanifest/index.json`, serve it, and confirm within 2 s that the "No paper index yet" panel with a working "Try again" replaces the indefinite spinner, and that pressing "Try again" re-requests `index.json`. Screenshot to `.improve/artifacts/IMP-173/feed-null-manifest-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-index-missing-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Pre-existing, not a regression: `git show fc77a40:web/src/App.tsx` has the same `.then` with no `setLoading(false)` and the same `{!manifest && !error && (` guard at `:378`. Found as R4 in `.improve/reports/regression-sweep-3.md` §2 and re-derived independently at `.improve/reports/verify-IMP-018.md` §9.2. **Cross-reference — do not duplicate:** the bare cast at `paperIndex.ts:183` is the same "data validated only by cast" family as profile defect WEB-07 and as IMP-098 (TODO, `10.0`); IMP-098 owns field-level validation, this item owns the deadlock, and criterion 4 forbids this item from taking IMP-098's place. The related silent-data-loss question for a malformed `published`, which `paperIndex.ts:294` filters out rather than rejecting, is a **separate** item because it needs a product decision first. | commit pending

### IMP-007 — Add a "Try again" button to the index-unavailable panel
- **Status:** DONE
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
- **Notes:** commit ac1fae2; attempt 2 PASS (attempt 1 FAILed — the retry button was dead: one `getManifest()` per document, so a second click could not re-fetch)
### IMP-008 — Make relevance sort agree with the Relevance chip
- **Status:** DONE
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
- **Notes:** commit 67ee0a4; attempt 2 PASS (attempt 1 FAILed — flaky test race)
### IMP-009 — Validate `#cat=` values against the manifest
- **Status:** DONE
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
- **Notes:** commit 228d48d; attempt 2 PASS (attempt 1 FAILed — it wrote `urlState.ts` but never wired `App.tsx` to call it, so the behaviour never changed)
### IMP-010 — Make the category selection reversible and representable
- **Status:** DONE
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
- **Notes:** Depends on IMP-143 because criterion 4 needs the extracted, testable `writeHash`. IMP-106 (a broader "Clear filters" action) and IMP-009 (validating hash categories against the manifest) touch adjacent UI; keep the copy unambiguous about which control resets what. | commit pending

### IMP-011 — Surface `saveState` failure to the user
- **Status:** DONE
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
- **Notes:** commit pending
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
- **Status:** DONE
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
- **Notes:** Raising `--border` also affects `.paper` and `.collection` outlines; check both screenshots before declaring success. | commit pending

### IMP-014 — Restore the search input's keyboard focus ring
- **Status:** DONE
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
- **Notes:** same commit
### IMP-015 — Make a single failed shard non-fatal
- **Status:** DONE
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
- **Notes:** commit pending; attempt 2 (AC2 completed)
### IMP-016 — Distinguish "papers failed to load" from "no papers available"
- **Status:** DONE
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
- **Notes:** commit pending
### IMP-017 — Replace the raw `Error.message` with human-readable copy
- **Status:** DONE
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
- **Notes:** commit pending
### IMP-018 — Add a React error boundary around `<App />`
- **Status:** DONE
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
- **Notes:** The boundary is a safety net; it does not replace IMP-098 (runtime validation) — a boundary that silently hides a schema violation would be worse than the bug. | commit pending

### IMP-019 — Align `web/src/lib/types.ts` nullability with `record_from_result`
- **Status:** DONE
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
- **Notes:** Risk `med` because widening the types may surface compile errors in `PaperCard.tsx` and `App.tsx` filter code (`App.tsx:211-212` uses `paper.primaryCategory` in a `Set` lookup, which is fine for `null` but changes the filter semantics subtly). **Advisory carried forward from `.improve/reports/verify-IMP-151b.md` OBS-D, which must survive this item:** widening the types to `string | null` makes it *tempting* to simplify `hasSafeUrls` (`web/src/lib/collections.ts:96-101`) from `url == null || isHttpUrl(url)` down to `isHttpUrl(paper.absUrl)`. Do not. `parseExportPayload` validates a file read off disk, so a `null` is reachable there regardless of what the declared type says, and `PaperCard.tsx:33-35`'s `safeHref(url: string | undefined)` is likewise now inaccurate about what it receives. The `null` exemption is load-bearing for correctness, and `isHttpUrl`'s `(value: unknown)` parameter is what makes it safe — narrowing that parameter to `string` would let a `null` flow straight into an `href`. | commit pending

### IMP-020 — Make the retention window a filter, not only an ordered `break`
- **Status:** DONE
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
- **Notes:** Risk `med` because dropping non-`datetime` records changes what reaches the index for any upstream shape change; verify a real run still produces ~the same paper count before merging. The baseline index on disk is `totalPapers: 2812` across 2 shards; a smoke run of `--category cs.CV --max-per-category 300` is the comparison to record. | commit pending

### IMP-021 — Write the manifest before deleting stale shards
- **Status:** DONE
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
- **Notes:** commit pending
### IMP-022 — Validate every CLI flag in both scripts
- **Status:** DONE
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
- **Notes:** Adding validation ranges changes `--help` output, which profile §4.5 requires to be reconciled with `readme.md` in the same change — that is criterion 5. IMP-114 documents `--category` in the readme and should be sequenced with this item. | commit pending

### IMP-023 — Make `safe_filename` a real sanitizer
- **Status:** DONE
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
- **Notes:** commit pending
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
- **Notes:** Risk `med` because a real arXiv source archive may contain members that `filter="data"` rejects, and `--download-sources` is a documented flag. Test against a real source archive before merging and log every rejection so a user can see what was skipped. | commit 19f8dbb; attempt 2 PASS (attempt 1 FAILed — the no-`filter` fallback branch still allowed traversal: `FORCE_FALLBACK=1` measured 21 escape routes)

### IMP-025 — Make `--save-csv` honor `--output-dir`
- **Status:** DONE
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
- **Notes:** commit pending; AC1 already fixed by IMP-002
### IMP-026 — Add `npm run build` to CI
- **Status:** DONE
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
- **Notes:** A broken `npm run lint` step is a bug, not a gate (profile §4.5). Do not add one until IMP-137 creates the script. | commit pending; AC3 size stale-baseline proven

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
- **Status:** DONE
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
- **Notes:** commit pending
### IMP-029 — Assert `web/dist/data` exists in the deploy workflow
- **Status:** DONE
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
- **Notes:** Deliberately checks the filesystem, not HTTP — profile §4.5: a `curl -w %{http_code}` health check returns 200 from the SPA fallback and cannot catch this. | commit pending; closed with IMP-028

### IMP-030 — Replace the stale README hero screenshot
- **Status:** DONE
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
- **Notes:** **DONE** (commit above). Binary-only change; no test suites affected. `images/feed_example.png` is on the profile's "do not touch unless the item is specifically about it" list — this is that item.

### IMP-031 — Fix `CONTRIBUTING.md`'s Python command and add a venv step
- **Status:** DONE
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
- **Notes:** The repo has no venv of its own and the profile's working command is `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; the docs should not hardcode that machine-specific path. | commit pending; attempt 2 PASS

### IMP-032 — Document the `web/` test and build workflow in `CONTRIBUTING.md`
- **Status:** DONE
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
- **Notes:** If IMP-026 adds a build gate, this is the doc side of it. Combine the two PRs if convenient. | commit pending; same commit

### IMP-033 — Add an upper bound to `arxiv` in `requirements.txt`
- **Status:** DONE
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
- **Notes:** This item is a *floor* fix, not a substitute for IMP-093 (replace the removed APIs) — pinning to 2.x would also "fix" the crash while leaving the code on a dead API. State that in the PR. | commit pending

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
- **Status:** DONE
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
- **Notes:** **DONE** (commit above). Verifier judged the UTC/local date bug REAL and understated; the weakened assertion is a scope decision, and the underlying defect is filed as a new item. Follow the repo's 1:1 mirror convention — a component at `web/src/components/PaperCard.tsx` gets tests at `web/src/components/__tests__/PaperCard.test.tsx`, not inline.

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
- **Status:** DONE
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
- **Notes:** **DONE** (commit above). Verifier confirmed the reorder is necessary, not churn: typecheck exits 127 without web/node_modules. Risk `med` because duplicating gates across workflows lengthens the deploy path and a slow/flaky suite can now block publication. The `concurrency` block at `deploy.yml:16-18` must keep `cancel-in-progress: false`.

### IMP-219 — Render a paper's publication date in UTC so cards west of UTC stop showing yesterday
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/components/PaperCard.tsx:20-30` (`formatDate` — `new Date(`${value}T00:00:00Z`)` at `:21` anchors the bare date at midnight **UTC**, and `toLocaleDateString(undefined, …)` at `:25-29` then formats it in the **local** zone with no `timeZone` option), `web/src/components/__tests__/PaperCard.test.tsx:36-39` (the assertion IMP-037 weakened to `expect(published?.textContent).toContain("2024")`), `web/src/App.tsx:64-73` (`formatGeneratedAt` — parses `manifest.generatedAt` with `new Date(value)` at `:65`, a real **instant**; **must not change**), `web/src/App.tsx:76-99` (`formatWeekRange` — the in-repo precedent, pinned to `"en-US"` with `timeZone: "UTC"` at `:95-96`, and its comment at `:80-85` already names this exact hazard), `scripts/build_index.py:140-143` (`iso_date`, the producer that emits a zoneless `value.date().isoformat()`, used at `:171-172`), `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` (its first card reads "Sep 30, 2026" for a shard whose `published` is `2026-10-01`)
- **Intent:** `published` arrives from the pipeline as a **zoneless calendar day**, `formatDate` re-anchors it at midnight UTC so the two agree, and then formats that instant in the reader's local zone — throwing the agreement away. Every card therefore shows **yesterday's** date for every reader west of UTC, which is the whole Americas, and the visible text contradicts the `dateTime` attribute on the very same `<time>` element. This is a correctness bug, not a locale-policy question.
- **Acceptance criteria:**
  1. `PaperCard.formatDate` renders the calendar day the producer emitted, **in every timezone**. Either pass `timeZone: "UTC"` to `toLocaleDateString` — the option `formatWeekRange` already uses at `App.tsx:96`, for the reason its own comment states — or parse the bare date as local midnight instead of UTC midnight. State which in the PR body.
  2. **`App.tsx:64-73` `formatGeneratedAt` is unchanged.** It parses `manifest.generatedAt`, a real instant, so local rendering is correct there; adding `timeZone: "UTC"` to it would introduce a *new* off-by-one day in the hero's "index generated" line, in the opposite direction. The two helpers take different kinds of value, which is the whole reason they may legitimately differ — IMP-125 criterion 2's "both call sites make the same choice" is about *locale* and does not license a shared answer on the *timezone* axis.
  3. The test in `PaperCard.test.tsx` is tightened from the year-only assertion at `:39` to one that fails when the day shifts: `expect(published?.textContent).toBe("Jan 2, 2024")` against the existing `published: "2024-01-02"` fixture at `:18`, which is anchored at `00:00Z` and is therefore exactly the value that moves. Either pin the zone for the file (`process.env.TZ = "UTC"` before any `Date` formatting, which Node honours at runtime) **or** rely on the component's `timeZone: "UTC"` making the expectation locale-portable. The `dateTime` assertion at `:38` is kept unchanged — it is the half that was always right, and it is what the fix must not disturb.
  4. The suite is exercised in at least one zone **west** of UTC, not only the host's, so a fix that only works east of Greenwich cannot pass. Quote both runs.
  5. **Re-capture the baseline screenshot.** `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` bakes the bug in, so the day this lands every baseline comparison that includes a card date shows a diff, and IMP-125 criterion 3 ("a rendered card date is unchanged from the baseline in the reference locale") is unsatisfiable until it does. Re-capture the file as part of this item and state in the report that the change from the old image is a **date correction, not a layout change**. Do not overwrite a baseline to make a comparison pass; this one is corrected because it is wrong, and anyone treating the resulting diff as a regression will revert a correct fix.
  6. `cd web && npm run typecheck && npm test && npm run build` are green with no pre-existing expectation weakened, and the change is confined: `git diff --stat -- web/src` lists `PaperCard.tsx` and `PaperCard.test.tsx` and nothing else. No new dependency, **no `@types/node`** (the profile records why adding it breaks `tsc --noEmit` under `web/tsconfig.json`'s pinned `types: ["vite/client"]`), and no CSS or `@media` change.
- **Verification method:** `cd web && npm run typecheck && npm test` → quote `Test Files 20 passed (20)` / `Tests 293 passed (293)`; then `TZ=America/New_York npx vitest run src/components/__tests__/PaperCard.test.tsx` and `TZ=Asia/Tokyo npx vitest run src/components/__tests__/PaperCard.test.tsx`, both green with the exact string asserted at criterion 3; then non-vacuity in a `/tmp` copy — remove the `timeZone` option and re-run under `TZ=America/New_York`, quoting the red output including `Received: "Jan 1, 2024"`. Then `npm run build`, re-capture the baseline at 1280px, and read the shard that supplies the first card to confirm the rendered date now equals its `published`. Browser console clean (profile §4.2).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Impact 4 — the defect is on **every** card in the primary feed for every reader in the Americas, and it is self-contradicting on screen: the `<time>` element's `dateTime` says `2026-10-01` while its own text says "Sep 30, 2026". Impact is 4, not 5, because the error is bounded at one day and does not misidentify the paper, hide it, or lose it. Confidence 5 — the mechanism was reproduced with plain Node across five zones and the shipped baseline artifact independently shows it. Effort S: one option on one call, or one change to one `new Date` expression, plus a tightened assertion and a re-captured screenshot. Risk `low`: no wire-format change, no shared helper touched, no CSS. **This is a correctness fix and is deliberately filed separately from IMP-125.** IMP-125 ("Pin or document the date locale", `NEEDS-HUMAN`) concerns the **locale** axis — whether `toLocaleDateString(undefined, …)` should become `toLocaleDateString("en-US", …)` so the output is testable — and says nothing about the timezone axis; a paper dated `2024-01-02` reading as "Jan 1, 2024" in `America/New_York` is not a formatting-preference question, the two decisions compose, and either can be made without the other. **There is one sequencing hazard worth naming:** IMP-125 criterion 2 asks for "the duplicated helper … consolidated into one place", so if that consolidation lands first it will merge `formatDate` and `formatGeneratedAt` — which criterion 2 of this item says must keep different zone behaviour. If IMP-125 lands first, the consolidated helper must take the zone or the parse as a parameter, and that negotiation belongs to whichever item lands second. **Do not apply the fix blanket-style.** The obvious "they are identical, fix both" move is wrong, and IMP-125's "both call sites make the same choice" phrasing is what invites it; the codebase already knows the difference, since `formatWeekRange` (`App.tsx:76-99`) pins `en-US` plus `timeZone: "UTC"` with a comment at `:80-85` naming this hazard, and `formatGeneratedAt`'s own docstring says "unlike `formatWeekRange` above". This item's scope is `PaperCard.formatDate` and nothing else. **The assertion was weakened, so until this lands the defect is tracked only here.** IMP-037 (`DONE`) rendered the card date and had to weaken its assertion to `toContain("2024")` rather than ship a failing test, because the host zone made a hardcoded `"Jan 2, 2024"` fail; its Notes promised that "the underlying defect is filed as a new item", and that item did not survive a corruption round. Sequence criterion 1 before criterion 3, and when it lands remove the comment in `PaperCard.test.tsx` that normalises the wrong behaviour — it is true only while the bug is unfixed, and the next agent will otherwise read it as a standing rule and never re-tighten the assertion. Evidence: `.improve/reports/verify-IMP-037.md` §5 ("TRUE and the severity is, if anything, understated"), including the two findings this item carries forward as criteria 5 and 2, and its zone table (America/New_York and Pacific/Honolulu print the day before; Europe/London, UTC and Asia/Tokyo do not).

---

## Tier 15.0

### IMP-205 — Raise or derive `deploy.yml`'s index-step cap from the measured page count
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/deploy.yml:37-55` (the `Build the paper index` step, `timeout-minutes: 75` at `:54` and the arithmetic comment at `:42-53`), `.github/workflows/deploy.yml:23-26` (the `build` job cap, `timeout-minutes: 90`), `scripts/build_index.py:32` (`DEFAULT_CATEGORIES` — 5 categories), `scripts/arxiv_common.py:16-19` (`DEFAULT_PAGE_SIZE = 1000`, `DEFAULT_DELAY_SECONDS = 10`, `DEFAULT_REQUEST_TIMEOUT_SECONDS = 60`), `tests/test_build_index.py:683-717` (`DeployStepTimeoutTests`)
- **Intent:** The step's cap is justified in its own comment as "75 min = 4500 s is 2.5x that 1800 s worst case", and 1800 s is the *total-partition* case — `5 categories × 6 attempts × 60 s` — which implicitly assumes each category makes exactly **one** page fetch. A real deploy is not a partition. Pages per 60-day window were measured from `opensearch:totalResults` on the live API: cs.CV 6,742 (7 pages), cs.LG 9,723 (10), cs.CL 5,213 (6), cs.AI 10,785 (11), cs.RO 3,275 (4) — **38 pages** at `page_size` 1000. The per-page bound is `timeout + delay_seconds = 70 s`, not 60 s, so the compound worst case is `38 × 70 + 5 × 360 = 4460 s` against the 4500 s cap: **40 seconds of slack**. `70 × P + 1800 ≤ 4500` breaks at **P = 39** — one page, ~1,000 papers, ~9 % growth in a single 60-day window. When it breaks the step is killed by GitHub and the deploy fails with a generic timeout instead of `build_index.py`'s own IMP-004 refusal, which is exactly the outcome the cap exists to prevent. The invariant IMP-198's test asserts (cap greater than the worst case) is therefore true only for a page count that is written down nowhere in the repository.
- **Acceptance criteria:**
  1. **The cap is derived from the real page count, not from a one-page-per-category assumption.** The comment at `deploy.yml:42-53` states the pages-per-category table (or an explicit upper bound on it), the per-page bound `DEFAULT_REQUEST_TIMEOUT_SECONDS + DEFAULT_DELAY_SECONDS`, and the resulting compound worst case; the step's `timeout-minutes` is larger than that number by a margin stated as a multiple rather than implied. A cap chosen without a stated page count does not satisfy this criterion.
  2. **The step cap stays strictly inside the `build` job cap**, and the job cap is raised if needed to keep it there. `75 < 90` today; if the step moves to 90 the job must move above it (the verifier's suggested 120/110 is one answer, not the only one).
  3. **Growth headroom is quantified and is at least one doubling.** The comment and the test both state how many pages the chosen cap tolerates at 70 s/page — `(cap_seconds − 1800) / 70` — and that number is **≥ 60 pages**, roughly 60 % growth over today's 38, or the cap is raised until it is. Today's value, 38, is the baseline this rejects.
  4. **The safety property IMP-198 installed is preserved, not weakened.** `DeployStepTimeoutTests.test_the_index_step_outlasts_a_whole_pipeline_failure` is updated to assert the cap exceeds **both** the total-partition case (`5 × 6 × 60 = 1800 s`) and the page-count-derived compound case, so the invariant it locks is the one the comment now claims. The number in the test is not lowered, and `assertGreater` (strict) is not relaxed to `assertGreaterEqual`.
  5. **The failure path IMP-004 owns is still reachable.** With the shipped 60 s timeout, a loopback black-hole probe still reaches `main()`'s refusal and exit 1 with an empty out-dir rather than GitHub's timeout, and the elapsed time is quoted in the PR body.
  6. **Nothing else in the workflow moves.** `git diff -U0 -- .github/workflows/deploy.yml | grep -c '^-[^-]'` is `0` unless the PR argues line by line; `concurrency.cancel-in-progress: false` is intact; no `continue-on-error` and no `|| true` is introduced; the `deploy` job's `timeout-minutes: 15` is untouched.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` with the updated `DeployStepTimeoutTests`; then `/usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/deploy.yml')); print(d['jobs']['build']['timeout-minutes'], [s.get('timeout-minutes') for s in d['jobs']['build']['steps'] if s.get('name')=='Build the paper index'])"`; then the non-vacuity check — in a `/tmp` copy, lower the step cap below the compound worst case and quote the failing test, and separately set it to exactly the compound worst case and quote the failure (the assertion is strict, so equality must fail). No network access is required for any step; the page counts cited in the intent were measured once and must be quoted from that measurement with its command, not re-fetched.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Impact 3, Confidence 5, Effort S = 15.0, and the arithmetic puts this item **above IMP-204 (12.5)** even though IMP-204 is the one that is breaking the deploy today — the gap is purely the `S` versus `M` effort divisor, not a judgement that a 40-second margin is worse than a total run failure. If the two are ever triaged together, IMP-204 goes first; this item's urgency is that the slack is consumed by arXiv's own growth, roughly 9 % per window, and nothing in the repository records the page count that the margin is spent against. Risk `low`: two YAML values, a comment that becomes truthful, and a test whose constant grows. **Honest caveat about the 4460 s figure:** the per-category page counts are measured, but the compound case is a *bound*, not a measurement — making 38 pages each consume the full 60 s and still succeed would take 74 minutes of wall clock, so the number is arithmetic over measured inputs, not an observation. It is filed as a bound because that is the case the cap exists for. Cross-references, deliberately **not** duplicated: **IMP-198** (DONE, `b7e23a8`) installed the caps and the `DeployStepTimeoutTests` case; this item does not reopen it — the caps it shipped are correct for the case it modelled, and the defect is that the model was one page per category. **IMP-206** covers the *job-level* caps being unpinned by any test, which is a different assertion at a different level of the same file. **IMP-204** stops the run earlier (bounded paging, per-category degradation), which reduces the page count and therefore changes the number this item's criterion 1 must state — land IMP-204 first and re-derive, or land both in one PR and say so. **IMP-183** (TODO, 7.5) bounding the retention window in the query would reduce the page count for the same reason. Evidence: finding **F-1** in `.improve/reports/verify-IMP-198-r2.md` §9, with the per-category page table in §1.4 and the case-A/B/C arithmetic in §1.4's second table.

### IMP-218 — Run the web test suite in the deploy too, or record why not
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/deploy.yml:64-77` (the `Typecheck` step, whose comment at `:73-74` reads "Deliberately not `npm test`"), `.github/workflows/deploy.yml:79` (`- name: Build the paper index`) and `.github/workflows/deploy.yml:143` (`- name: Build the web app`), `.github/workflows/deploy.yml:23-27` (the `build` job's `timeout-minutes: 90` and the margin comment above it), `.github/workflows/ci.yml:47-48` (`- name: Run tests` / `run: npm test` in `web-tests`, the precedent to copy), `web/package.json:6-13` (the `test` script, `vitest run`)
- **Intent:** IMP-041 closed the deploy's hole for the Python suite and for typecheck but not for the web suite, so a PR whose React component tests fail can still be merged and still published — the same failure mode IMP-041 set out to stop, one stack over. One step closes it; the cost is duplicating a suite CI already runs and ~6 s on every deploy, so this is a stated call rather than an obvious win and should be made explicitly.
- **Acceptance criteria:**
  1. **Either route is acceptable; state which in the PR body.** Route A: the deploy `build` job runs `npm test` with `working-directory: web` — byte-identical to `ci.yml:48` apart from the working directory, since `deploy.yml` sets no `defaults.run` — placed above `Build the paper index`. Route B: leave it out and rewrite the comment at `:73-74` from "Deliberately not `npm test`" into a decision that says what a red web suite can and cannot reach the deploy through, and why that is acceptable. Route B is a real answer; what is not acceptable is leaving IMP-041's original wording standing as though it were still the reason.
  2. **No `timeout-minutes:` is added to the step.** `tests/test_arxiv_common.py`'s `WorkflowTimeoutTests` fails every `timeout-minutes:` line in either workflow that is at or under `6 × 60 s = 360 s`, so a 6-second step cannot be capped without turning an unrelated Python test red. If Route A is taken, the step carries no cap and its comment says why.
  3. The `build` job's cap still covers the added step with the margin its own comment claims. `deploy.yml:23-26` currently budgets "~120 s on CI plus a few seconds per gate"; Route A makes that three gates, and the comment is updated to name the web suite's measured cost. **No `timeout-minutes:` value anywhere is lowered.**
  4. The cost is measured, not estimated. Quote `npm test` locally with its file count, test count and duration, and quote the suite as CI will see it. These counts drift in this repo and older figures were each accurate only when written — 292 tests / 19 files in the discovering report, **293 tests / 20 files measured 2026-10-03 in 7.54 s**. Re-measure; do not copy either number forward.
  5. Nothing else moves: `concurrency.cancel-in-progress: false` is intact, no `continue-on-error` and no `|| true` is introduced, `git diff -U0 -- .github/workflows/deploy.yml | grep -c '^-[^-]'` is `0` outside the one step and the comment lines the PR argues for, and `cd web && npm run typecheck && npm test` is green with no pre-existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test` → quote `Test Files 20 passed (20)` / `Tests 293 passed (293)` and the duration; `cat -n .github/workflows/deploy.yml` and read it top to bottom, confirming where the new step sits relative to `Build the paper index` at `:79` and `Build the web app` at `:143`; then the non-vacuity check — in a `/tmp` copy of `web/`, break one React component test (for example an assertion in `src/__tests__/errorBoundary.test.tsx`) and confirm `npm test` exits non-zero, which is what a GitHub `run:` step turns into a failed job, quoting the failing line; revert and confirm green again. Route B needs no mutation: its criterion is the comment's content, checked by reading `:73-74` against this item.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-041
- **Priority score:** 15.0
- **Notes:** Impact 3, Confidence 5, Effort S = 15.0. Impact is 3, not IMP-041's 4, because two of the three deploy gates now land and the web suite already runs on **every** pull request in `ci.yml`'s `web-tests` job (`:47-48`), so the marginal exposure this closes is the merge-anyway path alone rather than a deploy with nothing at all in front of it. Confidence 5 — the gap is a diff of two workflow files and the cost is a measured 7.54 s across 20 files, not an estimate. Risk `med` for IMP-041's own stated reason: duplicating a suite onto the publish path means a slow or flaky test can now block publication. That is the same risk the item accepted when it duplicated the Python suite and typecheck, and the deploy is not meaningfully slower for those, so the argument that stopped there applies here too — but it is an argument, and this item records it rather than assuming it. **The tradeoff, stated plainly.** For: one step closes a real hole, since 293 vitest tests including 120 that drive React components through `@testing-library/react` currently cannot stop a publish. Against: it duplicates a suite that already runs on every PR and puts ~6–8 s of test time in front of every deploy, weekly and on manual dispatch. Both the Python suite and `npm run typecheck` are already duplicated from CI for exactly this reason, so consistency argues for the third; the counter-argument is that the web suite is by far the largest of the three, so its duplication is the most expensive of the three. An owner may reasonably decline, which is why criterion 1 offers a documented decision as a first-class outcome rather than mandating the step. **Cross-referenced, deliberately not duplicated:** the gate-pin item for the two *existing* gates is a different question — whether a present gate can be deleted silently — and neither item should absorb the other. **IMP-206** owns the job-vs-step cap ordering and must not be re-litigated here; criterion 2 exists because of it, and its own criterion 4 covers `ci.yml`'s `web-tests` cap. **IMP-199** and **IMP-200** touch `ci.yml`'s `web-tests` steps, not the deploy's. Evidence: **D-2** of `.improve/reports/discovered-IMP-041.md`, which recorded this as deliberately out of IMP-041's scope because its criterion 1 named exactly two commands, and `discovered-IMP-041.md` §D-3 for criterion 2's constraint.

### IMP-174 — Pin that the stale-shard sweep runs last
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py:230-289` (`WriteIndexOrderingTests`, 2 tests), `scripts/build_index.py:269-275` (shard writes → manifest write → `_clean_old_shards`), `scripts/build_index.py:244-256` (`_clean_old_shards`)
- **Intent:** IMP-021's guarantee is that a crash at any point never leaves a deployed `index.json` referencing a shard file that does not exist. The suite pins *writes before sweep* but not *manifest before sweep*. Reordering `write_index` to `shards → sweep → manifest` — the exact misreading of "write the manifest before deleting stale shards" as "move the sweep line down one" — passes all 55 tests and is demonstrably unsafe. Measured: on a shrink run (3 deployed shards, 1 new shard) with a crash between the sweep and the manifest write, the directory is `['index.json', 'papers-2024-W03.json']` while the deployed manifest still references `papers-2024-W01.json` and `papers-2024-W02.json`. Both are missing, and `loadShard` turns a missing file into `Failed to load … (HTTP 404)`.
- **Acceptance criteria:**
  1. A new test in `tests/test_build_index.py`, added to `WriteIndexOrderingTests` or a new class beside it, wraps `build_index._clean_old_shards` and, **inside the wrapper**, asserts that the on-disk `index.json` already parses and that `{entry["file"] for entry in manifest["shards"]}` equals the set of shard files present in `out_dir`. The wrapper calls through, so the sweep still runs.
  2. The fixture is the shrink case: `out_dir` is seeded with `papers-2024-W01.json`, `W02`, `W03` and an `index.json` referencing all three, and the run under test writes only `W03`. The test asserts at sweep entry that the stale shards are still on disk (the sweep has not run yet) and that the manifest on disk is the **new** one.
  3. The new test fails when the sweep moves above the manifest write, and passes as shipped. Both runs are quoted verbatim in the implementer report: the suite as shipped, and the suite with `build_index.py:275` relocated to immediately before the manifest write at `:272`.
  4. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports **56** tests OK (55 pre-existing + 1) and `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0` — purely additive, no existing expectation weakened.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then on a scratch copy of `scripts/build_index.py` move the `_clean_old_shards(out_dir, keep=shard_files)` call from `build_index.py:275` to immediately before the manifest write at `:272` and re-run, quoting the failing test name and the assertion that fails.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** The one real coverage gap in IMP-021's verification: `verify-IMP-021.md` §5 mutant D (`shards → sweep → manifest`) reported "Ran 55 tests … OK" while being unsafe, and mutants A, B and C were all killed. This is finding F-1 of that report. Impact is 3 rather than 4 because the shipped code is correct today — this item buys a regression guard. Cross-reference: the truncation half of the same crash family is IMP-099 (TODO, `10.0`) and is **not** duplicated here; nor is `_clean_old_shards`' default-argument path (`build_index.py:244`, D4 in `.improve/reports/discovered-IMP-021.md`).

### IMP-175 — Make the newest-first ordering deterministic within a publication day
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/paperIndex.ts:295` (`.sort((a, b) => (a.published < b.published ? 1 : -1))`), `web/src/lib/search.ts:89` (the identical comparator inside `rankPapers`), `web/src/App.tsx:336-353` (`visiblePapers`, which preserves whatever order it is handed)
- **Intent:** Both comparators return `-1` when the two `published` strings are **equal**, so the comparator is inconsistent — `cmp(a, b)` and `cmp(b, a)` are both `-1` for the same pair — and the engine's tie order becomes implementation-defined instead of file order. Measured on the deployed 2,549-paper shard: 593 papers share the maximum `published` value, and the first card the app rendered was file index **592** where a stable descending sort of the same bytes yields file index **0**. Three consequences: two loads of identical bytes can present same-day papers in a different order; with `PAGE_SIZE = 50` a given paper's position among its same-day peers is unpredictable; and the newest-first path stops being reproducible against the DOM, which is how `.improve/reports/impl-IMP-018.md` and `verify-IMP-018.md` both concluded a mutated fixture "did not apply" when it had.
- **Acceptance criteria:**
  1. `web/src/lib/paperIndex.ts:295` returns `0` for equal `published` values — e.g. `(a.published < b.published ? 1 : a.published > b.published ? -1 : 0)`, or a stable descending sort — so papers sharing a date come out in the order `batches.flat()` produced them.
  2. `web/src/lib/search.ts:89` receives the same treatment inside `rankPapers`, so relevance ties also fall back to input order rather than engine order. Both sites are fixed; a single-site fix is not accepted.
  3. A new test in `web/src/lib/__tests__/paperIndex.test.ts` builds a fixture of at least 4 papers that all share one `published` value, loads them through `loadPapers`, and asserts the returned order is exactly the shard's file order. A matching test in `web/src/lib/__tests__/search.test.ts` extends the existing `describe("rankPapers")` block and asserts equal-score, equal-date papers come back in input order; the existing assertion at `search.test.ts:96` ("orders by score with newest as the tie-breaker") must still pass unmodified.
  4. `cd web && npm run typecheck && npm test` passes: 15 test files, **234** tests (232 pre-existing + 2), no existing expectation weakened and no test skipped.
- **Verification method:** `cd web && npm run typecheck && npm test`; then in the browser load the feed twice from a cleared cache and confirm the first 50 card ids are byte-identical across both loads, and that applying a bare `Array.prototype.sort` to a copy of the returned array leaves it unchanged (the stable-sort no-op). Screenshot to `.improve/artifacts/IMP-175/feed-newest-order-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Pre-existing and unrelated to IMP-018's change; raised as finding 9.5 in `.improve/reports/verify-IMP-018.md` §3 and §9.5, and the same comparator was named independently in `.improve/reports/discovered-IMP-018.md` §2. Impact is 3 rather than 4 because no data is lost and every paper stays reachable — the harm is an unpredictable presentation order plus a verification method that reports a false negative. Cross-reference: IMP-008 (DONE) made the Relevance **chip** agree with the relevance **sort**; this item is about the comparator those sorts share, so the two do not overlap. IMP-098 (TODO) owns per-paper field validation and must not be used to defer this.

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

### IMP-192 — Stop the order-dependent alert race in `App.loadFailure.test.tsx`
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/__tests__/App.loadFailure.test.tsx:899-912` (`it("coexists with the unknown-category banner as two distinct alerts")`, whose `await screen.findByRole("alert")` at `:904` awaits only the **first** alert), `web/src/__tests__/App.loadFailure.test.tsx:872-897` (the sibling `it("coexists with the save-failure banner as two distinct alerts")`, same shape), `web/package.json:9` (`"test": "vitest run"` — no shuffle, which is why CI never sees it)
- **Intent:** IMP-016's own coexistence test asserts a *final* state with a *first*-arrival wait. `await screen.findByRole("alert")` at `:904` resolves as soon as one `role="alert"` node exists, and the next line asserts `expect(screen.getAllByRole("alert")).toHaveLength(2)` — so whenever the second alert commits a tick later, the test fails on a correct render. Measured: **1 failure in 12** shuffled runs against a clean `git archive HEAD` checkout and **2 in 23** in the working tree, same test, same file, same rate; **0 in 14** plain `npm test` runs. The verifier reproduced the identical rate at HEAD, so this **predates IMP-019 and IMP-020** and is not a regression from any item in this batch. It matters more than its size: this suite is the substrate every verifier in this loop uses to claim a green baseline, and a test that fails on a correct render teaches the next verifier to re-run until it passes, which is exactly the habit the profile's evidence rules exist to prevent.
- **Acceptance criteria:**
  1. `web/src/__tests__/App.loadFailure.test.tsx:904` no longer waits on the first alert alone. The final-state assertion is made inside a `waitFor` — `await waitFor(() => expect(screen.getAllByRole("alert")).toHaveLength(2))` — and the `failurePanel()` and `.find((node) => node !== failurePanel())` assertions at `:907-911` execute **after** that `waitFor` resolves, so they still run against a settled tree of exactly two alerts.
  2. The sibling test `it("coexists with the save-failure banner as two distinct alerts")` at `:872-897`, which asserts `toHaveLength(2)` on the same one-tick pattern after a `fireEvent.change`, is given the same treatment. Any other test in `web/src/__tests__/` that combines `findByRole("alert")` (or a single `queryByRole`) with a `getAllByRole("alert")).toHaveLength(n)` for `n > 1` is converted too; `grep -n "getAllByRole(\"alert\")" web/src/__tests__/` must return no occurrence that is not preceded by a settling `waitFor`, `findAllByRole`, or `findBy*` on the same count.
  3. No test is deleted, skipped, or weakened: `git diff -U0 -- web/src/__tests__/ | grep -c '^-[^-]'` is `0`, no `.skip`/`.todo`/`.only`/`.each` appears in an added line, and no `waitFor` timeout argument is raised above Testing Library's 1 000 ms default. The number of `it` blocks in the file is unchanged.
  4. **Non-vacuity is demonstrated, not asserted.** In an rsync of `web/` under `/tmp` with `node_modules` symlinked, restore the racing form (delete the `waitFor`, put `await screen.findByRole("alert")` back at `:904`) and run `npx vitest run --sequence.shuffle --sequence.seed=<n>` over **20** seeds, quoting the failure count for the reverted copy. Then run the same 20 seeds against the fixed tree and quote the count, which must be `0`.
  5. `cd web && npm run typecheck && npm test` passes **20 consecutive plain runs** with an identical `Tests N passed (N)` line every time, and the total test count is unchanged from the pre-change figure.
- **Verification method:** `cd web && npm run typecheck`; then `for i in $(seq 1 20); do npm test; done` and confirm 20/20 green; then `for s in $(seq 1 20); do npx vitest run --sequence.shuffle --sequence.seed=$s || echo "SEED $s FAILED"; done` on the fixed tree (0 failures) and on the `/tmp` reverted copy (non-zero, quoted in the PR body). No browser check is needed: this is a test-harness defect, not a rendered one.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Impact is 3, not 5: no reader ever sees this, and the shipping gate is unaffected — `ci.yml:37-38` runs plain `npm test`, and the file was 0/14 there. The impact is on **this loop's evidence**: a green suite is the only thing standing between a verifier's claim and a false one, and a test that flips on correct renders is worse than a missing test, because it is a test that reports. Confidence is 5: the race is read directly off `:904`/`:906` and the rates (1/12 at HEAD, 2/23 in tree, 0/14 plain) were measured by running the harness 49 times. Effort is `S` — one `waitFor` in two tests — which is what makes the 15.0 honest. Cross-references, deliberately **not** duplicated: IMP-163 (TODO, 7.5) closes three IMP-024 extraction-test gaps in `tests/test_paper_collector.py` and shares only the "a test that cannot fail is worse than no test" principle; IMP-132 (TODO, 6.7) adds coverage for `App`'s load/error/retry states but does not own the race in the tests that already exist; IMP-176 (NEEDS-HUMAN) touches the alert machinery's *policy*, not its tests. **Ordering note:** if IMP-132 or IMP-163 lands first, re-run criterion 4 afterwards — either may shift which file the racing assertion lives in. Finding row 5 (`OUT OF SCOPE`) in §9 of `.improve/reports/verify-IMP-019.md`, with the attribution run quoted in §5 of the same report.

### IMP-193 — Generate the paper index inside CI so the new build gate is not green on an empty checkout
- **Status:** DONE
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:21-40` (the `web-tests` job: `npm ci`, `npm run typecheck`, `npm test`, and IMP-026's `Build` at `:39-40` — with **no** index-generation step, unlike `.github/workflows/deploy.yml:33-34` which builds the index before its own build), `web/public/data/` (gitignored at `web/.gitignore:9`, therefore absent on every CI checkout)
- **Intent:** IMP-026 gave `web-tests` a build step, but that step runs in a state the deploy build it pre-screens is never in. With `web/public/data/` absent — measured by renaming it aside and running the real command — `npm run build` exits **0** and `dist/data` is **absent**, while both asset content hashes are byte-identical to a healthy build (`index-D7spZXJu.js` 171,472 B), because the index is copied in as files and never inlined into JS or CSS. So the gate is *silent*, not wrong, and it pre-screens none of the one failure mode the deployed site turns into "No paper index yet" forever. Two consequences: a `build_index.py` regression cannot be caught before merge, and the moment IMP-028's fail-closed guard lands, `ci.yml:39-40` fails on **every** run until CI learns to generate an index. Note the two absent states are distinguishable and the distinction is a trap: with no `public/data`, `dist/data` is **missing**; with an *empty* `public/data`, `dist/data` **exists and is empty** — so a bare `os.path.isdir("dist/data")` check passes in the second case and fails in the first.
- **Acceptance criteria:**
  1. `.github/workflows/ci.yml`'s `web-tests` job runs `python scripts/build_index.py` into `web/public/data/` **before** the `Build` step at `:39-40`, with bounded flags — `--category cs.CV --max-per-category 5 --out-dir web/public/data` — and the resolved path is correct against the job's `defaults.run.working-directory: web` at `ci.yml:23-25`. Either the step's `working-directory` is `web` and the flags are relative, or it is unset and the path in `--out-dir` is `web/public/data`; state which, because a wrong resolution writes the index somewhere the build cannot see.
  2. The job gains the two prerequisites that step needs and does not have today: `actions/setup-python@v5` with the same `python-version: "3.x"` **and the same action version** `deploy.yml:27-29` uses, so both workflows install one interpreter, and a `pip install -r requirements.txt` step byte-identical to `ci.yml:16-17`. No new dependency and no unpinned action version is introduced (IMP-134 is the item that pins actions to SHAs).
  3. The step is bounded to one arXiv page and **fails the job** if it cannot produce an index: no `continue-on-error`, no `|| true`, and the flags are small enough that the client sleeps `delay_seconds=10` between pages (`scripts/arxiv_common.py:16`) exactly once. The measured wall-clock is quoted in the PR body, not asserted.
  4. Nothing existing is weakened or duplicated: `cat -n .github/workflows/ci.yml` shows every `run:` line resolving to a real command (npm lines to `web/package.json:7-12`, Python lines to `scripts/build_index.py`), and `python -m unittest discover -s tests -v` is **not** duplicated into this job — IMP-041 (TODO, 20.0) owns that for `deploy.yml` and this item must not pre-empt it.
  5. `cd web && npm run build` succeeds after the step, and `ls web/dist/data` lists `index.json` plus at least one `papers-*.json` shard — the check that cannot be made today.
- **Verification method:** `cat -n .github/workflows/ci.yml`, read the job top to bottom, and confirm the order `Install dependencies` → `Typecheck` → `Run tests` → index build → `Build`; then reproduce both states locally in `web/`: `mv public/data /tmp/rpf-data-aside && npm run build && ls dist` (expect exit 0, no `dist/data` — quote it), restore, run the real index build with the criterion-1 flags, and re-run `npm run build` (expect exit 0 and `dist/data/index.json` present). Confirm the workflow YAML parses with `/usr/local/bin/python3.11 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` and that every added `run:` string is runnable as written.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 15.0
- **Notes:** Risk `med` for two reasons: the step adds a **network** call to a job that is currently offline and deterministic, so an arXiv outage turns a green PR red; and it duplicates the `pip install` that `python-tests` already does, lengthening the job. Keep the flags to one small page (criterion 3) and quote the measured duration. Impact is 3, not 4 — no reader is harmed today, but the gate IMP-026 just added is blind to the most common deploy failure, and this item is a hard prerequisite for IMP-028. Confidence is 5: the absent-data behaviour was measured **twice**, with `public/data` absent and with it present-but-empty, and the content-hash identity is what proves the gate is silent rather than merely lenient. Effort is `S`: four `uses:`/`run:` lines and one flag change in one file. **Ordering constraint, load-bearing:** this must land **before** IMP-028 (TODO, 20.0). IMP-028 makes a missing `public/data/index.json` a non-zero build exit, and CI never populates `public/data` until this item lands — shipping IMP-028 first turns `ci.yml:39-40` red on every single run. Cross-references, deliberately **not** duplicated: IMP-028 owns the fail-closed production-build guard, and its AC1 already requires the check to name `public/data/index.json` specifically rather than test `dist/data` with `isdir` — this item adds no guard; IMP-029 (TODO, 20.0) asserts `web/dist/data` in the **deploy** workflow, which already has the index build at `deploy.yml:33-34`, so it needs no companion step and is untouched; IMP-041 (TODO, 20.0) adds the Python suite and typecheck to the deploy job, also already index-populated; IMP-134 (TODO, 6.0) pins actions to SHAs, a separate change. Evidence: §4 (both probes, verbatim exit codes and hashes) and §8 row 5 of `.improve/reports/verify-IMP-026.md`, whose severity is "actionable for IMP-028's implementer — coordinate before shipping that guard". | commit pending

## Tier 12.5

### IMP-204 — Stop the weekly deploy's uncapped index build from paging past arXiv's limits
- **Status:** DONE
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:43-45` (`UNLIMITED = 100000` and the comment above it), `scripts/build_index.py:236` (`limit = max_per_category if max_per_category > 0 else UNLIMITED`), `scripts/build_index.py:261-273` (`collect_papers`, which appends a failed category to `failures` and `continue`s), `scripts/build_index.py:396-402` (`main()`'s "Refusing to write an index" path), `.github/workflows/deploy.yml:55` (`run: python scripts/build_index.py` — bare, with no `--max-per-category`), `readme.md:73-76` (prose that documents the workaround in place of the fix)
- **Intent:** `--max-per-category 0` — the default, and the exact form `.github/workflows/deploy.yml:55` runs on every weekly cron — resolves at `build_index.py:236` to `UNLIMITED = 100000`, which is an **unachievable bound by construction**. arXiv's own API manual (§3.1.1.2, read from the manual, not from the API) states that "the maximum number of results returned from a single call (max_results) is limited to 30000 in slices of at most 2000 at a time", that "A request with max_results >30,000 will result in an HTTP 400 error code with appropriate explanation", and that "We recommend to refine queries which return more than 1,000 results, or at least request smaller slices. For bulk metadata harvesting or set information, etc., the OAI-PMH interface is more suitable." The constant therefore names a limit the upstream API explicitly refuses and documents as the wrong tool. Worse than the unreachable constant is what happens on hitting the wall: `collect_papers` records the category in `failures` and moves to the next one, and `main()` then refuses to write **anything** — so one deep-offset 5xx on one of five categories discards the four that succeeded and exits 1 with an empty out-dir. Reproduced deterministically against a localhost stand-in for `export.arxiv.org` that answers 200 below `start=10000` and 500 at or above it: the bare run requested `start=10000&max_results=1000` **six** times (1 attempt + `DEFAULT_NUM_RETRIES=5`), logged `ERROR:root:Refusing to write an index: the arXiv query failed for cs.CV, cs.LG, cs.CL, cs.AI, cs.RO`, exited 1, and left **no output directory at all** — while the capped readme command issued exactly one request and wrote its index. `.github/workflows/deploy.yml:43-53` reasons about the bare run's cost but not about its reachability, so the weekly production index build is on this failure path, not merely a local-dev footgun. `git diff --name-only -- scripts/build_index.py` is empty for the item that disclosed this, so the defect is pre-existing and not a regression.
- **Acceptance criteria:**
  1. **The bound is in force and it respects arXiv's ceiling.** The value `collect_papers` hands to `iter_results` (and therefore to `arxiv.Search(max_results=…)`) is at or below 30,000 for the default `--max-per-category 0` path, and no single request exceeds arXiv's "slices of at most 2000 at a time" or a `start + max_results` above 30,000. State the chosen bound and whether it lives in `UNLIMITED` (`build_index.py:45`) or in `DEFAULT_PAGE_SIZE` (`scripts/arxiv_common.py:16`, currently 1000), and rewrite the comment at `build_index.py:43-44` to cite the manual instead of implying the constant is free. Either this item or **IMP-095** may supply that bound — but the two must not each set a different number, and closing this item by only editing `UNLIMITED` is not sufficient.
  2. **Per-category degradation, not all-or-nothing loss.** A run in which one category's query dies mid-paging must not discard the categories that succeeded. `main()`'s refusal must distinguish "no category produced anything" — which keeps IMP-004's exit 1 and its empty out-dir, pinned by `MainTests.test_refuses_to_write_an_empty_index` — from "some categories produced papers and at least one failed", which writes the index it has and makes the shortfall **visible**: a `logging.error` naming every failed category plus a manifest field written by `write_index` recording them, so a reader of `index.json` can tell the index is short. The exact signal (manifest field name, log level, or both) is the implementer's choice and must be named in the PR body. `MainTests.test_refuses_to_write_index_when_a_category_query_fails` must either still pass unmodified or be deliberately rewritten to assert the new contract — deleting it, or weakening it to a bare `assertTrue`, does not satisfy this criterion.
  3. **A documented, deliberate default for the deploy path.** `.github/workflows/deploy.yml:55` gets an explicit, commented `--max-per-category` value — or `parse_args` gets an explicit bounded default — that criterion 1's ceiling can actually serve, and the YAML comment states where the number came from and what it costs (how many papers per category it admits at the shipped 60-day retention). The deploy step must not keep relying on `0 = no cap`.
  4. **Tests.** New tests in `tests/test_build_index.py` cover: the value handed to `iter_results` for `--max-per-category 0` is within the ceiling; a run where 4 of 5 categories succeed and 1 fails writes an index, exits per criterion 2's rule, and names the failed category; a run where every category fails still exits 1 and writes nothing. `ParseArgsValidationTests.test_max_per_category_zero_still_means_no_cap` and `test_defaults_are_unchanged` are updated **only** if criterion 3 changes a default, and the PR body says which.
  5. **Docs follow the code, nothing regresses.** `readme.md:73-76` is updated to describe the new default rather than a workaround, and if criterion 3's value was chosen because it covers a 60-day window, the prose says so. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green, `cd web && npm run typecheck && npm test` is green, and no existing test is deleted, skipped, or `expectedFailure`-marked.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then the deterministic stub reproduction, which edits nothing in `scripts/`: point the client at a localhost server that answers 200 below a chosen `start` and 500 at or above it (subclass `arxiv.Client`, override its `query_url_format` instance attribute, and `runpy`-execute `scripts/build_index.py`; zero only the inter-page `delay` for runtime, leaving page size, retry count and error handling untouched), and quote the exit code, whether `index.json` appeared, and the exact log lines for both the bare and the bounded command. Then `python scripts/build_index.py --category cs.CV --max-per-category 300 --out-dir /tmp/rpf-204` exits 0 as the no-regression check. Quote the arXiv manual sentence you bounded against, and **do not hammer the live API to find the real failure offset** — the offset is a moving target (it is a function of how many in-window papers a category holds) and the mechanism, not the number, is what this item fixes.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.5
- **Notes:** Impact 5 — the weekly production index build is on this path, and when it fires the operator gets an empty deploy and a stale live site. Confidence 5 — the mechanism was reproduced deterministically with only the 5xx stubbed, and the upstream constraint is quoted from arXiv's manual, which is a document rather than an observation. Effort `M`, so 5 × 5 ÷ 2 = 12.5 is the arithmetic ceiling; this is the highest-scoring item in the backlog that is not a small-effort web nit, and `12.5` on an `M` item is a genuinely severe signal rather than a rounding artifact. **Its score sits below IMP-205 (15.0) only because that item is `S`-effort; IMP-204 is the one that is deterministically breaking the deploy today, and if the two are ever triaged together this one goes first.** Risk `med` because criterion 2 changes a contract IMP-004 (`468b80d`) deliberately installed: the hard-fail is correct for a *total* failure and must survive (criterion 2 says so explicitly), but a partial refusal is currently indistinguishable from a total one, and making it distinguishable weakens the loudest failure signal the pipeline has. The PR body must argue that trade-off rather than assert it, and the existing IMP-004 tests are the check. Cross-references, deliberately **not** duplicated: **IMP-095** (TODO, 12.0) is "Cap `UNLIMITED` under arXiv's 30,000-result ceiling" and already owns the constant in criterion 1; its own Intent assumes "the retention `break` stops long before that" and only asks for a clamp, which is **not** sufficient — the deploy runs uncapped and `main()` discards every category, and neither half is in IMP-095's scope. **IMP-183** (TODO, 7.5) bounds the retention window in the arXiv query "instead of relying on the sort" and would reduce the page count; it is a complement, not a substitute, and landing it does not close criterion 3's deploy default. **IMP-205** owns the step cap's thin slack, which only becomes reachable once this item stops the run early. **IMP-211** owns the readme's unverified `cs.AI` / `start=9000` figures and stays open until the numbers are re-measured or hedged. **IMP-195** (TODO, 10.0) owns stale measured figures in the profile and the readme, but not this claim. Raised as R-1 (HIGH) in `.improve/reports/verify-IMP-031-r2.md` §3 and §6, and as D-9 in `.improve/reports/discovered-IMP-031.md`; disclosed in `readme.md:73-76` but deliberately not fixed there, because `scripts/` was outside the docs item's scope. Evidence caveat, stated honestly: the *mechanism* and the code-side defect were confirmed deterministically, and the upstream ceiling was confirmed from the manual; the specific live offset (`start=10000` → 500) and the `cs.AI`-specific attribution are **implementer-only** and must not be written into this item's own acceptance criteria as if they were verified. | commit pending; attempt 2 PASS

### IMP-216 — Stop a deep-offset arXiv 5xx from deleting a category the index already holds papers for
- **Status:** DONE
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:68-101` (`DEPLOY_OFFSET_BUDGET = 10000` at `:101`, with the derivation in the comment above it), `scripts/build_index.py:349-366` (`collect_papers`'s `status["failed"]` branch; `truncated.append(category)` at `:358`), `scripts/build_index.py:387-437` (`categories_in_records` at `:387` and `reconcile_failed_categories` at `:404`, called from `main` at `:616`), `.github/workflows/deploy.yml:141` (`run: python scripts/build_index.py --max-per-category 10000`) and its comment block `:79-140`, `tests/test_build_index.py:486-599` (`PartialCategoryFailureTests`), `tests/test_build_index.py:600-669` (`ReconcileFailedCategoriesTests`), `tests/test_build_index.py:1045-1168` (`ManifestShardAgreementTests`), `tests/test_build_index.py:1301-1461` (`DeployStepCommandTests`), `readme.md:185-198` (the deployment paragraph) and `readme.md:85-93` (the build-script paragraph), `web/src/lib/failureCopy.ts:103-117` (already renders both cases correctly, and is **unchanged** by this item)
- **Intent:** arXiv answers `cat:cs.AI` with a reproducible HTTP 500 at `start=10000`, on the exact bare command `deploy.yml` ran, so two consecutive full production builds both lost `cs.AI` at that identical offset while every other category paginated past it cleanly — and the client's 6-attempt retry loop does not help, because 6 attempts over ~60 s all returned 500. The deployed consequence was worse than a missing category: `collect_papers` classified a mid-paging death as a total failure, so the manifest dropped the chip **and** `failureCopy.ts` then told the reader `cs.AI` "has no papers here" about shards that had just been written full of its papers. Profile row **PY-17** predicts exactly this failure mode and names IMP-095 and IMP-204, and neither of them prevents it.
- **Acceptance criteria:**
  1. **The deploy's paging depth is bounded, and the bound is structural.** `.github/workflows/deploy.yml`'s index step passes `--max-per-category` explicitly, and the value is sized so the deepest `start` the deploy can ever request is strictly below `DEPLOY_OFFSET_BUDGET` for **every** category at **every** category size — not merely for today's measured windows. `Client` requests `page_size` (1000) results at `start` and advances by `page_size`, so the deepest requestable offset is the largest multiple of `page_size` below the cap; with the shipped cap that is `start=9000`. A cap of `10001` (deepest `start=10000`) fails this criterion, and so does any cap that leaves the cap-to-`page_size` relationship unpinned. The comment above the step cites the constant by name so the two cannot drift apart silently.
  2. **A category that dies mid-paging is truncated, not failed.** A query that fails after yielding at least one **in-window** record keeps its chip and is recorded in `truncatedCategories`; a query that failed having produced zero in-window records stays in `failedCategories` and keeps IMP-004's loud `logging.error`. The degraded branch still logs at `ERROR`, so IMP-204's failure signal is not weakened by design, and a query that only ever saw stale results is **not** rescued by this rule.
  3. **The records get the last word on the manifest.** For every category in the written manifest's `failedCategories`, no paper in the written shards carries it — checked over both `categories` and `primaryCategory`, because arXiv cross-lists and a chip filters on the latter. This is an invariant rather than an artifact of the fixture: a category can be in `failures` while a shard holds papers carrying it, reached by a route no query-layer check can see. Each move between the two lists is logged at `WARNING`, and both lists are rebuilt in requested-category order so a manifest reads the same whichever path put a name in it.
  4. **Nothing on screen contradicts the shards.** A category holding papers keeps its filter chip and gets `failureCopy.ts`'s truncated sentence ("was cut off at this index's per-category limit, so older papers from it may be missing"); only a category that genuinely holds nothing gets the "has no papers here" sentence. `web/src/lib/failureCopy.ts` needs **no** change, and no file under `web/` is created, modified or deleted by this item.
  5. **The cap test measures against the real window sizes and points at the live harm.** `test_the_cap_is_measured_against_the_real_window_sizes` keeps measuring the shipped cap against the measured 60-day windows and now asserts the cap is **below** the largest of them (`< 10,785`), with a docstring recording what it used to require, why that is unsatisfiable alongside criterion 1, and the papers-lost cost in numbers. The PR body states the cost per category: `cs.AI` loses **785 of 10,785 (~7%)** under the shipped cap, while `cs.CV` (6,742), `cs.LG` (9,723), `cs.CL` (5,213) and `cs.RO` (3,275) lose nothing.
  6. **The defect and the fix are both demonstrated, not argued.** A loopback stub answers 200 with a full Atom page below a chosen `start` and 500 at or above it, with per-category `totalResults` set to the real measured windows, and is reached through the public class attribute `arxiv.Client.query_url_format` so no private attribute of the library is patched. The script is `runpy`-executed with the `run:` line **read out of `deploy.yml` itself**, so the command under test is the one that ships. Quote, for the pre-fix tree and its pre-fix command: `cs.AI` deleted, `failedCategories: ["cs.AI"]`, `start=10000` requested, and `cs.AI` papers present in the shards anyway; and for the fixed tree and the shipped command: `start=10000` never requested, `failedCategories` absent, `truncatedCategories: ["cs.AI"]`, the same papers on disk. Non-vacuity is then shown by four reverts — full revert of `scripts/build_index.py`, the layer-1 classification alone, the reconciliation alone, and the deploy cap back at `30000` — each quoted red in a throwaway tree. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` stays green and offline (118 tests today from a 104 baseline: 14 added, none deleted, skipped, weakened or `expectedFailure`-marked), `cd web && npm run typecheck && npm test` is unchanged (20 files, 293 tests), `requirements.txt` is untouched, and no `timeout-minutes:` moves.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` → `Ran 118 tests` / `OK`; `cd web && npm run typecheck && npm test` → `Test Files 20 passed (20)` / `Tests 293 passed (293)`; then criterion 6's harness against a `/tmp` copy of the tree, quoting both runs' exit code, `categories`, `failedCategories`, `truncatedCategories`, `totalPapers`, the offsets requested and the deepest offset per category; then the four reverts with their `FAIL:` / `ERROR:` lines quoted; then `grep -n "max-per-category" .github/workflows/deploy.yml` (→ `:141 … 10000`) and `grep -n "DEPLOY_OFFSET_BUDGET" scripts/build_index.py` (→ `:101`). `readme.md:185-198` and the deploy step comment must state the same cap, the same structural argument and the same 785-paper cost. Nothing under `web/` is run for the fix itself; the two web commands are the no-regression check.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-204
- **Priority score:** 12.5
- **Notes:** **DONE** (commit above). Implementer reported a ~785-paper cs.AI loss; the independent verifier proved pre-fix and post-fix write IDENTICAL id sets (34,953 papers), so the marginal loss is zero - arXiv refused start=10000 either way. The defect was that the loss was invisible and dishonest, not that it existed. Three accuracy defects the verifier raised (a false absolute in readme.md:199, a test message conflating an offset with a paper count, and an unfalsifiable assertion) were fixed in a second pass before commit. Impact 5 — a live production defect on the exact command the weekly deploy ran, whose deployed symptom was a reader being told a category the index was full of has no papers. Confidence 5 — two consecutive full production builds reproduced it at the identical offset and the mechanism is deterministic against a stub. Effort `M`, so 5 × 5 ÷ 2 = **12.5** is the arithmetic ceiling for any `M` item; it sits below IMP-205 (15.0) only because that item is `S`-effort. Risk `med` because it moves a deployed contract in two places at once, the classification and the cap, and both change what a reader sees. **Criterion 4 of the original spec was unsatisfiable alongside criterion 3, and the resolution was to move one assertion, not to delete a test:** criterion 3 required the deepest requestable offset to stay below the refused one, while criterion 4 required `test_the_cap_stays_clear_of_the_real_window_sizes` to keep asserting `cap >= 2 × 10,785 = 21,570`; any cap deep enough to hold a 10,785-paper category must request `start=10000`, so **every** cap satisfying criterion 3 is below 21,570 and the two cannot both hold. The implementer moved the assertion criterion 4 names — the test was renamed `test_the_cap_is_measured_against_the_real_window_sizes` and now asserts `cap < 10,785`, the same cap and the same measurement pointing the other way — kept the test, and recorded in its docstring what it used to require and why; nothing was `expectedFailure`-marked. The reasoning: the old assertion guarded against a cap-bound truncation being *silent*, and that harm was already closed by other means, since `collect_papers` records such a truncation in `truncatedCategories` and the site announces it, so the new assertion points at the harm that is live. **The deploy's index step became a depth bound, not a cap on volume:** `DEPLOY_OFFSET_BUDGET = 10000` (`scripts/build_index.py:101`) is the largest `start` the deploy may ever request, and `deploy.yml:141`'s `--max-per-category 10000` is sized from it so the deepest request is `start=9000` at any category size, forever; 9,000 is the deepest offset arXiv is known to have answered (`cs.LG` reached it on 2026-10-02) and 10,000 is the first known to be refused. Pinning the *relationship between the cap and the offset* does not decay as categories grow, which pinning an offset would, so this item needs no revisiting when a category outgrows 10,000 papers. **A category that dies mid-paging is classified truncated rather than failed, and that classification is then reconciled against the records**, so cross-listing cannot let the manifest claim "no papers" for a category whose papers are already in the shards; the two-layer design is what makes criterion 3 an invariant, since the layer-1 fix alone leaves the cross-listing case reachable and therefore needs its own unit guard. **Two corrections to the original spec's own supporting claims, both measured:** "IMP-183 does not avoid the fault" is right about **depth** and wrong as a corollary, because IMP-183 reduces the total rather than the depth and, with this cap, `cs.AI` is the **only** one of five categories that truncates — so IMP-183 landing would move the incomplete-index notice from naming `cs.AI` to naming nothing. **The honest cost, recorded rather than buried:** `cs.AI` loses **785 of 10,785 papers (~7%)** on a healthy run and the shortfall is **announced on screen** (`truncatedCategories`, rendered by `failureCopy.ts:111-116`); the other four categories lose nothing. What the index actually loses is *less* than 785, by however many of those papers are cross-listed and arrive through another category's query — that figure is not measured and is not claimed. Against that: before this change `cs.AI` was deleted from the index on every build that reached the fault, and its ~10,000 collected papers were fetched, written to the shards and then denied on screen, so the cap and the "no papers here" claim were the same bug. **A product call, not an implementer's:** whether the deploy should carry `--max-per-category` at all, and at what value, is a maintainer's decision about how much of a category to keep; the constant's own comment (`scripts/build_index.py:98-100`) says so and names itself as the place to change it. What this item settles is the *shape* of the bound, not the number. **Cross-referenced, deliberately not duplicated: IMP-205** derives the index step's `timeout-minutes` from the measured page count, and this item's depth bound **changes that item's number** — 38 pages → 37 on a healthy run, compound worst case 4,460 s → 4,390 s, slack 40 s → 110 s — so IMP-205's own finding is slightly *less* urgent and the deploy comment records the new figure so IMP-205 need not rediscover it. **IMP-095** (12.0) owns the `UNLIMITED` constant and **IMP-204** (DONE, 12.5) installed the partial-index contract this builds on; neither prevents the fault, since IMP-095 asks for a clamp on a constant the deploy no longer uses and IMP-204's cap was arXiv's own 30,000 ceiling, which is exactly what made `start=10000` reachable. **IMP-198** owns the request timeout, and retry count stays a separate dial: `test_raising_the_retries_does_not_stand_in_for_a_depth_bound` pins that `DEFAULT_NUM_RETRIES` and `DEPLOY_OFFSET_BUDGET` are not substitutes for one another. **IN-PROGRESS, not TODO:** an implementation of this spec is already in the working tree, **uncommitted**, awaiting verification — `scripts/build_index.py`, `tests/test_build_index.py`, `readme.md` and `.github/workflows/deploy.yml` all show `M` in `git status` (669 insertions across those four files, nothing committed) and `/usr/local/bin/python3.11 -m unittest discover -s tests -v` measures `Ran 118 tests in 1.118s / OK` against the 104 baseline. The full report, including the reproduction harness and all four mutation logs, is `.improve/reports/impl-IMP-216.md`; the criteria above are transcribed from it and are what a verifier should check, rather than the report's summary of itself. Evidence for the original defect: **D-1** of `.improve/reports/discovered-IMP-030.md` (two consecutive full production builds, `start=10000` for `cat:cs.AI` only, 6 attempts over ~60 s all 500, and the workaround used at the time was `--retention-days 30`), plus profile row **PY-17**.

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
- **Notes:** Risk `med` because this introduces direct HTTP downloading in place of the library's helpers, which is a new failure surface (timeouts, redirects, content types). No new dependency is introduced — use `urllib.request` from the standard library, or `requests` which `arxiv` already depends on; say which in the PR body. The arXiv download URL path must carry the same terms-of-use delay as the client (`scripts/arxiv_common.py:16`); do not add a bare hammer loop. Pairs with IMP-033 (upper bound on `arxiv`), which changes which versions this item must support — do not batch them into one PR. **Verified evidence added 2026-10-02, and AC1's migration path is already concrete enough that no separate item was filed for it.** (a) arxiv **3.0.0 already deprecates** both helpers in its own source — `arxiv/__init__.py:235-236` reads *"Deprecated: future versions of this client library will not provide download helpers (out of scope). Use `result.pdf_url` directly."* — so the breakage is announced one major version *before* it happens, and `grep -n "def download" ` over the installed package returns hits on 2.1.0/3.0.0 and **zero** on 4.0.0/4.0.1. (b) Both replacements named in AC1 are verified present on **both** sides of the break: `Result.pdf_url` and `Result.source_url` exist on 3.0.0 *and* on 4.0.0/4.0.1, so the fix does not need a version branch — AC1's "falling back to a `result.source_url` attribute or method only if the installed arxiv exposes one" is satisfiable with a single `getattr` on every version in `[2.1.0, 4)`. (c) **N3, the except tuple:** `scripts/paper-collector.py:245`'s `except (arxiv.ArxivError, OSError, tarfile.TarError)` does **not** catch `AttributeError`, measured on all three installed versions — `AttributeError` escapes the clause everywhere, and that *is* the 4.x crash. This is what AC2 ("the `except` at `:80` is widened so no unexpected exception from an optional download can abort the run") exists to fix, and the pin in IMP-033 only makes 4.x uninstallable — it does not touch the handler, so do not read IMP-033's DONE as closing this. (d) The green Python suite is **not** evidence here: the repo's own `tests/` pass 77/77 against arxiv 4.0.1, the known-broken version, because `tests/test_build_index.py` replaces `iter_results` with fakes and every result fixture is a `SimpleNamespace`-style double, never a real `arxiv.Result`. AC3's fake-based tests are therefore mandatory, not optional. **Line drift:** this item's Area field cites `scripts/paper-collector.py:74-79` and `:80-81`; in the working tree the `download_pdf` / `download_source` calls are at `:239` and `:241` and the `except` is at `:245` — read the line from the file, per FEATURES.md's evidence rule 1. Evidence: §2, §7 N1 and §7 N3 of `.improve/reports/verify-IMP-033.md`; IMP-033 (DONE) names this item as the substitute for the removed-API work, and its `requirements.txt` comment's "This is a floor, not the fix" framing is verified accurate.

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

### IMP-176 — Decide what a paper with no usable `published` date should do to the feed
- **Status:** NEEDS-HUMAN
- **Category:** Data validation
- **Type:** bug-fix
- **Area / files:** `web/src/lib/paperIndex.ts:294` (`.filter((paper) => paper.published && paper.published >= start)`), `web/src/components/PaperCard.tsx:20-24` (`formatDate`, which returns a non-date string unchanged)
- **Intent:** A shard paper with `published: null` is **silently filtered out**, not rejected. Measured: setting `published: null` on one rendered paper took the count from 2,812 to 2,811 papers and produced zero alerts and zero console errors; the error boundary correctly did nothing because nothing threw. A researcher browsing the feed cannot tell that a paper is missing from their window, and no operator signal says the index is malformed. `formatDate` compounds it — a non-date string renders as a nonsense date rather than a visible gap. This is silent data loss in a research feed, and whether that is acceptable is a product decision, not an engineering one.
- **Acceptance criteria:**
  1. The decision stated in Notes is implemented in **one** place, and the other policy is not half-implemented: either (a) a paper whose `published` is missing or non-string is counted, logged, and surfaced through the existing partial-load notice, or (b) a shard containing such a paper fails the window with the IMP-016 hard panel and its "Try again" button. Option (b) must not be implemented as an early `return` that leaves `loading` true — that is IMP-173's deadlock.
  2. Whichever policy is chosen, `web/src/lib/paperIndex.ts:294`'s silent `.filter` is no longer the only thing between a malformed record and the feed: the chosen path either counts it or fails on it, and the count or shard filename appears in `console.error` or in the notice text.
  3. A new test in `web/src/lib/__tests__/paperIndex.test.ts` feeds a shard containing one paper with `published: null` and asserts the chosen behaviour exactly — a `failedFiles` entry naming that shard under (a), or a rejected `loadPapers` under (b). `cd web && npm run typecheck && npm test` passes with 15 test files and **233** tests, no existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then serve a scratch copy of the data directory with one rendered paper's `published` set to `null` and confirm the reader can tell — either the result count drops **and** a notice names the affected week, or the window fails loudly with a retry. Screenshot to `.improve/artifacts/IMP-176/feed-null-published-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Raised as spec inaccuracy 9.2 in `.improve/reports/verify-IMP-018.md` §9.2, which states the real defect "is *silent data loss*, which belongs to runtime validation (IMP-098), not to a boundary". IMP-098 (TODO, `10.0`) does own dropping malformed papers and explicitly requires logging the drop count, but its acceptance criteria name only `id`, `title`, `authors` and `abstract` — **not** `published` — so it does not cover this record. Do not widen IMP-098's criteria in place to absorb this item; the decision below comes first. Confidence is 4 rather than 5 because the behaviour is measured but the severity is exactly what is undecided.
**NEEDS-HUMAN — product decision required.** Decide which of two honest behaviours the feed should have when a shard paper has no usable `published` date: (a) drop the paper but **count it and say so**, extending IMP-098's drop-and-log policy to this field; or (b) treat the shard as malformed and fail the whole window loudly with the IMP-016 panel. Option (a) preserves availability and loses one paper quietly-but-visibly; option (b) preserves the "the feed is complete or it says it is not" guarantee IMP-015 shipped, at the cost of hiding every other paper in that week over one bad record. This is a product call about whether a research feed may quietly omit a paper, and an implementer must not make it unilaterally. **Decision needed before implementation.**

### IMP-177 — Name the partial-shard alert with the same words the reader can see
- **Status:** TODO
- **Category:** Accessibility
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:664-675` (the `failedShards.length > 0` `role="alert"` banner), `web/src/App.tsx:667` (`aria-label="Some papers could not be loaded"`), `web/src/App.tsx:672-674` (the visible text: the `<strong>` plus `describeFailedWeeks(failedWeeks)` and "…so the feed below is incomplete. Everything that did load is shown.")
- **Intent:** IMP-017 gave this alert an `aria-label` so the shard file name in `title` would stop becoming its accessible name — correct, and the reported symptom is gone. But the label it chose is the alert's own `<strong>`, which is only the **first sentence**. Because `alert` is an author-named role, a screen reader announces the `aria-label` and not the element's contents, so the announcement is "Some papers could not be loaded" with no week count and no date range. A screen-reader user is told the feed is degraded and not which weeks are missing — the one fact the notice exists to convey, and the one IMP-015 shipped.
- **Acceptance criteria:**
  1. `web/src/App.tsx:667`'s `aria-label` is computed from the same strings the banner renders, so the accessible name contains the visible sentence **and** the week description — e.g. `` `Some papers could not be loaded. ${describeFailedWeeks(failedWeeks)}` `` — rather than being a literal duplicating only the `<strong>`. It derives from `failedWeeks`, so it cannot drift when the prose changes.
  2. The label does not reintroduce the file name or HTTP status that IMP-017's criterion 2 removed from the visible text: the rendered accessible name contains no `.json`, no `HTTP`, and no raw `Error.message`. The `title` at `:668-670` keeps the technical detail and is unchanged.
  3. A new test in `web/src/__tests__/App.partialShard.test.tsx` asserts the `role="alert"` node's accessible name starts with the visible `<strong>` **and** contains the failed week's date range — the same label `describeFailedWeeks` produced — and that a `title` is still present. The existing IMP-015 and IMP-017 assertions in that file pass unmodified.
  4. `cd web && npm run typecheck && npm test` passes: 15 test files, **233** tests (232 pre-existing + 1), no existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then serve a data directory with one shard removed, open the feed in Chromium, and read the alert's name from the accessibility snapshot — it must be "Some papers could not be loaded. One week in this window failed to load (Sep 24 – Sep 27, 2026)" — and confirm no `.json` or `HTTP` appears in it. Screenshot to `.improve/artifacts/IMP-177/feed-partial-shard-name-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 12.0
- **Notes:** Rated MEDIUM by the IMP-017 verifier and recorded in `.improve/reports/impl-IMP-017.md` "Finding (c)". It is WCAG 2.5.3 in the direction that matters: the visible label is a **prefix** of the accessible name, so voice-control users can still say the visible words — the defect is that the accessible name is *shorter* than the visible text, not that it contradicts it. Cross-reference: this is the same author-named-`alert` trap IMP-017 fixed at `App.tsx:631` (`aria-label={error.message}`, already the full visible string) and IMP-018 fixed in `web/src/ErrorBoundary.tsx:76` (whose label **does** equal its `<h1>`); neither covers this third site. Do not "fix" it by deleting the `aria-label` — that is what put the shard file name into the accessible name in the first place.

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
- **Notes:** Keep this consistent with IMP-020, which removes the ordered-`break` dependency that currently keeps the run well under the ceiling. **Superseded in scope by IMP-204 (TODO, 12.5) — read that item first.** This item's Intent ("Today the retention `break` stops long before that, but if it ever stopped working…") is now known to be optimistic in a way that matters: `.github/workflows/deploy.yml:55` runs the **bare, uncapped** command, so the run is not bounded by anything local, and when a deep-offset 5xx does fire, `collect_papers` records the failure and `main()` discards **all five** categories and writes nothing. That was reproduced deterministically against a stubbed upstream. IMP-204 owns the bound *plus* per-category degradation *plus* a documented default for the deploy path; this item still owns the constant alone, so a PR that only lowers `UNLIMITED` closes this item and leaves the production failure untouched. Do not renumber either, and do not treat an IMP-204 PR as discharging this one without a PR-body line saying the constant moved here.

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
- **Notes:** Risk `med` because a strict validator will reject data the app currently renders "successfully" (badly). Log every rejection and, on the first run against a real index, confirm the rejection count is zero before tightening. **Cross-reference — this is the item that owns the "data validated only by cast" half of profile defect WEB-07** (`REPO_PROFILE.md:685`); the other half, the missing React error boundary, was fixed by IMP-018 (DONE), whose report failed to name WEB-07 as `.improve/reports/verify-IMP-018.md` §9.4 records. Two read sites to cover, not one: `web/src/components/PaperCard.tsx:50` (`paper.abstract.length`) and, reached from the **search box** rather than by scrolling, `web/src/lib/search.ts:55-57` (`paper.title.toLowerCase()`, `paper.authors.join`, `paper.abstract.toLowerCase` — measured blanking the page on a query that matches nothing, per `.improve/reports/discovered-IMP-018.md` §1). `published` is deliberately **not** in this item's field list; see IMP-176, which needs a product decision first and must not be settled by widening these criteria.

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
- **Notes:** Keep `encoding="utf-8"` and `ensure_ascii=False` exactly as they are at `:241,244`; only the file lifecycle changes. **This item owns profile trap `PY-7`, confirmed twice after the fact:** `.improve/reports/discovered-IMP-021.md` D1 records that after IMP-021's reorder a crash during a same-week shard write — the normal weekly-deploy case — leaves the deployed `index.json` pointing at a 24-byte shard, and `.improve/reports/verify-IMP-021.md` F-2 injects `OSError(28)` mid-write and records `index.json` truncated to `'{\n  "totalPapers": 1,\n  "sha'` (24 bytes, `JSONDecodeError`) with the old shards still on disk. Neither is fixed by ordering, and neither is claimed by IMP-174 or IMP-179. Note also `.improve/reports/discovered-IMP-021.md` D2: if `PY-9` (error handling around `write_index`) is ever implemented as `return 0` or as a `finally` that sweeps stale shards, the ordering guarantee is silently voided — that form is forbidden.

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

### IMP-168 — Suffix the reserved-name **stem**, not the whole slug, in `safe_filename`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:65-67` (the reserved-name branch of `safe_filename`), `scripts/paper-collector.py:35-41` (`WINDOWS_RESERVED_NAMES`), `scripts/paper-collector.py:53-59` (the docstring promise it fails to keep), `tests/test_paper_collector.py:109-112` (`test_reserved_name_before_a_long_extension_is_still_suffixed`)
- **Intent:** IMP-023 (`297ed71`) made `safe_filename` a real sanitizer, but its reserved-name branch appends the `_` to the **end of the whole slug**, so `con.txt` → `con.txt_` and `NUL.tar.gz` → `NUL.tar.gz_`. Windows resolves a device name from the portion before the **first** dot and ignores the extension — which is precisely why Microsoft documents `NUL.txt` and `NUL.tar.gz` as reserved — so `con.txt_` still names the console device, and `f"{title_slug}.pdf"` at `paper-collector.py:214` turns `NUL` into `NUL.tar.gz_.pdf`, which Windows still resolves to `NUL`. The function's own docstring promises a slug that "must never name a reserved Windows device", and the promise is not kept for any of the 22 names followed by an extension. The suite cannot see it: `test_reserved_name_before_a_long_extension_is_still_suffixed` (`tests/test_paper_collector.py:109-112`) asserts only `slug.startswith("CON.x")` plus a byte bound, so it passes while every one of those outputs is still a device.
- **Acceptance criteria:**
  1. In `safe_filename` (`scripts/paper-collector.py:52-71`) the reserved-name branch inserts the `_` at the **end of the stem before the first dot**, so for every form that carries a dot the returned slug satisfies `slug.split(".")[0].upper() not in WINDOWS_RESERVED_NAMES` — e.g. `con.txt` → `con_.txt` and `NUL.tar.gz` → `NUL_.tar.gz_`, or a single flattened `con_txt`; pick one rule and apply it identically on every path. An input with no dot keeps today's behaviour: `safe_filename("CON") == "CON_"`.
  2. For each of the 22 names in `WINDOWS_RESERVED_NAMES` and each of the forms `NAME`, `name.lower()`, `NAME.title()`, `NAME.txt`, `NAME.tar.gz`, `NAME.json`, `NAME.` and `NAME.x` — 176 cases — the returned slug is non-empty, is neither `.` nor `..`, contains no path separator, is at most 200 UTF-8 bytes, and has a stem that is not a device name.
  3. No other behaviour changes: `test_documented_topics_stay_readable` (`tests/test_paper_collector.py:119-127`) and `test_names_that_only_start_like_a_device_are_untouched` (`:114-117`, covering `CONSORTIUM`, `com10`, `lpt0`, `auxiliary losses`) pass **unmodified**, `safe_filename("..") == "_"` still holds, and `safe_filename("x" * 400)` is still exactly 200 bytes.
  4. `tests/test_paper_collector.py:109-112` is rewritten to assert the **result** is not a device name — `slug.split(".")[0].upper() not in paper_collector.WINDOWS_RESERVED_NAMES` for `"CON.txt"`, `"NUL.tar.gz"`, `"COM1.json"`, `"aux.md"` and `"lpt9.csv"` — replacing the `startswith("CON.x")` assertion. The replacement must be strictly stronger, and non-vacuity must be demonstrated: run the new assertion against `git show HEAD:scripts/paper-collector.py` in a `/tmp` copy and quote the failure count, as the IMP-023 verifier did for its own new tests.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util; s=importlib.util.spec_from_file_location('pc','scripts/paper-collector.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); [print(repr(m.safe_filename(x)), m.safe_filename(x).split('.')[0].upper() in m.WINDOWS_RESERVED_NAMES) for x in ('con.txt','NUL.tar.gz','COM1.json','aux.md','lpt9.csv','CON','CONSORTIUM')]"` must print `False` in the second column for every one of the seven inputs.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 — Windows-only, narrow input, no traversal and no overwrite of anything a user owns; the failure is that the sanitized name *is* the device, so the write lands on the console or `NUL` instead of the disk. Confidence is 5: the mechanism is fixed at `paper-collector.py:65` and was reproduced on Python 3.9.6/3.11.8/3.14.3. This is **not** a regression — the pre-IMP-023 one-liner returned `con.txt`, equally a device — and it reopens nothing IMP-023 closed (its criteria 1, 3 and 4 are untouched); the IMP-023 verifier scored criterion 2 MET because the criterion's literal wording ("gains a `_` suffix") is satisfied while flagging the intent as only partly delivered. Cross-references, deliberately not duplicated: IMP-023 is DONE and correct as scored; IMP-162 touches `scripts/paper-collector.py` on the same extraction path but concerns `TarInfo.mode`; IMP-050 rewrites the same `title_slug` call sites to honour `--output-dir` and must not absorb this. The sibling slug-collision finding from the same verification is IMP-171. Issues **I1** and **I2** in `.improve/reports/verify-IMP-023.md`; also §6 of `.improve/reports/regression-sweep-2.md`, whose CLI table shows `NUL.txt` → `NUL.txt_` and does not flag it.

### IMP-169 — Reject prototype-keyed collection ids in `isCollection`
- **Status:** TODO
- **Category:** Security
- **Type:** bug-fix
- **Area / files:** `web/src/lib/collections.ts:116-127` (`isCollection`, which validates `id`/`name`/`paperIds[]` but never consults `PROTOTYPE_KEYS`), `web/src/lib/collections.ts:40` (`PROTOTYPE_KEYS`), `web/src/lib/collections.ts:84` (`isPaper`'s matching `!PROTOTYPE_KEYS.has(paper.id)` guard), `web/src/lib/collections.ts:319` (`loadState`'s `parsedCollections.filter(isCollection)`), `web/src/lib/collections.ts:264` (`parseExportPayload`'s `isCollection` call)
- **Intent:** IMP-151 (`34ea96c`) added `PROTOTYPE_KEYS` to `isPaper` at `:84` and to `loadState`'s paper loop at `:312`, but left `isCollection` untouched, so a collection whose `id` is `"__proto__"`, `"constructor"` or `"prototype"` is still accepted from `localStorage` and from an import file. This is the same class of defect IMP-151 exists to close, one function over, and it leaves the two validators in a single file disagreeing about what an identifier may be. It is, however, **currently inert**: every use of a collection id was traced — collections live in the `state.collections` array, are matched with `c.id === payload.collection.id`, are used only as a React `key={collection.id}`, and are minted by `newId()` — and none of them reads the prototype chain. No exploit path exists today; what is open is that the next refactor which keys collections into an object reopens it, and that a collection id is the one untrusted identifier in the file with no prototype guard.
- **Acceptance criteria:**
  1. `isCollection` (`web/src/lib/collections.ts:116-127`) rejects a collection whose `id` is in `PROTOTYPE_KEYS`, with a clause structurally identical to `isPaper`'s at `:84`. That clause is the **only** addition to the function — the three existing `typeof`/`Array.isArray` checks at `:122-125` are unchanged.
  2. New tests in `web/src/lib/__tests__/collections.test.ts` assert that `loadState` drops a stored collection whose `id` is `"__proto__"`, `"constructor"` and `"prototype"` while keeping a valid sibling, and that `parseExportPayload` with such a `collection` behaves exactly as it does today for a structurally invalid collection (no throw, papers preserved). Per IMP-161's note, use the existing `hasOwnKey` helper — `Object.hasOwn` is unusable because `web/tsconfig.json:5` sets `lib: ["ES2020", …]` and fails with TS2550.
  3. Nothing legitimate is dropped: `newId()` output is unaffected, and an id of `toString` is still accepted — it is a real own key in the 2,812-paper corpus and is deliberately absent from `PROTOTYPE_KEYS`. Assert both in a test.
  4. `grep -n "PROTOTYPE_KEYS" web/src/lib/collections.ts` reports at least four hits — the declaration at `:40`, `isPaper`, `loadState`, and `isCollection` — so the two validators can no longer drift apart silently.
- **Verification method:** `cd web && npm run typecheck && npm test`; then seed `rpf.collections.v1` in a browser with one collection whose `id` is `"__proto__"` and one valid sibling, hard-reload `http://localhost:5199/research-paper-feed/#view=collections`, and confirm the poisoned collection is absent, the sibling renders, and the console is empty. Screenshot to `.improve/artifacts/IMP-169/collections-prototype-id-desktop-1280.png` against `.improve/artifacts/baseline/baseline-collections-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is deliberately 2, not higher: the verifier traced every use of a collection id and found no prototype-chain read, so this closes an inconsistency rather than a live vulnerability — it is scored identically to IMP-161 for the identical reason. Confidence 5: the absence of the check is a fact in the file as it stands. Cross-references, deliberately **not** duplicated: IMP-151 (DONE) closed the paper-id read/write paths and its criterion 2 names only `isPaper`; IMP-161 guards `mergeImport`'s `papers[paper.id]` write and names `isCollection` only as the site performing its own validation, never as a site that must reject a prototype id; IMP-160 guards the render path, not the validator. Finding **F3** in §8 of `.improve/reports/regression-sweep-2.md`, whose minimal fix is exactly `!PROTOTYPE_KEYS.has(collection.id) &&` in the `isCollection` return chain, and which confirms the gap was left by `34ea96c`.

### IMP-170 — Guard `noCategoriesSelected` on a manifest that actually has categories
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:197-198` (`const noCategoriesSelected = manifest !== null && activeCategories.length === 0`), `web/src/App.tsx:191-192` (`activeCategories = categoryResolution.selected ?? manifest?.categories ?? []`), `scripts/build_index.py:189` (`list(categories or DEFAULT_CATEGORIES)`) and `scripts/build_index.py:300` (`categories = args.categories or DEFAULT_CATEGORIES`) — the reason the state is unreachable today
- **Intent:** IMP-010 (`42e0edb`) made "no categories selected" a distinct, named, reversible state precisely so that a bare-URL `categories: null` ("all categories") could never be presented as an empty selection, and its verifier proved the `null`-vs-`[]` distinction holds across four layers. But `noCategoriesSelected` is guarded on `manifest !== null` alone, not on "the index declares any category at all". With `manifest.categories === []`, a **bare URL with no filter whatsoever** (`categories === null`, meaning every category the index has — of which there are none) renders the "No categories selected" panel plus a "Select all categories" button that cannot change anything: a nominal collapse of the exact distinction IMP-010 established, in a form the item forbids. It is currently unreachable, because `build_index.py` forces a non-empty default list at `:189` and `:300` so a built manifest can never carry an empty `categories`, and `PaperIndex.fetchManifest` only casts. But that cast is unchecked, so a hand-placed or third-party index could trigger it, and the coupling between an app invariant and a producer default is silent in both directions.
- **Acceptance criteria:**
  1. `web/src/App.tsx:197-198` becomes `manifest !== null && manifest.categories.length > 0 && activeCategories.length === 0`, so the named empty state is reachable only when the index declares at least one category.
  2. A manifest whose `categories` is `[]` renders the **generic** empty-filter branch, not the named one: with such a manifest and a bare URL, `document.body.textContent` does not contain `"No categories selected"` and no `"Select all categories"` button is present. The condition still keys on `activeCategories.length === 0`, so a real empty selection against a real manifest keeps its own named message — that half of the change must not regress.
  3. A new test in `web/src/__tests__/App.categories.test.tsx` (the file IMP-010 created) stubs a zero-category manifest, loads a bare URL, and asserts the named branch is not taken. The existing IMP-010 tests — which drive `#cat=` against a two-category manifest and assert `"No categories selected"` **is** rendered — pass unmodified, which is what proves criterion 1 did not over-correct.
  4. `cd web && npm run typecheck && npm test && npm run build` pass, and no test in `web/src/__tests__/App.categories.test.tsx` needed its expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then `npm run build && npm run preview -- --port 5199 --strictPort` against a **copy** of `web/dist` staged under `/tmp` with `data/index.json` hand-edited to `"categories": []` (the repo is never touched), load a bare URL and confirm the named state is absent; then serve the real index, load `#cat=`, and confirm it is present. Screenshots to `.improve/artifacts/IMP-170/feed-zero-category-manifest-desktop-1280.png` and `.improve/artifacts/IMP-170/feed-no-categories-selected-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 and confidence 5: the verifier reproduced the state directly with a stubbed zero-category manifest — `[ZERO-CATEGORY INDEX] hash="" … emptyPanel="No categories selected" selectAllButtonPresent=true` — and confirmed it is unreachable through the shipped pipeline, so this is latent coupling rather than a shipped bug. Cross-references, deliberately **not** duplicated: IMP-010 (DONE) owns the `null`-vs-`[]` contract in `resolveCategories`/`readHash`/`writeHash` and met all four of its criteria; IMP-098 validates the manifest arriving **over the network**, but its criterion 1 only requires `categories` to be a string array — which `[]` satisfies — so IMP-098 does **not** close this and the two are complements rather than substitutes. Non-blocking §6.3 in `.improve/reports/verify-IMP-010.md`, which proposes exactly this one-line guard and notes the optional one-line hardening for "whoever touches this file next".

### IMP-171 — Stop title-derived slugs from colliding in the download and extraction tree
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/paper-collector.py:211` (`title_slug = safe_filename(result.title)` — the single source for all three artifacts), `scripts/paper-collector.py:214` (`f"{title_slug}.pdf"`), `scripts/paper-collector.py:216` (`f"{title_slug}.tar.gz"`), `scripts/paper-collector.py:218` (`f"./extracted/{title_slug}"`), `scripts/paper-collector.py:34` (`FALLBACK_SLUG = "_"`)
- **Intent:** After IMP-023 the slug is a de-facto primary key for three artifacts per paper, and it is derived from the title alone, so distinct topics can share one key. Three collision classes exist on a default case-insensitive APFS volume, all confirmed empirically with `os.path.samefile`: `CON` and `CON_` now resolve to the **same** directory because the `_` suffix IMP-023 introduced lands on a name a real paper may already own (`NUL`/`NUL_` likewise); every dot-only title — `.`, `..`, `///` — collapses to the single `FALLBACK_SLUG = "_"`; and plain case variants (`Report`/`report`, `A Study`/`A study`) collide. The consequence is bounded — two papers' `extracted/<slug>` trees merge and the second `download_source(filename=f"{title_slug}.tar.gz")` overwrites the first — but it is silent, there is no traversal and no escape, and because macOS is case-insensitive by default it will recur on every developer machine rather than only on a case-sensitive CI runner.
- **Acceptance criteria:**
  1. `fetch_papers` derives the per-paper artifact base from something unique to the result rather than from `safe_filename(result.title)` alone — for example the sanitized title truncated more aggressively **plus** the arXiv id (`result.get_short_id()`), or the id alone — so two results whose sanitized titles are equal produce different `{base}.pdf`, `{base}.tar.gz` and `extracted/{base}` paths. One scheme, applied identically at `:214`, `:216` and `:218`; record the resulting on-disk layout in the PR body.
  2. Overwriting silently is not an acceptable outcome under this item. Either criterion 1 holds, or — as an explicitly recorded alternative — the collision is detected and reported: a `logger.warning` naming the colliding base and both results, and the second write skipped rather than performed. Record which branch was taken.
  3. New tests in `tests/test_paper_collector.py` drive `fetch_papers` with two fake results titled `"CON"` and `"CON_"`, and separately with `"."` and `".."`, and assert the four download calls and the two extraction destinations are pairwise distinct — or, under the alternative branch, that a warning is logged and the second write skipped. The test must be shown non-vacuous by running it in a `/tmp` copy against `git show HEAD:scripts/paper-collector.py` and quoting the failure count.
  4. All 2,812 real titles in `web/public/data/papers-2026-W39.json` and `papers-2026-W40.json` produce pairwise-distinct bases under the new scheme, asserted as a count in a test rather than by eye; and `safe_filename` itself is **unchanged** — this is a caller-side change, not a fourth sanitizer rule.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then from a scratch CWD `/tmp/rpf-venv/bin/python scripts/paper-collector.py --topic 'cat:cs.CV' --max-papers 2 --download-sources --output-dir /tmp/rpf-collide` and confirm `ls /tmp/rpf-collide/extracted` holds two distinct directories with no overwrite and that `git status --porcelain` is empty.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 — measured, but negligible in practice: of the 2,812 real titles, **0** collide, and the failure mode is an overwrite rather than data loss or an escape. Confidence 5: the collisions were measured with `os.path.samefile` on this machine's volume and the class is inherent to a title-derived key. Every alternative fallback name has the same property (the verifier's own words), which is why the item is about the **caller** deriving the base rather than the sanitizer inventing more names — hence criterion 4's "do not touch `safe_filename`". Cross-references: IMP-050 (TODO) rewrites these same three call sites to honour `--output-dir` and deletes the `.tar.gz` after extraction; land IMP-050 first (it is 15.0, above this item) and let it carry the distinctness assertion into its criterion-2 test, but do **not** declare a `Depends on`, so this item's unit tests can land independently in the same three lines. IMP-023 (DONE) chose `FALLBACK_SLUG = "_"` deliberately and disclosed the collision in its own report; this item does not reopen that choice. Issue **I3** in `.improve/reports/verify-IMP-023.md` and §8 of `impl-IMP-023.md`. Only the `CON`/`CON_` and dot-only classes are new; the `Report`/`report` case collided under the pre-IMP-023 one-liner too.

### IMP-189 — Cap the length of a `--category` value
- **Status:** TODO
- **Category:** Configuration & defaults
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:41` (`CATEGORY_PATTERN = re.compile(r"^[a-zA-Z-]+(\.[a-zA-Z-]+)?$")` — no `{1,N}` bound on either segment), `scripts/build_index.py:340-350` (`category`, the `argparse` type that applies it with `CATEGORY_PATTERN.fullmatch`), `scripts/build_index.py:240` (`query = f"cat:{category}"`, where the unbounded value reaches arXiv), `tests/test_build_index.py:637` (`test_malformed_categories_are_rejected`)
- **Intent:** IMP-022's AC2 quotes the category regex verbatim and the implementer kept it verbatim, which was the correct reading — so the character class is exactly right and the pattern is missing only a **length** bound. Measured: `--category "$(python3 -c 'print("a"*300)')"` **exits 0** and the 300-character string is stored verbatim, as are 1 000-, 5 000- and 50 000-character values. The value then reaches `query = f"cat:{category}"` at `:240` and arXiv answers it with an empty feed, which is the precise "indistinguishable from no new papers" symptom IMP-022 exists to eliminate — narrowed to a nonsense query, but not eliminated. It is **not** an injection: the charset is `[a-zA-Z-.]` only, so no shell, path, or query-syntax metacharacter can ride along, which is why impact is 2 and not 4. The longest real arXiv form is `astro-ph.HE`/`q-bio.NC`-class, about 12 characters, so a bound costs nothing legitimate. The residual is also **undocumented**: `.improve/reports/discovered-IMP-022.md` recorded D1–D5 and nothing about length, so per profile §4.6 item 6 it is currently the next implementer's blind spot rather than a recorded decision.
- **Acceptance criteria:**
  1. `scripts/build_index.py:41`'s `CATEGORY_PATTERN` gains an explicit upper bound on each segment — e.g. `^[a-zA-Z-]{1,32}(\.[a-zA-Z-]{1,16})?$` — **or** `category()` at `:340-350` rejects with `argparse.ArgumentTypeError` on `len(value) > 32` before the `fullmatch`. Pick one, name it in the PR body, and state the bound next to `CATEGORY_PATTERN` so the next reader does not re-derive it. The rejection message must name the offending length and the bound, and must name `--category`, matching the existing message format at the `CATEGORY_PATTERN` branch.
  2. `"a" * 300`, `"a" * 1_000` and `"a" * 5_000` each raise `SystemExit` with `code == 2` and write nothing; `argparse`'s message is captured with `contextlib.redirect_stderr` as the existing `CategoryArgumentTests` do.
  3. **No real arXiv form is rejected.** All 15 real category strings IMP-022's verifier enumerated still pass `category()` unchanged: `cs.AI`, `cs.CV`, `cs.LG`, `cs.CL`, `cs.RO`, `cs.SE`, `stat.ML`, `astro-ph.HE`, `astro-ph.GR`, `math.AG`, `eess.SY`, `q-bio.NC`, `q-bio.BM`, `econ.EM`, `physics.optics`. The existing `test_real_category_forms_are_accepted` (`tests/test_build_index.py:629`) passes **unmodified**.
  4. The 30 injection shapes IMP-022's verifier checked are still rejected with the same `code == 2`, so the length check is additive and does not weaken the character class. `test_malformed_categories_are_rejected` (`tests/test_build_index.py:637`) gains a subtest for each of the three long values in criterion 2.
  5. `readme.md` and `python scripts/build_index.py --help` are reconciled in the same change per profile §4.5: if the bound is user-visible, the `--category` documentation states it. `python scripts/build_index.py --category "$(python3 -c 'print("a"*300)')"` exits 2 with the range message and no `--out-dir` is created.
  6. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests plus the new subtest cases, all passing, and `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util; s=importlib.util.spec_from_file_location('bi','scripts/build_index.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); [print(repr(x), (lambda: (m.category(x), 'accepted'))() if __import__('re').fullmatch(r'^[a-zA-Z-.]+$', x) else 'charset-rejected') for x in ('cs.CV','astro-ph.HE','q-bio.NC','a'*300)]"` and confirm the 300-character value reaches the length branch; then `/usr/local/bin/python3.11 scripts/build_index.py --category "$(python3 -c 'print("a"*300)')" --out-dir /tmp/rpf-longcat; echo "EXIT=$?"` must print `EXIT=2` and `ls /tmp/rpf-longcat` must not exist. Network is not required for any of these.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2: a nonsense category is accepted and produces an empty feed, which costs one deploy cycle and a confusing log line, but nothing is corrupted and no untrusted character class is admitted. Confidence is 5 — the pattern is quoted from the file and the acceptance measured at four lengths. Effort is `S` because the change is one bound plus one subtest. **This was deliberately NOT an IMP-022 failure**: AC2 says the pattern is used verbatim, the implementer kept it verbatim, and the verifier scored AC2 MET while recording the gap separately. The item therefore amends a DONE item's regex rather than reopening its criteria, and IMP-022's own acceptance criteria are untouched. Cross-references, deliberately **not** duplicated: IMP-114 (TODO, 10.0) documents `--category` in `readme.md` and its criterion 2 requires readme/`--help` agreement — if IMP-114 lands first, extend its section rather than writing the bound twice; IMP-033 bounds the `arxiv` library version, not CLI values; IMP-046 guards the out-dir, not the category. Finding 1 in §8 of `.improve/reports/verify-IMP-022.md`, which also asks that the residual be filed as **D6** in `.improve/reports/discovered-IMP-022.md` — do that as part of this item, since the profile's residual-recording rule is what makes the gap visible to the next implementer.

### IMP-190 — Pin IMP-004's exit code to `1` instead of "not 0"
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `tests/test_build_index.py:490` (`self.assertNotEqual(exit_code, 0)` inside `test_refuses_to_write_index_when_a_category_query_fails`, which begins at `:468`), `tests/test_build_index.py:461` (`self.assertEqual(exit_code, 1)` in `test_refuses_to_write_an_empty_index` — the correct form, and the model to copy), `scripts/build_index.py:373-378` (IMP-004's `return 1` after the `failures` check) and `scripts/build_index.py:362` (`parse_args`, where argparse's exit 2 is raised)
- **Intent:** IMP-022 made `build_index.py` a **two-exit-code** program: `2` for a contract violation raised inside `parse_args` at `:362`, and `1` for IMP-004's hard fail returned by `main()` at `:373-378`. The only test guarding IMP-004's path asserts `assertNotEqual(exit_code, 0)`, which `2` satisfies — so the exact regression IMP-022 made possible (a rejected flag failing **inside** the loop, or `main()` accidentally returning argparse's code) would leave the suite green. This is **pre-existing and not a regression**: the line is byte-identical at `HEAD:tests/test_build_index.py:386` and IMP-022 does not touch it. The verifier confirmed by direct execution that the two codes really are distinct — a rejected `--category` gives `SystemExit(2)` with **0** network attempts and no `--out-dir` created, while a valid `cs.CV` whose query raises `ArxivError` returns **1** having written nothing — so the behaviour is right and only the pin is weak. The sibling test at `:461` already gets it right, which makes this a one-line inconsistency rather than a design question.
- **Acceptance criteria:**
  1. `tests/test_build_index.py:490` becomes `self.assertEqual(exit_code, 1)`. The test body, its `fake_iter_results` stub, and the two surrounding assertions (`self.assertEqual(os.listdir(out_dir), [])` and `self.assertIn("cs.LG", ...)`) are unchanged, so the test still proves **nothing was written**, not merely that something failed.
  2. Both IMP-004 paths keep separate pins and neither is merged: the query-failure path at `:468` asserts `1`, and the empty-index path at `:453` continues to assert `1` at `:461`. `grep -n "assertNotEqual(exit_code" tests/` returns nothing.
  3. The suite now **fails** if the two codes are confused. In a `/tmp` copy of the repo, change `scripts/build_index.py:373-378`'s `return 1` to `return 2` and run the suite, quoting the failure count; repeat with `parse_args` re-ordered after the network call, quoting the count. Both mutants must be caught, and the mutant that re-orders the parse is the one this assertion uniquely catches.
  4. No other test in `tests/test_build_index.py` is weakened or deleted: `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0`, and the file's `it`/`test_` count is unchanged apart from additions.
  5. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests OK, and it is still **hermetic**: the same run with `socket.socket.connect`, `socket.create_connection` and `socket.getaddrinfo` replaced by raising stubs via a `sitecustomize.py` on `PYTHONPATH` reports 77 OK, confirming criterion 1's test performs no network I/O.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `PYTHONPATH=/tmp/netblock /usr/local/bin/python3.11 -m unittest discover -s tests`; then in `/tmp/v190`, copy the tree, `sed` the `return 1` at `build_index.py:378` to `return 2`, and re-run — the suite must report `FAIL` naming `test_refuses_to_write_index_when_a_category_query_fails`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2: no shipped behaviour is wrong today, and the codes were verified correct by direct execution. The item is about **false confidence in a landed item's only guard** — IMP-004's exit-1 path is the difference between a green deploy and a silently truncated research feed, and a single `assertNotEqual` is not a pin for it. Confidence is 5: the assertion is quoted from the file and the weak mutant was demonstrated, not reasoned about. Effort is `S` — one line, plus the mutant demonstration in criterion 3 that keeps it honest. Cross-references, deliberately **not** duplicated: IMP-004 (DONE) owns the `failures`/`return 1` production behaviour and all three of its criteria passed; this item changes **no** file under `scripts/` and reopens nothing. IMP-046 (TODO, 15.0) guards a different exit-1 path (an unwritable `--out-dir`) and is a production change, not a test tightening. IMP-040 (DONE) adds the regression test that a failed category cannot produce a complete manifest — it asserts the manifest, not the exit code, so the two are complementary. §6.3 and Finding 2 in `.improve/reports/verify-IMP-022.md`; the sibling-exit-code table in §6.2 of the same report is the evidence that the codes are genuinely distinct. **Note the line drift:** the report cites `:388`, which is `:490` in the working tree — read the line from the file, per FEATURES.md's evidence rule 1.

### IMP-194 — Name the `setPapers`/`setFailedShards` batching invariant four `App.partialShard` assertions depend on
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/__tests__/App.partialShard.test.tsx:277`, `:286`, `:315`, `:326` (four alert-state reads that follow an awaited **paper title**, not an awaited alert), `web/src/__tests__/App.partialShard.test.tsx:192-204` (`partialNotice()`, which throws unless exactly one notice matches), `web/src/App.tsx:259-264` (`setPapers(list)` at `:259` immediately followed by `setFailedShards(list.failedFiles)` at `:264` inside one `.then` — the React 18 auto-batching all four assertions rest on), `web/src/App.tsx:273-275` (the hard-failure path's own adjacent pair, the same shape one function below)
- **Intent:** These four sites have the literal shape IMP-192 just repaired — wait for a paper title, then read alert state — and they are safe today **only** because `App.tsx:259` and `:264` are adjacent statements in one synchronous block, which React 18 auto-batches into a single commit, so the awaited title implies the notice. Nothing records that. The comment at `App.tsx:260-263` explains *why one `list` drives both* the feed and the completeness notice ("no second request and no chance of the two disagreeing") but says nothing about the commit boundary, so the invariant four tests depend on is invisible to the next person who touches the pair. Insert one `await` between the two `setState` calls, or move `setFailedShards` into its own effect, and all four become the next flake in exactly the class `regression-sweep-4.md` reported. This is explicitly **not** a claim that they fail now: the verifier measured 0/8 detection for this file's un-amplified race, and `:277` and `:315` are *negative* "the notice must not accumulate" assertions that a `waitFor` wrapper would **weaken** — `waitFor` returns immediately on the current value and would let a second alert mounting one tick later go undetected. The fix is documentation plus an explicit same-commit guard, not a blanket wait.
- **Acceptance criteria:**
  1. A comment at `web/src/App.tsx:259-264` — or immediately above the pair — states the invariant in one or two lines: `setPapers` and `setFailedShards` must be dispatched as **adjacent statements in the same synchronous block** so React 18 commits them together, and splitting them across an `await`, a second `.then`, or a separate effect breaks four named assertions in `web/src/__tests__/App.partialShard.test.tsx`. It names the tests, so the coupling is discoverable from the source and not only from this file.
  2. Each of the four sites carries a short comment naming the same invariant **and why it is not a `waitFor`**: for `:277` and `:315` the count of 1 is a negative "must not accumulate" proof that a `waitFor` would invert; for `:286` and `:326` the `partialNotice()` helper at `:192-204` already throws unless the match count is exactly 1, so the assertion is strict and must not be relaxed to a `findBy*` wait that tolerates 0.
  3. No behavioural change to any of the four tests. Expected counts stay byte-identical to today's — `toHaveLength(1)` at `:277` and `:315`, exactly-one via `partialNotice()` at `:286` and `:326` — `waitFor` is **not** added to any of them as a substitute for the barrier, `git diff -U0 -- web/src/__tests__/ | grep -c '^-[^-]'` is `0` apart from re-wrapped comment lines, and no `.skip`/`.only`/`.todo` appears in an added line.
  4. The invariant is pinned by something **executable**, not only by prose. One new test in `web/src/__tests__/App.partialShard.test.tsx` records, in a single `MutationObserver` callback, the alert count **and** whether the paper title is present in the same commit, and asserts both are true in one observer entry. Only such a test can distinguish one commit from two; an end-state assertion cannot, which is exactly why the four existing assertions cannot see this today.
  5. `cd web && npm run typecheck && npm test` passes, and the reported `Tests N passed (N)` is the pre-change figure **plus exactly the one** test added in criterion 4.
- **Verification method:** `cd web && npm run typecheck && npm test` and quote the `Tests` line; then in a `/tmp` rsync of `web/` with `node_modules` symlinked, insert `await Promise.resolve();` between `setPapers(list)` at `App.tsx:259` and `setFailedShards(list.failedFiles)` at `:264`, run `npx vitest run src/__tests__/App.partialShard.test.tsx`, and quote the failure count — this item's whole point is that the failure is **latent**, so quote whatever number is honestly measured and confirm the criterion-4 test is the one that reports it. Revert and confirm green. No browser check is needed: this is a harness/documentation defect, not a rendered one.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 and **not** higher, stated plainly: no reader sees this, the four tests are green today, and the verifier measured 0/8 un-amplified detection for this file — this is insurance against a refactor, not a red build. Confidence is 5 for both the shape and the invariant, because both are read directly off the files (the four assertion sites and `App.tsx:259-264`); that is what makes effort `S` and the score an honest 10.0. The verifier's own recommendation is "worth a comment at those four lines recording the invariant they depend on, so the next agent who splits that pair knows which assertions just became racy" — criterion 4 is the strictly stronger version of that, and an implementer who takes the comment-only route should say so in the PR body. **Deliberately not a `waitFor`:** the verifier classified `:277` and `:315` under "safe, must not accumulate — count 1 as a *negative* proof", where wrapping in `waitFor` is a **strictness loss**. Cross-references, deliberately **not** duplicated: IMP-192 repaired six *other* sites (`App.loadFailure.test.tsx:886`, `:903`, `:920`; `App.partialShard.test.tsx:421` and `:440`; `App.storage.test.tsx:159`) and none of them is one of these four; IMP-182 (TODO, 7.5) protects the papers-load `useLayoutEffect` from a silent revert — a different statement in the same effect; IMP-178 (TODO, 8.0) adds a `console.error` to the soft-failure path and cites `App.tsx:241-250`; IMP-177 (TODO, 12.0) names the partial-shard alert's **copy**, not its arrival. Evidence: §6 ("Same shape, currently safe by a different invariant — the one thing I would escalate") and §8 addition 5 of `.improve/reports/verify-IMP-192.md`, plus the follow-up in its §9 verdict.

### IMP-195 — Re-baseline the bundle sizes recorded in `REPO_PROFILE.md` and `FEATURES.md`
- **Status:** TODO
- **Category:** Documentation
- **Type:** docs
- **Area / files:** `.improve/REPO_PROFILE.md:121` and `:852` (both say "39 modules"), `.improve/REPO_PROFILE.md:124-126` ("JS 163.72 kB (gzip 52.63) … The JS figure drifts a few hundred bytes per feature commit … the CSS figure is stable at 10.93 kB since recon"), `.improve/FEATURES.md:47` (which quotes "10.93 kB / 163.72 kB" as the profile's *real* figures, inside the very paragraph that exists to condemn an untraceable number)
- **Intent:** The recorded bundle-size baseline is wrong on its own terms and has gone stale on top of that. A read-only rebuild of `1c075b3` — the SHA the profile claims to describe — measures **163,185 B / 38 modules**, not the recorded **163.72 kB / 39 modules**: off by 535 bytes and one module *before any of this loop's work landed*, so the figure was already inaccurate when it was captured. Since then the tree measures **171,472 B / 41 modules** at HEAD, with CSS byte-identical at 10,927 B — the one half of the claim the profile's methodology got right, since the CSS delta is exactly 0. The JS growth is fully attributed by per-module `renderedLength`: `App.tsx` +11,802 rendered bytes, new `lib/urlState.ts` +3,055, new `ErrorBoundary.tsx` +2,159, new `lib/failureCopy.ts` +1,079, plus smaller growth in `lib/paperIndex.ts` (+2,895), `lib/collections.ts` (+1,415) and `components/FeedControls.tsx` (+919) — first-party rendered total 43,618 → 67,305, `node_modules` **0**. The recorded mechanism at `:125` ("a few hundred bytes per feature commit") predicts this exactly; it has simply outgrown the 1 kB band. The cost lands on this loop: IMP-026's AC3 ("within 1 kB of the 163.72 kB baseline") is **unmeetable by any YAML-only change**, its verifier escalated rather than blocked, and a figure no build ever produces is precisely the failure this file's own evidence rules exist to prevent.
- **Acceptance criteria:**
  1. `.improve/REPO_PROFILE.md:124` records the **measured** `1c075b3` baseline as **163,185 B / 163.19 kB / 38 modules**, labelled as the historical recon-SHA figure, with the command that produced it quoted verbatim: `git archive 1c075b3 | tar -x` into a scratch directory, `npm ci`, `npm run build`, then read the `✓ N modules transformed` line and the `dist/assets/index-*.js` byte count. The correction is made **on the record**: the 535-byte / one-module error is stated as an error, not silently overwritten with today's number, so the file keeps saying what it claimed and what is true.
  2. A **current** figure of **171,472 B / 171.45 kB / 41 modules** (CSS 10,927 B, gzip 2.86 kB) is recorded alongside it as the live figure, with its own command quoted, and the two are labelled distinctly so no later reader mistakes one for the other.
  3. `.improve/REPO_PROFILE.md:121` and `:852` both stop saying "39 modules" and each names the figure current in its own context, so no third occurrence of the stale number survives. `grep -n "163\.72\|39 modules" .improve/REPO_PROFILE.md` returns nothing.
  4. `.improve/FEATURES.md:47` is corrected in the same change. It currently cites "10.93 kB / 163.72 kB" as the profile's accurate figures inside the paragraph that exists to show what an untraceable number looks like. Either the figure is replaced with the measured one from criterion 1 or the citation is dropped — either is acceptable, but the wrong number must not remain.
  5. The CSS half is re-confirmed and **left as it stands**: `:125-126` claims the CSS figure is "stable at 10.93 kB since recon", and the measurement says the CSS delta between `1c075b3` and HEAD is exactly **0** B. The PR body says this sentence is validated rather than stale, so a future editor does not "fix" a correct claim.
  6. The tolerance sentence at `:125` is either kept and restated in terms that hold, or removed. A per-commit drift figure cannot simultaneously imply that a 1 kB band is a meaningful gate 53 commits later; if a band is still asserted, its number is stated, and if none is, the file says none.
- **Verification method:** `cd /tmp && rm -rf rpf-rebase && mkdir rpf-rebase && cd rpf-rebase && git -C /Users/denimpatel/Desktop/git/research-paper-feed archive 1c075b3 | tar -x && cd web && npm ci && npm run build`, quoting the `✓ N modules transformed` line and the `dist/assets/index-*.js` byte count verbatim; repeat against `HEAD`; then `grep -n "163\.72\|39 modules\|163\.19\|171\.45" .improve/REPO_PROFILE.md .improve/FEATURES.md` and read every hit. `git archive` is read-only and is preferred over `git worktree add`, which writes to `.git/worktrees` and is a git write command.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2: no reader sees this and no code is wrong — the harm is to **this loop's evidence**, and it is already realised, since IMP-026's AC3 is unmet for a reason no implementer can fix. Confidence is 5 for both figures, which were measured by rebuilding the two SHAs rather than recalled, and the CSS-delta-0 result independently validates the profile's method. Effort is `S`: prose plus two measured numbers. **The file this item edits is `.improve/REPO_PROFILE.md`, not `FEATURES.md`,** and that is called out in the Area field because the escalation arrived as a profile correction and the tempting move is to fold it into a code item. Cross-references, deliberately **not** duplicated: IMP-026 (DONE) added the CI build step and met 2 of 3 criteria; its AC3's size conjunct is unmeetable and its own Notes already carry "AC3 size stale-baseline proven", so this item does not reopen it — it fixes the baseline the AC was written against. IMP-167 (TODO, 5.0) owns the *process* rule that every figure quotes its command; that rule is what made this gap findable, and it is complementary, not a substitute. IMP-105 (TODO, 7.5) and IMP-013 / IMP-014 budget built-CSS growth against the 10.93 kB figure, which criterion 5 leaves valid. Evidence: §3 and §8 rows 1–2 of `.improve/reports/verify-IMP-026.md`, including the per-module `renderedLength` attribution table and the `index-D7spZXJu.js` content-hash identity that proves the CI change itself contributed 0 bytes.

### IMP-196 — Format every `.improve/PROGRESS.log` row through one helper
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** improvement
- **Area / files:** `.improve/PROGRESS.log` (35 rows, all currently `timestamp | item | result | sha` on their own line), `.improve/reports/regression-sweep-4.md:117-184` (the two logged regressions, whose §4 names the durable fix), the hand-formatted append sites that own the row string today
- **Intent:** The progress log's row format — `timestamp | item | result | sha`, exactly four `|`-separated fields, one record per physical line — holds on all 35 current rows, but it was established **inside this loop** and has been broken three times. Two records were once fused onto one physical line (a `FIXED` row appended without a leading newline, so `awk -F'|' '{print NF}'` reported **7** fields where every other row had 4, leaving 29 physical lines for 30 logical records — any parser keyed on one-record-per-line silently dropped the entry recording this repo's most recent fix). Three later rows held the sha in field 1 where the timestamp belonged, with the timestamp gone entirely, field 4 empty, and no column padding. Both defects were repaired after the fact by the loop's next commit. The durable fix was named in the sweep and never landed: each writer hand-formats the same four fields, so nothing prevents a fourth occurrence, and the sweep's own conclusion is that the format "has now broken three times in this file's history". This file is the loop's only durable record of what was done and what it was verified against, so a malformed row is a loss of evidence, not a cosmetic defect.
- **Acceptance criteria:**
  1. One formatter owns the row shape and every append goes through it: a single function taking `(timestamp, item, result, sha)` and emitting exactly one line — four `|`-separated fields, timestamp first, sha last, columns padded to the widths the existing rows use, newline-terminated. No call site builds a row string by hand. Name the helper and the file it lives in in the PR body.
  2. The formatter is the only writer by construction, and the PR body enumerates every site that touches the file. `grep -rn "PROGRESS.log" .improve` must return call sites that all pass through the helper; any site that writes a hand-built string is listed with its reason rather than left implicit.
  3. An automated check exists and is runnable, asserting the invariant directly rather than describing it: every line splits into exactly 4 fields on `|`; field 1 matches `^20[0-9]{2}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$`; field 2 is non-empty; no line is blank. `awk -F'|' 'NF != 4' .improve/PROGRESS.log` prints **nothing** on the current file — quote that empty output as the baseline the check locks in.
  4. The two repaired defects stay repaired and no history is rewritten: the fused `REGRESSION-3 FOUND` / `FIXED` pair occupies two physical lines, and every `DONE` row carries a real timestamp in field 1 and a real sha in field 4. No timestamp, item id, result, or sha value changes — only the formatting the helper now owns.
  5. **The check is demonstrated to fail.** In a `/tmp` copy, append a row by hand with no leading newline (re-creating regression 2 exactly) and re-run the criterion-3 check, quoting the failure it reports and the line number; then append a row with the sha in field 1 (re-creating regression 3) and quote that failure too. Discard the copy. A check never observed failing is not a gate.
- **Verification method:** `awk -F'|' '{print NR": "NF}' .improve/PROGRESS.log` and confirm every line reports 4; confirm `grep -c '' .improve/PROGRESS.log` (35) equals `grep -c '^20[0-9][0-9]-' .improve/PROGRESS.log`, which is the direct test that no record is fused or missing its timestamp; then run criterion 5's two negative controls in a `/tmp` copy.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact is 2 and only 2: the file is correct as it stands, so this is purely preventive. It is filed because the sweep names the durable fix explicitly, it has not been done, and the third occurrence of a class is the point at which "it keeps getting repaired by hand" becomes a defect in the loop's process rather than in any one commit. Confidence is 5 — the file was parsed field by field and the 4-field invariant holds on all 35 current rows, so criterion 3 guards a real, currently-satisfied invariant rather than a guess. Effort is `S`: one helper plus one check. **Neither logged defect is currently present**: the fused pair and the three swapped rows were repaired by the commit that logged `REGRESSION-4 | FIXED` (`PROGRESS.log:32`), which I confirmed by re-parsing all 35 rows — this item owns the *formatter*, not a re-fix. Cross-references, deliberately **not** duplicated: IMP-167 (TODO, 5.0) requires implementer reports to quote the command behind each figure, which governs `.improve/reports/` and not this log's row format; IMP-089 (TODO, 10.0) adds `permissions`/`concurrency`/`timeout-minutes` to `ci.yml` and touches no loop file. Evidence: regressions 2 and 3 in `.improve/reports/regression-sweep-4.md:117-184`, whose §4 recommends "a single `logRow(ts, item, result, sha)` helper — rather than three call sites each formatting the string by hand", and §12's "the format itself has now broken three times in this file's history".

### IMP-206 — Pin the `deploy.yml` job-level caps so a job cap below its step cap is caught
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/deploy.yml:23-26` (the `build` job's `timeout-minutes: 90`), `.github/workflows/deploy.yml:80-83` (the `deploy` job's `timeout-minutes: 15`), `tests/test_arxiv_common.py` (the workflow-cap test, which today asserts a cap is above the client's worst case but not that job > step), `scripts/arxiv_common.py:16-19` (the constants both caps are derived from)
- **Intent:** IMP-198 shipped three `timeout-minutes:` values in `deploy.yml` (job 90, index step 75, deploy job 15) and pinned the **step** caps with tests, but the **job**-level caps are pinned by nothing that checks their relationship to their own steps. `DeployStepTimeoutTests` proves the step cap is above the worst case; nothing proves the job cap is above the step cap. The consequence was demonstrated by mutation: setting `deploy.yml`'s `build` job to `timeout-minutes: 20` leaves the whole suite **green** while the *effective* step budget becomes 1200 s — below the 1800 s pipeline worst case, so GitHub kills the index step first and the deploy dies on a generic timeout instead of `build_index.py`'s own IMP-004 refusal. The shipped values are correct (`75 < 90`), so this is not a live defect; it is a pin that is missing from a set where its siblings were pinned, which is precisely how a future edit lowers it silently. The equivalent CI job cap **is** covered by a test that catches a job cap below 360 s, so the two workflows are not consistent with each other either.
- **Acceptance criteria:**
  1. A test asserts, for **each** `timeout-minutes` present in `deploy.yml`, that the job-level cap is strictly greater than the largest `timeout-minutes` on any of that job's steps. `build` must satisfy `90 > 75` and `deploy` must have no step cap above its 15 (or gain one that is below it). Read the values structurally, not by line number.
  2. The test reads the file **without PyYAML**, which is not a declared dependency and is not installed in CI (only `requirements.txt` is). Follow the existing precedent in `tests/test_arxiv_common.py` — either a minimal structural scan of the `timeout-minutes:` lines with their indentation, or a vendored-free regex pass — and say which in the PR body. A test that needs `pip install pyyaml` to run in CI does not satisfy this criterion.
  3. **Non-vacuity is demonstrated.** In a `/tmp` copy, set `deploy.yml`'s `build` job to `timeout-minutes: 20` and quote the failing test; then delete the `deploy` job's cap and quote the failure. A test never observed failing is not a gate.
  4. The same structural relationship is asserted for `ci.yml`'s `web-tests` job (`timeout-minutes: 25` vs the index step's `15`) so the two workflows are checked by one rule rather than two, and so the asymmetry that produced this item cannot reappear.
  5. **No workflow value changes.** The shipped caps stay exactly `90` / `75` / `15` in `deploy.yml` and `25` / `15` in `ci.yml`; `git diff -U0 -- .github/workflows/ | grep -c '^-[^-]'` is `0`; `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then criterion 3's two mutations in a `/tmp` copy with both failure messages quoted; then `/usr/local/bin/python3.11 -c "import yaml; print(yaml.safe_load(open('.github/workflows/deploy.yml'))['jobs']['build']['timeout-minutes'])"` as a cross-check that the structural scan and a real parse agree on every value (PyYAML is available on this host for the check even though the test must not need it).
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. Impact is 2, not 3, because **no shipped value is wrong** — the hazard is a future edit, and the failure mode (a deploy that dies on a generic timeout instead of the CLI's own message) is the one IMP-198 was written to prevent. Confidence 5 because the mutation matrix was executed rather than reasoned about: `deploy.yml` `build` 90 → 20 survives the suite, and the two other mutants (deleting either deploy job cap) survive too. Risk `low`: a test plus, at worst, one shared helper. The honest constraint is criterion 2 — detecting "a job cap is below its own step cap" needs to associate a cap with the step list of the same job, which is the part that wants a real YAML parse, and PyYAML is not available in CI. A structural scan is cheaper and sufficient for the current three-value file; say in the PR body that it will not survive a reformat of the workflow, and that if the workflows grow a nested structure the test should start failing loudly rather than silently scanning nothing. Cross-references, deliberately **not** duplicated: **IMP-198** (DONE, `b7e23a8`) shipped the caps and `DeployStepTimeoutTests`, which owns the *step* caps; this item is the missing *job* relationship only and must not re-litigate the step values. **IMP-089** (TODO, 10.0) adds `permissions`/`concurrency`/`timeout-minutes` to `ci.yml` wholesale and overlaps criterion 4 — if IMP-089 lands first, criterion 4 is satisfied and should be dropped rather than reimplemented. **IMP-205** owns the deploy *step* cap's thin slack; this item owns the job/step *ordering* and the test that would catch a job cap being lowered. **IMP-200** (TODO, 5.0) touches `ci.yml`'s `web-tests` steps but not their caps. Evidence: finding **F-3** of `.improve/reports/verify-IMP-198-r2.md` §9, confirmed independently there as mutant M28, and originally the implementer's M18.

### IMP-217 — Pin the deploy's two quality gates so deleting either one cannot stay green
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `.github/workflows/deploy.yml:44` (`- name: Run Python tests`) and `:54` (`run: python -m unittest discover -s tests -v`), `.github/workflows/deploy.yml:64` (`- name: Typecheck`) and `:77` (`run: npm run typecheck`), `.github/workflows/deploy.yml:79` (`- name: Build the paper index`) and `:141` (its `run:` line, the ordering anchor), `tests/test_build_index.py:14-15` (`DEPLOY_PATH`) and `tests/test_build_index.py:1301-1338` (`DeployStepCommandTests`'s `_index_step` / `_cap_on_the_command_line` / `_comment_above_the_run_line` helpers — copy their style), `tests/test_arxiv_common.py:361` (`WorkflowTimeoutTests`, the constraint that forbids capping a fast step), `web/scripts/__tests__/indexGuards.test.mjs:338` (the one place the web suite reads `deploy.yml`, and what it does **not** assert there)
- **Intent:** IMP-041's entire mechanism is that its two gates are *duplicated* from `ci.yml` into `deploy.yml`, because a workflow cannot depend on another workflow's job — and nothing pins that duplication. Deleting both steps was measured to leave Python at 104/104 OK and the web suite at 292/292 fully green, which restores exactly the hole IMP-041 closed for the price of one deletion and turns red nothing.
- **Acceptance criteria:**
  1. A `DeployQualityGateTests` class in `tests/test_build_index.py` asserts that `run: python -m unittest discover -s tests -v` **and** `run: npm run typecheck` each appear in `deploy.yml`'s `build` job. Match the exact `run:` scalars — not a substring of a comment, not a `npm test`, and not a step in the unrelated `deploy` job.
  2. Both gates' positions are compared against the index step's `run:` line (`:141`) and both must be strictly earlier. Ordering is the load-bearing half of IMP-041's guarantee, so a gate moved below the build must fail the test even though both `run:` strings are still present.
  3. **The test reads the file as text and needs no PyYAML.** PyYAML is not a declared dependency and is not installed in CI — only `requirements.txt` is — and a test that needs `pip install pyyaml` to run in CI is not a gate. Follow `DeployStepCommandTests`' existing precedent (`readlines()` plus compiled matchers) and scope the scan to the `build` job's step list, so a `run: npm test` added to the `deploy` job cannot satisfy criterion 1. Say in the PR body that the scan is structural and will not survive a re-indent of the workflow, and that if the job ever grows a nested structure the test should fail loudly rather than silently scanning nothing.
  4. **Non-vacuity is demonstrated by mutation, not by assertion.** In a `/tmp` copy: delete the `Run Python tests` step and quote the failure; delete the `Typecheck` step and quote the failure; move `Typecheck` below `Build the paper index` and quote the ordering failure. Three quoted failures — a test never observed failing is not a gate.
  5. **No workflow value changes and nothing is weakened.** `git diff -U0 -- .github/workflows/deploy.yml | grep -c '^-[^-]'` is `0`; `concurrency.cancel-in-progress: false` is intact; no `continue-on-error` and no `|| true` is introduced; `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green (118 tests today) with no existing test deleted, skipped or weakened. **Add no `timeout-minutes:` to either gate** — see the Notes.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v` with the new class; then criterion 4's three mutations in a `/tmp` copy, each failure message quoted verbatim; then `/usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/deploy.yml')); print([(s.get('name'), s.get('run')) for s in d['jobs']['build']['steps']])"` as a cross-check that the textual scan and a real parse agree on which steps belong to `build` — PyYAML is available on this host for the check even though the test must not require it, the same arrangement IMP-206's verification uses. No browser, no network and no `web/` run is needed: this item reads two text files and runs the Python suite.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-041
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. Impact is 2, not 3, for IMP-206's reason and no softer one: **no shipped value is wrong** — both gates are present, in the right job, in the right order. The hazard is a future edit, and the failure mode is the specific one IMP-041 was written to prevent. Confidence is 5 because the claim was executed rather than reasoned: deleting both steps left `Ran 104 tests ... OK` (the pre-IMP-216 count; the suite is 118 today) and `Tests 292 passed (292)`, with nothing else able to notice. Risk `low`: one test class and, at worst, one shared helper. **This is the third pin in a set where two siblings already exist, and the precedent for it is exact.** `web/src/__tests__/indexGuardRegistration.test.ts` exists because a deleted `test.include` glob left `npm test` green with 23 guard tests quietly dropped (IMP-028c), and `DeployStepCommandTests` / `DeployStepTimeoutTests` exist because the deploy's index command and its caps were unpinned. What is missing is the pin on the duplication IMP-041 itself introduced, and the shape is the same: a ~30-line text-parsing test that reads a workflow file and asserts a relationship rather than a value. Criterion 2 is the part that makes it a real pin — a presence-only check would still pass if someone moved the gate below the build, which is the failure IMP-041 exists to prevent. **Do not add `timeout-minutes:` to the gates you are pinning.** `tests/test_arxiv_common.py`'s `WorkflowTimeoutTests` fails **every** `timeout-minutes:` line in either workflow that is at or under `6 × 60 s = 360 s`, so a per-step cap on a 5-second step cannot be added without turning an unrelated Python test red; the gates correctly carry no cap today and criterion 5 keeps it that way (recorded as **D-3** in `discovered-IMP-041.md`). **Cross-referenced, deliberately not duplicated: IMP-206** owns the job-vs-step cap *ordering* and its own criterion 4 already covers `ci.yml`'s `web-tests` — it must not be reimplemented here, and this item must assert nothing about `timeout-minutes:`. **IMP-205** owns the index step's cap number. **IMP-198** owns the caps that were shipped. The separate item for the gate the deploy genuinely lacks (adding `npm test`, or recording why not) is a decision, not a pin, and is filed as its own item. Evidence: **D-1** of `.improve/reports/discovered-IMP-041.md`, reproduced independently in `.improve/reports/verify-IMP-041.md` §5, which also records that the item as originally specified did not require the pin — which is why it is filed here rather than folded back into IMP-041.

### IMP-207 — Declare `requests` in `requirements.txt`; it is imported directly
- **Status:** TODO
- **Category:** Configuration & defaults
- **Type:** bug-fix
- **Area / files:** `requirements.txt:1-14` (the whole file — `arxiv>=2.1.0,<4` and `pandas>=2.0.0`, nothing else), `scripts/arxiv_common.py:12` (`import requests`, at module scope, one line below `import arxiv`), `scripts/arxiv_common.py:26-45` (`TimeoutSession`, a `requests.Session` subclass)
- **Intent:** `scripts/arxiv_common.py` imports `requests` **directly** and builds a `requests.Session` subclass out of it, but `requirements.txt` does not declare it — `grep -i requests requirements.txt` returns nothing. It resolves only because `arxiv` depends on it transitively (`importlib.metadata.requires('arxiv')` on 2.1.3 returns `['feedparser ~=6.0.10', 'requests ~=2.32.0']`), and the repository has no lockfile and no hashes, so the version is whatever the transitive resolve picks on the day: 2.32.3 on this host, 2.33.1 in a clean venv the same day. That is the whole risk of an undeclared direct import, and since IMP-198 (`b7e23a8`) the repo's retry worst case and its entire `timeout-minutes` justification **ride on this transitive package**: `TimeoutSession.request` sets `kwargs.setdefault("timeout", …)`, the `isinstance(session, requests.Session)` guard at `arxiv_common.py:66` is the difference between a bounded client and a client that runs to GitHub's 360-minute job limit, and the `except requests.exceptions.Timeout` branch added in the same change is a `requests` type. A future `arxiv` that drops or reshapes its `requests` dependency — or a resolver that picks a version with different timeout semantics — breaks the pipeline at import time, in both workflows, with no declared requirement to point at.
- **Acceptance criteria:**
  1. `requirements.txt` declares `requests` explicitly, with a comment naming the reason: `scripts/arxiv_common.py` imports it directly and IMP-198's request timeout and its `isinstance` guard depend on it. Follow the file's existing comment style (the `arxiv` bound is annotated at length, and that annotation must not be shortened or moved).
  2. The declared range is the one the code actually needs and the one both admitted `arxiv` majors already satisfy. `requests>=2.31.0` is the floor to state: 2.31 is where `ConnectTimeout` and `ReadTimeout` split out from `ConnectionError`, and that split is the exception hierarchy the retry worst case rides on (a `ReadTimeout` is **not** retried by `arxiv`, a `ConnectTimeout` is). Name the version and its reason in the comment.
  3. **No upper bound is invented and no pin is added.** The repository has no lockfile (profile INF-06) and one unpinned transitive package is the honest state; adding a ceiling here would be a new constraint on a package the pipeline does not otherwise control. If the implementer believes a ceiling is needed, that is a separate argument and must be made in the PR body, not smuggled in here.
  4. The requirement resolves in both workflows. A clean venv built from `python -m venv .venv && python -m pip install -r requirements.txt` installs `requests` and `import requests` succeeds with `arxiv` uninstalled from `sys.modules` — or, more practically, the PR body quotes `pip install -r requirements.txt` output showing `requests` and the resolved version, plus `python -c "import arxiv_common"` from the repository root.
  5. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green and `git diff --numstat -- requirements.txt` shows additions only — the `arxiv` and `pandas` lines keep their exact current text.
- **Verification method:** `git diff --numstat -- requirements.txt`; `python -m venv /tmp/rpf-207 && /tmp/rpf-207/bin/pip install -r requirements.txt` with the resolved `requests` version quoted verbatim; then `/tmp/rpf-207/bin/python -c "import requests, arxiv_common; print(requests.__version__)"` from the repository root. To prove the declaration is load-bearing rather than decorative, quote `importlib.metadata.requires('arxiv')` showing where the transitive declaration came from.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. Confidence 5 is easy here: the import is at `arxiv_common.py:12` and the requirement is absent from a two-line file, both read directly. Impact is 2 and not higher **because this cannot fail today** — `import requests` cannot fail where `import arxiv` on the line above has not, on any version in the admitted `[2.1.0, 4)` range, since both majors declare it. The item is filed because the repo now has production behaviour — a client-side timeout and three workflow caps — justified in terms of a package it does not declare, and the verifier's own worst-case arithmetic depends on which version gets resolved. A future `arxiv` major is a real but unquantified risk, which is the same class of exposure IMP-198's own Notes call "a floor, not a guarantee". Cross-references, deliberately **not** duplicated: **IMP-198** (DONE, `b7e23a8`) added the `requests`-dependent timeout and deliberately did not touch `requirements.txt`; this item owns the declaration and must not reopen the timeout mechanism. **IMP-033** (DONE, `bbe2d18`) owns the `arxiv` upper bound and its long comment; that comment is the style to match and its claim that "everything the scheduled index build uses … is unchanged through 4.x" is about `arxiv`, not about `requests`. **IMP-085** (TODO, 15.0) adds a `pyproject.toml`, which would eventually move these declarations somewhere else — it does not have to land first, but if both land in the same window the requirements must not be duplicated. **IMP-093** (TODO, 12.5) is told in its own Notes to "use `urllib.request` from the standard library, or `requests` which `arxiv` already depends on"; this item is the answer to that note — the declared-dependency form is the right one, and IMP-093's PR should then use `requests` without re-deciding. Evidence: finding **R-1** in `.improve/reports/verify-IMP-198-r2.md` §8, including the `importlib.metadata.requires('arxiv')` reading and the two different resolved versions observed on the same day.

### IMP-208 — Document that arXiv does not space its retries, and that the repo must not add client-side sleeps
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** docs
- **Area / files:** `scripts/arxiv_common.py:16-19` (the `DEFAULT_DELAY_SECONDS` / `DEFAULT_NUM_RETRIES` / `DEFAULT_REQUEST_TIMEOUT_SECONDS` block), `scripts/arxiv_common.py:80-88` (`build_client`, the call site that hands `delay_seconds` and `num_retries` to `arxiv.Client`), `.github/workflows/ci.yml:57-61` (the only place the gap is currently written down, in a workflow comment), `.improve/REPO_PROFILE.md` (no row owns it)
- **Intent:** `arxiv.Client` sets its pacing variable `_last_request_dt` **only after a successful** `self._session.get(...)` (`if self._last_request_dt is not None: … time.sleep(…)` on the way in, `self._last_request_dt = datetime.now()` on the way out). A request that raises never reaches that assignment, so `_last_request_dt` stays `None` and the `delay_seconds` branch is skipped on **every** retry. The retries therefore fire back to back: measured against an unroutable address with the shipped 60 s timeout, the six attempts landed at offsets `0.0, 60.0, 120.0, 180.0, 240.1, 300.1` s for a total of 360.06 s — exactly `6 × timeout`, with `delay_seconds = 10` configured and never applied. This was found, measured and **deliberately not patched**: adding `time.sleep` between retries would change request pacing toward arXiv, which is arXiv's terms-of-use decision, not the repo's. That judgement is correct and should be preserved. The problem is that it is recorded in exactly one place — a YAML comment in `ci.yml` — and not at the call site in `scripts/arxiv_common.py`, where the next maintainer will actually be looking when they see `num_retries=5` and think it is doing something it is not. The new request timeout makes the retries **denser**, not sparser, since each attempt now terminates sooner; that consequence is recorded nowhere in the source.
- **Acceptance criteria:**
  1. `scripts/arxiv_common.py` states the constraint at the call site: in or immediately above `build_client` (`:80-88`), a comment records that `arxiv` records `_last_request_dt` only after a *successful* `get`, so `delay_seconds` spaces successful requests only and **retries are unspaced**, that the six attempts are therefore `6 × DEFAULT_REQUEST_TIMEOUT_SECONDS` and not `6 × (timeout + delay_seconds)`, and that **this is intentional and must not be "fixed" with client-side `time.sleep`**, because request pacing toward arXiv is arXiv's terms-of-use decision. Quote the upstream source line the comment is based on, as `ci.yml:57-61` already does.
  2. The comment also records the consequence IMP-198 introduced: because each attempt is now bounded at 60 s, the retry burst is **tighter** than before that change, not looser. A future reader who adds a client-side sleep will otherwise believe they are restoring an upstream guarantee rather than introducing a new one.
  3. **No behaviour changes.** `DEFAULT_DELAY_SECONDS = 10` and `DEFAULT_NUM_RETRIES = 5` stay exactly as they are; `build_client` still passes both to `arxiv.Client` unchanged; there is no `time.sleep`, no retry decorator, and no client-side pacing anywhere in `scripts/` (`grep -n "time.sleep" scripts/` returns nothing). `git diff --numstat -- scripts/arxiv_common.py` shows the added comment lines and **no** changed or removed statement lines.
  4. `.improve/REPO_PROFILE.md` gains a short row for this in its Python section, so the profile — which the loop's verifiers read as the inventory of what is true about the pipeline — records the constraint rather than leaving it to be rediscovered from a YAML comment in a different file. If the profile row belongs in a section the implementer does not own, escalate it instead of skipping it, and say so in the PR body.
  5. The claim is verified, not asserted. The PR body quotes the elapsed time and per-attempt offsets for the retry path at the shipped 60 s default against an unroutable address (`192.0.2.1`, RFC 5737 TEST-NET-1) — offsets must be one timeout apart, not one timeout-plus-delay apart — and states plainly that this is a measurement against a non-loopback black hole, so the loopback read path is quoted separately.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; `grep -n "time.sleep" scripts/ arxiv 2>/dev/null` shows no hit inside `scripts/`; `git diff -U0 -- scripts/arxiv_common.py | grep -c '^-[^-]'` is `0`; then the criterion-5 probe with its offset list quoted. Read `scripts/arxiv_common.py:80-88` and confirm the comment sits where a maintainer editing that call will see it.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. This is a documentation item with a documentation-shaped risk profile, filed because the highest-cost outcome here is a **wrong** fix: a maintainer who sees `delay_seconds=10, num_retries=5` and an observed burst of six identical requests will very reasonably add a sleep, silently changing the request rate this project sends to a service whose terms of use govern that rate, and no test would fail. Confidence 5 — the behaviour was read out of the installed package's source at 2.1.3 (`Client.__Client__try_parse_feed`) and then measured, with attempt offsets exactly one timeout apart. Effort is `S` and risk is `low` **only because the fix is prose**: criterion 3 makes that a hard constraint, and any behavioural change to the retry or pacing path is a different item requiring a fresh decision. Cross-references, deliberately **not** duplicated: **IMP-198** (DONE, `b7e23a8`) added the timeout and deliberately left `delay_seconds` and `num_retries` as context lines in its diff; its verifier recorded this gap as "a real, unfiled question for the orchestrator", and this item is that filing. **IMP-054** (TODO, 15.0) makes `DEFAULT_DELAY_SECONDS` configurable — if it lands, the comment in criterion 1 must move with the constant rather than be left pointing at a literal. **IMP-204** (TODO, 12.5) is the item that changes what the pipeline does about paging and will rewrite the same neighborhood of code; its Notes already require the deploy path to be bounded, and the two must not each decide the retry contract independently. Evidence: §1.1 and §5 of `.improve/reports/verify-IMP-198-r2.md`, including the `inspect.getsource` excerpt of `_parse_feed` and of `__try_parse_feed`, the exception-MRO readings showing `ConnectTimeout` retried and `ReadTimeout` not, and the live 10.2 s pacing observation on the success path.

### IMP-209 — Make the CI matrix include the documented Python floor, and un-float the two sites IMP-097 does not name
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:14-15` (`python-tests` `python-version: "3.x"`), `.github/workflows/ci.yml:32-34` (`web-tests` `python-version: "3.x"`), `.github/workflows/deploy.yml:30-32` (`build` `python-version: "3.x"`), `readme.md:49-52` and `CONTRIBUTING.md:27-30` (the "**verified on Python 3.11 and 3.14**" claim this makes testable, and the "3.10 and newer can install" half that CI still cannot check)
- **Intent:** The docs state a verified floor — "*verified on Python 3.11 and 3.14*" — and nothing in the repository verifies it. All three interpreter pins float: `ci.yml:15`, `ci.yml:34` and `deploy.yml:32` are `python-version: "3.x"`, and `"3.x"` floats **upward**, so CI will drift to 3.15 and 3.16 and will never once exercise 3.11. The claim is honest as written ("verified", not "required") precisely because the IMP-031 implementer could not edit the workflows and chose to state what was measured rather than a promise nothing checks — but a documented floor no gate exercises is a promise with a footnote, and the residue is still open because `.github/` was outside that item's scope. There is also no declared floor anywhere: no `pyproject.toml`, no `python_requires`, and `pandas>=2.0.0` is unbounded and resolves to a 3.x that itself requires 3.11, so nothing stops the effective floor drifting upward on its own.
- **Acceptance criteria:**
  1. **The matrix IMP-097 adds includes the documented floor.** IMP-097's own AC1 asks for "a matrix of at least two explicit minor versions, with no floating `3.x`", which a matrix of `["3.12", "3.13"]` satisfies while still never running 3.11. This item's requirement is the missing half: **3.11 — the floor the docs name — is one of the versions the matrix runs**, and the newest is the other. If IMP-097 lands first with a matrix that omits it, 3.11 is added here.
  2. **`deploy.yml:32` is un-floated too.** IMP-097's Area names only `ci.yml:9-19` (the `python-tests` job); `ci.yml:34` (`web-tests`) and `deploy.yml:32` (`build`) are second and third call sites that a first-time reader of the file will not connect to the claim in the readme. Each gets an explicit version, and the deploy one may not float even if `ci.yml` is left as a matrix, because the production job's interpreter is the one that matters most.
  3. **The alternative is allowed and must be stated, not assumed.** A maintainer may reasonably decide against a matrix (two interpreters doubles CI minutes, and `pandas` is unbounded so the legs resolve different majors — profile INF-06). If so, the PR body says so and the docs' wording is changed to match what is actually exercised: a single pinned version means the docs may no longer say "verified on 3.11 and 3.14" unless one of them **is** that pinned version. One of the two halves must change; doing neither leaves the claim exactly as unenforced as it is today and does not satisfy this item.
  4. **The claim is measured, not inherited.** Each leg's resolved `arxiv` and `pandas` versions are recorded in the PR body, because neither requirement has an upper bound and the legs will differ. A 3.11 leg that resolves `pandas` 3.x and fails to install is a discovery this item exists to make, not a regression to hide; if that is what happens, report it and let the follow-up item be filed, rather than pinning `pandas` to make the leg green.
  5. Nothing else in either workflow moves: `git diff -U0 -- .github/workflows/ | grep -c '^-[^-]'` is `0` except for the `python-version` lines, every `timeout-minutes` is unchanged (IMP-198's pins, IMP-205/IMP-206's subject matter), and `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green.
- **Verification method:** `cat -n .github/workflows/ci.yml .github/workflows/deploy.yml | grep -n 'python-version'` shows no floating `"3.x"` at any of the three sites, and each value is a literal or a matrix entry that includes `3.11`; then quote a green run of the matrix legs from the Actions log, or — if only one leg can be run locally — quote the local run on each interpreter that has the dependencies and state plainly which leg is unverified locally, as IMP-097's Verification method already requires. Read `readme.md:49-52` and `CONTRIBUTING.md:27-30` as a pair and confirm the wording matches criterion 3's outcome.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-097
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. Impact is 2 and not 3 because nothing is broken for a contributor on 3.11 or 3.14 today — both were measured green — the harm is to the *claim*, and to a future `pandas` or `feedparser` release that breaks an interpreter nobody runs. Confidence 5: the three floating values were read directly out of both files, and the docs' exact wording was quoted rather than paraphrased. Risk `med` for the honest reason IMP-097's own Notes give: pinning reveals version-specific failures (`pandas` chained indexing, `tarfile.extractall` filtering, and now the `requests`/timeout path all differ by version), so this item can legitimately turn CI red and the discovery is the point. **Deliberately scoped as the delta, not a duplicate:** IMP-097 (TODO, 12.0) already owns "add a Python version matrix to CI" and its own Notes say "Add one version at a time and fix what surfaces rather than adding the matrix and the fixes in the same PR" — so this item adds only the two halves IMP-097 does not cover (the floor must be **in** the matrix, and the two floating sites outside its Area), depends on it, and must not re-implement the matrix. If IMP-097's implementer folds both halves in, this item is satisfied by their PR and should be closed as absorbed rather than re-run. Cross-references, deliberately **not** duplicated: **IMP-085** (TODO, 15.0) adds the `pyproject.toml` where a `requires-python` floor would be *declared* — a declaration, not an enforcement, and it does not make criterion 1 obsolete. **IMP-086** (TODO, 15.0) adds `ruff` and a Python lint step, which is a separate gate. **IMP-166** (TODO, 10.0) pins the **Node** version and declares `engines`; it is the same shape of item on the other stack and neither waits on the other. **IMP-031** (DONE, `299d753`) is what created the accurate-but-unenforced wording, and correctly deferred the workflow half to its own filing rather than over-claiming. Evidence: D-3 and R-3 in `.improve/reports/verify-IMP-031-r2.md` §2 and §6, and **D-8** plus **D-5** in `.improve/reports/discovered-IMP-031.md`, which names all three lines and the measured `Requires-Python` readings for `arxiv` (>=3.10) and `pandas` (>=3.11).

### IMP-212 — Document in `CONTRIBUTING.md` why the index-guard tests live outside `src/` and shell out
- **Status:** TODO
- **Category:** Onboarding & developer experience
- **Type:** docs
- **Area / files:** `CONTRIBUTING.md:84-85` ("Add or update tests in `tests/` for any behavior you add or fix in `scripts/`, and in `web/src/lib/__tests__/` or `web/src/__tests__/` for anything you change in `web/`."), `web/scripts/__tests__/indexGuards.test.mjs:42-46` (`GUARD`, `DEPLOY_YAML`, `README` — the `../../../` paths out of `web/`), `web/scripts/__tests__/indexGuards.test.mjs:84` (`spawnSync(process.execPath, [GUARD, ...args])`), `web/src/__tests__/collectWithVitest.mjs:91-97` (`spawnSync` + `timeout: LIST_TIMEOUT_MS` + `killSignal: "SIGKILL"`), `web/vite.config.ts:9-13` (the third `test.include` glob `"scripts/**/*.test.mjs"`)
- **Intent:** IMP-028/IMP-029 left a deliberate, load-bearing exception that no document states. `CONTRIBUTING.md:84-85` is unconditional — a contributor who follows it will never place a test in `web/scripts/__tests__/`, will never discover that `web/scripts/require-index.mjs` sits **outside** the TypeScript project (`tsconfig.json` `include` is `["src", "vite.config.ts"]` with no `allowJs`, so `tsc --noEmit` cannot see it), and will never learn that `web/src/__tests__/indexGuardRegistration.test.ts` **spawns the real vitest CLI** and reads `readme.md` and `.github/workflows/deploy.yml` through `../../../` — so `npm test` now needs a repo-root checkout and a `web/`-only clone fails. Two of the three facts are non-obvious enough that a well-meaning cleanup breaks something real: deleting the `scripts/**/*.test.mjs` glob returns `npm test` to a **silent exit 0 with zero guard coverage**, and "moving" `indexGuards.test.mjs` under `src/` fails `npm run typecheck` with 11 errors (`tsconfig.json` pins `"types": ["vite/client"]` and `@types/node` is **not** installed). A future maintainer who does either deletes the tests guarding every production deploy, or installs a dependency the project deliberately has no need for. `.improve/REPO_PROFILE.md` §3.3 and §8 trap 19 already record all of this; `CONTRIBUTING.md` is what a contributor actually reads.
- **Acceptance criteria:**
  1. `CONTRIBUTING.md` gains a short paragraph, adjacent to the test-location sentence at `:84-85`, naming all four facts: (a) `web/scripts/__tests__/` is a valid third location for `web/` tests and is how the two index-guard suites are registered; (b) `web/scripts/require-index.mjs` is plain Node ESM outside `tsc`'s project, so its tests **spawn** it as a child process rather than importing it (it reads `process.argv` and calls `process.exit` at module scope); (c) a `.ts` guard test under `src/` would fail `npm run typecheck` because `@types/node` is not installed — **do not add it**; (d) the guard suites read `readme.md` and `.github/workflows/deploy.yml`, so `npm test` requires a checkout of the whole repository, not `web/` alone.
  2. The paragraph states the consequence, not just the arrangement: deleting the `"scripts/**/*.test.mjs"` entry from `web/vite.config.ts`'s `test.include` makes `npm test` exit 0 with **zero** guard tests collected, and nothing in the suite can notice — which is why `web/src/__tests__/indexGuardRegistration.test.ts` exists.
  3. `CONTRIBUTING.md:88-89`'s claim that the listed commands "are the same commands CI runs" stays true after the edit; no command, script name, or claim about CI's steps is changed by this item. The venv-first workflow IMP-031/IMP-032 wrote is untouched.
  4. **Docs only.** `CONTRIBUTING.md` is the sole file whose content changes. `cd web && npm run typecheck && npm test && npm run build` is green, and `git diff --stat -- web/ tests/ scripts/ .github/` is empty. No test is added, moved, renamed, or deleted, and `web/package.json` gains no dependency.
- **Verification method:** `cd web && npm test` and read the count — **19 test files / 292 tests**, exit 0 — confirming both guard suites are still collected (`vitest list --filesOnly` lists `scripts/__tests__/indexGuards.test.mjs`); then `git diff CONTRIBUTING.md` and confirm the new paragraph names (a)–(d) and the silent-exit-0 consequence; then `git diff --stat` to confirm `CONTRIBUTING.md` is the only changed file.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. Impact is 2, not 3, because nothing is broken today and the arrangement works — the harm is entirely to the next maintainer's ability to change this code safely, and the specific failure modes (a silently green suite, or a needless `@types/node` dependency that would also churn `web/package-lock.json`, which profile §6 restricts to IMP-005, IMP-137 and IMP-197) are both severe *if* triggered. Confidence 5: every element was measured, not inferred — the `.ts`-under-`src/` failure was reproduced by the independent verifier (11 `npm run typecheck` errors: `TS2591 Cannot find name 'process'` plus 10 `TS7006`/`TS7031` under `strict`), the glob deletion was reproduced (exit 0, 17 files, 266 tests), and the `../../../` reads are visible at `indexGuards.test.mjs:45-46`. Effort S: one paragraph. Risk low: prose only, no executable surface. **Deliberately split from its sibling.** The `REPO_PROFILE.md` half of this finding — what the guards check, where they live, that `failedCategories`/`truncatedCategories` pass deliberately, and why the pin shells out — has **already been done** in `.improve/REPO_PROFILE.md` §3.3 and §8 trap 19 by the absorber that filed this item; this item owns only the `CONTRIBUTING.md` half, because `CONTRIBUTING.md` is a repo doc outside the profile and was left stale. Do not re-document the profile. Cross-references, deliberately **not** duplicated: **IMP-028b** (DONE, `d57b77c`) created both suites and the glob, **IMP-028c** (DONE, `49af325`) created the pin, and **IMP-028d** (DONE, `2ebdbd3`) bounded its `spawnSync` and dropped the false-positive witness — none of them had `CONTRIBUTING.md` in scope, and none is incomplete on this point. **IMP-032** (DONE, `299d753`) wrote the `web/` section and correctly said nothing about `scripts/`; this is its follow-on, not a re-do. **IMP-137** (TODO, 5.0) adds ESLint, which would not catch a misplaced test file either. **IMP-166** (TODO, 10.0) pins the Node version and declares `engines` — a different concern, and it does not cover the `@types/node` trap. Evidence: §8.1, §8.3, §8.4, §8.7 and §8.8 of `.improve/reports/verify-IMP-028b.md`, §5.3 of the same report (the measured typecheck failure), and `.improve/reports/verify-IMP-028c.md` §1 experiment A (the silent exit-0).

### IMP-213 — Exercise the `web` suite on the Node version CI actually runs
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml` (`web-tests` job — `node-version: "20"`), `.github/workflows/deploy.yml` (`build` job — `node-version: "20"`), `web/src/__tests__/collectWithVitest.mjs:20,91-97` (`spawnSync` from `node:child_process`, `process.execPath`, `timeout`, `killSignal`) and `web/src/__tests__/collectWithVitest.mjs:1-19` (`createRequire`, `node:path`, `node:fs`, `node:url`), `web/scripts/__tests__/indexGuards.test.mjs:3,84` (the same `spawnSync`), `web/package.json` (no `engines`)
- **Intent:** CI runs **Node 20** and the newest gate in the repository — the IMP-028c registration pin, which shells out to the real vitest CLI from inside a test — was only ever executed on **Node 25.6.1**. The independent verifier flagged this explicitly and honestly rather than waving it through: the APIs the pin uses (`process.execPath`, `spawnSync`, `createRequire`, `node:path`, `node:fs`, `node:url`) are long-stable and `vitest` 2.1.9 declares `engines: {"node": "^18.0.0 || >=20.0.0"}`, so the risk is genuinely low — but low is not the same as measured, and this repo's own evidence rules say a figure that could not be measured must be **reported as unmeasured**, which is what happened. The gap is broader than the pin: nothing in the repository has ever run the web suite on a second Node version, so every version-sensitive behaviour in `web/scripts/__tests__/` and `web/src/__tests__/collectWithVitest.mjs` — `spawnSync` timeout semantics, `SIGKILL` delivery, `--json` reporter output shape, child-process exit-code handling — is verified on exactly one interpreter, and that interpreter is not the one that gates merges. A one-line API change on Node 20 would turn every `npm test` in CI red with a cause nobody can reproduce locally.
- **Acceptance criteria:**
  1. The `web-tests` job in `.github/workflows/ci.yml` runs `npm test` on **at least two** Node versions: the version CI runs today, plus the newest LTS/GA Node available via `actions/setup-node@v4` — and **Node 20 is one of the legs**, since that is what both workflows request and what `deploy.yml` publishes with. The matrix is declared on the Node `setup-node` step (or a `strategy.matrix` over the whole job); the Python job's matrix, if any, is untouched.
  2. Every leg runs the **full** web gate on that version — `npm ci`, `npm run typecheck`, `npm test`, and `npm run build` with an index present — not `npm test` alone, so the pin's `spawnSync` timeout and `killSignal` are exercised under the real per-job time budget. Record the resolved `node -p "process.versions.node"` for each leg in the PR body.
  3. No leg is allowed to be quietly skipped or allowed to fail: no `continue-on-error`, no `|| true`, no `if:` on a matrix leg. A version-specific failure is the **discovery this item exists for** — fix it or narrow the matrix deliberately and say why, in the PR body.
  4. `.github/workflows/deploy.yml` is **not** changed by this item: it keeps `node-version: "20"` and the Node matrix is a CI-only gate. Confirm with `git diff --stat -- .github/workflows/deploy.yml` returning empty.
  5. `cd web && npm run typecheck && npm test && npm run build` is green locally on the developer's own Node, reporting **19 test files / 292 tests**. No test, script, dependency, or `web/package-lock.json` entry is added, changed, or removed by this item — this is a workflow change only.
- **Verification method:** `cat -n .github/workflows/ci.yml` and confirm no Node value is a floating `"20"` **or** a single unversioned leg, and that Node 20 appears in the matrix; then read the PR's CI run and record `node -p "process.versions.node"` from each leg alongside the vitest summary (`Test Files 19 passed (19)` / `Tests 292 passed (292)`) for both. Local proof of the gap is impossible on this machine and that is the point: `ls /opt/homebrew/Cellar/ | grep '^node'` shows only 25.6.1, which is why the matrix, not a local run, is the only route.
- **Effort:** S    **Risk:** med
- **Depends on:** IMP-166
- **Priority score:** 10.0
- **Notes:** Impact 2, Confidence 5, Effort S = 10.0. Impact is 2, not 3, because the failure mode is speculative and the verifier's own assessment was "low risk, but unverified rather than absent" — the harm is to a claim, not to a running site, and a Node-20 break would be loud (red CI) rather than silent. Effort is S: a matrix over one existing step. Risk is `med` for the reason IMP-097 and IMP-209 both give and it is not a hedge — adding a version leg can legitimately turn CI red, and if it does, that red is the item working. **Deliberately scoped as the delta, not a duplicate.** IMP-166 (TODO, 10.0) already owns pinning the Node version and declaring `engines.node`; this item depends on it so the matrix names an explicit minor rather than a floating `"20"`, and must not re-do the pinning or the `engines` declaration. IMP-209's own Notes record that precedent in the other direction ("depends on IMP-097, must not re-implement the matrix"). IMP-097 (TODO, 12.0) adds a **Python** matrix — a different interpreter, a different job, no overlap in files beyond the shared workflow, and neither waits on the other. Cross-references, deliberately **not** duplicated: **INF-19** in `.improve/REPO_PROFILE.md` (`web/package.json` has no `engines` and no `.nvmrc`) is owned by IMP-166; the *absence of a second Node run* is not recorded there and is why this item is filed. **IMP-197** (TODO, 7.5) adds a CSS gate and **IMP-137** (TODO, 5.0) an ESLint gate — both are new checks with their own risk profiles, neither runs a second interpreter. Do **not** bundle the "document the guard-test indirection" work into this item; that is IMP-212. Evidence: the "Residual risk not testable here" paragraph in `.improve/reports/verify-IMP-028c.md` §7, quoted verbatim for the claim under test — "CI runs Node 20 and every Homebrew Node keg on this machine resolves to v25.6.1, so I could not execute the pin under Node 20 … the risk is low — but it is unverified, not absent" — and `.improve/reports/verify-IMP-028d.md` §1, which re-measured the pin's margins on Node 25.6.1 only (`918–1330 ms` file time, worst single spawn `1.03 s` against a `30 s` timeout) and therefore also carries the same unverified-on-20 caveat.

## Tier 8.0

### IMP-178 — Log the soft shard failure that only the tooltip carries
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:241-250` (`setFailedShards(list.failedFiles)` on the partial/soft path, which logs nothing), `web/src/App.tsx:668-670` (the `title` holding `` `${failure.file}: ${failure.message}` ``), `web/src/lib/paperIndex.ts:269-282` (where `failedFiles` is built)
- **Intent:** Both hard paths log: `App.tsx:190` for a manifest failure and `App.tsx:258` for a total shard failure. The soft path — one shard failed, the rest loaded — is the **only** failure with no `console.error`, yet it carries the most diagnostic detail: the shard file name and its message live exclusively in the banner's `title` (`:668-670`), and `title` renders no tooltip on a touch device. On a phone the shard filename is therefore entirely unreachable, and for an operator the browser console — the one place a deploy failure is actually investigated — says nothing at all.
- **Acceptance criteria:**
  1. `web/src/App.tsx:241-250` calls `console.error` when `list.failedFiles.length > 0`, once per load, with a line that names every failed shard's `file` and `message` — e.g. `` `paper feed: ${list.failedFiles.length} shard(s) failed to load; the feed is incomplete.` `` followed by the per-file detail. It is not called when `failedFiles` is empty.
  2. It is called **once per load**, not once per render: two recency changes against a failing shard produce exactly two log calls, asserted by counting `console.error` invocations in a new test in `web/src/__tests__/App.partialShard.test.tsx`.
  3. The log line is developer-facing, so it keeps the file name and HTTP status that IMP-017 removed from the *visible* text; no reader-facing string changes. The IMP-015 and IMP-017 assertions in `App.partialShard.test.tsx` pass unmodified.
  4. `cd web && npm run typecheck && npm test` passes: 15 test files, **233** tests (232 pre-existing + 1).
- **Verification method:** `cd web && npm run typecheck && npm test`; then `npm run build && npm run preview -- --port 5199 --strictPort` against a data directory missing one shard, open DevTools, and confirm exactly one console error naming the missing file; then change the recency window twice and confirm two log lines in total, not four. Screenshot to `.improve/artifacts/IMP-178/feed-partial-shard-console-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 8.0
- **Notes:** Rated LOW by the IMP-017 verifier and recorded in `.improve/reports/impl-IMP-017.md` "Finding (c)". Scored 8.0 rather than higher because the reader-facing prose IMP-015 shipped already names the missing week and its date range without any hover, so no reader is left with nothing — this is an operator-diagnosability gap, not a user-facing one. Cross-reference: IMP-144 (TODO) owns load **progress** observability and IMP-011 (DONE) owns the storage-failure alert; neither emits a line for this path. Match the message shape of `App.tsx:190` and `:258` ("paper feed: …", cause last) rather than inventing a third format.

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

### IMP-182 — Protect the papers-load `useLayoutEffect` from a silent revert
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `web/src/App.tsx:244` (`useLayoutEffect(() => {` — the papers-load effect, deliberately not `useEffect`), `web/src/App.tsx:235-243` (the nine-line comment that is currently the only defence), `web/src/App.tsx:189` (`setLoading(false)` on the manifest `.then`, the commit that creates the gap), `web/src/App.tsx:727` (`{loading ? (` — the render guard) and `web/src/App.tsx:801` (`"No papers are available in this window yet."`), `.improve/REPO_PROFILE.md` §8 (repo-specific traps for verifiers)
- **Intent:** IMP-173 made a JSON `null` manifest throw `IndexUnavailableError(INDEX_MALFORMED)` and added `setLoading(false)` at `:189`. Between the manifest commit and the papers effect starting, the app is briefly in a state with a manifest in hand, `loading` false and `papers` still empty — which renders "No papers are available in this window yet.", a claim IMP-016's panel exists to make impossible, on the **happy path, on every cold load**. `useLayoutEffect` closes the gap in the same commit. The verifier measured it with a per-animation-frame sampler on a production build: reverting the hook to `useEffect` paints that frame on **6/6** cold loads, the shipped build on **0/6** (and 0/4 again under `vite preview`). **No test can catch the revert**: the `effect` variant is `237/237` green three runs out of three, and jsdom has no paint. So the choice is protected by a comment, and comments do not fail builds. The verifier also confirmed a less invasive alternative — keep `useEffect` and add a `settledKey` render guard — reaches 0 flashed frames too, and judged the shipped choice the better engineering, because it is one self-maintaining token rather than a duplicated description of the effect's dependency list. The gap is therefore **testability, not correctness**: the decision is defensible and undocumented, so nothing tells the next author why the hook is what it is.
- **Acceptance criteria:**
  1. The rationale is recorded where the next author of `App.tsx` will actually look: a numbered entry added to `.improve/REPO_PROFILE.md` §8 stating that the papers-load effect in `web/src/App.tsx` is a `useLayoutEffect` **on purpose**, that reverting it to `useEffect` reintroduces a one-frame "No papers are available in this window yet." on every cold load, that jsdom cannot observe the difference so no unit test will fail, and that the measured cost of the shipped choice is p50 unchanged with p90 rising to roughly 63 ms. The `App.tsx:235-243` comment is kept and cross-references the profile entry.
  2. **One** guard is added, and whichever of the two is chosen is recorded in the PR body:
     (a) a test that **fails** when `web/src/App.tsx:244` is reverted to `useEffect`; or
     (b) adoption of the verifier's `settledKey` render guard, in which case the render condition at `:727` becomes `loading || papersPending ?` and a test asserts the empty-window copy at `:801` is never in the DOM while the current load is unsettled.
     Route (a) may be a source-level assertion (a test reading `web/src/App.tsx` and requiring `useLayoutEffect` at that call) or a browser-level paint check; it must be stated honestly as what it is, and it must not assert against a stub of its own making. Route (b) is only acceptable if `papersKey` is kept in lockstep with the effect's dependency list `[manifest, urlState.recency, papersAttempts]`, and the PR body must say so.
  3. **Non-vacuity is demonstrated for whichever route is taken.** For (a), rsync `web/` to `/tmp` with `node_modules` symlinked, hand-revert `:244` to `useEffect`, and quote the failure count from `npx vitest run` (three consecutive runs). For (b), revert the `papersPending` clause in the `:727` condition and quote the count. A guard that is green in both states does not satisfy this criterion.
  4. No existing test is weakened, skipped, or deleted: `git diff -U0 -- web/src/ | grep -c '^-[^-]'` is `0` for the test directories, and the suite's `Tests N passed (N)` total increases only by the new case. The 9 `a window where no shard could be loaded` IMP-016 tests, the 5 IMP-173 `null`-manifest tests, and the 3 IMP-007 retry tests all pass unmodified.
  5. `cd web && npm run typecheck && npm test && npm run build` pass, and `npm run build` still prints `dist/assets/index-*.css 10.93 kB` and a `dist/assets/index-*.js` figure between 171.40 and 171.45 kB, so the change is not silently shipping new weight.
  6. If a browser-level check is taken, it lives under `.improve/artifacts/IMP-182/` and its sampler script path is quoted in the PR body, so the measurement is reproducible rather than asserted.
- **Verification method:** `cd web && npm run typecheck && npm test && npm run build`; then in the `/tmp` reverted copy, `npx vitest run` and quote the failing-test count; then `npm run build && npm run preview -- --port 5199 --strictPort` against the repo's real `web/public/data/`, cold-load 6 times, and confirm from the DOM that "No papers are available in this window yet." is never the painted state between "Loading the paper index…" and the feed. A `requestAnimationFrame`/`MutationObserver` sampler installed by `addInitScript` before any app script runs is the measurement method the verifier used and the one this item should reuse; quote the per-frame state sequence in the PR body. Do **not** mutate `web/public/data/` to produce the states — use copies under `/tmp`, as the verifier did.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 7.5
- **Notes:** Rated **MEDIUM (coverage, not correctness)** in §9.2 of `.improve/reports/verify-IMP-173.md`, and deliberately non-blocking: the shipped code is correct and the verifier's own verdict was "I do not require a change." Impact is 3 because the failure mode is a **silent regression of a landed item's user-visible guarantee**, reintroduced by an ordinary refactor that the suite will call green. Confidence is 5 — the 6/6-vs-0/6 measurement is reproducible on two different servers. Effort is `M`, not `S`, because the item requires a **decision** between a self-maintaining one-token hook and a ~6-line `settledKey` guard, plus whichever implementation, plus a demonstrated mutant: three pieces of work, and a `/tmp` reverted copy with `node_modules` symlinked to prove it. Risk is `med` because route (b) duplicates the effect's dependency list and can silently stop covering a newly added dependency — the exact bug class being fixed — and because a `useLayoutEffect` costs a p90 tail of roughly 63 ms on the first paint after a recency click (inside the INP "good" band, but not zero, and it must not be reported as zero). Cross-references, deliberately **not** duplicated: IMP-016 (DONE) owns the load-failure panel whose copy this flash falsely shows and must not be reopened; IMP-173 (DONE) met all four criteria and its own scope guard at `paperIndex.test.ts:414` already pins "no field-level validation"; IMP-018 (DONE) owns the error boundary; IMP-167 (TODO, 10.0) owns the report-evidence rule that criterion 3's quoted counts exist to satisfy. **Do not treat the SSR warning as a risk** — `grep -rn "renderToString\|hydrateRoot\|prerender" web/src web/index.html` returns nothing, `main.tsx:14` is `createRoot(...).render(...)`, and the app is a client-only static SPA, so React's "useLayoutEffect does nothing on the server" warning is structurally unreachable. Note that `.improve/REPO_PROFILE.md` §10's "still-open halves" list still describes IMP-019's pre-change state; whoever edits the profile under criterion 1 should refresh that row in the same change, but that edit is **not** part of this item.

### IMP-183 — Bound the retention window in the arXiv query instead of relying on the sort
- **Status:** TODO
- **Category:** Correctness
- **Type:** improvement
- **Area / files:** `scripts/build_index.py:403` (`assume_newest_first=True`, the production opt-in that keeps the order reliance alive), `scripts/build_index.py:210-217` (`collect_papers`'s signature, where the flag is documented as a shortcut rather than the filter), `scripts/build_index.py:235` (`cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)`), `scripts/build_index.py:240` (`query = f"cat:{category}"` — where the bound belongs), `scripts/arxiv_common.py:34` (`iter_results`, which takes an opaque `query` string) and `scripts/arxiv_common.py:54-62` (`arxiv.Search` with `sort_by=SubmittedDate`, `sort_order=Descending` at `:60-61`), `scripts/build_index.py:254` (the one-line comment that documents the reliance)
- **Intent:** IMP-020 converted the retention `break` into a real per-record filter, which fixed the original defect on **every** path, and added `assume_newest_first` as an off-by-default shortcut. But `main()` opts in at `:403`, so the **deployed pipeline is still order-dependent**: if arXiv ever returned a newer result after an older one, the first stale result would end the category early and the index would silently ship short. This is a residual reliance, not a hole — it is **sanctioned by IMP-020's AC3**, which asked for a comment "naming the sort dependency" at the call site, i.e. the spec wanted the reliance made *visible and switchable*, not removed. The verifier measured the reliance as real but currently satisfied: 2,000 captured `cat:cs.CV` results had **0** out-of-order positions and a strictly non-increasing `published`. The durable fix is to stop depending on the order at all by putting the window **in the query**: `cat:cs.CV AND submittedDate:[YYYYMMDDHHMM TO YYYYMMDDHHMM]`, derived from the same `cutoff` the filter already uses. That removes the reliance, removes the need for `assume_newest_first` at `:403`, and — the largest practical win — removes the pagination cost that flag exists to avoid, because arXiv would return only in-window results instead of being paged through until the first out-of-window one at `delay_seconds=10` (`arxiv_common.py:16`).
- **Acceptance criteria:**
  1. `scripts/build_index.py:240` builds the arXiv query with a submitted-date range taken from the same `cutoff` at `:235`, in the arXiv API's `submittedDate:[YYYYMMDDHHMM TO YYYYMMDDHHMM]` form, ANDed with `cat:{category}`. The bound is computed **once per run** from the injected-or-live clock, not per category, and the lower bound is inclusive so a paper published exactly at the cutoff is not lost. The rendered query string is asserted verbatim in a test, including the UTC `Z` suffix or whatever separator the API requires — quote the exact string the test expects.
  2. `main()` stops passing `assume_newest_first=True` at `:403`, **or** the flag is kept and a test proves the query bound alone is sufficient to stop the stream — one of the two, stated in the PR body. The parameter, its default of `False` at `:216`, its docstring at `:229-233`, and the six existing test call sites at `tests/test_build_index.py:317,326,332,345` are either left byte-identical or updated in this same change; nothing is left as dead code (IMP-179's criterion-1 standard: a flag nothing passes is a trap for the next caller).
  3. **Behaviour on a real stream is unchanged.** Capture a real `cat:cs.CV` result stream, replay it through `collect_papers` with a frozen `cutoff` at 7, 14, 30 and 60 days, and assert the returned ID list is **byte-identical** to the list today's per-record filter produces with `assume_newest_first=False`, in the same order, at every window. This is the comparison that matters: the verifier's replay of the same stream gave `old == new(default) == new(assume_newest_first=True)` and `lists byte-identical: True` at all four windows, so a divergence introduced here is a real regression, not a re-baseline. Quote the four ID-set comparisons.
  4. `tests/test_build_index.py`'s existing order-independence test `test_only_fresh_records_survive_out_of_order_iteration` and the flag guard `test_newest_first_assumption_only_stops_the_stream` either pass **unmodified** or are replaced by an equivalent that is **strictly stronger**, with the replacement named. `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0` unless criterion 2's second branch is taken, in which case the deletions are enumerated in the PR body.
  5. The live query the change produces is confirmed, not assumed: run `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --retention-days 7 --out-dir /tmp/rpf-bounded` and quote the request URL from the arXiv client, showing the `submittedDate` range present alongside `sortBy=submittedDate&sortOrder=descending`. Confirm the run exits `0` and writes `index.json` plus at least one shard, and that no shard on disk is older than the ISO week containing the lower bound.
  6. The residual is recorded rather than dropped: the comment at `build_index.py:254` and the `assume_newest_first` docstring at `:229-233` are updated to say plainly that the query is **now** bounded, so the flag is a page-count optimisation rather than a correctness precondition — or, if criterion 2's second branch is taken, that the flag is retained for third-party callers whose queries are not bounded. `.improve/reports/discovered-IMP-020.md`'s F1 note is closed by reference to this item.
  7. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests plus the new ones, all passing and hermetic (re-run with `socket.socket.connect`/`create_connection`/`getaddrinfo` stubbed to raise, and confirm the block was armed).
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then the frozen-`cutoff` replay of criterion 3 with the four window comparisons quoted; then the live `--retention-days 7` run of criterion 5 with the request URL captured; then `ls /tmp/rpf-bounded` and a `jq`-style read of `index.json`'s `shards[].from` to confirm the range. Time the run before and after and record both figures — the pagination saving is the item's main practical payoff and an unmeasured claim about it is worthless.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 7.5
- **Notes:** Impact is 3, not 4, because the current behaviour is **verified correct**: 0 order inversions in 2,000 real results, 0 in roughly 18,500 observations across all of the IMP-020 verifier's runs, and the live URL confirms `sortBy=submittedDate&sortOrder=descending`. The harm is a latent reliance that a change in arXiv's behaviour, a library upgrade, or a future `iter_results` refactor could turn into a silently short index — which for a research feed is a quiet correctness failure, not a crash. Confidence is 5 for the reliance's existence and 4 for the query-bound remedy: the arXiv `submittedDate` range syntax is documented by the API and used by the existing client, but the exact accepted spelling (upper bound inclusive, `TO` vs `-`, hour precision) must be confirmed against a live response, not from memory — hence criterion 5's requirement to quote the URL and criterion 3's replay. Effort is `M`: it touches the query string, the flag's production call site, the tests that pin the flag, and the live verification. Risk is `med` because an incorrectly-formed date range returns **zero** results rather than an error, and the zero-paper path is IMP-004's `No papers fetched; refusing to write an empty index.` exit 1 — so a malformed bound looks like an outage, not like a bug, which is exactly the "indistinguishable" failure IMP-022 was raised against. Cross-references, deliberately **not** duplicated: IMP-020 (DONE) is the item that created `assume_newest_first` and met all three criteria — this item does not reopen it, it removes the residual its verifier recorded; IMP-004 (DONE) owns the empty-index refusal this item must not confuse with a bad bound; IMP-022 (DONE) owns the flag validation this item's new query string must not undermine; IMP-183 does **not** touch `--retention-days`'s range check; IMP-104 and IMP-093 own arXiv paging volume, not the query's date bound. Finding **F1** in §9 of `.improve/reports/verify-IMP-020.md`, which itself credits `.improve/reports/discovered-IMP-020.md` with the remedy and asks that it "be promoted to a real item rather than left as a note" — that is what this is. Live-API caveat: the verifier measured with a real arXiv client, so a network-enabled run is required for criterion 5 and the unit suite must stay hermetic per criterion 7.

### IMP-197 — Make a CSS syntax error fail CI instead of shipping a larger stylesheet
- **Status:** TODO
- **Category:** CI & automation
- **Type:** tooling
- **Area / files:** `web/src/styles.css` (759 lines; the only stylesheet Vite compiles), `.github/workflows/ci.yml:39-40` (IMP-026's `Build` step, which is silent on a CSS syntax error), `web/package.json:14-25` (`dependencies` + `devDependencies`, neither of which declares a CSS parser), `web/package-lock.json` (currently touchable only by IMP-005 and IMP-137 per the never-proposed list at the top of this file — this item amends that sentence)
- **Intent:** IMP-026's build gate catches CSS **resolution** errors and misses CSS **syntax** errors, and the gap is now measured rather than suspected. With the verifier's Break B2 — an unterminated rule `.broken { color: red;` plus the garbage tokens `@@@ !!! ;;;` prepended to `web/src/styles.css` — `npm run typecheck` exits 0, `npm test` exits 0, and `npm run build` **exits 0 and ships a larger stylesheet**: `dist/assets/index-*.css` 11.86 kB (gzip 2.92 kB) against 10.93 kB (gzip 2.86 kB) healthy. The missing-`@import` case (Break B1) does fail with exit 1, so the gate is real but strictly narrower than "a CSS error fails the build" reads. That matters here because `web/src/styles.css` is **759 lines** of hand-written rules, not a two-line token file, and at least six live backlog items add declarations to it (IMP-012, IMP-013, IMP-014, IMP-105, IMP-107, IMP-123) — each one a chance to ship a broken rule to every reader behind a green check. A size-budget check cannot cover it either: a *dropped* rule shrinks the CSS and a *garbage* one grows it, so both directions of breakage are invisible to the drift tolerances the other items use.
- **Acceptance criteria:**
  1. CI fails non-zero on a CSS **syntax** error in any `.css` file Vite compiles, **before** the build ships, and the failure names the offending file and the parser's line and column.
  2. The gate is backed by a **declared** parser, not a transitive one. Either add `postcss` — the package Vite already installs — with `npm install --save-dev postcss` and parse each stylesheet with `postcss.parse`, or take an equivalent approach that resolves a package named in `web/package.json`. An undeclared transitive dependency is not acceptable: if the parser stops resolving, a gate that silently stops gating is worse than no gate, which is the exact trap IMP-026's own Notes warn about for a missing `npm run lint`.
  3. Because criterion 2 adds a devDependency, this item **amends** the never-proposed sentence at the top of this file, which currently reads that `web/package-lock.json` "is touched only by IMP-005 and IMP-137". The amended sentence names IMP-197 alongside them, and the amendment ships in the same change — a PR must not carry a `package-lock.json` diff the backlog forbids. `npm ci` in CI stays green against the committed lockfile.
  4. Nothing false-positives on the stylesheet as it stands: the new check reports **0** errors across every `.css` under `web/src` on the unmodified tree, and `npm run build` still succeeds. If a genuine pre-existing syntax error turns up while building this, fix it in the same change and say so — a gate that needs an allowlist on day one is not a gate.
  5. **Non-vacuity is demonstrated, not asserted.** In a `/tmp` rsync of `web/`, prepend Break B2's exact text to `web/src/styles.css` and quote the new check's non-zero exit with its named line and column; then prepend `@import "./__missing-partial.css";` and quote the existing `Build` step's non-zero exit, so both error classes are shown caught. Revert both and confirm green.
  6. `web/package.json`'s `dependencies` is **untouched** — the parser is a devDependency only, so the shipped bundle cannot grow. `cd web && npm run build` produces `dist/assets/index-*.js` byte-identical to the pre-change figure (quote the content hash) and `dist/assets/index-*.css` unchanged at 10,927 B.
- **Verification method:** `cd web && npm ci && npm run typecheck && npm test && npm run build`, quoting the `dist/assets/index-*.js` and `index-*.css` byte counts before and after the change; then run criterion 5's two injected breaks in a `/tmp` copy and quote both non-zero exits verbatim; then `git diff --stat -- web/package.json web/package-lock.json` to confirm the only manifest change is the one added devDependency and the lockfile entry it implies.
- **Effort:** M    **Risk:** med
- **Depends on:** none
- **Priority score:** 7.5
- **Notes:** Impact is 3: a dropped CSS rule is visible to every reader while CI is green, which is a real shipping defect — but not 4, because nothing is currently broken, `styles.css` is hand-maintained rather than generated, and the app remains usable with styles missing. Confidence is 5 for the gap (measured twice, with exact exit codes and the 10.93 → 11.86 kB signature) and 4 for the remedy, which is why this is 7.5 rather than higher: the parser choice in criterion 2 is a judgement call the item deliberately delegates. Effort is `M` — a devDependency, a check, a CI step, and the `package-lock.json` amendment in criterion 3. Risk is `med` because a stricter parser can reject CSS that browsers accept (vendor prefixes, at-rules, newer syntax), so criterion 4's "0 errors on the stylesheet as it stands" is the guard that keeps the gate from becoming a blocker. **The verifier's severity note is understated and this item corrects it:** §2 and §8 row 3 of `verify-IMP-026.md` say "`web/src/styles.css` is 2 lines, so nothing is currently at risk" — the file is **759 lines**, re-read here per this file's own evidence rule 1, which is also why the item is filed at all instead of closed as informational. Cross-references, deliberately **not** duplicated: IMP-026 (DONE) added the build step, and its Intent claims "a CSS pipeline error" fails it — this item is the gap inside that claim and reopens none of its criteria; IMP-137 (TODO, 5.0) creates the ESLint config and `npm run lint` for JavaScript/TypeScript and already amends the `package-lock.json` rule, so if it lands first, extend its amendment rather than writing a second one; IMP-086 (TODO, 15.0) adds `ruff` and a Python lint step, an unrelated toolchain; IMP-088 (TODO, NEEDS-HUMAN) is about adopting a *failing* security gate, a different decision with a different owner. Evidence: §2 Break B2 and §8 row 3 of `.improve/reports/verify-IMP-026.md`.

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

### IMP-179 — Assert `write_index`'s manifest / `shard_files` caller contract
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:259-276` (`write_index`), `scripts/build_index.py:275` (`_clean_old_shards(out_dir, keep=shard_files)`), `scripts/build_index.py:156,165,174-175` (`build_shards` filling `shard_files` and `manifest["shards"]` in one loop iteration)
- **Intent:** `write_index` derives the sweep's `keep` set from `shard_files` but takes the sweep's danger from `manifest`, and never checks that the two agree. If they did not, the sweep would delete a shard the manifest it just wrote references — recreating exactly the failure IMP-021 exists to prevent — and nothing would say so. The verifier constructed that case directly (`CASE C`: manifest refs `papers-2024-W07.json` while `shard_files` keys on `papers-2024-W05.json`, so the referenced file does not resolve). It is unreachable today: `build_shards` appends to `shards` and assigns `shard_files[filename]` in the same iteration, and `main` is the only caller — 0 mismatches over 500 randomized record sets. This item buys the invariant before a second caller exists, not after.
- **Acceptance criteria:**
  1. `write_index` verifies `{entry["file"] for entry in manifest["shards"]} == set(shard_files)` **before** any file is written, and raises `ValueError` naming both sets when they differ. The check runs before `os.makedirs`, so a mismatched call writes and deletes nothing.
  2. A test in `tests/test_build_index.py` calls `write_index` with a manifest whose `shards[0]["file"]` is not a key of `shard_files`, asserts the raise, and asserts `sorted(os.listdir(out_dir))` is unchanged from the pre-call fixture — including that a pre-existing shard named in the manifest is still present.
  3. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports **56** tests OK (55 pre-existing + 1) and `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-contract` exits 0, and a scratch script calling `write_index` with a hand-mismatched manifest raises `ValueError` and prints both sets.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 6.0
- **Notes:** Latent, not live — finding F-3 in `.improve/reports/verify-IMP-021.md` §8, with `CASE B` / `CASE C` from its §4b and the 0/500 randomized agreement from the same section. Confidence is 3 rather than 5 because the defect has never been observed; impact is 2 because the guard only helps a future second caller. Two related notes that are **not** claimed here: `_clean_old_shards`' empty default (`build_index.py:244`, D4 in `.improve/reports/discovered-IMP-021.md`) has no test of its own, and IMP-099 (TODO) changes the write lifecycle this check sits in front of — if IMP-099 lands first, re-read `write_index` and place the assertion **after** the atomic rename so a failed rename cannot leave a validated-but-unwritten manifest. The regression guard for the ordering itself is IMP-174.

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

### IMP-180 — Clear the partial-shard notice when a new window load starts
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:228-235` (the papers `useEffect`: `setLoading(true)` at `:233` and `setError(null)` at `:234`, with no `setFailedShards([])`), `web/src/App.tsx:638-676` (the `failedShards.length > 0` banner), `web/src/App.tsx:257` (the `setFailedShards([])` that exists only on the total-failure catch path)
- **Intent:** `failedShards` is cleared on success (`:248`) and on a total failure (`:257`), but not when a load **starts**. Changing the recency window therefore leaves the previous window's "Some papers could not be loaded. One week in this window failed to load (…)" mounted for the whole duration of the new load, while the thing below it is the loading panel, not a feed. The banner is stale-worded — it describes a window that is no longer on screen. Verified benign in the ways that matter: it stays mounted so it is not re-announced, and it produces no duplicate notice. Only the sentence is false while it is visible.
- **Acceptance criteria:**
  1. `web/src/App.tsx:234` clears `failedShards` alongside `error` at the start of the load effect, so the banner is unmounted for the whole loading window and reappears only if the new load actually has a failing shard.
  2. The total-failure path at `:257` keeps working: a load where every shard fails still shows the IMP-016 hard panel and never a stale partial banner.
  3. A new test in `web/src/__tests__/App.partialShard.test.tsx` drives a load with one failing shard, asserts the partial banner, starts a second load with no failing shard, and asserts the banner is absent while that second load is pending and absent after it resolves; a second test drives two failing loads in a row and asserts the banner is present again after the second. `cd web && npm run typecheck && npm test` passes with 15 test files and **234** tests (232 pre-existing + 2), no existing expectation weakened.
- **Verification method:** `cd web && npm run typecheck && npm test`; then serve a data directory whose 60-day window has a missing shard and whose 7-day window does not, switch the recency control, and confirm the banner disappears as soon as the loading panel appears. Screenshot to `.improve/artifacts/IMP-180/feed-partial-shard-cleared-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Cosmetic — finding R5 in `.improve/reports/regression-sweep-3.md` §2, which records it as verified benign ("the banner is not re-announced, it does not produce a duplicate notice, and it clears correctly as soon as the shard loads") and rates it stale-worded only. Impact is 1 for that reason. It is itemized because the fix is one line beside an existing `setError(null)` and because the false sentence is the same class of claim IMP-015 shipped specifically to avoid making. Cross-reference: do not fold this into IMP-101 (TODO, "Keep the previous list mounted while a new window loads") — that item is about not destroying card state and deliberately keeps a loading indicator visible, so the two are compatible but independent.

### IMP-181 — Keep the Sort group on the controls row at 1280px
- **Status:** TODO
- **Category:** UI polish & visual consistency
- **Type:** improvement
- **Area / files:** `web/src/styles.css:223-227` (`.controls__row`, `display: flex; flex-wrap: wrap; gap: 1rem 1.75rem;`), `web/src/styles.css:20,123` (`--max-width: 1000px` and its use), `web/src/styles.css:229-236` (`.controls__group`, whose intrinsic width is set by its chip row)
- **Intent:** IMP-010 added the "All" chip, which widened the Categories group enough that `flex-wrap` pushes the Sort group onto a second row at 1280px. Before that commit CATEGORIES, RECENCY and SORT all shared one row (compare `.improve/artifacts/regression-3/feed-default-1280.png` against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`). The wrap itself is graceful — labels and chips stay aligned, nothing is clipped, the card grows about 28 px, and the controls' padding and inner alignment are unchanged — so this is tracked as polish, not breakage. It is worth tracking because 1280px is the primary review viewport and a baseline screenshot comparison now shows a layout difference with no stated cause.
- **Acceptance criteria:**
  1. At 1280px the three control groups (`Categories`, `Recency`, `Sort`) render on **one** row, measured rather than inferred: all three `getBoundingClientRect().top` values of `.controls__row > .controls__group` are equal.
  2. No horizontal overflow at 1280px (`scrollWidth === clientWidth`), and no group, chip, or label is clipped or visually overlapping.
  3. Nothing changes at 390px or 520px relative to `.improve/artifacts/baseline/baseline-feed-mobile-390.png`, and the existing `@media (max-width: 520px)` block (`web/src/styles.css:720-753`) is neither re-indented nor re-authored.
  4. `cd web && npm run typecheck && npm test && npm run build` pass with no test change — this is CSS-only, and `git diff -- web/src` lists `styles.css` and nothing else.
- **Verification method:** `cd web && npm run build && npm run preview -- --port 5199 --strictPort`; at 1280px, 1024px and 390px record each `.controls__group`'s `getBoundingClientRect().top` and assert `scrollWidth === clientWidth`. Screenshot to `.improve/artifacts/IMP-181/feed-controls-one-row-desktop-1280.png`, compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Finding R6 in `.improve/reports/regression-sweep-3.md` §2, which judged it "a consequence of a deliberate feature, not breakage" — that judgement is why impact is 1. Risk is `med` because `.controls__row` is a shared flex row and the two obvious fixes both reach outside this item: widening `--max-width` changes the whole page's measure, and adding a breakpoint in the 520–1000px band is IMP-141's decision. **If one row at 1280px cannot be achieved without either, stop and report rather than making the call.** IMP-141 (NEEDS-HUMAN, "Add an intermediate layout breakpoint") owns that band and its own criterion 2 forbids changing 1280px, so it does not cover this.

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

### IMP-172 — Put the "No categories selected" action inside the `.empty` panel
- **Status:** TODO
- **Category:** UI polish & visual consistency
- **Type:** improvement
- **Area / files:** `web/src/App.tsx:489-500` (the `<p className="empty">No categories selected</p>` and the sibling `<p>` holding the "Select all categories" button), `web/src/App.tsx:391-399` (the retry panel, which nests its button correctly and is the model to copy), `web/src/styles.css:554-561` (`.empty`, whose `text-align: center` at `:556` applies only inside the panel)
- **Intent:** In the empty-category state IMP-010 introduced, the message "No categories selected" renders **inside** the dashed `.empty` panel and is centred by `text-align: center`, while the "Select all categories" button renders in a sibling `<p>` **outside** that panel and is therefore left-aligned to the page gutter. The two halves of one message-and-action pair sit at different horizontal positions and different widths, which reads as an accident rather than a hierarchy. The retry panel already does it correctly — `App.tsx:391-399` puts its "Try again" button inside the panel — so this new markup is the only place in the app that splits the pair, and IMP-010 deliberately added no `styles.css` rule for it, so there is no compensating alignment anywhere.
- **Acceptance criteria:**
  1. The `<p><button className="button">Select all categories</button></p>` at `web/src/App.tsx:491-499` is moved **inside** the same element that carries `className="empty"`, so `.empty`'s `text-align: center` applies to both and the structure matches the retry panel's.
  2. No rule in `web/src/styles.css` is added or changed: `git diff -- web/src/styles.css` is empty for this item, and the only layout change is the DOM nesting.
  3. The rendered horizontal centres agree, measured rather than inferred: at 1280px **and** at 390px the midpoint of the button's `getBoundingClientRect()` is within 2 px of the midpoint of the `.empty` panel's.
  4. Behaviour is untouched: the button keeps `type="button"`, the `button` class, its accessible name `"Select all categories"`, and real `Enter` and `Space` activation still restore the full selection; `cd web && npm run typecheck && npm test && npm run build` pass with the existing IMP-010 assertions in `web/src/__tests__/App.categories.test.tsx` **unmodified**.
- **Verification method:** `cd web && npm run typecheck && npm test`; then `npm run build && npm run preview -- --port 5199 --strictPort`, load `http://localhost:5199/research-paper-feed/#cat=`, and record both `getBoundingClientRect()` midpoints at 1280px and 390px. Screenshots to `.improve/artifacts/IMP-172/feed-no-categories-selected-desktop-1280.png` and `.improve/artifacts/IMP-172/feed-no-categories-selected-mobile-390.png`, the first compared against `.improve/artifacts/baseline/baseline-feed-no-categories-selected-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact is 1 — purely cosmetic, and the current form is fully usable and correctly keyboard-reachable as shipped; the IMP-010 verifier explicitly called this "not a defect" and recorded it as an observation. It is itemized because the fix is a two-line DOM move with no behavioural risk, and because the inconsistency is now visible to anyone who compares the two empty-state panels side by side. Cross-references: IMP-106 (TODO) adds a functional "Clear filters" action to the **other** empty state (`PaperList`'s generic "No papers match the current filters.") and is a separate change — if both land, that action belongs inside the same `.empty` panel for the same reason, so do not duplicate the nesting work across the two items. IMP-148 (TODO) adds `role="status"` to the empty states and constrains its own criterion 3 to "no CSS changes"; it neither covers this button nor should be allowed to substitute a markup-only nudge for it. §8.6 of `.improve/reports/verify-IMP-010.md`, which names `App.tsx:391-399` as the structure to copy.

### IMP-184 — Count undated drops in the manifest, not only in the log
- **Status:** TODO
- **Category:** Observability & logging
- **Type:** improvement
- **Area / files:** `scripts/build_index.py:243` (`undated = 0`, opened per category and never returned), `scripts/build_index.py:251` (`undated += 1`, on the drop branch), `scripts/build_index.py:262-267` (the `logging.warning` that is the only place the count surfaces), `scripts/build_index.py:180-198` (`build_shards`, where the manifest dict is assembled), `web/src/lib/types.ts:34-40` (`IndexManifest`, which must declare the new field)
- **Intent:** IMP-020 made a result with no usable `published` datetime get **dropped** rather than published as if it were recent, and counted the drop in a `logging.warning` at `:262-267`. That honours IMP-017's "surface failures rather than hide them" philosophy, and a **total** wipe is caught loudly by IMP-004's `No papers fetched; refusing to write an empty index.` exit 1. A **partial** wipe is not caught at all: `undated` never leaves `collect_papers`, so a deploy that dropped 40% of `cs.CV` exits `0`, publishes a smaller index, and produces a green CI run. The only evidence is a `WARNING` line in a deploy log nobody reads after the fact, with no machine-readable signal for `web/`, for a monitor, or for the next operator asking why the feed got shorter. The verifier measured that the warning has **never once fired** in roughly 18,500 real result observations (arxiv 2.1.3 returns a real `datetime` for `published` on every result), which is why this is a gap in the signal rather than a bug in today's output — and also why it is exactly the kind of thing that is discovered during an incident, when nobody is reading the log.
- **Acceptance criteria:**
  1. `collect_papers` returns the per-category undated drop count alongside the records and the `failures` list, and `main()` at `:395-404` passes it to `build_shards`. Choose the return shape — a `dict` keyed by category, a single summed integer, or both — name it in the PR body, and keep the existing `failures` keyword and its six test call sites at `tests/test_build_index.py:317,326,332,345` working unchanged or update them in this same change.
  2. The count reaches `index.json` as a named manifest field (e.g. `droppedUndated`, an integer) and `web/src/lib/types.ts`'s `IndexManifest` declares it. A **zero** value is written explicitly rather than omitted, so "the producer never reported it" and "the producer reported zero" are distinguishable — the same absent-vs-`null` distinction IMP-019 established for paper fields.
  3. A test in `tests/test_build_index.py` drives `collect_papers` with a fake `iter_results` yielding one fresh, one undated, and one fresh result, then asserts the returned count is `1` **and** that the count written into the manifest by `build_shards` is `1`. The all-fresh case asserts the manifest field is `0`, not absent. This must fail if the counter is removed, not merely if it is wrong.
  4. The `logging.warning` at `:262-267` is **kept**: the manifest field is machine-readable and the log line is human-readable, and neither substitutes for the other. Its message is unchanged so the existing `assertLogs` assertions in `test_undated_results_are_excluded_from_the_reported_count` (`tests/test_build_index.py:419-430`) pass unmodified.
  5. No reader-facing change is introduced by this item: the count is an operator/manifest signal, not something to render in the feed. If the loop later wants a reader notice, that is IMP-015's/IMP-017's territory and a separate item.
  6. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests plus the new ones, all passing and hermetic (re-run with the socket stubs armed), and the real-data smoke run `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-undated` exits `0` and writes `"droppedUndated": 0` — quote the exact JSON key and value from the produced `index.json`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then the smoke run above and `python3 -c "import json;print(json.load(open('/tmp/rpf-undated/index.json'))['droppedUndated'])"` (substituting the key name actually chosen), quoted; then a second run with a fake `iter_results` wired in a `/tmp` copy that yields an undated record, showing the manifest carrying `1` and the `WARNING` line still present in stderr — both signals together, which is the point of the item.
- **Effort:** M    **Risk:** med
- **Depends on:** IMP-094
- **Priority score:** 5.0
- **Notes:** Impact is 2, deliberately not higher: the counter has never fired on real data (0 of roughly 18,500 observations), so no shipped index is short today. The item is about the **absence of a boundary** on a silent-data-loss path, which is the same argument IMP-018's notes make for why a boundary must not hide a schema violation and IMP-176's notes make for why a log line is "better than silence but is not a boundary". Confidence is 5 for the gap (the counter is quoted from the file and never returns) and 4 for the remedy, because adding a field to the manifest is a **wire-contract change** with three consumers. Effort is `M` because it touches `collect_papers`'s return shape, `main`'s call, `build_shards`, the manifest JSON, `web/src/lib/types.ts`, and the tests that pin the existing return value — and criterion 2's absent-vs-zero requirement is a real design decision, not a one-liner. **Depends on IMP-094** (TODO, 12.5, above this item) because that item adds the Python→TypeScript wire-contract test; landing this field first means the contract test is written against a manifest shape that then changes. Cross-references, deliberately **not** duplicated: IMP-020 (DONE) created the `undated` counter and its warning and met all three criteria — this item does not reopen it, it carries the number past the log line; IMP-004 (DONE) owns the total-wipe refusal, which is the half that already works; IMP-176 (NEEDS-HUMAN, 12.0) is the **web-side** half of the same philosophy — a shard paper with no usable `published` is silently filtered by `paperIndex.ts:294` — and its product decision must be made separately; do not implement this item's reader-visible half under either ID. IMP-179 (TODO, 6.0) asserts `write_index`'s `manifest`/`shard_files` contract and is a natural place to see a new manifest key, but it is scored below this item and must not be used to hold this one up. IMP-167 (TODO, 10.0) requires the quoted commands in criterion 6. Finding **F3** in §9 of `.improve/reports/verify-IMP-020.md`, whose own suggested shape is a `droppedUndated` counter in `manifest`; §4a of the same report records the warning's current placement and confirms the total-wipe path is already covered.

### IMP-185 — Let `_result_datetime` accept a bare `date` instead of dropping it
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:201-207` (`_result_datetime`, whose `isinstance(published, datetime)` check at `:203` excludes a bare `date`), `scripts/build_index.py:92-93` (`iso_date`, which **does** accept a `date` — `if isinstance(value, date): return value.isoformat()`), `scripts/build_index.py:251` (the `undated += 1` branch that discards it), `tests/test_build_index.py` (`CollectPapersRetentionTests`, whose helper builds `SimpleNamespace` results)
- **Intent:** The retention filter and the shard writer disagree about what a date is. `iso_date` at `:92-93` explicitly handles a `date` object, so the pipeline **could** format one perfectly — but `_result_datetime` at `:203` requires `isinstance(published, datetime)`, and because `datetime` is a subclass of `date` and not the other way round, a bare `date` returns `None`, is counted as undated, and is dropped. The result is a module that can serialize a value it refuses to age-check: if the arXiv client ever returns `date` for `published` (or a future refactor, or a cached result set, does), the shard pipeline would handle the record fine and the filter would throw every one of them away — loudly, with a `WARNING` naming the category, but wrongly. The verifier drove the complete shape matrix through `collect_papers` and confirmed the two `date` rows (`date(2026,9,30)`, and a `date` derived from an aware datetime) both land in `DROPPED | WARNED`, while every `datetime` shape is kept or dropped on its merits. The asymmetry is the defect: two helpers in one file, one permissive, one not, with no comment saying the strictness is deliberate.
- **Acceptance criteria:**
  1. `_result_datetime` (`scripts/build_index.py:201-207`) accepts a bare `date` by coercing it to midnight UTC — `datetime.combine(published, time.min, tzinfo=timezone.utc)` — so a `date` is age-checked rather than discarded. A `date` is a whole-day value with no time, so record the convention explicitly in the function's docstring: midnight UTC is the **earliest** possible instant of that day, so a paper published "on" the cutoff day is kept. If instead midnight-UTC is judged wrong for the shard boundary, the alternative is a comment at `:203` stating that `date` is deliberately rejected and why — pick one and justify it in the PR body.
  2. `iso_date` at `:84-94` is **not** changed. Its `date` branch is what makes the two consistent once criterion 1 lands, and rewriting it would put a second behaviour change on the same concern.
  3. A test in `tests/test_build_index.py` drives `collect_papers` with a fake `iter_results` yielding a **fresh** `date(…)` and a **stale** `date(…)`, separated by a `datetime` boundary case, and asserts the fresh `date` survives, the stale `date` does not, and neither contributes to the `dropped %d result(s) with no usable published date` warning. Three shapes, two outcomes — a test that only feeds a fresh `date` would pass even if the coercion were wrong in the permissive direction.
  4. **No existing record changes fate.** A `datetime` — aware, naive, subclassed, `+05:30`, `-08:00`, `datetime.min`, `datetime.max` — keeps today's outcome exactly; the eight `date`/string/bytes/`None`/numeric/container rows in the verifier's matrix keep being dropped and warned. `test_result_without_a_datetime_published_is_dropped` (`tests/test_build_index.py:408-417`) passes **unmodified**, and its sibling `assert_logs` assertion is not weakened.
  5. A comment or docstring line at `build_index.py:203` states the full accepted-shape contract — `datetime` (aware or naive) and `date` — so the next reader does not have to re-derive the matrix. If criterion 1's alternative branch is taken, the comment says `date` is rejected and names the reason instead.
  6. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests plus the new ones, all passing, and `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0`.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util,datetime; s=importlib.util.spec_from_file_location('bi','scripts/build_index.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); r=type('R',(),{})(); [ (setattr(r,'published',v), print(repr(v), '->', m._result_datetime(r))) for v in (datetime.date(2026,9,30), datetime.date(2001,1,1), datetime.datetime(2026,9,30,12,tzinfo=datetime.timezone.utc), '2001-01-01', None) ]"` and quote all five lines, showing the two `date` values now producing aware datetimes and the string and `None` still producing `None`; then a live smoke run `/tmp/rpf-venv/bin/python scripts/build_index.py --category cs.CV --max-per-category 20 --out-dir /tmp/rpf-date` exits `0` and emits **no** `dropped ... no usable published date` warning, as it does today.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact is 1, honestly: 0 of roughly 18,500 real result observations were a `date`, so no shipped index is affected and no user sees anything. The reason to itemize it is that a **type inconsistency inside one module** is a latent bug with a loud-but-wrong failure mode, and the fix is three lines. Confidence is 5 — the two branches are quoted from the file and the matrix was driven end-to-end through `collect_papers`, not inferred. Risk is `low` because the coercion is additive: only shapes that are dropped today can change, and criterion 4 requires every one of them to be enumerated and asserted. Cross-references, deliberately **not** duplicated: IMP-020 (DONE) created the undated-drop policy at `:251` and its own criterion 1 required non-datetime records to be dropped — this item narrows what "non-datetime" means for the one shape the rest of the module can already handle, and it does not reopen IMP-020's criteria. IMP-115 (TODO, 10.0) owns `iso_date`'s docstring and its naive-datetime branch; criterion 2 must not duplicate that work, and if IMP-115 lands first, the `date` handling it documents there is what this item makes consistent. IMP-184 (TODO) carries the undated count into the manifest and depends on this item's shape decision landing first, since a `date` must stop counting as undated before the count means anything. IMP-176 (NEEDS-HUMAN) is the web-side policy question for records with no usable date and is unaffected either way. Finding **F2** in §9 and the complete shape matrix in §4b of `.improve/reports/verify-IMP-020.md`; the matrix is the evidence for criterion 4 and should be re-run, not re-derived.

### IMP-186 — Make `_result_datetime` total: return `None` instead of raising `OverflowError`
- **Status:** TODO
- **Category:** Error handling & edge cases
- **Type:** bug-fix
- **Area / files:** `scripts/build_index.py:207` (`return published.astimezone(timezone.utc)` — the only line that can raise), `scripts/build_index.py:201-205` (the function's guards, none of which cover the conversion), `scripts/build_index.py:265` (`except arxiv_common.arxiv.ArxivError`, the only handler wrapping the loop, which does **not** catch `OverflowError`)
- **Intent:** `astimezone` on a datetime at the very edge of the representable range overflows. The verifier drove the exact shapes: `datetime.min` with `tzinfo=+14:00` and `datetime.max` with `tzinfo=-12:00` both raise `OverflowError: date value out of range` from **inside** `_result_datetime`. Nothing catches it — `collect_papers` catches only `ArxivError` at `:265` — so the exception escapes `collect_papers`, escapes `main`'s per-category loop, and kills the whole deploy with a traceback, rather than being counted as one unusable record. The function is otherwise carefully total: it returns an aware datetime or `None` for **every** other input shape, which is precisely what makes the downstream `published < cutoff` comparison provably safe (the verifier traced it: `None` is intercepted at `:248` before it can reach the comparison, and every surviving value is UTC-normalized, so `TypeError: can't compare offset-naive and offset-aware datetimes` is structurally unreachable). This is the one hole in that totality, and it is cheap to close. It is **pre-existing and not a regression from IMP-020** — `:207` is untouched by that diff — and it is unreachable from the live arXiv API, which never returns year 1 or year 9999.
- **Acceptance criteria:**
  1. `_result_datetime` (`scripts/build_index.py:201-207`) cannot raise. The `astimezone` at `:207` is wrapped so that `OverflowError` and `ValueError` (which `astimezone` also raises for a `utcoffset` outside the valid range on a custom `tzinfo`) both yield `return None`, and the function's contract — aware `datetime` or `None`, never a raise — is stated in its docstring. A `try/except (OverflowError, ValueError): return None` is sufficient; no other behaviour in the function changes.
  2. A test in `tests/test_build_index.py` drives `collect_papers` with a fake `iter_results` yielding a fresh `datetime`, then `datetime.min.replace(tzinfo=timezone(timedelta(hours=14)))`, then another fresh `datetime`, and asserts the two fresh records survive, the edge record is counted and warned as undated, and **`collect_papers` returns normally** — the assertion that matters, since the pre-fix behaviour is an exception escaping the function, not a wrong list. `datetime.max.replace(tzinfo=timezone(timedelta(hours=-12)))` is the second case.
  3. The exception is **not** allowed to escape in any form: the suite must be green after the change, and a control run proves the test is non-vacuous — in a `/tmp` copy with the `try/except` removed, quote the resulting `OverflowError` and the failing-test count.
  4. `datetime.min` **naive** and `datetime.max` naive keep today's outcome exactly (`datetime.min` naive is dropped as old, `datetime.max` naive is kept as new) — the two must not be conflated with the offset-aware cases in criterion 2, which is the easy mistake here.
  5. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests plus the new ones, all passing, `git diff -U0 -- tests/ | grep -c '^-[^-]'` is `0`, and `/usr/local/bin/python3.11 -m compileall -q scripts tests` exits 0.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 -c "import importlib.util,datetime; s=importlib.util.spec_from_file_location('bi','scripts/build_index.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m); r=type('R',(),{})(); v=datetime.datetime.min.replace(tzinfo=datetime.timezone(datetime.timedelta(hours=14))); setattr(r,'published',v); print(repr(m._result_datetime(r)))"` must print `None` and exit `0` rather than raising; then repeat with `git show HEAD:scripts/build_index.py` in a `/tmp` copy to quote the `OverflowError` the change removes. No network is required for any of these.
- **Effort:** S    **Risk:** low
- **Depends on:** IMP-185
- **Priority score:** 5.0
- **Notes:** Impact is 1: the shapes are unreachable from arXiv today, so this is hardening against a future client change rather than a live bug. Confidence is 5 — the two overflowing shapes were driven through the real `collect_papers` path and the traceback was observed, and the absence of a handler was confirmed by reading `:265`. Effort is `S`: a two-exception `try/except` and two test cases. **Depends on IMP-185** only because both edit the same function in the same file and would otherwise conflict textually; IMP-185 is 5.0 like this item, so ordering inside the tier is free, and the dependency costs nothing in practice. The dependency is for edit hygiene, **not** correctness — either item can be implemented first as long as the other is rebased. Cross-references, deliberately **not** duplicated: IMP-020 (DONE) touched the retention filter and explicitly recorded this as out of scope in its own report ("`OverflowError` … is pre-existing and unchanged by this diff … Recorded as F4 for the backlog; **not** a regression from IMP-020"); IMP-046 (TODO, 15.0) guards a different uncaught exception — `OSError` from an unwritable `--out-dir` — and the same "return a code, do not raise" argument applies there, but it is a production change in `main()` rather than a helper's totality; IMP-176 (NEEDS-HUMAN) is the web-side policy question. Finding **F4** in §9 and the `OverflowError` paragraph in §4c of `.improve/reports/verify-IMP-020.md`.

### IMP-187 — Declare `| undefined` on `Paper.absUrl` and `Paper.pdfUrl`
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/lib/types.ts:21-23` (`primaryCategory: string | null`, `absUrl: string | null`, `pdfUrl: string | null`), `web/src/lib/collections.ts` (`parseExportPayload`, which yields `undefined` for an **absent** key rather than `null` for an explicit one), `web/src/components/PaperCard.tsx:33-35` (`safeHref(url: string | undefined)`, which already declares the wider type and is the reason the omission is invisible)
- **Intent:** IMP-019 (DONE) widened these three fields from `string` to `string | null` because the Python producer writes JSON `null` when arXiv omits a value. The verifier found the declaration still **narrower than the import path can yield**: `parseExportPayload` reads an untrusted JSON file off disk, and a payload whose paper omits `absUrl` entirely produces a value of `undefined`, not `null`. An absent key and an explicit `null` are different inputs — `Object.hasOwn` distinguishes them, `"absUrl" in paper` distinguishes them, `JSON.stringify` serializes them differently — and the declared type says only one of the two can occur. The runtime is already safe: the verifier's mutants R7 and R7b proved the render path pins nullish handling at runtime (252/253 and 247/253 failures respectively), so nothing is broken today. What remains is a type-lie of exactly the class IMP-019 was raised to remove, one step smaller: a future author who writes `paper.absUrl === null` to mean "no URL" silently misses the `undefined` case, and `safeHref`'s already-correct `string | undefined` signature becomes the only thing standing between that mistake and a broken `href`.
- **Acceptance criteria:**
  1. `web/src/lib/types.ts:22-23` declares `absUrl` and `pdfUrl` as `string | null | undefined`. **`primaryCategory` at `:21` is not changed**: an absent `primaryCategory` is rejected at the import boundary by design, so widening it would be a lie in the other direction — state that in the comment.
  2. The docstring block at `types.ts:10-20` is extended to say precisely what the previous block said for `null`, plus one sentence on `undefined`: the `null` case is what `record_from_result` emits for a value arXiv omitted, the `undefined` case is what `parseExportPayload` produces for a key the imported file did not contain, and the two are not interchangeable. The block's existing claim that the arXiv 4.x types are the authority is also corrected per IMP-019's verifier Finding 3 — `arxiv` is **not** installed here and `requirements.txt:1` is `arxiv>=2.1.0` with no upper bound, so the citation is unverifiable and the `str | None` attribution should be softened to a statement about the client leaving the value unset.
  3. **The runtime pins nothing new and nothing regresses.** A new test in `web/src/lib/__tests__/collections.test.ts` imports a payload in which one paper omits `absUrl` and `pdfUrl` **entirely** and a sibling sets both to `null`, and asserts both papers are retained and both render without an `href`. Reverting the `types.ts` change must fail `npm run typecheck` (that is the enforcement for this item — the verifier was explicit that the *types* are pinned by `tsc` alone, never by a test), while the render behaviour is pinned by the existing `web/src/__tests__/paperCardNullUrls.test.tsx` cases, which must pass **unmodified**.
  4. `isPaper` in `collections.ts` is **not** changed to reject an absent `absUrl`/`pdfUrl` — absence is legal, and the whole point of the item is that the type must say so rather than the validator hiding it.
  5. `cd web && npm run typecheck && npm test && npm run build` pass with no new total-count surprise: record the `Tests N passed (N)` and `Test Files N passed (N)` figures verbatim, and `git diff -U0 -- web/src/ | grep -c '^-[^-]'` is `0` for every test file.
- **Verification method:** `cd web && npm run typecheck && npm test`; then confirm enforcement by narrowing the declaration back to `string | null` in a `/tmp` copy and quoting the `tsc` error count, and separately confirm runtime safety by hand-editing a `/tmp` copy of an import payload to omit the keys and checking the DOM has no anchor with an empty or `"undefined"` `href`. Screenshot to `.improve/artifacts/IMP-187/collections-absent-urls-desktop-1280.png` against `.improve/artifacts/baseline/baseline-collections-desktop-1280.png`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact is 1 and confidence is 5. Impact is 1 because the verifier's R7/R7b mutants prove the **runtime** is already pinned and correct — no user can currently see a wrong `href` from this — and the harm is latent: a declaration that is narrower than reality, which this repo has now paid for once (IMP-019 at 20.0, where a `null` genuinely reached `href={null}`). The item is here because the fix is two characters of type and one sentence of comment, and because a second narrower-than-reality declaration on the same interface is the pattern that produced the 20.0 item. **Cross-referenced to IMP-098 rather than duplicated, as instructed.** IMP-098 (TODO, 10.0, `### IMP-098 — Validate the manifest and shard payloads at runtime`, at `.improve/FEATURES.md:2012`) owns **field-level runtime validation** for shard payloads, and its criteria name `id`, `title`, `authors`, `abstract`, `categories`, `primaryCategory` and `published` — it does **not** name `absUrl`/`pdfUrl` and it operates on the shard path, not the import path, so it does not close this. Do not widen IMP-098's criteria in place to absorb this item. Also cross-referenced and not duplicated: **IMP-151** (TODO) owns `isPaper`'s import-side field validation and is where a decision to *reject* an absent `absUrl` would belong if anyone ever wants that; criterion 4 forbids doing it here. **IMP-094** (TODO, 12.5) owns the Python→TypeScript wire-contract test, which pins the producer side of this declaration. Finding row 1 in §9 of `.improve/reports/verify-IMP-019.md`, and the R7/R7b mutant table in §4 of the same report. **Stale-profile note:** `.improve/REPO_PROFILE.md` §10 still lists IMP-019's "still-open half" as "`types.ts` still declares `absUrl`/`pdfUrl` as non-nullable `string`", which stopped being true when IMP-019 landed; the profile is not this item's write target, but whoever next edits it should correct that row rather than re-report it as a live defect.

### IMP-188 — Resolve the runtime no-op in the `primaryCategory` filter guard
- **Status:** TODO
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `web/src/App.tsx:352-363` (`visiblePapers`'s `inCategories` filter), `web/src/App.tsx:360-361` (`paper.primaryCategory !== null && active.has(paper.primaryCategory)` — the clause under review), `web/src/App.tsx:356-359` (its four-line comment), `web/src/__tests__/App.categories.test.tsx` (the four null-primary filtering tests IMP-019 added, which pin `tsc` and not runtime behaviour)
- **Intent:** IMP-019 widened `primaryCategory` to `string | null` and, to keep `visiblePapers` type-correct, added the `paper.primaryCategory !== null &&` clause at `:360` with a four-line comment explaining that a `null` primary "can never be in the set and the lookup is skipped". The clause is a **runtime no-op**: `activeCategories` is `categoryResolution.selected ?? manifest?.categories ?? []` (`App.tsx:191-192`), every element of which is a `string` from either the hash or the manifest, so `active` is a `Set<string>` and `Set.has(null)` is always `false` — the `!== null` test can never change the result. The verifier confirmed the consequence for the test suite: the four new `App.categories.test.tsx` tests "characterize null-primary filtering but would pass with or without that guard", so they are honest characterization tests and **must not be credited as new enforcement**; the guard is pinned by `tsc` alone. The code is not wrong — it is a redundant clause carrying a four-line comment that asserts a mechanism the reader cannot verify from the type alone, plus a `null` check whose necessity depends on a `Set<string>` that is one refactor away from becoming something else. The fix is to make the code say what it means, not to add a test that pins a no-op.
- **Acceptance criteria:**
  1. The clause at `web/src/App.tsx:360-361` is either **removed** — `active.has(paper.primaryCategory as string)` is not acceptable, so if the clause goes, `active` must be typed `Set<string | null>` (or the lookup narrowed) so `tsc` still passes without an assertion — **or** made load-bearing by giving the `Set` a type that makes the `null` case reachable. Pick one, name it in the PR body, and record which. If removed, the four-line comment at `:356-359` is rewritten to state the actual reason a `null` primary still reaches the feed: the `||` clause with `paper.categories.some(...)` at `:362`, which is what keeps such a paper filterable.
  2. **A real runtime test replaces the no-op characterization.** A test in `web/src/__tests__/App.categories.test.tsx` asserts the *observable* consequence: a shard containing one paper with `primaryCategory: null` and a non-empty `categories` array is **still shown** when that category is selected, and a second paper with `primaryCategory: null` and an **empty** `categories` array is **hidden** under every category selection. Those two cases are what `App.tsx:356-362` actually decides, and neither is pinned by the four existing tests. If criterion 1's "remove" branch is taken, this test must fail without the accompanying `Set` typing change — demonstrate it in a `/tmp` copy and quote the count.
  3. The four existing null-primary tests in `web/src/__tests__/App.categories.test.tsx` pass **unmodified**; none of their expectations is relaxed to accommodate the change. `git diff -U0 -- web/src/ | grep -c '^-[^-]'` is `0` for every test file.
  4. `cd web && npm run typecheck && npm test && npm run build` pass. **No `as` cast is introduced** to make criterion 1's removal type-check: `grep -n " as string" web/src/App.tsx` must return no new hit in the `visiblePapers` memo. The IMP-019 advisory that this file must carry forward — do **not** narrow `isHttpUrl`'s `(value: unknown)` parameter when widening types — is untouched by this item and remains in force.
  5. At 1280px and 390px, a shard paper with `primaryCategory: null` and a populated `categories` array renders the same card chrome and the same category chip as a paper with a primary category: no missing chip, no `undefined` in the text, no layout shift. Verified by screenshot, not by inference.
- **Verification method:** `cd web && npm run typecheck && npm test`; then `npm run build && npm run preview -- --port 5199 --strictPort` against a `/tmp` copy of `web/public/data/` with one paper's `primaryCategory` set to `null` and another's `categories` emptied, and confirm the two behave differently under `#cat=cs.CV`. Screenshots to `.improve/artifacts/IMP-188/feed-null-primary-category-desktop-1280.png` and `.improve/artifacts/IMP-188/feed-null-primary-category-mobile-390.png` against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` and `.improve/artifacts/baseline/baseline-feed-mobile-390.png`. Do not hand-edit the repo's `web/public/data/`.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact is 1 and confidence is 5. The verifier rated it **INFO**, and that rating is preserved here: nothing is broken, no user is harmed, and `tsc` enforces the current form. The item exists for two narrow reasons — a dead runtime clause carrying a four-line explanatory comment is a lie the reader cannot check, and four tests that look like enforcement but are not are worse than no tests, because the next verifier will count them. That second reason is the real content: the verifier explicitly wrote "a reviewer should not credit them as extra enforcement", and nothing in the codebase records that. Effort is `S` — one clause, one comment, two test cases. Cross-references, deliberately **not** duplicated: IMP-019 (DONE, 20.0) introduced both the clause and the four tests, met all three of its criteria, and reopened none of them here — this item records a residual of its implementation, not a failure of it. IMP-098 (TODO, 10.0) owns shard-side field validation; its criterion-2 drop-and-log policy is the right home if anyone decides a `null` primary category should be *dropped* rather than rendered, and that decision must not be smuggled in under this item's narrower scope. IMP-170 (TODO, 10.0) guards `noCategoriesSelected` on a manifest that actually has categories and edits the same `activeCategories` derivation at `App.tsx:191-192`; the two are compatible but touch adjacent lines, so state the ordering in the PR body if both land. IMP-176 (NEEDS-HUMAN) is the `published`-date analogue on the web side. Finding row 2 in §9 and the "Is `tsc`-only pinning of the types adequate?" section of `.improve/reports/verify-IMP-019.md`, which is the source of the characterization-test caveat this item's criterion 2 exists to resolve.

### IMP-191 — Test that `readme.md` and `--help` agree, instead of checking by hand
- **Status:** TODO
- **Category:** Test coverage & test quality
- **Type:** test
- **Area / files:** `readme.md:42-44` and `readme.md:96-109` (the flag table and the range column), `scripts/build_index.py:340-360` (`parse_args` and its validators — currently reachable only through `parse_args(argv=None)`, with no separately testable parser object), `scripts/paper-collector.py:35-38` (`--max-papers`), `tests/test_paper_collector.py:262` (`MaxPapersArgumentTests.test_documented_example_command_still_parses`, which hard-codes one readme example's argv instead of reading the readme)
- **Intent:** Profile §4.5 requires the readme and `--help` to agree, and IMP-022's AC5 discharged that duty **by hand** — the verifier reconciled 11 flags and found zero value or range discrepancies, then recorded that `grep -rn "readme\|--help\|subprocess" tests/` returns **no match**, so nothing in the suite holds the two in sync. The nearest test hard-codes a single readme example's argument list, so if the readme drifts, the test keeps passing and the agreement silently lapses. This matters more than a typical missing test because the readme is the only user-facing documentation for a CLI whose defaults and accepted ranges are enforced in code: a readme that says `--retention-days 0` is fine, or omits a flag that now rejects values, is a documentation defect that no other gate can see. The verifier also proposed the cheap 80% route — a readme-row-versus-parser test that needs no subprocess — and flagged that the `--help` half additionally requires either a `subprocess` call or a `build_parser()` refactor.
- **Acceptance criteria:**
  1. The readme flag table (`readme.md:96-109`) is parsed **from the file**, not from a fixture, and every flag named in it exists in `build_index.py`'s parser. Add the test either by extracting a `build_parser()` from `parse_args` (`scripts/build_index.py:340`) so the parser object can be inspected in-process, or by running `python scripts/build_index.py --help` via `subprocess.run([sys.executable, …], capture_output=True, text=True)` with a network-free, import-safe environment. Name the route in the PR body.
  2. The **inverse** direction is asserted too: every flag the parser accepts is present in the readme table. A one-way check would let a new flag ship undocumented, which is exactly what IMP-114 exists to prevent for `--category`.
  3. For each numeric flag the readme states a range, that range token appears in the `--help` output, so IMP-022's AC5 — that `--retention-days`, `--abstract-chars` and `--max-per-category` all show their accepted ranges — is enforced rather than remembered. `scripts/paper-collector.py --max-papers` is covered the same way, matching IMP-051's and IMP-022's range statements.
  4. The test is **hermetic**: no network, no writes outside `tempfile`, and no import of `arxiv` at module scope that is unavailable on the interpreter running the suite. If the `--help` route is used, the subprocess must run `sys.executable` with `cwd` set to the repository root so the script is found, and the captured output must be asserted with a bounded timeout.
  5. **Non-vacuity is demonstrated.** In a `/tmp` copy, edit `readme.md` to rename one flag (`--retention-days` → `--retention`) and to state a wrong range for another, then quote the failing-test count for each edit. A test that passes on a drifted readme does not satisfy this criterion.
  6. `readme.md` stays lowercase and is otherwise byte-identical except for the two deliberate drift edits made inside `/tmp`; the real file's content is unchanged by this item. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` reports the pre-existing 77 tests plus the new ones, all passing.
- **Verification method:** `/usr/local/bin/python3.11 -m unittest discover -s tests -v`; then `/usr/local/bin/python3.11 scripts/build_index.py --help` and `/usr/local/bin/python3.11 scripts/paper-collector.py --help`, diffed by eye against `readme.md:96-109` as the baseline the new test will enforce; then the two `/tmp` drift edits with their failing counts quoted. No network access is required for any step.
- **Effort:** M    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact is 2: the agreement currently holds, so no reader is misled today; the item buys the ability to **notice** the next drift automatically. Confidence is 5 — the absence of any readme or `--help` test was established by grep over `tests/`, and IMP-022's hand reconciliation is documented in its report. Effort is `M` rather than `S` because the cheap 80% (readme rows versus the parser) is only half the item: covering `--help` needs either a `subprocess` call with a hermetic environment or a `build_parser()` extraction, and criterion 3's range-token check needs the `--help` text specifically. Risk is `low` — it is a test plus, at most, a pure extraction inside `parse_args`; no flag, default, or validation rule may change, which is what criterion 6's byte-identical requirement enforces. Cross-references, deliberately **not** duplicated: IMP-022 (DONE) met AC5 by hand and its own verifier filed the residual here, so this item does not reopen it; IMP-114 (TODO, 10.0) documents `--category` in the readme and its criterion 2 already requires readme/`--help` agreement by hand — when it lands, the readme row it adds must also satisfy this item's criterion 2, and the two must not each grow a private copy of the flag list; IMP-051 (TODO, 15.0) returns a real exit code from `paper-collector.py` and may change that script's `--help` text, so **re-run criterion 3 afterwards** if both land; IMP-163 (TODO, 7.5) closes test-quality gaps in the same `tests/` tree but is Python-extraction-specific. §8 Finding 3 of `.improve/reports/verify-IMP-022.md`, which names `MaxPapersArgumentTests.test_documented_example_command_still_parses` as the near-miss and explicitly recommends the readme-row route as "the cheaper 80%".

### IMP-210 — Correct `ci.yml`'s "~0.3 s" and "~3000x" figures for the index step
- **Status:** TODO
- **Category:** Repo hygiene
- **Type:** docs
- **Area / files:** `.github/workflows/ci.yml:54-64` (the `Build the paper index` comment: "the normal run makes a single request and measures ~0.3 s" at `:56`, and "A legitimate run is ~0.3 s, so the cap is ~3000x the happy path and cannot flake" at `:63-64`), `.github/workflows/ci.yml:65` (`timeout-minutes: 15`)
- **Intent:** The comment that justifies the CI index step's cap quotes a happy-path cost of "~0.3 s" and derives "~3000x" headroom from it. Measured on the exact CI command at the shipped configuration, the run takes **0.49 s** wall — `python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-198-smoke` returns exit 0, writing `index.json` (287 B) and one shard, in `real 0.49`. The correct ratio is therefore ~1800×, not ~3000×. The direction of the claim is unaffected — 900 s is still ~1800× the real cost and cannot flake a healthy run — but the file presents rounded ratios as exact, in a comment whose entire job is to let a reader re-derive the safety margin from the numbers. The neighbouring sentence has the same shape of problem: "15 min = 900 s is 2.5x that 360 s worst case" is 2.4993× of the *measured* 360.06 s. Small, real, and free to fix, and this loop's own evidence rules (a figure must quote the command that produced it) are what make it worth a line.
- **Acceptance criteria:**
  1. `.github/workflows/ci.yml:56` and `:63-64` state the measured happy-path figure and the ratio derived from it, and the two agree with each other. Either quote the command and the output verbatim (`real 0.49`) or state the figure as approximate and drop the false precision from the multiplier ("roughly three orders of magnitude" is acceptable; "~3000x" against an unstated 0.3 s is not).
  2. If a measured figure is quoted, the comment names the command that produced it, matching the style the same comment block already uses for the 360.08 s retry measurement.
  3. The 2.5× sentence at `:63` is either left as a stated approximation or corrected to the measured 360.06 s, and whichever it is, the comment does not present a rounded ratio as an exact one.
  4. **No behaviour changes.** `timeout-minutes: 15` stays, the `run:` line stays byte-identical, and `git diff -U0 -- .github/workflows/ci.yml | grep -c '^-[^-]'` is `0` apart from the comment lines themselves (or the PR argues each deletion line by line). `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green and IMP-198's cap tests are untouched.
- **Verification method:** `time python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-210` on a healthy network, quoting the real elapsed time; then `git diff -- .github/workflows/ci.yml` read as a whole to confirm the comment's numbers are internally consistent.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact 1, Confidence 5, Effort S = 5.0 — the arithmetic is the honest summary of a comment-accuracy fix, and the harm is to this loop's evidence rather than to any user. Filed anyway because the comment is the *justification* for a cap that IMP-198's tests then lock in, so a reader checking the margin finds a number that does not reproduce. Confidence 5 for the corrected figure (0.49 s measured on the exact command) and 4 for the original 0.3 s being wrong rather than measured on a different machine — the discrepancy's origin is not recoverable, which is itself the reason to re-measure rather than to argue about it. **Deliberately not bundled with IMP-205**, which edits the same step's cap in `deploy.yml` and re-derives the same arithmetic from the measured page count: this item is a comment in `ci.yml`, that one is two YAML values and a test constant, and combining them puts a one-line hygiene fix inside a change that should be reviewed on its own. Cross-references, deliberately **not** duplicated: **IMP-198** (DONE, `b7e23a8`) wrote the comment and is the source of the numbers; this is a residual of its implementation, not a failure of it — its verifier recorded it as **F-4**, explicitly non-blocking and with the direction of the claim unaffected. **IMP-167** (TODO, 5.0) owns the process rule that every figure quote its command; this item is that rule applied to two numbers in one file. Evidence: finding **F-4** in `.improve/reports/verify-IMP-198-r2.md` §9, and the 0.49 s measurement in that report's §4, which also records the `index.json` (287 B) and shard the same run wrote.

### IMP-211 — Make `readme.md`'s deep-offset claim name no category or offset it did not measure
- **Status:** TODO
- **Category:** Docs
- **Type:** docs
- **Area / files:** `readme.md:73-76` ("`--max-per-category` is not only a speed knob here: a full uncapped run pages `cs.AI` past `start=9000`, and arXiv's API answers deep offsets with HTTP 500, which aborts the whole run before anything is written. Capping keeps a local build on the first page."), `scripts/build_index.py:43-45` (`UNLIMITED = 100000`, the code-side fact that *is* verified), `readme.md:46` (the Quick Start command the paragraph explains)
- **Intent:** The paragraph is the right explanation in the wrong register of certainty. Two specifics in it — that it is **`cs.AI`** that trips, and that the failure is **past `start=9000`** — come from one implementer's live `curl` probes on one day. The *mechanism* (a full uncapped run pages past an offset arXiv answers with 5xx, which aborts the run before anything is written) was independently confirmed by a different verifier against a stubbed upstream, and the code-side fact that makes it reachable (`UNLIMITED = 100000` names a limit arXiv's manual refuses above 30,000) is verifiable from the repository. The specific numbers are not, and they cannot be: the offset at which a category trips is a function of how many in-window papers that category currently holds, so it moves as arXiv grows and differs per category per day. A readme sentence that names a fixed offset is therefore wrong within weeks of being written, in a document whose whole purpose here is to be the thing a newcomer trusts.
- **Acceptance criteria:**
  1. The paragraph states the mechanism and the code-side cause without naming a category or a specific offset — "an uncapped run pages each category past the deep offsets arXiv answers with an HTTP 500" — or, if the specific figures are kept, each is re-measured against live arXiv in this PR and the measurement (command and output) is quoted in the PR body, with the date recorded in the prose. Hedging the wording is sufficient on its own; re-measuring is an alternative, not a requirement.
  2. The sentence that survives is **true of every default category**, not just the one that happened to fail. `cs.AI` is not special; the bound is what is special, and if the prose still implies one category is affected while the other four are fine, that implication is removed.
  3. **The cause named is the one that is actually in the code.** If the paragraph is reworded, the thing it points at is `UNLIMITED = 100000` at `scripts/build_index.py:45` and, once it is capped, the deploy step's flag — not a restatement of arXiv's behaviour alone. A reader who follows the sentence must be able to arrive at the line of code they would have to change.
  4. `readme.md` stays lowercase, the Quick Start command at `:46` is unchanged by this item, and no other readme paragraph is reworded. The `readme.md` ↔ `--help` reconciliation IMP-191 (TODO, 5.0) is meant to enforce is not disturbed.
  5. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` and `cd web && npm run typecheck && npm test` are green; no test or workflow file is touched.
- **Verification method:** `git diff readme.md` with the deletions counted; read `readme.md:64-80` as a whole and confirm the paragraph and the flag list at `:64-71` tell the same story; if the specific figures are kept instead, quote the `curl` command and its status codes in the PR body.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact 1, Confidence 5, Effort S = 5.0. Impact is 1 because the paragraph's *advice* is correct and its mechanism is verified — a reader who caps `--max-per-category` does avoid the failure, which is the only action the sentence asks of them. What is wrong is the precision: two unverified specifics stated flatly in the file the repo treats as authoritative onboarding, in a paragraph that exists precisely because it was evidence-cited. Confidence 5 that the specifics are implementer-only, because the verifier who checked them said so explicitly and declined to re-measure them against the live API on instruction. Effort is `S` — the minimum honest fix is deleting a category name and an offset, and the re-measuring route is a few `curl` calls. Cross-references, deliberately **not** duplicated: **IMP-204** (TODO, 12.5) is the fix — it bounds the paging, adds per-category degradation and gives the deploy path a documented default — and its own Notes require `readme.md:73-76` to be updated to describe the new default rather than a workaround. This item is only the interim accuracy fix for the disclosure, so **if IMP-204 lands first, close this item as absorbed** rather than editing a paragraph the code fix has already rewritten. **IMP-191** (TODO, 5.0) tests readme/`--help` agreement for the **flag table** and would not catch a prose claim like this one. **IMP-116** (TODO, 8.0) is the other readme-accuracy item in this tier area and owns a different paragraph. Evidence: finding **R-4** in `.improve/reports/verify-IMP-031-r2.md` §6, whose wording is the recommendation this item implements: "Keep the prose; soften to 'deep offsets' (no category or offset named) unless someone re-verifies against live arXiv."

### IMP-214 — Drop the unsupported staleness clause from the pin's header comment
- **Status:** TODO
- **Category:** Repo hygiene
- **Type:** docs
- **Area / files:** `web/src/__tests__/indexGuardRegistration.test.ts:33-39` (the closing paragraph of the file's header comment, the sentence beginning "Its cost was not only the false positive but its staleness:" and ending "…so it would have outlived its own reason."), `web/src/__tests__/indexGuardRegistration.test.ts:21-24` (the import of `viteConfig` the removed witness used, now gone), `.improve/reports/verify-IMP-028d.md` §2d (the refutation)
- **Intent:** IMP-028d's own verifier confirmed the drop of the fourth witness was right, and in doing so refuted one clause of the rationale the implementer left behind. The removed witness read **`viteConfig.test.include` from the imported, evaluated module** — the *resolved* config value, not the file's text. The verifier built the exact refactor the "staleness" claim predicts would break it (globs moved to `src/sharedGlobs.ts` as `export const testInclude`, `vite.config.ts` doing `import { testInclude }` + `include: testInclude`) and ran the pin with the witness restored: **`Tests 4 passed (4)`**. So the witness would *not* have gone stale under a config split, and the surviving comment carries a rationale its own evidence does not support. The implementer took a brief-provided premise, tested it, correctly reported the premise was wrong (".improve/reports/impl-IMP-028d.md"), committed — and then did not propagate the correction into the file's own comment, because the comment had been written first. The verifier recorded this precisely: "**No change required to the code**; a verifier reading the comment should know not to re-derive the drop from that sentence." Harmless as prose. Left in place, it is the next reader's most likely reason to *restore* a witness that demonstrably fails on a working configuration — which is exactly the false positive IMP-028d removed. This loop treats an untraceable claim in a comment as worse than an absent one, so it gets fixed here.
- **Acceptance criteria:**
  1. The staleness clause is removed or corrected. Removed: the paragraph keeps "It caught no real hole that witnesses 1 and 3 do not already catch" and the `exclude: ["scripts/**"]` / rename blindness, and keeps the `**/*.test.mjs` false-positive paragraph, but no longer claims the witness "would have outlived its own reason" or that it asserted "a shape of the `include` expression rather than a fact about collection". Corrected instead: if any staleness rationale is kept, it is a statement the evidence supports — for example that the witness asserted on the **resolved imported config**, so a config split into a *second* `vitest.config.ts` (experiment H2, where `vite.config.ts` kept the glob but the config vitest actually uses did not) is read from the wrong file. Pick one; leaving the current sentence is not one of the options.
  2. If the sentence is corrected rather than deleted, the re-derived reason is stated as a **mechanism** (which file it reads, and what a config split does to that), not as the word "staleness". The false-positive paragraph — the actual justification for the drop — is **not** weakened or removed, and the closing pointer to `.improve/reports/impl-IMP-028d.md` stays.
  3. The comment continues to describe the three surviving witnesses accurately: `vitest list --filesOnly` (spawned, collects the guard suite), the same listing checked for *this* file, and a `list --json` for the guard suite's named cases. The "There was a fourth witness" framing is retained — a reader must still learn that one existed and why it is gone.
  4. **Comment-only.** The file's executable content does not change: `git diff -U0 -- web/src/__tests__/indexGuardRegistration.test.ts | grep -c '^[+-][^+-]'` counts only comment lines, and the file still has exactly **3** `it(` blocks. `cd web && npm test` is green at **19 test files / 292 tests**, and `git diff --stat -- web/ tests/ scripts/ .github/` shows no other path. No test is added, removed, skipped, or weakened.
- **Verification method:** `git diff -- web/src/__tests__/indexGuardRegistration.test.ts` and confirm every changed line begins `//` or ` *`; `grep -c 'it(' web/src/__tests__/indexGuardRegistration.test.ts` returns `3`; `cd web && npm test` reports `Test Files 19 passed (19)` / `Tests 292 passed (292)` with exit 0; and re-read the resulting comment against `.improve/reports/verify-IMP-028d.md` §2d, confirming no clause in it contradicts that refutation.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact 1, Confidence 5, Effort S = 5.0. Impact is 1: no behaviour changes, nothing is broken, and the verifier explicitly said no change to the code was required. What is wrong is that a comment asserts something the implementer's own evidence contradicts, in a file whose whole job is to be the trustworthy witness — so the cost of leaving it is that a future reader re-derives a decision from a premise that was tested and found false. Confidence 5: the refutation is a reproduction, not an argument — the verifier built the config-split refactor, restored the witness verbatim, and got `4 passed (4)`. Effort S: one sentence. Risk low: prose only. Cross-references, deliberately **not** duplicated: **IMP-028d** (DONE, `2ebdbd3`) is the change this comment describes and is **not** incomplete on behaviour — its verifier named this exact sentence as the one thing worth changing and said the code itself needs none. **IMP-028c** (DONE, `49af325`) created the file and its comment; the paragraph was edited by 028d and this is the residue. **IMP-212** (TODO, 10.0) documents the same suite's arrangement in `CONTRIBUTING.md` for contributors; this item is the source comment's own accuracy and neither satisfies the other. **IMP-167** (TODO, 5.0) owns the general rule that every figure and claim quote its evidence — this is one clause of that rule applied to one comment. Evidence: §2d of `.improve/reports/verify-IMP-028d.md`, quoted verbatim for the claim under test: "So the brief's staleness claim was **wrong**, and the implementer's correction is **right** … the stale-sentence remaining in the surviving header comment … is the one clause of that paragraph that its own evidence does not support" and "the brief's staleness claim was wrong — witness 4 read the resolved imported config and passed a config-split refactor."

### IMP-215 — `readme.md:63` drops the `web/public/` prefix from the shard path
- **Status:** TODO
- **Category:** Content accuracy
- **Type:** docs
- **Area / files:** `readme.md:63` ("This writes `web/public/data/index.json` plus `data/papers-<YYYY>-W<NN>.json`."), `scripts/build_index.py:38` (`DEFAULT_OUT_DIR = os.path.join("web", "public", "data")`), `scripts/build_index.py:358-366` (`write_index` writes every shard **and** the manifest into that one directory)
- **Intent:** The sentence correctly names the manifest's full path and then gives the shard a **different, shorter** path in the same breath. `build_index.py:38` puts both in `web/public/data/`, and `write_index` (`os.makedirs` then `json.dump(shard)` per shard, then `json.dump(manifest)`) writes them **into that single directory** — there is no separate `data/` anywhere. So the sentence names a repository-root `data/` that is never created, while the reader who just ran step 1 and is staring at `web/public/data/` is told the shards went somewhere else. Two consequences beyond the typo: a contributor who cannot find `data/papers-*.json` may conclude the build wrote no shards and re-run it, and the sentence makes step 1 look as though it writes *outside* the web app, which is the opposite of the design. **Pre-existing** — confirmed present at `b2447c5`, before any of IMP-028's work — and found and correctly **declined to be bundled** by the IMP-028b implementer as an unrelated change, which is why it is filed rather than fixed.
- **Acceptance criteria:**
  1. `readme.md:63` names **both** outputs with the same prefix, so the sentence reads as one location: the manifest and every `papers-<YYYY>-W<NN>.json` shard land in `web/public/data/`. Either both paths carry the `web/public/` prefix or neither states a path at all — a sentence that gives one full path and one partial path is the defect, so do not "fix" it by shortening the manifest path instead.
  2. The corrected sentence is **verifiable against the code, not merely plausible**: `scripts/build_index.py:38` resolves `DEFAULT_OUT_DIR` to `web/public/data`, and `write_index` writes shards and manifest into that one directory, so the readme's claim matches both. Quote both locations in the PR body.
  3. `--out-dir` is not re-documented here, and the paragraph does not claim the shards are relative to the **current working directory**. If the sentence needs a "relative to the repository root" qualifier because `--out-dir` defaults there, add it; do not invent a second path.
  4. `readme.md` stays lowercase, no other readme paragraph is reworded, and the IMP-028b paragraph at `readme.md:118-123` describing what `npm run build` requires is unchanged. The `readme.md` ↔ `--help` reconciliation IMP-191 (TODO, 5.0) enforces is not disturbed.
  5. **Docs only.** `git diff --stat -- web/ tests/ scripts/ .github/` is empty. `/usr/local/bin/python3.11 -m unittest discover -s tests -v` is green (**104 tests OK**) and `cd web && npm run typecheck && npm test` is green (**19 files / 292 tests**); neither is modified by this item.
- **Verification method:** `cat -n readme.md | sed -n '60,66p'` and confirm the two output paths agree with each other and with `scripts/build_index.py:38`; then `/usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-215` and `ls /tmp/rpf-215` to show the manifest and the shard landing in the **same** directory, which is the fact the sentence now has to state correctly. No browser run and no build needed.
- **Effort:** S    **Risk:** low
- **Depends on:** none
- **Priority score:** 5.0
- **Notes:** Impact 1, Confidence 5, Effort S = 5.0. Impact is 1: a wrong path in one onboarding sentence, with no runtime effect — the build is correct and the readme's *primary* claim (the manifest is at `web/public/data/index.json`) is right. Confidence 5: the two locations were read from source, the divergence was confirmed present at `b2447c5` via `git show`, and the sentence is quoted verbatim. Risk low: one line of prose. Cross-references, deliberately **not** duplicated: **IMP-116** (TODO, 8.0) is the other `readme.md` path/claim accuracy item and owns `readme.md:22`'s "only the week shards it needs" over-claim — a different line and a different kind of wrongness (a bandwidth promise versus a path). **IMP-091** (TODO, 15.0) documents the manifest and shard **schemas** in `readme.md`; if it lands first this item is likely absorbed, since a schema section would restate the location — close it as absorbed in that case rather than editing the same paragraph twice. **IMP-049** (TODO, 10.0) resolves `DEFAULT_OUT_DIR` against the repo root, which touches the *same* `build_index.py:38` line; it changes where the path resolves from, not whether the two files share a directory, so it does not obsolete this item — but if it lands first, re-read this sentence against the new resolution before editing. **IMP-192** and **IMP-211** (TODO, 5.0) are the other readme items in this tier area; neither touches `:63`. Evidence: §1.2 row `63` and §8.5 of `.improve/reports/verify-IMP-028b.md`, both quoting the pre-existing status: "`git show b2447c5:readme.md | grep -n 'papers-<YYYY>'` returns line 63 unchanged" and "Pre-existing, not introduced: `readme.md:63` documents the shard output as `data/papers-<YYYY>-W<NN>.json`, missing the `web/public/` prefix … the readme names a repository-root `data/` that never exists … it makes step 1 look like it writes outside the web app."

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

## Tier 20.0 — new from the IMP-193 / IMP-025 / IMP-026 verification round

### IMP-198 — Bound the arXiv HTTP request with a real timeout and a CI job timeout
- **Status:** DONE
- **Category:** Correctness
- **Type:** bug-fix
- **Area / files:** `scripts/arxiv_common.py:20-26` (`build_client`, the only place an `arxiv.Client` is constructed — it passes `page_size`, `delay_seconds`, `num_retries` and nothing else), `.github/workflows/ci.yml:21-49` (the `web-tests` job, which since IMP-193 runs a live network call at `:45-47`), `.github/workflows/ci.yml:45-47` (the `Build the paper index` step), `.github/workflows/deploy.yml:33-34` (the same script on the weekly deploy, with the same exposure)
- **Intent:** IMP-193 put a live arXiv query into the `web-tests` job, and **no version of the `arxiv` library this repo can resolve sets an HTTP timeout on its own.** Verified directly against the version CI installs, `arxiv 3.0.0`: `arxiv.Client.__init__` is exactly `(self, page_size: int = 100, delay_seconds: float = 3.0, num_retries: int = 3)` — there is no timeout parameter — the constructor body ends with `self._session = requests.Session()` (a plain `requests.Session`, whose default `timeout` is `None`), and the request is issued as `resp = self._session.get(url, headers={"user-agent": "arxiv.py/2.3.2"})` with **no `timeout=` argument**. The local `arxiv 2.1.3` is identical in this respect (`arxiv/__init__.py:165`). So nothing in `scripts/` can bound the request today. Consequence, measured not inferred: against a server that accepts the connection and never answers, `build_index.main()` was **still blocked after 30 s** with no client-side escape. In CI that is not a 51-second red — it is a job that runs to GitHub's **360-minute** job limit, burning six runner-hours per occurrence. The fast-failure path is fine (a transient arXiv 5xx retries 6× at a 10 s gap and then exits 1 in ~51 s, which is IMP-004 working as designed); the hang is the unmitigated failure mode, and it is the one no acceptance criterion in IMP-193 mentioned. It matters more than its frequency: once IMP-028 makes a missing index fail-closed, this step becomes load-bearing for the required check on **every** pull request, so a hang blocks every PR meanwhile. Do both halves — the source-level timeout so the CLI and the deploy path are bounded too, and the workflow-level `timeout-minutes:` as a backstop that survives even a client that cannot be bounded.
- **Acceptance criteria:**
  1. `scripts/arxiv_common.py` installs a request timeout on the client it builds. `arxiv.Client.__init__` exposes no timeout knob in 2.1.3 or 3.0.0, so the only supported hook is the session: after constructing the client, replace `client._session` with a `requests.Session` subclass whose `request()` does `kwargs.setdefault("timeout", <N>)` before delegating to `super().request(...)` — this intercepts the library's internal call because `Session.get()` delegates to `Session.request()`. Verify this hook empirically before relying on it (`arxiv.Client(page_size=5)` has a plain `requests.Session` at `_session`; the call site reads `self._session.get(url, headers=…)`). Because `_session` is a private attribute, add a comment naming it as such and a defensive fallback that raises a clear error rather than silently running unbounded if the attribute is ever absent. A named module constant (e.g. `DEFAULT_REQUEST_TIMEOUT_SECONDS`) sits beside the existing `DEFAULT_PAGE_SIZE` / `DEFAULT_DELAY_SECONDS` / `DEFAULT_NUM_RETRIES` block at `:15-17`.
  2. `.github/workflows/ci.yml` gains `timeout-minutes:` on the `web-tests` job **and** — belt and braces, because a job-level cap still burns its full budget — a step-level cap on the index step at `:45-47`, either `timeout-minutes:` on the step or a `timeout 60 python …` prefix on the existing `run:` line (`coreutils timeout` is present on `ubuntu-latest`; confirm it on the first run rather than assuming). State the chosen value and both values in the PR body. Do the same judgement for `deploy.yml:33-34`, which runs the identical script.
  3. **Demonstrate the hang is bounded, in both halves, by measurement — not by assertion.** For the client half, stand up a local server that accepts a connection and never responds, point the script at it, and quote the observed wall-clock (it must fail at the timeout, not at the 30 s kill). For the workflow half, quote the value chosen and confirm the YAML key resolves for that job and that step via `/usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print(d['jobs']['web-tests'].get('timeout-minutes'))"`.
  4. **Nothing regresses and nothing is weakened.** The successful path is unchanged: `/usr/local/bin/python3.11 -m unittest discover -s tests` is green, `cd web && npm run typecheck && npm test && npm run build` are green, and a real `python scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/<tmp>` still exits 0 and writes `index.json` plus a shard. IMP-004's hard-fail contract is intact: a 5xx response still produces exit 1 with an empty out-dir, not a partial index. The timeout is an **additive `setdefault`**, so a caller that already passes its own timeout keeps it.
  5. `git diff -U0 -- .github/workflows/ | grep -c '^-[^-]'` is `0` for the workflow files unless the PR body argues otherwise line by line, and no `continue-on-error` or `|| true` is introduced on the index step.
- **Verification method:** `/usr/local/bin/python3.11 -c "import arxiv, inspect; print(inspect.signature(arxiv.Client.__init__))"` on both 2.1.3 and the 3.0.0 CI resolves (a venv from `pip install -r requirements.txt` is the honest way — do not rely on the interpreter already on `PATH`), and confirm `arxiv/__init__.py`'s `self._session.get(...)` call site still passes no timeout. Then the black-hole probe: a `/tmp` script that binds a socket, accepts, and sleeps, redirected at through `build_client`, quoted with its elapsed time. Then `yaml.safe_load` on both workflow files to print the resolved timeouts. Then the full green set from criterion 4.
- **Effort:** S    **Risk:** med
- **Depends on:** none
- **Priority score:** 20.0
- **Notes:** Risk `med` because criterion 1 reaches into a private attribute (`Client._session`) — the sole available hook on the admitted version range, and one that arxiv could rename in a future major. It is a **floor, not a fix**, in the same sense as IMP-033's `requirements.txt:10-12` disclaimer: if a future arxiv release moves the request off that session, this hook silently stops applying. That is exactly why criterion 2's workflow-level `timeout-minutes:` is required rather than optional — it bounds the cost regardless of what the library does, which is the property that actually matters here. Confidence is 5: the missing `timeout=` is read directly off the installed package source at two versions, and the hang was measured with a live black-hole server rather than inferred. Impact is 4, not 5: no reader sees anything, but a six-runner-hour burn per occurrence on a bill, plus a block on every PR once IMP-028 lands. Effort is `S`: one constant, one session subclass, two YAML keys. **Order this before or with IMP-028**, not after — IMP-028 turns the hang from "expensive occasionally" into "blocks every PR". Evidence: finding 1 of `.improve/reports/verify-IMP-193.md` §9 (`med`, "Actionable: Yes… Worth doing before or with IMP-028"), with the hang measurement in §1.4 and the API facts in §1.1; independently re-verified for this item against `arxiv` 3.0.0 and 2.1.3 (`Client.__init__` signature, `_session` type, and the `self._session.get(url, headers=…)` call site). IMP-033 (`bbe2d18`) is a **prerequisite in spirit only** — its `<4` bound keeps the same private-session shape valid across the admitted range, so the two compose and neither needs the other to land first. | commit pending; attempt 2 PASS

### Tier 5.0 — new from the IMP-193 / IMP-025 verification round

### IMP-199 — Give the two `web-tests` install steps distinct names
- **Status:** TODO
- **Category:** Repo hygiene
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:31` (`- name: Install dependencies` on `pip install -r requirements.txt`), `.github/workflows/ci.yml:39` (`- name: Install dependencies` on `npm ci`), `.github/workflows/deploy.yml:30,42` (the existing precedent: `Install Python dependencies` / `Install web dependencies`)
- **Intent:** The `web-tests` job has two steps both named `Install dependencies`. GitHub Actions renders a log by step name, so a reader scanning a failed run sees "Install dependencies" twice and cannot tell which install failed without opening both. IMP-193's own acceptance criterion 2 required the new pip step's name and `run:` to be byte-identical to `ci.yml:16-17`, which is why the collision was introduced — a defensible call under a byte-identity constraint, and the reason this is filed as hygiene rather than a defect. The repo already has the fix elsewhere: `deploy.yml` distinguishes `Install Python dependencies` from `Install web dependencies`.
- **Acceptance criteria:**
  1. The two steps in `web-tests` have distinct, self-describing names. Match `deploy.yml`'s existing vocabulary rather than inventing a third scheme: `Install Python dependencies` and `Install web dependencies` (or `Install npm dependencies`). Either assignment is acceptable; state which and why.
  2. Only the `name:` values change. No `run:`, `uses:`, `with:`, `working-directory`, or step **order** is altered, and `python-tests`' step names at `:16` and `:18` are left alone — it has no collision, so renaming it is churn.
  3. `/usr/local/bin/python3.11 -c "import yaml; d=yaml.safe_load(open('.github/workflows/ci.yml')); print([s.get('name') for s in d['jobs']['web-tests']['steps']])"` prints no duplicate names, and `git diff -U0 -- .github/workflows/ci.yml | grep -c '^-[^-]'` is `0`.
- **Verification method:** the two commands in criterion 3, quoted verbatim in the PR body. No browser check and no test run is needed: this changes a display string and nothing that executes.
- **Effort:** S    **Risk:** low
- **Priority score:** 5.0
- **Depends on:** none
- **Notes:** Impact 1, Confidence 5, Effort S = 5.0, and the arithmetic is the honest summary of a cosmetic fix. Filed because the ambiguity is permanent and grows: the verifier for every future CI item reads this file's step names. **Not an IMP-193 defect** — AC2's byte-identity requirement is why the name collides, and the verifier explicitly declined to reopen the item over it (`.improve/reports/verify-IMP-193.md` §6, "cosmetic nit (non-blocking)"). Deliberately **not** bundled with IMP-200: that item changes what the pip step *does* (caching), this one changes only what it is *called*, and separating them means either can land without the other.

### IMP-200 — Cache the `web-tests` pip install, or stop paying for it twice
- **Status:** TODO
- **Category:** Repo hygiene
- **Type:** tooling
- **Area / files:** `.github/workflows/ci.yml:31-33` (the new `pip install -r requirements.txt` in `web-tests`), `.github/workflows/ci.yml:13-15` (`python-tests`' `actions/setup-python@v5`, which has **no** `cache:` input), `.github/workflows/ci.yml:16-17` (`python-tests`' identical, equally uncached `pip install`), `.github/workflows/ci.yml:34-38` (`setup-node@v4` with `cache: npm` — the pattern to copy)
- **Intent:** IMP-193 added a `pip install -r requirements.txt` to `web-tests` that installs the **same `requirements.txt` into a fresh interpreter** that `python-tests` already installs a few seconds earlier in the same run. The file is byte-identical and the cache key would be identical, so the second install is pure duplicated latency — measured at roughly 10–40 s per run depending on the wheel cache — on a job that also does `npm ci`, a typecheck, 253 vitest tests, a live arXiv query and a Vite build. Neither `setup-python` call caches, so this is a pre-existing miss that IMP-193 inherited rather than created; the duplication is what IMP-193 added. The job already demonstrates the pattern it should use: `setup-node@v4` at `:34-38` carries `cache: npm` and `cache-dependency-path: web/package-lock.json`.
- **Acceptance criteria:**
  1. A judgement is made and stated, not deferred: either add `cache: pip` to the `actions/setup-python@v5` step at `:28-30` (with `cache-dependency-path: requirements.txt` if the default hash path is wrong for this layout), or eliminate the duplication another way — e.g. a single job that runs both suites, or a composite action shared by `web-tests` and `python-tests`. The PR body records which option was chosen and why.
  2. If `cache: pip` is chosen, the cached key covers `requirements.txt`. Verified by a PR body note that a change to `requirements.txt` invalidates the cache — not by asserting the key string, which `actions/setup-python` generates.
  3. **`python-tests` is not left inconsistent.** If caching is added to `web-tests` only, criterion 1's judgement must say why, and the asymmetry is recorded in the PR body rather than discovered later. A cache on one job and not the other is defensible only if it is a decision, not an oversight.
  4. `cache: pip` requires no new dependency and no new action version: the step stays `actions/setup-python@v5`, matching `ci.yml:13-15` and `deploy.yml:26-28`. SHA-pinning remains IMP-134's job and this item must not pre-empt it.
  5. Nothing is weakened: no existing step is deleted, `python -m unittest discover -s tests -v` still appears exactly once (in `python-tests`, per IMP-193's AC4), and `/usr/local/bin/python3.11 -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml'))"` parses.
- **Verification method:** the YAML parse from criterion 5; then confirm from the Actions run log on a second push that the `web-tests` pip step reports a cache hit rather than installing from scratch, and quote the before/after step duration. Quote the judgement from criterion 1 in the PR body — a verifier should be able to reject an item that added a cache with no stated reasoning.
- **Effort:** S    **Risk:** low
- **Priority score:** 5.0
- **Depends on:** none
- **Notes:** Impact 1 (developer and runner minutes, not correctness), Confidence 5 (the duplication is visible by diffing `ci.yml:16-17` against `:31-33`), Effort S = 5.0. The genuine uncertainty is which fix is right — a cache helps both jobs, de-duplication helps more but restructures the workflow, and the profile's INF-09 already lists "no pip cache" as pre-existing. That is why criterion 1 demands a stated judgement instead of naming a solution. **Pre-existing, not an IMP-193 regression:** `python-tests` was uncached before this item and is still uncached; IMP-193 only made the gap visible by adding a second caller. Evidence: `.improve/reports/verify-IMP-193.md` §9 row 6 ("cosmetic… `pip install` is uncached in `web-tests`, duplicating ~10–40 s of install that `python-tests` already pays") and the profile's INF-09.

### IMP-201 — Correct the `--output-dir` flag description to mention the CSV
- **Status:** TODO
- **Category:** Docs
- **Type:** docs
- **Area / files:** `readme.md:106` (`| \`--output-dir\` | Directory the generated HTML feed is written to. | \`results\` |`), `readme.md:111-112` (the note IMP-025 added below the table), `readme.md:98` ("The extracted papers are saved under `results/` as an HTML feed."), `scripts/paper-collector.py:303,306,308-313` (the behaviour being documented)
- **Intent:** Since IMP-002, `--output-dir` receives the `--save-csv` file as well as the HTML feed — `paper-collector.py:303` creates the directory and `:306` joins the CSV path onto it — but the flag table still says only "Directory the generated **HTML feed** is written to". A reader scanning the table, which is the first thing anyone reads, learns a false thing. IMP-025 could not fix it: its AC3 forbade rewording the table so the `--save-csv` row stayed byte-identical, and the implementer correctly added a clarifying note at `:111-112` instead and escalated the residue. That note is genuinely sufficient for a careful reader **of the CLI**, which is why this is a low-severity accuracy fix rather than a defect — but the table itself is still wrong, and the residue was knowingly left behind.
- **Acceptance criteria:**
  1. `readme.md:106`'s `--output-dir` description names both artifacts — the HTML feed **and** the optional `--save-csv` file — in the same terse register as the rest of the table. The `Default` column stays `` `results` ``.
  2. The `--save-csv` row at `readme.md:109` keeps its flag name and description **byte-identical**; IMP-025's AC3 constraint is not reopened. No other table row is reworded, reordered, or re-aligned.
  3. Once `:106` and `:111-112` both describe the same behaviour, the two do not contradict each other and neither contradicts `readme.md:98`. If `readme.md:98` ("saved under `results/` as an HTML feed") becomes the awkward sentence after the table is fixed, update it too — but only if that is the minimum change that removes the contradiction; do not rewrite the surrounding prose.
  4. The claim is verified against the code, not against the readme: `/usr/local/bin/python3.11 scripts/paper-collector.py --help` and a static trace of `paper-collector.py:303,306` show the CSV and the HTML both resolve under `args.output_dir`, including when the directory does not exist beforehand.
- **Verification method:** `git diff readme.md` with the deletions counted (`grep -c '^-' ` on the diff), the `--help` capture, and a read of `readme.md:98-113` as a whole. No test or browser run is needed — IMP-025's test `MainOutputPathTests.test_save_csv_writes_into_output_dir_and_never_the_cwd` already pins the behaviour this documents; confirm it is still green rather than rewriting it.
- **Effort:** S    **Risk:** low
- **Priority score:** 5.0
- **Depends on:** none
- **Notes:** Impact 1, Confidence 5, Effort S = 5.0. Filed as a **known-remaining inaccuracy that IMP-025 deliberately left in place**, not as an IMP-025 defect — the verifier scored AC3 met and recorded this residue as nit N2 (`.improve/reports/verify-IMP-025.md` §3.3), explicitly noting that AC3 forbade touching the row and that `:111-112` is the sanctioned workaround. IMP-025's `readme.md` diff is `3 additions, 0 deletions`, which is the evidence that the constraint was honoured. Do not remove or reword `:111-112` as part of this item — it remains accurate and it is what makes the interim state safe. **Read alongside IMP-202**, which fixes the same note's *scope*: `:106` is incomplete and `:111-112` is over-broad, so they are two halves of one small docs cleanup. They are separate items only so that either can be closed by a different owner.

### IMP-202 — Scope the `--output-dir` note to the CLI, or give the notebook the same fix
- **Status:** TODO
- **Category:** Docs
- **Type:** docs
- **Area / files:** `readme.md:111-112` ("Both the HTML feed and the optional `--save-csv` file are written into `--output-dir`, which is created if it does not already exist."), `readme.md:122-127` (the paragraph advertising the notebook), `notebooks/paper-collector.ipynb` (cell 6, cell-source line 8 — cell-source line 60 counting every cell's source cumulatively — `df.to_csv(topic+"_papers.csv", index=False)`, writing to the CWD; cell 8, cell-source line 34 — `filename = 'results/' + topic + '-' + str(len(df)) + '_papers_extracted_on_' + prefix + '.html'`, hardcoding `results/` and never creating it)
- **Intent:** The note IMP-025 added under the CLI flag table says "Both the HTML feed and the optional `--save-csv` file are written into `--output-dir`". That is **true of `scripts/paper-collector.py` and false of the notebook**, which the readme advertises eleven lines later as "a Jupyter notebook version of the same workflow". The notebook defines **no CLI flags at all** — no argparse, no `--save-csv`, no `--output-dir` — so it cannot honour the note; its CSV lands in whatever directory the kernel happens to be running in, and its HTML write hardcodes `results/` without creating it. A reader who follows the note, then clicks through to the notebook, gets different behaviour and no warning. The note is unscoped rather than wrong, which is exactly why this is a wording judgement and not a bug: the cheapest honest fix is to qualify it ("the CLI writes…"), and the alternative — making the notebook honour `--output-dir` too — is real work that belongs in the notebook items (NB-1…NB-6 in the profile) rather than in a docs edit.
- **Acceptance criteria:**
  1. **Choose one of the two routes and say which in the PR body.** Route A (recommended, cheap): scope `readme.md:111-112` to the CLI — e.g. "The CLI writes both the HTML feed and the optional `--save-csv` file into `--output-dir`, which it creates if it does not already exist" — so it cannot be over-applied to the notebook, and leave `notebooks/paper-collector.ipynb` byte-identical (`git diff --stat -- notebooks/` is empty). Route B: port `--save-csv` / `--output-dir` semantics into the notebook so the unqualified note becomes true for both surfaces; in that case the notebook's `results/` write must also create its directory (profile NB-5), or the two are inconsistent in a new way.
  2. If Route B is taken, the notebook's CSV path is built the same way the CLI's is — under an output directory that is created before the write — and it must not regress the profile's existing notebook rows: NB-1 (`arxiv.Search()` omits `max_results`), NB-2 (no `html.escape`), NB-3 (MathJax over plain `http://`), NB-4 (no `try` around `download_pdf`), NB-5 (`results/` never created), NB-6 (unused `numpy` import). This item owns **none** of those and must not silently close them; list them as still open in the PR body.
  3. The notebook cell that writes the CSV is identifiable by the reader without counting JSON source lines — quote the cell index and, if you count cell-source lines, state that you are counting cumulatively across all cells (the absolute number differs from the line within its own cell; `60` cumulative, `8` within cell 6). A PR body that cites only "line 57" is not verifiable against the current file and will be rejected as an ungrounded citation.
  4. Route A only: `/usr/local/bin/python3.11 -m unittest discover -s tests` and `cd web && npm run typecheck && npm test` are green and `git diff readme.md` shows the wording change is the only edit. Route B only: `git diff --stat -- notebooks/paper-collector.ipynb` is non-empty and the notebook still opens and runs its cells in order in a clean kernel.
- **Verification method:** Route A — read `readme.md:98-127` as a whole and confirm the note's scope and the notebook paragraph no longer conflict; `git diff --stat -- notebooks/` empty. Route B — open the notebook in a clean kernel, run the cells in order against a directory with no `results/` subdirectory, and confirm both outputs land under the output directory and the directory is created. Quote which route you took and the notebook cell index in the PR body.
- **Effort:** M    **Risk:** low
- **Priority score:** 5.0
- **Depends on:** none
- **Notes:** Impact 2 (a reader following the readme into the notebook gets different behaviour from the one the readme just promised), Confidence 5, Effort M = 5.0. **This is deliberately scoped as a judgement, not a mandate:** Route A is one word of wording and closes the inaccuracy; Route B is a real change to an unowned surface and drags six pre-existing notebook defects into the blast radius. The item states both so the owner picks, but recommends A. Raised by `.improve/reports/verify-IMP-025.md` §9 item 1 (nit N1, §3.3): the note is true of the CLI table it sits under, and "a reader could over-apply it to the notebook". **Pre-existing, not an IMP-025 regression:** the notebook's CWD CSV write predates this loop entirely and was already inventoried as part of the NB-* rows; IMP-025 only placed an accurate note next to a stale surface. The profile's trap 6 applies — `scripts/paper-collector.py` and the notebook are separate surfaces and a fix to one is not a fix to the other. Cross-references, deliberately **not** duplicated: IMP-201 fixes the same note's *completeness* at `readme.md:106`; this item fixes its *scope* at `:111-112`. Profile PY-31 (downloads also land in CWD, `paper-collector.py:239-243`) is the same defect class on the CLI and is inventoried separately — do not fold it in here.

### IMP-203 — Close PY-29 in the profile; it was fixed by IMP-002
- **Status:** DONE
- **Category:** Repo hygiene
- **Type:** docs
- **Area / files:** `.improve/REPO_PROFILE.md:807` (the PY-29 row), `.improve/REPO_PROFILE.md:868` (the IMP-002 row that already names PY-29 as closed), `scripts/paper-collector.py:303,306` (the fixed behaviour), `.improve/reports/verify-IMP-025.md` §3.3 nit N3 and §9 item 3 (the escalation)
- **Intent:** `.improve/REPO_PROFILE.md` still lists **PY-29 as an open defect** — "`--save-csv` ignores `--output-dir` — the CSV lands in CWD, where the `results/*.csv` ignore rule does not cover it" at `paper-collector.py:138`. Both halves are false. The CSV path is `os.path.join(args.output_dir, …)` at `paper-collector.py:306`, `os.makedirs(args.output_dir, exist_ok=True)` runs unconditionally **before** it at `:303`, and `.gitignore:6` (`results/*.csv`) covers the default location. The cited line `:138` is the CSV write's **former** location; it is now `:306`. PY-29 was fixed by **IMP-002, commit `d3b4a1e`** — the profile's own §10 already says so at `:868` ("`--save-csv` now honours `--output-dir`… PY-29"), which is why this is a one-row contradiction inside a single file rather than a real defect. A stale open-defect row is worse than no row: a future verifier reads §9 as the inventory of what is broken and re-raises landed work as new debt, which is the exact failure mode §10 exists to prevent.
- **Acceptance criteria:**
  1. `.improve/REPO_PROFILE.md`'s PY-29 row is marked fixed in the same style as the profile's other closed rows (compare **PY-30** at `:808` and **WEB-37** at `:731`), naming IMP-002 and commit `d3b4a1e`, and the location cite is corrected to `paper-collector.py:303, :306`.
  2. The row keeps the same three-column shape (`ID | Defect | Location`) as every other row in that table. No row is deleted — a deleted row loses the history — and no table is reformatted, restyled, or re-padded.
  3. The change is surgical: the profile is edited with targeted replacements, not rewritten. The diff touches only the PY-29 row and, if genuinely required, the §10 recently-fixed list. No other section is restyled.
  4. The claim is verified against the code, not against the other doc: `paper-collector.py:303` precedes `:306`, the CSV path is joined onto `args.output_dir`, and a run with `--save-csv --output-dir <absent nested path>` writes the CSV there and leaves the CWD empty. `.gitignore:6` covers the default `results/` location.
- **Verification method:** `git diff .improve/REPO_PROFILE.md` (must be small and confined), a read of the PY-29 row in its table, and the criterion-4 CLI run quoted in the PR body. No test or browser run is needed — `tests/test_paper_collector.py`'s `MainOutputPathTests.test_save_csv_writes_into_output_dir_and_never_the_cwd` (IMP-025, `058acc0`) already pins the behaviour; confirm it is green rather than adding a test.
- **Effort:** S    **Risk:** low
- **Priority score:** 5.0
- **Depends on:** none
- **Notes:** Status set to **DONE** on creation: this item is a profile correction, `.improve/REPO_PROFILE.md` is not a source file, and the edit is a one-row change with no acceptance criterion that can fail on the way in — the criteria are the check a **verifier** applies after the fact. Impact 1, Confidence 5, Effort S = 5.0; the score reflects the cost of the same stale row surviving, which is verifier time spent re-deriving a fix that landed at `d3b4a1e`. Raised twice and correctly escalated both times rather than edited out of scope: `.improve/reports/verify-IMP-025.md` §9 item 3 (nit N3, §3.3) — "`REPO_PROFILE.md` is stale on PY-29 (still 'open', cites the obsolete line `:138`)… Correctly escalated rather than edited; whoever owns the profile should close it" — and independently §8 finding N3 in the same report. The IMP-025 verifier's note that the implementer "escalated this in `.improve/reports/discovered-IMP-025.md` rather than editing a file outside its scope" was the right call and is why the defect survived to this item. **While editing this table, also close PY-27** (`:805`), whose "**Still open — IMP-023**" is likewise false: IMP-023, commit `297ed71`, made `safe_filename` a real sanitizer — it now has `MAX_SLUG_BYTES = 200`, `FALLBACK_SLUG = "_"`, `WINDOWS_RESERVED_NAMES` and `truncate_to_bytes`, and `safe_filename("..")` returns `"_"`, `"CON"` returns `"CON_"`, and a 300-character input is capped to 200 bytes. And remove the now-false IMP-023 clause from §10's "still-open halves" note at `:884`. Do **not** restyle the file; use targeted edits, and never rewrite it whole — a full-file write has failed repeatedly for other agents in this loop.

