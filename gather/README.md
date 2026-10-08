# Gather: a daily ideas brief from what you actually did

Most "content idea" tools hand you other people's topics. This one starts from your own material: what you shipped, what you bookmarked, what came up on calls. Then it ranks ideas against your past winners.

```bash
# once: pick your past winners (needs posts with numbers, see voice/)
python gather/make_winners.py --top 40

# every morning
python gather/bookmarks.py --user-id <your numeric id>          # new X bookmarks
GITHUB_OWNERS="you your-org" gather/github_activity.sh 24 > gather/data/github.md
#   ...drop any call notes into gather/inbox/
python gather/build_context.py                                  # -> gather/data/context-<date>.md

# give your AI assistant gather/prompts/daily-brief.md + the context file
#   -> gather/data/brief-<date>.md

# rank the ideas
LLM_CMD="claude -p" python gather/score_ideas.py gather/data/brief-<date>.md
```

| File | What it does | Needs |
|---|---|---|
| `bookmarks.py` | New X bookmarks since last run, as a short digest | `X_OAUTH2_USER_TOKEN` (bookmark.read) |
| `github_activity.sh` | PRs and commits from the last N hours across your repos | `gh` CLI, logged in |
| `inbox/` | Anything you drop in: call notes, transcripts, voice memos | nothing |
| `build_context.py` | Bundles all of the above + VOICE.md + winners into one file | nothing |
| `prompts/daily-brief.md` | Turns the context into 3-7 ideas with hook, beats, risk and source | any AI assistant |
| `score_ideas.py` + `scoring/rubric.md` | Scores each idea 0-100 vs your winners, clamps the math | any CLI model via `LLM_CMD`, or paste the prompt |
| `make_winners.py` | Picks your best past posts from `voice/data/posts.jsonl` | posts with engagement numbers |

Everything writes to `gather/data/` and `gather/inbox/`, both git-ignored. Run it by hand, from cron, or as a scheduled task in your AI assistant.

The brief prompt has three rules worth keeping even if you change everything else: never invent a number, keep private things private, and say what you held back.
