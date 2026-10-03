# Re-verification — IMP-225, fourth pass (`verify-IMP-225-r4`)

**Verifier:** same independent verifier (FAIL ×3: `verify-IMP-225.md`, `-r2.md`, `-r3.md`). This pass
verified by reading and re-deriving arithmetic only; the capture corpus was not re-run.

**Verdict: FAIL — one sentence species survives in three places.** All three advertised fixes landed
and are correct as stated: the size total now reproduces exactly, and the `FEATURES.md` preamble is
qualified. What is not fixed is the third fix's *other* occurrence: the unqualified determinism claim
was corrected in §2 only, while the identical claim survives verbatim in the report's headline outcome
line — the exact line r3 named — and in two further places I had not yet quoted. Nothing else moved.

---

## 1. Fix 1 — total size: **CONFIRMED**, re-derived from scratch

```
$ du -sk fixture/pinned fixture/thin measurements-2026-10-03.txt README.md .gitignore *.py *.cjs
52      fixture/pinned
12      fixture/thin
36      measurements-2026-10-03.txt
8       README.md
4       .gitignore
8       aggregate.py
4       check_features.py
12      gen_fixture.py
8       matrix.py
4       pngcrop.py
12      pngdiff.py
16      capture.cjs

$ du -skc fixture/pinned fixture/thin measurements-2026-10-03.txt *.py *.cjs README.md .gitignore | tail -1
176	total

$ python3 -c "…apparent sum over exactly those 12 paths…"
apparent bytes 141640 = 138.3 KB
```

Components `52 / 12 / 76 / 36` unchanged and correct (76 = 8+4+8+4+12+8+4+12+16, `.gitignore`
included). `impl-IMP-225.md:174-175` now reads "**176 KB** (138.3 KB apparent size, 141,640 B)" —
both figures reproduce exactly, by the command the report names. Resolved.

## 2. Fix 2 — `FEATURES.md` preamble qualified: **CONFIRMED**

```
**13 of the 14 stored baselines are NOT USABLE and must not be cited as a verification result; the
14th is usable in `headed` mode only — see the block immediately below.** … a screenshot with a hash
and a command is evidence; a diff against the 13 stale files in `.improve/artifacts/baseline/` is not.
```

Both edits landed, and they agree with the block below it ("14 files of which exactly ONE is usable",
`headed` only, 1 px) and with report §4/§5. I swept the whole replacement-procedure block for the two
blanket forms r3 warned about:

- blanket "no baseline is usable" — **none**; the block names the one exception, its mode constraint and
  its 1 px basis;
- blanket "a baseline diff is never evidence" — **none**; the dismissal is scoped to "the 13 stale
  files", and items 1–6 are unchanged (pinned fixture, `--pin-scroll`, `matrix.py`, 330 px ceiling with
  the 0.1003 % projection labelled, 15.4553 % / 15.2475 %, no re-capture).

No new inconsistency between `FEATURES.md`, the report and the runbook: the 312/282/30/330 px figures,
the 15.4553 % / 15.2475 % figures and the fixture sizes are identical in all three.

## 3. Fix 3 — §2 "bit-identical" softened: **CONFIRMED at §2, but the claim survives elsewhere**

`impl-IMP-225.md:63-64` now reads "**Within a single environment, captures are almost always
bit-identical** — 282 of 312 pairs exactly 0 px, 30 non-zero, worst 330 px (§3)." Correct, and
`README.md:112` and `FEATURES.md` item 4 both carry the accurate 282/30 form.

Three surviving occurrences of the overstatement, all still asserting determinism the report's own
§2/§3 data refutes:

| line | text | problem |
|---|---|---|
| `impl-IMP-225.md:7` | "Within one environment the renderer is bit-identical." | **verbatim the claim r3 named** ("and the same claim in the report's outcome line"). 30 of 312 within-environment pairs are non-zero, worst 330 px — so it is not bit-identical. This is the report's one-line summary, i.e. the sentence most likely to be the only one a later reader takes away. |
| `impl-IMP-225.md:57` | "the renderer **proven deterministic within an environment** (0 px, and 1 px for the one stored baseline)" | contradicts §2's own "282 of 312 … 30 non-zero" and §3's need for a 330 px ceiling; the parenthetical's own "1 px" is not determinism either. |
| `impl-IMP-225.md:192` | "the renderer is proven deterministic within an environment" (§6, sweep-7 restatement) | same claim, third instance. |

This is the species the brief asked me to hunt ("anywhere that implies … the renderer is exactly
deterministic corpus-wide"), and one of the three was already on r3's list and was not addressed. It is
material rather than stylistic: a reader who takes "bit-identical" from line 7 will read the 330 px
ceiling as slack that need not be investigated, which is the opposite of what §3 says it is for.

Suggested replacement, true to the data and consistent with §2: line 7 → "Within one environment the
renderer is bit-identical in 282 of 312 measured pairs, worst case 330 px."; lines 57 and 192 → "the
renderer **proven near-deterministic within an environment** (282 of 312 pairs exactly 0 px, worst case
330 px, plus 1 px for the one stored baseline)".

No other overstatement of this kind exists. `README.md` contains no determinism claim at all (its only
"byte-deterministic" refers to `gen_fixture.py`, which is accurate); `FEATURES.md`'s block states the
282/30 split in item 4 and never asserts corpus-wide determinism.

## 4. Everything else re-confirmed

```
$ python3 .improve/tools/imp225/check_features.py
  item headings : 223   unique ids : 223   zero-width split blocks : 223
  fields required per item : 12   items missing any field : 0   RESULT: OK

$ git diff --stat -- web/ tests/ scripts/ .github/ readme.md CONTRIBUTING.md
(empty)

$ stat -f '%Sm %N' -t '%Y-%m-%d %H:%M:%S' .improve/artifacts/baseline/*.png | sort | tail -1
2026-10-03 08:24:58  .improve/artifacts/baseline/baseline-feed-desktop-1280.png
$ shasum -a 256 .improve/artifacts/baseline/baseline-feed-desktop-1280.png | cut -c1-24
61988696c454bb36b0535b2d
$ grep -o "61988696c4" .improve/reports/impl-IMP-219.md | head -1
61988696c4
```

All 14 baseline mtimes unchanged across all four passes; #1 still hashes to IMP-219's recorded value.
Tolerance still `0 px` with a **330 px** ceiling set at the measured worst case (`impl-IMP-225.md:109`)
— not widened. Arithmetic re-derived: `330/(1280*900) = 0.0286458…% → 0.0286 %`;
`330/(390*844) = 0.1002551…% → 0.1003 %` (labelled a projection in report §2, §7, `FEATURES.md` item 4
and `README.md`); baselines `1,150,526 B = 1,123.6 KB`.

## 5. Issue

**Blocking (one edit, three sentences)** — `impl-IMP-225.md:7`, `:57`, `:192`: replace the unqualified
"bit-identical" / "proven deterministic within an environment" with the measured form quoted above.
Nothing else in the item is outstanding: sizes, `FEATURES.md`, provenance, the diagnosis, the 14-row
table, the tolerance and the sweep-7 restatement are all confirmed correct in this pass.

**Evidence:** `.improve/reports/impl-IMP-225.md` (§2:63-64, §3:109-112, §5:169-175) ·
`.improve/FEATURES.md:42-77` · `.improve/tools/imp225/README.md:22-23,110-124` ·
`.improve/reports/impl-IMP-219.md:183` · `.improve/artifacts/baseline/` (14 mtimes + #1 SHA) ·
`du -sk` / `du -skc` over `.improve/tools/imp225/{fixture/pinned,fixture/thin,*.py,*.cjs,README.md,.gitignore,measurements-2026-10-03.txt}`.