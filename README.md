# Playenest | پلتفرم مدیریت و رزرو گیم‌نت

Playenest is a specialized Gamenet Management & Reservation system. It provides a robust API for managing gaming centers, stations (PC, Console, VR), staff shifts, and online/walk-in reservations.

[![Node.js Version](https://img.shields.io/badge/node-18.x-blue.svg)](https://nodejs.org)
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
- **CMS & SEO**: Built-in site builder to generate public-facing pages for each gaming center.
- **Analytics**: Detailed reporting on revenue, occupancy, and staff performance.

---

## 🛠 Tech Stack | تکنولوژی‌های مورد استفاده

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL (ORM: Prisma)
- **Caching & Queues**: Redis, BullMQ
- **Validation**: Zod
- **Security**: Argon2, JWT, Helmet
- **Logging**: Pino
- **Testing**: Jest, Supertest, Playwright

---

## 🚦 Getting Started | راهنمای راه‌اندازی

Follow these steps to get the project running on your local machine.

### 1. Prerequisites
- **Node.js** (v18 or higher)
- **Docker & Docker Compose** (recommended for DB and Redis)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-repo/playenest.git
cd playenest

# Install dependencies
npm install
```

### 3. Environment Setup
Copy the example environment file and update it with your credentials:
```bash
cp .env.example .env
```
*(Make sure to update `DATABASE_URL` and `REDIS_URL` if they differ from the defaults).*

### 4. Running with Docker (Recommended)
The easiest way to start the entire stack (App, DB, and Redis) is using Docker Compose:
```bash
docker compose up -d --build
```
This will build the app image, run migrations, and start all services. The API will be available at `http://localhost:3000`.

### 5. Manual Setup (Development)
If you prefer to run the app locally and only use Docker for infrastructure:
```bash
# Start DB and Redis
docker compose up -d db redis

# Initialize database
npx prisma migrate dev
npx prisma generate
```

For a full guide on how to run the project **without Docker**, see [Local Setup Guide (Persian)](docs/LOCAL_SETUP_GUIDE_FA.md).

### 6. Seeding Data (Optional)
To populate the database with professional test data:
```bash
npm run db:seed
```

### 7. Running the Application
```bash
# Development mode
npm run dev

# Production build
npm run build
npm start
```

The API will be available at `http://localhost:3000/api/v1`.
Swagger documentation is available at `http://localhost:3000/api-docs`.

---

## 🧪 Testing | تست‌ها

We maintain a high standard of quality with multiple testing layers:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run E2E tests only
npm run test:e2e
```

---

## 📚 Documentation | مستندات

Detailed documentation is available in the `docs/` folder:
- [Architecture Overview](docs/architecture.md)
- [API Reference](docs/api.md)
- [Database Schema](docs/database.md)
- [Persian API Guide (راهنمای فارسی)](docs/API_GUIDE_FA.md)
- [Docker Guide (راهنمای داکر)](docs/DOCKER_GUIDE_FA.md)

---

## 🇮🇷 راهنمای سریع (Persian Summary)

پروژه **Playenest** یک سیستم جامع مدیریت گیم‌نت است که شامل مدیریت سیستم رزرو، مدیریت ایستگاه‌ها (PC/Console)، مدیریت شیفت کارکنان و درگاه پرداخت است.

**نحوه اجرا:**
۱. اجرای کل پروژه با داکر: `docker compose up -d --build`
۲. (اختیاری) اجرای دستی:
   - نصب پکیج‌ها: `npm install`
   - تنظیم فایل `.env`: `cp .env.example .env`
   - اجرای زیرساخت: `docker compose up -d db redis`
   - بروزرسانی دیتابیس: `npx prisma migrate dev`
   - اجرای پروژه: `npm run dev`

برای راهنمای کامل اجرای پروژه **بدون داکر**، [اینجا را کلیک کنید](docs/LOCAL_SETUP_GUIDE_FA.md).

---

