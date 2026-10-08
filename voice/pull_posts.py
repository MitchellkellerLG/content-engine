#!/usr/bin/env python3
"""Collect your own posts into one normalized file: data/posts.jsonl.

Three ways in, pick whichever you have:

  # 1. X API (needs X_BEARER_TOKEN; returns up to your ~3,200 most recent posts)
  python voice/pull_posts.py x-api --user-id 123456 --max 1000

  # 2. Your X data export (Settings > Your account > Download an archive)
  python voice/pull_posts.py x-archive ~/Downloads/twitter-archive/data/tweets.js

  # 3. Any CSV: a LinkedIn data export, a scheduler export, a spreadsheet
  python voice/pull_posts.py csv Shares.csv --preset linkedin-shares
  python voice/pull_posts.py csv posts.csv --text-col body --date-col published --likes-col likes

Each line of the output is one post:
  {"id", "platform", "created_at", "text", "likes", "reposts", "replies", "impressions", "url"}

Runs entirely on your machine. Nothing is uploaded anywhere.
Standard library only.
"""
import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_OUT = HERE / "data" / "posts.jsonl"

PRESETS = {
    # LinkedIn "Get a copy of your data" > Shares.csv. No engagement numbers in the export.
    "linkedin-shares": {"text": "ShareCommentary", "date": "Date", "url": "ShareLink", "platform": "linkedin"},
}


def _int(v):
    try:
        return int(float(str(v).replace(",", "").strip()))
    except (TypeError, ValueError):
        return None


def _iso(value):
    """Best-effort timestamp normalization to ISO 8601 UTC. Returns '' if unknown."""
    if not value:
        return ""
    s = str(value).strip()
    fmts = ["%a %b %d %H:%M:%S %z %Y", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d", "%m/%d/%Y %H:%M", "%m/%d/%Y"]
    try:
        d = datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        d = None
        for f in fmts:
            try:
                d = datetime.strptime(s, f)
                break
            except ValueError:
                continue
    if d is None:
        return ""
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def post(id_, platform, created_at, text, likes=None, reposts=None, replies=None, impressions=None, url=""):
    return {
        "id": str(id_), "platform": platform, "created_at": _iso(created_at), "text": (text or "").strip(),
        "likes": _int(likes), "reposts": _int(reposts), "replies": _int(replies), "impressions": _int(impressions),
        "url": url or "",
    }


def from_x_archive(path):
    raw = Path(path).read_text(encoding="utf-8")
    raw = raw[raw.index("["):]  # strip "window.YTD.tweets.part0 = "
    out = []
    for item in json.loads(raw):
        t = item.get("tweet", item)
        text = t.get("full_text") or t.get("text") or ""
        if text.startswith("RT @"):
            continue
        if t.get("in_reply_to_status_id_str"):
            # replies (including thread continuations) say little about how you open a post
            continue
        out.append(post(t.get("id_str") or t.get("id"), "x", t.get("created_at"), text,
                        t.get("favorite_count"), t.get("retweet_count"), None, None, ""))
    return out


def from_csv(path, text_col, date_col, likes_col=None, reposts_col=None, replies_col=None,
             impressions_col=None, url_col=None, id_col=None, platform="other"):
    out = []
    with open(path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        missing = [c for c in (text_col, date_col) if c not in (reader.fieldnames or [])]
        if missing:
            sys.exit(f"CSV is missing column(s): {', '.join(missing)}. Found: {reader.fieldnames}")
        for i, row in enumerate(reader):
            text = row.get(text_col) or ""
            if not text.strip():
                continue
            g = lambda c: row.get(c) if c else None
            out.append(post(g(id_col) or f"{platform}-{i}", platform, row.get(date_col), text,
                            g(likes_col), g(reposts_col), g(replies_col), g(impressions_col), g(url_col) or ""))
    return out


def _get(url, token):
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "User-Agent": "content-engine/0.1"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 2:
                time.sleep(15 * (attempt + 1))
                continue
            sys.exit(f"X API error {e.code}: {e.read().decode()[:300]}")
    return {}


def from_x_api(user_id, max_posts, token):
    out, page = [], None
    base = f"https://api.x.com/2/users/{urllib.parse.quote(user_id)}/tweets"
    while len(out) < max_posts:
        q = {"max_results": "100", "exclude": "replies,retweets",
             "tweet.fields": "created_at,public_metrics,note_tweet"}
        if page:
            q["pagination_token"] = page
        data = _get(base + "?" + urllib.parse.urlencode(q), token)
        for t in data.get("data", []):
            m = t.get("public_metrics", {})
            text = (t.get("note_tweet") or {}).get("text") or t.get("text", "")
            out.append(post(t["id"], "x", t.get("created_at"), text, m.get("like_count"), m.get("retweet_count"),
                            m.get("reply_count"), m.get("impression_count"), f"https://x.com/i/status/{t['id']}"))
        page = data.get("meta", {}).get("next_token")
        if not page:
            break
    return out[:max_posts]


def write(posts, out_path, append):
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    seen = set()
    if append and out_path.exists():
        seen = {json.loads(l)["id"] for l in out_path.read_text(encoding="utf-8").splitlines() if l.strip()}
    mode = "a" if append else "w"
    n = 0
    with open(out_path, mode, encoding="utf-8") as f:
        for p in posts:
            if p["id"] in seen or not p["text"]:
                continue
            seen.add(p["id"])
            f.write(json.dumps(p, ensure_ascii=False) + "\n")
            n += 1
    return n


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    ap.add_argument("--append", action="store_true", help="add to an existing file, skipping ids already there")
    sub = ap.add_subparsers(dest="source", required=True)
    a = sub.add_parser("x-api")
    a.add_argument("--user-id", required=True)
    a.add_argument("--max", type=int, default=800)
    b = sub.add_parser("x-archive")
    b.add_argument("path")
    c = sub.add_parser("csv")
    c.add_argument("path")
    c.add_argument("--preset", choices=sorted(PRESETS))
    for col in ("text", "date", "likes", "reposts", "replies", "impressions", "url", "id"):
        c.add_argument(f"--{col}-col")
    c.add_argument("--platform", default=None)
    args = ap.parse_args(argv)

    if args.source == "x-api":
        token = os.environ.get("X_BEARER_TOKEN")
        if not token:
            sys.exit("Set X_BEARER_TOKEN (see .env.example)")
        posts = from_x_api(args.user_id, args.max, token)
    elif args.source == "x-archive":
        posts = from_x_archive(args.path)
    else:
        p = dict(PRESETS.get(args.preset, {}))
        text_col = args.text_col or p.get("text")
        date_col = args.date_col or p.get("date")
        if not text_col or not date_col:
            sys.exit("csv needs --text-col and --date-col (or a --preset)")
        posts = from_csv(args.path, text_col, date_col, args.likes_col, args.reposts_col, args.replies_col,
                         args.impressions_col, args.url_col or p.get("url"), args.id_col,
                         args.platform or p.get("platform", "other"))
    n = write(posts, args.out, args.append)
    print(f"wrote {n} posts to {args.out}")


if __name__ == "__main__":
    main()
