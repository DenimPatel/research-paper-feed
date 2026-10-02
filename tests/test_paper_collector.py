import contextlib
import importlib.util
import io
import os
import shutil
import sys
import unittest

import pandas as pd

MODULE_PATH = os.path.join(
    os.path.dirname(__file__), "..", "scripts", "paper-collector.py"
)


def load_module():
    spec = importlib.util.spec_from_file_location("paper_collector", MODULE_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


paper_collector = load_module()


def make_frame():
    return pd.DataFrame([{
        "Title": "A Paper About 3D Reconstruction",
        "Date": "2024-01-01",
        "Summary": "A summary",
        "URL": "https://arxiv.org/pdf/2401.12345",
    }])


class SafeFilenameTests(unittest.TestCase):
    def test_strips_illegal_filesystem_characters(self):
        title = 'A Study of "3D" Reconstruction: Part 1/2 *final*'
        result = paper_collector.safe_filename(title)
        for char in '\\/:"*?<>|':
            self.assertNotIn(char, result)

    def test_leaves_normal_titles_unchanged(self):
        title = "A Simple Paper Title"
        self.assertEqual(paper_collector.safe_filename(title), title)


class BuildHtmlFeedTests(unittest.TestCase):
    def test_escapes_html_in_paper_fields(self):
        df = pd.DataFrame([{
            "Title": "<script>alert(1)</script>",
            "Date": "2024-01-01",
            "Summary": "A & B",
            "URL": "https://arxiv.org/abs/1234.5678",
        }])
        feed = paper_collector.build_html_feed(df)
        self.assertNotIn("<script>alert(1)</script>", feed)
        self.assertIn("&lt;script&gt;", feed)

    def test_uses_https_for_mathjax(self):
        feed = paper_collector.build_html_feed(pd.DataFrame(columns=["Title", "Date", "Summary", "URL"]))
        self.assertIn("https://cdnjs.cloudflare.com", feed)
        self.assertNotIn("http://cdnjs.cloudflare.com", feed)


class MainOutputPathTests(unittest.TestCase):
    """Every file ``main()`` writes must land inside ``--output-dir``."""

    def setUp(self):
        import tempfile

        self.original_fetch_papers = paper_collector.fetch_papers
        self.original_argv = sys.argv
        self.original_cwd = os.getcwd()
        self.base = tempfile.mkdtemp()
        paper_collector.fetch_papers = lambda *args, **kwargs: make_frame()

    def tearDown(self):
        paper_collector.fetch_papers = self.original_fetch_papers
        sys.argv = self.original_argv
        os.chdir(self.original_cwd)
        shutil.rmtree(self.base, ignore_errors=True)

    def _files_under(self, path):
        return {
            os.path.join(root, name)
            for root, _, names in os.walk(path)
            for name in names
        }

    def _run_main(self, topic, *extra_args):
        """Run ``main()`` in a fresh sandbox and return its output dir and new files."""
        import tempfile

        sandbox = tempfile.mkdtemp(dir=self.base)
        workdir = os.path.join(sandbox, "work")
        output_dir = os.path.join(workdir, "results")
        os.makedirs(workdir)
        os.chdir(workdir)
        before = self._files_under(self.base)

        sys.argv = ["paper-collector.py", "--topic", topic, "--output-dir", output_dir]
        sys.argv.extend(extra_args)
        with contextlib.redirect_stdout(io.StringIO()):
            paper_collector.main()

        return output_dir, sorted(self._files_under(self.base) - before)

    def _assert_created_inside(self, output_dir, created):
        prefix = os.path.realpath(output_dir) + os.sep
        self.assertTrue(created)
        for path in created:
            self.assertTrue(
                os.path.realpath(path).startswith(prefix),
                f"{path} was written outside {output_dir}",
            )

    def test_traversal_topic_stays_inside_output_dir(self):
        output_dir, created = self._run_main("../../escape")
        self._assert_created_inside(output_dir, created)
        html_files = [path for path in created if path.endswith(".html")]
        self.assertEqual(len(html_files), 1)
        with open(html_files[0], encoding="utf-8") as handle:
            self.assertIn("A Paper About 3D Reconstruction", handle.read())

    def test_csv_and_html_paths_stay_inside_output_dir_for_every_topic(self):
        topics = [
            "../../escape",
            "a/b",
            "..",
            'cat:cs.CV AND "3d reconstruction"',
            "cat:cs.CV",
        ]
        for topic in topics:
            with self.subTest(topic=topic):
                output_dir, created = self._run_main(topic, "--save-csv")
                self._assert_created_inside(output_dir, created)
                self.assertEqual(
                    [os.path.basename(path) for path in created if path.endswith(".csv")],
                    [paper_collector.safe_filename(topic) + "_papers.csv"],
                )

    def test_plain_topic_keeps_documented_html_naming(self):
        output_dir, created = self._run_main("cat:cs.CV")
        self._assert_created_inside(output_dir, created)
        html_name = next(
            os.path.basename(path) for path in created if path.endswith(".html")
        )
        self.assertRegex(
            html_name,
            r"^cat_cs\.CV-1_papers_extracted_on_\d{2}-\d{2}-\d{4}-\d{2}-\d{2}-\d{2}\.html$",
        )


if __name__ == "__main__":
    unittest.main()
