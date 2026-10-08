# Release checklist (maintainers)

Run this before every public push of this repo, and before making a fork public.

## Before the first push

- [x] Replace `ORG` in the README clone URL with the real GitHub owner (`MitchellkellerLG`).
- [ ] The repo is a fresh `git init`: `git log --all --oneline` shows only commits made for this repo, and no commit carries history from any private repo.
- [ ] Commits use a public author name/email you are happy to publish.

## Every release

- [ ] `scripts/check.sh` passes (Python tests, Node tests, typecheck, scan).
- [ ] `gitleaks detect --no-git --source .` and `gitleaks detect --source .` (history) are clean.
- [ ] Private denylist scan is clean: `DENYLIST_FILE=../denylist.private.txt scripts/scan.sh`. The denylist lives **outside** the repo and lists private names, ids, project refs, client names and internal tool names, one per line.
- [ ] `git ls-files` shows no `.env`, no `voice/data`, no `gather/data`, no inbox notes, no render output except `assets/demo.gif` and the example `preview.png`.
- [ ] Open every binary that ships (`assets/demo.gif`, `preview.png`, fonts) and look at it. No private names, numbers, faces or logos.
- [ ] `src/plugs.config.ts` still holds `example.com` placeholders (the code refuses to run with them).
- [ ] Every example handle, URL and voice file is fictional.
- [ ] Re-read the X Automation Rules, Developer Guidelines and pricing page. Update `docs/x-rules.md` and its "as of" date if anything changed.
- [ ] Check that Typefully's CLI commands named in `repurpose/typefully.md` still exist.
- [ ] Anonymous smoke test: clone into a temp folder with no credentials, run `scripts/check.sh`, render the example scene, run `voice/` on the test fixtures.
- [ ] Owner go/no-go before the repo goes public.
