# Simple Asana — HIPAA-Compliant Project Management MVP

A healthcare team tool for secure, encrypted task management with audit logging. Built with Next.js, Prisma, and AES-256-GCM encryption.

## Quick Start

### 1. Environment Setup

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required environment variables:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_URL` — Your app URL (e.g., http://localhost:3000)
- `NEXTAUTH_SECRET` — Generate: `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — From Google Cloud Console
- `PHI_ENCRYPTION_KEY` — 64-char hex key: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
- `ALLOWED_EMAIL_DOMAIN` — Your organization's email domain (e.g., yourhospital.org)
- `GOOGLE_SERVICE_ACCOUNT_KEY_B64` — Base64-encoded Google Drive service account JSON (optional for file uploads)

### 2. Local Development

Install dependencies:
```bash
npm install
```

Generate Prisma client:
```bash
npx prisma generate
```

Start the dev server:
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

**Database:** You'll need PostgreSQL running locally or via Docker:
```bash
docker run -d \
  --name simple-asana-db \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

Create the database:
```bash
npx prisma db push
```

### 3. Docker Deployment

Build and run with Docker Compose:

```bash
docker-compose up --build
```

This will:
1. Start PostgreSQL
2. Build the Next.js app
3. Run Prisma migrations automatically
4. Start the app on http://localhost:3000

### 4. Production Deployment

Set all environment variables in your production environment (AWS, Azure, GCP, etc.).

Build for production:
```bash
npm run build
npm start
```

Or use the Docker image:
```bash
docker build -t simple-asana .
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  simple-asana
```

## Features

✅ **Google OAuth Login** — Domain-restricted sign-in  
✅ **Kanban Board** — Drag-and-drop task management  
✅ **PHI Encryption** — All sensitive data encrypted at rest (AES-256-GCM)  
✅ **Audit Log** — Complete activity trail for compliance  
✅ **Comments** — Team discussion on tasks (encrypted)  
✅ **File Attachments** — Secure storage in Google Drive  
✅ **Session Timeout** — 30-minute auto-logout with warning  
✅ **Role-Based Access** — Admin and Member roles  
✅ **HIPAA-Ready** — Encryption, audit logging, access control  

## Architecture

```
├── src/
│   ├── app/                 # Next.js pages & API routes
│   │   ├── (auth)/login     # Google OAuth page
│   │   ├── (app)/           # Protected routes
│   │   │   ├── dashboard    # My tasks
│   │   │   ├── projects     # Project list & kanban board
│   │   │   └── admin/       # User mgmt & audit log
│   │   └── api/             # 15 REST endpoints
│   ├── components/          # React components
│   │   ├── board/           # Kanban: KanbanBoard, Column, TaskCard
│   │   └── tasks/           # TaskDetailPanel, Comments, Attachments
│   └── lib/                 # Core utilities
│       ├── auth.ts          # NextAuth config
│       ├── encryption.ts    # AES-256-GCM encrypt/decrypt
│       ├── audit.ts         # Audit log helper
│       ├── drive.ts         # Google Drive API
│       └── prisma.ts        # DB client singleton
├── prisma/
│   └── schema.prisma        # 9 data models
├── docker-compose.yml       # PostgreSQL + app
├── Dockerfile               # Multi-stage production build
└── .env.example             # Environment template
```

## API Routes

### Projects
- `GET /api/projects` — List user's projects
- `POST /api/projects` — Create project (admin)
- `GET /api/projects/[id]` — Get project details
- `PATCH /api/projects/[id]` — Update project (admin)
- `DELETE /api/projects/[id]` — Delete project (admin)
- `GET /api/projects/[id]/members` — List members
- `POST /api/projects/[id]/members` — Add member (admin)
- `DELETE /api/projects/[id]/members?userId=...` — Remove member (admin)

### Tasks (PHI Encrypted)
- `POST /api/tasks` — Create task
- `GET /api/tasks/[id]` — Get task (auto-decrypt)
- `PATCH /api/tasks/[id]` — Update task
- `DELETE /api/tasks/[id]` — Delete task
- `GET /api/tasks/[id]/comments` — List comments
- `POST /api/tasks/[id]/comments` — Add comment (encrypted)
- `GET /api/tasks/[id]/attachments` — List attachments
- `POST /api/tasks/[id]/attachments` — Upload file to Drive
- `DELETE /api/tasks/[id]/attachments?attachmentId=...` — Delete attachment

### Admin
- `GET /api/admin/users` — List all users
- `PATCH /api/admin/users` — Change role / deactivate user
- `GET /api/admin/audit-log` — Paginated audit log

## Security

### Encryption
All PHI (task titles, descriptions, comments) is encrypted with **AES-256-GCM** before storage.

Encryption happens explicitly in route handlers—no automatic middleware encryption to prevent accidental leaks.

### Audit Log
Every PHI access and change is logged to an **append-only** audit table.

The database role has `INSERT`-only permissions on `AuditLog`—even if the app is compromised, logs cannot be modified.

### Session Management
- **30-minute timeout** for HIPAA compliance
- **Server-side check** on every request (JWT validation)
- **Client-side warning** at 25 minutes with countdown modal
- **Activity tracking** resets timeout on user interaction

### Access Control
- **Domain restriction** — Only users from ALLOWED_EMAIL_DOMAIN can sign in
- **Project membership** — Users only see projects they're members of
- **Role-based endpoints** — Admin-only routes check role in JWT
- **User deactivation** — Admins can deactivate accounts; login is immediately rejected

## Development

### Database Migrations

Create a new migration after schema changes:
```bash
npx prisma migrate dev --name descriptive_name
```

Review and push migrations to production:
```bash
npx prisma migrate deploy
```

View database:
```bash
npx prisma studio
```

### Building

Development build:
```bash
npm run dev
```

Production build:
```bash
npm run build
npm start
```

Type-check only:
```bash
npm run lint
```

## Testing

The MVP is feature-complete but not yet tested. Recommended next steps:

- [ ] E2E tests (Playwright) for auth, project CRUD, kanban operations
- [ ] Load test with 14+ concurrent users
- [ ] HIPAA compliance audit (encryption strength, audit trail retention)
- [ ] Accessibility audit (WCAG 2.1 AA)

## Known Limitations

- **No real-time updates** — Refresh page to see changes from teammates
- **Admin UI incomplete** — API routes work; UI pages are placeholders
- **Single database** — No multi-tenancy
- **Google Drive only** — File storage tied to Google Drive BAA
- **Manual time entries** — No automatic time tracking

## Roadmap

### Phase 2 (Post-MVP)
- [ ] Finish admin UI (user management, audit log viewer)
- [ ] Search & filtering
- [ ] Task templates
- [ ] Real-time updates (WebSockets or Server-Sent Events)
- [ ] Email notifications
- [ ] CSV import/export

### Phase 3
- [ ] Mobile app (React Native)
- [ ] Slack/Teams integration
- [ ] Time tracking
- [ ] Custom fields
- [ ] Workflow automation (Zapier, IFTTT)

## Support

For questions or issues, check the plan file:
```bash
cat /home/barthofstee555/.claude/plans/we-want-to-make-valiant-mountain.md
```

Built with [Claude Code](https://claude.com/claude-code).
