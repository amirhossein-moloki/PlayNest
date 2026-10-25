# Phase 10: Pricing, Discounts, and Service Packages Technical Architecture & Implementation Report

## 1. Executive Summary

This report documents the design, architecture, and implementation of **Phase 10: Pricing, Discounts, and Service Packages** in the `Sayra` backend modular monolith.

The goal of Phase 10 is to provide authoritative, tamper-proof server-side pricing, discount calculations, and price snapshot immutability across reservation creation, public online bookings, group bookings, rescheduling, and payment initiation workflows without compromising financial ledger integrity, payment correctness, or historical reservation records.

---

## 2. Pricing Architecture & Core Design Principles

### 2.1 Single Authoritative Calculation Path
All pricing and discount calculations are centralized in `discountsStation` (`sayra/src/modules/discounts/discounts.station.ts`). No client-submitted total price, discount amount, or hourly rate is ever trusted. Controllers remain thin, delegating all financial calculation and validation to domain service layers.

### 2.2 Domain Flow & Module Integration
```
[ Client Request ]
       │
       ▼
[ Reservation Controller / Public Booking Route ]
       │
       ▼
[ Reservation Station / Group Booking Station ]
       │
       ├─► Fetches Station (GameStation.hourlyPrice) & Duration (totalHours)
       │
       ├─► Evaluates Dynamic Discounts via `discountsStation.calculateApplicableDiscount`
       │     └─ Query Active Discounts (startAt <= resTime <= endAt, isActive=true)
       │     └─ Enforce Target Precedence (STATION > GAMING_CENTER)
       │     └─ Select Best Discount & Cap Amount at Base Price
       │
       ├─► Calculates Final Payable Price: Math.max(0, basePrice - discountAmount)
       │
       └─► Persists Reservation Record & Immutable `stationSnapshot`
             │
             ▼
      [ Payment Initiation (PaymentsStation.initiatePayment) ]
             └─ Locks Reservation Row
             └─ Reads Persisted `reservation.totalPrice` & Snapshot Currency
             └─ Dispatches Exact Snapshot Amount to Gateway Strategy (ZarinPal/Stripe/Fake)
```

---

## 3. Monetary Correctness & Rounding Conventions

1. **Server-Side Authority:** Payable totals are exclusively computed on the server. Request parameters specifying pricing parameters are rejected or ignored in favor of DB entity values (`GameStation.hourlyPrice`).
2. **Non-Negative Payable Total:** Payable total price is guarded by `Math.max(0, basePrice - discountAmount)`. Discounts cannot produce a negative total amount.
3. **Floating-Point & Decimal Precision:**
   - Discount calculations use floating-point arithmetic rounded to 2 decimal places (`Math.round(calculated * 100) / 100`).
   - Payment gateway amounts are converted to standard currency integer units (e.g. Rials/Tomans) using exact integer rounding (`Math.round(reservation.totalPrice)`).
4. **Currency Handling:**
   - Currency is captured in the station snapshot (`stationSnapshot.currency` defaulting to `'IRR'`).
   - Payment initiation enforces snapshot currency consistency across all transactions.

---

## 4. Discount Rules, Eligibility, and Target Precedence

### 4.1 Target Types & Precedence Hierarchy
- `STATION`: Discount applies directly to a specific `GameStation`.
- `GAMING_CENTER`: Discount applies globally across all stations in a `GamingCenter`.

**Precedence Policy:**
Station-level discounts take strict priority over Gaming Center-level discounts (`STATION > GAMING_CENTER`). If one or more active station-level discounts exist for a station at booking time, center-level discounts are excluded from evaluation.

### 4.2 Best Discount Selection & Stacking
- **No Stacking:** Only a single best discount is applied per reservation.
- **Maximum Yield:** Among eligible candidate discounts at the active target tier, the discount yielding the maximum monetary deduction is chosen automatically.
- **Value Capping:** Calculated discount amount is hard-capped at `basePrice` (`Math.min(basePrice, discountValue)`).

### 4.3 Validity Windows & Status Checks
- Discounts are eligible only if `isActive == true`, `startAt <= reservationStartTime`, and `endAt >= reservationStartTime`.
- Input validation on create/update enforces `startAt < endAt`, `value > 0`, and `PERCENTAGE <= 100%`.

---

## 5. Price Snapshot Immutability & Historical Integrity

1. **At Booking Time:**
   - Upon reservation or group booking creation, `totalHours`, `basePrice`, `discountAmount`, `discountId`, and final `totalPrice` are stored directly on the `Reservation` table.
   - An immutable JSON snapshot of station details (`stationSnapshot`) records `stationId`, `name`, `hourlyPrice`, and `currency`.
2. **Post-Booking Isolation:**
   - Future updates to a `GameStation.hourlyPrice` or `Discount` configuration do not retroactively alter an existing confirmed or pending reservation's charged amount.
3. **Payment Gateways:**
   - `PaymentsStation.initiatePayment` queries the persisted `reservation.totalPrice` snapshot and uses that exact amount for gateway checkout sessions.
   - Idempotent payment retries reuse the same locked reservation price snapshot.

---

## 6. Service Packages and Bundles

### 6.1 Current Scope & Implementation
Multi-station bookings are supported via the Group Booking engine (`GroupBooking` and `GroupBookingItem`), where multiple stations are booked atomically with individual price snapshots and discount evaluation per item.

### 6.2 Explicit Deferral Rationale
Standalone consumer service bundles (such as stored-value wallets, multi-visit punch cards, subscription packages, or food/beverage combination vouchers) are explicitly deferred.
- **Reason:** Stored-value wallets or entitlement subscription engines require dedicated balance ledger models, redemption state machines, and regulatory/financial policy decisions not present in current domain specifications.
- **Safety Strategy:** To prevent scope creep and financial inconsistency, standalone bundle purchase/redemption workflows are deferred to future dedicated release phases.

---

## 7. Authorization, Auditability, and Multi-Tenancy

1. **Role-Based Access Control (RBAC):**
   - Discount rule management (`CREATE`, `UPDATE`, `PATCH_STATUS`, `DELETE`) is restricted to administrative roles (`MANAGER`, `ADMIN`).
   - Non-authorized roles (`STAFF`, `TRAINEE`, `SUPPORT`) attempting discount mutations receive `403 FORBIDDEN`.
2. **Tenant Isolation:**
   - Enforced by `tenantGuard` middleware and Prisma `gamingCenterId` scope filtering on all queries and mutations.
3. **Audit Logging:**
   - All pricing rule creations, updates, and deletions trigger structured audit records via `auditService.log` with before/after state diffs (`DISCOUNT_CREATE`, `DISCOUNT_UPDATE`, `DISCOUNT_STATUS_UPDATE`, `DISCOUNT_DELETE`).

---

## 8. Database Architecture & Indexing

Existing Prisma models support Phase 10 requirements:
- `Discount` model indexed on `[gamingCenterId, isActive, startAt, endAt]` and `[gamingCenterId, targetType, targetId]`.
- `Reservation` model indexed on `[gamingCenterId, paymentState, startTime]` and `[status, expiresAt]`.
- Foreign keys set with `onDelete: Cascade` or `SetNull` to preserve financial audit trails.

---

## 9. Test Verification Summary

Phase 10 pricing and discount logic is verified by:
1. `sayra/tests/unit/modules/discounts/discounts.station.spec.ts` (Target precedence, discount calculation, CRUD validation).
2. `sayra/tests/api/discounts/discounts.api.spec.ts` (API routes, RBAC authorization, pagination, validation).
3. `sayra/tests/unit/modules/discounts/pricing.snapshot.spec.ts` (Monetary precision, rounding, snapshot immutability, payment integration, anti-tampering).

All 68 test suites in `sayra/` pass with zero failures.
