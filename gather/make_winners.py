#!/usr/bin/env python3
"""Pick your best past posts from voice/data/posts.jsonl into gather/scoring/winners.csv.

  python gather/make_winners.py --top 40

The idea scorer compares every new idea to these. Uses the same engagement
score as voice/analyze.py. Posts without numbers are ignored.
"""
import argparse
import csv
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
sys.path.insert(0, str(ROOT / "voice"))
from analyze import classify, first_line, score  # noqa: E402


def winners(posts, top):
    scored = [p for p in posts if score(p) is not None]
    scored.sort(key=score, reverse=True)
    return [{"url": p.get("url", ""), "date": p.get("created_at", "")[:10], "format": classify(p["text"]),
             "score": score(p), "hook": first_line(p["text"])[:200]} for p in scored[:top]]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--in", dest="inp", default=str(ROOT / "voice" / "data" / "posts.jsonl"))
    ap.add_argument("--out", default=str(HERE / "scoring" / "winners.csv"))
    ap.add_argument("--top", type=int, default=40)
    args = ap.parse_args(argv)
    posts = [json.loads(l) for l in Path(args.inp).read_text(encoding="utf-8").splitlines() if l.strip()]
    rows = winners(posts, args.top)
    if not rows:
        sys.exit("No posts with engagement numbers. Use the X API or X archive source in voice/pull_posts.py.")
    with open(args.out, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"wrote {len(rows)} winners to {args.out}")


if __name__ == "__main__":
    main()
