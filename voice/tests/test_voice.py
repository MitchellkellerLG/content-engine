import json
import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import analyze  # noqa: E402
import pull_posts  # noqa: E402

FIX = HERE / "fixtures"


class PullTests(unittest.TestCase):
    def test_x_archive_skips_reposts_and_replies(self):
        posts = pull_posts.from_x_archive(FIX / "tweets.js")
        self.assertEqual([p["id"] for p in posts], ["1", "4"])
        self.assertEqual(posts[0]["created_at"], "2026-01-05T15:00:00Z")
        self.assertEqual(posts[0]["likes"], 40)

    def test_linkedin_preset(self):
        p = pull_posts.PRESETS["linkedin-shares"]
        posts = pull_posts.from_csv(FIX / "Shares.csv", p["text"], p["date"], url_col=p["url"], platform="linkedin")
        self.assertEqual(len(posts), 1)
        self.assertEqual(posts[0]["platform"], "linkedin")
        self.assertIsNone(posts[0]["likes"])

    def test_write_dedupes_on_append(self):
        posts = pull_posts.from_x_archive(FIX / "tweets.js")
        with tempfile.TemporaryDirectory() as d:
            out = Path(d) / "p.jsonl"
            self.assertEqual(pull_posts.write(posts, out, append=False), 2)
            self.assertEqual(pull_posts.write(posts, out, append=True), 0)


class AnalyzeTests(unittest.TestCase):
    def test_classify(self):
        self.assertEqual(analyze.classify("Hot take: cold calls are dead"), "hot-take")
        self.assertEqual(analyze.classify("How to send invoices\n1. a\n2. b\n3. c"), "how-to")
        self.assertEqual(analyze.classify("Three things:\n1. a\n2. b\n3. c"), "list")
        self.assertEqual(analyze.classify("I lost a client last week and learned a lot"), "story")
        self.assertEqual(analyze.classify("Short and plain."), "one-liner")

    def test_score_needs_numbers(self):
        self.assertIsNone(analyze.score({"likes": None, "reposts": None, "replies": None}))
        self.assertEqual(analyze.score({"likes": 3, "reposts": 1, "replies": None}), 5)

    def test_packet_sections(self):
        posts = pull_posts.from_x_archive(FIX / "tweets.js")
        md = analyze.analyze(json.loads(json.dumps(posts)))
        for h in ("## 1. Formats", "## 2. Hooks", "## 3. Style habits", "## 4. Top"):
            self.assertIn(h, md)
        self.assertIn("I lost a client last week", md)

    def test_no_numbers_means_style_only(self):
        p = pull_posts.PRESETS["linkedin-shares"]
        posts = pull_posts.from_csv(FIX / "Shares.csv", p["text"], p["date"], platform="linkedin")
        md = analyze.analyze(posts)
        self.assertIn("style only", md)
        self.assertNotIn("Top ", md)

    def test_empty(self):
        self.assertIn("No posts found", analyze.analyze([]))


if __name__ == "__main__":
    unittest.main()
