# Security & Audit Architecture — Sayra Server

## 1. Authentication Architecture

Sayra utilizes stateless JWT authentication and OTP-based mobile session authentication.

### Token Specification & Workflow
- **Access Tokens**: Short-lived JWTs signed with HMAC SHA-256 (`env.JWT_ACCESS_SECRET`). Payload includes `sessionId`, `actorId`, and `actorType` (`USER` | `CUSTOMER`).
- **Session Model**: Sessions are persisted in PostgreSQL (`Session` table). Upon logout or security events, sessions are revoked (`revokedAt`). `authMiddleware` validates JWT signatures and ensures active session records in DB.
- **OTP Subsystem**: Phone OTP authentication (`PhoneOtp` model) generates hashed OTP codes (`codeHash`). Raw OTP codes are transmitted via SMS and never logged or stored in plain text.

---

## 2. Authorization Policy Design

Authorization is layered using modular Express.js middlewares:

1. `authMiddleware`: Parses Authorization Bearer header, verifies JWT signature, fetches active user/customer, and populates `req.actor`.
2. `tenantGuard`: Validates that `req.params.gamingCenterId` matches `req.actor.gamingCenterId`. Returns `404 Not Found` on mismatch to prevent tenant enumeration.
3. `requireRole(allowedRoles: UserRole[])`: Checks that `req.actor.role` is included in allowed roles (e.g. `[UserRole.MANAGER, UserRole.ADMIN]`). Returns `403 Forbidden` if unauthorized.
4. `requireActorType(allowedType: SessionActorType)`: Restricts routes specifically to `USER` or `CUSTOMER` actors.

---

## 3. Resource & Tenant Isolation Mechanics

- **Site & Resource Boundaries**: Operations on stations, shifts, discounts, reservations, and site settings validate that the target resource belongs to the tenant (`gamingCenterId`).
- **Self-Service / Customer Scope**: Customer routes extract identity directly from `req.actor.id` (Session Principal) rather than trust `customerId` or `customerAccountId` in caller payload.
- **Fail-Closed Strategy**: Any unverified permission or missing context defaults to rejection (`401 Unauthorized` or `403 Forbidden`).

---

## 4. Audit Trail Specification

Sensitive domain mutations are recorded in the append-only `AuditLog` table.

### Schema Structure:
- `id`: CUID identifier
- `gamingCenterId`: Target site tenant ID
- `userId` / `customerId`: Actor performing mutation
- `action`: Domain action constant (e.g., `USER_CREATE`, `USER_ROLE_UPDATE`, `SETTINGS_UPDATE`, `RESERVATION_CANCEL`)
- `entity` & `entityId`: Target resource type and ID
- `oldData` & `newData`: Structured JSON state change snapshots
- `ipAddress` & `userAgent`: Network context metadata
- `createdAt`: UTC timestamp

### Data Minimization & Sanitization Standards:
The audit logger automatically strips sensitive fields before persisting JSON snapshots.
**Explicitly Excluded Fields**:
- Passwords (`password`, `passwordHash`)
- Access/Refresh Tokens (`token`, `accessToken`, `refreshToken`)
- OTP Codes (`code`, `codeHash`, `otp`)
- Authentication Secrets & Keys (`secret`, `signingKey`)
- Financial Credentials (`cardNumber`, `cvv`, `rawProviderPayload`)

### Atomicity Guarantees:
For critical business mutations (such as user management, reservation cancellations, setting updates, and discount creations), audit log records are written within the same database transaction (`Prisma.TransactionClient`) as the business change. If the transaction rolls back, both the mutation and the audit record roll back together, preventing phantom audit entries.
