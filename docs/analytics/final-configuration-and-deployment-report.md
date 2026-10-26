# Play-Nest Analytics — Final Configuration and Deployment Report

## Overview
This document inventories all environment variables, feature flags, infrastructure dependencies, queue configurations, and deployment prerequisites for Play-Nest Analytics (`sayra`).

---

## 1. Environment Variables & Feature Flags

| Variable Name | Purpose | Required / Optional | Default Value | Consumed In |
|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string for Prisma ORM | **Required** | `postgresql://...` | `sayra/src/config/prisma.ts` |
| `REDIS_URL` | Redis connection string for BullMQ workers and queues | **Required** | `redis://localhost:6379` | `sayra/src/config/redis.ts` |
| `JWT_SECRET` | Secret key for signing and verifying Bearer JWTs | **Required** | `dev-secret-key` | `sayra/src/common/middleware/auth.ts` |
| `ENABLE_ANALYTICS_BENCHMARKING` | Operational kill switch for cross-tenant benchmarking & growth insights | **Optional** | `true` | `sayra/src/modules/analytics/analytics.station.ts` |
| `PORT` | HTTP server port | Optional | `3000` | `sayra/src/server.ts` |
| `NODE_ENV` | Application environment (`development`, `production`, `test`) | Required | `development` | Various config modules |

---

## 2. Infrastructure & Service Dependencies

1. **PostgreSQL Database:**
   - Must support PostgreSQL 13+ with `Timestamptz(6)` column types and `@db.Date` types.
   - Prisma migrations (`20261210000000_add_analytics_infrastructure`) must be applied via `npx prisma migrate deploy`.

2. **Redis Service:**
   - Redis v6+ required for BullMQ background workers (`analytics-ingestion` and `analytics-sync`).
   - ioredis client managed in `sayra/src/config/redis.ts`.

3. **Background Worker Execution:**
   - `initWorkers()` must be invoked during server startup (`sayra/src/server.ts`).

---

## 3. Deployment Readiness Assessment

- **Local Environment:** `VERIFIED FUNCTIONAL` (All unit and API integration tests pass locally).
- **Staging / QA Environment:** `READY FOR DEPLOYMENT` (Schema migrations and BullMQ queues configured).
- **Production Environment:** `READY WITH DOCUMENTED LIMITATIONS` (Prisma schema migration `20261210000000_add_analytics_infrastructure` must be run; Redis must be provisioned; initial backfill via `npm run backfill:analytics` should be executed).
