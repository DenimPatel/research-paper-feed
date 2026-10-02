# Verification — IMP-019 (widening `Paper.primaryCategory`/`absUrl`/`pdfUrl` to `string | null`)

Verifier: independent sub-agent. Scope reviewed: `git diff -- web/` only (the concurrent
`scripts/` + `tests/` work for IMP-020 was read for context and excluded from judgement).
No repository source file was modified. All experiments ran in `/tmp` scratch copies.

**VERDICT: PASS** — 3/3 acceptance criteria met. Advisory intact. No blocking defect.
Three non-blocking observations recorded below (LOW/MED, none gating this item).

---

## 1. THE ADVISORY — honoured, quoted before/after

The spec's Notes warn against two "simplifications": narrowing `isHttpUrl`'s parameter from
`unknown` to `string`, and reducing `hasSafeUrls` from `url == null || isHttpUrl(url)` to
`isHttpUrl(paper.absUrl)`. Both would re-open the XSS hole IMP-001 closed.

### 1a. `isHttpUrl` — parameter is still `unknown`

`git diff -- web/src/lib/collections.ts` contains **no hunk at all** for `isHttpUrl`; the
function is byte-identical to HEAD.

After (`web/src/lib/collections.ts:104-111`):

```ts
/**
 * Absolute http(s) only. Papers reach the renderer as clickable hrefs, and React
 * does not block `javascript:` there, so anything else must not survive import.
 */
export function isHttpUrl(value: unknown): boolean {
  return /^https?:\/\//i.test(String(value).trim());
}
```

Before = after (not in the diff). **`(value: unknown)` retained. PASS.**
`String(value)` still means a non-string (number, object) cannot slip past by coercion.

### 1b. `hasSafeUrls` — the `null`/`undefined` exemption is still there

Not in the diff. After (`web/src/lib/collections.ts:113-124`):

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

Before = after. **`url == null ||` retained; still passes `paper.absUrl` (not the coerced
form). PASS.**

### 1c. `PaperCard`'s `safeHref` — the inaccurate signature WAS widened

This is the one place the advisory's premise was itself wrong, and the implementer followed the
code rather than the note. The advisory said `safeHref`'s `string | undefined` was inaccurate —
it was, and it is now `string | null | undefined`.

Before (`git diff`, `-` line):

```ts
-function safeHref(url: string | undefined): string | undefined {
+function safeHref(url: string | null | undefined): string | undefined {
   return isHttpUrl(url) ? String(url).trim() : undefined;
 }
```

After (`web/src/components/PaperCard.tsx:45-47`):

```ts
function safeHref(url: string | null | undefined): string | undefined {
  return isHttpUrl(url) ? String(url).trim() : undefined;
}
```

Call sites (`PaperCard.tsx:69-70`, `:79`) are unchanged and still pass the value straight
through:

```ts
const absHref = safeHref(paper.absUrl);
const pdfHref = safeHref(paper.pdfUrl);
```

**Widened as required. PASS.** The widening is not cosmetic: with the old signature,
`safeHref(paper.absUrl)` where `absUrl: string | null` is a compile error, so the original
signature was *impossible* to call once the types were honest. Had the implementer "kept" the
advisory literally, `tsc` would have failed.

### 1d. The runtime guard is independent of the signature — proven, not asserted

Two further facts confirm the guard does not depend on the declared type at all:

1. `isHttpUrl` takes `unknown` and stringifies internally (`collections.ts:110`), so it accepts
   `null`/`undefined` at runtime and returns `false`. Signature changes cannot reach it.
2. Even a total removal of the guard from `safeHref` does not produce an `href` of `"null"` —
   I measured React 18's actual behaviour (scratch test, jsdom + real React 18.3.1):

```
REACT href SEMANTICS:
a1: attr=null prop=""                                              <- href={null}
a2: attr=null prop=""                                              <- href={undefined}
a3: attr="javascript:alert(1)" prop="javascript:alert(1)"           <- React 18 only WARNS
a4: attr="null" prop="http://localhost:3000/null"                  <- only an explicit coercion
Warning: A future version of React will block javascript: URLs as a security precaution.
```

So a `null` reaching `href` would be *omitted* by React rather than rendered; the real risk is
`javascript:`, which React 18 **warns about but does not block**. That is exactly what
`isHttpUrl` prevents, and it is why the advisory's "narrow `isHttpUrl` to `string`" is the
dangerous half of the trap. The implementer's report §4 states this accurately.

### 1e. Empirical payload table (verifier-authored, `/tmp` only)

My own test — not the implementer's — pushed 23 crafted cases through the real code path
(`JSON.stringify` → `JSON.parse` (the FileReader equivalent) → `parseExportPayload` →
`PaperCard`) and then walked the live DOM of every survivor.

```
===== PAYLOAD TABLE =====
| absUrl          | "null"                       | KEPT    | expect KEPT    |
| absUrl          | "absent-key(undefined)"     | KEPT    | expect KEPT    |
| absUrl          | "\"\"" (empty)               | DROPPED | expect DROPPED |
| absUrl          | "\"   \" (spaces)"          | DROPPED | expect DROPPED |
| absUrl          | "\"javascript:alert(1)\""   | DROPPED | expect DROPPED |
| absUrl          | "\" javascript:alert(1)\""  | DROPPED | expect DROPPED |
| absUrl          | "\"java\\tscript:alert(1)\"" | DROPPED | expect DROPPED |
| absUrl          | "\"java\\nscript:alert(1)\"" | DROPPED | expect DROPPED |
| absUrl          | "\"java\\rscript:alert(1)\"" | DROPPED | expect DROPPED |
| absUrl          | "\"jAvAsCrIpT:alert(1)\""   | DROPPED | expect DROPPED |
| absUrl          | "\"\\u0000javascript:alert(1)\"" | DROPPED | expect DROPPED |
| absUrl          | "data:text/html,<script>x</script>" | DROPPED | expect DROPPED |
| absUrl          | "\"vbscript:msgbox(1)\""    | DROPPED | expect DROPPED |
| absUrl          | "\"//evil.example/x\""      | DROPPED | expect DROPPED |
| absUrl          | "\"http://ok.example/a\""   | KEPT    | expect KEPT    |
| pdfUrl          | "null"                       | KEPT    | expect KEPT    |
| pdfUrl          | "absent"                     | KEPT    | expect KEPT    |
| pdfUrl          | "\"javascript:alert(1)\""   | DROPPED | expect DROPPED |
| pdfUrl          | "\" javascript:alert(1)\""  | DROPPED | expect DROPPED |
| pdfUrl          | "\"java\\tscript:alert(1)\"" | DROPPED | expect DROPPED |
| pdfUrl          | "\"\""                       | DROPPED | expect DROPPED |
| primaryCategory | "null"                       | KEPT    | expect KEPT    |
| primaryCategory | "absent"                     | DROPPED | expect DROPPED |

===== RENDERED DOM =====
2401.00000 :: PDF :: href="https://arxiv.org/pdf/2401.00000"        <- absUrl null: title is a span
2401.00001 :: PDF :: href="https://arxiv.org/pdf/2401.00001"        <- absUrl key absent
2401.00002 :: (no anchors)                                          <- all three null
2401.00003 :: Verifier paper :: href="https://arxiv.org/abs/..."     <- http://ok.example kept
2401.00014 :: PDF :: href="https://arxiv.org/pdf/2401.00014"
2401.00015 :: arXiv :: href="https://arxiv.org/abs/2401.00015"
2401.00016 :: PDF :: href="https://arxiv.org/pdf/2401.00016"        <- pdfUrl null: no PDF link
2401.00016 :: Verifier paper 16 :: href="https://arxiv.org/abs/2401.00016"
2401.00021 :: PDF :: href="https://arxiv.org/pdf/2401.00021"
2401.00021 :: Verifier paper 21 :: href="https://arxiv.org/abs/2401.00021"

===== SUMMARY =====
cases=23 kept=8 dropped=15 anchors=12 mismatches=0
```

**Zero unsafe hrefs (all 12 anchors `http(s)`), zero mismatches, and every legitimate `null`
case RETAINED.** Note the deliberate asymmetry, which is correct and matches commit `7a2ed82`'s
lesson: `absUrl`/`pdfUrl` may be `null` *or absent* (kept), `primaryCategory` may be `null`
but not absent (dropped, because `PaperCard` unconditionally renders
`cat.primaryCategory === paper.primaryCategory`).

### 1f. The advisory's trap is caught by tests, not by `tsc` — important nuance

Reverting `hasSafeUrls` to the advisory's "simplified" form compiles **cleanly**:

```
R4 drop the `url == null` exemption   -> vitest 249/253 FAIL (4 failures), tsc exit 0, 0 errors
```

Four failures across `collections.test.ts` and `paperIndex.test.ts`, including the two
pre-existing IMP-151b regression tests (`keeps a paper whose absUrl is null`,
`keeps a paper whose pdfUrl is null`). The advisory is protected by runtime tests.
(Concretely: `url == null ||` with `Paper["absUrl"] = string | null` typechecks, because
`null == null` is not a "no overlap" error in TypeScript 5.6.)

### 1g. Data-loss regression guard (commit `7a2ed82`) — confirmed pre-fix control

`7a2ed82` changed `url === undefined` → `url == null`. Reverting to the pre-fix form:

```
R5 PRE-FIX CONTROL (pre-IMP-151 `url === undefined`) -> vitest 249/253 FAIL (4 failures), tsc exit 0
```

**This is my pre-fix control: my harness demonstrably detects the data-loss bug that cost real
effort.** It is caught at runtime.

---

## 2. AC1 — does the new type declaration match reality?

### The producer, read directly (`scripts/build_index.py:104-121`)

```python
def record_from_result(result, abstract_chars=DEFAULT_ABSTRACT_CHARS):
    """Build the public record shape from an ``arxiv.Result``-like object."""
    abstract, truncated = truncate_abstract(
        getattr(result, "summary", ""), abstract_chars
    )
    return {
        "id": arxiv_id_from_entry(getattr(result, "entry_id", "")),
        ...
        "primaryCategory": getattr(result, "primary_category", None),   # :118
        "absUrl": getattr(result, "entry_id", None),                    # :119
        "pdfUrl": getattr(result, "pdf_url", None),                      # :120
    }
```

Traced exhaustively:

| TS field | producer expression | can emit `str` | can emit `None` | intermediate transform? |
|---|---|---|---|---|
| `primaryCategory` | `getattr(result, "primary_category", None)` | yes | **yes** (attr missing, or the library returns `None` for a result with no primary) | none |
| `absUrl` | `getattr(result, "entry_id", None)` | yes | **yes** | **none** — raw, *not* passed through `arxiv_id_from_entry` |
| `pdfUrl` | `getattr(result, "pdf_url", None)` | yes | **yes** | none |

- Every one of the three uses `getattr(..., None)` with **no `or ""` fallback** — unlike `id`
  (`:110`), `title` (`:111`) and `authors` (`:112`), which default to `""`/`[]`. That contrast
  is the whole reason the old `string` declarations were wrong.
- `absUrl` is the **raw `entry_id`**, including the `http://arxiv.org/abs/<id>v<N>` version
  suffix — `arxiv_id_from_entry` strips the version but is applied only to `id`
  (`build_index.py:66-79`). Confirmed against live data: every `absUrl` in
  `web/public/data/papers-2026-W40.json` ends in `v1`.
- No later stage rewrites them. `write_index` (`build_index.py:293-310`) is a bare
  `json.dump(shard, …)`; `dedupe_records` only does `dict(record)`; the only other writes to
  those keys are the manifest's *category list*. So the JSON on disk is exactly this dict.
- **Never a number or an object** by construction (values come from XML attribute parsing), so
  `string | null` is not missing a member. A hypothetical non-string would be *dropped* at
  import, not crash: `isHttpUrl(123)` → `String(123).trim()` → no scheme → `false`. Correct.

**Conclusion: `primaryCategory/absUrl/pdfUrl: string | null` is exactly what the producer can
emit. AC1 met.** The key is also never omitted — `record_from_result` always emits all 11 keys,
so the types are correctly *non-optional* for the shard path.

### Corroboration from live data (this is why the old types "worked")

```
web/public/data/papers-2026-W40.json  papers: 2812  distinct key sets: 1
    ('absUrl','str') 2812  ('pdfUrl','str') 2812  ('primaryCategory','str') 2812
```

2812/2812 are `str`, so no live shard ever exercises a `null`. The fix is a correctness fix for
a *reachable* value (verified via the import path and via the producer's `getattr` fallbacks),
not a fix for an observed symptom. The implementer's report §5 states this honestly.

### Gap reported (not a failure; deferred to IMP-098)

**An absent key is not an explicit `null`, and `Paper` does not admit `undefined`.** Through
`parseExportPayload` the app genuinely holds `absUrl === undefined` / `pdfUrl === undefined`
for an imported payload with those keys missing (I proved this: the `absent-key` rows above are
KEPT, and `hasSafeUrls` relies on `url == null` catching `undefined`). The declared type
`string | null` is therefore *narrower than the import path can produce* — the same class of
type-lie this item was opened to remove, just smaller.

- Why it does not fail AC1: AC1 is scoped to "does the type match what the *producer* emits",
  and the producer always emits all keys. Per the task instruction and `FEATURES.md:2012-2023`,
  field-level runtime validation is IMP-098 (`paperIndex.ts:90-91` bare cast, shard shape
  checks).
- Residual risk if unaddressed: a future `paper.absUrl.length` or `.slice()` would typecheck
  against `string` yet throw at runtime on an imported paper with the key absent.
- Recommended follow-up (IMP-098 or a one-line amendment here): `absUrl: string | null | undefined`
  and `pdfUrl: string | null | undefined`, or an explicit comment at `types.ts:22-23` recording
  that the import path can produce `undefined` and that `safeHref`'s `| undefined` is deliberate.
  Do **not** add `| undefined` to `primaryCategory` — `isPaper` deliberately rejects absent there.

---

## 3. AC2 — consumer behaviour

### `PaperCard` renders no `href` of `null`, and `null` `pdfUrl` omits the PDF link

Measured in the real browser (imported collection, live DOM):

| paper | `pdfUrl` | `absUrl` | `primaryCategory` | title link | arXiv link | PDF link |
|---|---|---|---|---|---|---|
| 1 | `null` | http | cs.CV | yes | yes | **absent** |
| 2 | http | `null` | cs.CV | **no (span)** | n/a | yes |
| 3 | `null` | `null` | `null` | no | n/a | n/a (0 anchors) |
| 4 | http | http | `null` | yes | yes | yes |

Aggregate DOM audit of that collection: `totalAnchors: 8`,
`unsafeHrefs: ["#main"]` (the skip-to-content fragment, not a paper link),
`anchorsMissingHref: 0`, `emptyTextAnchors: 0`.

- No `href` is ever the string `"null"`, and no empty/broken anchor is emitted — the conditional
  at `PaperCard.tsx:79-82` omits the whole `<a>` when `pdfHref` is `undefined`, so there is no
  "empty PDF button" to click.
- **Nothing throws.** `PaperCard.tsx:83` dereferences `paper.abstract.length` and `:63`
  `paper.authors.join` — both safe here because `isPaper` (`collections.ts:91-102`) validates
  `abstract`, `authors`, `title`, `categories` and `published`.
- **`null` does not cascade into a blank card.** Paper 3 (all three null) still renders title,
  `Jan 7, 2024`, `Ada Lovelace, Alan Turing`, both chips, the abstract and the
  `Abstract truncated — view the full text on arXiv.` note — with **no anchors at all**. Its
  `safeHref` calls return `undefined` on all four sites and each anchor site is conditional, so
  no `null` reaches `href`. **AC2 met.**

(Out-of-scope observation, pre-existing and unchanged by this diff: a `published` of
`2024-01-08` renders as `Jan 7, 2024` because `new Date("2024-01-08")` is UTC midnight
formatted in local time. Same in the baseline screenshots. Not an IMP-019 regression.)

### Category chips with a `null` `primaryCategory`

`PaperCard.tsx:85-91` renders `{paper.categories.map(...)}` and marks primary with
`cat === paper.primaryCategory`. With `primaryCategory: null` and `categories: ["cs.CV","cs.LG"]`,
`cat === null` is false for every string chip → **no chip is falsely promoted to primary**. I
confirmed this in the live DOM: paper 4's chips both report `primary: false`, paper 1's report
`cs.CV → primary: true`. The `map` iterates `categories`, never the nullable field, so a `null`
primary cannot leak a chip label or a comparison that throws.

### Does a `null` `primaryCategory` change filter semantics? (`App.tsx:353-365`) — **No.**

`activeCategories` is a `string[]` (`App.tsx:313`), and `Set.prototype.has` uses SameValueZero,
so `active.has(null)` is **always `false`**. The new guard is therefore a *type-level* change
with zero behavioral delta — I proved this rather than arguing it:

```
BASELINE                      vitest 253/253, tsc exit 0, 0 errors
REVERT App.tsx null-guard     vitest 253/253, tsc exit 2, 1 error     <- runtime no-op
RESTORED                      vitest 253/253, tsc exit 0, 0 errors
```

The spec's `med` risk on this point is **not realised**: a null-primary paper is neither
"specially included" nor "dropped from all views". It matches through its own `categories`
clause, which is the correct behavior — arXiv always supplies a non-empty `categories` list, and
`isPaper` enforces `Array.isArray` with string members, so the paper cannot be filtered into
oblivion. Live confirmation with real data:

```
#q=diffusion                       -> 168 papers match
#q=diffusion&cat=cs.LG             ->  77 papers match, every visible card carries a cs.LG chip
#q=diffusion&cat=cs.CV,cs.NOPE     ->  notice "Unknown category: cs.NOPE. …"; 77 papers match
   "Keep only indexed categories"   -> hash becomes #q=diffusion&cat=cs.CV, 0 alerts, 77 papers
```

A `null` primary also never produces a spurious unknown-category notice (nothing writes
`cat=` for it), which `App.categories.test.tsx` asserts in
`reports no unknown category, because null is not a named one`.

---

## 4. AC3 — test honesty (both claims reproduced in my own `/tmp` copies)

Scratch: `/tmp/rpf-verify/web-scratch` (rsync of `web/`, `node_modules` symlinked, baseline
253/253). Reverts applied programmatically, restored afterwards, `tsc --noEmit` + `vitest run`
each time.

```
EXPERIMENT                                             vitest(pass/total)   tsc rc   tsc errors
----------------------------------------------------------------------------------------------------
BASELINE (as landed)                                   253/253             0        0
R1 revert isPaper -> typeof === "string"               250/253  FAIL(3)    0        0
R2 revert the 3 type decls to `string`                 253/253  PASS       2        15
R3 narrow isHttpUrl param unknown -> string            253/253  PASS       2        1
R4 ADVISORY TRAP: drop the `url == null` exemption     249/253  FAIL(4)    0        0
R5 PRE-FIX CONTROL: `url === undefined` (pre-7a2ed82)   249/253  FAIL(4)    0        0
R6 full trap: isHttpUrl->string AND safeHref->(string|undefined)
                                                     253/253  PASS       2        3
RESTORED (as landed)                                   253/253             0        0
```

**Claim 1 — "reverting `isPaper` fails 3 tests at runtime": CONFIRMED, exactly 3** (2 in
`collections.test.ts` — the absent-`primaryCategory` and localStorage-round-trip cases — and 1
in `paperIndex.test.ts`).

**Claim 2 — "reverting the types fails `tsc` (15 errors) but NOT vitest": CONFIRMED, exactly
15 errors and 0 test failures.** The 15 span the 3 declaration sites, `App.tsx:360`,
`PaperCard.tsx:45/69/70`, and the `null`-typed fixtures in `paperCardNullUrls.test.tsx` and
`App.categories.test.tsx`.

Claim 3 ("narrowing `isHttpUrl` fails `tsc` with exactly 1 error") also CONFIRMED.

### Is `tsc`-only pinning of the types adequate? — Yes, with one honest caveat

- **The CI gate is real.** `.github/workflows/ci.yml:35-38` runs `npm ci`, `npm run typecheck`,
  `npm test` on Node 20. Reverting the types breaks CI. `npm run build` also front-runs
  `tsc --noEmit` (`web/package.json:7`), so it breaks there too. The narrowing is enforced
  everywhere `tsc` runs.
- **The *behavior* is not `tsc`-only — it is pinned at runtime.** I verified the render guard
  is genuinely test-pinned, independent of the type declarations:
  ```
  R7  safeHref loses isHttpUrl (nullish-only pass-through)  -> 252/253 FAIL (1)
      x paperCardNullUrls :: …keeps a url that is only unsafely absent-safe when it is a real http url
  R7b safeHref becomes String(url) (null -> "null" -> href)  -> 247/253 FAIL (6)
      x paperCardNullUrls :: 6 of the 7 new tests
  ```
  So the new runtime tests do pin null-handling at the render layer. Combined with §1f (4
  failures if the import exemption is removed) and §1g (4 failures at the pre-`7a2ed82` state),
  the null-handling behavior is pinned by **tests**, and the type declarations by **`tsc`**.
- **Caveat, stated plainly:** the *types themselves* are pinned by `tsc` alone, and the
  `App.tsx:360` guard is likewise a runtime no-op (§3) — the four new `App.categories.test.tsx`
  tests characterize null-primary filtering but would pass with or without that guard. Those
  four tests are honest characterization tests, not new pins. Nothing is *broken*; a reviewer
  should not credit them as extra enforcement.

### Test-file integrity

```
git diff --numstat -- web/
 17  0  src/App.tsx
  4  1  src/components/PaperCard.tsx
 18  0  src/lib/collections.ts
  3  3  src/lib/types.ts
  7  0  src/__tests__/App.categories.test.tsx
  0  0  src/__tests__/paperCardNullUrls.test.tsx   (new file)
 26  0  src/lib/__tests__/collections.test.ts
 13  0  src/lib/__tests__/paperIndex.test.ts
```

**Every test-file diff is purely additive — 0 deletions.** No `.skip`, `.todo`, or `.only` anywhere
in `web/src` (the only regex hits were the CSS class `skip-link` and `ErrorBoundary`'s prose).

Name-level diff (HEAD `237` vs working tree `253`, matched on `file::fullName`):

```
HEAD baseline : total=237 passed=237 files=15
WORKING TREE : total=253 passed=253 files=16
PRE-EXISTING NAMES LOST: 0
NEW NAMES: 16
  paperCardNullUrls.test.tsx  +7   (new file)
  App.categories.test.tsx    +4   (null-primary filtering)
  collections.test.ts        +7   (1 in "producer-null primaryCategory", 6 in "paper fields PaperCard dereferences are validated")
  paperIndex.test.ts         +1   (producer-null url fields on a shard)
```

**All 237 pre-existing test names survive; none weakened, skipped, or deleted.** AC3 met.

---

## 5. Regression check across landed items

Every landed item's test names survive and pass (§4 name diff). Spot-exercised beyond the unit
suite:

- **IMP-001 (hostile URLs on import)** — re-exercised live and in the payload table: all
  `javascript:`/`data:`/`vbscript:`/protocol-relative/whitespace variants dropped, siblings kept.
- **IMP-007 / IMP-009 / IMP-010** — live: unknown-category notice renders with exactly one
  control, "Keep only indexed categories" rewrites the hash and clears the alert; the explicit
  empty selection shows `No categories selected` + `Select all categories`, which restores
  `168 papers match`. Pinned by 21 `App.categories.test.tsx` + 7 `App.retry.test.tsx` tests.
- **IMP-015 / IMP-016 (partial-shard, load-failure, storage notices)** — 9 + 26 + 8 tests pass,
  including both "two distinct alerts" coexistence cases and all three IMP-018 storage tests.
- **IMP-017 (reader-facing copy)** — 8 `failureCopy.test.ts` + the 17 copy tests inside
  `App.loadFailure.test.tsx` pass.
- **IMP-018 (error boundary)** — 11 `errorBoundary.test.tsx` tests pass.
- **Save-failure banner + cold-boot fix** — `App.storage.test.tsx` 8/8, including
  `a cold boot with nothing saved writes nothing, so there is no save to have failed`.

**Live feed sanity** (`npm run preview`, real shards): `2,812 papers match`, 50 cards rendered,
202 anchors, 0 unsafe hrefs (only the `#main` skip link). Category filter 168 → 77 with
`cat=cs.LG`, every visible card carrying the chip. **Zero console messages of any kind** (no
errors, no warnings) across the whole session.

**One pre-existing flake found (NOT introduced by IMP-019).** Under `vitest --sequence.shuffle`
I hit `App.loadFailure.test.tsx :: …coexists with the unknown-category banner as two distinct
alerts` — `expected [ <p>… ] to have a length of 2 but got 1`. Attribution by running the same
shuffled harness against a clean `git archive HEAD` checkout:

```
working tree : 23 shuffled runs -> 2 failures
HEAD baseline: 12 shuffled runs -> 1 failure   (same test, same file)
```

Same rate, same test, present at HEAD — a latent order dependency in IMP-016's test
(`App.loadFailure.test.tsx:899-912` awaits only the *first* `findByRole("alert")` then asserts
`getAllByRole("alert")` has length 2, so a slow second alert loses the race). **Out of scope for
IMP-019, not caused by it, and it does not fire in the shipping gate** (0/14 plain `npm test`
runs, below). Worth a follow-up item.

---

## 6. Flake check

```
for i in $(seq 1 14); do npm test; done      ->  run 1..14: "Test Files 16 passed (16)" / "Tests 253 passed (253)"
```

**14/14 PASS, 0 failures** (implementer claimed 14/14 — reproduced exactly).
Plus 3+8+12 = **23 shuffled-order runs, 2 failures**, both the pre-existing `App.loadFailure`
race attributed to HEAD in §5.

**Pre-fix control under my harness:** R5 in §4 — reverting `url == null` to the pre-`7a2ed82`
`url === undefined` produces 4 hard failures under plain `npm test`, so my harness would have
caught that data-loss regression. The harness is sensitive, not merely green.

---

## 7. Required commands — exact output

```
$ cd web && npm run typecheck
> research-paper-feed-web@0.1.0 typecheck
> tsc --noEmit
typecheck exit=0

$ npm test
> vitest run
 Test Files  16 passed (16)
      Tests  253 passed (253)
   Start at  12:07:11
   Duration  661ms

$ npm run build
> research-paper-feed-web@0.1.0 build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 41 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.51 kB
dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-D7spZXJu.js   171.45 kB │ gzip: 54.92 kB
✓ built in 395ms
```

**253 tests / 16 files — exactly as expected. typecheck clean. build clean.**

---

## 8. Playwright (real browser, `npm run preview` on :4173)

Server started from `web/`, driven via the real `<input type="file">`
(`CollectionsView.tsx:213-222`) with the crafted payload delivered as a `File` through a
`DataTransfer` + `change` event (same `FileReader` → `JSON.parse` → `parseExportPayload` path a
real picker takes; the file chooser API was not reachable from the MCP client). Cold-booted first
(`localStorage.clear()`), so this also exercised IMP-018's cold-boot save path: no false banner.

19 papers sent → collection header reads **`Verifier null urls (4)`**: 15 hostile/empty dropped,
**4 legitimate-null papers retained — no data loss.** Live DOM: `totalAnchors: 8`,
`unsafeHrefs: ["#main"]`, `anchorsMissingHref: 0`, `emptyTextAnchors: 0`.
**Console: zero messages.**

Screenshots in `.improve/artifacts/IMP-019/`:

| file | size | content |
|---|---|---|
| `feed-null-pdfurl-desktop-1280.png` | 1280x900 | **spec-required name** — imported collection; paper 1 shows `arXiv` and **no PDF link**, paper 2 shows a non-link title and only `PDF` |
| `feed-null-pdfurl-fullpage-desktop-1280.png` | 1280x1693 | all four cards, including the all-null paper with no anchors |
| `feed-null-pdfurl-mobile-390.png` | 390x2266 | 390px layout, same four cards, no broken/empty anchors |
| `feed-real-data-desktop-1280.png` | 1280x900 | real feed, 2,812 papers |

Compared against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` (also 1280x900):
identical header, filter panel, card chrome, chip and button styling. The only differences are
the intended ones (paper titles/dates/counts) — no layout or styling drift. The mobile shot
matches `baseline-collections-mobile-390.png` in structure. **Server stopped.**

---

## 9. Findings summary

**Met: 3/3 criteria. Advisory intact. No blocking issue.**

| # | Severity | Finding | Location | Action |
|---|---|---|---|---|
| 1 | LOW | `Paper.absUrl`/`pdfUrl` typed `string \| null`, but `parseExportPayload` genuinely produces `undefined` for an absent key. The declaration is narrower than the import path can yield — the same class of type-lie this item removed, smaller. | `web/src/lib/types.ts:22-23` | Add `\| undefined`, or a comment recording that `safeHref`'s `\| undefined` is deliberate because of the import path. Do **not** add it to `primaryCategory` (absent is rejected by design). Belongs with IMP-098. |
| 2 | INFO | `App.tsx:360`'s null guard is a **runtime no-op** (`Set.has(null)` is always false); the 4 new `App.categories.test.tsx` tests pass with or without it. They are honest characterization tests, not new pins; the guard is pinned by `tsc` alone. | `web/src/App.tsx:360-361` | None. Documented so a future reviewer does not credit them as enforcement. |
| 3 | INFO | `types.ts:15-16` cites "arxiv 4.x types `Result.pdf_url` and `Result.entry_id` as `str \| None`". `arxiv` is **not installed** in this environment and `requirements.txt:1` is `arxiv>=2.1.0` with no upper bound, so the citation cannot be checked here and the repo could run 2.x. The **declaration** is correct regardless (both fallbacks are `getattr(…, None)`). | `web/src/lib/types.ts:14-19` | Soften to "the arxiv client leaves these unset for some results" or pin the library version. Documentation only. |
| 4 | INFO | `paperIndex.test.ts:16` comment says the declarations are at `types.ts:24-26`; they are at **21-23**. | `web/src/lib/__tests__/paperIndex.test.ts:16` | Fix the line reference when convenient. |
| 5 | OUT OF SCOPE | Pre-existing order-dependent flake in IMP-016's test: `await findByRole("alert")` then `getAllByRole("alert)` `toHaveLength(2)` races. 1/12 shuffled runs at HEAD, 2/23 with IMP-019 (same rate, same test). 0/14 in the shipping harness. | `web/src/__tests__/App.loadFailure.test.tsx:899-912` | Separate follow-up item: `await waitFor(() => expect(getAllByRole("alert")).toHaveLength(2))`. **Not caused by IMP-019.** |

The implementer's report was accurate on every claim I checked, including its §4 self-correction
that the advisory's premise about `safeHref` was wrong.