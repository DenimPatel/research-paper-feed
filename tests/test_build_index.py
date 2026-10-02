import contextlib
import importlib.util
import io
import json
import os
import re
import unittest
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

MODULE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "scripts", "build_index.py"
)
DEPLOY_PATH = os.path.join(
    os.path.dirname(__file__), "..", ".github", "workflows", "deploy.yml"
)
# Flags on the deploy step's own command are allowed: the explicit
# ``--max-per-category`` is the deliverable of IMP-204, and a matcher that only
# accepted a bare command would stop finding the step whose cap has to be
# checked (which is what the assertion in DeployStepTimeoutTests is for).
DEPLOY_INDEX_RUN = re.compile(r"^\s*run:\s*python scripts/build_index\.py(?:\s|$)")
MAX_PER_CATEGORY_FLAG = re.compile(r"--max-per-category\s+(\d+)")
TIMEOUT_LINE = re.compile(r"^\s*timeout-minutes:\s*(\d+)\s*(?:#.*)?$")

# arXiv's API user manual (§3.1.1.2): a query is limited to 30,000 results,
# returned "in slices of at most 2000 at a time", and a request asking for more
# than 30,000 is answered with HTTP 400. Pinned here as literals rather than
# read off the module, so a bound raised above either one fails.
ARXIV_RESULTS_PER_QUERY = 30000
ARXIV_RESULTS_PER_SLICE = 2000


def requested_pages(limit, page_size):
    """The ``(start, max_results)`` pairs ``arxiv.Client`` would request.

    ``Client._results`` asks for ``page_size`` results at ``start``, then
    advances ``start`` by the size of the page it received, and ``_format_url``
    writes that pair straight into the query URL. A feed that keeps returning
    full pages therefore produces exactly this sequence, and it is the largest
    one a run can produce for ``limit``. Mirrored here so the ceiling can be
    asserted without opening a socket.
    """
    start = 0
    while start < limit:
        yield start, page_size
        start += page_size


def load_module():
    spec = importlib.util.spec_from_file_location("build_index", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


build_index = load_module()


def make_record(paper_id, published, categories=None, **overrides):
    categories = categories or ["cs.CV"]
    record = {
        "id": paper_id,
        "title": f"Title {paper_id}",
        "authors": ["A"],
        "abstract": "abstract",
        "abstractTruncated": False,
        "published": published,
        "updated": published,
        "categories": list(categories),
        "primaryCategory": categories[0],
        "absUrl": f"https://arxiv.org/abs/{paper_id}",
        "pdfUrl": f"https://arxiv.org/pdf/{paper_id}",
    }
    record.update(overrides)
    return record


def make_result(paper_id, published=None, categories=None):
    published = published or datetime.now(timezone.utc)
    categories = categories or ["cs.CV"]
    return SimpleNamespace(
        entry_id=f"http://arxiv.org/abs/{paper_id}v1",
        title=f"Title {paper_id}",
        authors=[SimpleNamespace(name="A")],
        summary="abstract",
        published=published,
        updated=published,
        categories=list(categories),
        primary_category=categories[0],
        pdf_url=f"https://arxiv.org/pdf/{paper_id}v1",
    )


class TruncateAbstractTests(unittest.TestCase):
    def test_short_abstract_unchanged_and_not_flagged(self):
        text, truncated = build_index.truncate_abstract("  hello   world ", 50)
        self.assertEqual(text, "hello world")
        self.assertFalse(truncated)

    def test_long_abstract_is_capped_and_flagged(self):
        abstract = "abcdefghij" * 10
        text, truncated = build_index.truncate_abstract(abstract, 25)
        self.assertTrue(truncated)
        self.assertTrue(text.startswith("abcdefghij"))
        self.assertTrue(text.endswith("\u2026"))
        self.assertLessEqual(len(text), 26)


class FormatAuthorsTests(unittest.TestCase):
    def test_caps_and_appends_et_al(self):
        authors = [SimpleNamespace(name=f"Author {i}") for i in range(10)]
        names = build_index.format_authors(authors, max_authors=8)
        self.assertEqual(len(names), 9)
        self.assertEqual(names[-1], "et al.")
        self.assertEqual(names[0], "Author 0")

    def test_short_list_unchanged(self):
        authors = [SimpleNamespace(name="Ada"), SimpleNamespace(name="Grace")]
        self.assertEqual(build_index.format_authors(authors), ["Ada", "Grace"])


class ArxivIdTests(unittest.TestCase):
    def test_strips_url_and_version(self):
        self.assertEqual(
            build_index.arxiv_id_from_entry("http://arxiv.org/abs/2401.12345v2"),
            "2401.12345",
        )

    def test_handles_missing_version(self):
        self.assertEqual(
            build_index.arxiv_id_from_entry("https://arxiv.org/abs/2401.12345"),
            "2401.12345",
        )


class IsoWeekTests(unittest.TestCase):
    def test_computes_iso_week(self):
        self.assertEqual(build_index.iso_week_key("2024-01-08"), "2024-W02")

    def test_handles_year_boundary(self):
        self.assertEqual(build_index.iso_week_key("2023-01-01"), "2022-W52")


class DedupeRecordsTests(unittest.TestCase):
    def test_merges_cross_listed_papers_by_id(self):
        records = [
            make_record("2401.00001", "2024-01-08", ["cs.CV"]),
            make_record("2401.00002", "2024-01-08", ["cs.LG"]),
            make_record("2401.00001", "2024-01-08", ["cs.LG", "cs.AI"]),
        ]
        merged = build_index.dedupe_records(records)
        self.assertEqual(len(merged), 2)
        self.assertEqual(merged[0]["id"], "2401.00001")
        self.assertEqual(
            merged[0]["categories"], ["cs.CV", "cs.LG", "cs.AI"]
        )

    def test_preserves_first_seen_metadata(self):
        records = [
            make_record("2401.00001", "2024-01-08", ["cs.CV"], title="First"),
            make_record("2401.00001", "2024-01-08", ["cs.LG"], title="Second"),
        ]
        merged = build_index.dedupe_records(records)
        self.assertEqual(merged[0]["title"], "First")


class BuildShardsTests(unittest.TestCase):
    def setUp(self):
        self.records = [
            make_record("2401.00001", "2024-01-08"),
            make_record("2401.00002", "2024-01-09"),
            make_record("2312.00001", "2023-12-31"),
        ]
        self.generated_at = datetime(2024, 1, 10, 12, 0, tzinfo=timezone.utc)
        self.manifest, self.files = build_index.build_shards(
            self.records,
            generated_at=self.generated_at,
            retention_days=30,
            categories=["cs.CV"],
        )

    def test_manifest_shape_and_totals(self):
        self.assertEqual(
            self.manifest["generatedAt"], "2024-01-10T12:00:00Z"
        )
        self.assertEqual(self.manifest["retentionDays"], 30)
        self.assertEqual(self.manifest["categories"], ["cs.CV"])
        self.assertEqual(self.manifest["totalPapers"], 3)
        self.assertEqual(
            sum(s["count"] for s in self.manifest["shards"]), 3
        )

    def test_shards_are_newest_first(self):
        weeks = [s["week"] for s in self.manifest["shards"]]
        self.assertEqual(weeks, ["2024-W02", "2023-W52"])

    def test_shard_bounds_and_files(self):
        week_two = next(
            s for s in self.manifest["shards"] if s["week"] == "2024-W02"
        )
        self.assertEqual(week_two["from"], "2024-01-08")
        self.assertEqual(week_two["to"], "2024-01-09")
        self.assertEqual(week_two["count"], 2)
        self.assertEqual(week_two["file"], "papers-2024-W02.json")
        self.assertIn("papers-2024-W02.json", self.files)

    def test_records_sorted_newest_first_within_shard(self):
        papers = self.files["papers-2024-W02.json"]["papers"]
        self.assertEqual(
            [p["id"] for p in papers], ["2401.00002", "2401.00001"]
        )


class RecordFromResultTests(unittest.TestCase):
    def test_builds_public_record_shape(self):
        result = SimpleNamespace(
            entry_id="http://arxiv.org/abs/2401.12345v1",
            title="  A   Great\nPaper ",
            authors=[SimpleNamespace(name=f"Author {i}") for i in range(9)],
            summary="x" * 600,
            published=datetime(2024, 1, 8, 5, 0, tzinfo=timezone.utc),
            updated=datetime(2024, 1, 9, 6, 0, tzinfo=timezone.utc),
            categories=["cs.CV", "cs.LG"],
            primary_category="cs.CV",
            pdf_url="http://arxiv.org/pdf/2401.12345v1",
        )
        record = build_index.record_from_result(result, abstract_chars=500)
        self.assertEqual(record["id"], "2401.12345")
        self.assertEqual(record["title"], "A Great Paper")
        self.assertEqual(len(record["authors"]), 9)
        self.assertEqual(record["authors"][-1], "et al.")
        self.assertEqual(record["published"], "2024-01-08")
        self.assertEqual(record["updated"], "2024-01-09")
        self.assertEqual(record["categories"], ["cs.CV", "cs.LG"])
        self.assertEqual(record["primaryCategory"], "cs.CV")
        self.assertTrue(record["abstractTruncated"])
        self.assertEqual(record["absUrl"], "http://arxiv.org/abs/2401.12345v1")


class WriteIndexTests(unittest.TestCase):
    def test_writes_manifest_and_removes_stale_shards(self):
        import tempfile

        with tempfile.TemporaryDirectory() as out_dir:
            stale = os.path.join(out_dir, "papers-2020-W01.json")
            with open(stale, "w", encoding="utf-8") as handle:
                handle.write("[]")

            records = [make_record("2401.00001", "2024-01-08")]
            manifest, files = build_index.build_shards(
                records,
                generated_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
            )
            manifest_path = build_index.write_index(out_dir, manifest, files)

            self.assertFalse(os.path.exists(stale))
            self.assertTrue(os.path.exists(manifest_path))
            with open(manifest_path, encoding="utf-8") as handle:
                loaded = json.load(handle)
            self.assertEqual(loaded["totalPapers"], 1)
            self.assertTrue(
                os.path.exists(os.path.join(out_dir, "papers-2024-W02.json"))
            )


class WriteIndexOrderingTests(unittest.TestCase):
    def test_deployed_shards_survive_a_failure_mid_write(self):
        import tempfile

        with tempfile.TemporaryDirectory() as out_dir:
            deployed = os.path.join(out_dir, "papers-2023-W52.json")
            with open(deployed, "w", encoding="utf-8") as handle:
                json.dump({"papers": [{"id": "2312.00001"}]}, handle)
            manifest_path = os.path.join(out_dir, "index.json")
            with open(manifest_path, "w", encoding="utf-8") as handle:
                json.dump({"shards": [{"file": "papers-2023-W52.json"}]}, handle)

            records = [make_record("2401.00001", "2024-01-08")]
            manifest, files = build_index.build_shards(
                records,
                generated_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
            )

            original_dump = build_index.json.dump

            def failing_dump(*args, **kwargs):
                raise OSError("simulated crash mid-write")

            build_index.json.dump = failing_dump
            try:
                with self.assertRaises(OSError):
                    build_index.write_index(out_dir, manifest, files)
            finally:
                build_index.json.dump = original_dump

            self.assertTrue(os.path.exists(deployed))
            with open(deployed, encoding="utf-8") as handle:
                self.assertEqual(
                    json.load(handle)["papers"][0]["id"], "2312.00001"
                )
            with open(manifest_path, encoding="utf-8") as handle:
                self.assertEqual(
                    json.load(handle)["shards"][0]["file"], "papers-2023-W52.json"
                )

    def test_same_week_shard_from_a_previous_run_is_kept(self):
        import tempfile

        with tempfile.TemporaryDirectory() as out_dir:
            previous = os.path.join(out_dir, "papers-2024-W02.json")
            with open(previous, "w", encoding="utf-8") as handle:
                json.dump({"papers": [{"id": "2401.00009"}]}, handle)

            records = [make_record("2401.00001", "2024-01-08")]
            manifest, files = build_index.build_shards(
                records,
                generated_at=datetime(2024, 1, 10, tzinfo=timezone.utc),
            )
            build_index.write_index(out_dir, manifest, files)

            self.assertTrue(os.path.exists(previous))
            with open(previous, encoding="utf-8") as handle:
                self.assertEqual(json.load(handle)["papers"][0]["id"], "2401.00001")


class CollectPapersTests(unittest.TestCase):
    def setUp(self):
        self.original = build_index.arxiv_common.iter_results

    def tearDown(self):
        build_index.arxiv_common.iter_results = self.original

    def _install(self, results_by_category, failing=()):
        def fake_iter_results(query, max_results, status=None):
            category = query.split(":", 1)[-1]
            if category in failing:
                if status is not None:
                    status.update(failed=True, error="simulated arXiv failure")
                return
            for result in results_by_category.get(category, []):
                yield result

        build_index.arxiv_common.iter_results = fake_iter_results

    def test_records_failed_categories_separately_from_records(self):
        self._install(
            {"cs.CV": [make_result("2401.00001")]},
            failing=["cs.LG"],
        )
        failures = []
        records = build_index.collect_papers(
            ["cs.CV", "cs.LG"], 60, 0, 500, failures
        )
        self.assertEqual([record["id"] for record in records], ["2401.00001"])
        self.assertEqual(failures, ["cs.LG"])

    def test_healthy_categories_report_no_failures(self):
        self._install({"cs.CV": [make_result("2401.00001")]})
        failures = []
        records = build_index.collect_papers(["cs.CV"], 60, 0, 500, failures)
        self.assertEqual(failures, [])
        self.assertEqual(len(records), 1)

    def test_failures_list_is_optional(self):
        self._install({}, failing=["cs.CV"])
        self.assertEqual(build_index.collect_papers(["cs.CV"], 60, 0, 500), [])

    def test_arxiv_error_raised_by_iter_results_is_classified_as_failure(self):
        arxiv_error = build_index.arxiv_common.arxiv.ArxivError

        def raising_iter_results(query, max_results, status=None):
            raise arxiv_error(
                "https://export.arxiv.org/api/query", 0, "simulated outage"
            )
            yield  # pragma: no cover - unreachable, makes this a generator

        build_index.arxiv_common.iter_results = raising_iter_results
        failures = []
        records = build_index.collect_papers(["cs.CV"], 60, 0, 500, failures)
        self.assertEqual(records, [])
        self.assertEqual(failures, ["cs.CV"])


class CollectPapersRetentionTests(unittest.TestCase):
    """Retention is a per-record filter, not an ordered ``break``.

    A result whose ``published`` is not a ``datetime`` used to fail the
    ``is not None`` guard and be kept regardless of age -- a string
    ``"2001-01-01"`` produced a ``papers-2001-W01.json`` shard inside a 60-day
    index -- and the ``break`` that dropped old records did so only while
    results arrived newest-first.
    """

    RETENTION_DAYS = 60

    def setUp(self):
        self.original = build_index.arxiv_common.iter_results
        self.now = datetime.now(timezone.utc)
        self.stale = self.now - timedelta(days=365)

    def tearDown(self):
        build_index.arxiv_common.iter_results = self.original

    def _install(self, results):
        def fake_iter_results(query, max_results, status=None):
            for result in results:
                yield result

        build_index.arxiv_common.iter_results = fake_iter_results

    def _collect(self, **kwargs):
        failures = []
        records = build_index.collect_papers(
            ["cs.CV"], self.RETENTION_DAYS, 0, 500, failures, **kwargs
        )
        self.assertEqual(failures, [])
        return records

    def test_only_fresh_records_survive_out_of_order_iteration(self):
        # Newest, then oldest, then a record that is not a datetime at all, and
        # then a fresh one again: the last result is the one the old ordered
        # ``break`` threw away, so it is what makes this test fail without the
        # per-record filter.
        self._install([
            make_result("2401.00001", self.now),
            make_result("2401.00002", self.stale),
            make_result("2401.00003", "2001-01-01"),
            make_result("2401.00004", self.now - timedelta(days=1)),
        ])
        records = self._collect()
        self.assertEqual(
            [record["id"] for record in records],
            ["2401.00001", "2401.00004"],
        )
        cutoff = (self.now - timedelta(days=self.RETENTION_DAYS)).date()
        for record in records:
            with self.subTest(record=record["id"]):
                self.assertGreaterEqual(
                    build_index.iso_date(record["published"]), cutoff.isoformat()
                )

    def test_result_without_a_datetime_published_is_dropped(self):
        self._install([
            make_result("2001.00001", "2001-01-01"),
            make_result("2401.00002", self.now),
        ])
        records = self._collect()
        self.assertEqual([record["id"] for record in records], ["2401.00002"])
        _, shard_files = build_index.build_shards(records, generated_at=self.now)
        self.assertNotIn("papers-2001-W01.json", shard_files)
        self.assertEqual(len(shard_files), 1)

    def test_undated_results_are_excluded_from_the_reported_count(self):
        self._install([
            make_result("2001.00001", "2001-01-01"),
            make_result("2001.00002", "not-a-date"),
            make_result("2401.00003", self.now),
        ])
        with self.assertLogs(level="INFO") as captured:
            records = self._collect()
        self.assertEqual([record["id"] for record in records], ["2401.00003"])
        log = "\n".join(captured.output)
        self.assertIn("1 papers within retention window for cs.CV", log)
        self.assertIn("dropped 2 result", log)

    def test_newest_first_assumption_only_stops_the_stream(self):
        yielded = []

        def recording_iter_results(query, max_results, status=None):
            for result in (make_result("2401.00001", self.stale),
                           make_result("2401.00002", self.now)):
                yielded.append(result)
                yield result

        build_index.arxiv_common.iter_results = recording_iter_results
        failures = []
        records = build_index.collect_papers(
            ["cs.CV"], self.RETENTION_DAYS, 0, 500, failures,
            assume_newest_first=True,
        )
        self.assertEqual(records, [])
        self.assertEqual(len(yielded), 1)
        self.assertEqual(failures, [])


class QueryCeilingTests(unittest.TestCase):
    """The bound handed to arXiv must be one the API will actually serve.

    ``--max-per-category 0`` is the default and the value the index build used
    to run the deploy with, so it has to resolve to a reachable bound: arXiv
    caps one query at 30,000 results, refuses to serve the offsets past it, and
    answers a larger request with HTTP 400. A constant above that is not a
    limit, it is a promise the API declines to keep.
    """

    def setUp(self):
        self.original = build_index.arxiv_common.iter_results

    def tearDown(self):
        build_index.arxiv_common.iter_results = self.original

    def _limit_handed_to_iter_results(self, max_per_category):
        captured = []

        def fake_iter_results(query, max_results, status=None):
            captured.append(max_results)
            return iter(())

        build_index.arxiv_common.iter_results = fake_iter_results
        build_index.collect_papers(["cs.CV"], 60, max_per_category, 500, [])
        return captured

    def test_the_uncapped_default_is_the_documented_ceiling(self):
        self.assertEqual(self._limit_handed_to_iter_results(0), [30000])
        self.assertEqual(build_index.UNLIMITED, 30000)

    def test_a_cap_above_the_ceiling_is_clamped_instead_of_paging_past_it(self):
        # Otherwise --max-per-category 100000 rebuilds the unreachable bound as
        # a flag value, on the same query, with the same HTTP 400 waiting.
        self.assertEqual(
            self._limit_handed_to_iter_results(100000), [ARXIV_RESULTS_PER_QUERY]
        )

    def test_a_cap_below_the_ceiling_is_passed_through(self):
        self.assertEqual(self._limit_handed_to_iter_results(300), [300])

    def test_no_single_request_exceeds_the_slice_or_the_window(self):
        page_size = build_index.arxiv_common.build_client(
            build_index.UNLIMITED
        ).page_size
        self.assertLessEqual(page_size, ARXIV_RESULTS_PER_SLICE)
        pages = list(requested_pages(build_index.UNLIMITED, page_size))
        self.assertEqual(len(pages), 30)
        for start, max_results in pages:
            with self.subTest(start=start):
                self.assertLessEqual(max_results, ARXIV_RESULTS_PER_SLICE)
                self.assertLessEqual(
                    start + max_results, ARXIV_RESULTS_PER_QUERY
                )


class MainTests(unittest.TestCase):
    def test_refuses_to_write_an_empty_index(self):
        import tempfile

        original = build_index.collect_papers
        build_index.collect_papers = lambda *args, **kwargs: []
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                exit_code = build_index.main(["--out-dir", out_dir])
                self.assertEqual(exit_code, 1)
                self.assertFalse(
                    os.path.exists(os.path.join(out_dir, "index.json"))
                )
        finally:
            build_index.collect_papers = original

    def test_a_failed_category_no_longer_discards_the_others(self):
        """The deliberate rewrite of IMP-004's guarantee (IMP-204 criterion 2).

        IMP-004 made *any* failed category fatal, because a truncated index is
        indistinguishable from a complete one once deployed. That is still
        fatal when every category fails -- the next test pins that. But one
        category dying mid-paging used to throw away the four that succeeded,
        which is how a single deep-offset 500 emptied the weekly deploy: exit 1,
        no out-dir, and a live site left on the previous week's index.

        The shortfall is now published *and* labelled: the manifest names the
        category that failed, and the failure is logged at ERROR. The exit code
        stays 0 on purpose -- a non-zero exit fails the deploy step, which
        throws away the index it just wrote and reproduces the stale live site
        this item exists to remove.
        """
        import tempfile

        arxiv_error = build_index.arxiv_common.arxiv.ArxivError
        original = build_index.arxiv_common.iter_results
        failed = build_index.DEFAULT_CATEGORIES[-1]

        def fake_iter_results(query, max_results, status=None):
            category = query.split(":", 1)[-1]
            if category == failed:
                # Pages answered, then a deep offset came back 500: the records
                # already yielded survive and the category is marked failed.
                yield make_result("2401.00009")
                raise arxiv_error(
                    "https://export.arxiv.org/api/query", 0, "simulated outage"
                )
            yield make_result(
                "2401.0000%d" % (build_index.DEFAULT_CATEGORIES.index(category) + 1)
            )

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                with self.assertLogs(level="ERROR") as captured:
                    exit_code = build_index.main(["--out-dir", out_dir])
                self.assertEqual(exit_code, 0)
                manifest_path = os.path.join(out_dir, "index.json")
                self.assertTrue(os.path.exists(manifest_path))
                with open(manifest_path, encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["failedCategories"], [failed])
                self.assertIn(failed, "\n".join(captured.output))
                # Only the categories that answered are advertised. Keeping the
                # failed one would put a chip in the site's filter that leads to
                # "No papers match the current filters" -- a false statement
                # about the reader's own filter, made because of an outage they
                # never caused. The notice names it instead.
                self.assertNotIn(failed, manifest["categories"])
                self.assertEqual(
                    manifest["categories"],
                    [
                        c for c in build_index.DEFAULT_CATEGORIES
                        if c != failed
                    ],
                )
                self.assertGreater(manifest["totalPapers"], 0)
                ids = set()
                for name in os.listdir(out_dir):
                    if not name.startswith("papers-"):
                        continue
                    with open(os.path.join(out_dir, name), encoding="utf-8") as handle:
                        ids.update(p["id"] for p in json.load(handle)["papers"])
                self.assertLessEqual(
                    {
                        "2401.00001", "2401.00002", "2401.00003", "2401.00004",
                    },
                    ids,
                )
        finally:
            build_index.arxiv_common.iter_results = original

    def test_refuses_to_write_index_when_every_category_query_fails(self):
        """IMP-004's guarantee, in the shape it was written for.

        This is the case the hard-fail exists for: a total outage produces no
        papers at all, and an empty index must never replace a deployed one.
        Degrading per category must not reach this far.
        """
        import tempfile

        arxiv_error = build_index.arxiv_common.arxiv.ArxivError
        original = build_index.arxiv_common.iter_results

        def fake_iter_results(query, max_results, status=None):
            raise arxiv_error(
                "https://export.arxiv.org/api/query", 0, "simulated outage"
            )
            yield  # pragma: no cover - unreachable, makes this a generator

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                with self.assertLogs(level="ERROR") as captured:
                    exit_code = build_index.main([
                        "--out-dir", out_dir,
                        "--category", "cs.CV",
                        "--category", "cs.LG",
                    ])
                self.assertEqual(exit_code, 1)
                self.assertEqual(os.listdir(out_dir), [])
                log = "\n".join(captured.output)
                self.assertIn("cs.CV", log)
                self.assertIn("cs.LG", log)
        finally:
            build_index.arxiv_common.iter_results = original

    def test_a_failed_category_is_still_fatal_when_nothing_else_has_papers(self):
        # Degrading writes a short index, never an empty one: the category that
        # answered produced nothing inside the retention window, so there is
        # nothing to publish and the reader is better served by the previous
        # deployment.
        import tempfile

        arxiv_error = build_index.arxiv_common.arxiv.ArxivError
        original = build_index.arxiv_common.iter_results
        stale = datetime.now(timezone.utc) - timedelta(days=365)

        def fake_iter_results(query, max_results, status=None):
            if query == "cat:cs.RO":
                raise arxiv_error(
                    "https://export.arxiv.org/api/query", 0, "simulated outage"
                )
            yield make_result("2001.00001", stale)

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                with self.assertLogs(level="ERROR") as captured:
                    exit_code = build_index.main([
                        "--out-dir", out_dir,
                        "--category", "cs.CV",
                        "--category", "cs.RO",
                    ])
                self.assertEqual(exit_code, 1)
                self.assertEqual(os.listdir(out_dir), [])
                self.assertIn("cs.RO", "\n".join(captured.output))
        finally:
            build_index.arxiv_common.iter_results = original

    def test_a_complete_index_records_no_failed_categories(self):
        # Absence is the signal, so the healthy manifest stays byte-for-byte
        # what a deployed index.json has always been: adding an always-present
        # empty list would have every existing reader treat a healthy index as
        # degraded.
        import tempfile

        original = build_index.arxiv_common.iter_results

        def fake_iter_results(query, max_results, status=None):
            yield make_result("2401.00001")

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                exit_code = build_index.main(["--out-dir", out_dir])
                self.assertEqual(exit_code, 0)
                manifest_path = os.path.join(out_dir, "index.json")
                with open(manifest_path, encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertNotIn("failedCategories", manifest)
                self.assertNotIn("truncatedCategories", manifest)
                self.assertEqual(
                    sorted(manifest),
                    [
                        "categories",
                        "generatedAt",
                        "retentionDays",
                        "shards",
                        "totalPapers",
                    ],
                )
        finally:
            build_index.arxiv_common.iter_results = original

    def test_a_category_that_spends_the_whole_allowance_is_recorded(self):
        """A cap-bound truncation must not be a silent one.

        A category that returns exactly ``limit`` results has no results left to
        prove there were not more, so the index says so. Without this the cap
        could start cutting papers off with nothing but a log line to show for
        it -- and unlike a failed query, a truncation never marks a category
        failed, so nothing else in the manifest would record it.
        """
        import tempfile

        original = build_index.arxiv_common.iter_results

        def fake_iter_results(query, max_results, status=None):
            for index in range(max_results):
                yield make_result("2401.%05d" % index)

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                with self.assertLogs(level="WARNING") as captured:
                    exit_code = build_index.main([
                        "--out-dir", out_dir,
                        "--category", "cs.AI",
                        "--max-per-category", "3",
                    ])
                self.assertEqual(exit_code, 0)
                manifest_path = os.path.join(out_dir, "index.json")
                with open(manifest_path, encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["truncatedCategories"], ["cs.AI"])
                # A truncated category still has papers behind it, so it stays
                # filterable; only a category with nothing is dropped.
                self.assertEqual(manifest["categories"], ["cs.AI"])
                self.assertNotIn("failedCategories", manifest)
                self.assertIn("cs.AI", "\n".join(captured.output))
                self.assertEqual(manifest["totalPapers"], 3)
        finally:
            build_index.arxiv_common.iter_results = original

    def test_a_category_short_of_the_allowance_is_not_recorded_as_truncated(self):
        # The control: spending the allowance is the only evidence there is, so
        # anything less than that must stay off the manifest or every run that
        # ends on a full page would claim to be incomplete.
        import tempfile

        original = build_index.arxiv_common.iter_results

        def fake_iter_results(query, max_results, status=None):
            yield make_result("2401.00001")

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                exit_code = build_index.main([
                    "--out-dir", out_dir,
                    "--category", "cs.AI",
                    "--max-per-category", "30000",
                ])
                self.assertEqual(exit_code, 0)
                manifest_path = os.path.join(out_dir, "index.json")
                with open(manifest_path, encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertNotIn("truncatedCategories", manifest)
        finally:
            build_index.arxiv_common.iter_results = original

    def test_writes_index_when_every_category_query_succeeds(self):
        import tempfile

        original = build_index.arxiv_common.iter_results

        def fake_iter_results(query, max_results, status=None):
            yield make_result(
                "2401.00001" if query == "cat:cs.CV" else "2401.00002"
            )

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                exit_code = build_index.main([
                    "--out-dir", out_dir,
                    "--category", "cs.CV",
                    "--category", "cs.LG",
                ])
                self.assertEqual(exit_code, 0)
                manifest_path = os.path.join(out_dir, "index.json")
                with open(manifest_path, encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["totalPapers"], 2)
                self.assertEqual(manifest["categories"], ["cs.CV", "cs.LG"])
        finally:
            build_index.arxiv_common.iter_results = original

    def test_writes_index_when_papers_exist(self):
        import tempfile

        records = [
            make_record("2401.00001", "2024-01-08"),
            make_record("2401.00002", "2024-01-09"),
        ]
        original = build_index.collect_papers
        build_index.collect_papers = lambda *args, **kwargs: records
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                exit_code = build_index.main(["--out-dir", out_dir])
                self.assertEqual(exit_code, 0)
                manifest_path = os.path.join(out_dir, "index.json")
                self.assertTrue(os.path.exists(manifest_path))
                with open(manifest_path, encoding="utf-8") as handle:
                    manifest = json.load(handle)
                self.assertEqual(manifest["totalPapers"], 2)
        finally:
            build_index.collect_papers = original


class ParseArgsValidationTests(unittest.TestCase):
    """Out-of-range and malformed values must be rejected, not reinterpreted.

    ``--retention-days 0`` used to make the cutoff now-or-future so the retention
    break fired on the first result, ``--abstract-chars -3`` switched truncation
    off, and ``--max-per-category -9`` silently meant unlimited.
    """

    def _assert_rejected(self, argv, flag, expected):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            with self.assertRaises(SystemExit) as raised:
                build_index.parse_args(argv)
        self.assertEqual(raised.exception.code, 2, argv)
        message = stderr.getvalue()
        self.assertIn(flag, message)
        self.assertIn(expected, message)

    def test_retention_days_below_one_is_rejected(self):
        for value in ("0", "-1", "-60"):
            with self.subTest(value=value):
                self._assert_rejected(
                    ["--retention-days", value],
                    "--retention-days",
                    "1 or greater",
                )

    def test_retention_days_must_be_a_whole_number(self):
        self._assert_rejected(
            ["--retention-days", "sixty"], "--retention-days", "whole number"
        )

    def test_abstract_chars_below_one_is_rejected(self):
        for value in ("0", "-3"):
            with self.subTest(value=value):
                self._assert_rejected(
                    ["--abstract-chars", value],
                    "--abstract-chars",
                    "1 or greater",
                )

    def test_max_per_category_below_zero_is_rejected(self):
        for value in ("-1", "-9"):
            with self.subTest(value=value):
                self._assert_rejected(
                    ["--max-per-category", value],
                    "--max-per-category",
                    "0 or greater",
                )

    def test_max_per_category_zero_still_means_no_cap(self):
        args = build_index.parse_args(["--max-per-category", "0"])
        self.assertEqual(args.max_per_category, 0)

    def test_defaults_are_unchanged(self):
        args = build_index.parse_args([])
        self.assertEqual(args.retention_days, 60)
        self.assertEqual(args.abstract_chars, 500)
        self.assertEqual(args.max_per_category, 0)
        self.assertEqual(args.out_dir, os.path.join("web", "public", "data"))

    def test_valid_values_are_accepted(self):
        args = build_index.parse_args([
            "--retention-days", "7",
            "--abstract-chars", "1",
            "--max-per-category", "2",
        ])
        self.assertEqual(args.retention_days, 7)
        self.assertEqual(args.abstract_chars, 1)
        self.assertEqual(args.max_per_category, 2)


class CategoryArgumentTests(unittest.TestCase):
    """A malformed category is a query arXiv answers with an empty feed."""

    def _assert_rejected(self, value):
        stderr = io.StringIO()
        with contextlib.redirect_stderr(stderr):
            with self.assertRaises(SystemExit) as raised:
                build_index.parse_args(["--category", value])
        self.assertEqual(raised.exception.code, 2, value)
        self.assertIn("--category", stderr.getvalue())
        self.assertIn(repr(value), stderr.getvalue())

    def test_real_category_forms_are_accepted(self):
        for value in ("cs.AI", "stat.ML", "astro-ph.HE", "cs", "astro-ph"):
            with self.subTest(value=value):
                self.assertEqual(
                    build_index.parse_args(["--category", value]).categories,
                    [value],
                )

    def test_malformed_categories_are_rejected(self):
        for value in (
            "cs.CV foo",
            "cs..CV",
            "cs.CV.BOGUS",
            "cs.CV;",
            "cat:cs.CV",
            "",
            "cs.CV\nfoo",
            "cs.CV AND ti:robot",
            "123",
        ):
            with self.subTest(value=value):
                self._assert_rejected(value)

    def test_repeated_categories_accumulate_in_order(self):
        args = build_index.parse_args(
            ["--category", "cs.CV", "--category", "cs.LG"]
        )
        self.assertEqual(args.categories, ["cs.CV", "cs.LG"])

    def test_categories_is_none_when_unset(self):
        self.assertIsNone(build_index.parse_args([]).categories)

    def test_main_does_not_query_arxiv_for_a_rejected_category(self):
        original = build_index.collect_papers
        build_index.collect_papers = lambda *args, **kwargs: self.fail(
            "collect_papers must not run when a category is rejected"
        )
        try:
            with contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    build_index.main(
                        ["--category", "cs.CV foo", "--out-dir", "unused"]
                    )
            self.assertEqual(raised.exception.code, 2)
        finally:
            build_index.collect_papers = original


class DeployStepCommandTests(unittest.TestCase):
    """The deploy's index build must name its cap instead of leaning on 0.

    ``0`` means "no cap beyond arXiv's ceiling", which is safe but is the
    number that made the weekly build reach for offsets the API refuses. The
    shipped command therefore carries the cap explicitly, and the number in the
    comment above it is the number on the command line -- a comment that
    explains a different value than the one that runs is worse than none.
    """

    def _index_step(self):
        with open(DEPLOY_PATH, encoding="utf-8") as handle:
            lines = handle.readlines()
        for index, line in enumerate(lines):
            if DEPLOY_INDEX_RUN.match(line):
                return index, lines
        self.fail("deploy.yml no longer runs 'python scripts/build_index.py'")

    def _cap_on_the_command_line(self, index, lines):
        match = MAX_PER_CATEGORY_FLAG.search(lines[index])
        self.assertIsNotNone(
            match,
            "deploy.yml:%d: %r must pass --max-per-category explicitly rather "
            "than rely on the default" % (index + 1, lines[index].strip()),
        )
        return int(match.group(1))

    def _comment_above_the_run_line(self, index, lines):
        # The step's comment sits above its sibling keys (``timeout-minutes``),
        # so the block is everything between the step's ``- name:`` and the run.
        start = index
        while start > 0 and not lines[start].lstrip().startswith("- name:"):
            start -= 1
        return "\n".join(
            line.strip().lstrip("#").strip()
            for line in lines[start:index]
            if line.strip().startswith("#")
        )

    def test_the_index_step_caps_what_it_fetches_within_the_ceiling(self):
        index, lines = self._index_step()
        cap = self._cap_on_the_command_line(index, lines)
        self.assertGreater(cap, 0, "0 is the 'no cap' default, not a cap")
        self.assertLessEqual(
            cap, ARXIV_RESULTS_PER_QUERY,
            "deploy.yml:%d asks for %d results per category, above arXiv's "
            "%d-result ceiling" % (index + 1, cap, ARXIV_RESULTS_PER_QUERY),
        )

    def test_the_cap_stays_clear_of_the_real_window_sizes(self):
        """The cap is a safety bound, so it must not sit just above a window.

        cs.AI held 10,785 papers in its 60-day window on 2026-10-02 (measured
        from ``opensearch`` totalResults by IMP-198's verifier) and arXiv grows
        ~9% per window. A cap at 12,000 was +11% over that -- one growth step
        from binding, and binding was silent, since a cap-bound truncation is
        not a failed query. Two times the largest measured window is the floor
        that keeps this a safety bound instead of a content budget; the ceiling
        itself is the cap's other bound and is enforced by
        ``QueryCeilingTests``.
        """
        largest_measured_window = 10785  # cs.AI, 60-day window, 2026-10-02
        index, lines = self._index_step()
        cap = self._cap_on_the_command_line(index, lines)
        self.assertGreaterEqual(
            cap,
            2 * largest_measured_window,
            "deploy.yml:%d caps at %d, under 2x the largest measured 60-day "
            "window (%d); a cap that close to a real window size truncates on "
            "ordinary arXiv growth"
            % (index + 1, cap, largest_measured_window),
        )

    def test_the_comment_documents_the_number_the_command_uses(self):
        index, lines = self._index_step()
        cap = self._cap_on_the_command_line(index, lines)
        comment = self._comment_above_the_run_line(index, lines)
        self.assertTrue(comment, "deploy.yml:%d has no comment" % (index + 1))
        self.assertIn(str(cap), comment)


class DeployStepTimeoutTests(unittest.TestCase):
    """A deploy run must be able to report which categories failed.

    deploy.yml runs the whole pipeline, so unlike the CI step it queries every
    default category, and ``collect_papers`` records a failed category and moves
    on to the next. A total network partition therefore costs one worst-case
    page fetch *per category* before ``main`` finally logs them all and returns
    1. If the step's cap were tighter than that, GitHub would cancel the run and
    the one diagnostic that names the categories would never be printed.
    """

    def _index_step_timeout_minutes(self):
        with open(DEPLOY_PATH, encoding="utf-8") as handle:
            lines = handle.readlines()
        for index, line in enumerate(lines):
            if not DEPLOY_INDEX_RUN.match(line):
                continue
            # The cap is a sibling key of ``run:``, so it is the first thing
            # above it once blanks and comments are skipped. Anything else means
            # the step has no cap, which is reported rather than papered over by
            # matching a cap from an earlier step.
            for candidate in reversed(lines[:index]):
                stripped = candidate.strip()
                if not stripped or stripped.startswith("#"):
                    continue
                match = TIMEOUT_LINE.match(candidate)
                self.assertIsNotNone(
                    match,
                    "deploy.yml:%d: the index step has no timeout-minutes"
                    % (index + 1),
                )
                return int(match.group(1))
        self.fail("deploy.yml no longer runs 'python scripts/build_index.py'")

    def test_the_index_step_outlasts_a_whole_pipeline_failure(self):
        worst_case = (
            len(build_index.DEFAULT_CATEGORIES)
            * (build_index.arxiv_common.DEFAULT_NUM_RETRIES + 1)
            * build_index.arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS
        )
        self.assertEqual(worst_case, 1800)

        minutes = self._index_step_timeout_minutes()
        self.assertGreater(
            minutes * 60,
            worst_case,
            "deploy.yml caps the index step at %d min (%d s), but a partitioned "
            "run needs %d s (%d categories x %d attempts x %d s) before "
            "main() can report them."
            % (
                minutes,
                minutes * 60,
                worst_case,
                len(build_index.DEFAULT_CATEGORIES),
                build_index.arxiv_common.DEFAULT_NUM_RETRIES + 1,
                build_index.arxiv_common.DEFAULT_REQUEST_TIMEOUT_SECONDS,
            ),
        )


if __name__ == "__main__":
    unittest.main()
