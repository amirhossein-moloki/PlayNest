# PlayNest Backend Security Audit & Remediation Report

**Audit Date:** 2026-11-26  
**Project Management Single Source of Truth:** Linear (`Backend Security Audit & Remediation`, `P-AMI-4`)  
**Git Branches (Local, Unpushed):**
- Root monorepo (`PlayNest`): `security/audit-remediation`
- Nested Blog repository (`Blog/`): `security/audit-remediation`

---

## 1. Executive Summary

An end-to-end backend security audit, validation, remediation, OpenAPI synchronization, supply-chain hardening, Docker verification, and Linear tracking engagement was completed across the PlayNest platform:
1. **`sayra/`**: TypeScript / Express.js / Prisma ORM / PostgreSQL / Redis / BullMQ / AdminJS backend API (`sayra/openapi.yml` — OpenAPI `3.0.0`, `352` paths).
2. **`Blog/`**: Python / Django 5.2 / Django REST Framework / Channels / Celery CMS service.
3. **Infrastructure & CI/CD**: `docker-compose.yml`, `docker-compose.dev.yml`, `docker/docker-compose.yml`, `docker/Dockerfile`, `Blog/Dockerfile`, `docker/nginx/conf.d/app.conf.template`, PostgreSQL least-privilege role & Restic backup/restore scripts, and GitHub Actions workflows.

Across all three layers, **34 validated security findings** (`SEC-001` through `SEC-034`, tracked in Linear as `AMI-46` through `AMI-79`) were confirmed, scored with CVSS v4.0, and synchronized with Linear:

| Severity | Confirmed Findings | `Done` (Verified) | `In Progress` (Operator / Upstream Gated) |
| --- | ---: | ---: | --- |
| **Critical** | 13 | 12 | 1 (`AMI-57`) |
| **High** | 14 | 12 | 2 (`AMI-70`, `AMI-72`) |
| **Medium** | 6 | 6 | 0 |
| **Low** | 1 | 1 | 0 |
| **Total** | **34** | **31** | **3** |

---

## 2. Scope, Architecture & Trust Boundaries

### 2.1 Application Architecture
- **Edge & Reverse Proxy (`docker/nginx/conf.d/app.conf.template`):** Terminates external TLS and routes requests to `sayra:3000` (`api.sayra-booking.ir`, `/api/v1`, `/api/public`, `/r`, `/s`, `/platform-admin-panel`) and `blog_web:8000` (`blog.sayra-booking.ir`, `/admin/`, `/api/`).
- **Sayra Backend (`sayra/src/`):** Express API with JWT Bearer access tokens (`USER`, `CUSTOMER`, `PLATFORM_ADMIN`), Platform Admin TOTP 2FA + HttpOnly refresh cookies (`playnest_admin_refresh`), AdminJS panel (`admin.authorization.ts`), PostgreSQL + Prisma transactional logic (bookings, wallets, withdrawals, discounts, reviews, CMS, short links, webhooks), native `fetch` SMS notifications (`melipayamak.station.ts`), and BullMQ/Redis workers.
- **Blog Backend (`Blog/`):** Django 5.2.19 / DRF 3.18.3 API serving articles, translations, dynamic JSON `content_blocks`, media uploads, comments/reactions, webhooks, and `django-axes` / SimpleJWT auth + `StaticAPIKeyAuthentication`.
- **Operations & Disaster Recovery (`docker/backup/`, `docker/postgres/`):** Restic snapshot cron container backing up PostgreSQL (`pg_dump` across `playenest_prod` and `blog_prod`), Redis RDB snapshots, media/upload volumes, and container configurations, plus least-privilege database role initialization and migration tooling.

### 2.2 Trust Boundaries
1. **Unauthenticated Edge -> Origin Services:** Cloudflare / reverse-proxy IP forwarding (`$remote_addr`), HTTP -> HTTPS redirect, SSR rate-limit exemption (`X-SSR-Secret`), and public search/redirect endpoints.
2. **Actor Separation (`CUSTOMER` vs Tenant `STAFF`/`MANAGER` vs `PLATFORM_ADMIN`):** Strict isolation of actor types, gaming-center tenant boundaries (`tenantGuard`), wallet ownership, and superuser console access.
3. **Payment & Webhook Boundary:** Zibal / payment gateway callbacks, `/webhooks/*` HMAC verification, and idempotent ledger state transitions.
4. **File & Rich Content Pipeline:** Multipart uploads (KYC documents, CMS media, CKEditor uploads, block JSON/HTML, AdminJS UI templates) and backup/restore archives (`tarfile`, S3 keys, `bdr_crypto.py`).
5. **Infrastructure & Supply Chain:** Secrets lifecycle, `.gitignore`, PostgreSQL least-privilege DB isolation (`sayra_app` / `blog_app`), authenticated Redis, segmented Docker networks, GitHub Actions CI permissions, and third-party dependency trees (`sayra/package-lock.json`, `sayra/pnpm-lock.yaml`, `Blog/requirements.txt`).

---

## 3. Methodology, Available Tools & Honest Tooling Constraints

### 3.1 Methodology
1. Multi-agent parallel source-to-sink security reconnaissance across Sayra auth/RBAC, Sayra payments/wallet/business logic, Sayra injection/XSS/uploads/SSRF, Django Blog, and Infra/Docker/Nginx/CI/CD.
2. Manual taint tracing, false-positive filtering, and CVSS v4.0 scoring.
3. Prioritized Linear-driven remediation, OpenAPI synchronization, regression test authoring, supply-chain upgrades, and containerized SAST/SCA/secret/runtime verification.

### 3.2 Scanners & Skills Inventory
- **Available Skills Used:** `audit-context-building`, `differential-review`, `fp-check`, `supply-chain-risk-auditor`, `variant-analysis`, `patching-bugs`, `post-patch-validation`, `property-based-testing`, `cvss-scoring`, `sharp-edges`, `semgrep-rule-creator`, `agentic-actions-auditor`.
- **Unavailable Prompted Skills:** Standalone skills named `cloudflare security-audit`, `static-analysis`, and `insecure-defaults` were not present in the local skills registry.
- **Executed CLI & Containerized Scanners:**
  - Host toolchains: `npm`, `python3`, `node`, `bash`, `docker`, `npx tsc`, `npx jest`, `npx eslint`, `pnpm` (`pnpm install --lockfile-only`).
  - Containerized security scanners executed via Docker: `semgrep/semgrep:latest` (`p/security-audit`, `p/owasp-top-ten`), `aquasec/trivy:latest` (`fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL`), `zricethezav/gitleaks:latest` (full Git history secret scan), plus `npm audit --json` (`sayra/`, `Blog/mock-server/`) and `pip-audit` (`Blog/`).
  - Django verification container: Built and executed `playnest-blog-test:latest` (`341/341` tests passing) with `-v Blog/tests:/app/tests:ro` and `-e DJANGO_TESTING=1 -e USE_REDIS=False`.
  - Ephemeral Infrastructure & DR Compose verification: Executed live `docker compose -p playnest_sec_verify` testing `AMI-70` (Redis auth, PostgreSQL role isolation, 5-network segmentation) and `AMI-57` (end-to-end Restic backup/wipe/restore with canary verification) and tore down cleanly.
- **Unavailable Scanners:** `codeql` (`NOT_INSTALLED` on host) and `zap-cli` (`NOT_INSTALLED` on host).

---

## 4. Security Posture Comparison (Before vs. After)

| Risk Area | Before Remediation | After Remediation |
| --- | --- | --- |
| **AdminJS & Platform Admin Auth** | `req.originalUrl.includes()` auth bypass; hardcoded cookie secret fallback; stored XSS across admin dashboards | Strict path/session middleware (`SEC-001`), fail-closed secret guards (`SEC-013`, `SEC-017`), DOM/HTML encoding across AdminJS & templates (`SEC-010`) |
| **OTP, Sessions & RBAC** | Deprecated OTP ATO (`SEC-002`), unauthenticated onboarding bypass (`SEC-009`), tenant `MANAGER` -> `ADMIN` escalation (`SEC-014`), `AuthorProfileSerializer` PK takeover & `StaticAPIKeyAuthentication` superuser fallback (`SEC-023`) | Strict OTP purpose/attempt binding, single-use tokens, refresh rotation & logout revocation (`SEC-017`), dynamic `AuthorProfileSerializer` `get_fields()`/`update()` allowing staff creation while blocking PK reassignment (`SEC-023`), non-superuser HMAC static key (`SEC-023`) |
| **Payments, Wallets & Discounts** | Unauthenticated `/webhooks` & `/verify` (`SEC-003`), cross-customer wallet drain (`SEC-004`), group-booking 2x refund (`SEC-005`), withdrawal double-spend (`SEC-006`), unauth discount lifecycle (`SEC-007`), global campaign fraud (`SEC-008`), promo races & free VIP reschedule (`SEC-018`) | Raw-body HMAC verification, actor/tenant ownership guards, `FOR UPDATE` / atomic quota & ledger locks, server-side pricing/tier recomputation, platform-admin campaign scoping |
| **Edge, Django Blog & Backups** | Port 80 plaintext & spoofable `XFF`, HSTS dropped in locations, `backups/` mounted inside Git repo (`SEC-012`), unauth Redis & shared PG superuser (`SEC-025`), Redis/PG SQL/shell injection (`SEC-026`), Blog IDOR purge/restore (`SEC-011`), Tar Slip & BDR stream truncation (`SEC-024`) | HTTPS 301 + shared security header snippet + `$remote_addr`, hardened shell scripts (`set -euo pipefail`, `psql -v`), `safe_extract_tar`/`safe_resolve_under_root`, `BDRGCMv2`, non-root `Blog/Dockerfile`, Compose Redis auth/least-privilege PG roles/5 segmented networks + verified Restic DR restore (`AMI-57` & `AMI-70` awaiting live cutover) |
| **Dependencies (`AMI-72`)** | `sayra` `npm audit`: `66` (`4` critical, `4` high, `58` moderate); `Blog` `pip-audit`: `258` CVEs across `25` packages | `melipayamak` replaced with native `fetch`; `sharp@^0.35.5` & `zod@^4.6.7` upgraded; `sayra` `npm audit` `55` (`0` critical, `1` high [`tinymce`], `54` moderate); `Blog` `Django==5.2.19`, `pip-audit` `11` CVEs across `2` pkgs (`social-auth-core`, dev `black`) |

---

## 5. Remaining-Risk Summary & Production Readiness Assessment

### Production Readiness Verdict: **CONDITIONAL NO-GO**

- **Application Code Status (`sayra/` & `Blog/`): READY** — All **31** verified application and config/CI findings (`AMI-46`..`AMI-56`, `AMI-58`..`AMI-69`, `AMI-71`, `AMI-73`..`AMI-79`) are remediated and regression-tested (`sayra` `21/21` security+targeted suites, `15/15` regression suites exit `0`, `tsc`/`build`/`eslint`/`openapi.yml` clean; `Blog` `341/341` Django tests passing in Docker).
- **Production Deployment / Cutover Status: BLOCKED ON TWO MANDATORY OPERATOR GATES:**
  1. **`AMI-57` (Critical — History Purge & Credential Rotation):** Git history still contains `119` tracked files under `backups/` (including 45 encrypted Restic snapshots + keyfile from `a7b51775`) plus tracked `.env.dev` commits (`1d4e7742`). Do **not** consider production secrets clean until the operator executes the approved maintenance window to migrate host backups to `/var/backups/playnest`, rotate all production credentials, re-initialize a fresh Restic repo, and run `git filter-repo --path backups --invert-paths` (plus `.env.dev` cleanup/review if approved).
  2. **`AMI-70` (High — Live Infrastructure Cutover):** Redis `--requirepass`, least-privilege PostgreSQL roles (`sayra_app`, `blog_app`, idempotent `docker/postgres/provision-least-privilege-roles.sql`), and 5-network Compose segmentation are implemented and ephemerally verified, but must be rolled out cleanly to the live PostgreSQL cluster and `.env` during a coordinated maintenance window.
- **Additional Documented Residual Risks:**
  - **`AMI-72` (High — Upstream-Constrained Residual CVEs):** `tinymce@6.8.6` (`4` Trivy `HIGH` / `1` `npm audit` `HIGH`) is locked under `@adminjs/design-system@4.1.1 -> @tinymce/tinymce-react@4.3.2` (mitigated via AdminJS RBAC, strict CSP, and HTML sanitization); `social-auth-core==4.9.1` (`7` `pip-audit` CVEs / `1` Trivy `HIGH`) is capped `<5.0` by `djoser==2.3.3`; `black==25.1.0` (`4` `pip-audit` / `2` Trivy `HIGH`) is a dev-only CI formatter pinned to match `Blog/.github/workflows/ci.yml`.
  - **Container Root User (`DS-0002` `HIGH` in Trivy):** `docker/nginx/Dockerfile`, `Blog/nginx/Dockerfile`, and `docker/backup/Dockerfile` run as `root` (app images `docker/Dockerfile` and `Blog/Dockerfile` are non-root cleanly).
  - **CI & Pre-Existing Unit Mock Gaps:** `codeql` is absent locally (add to GitHub Actions CI); `Blog/.github/workflows/ci.yml` uses mutable action tags (flagged by Semgrep); and 5 pre-existing unrelated Sayra unit specs fail due to outdated mock fixtures (documented in [`SECURITY-TEST-RESULTS.md`](file:///home/amir/github-projects/PlayNest/SECURITY-TEST-RESULTS.md)).

---

## 6. Companion Deliverables

- [`VULNERABILITIES.md`](file:///home/amir/github-projects/PlayNest/VULNERABILITIES.md) — Complete registry of `SEC-001`..`SEC-034` (`AMI-46`..`AMI-79`) with CVSS v4.0 vectors and updated statuses (`31 Done`, `3 In Progress`).
- [`REMEDIATION-REPORT.md`](file:///home/amir/github-projects/PlayNest/REMEDIATION-REPORT.md) — Detailed engineering changelog across Sayra, Blog, OpenAPI, Prisma, dependencies, and Infra/CI.
- [`SECURITY-TEST-RESULTS.md`](file:///home/amir/github-projects/PlayNest/SECURITY-TEST-RESULTS.md) — Exact observed compiler, ESLint, Jest, Django Docker (`341/341`), Ephemeral Compose (`AMI-70` & `AMI-57`), Gitleaks, Trivy, Semgrep, and static verification outputs.
- [`SECURITY-ROADMAP.md`](file:///home/amir/github-projects/PlayNest/SECURITY-ROADMAP.md) — Operator runbooks for the 3 remaining `In Progress` issues (`AMI-57`, `AMI-70`, `AMI-72`), remaining-risk register, and defense-in-depth roadmap.
