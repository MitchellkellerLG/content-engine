#!/usr/bin/env bash
# Run every check that doesn't need credentials.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "== python: voice"
python3 -m unittest discover -s voice/tests -q
echo "== python: gather"
python3 -m unittest discover -s gather/tests -q
echo "== shell syntax"
bash -n gather/github_activity.sh scripts/check.sh scripts/scan.sh

if command -v npm >/dev/null 2>&1; then
  echo "== automations"
  (cd automations && { [ -d node_modules ] || npm ci --no-audit --no-fund; } && npm test --silent && npm run --silent typecheck)
else
  echo "== automations: skipped (npm not found)"
fi

echo "== scan"
scripts/scan.sh
echo "all checks passed"
