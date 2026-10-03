# IMP-219 — Render a paper's publication date in UTC so cards west of UTC stop showing yesterday

**Status:** implemented and verified. 2026-10-03. Branch `improve/auto-20261002`.
**Choice made:** `timeZone: "UTC"` passed to `toLocaleDateString` — **not** a local-midnight parse.

---

## 1. Root cause

`PaperCard.formatDate` (`web/src/components/PaperCard.tsx:20-30` before the fix) did two things
that cancel out:

```ts
const date = new Date(`${value}T00:00:00Z`);            // anchor a bare day at midnight UTC
return date.toLocaleDateString(undefined, {              // ...then format it in the LOCAL zone
  year: "numeric", month: "short", day: "numeric",
});
```

`published` is not an instant. The producer emits a **zoneless calendar day** —
`iso_date` in `scripts/build_index.py` returns `value.date().isoformat()`, and the committed
shard data confirms it (`"published": "2026-10-01"`, no offset, no time). Re-anchoring it at
`00:00Z` and then formatting in the reader's local zone throws the agreement away: at
`2024-01-02T00:00:00Z` the local calendar day in `America/New_York` is 2024-01-01. So every
card in the feed showed **yesterday's** date to every reader west of Greenwich — the whole
Americas — and the visible text contradicted the `dateTime` attribute on the very same
`<time>` element (`dateTime="2026-10-01"` beside the words "Sep 30, 2026").

The repo already knows the rule. `formatWeekRange` (`App.tsx:87-100`) handles the other kind
of bare date — a shard's `from`/`to` — and its own comment at `App.tsx:81-86` names this exact
hazard and pins `en-US` **plus** `timeZone: "UTC"`. `formatDate` was the one helper that did
not.

**What was deliberately *not* touched.** `App.tsx:64-74` `formatGeneratedAt` parses
`manifest.generatedAt`, a real instant, and renders it in local time correctly. Adding
`timeZone: "UTC"` there would introduce a *new* off-by-one day in the hero's "index generated"
line, in the opposite direction. `git diff --stat -- web/src/App.tsx` is **empty**; the
function is byte-identical to `HEAD`. The two helpers legitimately differ because they take
different kinds of value.

---

## 2. The fix

One option on one call, plus a comment recording why it is `UTC` and why the sibling helper is
not. `web/src/components/PaperCard.tsx`:

```diff
   return date.toLocaleDateString(undefined, {
     year: "numeric",
     month: "short",
     day: "numeric",
+    timeZone: "UTC",
   });
```

Why `timeZone: "UTC"` and not the local-midnight parse (`new Date(value)`):

- It matches the in-repo precedent for bare days (`formatWeekRange`, `App.tsx:93`), so there is
  one convention for one kind of value rather than two.
- It keeps the `Number.isNaN(date.getTime())` guard meaningful: `"2024-01-02"` parses in both
  engines, but an explicit `Z` is what makes the instant well-defined at all.
- It is a one-line change with no behaviour change on the wire and no new helper, so
  IMP-125's future consolidation has one place to parameterise.

The `locale` axis is untouched — `undefined` is still passed. That is IMP-125's decision
(`NEEDS-HUMAN`), not this item's; the two decisions compose and either can be made alone.

**Test hardened.** `web/src/components/__tests__/PaperCard.test.tsx:44`:

```diff
-    expect(published?.textContent).toContain("2024");
+    expect(published?.textContent).toBe("Jan 2, 2024");
```

The `dateTime` assertion at `:43` is unchanged — it was always the correct half, and it is
what the fix must not disturb. The stale comment normalising the bug ("the text only has to be
there") is replaced by one that states what is now pinned.

### Files changed

| Path | Change |
| --- | --- |
| `web/src/components/PaperCard.tsx` | `+ timeZone: "UTC"` in `formatDate`; doc comment above it. 14 lines added, 0 removed, nothing reformatted. |
| `web/src/components/__tests__/PaperCard.test.tsx` | `toContain("2024")` → `toBe("Jan 2, 2024")`; comment replaced. |

`git diff --stat -- web/src` lists exactly those two files. No new dependency, no
`@types/node`, no CSS, no `@media`, no change to `web/vite.config.ts`'s `test.include`, no
`npm run lint`, no mass reformat, no edit to `scripts/`, `tests/`, or `.github/`.

---

## 3. Timezone matrix — measured, not inspected

Method: a temporary probe test (`web/src/components/__tests__/zz-tzprobe.test.tsx`, **deleted
afterwards** — `git status --porcelain` shows no untracked file under `web/`) rendered the real
`PaperCard` with the `FIXTURE` paper and printed the `<time>` element's `textContent` and
`dateTime`. It was run once per `TZ`, and the eight printed lines compared byte-for-byte.

```
UTC                  RENDERED	Jan 2, 2024	dateTime=2024-01-02
America/New_York     RENDERED	Jan 2, 2024	dateTime=2024-01-02
America/Los_Angeles  RENDERED	Jan 2, 2024	dateTime=2024-01-02
Pacific/Honolulu     RENDERED	Jan 2, 2024	dateTime=2024-01-02
Europe/Berlin        RENDERED	Jan 2, 2024	dateTime=2024-01-02
Asia/Kolkata         RENDERED	Jan 2, 2024	dateTime=2024-01-02
Asia/Tokyo           RENDERED	Jan 2, 2024	dateTime=2024-01-02
Pacific/Auckland     RENDERED	Jan 2, 2024	dateTime=2024-01-02

distinct rendered lines: 1
shasum -a 256 over the 8 lines:
1b8153f9cb392b5988ef8cf95be100a912af0899d9bd5d6805446cd8a62b2556
```

Eight zones spanning UTC−10 to UTC+12, including the half-hour and 45-minute-offset cases.
The host zone is `America/New_York` (`Intl.DateTimeFormat().resolvedOptions()` →
`en-US / America/New_York`), i.e. one of the zones that was broken, and it is now correct.

The suite itself is also zone-independent — `TZ=<zone> npx vitest run
src/components/__tests__/PaperCard.test.tsx`, run in the repo:

```
America/New_York           Tests  1 passed (1)
Asia/Tokyo                 Tests  1 passed (1)
Pacific/Auckland           Tests  1 passed (1)
Asia/Kolkata               Tests  1 passed (1)
```

`America/New_York`, `Pacific/Honolulu` and `America/Los_Angeles` are **west** of UTC, so a fix
that only worked east of Greenwich could not pass.

---

## 4. Non-vacuity proof — three mutations, all red

`verify-IMP-037.md` §4 found the IMP-037 assertion weak: mutations C (Feb-for-Jan), D
(hardcoded year) and E (`updated`-for-`published`) all stayed **green** under
`toContain("2024")`. Each was re-run against the tightened assertion, in a `/tmp` copy
(`/tmp/imp219/web`, `node_modules` symlinked, repo tree untouched), each reverted afterwards,
pristine re-verified green. Driver: `/tmp/imp219/mutate.py`.

| # | Mutation | Was | Now | Quoted red output |
| --- | --- | --- | --- | --- |
| **M2** | Feb-for-Jan: `date.setUTCMonth(date.getUTCMonth() + 1)` inside `formatDate` (`TZ=UTC`) | GREEN | **RED** | `AssertionError: expected 'Feb 2, 2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "Feb 2, 2024"` at `src/components/__tests__/PaperCard.test.tsx:44:36` |
| **M3** | Hardcoded year: `formatDate` returns the literal `"2024"` (`TZ=UTC`) | GREEN | **RED** | `AssertionError: expected '2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "2024"` at `:44:36` |
| **M4** | `updated`-for-`published`: JSX renders `{formatDate(paper.updated)}`, `dateTime` still `paper.published` (`TZ=UTC`) | GREEN | **RED** | `AssertionError: expected 'Jan 3, 2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "Jan 3, 2024"` at `:44:36` |

All three exit 1 with `Test Files 1 failed (1)` / `Tests 1 failed (1)`.

### M1 — the original bug, reintroduced

Removing only the `timeZone: "UTC"` line and running under `TZ=America/New_York` (the verifier's
required check):

```
AssertionError: expected 'Jan 1, 2024' to be 'Jan 2, 2024' // Object.is equality
Expected: "Jan 2, 2024"
Received: "Jan 1, 2024"
 ❯ src/components/__tests__/PaperCard.test.tsx:44:36
```

This is the bug itself: with the fix in place, the pre-fix implementation is now **red**, so
the test would have caught it. After all four mutations the pristine `/tmp` copy was restored
and re-verified: `Tests  1 passed (1)` under `TZ=America/New_York`.

---

## 5. Screenshots

**URL that rendered** — the site is a GitHub Pages app with `base: "/research-paper-feed/"`,
so the bare origin serves Vite's base-path warning page. The real app is at the path prefix:

- `npm run dev -- --port 5199 --strictPort` → **`http://localhost:5199/research-paper-feed/`**
  (the fixed tree, `web/`, 1280×900 and 390×844)
- A second server on `http://localhost:5198/research-paper-feed/` served the `/tmp` copy with
  mutation M1 applied, for the A/B comparison below. Same `web/public/data`, so the only
  variable is the one line of source.

| Path | What |
| --- | --- |
| `.improve/artifacts/IMP-219/feed-desktop-1280.png` | fixed tree, 1280×900. First card reads **"Oct 1, 2026"**. |
| `.improve/artifacts/IMP-219/feed-mobile-390.png` | fixed tree, 390×844. First card reads **"Oct 1, 2026"**. |
| `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` | **re-captured**, byte-identical to the first file (`sha256 61988696c4…`), so the baseline no longer bakes in the bug. |
| `/tmp/imp219/bug-reintroduced-1280.png` | M1 reintroduced, same data — reads "Sep 30, 2026", reproducing the old baseline exactly. |

Read back with the Read tool, both the fixed and the bug-reintroduced capture: the first card
("Geometric Similarity in VLM Low-Level Vision Representations", id `2610.00848`) reads
**Oct 1, 2026** with the fix and **Sep 30, 2026** without it. The shard agrees with the fix:

```
/usr/local/bin/python3.11 - <<'PY'   # web/public/data
papers-2026-W40.json | FOUND Geom-Sim paper: 2610.00848  published= 2026-10-01  updated= 2026-10-01
PY
```

and the live DOM, read with Playwright `evaluate` on port 5199:

```
{ text: "Oct 1, 2026", dateTime: "2026-10-01", innerWidth: 1280, innerHeight: 900, scrollY: 0 }
```

**The change from the old image is a date correction, not a layout change.** Because
`web/public/data` had been regenerated since the old baseline was taken (14,253 papers,
`generatedAt 2026-10-03T10:02:17Z`, vs 2,812 / `Oct 1, 2026` in the old image — the directory is
gitignored and not reproducible), a direct diff of old-vs-new would mix the data change in with
the code change. So the layout claim was measured instead as an A/B over **identical** data:
fixed capture vs M1-reintroduced capture.

```
$ /usr/local/bin/python3.11   # PIL ImageChops.difference
sizes: (1280, 900) (1280, 900)
changed-pixel bbox (x0,y0,x1,y1): (185, 617, 272, 630)
differing pixels inside bbox: 703 of 1131 (62.16%)
differing pixels as share of the 1152000-pixel frame: 0.0610%
region height 13 px, width 87 px -> a single text line
```

Every differing pixel in the entire 1280×900 frame lies inside an 87×13 px box on the date
line — the day number and the month initial. Zero pixels moved anywhere else. So this is a
text correction, not a layout change, proven rather than asserted.

**Honest caveat about the new baseline's other differences.** The new
`baseline-feed-desktop-1280.png` also differs from the old one in three ways that are *not*
mine, and a future verifier comparing against it should know which is which:

1. `14,253 papers` and `index generated Oct 3, 2026` instead of `2,812 papers` / `Oct 1, 2026`
   — `web/public/data` was regenerated by another agent; gitignored, so the old paper set is
   gone and cannot be restored.
2. An **"All"** category chip, and
3. `SORT` on its own row with the hint "Enter a search term to sort by relevance."

Items 2 and 3 are pre-existing component work that landed without a baseline re-capture, so
the 14-file baseline set had already drifted out of date before this item. Recorded in
`discovered-IMP-219.md`; fixing the other 13 baseline files is not this item's job and would
have meant overwriting artifacts this change was not asked to touch.

**Browser console clean** (profile §4.2): the fixed dev server emitted exactly three messages —
`[vite] connecting...`, `[vite] connected.`, and the React-DevTools info notice — which is the
documented dev-server baseline. **No `console.error`, no warning, no failed request.** All 31
network requests returned `200`, including `data/index.json` and all five
`data/papers-2026-W40.json`…`W36.json` shards.

---

## 6. Commands and results

All exit codes captured directly (`$?` after redirect, not through a pipe).

| Command | Result |
| --- | --- |
| `cd web && npm run typecheck` | **exit 0**, no output (`tsc --noEmit`) |
| `cd web && npm test` | **exit 0** — `Test Files 20 passed (20)`, `Tests 293 passed (293)`, `Duration 7.08s` |
| `cd web && npm run build` | **exit 0** — `Paper index present: public/data/index.json with 5 shard(s).`, `✓ 41 modules transformed.`, `dist/assets/index-Cn0orISQ.js 172.52 kB │ gzip: 55.23 kB`, `dist/assets/index-DLsgZ6xw.css 10.91 kB`, `✓ built in 579ms` |
| `/usr/local/bin/python3.11 -m unittest discover -s tests` | **exit 0** — `Ran 119 tests in 1.113s`, `OK` |
| `TZ=America/New_York\|Asia/Tokyo\|Pacific/Auckland\|Asia/Kolkata npx vitest run src/components/__tests__/PaperCard.test.tsx` | `Tests 1 passed (1)` in each |
| 8-zone probe render (§3) | 1 distinct line, sha256 `1b8153f9…` |
| 4 mutations in `/tmp/imp219/web` (§4) | 4/4 RED |
| `git diff --stat -- web/src` | `PaperCard.tsx`, `PaperCard.test.tsx` — nothing else |

**Test count is unchanged at 20 files / 293 tests.** No test was added or removed; the existing
case was tightened in place, which is what criterion 3 asks for.

**The Python suite reports 119, not the 118 quoted in the brief.** That is not this change: a
concurrent agent owns `scripts/` and `tests/`, and both `scripts/build_index.py` and
`tests/test_build_index.py` are modified in the working tree by that agent (the suite prints
`WARNING:root: cs.AI is recorded as truncated, not failed…` from its new coverage). This item
touched neither, `git diff --stat` for those paths belongs to that agent, and the run is green.

---

## 7. Documentation check — no doc changes needed

Requirement: check `readme.md` / `CONTRIBUTING.md` and report either way.

```
$ rg -n -i "formatDate|toLocaleDateString|time ?zone|local time|locale|midnight|day before|yesterday" \
     readme.md CONTRIBUTING.md
exit=1 (1 == no matches)
```

**Neither document describes date formatting at all.** The only date-adjacent sentences are
`readme.md:28` ("All metadata (title, authors, abstract, categories, dates) links out to arXiv")
and `readme.md:187` (the deploy cron "Sunday at 06:00 UTC"), neither of which becomes wrong
under this fix. `CONTRIBUTING.md` never mentions dates or rendering. **No doc change is
required, and none was made** — adding a paragraph about a formatting decision that IMP-125
still owns would be premature.

---

## 8. Sequenced follow-ups (not done here)

1. **IMP-125** (`NEEDS-HUMAN`, locale axis) must land with the sequencing note from its own
   criteria: if its "consolidate the duplicated helper" step merges `formatDate` and
   `formatGeneratedAt`, the consolidated helper **must** take the zone (or the parse) as a
   parameter. This report is the evidence that they are not interchangeable.
2. The remaining 13 baseline screenshots still show pre-fix dates and pre-existing UI drift —
   see `discovered-IMP-219.md`.