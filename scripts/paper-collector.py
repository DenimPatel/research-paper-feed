import logging
import arxiv
import numpy as np
import pandas as pd
import arxiv
import os
import tarfile
from datetime import datetime

logging.basicConfig(level=logging.INFO)

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
    temp = ["","","","","","","","",""]
    temp[0] = result.title
    temp[1] = result.published
    temp[2] = result.entry_id
    temp[3] = result.summary
    temp[4] = result.pdf_url
    temp[5] = result.authors
    temp[6] = result.primary_category
    temp[7] = result.categories
    temp[8] = result.links
    if DOWNLOAD_PAPER:
        result.download_pdf(filename=f"{result.title}.pdf")
    if DOWNLOAD_RESOURCES:
        result.download_source(filename=f"{result.title}.tar.gz")
        file = tarfile.open(f"{result.title}.tar.gz")
        file.extractall(f'./extracted/{result.title}')
        file.close()
    all_data.append(temp)
    if len(all_data) >= MAX_PAPERS_TO_PULL:
        break

column_names = ['Title','Date','Id','Summary','URL', 'Authors', 'Primary_category', 'Categories', 'Links']
df = pd.DataFrame(all_data, columns=column_names)
 
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
      src="http://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.1/MathJax.js?config=TeX-AMS-MML_HTMLorMML">
    </script>
    </head>

     """]
    for i in range(len(df)):
        data.append(f"<br> <br> <br> <font size='5'> {i+1} </font> ")
        data.append(f"""<div style="text-align: right"> {str(df["Date"][i])} </div>""")    
        data.append("<hr style='border-style: dotted;' /> <b> <font size='5'> Title: "+df["Title"][i]+ "</b> </font>")
        data.append("<hr style='border-style: dotted;' /> ")
        data.append(f"<br> <font size='3'> Summary: " + f'{df["Summary"][i]} </font>')             
        data.append("<br> Link: ")
        data.append(f"""<a href='{df["URL"][i]}' target="_blank">{df["URL"][i]}</a>""")
    data.append("""
    </body>
    </html>""")
    data = "".join(data)
    filename = 'results/' + topic +'-'+ str(len(df))+'_papers_extracted_on_' + prefix + '.html'
    with open(filename, "w") as file:
        file.write(data)
    print(filename, "file saved!")
