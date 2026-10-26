# Play-Nest Analytics — Phase 6 Security & Tenant Isolation
## Security Architecture, Authorization Controls, and Threat Model

---

## 1. Security Objectives
Phase 6 enforces multi-tenant data isolation and privacy protection across all owner-facing analytics APIs, background processes, and user interfaces.

---

## 2. Server-Side Security Boundaries

### 2.1 Multi-Layered Enforcement Pipeline
1. **Layer 1 — Authentication (`authMiddleware`)**:
   - Validates incoming `Authorization: Bearer <token>` JWT headers.
   - Verifies session state against `Session` model.
   - Rejects unauthenticated requests with **HTTP 401 Unauthorized**.
   - Attaches `req.actor` containing `actorId`, `actorType`, `gamingCenterId`, and `role`.

2. **Layer 2 — Tenant Guard (`tenantGuard`)**:
   - Extracts `:gamingCenterId` route parameter.
   - Asserts `req.actor.gamingCenterId === req.params.gamingCenterId`.
   - **Enumeration Defense**: If `actor.gamingCenterId` does not match `req.params.gamingCenterId`, returns **HTTP 404 Not Found**. This prevents unauthorized users from determining whether a given `gamingCenterId` exists in the system.
   - Attaches `req.tenant = { gamingCenterId }`.

3. **Layer 3 — Role Authorization (`requireRole`)**:
   - Mandates that `req.actor.role` belongs to `[UserRole.MANAGER, UserRole.ADMIN]`.
   - Rejects lower-privilege roles (`STAFF`, `SUPERVISOR`, `TRAINEE`, `SUPPORT`) with **HTTP 403 Forbidden**.

4. **Layer 4 — Repository Query Isolation (`AnalyticsRepo`)**:
   - All SQL / Prisma queries enforce `where: { gamingCenterId: req.tenant.gamingCenterId }`.
   - Client-supplied body or query parameters cannot alter or override the `gamingCenterId` filter.

---

## 3. Threat Model & Mitigation Matrix

| Threat Scenario | Attack Vector | Security Control | Result |
|---|---|---|---|
| Cross-Tenant Data Access | User A (`gc-1`) requests `/gamingCenters/gc-2/analytics/summary` | `tenantGuard` detects `actor.gamingCenterId !== params.gamingCenterId` | HTTP 404 Not Found (Data isolated & hidden) |
| Tenant Enumeration Attack | Attacker probes random CUIDs on `/analytics/summary` to find active tenants | `tenantGuard` responds with uniform HTTP 404 for unauthorized IDs | Zero leakage of tenant existence |
| Privilege Escalation | Staff user (`role: STAFF`) requests owner analytics endpoints | `requireRole([UserRole.MANAGER, UserRole.ADMIN])` checks actor role | HTTP 403 Forbidden |
| Parameter Injection / Bypassing Scope | Client appends `?gamingCenterId=gc-other` to request query | Controllers ignore client parameter and pass `req.tenant.gamingCenterId` to Station | Parameter ignored, scope maintained |
| Customer PII Harvesting | Attacker attempts to fetch full customer phone numbers via top spenders endpoint | `AnalyticsStation.getTopSpenders` executes `maskPhone(phone)` (`0912***1234`) | PII masked, zero phone leakage |
| Date Range DoS | Client requests 10-year date range to overload analytical database | `AnalyticsQuerySchema` validates `endDate - startDate <= 365` days | HTTP 400 Bad Request |

---

## 4. PII Protection Engineering
Customer privacy is enforced at the Station layer. The `maskPhone` helper transforms phone strings prior to returning JSON responses:

```typescript
function maskPhone(phone?: string | null): string {
  if (!phone || phone.length < 7) return '***';
  return phone.slice(0, 4) + '***' + phone.slice(-4);
}
```

Example transformation: `09123456789` $\rightarrow$ `0912***6789`.

---

## 5. Test Evidence Summary
Automated isolation and authorization test suites in `sayra/tests/api/analytics/analytics.api.spec.ts` and `sayra/tests/unit/modules/analytics/analytics.phase6.spec.ts` verify:
- HTTP 401 for missing/invalid bearer tokens.
- HTTP 403 for `STAFF` role access attempts.
- HTTP 404 for cross-tenant access attempts (`gc-1` user requesting `gc-2` route).
- HTTP 400 for date range overflow (>365 days) or inverted dates (`startDate > endDate`).
- Masking of phone numbers in customer analytics reports.
