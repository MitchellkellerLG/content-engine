# Scheduling with Typefully

We use Typefully's own open-source CLI and agent skill (MIT, [typefully/agent-skills](https://github.com/typefully/agent-skills)). Install it from upstream rather than copying it:

```bash
npx skills add typefully/agent-skills      # installs the skill + scripts/typefully.js
./scripts/typefully.js setup               # asks for your API key and default social set
```

Your API key comes from Typefully settings > API. Store it the way the setup command suggests or as `TYPEFULLY_API_KEY` in your shell. Never commit it.

Typical commands (check `--help`, the CLI changes):

```bash
./scripts/typefully.js social-sets:list
./scripts/typefully.js media:upload graphic_1080p.mp4
./scripts/typefully.js drafts:create --platform linkedin --text "$(cat post.txt)" --media <media_id>
./scripts/typefully.js drafts:create --platform x --text "$(cat qt.txt)" --media <media_id> \
    --quote-post-url https://x.com/<you>/status/<id> --schedule <YYYY-MM-DDTHH:MM:00Z>
./scripts/typefully.js drafts:list --status scheduled --sort scheduled_date
```

Things that bit us:
- **Check that X replies actually go out.** The CLI can create an X reply draft (`--reply-to <post url>`), but X limits which accounts can post replies through the API, so a scheduled reply may fail to publish. After the scheduled time, check that the "first comment with the link" is really there, or post it by hand.
- Upload media first and pass the media id; uploads can take a minute to process before a draft accepts them.
- Schedule times are ISO 8601. Write them in UTC with a `Z` so a timezone mix-up can't move your post.
- Always list drafts after creating them and read the exact text that will go out.
