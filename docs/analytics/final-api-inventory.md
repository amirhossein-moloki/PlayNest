# Play-Nest Analytics — Final API Inventory

## Overview
This document provides a comprehensive inventory of all Analytics-related API endpoints and UI routes found in the Play-Nest repository. Every endpoint listed below has been verified in code against route registration, controller logic, service layers, and test suites.

All REST API endpoints are mounted under the base path `/api/v1/gamingCenters/:gamingCenterId/analytics` via `sayra/src/routes/index.ts` and `sayra/src/modules/analytics/analytics.routes.ts`.
Internal management dashboard routes are mounted under `/admin/gamingCenters/:gamingCenterId/dashboard` and `/gamingCenters/:gamingCenterId/dashboard` via `sayra/src/modules/analytics/dashboard-ui.routes.ts`.

---

## Complete Endpoint List

### 1. Ingestion & Operations

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getIngestionStatus`
- **Service & Data Source:** `AnalyticsStation.getIngestionStatus` -> `AnalyticsRepo.getIngestionStatus` (`AnalyticsWatermark`, `AnalyticsIngestionRun`)
- **Purpose:** Returns current data freshness, overall pipeline status (`FRESH` or `STALE`), and latest entity watermarks.
- **Request Parameters & Validation:** None beyond `gamingCenterId` route param.
- **Response Structure:** `{ status: "FRESH" | "STALE", lastIngestedAt: Date | null, watermarks: Array<{ entity: string, lastIngestedAt: Date }> }`
- **Authentication:** Bearer JWT required (`authMiddleware`).
- **Required Roles:** `MANAGER`, `ADMIN` (`requireRole`).
- **Tenant Authorization:** Enforced via `tenantGuard` (404 on tenant mismatch).
- **Pagination & Date Filters:** N/A.
- **Implementation Status:** `VERIFIED IMPLEMENTED`
- **Tests & Outcome:** `sayra/tests/unit/modules/analytics/analytics.station.spec.ts` (PASS).

---

### 2. Internal Management & Core Analytics

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/summary`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/summary`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getSummary`
- **Service & Data Source:** `AnalyticsStation.getSummary` -> `AnalyticsRepo` (`GamingCenterAnalytics`, `AnalyticsReservation`, `AnalyticsPayment`)
- **Purpose:** Primary executive summary KPIs for selected time window.
- **Request Parameters & Validation:** `startDate` (ISO string, optional), `endDate` (ISO string, optional), `timeZone` (string, optional). Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `{ period: { startDate, endDate, timeZone }, totalRevenue, realizedCash, totalReservations, completedReservations, canceledReservations, completionRate, averageReservationValue, newCustomers }`
- **Authentication:** Bearer JWT required (`authMiddleware`).
- **Required Roles:** `MANAGER`, `ADMIN` (`requireRole`).
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`
- **Tests & Outcome:** `sayra/tests/api/analytics/analytics.api.spec.ts` (PASS).

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/reservations`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/reservations`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getReservations`
- **Service & Data Source:** `AnalyticsStation.getReservationReport` -> `AnalyticsRepo` (`AnalyticsReservation`, `GameStation`)
- **Purpose:** Reservation operational report, status distributions, station breakdown, and daily trends.
- **Request Parameters & Validation:** `startDate`, `endDate`, `timeZone`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `{ period, totalReservations, metrics: { completionRate, cancellationRate, noShowRate, averageDurationHours, averageReservationValue }, statusDistribution, stationBreakdown, trends }`
- **Authentication:** Bearer JWT required (`authMiddleware`).
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/financials`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/financials`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getFinancials`
- **Service & Data Source:** `AnalyticsStation.getFinancialReport` -> `AnalyticsRepo` (`AnalyticsPayment`, `AnalyticsRefund`, `AnalyticsLedgerEntry`)
- **Purpose:** High-level financial reporting by payment status, method, provider, and ledger summary.
- **Request Parameters & Validation:** `startDate`, `endDate`, `currency` (IRR/IRT). Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `{ period, summary: { currency, grossCollected, totalRefunded, netCollected }, paymentsByStatus, paymentsByMethod, paymentsByProvider, ledgerSummary }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/waitlist`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/operations/waitlist`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getWaitlist`
- **Service & Data Source:** `AnalyticsStation.getWaitlistReport` -> `AnalyticsRepo` (`WaitlistEntry`, `WaitlistOffer`)
- **Purpose:** Waitlist conversion rate, entries status breakdown, and offer acceptance statistics.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `{ period, totalEntries, conversionRate, entriesByStatus, offersSummary: { totalOffers, offerAcceptanceRate, offersByStatus } }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/notifications`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/operations/notifications`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getNotifications`
- **Service & Data Source:** `AnalyticsStation.getNotificationReport` -> `AnalyticsRepo` (`NotificationLog`)
- **Purpose:** SMS/Notification dispatch statistics, failure rates, status/channel/type distributions.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `{ period, totalLogs, failureRate, statusDistribution, channelDistribution, typeDistribution }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/staff`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/staff`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getStaffPerformance`
- **Service & Data Source:** `AnalyticsStation.getStaffPerformance` -> `AnalyticsRepo` (`StaffAnalytics`, `Staff`)
- **Purpose:** Staff member productivity, reservations handled, revenue generated, average customer rating.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `Array<{ staffId, staffName, reservationCount, revenue, averageRating }>`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/stations`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/stations`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getStationPerformance`
- **Service & Data Source:** `AnalyticsStation.getStationPerformance` -> `AnalyticsRepo` (`AnalyticsStation`, `AnalyticsReservation`)
- **Purpose:** Per-station utilization rates, total hours booked, revenue generated.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `Array<{ stationId, stationName, stationType, isActive, reservationCount, totalHoursBooked, revenue, utilizationRate }>`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/revenue-chart`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/revenue-chart`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getRevenueChart`
- **Service & Data Source:** `AnalyticsStation.getRevenueChart` -> `AnalyticsRepo` (`AnalyticsReservation`)
- **Purpose:** Time-series revenue chart data aggregated daily.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `Array<{ date: string, revenue: number }>`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

---

### 3. Customer Analytics (Phase 3)

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/customers/summary`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/customers/summary`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getCustomerSummary`
- **Service & Data Source:** `AnalyticsStation.getCustomerSummary` -> `AnalyticsRepo` (`AnalyticsReservation`, `AnalyticsCustomer`)
- **Purpose:** Active, new, returning, and repeat customer counts, repeat visit rate, avg days between visits, recorded spend.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `CustomerAnalyticsQuerySchema`.
- **Response Structure:** `{ period, activeCustomers, newCustomers, returningCustomers, repeatCustomers, repeatVisitRate, avgDaysBetweenVisits, totalRecordedSpend, avgSpendPerActiveCustomer, avgSpendPerVisit, ltvDisclaimer }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`
- **Tests & Outcome:** `sayra/tests/unit/modules/analytics/analytics.customers.spec.ts` (PASS).

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/customers/activity`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/customers/activity`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getCustomerActivity`
- **Service & Data Source:** `AnalyticsStation.getCustomerActivity` -> `AnalyticsRepo`
- **Purpose:** Daily customer visit trends and visit frequency distribution histogram.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `CustomerAnalyticsQuerySchema`.
- **Response Structure:** `{ period, trends: Array<{ date, activeCustomers, visits, spend }>, frequencyDistribution: Array<{ bucket, count }> }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/customers/retention`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/customers/retention`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getCustomerRetention`
- **Service & Data Source:** `AnalyticsStation.getCustomerRetention` -> `AnalyticsRepo`
- **Purpose:** Cohort retention matrix tracking monthly customer retention for up to 6 historical cohorts.
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `CustomerAnalyticsQuerySchema`.
- **Response Structure:** `{ period, summaryMetrics, cohortMatrix: Array<{ cohort, cohortSize, retention: Array<{ monthIndex, monthKey, activeCount, retentionRate }> }> }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/customers/segmentation`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/customers/segmentation`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getCustomerSegmentation`
- **Service & Data Source:** `AnalyticsStation.getCustomerSegmentation` -> `AnalyticsRepo`
- **Purpose:** Customer segmentation analysis (`NEW`, `REPEAT`, `VIP`, `AT_RISK`).
- **Request Parameters & Validation:** `startDate`, `endDate`. Validated by `CustomerAnalyticsQuerySchema`.
- **Response Structure:** `{ period, totalActiveInPeriod, segments: Array<{ key, title, count, description }> }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/customers/top-spenders`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/customers/top-spenders`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getTopSpenders`
- **Service & Data Source:** `AnalyticsStation.getTopSpenders` -> `AnalyticsRepo`
- **Purpose:** Top customer spenders ranking with masked phone numbers (`0912***1234`).
- **Request Parameters & Validation:** `startDate`, `endDate`, `limit` (max 100, default 10). Validated by `CustomerAnalyticsQuerySchema`.
- **Response Structure:** `{ period, topSpenders: Array<{ customerAccountId, fullName, phone, visits, totalSpend }> }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

---

### 4. Financial Analytics & Reconciliation (Phase 4)

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/financials/overview`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/financials/overview`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getFinancialOverviewDetailed`
- **Service & Data Source:** `AnalyticsStation.getFinancialOverviewDetailed` -> `AnalyticsRepo` (`AnalyticsPayment`, `AnalyticsRefund`, `AnalyticsLedgerEntry`, `WalletTransaction`, `Earning`)
- **Purpose:** Detailed financial breakdown across payments, refunds, ledger entries, wallet movements, and staff commissions.
- **Request Parameters & Validation:** `startDate`, `endDate`, `currency`. Validated by `AnalyticsQuerySchema`.
- **Response Structure:** `{ period, payments, refunds, ledger, wallet, customerWallets, commissions }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`
- **Tests & Outcome:** `sayra/tests/unit/modules/analytics/analytics.financials.spec.ts` (PASS).

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/financials/reconciliation`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/financials/reconciliation`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getFinancialReconciliation`
- **Service & Data Source:** `AnalyticsStation.getFinancialReconciliation` -> `AnalyticsRepo.runFinancialReconciliationCheck`
- **Purpose:** Non-mutative financial reconciliation findings evaluating diagnostic rules `REC-001` through `REC-006`.
- **Request Parameters & Validation:** `startDate`, `endDate`, `status` (`ALL`, `UNMATCHED`, `DISCREPANCY`), `ruleId`, `limit`. Validated by `FinancialReconciliationQuerySchema`.
- **Response Structure:** `{ period, evaluatedAt, totalEvaluatedRecords, findingCount, statusCounts, findings: Array<{ ruleId, ruleName, severity, status, sourceEntity, sourceId, details, expectedAmount, actualAmount }> }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

#### `POST /api/v1/gamingCenters/:gamingCenterId/analytics/financials/reconciliation/run`
- **HTTP Method:** `POST`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/financials/reconciliation/run`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.runFinancialReconciliation`
- **Service & Data Source:** `AnalyticsStation.getFinancialReconciliation` -> `AnalyticsRepo.runFinancialReconciliationCheck`
- **Purpose:** Triggers a manual non-mutative financial reconciliation audit run for a given period.
- **Request Parameters & Validation:** Body: `{ startDate?: string, endDate?: string }`.
- **Response Structure:** Same as `GET /financials/reconciliation`.
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

---

### 5. Benchmarking & Growth Insights (Phase 7)

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/benchmarks`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/benchmarks`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getBenchmarks`
- **Service & Data Source:** `AnalyticsStation.getBenchmarks` -> `AnalyticsRepo.getCrossTenantReservationStats`, `getCrossTenantStationCounts`, `getCrossTenantCustomerStats`
- **Purpose:** Privacy-preserving cross-tenant benchmark comparison with $k$-anonymity ($k \ge 5$) suppression and self-exclusion.
- **Request Parameters & Validation:** `startDate`, `endDate`, `peerGroupCategory`. Validated by `BenchmarkQuerySchema`.
- **Response Structure:** `{ status: "PUBLISHED" | "SUPPRESSED" | "DISABLED", isSuppressed: boolean, peerCohortCount, peerGroupCategory, period, tenantMetrics, benchmarks: { completionRate, averageSessionDurationHours, stationUtilizationRate, repeatVisitRate }, dataFreshness }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`
- **Tests & Outcome:** `sayra/tests/unit/modules/analytics/analytics.benchmarks.spec.ts` (PASS).

#### `GET /api/v1/gamingCenters/:gamingCenterId/analytics/growth-insights`
- **HTTP Method:** `GET`
- **Route Path:** `/api/v1/gamingCenters/:gamingCenterId/analytics/growth-insights`
- **Route Registration File:** `sayra/src/modules/analytics/analytics.routes.ts`
- **Controller:** `AnalyticsController.getGrowthInsights`
- **Service & Data Source:** `AnalyticsStation.getGrowthInsights` -> `AnalyticsStation.getSummary`, `getBenchmarks`
- **Purpose:** Explainable, fact-backed growth insights comparing current vs prior period and peer benchmark median.
- **Request Parameters & Validation:** `startDate`, `endDate`, `peerGroupCategory`. Validated by `BenchmarkQuerySchema`.
- **Response Structure:** `{ period, priorPeriod, insightCount, insights: Array<{ id, title, metric, direction, insightType, observedChange, evidenceBasis }>, dataFreshness, disclaimer }`
- **Authentication:** Bearer JWT required.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

---

### 6. SSR Dashboard UI Routes

#### `GET /gamingCenters/:gamingCenterId/dashboard` & `GET /admin/gamingCenters/:gamingCenterId/dashboard`
- **HTTP Method:** `GET`
- **Route Paths:**
  1. `/gamingCenters/:gamingCenterId/dashboard`
  2. `/admin/gamingCenters/:gamingCenterId/dashboard`
- **Route Registration File:** `sayra/src/modules/analytics/dashboard-ui.routes.ts`
- **Controller:** `renderDashboard` -> `dashboardTemplate(gamingCenterId)`
- **Purpose:** Server-side rendered HTML internal management dashboard for viewing KPIs, customer analytics, financial reconciliation findings, station performance, staff activity, and pipeline status.
- **Authentication:** Bearer JWT passed via Header/LocalStorage in browser client.
- **Required Roles:** `MANAGER`, `ADMIN`.
- **Tenant Authorization:** Enforced via `tenantGuard`.
- **Implementation Status:** `VERIFIED IMPLEMENTED`

---

## Endpoint Summary Matrix

| Functional Area | Total Endpoints | Verified Functional | Missing / Placeholder |
|---|---|---|---|
| Ingestion & Operations | 1 | 1 | 0 |
| Internal Management | 8 | 8 | 0 |
| Customer Analytics | 5 | 5 | 0 |
| Financial & Reconciliation | 3 | 3 | 0 |
| Benchmarking & Growth Insights | 2 | 2 | 0 |
| Dashboard UI Routes | 2 | 2 | 0 |
| **Total** | **21** | **21** | **0** |
