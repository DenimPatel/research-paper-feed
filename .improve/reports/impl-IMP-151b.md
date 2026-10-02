# Implementation report — IMP-151b (null-URL import regression)

**Item:** regression fix for R1 in `.improve/reports/regression-sweep-1.md`, bisected to
`0beec1b` (IMP-001). No separate `FEATURES.md` ID exists yet; filed under IMP-151's area
(`web/src/lib/collections.ts` import validation). **I did not edit `FEATURES.md`.**
**Bisected offending commit:** `0beec1b` — *fix(security): reject non-http(s) URLs in imported
collection papers [IMP-001]*
**Baseline:** 65 tests across 5 files.

---

## 1. Files changed

| File | Change |
| --- | --- |
| `web/src/lib/collections.ts` | `hasSafeUrls` predicate, +7/−1 (1 line of code + a 5-line doc comment) |
| `web/src/lib/__tests__/collections.test.ts` | +69 lines, purely additive (new `describe` block, 4 tests) |

Nothing else. No styles, no `types.ts`, no `scripts/`, no `tests/`, no config, no lockfile.
No git write commands were run; no branches switched. `.kilo/worktrees/mildly-income` was
never read or modified.

`git diff --stat`:

```
 web/src/lib/__tests__/collections.test.ts | 69 +++++++++++++++++++++++++++++++
 web/src/lib/collections.ts                |  8 +++-
 2 files changed, 76 insertions(+), 1 deletion(-)
```

The test-file diff has **zero** deleted lines (`git diff --numstat` → `69 0`), so no
pre-existing expectation was weakened.

---

## 2. Root cause

`web/src/lib/collections.ts:90-95` (pre-fix):

```ts
function hasSafeUrls(value: Paper): boolean {
  const paper = value as Partial<Paper>;
  return [paper.absUrl, paper.pdfUrl].every(
    (url) => url === undefined || isHttpUrl(url),
  );
}
```

`url === undefined` treats an **absent** field as safe but a **present-but-`null`** field as
unsafe: `isHttpUrl(null)` runs `String(null)` → `"null"`, which fails `/^https?:\/\//i`, so
`hasSafeUrls` returns `false` and `parseExportPayload`
(`collections.ts:251` — `candidate.papers.filter(isPaper).filter(hasSafeUrls)`) silently
discards the **entire paper**.

That value is reachable on the wire. `scripts/build_index.py:113-114` (`record_from_result`),
read-only confirmation:

```python
"absUrl": getattr(result, "entry_id", None),
"pdfUrl": getattr(result, "pdf_url", None),
```

A missing attribute becomes `None` → JSON `null`. `web/src/lib/types.ts:11-12` declares both
fields non-nullable `string`, so TypeScript never sees it — the mismatch is exactly the
pre-existing WEB-13 / IMP-019 gap. IMP-001 turned that latent type mismatch into silent,
unreported data loss on the consumer side.

Failure path in the UI: `mergeImport` (`collections.ts:146`) narrows `paperIds` to the papers
that survived the filter, so a legitimate export containing a url-less paper produces a
collection showing `(0)` with **no alert and no console output**.

Scope note: `loadState` (the localStorage path) never calls `hasSafeUrls`, so existing browser
snapshots are unaffected. Only the **import** path lost papers.

---

## 3. The fix

`web/src/lib/collections.ts:90-100` (post-fix):

```ts
/**
 * Reject only urls that are present and not `http(s)`. A field the producer
 * left absent is `null` as often as it is missing — `build_index.py` reads it
 * with `getattr(result, …, None)` — and that is "no url", not "unsafe url",
 * so dropping the paper would lose data this guard never meant to remove.
 */
function hasSafeUrls(value: Paper): boolean {
  const paper = value as Partial<Paper>;
  return [paper.absUrl, paper.pdfUrl].every(
    (url) => url == null || isHttpUrl(url),
  );
}
```

`url == null` (loose) is the idiomatic "null or undefined" test, so both the key-absent case
IMP-001 handled and the producer-`null` case now take the same path. It is the smallest
possible change: one token on one line. Everything else — `isHttpUrl`, `isPaper`, the
`filter(isPaper).filter(hasSafeUrls)` chain, the `papers: []` return — is untouched.

**IMP-001's security property is preserved.** `javascript:`, `data:`, `vbscript:`,
`file:`, `blob:`, `httpx://`, and every other non-`http(s)` value still fail the loose-null
check and still fall through to `isHttpUrl`, which rejects them. Only the two *nullish*
values short-circuit. Case- and whitespace-variants (`  JaVaScRiPt:`, `java\tscript:`) are
also unaffected, since `String(value).trim()` behaviour is unchanged.

### The `PaperCard` render guard is deliberately NOT weakened

`web/src/components/PaperCard.tsx:33-35` is a **separate** guard and I left it byte-identical:

```ts
function safeHref(url: string | undefined): string | undefined {
  return isHttpUrl(url) ? String(url).trim() : undefined;
}
```

It is not `null`-aware and must not become so — `isHttpUrl(null)` is `false`, so `safeHref`
returns `undefined` and the four `href={…}` sites (`:64`, `:102`, `:115`, `:120`) fall back to
their existing no-anchor / plain-text branches. Verified by rendering, not by reading:

- paper with `absUrl: null, pdfUrl: null` → **0 anchors**, title renders as `<SPAN>`,
  `.paper__links` empty, **no `href` attribute of any kind**.
- paper with valid `absUrl` and `pdfUrl: null` → arXiv links still render, every `href` starts
  with `https://arxiv.org/abs/`, count > 0.
- paper with `absUrl: "javascript:alert(1)"` → still dropped by `parseExportPayload` (0 papers).

So the imported `null` now survives import *and* renders as a plain, unlinked card — no
unsafe href can be emitted, and no anchor with a missing/null `href` attribute is created.

---

## 4. Regression tests

Added to `web/src/lib/__tests__/collections.test.ts`, new `describe("producer-null urls in
imported papers")`, reusing the file's existing `makePaper` helper. Each payload is passed
through `JSON.parse(JSON.stringify(…))` so the module receives exactly the bytes the import
path reads from a real export file — this is the honest reproduction, and it is how the type
system is bypassed the same way `FileReader` bypasses it.

| Test | Asserts |
| --- | --- |
| `keeps a paper whose absUrl is null` | both ids survive; `papers[0].absUrl` is `null` |
| `keeps a paper whose pdfUrl is null` | both ids survive; `papers[0].pdfUrl` is `null` |
| `keeps a paper whose absUrl and pdfUrl are both null` | id survives; both fields still `null` |
| `still drops javascript:, data: and vbscript: urls beside null siblings` | of a 5-paper payload only the both-null paper survives — `absUrl: "javascript:alert(1)"`, `pdfUrl: "data:text/html,<script>x</script>"`, `pdfUrl: "vbscript:msgbox(1)"`, `absUrl: "httpx://evil.example/5"` are all dropped while the `null` sibling is kept, in one payload |

The last test is the important one: it pins the security property *and* the new behaviour in
the same assertion, so a future over-broad fix (`return true`, or widening `hasSafeUrls` to
"keep anything nullish-adjacent") fails it.

### Non-vacuousness — proved against the pre-fix code

Scratch copy, repo untouched:

```
$ rsync -a --exclude node_modules --exclude dist --exclude public \
    /Users/…/web/ /tmp/imp151b-scratch/
$ ln -s /Users/…/web/node_modules /tmp/imp151b-scratch/node_modules
# revert ONLY the predicate line in the scratch copy
-    (url) => url == null || isHttpUrl(url),
+    (url) => url === undefined || isHttpUrl(url),
$ cd /tmp/imp151b-scratch && npx vitest run
```

```
 ✓ src/lib/__tests__/urlState.test.ts (18 tests)
 ✓ src/lib/__tests__/search.test.ts (12 tests)
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests)
   × producer-null urls in imported papers > keeps a paper whose absUrl is null
   × producer-null urls in imported papers > keeps a paper whose pdfUrl is null
   × producer-null urls in imported papers > keeps a paper whose absUrl and pdfUrl are both null
   × producer-null urls in imported papers > still drops javascript:, data: and vbscript: urls beside null siblings
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests)

 Test Files  1 failed | 4 passed (5)
      Tests  4 failed | 65 passed (69)
```

**Exactly 4 failed / 65 passed.** All 4 new tests are load-bearing, and no pre-existing test
depends on the buggy behaviour. The failure mode is the reported one, e.g.:

```
AssertionError: expected [] to deeply equal [ '2401.00004' ]
```

The tests were additionally written and observed red **before** the fix was applied, in the
repo itself (`4 failed | 21 passed` in `collections.test.ts`).

The `PaperCard` render evidence above came from a third scratch test
(`/tmp/imp151b-scratch/src/__tests__/scratch-papercard-null.test.tsx`, 3 tests, all passing)
written only in `/tmp` — I am not permitted to add files under `web/`, so no render test is
added to the repo. That is the same coverage gap IMP-005 was meant to close and that
`verify-IMP-001.md` OBS-3 recorded; a permanent `PaperCard` null-url test is still missing and
belongs to a backlog item that owns `web/src/components/__tests__/`.

`/tmp/imp151b-scratch` and the three `/tmp/imp151b-*.log` files are throwaway; the repo tree
contains only the two source changes above.

---

## 5. Commands and results

All run from `web/`.

```
$ npm run typecheck
> tsc --noEmit
(no output)
TYPECHECK_EXIT=0
```

```
$ npm test
> vitest run
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web

 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 8ms
 ✓ src/lib/__tests__/collections.test.ts (25 tests) 5ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 4ms
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests) 8ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 112ms

 Test Files  5 passed (5)
      Tests  69 passed (69)
   Duration  1.32s
TEST_EXIT=0
```

**69 tests / 5 files.** Baseline was 65 / 5; the 4 new tests account for the delta and all
65 pre-existing tests still pass. `collections.test.ts` went 21 → 25.

```
$ npm run build
> tsc --noEmit && vite build

vite v5.4.21 building for production...
✓ 39 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D8wKSJm1.js   163.72 kB │ gzip: 52.63 kB
✓ built in 363ms
BUILD_EXIT=0
```

Bundle: **39 modules** (unchanged), CSS **10.93 kB / gzip 2.86 kB** (byte-size identical to the
sweep's baseline), JS **163.72 kB / gzip 52.63 kB** vs the sweep's 163.73 kB — i.e. −0.01 kB,
noise from the one-token predicate change. No bundle regression.

Python side untouched (`scripts/`, `tests/`) and therefore not re-run; the change is
TypeScript-only.

---

## 6. Notes for the next agent

1. **The producer-side half is still open.** This fixes the consumer. `build_index.py`
   `record_from_result` can still emit `absUrl: null` / `pdfUrl: null` / `published: null`
   (`iso_date(getattr(result, "published", None))`), and `web/src/lib/types.ts:9-12` still
   declares them non-nullable. That is IMP-019's scope. When IMP-019 narrows the types, the
   `url == null` branch here becomes unreachable-but-harmless — **keep it anyway**, because
   `parseExportPayload` validates untrusted files from disk, and a hand-edited or third-party
   export is not the Python producer.
2. **The feedback gap is real and unfixed.** `parseExportPayload` still drops papers with
   zero user-visible signal, so a hostile export (intentionally cleaned) and a null-url export
   (previously emptied) look identical to the user. Surfacing a dropped-paper count on import
   would resolve that. Out of scope here — it changes the return type, which is IMP-151's
   tested surface.
3. **OBS-1 from `verify-IMP-001.md` is untouched:** an `absUrl` that is a JSON *array*
   (`["https://x"]`) still passes `isHttpUrl` via `String([...])`. Not exploitable (the
   rendered href is still http(s)) and still folded into IMP-019's scope.
4. **Not addressed (out of scope, pre-existing):** `PaperCard.tsx:80` calls
   `paper.categories.map(...)` with no guard, so a paper with a missing/non-array
   `categories` throws with no error boundary. Independent of this regression.