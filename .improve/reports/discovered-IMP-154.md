# IMP-154 — discoveries (found, NOT fixed)

Out-of-scope problems noticed while implementing IMP-154. Per instructions these are recorded here
rather than fixed. Ownership of the first four is assigned by the IMP-154 spec's own Notes
(`.improve/FEATURES.md:240`); the rest are new.

## Owned by another item

1. **`web/src/components/PaperCard.tsx:79`** — `paper.categories.map(...)` is still unguarded, so a
   `Paper` that reaches the renderer without `categories` (any path other than the import gate) still
   throws `TypeError` and blanks the app. IMP-154 closes the gate; **IMP-160** owns the point-of-use
   guard. Not fixed here: the spec assigns it to IMP-160 and says explicitly that IMP-018's error
   boundary is a complement, not a substitute.
2. **`web/src/components/PaperCard.tsx:73,82`** — `paper.published` (`formatDate`) and
   `paper.primaryCategory` are likewise dereferenced without a guard. Neither can *throw* today
   (`formatDate` returns its input via the `Number.isNaN` branch; a comparison against `undefined`
   is simply false), so they were ranked below `categories.map` — but they render visibly wrong
   (`undefined` as the date). Same IMP-160 fix.
3. **`web/src/lib/paperIndex.ts:111-114`** — the **feed** path has no validation at all: `loadShard`
   casts the payload and checks only `Array.isArray(data.papers)`. A malformed shard blanks the feed
   exactly the way a malformed export used to blank the collections view, and IMP-154 does not reach
   it. **IMP-098** owns manifest/shard validation.
4. **`web/src/lib/collections.ts:193-207`** (`addPaper` reducer) — a `Paper` enters state with no
   `isPaper` check at all, so an unvalidated network paper from the feed is snapshotted verbatim.
   Same class as (3); fixed there or by validating at the `addPaper` boundary.

## New findings

5. **A test in this repo cannot read the filesystem.** `web/tsconfig.json:13` is
   `"types": ["vite/client"]` and `@types/node` is not a dependency, so `import … from "node:fs"`
   fails `tsc --noEmit` with `error TS2307: Cannot find module 'node:fs'`. Compounding it, under
   Vitest `import.meta.url` is an `http://` URL, so `fileURLToPath(new URL(…, import.meta.url))`
   throws `TypeError: The URL must be of scheme file` at runtime. Consequence: any future item that
   wants to assert the Python→TS wire contract against real shard data (profile trap 1, trap 8,
   PY-24) cannot do it from `web/src/**` without adding `@types/node` to `web/package.json` **and**
   `web/package-lock.json` together (profile §6). Relevant to IMP-098 and any contract-test item.
6. **`jsdom@29` on Node v25.6.1 gives a non-functional `window.localStorage`** —
   `window.localStorage.setItem is not a function` / `.clear is not a function`, with Node printing
   `Warning: --localstorage-file was provided without a valid path`. Both workflows pin floating
   `node-version: "20"`, where this may not reproduce; locally it is fatal to any test that touches
   `window.localStorage` directly (it broke the concurrent IMP-007 agent's `App.retry.test.tsx`
   mid-session). Workaround in use: pass an explicit `Storage` fake, as `collections.test.ts` and
   `malformedImport.test.tsx` both now do. Worth pinning in CI (PE-10) rather than leaving to chance.
7. **`isPaper` still is not a full-schema check** (`web/src/lib/collections.ts:77-93`): it does not
   type-check `authors` **elements** (only `Array.isArray`), and does not validate `updated` or
   `abstractTruncated`. None can blank the app today — `authors.join(", ")` stringifies a number,
   `abstractTruncated` is used as a truthiness test at `PaperCard.tsx:99`, and `updated` is never
   read by any UI code (WEB-11). Deliberately left as-is: criterion 1 names exactly three fields and
   widening it risks over-rejection. Listed so a future item (IMP-019/IMP-098) picks it up knowingly.
8. **Spec inaccuracy worth correcting in the backlog:** IMP-154 criterion 3 calls
   `web/public/data/papers-2026-W40.json` "committed" (it is gitignored, and no shard is committed
   anywhere) and attributes the count **2,812** to that one file, which actually holds **2,549**
   papers — 2,812 is the two-shard total from `index.json` (`totalPapers`). Recorded so a verifier
   does not read my W40 figure as a shortfall.
9. **`REPO_PROFILE.md` needs two edits this item cannot make** (out of my permitted paths):
   the **WEB-20** row's "Residual (tracked separately)" clause — "`isPaper` still does not validate
   `categories` / `published`, and `PaperCard.tsx:79` does `paper.categories.map` unguarded, so a
   malformed export still blanks the whole app" — is now closed on the import path and should say so;
   and **§10 "Recently fixed — do not re-report"** needs an IMP-154 row. §7's baseline line
   ("vitest 69/69 across 5 files") and §3.3's test-file table are stale for reasons predating this
   item.