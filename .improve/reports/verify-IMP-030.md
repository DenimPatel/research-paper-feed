# IMP-030 verification — independent, skeptical review

Verifier did not write this change. Every claim below was re-measured; where the implementer's
report gave a number, that number was recomputed rather than trusted.

## Verdict

**PASS** — 3 of 3 acceptance criteria met, each with independent evidence. Three cosmetic /
disclosed caveats are recorded below; none falsifies a criterion.

---

## Scope of the change

```
$ git diff --name-only
.github/workflows/deploy.yml
images/feed_example.png
```

Only `images/feed_example.png` is attributable to IMP-030.

**`deploy.yml` is not scope creep, and the implementer's disclaimer checks out.** The diff adds a
`Run Python tests` step, a `Typecheck` step, `actions/setup-node`, and moves `npm ci` above the
index build. That is CI gating work with no relationship to a screenshot, and it matches
`.improve/reports/impl-IMP-041.md` (concurrent agent). Verified by content, not by taking the
report's word for it.

**Zero source files touched.** `git diff` is empty for `readme.md`, `web/`, and `scripts/`. No
secrets, debug statements, or stray logging in either new report (grep for
`api_key|secret|token|password|BEGIN .*PRIVATE KEY` → no hits). Nothing was committed, per the
loop's standing rule.

---

## Criterion 1 — screenshot of the current React feed at 1280px, real index, `readme.md:11` renders it

**MET.**

Format and dimensions:

```
$ file images/feed_example.png
images/feed_example.png: PNG image data, 1280 x 900, 8-bit/color RGB, non-interlaced
```

Valid PNG, width exactly the 1280px the spec asks for, `scale: "css"` (no DPR upscaling).

**Visual inspection (opened with the Read tool).** This is unambiguously the real React UI, not
the legacy CLI: sticky header with `Research Paper Feed` and `Feed`/`Collections` tabs; h1
`Recent arXiv papers in CS & AI`; hero line; filter panel with search field, six category chips,
three recency chips, two sort chips; a real paper card with title, date, authors, category chips,
truncated abstract, `Show more`, and `arXiv`/`PDF`/`Save to collection` controls. Serif
`Title:`/`Summary:`/`Link:` CLI styling is entirely absent.

**The capture used a real, complete index.** `web/public/data/index.json` independently reads:

```
generatedAt 2026-10-03T10:02:17Z   retention 30   total 14253
failedCategories None   truncatedCategories None
```

`14253` matches the `14,253 papers` rendered in the hero, and `2026-10-03` matches
`index generated Oct 3, 2026`. The index is complete, so the frame is not an
"incomplete index" failure state (which D-1 correctly documents as a live risk).

**`readme.md:11` renders correctly.** The reference is unchanged and the format did not change, so
there is nothing to re-point:

```
11:![Example feed](images/feed_example.png)
```

Relative path resolves, and the target is a valid non-animated PNG.

**Strongest evidence — independent reproduction.** I rebuilt the app and captured my own frame
from the *production build* (`npm run build`, then `vite preview` on :5299) at 1280×900 after
waiting for the feed to populate, and pixel-diffed it against the shipped file:

```
shipped (1280, 900) RGB
mine    (1280, 900) RGB
identical bbox: None
max channel-diff sum: 0   pixels differing: 0 of 1152000
pct pixels differing: 0.0000%
```

**Zero differing pixels out of 1,152,000.** The shipped hero is exactly what the current
production build renders to a user. This single measurement also rules out fabrication,
doctoring, and "screenshot of a dev-only or broken build" simultaneously.

---

## Criterion 2 — at most 300 KB

**MET.**

```
$ stat -f "%z" images/feed_example.png
112406
$ stat -f "%z" images/feed_example.png | awk '{printf "%.1f KiB\n", $1/1024}'
109.8 KiB
$ git diff --stat -- images/feed_example.png
 images/feed_example.png | Bin 465201 -> 112406 bytes
```

112,406 bytes. Under 300 KB on either reading (300,000 or 307,200). The implementer's decision not
to introduce WebP/`cwebp`/`pngquant` is correct: the ceiling was already met with a 4.1×
reduction and a straight Playwright PNG, so there is no format change to mirror into `readme.md`.

---

## Criterion 3 — `readme.md:9` live-site link and bullets 13–31 unchanged

**MET.**

```
$ git diff -- readme.md
(no output — empty)
```

`readme.md` is byte-identical to HEAD. Confirmed by reading the region:

```
9:**Live site:** <https://denimpatel.github.io/research-paper-feed/>
11:![Example feed](images/feed_example.png)
13:## What the web feed does
```

Lines 13–31 carry the `## What the web feed does` section and its full feature bullet list
(search/phrase support, category + 7/30/60-day filtering, newest/relevance sorting, collections with
`localStorage` and JSON import/export, arXiv metadata links), intact and unmodified.

---

## Non-vacuity — would the OLD image have satisfied this item?

**No. It fails criteria 1 and 2 independently.** The improvement is real on both axes.

Extracted the pre-change file from history (`1c075b32`) to `/tmp` and opened it:

```
$ git show 1c075b322eafa1fdfe07775136ca573513b4904b:images/feed_example.png > /tmp/verify-imp030-old.png
$ file /tmp/verify-imp030-old.png
PNG image data, 1772 x 1434, 8-bit/color RGBA, non-interlaced
$ shasum -a 256 /tmp/verify-imp030-old.png
52f539f3a00adb48db8de87939b09f2335efd8dd11ee2a14bea1e513920fcfee
```

Viewing it confirms it is the **legacy Python CLI's HTML output**: serif type, numbered entries
`1`, `2`, `3`, fields labelled `Title:`, `Summary:`, `Link:`, and timestamps
`2023-07-11 07:31:58+00:00`. No React UI at all. It is 1772×1434 (**not 1280px**) and
**465,201 bytes = 454.3 KiB, over the 300 KB ceiling**. The change fixes a wrong-subject image
*and* an over-budget asset in one step.

### Was the new capture copied from another screenshot in the repo?

**No — it was freshly captured.** I sha256'd every PNG in the tree (~330 files, excluding
`node_modules`). The new image's digest appears in exactly **two** places:

```
edac0be13717e41f674d773396b04aaf7e4cf66ab18678d2499019ecda5fc5ec  ./images/feed_example.png
edac0be13717e41f674d773396b04aaf7e4cf66ab18678d2499019ecda5fc5ec  ./.improve/artifacts/IMP-030/feed-desktop-1280.png
```

Every other capture has a distinct digest, including the baseline the spec asks to compare
against (`.improve/artifacts/baseline/baseline-feed-desktop-1280.png` =
`c58f3c1aaab6f41348b1f952f12ec8b2ef225e75eef7b3fba8cdddb21b6f9d`). The new hero is not the
baseline, not `IMP-003`/`IMP-143`/`regression-3`'s `feed-desktop-1280.png`
(all `c58f3c1a…`), and not any other stored frame. The artifact copy required by the spec's
verification method exists and is hash-identical to the shipped file.

---

## Does the screenshot honestly represent the product?

**Yes.** The state is reachable and unstaged, and nothing is concealed.

- Cold load shows `Loading the paper index…`, then resolves to exactly the captured state. My own
  capture of that resolution reproduced the shipped frame bit-for-bit.
- Accessibility state confirms it is the ordinary default view, not a doctored one: all six
  category buttons `[pressed]`, `60 days` `[pressed]`, `Newest` `[pressed]`, `Relevance`
  `[disabled]` with the hint `Enter a search term to sort by relevance.`, and
  `14253 papers match` — i.e. all filters at their defaults, which is what a first-time visitor
  sees.
- It exposes rather than hides a known defect: WEB-49's number-formatting inconsistency
  (`14,253` in the hero vs `14253 papers match`) is visible in the repo's most prominent asset.
  D-3 correctly records this.
- Contrast and layout read cleanly at 1280px: chip labels legible, disabled `Relevance` chip
  appropriately muted, no overflow, no clipping of text, no horizontal scroll, no dev-tools
  overlay, no browser chrome, no 404/error/empty panel, no spinner.

### Caveats (none criterion-failing)

1. **Cosmetic — clipped card.** The first card is cut mid-button at the bottom edge; `Save to
   collection` is bisected. Honest scroll-position artifact, and the baseline clipped its card
   similarly, but it reads slightly unpolished in a hero. A viewport tall enough to frame one
   whole card would look better; the implementer traded this for baseline frame parity, a
   defensible call.
2. **Cosmetic — Sort-row wrap (D-2).** `Sort` wraps to its own row at 1280px, leaving a wide empty
   band, because IMP-010's `All` chip widened the category group. Shown, not hidden. Correctly
   deferred to the control-panel layout owner rather than fixed in a docs item.
3. **Accuracy — 30-day retention (disclosed).** The capture used `--retention-days 30` after two
   default builds lost `cs.AI` to a reproducible arXiv HTTP 500 at `start=10000` (D-1, PY-17 /
   IMP-204). The index is real and complete and `--retention-days` is a documented supported flag
   (`readme.md:64`), so no criterion is falsified. But the hero's `14,253` is roughly half what
   the deployed default 60-day build yields (the implementer's own discarded attempt produced
   25,761), while `readme.md:31` states "The index covers a rolling 60-day window." A reader
   comparing the hero to the live site will see a different count. The implementer flagged this
   first under "Uncertain". Recommend recapturing once a default 60-day build completes cleanly —
   no other change required.

---

## Build reproduction

```
$ cd web && npm run build
> tsc --noEmit && node scripts/require-index.mjs && vite build
Paper index present: public/data/index.json with 5 shard(s).
vite v5.4.21 building for production...
✓ 41 modules transformed.
dist/assets/index-Cz853rdl.js   172.50 kB │ gzip: 55.22 kB
✓ built in 502ms
BUILD_EXIT=0
```

Typecheck clean, index guard satisfied, build succeeds. The screenshot is definitively not of a
broken build. `web/dist` is gitignored (`web/.gitignore:5:dist`), so this left the tree clean.

---

## Verdict summary

| Criterion | Result |
| --- | --- |
| 1. React feed screenshot at 1280px, real index, `readme.md:11` renders | **MET** |
| 2. At most 300 KB | **MET** (112,406 B = 109.8 KiB) |
| 3. `readme.md:9` link + bullets 13–31 unchanged | **MET** (`git diff -- readme.md` empty) |

No scope creep attributable to IMP-030, no secrets, no debug leftovers, no unrelated source
changes, nothing committed. Non-vacuity demonstrated: the old image failed both criteria 1 and 2,
and the new file is a fresh capture (unique digest across ~330 PNGs) that is pixel-identical to
the current production build's output.

**PASS.**
