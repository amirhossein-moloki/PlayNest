# Playenest | پلتفرم مدیریت و رزرو گیم‌نت و بلاگ یکپارچه

Playenest is a specialized Gamenet Management & Reservation system integrated with an enterprise Django content blog. It operates on a unified, containerized microservice/modular architecture:

- `sayra/`: Express.js + Prisma reservation and gaming center management backend.
- `Blog/`: Django + DRF + Daphne + Celery blogging and content platform (Git Submodule).
- `docker/`: Centralized Nginx Reverse Proxy, PostgreSQL 15, Redis, and Restic Backup services.

[![Node.js Version](https://img.shields.io/badge/node-22.x-blue.svg)](https://nodejs.org)
[![Python Version](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Django](https://img.shields.io/badge/Django-5.2-green.svg)](https://www.djangoproject.com/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-teal.svg)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-blue.svg)](https://www.postgresql.org/)

---

## 🚀 Key Features | ویژگی‌های کلیدی

- **Gaming Center Management**: Handle multiple centers, each with its own settings, pricing, and rules.
- **Smart Station Control**: Manage PCs, Consoles (PS5, Xbox), and VR stations with VIP/Normal tiers.
- **Reservation Engine**: Real-time availability, preventing overlaps, and support for Online, Walk-in, and Phone bookings.
- **Staff & Shift Management**: Role-based access control (RBAC) and scheduling for staff members.
- **Financials & Payments**: Integrated with Zarinpal for online payments, wallet system, and commission tracking.
- **Analytics & Notifications**: Detailed reporting on revenue, occupancy, and staff performance, plus SMS/In-App notifications.
- **Unified Central Reverse Proxy**: Single Nginx gateway routing `playnest.com` to Sayra and `blog.playnest.com` to Blog with WebSocket and static/media acceleration.
- **Multi-Database Isolation**: Isolated `playenest_prod` and `blog_prod` on PostgreSQL 15 with zero cross-migration contamination.
- **Isolated Caching**: Dedicated Redis instances for PlayNest and Blog to avoid task queue/cache key conflicts.

---

## 🛠 Tech Stack & Repository Structure

- **Sayra (`sayra/`)**: Express.js, TypeScript, Prisma ORM, BullMQ, Redis, PostgreSQL.
- **Blog (`Blog/`)**: Django 5.2, Django REST Framework, Daphne (ASGI), Celery, Redis, PostgreSQL.
- **Infrastructure (`docker/`)**: Central Nginx Reverse Proxy, PostgreSQL 15, Redis, Restic automated backup.

---

## 🚦 Getting Started | راهنمای راه‌اندازی

### 1. Prerequisites
- **Node.js** (v22 or higher)
- **Python** (v3.12 or higher)
- **Docker & Docker Compose** (recommended for production and staging)

### 2. Environment Setup
Copy the example environment file and update credentials:
```bash
cp .env.example .env
```

### 3. Running with Docker Compose
To start all services (`sayra`, `blog_web`, `blog_celery_*`, `db`, `redis`, `blog_redis`, `nginx`, `backup`):
```bash
docker compose up -d --build
```

Services will be accessible via Central Nginx reverse proxy on port 80:
- **PlayNest Main Platform (`playnest.com`)**:
  - API: `http://playnest.com/api/v1/`
  - Health: `http://playnest.com/health`
  - Swagger: `http://playnest.com/api-docs`
- **Blog Platform (`blog.playnest.com`)**:
  - Web & API: `http://blog.playnest.com/`
  - Admin & Endpoints: `http://blog.playnest.com/admin/` / `http://blog.playnest.com/api/`

---

## 📚 Documentation | مستندات

- [Unified Deployment Architecture Report](docs/architecture/unified-deployment-architecture.md)
- [NGINX Integration Guide](NGINX_INTEGRATION_GUIDE.md)
- [API Reference](docs/api.md)
- [CMS, Blog & SEO Guide](docs/cms-seo.md)
- [Local Setup Guide (Persian)](docs/LOCAL_SETUP_GUIDE_FA.md)
- [Docker Guide (راهنمای داکر)](docs/DOCKER_GUIDE_FA.md)

---
