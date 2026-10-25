# Phase 12 — Reporting, Analytics, and Operational Insights

## Executive Summary

Phase 12 delivers accurate, secure, timezone-aware, and efficient reporting capabilities for the Sayra backend platform (`sayra/`). All reporting logic relies directly on authoritative persisted domain records (`Reservation`, `Payment`, `Refund`, `LedgerEntry`, `GameStation`, `WaitlistEntry`, `WaitlistOffer`, `NotificationLog`) and pre-aggregated analytics tables (`GamingCenterAnalytics`, `StaffAnalytics`, `StationAnalytics`).

The implementation strictly enforces tenant isolation (`gamingCenterId`), role-based access control (`MANAGER`, `ADMIN`), date range validations, timezone boundary conversions based on the gaming center's configured `Settings.timeZone`, and multi-currency safety.

---

## Architecture & Implementation Principles

1. **Authoritative Data Source**:
   All metrics are derived directly from PostgreSQL database records using database-side aggregations (`groupBy`, `aggregate`, `count`) in `AnalyticsRepo` to avoid loading large result sets into application memory.

2. **Timezone Boundary Resolution**:
   Calendar-day queries accept `startDate` and `endDate` parameters, retrieve the site's configured `Settings.timeZone` (defaulting to `'UTC'`), and compute the exact UTC range corresponding to `00:00:00.000` on `startDate` and `23:59:59.999` on `endDate` in the site's local timezone.

3. **Multi-Currency Safety**:
   Financial reports aggregate monetary values grouped by `currency` (e.g., `IRR`, `USD`) to prevent summing different currencies into an invalid aggregate total.

4. **Tenant Isolation & Security**:
   All reporting queries are strictly scoped with `where: { gamingCenterId }`. Endpoints are protected by `authMiddleware`, `tenantGuard`, and `requireRole([UserRole.MANAGER, UserRole.ADMIN])`.

5. **Date Range Guardrails**:
   Query parameters are validated via Zod (`AnalyticsQuerySchema`) enforcing `startDate <= endDate` and capping query ranges to a maximum of 365 days.

---

## API Endpoints & Reports Scope

The reporting suite is mounted under `/api/v1/gamingCenters/:gamingCenterId/analytics`:

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/summary` | `GET` | `MANAGER`, `ADMIN` | High-level summary of total reservations, completed, canceled, total revenue, realized cash, completion rate %, average reservation value, and new customers. |
| `/reservations` | `GET` | `MANAGER`, `ADMIN` | Reservation counts over date range, status distribution breakdown, completion/cancellation/no-show rates, average duration, station breakdown, and trend lines. |
| `/financials` | `GET` | `MANAGER`, `ADMIN` | Financial reporting (gross collected, refunds, net collected), multi-currency breakdown, distribution by status, method, provider, and financial ledger summary. |
| `/operations/waitlist` | `GET` | `MANAGER`, `ADMIN` | Waitlist operational insights: total entries, conversion rate %, status distribution, offers summary, and offer acceptance rate %. |
| `/operations/notifications` | `GET` | `MANAGER`, `ADMIN` | Notification dispatch metrics: total logs, failure rate %, status distribution, channel distribution, and notification type breakdown. |
| `/staff` | `GET` | `MANAGER`, `ADMIN` | Staff performance metrics: completed reservations, total revenue generated, ratings count, and average rating per staff member. |
| `/stations` | `GET` | `MANAGER`, `ADMIN` | GameStation performance: completed reservations, total hours booked, station type, revenue generated, and utilization rate %. |
| `/revenue-chart` | `GET` | `MANAGER`, `ADMIN` | Daily revenue over time formatted according to the site's configured timezone. |

---

## Detailed Metric Definitions

### 1. Reservation Metrics
- **Total Reservations**: Count of all `Reservation` records with `startTime` falling in range.
- **Completion Rate %**: `(completedCount / totalReservations) * 100`.
- **Cancellation Rate %**: `(canceledCount / totalReservations) * 100`.
- **No-Show Rate %**: `(noShowCount / totalReservations) * 100`.
- **Average Reservation Value**: `completedTotalPrice / completedCount`.
- **Average Duration**: `completedTotalHours / completedCount`.

### 2. Financial Metrics
- **Gross Collected**: Sum of `amount` from `Payment` records where `status = PAID` and `paidAt` falls in range.
- **Total Refunded**: Sum of `amount` from `Refund` records where `status = SUCCESSFUL` and `processedAt` falls in range.
- **Net Collected**: `Gross Collected - Total Refunded`.
- **Breakdown Dimensions**: Payments grouped by `PaymentStatus`, `PaymentMethod` (`CASH`, `CARD`, `ONLINE`, `GIFT_CARD`, `MEMBERSHIP`), and `PaymentProvider` (`MANUAL`, `STRIPE`, `ZARINPAL`).

### 3. Operational Metrics
- **Waitlist Conversion Rate %**: `(convertedEntries / totalWaitlistEntries) * 100`.
- **Waitlist Offer Acceptance Rate %**: `(acceptedOffers / totalWaitlistOffers) * 100`.
- **Notification Failure Rate %**: `(failedLogs / totalNotificationLogs) * 100`.
- **Station Utilization Rate %**: `(totalHoursBooked / (daysInRange * 24)) * 100`.

---

## Verification & File Reference

- **Validators & Date Helpers**: `sayra/src/modules/analytics/analytics.validators.ts`
- **Repository Layer**: `sayra/src/modules/analytics/analytics.repo.ts`
- **Service/Station Layer**: `sayra/src/modules/analytics/analytics.station.ts`
- **Controller Layer**: `sayra/src/modules/analytics/analytics.controller.ts`
- **Routes Definition**: `sayra/src/modules/analytics/analytics.routes.ts`
- **OpenAPI Specification**: `sayra/src/docs/openapi.yaml`
- **Unit & Integration Tests**: `sayra/tests/unit/modules/analytics/`, `sayra/tests/api/analytics/`
