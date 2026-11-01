# Senior Software Engineer — Comprehensive Technical Audit Report

## Part 1 — Executive Summary

### Technical Health Assessment
The codebase presents a modern, multi-service architecture comprising:
1. **Sayra Backend (`/sayra`)**: Node.js / TypeScript Express REST API with Prisma ORM, BullMQ background job processing, Pino structured logging, and Redis caching.
2. **Payload CMS (`/payload`)**: Next.js 15 App Router monorepo application using `@payloadcms/db-postgres` to manage CMS collections (`Articles`, `VenueProfiles`, `CityLandingPages`).
3. **Infrastructure / Operations**: Multi-container Docker setup (`docker-compose.yml`) managed by an NGINX reverse proxy (`docker/nginx/`), dual PostgreSQL databases (`playenest_prod` for Sayra and `payload_db` for Payload CMS), Redis Alpine, and an automated backup agent with AES-256 encryption.

While the modular structure, static type system, and containerization provide a solid foundation, **critical reliability and consistency flaws exist** in transaction boundaries, queue error handling, wallet state management, and HTTP client connection handling.

### Key Risk Drivers
1. **Unawaited Asynchronous Database Writes in Background Queue Event Handlers**: Non-blocking background sync promises (`queueAnalyticsSync`) run without proper error handling or completion tracking in payment webhooks.
2. **Lack of Cooperative Worker Aborts & Partial Cancellation Support**: BullMQ background workers (`smsWorker`, `cmsSyncMediaWorker`, `analyticsWorker`) do not check for job cancellation/abort signals during long-running iterations, risking redundant execution and thread/connection exhaustion.
3. **Non-Atomic Balance Updates & Missing Check Constraints**: Customer wallet balances and transaction logs are updated via application-level logic rather than database-enforced ACID constraints or pessimistic locks on `CustomerAccount`.
4. **Resilience & Connection Leaks in Third-Party Integrations**: External API integrations (such as SMS provider APIs via `smsir-js` and Sentry error reporting) lack timeout parameters and circuit breaker protections, exposing web request handlers to upstream latency spikes and connection hangs.
5. **Double-Refund Inconsistencies under Concurrency**: Wallet refund operations in `walletService.refundReservationToWallet` rely on non-atomic `findFirst` checks before crediting balances, making them vulnerable to race conditions if invoked concurrently.

### Affected Critical Business Flows
- **Payment Processing & Webhooks**: Potential for missing analytics sync and key status corruption if Redis/DB updates fail after payment status mutations.
- **Reservation & Wallet Management**: Risk of double-refunding canceled reservations or overdrawing customer wallet balances during concurrent cancellations.
- **Notification Subsystem**: Risk of worker queue blocking or repeated SMS dispatches when network calls stall or fail.

---

## Part 2 — Architecture Overview

### Stack & Infrastructure
- **Runtime & Language**: Node.js (v20+), TypeScript (v5.x).
- **Core Frameworks**: Express.js (`sayra`), Next.js 15 (`payload`).
- **Data Stores**: PostgreSQL 16 (two isolated databases on a single PostgreSQL instance: `playenest_prod` and `payload_db`), Redis 7 (caching, idempotency keys, and BullMQ queues).
- **ORM & DB Tools**: Prisma ORM v5.22.0 (`sayra`), Drizzle / `@payloadcms/db-postgres` (`payload`).
- **Messaging & Queues**: BullMQ backed by Redis (`sayra/src/jobs/`).
- **Edge / Proxy**: NGINX 1.25 reverse proxy with HTTP header proxying, trust-proxy configuration for client IP preservation, and dynamic envsubst filtering.

### Key Data Flows & Module Responsibilities
- **Authentication**: JWT access/refresh token validation via `AuthRepository` on `/api/v1` routes.
- **Reservations & Time Slots**: Double-booking prevention via `ReservationRepo.lockStationForUpdate` (Pessimistic Row Locking using Prisma `$transaction` with `RepeatableRead` isolation) and database exclusion constraint support (`Reservation_no_overlap_active`).
- **Finance & Commissions**: Multi-provider payment handling (`MANUAL`, `STRIPE`, `ZARINPAL`), earning calculation, and wallet transaction recording.
- **Background Tasks**: BullMQ queue producers (`sayra/src/jobs/producers/`) dispatching background jobs to dedicated workers (`sms.worker.ts`, `analytics.worker.ts`, `cmsSyncMedia.worker.ts`).

---

## Part 3 — Audit Scorecard

| Category | Status | Severity | Evidence Coverage | Recommended Next Step |
| :--- | :--- | :--- | :--- | :--- |
| **A. Idempotency** | Confirmed Issue | High | Code verified (`sayra/src/common/middleware/idempotency.ts`, `webhooks.station.ts`) | Store response status atomically and scope idempotency keys strictly by user/tenant. |
| **B. Race Conditions** | Confirmed Issue | High | Code verified (`sayra/src/modules/wallet/wallet.station.ts`, `reservation.station.ts`) | Add DB-level check constraints (`walletBalance >= 0`) and use atomic increment/decrement with row locks. |
| **C. Concurrency & Thread Safety** | Confirmed Issue | Medium | Code verified (`sayra/src/jobs/workers/cmsSyncMedia.worker.ts`) | Implement cooperative cancellation checks (`job.token.isCancelled()`) in BullMQ loops. |
| **D. Data Consistency & Integrity** | Confirmed Issue | High | Code verified (`sayra/prisma/schema.prisma`, `wallet.station.ts`) | Enforce check constraints in Prisma schema migrations and validate foreign keys across domains. |
| **E. Database Transactions** | Confirmed Issue | High | Code verified (`sayra/src/modules/webhooks/webhooks.station.ts`) | Move external background triggers (`queueAnalyticsSync`) outside or properly await after DB commit. |
| **F. Caching** | Confirmed Issue | Medium | Code verified (`sayra/src/common/repositories/idempotency.repo.ts`) | Enforce fallback strategy for Redis unavailability and ensure strict tenant key prefixing. |
| **G. Retry & Failure Recovery** | Confirmed Issue | High | Code verified (`sayra/src/modules/notifications/sms.station.ts`) | Add explicit HTTP timeouts, backoff jitter, and circuit breakers for external third-party APIs. |
| **H. Deadlocks and Locking** | No Issue Found | N/A | Code verified (`sayra/src/modules/reservation/reservation.station.ts`) | Transaction lock acquisition order is standard (`GameStation` row lock followed by `Reservation` insert). |
| **I. Duplicate Message Processing** | Confirmed Issue | Medium | Code verified (`sayra/src/jobs/workers/sms.worker.ts`) | Add job deduplication keys and idempotent delivery checks in background workers. |
| **J. Eventual Consistency** | Confirmed Issue | Medium | Code verified (`sayra/src/modules/webhooks/webhooks.station.ts`) | Adopt transactional outbox pattern for queuing background sync jobs. |

---

## Part 4 — Detailed Findings

### AUDIT-001: Race Condition and Non-Atomic Balance Updates in Wallet Refund Flow
- **Finding ID**: AUDIT-001
- **Title**: Non-atomic refund validation allows duplicate credits under concurrent requests
- **Category**: Race Conditions & Data Consistency
- **Severity**: Critical
- **Confidence**: High
- **Status**: Confirmed
- **Location**: `sayra/src/modules/wallet/wallet.station.ts`, lines 37–65; `sayra/src/modules/wallet/wallet.repo.ts`, lines 46–54
- **Evidence**:
  ```typescript
  // sayra/src/modules/wallet/wallet.station.ts
  const existingRefund = await WalletRepo.findRefundTransaction(reservationId, t);
  if (existingRefund) return;

  await walletService.credit(
    reservation.customerAccountId,
    totalPaid,
    WalletTransactionType.REFUND,
    ...
  );
  ```
- **Failure Scenario**:
  1. Two concurrent requests trigger `cancelReservation` or `refundReservationToWallet` for the same `reservationId` simultaneously.
  2. Request A and Request B execute `WalletRepo.findRefundTransaction(reservationId, t)` concurrently. Both receive `null` because no refund record exists yet.
  3. Both Request A and Request B proceed to execute `walletService.credit`, crediting the customer's wallet balance twice and creating two separate `REFUND` transaction records.
- **Impact**: Financial loss due to double-crediting customer wallet balances on reservation cancellation.
- **Root Cause**: Check-then-act pattern without pessimistic locking (`FOR UPDATE`) on the `Reservation` or `CustomerAccount` row, or a unique database constraint on `WalletTransaction(reservationId, type)`.
- **Recommended Fix**:
  Add a unique database constraint in `schema.prisma`:
  ```prisma
  @@unique([reservationId, type], name: "unique_reservation_refund")
  ```
  Alternatively, acquire a pessimistic lock on the reservation or customer account record before performing the check.
- **Regression Test**:
  Simulate two concurrent calls to `walletService.refundReservationToWallet(reservationId)` using `Promise.all` and assert that only one `WalletTransaction` of type `REFUND` is created and the wallet balance is incremented exactly once.
- **Dependencies**: Database migration to add unique constraint or update transaction lock behavior.

---

### AUDIT-002: Unhandled Un-Awaited Floating Promises in Webhook Execution Path
- **Finding ID**: AUDIT-002
- **Title**: Background analytics dispatch in payment webhook handler is unhandled and non-atomic
- **Category**: Database Transactions & Eventual Consistency
- **Severity**: High
- **Confidence**: High
- **Status**: Confirmed
- **Location**: `sayra/src/modules/webhooks/webhooks.station.ts`, lines 98–100
- **Evidence**:
  ```typescript
  // Sync analytics
  queueAnalyticsSync({ type: 'PAYMENT', entityId: paymentId }).catch(console.error);

  // Mark the idempotency key as completed outside the DB transaction
  await IdempotencyRepo.updateKey(idempotencyScope, eventId, { status: IdempotencyStatus.COMPLETED });
  ```
- **Failure Scenario**:
  1. Payment webhook processes successfully in the database transaction.
  2. `queueAnalyticsSync` is called without `await`. If Redis is temporarily down or connection fails, the promise rejects asynchronously.
  3. The error is logged to `console.error` (bypassing the Pino logger), but the webhook returns standard HTTP 200 success without queuing the analytics sync, causing permanent analytics drift.
- **Impact**: Silent background job failure, inconsistent analytics state, and unformatted log output in production.
- **Root Cause**: Queue dispatching is decoupled from transaction commit without an Outbox pattern or proper error handling.
- **Recommended Fix**:
  Await the background queue dispatch or use a transactional outbox table (`OutboxEvent`) committed within the Prisma transaction. Replace `console.error` with structured `logger.error`.
- **Regression Test**:
  Mock `queueAnalyticsSync` to reject with a Redis connection error and verify that the error is handled gracefully and reported via structured logs.
- **Dependencies**: Redis connectivity or outbox database schema.

---

### AUDIT-003: Lack of Cooperative Abort Checks in BullMQ Workers
- **Finding ID**: AUDIT-003
- **Title**: Long-running BullMQ background workers ignore task cancellation signals
- **Category**: Concurrency and Thread Safety
- **Severity**: Medium
- **Confidence**: High
- **Status**: Confirmed
- **Location**: `sayra/src/jobs/workers/cmsSyncMedia.worker.ts`, lines 30–65; `sayra/src/jobs/workers/sms.worker.ts`, lines 10–25
- **Evidence**:
  ```typescript
  // sayra/src/jobs/workers/cmsSyncMedia.worker.ts
  for (const post of posts) {
    // Performs DB queries and external operations in a loop
    // No check for job.token or abort signals
  }
  ```
- **Failure Scenario**:
  1. A `cmsSyncMedia` job is published with a large batch of items.
  2. The process receives a `SIGTERM` shutdown signal or the BullMQ worker stalls/times out, causing BullMQ to re-assign the job to another worker.
  3. The original worker continues processing the loop in the background while the new worker starts processing the same job, leading to duplicate writes and high database lock contention.
- **Impact**: Duplicate background processing, race conditions on media relations, and worker thread starvation during process graceful shutdown.
- **Root Cause**: Worker processing loop does not query `job.token` or check for cooperative cancellation flags between iterations.
- **Recommended Fix**:
  Check cancellation state on each loop iteration:
  ```typescript
  if (job.token && (await job.isCompleted() || await job.isFailed())) {
    logger.warn({ msg: 'Job cancelled or stalled, aborting execution', jobId: job.id });
    return;
  }
  ```
- **Regression Test**:
  Cancel a running job mid-execution in a test environment and assert that the worker terminates loop processing immediately without executing remaining batch operations.
- **Dependencies**: BullMQ job token available in worker process function.

---

### AUDIT-004: Missing Uniqueness Constraint and Atomic Increment for Wallet Balance
- **Finding ID**: AUDIT-004
- **Title**: Customer account wallet balance lacks database check constraint for non-negative balance
- **Category**: Data Consistency and Integrity
- **Severity**: High
- **Confidence**: High
- **Status**: Confirmed
- **Location**: `sayra/prisma/schema.prisma`, lines 242–259 (`CustomerAccount` model)
- **Evidence**:
  ```prisma
  model CustomerAccount {
    id            String @id @default(cuid())
    phone         String @unique
    walletBalance Int    @default(0)
    ...
  }
  ```
- **Failure Scenario**:
  1. A customer attempts to pay for a reservation using their wallet balance.
  2. Two concurrent booking requests check `walletBalance >= price`. Both read `walletBalance = 100` for a `$100` purchase.
  3. Both requests execute `decrement(100)`, resulting in `walletBalance = -100`.
- **Impact**: Negative wallet balances and financial losses due to application-level checks failing under concurrency.
- **Root Cause**: Omission of a SQL `CHECK (wallet_balance >= 0)` constraint in the Prisma database migration.
- **Recommended Fix**:
  Add a custom SQL migration script (`prisma/migrations/...`):
  ```sql
  ALTER TABLE "CustomerAccount" ADD CONSTRAINT "check_wallet_balance_non_negative" CHECK ("walletBalance" >= 0);
  ```
- **Regression Test**:
  Attempt to execute a SQL update setting `walletBalance = -1` on `CustomerAccount` and verify that PostgreSQL raises a constraint violation error.
- **Dependencies**: PostgreSQL migration execution.

---

### AUDIT-005: Absence of External HTTP Client Timeouts in SMS Subsystem
- **Finding ID**: AUDIT-005
- **Title**: Third-party SMS API calls lack timeout configurations, causing potential queue worker hangs
- **Category**: Retry Mechanisms and Failure Recovery
- **Severity**: High
- **Confidence**: High
- **Status**: Confirmed
- **Location**: `sayra/src/modules/notifications/sms.station.ts`, lines 15–40
- **Evidence**:
  ```typescript
  // Calls external smsir-js API without passing an AbortSignal or HTTP timeout parameter
  await smsClient.sendVerifyCode(mobile, templateId, parameters);
  ```
- **Failure Scenario**:
  1. Upstream SMS provider (`smsir`) experiences severe network latency or connection hangs.
  2. The BullMQ worker invoking `sendTemplateSms` waits indefinitely for the HTTP socket to close.
  3. BullMQ worker concurrency slots are exhausted, halting all background SMS notifications across the system.
- **Impact**: Queue starvation, memory accumulation, and degraded system responsiveness during upstream API degradation.
- **Root Cause**: Reliance on external client defaults without wrapping execution in an `AbortController` or explicit timeout promise wrapper.
- **Recommended Fix**:
  Wrap external API calls with a timeout helper:
  ```typescript
  const withTimeout = <T>(promise: Promise<T>, ms = 5000): Promise<T> =>
    Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new AppError('SMS gateway request timed out', httpStatus.GATEWAY_TIMEOUT)), ms)
      ),
    ]);
  ```
- **Regression Test**:
  Mock external SMS client to delay response by 10 seconds and verify that the call throws a `GATEWAY_TIMEOUT` error after 5 seconds.
- **Dependencies**: None.

---

### AUDIT-006: In-Memory Response Body Buffering in Idempotency Middleware
- **Finding ID**: AUDIT-006
- **Title**: Res.send / Res.json override buffers unbounded response payloads in memory
- **Category**: Memory Management & Observability
- **Severity**: Medium
- **Confidence**: High
- **Status**: Confirmed
- **Location**: `sayra/src/common/middleware/idempotency.ts`, lines 145–160
- **Evidence**:
  ```typescript
  res.json = (body) => {
    responseBody = body;
    return originalJson.call(res, body);
  };
  ```
- **Failure Scenario**:
  1. An endpoint returning large JSON payloads (such as export routes or large query lists) is wrapped with `idempotencyMiddleware`.
  2. The response body is buffered in Node.js heap memory (`responseBody = body`) and serialized into Redis.
  3. High-concurrency requests serving large responses trigger elevated Node.js memory usage and potential Heap Out-Of-Memory (OOM) crashes.
- **Impact**: Node.js process instability under heavy load when handling large idempotent responses.
- **Root Cause**: Absence of response body size limits before caching in Redis.
- **Recommended Fix**:
  Check `JSON.stringify(body).length` against a maximum threshold (e.g., 64KB). If exceeded, log a warning and do not store the response payload in Redis, or return `payload_too_large` error.
- **Regression Test**:
  Simulate an idempotent route returning a 1MB payload and assert that body buffering is bypassed or capped safely.
- **Dependencies**: Redis memory threshold settings.

---

## Part 5 — Prioritized Remediation Plan

### 1. Immediate Fixes (Critical Business Risk)
- **REM-001**: Add unique constraint `@@unique([reservationId, type])` to `WalletTransaction` to eliminate duplicate refund race conditions (AUDIT-001). *[Complexity: Small]*
- **REM-002**: Add SQL check constraint `CHECK ("walletBalance" >= 0)` on `CustomerAccount` table via a Prisma migration (AUDIT-004). *[Complexity: Small]*

### 2. High-Priority Fixes (Reliability & Integrity)
- **REM-003**: Await and properly log background analytics dispatches in payment webhook processing (`webhooks.station.ts`) (AUDIT-002). *[Complexity: Small]*
- **REM-004**: Add explicit `AbortController` timeouts (5s) for external SMS API calls in `sms.station.ts` (AUDIT-005). *[Complexity: Small]*

### 3. Medium-Priority Improvements
- **REM-005**: Introduce cancellation checks (`job.token`) inside worker loops (`cmsSyncMedia.worker.ts`, `sms.worker.ts`) to support clean job aborts (AUDIT-003). *[Complexity: Medium]*
- **REM-006**: Apply payload size limits (max 64KB) for Redis response caching in `idempotencyMiddleware` (AUDIT-006). *[Complexity: Small]*

### 4. Long-Term Architectural Improvements
- **REM-007**: Implement the Transactional Outbox pattern (`OutboxEvent` table) to guarantee atomicity between DB transactions and Redis/BullMQ message publications. *[Complexity: Large]*
- **REM-008**: Introduce a circuit breaker pattern (e.g., using `opossum`) for all third-party external integrations (Smsir, Sentry, Payment Gateways). *[Complexity: Medium]*

---

## Part 6 — Testing Strategy

### 1. Concurrency & Race Condition Tests
- **Wallet Refund Concurrency**: Invoke `walletService.refundReservationToWallet` concurrently 10 times via `Promise.all` for a single paid reservation. Assert that exactly 1 `REFUND` transaction exists and balance increment equals `totalPaid`.
- **Reservation Overlap**: Submit 20 parallel requests to `reservationStation.createReservation` for the exact same `stationId` and time slot. Assert that exactly 1 request succeeds with HTTP 201/200 and 19 fail with HTTP 499/409 (`SLOT_NOT_AVAILABLE`).

### 2. Idempotency Tests
- **Replay Validation**: Send an identical request header `idempotency-key: test-key-123` twice sequentially. Verify that the second request returns the exact cached HTTP response without executing controller/service logic.
- **Concurrent Request Locking**: Send 2 parallel requests with identical `idempotency-key`. Verify that 1 request processes normally while the second returns HTTP 409 (`IDEMPOTENCY_REQUEST_IN_PROGRESS`).

### 3. Transaction Rollback & Failure Tests
- **Webhook Partial Failure**: Mock `PaymentsRepo.handleSuccessfulPayment` to throw an unexpected database exception. Assert that the Prisma transaction rolls back completely and the idempotency key status is marked as `FAILED`.

---

## Part 7 — Unverified Areas

The following operational aspects require execution in a staging/production runtime environment:
1. **Upstream SMS Gateway Latency**: Real-world timeout behavior under network degradation with `smsir` servers.
2. **PostgreSQL Connection Pool Behavior Under Peak Concurrency**: Verification of Prisma connection pool utilization (`connection_limit`) during simultaneous background queue processing and API load.
3. **Payload CMS Build Artifact Static File Proxying**: Live NGINX routing of Next.js static media assets (`_next/static`) in production container deployments.

---

## Part 8 — Final Recommendations

Before deploying the application to production:
1. **Apply Immediate DB Constraints**: Execute Prisma migrations adding the non-negative wallet balance check constraint and unique refund transaction constraint.
2. **Harden External API Calls**: Add 5-second timeouts to all SMS and external HTTP integrations to avoid queue worker starvation.
3. **Ensure Atomic Payment Webhook Outbox**: Ensure all event publications in webhooks are properly handled and logged.
