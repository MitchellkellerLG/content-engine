# Repurpose: one good X post becomes a LinkedIn post, a graphic and a quote post

The flow we use, every week:

1. **Pick.** Take your posts that cleared your bar in the last few weeks (`voice/data/posts.jsonl` sorted by score, or your analytics). One idea per LinkedIn post.
2. **Rewrite, don't paste.** `prompts/x-to-linkedin.md` turns an X post into a LinkedIn post in your voice: more context up top, same proof, no hashtags.
3. **Slop pass.** Run the `no-ai-slop` skill on the draft. Read it aloud.
4. **Graphic.** Build a 14-second animated diagram of the idea with `graphics/` (MP4 for LinkedIn and X, GIF for previews).
5. **Schedule.** Create the LinkedIn draft in Typefully with the video attached ([typefully.md](typefully.md)). A human approves every post.
6. **Quote it on X.** When the LinkedIn version goes out, quote your original X post with the same video (`prompts/quote-post.md`).

Rules we follow (copy them or don't):
- Links go in the first comment, not the post body.
- At most one visual post per day on X, so they don't compete.
- Quote posts get video or a GIF, not a still.
- Nothing goes out without the author's yes on the exact final text.

Not included, on purpose: anything that logs into, scrapes or automates LinkedIn. Typefully's API is the only way this repo touches LinkedIn, and only to create drafts you approve.
