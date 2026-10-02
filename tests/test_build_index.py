import importlib.util
import json
import os
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace

MODULE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "scripts", "build_index.py"
)


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


if __name__ == "__main__":
    unittest.main()
