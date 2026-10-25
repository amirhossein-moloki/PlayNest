# Phase 13 — Security Review & Hardening Report

**System:** Sayra Modular Monolith Backend (`sayra/`)
**Target Version:** v1.0.0-GA
**Review Status:** Verified & Compliant
**Lead Security Assessor:** Jules (Senior Software Architect)

---

## 1. Security Architecture Overview

The Sayra backend applies defense-in-depth security principles across authentication, authorization, input validation, data sanitization, transport security, and secret handling.

```
[ Client Request ]
       │
       ▼
[ Reverse Proxy / HTTPS / Cloudflare ]
       │
       ▼
[ Helmet Security Headers & CORS Filter ]
       │
       ▼
[ Rate Limiter (Redis / Express Rate Limit) ]
       │
       ▼
[ Static API Key Middleware ] ── (Validates X-API-KEY header)
       │
       ▼
[ Authentication Middleware ] ── (Validates Bearer JWT Access Token)
       │
       ▼
[ Tenant Guard Middleware ] ──── (Enforces gamingCenterId Isolation)
       │
       ▼
[ Role Guard Middleware ] ────── (Enforces MANAGER / ADMIN / STAFF RBAC)
       │
       ▼
[ Zod Input Validation ] ────── (Strips unknown fields & validates bounds)
       │
       ▼
[ Domain Station / Application Layer ]
```

---

## 2. Authentication & Session Management

### 2.1 Identity Verification
- **User Authentication:** Password verification via `argon2` / `bcryptjs`.
- **Customer Authentication:** Phone OTP verification with rate-limited attempts, hash verification, and 5-minute post-verification window.
- **JWT Tokens:**
  - Access Token: Short-lived (default `15m`), signed with `JWT_ACCESS_SECRET`.
  - Refresh Token: Long-lived (default `7d`), signed with `JWT_REFRESH_SECRET`.
- **Revocation:** Session table tracks active tokens (`Session.tokenHash`, `expiresAt`, `revokedAt`). Revoked tokens are rejected immediately.

### 2.2 Production Secret Validation
`sayra/src/config/env.ts` enforces that when `NODE_ENV=production`, application startup fails immediately if default placeholder secrets are detected:
- `JWT_ACCESS_SECRET` must not equal `'generate_at_least_32_chars_long_random_string'`.
- `JWT_REFRESH_SECRET` must not equal `'generate_another_at_least_32_chars_long_random_string'`.
- `STATIC_API_KEY` must not equal `'generate_a_secure_api_key_at_least_10_chars'`.

---

## 3. Authorization, RBAC & Tenant Isolation

### 3.1 Role-Based Access Control (RBAC)
Role hierarchy enforced by `requireRole(...)` middleware:
- `ADMIN`: Global system administration access.
- `MANAGER`: Gaming center site management, staff management, settings, discounts, reports, and financial reconciliation.
- `STAFF` / `SUPERVISOR`: Daily operational booking actions (Confirm, Start, Complete, No-Show, Reschedule). Restricted to assigned staff reservations.
- `CUSTOMER`: Public & Customer Panel endpoints. Allowed to view own bookings, waitlist entries, and create tickets.

### 3.2 Tenant Isolation (`tenantGuard`)
- Every management request validates `req.params.gamingCenterId` or `req.body.gamingCenterId` against the user's assigned `gamingCenterId`.
- Cross-tenant requests are denied with `403 FORBIDDEN`.

---

## 4. Input Validation & API Defense

### 4.1 Schema Validation
- All incoming payloads pass through `validate(schema)` middleware powered by `zod`.
- Mass-assignment vulnerabilities are prevented because `zod` schemas discard unvalidated fields. Server-managed fields (e.g. `totalPrice`, `paymentState`, `createdByUserId`, `status`) cannot be manipulated by clients.

### 4.2 Rate Limiting
- Sensitive public endpoints (e.g., public booking, OTP requests) are rate-limited via `express-rate-limit` / Redis store (`rate-limit-redis`).
- Excessive requests return `429 Too Many Requests`.

---

## 5. Privacy, Data Redaction & Audit Safety

### 5.1 Sensitive Data Sanitization
- Passwords, hashes, OTP codes, JWT tokens, credit card details, and provider secret keys are stripped before persisting to `AuditLog` or writing to logs via `sanitizeAuditData` in `sayra/src/modules/audit/audit.station.ts`.
- Notification log diagnostic errors sanitize sensitive parameters (`sanitizeDiagnostics`).

### 5.2 Error Exposure Protection
- `errorHandler` in `sayra/src/common/errors/errorHandler.ts` checks `NODE_ENV`.
- For `5xx` internal server errors in production, detailed stack traces and raw error objects are omitted from API responses, returning a clean `{ code: "INTERNAL_ERROR", message: "An unexpected internal server error occurred." }`.

---

## 6. Transport & HTTP Response Security

### 6.1 Helmet Security Headers
- Helmet middleware is enabled (`HELMET_ENABLED=true`).
- Directives include Content Security Policy (CSP), frameguard, hide powered-by, xssFilter, noSniff.

### 6.2 CORS Configuration
- Controlled via `CORS_ORIGIN` environment configuration.
- Wildcards (`*`) blocked when credentials are required; production deployments configure specific client origin domains.
