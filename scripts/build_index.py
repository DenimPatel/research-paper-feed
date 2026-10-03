#!/usr/bin/env python3
"""Build a sharded, static JSON index of recent arXiv papers.

This is the data pipeline behind the GitHub Pages feed. It runs on a schedule
in GitHub Actions, queries a fixed set of CS/AI categories, deduplicates
cross-listed papers, truncates abstracts, and writes:

* ``data/index.json`` - manifest describing the available shards
* ``data/papers-<YYYY>-W<NN>.json`` - one file per ISO week

The pure helpers below (truncation, author formatting, dedup, sharding) are
deliberately free of network access so they can be unit tested with synthetic
records. Only :func:`collect_papers` touches arXiv. A truncated index is
indistinguishable from a complete one once deployed, so a run that could not
produce one refuses to write anything (exit 1); a run that produced an index
which is merely *missing* a category writes it, but records which categories
failed in ``index.json`` so the reader of a deployed index can tell. A category
that answered and then hit an error is neither of those two: it has papers, and
``truncatedCategories`` is what says how short it is. The manifest never
describes a category as absent while the shards hold papers carrying it
(:func:`reconcile_failed_categories`).
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

# Used when ``--max-per-category`` is left at 0 ("no per-category cap"), and
# the ceiling an explicit cap is clamped to. It is ``RESULTS_CEILING`` rather
# than a second number: arXiv's API user manual (§3.1.1.2, quoted at
# ``arxiv_common.RESULTS_CEILING``) caps one query at 30,000 results and answers a
# request above it with HTTP 400, so that is the most a category query can return
# and the highest number of requests that can earn an answer.
#
# ``arxiv.Client`` pages with ``page_size`` -- ``DEFAULT_PAGE_SIZE`` (1000, under
# the manual's 2,000-per-slice limit) -- and asks for ``page_size`` results at
# each ``start``, so a full page never carries a request past 30,000. A *short*
# page can: the library advances ``offset`` by the number of entries it actually
# got, so ``start`` need not stay a multiple of ``page_size``. That request is
# then refused, which terminates the category rather than the run.
#
# The retention window is what actually stops a healthy run; this keeps an
# unhealthy one inside a bound arXiv will serve. The manual also recommends
# refining queries over 1,000 results and points bulk harvesting at OAI-PMH.
UNLIMITED = arxiv_common.RESULTS_CEILING

# The largest ``start`` offset the deploy may ever request, and the bound
# ``tests/test_build_index.py`` pins the deploy's ``--max-per-category``
# against. It is a budget on *depth*, not a statement about how many papers a
# category should hold, and it is what the cap in ``deploy.yml`` is sized from.
#
# arXiv answers a deep offset with a 5xx rather than a page. On 2026-10-02
# ``cat:cs.AI`` returned HTTP 500 at ``start=10000`` on two consecutive full
# production builds -- the same offset both times, while ``cs.LG`` reached
# ``start=9000`` and ``cs.CV`` stopped at ``start=6000`` -- and the client's
# ``DEFAULT_NUM_RETRIES`` attempts over ~60 s all came back 500, because arXiv
# does not space its retries. Retrying cannot fix it: the fault is persistent
# at a given offset and the offset *moves*, being a function of how many
# in-window papers a category holds, so any number pinned to today's category
# sizes is invalidated as they grow. What does not move is the relationship
# between the cap and the offset, because ``Client`` asks for ``page_size``
# results at ``start`` and advances by ``page_size``: a cap of exactly this
# value with ``DEFAULT_PAGE_SIZE`` (1000) puts the deepest request the deploy
# can make at ``start=9000``, whatever any category has grown to. 9,000 is the
# deepest offset arXiv is known to have *answered*; 10,000 is the first one
# known to be refused, and the test requires the deepest request to stay below
# it.
#
# What it costs, stated plainly: this is a content trade for a robustness one.
# cs.AI held 10,785 papers inside the 60-day window on 2026-10-02, so a cap
# here truncates it by at least 785 papers (~7%) on a healthy run, announced in
# ``index.json`` under ``truncatedCategories`` rather than silent. That is a
# permanent, visible shortfall traded against a category that used to be
# deleted outright on every build that reached the fault -- the ~10,000 cs.AI
# papers collected before the 500 were fetched, written to the shards and then
# denied on screen. The cap and the "no papers here" claim were the same bug.
# It is a product call about how much of a category to keep; this constant is
# where a maintainer changes it, and the comment above the deploy step cites
# the number so the two cannot drift apart silently.
DEPLOY_OFFSET_BUDGET = 10000

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
    """Deduplicate by arXiv ID, unioning categories and keeping first metadata.

    The union appends into ``categories``, so the first-seen record's copy of
    that list is cloned: the caller's records come back exactly as they went in.
    """
    merged = {}
    order = []
    for record in records:
        paper_id = record.get("id")
        if not paper_id:
            continue
        existing = merged.get(paper_id)
        if existing is None:
            first = dict(record)
            if "categories" in first:
                first["categories"] = list(first["categories"])
            merged[paper_id] = first
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
    categories,
    retention_days,
    max_per_category,
    abstract_chars,
    failures=None,
    assume_newest_first=False,
    truncated=None,
):
    """Query each category and return raw (not yet deduplicated) records.

    ``failures`` is an optional list that collects every category whose query
    did not complete *and left nothing behind*. ``iter_results`` reports arXiv
    errors through a status holder, and an ``ArxivError`` raised out of it is
    caught here too, so a mid-run outage is never mistaken for a category that
    simply has no new papers.

    A query that dies mid-paging is not the same thing as a query that
    delivered nothing, and the two are classified apart (IMP-216). The fault
    that motivates this is a deep-offset 5xx: pages answer fine, then one offset
    comes back 500 after every retry, which leaves a category holding the
    thousands of papers collected before the failure. Calling that a *failed*
    category made the manifest lie -- ``failedCategories`` is rendered as "no
    papers here and no filters to browse", about a category whose papers were
    sitting in the very shards the manifest described. So a category that
    yielded at least one in-window record before dying is reported as
    ``truncated`` instead: it has papers, and not all of them.

    ``truncated`` is an optional list that collects every category for which the
    result allowance was fully spent, plus every category whose query died after
    yielding papers. Both mean the same thing to a reader, so both land here.
    Spending the allowance is the only evidence there is that more results
    existed, so it is reported rather than left to be inferred.

    Retention is enforced one record at a time: a result with no usable
    ``published`` datetime and a result older than the cutoff are each dropped
    on their own merits, whatever order the results arrive in.
    ``assume_newest_first`` is the extra shortcut, not the filter -- it stops
    reading a category at its first out-of-window result instead of paging
    through the rest of the feed, which is only sound because arXiv answers
    newest-first. It is off by default so the filter cannot be defeated by an
    unexpected order; callers that can vouch for the sort opt in.
    """
    cutoff = datetime.now(timezone.utc) - timedelta(days=retention_days)
    # A cap above ``UNLIMITED`` cannot buy more papers than arXiv will serve for
    # one query, so it is clamped rather than passed through into paging the
    # offsets arXiv refuses. ``iter_results`` clamps the same value again at the
    # point it reaches ``arxiv.Search``.
    limit = min(max_per_category, UNLIMITED) if max_per_category > 0 else UNLIMITED
    failures = [] if failures is None else failures
    truncated = [] if truncated is None else truncated
    records = []
    for category in categories:
        query = f"cat:{category}"
        logging.info("Querying %s (limit %s) ...", query, limit)
        count = 0
        yielded = 0
        undated = 0
        status = arxiv_common.new_status()
        try:
            for result in arxiv_common.iter_results(query, limit, status):
                yielded += 1
                published = _result_datetime(result)
                if published is None:
                    # Without a datetime there is no age to compare against the
                    # cutoff, so the record cannot be proven to be in window.
                    undated += 1
                    continue
                if published < cutoff:
                    # Load-bearing on arxiv_common.py's SubmittedDate/Descending sort.
                    if assume_newest_first:
                        break
                    continue
                records.append(record_from_result(result, abstract_chars))
                count += 1
        except arxiv_common.arxiv.ArxivError as exc:
            status.update(failed=True, error=str(exc))
        if undated:
            logging.warning(
                "  dropped %d result(s) with no usable published date for %s",
                undated,
                category,
            )
        if status["failed"]:
            # A category is only *failed* if the index ends up holding nothing
            # for it. A query that answered pages and then hit a refused offset
            # leaves papers behind, and recording that as a failure produced the
            # one statement this whole item exists to make impossible: a
            # manifest saying "cs.AI has no papers here" about shards holding
            # thousands of them. Those records are real, so the category stays
            # advertised and filterable and the shortfall is reported instead.
            if count:
                truncated.append(category)
                logging.error(
                    "  query for %s failed after %d paper(s) in the retention "
                    "window (%s); keeping the category with those papers and "
                    "recording it as truncated rather than absent",
                    category, count, status["error"],
                )
            else:
                failures.append(category)
                logging.error(
                    "  query failed for %s with nothing collected: %s",
                    category, status["error"],
                )
            continue
        if yielded >= limit:
            # Every result the allowance could hold arrived, so the category may
            # have more inside the retention window than were fetched. Reported
            # rather than guessed at: nothing distinguishes "the cap cut it off"
            # from "the category had exactly this many", and both mean the same
            # thing to a reader.
            truncated.append(category)
            logging.warning(
                "  %s hit the %d-result cap; older papers in the window may be "
                "missing", category, limit,
            )
        logging.info("  %d papers within retention window for %s", count, category)
    return records


def categories_in_records(records):
    """Return every category name ``records`` actually carry.

    Both fields a record carries count: ``primaryCategory`` because that is what
    a chip filters on, and ``categories`` because arXiv cross-lists, so a paper
    found through ``cat:cs.LG`` can belong to ``cs.AI`` as well.
    """
    held = set()
    for record in records:
        for name in record.get("categories") or ():
            held.add(name)
        primary = record.get("primaryCategory")
        if primary:
            held.add(primary)
    return held


def reconcile_failed_categories(categories, failures, truncated, records):
    """Return ``(failed, truncated)`` that agree with ``records``.

    ``collect_papers`` classifies by what one query did, but a manifest is a
    statement about the whole index, and a shard can hold papers for a category
    whose own query failed: arXiv cross-lists, so a paper answered by
    ``cat:cs.LG`` can carry ``cs.AI``. Reporting such a category as failed would
    take away a chip and put a "has no papers here" notice over a category the
    index had just filled. So this is the backstop that makes the two impossible
    to disagree -- a category moves from ``failed`` to ``truncated`` exactly when
    the records prove it is present.

    Ordering follows ``categories`` rather than the order the lists were built
    in, so a manifest lists its categories the same way whichever path put them
    there.
    """
    held = categories_in_records(records)
    still_failed = []
    degraded = []
    for category in categories:
        if category in failures:
            if category in held:
                degraded.append(category)
            else:
                still_failed.append(category)
        elif category in truncated:
            degraded.append(category)
    for category in degraded:
        if category in failures:
            logging.warning(
                "  %s is recorded as truncated, not failed: papers in this "
                "index carry it, so describing it as absent would be false",
                category,
            )
    return still_failed, degraded


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


def write_index(
    out_dir, manifest, shard_files, failed_categories=None,
    truncated_categories=None,
):
    """Write the manifest and shard files to ``out_dir``.

    Shards land first, then the manifest, and stale shards are swept last. The
    previously deployed ``index.json`` therefore keeps referencing shards that
    are still on disk for the whole window in which this run can fail; deleting
    first would leave it pointing at files that no longer exist, which the app
    cannot recover from.

    ``failed_categories`` names the categories whose query did not complete and
    ``truncated_categories`` those whose result allowance was fully spent. Both
    are recorded in the manifest -- under ``failedCategories`` and
    ``truncatedCategories`` -- so a reader of the *deployed site* can tell a
    short index from a complete one, which is the guarantee IMP-004's hard fail
    used to provide by refusing to write at all. A field nothing renders would
    not: the shortfall has to be on screen, not only in a file.
    ``build_index.main`` also drops the failed categories from ``categories``, so
    the site's category filter never offers a chip that leads to an empty feed.
    Both keys are absent when nothing failed, so a complete index is exactly the
    file it was before.
    """
    os.makedirs(out_dir, exist_ok=True)
    for filename, shard in shard_files.items():
        with open(os.path.join(out_dir, filename), "w", encoding="utf-8") as handle:
            json.dump(shard, handle, ensure_ascii=False, separators=(",", ":"))
    if failed_categories:
        manifest["failedCategories"] = list(failed_categories)
    if truncated_categories:
        manifest["truncatedCategories"] = list(truncated_categories)
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
        help="Cap results fetched per category "
             "(default: 0; 0 or greater, 0 = no cap beyond arXiv's own "
             f"{UNLIMITED}-result-per-query limit).",
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
    truncated = []
    records = collect_papers(
        categories,
        args.retention_days,
        args.max_per_category,
        args.abstract_chars,
        failures,
        # This caller knows the query is the one arxiv_common sorts by
        # submission date, newest first, so it can stop paging early.
        assume_newest_first=True,
        truncated=truncated,
    )
    # Every category failing is the total outage IMP-004 refuses to publish
    # over, and it stays fatal. One category dying mid-paging is not: the four
    # that succeeded are real papers, and throwing them away is what let a
    # single deep-offset 500 empty the whole weekly deploy. The shortfall is
    # recorded in the manifest and logged instead, so the index is written
    # short and says so rather than being written whole and silently.
    if failures and len(failures) == len(categories):
        logging.error(
            "Refusing to write an index: the arXiv query failed for %s.",
            ", ".join(failures),
        )
        return 1
    records = dedupe_records(records)
    if not records:
        if failures:
            logging.error(
                "Refusing to write an index: the arXiv query failed for %s and "
                "no remaining category produced a paper in the retention "
                "window.", ", ".join(failures)
            )
        logging.error("No papers fetched; refusing to write an empty index.")
        return 1

    # The last word on the classification belongs to the records, not to the
    # queries: a manifest that denies a category the shards hold is worse than
    # the outage that caused it, because it is published as fact.
    failures, truncated = reconcile_failed_categories(
        categories, failures, truncated, records
    )

    # Only the categories that answered are advertised. A chip for a category
    # with no papers behind it is a promise the index cannot keep: the site would
    # say "papers from cs.RO" in the header, offer cs.RO as a filter, and then
    # tell the reader "No papers match the current filters" -- blaming their
    # filter for an outage they never caused. The notice rendered from
    # ``failedCategories`` names what is missing instead, which is answerable.
    # A category whose query died mid-paging is not in ``failures`` any more, so
    # it keeps its chip: the papers behind it are real, and the notice built
    # from ``truncatedCategories`` tells the reader some of them are missing.
    contributing = [c for c in categories if c not in set(failures)]
    manifest, shard_files = build_shards(
        records,
        retention_days=args.retention_days,
        categories=contributing,
    )
    write_index(
        args.out_dir,
        manifest,
        shard_files,
        failed_categories=failures,
        truncated_categories=truncated,
    )
    if failures:
        logging.error(
            "Wrote an index missing %d of %d categor%s; index.json records "
            "them under 'failedCategories': %s",
            len(failures),
            len(categories),
            "y" if len(categories) == 1 else "ies",
            ", ".join(failures),
        )
    if truncated:
        logging.warning(
            "Wrote an index with %d of %d categor%s shorter than the full "
            "retention window; index.json records them under "
            "'truncatedCategories': %s",
            len(truncated),
            len(categories),
            "y" if len(categories) == 1 else "ies",
            ", ".join(truncated),
        )
    logging.info(
        "Wrote %d papers across %d shards to %s",
        manifest["totalPapers"],
        len(manifest["shards"]),
        args.out_dir,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
