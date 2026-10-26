# Play-Nest Analytics Phase 3 — Operations Runbook

## 1. Overview
Phase 3 Customer Analytics provides internal management users with retention, visit behavior, cohort analysis, deterministic segmentation, and customer spend metrics.

This runbook describes operational procedures, refresh behavior, troubleshooting, and data-quality guidelines for Phase 3 analytics.

---

## 2. Refresh Behavior & Execution

Customer Analytics metrics aggregate operational database records (`Reservation`, `CustomerAccount`, `CustomerProfile`, `Payment`) on demand via server-side database aggregations (`groupBy`, `count`, `_min`).

- **Query Freshness**: Real-time operational database queries scoped by local timezone boundaries.
- **Pipeline Freshness**: Verified via `GET /api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status` (FRESH when last ingestion occurred within 120 minutes).
- **Scheduled Backfill**: Manual analytics backfills can be initiated using:
  ```bash
  npm run backfill:analytics
  ```

---

## 3. Operations & Health Checks

### 3.1 Pipeline Health Check
Query ingestion status:
```bash
curl -X GET "http://localhost:3000/api/v1/gamingCenters/gc_123/analytics/ingestion-status" \
  -H "Authorization: Bearer <ADMIN_JWT_TOKEN>"
```
Expected Output:
```json
{
  "success": true,
  "data": {
    "status": "FRESH",
    "lastIngestedAt": "2026-03-31T12:00:00.000Z",
    "watermarks": [...]
  }
}
```

### 3.2 Key Monitoring Metrics
1. **Pipeline Freshness Status**: Alert if status returns `STALE`.
2. **Database Query Latency**: Ensure index coverage on `Reservation(gamingCenterId, status, startTime)` and `Reservation(customerAccountId, startTime)`.

---

## 4. Security & Privacy Operational Directives

- **Phone Number Masking**: Management reports must obscure customer phone numbers (`0912***1234`) on top spender listings to protect customer PII.
- **Access Control**: Authorization strictly enforced at server boundaries. Only users with role `MANAGER` or `ADMIN` attached to the requested `gamingCenterId` are permitted access.
- **No Direct Export of Raw Passwords/Tokens**: Operational data pipelines explicitly exclude authentication secrets from analytics tables.

---

## 5. Troubleshooting & Recovery

| Issue | Root Cause | Remediation Step |
|---|---|---|
| **Stale Data Warning in UI** | Background ingestion worker halted or Redis queue connection dropped. | Restart BullMQ worker (`npm run dev` or docker container `sayra`) and check Redis health. |
| **Empty Cohort Retention Matrix** | Selected date range contains no historical completed visits. | Expand date range query or check if reservations exist in `COMPLETED` status. |
| **403 Forbidden on API Call** | User lacking `MANAGER` / `ADMIN` role or mismatched `gamingCenterId`. | Verify JWT token claims and user permissions in `User` table. |
