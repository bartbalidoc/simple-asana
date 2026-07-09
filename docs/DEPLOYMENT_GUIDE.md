# Simple Asana - Production Deployment Guide

## Prerequisites

Before deploying, ensure you have:

### 1. GitHub Repository
```bash
git init
git add .
git commit -m "Initial commit: Simple Asana HIPAA-compliant MVP"
git remote add origin https://github.com/bartbalidoc/simple-asana.git
git push -u origin main
```

### 2. Production Environment Variables
Create a `.env.production` file with:

```env
# Database
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
DB_PASSWORD=YOUR_SECURE_DB_PASSWORD

# NextAuth
NEXTAUTH_URL=https://your-domain.com
NEXTAUTH_SECRET=openssl_rand_base64_32_here

# Google OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret

# PHI Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
PHI_ENCRYPTION_KEY=your-256-bit-hex-key-here

# Email Domain (HIPAA compliance)
ALLOWED_EMAIL_DOMAIN=yourhospital.org

# Google Drive (for file attachments)
GOOGLE_SERVICE_ACCOUNT_KEY_B64=base64_encoded_service_account_json_here

# Anthropic Claude (transcript→tasks, proofread, rebuild, archive summaries)
ANTHROPIC_API_KEY=sk-ant-your-key-here
# Optional: override the model (default claude-opus-4-8)
# ANTHROPIC_MODEL=claude-haiku-4-5

# OpenAI (legacy — the older /api/ai/* helpers like AI task creator subtask expansion)
OPENAI_API_KEY=sk-your-openai-key-here
```

### 3. PostgreSQL Database
Options:
- **Cloud:** Neon.tech, Railway, Supabase (easiest for managed backups)
- **On-premises:** PostgreSQL 14+ with backups enabled
- **Docker:** `postgres:15` in docker-compose (requires your own backup strategy)

### 4. Google Cloud Setup
- [ ] Create Google Cloud project
- [ ] Enable Google OAuth 2.0 (get CLIENT_ID, CLIENT_SECRET)
- [ ] Enable Google Drive API
- [ ] Create Service Account (get JSON key, base64-encode it for GOOGLE_SERVICE_ACCOUNT_KEY_B64)
- [ ] Create shared Drive folder for attachments (note folder ID)

---

## Deployment Option A: VPS + Docker (Recommended for On-Premises)

### 1. Prepare VPS
```bash
# SSH into your VPS (Ubuntu 22.04)
ssh user@your-vps-ip

# Install Docker & Docker Compose
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Create app directory
mkdir -p /opt/simple-asana
cd /opt/simple-asana
```

### 2. Clone Repository
```bash
git clone https://github.com/YOUR_ORG/simple-asana.git .
```

### 3. Create Production Docker Compose
Create `.env` file with production values from Prerequisites section:
```bash
# Copy the .env.production values you prepared earlier
nano .env
```

### 4. Update docker-compose.yml for Production
```yaml
version: '3.8'

services:
  db:
    image: postgres:15
    restart: always
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: simplepm
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  app:
    build:
      context: .
      dockerfile: Dockerfile
    restart: always
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=${DATABASE_URL}
      - NEXTAUTH_URL=${NEXTAUTH_URL}
      - NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - PHI_ENCRYPTION_KEY=${PHI_ENCRYPTION_KEY}
      - ALLOWED_EMAIL_DOMAIN=${ALLOWED_EMAIL_DOMAIN}
      - GOOGLE_SERVICE_ACCOUNT_KEY_B64=${GOOGLE_SERVICE_ACCOUNT_KEY_B64}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  nginx:
    image: nginx:alpine
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - app

volumes:
  postgres_data:
```

### 5. Create Nginx Config (TLS/HTTPS)
Create `nginx.conf`:
```nginx
events {
  worker_connections 1024;
}

http {
  upstream app {
    server app:3000;
  }

  server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
  }

  server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location / {
      proxy_pass http://app;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
      proxy_set_header X-Forwarded-Proto $scheme;
    }
  }
}
```

### 6. Deploy
```bash
# Pull latest code
git pull origin main

# Start services
docker-compose up -d --build

# Check logs
docker-compose logs -f app

# Run migrations
docker-compose exec app npm run prisma:migrate:deploy
```

### 7. Verify Deployment
```bash
curl https://your-domain.com
# Should redirect to Google OAuth login
```

---

## Deployment Option B: GitHub Actions + Railway/Render

### 1. Push to GitHub
```bash
git push origin main
```

### 2. Create `.github/workflows/deploy.yml`
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Deploy to Railway
        uses: railway-app/actions@v1
        with:
          token: ${{ secrets.RAILWAY_TOKEN }}
          service: simple-asana
          
      # OR deploy to Render:
      # - name: Deploy to Render
      #   run: |
      #     curl -X POST https://api.render.com/deploy/srv-${{ secrets.RENDER_SERVICE_ID }}?key=${{ secrets.RENDER_API_KEY }}
```

---

## Post-Deployment Checklist

- [ ] Database migrations ran successfully (`docker-compose logs app | grep "Applying migration"`)
- [ ] SSL certificate is valid (no HTTPS warnings)
- [ ] Google OAuth sign-in works (test with allowed domain account)
- [ ] Create test project → create task → verify data persists after refresh
- [ ] Check audit logs show `USER_SIGNED_IN` and `PROJECT_CREATED` events
- [ ] File upload works (or shows friendly error if Google Drive not configured)
- [ ] HIPAA compliance: verify no PHI is logged in plaintext (`docker-compose logs app | grep -i "password\|token\|PHI"` should be empty)

---

## Monitoring & Backups

### Database Backups
```bash
# Daily backup to S3
docker-compose exec db pg_dump -U postgres simplepm | gzip | aws s3 cp - s3://your-backup-bucket/simple-asana-$(date +%Y%m%d).sql.gz
```

### Application Logs
```bash
# View real-time logs
docker-compose logs -f app

# Check for errors
docker-compose logs app | grep ERROR
```

### Health Check
```bash
curl https://your-domain.com/health
# Should return 200 OK
```

---

## Rolling Back

If something breaks:
```bash
# Revert to previous commit
git revert HEAD
git push origin main

# Redeploy
docker-compose down
docker-compose up -d --build
```

---

## Production Security Checklist

- [ ] HTTPS enabled (TLS 1.2+)
- [ ] PHI_ENCRYPTION_KEY is 256-bit random (not default)
- [ ] NEXTAUTH_SECRET is cryptographically random
- [ ] ALLOWED_EMAIL_DOMAIN is set to your hospital domain
- [ ] Database password is strong (20+ chars, no dict words)
- [ ] Google Cloud credentials are in environment variables (not in code)
- [ ] Regular database backups are automated
- [ ] Audit log is being written (check `/admin/audit-log` page)

---

## Troubleshooting

### App won't start
```bash
docker-compose logs app
# Look for: "Error: Cannot find module" → missing dependency
# Look for: "connect ECONNREFUSED 127.0.0.1:5432" → DB not ready
```

### Database won't initialize
```bash
docker-compose exec db psql -U postgres -c "CREATE DATABASE simplepm;"
docker-compose exec app npm run prisma:migrate:deploy
```

### Google OAuth not working
```bash
# Check env vars
docker-compose exec app env | grep GOOGLE_CLIENT
# Verify callback URL matches: https://your-domain.com/api/auth/callback/google
```

### Slow queries
```bash
# Enable slow query logging
docker-compose exec db psql -U postgres -d simplepm -c "SET log_min_duration_statement = 1000;"
docker-compose logs db | grep "duration:"
```

---

## Contact & Support

For HIPAA compliance questions, audit log access, or incident response:
- Admin dashboard: https://your-domain.com/admin
- View audit logs: https://your-domain.com/admin/audit-log
- User management: https://your-domain.com/admin/users
