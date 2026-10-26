# Play-Nest Analytics — Canonical Handoff Contract

## Executive Overview
This document serves as the canonical handoff contract for the Play-Nest Analytics suite across all development phases (Phases 1–6).

---

## Status Matrix Across All Phases

| Phase | Title | Status | Deliverables / Highlights |
|---|---|---|---|
| **Phase 1** | Ingestion Pipeline & Schema | **COMPLETED (PASS)** | Prisma `Analytics*` models, `AnalyticsIngestionService`, 2-hour sliding lookback, chunked batching |
| **Phase 2** | Operational Reporting & Dashboard UI | **COMPLETED (PASS)** | Aggregation endpoints under `/analytics/*`, time-zone boundary resolution, Internal Management Dashboard UI |
| **Phase 3** | Customer Analytics | **COMPLETED (PASS)** | Customer summary, activity trends, cohort retention matrix, segmentation (New/Repeat/VIP/At-Risk), phone masking (`0912***1234`) |
| **Phase 4** | Financial Analytics & Reconciliation | **COMPLETED (PASS)** | Detailed financial overview, integer minor units (Rials), non-mutative reconciliation diagnostic rules `REC-001` - `REC-006` |
| **Phase 5** | Hardening, Security, Testing & Release | **COMPLETED (PASS)** | Background worker registration (`analyticsIngestionWorker`), cursor-based batch pagination (`cursor: { id }`), 80 test suites (449 tests 100% PASS) |
| **Phase 6** | Tenant-Facing Owner Analytics | **COMPLETED (PASS)** | Server-side tenant isolation (`tenantGuard` enumeration defense HTTP 404), owner metric catalog, PII phone masking, owner dashboard UI |

---

## Phase 6 Key Technical Artifacts & Hardening Changes

1. **Server-Side Tenant Boundary Enforcement**:
   - Every protected owner analytics endpoint enforces `authMiddleware`, `tenantGuard`, and `requireRole([UserRole.MANAGER, UserRole.ADMIN])`.
   - `tenantGuard` asserts `actor.gamingCenterId === params.gamingCenterId`. Rejects cross-tenant attempts with **HTTP 404 Not Found** to prevent tenant enumeration attacks.

2. **Customer PII & Financial Safety**:
   - Top customer spenders report systematically masks phone numbers (`0912***1234`).
   - Clear distinction between recognized revenue (`totalRevenue`) and collected cash (`realizedCash`).

3. **Owner Metrics Catalog**:
   - Documented approved owner-facing KPIs across Overview, Stations, Customers, and Financials in `docs/analytics/analytics-phase6-owner-metric-catalog.md`.

4. **Testing & Verification**:
   - Comprehensive unit and integration test suite in `sayra/tests/unit/modules/analytics/analytics.phase6.spec.ts` and `sayra/tests/api/analytics/analytics.api.spec.ts`.

---

## Canonical Deliverables Directory (`docs/analytics/`)
- `docs/analytics/analytics-phase6-design.md`: Owner-facing architecture, API design, access scope, and design decisions.
- `docs/analytics/analytics-phase6-owner-metric-catalog.md`: Approved owner-facing metrics, definitions, access rules, and limitations.
- `docs/analytics/analytics-phase6-security-and-tenant-isolation.md`: Security model, isolation controls, threat scenarios, and test evidence.
- `docs/analytics/analytics-phase6-operations-runbook.md`: Rollout strategy, data freshness monitoring, troubleshooting, and kill switch.
- `docs/analytics/analytics-phase6-acceptance-report.md`: Acceptance matrix, security evidence, and release recommendation.
- `docs/analytics/analytics-handoff.md`: Canonical handoff contract across Phases 1–6.

---

## Release Decision
- **Final Recommendation**: **READY FOR CONTROLLED TENANT OWNER RELEASE**
- **Target Audience**: Gaming Center Owners (`MANAGER`) and Platform Administrators (`ADMIN`).

---

## Prerequisites for Phase 7 (Privacy-Preserving Benchmarking & Growth Insights)
1. Cross-tenant aggregation must enforce $k$-anonymity ($k \ge 5$) to prevent reverse engineering of individual tenant performance.
2. Regional and station-type benchmarking datasets must be completely decoupled from individual gaming center CUIDs.
3. Explicit opt-in or governance policy must be established prior to inclusion in benchmark cohorts.
