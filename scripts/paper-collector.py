import argparse
import html
import inspect
import logging
import os
import re
import sys
import tarfile
from datetime import datetime

# This module is loaded by path in tests, so make sibling imports resolve.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import arxiv  # noqa: E402
import pandas as pd  # noqa: E402

import arxiv_common  # noqa: E402

logging.basicConfig(level=logging.INFO)

# ``extractall(filter=...)`` landed in 3.12 and was backported to 3.8.17, 3.9.17,
# 3.10.12 and 3.11.4, so a version number is not a usable check. Without a filter,
# extractall is the CVE-2007-4559 path-traversal primitive.
TARFILE_HAS_FILTER = (
    "filter" in inspect.signature(tarfile.TarFile.extractall).parameters
    and hasattr(tarfile, "data_filter")
)

# The slug becomes a filename and a directory name, so it is capped well below
# the 255-byte filename limit of ext4/APFS/NTFS to leave room for the suffixes
# callers append to it ("...papers.csv", ".pdf", the extraction timestamp).
MAX_SLUG_BYTES = 200
# Used when an input leaves nothing usable behind, e.g. ".", ".." or "   ".
FALLBACK_SLUG = "_"
# Windows resolves these device names anywhere they appear, with or without an
# extension, so "CON" and "CON.txt" both name the console device.
WINDOWS_RESERVED_NAMES = frozenset(
    ["CON", "PRN", "AUX", "NUL"]
    + [f"COM{number}" for number in range(1, 10)]
    + [f"LPT{number}" for number in range(1, 10)]
)


def truncate_to_bytes(text, limit):
    """Cut ``text`` down to at most ``limit`` UTF-8 bytes, never mid-character."""
    encoded = text.encode("utf-8")
    if len(encoded) <= limit:
        return text
    return encoded[:limit].decode("utf-8", "ignore")


def safe_filename(title):
    """Return ``title`` as a single path component that is safe to create.

    The slug is used as a filename *and* as the extraction directory name, so it
    must never be empty, "." or "..", must never contain a path separator, must
    stay inside a filesystem's byte budget, and must never name a reserved
    Windows device.
    """
    cleaned = re.sub(r"[\x00-\x1f\x7f]", "_", title)
    cleaned = re.sub(r'[\\/:"*?<>|]+', "_", cleaned).strip().strip(". ")
    if not cleaned:
        return FALLBACK_SLUG
    # Windows treats everything before the first dot as the device name.
    if cleaned.split(".")[0].upper() in WINDOWS_RESERVED_NAMES:
        # Reserve a byte for the suffix so the cap still holds afterwards.
        cleaned = truncate_to_bytes(cleaned, MAX_SLUG_BYTES - 1) + "_"
    else:
        cleaned = truncate_to_bytes(cleaned, MAX_SLUG_BYTES)
    # Truncating can leave a trailing dot, which Windows trims silently.
    return cleaned.rstrip(". ")


def is_inside(root, path):
    """Return True when ``path`` is ``root`` or sits underneath it."""
    try:
        return os.path.commonpath([root, path]) == root
    except ValueError:
        return False


def rejection_reason(member, dest):
    """Return why an archive member must not be extracted into ``dest``, else None.

    A hand-rolled stand-in for ``tarfile.data_filter`` used only on interpreters
    that predate extraction filters. realpath resolves symlinks in the member's
    parent directories, so a member routed through a symlinked directory is
    rejected too, not just one that spells out ``..``.
    """
    root = os.path.realpath(dest)
    try:
        if not is_inside(root, os.path.realpath(os.path.join(root, member.name))):
            return "would be extracted outside %s" % root
        if member.issym():
            link = os.path.join(root, os.path.dirname(member.name), member.linkname)
        elif member.islnk():
            link = os.path.join(root, member.linkname)
        else:
            link = None
        if link is not None and not is_inside(root, os.path.realpath(link)):
            return "links to %r, which is outside %s" % (member.linkname, root)
        if link is None and not (member.isfile() or member.isdir()):
            return "is a special file"
    except ValueError as exc:
        return "has an unusable name (%s)" % exc
    return None


def mode_str(mode):
    """Render a member mode for logging; link members carry no mode."""
    return "unset" if mode is None else "%o" % mode


def extract_source_archive(archive_path, dest):
    """Extract a source tarball into ``dest``, skipping members that escape it."""
    with tarfile.open(archive_path) as file:
        if not TARFILE_HAS_FILTER:
            logging.warning(
                "This interpreter's tarfile has no extraction filter (added in "
                "3.8.17, 3.9.17, 3.10.12 and 3.11.4); screening %s for path "
                "traversal by hand instead.", archive_path,
            )
            safe_members = []
            for member in file.getmembers():
                reason = rejection_reason(member, dest)
                if reason:
                    logging.warning(
                        "Skipped unsafe member %r in %s: it %s",
                        member.name, archive_path, reason,
                    )
                    continue
                safe_members.append(member)
            file.extractall(dest, members=safe_members)
            return
        # extractall applies the filter itself, but at the default errorlevel it
        # raises on the first rejected member, which would throw away the rest of
        # a legitimate archive. Screen the members first so each rejection is
        # logged and only the unsafe ones are dropped.
        safe_members = []
        for member in file.getmembers():
            try:
                filtered = tarfile.data_filter(member, dest)
            except (tarfile.FilterError, ValueError) as exc:
                logging.warning(
                    "Skipped unsafe member %r in %s: %s", member.name, archive_path, exc
                )
                continue
            # data_filter relocates absolute paths and strips privileged bits
            # instead of rejecting them, so report those rewrites too.
            mode_changed = (
                member.mode is not None
                and filtered.mode is not None
                and filtered.mode != member.mode
            )
            if filtered.name != member.name or mode_changed:
                logging.warning(
                    "Sanitized member %r in %s: name %r, mode %s -> %s",
                    member.name, archive_path, filtered.name,
                    mode_str(member.mode), mode_str(filtered.mode),
                )
            safe_members.append(member)
        file.extractall(dest, members=safe_members, filter="data")


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
    all_data = []
    for result in arxiv_common.iter_results(topic, max_papers):
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
                extract_source_archive(
                    f"{title_slug}.tar.gz", f"./extracted/{title_slug}"
                )
        except (arxiv.ArxivError, OSError, tarfile.TarError) as exc:
            logging.warning("Failed to download resources for %r: %s", result.title, exc)
        all_data.append(record)

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

    topic_slug = safe_filename(topic)
    os.makedirs(args.output_dir, exist_ok=True)

    if args.save_csv:
        df.to_csv(os.path.join(args.output_dir, f"{topic_slug}_papers.csv"), index=False)

    prefix = datetime.now().strftime("%m-%d-%Y-%H-%M-%S")
    filename = os.path.join(
        args.output_dir,
        f"{topic_slug}-{len(df)}_papers_extracted_on_{prefix}.html",
    )
    with open(filename, "w") as file:
        file.write(build_html_feed(df))
    print(filename, "file saved!")


if __name__ == "__main__":
    main()
