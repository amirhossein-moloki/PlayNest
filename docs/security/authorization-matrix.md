# Authorization Matrix — Sayra Gaming-Net Platform

## 1. Overview & Security Architecture

Sayra enforces a strict multi-tenant, role-based access control (RBAC) security model built into Express.js middleware and domain services (`stations`).

### Core Security Principles:
1. **Authentication vs Authorization**: Authentication verifies the caller's identity via JWT access tokens (`authMiddleware`), while authorization verifies whether the caller possesses the required permissions (`requireRole`, `requireActorType`, `tenantGuard`).
2. **Tenant Isolation**: Operational APIs are tenant-scoped under `/api/v1/gamingCenters/:gamingCenterId/`. The `tenantGuard` middleware validates that the authenticated `USER` belongs to the target `gamingCenterId`. Cross-tenant access returns `404 Not Found` to prevent tenant enumeration attacks.
3. **Actor Differentiation**: Identity tokens encode `actorType` (`USER` for staff/management vs `CUSTOMER` for end-users). Restricted APIs enforce allowed actor types using `requireActorType`.
4. **Data Ownership & Least Privilege**: Customers can only access or modify their own customer profiles, wallet balance, and reservations (`customerAccountId` match).
5. **Resource Boundaries & Non-Disclosure**: Unauthorized resource access attempts return `403 Forbidden` or `404 Not Found` without disclosing internal server/database details.

---

## 2. Actors & Roles

| Actor Category | Role Identifier | Scope | Description |
|---|---|---|---|
| **Anonymous Visitor** | Unauthenticated | Public | Can view public CMS pages, blog articles, gaming center details, and station availability. Can request OTPs. |
| **Customer** | `CUSTOMER` (Account) | Customer-scoped | Authenticated end-user booking reservations, managing their wallet, viewing own tickets and profile. |
| **Trainee / Staff** | `TRAINEE`, `STAFF` | Site-scoped | Ground staff managing station check-ins, walk-in reservations, and live gaming sessions. |
| **Supervisor** | `SUPERVISOR` | Site-scoped | Shift supervisor moderating blog comments, viewing operational analytics, and managing customer profiles. |
| **Site Manager** | `MANAGER` | Site-scoped | Gaming center manager/owner with full control over site settings, CMS, staff, discounts, and audit logs. |
| **Support Agent** | `SUPPORT` | System/Global | Support representative handling technical, financial, and account tickets across customers. |
| **System Administrator** | `ADMIN` | System/Global | Platform administrator with global access across all gaming centers, users, system settings, and tickets. |

---

## 3. Comprehensive Authorization Matrix

Legend:
- **A**: Allowed
- **O**: Owned Resources Only
- **D**: Denied / Forbidden

| Domain Module | Operation / Endpoint | Anonymous | Customer | Staff / Trainee | Supervisor | Manager | Support | Admin |
|---|---|---|---|---|---|---|---|---|
| **Auth & Profile** | Request / Verify Phone OTP | A | A | D | D | D | D | D |
| | Staff Login (`/api/v1/auth/login`) | A | D | A | A | A | A | A |
| | Get / Update Own Profile | D | O | O | O | O | O | O |
| **Reservations** | Public Booking (`/api/v1/public/.../reservation`) | A | A | D | D | D | D | D |
| | List / Create Site Reservations | D | D | A | A | A | D | A |
| | Update Lifecycle (Confirm, Cancel, Start, Complete) | D | D | A | A | A | D | A |
| | Reschedule Time Proposals (Propose) | D | D | A | A | A | D | A |
| | Accept / Reject Time Proposals | D | O | D | D | D | D | A |
| **Group Bookings**| Public Group Checkout | A | A | D | D | D | D | D |
| | Operator Group Booking Management | D | D | A | A | A | D | A |
| **Discounts** | List / Create / Deactivate Discounts | D | D | D | D | A | D | A |
| **CMS / Site** | Public Page / Media / Address Delivery | A | A | A | A | A | A | A |
| | Manage Site Pages, Links, Media, Settings | D | D | D | D | A | D | A |
| **Blog & Content**| View Published Blog Posts & Comments | A | A | A | A | A | A | A |
| | Create / Edit Own Blog Posts | D | D | A | A | A | D | A |
| | Moderate / Pin / Delete Comments | D | D | D | A | A | D | A |
| | Manage Categories, Tags & Navigation | D | D | D | D | A | D | A |
| **Staff & Users** | Create / Update Site Staff Users | D | D | D | D | A | D | A |
| | Assign Roles & Permissions | D | D | D | D | A | D | A |
| | View Staff Shifts & Skills | D | D | A | A | A | D | A |
| **Tickets / Support**| Submit Ticket / Reply to Own Ticket | D | O | D | D | D | D | D |
| | View & Claim Open Support Tickets | D | D | D | D | D | A | A |
| | Admin Ticket Management | D | D | D | D | D | D | A |
| **Audit Logs** | Query Site Audit Logs (`/audit-logs`) | D | D | D | D | A | D | A |
| | System Administrative Audit Queries | D | D | D | D | D | D | A |

---

## 4. Ownership & Tenant Boundaries

1. **User Role Administration**:
   - Only `MANAGER` and `ADMIN` can create user accounts or alter user roles (`UserRole`).
   - A `MANAGER` can only manage staff (`TRAINEE`, `STAFF`, `SUPERVISOR`, `MANAGER`) within their assigned `gamingCenterId`.
   - Users cannot escalate their own permissions or alter claims in JWT payloads.

2. **Customer Resource Isolation**:
   - Endpoints under `/api/v1/customer-panel/` resolve the authenticated `customerAccountId` directly from `req.actor.id`.
   - Payload inputs specifying `customerAccountId` or `customerId` are ignored in favor of the verified session principal.

3. **Audit Log Access**:
   - Audit query endpoints require `authMiddleware`, `tenantGuard`, and `requireRole([UserRole.MANAGER, UserRole.ADMIN])`.
   - Audit records returned are strictly scoped to the caller's `gamingCenterId`.
