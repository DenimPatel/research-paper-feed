import importlib.util
import os
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


if __name__ == "__main__":
    unittest.main()
