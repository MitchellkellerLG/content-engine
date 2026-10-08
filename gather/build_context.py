#!/usr/bin/env python3
"""Bundle today's raw material into one file your AI assistant reads with
prompts/daily-brief.md.

  python gather/build_context.py              # -> gather/data/context-YYYY-MM-DD.md

Picks up whatever exists, skips what doesn't:
  gather/data/bookmarks-new.md     from bookmarks.py
  gather/data/github.md            from github_activity.sh
  gather/inbox/*.md|*.txt          anything you drop in: call notes, voice memos, ideas
  voice/data/out/VOICE.md (or voice/VOICE.md)   your voice file
  gather/scoring/winners.csv       your best past posts (make_winners.py)

Standard library only.
"""
import argparse
import datetime as dt
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
MAX_CHARS_PER_FILE = 20000


def section(title, path):
    p = Path(path)
    if not p.exists():
        return None
    text = p.read_text(encoding="utf-8", errors="replace").strip()
    if len(text) > MAX_CHARS_PER_FILE:
        text = text[:MAX_CHARS_PER_FILE] + "\n\n[truncated]"
    return f"## {title} ({p.relative_to(ROOT) if p.is_relative_to(ROOT) else p.name})\n\n{text}\n"


def build(today=None, root=ROOT):
    today = today or dt.date.today().isoformat()
    g = root / "gather"
    parts = [f"# Content context for {today}", ""]
    found = []
    for title, path in [
        ("New bookmarks", g / "data" / "bookmarks-new.md"),
        ("What I shipped", g / "data" / "github.md"),
    ]:
        s = section(title, path)
        if s:
            parts.append(s)
            found.append(title)
    inbox = sorted(p for p in (g / "inbox").glob("*") if p.suffix in {".md", ".txt"} and p.name != "README.md")
    for p in inbox:
        parts.append(section(f"Note: {p.stem}", p))
        found.append(p.name)
    voice = next((p for p in [root / "voice" / "data" / "out" / "VOICE.md", root / "voice" / "VOICE.md"] if p.exists()), None)
    if voice:
        parts.append(section("My voice", voice))
        found.append("VOICE.md")
    winners = g / "scoring" / "winners.csv"
    if winners.exists():
        parts.append(section("My past winners", winners))
        found.append("winners.csv")
    if not found:
        parts.append("Nothing found. Run bookmarks.py / github_activity.sh or drop notes in gather/inbox/.\n")
    return "\n".join(parts), found


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--date", default=None)
    args = ap.parse_args(argv)
    md, found = build(args.date)
    out = HERE / "data" / f"context-{args.date or dt.date.today().isoformat()}.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(md, encoding="utf-8")
    print(f"wrote {out} ({', '.join(found) or 'nothing found'})")


if __name__ == "__main__":
    main()
