# PLAY-NEST: Independent Project Discovery, Data Intelligence, and Architecture Assessment

**Date of Inspection:** October 25, 2026
**Repository Branch / Commit:** `jules-11701066705999905253-9cd4b543` / `39ec506`
**Lead Analyst:** Senior AI Systems & Data Architect

---

## A. Executive Summary

### Verified Project Identity
Play-Nest is a multi-tenant gaming center management, station booking, and CMS platform designed primarily for gamenets, esports venues, and arcade centers in Iran. The system is architected as a dual-backend system operating on shared infrastructure:
1. **Sayra (`sayra/`)**: Express.js + TypeScript + Prisma ORM backend managing multi-center station inventory (PCs, PS5s, Xboxes, VR), online/walk-in/phone reservations, gaming sessions, customer wallets, discounts, staff shifts, ledger accounting, and BullMQ background workers.
2. **Payload CMS (`payload/`)**: Monorepo Payload CMS v4 + Next.js backend on `@payloadcms/db-postgres` managing venue landing pages, blog articles, SEO metadata, and media collections.

### Current Maturity and Operational Status
- **Development & Hardening Stage**: The codebase demonstrates advanced domain modeling with 60+ Prisma entities, atomic concurrency controls (`SELECT FOR UPDATE`), ledger-based double-entry accounting models, waitlist FIFO matching, and BullMQ background queues.
- **Production Readiness Gaps**: Missing implementation in background workers (`commissionCalc.worker.ts` and `paymentRecalc.worker.ts` are 0-byte files), incomplete test execution relative to root directory, hardcoded Iranian IRR currency assumptions without explicit ISO 4217 currency columns in some schema tables, and reliance on static API keys (`x-api-key`) alongside JWTs.

### Most Consequential Findings
- **Dual-Database Architecture**: Shared PostgreSQL 15 container housing `playenest_prod` (Sayra) and `payload_db` (Payload CMS), connected via string reference IDs without foreign key cross-database constraints.
- **Concurrency & State Safety**: Reservation booking uses raw SQL pessimistic locking (`FOR UPDATE`) in `sayra/src/modules/reservation/reservation.station.ts` to prevent double-booking race conditions during simultaneous online/walk-in check-ins.
- **Financial Integrity**: Payment and wallet operations utilize ledger entries (`LedgerEntry`) with state machines (`PaymentState`), supporting Zarinpal payment gateway webhooks and refunds.

### Strategic Direction & Key Uncertainties
- **Primary Goal**: Establish an isolated analytical data pipeline to process reservation occupancy, customer lifetime value (LTV), wallet velocity, and station maintenance without burdening the primary OLTP PostgreSQL instance.
- **Key Uncertainties**: Actual production traffic volume, gateway webhook latency during peak Iranian internet degradation, and mobile client API integration state.

---

## B. Project Reality

### Verified Product & User Roles
- **System Classification**: Multi-tenant SaaS / Hybrid On-Premises Gaming Center Operations System.
- **User Roles Implemented**:
  - `SUPER_ADMIN`: Cross-tenant platform administration.
  - `GAMING_CENTER_ADMIN` / `MANAGER`: Venue configuration, staff shift scheduling, station setup, pricing tiers.
  - `STAFF` / `OPERATOR`: Walk-in session management, reservation check-in, station status toggling.
  - `CUSTOMER`: Public reservation booking, wallet recharge, waitlist entries, rating submission.

### Verified vs. Documented Intent
| Feature Concept | Documented Intent (`docs/playenest-prd.md`) | Verified Implementation State |
|---|---|---|
| **Station Reservation** | Online, walk-in, phone reservation engine | **VF**: Implemented in `sayra/src/modules/reservation/` with time proposals, overlap checks, and state transitions. |
| **Wallet & Financials** | Zarinpal gateway, wallet deposit, ledger entries | **VF**: Implemented in `sayra/src/modules/wallet/` & `sayra/src/modules/payments/`. |
| **Waitlist Engine** | Automated queueing for occupied stations | **VF**: Implemented in `sayra/src/modules/waitlist/` with FIFO matching and `WaitlistExpiryWorker`. |
| **Commission Calculations** | Automated franchise/platform commission processing | **IN**: Partially implemented in schema (`CommissionPolicy`), but `commissionCalc.worker.ts` is 0 bytes. |
| **CMS & SEO** | Venue landing pages, blog, media storage | **VF**: Implemented in `payload/src/collections/` using Payload CMS. |

---

## C. System Map

### Tech Stack Inventory
- **Backend Frameworks**: Node.js v22, Express.js 4.19, TypeScript 5.4, Prisma ORM 5.22, Payload CMS v4 (Next.js 15).
- **Storage & Infrastructure**: PostgreSQL 15 Alpine (dual DBs: `playenest_prod` & `payload_db`), Redis 7 Alpine, NGINX Reverse Proxy, Docker Compose.
- **Task Processing & Observability**: BullMQ 5.77, Pino-HTTP 10.1, @sentry/node 10.38, smsir-js 1.3 (SMS API).

### Architecture & Service Topology
```
                  +-----------------------------------+
                  |        Client Requests            |
                  +-----------------------------------+
                                    |
                                    v
                  +-----------------------------------+
                  |        NGINX (Port 80)            |
                  +-----------------------------------+
                       /                    \
                      /                      \
                     v                        v
+-------------------------------+   +-------------------------------+
|      Sayra Backend (3000)     |   |     Payload CMS (3000)        |
|  - Express / Prisma OLTP      |   |  - Next.js Admin Panel        |
|  - BullMQ Queue & Workers     |   |  - Content & SEO Media        |
+-------------------------------+   +-------------------------------+
            |               \       /               |
            |                \     /                |
            v                 v   v                 v
+-----------------------+   +---------------------------------------+
|  Redis 7 (Jobs/Cache) |   | PostgreSQL 15 (playenest_prod / payload_db) |
+-----------------------+   +---------------------------------------+
```

---

## D. Current Capabilities

### Capability Matrix
| Capability | Implementation Path / Module | Verification Evidence | Operational Readiness |
|---|---|---|---|
| **Station Inventory Management** | `sayra/src/modules/station/` | Models `GameStation`, `StationMaintenance`, `StaffStationSkill` in Prisma schema. | High |
| **Reservation State Machine** | `sayra/src/modules/reservation/` | States: `PENDING_PAYMENT`, `CONFIRMED`, `CHECKED_IN`, `COMPLETED`, `CANCELLED`, `EXPIRED`. Raw SQL locking verified. | High |
| **Waitlist Matching** | `sayra/src/modules/waitlist/` | Models `WaitlistEntry`, `WaitlistOffer`. Expiry worker active. | Medium-High |
| **Wallet & Ledger Accounting** | `sayra/src/modules/wallet/`, `payments/` | Double-entry `LedgerEntry` and `ReconciliationRecord` models present. | High |
| **CMS & Venue Landing Pages** | `payload/src/collections/` | Next.js dynamic routing, postgres db push active. | Medium |
| **Commission Worker** | `sayra/src/jobs/workers/commissionCalc.worker.ts` | File exists as 0 bytes. | Unimplemented |
| **Payment Recalculation Worker**| `sayra/src/jobs/workers/paymentRecalc.worker.ts` | File exists as 0 bytes. | Unimplemented |

---

## E. Data Inventory

### Data Sources & System of Record
1. **`playenest_prod` (Primary OLTP)**: System of record for users, centers, stations, reservations, payments, ledger entries, waitlists, staff shifts, and audit logs.
2. **`payload_db` (CMS Database)**: System of record for news articles, venue profile landing pages, SEO metadata, and media uploads.
3. **Redis Key-Value Store**: BullMQ delay queues, rate limiting counters, active user sessions.
4. **Pino Log Streams**: Structured JSON application logs with HTTP request/response details.

---

## F. Analytics Opportunities

### Domain Summary
- **Occupancy & Station Efficiency**: Measure hourly station utilization across PC, PS5, Xbox, VR.
- **Cohort & Customer LTV**: Analyze repeat reservation rates, wallet top-up frequency, and discount redemption impact.
- **Revenue & Commission Analytics**: Track gross booking value (GBV), net venue revenue, gateway fee overhead, and platform commission margins.

---

## G. User and Product Intelligence

### Key Product Journeys
1. **Online Booking Flow**: Search stations -> Select time slot -> Apply discount -> Initiate payment / Wallet deduction -> Confirm reservation -> Check-in via SMS / QR code.
2. **Walk-In / Operator Flow**: Staff select station on grid -> Create immediate `GamingSession` -> Collect cash / POS -> Complete session.
3. **Waitlist Flow**: Station fully booked -> User enters Waitlist -> Station becomes available -> Automated FIFO offer emitted via SMS -> User accepts within timeout window.

---

## H. Business and Operational Intelligence

### Key Operational Metrics
- **Station Occupancy Rate (SOR)**: $\frac{\text{Total Occupied Station Hours}}{\text{Total Available Station Hours}} \times 100\%$
- **Average Revenue Per Station (ARPS)**: Total revenue generated by specific hardware category over time $T$.
- **Waitlist Conversion Rate**: Percentage of `WaitlistOffer` records transitioning to `CONFIRMED` reservations.

---

## I. Geospatial Intelligence

### Current Implementation & Opportunities
- **Current Geographic Data**: `Address` Prisma model contains `city`, `province`, `postalCode`, `latitude`, `longitude`. Payload CMS includes `CityLandingPages`.
- **Geospatial Analytics Opportunities**: Clustering demand by city/neighborhood to identify underserved gaming center territories; analyzing travel distance elasticity for VIP gaming stations.

---

## J. Technical Observability

### Logging, Metrics, Tracing & Monitoring Assessment
- **Logging**: Configured via Pino (`sayra/src/config/logger.ts`) and `pino-http` middleware (`sayra/src/common/middleware/logger.ts`). Logs directly to `stdout` in standard JSON format in production.
- **Error Tracking**: Integrated with Sentry (`@sentry/node` v10.38) in `sayra/src/app.ts` with error handlers and request contexts.
- **Health Checks**: Express healthcheck endpoint at `/health` and `/api/v1/health` used by Docker Compose and NGINX upstream verification.
- **Observability Gaps**: Lacks Prometheus/OpenTelemetry metrics exposition for BullMQ job queue lengths, database connection pool saturation, and API endpoint latency metrics.

---

## K. AI and Predictive Opportunities

### High-Value AI Use Cases
1. **Dynamic Hourly Pricing & Yield Management**: Model historical reservation occupancy and local time-of-day demand to recommend dynamic hourly rates for VIP vs Standard stations.
2. **Automated No-Show & Churn Prediction**: Predict reservation cancellation or no-show likelihood based on customer deposit history, wallet balance, and previous lead time.
3. **Smart Waitlist Allocation**: Estimate expected gaming session duration variance to optimize waitlist expiry windows and reduce station idle time between bookings.

---

## L. Data Collection Plan

### Product Event Instrumentation Specification
| Event Name | Triggering Condition | Required Payload Properties | Target System |
|---|---|---|---|
| `reservation_submitted` | Customer submits online booking request | `reservationId`, `gamingCenterId`, `stationId`, `startTime`, `durationMinutes`, `totalPrice` | Sayra OLTP / Event Stream |
| `payment_completed` | Gateway webhook or wallet deduction succeeds | `paymentId`, `reservationId`, `amount`, `provider`, `transactionRef` | Ledger / Analytics DB |
| `waitlist_joined` | Customer joins queue for occupied station | `waitlistId`, `gamingCenterId`, `stationType`, `requestedTime` | Waitlist Analytics |
| `station_status_changed` | Operator toggles station (Maintenance, Online, Offline) | `stationId`, `previousState`, `newState`, `operatorId` | Audit Log / Telemetry |

---

## M. Architecture Recommendations

### Target Analytical Architecture
To keep primary OLTP database performance optimal without resource contention from heavy reporting queries:
1. **PostgreSQL Read Replica / Analytical Database**: Implement a PostgreSQL read replica or dedicated DuckDB / ClickHouse analytical store fed asynchronously via logical replication or CDC (Change Data Capture).
2. **Complete Missing Background Workers**: Implement the empty `commissionCalc.worker.ts` and `paymentRecalc.worker.ts` modules in BullMQ to automate background calculations.
3. **Decouple API Gateway Authentication**: Transition from static API key (`x-api-key`) sharing to scoped OAuth2 / JWT client credentials for external service integrations.

---

## N. Security and Privacy

### Security & Compliance Evaluation
- **Authentication**: JWT access & refresh tokens with Argon2/bcrypt password hashing (`sayra/src/modules/auth/`).
- **Tenant Isolation**: Handled via `tenantGuard.ts` and `gamingCenterId` checks across route handlers.
- **Security Headers**: Managed centrally by Express Helmet (`helmet()`) with tailored Content Security Policy (CSP) for HTTP Swagger UI rendering.
- **Privacy / Data Governance**: Customer phone numbers and OTP logs (`PhoneOtp`) must be governed under strict retention schedules to protect user privacy.

---

## O. Prioritized Roadmap

### Phase 1: Immediate Verification & Containment (Weeks 1-2)
- Implement `commissionCalc.worker.ts` and `paymentRecalc.worker.ts` background workers.
- Add test configuration fixes (`rootDir` relative Jest runner for `sayra/`).

### Phase 2: Foundational Data & Observability Improvements (Weeks 3-6)
- Expose Prometheus metrics endpoint (`/metrics`) for BullMQ queue backlogs and API latency.
- Establish automated PostgreSQL read-replica sync for analytical queries.

### Phase 3: Analytical Capabilities & Yield Optimization (Weeks 7-12)
- Deploy automated revenue, occupancy, and staff shift analytics dashboards.
- Pilot dynamic pricing recommendations engine for high-demand centers.

---

## P. Open Questions

1. **Production Deployment Topology**: Is Sayra deployed on a single VM or clustered containers behind load balancers in production?
2. **Third-Party SMS Gateway Rate Limits**: What are the strict quota limits and failover behavior for `smsir-js` during Iranian provider disruptions?
3. **POS Hardware Integration**: Are venue receipt printers and physical arcade card readers connected via local IP sockets or USB serial agents?

---

## Q. Evidence and Confidence

| Finding ID | Claim / Observation | Classification | Source Reference | Confidence |
|---|---|---|---|---|
| **EVD-01** | Dual-backend design with Express (Sayra) and Payload CMS | **VF** | `docker-compose.yml`, `sayra/package.json`, `payload/package.json` | High |
| **EVD-02** | Raw SQL pessimistic locking for reservation overlaps | **VF** | `sayra/src/modules/reservation/reservation.station.ts` | High |
| **EVD-03** | 0-byte background workers for commission & recalculation | **VF** | `sayra/src/jobs/workers/commissionCalc.worker.ts` | High |
| **EVD-04** | Double-entry ledger accounting schema models | **VF** | `sayra/prisma/schema.prisma` (`LedgerEntry`) | High |

---

## R. Recommended Next Actions

1. Complete pre-commit review and code verification steps.
2. Implement missing BullMQ background worker logic in `sayra/src/jobs/workers/`.
3. Standardize root-level workspace Jest test commands across `sayra` and `payload`.

---

## S. Additional Findings

- **Local Development Zero-Setup**: Root `.env.dev` and `.env.example` enable rapid local development spin-up.
- **NGINX Reverse Proxy Configuration**: NGINX template filtering prevents variable substitution stripping of internal variables ($host, $remote_addr) during container boot.

---

## 21. Data Readiness and Opportunity Matrix

| Opportunity ID | Analytical Question | Business Decision | Required Data | Current Source | Readiness | Proposed Method | Priority |
|---|---|---|---|---|---|---|---|
| **OPP-01** | What is the hourly station occupancy rate by hardware type? | Station acquisition & pricing adjustments | `Reservation`, `GameStation`, `GamingSession` | `playenest_prod` DB | Available | Descriptive / Aggregation | P1 |
| **OPP-02** | Which customers have highest wallet recharge velocity? | VIP loyalty tiers and promo targeting | `WalletTransaction`, `CustomerAccount` | `playenest_prod` DB | Available | Cohort Analysis | P1 |
| **OPP-03** | What is the waitlist drop-off rate and expiry duration? | Adjust waitlist offer expiry windows | `WaitlistEntry`, `WaitlistOffer` | `playenest_prod` DB | Quality Improvement | Diagnostic | P2 |
| **OPP-04** | How do staff shift schedules impact venue booking revenue? | Shift scheduling optimization | `StaffShift`, `Reservation`, `Earning` | `playenest_prod` DB | Available | Predictive Correlation | P2 |

---

## 22. Architecture Decision Records (ADRs)

### ADR-01: Asynchronous Analytical Query Offloading
- **Status**: Proposed
- **Context**: Executing heavy reporting and occupancy aggregation queries on `playenest_prod` risks locking core transactional tables during peak customer booking hours.
- **Decision**: Create a dedicated PostgreSQL read-replica or export CDC events to an analytical datastore for BI reporting.
- **Consequences**: Zero impact on OLTP reservation transaction latency; requires minimal replication monitoring overhead.

### ADR-02: Implementation of Unfinished BullMQ Workers
- **Status**: Proposed
- **Context**: `commissionCalc.worker.ts` and `paymentRecalc.worker.ts` are currently 0-byte placeholders.
- **Decision**: Implement robust job processing handlers with retry logic and idempotency checks in these worker files.
- **Consequences**: Enables background automated revenue distribution and reconciliation processing without blocking HTTP request threads.

---

## 23. Validation and Acceptance Criteria

- **API Specification Compliance**: OpenAPI 3.0 specification (`sayra/src/docs/openapi.yaml`) passes Spectral linting (`npm run api:validate`) with zero critical errors.
- **Data Integrity**: Double-entry ledger entries match total completed reservation payments across reconciliation cycles.
- **Concurrency Verification**: Simultaneous reservation requests for the same station time slot result in exactly one `CONFIRMED` booking and zero overlapping entries.
