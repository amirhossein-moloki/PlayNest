# Phase 4 Reconciliation Rules Specifications

## Rule Catalog

### REC-001: Confirmed Payment Missing Ledger Posting
- **Invariant**: Every payment with status `PAID` must have a corresponding `LedgerEntry` of type `PAYMENT_COLLECTION`.
- **Source Entities**: `Payment` (`status = PAID`), `LedgerEntry`.
- **Matching Key**: `LedgerEntry.paymentId = Payment.id` and `entryType = 'PAYMENT_COLLECTION'`.
- **Severity**: HIGH.
- **Result Status**: `MISSING_COUNTERPART`.

### REC-002: Payment Ledger Amount Mismatch
- **Invariant**: The amount recorded in `Payment.amount` must match `LedgerEntry.amount` exactly for collection postings.
- **Source Entities**: `Payment`, `LedgerEntry`.
- **Comparison Rule**: `Payment.amount === LedgerEntry.amount`.
- **Severity**: HIGH.
- **Result Status**: `MISMATCH`.

### REC-003: Refund Source Integrity & Disbursement Ledger
- **Invariant**: Every `Refund` must reference a valid parent `Payment`, and `SUCCESSFUL` refunds must have a corresponding `REFUND_DISBURSEMENT` ledger entry with matching amount.
- **Source Entities**: `Refund`, `Payment`, `LedgerEntry`.
- **Severity**: HIGH.
- **Result Status**: `MISSING_COUNTERPART` or `MISMATCH`.

### REC-004: Duplicate Financial Posting
- **Invariant**: `LedgerEntry.idempotencyKey` must be unique across all ledger entries for a tenant.
- **Source Entities**: `LedgerEntry`.
- **Severity**: HIGH.
- **Result Status**: `DUPLICATE_POSTING`.

### REC-005: Wallet Deposit Integrity
- **Invariant**: Wallet `DEPOSIT` transactions must have positive monetary amounts (`amount > 0`).
- **Source Entities**: `WalletTransaction`.
- **Severity**: MEDIUM.
- **Result Status**: `MISMATCH`.

### REC-006: Commission Calculation Consistency
- **Invariant**: Commission earnings must match the percentage rate in `CommissionPolicy.percentBps`.
- **Source Entities**: `Earning`, `CommissionPolicy`.
- **Severity**: MEDIUM.
- **Result Status**: `MISMATCH`.
