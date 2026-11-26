# PlayNest Security Remediation Roadmap & Operator Runbooks

This roadmap covers the **10 open Linear issues (`In Progress`)** plus hardening follow-ups that cannot be completed purely through offline source commits.

---

## 1. Critical Blocker — `AMI-57` (`SEC-012`): Git History Purge & Credential Rotation

**Status:** `In Progress` (`Blocked` — manual infrastructure & Git operation)  
**What is already fixed in code:**
- `.gitignore` excludes `backups/` (and `*.tar`, `docker-compose.yml.bak`).
- `docker-compose.yml` mounts `${BACKUP_HOST_DIR:-/var/backups/playnest}:/backups` outside the Git repo and requires `RESTIC_PASSWORD:?`.
- `backup-db.sh`, `backup-perform.sh`, and `entrypoint.sh` dump `playenest_prod`, include `/uploads`, wait for Redis `LASTSAVE`, and validate cron/identifiers.

**Mandatory Operator Runbook (Production Maintainer):**
1. **Migrate Restic Repository Off-Repo:**
   ```bash
   sudo mkdir -p /var/backups/playnest
   sudo chmod 700 /var/backups/playnest
   # Preserve live backup objects on the server before purging from git
   sudo cp -a /path/to/PlayNest/backups/. /var/backups/playnest/
   ```
   Set `BACKUP_HOST_DIR=/var/backups/playnest` in server `.env`.
2. **Rotate ALL Production Secrets & Credentials:**  
   Because `backups/` contains historical encrypted snapshots and `.env`/DB dumps, treat every historical credential as exposed:
   - PostgreSQL passwords (`POSTGRES_PASSWORD`, `DATABASE_URL`)
   - `RESTIC_PASSWORD` (initialize a fresh Restic repo after verifying restore!)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY` (follow key-rotation/re-enrollment SOP), `ADMIN_SESSION_SECRET`, `ADMIN_COOKIE_SECRET`, `COOKIE_SECRET`
   - `PAYMENT_PROVIDER_WEBHOOK_SECRET`, `INTERNAL_SSR_SECRET`, `INTERNAL_SERVICE_TOKEN`, `BLOG_WEBHOOK_SECRET`, `NEXT_REVALIDATION_SECRET`
   - Django `BLOG_SECRET_KEY`, SMTP/SMS API keys (`SMSIR_API_KEY`, `MELIPAYAMAK_PASSWORD`), and S3 credentials if any.
3. **Purge `backups/` from Git History (Coordinated Team Maintenance Window):**
   ```bash
   git filter-repo --path backups --invert-paths
   git push --force --all
   git push --force --tags
   ```
   All developers and deployment hosts must re-clone cleanly afterwards. Then move **`AMI-57`** -> `Done`.

---

## 2. High Blocker — `AMI-70` (`SEC-025`): Redis Auth, Least-Privilege Postgres Roles & Network Segmentation

**Status:** `In Progress` (`Blocked` — live Stateful Container Cutover)  
**What is already fixed in code:**
- `Blog/.dockerignore` created; `Blog/Dockerfile` converted to multi-stage runtime running as non-root `bloguser`.
- `docker-compose.yml` adds `security_opt: [no-new-privileges:true]` and `pids_limit` across all services.

**Mandatory Operator Cutover Plan:**
1. **Enable Redis Authentication (`--requirepass`):**
   - Generate distinct strong passwords (`SAYRA_REDIS_PASSWORD`, `BLOG_REDIS_PASSWORD`).
   - Update `redis` and `blog_redis` commands to pass `--requirepass` via env/secret file and update `REDIS_URL` (`redis://:<password>@redis:6379`) in `sayra`, `sayra-worker`, `blog_*`, and `backup-perform.sh` (`REDISCLI_AUTH`).
2. **Separate PostgreSQL Database Roles:**
   - Replace shared superuser `playenest_admin` at runtime with least-privilege database owners:
     - `sayra_app` owning only `playenest_prod`
     - `blog_app` owning only `blog_prod`
   - Retain superuser credentials strictly for manual DBA / init tasks.
3. **Segment Docker Networks:**
   - Define isolated Compose bridge networks: `edge` (`nginx`, `sayra`, `blog_web`), `sayra_internal` (`sayra`, `sayra-worker`, `db`, `redis`), `blog_internal` (`blog_web`, `blog_migrate`, `blog_celery_*`, `db`, `blog_redis`), and `backup_net` (with `internal: true` on backend networks).
4. **Verify Health & Close Linear:** Confirm connectivity across all healthchecks, then move **`AMI-70`** -> `Done`.

---

## 3. High Blocker — `AMI-72` (`SEC-027`): Supply-Chain Upgrades & Lockfile Regeneration

**Status:** `In Progress` (`Blocked` — breaking SemVer-major upgrades & offline lockfile regeneration)  
**Verified Baseline:**
- `sayra/` (`npm audit --json`): **`66` advisories (`4` critical, `4` high, `58` moderate)**:
  - `melipayamak@^1.0.5` pulls deprecated `soap`, `request`, `form-data`, `xml-crypto`, `@xmldom/xmldom` (critical/high SSRF, prototype pollution, XML/CDATA advisories).
  - `sharp@^0.33.5` and `zod@^3.23.8` require SemVer-major updates; `adminjs` / `@adminjs/*` transitively pin `tinymce`.
  - Type/CLI tooling (`@types/express-session`, `@types/jalaali-js`, `dotenv-cli`, `tsx`, `yamljs`) currently sit in runtime `dependencies` in `sayra/package.json` (`AMI-79` partial cleanup).
- `Blog/requirements.txt`: `certifi==2023.7.22`, `idna==3.4`, `requests==2.31.0`, `urllib3==2.1.0`.

**Upgrade Plan:**
1. **Replace `melipayamak` SDK (`sayra/src/modules/notifications/melipayamak.station.ts`):** Rewrite the REST SMS call using Node 22 native `fetch` + `AbortSignal.timeout(7000)`, update notification tests (`melipayamak.station.spec.ts`, `ami42-resilience.spec.ts`), and `npm uninstall melipayamak` to eliminate all 4 critical `npm audit` findings.
2. **SemVer-Major `zod` v4 & `sharp` Upgrade:** Update `zod` and `sharp` in a dedicated PR, adapt any deprecated `zod` v3 helpers, move dev-only packages out of `dependencies`, regenerate `sayra/package-lock.json`, and run the full Jest & build suite.
3. **AdminJS / TinyMCE Tracking:** Monitor `@adminjs` upstream releases and keep `SEC-010`/`SEC-015` strict CSP + sanitization active.
4. **Recompile `Blog/requirements.txt`:** Upgrade `requests>=2.32.3`, `urllib3>=2.2.2`, `idna>=3.7`, `certifi>=2024.7.4` via `pip-compile` / `uv pip compile` in an environment with PyPI access and run the Django test suite.
5. **Close Linear:** Once `npm audit` critical/high actionable advisories and `requirements.txt` pins are clean and tested, move **`AMI-72`** -> `Done`.

---

## 4. Django Blog CI Verification (`AMI-56`, `AMI-64`..`AMI-68`, `AMI-77`)

All 7 remaining Django issues have completed source patches and `py_compile` verification, plus standalone pure-Python unit tests (`9/9` passed). To move them from `In Progress` -> `Done` in Linear:
1. Run Django migrations and test suite inside the Blog container or CI runner:
   ```bash
   python manage.py test tests.security.test_blog_security
   python manage.py test
   ```
2. Record passing output on `AMI-56`, `AMI-64`..`AMI-68`, and `AMI-77`, and transition them to `Done`.

---

## 5. Additional Defense-in-Depth Hardening Recommendations

- **Pin GitHub Actions to Full 40-Char Commit SHAs:** In `.github/workflows/ci.yml` and `test.yml`, pin `actions/checkout` and `actions/setup-node` tags (`@v4`) to verified immutable commit SHAs.
- **Automated Security Gates in CI:** Add `semgrep`, `trivy` container image scanning, `gitleaks` secret scanning, and `python manage.py test tests.security.test_blog_security` to CI once runners have external tool images available.
- **Sayra Analytics Test Hygiene:** Mock `AnalyticsRepo.syncAllStatsForReservation` in `sayra/tests/unit/modules/customer-panel/customer-panel.station.spec.ts` (pre-existing test) so full Jest runs exit `0` without post-teardown DB warnings when PostgreSQL `playenest_test` is absent.
