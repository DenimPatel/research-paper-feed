"""Shared arXiv client construction and result iteration.

Both the interactive CLI (``paper-collector.py``) and the static index
builder (``build_index.py``) talk to the arXiv API the same way. Keeping the
client setup here means rate-limiting, retry, and sort semantics stay in one
place.
"""

import logging

import arxiv

logging.basicConfig(level=logging.INFO)

DEFAULT_PAGE_SIZE = 1000
DEFAULT_DELAY_SECONDS = 10
DEFAULT_NUM_RETRIES = 5


def build_client(max_results):
    """Create an arXiv client sized for ``max_results``."""
    return arxiv.Client(
        page_size=max(1, min(DEFAULT_PAGE_SIZE, max_results)),
        delay_seconds=DEFAULT_DELAY_SECONDS,
        num_retries=DEFAULT_NUM_RETRIES,
    )


def iter_results(query, max_results):
    """Yield arXiv results for ``query``, newest first, up to ``max_results``.

    arXiv errors are logged and terminate iteration, so callers receive
    whatever results arrived before the failure instead of an exception. This
    matches the long-standing behavior of ``paper-collector.py`` and lets the
    index builder fail loudly later when it has zero records.
    """
    if max_results is not None and max_results <= 0:
        return

    client = build_client(max_results if max_results is not None else DEFAULT_PAGE_SIZE)
    search = arxiv.Search(
        query=query,
        # ``arxiv.Search`` defaults ``max_results`` to 100 in arxiv>=2, which
        # silently caps every query to a single page unless we pass our own
        # limit through. ``None`` means "no limit".
        max_results=max_results,
        sort_by=arxiv.SortCriterion.SubmittedDate,
        sort_order=arxiv.SortOrder.Descending,
    )

    yielded = 0
    try:
        for result in client.results(search):
            yield result
            yielded += 1
            if max_results is not None and yielded >= max_results:
                break
    except arxiv.ArxivError as exc:
        logging.error("ArXiv search failed for %r: %s", query, exc)
