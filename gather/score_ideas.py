#!/usr/bin/env python3
"""Score the ideas in a daily brief against scoring/rubric.md and your winners.

  # print the scoring prompt (paste it into any AI chat)
  python gather/score_ideas.py gather/data/brief-2026-01-12.md --print-prompt

  # or let a command-line AI score it: the prompt goes to the command's stdin,
  # and it must print a JSON array (see the prompt for the shape)
  LLM_CMD="claude -p" python gather/score_ideas.py gather/data/brief-2026-01-12.md
  LLM_CMD="codex exec --skip-git-repo-check -" python gather/score_ideas.py ...

Scores are clamped to each criterion's max and re-added here, so a model can't
hand out 110/100. The closest winner must be a URL from your winners.csv.
Writes <brief>-scores.csv and <brief>-scores.md next to the brief.
"""
import argparse
import csv
import json
import os
import re
import shlex
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
RUBRIC = HERE / "scoring" / "rubric.md"
MAX = {"hold": 20, "send": 15, "proof": 20, "hook": 15, "topic": 15, "real_work": 10, "tools": 5}
PENALTY_MIN = -15


def parse_brief(text):
    text = re.split(r"^## Runners-up", text, flags=re.M)[0]
    ideas = []
    for blk in re.split(r"^(?=## \d+\.)", text, flags=re.M):
        h = re.match(r"## (\d+)\.\s*(.+)", blk)
        if not h:
            continue
        hook = re.search(r"\*\*Hook:\*\*\s*(.+)", blk)
        ideas.append({"n": int(h.group(1)), "title": h.group(2).strip(),
                      "hook": hook.group(1).strip() if hook else "", "body": blk.strip()})
    return ideas


def load_winners(path):
    p = Path(path)
    if not p.exists():
        return []
    with open(p, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def build_prompt(ideas, winners, rubric):
    w = "\n".join(f"- {r.get('url', '')} | {r.get('format', '')} | score {r.get('score', '')} | {r.get('hook', '')}" for r in winners[:60])
    i = "\n\n".join(f"### Idea {x['n']}: {x['title']}\n{x['body']}" for x in ideas)
    keys = ", ".join(f'"{k}" (0-{v})' for k, v in MAX.items())
    return f"""Score each content idea using this rubric.

{rubric}

My past winners:
{w or '(none yet)'}

Ideas:
{i}

Return ONLY a JSON array, one object per idea:
{{"n": <idea number>, {keys}, "penalty" (-15 to 0), "closest_winner": "<url from my winners or empty>", "reason": "<one sentence>"}}
"""


def extract_json(out):
    m = re.search(r"\[\s*\{.*\}\s*\]", out, re.S)
    if not m:
        raise ValueError("no JSON array in model output")
    return json.loads(m.group(0))


def finalize(raw, ideas, winners):
    urls = {r.get("url", "") for r in winners}
    by_n = {int(r.get("n", -1)): r for r in raw if isinstance(r, dict)}
    rows = []
    for idea in ideas:
        r = by_n.get(idea["n"], {})
        crit = {}
        for k, mx in MAX.items():
            try:
                crit[k] = max(0, min(mx, int(round(float(r.get(k, 0))))))
            except (TypeError, ValueError):
                crit[k] = 0
        try:
            pen = max(PENALTY_MIN, min(0, int(round(float(r.get("penalty", 0))))))
        except (TypeError, ValueError):
            pen = 0
        closest = r.get("closest_winner", "") if r.get("closest_winner", "") in urls else ""
        rows.append({"n": idea["n"], "title": idea["title"], **crit, "penalty": pen,
                     "score": max(0, sum(crit.values()) + pen), "closest_winner": closest,
                     "reason": str(r.get("reason", "")).strip() or ("not scored" if not r else "")})
    return sorted(rows, key=lambda x: x["score"], reverse=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("brief")
    ap.add_argument("--winners", default=str(HERE / "scoring" / "winners.csv"))
    ap.add_argument("--print-prompt", action="store_true")
    args = ap.parse_args(argv)
    brief = Path(args.brief)
    ideas = parse_brief(brief.read_text(encoding="utf-8"))
    if not ideas:
        sys.exit("No '## N. Title' ideas found in the brief")
    winners = load_winners(args.winners)
    prompt = build_prompt(ideas, winners, RUBRIC.read_text(encoding="utf-8"))
    cmd = os.environ.get("LLM_CMD")
    if args.print_prompt or not cmd:
        print(prompt)
        if not cmd and not args.print_prompt:
            print("\n(Set LLM_CMD to score automatically.)", file=sys.stderr)
        return
    res = subprocess.run(shlex.split(cmd), input=prompt, capture_output=True, text=True, timeout=900)
    if res.returncode != 0:
        sys.exit(f"LLM_CMD failed ({res.returncode}): {res.stderr[-500:]}")
    rows = finalize(extract_json(res.stdout), ideas, winners)
    stem = brief.with_suffix("")
    with open(f"{stem}-scores.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    md = ["| # | Idea | Score | Closest winner | Why |", "|---|---|---|---|---|"]
    md += [f"| {r['n']} | {r['title']} | {r['score']} | {r['closest_winner']} | {r['reason']} |" for r in rows]
    Path(f"{stem}-scores.md").write_text("\n".join(md) + "\n", encoding="utf-8")
    print("\n".join(md))


if __name__ == "__main__":
    main()
