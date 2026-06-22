# Prisma Design Policy Document

## 1. Naming Conventions
- **Models:** PascalCase, singular (e.g., `GamingCenter`, `Reservation`).
- **Fields:** camelCase (e.g., `hourlyRate`, `customerProfileId`).
- **Enums:** PascalCase for the enum name, UPPER_SNAKE_CASE for values (e.g., `ReservationStatus { PENDING, CONFIRMED }`).
- **Indexes/Constraints:** Descriptive naming is handled by Prisma defaults, but unique composite constraints follow `field1_field2` pattern when explicitly named.
- **Tables:** Prisma maps model names directly to PostgreSQL table names (PascalCase).

## 2. Relationship Rules
- **One-to-Many (1-N):** Preferred for hierarchical data (e.g., `GamingCenter` -> `Page`). Always include a back-relation on the child model.
- **Many-to-Many (N-N):**
  - **Explicit Pivot Tables:** Strongly preferred when the relationship carries metadata (e.g., `StaffStationSkill` with `skillLevel`).
  - **Implicit Relations:** Used only for simple associations with no extra data (though rare in this schema; e.g., `GamingCenter.games` is a simple `String[]` array instead of a relation).
- **Cascading Deletes:** Used judiciously. Typically applied to owner-member relations (e.g., `Page` -> `PageSection` with `onDelete: Cascade`). Critical business entities (e.g., `Reservation`) often avoid cascading deletes to preserve audit trails.

## 3. Module Boundaries & Schema Organization
- **Monolithic Schema:** A single `schema.prisma` file is used to maintain a global view of the database.
- **Module Mapping:** Each Prisma model maps to a specific domain module in `src/modules/` (e.g., `Reservation` model -> `src/modules/reservation/`).
- **Shared Models:** Core entities like `GamingCenter` and `User` are referenced across almost all modules, acting as the glue.

## 4. Multi-Tenant Design Pattern
- **Discriminator Field:** `gamingCenterId` is present in almost all tenant-scoped models.
- **Tenant Isolation:** Enforced via `tenantGuardExtension` in `src/config/prisma-extensions.ts`. This extension intercepts queries and logs warnings if the `gamingCenterId` filter is missing.
- **Global CRM:** `CustomerAccount` acts as a global identity across tenants, while `CustomerProfile` is the tenant-specific link.

## 5. Migration Constraints & Strategies
- **Soft Delete:** Not implemented as a boolean flag. Instead, uses an `isActive` boolean or status transitions (e.g., `CANCELED`) to maintain data integrity.
- **Audit Fields:** Every model includes `createdAt` and `updatedAt`.
- **Audit Logging:** An `AuditLog` model captures `oldData` and `newData` for critical mutations, managed by the `audit` module.
- **Slug History:** `PageSlugHistory` is used to handle 301 redirects when page slugs change, preventing SEO breakage.

## 6. Migration Mapping (Django Alignment)
- **Pattern Preservation:**
  - Map Django's `ForeignKey` to Prisma's `@relation` + scalar field.
  - Convert Django's `ManyToManyField` to explicit pivot tables if any metadata is needed, or implicit if purely associative.
  - Map Django's `Choices` to Prisma `enum`.
- **Patterns NOT to transfer:**
  - Avoid Django's implicit `id` (Auto-incrementing Integer) in favor of `cuid()` or `uuid()` for distributed safety and security.
  - Avoid Django's signals for business logic; use the `Station` (Service) layer or BullMQ events instead.

## 7. Anti-Patterns to Avoid
- **Raw HTML in DB:** Content for CMS should be stored as `JSON` (block-based) in `PageSection.dataJson` to allow multi-platform rendering.
- **Cross-Tenant Leaks:** Never query tenant-scoped models without a `gamingCenterId` or `customerAccountId` filter.
- **Direct Controller-Repo Access:** Business logic MUST reside in the `Station` layer, not the `Controller` or `Repository`.
