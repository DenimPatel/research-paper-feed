# Generate your own research paper feed!

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Python 3.x](https://img.shields.io/badge/python-3.x-blue.svg)](https://www.python.org/)

This project is a Python-based tool that allows you to extract research papers from ArXiv, a popular online repository of scientific papers. It provides a convenient way to download and organize research papers for further analysis and reference.

![Example feed](images/feed_example.png)

## Prerequisites

- Python 3.x installed on your machine
- Required Python packages (specified in `requirements.txt`)

## Installation

1. Clone the repository:

``` shell
git clone https://github.com/DenimPatel/research-paper-feed.git
```
Change to the project directory:
``` shell
cd research-paper-feed
```

Install the required dependencies:
```shell
pip install -r requirements.txt
```

Run the script to extract research papers:
``` shell
python scripts/paper-collector.py --topic "cat:cs.CV AND \"3d reconstruction\"" --max-papers 200
```
Or run it interactively and enter the topic when prompted:
``` shell
python scripts/paper-collector.py
```
The extracted research papers will be saved under `results/` as an HTML feed, organized by category and publication date.

### Usage

| Flag | Description | Default |
| --- | --- | --- |
| `--topic` | ArXiv search query. If omitted, you'll be prompted interactively. | _(prompted)_ |
| `--max-papers` | Maximum number of papers to pull. | `1000` |
| `--output-dir` | Directory the generated HTML feed is written to. | `results` |
| `--download-pdfs` | Also download each paper's PDF. | off |
| `--download-sources` | Also download and extract each paper's LaTeX source archive. | off |
| `--save-csv` | Also save the extracted metadata as a CSV file. | off |

The ArXiv query syntax supports field prefixes and boolean operators, for example:

- `cat:cs.CV AND "3d reconstruction"`
- `hd AND map AND generation`
- `visual AND inertial AND odometry`

See the [ArXiv API user manual](https://info.arxiv.org/help/api/user-manual.html#query_details) for the full query syntax.

### Notebook

A Jupyter notebook version of the same workflow is available at [`notebooks/paper-collector.ipynb`](notebooks/paper-collector.ipynb) if you'd rather run it interactively cell-by-cell (e.g. in Jupyter or Colab) instead of from the command line.

## Acknowledgments
The ArXiv API for providing access to the research papers.

## Contributing

Pull requests are welcome. For major changes, please open an issue first
to discuss what you would like to change.

Please make sure to update tests as appropriate.

## License

[MIT](https://choosealicense.com/licenses/mit/)