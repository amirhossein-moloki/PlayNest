# PlayNest Security Remediation Report

**Audit & Remediation Completion Date:** 2026-11-26  
**Linear Project:** `Backend Security Audit & Remediation` (`P-AMI-4`) — `24 Done`, `10 In Progress` (`34 Total`)

---

## 1. Sayra Express API Remediation Summary (`Done`)

All application-level vulnerabilities in `sayra/` (`SEC-001`..`SEC-010`, `SEC-013`..`SEC-018`, `SEC-026`, `SEC-028`..`SEC-031`) were fixed, OpenAPI-synchronized, and verified with `tsc`, `js-yaml`, and `18` Jest security suites (`93` tests) plus `15` API/unit regression suites (`175` tests):

### Wave 1 — Critical Auth, Financial, Discount, Onboarding & Admin XSS (`AMI-46`..`AMI-55`, `AMI-59`..`AMI-63`)
- **AdminJS & Platform Admin Auth (`SEC-001`, `SEC-010`, `SEC-017`):** Removed substring `req.originalUrl.includes()` bypass in AdminJS auth (`admin.authorization.ts`), hardened signed session cookies (`admin.constants.ts`), implemented token revocation and refresh rotation (`auth.station.ts`, `session.service.ts`), and sanitized/HTML-encoded rendered AdminJS and dashboard/analytics templates.
- **OTP & Onboarding Hardening (`SEC-002`, `SEC-009`, `SEC-028`):** Bound OTP consumption/verification strictly to purpose, phone, and attempt budgets (`otp.service.ts`), closed unauthenticated onboarding provisioning and user hijacking (`onboarding.routes.ts`, `onboarding.station.ts`), protected `POST /gamingCenters` and excluded `passwordHash` from repository selects.
- **Payments, Wallets & Withdrawals (`SEC-003`, `SEC-004`, `SEC-005`, `SEC-006`):** Enforced raw-body webhook HMAC verification (`verifyPaymentWebhookSignature.ts`, `webhooks.station.ts`), authenticated/authorized callback & verification paths, prevented cross-customer wallet drain (`wallet-access.guard.ts`), prevented group-booking child double-refunds (`group-booking.station.ts`), and added row-level locking on withdrawals (`withdrawal.station.ts`).
- **Discounts, Bookings, RBAC, CMS & Uploads (`SEC-007`, `SEC-008`, `SEC-014`, `SEC-015`, `SEC-016`, `SEC-018`):** Secured discount reserve/release/redeem endpoints, separated platform vs tenant campaign permissions (`discounts.station.ts`), blocked `MANAGER` -> `ADMIN` escalation, HTML-sanitized CMS pages (`html-sanitize.ts`, `page-renderer.ts`), enforced magic-byte/MIME validation before persisting uploads (`upload.station.ts`, `image-validation.ts`), and fixed promo race & VIP reschedule bypasses (`reservation.station.ts`, `reservation.lifecycle.ts`).

### Wave 2 — Privacy, Search DoS, SSRF, CSV, Error Redaction & Tenant Isolation (`AMI-73`..`AMI-76`)
- **Cookie Consistency & Auth Sync (`SEC-028`):** Synchronized `playnest_admin_refresh` cookie naming across `sayra/openapi.yml` and Platform Admin auth/2FA specs.
- **Reviews & Customer Privacy (`SEC-029`):** Hardened review spoofing/auth in `sayra/src/modules/ratings/{ratings.routes.ts,ratings.validators.ts,ratings.controller.ts,ratings.repo.ts,ratings.station.ts}`, scoped customer panel & customer repository projections (`customer-panel.station.ts`, `customers.repo.ts`), and added PostgreSQL partial unique index migration `sayra/prisma/migrations/20261125000002_security_rating_null_station_unique/migration.sql`.
- **Search DoS, SSRF, Short Links, CSV & Telemetry (`SEC-030`):**
  - `search.validators.ts` / `search.service.ts`: Capped query strings at 120 chars and sub-phrase expansion at 8 tokens.
  - `urlSecurity.ts`: Blocked hex and dotted IPv4-mapped IPv6 internal targets (`::ffff:127.0.0.1`, `::ffff:7f00:1`, `::ffff:a9fe:a9fe`, etc.).
  - `shortLinkCache.ts` / `shortLinks.service.ts`: Enforced atomic `maxClicks` limits even with cached redirect metadata.
  - `clickClassifier.ts`: Restricted `extractClientIp` strictly to Express `req.ip` (`trust proxy`), eliminating XFF spoofing (`shortLinks.api.spec.ts` updated with explicit `app.set('trust proxy', 1)` in test setup).
  - `platform-admin.controller.ts`: Added `escapeCsvCell` formula neutralization (`=`, `+`, `-`, `@`, leading whitespace formulas) on financial exports.
  - `errorHandler.ts` & `analytics.controller.ts`: Redacted Prisma `meta`/internal validation details in `production` and enforced `assertPlatformAdmin` on global telemetry routes.
  - `sayra/openapi.yml`: Synchronized constraints and removed duplicate `description` mapping key at `/auth/me`.
- **Waitlist & Advertisement Media Isolation (`SEC-031`):** Reordered `sayra/src/modules/waitlist/waitlist.routes.ts` (`authMiddleware` before `tenantGuard`) and added `prisma.media.findFirst({ where: { id: mediaId, gamingCenterId } })` in `sayra/src/modules/advertisement/advertisement.station.ts`.

---

## 2. Django Blog Remediation Summary (`AMI-56`, `AMI-64`–`AMI-69`, `AMI-77`)

Implemented on branch `security/audit-remediation` inside `Blog/`:
- **Shared Security Helpers (`Blog/common/security.py`):** Added pure-Python `is_safe_url`, `sanitize_html_allowlist` (BeautifulSoup allowlist + `rel="noopener noreferrer"`), `sanitize_block_value` (recursive dict/list sanitizer), `safe_resolve_under_root`, and `safe_extract_tar` (`..`/absolute/backslash/null/symlink/hardlink rejection + `filter="data"`).
- **Backup & Restore Integrity (`SEC-024` / `AMI-69` — `Done`):** Hardened `Blog/common/management/commands/restore_system.py` and `Blog/common/bdr_crypto.py` (`BDRGCMv2` authenticated header & EOF finality, PBKDF2 bounds `100_000..10_000_000`, `MAX_CHUNK_LEN` 64 MiB cap, truncation/trailing-byte rejection). Verified locally via `unittest`.
- **Access Control, Cache Warmup, XSS, Upload & Auth (`AMI-56`, `AMI-64`–`AMI-68`, `AMI-77` — `In Progress` awaiting Django CI):**
  - `Blog/medias/views.py`, `serializers.py`, `services.py`: Admin/owner permission checks on `purge`/`restore`/`get_queryset`, read-only metadata fields blocking mass assignment, strict `?ordering=` allowlist, safe download storage-key resolution + `nosniff`.
  - `Blog/posts/ckeditor_views.py`, `blocks.py`, `services.py`, `serializers.py`, `views.py`: Removed `@csrf_exempt` on editor uploads, blocked `.html`/`.svg`, routed block/HTML sanitization via `common.security`, set `AuthorProfileSerializer.Meta.read_only_fields = ("user",)`, restricted `related_article_ids`/`related_articles`, bypassed public cache when `?fields=` is specified, removed unbounded `_negative_cache_` Redis writes, and filtered public comments/podcasts/gallery querysets.
  - `Blog/common/cache/{signals.py,tasks.py,views.py,monitoring.py}`: Scoped cache warmup strictly to published public articles, restricted `/health/cache|redis|cache-manager` to `is_staff` with redacted errors, bounded `_top_missed_keys`.
  - `Blog/common/authentication.py`, `Blog/interactions/{serializers.py,views.py}`, `Blog/users/serializers.py`: Hardened `StaticAPIKeyAuthentication` (`hmac.compare_digest`, `is_active`, no superuser fallback), forced comment moderation/sanitization and allowlisted `Reaction` `ContentType`s, and enforced `validate_password()` on `UserCreateSerializer`.
  - `Blog/blog/settings.py`, `Blog/mock-server/server.js`, `Blog/Dockerfile`, `Blog/.dockerignore`: Production `SECRET_KEY` fail-fast check, removed `AXES_NEVER_LOCKOUT_CALLABLE`, fixed exact `is_testing` check, migrated to `STORAGES` (removed deprecated `DEFAULT_FILE_STORAGE`/`STATICFILES_STORAGE`), bound mock server to `127.0.0.1`, and converted `Blog/Dockerfile` to multi-stage non-root `bloguser`.

---

## 3. Infrastructure, Edge, Scripts & CI/CD Summary (`AMI-58`, `AMI-71`, `AMI-78`, `AMI-79` `Done`; `AMI-57`, `AMI-70` `In Progress / Blocked`)

- **Nginx (`docker/nginx/snippets/security-headers.conf`, `docker/nginx/Dockerfile`, `docker/nginx/conf.d/app.conf.template`):** Enforced HTTP -> HTTPS 301 redirect (excluding internal `/health`), preserved HSTS/`nosniff`/`Referrer-Policy` in all `location` blocks with `add_header`, replaced `$proxy_add_x_forwarded_for` with `$remote_addr`, added `auth_admin_limit` on admin/token/health/auth routes, sandboxed static uploads (`default-src 'none'; sandbox`), and closed fail-open SSR secret fallback.
- **Compose, Env & Deploy Hygiene (`docker-compose.yml`, `docker-compose.dev.yml`, `docker/docker-compose.yml`, `docker/Dockerfile`, `.env.example`, `.gitignore`, `deploy.ps1`):** Enforced `:?` required vars for secrets and `ZIBAL_MERCHANT`, removed hardcoded IPs (`51.20.249.108`, `87.248.152.195`) and dev `http://`/wildcard CORS defaults, moved backup bind mount out of repo to `${BACKUP_HOST_DIR:-/var/backups/playnest}`, added `no-new-privileges:true` and `pids_limit`, deleted stale `docker-compose.yml.bak`, set `SCARF_ANALYTICS=false`, and switched dev compose to `npm ci`.
- **Shell Scripts (`docker/backup/{entrypoint.sh,scripts/backup-db.sh,scripts/backup-perform.sh,scripts/restore.sh}`, `docker/postgres/init-multiple-dbs.sh`, `sayra/scripts/wait-for-db.sh`):** Enabled strict modes (`set -euo pipefail` / `set -eu`), `umask 077`, `mktemp`, identifier regex validation, `psql -v` safe quoting, primary `MAIN_DB` + `/uploads` backup coverage, Redis `LASTSAVE` polling, and cron validation.
- **GitHub Actions (`.github/workflows/ci.yml`, `.github/workflows/test.yml`):** Added top-level `permissions: { contents: read }`, `persist-credentials: false`, `SCARF_ANALYTICS: 'false'`, and dummy test JWT strings in `test.yml`.
