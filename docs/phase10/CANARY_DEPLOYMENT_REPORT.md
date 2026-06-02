# Phase 10: Canary Release & Monitoring Strategy

## 1. Incremental Rollout Plan
We follow a 3-phase rollout strategy to minimize the blast radius of potential failures.

| Phase | Traffic % | Duration | Success Criteria |
| :--- | :--- | :--- | :--- |
| **Phase 1** | 5% | 2 Hours | Error rate < 1%, p95 Latency < 500ms |
| **Phase 2** | 25% | 6 Hours | No data inconsistencies, stable queue depth |
| **Phase 3** | 100% | Permanent | Full transition to new version |

## 2. Key Metrics for Real-Time Monitoring
During the canary rollout, the following metrics (emitted via `Metrics` utility) must be monitored:

### Technical Health
- **API Error Rate:** Percentage of 5xx responses. (Target: < 0.1%)
- **p95 Latency:** Time taken for 95% of requests. (Target: < 300ms for core endpoints)
- **Worker Failure Rate:** Rate of `METRIC_WORKER_ERROR` logs.
- **Queue Backlog:** Growth of waiting jobs in BullMQ.

### Business Health
- **Reservation Success Rate:** Ratio of successful vs failed reservation attempts.
- **Payment Completion Rate:** Successful ZarinPal callbacks.
- **Idempotency Hits:** Ensuring that retry logic doesn't create duplicates.

## 3. Automated Rollback Triggers
The deployment pipeline will trigger an **immediate rollback** if any of the following conditions are met:
1. **Error Spike:** API 5xx errors exceed 2% of total traffic for a 5-minute window.
2. **Latency Degradation:** p95 latency increases by more than 50% compared to the baseline.
3. **Data Anomaly:** Detection of duplicate records in the database (e.g., two reservations for same station/time).
4. **Worker Crash:** Critical background worker (SMS/Payments) enters a crash loop.

## 4. Observability Dashboard Setup
Dashboards in Grafana (or similar) will be configured to visualize:
- **Traffic Split:** Percentage of traffic served by Canary vs Stable.
- **Latency Heatmap:** Visualization of response times across all endpoints.
- **Error Breakdown:** Categorization of errors (Validation vs System vs Third-party).
- **Business KPI Ticker:** Real-time count of Reservations and Payments.

## 5. Rollout Control
Traffic steering is managed via the Load Balancer (e.g., Nginx or AWS ALB) using header-based or cookie-based session affinity to ensure a consistent user experience during the transition.
