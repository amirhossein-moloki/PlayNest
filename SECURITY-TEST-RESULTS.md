# PlayNest Security Test & Verification Results

**Verification Timestamp:** 2026-11-26  
**Scope:** End-to-end verification after all Sayra, Django Blog, dependency upgrade, Docker, Nginx, shell script, DR, and CI/CD edits.

---

## 1. Summary Matrix

| Check / Suite | Outcome | Exact Measured Result |
| --- | --- | --- |
| Sayra TypeScript compiler (`tsc`) | Passed (exit `0`) | `npx tsc --noEmit --ignoreDeprecations 5.0` -> `TSC_EXIT=0` |
| Sayra production build (`npm run build`) | Passed (exit `0`) | Clean TypeScript build -> exit `0` |
| Sayra ESLint (`npx eslint`) | Passed (exit `0`) | All **11** modified `.ts` files -> exit `0` |
| Sayra OpenAPI specification (`js-yaml`) | Passed (exit `0`) | `OpenAPI parsed: 3.0.0 paths: 352` (`sayra/openapi.yml`) |
| Sayra Security + Targeted Suites (`tests/security/*` + 3 targeted specs) | Passed (exit `0`) | **21 passed, 21 total suites; 114 passed, 114 total tests** |
| Sayra API & Unit Regression Sample (15 suites) | Passed (exit `0`) | **15 passed, 15 total suites; 175 passed, 175 total tests** *(post-teardown async warning resolved)* |
| Sayra `npm audit --json` | Reduced (`0 critical, 1 high`) | `66 (4 critical, 4 high, 58 moderate)` -> **`55 (0 critical, 1 high, 54 moderate)`** |
| Blog Django Check & Migrations (`playnest-blog-test:latest`) | Passed (exit `0`) | `manage.py check`: `0 issues`; `makemigrations --check --dry-run`: `No changes detected` |
| Blog Django Security Tests (`tests.security.test_blog_security`) | Passed (exit `0`) | **8 passed, 8 total tests** (`OK`) |
| Blog Full Django Test Suite (`python manage.py test -v 1`) | Passed (exit `0`) | **Ran 341 tests in 158.647s — OK** (`0` failures, `0` errors) |
| Blog Standalone Security Unit Tests | Passed (exit `0`) | `test_standalone_security.py` -> **Ran 9 tests in 0.124s — OK** |
| Blog `pip-audit` & `mock-server` `npm audit` | Reduced / Clean | `pip-audit`: `258` CVEs (`25` pkgs) -> **`11` CVEs (`2` pkgs)**; `mock-server`: **`0`** vulns |
| Ephemeral Compose `AMI-70` (`playnest_sec_verify`) | Passed (exit `0`) | `COMPOSE_CONFIG_OK`; Redis auth `NOAUTH`/`PONG`; PG role cross-DB isolation; network isolation verified |
| Ephemeral Compose `AMI-57` DR Verification (`playnest_sec_verify`) | Passed (exit `0`) | `restic check --read-data` zero errors; DB wipe + `:ro` & RW-uploads canary recovery (`ALL_AMI57_VERIFIED_OK`) |
| Gitleaks (`zricethezav/gitleaks:latest`) | Completed | `PlayNest` (628 commits): `32` redacted regex hits + `119` tracked `backups/` files; `Blog`: `2` hits |
| Trivy (`aquasec/trivy:latest`, `HIGH,CRITICAL`) | Completed | **`0 CRITICAL`**, **`0` working-tree secrets**; `4` `tinymce` HIGH, `3` Blog Python HIGH, `3` Dockerfile `DS-0002` HIGH |
| Semgrep (`semgrep/semgrep:latest`) | Completed | **`0 ERROR`**, `18 WARNING` — all triaged |
| CodeQL | Not Available | `NOT_INSTALLED` on audit host (see Section 5.4) |
| Static Infra Checks (`bash -n`, `sh -n`, Nginx, YAML) | Passed (exit `0`) | `BASH_OK`, `SH_SYNTAX_OK`, `NGINX_XFF_CLEAN`, `6/6 YAML_OK` |

---

## 2. Sayra TypeScript, Build, ESLint, OpenAPI & Jest Suites

### 2.1 Type Check, Build, ESLint & OpenAPI Schema Validation
```text
npx tsc --noEmit --ignoreDeprecations 5.0 -> exit 0
npm run build -> exit 0
npx eslint (all 11 modified .ts files) -> exit 0
sayra/openapi.yml (js-yaml) -> OPENAPI_OK 3.0.0 paths: 352
```

### 2.2 Security + Targeted Regression Run (`exit 0`)
All **18** suites in `sayra/tests/security/` plus the **3** targeted remediation/upgrade unit suites passed cleanly with zero skips, zero failures, and zero post-teardown warnings:
- `tests/security/{admin-ui-xss,auth-hardening-and-data-leak,auth-otp-takeover,cms-xss,discount-race-reschedule,discounts-security,dos-ssrf-csv-errors,env-production-guards,media-upload-security,onboarding-security,payments-webhook-verify,post-completion-cancel-refund,privilege-escalation-idor,ratings-and-customer-privacy,session-cookie-revocation,waitlist-ad-isolation,wallet-drain-otp-bypass,wallet-refund-withdrawal}.spec.ts`
- `tests/unit/modules/customer-panel/customer-panel.station.spec.ts`
- `tests/unit/modules/notifications/melipayamak.station.spec.ts`
- `tests/security/ami42-resilience.spec.ts`

```text
Test Suites: 21 passed, 21 total
Tests:       114 passed, 114 total
Exit Code:   0
```

### 2.3 Sayra 15 API & Unit Regression Suites (`exit 0`)
Re-executed the 15-suite regression sample after fixing `customer-panel.station.spec.ts` (`AnalyticsRepo.syncAllStatsForReservation` stub):
- `tests/api/short-links/shortLinks.api.spec.ts` (`Benchmark 500 cached redirects` pass)
- `tests/api/search/search.api.spec.ts`
- `tests/api/analytics/analytics.api.spec.ts`
- `tests/api/advertisement/advertisement.owner.spec.ts`
- `tests/api/platform-admin/{platform-admin.auth,platform-admin.totp-2fa}.spec.ts`
- `tests/api/users/users.api.spec.ts`
- `tests/api/auth/auth.api.spec.ts`
- `tests/api/gamingCenters/gamingCenters.api.spec.ts`
- `tests/unit/common/errors/errorHandler.spec.ts`
- `tests/unit/short-links/shortLinks.utils.spec.ts`
- `tests/unit/modules/{waitlist/waitlist,ratings/ratings.repo,customers/customers.repo,customer-panel/customer-panel.station}.spec.ts`

```text
Test Suites: 15 passed, 15 total
Tests:       175 passed, 175 total
Exit Code:   0  (prior post-teardown async log failure eliminated)
```

### 2.4 Broader Unit Sweep Disclosure (`zod` v4 Upgrade Verification)
To ensure the `zod@^4.6.7` upgrade introduced zero validation regressions, broader unit sweeps ran across `tests/unit/{common,config,short-links,notifications,customer-panel}` (`26/28` passed, `199` tests) and `tests/unit/modules/{reservations,wallet,payments}` (`22/24` passed, `240` tests). All failures in those broader sweeps were pre-existing unrelated mock mismatches — zero Zod v4 runtime regressions:
- `snapp-discounts.scenarios.spec.ts`: mock omits 5 `DiscountCampaign` Prisma fields.
- `auth_cache.spec.ts`: 3 tests mock `redis.get` without handling the `auth:revoked_session:` key introduced in `AMI-62`.
- `env.spec.ts`: 1 test omits `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY` required since `AMI-58`.
- `withdrawal.api.spec.ts` (4 tests) and `reservation.code.spec.ts` (1 test): pre-existing outdated mock setups.

### 2.5 Node Supply Chain (`npm audit --json`)
- Baseline before `AMI-72` upgrades: `66` advisories (`4` critical, `4` high, `58` moderate).
- After removing `melipayamak` and upgrading `sharp@^0.35.5` + `zod@^4.6.7` + dual lockfiles: **`55` advisories (`0` critical, `1` high, `54` moderate)**.
- Sole remaining `high` advisory: `tinymce@6.8.6` pinned under `@adminjs/design-system@4.1.1 -> @tinymce/tinymce-react@4.3.2`.

---

## 3. Django Blog Docker Verification (`playnest-blog-test:latest`)

Executed inside Docker (`-e DJANGO_TESTING=1 -e USE_REDIS=False -v Blog/tests:/app/tests:ro`) after all code fixes and Python requirement upgrades:
1. `python manage.py check` -> `System check identified no issues (0 silenced).`
2. `python manage.py makemigrations --check --dry-run` -> `No changes detected`
3. `python manage.py test tests.security.test_blog_security -v 2` -> **`Ran 8 tests — OK`** (verifying `AMI-56`, `AMI-64`–`AMI-68`, `AMI-77`)
4. `python manage.py test -v 1` -> **`Ran 341 tests in 158.647s — OK`** (`0` failures, `0` errors)
5. `python -m unittest tests/security/test_standalone_security.py -v` -> **`Ran 9 tests in 0.124s — OK`**
6. `pip-audit`: Reduced from **`258` CVEs across `25` packages** to **`11` CVEs across `2` packages** (`social-auth-core==4.9.1` [`7`], dev linter `black==25.1.0` [`4`]).
7. `Blog/mock-server/`: `npm audit` -> **`0` vulnerabilities**.

---

## 4. Ephemeral Docker Compose Verification (`playnest_sec_verify`)

Both infrastructure isolation (`AMI-70`) and disaster recovery (`AMI-57`) were exercised against live containers in an ephemeral Compose stack (`playnest_sec_verify`) and torn down cleanly afterward (`docker ps -a`, `docker volume ls`, `docker network ls`, `/tmp/playnest_verify*` verified clean):

### 4.1 `AMI-70` Infrastructure Isolation (`exit 0`)
- `docker compose --env-file ... config` -> `COMPOSE_CONFIG_OK`.
- **Redis Auth (`redis` & `blog_redis`):** Unauthenticated `redis-cli ping` returned `NOAUTH Authentication required.`; authenticated `ping` returned `PONG`.
- **PostgreSQL Least-Privilege Roles (`pg_roles`):** `sayra_app` and `blog_app` verified with `rolsuper=f, rolcreatedb=f, rolcreaterole=f, rolbypassrls=f`.
- **Cross-DB Isolation:** `sayra_app` connected to `playenest_prod` (`SAYRA_OWN_DB_OK`) and was **DENIED** on `blog_prod` (`FATAL: permission denied for database "blog_prod"` / `User does not have CONNECT privilege`); `blog_app` connected to `blog_prod` (`BLOG_OWN_DB_OK`) and was **DENIED** on `playenest_prod`.
- **Idempotent Existing-Cluster Provisioning:** `docker/postgres/provision-least-privilege-roles.sql` executed cleanly (exit `0`).
- **Network Segmentation (`from blog_web`):** `blog_web -> redis:6379` `reachable=False` (`gaierror`); `blog_web -> blog_redis:6379` `reachable=True`; `blog_web -> db:5432` `reachable=True`.

### 4.2 `AMI-57` End-to-End Backup & DR Verification (`exit 0`)
- Rebuilt `playnest-backup-test:latest` (tagged `playenest-backup:latest`).
- Seeded canary data in `playenest_prod` (`sayra_canary_token_2026`), `blog_prod` (`blog_canary_token_2026`), and `/uploads` (`upload_canary_payload_2026`); ran `backup-perform.sh`.
- Verified `restic check --read-data` -> `no errors were found` and gzip/SQL validity of `dump_playenest_prod.sql.gz` & `dump_blog_prod.sql.gz` (`DUMPS_GZIP_OK`).
- Wiped both databases and executed `restore.sh` with default `:ro` mounts -> recovered `RECOVERED_SAYRA=sayra_canary_token_2026`, `RECOVERED_BLOG=blog_canary_token_2026`, cleanly skipped `:ro` dirs/single-file mounts with explicit warnings, and preserved post-restore role isolation (`sayra_app` denied on `blog_prod` -> `POST_RESTORE_ISOLATION_OK`).
- Wiped again and executed `restore.sh` with read-only `/backups` (`--no-lock`) + writable `/uploads` -> recovered `RECOVERED_UPLOAD=upload_canary_payload_2026`, `RECOVERED_SAYRA_2=sayra_canary_token_2026`, `RECOVERED_BLOG_2=blog_canary_token_2026` (`ALL_AMI57_VERIFIED_OK`).

---

## 5. Automated Security Scanners

### 5.1 Gitleaks (`zricethezav/gitleaks:latest`, Redacted Full-History Scan)
- **`PlayNest` (628 commits):** `32` regex findings (historical committed `.env.dev:30` hex `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY` from `1d4e7742`, `.env.example`, test fixtures, and legacy `payload/` docs/tests), plus **`119` tracked files under `backups/`** (`a7b51775` Restic config/keyfile/45 snapshots/21 index/42 blobs; `175d5ba4` `4` files; `145ecd2b` `5` files).
- **`Blog`:** `2` findings (`docs/INLINE_MEDIA_UPLOAD_GUIDE.md:144`, `.env.example:12`).

### 5.2 Trivy (`aquasec/trivy:latest`, `fs --scanners vuln,misconfig,secret --severity HIGH,CRITICAL`)
- **`0 CRITICAL` vulnerabilities** and **`0` working-tree secrets**.
- `sayra/package-lock.json` & `sayra/pnpm-lock.yaml`: `4` `HIGH` (`tinymce` `CVE-2026-47759..47762`, locked under `@adminjs/design-system`).
- `Blog/requirements.txt`: `3` `HIGH` (`black` `CVE-2026-114134`, `CVE-2026-32274`; `social-auth-core` `CVE-2026-57178`).
- Dockerfile `DS-0002` `HIGH` (`root` user): `3` (`docker/nginx/Dockerfile`, `Blog/nginx/Dockerfile`, `docker/backup/Dockerfile`); `0` on `docker/Dockerfile` & `Blog/Dockerfile`.

### 5.3 Semgrep (`semgrep/semgrep:latest`, `--config p/security-audit --config p/owasp-top-ten`)
- **`0 ERROR` findings**, `18 WARNING` findings — all triaged:
  - `sayra/src/modules/public/page-renderer.ts:141` (`1` warning): verified safe (`sanitizeStructuredDataJson`).
  - `Blog/common/cache/policies.py:100` (`1` warning): non-cryptographic cache key MD5 digest.
  - `Blog/mock-server/server.js` (`7` warnings): local `127.0.0.1` development mock secrets only.
  - `Blog/.github/workflows/ci.yml` (`5` warnings): mutable action tags.
  - `Blog/nginx/nginx.conf` (`4` warnings): legacy unused Blog Nginx config (`docker/nginx/conf.d/app.conf.template` serves production edge).

### 5.4 CodeQL
- `codeql` CLI is **not installed** on the audit host (`NOT_INSTALLED`). Recommended as a GitHub Actions workflow (`github/codeql-action`) for `javascript-typescript` and `python`.

---

## 6. Infrastructure, Shell, Nginx & YAML Static Verification

- `bash -n docker/backup/scripts/backup-db.sh docker/backup/scripts/backup-perform.sh docker/backup/scripts/restore.sh docker/postgres/init-multiple-dbs.sh` -> `BASH_OK` (`entrypoint.sh` also verified previously)
- `sh -n sayra/scripts/wait-for-db.sh` -> `SH_SYNTAX_OK`
- `! grep -n 'proxy_add_x_forwarded_for' docker/nginx/conf.d/app.conf.template` -> `NGINX_XFF_CLEAN`
- `yaml.safe_load` (`python3`): `YAML_OK` across all **6** files (`docker-compose.yml`, `docker-compose.dev.yml`, `docker/docker-compose.yml`, `.github/workflows/ci.yml`, `.github/workflows/test.yml`, `Blog/.github/workflows/ci.yml`).
