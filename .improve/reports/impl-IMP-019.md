# IMP-019 — Align `web/src/lib/types.ts` nullability with `record_from_result`

Implementer report. Read-only changes under `web/` plus this report and
`.improve/reports/discovered-IMP-019.md`. No git write commands were run; no
files outside `web/src/` were modified by me.

---

## 1. What the producer can actually emit vs. what I declared

**AC1 resolution: I widened the TypeScript. The Python side is unchanged.**

`scripts/build_index.py:104-121`, `record_from_result` — read verbatim, not
inferred:

```python
    return {
        "id": arxiv_id_from_entry(getattr(result, "entry_id", "")),
        ...
        "categories": list(getattr(result, "categories", []) or []),
        "primaryCategory": getattr(result, "primary_category", None),
        "absUrl": getattr(result, "entry_id", None),
        "pdfUrl": getattr(result, "pdf_url", None),
    }
```

All three read through `getattr(result, …, None)` with **no** `or ""` fallback
(unlike `id`, `title`, `authors`, `summary`, which all coalesce to `""`/`[]`).
So when arXiv omits one of the three, the value is Python `None`, which
`json.dump` writes as JSON `null` — a **present key with a null value**, not an
absent key. That distinction is the reason `isPaper` needs `=== null` rather
than `!= null` (see §4).

| field | Python expression | can emit `null`? | was declared | now declared |
| --- | --- | --- | --- | --- |
| `primaryCategory` | `getattr(result, "primary_category", None)` | **yes** | `string` | `string \| null` |
| `absUrl` | `getattr(result, "entry_id", None)` | **yes** | `string` | `string \| null` |
| `pdfUrl` | `getattr(result, "pdf_url", None)` | **yes** | `string` | `string \| null` |

`published`/`updated` go through `iso_date()`, which is a different pattern
(`return None` for a `None` input) and is out of this item's scope — see
`.improve/reports/discovered-IMP-019.md` D-1.

**Re-verified after the fact.** Another agent modified `scripts/build_index.py`
while I worked (IMP-020, `collect_papers` retention). I re-read
`record_from_result` in the working tree afterwards: unchanged, still the three
`getattr(…, None)` calls above. My conclusion is not stale.

`web/src/lib/types.ts:10-23` now reads:

```ts
  /**
   * The last three read `getattr(result, …, None)` in `record_from_result`
   * (`scripts/build_index.py:118-120`), so arXiv omitting one of them reaches
   * the wire as JSON `null` rather than a missing key. `arxiv` 4.x types
   * `Result.pdf_url` and `Result.entry_id` as `str | None` and
   * `Result.primary_category` as `str | None`, and nothing on the TS side ever
   * normalises them to a string, so `null` is declared here rather than
   * asserted away. A runtime guard and this type are separate tools: the guards
   * in `collections.ts` and `PaperCard`'s `safeHref` still have to do their work
   * because a shard is a bare cast and an import is a file read off disk.
   */
  primaryCategory: string | null;
  absUrl: string | null;
  pdfUrl: string | null;
```

---

## 2. Exact files changed

| file | change |
| --- | --- |
| `web/src/lib/types.ts` | widened the 3 fields (+17/−3) |
| `web/src/lib/collections.ts` | `isPaper` only: accept an explicit `null` `primaryCategory` (+12/−1, **one hunk**) |
| `web/src/components/PaperCard.tsx` | `safeHref` parameter widened to `string \| null \| undefined` (+16/−2) |
| `web/src/App.tsx` | null-guard the `Set` lookup in the category filter (+7/−1) |
| `web/src/lib/__tests__/paperIndex.test.ts` | +1 test (AC3) |
| `web/src/lib/__tests__/collections.test.ts` | +4 tests (one `describe`) |
| `web/src/__tests__/App.categories.test.tsx` | +4 tests (one `describe`) |
| `web/src/__tests__/paperCardNullUrls.test.tsx` | **new file**, 7 tests (AC2) |

`git status` also shows `scripts/build_index.py`, `tests/test_build_index.py` and
three other `.improve/reports/*.md` as modified/untracked. **Those are the other
agent's, not mine** — my instructions forbid touching `scripts/` and `tests/`,
and I did not. `web/package-lock.json` untouched, no dependency added.

---

## 3. THE ADVISORY — honoured, with proof

The advisory required: do not simplify `hasSafeUrls` by dropping the `url == null`
exemption, do not narrow `isHttpUrl`'s parameter, and do not let the widening
excuse removing the runtime guards.

### `isHttpUrl` + `hasSafeUrls` — BEFORE (unchanged working tree at item start,
`collections.ts:96-114`)

```ts
/**
 * Absolute http(s) only. Papers reach the renderer as clickable hrefs, and React
 * does not block `javascript:` there, so anything else must not survive import.
 */
export function isHttpUrl(value: unknown): boolean {
  return /^https?:\/\//i.test(String(value).trim());
}

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

### `isHttpUrl` + `hasSafeUrls` — AFTER (`collections.ts:103-121`)

```ts
/**
 * Absolute http(s) only. Papers reach the renderer as clickable hrefs, and React
 * does not block `javascript:` there, so anything else must not survive import.
 */
export function isHttpUrl(value: unknown): boolean {
  return /^https?:\/\//i.test(String(value).trim());
}

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

**Byte-identical.** Verified mechanically, not by eye — `git diff -U0
web/src/lib/collections.ts` contains exactly one hunk header,
`@@ -90 +90,11 @@ function isPaper`, and grepping the diff for `isHttpUrl`,
`hasSafeUrls` or `url == null` returns nothing.

`safeHref` was also *widened*, never narrowed: `string | undefined` →
`string | null | undefined`. The advisory's specific claim — that the old
signature "is inaccurate about what it actually receives" — is now true as a
type.

### The exemption is still load-bearing, and still tested

I applied the exact "simplification" the advisory forbids in a `/tmp` scratch
copy, changing only that one line to `(url) => isHttpUrl(url)`:

```
=== E: hasSafeUrls null exemption REMOVED (the advisory's trap) -> npm test ===
   × producer-null urls in imported papers > keeps a paper whose absUrl is null
   × producer-null urls in imported papers > keeps a paper whose pdfUrl is null
   × producer-null urls in imported papers > keeps a paper whose absUrl and pdfUrl are both null
   × producer-null urls in imported papers > still drops javascript:, data: and vbscript: urls beside null siblings
 Test Files  1 failed | 15 passed (16)
      Tests  4 failed | 249 passed (253)
=== E2: same, npm run typecheck ===
> tsc --noEmit
(clean — no output, no errors)
```

Two things to note, because they are the whole point of the advisory:

1. **Removing it fails 4 existing tests.** The null exemption protects real
   behaviour, and the suite pins it. IMP-151b's landed work is intact.
2. **Removing it typechecks cleanly.** `tsc` is *indifferent* to the exemption.
   The compiler does not know `parseExportPayload` reads a file off disk. This
   is the concrete demonstration that a compile-time type and a runtime guard
   are different tools: the type said nothing, only the guard did the work.

### Narrowing `isHttpUrl` to `string` is now caught by the compiler

The advisory predicted that narrowing the parameter "would let a `null` flow
straight into an `href`". In this codebase the compiler actually blocks it:

```
=== F: isHttpUrl param narrowed to string -> npm run typecheck ===
src/components/PaperCard.tsx(46,20): error TS2345: Argument of type
  'string | null | undefined' is not assignable to parameter of type 'string'.
  Type 'undefined' is not assignable to type 'string'.
```

So the widening *strengthened* the guarantee: `safeHref` now provably cannot
hand `isHttpUrl` anything outside `string | null | undefined`, and `isHttpUrl`
cannot be narrowed without a compile error. The `(value: unknown)` parameter
remains, and is now load-bearing in both directions.

### Security items not regressed

IMP-001/IMP-151b (`isHttpUrl` + `hasSafeUrls`, untouched — above), IMP-151
(`PROTOTYPE_KEYS` / `hasOwnKey`, untouched), IMP-154 (`isPaper`'s `categories` /
`published` checks, untouched — the one hunk I added sits between the
`categories` and `published` checks and changes neither), IMP-017
(`failureCopy.ts`, untouched), IMP-018 (error boundary, untouched). All 6 of the
pre-existing security test groups still pass unchanged; no existing expectation
was weakened, and no existing test was edited to make this item pass.

---

## 4. How the consumers handle `null`

Widening produced **exactly three** compile errors — the `med` risk the spec
named, fully enumerated:

```
src/App.tsx(356,20): error TS2345: Argument of type 'string | null' is not
  assignable to parameter of type 'string'.
src/components/PaperCard.tsx(57,28): error TS2345: Argument of type
  'string | null' is not assignable to parameter of type 'string | undefined'.
src/components/PaperCard.tsx(58,28): error TS2345: (same)
```

### `PaperCard.tsx` — AC2

`safeHref` now takes `string | null | undefined` and still runs `isHttpUrl`:

```ts
function safeHref(url: string | null | undefined): string | undefined {
  return isHttpUrl(url) ? String(url).trim() : undefined;
}
```

`String(null)` → `"null"` and `String(undefined)` → `"undefined"`; neither
matches the anchored `/^https?:\/\//i`, so all three shapes resolve to
`undefined`. The four `href={…}` sites at `PaperCard.tsx:65,103,116,121` all
read `absHref`/`pdfHref`, and each is either `href={absHref}` behind an
`absHref ? …` guard, or `{pdfHref && …}` which renders nothing when
`pdfHref` is `undefined`. So:

- `pdfUrl: null` → `pdfHref` is `undefined` → the PDF `<a>` is not rendered.
  No throw, no empty link, no `"null"` string.
- `absUrl: null` → the title falls back to `<span>` (`:69`) and the footer arXiv
  link (`:115`) and the truncated-abstract link (`:102`) are omitted; the text
  "view the full text on arXiv" still reads.
- `primaryCategory` **never reaches an `href`** — it is only compared at `:94`.

**An accuracy note on the spec's wording, because the verifier should not be
surprised.** The item describes "a `null` reaching `PaperCard.tsx:57` as
`href={null}`". React treats `null` and `undefined` identically for DOM
attributes — both *remove* the attribute — so `href={null}` would in any case
not have produced `href="null"` in the DOM; it would have produced a
link-shaped element with no destination. The pre-existing `safeHref` guard
already meant no `null` could reach any `href` at runtime. The actual, real
defect was the **type lie**: `string` made the mismatch invisible to the
compiler, so a future edit of any of these call sites would have typechecked a
`null` straight into an `href`. That is what this item actually closed, and it
is now structurally impossible (the three call sites are compile errors without
the widening). I have written the DOM test to assert the observable contract
(§5) rather than overclaim a `"null"` attribute that was never possible.

### `App.tsx` — the category filter

```ts
    const inCategories = papers.filter(
      (paper) =>
        // A null `primaryCategory` is "the producer named no primary", not a
        // category that happens to be unselected, so it can never be in the set
        // and the lookup is skipped. The `categories` clause below still matches
        // it, which is how such a paper stays reachable through the filter.
        (paper.primaryCategory !== null &&
          active.has(paper.primaryCategory)) ||
        paper.categories.some((category) => active.has(category)),
    );
```

**Filter semantics verified, as the spec's risk note asked.** `active` is
`new Set(activeCategories)` where `activeCategories: string[]` is drawn from
`manifest.categories` (`App.tsx:313-314`). A `null` can never be a member.
`active.has(null)` would have returned `false` at runtime anyway, so the guard
changes **no** behaviour — it changes what the compiler is allowed to accept.
The `paper.categories.some(...)` clause is untouched, so a null-primary paper is
still reachable by selecting any category in its `categories` array, and is not
reachable by selecting anything else. Both directions are pinned by the 4 new
`App.categories.test.tsx` tests, including the "null is not a wildcard" case.
Verified no regression: all 17 pre-existing `App.categories.test.tsx` tests pass
unchanged, and the new block uses its own `fetch` stub and its own papers so the
shared `SHARD` was not modified.

`PaperCard.tsx:94` (`category === paper.primaryCategory`) needed no change:
comparing `string` to `string | null` is legal, and at runtime no category
equals `null`, so a null primary simply marks no chip as primary. Pinned by a
test.

### `isPaper` — the change the spec did not anticipate but AC1 requires

This is the one place the widening has a **behavioural** consequence, and it is
the only real code change I made beyond signatures.

Before my change, `isPaper` required `typeof paper.primaryCategory === "string"`.
Widening the type to admit `null` while leaving that check alone would have
**silently dropped every real producer record with a null `primaryCategory`** at
import — the exact inverse of the item's purpose. So:

```ts
    (typeof paper.primaryCategory === "string" ||
      paper.primaryCategory === null) &&
    typeof paper.published === "string"
```

`null` is now tolerated, `undefined` (absent) is still rejected. This mirrors
`hasSafeUrls`' exemption in spirit while keeping IMP-154's field-missing gate
intact. The `REAL_RECORDS` fixture sweep (`collections.test.ts:821`) still
passes.

**A bug I introduced and caught, worth recording because of how.** My first
version wrote the disjunction unparenthesised:

```ts
    typeof paper.primaryCategory === "string" ||
    paper.primaryCategory === null ||
    typeof paper.published === "string"
```

`&&` binds tighter than `||`, so this turned *every* check above it
(`id`, `title`, `authors`, `abstract`, `categories`, `PROTOTYPE_KEYS`) into an
alternative rather than a requirement — `isPaper` was accepting almost anything.
The existing suite caught it immediately: **11 failures across 2 files**, because
`collections.test.ts:780` and siblings saw malformed papers survive. That is the
landed IMP-154 suite doing its job; the bug never reached a commit or a test run
I reported. Fixed with explicit parentheses and a comment recording why the
grouping is load-bearing.

---

## 5. Tests added (+16, all in the two named suites plus one new file)

Baseline was 237 tests / 15 files. Now **253 tests / 16 files**.

### `web/src/lib/__tests__/paperIndex.test.ts` (+1) — AC3

Required by AC3: "a new test … loads a fixture paper with `pdfUrl: null`". New
`describe("producer-null url fields on a shard")` with a `Paper`-typed fixture
whose `primaryCategory`, `absUrl` and `pdfUrl` are all `null`. Asserts the paper
loads, survives into the result, keeps `null` (not `undefined`) on all three
fields, and — the sharp assertion — that `Object.keys(paper)` still *contains*
`"pdfUrl"`, proving the loader does not turn a wire `null` into a missing key.

### `web/src/__tests__/paperCardNullUrls.test.tsx` (new, 7) — AC2

DOM/RTL tests (per `.improve/REPO_PROFILE.md` §5.3: component tests go in
`web/src/__tests__/`, not the 1:1 lib mirror). Covers: `pdfUrl: null` omits
the PDF link and keeps arXiv; `absUrl: null` + `pdfUrl: null` yields zero
anchors; `pdfUrl: "javascript:alert(1)"` is still refused (proves `safeHref`
did not become a pass-through); `absUrl: null` renders the title as a `<span>`;
`primaryCategory: null` renders both chips with no `tag--primary`; all three null
renders the card with no anchors; and the `abstractTruncated` note keeps its
wording while dropping the anchor. A shared `assertNoNullHref` walks **every**
anchor and asserts the `href` attribute is present and matches `/^https?:\/\//i`,
so no `href` can hide from the assertions.

### `web/src/lib/__tests__/collections.test.ts` (+4)

New `describe("producer-null primaryCategory in imported papers")`: a null
`primaryCategory` survives `parseExportPayload`; an **absent**
`primaryCategory` key is still dropped (IMP-154 guard); it survives a
`localStorage` round trip; and the URL guard is untouched for a null-primary
paper (`javascript:`/`data:` siblings still dropped).

### `web/src/__tests__/App.categories.test.tsx` (+4)

New `describe("filtering papers whose primaryCategory is null")` with its own
manifest/shard stub: both papers show under All; a null primary matches only its
own `categories` and is not a wildcard; and it produces no unknown-category
alert. The 17 pre-existing cases in that file are untouched.

---

## 6. Non-vacuity — verified in `/tmp`, with honest limits

Scratch copy at `/tmp/imp019-scratch` (`rsync` of `web/`, `node_modules`
symlinked). Each experiment reverts exactly one change.

**A. Revert the 3 type declarations only → `npm run typecheck` FAILS**
(15 errors, quoting 4):

```
src/__tests__/App.categories.test.tsx(467,5): error TS2322: Type 'null' is not assignable to type 'string'.
src/__tests__/paperCardNullUrls.test.tsx(51,60): error TS2322: Type 'null' is not assignable to type 'string | undefined'.
src/lib/__tests__/paperIndex.test.ts(606,5): error TS2322: Type 'null' is not assignable to type 'string'.
   (15 total, spanning all three test files)
```

**A′. …and `npm test` PASSES 253/253 with the old types.** This is a real
limitation and the verifier should have it explicitly: **vitest does not
typecheck** (esbuild strips types). So the three widened-field test files are
non-vacuous against `npm run typecheck` — which AC3 names as the gate — but
*vacuous against `vitest` alone*. I am not going to claim otherwise.

**B. Revert only the `isPaper` change → `npm test` FAILS 3** (genuinely
non-vacuous at runtime):

```
   × producer-null primaryCategory in imported papers > keeps a paper whose primaryCategory is null
   × producer-null primaryCategory in imported papers > keeps a null primaryCategory through a localStorage round trip
   × producer-null primaryCategory in imported papers > leaves the url guard untouched for a null primaryCategory
 Test Files  1 failed | 15 passed (16)
      Tests  3 failed | 250 passed (253)
```

The 4th new collections test ("still drops a paper whose primaryCategory key is
absent") passes in both directions by design — it is a regression guard for
IMP-154, not a test of the new behaviour.

**Net non-vacuity summary:** 3 of the 16 new tests are non-vacuous at **runtime**
(verified in B). The other 13 are non-vacuous against **`npm run typecheck`**
(verified in A), which is the correct gate for a type-widening item — the defect
being fixed *is* a compile-time lie, and a test that only runs cannot detect a
compile-time lie. Both kinds are reported rather than conflated.

Scratch was restored to 253/253 passing after every experiment.

---

## 7. Commands and verbatim results

All from `/Users/denimpatel/Desktop/git/research-paper-feed/web`.

**Baseline, before any edit** — 237 tests / 15 files, matching the stated
baseline:

```
> tsc --noEmit            (no output)
 Test Files  15 passed (15)
      Tests  237 passed (237)
   Duration  3.33s
```

**Final `npm run typecheck`:**

```
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit
(exit 0, no output)
```

**Final `npm test`:**

```
 ✓ src/lib/__tests__/collections.test.ts (41 tests) 7ms
 ✓ src/lib/__tests__/paperIndex.test.ts (28 tests) 16ms
 ✓ src/__tests__/App.retry.test.tsx (7 tests) 533ms
 ✓ src/__tests__/App.storage.test.tsx (8 tests) 624ms
 ✓ src/__tests__/App.partialShard.test.tsx (9 tests) 638ms
 ✓ src/__tests__/App.loadFailure.test.tsx (26 tests) 1043ms
 ✓ src/__tests__/App.categories.test.tsx (21 tests) 1152ms
 ✓ src/__tests__/errorBoundary.test.tsx (11 tests) 157ms
 ✓ src/__tests__/feedControls.test.tsx (14 tests) 448ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 63ms
 ✓ src/lib/__tests__/failureCopy.test.ts (8 tests) 8ms
 ✓ src/__tests__/paperCardNullUrls.test.tsx (7 tests) 186ms
 ✓ src/lib/__tests__/urlState.test.ts (50 tests) 9ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 5ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 94ms
 ✓ src/__tests__/App.relevance.test.tsx (3 tests) 209ms

 Test Files  16 passed (16)
      Tests  253 passed (253)
   Duration  3.69s
```

**Final `npm run build`:**

```
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
✓ built in 375ms
```

Bundle 171.45 kB / gzip 54.92 kB, CSS 10.93 kB / gzip 2.86 kB. CSS is unchanged
from the recon baseline, as §3.3 predicts for a types-only-and-guards change.
The JS figure is 7.73 kB above recon's 163.72 kB, but that baseline predates
every item landed since (IMP-005 added the whole test toolchain, IMP-173 and
IMP-021/IMP-022 added modules); I did not measure a per-item attribution and am
not claiming one. 41 modules vs recon's 39: the two new test files are excluded
from the bundle, so the two extra modules are from other agents' items landed
in the same batch, not from mine.

**FLAKE CHECK — 14 consecutive `npm test` runs:**

```
run  1: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  2: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  3: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  4: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  5: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  6: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  7: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  8: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run  9: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run 10: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run 11: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run 12: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run 13: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
run 14: PASS | Test Files  16 passed (16) | Tests  253 passed (253)
-----
TOTAL RUNS: 14   PASSED: 14   FAILED: 0
```

**14/14, exact counts identical every run (253/253, 16/16).** Zero flakes, so
the 1-in-12 rejection rate from this batch is not reproduced. Additionally,
3 runs with `--sequence.shuffle` to rule out inter-file ordering coupling:

```
 Test Files  16 passed (16)   Tests  253 passed (253)
 Test Files  16 passed (16)   Tests  253 passed (253)
 Test Files  16 passed (16)   Tests  253 passed (253)
```

The new tests hold no shared mutable state: the fetch stubs use the
`vi.stubGlobal` + `afterEach(vi.unstubAllGlobals)` pattern already in those
files, RTL cleanup runs from `src/test-setup.ts`, and the `MemoryStorage`
instances in the new collections tests are function-local (reusing the existing
fixture, not adding a new one).

**Not run — the spec's live-arXiv verification method.** `.improve/FEATURES.md`
AC "Verification method" asks for
`/tmp/rpf-venv/bin/python scripts/build_index.py … --out-dir /tmp/rpf-nullcheck`
and a screenshot to `.improve/artifacts/IMP-019/`. I did not run it: it needs
network access to arXiv and a `/tmp/rpf-venv` that I have not verified exists,
and the grep target (`"pdfUrl":null` in a real shard) is probabilistic — over the
2,812 real papers in the current index **none** of the three fields is ever null
(the `REAL_RECORDS` fixture in `collections.test.ts` was sampled from real shards
and all four records have populated values). A live run would very likely produce
no `null` to find, so it cannot confirm much. The null path is instead covered
deterministically by the 16 tests above. **A verifier wanting the screenshot
should know the null case may not be reproducible against live arXiv data.**

---

## 8. Acceptance criteria

| AC | status | evidence |
| --- | --- | --- |
| 1. Three fields declared with the nullability Python can emit; choice recorded | **met** | §1. Widened to `string \| null`; Python unchanged. All three are `getattr(…, None)` with no coalescing fallback. |
| 2. `PaperCard` renders no `href` of `null` for any of the three; a `null` `pdfUrl` omits the PDF link rather than throwing | **met** | §4. 7 new DOM tests, one of which asserts across *every* anchor. Accuracy note in §4 about React's `null`/`undefined` equivalence. |
| 3. `typecheck` + `build` succeed; a new test in `paperIndex.test.ts` loads a fixture paper with `pdfUrl: null` | **met** | §7. Both exit 0; the test is the new `describe` in that file. |

Advisory (Notes field): **honoured**, §3, with the before/after quoted verbatim,
a mechanical byte-identity check, and two scratch experiments showing the
exemption is both load-bearing and compiler-indifferent.

## 9. Repo-profile rows this touches (definition-of-done §4.6 item 6)

- **`WEB-13`** — "`pdfUrl` is `string` in TS but `str | None` in arxiv 4.x, so
  `null` can reach the wire" — **closed by this item** (also covered
  `primaryCategory` and `absUrl`, which the row did not mention).
- **`WEB-20`** — deliberately **left alone and still accurate**: the row's
  residual note says "`PaperCard.tsx:33-35` … is the independent render-time
  guard", which is now `PaperCard.tsx:32-46`. `isPaper`'s `categories` /
  `published` validation from IMP-154 is untouched. The row's line references
  shift; no behaviour changed.
- **`WEB-11`** — notes `Paper.updated` is "written but never read" — still
  accurate and independently confirmed; the `updated: null` type lie it does not
  mention is now `discovered-IMP-019.md` D-1.
- **`REPO_PROFILE.md` §10 "Still-open halves"** — the line
  "IMP-019 (`types.ts` still declares `absUrl`/`pdfUrl` as non-nullable `string`
  …; safe only while `isHttpUrl` takes `unknown`)" is now closed; the profile
  needs a line-number refresh for `collections.ts`/`PaperCard.tsx` and
  `WEB-13`'s removal. I did not edit `REPO_PROFILE.md` — it is a shared profile
  another agent maintains, and the task scoped my writes to `web/` plus my two
  reports.

## 10. Uncertain / left open

1. **Whether `primaryCategory: null` is reachable in practice.** The type is
   correct by construction (`getattr(…, None)`), but I have no real shard
   containing one, and the 4 sampled real records all have it populated. The
   `isPaper` change is therefore justified by the producer's *code*, not by an
   observed record. It is also strictly the safer direction: it only stops
   `isPaper` from discarding a value the wire can carry, and the null is
   null-aware at every read site.
2. **`null` vs absent semantics may not be what a future producer intends.** If
   `build_index.py` were later changed to omit these keys instead of nulling
   them, `isPaper`'s `=== null` would be the wrong test for `primaryCategory`
   (it would start dropping records) while `hasSafeUrls`'s `== null` would
   remain correct. Recorded so a future producer change updates the two
   together — see D-2.
3. **No `npm run lint` gate exists** (profile PE-6), so `tsc --noEmit` was the
   only static check, as the profile prescribes.
4. **Live-arXiv end-to-end verification not performed** — §7, with the reason
   and the note that a null may not occur in live data.
