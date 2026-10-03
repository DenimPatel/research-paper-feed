# Discovered while implementing IMP-037 — not fixed

Scope note: IMP-037 added one file, `web/src/components/__tests__/PaperCard.test.tsx`. No source,
config, dependency or doc file was changed. `.improve/FEATURES.md` was not edited.

---

## 1. Real bug: `PaperCard.formatDate` renders the previous day west of UTC

**Severity:** medium (every card in the feed is wrong for readers behind UTC — the Americas, which is
roughly a third of the site's audience)
**Where:** `web/src/components/PaperCard.tsx:20-30`

```tsx
function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00Z`);
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

`published` arrives from the pipeline as a bare ISO **date** with no zone — `iso_date`
(`scripts/build_index.py:101-111`) returns `value.date().isoformat()`. `formatDate` re-anchors it at
midnight **UTC** and then formats it in the **local** zone, because `toLocaleDateString` is called
without `timeZone: "UTC"`. For any host west of UTC the timestamp falls on the previous local day, so
the card shows yesterday's date for every paper.

Observed on this machine while proving the new test non-vacuous (the broken assertion's `Received:`
value):

```
AssertionError: expected 'Jan 1, 2024' to contain '1999'

Expected: "1999"
Received: "Jan 1, 2024"
```

with `FIXTURE.published = "2024-01-02"`. Confirmed independently:

```
$ date +"%Z %z"                       -> EDT -0400
$ node -e '... toLocaleDateString(undefined,{year:"numeric",month:"short",day:"numeric"})'
America/New_York  Jan 1, 2024  Jan 2, 2024     # left: no timeZone; right: timeZone:"UTC"
```

So the published date is correct in UTC and every zone east of it, and one day early in every zone
west of it — including `America/New_York`, which is where this was measured. It also means the app's
displayed dates disagree with `PaperCard`'s own `<time dateTime="…">` attribute for those readers.

**Why not fixed here:** IMP-037 is a test item; changing what the card displays needs its own item with
a screenshot comparison against `.improve/artifacts/baseline/feed-desktop-1280.png`. The one-line fix
would be `timeZone: "UTC"` in the options object, or parsing the date as local midnight instead
(`new Date(value)`), and either way the decision belongs to an item that owns `PaperCard`'s rendering.

**Consequence for tests, which is why it is worth recording now:** no test anywhere may hardcode the
visible date string, or it will fail for half the CI matrix and pass for the other half. `PaperCard`'s
machine-readable `dateTime` attribute is the timezone-stable assertion target. The new test uses that
and asserts only that the visible text carries the year.

---

## 2. Documentation gap: a third web test directory now exists, and neither doc lists it

**Severity:** low (docs drift inside `.improve/` and `CONTRIBUTING.md`)
**Where:** `CONTRIBUTING.md:84-85`, `.improve/REPO_PROFILE.md` §5.3

IMP-037's own instruction is to put this suite at `web/src/components/__tests__/PaperCard.test.tsx`
("a component at `web/src/components/PaperCard.tsx` gets tests at
`web/src/components/__tests__/PaperCard.test.tsx`, not inline"), so that path is correct and the new
file uses it. But both places that document *where* web tests go enumerate only two directories:

- `CONTRIBUTING.md:85`: "in `web/src/lib/__tests__/` or `web/src/__tests__/` for anything you change
  in `web/`."
- `REPO_PROFILE.md` §5.3: "The 1:1 source mirror holds in **two** directories, and both are live" —
  `web/src/lib/__tests__/` and `web/src/__tests__/`. (The §3.3 table and the §3.3 layout paragraph
  already mention `web/scripts/__tests__/` as a deliberate third, so §5.3 was behind §3.3 before this
  change too.)

`CONTRIBUTING.md:7` says `web/src/**/__tests__/`, which does cover the new path — so the repo is
self-contradictory between its own lines rather than simply wrong. Suggested fix when a docs item
picks this up: generalise both lines to `web/src/**/__tests__/` (and note the `scripts/` exception in
§3.3), or, if the 1:1 mirror really is the rule, say so in `CONTRIBUTING.md:85` explicitly, because
`CollectionsView.tsx`, `FeedControls.tsx` and `PaperList.tsx` currently have no mirrored
`components/__tests__/` sibling and the convention is otherwise invisible to a contributor.

Not fixed here: editing `CONTRIBUTING.md` / `REPO_PROFILE.md` is outside IMP-037's area, and
`REPO_PROFILE.md` is loop-wide state another agent may be holding.

---

## 3. Stale line cite inside `REPO_PROFILE.md` §5.3 for `record_from_result`

**Severity:** low (an untraceable line number in loop state, which the profile's own §4.6.7 evidence
rule calls a correctness problem)

`REPO_PROFILE.md` §5.3 says the `Paper` wire shape "lives in one factory, `record_from_result()`
(`build_index.py:97-114`)". Read from the file, `record_from_result` is
`scripts/build_index.py:121-138`; `:101-111` is `iso_date` and `:97-114` is the tail of
`arxiv_id_from_entry` plus `iso_date`. §9's WEB-13 row cites `build_index.py:113` for `pdfUrl`,
which is now `:137` (`:113` is blank/`arxiv_id_from_entry`'s end).

I hit this because the new test's docblock cites the same factory and I had to read the file to
confirm it before quoting a number. Per §4.6.7 every cited line number should be read from the file
it names — this one was inherited, not re-measured. The corrected value is `:121-138`.

Not fixed here (profile is loop-wide state).

---

## 4. Pre-existing, unrelated: the item's own counts are two loops out of date

Not a repo defect, so nothing to fix — recorded so no verifier treats the spec's "36-test baseline" /
"expect 4 files, 37 tests" as a regression signal. The measured before/after for this item is
19 files / 292 tests → 20 files / 293 tests. `REPO_PROFILE.md` §3.3 already carries the same warning
in general form ("re-measure, do not trust it") and was accurate here.

Also re-confirmed while working, no action taken, all pre-existing per the profile's §7:
`web/public/data/` held a 5-shard index so `npm run build`'s guard passed on its success path;
`git status --porcelain` from the repo root showed only the one new untracked directory; `web/dist/`
and `web/public/data/` are correctly gitignored and did not dirty the tree.