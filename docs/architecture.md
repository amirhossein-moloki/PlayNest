# Architecture

## Overview

- Runtime: Node.js + Express
- Language: TypeScript
- Database: PostgreSQL via Prisma
- Cache/Store: Redis (for Idempotency and Rate Limiting)
- API base path: `/api/v1`

## Request Lifecycle (High Level)

1. `src/app.ts` mounts middleware (JSON, CORS, Helmet, logger) and assigns a request ID.
2. `responseMiddleware` adds the response envelope helpers (e.g., `res.ok`).
3. `src/routes/index.ts` mounts module routers under `/api/v1`.
4. Module routers apply auth, tenant checks, validation (Zod), and rate limiting (via Redis).
5. Controllers and services implement business logic and use Prisma for data access.

## Project Map

### Top-Level Structure

- `src/app.ts` — Express app composition and global middleware.
- `src/server.ts` — Server bootstrap.
- `src/routes/index.ts` — API route composition and module mounting.
- `src/modules/**` — Feature modules (controllers, services, repositories, validators, routes).
- `src/common/**` — Cross-cutting middleware, errors, utilities.
- `prisma/schema.prisma` — Database schema and enums.

### Route Composition (Mounted in `src/routes/index.ts`)

| Module | Route Prefix | Key Files |
| --- | --- | --- |
| Health | `/health` | `src/routes/health.routes.ts` |
| Auth | `/auth` | `src/modules/auth/auth.routes.ts`, `auth.controller.ts`, `auth.service.ts`, `auth.validators.ts` |
| GamingCenters | `/gamingCenters` | `src/modules/gamingCenter/gamingCenter.routes.ts`, `gamingCenter.controller.ts`, `gamingCenter.service.ts` |
| Services (private) | `/gamingCenters/:gamingCenterId/services` | `src/modules/services/services.routes.ts`, `services.controller.ts`, `services.validators.ts` |
| Services (public) | `/public/gamingCenters/:gamingCenterSlug/services` | `src/modules/services/services.routes.ts`, `services.controller.ts` |
| Staff / Users | `/gamingCenters/:gamingCenterId/staff` | `src/modules/users/users.routes.ts`, `users.controller.ts`, `users.validators.ts` |
| Shifts | `/gamingCenters/:gamingCenterId/staff/:userId/shifts` | `src/modules/shifts/shifts.routes.ts`, `shifts.controller.ts`, `shifts.validators.ts` |
| Availability (public) | `/public/gamingCenters/:gamingCenterSlug/availability` | `src/modules/availability/availability.routes.ts`, `availability.controller.ts`, `availability.validators.ts` |
| Bookings (private) | `/gamingCenters/:gamingCenterId/bookings` | `src/modules/bookings/bookings.routes.ts`, `bookings.controller.ts`, `bookings.validators.ts` |
| Bookings (public) | `/public/gamingCenters/:gamingCenterSlug/bookings` | `src/modules/bookings/bookings.public.routes.ts`, `bookings.validators.ts` |
| Payments | `/gamingCenters/:gamingCenterId/bookings` | `src/modules/payments/payments.routes.ts`, `payments.controller.ts`, `payments.service.ts`, `payments.validators.ts` |
| CMS (private) | `/gamingCenters/:gamingCenterId` | `src/modules/cms/cms.routes.ts`, `pages.routes.ts`, `media.routes.ts`, `links.routes.ts`, `addresses.routes.ts`, `site-settings.routes.ts` |
| CMS Admin UI | `/admin` | `src/modules/cms/admin-ui.routes.ts` |
| Public CMS | `/public/gamingCenters/:gamingCenterSlug/pages` / `media` / `links` / `addresses` | `src/modules/public/public.routes.ts` and `src/modules/public/*.public.controller.ts` |
| Webhooks | `/api/v1/webhooks` | `src/modules/webhooks/webhooks.routes.ts`, `webhooks.controller.ts`, `middleware/verifyPaymentWebhookSignature.ts` |

## Technical Optimizations

### Idempotency (Redis)
- Implemented using a Redis-backed `IdempotencyRepo`.
- Keys are tenant-aware and scoped by method and path.
- Ensures that sensitive operations (like creating a booking or processing a payment) are only executed once even if retried.

### Rate Limiting (Redis)
- Uses `rate-limit-redis` to store request counts in Redis.
- Shared across multiple instances for scalable protection against brute-force and DDoS attacks.

### Analytics Summary Tables
- To ensure sub-200ms dashboard performance, metrics are pre-calculated into `GamingCenterAnalytics`, `StaffAnalytics`, and `ServiceAnalytics` tables.
- Synchronization occurs automatically during booking state changes or financial transactions.

### Wallet & Refunds
- Customer refunds are credited to a virtual `walletBalance` in the `CustomerAccount` model.
- The `WalletService` handles transaction history logging and balance updates within Prisma transactions to ensure data integrity.

## Known Gaps / TODO

- Some modules return non-standard response shapes (e.g., availability uses `res.status(200).json({ success: true, data: slots })` instead of the shared `res.ok` envelope).

## Source of Truth

- `src/app.ts`
- `src/server.ts`
- `src/routes/index.ts`
- `src/modules/**`
- `src/common/**`
