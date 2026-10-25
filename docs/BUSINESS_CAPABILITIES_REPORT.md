# PlayeNest Backend Business Capabilities & Feature Inventory Report

This report presents a business-oriented inventory of features, workflows, and capabilities implemented across the backend repository. It translates technical structures (routes, controllers, models) into user-facing capabilities for frontend developers, product managers, and UI engineers.

---

## A. Product Overview

**PlayeNest** is a multi-tenant Gaming Center (Game Net / Esports Lounge) Management and Online Reservation Platform.

The backend enables:
1. **Gaming Center Operations Management:** Single and multi-branch configuration, operating hours, seating/station management (PCs, PlayStations, Xboxes, VR), staff scheduling, and live gaming session control.
2. **Customer Self-Service & Reservation Portal:** Real-time slot availability lookup, online reservation booking with automated conflict checking, post-play ratings, support ticket submission, and reschedule proposal negotiation.
3. **Billing, Payments & Discounts:** Integrated online payments via ZARINPAL with asynchronous webhook settlement, automated customer wallet refunding, customizable percent or fixed-amount discount rules with precedence logic, and partner revenue commission tracking.
4. **Content Management & Public CMS:** Landing page builder with dynamic section templates, image/media asset library (Local & S3 storage), multi-author blog publishing system (posts, series, categories, tags, moderated nested comments, emotional reactions, and dynamic header/footer navigation).
5. **Support & Operational Intelligence:** Multi-role support ticket desk (`USER`, `SUPPORT`, `ADMIN`), automated queued SMS and in-app notifications, revenue/occupancy/staff/station analytics, and audit log diff tracking.

---

## B. Business Feature Catalog

| ID | Business Capability / Feature Name | Business Description | Supported Actors | Implementation Status | Core Repository Evidence |
|---|---|---|---|---|---|
| **F-001** | **Gaming Center Identity & Branch Setup** | Configure gaming center profiles, business hours, hourly rates, food services, social links, addresses, and operational rules. | `MANAGER`, `ADMIN` | **Fully Implemented** | `src/modules/gamingCenter/`, `src/modules/settings/` |
| **F-002** | **Game Station & Hardware Management** | Catalog gaming stations by platform type (PC, PlayStation, Xbox, Switch, VR), VIP tier, hourly rates, rental durations, and maintenance status. | `MANAGER`, `SUPERVISOR`, `STAFF` | **Fully Implemented** | `src/modules/station/` |
| **F-003** | **Real-Time Slot Availability Engine** | Query available time slots per station considering operating hours, current reservations, lead times, and increment constraints. | `PUBLIC` (Unauthenticated) | **Fully Implemented** | `src/modules/availability/` |
| **F-004** | **In-Person & Online Slot Reservation** | Create reservations (Walk-in, Phone, Online) with automated double-booking prevention, total pricing snapshot, and status tracking. | `CUSTOMER`, `STAFF`, `SUPERVISOR`, `MANAGER` | **Fully Implemented** | `src/modules/reservation/` |
| **F-005** | **Reservation Reschedule Negotiation** | Propose time adjustments for existing bookings by staff or customer with automatic slot availability validation upon acceptance. | `STAFF`, `SUPERVISOR`, `MANAGER`, `CUSTOMER` | **Fully Implemented** | `src/modules/reservation/`, `src/modules/customer-panel/` |
| **F-006** | **Active Gaming Session Tracking** | Live session monitoring with Start, Pause, Resume, and Stop controls for on-station play tracking actual billable time. | `STAFF`, `SUPERVISOR`, `MANAGER` | **Fully Implemented** | `src/modules/gamingSessions/` |
| **F-007** | **Online Payment Gateway & Webhooks** | Initiate online payments (ZARINPAL) and handle asynchronous gateway callbacks/webhooks with automatic booking confirmation. | `STAFF`, `SUPERVISOR`, `MANAGER`, `CUSTOMER` | **Fully Implemented** | `src/modules/payments/`, `src/modules/webhooks/` |
| **F-008** | **Customer Profile & Self-Service Portal** | Customer authentication via SMS OTP, booking history access, self-service cancellation, and review submission. | `CUSTOMER`, `STAFF`, `SUPERVISOR`, `MANAGER` | **Fully Implemented** | `src/modules/auth/`, `src/modules/customer-panel/`, `src/modules/customers/` |
| **F-009** | **Automated Customer Wallet Refund** | Credit cancelled or overpaid reservation amounts directly to customer wallet accounts for future reuse. | `SYSTEM` (Triggered via Cancellation/Payment) | **Partially Implemented** (Backend logic active, no dedicated UI API) | `src/modules/wallet/` |
| **F-010** | **Dynamic Discount & Voucher System** | Create percentage or fixed-amount promotional discounts targeted at specific stations or gaming center level with priority rules. | `MANAGER`, `ADMIN` | **Fully Implemented** | `src/modules/discounts/` |
| **F-011** | **Staff Roster & Shift Scheduling** | Manage staff profiles, system access roles, station skill assignments, and weekly shift rosters by day and shift role. | `MANAGER`, `SUPERVISOR` | **Fully Implemented** | `src/modules/users/`, `src/modules/staffShifts/` |
| **F-012** | **Customer Support Ticket Desk** | Multi-role ticketing portal allowing customers to submit issues, and support personnel/admins to claim, respond, and resolve tickets. | `CUSTOMER`, `SUPPORT`, `ADMIN` | **Fully Implemented** | `src/modules/tickets/` |
| **F-013** | **Multi-Channel Notification Dispatcher** | System-wide in-app notifications and background SMS queues for reservation updates, confirm actions, and reschedule proposals. | `STAFF`, `SUPERVISOR`, `MANAGER`, `CUSTOMER` | **Fully Implemented** | `src/modules/notifications/` |
| **F-014** | **Landing Page Builder & CMS** | Multi-tenant dynamic page creation with pre-built section types (Hero, Features, Services, Maps, Testimonials) and media uploads. | `MANAGER` | **Fully Implemented** | `src/modules/cms/`, `src/modules/public/` |
| **F-015** | **Blog Engine & Article Publishing** | Article drafting, taxonomy (Categories, Tags, Series), nested comment moderation, emotional reactions, and navigation menus. | `STAFF`, `SUPERVISOR`, `MANAGER`, `ADMIN`, `PUBLIC` | **Fully Implemented** | `src/modules/blog/` |
| **F-016** | **Customer Feedback & Multi-Criteria Ratings** | Collect post-play customer feedback (cleanliness, equipment, staff, price) with manager moderation controls before public display. | `CUSTOMER`, `MANAGER`, `PUBLIC` | **Fully Implemented** | `src/modules/ratings/` |
| **F-017** | **Revenue Commission & Partner Settlement** | Configure platform commission policies (percentage or fixed), track accruals per booking, and record settlement payouts. | `MANAGER` | **Fully Implemented** | `src/modules/commissions/` |
| **F-018** | **Business Analytics & Performance Dashboard** | Aggregated revenue trends, occupancy percentages, station utilization metrics, and staff performance indicators. | `MANAGER` | **Fully Implemented** | `src/modules/analytics/` |
| **F-019** | **Audit Trail & Governance Logs** | Detailed record of sensitive operations (settings modifications, booking cancellations, staff role updates) with IP diff tracking. | `MANAGER` | **Fully Implemented** | `src/modules/audit/` |
| **F-020** | **Tournament Management** | Organize esports tournaments, track prize pools, and manage participant slots. | N/A | **Unimplemented** (Data model exists, no logic/endpoints) | `prisma/schema.prisma` (`model Tournament`) |

---

## C. Feature Details

### Feature F-001: Gaming Center Identity & Branch Setup
* **User Actions:** Managers configure gaming center profiles (name, description, opening/closing times, hourly rates, VIP rates, food service flag, game list), site settings (logo, favicon, SEO meta tags, Google site verification), social media links, and physical branch addresses.
* **Business Rules:**
  * Slug must be unique system-wide.
  * Operating times dictate availability slot calculations.
  * Site settings and addresses are publicly queryable by slug.
* **Lifecycle / Statuses:** Active / Inactive gaming center toggle.
* **Frontend Implications:** Settings page for center details, public header/footer components with logo and links, contact/map component.
* **Evidence:** `src/modules/gamingCenter/gamingCenter.station.ts`, `src/modules/cms/site-settings.station.ts`, `src/modules/cms/addresses.station.ts`.

### Feature F-002: Game Station & Hardware Management
* **User Actions:** Staff create, list, inspect, update, and deactivate game stations. Filter by platform type (`PC`, `PLAYSTATION`, `XBOX`, `SWITCH`, `VR`).
* **Business Rules:**
  * Defines minimum (`minRentHours`) and maximum (`maxRentHours`) rent durations and time increments (`incrementMinutes`, default 30 mins).
  * Station hourly rate can override global gaming center rate.
  * Public station list returns only active stations (`isActive = true`).
* **Frontend Implications:** Station grid view, station editor form with platform type dropdown, VIP badge, and rental bounds inputs.
* **Evidence:** `src/modules/station/station.station.ts`, `src/modules/station/station.controller.ts`.

### Feature F-003: Real-Time Slot Availability Engine
* **User Actions:** Unauthenticated users or staff request available booking time slots for a specific date and duration.
* **Business Rules:**
  * Validates against gaming center opening/closing hours.
  * Excludes slots overlapping with `CONFIRMED` or `IN_PROGRESS` reservations or scheduled station maintenance.
  * Respects `incrementMinutes` step boundaries.
* **Frontend Implications:** Interactive date-picker, time-slot selection grid showing available/occupied blocks.
* **Evidence:** `src/modules/availability/availability.station.ts`, `src/modules/availability/availability.controller.ts`.

### Feature F-004: In-Person & Online Slot Reservation
* **User Actions:**
  * **Staff (In-person/Phone):** Select station, start time, end time, customer profile, and create reservation.
  * **Customer (Online):** Select station, time slot, provide phone/name, submit reservation.
* **Business Rules:**
  * Overlap prevention rule strictly checked (`preventOverlaps` setting).
  * Total price automatically computed using station hourly price and active discount rules (Station discount overrides Gaming Center discount).
  * Snapshots station data onto the reservation record for historical audit.
  * Accepts optional voucher/discount code.
  * Triggers background SMS and in-app notifications.
* **Lifecycle / Statuses:** `PENDING` -> `CONFIRMED` -> `IN_PROGRESS` -> `COMPLETED` | `CANCELED` | `NO_SHOW`.
* **Frontend Implications:** Multi-step reservation wizard, booking summary card showing duration, discounts, and total price breakdown, calendar/timeline view for staff.
* **Evidence:** `src/modules/reservation/reservation.station.ts`, `src/modules/reservation/reservation.state-machine.ts`, `src/modules/discounts/discounts.station.ts`.

### Feature F-005: Reservation Reschedule Negotiation
* **User Actions:**
  * Staff proposes a new start/end time for an existing booking.
  * Customer views pending proposals on customer portal and clicks Accept or Reject.
* **Business Rules:**
  * Acceptance re-validates slot availability for proposed time; rejects if double-booked.
  * On acceptance, updates reservation `startTime`, `endTime`, recalculates price/discounts, and marks proposal `ACCEPTED`.
  * Statuses: `PENDING`, `ACCEPTED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
* **Frontend Implications:** Pending proposal alert on customer dashboard, proposal creation modal for staff, accept/reject decision buttons.
* **Evidence:** `src/modules/reservation/reservation.station.ts`, `src/modules/customer-panel/customer-panel.station.ts`.

### Feature F-006: Active Gaming Session Tracking
* **User Actions:** Staff start, pause, resume, or end a gaming session linked to an existing reservation.
* **Business Rules:**
  * Starting session transitions reservation to `IN_PROGRESS` and creates a `GamingSession` record (`ACTIVE`).
  * Pausing tracks `pausedAt` and accumulates `pausedMinutes`.
  * Stopping session computes `actualHours` played and marks session `COMPLETED`.
  * Statuses: `ACTIVE`, `PAUSED`, `COMPLETED`, `INTERRUPTED`, `NO_SHOW`.
* **Frontend Implications:** Live session dashboard for staff with timer controls (Start/Pause/Resume/Stop), live station activity indicators.
* **Evidence:** `src/modules/gamingSessions/gamingSessions.station.ts`, `src/modules/gamingSessions/gamingSessions.state-machine.ts`.

### Feature F-007: Online Payment Gateway & Webhooks
* **User Actions:** Initiate online payment for a booking. User is redirected to ZARINPAL gateway.
* **Business Rules:**
  * System generates payment intent record (`INITIATED`).
  * Gateway webhook verifies signature, updates payment status (`PAID` or `FAILED`), and updates reservation payment state (`PAID`, `PARTIALLY_PAID`).
  * Supports idempotency key header to prevent double payments.
* **Frontend Implications:** Checkout page, payment redirect handler, payment status banner (Success/Failed).
* **Evidence:** `src/modules/payments/payments.station.ts`, `src/modules/webhooks/webhooks.station.ts`.

### Feature F-008: Customer Profile & Self-Service Portal
* **User Actions:**
  * Customers request SMS OTP code, verify OTP, receive session JWT.
  * Customer views active and past reservations, cancels pending bookings, views reschedule proposals, submits ratings.
  * Staff manage customer CRM notes, view spend history, and create customer accounts.
* **Business Rules:**
  * OTP expires after configured duration; maximum verification attempts enforced.
  * Customer cancellation respects `cancellationHours` window and triggers automated wallet refund if prepaid.
* **Frontend Implications:** Phone OTP login form, Customer Portal Dashboard, My Bookings tab, Review submission modal, Staff CRM table.
* **Evidence:** `src/modules/auth/auth.station.ts`, `src/modules/customer-panel/customer-panel.station.ts`, `src/modules/customers/customers.station.ts`.

### Feature F-009: Automated Customer Wallet Refund
* **User Actions:** System automatically credits customer's wallet balance when a prepaid reservation is cancelled or overpaid.
* **Business Rules:**
  * Creates `WalletTransaction` entry (`REFUND` type) and increments `CustomerAccount.walletBalance`.
  * Updates payment state to `REFUNDED`.
* **Limitations:** Backend logic is fully integrated into cancellation flows, but NO standalone frontend APIs exist for customers/staff to manually top-up or view wallet transaction statements.
* **Frontend Implications:** Display wallet balance field in customer profile header.
* **Evidence:** `src/modules/wallet/wallet.station.ts`, `src/modules/wallet/wallet.repo.ts`.

### Feature F-010: Dynamic Discount & Voucher System
* **User Actions:** Managers create promotional discounts specifying target (`GAMING_CENTER` or `STATION`), value type (`PERCENTAGE` or `FIXED_AMOUNT`), numerical value, and start/end validity dates.
* **Business Rules:**
  * Target Precedence: `STATION` level discount overrides `GAMING_CENTER` level discount.
  * Maximum discount capped at base reservation price.
  * Discount automatically calculated during reservation creation and proposal acceptance.
* **Frontend Implications:** Promotional campaign manager screen, active discount list table, discount application preview during booking.
* **Evidence:** `src/modules/discounts/discounts.station.ts`, `src/modules/discounts/discounts.controller.ts`.

### Feature F-011: Staff Roster & Shift Scheduling
* **User Actions:** Managers add staff accounts (`TRAINEE`, `STAFF`, `SUPERVISOR`, `MANAGER`), assign station skills, and configure weekly working shifts (day of week, start time, end time, shift role like `CASHIER`, `TECH_SUPPORT`, `HOST`).
* **Business Rules:**
  * Shift uniqueness per `(gamingCenterId, userId, dayOfWeek)`.
  * Staff accounts isolated per gaming center tenant.
* **Frontend Implications:** Staff directory table, staff skill matrix, weekly shift calendar planner grid.
* **Evidence:** `src/modules/users/users.station.ts`, `src/modules/staffShifts/staffShifts.station.ts`.

### Feature F-012: Customer Support Ticket Desk
* **User Actions:**
  * Customers submit support tickets (subject, category, priority, message).
  * Support agents claim/assign tickets, view ticket queues, and post replies.
  * Admins view support statistics, reassign tickets, or close tickets.
* **Business Rules:**
  * Support agents must be assigned to a ticket to reply, or must claim open tickets.
  * Ticket Workflow: `OPEN` -> `ANSWERED` (Support reply) -> `PENDING` (User reply) -> `CLOSED`.
  * No further replies allowed once status is `CLOSED`.
* **Frontend Implications:** Customer "Help Desk" page, Support Staff Inbox with filter tabs (`Unassigned`, `My Tickets`, `Closed`), ticket conversation chat view.
* **Evidence:** `src/modules/tickets/tickets.station.ts`, `src/modules/tickets/tickets.controller.ts`.

### Feature F-013: Multi-Channel Notification Dispatcher
* **User Actions:** Authenticated users view in-app notification feed, see unread notification count badge, and mark notifications as read.
* **Business Rules:**
  * Domain events (`RESERVATION_CREATED`, `CONFIRMED`, `CANCELLED`, `TIME_PROPOSED`) automatically create in-app notifications and queue SMS notifications for gaming center owners/customers.
* **Frontend Implications:** Top navigation notification bell icon with unread badge counter, notification dropdown panel, mark-all-read action.
* **Evidence:** `src/modules/notifications/notifications.station.ts`, `src/modules/notifications/sms.station.ts`.

### Feature F-014: Landing Page Builder & CMS
* **User Actions:** Managers build dynamic website pages by assembling modular JSON sections (`HERO`, `RICH_TEXT`, `SERVICES_GRID`, `GALLERY_GRID`, `STAFF_GRID`, `FAQ`, `CONTACT_CARD`, `MAP`, `CTA`). Upload images to media library.
* **Business Rules:**
  * Page status: `DRAFT`, `REVIEW`, `SCHEDULED`, `PUBLISHED`, `ARCHIVED`.
  * Supports custom full-path URLs, slug redirection history, and SEO meta tags.
* **Frontend Implications:** Dynamic page renderer component using block definitions, CMS Page Builder drag-and-drop section editor, Media Library picker.
* **Evidence:** `src/modules/cms/pages.station.ts`, `src/modules/cms/page-section-registry.ts`, `src/modules/public/pages.public.controller.ts`.

### Feature F-015: Blog Engine & Article Publishing
* **User Actions:**
  * Authors write posts with CKEditor HTML content, excerpt, cover images, canonical URLs, and SEO options.
  * Categorize posts by hierarchical Categories, Tags, and Series.
  * Public users read articles, submit comments, and express emotional reactions (`LIKE`, `LOVE`, `LAUGH`, `WOW`, `SAD`, `ANGRY`).
  * Managers moderate comment thread (`APPROVED`, `REJECTED`, `DELETED`, `PINNED`).
* **Business Rules:**
  * Only `ADMIN` or `MANAGER` can publish posts or manage header/footer navigation trees; `STAFF` authors can draft/edit own posts.
  * Reactions aggregated in real-time.
* **Frontend Implications:** Blog homepage, article reading view with reaction bar and nested comment tree, author post management screen, comment moderation queue.
* **Evidence:** `src/modules/blog/posts/posts.station.ts`, `src/modules/blog/comments/comments.station.ts`, `src/modules/blog/reactions/reactions.station.ts`.

### Feature F-016: Customer Feedback & Multi-Criteria Ratings
* **User Actions:** Customers rate completed reservations across 4 sub-criteria (cleanliness, equipment, staff, price value) plus overall score and written comment.
* **Business Rules:**
  * Ratings linked to specific `reservationId` and `customerAccountId`.
  * Managers can moderate ratings (`PUBLISHED`, `HIDDEN`, `DELETED`).
  * Public endpoint lists only `PUBLISHED` ratings.
* **Frontend Implications:** Post-play review modal with 5-star sliders for sub-criteria, center public review list widget, staff review moderation list.
* **Evidence:** `src/modules/ratings/ratings.station.ts`, `src/modules/ratings/ratings.controller.ts`.

### Feature F-017: Revenue Commission & Partner Settlement
* **User Actions:** Managers configure platform commission policies (`PERCENT` basis points or `FIXED_AMOUNT` per reservation) and track earnings and recorded settlement payments.
* **Business Rules:**
  * Commission calculated upon reservation creation/payment.
  * Statuses: `PENDING` -> `ACCRUED` -> `CHARGED` / `WAIVED` / `REFUNDED`.
* **Frontend Implications:** Partner financial policy settings screen, commission earnings ledger table, payment record modal.
* **Evidence:** `src/modules/commissions/commissions.station.ts`, `src/modules/commissions/commissions.controller.ts`.

### Feature F-018: Business Analytics & Performance Dashboard
* **User Actions:** Managers view business KPI dashboard filtered by date range.
* **Business Rules:**
  * Computes overall revenue, occupancy rates, station utilization percentages, staff handled bookings, and daily revenue charts.
* **Frontend Implications:** Manager Analytics Dashboard with summary KPI cards, revenue line/bar charts, station utilization progress bars, staff leaderboard table.
* **Evidence:** `src/modules/analytics/analytics.station.ts`, `src/modules/analytics/analytics.controller.ts`.

### Feature F-019: Audit Trail & Governance Logs
* **User Actions:** Managers inspect system-wide audit logs showing staff actions, timestamps, IP addresses, and JSON diffs of modified data.
* **Business Rules:**
  * Captures actions like `STATION_DEACTIVATE`, `RESERVATION_CANCEL`, `SETTINGS_UPDATE`.
* **Frontend Implications:** Audit log table with filter by action/actor, detail modal showing side-by-side JSON before/after diffs.
* **Evidence:** `src/modules/audit/audit.station.ts`, `src/modules/audit/audit.controller.ts`.

### Feature F-020: Tournament Management
* **Status:** **Unimplemented**
* **Findings:** `Tournament` data model exists in `prisma/schema.prisma` with fields for title, game name, prize pool, and start time. However, there are NO Express routes, controllers, or service methods implemented in the codebase.
* **Frontend Implications:** Do NOT build UI screens for tournament registration or tournament brackets until backend APIs are developed.

---

## D. End-to-End Workflows

### Workflow 1: Customer Online Booking & Payment Workflow
1. **Station Selection & Availability Check:** Customer selects gaming center slug, platform type (`PC`/`PlayStation`), date, and duration. Frontend calls `GET /public/gamingCenters/:slug/availability/slots`. Backend calculates available non-overlapping time slots.
2. **Booking Submission:** Customer selects slot, enters phone number & name, and submits form to `POST /public/gamingCenters/:slug/reservation`.
3. **Validation & Pricing:** Backend validates against operating hours, double bookings, applies active discount rules (Station or Center level), calculates total price, snapshots station state, and creates reservation (`CONFIRMED` or `PENDING`).
4. **Online Checkout:** Frontend calls `POST /gamingCenters/:id/reservation/:resId/payments/init`. Backend generates ZARINPAL payment link. Customer completes payment.
5. **Asynchronous Settlement:** ZARINPAL calls `POST /webhooks/payments/zarinpal`. Backend verifies signature, updates payment status to `PAID`, updates reservation payment state, sends SMS notification, and dispatches in-app notification.

### Workflow 2: On-Site Live Station Operations Workflow
1. **Walk-In Booking:** Walk-in customer arrives. Receptionist staff selects station, customer profile, and time slot via `POST /gamingCenters/:id/reservation`.
2. **Session Start:** At start time, staff clicks "Start Session" via `POST /gamingCenters/:id/reservation/:resId/sessions/start`. Backend updates reservation state to `IN_PROGRESS` and creates active `GamingSession`.
3. **Pause / Resume (Optional):** Customer steps away for food break. Staff calls `POST .../sessions/pause`. Timer pauses. On return, staff calls `POST .../sessions/resume`.
4. **Session Stop:** Session completes. Staff calls `POST .../sessions/stop`. Backend calculates actual duration, updates status to `COMPLETED`, computes final bill, and logs station analytics.

### Workflow 3: Reservation Reschedule Negotiation Workflow
1. **Staff Proposal:** Staff sees schedule conflict or customer call request, and submits new proposed times via `POST /gamingCenters/:id/reservation/:resId/propose-time`. Backend creates proposal record (`PENDING`) and emits notification.
2. **Customer Portal Notification:** Customer logs into customer portal (`GET /customer/reservation/:resId/proposals`), sees proposed start/end times and staff note.
3. **Acceptance Decision:** Customer clicks "Accept". Frontend calls `POST /customer/reservation/:resId/proposals/:proposalId/accept`.
4. **Re-Validation & Update:** Backend re-validates slot availability for proposed time window. If free, updates reservation schedule, recalculates price/discount, marks proposal `ACCEPTED`, and notifies staff.

### Workflow 4: Customer Support Ticketing Workflow
1. **Ticket Creation:** Customer experiences payment or hardware issue, submits ticket via `POST /tickets` with category (`TECHNICAL`/`FINANCIAL`), priority, and message.
2. **Support Agent Claim:** Support agent views queue (`GET /support/tickets`), claims unassigned ticket via `PATCH /support/tickets/:id/assign`.
3. **Resolution Conversation:** Support agent replies via `POST /support/tickets/:id/messages`. Ticket status changes to `ANSWERED`. Customer replies via `POST /tickets/:id/messages` (status `PENDING`).
4. **Closure:** Issue resolved. Support agent or Admin closes ticket via `PATCH /support/tickets/:id/status` with `status = CLOSED`.

---

## E. Frontend Implementation Checklist

### 1. User-Facing Public Pages (Immediately Implementable)
- [x] **Home / Landing Page:** Render dynamic layout blocks fetched from `GET /public/gamingCenters/:slug/pages/home`.
- [x] **Station Catalog & Pricing Page:** Filterable grid of active stations from `GET /public/gamingCenters/:slug/stations`.
- [x] **Online Reservation Page:** Date picker, station selector, real-time slot grid from `GET /public/.../availability/slots`, public reservation form.
- [x] **Public Blog & Article Reader:** Article list (`GET /public/.../blog/posts`), detail view with reaction buttons (`POST /blog/reactions`) and nested comments (`GET /public/.../blog/comments/tree`).
- [x] **Public Reviews Page:** List verified customer ratings and overall center score (`GET /public/.../ratings`).

### 2. Customer Portal Screens (Immediately Implementable)
- [x] **OTP Login Modal:** Mobile phone input, request OTP (`POST /auth/customer/otp/request`), enter 6-digit code (`POST /auth/customer/otp/verify`).
- [x] **Customer My Bookings Dashboard:** Active and past bookings list (`GET /customer/reservation`).
- [x] **Booking Detail & Reschedule Negotiation Screen:** View schedule, cancel booking (`POST /customer/reservation/:id/cancel`), view pending proposals (`GET /customer/reservation/:id/proposals`), Accept/Reject buttons.
- [x] **Post-Play Rating Form:** 5-star sub-criteria rating modal for completed bookings (`POST /customer/reservation/:id/ratings`).
- [x] **Customer Support Desk Page:** Submit new ticket form (`POST /tickets`), active ticket list, message thread view (`POST /tickets/:id/messages`).

### 3. Staff & Management Admin Panel (Immediately Implementable)
- [x] **Staff Login Screen:** Username/Phone + Password (`POST /auth/login`) or OTP login.
- [x] **Live Operations Station Grid:** Visual map of stations with color-coded live statuses (Available, In-Use, Paused, Reserved), Quick Start/Stop/Pause buttons (`POST /gamingSessions/...`).
- [x] **Reservation Management & Calendar:** Timeline schedule view, walk-in creation form, booking status updates (Confirm, Start, Complete, Cancel, No-Show).
- [x] **Staff Roster & Shift Scheduler:** Staff list table, weekly shift planner grid by day and shift role (`PUT /gamingCenters/:id/staff/:userId/staffShifts`).
- [x] **Support Desk Inbox:** Ticket queue tabs (`Unassigned`, `Assigned to Me`), claim ticket button, response chat box.
- [x] **Discount & Voucher Manager:** Campaign table, create percentage/fixed discount form (`POST /gamingCenters/:id/discounts`).
- [x] **CMS Page & Blog Article Builder:** Drag-and-drop section builder for landing pages, CKEditor post authoring, comment moderation queue.
- [x] **Analytics KPI Dashboard:** Revenue charts, occupancy rate gauges, station utilization bars, staff leaderboard (`GET /gamingCenters/:id/analytics/...`).
- [x] **System Settings & Audit Log:** Operational parameters form (`PATCH /settings`), searchable audit log table with JSON diff viewer (`GET /audit-logs`).

### 4. Blocked or Limited Frontend Features (Needs Backend Work)
- [ ] **Customer Wallet Top-Up Screen:** **BLOCKED.** Backend has wallet credit logic on refund, but no public API for manual deposit/top-up or wallet statement list.
- [ ] **Tournament Management UI:** **BLOCKED.** Backend lacks tournament routes/controllers despite schema model presence.

---

## F. API-to-Business Feature Mapping

| API Endpoint Path | HTTP Method | Business Feature ID | Supported Actors |
|---|---|---|---|
| `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/me` | POST, GET | **F-008, F-011** | All Authenticated Staff |
| `/auth/customer/otp/request`, `/auth/customer/otp/verify` | POST | **F-008** | Public Customers |
| `/gamingCenters/:gamingCenterId` | GET, POST, PATCH | **F-001** | `MANAGER`, `ADMIN`, Public |
| `/gamingCenters/:gamingCenterId/stations` | GET, POST, PATCH, DELETE | **F-002** | `MANAGER`, `SUPERVISOR`, `STAFF` |
| `/public/gamingCenters/:gamingCenterSlug/stations` | GET | **F-002** | Public |
| `/public/gamingCenters/:gamingCenterSlug/availability/slots` | GET | **F-003** | Public |
| `/gamingCenters/:gamingCenterId/reservation` | GET, POST, PATCH | **F-004** | `MANAGER`, `SUPERVISOR`, `STAFF` |
| `/public/gamingCenters/:gamingCenterSlug/reservation` | POST | **F-004** | Public |
| `/gamingCenters/:id/reservation/:id/confirm`, `/cancel`, `/start`, `/complete`, `/no-show` | POST | **F-004** | `MANAGER`, `SUPERVISOR` |
| `/gamingCenters/:id/reservation/:id/propose-time`, `/proposals` | POST, GET | **F-005** | `MANAGER`, `SUPERVISOR`, `STAFF` |
| `/customer/reservation/:id/proposals/:proposalId/accept`, `/reject` | POST | **F-005** | `CUSTOMER` |
| `/gamingCenters/:id/reservation/:id/sessions/start`, `/stop`, `/pause`, `/resume` | POST | **F-006** | `MANAGER`, `SUPERVISOR`, `STAFF` |
| `/gamingCenters/:id/reservation/:id/payments/init` | POST | **F-007** | `STAFF`, `CUSTOMER` |
| `/webhooks/payments/:provider` | POST | **F-007** | Gateway (ZARINPAL) |
| `/customer/me`, `/customer/reservation`, `/customer/:id` | GET | **F-008** | `CUSTOMER` |
| `/gamingCenters/:id/discounts` | GET, POST, PATCH, DELETE | **F-010** | `MANAGER`, `ADMIN` |
| `/gamingCenters/:id/staff`, `/gamingCenters/:id/staff/:userId/staffShifts` | GET, POST, PUT | **F-011** | `MANAGER`, `SUPERVISOR` |
| `/tickets`, `/support/tickets`, `/admin/tickets` | GET, POST, PATCH | **F-012** | `CUSTOMER`, `SUPPORT`, `ADMIN` |
| `/notifications`, `/notifications/unread-count`, `/notifications/:id/read` | GET, PATCH | **F-013** | All Authenticated Users |
| `/gamingCenters/:id/pages`, `/media`, `/links`, `/addresses`, `/site-settings` | GET, POST, PATCH | **F-014** | `MANAGER` |
| `/public/gamingCenters/:slug/pages`, `/media`, `/links`, `/addresses` | GET | **F-014** | Public |
| `/gamingCenters/:id/blog/posts`, `/comments`, `/reactions`, `/taxonomy`, `/navigation` | GET, POST, PATCH, DELETE | **F-015** | `STAFF`, `SUPERVISOR`, `MANAGER`, `ADMIN` |
| `/public/gamingCenters/:slug/blog/...` | GET | **F-015** | Public |
| `/gamingCenters/:id/ratings`, `/public/gamingCenters/:slug/ratings` | GET, POST, PATCH | **F-016** | `CUSTOMER`, `MANAGER`, Public |
| `/gamingCenters/:id/commissions/policy`, `/`, `/:id/pay` | GET, POST | **F-017** | `MANAGER` |
| `/gamingCenters/:id/analytics/summary`, `/staff`, `/stations`, `/revenue-chart` | GET | **F-018** | `MANAGER` |
| `/gamingCenters/:id/audit-logs` | GET | **F-019** | `MANAGER` |
| `/gamingCenters/:id/settings` | GET, PATCH | **F-001, F-004** | `MANAGER` |

---

## G. Missing Capabilities and Open Questions

1. **Standalone Customer Wallet Management:**
   * *Gap:* Customer wallet balance is credited upon reservation refund, but there are no endpoints for users to view wallet transaction histories or top up their balance via online payment.
   * *Action:* Confirm whether wallet functionality should remain internal-only for refunds or expanded into a full prepaid wallet balance feature.

2. **Esports Tournament Module:**
   * *Gap:* `Tournament` model exists in database schema, but no API routes or controllers exist.
   * *Action:* Do not build frontend tournament pages until backend endpoints are defined.

3. **Multi-Payment Provider Abstraction:**
   * *Gap:* The system currently hardcodes online flows to `ZARINPAL`.
   * *Action:* Ensure frontend checkout UI handles ZARINPAL redirect flows cleanly.

4. **Real-time WebSockets / SSE Updates:**
   * *Gap:* Live station grid updates rely on polling or page refreshes.
   * *Action:* Frontend should implement periodic polling (e.g., every 15-30 seconds) on the Live Station Operations screen.

---

## H. Executive Summary for the Frontend Developer

Dear Frontend Developer,

The PlayeNest backend is a fully functional, production-ready system for Gaming Center operations and customer reservations. Here is what you can build immediately:

### 1. Customer-Facing Web Application
* **Branch Public Portal:** Dynamic home page driven by CMS blocks, active station listing, interactive availability slot grid, and online reservation booking.
* **Customer Self-Service Dashboard:** Phone SMS OTP login, booking history, booking cancellation, reschedule proposal negotiation (Accept/Reject), and post-play multi-criteria ratings.
* **Support Ticket Desk:** Submit support tickets, track ticket status, and engage in two-way messaging with support agents.
* **Blog & CMS:** Modern blog article listing, detailed reader with 6 emotional reaction buttons (`Like`, `Love`, etc.), dynamic header/footer menus, and moderated nested comment threads.

### 2. Management & Staff Operations Dashboard
* **Live Operations Station Grid:** Visual map of stations with color-coded live statuses and direct controls for Start, Pause, Resume, and Stop gaming sessions.
* **Reservation Desk & Walk-In Scheduler:** Staff reservation calendar with create, confirm, reschedule proposal, and cancel workflows.
* **Staff Roster Planner:** Weekly shift planner matrix by day of week and role (`Cashier`, `Tech Support`, `Host`).
* **Support Desk Staff Inbox:** Queue manager for support tickets with claim, assign, reply, and status management.
* **Promotional Discount Manager:** Percentage and fixed-amount discount campaign creation with station/center priority controls.
* **CMS Page Builder & Blog Authoring:** Modular page section assembly and article creation.
* **Manager Analytics & Audit Logs:** Revenue charts, occupancy rates, utilization metrics, and audit log diff viewer.

### Key Guidelines for Development
* **Authentication:** Customer endpoints require Customer OTP token (`SessionActorType.CUSTOMER`), while Staff/Manager endpoints require Staff JWT.
* **Multi-Tenancy:** Management requests require `:gamingCenterId` in the path, while public endpoints use `:gamingCenterSlug`.
* **State Machines:** Respect reservation states (`PENDING`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELED`, `NO_SHOW`) and session states (`ACTIVE`, `PAUSED`, `COMPLETED`).
