# Senior Architecture Audit Report: Playenest (AS-IS)

This audit is based on a direct analysis of the existing codebase and documentation. It describes the system as it currently exists.

---

## 1. System Overview (AS-IS)
The Playenest system is currently a **Modular Monolith** built on **Node.js** and the **Express.js** framework. It is a multi-tenant platform designed to manage gaming centers, reservations, and center-specific websites.

*   **Runtime/Stack:** Node.js, Express, TypeScript.
*   **Database:** PostgreSQL 15 (managed via Prisma ORM).
*   **Queue/Caching:** Redis (backing BullMQ for asynchronous jobs).
*   **Deployment:** Containerized via Docker (Services: `app`, `db`, `redis`, `nginx`, `backup`).
*   **SSR:** The system performs on-the-fly Server-Side Rendering for public pages.

---

## 2. Module Breakdown (Current Structure)
The system is organized into domain-specific modules located in `src/modules/`. Each module typically follows a layered pattern: **Routes -> Controller -> Station (Service) -> Repository**.

| Module | Responsibility |
| :--- | :--- |
| **Auth** | Multi-role identity management (User/Customer). OTP generation (Redis) and JWT lifecycle. |
| **Reservation** | Core business engine. Handles availability, conflict detection, and reservation state transitions. |
| **GamingCenter** | Tenant management. Configures centers, stations, shifts, and global settings. |
| **CMS** | Website builder. Manages pages and sections (JSON-based configuration). |
| **Public** | Public-facing route handler and SSR engine (`page-renderer.ts`). |
| **Financial** | Payment orchestration (Zarinpal), wallet transactions, and commission logic. |
| **Analytics** | Aggregates transactional data into summary tables via BullMQ workers. |
| **Audit** | Intercepts entity changes to record immutable "old vs new" snapshots. |

---

## 3. Data Flow Analysis (Step-by-Step)
1.  **Ingress:** External traffic enters via **NGINX**. Media files (`/media`) are served directly from a shared volume.
2.  **Middleware Chain:**
    *   **Security:** `helmet` and `cors` are applied.
    *   **Authentication:** `apiKeyMiddleware` checks for a mandatory `x-api-key`.
    *   **Identity:** `jwtMiddleware` (where applicable) verifies user/customer tokens.
    *   **Tenant Resolution:** `resolveGamingCenterBySlug` identifies the target `GamingCenter`.
3.  **Routing:** Express dispatches to the relevant module router (e.g., `src/modules/reservation/reservation.routes.ts`).
4.  **Service Execution:** The **Controller** invokes the **Station** (e.g., `reservationStation.ts`), which contains domain logic and business rule validation.
5.  **Persistence:** The Station uses a **Repository** (e.g., `reservation.repo.ts`) to interact with **PostgreSQL** via **Prisma**.
6.  **Post-Action:** Upon success, the system emits events via `EventEmitter` or pushes jobs to **BullMQ** (Redis) for side effects (e.g., SMS notifications, analytics updates).
7.  **Response:** The `responseMiddleware` wraps the result in a standard JSON envelope and sends it to the client.

---

## 4. Reservation System Behavior (Current Implementation)
The current implementation is a transaction-heavy engine designed for high integrity:
*   **Conflict Prevention:** Employs `RepeatableRead` transaction isolation and a native PostgreSQL unique constraint (`Reservation_no_overlap_active`) to ensure no resource is double-booked.
*   **Flows:**
    *   **Manual:** Staff creates confirmed bookings for walk-ins.
    *   **Online:** Customers request bookings via a public flow. Depending on center settings, these may be auto-confirmed or require OTP verification.
*   **State Machine:** Managed via `ReservationStateMachine.ts`, enforcing strict transitions (e.g., a reservation cannot be "Completed" unless it was "In Progress").

---

## 5. Blog/CMS Behavior (AS-IS)
**Note:** The system is **NOT Django-based**. The CMS is a native Node.js implementation.

*   **Content Model:** Pages are composed of `PageSection` records. Content is **not stored as HTML** but as structured JSON in the `dataJson` column of `PageSection`.
*   **SEO Management:** The `Page` model contains explicit fields for `seoTitle`, `seoDescription`, `canonicalPath`, and `structuredDataJson`.
*   **Rendering:** When a public page is requested, `pages.public.station.ts` fetches the JSON sections and passes them to `page-renderer.ts`, which injects them into a base HTML template.
*   **Redirect Management:** `PageSlugHistory` maintains a log of old slugs to perform automatic 301 redirects to the current slug.
*   **Scheduling:** Handled via BullMQ (not Celery), although scheduled publishing logic is currently minimal.

---

## 6. Coupling Analysis (What depends on what)
*   **Database Level (Tight):** All modules share a single Prisma schema and a single PostgreSQL database. Domain boundaries are respected at the folder level, but not at the data storage level.
*   **Inter-Module (Loose):** Modules primarily interact through the **Event/Job system**. For example, the Payment module completes a transaction and the Reservation module reacts asynchronously to update the status.
*   **Infrastructure (Tight):** All modules are heavily dependent on `src/common` for core utilities, error handling, and middleware.

---

## 7. SEO Implementation Status (Current State)
*   **SSR Support:** High. The system generates full HTML on the server for all public routes.
*   **Metadata:** Dynamic per-page tags and JSON-LD support are present.
*   **Indexing:** Robots control (Index/Follow) is manageable per page.
*   **Effectiveness:** **Currently compromised.** The global `apiKeyMiddleware` requires an `x-api-key` header even for public routes, which effectively blocks search engine crawlers from indexing the SSR output.

---

## 8. Risks & Bottlenecks (Existing Issues)
*   **Database Bottleneck:** As a Modular Monolith, a single complex query in the Analytics or Audit module can lock tables and impact the core reservation engine performance.
*   **Search Indexing Block:** The mandatory API key on public routes is a critical bottleneck for SEO effectiveness.
*   **Redis Dependency:** BullMQ, rate limiting, and idempotency all rely on a single Redis instance; its failure halts all asynchronous processing and public routing.
*   **Lack of Discovery Tools:** The system lacks automated `sitemap.xml` and `robots.txt` generation.
*   **Implementation Gaps:** "Django", "Celery", and "Comments" were found to be **not present** in the provided codebase despite being mentioned in the requirements.

---
**Audit performed by Jules.**
