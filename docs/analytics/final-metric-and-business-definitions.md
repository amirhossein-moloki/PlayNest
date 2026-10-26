# Play-Nest Analytics — Final Metric and Business Definitions Catalog

## Overview
This catalog details every business and operational metric calculated in code within the Play-Nest Analytics engine (`sayra`).

---

## 1. Executive & Summary Metrics

### Total Revenue (`totalRevenue`)
- **Business Definition:** Total monetary value of completed reservations recognized during the selected period.
- **Formula:** `SUM(AnalyticsReservation.totalPrice)` where `status = 'COMPLETED'` and `startTime` within period.
- **Unit & Currency:** Minor integer units (Rials / IRR or Tomans / IRT).
- **Calculation Location:** `AnalyticsStation.getSummary` & `AnalyticsRepo.getSummaryStats`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### Realized Cash Collected (`realizedCash`)
- **Business Definition:** Actual gross cash payments collected and marked as paid.
- **Formula:** `SUM(AnalyticsPayment.amount)` where `status = 'PAID'` and `paidAt` within period.
- **Unit & Currency:** Minor integer units (IRR / IRT).
- **Calculation Location:** `AnalyticsStation.getSummary` & `AnalyticsRepo.getLiveFinancialStats`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### Completion Rate (`completionRate`)
- **Business Definition:** Percentage of non-canceled reservations that were successfully completed.
- **Formula:** `ROUND((completedReservations / (totalReservations - canceledReservations)) * 100, 2)`
- **Unit:** Percentage (`0.00%` - `100.00%`).
- **Calculation Location:** `AnalyticsStation.getSummary` & `AnalyticsStation.getReservationReport`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### Average Reservation Value (`averageReservationValue`)
- **Business Definition:** Average revenue generated per completed reservation.
- **Formula:** `ROUND(totalRevenue / completedReservations)`
- **Unit & Currency:** Minor integer units (IRR / IRT).
- **Calculation Location:** `AnalyticsStation.getSummary`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

---

## 2. Customer Analytics Metrics (Phase 3)

### Active Customers (`activeCustomers`)
- **Business Definition:** Count of unique customer accounts with at least 1 completed reservation during the period.
- **Formula:** `COUNT(DISTINCT customerAccountId)` from completed reservations in period.
- **Calculation Location:** `AnalyticsStation.getCustomerSummary`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### New vs Returning Customers (`newCustomers` / `returningCustomers`)
- **Business Definition:**
  - `New Customer`: First-ever reservation occurred within selected period.
  - `Returning Customer`: Had at least one prior reservation before selected period.
- **Formula:** Compares customer first-visit timestamp (`MIN(startTime)`) against period start date.
- **Calculation Location:** `AnalyticsStation.getCustomerSummary`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### Repeat Visit Rate (`repeatVisitRate`)
- **Business Definition:** Percentage of active customers in period who booked 2 or more reservations.
- **Formula:** `ROUND((repeatCustomersCount / activeCustomersCount) * 100, 2)`
- **Calculation Location:** `AnalyticsStation.getCustomerSummary`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### Average Days Between Visits (`avgDaysBetweenVisits`)
- **Business Definition:** Mean interval in days between consecutive visits for active repeat customers.
- **Formula:** `ROUND(SUM(differenceInDays(visit[i], visit[i-1])) / totalGapCount, 1)`
- **Calculation Location:** `AnalyticsStation.getCustomerSummary`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

---

## 3. Financial & Reconciliation Metrics (Phase 4)

### Gross Collected vs Net Collected
- **Gross Collected:** `SUM(AnalyticsPayment.amount)` for `status = 'PAID'`.
- **Total Refunded:** `SUM(AnalyticsRefund.amount)` for `status = 'SUCCESSFUL'`.
- **Net Collected:** `Gross Collected - Total Refunded`.
- **Unit & Currency:** Minor integer units (IRR / IRT).
- **Calculation Location:** `AnalyticsStation.getFinancialReport`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

### Diagnostic Reconciliation Rules (`REC-001` to `REC-006`)
- `REC-001`: Payment vs Ledger Entry Balance Match (`Payment.amount == LedgerEntry.amount`).
- `REC-002`: Completed Reservation Payment Settlement (`Reservation.status == 'COMPLETED' => Payment.status == 'PAID'`).
- `REC-003`: Refund Ledger Entry Consistency.
- `REC-004`: Wallet Deposit Ledger Balance Match.
- `REC-005`: Commission Earning Base Calculation Validation.
- `REC-006`: Unsettled Paid Payments Check.
- **Calculation Location:** `AnalyticsRepo.runFinancialReconciliationCheck`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.

---

## 4. Privacy-Preserving Benchmark Metrics (Phase 7)

All benchmark metrics enforce $k$-anonymity ($k \ge 5$) cohort suppression and target tenant self-exclusion.

- `completionRate` (Peer Median, Mean, P25, P75).
- `averageSessionDurationHours` (Peer Median, Mean, P25, P75).
- `stationUtilizationRate` (Peer Median, Mean, P25, P75).
- `repeatVisitRate` (Peer Median, Mean, P25, P75).
- **Diff From Median:** `Math.round((TenantMetric - PeerMedian) * 100) / 100`.
- **Calculation Location:** `AnalyticsStation.getBenchmarks`.
- **Verification Status:** `VERIFIED IMPLEMENTED`.
