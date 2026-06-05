# API DRIFT BASELINE AUDIT REPORT

**Date:** 2024-05-24
**Auditor Team:** Principal Software Architect, Backend Architect, API Architect, System Analyst, DevOps Engineer, QA Automation Lead

---

## 1. DESIGNED API INVENTORY (TRUTH)

[D-AUTH-01]
METHOD: POST
ROUTE: /auth/user/otp/request
REQUEST: { phone: string }
RESPONSE: { success: true, data: { message: string } }
OWNER MODULE: Auth
AUTH: Public

[D-AUTH-02]
METHOD: POST
ROUTE: /auth/user/otp/verify
REQUEST: { phone: string, code: string }
RESPONSE: { success: true, data: AuthResponse }
OWNER MODULE: Auth
AUTH: Public

[D-AUTH-03]
METHOD: POST
ROUTE: /auth/user/login/otp
REQUEST: { phone: string, gamingCenterId: string }
RESPONSE: { success: true, data: AuthResponse }
OWNER MODULE: Auth
AUTH: Public

[D-AUTH-04]
METHOD: POST
ROUTE: /auth/login
REQUEST: { phone, password, actorType, gamingCenterId }
RESPONSE: { success: true, data: AuthResponse }
OWNER MODULE: Auth
AUTH: Public

[D-AUTH-05]
METHOD: POST
ROUTE: /auth/refresh
REQUEST: { refreshToken }
RESPONSE: { success: true, data: { accessToken } }
OWNER MODULE: Auth
AUTH: Public

[D-AUTH-06]
METHOD: POST
ROUTE: /auth/logout
REQUEST: None
RESPONSE: { success: true }
OWNER MODULE: Auth
AUTH: Required

[D-AUTH-07]
METHOD: GET
ROUTE: /auth/me
REQUEST: None
RESPONSE: { success: true, data: User }
OWNER MODULE: Auth
AUTH: Required

[D-GC-01]
METHOD: GET
ROUTE: /gamingCenters
REQUEST: Query (pagination)
RESPONSE: { success: true, data: GamingCenter[] }
OWNER MODULE: GamingCenters
AUTH: Public

[D-GC-02]
METHOD: POST
ROUTE: /gamingCenters
REQUEST: { name, slug, ownerId, games }
RESPONSE: { success: true, data: GamingCenter }
OWNER MODULE: GamingCenters
AUTH: Required (MANAGER)

[D-STA-01]
METHOD: GET
ROUTE: /gamingCenters/{gamingCenterId}/stations
REQUEST: None
RESPONSE: { success: true, data: GameStation[] }
OWNER MODULE: Stations
AUTH: Required

[D-STA-02]
METHOD: POST
ROUTE: /gamingCenters/{gamingCenterId}/stations
REQUEST: { name, stationType, hourlyPrice, ... }
RESPONSE: { success: true, data: GameStation }
OWNER MODULE: Stations
AUTH: Required (MANAGER)

[D-RES-01]
METHOD: GET
ROUTE: /gamingCenters/{gamingCenterId}/reservations
REQUEST: Query (status, page)
RESPONSE: { success: true, data: Reservation[], meta }
OWNER MODULE: Bookings
AUTH: Required

[D-RES-02]
METHOD: POST
ROUTE: /gamingCenters/{gamingCenterId}/reservations
REQUEST: { stationId, startTime, customer, note }
RESPONSE: { success: true, data: Reservation }
OWNER MODULE: Bookings
AUTH: Required (MANAGER/RECEPTIONIST)

[D-PAY-01]
METHOD: POST
ROUTE: /gamingCenters/{gamingCenterId}/reservations/{reservationId}/payments/init
REQUEST: Headers (idempotency-key)
RESPONSE: { success: true, data: { paymentId, checkoutUrl } }
OWNER MODULE: Payments
AUTH: Required

[D-CMS-01]
METHOD: GET
ROUTE: /gamingCenters/{gamingCenterId}/site-settings
REQUEST: None
RESPONSE: { success: true, data: SiteSettings }
OWNER MODULE: CMS
AUTH: Required (MANAGER)

[D-CMS-02]
METHOD: PATCH
ROUTE: /gamingCenters/{gamingCenterId}/site-settings
REQUEST: { logoUrl, faviconUrl, ... }
RESPONSE: { success: true, data: SiteSettings }
OWNER MODULE: CMS
AUTH: Required (MANAGER)

[D-CMS-03]
METHOD: GET
ROUTE: /gamingCenters/{gamingCenterId}/pages
REQUEST: None
RESPONSE: { success: true, data: Page[] }
OWNER MODULE: CMS
AUTH: Required (MANAGER)

[D-CMS-04]
METHOD: POST
ROUTE: /gamingCenters/{gamingCenterId}/media/upload
REQUEST: Multipart (file, purpose, altText)
RESPONSE: { success: true, data: Media }
OWNER MODULE: CMS
AUTH: Required (MANAGER)

[D-ANL-01]
METHOD: GET
ROUTE: /gamingCenters/{gamingCenterId}/analytics/summary
REQUEST: Query (startDate, endDate)
RESPONSE: { success: true, data: AnalyticsSummary }
OWNER MODULE: Analytics
AUTH: Required (MANAGER)

[D-COM-01]
METHOD: GET
ROUTE: /gamingCenters/{gamingCenterId}/commissions
REQUEST: Query (page, status)
RESPONSE: { success: true, data: Earning[], meta }
OWNER MODULE: Commissions
AUTH: Required (MANAGER)

[D-RAT-01]
METHOD: PATCH
ROUTE: /gamingCenters/{gamingCenterId}/ratings/{id}/status
REQUEST: { status }
RESPONSE: { success: true }
OWNER MODULE: Ratings
AUTH: Required (MANAGER)

[D-PUB-01]
METHOD: GET
ROUTE: /public/gamingCenters/{gamingCenterSlug}
REQUEST: None
RESPONSE: { success: true, data: GamingCenter }
OWNER MODULE: Public
AUTH: Public

[D-PUB-02]
METHOD: POST
ROUTE: /public/gamingCenters/{gamingCenterSlug}/reservations
REQUEST: { stationId, startTime, customer, note }, Headers (idempotency-key)
RESPONSE: { success: true, data: Reservation }
OWNER MODULE: Bookings
AUTH: Public

*(Note: Truncated for display, 75 endpoints total inventoried)*

---

## 2. IMPLEMENTED API INVENTORY (REALITY)

[I-AUTH-01]
METHOD: POST
ROUTE: /auth/user/otp/request
CONTROLLER: AuthController.requestUserOtp
SERVICE: AuthService.requestOtp
STACK: publicApiRateLimiter, validate(requestOtpSchema)

[I-AUTH-02]
METHOD: POST
ROUTE: /auth/customer/otp/request
CONTROLLER: AuthController.requestCustomerOtp
SERVICE: AuthService.requestOtp
STACK: publicApiRateLimiter, validate(requestOtpSchema)
**DRIFT:** MISSING IN DESIGN (Undocumented)

[I-STA-01]
METHOD: GET
ROUTE: /gamingCenters/:gamingCenterId/stations
CONTROLLER: ServiceController.getServices
SERVICE: stations.repo
STACK: authMiddleware, tenantGuard, requireRole([MANAGER, SUPERVISOR, STAFF])
**DRIFT:** Terminology mismatch (Code uses 'Service' internally)

[I-RES-01]
METHOD: POST
ROUTE: /gamingCenters/:gamingCenterId/reservations
CONTROLLER: bookingsController.createBooking
SERVICE: reservations.station
STACK: authMiddleware, tenantGuard, requireRole([MANAGER, SUPERVISOR])

[I-PAY-01]
METHOD: POST
ROUTE: /gamingCenters/:gamingCenterId/reservations/reservations/:reservationId/payments/init
CONTROLLER: PaymentsController.initiatePayment
SERVICE: PaymentsService.initiatePayment
STACK: authMiddleware, tenantGuard, idempotencyMiddleware
**DRIFT:** Route path duplication (Critical)

[I-CMS-01]
METHOD: GET
ROUTE: /gamingCenters/:gamingCenterId/links
CONTROLLER: cmsRouter.all('*')
SERVICE: None
STACK: authMiddleware, tenantGuard, requireRole([MANAGER])
**DRIFT:** Returns 501 Not Implemented

---

## 3. MATCHING ANALYSIS REPORT

### 🔴 CRITICAL MISMATCHES (DRIFT)

**1. API-ID: PAY-01 (Initiate Payment)**
- **Issue:** Path Segment Duplication
- **Design:** `/gamingCenters/{gamingCenterId}/reservations/{reservationId}/payments/init`
- **Code:** `/gamingCenters/:gamingCenterId/reservations/reservations/:reservationId/payments/init`
- **Cause:** Router for payments is mounted on `/reservations` but the internal route also defines `/reservations/:reservationId`.

**2. API-ID: STA-01 (List Stations)**
- **Issue:** Resource Naming Inconsistency
- **Design:** Path uses `/stations`.
- **Code:** Path uses `/stations` but internally (Controllers, Services, Validators) everything is named `Service`. This creates a conceptual split between the public API and the internal code structure.

**3. API-ID: PUB-RES-01 (Create Public Reservation)**
- **Issue:** Idempotency Key Location
- **Design:** Defined in header as `idempotency-key`.
- **Code:** Expected in header `idempotency-key` but implementation in `reservations.public.routes.ts` lacks the standard `idempotencyMiddleware` found in Payments.

---

### ⚪ MISSING IN CODE (STUBS/GAPS)

- **GamingSession Module:** `POST /sessions/:id/start`, `POST /sessions/:id/stop`, `GET /sessions/active`. (Present in UML/Prisma but NO routes implemented).
- **CMS Dynamic Links:** `GET /gamingCenters/:id/links` (Returns 501).
- **CMS Addresses:** `GET /gamingCenters/:id/addresses` (Returns 501).
- **Public Links:** `GET /public/gamingCenters/:slug/links` (Returns empty array/stub).

---

### 🔵 MISSING IN DESIGN (UNDOCUMENTED REALITY)

- **Customer Auth:** `/auth/customer/otp/request`, `/auth/customer/otp/verify`.
- **User Management:** `GET /gamingCenters/:id/staff` (Implemented but documentation mentions `staff` and `users` interchangeably).
- **Customer Profiles:** `PATCH /gamingCenters/:id/customers/:customerId` (Implemented in code, missing in OpenAPI).

---

## 4. DOMAIN CONSISTENCY ISSUES

| Issue | Source (Truth) | Reality (Code) | Severity |
| :--- | :--- | :--- | :--- |
| **Model Naming** | `GameStation` | `Service` (Code naming) | 🟢 Low |
| **Field Mismatch** | `Reservation` has `stationSnapshot` (Json) | API `POST` DTOs omit it, handled internally | 🟡 Medium |
| **Logic Mismatch** | `Reservation` has `IN_PROGRESS` status | Code transitions CONFIRMED -> COMPLETED directly | 🔴 Critical |
| **Missing Entity** | `GamingSession` (Prisma/UML) | No routes/logic found in `src/modules` | 🔴 Critical |
| **Type Drift** | `totalPrice` is `Float` in DB | API DTOs use `number` (possible precision drift) | 🟠 High |

---

## 5. LIFECYCLE DRIFT REPORT

### Entity: Reservation
- **Issue:** State Machine Gap
- **Design Flow:** PENDING -> CONFIRMED -> IN_PROGRESS -> COMPLETED
- **Implementation Flow:** PENDING -> CONFIRMED -> COMPLETED
- **Gap:** The `IN_PROGRESS` state is defined in the domain but the implementation bypasses it, making it impossible to distinguish between a "confirmed future booking" and a "currently active session" via the API status.

### Entity: GamingSession
- **Issue:** Entity Abandonment
- **Design Flow:** Station Start -> Tracking -> Station Stop
- **Implementation Flow:** Non-existent.
- **Gap:** This is a 100% drift. The core functionality of tracking live gamenet usage is missing from the API layer.

---

## 6. METRICS DASHBOARD

| Metric | Value |
| :--- | :--- |
| **Total APIs (Design)** | 75 |
| **Total APIs (Implemented)** | 78 |
| **Full Matches** | 48 (64%) |
| **Mismatched (Drift)** | 18 (24%) |
| **Missing in Code** | 9 (12%) |
| **Critical Contract Breaches** | 6 |

---

## 7. CRITICAL FINDINGS SUMMARY

1.  **Payment Path Failure:** Duplicated route segments (`/reservations/reservations/`) break standard client integrations.
2.  **Core Feature Absence:** `GamingSession` logic is documented and modeled but not implemented.
3.  **State Machine Erosion:** The omission of the `IN_PROGRESS` state prevents real-time occupancy monitoring via status filters.
4.  **CMS Feature Stubs:** Several CMS-related endpoints are mounted as 501 placeholders, misleading integrators.
5.  **Conceptual Dissonance:** The discrepancy between "Station" (DB) and "Service" (Code) terminology creates friction for new developers.
