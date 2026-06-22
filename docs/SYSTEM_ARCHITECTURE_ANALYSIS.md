# Comprehensive Prisma & Backend Architecture Analysis

This document provides a technical extraction of the design policies, patterns, and architectural decisions implemented in the Playenest backend.

---

## 1. Prisma Architecture Overview (AS-IS)
The system utilizes a **Modular Monolith** architecture with a centralized **Monolithic Prisma Schema**.

- **Data Source:** PostgreSQL 15.
- **ORM:** Prisma with a dedicated extension layer for multi-tenancy.
- **Schema Structure:** All domains (Auth, Reservation, CMS, Finance) reside in a single `schema.prisma` file, ensuring a unified type system across the backend.
- **Service Mapping:** Prisma models map 1:1 to Express domain modules in `src/modules/`. Each module follows a strictly layered pattern:
  - `Routes` -> `Controller` -> `Station` (Business Logic) -> `Repo` (Data Access).

---

## 2. Design Patterns Identified

### Multi-Tenant Isolation
- **Pattern:** Shared database, shared schema, row-level isolation via discriminator.
- **Implementation:** The `tenantGuardExtension` in `src/config/prisma-extensions.ts` acts as a runtime safety net, intercepting queries to ensure `gamingCenterId` or `customerAccountId` filters are present.

### Identity Split (Global vs. Local CRM)
- **Pattern:** `CustomerAccount` (Global) vs. `CustomerProfile` (Tenant-specific).
- **Rationale:** Allows users to have a single identity/wallet across the platform while maintaining per-center history and notes.

### Immutable Snapshots
- **Pattern:** Data snapshots in JSON fields.
- **Usage:** `Reservation.stationSnapshot` captures station pricing/details at the time of booking, protecting the record from subsequent price changes.

### Audit Strategy
- **Pattern:** Centralized Audit Logging.
- **Implementation:** The `AuditLog` model stores `oldData` and `newData` as JSON, triggered manually in the `Station` layer for critical mutations.

---

## 3. Relationship Strategy

### Many-to-Many (N-N)
- **Preference:** **Explicit Pivot Tables** are preferred when relationship metadata exists (e.g., `StaffStationSkill` tracking `skillLevel`).
- **Implicit Relations:** Used only for simple associations; however, the system often opts for `String[]` (Scalar lists) for simple collections (e.g., `GamingCenter.games`) to reduce JOIN overhead.

### One-to-Many (1-N)
- **Pattern:** Hierarchical ownership.
- **Implementation:** Child models always maintain a scalar `foreignId` and a corresponding `@relation`.

### Cascading & Integrity
- **Cascading Deletes:** strictly limited to "component" models (e.g., `Page` -> `PageSection`, `Reservation` -> `Payment`).
- **Soft Deletes:** Implemented via status enums (`CANCELED`, `ARCHIVED`) or `isActive: boolean` flags rather than a global `deletedAt` pattern.

---

## 4. Domain Modeling Strategy

### Reservation Domain
- **Pattern:** Finite State Machine (FSM).
- **Logic:** Transitions are governed by `ReservationStateMachine`. Statuses (`PENDING`, `CONFIRMED`, `IN_PROGRESS`, etc.) control the lifecycle.
- **Consistency:** Uses `RepeatableRead` transactions to prevent overbooking.

### Blog / CMS Domain
- **Pattern:** Block-based Section Modeling.
- **Implementation:** `Page` holds metadata/SEO, while `PageSection` holds content in `dataJson`. This decouples the schema from content structure.
- **SEO Policy:** Integrated `RobotsIndex`, `RobotsFollow`, and `PageSlugHistory` for 301 redirect management.

### Media System
- **Pattern:** Purpose-driven Metadata.
- **Implementation:** `Media` model uses `MediaPurpose` (COVER, GALLERY, STATION) and `MediaType` to handle asset categorization and SEO alt-text.

### User / RBAC System
- **Pattern:** Role-based access with Center-scoping.
- **Logic:** `UserRole` enum defines permissions. Users are strictly bound to a `GamingCenter`.

---

## 5. Migration Mapping Insights (Django → Express Prisma)

| Feature | Django Pattern | Prisma/Express Alignment |
| :--- | :--- | :--- |
| **Primary Keys** | Auto-incrementing Integer | `cuid()` (Collision-resistant IDs) |
| **Relationships** | `models.ForeignKey` | `@relation` + Scalar Field |
| **M2M** | `models.ManyToManyField` | Explicit Pivot Table (`model`) |
| **Choices** | `TextChoices` / `IntegerChoices` | Native Prisma `enum` |
| **Logic Hooks** | `post_save` / `pre_save` signals | `Station` layer orchestration |
| **Metadata** | `class Meta` constraints | `@@unique`, `@@index` in Prisma |

**Patterns NOT to transfer:**
- Django's implicit table naming (use explicit model names).
- Direct ORM calls in views (use the `Station` layer).
- Heavy reliance on signals for business-critical side effects.

---

## 6. Prisma Design Policy Document

### Naming Conventions
- **Models:** `PascalCase` (Singular).
- **Fields:** `camelCase`.
- **Enums:** `PascalCase` name, `UPPER_SNAKE_CASE` values.
- **Files:** `domain.repo.ts`, `domain.station.ts`.

### Module Boundaries
- Each module must own its Prisma models.
- Cross-module logic must go through the target module's `Station`.

### Schema Organization
- All enums defined at the top.
- Models grouped by domain (Site, Staff, Reservation, Finance).
- Explicit `@@index` for all foreign keys and frequently filtered fields (e.g., `status`, `startTime`).

---

## 7. Risks / Inconsistencies in Current Design

1.  **Extension-based Multi-tenancy:** The `tenantGuardExtension` only logs warnings. It does not strictly block cross-tenant queries at the database level, placing high trust in the `Repo` layer implementation.
2.  **Scalar List for Games:** `GamingCenter.games` is a `String[]`. This makes it difficult to perform structured queries or analytics on "Most Popular Games" across the platform without string parsing.
3.  **CMS Multi-tenant Boundary:** Pages are strictly owned by a `GamingCenter`. This prevents the creation of "Platform-level" global blog posts or aggregator pages within the same model structure.
4.  **Transaction Granularity:** Some complex flows (e.g., `handleSuccessfulPayment`) perform background async tasks (Commission calculation) outside the main transaction. While good for performance, it introduces a risk of eventual consistency issues if the async task fails silently.
