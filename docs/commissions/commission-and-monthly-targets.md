# Sayra Commission Engine & Monthly Gaming Cafe Targets

## 1. Overview & Architecture

The Sayra Commission Engine manages per-gaming-cafe commission calculation and monthly paid-reservation target tracking. Each gaming cafe operates with independent commission rates and optional monthly reservation target caps.

### Technology Stack
- **Runtime:** Node.js (v20)
- **Framework:** Express
- **Database / ORM:** PostgreSQL + Prisma ORM
- **Timezone Utilities:** `date-fns-tz`

---

## 2. Business Rules & Financial Model

1. **Configurable Policy Per Gaming Cafe:**
   - **Commission Rate:** Basis points (`percentBps`, e.g., 1000 = 10.00%) or fixed amount (`fixedAmount`). Max percentage is capped by `maxPercentBps` (default 10000 = 100%). Negative rates are rejected.
   - **Monthly Target Count (`monthlyTarget`):** Non-negative integer representing the maximum number of distinct paid reservations that contribute commission per calendar month. `null` indicates an unlimited/disabled target cap.
   - **Zero-Target Behavior:** Setting `monthlyTarget = 0` indicates 0 reservations needed to reach target; therefore, the monthly target is reached immediately, and all subsequent eligible reservations receive **0 commission**.

2. **Base Price Before Discount:**
   - Commission is calculated exclusively from the reservation's **base price before discounts**, calculated as:
     $$\text{basePrice} = \text{totalPrice} + \text{discountAmount}$$
   - Discounts and customer checkout totals do not alter the commission basis.
   - Formula when commission applies:
     $$\text{commissionAmount} = \text{round}\left(\frac{\text{basePrice} \times \text{percentBps}}{10000}\right)$$
   - Minimum fee (`minimumFeeAmount`) is applied when configured.

3. **Monthly Target Period & Timezone Reset:**
   - Calendar month periods (e.g., `"2026-10"`) are determined using the gaming cafe's configured timezone (`Settings.timeZone`), falling back to `UTC` if unset or invalid.
   - Timestamps are persisted in UTC (`Timestamptz`), while calendar month boundaries are evaluated in local site time.

4. **Target Achievement & Commission Exemption:**
   - When a gaming cafe reaches its `monthlyTarget` count for the current calendar month, subsequent eligible reservations receive **zero commission** (`commissionAmount = 0`, `targetContribution = false`, `targetReached = true`).
   - Reaching the target does not alter prior accrued commissions or rewrite historical records.
   - Reaching the target does not alter the customer's reservation price or payment state.

5. **Refunds & Financial Integrity:**
   - Customer refund workflows operate independently from commission accounting.
   - Refunding a payment does not delete historical `Earning` records or decrement `targetContribution` counts unless explicit adjustment rules are introduced.

---

## 3. Concurrency, Locking & Idempotency

- **Row-Level Transaction Locking:**
  During payment processing, `commissionsStation.calculateCommission` executes within a database transaction and acquires a row lock:
  ```sql
  SELECT "id" FROM "CommissionPolicy" WHERE "gamingCenterId" = $1 FOR UPDATE;
  ```
  This serializes concurrent payment calculations for the same cafe, preventing race conditions near the monthly target boundary.
- **Persisted Idempotency:**
  The `Earning` model maintains a `@unique` constraint on `reservationId`. Retries or duplicate payment webhooks safely return the existing `Earning` record.

---

## 4. API Contracts

### Policy Configuration
- **`GET /api/v1/gamingCenters/{gamingCenterId}/commissions/policy`**
- **`POST / PUT /api/v1/gamingCenters/{gamingCenterId}/commissions/policy`**
  - **Payload:**
    ```json
    {
      "type": "PERCENT",
      "percentBps": 1000,
      "monthlyTarget": 50,
      "maxPercentBps": 10000,
      "applyToOnlineOnly": true
    }
    ```
  - **Access Control:** Restricted to `MANAGER` / `ADMIN` roles for the specific tenant (`gamingCenterId`).

### Monthly Target Progress
- **`GET /api/v1/gamingCenters/{gamingCenterId}/commissions/target-progress?targetPeriod=YYYY-MM`**
  - **Response:**
    ```json
    {
      "success": true,
      "data": {
        "gamingCenterId": "gc-1",
        "targetPeriod": "2026-10",
        "monthlyTarget": 50,
        "paidReservationCount": 32,
        "remainingCount": 18,
        "isTargetReached": false
      }
    }
    ```

### Earnings Report
- **`GET /api/v1/gamingCenters/{gamingCenterId}/commissions`**
  - Query parameters: `page`, `pageSize`, `status`, `targetPeriod`, `dateFrom`, `dateTo`.

---

## 5. Migration & Database Schema

Migration `20261209000000_add_commission_monthly_targets`:
```sql
ALTER TABLE "CommissionPolicy" ADD COLUMN "monthlyTarget" INTEGER,
ADD COLUMN "maxPercentBps" INTEGER NOT NULL DEFAULT 10000;

ALTER TABLE "Earning" ADD COLUMN "targetPeriod" TEXT,
ADD COLUMN "targetReached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "targetContribution" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "Earning_gamingCenterId_targetPeriod_idx" ON "Earning"("gamingCenterId", "targetPeriod");
```
