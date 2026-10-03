# Re-verification — IMP-225, third pass (`verify-IMP-225-r3`)

**Verifier:** the same independent verifier (FAIL in `verify-IMP-225.md`, FAIL in
`verify-IMP-225-r2.md`). Fixes were written in response to those FAILs; I re-derived everything from the
artefacts rather than from the reports' own wording.

**Verdict: FAIL — narrow, one blocking number.** Fixes 1, 2, 3 and 5 are confirmed correct as stated,
and I re-derived each of their figures independently. Fix 4 is correct in **every component** and wrong
in its **total**: the table's four rows now sum to **176 KB**, not the 172 KB printed beneath them,
because this pass widened the harness row from 72 KB to 76 KB (adding `.gitignore`) without moving the
total. The stated apparent figure (137.9 KB) is likewise stale — it was measured before this pass's
`README.md` edit and is now 138.3 KB. This is the same defect species as the `64 KB` and `145 KB` slips
of the earlier passes: a figure labelled as measured that does not reproduce when the reader runs the
command. Two items I classified non-blocking in r2 also remain open, and the report and `FEATURES.md`
now disagree in wording (details in §5).

Nothing else moved: no baseline was re-captured, the tolerance is untouched, and the 312-pair
distribution is unmodified (I did not re-run it — third reproduction is not evidence of anything new).

---

## 1. Fix 1 — §1 dsf claim: **CONFIRMED**

`impl-IMP-225.md:51-54` now reads "`dsf` was **1** for the comparison above (and for corpus groups
W1–W4) and 1.5/2 elsewhere". Verified against the group definitions I resolved in r2: W1–W4 are the
dsf=1 groups (`W1 desktop 1280x900 dsf=1 HEADLESS`, `W2 … dsf=1 HEADED`, `W3 … mobile … dsf=1 HEADED`,
`W4 … mobile … dsf=1 HEADLESS`) and W5–W8 are the dsf 1.5/2 groups. Accurate, and correctly scoped
rather than corpus-wide.

## 2. Fix 2 — §2 variation axes: **CONFIRMED, re-derived from the sidecars**

The false axes are gone from both files. My own enumeration of all 42 sidecars in `/tmp/imp225/runs/`:

```
$ python3 -c "…for f in glob.glob('runs/meta-*.json')…"
sidecars in runs/: 42
views: {'feed-desktop-1280': 34, 'feed-mobile-390': 8}
dsf: {1: 38, 1.5: 2, 2: 2}
headless: {False: 30, True: 12}
browser versions: {'149.0.7827.22': 42}
tz: {'America/New_York': 42}
locale: {'en-US': 42}
browser args: {'[]': 42}
distinct dataIndexSha256: 5
    b26172fd89b0b84a 35   04b2c114cba7fb9e 3   c03f4256293a4fe5 2
    eaf4a41e5ec23762  1   49f66cd2321dcb62 1
```

Every element of the new sentence reproduces: two views, dsf ∈ {1, 1.5, 2}, two modes, one browser
build, one timezone, one locale, empty args, **5** distinct datasets. `README.md`'s measured-facts list
carries the same corrected sentence, and the old browser-build/tz/locale/args claim is gone from both
files (`grep -n "46 KB\|64 KB\|145 KB\|172\|176" README.md` → no output).

Precision footnote, not a defect: two retained sidecars *outside* the corpus do carry Chromium args —
`/tmp/imp225/env/meta-E3-srgb.json` (`--force-color-profile=srgb`) and `…/meta-E4-p3.json`
(`--force-color-profile=display-p3`). Their captures live in `env/`, have no sidecar in `runs/`, and
match no `aggregate.py` group prefix, so they are outside all eight environments. The report's claim is
explicitly scoped ("from all 42 retained `meta-*.json` sidecars"), so it is true as written; one clause
noting the two excluded colour-profile probes would make it airtight.

## 3. Fix 3 — §4 row #1: **CONFIRMED**

`impl-IMP-225.md:135` now says the environment is **unrecorded**, that "IMP-219 overwrote the Oct-1 file
with this one, so the PNG has exactly one generation, but which environment that generation was
captured in is not written down anywhere", and that "usability therefore rests on the single 1 px
measurement above, not on a recorded provenance." The first draft's "two provenances / hybrid" framing
is gone (`grep -n "hybrid" impl-IMP-225.md` → no output). The claim is true: the on-disk bytes are
IMP-219's capture, no sidecar exists for them, and the 1 px figure is the only evidence of environment —
so a future verifier cannot mistake this for a recorded provenance. `§7`'s matching bullet is intact.

## 4. Fix 4 — §5 sizes: components CONFIRMED, **total WRONG (blocking)**

Components, each re-measured:

```
$ du -sk fixture/pinned fixture/thin      → 52   12
$ du -sk README.md aggregate.py capture.cjs check_features.py gen_fixture.py \
        matrix.py pngcrop.py pngdiff.py .gitignore
        8  8  16  4  12  8  4  12  4      = 76
$ du -sk measurements-2026-10-03.txt      → 36
$ du -sh .improve/artifacts/baseline/     → 1.1M
```

So `fixture/pinned` 52 KB `du` / 41.1 KB apparent, `fixture/thin` 12 KB `du`, harness code+runbook
76 KB `du` (the 8 + 8 + 16 + 4 + 12 + 8 + 4 + 12 + 4 sum, `.gitignore` included), corpus 36 KB `du`,
baselines 1,123.6 KB — **all four rows are right**.

The total is not. `impl-IMP-225.md:173` says "by `du -skc` over exactly those paths: **172 KB**":

```
$ du -skc fixture/pinned fixture/thin README.md aggregate.py capture.cjs check_features.py \
          gen_fixture.py matrix.py pngcrop.py pngdiff.py .gitignore measurements-2026-10-03.txt | tail -1
176	total
```

and the table's own rows give `52 + 12 + 76 + 36 = 176`. The printed 172 is the sum that **excludes**
`.gitignore` (harness = 72) — the previous pass's figure, left behind when the harness row was widened
to 76. The apparent figure is stale for the same reason:

```
$ python3 -c "…sum sizes of exactly those paths…"
apparent total bytes 141640 = 138.3 KB          # report says 137.9 KB
```

`README.md` grew in this pass (the corrected measured-facts bullet), so the pre-edit apparent total no
longer holds. Neither number changes any decision — the argument for keeping the baselines local rests
on provenance, not size — but criterion 5 requires these figures to be measured, and a total that
contradicts the table above it is the exact failure mode r2 flagged. Fix: either drop `.gitignore`
from the harness row (→ 172 KB) or print **176 KB** and re-measure apparent (**138.3 KB**).

## 5. Fix 5 — qualification and README: **CONFIRMED**, with one divergence

Report §5 now reads (`:176-178`): "A screenshot with a hash and a command is evidence; a diff against
`.improve/artifacts/baseline/` is evidence **only** for the single usable file #1, in `headed` mode."
That is the correct qualification and it matches §4 row #1.

`README.md:22` → "41.1 KB apparent, 52 KB by `du -sh`"; `:23` → "12 KB by `du -sh`"; the measured-facts
list carries the corrected variation axes. All three confirmed.

**But `FEATURES.md` was not touched in this pass** (`git diff` blob is unchanged, `index
9822c79..f9022a5`, identical to r2), so its preamble still carries the unqualified sentence:

> "…a screenshot with a hash and a command is evidence, a diff against `.improve/artifacts/baseline/`
> is not."

directly above a block that says "**14 files of which exactly ONE is usable** … measured **1 px
(0.0001%)**". r2 listed this as non-blocking and asked for "…against the other 13 is not" in **both**
the report and `FEATURES.md`; only the report side was fixed. The report and the file it points at now
disagree, which is the one thing this loop's evidence rules single out as unacceptable.

## 6. Forbidden escapes: still absent

```
$ stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' .improve/artifacts/baseline/*.png | sort
2026-10-01 22:55:31  …feed-no-categories-selected…  (13 files, all 2026-10-01 22:55-23:00)
2026-10-03 08:24:58  baseline-feed-desktop-1280.png

$ shasum -a 256 .improve/artifacts/baseline/baseline-feed-desktop-1280.png
61988696c454bb36b0535b2daa4e5c56e1ef1bcf1ad3c7b2cb469f64c4d0cc6d
$ grep -o "61988696c4[0-9a-f]*" .improve/reports/impl-IMP-219.md
61988696c4
```

All 14 mtimes byte-for-byte as in passes 1 and 2; #1 still hashes to what IMP-219 recorded. The
tolerance is still `0 px` with a **330 px** ceiling — the measured worst case, tighter than the ×2/×4/×8
margins in `aggregate.txt` — so nothing was widened to let a diff pass.

## 7. Arithmetic re-derived from scratch

```
330/(1280*900)*100 = 0.028645833333333332   → 0.0286 %   OK (report §2/§3, FEATURES.md item 4)
330/(390*844)*100  = 0.10025519504192489    → 0.1003 %   OK, labelled a projection in all 3 places
1280*900 = 1152000 ; 390*844 = 329160 ; 1152000/329160 = 3.500x   OK
14 baselines: 1150526 B = 1123.6 KB ; du -sh = 1.1M ; du -skc = 1144 KB   OK
52 + 12 + 76 + 36 = 176   ← printed total says 172          MISMATCH
```

## 8. Integrity and scope: clean

```
$ python3 .improve/tools/imp225/check_features.py
  item headings : 223   unique ids : 223   zero-width split blocks : 223
  fields required per item : 12   items missing any field : 0   RESULT: OK

$ git diff --stat -- web/ tests/ scripts/ .github/ readme.md CONTRIBUTING.md
(empty)

$ git status --porcelain=v1
 M .improve/FEATURES.md
?? .improve/reports/impl-IMP-225.md
?? .improve/reports/impl-IMP-225-r2.md
?? .improve/reports/verify-IMP-225.md
?? .improve/tools/
```

## 9. Still open from r2 (non-blocking, unchanged)

- §2's lead sentence "**Within a single environment, captures are bit-identical**" — and the same claim
  in the report's outcome line — is contradicted three lines later by its own table (282 of 312 exactly
  0; **30 non-zero**). Say "bit-identical in 282 of 312 pairs; worst case 330 px".
- `FEATURES.md`'s unqualified "a diff against `.improve/artifacts/baseline/` is not [evidence]" (§5).

## 10. Issues

**Blocking**

1. `impl-IMP-225.md:173` — print the total that `du -skc` returns (**176 KB**, not 172) or drop
   `.gitignore` from the harness row; and re-measure the apparent total (**138.3 KB**, not 137.9 KB).

**Non-blocking, same pass**

2. `FEATURES.md` preamble — qualify "…a diff against `.improve/artifacts/baseline/` is not" to the
   other 13, so the authoritative file matches report §5.
3. `impl-IMP-225.md:6-7,63` — soften "bit-identical" to 282/312.
4. `impl-IMP-225.md:86-91` — optional: note that the two colour-profile probes
   (`env/meta-E3-srgb.json`, `env/meta-E4-p3.json`) carry `--force-color-profile` args and sit outside
   all eight groups.

**Evidence:** `.improve/reports/impl-IMP-225.md` (§1:51-54, §2:86-96, §4:135, §5:165-178, §7) ·
`.improve/FEATURES.md:42-77` (unchanged since pass 2) · `.improve/tools/imp225/README.md:22-23,108-120` ·
`.improve/tools/imp225/measurements-2026-10-03.txt` · `.improve/reports/impl-IMP-219.md:183` ·
`/tmp/imp225/runs/` (130 PNGs, 42 sidecars), `/tmp/imp225/env/meta-*.json`,
`/tmp/imp225/dist/data/index.json` · `.improve/artifacts/baseline/` (14 mtimes + #1 SHA).