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

    def test_dot_only_titles_are_never_directory_references(self):
        for title in (".", "..", "...", " . ", "./.", "\\..\\", ".. ", "  .."):
            with self.subTest(title=title):
                slug = paper_collector.safe_filename(title)
                self.assertNotIn(slug, ("", ".", ".."))
                self.assertNotIn("/", slug)
                self.assertNotIn("\\", slug)
                self.assertNotIn(os.sep, slug)

    def test_no_input_produces_a_path_separator(self):
        separators = ["/", "\\", os.sep] + ([os.altsep] if os.altsep else [])
        for title in ("a/b", "a\\b", "/etc/passwd", "\\windows\\system32", "//", "..//.."):
            with self.subTest(title=title):
                slug = paper_collector.safe_filename(title)
                for separator in separators:
                    self.assertNotIn(separator, slug)

    def test_replaces_control_characters(self):
        slug = paper_collector.safe_filename("two\nlines\r\x00nul\x7fdel\t here")
        for control in "\n\r\x00\x7f\t":
            self.assertNotIn(control, slug)
        self.assertEqual(
            slug.encode("utf-8").decode("utf-8"),
            slug,
            "the slug must still be valid UTF-8",
        )

    def test_caps_the_slug_by_utf8_bytes_not_characters(self):
        ascii_slug = paper_collector.safe_filename("x" * 400)
        self.assertLessEqual(len(ascii_slug.encode("utf-8")), 200)
        self.assertEqual(len(ascii_slug.encode("utf-8")), 200)

        # One CJK character is three UTF-8 bytes, so 400 characters is ~1200 bytes.
        cjk_title = "深" * 400
        cjk_slug = paper_collector.safe_filename(cjk_title)
        self.assertLessEqual(len(cjk_slug.encode("utf-8")), 200)
        self.assertEqual(cjk_slug, "深" * 66)

    def test_truncation_never_splits_a_multibyte_character(self):
        for character in ("é", "深", "\U0001f600"):
            with self.subTest(character=character):
                slug = paper_collector.safe_filename(character * 400)
                encoded = slug.encode("utf-8")
                self.assertLessEqual(len(encoded), 200)
                self.assertEqual(encoded, character.encode("utf-8") * len(slug))
                self.assertTrue(slug)
                roundtripped = slug.encode("utf-8").decode("utf-8")
                self.assertEqual(roundtripped, slug)

    def test_windows_reserved_names_gain_an_underscore_suffix(self):
        reserved = (
            ["CON", "PRN", "AUX", "NUL"]
            + [f"COM{number}" for number in range(1, 10)]
            + [f"LPT{number}" for number in range(1, 10)]
        )
        self.assertEqual(len(reserved), 22)
        for name in reserved:
            for variant in (name, name.lower(), name.capitalize()):
                with self.subTest(name=variant):
                    slug = paper_collector.safe_filename(variant)
                    self.assertTrue(slug.endswith("_"), slug)
                    self.assertEqual(slug[:-1].lower(), variant.lower())

    def test_reserved_name_before_a_long_extension_is_still_suffixed(self):
        slug = paper_collector.safe_filename("CON." + "x" * 400)
        self.assertLessEqual(len(slug.encode("utf-8")), 200)
        self.assertTrue(slug.startswith("CON.x"), slug[:12])

    def test_names_that_only_start_like_a_device_are_untouched(self):
        for title in ("CONSORTIUM", "com10", "lpt0", "auxiliary losses"):
            with self.subTest(title=title):
                self.assertEqual(paper_collector.safe_filename(title), title)

    def test_documented_topics_stay_readable(self):
        for topic, expected in (
            ("cat:cs.CV", "cat_cs.CV"),
            ("diffusion models", "diffusion models"),
            ("computer-vision", "computer-vision"),
            ('cat:cs.CV AND "3d reconstruction"', 'cat_cs.CV AND _3d reconstruction_'),
        ):
            with self.subTest(topic=topic):
                self.assertEqual(paper_collector.safe_filename(topic), expected)


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


class ExtractSourceArchiveTests(unittest.TestCase):
    """``--download-sources`` must not let an archive write outside its own directory."""

    def setUp(self):
        import tarfile
        import tempfile

        self.tarfile = tarfile
        self.original_cwd = os.getcwd()
        self.base = tempfile.mkdtemp()
        self.sentinel = os.path.join(self.base, "sentinel")
        os.makedirs(self.sentinel)
        os.chdir(self.base)

    def tearDown(self):
        os.chdir(self.original_cwd)
        shutil.rmtree(self.base, ignore_errors=True)

    def _dest(self, name="A Paper Title"):
        return os.path.join(self.base, "extracted", name)

    def _write_archive(self, name, extra_members=()):
        """Build a tarball with a benign member, an in-tree link, and ``extra_members``."""
        path = os.path.join(self.base, name)
        with self.tarfile.open(path, "w:gz") as archive:
            self._add_file(archive, "main.tex", b"% arXiv source\n")
            link = self.tarfile.TarInfo("paper.ps")
            link.type = self.tarfile.SYMTYPE
            link.linkname = "main.tex"
            archive.addfile(link)
            for member_name, payload in extra_members:
                self._add_file(archive, member_name, payload)
        return path

    def _write_attack_archive(self, name):
        """Build a tarball where every member tries to escape the destination."""
        path = os.path.join(self.base, name)
        sentinel = os.path.join(self.sentinel, "escape.txt")
        with self.tarfile.open(path, "w:gz") as archive:
            self._add_file(archive, "main.tex", b"% arXiv source\n")
            self._add_file(archive, "../escape.txt")
            self._add_file(archive, "../../../pwned_deep.txt")
            self._add_file(archive, os.path.join(self.sentinel, "abs.txt"))
            self._add_file(archive, os.path.join("symdir", "thru_sym.txt"))
            self._add_link(archive, "abs_link", self.sentinel)
            self._add_link(archive, "rel_link", "../../../pwned_rel")
            self._add_link(archive, "symdir", self.sentinel)
            self._add_link(archive, "inner_link", "main.tex")
            for member_name, kind in (
                ("chardev", self.tarfile.CHRTYPE),
                ("fifo", self.tarfile.FIFOTYPE),
            ):
                member = self.tarfile.TarInfo(member_name)
                member.type = kind
                member.devmajor, member.devminor = 1, 3
                archive.addfile(member)
        return path, sentinel

    def _add_file(self, archive, member_name, payload=b"pwned\n"):
        member = self.tarfile.TarInfo(member_name)
        member.size = len(payload)
        archive.addfile(member, io.BytesIO(payload))

    def _add_link(self, archive, member_name, linkname):
        member = self.tarfile.TarInfo(member_name)
        member.type = self.tarfile.SYMTYPE
        member.linkname = linkname
        archive.addfile(member)

    def _files_under_base(self):
        return [
            os.path.join(root, filename)
            for root, _, names in os.walk(self.base)
            for filename in names
        ]

    def _files_outside(self, dest, before):
        """Anything created inside the sandbox since ``before`` that is not inside ``dest``."""
        inside = os.path.realpath(dest) + os.sep
        return [
            path for path in set(self._files_under_base()) - before
            if not os.path.realpath(path).startswith(inside)
        ]

    def _extract_capturing_logs(self, archive, dest, has_filter):
        """Extract with the capability flag forced on or off; return log lines and escapes."""
        before = set(self._files_under_base())
        original = paper_collector.TARFILE_HAS_FILTER
        paper_collector.TARFILE_HAS_FILTER = has_filter
        try:
            with self.assertLogs(level="WARNING") as logs:
                paper_collector.extract_source_archive(archive, dest)
            return list(logs.output), self._files_outside(dest, before)
        finally:
            paper_collector.TARFILE_HAS_FILTER = original

    def _skip_without_filter(self):
        if not paper_collector.TARFILE_HAS_FILTER:
            self.skipTest(
                "tarfile extraction filters need Python 3.8.17+/3.9.17+/"
                f"3.10.12+/3.11.4+, running {sys.version.split()[0]}"
            )

    def test_traversal_member_is_skipped_logged_and_stays_inside_dest(self):
        self._skip_without_filter()
        archive = self._write_archive("source.tar.gz", [("../escape.txt", b"pwned\n")])
        dest = self._dest()

        logs, escaped = self._extract_capturing_logs(archive, dest, has_filter=True)

        self.assertEqual(escaped, [], "a member escaped the destination")
        self.assertTrue(os.path.exists(os.path.join(dest, "main.tex")))
        self.assertTrue(os.path.islink(os.path.join(dest, "paper.ps")))
        self.assertTrue(any("escape.txt" in line for line in logs), logs)

    def test_extractall_is_called_with_the_data_filter(self):
        self._skip_without_filter()
        archive = self._write_archive("source.tar.gz", [("../escape.txt", b"pwned\n")])
        dest = self._dest()
        calls = []
        original_extractall = self.tarfile.TarFile.extractall

        def recording_extractall(archive_file, path=".", members=None, **kwargs):
            calls.append({
                "path": path,
                "members": [member.name for member in (members or [])],
                "filter": kwargs.get("filter"),
            })
            return original_extractall(archive_file, path, members, **kwargs)

        self.tarfile.TarFile.extractall = recording_extractall
        try:
            with self.assertLogs(level="WARNING"):
                paper_collector.extract_source_archive(archive, dest)
        finally:
            self.tarfile.TarFile.extractall = original_extractall

        self.assertEqual(len(calls), 1, calls)
        self.assertEqual(calls[0]["filter"], "data", 'extractall must get filter="data"')
        self.assertEqual(calls[0]["path"], dest)
        self.assertIn("main.tex", calls[0]["members"])
        self.assertNotIn("../escape.txt", calls[0]["members"])

    def test_rewritten_member_name_is_reported(self):
        self._skip_without_filter()
        archive = self._write_archive(
            "absolute.tar.gz",
            [(os.path.join(self.sentinel, "abs.txt"), b"x")],
        )
        dest = self._dest()

        logs, escaped = self._extract_capturing_logs(archive, dest, has_filter=True)

        self.assertTrue(
            any("Sanitized member" in line and "abs.txt" in line for line in logs),
            f"a silently relocated member must be reported: {logs}",
        )
        self.assertEqual(escaped, [])

    def test_interpreter_without_filter_still_blocks_traversal(self):
        archive = self._write_archive("source.tar.gz", [("../escape.txt", b"pwned\n")])
        dest = self._dest()

        logs, escaped = self._extract_capturing_logs(archive, dest, has_filter=False)

        self.assertEqual(escaped, [], "fallback let a member escape")
        self.assertTrue(os.path.exists(os.path.join(dest, "main.tex")))
        self.assertTrue(os.path.islink(os.path.join(dest, "paper.ps")))
        self.assertTrue(any("escape.txt" in line for line in logs), logs)

    def test_interpreter_without_filter_blocks_every_escape_route(self):
        archive, sentinel = self._write_attack_archive("attack.tar.gz")
        dest = self._dest()

        logs, escaped = self._extract_capturing_logs(archive, dest, has_filter=False)

        self.assertEqual(escaped, [], "fallback let a member escape")
        self.assertFalse(os.path.exists(sentinel))
        self.assertTrue(os.path.exists(os.path.join(dest, "main.tex")))
        self.assertTrue(os.path.islink(os.path.join(dest, "inner_link")))
        for skipped in ("../escape.txt", "pwned_deep.txt", "abs_link", "rel_link",
                        "symdir", "chardev", "fifo"):
            self.assertTrue(
                any(skipped in line for line in logs), f"{skipped} was not reported: {logs}"
            )


if __name__ == "__main__":
    unittest.main()
