# Splitting urlState: IMP-008 staged, IMP-009 left uncommitted

`web/src/lib/urlState.ts` and `web/src/lib/__tests__/urlState.test.ts` were changed
by two concurrent agents. This pass rebuilds both from the pristine HEAD copies in
`/tmp/imp-split/`, keeps only IMP-008, verifies, stages, then restores the combined
working tree so IMP-009 stays present-but-uncommitted.

## `web/src/lib/urlState.ts` — INCLUDED (IMP-008)

Built from `urlState.head.ts`:

- the local `const query = params.get("q") ?? "";` binding inside `readHash`, with
  `query: params.get("q") ?? ""` replaced by the shorthand `query,`;
- the `sort:` normalization `query.trim() !== "" && params.get("sort") === "relevance" ? "relevance" : "newest"`
  plus its 4-line explanatory comment;
- the `writeHash` guard `state.sort !== "newest" && state.query.trim() !== ""`
  plus its 3-line explanatory comment.

## `web/src/lib/urlState.ts` — EXCLUDED (IMP-009)

- `CategoryResolution` interface;
- `resolveCategories()` and its doc comment;
- the `validCategories` parameter on `readHash` and its doc comment;
- `categories: resolveCategories(categories, validCategories).selected`.

`categories:` is left as the original HEAD expression
`rawCategories === null ? null : rawCategories.split(",").filter(Boolean)`, and no
intermediate `const categories = …` binding is introduced.

## `web/src/lib/__tests__/urlState.test.ts` — INCLUDED (IMP-008)

Built from `urlState.test.head.ts`. Tests added, verbatim from the combined copy:

- `keeps relevance only when the hash carries a search term`
- `falls back to newest when sort=relevance arrives with no query`
- `treats a blank or whitespace-only query as no query for sort`
- `omits a relevance sort that no query could justify`
- `omits a relevance sort for a whitespace-only query`
- `round-trips a relevance hash whose query was cleared away`

One existing HEAD test needed correcting: `falls back to newest for an unknown sort`
asserted `readHash("#sort=relevance").sort === "relevance"`, which is now wrong under
IMP-008. It uses the combined copy's replacement, which supplies a query so the test
still isolates the unknown-sort path:

```
expect(readHash("#q=diffusion&sort=oldest").sort).toBe("newest");
expect(readHash("#q=diffusion&sort=").sort).toBe("newest");
```

Because `readHash` in the staged version keeps its HEAD signature (one required-ish
parameter, no `validCategories`), no other adjustment was needed for the describe
blocks to compile.

## `web/src/lib/__tests__/urlState.test.ts` — EXCLUDED (IMP-009)

- the `resolveCategories` import;
- the `MANIFEST_CATEGORIES` constant and its doc comment;
- the whole `describe("resolveCategories")` block (13 tests);
- `de-duplicates a repeated category key`;
- `passes categories through untouched when the manifest is not in hand`;
- `drops categories the manifest does not list when it is supplied`;
- `keeps every category the manifest lists`;
- `leaves the other parameters alone while validating cat`;
- `round-trips a sanitized hash so the URL self-heals on the next write`.

## Trailing-newline handling

HEAD and the combined copies both end without a trailing newline. The first write of
the IMP-008-only files added one, which showed up in the staged diff as
`\ No newline at end of file` noise. The IMP-008-only content was regenerated with no
trailing newline and re-verified before staging, so the staged diff contains only the
IMP-008 changes.

## Test counts

| Step | State | Typecheck | Tests |
| --- | --- | --- | --- |
| 2 (pre-stage verify) | IMP-008 only | pass | **113 passed / 113, 9 files, 0 failures** |
| 2 (pre-stage verify) | IMP-008 only, `npm run build` | pass | built in 353ms, `index-BGhEaDsz.js` 164.59 kB |
| 6 (post-restore) | combined working tree | pass | **132 passed / 132, 9 files, 0 failures** |

`urlState.test.ts` is 24 tests in the staged (IMP-008-only) version, versus 43 in the
combined working-tree version — the 19 IMP-009 tests account for the 113 vs 132 delta.

Staged blob hashes after the final `git add`:

- `urlState.ts` → `0fefe4154111517bd39fee1f7036af940d086bcbab283b33c7145b2905c677c3`
- `urlState.test.ts` → `e0cc72896d3ce69db7a62c7fe640aaa57f75bbfeed512428d3aed9c1c0c819e2`

Both were confirmed byte-identical to the content that passed step 2, and confirmed
still identical after the combined files were copied back over the working tree, so
the restore did not disturb the index.

## End state

- `git diff --cached` for these two files: IMP-008 only (+57 / -5).
- `git diff` for these two files: IMP-009 only (+211 / -5) — `CategoryResolution`,
  `resolveCategories`, the `validCategories` parameter, `categories: resolveCategories(...)`,
  and the 19 IMP-009 tests, left uncommitted pending the missing `App.tsx` wiring.
