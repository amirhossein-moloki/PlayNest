# Payments, Commission, Webhooks

## Payments

### Data Model

- `Payment` belongs to `Booking` and `GamingCenter`.
- Key fields: `provider`, `status`, `amount`, `currency`, `providerPaymentId`, `providerCheckoutId`, `idempotencyKey`.
- `PaymentStatus` enum: `INITIATED`, `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `VOID`, `CANCELED`.
- `PaymentProvider` enum: `MANUAL`, `STRIPE`, `ZARINPAL`.

### Payment Initiation Flow

Route: `POST /api/v1/gamingCenters/:gamingCenterId/bookings/:bookingId/payments/init`

1. Auth + role checks are enforced (`MANAGER`, `RECEPTIONIST`, `STAFF`).
2. `idempotencyMiddleware` requires `Idempotency-Key` header and stores request status in Redis.
3. `PaymentsService.initiatePayment`:
   - Ensures the booking exists.
   - Rejects if `Booking.paymentState` is `PAID`.
   - Creates a `Payment` record with provider `ZARINPAL` and `status=INITIATED`.
   - Returns a mock checkout URL.

### Payment State Machine

The state machine logic is centralized in `src/modules/payments/payments.state.ts` and enforced in `src/modules/payments/payments.repo.ts`.

- **Booking Transitions:**
  - `UNPAID` -> `PENDING` (When payment is initiated)
  - `PENDING` -> `PAID` (When payment is successful)
  - `PENDING` -> `FAILED` / `CANCELED` (When payment fails or is canceled)
- **Payment Transitions:**
  - `INITIATED` -> `PAID`
  - `INITIATED` -> `FAILED`
  - `INITIATED` -> `CANCELED`

### Decision (MVP Scope)

**Keep initiation mocked.** The current code creates a `Payment` with provider `ZARINPAL` and returns a sandbox checkout URL, while webhook handling is implemented to finalize `Payment.status` and `Booking.paymentState`. In a real-world scenario, the `initiatePayment` service would call the ZarinPal API to get a real `Authority` and redirect URL.

## Wallet & Refunds

- **Wallet System:** Every `CustomerAccount` has a `walletBalance`.
- **Automated Refunds:** When a booking is canceled or a payment is processed for an already-canceled booking, funds are automatically credited to the customer's wallet.
- **Transactions:** All wallet changes are recorded in the `WalletTransaction` model for auditability.
- **Usage:** Wallet balances can be used for future bookings (feature roadmap) or recorded as a store credit.

## Commission

### Data Model

- `GamingCenterCommissionPolicy` stores the policy per gamingCenter (PERCENT or FIXED).
- `BookingCommission` records the commission for a specific booking.
- `CommissionPayment` tracks payments against a commission.

### Calculation Rules

- **Source Filter:** Only `ONLINE` source bookings incur platform commissions. `IN_PERSON` bookings do not generate commission records.
- **Trigger:** Commissions are calculated when a booking is created or updated.
- **Settlement:**
  - For online payments (e.g., ZarinPal), commissions are automatically marked as `CHARGED` and a `CommissionPayment` is created upon successful payment.
  - For other bookings (e.g., online booking paid in-person), commissions remain `PENDING` until manually settled via the `payCommission` endpoint.

## Webhooks

### Payment Webhooks

Route: `POST /api/v1/webhooks/payments/:provider`

- Uses `express.json({ verify })` to capture the raw request body for signature verification.
- Requires `X-Signature` header.
- Signature verification uses HMAC SHA-256 with `PAYMENT_PROVIDER_WEBHOOK_SECRET`.
- Uses Redis for idempotency to ensure each webhook event is processed exactly once.
- On success, updates the `Payment` and `Booking` statuses atomically within a transaction.

### Fixes

- Fixed a bug where the webhook route was mounted under `/api/v1` twice, resulting in `/api/v1/api/v1/webhooks/...`. It is now correctly accessible at `/api/v1/webhooks/...`.

## Source of Truth

- `src/modules/commissions/commissions.service.ts`
- `src/modules/wallet/wallet.service.ts`
- `src/modules/payments/payments.routes.ts`
- `src/modules/payments/payments.controller.ts`
- `src/modules/payments/payments.service.ts`
- `src/modules/payments/payments.state.ts`
- `src/modules/payments/payments.repo.ts`
- `src/modules/webhooks/webhooks.routes.ts`
- `src/modules/webhooks/webhooks.service.ts`
- `src/modules/webhooks/middleware/verifyPaymentWebhookSignature.ts`
- `prisma/schema.prisma`
