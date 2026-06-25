#!/usr/bin/env bash
#
# One-command production deploy for BaliDoc.
# Run from this dev machine (penguin) after committing your change:
#
#     git add -A && git commit -m "your change"
#     ./deploy.sh
#
# It pushes main, backs up the production DB, pulls + rebuilds on the droplet,
# and verifies the site is up with your data intact. Safe to re-run.
#
set -euo pipefail

DROPLET="root@206.189.200.138"
APP_DIR="/opt/simple-asana"
URL="http://206.189.200.138:3000"

# 0. Refuse to deploy uncommitted work (so prod always matches a real commit).
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ You have uncommitted changes. Commit them first, then re-run ./deploy.sh"
  git status --short
  exit 1
fi

echo "1/5  Pushing main to GitHub..."
git push origin main

echo "2/5  Backing up the production database..."
ssh "$DROPLET" 'mkdir -p /opt/backups && F=/opt/backups/simplepm_$(date +%Y%m%d-%H%M%S).sql.gz && \
  docker exec simple-asana-db-1 pg_dump -U postgres --no-owner simplepm | gzip > "$F" && \
  echo "     backup: $F ($(du -h "$F" | cut -f1))"'

echo "3/5  Pulling latest code on the droplet..."
ssh "$DROPLET" "cd $APP_DIR && git pull --ff-only origin main | tail -1"

echo "4/5  Rebuilding + restarting (this takes a few minutes)..."
ssh "$DROPLET" "cd $APP_DIR && docker-compose up -d --build" 2>&1 | tail -3

echo "5/5  Verifying (waiting for the app to come back up)..."
code=000
for i in $(seq 1 15); do
  sleep 4
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$URL/login")
  [ "$code" = "200" ] && break
done
echo "     site /login -> HTTP $code (after ~$((i * 4))s)"
ssh "$DROPLET" 'docker exec simple-asana-db-1 psql -U postgres -d simplepm -t -c \
  "SELECT (SELECT count(*) FROM \"User\") AS users, (SELECT count(*) FROM \"Project\") AS projects;"' \
  | xargs echo "     data: "

if [ "$code" = "200" ]; then
  echo "✅ Deploy complete — site is up."
else
  echo "⚠ Site returned $code. Check: ssh $DROPLET 'cd $APP_DIR && docker-compose logs --tail 50 app'"
  echo "   To roll back the DB: see DEPLOY.md → 'Restore a backup'."
fi
