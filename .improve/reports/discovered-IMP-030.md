# Discovered while implementing IMP-030 — not fixed

Out-of-scope findings from the IMP-030 hero-screenshot work (replace `images/feed_example.png`
with a real 1280px capture of the current React feed). None of these were touched; each is
either already tracked in `.improve/REPO_PROFILE.md` or needs its own item. Nothing here is a
regression from this work.

## D-1 — arXiv returns a reproducible HTTP 500 at `start=10000` for `cat:cs.AI`, so the weekly deploy currently ships an index missing a category (LIVE reproduction of PY-17 / IMP-204)

Two consecutive full production builds — the bare command `deploy.yml` runs — both lost
`cs.AI` and both failed at the *same* offset:

```
$ /usr/local/bin/python3.11 scripts/build_index.py
…&search_query=cat%3Acs.AI&…&start=10000&max_results=1000   try 0, 1, 2, 3, 4, 5  → all HTTP 500
ERROR:root:ArXiv search failed for 'cat:cs.AI': Page request resulted in HTTP 500 (…)
ERROR:root:  query failed for cs.AI: Page request resulted in HTTP 500 (…)
ERROR:root:Wrote an index missing 1 of 5 categories; index.json records them under 'failedCategories': cs.AI
INFO:root:Wrote 25761 papers across 9 shards to web/public/data      # attempt 1, totalPapers 25761
INFO:root:Wrote 25759 papers across 9 shards to web/public/data      # attempt 2, totalPapers 25759
```

Every other category paginated cleanly past that depth (`cs.LG` reached `start=9000` with no
error; `cs.CV` stopped at `start=6000`). Only `cat:cs.AI` at `start=10000` failed, and it failed
identically twice, so this reads as a persistent arXiv-side fault at that offset rather than a
transient blip. Impact: with IMP-204's partial-index contract, the deployed site shows its
"index is incomplete" notice and the `cs.AI` chip is dropped, i.e. a reader silently loses one of
the five advertised categories.

**Already tracked** — PY-17 (profile §9) predicts exactly this from a deep-offset 5xx and names
IMP-095 / IMP-204 as the owners; §10 records IMP-204 as landed. This entry adds the missing
empirical evidence: the failure is reproducible against production arXiv today, on the exact
default `deploy.yml` command, at `start=10000` for `cs.AI` only. Useful to whoever picks up
IMP-205/IMP-206 or the retry/backoff work, because it also shows the current `arxiv` retry loop
(6 attempts) does not help against this specific fault — 6 attempts over ~60 s all returned 500.

Workaround used for IMP-030 (not a fix): `--retention-days 30`, which keeps every category under
the failing offset and yields a complete index. Any real fix belongs to PY-17/IMP-204's owners.

## D-2 — At 1280px the filter panel now wraps the Sort group onto its own row (related to WEB-69, not identical)

`.improve/artifacts/IMP-030/feed-desktop-1280.png` vs
`.improve/artifacts/baseline/baseline-feed-desktop-1280.png`: at the same 1280px viewport, the
baseline fits Categories / Recency / Sort on one row, while the current build puts **Sort** on a
second row beneath Categories + Recency. The cause is visible in the frame — the category group
now has six chips (`All`, `cs.CV`, `cs.LG`, `cs.CL`, `cs.AI`, `cs.RO`) because IMP-010 added
`All`, which is one chip wider than the baseline's five.

WEB-69 (`styles.css:720-753`, one breakpoint at 520px, "controls row is ragged") is adjacent but
not the same statement: WEB-69 is about the 520–1000px range having no intermediate layout. This
is a wrap at the project's own de-facto **desktop** width, so the desktop feed panel is now two
rows tall where it was one. Not filed as a new profile row from this item — it is a CSS sizing
consequence of IMP-010 and belongs to whoever owns the control-panel layout, if anyone does.

## D-3 — The hero frame shows both number formats at once (WEB-49, already tracked)

The new capture makes WEB-49 visible in a single screenshot: the hero line renders
`14,253 papers from cs.CV, …` with a thousands separator, and the status line directly below the
chips renders `14253 papers match` without one. Profile §9 WEB-49 ("Number formatting
inconsistent (`2,812` vs `2812`) and no pluralization") already records the inconsistency; this
entry only notes that it is now visible in the repository's most prominent asset, which is an
argument for prioritising it. Not fixed — it is a code change in `App.tsx` / `FeedControls.tsx`,
nothing to do with a screenshot.