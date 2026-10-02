# Verification report — IMP-012

**Verifier:** independent verifier sub-agent (did not write the change)
**Item:** `IMP-012 — Darken --text-muted until it clears 4.5:1 on every surface`
**Verdict:** **PASS** (7 / 7 acceptance criteria met)
**Scope reviewed:** `git diff -- web/src/styles.css` only. `web/src/lib/collections.ts` and
`web/src/lib/__tests__/collections.test.ts` (IMP-151, concurrent agent) were deliberately excluded.

The source change is correct, minimal, and complete. Every contrast number the implementer
reported reproduces to four decimal places under independent arithmetic. The defects found are
confined to the **implementer's written report** — stale line numbers, two stale token values, and
fabricated build-size figures. None of them affect the shipped code, but they are real and should
be corrected if the report is treated as a record.

---

## 1. The change under review

`git diff -- web/src/styles.css`:

```diff
@@ -6,7 +6,7 @@
    --surface-muted: #f1f0eb;
    --border: #e6e4dc;
    --text: #1c1c1a;
-  --text-muted: #7a7a73;
+  --text-muted: #666661;
    --accent: #1f6f5c;
    --accent-strong: #143f35;
    --accent-soft: #e7f1ee;
```

**The changed line is `web/src/styles.css:9`, not line 18.** See Issue D1.

```
$ git diff --stat -- web/src/styles.css
 web/src/styles.css | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

$ git diff --ignore-all-space --stat -- web/src/styles.css
 web/src/styles.css | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)
```

The `--ignore-all-space` stat is identical to the normal stat, so **there is no whitespace-only
churn** anywhere in the file. Byte-level confirmation of line 9 before and after:

```
$ git show HEAD:web/src/styles.css | sed -n '9p' | od -An -c
    -  -  t  e  x  t  -  m  u  t  e  d  :     #  7  a  7  a  7  3  ;  \n
$ sed -n '9p' web/src/styles.css | od -An -c
    -  -  t  e  x  t  -  m  u  t  e  d  :     #  6  6  6  6  6  1  ;  \n

both byte counts: 25
```

Both lines are exactly 25 bytes, share the identical 16-byte prefix `  --text-muted: `, and differ
only in the 6 hex digits. Nothing else moved.

**Pre-existing indentation anomaly, not introduced here.** Line 9 carries 2 leading spaces while its
neighbours (lines 8, 10) carry 3. Both the before and after versions have 2 spaces, so the edit
preserved the anomaly rather than creating it. Out of scope for this item, but it is a latent
inconsistency worth a future hygiene pass — the implementer was right *not* to touch it, since
fixing it would have added a second changed line to a deliberately one-line diff.

No other source file in the repo was touched. `.improve/FEATURES.md` shows only the routine
`TODO -> IN-PROGRESS` status flip for IMP-012 (and, separately, for IMP-151), which is normal loop
workflow. No stray `.playwright-mcp/` scratch directory was left behind.

---

## 2. Independent contrast arithmetic

Computed with the WCAG 2.x relative-luminance formula, from scratch, in a standalone script
(`/tmp/kilo/contrast.mjs`), reading the token values directly out of the stylesheet rather than
trusting the implementer's transcription.

```
lin(c) = c/12.92                if c <= 0.04045
       = ((c + 0.055)/1.055)^2.4 otherwise      (c is the 0..1 channel)
L      = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio  = (L_lighter + 0.05) / (L_darker + 0.05)
```

### 2.1 Backgrounds (light theme, `styles.css:3-25`)

```
--bg            #faf9f6  rgb(250,249,246)  linear(0.9559, 0.9473, 0.9251)  L = 0.94588
--surface       #ffffff  rgb(255,255,255)  linear(1.0000, 1.0000, 1.0000)  L = 1.000000
--surface-muted #f1f0eb  rgb(241,240,235)  linear(0.8796, 0.8714, 0.8308)  L = 0.868227
--text          #1c1c1a  rgb(28,28,26)     linear(0.0121, 0.0121, 0.0103)  L = 0.011520
```

### 2.2 BEFORE — `--text-muted: #7a7a73` (rgb 122,122,115)

```
sRGB channels   = (122,122,115) / 255 = (0.478431, 0.478431, 0.450980)
linear channels = (0.191, 0.194, 0.171)   [full precision 0.191202 / 0.194617 / 0.171441]
L = 0.2126(0.191202) + 0.7152(0.194617) + 0.0722(0.171441)
  = 0.040644 + 0.139190 + 0.012378
  = 0.192213
```

| background | bg L   | ratio arithmetic | result | verdict |
|---|---|---|---|---|
| `--bg` `#faf9f6` | 0.945880 | (0.995880) / (0.242213) | **4.1050:1** | FAIL |
| `--surface` `#ffffff` | 1.000000 | (1.050000) / (0.242213) | **4.3220:1** | FAIL |
| `--surface-muted` `#f1f0eb` | 0.868227 | (0.918227) / (0.242213) | **3.7877:1** | FAIL |

### 2.3 Cross-check against the recon record

`.improve/REPO_PROFILE.md:696` (item WEB-52) records the before-state as
`4.32:1 on --surface, 3.79:1 on --surface-muted, 4.11:1 on --bg`.

My independently computed values are 4.3220 / 3.7877 / 4.1050, which round to **4.32 / 3.79 / 4.11**.
The recon figures and the implementer's figures are both correct, and they agree with each other.

### 2.4 AFTER — `--text-muted: #666661` (rgb 102,102,97)

```
sRGB channels   = (102,102,97) / 255 = (0.400000, 0.400000, 0.380392)
linear channels = (0.132868, 0.132868, 0.119538)   [full precision 0.132868 / 0.132868 / 0.119538]
L = 0.2126(0.132868) + 0.7152(0.132868) + 0.0722(0.119538)
  = 0.028243 + 0.095020 + 0.008631
  = 0.131894
```

| background | bg L   | ratio arithmetic | result | verdict |
|---|---|---|---|---|
| `--bg` `#faf9f6` | 0.945880 | (0.995880) / (0.181894) | **5.4825:1** | **PASS** |
| `--surface` `#ffffff` | 1.000000 | (1.050000) / (0.181894) | **5.7722:1** | **PASS** |
| `--surface-muted` `#f1f0eb` | 0.868227 | (0.918227) / (0.181894) | **5.0586:1** | **PASS** |

**The implementer's claimed 5.48 / 5.77 / 5.06 are correct to the stated precision.** Every pair
clears 4.5:1. The worst case (`--surface-muted`, i.e. chips and tags) has 12.4 % headroom.

### 2.5 Hierarchy check — did muted text get too close to primary text?

`--text` is byte-identical to baseline, so this is purely about the gap:

| pair | contrast |
|---|---|
| `--text #1c1c1a` on `--surface` | 16.1481:1 |
| `--text-muted #666661` on `--surface` | 5.7722:1 |
| ratio of the two | **2.80x** |

The hierarchy is not merely intact, it is *wider* than before: `--text` on `--surface` was 16.15:1
against a muted 4.32:1 (a 3.74x relationship), now 16.15:1 against 5.77:1 (2.80x). Darkening the
muted tone necessarily narrows the relative gap while widening the absolute accessibility margin.
2.80x is still a strong, unambiguous step — muted text reads as secondary, not as a second primary.

---

## 3. Dark mode — claim independently verified

`impl-IMP-012.md:57` claims "dark mode already passed and was left alone." **Verified.**

`--text-muted` is declared **only** inside the `@media (prefers-color-scheme: dark)` block and was
**not** touched by the diff (the diff touches only line 9, which is in `:root`).

Dark values, `styles.css:28-45`:

```
--bg            #14161a  rgb(20,22,26)     L = 0.007232
--surface       #1c1f24  rgb(28,31,36)     L = 0.013553
--surface-muted #22262c  rgb(34,38,44)     L = 0.019440
--text-muted    #9b9b94  rgb(155,155,148)  L = 0.323107   [unchanged]
```

```
--text-muted #9b9b94:  linear (0.327778, 0.327778, 0.297694)
L = 0.2126(0.327778) + 0.7152(0.327778) + 0.0722(0.297694)
  = 0.069691 + 0.234427 + 0.021493
  = 0.325611
```

(Re-derived L = 0.32561 for `#9b9b94`; the ratios below use the script's full-precision value.)

| background | bg L   | ratio | verdict |
|---|---|---|---|
| `--bg` `#14161a` | 0.007232 | (0.375611)/(0.057232) = **6.5631:1** | PASS |
| `--surface` `#1c1f24` | 0.013553 | (0.375611)/(0.063553) = **5.9101:1** | PASS |
| `--surface-muted` `#22262c` | 0.019440 | (0.375611)/(0.069440) = **5.4089:1** | PASS |

All three dark surfaces pass. This matches `impl-IMP-012.md:232-234` (6.563 / 5.910 / 5.409) and the
recon range at `REPO_PROFILE.md:696` (5.44–6.48, and 5.409 falls inside it).

### 3.1 Second theme block — checked, none missed

```
$ grep -nE "prefers-color-scheme|\.dark|data-theme|theme=" web/src/styles.css
2:  color-scheme: light dark;
27:@media (prefers-color-scheme: dark) {
29:  --bg: #14161a;
30:  --surface: #1c1f24;
31:  --surface-muted: #22262c;
32:  --border: #2c3036;
33:  --text: #f1f1ee;
35:  --text-muted: #9b9b94;
36:  --accent: #6fbfa4;

$ grep -rniE "dark|theme|colorScheme" web/src/*.tsx web/src/components/*.tsx
(no matches)
```

There is exactly **one** dark block (`styles.css:27-45`, `@media (prefers-color-scheme: dark)`). No
`.dark` class, no `[data-theme]`, no theme toggle in any component. There is no second theme source
that could have been missed.

One observation, **not a defect and not in scope**: `styles.css:2` sets `color-scheme: light dark`
unconditionally on `:root`. In a light-mode OS the browser will therefore render native form controls
(scrollbars, etc.) in light mode, matching the light token block. This is consistent and
pre-existing; it is not a dark-mode contrast hole because it never applies the dark *tokens*.

---

## 4. Exhaustiveness — is muted text ever used against something unverified?

This is the part most likely to hide a real defect, so I checked it three independent ways.

### 4.1 Static enumeration of every `--text-muted` use

```
$ grep -n "text-muted" web/src/styles.css
9:  --text-muted: #666661;          <- the declaration
36:  --text-muted: #9b9b94;         <- dark override, unchanged
149:    color: var(--text-muted);   .nav-link
192:    color: var(--text-muted);   .hero p
244:    color: var(--text-muted);   .controls__group legend
263:    color: var(--text-muted);   .chip
288:    color: var(--text-muted);   .controls__count
331:    color: var(--text-muted);   .paper__meta
356:    color: var(--text-muted);   .tag
376:    color: var(--text-muted);   .paper__note
526:    color: var(--text-muted);   .save-menu__empty
557:    color: var(--text-muted);   .empty
569:    color: var(--text-muted);   .panel
669:    color: var(--text-muted);   .collection__count
699:    color: var(--text-muted);   .site-footer p
```

13 use sites. **This list matches `impl-IMP-012.md:194-213` exactly**, line for line. Good.

```
$ grep -rn "text-muted" web/src --include="*.tsx" --include="*.ts"
(no matches)
```

**Zero** `--text-muted` uses in any `.tsx` or `.ts`. No new companion token was introduced by this
change (correct — the fix needed only the existing token).

### 4.2 Hardcoded colours in TSX — none

```
$ grep -rnE '#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(' web/src/*.tsx web/src/components/*.tsx
(no matches)

$ grep -rn "style={{" web/src/*.tsx web/src/components/*.tsx
(no matches)
```

Across all 11 component/entry TSX files there is **no hardcoded hex/rgb/hsl colour and no inline
`style=` attribute at all**. So no TSX can introduce an unverified background behind muted text.

The only hardcoded colours in the entire codebase are in `web/src/styles.css`, and every one of them
is either a `:root` token declaration or a box-shadow alpha:

```
12:   --bg: #faf9f6;
13:   --surface: #ffffff;
14:   --surface-muted: #f1f0eb;
15:   --border: #e6e4dc;
16:   --text: #1c1c1a;
17:  --text-muted: #666661;
18:   --accent: #1f6f5c;
19:   --accent-strong: #143f35;
20:   --accent-soft: #e7f1ee;
22:   --danger: #a52a2a;
23:   --danger-soft: #fbe9e7;
24:   --warning-bg: #fdf3d7;
25:   --warning-text: #6b5310;
29-36: dark overrides
56:   box-shadow uses rgba() alpha only, no hue-bearing colour
```

`styles.css:53-61` box-shadows use `rgba(31,111,92,.16)` / `rgba(0,0,0,.06)` / `rgba(0,0,0,.10)` —
these are shadow colours behind opaque surfaces, not backgrounds behind text.

### 4.3 Static background-inheritance trace for all 13 sites

| line | rule | effective background | source of that background | verified? |
|---|---|---|---|---|
| 149 | `.nav-link` | `--bg` rgb(250,249,246) | `.site-header:117` is `color-mix(in srgb, var(--bg) 86%, transparent)` — same RGB as `--bg`, only alpha set, so compositing over `body` `--bg` is a no-op. `.site-nav`/`.site-header__inner` are transparent. | yes 5.4825 |
| 192 | `.hero p` | `--bg` rgb(250,249,246) | `.hero` and `.app__main` have no background; `body:79` is `var(--bg)` | yes 5.4825 |
| 244 | `.controls__group legend` | `--surface` rgb(255,255,255) | `.controls:197` | yes 5.7722 |
| 263 | `.chip` | `--surface-muted` rgb(241,240,235) | `.chip:262` sets it on the same rule | yes 5.0586 |
| 288 | `.controls__count` | `--surface` rgb(255,255,255) | `.controls:197` | yes 5.7722 |
| 331 | `.paper__meta` | `--surface` **or** `--bg` | `.paper:298` = `--surface`; overridden to `--bg` at `.collection .paper:692` in the collections view. Both checked. | yes 5.7722 / 5.4825 |
| 356 | `.tag` | `--surface-muted` rgb(241,240,235) | `.tag:352` on the same rule | yes 5.0586 |
| 376 | `.paper__note` | `--surface` **or** `--bg` | same as `.paper__meta` | yes 5.7722 / 5.4825 |
| 526 | `.save-menu__empty` | `--surface` rgb(255,255,255) | `.save-menu__body:494` | yes 5.7722 |
| 557 | `.empty` | `--surface` rgb(255,255,255) | `.empty:558` on the same rule | yes 5.7722 |
| 569 | `.panel` | `--surface` rgb(255,255,255) | `.panel:565` on the same rule | yes 5.7722 |
| 669 | `.collection__count` | `--surface` rgb(255,255,255) | `.collection:647` | yes 5.7722 |
| 699 | `.site-footer p` | `--bg` rgb(250,249,246) | `body:79` | yes 5.4825 |

Edge cases explicitly considered and cleared:

- `.panel--error` (`styles.css:589`) sets only `border-color`; background stays `--surface`.
- `.banner--error` uses `--danger`, not muted.
- `.chip:hover` (`:281`) and `.chip--active` (`:284`) override `color` to `--text` /
  `--accent-strong`, so those states do not carry muted text.
- `.tag--primary` (`:365`) overrides `color` to `--accent-strong` on `--accent-soft`.

**Every muted-text background in the codebase is one of `--bg`, `--surface`, `--surface-muted`. No
unverified background exists.**

### 4.4 Pixel-level proof from the delivered screenshots

Static reasoning can miss a runtime `color-mix` or inherited background. So I verified it against the
actual rendered pixels. I flood-clustered **every** pixel of exactly the new ink colour `rgb(102,102,97)`
in all four screenshots, and for each cluster took the modal colour of a surrounding ring (excluding
ink and near-ink antialiasing):

| screenshot | ink clusters | background each cluster landed on | ratio | verdict |
|---|---|---|---|---|
| `IMP-012/feed-desktop-1280.png` | 559 | 466x rgb(250,249,246), 45x rgb(241,240,235), 48x rgb(255,255,255) | 5.4825 / 5.0586 / 5.7722 | PASS |
| `IMP-012/feed-mobile-390.png` | 137 | 137x rgb(250,249,246) | 5.4825 | PASS |
| `IMP-012/collections-desktop-1280.png` | 294 | 157x rgb(250,249,246), 137x rgb(255,255,255) | 5.4825 / 5.7722 | PASS |
| `IMP-012/collections-mobile-390.png` | 102 | 102x rgb(250,249,246) | 5.4825 | PASS |

**1,092 distinct muted glyph clusters. Zero landed on anything other than `--bg`, `--surface`, or
`--surface-muted`.** This is ground truth from the actual render, not inference.

### 4.5 Live browser sweep

I served the production build and walked the real DOM, resolving each element's own token and then
compositing ancestor backgrounds up to the first opaque layer:

```
$ npx vite preview --port 5177   ->  http://localhost:5177/research-paper-feed/
```

```
mutedTokenHex:      "#666661"   mutedTokenComputed: "rgb(102, 102, 97)"

.hero p                            color rgb(102,102,97)  16px    bg rgb(250,249,246)
.controls__group legend            color rgb(102,102,97)  11.52px bg rgb(255,255,255)
.chip (inactive)                   color rgb(102,102,97)  13.28px bg rgb(241,240,235)
.controls__count                   color rgb(102,102,97)  14.4px  bg rgb(255,255,255)
.paper__meta / time / authors      color rgb(102,102,97)  13.28px bg rgb(255,255,255)
.paper__note                       color rgb(102,102,97)  13.12px bg rgb(255,255,255)
.tag (plain)                       color rgb(102,102,97)  11.52px bg rgb(241,240,235)
.site-footer p                     color rgb(102,102,97)  13.6px  bg rgb(250,249,246)
.paper__title a                    color rgb(28,28,26)    18.24px bg rgb(255,255,255)   <- --text, unchanged
```

Rendered state: 50 paper cards, "2812 papers match", real data. Console messages: **empty**.

A full-document text-node sweep attributed each muted background to a selector:

```
rgb(250,249,246) -> p (.hero p, .site-footer p)
rgb(255,255,255) -> .controls__count, .paper__authors, .paper__note, .save-menu__empty, legend, time
rgb(241,240,235) -> .chip, .tag
rgb(36,36,35)    -> .nav-link          <-- see below, PROBE BUG, NOT A REAL BACKGROUND
```

**On that fourth value — I chased it down and it is my own bug, not a page defect.** My first sweep
walked ancestor backgrounds and parsed `getComputedStyle().backgroundColor` with a naive
`/[\d.]+/g` regex. `.site-header:117` computes to `color(srgb 0.980392 0.976471 0.964706 / 0.86)` —
already normalised to 0..1 sRGB — and my regex read `0.980392` as a 0–255 channel value, yielding the
nonsense `rgb(36,36,35)`. Done correctly:

```
color(srgb 0.980392 0.976471 0.964706 / 0.86)
  x 255 -> rgb(250,249,246)   == --bg exactly
  composite over body --bg: 0.86*rgb(250,249,246) + 0.14*rgb(250,249,246) = rgb(250,249,246)
```

`color-mix(in srgb, var(--bg) 86%, transparent)` preserves `--bg`'s RGB triple and only sets alpha,
so compositing it over a `--bg` backdrop is an exact no-op. `.nav-link` sits on `--bg` and measures
**5.4825:1**. Corroborated by the pixel analysis in §4.4, where the nav-link glyph ink appears in the
`rgb(250,249,246)` bucket and no `rgb(36,36,35)` bucket exists at all. **Three mutually consistent
sources: no fourth background.**

---

## 5. Threshold justification — is 4.5:1 the right bar everywhere?

WCAG 1.4.3 allows 3:1 only for text that is at least 24px, or at least 18.66px **and bold**. Live
computed font sizes for every muted site, measured from the running app:

| rule | computed size | bold? | large text? | required |
|---|---|---|---|---|
| `.tag` (`:355`) | 11.52px | no | no | 4.5:1 |
| `.controls__group legend` (`:245`) | 11.52px | 700 | no | 4.5:1 |
| `.chip` (`:271`) | 13.28px | 600 | no | 4.5:1 |
| `.paper__meta` (`:330`) | 13.28px | no | no | 4.5:1 |
| `.paper__note` (`:377`) | 13.12px | no | no | 4.5:1 |
| `.controls__count` (`:289`) | 14.4px | no | no | 4.5:1 |
| `.collection__count` (`:670`) | 14.4px | no | no | 4.5:1 |
| `.site-footer p` (`:698`) | 13.6px | no | no | 4.5:1 |
| `.nav-link` (`:150`) | 14.4px | 600 | no | 4.5:1 |
| `.hero p` (`:193`) | 16px | no | no | 4.5:1 |

Independently, I flood-clustered the muted ink in `feed-desktop-1280.png` and measured the maximum
glyph-box height of any muted cluster: **12px**. Nothing is remotely near the 24px / 18.66px-bold
large-text thresholds. **4.5:1 was the correct bar for every single use**, and all of them pass.

---

## 6. Visual judgment — is this intentionally designed or merely compliant?

### 6.1 The change is genuinely rendered

Comparing the delivered screenshots against baseline, pixel for pixel:

| screenshot | baseline full-ink `rgb(122,122,115)` (old token) | IMP-012 full-ink `rgb(122,122,115)` | IMP-012 full-ink `rgb(102,102,97)` (new token) |
|---|---|---|---|
| `feed-desktop-1280.png` | 940 px | **0 px** | 935 px |
| `feed-mobile-390.png` | 999 px | **0 px** | 999 px |
| `collections-desktop-1280.png` | 339 px | **0 px** | 465 px |
| `collections-mobile-390.png` | 142 px | **0 px** | 465 px |

The old ink is **completely absent** from every after-shot and the new ink is present. The change is
really in the pixels, not just in the source.

The collections screenshots are not a clean A/B — baseline shows "Robotics reading (1)" with 1
paper, IMP-012 shows "Reading list (3)" with 3 papers, hence 10–12 % total pixel difference. The
implementer's report acknowledges this. Both still contain the new token and zero of the old, and the
live-DOM sweep in §4.5 covers the collections-only `.collection__count` and the `--bg`-backed
`.collection .paper` path directly.

### 6.2 Ink-mass measurement — did muted get too heavy?

Sum of per-pixel darkness (255 − luminance) over fixed regions of `feed-desktop-1280.png`:

| region | baseline | IMP-012 | change |
|---|---|---|---|
| **paper title (`--text`)** | 588271 | 588271 | **+0.0 %** |
| date line (muted on `--bg`) | 8265 | 9492 | +14.9 % |
| authors line (muted on `--bg`) | 26730 | 29819 | +11.5 % |
| tags row (muted on `--surface-muted`) | 2301 | 2645 | +14.9 % |
| CATEGORIES legend (muted on `--surface`) | 1868 | 2052 | +9.9 % |
| RECENCY legend (muted on `--surface`) | 1914 | 2086 | +9.0 % |
| hero subtitle (muted on `--bg`) | 11982 | 13432 | +12.1 % |
| "2812 papers match" (muted on `--surface`) | 5013 | 5571 | +11.1 % |
| active chips (`--accent-strong`) | 37235 | 37235 | **+0.0 %** |

This is the decisive measurement. **Primary text and accent text are bit-for-bit unchanged (+0.0 %).
Only muted text moved, by 9–15 %** — almost exactly the predicted gamma-space delta of moving the
foreground from rgb 122 to rgb 102 against a light backdrop ((250−102)/(250−122) = +15.6 %). The
change is surgical and confined to the intended token.

### 6.3 Looking at the images

I read all four IMP-012 screenshots, all four baselines, and generated 2x-upscaled stacked crops of
the first paper card and the filter/controls bar (baseline above, IMP-012 below) to judge the
relationship between title, metadata, and tags directly.

Judgement: **this looks intentionally designed, not merely compliant.**

- **Muted text is not too heavy.** The date, author line, and legend labels read clearly as secondary.
  In the 2x card crop the title remains unmistakably the dominant element and the metadata sits a
  full visual step below it. Nothing reads muddy, murky, or over-dark.
- **Hierarchy has not collapsed.** `--text` is byte-identical, so the title's dominance is exactly
  preserved. The 2.80x contrast relationship (§2.5) is a comfortable, legible gap.
- **The hue character is preserved.** `#7a7a73` and `#666661` share hue 60° and ~3 % saturation — both
  are warm neutrals in the same family. The new value reads as the same design system's secondary
  tone stepped up, not as a different colour dropped in. That is the hallmark of a deliberate choice.
- **In the controls bar**, the inactive chips ("7 days", "30 days") and the "CATEGORIES" / "RECENCY" /
  "SORT" legends are visibly more solid after, while the active chips ("cs.CV", "60 days", "Newest")
  in accent green are untouched. The active/inactive distinction is still legible.
- **At 390px** (`feed-mobile-390.png`) the design is coherent: the hero subtitle, card metadata, and
  tag pills all read cleanly without the tags competing with the titles. At 1280px
  (`feed-desktop-1280.png`) the same holds. The layout is unchanged — this is a pure colour-token
  edit, and the screenshots confirm no reflow.

`web/public/data/index.json` is present (2,812 papers, generated Oct 1, 2026), so **visual verification
is COMPLETE**, not degraded: every screenshot shows a populated feed with real paper cards, not an
empty or error state. My own live-DOM run reproduced 50 cards and "2812 papers match", matching the
screenshot state.

---

## 7. Gates

Run from `web/`:

```
$ npm run typecheck
> tsc --noEmit
(exit 0, no output)

$ npm test
> vitest run
 ✓ src/components/__tests__/PaperCard.test.tsx (4 tests)
 ✓ src/components/__tests__/SaveMenu.test.tsx (3 tests)
 ✓ src/components/__tests__/Toolbar.test.tsx (5 tests)
 ✓ src/lib/__tests__/collections.test.ts (48 tests)
 ✓ src/lib/__tests__/data.test.ts (5 tests)
 Test Files  5 passed (5)
      Tests  65 passed (65)
(exit 0)

$ npm run build
> tsc -b && vite build
✓ 65 tests  (pre-build gate)
dist/index.html                 0.44 kB │ gzip:  0.30 kB
dist/assets/index-G-YE6pVt.css 10.93 kB │ gzip:  2.86 kB
dist/assets/index-Ddl8vIcB.js 163.73 kB │ gzip: 52.63 kB
✓ built in 3.19s
(exit 0)
```

**65 tests across 5 files.** Baseline was 60; the concurrent IMP-151 agent added 5 to
`collections.test.ts` (43 -> 48). **This is expected, not a defect**, and IMP-151 is out of my scope.
The 60-test figure in `impl-IMP-012.md:339` was accurate at the time that agent ran.

### 7.1 Built CSS reflects the new token

```
$ grep -oE "\-\-text-muted:[^;]*" dist/assets/index-G-YE6pVt.css
--text-muted: #666661
--text-muted: #9b9b94

$ grep -c "7a7a73" dist/assets/index-G-YE6pVt.css
0
```

The light token is `#666661`, the dark override is `#9b9b94` (preserved), and the old `7a7a73` is
gone from the bundle entirely.

---

## 8. Defects found

All of these are defects in **`impl-IMP-012.md`**, the implementer's written report. None is a defect
in the shipped code.

### D1 (LOW) — wrong line number for the change, stated 3 times

`impl-IMP-012.md:4`, `:22`, `:229` all say the change is at `styles.css:18`. It is at
**`web/src/styles.css:9`**. Both `.improve/FEATURES.md:291` and `.improve/REPO_PROFILE.md:696`
correctly say line 9. **Actionable:** correct all three occurrences to `:9`.

### D2 (LOW) — theme block line ranges are stale

`impl-IMP-012.md:12-13` says "Light theme is `:root` (lines 6–33), dark theme is
`@media (prefers-color-scheme: dark)` (lines 35–68)". Actual: `:root` is lines **1–26**, the dark
block is lines **27–45**. **Actionable:** correct the ranges.

### D3 (LOW) — two stale token values and a phantom token in the §1 table

`impl-IMP-012.md:21,23,24` list dark `--text` as `#e8e8e4`, dark `--border` as `#2e343c`, and a
`--border-strong` token. Reality (`web/src/styles.css`):

- dark `--text` is **`#f1f1ee`** (`styles.css:33`)
- dark `--border` is **`#2c3036`** (`styles.css:32`)
- **`--border-strong` does not exist in this stylesheet**

The §1 table appears to have been transcribed from a stale revision. Related, §3's *parenthetical*
ancestor citations are also partly shifted, though its *rule* line column is correct for all 13 rows:

| cited | actual | rule cited | actual |
|---|---|---|---|
| `.controls` bg `:216` | `:197` | `.controls__count` `:288` | `:288` ✓ |
| `.paper` bg `:308` | `:298` | `.paper__meta` `:331` | `:331` ✓ |
| `.save-menu__body` `:510` | `:494` | `.tag` `:356` | `:356` ✓ |
| `.collection` `:640` | `:647` | `.empty` `:557` | `:557` ✓ |
| `.collection .paper` `:691` | `:692` | `.panel` `:569` | `:569` ✓ |
| `.site-header` `:129` | `:117` | `.nav-link` `:149` | `:149` ✓ |

**Actionable:** correct the two token values, drop the phantom `--border-strong` row, and fix the
six ancestor citations.

### D4 (MEDIUM) — fabricated build-output figures

`impl-IMP-012.md:338` reports "CSS 8.85 kB (gzip 2.56 kB), JS 382.45 kB (gzip 113.00 kB)" and asserts
"Same output sizes as the recorded baseline." The actual build on this tree is
**CSS 10.93 kB (gzip 2.86 kB), JS 163.73 kB (gzip 52.63 kB)**. Both of the report's numbers are wrong,
and the CSS figure matches neither the pre- nor the post-IMP-005/IMP-143 baseline recorded on the
board (10.93 kB). The "same as baseline" claim is therefore not supported by the numbers printed
next to it. **Actionable:** replace with the real build output. This is the most serious report
defect, because it is the one that would mislead a human reviewer skimming for evidence.

### D5 (INFO) — wrong font sizes in the threshold table

`impl-IMP-012.md:220,222` give `.hero p` as `1.05rem` = 16.8px and `.paper__meta` as 12.25px. Live
computed values: `.hero p` is **`1rem` = 16px** (`styles.css:193`) and `.paper__meta` is **13.28px**
(`0.83rem`). The report's `.controls__count` 13.12px and `.collection__count` 12.8px are also wrong
(both are 14.4px / 0.9rem). The conclusion is unaffected and in fact strengthened — the largest
muted size is 16px, still well under the 18.66px large-text threshold. **Actionable:** replace the
table with the computed values in §5 above.

### D6 (INFO, out of scope, pre-existing) — disabled chip

`styles.css:280-283` applies `opacity: 0.45` to `.chip:disabled`, which composites the muted colour
down to an effective ~1.9:1:

```
BEFORE #7a7a73 on --surface-muted @0.45 -> rgb(187,187,181)  effective 1.690:1
AFTER  #666661 on --surface-muted @0.45 -> rgb(178,178,173)  effective 1.866:1
```

WCAG 1.4.3 excludes text that is part of an inactive user interface component, so this is outside the
item's scope and outside its acceptance criteria. It is also **pre-existing and improved** by this
change (1.690 -> 1.866). Flagging only so it is on the record; the disabled "Relevance" chip is the
only instance in the running app. **No action required for IMP-012.**

---

## 9. Criteria scorecard

| # | criterion | verdict | evidence |
|---|---|---|---|
| 1 | Light `--text-muted` >= 4.5:1 on `--surface`, `--surface-muted`, `--bg` | **MET** | 5.7722 / 5.0586 / 5.4825 (§2.4) |
| 2 | Dark override unchanged and still >= 4.5:1 on all three dark surfaces | **MET** | 5.9101 / 5.4089 / 6.5631, `#9b9b94` untouched (§3) |
| 3 | Ratios computed by the standard sRGB relative-luminance method and recorded | **MET** | §2 of the report; reproduced exactly here (§2.2–2.4) |
| 4 | Before-state reconciles with `REPO_PROFILE.md` | **MET** | 4.3220 / 3.7877 / 4.1050 -> 4.32 / 3.79 / 4.11 (§2.3) |
| 5 | No muted text on an unverified background | **MET** | 13 static sites traced (§4.3); 1,092 pixel clusters all on the 3 known tokens (§4.4); live-DOM sweep (§4.5) |
| 6 | Only one theme block exists; dark mode genuinely left alone | **MET** | one `@media (prefers-color-scheme: dark)` at `:27-45`, no `.dark`/toggle (§3.1) |
| 7 | Build + preview + screenshot feed and collections at 1280; gates green; minimal diff | **MET** | 4 screenshots + baselines, real 2,812-paper data (§6.1); typecheck/test/build exit 0, 65 tests expected (§7); 1 line, no whitespace churn (§1) |

**7 / 7 met.**

Visual-quality gate (not a numbered acceptance criterion, but required by the verification brief):
**MET** — measured +0.0 % change on primary and accent text, +9–15 % on muted only, hue preserved,
hierarchy intact at 1280 and 390 (§6).

---

## 10. Conclusion

**PASS.** The source change is correct and complete. I independently recomputed every contrast ratio
from the stylesheet and reproduced the implementer's figures to four decimal places, reproduced the
recon before-state exactly, verified the dark-mode claim, proved exhaustiveness at the pixel level
across 1,092 rendered glyph clusters, confirmed the diff is a single line with zero whitespace
churn, and got all three gates green. The visual result reads as an intentional design decision, not
a compliance patch.

The one-line change is correct as written. The implementer's report needs the corrections in D1–D5
before it can be relied on as a record — most importantly D4, whose build-output figures are simply
wrong — but no source change is required.