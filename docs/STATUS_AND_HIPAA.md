# Simple Asana (BaliDoc) — How it works today & the path to HIPAA

_Last updated: 2026-06-27._

This is the plain-English picture of **how the app works right now** and **exactly what
it still needs to safely hold real patient data (PHI)**. For implementation detail on
Google sign-in + TLS, see [README_HIPAA.md](README_HIPAA.md).

---

# Part 1 — How the app works today

## What it is
An internal project & task hub for the BaliDoc team: admins organize work into
projects/boards and hand tasks to people; everyone sees and completes the tasks
assigned to them. Branded "BaliDoc".

## Architecture & hosting
- **Stack:** Next.js 14 (App Router) + TypeScript, Prisma ORM, PostgreSQL, Tailwind.
- **Hosting:** a single **DigitalOcean droplet** (`206.189.200.138`) running **Docker
  Compose** — two containers: the app and its own Postgres. Data lives in a Docker
  volume on that droplet (not a managed DB).
- **Access:** `http://206.189.200.138:3000` — **plain HTTP, no TLS yet.**
- **Deploys:** `./deploy.sh` from the dev machine (push → back up prod DB → rebuild →
  verify). Daily DB backups via cron (03:00, keeps 14) + a backup before every deploy.

## Authentication & roles
- **Email + password** (NextAuth Credentials), restricted to `@balidoc.com` addresses.
  Google Workspace sign-in is **built but disabled**.
- A **shared default password** (`Balidoc2026!`) seeded for the team — convenient, not safe for PHI.
- **Roles:** `ADMIN` (Sidney, Bart) and `MEMBER`. Admins see everything; members see
  only projects they're on. 30-minute idle **session timeout** with a warning.

## Data model & what counts as PHI
- **Projects → Columns (To Do / In Progress / In Review / Done) → Tasks → Subtasks.**
  Tasks have assignee, due date, priority, status, comments, attachments.
- **Sensitive fields are encrypted at rest** with AES-256-GCM (`src/lib/encryption.ts`):
  task **title, description**, the extended task fields, and **comment bodies**. The
  encryption key is `PHI_ENCRYPTION_KEY`.
- **Plaintext** (not treated as PHI): project names, user names/emails, audit logs,
  feedback. Treat any free-text a user types into a task/comment as **potential PHI**.
- **Audit log** (`AuditLog`) records access/changes (task viewed/created/updated/deleted,
  comments, logins, role changes, etc.).

## Features
- **Kanban boards** with drag-and-drop (reorder within a column + move across columns),
  in-column "+ Add task", search + assignee filter.
- **Tasks & Asana-like subtasks** — subtasks open in their own panel (nestable),
  are assignable, and drag-to-reorder. Task detail opens as a drawer.
- **Comments** — clickable links, edit/delete, **@mentions** (autocomplete).
- **@mention emails** — emailing the mentioned teammate (see "email" below). _(interim, non-HIPAA)_
- **Global search** across projects + tasks.
- **Smart Discovery / AI** — generates a structured task (title, description, subtasks)
  from a short form, using **OpenAI gpt-4o-mini**.
- **In-app AI feedback** — users describe issues; AI structures them; stored for triage.
- **Asana import → Staging → Distribute** (admin) — imported the team's Asana projects
  into a hidden, admin-only staging area; admins copy/AI-expand tasks into real projects.
  See [ASANA_STAGING.md](ASANA_STAGING.md).
- **Attachments** — uploaded to a Google Drive Shared Drive via a service account.

## Third-party services that touch the data (the "BAA surface")
| Service | Used for | Sees PHI? |
|---|---|---|
| **DigitalOcean** | hosting the app + database | Yes (hosts everything) |
| **OpenAI** | Smart Discovery, AI-from-subtask, feedback triage | **Yes** — task/comment text is sent to it |
| **Google Workspace / Drive** | file attachments; the email relay sends from info@balidoc.com Gmail | Yes (attachments; email bodies) |
| **Google Apps Script relay** | sends @mention emails via Gmail | Yes (email contains a comment snippet) |
| **Asana** (one-time) | source of the imported tasks | Held the data originally; not an ongoing flow |

## Security already in place ✅
PHI-field encryption at rest · role/membership access control · audit logging · session
timeout · domain-restricted login · daily encrypted-at-rest-volume backups · secrets in
env (not in code) · security headers (HSTS/X-Frame-Options/etc.).

---

# Part 2 — What it needs to be HIPAA-compliant

> **Bottom line:** the app has good bones (encryption, audit, access control) but is
> **not yet safe for real PHI**. The blockers are mostly **infrastructure, contracts
> (BAAs), and a few data-flow changes** — not big rewrites.

### Status at a glance
| Requirement | Today | Needed |
|---|---|---|
| Encryption **in transit** (HTTPS/TLS) | ❌ HTTP only | **Required** |
| Encryption **at rest** (PHI fields) | ✅ AES-256-GCM | Improve key management |
| Strong per-user auth + MFA | ❌ shared password | **Required** |
| BAAs with all PHI vendors | ❌ none signed | **Required** |
| PHI not leaked to non-BAA services | ❌ OpenAI + email | **Required** |
| Audit logging | ✅ built | Retain 6 yrs, monitor |
| Backups & disaster recovery | ⚠️ daily dumps | Encrypt + offsite + tested restore |
| Policies, risk analysis, training | ❌ | **Required (administrative)** |

### The steps, in priority order

**1. Turn on HTTPS/TLS + a real domain.** PHI must never travel over plain HTTP. Put the
app behind Caddy or Nginx+Certbot (auto Let's Encrypt) on a real domain and set
`NEXTAUTH_URL=https://…`. _(Details in [README_HIPAA.md](README_HIPAA.md).)_

**2. Fix authentication.** Remove the shared password; switch to **Google Workspace SSO**
(already wired, domain-restricted) or enforce per-user strong passwords + a reset flow.
Require **MFA** (Workspace can enforce this). Disable the self-register route for PHI.

**3. Sign BAAs (Business Associate Agreements) with every vendor that touches PHI:**
   - **Hosting** — DigitalOcean offers a BAA on eligible plans, or move to a HIPAA-eligible
     host/managed DB. Without it, the host can't legally hold PHI.
   - **Google Workspace** — covers Drive (attachments) and Gmail **if** on a BAA-covered
     Workspace plan with the right controls.
   - **OpenAI** — sign OpenAI's BAA (Enterprise/API with zero-data-retention) **or** stop
     sending PHI to it (see step 4).
   - **Any email provider** you adopt later (SendGrid/Resend/etc.).

**4. Stop PHI leaking to AI.** Smart Discovery, AI-from-subtask, and feedback triage send
task/comment text to **OpenAI**. Either (a) get the OpenAI BAA + zero-retention, or
(b) gate AI so it never runs on real patient data, or (c) self-host the model. Until one
of these, don't put PHI in AI-assisted flows.

**5. Remove PHI from emails.** The @mention email currently includes a **comment snippet**
(potential PHI) and is sent via the Gmail/Apps Script relay — **interim, not HIPAA-safe**.
For PHI, switch to **deep-link-only** emails ("You were mentioned on a task — click to
view") with **no task/comment content**, sent through a BAA-covered channel. _(One small
code change in `src/app/api/tasks/[taskId]/comments/route.ts` → `notifyMentions`.)_

**6. Harden key & secret management.** `PHI_ENCRYPTION_KEY` and other secrets live in the
droplet's `.env`. Move to a secrets manager / KMS, restrict access, enable **full-disk
encryption** on the droplet, and define a **key-rotation** procedure.

**7. Backups & disaster recovery.** Backups exist but must be **encrypted, stored offsite
in BAA-covered storage**, **retention-defined**, and have a **tested restore** runbook.

**8. Audit log retention & monitoring.** Keep audit logs **6 years**, make them
tamper-resistant, and add monitoring/alerting for suspicious access.

**9. Administrative safeguards (the non-technical half of HIPAA).** Conduct a formal
**risk analysis**, write **security & privacy policies**, run **workforce training**,
and document an **incident-response + breach-notification** plan. Apply **minimum
necessary** access and a **data retention/disposal** policy.

### Interim items that are explicitly NOT HIPAA-safe right now
- Plain **HTTP** (no TLS).
- **Shared password**, no MFA.
- **OpenAI** receives task/comment text with no BAA.
- **@mention emails** contain a comment snippet, sent via Gmail relay (no BAA on that flow).
- No BAAs signed with DigitalOcean / OpenAI.
- Imported **Asana staging** data may contain PHI and lives in the same DB.

**Do not enter real patient data until at least steps 1–5 are done and the BAAs are signed.**
