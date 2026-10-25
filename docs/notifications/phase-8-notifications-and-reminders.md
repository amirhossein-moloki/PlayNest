# Phase 8 — Notifications and Reminders Architecture & Technical Implementation

## 1. Executive Summary

Phase 8 introduces a production-ready, reliable, and idempotent Notification & Reminder System into the `Sayra` modular monolith backend. The system orchestrates multi-channel notification dispatching (In-App notifications and SMS template messaging) for all domain-supported reservation and financial events while operating an automated background worker (`ReservationRemindersWorker`) that calculates upcoming reservation reminders with full UTC and timezone sensitivity.

All notification dispatches are managed via a persistent outbox log pattern (`NotificationLog`) featuring database-enforced idempotency key uniqueness, exponential backoff retries for transient failures, safe diagnostic sanitization, and automatic invalidation of obsolete reminders upon reservation rescheduling or cancellation.

---

## 2. Supported Domain Events & Delivery Channels

| Domain Event | Recipient | Delivery Channel | Idempotency Key Pattern | Delivery Policy | Failure Strategy |
|---|---|---|---|---|---|
| `RESERVATION_CREATED` | Customer & Gaming Center Manager/Staff | In-App & SMS | `res_created_sms:{reservationId}` | Best-Effort Outbox | Exponential backoff retry (up to 3 attempts) |
| `RESERVATION_CONFIRMED` | Customer & Gaming Center Manager/Staff | In-App & SMS | `res_confirmed_sms:{reservationId}` | Best-Effort Outbox | Exponential backoff retry |
| `RESERVATION_CANCELLED` | Customer & Gaming Center Manager/Staff | In-App & SMS | `res_canceled_sms:{reservationId}` | Best-Effort Outbox | Exponential backoff retry; invalidates reminders |
| `RESERVATION_TIME_PROPOSED` | Customer & Gaming Center Manager/Staff | In-App & SMS | `res_proposed_sms:{proposalId}` | Best-Effort Outbox | Exponential backoff retry; invalidates obsolete reminders |
| `RESERVATION_REMINDER` | Customer & Gaming Center Staff | In-App & SMS | `reminder:{reservationId}` | Scheduled Polled Outbox | State revalidation before send; skip if canceled/expired |
| `PAYMENT_SUCCESS` | Customer | In-App & SMS | `pay_success_sms:{paymentId}` | Best-Effort Outbox | Exponential backoff retry |
| `PAYMENT_FAILED` | Customer | In-App & SMS | `pay_failed_sms:{paymentId}` | Best-Effort Outbox | Exponential backoff retry |

---

## 3. Data Model & Outbox Persistence

The system adds the `NotificationLog` model and enum types (`NotificationChannel`, `NotificationDispatchStatus`, updated `NotificationType`) to `sayra/prisma/schema.prisma` and Prisma migration `20261208000000_add_notifications_outbox_and_reminders`:

```prisma
enum NotificationChannel {
  IN_APP
  SMS
  EMAIL
}

enum NotificationDispatchStatus {
  PENDING
  SENT
  FAILED
  CANCELLED
}

model NotificationLog {
  id             String                     @id @default(cuid())
  gamingCenterId String?
  userId         String?
  recipient      String
  channel        NotificationChannel        @default(SMS)
  type           NotificationType
  title          String?
  message        String                     @db.Text
  templateId     Int?
  parameters     Json?
  metadata       Json?
  status         NotificationDispatchStatus @default(PENDING)
  scheduledAt    DateTime                   @default(now()) @db.Timestamptz(6)
  sentAt         DateTime?                  @db.Timestamptz(6)
  attempts       Int                        @default(0)
  maxAttempts    Int                        @default(3)
  nextRetryAt    DateTime?                  @db.Timestamptz(6)
  lastError      String?                    @db.Text
  providerRefId  String?
  idempotencyKey String                     @unique

  entityType     String?
  entityId       String?

  createdAt      DateTime                   @default(now()) @db.Timestamptz(6)
  updatedAt      DateTime                   @updatedAt @db.Timestamptz(6)

  @@index([status, scheduledAt])
  @@index([status, nextRetryAt])
  @@index([entityType, entityId])
  @@index([idempotencyKey])
  @@index([gamingCenterId, createdAt])
}
```

---

## 4. Reliable Delivery, Backoff, & Diagnostics

### Idempotency Guarantee
- Every logical notification event generates a unique `idempotencyKey`.
- `createNotificationLog` catches PostgreSQL unique constraint collisions (`P2002`) on `idempotencyKey` and returns the existing log record without generating duplicate dispatches or messages.

### Exponential Backoff & Error Classification
- Exponential retry backoff delay is calculated as $60 \times 2^{\text{attempt}-1}$ seconds, capped at 3,600 seconds (1 hour).
- Errors are classified by `NotificationStation.classifyError`:
  - **Permanent Errors** (e.g. invalid phone number format, HTTP 400/422): Marked `FAILED` without `nextRetryAt` to prevent wasteful infinite retries.
  - **Transient Errors** (e.g. network drops, gateway timeouts, HTTP 5xx): Scheduled for retry at `nextRetryAt` up to `maxAttempts`.

### Safe Diagnostics Sanitization
- `NotificationStation.sanitizeDiagnostics` strips sensitive authorization tokens, API keys (`apiKey=[REDACTED]`), bearer tokens, passwords, and credit card numbers (`[CARD_REDACTED]`) before persisting failure diagnostic details in `NotificationLog.lastError`.

---

## 5. Reminder Scheduling Engine

The `ReservationRemindersWorker` poller runs periodically (configured via `RESERVATION_REMINDER_POLL_INTERVAL_MS`, default 10,000ms):

1. **Lead Time Window Query**:
   Queries active reservations (`CONFIRMED` or `PENDING`) starting between `now` and `now + RESERVATION_REMINDER_LEAD_TIME_MINUTES` (default 60 minutes).
2. **State Revalidation**:
   Before dispatching a reminder, re-checks that the reservation has not been `CANCELED`, `EXPIRED`, `NO_SHOW`, or `COMPLETED`.
3. **Timezone Awareness**:
   Converts UTC `startTime` to the gaming center's configured timezone (`Settings.timeZone` or `'UTC'`) for localized user message parameters.
4. **Obsolete Reminder Invalidation**:
   When a reservation is canceled or rescheduled, `invalidateObsoleteReminders(reservationId)` marks any pending or failed outbox records for that reservation as `CANCELLED`.

---

## 6. Operational Endpoints & Security

Mounted under `/api/v1/notifications`:

- `GET /api/v1/notifications`: Paginated in-app notifications for authenticated users.
- `GET /api/v1/notifications/unread-count`: Unread in-app notification count for authenticated user.
- `PATCH /api/v1/notifications/:id/read`: Mark notification as read.
- `GET /api/v1/notifications/logs`: Operational listing of outbox notification logs (Guarded by `requireRole([MANAGER, ADMIN])` and tenant boundary checking).
- `POST /api/v1/notifications/logs/:id/retry`: Operational endpoint to trigger a manual retry of a failed notification log (Guarded by `requireRole([MANAGER, ADMIN])`).
