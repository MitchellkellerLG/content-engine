---
name: daily-brief
description: Use each morning (or when asked "what should I post") to collect the author's new bookmarks, shipped work and notes, write a ranked ideas brief in their voice, and score it against their past winners.
---
# Daily brief

1. Run what's configured (skip what isn't, and say so):
   - `python gather/bookmarks.py --user-id <id>` (needs `X_OAUTH2_USER_TOKEN`)
   - `gather/github_activity.sh 24 > gather/data/github.md` (needs `gh`; uses `GITHUB_OWNERS`)
2. `python gather/build_context.py` and read the context file it prints.
3. Follow `gather/prompts/daily-brief.md` exactly to write `gather/data/brief-<date>.md`.
4. Score it: `python gather/score_ideas.py gather/data/brief-<date>.md` with `LLM_CMD` set, or score it yourself using the printed prompt and the same JSON shape.
5. Reply with the top 3 ideas (title, hook, score, risk) and the path to the full brief. Do not draft full posts unless asked. When you ask the author to pick ideas, use a multi-select question so they can choose as many as they want.

Never invent numbers. Keep private material out and list what you held back.
