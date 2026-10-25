# Phase 4 — Payment Integration Specification & Implementation

## 1. Overview & Architectural Design

Phase 4 introduces secure, resilient payment gateway integration for the Sayra Reservation Engine. It establishes a provider-neutral abstraction layer while implementing the ZarinPal REST API v4 adapter and a deterministic fake adapter for testing.

Key architectural highlights:
- **Clean Architecture & Separation of Concerns**: Isolates provider SDK / API transport logic behind the `IPaymentProvider` contract.
- **Strict Domain Boundary**: Payment status (`PaymentStatus`) and reservation status (`ReservationStatus` / `ReservationPaymentState`) remain strictly separate domain concerns.
- **Server-Side Price Integrity**: All monetary amounts are computed on the server from trusted persisted `Reservation.totalPrice` values. Client-supplied amounts or currencies are ignored.
- **Server-to-Server Verification**: Payments are verified strictly via direct server-to-server calls to provider verification endpoints (`/payment/verify.json`), never relying solely on browser redirect query parameters.
- **Idempotency & Concurrency Safety**: Both payment initiation (via `Idempotency-Key` and database constraints) and callback/webhook verification (via `IdempotencyRepo`) are fully idempotent.

---

## 2. Payment Provider Abstraction

### Contract Interface (`IPaymentProvider`)

```typescript
export interface IPaymentProvider {
  readonly name: string;
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
  verifyPayment(params: VerifyPaymentParams): Promise<VerifyPaymentResult>;
}
```

### Implementations

1. **`ZarinPalProvider`**:
   - Primary production provider for Iranian Rials (IRR) / Tomans.
   - Endpoint (`initiatePayment`): `POST /payment/request.json`
   - Verification (`verifyPayment`): `POST /payment/verify.json`
   - Handles response codes (`100` success, `101` already verified success, negative codes for gateway failure).

2. **`FakePaymentProvider`**:
   - Local development and automated test adapter.
   - Simulates authority creation and deterministic verification (authority strings containing `FAIL` test negative outcomes).

3. **`PaymentProviderFactory`**:
   - Resolves provider based on environment configuration (`DEFAULT_PAYMENT_PROVIDER`).
   - Production Safety Guard: Blocks instantiation of `FakePaymentProvider` when `NODE_ENV === 'production'`.

---

## 3. Payment State Model & Reservation State Interaction

### Payment State (`PaymentStatus`)
- `INITIATED`: Payment record created, pending customer redirection to gateway.
- `PENDING`: Redirection completed, awaiting callback or verification.
- `PAID`: Verified server-to-server as successful by payment provider.
- `FAILED`: Payment failed at gateway or verification rejected.
- `CANCELED`: Canceled by user or gateway.
- `REFUNDED`: Reserved for future administrative processing.

### Reservation Payment State (`ReservationPaymentState`)
- `UNPAID` → `PENDING` → `PAID` (or `FAILED` / `CANCELED`).

### Rules Governing State Transitions

1. **Payment Failure / Cancelation**:
   - Payment status set to `FAILED` or `CANCELED`.
   - Reservation payment state set to `FAILED` or `CANCELED`.
   - Reservation operational status is **NEVER** modified or confirmed.

2. **Payment Success on Active Reservation**:
   - Payment status set to `PAID`, `paidAt` timestamp populated, `referenceCode` recorded.
   - Reservation payment state set to `PAID`.
   - If reservation status was `PENDING`, operational status transitions to `CONFIRMED`.

3. **Payment Success on Terminal Reservation (`CANCELED` / `EXPIRED`)**:
   - Payment status recorded as `PAID` with `paidAt` and `referenceCode` for financial reconciliation audit.
   - Reservation operational status is **NOT** resurrected or changed back to `CONFIRMED`.
   - Logged with structured warning for reconciliation.

---

## 4. API Specification

### 1. Initiate Payment
- **Endpoint**: `POST /api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/init`
- **Headers**: `Authorization: Bearer <token>`, `Idempotency-Key: <key>`
- **Response** (`201 Created`):
```json
{
  "paymentId": "cuid...",
  "paymentStatus": "INITIATED",
  "providerPaymentId": "A00000000000000000000000000000000001",
  "checkoutUrl": "https://sandbox.zarinpal.com/pg/StartPay/A00000000000000000000000000000000001"
}
```

### 2. Verify Payment (Gateway Return / Callback)
- **Endpoint**: `GET /api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/verify?Authority=...&Status=OK`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
```json
{
  "success": true,
  "paymentId": "cuid...",
  "paymentStatus": "PAID",
  "referenceCode": "12345678"
}
```

### 3. Get Payment Status
- **Endpoint**: `GET /api/v1/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/status`
- **Headers**: `Authorization: Bearer <token>`
- **Response** (`200 OK`):
```json
{
  "paymentId": "cuid...",
  "status": "PAID",
  "amount": 50000,
  "currency": "IRR",
  "provider": "ZARINPAL",
  "referenceCode": "12345678",
  "reservationPaymentState": "PAID",
  "reservationStatus": "CONFIRMED",
  "createdAt": "2026-03-30T10:00:00.000Z",
  "paidAt": "2026-03-30T10:02:00.000Z"
}
```

---

## 5. Idempotency & Database Integrity

- Database constraints:
  - `@@unique([gamingCenterId, idempotencyKey])` on `Payment` table.
  - `@@unique([provider, providerPaymentId])` on `Payment` table prevents authority collisions.
- Duplicate processing prevention:
  - Re-verifying a payment that is already in `PAID` status returns the verified status immediately without re-triggering state updates or side effects.
