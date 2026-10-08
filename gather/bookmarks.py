#!/usr/bin/env python3
"""Pull your new X bookmarks into gather/data/.

  python gather/bookmarks.py --user-id <your numeric id>

Needs X_OAUTH2_USER_TOKEN: an OAuth 2.0 user access token for your own
account with the scopes tweet.read, users.read and bookmark.read (bookmarks
are private, so an app-only bearer token cannot read them).

Writes:
  gather/data/bookmarks.jsonl      every bookmark seen so far (append-only)
  gather/data/bookmarks-new.md     only the ones new since the last run, for the daily brief

Stops paging as soon as it reaches a bookmark it has already seen, so a daily
run reads one page. Standard library only. Data stays on your machine.
"""
import argparse
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
DATA = HERE / "data"


def fetch_page(user_id, token, page=None):
    q = {
        "max_results": "100",
        "tweet.fields": "created_at,public_metrics,note_tweet,entities",
        "expansions": "author_id",
        "user.fields": "username,name",
    }
    if page:
        q["pagination_token"] = page
    url = f"https://api.x.com/2/users/{urllib.parse.quote(user_id)}/bookmarks?" + urllib.parse.urlencode(q)
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "User-Agent": "content-engine/0.1"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        sys.exit(f"X API error {e.code}: {e.read().decode()[:300]}")


def normalize(data):
    users = {u["id"]: u for u in (data.get("includes") or {}).get("users", [])}
    out = []
    for t in data.get("data", []):
        u = users.get(t.get("author_id"), {})
        handle = u.get("username", "unknown")
        links = [x.get("unwound_url") or x.get("expanded_url") for x in (t.get("entities") or {}).get("urls", [])]
        out.append({
            "id": t["id"],
            "author": handle,
            "created_at": t.get("created_at", ""),
            "text": (t.get("note_tweet") or {}).get("text") or t.get("text", ""),
            "likes": (t.get("public_metrics") or {}).get("like_count"),
            "links": [l for l in links if l],
            "url": f"https://x.com/{handle}/status/{t['id']}",
        })
    return out


def collect(pages, seen):
    """pages: iterable of API responses, newest first. Returns new bookmarks until a seen id."""
    new = []
    for data in pages:
        for b in normalize(data):
            if b["id"] in seen:
                return new
            new.append(b)
    return new


def digest(new):
    if not new:
        return "# New bookmarks\n\nNone since the last run.\n"
    lines = [f"# New bookmarks ({len(new)})", ""]
    for b in new:
        text = " ".join(b["text"].split())
        lines.append(f"- @{b['author']}: {text[:280]}{'...' if len(text) > 280 else ''}")
        lines.append(f"  {b['url']}" + (f" | links: {', '.join(b['links'])}" if b["links"] else ""))
    return "\n".join(lines) + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--user-id", required=True)
    ap.add_argument("--max-pages", type=int, default=3)
    args = ap.parse_args(argv)
    token = os.environ.get("X_OAUTH2_USER_TOKEN")
    if not token:
        sys.exit("Set X_OAUTH2_USER_TOKEN (see .env.example)")
    DATA.mkdir(parents=True, exist_ok=True)
    store = DATA / "bookmarks.jsonl"
    seen = set()
    if store.exists():
        seen = {json.loads(l)["id"] for l in store.read_text(encoding="utf-8").splitlines() if l.strip()}

    def pages():
        page = None
        for _ in range(args.max_pages):
            data = fetch_page(args.user_id, token, page)
            yield data
            page = (data.get("meta") or {}).get("next_token")
            if not page:
                return

    new = collect(pages(), seen)
    with open(store, "a", encoding="utf-8") as f:
        for b in reversed(new):
            f.write(json.dumps(b, ensure_ascii=False) + "\n")
    (DATA / "bookmarks-new.md").write_text(digest(new), encoding="utf-8")
    print(f"{len(new)} new bookmarks -> {DATA / 'bookmarks-new.md'}")


if __name__ == "__main__":
    main()
