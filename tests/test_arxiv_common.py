import importlib.util
import os
import re
import socket
import threading
import time
import unittest
from types import SimpleNamespace

import arxiv
import requests

MODULE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "scripts", "arxiv_common.py"
)

# The workflows that run ``scripts/build_index.py``, and therefore the ones
# whose ``timeout-minutes`` caps have to outlast the client timeout below.
WORKFLOW_DIR = os.path.join(
    os.path.dirname(__file__), "..", ".github", "workflows"
)
WORKFLOWS = ("ci.yml", "deploy.yml")
TIMEOUT_KEY = re.compile(r"timeout-minutes:")
TIMEOUT_VALUE = re.compile(r"^\s*timeout-minutes:\s*(\d+)\s*(?:#.*)?$")


def workflow_timeouts():
    """Every ``timeout-minutes`` set in those workflows, plus any unreadable one.

    Returned as ``[(filename, line number, minutes), ...]`` and
    ``[(filename, line number, source line), ...]``.

    The YAML is read as text rather than parsed because PyYAML is not one of
    this repo's dependencies, so a test that imported it would fail in CI, where
    ``pip install -r requirements.txt`` is all that gets installed. A scalar
    mapping key on its own line is as stable as it looks, and reporting the
    unreadable lines turns a silent miss into a failure.
    """
    found = []
    unreadable = []
    for name in WORKFLOWS:
        with open(os.path.join(WORKFLOW_DIR, name), encoding="utf-8") as handle:
            for number, line in enumerate(handle, start=1):
                if not TIMEOUT_KEY.search(line):
                    continue
                match = TIMEOUT_VALUE.match(line)
                if match:
                    found.append((name, number, int(match.group(1))))
                else:
                    unreadable.append((name, number, line.rstrip()))
    return found, unreadable


def load_module():
    spec = importlib.util.spec_from_file_location("arxiv_common", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


arxiv_common = load_module()


class FakeArxivError(Exception):
    pass


class FakeClient:
    """Stands in for ``arxiv.Client`` and yields a fixed result list."""

    def __init__(self, results, error_after=None):
        self._results = results
        self._error_after = error_after

    def results(self, search):
        for index, result in enumerate(self._results):
            if self._error_after is not None and index >= self._error_after:
                raise FakeArxivError("simulated arXiv failure")
            yield result


class IterResultsTests(unittest.TestCase):
    def setUp(self):
        self.original_arxiv = arxiv_common.arxiv
        self.original_build_client = arxiv_common.build_client
        self.search_kwargs = {}

    def tearDown(self):
        arxiv_common.arxiv = self.original_arxiv
        arxiv_common.build_client = self.original_build_client

    def _install(self, results, error_after=None, client_sizes=None):
        def fake_search(**kwargs):
            self.search_kwargs.update(kwargs)
            return object()

        def fake_build_client(size):
            if client_sizes is not None:
                client_sizes.append(size)
            return FakeClient(results, error_after=error_after)

        arxiv_common.arxiv = SimpleNamespace(
            Search=fake_search,
            SortCriterion=SimpleNamespace(SubmittedDate="submittedDate"),
            SortOrder=SimpleNamespace(Descending="descending"),
            ArxivError=FakeArxivError,
        )
        arxiv_common.build_client = fake_build_client

    def test_passes_max_results_through_to_search(self):
        # Regression: arxiv.Search defaults max_results to 100, so omitting it
        # silently caps every query to one page.
        self._install([object()])
        list(arxiv_common.iter_results("cat:cs.CV", 5000))
        self.assertEqual(self.search_kwargs["max_results"], 5000)

    def test_unlimited_queries_pass_none_and_use_default_page_size(self):
        sizes = []
        self._install([object()] * 5, client_sizes=sizes)
        results = list(arxiv_common.iter_results("cat:cs.CV", None))
        self.assertEqual(len(results), 5)
        self.assertIsNone(self.search_kwargs["max_results"])
        self.assertEqual(sizes, [arxiv_common.DEFAULT_PAGE_SIZE])

    def test_stops_after_max_results(self):
        sizes = []
        self._install([object()] * 10, client_sizes=sizes)
        results = list(arxiv_common.iter_results("cat:cs.CV", 3))
        self.assertEqual(len(results), 3)
        self.assertEqual(sizes, [3])

    def test_non_positive_max_results_short_circuits(self):
        def fail_build_client(size):  # pragma: no cover - must not be called
            raise AssertionError("client should not be built")

        arxiv_common.build_client = fail_build_client
        self.assertEqual(list(arxiv_common.iter_results("cat:cs.CV", 0)), [])
        self.assertEqual(list(arxiv_common.iter_results("cat:cs.CV", -5)), [])

    def test_arxiv_errors_terminate_iteration_without_raising(self):
        self._install([object(), object()], error_after=2)
        results = list(arxiv_common.iter_results("cat:cs.CV", 100))
        self.assertEqual(len(results), 2)

    def test_status_holder_reports_a_failed_query(self):
        self._install([object()] * 3, error_after=2)
        status = arxiv_common.new_status()
        results = list(arxiv_common.iter_results("cat:cs.CV", 100, status))
        self.assertEqual(len(results), 2)
        self.assertTrue(status["failed"])
        self.assertIn("simulated arXiv failure", status["error"])

    def test_status_holder_reports_an_exhausted_query(self):
        self._install([object()] * 2)
        status = arxiv_common.new_status()
        list(arxiv_common.iter_results("cat:cs.CV", 100, status))
        self.assertFalse(status["failed"])
        self.assertIsNone(status["error"])

    def test_status_holder_is_reset_for_each_query(self):
        self._install([object()] * 3, error_after=1)
        status = arxiv_common.new_status()
        list(arxiv_common.iter_results("cat:cs.LG", 100, status))
        self.assertTrue(status["failed"])
        self._install([object()] * 3)
        list(arxiv_common.iter_results("cat:cs.CV", 100, status))
        self.assertFalse(status["failed"])
        self.assertIsNone(status["error"])


class RecordingAdapter(requests.adapters.BaseAdapter):
    """Transport adapter that records the ``timeout`` it is handed."""

    def __init__(self):
        super().__init__()
        self.timeouts = []

    def send(self, request, **kwargs):
        self.timeouts.append(kwargs.get("timeout"))
        response = requests.Response()
        response.status_code = 200
        response.url = request.url
        response.request = request
        response._content = b""
        return response

    def close(self):
        pass


class BlackHoleServer:
    """Loopback server that accepts connections and never sends a response.

    Loopback only: it binds ``127.0.0.1`` on an ephemeral port and resolves
    no name, so it reaches no external host. It is here because no mock can
    show that a *hang* is bounded -- a mock can only show a kwarg was set.
    """

    def __init__(self):
        self._socket = socket.socket()
        self._socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._socket.bind(("127.0.0.1", 0))
        self._socket.listen(5)
        self.port = self._socket.getsockname()[1]
        self.connections = 0
        self._held = []
        self._closing = False
        self._thread = threading.Thread(target=self._accept, daemon=True)
        self._thread.start()

    def url_format(self):
        return "http://127.0.0.1:%d/api/query?{}" % self.port

    def _accept(self):
        self._socket.settimeout(0.05)
        while not self._closing:
            try:
                connection, _ = self._socket.accept()
            except socket.timeout:
                continue
            except OSError:
                return
            self._held.append(connection)
            self.connections += 1

    def close(self):
        self._closing = True
        self._thread.join(timeout=2)
        for connection in self._held:
            try:
                connection.close()
            except OSError:
                pass
        self._socket.close()


class BuildClientTests(unittest.TestCase):
    def test_build_client_installs_the_default_request_timeout(self):
        client = arxiv_common.build_client(25)
        self.assertIsInstance(client._session, arxiv_common.TimeoutSession)
        self.assertEqual(
            client._session.default_timeout,
            arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS,
        )

    def test_build_client_keeps_the_arxiv_pacing_parameters_pinned(self):
        # Pinned to literal values on purpose. These are load-bearing against
        # arXiv's rate limit and terms of use, so the test would be vacuous if
        # it compared the client against the module constants: any change to
        # both would still pass.
        client = arxiv_common.build_client(5000)
        self.assertEqual(client.page_size, 1000)
        self.assertEqual(client.delay_seconds, 10)
        self.assertEqual(client.num_retries, 5)

    def test_the_request_timeout_value_is_pinned(self):
        # Also a literal, and also on purpose. Every other timeout test compares
        # the client against DEFAULT_REQUEST_TIMEOUT_SECONDS, so 60 and 600 are
        # equally "correct" to them -- nothing here constrains the number, only
        # that it reaches the wire.
        #
        # 60 s is chosen because the workflow caps are sized against it. Both
        # index steps are allowed 2.5x the worst case this value produces (see
        # WorkflowTimeoutTests), and a real arXiv page arrives in ~0.3 s, so 60 s
        # is ~180x the happy path -- loose enough that a page_size=1000 fetch of
        # several MB is never killed mid-transfer. Raising it silently outgrows
        # the caps; lowering it can kill a legitimately slow fetch.
        self.assertEqual(arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS, 60)

    def test_page_size_is_still_capped_to_the_requested_max_results(self):
        self.assertEqual(arxiv_common.build_client(5).page_size, 5)

    def test_install_keeps_the_library_session_object_and_is_idempotent(self):
        client = arxiv_common.build_client(5)
        session = client._session
        arxiv_common.install_request_timeout(client, 3)
        self.assertIs(client._session, session)
        self.assertEqual(session.default_timeout, 3)

    def test_install_raises_when_the_library_drops_the_session_hook(self):
        client = arxiv.Client(page_size=5)
        del client._session
        with self.assertRaises(arxiv_common.TimeoutNotInstalled) as caught:
            arxiv_common.install_request_timeout(client)
        self.assertIn("_session", str(caught.exception))


class RequestTimeoutTests(unittest.TestCase):
    """The bound has to sit on the request, not just on the constructor."""

    def test_timeout_reaches_the_transport_layer(self):
        client = arxiv_common.build_client(5)
        adapter = RecordingAdapter()
        client._session.mount("http://", adapter)
        client._session.get("http://127.0.0.1:1/api/query")
        self.assertEqual(
            adapter.timeouts, [arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS]
        )

    def test_a_caller_supplied_timeout_is_not_overridden(self):
        client = arxiv_common.build_client(5)
        adapter = RecordingAdapter()
        client._session.mount("http://", adapter)
        client._session.get("http://127.0.0.1:1/api/query", timeout=7)
        self.assertEqual(adapter.timeouts, [7])


class WorkflowTimeoutTests(unittest.TestCase):
    """The workflow caps have to outlast the client, or IMP-004 never reports.

    A cap tighter than the client's own worst case would kill the step on
    GitHub's generic timeout instead of letting ``build_index.py`` print which
    category failed and exit 1, so the diagnosis of a network problem would be
    replaced by "the job timed out". Every cap in these two workflows is held
    above that worst case.

    This rule is deliberately conservative -- it says *no* cap may be tighter
    than one page's worst case. If a future change adds a short cap for an
    unrelated fast step, narrow this rule to the index-build steps rather than
    deleting it.
    """

    def test_no_workflow_cap_is_tighter_than_the_client_worst_case(self):
        found, unreadable = workflow_timeouts()
        self.assertEqual(
            unreadable,
            [],
            "a timeout-minutes could not be read; update workflow_timeouts()",
        )
        self.assertTrue(found, "no timeout-minutes found in ci.yml / deploy.yml")
        for name in WORKFLOWS:
            self.assertTrue(
                [entry for entry in found if entry[0] == name],
                "%s sets no timeout-minutes at all, so the run it performs is "
                "bounded only by GitHub's 360 minute default" % name,
            )

        # Worst case for one page fetch. arxiv retries a ConnectTimeout
        # num_retries times, and does not space those retries with
        # delay_seconds: it records _last_request_dt only after a *successful*
        # get, so the pacing branch is skipped every time a request raises. The
        # attempts therefore land back to back, 6 x 60 s, measured 360.08 s.
        worst_case = (
            arxiv_common.DEFAULT_NUM_RETRIES + 1
        ) * arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS
        self.assertEqual(worst_case, 360)

        for name, number, minutes in found:
            self.assertGreater(
                minutes * 60,
                worst_case,
                "%s:%d caps a step at %d min (%d s), but the client can spend "
                "%d s failing a single page, so GitHub would cancel the step "
                "before build_index.py could name the category that failed."
                % (name, number, minutes, minutes * 60, worst_case),
            )


class BlackHoleRequestTests(unittest.TestCase):
    """A request that is never answered has to end at the timeout."""

    def setUp(self):
        original_timeout = arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS
        original_url_format = arxiv.Client.query_url_format
        self.addCleanup(
            setattr,
            arxiv_common,
            "DEFAULT_REQUEST_TIMEOUT_SECONDS",
            original_timeout,
        )
        self.addCleanup(
            setattr, arxiv.Client, "query_url_format", original_url_format
        )
        arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS = 1

    def test_a_hung_request_fails_at_the_timeout_without_hanging(self):
        hole = BlackHoleServer()
        self.addCleanup(hole.close)
        arxiv.Client.query_url_format = hole.url_format()

        status = arxiv_common.new_status()
        outcome = {}

        def query():
            try:
                outcome["results"] = list(
                    arxiv_common.iter_results("cat:cs.CV", 5, status)
                )
            except BaseException as exc:  # noqa: BLE001 - reported below
                outcome["error"] = exc

        started = time.monotonic()
        worker = threading.Thread(target=query, daemon=True)
        worker.start()
        # Joins with a bound so a client that regressed to an unbounded
        # request fails this assertion instead of hanging the whole suite.
        worker.join(timeout=20)
        elapsed = time.monotonic() - started

        self.assertFalse(worker.is_alive(), "the arXiv request never returned")
        self.assertNotIn("error", outcome, str(outcome.get("error")))
        self.assertEqual(outcome["results"], [])
        self.assertTrue(status["failed"])
        self.assertGreaterEqual(elapsed, 0.9)
        self.assertLess(elapsed, 20)
        # A timeout must never add requests: arxiv does not retry a read
        # timeout, so exactly one connection was made.
        self.assertEqual(hole.connections, 1)


if __name__ == "__main__":
    unittest.main()
