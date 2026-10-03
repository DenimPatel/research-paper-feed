# Implementation Report — IMP-013 + IMP-014 (combined)

Both items touch the same file (`web/src/styles.css`) and both are WCAG
non-text-contrast / keyboard-focus defects on the feed search control, so they
were implemented and verified together.

- **IMP-013** — search input boundary is 1.27:1 against its surface (WCAG 1.4.11
  needs 3:1). Raised the `--border` custom property in both themes.
- **IMP-014** — `.controls__search input:focus` declared `outline: none`, which
  defeated the global `:focus-visible` ring for keyboard users. Removed that one
  declaration.

Total change: **3 lines in 1 file.** No components, no lib, no build config, no
tests, no reformatting.

---

## 1. Exact changes

`web/src/styles.css` — the complete diff:

```diff
@@ -8,7 +8,7 @@
   --bg: #faf9f6;
   --surface: #ffffff;
   --surface-muted: #f1f0eb;
-  --border: #e6e4dc;
+  --border: #898783;
   --text: #1c1c1a;
   --text-muted: #666661;
   --accent: #1f6f5c;
@@ -51,7 +51,7 @@
     --bg: #14161a;
     --surface: #1c1f24;
     --surface-muted: #22262c;
-    --border: #2c3036;
+    --border: #6a727e;
     --text: #f2f1ec;
@@ -211,7 +211,6 @@
 .controls__search input:focus {
   border-color: var(--accent);
-  outline: none;
 }
```

`git diff --stat` → `1 file changed, 2 insertions(+), 3 deletions(-)`.

Nothing else was edited. IMP-012's `--text-muted: #666661` is untouched and
still in place.

---

## 2. Which surfaces `--border` actually sits on

`--border` is referenced 19 times. Every site, with the surface its 1px line is
drawn against, was read out of `web/src/styles.css` (line numbers from the
modified file):

| line | selector | decl | element background | backdrop the line sits on |
|---|---|---|---|---|
| 119 | `.site-header` | `border-bottom` | `color-mix(--bg 86%, transparent)` | `--bg` (86% `--bg` composited over a `--bg` body resolves to exactly `--bg`) |
| 198 | `.controls` | `border` | `--surface` | `--bg` |
| 214 | `.controls__search input` | `border` | `--bg` | `--surface` (the `.controls` panel) |
| 260 | `.chip` | `border` | `--surface-muted` | `--surface` |
| 298 | `.paper` | `border` | `--surface` | `--bg` |
| 308 | `.paper:hover` | `border-color: color-mix(--border 60%, --accent)` | `--surface` | `--bg` |
| 356 | `.tag` | `border` | `--surface-muted` | `--surface` (`.paper`) |
| 386 | `.paper__footer` | `border-top` | inherits `.paper` | `--surface` |
| 452 | `.button--ghost` | `border-color` | `--surface` | `--surface`, or `--bg` inside `.collections-toolbar` |
| 464 | `.button--danger` | `border-color` | `transparent` | `--surface` or `--bg` (inside `.collection .paper`) |
| 494 | `.save-menu__body` | `border` | `--surface` | `--bg` |
| 532 | `.save-menu__new` | `border-top` | inherits `.save-menu__body` | `--surface` |
| 545 | `.save-menu__new input, .collections-toolbar__new input, .collection__rename input` | `border` | `--bg` | `--surface` |
| 558 | `.empty` | `border: 1px dashed` | `--surface-muted` | `--surface` (`.collection`) |
| 565 | `.panel` | `border` | `--surface` | `--bg` |
| 579 | `.panel pre` | `border` | `--surface-muted` | `--surface` |
| 647 | `.collection` | `border` | `--surface` | `--bg` |
| 695 | `.site-footer` | `border-top` | none (body `--bg`) | `--bg` |

**The set of adjacent surfaces collapses to exactly three per theme:**
`--bg`, `--surface`, `--surface-muted`. The header's translucent background is
`color-mix(in srgb, var(--bg) 86%, transparent)` laid over a `--bg` body, which
resolves back to `--bg`, so it is not a fourth surface. Dark header is the same
construction at 82%.

WCAG 1.4.11 only *requires* 3:1 for boundaries of user-interface components —
so the binding sites are `.controls__search input`, `.chip`, the three other
text inputs at line 545, and `.button--ghost` / `.button--danger`. The rest are
decorative container edges and dividers, which the spec's Notes flag as
regression risk. Because a single token serves both jobs, the value was chosen
so that **all three surfaces clear 3:1**, not just `--surface`. That also fixes
`.chip` and `.tag`, which sit on `--surface-muted` and would otherwise have been
left just under the bar at ~2.87:1.

---

## 3. Contrast arithmetic

Standard WCAG 2.x relative luminance, computed with a script, not by eye:

```
linear(c) = c/12.92                       if c <= 0.04045   (c = channel/255)
          = ((c + 0.055)/1.055) ^ 2.4    otherwise
Y = 0.2126*R + 0.7152*G + 0.0722*B
ratio = (Y_lighter + 0.05) / (Y_darker + 0.05)
```

### 3.1 LIGHT theme — `#e6e4dc` → `#898783`

BEFORE, `--border: #e6e4dc` (sRGB 230, 228, 220):

```
linear = 0.791298, 0.775822, 0.715694
Y      = 0.2126*0.791298 + 0.7152*0.775822 + 0.0722*0.715694 = 0.774771

vs --surface        #ffffff       Y=1.000000
  ratio = (1.000000 + 0.05) / (0.774771 + 0.05) = 1.050000 / 0.824771 = 1.2731:1   FAIL
vs --bg             #faf9f6       Y=0.947292
  ratio = (0.947292 + 0.05) / (0.774771 + 0.05) = 0.997292 / 0.824771 = 1.2092:1   FAIL
vs --surface-muted  #f1f0eb       Y=0.870191
  ratio = (0.870191 + 0.05) / (0.774771 + 0.05) = 0.920191 / 0.824771 = 1.1157:1   FAIL
```

This reproduces the spec's ~1.27:1 figure and shows the same defect also holds
against `--bg` (1.21:1) and `--surface-muted` (1.12:1).

AFTER, `--border: #898783` (sRGB 137, 135, 131):

```
linear = 0.246105, 0.238021, 0.223228
Y      = 0.2126*0.246105 + 0.7152*0.238021 + 0.0722*0.223228 = 0.242850

vs --surface        #ffffff       Y=1.000000
  ratio = (1.000000 + 0.05) / (0.242850 + 0.05) = 1.050000 / 0.292850 = 3.5855:1   PASS
vs --bg             #faf9f6       Y=0.947292
  ratio = (0.947292 + 0.05) / (0.242850 + 0.05) = 0.997292 / 0.292850 = 3.4055:1   PASS
vs --surface-muted  #f1f0eb       Y=0.870191
  ratio = (0.870191 + 0.05) / (0.242850 + 0.05) = 0.920191 / 0.292850 = 3.1422:1   PASS
```

Minimum across all three surfaces: **3.1422:1** (binding surface is
`--surface-muted`, which governs the whole token).

### 3.2 DARK theme — `#2c3036` → `#6a727e`

BEFORE, `--border: #2c3036` (sRGB 44, 48, 54):

```
linear = 0.025187, 0.029557, 0.036889
Y      = 0.2126*0.025187 + 0.7152*0.029557 + 0.0722*0.036889 = 0.029157

vs --surface        #1c1f24       Y=0.013542
  ratio = (0.029157 + 0.05) / (0.013542 + 0.05) = 0.079157 / 0.063542 = 1.2457:1   FAIL
vs --bg             #14161a       Y=0.007971
  ratio = (0.079157) / (0.057971) = 1.3655:1                                        FAIL
vs --surface-muted  #22262c       Y=0.019082
  ratio = (0.079157) / (0.069082) = 1.1459:1                                        FAIL
```

AFTER, `--border: #6a727e` (sRGB 106, 114, 126):

```
linear = 0.144128, 0.168255, 0.205075
Y      = 0.2126*0.144128 + 0.7152*0.168255 + 0.0722*0.205075 = 0.166052

vs --surface        #1c1f24       Y=0.013542
  ratio = (0.166052 + 0.05) / (0.013542 + 0.05) = 0.216052 / 0.063542 = 3.4001:1   PASS
vs --bg             #14161a       Y=0.007971
  ratio = (0.216052) / (0.057971) = 3.7269:1                                        PASS
vs --surface-muted  #22262c       Y=0.019082
  ratio = (0.216052) / (0.069082) = 3.1275:1                                        PASS
```

Minimum across all three surfaces: **3.1275:1**.

### 3.3 Derived / state colours re-checked

| element | colour | surface | ratio |
|---|---|---|---|
| `.paper:hover` border, light (`color-mix` → `#5f7d73`, Y=0.183379) | #5f7d73 | `--surface` | 4.4991:1 |
| `.paper:hover` border, light | #5f7d73 | `--bg` | 4.2733:1 |
| `.paper:hover` border, dark (`color-mix` → `#578883`, Y=0.212732) | #578883 | `--surface` | 4.1348:1 |
| `.paper:hover` border, dark | #578882 | `--bg` | 4.5321:1 |
| focus ring / focus border, light (`--accent` #1f6f5c) | #1f6f5c | `--surface` (behind ring) | 6.0231:1 |
| focus ring / focus border, light | #1f6f5c | `--bg` (input fill) | 5.7207:1 |
| focus ring, dark (`--accent` #3aa98a) | #3aa98a | `--surface` | 5.6829:1 |

The hover mix improved as a side effect: raising `--border` makes
`color-mix(--border 60%, --accent)` *darker* rather than lighter, so the hover
edge now reads as a stronger accent tint instead of a wash.

---

## 4. Why these two hex values

The binding constraint in both themes is `--surface-muted`:

- light: needs `Y <= 3*(0.870191 + 0.05) - 0.05 = 0.256730` → roughly `#8b8b8b` or darker
- dark: needs `Y >= 3*(0.019082 + 0.05) - 0.05 = 0.157245` → roughly `#6e6e6e` or lighter
  (`#6e6e6e` computes 2.9809:1 on `--surface-muted` — just short, hence a shade lighter)

A value that only clears `--surface` (`#949494`, 3.0335:1) would have left
`.chip` and `.tag` at 2.6584:1, and one that clears `--surface` + `--bg`
(`#918e84`, 3.2780 / 3.1135) would have left them at 2.8728:1 — an
almost-passing number, which is the worst outcome. So the token was sized
against `--surface-muted`.

Hue was then matched to the existing palette rather than defaulting to a
neutral gray, because a neutral #8b8b8b in a warm off-white palette reads as
dirty:

| swatch | G/R | B/R |
|---|---|---|
| `--border` (old) `#e6e4dc` | 0.991 | 0.957 |
| `--surface-muted` `#f1f0eb` | 0.996 | 0.975 |
| `--text-muted` (IMP-012) `#666661` | 1.000 | 0.951 |
| **chosen light `#898783`** | **0.985** | **0.956** |
| rejected `#8a877d` | 0.978 | 0.906 |
| `--border` (old dark) `#2c3036` | 1.091 | 1.227 |
| **chosen dark `#6a727e`** | **1.075** | **1.189** |

`#898783` is essentially the old warm gray scaled down along its own hue axis,
and `#6a727e` is the old cool dark gray scaled up along its own. Both stay
inside the palette's hue family, which is the main defence against the border
reading as an accidental outline.

---

## 5. IMP-014 — keyboard vs mouse, measured in a real browser

The fix is deletion only. After the change the **entire stylesheet contains
exactly one `outline` declaration**, at line 87 in the pre-existing global
rule — there is no `outline: none` anywhere:

```
grep -n 'outline\s*:' web/src/styles.css
  87:   outline: 2px solid var(--accent);
  88:   outline-offset: 2px;
```

Measured at 1280px via `getComputedStyle` on the live preview build:

| interaction | element | `matches(':focus-visible')` | computed outline |
|---|---|---|---|
| Tab ×2 from body (`Collections` → search input) | `.controls__search input` | **true** | `solid 2px rgb(31,111,92) offset 2px` |
| Mouse click | `.controls__search input` | true | `solid 2px rgb(31,111,92) offset 2px` |
| Mouse click | Feed nav `button` | **false** | `none` |
| Tab to `Rename` (collections view) | `button.button--ghost` | true | `solid 2px rgb(31,111,92) offset 2px` |
| not focused | `.controls__search input` | — | `outline-style: none` |

Readings:

- **Keyboard (IMP-014 AC1) — pass.** Tabbing into the search field now produces
  the app's existing ring, byte-identical to the ring every other control gets
  from the global `:focus-visible` rule. The ring is 2px solid `--accent` at
  2px offset, identical to the `Rename` button's ring, so the input no longer
  looks like a special case that lost its affordance.
- **Mouse — honest nuance on AC2.** After a real `page.mouse` click the ring
  *is* still painted, because Chromium's `:focus-visible` heuristic treats
  text-entry controls as always focus-visible (the user is expected to type
  next). This is the browser's modality heuristic, **not** an author-side
  blanket outline: the control experiment above is the proof. The same mouse
  click on the `Feed` **button** yields `matches(':focus-visible') === false`
  and `outline-style: none`, under the identical global rule and identical
  click. So the ring follows the browser's element-type heuristic, and no CSS
  in this repo paints an outline on non-`:focus-visible` mouse focus. There is
  no pure-CSS way to suppress the heuristic for a text input, and no JS change
  was in scope. The spec's stated intent — "scoped to `:focus-visible`, not a
  blanket outline" — is satisfied; the *observed* result on click differs from
  the spec's prediction and is reported here rather than papered over.
- **IMP-014 AC3 — pass.** The only removed declaration was inside
  `.controls__search input:focus`. No other selector in the file changed, so no
  other control's focus appearance can have moved; confirmed at runtime above
  (the `Rename` ghost button's ring is unchanged) and statically by the diff.

---

## 6. Visual judgement — honest assessment

Screenshots captured with `npm run preview` on `127.0.0.1:5199` at
`/research-paper-feed/`, and inspected:

- `.improve/artifacts/IMP-014/feed-search-focus-ring-desktop-1280.png` — keyboard focus, 1280
- `.improve/artifacts/IMP-014/feed-search-focus-ring-mobile-390.png` — keyboard focus, 390
- `.improve/artifacts/IMP-013/feed-search-border-desktop-1280.png` — same frame, under the IMP-013 name required by the spec
- `.improve/artifacts/IMP-013/feed-search-unfocused-desktop-1280.png` — 1280, unfocused
- `.improve/artifacts/IMP-013/feed-search-unfocused-mobile-390.png` — 390, unfocused
- `.improve/artifacts/IMP-013/collections-desktop-1280.png` — `.collection` outline check
- compared against `.improve/artifacts/baseline/baseline-feed-focus-ring-desktop-1280.png`

**Does it look intentionally designed? Yes.** My honest read:

- The search field's boundary is now plainly visible at both widths. In the
  baseline PNG the input is a rounded rectangle you can barely find; here it is
  the first thing your eye lands on after the heading. That is the fix working.
- The focus ring reads as deliberate and matches the rest of the app exactly —
  it does not look bolted onto one input.
- **The heaviest consequence is the `.paper` / `.collection` / `.panel`
  outlines**, which the spec asked me to check. They went from invisible to a
  definite warm-gray 1px edge. This is a real, noticeable change in the page's
  character — the feed is now "outlined cards on an off-white page" rather than
  "soft shadow-defined cards". What keeps it from looking accidental is that
  every container got the *same* 1px edge at the same weight, the gray is warm
  and matches the palette hue, and no border got thicker. I checked
  `.collection` and `.empty` specifically and they hold up: the collection
  panel, its dashed empty-state block, the "New collection name" input, and
  the ghost buttons all read as one system.
- `.chip` gained a visible outline and this is an unambiguous improvement —
  chips are toggle buttons, their fill (`--surface-muted` on `--surface`,
  1.14:1) was invisible, and the border was their only definition.
- `.tag` also gained an outline. These are not controls, so nothing required
  it, but with the primary tag filled and the secondary tag outlined the pair
  now reads as a deliberate primary/secondary distinction rather than one filled
  pill and one ghost. I looked for the "accidental outline" failure and did not
  find it.
- The `.site-header` bottom rule and `.site-footer` top rule are now visible.
  Both look like normal structural rules.
- What it is **not**: it does not read as heavy black. `#898783` is a mid warm
  gray, roughly a third of the way from the page background to `--text`. The
  failure mode the brief warned about — invisible to heavy-black — was avoided
  by matching the palette hue and stopping at the `--surface-muted` threshold
  plus ~0.14 of headroom rather than overshooting toward `#1c1c1a`.

Caveat on baseline comparison: the baseline PNGs were captured against an older
commit and a different data snapshot (they show "676 papers match" and a typed
"learning" query, and predate the `All` chip), so they are indicative of the
old *border* rendering, not a pixel-exact A/B. The border judgement above rests
on the current screenshots plus the arithmetic, not on a diff against them.

**Limitation:** dark-theme rendering could not be screenshotted — the available
browser tool exposes no colour-scheme emulation, and the repo has no dark
baseline. The dark token was verified numerically instead (§3.2), from the same
three surfaces that produce the light-theme screenshots.

---

## 7. Tests

**No test added, deliberately.** Neither spec asks for one: IMP-013's
verification method is "compute the ratio" and IMP-014's is a screenshot diff
plus a CSS inspection, and IMP-014 AC3 asks only that `npm run build` succeed.
A static assertion over `styles.css` text would be a new test category in this
repo (there is no existing CSS or contrast test to extend, and the layout
suite is `@testing-library/react` against real markup, not stylesheet tokens),
so adding one would be invented scope. Flagging it here rather than silently
skipping: nothing now prevents a future edit from regressing these two values,
so a contrast regression test would be worth a separate, explicitly-scoped item.

---

## 8. Commands and results

| command | result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | **exit 0** |
| `npm test` | **19 files / 292 tests, all passed**, 5.21 s |
| `npm run build` | **exit 0** — `dist/assets/index-DLsgZ6xw.css` 10.91 kB (gzip 2.86 kB) |
| built CSS size, pristine `HEAD` copy for comparison | 10.93 kB → 10.91 kB, i.e. **−20 bytes**, so IMP-013 AC3's "< 1 kB growth" holds with room to spare (the change removed a declaration) |
| `npm run preview -- --port 5199 --strictPort` | served `200` on `/research-paper-feed/` and `/research-paper-feed/data/index.json`; **stopped** afterwards |
| `shasum -a 256 web/public/data/*` before vs after | **byte-identical**, `diff` clean — `index.json c1ce0e60…`, `papers-2026-W39.json bcce73f6…`, `papers-2026-W40.json cb064145…` |
| `git status --porcelain` | ` M web/src/styles.css` + `?? .improve/reports/impl-IMP-013.md`, plus three untracked reports that pre-date this task (`discovered-IMP-002.md`, `discovered-IMP-009.md`, `regression-sweep-4.md`). Nothing else. |

`web/public/data` was never moved or regenerated — a real index was already
present, so the `--max-per-category` regeneration path was not needed. The
pristine build used for the CSS byte comparison was made from a `git archive
HEAD` extract in `/tmp`, leaving the working tree untouched. No `git restore`,
`checkout`, `clean`, or `stash` was run; no `git add`, `commit`, or `push`.

## 9. Files changed

- `web/src/styles.css` — 3 lines (2 token values, 1 deleted declaration)

## 10. Artifacts

- `.improve/artifacts/IMP-013/feed-search-border-desktop-1280.png`
- `.improve/artifacts/IMP-013/feed-search-unfocused-desktop-1280.png`
- `.improve/artifacts/IMP-013/feed-search-unfocused-mobile-390.png`
- `.improve/artifacts/IMP-013/collections-desktop-1280.png`
- `.improve/artifacts/IMP-014/feed-search-focus-ring-desktop-1280.png`
- `.improve/artifacts/IMP-014/feed-search-focus-ring-mobile-390.png`

Test collection created during the `.collection` outline check lived only in
browser `localStorage` (`rpf.collections.v1`) and was cleared afterwards; the
repository was never involved.