# Play-Nest Analytics — Phase 6 Owner Metric Catalog
## Tenant-Facing Owner Metrics, Definitions, and Access Policies

---

## 1. Metric Catalog Overview
This document serves as the canonical catalog of metrics exposed to gaming-center owners and managers in Phase 6. Each metric is evaluated for business meaning, calculation formula, target audience, privacy impact, and tenant isolation parameters.

---

## 2. Overview Metrics

### 2.1 Recognized Revenue (`totalRevenue`)
- **Business Meaning**: Total monetary value of all successfully completed reservations during the selected date range.
- **Calculation**: $\sum \text{totalPrice}$ where $\text{status} = \text{'COMPLETED'}$ and $\text{gamingCenterId} = \text{tenantId}$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Reservation` operational table / `GamingCenterAnalytics`.
- **Tenant Leakage Risk**: None (filtered strictly by `gamingCenterId`).
- **Privacy Impact**: None (aggregated monetary total).

### 2.2 Realized Cash Collected (`realizedCash`)
- **Business Meaning**: Total gross payments collected in cash, card, or online methods.
- **Calculation**: $\sum \text{amount}$ where $\text{status} = \text{'PAID'}$ and $\text{gamingCenterId} = \text{tenantId}$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Payment` operational table.
- **Tenant Leakage Risk**: None.
- **Privacy Impact**: None.

### 2.3 Reservation Completion Rate (`completionRate`)
- **Business Meaning**: Percentage of booked reservations that ended in `COMPLETED` status.
- **Calculation**: $\left( \frac{\text{completedReservations}}{\text{totalReservations} - \text{canceledReservations}} \right) \times 100\%$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Reservation` status aggregates.
- **Tenant Leakage Risk**: None.

---

## 3. Game Station & Operational Metrics

### 3.1 Station Utilization Rate (`utilizationRate`)
- **Business Meaning**: Percentage of total operational capacity booked during the period per game station.
- **Calculation**: $\left( \frac{\text{totalHoursBooked}}{\text{daysCount} \times 24} \right) \times 100\%$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Reservation` / `GameStation`.
- **Tenant Leakage Risk**: None (station IDs belong to the tenant).

### 3.2 Waitlist Conversion Rate (`conversionRate`)
- **Business Meaning**: Percentage of waitlist requests converted into confirmed reservations.
- **Calculation**: $\left( \frac{\text{convertedEntries}}{\text{totalWaitlistEntries}} \right) \times 100\%$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `WaitlistEntry`.
- **Tenant Leakage Risk**: None.

---

## 4. Customer Activity & Retention Metrics

### 4.1 Active Customers Count (`activeCustomers`)
- **Business Meaning**: Number of distinct customer accounts with completed reservations in the date range.
- **Calculation**: $\text{Count Distinct}(\text{customerAccountId})$ for completed reservations.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Reservation`.
- **Privacy Impact**: Low (aggregated integer count).

### 4.2 Repeat Visit Rate (`repeatVisitRate`)
- **Business Meaning**: Percentage of active customers who completed 2 or more visits in the period.
- **Calculation**: $\left( \frac{\text{customersWithVisits} \ge 2}{\text{activeCustomers}} \right) \times 100\%$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Reservation`.

### 4.3 Top Spenders Report (`topSpenders`)
- **Business Meaning**: Ranking of top customer accounts by total recorded spend in the period.
- **Fields Returned**: `fullName`, `phone` (masked), `visits`, `totalSpend`.
- **PII Protection**: Customer phone numbers MUST be masked using `0912***1234` formatting. Full unmasked phone numbers are strictly prohibited in analytics outputs.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Reservation` joined with `CustomerAccount`.

---

## 5. Financial Summary Metrics

### 5.1 Net Cash Collected (`netCollected`)
- **Business Meaning**: Net funds retained after deducting successful refunds from gross collected payments.
- **Calculation**: $\text{grossCollected} - \text{totalRefunded}$.
- **Access Roles**: `MANAGER`, `ADMIN`.
- **Data Source**: `Payment`, `Refund`.
- **Limitations**: Represents cash flow movements, not accrual-accounting profit.

---

## 6. Metric Suitability & Restricted Metrics Matrix

| Metric Category | Metric Name | Tenant-Facing Status | Notes / Restrictions |
|---|---|---|---|
| Overview | Total Revenue & Realized Cash | **Approved** | Uses verified integer minor unit sums |
| Overview | Completion / Cancellation Rates | **Approved** | Unbiased status counts |
| Stations | Station Utilization Rate | **Approved** | Calculated against station max capacity |
| Customers | Active / New / Returning Counts | **Approved** | Aggregated count metrics |
| Customers | Customer Cohort Retention | **Approved** | Anonymized monthly cohort matrix |
| Customers | Top Spenders | **Approved (Masked)** | Requires phone masking (`0912***1234`) |
| Financials | Payment Method & Provider Breakdown | **Approved** | Summary level only |
| Diagnostics | Internal Reconciliation Findings (`REC-001` - `REC-006`) | **Internal / Restricted** | Restricted from default tenant owner view |
