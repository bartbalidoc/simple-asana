#!/usr/bin/env bash
#
# View team feedback from the production database (feedback is NOT stored in
# files in this repo — it lives in the Postgres "Feedback" table on the droplet).
#
#   ./feedback.sh           # all feedback, newest first
#   ./feedback.sh NEW       # only NEW items (also: TRIAGED, FIXED, NEEDS_OWNER, WONT_FIX)
#
set -euo pipefail

STATUS="${1:-}"
SQL='SELECT "createdAt"::timestamp(0) AS submitted, status, category, complexity, title, summary, "rawText" FROM "Feedback"'
if [ -n "$STATUS" ]; then
  SQL="$SQL WHERE status='$STATUS'"
fi
SQL="$SQL ORDER BY \"createdAt\" DESC;"

# -x prints each row vertically (readable for long text); -P pager=off won't block.
echo "$SQL" | ssh -o BatchMode=yes root@206.189.200.138 \
  'docker exec -i simple-asana-db-1 psql -U postgres -d simplepm -x -P pager=off'
