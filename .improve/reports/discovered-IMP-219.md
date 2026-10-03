# Discovered during IMP-219 — not fixed by this item

Found while implementing IMP-219 (publication-date timezone). Each is recorded with the
evidence that produced it. None is fixed here: they are outside the item's area, and two of
them would mean overwriting artifacts IMP-219 was not asked to touch.

---

## D-1 — 13 of the 14 baseline screenshots still bake in the pre-fix date

**Severity: medium** (measurement integrity, not user-visible behaviour)

`formatDate` rendered `published` one day early for every reader west of UTC. IMP-219 fixed
the code and re-captured exactly one baseline file,
`.improve/artifacts/baseline/baseline-feed-desktop-1280.png`. The other 13 files in that
directory were captured before the fix and still show the wrong day on every card.

```
$ ls .improve/artifacts/baseline/
baseline-feed-desktop-1280.png          <- re-captured by IMP-219
baseline-feed-mobile-390.png            <- still pre-fix
baseline-feed-savemenu-open-desktop-1280.png
baseline-feed-savemenu-mobile-390.png
baseline-feed-loadmore-desktop-1280.png
baseline-feed-focus-ring-desktop-1280.png
baseline-feed-empty-search-desktop-1280.png
baseline-feed-no-categories-selected-desktop-1280.png
baseline-feed-index-missing-desktop-1280.png
baseline-feed-preview-build-desktop-1280.png
baseline-collections-desktop-1280.png   (no cards)
baseline-collections-mobile-390.png     (no cards)
baseline-collections-empty-mobile-390.png (no cards)
baseline-collections-import-error-desktop-1280.png (no cards)
```

The four `collections-*` files carry no paper cards, so the bug is not visible in them. The
**nine remaining feed screenshots** are affected: `feed-mobile-390`, `feed-savemenu-open-…`,
`feed-savemenu-mobile-390`, `feed-loadmore-…`, `feed-focus-ring-…`, `feed-empty-search-…`,
`feed-no-categories-selected-…`, `feed-preview-build-…` (and `feed-index-missing-…` renders the
empty state, so it is probably unaffected).

IMP-219's brief named only the desktop feed file, so only that one was re-captured. The next
sweep that compares a mobile or interaction-state screenshot against its baseline will see a
date diff and may misread a correct fix as a regression — exactly the failure mode
`verify-IMP-037.md` §5 finding 1 warned about.

**Suggested fix:** re-capture the remaining feed baselines from the fixed tree in one pass,
alongside the already-drifted UI below. Not done here — see D-2 for why one-at-a-time is
wrong.

---

## D-2 — The baseline set had already drifted before this item, from UI work nobody re-captured

**Severity: medium** (measurement integrity)

Comparing the old `baseline-feed-desktop-1280.png` against a fresh capture of the same view
surfaced three differences that IMP-219 did not cause:

1. An **"All"** category chip now sits to the left of `cs.CV … cs.RO`.
2. **"SORT" wraps onto its own row** instead of sharing the row with `RECENCY`, at 1280px.
3. A new hint line under the sort control: **"Enter a search term to sort by relevance."**,
   plus a now-disabled "Relevance" button.

These came from earlier items in this loop (`FeedControls` work — IMP-151 / IMP-154 / IMP-173
era) that changed the visible filters without re-capturing the baselines. The old baseline was
already stale before the date bug was fixed.

This matters for how IMP-219's re-capture should be read: the new
`baseline-feed-desktop-1280.png` is correct, but it is correct *for all three reasons at once*.
The date delta attributable to IMP-219 was isolated separately (A/B over identical data:
87×13 px, `0.0610%` of the frame, nothing outside the date line — see `impl-IMP-219.md` §5).

**Suggested fix:** the loop owner should decide whether the 14-file baseline set is worth
re-capturing as a whole against current `HEAD`, or whether baselines should be scoped per
item. Right now a re-capture mixes "this item's change" with "every un-captured change since
the last one", which makes screenshot comparison weaker evidence than it looks.

---

## D-3 — The old baseline's paper set is unrecoverable, so a diff against it is not meaningful

**Severity: low** (hygiene)

`web/public/data` was regenerated between the baseline's capture and this item:

| | old baseline | present at IMP-219 |
| --- | --- | --- |
| `generatedAt` | `Oct 1, 2026` (rendered) | `2026-10-03T10:02:17Z` |
| paper count | 2,812 | 14,253 |
| shards | — | `papers-2026-W40.json` … `W36.json`, 14,253 papers |

The directory is gitignored (root `.gitignore:12`, `web/.gitignore:7`) and there is no
committed example of either data format, so the 2,812-paper index behind the old baseline
cannot be regenerated — arXiv's window has moved and re-fetching returns a different set.
Consequently the old baseline cannot be re-shot against its own data, and a direct old-vs-new
pixel diff mixes three causes (date fix, data regeneration, D-2's UI drift).

**Suggested fix:** none available now. Worth recording so that a future verifier who diffs the
two images does not attribute all three causes to IMP-219. IMP-219 measured the date delta in
isolation instead, which is the only way to get a clean number out of this.

---

## D-4 — The exact-string assertion is locale-dependent, and IMP-125 is what resolves it

**Severity: low** (known, owned elsewhere)

`expect(published?.textContent).toBe("Jan 2, 2024")` is now **timezone**-independent — that is
the fix, and §3 of `impl-IMP-219.md` measures it across eight zones. It remains
**locale**-dependent: `toLocaleDateString(undefined, …)` follows the runner's default locale, so
on a runner whose default is not `en-US`-shaped the expected string differs (e.g. `de-DE` gives
`02.01.2024`).

```
$ node -e 'console.log(Intl.DateTimeFormat().resolvedOptions().locale, Intl.DateTimeFormat().resolvedOptions().timeZone)'
en-US America/New_York
```

Measured on this host, and `en-US` is also what Node 20 on a stock GitHub runner resolves to, so
CI is green today. This is **not** fixed here on purpose: pinning `"en-US"` is the locale-axis
decision that **IMP-125** (`NEEDS-HUMAN`, "Pin or document the date locale") owns, and its own
criteria are about `locale`, not `timeZone`. Deciding it here would silently take that decision.

**Sequencing note for whoever lands IMP-125:** if its "consolidate the duplicated helper" step
merges `formatDate` and `formatGeneratedAt`, the consolidated helper must take the zone (or the
parse) as a parameter. The two take different kinds of value — a zoneless calendar day vs a real
instant — so a single fixed answer would be wrong for one of them. Pinning `en-US` alongside
`timeZone: "UTC"` in `formatDate` would also make the tightened assertion locale-proof and close
this finding.