# Phase 5: Reservation Expiry and Background Jobs

## 1. Overview & Objectives

Phase 5 introduces an automated, highly available, race-free background expiry mechanism for the Sayra Reservation Engine. It guarantees that temporary, unconfirmed reservations (`PENDING` state) whose confirmation/payment deadlines (`expiresAt`) have elapsed are safely transitioned to `EXPIRED` and release their held time slots for new bookings.

Key architecture objectives achieved:
- **Explicit Eligibility Rules:** Deterministic filter ensuring confirmed or terminal reservations are never expired.
- **Background Worker Architecture:** Scoped, non-blocking polling background worker (`ReservationExpiryWorker`) with graceful lifecycle management.
- **Atomic Transition & Concurrency Control:** Conditional database updates prevent worker race conditions and protect concurrent payments.
- **Payment / Expiry Race Protection:** Consistent precedence handling for payment webhooks vs. background expiry processing.
- **Idempotency & Fault Recovery:** Repeated executions produce zero unintended side-effects and automatically resume processing after application restarts.
- **Database Optimization:** PostgreSQL composite indexes on `(status, expiresAt)` optimize candidate discovery.

---

## 2. Expiry Eligibility & Deadline Semantics

### Eligible States
A record is eligible for automated expiry if and only if:
1. `status == ReservationStatus.PENDING`
2. `expiresAt != null` AND `expiresAt <= UTC_NOW`
3. `paymentState != ReservationPaymentState.PAID`

### Ineligible States
The following records are strictly **protected from expiry**:
- **Confirmed / Active / Terminal States:** `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED`, `NO_SHOW`, `EXPIRED`.
- **Paid Records:** Any record where `paymentState == ReservationPaymentState.PAID`.
- **Null Deadlines:** Records with `expiresAt == null` (e.g. walk-in bookings auto-confirmed by staff).

### Expiry Deadline Setting
- **Public Online Bookings:** Created in `PENDING` state with `expiresAt = creationTime + 60 seconds` (1-minute temporary hold window).
- **Group Bookings:** Public group bookings set `expiresAt = creationTime + 60 seconds` for the group header and all child reservations.

---

## 3. Background Processing Architecture

The background worker infrastructure is implemented in `sayra/src/jobs/workers/reservationExpiry.worker.ts`.

### Key Characteristics
- **Lifecycle Management:** Exposed via `start()`, `stop()`, `isRunning()`, and `tick()`. Automatically started during application boot in `sayra/src/jobs/workers/index.ts`.
- **Polling Loop:** Configurable via `RESERVATION_EXPIRY_POLL_INTERVAL_MS` (default: `5000ms`).
- **Batch Processing:** Processes records in bounded batches configured via `RESERVATION_EXPIRY_BATCH_SIZE` (default: `50`).
- **Graceful Shutdown:** `stop()` clears active timers and awaits completion of any in-flight tick before shutting down.
- **Overlap Prevention:** Internal `processing` flag ensures a slow tick does not trigger concurrent overlapping tick execution within the same instance.
- **Transient Failure Isolation:** Individual candidate exceptions are logged and isolated; a failure on one item does not abort the processing of other candidates in the batch.

---

## 4. Atomic Transition & Concurrency Control

Expiry transitions are executed as conditional database updates using Prisma transactions:

```typescript
// Reservation Atomic Transition
const result = await client.reservation.updateMany({
  where: {
    id,
    status: ReservationStatus.PENDING,
    expiresAt: { lte: now },
    paymentState: { not: ReservationPaymentState.PAID },
  },
  data: {
    status: ReservationStatus.EXPIRED,
  },
});
```

### Transition Mechanics
1. **Candidate Query:** Candidate IDs are fetched in batch order (`orderBy: { expiresAt: 'asc' }`).
2. **Revalidation & Atomic Update:** The update query conditions (`status == PENDING` AND `paymentState != PAID` AND `expiresAt <= now`) are evaluated atomically inside PostgreSQL.
3. **Outcome Evaluation:**
   - `result.count === 1`: Transition succeeded. `AppEvents.RESERVATION_EXPIRED` event emitted.
   - `result.count === 0`: State changed concurrently (e.g. payment completed or customer confirmed). Operation skipped safely as a no-op.

### Group Booking Synchronization
When a `GroupBooking` candidate expires, `expireGroupBookingCandidate` updates the group booking header and all associated child `Reservation` records with `status: PENDING` to `EXPIRED` within a single database transaction.

---

## 5. Payment and Expiry Race Policies

| Scenario | Race Winner | Resolution & Policy |
|---|---|---|
| **Payment completes before expiry processing** | Payment | `paymentState` becomes `PAID`. Expiry worker query fails condition (`paymentState != PAID`), 0 rows updated, skipped as safe no-op. |
| **Payment arrives while expiry worker is selecting item** | Payment / DB Lock | Atomic conditional update in worker checks `paymentState != PAID`. If payment committed first, worker skips. If expiry committed first, payment callback handles late payment. |
| **Late successful payment arrives AFTER expiry committed** | Expiry | `PaymentsRepo.handleSuccessfulPayment` detects `reservation.status == EXPIRED`. Updates `payment.status = PAID` and `reservation.paymentState = PAID`, but preserves `reservation.status = EXPIRED`. Logs structured warning for manual reconciliation. No implicit reactivation or automatic refund is performed. |
| **Duplicate payment webhook callback** | Idempotency Layer | Handled via `IdempotencyRepo` / `PaymentsRepo` idempotency checks; duplicate callbacks return early without altering state. |
| **Multiple worker instances process same candidate** | First Worker | First worker updates record from `PENDING` to `EXPIRED`. Second worker gets `0` rows updated and logs skipped candidate. |

---

## 6. Database Schema & Indexing

To support fast candidate lookup (`WHERE status = 'PENDING' AND expiresAt <= NOW()`), a composite index is added:

### Migration SQL
File: `sayra/prisma/migrations/20261205000000_add_reservation_expiry_indexes/migration.sql`

```sql
-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GroupBooking_status_expiresAt_idx" ON "GroupBooking"("status", "expiresAt");
```

---

## 7. Deployment & Environment Configuration

Configuration variables defined in `sayra/src/config/env.ts`:

| Environment Variable | Type | Default | Description |
|---|---|---|---|
| `RESERVATION_EXPIRY_POLL_INTERVAL_MS` | Number | `5000` | Background worker polling interval in milliseconds. |
| `RESERVATION_EXPIRY_BATCH_SIZE` | Number | `50` | Maximum candidate records processed per tick batch. |
| `RESERVATION_EXPIRY_ENABLED` | Boolean | `true` | Toggle flag to enable or disable expiry background processing. |

---

## 8. Known Limitations & Deferred Decisions

1. **Automated Refunds:** Automatic wallet or gateway refunds for late payments on expired reservations are explicitly deferred to Phase 6 / financial reconciliation layer.
2. **Manual Reconciliation:** Late payments on expired reservations trigger a structured log alert for staff/manager review.
