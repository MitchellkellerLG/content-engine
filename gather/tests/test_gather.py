import sys
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import bookmarks  # noqa: E402
import build_context  # noqa: E402
import score_ideas  # noqa: E402

BRIEF = """# Content ideas: 2026-01-12

## 1. Invoices paid in 3 days

**Hook:** We cut invoice chasing to 40 minutes a week.

**Based on:** notes/invoices.md

## 2. Dashboards are overrated

**Hook:** One number a week beats a dashboard.

## Runners-up
- ## 3. not an idea
"""

PAGE = {
    "data": [
        {"id": "3", "author_id": "u1", "text": "newest", "entities": {"urls": [{"expanded_url": "https://a.test"}]}},
        {"id": "2", "author_id": "u1", "text": "older"},
        {"id": "1", "author_id": "u2", "text": "seen before"},
    ],
    "includes": {"users": [{"id": "u1", "username": "ann"}, {"id": "u2", "username": "bo"}]},
}


class BriefTests(unittest.TestCase):
    def test_parse_ignores_runners_up(self):
        ideas = score_ideas.parse_brief(BRIEF)
        self.assertEqual([i["n"] for i in ideas], [1, 2])
        self.assertTrue(ideas[0]["hook"].startswith("We cut"))

    def test_finalize_clamps_and_checks_winner(self):
        ideas = score_ideas.parse_brief(BRIEF)
        winners = [{"url": "https://x.com/y/status/1"}]
        raw = [
            {"n": 1, "hold": 99, "send": 15, "proof": 20, "hook": 15, "topic": 15, "real_work": 10, "tools": 5,
             "penalty": -40, "closest_winner": "https://x.com/y/status/1", "reason": "real number"},
            {"n": 2, "hold": "x", "penalty": 5, "closest_winner": "https://made.up/1"},
        ]
        rows = score_ideas.finalize(raw, ideas, winners)
        self.assertEqual(rows[0]["score"], 100 - 15)
        self.assertEqual(rows[0]["closest_winner"], "https://x.com/y/status/1")
        self.assertEqual(rows[1]["closest_winner"], "")
        self.assertEqual(rows[1]["penalty"], 0)

    def test_extract_json(self):
        self.assertEqual(score_ideas.extract_json('noise [ {"n": 1} ] tail'), [{"n": 1}])
        with self.assertRaises(ValueError):
            score_ideas.extract_json("no json")

    def test_prompt_mentions_every_criterion(self):
        p = score_ideas.build_prompt(score_ideas.parse_brief(BRIEF), [], "RUBRIC")
        for k in score_ideas.MAX:
            self.assertIn(k, p)


class BookmarkTests(unittest.TestCase):
    def test_collect_stops_at_seen(self):
        new = bookmarks.collect([PAGE], {"1"})
        self.assertEqual([b["id"] for b in new], ["3", "2"])
        self.assertEqual(new[0]["url"], "https://x.com/ann/status/3")
        self.assertEqual(new[0]["links"], ["https://a.test"])

    def test_digest(self):
        self.assertIn("None since", bookmarks.digest([]))
        self.assertIn("@ann", bookmarks.digest(bookmarks.collect([PAGE], set())))


class ContextTests(unittest.TestCase):
    def test_build_picks_up_what_exists(self):
        with tempfile.TemporaryDirectory() as d:
            root = Path(d)
            (root / "gather" / "data").mkdir(parents=True)
            (root / "gather" / "inbox").mkdir()
            (root / "gather" / "data" / "github.md").write_text("# shipped a thing")
            (root / "gather" / "inbox" / "call.md").write_text("customer said X")
            md, found = build_context.build("2026-01-12", root)
            self.assertIn("What I shipped", md)
            self.assertIn("customer said X", md)
            self.assertEqual(found, ["What I shipped", "call.md"])


if __name__ == "__main__":
    unittest.main()
