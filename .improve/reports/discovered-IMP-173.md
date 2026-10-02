# Discovered while implementing IMP-173 — not fixed

Found by reading `web/src/App.tsx` and `web/src/lib/paperIndex.ts` for IMP-173. IMP-173 AC4 forbids
taking any of this on, so nothing here was touched. Every case below is a body that **parses
successfully and is a plain object**, so it passes the gate IMP-173 added
(`body === null || typeof body !== "object" || Array.isArray(body)`) and reaches the app as a manifest.
They are all **IMP-098's** — that item is titled for exactly this and is still `TODO` at priority
`10.0`. Recording them so IMP-098's criteria can be written against real cases rather than
hypotheticals.

Cross-reference: profile defect **WEB-07** ("data validated only by cast"), and profile §8 trap 1
("the Python → TypeScript wire contract is hand-mirrored and completely unvalidated").

## 1. A manifest with no usable `categories` blanks the feed and gives no retry — HIGH

**Shape:** `{"totalPapers": 10, "shards": [...], "generatedAt": "..."}` — `categories` absent.

**Trace:** `App.tsx:603` renders `manifest.categories.join(", ")`. That throws
`TypeError: Cannot read properties of undefined (reading 'join')` **during render**, so the commit
never happens and the papers effect never runs. IMP-018's boundary catches it and shows its generic
`role="alert"` fallback.

**Why it matters:** the reader gets a dead end with **no "Try again" for the index** and no in-place
recovery — worse than the JSON-`null` hang IMP-173 just removed, because that one at least reaches the
index panel. IMP-018 blunts the blank page but, as its own report notes, cannot give a retry: the
manifest *loaded*, so the app has no idea the index is the thing that is wrong.

**Also fires** when `categories` is present but not an array (`{}`, `7`) — `.join` is undefined on
those. Same trace, same outcome.

## 2. A manifest with no `totalPapers` — same render-time throw

`App.tsx:602` `manifest.totalPapers.toLocaleString()`. Same commit-never-happens, same boundary
fallback, same absence of a retry. Filed together with #1: both need a **render-time** guard, which is
why a loader-side check alone would not be enough for them.

## 3. A manifest with no usable `shards` gets the *wrong* failure copy — MEDIUM

**Shape:** `{"categories": ["cs.CV"], "totalPapers": 10, "generatedAt": "..."}` — `shards` absent, or
present as a string/number.

**Trace:** `latestIndexDate` (`paperIndex.ts:100`) does `for (const shard of manifest.shards)`, which
throws a bare `TypeError` inside `loadPapers`. It rejects; `App.tsx`'s `.catch` runs
`describeLoadFailure`, which has cases for `IndexUnavailableError` and `ShardLoadError` and falls
through to `UNKNOWN` for anything else.

**Consequence:** the reader is told *"Something went wrong while loading papers. This is usually
temporary."* That advice is false for this state — the manifest will fail identically forever, which is
precisely the distinction IMP-017's two `INDEX_*` sentences exist to draw, and this failure slips past
both. The papers panel does render with a working "Try again", so it is recoverable, but the copy
misleads.

**Fix shape for IMP-098:** a `catch`/`finally`-independent field check in `fetchManifest` so this is a
typed `IndexUnavailableError` with `kind: "malformed"`, **or** a new `describeLoadFailure` branch for a
manifest-shape `TypeError`. The first is better: it keeps the classification in one place, which is what
that module's doc comment asks for.

## 4. `categories: []` alongside real shards makes the filter UI a lie — LOW/MEDIUM

A manifest can name no categories while listing shards. `activeCategories` intersects the hash against
`manifest.categories`, so nothing can ever be selected, and the UI renders IMP-017's "No categories
selected" state with a **"Select all categories" button that cannot select anything**. It is the same
family as #1: a state the reader cannot act on, reached by a manifest that is technically well-formed.

Needs a product decision (is a category-less index "empty", or is the manifest lying?) before it can be
fixed, so it may want its own item rather than folding into IMP-098.

## 5. Cases that are fine — recorded so they are not re-reported

- **`shards: []`, or every entry with a falsy `to`** — `loadPapers` short-circuits on
  `latestIndexDate(...) === null` (`paperIndex.ts:257-260`) and returns an empty list, which honestly
  renders "No papers are available in this window yet." Already handled; there is a test for it
  (`returns an empty list when the manifest has no shards`).
- **`shards[i].file` missing** — `loadShard(undefined)` fetches `data/undefined`, gets a 404, and the
  week lands in the IMP-015 partial-shard notice, which names the missing week in prose. Degraded but
  *reported*, which is the correct outcome.
- **`generatedAt` missing** — `formatGeneratedAt(undefined)` returns `undefined` and the hero simply
  omits the date. Cosmetic; the field drives no logic.
- **`totalPapers` a numeric string** — `String.prototype.toLocaleString` exists, so `"2812"` renders
  correctly by accident. No defect, but it is the kind of thing IMP-098 should pin while it is in the
  file.

## Recommendation for IMP-098

At minimum, a manifest-shape check that rejects as `kind: "malformed"` when any of `categories` (array
of strings), `shards` (array of `{from, to, file}`) or `totalPapers` (number) is missing or the wrong
type, **plus** a render-time guard for #1/#2 — because a loader-side check alone leaves the render
throw reachable for any manifest that passes the check but is still wrong. #4 wants a decision first.