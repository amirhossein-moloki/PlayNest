# PHASE 3 ARCHITECTURE RESOLUTION REPORT

## 1. GamingSession Decision

**Selected Option:** OPTION A (Keep GamingSession as an independent aggregate linked to Reservation)

**Reason:**
Gaming centers often require granular tracking of active time, including pauses (for breaks) and interruptions (technical issues). Merging this into the Reservation lifecycle would overload the Reservation entity with volatile operational state. Keeping it independent allows for multiple sessions per reservation (e.g., if a customer moves from one station to another) and provides a clean audit trail for actual hardware utilization.

**Architecture Impact:**
- Reservation remains the "Contract" aggregate.
- GamingSession acts as the "Execution" aggregate.
- Decouples billing (Reservation) from usage tracking (Session).

**Database Impact:**
- No schema change required as `GamingSession` table already exists in `schema.prisma`.
- Ensure indexes on `reservationId` and `status` are optimized for active session lookups.

**API Impact:**
- New endpoints required: `POST /reservations/:id/sessions/start`, `POST /reservations/:id/sessions/pause`, `POST /reservations/:id/sessions/stop`.

**Implementation Impact:**
- High. Requires implementing logic to calculate `actualHours` and sync it back to the Reservation for final billing if necessary.

---

## 2. Reservation Lifecycle Decision

**Official Lifecycle:**
PENDING → CONFIRMED → IN_PROGRESS → COMPLETED

**Transition Rules:**
1. **PENDING → CONFIRMED:** When payment is verified or manager approves.
2. **CONFIRMED → IN_PROGRESS:** When the customer checks in and the session starts.
3. **IN_PROGRESS → COMPLETED:** When the session ends and all payments are cleared.
4. **PENDING/CONFIRMED → CANCELED:** Valid before session starts.
5. **CONFIRMED → NO_SHOW:** If customer doesn't arrive within the grace period.

**Required Refactoring:**
- Restore `IN_PROGRESS` status handling in `reservations.station.ts`.
- Update `reservations.controller.ts` to support the `start` and `complete` actions correctly.
- Ensure terminal states (`COMPLETED`, `CANCELED`, `NO_SHOW`) are strictly enforced.

**Affected APIs:**
- `POST /reservations/:id/start`
- `POST /reservations/:id/complete`
- `GET /reservations` (Filtering by status)

---

## 3. Payment Route Decision

**Current:** `/gamingCenters/:gamingCenterId/reservations/reservations/:reservationId/payments/init`
**Target:** `/gamingCenters/:gamingCenterId/reservations/:reservationId/payments/init`

**Migration Strategy:**
- Update `src/routes/index.ts` to mount `paymentsRoutes` on `/gamingCenters/:gamingCenterId/reservations`.
- Modify `src/modules/payments/payments.routes.ts` to remove the redundant segment.

**Breaking Change:**
Yes. This is a critical fix to align with the designed OpenAPI spec.

---

## 4. Terminology Matrix

| Official Term | Deprecated Term | Refactoring Priority |
| :--- | :--- | :--- |
| **Station** | Service | 🔴 Critical (Code consistency) |
| **Customer** | User (in context of gamer) | 🟠 High (Domain clarity) |
| **Reservation** | Booking | 🟡 Medium (API consistency) |

**Migration Plan:**
- Rename internal Service classes/methods to Station (e.g., `stations.station.ts` already exists but uses some service terminology).
- Update OpenAPI definitions to strictly use "Station" and "Reservation".

---

## 5. Gap Analysis

| Component | Status | Priority |
| :--- | :--- | :--- |
| **GamingSession Logic** | 🔴 Missing | Critical |
| **IN_PROGRESS State** | 🟠 Partially Implemented | High |
| **CMS Links/Addresses** | 🟡 Stub (501) | Medium |
| **OpenAPI Sync** | 🟡 Out of Date | Medium |
| **Public Idempotency** | 🟢 Implemented | Low |

---

## 6. Implementation Backlog

**TASK-ID: ARC-001**
- **Priority:** 🔴 Critical
- **Complexity:** Medium
- **Description:** Implement `GamingSession` service and controller logic.
- **Dependencies:** None.

**TASK-ID: ARC-002**
- **Priority:** 🔴 Critical
- **Complexity:** Low
- **Description:** Fix Payment Route duplication in `src/routes/index.ts`.
- **Dependencies:** None.

**TASK-ID: ARC-003**
- **Priority:** 🟠 High
- **Complexity:** Medium
- **Description:** Refactor `Reservation` service to fully support `IN_PROGRESS` state.
- **Dependencies:** ARC-001.

**TASK-ID: ARC-004**
- **Priority:** 🟠 High
- **Complexity:** Medium
- **Description:** Terminology Unification: Replace all internal "Service" references with "Station".
- **Dependencies:** None.

---

## 7. Target Architecture

### Domain Model
- **Aggregate Root:** Reservation
  - Entities: GamingSession, Payment, Rating.
- **Aggregate Root:** GamingCenter
  - Entities: GameStation, StaffShift, Settings.

### API Model
- `/gamingCenters/:id/stations` (Management)
- `/gamingCenters/:id/reservations` (Operations)
- `/gamingCenters/:id/reservations/:id/sessions` (Live Tracking)

### Lifecycle Model
- Strictly enforced state machine with automated transitions on session events.

---

## 8. Migration Strategy

1. **Phase 1 (Immediate):** Fix routing and terminology stubs.
2. **Phase 2 (Functional):** Implement GamingSession and State Machine transitions.
3. **Phase 3 (Validation):** Update OpenAPI documentation and run E2E regression tests.
