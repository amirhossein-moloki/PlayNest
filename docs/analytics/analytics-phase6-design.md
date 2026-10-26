# Play-Nest Analytics — Phase 6 Technical Design & Architecture
## Tenant-Facing Owner Analytics: Secure Business Insights

---

## 1. Executive Summary
Phase 6 extends the Play-Nest Analytics architecture to expose a securely scoped set of business metrics and actionable insights directly to authorized gaming-center owners and managers (`MANAGER` and `ADMIN` roles).

The core requirement of Phase 6 is **strict tenant isolation enforced as a server-side security boundary**. Under no circumstances can client-controlled parameters or requests bypass authorization, access cross-tenant data, or leak identifiable customer PII or internal reconciliation details.

---

## 2. Tenant Ownership & Scope Model

### 2.1 Domain & Data Scope
- **Tenant Entity**: The primary tenant in Play-Nest is the `GamingCenter` model (`gamingCenterId`).
- **User Membership**: Each tenant user (`User`) belongs to exactly one `GamingCenter` via `user.gamingCenterId`.
- **Role Hierarchy**:
  - `ADMIN` / `MANAGER`: Authorized to access tenant-facing owner analytics.
  - `SUPERVISOR` / `STAFF` / `TRAINEE` / `SUPPORT`: Forbidden from accessing analytics endpoints (HTTP 403 Forbidden).

### 2.2 Server-Derived Scope Enforcement
Tenant boundary enforcement relies on server-derived authentication context, not client input:
1. `authMiddleware`: Extracts JWT token from `Authorization: Bearer <token>`, validates session in DB, and attaches `req.actor` (`{ actorId, actorType, gamingCenterId, role }`).
2. `tenantGuard`: Verifies `req.actor.gamingCenterId === req.params.gamingCenterId`.
   - **Defense Against Tenant Enumeration**: If the authenticated user attempts to access a `gamingCenterId` other than their assigned tenant ID, `tenantGuard` responds with **HTTP 404 Not Found** (instead of 403) to prevent attacker probing or enumeration of external gaming center IDs.
   - Attaches `req.tenant = { gamingCenterId }` for downstream Station and Repository layers.

---

## 3. Architecture & Protected API Routes

### 3.1 Endpoint Architecture
All tenant-facing analytics endpoints are mounted under `/api/v1/gamingCenters/:gamingCenterId/analytics/` and `/api/v1/gamingCenters/:gamingCenterId/dashboard`:

```
Express Router Router({ mergeParams: true })
 │
 ├── authMiddleware       (Validates JWT token, attaches req.actor)
 ├── tenantGuard          (Enforces actor.gamingCenterId === params.gamingCenterId, returns 404 on mismatch)
 └── requireRole          (Restricts access to [MANAGER, ADMIN], returns 403 for STAFF/TRAINEE)
```

### 3.2 Endpoint Inventory & Data Boundaries

| Route Path | Method | Validator | Description | Owner Suitability |
|---|---|---|---|---|
| `/gamingCenters/:gamingCenterId/dashboard` | GET | None | Renders server-side HTML owner dashboard UI | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/summary` | GET | `AnalyticsQuerySchema` | High-level business overview (revenue, cash, reservations, completion rate) | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/reservations` | GET | `AnalyticsQuerySchema` | Reservation distribution, status metrics, and trend charts | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/financials` | GET | `AnalyticsQuerySchema` | Gross collected, refunds, net cash, payment methods breakdown | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/stations` | GET | `AnalyticsQuerySchema` | Station utilization rate, booked hours, and revenue per station | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/staff` | GET | `AnalyticsQuerySchema` | Staff reservation handling and customer review performance | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/revenue-chart` | GET | `AnalyticsQuerySchema` | Daily revenue chart data points | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/customers/summary` | GET | `CustomerAnalyticsQuerySchema` | Active, new, returning, and repeat customer counts | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/customers/activity` | GET | `CustomerAnalyticsQuerySchema` | Daily active customers trend & frequency distribution | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/customers/retention` | GET | `CustomerAnalyticsQuerySchema` | 6-month cohort retention matrix | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/customers/segmentation` | GET | `CustomerAnalyticsQuerySchema` | Customer bucket counts (New, Repeat, VIP, At-Risk) | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/customers/top-spenders` | GET | `CustomerAnalyticsQuerySchema` | Top customer spenders with masked phone numbers (`0912***1234`) | Exposed (Masked) |
| `/gamingCenters/:gamingCenterId/analytics/operations/waitlist` | GET | `AnalyticsQuerySchema` | Waitlist entries & conversion rates | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/operations/notifications` | GET | `AnalyticsQuerySchema` | SMS dispatch totals & failure rate | Exposed |
| `/gamingCenters/:gamingCenterId/analytics/ingestion-status` | GET | None | Data freshness indicator (`FRESH` / `STALE`) and last ingestion time | Exposed |

---

## 4. Financial & Privacy Hardening Rules

1. **Financial Terminology & Precision**:
   - Amounts are calculated in minor units (Rials / integer representation) to prevent floating-point precision loss.
   - `totalRevenue` represents recognized revenue from `COMPLETED` reservations.
   - `realizedCash` represents gross funds received from `PAID` payments.
   - Payment totals are explicitly distinguished from recognized revenue.
2. **PII Protection**:
   - Customer phone numbers in `top-spenders` are systematically masked (`0912***1234`).
   - Identifiable customer details (national IDs, addresses, full transaction histories) are excluded from owner-facing responses.
3. **Internal Diagnostics Isolation**:
   - Internal non-mutative reconciliation rules (`REC-001` through `REC-006`) are reserved for administrative operations and are omitted from standard tenant owner views unless explicitly requested for audit.

---

## 5. Fail-Safe Operations & Data Freshness
- Data freshness is monitored via `AnalyticsWatermark` and `AnalyticsIngestionRun`.
- If background ingestion is delayed by more than 120 minutes, `/ingestion-status` returns `status: "STALE"`.
- UI templates render an explicit `Data Stale` indicator, informing owners that metrics reflect cached analytical store state without breaking dashboard availability.
