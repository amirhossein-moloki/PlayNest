# Phase 3 Implementation Report: Reservation Lifecycle, State Machine, Cancellation, and Rescheduling

## 1. Executive Summary

Phase 3 implements the transactional reservation lifecycle, central state machine transition rules, cancellation idempotency, explicit rescheduling workflows, no-show preconditions, and atomic transition history tracking for the Sayra Reservation Engine.

Key outcomes:
- **State Machine Core (`ReservationStateMachine`):** Strict allowed transition matrix for reservation statuses (`PENDING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED`, `NO_SHOW`, `EXPIRED`). Terminal states (`COMPLETED`, `CANCELED`, `NO_SHOW`, `EXPIRED`) cannot be mutated or transitioned out of. Attempted illegal state transitions throw HTTP `409 Conflict` with error code `INVALID_TRANSITION`.
- **Cancellation Idempotency & Safety:** `cancelReservation` enforces permitted source states (`PENDING`, `CONFIRMED`, `IN_PROGRESS`) and behaves idempotently on repeated calls, returning the cancelled reservation without duplicate wallet refunds or duplicate history records.
- **Explicit Rescheduling Workflow (`rescheduleReservation`):** Rescheduling is implemented as an explicit business operation that locks the station row (`FOR UPDATE`), enforces non-terminal state prerequisites, re-evaluates Phase 2 operational constraints (lead time, station maintenance, center operating hours in local timezone, staff shifts), verifies slot availability against active reservation overlap, recalculates prices and dynamic discounts, and records `ReservationHistory` atomically.
- **No-Show Handling Preconditions:** `markAsNoShow` validates that the scheduled start time has elapsed (`startTime <= now` in UTC), returning `400 Bad Request` with code `RESERVATION_NOT_STARTED` if invoked prematurely.
- **Atomic Lifecycle History (`ReservationHistory`):** Persistent database entity and migration (`20261203000000_add_reservation_lifecycle_history`) recording chronological state transitions (`fromStatus`, `toStatus`, `action`, `actorId`, `actorType`, `reason`, `metadata`, `createdAt`) committed inside `Prisma.$transaction`.
- **Database Overlap Exclusion Constraint:** PostgreSQL `EXCLUDE USING gist` constraint `Reservation_no_overlap_active` on `(stationId, tstzrange("startTime", "endTime"))` filtering active statuses (`CONFIRMED`, `IN_PROGRESS`, `PENDING`), releasing capacity immediately upon transition to `CANCELED`, `NO_SHOW`, or `EXPIRED`.

---

## 2. State Model & Permitted Transition Matrix

### Defined States

| State | Category | Description | Consumes Capacity |
|---|---|---|---|
| `PENDING` | Active Hold | Temporary unconfirmed hold (e.g. online booking awaiting payment or confirmation). Has `expiresAt`. | Yes (until `expiresAt`) |
| `CONFIRMED` | Active Booking | Booking confirmed by staff or auto-confirmed. Awaiting start time. | Yes |
| `IN_PROGRESS` | Active Session | Active gaming session currently running. | Yes |
| `COMPLETED` | Terminal | Session finished normally. | No (historical) |
| `CANCELED` | Terminal | Reservation cancelled by staff or customer. Wallet refunded if applicable. | No (released) |
| `NO_SHOW` | Terminal | Customer failed to arrive after scheduled start time. | No (released) |
| `EXPIRED` | Terminal | Pending hold expired without confirmation. | No (released) |

### Transition Matrix

| From \ To | PENDING | CONFIRMED | IN_PROGRESS | COMPLETED | CANCELED | NO_SHOW | EXPIRED |
|---|---|---|---|---|---|---|---|
| **PENDING** | - | Allowed | Rejected | Rejected | Allowed | Rejected | Allowed |
| **CONFIRMED** | Rejected | Idempotent | Allowed | Allowed | Allowed | Allowed | Rejected |
| **IN_PROGRESS**| Rejected | Rejected | Idempotent | Allowed | Allowed | Rejected | Rejected |
| **COMPLETED**  | Rejected | Rejected | Rejected | Idempotent | Rejected | Rejected | Rejected |
| **CANCELED**   | Rejected | Rejected | Rejected | Rejected | Idempotent | Rejected | Rejected |
| **NO_SHOW**    | Rejected | Rejected | Rejected | Rejected | Rejected | Idempotent | Rejected |
| **EXPIRED**    | Rejected | Rejected | Rejected | Rejected | Rejected | Rejected | Idempotent |

---

## 3. Cancellation & Rescheduling Operations

### Cancellation Rules
1. Permitted source states: `PENDING`, `CONFIRMED`, `IN_PROGRESS`.
2. Repeat cancellation calls on `CANCELED` reservations return the existing record without side-effects or duplicate refunds.
3. Wallet refund via `walletService.refundReservationToWallet` runs inside the database transaction.
4. Transition emits `AppEvents.RESERVATION_CANCELED` and writes a `ReservationHistory` record (`action: 'CANCEL'`).

### Rescheduling Rules
1. Allowed for non-terminal states (`PENDING`, `CONFIRMED`).
2. Acquires pessimistic lock on station (`SELECT id FROM "GameStation" WHERE id = $1 FOR UPDATE`).
3. Validates Phase 2 operational rules:
   - Lead time >= `minAdvanceBookingMinutes` (default 30 min) -> `400 LEAD_TIME_TOO_SHORT`
   - Active station & zero overlapping maintenance -> `409 STATION_UNDER_MAINTENANCE`
   - Global operating hours in site timezone -> `409 CENTER_CLOSED`
   - Staff shift window -> `409 SLOT_NOT_AVAILABLE`
   - Active reservation overlap -> `409 SLOT_NOT_AVAILABLE`
4. Recalculates duration, hourly rate, and target dynamic discount.
5. Persists update and `ReservationHistory` record (`action: 'RESCHEDULE'`) inside `Prisma.TransactionClient`.

---

## 4. Database Schema & Migrations

### Prisma Model (`sayra/prisma/schema.prisma`)
```prisma
model ReservationHistory {
  id            String            @id @default(cuid())
  reservationId String
  reservation   Reservation       @relation(fields: [reservationId], references: [id], onDelete: Cascade)
  fromStatus    ReservationStatus
  toStatus      ReservationStatus
  action        String
  actorId       String?
  actorType     SessionActorType?
  reason        String?
  metadata      Json?
  createdAt     DateTime          @default(now()) @db.Timestamptz(6)

  @@index([reservationId, createdAt])
}
```

### SQL Migration (`sayra/prisma/migrations/20261203000000_add_reservation_lifecycle_history/migration.sql`)
- Creates `ReservationHistory` table with foreign key and index constraints.
- Adds PostgreSQL `EXCLUDE USING gist` constraint `Reservation_no_overlap_active` on `(stationId WITH =, tstzrange("startTime", "endTime") WITH &&) WHERE status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING')`.

---

*Report Authored by Jules (Senior Software Architect & Backend Engineer) — Phase 3 Implementation Complete.*
