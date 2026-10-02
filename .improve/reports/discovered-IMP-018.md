# Discovered while implementing IMP-018 — not fixed here

Found during IMP-018's browser verification. None of these are in IMP-018's scope;
none were touched.

## 1. A second unguarded shard-field read crashes the whole app from the search box

`web/src/lib/search.ts:57`

```ts
const abstract = paper.abstract.toLowerCase();
```

`scorePaper` reads `paper.abstract` with no guard, so a `Paper` missing
`abstract` throws a `TypeError` **inside `App`** the moment any query is typed —
with no card rendered at all. Observed on the pre-fix control build: typing
`zzzq-no-match` (which matches nothing) blanked the page, console reporting
`TypeError: Cannot read properties of undefined (reading 'toLowerCase')` at
`scorePaper`, then `The above error occurred in the <App> component`.

This is a distinct crash site from the `PaperCard` one IMP-018's spec describes
(`web/src/components/PaperCard.tsx:50`, `paper.abstract.length`), and it fires on
a path that is much easier to reach — a reader who searches, versus a reader who
scrolls to the affected card. It is runtime validation, i.e. IMP-098's territory,
and IMP-018's boundary now contains it rather than fixing it. Worth IMP-098's
recon knowing there are at least two independent read sites.

## 2. Stale shard data can hide a fixture from the app on a long-lived dev server

While verifying, the app rendered papers that the shard file on disk did not
contain: the first card was `2610.00848v1` displayed as `Sep 30, 2026`, while the
file records that paper as `published: 2026-10-01` and files a newer paper
(`2610.02210`, `2026-10-01`) ahead of it. No sort or filter in `App.tsx` or
`web/src/lib/paperIndex.ts:295` can produce that ordering, and the in-page
`performance.getEntriesByType('resource')` entries plus a `cache: 'no-store'`
re-fetch showed the browser had the mutated bytes available. The conclusion I
reached — unverified from a clean profile, and I did not chase it further — is that
the long-lived Chromium context reused a cached copy of
`data/papers-*.json` for the dev origin.

Practical effect for whoever verifies a data-shape item next: a fixture can appear
to have no effect. Cache-bust by pointing the manifest at a new file name
(`index.json` → `shards[0].file = "papers-2026-W40-crash.json?v=2"`) rather than
concluding the fixture did not apply. If someone does find a real ordering
discrepancy, `web/src/lib/paperIndex.ts:291-296` and the unsorted no-query branch
of `visiblePapers` (`web/src/App.tsx:336-353`) are where to look.

## 3. Tests cannot use Node built-ins — no `@types/node` in the repo

`web/tsconfig.json` has `"types": ["vite/client"]` and `@types/node` is not
installed, so `import { readFileSync } from "node:fs"` fails `npm run typecheck`
inside `web/src/__tests__/`. IMP-018's source-text assertion about `main.tsx`
therefore uses Vite's `?raw` import (`import mainSource from "../main.tsx?raw"`,
typed via `vite/client`) instead. Also worth knowing: Vite rewrites the
`new URL("...", import.meta.url)` pattern, so it cannot be used to resolve a
source path in a test either.

This is not a bug, just a sharp edge. If a future item wants Node APIs in tests,
that item needs to add `@types/node` as a devDependency and say so in its report
(lockfile change, `web/package.json`).

## 4. `@testing-library/user-event` is still imported nowhere

`web/package.json` declares it; IMP-018 needed no user-event (it verified keyboard
reachability with native `<button>` semantics in jsdom plus a real Tab+Enter in
Chromium). Left as-is; mentioned only because it remains carried weight.