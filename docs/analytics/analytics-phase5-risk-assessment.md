# Play-Nest Analytics Phase 5 — Risk Assessment & Audit Findings

## Executive Summary
This document provides an evidence-based risk assessment of the Play-Nest Analytics platform following a comprehensive audit of source code, Prisma schema, background workers, authentication guards, financial calculation engines, and test suites across Phase 1 to Phase 4.

The assessment categorizes findings into **Confirmed Findings** (supported by verified codebase evidence) and **Potential Risks** (architectural or environmental observations requiring operational monitoring).

---

## 1. Confirmed Audit Findings & Remediation Plan

### Finding 1: Unregistered Ingestion Background Worker
- **Severity**: HIGH
- **Impact**: Scheduled background ingestion cycles via BullMQ worker process were inactive in the worker runtime.
- **Evidence**: `sayra/src/jobs/workers/analyticsIngestion.worker.ts` defined the BullMQ worker for queue `analytics-ingestion`, but `sayra/src/jobs/workers/index.ts` only imported `analyticsWorker` (`analytics-sync` queue). `analyticsIngestionWorker` was omitted from worker initialization in `initWorkers()`.
- **Status**: Remediation Planned in Phase 5 Step 2.
- **Remediation**: Import and register `analyticsIngestionWorker` in `sayra/src/jobs/workers/index.ts` with readiness logging and error listeners.

### Finding 2: Offset Pagination (`skip`/`take`) Ingestion Window Vulnerability
- **Severity**: HIGH
- **Impact**: Late-arriving updates or record modifications occurring during an active batch ingestion cycle cause offset drift when using `skip += batchSize`. This can cause records to be permanently skipped if the watermark advances past them.
- **Evidence**: `AnalyticsIngestionService.ts` queried source entities with `skip` and `take: 500` ordered by `updatedAt asc`. If source records were modified during iteration, shifting ranks caused `skip` offset pagination to skip updated items in subsequent chunks.
- **Status**: Remediation Planned in Phase 5 Step 2.
- **Remediation**: Refactor ingestion batching to use cursor-based pagination (e.g. `cursor: { id }`) or primary key sorting combined with timestamp filters to ensure deterministic, drift-free pagination.

### Finding 3: Ingestion Watermark Safety
- **Severity**: MEDIUM
- **Impact**: Risk of watermark advancing past uningested records if an error occurs after `maxUpdatedAt` is mutated in memory across partial batches.
- **Evidence**: `AnalyticsIngestionService.ts` calculated `maxUpdatedAt` per record during chunk processing. While `updateWatermark()` was called at the end of the `try` block, cursor/offset drift could allow `maxUpdatedAt` to advance past missed records.
- **Status**: Remediation Planned in Phase 5 Step 2.
- **Remediation**: Track high-watermark timestamps strictly per fully committed batch and update watermarks atomically after verified batch upserts.

---

## 2. Verified Invariants & Passed Audits

### Requirement 1: Non-Mutative Analytical Operations & Financial Safety
- **Audit Result**: PASS
- **Evidence**: Code audit of `AnalyticsRepo`, `AnalyticsStation`, `AnalyticsIngestionService`, and reconciliation rules verified that analytics workers and endpoints execute **zero** mutation (`UPDATE`, `DELETE`, `INSERT`) operations against authoritative operational tables (`Payment`, `LedgerEntry`, `Refund`, `WalletTransaction`, `Reservation`). Analytics data ingestion writes strictly to dedicated `Analytics*` Prisma models.

### Requirement 2: Financial Precision & Integer Arithmetic
- **Audit Result**: PASS
- **Evidence**: All monetary amounts in financial overview and reconciliation methods (`getLiveFinancialStats`, `getFinancialOverviewDetailed`, `runFinancialReconciliationCheck`) treat amounts as integers in minor currency units (Rials). No floating-point multiplication or rounding bugs were detected in financial aggregations.

### Requirement 3: Server-Side Authorization & Tenant Isolation
- **Audit Result**: PASS
- **Evidence**: Analytics routes in `sayra/src/modules/analytics/analytics.routes.ts` enforce `authMiddleware`, `tenantGuard`, and `requireRole([UserRole.MANAGER, UserRole.ADMIN])`. `tenantGuard` verifies that `actor.gamingCenterId` matches `req.params.gamingCenterId` (returning HTTP 404 to prevent tenant enumeration attacks). All repository queries explicitly filter by `gamingCenterId`.

### Requirement 4: Sensitive PII Exposure & Phone Number Masking
- **Audit Result**: PASS
- **Evidence**: `AnalyticsStation.getTopSpenders` executes `maskPhone()` on all customer phone numbers (`0912***1234`), preventing raw phone disclosure in API JSON responses and dashboard UI tables.

---

## 3. Risk Summary Matrix

| Risk ID | Category | Severity | Description | Remediation Priority |
|---|---|---|---|---|
| AUD-001 | Worker Ingestion | HIGH | Unregistered background ingestion worker process | IMMEDIATE |
| AUD-002 | Data Integrity | HIGH | Offset pagination drift during ingestion batches | IMMEDIATE |
| AUD-003 | Reliability | MEDIUM | Watermark safety during partial ingestion failures | HIGH |
| AUD-004 | Security | LOW | Verify error responses sanitization | MEDIUM |
| AUD-005 | Performance | LOW | Verify database indexes on `Analytics*` models | MEDIUM |

---

## Conclusion
The analytics platform has strong foundational security, tenant isolation, and financial accuracy. Addressing Findings 1–3 in Phase 5 will eliminate the verified data ingestion and background processing risks, rendering the analytics suite robust for controlled release.
