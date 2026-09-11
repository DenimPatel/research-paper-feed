import importlib.util
import os
import unittest
from types import SimpleNamespace

MODULE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "scripts", "arxiv_common.py"
)


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


if __name__ == "__main__":
    unittest.main()
