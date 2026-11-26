# PlayNest Security Remediation Roadmap, Remaining-Risk Register & Operator Runbooks

**Linear Project:** `Backend Security Audit & Remediation` (`P-AMI-4`) — **2 open Linear issues (`In Progress`: `AMI-57`, `AMI-72`)**  
All 7 Django Blog issues (`AMI-56`, `AMI-64`–`AMI-68`, `AMI-77`), **`AMI-70` (live infrastructure rollout on `ssh sayra`)**, and all 24 prior Sayra/Blog/Infra issues (`32/34` total) are verified and closed as **`Done`**.

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

## 2. Live Infrastructure Cutover — `AMI-70` (`SEC-025`): **`Done`** (Deployed & Verified on `ssh sayra` `/opt/PlayNest`)

**Status:** **`Done`** (Deployed live on `2026-11-26` after ephemeral Compose validation; pre-cutover snapshot & logical DB dumps archived on server at `/home/ubuntu/ami70-backup-20261126-134020`).

### Deployed & Verified Live Controls
- Multi-stage non-root `Blog/Dockerfile` (`uid=999(bloguser)`) + `Blog/.dockerignore`, with `playnest_blog_static` and `playnest_blog_media` ownership migrated cleanly and `blog_celery_beat` using `-s /tmp/celerybeat-schedule` (`RestartCount=0`).
- Redis `--requirepass` + `REDISCLI_AUTH` healthchecks active on both `playnest-redis-1` and `playnest-blog_redis-1` (`NOAUTH` unauthenticated / `PONG` authenticated; keyspaces preserved).
- Least-privilege PostgreSQL roles (`sayra_app`, `blog_app`) applied live via `docker/postgres/provision-least-privilege-roles.sql` (including all 82 Prisma enum types + default privileges; bidirectional cross-DB `CONNECT` denied; `sayra_app` cleanly applied migration `20261125000001_security_wallet_constraints`).
- 5-network Compose segmentation (`edge`, `inter_service` [`internal`], `egress`, `sayra_internal` [`internal`], `blog_internal` [`internal`]), flat `playnest_default` removed, cross-service env vars scrubbed, live HTTP `200` + Restic snapshot `69482f40` verified.
- Note: Updated Sayra and Blog application code commits (`security/audit-remediation`) remain local pending separate push/deploy approval.

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
| `AMI-57` (Git `backups/` & `.env.dev` history) | **Critical** | Excluded from `.gitignore` & host Compose mount fixed locally; server still mounts `./backups` and historical objects remain in Git history until purged | **BLOCKS PROD GO-LIVE** — migrate off-repo, purge history & rotate all secrets |
| Live `.env` Runtime Flags & Unpushed App Code | **High** (Ops Cutover) | Live `/opt/PlayNest/.env` currently retains `NODE_ENV="development"` and `SKIP_OTP=true` (untouched per safety policy); updated Sayra/Blog code sits unpushed on `security/audit-remediation` | Push/deploy `security/audit-remediation` app images & switch live `.env` to `production` + `SKIP_OTP=false` with real secrets/merchant |
| `AMI-72` (`tinymce`, `social-auth-core`, `black`) | **High** (Upstream) | AdminJS auth/CSP/sanitization active; `black` is dev-only; upstream major pins constrain direct bumps | Track under `AMI-72` architectural/upstream upgrade |
| Trivy `DS-0002` Dockerfiles | **Medium/High** (`HIGH` in Trivy) | `docker/nginx/Dockerfile`, `Blog/nginx/Dockerfile`, `docker/backup/Dockerfile` run as `root` | Schedule non-root hardening for edge/backup containers |
| CI & Test Hygiene | **Low/Medium** | `codeql` absent locally; `Blog/.github/workflows/ci.yml` uses mutable `@v4` tags; 5 pre-existing Sayra unit mocks need updates | Add CI CodeQL/Semgrep/Trivy/Gitleaks gates; refresh outdated test mocks |

### Final Production Readiness Assessment: **CONDITIONAL NO-GO**
`AMI-70` (authenticated Redis, least-privilege PostgreSQL roles, 5-network isolation, non-root `playenest-blog:latest`) is now **live and verified** on `ssh sayra` (`/opt/PlayNest`), and all application-level fixes (`32/34`) pass regression verification. **Do not declare full production go-live** until:
1. An approved maintenance window executes **`AMI-57`** (off-repo `/var/backups/playnest` migration, full credential rotation + fresh Restic repo, and `git filter-repo` history purge);
2. Updated Sayra/Blog application code (`security/audit-remediation`) is pushed/deployed after approval; and
3. Live `/opt/PlayNest/.env` is switched from `NODE_ENV="development"` / `SKIP_OTP=true` to `NODE_ENV="production"` / `SKIP_OTP=false` with real production secrets (`ADMIN_SESSION_SECRET`, `ADMIN_COOKIE_SECRET`, real `ZIBAL_MERCHANT`).

---

## 6. Additional Defense-in-Depth Hardening Recommendations

- **Pin GitHub Actions to Full 40-Char Commit SHAs:** Update `actions/checkout`, `actions/setup-node`, and Python CI actions across `.github/workflows/{ci,test}.yml` and `Blog/.github/workflows/ci.yml`.
- **Automated Security Gates in CI:** Add GitHub CodeQL (`javascript-typescript`, `python`), `semgrep`, `trivy`, `gitleaks`, and Dockerized `Blog` `python manage.py test` jobs to CI.
- **Rootless Edge/Backup Containers (`DS-0002`):** Convert `docker/nginx/Dockerfile`, `Blog/nginx/Dockerfile`, and `docker/backup/Dockerfile` to unprivileged UIDs where port binding/filesystem capabilities allow (use non-privileged port `8080` behind TLS terminator).
- **Pre-Existing Sayra Mock Cleanup:** Update outdated mock fixtures in `snapp-discounts.scenarios.spec.ts`, `auth_cache.spec.ts`, `env.spec.ts`, `withdrawal.api.spec.ts`, and `reservation.code.spec.ts` so the entire `tests/unit/` directory passes cleanly alongside `tests/security/`.
