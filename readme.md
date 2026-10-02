# Research Paper Feed

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/)

An interactive feed of recent arXiv papers in computer vision, machine learning,
NLP, AI, and robotics — plus a Python CLI for pulling your own custom feeds.

**Live site:** <https://denimpatel.github.io/research-paper-feed/>

![Example feed](images/feed_example.png)

## What the web feed does

The hosted app is a static React site (GitHub Pages), so there is no server and
no runtime arXiv calls. A scheduled GitHub Action runs the Python index builder,
writes a sharded JSON index, and deploys it alongside the site. The browser then:

- searches a topic across titles, abstracts, and authors, with `"quoted phrase"`
  support and implicit AND across terms;
- filters by category (`cs.CV`, `cs.LG`, `cs.CL`, `cs.AI`, `cs.RO`) and by a
  7 / 30 / 60 day recency window, fetching only the week shards that overlap
  the window;
- sorts by newest or by relevance (title matches rank above abstract matches);
- saves papers into multiple named **collections** stored in your browser's
  `localStorage`, and exports/imports a collection as JSON.

All metadata (title, authors, abstract, categories, dates) links out to arXiv.
Downloading PDFs or extracting figures is intentionally out of scope.

The index covers a rolling 60-day window. Saving a paper stores a full metadata
snapshot, so a collection keeps working after the paper ages out of the index.

## Run the web app locally

Clone the repository and `cd` into it. Step 1 runs from the repository root; steps 2
and everything after it run from `web/`.

1. Build an index (needs network access to arXiv). From the repository root:

   ```shell
   python3 --version                              # must be 3.10 or newer
   python3 -m venv .venv
   source .venv/bin/activate                      # Windows PowerShell: .venv\Scripts\Activate.ps1
   python -m pip install -r requirements.txt
   python scripts/build_index.py --category cs.CV --max-per-category 300
   ```

   **Python 3.10 and newer** can install the dependencies. This project is *verified
   on Python 3.11 and 3.14*; on 3.10 pip resolves an older major of `pandas` than on
   3.11+, so that combination is not the one these steps were tested against. Python
   3.9 and older cannot install the dependencies at all — if `python3 --version`
   reports something older, install a newer interpreter (`brew install python@3.12` on
   macOS, `sudo apt install python3.12 python3.12-venv` on Ubuntu) and re-run this step.

   A virtualenv is not optional: installing into a system interpreter is
   refused on macOS and on current Linux distributions (PEP 668,
   `externally-managed-environment`). `.venv/` is not in `.gitignore` yet, so
   create it one directory above the repository
   (`python3 -m venv ../research-paper-feed-venv`) and activate that path if you
   would rather keep the working tree clean.

   This writes `web/public/data/index.json` plus `data/papers-<YYYY>-W<NN>.json`.
   Useful flags, with the values they accept: `--retention-days` (1 or greater,
   default `60`), `--max-per-category` (0 or greater, default `0` = as many
   results as arXiv will serve for one query — pass a small number for fast dev
   runs), `--abstract-chars` (1 or greater, default `500`), `--category`
   (repeatable; each value must look like `cs.AI`, `stat.ML` or `astro-ph.HE`,
   defaulting to `cs.CV`, `cs.LG`, `cs.CL`, `cs.AI`, `cs.RO`), and `--out-dir`
   (any writable directory, default `web/public/data`). An out-of-range or
   malformed value is rejected before anything is fetched or written.

   `--max-per-category 0` is a bound, not the absence of one. arXiv's API user
   manual limits a single query to 30,000 results, returned in slices of at most
   2,000 at a time, and answers a request above that with HTTP 400 — so 0 means
   "up to that ceiling" (30,000), and a larger explicit value is clamped to it.
   The 60-day retention window is what actually stops a healthy run, which is why
   a normal build only ever asks for the first page or two.

   If one category's query dies part-way through, the index the other categories
   produced is still written instead of nothing. `index.json` names what is
   missing under `failedCategories`, the site shows a notice saying the index is
   incomplete, and the missing category is dropped from the filter entirely — so
   a short index cannot be mistaken for a complete one, and no filter chip can
   send a reader to a feed that is empty for reasons of someone else's. A
   category that used up its `--max-per-category` allowance is reported the same
   way, under `truncatedCategories`: it keeps its papers and its chip, and the
   notice says older papers from it may be missing. Only a run where *every*
   category failed, or one that fetched no papers at all, exits 1 and writes
   nothing, leaving the previously deployed index in place.

2. Start the dev server. From the repository root:

   ```shell
   cd web
   npm install
   npm run dev
   ```

   The app is served under the Pages base path,
   <http://localhost:5173/research-paper-feed/>.

   If the data files are missing, the app shows a clear "no paper index yet"
   message instead of failing — so `npm run dev` still renders without a network
   build.

### Web tests and build

You are in `web/` after step 2. If you are not, get there first (`cd web` from the
repository root):

```shell
npm run typecheck   # tsc --noEmit
npm test            # vitest: search, collections, index loading, components
npm run build       # tsc --noEmit && vite build
```

### Python CLI

The original one-shot Python tool remains supported. It queries arXiv and writes
a static HTML dump into `results/`, and is independent of the web app.

These commands run from the repository root, so `cd ..` first if you are still in
`web/`. They need the virtualenv from step 1
([above](#run-the-web-app-locally)); if you skipped that, create and activate one.

Extract papers into an HTML feed:

```shell
python -m pip install -r requirements.txt
python scripts/paper-collector.py --topic "cat:cs.CV AND \"3d reconstruction\"" --max-papers 200
```

Or run it interactively and enter the topic when prompted:

```shell
python scripts/paper-collector.py
```

The extracted papers are saved under `results/` as an HTML feed.

### CLI options

| Flag | Description | Default |
| --- | --- | --- |
| `--topic` | ArXiv search query. If omitted, you'll be prompted interactively. | _(prompted)_ |
| `--max-papers` | Maximum number of papers to pull. Must be 1 or greater. | `1000` |
| `--output-dir` | Directory the generated HTML feed is written to. | `results` |
| `--download-pdfs` | Also download each paper's PDF. | off |
| `--download-sources` | Also download and extract each paper's LaTeX source archive. | off |
| `--save-csv` | Also save the extracted metadata as a CSV file. | off |

Both the HTML feed and the optional `--save-csv` file are written into
`--output-dir`, which is created if it does not already exist. The PDF and
LaTeX downloads from `--download-pdfs` and `--download-sources` are the
exception: those are written to the directory you run the command from, with
extracted sources under `./extracted/`.

The ArXiv query syntax supports field prefixes and boolean operators, for example:

- `cat:cs.CV AND "3d reconstruction"`
- `hd AND map AND generation`
- `visual AND inertial AND odometry`

See the [ArXiv API user manual](https://info.arxiv.org/help/api/user-manual.html#query_details) for the full query syntax.

### Notebook

A Jupyter notebook version of the same workflow is available at
[`notebooks/paper-collector.ipynb`](notebooks/paper-collector.ipynb) if you'd
rather run it interactively cell-by-cell (e.g. in Jupyter or Colab) instead of
from the command line.

## Deployment

`.github/workflows/deploy.yml` builds the index and deploys the site to GitHub
Pages on a weekly schedule (Sunday at 06:00 UTC), on pushes to `main`, and on
manual dispatch. Its index step caps each category at
`--max-per-category 30000`, which is arXiv's own ceiling for a single query and
so a safety bound rather than a content budget: at the shipped 60-day retention
the largest of the five categories held 10,785 papers when it was measured, so
the cap sits well clear of any real window and costs nothing on a healthy run.
The comment above the step records the measurement, the growth rate it has to
outlast, and the timeout arithmetic. CI (`.github/workflows/ci.yml`) runs the
Python `unittest` suite and, for the web app, `npm ci`, `npm run typecheck`,
`npm test`, a small paper-index build and then `npm run build`.

> One-time setup: in the repository's **Settings → Pages**, set **Source =
> GitHub Actions**. The workflow cannot set this itself, and the first deploy
> fails without it.

## Acknowledgments

The ArXiv API for providing access to the research papers.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines on reporting issues and submitting pull requests.

## License

[MIT](https://choosealicense.com/licenses/mit/)
