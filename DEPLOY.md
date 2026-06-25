# BaliDoc — How it's set up & how to ship changes

A short, honest runbook so future changes are quick and safe. Read the first
section once — it's the thing that caused a lot of confusion before.

## The setup (important!)

There are **two machines**, and they are NOT the same box:

| | Machine | What it is |
|---|---|---|
| **Dev** | `penguin` (this computer, where you edit code in VS Code) | Your working copy. It can run a local test build, pointed at a throwaway test database. Changing things here does **not** affect the live site. |
| **Production** | DigitalOcean droplet **`206.189.200.138`** (`ssh root@206.189.200.138`) | The **live site** at http://206.189.200.138:3000 and the **real database** (the 10 team users + all projects). |

- The **real data lives in a Postgres container *on the droplet*** (`simple-asana-db-1`, database `simplepm`). It is *not* Neon. The `DATABASE_URL` in dev `.env.local` points at a separate Neon test DB — that's only for local dev, it is not production.
- The droplet runs the app with Docker Compose (`/opt/simple-asana`). The app container rebuilds from the repo; the database container holds the data and must never be recreated with `-v`.
- Login is email/password. Team logins are in `LOGIN_GUIDE_SIDNEY.md` (shared starter password). Admin: `sidney@balidoc.com`.

## Ship a change (the normal loop)

```bash
# 1. edit code in this repo, then:
git add -A && git commit -m "what you changed"
./deploy.sh
```

`./deploy.sh` pushes `main`, **backs up the production DB first**, pulls + rebuilds
on the droplet, and verifies the site is up with your data counts. That's the whole loop.

## Backups

- Every `./deploy.sh` writes a fresh DB backup to `/opt/backups/` on the droplet.
- A cron job also backs up daily at 03:00 (keeps the last 14 days). See `/opt/backup-db.sh` on the droplet.

### Restore a backup (if a deploy ever goes wrong)
```bash
ssh root@206.189.200.138
ls -t /opt/backups/                      # pick the file from before the problem
gunzip -c /opt/backups/simplepm_<TS>.sql.gz | docker exec -i simple-asana-db-1 psql -U postgres -d simplepm
```

## Handy commands
```bash
ssh root@206.189.200.138 'cd /opt/simple-asana && docker-compose logs --tail 80 app'   # app logs
ssh root@206.189.200.138 'docker ps'                                                    # container status
ssh root@206.189.200.138 'docker exec simple-asana-db-1 psql -U postgres -d simplepm -c "SELECT email,role FROM \"User\";"'  # list users
```

## Known rough edges (not blocking, worth fixing later)
- The site is **HTTP only** (no domain/TLS). Fine for internal use; add a domain + HTTPS before anything sensitive. Google OAuth would also need HTTPS.
- 1-vCPU droplet: builds use the 2 GB swapfile that was added (`/swapfile`).
