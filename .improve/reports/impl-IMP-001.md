# IMP-001 — Reject non-`http(s)` URLs in imported collection papers

Implementation report. Bug inventory line **WEB-20** (`.improve/REPO_PROFILE.md` §9, Web —
collections / localStorage). No prior `.improve/reports/verify-IMP-001.md` existed, so this was a
first attempt, not a retry.

## Files changed

| File | Change |
| --- | --- |
| `web/src/lib/collections.ts` | Added exported `isHttpUrl` + private `hasSafeUrls`; `parseExportPayload` now chains `.filter(hasSafeUrls)` after `.filter(isPaper)`. |
| `web/src/components/PaperCard.tsx` | Added local `safeHref`; the four `href={…}` sites (now `:64`, `:102`, `:112-122`) use `absHref` / `pdfHref` and render no anchor when a url is not http(s). |
| `web/src/lib/__tests__/collections.test.ts` | Two new `it` blocks in the `parseExportPayload` describe (14 → 16 tests). |
| `.improve/reports/discovered-IMP-001.md` | New — two out-of-scope observations (D-1, D-2). |
| `.improve/artifacts/IMP-001/*.png` | New — 3 screenshots (gitignored via `.git/info/exclude`). |

`.improve/FEATURES.md` shows as modified in `git status`; that `TODO → IN-PROGRESS` edit was
made by the orchestrator, not by me. No other file is touched.

## Approach

Smallest change that satisfies all four acceptance criteria, in the repo's existing idiom.

### `collections.ts`

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

- `String(...).trim()` + `/i` is exactly criterion 1's wording. `String()` (rather than a
  `typeof` guard) means a non-string `absUrl` (`null`, `123`, `{}`) coerces to a string that
  cannot match, so it is rejected — same as the spec's `String(...)` phrasing.
- `undefined` (absent) is kept, as the spec requires; `hasSafeUrls` reads through
  `Partial<Paper>` because `Paper.absUrl`/`pdfUrl` are currently typed non-optional and a
  direct `url === undefined` compare would be TS2367 under `strict`.
- Criterion 1's "still returned with `papers: []`, not thrown" needed no code: the filter is
  the last step of the same array expression, so the existing return is untouched.
- `isPaper` is deliberately unchanged (criterion 1 and the WEB-20 line both reference it as
  the "does not require them" baseline; changing it would also change `loadState`, which is
  IMP-019/other items' territory).
- `isHttpUrl` is exported (named exports only, per §5.3) so `PaperCard` can reuse it rather
  than duplicating the regex — one definition of "safe url" for both the write path and the
  render path.

### `PaperCard.tsx`

```ts
function safeHref(url: string | undefined): string | undefined {
  return isHttpUrl(url) ? String(url).trim() : undefined;
}
```

Param typed `string | undefined` (not `string`) so IMP-019 can widen `Paper["absUrl"]`
without touching this helper. The value is computed once per card as `absHref` / `pdfHref`.

Fallbacks chosen per site so that criterion 3's "React renders no anchor" holds literally:

- **title** (`:64`) → `<span>{paper.title}</span>` inside the existing `h3`. `styles.css:318`
  only styles `.paper__title a`, so the fallback inherits the `h3` colour and reads as
  ordinary heading text. No CSS change needed.
- **truncation note** (`:102`) → the same phrase as plain text:
  `Abstract truncated — view the full text on arXiv.` No anchor.
- **footer** (`:112-122`) → the `arXiv` / `PDF` anchors are each skipped. `.paper__links`
  stays in the DOM but empty (a `display:flex` gap with no children is visually a no-op).

No `style=` prop was introduced (§5.3 forbids inline styles); no other component renders
`absUrl`/`pdfUrl` — `rg 'absUrl|pdfUrl' web/src` shows only `PaperCard.tsx` and test/type
files. `PaperCardProps` was not widened (IMP-019's scope, per criterion 3).

### Tests

Two cases appended inside the existing `describe("parseExportPayload")`, reusing the file's
`makePaper` helper and its literal-payload style (the file's other payloads use
`{ collection: {...}, papers: [...] }`):

1. `drops papers whose urls are not http(s) and keeps valid siblings` — 4 papers: two
   valid siblings, one with `absUrl: "javascript:alert(1)"`, one with
   `pdfUrl: "javascript:alert(1)"`; asserts only the siblings survive (covers criterion 1 for
   both fields) and, in the same test, that an all-bad payload still returns
   `papers: []` rather than throwing.
2. `keeps an https paper url` — asserts `absUrl: "https://arxiv.org/abs/2401.12345"` is
   kept (criterion 2's second half).

Collections file goes 14 → **16** tests (criterion 4 expects 15–16). No existing expectation
was weakened or edited — the diff to that file is purely additive. The exported `isHttpUrl`
gets no dedicated `describe` block, deliberately, to stay inside the 15–16 window; it is
covered transitively by both new tests.

## Commands run

All from `web/` unless noted. Python was not touched, so the Python gate was not required
(§4.1/§4.2 rows apply).

| Command | Result |
| --- | --- |
| `npm run typecheck` | exit 0, no output (run 3×, clean each time) |
| `npm test` | `Test Files 3 passed (3)`, `Tests 38 passed (38)` — collections 16, search 12, paperIndex 10. Baseline was 36; +2 are the new cases. |
| `npm run build` | exit 0, 38 modules, CSS 10.93 kB (gzip 2.86, unchanged), JS 163.45 kB (gzip 52.53) vs baseline 163.17 / 52.40 → +0.28 kB for the new predicate. No bundle regression. |
| `npm run dev -- --port 5199 --strictPort` | served at `http://localhost:5199/research-paper-feed/`; stopped after the visual pass |
| `git status --porcelain` | only the 3 source files + the orchestrator's `FEATURES.md` edit; `.improve/artifacts/` and `.kilo/` correctly ignored |

## Browser verification (profile §4.2 + the spec's verification method)

Crafted import file at `/tmp`-adjacent scratch (`…/kilo/imp-001-import.json`), one paper with
`absUrl`/`pdfUrl` = `javascript:…` and one sibling with
`https://arxiv.org/abs/2401.12345`.

1. `#view=collections` → Import collection → uploaded the file.
   - (a) malicious paper absent: the collection header reads `IMP-001 import (1)`.
   - (b) valid sibling present with its three `https://` links (title, note, footer arXiv/PDF).
   - (c) `[...document.querySelectorAll('a')].every(a => !a.getAttribute('href')?.startsWith('javascript:'))`
     → `true`; observed hrefs: `#main`, three `https://arxiv.org/abs/2401.12345`,
     `https://arxiv.org/pdf/2401.12345`, `https://arxiv.org/`.
   - The bad paper never reached storage: `rpf.papers.v1` = `{"imp001-good":…}` and the
     imported collection's `paperIds` = `["imp001-good"]` (the dropped id is filtered by
     `mergeImport`'s `id in papers` check, so no dangling reference either).
2. Render-path guard (criterion 3) for snapshots that predate this fix: wrote a paper with
   `javascript:` urls straight into `localStorage`, bypassed the import path, hard reloaded.
   The card rendered **0 anchors** — title became `<span>Stale snapshot with javascript
   urls</span>`, the note became plain text, `.paper__links` innerHTML was `""`, and the only
   hrefs on the page were `#main` and the footer `https://arxiv.org/`.
3. Regression pass on the feed with real data (`web/public/data/` was already populated):
   50 cards, 4 anchors in the first card, every href `http(s)://` or `#`. Console clean —
   only the documented dev-server baseline (`[vite] connecting…/connected…` + React-DevTools
   info), no `console.error`, no failed request.
4. Cleared `localStorage` afterwards, so no test data is left in the browser profile.

Screenshots in `.improve/artifacts/IMP-001/`:
`collections-import-javascript-url-desktop-1280.png` (the spec's requested name),
`collections-import-javascript-url-mobile-390.png`,
`collections-stale-snapshot-no-anchor-desktop-1280.png`.

## Uncertainties

- **Criterion 3 says "a validated `https://` string"; the real index emits `http://`.**
  `absUrl` is `result.entry_id`, which arXiv returns as `http://arxiv.org/abs/<id>v1`
  (verified: all 50 visible cards). A literal https-only check would delete every card link
  in the live feed, so I read "validated `https://`" as "validated http(s)", matching
  criterion 1's explicit `https://` **or** `http://`. Logged as D-1.
- **Non-http(s) snapshots already in localStorage are still persisted.** I deliberately did
  not add URL filtering to `loadState`: it would make previously-saved papers silently vanish
  from users' collections (worse than a dead link), and criterion 3's render guard makes them
  inert. A verifier expecting `loadState` to scrub them would be right to flag it, but the
  spec scopes criterion 1 to `parseExportPayload` only.
- **`isHttpUrl` is exported from `collections.ts`** (a persistence module) rather than from a
  new shared module. A new file would break the tests-mirror-source 1:1 convention and add a
  module for one function; `PaperCard` already imported from `../lib/collections`.
- **`String(value)` on a hostile value could throw** for a `Symbol`, but JSON cannot produce
  one and the only caller passes `unknown` from `JSON.parse`. Not worth a `typeof` guard.
- No `vitest`-level test exists for the `PaperCard` fallback markup — structurally
  impossible today (PE-13: `environment: "node"`, `include: ["src/**/*.test.ts"]`, no jsdom),
  so it is covered by typecheck plus the browser pass above.
