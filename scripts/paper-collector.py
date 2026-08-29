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

MAX_PAPERS_TO_PULL = 1000
DOWNLOAD_PAPER = False
DOWNLOAD_RESOURCES = False
SAVE_CSV = False
GENERATE_HTML = True

now = datetime.now() 
prefix = now.strftime("%m-%d-%Y-%H-%M-%S")

# ## topic ideas
# - cat:cs.CV AND \" 3d reconstruction \"
# - hd AND map AND generation
# - visual AND inertial AND odometry 

topic = input("Enter the topic you need to search for : ")

big_slow_client = arxiv.Client(
  page_size = min(1000, MAX_PAPERS_TO_PULL) ,
  delay_seconds = 10,
  num_retries = 5
)

all_data = []
for result in big_slow_client.results(arxiv.Search(query=topic,
                                                   sort_by = arxiv.SortCriterion.SubmittedDate,
                                                   sort_order = arxiv.SortOrder.Descending)):
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
    if DOWNLOAD_PAPER:
        result.download_pdf(filename=f"{title_slug}.pdf")
    if DOWNLOAD_RESOURCES:
        result.download_source(filename=f"{title_slug}.tar.gz")
        file = tarfile.open(f"{title_slug}.tar.gz")
        file.extractall(f'./extracted/{title_slug}')
        file.close()
    all_data.append(record)
    if len(all_data) >= MAX_PAPERS_TO_PULL:
        break

df = pd.DataFrame(all_data)
 
print("Number of papers extracted : ",df.shape[0])

if SAVE_CSV:
    df.to_csv(topic+"_papers.csv", index=False)

if GENERATE_HTML:
    data = [ r"""<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 3.2 Final//EN">
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
    data = "".join(data)
    output_dir = 'results'
    os.makedirs(output_dir, exist_ok=True)
    filename = f'{output_dir}/{topic}-{len(df)}_papers_extracted_on_{prefix}.html'
    with open(filename, "w") as file:
        file.write(data)
    print(filename, "file saved!")
