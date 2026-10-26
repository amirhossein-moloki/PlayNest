# Play-Nest Analytics Operations Runbook

## 1. Pipeline Overview
The Analytics Ingestion Engine runs hourly, incrementally extracting operational updates into analytical tables (`AnalyticsTenant`, `AnalyticsReservation`, `AnalyticsPayment`, etc.).

## 2. Configuration & Environment Variables
- `ANALYTICS_INGESTION_CRON`: Cron expression for worker execution (default: `0 * * * *` - hourly).
- `ANALYTICS_LOOKBACK_MINUTES`: Sliding window for incremental query safety (default: `120` minutes).
- `ANALYTICS_BATCH_SIZE`: Page size for database batch processing (default: `500`).

## 3. Initial Backfill & Re-indexing
To trigger an initial backfill or manual rebuild:
1. Reset watermarks via database or API:
   ```sql
   UPDATE "AnalyticsWatermark" SET "lastIngestedAt" = '1970-01-01 00:00:00' WHERE "entity" = 'Reservation';
   ```
2. Trigger ingestion service manually via Node script or job trigger:
   ```bash
   npx ts-node -e "require('./src/modules/analytics/analyticsIngestionService').analyticsIngestionService.runIngestionCycle()"
   ```

## 4. Monitoring & Observability
- Check run history in `AnalyticsIngestionRun`:
  ```sql
  SELECT id, entity, status, recordsRead, recordsIngested, durationMs, createdAt, errorMessage
  FROM "AnalyticsIngestionRun"
  ORDER BY createdAt DESC LIMIT 20;
  ```
- Check current entity watermarks:
  ```sql
  SELECT entity, lastIngestedAt, updatedAt FROM "AnalyticsWatermark";
  ```

## 5. Troubleshooting & Failure Recovery
- **Failed Ingestion Runs**:
  - If a run fails, the watermark does NOT advance for that entity.
  - Fix any transient issues (e.g. database connectivity).
  - Re-run the ingestion cycle; the pipeline will resume safely from the last valid watermark.
- **Data Reconciliation**:
  - Compare operational record count with analytical record count per tenant:
    ```sql
    SELECT
      (SELECT COUNT(*) FROM "Reservation") AS op_count,
      (SELECT COUNT(*) FROM "AnalyticsReservation") AS analytics_count;
    ```
