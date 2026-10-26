# Play-Nest Analytics Phase 7 — Benchmark Metric Catalog

## 1. Metric Catalog Overview
This catalog defines the 4 core benchmark metrics selected for Phase 7 benchmarking and descriptive growth insights.

All metrics are privacy-preserved using $k$-anonymity ($k \ge 5$). When $k < 5$, metrics are suppressed.

---

## 2. Selected Benchmark Metrics

### Metric 1: Reservation Completion Rate (`completionRate`)
- **Business Meaning**: Percentage of created reservations during the observation window that reached `COMPLETED` status.
- **Formula**: $\frac{\text{Completed Reservations}}{\text{Total Created Reservations}} \times 100$
- **Unit**: Percentage (`%`)
- **Rounding Policy**: 2 decimal places.
- **Source**: `AnalyticsReservation` / `Reservation` table (`status: 'COMPLETED'`).
- **Peer Aggregate Statistics**: Median, Mean, 25th Percentile (`p25`), 75th Percentile (`p75`).

### Metric 2: Average Session Duration (`averageSessionDurationHours`)
- **Business Meaning**: Average duration in hours of completed gaming sessions/reservations.
- **Formula**: $\frac{\text{Total Completed Hours}}{\text{Completed Reservation Count}}$
- **Unit**: Hours (`HOURS`)
- **Rounding Policy**: 2 decimal places.
- **Source**: `AnalyticsGamingSession` / `Reservation` table (`totalHours`).
- **Peer Aggregate Statistics**: Median, Mean, 25th Percentile, 75th Percentile.

### Metric 3: Station Utilization Rate (`stationUtilizationRate`)
- **Business Meaning**: Percentage of available station capacity hours booked and completed during operating hours.
- **Formula**: $\frac{\text{Total Completed Station Hours}}{\text{Active Stations Count} \times \text{Days in Period} \times 24} \times 100$
- **Unit**: Percentage (`%`)
- **Rounding Policy**: 2 decimal places.
- **Source**: `GameStation` and `Reservation` tables.
- **Peer Aggregate Statistics**: Median, Mean, 25th Percentile, 75th Percentile.

### Metric 4: Customer Repeat Visit Rate (`repeatVisitRate`)
- **Business Meaning**: Percentage of active customer accounts during the period who completed $\ge 2$ reservations.
- **Formula**: $\frac{\text{Customers with } \ge 2 \text{ Completed Reservations}}{\text{Total Active Customers in Period}} \times 100$
- **Unit**: Percentage (`%`)
- **Rounding Policy**: 2 decimal places.
- **Source**: `AnalyticsReservation` / `CustomerAccount` table.
- **Peer Aggregate Statistics**: Median, Mean, 25th Percentile, 75th Percentile.

---

## 3. Cohort Rules & Disclaimers
1. **Self-Exclusion**: Target gaming center's own metric is excluded from the peer aggregate calculation.
2. **$k$-Anonymity Threshold**: Requires $k \ge 5$ distinct active peer gaming centers.
3. **Freshness**: Aggregates are computed in real time from operational analytics stores.
