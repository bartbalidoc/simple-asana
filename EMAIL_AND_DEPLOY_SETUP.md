# Email Notifications + Push-to-Deploy — Setup

Two one-time setups: (1) Gmail credentials so emails actually send, and
(2) GitHub secrets so a push to `main` auto-deploys to your VPS.

---

## 1. Gmail App Password (so notifications send)

Consumer Gmail SMTP needs an **App Password** (not your normal login password).
It requires 2-Step Verification on the Google account.

1. Enable 2-Step Verification: https://myaccount.google.com/security
2. Create an App Password: https://myaccount.google.com/apppasswords
   - Name it e.g. `BaliDoc SMTP`. Google shows a 16-character password.
3. Put the values in your **server** `.env` (the file docker-compose reads):

   ```env
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=info.balidoctor@gmail.com
   SMTP_PASS=<the-16-char-app-password>
   EMAIL_FROM=BaliDoc <info.balidoctor@gmail.com>
   APP_URL=https://your-domain.com      # used for deep links in emails
   EMAIL_INCLUDE_PHI=false              # keep false — emails carry no PHI
   ```

   These are already mapped into the `app` container in `docker-compose.yml`.
   If `SMTP_USER`/`SMTP_PASS` are blank, emails safely no-op (the app still works).

> Note: consumer Gmail sending is rate-limited (~500 emails/day) — fine for a
> small team. For HIPAA, do **not** set `EMAIL_INCLUDE_PHI=true` unless you move
> sending to a Google Workspace account with a signed BAA.

**Smoke test:** assign a task to *another* user (self-notifications are skipped)
and confirm they get the email with a working "Open the task" link.

---

## 2. Push-to-Deploy (GitHub Actions → your VPS)

`.github/workflows/deploy.yml` runs on every push to `main` (and via the
"Run workflow" button). It SSHes into the VPS and runs:

```bash
cd <app dir> && git pull origin main && docker-compose up -d --build && docker image prune -f
```

### Add these repo secrets
Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret         | Required | Example / default            |
|----------------|----------|------------------------------|
| `VPS_HOST`     | yes      | `203.0.113.10` or your domain |
| `VPS_USER`     | yes      | `deploy` (the SSH user)       |
| `VPS_SSH_KEY`  | yes      | the **private** key (PEM) for that user |
| `VPS_PORT`     | no       | `22` (default)                |
| `VPS_APP_DIR`  | no       | `/opt/simple-asana` (default) |

Generate a deploy key on the VPS (or locally), add the **public** half to the
VPS user's `~/.ssh/authorized_keys`, and paste the **private** half into
`VPS_SSH_KEY`.

Until those secrets are set, the workflow runs but **skips** the deploy with a
warning (so it won't fail red).

---

## Security reminder

The `origin` remote currently has a GitHub token embedded in its URL. Rotate
that token and use a credential helper instead of an in-URL token.
