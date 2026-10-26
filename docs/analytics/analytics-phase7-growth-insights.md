# Play-Nest Analytics Phase 7 — Growth Insights Engine Specification

## 1. Growth Insights Engine Purpose
The Growth Insights Engine provides automated, explainable, descriptive observations to gaming center managers and administrators.

Insights are strictly evidence-backed and grounded in verifiable historical operational data and peer benchmark aggregates.

---

## 2. Implemented Growth Insight Definitions

### Insight INSIGHT-001: Reservation Volume Trend
- **Type**: `TREND_VS_PRIOR_PERIOD`
- **Metric**: `totalReservations`
- **Calculation**: Compares total reservations created in selected period vs prior period of equal duration ($P_{\text{prior}} = [T_{\text{start}} - \Delta, T_{\text{start}}]$).
- **Directions**:
  - `IMPROVED`: Net change $> 0$.
  - `DECLINED`: Net change $< 0$.
  - `STABLE`: Net change $= 0$.
- **Example Output**: `+5 reservations (+25%)`

### Insight INSIGHT-002: Completion Rate Trend
- **Type**: `TREND_VS_PRIOR_PERIOD`
- **Metric**: `completionRate`
- **Calculation**: Compares percentage completion rate between current and prior period.
- **Example Output**: `+4.2% percentage points`

### Insight INSIGHT-003: Completion Rate vs Peer Benchmark
- **Type**: `BENCHMARK_COMPARISON`
- **Metric**: `completionRate`
- **Calculation**: Difference between tenant completion rate and peer cohort median ($k \ge 5$).
- **Evidence Basis**: `Tenant: 88.5% vs Peer Median: 82.0% across 6 peers`

### Insight INSIGHT-004: Customer Repeat Visit Rate vs Peer Benchmark
- **Type**: `BENCHMARK_COMPARISON`
- **Metric**: `repeatVisitRate`
- **Calculation**: Difference between tenant repeat visit rate and peer cohort median ($k \ge 5$).
- **Evidence Basis**: `Tenant repeat visit rate: 45.0% vs Peer Median: 38.5%`

---

## 3. Scope Boundaries & Non-Goals
1. **No Predictive AI / ML**: Insights describe historical facts, not predictive forecasts.
2. **No Automated Price Changes**: Insights do not perform automated business actions or pricing adjustments.
3. **No Unsubstantiated Causal Claims**: Insights observe correlations without alleging unproven causation.
