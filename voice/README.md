# Build your voice.md

A voice file is the thing your AI reads before it drafts anything for you. Without one, every draft sounds like everyone else's. This folder builds one from your own posts in three steps, about 15 minutes, no API key required if you use an export.

```bash
# 1. Collect your posts (pick one)
python voice/pull_posts.py x-archive ~/Downloads/twitter-archive/data/tweets.js
python voice/pull_posts.py csv ~/Downloads/Shares.csv --preset linkedin-shares
python voice/pull_posts.py x-api --user-id <your numeric id>      # needs X_BEARER_TOKEN

# 2. Build the evidence packet (formats, hooks, habits, best and worst posts)
python voice/analyze.py

# 3. Give your AI assistant voice/prompts/build-voice.md + voice/data/voice-evidence.md
#    It fills in the templates and you edit the result.
```

Output lives in `voice/data/` (git-ignored); your finished files go in `voice/data/out/`, which is where `gather/` and the skills look for them. Your posts never leave your machine unless you paste them into an AI tool yourself.

## The files

| File | What goes in it | Who writes it |
|---|---|---|
| `VOICE.md` | How you write: rhythm, hooks, words you use and never use, real example lines | Drafted from evidence, edited by you |
| `OPINIONS.md` | What you believe, with the post that shows it. Newest wins unless you mark it contested | You, with suggestions from evidence |
| `BOUNDARIES.md` | Topics, claims and tones that are off limits | You |
| `TOPICS.md` | Index of what you talk about, pointing at deeper notes if you have them | Drafted, edited by you |

Templates are in `templates/`. A complete **fictional** example is in `examples/fictional-voice/` so you can see what "done" looks like.

## Rules that keep it honest

- Quote real lines. Every example in VOICE.md should be something you actually posted.
- No invented numbers. If the packet has no engagement data, the voice file says nothing about performance.
- Keep it short. A voice file over ~1,500 words stops being read carefully by models. Put depth in `topics/` and link it from TOPICS.md.
- Build your own voice only. Do not use this to imitate someone else.
- Re-run every month or two. Your voice drifts; the file should follow.

## Where LinkedIn data comes from

Only your own data export (LinkedIn > Settings > Data privacy > Get a copy of your data > Shares.csv). This repo does not scrape LinkedIn and does not automate LinkedIn in any way.
