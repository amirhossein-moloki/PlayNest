# Phase 2 Implementation Report: Operational Reservation Constraints

## 1. Executive Summary

Phase 2 establishes operational constraint enforcement for the Sayra Reservation Engine. Reservations now depend on site-level operating hours, station maintenance windows, advance lead times, and time-zone correctness, in addition to time-slot overlap prevention.

Key outcomes:
- **Lead Time Enforcement (BR-001):** Minimum advance booking time (default 30 minutes, or configurable per center via `Settings.minAdvanceBookingMinutes`) is enforced on all customer-facing bookings, returning `400 Bad Request` with structured code `LEAD_TIME_TOO_SHORT`.
- **Site Operating Hours:** Site global operating hours (`Settings.workStartTime`/`workEndTime` or `GamingCenter.openingTime`/`closingTime`) are evaluated in the site's local timezone (`Settings.timeZone`), supporting both same-day and overnight (day-crossing) shifts. Requests outside operating hours return `409 Conflict` with code `CENTER_CLOSED`.
- **Station Maintenance & Active State:** Stations with active `StationMaintenance` windows overlapping requested intervals return `409 Conflict` with code `STATION_UNDER_MAINTENANCE`. Inactive stations (`isActive = false`) return `404 Not Found` / `STATION_INACTIVE`. Maintenance windows are also excluded from public slot availability (`getAvailableSlots`).
- **Timezone Correctness:** Standardized time-zone conversions using `date-fns-tz` translate UTC database timestamps into local wall-clock dates and times based on `Settings.timeZone` (e.g., `'Asia/Tehran'`, `'America/New_York'`, `'UTC'`) with automatic fallback for invalid timezones.
- **Zero Placeholder Code:** Pruned empty placeholder files (`reservation.overlap.ts` and `reservation.snapshots.ts`) and replaced them with functional domain utilities.

---

## 2. Capabilities Classification & Scope Evaluation

| Capability | Phase 2 Classification | Implementation / Evidence Details |
|---|---|---|
| **Site Operating Hours** | **Implemented Now** | Enforced in `createReservation`, `createPublicReservation`, `updateReservation`, `proposeTime`. Validated against `Settings` / `GamingCenter` operating hours in local timezone. |
| **Schedules by Day of Week** | **Already Implemented & Extended** | `StaffShift` specifies day-of-week shifts in local timezone. Validated by `validateStaffShiftHours`. |
| **Multiple Opening Intervals per Day** | **Deferred** | Not supported by current PRD/domain model (`workStartTime` & `workEndTime` are single daily HH:mm strings). |
| **Holidays, Closures & Blackouts** | **Implemented (Maintenance Blackouts)** | Station-level maintenance windows handled via `StationMaintenance`. Exceptional center-wide holiday calendar deferred due to missing PRD requirement. |
| **Resource / Workstation Availability** | **Implemented Now** | Enforces `GameStation.isActive = true` and verifies zero overlapping `StationMaintenance` records. |
| **Resource Maintenance** | **Implemented Now** | Checked via `ReservationRepo.findOverlappingMaintenance` and filtered in `AvailabilityRepo.findMaintenances`. |
| **Capacity Validation** | **Already Implemented & Verified** | Station allocation is discrete and exclusive per named `GameStation` entity via pessimistic row locking (`lockStationForUpdate`) and overlap constraints. |
| **Minimum Advance-Booking Time** | **Implemented Now** | Enforced via `validateLeadTime` (BR-001, default 30 mins, configurable via `Settings.minAdvanceBookingMinutes`). |
| **Buffers (Prep & Cleanup)** | **Deferred** | No buffer fields in schema or PRD. Customer-facing interval equals reserved resource interval. |
| **Site-Local Timezone Correctness** | **Implemented Now** | Centralized in `reservation.validation.ts` using `toZonedTime` and `formatTz` with `Settings.timeZone`. |

---

## 3. Resource & Capacity Model

- **Reservation Entity Scope:** A `Reservation` binds a customer (`customerAccountId`), a specific station (`stationId`), a staff member (`staffId`), and a gaming center (`gamingCenterId`).
- **Capacity Semantics:** Capacity is represented by named `GameStation` entities (PC, Console, VIP). Each reservation reserves an exclusive time slot on a single station.
- **Exclusivity Invariants:**
  - Application-level row locking: `SELECT id FROM "GameStation" WHERE id = $1 FOR UPDATE` inside `RepeatableRead` transaction.
  - Database-level exclusion constraint: `Reservation_no_overlap_active` on `(stationId, tsrange(startTime, endTime))` in PostgreSQL.
  - Customer active limit: Maximum of 2 active reservations per account (`ACTIVE_RESERVATION_LIMIT_REACHED`).

---

## 4. Timezone & Operating Hours Semantics

- **Storage:** All reservation timestamps (`startTime`, `endTime`, `createdAt`, `updatedAt`, `canceledAt`) are stored strictly as UTC `Timestamptz(6)`.
- **Conversion:** Evaluated by `resolveValidTimeZone(Settings.timeZone)`:
  - If `Settings.timeZone` is valid (e.g. `'Asia/Tehran'`), `toZonedTime(utcDate, timeZone)` converts UTC to local wall-clock time.
  - If `Settings.timeZone` is invalid or missing, defaults safely to `'UTC'`.
- **Operating Hours Types:**
  - **Same-Day Operating Hours:** `workStartTime < workEndTime` (e.g. 09:00 to 23:00). Validates `resStart >= workStart` and `resEnd <= workEnd` on the same local date.
  - **Overnight / Day-Crossing Hours:** `workStartTime >= workEndTime` (e.g. 18:00 to 02:00 next day). Validates reservation start and end within overnight shift boundaries.
  - **24/7 Mode:** If no operating hours are configured, all times are permitted subject to staff shifts and maintenance.

---

## 5. Structured API Validation Outcomes

| Validation Scenario | HTTP Status | Error Code | Response Message |
|---|---|---|---|
| Reservation < min lead time | `400 Bad Request` | `LEAD_TIME_TOO_SHORT` | "Reservation must be booked at least 30 minutes in advance." |
| Outside center operating hours | `409 Conflict` | `CENTER_CLOSED` | "Selected time is outside center operating hours." |
| Station inactive | `404 Not Found` | `STATION_INACTIVE` | "GameStation not found or is not active." |
| Overlapping station maintenance | `409 Conflict` | `STATION_UNDER_MAINTENANCE` | "Station is under maintenance during the requested time." |
| Staff outside shift | `409 Conflict` | `SLOT_NOT_AVAILABLE` | "Selected time is not available." |
| Max active reservations exceeded | `409 Conflict` | `ACTIVE_RESERVATION_LIMIT_REACHED` | "Maximum active reservation limit (2) reached." |

---

## 6. Schema Changes & Migrations

### Prisma Schema Update (`sayra/prisma/schema.prisma`)
Added `minAdvanceBookingMinutes Int @default(30)` to `Settings` model.

### SQL Migration (`sayra/prisma/migrations/20261202000000_add_min_advance_booking_minutes/migration.sql`)
```sql
-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "minAdvanceBookingMinutes" INTEGER NOT NULL DEFAULT 30;
```

### Migration Execution Instruction
To apply this migration in target environments:
```bash
npx prisma migrate deploy
```

---

## 7. Modified Files Summary

1. `sayra/prisma/schema.prisma`: Added `minAdvanceBookingMinutes` field to `Settings`.
2. `sayra/prisma/migrations/20261202000000_add_min_advance_booking_minutes/migration.sql`: Non-destructive schema migration.
3. `sayra/src/modules/reservation/reservation.validation.ts`: Centralized operational validation engine.
4. `sayra/src/modules/reservation/reservation.overlap.ts`: Refactored overlap & operational utilities.
5. `sayra/src/modules/reservation/reservation.snapshots.ts`: Refactored station snapshot utilities.
6. `sayra/src/modules/reservation/reservation.repo.ts`: Added `findOverlappingMaintenance`.
7. `sayra/src/modules/reservation/reservation.station.ts`: Integrated operational validations across creation, update, and proposal workflows.
8. `sayra/src/modules/availability/availability.repo.ts`: Added `findMaintenances`.
9. `sayra/src/modules/availability/availability.station.ts`: Filtered maintenance windows from public slot availability.
10. `sayra/tests/unit/modules/reservations/reservations.operational.spec.ts`: Unit test suite covering all Phase 2 operational rules.

---

*Report Authored by Jules (Senior Software Architect & Backend Engineer) — Phase 2 Implementation Complete.*
