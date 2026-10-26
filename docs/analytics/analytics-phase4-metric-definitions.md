# Phase 4 Metric Definitions & Financial Semantics

## 1. Financial Overview KPIs

### 1.1 Gross Cash Collected
- **Formula**: `SUM(Payment.amount)` WHERE `Payment.status = PAID` AND `paidAt` IN `[startDate, endDate]`.
- **Semantics**: Total operational cash received via payments. Expressed in integer minor units (Rials).
- **Time Basis**: Payment confirmation timestamp (`paidAt`).

### 1.2 Total Refunded
- **Formula**: `SUM(Refund.amount)` WHERE `Refund.status = SUCCESSFUL` AND `processedAt` IN `[startDate, endDate]`.
- **Semantics**: Total operational cash disbursed as completed refunds.
- **Time Basis**: Refund processing timestamp (`processedAt`).

### 1.3 Net Cash Collected
- **Formula**: `Gross Cash Collected - Total Refunded`.
- **Semantics**: Net cash retained from payment operations.

### 1.4 Unearned Customer Wallet Liabilities
- **Formula**: `SUM(CustomerAccount.walletBalance)` FOR customers associated with the `gamingCenterId`.
- **Semantics**: Total advance cash deposited by customers not yet consumed for reservation services.

---

## 2. Reconciliation Findings & Classification

| Finding Status | Meaning | Actionability |
| :--- | :--- | :--- |
| `MATCHED` | Source records strictly satisfy business invariant rules. | No action required. |
| `MISSING_COUNTERPART` | Operational event exists without required counterpart ledger entry. | High severity diagnostic finding. |
| `MISMATCH` | Operational event and counterpart ledger entry amounts or calculations differ. | High/Medium severity diagnostic finding. |
| `DUPLICATE_POSTING` | Multiple ledger entries share an identical idempotency key. | High severity diagnostic finding. |
