# Automations (opt-in)

Three small Trigger.dev jobs that watch your own X posts:

1. **Poll** (every 30 min): records your new originals and quote posts. Replies and reposts are ignored.
2. **Check** (every 15 min): exactly one impressions check per post, about 2 hours after it went live. If the post passed your bar (default 1,000 impressions) it gets a **plug**: a fixed, human-written reply with a tracked link. Posts below the bar are never re-checked and never plugged.
3. **Repost** (every 15 min): optionally reposts a post that passed the bar from your own account, a few hours later.

**Everything that writes to X is off by default.** Read [../docs/x-rules.md](../docs/x-rules.md) before you turn anything on.

| Switch | Default | What it does |
|---|---|---|
| `PLUG_ENABLED` | off | Turns on the plug step. |
| `PLUG_MODE` | `notify` | `notify` sends you the exact reply text (Slack/Discord webhook) and you post it by hand. `reply` posts it through the X API. |
| `AUTO_RT_ENABLED` | off | One repost of each post that passed the bar, `AUTO_RT_FIRST_HOURS` (default 4) after it went live. |
| `AUTO_RT_BUMPS_ENABLED` | off | Second switch. Adds up to 2 "bumps" (un-repost then repost). This is the riskiest behaviour in the repo. |
| `AUTO_RT_DAILY_WRITE_CAP` | 6 | Hard cap on repost writes per UTC day. Extra slots wait for the next day. |

With both `PLUG_ENABLED` and `AUTO_RT_ENABLED` off, the jobs do nothing and make no X API calls.

## How it fails

- Bad plug config (placeholder `example.com` URL, link inside the copy, copy too long, duplicate ids) while `PLUG_ENABLED` is on: the poll and check jobs stop before calling X and show as failed in Trigger.dev. Nothing is posted.
- A post without a usable timestamp is ignored.
- A plug reply that X rejects is recorded as failed, you are told, and it is **not** retried.
- The reply attempt is saved *before* it is sent. If a run dies mid-send, that post is left as "outcome unknown" and never plugged again, so no post can get two plugs.
- A repost or bump interrupted by a dead run is marked failed and you are told. It is never retried automatically.
- The daily write cap counts each successful repost/un-repost at the time it happened.
- X quota, billing or rate-limit errors abort the run (shown as failed in Trigger.dev, no retries) and put the work back so the next run can pick it up. Retrying billed calls in a loop is how you get a surprise bill.
- A bump that un-reposted but could not repost tells you so you can repost by hand.
- A check that is more than `PLUG_CHECK_MAX_LATE_MINUTES` late (deploy gap, outage) expires instead of plugging an old post.
- Missing X keys or `DATABASE_URL`: every job logs a warning and exits successfully without doing anything.

## Setup

You need: an X developer app with **Read and Write** user-context keys (OAuth 1.0a) for your own account, a Trigger.dev project (free tier is enough for this volume), and any Postgres database.

1. `npm install`
2. Run `migrations/001_init.sql` once against your database (`psql "$DATABASE_URL" -f migrations/001_init.sql`). It is idempotent.
3. Edit `src/plugs.config.ts`: your copy, your URLs, your campaign names. With `PLUG_ENABLED` on, the jobs refuse to run while any URL is still `example.com`, and `npm run deploy` warns you.
4. In the Trigger.dev dashboard, set the environment variables from [`../.env.example`](../.env.example) (section "automations"). Keep `PLUG_MODE=notify` for the first week.
5. `export TRIGGER_PROJECT_REF=proj_...` then `npx trigger.dev@4.7.3 login` and `npm run deploy`.
6. The dashboard should list three scheduled tasks: `ce-poll-posts`, `ce-check-posts`, `ce-repost-slots`.

Smoke test: post something, wait about 2.5 hours. If it passed the bar you get a notify message with the reply text. Check `ce_posts` for a row with `status = passed`.

## Pause

- Everything: set `PLUG_ENABLED=false` and `AUTO_RT_ENABLED=false` (takes effect on the next run).
- One post: `update ce_rt_slots set status = 'skipped', error = 'manual' where post_id = '<id>' and status = 'pending';`

## Cost

The X API is pay-per-use. Every poll is a read, every check reads impressions, a plug with a link is a "post with URL" write (the most expensive post type), and each repost or un-repost is a write. Current prices: see [../docs/x-rules.md](../docs/x-rules.md#cost) and your X Developer Console.

## Tests

```bash
npm test        # node --test, no network, no database
npm run typecheck
```

Tests cover the OAuth 1.0a signature (X's documented example), plug validation and UTM links, rotation, the impressions bar, notify vs reply, fail-closed paths, quota handling, repost planning, bumps and the daily cap. They use an in-memory store and a fake X client, so a green run does not prove a live post went out. The smoke test above is the end-to-end proof.
