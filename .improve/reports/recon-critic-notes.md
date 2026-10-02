# Backlog Critic — audit trail for `.improve/FEATURES.md`

Critique date 2026-10-02, baseline SHA `1c075b3`. Critic role: fresh, skeptical, no prior
authorship of the backlog. Only `.improve/FEATURES.md` was written; no commits, no pushes,
nothing under `.kilo/worktrees/mildly-income/` was read or touched.

## Headline

| | Before | After |
| --- | --- | --- |
| Total items | 142 | **147** |
| `TODO` | 142 | **140** |
| `NEEDS-HUMAN` | 0 | **7** |
| Items removed (merged away) | — | **3** |
| Items added | — | **8** |
| Acceptance-criteria rewrites | — | **39** |
| Wrong file/line citations fixed | — | **17** |
| Inflated scores corrected | — | **2** |
| Dangling cross-references fixed | — | **14** |
| Fabricated/inflated factual claims corrected | — | **6** |

Verification performed at the end: `/usr/local/bin/python3.11 -m unittest discover -s tests`
→ `Ran 27 tests … OK`; `cd web && npm run typecheck` → clean; `npm test` → 3 files, 36 tests
passed. Baseline is unmodified.

---

## 1. Fact-check

Spot-checked **all 147** surviving items' cited paths and line numbers against the real files
(read in full: `web/src/App.tsx` 458, `paperIndex.ts` 164, `collections.ts` 293, `search.ts`
91, `types.ts` 40, `PaperCard.tsx` 173, `PaperList.tsx` 67, `FeedControls.tsx` 113,
`CollectionsView.tsx` 254, `main.tsx` 16, `styles.css` 759, `scripts/build_index.py` 309,
`arxiv_common.py` 59, `paper-collector.py` 149, all three test files, both workflows,
`web/package.json`, `web/vite.config.ts`, `web/tsconfig.json`, `web/index.html`,
`requirements.txt`, `.gitignore`, `CONTRIBUTING.md`, `readme.md`, and all 9 notebook cells),
and executed the Python claims.

### Verified true (spot checks, all reproduced)

- `dedupe_records` mutates its caller's input: input `[{'categories': ['cs.CV']}, …]` came back
  with `['cs.CV', 'cs.LG']` after the call. **IMP-042 confirmed by execution.**
- `arxiv_id_from_entry('…/hep-th/9901001v1')` and `'…/math/9901001v1'` both return
  `'9901001'`. **IMP-043 confirmed by execution.**
- `format_authors([SomeInstance()])` returns `['<__main__.SomeInstance object at 0x103557410>']`.
  **IMP-044 confirmed by execution.**
- `safe_filename('..') == '..'`, `safe_filename('../../etc') == '.._.._etc'`, and a 400-char
  title passes through untruncated. **IMP-023 confirmed by execution.**
- `html.escape(None)` raises `AttributeError: 'NoneType' object has no attribute 'replace'`.
  **IMP-053 confirmed by execution.**
- Test counts are exactly as the profile states: `collections.test.ts` 14, `paperIndex.test.ts`
  10, `search.test.ts` 12 = 36; Python 5 + 18 + 4 = 27. Every "N pre-existing tests" claim in
  the backlog that names a file is correct.
- `git ls-files | wc -l` is **38**, not the 43 the backlog claimed (**IMP-090** corrected).
- `web/src/App.tsx` is 458 lines, has exactly one `<h1>` in the feed and none in collections,
  and `<main id="main">` at `:346` has no `tabIndex` — confirming IMP-074, IMP-072, IMP-012.

### Fabricated or inflated claims caught (6)

1. **IMP-061** claimed "a 60-day window across five categories is **tens of thousands of
   papers**". The index actually on disk is `totalPapers: 2812` across 2 shards with 1,408,061
   characters of abstract. Rewritten to the measured figures.
2. **IMP-127** claimed "at a plausible **10k–20k papers** … ~12M characters lowercased plus ~12 MB
   of string garbage per keystroke". Same inflation — an order of magnitude high. Rewritten to
   ~1.4 M characters lowercased three times over (~3.9 MB of allocation) at the measured size,
   with the note that the cost is linear in index size.
3. **IMP-015** claimed one bad shard "discards**ing the eight shards** that did load". The real
   index has **2** shards. Rewritten to "every other shard that did load", with the observation
   that the failure mode scales with shard count.
4. **IMP-083** claimed "the manifest error paths are well covered (404, network throw, HTML
   fallback, **malformed JSON**)". Read the test file: there are only three such tests
   (`paperIndex.test.ts` "throws a descriptive error when the manifest is missing", "wraps
   network failures in IndexUnavailableError", "treats an HTML fallback … as unavailable"). The
   200-with-non-JSON-body path at `paperIndex.ts:90-97` has **no** test. Claim corrected and a
   third test added to criterion list.
5. **IMP-121** claimed "the only way to clear a query is to select the text and delete it; there
   is no `×` affordance". The input is `type="search"` at `FeedControls.tsx:38`, so several
   engines already render a native clear button. Premise corrected; criterion 2 now requires the
   implementer to reconcile with what the reference engine renders before adding a control.
6. **IMP-093** stated the `--download-pdfs` crash as unconditional. The provisioned interpreter
   has **arxiv 2.1.3**, where `Result.download_pdf` and `download_source` both exist — so the
   crash does *not* reproduce locally. It is real for `arxiv >= 3`, which `requirements.txt:1`
   (`arxiv>=2.1.0`, no upper bound) resolves to today. Item rewritten to say so; its verification
   also no longer `pip install "arxiv>=4"` into the shared `/tmp/rpf-venv` that every other item
   depends on.

### Wrong file/line citations fixed (17)

| Item | Was | Is |
| --- | --- | --- |
| IMP-012 | `styles.css:10` `--text-muted` | `styles.css:9` |
| IMP-013 | `styles.css:8` `--border`; `:301-303` `.paper` border | `:7`; `:297-299` |
| IMP-066 | `App.tsx:113-118` for the sticky 64px header (that range is `formatGeneratedAt`) | `styles.css:113-120` |
| IMP-092 | `styles.css:753-756` for the 390px `.save-menu__body` rule | `:749-752` |
| IMP-141 | `styles.css:21` `--max-width`; `:46-50` `.controls__row` (that range is the `*` reset) | `:20`; `:223-227` |
| IMP-111 | `PaperList.tsx:34` for the destructure | `:32` |
| IMP-031 | `CONTRIBUTING.md:2-4` for the install/test steps | `:8` and `:10` |
| IMP-134 | `deploy.yml:64` for `actions/deploy-pages` (`:64` is `id:`) | `:65` |
| IMP-090 | "43 tracked files" | "38 at baseline `1c075b3`" |
| IMP-117 | "expect 16 tests" | "15 tests (14 pre-existing + 1 new)" |
| IMP-135 | "expect 12 tests" | "11 tests (10 pre-existing + 1 new)" |
| IMP-083 | "expect 12 tests" | "13 tests (10 pre-existing + 3 new)" |
| IMP-122 | `reset()` at `:202` | `:200` (`CollectionsView.tsx`) |
| IMP-094 | fixture under `tests/fixtures/` | `web/src/lib/__tests__/fixtures/` — `tests/` is outside the `web/` package and vitest cannot import it |
| IMP-046 | `--out-dir /dev/null/nope` (unwritable for a different reason than claimed) | `chmod 555 /tmp/rpf-ro` scratch dir |
| IMP-086 / IMP-093 | installing into the shared `/tmp/rpf-venv` | dedicated throwaway venvs |
| IMP-082 | `print(arxiv.__version__)` — **crashes**, arxiv exposes no `__version__` | `importlib.metadata.version("arxiv")` |

Two `Profile`-vs-`FEATURES` line disagreements were resolved in the backlog's favour by
re-reading the file: the profile cites `readme.md:30` for the "only the week shards it needs"
claim, but that string is at `readme.md:22` (IMP-116 was right); the profile cites
`styles.css:9, 7, 214` for the contrast tokens and IMP-012/IMP-013 were the ones that were off.

### Verification commands audited against the profile's verified list

`/usr/local/bin/python3.11 -m unittest discover -s tests -v`, `cd web && npm run typecheck
&& npm test && npm run build`, `npm run preview`, `npm run dev -- --port 5199 --strictPort`,
and `/tmp/rpf-venv/bin/python scripts/build_index.py …` all appear in profile §3 and are used
correctly. `npm run lint` appears 8 times and **every** occurrence is either the baseline
"does not exist" statement or scoped to IMP-137/IMP-138, which are the items that create it.
No item names a command that does not exist.

---

## 2. Duplicates and overlap removed

Three items were folded into survivors that fix the same root cause at the same site. **No
surviving item was renumbered**; IDs 47, 48 and 57 are now unused, and the three survivors
say in their Intent and Notes which item they absorbed.

- **IMP-047** (`--category` validation) + **IMP-048** (`--max-papers` validation) → **IMP-022**,
  retitled "Validate every CLI flag in both scripts". All three were the same root cause: zero
  CLI argument validation, fixed at `parse_args`. IMP-048 lived in `paper-collector.py`; its
  criterion is now criterion 3 of IMP-022 with a note that the `1000` default and flag name are
  frozen by profile §6.
- **IMP-057** ("All" category chip) → **IMP-010**, retitled "Make the category selection
  reversible and representable". IMP-010's "no reset control when the selection is empty" and
  IMP-057's "All categories is not representable and there is no way back" are the same
  dead-end. IMP-057's `writeHash`-omits-`cat=` criterion was kept; only IMP-057's "one path out of
  the empty state" criterion was dropped as duplicate.

De-duplication without deletion (same lines, adjacent cause): **IMP-002**'s criterion 2 asserted
`safe_filename("..") != ".."`, which is IMP-023's job — replaced with a call-site assertion and
an explicit "the `safe_filename` cases belong to IMP-023 and are not duplicated here".

---

## 3. Acceptance criteria sharpened

39 items rewritten from checkable-in-principle to checkable-in-fact. The changes that matter
most, because a verifier with no context could previously have "passed" them:

- **IMP-012 / IMP-013** (contrast): now require the six computed ratios (three surfaces ×
  light/dark) to be listed in the PR body as sRGB relative-luminance numbers, not eyeballed.
- **IMP-018** (error boundary): names the class component, the `componentDidCatch` signature,
  the `window.location.reload()` button, and — critically — that the boundary must **render**
  the error, not suppress it. Testability is now conditional on IMP-005 and the item says which
  of the two paths applies.
- **IMP-069** (BibTeX): `buildBibTeX` must be a pure exported helper over exactly five named
  fields, with the citation key being the bare arXiv id and a brace-balance assertion; the
  clipboard fallback is now specified (off-screen textarea + `execCommand('copy')`) rather than
  "a documented fallback".
- **IMP-024** (`tarfile` filter): replaced the hand-waved version guard with
  `"filter" in inspect.signature(tarfile.TarFile.extractall).parameters` — `filter` landed in
  3.12 *and* 3.11.4, so a `sys.version_info` check as originally written would be wrong on the
  provisioned 3.11.
- **IMP-074** (headings): rewritten as DOM queries — `querySelectorAll('h3').length === 0` in the
  feed, `querySelectorAll('h1').length === 1` in both views.
- **IMP-098** (validation): "drops (or rejects)" → **drops**, never rewrites, because a
  defaulted `[]`/`""` would render a silently wrong card rather than a visible gap.
- **IMP-066**, **IMP-096**, **IMP-098**, **IMP-100**: each previously offered "X or Y" as
  alternatives; each now picks one and requires the other to be stated in the PR body.
- **IMP-026**: the "deliberately broken `vite.config.ts`" check now specifies pushing a scratch
  branch and confirming the job fails **at the build step, not at typecheck** — the only thing
  that proves the new step is not a no-op.
- **IMP-129/130/131/132, IMP-037, IMP-083, IMP-084, IMP-117, IMP-135**: test counts made exact
  against the verified baselines (14 / 10 / 12), so a verifier can count.
- **IMP-144** (new): "no `'0/0'` flash" was made two concrete DOM conditions.

---

## 4. Ordering and scoring

**Two scores were arithmetically impossible and are corrected.** The formula is
`impact × confidence ÷ effort` with `S=1, M=2, L=3` and impact/confidence capped at 5, so the
ceiling for any `M` item is `25/2 = 12.5`:

- **IMP-006** claimed **25.0 at effort `M`** → corrected to **12.5** and moved from Tier 25.0 to
  Tier 12.5. The item's substance is untouched; only the placement and the arithmetic changed,
  and its Intent now records the correction.
- **IMP-041** claimed **16.0 at effort `M`** (`4 × 5 ÷ 2` cannot be 16) → re-examined: the
  change is two `run:` lines in one YAML file, so the effort is honestly `S`. Re-scored to
  **`4 × 5 ÷ 1 = 20.0`** and moved out of its own single-item "Tier 16.0" into Tier 20.0. The
  old 16.0 is not recoverable under any (impact, confidence, effort) combination with S/M/L
  effort, so this is a genuine re-score rather than a reshuffle.

A programmatic audit now confirms, for all 147 items: **no score exceeds `25 ÷ effort`**, the
file is **monotonically non-increasing in score**, and **every declared dependency appears
strictly above its dependent** with no dependency pointing at a deleted ID.

**Dependencies repaired (5 were wrong or missing):**

| Item | Was | Now | Why |
| --- | --- | --- | --- |
| IMP-008 | `none` | IMP-143 | its criterion pointed at a `urlState` test suite that **no item created** |
| IMP-010 | `none` | IMP-143 | its new criterion 4 tests `writeHash` |
| IMP-051 | IMP-048 | IMP-022 | IMP-048 was merged away |
| IMP-084 | `none` | IMP-058 | it is the regression lock for IMP-058 |
| IMP-133 | IMP-103 | IMP-143 | IMP-103 is a *Python* test item; the dependency is the hash parser |

**Fourteen dangling cross-references fixed**, all of which pointed an implementer at the wrong
item: IMP-005 named IMP-060/061/062/063 as its component-test dependents (they are version
validation, debounce, replaceState and memoization — the real dependents are IMP-129/130/131/132);
IMP-033 pointed at IMP-037 for the removed download APIs (IMP-093); IMP-041 at IMP-054 for lint
tooling (IMP-137); IMP-026 at IMP-042 (IMP-137); IMP-050 and IMP-078 at IMP-037 (IMP-093);
IMP-044 at IMP-052 for the determinism check (IMP-080); IMP-018 at IMP-096 for runtime
validation (IMP-098); IMP-101 at IMP-107 for the count (IMP-067/IMP-108); IMP-110 at IMP-011 for
the loading region (IMP-067); IMP-113 at IMP-036 for a `lint` script (IMP-137); IMP-119 at IMP-137
for the full abstract (IMP-139); IMP-091 at IMP-093 for the contract test (IMP-094); IMP-132 at
IMP-103's "extraction" that never existed (IMP-143). The Contents dependency map was rewritten
from the actual `Depends on` fields.

**The genuine top of the list is now correct.** Tier 25.0 is: security (`javascript:` URL
injection in imported exports — IMP-001), path traversal (`--topic` into output paths — IMP-002),
data loss (`localStorage` two-key write — IMP-006), silently-wrong-output (a partially-failed
index publishing a fresh `generatedAt` — IMP-004), blocking correctness (memoized rejected
promise — IMP-003), tooling that gates everything (component tests — IMP-005), and the untestable
URL contract that gates three other items (IMP-143).

**The duplicated `## Contents` section is gone.** The file shipped two of them with *different*
tier boundaries, which is how a reader could end up looking for an item in the wrong tier. It is
replaced by one table that states the arithmetic for each tier and an explicit NEEDS-HUMAN list.

---

## 5. NEEDS-HUMAN (7)

Marked, not left as `TODO`. Each has the decision to make stated in Notes.

| Item | Decision required |
| --- | --- |
| **IMP-027** | Daily vs weekly deploy. `0 6 * * 0` costs ~1/7 the Actions minutes; daily means ~5× the arXiv request volume against their terms of use (10 s/page). The two-line doc fix can proceed now; the cadence cannot. |
| **IMP-034** | Delete the notebook or rewrite it as a wrapper. Its own criteria offer both, so the item is unanswerable as written — and it blocks IMP-035/036/077/078/079, each of which says "mark not-applicable if deleted". |
| **IMP-088** | Policy. Criterion 2 is self-defeating: the five advisories are the documented baseline (PE-1), so `--audit-level=high` fails on day one and guards nothing, while carving out an exception to a security gate is an org decision. |
| **IMP-096** | Criterion 2 explicitly asks the implementer to choose crawlable vs `disallow: /`. Publishing policy. The `404.html` half is independent and can be split out. |
| **IMP-125** | Pin the date locale or leave it visitor-dependent. Pinning to `en-US` visibly changes the UI for every non-US reader. |
| **IMP-141** | Subjective layout overhaul in a width band never reviewed. The de-facto viewports are 1280 and 390 with one breakpoint at 520px — there is no baseline to improve against. |
| **IMP-142** | Its own Notes call it "honestly speculative about whether anyone prints this". |

---

## 6. Added (8)

All are real defects present in the profile's §9 inventory that no item represented. None
duplicates an existing item, and none touches a do-not-touch path.

- **IMP-143** — `readHash`/`writeHash` are module-private (`App.tsx:38,61`), so the entire URL
  contract is untestable. Profile WEB-37. **Added because three items (IMP-008, IMP-132,
  IMP-133) referenced a `urlState` test suite that did not exist** — the backlog was internally
  inconsistent without it. Also removes the highest-risk untested surface in the app.
- **IMP-144** — `progress` is never reset (`App.tsx:145,173`), so a recency change renders the
  *previous* window's totals, and the `0/0` flash is reachable because `loadPapers` returns at
  `paperIndex.ts:140-142` before any `onProgress` call. Profile WEB-06. **This is
  silently-wrong-output class** — the reason it scores 15.0 rather than sitting lower with the
  other cosmetics.
- **IMP-145** — `await file.text()` at `CollectionsView.tsx:171` is unbounded; a multi-GB file
  freezes the tab with no error. Profile WEB-29.
- **IMP-146** — `URL.revokeObjectURL` fires synchronously after `anchor.click()`
  (`App.tsx:303-305`), which can cancel the download in Firefox — silent data loss on a
  documented feature. Profile WEB-30. Not represented anywhere.
- **IMP-147** — `df["Col"][i]` in a loop (`paper-collector.py:108-118`), deprecated in pandas 3,
  which `requirements.txt:2` permits today. Profile PY-37. **Paired with IMP-118, which edits
  the same lines**, and cross-referenced so the HTML is only re-baselined once.
- **IMP-148** — the three empty states (`PaperList.tsx:36`, `CollectionsView.tsx:127,235`) have
  no `role="status"`, so loading→empty is unannounced even though the loading states *do*
  announce. Profile WEB-61.
- **IMP-150** — `deploy.yml:31` installs `pandas` on every deploy for a script that never
  imports it. Profile INF-07.
- **IMP-149** — the search field's only visible affordance is a 63-character placeholder that is
  visually truncated at 390px, with an `sr-only` label. Profile WEB-63. **Premise corrected**:
  the field is `type="search"`, so the item first requires reconciling with the native clear
  affordance.

### Defects deliberately **not** added

Recorded so a later pass does not re-litigate them. These are absent from §9 or fail the
"no cosmetic/speculative rewrites" bar: WEB-31's undo-for-delete and WEB-33's canonical-URL
halves (both fold into existing items' scope or are URL-policy decisions already covered by
IMP-143/IMP-010), WEB-35 (`#collection=<id>` deep links — a feature, not a defect, and the same
shape as IMP-133), WEB-44 (`CollectionSection` memoisation — fully subsumed by IMP-064),
WEB-60 (`forced-colors`), WEB-65/66/67 (spacing scale, elevation semantics — subjective design
overhaul), WEB-72 (self-hosting fonts — needs a network asset fetch and a decision), INF-16 and
INF-19/20 (docs/changelog/process — become moot or are noise), NB-5/NB-6 (notebook defects that
IMP-034 already decides the fate of), PY-20 (`sys.path` mutation — IMP-049's note explicitly
forbids restructuring the import path), PY-25 (`KeyboardInterrupt` — already neutralised by
IMP-021 plus IMP-099), PY-38 (unrendered CSV columns — the CSV is an explicit user-requested
export format), PY-39 (subsumed by IMP-093 criterion 2).

---

## 7. Compliance

- Every surviving item keeps its original ID. No renumbering. IDs 47/48/57 are retired by
  merge; 143–150 are new.
- The 12-field format is intact on all 147 items (verified programmatically: field presence,
  field order, and at least one numbered acceptance criterion each).
- No do-not-touch path is proposed. `web/package-lock.json` is still limited to IMP-005 and
  IMP-137, both via `npm install`, and the header now says so. `readme.md` stays lowercase.
  `scripts/paper-collector.py` is never renamed; its six documented flags keep their names,
  defaults, and behavior, and IMP-022 and IMP-048's successor say so explicitly.
- No mass reformat, no cosmetic rename, no speculative rewrite is proposed. Two new
  dependencies-heavy items (IMP-005, IMP-137) state their dependency cost, and IMP-137 keeps
  the profile's ban on adding Prettier.
- File written via targeted `edit`/`python` replacements only — no whole-file write.