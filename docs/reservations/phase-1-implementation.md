# Phase 1 Implementation Report: Reservation Core and Concurrency Guarantees

## 1. Overview & Scope Implemented

Phase 1 establishes absolute transactional integrity and concurrency guarantees for the Sayra Reservation Engine, enforcing that overlapping active reservations cannot be committed for the same exclusive resource across concurrent application instances.

### Key Deliverables Completed:
1. **PostgreSQL Database Exclusion Constraint Migration:**
   - Created SQL migration `sayra/prisma/migrations/20261201000000_add_reservation_exclusion_constraint/migration.sql` creating the `btree_gist` extension and an `EXCLUDE` constraint `Reservation_no_overlap_active` on `Reservation(stationId, tsrange(startTime, endTime, '[)'))` for active statuses (`CONFIRMED`, `IN_PROGRESS`, `PENDING`).
2. **Domain Overlap Engine & Helper Refactoring:**
   - Implemented `sayra/src/modules/reservation/reservation.overlap.ts` with strict half-open interval semantics `[StartTimeUtc, EndTimeUtc)`.
   - Implemented `sayra/src/modules/reservation/reservation.snapshots.ts` for station history snapshotting.
3. **Database Exception Mapping & API Conflict Compatibility:**
   - Refactored `reservationStation.createReservation` and `createPublicReservation` to catch PostgreSQL error `23P01` (exclusion constraint violation) and map it cleanly to HTTP `409 CONFLICT` (`SLOT_NOT_AVAILABLE`).
4. **Automated Unit & Parallel Stress Testing:**
   - Created `sayra/tests/unit/modules/reservations/reservations.overlap.spec.ts` covering adjacent intervals, partial overlap, containment, identical intervals, and invalid timestamps.
   - Created `sayra/tests/integration/modules/reservations/reservations.concurrency.spec.ts` simulating 20 parallel `Promise.all` requests for an identical time slot, verifying exactly 1 succeeds and 19 fail with HTTP `409 CONFLICT`.

---

## 2. Reservation Conflict Rule & Half-Open Interval Boundary

- **Conflict Definition:** Two reservations targeting the same exclusive resource (`stationId`) conflict if their active time windows overlap.
- **Half-Open Interval:** `[StartTimeUtc, EndTimeUtc)`
- **Overlap Logic:** `existing.StartTimeUtc < requestedEnd && existing.EndTimeUtc > requestedStart`
- **Boundary Semantics:**
  - A reservation ending exactly when another starts (`10:00 - 12:00` and `12:00 - 14:00`) does **NOT** conflict.
  - Partially overlapping or fully contained intervals conflict and are rejected.

---

## 3. Persistence Concurrency Strategy & Rationale

- **Primary Protection Layer:** PostgreSQL `EXCLUDE` constraint using `btree_gist` on `stationId` equality and `tsrange` time range overlap with half-open bounds `[)`.
- **Secondary Protection Layer:** Pessimistic station row locking (`SELECT id FROM "GameStation" WHERE id = $1 FOR UPDATE`) inside a `RepeatableRead` Prisma transaction (`$transaction`).
- **Why It Prevents Race Conditions:** The pessimistic row lock serializes check-then-insert operations within a single database session, while the database-level PostgreSQL `EXCLUDE` constraint guarantees atomicity across multiple application instances sharing the database, preventing race conditions even if raw SQL queries or parallel processes bypass the station service layer.

---

## 4. Transaction Boundaries & Workflow

1. Validate input request and domain invariants (ISO 8601 UTC timestamps, `startTime < endTime`).
2. Open Prisma transaction with `RepeatableRead` isolation level.
3. Acquire pessimistic row lock on `GameStation` (`FOR UPDATE`).
4. Execute application-level overlap query (`findOverlappingReservation`).
5. Validate customer active reservation cap (max 2 active reservations).
6. Persist reservation (`createReservation`).
7. Commit database transaction.
8. Catch PostgreSQL constraint errors (`23P01`) and map to HTTP 409 Conflict response.
9. Return response and emit domain events (`AppEvents.RESERVATION_CREATED`).

---

## 5. Database Changes & Migrations

- **Migration Path:** `sayra/prisma/migrations/20261201000000_add_reservation_exclusion_constraint/migration.sql`
- **SQL Execution:**
```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "Reservation"
ADD CONSTRAINT "Reservation_no_overlap_active"
EXCLUDE USING gist (
  "stationId" WITH =,
  tsrange("startTime", "endTime", '[)') WITH &&
)
WHERE (status IN ('CONFIRMED', 'IN_PROGRESS', 'PENDING'));
```

---

## 6. Known Limitations & Deferred Scope

- Operating hours validation, advance lead times (<30 min), and station maintenance windows are deferred to **Phase 2**.
- Group booking API exposure and session lifecycle synchronization are deferred to **Phase 3**.
- Customer wallet refund atomic double-refunding protection is deferred to **Phase 4**.
