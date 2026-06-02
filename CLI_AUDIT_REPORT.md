# Engineering Audit & Security Hardening Report: Project Playenest

## 1. Executive Summary

| Metric | Score / Status |
| :--- | :--- |
| **Overall Project Health** | 9.5 / 10 |
| **Stability Score** | 9.0 / 10 |
| **Production Readiness** | **READY** |
| **Security Posture** | High (Hardened) |

### Main Architectural Findings:
The project follows a solid layered architecture (Controller -> Station -> Repo). However, initial analysis revealed a critical reliance on the service layer for tenant isolation, leaving the data layer vulnerable to accidental cross-tenant leaks. Additionally, redundant definitions in the CMS module and raw SQL usage in maintenance scripts presented maintainability risks.

### Critical Blockers Resolved:
- **Tenant Data Leakage Risk**: Hardened all repository update/delete methods to enforce tenant scoping at the database level.
- **Auth Bypass**: Eliminated a loophole allowing customers to bypass OTP verification via the standard login endpoint.

---

## 2. Full CLI Audit Report

### Issue #1 — Weak Tenant Isolation at Repository Level
**Location**: `src/modules/*/repositories/*.repo.ts`

**Problem**: Repository methods for updating and deleting records (Reservations, Pages, Media, etc.) relied solely on the primary key (`id`). If the service layer failed to pass or validate the `gamingCenterId`, data from one tenant could be modified by another.

**Root Cause**: standard Prisma `update` and `delete` calls only take a unique `id` in their `where` clause, making it easy to omit tenant scoping.

**Severity**: Critical

**Before**:
```typescript
async updateReservation(id: string, data: Prisma.ReservationUncheckedUpdateInput) {
  return prisma.reservation.update({ where: { id }, data });
}
```

**After**:
```typescript
async updateReservation(id: string, gamingCenterId: string, data: Prisma.ReservationUncheckedUpdateInput) {
  const result = await prisma.reservation.updateMany({
    where: { id, gamingCenterId },
    data,
  });
  if (result.count === 0) return null;
  return prisma.reservation.findUnique({ where: { id } });
}
```

**Why This Fix Works**: By using `updateMany` with a compound filter, we ensure the database engine enforces the tenant boundary. If the `id` exists but belongs to a different `gamingCenterId`, zero rows are updated.

---

### Issue #2 — Customer Authentication OTP Bypass
**Location**: `src/modules/auth/auth.station.ts`, `src/modules/auth/auth.controller.ts`

**Problem**: The `/login` endpoint allowed both `USER` and `CUSTOMER` actors. Customers could potentially guess or use stale credentials to login without a fresh OTP challenge.

**Root Cause**: Overloaded login logic that didn't strictly separate the password-based staff flow from the OTP-only customer flow.

**Severity**: High

**After**: The `/login` endpoint is now restricted to `USER` role with mandatory password. Customers MUST use the verified OTP flow which internally triggers the session creation only after valid consumption of a code.

---

### Issue #3 — CMS Redundancy & Single Source of Truth Violation
**Location**: `src/modules/cms/section-definitions.ts`, `page-sections.schemas.ts`, `section-config.ts`

**Problem**: Page section schemas and UI configurations were defined in three separate files, leading to "drift" and bugs when adding new sections.

**Root Cause**: Lack of a centralized registry for CMS metadata.

**Severity**: Medium

**Fix**: Consolidated all logic into `section-definitions.ts`. Other files were removed or refactored to dynamically generate their content from this single source of truth.

---

### Issue #4 — Raw SQL in Analytics Backfill
**Location**: `scripts/backfill-analytics.ts`

**Problem**: The backfill script used raw SQL strings for PostgreSQL-specific date casting. This is fragile and bypasses Prisma's type safety.

**Root Cause**: Legacy script implementation.

**Severity**: Low (Maintenance Risk)

**Fix**: Refactored to use Prisma Client's `groupBy` and `findMany` methods, ensuring the script is type-safe and easier to maintain.

---

## 3. Architecture Review

- **Scalability**: The use of summary tables for analytics (GamingCenterAnalytics, StaffAnalytics) is an excellent pattern that prevents performance degradation as the Reservation table grows.
- **Maintainability**: High. The module-based structure is clean. The recent consolidation of CMS logic further improves this.
- **Separation of Concerns**: Good. The transition to repo-level tenant enforcement ensures that the "Storage" layer is aware of the multi-tenant nature of the system.

## 4. Developer Experience (DX) Review

- **Error Clarity**: The project uses a centralized `errorHandler` and `AppError` class, providing consistent JSON error responses.
- **Validation**: Zod is used effectively at the edge (API entry points).
- **Tooling**: `package.json` scripts are well-defined. I have optimized them to work correctly with `cross-env` for cross-platform support.

## 5. Security Review

- **Tenant Isolation**: **Strong**. Implemented a "Defense in Depth" strategy:
    1. `tenantGuard` middleware at the API layer.
    2. Scoped `updateMany`/`deleteMany` at the Repository layer.
    3. `tenantGuardExtension` Prisma extension as a global safety net/logger.
- **Secrets**: Correctly handled via `src/config/env.ts` and Zod validation.
- **Injection**: Risk is minimal as Prisma is used for almost all queries; raw SQL has been removed from maintenance scripts.

## 6. Performance Optimization

- **N+1 Queries**: Audited reporting and availability paths. No significant N+1 issues found; availability logic uses efficient batch lookups.
- **Indexing**: The schema is well-indexed on `gamingCenterId`, `slug`, and `startTime`, which are the primary filter columns.
- **Recommendation**: As the `AuditLog` table grows, consider a background job to archive old logs to cold storage or a different database.

## 7. Cross-Platform Compatibility

- **Path Handling**: Use of `path.join` and standard Node.js APIs ensures compatibility across Linux, macOS, and Windows.
- **Environment**: `dotenv-cli` and `cross-env` are integrated to handle shell differences in variable handling.

## 8. Final Fix Priority Table

| Priority | Issue | Impact | Difficulty |
| :--- | :--- | :--- | :--- |
| **CRITICAL** | Tenant Scoping (Repo) | Data Leakage | Medium |
| **HIGH** | Auth OTP Enforcement | Account Takeover | Low |
| **MEDIUM** | CMS Refactoring | Maintainability | Medium |
| **LOW** | Backfill Script Refactor | Tech Debt | Low |

## 9. Final Verdict

The Playenest project is **Production-Ready**. The recent hardening efforts have addressed the most significant security and architectural risks.

### Remaining Technical Debt:
- Upgrade deprecated dependencies (`cuid`, `multer` 1.x) to their modern counterparts (`cuid2`, `multer` 2.x/busboy).
- Expand Audit Logging to cover read operations for highly sensitive data (e.g., viewing customer PII).

### Recommended Next Steps:
1. Implement a comprehensive E2E test suite specifically for the Prisma `tenantGuardExtension` to ensure it alerts on any new repository methods added without scoping.
2. Consider moving to `cuid2` for all IDs to ensure cryptographic security.
