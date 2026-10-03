# Verify IMP-037 — Add a component render smoke test

**Verifier:** independent (did not write the change)
**Date:** 2026-10-03
**Host:** `EDT -0400`, `America/New_York`, Node from `web/node_modules`, locale `en-US`
**Scratch copy for all mutations:** `/var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/kilo/imp037-verify`
(rsync of the repo minus `.git`/`node_modules`, `node_modules` symlinked back). The working tree was
never mutated; `git diff --stat -- web/` was empty before and after.

## Verdict

**PASS.** All three acceptance criteria are met and every command the report claims was run was run
by me and reproduced. Two quality gaps and one judgement call are recorded below; none of them is a
criteria violation, and none of the implementer's factual claims turned out to be false.

---

## 1. Diff and scope audit

At the start of verification (`git status --porcelain -uall`):

```
 M .improve/FEATURES.md
?? .improve/reports/absorb-2026-10-03.md
?? .improve/reports/discovered-IMP-037.md
?? .improve/reports/impl-IMP-037.md
?? web/src/components/__tests__/PaperCard.test.tsx
```

- **`web/` is untouched.** `git diff --stat -- web/` prints nothing; `git diff --name-only` lists only
  `.improve/FEATURES.md`. So `web/vite.config.ts`, `web/package.json`, `web/package-lock.json`,
  `web/tsconfig.json` and every source component are byte-identical to `HEAD`. The only `web/`
  change is the one new untracked file.
- **`.improve/FEATURES.md` is modified, but not by IMP-037.** Its diff is the absorb round
  (the item tally at `:5`, the score-band rows, and four new items IMP-216 … IMP-219).
  `git diff -U0 -- .improve/FEATURES.md | grep -c "IMP-037"` → `0`. The `### IMP-037` block is
  untouched, which is what the report's §5 claim ("`.improve/FEATURES.md` was not touched") means
  in substance.
- **Concurrent, unrelated changes.** Mid-verification, four more tracked files became modified by
  other sessions: `scripts/build_index.py` (mtime `06:53:08`, +148/−12, adding
  `DEPLOY_OFFSET_BUDGET` / `reconcile_failed_categories` — IMP-216 work), and then
  `.github/workflows/deploy.yml`, `readme.md` and `tests/test_build_index.py`. None of them is
  IMP-037's and **none touches `web/`**, so the web gates measured in §3 are unaffected. Flagged so
  the item owner is not surprised by them in a combined diff — and so a reviewer does not attribute
  them to this item. I did not make any of these edits.
- **No debug leftovers, no secrets.** `rg "console\.(log|warn|debug)|debugger|TODO|FIXME|XXX|api[_-]?key|token|secret|password|Bearer "` over the new test and both reports → no matches. No `.orig`/`.rej`/`.bak`/scratch artifacts in the tree.
- **Scope discipline:** one 41-line test file, no source, no config, no dependency. Matches the
  report's claim exactly.

## 2. Criteria, one at a time

### AC-1 — renders `PaperCard` with a `Paper` fixture, asserts the title `href` is `absUrl` and the publication date renders

`web/src/components/__tests__/PaperCard.test.tsx:1-41`. It imports the real component
(`import { PaperCard } from "../PaperCard"`, `:4`) and the real type
(`import type { Paper } from "../../lib/types"`, `:3`), renders `<PaperCard paper={FIXTURE} />`
(`:28`), and asserts:

- `:30-31` `screen.getByRole("link", { name: FIXTURE.title })` → `getAttribute("href")` `toBe(FIXTURE.absUrl)`.
- `:36-39` `container.querySelector("time")` is non-null, its `dateTime` `toBe(FIXTURE.published)`, and its `textContent` contains `"2024"`.

**Is this the component's real contract, or something trivially true?** The real contract, with one
caveat I quantify in §4. Specifically:

- The `href` assertion is a genuine binding of *which* fixture field reaches the title anchor.
  `PaperCard` renders three anchors from two url fields (`PaperCard.tsx:77` title, `:128` arXiv,
  `:133` PDF), so the query could plausibly have picked the wrong one; I showed it does not (§4,
  mutation A).
- The `href` assertion is **not** duplicated anywhere in the existing 292 tests. `rg` over
  `web/src/**/__tests__` shows no test asserting an `href` *equals* `absUrl`; the closest,
  `paperCardNullUrls.test.tsx:37-47`, only asserts `href` is non-null and matches `/^https?:\/\//`.
- The date assertion is **entirely new**. `rg "dateTime|<time|querySelector\(\"time\"\)"` over the
  pre-existing suites returns **zero** hits — no existing test touches the rendered date. So this is
  the only place the date rendering is covered at all.
- `getByRole("link", { name: FIXTURE.title })` is unambiguous: the fixture is `abstractTruncated:
  false`, so the rendered link names are `"A Minimal Paper"`, `"arXiv"`, `"PDF"` — exactly one
  match. `container.querySelector("time")` is also unambiguous: `PaperCard` renders exactly one
  `<time>` (`:85`) and no other.

### AC-2 — file at the mirrored path, collected by the existing `test.include`, +1 file / +1 test

- Path is exactly the mandated mirror: `web/src/components/PaperCard.tsx` →
  `web/src/components/__tests__/PaperCard.test.tsx`. 1:1 holds; the other three components
  (`CollectionsView`, `FeedControls`, `PaperList`) still lack a mirrored sibling, which is what
  IMP-129/130/131/132 are for.
- Collection needs no config change: `web/vite.config.ts:16-20` already carries `src/**/*.test.tsx`,
  and the runner lists the file by path (`✓ src/components/__tests__/PaperCard.test.tsx (1 test) 268ms`).
- **Measured independently, not copied from the report.** In the scratch copy: with the new file
  deleted → `Test Files 19 passed (19)` / `Tests 292 passed (292)`; with it restored →
  `Test Files 20 passed (20)` / `Tests 293 passed (293)`. The delta is exactly +1 file, +1 test, and
  no pre-existing file was displaced.
- The spec's "36-test baseline" / "expect 4 files, 37 tests" are stale, as briefed. The report
  §2 says this plainly instead of pretending to hit them; correct call.

### AC-3 — `npm run typecheck` passes

`cd web && npm run typecheck` → `tsc --noEmit`, no output, exit 0. Re-ran in the scratch copy:
exit 0.

### Style imitation

Copied, deliberately and correctly:

| New file | Copied from |
| --- | --- |
| `import { render, screen } from "@testing-library/react"` + `import { describe, expect, it } from "vitest"` | `domEnvironment.test.tsx:1-2`, `paperCardNullUrls.test.tsx:1-2` (verbatim, same order) |
| module-level `const FIXTURE: Paper = { … }` with all 11 fields | `domEnvironment.test.tsx:6-18` (verbatim field-for-field, including `id`, `abstract`, `published`, `updated`, `absUrl`, `pdfUrl`; only `title` differs) |
| `const { container } = render(…)` | both neighbours |
| `screen.getByRole("link" | "heading", { name })` idiom | `paperCardNullUrls.test.tsx:94-97` |
| no `jest-dom` matchers — `toBe`/`toBeNull`/`toContain` only | whole suite (correct: `@testing-library/jest-dom` is genuinely not a dependency) |
| two-space indent, double quotes, semicolons, docblock explaining *why* a field exists | whole suite, incl. `paperCardNullUrls.test.tsx:6-14` |

Clashes / smells, none blocking:

1. **Fixture duplication.** The new `FIXTURE` is a near-verbatim copy of `domEnvironment.test.tsx`'s
   (same arXiv id, same abstract string, same dates, same URLs). `paperCardNullUrls.test.tsx` solved
   the same problem locally with a `paper(overrides)` factory. Two identical literals in two files
   is a small maintenance smell; a shared factory would be better, and the report does not mention it.
2. **"minimal" is arguable.** The fixture is the *complete* `Paper` with nothing nulled. I read that
   as the right call for a plain-render smoke test — nulling anything would divert it into
   `safeHref`/`tag--primary` branches that `paperCardNullUrls.test.tsx` already owns — but it is a
   fuller object than "minimal" literally means.
3. **No trailing newline.** `wc -l` → 40 for a 41-line file; the last byte is `}` not `\n`. Trivia:
   9 of the repo's 20 test files also lack one (including `domEnvironment.test.tsx`, the file this
   one imitates), there is no `.editorconfig`/prettier/eslint config, and no linter exists
   (profile §4.5). The report's "41 lines" is right about the line count and the missing newline is
   inherited from its model, so I am logging this as a nit and not an issue.

## 3. Gates, with my own numbers

```
$ cd web && npm test
 ✓ src/components/__tests__/PaperCard.test.tsx (1 test) 268ms
 Test Files  20 passed (20)
      Tests  293 passed (293)
   Duration  7.24s

$ cd web && npm run typecheck
> tsc --noEmit
typecheck exit=0

$ cd web && npm run build
Paper index present: public/data/index.json with 5 shard(s).
✓ 41 modules transformed.
dist/assets/index-DLsgZ6xw.css 10.91 kB │ gzip: 2.86 kB
dist/assets/index-Cz853rdl.js 172.50 kB │ gzip: 55.22 kB
✓ built in 496ms
build exit=0
```

**20 files / 293 tests, all passing. Typecheck green. Build green.** Matches the report's counts
exactly (durations differ, which is normal).

### Dependency / config hygiene

- `web/package.json` and `web/package-lock.json` unmodified (`git diff --name-only` shows neither).
- **`@types/node` was not added.** It is absent from `web/package.json`, and
  `ls web/node_modules/@types/` lists only `aria-query babel__* estree prop-types react react-dom`.
  The `"@types/node"` strings in `package-lock.json:2629,2639,2727,2737` are Vite's pre-existing
  optional-peer declarations inside an unmodified lockfile, not an install. The new test resolves
  `HTMLElement`/`Element`/`querySelector` through `tsconfig.json:18` `"types": ["vite/client"]` plus
  `lib: ["ES2020","DOM","DOM.Iterable"]` — proven by typecheck exit 0 with `strict`,
  `noUnusedLocals`, `noUnusedParameters` all on.
- **`test.include` unchanged.** `web/vite.config.ts` is untouched since `d57b77c`; the two `src/`
  globs at `:17-18` are IMP-005's/IMP-028b's, not this item's. No `lint` script invented.

## 4. Non-vacuity — reproduced, not accepted

I made seven mutations in the scratch copy. Two are the implementer's; five are mine. Every
mutation was reverted and the pristine file re-verified green afterwards (`Tests 1 passed`).

| # | Mutation | Result | Quote |
| --- | --- | --- | --- |
| **A** *(implementer's Break A)* `href` asserted against `FIXTURE.pdfUrl` | **RED** ✅ | reproduces his output byte-for-byte | `AssertionError: expected 'https://arxiv.org/abs/2401.00001' to be 'https://arxiv.org/pdf/2401.00001' // Object.is equality` at `:31:44` |
| **B** *(implementer's Break B)* `toContain("2024")` → `toContain("1999")` | **RED** ✅ | reproduces his output byte-for-byte, and independently confirms the date bug | `AssertionError: expected 'Jan 1, 2024' to contain '1999'` / `Received: "Jan 1, 2024"` at `:39:36` |
| **F** *(mine)* `<time dateTime={paper.published}>` → `dateTime={paper.updated}` | **RED** ✅ | the `dateTime` assertion is not vacuous — **he never broke this one, I did** | `expected '2024-01-03' to be '2024-01-02'` |
| **G** *(mine)* `<time>` replaced by `<span className="paper__date">` | **RED** ✅ | `expect(published).not.toBeNull()` is load-bearing | `expected null not to be null` |
| **C** *(mine)* `formatDate` gains `date.setUTCMonth(date.getUTCMonth() + 1)` — card shows **Feb 1, 2024** for a Jan 2 paper | **GREEN** ❌ **survives** | `Tests 1 passed (1)` | — |
| **D** *(mine)* `formatDate` returns the literal `"2024"` | **GREEN** ❌ **survives** | `Tests 1 passed (1)` | — |
| **E** *(mine)* text renders `formatDate(paper.updated)` while `dateTime` stays `paper.published` | **GREEN** ❌ **survives** | `Tests 1 passed (1)` | — |

So: **every assertion except the visible-text one is proven non-vacuous, and the visible-text
assertion is proven weak.**

### Is `<time dateTime>` + a year substring strong enough?

**No, and I can put a number on it.** Mutation C is the answer to the question asked: a card
displaying **February** for a January paper — a badly wrong date, exactly the class of bug this
file exists to prevent — keeps the test green, because the text still contains `2024` and the
`dateTime` attribute (which the component derives from `paper.published`, not from `formatDate`) is
untouched. Mutation D shows the assertion is satisfied by a constant string. Mutation E shows the
visible text can show the *wrong field* entirely (`updated`, `"Jan 2, 2024"`) with no red.

That is a real gap, and the honest framing is: `dateTime` is asserted (so the machine-readable half
is locked to the right field) but **the visible rendering is not asserted at all** — the file pins
the `<time>` element's existence and its attribute, and the year, nothing more. The test's own
comment (`test:33-35`) states this accurately ("the text only has to be there"), so this is a
disclosed limitation rather than an overclaim, but the file's name and AC-1's "the publication date
renders" invite a reader to believe more than it checks.

**One caveat in the test's favour, which I checked rather than assumed:** the report's §6 admits only
`America/New_York` was exercised. I closed that gap — the pristine test is green under five zones:

```
UTC                   Tests 1 passed (1)
Asia/Tokyo            Tests 1 passed (1)
America/New_York      Tests 1 passed (1)
Europe/Berlin         Tests 1 passed (1)
Pacific/Honolulu      Tests 1 passed (1)
```

So there is no TZ flakiness risk, and the implementer's reason for weakening (a hardcoded
`"Jan 2, 2024"` fails in New York) is factually correct.

## 5. The date bug — independent assessment

**The implementer's claim is TRUE and the severity is, if anything, understated.**

`PaperCard.formatDate` (`PaperCard.tsx:20-30`) re-anchors a bare ISO date at midnight **UTC** and
formats it in the **local** zone (`toLocaleDateString(undefined, …)`, no `timeZone`). `published`
arrives from the pipeline as a zoneless calendar date (`iso_date`, `scripts/build_index.py:101`,
`value.date().isoformat()`). I reproduced the mechanism with plain Node, not the app:

```
America/New_York       default: Jan 1, 2024 | UTC-pinned: Jan 2, 2024
Europe/London          default: Jan 2, 2024 | UTC-pinned: Jan 2, 2024
UTC                    default: Jan 2, 2024 | UTC-pinned: Jan 2, 2024
Asia/Tokyo             default: Jan 2, 2024 | UTC-pinned: Jan 2, 2024
Pacific/Honolulu       default: Jan 1, 2024 | UTC-pinned: Jan 2, 2024
```

Host: `date +"%Z %z"` → `EDT -0400`. So: every reader west of UTC sees yesterday's date on every
card — the whole Americas.

**Two findings the implementer did not report, both material to the owner's decision:**

1. **The committed baseline screenshot bakes the bug in.** The first card in
   `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` reads **"Sep 30, 2026"**, while the
   shard it came from says otherwise:
   ```
   papers-2026-W40.json | published = 2026-10-01 | updated = 2026-10-01
   ```
   The reference artifact every screenshot-comparison criterion is measured against currently
   *encodes the wrong date*. **The day the bug is fixed, every baseline comparison that includes a
   card date will show a diff** — IMP-125 criterion 3 ("a rendered card date is unchanged from the
   baseline in the reference locale") fails by construction, and the baseline has to be re-captured.
   Anyone treating that diff as a regression will revert a correct fix.

2. **The fix must not be applied blanket-style to the other helper.** `App.tsx:63-71`
   `formatGeneratedAt` parses `manifest.generatedAt` with `new Date(value)` — a real *instant* — so
   local rendering is correct there. Adding `timeZone: "UTC"` to both helpers (the obvious
   "fix both, they are identical" move, and IMP-125 criterion 2 asks that "both call sites make the
   same choice") would introduce a *new* off-by-one-day bug in the hero's "index generated" line.
   The right fix is `timeZone: "UTC"` in `PaperCard.formatDate` **only**, or parsing the bare date as
   local midnight (`new Date(value)`).

### Was weakening the assertion the right call?

**Defensible inside IMP-037's scope, wrong as an end state.** Reasoning, in the owner's terms:

- *Not fixing it here was correct.* IMP-037 is a test item whose criteria pin "+1 file, +1 test"
  and touch no source. Changing what the site displays inside it would have been scope creep, and
  the implementer's refusal is the right instinct.
- *Weakening rather than writing a deliberately-red test was the correct call for a test that must
  pass.* A failing assertion cannot be merged.
- *But the weakening hides rather than tracks the defect.* The new file now contains a comment
  normalising the wrong behaviour, the test is green, and the only remaining signal is a sentence in
  a side report. `discovered-IMP-037.md:61-64` goes further and generalises "**no test anywhere may
  hardcode the visible date string**" — that is true *only while the bug is unfixed*, and the next
  agent will read it as a standing rule and never re-tighten the assertion. Flag it in the report
  file if the fix lands.

**Is the fixture capable of exposing it? Yes — maximally.** `published: "2024-01-02"` is anchored at
`00:00Z`, so it is exactly the value that shifts; the implementer's own red output printed
`Received: "Jan 1, 2024"`, which is the proof. Only a fixture with a mid-day anchor
(e.g. `"2024-01-02T12:00:00Z"`-shaped data, which the producer never emits) would be immune. So the
fixture is not what softened the test; the assertion is.

**Recommendation to the item owner (in priority order):**

1. **Do not treat this as filed-and-forgotten.** The defect is currently in *no* backlog item.
   `rg "formatDate|toLocaleDateString|timeZone" .improve/FEATURES.md` finds only **IMP-125**
   (`FEATURES.md:2668`), which is `NEEDS-HUMAN`, already names both helpers
   (`PaperCard.tsx:20-30`, `App.tsx:106-116`) and already demands a locale decision — but says
   **nothing about the timezone axis**. Either widen IMP-125's criteria to include the `timeZone`
   decision (and add the "do not touch `formatGeneratedAt`" warning above), or file it as a sibling
   item. Leaving it only in a `discovered-*.md` is how the baseline screenshot stays wrong.
2. **Sequence the fix before the assertion.** Fix `PaperCard.formatDate` first, then tighten this
   test to `expect(published?.textContent).toBe("Jan 2, 2024")` and re-capture
   `.improve/artifacts/baseline/baseline-feed-desktop-1280.png`. After the fix the current
   year-only assertion is not just weak, it is *misleading* — it would pass against a February.
3. **Cheap interim hardening, if the fix slips a round.** Add
   `expect(published?.textContent).toMatch(/^\w{3} \d{1,2}, 2024$/)` — kills mutations C and D while
   staying locale-portable; it still would not kill E. Or pin the zone for this file
   (`process.env.TZ = "UTC"` before any `Date` formatting, which Node honours at runtime) and assert
   the exact string without touching the component. The first option is less clever and safer.

## 6. Report-claim audit

Every factual claim in `impl-IMP-037.md` that I could test, checked. **No false claim found.**

| Claim | Verdict |
| --- | --- |
| One new file, no source or config change | ✅ `git diff --stat -- web/` empty |
| Before 19/292, after 20/293 | ✅ reproduced both in the scratch copy (§3) |
| `npm run typecheck` exit 0 | ✅ reproduced |
| `npm run build` exit 0, 5 shards, "✓ 41 modules transformed", `index-Cz853rdl.js 172.50 kB` | ✅ reproduced verbatim, including the asset hash |
| `git status --porcelain` → one untracked path | ✅ at report time (a second agent has since touched `scripts/build_index.py`, §1) |
| Break A red output | ✅ reproduced byte-for-byte |
| Break B red output, incl. `Received: "Jan 1, 2024"` | ✅ reproduced byte-for-byte |
| `record_from_result` at `scripts/build_index.py:121-138` | ✅ `grep -n` → `121:def record_from_result`, body ends `:138` |
| `.improve/FEATURES.md` not touched by this item | ✅ 0 `IMP-037` lines in its diff |
| `@types/node` not added | ✅ absent from manifest and from `node_modules/@types/` |
| `test.include` already carries `src/**/*.test.tsx` | ✅ `vite.config.ts:18`, untouched since `d57b77c` |
| `tsconfig.json` untouched and `include: ["src", …]` already covers the file | ✅ |
| No `npm run lint` added; no linter exists | ✅ `package.json:6-13` |
| `CONTRIBUTING.md:7` (`web/src/**/__tests__/`) covers the new path | ✅ |
| §6: "Only the host timezone was exercised" | ✅ honest — and I closed it, 5 zones green (§4) |
| REPO_PROFILE's stale `record_from_result` cite (`:97-114`, and `:102-114` at `:679`) | ✅ real: `def iso_date` is at `:101`, `def record_from_result` at `:121` |
| REPO_PROFILE §5.3 enumerates only two test directories | ✅ `REPO_PROFILE.md:572-578`; `CONTRIBUTING.md:84-85` likewise — the doc-gap finding stands |

## 7. Issues for the item owner

Not criteria failures; none blocks the merge. Ranked.

1. **[medium — tracked elsewhere] The `formatDate` timezone defect has no backlog item.** See §5
   recommendation 1. Widen IMP-125 or file a sibling; do not leave it in a `discovered-*.md`.
2. **[medium — this file] The visible-date assertion is too weak to catch a wrong month/day.** §4
   mutations C/D/E. Minimum fix: `toMatch(/^\w{3} \d{1,2}, 2024$/),` or pin `TZ` and assert the exact
   string after the `formatDate` fix. This is a one-line change to a one-line change.
3. **[medium — process] The baseline screenshot encodes the bug.** Re-capture
   `baseline-feed-desktop-1280.png` when the fix lands, or every date-bearing screenshot comparison
   fails for a reason that looks like a regression. §5 finding 1.
4. **[low — loop state] `REPO_PROFILE.md`'s counts are now stale by one.** `:154` ("19 files, 292
   tests"), `:206-208`, `:237` ("146 of the 292"), `:387` ("120 of the 292"), `:1021` ("vitest
   292/292 across 19"). The implementer was right not to edit loop state; the loop owner must
   re-measure to 20/293.
5. **[low — this file] `FIXTURE` duplicates `domEnvironment.test.tsx`'s fixture field-for-field.**
   A shared `paper(overrides)` factory (the `paperCardNullUrls.test.tsx` idiom) or a move into
   `src/__tests__/_fixtures` would avoid two literals drifting. Cosmetic at `S`-effort.
6. **[trivial] No trailing newline**, unlike 11 of the 20 test files. Matches
   `domEnvironment.test.tsx`, its model. Ignore.
7. **[trivial] The report says "41 lines"; `wc -l` says 40** — same cause as (6), the file has 41
   lines and 40 newlines. The report's number is the correct line count.

## 8. Commands run by this verifier

```
git status --porcelain -uall ; git diff --name-only ; git diff --stat -- web/
cd web && npm test            -> Test Files 20 passed (20) / Tests 293 passed (293), exit 0
cd web && npm run typecheck   -> exit 0
cd web && npm run build       -> exit 0, "✓ 41 modules transformed."
# scratch mutations (7), each reverted:
npx vitest run src/components/__tests__/PaperCard.test.tsx        # red/green per §4 table
npx vitest run                                                   # 19/292 without the file, 20/293 with it
TZ=UTC|Asia/Tokyo|America/New_York|Europe/Berlin|Pacific/Honolulu npx vitest run <file>   # 1 passed each
node -e '… toLocaleDateString(undefined, {…}) / {…, timeZone:"UTC"}'  # 5-zone matrix, §5
python3 (grep papers-2026-W40.json for the baseline card's title)  # published = 2026-10-01
```