# Play-Nest Analytics — Canonical Handoff Contract

## Executive Overview
This document serves as the canonical handoff contract for the Play-Nest Analytics suite across all development phases (Phases 1–7).

---

## Status Matrix Across All Phases

| Phase | Title | Status | Deliverables / Highlights |
|---|---|---|---|
| **Phase 1** | Ingestion Pipeline & Schema | **VERIFIED IMPLEMENTED** | Prisma `Analytics*` shadow models, `AnalyticsIngestionService`, 2-hour sliding lookback, chunked cursor batching |
| **Phase 2** | Operational Reporting & Dashboard UI | **VERIFIED IMPLEMENTED** | Aggregation endpoints under `/analytics/*`, time-zone boundary resolution, SSR Internal Management Dashboard UI |
| **Phase 3** | Customer Analytics | **VERIFIED IMPLEMENTED** | Customer summary, activity trends, cohort retention matrix, segmentation (New/Repeat/VIP/At-Risk), phone masking (`0912***1234`) |
| **Phase 4** | Financial Analytics & Reconciliation | **VERIFIED IMPLEMENTED** | Detailed financial overview, integer minor units (Rials), non-mutative reconciliation diagnostic rules `REC-001` - `REC-006` |
| **Phase 5** | Hardening, Security, Testing & Release | **VERIFIED IMPLEMENTED** | Background worker registration (`analyticsIngestionWorker`), cursor-based batch pagination (`cursor: { id }`), 82 test suites (465 tests 100% PASS) |
| **Phase 6** | Tenant-Facing Owner Analytics | **VERIFIED IMPLEMENTED** | Server-side tenant isolation (`tenantGuard` enumeration defense HTTP 404), owner metric catalog, PII phone masking |
| **Phase 7** | Privacy-Preserving Benchmarking & Growth Insights | **VERIFIED IMPLEMENTED** | $k$-Anonymity ($k \ge 5$) peer benchmarking, self-exclusion, descriptive growth insights engine, OpenAPI 3.0 spec, feature flag kill switch |

---

## Verified Subsystem Release Decisions

- **Internal Management Analytics:** `READY FOR CONTROLLED RELEASE`
- **Tenant-Facing Analytics:** `READY WITH DOCUMENTED LIMITATIONS`
- **Financial Analytics:** `READY WITH DOCUMENTED LIMITATIONS`
- **Cross-Tenant Benchmarking:** `READY WITH DOCUMENTED LIMITATIONS`

---

## Audit & Final Deliverables Directory (`docs/analytics/`)

- **Master System Report:** `docs/analytics/analytics-final-system-report.md`
- **API Inventory:** `docs/analytics/final-api-inventory.md`
- **UI & Role Access Matrix:** `docs/analytics/final-ui-and-role-access-matrix.md`
- **Data Model & Migrations:** `docs/analytics/final-data-model-and-migrations.md`
- **Jobs & Ingestion Inventory:** `docs/analytics/final-jobs-and-ingestion-inventory.md`
- **Metric Definitions Catalog:** `docs/analytics/final-metric-and-business-definitions.md`
- **Security & Privacy Audit:** `docs/analytics/final-security-and-privacy-audit.md`
- **Testing & Evidence Report:** `docs/analytics/final-testing-and-evidence-report.md`
- **Configuration & Deployment Report:** `docs/analytics/final-configuration-and-deployment-report.md`
- **Gap Analysis & Remediation Plan:** `docs/analytics/final-gap-analysis-and-remediation-plan.md`

---

## Release Recommendation
- **Final Readiness Decision**: **`READY WITH DOCUMENTED LIMITATIONS`**
- **Target Audience**: Gaming Center Owners (`MANAGER`) and Platform Administrators (`ADMIN`).


---

## Analytics Discovery & Data Requirements Audit (2026-10-26)

The following Persian-language discovery documents were added under `docs/analytics/discovery/`. They are planning artifacts, not implementation changes. Their status reflects a repository-level review; runtime behavior, production data quality, and tests were not independently executed as part of this discovery.

1. [مدل کسب‌وکار و گردش‌کارها](discovery/01-play-nest-business-model-fa.md)
2. [فرصت‌های تحلیل کسب‌وکار](discovery/02-business-analytics-opportunities-fa.md)
3. [کاتالوگ شاخص‌ها و فرمول‌ها](discovery/03-metric-catalog-fa.md)
4. [موجودی نیازمندی‌های داده](discovery/04-data-requirements-inventory-fa.md)
5. [مشخصات پیشنهادی ردیابی رویداد](discovery/05-event-tracking-specification-fa.md)
6. [ممیزی وضعیت فعلی Analytics](discovery/06-current-state-audit-fa.md)
7. [نقشه راه اولویت‌بندی‌شده](discovery/07-analytics-prioritized-roadmap-fa.md)
8. [پرسش‌های باز برای مالک کسب‌وکار](discovery/08-open-business-questions-fa.md)
9. [خلاصه اجرایی کشف](discovery/09-analytics-discovery-summary-fa.md)

### Discovery status
- **Repository evidence:** Analytics schema, ingestion service, worker registration, and analytics API routes/controllers were located in the codebase.
- **Key gaps requiring confirmation:** Website visitor attribution, complete cost accounting, historical station availability/downtime, and production/runtime verification.
- **Recommended next step:** Phase A — approve metric and accounting definitions, validate source-to-analytics consistency, verify tenant isolation and freshness, and define privacy controls before expanding dashboards.
- **Scope boundary:** No application code, database schema, migration, tracking, job, or API behavior was changed by this discovery.
