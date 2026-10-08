#!/usr/bin/env bash
# Look for secrets and private data before you push.
#   scripts/scan.sh                                   gitleaks + common token formats
#   DENYLIST_FILE=../denylist.private.txt scripts/scan.sh
#       also fails on any line of that file (case-insensitive, fixed strings).
#       Keep the denylist OUTSIDE the repo: it lists the things you must not publish.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0

files() { git ls-files --cached --others --exclude-standard 2>/dev/null || find . -type f -not -path './.git/*' -not -path '*/node_modules/*'; }

if command -v gitleaks >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  files | while IFS= read -r f; do [ -f "$f" ] && mkdir -p "$tmp/$(dirname "$f")" && cp "$f" "$tmp/$f"; done
  if ! gitleaks detect --no-git --source "$tmp" --no-banner --redact >/dev/null 2>&1; then
    echo "gitleaks: findings (run: gitleaks detect --no-git --source . --redact -v)"; fail=1
  else
    echo "gitleaks: clean"
  fi
  rm -rf "$tmp"
else
  echo "gitleaks: not installed, skipped (https://github.com/gitleaks/gitleaks)"
fi

patterns=(
  'sk-[A-Za-z0-9_-]{20,}'                # OpenAI-style keys
  'sk-ant-[A-Za-z0-9_-]{20,}'            # Anthropic keys
  'gh[pousr]_[A-Za-z0-9]{30,}'           # GitHub tokens
  'xox[abprs]-[A-Za-z0-9-]{10,}'         # Slack tokens
  'hooks\.slack\.com/services/T[A-Z0-9]+'
  'discord(app)?\.com/api/webhooks/[0-9]+'
  'tr_(dev|prod|stg)_[A-Za-z0-9]{10,}'   # Trigger.dev secret keys
  'proj_[a-z0-9]{16,}'                   # Trigger.dev project refs
  'AKIA[0-9A-Z]{16}'                     # AWS access keys
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'postgres(ql)?://[^:@/ ]+:[^@/ ]+@[^ ]*' # connection strings with a password
  '/(Users|home)/[a-z][a-z0-9_-]+/'      # absolute home paths
)
text=$(files | grep -v -E '\.(png|gif|mp4|woff2|ico|jpg)$')
list=$(printf '%s\n' "$text" | grep -v -E '(^|/)(package-lock\.json|scan\.sh)$')   # token patterns skip lockfile hashes
for p in "${patterns[@]}"; do
  hits=$(printf '%s\n' "$list" | xargs -d '\n' grep -n -I -E -e "$p" -- 2>/dev/null | grep -v 'user:password@host' || true)
  if [ -n "$hits" ]; then echo "pattern $p:"; echo "$hits" | sed 's/^/  /' | cut -c1-200; fail=1; fi
done
[ $fail -eq 0 ] && echo "token patterns: clean"

if [ -n "${DENYLIST_FILE:-}" ]; then
  if [ ! -f "$DENYLIST_FILE" ]; then echo "DENYLIST_FILE not found: $DENYLIST_FILE"; exit 2; fi
  dl_fail=0
  while IFS= read -r term || [ -n "$term" ]; do
    term="${term%%#*}"; term="$(echo "$term" | sed 's/[[:space:]]*$//')"
    [ -z "$term" ] && continue
    hits=$(printf '%s\n' "$text" | grep -v -E '(^|/)scan\.sh$' | xargs -d '\n' grep -l -i -I -F -e "$term" -- 2>/dev/null || true)
    bin=$(files | grep -E '\.(png|gif|mp4|woff2)$' | xargs -d '\n' grep -l -a -F -e "$term" -- 2>/dev/null || true)
    if [ -n "$hits$bin" ]; then echo "denylist term found in:"; printf '%s\n' $hits $bin | sed 's/^/  /'; dl_fail=1; fail=1; fi
  done < "$DENYLIST_FILE"
  [ $dl_fail -eq 0 ] && echo "denylist: clean"
fi

exit $fail
