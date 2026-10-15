---
name: repurpose
description: Use when turning an X post that already performed into a LinkedIn post, an animated graphic and a quote post, and scheduling them as Typefully drafts after the author approves.
---
# Repurpose

1. Pick the post (the author names it, or take the best recent post from `voice/data/posts.jsonl` / their analytics). Confirm it with the author.
2. LinkedIn: follow `repurpose/prompts/x-to-linkedin.md`. Then the `no-ai-slop` pass.
3. Graphic: copy `repurpose/graphics/examples/three-steps` to a new folder, write `scene.js` using only words from the post, set the author's handle and site in `Kit({...})`, then `python repurpose/graphics/render.py <folder> --theme dark-theme,light-theme --stills 1.5 4 10` (dark and light, same layout). Look at the stills; fix overlaps; then `--video --strict`.
4. Quote post: follow `repurpose/prompts/quote-post.md`.
5. Show the author the LinkedIn text, the first-comment link, the quote post text, the dark and light GIF/MP4 (quote tweets never use stills), and the proposed times. Respect one visual post per day on X.
6. Only after an explicit yes: upload media and create the drafts with the Typefully CLI (`repurpose/typefully.md`). List drafts and confirm.

Never log into, scrape or automate LinkedIn. Typefully drafts only.
