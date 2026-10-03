# Verification — IMP-013 and IMP-014

Verifier: independent sub-agent. Did not write the change. All ratios recomputed from
`web/src/styles.css` with two separate implementations; all browser behavior reproduced
against the built bundle served on a private port.

---

## 1. Contrast math, recomputed independently

Method: WCAG 2.x relative luminance. For channel `c` in `[0,1]`,
`lin(c) = c/12.92 if c <= T else ((c+0.055)/1.055)^2.4`, `Y = 0.2126R + 0.7152G + 0.0722B`,
ratio `= (Yhi + 0.05) / (Ylo + 0.05)`.

I ran two independent implementations that differ only in the sRGB linearization
threshold: `T = 0.04045` (current WCAG 2.1+) and `T = 0.03928` (legacy). Both agree on
every pass/fail verdict. Ratios are reported as `T=0.04045 / T=0.03928`.

### After — light `--border: #898783`

sRGB (137,135,131) → linear (0.246202, 0.238462, 0.230945)
Y = 0.2126(0.246202) + 0.7152(0.238462) + 0.0722(0.230945) = **0.242850**

| surface | hex | Y | arithmetic | ratio | ≥3:1 |
|---|---|---|---|---|---|
| `--bg` | `#faf9f6` | 0.947292 | 0.997292 / 0.292850 | 3.4055 / 3.4057 | PASS |
| `--surface` | `#ffffff` | 1.000000 | 1.050000 / 0.292850 | **3.5855** | PASS |
| `--surface-muted` | `#f1f0eb` | 0.887993 | 0.937993 / 0.292850 | **3.1422** / 3.2034 | PASS |

Minimum: **3.1422:1** (legacy) / **3.2034:1** (current) on `--surface-muted`.
Margin over 3.0: **+0.1422 (+4.74%)** / +0.2034 (+6.78%). Not a rounding artifact.

### After — dark `--border: #6a727e`

sRGB (106,114,126) → linear (0.144128, 0.165981, 0.208612)
Y = 0.2126(0.144128) + 0.7152(0.165981) + 0.0722(0.208612) = **0.160951**

| surface | hex | Y | arithmetic | ratio | ≥3:1 |
|---|---|---|---|---|---|
| `--bg` | `#14161a` | 0.007232 | 0.210951 / 0.057232 | 3.7269 / 3.6860 | PASS |
| `--surface` | `#1c1f24` | 0.012983 | 0.210951 / 0.062983 | 3.4001 / 3.3496 | PASS |
| `--surface-muted` | `#22262c` | 0.016908 | 0.210951 / 0.066908 | **3.1275** / 3.1530 | PASS |

Minimum: **3.1275:1** (legacy) / **3.1530:1** (current) on `--surface-muted`.
Margin over 3.0: **+0.1275 (+4.25%)** / +0.1530 (+5.10%).

**The implementer's reported 3.1422 / 3.1275 reproduce EXACTLY** under the legacy
`T=0.03928` threshold. The brief's "~1.21:1 before" is the `--bg` figure; the spec's
"1.27:1" is the `--surface` figure. Both are correct and both are confirmed below. The
reported numbers are not rounded in the implementer's favor — under the modern
threshold the true margins are slightly *larger* than reported.

### Before — confirming the baseline really failed

| theme | `--border` | `--bg` | `--surface` | `--surface-muted` | min |
|---|---|---|---|---|---|
| light | `#e6e4dc` | 1.2092 | **1.2731** | 1.1157 | 1.1157 — FAIL |
| dark | `#2c3036` | 1.3655 | 1.2457 | 1.1459 | 1.1459 — FAIL |

`1.2731:1` on `--surface` matches `FEATURES.md`'s stated "1.27:1" exactly, which also
validates my luminance implementation against the spec's own prior figure.

### Exhaustive surface coverage

`--border` is consumed at 19 sites (`grep -n 'var(--border)' web/src/styles.css`).
`--border` is defined twice, once per theme. `web/src` contains exactly **one**
stylesheet; there are no inline `style={{}}` attributes and no hardcoded border hex
outside the two token definitions.

Every one of the 19 sites resolves its backdrop to `--bg`, `--surface`, or
`--surface-muted`:

| line | selector | backdrop |
|---|---|---|
| 119 | `.site-header` border-bottom | `--bg` @ 86% alpha (see note) |
| 198 | `.collection` | `--surface` |
| 214 | `.controls` | `--surface` |
| 260 | `.controls__search input` | `--bg` |
| 298, 308 | `.paper`, `.paper:hover` | `--bg` |
| 356 | `.chip` | `--surface` |
| 386 | `.ghost` | `--surface` |
| 452, 464 | `.button--secondary`, `.button--ghost` | `--surface` |
| 494 | `.input` (import/collection name) | `--surface` |
| 532, 545 | `.empty`, `.empty--error` | `--surface` |
| 558, 565 | `.site-footer`, `.error-banner` | `--bg` |
| 579 | `.table-wrap` | `--surface` |
| 647 | `.table th/td` | `--surface` |
| 695 | `.collection .paper` | **`--surface`** (not `--bg` — see issue 1) |

**No unverified surface exists.** The set of distinct backdrops is exactly the three
tokens, all three of which clear 3:1 in both themes.

Note (non-binding): `.site-header`'s 1px bottom rule sits on `color-mix(--bg 86%,
transparent)` with a `backdrop-filter`. In the pathological case of near-black content
scrolled beneath it, the composited luminance gives ~2.96:1. This is a decorative
structural separator, not a UI-component boundary, so WCAG 1.4.11 does not apply.
Recorded for completeness; not an issue.

### Derived states

`.paper:hover` uses `color-mix(in srgb, var(--border) 60%, var(--accent))`:
- light → `#6d9c93`: 4.0707:1 on `--bg`
- dark → `#578883`: 4.1348:1 on `--surface`

Both comfortably above 3:1 and clearly distinct from the resting border. No state
regressed.

---

## 2. AC2 ruling — the open question

### Is the fix `:focus-visible`-scoped, with no blanket outline?

Confirmed three independent ways.

1. **Source.** `grep -n 'outline' web/src/styles.css` returns exactly two lines —
   `styles.css:87` `outline: 2px solid var(--accent);` and `styles.css:88`
   `outline-offset: 2px;` — both inside the **pre-existing** global `:focus-visible`
   rule (lines 86-90). `grep -n 'outline: none'` returns **zero matches**.
2. **Built bundle.** `web/dist/assets/index-*.css` contains exactly **2** `outline`
   tokens in the whole file, both from that one global rule:
   `:focus-visible{outline:2px solid var(--accent);outline-offset:2px;...}`. The only
   `focus` rules in the bundle are `a:hover,a:focus-visible`, `:focus-visible`,
   `.skip-link:focus`, and `.controls__search input:focus{border-color:var(--accent)}`.
   There is no `outline` on the input and no `outline: none` anywhere.
3. **Live DOM.** Computed `outline` on the focused input is
   `rgb(31, 111, 92) solid 2px` with `outline-offset: 2px` — i.e. it is produced
   entirely by the global rule, not by any input-specific override.

**AC2 (IMP-014) is met, literally and in intent.** The fix is the deletion of one
`outline: none` line, which re-enables the app's single existing `:focus-visible` rule.
No author-added blanket ring was introduced.

### Reproduced browser behavior (real input, built bundle, Chromium)

| interaction | element | `:focus` | `:focus-visible` | computed outline |
|---|---|---|---|---|
| `Tab` x4 | search input | true | **true** | `rgb(31,111,92) solid 2px`, offset 2px |
| real mouse click | search input | true | **true** | `rgb(31,111,92) solid 2px`, offset 2px |
| real mouse click | `Feed` button | true | **false** | `outline-style: none` |

The input/button difference is **real and exactly as the implementer described.**

### Ruling: AC2 is MET

The reasoning, explicitly:

- AC2's operative sentence is "the fix must not add a blanket `outline`". It does not.
  The only authored change is a deletion; the visible ring is produced by a global
  rule that predates both items and applies identically to every control in the app.
- The mouse-click asymmetry is **UA-side, not author-side.** `:focus-visible` is a
  pseudo-class the *user agent* decides whether to match; an author cannot make it
  stop matching. Chromium treats text-entry controls as always focus-visible because
  they accept typed input and the caret location is itself a persistent, meaningful
  focus signal. Buttons have no such signal, so Chromium uses input modality.
- Therefore the input's ring on mouse click is **not suppressible by CSS without
  removing the ring entirely**, which is precisely the bug IMP-014 exists to fix. The
  only three author options are (a) leave it as-is, (b) `outline: none` on `:focus`
  and repaint on `:focus-visible` — provably identical to (a) for a text input,
  since `:focus-visible` matches anyway, and (c) `outline: none` with no repaint,
  which restores the bug.
- The asymmetry is also **pre-existing in kind and reduced in severity.** Before this
  change a keyboard user tabbing to the input got *no* ring at all — strictly worse.
  After it, keyboard focus rings on input and buttons identically.

**Residual, cosmetic, and acceptable:** in the *mouse* modality the input rings and
buttons do not. This is inherited platform behavior, and no CSS-only fix exists that
does not reintroduce `outline: none`. Nothing further is required. I do **not** rule
AC2 unmet.

---

## 3. Visual judgment

Screenshots inspected: the three in `.improve/artifacts/IMP-013/`, both in
`.improve/artifacts/IMP-014/`, and `baseline-feed-focus-ring-desktop-1280.png` plus
`baseline-collections-desktop-1280.png`. I also captured my own at 1280px and 390px in
both themes, plus a seeded collection containing a saved paper to exercise the nested
`.collection > .paper` case.

**`.paper` cards and `.collection` outlines look intentional.** This is the change I
watched most closely, because a jump from 1.27:1 to 3.14:1 is large and could easily
have produced accidental-looking heavy boxes. It has not. The new border is a mid
warm-gray at 1px, sitting alongside an existing soft shadow; together they read as a
deliberate card treatment rather than an outline someone added to satisfy a number.
The `.collection` panel likewise reads as an intentional container. The
`.empty` dashed state, which was previously a near-invisible hint, now reads as a
legitimate dashed placeholder — an improvement, not an artifact.

**The chips got louder, and that is the most noticeable side effect.** Filter chips
previously showed outlines only in their active/primary states; now every chip carries
a visible gray pill outline. Comparing baseline to after, this is the single biggest
perceptual delta. My honest read: it looks deliberate and consistent — a coherent set
of outlined toggles — but it is the element a designer would most likely want to look
at again. Not a defect.

**Is the search input's boundary now clearly a form control?** Yes, unambiguously. In
the baseline the input was bounded only by a barely-perceptible hairline. My own
unfocused capture at 1280px shows a crisp 1px gray boundary that reads instantly as a
text field. This is the clearest win of the change.

**Does the focused ring match the rest of the app?** Yes. It is the same global
`:focus-visible` treatment — 2px `--accent`, 2px offset, `--radius-sm` — that the
baseline screenshot already shows on a filter chip. The search input now looks
identical to every other focusable control. That consistency is the point of the
`:focus-visible` scoping, and it is achieved.

**Cosmetic observation (not an issue):** the focused input shows a *doubled* edge — the
restored 2px accent ring, then a 2px gap of panel background, then the 1px accent
`border-color` that `styles.css:218` already applied on `:focus`. Two concentric
accent-colored lines. This is a consequence of a **pre-existing, untouched** rule
becoming visible alongside the ring, not something this change introduced, and a
doubled strong focus indicator is if anything good for accessibility. Flagging it for
a future polish pass only.

**390px.** Checked with measurement, not just by eye. Search input at x=37 inside a
`.controls` panel at x=16 → 21px clearance on each side; the ring's outer edge (37−4)
sits well inside the panel border and does not collide with it. `.paper` is 358px wide
at a 390px viewport; a 1px border consumes 2px total, which is not perceptible. Chips
wrap to two rows and the outlines remain legible. **No crowding.**

**Nested `.collection > .paper` at 390px.** Seeded a collection containing a saved
paper and captured it. The outer `.collection` (`--surface`) and inner `.paper`
(`--bg`) now both show visible 1px borders, with a clear tonal step between the white
outer panel and the off-white inner card. The nesting reads correctly as
panel-inside-panel-inside-card. It does not look accidental and does not crowd.

**Dark theme.** Applied the dark token block and captured the feed at 1280px. The
`#6a727e` border is proportionally *more* prominent in dark than the light equivalent
is in light — an inherent asymmetry of dark borders on dark surfaces, not a property of
this change. It reads as a considered cool hairline surface separation, not a heavy
box. I do not think it looks wrong, but it is the one place where a designer's eye
might reasonably ask for a slightly lighter value. Not a blocker: 3.1275:1 is a real
pass and the appearance is coherent.

---

## 4. Scope

```
git diff --name-only  →  web/src/styles.css        (1 file)
git diff --numstat    →  2  3  web/src/styles.css
git diff --stat       →  1 file changed, 2 insertions(+), 3 deletions(-)
```

Exactly **3 lines** touched: 2 `--border` token values replaced, 1 `outline: none`
deleted. No mass reformatting — `git diff --ignore-all-space --numstat` returns the
identical `2 3`, so none of the churn is whitespace.

Confirmed **not** touched: `web/src/App.tsx`, `web/src/lib/`, `web/src/components/`,
`web/src/scripts/`, any Python, any docs, any workflow, `web/package-lock.json`.
`git status --porcelain --untracked-files=all -- web/ lib/ scripts/ docs/ .github/`
returns only ` M web/src/styles.css`.

The only other `git status` entries are untracked `.improve/reports/*.md` loop
bookkeeping (including the implementer's own report). No source.

`web/public/data` is byte-identical, sha256 re-verified after the browser session:

```
c1ce0e60989207166ab7df1095e8737a7ce24de0242e81326481e4509e55789e  index.json
bcce73f692478fd605c5408dfb75bffe6dc7ecbfca2d999c3888246a86d7369e  papers-2026-W39.json
cb0641456b3026d56980306dd4beebf80e756a2a5ffae6e2f7d72b3dcb587f36  papers-2026-W40.json
```

---

## 5. No regression

From `web/`:

| command | result |
|---|---|
| `npm run typecheck` | **exit 0** |
| `npm test` | **Test Files 19 passed (19) / Tests 292 passed (292)**, exit 0 |
| `npm run build` | **exit 0**, `dist/assets/index-*.css` = **10914 B = 10.91 kB** |

Test integrity audited, not assumed: `grep -rn "\.skip\|\.todo\|\.only\|xit(\|xdescribe("
src/` returns **only** `.skip-link` CSS class matches — zero skipped, todo, or focused
tests anywhere in `src/`. All 292 tests pass; none deleted or weakened. Correct for a
CSS-only change: no test could legitimately be affected.

The built CSS absolute size of 10.91 kB matches the report exactly. The claimed `−20 B`
delta I could not independently confirm without reverting the file, which is out of
bounds; source-level reasoning (a 20-byte rule removed, two 7-char hex values
shortened) is consistent with a small net reduction. Not counted against the change.

---

## 6. Implied changes

**Other `--border` consumers.** Grepped exhaustively — 19 sites, tabulated in §1. Every
one is a component whose backdrop is one of the three verified surface tokens. The
change is broader than the three elements the spec names (it reaches `.controls`,
`.chip`, `.ghost`, `.button--secondary`, `.button--ghost`, `.input`, `.empty`,
`.site-footer`, `.error-banner`, `.table`, `.table-wrap`, `.site-header`), and in every
case the result is the same verified token. The implementer's §2 table covers 17 of the
19 sites; the two it missed are both `.site-header` (a decorative rule) and the
`.collection .paper` nesting case (issue 1), neither of which leaves an unverified
surface.

**IMP-012 not disturbed.** `--text: #1c1c1a`, `--text-muted: #666661` (light) and
`--text: #f1f1ee`, `--text-muted: #9b9b94` (dark) all appear as **unchanged context
lines** in the diff. Re-verified numerically, same-theme surfaces only:

| theme | `--text-muted` | vs `--bg` | vs `--surface` | vs `--surface-muted` | min |
|---|---|---|---|---|---|
| light | `#666661` | 5.4825 | 5.7722 | 5.0586 | **5.0586:1** PASS |
| dark | `#9b9b94` | 6.4772 | 5.9094 | 5.4355 | **5.4355:1** PASS |

Both clear 4.5:1 with wide margin. Even against `--accent-soft`, which they are not
used on, they hold (5.0066 light / 4.6445 dark). **No regression.**

---

## 7. Live browser verification

Served the built app with `npm run preview -- --port 5311 --strictPort`, verified in
Chromium at **1280x900** and **390x844**, in both light and dark.

- Search input unfocused: visible 1px `rgb(137,135,131)` boundary, unmistakably a form
  control.
- Search input keyboard-focused: `:focus-visible` true, `rgb(31,111,92) solid 2px`
  outline at 2px offset.
- `.paper` / `.controls` / `.chip` / `.collection` computed borders: `rgb(137,135,131)`
  light, `rgb(106,114,126)` dark — matching the source tokens exactly.
- Dark tokens verified live by injecting the dark custom-property block:
  `.collection` border `rgb(106,114,126)` on `rgb(28,31,36)`; nested
  `.collection .paper` border `rgb(106,114,126)` on `rgb(20,22,26)`.
- **Console: zero messages of any kind** at every checkpoint.

Server stopped; `lsof -nP -iTCP:5311 -sTCP:LISTEN` reports no listener.

`.playwright-mcp/` is excluded via `.git/info/exclude`, so the tool's screenshot
scratch files do not appear in `git status --porcelain`. That directory pre-existed my
session (it contains artifacts from earlier runs at 10:34-18:23) and was left untouched;
I removed nothing and moved nothing.

---

## 8. Acceptance criteria

| # | Criterion | Verdict |
|---|---|---|
| IMP-013 AC1 | `--border` ≥ 3:1 on `--bg`, `--surface`, `--surface-muted`, both themes | **MET** (min 3.1422 / 3.1275) |
| IMP-013 AC2 | raised in both the light and the dark theme block | **MET** |
| IMP-013 AC3 | hue-matched to the neutral ramp, not flattened to pure gray | **MET** |
| IMP-013 AC4 | derived hover/focus states stay legible | **MET** (4.0707 / 4.1348) |
| IMP-013 AC5 | no other token altered | **MET** |
| IMP-014 AC1 | keyboard focus indicator restored on the search input | **MET** |
| IMP-014 AC2 | fix scoped to `:focus-visible`, not a blanket `outline` | **MET** (see §2) |
| IMP-014 AC3 | input's own `:focus` styling not regressed | **MET** |
| IMP-014 AC4 | no other control's focus treatment changed | **MET** |
| Cross | typecheck / 292 tests / build all green, scope limited to 3 lines | **MET** |

**10 / 10 met.** No criterion unmet.

---

## 9. Issues

All non-blocking. None require a code change to accept this item.

1. **Implementer report, §2 table — imprecise.** It lists `.paper`'s backdrop as
   `--bg`. For a `.paper` nested inside a `.collection`, `styles.css:689-692` sets
   `background: var(--bg)` on a `.collection` whose own background is `--surface`, so
   the actual adjacency is `.paper` border vs `--surface`. No acceptance criterion is
   missed — that pairing measures 3.5855 light / 3.4001 dark, already inside the
   verified set — but the table is wrong as written. This is exactly the error class
   that `FEATURES.md`'s evidence rules were introduced to prevent, and it is worth
   correcting in the report for the next reader.
2. **Implementer report, §1 diff block — stale and partly incorrect.** Its hunk headers
   read `@@ -8,7 +8,7 @@`, `@@ -51,7 +51,7 @@`, `@@ -211,7 +211,6 @@`; the real
   `git diff` produces `@@ -4,7 +4,7 @@`, `@@ -30,7 +30,7 @@`, `@@ -217,7 +217,6 @@`.
   It also shows dark `--text: #f2f1ec` where the file has `#f1f1ee`. The **actual
   committed diff is clean** — this is a transcription error in the report only, but
   it is the second time a diff excerpt in this loop has not been copied from the file.
3. **AC2 residual, cosmetic, not fixable — documented, not a defect.** The search input
   rings on mouse click; buttons do not. UA-driven `:focus-visible` heuristic; no
   CSS-only remedy exists that does not reintroduce `outline: none`. Detailed ruling in
   §2. No action.
4. **Cosmetic, pre-existing, not introduced here.** The focused input shows a doubled
   accent edge (restored 2px ring + the pre-existing `border-color: var(--accent)` at
   `styles.css:218`). Candidate for a future polish pass; not a fix requirement for
   this item.

---

## Verdict

**PASS.**

`--border` genuinely clears 3:1 on every surface in both themes with real margin
(+4.25% worst case), confirmed by two independent implementations that also reproduce
the spec's own prior 1.27:1 figure. `outline: none` is gone, the built bundle contains
exactly two `outline` declarations and both belong to the pre-existing global
`:focus-visible` rule, and the input rings on keyboard focus exactly as every other
control does. The mouse-click asymmetry is real, is the platform's heuristic rather
than the author's work, and has no CSS-only fix that does not undo the repair — so AC2
is satisfied. Visually the heavier borders read as intentional at 1280px and 390px in
both themes, with no crowding; the search input now reads unmistakably as a form
control. Three lines in one file, 292/292 tests, clean build, untouched data.
