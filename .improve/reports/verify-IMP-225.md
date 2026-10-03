# Verification — IMP-225 (visual-regression jitter floor, tolerance, comparability)

**Verifier:** independent, did not write `.improve/reports/impl-IMP-225.md`.
**Verdict: FAIL** — the item's central measurements are non-vacuous and reproduce exactly, and neither
forbidden escape was used, but the report installs a **demonstrably false classification** into
`.improve/FEATURES.md` (the loop's authoritative visual procedure) about
`baseline-feed-desktop-1280.png`, and calls a fact "unmeasured" that the author's own corpus had
already measured at **1 px**. Four smaller, individually fixable defects are listed in §9.

Everything below is reproducible with the commands quoted. No product file was touched by this
verification (`git diff --stat -- web/ tests/ scripts/ .github/ readme.md CONTRIBUTING.md` → empty).

---

## 1. Criterion 1 — quantify the jitter floor: **MET**

Reproduced twice, independently.

**(a) My own within-environment pair** (two separate headed browser processes, scroll pinned, pinned
fixture, `--view feed-desktop-1280`):

```
$ node .improve/tools/imp225/capture.cjs --out /tmp/imp225/v225/h1 --label h1 --n 1 --headed \
      --port 4611 --pin-scroll --data .improve/tools/imp225/fixture/pinned --view feed-desktop-1280
h1__feed-desktop-1280-01.png  scroll=0->0  cards=50  status="60 papers match"
$ node .improve/tools/imp225/capture.cjs --out /tmp/imp225/v225/h2 --label h2 --n 1 --headed \
      --port 4612 --pin-scroll --data .improve/tools/imp225/fixture/pinned --view feed-desktop-1280
h2__feed-desktop-1280-01.png  scroll=0->0  cards=50  status="60 papers match"

$ python3 .improve/tools/imp225/pngdiff.py /tmp/imp225/v225/h1/h1__feed-desktop-1280-01.png \
      /tmp/imp225/v225/h2/h2__feed-desktop-1280-01.png
0 px differ (0.0000%) over 0 rows; maxdelta=0; bbox=None

$ shasum -a 256 /tmp/imp225/v225/*/*.png
358612d7f627440c3ab5b6ef2c548399682af3446f4d67e7157d7cefc9519423  h1__feed-desktop-1280-01.png
358612d7f627440c3ab5b6ef2c548399682af3446f4d67e7157d7cefc9519423  h2__feed-desktop-1280-01.png
faf649c4f0ed1862871e71dba52df230c7a450e715b0f048ad927fd99293096e  hl__feed-desktop-1280-01.png
```

Bit-identical bytes, not merely a 0-px diff.

**(b) The 312-pair / 8-environment distribution.** The corpus is still on disk at
`/tmp/imp225/runs/`, so I recomputed the whole table from the PNGs rather than trusting the runbook:

```
$ python3 .improve/tools/imp225/aggregate.py --dir /tmp/imp225/runs
W1 desktop 1280x900 dsf=1 HEADLESS                  18   153  153     0       0       0   0.0000
W2 desktop 1280x900 dsf=1 HEADED, scroll-pinned     12    66   36    30       0     0.0   330   0.0286
                                                   distinct non-zero px values: [1, 11, 329, 330]
W3 mobile 390x844 dsf=1 HEADED, scroll-pinned       12    66   66     0       0     0.0     0   0.0000
W4 mobile 390x844 dsf=1 HEADLESS                    6    15   15     0       0     0     0   0.0000
W5 desktop dsf=1.5 (1920x1350) HEADED                3     3    3     0       0     0     0   0.0000
W6 desktop dsf=1.5 (1920x1350) HEADLESS              3     3    3     0       0     0     0   0.0000
W7 desktop dsf=2 (2560x1800) HEADED                  3     3    3     0       0     0     0   0.0000
W8 desktop dsf=2 (2560x1800) HEADLESS                3     3    3     0       0     0     0   0.0000
POOLED                                                   312  282    30
B1 desktop 1280x900 dsf=1 HEADED, scroll NOT pinned   6    15    3    12       0 210770  280523  24.3510
B2 desktop 1280x900 dsf=1 HEADED, scroll NOT pinned   6    15   10     5       0       0  205888  17.8722
```

Identical, line for line, to the author's recorded run (`/tmp/imp225/agg.txt`, 338 s of pure-Python
PNG decoding): 312 pairs, 282 exactly 0, 30 non-zero, worst **330 px (0.0286 %)**, worst unpinned
**280,523 px (24.3510 %)**. Criterion 1 is met, and the "scroll is not stable unless pinned" claim is
measured, not asserted.

Two honest qualifications of the report's own §2 wording: the headline sentence "Within a single
environment, the difference is 0 px" is true of my pair and of 282/312 pairs, but W2's 30 non-zero
pairs (1, 11, 329, 330 px) are within-environment too, so the sentence is only true *after* the
report's own table two lines later. And the "0.1003 % at 390x844" in that table's worst-case row is a
**projection**, not a measurement: the mobile groups W3/W4 measured a worst case of **0 px**. The
harness's own notes label it correctly ("same 330 px absolute on the smaller viewport");
`impl-IMP-225.md` §2 and `FEATURES.md:63-66` do not.

## 2. The central claim, reproduced: headless vs headed = 15.2475 %

```
$ python3 .improve/tools/imp225/pngdiff.py /tmp/imp225/v225/h1/h1__feed-desktop-1280-01.png \
      /tmp/imp225/v225/hl/hl__feed-desktop-1280-01.png
175651 px differ (15.2475%) over 820 rows; maxdelta=235; bbox=[0, 0, 1279, 899]
```

Byte-for-byte the report's quoted line (`impl-IMP-225.md:35`). Sidecars confirm the only difference
between the two runs is `browser.headless`:

```
meta-h1.json: "headless": false, dsf 1, tz America/New_York, locale en-US, dataIndexSha256 eaf4a41e5ec23762…
meta-hl.json: "headless": true,  dsf 1, tz America/New_York, locale en-US, dataIndexSha256 eaf4a41e5ec23762…
```

Same Chromium 149.0.7827.22, same build, same dataset hash, same viewport, same pinned scroll. So the
load-bearing claim survives scrutiny: **0 px within an environment, ~15 % across headless/headed, and
device pixel ratio is not the cause** (dsf was pinned at 1 in both; the corpus's W5–W8 dsf 1.5/2 legs
are all internally 0 px and were never mixed into the within-environment population). Fonts: both
captures are the same build in the same browser, and the full-frame `bbox` with `maxdelta=235` is the
signature of a different rasterisation/compositing path, not a partially-loaded font (an unloaded font
changes glyph shapes in text runs, not the flat 1-unit background dither). Scroll: pinned and
recorded `scroll=0->0` on both. So the candidate third causes are excluded by measurement, not
assertion.

## 3. Criterion 2 — tolerance: **MET**, with one arithmetic slip

The 330 px ceiling **is** the measured worst case, taken from the W2 row above. It is not
reverse-engineered: the author's own `aggregate.txt` computed `margin x2: 660 px`, `x4: 1320 px`,
`x8: 2640 px` and the report deliberately took **none** of them, setting the ceiling at the observed
maximum. A tolerance loosened to let an existing diff pass would be looser than the worst case it is
supposed to bound; this one is tighter. Criterion 4's escape (a) was not used.

One error: `impl-IMP-225.md:93` says

```
observed worst case within one environment  = 330 px  (0.0280% of 1280x900 = 1,152,000 px)
```

`330/1152000*100 = 0.02864583…%` → **0.0286 %**, which is what §2 of the same report, the runbook
(`README.md:113`) and the new `FEATURES.md:64` all say. `0.0280 %` is wrong in the one place the
report presents the derivation "from §2 only".

## 4. Criterion 4 — the forbidden escapes: **NEITHER USED**

**(b) Re-capturing baselines.** Not used, and provably so. All 14 baseline mtimes are at or before
IMP-219's re-capture; IMP-225's own work ran 17:21–19:24 on Oct 3 (`/tmp/imp225` file times,
`measurements-2026-10-03.txt` mtime 19:20):

```
$ stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' .improve/artifacts/baseline/*.png
2026-10-01 22:55:31  baseline-feed-no-categories-selected-desktop-1280.png
...
2026-10-03 08:24:58  baseline-feed-desktop-1280.png      <- the only post-Oct-1 file
```

`.improve/reports/impl-IMP-219.md:183` records the re-capture and its hash
"`sha256 61988696c4…`"; the on-disk file hashes to exactly that
(`61988696c454bb36b0535b2daa4e5c56e1ef1bcf1ad3c7b2cb469f64c4d0cc6d`). So file #1 is IMP-219's byte
for byte, and IMP-225 re-captured nothing. (`git diff -- .improve/artifacts/` is empty by
construction — `.git/info/exclude:51` excludes that tree — so mtime plus the recorded hash is the
only available evidence, and it is sufficient.)

## 5. Criterion 3 — the 14-row table: **real per-file, but two rows are wrong**

Structure is genuine: exactly 14 rows, one per file, each naming a file-specific reason
(popover anchoring, focus ring, empty-search count, shard-derived load-more boundary, `localStorage`
collections, empty category manifest). It is not 14 copies of one sentence, and I confirmed
independently that the mechanical parts are true:

```
$ python3 .improve/tools/imp225/pngcrop.py /tmp/imp225/v225/hero-v4.png v \
    ".improve/artifacts/baseline/baseline-feed-preview-build-desktop-1280.png:0,120,780,200:x2"
```
→ renders `2,812 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index generated Oct 1, 2026`
(cause A confirmed for the Oct-1 files), while `baseline-feed-desktop-1280.png` renders
`14,253 papers … index generated Oct 3, 202…` — the current on-disk index
(`totalPapers 14253`, `generatedAt 2026-10-03T10:02:17Z`).

`capture.cjs:120` drives focus for `feed-focus-ring-desktop-1280` and `capture.cjs:278-283` seeds
`localStorage` via `addInitScript` for the collections views, so rows #8 and #11-#14 rest on code I
read.

### 5.1 Row #1 is false, and it is the row the report defends hardest

`impl-IMP-225.md:119` classifies `baseline-feed-desktop-1280.png` as **"Unproven, not disproven"**, on
the grounds that

> "the index now on disk was generated `2026-10-03T10:02:17Z` … i.e. **1 h 38 m after** the 08:24
> capture, so the exact index it was captured against is unrecoverable. A capture against the current
> index would plausibly be close; that is **unmeasured**, and it is not the same as measured."

All three parts are wrong.

**(i) The clock comparison is a 4-hour timezone error.** `stat` reports local (EDT, UTC−4 — confirmed:
`date` → `2026-10-03T19:37:27-0400 EDT`; my own harness sidecar writes UTC while the PNG's mtime is
local: `capturedAt 2026-10-03T23:27:31.667Z` ↔ mtime `19:27:34-0400`). The report compares a *local*
capture time with a *UTC* `generatedAt`:

```
baseline1 mtime local=2026-10-03T08:24:58-0400   (= 12:24:58Z)
index.json mtime local=2026-10-03T06:02:17-0400  (= 10:02:17Z, == generatedAt)
```

The index was generated **2 h 22 m 41 s *before*** the capture, not 1 h 38 m after it.

**(ii) The index is not unrecoverable, and the comparability *was* measured.** The author's own
measurement log already contains the answer, and I reproduced it against the author's own reference
capture (headed, dsf 1, scroll pinned, live index `b26172fd89b0b84a…`, view `feed-desktop-1280`):

```
$ python3 .improve/tools/imp225/pngdiff.py \
    .improve/artifacts/baseline/baseline-feed-desktop-1280.png \
    /tmp/imp225/runs/H-real__feed-desktop-1280-01.png
…: 1 px differ (0.0001%) over 1 rows; maxdelta=1; bbox=[606, 341, 606, 341]

$ grep -n "sweep7:baseline-vs-realHeaded" .improve/tools/imp225/measurements-2026-10-03.txt
sweep7:baseline-vs-realHeaded             1 px     0.0001%  rows=1    maxdelta=1 bbox=[606, 341, 606, 341]
$ grep -n "feed-desktop-1280  " measurements-2026-10-03.txt      # section 6 provenance probe
feed-desktop-1280                       178045        1   181263     6096   HD (1 px)
```

**1 pixel**, i.e. ~330× inside the report's own ceiling, against a capture on the current index. So
baseline #1 is **headed, on the live index, pinned-scroll, and comparable within tolerance** — one of
criterion 3's three named categories. Calling it "unproven" and its comparability "unmeasured" is
false, and it is the author's own retained measurement, quoted in the runbook's own measurements log,
that says so.

This error is not confined to the report. It is installed in the authoritative procedure:

```
.improve/FEATURES.md:50-52
  `.improve/artifacts/baseline/` is **13 stale files plus one whose comparability is unproven rather
  than disproven**, it is git-excluded, and **no** file in it has a recorded capture environment —
  these predate the harness, so for none of them can we even establish whether it was headless or
  headed.
```

For file #1 that is contradicted twice over: its environment *is* established (headed, dsf 1,
`dataIndexSha256 b26172fd89b0b84a…`, from `meta-H-real.json` plus the 1 px match), and its
comparability is measured. `FEATURES.md` is what every future verifier reads; this sentence will make
the next verifier discard a baseline that works to within one pixel.

The judgement the report explicitly asks for — is "unproven rather than disproven" a real distinction
or a hedge? **It is a hedge, and it is the one place the report's conservatism costs accuracy**: 13
files are genuinely unusable, and #1 is not one of them.

### 5.2 Row #10's reason is invented

`impl-IMP-225.md:128` says `baseline-feed-preview-build-desktop-1280.png` "depicts a *preview build*
state that IMP-041's and IMP-028's guards have since changed". Neither item has any such connection:
IMP-041 duplicates quality-gate steps into `deploy.yml`, IMP-028 pins index guards, and
`grep -rni "preview" web/src web/scripts .github/workflows/deploy.yml` finds no preview-build state
(the only hits are `ABSTRACT_PREVIEW_CHARS` in `PaperCard.tsx`). The loop's own record says something
else: `.improve/reports/recon-experience.md:54` documents that file as
"Production build (preview server), `#q=kinematic+meanflow`" — a search-results capture.
(`FEATURES.md:1052,1453` calls it a loading state instead, so the loop's records disagree; either way
the report's attribution to IMP-041/IMP-028 is unsupported.)

### 5.3 Row #9's wording is off

`impl-IMP-225.md:127` calls the index-missing message "code-derived". `web/src/lib/paperIndex.ts:228`
is `` `Shard ${shard.file} is missing or malformed…` `` — the rendered string embeds the shard
filename, so it is index-derived too. Harmless (the row's conclusion is unchanged), but it is the kind
of claim the loop's own evidence rules forbid asserting without reading the line.

## 6. Criterion 5 — version-control decision: **MET**, with a wrong figure inside it

The decision is explicit, the binding measurement is exact, and the reasoning (an unusable baseline
committed to history is worse than an absent one) is sound and not a rationalisation:

```
$ du -sh .improve/artifacts/baseline/     →  1.1M
$ python3 -c "…sum(getsize(p) for p in glob('…/baseline/*.png'))"
total bytes 1150526 = 1123.6 KB
```

That matches the report's "1,123.6 KB (1.10 MB)" exactly, and the per-file `du -k` list in
`measurements-2026-10-03.txt:503+` matches my `du -k` output file-for-file. `git check-ignore -v`
returns `.git/info/exclude:51:.improve/artifacts/` as quoted.

But two of the three alternative-route costs are wrong, and they feed the concluding figure:

| route | report | measured |
|---|---|---|
| Commit the 14 baselines | 1,123.6 KB (1.10 MB) | 1,150,526 B = 1,123.6 KB ✔ |
| Commit `fixture/pinned` instead | **64 KB**, 3 files | 42,087 B = **41.1 KB**; `du -sk fixture/pinned` = **52** |
| Commit the harness | ≈72 KB | 51,032 B = 49.8 KB; `du -sk` of the named files = 72 (block-rounded) |

"64 KB" is `du -sk .improve/tools/imp225/fixture/` — the whole fixture directory **including
`thin/`** (`du -sk …/fixture/thin/` = 12 KB; 52 + 12 = 64) — attributed to `pinned` alone. The
report mixes conventions as well (exact bytes for the baselines, block-rounded `du` for the harness),
and the headline "~136 KB and fully reproducible" should be ~123 KB by `du`, ~91 KB by bytes. Small,
but criterion 5 exists precisely because these numbers must be measured, and `README.md:22`'s "46 KB
total" for the same fixture is a third value for the same three files.

## 7. Criterion 4 — effect on sweep 7: **the right call, and better supported than the report argues**

"the stored-baseline comparison is unusable, and regression-7's CLEAN verdict is affected — though not
overturned" is correct. The report's own corpus closes the loop: `sweep7:baseline-vs-realHeaded = 1 px`
while `sweep7:baseline-vs-realHeadless = 178,045 px (15.4553 %)`, and that headless figure is
numerically identical to the control `env:headed-vs-headless-dsf1 = 178,045 px (15.4553 %)`. So sweep
7's 15.46 % is now *fully explained* as baseline-headed vs capture-headless on identical data, and its
decisive control (baseline vs PRE = 15.4752 %, larger still) follows. What survives — PRE-vs-HEAD
704 px in 13 rows from one deterministic session, the 200/200 date check, the pipeline matrix, the
600 randomised IMP-042 cases — does not depend on the stored baselines. "Affected but not overturned"
is right; "unfalsifiable" is the sharper and correct framing.

## 8. Diagnosis: sound in its mechanism, wrong about its own novelty and its second cause

- **Cause B (environment) is sound and measured**, and it is the whole of the 15.46 %. §2 above
  excludes dsf, viewport, fonts and scroll by measurement.
- **Cause A (dataset drift) contributes 0 to the 15.46 %.** The baseline sweep 7 diffed against is file
  #1, which renders the current index's 14,253 papers and was captured from it (1 px). Dataset drift
  is real for the other 13 files — but that is a separate fact about a different set, not a second
  cause of the figure the report is diagnosing. `impl-IMP-225.md:12-13`'s "two independent causes …
  and neither reason is the one regression 7 assumed" is therefore wrong on both clauses: the 15.46 %
  has one cause, and that cause **is** the one regression 7 assumed — `.improve/reports/regression-7.md`
  §6.1: "That number is an artefact of the capture environment, not a regression."
- **The refusal to apportion is not honest hedging; it is what hides the above.** `impl-IMP-225.md:43-46`
  declines to split the figure between A and B because "doing so honestly would need the Oct-1 index,
  which no longer exists". The Oct-1 index is not needed: the only measurement in question was taken
  against file #1, whose dataset is on disk. With one capture-pair the split resolves to 100 % B, and
  the report had that capture already (`H-real`, 17:36 on Oct 3, quoted in its own measurements log).
  A refusal that would have cost the report nothing if tested, and that preserves a flattering
  "two causes, neither one previously assumed" framing, is a dodge.

## 9. Issues (all specific and actionable)

1. **Row #1 must be reclassified** from "Unproven, not disproven" to **comparable within tolerance**,
   citing `1 px (0.0001%)` vs `runs/H-real__feed-desktop-1280-01.png` (headed, dsf 1, pinned scroll,
   live index `b26172fd89b0b84a…`) — 330× inside the ceiling the report itself sets. Delete "that is
   **unmeasured**" and the "1 h 38 m after" clause (the index predates the capture by 2 h 22 m; compare
   like with like — `stat` is local, `generatedAt` is UTC).
2. **`FEATURES.md:50-52` must be corrected to match**: "13 stale files plus **one that is comparable
   within tolerance to a headed capture against the live index (1 px) but whose provenance predates
   the harness**", and "no file has a recorded capture environment" must be qualified to "no file has
   a *recorded* environment; #1's is recoverable by measurement (1 px vs a headed live-index capture)".
   As written this instructs future verifiers to discard a working baseline.
3. **Row #10's reason must be replaced** with what `.improve/reports/recon-experience.md:54` records
   (a search-results capture, `#q=kinematic+meanflow`, from a preview server), or dropped as
   unsupported. Nothing links that file to IMP-041 or IMP-028.
4. **`impl-IMP-225.md:93`: `0.0280%` → `0.0286%`** (and label the 390x844 `0.1003%` a projection —
   the mobile worst case measured 0 px).
5. **§5 cost table: `fixture/pinned` is 41.1 KB (52 KB by `du -sk`), not 64 KB** — 64 KB is
   `fixture/` including `thin/`. Restate the harness figure in one convention (49.8 KB by bytes, 72 KB
   by `du -sk`) and fix "~136 KB" accordingly. Fix `README.md:22`'s "46 KB" to the same number.
6. **Rework §1's diagnosis**: 15.46 % = one cause (headed vs headless, identical data — measured, and
   already regression 7's own conclusion); dataset drift applies to the other 13 baselines, not to that
   figure. Remove "neither reason is the one regression 7 assumed".
7. **§7's "Honest limits" first bullet is wrong on two counts.** The sidecars were **not** "not
   retained" — `/tmp/imp225/env/meta-*.json` (5 of 8 environments) and the whole 130-file corpus at
   `/tmp/imp225/runs/` were on disk and reproduce the 312-pair table exactly (I did it in 338 s).
   "Re-run `capture.cjs` to regenerate them" is also not a route to that distribution: it would take
   the full 6-capture × 8-environment matrix across dsf 1/1.5/2 and headed/headless by hand. The
   honest statement is that the corpus lives under `/tmp` and is not in the repository.

## 10. Integrity and scope (criterion 6): **clean**

```
$ python3 .improve/tools/imp225/check_features.py
  item headings             : 223
  unique ids                : 223
  zero-width split blocks   : 223
  fields required per item  : 12
  items missing any field   : 0
  RESULT: OK

$ git diff --stat -- web/ tests/ scripts/ .github/ readme.md CONTRIBUTING.md
(empty)

$ git status --porcelain=v1
 M .improve/FEATURES.md
?? .improve/reports/impl-IMP-225.md
?? .improve/tools/
```

No product file changed. The `FEATURES.md` edit does mark the old procedure **NOT USABLE AS
SPECIFIED**, and its arithmetic is correct (`330/1,152,000 = 0.0286458 %` → 0.0286 %;
`330/329,160 = 0.1002552 %` → 0.1003 %; `1280×900 = 1,152,000`, `390×844 = 329,160`, `1,152,000/329,160
= 3.500×` all check out). Its defect is content, not arithmetic: issue 2 above.

## 11. What survives

The harness is a genuine instrument, not decoration: 0 px within an environment reproduced by SHA-256
equality, 15.2475 % across headless/headed reproduced to the pixel, 312/282/30/330 px reproduced from
the retained corpus, scroll instability reproduced at 24.3510 %. The tolerance is derived from the
measured worst case and is tighter than any margin the author computed and then declined to take.
Neither forbidden escape was used. The version-control decision is made, argued and mostly measured.
The sweep-7 restatement is correct. The failure is narrow but load-bearing: one classification, copied
from the report into the file every future verifier reads, is contradicted by a one-pixel measurement
the author already held and described as "unmeasured".

**Evidence:** `.improve/reports/impl-IMP-225.md` · `.improve/FEATURES.md:42-75` ·
`.improve/tools/imp225/` (`README.md`, `capture.cjs`, `pngdiff.py`, `matrix.py`, `aggregate.py`,
`check_features.py`, `measurements-2026-10-03.txt` §5-§8) · `.improve/reports/regression-7.md` §6.1-§6.2
· `.improve/reports/impl-IMP-219.md:183` · `.improve/reports/recon-experience.md:54` ·
`web/src/lib/paperIndex.ts:228` · `/tmp/imp225/agg.txt`, `/tmp/imp225/runs/` (130 PNGs +
`meta-*.json`), `/tmp/imp225/env/meta-*.json` · my captures `/tmp/imp225/v225/{h1,h2,hl}` + crops
`hero-v2.png`, `hero-v4.png`.