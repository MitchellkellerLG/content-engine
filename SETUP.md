# First run

About an hour end to end. You can stop after any step and still have something useful.

## 0. Answer these first

Write the answers down (a note in `gather/inbox/` is fine). The skills ask for them if they can't find them.

1. **Who is this for?** One sentence on the reader you want.
2. **Which accounts?** X handle, LinkedIn yes/no.
3. **What can never be posted?** Clients, money, private people, anything under NDA. This becomes `BOUNDARIES.md`.
4. **What counts as a good post for you?** Pick a number (impressions, replies, bookmarks). This sets `PLUG_MIN_IMPRESSIONS` and your winners list.
5. **What do you want to point people to?** A newsletter, a product, a video. This becomes your plug copy.
6. **Who approves posts?** Default: you, every time.

## 1. Voice (15 min)

```bash
cp .env.example .env
python3 voice/pull_posts.py x-archive path/to/twitter-archive/data/tweets.js
python3 voice/analyze.py
```

Give `voice/prompts/build-voice.md` and `voice/data/voice-evidence.md` to your AI assistant. Edit what it writes into `voice/data/out/`. See `voice/examples/fictional-voice/` for the shape.

No archive? Use `x-api` with `X_BEARER_TOKEN`, or a CSV of your posts. Details in `voice/README.md`.

## 2. Gather (10 min)

```bash
set -a; . ./.env; set +a
python3 gather/make_winners.py --top 40         # needs posts with engagement numbers
python3 gather/build_context.py
```

Then run `gather/prompts/daily-brief.md` with your assistant. Add `bookmarks.py` and `github_activity.sh` when you have the tokens. Schedule it daily once you like the output.

## 3. Skills (5 min)

Copy or symlink the folders in `skills/` into your assistant's skills folder (for Claude Code: `~/.claude/skills/`). Then ask: "Draft a post from today's brief."

## 4. Repurpose (10 min)

```bash
pip install playwright && python3 -m playwright install chromium   # or set CHROME_PATH
python3 repurpose/graphics/render.py repurpose/graphics/examples/three-steps --stills --theme default
```

Set your handle and domain in the scene's `footer`. For Typefully, install their CLI (see `repurpose/typefully.md`).

## 5. Automations (30 min, optional)

Read `docs/x-rules.md` first. Then follow `automations/README.md`: create a Postgres database, run the migration, put your real plug copy and links in `src/plugs.config.ts`, set env vars in Trigger.dev, and deploy. Leave `PLUG_MODE=notify` for the first couple of weeks and check that the notifications match what you would have done by hand.
