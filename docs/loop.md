# The loop

```
 gather ──> ideas ──> draft in your voice ──> no-ai-slop ──> repurpose ──> schedule (you approve)
   ^                                                                              │
   └──────────── measure: what cleared the bar becomes your next winners ─────────┘
```

| Stage | Folder | Runs |
|---|---|---|
| Gather | `gather/` (bookmarks, GitHub, inbox notes) | daily, by hand or cron |
| Ideas | `gather/prompts/daily-brief.md`, `score_ideas.py` | daily |
| Voice | `voice/` | once, then monthly |
| Draft + slop pass | `skills/content-orchestrator`, `skills/no-ai-slop` | per post |
| Repurpose | `repurpose/` (LinkedIn prompt, graphics kit, quote post) | weekly |
| Schedule | Typefully, via its own CLI | per post, after your yes |
| Measure | `automations/` (plug + optional repost), `gather/make_winners.py` | automatic / monthly |

Start with the voice file. Everything else reads it.
