# Sayra Reservation Engine: Implementation Roadmap

## Overview & Execution Strategy

This roadmap outlines the sequential, prioritized development strategy for the Sayra Reservation Engine following the Phase 0 Baseline Audit. Each phase builds on verified architectural constraints and addresses identified technical defects prior to scaling.

```
┌────────────────────────────────────────────────────────┐
│ Phase 0: Repository Audit & Baseline (Completed)       │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 1: Overlap & Concurrency Hardening (Critical)    │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 2: Operating Hours & Capacity Limits             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 3: Group Booking API & Session Lifecycle         │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 4: Financial & Refund Race Protection            │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ Phase 5: RBAC, Audit Logging & Operational Panel       │
└──────────────────────────┬─────────────────────────────┘
```

---

## Phase Breakdown

### Phase 1: Overlap & Concurrency Hardening (Critical Priority)
- **Objective:** Eliminate race conditions and guarantee absolute single-station booking invariant under extreme concurrency.
- **In-Scope Features:**
  - Create PostgreSQL migration adding `btree_gist` extension and `Reservation_no_overlap_active` `EXCLUDE` constraint in `sayra/prisma/migrations/`.
  - Prune/refactor 0-byte placeholder files (`reservation.overlap.ts`, `reservation.snapshots.ts`).
  - Add parallel stress test (`Promise.all` with 20 concurrent booking requests for identical station and time window).
- **Prerequisites:** Phase 0 Audit Complete.
- **Dependencies:** None.
- **Target Files / Layers:**
  - `sayra/prisma/migrations/20261201000000_add_reservation_exclusion_constraint/migration.sql`
  - `sayra/src/modules/reservation/reservation.overlap.ts`
  - `sayra/src/modules/reservation/reservation.station.ts`
  - `sayra/tests/integration/modules/reservations/reservations.concurrency.spec.ts`
- **Acceptance Criteria:**
  - PostgreSQL schema rejects overlapping active reservations at DB level with error code `23P01`.
  - 20 parallel `Promise.all` requests result in exactly 1 HTTP 201/200 success and 19 HTTP 409 CONFLICT (`SLOT_NOT_AVAILABLE`) responses.
- **Transition Condition:** Parallel stress tests pass in CI environment.

---

### Phase 2: Operating Hours & Capacity Limits (High Priority)
- **Objective:** Enforce center opening hours, maintenance schedules, and advance lead time rules.
- **In-Scope Features:**
  - Enforce BR-001 (minimum 30-minute advance lead time for public bookings).
  - Enforce gaming center global opening/closing hours from `Settings` during public booking creation.
  - Reject reservations on stations with active `MAINTENANCE` status.
- **Prerequisites:** Phase 1 Complete.
- **Dependencies:** Phase 1.
- **Target Files / Layers:**
  - `sayra/src/modules/reservation/reservation.station.ts`
  - `sayra/src/modules/reservation/reservation.dto.ts`
  - `sayra/tests/unit/modules/reservations/reservations.station.spec.ts`
- **Acceptance Criteria:**
  - Public booking for time slot in < 30 minutes returns 400 BAD_REQUEST (`LEAD_TIME_TOO_SHORT`).
  - Public booking outside center operating hours returns 409 CONFLICT (`CENTER_CLOSED`).
- **Transition Condition:** Unit tests for lead time and operating hours pass.

---

### Phase 3: Group Booking API & Session Lifecycle (High Priority)
- **Objective:** Expose multi-station Group Booking Express API endpoints and synchronize `GamingSession` lifecycle.
- **In-Scope Features:**
  - Create Express controller (`group-booking.controller.ts`) and router (`group-booking.routes.ts`).
  - Mount group booking routes in `sayra/src/routes/index.ts` under `/gamingCenters/:gamingCenterId/group-bookings` and `/public/gamingCenters/:gamingCenterSlug/group-bookings`.
  - Bind `reservationStation.startReservation` to create and activate a `GamingSession` record with `actualStartTime`.
- **Prerequisites:** Phase 1 and Phase 2 Complete.
- **Dependencies:** Phase 1, Phase 2.
- **Target Files / Layers:**
  - `sayra/src/modules/group-booking/group-booking.controller.ts`
  - `sayra/src/modules/group-booking/group-booking.routes.ts`
  - `sayra/src/routes/index.ts`
  - `sayra/src/modules/reservation/reservation.station.ts`
  - `sayra/tests/api/group-booking/group-booking.api.spec.ts`
- **Acceptance Criteria:**
  - Public and private group booking endpoints return 201 created with atomic station assignments.
  - Starting a reservation populates `GamingSession.id` and sets status to `IN_PROGRESS`.
- **Transition Condition:** API integration test suite for Group Booking and Gaming Sessions passes.

---

### Phase 4: Financial & Refund Race Protection (High Priority)
- **Objective:** Protect customer wallets and payment gateways from double-refunding or overdrawing under concurrent cancellations.
- **In-Scope Features:**
  - Add unique index `@@unique([reservationId, type])` on `WalletTransaction` in `schema.prisma`.
  - Enforce atomic wallet credit in `walletService.refundReservationToWallet`.
  - Verify ZarinPal payment gateway webhook idempotency and transaction rollback on payment failure.
- **Prerequisites:** Phase 3 Complete.
- **Dependencies:** Phase 3.
- **Target Files / Layers:**
  - `sayra/prisma/schema.prisma`
  - `sayra/src/modules/wallet/wallet.station.ts`
  - `sayra/src/modules/payments/payments.station.ts`
  - `sayra/tests/integration/modules/payments/payments.integration.spec.ts`
- **Acceptance Criteria:**
  - 10 concurrent cancellation calls for a single reservation produce exactly 1 wallet refund transaction and balance credit.
  - DB migration applies unique index without breaking historical data.
- **Transition Condition:** Concurrent wallet refund integration tests pass.

---

### Phase 5: RBAC, Audit Logging & Operational Panel (Medium Priority)
- **Objective:** Enforce granular role permissions (`STAFF`, `SUPERVISOR`, `MANAGER`), complete audit event streams, and provide management analytics.
- **In-Scope Features:**
  - Validate role permissions across all reservation operational endpoints (Confirm, Cancel, Start, Complete, No-Show, Propose Time).
  - Ensure every reservation status mutation logs an entry into `AuditLog` with `oldData` and `newData` snapshots.
  - Optimize reservation listing queries with pagination, status filtering, and sorting.
- **Prerequisites:** Phase 4 Complete.
- **Dependencies:** Phase 4.
- **Target Files / Layers:**
  - `sayra/src/modules/reservation/reservation.routes.ts`
  - `sayra/src/modules/reservation/reservation.station.ts`
  - `sayra/src/modules/audit/audit.station.ts`
  - `sayra/tests/api/audit/audit.api.spec.ts`
- **Acceptance Criteria:**
  - Unauthorized role access returns 403 FORBIDDEN.
  - `AuditLog` table records accurate JSON snapshots for every reservation lifecycle event.
- **Transition Condition:** All RBAC and Audit test suites pass cleanly.

---

*Roadmap Authored by Jules (Senior Software Architect & QA Lead) — Phase Execution Roadmap Complete.*
