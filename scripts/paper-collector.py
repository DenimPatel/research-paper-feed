import argparse
import html
import logging
import re
import arxiv
import pandas as pd
import os
import tarfile
from datetime import datetime

logging.basicConfig(level=logging.INFO)


def safe_filename(title):
    """Strip characters that are illegal in filenames on common filesystems."""
    return re.sub(r'[\\/:"*?<>|]+', "_", title).strip()


def parse_args():
    parser = argparse.ArgumentParser(
        description="Extract research papers from ArXiv into an HTML feed."
    )
    parser.add_argument(
        "--topic",
        help="ArXiv search query, e.g. 'cat:cs.CV AND \"3d reconstruction\"'. "
             "Prompted for interactively if omitted.",
    )
    parser.add_argument(
        "--max-papers", type=int, default=1000,
        help="Maximum number of papers to pull (default: 1000).",
    )
    parser.add_argument(
        "--output-dir", default="results",
        help="Directory the generated HTML feed is written to (default: results).",
    )
    parser.add_argument(
        "--download-pdfs", action="store_true",
        help="Also download each paper's PDF.",
    )
    parser.add_argument(
        "--download-sources", action="store_true",
        help="Also download and extract each paper's LaTeX source archive.",
    )
    parser.add_argument(
        "--save-csv", action="store_true",
        help="Also save the extracted metadata as a CSV file.",
    )
    return parser.parse_args()


def fetch_papers(topic, max_papers, download_pdfs=False, download_sources=False):
    client = arxiv.Client(
        page_size=min(1000, max_papers),
        delay_seconds=10,
        num_retries=5,
    )
    search = arxiv.Search(
        query=topic,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    all_data = []
    try:
        for result in client.results(search):
            record = {
                "Title": result.title,
                "Date": result.published,
                "Id": result.entry_id,
                "Summary": result.summary,
                "URL": result.pdf_url,
                "Authors": result.authors,
                "Primary_category": result.primary_category,
                "Categories": result.categories,
                "Links": result.links,
            }
            title_slug = safe_filename(result.title)
            try:
                if download_pdfs:
                    result.download_pdf(filename=f"{title_slug}.pdf")
                if download_sources:
                    result.download_source(filename=f"{title_slug}.tar.gz")
                    with tarfile.open(f"{title_slug}.tar.gz") as file:
                        file.extractall(f"./extracted/{title_slug}")
            except (arxiv.ArxivError, OSError, tarfile.TarError) as exc:
                logging.warning("Failed to download resources for %r: %s", result.title, exc)
            all_data.append(record)
            if len(all_data) >= max_papers:
                break
    except arxiv.ArxivError as exc:
        logging.error("ArXiv search failed: %s", exc)

    return pd.DataFrame(all_data)


def build_html_feed(df):
    data = [r"""<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
    <html>
    <head>
    <title>Mathedemo</title>
    <style>
          body {
             margin-left: 400px;
             margin-right: 400px;
          }
       </style>

    <script type="text/x-mathjax-config">
      MathJax.Hub.Config({tex2jax: {inlineMath: [['$','$'], ['\\(','\\)']]}});
    </script>
    <script type="text/javascript"
      src="https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
    </script>
    </head>

     """]
    for i in range(len(df)):
        title = html.escape(df["Title"][i])
        summary = html.escape(df["Summary"][i])
        url = html.escape(df["URL"][i])
        data.append(f"<br> <br> <br> <font size='5'> {i+1} </font> ")
        data.append(f"""<div style="text-align: right"> {html.escape(str(df["Date"][i]))} </div>""")
        data.append(f"<hr style='border-style: dotted;' /> <b> <font size='5'> Title: {title} </b> </font>")
        data.append("<hr style='border-style: dotted;' /> ")
        data.append(f"<br> <font size='3'> Summary: {summary} </font>")
        data.append("<br> Link: ")
        data.append(f"""<a href='{url}' target="_blank">{url}</a>""")
    data.append("""
    </body>
    </html>""")
    return "".join(data)


def main():
    args = parse_args()
    topic = args.topic or input("Enter the topic you need to search for : ")

    df = fetch_papers(
        topic,
        args.max_papers,
        download_pdfs=args.download_pdfs,
        download_sources=args.download_sources,
    )
    print("Number of papers extracted : ", df.shape[0])

    if args.save_csv:
        df.to_csv(topic + "_papers.csv", index=False)

    prefix = datetime.now().strftime("%m-%d-%Y-%H-%M-%S")
    os.makedirs(args.output_dir, exist_ok=True)
    filename = f"{args.output_dir}/{topic}-{len(df)}_papers_extracted_on_{prefix}.html"
    with open(filename, "w") as file:
        file.write(build_html_feed(df))
    print(filename, "file saved!")


if __name__ == "__main__":
    main()
