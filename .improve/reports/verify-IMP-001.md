# Verification report — IMP-001

**Item:** IMP-001 — Reject non-`http(s)` URLs in imported collection papers
**Verifier:** independent, skeptical. Did not write any of the code under review.
**Base commit:** `fc77a40 chore(improve): initial improvement backlog (147 items) [IMP-001]`
**Verdict:** **PASS** — 4/4 acceptance criteria met. Three non-blocking observations logged below.

---

## 0. What is actually in the working tree

```
$ git status --porcelain
 M .improve/FEATURES.md
 M web/src/components/PaperCard.tsx
 M web/src/lib/__tests__/collections.test.ts
 M web/src/lib/collections.ts
?? .improve/reports/discovered-IMP-001.md
?? .improve/reports/impl-IMP-001.md

$ git diff --stat
 .improve/FEATURES.md                      |  2 +-
 web/src/components/PaperCard.tsx          | 45 ++++++++++++++++++++++++++++++---------
 web/src/lib/__tests__/collections.test.ts | 47 +++++++++++++++++++++++++++++++
 web/src/lib/collections.ts                | 17 ++++++++++-
 4 files changed, 96 insertions(+), 15 deletions(-)
```

Untracked files the implementer added: exactly two markdown reports. Nothing else. No binaries in
the tree — `.improve/artifacts/` is excluded by `.git/info/exclude:31` (`.improve/artifacts/`), so
the 3 PNGs they produced do not dirty `git status`, exactly as claimed.

`FEATURES.md` is a single-line `TODO → IN-PROGRESS` flip, which the implementer attributes to the
orchestrator. It is loop bookkeeping, not source, and it is consistent with the item being in flight.

### Scope-creep / hygiene scan

| Check | Result |
| --- | --- |
| `console.*`, `TODO`, `FIXME`, `XXX`, `HACK`, `debugger`, `@ts-ignore`, `eslint-disable`, `.only(`, `.skip(` in the 3 changed source files | **none** |
| Commented-out code (`^\s*//\s*(const\|let\|if\|return\|href\|expect\|import)`) | **none** |
| `style=` prop anywhere in `web/src` | **none** (§5.3 forbids it) |
| `export default` anywhere in `web/src` | **none** (§5.3 named-exports-only) |
| Secrets (`api_key\|secret\|token\|password\|BEGIN …PRIVATE`) | **none** |
| Unrelated files modified | **none** |
| `web/package.json` / `package-lock.json` / `vite.config.ts` touched | **no** — so the lockfile do-not-touch rule (profile §6) is respected and IMP-005's scope is untouched |
| Python / `scripts/` / `tests/` touched | **no** |
| `isPaper` (`collections.ts:51-62`) widened | **no** — deliberately left alone, as criterion 1 and WEB-20 both reference it as the "does not require them" baseline |
| `Paper.absUrl`/`Paper.pdfUrl` widened | **no** — `types.ts:11-12` unchanged, as criterion 3 requires (IMP-019's scope) |
| New modules / moved files | **none** — profile §6 forbids restructuring as a side effect |

Conventions (§5.3) spot-checked and satisfied: `safeHref` is a module-private helper placed with
`formatDate` before the component (matches the documented `PaperCard.tsx` layout); the props
interface is still not exported; the new tests reuse the file's existing `makePaper` helper
(`collections.test.ts:15`) rather than inventing a new fixture; the test file still mirrors its
module 1:1 (no new test file). The two added doc comments are rationale-explaining, matching the
sparsely-commented style of the surrounding file (`prunePapers`, `loadState`, `saveState` all carry
one-liners). No mass reformat — untouched lines are byte-identical.

---

## 1. Acceptance criteria, one at a time

### Criterion 1 — `parseExportPayload` drops non-http(s) urls; empty result still returns `papers: []`

**Implementation** (`web/src/lib/collections.ts:64-77`, `:232`):

```ts
export function isHttpUrl(value: unknown): boolean {
  return /^https?:\/\//i.test(String(value).trim());
}

function hasSafeUrls(value: Paper): boolean {
  const paper = value as Partial<Paper>;
  return [paper.absUrl, paper.pdfUrl].every(
    (url) => url === undefined || isHttpUrl(url),
  );
}
```
```ts
const papers = candidate.papers.filter(isPaper).filter(hasSafeUrls);
```

`/i` + `String(...).trim()` is literally criterion 1's wording. `url === undefined` keeps absent
urls; `null`/`""`/non-strings fall through to `isHttpUrl`, which rejects them — "present and not
http(s)" ⇒ dropped. The filter is the last step of the same expression, so the pre-existing return
with `papers: []` at `:233-241` is untouched.

I exercised the real module directly (copied verbatim to scratch, run under
`node --experimental-strip-types`) rather than trusting the code read:

```
--- absUrl probe (expected -> actual) ---
"javascript:alert(1)"                  -> DROPPED
"JaVaScRiPt:alert(1)"                  -> DROPPED
"  javascript:alert(1)  "              -> DROPPED
"java\tscript:alert(1)"                -> DROPPED
"java\nscript:alert(1)"                -> DROPPED
"jav\rascript:alert(1)"                -> DROPPED
"\u0000javascript:alert(1)"            -> DROPPED
"data:text/html,<script>x</script>"    -> DROPPED
"vbscript:msgbox(1)"                   -> DROPPED
"file:///etc/passwd"                   -> DROPPED
"blob:https://x/y"                     -> DROPPED
"httpx://evil"                         -> DROPPED
"http:/x"                              -> DROPPED
"https:/x"                             -> DROPPED
"https//x"                             -> DROPPED
"xhttps://x"                           -> DROPPED
null                                   -> DROPPED
123 / true / {} / []                   -> DROPPED
["https://evil"]                       -> KEPT   <-- see OBS-1
<absent>                               -> KEPT
"https://arxiv.org/abs/1"              -> KEPT
"HTTPS://ARXIV.ORG/abs/1"              -> KEPT
"Http://x"                             -> KEPT
"  https://x  "                        -> KEPT
"http://x"                             -> KEPT
"https://\njavascript:alert(1)"        -> KEPT   <-- see below, SAFE

empty-after-filter payload (criterion 1):
returned (not null): true   papers: []
```

The `"https://\njavascript:alert(1)"` case is worth spelling out because it is the one vector where
the browser and the regex disagree: the WHATWG URL parser strips TAB/LF/CR from the whole URL, so
this becomes `http://javascript:alert(1)`, whose **scheme is `http`** and therefore not executable.
Any value that passes the guard keeps an `http`/`https` scheme token that contains no strippable
characters, so no accepted value can be reinterpreted as `javascript:`. The prefix check is sound.

**MET.**

### Criterion 2 — new tests assert rejection with siblings kept, and separately that an https url is kept

`web/src/lib/__tests__/collections.test.ts:251-296`. Two `it` blocks appended inside the existing
`describe("parseExportPayload")`. Both required assertions are present:
`absUrl: "javascript:alert(1)"` rejected while `"2401.00001"`/`"2401.12345"` survive (`:264-271`),
and `absUrl: "https://arxiv.org/abs/2401.12345"` kept (`:280-296`). The implementer additionally
covers `pdfUrl` and the all-bad-payload → `papers: []` case, both in-scope extensions of criterion 1.

**Would these fail if the fix were reverted?** I proved it empirically rather than by inspection.
I extracted the pre-change module with `git show HEAD:web/src/lib/collections.ts` into a scratch
directory (read-only git; no repo file touched) and replayed both new test cases' assertions
against it and against the working-tree module:

```
=========== PRE-CHANGE (HEAD) — simulating the revert ===========
ids kept: ["A-plain-js","B-case-space-js","C-tab-js","D-data-uri","E-vbscript","F-httpx",
           "G-pdf-only-js","H-no-urls","I-null-abs","J-valid-control","K-leading-space-valid"]
TEST 1 assertion (ids === 2 survivors): FAIL -> got ["2401.00001","2401.12345","2401.99999","2401.88888"]
TEST 1 assertion (all-bad -> papers: []): FAIL
TEST 2 assertion (https kept):          PASS

=========== POST-CHANGE (working tree) ===========
ids kept: ["H-no-urls","J-valid-control","K-leading-space-valid"]
TEST 1 assertion (ids === 2 survivors): PASS
TEST 1 assertion (all-bad -> papers: []): PASS
TEST 2 assertion (https kept):          PASS
```

Test 1 is a genuine regression guard — both of its assertions flip on revert. Test 2 passes either
way by design: it is the *positive control* criterion 2 explicitly mandates (it guards against
over-filtering, i.e. a `isHttpUrl` that rejects everything). It is not vacuous in intent, but it is
not itself a revert guard, and no test in this change guards the `PaperCard` render path (see OBS-3).

**MET.**

### Criterion 3 — none of the four `href={…}` sites can emit a non-http(s) href

`web/src/components/PaperCard.tsx`. All four sites in the whole app that consume a paper url are
guarded; `rg -n 'href=' web/src` returns only these four plus `App.tsx:316` (`href="#main"`) and
`App.tsx:446` (`href="https://arxiv.org/"`), neither of which touches a paper url.

| Site | Line | Guard |
| --- | --- | --- |
| title | `:64-70` | `{absHref ? <a …> : <span>}` — no anchor at all |
| truncation note | `:102-108` | same ternary, plain-text fallback |
| footer arXiv | `:115-119` | `{absHref && <a …>}` |
| footer PDF | `:120-124` | `{pdfHref && <a …>}` |

`safeHref` (`:33-35`) returns `undefined` for anything non-http(s), and `absHref`/`pdfHref` are
computed once per card at `:57-58`. `PaperCardProps` / `Paper["absUrl"]` were **not** widened —
correct, that is IMP-019's scope.

**Accepted deviation (criterion 3 says "a validated `https://` string"; the code validates
http(s)).** I verified the implementer's justification independently rather than taking it on
trust — every paper in the live index uses `http://` for `absUrl`:

```
$ /usr/local/bin/python3.11 -c "...count url schemes over web/public/data/papers-*.json..."
Counter({'http': 2812, 'PDF:https': 2812})
$ (sample)
2610.02210 | http://arxiv.org/abs/2610.02210v1 | https://arxiv.org/pdf/2610.02210v1
```

`build_index.py:111` takes `absUrl` verbatim from `arxiv.Result.entry_id`, which the arXiv API
returns over plaintext http. A literal https-only check would delete the link from all 2,812 live
feed cards. Reading "validated `https://`" as "validated http(s)" is the only correct reading, and
criterion 1 itself says `https://` **or** `http://`. The implementer logged this as D-1 in
`.improve/reports/discovered-IMP-001.md`. **This is a correct deviation, not a defect.**

Live DOM check on the real feed (50 cards, 202 anchors):

```
cardCount: 50            anchorCount: 202
nonHttpHashHrefs: []     titleTagNames: ["A"]   (no span fallbacks)
firstCardAnchors: ["http://arxiv.org/abs/2610.00848v1", …×3, "https://arxiv.org/pdf/2610.00848v1"]
paperLinksEmptyCount: 0  spansWithNoAnchor: 0
```

Zero behaviour change for well-formed data. **MET.**

### Criterion 4 — `typecheck` and `test` pass; no weakened expectation; 15–16 collections tests

```
$ cd web && npm run typecheck
> tsc --noEmit
TYPECHECK_EXIT=0                      (no output, exit 0)

$ cd web && npm test
 ✓ src/lib/__tests__/collections.test.ts (16 tests) 7ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/paperIndex.test.ts (10 tests) 9ms
 Test Files  3 passed (3)
      Tests  38 passed (38)
```

`16` is inside the spec's 15–16 window. The diff to the test file is **purely additive** — 47
inserted lines, 0 deleted (confirmed via `git diff --numstat`), so no pre-existing expectation was
weakened, edited, or deleted. `git diff` on the test file shows one `@@ -248,6 +248,53 @@` hunk
with no `-` lines.

`npm run build` (required by profile §4.1/§4.2, not by the spec):

```
$ cd web && npm run build
> tsc --noEmit && vite build
✓ 38 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-Dwi-Ybsy.js   163.45 kB │ gzip: 52.53 kB
✓ built in 387ms
```

Baseline (profile §3.3) is JS 163.17 kB / gzip 52.40, CSS 10.93 / 2.86. Delta **+0.28 kB raw /
+0.13 kB gzip** for the predicate, CSS byte-identical. No bundle regression.

**MET.**

---

## 2. Verification method from the spec (executed end to end)

Spec method: `npm run typecheck && npm test`; then
`npm run dev -- --port 5199 --strictPort`, open
`http://localhost:5199/research-paper-feed/#view=collections`, import a hand-written JSON whose one
paper has `"absUrl": "javascript:alert(1)"` and whose sibling has
`"absUrl": "https://arxiv.org/abs/2401.12345"`, and confirm (a) the malicious paper is absent,
(b) the valid sibling is present, (c) no href starts with `javascript:`.

I did **not** reuse the implementer's fixture. I authored an independent 11-paper adversarial
payload at `/var/folders/…/kilo/verify-imp001-adversarial.json`: plain `javascript:`, mixed-case +
surrounding-space `JaVaScRiPt:`, tab-split `java\tscript:`, `data:text/html,<script>`,
`vbscript:`, `httpx://` near-miss, `javascript:` in `pdfUrl` only (valid `absUrl` — proves the
filter is not `absUrl`-only), a paper with **no urls at all** (criterion 1 says keep), `absUrl: null`,
an https control, and an `http://` control wrapped in leading/trailing spaces.

```
$ npm run dev -- --port 5199 --strictPort     # backgrounded, served at /research-paper-feed/
# cleared localStorage, clicked Import collection, uploaded the payload
```

**Result — collection header read `VERIFY adversarial (3)`:**

| # | Paper | Payload url | Outcome | Correct? |
| --- | --- | --- | --- | --- |
| A | plain js | `javascript:alert('A')` | **dropped** | ✅ |
| B | case+space js | `  JaVaScRiPt:alert('B')  ` | **dropped** | ✅ |
| C | tab-split js | `java\tscript:alert('C')` | **dropped** | ✅ |
| D | data uri | `data:text/html,<script>…` | **dropped** | ✅ |
| E | vbscript | `vbscript:msgbox('E')` | **dropped** | ✅ |
| F | near miss | `httpx://evil.example/adv-f` | **dropped** | ✅ |
| G | pdf-only js | valid `absUrl`, `javascript:` `pdfUrl` | **dropped** | ✅ (both fields filtered) |
| H | no urls | absent | **kept**, 0 anchors | ✅ (criterion 1) |
| I | null abs | `null` | **dropped** | ✅ |
| J | https control | `https://arxiv.org/abs/2401.12345` | **kept**, 4 anchors | ✅ |
| K | http + spaces | `   http://arxiv.org/abs/2401.99999   ` | **kept**, href trimmed to `http://arxiv.org/abs/2401.99999` | ✅ |

(a) malicious papers absent ✅  (b) valid siblings present ✅
(c) spec's exact assertion, evaluated in-page:

```js
[...document.querySelectorAll('a')].map(a => a.getAttribute('href'))
// ["#main","https://arxiv.org/abs/2401.12345","https://arxiv.org/abs/2401.12345",
//  "https://arxiv.org/abs/2401.12345","https://arxiv.org/pdf/2401.12345",
//  "http://arxiv.org/abs/2401.99999","http://arxiv.org/abs/2401.99999",
//  "https://arxiv.org/pdf/2401.99999","https://arxiv.org/"]
everyHrefIsHttpOrHash: true
nonHttpHashHrefs: []
anyHrefNullAttr: false
```

Storage confirms nothing hostile persisted — no dangling reference either, because
`mergeImport`'s `id in papers` filter (`collections.ts:129`) drops the removed ids:

```
persistedPaperIds: ["H-no-urls","J-valid-control","K-leading-space-valid"]
collectionPaperIds: [["H-no-urls","J-valid-control","K-leading-space-valid"]]
```

### Render-path guard for snapshots that predate the fix (criterion 3, adversarial)

I seeded `localStorage` directly, bypassing the import path entirely, with three pre-fix-style
papers (`javascript:`, `java\tscript:`, `data:text/html,<script>`) and hard-reloaded:

```
hrefs: ["#main","https://arxiv.org/pdf/x","https://arxiv.org/pdf/y","https://arxiv.org/"]
specAssertion_c: true
anchorsWithNoHrefAttr: 0
anyAnchorHrefAttrPresentButNull: false
paperTitleTagNames: ["SPAN","SPAN","SPAN"]
paperLinksInner: ["", "<a href=\"https://arxiv.org/pdf/x\" …>PDF</a>", …]
```

Every one of the three stale cards rendered **zero anchors** for the hostile field, the valid
`pdfUrl` anchors still rendered, `.paper__links` was empty-but-present with no visual artefact, and
there is no `href=""` anywhere. React renders no anchor rather than `href={null}`, exactly as
criterion 3 requires.

### Regression pass + console

Real-data feed at 1280px: 50 cards, 202 anchors, all `http(s)://` or `#`, all titles still `<a>`,
zero `.paper__links` empty, visually identical to `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`.

```
console: [DEBUG] [vite] connecting...
         [INFO]  %cDownload the React DevTools for a better development experience…
         [DEBUG] [vite] connected.
```

**Zero `console.error`, zero failed requests** — matches the documented dev-server baseline in
profile §4.2. (Two `ERR_CONNECTION_REFUSED` entries appear only *after* I stopped the dev server
during teardown; they are an artifact of my shutdown, not a regression. The clean console was
captured before shutdown.)

### Teardown

`localStorage` cleared (`remaining: 0`), browser closed, dev server stopped, and the
`.playwright-mcp/` directory the screenshot tool leaves behind removed. Final `git status --porcelain`
shows only the 3 source files, the orchestrator's `FEATURES.md` line, and the 2 implementer reports.
I modified no source file; no `git` write command was run.

---

## 3. Python side

The change is TypeScript-only and touches nothing in `scripts/` or `tests/`, so §4.3 was not
required by the item. I ran the suite anyway as a cross-stack safety check:

```
$ /usr/local/bin/python3.11 -m unittest discover -s tests
.................ERROR:root:No papers fetched; refusing to write an empty index.
.INFO:root:Wrote 2 papers across 1 shards to /var/folders/…/tmp0utg5xzj
.........
Ran 27 tests in 0.006s
OK
```

27 tests, OK, exit 0. The `ERROR:root:` line is an expected log from the "refuse to write an empty
index" test (profile §3.4), not a failure. **Python untouched and green.**

---

## 4. Observations — non-blocking, none of them a criterion failure

**OBS-1 — `isHttpUrl` type-confusion on an array `absUrl` (low).** `String(["https://evil"])` is
`"https://evil"`, so an `absUrl` that is a JSON *array* is **kept** rather than dropped, and is
persisted to `localStorage` as an array. It is not exploitable — the rendered href is the
stringified `https://evil`, still http(s), and the spec's stated threat (`javascript:`) is unaffected.
It is a strict deviation from criterion 1's "present and does not begin with `https://`", but only
for a malformed non-string that no real export contains. Tightening to
`typeof value === "string" && /^https?:\/\//i.test(value.trim())` would close it. Not worth a
follow-up item on its own; worth folding into whichever item widens `Paper["absUrl"]` (IMP-019),
where a `typeof` narrowing becomes natural anyway.

**OBS-2 — `loadState` deliberately does not scrub (correctly out of scope).** Papers already in
`localStorage` from before this fix keep their hostile urls in storage. The implementer chose not
to filter on load, reasoning that silently deleting a user's saved papers is worse than a dead
link, and that criterion 3's render guard makes them inert. I verified the render guard does make
them inert (§2 above), so this is a defensible scope decision, and criterion 1 scopes the filter to
`parseExportPayload` only. Correctly flagged in the report's Uncertainties. If a reviewer wants
storage scrubbed too, that is a new item, not a correction to this one.

**OBS-3 — the `PaperCard` render path has no automated test (structural, pre-existing).**
`vite.config.ts:8-9` sets `environment: "node"` and `include: ["src/**/*.test.ts"]` (which does not
match `.tsx`), and no jsdom/`@testing-library/react` is installed — profile PE-13. Criterion 3 is
therefore verified by `tsc --noEmit` plus the browser pass above, not by a test. Correct per the
profile; IMP-005 is the item that makes it testable. Not attributable to this change.

**ADJACENT BUG (pre-existing, NOT introduced here, NOT part of IMP-001's criteria) — worth a new
backlog item.** While trying to break the filter I found a different, more severe hostile-import
vector that survives this change: a paper whose `id` is `"__proto__"`.

`mergeImport` skips writing it (`if (!papers[paper.id])` — `Object.prototype` is truthy, so
`papers["__proto__"]` is never assigned), but the dangling-reference filter uses `in`, which walks
the prototype chain, so `"__proto__" in papers` is **true** and the id is kept in `collection.paperIds`.
`state.papers["__proto__"]` then resolves to `Object.prototype`, which `CollectionsView` hands to
`PaperCard`, where `paper.abstract.length` (`PaperCard.tsx:56`) throws. There is no error boundary,
so one crafted import file permanently blanks the collections view for that user.

```
parseExportPayload kept: ["__proto__","ok1"]
collection.paperIds: ["__proto__","ok1"]
resolved: [{ isRealPaper: false, hasTitle: undefined }, { isRealPaper: true, hasTitle: 'ok' }]
PaperCard.tsx:56 WOULD THROW -> TypeError: Cannot read properties of undefined (reading 'length')
```

I ran the identical probe against `git show HEAD:web/src/lib/collections.ts` and got **byte-identical
output**, confirming it is pre-existing and neither introduced nor worsened by IMP-001. Same threat
model as IMP-001 (a file someone sends you) and arguably higher impact, so it deserves its own item —
`Object.hasOwn(papers, id)` instead of `id in papers` at `collections.ts:129` and `:283`, plus a
`Number(paper.id) === 0`/type guard. I am reporting it, not fixing it: IMP-001's four criteria are
explicit and bounded, and touching `mergeImport` here would be scope creep.

---

## 5. Implementer report accuracy

Every claim I spot-checked in `.improve/reports/impl-IMP-001.md` held up:

- typecheck exit 0 no output ✅ · `3 files, 38 tests` ✅ · 16/12/10 split ✅
- build 38 modules, CSS 10.93/gzip 2.86 unchanged, JS 163.45/52.53 vs 163.17/52.40 ✅
- "50 cards, 4 anchors in the first card, every href `http(s)://` or `#`" ✅ (I measured 50 / 202 / 0 non-http)
- console clean apart from the documented dev-server baseline ✅
- the dropped id is filtered by `mergeImport`'s `id in papers`, so no dangling reference ✅
- `rg 'absUrl|pdfUrl' web/src` shows only `PaperCard.tsx` and type/test files ✅
- D-1's `http://` claim ✅ (independently counted: 2,812/2,812 `http`)
- D-2's Playwright path-mangling claim ✅ — reproduced exactly; the leading `.` is stripped and the
  path is flattened into `.playwright-mcp/`. The implementer cleaned theirs up; I cleaned up mine.
- localStorage cleared afterwards ✅ (mine too)

Two report statements I want to correct for the record, neither material:
1. The claim that `String(value)` "could throw for a `Symbol`" is wrong — `String(sym)` returns
   `"Symbol()"`; it is a *template literal* that throws on a Symbol. Irrelevant here, since the only
   caller is `JSON.parse`.
2. Test 2 ("keeps an https paper url") does pass on the pre-change code. It is the positive control
   criterion 2 mandates, not a revert guard — so criterion 2's "asserts rejection" half rests
   entirely on test 1, which I confirmed does fail on revert.

---

## 6. Artifacts

`.improve/artifacts/IMP-001/` (additions from this verification, prefixed `verify-`):

- `verify-adversarial-import-desktop-1280.png` — 11-paper hostile import, 1280px, `(3)` survivors
- `verify-adversarial-import-mobile-390.png` — same state, 390px
- `verify-stale-snapshot-no-anchor-desktop-1280.png` — pre-fix snapshots injected straight into
  `localStorage`: `javascript:` / `java\tscript:` / `data:` cards render zero anchors
- `verify-feed-regression-desktop-1280.png` — real-data feed, 50 cards, no change vs baseline

The implementer's three (`collections-import-javascript-url-desktop-1280.png`,
`…-mobile-390.png`, `collections-stale-snapshot-no-anchor-desktop-1280.png`) were also reviewed;
they corroborate their report.

---

## 7. Verdict

**PASS — 4/4 acceptance criteria met.** All three gates green against a fully green pre-existing
baseline (profile §7: "All four baseline checks are GREEN"), zero new console errors, zero scope
creep, no debug residue, no style violations, and no bundle regression. The tests are real — I
demonstrated the primary one failing on a simulated revert rather than assuming it. Three
non-blocking observations (OBS-1/2/3) and one adjacent pre-existing bug are recorded above; none of
them is a reason to reject this item, and the adjacent bug should be filed separately.
