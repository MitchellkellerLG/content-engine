# Security

## What this repo touches

| Part | Reads | Writes |
|---|---|---|
| `voice/` | Files you point it at, or your own posts via the X API | `voice/data/` on your machine |
| `gather/` | Your X bookmarks, your GitHub activity via `gh`, files in `gather/inbox/` | `gather/data/` on your machine |
| `repurpose/` | Scene files you write | PNG/MP4/GIF in each scene's `out/` |
| `automations/` | Your recent X posts and their impressions | Your Postgres database; replies/reposts on X **only** if you switch them on; a message to your webhook |

Nothing sends data anywhere you did not configure. There is no telemetry.

## Secrets

- Keep keys in `.env` (git-ignored) or your secret manager. `.env.example` lists names only.
- For the Trigger.dev jobs, set keys as environment variables in the Trigger.dev dashboard, not in code.
- Use the narrowest token that works: a read-only bearer token for `voice/`, an OAuth 2.0 user token with `bookmark.read` for bookmarks, and OAuth 1.0a user keys only for the account the automations run on.
- `NOTIFY_WEBHOOK_URL` is a secret too: anyone with it can post to your channel.
- Run `scripts/scan.sh` before you push a fork. It runs gitleaks if installed and checks for common token formats.

## Your data

`voice/data/`, `gather/data/`, `gather/inbox/` and `gather/scoring/winners.csv` hold your posts, notes and call transcripts. They are git-ignored. Do not remove those ignore rules in a public fork. If you paste them into an AI tool, that tool's data policy applies.

## Safe defaults in `automations/`

- Every write to X is off until you set a switch.
- Plug replies use fixed copy you wrote, never generated text, and refuse to run with the placeholder links.
- A failed reply is never retried. Quota or billing errors stop the run instead of retrying.
- A daily cap limits reposts.

## Reporting a problem

Please report security issues privately through GitHub's "Report a vulnerability" button on this repo rather than in a public issue. Include steps to reproduce. Don't include real tokens.
