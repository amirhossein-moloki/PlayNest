# PlayNest Backend Security Audit & Remediation Report

**Audit Date:** 2026-11-26  
**Project Management Single Source of Truth:** Linear (`Backend Security Audit & Remediation`, `P-AMI-4`)  
**Git Branches (Local, Unpushed):**
- Root monorepo (`PlayNest`): `security/audit-remediation`
- Nested Blog repository (`Blog/`): `security/audit-remediation`

---

## 1. Executive Summary

An end-to-end backend security audit, validation, remediation, OpenAPI synchronization, and Linear tracking engagement was completed across the PlayNest platform:
1. **`sayra/`**: TypeScript / Express.js / Prisma ORM / PostgreSQL / Redis / BullMQ / AdminJS backend API (`sayra/openapi.yml` — OpenAPI `3.0.0`, `352` paths).
2. **`Blog/`**: Python / Django 5.2 / Django REST Framework / Channels / Celery CMS service.
3. **Infrastructure & CI/CD**: `docker-compose.yml`, `docker-compose.dev.yml`, `docker/docker-compose.yml`, `docker/Dockerfile`, `Blog/Dockerfile`, `docker/nginx/conf.d/app.conf.template`, PostgreSQL initialization & Restic backup/restore scripts, and GitHub Actions workflows.

Across all three layers, **34 validated security findings** (`SEC-001` through `SEC-034`, tracked in Linear as `AMI-46` through `AMI-79`) were confirmed, scored with CVSS v4.0, and synchronized with Linear:

| Severity | Confirmed Findings | `Done` (Verified) | `In Progress` (Awaiting Django CI) | `In Progress` (`Blocked` Manual Ops / Major Upgrades) |
| --- | ---: | ---: | ---: | ---: |
| **Critical** | 13 | 11 | 1 (`AMI-56`) | 1 (`AMI-57`) |
| **High** | 14 | 7 | 5 (`AMI-64`..`AMI-68`) | 2 (`AMI-70`, `AMI-72`) |
| **Medium** | 6 | 5 | 1 (`AMI-77`) | 0 |
| **Low** | 1 | 1 | 0 | 0 |
| **Total** | **34** | **24** | **7** | **3** |

---

## 2. Scope, Architecture & Trust Boundaries

### 2.1 Application Architecture
- **Edge & Reverse Proxy (`docker/nginx/conf.d/app.conf.template`):** Terminates external TLS and routes requests to `sayra:3000` (`api.sayra-booking.ir`, `/api/v1`, `/api/public`, `/r`, `/s`, `/platform-admin-panel`) and `blog_web:8000` (`blog.sayra-booking.ir`, `/admin/`, `/api/`).
- **Sayra Backend (`sayra/src/`):** Express API with JWT Bearer access tokens (`USER`, `CUSTOMER`, `PLATFORM_ADMIN`), Platform Admin TOTP 2FA + HttpOnly refresh cookies (`playnest_admin_refresh`), AdminJS panel (`admin.authorization.ts`), PostgreSQL + Prisma transactional logic (bookings, wallets, withdrawals, discounts, reviews, CMS, short links, webhooks), and BullMQ/Redis workers.
- **Blog Backend (`Blog/`):** Django 5.2 / DRF API serving articles, translations, dynamic JSON `content_blocks`, media uploads, comments/reactions, webhooks, and `django-axes` / SimpleJWT auth + `StaticAPIKeyAuthentication`.
- **Operations & Disaster Recovery (`docker/backup/`):** Restic snapshot cron container backing up PostgreSQL (`pg_dump`), Redis RDB snapshots, media/upload volumes, and container configurations.

### 2.2 Trust Boundaries
1. **Unauthenticated Edge -> Origin Services:** Cloudflare / reverse-proxy IP forwarding (`X-Forwarded-For`), HTTP -> HTTPS redirect, SSR rate-limit exemption (`X-SSR-Secret`), and public search/redirect endpoints.
2. **Actor Separation (`CUSTOMER` vs Tenant `STAFF`/`MANAGER` vs `PLATFORM_ADMIN`):** Strict isolation of actor types, gaming-center tenant boundaries (`tenantGuard`), wallet ownership, and superuser console access.
3. **Payment & Webhook Boundary:** Zibal / payment gateway callbacks, `/webhooks/*` HMAC verification, and idempotent ledger state transitions.
4. **File & Rich Content Pipeline:** Multipart uploads (KYC documents, CMS media, CKEditor uploads, block JSON/HTML, AdminJS UI templates) and backup/restore archives (`tarfile`, S3 keys, `bdr_crypto.py`).
5. **Infrastructure & Supply Chain:** Secrets lifecycle, `.gitignore`, PostgreSQL/Redis internal authentication, GitHub Actions CI permissions, and third-party dependency trees (`sayra/package-lock.json`, `Blog/requirements.txt`).

---

## 3. Methodology, Available Tools & Honest Tooling Constraints

### 3.1 Methodology
1. Multi-agent parallel source-to-sink security reconnaissance across Sayra auth/RBAC, Sayra payments/wallet/business logic, Sayra injection/XSS/uploads/SSRF, Django Blog, and Infra/Docker/Nginx/CI/CD.
2. Manual taint tracing, false-positive filtering, and CVSS v4.0 scoring.
3. Prioritized Linear-driven remediation (Critical -> High -> Medium -> Low), OpenAPI synchronization, regression test authoring, and final verification.

### 3.2 Scanners & Skills Inventory
- **Available Skills Used:** `audit-context-building`, `differential-review`, `fp-check`, `supply-chain-risk-auditor`, `variant-analysis`, `patching-bugs`, `post-patch-validation`, `property-based-testing`, `cvss-scoring`, `sharp-edges`, `semgrep-rule-creator`, `agentic-actions-auditor`.
- **Unavailable Prompted Skills:** Standalone skills named `cloudflare security-audit`, `static-analysis`, and `insecure-defaults` were not present in the local skills registry.
- **Installed CLI Runtimes & Scanners:**
  - Available: `npm`, `python3`, `node`, `bash`, `docker`.
  - Not Installed locally: `semgrep` (`NOT_INSTALLED`), `codeql` (`NOT_INSTALLED`), `zap-cli` (`NOT_INSTALLED`), `trivy` (`NOT_INSTALLED`), `gitleaks` (`NOT_INSTALLED`).
  - Note on Environment Gaps: No Django virtualenv or local `playenest_test` PostgreSQL server is installed on the audit host. Pure-Python `Blog` security tests and `py_compile` ran locally; Django ORM/DRF integration tests (`Blog/tests/security/test_blog_security.py`) are ready for CI execution via `python manage.py test tests.security.test_blog_security`.

---

## 4. Security Posture Comparison (Before vs. After)

| Risk Area | Before Remediation | After Remediation |
| --- | --- | --- |
| **AdminJS & Platform Admin Auth** | `req.originalUrl.includes()` auth bypass; hardcoded cookie secret fallback; stored XSS across admin dashboards | Strict path/session middleware (`SEC-001`), fail-closed secret guards (`SEC-013`, `SEC-017`), DOM/HTML encoding across AdminJS & templates (`SEC-010`) |
| **OTP, Sessions & RBAC** | Deprecated OTP ATO (`SEC-002`), unauthenticated onboarding bypass (`SEC-009`), tenant `MANAGER` -> `ADMIN` escalation (`SEC-014`), `AuthorProfileSerializer` PK takeover & `StaticAPIKeyAuthentication` superuser fallback (`SEC-023`) | Strict OTP purpose/attempt binding, single-use tokens, refresh rotation & logout revocation (`SEC-017`), `read_only_fields = ("user",)`, non-superuser HMAC static key (`SEC-023`) |
| **Payments, Wallets & Discounts** | Unauthenticated `/webhooks` & `/verify` (`SEC-003`), cross-customer wallet drain (`SEC-004`), group-booking 2x refund (`SEC-005`), withdrawal double-spend (`SEC-006`), unauth discount lifecycle (`SEC-007`), global campaign fraud (`SEC-008`), promo races & free VIP reschedule (`SEC-018`) | Raw-body HMAC verification, actor/tenant ownership guards, `FOR UPDATE` / atomic quota & ledger locks, server-side pricing/tier recomputation, platform-admin campaign scoping |
| **Edge, Django Blog & Backups** | Port 80 plaintext & spoofable `XFF`, HSTS dropped in locations, `backups/` mounted inside Git repo (`SEC-012`), Redis/PG SQL/shell injection (`SEC-026`), Blog IDOR purge/restore (`SEC-011`), Tar Slip & BDR stream truncation (`SEC-024`) | HTTPS 301 + shared security header snippet + `$remote_addr` forwarding, hardened shell scripts (`set -euo pipefail`, `psql -v`), `safe_extract_tar`/`safe_resolve_under_root`, authenticated `BDRGCMv2`, hardened Dockerfiles & GitHub Actions |

---

## 5. Companion Deliverables

- [`VULNERABILITIES.md`](file:///home/amir/github-projects/PlayNest/VULNERABILITIES.md) — Complete registry of `SEC-001`..`SEC-034` (`AMI-46`..`AMI-79`) with CVSS v4.0 vectors and statuses.
- [`REMEDIATION-REPORT.md`](file:///home/amir/github-projects/PlayNest/REMEDIATION-REPORT.md) — Detailed engineering changelog across Sayra, Blog, OpenAPI, Prisma, and Infra/CI.
- [`SECURITY-TEST-RESULTS.md`](file:///home/amir/github-projects/PlayNest/SECURITY-TEST-RESULTS.md) — Exact observed compiler, schema, unit, security, shell, and YAML verification outputs.
- [`SECURITY-ROADMAP.md`](file:///home/amir/github-projects/PlayNest/SECURITY-ROADMAP.md) — Operator runbooks for blocked manual actions (`AMI-57`, `AMI-70`, `AMI-72`) and Django CI execution.
