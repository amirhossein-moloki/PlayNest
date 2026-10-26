# Play-Nest Analytics Phase 5 — Operations & Monitoring Runbook

## 1. Pipeline Architecture Overview
The Play-Nest Analytics suite uses incremental ingestion background workers and server-side aggregation services to deliver real-time operational and financial intelligence across gaming centers.

### Infrastructure Components
1. **BullMQ Queues**:
   - `analytics-ingestion`: Single-concurrency repeatable ingestion cycle processing operational source entities in dependency order (`Tenant` -> `Customer` -> `Station` -> `Reservation` -> `GamingSession` -> `Payment` -> `LedgerEntry` -> `Refund`).
   - `analytics-sync`: On-demand targeted statistical synchronization triggered by reservation, payment, and rating events.
2. **Ingestion Service**:
   - `AnalyticsIngestionService`: Cursor-based batch pagination (`batchSize: 500`) with sliding 120-minute lookback window for late-arriving source records.
3. **Observability Endpoint**:
   - `GET /api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status` (restricted to `MANAGER` and `ADMIN` roles).

---

## 2. Ingestion Status Monitoring & Health Verification

Authorized operators can query the pipeline status endpoint to assess pipeline health:

```json
{
  "status": "FRESH",
  "lastIngestedAt": "2026-10-26T08:00:00.000Z",
  "watermarks": [
    { "entity": "Reservation", "lastIngestedAt": "2026-10-26T08:00:00.000Z", "lastSourceId": "clx..." }
  ],
  "recentRuns": [
    {
      "id": "run_123",
      "entity": "Reservation",
      "status": "SUCCESS",
      "recordsRead": 150,
      "recordsIngested": 150,
      "durationMs": 340,
      "startedAt": "2026-10-26T08:00:00.000Z",
      "completedAt": "2026-10-26T08:00:00.340Z"
    }
  ]
}
```

### Health Status Definitions
- **`FRESH`**: Last successful ingestion cycle completed within the past 120 minutes.
- **`STALE`**: Last successful ingestion cycle occurred more than 120 minutes ago. Requires operator attention.

---

## 3. Incident Response & Failure Recovery

### Incident Scenario 1: `STALE` Status Alert
**Symptom**: Ingestion status returns `status: "STALE"`.
**Diagnosis**:
1. Check background worker logs for `Analytics Ingestion Worker` errors.
2. Check Redis connection status.
3. Check PostgreSQL database connectivity.

**Recovery Procedure**:
1. Restart the background worker service or trigger a manual backfill script:
   ```bash
   npm run backfill:analytics
   ```
2. Verify that `AnalyticsIngestionRun` records transition back to `SUCCESS`.

### Incident Scenario 2: Failed Ingestion Batch (`status: "FAILED"`)
**Symptom**: `AnalyticsIngestionRun` contains `status: "FAILED"` with `errorMessage`.
**Recovery Procedure**:
1. Inspect `errorMessage` in `AnalyticsIngestionRun`.
2. Safe Retry: Because `AnalyticsIngestionService` uses idempotent upserts (`AnalyticsReservation.upsert`, `AnalyticsPayment.upsert`, etc.), rerunning the ingestion cycle is completely safe and idempotently updates missing records without creating duplicates.
3. Trigger re-ingestion via queue producer or manual script execution.

---

## 4. Financial Reconciliation Runbook

Operators can run financial diagnostic checks on-demand:
```http
POST /api/v1/gamingCenters/:gamingCenterId/analytics/financials/reconciliation/run
```

- Financial reconciliation findings (e.g. `REC-001` through `REC-006`) are strictly **read-only diagnostic audit records**.
- Diagnostic runs **never** modify operational transaction records (`Payment`, `LedgerEntry`, `Refund`, `WalletTransaction`).
- Discrepancies identified during reconciliation should be referred to center management or finance teams for manual audit and operational adjustment.
