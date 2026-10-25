# Phase 6 — Refunds, Financial Ledger & Reconciliation Documentation

## 1. Overview & Architecture

Phase 6 implements a production-grade refund engine, append-only financial ledger, and automated payment reconciliation system within the Sayra backend. Built with financial transaction integrity at its core, the solution guarantees that:

1. **Original Payment Verification:** Only genuinely successful (`PAID`) payments are eligible for refunds.
2. **Cumulative Over-Refund Prevention:** Database-level row locking (`SELECT ... FOR UPDATE`) enforces that the sum of successful and pending refund amounts never exceeds the original payment total, even under extreme concurrent requests.
3. **Strict State Isolation:** Payment statuses, refund statuses (`PENDING`, `SUCCESSFUL`, `FAILED`, `AMBIGUOUS`), and reservation statuses are tracked independently.
4. **Append-Only Financial Ledger:** Financial movements (`PAYMENT_COLLECTION`, `REFUND_DISBURSEMENT`, `COMPENSATING_ADJUSTMENT`) are atomically persisted as immutable ledger entries with unique idempotency keys.
5. **Reconciliation Engine:** Automated verification compares internal records against provider gateways to flag status or amount discrepancies without overwriting history.

---

## 2. Refund Workflow & State Machine

### 2.1 Refund State Transitions

```
                 ┌───────────────┐
                 │    PENDING    │
                 └───────┬───────┘
                         │
        ┌────────────────┼────────────────┐
        │                │                │
        ▼                ▼                ▼
┌───────────────┐┌───────────────┐┌───────────────┐
│  SUCCESSFUL   ││    FAILED     ││   AMBIGUOUS   │
└───────────────┘└───────────────┘└───────────────┘
```

- **`PENDING`**: Initial durable state created inside a locked database transaction after validating that `amount <= remainingRefundableBalance`.
- **`SUCCESSFUL`**: Terminal state set when provider returns confirmation. Atomically creates a `REFUND_DISBURSEMENT` ledger entry and updates reservation `paymentState` (`REFUNDED` if fully refunded, `PARTIALLY_PAID` if partial).
- **`FAILED`**: Set when provider explicitly rejects the refund or provider lacks API support.
- **`AMBIGUOUS`**: Set when network timeouts, ambiguous gateway responses, or unconfirmed states occur. Retains details for reconciliation review instead of falsely marking success or failure.

### 2.2 Payment Provider Capabilities Matrix

| Provider Adapter | `supportsRefunds` | Automated Direct Refunds | Outcome Handling |
| :--- | :--- | :--- | :--- |
| `FakePaymentProvider` | `true` | Full & Partial Supported | Simulates `SUCCESSFUL`, `FAILED`, `AMBIGUOUS`, and `PENDING` states based on request handles. |
| `ZarinPalProvider` | `false` | Manual Gateway Panel Required | Returns `supportsRefunds = false`; requests gracefully record `FAILED` status indicating ZarinPal REST v4 API requires manual merchant portal intervention. |

---

## 3. Concurrency Control & Row Locking Strategy

### 3.1 Over-Refund Guarantee
To prevent race conditions where two concurrent refund requests (e.g. requesting 80 units each on a 100-unit payment) both succeed:

1. The transaction acquires an explicit PostgreSQL row lock:
   ```sql
   SELECT id, "gamingCenterId", amount, currency, provider, status
   FROM "Payment"
   WHERE id = $1 AND "gamingCenterId" = $2
   FOR UPDATE;
   ```
2. While holding the lock, the server calculates:
   $$\text{Remaining Balance} = \text{Payment Amount} - \sum (\text{SUCCESSFUL Refunds} + \text{PENDING Refunds})$$
3. If $\text{Requested Amount} > \text{Remaining Balance}$, the request is rejected immediately with HTTP `409 CONFLICT`.
4. If $\text{Requested Amount} \le \text{Remaining Balance}$, a `PENDING` refund record is persisted, locking that portion of the balance for the duration of the provider call.

---

## 4. Append-Only Financial Ledger

The `LedgerEntry` model implements a persistent, append-only financial audit trail.

### 4.1 Entry Types & Guarantees
- **`PAYMENT_COLLECTION`**: Recorded atomically when a payment transitions to `PAID`.
- **`REFUND_DISBURSEMENT`**: Recorded atomically when a refund transitions to `SUCCESSFUL`.
- **`COMPENSATING_ADJUSTMENT`**: Recorded for explicit manual or system financial adjustments.

### 4.2 Idempotency Contract
Each ledger entry is generated with a deterministic unique `idempotencyKey`:
- Payment Collections: `payment-ledger-${paymentId}`
- Refund Disbursements: `refund-ledger-${refundId}`

Database-level unique index `@@unique([idempotencyKey])` guarantees that repeated callbacks, retries, or worker executions will never create duplicate financial movements.

---

## 5. Automated Reconciliation Engine

The `ReconciliationStation` compares internal database records against authoritative provider states.

### 5.1 Discrepancy Classification

| Status Code | Description |
| :--- | :--- |
| `MATCHED` | Internal state, provider state, amounts, and ledger entries match perfectly. |
| `DISCREPANCY_AMOUNT` | Internal payment or refund amount differs from provider record or ledger total. |
| `DISCREPANCY_STATUS` | Internal status (e.g. `PAID`) contradicts provider status (e.g. `FAILED`). |
| `MISSING_PROVIDER_REF` | Internal state is `PAID` or `SUCCESSFUL`, but missing provider reference authority or ID. |
| `UNCONFIRMED_PROVIDER_STATE` | Provider verification failed due to network timeout or stuck `AMBIGUOUS` refund status. |

Reconciliation runs produce idempotent `ReconciliationRecord` entries for audit and manual review without silently altering historical ledger data.

---

## 6. API Specification & Authorization

All refund, ledger, and reconciliation endpoints strictly enforce tenant isolation (`gamingCenterId`) and Role-Based Access Control (RBAC).

| Endpoint | Method | Required Roles | Description |
| :--- | :--- | :--- | :--- |
| `/gamingCenters/:gamingCenterId/payments/:paymentId/refunds` | `POST` | `MANAGER`, `ADMIN` | Initiates full or partial refund request. Supports `Idempotency-Key` header. |
| `/gamingCenters/:gamingCenterId/payments/:paymentId/refunds/:refundId` | `GET` | `MANAGER`, `ADMIN`, `SUPERVISOR`, `STAFF` | Retrieves status and details of a specific refund. |
| `/gamingCenters/:gamingCenterId/payments/:paymentId/refunds` | `GET` | `MANAGER`, `ADMIN`, `SUPERVISOR`, `STAFF` | Lists all refund attempts for a payment. |
| `/gamingCenters/:gamingCenterId/payments/ledger` | `GET` | `MANAGER`, `ADMIN` | Retrieves paginated append-only financial ledger entries. |
| `/gamingCenters/:gamingCenterId/payments/reconcile` | `POST` | `MANAGER`, `ADMIN` | Triggers single payment or site-wide payment reconciliation. |

---

## 7. Database Migration & Schema

Defined in `sayra/prisma/migrations/20261206000000_add_refunds_and_ledger/migration.sql`:
- Enums: `RefundStatus`, `LedgerEntryType`, `ReconciliationStatus`.
- Tables: `Refund`, `LedgerEntry`, `ReconciliationRecord`.
- Foreign Keys: `CASCADE` on delete from parent `Payment` / `GamingCenter`.
- Indexes: `@@unique([gamingCenterId, idempotencyKey])` on `Refund`, `@@unique([idempotencyKey])` on `LedgerEntry`.
