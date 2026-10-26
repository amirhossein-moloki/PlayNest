# Play-Nest Operations & Reliability Analytics Report (Phase 5 / Operations)

## 1. Executive Summary & Domain Scope
This report documents the design, implementation, telemetry inventory, metrics, data quality controls, support SLA tracking, feature adoption metrics, and issue resolution matrix for the **Play-Nest Operations & Reliability Analytics** module.

This phase completes general quality rules of Phase 1 from a shared ownership perspective and establishes dedicated operational controls and observability endpoints for system reliability engineering and center management.

---

## 2. Telemetry Inventory & Data Source Limitations (موجودی منابع Telemetry و محدودیت‌ها)

| Source Domain | Primary Entity / Table | Telemetry Captured | Limitations & Constraints |
| :--- | :--- | :--- | :--- |
| **Background Jobs & Ingestion** | `AnalyticsIngestionRun`, `AnalyticsWatermark` | `entity`, `status`, `startedAt`, `completedAt`, `recordsRead`, `recordsIngested`, `durationMs`, `errorMessage` | Execution history tracked per batch cycle. Individual retry attempts within BullMQ queue memory are not persistently logged to DB unless batch fails. |
| **Notifications & Dispatches** | `NotificationLog` | `type`, `channel`, `recipient`, `status`, `attempts`, `lastError`, `scheduledAt`, `sentAt` | SMS gateway responses are stored asynchronously. PII (phone numbers) is masked on read (`0912***1234`). |
| **Customer Support & SLA** | `Ticket`, `TicketMessage` | `status`, `priority`, `category`, `createdAt`, `updatedAt`, `closedAt`, `senderType` | Response SLA calculated from first `SUPPORT` message. Resolution SLA calculated strictly for `CLOSED` tickets. Open tickets are never counted as resolved. |
| **System Security & Audits** | `AuditLog` | `action`, `entity`, `entityId`, `userId`, `createdAt`, `ipAddress` | Captures sensitive operations (settings update, manual refund/balance adjustment, cancellations). Excludes private credentials and tokens. |
| **Data Integrity & Reconciliation** | `Payment`, `LedgerEntry`, `Refund`, `WaitlistEntry` | `amount`, `currency`, `status`, `idempotencyKey`, `paymentState` | Financial postings and state transitions are verified via 8 deterministic read-only data quality checks without mutating operational tables. |
| **Product Feature Usage** | `WaitlistEntry`, `ReservationTimeProposal`, `Discount`, `GroupBooking`, `Rating` | Event timestamps, status transitions, usage counts | Distinguishes system feature availability from actual verified operator/customer adoption events. |

---

## 3. Key Metric Definitions & Invariants (تعریف شاخص‌ها و اصول کلیدی)

### A. Background Job Health Metrics
1. **`lastAttemptAt`**: Timestamp (`startedAt`) of the most recent execution attempt for a background job/worker, regardless of whether it succeeded or failed.
2. **`lastSuccessfulRunAt`**: Timestamp (`completedAt` or `startedAt`) of the most recent job run that completed with `status: "SUCCESS"`.
   - *Crucial Rule*: A failed attempt (`status: "FAILED"`) **MUST NOT** update or overwrite `lastSuccessfulRunAt`. `lastAttemptAt` and `lastSuccessfulRunAt` are strictly separated.
3. **`lagSeconds`**: Wall-clock seconds elapsed since `lastSuccessfulRunAt` (`Math.floor((now - lastSuccessfulRunAt) / 1000)`). If `lastSuccessfulRunAt` is `null`, `lagSeconds` returns `null`.
4. **`errorRate`**: `(failedRuns / totalRuns) * 100`.
5. **`status`**:
   - `NEVER_RUN`: No execution history recorded.
   - `FAILED`: Most recent execution attempt resulted in an unhandled error (`errorMessage` present).
   - `STALE`: `lagSeconds` exceeds the 120-minute SLA threshold (7,200 seconds).
   - `HEALTHY`: Last attempt succeeded and lag is within 120 minutes.

### B. Customer Support SLA Metrics
1. **`avgFirstResponseMinutes`**: Time elapsed between ticket creation (`Ticket.createdAt`) and the earliest response message by support staff (`TicketMessage.createdAt` where `senderType === 'SUPPORT'`).
2. **`avgResolutionMinutes`**: Time elapsed between ticket creation (`Ticket.createdAt`) and ticket closure (`Ticket.closedAt`).
   - *Strict Rule*: Calculated **ONLY** for tickets with `status === 'CLOSED'`. Active `OPEN`, `PENDING`, or `ANSWERED` tickets are **EXCLUDED** from resolution SLA metrics and are never reported as resolved zero.
   - *Negative Duration Protection*: `Math.max(0, closedAt - createdAt)` prevents negative durations caused by clock drift or timestamp anomalies.
   - *Timezone Awareness*: All ticket boundaries are calculated in Asia/Tehran standard time.

---

## 4. Data Quality Control Suite (کنترل‌های کیفیت داده)

The Operations Analytics engine executes 8 deterministic, read-only data quality checks:

| Check ID | Check Name | Domain | Severity | Owner / Responsible | Threshold | Reaction / Action Required |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`DQ-001`** | Confirmed Payment Missing Ledger Posting | Finance | HIGH | Finance Ops | 0 findings | Investigate payment collection ledger posting queue |
| **`DQ-002`** | Canceled Reservation with Unrefunded Paid Status | Reservation | HIGH | Reservation Ops Manager | 0 findings | Process refund or void payment for canceled booking |
| **`DQ-003`** | In-Progress Reservation Missing Active Session | Session | MEDIUM | Floor Supervisor | 0 findings | Verify station terminal start state |
| **`DQ-004`** | Duplicate Active Waitlist Entry | Waitlist | MEDIUM | Waitlist Controller | 0 findings | Consolidate duplicate active waitlist entries |
| **`DQ-005`** | Null Essential Fields in Completed Reservation | Reservation | HIGH | Data Engineering | 0 findings | Audit booking creation schema validation |
| **`DQ-006`** | Currency / Timezone Inconsistency in Financials | Finance | HIGH | Finance Ops | 0 findings | Reconcile transaction currency against center default |
| **`DQ-007`** | Orphan Rating without Completed Reservation | Rating | LOW | Customer Success | 0 findings | Review rating submission relation integrity |
| **`DQ-008`** | Analytics Pipeline Ingestion Watermark Lag | Pipeline | HIGH | Reliability Analytics Eng | Lag > 120m | Trigger backfill script or restart ingestion worker |

*Non-Mutation Policy*: All data quality checks are strictly read-only and deterministic. Operational source data is **NEVER** modified or deleted automatically by analytics checks.

---

## 5. Product Feature Adoption vs Availability

| Feature Key | Title | Availability | Adoption Criteria | Primary Event Metric |
| :--- | :--- | :--- | :--- | :--- |
| `RESERVATION_WAITLIST` | Reservation Waitlist | AVAILABLE | 1+ entries created in window | Waitlist conversion rate (%) |
| `TIME_PROPOSALS` | Reservation Time Proposals | AVAILABLE | 1+ proposals created in window | Proposal acceptance rate (%) |
| `DISCOUNTS_VOUCHERS` | Discounts & Voucher Campaigns | AVAILABLE | 1+ active campaigns | Discount penetration rate (%) |
| `GROUP_BOOKINGS` | Multi-Station Group Bookings | AVAILABLE | 1+ group bookings created | Total group stations booked |
| `CUSTOMER_RATINGS` | Post-Session Customer Ratings | AVAILABLE | 1+ ratings submitted | Average rating score (1-5 ★) |
| `NOTIFICATION_DISPATCH` | Automated Notifications | AVAILABLE | 1+ logs created | Failure rate (%) |

---

## 6. Operational Issue Matrix (ماتریس ارجاع و رسیدگی به خطاهای عملیاتی)

| Issue ID | Source Component | Description | Severity | Owner | Required Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`ISS-001`** | AnalyticsIngestionWorker | Pipeline watermark lag exceeds 120-minute threshold | HIGH | Analytics Reliability Eng | Check Redis connection, inspect worker logs, run `npm run backfill:analytics` |
| **`ISS-002`** | PaymentGatewayProvider / ZarinPal | Payment status is `PAID` but missing `PAYMENT_COLLECTION` ledger posting | HIGH | Finance Ops | Trigger `POST /financials/reconciliation/run` and record compensating ledger entry |
| **`ISS-003`** | ReservationStateEngine | Reservation is `CANCELED` but payment state remains `PAID` without refund | HIGH | Reservation Ops Manager | Audit cancellation reason and trigger provider refund or manual wallet credit |
| **`ISS-004`** | WaitlistExpiryWorker | Duplicate active waitlist entries exist for same customer/station/time | MEDIUM | Waitlist Controller | Cancel duplicate waitlist entry and notify customer |
| **`ISS-005`** | SMSWorker | High notification failure rate or provider delivery failure | MEDIUM | Communication Lead | Verify SMSIR API key validity, credit balance, and retry queue |
| **`ISS-006`** | CustomerSupportPanel | Open support tickets exceed SLA 120-minute first response target | LOW | Support Supervisor | Reassign pending tickets to available support staff on shift |

---

## 7. Open Business & Operations Decisions (موارد نیازمند تصمیم‌گیری)

1. **Attribution Window Policy**: Finalize whether marketing campaign attribution uses 7-day or 30-day last-touch window.
2. **Notification Retry Limit**: Determine if SMS retry attempts should be capped at 3 or 5 retries before moving to dead-letter queue.
3. **Data Quality Alert Routing**: Confirm whether `HIGH` severity data quality alerts should send webhook notifications to Slack/Teams or PagerDuty.

---

## 8. Contracts for Phase 6 Usage

The Operations & Reliability Analytics API endpoints are mounted at:
- `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/jobs`
- `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/errors`
- `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/data-quality`
- `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/support`
- `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/feature-adoption`
- `GET /api/v1/gamingCenters/:gamingCenterId/analytics/operations/issue-matrix`

All endpoints are protected by `authMiddleware`, `tenantGuard`, and `requireRole([UserRole.MANAGER, UserRole.ADMIN])`. All response data structures conform to Play-Nest standardized JSON response envelopes.
