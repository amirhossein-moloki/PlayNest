# Phase 0 Audit Report: Sayra Reservation System

## 1. Executive Summary

This report establishes the baseline technical state, requirements traceability, and operational readiness of the Sayra Reservation Engine. Prior to developing new feature sets or modifying core domain logic, a complete static and dynamic audit was performed on the active codebase repository.

Key conclusions:
- **Baseline Architecture Verification:** The codebase uses **Node.js 22**, **Express.js**, **TypeScript**, **Prisma ORM (v5.22)**, **PostgreSQL 15**, **Redis**, and **BullMQ** structured as a **Modular Monolith**. Initial prompt references to `.NET 8` / `ASP.NET Core` were reconciled against the repository reality.
- **Verification Status:** Build (`npm run build`), linting (`npm run lint`), and automated tests (`npm test` — **57 test suites, 306 tests passing**) were executed successfully.
- **Readiness Decision:** **`READY_WITH_BLOCKERS`**. The core reservation pipeline is operational and tested; however, technical blockers including missing database-level exclusion constraints, unexposed `GroupBooking` API routes, 0-byte placeholder files, and check-then-act refund race conditions must be addressed in subsequent target phases before high-concurrency production rollout.

---

## 2. Environment & Repository Baseline

- **Repository Root:** `https://github.com/amirhossein-moloki/Sayra-Server`
- **Active Branch:** `jules-13708785817592234217-bf0efc7c`
- **Reviewed Git Commit SHA:** `4480716b726b191b6dfdd5a8f17fbeb92c82db6b`
- **Git Working Tree Status:** Clean baseline (no local untracked or uncommitted code prior to Phase 0 deliverables).
- **Node.js Version:** `v22.14.0`
- **npm Version:** `11.11.0`

### Technology Stack Reconciliation
| Architectural Layer | Prompt Hypothesis / Reference | Codebase Reality (Source of Truth) |
|---|---|---|
| **Runtime & Language** | C# / .NET 8 | Node.js 22.x / TypeScript 5.4 |
| **Framework & API** | ASP.NET Core Web API | Express.js 4.19 / OpenAPI 3.0 (Swagger) |
| **Architecture Pattern** | Clean Architecture / SLNX | Modular Monolith (Controller-Station-Repo) |
| **Persistence / ORM** | EF Core / DbContext | Prisma ORM 5.22 / PostgreSQL 15 |
| **Secondary Applications** | N/A | Monorepo containing `sayra/` and `payload/` (Payload CMS / Next.js) |
| **Test Runner** | dotnet test | Jest 29.7 / Supertest / MSW 2.14 |

---

## 3. Reservation System Architecture & Execution Path

The Sayra Reservation System strictly isolates tenant operations using `gamingCenterId` and enforces role-based access control (RBAC).

```
[ HTTP Request ]
       │
       ▼
[ Rate Limiter Middleware ] (privateApiRateLimiter / publicReservationRateLimiter)
       │
       ▼
[ Auth & Tenant Guard ] (authMiddleware, tenantGuard, resolveGamingCenterBySlug)
       │
       ▼
[ Controller Layer ] (reservation.controller.ts)
       │
       ▼
[ Station / Service Layer ] (reservation.station.ts)
  ├── 1. Pessimistic Row Lock (`lockStationForUpdate` via FOR UPDATE)
  ├── 2. Station & Staff Validation
  ├── 3. Overlap Check (`findOverlappingReservation`)
  ├── 4. Customer Account & Active Limit Check (`assertActiveReservationLimitNotExceeded`)
  ├── 5. Dynamic Pricing & Discount Calculation (`discountsStation`)
  └── 6. Database Transaction Commit (`Prisma.$transaction` with RepeatableRead)
       │
       ▼
[ Repository Layer ] (reservation.repo.ts) ──► [ PostgreSQL Database ]
       │
       ▼
[ Domain Events / Metrics ] (AppEvents.RESERVATION_CREATED, Prometheus Metrics)
```

### Key Modules and File Directory

- **Private Management Endpoints:** `sayra/src/modules/reservation/reservation.routes.ts`
- **Public Online Booking Endpoints:** `sayra/src/modules/reservation/reservation.public.routes.ts`
- **Customer Panel Endpoints:** `sayra/src/modules/customer-panel/customer-panel.routes.ts`
- **Controllers:** `sayra/src/modules/reservation/reservation.controller.ts`
- **Station (Business Logic):** `sayra/src/modules/reservation/reservation.station.ts`
- **Repository (Data Access):** `sayra/src/modules/reservation/reservation.repo.ts`
- **State Machine:** `sayra/src/modules/reservation/reservation.state-machine.ts`
- **DTOs & Validators:** `sayra/src/modules/reservation/reservation.dto.ts`
- **Database Schema:** `sayra/prisma/schema.prisma`
- **Group Booking Engine:** `sayra/src/modules/group-booking/group-booking.station.ts` & `group-booking.repo.ts`

---

## 4. Positive Findings & Verified Behaviors

1. **Pessimistic Row Locking for Overlap Prevention:**
   - Both staff/operator booking (`createReservation`) and public customer booking (`createPublicReservation`) invoke `ReservationRepo.lockStationForUpdate(stationId, tx)`, executing `SELECT id FROM "GameStation" WHERE id = $1 FOR UPDATE` inside a `RepeatableRead` transaction to mitigate concurrent double-booking.
2. **Active Reservation Cap Enforcement:**
   - The method `assertActiveReservationLimitNotExceeded` limits customers to a maximum of 2 active reservations across standalone and group bookings, acquiring a row lock on `CustomerAccount`.
3. **State Machine Integrity:**
   - `ReservationStateMachine` strictly enforces allowed state transitions (`PENDING` -> `CONFIRMED` / `CANCELED` / `EXPIRED`, `CONFIRMED` -> `IN_PROGRESS` / `COMPLETED` / `CANCELED` / `NO_SHOW`). Terminal states (`COMPLETED`, `CANCELED`, `NO_SHOW`, `EXPIRED`) cannot be mutated.
4. **Dynamic Discount Engine Integration:**
   - Pre-calculated discount resolution via `discountsStation.calculateApplicableDiscount` respects target precedence (Station-level over GamingCenter-level) and caps discounts to the station's base price.
5. **Idempotency & OTP Security:**
   - Public online reservations require verified OTP consumed within 5 minutes when `requireOtpForPublicBooking` setting is enabled. Idempotency middleware prevents duplicate network submission.

---

## 5. Audit Findings & Risk Inventory

### AUDIT-001: 0-Byte Placeholder Code Files
- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** `sayra/src/modules/reservation/reservation.overlap.ts` and `sayra/src/modules/reservation/reservation.snapshots.ts` are 0-byte empty files.
- **Impact:** Technical debt and dead imports if referenced; overlap logic is currently embedded directly in `reservation.station.ts`.
- **Recommendation:** Implement dedicated helper functions or cleanly prune empty files.
- **Target Phase:** Phase 1 (Concurrency & Overlap Hardening)

### AUDIT-002: Missing Database Exclusion Constraint in Migrations
- **Severity:** High
- **Status:** Confirmed
- **Evidence:** `reservation.station.ts` lines 333 & 559 catch PostgreSQL error code `23P01` and constraint name `Reservation_no_overlap_active`. However, no exclusion constraint exists in `sayra/prisma/migrations/`.
- **Impact:** Database-level protection against overlapping reservations is absent. If application-level row locking fails or raw queries bypass the station layer, double-booking can occur.
- **Recommendation:** Add PostgreSQL migration creating `btree_gist` extension and an `EXCLUDE` constraint on `(stationId WITH =, tsrange(startTime, endTime) WITH &&) WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')`.
- **Target Phase:** Phase 1 (Concurrency & Overlap Hardening)

### AUDIT-003: Unexposed GroupBooking Express Routes
- **Severity:** High
- **Status:** Confirmed
- **Evidence:** `group-booking.repo.ts` and `group-booking.station.ts` exist with full multi-station selection logic, but no Express router (`group-booking.routes.ts`) or controller is registered in `sayra/src/routes/index.ts`.
- **Impact:** Group booking functionality is completely unaccessible to API consumers.
- **Recommendation:** Create `group-booking.controller.ts` and `group-booking.routes.ts` and mount them under `/gamingCenters/:gamingCenterId/group-bookings` and `/public/gamingCenters/:gamingCenterSlug/group-bookings`.
- **Target Phase:** Phase 3 (Group Booking & Session Lifecycle)

### AUDIT-004: Lack of Center-Wide Operating Hours & Maintenance Window Checks
- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** `createPublicReservation` checks staff shifts (`findStaffShift`), but does not validate gaming center global opening/closing hours or station maintenance schedules.
- **Impact:** Bookings can be accepted during center closing hours if a staff shift is misconfigured, or on stations under maintenance.
- **Recommendation:** Enforce operating hours validation from `Settings` and check `GameStation.status !== 'MAINTENANCE'` before booking creation.
- **Target Phase:** Phase 2 (Operating Hours & Capacity Limits)

### AUDIT-005: Wallet Refund Check-Then-Act Race Condition
- **Severity:** High
- **Status:** Confirmed
- **Evidence:** `walletService.refundReservationToWallet` checks `WalletRepo.findRefundTransaction(reservationId)` before crediting the wallet. Under high concurrency, simultaneous cancellation calls can both see `null` and credit the wallet twice.
- **Impact:** Financial double-refunding during concurrent reservation cancellations.
- **Recommendation:** Leverage unique constraint `@@unique([reservationId, type])` in `WalletTransaction` or acquire pessimistic lock on `CustomerAccount`.
- **Target Phase:** Phase 4 (Financial & Refund Race Protection)

### AUDIT-006: Lead Time (BR-001) Business Rule Enforcement Gap
- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** `reservation.station.ts` asserts `isBefore(startTime, new Date())` (must be in the future), but does not enforce the 30-minute minimum advance lead time specified in BR-001.
- **Impact:** Customers can book reservations starting 1 second in the future, giving operators no setup time.
- **Recommendation:** Enforce `startTime >= addMinutes(now, minLeadTimeMinutes)` (default 30 min) in reservation validation.
- **Target Phase:** Phase 2 (Operating Hours & Capacity Limits)

### AUDIT-007: Under-Utilized GamingSession Integration
- **Severity:** Low / Informational
- **Status:** Confirmed
- **Evidence:** `GamingSession` table exists in `schema.prisma` and `gamingSessions.station.ts` exists, but `Reservation` status transitions (`IN_PROGRESS`) do not automatically sync with `GamingSession` start/pause timestamps.
- **Impact:** Inconsistency between operational documentation (UML sequence diagrams SEQ-003/004) and source code implementation.
- **Recommendation:** Bind `reservationStation.startReservation` to instantiate/activate a `GamingSession` record.
- **Target Phase:** Phase 3 (Group Booking & Session Lifecycle)

### AUDIT-008: Missing Real Concurrency Integration Tests
- **Severity:** Medium
- **Status:** Confirmed
- **Evidence:** Current unit/integration tests (`reservations.station.spec.ts`, `reservations.integration.spec.ts`) execute reservation creation sequentially. No `Promise.all` test simulates 20 parallel requests for the exact same station time slot.
- **Impact:** Lock contention and race conditions are not verified automatically in CI.
- **Recommendation:** Add a `Promise.all` parallel integration test asserting 1 success (201/200) and 19 failures (409 CONFLICT) under high load.
- **Target Phase:** Phase 1 (Concurrency & Overlap Hardening)

---

## 6. Migration and Persistence Assessment

1. **Schema Models:** Core models (`GamingCenter`, `GameStation`, `Reservation`, `ReservationTimeProposal`, `GroupBooking`, `Discount`, `Payment`, `WalletTransaction`, `AuditLog`) are properly defined in `sayra/prisma/schema.prisma`.
2. **Index Alignment:**
   - Composite indexes exist on `Reservation`: `@@index([gamingCenterId, startTime])`, `@@index([gamingCenterId, status, startTime])`, `@@index([customerAccountId, startTime])`.
   - Missing index on `Reservation(stationId, startTime, endTime)` which affects overlap query performance as dataset grows.
3. **Database Provider Parity:**
   - Production uses PostgreSQL 15 (`timestamptz`, `FOR UPDATE` row locks).
   - In-memory/unit testing gracefully degrades raw SQL `FOR UPDATE` queries inside try/catch blocks to support SQLite mock runners.

---

## 7. Operational Readiness & Readiness Decision

### Readiness Decision: `READY_WITH_BLOCKERS`

- **Build Quality:** Clean compilation (`0` errors in `tsc`).
- **Code Quality:** Strict linting passed (`0` errors in `eslint`).
- **Test Baseline:** `100%` passing test suite (**57 suites, 306 tests**).
- **Blockers to Resolve in Subsequent Phases:**
  1. Add PostgreSQL `EXCLUDE` constraint migration for reservation overlap (Phase 1).
  2. Implement real parallel `Promise.all` stress tests (Phase 1).
  3. Expose `GroupBooking` Express routes & controllers (Phase 3).
  4. Enforce 30-minute advance lead time and center operating hours (Phase 2).
  5. Add atomic check / unique constraint on wallet refund transactions (Phase 4).

---

*Report Generated by Jules (Senior Software Architect & QA Lead) — Phase 0 Baseline Audit Complete.*
