# Simple Asana — MVP

An internal project-management tool for the BaliDoc team: an admin creates projects and assigns work; workers see and complete their assigned tasks. Built with Next.js 14, Prisma, PostgreSQL, and AES-256-GCM encryption for sensitive fields.

> This README describes the **MVP as currently deployed** (email/password login, staging on a single VPS).
> For the production, HIPAA-hardened version with Google Workspace sign-in, see **[README_HIPAA.md](README_HIPAA.md)**.

---

## What it does

- **Email + password login**, restricted to `@balidoc.com` addresses. (Google sign-in is built but disabled for the MVP.)
- **Admin / worker roles:**
  - **Admin** (`sidney@balidoc.com`) creates projects, sees **all** boards, and manages members.
  - **Workers** see **only** the projects they've been assigned to.
- **Smart Discovery** task creation — an 8-question flow that turns intent into a well-formed task with AI-generated description and subtasks:
  1. Task name (required → becomes the title)
  2. Objective (required)
  3. Problem / current situation
  4. Key stakeholders
  5. Acceptance criteria
  6. Blockers / risks
  7. Complexity
  8. **Automation opportunity** (what's manual today, what it should become)
- **Quick Task** for simple to-dos.
- **Kanban board** (To Do / In Progress / In Review / Done) with drag-and-drop, color-coded priority (High=red, Medium=yellow, Low=green), subtask progress (`✓ 2/7`), and overdue dates in red.
- **Task detail panel** — always-editable fields, status, priority, due date, **assign to any team member**, subtasks (add/complete/delete), an **⚡ Automation Opportunity** field, comments, and file attachments.
- **Assignment** — assigning a task to someone **auto-grants them access** to that project.
- **File attachments** stored in a Google Drive Shared Drive (service account).
- **PHI fields encrypted at rest** (AES-256-GCM) and **audit logging** of access/changes.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) + TypeScript |
| DB | PostgreSQL + Prisma (schema synced via `prisma db push`) |
| Auth | NextAuth v4 — Credentials (email/password); Google provider present but disabled |
| Encryption | Node `crypto` AES-256-GCM (lazy key validation) |
| AI | OpenAI (`gpt-4o-mini`) for Smart Discovery |
| Files | Google Drive API (service account → Shared Drive) |
| Deploy | Docker Compose on a VPS (DigitalOcean droplet) |

---

## Environment variables

Set these in a `.env` file (used by `docker-compose.yml`):

```
DB_PASSWORD=               # Postgres password (DATABASE_URL is built from this in compose)
NEXTAUTH_URL=              # e.g. http://206.189.200.138:3000
NEXTAUTH_SECRET=           # openssl rand -base64 32
PHI_ENCRYPTION_KEY=        # 64 hex chars: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ALLOWED_EMAIL_DOMAIN=balidoc.com
OPENAI_API_KEY=            # enables Smart Discovery AI
GOOGLE_SERVICE_ACCOUNT_KEY_B64=   # base64 of the Drive service-account JSON (for attachments)
GOOGLE_DRIVE_FOLDER_ID=    # the Shared Drive ID files upload into
SEED_SECRET=               # secret for the one-time team-roster seed endpoint
NEXT_TELEMETRY_DISABLED=1
# GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET — only needed if you re-enable Google sign-in
```

---

## Run locally

```bash
npm install
npx prisma generate

# Postgres (or use your own)
docker run -d --name simple-asana-db -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16-alpine
npx prisma db push      # create tables

npm run dev             # http://localhost:3000
```

---

## Deploy (Docker on a VPS)

Full step-by-step is in **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**. Short version, on the server:

```bash
git pull origin main
docker-compose up -d --build      # builds app, starts Postgres, runs `db push` on startup
docker-compose logs -f app        # wait for "Ready"
```

The Dockerfile is multi-stage and tuned for small VPS instances (raised Node heap, lint/type-check skipped in the image build, OpenSSL installed for Prisma on Alpine, `prisma db push` on container start).

### Seed the team roster (one-time)

After the first deploy, create the 10 team accounts:

```bash
curl -s -X POST http://localhost:3000/api/admin/seed-users \
  -H "x-seed-secret: <SEED_SECRET>"
```

Creates (all `@balidoc.com`, default password **`Balidoc2026!`**):
`sidney` (**ADMIN**), `asima`, `adel`, `ani`, `cindy`, `drbintang`, `drkarina`, `drmona`, `bart`, `meilinda`.
The seed is idempotent and never overwrites an existing password.

### Fresh start (wipe all data)

```bash
docker-compose down -v      # ⚠️ deletes the DB volume — all projects/tasks/accounts
docker-compose up -d --build
# then re-run the seed
```

---

## Key API routes

- `POST /api/auth/register` — self-register (email/password, domain-checked)
- `GET /api/users` — team roster (for assignment dropdowns)
- `POST /api/admin/seed-users` — one-time roster seed (secret-guarded)
- `GET/POST /api/projects` — list (admin=all, worker=assigned) / create (admin only)
- `GET/PATCH/DELETE /api/projects/[id]` — admins or members
- `GET/POST/DELETE /api/projects/[id]/members` — manage who's on a project
- `POST /api/tasks`, `GET/PATCH/DELETE /api/tasks/[id]` — tasks (PHI encrypted; assignment auto-adds member)
- `.../comments`, `.../attachments` — encrypted comments, Drive uploads
- `POST /api/ai/generate-task-with-subtasks` — Smart Discovery synthesis

---

## Testing

- **[TEST_SPECIFICATION.md](TEST_SPECIFICATION.md)** — full functional/edge/security suite + product-gap analysis
- **[TEST_ROUND2.md](TEST_ROUND2.md)** — fast verification of the latest fixes/features (good to feed a browser-automation tester)

---

## Before this handles real patient data (pre-production checklist)

This MVP is **not yet production-safe for PHI**. See **[README_HIPAA.md](README_HIPAA.md)** for the full plan. Minimum:

- [ ] **HTTPS + a real domain** (currently HTTP only — required for HIPAA)
- [ ] **Switch to Google Workspace sign-in** (domain-restricted) or add a password-change/reset flow
- [ ] **Rotate** the service-account key and any secrets shared during setup
- [ ] **Automated database backups**
- [ ] Replace the shared default password; enforce per-user credentials

---

## Known limitations (MVP)

- HTTP only on staging; no automated backups yet
- One shared default password for seeded accounts; no password-change UI yet
- No real-time updates (refresh to see teammates' changes)
- Dashboard page is a placeholder (Projects page is the main view)
- Schema synced via `db push` (no migration history)

Built with [Claude Code](https://claude.com/claude-code).
