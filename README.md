# Playenest | پلتفرم مدیریت و رزرو گیم‌نت

Playenest is a specialized Gamenet Management & Reservation system. It provides a robust architecture with two backend applications operating on shared infrastructure:

- `sayra/`: Express.js + Prisma reservation backend.
- `payload/`: Independent Payload CMS backend for blog/content management.

[![Node.js Version](https://img.shields.io/badge/node-22.x-blue.svg)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-teal.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)

---

## 🚀 Key Features | ویژگی‌های کلیدی

- **Gaming Center Management**: Handle multiple centers, each with its own settings, pricing, and rules.
- **Smart Station Control**: Manage PCs, Consoles (PS5, Xbox), and VR stations with VIP/Normal tiers.
- **Reservation Engine**: Real-time availability, preventing overlaps, and support for Online, Walk-in, and Phone bookings.
- **Staff & Shift Management**: Role-based access control (RBAC) and scheduling for staff members.
- **Financials & Payments**: Integrated with Zarinpal for online payments, wallet system, and commission tracking.
- **Independent Payload CMS**: Isolated CMS backend for blog management and content authoring.
- **Analytics & Notifications**: Detailed reporting on revenue, occupancy, and staff performance, plus SMS/In-App notifications.

---

## 🛠 Tech Stack & Repository Structure

- **Sayra (`sayra/`)**: Express.js, TypeScript, Prisma ORM, BullMQ, Redis, PostgreSQL.
- **Payload (`payload/`)**: Payload CMS, Next.js, TypeScript, PostgreSQL.
- **Infrastructure (`docker/`)**: Shared PostgreSQL 15, Redis, Nginx Reverse Proxy, Restic Backup service.

---

## 🚦 Getting Started | راهنمای راه‌اندازی

### 1. Prerequisites
- **Node.js** (v22 or higher)
- **Docker & Docker Compose** (recommended for infrastructure services)
- **pnpm** (for Payload CMS)

### 2. Environment Setup
Copy the example environment file and update credentials if necessary:
```bash
cp .env.example .env
```

### 3. Running with Docker Compose
To start all services (`sayra`, `payload`, `db`, `redis`, `nginx`, `backup`):
```bash
docker compose up -d --build
```

Services will be accessible via Nginx reverse proxy on port 80:
- **Sayra Reservation API**: `http://localhost/api/v1/` or `http://localhost/api/reservations/`
- **Payload Admin Panel**: `http://localhost/admin`
- **Payload API**: `http://localhost/api/payload/`
- **Sayra Health Check**: `http://localhost/health`
- **Sayra Swagger Docs**: `http://localhost/api-docs`

### 4. Creating the First Platform Administrator (CLI)
To bootstrap the initial `PLATFORM_ADMIN` account in production or fresh staging environments, execute the interactive CLI wizard inside the running Sayra container:

```bash
docker compose exec sayra pnpm admin:create
```

The terminal wizard interactively prompts for:
1. **Full Name**
2. **Phone Number** (Iranian format: `09xxxxxxxxx`)
3. **Password** (hidden input with strong password policy)
4. **Confirm Password** (hidden input)

This command is completely decoupled from any Gaming Center, executes within a database transaction, records an audit log entry, and safely exits without modifying any existing data if an administrator already exists.

### 5. Local Development

#### Sayra Reservation Backend (`sayra/`):
```bash
# Start DB and Redis infrastructure
docker compose up -d db redis

# Navigate to Sayra
cd sayra

# Install dependencies and setup database
npm install
npx prisma generate
npx prisma migrate dev

# Run development server
npm run dev
```

#### Payload CMS Backend (`payload/`):
```bash
# Navigate to Payload
cd payload

# Install dependencies and start dev server
pnpm install
pnpm dev
```

---

## 🧪 Testing | تست‌ها

Run tests in the `sayra/` directory:

```bash
cd sayra
npm test
npm run test:cov
```

---

## 📚 Documentation | مستندات

- [API Reference](docs/api.md)
- [CMS, Blog & SEO Guide](docs/cms-seo.md)
- [NGINX Integration Guide](NGINX_INTEGRATION_GUIDE.md)
- [Local Setup Guide (Persian)](docs/LOCAL_SETUP_GUIDE_FA.md)
- [Docker Guide (راهنمای داکر)](docs/DOCKER_GUIDE_FA.md)

---
