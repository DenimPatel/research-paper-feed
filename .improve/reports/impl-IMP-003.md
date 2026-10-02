# IMP-003 — Stop memoizing a rejected manifest promise in `PaperIndex` (implementation report)

Status: implemented. No retry was needed — `.improve/reports/verify-IMP-003.md` did not exist.

## Files changed (all under `web/`)

1. `web/src/lib/paperIndex.ts` — `PaperIndex.getManifest()` (the `manifestPromise` assignment at `:66-71`).
2. `web/src/lib/__tests__/paperIndex.test.ts` — one new test inside the existing `describe("PaperIndex")` block.

Nothing else was touched. No `web/package-lock.json` change, no dependency change, no new file
outside `web/`. `git status --porcelain` shows only those two `web/` files plus
`.improve/FEATURES.md`, which another agent is editing concurrently and I did not touch.

## Approach

### Criterion 1 — reset `manifestPromise` on rejection

`web/src/lib/paperIndex.ts:66-76` now memoizes a *handled* promise instead of the raw one:

```ts
  async getManifest(): Promise<IndexManifest> {
    if (!this.manifestPromise) {
      // Clear the memoized promise on failure so a retry refetches instead of
      // replaying the same rejection forever.
      this.manifestPromise = this.fetchManifest().catch((error: unknown) => {
        this.manifestPromise = null;
        throw error;
      });
    }
    return this.manifestPromise;
  }
```

Why this shape:

- The `.catch` rethrows, so every existing caller still sees the identical rejection — the error
  type (`IndexUnavailableError` for transport/HTTP/parse failures) and the `cause` chain are
  untouched, and the three existing error-shape tests are unmodified.
- Clearing inside the handler (rather than at the call sites) keeps `getManifest()` the single
  owner of the memo, so `loadPapers()` inherits the retry behaviour for free.
- Ordering is safe. `manifestPromise` is assigned synchronously before the promise can settle, so
  the handler always runs after the assignment; and no *new* promise can be created between the
  assignment and the clear (creation only happens when the field is `null`, and only this handler
  nulls it), so the clear can never stomp a fresher in-flight promise.
- Concurrent callers still share one in-flight request, so `StrictMode`'s double-invoke does not
  double-fetch (that is a separate concern, WEB-08).

The comment follows the repo's stated convention (rationale, not `what`); the codebase is sparsely
commented but `paperIndex.ts:82-84` already carries an equivalent rationale comment.

### Criterion 2 — new test

Added to `describe("PaperIndex")`, placed next to the other manifest-failure cases:

```ts
  it("retries the manifest after a rejection instead of memoizing it", async () => {
    const mock = vi.fn(async () => jsonResponse(MANIFEST));
    mock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", mock);

    const index = new PaperIndex();
    await expect(index.getManifest()).rejects.toBeInstanceOf(
      IndexUnavailableError,
    );
    await expect(index.getManifest()).resolves.toEqual(MANIFEST);
    expect(mock).toHaveBeenCalledTimes(2);
  });
```

It reuses the file's existing `jsonResponse()` helper, the `MANIFEST` fixture, the
`vi.stubGlobal("fetch", …)` pattern and the `afterEach(vi.unstubAllGlobals)` cleanup, so no new
fakes were written. The first `fetch` throws a `TypeError` (a transport failure, which
`fetchManifest` wraps in `IndexUnavailableError` at `:78-80`), the second returns the manifest.
Exactly two `fetch` calls is asserted, which is what makes the test fail against the old
memoization (see "regression check" below).

### Criterion 3 — existing tests unchanged

`npm test` → 39 passed. The shard-cache test (`"reports progress and caches loaded shards"`) and all
three error-shape tests are byte-for-byte unchanged; no expectation was weakened.

## Commands run (all from `web/` unless noted)

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0, no output (`tsc --noEmit`) |
| `npm test` (first pass) | `3 files, 39 tests passed` — search 12, collections 16, paperIndex 11 |
| `npx vitest run src/lib/__tests__/paperIndex.test.ts` with the fix **temporarily reverted** | `1 failed | 10 passed` — the new test fails with `IndexUnavailableError` replayed from the first rejection, proving it guards the behaviour |
| `npm run typecheck && npm test && npm run build` (final, after restoring the fix) | all exit 0; 39 tests passed; `38 modules transformed`, built in 383ms |

Baseline comparison: 38 web tests before this change, 39 after (38 + 1 new). `tsc --noEmit` clean.
Build artifacts: CSS `10.93 kB` (gzip 2.86) unchanged from baseline; JS `163.50 kB` (gzip 52.55) vs
baseline `163.17 kB` (gzip 52.40) — a +0.33 kB delta from the added `.catch` handler, no new module
and no new dependency.

## Definition of done (§4.6 of REPO_PROFILE.md)

1. `cd web && npm run typecheck && npm test && npm run build` — all clean. ✅
2. Python suite — not applicable, nothing under `scripts/` was touched. (I did not run it; the
   other agent owns `scripts/` and `tests/` and is editing them concurrently.)
3. Playwright screenshots — **not done.** Deliberate: this change has no user-visible effect on a
   healthy index, and the spec's own verification method only re-confirms that a full page reload is
   *still* required for in-app recovery, i.e. it verifies that IMP-007 has **not** landed yet. There
   is nothing new to capture that the baseline screenshot
   `.improve/artifacts/baseline/feed-index-missing-desktop-1280.png` does not already show, and no
   `web/public/data/` index was generated. A verifier wanting the artifact should treat it as a
   no-op re-capture.
4. Mirror test added alongside the behaviour change. ✅
5. `git status` shows only intended files; no new gitignored paths. ✅
6. §9 rows touched — **WEB-01** (`REPO_PROFILE.md:630`, and trap 11 at `:564-568`) is *fixed* by this
   change and needs its row updated by whoever owns `REPO_PROFILE.md` (I am not permitted to edit it).
   The second half of WEB-01 — "no retry possible, only a page reload", `App.tsx:364-376` — is
   **not** fixed: there is still no retry affordance in the UI, and the manifest effect still runs
   once with `[]` deps (`App.tsx:148-166`), so nothing in the app calls `getManifest()` a second
   time yet. That is IMP-007's scope, exactly as IMP-003's verification method anticipates.

## Uncertainty / notes for the verifier

- **Scope call:** `App.tsx:148-166` is named in the item's "Area / files", but no acceptance
  criterion asks for an `App.tsx` change, and criterion 1 scopes the fix to `manifestPromise`.
  Adding a retry button would be IMP-007 and would change visible UI (requiring screenshots), so I
  left `App.tsx` untouched. Consequence: with this change alone, an end user hitting a transient
  network error still must reload the page — the *library* is now retry-safe, the app is not yet
  wired to retry. If the verifier expects in-page recovery from this item, that is a spec/IMP-007
  question, not an omission.
- A rejected `loadPapers` that fails *after* a successful manifest is unaffected: `manifestPromise`
  stays resolved and the shard cache is untouched. WEB-02 (one bad shard discards the whole
  `Promise.all`) and WEB-12 (no manifest TTL) are deliberately not addressed here.
- `manifestPromise` remains `Promise<IndexManifest> | null`; no type change was needed, and the
  public API of `PaperIndex` is unchanged (no signature, no new export).
- No new dependency, so `web/package-lock.json` is untouched (confirmed by `git status`).
- I did not read or modify `.kilo/worktrees/mildly-income`, and ran no git write commands.