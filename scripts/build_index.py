#!/usr/bin/env python3
"""Build a sharded, static JSON index of recent arXiv papers.

This is the data pipeline behind the GitHub Pages feed. It runs on a schedule
in GitHub Actions, queries a fixed set of CS/AI categories, deduplicates
cross-listed papers, truncates abstracts, and writes:

* ``data/index.json`` - manifest describing the available shards
* ``data/papers-<YYYY>-W<NN>.json`` - one file per ISO week

The pure helpers below (truncation, author formatting, dedup, sharding) are
deliberately free of network access so they can be unit tested with synthetic
records. Only :func:`collect_papers` touches arXiv. A category whose query
fails aborts the run instead of publishing an index that is missing it, since
a truncated index is indistinguishable from a complete one once deployed.
"""

import argparse
import json
import logging
import os
import re
import sys
from datetime import date, datetime, timedelta, timezone

# Make sibling imports resolve when run as ``python scripts/build_index.py``
# or when loaded by path from the test suite.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import arxiv_common  # noqa: E402

DEFAULT_CATEGORIES = ["cs.CV", "cs.LG", "cs.CL", "cs.AI", "cs.RO"]
DEFAULT_RETENTION_DAYS = 60
DEFAULT_ABSTRACT_CHARS = 500
DEFAULT_MAX_AUTHORS = 8
DEFAULT_OUT_DIR = os.path.join("web", "public", "data")

# A ``--category`` value is interpolated straight into ``cat:<value>``, so
# anything arXiv cannot answer with a feed is rejected here instead of coming
# back as an empty result indistinguishable from "no new papers".
CATEGORY_PATTERN = re.compile(r"^[a-zA-Z-]+(\.[a-zA-Z-]+)?$")

# Used when ``--max-per-category`` is left at 0 ("no per-category cap").
# The retention window is the real bound; this only prevents an unbounded run.
UNLIMITED = 100000

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")


def collapse_whitespace(text):
    """Normalize whitespace so titles/abstracts render cleanly."""
    return " ".join((text or "").split())


def truncate_abstract(abstract, max_chars):
    """Return ``(text, was_truncated)`` capped at ``max_chars`` characters."""
    text = collapse_whitespace(abstract)
    if max_chars <= 0 or len(text) <= max_chars:
        return text, False
    return text[:max_chars].rstrip() + "\u2026", True


def format_authors(authors, max_authors=DEFAULT_MAX_AUTHORS):
    """Return up to ``max_authors`` names, appending ``et al.`` when capped."""
    names = []
    for author in authors or []:
        name = getattr(author, "name", None) or str(author)
        name = collapse_whitespace(name)
        if name:
            names.append(name)
    if len(names) > max_authors:
        return names[:max_authors] + ["et al."]
    return names


def arxiv_id_from_entry(entry_id):
    """Extract a versionless arXiv ID from an entry URL (``..../2401.12345v2``)."""
    if not entry_id:
        return ""
    ident = entry_id.rstrip("/").rsplit("/", 1)[-1]
    return re.sub(r"v\d+$", "", ident)


def iso_date(value):
    """Format a datetime/date as an ISO date string, normalized to UTC."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            value = value.astimezone(timezone.utc)
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)


def iso_week_key(published):
    """Return ``YYYY-WNN`` for an ISO date string."""
    parsed = date.fromisoformat(published)
    year, week, _ = parsed.isocalendar()
    return f"{year}-W{week:02d}"


def record_from_result(result, abstract_chars=DEFAULT_ABSTRACT_CHARS):
    """Build the public record shape from an ``arxiv.Result``-like object."""
    abstract, truncated = truncate_abstract(
        getattr(result, "summary", ""), abstract_chars
    )
    return {
        "id": arxiv_id_from_entry(getattr(result, "entry_id", "")),
        "title": collapse_whitespace(getattr(result, "title", "")),
        "authors": format_authors(getattr(result, "authors", [])),
        "abstract": abstract,
        "abstractTruncated": truncated,
        "published": iso_date(getattr(result, "published", None)),
        "updated": iso_date(getattr(result, "updated", None)),
        "categories": list(getattr(result, "categories", []) or []),
        "primaryCategory": getattr(result, "primary_category", None),
        "absUrl": getattr(result, "entry_id", None),
        "pdfUrl": getattr(result, "pdf_url", None),
    }


def dedupe_records(records):
    """Deduplicate by arXiv ID, unioning categories and keeping first metadata."""
    merged = {}
    order = []
    for record in records:
        paper_id = record.get("id")
        if not paper_id:
            continue
        existing = merged.get(paper_id)
        if existing is None:
            merged[paper_id] = dict(record)
            order.append(paper_id)
            continue
        seen = set(existing.get("categories", []))
        for category in record.get("categories", []):
            if category not in seen:
                existing.setdefault("categories", []).append(category)
                seen.add(category)
    return [merged[paper_id] for paper_id in order]


def build_shards(
    records,
    generated_at=None,
    retention_days=DEFAULT_RETENTION_DAYS,
    categories=None,
):
    """Group records into ISO-week shards and return ``(manifest, files)``."""
    generated_at = generated_at or datetime.now(timezone.utc)
    groups = {}
    for record in records:
        published = record.get("published")
        if not published:
            continue
        groups.setdefault(iso_week_key(published), []).append(record)

    shards = []
    shard_files = {}
    for week in sorted(groups, reverse=True):
        papers = groups[week]
        papers.sort(
            key=lambda r: (r.get("published") or "", r.get("id") or ""),
            reverse=True,
        )
        dates = [r["published"] for r in papers if r.get("published")]
        filename = f"papers-{week}.json"
        shard_files[filename] = {
            "week": week,
            "from": min(dates) if dates else None,
            "to": max(dates) if dates else None,
            "papers": papers,
        }
        shards.append(
            {
                "week": week,
                "from": shard_files[filename]["from"],
                "to": shard_files[filename]["to"],
                "count": len(papers),
                "file": filename,
            }
        )

    manifest = {
        "generatedAt": (
            generated_at.astimezone(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z")
        ),
        "retentionDays": retention_days,
        "categories": list(categories or DEFAULT_CATEGORIES),
        "shards": shards,
        "totalPapers": sum(shard["count"] for shard in shards),
    }
    return manifest, shard_files


def _result_datetime(result):
    published = getattr(result, "published", None)
    if not isinstance(published, datetime):
        return None
    if published.tzinfo is None:
        return published.replace(tzinfo=timezone.utc)
    return published.astimezone(timezone.utc)


def collect_papers(
    categories, retention_days, max_per_category, abstract_chars, failures=None
):
    """Query each category and return raw (not yet deduplicated) records.

    ``failures`` is an optional list that collects every category whose query
    did not complete. ``iter_results`` reports arXiv errors through a status
    holder, and an ``ArxivError`` raised out of it is caught here too, so a
    mid-run outage is never mistaken for a category that simply has no new
    papers.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    limit = max_per_category if max_per_category > 0 else UNLIMITED
    failures = [] if failures is None else failures
    records = []
    for category in categories:
        query = f"cat:{category}"
        logging.info("Querying %s (limit %s) ...", query, limit)
        count = 0
        status = arxiv_common.new_status()
        try:
            for result in arxiv_common.iter_results(query, limit, status):
                published = _result_datetime(result)
                if published is not None and published < cutoff:
                    break
                records.append(record_from_result(result, abstract_chars))
                count += 1
        except arxiv_common.arxiv.ArxivError as exc:
            status.update(failed=True, error=str(exc))
        if status["failed"]:
            failures.append(category)
            logging.error(
                "  query failed for %s: %s", category, status["error"]
            )
            continue
        logging.info("  %d papers within retention window for %s", count, category)
    return records


def _clean_old_shards(out_dir, keep=()):
    """Remove shard files in ``out_dir``, sparing the names in ``keep``."""
    if not os.path.isdir(out_dir):
        return
    keep = set(keep)
    for name in os.listdir(out_dir):
        if name in keep:
            continue
        if re.fullmatch(r"papers-\d{4}-W\d{2}\.json", name):
            try:
                os.remove(os.path.join(out_dir, name))
            except OSError as exc:
                logging.warning("Could not remove stale shard %s: %s", name, exc)


def write_index(out_dir, manifest, shard_files):
    """Write the manifest and shard files to ``out_dir``.

    Shards land first, then the manifest, and stale shards are swept last. The
    previously deployed ``index.json`` therefore keeps referencing shards that
    are still on disk for the whole window in which this run can fail; deleting
    first would leave it pointing at files that no longer exist, which the app
    cannot recover from.
    """
    os.makedirs(out_dir, exist_ok=True)
    for filename, shard in shard_files.items():
        with open(os.path.join(out_dir, filename), "w", encoding="utf-8") as handle:
            json.dump(shard, handle, ensure_ascii=False, separators=(",", ":"))
    manifest_path = os.path.join(out_dir, "index.json")
    with open(manifest_path, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, ensure_ascii=False, indent=2)
    _clean_old_shards(out_dir, keep=shard_files)
    return manifest_path


def int_at_least(flag, minimum):
    """Return an argparse ``type`` for ``flag`` restricted to integers >= ``minimum``.

    Out-of-range values fail loudly instead of degrading into a different
    meaning: ``--retention-days 0`` used to make the cutoff now-or-future so the
    retention check fired on the first result, and ``--abstract-chars -3`` used
    to switch truncation off entirely.
    """
    accepted = f"{minimum} or greater"

    def parse(text):
        try:
            value = int(text)
        except ValueError:
            raise argparse.ArgumentTypeError(
                f"{flag} expects a whole number, got {text!r}"
            ) from None
        if value < minimum:
            raise argparse.ArgumentTypeError(
                f"{flag} accepts {accepted}, got {value}"
            )
        return value

    parse.__name__ = flag.lstrip("-").replace("-", "_")
    return parse


def category(value):
    """Return ``value`` as an arXiv category, rejecting anything else.

    Bare subjects (``cs``), archives (``astro-ph``) and archive/subject pairs
    (``astro-ph.HE``) are the real forms arXiv understands.
    """
    if not CATEGORY_PATTERN.fullmatch(value):
        raise argparse.ArgumentTypeError(
            f"--category value {value!r} is not an arXiv category; expected a "
            f"subject such as cs or cs.AI, or an archive/subject pair such as "
            f"stat.ML or astro-ph.HE"
        )
    return value


def parse_args(argv=None):
    parser = argparse.ArgumentParser(
        description="Build a sharded static JSON index of recent arXiv papers."
    )
    parser.add_argument(
        "--out-dir", default=DEFAULT_OUT_DIR,
        help=f"Directory for index.json and shards (default: {DEFAULT_OUT_DIR}).",
    )
    parser.add_argument(
        "--retention-days", type=int_at_least("--retention-days", 1),
        default=DEFAULT_RETENTION_DAYS,
        help=f"Only keep papers published within this many days "
             f"(default: {DEFAULT_RETENTION_DAYS}; 1 or greater).",
    )
    parser.add_argument(
        "--max-per-category", type=int_at_least("--max-per-category", 0),
        default=0,
        help="Dev escape hatch: cap results fetched per category "
             "(default: 0; 0 or greater, 0 = no cap).",
    )
    parser.add_argument(
        "--abstract-chars", type=int_at_least("--abstract-chars", 1),
        default=DEFAULT_ABSTRACT_CHARS,
        help=f"Truncate abstracts to this many characters "
             f"(default: {DEFAULT_ABSTRACT_CHARS}; 1 or greater).",
    )
    parser.add_argument(
        "--category", action="append", dest="categories", type=category,
        help="Override a category to query (repeatable). Each value must look "
             "like cs.AI, stat.ML or astro-ph.HE. "
             f"Defaults to {', '.join(DEFAULT_CATEGORIES)}.",
    )
    return parser.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    categories = args.categories or DEFAULT_CATEGORIES

    failures = []
    records = collect_papers(
        categories,
        args.retention_days,
        args.max_per_category,
        args.abstract_chars,
        failures,
    )
    if failures:
        logging.error(
            "Refusing to write an index: the arXiv query failed for %s.",
            ", ".join(failures),
        )
        return 1
    records = dedupe_records(records)
    if not records:
        logging.error("No papers fetched; refusing to write an empty index.")
        return 1

    manifest, shard_files = build_shards(
        records,
        retention_days=args.retention_days,
        categories=categories,
    )
    write_index(args.out_dir, manifest, shard_files)
    logging.info(
        "Wrote %d papers across %d shards to %s",
        manifest["totalPapers"],
        len(manifest["shards"]),
        args.out_dir,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
