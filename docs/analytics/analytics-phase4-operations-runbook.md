# Phase 4 Operations Runbook — Financial Reconciliation

## 1. Daily Reconciliation Workflow
1. Navigate to the Internal Management Dashboard mounted at `/api/v1/admin/gamingCenters/:gamingCenterId/dashboard`.
2. Inspect the **Financial Reconciliation Diagnostics** table.
3. Review any listed findings categorized by `Severity` (`HIGH` or `MEDIUM`) and `Status` (`MISSING_COUNTERPART`, `MISMATCH`, `DUPLICATE_POSTING`).
4. To trigger an on-demand audit check for a specific date range, issue a `POST` request to `/api/v1/gamingCenters/:gamingCenterId/analytics/financials/reconciliation/run`.

## 2. Investigating Findings
- **`REC-001` (Missing Ledger Posting)**: Check if payment callback execution failed before calling `LedgerRepo.createCollectionEntry`.
- **`REC-002` (Ledger Amount Mismatch)**: Verify if discount or fee partial deductions were applied without compensating ledger entries.
- **`REC-003` (Refund Discrepancy)**: Inspect gateway refund callbacks and `Refund.status` transitions.
- **`REC-004` (Duplicate Postings)**: Check database idempotency constraints and retry mechanisms.

## 3. Operational Safety Warnings
- **NO AUTOMATIC MUTATION**: Analytical reconciliation endpoints do not mutate operational databases. Never run SQL scripts directly on `Payment` or `LedgerEntry` production tables without proper approval and audit logs.
