# Simple Asana — HIPAA Production Build (Google Workspace Sign-In)

This document describes how to run Simple Asana as a **HIPAA-appropriate production system** for handling Protected Health Information (PHI), using **Google Workspace OAuth** for sign-in instead of the MVP's email/password.

> The day-to-day MVP (email/password, staging) is documented in **[README.md](README.md)**.
> This file is the **production hardening + Google-auth** path. Do **not** enter real patient data until every item in the checklist below is done.

---

## Why a separate build

The MVP traded some controls for speed (email/password, HTTP, shared passwords, single VPS). For PHI you need: a signed **BAA** with your infrastructure providers, **encryption in transit (HTTPS)**, **strong authentication**, **auditability**, and **backups/retention**. Google Workspace (with a BAA) gives you compliant identity + file storage, which is why the production build uses Google OAuth and Google Drive.

---

## HIPAA controls in this app

| Control | How it's implemented | Status |
|---|---|---|
| Encryption at rest (PHI) | AES-256-GCM on task titles, descriptions, comments, subtask titles, etc. (`src/lib/encryption.ts`) | ✅ Built |
| Encryption in transit | HTTPS via reverse proxy (Nginx/Caddy) + TLS | ⚠️ Must configure |
| Access control | Project membership + ADMIN/MEMBER roles | ✅ Built |
| Domain-restricted identity | Google `signIn` callback rejects non-`ALLOWED_EMAIL_DOMAIN` accounts | ✅ Built (enable Google) |
| Audit logging | `AuditLog` rows on PHI read/write (`src/lib/audit.ts`) | ✅ Built |
| Session timeout | 30-min idle timeout + client warning (`SessionTimeoutWarning`) | ✅ Built |
| Backups & retention | Automated `pg_dump` to BAA-covered storage | ⚠️ Must configure |
| BAA | Google Workspace (auth + Drive); your hosting provider | ⚠️ Must sign |

---

## Switching from MVP (email/password) to Google sign-in

The Google provider is already wired in `src/lib/auth.ts`; it's just turned off in the UI. To go to production auth:

### 1. Create OAuth credentials (Google Cloud Console)
- **APIs & Services → OAuth consent screen** → Internal (Workspace) → fill app details.
- **APIs & Services → Credentials → Create OAuth client ID → Web application.**
- **Authorized redirect URI:** `https://YOUR_DOMAIN/api/auth/callback/google`
- Copy the **Client ID** and **Client Secret**.

### 2. Set environment variables
```
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
ALLOWED_EMAIL_DOMAIN=balidoc.com
NEXTAUTH_URL=https://YOUR_DOMAIN
```

### 3. Enable the Google button + (optionally) disable password login
In `src/app/(auth)/login/page.tsx` set `googleEnabled = true`. For a PHI deployment, also remove/disable the Credentials form and the `/api/auth/register` route so the **only** way in is Google (domain-restricted). The `authorize`/`signIn` callbacks in `src/lib/auth.ts` already enforce the domain and `isActive` checks.

### 4. Provision users via Google, not the seed
Drop the MVP `seed-users` flow (shared password). With Google sign-in, a user's account is created on first successful domain-restricted login (`jwt` callback). Admins are promoted via `PATCH /api/admin/users`.

---

## HTTPS (required)

Real PHI must not travel over plain HTTP. Put the app behind TLS. Simplest robust option is **Caddy** (auto Let's Encrypt) or **Nginx + Certbot** in front of the container:

```
# Caddyfile
your-domain.com {
  reverse_proxy app:3000
}
```

Then `NEXTAUTH_URL=https://your-domain.com` and the Google redirect URI must match exactly. A sample Nginx TLS config is in **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)**.

---

## Database: migrations, backups, retention

- **Use Prisma migrations** (not `db push`) so schema changes are reviewable and reversible:
  ```bash
  npx prisma migrate dev --name <change>     # in development
  npx prisma migrate deploy                  # in CI/production
  ```
  (Update the Dockerfile start command from `prisma db push` to `prisma migrate deploy`.)
- **Automated backups** to BAA-covered storage:
  ```bash
  docker compose exec -T db pg_dump -U postgres simplepm | gzip > backup-$(date +%F).sql.gz
  # ship to encrypted, access-controlled storage; define a retention policy
  ```
- Consider **managed Postgres** with a BAA (or ensure your VPS provider's BAA covers the DB host).
- Audit-log retention: keep `AuditLog` append-only and retain per your compliance policy.

---

## Key & secret management

- `PHI_ENCRYPTION_KEY` is the master key for all PHI. Store it in a secrets manager, **never in git**, and have a rotation/`re-encrypt` plan.
- Rotate any key/secret that was ever pasted into a chat, ticket, or screen-share.
- The Google **service-account key** (Drive) should be least-privilege (Drive scope only) and rotated periodically.
- `NEXTAUTH_SECRET` rotation invalidates sessions (acceptable; users re-login).

---

## Google Drive for attachments (BAA-covered)

- Use a **Shared Drive** owned by the Workspace org (service accounts have no personal quota).
- Add the service account as **Content manager**; set `GOOGLE_DRIVE_FOLDER_ID` to the Shared Drive ID.
- Enable the **Google Drive API** in the project.
- Because the files may contain PHI, ensure the Workspace BAA covers Drive and that sharing is restricted to the domain.

---

## Production deployment checklist

- [ ] BAA signed with Google Workspace **and** the hosting provider
- [ ] HTTPS/TLS terminating in front of the app; HSTS on (already set in `next.config.mjs`)
- [ ] Google OAuth enabled; email/password + self-register disabled
- [ ] `ALLOWED_EMAIL_DOMAIN` set; non-domain accounts rejected (verify)
- [ ] `PHI_ENCRYPTION_KEY` 32-byte, in a secrets manager, backed up, rotation plan documented
- [ ] `NEXTAUTH_SECRET` strong and secret
- [ ] Prisma **migrations** (not `db push`) in the deploy pipeline
- [ ] Automated, encrypted **database backups** + tested restore
- [ ] Audit log verified (TASK_VIEWED/CREATED/UPDATED, COMMENT_CREATED, sign-in, session timeout) and append-only
- [ ] Session timeout confirmed (30 min) with warning dialog
- [ ] Admin can deactivate a user and login is immediately rejected
- [ ] Drive attachments land in the BAA-covered Shared Drive; sharing domain-restricted
- [ ] Security headers present (CSP/HSTS/X-Frame-Options) — see `next.config.mjs`
- [ ] Penetration/access review before go-live

---

## What still needs building for full production readiness

- **Account lifecycle**: with Google auth, offboarding = disable in Workspace; verify the app honors `isActive`.
- **Admin UI**: user management + audit-log viewer pages (API exists; finish the UI).
- **Backups automation** + restore runbook.
- **Migrations**: generate an initial migration from the current schema and switch off `db push`.
- **Break-glass / least privilege** review of the DB role (the original design grants `AuditLog` INSERT-only).

---

See **[README.md](README.md)** for the current MVP and **[DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md)** for infrastructure specifics.

Built with [Claude Code](https://claude.com/claude-code).
