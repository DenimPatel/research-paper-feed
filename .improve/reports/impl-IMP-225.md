# IMP-225 — Visual-regression jitter floor, tolerance, and comparability

**Item:** `.improve/FEATURES.md#imp-225` · **Harness:** `.improve/tools/imp225/` (runbook: its `README.md`)
**Measurement corpus (retained, reproduces exactly):** `.improve/tools/imp225/measurements-2026-10-03.txt`
**Outcome in one line:** `headless` vs `headed` is worth **15.4553%** on identical bytes, so a stored
baseline compared the wrong way is not noisy — it is **unfalsifiable**. Within one environment the
renderer is near-deterministic: 282 of 312 pairs exactly 0 px, worst case 330 px (0.0286%).
`FEATURES.md` now carries a replacement procedure built on a pinned fixture.

> **Correction, second pass.** A first draft of this report claimed the 15.46% had *two* causes and
> that neither was the one regression 7 assumed, and classified baseline #1 as "unproven". Both were
> wrong. The retained corpus settles it: `baseline-vs-realHeaded = 1 px`, `baseline-vs-realHeadless =
> 15.4553%` — the figure is **entirely** environment, on the **same** dataset, which is also what
> regression 7 concluded. Baseline #1 **is** comparable within tolerance. Details in §1 and §4.

---

## 1. Diagnosis

**One cause, and regression 7 named it correctly: rendering-environment mismatch.**

From the retained corpus (`.improve/tools/imp225/measurements-2026-10-03.txt` §5–§8), comparing the
stored baseline against two captures of the **same build against the same live index**:

```
sweep7:baseline-vs-realHeaded             1 px     0.0001%  rows=1    maxdelta=1 bbox=[606, 341, 606, 341]
sweep7:baseline-vs-realHeadless      178045 px    15.4553%  rows=820  maxdelta=235 bbox=[0, 0, 1279, 899]
```

Identical bytes, identical data, **15.4553% apart** purely on `headless` vs `headed`. `bbox` spans the
entire frame and `maxdelta=235` on an 8-bit channel: a wholesale rasterisation difference — font and
compositing path — not antialiasing. Independently reproduced here against the pinned fixture:

```
$ node .improve/tools/imp225/capture.cjs --out /tmp/imp225/sc1 --label sc1 --n 1 --headed \
      --pin-scroll --data .improve/tools/imp225/fixture/pinned --view feed-desktop-1280
$ node .improve/tools/imp225/capture.cjs --out /tmp/imp225/sc2 --label sc2 --n 1 --headed \
      --pin-scroll --data .improve/tools/imp225/fixture/pinned --view feed-desktop-1280
$ python3 .improve/tools/imp225/pngdiff.py /tmp/imp225/sc1/sc1__feed-desktop-1280-01.png \
      /tmp/imp225/sc2/sc2__feed-desktop-1280-01.png
0 px differ (0.0000%) over 0 rows; maxdelta=0; bbox=None
```

**Dataset drift is real, but it is a second, separate problem — and it is not the 15.46%.** The 13
baselines captured 2026-10-01 render `2,812 papers ... index generated Oct 1, 2026`; the current index
renders 14,253 (`generatedAt 2026-10-03T10:02:17Z`, `retentionDays` 30, `index.json` sha256
`b26172fd89b0b84a…`). Those 13 are therefore stale on **data**, which no tolerance can repair. But
regression 7's figure was measured against `baseline-feed-desktop-1280.png`, which renders the
**current** 14,253 — so drift contributed ~0 to it. A first draft of this report credited drift with
part of the 15.46% on the strength of the other 13 files; that was conflating two comparisons.

Mechanisms excluded by measurement, not by argument: device pixel ratio, fonts, and scroll. `dsf` was
**1** for the comparison above (and for corpus groups W1–W4) and 1.5/2 elsewhere; `maxdelta=1` at a
single pixel for the headed baseline comparison shows font rasterisation is stable *within* a mode and
dsf; and scroll was pinned to `scrollBefore == scrollAfter == 0` in every capture used above.

**What this item therefore contributes** is not a new diagnosis but the three things that were missing:
the figure **quantified**, the renderer **measured within an environment** (282 of 312 pairs exactly 0 px,
worst case 330 px; 1 px for the one usable stored baseline), and a **working procedure with a pinned
dataset** installed in place of the one that could not fail.

## 2. Measured distribution

**Within a single environment, captures are almost always bit-identical** — 282 of 312 pairs exactly
0 px, 30 non-zero, worst 330 px (§3). The harness's full run measured **312 within-environment pairs
across 8 environments**:

| statistic | value |
|---|---|
| pairs | 312 (8 environments) |
| exactly 0 px | **282** |
| non-0 px | 30 |
| min | 0 px (0.0000%) |
| median | 0 px |
| **max (worst case)** | **330 px** |

Expressed as a percentage, the worst case is:

```
330 / (1280 x 900) = 330 / 1,152,000 = 0.0286%     <- measured, desktop
330 / (390  x 844) = 330 /   329,160 = 0.1003%     <- PROJECTION, not measured
```

The 390px figure is arithmetic on the desktop worst case, **not a measurement** — the mobile
within-environment worst case measured **0 px**. It is stated as a projection so the tolerance's
mobile headroom is not mistaken for observed mobile jitter.

**What the 8 environments actually vary** — from all 42 retained `meta-*.json` sidecars: `headless`
vs `headed` (2 values), `deviceScaleFactor` (1, 1.5, 2) and view (`feed-desktop-1280`,
`feed-mobile-390`). **Browser build (`149.0.7827.22`), timezone (`America/New_York`), locale
(`en-US`) and Chromium args (`[]`) were each a single value across the whole corpus**, as were 5
distinct `dataIndexSha256` datasets. An earlier draft of this report claimed those four varied; they
did not, and the sidecars say so.
Each capture's exact environment is recorded in a `meta-<label>.json` sidecar (browser version,
headless/headed, dsf, tz, locale, args, `data/` dir, and the **SHA-256 of `index.json`**), and
`--replay` re-launches with a previous run's recorded environment. The full run's commands, per-pair
results and sidecars are retained in `measurements-2026-10-03.txt` and reproduce exactly via
`python3 .improve/tools/imp225/aggregate.py --dir <dir>`.

Two further measured facts that make an unpinned capture worthless:

- **Scroll is not stable in `headed` mode unless pinned.** Unpinned, captures drifted to `scrollY` of
  **1130.5** and **14.0** unprompted, giving **17.87%–24.35%** against their own siblings. Every capture
  records `scrollBefore`, `scrollAfter` and `scrollStable`.
- **The live index moves.** Capture against `fixture/pinned`, or record `dataIndexSha256`, or the
  capture is unreproducible by construction — which is the defect in 13 of the 14 stored baselines.

## 3. Tolerance and its derivation

**Tolerance: 0 px. Hard-fail ceiling: 330 px (0.0286% at 1280x900).**

```
observed worst case within one environment = 330 px = 0.0286% of 1280x900
ceiling set AT the observed worst case, not above it
```

The ceiling is set **at** the worst case rather than above it because the distribution is bimodal — 282
of 312 pairs are *exactly* 0, and the 30 non-zero pairs are a separate population, not a tail.
Headroom above 330 px would be invented against a population that does not exist. Above 330 px **the
comparison is a finding, not a rounding error**, and must be investigated rather than absorbed.

Explicitly **not** done, per criterion 4: the tolerance was not widened until an existing diff passed,
and no baseline was re-captured to make a comparison succeed. Verified: all 14 baseline mtimes are
unchanged at or before `2026-10-03 08:24:58`, and `baseline-feed-desktop-1280.png`'s SHA-256 still
matches the value IMP-219 recorded (`61988696c4…`).

## 4. Per-file comparability — all 14 files

Classification is on **provenance**, which is what the evidence supports. Diffing a stored baseline
against a `fixture/pinned` capture measures the *dataset* difference, not comparability, so no such
number is quoted as a jitter measurement.

Measured: 14 files, **1,123.6 KB** total, all at `deviceScaleFactor` 1.

| # | File | Captured | Classification | Reason |
|---|---|---|---|---|
| 1 | `baseline-feed-desktop-1280.png` | 2026-10-03 08:24 | **Comparable within tolerance** — `headed` only | Measured **1 px (0.0001%)** against a headed capture of the same build and same live index. The **only** usable file. Constraints: `headed` only (headless against it is 15.4553%), and its environment is **unrecorded** — IMP-219 overwrote the Oct-1 file with this one, so the PNG has exactly one generation, but which environment that generation was captured in is not written down anywhere. Its usability therefore rests on the single 1 px measurement above, not on a recorded provenance. |
| 2 | `baseline-feed-mobile-390.png` | 2026-10-01 22:56 | **Not comparable** | Dataset = Oct-1 live index (**2,812 papers** vs the current 14,253); unreconstructable, `web/public/data/` is gitignored and rebuilt weekly. Environment unrecorded — no `meta` sidecar predates the harness, so headless/headed is unknown. Scroll unpinned. |
| 3 | `baseline-feed-empty-search-desktop-1280.png` | 2026-10-01 22:58 | **Not comparable** | As #2, and the empty-search result count is a function of the index. |
| 4 | `baseline-feed-no-categories-selected-desktop-1280.png` | 2026-10-01 22:55 | **Not comparable** | As #2. Selection is URL-driven and the chip row is manifest-derived, so index-dependent. |
| 5 | `baseline-feed-loadmore-desktop-1280.png` | 2026-10-01 22:59 | **Not comparable** | As #2, and the "load more" boundary is set by the shard count of a superseded index. |
| 6 | `baseline-feed-savemenu-open-desktop-1280.png` | 2026-10-01 22:57 | **Not comparable** | As #2. An open popover is anchored to a card, inheriting index-dependent layout *and* an overlay-compositing difference. |
| 7 | `baseline-feed-savemenu-mobile-390.png` | 2026-10-01 22:56 | **Not comparable** | As #6, at 390px. |
| 8 | `baseline-feed-focus-ring-desktop-1280.png` | 2026-10-01 22:59 | **Not comparable — doubly** | As #2, and it encodes a **focus ring**, whose rasterisation depends on focus timing and compositor settling. Driven explicitly at `capture.cjs:120`. Not reproducible by construction. |
| 9 | `baseline-feed-index-missing-desktop-1280.png` | 2026-10-01 23:00 | **Not comparable** | As #2, and the error panel's text is code-derived. |
| 10 | `baseline-feed-preview-build-desktop-1280.png` | 2026-10-01 22:55 | **Not comparable** | As #2. Per `recon-experience.md:54` this is a **production build served by the preview server with `#q=kinematic+meanflow`** — so it additionally depends on a specific query's result count against that Oct-1 index. (It is not, as a first draft claimed, a "preview build state that later guards changed".) |
| 11 | `baseline-collections-desktop-1280.png` | 2026-10-01 22:57 | **Not comparable** | As #2, and it shows **a collection a clean clone does not have** — the state lives in `localStorage`, seeded via `addInitScript` (`capture.cjs:278-283`), so it is not reproducible from a clean profile. |
| 12 | `baseline-collections-mobile-390.png` | 2026-10-01 22:58 | **Not comparable** | As #11. |
| 13 | `baseline-collections-empty-mobile-390.png` | 2026-10-01 22:58 | **Not comparable** | As #11. |
| 14 | `baseline-collections-import-error-desktop-1280.png` | 2026-10-01 23:00 | **Not comparable** | As #9, plus #11's `localStorage` dependence. |

**One of 14 is usable, and only in `headed`.** The other 13 fail on **dataset drift** — an index
generation that no longer exists — compounded by having **no recorded environment** and unpinned scroll.

## 5. Version-control decision

**Decision: keep `.improve/artifacts/` local-only. Do not commit the baselines.**

The binding reason is not size — it is that **13 of the 14 are not evidence.** Committing 1,123.6 KB of
images, 13 of which are stale on data and none of which records its environment, would put files in
history that *look* like a regression baseline and are cited by `FEATURES.md`. That is worse than
absent: an absent baseline is obviously missing, a committed one is trusted. Baselines worth committing
come after the apparatus produces them against a pinned fixture.

Measured cost of each route, at this machine's captures:

| route | measured size |
|---|---|
| Commit the 14 baselines as-is | **1,123.6 KB** repository growth; no LFS needed; binary diff on any future edit — and 13 of 14 are unusable |
| Commit `fixture/pinned` | **52 KB** (`du -sh`; 41.1 KB apparent), 3 files, byte-deterministic (`index.json` sha256 `eaf4a41e5ec23762…`), reproducible with no network, no clock, no RNG seed |
| Commit `fixture/thin` | **12 KB** — the 5-paper minimum that still renders a feed |
| Commit the harness code + runbook | **76 KB** of `.py`/`.cjs`/`README.md`/`.gitignore` (excl. `node_modules`) |
| Commit the retained measurement corpus | **36 KB** (`measurements-2026-10-03.txt`) |

Total committable and reproducible, by `du -skc` over exactly those paths: **176 KB** (138.3 KB
apparent size, 141,640 B). Against **1,123.6 KB** of mostly-unusable images. What a fresh clone does instead:
capture against `fixture/pinned` with `--pin-scroll`, record the SHA-256 of `index.json` and the
harness command, and **publish no baseline**. A screenshot with a hash and a command is evidence; a
diff against `.improve/artifacts/baseline/` is evidence **only** for the single usable file #1, in
`headed` mode.

Evidence the exclude rule is live:

```
$ git check-ignore -v .improve/artifacts/baseline/baseline-feed-desktop-1280.png
.git/info/exclude:51:.improve/artifacts/	.improve/artifacts/baseline/baseline-feed-desktop-1280.png
```

## 6. Effect on sweep 7's verdict

**Stated plainly: sweep 7's CLEAN verdict stands, and its diagnosis of the 15.46% was correct.** This
report does not overturn either. What it adds is that the figure is now explained to three significant
figures and bounded, the renderer is measured within an environment (282 of 312 pairs exactly 0 px,
worst case 330 px), and the gate is replaced with one that can fail.

The sharper statement of the severity, which the first draft got right and still holds: the apparatus
was not noisy, it was **unfalsifiable**. `baseline-vs-realHeadless` is 15.4553% *by construction*, so a
verifier comparing a `headed` capture against a `headless` baseline would see a double-digit "regression"
on an unchanged tree — and, symmetrically, **a clean result against a matching-mode baseline would have
been uninformative about the other 12 files.** Sweep 7 was right to report CLEAN *and* to flag the
comparison as untrustworthy in the same report; its substantive findings (the 704 px / 13-row PRE-vs-HEAD
delta from a single capture session, the 200/200 date check, the IMP-216 pipeline matrix, the
600-case IMP-042 comparison) rest on direct inspection and are untouched.

`FEATURES.md:42-43` is marked **NOT USABLE AS SPECIFIED** and now carries the replacement procedure.

## 7. Honest limits of this report

- The **312-pair distribution** and the 8 environment definitions come from the harness's full run,
  retained at `measurements-2026-10-03.txt` and reproducible via `aggregate.py --dir`. This report
  independently re-verified the 0 px within-environment result and the 15.2475% headless-vs-headed
  result on the pinned fixture; the verifier independently reproduced both again, plus the full 312-pair
  aggregate.
- The **0.1003% at 390px** figure is a projection from the desktop worst case; the measured mobile
  worst case is 0 px.
- The two headings "Cause A" / "Cause B" of the first draft are gone: there is **one** cause for the
  15.46% (environment) and a **separate** defect affecting 13 of the 14 baselines (dataset drift).
  Conflating them is what produced the first draft's error.
- Baseline #1's single-environment status rests on **one** measurement (1 px). It is a thin basis for
  "usable", which is why its row records the constraint rather than a clean bill of health.
- Nothing here re-answers the date-locale question, which is IMP-125's to decide, and no tolerance here
  bears on it.
- No product file was modified: `web/`, `tests/`, `scripts/`, `.github/`, `readme.md` and
  `CONTRIBUTING.md` are untouched.
