# Phase 11 — Reservation Waitlist Technical Specification

## 1. Executive Summary

Phase 11 introduces a concurrency-safe, event-driven Reservation Waitlist module for the Sayra platform. The module allows eligible users to register interest in currently unavailable reservation slots on game stations and provides an automated, fair, and reliable workflow for offering newly available capacity.

Key guarantees:
- **Strict Unavailable Slot Verification:** Users can only register waitlist entries for slots that are currently booked or unavailable.
- **Deterministic FIFO Ordering:** Waitlist matching processes entries in exact order of creation (`createdAt ASC`).
- **Pessimistic Concurrency Controls:** Row locking (`FOR UPDATE`) on stations, waitlist entries, and waitlist offers prevents race conditions and double-booking.
- **Durable Offer Expiration:** Time-limited offers (default 15 minutes) automatically expire via background worker (`WaitlistExpiryWorker`) and synchronous checks upon acceptance.
- **Seamless Reservation Conversion:** Accepting an offer calculates prices, applies active dynamic discounts, creates a confirmed reservation, and logs reservation history.

---

## 2. Supported Waitlist Model

| Dimension | Attribute | Description |
|---|---|---|
| Site | `gamingCenterId` | Identifies the tenant organization. |
| Resource | `stationId` | Identifies the specific `GameStation`. |
| Time Window | `startTime`, `endTime` | UTC timestamps defining the requested reservation slot window. |
| Customer Reference | `customerAccountId`, `customerProfileId` | Linked to the core customer identity model. |
| Lifecycle State | `status` | `WaitlistStatus` enum representing current state. |

### Duplicate Entry Policy
A customer cannot have multiple `ACTIVE` waitlist entries for the exact same station and time slot. This is enforced at both the application level and the database level via a PostgreSQL partial unique index:
```sql
CREATE UNIQUE INDEX "WaitlistEntry_customer_station_time_active_key"
ON "WaitlistEntry"("customerAccountId", "stationId", "startTime", "endTime")
WHERE "status" = 'ACTIVE';
```

---

## 3. Lifecycle & Permitted State Transitions

### 3.1 WaitlistEntry Lifecycle (`WaitlistStatus`)
- **ACTIVE:** Waiting for a matching opportunity.
- **OFFERED:** An opportunity has been offered to the user (`WaitlistOffer` in `PENDING` state).
- **CONVERTED:** Terminal state. Offer was accepted and converted into a confirmed reservation.
- **CANCELLED:** Terminal state. Cancelled by user or administrative action.
- **EXPIRED:** Terminal state. Entry slot start time passed without offer conversion.
- **CLOSED:** Terminal state. Request terminated after offer rejection or manual closure.

### 3.2 WaitlistOffer Lifecycle (`WaitlistOfferStatus`)
- **PENDING:** Active offer waiting for customer response.
- **ACCEPTED:** Customer accepted the offer; converted to reservation.
- **REJECTED:** Customer explicitly rejected the offer.
- **EXPIRED:** Offer deadline passed without response.
- **CANCELLED:** Offer invalidated due to entry cancellation or slot reclamation.

---

## 4. Newly Available Opportunity Detection

Availability changes are detected in real-time via event emitter integration and supported by periodic background worker reconciliation:
1. **Reservation Cancellation:** `AppEvents.RESERVATION_CANCELED` triggers `waitlistStation.processAvailableSlot`.
2. **Reservation Rescheduling:** `AppEvents.RESERVATION_UPDATED` triggers `waitlistStation.processAvailableSlot` for the vacated time slot.
3. **Reservation Expiry:** `AppEvents.RESERVATION_EXPIRED` triggers waitlist matching for the freed slot.
4. **Offer Rejection / Expiration:** Re-triggers matching for the remaining slot window to offer to the next candidate in queue.

---

## 5. Background Processing & Worker Infrastructure

### `WaitlistExpiryWorker`
- Runs periodically (default poll interval: 60s, batch size: 50).
- Queries pending offers where `expiresAt <= now()`.
- Synchronously updates offer status to `EXPIRED`.
- Restores waitlist entry status to `ACTIVE` if requested start time is in the future, or `EXPIRED` if requested time has passed.
- Automatically re-triggers matching for the freed slot.

---

## 6. API Endpoints

### Customer Panel (`/api/v1/customer/waitlist`)
- `POST /` — Create a waitlist entry.
- `GET /` — List current customer's waitlist entries.
- `POST /entries/:entryId/cancel` — Cancel an active waitlist entry.
- `GET /offers` — List customer's waitlist offers.
- `POST /offers/:offerId/accept` — Accept offer and convert to reservation.
- `POST /offers/:offerId/reject` — Reject waitlist offer.

### Tenant Admin (`/api/v1/gamingCenters/:gamingCenterId/waitlist`)
- `GET /` — List all waitlist entries with status/date filters.
- `GET /offers` — List waitlist offers.
- `POST /entries/:entryId/cancel` — Admin cancellation of waitlist entry.
- `POST /process-matching` — Manually trigger waitlist matching.

### Public Endpoints (`/api/v1/public/gamingCenters/:slug/waitlist`)
- `POST /` — Public waitlist entry registration.
