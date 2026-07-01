# Simple Asana — Developer Handoff / Onboarding

This is the Project Hub / task portal running at **http://206.189.200.138:3000**.
This doc answers the three things a new developer needs: the environment layout, where
production secrets live (and how to read them), and how admin access works.

> ⚠️ **HIPAA system.** Task and comment content is encrypted at rest with
> `PHI_ENCRYPTION_KEY` (AES-256-GCM, see [src/lib/encryption.ts](src/lib/encryption.ts)).
> **Never** paste real secrets into chat, email, tickets, or this repo, and **never**
> rotate `PHI_ENCRYPTION_KEY` without re-encrypting existing data — a new key makes all
> existing task/comment content permanently unreadable.

## 1. Environment layout

There are **two** environments — there is **no separate staging**:

| Env | Where | DB | Config source |
|-----|-------|----|---------------|
| **Local dev** | your laptop | Neon **test** DB (`ep-ancient-sound…`) — throwaway data | `.env.local` in the repo |
| **Production** | droplet `206.189.200.138` | containerized Postgres `simple-asana-db-1`, database `simplepm` | `/opt/simple-asana/.env` **on the droplet** |

- `.env.local` is **local only**. It is *not* prod config, which is why it only shows the
  1-user/8-task test data.
- Prod secrets are **not in git**. [docker-compose.yml](docker-compose.yml) uses `${VAR}`
  interpolation, so Docker Compose reads them from a `.env` file sitting next to it at
  **`/opt/simple-asana/.env`** on the box. `.env.example` in the repo is just the template
  (key names, no values).
- Deploys: [deploy.sh](deploy.sh) pushes `main`, backs up the prod DB, then
  `git pull` + `docker-compose up -d --build` over SSH on the droplet.

## 2. Production secrets — where they are and how to read them

You get **SSH access to the droplet** (which you need to operate prod anyway). Read the
values there rather than having them relayed:

```bash
ssh root@206.189.200.138
cat /opt/simple-asana/.env          # all prod secrets
```

Critical keys in that file:

- `DATABASE_URL` — the real prod DB; points at the `db` container
  (`postgresql://postgres:…@db:5432/simplepm`), **not** Neon.
- `PHI_ENCRYPTION_KEY` — 64-hex (32-byte) AES key. Must match prod exactly or encrypted
  content can't be read/written. **Do not rotate** (see warning above).
- `NEXTAUTH_SECRET` — session/JWT signing.
- `SEED_SECRET` — gates the `/api/admin/seed-users` and `/api/admin/import` endpoints.

Direct prod DB shell:

```bash
docker exec -it simple-asana-db-1 psql -U postgres -d simplepm
```

## 3. Admin access

Roles are `ADMIN` / `MEMBER` ([prisma/schema.prisma](prisma/schema.prisma)). NextAuth puts
the role in the session ([src/lib/auth.ts](src/lib/auth.ts)); API routes and the admin
layout gate on `session.user.role === "ADMIN"`
([src/app/(app)/admin/layout.tsx](src/app/(app)/admin/layout.tsx)).

`development@balidoc.com` is promoted to ADMIN via the **seed roster** — it's listed as
`ADMIN` in the `TEAM` array in
[src/app/api/admin/seed-users/route.ts](src/app/api/admin/seed-users/route.ts), so a
re-seed enforces the role and never demotes it. Trigger a re-seed on the droplet:

```bash
curl -X POST http://localhost:3000/api/admin/seed-users \
  -H "x-seed-secret: $(grep '^SEED_SECRET=' /opt/simple-asana/.env | cut -d= -f2)"
# -> "development@balidoc.com: role updated to ADMIN"
```

Log out/in afterward to refresh your session role.

Other supported promotion mechanisms (for reference):

- **PATCH `/api/admin/users`** with `{ userId, role: "ADMIN" }` as an existing admin —
  writes a `USER_ROLE_CHANGED` audit-log entry. (The admin Users *page* UI is still a
  placeholder, so call the API directly for now.)
- **Direct SQL:** `UPDATE "User" SET role='ADMIN' WHERE email='development@balidoc.com';`
  — fastest, but no audit trail and a re-seed will re-enforce the roster.

## Housekeeping

- Seeded accounts get a default password `Balidoc2026!`
  ([seed-users/route.ts](src/app/api/admin/seed-users/route.ts)) — change it on first login.
- If `SEED_SECRET` is ever exposed, rotate it in `/opt/simple-asana/.env` and redeploy.
- Deployment machine notes and DB restore steps live in `docs/DEPLOY.md`.
