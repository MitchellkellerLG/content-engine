# X rules, risks and cost

**As of 2026-10-08.** X changes its rules and prices often. Re-read the official pages before you switch anything on, and again whenever you change a setting:

- X Automation Rules: https://help.x.com/en/rules-and-policies/x-automation
- X Developer Guidelines: https://docs.x.com/developer-guidelines
- X Developer Policy: https://developer.x.com/en/developer-terms/policy
- X API pricing: https://docs.x.com/x-api/getting-started/pricing (your Developer Console shows the live rates)

This page is our reading of those pages, not legal advice. You run the automations on your own account, at your own risk.

## What each switch means under X's rules

| Feature | Default | Our read of the rules | How the code limits it |
|---|---|---|---|
| Reading your own posts and metrics | on when anything else is on | Fine. Standard API use within rate limits. | One read every 30 min, one metrics check per post. |
| Reading your bookmarks (`gather/bookmarks.py`) | manual | Fine for personal use. | You run it. Stops at the first bookmark it has seen. |
| **Plug reply, notify mode** | off | Nothing is posted by software. You post the reply yourself. | `PLUG_MODE=notify` is the default once plugs are on. |
| **Plug reply, reply mode** | off | Gray area. The developer guidelines say automated replies are allowed "only if the user engaged first", and AI reply bots need X's approval. A reply to *your own* post with fixed copy you wrote looks like the most defensible case, but X doesn't address it directly. X may also restrict which accounts can post replies through the API; if your replies come back with an error, use notify mode. | Fixed copy only (never AI-generated), one reply per post, only posts above your impressions bar, never retried on failure, refuses to run with placeholder config. |
| **Self-repost** (`AUTO_RT_ENABLED`) | off | The guidelines list reposting as OK for informational content with "no bulk spam". | Only posts that passed your bar, one repost each, a daily write cap. |
| **Repost bumps** (`AUTO_RT_BUMPS_ENABLED`) | off | Un-reposting and reposting the same post to resurface it is the behaviour most likely to look like manipulation. | Needs a second switch, max 2 bumps, counts toward the daily cap, missed bumps are dropped rather than fired back to back. |
| Likes, follows, DMs, replies to other people | not in this repo | Prohibited or heavily restricted for automation. | Not implemented. Don't add them. |
| Browser automation / scraping | not in this repo | Prohibited ("official API only"). | Not implemented. |

If you run automation on an account, X may also expect the account to carry the "Automated" label. Read the Automation Rules page and decide for your account.

## Cost

The X API is prepaid, pay-per-use. Rates as shown on the pricing page on 2026-10-08 (they change; your Developer Console is the source of truth):

| Request | Price |
|---|---|
| Post: Create | $0.015 per request |
| Post: Create **with a URL** (every plug reply) | $0.200 per request |
| User Interaction: Create (a repost) | $0.015 per request |
| Interaction: Delete (an un-repost) | $0.010 per request |
| Posts: Read (metrics lookup) | $0.005 per post returned |
| Owned Reads (your own posts, bookmarks and similar, when the app belongs to you) | $0.001 per resource |

So a plug costs about 13 times a plain post. The impressions bar is what keeps this cheap: only posts that already did well get a plug. Put a spending limit on your X developer account before you turn on reply mode.

Trigger.dev and a small Postgres database both have free tiers that cover this volume at the time of writing; check their pricing pages.

## Typefully and replies

Typefully's API can create and schedule posts, threads, quote posts and LinkedIn posts, and its CLI can create X reply drafts (`--reply-to`). X limits which accounts can post replies through the API, so a scheduled reply may fail to publish. If you want "link in the first comment" on X, post that reply by hand.

## LinkedIn

This repo never logs into, scrapes or automates LinkedIn. LinkedIn data comes only from your own data export, and LinkedIn posts go out only as Typefully drafts you approve.
