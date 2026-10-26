# Play-Nest Analytics Phase 3 — Architecture & Design

## 1. Overview & Objectives
Phase 3 extends Play-Nest Analytics with customer-centric metrics, including customer activity, repeat-visit behavior, cohort retention, deterministic segmentation, and historical spend analysis.

The architecture strictly adheres to:
- **Server-Side Aggregations**: Avoiding large payload transfers to the browser.
- **Tenant Isolation**: All queries scoped by `gamingCenterId`.
- **RBAC**: Protected by `authMiddleware`, `tenantGuard`, and `requireRole([UserRole.MANAGER, UserRole.ADMIN])`.
- **Privacy Minimization**: Phone number masking (`0912***1234`) on customer list endpoints and management views.

---

## 2. API Endpoints Architecture

All Phase 3 routes are mounted under `/api/v1/gamingCenters/:gamingCenterId/analytics/customers`:

| Endpoint | Method | Role | Description |
|---|---|---|---|
| `/summary` | `GET` | `MANAGER`, `ADMIN` | Active customers, new vs returning counts, repeat visit rate %, average time between visits (days), average spend per customer. |
| `/activity` | `GET` | `MANAGER`, `ADMIN` | Daily/weekly customer activity trend line and visit frequency histogram. |
| `/retention` | `GET` | `MANAGER`, `ADMIN` | Monthly cohort retention matrix and period-over-period delta metrics. |
| `/segmentation` | `GET` | `MANAGER`, `ADMIN` | Customer distribution across deterministic segments (New, Repeat, VIP, At-Risk). |
| `/top-spenders` | `GET` | `MANAGER`, `ADMIN` | Top customer spenders in selected period with masked phone numbers (`0912***1234`). |

---

## 3. Data Flow & Aggregation Strategy

```
[ PostgreSQL / Analytics Entities ]
  ├── CustomerAccount / AnalyticsCustomer
  ├── Reservation / AnalyticsReservation (status = COMPLETED)
  └── Payment / AnalyticsPayment (status = PAID)
               │
               ▼
   [ AnalyticsRepo (DB Aggregations) ]
               │
               ▼
  [ AnalyticsStation (Business Rules & Cohort Logic) ]
               │
               ▼
[ AnalyticsController (JSON Response / Dashboard UI) ]
```

1. **Database Aggregations**: `AnalyticsRepo` runs direct PostgreSQL `groupBy`, `count`, and `aggregate` calls to evaluate active customer counts and reservation activity.
2. **Cohort & Time Logic**: `AnalyticsStation` processes time boundaries based on `Settings.timeZone` and computes monthly cohort retention matrices.
3. **Privacy Masking**: Customer phone numbers are masked before sending API responses.

---

## 4. Security, Multi-Tenancy & Authorization
- **Tenant Scoping**: All queries enforce `where: { gamingCenterId }`.
- **Role Limits**: Restricted to internal site managers and system administrators.
- **Client Input Validation**: Zod schema (`AnalyticsCustomerQuerySchema`) validates date bounds, capping queries to max 365 days.
