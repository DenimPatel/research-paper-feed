# IMP-225 visual-regression harness

Everything here is a **tool for the verification apparatus**, not product code.
Nothing in `web/`, `tests/` or `scripts/` is read for anything but its build
output and its `public/data/`. All captures are written outside the repo by
default (`/tmp/imp225/`), because `.improve/artifacts/` is git-excluded and the
baselines that live there are what IMP-225 found to be untrustworthy.

Measurements and their derivation: `.improve/reports/impl-IMP-225.md`.

## Files

| File | What it is |
|---|---|
| `capture.cjs` | Playwright capture harness. Serves a `dist/` plus a *chosen* `data/` directory, walks one named view, writes one PNG per capture plus a `meta-<label>.json` sidecar recording browser version, headless/headed, deviceScaleFactor, timezone, locale, launch args, the `data/` directory, and the **SHA-256 of `index.json`**. |
| `pngdiff.py` | Dependency-free PNG reader + pixel diff. The reader and diff logic are verbatim from regression 7's `/tmp/sweep7/pngdiff.py`, so percentages are directly comparable to the 15.46 % in `.improve/reports/regression-7.md`. Adds `--profile`, `--colours`, `--tol`, `--scale`, `--json`. |
| `matrix.py` | N x N pairwise matrix over a directory of captures, or a list of named independent comparisons (`--pairs`). Prints min / median / max and the 0 px vs non-0 px split. |
| `aggregate.py` | Groups the corpus by environment and prints the within-environment and scroll-unpinned distributions. Groups are explicit label prefixes, so a glob cannot silently change the population. |
| `pngcrop.py` | Crop / tile / scale PNGs so a human can see *what* moved, not only how many pixels. |
| `check_features.py` | Integrity check for `.improve/FEATURES.md` (223 items, 223 unique ids, all 12 fields each). Written because the file was corrupted once by a `re.split(r'\n(?=### IMP-)')` + `"".join(...)` that consumed the newline. |
| `gen_fixture.py` | Generates the pinned fixture indices. Byte-deterministic: no clock, no RNG seed, no network. |
| `fixture/pinned/` | **The fixture to pin captures to.** 60 fully synthetic papers over 2 shards; **41.1 KB apparent, 52 KB by `du -sh`**, committable. |
| `fixture/thin/` | 5 papers, 12 KB by `du -sh` — the minimum that still renders a feed. |
| `.gitignore` | Excludes `node_modules` and `__pycache__/` from this directory. |

## Prerequisites

```bash
# playwright-core. Either installed here:
npm --prefix .improve/tools/imp225 i playwright-core
# or set PW_CORE to an existing install. The harness tries, in order:
#   $PW_CORE, ./node_modules/playwright-core, /tmp/sweep7/node_modules/playwright-core,
#   ~/Desktop/playwright-mcp/node_modules/playwright-core, then bare `playwright-core`.
# Browsers must already be in ~/Library/Caches/ms-playwright.
```

The `node_modules` symlink currently in this directory points at
`/Users/denimpatel/Desktop/playwright-mcp/node_modules`. It is git-ignored and a
fresh clone must create its own.

## Build

Never build into `web/dist`; build to `/tmp` so the repo stays untouched.

```bash
cd web && npx vite build --outDir /tmp/imp225/dist --emptyOutDir
```

`vite build` copies `web/public/` into the out dir, so `/tmp/imp225/dist/data/`
holds the live index. `--data` overrides which `data/` directory is served,
which is how the same `dist` is captured against different datasets.

## The normal procedure (what FEATURES.md now says)

```bash
cd <repo root>

# 1. capture, pinned dataset and pinned scroll
node .improve/tools/imp225/capture.cjs \
  --out .improve/artifacts/<IMP-ID>/ --label <IMP-ID> --n 1 \
  --headed --pin-scroll \
  --data .improve/tools/imp225/fixture/pinned \
  --view feed-desktop-1280

# 2. capture the second time, the same way, and compare
node .improve/tools/imp225/capture.cjs \
  --out /tmp/imp225/verify --label <IMP-ID>-b --n 1 \
  --headed --pin-scroll \
  --data .improve/tools/imp225/fixture/pinned \
  --view feed-desktop-1280
python3 .improve/tools/imp225/matrix.py --dir /tmp/imp225/verify --group '<IMP-ID>*'
```

## Views

`--view` accepts: `feed-desktop-1280`, `feed-mobile-390`,
`feed-empty-search-desktop-1280`, `feed-no-categories-selected-desktop-1280`,
`feed-focus-ring-desktop-1280`, `feed-savemenu-open-desktop-1280`,
`feed-savemenu-mobile-390`, `feed-loadmore-desktop-1280`,
`collections-desktop-1280`, `collections-mobile-390`,
`collections-empty-mobile-390`, `collections-import-error-desktop-1280`,
`collections-populated-desktop-1280`.

The two collections views that need pre-existing state take a `localStorage`
seed applied via `addInitScript` before first paint, because the stored
baselines for those states show a collection that no clean clone has.

## Flags

| Flag | Default | Notes |
|---|---|---|
| `--out DIR` | required | where PNGs and `meta-*.json` go |
| `--label NAME` | `run` | filename prefix and sidecar name |
| `--n N` | `1` | captures in this browser process |
| `--view NAME` | `feed-desktop-1280` | see above |
| `--data DIR` | `<dist>/data` | **the index to serve** |
| `--dist DIR` | `/tmp/imp225/dist` | built app |
| `--headed` | off | `headed` is the only mode the stored baseline is comparable in |
| `--pin-scroll` | off | `window.scrollTo(0,0)` + 120 ms before the shutter |
| `--dsf F` | `1` | deviceScaleFactor |
| `--tz` / `--locale` | `America/New_York` / `en-US` | matches regression 7 |
| `--arg A` | — | repeatable Chromium flag |
| `--settle MS` | `1200` | wait after driving the view |
| `--replay FILE` | — | re-run a previous run's exact environment |

`--replay` is how a *different machine* is asked to reproduce an existing
capture: it reads the `meta-*.json` and re-launches with the same recorded
browser version path, args, dsf, tz and locale, writing to a new `--out`.

## Measured facts this harness encodes

- **312 within-environment pairs** across 8 environments: 282 exactly 0 px,
  30 non-0, worst **330 px (0.0286 % at 1280x900)**. See `aggregate.py` output and
  `measurements-2026-10-03.txt`.
- **What the 8 environments vary, per all 42 retained `meta-*.json` sidecars**: `headless`
  vs `headed`, `deviceScaleFactor` (1, 1.5, 2) and view (`feed-desktop-1280`,
  `feed-mobile-390`). Browser build `149.0.7827.22`, timezone `America/New_York`, locale
  `en-US` and Chromium args `[]` were each a **single value across the whole corpus**.
- **headless vs headed on identical bytes: 15.4553 %.** Not interchangeable.
- **Scroll is not stable in headed mode unpinned**: measured `scrollY` of
  1130.5 and 14.0 on its own, giving 17.87 %-24.35 % against siblings.
  The harness records `scrollBefore`, `scrollAfter` and `scrollStable` per
  capture for exactly this reason.
- **The live index moves**: the 13 Oct-1 baselines render
  "2,812 papers ... index generated Oct 1, 2026"; the Oct-3 index renders
  14,253. Capture against `fixture/pinned` unless you specifically mean the
  live index, and always record `dataIndexSha256`.

## Regenerating the fixtures

```bash
python3 .improve/tools/imp225/gen_fixture.py --real /tmp/imp225/dist/data \
  --out .improve/tools/imp225/fixture pinned thin
# `pinned` and `thin` are fully synthetic and byte-identical on every machine.
# `mirror`, `shifted` and `asof-oct1` are derived from the live index and are
# therefore only reproducible while that index exists; write them to /tmp.
python3 .improve/tools/imp225/gen_fixture.py --real /tmp/imp225/dist/data \
  --out /tmp/imp225/fixture mirror shifted asof-oct1
```