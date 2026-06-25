#!/usr/bin/env bash
#
# Undo a deploy. Reverts a commit and redeploys (with the usual DB backup).
#
#   ./rollback.sh           # undo the most recent commit on main
#   ./rollback.sh <sha>     # undo a specific commit (e.g. a feedback fix —
#                           #   see the Feedback.resolvedCommit column)
#
# Code is reverted via git. If a change also corrupted DATA, restore the
# pre-deploy DB backup instead — see docs/DEPLOY.md → "Restore a backup".
#
set -euo pipefail

TARGET="${1:-HEAD}"

if [ -n "$(git status --porcelain)" ]; then
  echo "✗ You have uncommitted changes. Commit or stash them first."
  exit 1
fi

echo "Reverting commit: $TARGET"
git revert --no-edit "$TARGET"

echo "Redeploying the reverted code..."
./deploy.sh

echo "✅ Rolled back $TARGET and redeployed."
echo "   (If data also needs undoing, restore a /opt/backups snapshot — see docs/DEPLOY.md.)"
