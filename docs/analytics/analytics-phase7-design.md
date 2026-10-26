# Play-Nest Analytics Phase 7 — Privacy-Preserving Benchmarking & Growth Insights Architecture & Design

## 1. Architectural Overview
Phase 7 introduces privacy-preserving cross-tenant benchmarking and descriptive growth insights to the Play-Nest Analytics suite.

The system allows gaming center managers (`MANAGER`) and administrators (`ADMIN`) to evaluate their operational performance against privacy-safe peer cohort aggregates (median, mean, 25th percentile, 75th percentile) and receive explainable growth insights.

### Key Architectural Tenets
1. **Strict Server-Side Isolation**: Cross-tenant raw data is never exposed. Peer aggregates are calculated exclusively through server-side repository queries in `AnalyticsRepo`.
2. **$k$-Anonymity Privacy Defense**: Minimum peer cohort size threshold $k \ge 5$ is strictly enforced. If fewer than 5 eligible peer tenants exist, benchmark output is automatically suppressed (`isSuppressed: true`).
3. **Exclusion of Self**: The requesting tenant's own operational metrics are excluded from peer cohort aggregate statistics to prevent self-subtraction and baseline skew.
4. **Administrative Kill Switch**: A global configuration flag `ENABLE_ANALYTICS_BENCHMARKING` enables instant operational disablement.

---

## 2. Component Design & Implementation Artifacts

| Component | Repository File Path | Responsibility |
|---|---|---|
| **Validators** | `sayra/src/modules/analytics/analytics.validators.ts` | Zod query validation (`startDate`, `endDate`, `peerGroupCategory`). |
| **Repository** | `sayra/src/modules/analytics/analytics.repo.ts` | Privacy-safe aggregate queries over peer cohorts. |
| **Station (Domain Service)** | `sayra/src/modules/analytics/analytics.station.ts` | $k$-anonymity enforcement, percentile calculations, growth insight generation. |
| **Controller** | `sayra/src/modules/analytics/analytics.controller.ts` | HTTP request/response orchestration and status mapping. |
| **Routes** | `sayra/src/modules/analytics/analytics.routes.ts` | Protected endpoints under `/gamingCenters/:gamingCenterId/analytics/benchmarks` and `/growth-insights`. |
| **API Spec** | `sayra/src/docs/openapi.yaml` | Canonical OpenAPI 3.0 specification. |

---

## 3. Endpoints

### 1. `GET /api/v1/gamingCenters/:gamingCenterId/analytics/benchmarks`
- **Auth & Role**: `authMiddleware`, `tenantGuard`, `requireRole([UserRole.MANAGER, UserRole.ADMIN])`.
- **Query Params**: `startDate`, `endDate`, `peerGroupCategory` (`ALL`, `STANDARD`, `PREMIUM`).
- **Response**:
  - `status`: `'PUBLISHED'` | `'SUPPRESSED'` | `'DISABLED'`.
  - `isSuppressed`: boolean.
  - `peerCohortCount`: number ($k$).
  - `tenantMetrics`: tenant's own KPIs.
  - `benchmarks`: aggregate metrics (median, mean, p25, p75, diffFromMedian) if $k \ge 5$.

### 2. `GET /api/v1/gamingCenters/:gamingCenterId/analytics/growth-insights`
- **Auth & Role**: `authMiddleware`, `tenantGuard`, `requireRole([UserRole.MANAGER, UserRole.ADMIN])`.
- **Response**:
  - `insightCount`: number.
  - `insights`: Array of descriptive growth insights comparing current vs prior period and peer benchmark median.

---

## 4. Verification Evidence
- Unit Tests: `sayra/tests/unit/modules/analytics/analytics.benchmarks.spec.ts` (100% PASS).
- API Integration Tests: `sayra/tests/api/analytics/analytics.api.spec.ts` (100% PASS).
- Spectral OpenAPI Validation: `npm run api:validate` (0 errors).
