# Phase 4 Financial Analytics & Reconciliation — Design Document

## 1. Executive Summary
Phase 4 of Play-Nest Analytics provides trustworthiness and auditability for financial operations across payments, refunds, ledger entries, wallet transactions, and commission earnings.

## 2. Source-of-Truth & Financial Principles
- **Authoritative Ledgers**: Operational models (`Payment`, `Refund`, `LedgerEntry`, `WalletTransaction`, `Earning`) are authoritative. Analytics computes deterministic diagnostics and aggregate views without mutating operational rows.
- **Integer Precision**: All monetary values are processed as non-floating-point minor units (e.g., Rials/IRR).
- **Tenant Isolation**: Every financial query and reconciliation audit is bounded by `gamingCenterId`.
- **RBAC**: Protected server-side endpoints restricted to `MANAGER` and `ADMIN` roles.

## 3. Financial Overview Architecture
Detailed financial overview aggregations group by currency and status across:
1. `Payment`: Status, method, provider, currency breakdown.
2. `Refund`: Status and disbursed refund amounts.
3. `LedgerEntry`: Double-entry posting classifications (`PAYMENT_COLLECTION`, `REFUND_DISBURSEMENT`, `COMPENSATING_ADJUSTMENT`).
4. `WalletTransaction`: Top-up deposit liabilities vs reservation spending.
5. `Earning`: Commission calculation tracking vs monthly target goals.

## 4. Reconciliation Rules Engine
The reconciliation engine evaluates financial invariants across records in specified time boundaries:
- **REC-001**: Confirmed payment missing `PAYMENT_COLLECTION` ledger posting.
- **REC-002**: Confirmed payment amount vs ledger collection posting mismatch.
- **REC-003**: Refund missing parent payment or missing/mismatched `REFUND_DISBURSEMENT` ledger posting.
- **REC-004**: Duplicate ledger postings sharing an idempotency key.
- **REC-005**: Wallet transaction validity and deposit non-positivity checks.
- **REC-006**: Commission calculation consistency against configured `CommissionPolicy`.
