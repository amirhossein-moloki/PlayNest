# PHASE 4 — IMPLEMENTATION EXECUTION BLUEPRINT

This blueprint transforms approved Phase 3 architecture decisions into an implementation-ready engineering execution plan for the Playenest platform.

---

## 1. EPIC CATALOG

| EPIC ID | EPIC NAME | BUSINESS GOAL | TECHNICAL GOAL | SCOPE | DEPENDENCIES | PRIORITY |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EPIC-001** | **GamingSession Aggregate** | Enable granular tracking of hardware usage and actual time spent. | Implement independent GamingSession aggregate with pause/resume support. | Start, Pause, Resume, Stop sessions; Session Analytics. | EPIC-002 | 🔴 Critical |
| **EPIC-002** | **Reservation Lifecycle Refactor** | Ensure reliable and strictly enforced reservation states. | Implement PENDING → CONFIRMED → IN_PROGRESS → COMPLETED lifecycle. | State machine logic, Automated transitions, Validations, Terminal states. | None | 🔴 Critical |
| **EPIC-003** | **Payment API Alignment** | Standardize payment route structure for better DX and consistency. | Fix redundant route segments in payment endpoints. | Express route refactoring. | None | 🔴 Critical |
| **EPIC-004** | **Domain Terminology Unification** | Establish official domain language throughout the system. | Rename Service → Station, Booking → Reservation, User → Customer (contextual). | Codebase-wide refactoring (Variables, DTOs, Files). | None | 🟠 High |
| **EPIC-005** | **OpenAPI Synchronization** | Maintain a single source of truth for all API contracts. | Ensure implementation perfectly matches the OpenAPI spec. | OAS updates, Contract tests, Drift prevention. | EPIC-001, 002, 003 | 🟡 Medium |

---

## 2. FEATURE CATALOG

### EPIC-001: GamingSession Aggregate
| FEATURE ID | FEATURE NAME | DESCRIPTION | ACCEPTANCE CRITERIA | API IMPACT | DB IMPACT |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-001** | Start Session | Initiates a session for a confirmed reservation. | - Creates `GamingSession` record (ACTIVE).<br>- Updates Reservation status to `IN_PROGRESS`. | `POST /reservations/:id/sessions/start` | Insert `GamingSession`, Update `Reservation` |
| **FEAT-002** | Pause/Resume | Handles breaks during a session. | - Tracks `pausedAt`.<br>- Calculates `pausedMinutes` upon resumption. | `POST /.../sessions/pause`, `POST /.../sessions/resume` | Update `GamingSession` |
| **FEAT-003** | Stop Session | Finalizes session and calculates actual time. | - Calculates `actualHours`.<br>- Updates Reservation status to `COMPLETED` (if paid). | `POST /reservations/:id/sessions/stop` | Update `GamingSession`, Update `Reservation` |

### EPIC-002: Reservation Lifecycle
| FEATURE ID | FEATURE NAME | DESCRIPTION | ACCEPTANCE CRITERIA | API IMPACT | DB IMPACT |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-004** | State Machine Logic | Enforces valid status transitions. | - Prevents invalid transitions (e.g., PENDING -> COMPLETED).<br>- Automated status updates on session events. | Internal Station Logic | Update `Reservation.status` |
| **FEAT-005** | Cancellation Flow | Handles user or staff cancellations. | - Transitions status to `CANCELED`.<br>- Validates cancellation policy (e.g., within time limits). | `POST /reservations/:id/cancel` | Update `Reservation` |
| **FEAT-006** | No-Show Handling | Marks missed reservations. | - Transitions status to `NO_SHOW`.<br>- Triggers potential no-show penalties. | `POST /reservations/:id/no-show` | Update `Reservation` |

### EPIC-003: Payment API Alignment
| FEATURE ID | FEATURE NAME | DESCRIPTION | ACCEPTANCE CRITERIA | API IMPACT | DB IMPACT |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-007** | Payment Route Refactor | Standardizes the payment route. | - Removes `/reservations/reservations/` redundancy.<br>- Ensures all payment actions use the new path. | `POST /.../reservations/:id/payments/init` | None |

### EPIC-004: Domain Terminology Unification
| FEATURE ID | FEATURE NAME | DESCRIPTION | ACCEPTANCE CRITERIA | API IMPACT | DB IMPACT |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-008** | Terminology Alignment | Updates all code and API to official terms. | - 'Service' replaced by 'Station' (including internal logic layers).<br>- 'Booking' replaced by 'Reservation'. | Codebase wide DTO/Response renaming | Migration scripts (if needed) |

### EPIC-005: OpenAPI Synchronization
| FEATURE ID | FEATURE NAME | DESCRIPTION | ACCEPTANCE CRITERIA | API IMPACT | DB IMPACT |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FEAT-009** | Contract Validation | Ensures API matches OAS. | - Automated tests pass against `openapi.yaml`.<br>- No drift between implementation and docs. | All Endpoints | None |

---

## 3. ENGINEERING BACKLOG

| TASK ID | TITLE | DESCRIPTION | PRIORITY | COMPLEXITY | DEPENDENCIES |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TASK-GS-001** | GamingSession Logic | Implement `pause`, `resume`, and `stop` (with duration calculation) in `GamingSessionsStation`. | 🔴 Critical | Medium | None |
| **TASK-RES-001** | State Machine | Implement `ReservationStateMachine` with strict transition rules in `ReservationsStation`. | 🔴 Critical | Medium | TASK-GS-001 |
| **TASK-PAY-001** | Payment Route Fix | Modify `src/routes/index.ts` and `payments.routes.ts` to fix redundant segment. | 🔴 Critical | Low | None |
| **TASK-TRM-001** | Terminology Rename | Bulk rename 'Service' classes/vars to 'Station' and 'Booking' to 'Reservation'. | 🟠 High | High | None |
| **TASK-OAS-001** | OpenAPI Sync | Update `src/docs/openapi.yaml` to reflect final route structure and session endpoints. | 🟡 Medium | Medium | All |

---

## 4. MODULE STRUCTURE DESIGN

Target structure following DDD and Clean Architecture (standardizing logic layers as `.station.ts` to align with official terminology):

```text
src/modules/
├── gamingSessions/
│   ├── gamingSessions.controller.ts
│   ├── gamingSessions.station.ts
│   ├── gamingSessions.repo.ts
│   ├── gamingSessions.validators.ts
│   └── gamingSessions.routes.ts
├── reservations/
│   ├── reservations.controller.ts
│   ├── reservations.station.ts
│   ├── reservations.repo.ts
│   ├── reservations.validators.ts
│   └── reservations.routes.ts
└── stations/
    ├── stations.controller.ts
    ├── stations.station.ts
    ├── stations.repo.ts
    ├── stations.validators.ts
    └── stations.routes.ts
```

---

## 5. API DESIGN PACKAGE

### New & Modified Endpoints

| METHOD | ROUTE | AUTH | REQUEST DTO | RESPONSE DTO | BUSINESS RULES |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/.../reservations/:id/sessions/start` | Staff+ | `{ stationId: string }` | `GamingSession` | Res must be CONFIRMED. Res status -> IN_PROGRESS. |
| **POST** | `/.../reservations/:id/sessions/pause` | Staff+ | N/A | `GamingSession` | Session must be ACTIVE. |
| **POST** | `/.../reservations/:id/sessions/stop` | Staff+ | N/A | `GamingSession` | Session must be ACTIVE/PAUSED. Res status -> COMPLETED (if paid). |
| **POST** | `/.../reservations/:id/cancel` | Staff/User | `{ reason: string }` | `Reservation` | Valid in PENDING/CONFIRMED. Transition to CANCELED. |
| **POST** | `/.../reservations/:id/no-show` | Staff+ | N/A | `Reservation` | Valid if current time > startTime + grace. Transition to NO_SHOW. |
| **POST** | `/gamingCenters/:gcId/reservations/:id/payments/init` | Staff+ | `InitPaymentDTO` | `PaymentResponse` | Scoped correctly under reservation. Fixes duplicate segment. |

---

## 6. DATABASE IMPACT ANALYSIS

| CHANGE TYPE | DESCRIPTION | RISK | ROLLBACK | COMPLEXITY |
| :--- | :--- | :--- | :--- | :--- |
| **Constraints** | Ensure `reservationId` in `GamingSession` has a unique constraint for active sessions. | Low | Remove constraint | Low |
| **Indexes** | Add index to `GamingSession(reservationId, status)`. | Low | Drop index | Low |
| **Data Migration** | Update existing 'Service' audit logs or snapshots if necessary (Terminology). | Medium | Restore DB backup | Medium |

---

## 7. TEST STRATEGY

| TEST TYPE | SCOPE | CRITICAL PATHS | FAILURE SCENARIOS |
| :--- | :--- | :--- | :--- |
| **Unit** | Logic layer, Duration calculations. | Session pause/resume duration math. | Invalid state transitions. |
| **Integration** | Repo <-> DB interactions. | Saving session state transitions. | Concurrent session starts for same reservation. |
| **Contract** | OpenAPI compliance. | All modified/new endpoints. | Payload schema mismatch. |
| **E2E** | Full customer flow. | Reservation -> Start -> Stop -> Final Bill. | Payment failure during session completion. |

---

## 8. SPRINT PLANNING

| SPRINT | OBJECTIVES | DELIVERABLES |
| :--- | :--- | :--- |
| **Sprint 1** | Route Cleanup & Terminology | Fixed Payment routes, Renamed logic layers to Station. |
| **Sprint 2** | GamingSession Core | Functional Session Start/Pause/Stop with time tracking. |
| **Sprint 3** | Lifecycle & Transitions | Strictly enforced Reservation State Machine (including Canceled/No-Show). |
| **Sprint 4** | Documentation & QA | 100% OpenAPI sync, E2E tests passing, Final validation. |

---

## 9. RISK ANALYSIS

| RISK ID | TYPE | DESCRIPTION | MITIGATION |
| :--- | :--- | :--- | :--- |
| **RSK-001** | Migration | Bulk terminology rename might break frontend or third-party integrations. | Use alias exports or backward-compatible API stubs during migration. |
| **RSK-002** | Technical | Overlapping sessions or lost "Stop" events leading to overbilling. | Implement automated "Auto-stop" jobs and reconciliation logic. |

---

## 10. DEFINITION OF DONE

*   [ ] OpenAPI synchronized and validated (Single Source of Truth).
*   [ ] All contract tests passing for new/modified endpoints.
*   [ ] Terminology (Station, Reservation, Customer) unified across the codebase.
*   [ ] 100% unit test coverage for Session duration calculations.
*   [ ] Integration tests verify all State Machine transitions.
*   [ ] E2E tests confirm the complete hardware usage lifecycle.
*   [ ] No critical API drift detected between code and documentation.
