---
name: voice-builder
description: Use when the author wants a voice.md (or to refresh one) built from their own past posts. Collects posts, builds an evidence packet, and drafts VOICE.md, OPINIONS.md, BOUNDARIES.md and TOPICS.md for the author to edit.
---
# Voice builder

1. Ask which source they have: X archive (`tweets.js`), a CSV export (LinkedIn Shares.csv or a scheduler export), or the X API (`X_BEARER_TOKEN`).
2. Collect: `python voice/pull_posts.py <source> ...` -> `voice/data/posts.jsonl`. Report how many posts and the date range.
3. Evidence: `python voice/analyze.py` -> `voice/data/voice-evidence.md`. Read all of it.
4. Draft: follow `voice/prompts/build-voice.md`, using `voice/templates/` and the fictional example for shape. Write to `voice/data/out/`.
5. Hand back: the four drafts, the three things you're least sure about, and every placeholder left for the author.

Rules: only the author's own posts. Quote real lines verbatim; never write new "example" posts. No numbers that aren't in the evidence. OPINIONS entries stay "proposed" until the author confirms them.
