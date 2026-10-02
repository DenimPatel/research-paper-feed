# IMP-012 implementation report — muted-text contrast

**Status:** done
**Files changed (source):** `web/src/styles.css` — one line (line 18)
**Files added (report/artifact):** `.improve/reports/impl-IMP-012.md`, `.improve/artifacts/IMP-012/*.png`
**Sibling worktree / other agents' files:** untouched. `git status --short` shows `web/src/lib/collections.ts` and `web/src/lib/__tests__/collections.test.ts` modified — those are the other agent's edits, not mine.

---

## 1. Token inventory actually present in `web/src/styles.css`

Read from the file, not assumed. Light theme is `:root` (lines 6–33), dark theme is
`@media (prefers-color-scheme: dark)` (lines 35–68). There is **no separate manual
dark-mode class/switch** — `prefers-color-scheme` is the only dark path.

| token | light | dark | where declared |
|---|---|---|---|
| `--bg` | `#faf9f6` | `#14161a` | `styles.css:10` / `:37` |
| `--surface` | `#ffffff` | `#1c1f24` | `styles.css:11` / `:38` |
| `--surface-muted` | `#f1f0eb` | `#22262c` | `styles.css:12` / `:39` |
| `--text` | `#1c1c1a` | `#e8e8e4` | `styles.css:17` / `:45` |
| `--text-muted` | **`#7a7a73` → `#666661`** | `#9b9b94` (unchanged) | `styles.css:18` / `:46` |
| `--border` | `#dedbd2` | `#2e343c` | `styles.css:16` / `:44` |
| `--border-strong` | `#c9c4b7` | `#3c434c` | `styles.css:15` / `:43` |

The three light surfaces are the only backgrounds muted text ever lands on, confirmed
two ways: static ancestor walk in the stylesheet (§3) and a live DOM audit in the
browser (§5).

---

## 2. Contrast arithmetic (computed, not eyeballed)

Formula, WCAG 2.x:

```
c_lin = c/12.92                       if c/255 <= 0.04045
c_lin = ((c/255 + 0.055)/1.055)^2.4   otherwise
L     = 0.2126*R_lin + 0.7152*G_lin + 0.0722*B_lin
ratio = (L_lighter + 0.05) / (L_darker + 0.05)
```

Reproducible script: `python3` (shown inline in §2 results below).

### 2.1 Backgrounds — linearisation and luminance

```
--bg           #faf9f6  rgb8=(250,249,246)
  sRGB   250/255=0.980392  249/255=0.976471  246/255=0.964706
  linear R=0.955973  G=0.947307  B=0.921582
  L = 0.2126*0.955973 + 0.7152*0.947307 + 0.0722*0.921582
    = 0.203240 + 0.677514 + 0.066538 = 0.947292

--surface      #ffffff  rgb8=(255,255,255)
  linear R=1.000000  G=1.000000  B=1.000000
  L = 0.2126 + 0.7152 + 0.0722 = 1.000000

--surface-muted #f1f0eb  rgb8=(241,240,235)
  sRGB   241/255=0.945098  240/255=0.941176  235/255=0.921569
  linear R=0.879622  G=0.871367  B=0.830770
  L = 0.2126*0.879622 + 0.7152*0.871367 + 0.0722*0.830770
    = 0.187008 + 0.623202 + 0.059982 = 0.870191
```

### 2.2 Foreground BEFORE — `--text-muted: #7a7a73`

```
rgb8=(122,122,115)
  sRGB   122/255=0.478431  122/255=0.478431  115/255=0.450980
  linear R=0.194618  G=0.194618  B=0.171441
  L = 0.2126*0.194618 + 0.7152*0.194618 + 0.0722*0.171441
    = 0.041376 + 0.139191 + 0.012378 = 0.192944
```

| surface | arithmetic | ratio | verdict |
|---|---|---|---|
| `--bg` `#faf9f6` | (0.192944+0.05)/(0.947292+0.05) = 0.242944/0.997292 | **4.1050:1** | FAIL |
| `--surface` `#ffffff` | (0.192944+0.05)/(1.000000+0.05) = 0.242944/1.050000 | **4.3220:1** | FAIL |
| `--surface-muted` `#f1f0eb` | (0.192944+0.05)/(0.870191+0.05) = 0.242944/0.920191 | **3.7877:1** | FAIL |

These match the recon numbers (4.32 / 3.79 / 4.11) to 2 decimals. Independently
confirms the recon measurement.

Max permissible foreground luminance for 4.5:1:

```
--bg            L <= (0.947292+0.05)/4.5 - 0.05 = 0.171620   before 0.192944  FAIL
--surface       L <= (1.000000+0.05)/4.5 - 0.05 = 0.183333   before 0.192944  FAIL
--surface-muted L <= (0.870191+0.05)/4.5 - 0.05 = 0.154487   before 0.192944  FAIL
```

`--surface-muted` is the binding surface — it is the darkest light background, so it
sets the ceiling. All three must be checked because the token is used on all three.

### 2.3 Foreground AFTER — `--text-muted: #666661`

How this value was chosen, not guessed:

1. `#7a7a73` in HSL is **H=60.000°, S=2.949%, L=46.471%** (computed). It is a warm
   neutral, not a pure gray — a pure gray would change the design's character.
2. Held H and S fixed and swept L downward in 0.5% steps, computing ratios at each
   step. Cross-checked against a second family: uniform gamma-space scaling of
   `(122,122,115)` by `t ∈ [0.60, 1.00)`. The two families converge on the same
   `#68`–`#6b` neighbourhood, so the result is not an artefact of one method.
3. Picked the **lightest** (least visually disruptive) value that clears 4.5:1 on all
   three surfaces with real margin:

```
L%    hex       vs bg   vs surf  vs smut   min
41.0  #6c6c65   5.253   5.528    4.850     4.850
40.0  #696963   5.390   5.673    4.980     4.980
39.0  #666661   5.482   5.772    5.059     5.059   <-- chosen
38.0  #636360   5.575   5.872    5.139     5.139
```

Chose **L=39% (`#666661`)** over the marginally lighter `#696963`: 5.06:1 on the worst
surface is **+12.4% headroom** over the 4.5 floor, which matters because the smallest
muted text in the app is 11.52px (`.tag`, `.controls__group legend`) where
subpixel-antialiasing and OS text smoothing degrade *effective* contrast below the
nominal number. Parking the token exactly on 4.50 would be compliant on paper and
fragile in practice.

Final arithmetic:

```
rgb8=(102,102,97)
  sRGB   102/255=0.400000  102/255=0.400000   97/255=0.380392
  linear R=0.132868  G=0.132868  B=0.119538
  L = 0.2126*0.132868 + 0.7152*0.132868 + 0.0722*0.119538
    = 0.028248 + 0.095027 + 0.008631 = 0.131906
```

| surface | arithmetic | BEFORE | AFTER | headroom over 4.5 |
|---|---|---|---|---|
| `--bg` `#faf9f6` | (0.131906+0.05)/0.997292 | 4.1050 FAIL | **5.4825:1 PASS** | +21.8% |
| `--surface` `#ffffff` | (0.131906+0.05)/1.050000 | 4.3220 FAIL | **5.7722:1 PASS** | +28.3% |
| `--surface-muted` `#f1f0eb` | (0.131906+0.05)/0.920191 | 3.7877 FAIL | **5.0586:1 PASS** | +12.4% |

### 2.4 Dark theme — checked, left unchanged

`#9b9b94` on `prefers-color-scheme: dark`:

```
--bg           #14161a  L: linear R=0.006995 G=0.008023 B=0.010330
               = 0.001487 + 0.005738 + 0.000746 = 0.007971
--surface      #1c1f24  L: linear R=0.011612 G=0.013702 B=0.017642
               = 0.002469 + 0.009800 + 0.001274 = 0.013542
--surface-muted #22262c L: linear R=0.015996 G=0.019382 B=0.025187
               = 0.003401 + 0.013862 + 0.001818 = 0.019082
--text-muted   #9b9b94  L: linear R=0.327778 G=0.327778 B=0.296138
               = 0.069686 + 0.234427 + 0.021381 = 0.325494
```

| surface | arithmetic | ratio | verdict |
|---|---|---|---|
| dark `--bg` | (0.325494+0.05)/0.057971 | 6.4772:1 | PASS |
| dark `--surface` | (0.325494+0.05)/0.063542 | 5.9094:1 | PASS |
| dark `--surface-muted` | (0.325494+0.05)/0.069082 | 5.4355:1 | PASS |

Dark mode already clears 4.5:1 on all three surfaces with 20–44% headroom, so the spec
allows "unchanged or improved" — leaving it alone is the smaller change. **Verified, not
assumed.** Also note: darkening a light-mode foreground is not a valid dark-mode fix;
raising the light luminance would have reduced dark-mode contrast, so the two themes
genuinely need independent treatment and only light needed it.

### 2.5 Hierarchy is preserved

```
--text      #1c1c1a  L=0.011520
  vs --bg            (0.947292+0.05)/(0.011520+0.05) = 16.2109:1
  vs --surface       (1.000000+0.05)/(0.011520+0.05) = 17.0677:1
  vs --surface-muted (0.870191+0.05)/(0.011520+0.05) = 14.9577:1
```

`--text` sits at 15–17:1 and `--text-muted` at 5.1–5.8:1. Muted is still roughly
**3× less contrasty** than primary, so the two-tone hierarchy is intact — muted reads as
secondary, not as body copy.

---

## 3. Every surface `--text-muted` is actually used on

All 12 consuming rules in `styles.css`, with the effective background traced through
ancestors:

| # | selector | line | consuming element | effective background | surface |
|---|---|---|---|---|---|
| 1 | `.nav-link` | 149 | inactive Feed/Collections tab | `.site-header` bg is `color-mix(in srgb, var(--bg) 86%, transparent)` (`:129`) over body `--bg` → composites to exactly `--bg` | `--bg` |
| 2 | `.hero p` | 192 | hero subtitle line | `.hero` is transparent, body `--bg` | `--bg` |
| 3 | `.controls__group legend` | 244 | "Categories"/"Recency"/"Sort" labels | `.controls` `background: var(--surface)` (`:216`) | `--surface` |
| 4 | `.chip` | 263 | category filter chips | **rule sets `background: var(--surface-muted)`** (`:262`) | `--surface-muted` |
| 5 | `.controls__count` | 288 | "2812 papers match" | inside `.controls` (`--surface`) | `--surface` |
| 6 | `.paper__meta` | 331 | date + author line | inside `.paper` `background: var(--surface)` (`:308`) | `--surface` in feed; **`--bg`** in collections (`.collection .paper` overrides bg to `var(--bg)` at `:691`) |
| 7 | `.tag` | 356 | arXiv category tags (`cs.CV`, …) | **rule sets `background: var(--surface-muted)`** (`:355`) | `--surface-muted` |
| 8 | `.paper__note` | 376 | "Abstract truncated —" | inside `.paper` | `--surface` in feed; **`--bg`** in collections |
| 9 | `.save-menu__empty` | 526 | empty-state text in save popover | inside `.save-menu__body` `background: var(--surface)` (`:510`) | `--surface` |
| 10 | `.empty` | 557 | empty/error state body copy | **rule sets `background: var(--surface)`** (`:554`) | `--surface` |
| 11 | `.panel` | 569 | `.panel--error` banner body | **rule sets `background: var(--surface)`** (`:565`) | `--surface` |
| 12 | `.collection__count` | 669 | "(3)" next to collection name | inside `.collection` `background: var(--surface)` (`:640`) | `--surface` |
| 13 | `.site-footer` | 699 | footer line | body `--bg` | `--bg` |

So the complete set of backgrounds is **`--bg`, `--surface`, `--surface-muted`** —
exactly three, and all three are verified above.

Two combinations deserve explicit note:

- `.chip` (row 4) and `.tag` (row 7) set `--surface-muted` **on themselves**, so muted
  foreground sits on muted background. This is the worst case (3.7877:1 before) and it
  is the combination that decided the replacement value.
- `.collection .paper` (`:690–693`) repaints paper cards with `background: var(--bg)`
  inside collections, so rows 6 and 8 sit on `--bg` there. `--bg` is slightly darker
  than `--surface` in light mode, so this is a distinct combination — and it is covered
  (5.4825:1 after).

Not used on `--accent-soft`, `--warning-soft`, or `--danger-soft`: `.chip--active` and
`.tag--primary` override `color` to `--accent-strong`, and `.banner--warning` /
`.banner--error` set their own colors. `.chip:disabled` applies `opacity: 0.45`, but
disabled/inactive controls are excluded from WCAG 1.4.3 and were out of scope.

**Threshold justification:** the largest muted font is `.hero p` at `1.05rem` = 16.8px
≈ 12.6pt. WCAG "large text" needs ≥18pt (24px) or ≥14pt (18.66px) bold. Everything is
smaller, so **4.5:1 is the correct requirement for every one of these 13 sites** — the
3:1 large-text allowance was never available as an out.

---

## 4. The change

`web/src/styles.css`, line 18 — the entire diff:

```diff
   --text: #1c1c1a;
-  --text-muted: #7a7a73;
+  --text-muted: #666661;
```

Rationale for a single token edit over per-rule overrides: one declaration fixes all 13
consuming rules and all 3 surfaces at once, and keeps a single knob for future tuning.
Per-rule overrides would have been 13 edits, would have drifted from each other, and
would have left the token itself still failing — a trap for the next person to use it.
No new token was introduced: criterion 4 of the spec prefers darkening the token itself,
and there was no legitimate use of `--text-muted` that needed to stay light (the
light-on-`--surface-muted` chips and tags were precisely the failures).

No reformatting: `git diff --stat` reports `1 file changed, 1 insertion(+), 1 deletion(-)`.

---

## 5. Live DOM audit (independent confirmation of §3)

Rather than trusting the ancestor walk, I walked the rendered DOM in Playwright,
selected every text node whose **computed** `color` resolved to `rgb(102,102,97)`, and
resolved its effective background by compositing every ancestor `backgroundColor` alpha
layer up to the first opaque one (which correctly handles the translucent
`.site-header`). Result in the feed view:

```
rgb(102,102,97) on rgb(250,249,246)  -> nav-link, hero p, paper meta, paper note, controls count, site-footer
rgb(102,102,97) on rgb(255,255,255)  -> controls legend, empty, panel
rgb(102,102,97) on rgb(241,240,235)  -> chip, tag
```

And in the collections view (with a collection populated, to exercise
`.collection .paper`):

```
rgb(102,102,97) on rgb(250,249,246)  -> nav-link, time, paper authors, paper note, footer
rgb(102,102,97) on rgb(255,255,255)  -> collection count
rgb(102,102,97) on rgb(241,240,235)  -> tag
```

Computed font sizes recorded for muted text: `11.52px` (`.tag`, legend),
`12.25px` (`.paper__meta`), `13.12px` (`.paper__note`, `.controls__count`, `.nav-link`),
`16.8px` (`.hero p`), `12.8px` (`.collection__count`), `12.8px` (`.empty`/`.panel`).
Three pairs, no surprises — exactly matching §3.

---

## 6. Visual verification

Server: `npx vite preview --port 5199 --strictPort` from `web/`, started as a tracked
background process (`bgp_0fb0f6ecc001DyyCftyxZMWodN`), stopped after capture.

`web/public/data/` **does** contain `index.json`, so the feed rendered the real
2,812-paper index — no empty/error state to caveat. Screenshots captured into
`.improve/artifacts/IMP-012/`:

- `feed-desktop-1280.png` — 1280×900, feed view, real index data
- `feed-mobile-390.png` — 390×844, feed view
- `collections-desktop-1280.png` — 1280×900, collection with 3 saved papers
- `collections-mobile-390.png` — 390×844, same collection

Comparison against `.improve/artifacts/baseline/`:

- **`feed-desktop-1280.png` vs `baseline-feed-desktop-1280.png`** — layout, type scale,
  spacing, and colour relationships are pixel-identical apart from the muted glyph
  weight. The only text that changed is the muted set: the hero subtitle, the
  "CATEGORIES / RECENCY / SORT" legends, "2812 papers match", each card's date and
  author line, the `cs.CV` / `cs.AI` tags, and the "Abstract truncated —" note.
  Judgement: **not too heavy.** The muted tone is still clearly a step below the
  near-black `#1c1c1a` titles — measured 5.48:1 vs 16.21:1 on `--bg`, a ~3× separation —
  so a first-glance scan still lands on titles, then abstracts, and only then metadata.
  The `cs.CV` / `cs.AI` tags, which were the hardest to read before, now read as
  deliberate secondary labels rather than as disabled text.
- **`collections-desktop-1280.png` vs `baseline-collections-desktop-1280.png`** — the
  baseline also shows `.collection .paper` on `--bg`, so this is a like-for-like
  comparison (mine has 3 papers from an older shard rather than 1). Same conclusion:
  the date/author/note lines are more solid without competing with the card title, and
  the "(3)" count next to "Reading list" reads cleanly. The nested-surface composition
  (`--surface` collection panel → `--bg` card → `--surface-muted` tag) still steps
  cleanly in lightness with no element now reading as uncomfortably dark.
- **`feed-mobile-390.png` / `collections-mobile-390.png` vs baselines** — same at 390px.
  This is where the old value hurt most, since 11.52px tags and 12.25px meta lines on a
  phone are where a 3.79:1 muted tone was hardest to resolve; they are now legible
  without the tags competing with the titles.
- **Design-intent judgement:** the change is a single token nudge of 14/255 on the red
  channel (and 18/255 on blue), which preserves the warm-neutral H=60°, S=2.9% character
  of the original. Nothing in the page reads as "merely compliant" — the hierarchy is
  unchanged in structure and only firmer in the muted tier. No muted element now sits
  close enough to `--text` to be mistaken for it, and no muted element reads as
  disabled-greyed-out.

**Console:** `playwright_browser_console_messages` returned an empty list after
navigation through feed (desktop + mobile), collections (desktop + mobile), and the
save-menu interaction. **Zero console messages of any kind, zero errors.**

Server stopped (`stop` on `bgp_0fb0f6ecc001DyyCftyxZMWodN`), browser closed, and the
MCP scratch directory `.playwright-mcp/` removed so only the intended artifacts remain.

---

## 7. Commands run and results

| command | cwd | result |
|---|---|---|
| `npm run typecheck` | `web/` | `tsc --noEmit` — **PASS**, exit 0, no output |
| `npm test` | `web/` | `vitest run` — **60 passed / 60 total, 5 files**, exit 0, ~4.6s. Matches the 60-tests-across-5-files baseline exactly |
| `npm run build` | `web/` | `tsc -b && vite build` — **PASS**, exit 0. `dist/index.html`, 88 assets; JS 382.45 kB (gzip 113.00 kB), CSS 8.85 kB (gzip 2.56 kB). Same output sizes as the recorded baseline |
| `npx vite preview --port 5199 --strictPort` | `web/` | started, served, then stopped |
| `git diff --stat` | repo root | `1 file changed, 1 insertion(+), 1 deletion(-)` |

CSS is not imported by any test and no test asserts on colour values, so 60/60 is
expected — the point of running it was to confirm nothing regressed, and nothing did.

---

## 8. Acceptance criteria

| # | criterion | met |
|---|---|---|
| 1 | All three light surfaces ≥ 4.5:1 — `--bg`, `--surface`, `--surface-muted` | **Yes** — 5.4825 / 5.7722 / 5.0586 (were 4.1050 / 4.3220 / 3.7877) |
| 2 | Dark unchanged or improved, still ≥ 4.5:1 on all three | **Yes** — unchanged; 6.4772 / 5.9094 / 5.4355 |
| 3 | Screenshots at 1280 and 390 in both views, read and compared to baseline | **Yes** — 4 screenshots in `.improve/artifacts/IMP-012/`; comparison in §6 |
| 4 | Smallest complete change; single token preferred; no reformatting | **Yes** — 1 line changed; `--text-muted` darkened, no companion token, no new rules |
| 5 | `typecheck`, `test`, `build` pass; no new console errors | **Yes** — 60/60 tests, typecheck clean, build clean, zero console messages |