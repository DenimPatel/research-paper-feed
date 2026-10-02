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
DEPLOY_INDEX_RUN = re.compile(r"^\s*run:\s*python scripts/build_index\.py\s*$")
TIMEOUT_LINE = re.compile(r"^\s*timeout-minutes:\s*(\d+)\s*(?:#.*)?$")


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

    def test_refuses_to_write_index_when_a_category_query_fails(self):
        import tempfile

        arxiv_error = build_index.arxiv_common.arxiv.ArxivError
        original = build_index.arxiv_common.iter_results

        def fake_iter_results(query, max_results, status=None):
            if query == "cat:cs.LG":
                raise arxiv_error(
                    "https://export.arxiv.org/api/query", 0, "simulated outage"
                )
            yield make_result("2401.00001")

        build_index.arxiv_common.iter_results = fake_iter_results
        try:
            with tempfile.TemporaryDirectory() as out_dir:
                with self.assertLogs(level="ERROR") as captured:
                    exit_code = build_index.main([
                        "--out-dir", out_dir,
                        "--category", "cs.CV",
                        "--category", "cs.LG",
                    ])
                self.assertNotEqual(exit_code, 0)
                self.assertEqual(os.listdir(out_dir), [])
                self.assertIn("cs.LG", "\n".join(captured.output))
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
