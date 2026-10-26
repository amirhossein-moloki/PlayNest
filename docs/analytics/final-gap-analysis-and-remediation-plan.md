# Play-Nest Analytics — Final Gap Analysis and Remediation Plan

## Overview
This document summarizes the remaining technical, operational, and maintainability gaps identified during the comprehensive audit of Play-Nest Analytics, along with a prioritized remediation plan.

---

## Priority Classification Scheme

- `P0 — Critical security, financial integrity, or data exposure risk`
- `P1 — Blocks intended core functionality or safe release`
- `P2 — Important functional, reliability, or maintainability gap`
- `P3 — Improvement or optional enhancement`

---

## Prioritized Gap Inventory

### `GAP-001` (Priority: P2 — Operational / Monitoring)
- **Description:** No automated alert metric emitted when `analyticsIngestionRun` status stays in `FAILED` state continuously across multiple cycles.
- **Affected Subsystem:** Phase 1 / Phase 5 Ingestion Observability (`analyticsIngestionWorker`).
- **Evidence Path:** `sayra/src/jobs/workers/analyticsIngestion.worker.ts`
- **Business Impact:** Prolonged pipeline failures could lead to stale analytics without immediate developer or operator notification.
- **Recommended Fix:** Add Sentry alert trigger or Prometheus metric counter increment on `analyticsIngestionWorker` job failure.
- **Verification Method:** Unit test triggering job failure and asserting Sentry/Metrics call.

### `GAP-002` (Priority: P2 — Maintainability / Schema)
- **Description:** Spectral OpenAPI validation yields 17 warnings regarding unused schema components (`GamingCenter`, `Reservation`, etc.) in `openapi.yaml`.
- **Affected Subsystem:** OpenAPI 3.0 Contract Specification (`sayra/src/docs/openapi.yaml`).
- **Evidence Path:** `sayra/src/docs/openapi.yaml`
- **Business Impact:** Minor schema clutter in exported Postman/OpenAPI documentation.
- **Recommended Fix:** Clean up unused schema component references or link them to response payloads.
- **Verification Method:** Re-run `npm run api:validate` to confirm 0 warnings.

### `GAP-003` (Priority: P3 — UI / Enhancement)
- **Description:** SSR Dashboard template in `dashboard-ui.templates.ts` requires manual paste of Auth Bearer Token into an input field for frontend API requests.
- **Affected Subsystem:** Phase 2 Internal Management Dashboard (`sayra/src/modules/analytics/dashboard-ui.templates.ts`).
- **Evidence Path:** `sayra/src/modules/analytics/dashboard-ui.templates.ts`
- **Business Impact:** Slightly friction-filled developer / admin user experience when using the standalone SSR route directly.
- **Recommended Fix:** Support reading JWT token directly from HTTP-only auth cookie if present.
- **Verification Method:** Manual browser inspection of SSR dashboard load with cookie auth.

---

## Recommended Next Actions

1. **Implement Ingestion Alerting (`GAP-001`):** Hook `analyticsIngestionWorker` failures into Sentry / logger notification.
2. **OpenAPI Schema Cleanup (`GAP-002`):** Resolve 17 Spectral warnings in `src/docs/openapi.yaml`.
3. **Execute Initial Ingestion Backfill in Staging:** Run `npm run backfill:analytics` in staging environment before customer onboarding.
4. **Setup Redis Monitoring Dashboard:** Monitor BullMQ queue lengths for `analytics-ingestion` and `analytics-sync`.
5. **Establish Benchmark Privacy Audit Cadence:** Periodically review tenant peer group sizes ($k \ge 5$) as new gaming centers join the platform.
