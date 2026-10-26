# Play-Nest Analytics Phase 7 — Operations Runbook

## 1. Environment Configuration

### Feature Flags & Configuration Variables
- `ENABLE_ANALYTICS_BENCHMARKING`: Controls availability of benchmarking endpoints.
  - `true` (default): Benchmarking active.
  - `false`: Disables benchmarking immediately (`status: 'DISABLED'`).

---

## 2. Operational Procedures

### Disablement / Kill Switch Procedure
If a potential disclosure risk or data quality issue is suspected:
1. Set `ENABLE_ANALYTICS_BENCHMARKING=false` in application environment (`.env` or container settings).
2. Restart application process / service pod:
   ```bash
   npm run start
   ```
3. Verify that `GET /api/v1/gamingCenters/:gamingCenterId/analytics/benchmarks` returns:
   ```json
   {
     "status": "DISABLED",
     "isSuppressed": true,
     "message": "Cross-tenant benchmarking is currently disabled by administrative policy."
   }
   ```

### Operational Monitoring
1. Monitor HTTP response status codes on benchmarking routes (`/analytics/benchmarks`, `/analytics/growth-insights`).
2. Audit suppression frequency (`isSuppressed: true` responses). High suppression rates indicate small tenant density ($k < 5$).
3. Monitor analytics ingestion pipeline health via `GET /api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status`.

---

## 3. Rollback Procedure
If code rollback is required:
1. Revert deployment commit.
2. Run automated test suite to ensure system stability:
   ```bash
   cd sayra && npm test
   ```
