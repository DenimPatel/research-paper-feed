# Re-verification — IMP-225, second pass (`verify-IMP-225-r2`)

**Verifier:** the same independent verifier who returned FAIL on the first draft
(`.improve/reports/verify-IMP-225.md`). The rework was written in response to that FAIL; I re-checked
every item independently rather than accepting it.

**Verdict: FAIL — narrow.** All seven advertised corrections are genuinely made and hold under
re-derivation, including the two that mattered most (the one-cause diagnosis and baseline #1's
reclassification). The failure is in the surrounding text: **one new arithmetic slip in the
criterion-5 cost table** that the rework introduced, **one unsupported claim about what the 8
environments varied**, and **one stale figure in the runbook `FEATURES.md` cites as authoritative**.
None of these touches a measurement; all three are one-line fixes.

---

## 1. Correction-by-correction

| # | advertised correction | verdict | how I checked it |
|---|---|---|---|
| 1 | one cause (headless vs headed); regression 7 correct; drift is a separate defect worth ~0 of the 15.46 % | **confirmed** | §2 — diffed baseline #1 against **sweep 7's own retained capture** |
| 2 | #1 reclassified "Comparable within tolerance", headed-only, thin basis stated | **confirmed** | §3, §5 |
| 3 | `1 h 38 m after` removed | **confirmed** | §4 — grep clean |
| 4 | row #10 reason replaced with `recon-experience.md:54` provenance | **confirmed** | §4 — quote verified verbatim |
| 5 | `0.0280 % → 0.0286 %`; 390x844 labelled a projection; measured mobile worst case = 0 px | **confirmed** | §3, §6 |
| 6 | sizes corrected (`pinned` 52 KB, `thin` 12 KB, harness ≈59 KB, corpus 34 KB; "~145 KB") | **partly** — three of four figures right, **the total is wrong** | §6 |
| 7 | §7 points at `measurements-2026-10-03.txt` + `aggregate.py`; no "unretained" claim | **confirmed** | §4 |

### 1.1 Correction 1 verified against sweep 7's own artefact, not the author's paraphrase

```
$ python3 .improve/tools/imp225/pngdiff.py \
    .improve/artifacts/baseline/baseline-feed-desktop-1280.png \
    .improve/artifacts/regression-7/feed-desktop-1280.png
…: 178045 px differ (15.4553%) over 820 rows; maxdelta=235; bbox=[0, 0, 1279, 899]

$ python3 .improve/tools/imp225/pngdiff.py \
    .improve/artifacts/regression-7/feed-desktop-1280.png \
    /tmp/imp225/runs/H-real__feed-desktop-1280-01.png
…: 178045 px differ (15.4553%) over 820 rows; maxdelta=235; bbox=[0, 0, 1279, 899]
```

Sweep 7's own HEAD capture is byte-for-byte the author's `dsf=1` **headless** reference, and
15.4553 % from the baseline — the same figure the author recorded as
`sweep7:baseline-vs-realHeadless`. The dataset identity is anchored, not assumed:

```
$ shasum -a 256 /tmp/imp225/dist/data/index.json web/public/data/index.json
b26172fd89b0b84ae892070e04a19f271f5abfa89c14379ef6092f1569532753  /tmp/imp225/dist/data/index.json
b26172fd89b0b84ae892070e04a19f271f5abfa89c14379ef6092f1569532753  web/public/data/index.json
$ python3 -c "…meta-H-real.json…"
headed False  dsf 1  data /tmp/imp225/dist/data  idx b26172fd89b0b84a  pin True
```

So `FEATURES.md`'s "This is the **whole** of regression 7's 15.46 %, which regression 7 correctly
diagnosed" is now a measured statement, and the ~0 drift contribution to *that* comparison is right:
baseline #1 renders the current index, so drift cannot enter it. Drift's separate, real effect on the
other 13 is stated with its own evidence (2,812 vs 14,253, read off the pixels). **This is no longer a
re-hedge; it is the correct decomposition.** One loose phrase survives: §1's "dsf was held at 1
throughout" — true of the three captures quoted, but the corpus deliberately ran dsf 1.5 and 2 in
W5–W8. Scope it to "in every capture used above", as the next sentence already does for scroll.

### 1.2 Correction 2 — the reclassification is supported, and honestly bounded

```
$ python3 .improve/tools/imp225/pngdiff.py \
    .improve/artifacts/baseline/baseline-feed-desktop-1280.png \
    /tmp/imp225/runs/H-real__feed-desktop-1280-01.png
…: 1 px differ (0.0001%) over 1 rows; maxdelta=1; bbox=[606, 341, 606, 341]
```

"Comparable within tolerance" is earned: 1 px against a 330 px ceiling. The constraints are all
present and all true — `headed` only (headless is 15.4553 %, measured), the single-measurement basis
(§7 bullet 4: "rests on **one** measurement… a thin basis for 'usable'"), and the two-provenance
history. A future verifier is not invited to over-trust it: `FEATURES.md` states the mode constraint
in the same sentence that grants usability.

One wording defect carried over from the first draft: row #1 says the file "embeds two provenances …
so it is a hybrid". A PNG holds one generation of bytes. What is true is that IMP-219 **overwrote** the
Oct-1 version, so the earlier provenance is gone, not embedded. The honest constraint (headed-only,
one measurement) is already stated, so nothing turns on this — but it is the first draft's framing
surviving in the row that now carries the report's most load-bearing claim.

### 1.3 Corrections 3–5, 7 confirmed

```
$ grep -n "1 h 38\|not retained\|0.0280\|unrecoverab" .improve/reports/impl-IMP-225.md
(no output)
```

Row #10's replacement is quoted exactly as the source has it —
`.improve/reports/recon-experience.md:54`: `` | `baseline-feed-preview-build-desktop-1280.png` |
Production build (preview server), `#q=kinematic+meanflow` | `` — and the invented IMP-041/IMP-028
attribution is gone. The 390x844 figure is labelled a projection in all three places (report §2, §7,
`FEATURES.md` item 4) with the measured mobile worst case of 0 px stated beside it.

## 2. Arithmetic, re-derived

```
330/1152000*100 = 0.028645833333333332   -> 0.0286 %   OK (report §2/§3, FEATURES.md item 4)
330/329160*100  = 0.10025519504192489    -> 0.1003 %   OK, and labelled a projection
1280*900 = 1152000 ; 390*844 = 329160 ; ratio 3.500x    OK
14 baselines: 1150526 B = 1123.6 KB ; du -sh = 1.1M      OK
fixture/pinned : du -sk 52 ; apparent 42087 B = 41.1 KB  OK (report: "52 KB (du -sh; 41.1 KB apparent)")
fixture/thin   : du -sk 12 ; apparent 5014 B = 4.9 KB   report says "12 KB" — du, unlabelled
harness .py/.cjs/README.md : 59912 B = 58.5 KB           report "≈59 KB"  OK
measurements-2026-10-03.txt : du -sk 36 ; 34168 B       report "34 KB" — neither (34,168/1000)
```

**Remaining slip — the total.** The table lists four commit routes; the sentence below them says the
committable base is **"~145 KB (fixture + harness + corpus)"**. No consistent sum produces 145:

| basis | sum |
|---|---|
| the report's own four figures (52 + 12 + 59 + 34) | **157 KB** |
| all-`du -sk` (52 + 12 + 72 + 36) | **172 KB** |
| all-apparent, both fixtures (41.1 + 4.9 + 58.5 + 33.4) | **137.9 KB** |
| 145 | reachable only as 52 + 59 + 34 — i.e. **silently dropping the `fixture/thin` row the table itself lists** |

This is the same class of defect as the first draft's `64 KB` (which was `fixture/` including `thin/`),
and it sits in the one table criterion 5 exists to police. It also mixes conventions inside one table:
`du` for the fixtures, apparent for the harness and the corpus. Fix by picking one basis and showing
the addition — e.g. "52 + 12 + 72 + 36 = 172 KB by `du -sk` (137.9 KB apparent)".

## 3. NEW / remaining defect: what the 8 environments actually varied

`impl-IMP-225.md:86` (and `README.md:112`'s framing) says:

> "The 8 environments vary browser build, `deviceScaleFactor`, timezone, locale and Chromium launch args."

Across all 42 retained sidecars in `/tmp/imp225/runs/`:

```
$ python3 -c "…for f in glob.glob('meta-*.json')…"
browser versions: {'149.0.7827.22': 42}
tz:               {'America/New_York': 42}
locale:           {'en-US': 42}
browser args:     {'[]': 42}
dsf:              {1: 38, 1.5: 2, 2: 2}
headless:         {False: 30, True: 12}
```

Browser build, timezone and locale are **single-valued across the entire corpus**, and launch args are
empty in every capture that feeds the population. The only runs with non-empty args are the two
colour-profile probes — and they are in none of the eight groups:

```
$ python3 -c "…from aggregate import WITHIN, resolve; print per-group labels…"
W1 -> ['E1-headless-dsf1','E3-headless-s1'…'s6','F2-headless-pinned']
W2 -> ['F1-headed-pinned','F3-headed-pinned-s1'…'s6']
W3 -> ['M1-mobile-headed','M2-mobile-headed-s1'…'s6']   W4 -> ['M3-mobile-headless']
W5/W6 -> ['G1-headed-dsf1.5'] / ['G4-headless-dsf1.5'] W7/W8 -> ['G2-headed-dsf2'] / ['G3-headless-dsf2']
```

`E3-srgb` / `E4-p3` (the only `--force-color-profile` captures) match no prefix, so they are excluded.
The eight groups vary **headless/headless, `deviceScaleFactor` and viewport only**.

The spec's own bar — "at least N = 5 times across N ≥ 2 sessions or display/DPI conditions" — **is**
met (six sessions per group plus dsf 1/1.5/2 plus two viewports), so criterion 1 stands and the 330 px
worst case is unaffected: more environments would only add data, never raise confidence in a smaller
ceiling. What fails is the *characterisation*: it inflates the breadth of the sample, and it is the
sentence a future verifier would lean on when asking whether 330 px is safe on another machine. State
the three axes that actually varied; if browser/locale variation is wanted, run it.

## 4. `FEATURES.md` block, read top to bottom

The two corrections that mattered are in and correct: the header says "**14 files of which exactly ONE
is usable**", names `headed` as the only valid mode, gives 15.4553 % as the headless penalty, and item 5
says the figure is the whole of regression 7's 15.46 %. Arithmetic in item 4 is right (0.0286 %,
projection labelled). Nothing tells a verifier to discard a working baseline any more.

Two residual tensions, both cosmetic rather than misleading, but worth closing:

1. The paragraph immediately above the block still ends "a diff against `.improve/artifacts/baseline/`
   is not [evidence]", unqualified — directly above a block that says one of those 14 files is usable
   at 1 px. "supersedes the line above" plus "exactly ONE is usable" resolves it for a careful reader,
   but the sentence itself is now half-true. Report §5 repeats the same blanket claim ("**publish no
   baseline**… a diff against `.improve/artifacts/baseline/` is not") while §4 upgrades #1. Adding
   "…against the other 13" to both would remove the contradiction.
2. Item 1 says capture against the pinned fixture "never the live index" — correct advice, and the same
   block relies on a live-index capture to establish #1's 1 px. Not a contradiction (different
   purposes) but a reader could take item 1 as forbidding the measurement that justifies #1.

## 5. Forbidden escapes: neither used, re-confirmed

```
$ stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' .improve/artifacts/baseline/*.png
2026-10-01 22:55:31  baseline-feed-no-categories-selected-desktop-1280.png
…
2026-10-03 08:24:58  baseline-feed-desktop-1280.png      <- the only post-Oct-1 file, unchanged

$ shasum -a 256 .improve/artifacts/baseline/baseline-feed-desktop-1280.png
61988696c454bb36b0535b2daa4e5c56e1ef1bcf1ad3c7b2cb469f64c4d0cc6d
$ grep -o "61988696c4[0-9a-f]*" .improve/reports/impl-IMP-219.md
61988696c4
```

All 14 mtimes identical to my first pass; #1 still hashes to what IMP-219 recorded. Nothing was
re-captured. The tolerance is still the measured worst case, still tighter than the author's own
×2/×4/×8 margins in `aggregate.txt`, so it was not widened to let a diff pass.

## 6. Integrity and scope: clean

```
$ python3 .improve/tools/imp225/check_features.py
  item headings : 223   unique ids : 223   fields required per item : 12
  items missing any field : 0
  RESULT: OK

$ git diff --stat -- web/ tests/ scripts/ .github/ readme.md CONTRIBUTING.md
(empty)

$ git status --porcelain=v1
 M .improve/FEATURES.md
?? .improve/reports/impl-IMP-225.md
?? .improve/reports/impl-IMP-225-r2.md   (this file, written after the status read)
?? .improve/reports/verify-IMP-225.md
?? .improve/tools/
```

## 7. Issues (blocking, then non-blocking)

**Blocking**

1. `impl-IMP-225.md:167` — the "~145 KB" total does not follow from the table (52+12+59+34 = **157**;
   all-du 172; all-apparent 137.9). Restate in one convention with the addition shown.
2. `impl-IMP-225.md:86` (and `README.md:112`) — delete "browser build, timezone, locale and Chromium
   launch args" from the list of what the 8 environments varied; all 42 sidecars show one browser
   version, one timezone, one locale, and empty args outside two excluded colour-profile probes.
3. `README.md:22` — `fixture/pinned` is "46 KB total"; the same three files are 41.1 KB apparent /
   52 KB `du` in the report. Three numbers for one artefact in the loop's memory, in the file
   `FEATURES.md` names as the runbook. Fix to 41.1 KB (52 KB by `du`); `README.md:23`'s "12 KB" for
   `thin` is `du` (apparent 4.9 KB) and should say so.

**Non-blocking (fix in the same pass)**

4. Row #1: "it embeds two provenances … is a hybrid" → a PNG has one generation of bytes; IMP-219
   overwrote the Oct-1 one.
5. §2's lead sentence "Within a single environment, captures are bit-identical" is contradicted by its
   own table's 30 non-zero pairs (282/312 are; say so).
6. §1's "dsf was held at 1 throughout" → scope it to the captures quoted, as the scroll sentence does.
7. "a diff against `.improve/artifacts/baseline/` is not [evidence]" (`FEATURES.md` preamble and report
   §5) → "…against the other 13 is not".

## 8. Bottom line

The first draft's load-bearing error is genuinely fixed, and fixed against the evidence rather than by
re-wording: the one-cause diagnosis is now measured from sweep 7's own retained capture, baseline #1 is
reclassified with a bound a future verifier can check in one command, the clock error is gone, and the
provenance citation is exact. Nothing in the corrections needs to be revisited. What remains is three
arithmetic/traceability slips of the same species as the first draft's `64 KB` figure — which is why
this is a FAIL rather than a PASS, but a close one: fix §7's three blocking items and the item closes.

**Evidence:** `.improve/reports/impl-IMP-225.md` (esp. §1, §2, §4 row 1/10, §5, §7) ·
`.improve/FEATURES.md:42-77` · `.improve/tools/imp225/{README.md:22-23,112, aggregate.py,
measurements-2026-10-03.txt}` · `.improve/reports/regression-7.md` §6.1–§6.2 ·
`.improve/reports/impl-IMP-219.md:183` · `.improve/reports/recon-experience.md:54` ·
`web/src/App.tsx:597` · `.improve/artifacts/baseline/` (14 mtimes + #1 SHA) ·
`.improve/artifacts/regression-7/feed-desktop-1280.png` · `/tmp/imp225/runs/` (130 PNGs, 42 sidecars) ·
`/tmp/imp225/env/meta-*.json` · `/tmp/imp225/dist/data/index.json` · `/tmp/imp225/v225/{h1,h2,hl}`.