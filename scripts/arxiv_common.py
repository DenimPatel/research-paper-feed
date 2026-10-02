"""Shared arXiv client construction and result iteration.

Both the interactive CLI (``paper-collector.py``) and the static index
builder (``build_index.py``) talk to the arXiv API the same way. Keeping the
client setup here means rate-limiting, retry, and sort semantics stay in one
place.
"""

import logging

import arxiv
import requests

logging.basicConfig(level=logging.INFO)

DEFAULT_PAGE_SIZE = 1000
DEFAULT_DELAY_SECONDS = 10
DEFAULT_NUM_RETRIES = 5
DEFAULT_REQUEST_TIMEOUT_SECONDS = 60

# The most results arXiv will return for one query, and therefore the most any
# caller can usefully ask ``arxiv.Search`` for. This is the ceiling rather than a
# preference: the API user manual (§3.1.1.2) states that "the maximum number of
# results returned from a single call (max_results) is limited to 30000 in
# slices of at most 2000 at a time" and that "a request with max_results >30,000
# will result in an HTTP 400 error code". A larger limit is not a bigger fetch,
# it is a request the API declines.
#
# It lives here, beside ``DEFAULT_PAGE_SIZE`` and the clamp below, because this
# module is where every caller passes a limit into ``arxiv.Search``:
# ``paper-collector.py`` reaches ``iter_results`` through ``--max-papers`` and
# never touches ``build_index``, so a bound enforced only in the index builder
# would leave that path unbounded.
RESULTS_CEILING = 30000


class TimeoutNotInstalled(RuntimeError):
    """Raised when the request timeout could not be attached to a client."""


class TimeoutSession(requests.Session):
    """A ``requests.Session`` that bounds any request that omits a timeout.

    ``arxiv.Client`` issues its queries as ``self._session.get(url, ...)``, and
    ``requests.Session.get`` delegates straight to ``Session.request``, so
    overriding ``request`` is the one hook that covers the library's internal
    call without patching the client. The default is additive (``setdefault``),
    so a caller that passes its own timeout keeps it.

    ``requests`` applies the value per socket operation rather than to the
    request as a whole, so a server that dribbles one byte at a time can still
    outlast it. The workflow-level ``timeout-minutes`` on the index step is what
    bounds that case.
    """

    default_timeout = DEFAULT_REQUEST_TIMEOUT_SECONDS

    def request(self, *args, **kwargs):
        kwargs.setdefault("timeout", self.default_timeout)
        return super().request(*args, **kwargs)


def install_request_timeout(client, timeout=DEFAULT_REQUEST_TIMEOUT_SECONDS):
    """Bound every request ``client`` makes to ``timeout`` seconds.

    ``arxiv.Client.__init__`` takes only ``page_size``/``delay_seconds``/
    ``num_retries`` in 2.1.3 and in the 3.0.0 that CI resolves -- there is no
    timeout parameter -- and the constructor ends with a bare
    ``self._session = requests.Session()``. So ``Client._session`` is the only
    hook available.

    That attribute is PRIVATE and version-fragile, which makes this a floor and
    not a guarantee: if a future arxiv renames it or stops routing through the
    session, a plain assignment would create a dead attribute and the client
    would silently go back to running unbounded. So the session is located and
    type-checked first, and a missing one raises rather than degrading -- an
    unbounded request costs a whole runner's job limit, which is far worse than
    a build that fails loudly on an arxiv upgrade.
    """
    session = getattr(client, "_session", None)
    if not isinstance(session, requests.Session):
        raise TimeoutNotInstalled(
            "arxiv.Client has no requests.Session at '_session' (found %s), so "
            "this version of arxiv cannot be given a request timeout."
            % type(session).__name__
        )
    if not isinstance(session, TimeoutSession):
        # Swap the class on the library's own session instead of replacing the
        # object, so anything arxiv configured on it survives the hook.
        session.__class__ = TimeoutSession
    session.default_timeout = timeout
    return session


def build_client(max_results):
    """Create an arXiv client sized for ``max_results``, with bounded requests."""
    client = arxiv.Client(
        page_size=max(1, min(DEFAULT_PAGE_SIZE, max_results)),
        delay_seconds=DEFAULT_DELAY_SECONDS,
        num_retries=DEFAULT_NUM_RETRIES,
    )
    install_request_timeout(client, DEFAULT_REQUEST_TIMEOUT_SECONDS)
    return client


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

    ``max_results`` is clamped to :data:`RESULTS_CEILING` here rather than in a
    caller, because this is the only point every limit passes through on its way
    to ``arxiv.Search``; a bigger number buys nothing and is answered with an
    HTTP 400 part-way through paging. ``None`` still means "no limit", which the
    library resolves as "until the query is exhausted" -- that path ends on the
    same API ceiling, failing the category rather than hanging.
    """
    if status is not None:
        status.update(failed=False, error=None)
    if max_results is not None and max_results <= 0:
        return
    if max_results is not None and max_results > RESULTS_CEILING:
        logging.warning(
            "Capping %r results per query at %d: arXiv answers a request above "
            "that with HTTP 400.", max_results, RESULTS_CEILING,
        )
        max_results = RESULTS_CEILING

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
    except (arxiv.ArxivError, requests.exceptions.Timeout) as exc:
        # ``arxiv`` retries only ``HTTPError``, ``UnexpectedEmptyPageError``
        # and ``ConnectionError``, so the timeout added above escapes its retry
        # loop and lands here. Routing it through the same status holder is what
        # keeps a hung request on the same hard-fail path as a 5xx, and it
        # costs no extra requests: the timeout can only shorten a run.
        if status is not None:
            status.update(failed=True, error=str(exc))
        logging.error("ArXiv search failed for %r: %s", query, exc)
