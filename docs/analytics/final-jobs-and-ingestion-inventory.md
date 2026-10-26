# Play-Nest Analytics — Final Jobs and Ingestion Inventory

## Overview
This document inventories all background workers, queue producers, schedulers, and data ingestion mechanisms supporting Analytics in Play-Nest (`sayra`).

---

## 1. Background Workers

### `analyticsIngestionWorker`
- **Source Path:** `sayra/src/jobs/workers/analyticsIngestion.worker.ts`
- **Queue Name:** `analytics-ingestion`
- **Registration Path:** `sayra/src/jobs/workers/index.ts` -> `initWorkers()`
- **Concurrency:** `1` (strict single-execution to eliminate overlapping pipeline cycles).
- **Trigger / Schedule:** Hourly via BullMQ repeatable job producer (`scheduleAnalyticsIngestion`).
- **Functionality:** Calls `analyticsIngestionService.runIngestionCycle()`. Extracts changed records across 8 entities using a sliding lookback window (default 120 minutes) and cursor pagination (`cursor: { id }`).
- **Idempotency & Concurrency:** Upserts all ingested records into `Analytics*` shadow tables using unique primary keys (`id`).
- **Error Handling:** Records failure status and exception message in `AnalyticsIngestionRun`. Logs error with BullMQ failure listener.
- **Runnable Status:** `VERIFIED RUNNABLE & OPERATIONAL`.

### `analyticsWorker`
- **Source Path:** `sayra/src/jobs/workers/analytics.worker.ts`
- **Queue Name:** `analytics-sync` (`ANALYTICS_QUEUE_NAME` in `sayra/src/jobs/queues.ts`)
- **Registration Path:** `sayra/src/jobs/workers/index.ts` -> `initWorkers()`
- **Trigger:** Event-driven jobs emitted by entity update operations (reservations, payments, ratings).
- **Functionality:** Re-calculates and updates pre-aggregated stats in `GamingCenterAnalytics`, `StaffAnalytics`, and `StationAnalytics`.
- **Idempotency:** Idempotent recalculation based on source record state.
- **Runnable Status:** `VERIFIED RUNNABLE & OPERATIONAL`.

---

## 2. Producers and Schedulers

### `analyticsIngestionProducer` / `scheduleAnalyticsIngestion`
- **Source Path:** `sayra/src/jobs/producers/analyticsIngestion.producer.ts`
- **Queue Name:** `analytics-ingestion`
- **Default Schedule:** Cron `'0 * * * *'` (Hourly).
- **Job ID:** `repeatable-analytics-ingestion`.

### `analyticsProducer`
- **Source Path:** `sayra/src/jobs/producers/analytics.producer.ts`
- **Queue Name:** `analytics-sync`
- **Purpose:** Enqueues `AnalyticsSyncJobData` (`type: 'RESERVATION' | 'PAYMENT' | 'REVIEW'`, `entityId`, `correlationId`).

---

## 3. Ingestion Pipeline Capabilities & Resilience Audit

| Capability | Implementation Mechanism | Verification Status |
|---|---|---|
| **Incremental Ingestion** | `AnalyticsWatermark` per entity (`lastIngestedAt`). Advance cutoff logic. | `VERIFIED` |
| **Sliding Lookback Window** | 120-minute lookback (`searchCutoff = watermark - 120m`) captures late-arriving or back-dated records. | `VERIFIED` |
| **Chunked Batching & Cursor Pagination** | Processes records in chunks of 500 using Prisma `cursor: { id }` and `take: 500`. | `VERIFIED` |
| **Idempotency** | Prisma `upsert()` on primary key `id` guarantees no duplicate records. | `VERIFIED` |
| **Dependency Order** | Ingests entities sequentially: Tenant -> Customer -> Station -> Reservation -> GamingSession -> Payment -> LedgerEntry -> Refund. | `VERIFIED` |
| **Observability** | Tracks run details in `AnalyticsIngestionRun` (records read/ingested, duration, watermarks, error messages). | `VERIFIED` |
| **Backfill Procedure** | Dedicated script `sayra/scripts/backfill-analytics.ts` supports full historical backfills. | `VERIFIED` |
