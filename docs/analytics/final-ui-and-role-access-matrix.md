# Play-Nest Analytics — UI and User-Role Access Matrix

## Overview
This document details the actual user roles, permission checks, authentication requirements, tenant isolation mechanisms, and dashboard UI pages implemented across the Play-Nest platform.

---

## 1. Role Definitions and Access Matrix

In the Play-Nest backend (`sayra`), user roles are defined in the Prisma schema as an enum (`UserRole`):
- `ADMIN` (Platform Administrator)
- `MANAGER` (Gaming Center Manager / Owner)
- `STAFF` (Gaming Center Staff Member)
- `CUSTOMER` (End-User / Gamer)

Users obtain their role during authentication (`authRouter`), where JWT tokens are issued containing `userId`, `role`, and `gamingCenterId`.

### Role Capability Matrix

| Role Identifier | How Obtained | Accessible Analytics APIs | Scope & Tenant Isolation | Financial Data Access | Benchmark Access | Verified in Code & Tests |
|---|---|---|---|---|---|---|
| **`ADMIN`** | System assignment or admin registration | All 19 Analytics APIs | Global or Tenant-specific (scoped to `gamingCenterId` in path) | Full Access (Gross, Net, Ledger, Reconciliation) | Full Access ($k \ge 5$) | Verified (`requireRole([UserRole.MANAGER, UserRole.ADMIN])`) |
| **`MANAGER`** | Assigned as owner/manager of a `GamingCenter` | All 19 Analytics APIs for owned `gamingCenterId` | Strictly scoped to tenant `gamingCenterId`. `tenantGuard` rejects mismatched IDs with `404` | Full Access for owned tenant | Full Access for owned tenant ($k \ge 5$) | Verified in API integration tests |
| **`STAFF`** | Staff profile created under a `GamingCenter` | None (HTTP 403 Forbidden on `/analytics/*`) | N/A | No Access | No Access | Verified (`requireRole` blocks STAFF) |
| **`CUSTOMER`** | Self-registered customer account | None (HTTP 403 Forbidden on `/analytics/*`) | N/A | No Access | No Access | Verified |

---

## 2. Authentication and Authorization Guard Architecture

Analytics endpoints are protected by a 3-layer middleware stack in `sayra/src/modules/analytics/analytics.routes.ts` and `dashboard-ui.routes.ts`:

1. **`authMiddleware`**:
   - Parses `Authorization: Bearer <token>` header or auth cookie.
   - Verifies JWT signature and expiration.
   - Attaches `req.actor` (`{ userId, role, gamingCenterId, sessionId }`) to Express request context.

2. **`tenantGuard`**:
   - Compares `req.params.gamingCenterId` with `req.actor.gamingCenterId` (unless actor is global `ADMIN`).
   - **Enumeration Defense:** If actor attempts to access a `gamingCenterId` they do not own, `tenantGuard` responds with **HTTP 404 Not Found** (rather than 403) to prevent unauthorized tenant ID probing.

3. **`requireRole([UserRole.MANAGER, UserRole.ADMIN])`**:
   - Rejects any user who is not `MANAGER` or `ADMIN` with **HTTP 403 Forbidden**.

---

## 3. UI Page Inventory

Play-Nest provides a server-side rendered (SSR) single-page HTML application for internal management and tenant owners, defined in `sayra/src/modules/analytics/dashboard-ui.templates.ts` and served via `dashboard-ui.routes.ts`.

### Page Details: Internal Management & Owner Analytics Dashboard

- **Route Paths:**
  - `/gamingCenters/:gamingCenterId/dashboard`
  - `/admin/gamingCenters/:gamingCenterId/dashboard`
- **Source File:** `sayra/src/modules/analytics/dashboard-ui.templates.ts`
- **Purpose:** Centralized operational, financial, customer, and pipeline monitoring dashboard.
- **Components & Widgets:**
  - **Header Controls:** Dynamic data freshness badge (`FRESH` green / `STALE` yellow), auth bearer token input, refresh button.
  - **Filter Toolbar:** Date range pickers (`startDate`, `endDate`), currency selector (`IRR` / `IRT`).
  - **KPI Summary Row:**
    - Total Recognized Revenue & Average Order Value.
    - Realized Cash Collected.
    - Active Customers (New vs Returning breakdown).
    - Repeat Visit Rate & Avg Days Between Visits.
  - **Customer Analytics Section (Phase 3):**
    - Customer Segments Table (New, Repeat, VIP, At-Risk counts and descriptions).
    - Top Customer Spenders Table with masked phone numbers (`0912***1234`).
  - **Financial Reconciliation Section (Phase 4):**
    - Audit Check button triggering `POST /financials/reconciliation/run`.
    - Diagnostic Findings Table displaying Rule ID (`REC-001` - `REC-006`), severity, status, source entity, details, expected vs actual amount.
  - **Financial Breakdown Section:**
    - Gross Collected, Total Refunded, Net Cash Collected.
    - Payment Methods Table (Online, Wallet, POS, Manual breakdown).
  - **Station Performance Section:**
    - Game Station Utilization Table (station name, type, booked hours, utilization %, revenue).
  - **Operational Health Section:**
    - Waitlist Conversion Rate badge.
    - Notification SMS Failure Rate badge.
    - Staff Performance Table (staff name, completed reservations, avg rating, revenue).
  - **Data Ingestion Pipeline Section:**
    - Pipeline Last Ingested timestamp.
    - Watermarks Table listing entity watermark positions.
- **API Calls Made:**
  - `GET /api/v1/gamingCenters/:id/analytics/summary`
  - `GET /api/v1/gamingCenters/:id/analytics/customers/summary`
  - `GET /api/v1/gamingCenters/:id/analytics/customers/segmentation`
  - `GET /api/v1/gamingCenters/:id/analytics/customers/top-spenders`
  - `GET /api/v1/gamingCenters/:id/analytics/financials/overview`
  - `GET /api/v1/gamingCenters/:id/analytics/financials/reconciliation`
  - `GET /api/v1/gamingCenters/:id/analytics/stations`
  - `GET /api/v1/gamingCenters/:id/analytics/operations/waitlist`
  - `GET /api/v1/gamingCenters/:id/analytics/operations/notifications`
  - `GET /api/v1/gamingCenters/:id/analytics/staff`
  - `GET /api/v1/gamingCenters/:id/analytics/ingestion-status`
- **Empty, Loading, Error, Stale States:**
  - **Loading:** Overlay displayed during initial load or filter refresh.
  - **Error:** Red alert box with exception details on fetch failure.
  - **Empty:** Tables display clear fallback messages when no data exists for selected period.
  - **Stale Data:** Freshness badge turns yellow with "Data Stale" label if pipeline lag exceeds threshold.
- **Current Status:** `VERIFIED IMPLEMENTED`
