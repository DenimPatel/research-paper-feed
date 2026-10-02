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


def new_status():
    """Return an empty ``iter_results`` status holder."""
    return {"failed": False, "error": None}


def iter_results(query, max_results, status=None):
    """Yield arXiv results for ``query``, newest first, up to ``max_results``.

    arXiv errors are logged and terminate iteration, so callers receive
    whatever results arrived before the failure instead of an exception. This
    matches the long-standing behavior of ``paper-collector.py`` and lets the
    index builder fail loudly later when it has zero records.

    A short result list is indistinguishable from an exhausted one, so callers
    that must not act on a partial answer pass a ``status`` holder (see
    :func:`new_status`). It is reset on entry and, if arXiv fails mid-query,
    filled in with ``{"failed": True, "error": "<message>"}`` so the caller can
    tell "category had no new papers" apart from "the query died".
    """
    if status is not None:
        status.update(failed=False, error=None)
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
        if status is not None:
            status.update(failed=True, error=str(exc))
        logging.error("ArXiv search failed for %r: %s", query, exc)
