# Play-Nest Analytics — Phase 6 Operations Runbook
## Rollout, Monitoring, Incident Response, and Stale Data Procedures

---

## 1. Overview
This runbook provides operational procedures for deploying, monitoring, troubleshooting, and managing tenant-facing owner analytics in Phase 6.

---

## 2. Staged Rollout Strategy

1. **Stage 1 — Local & Automated Validation**:
   - Run unit, integration, API, and lint checks:
     `npm test && npm run lint && npm run api:validate`
2. **Stage 2 — Controlled Pilot Release**:
   - Enable owner analytics for explicitly selected pilot gaming centers (`MANAGER` / `ADMIN` accounts).
   - Verify that pilot users can view their respective dashboards without cross-tenant anomalies.
3. **Stage 3 — Full Availability**:
   - Enable owner analytics across all tenant organizations.

---

## 3. Monitoring & Health Indicators

### 3.1 Data Freshness Monitoring
- Endpoint: `GET /api/v1/gamingCenters/:gamingCenterId/analytics/ingestion-status`
- Key Indicator: `status` (`FRESH` vs `STALE`).
- Thresholds:
  - **FRESH**: Ingestion worker completed within the last 120 minutes.
  - **STALE**: Last successful ingestion run $> 120$ minutes ago.

### 3.2 Error Log Alerts
- **HTTP 404 Spikes on Analytics Routes**: May indicate unauthorized cross-tenant access attempts or bad frontend navigation links.
- **HTTP 403 Spikes**: Indicates staff users attempting to access manager/owner analytics screens.

---

## 4. Incident Response & Troubleshooting

### Scenario A: Dashboard UI Displays "Data Stale"
1. Check background ingestion worker health:
   `npm run backfill:analytics`
2. Inspect `AnalyticsIngestionRun` database records for recent failure messages:
   `SELECT * FROM "AnalyticsIngestionRun" ORDER BY "startedAt" DESC LIMIT 5;`
3. Trigger manual backfill if worker was interrupted.

### Scenario B: Suspected Cross-Tenant Information Leak
1. Immediately verify `tenantGuard` middleware configuration on `analyticsRoutes` and `dashboardAdminUiRouter`.
2. Review audit logs for unauthorized requests.
3. Verify that `req.tenant.gamingCenterId` is passed into all `AnalyticsRepo` database queries.

---

## 5. Safe Disablement / Emergency Kill Switch
If a critical isolation vulnerability or severe data corruption is identified:
1. Temporarily restrict the analytics route access by updating `requireRole([UserRole.ADMIN])` or placing the endpoints behind a feature flag.
2. The core reservation, payment, and gaming session operations operate independently and will remain unaffected.
