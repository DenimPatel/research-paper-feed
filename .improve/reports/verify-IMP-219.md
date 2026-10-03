# Verify IMP-219 — Render a paper's publication date in UTC

**Verifier:** independent (did not write the change)
**Date:** 2026-10-03
**Host:** `America/New_York` (the zone that was broken), Node from `web/node_modules`, runner locale `en-US`
**Scratch copy for every mutation and every TZ run:** `/var/folders/ng/_4tf8hq1557b_4p06cbyrjhw0000gn/T/kilo/imp219-verify`
(rsync of the repo minus `.git`/`node_modules`, `node_modules` symlinked back). **The working tree was
never mutated** — `git status --porcelain` and `git diff --stat` are byte-identical before and after
this verification (see §8). No `git restore`/`checkout`/`clean`/`stash` was run at any point.

## Verdict

**PASS.** All six acceptance criteria are met. Every command the report claims was run, I ran
myself, and every load-bearing claim reproduced. The timezone fix is correct and **not
over-broad** — I tried hard to break it and could not. Four mutations reproduced red, matching the
implementer's quoted output byte-for-byte.

Three non-blocking issues are recorded in §7. One of them is material enough that the item owner
should see it before this test becomes someone else's mystery failure: **the strengthened
assertion is locale-fragile in a way the old one was not** (§7.1), and the spec clause that
licensed it ("`timeZone: "UTC"` making the expectation locale-portable") is factually wrong.
None of the three is a criteria violation, so the verdict stands.

---

## 1. Diff and scope audit

```
$ git diff --stat
 .improve/FEATURES.md                            |  6 +++---
 scripts/build_index.py                          | 11 +++++++++--
 tests/test_build_index.py                       | 17 +++++++++++++++++
 web/src/components/PaperCard.tsx                | 14 ++++++++++++++
 web/src/components/__tests__/PaperCard.test.tsx | 13 +++++++++----
 5 files changed, 52 insertions(+), 9 deletions(-)

$ git diff --stat -- web/src
 web/src/components/PaperCard.tsx                | 14 ++++++++++++++
 web/src/components/__tests__/PaperCard.test.tsx | 13 +++++++++----
 2 files changed, 23 insertions(+), 4 deletions(-)
```

**Criterion 6's confinement claim is exact.** `git diff --stat -- web/src` lists `PaperCard.tsx`
and `PaperCard.test.tsx` and nothing else, +23/−4.

**`App.tsx` is not in the diff, and is byte-identical to HEAD** — the criterion-2 requirement and
the single most important negative claim in the report:

```
$ git diff --quiet -- web/src/App.tsx && echo "YES - byte-identical"
YES - byte-identical
```

`formatGeneratedAt` (`App.tsx:64-74`) still reads, in full and unmodified:

```ts
function formatGeneratedAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
```

It still parses `manifest.generatedAt` as a real instant with no `timeZone`, so the hero's
"index generated" line stays in local time. **The trap the report warns about was avoided.**

**The three non-`web/` modified files are not this item's.** I read all three diffs:

- `scripts/build_index.py` + `tests/test_build_index.py` — the `dedupe_records` shallow-copy
  clone and a new `DedupeRecordsTests.test_merge_does_not_mutate_input_records`. This is
  **IMP-042**, a concurrent Python item (its own `impl-IMP-042.md` is untracked in the same
  working tree). Nothing in it touches `web/`.
- `.improve/FEATURES.md` — the IMP-042 `Status: TODO → DONE` line and its corrected line cites.
  `git diff -U0 -- .improve/FEATURES.md | grep -c "IMP-219"` → `0`: the `### IMP-219` block is
  untouched, which is what "the spec was not edited" means in substance.

So the combined diff the owner will review contains two agents' work; only the two `web/src` files
are IMP-219's. Flagged so neither agent is credited with or blamed for the other's change.

**Hygiene.** No debug leftovers: `git diff -- web/src | grep -E "^\+" | grep -iE
"console\.(log|warn|debug)|debugger|TODO|FIXME|XXX|\.only\(|\.skip\(|process\.env"` → no
matches. No `.only`/`.skip` (the full 293-test run agrees with the file-level runs). No new
dependency: `web/package.json`, `package-lock.json`, `vite.config.ts`, `tsconfig.json`,
`index.html`, `styles.css` are all absent from `git diff --name-only`. **No `@types/node`** —
`ls web/node_modules/@types/` is `aria-query babel__* estree prop-types react react-dom`, exactly
as before. No `lint` script exists to run (`package.json:6-13` has only `dev`/`build`/`preview`/
`test`/`test:watch`/`typecheck`), so the report's "no lint added" is consistent with the repo.

**The source diff itself.** One functional line — `timeZone: "UTC"` at `PaperCard.tsx:42` — plus a
13-line explanatory docblock, nothing reformatted. The test diff replaces a 3-line comment that
normalised the bug with a 6-line comment that states what is now pinned, and swaps one assertion.
Both comments are unusually good: they record *why* UTC, and they explicitly cross-reference
`formatGeneratedAt` as the deliberate counter-example, which is the trap the next agent will hit.

---

## 2. The timezone claim — reproduced independently, not taken on trust

I did not use the report's sha256. I rendered the **real `PaperCard`** through the **real test
runner** (a throwaway `zz-tzprobe.test.tsx` in the `/tmp` copy, `render(<PaperCard paper={…} />)`,
reading `container.querySelector("time")`) across **15 zones × 6 dates**, including every awkward
offset the brief named and both extremes.

```
$ for z in "${zones[@]}"; do TZ="$z" npx vitest run src/components/__tests__/zz-tzprobe.test.tsx …; done
```

Input dates: `2024-01-02` (the fixture — the only date that shifts under the bug, because it sits
on `00:00Z`), `2024-02-29` (leap day), `2024-03-10` (US DST spring-forward), `2024-06-15`,
`2024-11-03` (US DST fall-back), `2024-12-31` (year boundary).

Zones: `UTC`, `America/New_York`, `America/Los_Angeles`, `Pacific/Honolulu`, `Europe/Berlin`,
`Asia/Kolkata` (+05:30), `Asia/Kathmandu` (+05:45), `Australia/Lord_Howe` (+10:30/+11),
`Pacific/Chatham` (+12:45/+13:45), `Pacific/Auckland` (+13), `Pacific/Kiritimati` (+14),
`Pacific/Midway` (−11), `Etc/GMT+12` (−12), `Antarctica/Troll`, `Asia/Tokyo`. That is every zone
from UTC−12 to UTC+14 plus all three sub-hour offsets the brief asked for.

```
distinct zones exercised: 15 rows: 90
  in=2024-01-02  distinct=1  ['"Jan 2, 2024"']
  in=2024-02-29  distinct=1  ['"Feb 29, 2024"']
  in=2024-03-10  distinct=1  ['"Mar 10, 2024"']
  in=2024-06-15  distinct=1  ['"Jun 15, 2024"']
  in=2024-11-03  distinct=1  ['"Nov 3, 2024"']
  in=2024-12-31  distinct=1  ['"Dec 31, 2024"']
rows where dateTime != published: 0 (none)
```

**90 renders, exactly one distinct output per input date, across UTC−12 to UTC+14 including
half-hour, 45-minute and 2¾-hour offsets. No zone differs. `dateTime` never disagrees with the
input.** Criterion 1 is met, and met more broadly than the report claimed (15 zones × 6 dates vs
their 8 × 1).

### The control — proof my probe can detect the bug at all

A probe that always prints one line proves nothing, so I removed the fix in the scratch copy and
re-ran the identical probe:

```
PROBE	tz=UTC	            in=2024-01-02	out="Jan 2, 2024"	dateTime=2024-01-02
PROBE	tz=America/New_York  in=2024-01-02	out="Jan 1, 2024"	dateTime=2024-01-02
PROBE	tz=Pacific/Honolulu  in=2024-01-02	out="Jan 1, 2024"	dateTime=2024-01-02
PROBE	tz=Asia/Kolkata      in=2024-01-02	out="Jan 2, 2024"	dateTime=2024-01-02
PROBE	tz=Asia/Kathmandu    in=2024-01-02	out="Jan 2, 2024"	dateTime=2024-01-02
PROBE	tz=Pacific/Chatham   in=2024-01-02	out="Jan 2, 2024"	dateTime=2024-01-02
PROBE	tz=Pacific/Auckland  in=2024-01-02	out="Jan 2, 2024"	dateTime=2024-01-02
PROBE	tz=Pacific/Midway    in=2024-01-02	out="Jan 1, 2024"	dateTime=2024-01-02
```

The probe **does** diverge without the fix, and it diverges in exactly the predicted half of the
world — west of Greenwich only. Note the second column against the third: `out="Jan 1, 2024"`
beside `dateTime=2024-01-02`. That is the self-contradiction from the spec, visible on one
element. The fix closes it in all 90 renders.

### On the report's sha256

The report quotes `shasum -a 256` = `1b8153f9cb392b5988ef8cf95be100a912af0899d9bd5d6805446cd8a62b2556`
over 8 lines whose exact stdout format is not recorded, so that specific digest is **not
independently reproducible**. Its substantive claim — "distinct rendered lines: 1" — I confirmed
far more broadly and by a method that does not depend on the probe's formatting. Recommendation in
§7.4: quote the distinct-count, not a hash over an unrecorded format.

---

## 3. Non-vacuity — all four mutations reproduced, plus a fifth I found

Driver: `/tmp/imp219-mutate.py`, operating only on the `/tmp` copy. Each mutation was reverted and
the pristine file re-verified green afterwards. Exit codes captured directly, not through a pipe.

| # | Mutation | Result | Quoted output |
| --- | --- | --- | --- |
| **M1** | the original bug: delete only the `timeZone: "UTC"` line, `TZ=America/New_York` | **RED** ✅ | `AssertionError: expected 'Jan 1, 2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "Jan 1, 2024"` at `src/components/__tests__/PaperCard.test.tsx:44:36` |
| **M2** | Feb-for-Jan: `date.setUTCMonth(date.getUTCMonth() + 1)`, `TZ=UTC` | **RED** ✅ | `AssertionError: expected 'Feb 2, 2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "Feb 2, 2024"` at `:44:36` |
| **M3** | hardcoded year: `formatDate` returns `"2024"`, `TZ=UTC` | **RED** ✅ | `AssertionError: expected '2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "2024"` at `:44:36` |
| **M4** | `updated`-for-`published`: `{formatDate(paper.updated)}`, `dateTime` still `paper.published`, `TZ=UTC` | **RED** ✅ | `AssertionError: expected 'Jan 3, 2024' to be 'Jan 2, 2024' // Object.is equality` / `Expected: "Jan 2, 2024"` / `Received: "Jan 3, 2024"` at `:44:36` |

All four reproduce the implementer's quoted output **byte-for-byte**, and all four exit 1 with
`Test Files  1 failed (1)` / `Tests  1 failed (1)`.

**M2/M3/M4 are exactly the three mutations `verify-IMP-037.md` §4 proved survived the old
`toContain("2024")` assertion** (its C, D and E). IMP-037's verifier said: "every assertion except
the visible-text one is proven non-vacuous, and the visible-text assertion is proven weak." The
strengthened assertion closes that gap completely. M1 additionally proves the pre-fix
implementation is now red, so the test would have caught the bug.

Pristine re-verified after all mutations:

```
### pristine restored  [TZ=America/New_York]  exit=0
 ✓ src/components/__tests__/PaperCard.test.tsx (1 test) 121ms
 Test Files  1 passed (1)
```

### The fourth mutation: deleting the `Number.isNaN` guard stays GREEN

| # | Mutation | Result | Notes |
| --- | --- | --- | --- |
| **V5** | `formatDate`'s NaN guard returns `""` instead of `value` | **GREEN** ❌ **survives** | `Tests  1 passed (1)` |
| **V6** | delete the `if (Number.isNaN(date.getTime())) return value;` guard entirely | **GREEN** ❌ **survives** | `Tests  1 passed (1)` |

This is not a cosmetic survivor — it is a **user-visible correctness regression with zero coverage
anywhere in the 293-test suite**. Measured by rendering the real component with malformed input:

```
--- guard DELETED:
MALFORMED  in="not-a-date"  renders="Invalid Date"
MALFORMED  in="2024-13-45"  renders="Invalid Date"
MALFORMED  in=""            renders="Invalid Date"
--- guard PRESENT (shipped):
MALFORMED  in="not-a-date"  renders="not-a-date"
MALFORMED  in="2024-13-45"  renders="2024-13-45"
MALFORMED  in=""            renders=""
```

So the guard is load-bearing: delete it and a card with an unparseable `published` renders the
literal string **"Invalid Date"** to the reader. A suite-wide grep for coverage —
`grep -rn "Invalid Date|NaN|not-a-date|malformed" web/src/__tests__ web/src/components/__tests__`
filtered to date-shaped matches — returns **nothing**. IMP-037's verifier already ran mutation F
and G against the *attribute* and the *element's existence*; nobody ever probed the guard.

This one stings slightly because `impl-IMP-219.md` §2 cites the guard as an explicit **reason to
prefer `timeZone: "UTC"`**: "It keeps the `Number.isNaN(date.getTime())` guard meaningful". The
report leans on a guard that no test would notice losing. Not a criteria violation — the guard is
pre-existing and out of scope for a one-line timezone fix — but it belongs on the record (§7.2).

### Survivors I examined and rejected as non-defects

I want to be explicit that I looked for more and these do **not** count as findings:

| Mutation | Result | Why it is not a defect |
| --- | --- | --- |
| **V7** drop the `T00:00:00Z` anchor → `new Date(value)`, keep `timeZone: "UTC"` | GREEN | The ES spec parses a date-only ISO form as **UTC**, so with the zone pinned the output is byte-identical. Semantically equivalent, not a weakening. |
| **V8** `timeZone: "UTC"` → `"Etc/GMT"` | GREEN | Same zone. A rename, not a behaviour change. |
| **V9** swap the `month: "short"` / `day: "numeric"` option keys | GREEN | `Intl` orders fields by locale, so in `en-US` the key order is irrelevant. Latent only in D-M-Y locales — see §7.1. |
| **V10** add `weekday: "short"` | **RED** ✅ | `expected 'Tue, Jan 2, 2024' to be 'Jan 2, 2024'` — extra fields are caught too. |

---

## 4. Is the fix over-broad? No.

I attacked this from three directions and could not find new wrongness.

### 4.1 A `published` that genuinely carries a time component — cannot be misreported

The brief asks specifically whether forcing UTC misreports a time-bearing value. It does not, and
the reason is structural: `formatDate` **appends** `T00:00:00Z` to whatever it is given, so a
value that already has a time makes the string unparseable, the `NaN` guard fires, and the **raw
value is returned verbatim**. Verified both pre-fix and post-fix:

```
"2024-01-02"            | anchored+UTC: Jan 2, 2024            | anchored+LOCAL: Jan 1, 2024
"2024-01-02T00:00:00Z"  | anchored+UTC: (NaN guard -> raw)      | anchored+LOCAL: (NaN guard -> raw)
"2024-01-02T14:30:00Z"  | anchored+UTC: (NaN guard -> raw)      | anchored+LOCAL: (NaN guard -> raw)
"2024-01-02T14:30:00"   | anchored+UTC: (NaN guard -> raw)      | anchored+LOCAL: (NaN guard -> raw)
"2024-1-2"              | anchored+UTC: (NaN guard -> raw)      | anchored+LOCAL: (NaN guard -> raw)
"" / "garbage" / "2024-13-45" | anchored+UTC: (NaN guard -> raw) | anchored+LOCAL: (NaN guard -> raw)
```

The two columns are **identical except on the bare day**, which is the one input the fix targets.
A time-bearing value was already falling through to the raw-value branch before the change and
still does. The fix cannot misreport it because it never reaches the formatter.

**And the producer never emits one anyway.** I checked all 5 shipped shards rather than trusting
the prose:

```
shards: 5
total papers: 14253
distinct published string lengths: [10]
published values that are NOT YYYY-MM-DD: 0
```

14,253 of 14,253 are bare `YYYY-MM-DD`, consistent with `iso_date` (`build_index.py:140-150`)
returning `value.date().isoformat()`. So the hypothetical is doubly moot.

### 4.2 `updated` — never rendered, so nothing to be inconsistent with

`grep -rn "updated" web/src/components/PaperCard.tsx` → **zero hits**. `formatDate` has exactly one
call site, `PaperCard.tsx:99`, and it is passed `paper.published`. `updated` reaches no rendered
surface anywhere in `web/src` outside test fixtures. So there is no consistency question to answer
and no second date that could disagree. (Mutation M4 confirms the test would catch it if a future
change started rendering it.)

### 4.3 `dateTime` now agrees with the visible text — everywhere

Across all 90 renders, `dateTime` equals the producer's `published` in every row, and the visible
text equals that same day in every row. Pre-fix, west-of-UTC readers saw `dateTime="2024-01-02"`
next to the words "Jan 1, 2024" on the same element. **That self-contradiction is resolved, and
the fix is precisely what resolves it.**

### 4.4 A trap in the spec's *alternative* route, which this item did not walk into

Criterion 1 offers two routes. I checked whether route (b) — "parse the bare date as local
midnight instead of UTC midnight" — is actually implementable as a reasonable reader would spell
it. It is **not**, in the obvious spelling:

```
UTC                | new Date(v) local: Jan 2, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
America/New_York   | new Date(v) local: Jan 1, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
America/Los_Angeles| new Date(v) local: Jan 1, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
Pacific/Honolulu   | new Date(v) local: Jan 1, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
Asia/Kolkata       | new Date(v) local: Jan 2, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
Asia/Kathmandu     | new Date(v) local: Jan 2, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
Pacific/Chatham    | new Date(v) local: Jan 2, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
Pacific/Auckland   | new Date(v) local: Jan 2, 2024  | new Date(v+T00:00:00) local: Jan 2, 2024
```

`new Date("2024-01-02")` — a date-only ISO form — is parsed as **UTC** by the ES spec, so route
(b) written that way re-creates the original bug exactly. Route (b) only works by dropping the
`Z`: `new Date(`${value}T00:00:00`)`. **The implementer chose route (a), so this cost the project
nothing** — but an agent who later "simplifies" to the local-midnight parse would ship the bug
back, and the spec as written invites exactly that. Worth recording against the spec (§7.3).

---

## 5. The re-captured baseline screenshot is genuine, and genuinely different

`.improve/artifacts/` is git-excluded, so none of this is committed — confirmed, and correct:

```
$ git check-ignore -v .improve/artifacts/baseline/baseline-feed-desktop-1280.png
.git/info/exclude:51:.improve/artifacts/	.improve/artifacts/baseline/baseline-feed-desktop-1280.png

$ git ls-files .improve/artifacts/          # (empty = nothing tracked)
```

**The file really was updated, and only that one file:**

```
2026-10-01 22:57:44  baseline-collections-desktop-1280.png
2026-10-01 22:58:24  baseline-collections-empty-mobile-390.png
…
2026-10-03 08:24:58  baseline-feed-desktop-1280.png      <-- re-captured today
2026-10-01 22:58:46  baseline-feed-empty-search-desktop-1280.png
2026-10-01 22:58:04  baseline-feed-mobile-390.png
…
```

Twelve of the fourteen baseline files keep their Oct 1 mtimes; the one this item was asked to fix
was rewritten. Its digest matches the report's quoted prefix and is byte-identical to the item's
own capture:

```
$ shasum -a 256 .improve/artifacts/baseline/baseline-feed-desktop-1280.png \
            .improve/artifacts/IMP-219/feed-desktop-1280.png
61988696c454bb36b0535b2daa4e5c56e1ef1bcf1ad3c7b2cb469f64c4d0cc6d  baseline-feed-desktop-1280.png
61988696c454bb36b0535b2daa4e5c56e1ef1bcf1ad3c7b2cb469f64c4d0cc6d  IMP-219/feed-desktop-1280.png
```

### I looked at both images

`baseline-feed-desktop-1280.png` (1280×900) is a **fully populated feed**, not an error, loading or
empty state: heading "Recent arXiv papers in CS & AI", "14,253 papers from cs.CV, cs.LG, cs.CL,
cs.AI, cs.RO · index generated Oct 3, 2026", a search box, category and recency chips, and a
rendered first card — "Geometric Similarity in VLM Low-Level Vision Representations" by
Shao-Jun Xia, Huixin Zhang, Zhen Lei, Anlan Sun, Yuner Zhang, Xiaoyang Chen, tagged `cs.CV` /
`cs.AI`, with a truncated abstract and a "Save to collection" control. The first card's date line
reads **"Oct 1, 2026"**.

The shard agrees:

```
id= 2610.00848 published= 2026-10-01 updated= 2026-10-01 title= Geometric Similarity in VLM Low-Level…
```

So the rendered date equals the producer's `published`, and the card is the one the report names.

The A/B partner, `/tmp/imp219/bug-reintroduced-1280.png` (M1 applied, identical data — 14,253
papers, same `generatedAt`), I also read: **pixel-for-pixel the same page except that one date
line, which reads "Sep 30, 2026"** — reproducing the old baseline's bug exactly.

### The "date correction, not layout change" claim, measured by me

```
$ python3  # PIL ImageChops.difference, fixed baseline vs bug-reintroduced
sizes: (1280, 900) (1280, 900)
changed-pixel bbox (x0,y0,x1,y1): (185, 617, 272, 630)
differing pixels inside bbox: 703 of 1131 (62.16%)
differing pixels as share of frame: 0.0610%
region: 87px wide x 13px tall -> a single text line
```

**Identical to the report's quoted numbers.** Every differing pixel in the entire 1,152,000-pixel
frame lies inside an 87×13 px box on the date line — the month initial and the day number. Zero
pixels moved anywhere else. It is a text correction, proven rather than asserted.

**The honest caveat is accurate too.** The new baseline also differs from the *old* baseline in
the paper count (14,253 vs 2,812) and in the pre-existing "All" chip and the `SORT` row, because
`web/public/data` was regenerated by another agent and the UI moved without a re-capture. I
verified the old image is genuinely gone (git-excluded, untracked, overwritten), so this cannot be
diffed directly — the implementer is right that an A/B over identical data is the only sound
measurement, and right that fixing the other 13 files is not this item's job. Two differences in
the report's caveat list, though: it says "three ways" and then lists the count and `generatedAt`
as one, the "All" chip as two, and the SORT row as three — the count is fine; I only note the
numbering reads as four when counted literally.

---

## 6. The full gate, run by me

```
$ cd web && npm run typecheck
> tsc --noEmit
typecheck exit=0                                  (no output)

$ cd web && npm test
 ✓ src/components/__tests__/PaperCard.test.tsx (1 test) 169ms
 Test Files  20 passed (20)
      Tests  293 passed (293)
   Duration  8.05s

$ cd web && npm run build
Paper index present: public/data/index.json with 5 shard(s).
✓ 41 modules transformed.
dist/assets/index-DLsgZ6xw.css  10.91 kB │ gzip:  2.86 kB
dist/assets/index-Cn0orISQ.js  172.52 kB │ gzip: 55.23 kB
✓ built in 614ms

$ /usr/local/bin/python3.11 -m unittest discover -s tests
WARNING:root:  cs.AI is recorded as truncated, not failed: papers in this index carry it, so describing it as absent would be false
Ran 119 tests in 1.115s
OK
```

All green. **20 files / 293 tests**, matching the report exactly; the Python suite is **119 OK**,
the count the brief predicted, and the extra one belongs to IMP-042 (`test_merge_does_not_mutate_input_records`).
The `WARNING:root:` lines come from that agent's new coverage and are informational, not failures.
The build's asset digest `index-Cn0orISQ.js 172.52 kB` matches the report's quoted value exactly.
Test count is unchanged at 293 — no test was added or removed, the existing case was tightened in
place, which is what criterion 3 asks for and what criterion 6's "no pre-existing expectation
weakened" requires. No `npm run lint` exists to run (§1).

---

## 7. Issues for the item owner

None blocks the merge. Ranked.

1. **[medium — this test] The hardened assertion is locale-fragile, and the spec clause that
   licensed it is factually wrong.** Criterion 3 offers two options and says the second is to
   "rely on the component's `timeZone: "UTC"` making the expectation locale-portable". **`timeZone`
   pins the zone, not the locale.** The component still passes `undefined` for `locale`, so the
   rendered wording follows the *runner's* locale and the new assertion hardcodes en-US output.
   Measured, `TZ=America/New_York` throughout:

   ```
   OLD toContain("2024")  LANG=en_US.UTF-8  exit=0 GREEN      NEW toBe("Jan 2, 2024")  exit=0 GREEN
   OLD toContain("2024")  LANG=sv_SE.UTF-8  exit=0 GREEN      NEW toBe("Jan 2, 2024")  exit=1 RED
   OLD toContain("2024")  LANG=de_DE.UTF-8  exit=0 GREEN      NEW toBe("Jan 2, 2024")  exit=1 RED
   OLD toContain("2024")  LANG=ja_JP.UTF-8  exit=0 GREEN      NEW toBe("Jan 2, 2024")  exit=1 RED
   OLD toContain("2024")  LANG=fr_FR.UTF-8  exit=0 GREEN      NEW toBe("Jan 2, 2024")  exit=1 RED
   OLD toContain("2024")  LANG=th_TH.UTF-8  exit=1 RED        NEW toBe("Jan 2, 2024")  exit=1 RED

   RED detail: expected '2 jan. 2024' to be 'Jan 2, 2024'   (sv-SE)
               expected '2024年1月2日' to be 'Jan 2, 2024'   (ja-JP)
   ```

   **The old assertion was green in 5 of 6 locales; the new one is green in 1 of 6.** The
   strengthen-ability and the locale-robustness traded off, and the report does not disclose it —
   it says only "the `locale` axis is untouched … that is IMP-125's decision". That is true but
   incomplete: the *test* now has a locale dependency the component does not. This is latent, not a
   live break — GitHub's runners default to `en_US.UTF-8` and nothing in `ci.yml`/`deploy.yml`
   pins `LANG`/`LC_ALL` (I grepped: no hits), so CI is green today. Actionable minimum: record in
   the test comment that it is now **en-US-locale-only**, so IMP-125's implementer meets the cause
   rather than a mystery `Received: "2. Jan. 2024"`. The real fix belongs to IMP-125: pin
   `"en-US"` in the component, which makes the assertion true by construction instead of by
   coincidence of the runner's environment.

2. **[medium — this file] The `Number.isNaN` guard is load-bearing and untested.** Mutation V6:
   delete it and `published: "not-a-date"` renders the literal string **"Invalid Date"** on the
   card (§3), with the full suite green. `impl-IMP-219.md` §2 cites that guard as a *reason* for
   the chosen approach, so it is worth an explicit case: render `PaperCard` with
   `published: "not-a-date"` and assert the `<time>` shows the raw value. Cheap, additive, and it
   closes a gap IMP-037's verifier also never probed. Related backlog item: IMP-176 owns
   malformed `published`.

3. **[low — the spec, not the code] Criterion 1's alternative route is a trap as written.**
   "Parse the bare date as local midnight instead of UTC midnight" is unimplementable in the
   obvious spelling: `new Date("2024-01-02")` is UTC-parsed per the ES spec and re-creates the bug
   (§4.4). It only works as `new Date(`${value}T00:00:00`)` — drop the `Z`. This item took route
   (a) and is unaffected, but the wording invites a future agent to ship the original defect. The
   spec text should be corrected, or at minimum noted, before anyone revisits it.

4. **[low — process] The report's sha256 is not reproducible.** `1b8153f9…` is a digest over 8
   lines whose stdout format the report never records. I confirmed the substantive claim far more
   broadly (15 zones × 6 dates, distinct-count = 1, §2) but could not reproduce that specific
   digest, and a future verifier will not be able to either. Quote the distinct-count and the zone
   list; a hash over an unrecorded format is unfalsifiable evidence.

5. **[low — disclosed, no action] The other 13 baseline screenshots still bake in the pre-fix
   date** and the pre-existing UI drift. The implementer disclosed this and correctly declined to
   overwrite artifacts it was not asked to touch. It should be a separate item, because until they
   are re-captured, every date-bearing baseline comparison outside the desktop feed is wrong.

6. **[trivial] `baseline-feed-desktop-1280.png` has no trailing newline** — no, that is the *test*
   file, inherited from `domEnvironment.test.tsx` by IMP-037 and already logged there. Not
   re-raised; noting only that this item edited the last line of that file and preserved the
   missing newline, so it did not silently fix or worsen it.

---

## 8. Commands run by this verifier

```
git status --porcelain ; git diff --stat ; git diff --stat -- web/src ; git diff --name-only
git diff --quiet -- web/src/App.tsx                          -> YES, byte-identical
git diff -- web/src                                          -> full audit for scope creep / debug leftovers
git diff -- scripts/build_index.py tests/test_build_index.py .improve/FEATURES.md   -> IMP-042, not this item
git check-ignore -v .improve/artifacts/… ; git ls-files .improve/artifacts/         -> git-excluded, untracked
shasum -a 256 <baseline> <IMP-219 capture>                    -> 61988696c4…, byte-identical
stat -f '%Sm %N' .improve/artifacts/baseline/*.png             -> 13 untouched, 1 re-captured today
python3 (PIL ImageChops)                                       -> bbox/62.16%/0.0610%/87x13, matches report
python3 (json over web/public/data/papers-*.json)             -> 14253 papers, 0 non-YYYY-MM-DD
cd web && npm run typecheck   -> exit 0
cd web && npm test            -> Test Files 20 passed (20) / Tests 293 passed (293)
cd web && npm run build        -> ✓ 41 modules transformed / index-Cn0orISQ.js 172.52 kB
/usr/local/bin/python3.11 -m unittest discover -s tests        -> Ran 119 tests / OK

# in the /tmp scratch copy only:
node -e (Intl matrix)                                           -> §4.1 over-broadness, §4.4 route (b)
TZ=<15 zones> npx vitest run src/components/__tests__/zz-tzprobe.test.tsx   -> 90 renders, §2
TZ=<9 zones>  same probe with timeZone deleted (control)        -> west-of-UTC zones show Jan 1, §2
TZ=<zone> npx vitest run src/components/__tests__/PaperCard.test.tsx     -> M1, §3
LANG=<6 locales> npx vitest run …PaperCard.test.tsx              -> old vs new assertion, §7.1
/usr/local/bin/python3.11 /tmp/imp219-mutate.py                 -> M2, M3, M4, V5-V10, §3
malformed-published render probe (guard present vs deleted)     -> "Invalid Date", §3
```

**Working-tree integrity.** `git status --porcelain` after this verification is identical to
before it — the same five modified files and four untracked reports, none of them mine. The
throwaway probes (`zz-tzprobe.test.tsx`, the malformed-date probe) exist only inside
`/var/folders/…/T/kilo/imp219-verify/web/`. No `git restore`, `checkout`, `clean` or `stash` was
executed at any point in this verification.