# IMP-154 — implementation report

**Item:** `IMP-154` — Validate `categories` and `published` in `isPaper` so a malformed export
cannot blank the app (`.improve/FEATURES.md:224-240`).
**Status:** implemented, all 5 acceptance criteria met. Commit: none (implementers do not commit).
**Retry:** no — `.improve/reports/verify-IMP-154.md` did not exist at start.

---

## 1. Files changed

| File | Change | Size |
| --- | --- | --- |
| `web/src/lib/collections.ts` | `isPaper` gains 4 checks + a rationale doc comment | +15 / −1 (diff: 1 file, 15 insertions, 1 deletion) |
| `web/src/lib/__tests__/collections.test.ts` | 2 new `describe` blocks, 10 new tests, no existing line touched | +243 / −0 |
| `web/src/__tests__/malformedImport.test.tsx` | **new** DOM regression file, 5 tests | 5,066 bytes |

`git diff --stat -- web/src/lib/collections.ts web/src/lib/__tests__/collections.test.ts` →
`257 insertions(+), 1 deletion(-)` across 2 files. **No pre-existing expectation was weakened or
removed** — every one of the 25 existing `collections.test.ts` tests still passes byte-identically,
and `collections.ts` has exactly one deleted line (the trailing `&&` of the last old check).

Nothing else was touched. No `App.tsx`, no `PaperCard.tsx`, no `paperIndex.ts`, no `scripts/**`,
no `styles.css`, no `FEATURES.md`, no `package.json`/`package-lock.json`. No git write commands.

## 2. The code change

`web/src/lib/collections.ts:68-93` — `isPaper` is the single gate between an untrusted file and the
renderer (`parseExportPayload:257` filters with it; `loadState:299` filters stored snapshots with it).

```ts
    typeof paper.abstract === "string" &&
+   Array.isArray(paper.categories) &&
+   paper.categories.every((category) => typeof category === "string") &&
+   typeof paper.primaryCategory === "string" &&
+   typeof paper.published === "string"
  );
```

Deliberately unchanged, per criterion 1: the four existing checks (`id`, `title`, `authors`,
`abstract`) and the `PROTOTYPE_KEYS` id check at `:85` (IMP-151). Also unchanged: `absUrl`/`pdfUrl`
stay out of `isPaper` — IMP-001's `hasSafeUrls` owns them, and the producer emits `null` for those.
A doc comment above the function records the why (no error boundary above `<App />`) and states that
the strictness is bounded by a measurement, not an assumption.

### Why `PaperCard.tsx` was **not** touched

The task allowed a minimal `PaperCard.tsx` edit; the spec does not ask for one. `FEATURES.md:240`
assigns point-of-use guards to **IMP-160** ("The point-of-use guards that would make this class of bug
a degraded card rather than a blank page are IMP-160") and explicitly rules out IMP-018. Adding a
`paper.categories?.map` guard inside `PaperCard` would (a) widen scope past all 5 criteria, (b) mask
rather than remove the defect — the malformed snapshot would still be stored in `localStorage`, and
(c) pre-empt IMP-160's item. The feed path (papers arriving over the network) is likewise untouched;
that is IMP-098's surface, per the same Notes line. `App.tsx` was not touched per my instructions.

### Blast radius actually removed

`PaperCard.tsx:79` `paper.categories.map(...)` → `TypeError: Cannot read properties of undefined
(reading 'map')`, and with no error boundary above `<App />` (`main.tsx:12-15`) the whole tree unmounts.
Reproduced verbatim in the non-vacuity run below (§5.2): the DOM tests fail with that exact message
and `container.children.length === 0` is the state they now prevent. `PaperCard.tsx:73`
(`formatDate(paper.published)`) does not throw on a missing value — it returns the raw input via the
`Number.isNaN` branch — but it rendered `undefined`; `PaperCard.tsx:82` (`paper.primaryCategory`)
cannot throw either. Both are now rejected at the gate, as criterion 1 requires.

## 3. What the real producer emits vs. what is now validated

`record_from_result` (`scripts/build_index.py:99-116`) builds the record with `getattr(..., default)`
for every field, so three of the four newly-validated fields *can* degrade rather than raise:

| Field | Producer expression | Can it be missing/null? | Now validated as |
| --- | --- | --- | --- |
| `categories` | `list(getattr(result, "categories", []) or [])` (`:112`) | **No** — the `or []` plus `list()` guarantees an array | `Array.isArray` + every element a string |
| `published` | `iso_date(getattr(result, "published", None))` (`:110`) | **Yes** — `None` → `iso_date` returns `None` (`build_index.py:80-82`) | `typeof === "string"` |
| `primaryCategory` | `getattr(result, "primary_category", None)` (`:113`) | **Yes** — a `Result` without it yields `None` | `typeof === "string"` |

So `published`/`primaryCategory` validation *is* stricter than the producer's worst case: a record
with an absent `published` would now be dropped at import instead of rendered with a broken date.
That is what criterion 1 asks for and it is the right trade — `PaperCard` cannot render such a record
meaningfully — but it is a real behaviour change worth naming.

**Measured, not assumed.** Sweep of every record in the two shards on disk
(`web/public/data/papers-2026-W39.json`, `papers-2026-W40.json`; generated `2026-10-02T02:44:04Z`):

```
papers-2026-W39.json: 263 papers
papers-2026-W40.json: 2549 papers
TOTAL papers: 2812
field types: { "published": {"string": 2812}, "primaryCategory": {"string": 2812},
              "categories": {"string[]": 2812}, "abstractTruncated": {"boolean": 2812},
              "absUrl": {"http://": 2812} }
papers missing any of the 11 keys: 0 []
```

Zero records are affected. Note the real index emits `http://arxiv.org/abs/…` for `absUrl`
(`build_index.py:114`), which IMP-001's `isHttpUrl` accepts by design; that is why I did not extend
the new checks to URLs.

**End-to-end sweep through the real code path.** A temporary test
(`web/src/__tests__/zz-temp-sweep.test.ts`, created → run → **deleted**; not in `git status`) drove
`parseExportPayload` and `loadState` with all 2,812 real records:

```
W40 2549 W39 263 TOTAL 2812
parseExportPayload kept 2812 rejected 0
loadState kept 2812 papers; 2812 ids
 Test Files  1 passed (1)
      Tests  3 passed (3)
```

**Zero rejections against the real index** — criterion 3 satisfied, measured.

## 4. Tests added

`web/src/lib/__tests__/collections.test.ts` — two new blocks, 10 tests, appended at EOF:

- `"paper fields PaperCard dereferences are validated"` (8 tests): a table of 6 malformed shapes —
  `categories` absent, `published` absent, `categories` a bare string, `categories` containing a
  number, `primaryCategory` absent, `published` a number. Each is dropped, each keeps a
  fully-populated valid sibling, the merged `paperIds` is exactly `[sibling]`, and `Object.keys` of
  the merged `papers` is exactly `[sibling]`. Every payload is round-tripped through
  `JSON.parse(JSON.stringify(…))` first, because `published: undefined` must become an *absent* key,
  which is the real import shape. Plus: a payload whose papers all fail returns `papers: []` and a
  non-null payload with `paperIds: []` (criterion 2); and a `loadState` case where a stored snapshot
  missing `categories` is dropped on reload while its sibling survives.
- `"real producer records are never rejected"` (2 tests): four records copied **verbatim** out of
  the two real shards — the multi-category cross-listed `cs.CV/cs.AI/cs.HC/cs.LG` paper with a
  truncated abstract, the short untruncated one whose `primaryCategory` is `nlin.CD` (not `cs.*`),
  the `et al.`-capped 9-author paper, and the single-category `cs.RO` paper. Asserted to survive
  `parseExportPayload` unchanged and to survive a `MemoryStorage` round trip.

`web/src/__tests__/malformedImport.test.tsx` (new, 5 tests) — the DOM regression the task asked for.
Renders through `PaperList`/`PaperCard` into a `div#root` appended to `document.body`, mirroring how
`App` mounts, and asserts the verifier's own metric (`container.children.length > 0`) plus
`article.paper` count and title text:

- 3 tests: an import whose paper omits `categories` / omits `published` / has `categories` as a
  string still leaves the tree mounted with exactly the valid sibling's card.
- 1 test: no snapshot that survives import is missing a field `PaperCard` dereferences unguarded
  (the durable invariant — it survives a future IMP-160 point-of-use guard).
- 1 test: a snapshot already in storage from before this fix is dropped by `loadState` and the view
  still renders.

`MemoryStorage` is duplicated locally in the DOM file rather than imported from
`collections.test.ts`: importing a `*.test.ts` file re-registers its `describe` blocks, which would
duplicate 35 tests. The duplication is called out in a one-line comment.

## 5. Commands, with exact results

Baseline before any of my edits, measured at 02:13:42 (profile §3.3 records the same 5 files / 69
tests):

```
cd web && npm test
 Test Files  5 passed (5)
      Tests  69 passed (69)
```

### 5.1 After the change

```
cd web && npm run typecheck        → exit 0, no output (tsc --noEmit)
cd web && npm test
 ✓ src/lib/__tests__/urlState.test.ts (18 tests) 11ms
 ✓ src/lib/__tests__/paperIndex.test.ts (14 tests) 12ms
 ✓ src/lib/__tests__/collections.test.ts (35 tests) 7ms
 ✓ src/lib/__tests__/search.test.ts (12 tests) 7ms
 ✓ src/__tests__/malformedImport.test.tsx (5 tests) 51ms
 ✓ src/__tests__/domEnvironment.test.tsx (3 tests) 135ms
 ✓ src/__tests__/App.retry.test.tsx (5 tests) 224ms
 Test Files  7 passed (7)
      Tests  92 passed (92)
   Duration  1.56s
cd web && npm run build
 ✓ 39 modules transformed.
 dist/index.html                   1.00 kB │ gzip:  0.51 kB
 dist/assets/index-G-YE6pVt.css   10.93 kB │ gzip:  2.86 kB
 dist/assets/index-Y0hD1buQ.js   164.59 kB │ gzip: 52.83 kB
 ✓ built in 362ms
```

Reconciliation of 69 → 92: **+15 mine** (25 → 35 in `collections.test.ts`, +5 in the new DOM file)
and **+8 the concurrent IMP-007 agent's** (`paperIndex.test.ts` 11 → 14, `App.retry.test.tsx` +5).
No failures, in my files or anywhere else.

Bundle: JS 164.59 kB vs the profile's recorded baseline 163.72 kB. **The +0.87 kB is not mine** — my
change adds no export and its four predicates sit inside an existing function, so the minifier
emits nothing new; the delta comes from the IMP-007 agent's retry panel in `App.tsx` (its own
in-flight file). CSS is byte-identical to baseline at 10.93 kB / gzip 2.86. I did not isolate this
by reverting a peer's file, and I am not claiming the figure is a clean IMP-154 delta.
`ls web/dist/data` → `index.json`, `papers-2026-W39.json`, `papers-2026-W40.json` (profile trap 7
checked).

### 5.2 Non-vacuity — the new tests fail without the fix

Done in a scratch copy, repo untouched. `git archive HEAD web` → `/tmp/imp154-vacuity`, then the
working-tree copies of `App.tsx`, `paperIndex.ts`, `paperIndex.test.ts`, `collections.test.ts`,
`malformedImport.test.tsx`, `App.retry.test.tsx` laid over it, and **only**
`src/lib/collections.ts` restored from HEAD. The diff between the two `collections.ts` files was
inspected first and is exactly the 4 checks + the doc comment — nothing else differs.

```
cd /tmp/imp154-vacuity/web && npx vitest run src/lib/__tests__/collections.test.ts src/__tests__/malformedImport.test.tsx
 × …drops a payload paper with no categories and keeps the valid sibling
 × …drops a payload paper with no published and keeps the valid sibling
 × …drops a payload paper with categories as a string and keeps the valid sibling
 × …drops a payload paper with categories with a non-string and keeps the valid sibling
 × …drops a payload paper with no primaryCategory and keeps the valid sibling
 × …drops a payload paper with published as a number and keeps the valid sibling
 × …returns an empty papers array, never null, when every paper fails
 × …drops a stored snapshot that is missing categories on reload
 × …keeps the tree mounted when an imported paper omits categories
 × …keeps the tree mounted when an imported paper omits published
 × …keeps the tree mounted when an imported paper has categories as a string
 × …leaves no snapshot that PaperCard would dereference unguarded
 × …survives a stored snapshot that predates the validation
TypeError: Cannot read properties of undefined (reading 'map')
 Test Files  2 failed (2)
      Tests  13 failed | 27 passed (40)
```

**13 of my 15 new tests fail**, with the exact `TypeError` the spec quotes from `PaperCard.tsx:79`.
The 2 that pass under both versions are the two real-record guard tests — correct, since they assert
*no over-rejection* and must hold before and after. `/tmp/imp154-vacuity` has been deleted.

## 6. Deviations, uncertainties, and things a verifier should know

1. **Criterion 3 cannot be tested against the committed shard — no shard is committed.**
   `web/public/data/` is gitignored (root `.gitignore:12`, `web/.gitignore:7`; profile §3.4 says there
   is no committed example of the wire format anywhere). The spec's phrase "the committed
   `web/public/data/papers-2026-W40.json`" is wrong. I did **not** commit a fixture and did **not**
   add an unconditional `import … from "../../public/data/…"`, which would fail `tsc --noEmit` and
   `vite build` in CI where the directory does not exist.
2. **A test also cannot read the shard at runtime.** `web/tsconfig.json:13` is `"types": ["vite/client"]`
   and `@types/node` is not a dependency, so `import … from "node:fs"` is `TS2307: Cannot find module
   'node:fs'` (measured). Separately, under Vitest `import.meta.url` is an `http://` URL, so
   `fileURLToPath(new URL(…, import.meta.url))` throws `TypeError: The URL must be of scheme file`.
   Both were tried and removed. Hence: a 4-record verbatim fixture in the committed test + the
   throwaway 2,812-record sweep in §3 for the measured number.
3. **The number 2,812 belongs to both shards, not to W40.** `papers-2026-W40.json` holds **2,549**
   papers; 2,812 is `index.json`'s `totalPapers` and the sum of W40 + W39 (263). Both are reported.
4. **Residual data-loss surface, stated plainly.** `isPaper` also gates `loadState`, so a snapshot
   already in a user's `localStorage` that lacks `categories`/`published`/`primaryCategory` is now
   dropped on load instead of crashing the view. Such a snapshot cannot be produced by this app —
   `exportCollection` copies whole `Paper` snapshots that came from the index — only by a
   hand-edited `localStorage` value. Dropping is strictly better than the blank page it replaces, but
   it is silent (IMP-059's reporting gap, criterion 2 accepts this).
5. **`isPaper` is still not a full-schema check**, by design and by spec. `authors` elements are not
   type-checked (only `Array.isArray`), `updated` and `abstractTruncated` are unvalidated. None of
   them can blank the app today (`authors.join` stringifies, `abstractTruncated` is a truthiness
   test, `updated` is never read — WEB-11). Recorded in `discovered-IMP-154.md`.
6. **No browser/Playwright pass.** Profile §4.2's visual row applies to `components/**`; I changed no
   component, so §4.1's row applies and I ran typecheck + test + build. The DOM regression is covered
   by `@testing-library/react` assertions instead, including the `container.children.length > 0`
   metric the spec's verification method uses. No screenshot was taken; `.improve/artifacts/` is
   untouched. If a verifier wants the spec's
   `.improve/artifacts/IMP-154/collections-import-missing-categories-desktop-1280.png`, that is a
   manual step.
7. **`jsdom@29` under Node v25.6.1 has a broken `window.localStorage`** (`setItem is not a function`;
   Node prints `Warning: --localstorage-file was provided without a valid path`). It is not mine and
   I did not fix it, but it forced my DOM file to use a `Storage` fake like `collections.test.ts`
   already does. Details in `discovered-IMP-154.md`.
8. **`REPO_PROFILE.md` is now stale in two places** and I was not permitted to edit it: the WEB-20
   row's "Residual" clause (`isPaper` still does not validate `categories`/`published`, so a
   malformed export still blanks the whole app) is closed by this item, and §10's fixed list needs an
   IMP-154 row. §7's baseline line ("vitest 69/69 across 5 files") is also stale for reasons
   predating me.