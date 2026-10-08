#!/usr/bin/env bash
# What did you ship? Markdown digest of PRs and commits from the last N hours.
#
#   GITHUB_OWNERS="your-user your-org" gather/github_activity.sh 24 > gather/data/github.md
#
# Env:
#   GITHUB_OWNERS   space-separated users/orgs to scan (default: the gh-authenticated user)
#   GITHUB_PRIORITY regex of repo names to list first (optional)
#   GITHUB_EXCLUDE  regex of owner/repo to skip, e.g. "you/private-diary|you/finances" (optional)
# Needs the GitHub CLI (gh), logged in. Read-only.
set -euo pipefail
HOURS=${1:-24}
case "$HOURS" in ''|*[!0-9]*) echo "hours must be a number" >&2; exit 2;; esac
if date -u -d "-1 hours" >/dev/null 2>&1; then
  SINCE=$(date -u -d "-${HOURS} hours" +%Y-%m-%dT%H:%M:%SZ)
else # macOS
  SINCE=$(date -u -v-"${HOURS}"H +%Y-%m-%dT%H:%M:%SZ)
fi
OWNERS=${GITHUB_OWNERS:-$(gh api user -q .login)}
PRIORITY=${GITHUB_PRIORITY:-'^$'}
EXCLUDE=${GITHUB_EXCLUDE:-'^$'}

dump() {
  local full=$1
  echo; echo "## $full"
  gh pr list -R "$full" --state all --search "updated:>=$SINCE" --limit 30 \
    --json number,title,state,url,body \
    -q '.[] | "- PR #\(.number) [\(.state)] \(.title) \(.url)\n  \((.body // "") | gsub("\\s+";" ") | .[0:300])"' 2>/dev/null || true
  gh api "repos/$full/commits?since=$SINCE&per_page=50" \
    -q '.[] | "- commit \(.sha[0:7]) \(.commit.message | split("\n")[0])"' 2>/dev/null || true
}

first=(); rest=()
for owner in $OWNERS; do
  for repo in $(gh repo list "$owner" --limit 200 --json name,pushedAt -q ".[] | select(.pushedAt > \"$SINCE\") | .name" 2>/dev/null || true); do
    full="$owner/$repo"
    [[ $full =~ $EXCLUDE ]] && continue
    if [[ $repo =~ $PRIORITY ]]; then first+=("$full"); else rest+=("$full"); fi
  done
done

echo "# GitHub activity since $SINCE (last ${HOURS}h)"
[[ ${#first[@]} -eq 0 && ${#rest[@]} -eq 0 ]] && echo && echo "No pushes in this window."
for f in "${first[@]+"${first[@]}"}" "${rest[@]+"${rest[@]}"}"; do dump "$f"; done
