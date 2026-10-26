# Play-Nest Analytics — Canonical Handoff Contract

## Executive Overview
This document serves as the canonical handoff contract for the Play-Nest Analytics suite across all development phases.

---

## Current Status & Completed Phases

### Phase 1: Ingestion Pipeline & Schema
- **Status**: COMPLETED (PASS)
- **Deliverables**:
  - Prisma models `AnalyticsWatermark`, `AnalyticsIngestionRun`, `AnalyticsTenant`, `AnalyticsCustomer`, `AnalyticsStation`, `AnalyticsReservation`, `AnalyticsGamingSession`, `AnalyticsPayment`, `AnalyticsLedgerEntry`, `AnalyticsRefund`.
  - Ingestion service (`analyticsIngestionService.ts`), background worker (`analyticsIngestion.worker.ts`), and producer (`analyticsIngestion.producer.ts`).
  - Idempotent upserts with 2-hour sliding lookback windows and chunked batch pagination (`batchSize: 500`).

### Phase 2: Operational Reporting & Dashboard UI
- **Status**: COMPLETED (PASS)
- **Deliverables**:
  - Reporting endpoints under `/api/v1/gamingCenters/:gamingCenterId/analytics/*` (`/summary`, `/reservations`, `/financials`, `/operations/waitlist`, `/operations/notifications`, `/staff`, `/stations`, `/revenue-chart`, `/ingestion-status`).
  - Server-side database aggregations in `AnalyticsRepo` and site-timezone boundary conversions (`resolveTimezoneAndBoundaries`).
  - Internal Management Dashboard UI mounted at `/api/v1/admin/gamingCenters/:gamingCenterId/dashboard`.

### Phase 3: Customer Analytics
- **Status**: COMPLETED (PASS)
- **Deliverables**:
  - Customer analytics endpoints under `/api/v1/gamingCenters/:gamingCenterId/analytics/customers/*`:
    - `GET /summary`: Active customers, new vs returning, repeat visit rate %, average time between visits (days), average spend per active customer.
    - `GET /activity`: Daily customer activity trends and visit frequency distribution.
    - `GET /retention`: Monthly cohort retention matrix and repeat visit summary.
    - `GET /segmentation`: Deterministic segmentation (New, Repeat, VIP, At-Risk).
    - `GET /top-spenders`: Top customer spenders with masked phone numbers (`0912***1234`).
  - Phase 3 documentation:
    - `docs/analytics/analytics-phase3-design.md`
    - `docs/analytics/analytics-phase3-metric-definitions.md`
    - `docs/analytics/analytics-phase3-operations-runbook.md`
    - `docs/analytics/analytics-phase3-acceptance-report.md`
  - Integrated Phase 3 Customer Analytics cards and tables into the Internal Management Dashboard template (`dashboard-ui.templates.ts`).
  - Verified test suite `sayra/tests/unit/modules/analytics/analytics.customers.spec.ts` (All 28 analytics unit tests passing).

---

## Prerequisites & Handoff Contract for Phase 4 (Financial Analytics & Reconciliation)

To implement Phase 4 (Financial Analytics & Reconciliation), the next AI agent or engineering team must build upon the following verified foundations:

1. **Source Data Integrity**:
   - Financial source tables (`Payment`, `LedgerEntry`, `Refund`, `WalletTransaction`) must maintain immutable transaction records.
   - Financial definitions must distinguish gross payments (`status = PAID`), refunds (`status = SUCCESSFUL`), recognized reservation revenue (`Reservation.status = COMPLETED`), and unearned wallet balances.

2. **Reconciliation Rules**:
   - `LedgerEntry` types (`PAYMENT`, `REFUND`, `COMMISSION`, `ADJUSTMENT`) form the primary audit trail for financial reconciliation.
   - Wallet top-ups are unearned cash liabilities until consumed for reservation payments.

3. **Multi-Currency & Isolation**:
   - All financial aggregations must group by `currency` (e.g. `IRR`, `IRT`, `USD`).
   - Tenant isolation via `gamingCenterId` must be strictly enforced on all financial analytical routes.

4. **Security & Authorization**:
   - Financial endpoints must enforce server-side RBAC restricted to `MANAGER` and `ADMIN` roles.
