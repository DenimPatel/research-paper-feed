# Verification report — IMP-003 (independent verifier)

**Verdict: PASS.** 3/3 acceptance criteria met. No blocking issues. No defects found in
`git diff -- web/`.

Scope reviewed: `git diff -- web/` plus new untracked files under `web/`. `scripts/` and
`tests/` were ignored (IMP-002, concurrent, out of scope). `.kilo/worktrees/mildly-income`
was never read or written. No git write command was run. No source file was modified.

---

## 1. The change under review

```
$ git diff --stat -- web/
 web/src/lib/__tests__/paperIndex.test.ts | 13 +++++++++++++
 web/src/lib/paperIndex.ts                |  7 ++++++-
 2 files changed, 19 insertions(+), 1 deletion(-)
```

`git status --porcelain --untracked-files=all -- web/` returns exactly those two modified
paths and **zero** new untracked files. `git check-ignore -v` confirms `web/dist` and
`web/public/data` are ignored (`web/.gitignore:5,9`), so no build output leaked into the tree.

`web/src/lib/paperIndex.ts:66-76` (the only source hunk):

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

`web/src/lib/__tests__/paperIndex.test.ts:149-160` (the only test hunk):

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

### Deletion audit (no weakened assertions)

```
$ git diff -- web/ | grep -n "^-" | grep -v "^---"
3:--- a/web/src/lib/__tests__/paperIndex.test.ts
27:--- a/web/src/lib/paperIndex.ts
33:-      this.manifestPromise = this.fetchManifest();
$ git diff -- web/src/lib/__tests__/paperIndex.test.ts | grep -c "^-[^-]"
0
```

The **only** deleted line in the whole `web/` diff is the old assignment. Zero deletions in
the test file — no existing expectation was weakened, removed, or relaxed. The three
error-shape tests (`:127`, `:137`, `:162`) and the shard-cache test (`:195`) are untouched.

---

## 2. Acceptance criteria, one by one

### Criterion 1 — `manifestPromise` reset to `null` on rejection via a `catch` that rethrows ✅

**Met.** `paperIndex.ts:70-73` attaches `.catch()` that sets `this.manifestPromise = null`
then `throw error`.

Ordering is sound and I confirmed it empirically rather than by argument alone:

* `fetchManifest` is `async` (`paperIndex.ts:78`), so it can never throw synchronously — the
  `.catch()` handler therefore always runs strictly after the field assignment at `:70`.
* `manifestPromise` is only ever written in two places: assigned at `:70` and nulled at `:71`.
  A new promise can only be created when the field is `null`, and only the handler nulls it.
  So the clear can never stomp a fresher in-flight promise. Adversarial test **I** below
  constructs exactly this race and confirms it.
* `.catch` rethrows, so every existing caller still observes the identical rejection. Error
  identity and the `cause` chain are preserved (adversarial test **H**: `caught.cause === cause`
  by reference, `caught.name === "IndexUnavailableError"`).
* `fetchManifest` is unchanged — `paperIndex.ts:78-103` is byte-identical to HEAD. No change
  to error shape, `IndexUnavailableError`, `INDEX_HELP`, HTTP/HTML/parse branches.

### Criterion 2 — new test: first fetch rejects, second resolves, `fetch` called exactly twice ✅

**Met, and NOT vacuous.** Present at `paperIndex.test.ts:149-160`. It reuses the file's
existing `jsonResponse()` helper (`:81`), the `MANIFEST` fixture (`:27`), the
`vi.stubGlobal` pattern, and the `afterEach(vi.unstubAllGlobals)` cleanup (`:104`) — no new
fakes, no new helpers, consistent with the file.

Empirical revert check (repo untouched; done in `/tmp/imp003-verify`):

```
$ cd /tmp/imp003-verify && npx vitest run          # fix present
 Test Files  1 passed (1)
      Tests  11 passed (11)

# then the one-line fix reverted in the scratch copy only:
 ❯ src/lib/__tests__/paperIndex.test.ts (11 tests | 1 failed) 11ms
   × PaperIndex > retries the manifest after a rejection instead of memoizing it 4ms
     → promise rejected "IndexUnavailableError: No paper index was…" instead of resolving
 ❯ src/lib/__tests__/paperIndex.test.ts:158:37
      158|     await expect(index.getManifest()).resolves.toEqual(MANIFEST);
Caused by: IndexUnavailableError: No paper index was found. …
 ❯ PaperIndex.fetchManifest src/lib/paperIndex.ts:79:13
Caused by: TypeError: Failed to fetch
      Tests  1 failed | 10 passed (11)
```

The new test fails against the pre-fix code and passes against the post-fix code. The other
10 tests pass in both states, so the test isolates exactly the intended behaviour.

### Criterion 3 — `cd web && npm run typecheck && npm test` passes; shard-cache and error-shape tests unchanged ✅

**Met.** See §3. `npm test` → 39 passed (38 baseline + 1 new). `tsc --noEmit` clean.

---

## 3. Commands run (all from `web/`, with timeouts)

```
$ npm run typecheck
> tsc --noEmit
EXIT=0                                    # no output, clean

$ npm test
> vitest run
 RUN  v2.1.9 /Users/denimpatel/Desktop/git/research-paper-feed/web
 ✓ src/lib/__tests__/search.test.ts (12 tests) 3ms
 ✓ src/lib/__tests__/collections.test.ts (16 tests) 4ms
 ✓ src/lib/__tests__/paperIndex.test.ts (11 tests) 8ms
 Test Files  3 passed (3)
      Tests  39 passed (39)                # baseline was 38; +1 new test ✅

$ npm run build
> tsc --noEmit && vite build
vite v5.4.21 building for production...
✓ 38 modules transformed.
dist/index.html                   1.00 kB │ gzip:  0.52 kB
dist/assets/index-DhFU7_e3.css   10.93 kB │ gzip:  2.86 kB
dist/assets/index-CzjWDLvR.js   163.50 kB │ gzip: 52.55 kB
✓ built in 365ms                  # 38 modules, same as baseline
```

Implementer's claims (typecheck clean, 39 tests, 38 modules, CSS 10.93 kB unchanged, JS
163.50 kB vs baseline 163.17 kB) are all **independently reproduced**. Per §7 of
`REPO_PROFILE.md` all four baseline checks were green, so nothing here is pre-existing debt,
and nothing new is broken. Nothing in §7 (PE-1…PE-16) is implicated by this diff.

---

## 4. Trying to break the fix

Ten adversarial tests written in `/tmp/imp003-verify/src/lib/__tests__/adversarial.test.ts`
(never added to the repo). All 10 pass against the shipped fix.

| # | Scenario | Result |
|---|---|---|
| A | 3 concurrent callers (`getManifest` ×2 + `loadPapers`) against a gated fetch | **1** manifest request + 1 shard request. Single shared in-flight promise. **No stampede, no duplicate requests.** |
| B | 2 concurrent callers, gate rejects | Both observe `IndexUnavailableError`, exactly **1** fetch, memo cleared, next call refetches. |
| C | `fetch` rejects with the **string** `"boom-not-an-error"` (non-`Error`) | Wrapped to `IndexUnavailableError`, `cause` preserved verbatim, memo cleared, retry succeeds. |
| D | **5 consecutive failures** | 5 fetches, 5 rejections, then success on the 6th. Memo never poisoned. |
| E | HTTP 404, then HTML SPA fallback, then malformed JSON, then success | Each failure mode clears the memo; 4 fetches total; success on the 4th. |
| F | 3 sequential **successful** `getManifest()` calls | Exactly **1** fetch — the success cache is preserved (no accidental cache defeat). |
| G | `loadPapers()` itself: manifest fetch fails, then retry | First `loadPapers` rejects, second returns the paper. The public entry point callers actually use is retry-safe. |
| H | Error identity + `cause` chain | `cause === originalError` by reference; `name === "IndexUnavailableError"`. Unchanged for existing callers. |
| I | **Race:** request 1 rejects, caller clears, request 2 (retry) still in flight while 3 microtask turns elapse | Request 2's memo survives; no third request is made. The clear cannot stomp a fresher promise. |
| J | Resolved memo is kept forever (no TTL) | Confirmed pre-existing behaviour, identical before and after — WEB-12, out of scope. |

Re-running the same adversarial file against the **reverted** scratch source:

```
      × B, C, D, E, G, I, J        (7 failed)
      Tests  7 failed | 3 passed (10)
```

A, F and H pass under **both** versions — i.e. the concurrency behaviour (A), the success
cache (F) and the error shape (H) are **unchanged** by this diff. The change only adds
retry-after-rejection. No regression surface found.

### Specific risk questions from the brief

* **Transient network failure + retry** — fixed and covered (criterion-2 test, D, G).
* **Non-`Error` rejection value** — handled: `fetchManifest` wraps anything thrown inside its
  `try` into `IndexUnavailableError(..., { cause })` (`paperIndex.ts:83-85`), and the handler
  nulls the field before rethrowing regardless of the value's type. Covered by test C.
* **Two racing callers** — share one in-flight promise. `.catch` is attached synchronously at
  `:70` in the same statement as the assignment, so no second caller can create a second
  promise before the memo is visible. Covered by A and B.
* **Permanently poisoned memo** — no. Every rejection path (transport, non-`ok`, HTML
  fallback, JSON parse, and unexpected throws such as `response.headers` on a non-Response)
  routes through the one handler that nulls the field. Covered by C, D, E.
* **Never cleared** — no. The clear runs on the first reaction job after rejection and
  `this.manifestPromise = null` cannot itself throw.
* **App.tsx compatibility** — `App.tsx:148-166` (manifest effect, `[]` deps) and
  `App.tsx:169-192` (`loadPapers` effect) are **untouched by this diff**. `getManifest` keeps
  its signature `() => Promise<IndexManifest>`; `manifestPromise` keeps its type
  `Promise<IndexManifest> | null` (`.catch` on a `Promise<IndexManifest>` with a callback
  returning `never` yields `Promise<IndexManifest | never>` = `Promise<IndexManifest>`);
  `fetchManifest` stays `private` and unmodified. No new export, no removed export, no
  changed error type. The app still has no retry affordance and the manifest effect still
  runs once, so **a full page reload is still required for in-page recovery** — exactly what
  the spec anticipates and what IMP-007 owns. Verified live in §5.
  No infinite retry loop is possible: with `[]` deps nothing re-invokes `getManifest()`.

---

## 5. Spec `Verification method` + Playwright (network-layer change)

Server: `npm run preview -- --port 5199 --strictPort` from `web/` (background, PID tracked,
**stopped** at the end — `lsof -nP -iTCP -sTCP:LISTEN | grep 5199` → "5199 free").
Browser closed. `.playwright-mcp/` created by the MCP screenshot tool was emptied and removed
(known trap noted by the IMP-001 implementer).

### 5a. Healthy index, 1280px — the app still loads normally

`http://localhost:5199/research-paper-feed/` renders the full feed: heading "Recent arXiv
papers in CS & AI", "2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index generated
Oct 1, 2026", all 5 category chips pressed, 60-day recency, and ~50 paper cards with titles,
dates, authors, abstracts, arXiv/PDF links and Save menus.

Console: **zero messages of any kind** (no `console.error`, no warnings, nothing).
Network: every request `200 OK` —
`/research-paper-feed/`, `assets/index-CzjWDLvR.js`, `assets/index-DhFU7_e3.css`,
`data/index.json`, `data/papers-2026-W40.json`, `data/papers-2026-W39.json`, plus Google
fonts. **Zero new console errors, zero failed requests.**

Screenshot `feed-desktop-1280.png` is **byte-identical** to the baseline:

```
MD5 baseline/baseline-feed-desktop-1280.png       = 4b6b8c709a9f7c0ce3eb579ab1580886
MD5 IMP-003/feed-desktop-1280.png                 = 4b6b8c709a9f7c0ce3eb579ab1580886
```

Mobile 390×844 re-capture is also byte-identical:
`baseline-feed-mobile-390.png` = `4b2cd053225e03137878e3049aaf595c` =
`feed-mobile-390.png`. No visual regression at either viewport.

### 5b. `web/public/data/` effectively empty — error panel appears

To avoid mutating the shared `web/public/data/` (gitignored build output that another agent
may be using), I built the identical bundle to a temp dir and removed only its `data/`
folder, which reproduces exactly what a build with an empty `web/public/data/` produces
(trap 7). The served JS/CSS hashes are the same (`index-CzjWDLvR.js`, `index-DhFU7_e3.css`),
so this is the same artifact under test.

`ls /tmp/imp003-dist/data` → `No such file or directory`. Loading the site yields the error
panel, text identical to the baseline:

```
alert:
  heading "No paper index yet"
  paragraph "No paper index was found. Run `python scripts/build_index.py` locally, or wait
             for the scheduled GitHub Action that builds and deploys the index. (HTTP 200)"
  paragraph "Build the index locally:"
  code "python scripts/build_index.py"
  code "cd web && npm run dev"
```

Console: **zero messages**. Network: exactly **one** `GET /data/index.json` → 200 (HTML SPA
fallback) and **nothing else**. This is the direct empirical confirmation that the fix does
**not** introduce an automatic retry loop or a request storm against a failing index: the
error panel stays put and no further `/data/index.json` request is issued.

Screenshot `feed-index-missing-desktop-1280.png` vs baseline: 1280×900, a11y tree identical,
52 differing pixels all inside the "No paper index yet" heading, **maximum per-channel delta
= 1/255** — sub-pixel font rasterisation noise, not a visual change.

### 5c. Restore the index — a reload is still required (IMP-007 pending)

With the data-less build swapped back for the real `web/dist/`, a page load recovers
immediately: "2,812 papers match" and the cards render. No in-page recovery is possible —
the error panel contains **no retry control** (a11y snapshot shows only a heading, two
paragraphs and two `<code>` blocks, zero buttons), and the manifest effect still has `[]`
deps. This matches the spec's expectation that in-page recovery is IMP-007's scope, and
confirms WEB-01's second half ("no retry possible, only a page reload") remains open by
design, not by oversight.

---

## 6. Style, conventions, and scope creep

* **Scope creep:** none. Only `web/src/lib/paperIndex.ts` and its test file. `App.tsx`,
  `vite.config.ts`, `package.json`, `package-lock.json`, `types.ts`, `search.ts`,
  `collections.ts` and every component are untouched. No new dependency, no lockfile churn,
  no renames, no reformatting of untouched lines (profile §5.2 "do not mass-reformat").
* **IMP-001's committed work** (`0beec1b`, already in HEAD) is correctly absent from this
  diff and was not credited or faulted here.
* **Comment policy** (profile §5.2: "do not add comments unless genuinely needed… the
  comments that exist explain rationale"): the two added lines state *why* the clear exists,
  and `paperIndex.ts:87-89` already carries an equivalent rationale comment. Compliant.
* **Type annotation:** `(error: unknown)` matches the existing convention —
  `App.tsx:160` and `:185` both use `.catch((cause: unknown) => …)`.
* **Code smells:** zero. `git diff -- web/ | grep -E "^\+.*(console\.(log|debug|warn)|TODO|FIXME|XXX|HACK|debugger|password|secret|api[_-]?key|token)"` → "no smells". No commented-out code.
* **Secrets:** none.
* **Bundle:** 38 modules (unchanged), CSS 10.93 kB identical, JS 163.50 kB vs baseline
  163.17 kB — a +0.33 kB delta fully explained by the added `.catch` handler.

---

## 7. Non-blocking observations (not defects of this item)

1. **§9 row WEB-01 is now half-stale and `REPO_PROFILE.md` still needs an update**
   (`REPO_PROFILE.md:630` and trap 11 at `:564-568`). The "memoized forever" half is fixed by
   this change; the "no retry possible, only a page reload" half (`App.tsx:364-376`) is still
   open. The implementer correctly declined to edit the profile. **Action for the
   coordinator / IMP-007 owner:** split or annotate that row so it does not misreport the
   state. Flagged on the board.
2. **A hung (never-settling) request is still memoized forever.** The fix addresses
   *rejection*, exactly as criterion 1 specifies; a promise that never settles never runs its
   handler. This is pre-existing WEB-08 (no `AbortController`/timeout anywhere in `web/src`)
   and unchanged by this diff.
3. **A resolved manifest is cached for the page lifetime with no TTL** — pre-existing WEB-12,
   verified unchanged by adversarial test J.
4. **End users still need a page reload to recover from a transient error** until IMP-007
   adds a retry affordance. The library is now retry-safe; the app does not yet exercise it.
   Correct scope call by the implementer, and the spec explicitly anticipates it.

## 8. Artifacts produced

* `.improve/artifacts/IMP-003/feed-desktop-1280.png` — healthy feed @1280×900 (MD5-identical
  to `baseline-feed-desktop-1280.png`)
* `.improve/artifacts/IMP-003/feed-mobile-390.png` — healthy feed @390×844 (MD5-identical to
  `baseline-feed-mobile-390.png`)
* `.improve/artifacts/IMP-003/feed-index-missing-desktop-1280.png` — the spec's required
  screenshot; matches `baseline-feed-index-missing-desktop-1280.png` to within 1/255
  anti-aliasing noise

Scratch verification lives entirely in `/tmp/imp003-verify` and `/tmp/imp003-dist`; the repo
was never modified.