# Reservation Tracking Code & Gaming Cafe Check-In Architecture and Design

## 1. Executive Summary

This document specifies the design, architecture, security model, and API contract for the **Reservation Tracking Code & Gaming Cafe Check-In** feature in `Sayra-Server`.

The feature enables a customer without internet access or a mobile data connection upon arrival to verbally communicate an unambiguous tracking code to gaming cafe staff. Staff verify the reservation details online using the administrative interface, inspect operationally necessary information, and execute atomic check-in transitions on the server.

Key capabilities:
- **Cryptographically Secure Tracking Code:** Server-generated 8-character uppercase string from an unambiguous 31-character alphabet (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`).
- **Database Uniqueness & Collision Protection:** Enforced by PostgreSQL `@unique` index on `Reservation.trackingCode` with safe repository collision retries.
- **Site Isolation & Cross-Site Enumeration Protection:** Staff lookup queries are strictly scoped to the staff member's authorized `gamingCenterId`. Non-existent codes or codes belonging to another gaming center return a uniform `404 Not Found` response.
- **Dedicated Rate Limiting:** Layered Redis-backed rate limiting (`trackingCodeLookupRateLimiter`) on lookup endpoints to prevent brute-force enumeration attacks.
- **Minimal Operational Data Exposure:** Lookup responses expose only data required for operational verification (status, local start/end times in site timezone, station name, customer display name, check-in eligibility). No sensitive customer contact or payment credentials are exposed.
- **Atomic Server-Side Check-In:** Server-side state transition from `CONFIRMED` to `IN_PROGRESS` (with `checkedInAt` timestamp and `checkedInByUserId`) executed inside `Prisma.$transaction` with pessimistic row locking (`SELECT FOR UPDATE`), audit logging, and `ReservationHistory` persistence.

---

## 2. Tracking Code Design & Security Analysis

### Alphabet & Formatting
- **Alphabet:** 31 unambiguous uppercase alphanumeric characters (`23456789ABCDEFGHJKMNPQRSTUVWXYZ`).
- **Excluded Visually Ambiguous Characters:** `0` (zero), `O` (uppercase letter O), `1` (one), `I` (uppercase letter I), `L` (uppercase letter L).
- **Code Length:** 8 characters (e.g. `K7M9P2R4`).
- **Input Normalization:** Trims whitespace, converts to uppercase, and strips non-alphanumeric characters or hyphens prior to database lookup (e.g., `"  k7m9-p2r4  "` -> `"K7M9P2R4"`).

### Entropy & Guesses Analysis
- **Code Space Size:** $31^8 = 852,891,037,441$ (approx. $8.53 \times 10^{11}$ combinations).
- **Effective Entropy:** $\log_2(31^8) \approx 39.63$ bits.
- **Guessing Risk & Compensating Controls:**
  - With `trackingCodeLookupRateLimiter` configured to max 30 lookup attempts per 15-minute window per client session/IP, an attacker submitting $30$ random guesses has a success probability of $\frac{30}{8.53 \times 10^{11}} \approx 3.5 \times 10^{-11}$.
  - Lookup requests require valid staff JWT authentication (`STAFF`, `MANAGER`, `SUPERVISOR`, `ADMIN`).

---

## 3. Workflow & State Transitions

### Check-In State Machine Integration
```
[ PENDING ] ---- (Confirmation) ----> [ CONFIRMED ] ---- (Check-In) ----> [ IN_PROGRESS ] ---- (Completion) ----> [ COMPLETED ]
     |                                      |                                  |
 (Expire)                                (Cancel)                           (Cancel)
     |                                      |                                  |
     v                                      v                                  v
[ EXPIRED ]                            [ CANCELED ]                       [ CANCELED ]
```

### Eligibility Matrix

| Reservation Status | Checked-In Flag | Eligible for Check-In? | Reason / Outcome |
|---|---|---|---|
| `CONFIRMED` | `checkedInAt == null` | **Yes** | Transition to `IN_PROGRESS`, set `checkedInAt = now()`, start session. |
| `IN_PROGRESS` | `checkedInAt != null` | **No** (Already Checked In) | Idempotent return of existing reservation record. |
| `PENDING` | `checkedInAt == null` | **No** | `409 Conflict` (Code: `CHECKIN_INELIGIBLE`) — "Reservation is pending confirmation." |
| `CANCELED` | Any | **No** | `409 Conflict` (Code: `CHECKIN_INELIGIBLE`) — "Reservation is canceled." |
| `EXPIRED` | Any | **No** | `409 Conflict` (Code: `CHECKIN_INELIGIBLE`) — "Reservation is expired." |
| `NO_SHOW` | Any | **No** | `409 Conflict` (Code: `CHECKIN_INELIGIBLE`) — "Reservation is marked as no-show." |
| `COMPLETED` | Any | **No** | `409 Conflict` (Code: `CHECKIN_INELIGIBLE`) — "Reservation is already completed." |

---

## 4. API Specification & Endpoints

### 1. Staff Reservation Lookup
- **Endpoint:** `POST /api/v1/gamingCenters/:gamingCenterId/reservation/lookup`
- **Headers:** `Authorization: Bearer <STAFF_JWT>`, `x-api-key: <STATIC_KEY>`
- **Request Body:**
  ```json
  {
    "trackingCode": "K7M9P2R4"
  }
  ```
- **Response `200 OK` Payload:**
  ```json
  {
    "success": true,
    "data": {
      "id": "clp6u7o00000108msh9v8k7g5",
      "trackingCode": "K7M9P2R4",
      "status": "CONFIRMED",
      "paymentState": "PAID",
      "startTime": "2026-12-15T14:00:00.000Z",
      "endTime": "2026-12-15T16:00:00.000Z",
      "siteTimezone": "Asia/Tehran",
      "localStartTime": "2026-12-15 17:30",
      "localEndTime": "2026-12-15 19:30",
      "station": {
        "id": "st-100",
        "name": "PC-VIP-01",
        "stationType": "PC"
      },
      "customer": {
        "displayName": "Ali Rezaei"
      },
      "checkedInAt": null,
      "isEligibleForCheckIn": true,
      "checkInIneligibilityReason": null
    }
  }
  ```

### 2. Staff Reservation Check-In
- **Endpoint:** `POST /api/v1/gamingCenters/:gamingCenterId/reservation/check-in`
- **Headers:** `Authorization: Bearer <STAFF_JWT>`, `x-api-key: <STATIC_KEY>`
- **Request Body:**
  ```json
  {
    "trackingCode": "K7M9P2R4"
  }
  ```
- **Response `200 OK` Payload:**
  Returns updated reservation object with `status: "IN_PROGRESS"`, `checkedInAt: "2026-12-15T14:02:10.123Z"`, and `checkedInByUserId: "usr-staff-1"`.

---

## 5. Database Schema & Migration

### Schema Modifications (`sayra/prisma/schema.prisma`)
```prisma
model Reservation {
  id String @id @default(cuid())
  ...
  trackingCode      String?   @unique
  checkedInAt       DateTime? @db.Timestamptz(6)
  checkedInByUserId String?
  checkedInBy       User?     @relation("ReservationCheckInStaff", fields: [checkedInByUserId], references: [id])
  ...
  @@index([gamingCenterId, trackingCode])
}
```

### Migration (`20261210000000_add_reservation_tracking_code_and_checkin`)
- Adds columns `"trackingCode" TEXT`, `"checkedInAt" TIMESTAMPTZ(6)`, and `"checkedInByUserId" TEXT`.
- Executes SQL backfill for existing records:
  ```sql
  UPDATE "Reservation"
  SET "trackingCode" = UPPER(SUBSTRING(MD5("id" || RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 8))
  WHERE "trackingCode" IS NULL;
  ```
- Creates `@unique` constraint `"Reservation_trackingCode_key"` and index `"Reservation_gamingCenterId_trackingCode_idx"`.

---

*Authored by Jules (Senior Software Architect & Backend Engineer) — Reservation Tracking Code & Check-In Architecture Deliverable.*
