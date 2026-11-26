# PlayNest Security Remediation Roadmap, Remaining-Risk Register & Operator Runbooks

**Linear Project:** `Backend Security Audit & Remediation` (`P-AMI-4`) — **3 open Linear issues (`In Progress`: `AMI-57`, `AMI-70`, `AMI-72`)**  
All 7 Django Blog issues (`AMI-56`, `AMI-64`–`AMI-68`, `AMI-77`) and all 24 prior Sayra/Blog/Infra issues (`31/34` total) are verified and closed as **`Done`**.

---

## 1. Critical Gate — `AMI-57` (`SEC-012`): Git History Purge, Host Migration & Credential Rotation

**Status:** `In Progress` (**Approval-Gated** — backup/restore scripts hardened & ephemerally verified; Git history rewrite & live secret rotation require explicit operator approval)  

### Forensic Scope & Completed Work
- **Tracked Exposure in Git History:**
  - `backups/`: **119 tracked files** across `a7b51775` (2026-11-02 — live encrypted Restic repository: `1` `config`, `1` keyfile under `backups/keys/`, `45` snapshots, `21` index files, `42` data blobs), `175d5ba4` (2026-11-06 — `4` pre-subdomain migration config files), and `145ecd2b` (2026-11-11 — `5` checkout-fix files).
  - `.env.dev`: Tracked file flagged by Gitleaks (including line 30 hex `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY` from `1d4e7742`).
- **What is already fixed & verified in code:**
  - `.gitignore` excludes `backups/`, `*.tar`, and `docker-compose.yml.bak`.
  - `docker-compose.yml` mounts `${BACKUP_HOST_DIR:-/var/backups/playnest}:/backups`, keeps host volumes read-only by default, and enforces `RESTIC_PASSWORD:?`.
  - `backup-db.sh`, `backup-perform.sh`, and `restore.sh` dump both `playenest_prod` & `blog_prod`, include `/uploads`, wait for authenticated Redis `LASTSAVE`, fix Alpine BusyBox `mktemp`, re-apply `sayra_app`/`blog_app` ownership after DB restore, skip `:ro` dir/file mounts safely, and pass `--no-lock` when `RESTIC_REPOSITORY` is `:ro`. Verified end-to-end in `playnest_sec_verify` (`ALL_AMI57_VERIFIED_OK`).

### Mandatory Operator Runbook (Approval Required)
1. **Migrate Restic Repository Off-Repo:**
   ```bash
   sudo mkdir -p /var/backups/playnest
   sudo chmod 700 /var/backups/playnest
   # Preserve live backup objects on the server before purging from Git
   sudo cp -a /path/to/PlayNest/backups/. /var/backups/playnest/
   ```
   Set `BACKUP_HOST_DIR=/var/backups/playnest` in server `.env`.
2. **Rotate ALL Production Secrets & Initialize a Fresh Restic Repo:**
   Because historical Restic snapshots and `.env`/DB dumps were committed, treat every historical credential as exposed:
   - PostgreSQL superuser & least-privilege role passwords (`POSTGRES_PASSWORD`, `SAYRA_DB_PASSWORD`, `BLOG_DB_PASSWORD`, `DATABASE_URL`)
   - Redis passwords (`SAYRA_REDIS_PASSWORD`, `BLOG_REDIS_PASSWORD`)
   - `RESTIC_PASSWORD` (initialize a fresh Restic repo and confirm a clean backup/restore before retiring old archives)
   - `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`
   - `PLATFORM_ADMIN_TOTP_ENCRYPTION_KEY` (follow key-rotation/re-enrollment SOP), `ADMIN_SESSION_SECRET`, `ADMIN_COOKIE_SECRET`, `COOKIE_SECRET`
   - `PAYMENT_PROVIDER_WEBHOOK_SECRET`, `INTERNAL_SSR_SECRET`, `INTERNAL_SERVICE_TOKEN`, `BLOG_WEBHOOK_SECRET`, `NEXT_REVALIDATION_SECRET`
   - Django `BLOG_SECRET_KEY`, SMTP/SMS API keys (`SMSIR_API_KEY`, `MELIPAYAMAK_PASSWORD`), and S3 credentials if any.
3. **Purge Exposed History Across All Refs (Coordinated Team Maintenance Window):**
   ```bash
   # Review whether to purge .env.dev alongside backups/
   git filter-repo --path backups --invert-paths
   git push --force --all
   git push --force --tags
   ```
   All developers and deployment hosts must re-clone cleanly afterwards. Once verified, transition **`AMI-57`** -> `Done`.

---

## 2. High Gate — `AMI-70` (`SEC-025`): Live Cutover for Redis Auth, Postgres Roles & Segmented Networks

**Status:** `In Progress` (**Approval-Gated** — implemented & ephemerally verified in Compose; requires coordinated live cluster rollout)

### What is already Implemented & Ephemerally Verified
- `Blog/.dockerignore` created; `Blog/Dockerfile` converted to multi-stage non-root `bloguser`.
- `docker-compose.yml` configures Redis `--requirepass` + `REDISCLI_AUTH` healthchecks, least-privilege DB URLs (`sayra_app` -> `playenest_prod`, `blog_app` -> `blog_prod`), 5 segmented networks (`edge`, `inter_service`, `egress`, `sayra_internal`, `blog_internal`), `security_opt: [no-new-privileges:true]`, and `pids_limit`.
- `docker/postgres/init-multiple-dbs.sh` & idempotent `docker/postgres/provision-least-privilege-roles.sql` verified live in `playnest_sec_verify` (cross-DB `CONNECT` denied both ways; non-superuser roles confirmed; `blog_web` isolated from `redis:6379`).

### Mandatory Live Cutover Steps (Approval Required)
1. Provision rotated secrets in production `.env`: `SAYRA_REDIS_PASSWORD`, `BLOG_REDIS_PASSWORD`, `SAYRA_DB_USER=sayra_app`, `SAYRA_DB_PASSWORD`, `BLOG_DB_USER=blog_app`, `BLOG_DB_PASSWORD`.
2. On existing live PostgreSQL clusters where `init-multiple-dbs.sh` already ran historically, execute `docker/postgres/provision-least-privilege-roles.sql` as superuser (`psql -v sayra_app_user=sayra_app -v sayra_app_pass=... -v blog_app_user=blog_app -v blog_app_pass=... -f docker/postgres/provision-least-privilege-roles.sql`).
3. Deploy the updated `docker-compose.yml` during a coordinated maintenance window, recreate containers (`redis`, `blog_redis`, `db`, `sayra`, `sayra-worker`, `blog_*`, `backup`, `nginx`), verify healthchecks + cross-DB/network isolation, and transition **`AMI-70`** -> `Done`.

---

## 3. High Gate — `AMI-72` (`SEC-027`): Residual Upstream-Constrained Dependencies

**Status:** `In Progress` (**Upstream-Constrained** — primary actionable upgrades completed & tested)

### Completed & Verified
- Removed `melipayamak` SOAP SDK (`sayra/src/types/melipayamak.d.ts` deleted); implemented native `fetch` POST in `sayra/src/modules/notifications/melipayamak.station.ts` with passing unit tests.
- Upgraded `sharp@^0.35.5` and `zod@^4.6.7`, moved build/type packages out of `dependencies`, fixed all 15 `tsc` errors across 8 files, and synced `sayra/package-lock.json` & `sayra/pnpm-lock.yaml`.
- Recompiled `Blog/requirements.txt` (`Django==5.2.19`, `djangorestframework==3.18.3`, `cryptography==50.0.2`, `pillow==13.0.0`, `pyjwt==2.15.1`, `daphne==4.2.3`, `requests==2.34.2`, `urllib3==2.8.0`, `certifi==2026.11.20`, `idna==3.20`, `python-dotenv==1.2.4`); fixed `Blog/mock-server/package-lock.json` (`0` vulns).

### Remaining Upstream-Constrained CVEs & Exit Path
1. **`tinymce@6.8.6` (`4` Trivy `HIGH` `CVE-2026-47759..47762`; `1` `npm audit` `HIGH`):** Transitive dependency pinned to `^6.0.0 || ^5.5.1` by `@adminjs/design-system@4.1.1 -> @tinymce/tinymce-react@4.3.2` (fix requires `tinymce >= 8`). Mitigated by AdminJS RBAC, strict CSP, and DOM sanitization (`SEC-010`/`SEC-015`). Exit path: upgrade/replace `@adminjs/*` or replace rich-text editor dependency in a dedicated AdminJS PR.
2. **`social-auth-core==4.9.1` (`7` `pip-audit` CVEs / `1` Trivy `HIGH` `CVE-2026-57178`):** Capped `<5.0` by upstream `social-auth-app-django` required by `djoser==2.3.3`. Exit path: upgrade `djoser` / `social-auth-app-django` when upstream supports `social-auth-core >= 5`, or remove unused social auth backends if not enabled in production.
3. **`black==25.1.0` (`4` `pip-audit` CVEs / `2` Trivy `HIGH` `CVE-2026-114134`, `CVE-2026-32274`):** Dev-only CLI formatter pinned to match `Blog/.github/workflows/ci.yml`. Exit path: bump `black` across `Blog/requirements.in`, `requirements.txt`, and `Blog/.github/workflows/ci.yml` when CI Python formatting baseline is updated.

---

## 4. Completed Verification Milestones (Closed in This Cycle)

- **Django Blog Docker Verification (`AMI-56`, `AMI-64`..`AMI-68`, `AMI-77` -> `Done`):** Rebuilt `playnest-blog-test:latest`, fixed confirmed DRF/serializer/staticfile regressions (`AuthorProfileSerializer` dynamic `get_fields()`, `common/filters.py`, `medias/serializers.py`, `blog/settings.py`), passed `manage.py check`, `makemigrations --check --dry-run`, `test_blog_security` (`8/8`), full `manage.py test` (**341/341 OK**), and `test_standalone_security.py` (`9/9 OK`).
- **Sayra Jest Post-Teardown Fix (`Done`):** Stubbed `AnalyticsRepo.syncAllStatsForReservation` in `sayra/tests/unit/modules/customer-panel/customer-panel.station.spec.ts` -> full 15-suite API/unit sample now exits `0` (`175/175`).

---

## 5. Remaining-Risk Register & Production Readiness Assessment

| Risk ID / Source | Severity | Current Mitigation & Exposure | Production Gate |
| --- | --- | --- | --- |
| `AMI-57` (Git `backups/` & `.env.dev` history) | **Critical** | Excluded from `.gitignore` & host Compose mount fixed; historical objects still in Git history until purged | **BLOCKS PROD GO-LIVE** — purge history & rotate all secrets |
| `AMI-70` (Live Compose cutover) | **High** | Configured & ephemerally verified (`playnest_sec_verify`); not yet rolled to live cluster | **BLOCKS PROD GO-LIVE** — apply `provision-least-privilege-roles.sql` & cut over stack |
| `AMI-72` (`tinymce`, `social-auth-core`, `black`) | **High** (Upstream) | AdminJS auth/CSP/sanitization active; `black` is dev-only; upstream major pins constrain direct bumps | Track under `AMI-72` architectural/upstream upgrade |
| Trivy `DS-0002` Dockerfiles | **Medium/High** (`HIGH` in Trivy) | `docker/nginx/Dockerfile`, `Blog/nginx/Dockerfile`, `docker/backup/Dockerfile` run as `root` | Schedule non-root hardening for edge/backup containers |
| CI & Test Hygiene | **Low/Medium** | `codeql` absent locally; `Blog/.github/workflows/ci.yml` uses mutable `@v4` tags; 5 pre-existing Sayra unit mocks need updates | Add CI CodeQL/Semgrep/Trivy/Gitleaks gates; refresh outdated test mocks |

### Final Production Readiness Assessment: **CONDITIONAL NO-GO**
Application source code (`sayra/` and `Blog/`), schema parity (`sayra/openapi.yml`), supply-chain cleanup (critical CVEs `4 -> 0`), and container/DR engineering fixes are verified ready. **Do not declare production ready** until an approved maintenance window executes **`AMI-57`** (history purge + full credential rotation + off-repo backup migration) and **`AMI-70`** (live Postgres role cutover + authenticated Redis + segmented Compose networks).

---

## 6. Additional Defense-in-Depth Hardening Recommendations

- **Pin GitHub Actions to Full 40-Char Commit SHAs:** Update `actions/checkout`, `actions/setup-node`, and Python CI actions across `.github/workflows/{ci,test}.yml` and `Blog/.github/workflows/ci.yml`.
- **Automated Security Gates in CI:** Add GitHub CodeQL (`javascript-typescript`, `python`), `semgrep`, `trivy`, `gitleaks`, and Dockerized `Blog` `python manage.py test` jobs to CI.
- **Rootless Edge/Backup Containers (`DS-0002`):** Convert `docker/nginx/Dockerfile`, `Blog/nginx/Dockerfile`, and `docker/backup/Dockerfile` to unprivileged UIDs where port binding/filesystem capabilities allow (use non-privileged port `8080` behind TLS terminator).
- **Pre-Existing Sayra Mock Cleanup:** Update outdated mock fixtures in `snapp-discounts.scenarios.spec.ts`, `auth_cache.spec.ts`, `env.spec.ts`, `withdrawal.api.spec.ts`, and `reservation.code.spec.ts` so the entire `tests/unit/` directory passes cleanly alongside `tests/security/`.
