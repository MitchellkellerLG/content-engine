#!/usr/bin/env python3
"""Turn data/posts.jsonl into an evidence packet for writing your voice.md.

  python voice/analyze.py                       # reads voice/data/posts.jsonl
  python voice/analyze.py --in my.jsonl --top 20

Writes voice/data/voice-evidence.md: format performance, hook patterns, style
habits, repeated phrases, and your best and worst posts word for word. Hand
that file plus prompts/build-voice.md to your AI assistant to write VOICE.md.

Numbers in the packet are computed from your posts only. Nothing is estimated.
Standard library only.
"""
import argparse
import json
import re
import statistics
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent

STOP = set("""a an the and or but if then so to of in on for with at by from as is are was were be been being it its
this that these those i you he she we they me my your our their his her them us not no do does did have has had will
would can could should just than too very what when where who why how all any some more most other into over about up
out also there here one get got like really make made want need know think going go dont im its youre thats""".split())

EMOJI = re.compile("[\U0001F300-\U0001FAFF\u2600-\u27BF]")
EM_DASH = "\u2014"
LIST_LINE = re.compile(r"^\s*(\d+[.)]|[-*\u2022\u2192>])\s+")

FORMATS = [
    # (name, test) checked in order; first match wins
    ("hot-take", lambda t, first: bool(re.search(r"\b(unpopular opinion|hot take|stop |is dead|overrated|nobody|everyone is wrong|controversial)", first, re.I))),
    ("how-to", lambda t, first: bool(re.search(r"\b(how to|here'?s how|step[- ]by[- ]step|steps|playbook|framework)\b", first, re.I))),
    ("list", lambda t, first: sum(bool(LIST_LINE.match(l)) for l in t.splitlines()) >= 3),
    ("story", lambda t, first: bool(re.match(r"^(i|we|my|last|yesterday|today|\d+ (years|months|weeks) ago)\b", first, re.I))
                               and bool(re.search(r"\b(was|were|had|did|got|went|lost|learned|realized)\b", t, re.I))),
    ("announcement", lambda t, first: bool(re.search(r"\b(launch(ed|ing)?|shipped|introducing|just released|now live|new:)", first, re.I))),
    ("question", lambda t, first: t.rstrip().endswith("?")),
    ("long-form", lambda t, first: len(t) > 900),
    ("one-liner", lambda t, first: len(t) <= 120),
]


def load(path):
    rows = []
    for line in Path(path).read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))
    return rows


def first_line(text):
    for l in text.splitlines():
        if l.strip():
            return l.strip()
    return ""


def classify(text):
    first = first_line(text)
    for name, test in FORMATS:
        if test(text, first):
            return name
    return "other"


def score(p):
    """Engagement score. Uses the counts you have; reposts and replies weigh double likes."""
    parts = [p.get("likes"), p.get("reposts"), p.get("replies")]
    if all(v is None for v in parts):
        return None
    likes, reposts, replies = (v or 0 for v in parts)
    return likes + 2 * reposts + 2 * replies


def words(text):
    return [w for w in re.findall(r"[a-z][a-z'\-]+", text.lower().replace("\u2019", "'")) if w not in STOP and len(w) > 2]


def ngrams(text, n):
    ws = re.findall(r"[a-z0-9']+", text.lower())
    return [" ".join(ws[i:i + n]) for i in range(len(ws) - n + 1)]


def pct(n, d):
    return f"{(100 * n / d):.0f}%" if d else "n/a"


def analyze(posts, top=15):
    n = len(posts)
    if not n:
        return "# Voice evidence\n\nNo posts found. Run voice/pull_posts.py first.\n"
    for p in posts:
        p["_format"] = classify(p["text"])
        p["_score"] = score(p)
    scored = [p for p in posts if p["_score"] is not None]
    med = statistics.median([p["_score"] for p in scored]) if scored else None
    dates = sorted(p["created_at"] for p in posts if p.get("created_at"))
    out = ["# Voice evidence", ""]
    out.append(f"Posts: {n}. Platforms: {', '.join(sorted({p['platform'] for p in posts}))}. "
               f"Date range: {dates[0][:10] if dates else '?'} to {dates[-1][:10] if dates else '?'}.")
    if scored:
        out.append(f"Engagement score = likes + 2 x reposts + 2 x replies. Median score: {med:g} ({len(scored)} posts with numbers).")
    else:
        out.append("No engagement numbers in this data, so the packet shows style only, not performance.")
    out += ["", "## 1. Formats", "", "| Format | Posts | Share | Median score | vs overall median |", "|---|---|---|---|---|"]
    by = {}
    for p in posts:
        by.setdefault(p["_format"], []).append(p)
    rows = []
    for f, ps in by.items():
        ss = [p["_score"] for p in ps if p["_score"] is not None]
        m = statistics.median(ss) if ss else None
        rel = f"{m / med:.2f}x" if (m is not None and med) else "n/a"
        rows.append((m if m is not None else -1, f"| {f} | {len(ps)} | {pct(len(ps), n)} | {'' if m is None else f'{m:g}'} | {rel} |"))
    out += [r for _, r in sorted(rows, reverse=True)]
    out += ["", "Formats are guessed from simple text rules (see FORMATS in analyze.py). Treat them as a starting point.", ""]

    out += ["## 2. Hooks (first lines)", ""]
    firsts = [first_line(p["text"]) for p in posts]
    lens = [len(f) for f in firsts]
    q_first = sum(f.endswith("?") for f in firsts)
    num_first = sum(bool(re.match(r"^[$]?\d", f)) for f in firsts)
    me_first = sum(bool(re.match(r"^(i|we|my)\b", f, re.I)) for f in firsts)
    out.append(f"First-line length: median {statistics.median(lens):g} characters. "
               f"Questions: {pct(q_first, n)}. Starts with a number: {pct(num_first, n)}. "
               f"Starts with I/We/My: {pct(me_first, n)}.")
    openers = Counter(" ".join(f.split()[:2]).lower() for f in firsts if f)
    common = [f'"{o}" ({c})' for o, c in openers.most_common(12) if c > 1]
    out += ["", "Most common openers (first two words): " + (", ".join(common) if common else "none repeated"), ""]

    out += ["## 3. Style habits", ""]
    texts = [p["text"] for p in posts]
    med_len = statistics.median(len(t) for t in texts)
    med_lines = statistics.median(len([l for l in t.splitlines() if l.strip()]) for t in texts)
    emoji = sum(bool(EMOJI.search(t)) for t in texts)
    dashes = sum(EM_DASH in t for t in texts)
    tags = sum(bool(re.search(r"(^|\s)#\w", t)) for t in texts)
    links = sum("http" in t for t in texts)
    lower = sum(bool(re.match(r"^[a-z]", first_line(t))) for t in texts)
    ends_q = sum(t.rstrip().endswith("?") for t in texts)
    lists = sum(sum(bool(LIST_LINE.match(l)) for l in t.splitlines()) >= 2 for t in texts)
    out.append(f"- Median length: {med_len:g} characters; median lines: {med_lines:g}.")
    out.append(f"- Uses emoji: {pct(emoji, n)}. Em dashes: {pct(dashes, n)}. Hashtags: {pct(tags, n)}. Links in post: {pct(links, n)}.")
    out.append(f"- Starts lowercase: {pct(lower, n)}. Ends with a question: {pct(ends_q, n)}. Has a list: {pct(lists, n)}.")
    vocab = Counter(w for t in texts for w in set(words(t)))
    out.append("- Words you lean on: " + ", ".join(w for w, c in vocab.most_common(30) if c >= 3))
    phrases = Counter(g for t in texts for g in set(ngrams(t, 3)) if not all(w in STOP for w in g.split()))
    rep = [f'"{g}" ({c})' for g, c in phrases.most_common(40) if c >= 3][:20]
    out += ["- Repeated phrases: " + (", ".join(rep) if rep else "none repeated 3+ times"), ""]

    def block(title, ps):
        res = [f"## {title}", ""]
        for i, p in enumerate(ps, 1):
            meta = f"score {p['_score']}" if p["_score"] is not None else "no numbers"
            res.append(f"### {i}. {p['_format']}, {meta}, {p.get('created_at', '')[:10]} {p.get('url', '')}".rstrip())
            res += ["", "```text", p["text"], "```", ""]
        return res

    if scored:
        best = sorted(scored, key=lambda p: p["_score"], reverse=True)[:top]
        worst = sorted(scored, key=lambda p: p["_score"])[:max(3, top // 3)]
        out += block(f"4. Top {len(best)} posts (verbatim)", best)
        out += block(f"5. Bottom {len(worst)} posts (verbatim)", worst)
    else:
        recent = sorted(posts, key=lambda p: p.get("created_at", ""), reverse=True)[:top]
        out += block(f"4. {len(recent)} most recent posts (verbatim)", recent)
    return "\n".join(out).rstrip() + "\n"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--in", dest="inp", default=str(HERE / "data" / "posts.jsonl"))
    ap.add_argument("--out", default=str(HERE / "data" / "voice-evidence.md"))
    ap.add_argument("--top", type=int, default=15)
    args = ap.parse_args(argv)
    md = analyze(load(args.inp), args.top)
    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    Path(args.out).write_text(md, encoding="utf-8")
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()
