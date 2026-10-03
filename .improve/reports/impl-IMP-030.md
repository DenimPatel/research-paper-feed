# IMP-030 — Replace the stale README hero screenshot

Implementation report. Bug inventory rows **PE-16** and **INF-17** (`.improve/REPO_PROFILE.md`
§7 and §9, "CI / docs / repo hygiene"), both naming `readme.md:11` and `images/feed_example.png`.
No prior `.improve/reports/verify-IMP-030.md` exists, so this was a first attempt, not a retry.

## Outcome

`images/feed_example.png` is now a real Playwright screenshot of the current React feed at a
1280px viewport, captured against a freshly built, complete arXiv index, and it is **112,406
bytes** (109.8 KiB) — under the 300 KB ceiling **without any conversion, quantisation, or
re-compression**, so `readme.md:11` keeps its existing `![Example feed](images/feed_example.png)`
reference unchanged. `readme.md` was **not modified at all**: `git diff -- readme.md` is empty,
so the live-site link at line 9 and the feature bullets at lines 13–31 are byte-identical to
HEAD.

## Files changed

| File | Change | Bytes |
| --- | --- | --- |
| `images/feed_example.png` | Replaced the 2023 legacy-CLI screenshot with the new React-feed capture. `git diff --stat` reports `Bin 465201 -> 112406 bytes`. | 112,406 (was 465,201) |
| `.improve/artifacts/IMP-030/feed-desktop-1280.png` | New — the identical capture, kept for comparison against `.improve/artifacts/baseline/baseline-feed-desktop-1280.png` (gitignored via `.git/info/exclude`). | 112,406 |
| `.improve/reports/impl-IMP-030.md` | New — this report. | — |
| `.improve/reports/discovered-IMP-030.md` | New — three out-of-scope observations (D-1…D-3), none fixed. | — |

The two PNGs are byte-identical, verified by hash:

```
$ shasum -a 256 images/feed_example.png .improve/artifacts/IMP-030/feed-desktop-1280.png
edac0be13717e41f674d773396b04aaf7e4cf66ab18678d2499019ecda5fc5ec  images/feed_example.png
edac0be13717e41f674d773396b04aaf7e4cf66ab18678d2499019ecda5fc5ec  .improve/artifacts/IMP-030/feed-desktop-1280.png
```

`git status --porcelain` at the end of the work:

```
 M .github/workflows/deploy.yml
 M images/feed_example.png
?? .improve/reports/impl-IMP-030.md
?? .improve/reports/discovered-IMP-030.md
```

`.github/workflows/deploy.yml` is **not mine** — it was clean at the start of this session and
was modified while I worked by a concurrent agent (`.improve/reports/impl-IMP-041.md` appeared
in the same window). I did not read or edit it.

## The index build (real data, three attempts)

`web/public/data/` is gitignored and already held an index built by an earlier agent on
2026-10-02 (2,812 papers, 2 shards, `generatedAt 2026-10-02T02:44:04Z`). Per the spec I rebuilt
from arXiv rather than trusting it. I first copied the existing index to `/tmp/rpf-data-backup`
(kept there, outside the repo) so a failed rebuild could not destroy someone else's real data.

Attempt 0 — network reachability smoke test:

```
$ /usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 \
      --out-dir /tmp/rpf-netcheck
INFO:root:  cs.CV hit the 5-result cap; older papers in the window may be missing
INFO:root:  5 papers within retention window for cs.CV
INFO:root:Wrote 5 papers across 1 shards to /tmp/rpf-netcheck
EXIT=0
```

Attempt 1 — the production build (all 5 default categories, default 60-day retention, no cap),
exactly what `deploy.yml` runs:

```
$ /usr/local/bin/python3.11 scripts/build_index.py
INFO:root:  6673 papers within retention window for cs.CV
INFO:root:  9646 papers within retention window for cs.LG
INFO:root:  5154 papers within retention window for cs.CL
INFO:root:ArXiv search failed for 'cat:cs.AI': Page request resulted in HTTP 500
  (…&search_query=cat%3Acs.AI&…&start=10000&max_results=1000)      [6 attempts, try 0…5]
ERROR:root:  query failed for cs.AI: Page request resulted in HTTP 500 (…)
INFO:root:  3245 papers within retention window for cs.RO
ERROR:root:Wrote an index missing 1 of 5 categories; index.json records them under 'failedCategories': cs.AI
INFO:root:Wrote 25761 papers across 9 shards to web/public/data
```

That index is **partial**: `failedCategories: ["cs.AI"]`. Under IMP-204's contract the site
renders an "index is incomplete" notice and drops the `cs.AI` chip — so this capture would
have shipped a failure state as the project's hero image. Discarded. Attempt 2 (identical
command) reproduced the same `cs.AI` failure at the same `start=10000` offset, so this is a
reproducible arXiv-side 500, not a one-off (recorded as D-1; it is the live reproduction of
PY-17 / IMP-204, which are already tracked — I did not re-open them).

Attempt 3 — the build that produced the shipped capture, using a documented, supported flag so
that no category needs the failing deep offset:

```
$ /usr/local/bin/python3.11 scripts/build_index.py --retention-days 30
INFO:root:  3412 papers within retention window for cs.CV
INFO:root:  5434 papers within retention window for cs.LG
INFO:root:  2653 papers within retention window for cs.CL
INFO:root:  5710 papers within retention window for cs.AI
INFO:root:  2131 papers within retention window for cs.RO
INFO:root:Wrote 14253 papers across 5 shards to web/public/data
```

The resulting manifest (read with `python3`, `web/public/data/index.json`):

```
generatedAt 2026-10-03T10:02:17Z  retention 30  total 14253
categories ['cs.CV', 'cs.LG', 'cs.CL', 'cs.AI', 'cs.RO']
failedCategories None   truncatedCategories None
shards [('2026-W40','2026-09-28','2026-10-01',3775,'papers-2026-W40.json'),
        ('2026-W39','2026-09-21','2026-09-27',3739,'papers-2026-W39.json'),
        ('2026-W38','2026-09-14','2026-09-20',2948,'papers-2026-W38.json'),
        ('2026-W37','2026-09-07','2026-09-13',2616,'papers-2026-W37.json'),
        ('2026-W36','2026-09-03','2026-09-06',1175,'papers-2026-W36.json')]
```

**Complete**: all five categories, no `failedCategories`, no `truncatedCategories`, 14,253 real
papers with real arXiv ids, authors, abstracts and `arxiv.org` links.

## Serving and capture

```
$ cd web && npm run dev -- --port 5199 --strictPort        # Vite dev server, tracked process

$ curl -s -o /dev/null -w "bare:%{http_code}\n" http://localhost:5199/
bare:302
$ curl -s -o /dev/null -w "base:%{http_code}\n" http://localhost:5199/research-paper-feed/
base:200
$ curl -s -o /dev/null -w "index:%{http_code}\n" http://localhost:5199/research-paper-feed/data/index.json
index:200
```

**URL captured: `http://localhost:5199/research-paper-feed/`** — the Pages base path, as the
spec and profile §4.2 both state. The bare origin `http://localhost:5199/` returns 302 (Vite
redirects to the base path here) and is not the canonical URL to record.

Capture: Playwright viewport set to **1280 × 900**, `devicePixelRatio` 1, page scrolled to
`scrollY = 0`, `document.scrollHeight` 21087 (so this is the viewport, not a full-page capture —
matching the baseline's own 1280 × 900 frame). I waited for the shards to finish loading
(the first snapshot showed `0 papers match` / `Loading papers from 0 weeks…`, the WEB-48 lying
loading state) and only captured once the feed showed real cards. Screenshot saved as PNG with
`scale: "css"`.

Console at capture time — 3 messages, no `console.error`, matching the profile's documented
dev-server baseline exactly:

```
[DEBUG] [vite] connecting...
[INFO]  %cDownload the React DevTools for a better development experience: …
[DEBUG] [vite] connected.
```

Network: **29 requests, every one `200`** — the app shell, all 19 source modules, all 5 shard
files, `data/index.json`, and the two Google Fonts requests. No failed request, no 404.

## Visual verification (the acceptance criterion that matters)

I read `images/feed_example.png` back with the Read tool and compared it against
`.improve/artifacts/baseline/baseline-feed-desktop-1280.png`. The shipped file shows the
current React feed: sticky header with the `Feed`/`Collections` tabs, the `Recent arXiv papers
in CS & AI` h1, the hero line `14,253 papers from cs.CV, cs.LG, cs.CL, cs.AI, cs.RO · index
generated Oct 3, 2026`, the filter panel (search field, category chips, recency chips, sort
chips, `14253 papers match`), and a real paper card — title linking to `arxiv.org/abs/
2610.00848v1`, `Sep 30, 2026`, six authors, `cs.CV`/`cs.AI` chips, a truncated abstract,
`Show more`, `Abstract truncated — view the full text on arXiv.`, `arXiv`/`PDF` links and
`Save to collection`.

It is **not** an error, loading, empty, or 404 state: no "No paper index yet" panel, no
incomplete-index notice, no `role="alert"`, no retry button, no "No papers are available…".

Two deliberate differences from the baseline frame, both current-code behaviour rather than
capture defects:

- The baseline shows three control groups on one row; the current build wraps **Sort** onto a
  second row because the `All` category chip (IMP-010) made that group one chip wider. See D-2.
- The baseline's hero count is `2,812 papers`; ours is `14,253 papers`, because the index was
  rebuilt from today's arXiv.

## Format and size decision

**Approach used: straight, unoptimised PNG — no compression tool, no WebP, no palette reduction.**

| | bytes |
| --- | --- |
| old `images/feed_example.png` | 465,201 (454.3 KiB) |
| new `images/feed_example.png` | **112,406 (109.8 KiB)** |
| ceiling from the spec | 300 KB |

`readme.md` was left completely untouched, so this keeps the GitHub-rendered hero on the same
`images/feed_example.png` path with no new format to support and no CDN/`<picture>` concern.
A straight Playwright PNG already came in at 37.5 % of the old file's size and 37 % of the
ceiling, so introducing `cwebp`/`pngquant` (neither of which is a repo dependency; `optipng`,
`pngquant`, `magick` and `convert` are not installed on this machine) would have been a change
with a maintenance cost and no benefit. Measured properties of the shipped file:

```
$ /usr/local/bin/python3.11 -c "from PIL import Image; …"
images/feed_example.png   PNG (1280, 900) RGB
.improve/artifacts/IMP-030/feed-desktop-1280.png   PNG (1280, 900) RGB
```

If a future item wants it smaller, `cwebp` is installed at `/opt/homebrew/bin/cwebp`; I did not
use it because the size criterion was already met without it.

## Commands run, with results

| Command (dir) | Result |
| --- | --- |
| `/usr/local/bin/python3.11 scripts/build_index.py --category cs.CV --max-per-category 5 --out-dir /tmp/rpf-netcheck` (root) | exit 0, 5 papers, 1 shard |
| `/usr/local/bin/python3.11 scripts/build_index.py` (root) | exit 0, **25,761 papers / 9 shards**, `failedCategories: ["cs.AI"]` — discarded |
| `/usr/local/bin/python3.11 scripts/build_index.py` (root) | exit 0, **25,759 papers / 9 shards**, same `cs.AI` failure — discarded |
| `/usr/local/bin/python3.11 scripts/build_index.py --retention-days 30` (root) | exit 0, **14,253 papers / 5 shards**, complete — **used** |
| `npm run dev -- --port 5199 --strictPort` (`web/`) | Vite up on 5199 |
| `curl` probes (see above) | bare 302, base 200, data/index.json 200 |
| Playwright `setViewportSize` 1280 × 900, navigate, screenshot | capture written |
| `shasum -a 256` on both PNGs | identical |
| `git diff -- readme.md` | empty |
| `git status --porcelain` | only the four entries listed above |

**Not run, deliberately:** `npm run typecheck`, `npm test`, `npm run build`, and the Python
`unittest` suite. This item changes one binary asset and zero source files — `git diff` on
`web/` and `scripts/` is empty — so those gates cannot have moved, and `readme.md` needed no
edit to stay accurate (IMP-033 criterion 3's shape). The dev server running the capture is
itself a stronger check than typecheck for "the app renders".

## Uncertain / could not do

1. **The shipped index is a 30-day-retention build, not the default 60-day.** This is the one
   judgement call in this item. A default-flag build cannot be produced right now: two
   consecutive full builds lost `cs.AI` to an arXiv `HTTP 500` at `start=10000` (D-1), and
   shipping that index would have put an "incomplete index" notice in the hero. `--retention-days
   30` is a documented, supported value (`readme.md:64-71`), keeps every category below the
   failing offset, and yields a complete index. The only user-visible consequence is the hero's
   paper count (`14,253` rather than a 60-day figure) — the visible cards are the same newest
   papers a 60-day index would show first. If a later 60-day build completes cleanly, recapturing
   is a 6-minute job and needs no other change.
2. **The `index generated Oct 3, 2026` line and the paper titles in the hero will go stale.**
   That is inherent to any screenshot of a live feed; the next weekly deploy invalidates the
   date. Not fixable here, and not a criterion.
3. **Hero aesthetics vs. baseline comparability.** I kept the baseline's exact 1280 × 900 frame,
   which means the first paper card is clipped at the bottom edge (the baseline clips its second
   card the same way). A taller viewport would frame a whole card, but the spec's verification
   method asks for a comparison against `baseline-feed-desktop-1280.png`, so frame parity won.
4. I did not commit anything, per the loop's standing rule.

## Discovered, not fixed

Three observations are written up in `.improve/reports/discovered-IMP-030.md`: the live
`cs.AI` deep-offset reproduction (D-1), the 1280px Sort-row wrap (D-2), and the `14253` vs
`14,253` number formatting visible side by side in one frame (D-3).