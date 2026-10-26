# Play-Nest Analytics Phase 3 — Customer Metric Definitions

## Overview
This document specifies the exact business definitions, formulas, data source mappings, date/timezone rules, and limitations for all Phase 3 Customer Analytics metrics in Play-Nest.

---

## 1. Customer Activity Metrics

### 1.1 Active Customers
- **Business Purpose**: Measures distinct individual customers who engaged in qualifying activity at the gaming center during the selected period.
- **Formula**: `COUNT(DISTINCT customerAccountId)` from `Reservation` where `gamingCenterId = :gamingCenterId AND status = 'COMPLETED' AND startTime BETWEEN :dayStart AND :dayEnd`.
- **Source Entities**: `Reservation` / `AnalyticsReservation`, `CustomerAccount`.
- **Qualifying Event**: A `COMPLETED` reservation. `CANCELED` reservations are excluded.
- **Timezone Basis**: Converted to local time based on `Settings.timeZone` (defaults to `UTC`).
- **Measure Type**: Count.

### 1.2 New Customers vs Returning Customers
- **Business Purpose**: Differentiates first-time customers from returning customers during the selected analysis period.
- **Definitions**:
  - **New Customer**: A customer whose *first ever* completed reservation at the gaming center falls within the selected date range (`:dayStart` to `:dayEnd`).
  - **Returning Customer**: An active customer during the period whose first completed reservation occurred *before* `:dayStart`.
- **Formula**:
  - `New Customers = COUNT(DISTINCT customerAccountId)` where `min(startTime) BETWEEN :dayStart AND :dayEnd`.
  - `Returning Customers = Active Customers - New Customers`.
- **Source Entities**: `Reservation` / `AnalyticsReservation`.
- **Measure Type**: Count.

### 1.3 Visit Frequency Distribution
- **Business Purpose**: Shows how frequently customers visit the gaming center (e.g., 1 visit, 2-3 visits, 4-5 visits, 6-10 visits, 10+ visits).
- **Formula**: Group active customers by `COUNT(reservationId)` within the selected date range.
- **Source Entities**: `Reservation`.
- **Measure Type**: Histogram Distribution (Counts and Percentages).

---

## 2. Repeat Visits and Retention Metrics

### 2.1 Repeat Visit Rate
- **Business Purpose**: Measures the percentage of active customers during the period who completed 2 or more visits.
- **Formula**: `(COUNT(customers with completed_visits >= 2) / Active Customers) * 100`.
- **Source Entities**: `Reservation`.
- **Measure Type**: Ratio (Percentage).

### 2.2 Average Time Between Visits
- **Business Purpose**: Measures the average duration (in days) between consecutive completed visits for repeat customers.
- **Formula**: `AVG(startTime[i] - startTime[i-1])` in days across consecutive completed reservations per customer.
- **Source Entities**: `Reservation`.
- **Measure Type**: Average (Days).

### 2.3 Cohort Retention Matrix (Monthly)
- **Business Purpose**: Tracks retention rate of customer cohorts grouped by the month of their first visit over subsequent months (Month 0, Month 1, Month 2, etc.).
- **Formula**:
  - Cohort Size ($N_0$): Customers whose first completed visit was in Month $M_0$.
  - Month $k$ Retention ($R_k$): Percentage of $N_0$ who had at least 1 completed visit in Month $M_0 + k$.
- **Source Entities**: `Reservation`.
- **Measure Type**: Cohort Matrix (Percentages).

---

## 3. Customer Value Metrics

### 3.1 Historical Recorded Spend
- **Business Purpose**: Measures total monetary spend recorded for active customers during the selected period.
- **Formula**:
  - `Gross Reserved Value`: `SUM(totalPrice)` for completed reservations.
  - `Gross Paid Cash`: `SUM(amount)` from `Payment` where `status = 'PAID'`.
- **LTV Disclaimer**: This metric represents **Historical Recorded Spend** for the chosen period. It is **NOT** labeled "Lifetime Value (LTV)" because LTV requires predictive tenure modeling and historical cohort lifetime analysis beyond current data bounds.
- **Source Entities**: `Reservation`, `Payment`.
- **Measure Type**: Monetary Total (Grouped by Currency).

### 3.2 Average Spend Per Customer / Per Visit
- **Formula**:
  - `Avg Spend Per Active Customer = Gross Reserved Value / Active Customers`.
  - `Avg Spend Per Visit = Gross Reserved Value / Total Completed Visits`.
- **Measure Type**: Monetary Average.

---

## 4. Deterministic Customer Segmentation

### 4.1 Segments
1. **New Customers**: First visit within current analysis window.
2. **Repeat Customers**: 2 or more completed visits within window.
3. **High-Value (VIP)**: Top 10% spenders or completed visits $\ge 5$ in period.
4. **Declining Activity (At-Risk)**: Customers with $\ge 3$ visits in previous 60 days but 0 visits in last 30 days.

---

## 5. Privacy & Data Quality Dependencies
- Customer phone numbers are masked in summaries (`0912***1234`).
- Unlinked or guest walk-in records without a `customerAccountId` are grouped into a single "Unlinked Walk-In" bucket and excluded from customer retention/cohort calculations.
