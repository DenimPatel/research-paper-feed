# IMP-154 — independent verification report

**Item:** IMP-154 — Validate `categories` and `published` in `isPaper` so a malformed export cannot
blank the app (`.improve/FEATURES.md:224-240`).
**Verifier:** independent sub-agent. Did not write the change.
**Branch:** `improve/auto-20261002` · **Reviewer scope:** `git diff -- web/src/lib/collections.ts
web/src/lib/__tests__/collections.test.ts` + new `web/src/__tests__/malformedImport.test.tsx`.
`App.tsx` / `paperIndex.ts` / `paperIndex.test.ts` / `App.retry.test.tsx` (concurrent IMP-007) are
excluded from all verdicts.
**Verdict: PASS** — 5/5 acceptance criteria met, no pre-existing expectation weakened, **0 of 5,519
real producer records rejected**. Six findings below; none is a criterion failure, two are
documentation-accuracy defects and one is a real residual blast radius the item's scope deliberately
excludes.

---

## 1. Criterion-by-criterion

### Criterion 1 — `isPaper` validates every unguarded `PaperCard` field; existing checks unchanged — **MET**

`web/src/lib/collections.ts:82-92`:

```ts
    typeof paper.id === "string" &&
    !PROTOTYPE_KEYS.has(paper.id) &&
    typeof paper.title === "string" &&
    Array.isArray(paper.authors) &&
    typeof paper.abstract === "string" &&
+   Array.isArray(paper.categories) &&
+   paper.categories.every((category) => typeof category === "string") &&
+   typeof paper.primaryCategory === "string" &&
+   typeof paper.published === "string"
```

`git diff --numstat` → `collections.ts | 15 +-` (14 insertions, 1 deletion) and the single deletion is
the trailing `&&`. The four pre-existing checks and the `PROTOTYPE_KEYS` id check (`collections.ts:40`,
`:84`) are byte-identical. `absUrl`/`pdfUrl` deliberately stay out of `isPaper`; `hasSafeUrls`
(`collections.ts:109-114`) still owns them. Verified `PaperCard.tsx`'s unguarded dereferences:
`categories.map` (`:79`), `formatDate(paper.published)` (`:73`), `primaryCategory` (`:82`) — all three
now gated. `authors`/`abstract`/`title` were already gated.

### Criterion 2 — failures dropped silently at import; all-fail payload returns `[]`, never `null` — **MET**

Both the old and new failures go through the identical filter, `collections.ts:270`
`candidate.papers.filter(isPaper).filter(hasSafeUrls)`, so "exactly like today's checks" holds by
construction. `parseExportPayload` returns `null` only for a bad `collection` or a non-array `papers`
(`collections.ts:264-269`); an all-fail payload yields `papers: []`. Confirmed in the committed test
(`collections.test.ts:643-664`) **and independently in the browser**: importing the spec payload
produced a rendered collection header `Malformed spec payload (0)` with `Export` disabled and **no**
error banner (`CollectionsView.tsx:228-232` renders `importError` only when parsing throws).

### Criterion 3 — no real shard record rejected — **MET (with one literal sub-clause not achievable)**

The substantive requirement holds and I re-measured it at roughly 2× the implementer's scope. The
literal instruction *"Assert that count in a test rather than by eye"* is **not** satisfied: the
committed test asserts a 4-record fixture, not 2,812. That is unavoidable in this repo — `public/data`
is gitignored (`web/.gitignore:9 public/data`, confirmed by `git check-ignore -v`), so the shard
cannot be read at test time, and no shard is committed anywhere. See Finding 5 for the alternative
that was not taken and why it is not worth taking here.

### Criterion 4 — three named malformed payloads, each dropped, valid sibling kept in `paperIds` — **MET**

`collections.test.ts:594-611` table-drives exactly the three shapes the criterion names (plus three
more: non-string element, absent `primaryCategory`, numeric `published`); `:612-627` asserts, per
case, `payload.papers.map(id) === [SIBLING]`, `state.collections[0].paperIds === [SIBLING]`, and
`Object.keys(state.papers) === [SIBLING]`. The sibling is `makePaper(SIBLING)`
(`collections.test.ts:17-32`), fully populated with all 11 keys, so the "kept" assertions are real.

### Criterion 5 — `typecheck && test && build` pass, nothing weakened — **MET**

```
cd web && npm run typecheck   → exit 0, no output
cd web && npm test
 Test Files  7 passed (7)
      Tests  92 passed (92)      Duration  1.61s
cd web && npm run build
 ✓ 39 modules transformed.
 dist/index.html                   1.00 kB │ gzip:  0.51 kB
 dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
 dist/assets/index-Y0hD1buQ.js   164.59 kB │ gzip: 52.83 kB
 ✓ built in 365ms
```

92 = 69 baseline + 15 from this item (`collections.test.ts` 25→35, `malformedImport.test.tsx` +5) + 8
from the concurrent IMP-007 agent (`paperIndex.test.ts` 11→14, `App.retry.test.tsx` +5). No failures
anywhere. CSS byte-identical to baseline.

**No existing test weakened, skipped or deleted** — verified three ways:

```
git diff --numstat -- web/src/lib/__tests__/collections.test.ts  →  243  0   (zero deletions)
grep -nE "\.(skip|only|todo)\b|xit\(|xdescribe\(" <both in-scope test files>  →  none found
original it() titles at HEAD (25) vs working tree  →  comm -23 output empty (0 titles missing)
```

The 4 new titles `comm` reports are the only literal-string additions; the other 6 new tests are the
table-driven ones. 25 + 10 = 35. `malformedImport.test.tsx` does **not** import `collections.test.ts`
(it duplicates a `Storage` fake deliberately, `:31-62`) so no `describe` block is double-registered.

---

## 2. The over-validation audit (the real risk) — producer analysis

`scripts/build_index.py:99-116`, `record_from_result`, every field via `getattr`:

| Field | Producer expression | Can it degrade? | New check | Verdict |
|---|---|---|---|---|
| `categories` | `list(getattr(result,"categories",[]) or [])` (`:112`) | no — always an array | `Array.isArray` + all strings | safe |
| `published` | `iso_date(getattr(result,"published",None))` (`:110`) | **yes** → `None` (`:79-82`) | `typeof === "string"` | **stricter than the producer**, see below |
| `primaryCategory` | `getattr(result,"primary_category",None)` (`:113`) | **yes** → `None` | `typeof === "string"` | **stricter than the producer** |
| `absUrl` | `getattr(result,"entry_id",None)` (`:114`) | yes → `None` | not checked here | safe (`hasSafeUrls`) |

The upstream that produces those `getattr` values is `arxiv` **2.1.3**, whose
`Result._from_feed_entry` does:

* `published=Result._to_datetime(entry.published_parsed)` → `None` if the entry has no `published`
* `primary_category=entry.arxiv_primary_category.get("term")` → **`None` if the entry has no primary tag**
* `categories=[tag.get("term") for tag in entry.tags]` → **`List[str | None]`; a tag with no `term`
  puts a literal `None` in the array**

Two consequences:

1. **`published: null` can never reach a shard.** `build_shards:150-153` skips any record with falsy
   `published`, so `typeof published === "string"` cannot over-reject real shard output. Safe.
2. **`primaryCategory: null` and a `categories` array containing `null` *can* reach a shard** — nothing
   in the producer filters them. Such a record renders fine in the feed (no chip highlighted,
   `PaperCard.tsx:82` only compares) and would then be **silently dropped on import/reload** by the new
   validator. This is the one genuine over-validation surface. It is also exactly what criterion 1
   demands ("`categories` must be `Array.isArray(...)` (of strings)", "`primaryCategory` must be a
   `string`"), so it is a spec-mandated trade, not an implementation error.

**Measured exposure: zero.** Across two independent index generations and a raw-feed inspection:

```
raw Atom, cat:hep-th, 2000 entries:
  category tags total 4384   without term: 0
  entries missing primary_category term: 0
  entries missing published: 0
```

## 3. Empirical sweeps — 5,519 real producer records, 0 rejected

I generated a fresh index with the real script and network (12 categories, 5,000-day retention, so it
reaches far older records than the 60-day default):

```
/usr/local/bin/python3.11 scripts/build_index.py --retention-days 5000 --max-per-category 250 \
  --category cs.CV --category cs.LG --category cs.CL --category cs.AI --category cs.RO \
  --category hep-th --category math.CO --category astro-ph.GA --category q-bio.NC \
  --category stat.ML --category eess.IV --category physics.optics --out-dir /tmp/imp154v/index-big
→ INFO:root:Wrote 2702 papers across 10 shards
```

Field-type census over both indexes (Python):

```
repo web/public/data: papers-2026-W39.json 263 + papers-2026-W40.json 2549 = 2812
  missing keys: {}   published {'str':2812}   primaryCategory {'str':2812}   categories {'list':2812}
  published null: 0  primaryCategory null: 0  weird published: []  empty/non-string/dup categories: 0/0/0
  absUrl kinds: all 2812 are "http://"
fresh 12-category index: 2702 records, identical result (0 nulls, 0 non-strings, 0 missing keys)
```

Then every record driven through the **real code path** (`parseExportPayload` + `loadState`) in a
scratch copy of `web/` (`/tmp/imp154v`, working-tree `collections.ts` verified byte-identical to the
repo's):

```
SWEEP[repo-shards]  in=2812 kept=2812 rejected=0   loadState papers=2812 ids=2812
SWEEP[fresh-2702]   in=2702 kept=2702 rejected=0   loadState papers=2702 ids=2702
LEGACY ids 9901001,0001001,9901001,9911222,9901001
SWEEP[legacy]       in=5    kept=5    rejected=0
 Test Files  1 passed (1) / Tests  3 passed (3)
```

**Exact count: 5,519 real records in, 5,519 kept, 0 rejected.** The implementer's "2,812 / 0" is
reproduced exactly and then nearly doubled.

**The committed fixture is genuinely verbatim.** I evaluated the `REAL_RECORDS` literal out of
`collections.test.ts:661-740` in Node and compared it (order-sensitive `JSON.stringify`) against the
real shard entries:

```
2610.02207 verbatim: true | keys 11 / 11
2610.01004 verbatim: true | keys 11 / 11
2609.38219 verbatim: true | keys 11 / 11
2609.38216 verbatim: true | keys 11 / 11
ALL VERBATIM: true
```

## 4. Edge cases the producer can actually emit

Verdicts measured through both `parseExportPayload` and `loadState` (scratch probe,
`/tmp/imp154v/web/src/__tests__/zz-edge.test.ts`, 68 assertions):

| Case | Kept/dropped | Correct? |
|---|---|---|
| `categories: []` | **KEPT** (`every` on `[]` is vacuously true) | Correct — `PaperCard:79` maps to zero chips; no crash, no data loss |
| duplicate categories `["cs.CV","cs.CV"]` | **KEPT** | Correct for validity. Cosmetic only: `PaperCard:81` uses `key={category}`, so React logs a duplicate-key warning. Pre-existing, not a crash, and `dedupe_records:132-136` already de-dupes across records |
| `categories` with a non-string / `null` element | **DROPPED** | Per criterion 1's "of strings". This is the one over-rejecting case, and it is producer-reachable in principle (`[tag.get("term") ...]`) — unobserved in 6,519 records. Accepted spec trade |
| `primaryCategory` absent or `null` | **DROPPED** | Per criterion 1. Producer-reachable in principle (`arxiv_primary_category.get("term")` → `None`); unobserved in 6,519 records. A record with a null primary renders fine in the feed, so this is silent loss of an otherwise-usable paper — the narrowest residual |
| `published` absent / `null` | **DROPPED** | Safe: `build_shards:150-153` already excludes such records, so this can never reject real shard output |
| `published` non-ISO (`"01 Oct 2026"`) | **KEPT** | Correct — criterion 1 only demands a string. `formatDate:20-30` returns the raw string rather than throwing |
| `published: ""` | **KEPT** | Correct — `typeof` only; `formatDate` returns `""`. (Only a *stored* snapshot with `published: ""` is at risk of the `paperIndex.ts:188` window filter, which is the feed path, not import) |
| legacy id `hep-th/9901001` | **KEPT** | `isPaper` applies no id *format* check, so slash ids pass. Note the producer never emits them anyway — see Finding 4 |
| `absUrl`/`pdfUrl` both `null` | **KEPT** | Correct; `hasSafeUrls:112` treats null as "no url" (IMP-001's rule) |
| array-like `{length: 0}` for `categories` | **DROPPED** | Correct |
| sparse `[ , "cs.CV"]` over JSON | **DROPPED** | Correct — `JSON.stringify` turns holes into `null`, so this is the `null`-element case |

## 5. Security re-fuzz (IMP-001 / IMP-151 invariants) — intact

11 hostile URL shapes × `absUrl` × `pdfUrl`, plus the stored-`loadState` path
(`/tmp/imp154v/web/src/__tests__/zz-edge.test.ts`):

```
javascript:alert(1) / JaVaScRiPt: / "  javascript:" / "\tjavascript:" / "\njavascript:" /
"java\nscript:" / data:text/html,<script>… / vbscript: / file:///etc/passwd /
blob:https://evil.example/x / //evil.example/x
→ import absUrl:  DROPPED (all 11)      import pdfUrl: DROPPED (all 11)
```

Prototype-key and adjacent ids, both paths:

```
PROTO id="__proto__"   import=[]            load.papers=[]  load.ids=[]
PROTO id="constructor" import=[]            load.papers=[]  load.ids=[]
PROTO id="prototype"   import=[]            load.papers=[]  load.ids=[]
PROTO id="toString"    import=[toString]   load.papers=["toString"]  load.ids=["toString"]
PROTO id="valueOf" / "hasOwnProperty" / "isPrototypeOf" / "propertyIsEnumerable" → same shape
PROTO merged ids for [__proto__, constructor, 2401.00001] = ["2401.00001"]
({}).polluted === undefined  ✓      Object.getPrototypeOf(loaded.papers) === Object.prototype  ✓
```

`__proto__`/`constructor`/`prototype` are dropped exactly as before. The four other prototype members
are *kept* as **own** properties (`collections.ts:312-314` assigns into a fresh `{}`), which is safe
only because every read site uses own-key membership: `collections.ts:152`, `:166`, `:252`, `:321`.
`CollectionsView.tsx:42` does read `state.papers[id]` bare, but `paperIds` is filtered by `hasOwnKey`
on every write path (`mergeImport:166`, `loadState:321`, and `addPaper:218` writes the paper and the id
together), so no orphan id can reach that read. I checked for a desync introduced by the stricter
`isPaper`: it cannot create one, because both filters that build `papers` also filter `paperIds`
against it. In the live browser, `Object.getPrototypeOf(papers) === Object.prototype` after the
malformed imports.

**One thing the profile claims that is worth restating precisely:** `loadState` does **not** apply
`hasSafeUrls`, so a stored snapshot with `absUrl: "javascript:alert(1)"` survives `loadState` (my
probe: `FUZZ stored absUrl … -> KEPT`, 11/11). That is unchanged by this item, and the render-time
guard holds — I rendered such a paper through `PaperCard` and got `rendered hrefs=[]`, i.e. no `href`
attribute at all, because `safeHref` (`PaperCard.tsx:33-35`) neutralises it. IMP-001's
defence-in-depth is therefore still two-layered and both layers verified.

---

## 6. Findings

### Finding 1 — the feed path is a real, unclosed bypass of `isPaper` (out of scope, correctly disclosed) — **important**

`PaperCard.tsx:79` is still unguarded, and that is *acceptable for the import surface* because both
writers of collection snapshots (`parseExportPayload` and `loadState`) now gate on `isPaper`.
**But papers reach `PaperCard` by two routes that never touch `isPaper` at all**, and I proved both
crash:

1. **The network feed.** `paperIndex.ts:152-153` caches the shard array verbatim; `:186-189` filters
   only on `paper.published`. No shape validation anywhere in `paperIndex.ts`.
   Probe (`/tmp/imp154v/web/src/__tests__/zz-bypass.test.tsx`, stubbed `fetch` serving a
   `categories`-less record):
   ```
   BYPASS loadPapers returned 1 record(s); categories=undefined
   BYPASS PaperCard threw: TypeError: Cannot read properties of undefined (reading 'map')
   ```
   It throws **even earlier** than `PaperCard` when the record's `primaryCategory` is not in the
   active filter set, inside `App`'s own `useMemo`:
   ```
   APPFILTER thrown=TypeError: Cannot read properties of undefined (reading 'some')   (App.tsx:185)
   ```
   With no error boundary above `<App />` (`main.tsx:12-15`), that blanks the app identically to the
   import case. **Scope judgement: correct.** `FEATURES.md:240` assigns shard/manifest validation to
   IMP-098 and point-of-use guards to IMP-160, and IMP-154's Area/files are `collections.ts` +
   `PaperCard.tsx` only. The implementer disclosed this (`impl-IMP-154.md:53`). It is nonetheless the
   most important thing this report records: *the class of bug IMP-154 closes is closed only for the
   import and localStorage boundaries, and the reachable-from-the-network boundary is still open.*
2. **`addPaper` (a feed paper being saved).** `collections.ts:206-220` validates nothing. If such a
   paper is saved, it lands in `localStorage`, then `loadState` drops it on the next reload — silent
   loss rather than a crash. Strictly better than before, but the paper vanishes from the user's
   collection without any message. This is a consequence of the new strictness, not of the old.

**Action:** none required for this item. Ensure IMP-098 exists and validates shard records against
the same field set; the trace above is the reproduction it needs.

### Finding 2 — the new doc comment overstates the producer invariant (`collections.ts:68-76`) — actionable

The comment says *"build_index.py emits all eleven keys on every record … so the strict checks below
reject malformed files only."* Both halves are too strong:

* `published` is emitted as `null` when absent (`iso_date(getattr(...))`, `build_index.py:110` +
  `:80-82`) and `primaryCategory` as `null` when the entry has no primary tag
  (`build_index.py:113`). Only `published` is filtered afterwards, by `build_shards:150-153`.
* *"the producer emits `null` for those [absUrl/pdfUrl]"* is wrong for the observed common case:
  `absUrl` is `getattr(result,"entry_id",None)` and measured as an `http://arxiv.org/abs/...` string
  in 5,514/5,514 records.

The claim is true of the shards that happen to be on disk (which is what the implementer measured) but
is not a producer invariant, and a future reader could rely on it. The implementer's own prose in
`impl-IMP-154.md:73-80` is accurate; only the code comment drifted. Suggested rewording: "measured
over 5,519 records from two independent builds, 0 rejected; the producer *can* emit a null
`primaryCategory` and a `categories` entry without a `term`, so those papers would be dropped on
import even though the feed renders them."

### Finding 3 — criterion 3's "assert that count in a test" is not literally satisfied — low

The committed test asserts 4 verbatim records, not 2,812. Given `public/data` is gitignored this is
defensible, and the alternative (`import.meta.glob("../../public/data/papers-*.json", {eager:true})`
guarded by an `if`) would be **vacuously true in CI**, which is worse than a real 4-record fixture.
Recommendation: leave it, and let the next index build in CI print the sweep count instead. Not a
failure.

### Finding 4 — pre-existing producer bug found in passing: `arxiv_id_from_entry` truncates legacy ids — informational, not this item

`build_index.py:75-76` does `entry_id.rstrip("/").rsplit("/", 1)[-1]`, which keeps only the last path
segment. For `http://arxiv.org/abs/hep-th/9901001v1` the producer emits `9901001`, **not**
`hep-th/9901001`. I confirmed this by feeding real legacy papers through `record_from_result`:

```
9901001  str 1999-01-04  nlin.CD     ['nlin.CD']
0001001  str 2000-01-01  cond-mat.stat-mech  ['cond-mat.stat-mech','cond-mat.soft','q-bio.BM']
9901001  str 1999-01-05  cs.LG       ['cs.LG','cs.AI']
9911222  str 1999-11-12  astro-ph    ['astro-ph']
9901001  str 1999-01-01  hep-th      ['hep-th']
```

Collision consequence, visible in my own sweep: `loadState papers=3` for 5 records because three
records share the id `9901001`. Also a "different archive, same month" collision (`9901001` vs
`2000-01-01`'s `0001001`). `isPaper` is unaffected and this predates IMP-154 by a wide margin; it is
out of scope for this item but worth a backlog entry (`scripts/build_index.py:71-76`).

### Finding 5 — over-strictness residual, quantified for the record — informational

A shard record with `primaryCategory: null` or a `categories` element of `null` renders correctly in
the feed but is dropped by `isPaper` on import, on export→re-import round-trip, and on `loadState`.
Measured exposure across 5,519 records from two builds plus a 2,000-entry raw feed inspection: **0**.
Mandated by criterion 1. Nothing to do.

### Finding 6 — `REPO_PROFILE.md` WEB-20's Residual clause is now stale — informational

`REPO_PROFILE.md:709` still says *"isPaper still does not validate categories / published, so a
malformed export still blanks the whole app"*. That sentence is closed by this item and the §10
do-not-re-report table needs an IMP-154 row. The implementer was not permitted to edit the profile
(`impl-IMP-154.md:263-267`); noting it so the coordinator can.

---

## 7. Non-vacuity — independently reproduced

Scratch copy at `/tmp/imp154vac`: `rsync` of the working `web/`, with **only** `src/lib/collections.ts`
restored from `git show HEAD:web/src/lib/collections.ts`. Diff between the two `collections.ts` files
is exactly the 4 checks + the doc comment — nothing else.

```
cd /tmp/imp154vac/web && npx vitest run src/lib/__tests__/collections.test.ts src/__tests__/malformedImport.test.tsx
 × drops a payload paper with no categories and keeps the valid sibling
 × drops a payload paper with no published and keeps the valid sibling
 × drops a payload paper with categories as a string and keeps the valid sibling
 × drops a payload paper with categories with a non-string and keeps the valid sibling
 × drops a payload paper with no primaryCategory and keeps the valid sibling
 × drops a payload paper with published as a number and keeps the valid sibling
 × returns an empty papers array, never null, when every paper fails
 × drops a stored snapshot that is missing categories on reload
TypeError: Cannot read properties of undefined (reading 'map')
 × keeps the tree mounted when an imported paper omits categories
 × keeps the tree mounted when an imported paper omits published
 × keeps the tree mounted when an imported paper has categories as a string
 × leaves no snapshot that PaperCard would dereference unguarded
 × survives a stored snapshot that predates the validation
TypeError: Cannot read properties of undefined (reading 'map')
 Test Files  2 failed (2)
      Tests  13 failed | 27 passed (40)
```

**13 of 15 fail, with the exact `TypeError` the spec quotes.** The 2 that pass under both versions are
`keeps every real record fixture` and `keeps a real record through a localStorage round trip` — correct
behaviour for no-over-rejection guards, which must hold before *and* after the fix. The implementer's
claim is accurate.

---

## 8. Browser verification (Playwright, 1280px)

`cd web && npm run build && npm run preview -- --port 5199 --strictPort`, then
`http://localhost:5199/research-paper-feed/#view=collections`.

**(a) The spec payload** — the single paper `{"id":"2401.00009","title":"No categories","authors":["A"],"abstract":"abc"}`:

```
Collections (1)
region "Malformed spec payload"
  heading "Malformed spec payload (0)"      ← collection created, 0 papers, Export disabled
  paragraph "No papers saved yet. Use “Save to collection” on any paper in the feed."
(no error banner — nothing reported as "nothing added", per IMP-059's accepted gap)
playwright_browser_console_messages → (empty)
```

**(b) The same payload alongside a fully-populated sibling** — malformed dropped, sibling fully
rendered (title link, `<time>`, both authors, all four category chips with `cs.CV` marked primary,
abstract, truncation note, arXiv + PDF links):

```
Collections (2)
region "Malformed spec payload"   heading "Malformed spec payload (0)"     Export [disabled]
region "Mixed malformed import"   heading "Mixed malformed import (1)"
  article → "One Basis to Animate Them All" → time "Sep 30, 2026"
           → "Ramazan Fazylov, Stamatis Lefkimmiatis"
           → chips cs.CV(tag--primary) cs.AI cs.HC cs.LG
           → 3D Gaussian avatars support fast rendering, however…
           → "Abstract truncated — view the full text on arXiv."
           → arXiv / PDF / Remove
playwright_browser_console_messages → (empty, checked twice: after import (a) and after import (b))
```

**DOM metrics via `page.evaluate`:**

```json
{ "rootChildren": 1, "articleCount": 1,
  "storedPaperIds": ["2610.02207"],
  "collections": [{"id":"imp154-spec","paperIds":[]},
                  {"id":"imp154-mixed","paperIds":["2610.02207"]}],
  "prototypeIntact": true, "papersProtoPolluted": 0 }
```

The malformed snapshot is not even persisted. **`#root` has 1 child, console empty, sibling renders.**

**(c) Before/after, same payload, same viewport, two builds.** The pre-fix build (only
`collections.ts` reverted from HEAD, built and served on `:5200` to give it a separate origin):

```
pre-fix :5200 → page snapshot is EMPTY; console: "TypeError: Cannot read properties of undefined (reading 'map')"
           evaluate → {"rootChildren":0,"childElementCount":0,"bodyTextLength":0,"storedPaperIds":[]}
post-fix :5199 → full page renders, console empty, sibling present
```

This is the spec's before/after claim, reproduced in a real browser.

**(d) No visual regression.** The `#view=feed` view renders against the real index
(`2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index generated Oct 1, 2026`,
`2812 papers match`, cards with chips/links intact). The collections screenshot matches
`.improve/artifacts/baseline/baseline-collections-desktop-1280.png` in chrome, card layout, chip
styling and footer.

**Artifacts** (profile §4.2, 1280px):

* `.improve/artifacts/IMP-154/collections-import-missing-categories-desktop-1280.png` — after, the
  filename the spec's verification method asks for.
* `.improve/artifacts/IMP-154/BEFORE-collections-import-missing-categories-desktop-1280.png` — the
  pre-fix blank page, for the before/after pair the spec requests.

Both servers stopped; browser closed. Scratch dirs `/tmp/imp154v` and `/tmp/imp154vac` removed. No
source file was modified by this verification — `git status` is unchanged apart from the two artifact
files (`.improve/artifacts/` is in `.git/info/exclude`) and this report.

---

## 9. Verdict

**PASS — 5/5 acceptance criteria met.** The change is minimal (14 added lines in one function plus a
comment), the security invariants from IMP-001 and IMP-151 are intact under re-fuzz, the 15 new tests
are 13/15 non-vacuous with the exact `TypeError` the spec names, no pre-existing test was touched, and
the core over-validation risk is empirically closed: **5,519 real producer records across two
independent index generations, 0 rejected**, including a 12-category fresh build reaching 5,000 days
back. The browser check reproduces the blank page before the fix (`#root` 0 children, uncaught
`TypeError`) and the working view after it (`#root` 1 child, empty console, sibling rendered).

Required follow-ups, none blocking: (a) the `isPaper` doc comment overstates the producer invariant
(Finding 2), (b) IMP-098 must validate shard records, because the feed path still blanks the app on
the same record and does so inside `App.tsx:185` rather than `PaperCard.tsx:79` (Finding 1), (c) add
the IMP-154 row to `REPO_PROFILE.md` §10 and close the WEB-20 Residual clause (Finding 6).
