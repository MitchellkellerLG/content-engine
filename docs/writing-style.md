# Writing style for X and LinkedIn

## Spacing
- One blank line between every block.
- Each block is 1-2 sentences, starts with a capital, and has no period at the end.
- List items each get their own spaced line.

## Voice
- Casual, like a text, with long conversational sentences.
- No clipped fragments, slogan endings, rhythm triads or em dashes.
- Longer detailed posts by default. Short punchy POV-style quote tweets with a strong reaction GIF are fine for meme formats.
- Present alternatives as options or ways, not steps.
- Give the sauce: concrete how-to and what works, not what's holding people back. Avoid negative framing.

## Links and credit
- Write domains broken and unlinked, like "x dot com".
- When it's your own article, quote-tweet it instead of linking it.
- Referral or affiliate links go in the first comment. A "link in the comments" line is fine only when the comment really carries a link; never as filler.
- Quote tweets use a GIF or video, never a still.
- Credit borrowed ideas by handle.
- Use only real numbers, each traceable to a source.

## Review before posting
1. Compare the draft against your real top posts.
2. Run an anti-slop and voice review (see `skills/no-ai-slop`). The review prompt must contain the real final text: grep-check it, e.g. `grep -F "$(head -1 post.md)" review_prompt.txt`.
3. Ignore reviewer rewrites that add periods, triads or em dashes.
4. Nothing posts without the owner's yes.

## Scheduling (Typefully)
- If the CLI draft update crashes on null platforms, use the REST API: GET the draft, back it up, PATCH only the changed text while keeping `media_ids` and `quote_post_url`, then GET again and compare.
- Never print API keys.
- Publish now by setting `publish_at` to the current time. Avoid the web editor for text edits; it can wipe a draft.
- Replies can't be published through the API, so save first comments as reply drafts and post them by hand.
