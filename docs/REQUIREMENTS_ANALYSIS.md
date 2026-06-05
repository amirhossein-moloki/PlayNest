# Software Requirements Specification (SRS) - Playenest

## 1. Executive Summary & Project Overview

### 1.1 Project Name
**Playenest** (پلتفرم مدیریت و رزرو گیم‌نت)

### 1.2 Project Vision
To provide a robust, intelligent, and scalable platform for gaming center management and reservations, empowering owners with operational efficiency and gamers with seamless booking experiences.

### 1.3 Project Goals
*   **Automation:** Streamline the reservation process for both online and walk-in customers.
*   **Real-time Control:** Provide a live dashboard for monitoring station status and occupancy.
*   **Financial Integrity:** Ensure accurate tracking of revenue, commissions, and customer balances.
*   **Customer Retention:** Build loyalty through membership tiers and a virtual wallet system.
*   **Online Presence:** Enable centers to have professional, SEO-optimized public websites via an integrated CMS.

### 1.4 Business Value
Playenest reduces overhead costs by automating staff tasks, minimizes revenue loss from booking overlaps or no-shows, and increases customer lifetime value through targeted loyalty features.

### 1.5 Problem Statement
Many gaming centers currently rely on manual or fragmented systems for managing bookings, staff, and finances. This leads to:
*   Booking overlaps and customer dissatisfaction.
*   Inefficient utilization of high-cost hardware (PC/Console/VR).
*   Difficulties in tracking financial performance and staff shifts.
*   Lack of a professional online presence for direct customer engagement.

### 1.6 Proposed Solution
A centralized, multi-tenant Express/TypeScript platform using Prisma and PostgreSQL. The solution includes:
*   A high-performance Booking Engine with overlap prevention.
*   Station Management for varied equipment types (PC, PS5, Xbox, VR).
*   Integrated CMS for site building and SEO.
*   Financial modules including Wallet, Zarinpal payment integration, and Commission tracking.

### 1.7 Success Criteria
*   **Zero Booking Overlaps:** 100% accuracy in reservation scheduling.
*   **Performance:** API response times under 200ms for critical operations.
*   **Scalability:** Support for multiple gaming centers (tenants) with isolated data.
*   **Usability:** High adoption rate by staff and positive feedback from end-customers.

---

## 2. Stakeholder Analysis

### 2.1 Primary Stakeholders

| Name | Responsibilities | Goals | Permissions | Interactions |
| :--- | :--- | :--- | :--- | :--- |
| **Gaming Center Manager** | Business operations, financial oversight, staff management. | Maximize profit, optimize occupancy, monitor staff. | Full administrative access (MANAGER role). | Manages settings, staff, pricing, and views analytics. |
| **Gamer (Customer)** | Making and managing their own reservations. | Easy booking, transparent pricing, rewards. | CUSTOMER account access. | Browses public site, books stations, manages wallet. |

### 2.2 Secondary Stakeholders

| Name | Responsibilities | Goals | Permissions | Interactions |
| :--- | :--- | :--- | :--- | :--- |
| **Receptionist / Staff** | Handling walk-in customers, checking in/out sessions. | Smooth daily operations, accurate check-ins. | RECEPTIONIST/STAFF role. | Manages live bookings, starts/pauses sessions. |
| **Technical Support** | Hardware maintenance and troubleshooting. | Minimize station downtime. | TECH_SUPPORT shift role / Limited access. | Updates station maintenance logs. |

### 2.3 External Systems

| Name | Role | Responsibilities | Interactions |
| :--- | :--- | :--- | :--- |
| **Zarinpal** | Payment Gateway | Processing online transactions. | Webhook notifications for payment status updates. |
| **SMS Gateway** | Communication | Delivering OTP codes for auth. | API calls to send SMS/WhatsApp. |

### 2.4 Administrators & Support

| Name | Responsibilities | Goals | Permissions | Interactions |
| :--- | :--- | :--- | :--- | :--- |
| **Platform Admin** | System-wide maintenance, tenant onboarding. | Platform stability and growth. | SUPER_ADMIN (Internal). | Manages global enums, monitors logs. |
| **Support Team** | Assisting managers with platform usage. | High tenant satisfaction. | Support Access. | Audits logs to troubleshoot manager issues. |

---

## 3. Scope Definition

### 3.1 In Scope (Phase 1)
*   **Authentication & AuthZ:** OTP-based login, RBAC (Manager, Supervisor, Staff, Trainee).
*   **Multi-tenancy:** Global tenant isolation using `gamingCenterId`.
*   **Station Management:** CRUD for Game Stations (PC, Console, VR) with tiered pricing.
*   **Reservation Engine:** Advanced booking with overlap prevention and snapshotting.
*   **Gaming Sessions:** Live control (Start, Pause, Stop) of active bookings.
*   **CMS & SEO:** Page builder, media management, and SEO metadata control.
*   **Financials:** Wallet system, Zarinpal integration, and Earning/Commission tracking.
*   **Analytics:** Pre-calculated summary tables for Centers, Staff, and Stations.

### 3.2 Out of Scope
*   **Hardware Integration:** Direct software control of PC power or station locking.
*   **Native Mobile Apps:** Native iOS/Android apps (PWA approach is preferred).
*   **Bofeb/Inventory:** Physical inventory management for food/drinks (planned for future).
*   **Social Networking:** In-app chat between gamers.

### 3.3 Assumptions
*   All users have access to a modern web browser and internet connection.
*   SMS Gateways will be used for primary authentication via Iranian mobile numbers.
*   Gaming centers operate within defined timezones stored in their settings.

### 3.4 Constraints
*   **Technical Stack:** Must use Node.js (v18+), Express, and Prisma.
*   **Database:** PostgreSQL for production; SQLite for local integration tests.
*   **Performance:** Dashboard analytics must load in under 200ms.
*   **Security:** Compliance with standard OWASP practices for API security.

### 3.5 Dependencies
*   **Redis:** Required for idempotency keys, rate limiting, and BullMQ.
*   **Prisma Client:** Generated based on the `schema.prisma` file.
*   **External APIs:** Zarinpal for Iranian payment processing.

---

## 4. Functional Requirements

### 4.1 Module: Authentication & Identity
**FR-001**
**Title:** OTP Request
**Description:** System must allow users to request a one-time password (OTP) via phone number.
**Priority:** High
**Actor:** All
**Acceptance Criteria:** OTP is generated and "sent" via configured channel; request is rate-limited.

**FR-002**
**Title:** Login with OTP
**Description:** System must authenticate users using phone number and verified OTP code.
**Priority:** High
**Actor:** User, Customer
**Acceptance Criteria:** Valid code results in JWT issuance; invalid code returns 401.

### 4.2 Module: Gaming Center & Settings
**FR-003**
**Title:** Center Configuration
**Description:** Managers must be able to configure center details (name, slug, rates, hours).
**Priority:** High
**Actor:** Manager
**Acceptance Criteria:** Settings are saved and applied to reservation calculations.

**FR-004**
**Title:** Tenant Isolation
**Description:** System must ensure data isolation between different gaming centers.
**Priority:** Critical
**Actor:** System
**Acceptance Criteria:** Query filters automatically applied via middleware/Prisma extension.

### 4.3 Module: Station & Reservation Management
**FR-005**
**Title:** Station CRUD
**Description:** Managers can create, update, and deactivate game stations (PC, VR, etc.).
**Priority:** High
**Actor:** Manager
**Acceptance Criteria:** Changes reflect in real-time on booking availability.

**FR-006**
**Title:** Overlap Prevention
**Description:** System must prevent two reservations from occupying the same station at the same time.
**Priority:** Critical
**Actor:** User, Customer
**Acceptance Criteria:** Concurrent booking attempts for the same slot must fail.

**FR-007**
**Title:** Walk-in Booking
**Description:** Staff must be able to create immediate bookings for walk-in customers.
**Priority:** High
**Actor:** Staff
**Acceptance Criteria:** Booking is created and session starts immediately.

### 4.4 Module: Gaming Sessions
**FR-008**
**Title:** Session Control (Start/Pause/Stop)
**Description:** Staff can control the state of an active reservation.
**Priority:** Medium
**Actor:** Staff
**Acceptance Criteria:** Session state transitions (Active -> Paused -> Completed) are logged and update actual hours.

### 4.5 Module: CMS & Public Site
**FR-009**
**Title:** Page Builder
**Description:** Managers can create custom pages with sections (Hero, Services, Gallery).
**Priority:** Medium
**Actor:** Manager
**Acceptance Criteria:** Pages are rendered as HTML on the public slug.

**FR-010**
**Title:** SEO Control
**Description:** Managers can set meta titles, descriptions, and OpenGraph tags per page.
**Priority:** Medium
**Actor:** Manager
**Acceptance Criteria:** Public pages include correct meta tags in <head>.

### 4.6 Module: Financials & Payments
**FR-011**
**Title:** Wallet Balance
**Description:** Customers have a virtual wallet for refunds and prepayments.
**Priority:** High
**Actor:** Customer
**Acceptance Criteria:** Wallet transactions are atomic and logged.

**FR-012**
**Title:** Payment Gateway Integration
**Description:** System must process online payments via Zarinpal.
**Priority:** High
**Actor:** Customer
**Acceptance Criteria:** Successful webhooks update reservation payment state.

---

## 5. Non-Functional Requirements

**NFR-001**
**Category:** Performance
**Description:** API responses for critical path (availability, booking) must be sub-200ms.
**Measurement Criteria:** Performance monitoring logs.

**NFR-002**
**Category:** Scalability
**Description:** System must handle a 300% increase in load during peak tournament hours without manual intervention.
**Measurement Criteria:** Horizontal scaling test results.

**NFR-003**
**Category:** Availability
**Description:** System should target 99.9% uptime for the booking engine.
**Measurement Criteria:** Monthly uptime reports.

**NFR-004**
**Category:** Security
**Description:** All sensitive operations must require a valid Idempotency-Key.
**Measurement Criteria:** Replay attack testing.

**NFR-005**
**Category:** Maintainability
**Description:** Codebase must maintain >80% test coverage and pass strict ESLint rules.
**Measurement Criteria:** Jest coverage reports and CI pipeline status.

**NFR-006**
**Category:** Logging
**Description:** All financial transactions and status changes must be logged in an Audit Log.
**Measurement Criteria:** AuditLog table records for every action.

---

## 6. Business Rules

**BR-001**
**Description:** Reservations must be made at least 30 minutes in advance of the start time.

**BR-002**
**Description:** Online bookings are only confirmed if paid in full (if prepayment is enabled) or manually approved by staff.

**BR-003**
**Description:** Station hourly rates can vary between VIP and Standard tiers.

**BR-004**
**Description:** A customer cannot have two overlapping reservations across the same or different centers.

**BR-005**
**Description:** Cancellation is only permitted up to 2 hours before the start time for a full refund to the wallet.

**BR-006**
**Description:** Staff shifts cannot overlap for the same user within the same gaming center.

---

## 7. User Roles

### 7.1 Role: MANAGER
*   **Description:** The primary owner/admin of a specific gaming center.
*   **Permissions:** Full CRUD on stations, staff, settings, pages, and financial reports.
*   **Responsibilities:** Ensuring operational efficiency and financial accuracy.
*   **Restrictions:** Restricted to their own tenant (gamingCenterId).

### 7.2 Role: SUPERVISOR
*   **Description:** Shift lead responsible for overseeing staff.
*   **Permissions:** Can manage bookings, view reports, and adjust shifts.
*   **Responsibilities:** Handling escalations and staff scheduling.
*   **Restrictions:** Cannot delete the gaming center or change global site settings.

### 7.3 Role: STAFF / RECEPTIONIST
*   **Description:** Front-desk personnel handling customers.
*   **Permissions:** Create/Confirm/Cancel bookings, manage live sessions.
*   **Responsibilities:** Customer check-in and station assignment.
*   **Restrictions:** Cannot view high-level financial earnings or manage other staff members.

### 7.4 Role: TRAINEE
*   **Description:** New staff members in training.
*   **Permissions:** Read-only access to bookings and stations.
*   **Responsibilities:** Learning the system and assisting staff.
*   **Restrictions:** Cannot perform any write operations on financial or reservation data.

---

## 8. Candidate Use Cases

**UC-001**
**Use Case Name:** Request Authentication OTP
**Primary Actor:** Guest / Manager / Customer
**Goal:** Receive a login code via SMS.

**UC-002**
**Use Case Name:** Book a Station Online
**Primary Actor:** Customer
**Goal:** Reserve a specific PC/Console for a future time slot.

**UC-003**
**Use Case Name:** Check-in Walk-in Customer
**Primary Actor:** Staff
**Goal:** Create an immediate reservation and start the gaming session.

**UC-004**
**Use Case Name:** Pause Gaming Session
**Primary Actor:** Staff
**Goal:** Temporarily stop the timer for a customer (e.g., for a break).

**UC-005**
**Use Case Name:** Update Station Maintenance Status
**Primary Actor:** Staff / Manager
**Goal:** Mark a station as "Out of Order" to prevent bookings.

**UC-006**
**Use Case Name:** Create Custom CMS Page
**Primary Actor:** Manager
**Goal:** Publish a new "Tournament" page on the public website.

**UC-007**
**Use Case Name:** Refund Booking to Wallet
**Primary Actor:** Manager / Supervisor
**Goal:** Cancel a booking and credit the amount to the customer's virtual wallet.

**UC-008**
**Use Case Name:** View Daily Revenue Report
**Primary Actor:** Manager
**Goal:** Analyze the earnings for the current day across all stations.

---

## 9. Domain Model Candidates

### 9.1 Core Business Entities

| Entity | Description | Key Attributes |
| :--- | :--- | :--- |
| **GamingCenter** | The tenant representing a physical location. | name, slug, hourlyRate, openingTime. |
| **GameStation** | A specific unit (PC/Console) available for rent. | name, stationType, hourlyPrice, isVip. |
| **User** | A staff member or manager with panel access. | fullName, phone, role, isActive. |
| **CustomerAccount** | Global identity for a gamer. | phone, walletBalance, fullName. |
| **Reservation** | An agreement to use a station at a specific time. | startTime, endTime, totalPrice, status. |
| **GamingSession** | The live execution of a reservation. | actualStartTime, pausedMinutes, status. |
| **WalletTransaction** | A record of credit/debit to a customer's wallet. | amount, type, reservationId. |
| **Page** | A CMS-managed web page for the center. | slug, title, status, seoTitle. |

### 9.2 Key Relationships
*   **GamingCenter (1) <-> (N) GameStation:** A center owns multiple stations.
*   **GamingCenter (1) <-> (N) User:** A center has many staff members.
*   **CustomerAccount (1) <-> (N) CustomerProfile:** A global user has a specific profile per center.
*   **Reservation (1) <-> (1) GamingSession:** A reservation can have one active session.
*   **Reservation (1) <-> (N) Payment:** A reservation can be paid via multiple attempts/methods.

---

## 10. Risks Analysis

| Risk Category | Risk Description | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- | :--- |
| **Technical** | Redis failure leading to idempotency/rate-limit bypass. | Low | High | Implement fallback mechanisms and monitoring for Redis health. |
| **Security** | Unauthorized access via OTP brute-force. | Medium | High | Strict rate limiting on OTP request/verify endpoints. |
| **Business** | Low adoption by centers due to technical complexity. | Medium | Medium | Provide comprehensive Persian (FA) documentation and a simple onboarding UI. |
| **Operational** | DB performance degradation during peak hours. | Medium | High | Use of pre-calculated analytics tables and index optimization. |
| **Security** | Data leakage between tenants. | Low | Critical | Global multi-tenancy guard enforced at the database driver level (Prisma extension). |

---

## 11. Assumptions and Open Questions

### 11.1 Missing Requirements / Ambiguities
*   **Multi-language Support:** Is the UI strictly Persian, or is multi-language (English/Persian) required for the public site?
*   **Offline Mode:** Should the system support a local cache for staff to use during internet outages? (Currently assumed online-only).
*   **Hardware Lock:** Is there a requirement to provide a client-side "Lock Screen" for PCs that only unlocks upon session start?

### 11.2 Questions for Stakeholders
1. What is the maximum number of concurrent gaming centers the platform should support in Phase 1?
2. Do we need to support tiered pricing for specific holidays or "Night Packages" (e.g., 10 PM to 8 AM)?
3. Are there any specific legal requirements for storing customer phone numbers in the target region?
4. Should staff be able to manually override the hourly price for a specific high-value customer?

**NFR-007**
**Category:** Reliability
**Description:** System must ensure transaction integrity even during partial failure.
**Measurement Criteria:** Automated reconciliation reports showing zero mismatched states.

**NFR-008**
**Category:** Usability
**Description:** Essential staff workflows (Check-in/Check-out) must be completed in fewer than 3 clicks.
**Measurement Criteria:** User acceptance testing (UAT) timing and click-stream analysis.

**NFR-009**
**Category:** Accessibility
**Description:** The public website must comply with WCAG 2.1 Level AA standards.
**Measurement Criteria:** Lighthouse accessibility audit score > 90.

**NFR-010**
**Category:** Monitoring
**Description:** Critical errors (5xx) must trigger alerts via Sentry or a Slack webhook within 60 seconds.
**Measurement Criteria:** Alert latency tests.

**NFR-011**
**Category:** Backup & Recovery
**Description:** Database must be backed up daily with a Recovery Time Objective (RTO) of 4 hours.
**Measurement Criteria:** Monthly disaster recovery (DR) drill results.
