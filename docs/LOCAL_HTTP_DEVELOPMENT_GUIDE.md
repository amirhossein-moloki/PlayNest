# Local Development Guide (HTTP Mode Without SSL)

This document provides a step-by-step guide to running PlayNest in local development mode using plain HTTP without SSL/TLS certificates, domain registration, or HTTPS reverse proxy requirements.

---

## 🛠 Required Tools & Versions

- **Node.js**: v22.x or higher
- **npm**: 10.x or higher (for `sayra/`)
- **pnpm**: 9.x or higher (for `payload/`)
- **Docker & Docker Compose**: Docker Engine 24.x+ / Docker Compose v2.x+

---

## ⚙️ Environment Configuration

### 1. Environment File Creation
Create `.env` in the root of the repository from the template:

```bash
cp .env.development.example .env
```

Alternatively, you can specify `.env.dev` when running Docker Compose.

### 2. Environment Variables Overview

| Variable | Development Default | Description |
|---|---|---|
| `NODE_ENV` | `development` | Set runtime mode to development |
| `PORT` | `3000` | Internal backend application port |
| `POSTGRES_USER` | `playenest_admin` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `change_this_secure_password_in_production` | PostgreSQL password |
| `POSTGRES_DB` | `playenest_prod` | Sayra main database |
| `PAYLOAD_POSTGRES_DB` | `payload_db` | Payload CMS database |
| `REDIS_URL` | `redis://localhost:6379` (or `redis://redis:6379` in Docker) | Redis connection URL |
| `JWT_ACCESS_SECRET` | `dev_access_secret_32_characters_minimum_length` | JWT Access secret |
| `JWT_REFRESH_SECRET` | `dev_refresh_secret_32_characters_minimum_length` | JWT Refresh secret |
| `STATIC_API_KEY` | `dev_static_api_key_for_testing` | API Key for `/api/v1` routes (`x-api-key`) |
| `PAYLOAD_SECRET` | `dev_payload_secret_32_characters_minimum_length` | Payload CMS security secret |

---

## 🚀 Launching the Local HTTP Development Setup

### Method A: Full Docker Compose Setup (Recommended)

To launch all services (`db`, `redis`, `sayra`, `payload`, `nginx`) over HTTP:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d --build
```

### Method B: Native Node.js Development (Infrastructure in Docker)

1. **Start Database & Redis in Docker:**
   ```bash
   docker compose up -d db redis
   ```

2. **Run Sayra Backend (`sayra/`):**
   ```bash
   cd sayra
   npm install
   npx prisma generate
   ./scripts/migrate.sh
   npm run dev
   ```

3. **Run Payload CMS Backend (`payload/`):**
   ```bash
   cd payload
   pnpm install
   pnpm dev
   ```

---

## 🌐 Verified Service URLs & Endpoints

| Service | Protocol | Local URL |
|---|---|---|
| **NGINX Gateway** | HTTP | `http://localhost:80/` |
| **Sayra Health Check** | HTTP | `http://localhost/health` or `http://localhost:3000/health` |
| **Sayra API v1** | HTTP | `http://localhost/api/v1/` or `http://localhost:3000/api/v1/` |
| **Sayra Swagger UI** | HTTP | `http://localhost/api-docs` or `http://localhost:3000/api-docs` |
| **Payload Admin Panel** | HTTP | `http://localhost/admin` or `http://localhost:3000/admin` |
| **Payload API** | HTTP | `http://localhost/api/payload/` |

---

## 📋 Common Development Commands

### Viewing Logs

```bash
# View all service logs
docker compose logs -f

# View Sayra logs
docker compose logs -f sayra

# View Payload logs
docker compose logs -f payload
```

### Stopping the Environment

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down
```

To preserve existing database volumes and data during shutdown, **do not** pass the `-v` / `--volumes` flag.

---

## 🔌 Integrations & Mock Configurations

- **Zarinpal Payment Gateway**: Configured to `ZARINPAL_SANDBOX=true` with standard sandbox credentials. External payment redirects operate in sandbox mode without requiring HTTPS callback endpoints in local testing.
- **SMS / Smsir.ir**: Disabled or unconfigured by default in local development (`SMSIR_API_KEY=""`). OTPs and SMS notifications are logged to console.
- **Sentry Error Tracking**: Disabled by default in development (`SENTRY_ENABLED=false`).
- **SMTP Email**: Optional. Disabled unless `SAYRA_SMTP_HOST` or `PAYLOAD_SMTP_HOST` is explicitly set.
