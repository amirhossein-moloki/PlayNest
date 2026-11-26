# PlayNest Validated Security Vulnerability Catalog

**Linear Project:** `Backend Security Audit & Remediation` (`P-AMI-4`)  
**Total Confirmed Findings:** `34` (`13` Critical, `14` High, `6` Medium, `1` Low)  
**Linear Status Summary:** `31 Done`, `3 In Progress` (Operator-gated live cutover / Git history purge & upstream-constrained dependency CVEs; all 7 Django Blog ORM/DRF issues verified in Docker and closed as `Done`)

---

## 1. Master Register (`SEC-001` – `SEC-034`)

| Sec ID | Linear | Severity | Status | CVSS v4.0 Vector | Title |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `SEC-001` | `AMI-46` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:L/SC:N/SI:N/SA:N` | Unauthenticated Complete Bypass of AdminJS Panel Authentication via `req.originalUrl.includes()` |
| `SEC-002` | `AMI-47` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Zero-Interaction Account Takeover via Deprecated OTP Login + `consumedAt` Confusion & Unthrottled Legacy OTP |
| `SEC-003` | `AMI-48` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:L/SC:N/SI:N/SA:N` | Unauthenticated Payment Webhook Forgery, `/payments/:id/verify` Manipulation, Callback Fallback & Broken `rawBody` HMAC |
| `SEC-004` | `AMI-49` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:H/VA:N/SC:N/SI:N/SA:N` | Unauthenticated & Cross-Customer Victim Wallet Drain + Tautological OTP Bypass Across Booking Flows |
| `SEC-005` | `AMI-50` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N` | Deterministic 2x Wallet Balance Multiplication (Double-Refund) on Group-Booking Child Reservations |
| `SEC-006` | `AMI-51` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N` | Double-Spend of Reserved Withdrawal Funds & Missing `WithdrawalRequest` `FOR UPDATE` Lock |
| `SEC-007` | `AMI-52` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:H/VA:L/SC:N/SI:N/SA:N` | Unauthenticated Discount Lifecycle Endpoints (`/reserve`, `/release`, `/redeem`) Enabling Promo Reuse & Budget DoS |
| `SEC-008` | `AMI-53` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N` | Tenant Manager Takeover of Global Platform Campaigns & 100% Platform-Funded Merchant Discount Fraud |
| `SEC-009` | `AMI-54` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Unauthenticated Onboarding OTP Bypass, Arbitrary Center Provisioning & User Account Hijacking |
| `SEC-010` | `AMI-55` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:P/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N` | Stored XSS Across Platform Super Admin Dashboards Leading to Post-2FA Superuser Takeover |
| `SEC-011` | `AMI-56` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` IDOR on `POST /api/media/<pk>/purge/` and `/restore/` Enabling Arbitrary Media Deletion |
| `SEC-012` | `AMI-57` | Critical | `In Progress` (`Approval-Gated`) | `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:N/VA:H/SC:N/SI:N/SA:N` | Live Restic Backup Repo Committed to Git & Silent Skipping of Primary Production DB/Uploads |
| `SEC-013` | `AMI-58` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Silent Fallback to Hardcoded Public Secrets, Fail-Open Nginx SSR Secret & Prod Zibal Sandbox Default |
| `SEC-014` | `AMI-59` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Tenant `MANAGER` Escalation to `ADMIN` -> Global Tickets & Notification Logs IDOR |
| `SEC-015` | `AMI-60` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:P/VC:L/VI:L/VA:N/SC:H/SI:H/SA:N` | Reflected XSS in CMS Page Editor + Stored XSS in Public CMS Pages & Global Ad Slider |
| `SEC-016` | `AMI-61` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:H/VA:H/SC:L/SI:L/SA:N` | Cross-Tenant Media Deletion + Unrestricted KYC SVG/HTML Upload & Pre-Validation Disk Write |
| `SEC-017` | `AMI-62` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | AdminJS Cookie Signature Bypass, Missing Token Revocation & Missing Refresh Token Rotation |
| `SEC-018` | `AMI-63` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N` | Discount Concurrency Races, Silent Quota-Error Swallowing & Free VIP Upgrade via Reschedule |
| `SEC-019` | `AMI-64` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` Mass Assignment on `MediaDetailSerializer`, Unauth `download_media` & Upload Validation Bypass |
| `SEC-020` | `AMI-65` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N` | `[Django Blog]` Cache Warmup Bypass Leaking Draft/Private Articles & `related_article_ids` Metadata Leak |
| `SEC-021` | `AMI-66` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:L/VI:L/VA:N/SC:H/SI:H/SA:N` | `[Django Blog]` Comment Moderation Bypass, Unsanitized Comment HTML & Broken Block HTML Sanitizer |
| `SEC-022` | `AMI-67` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:P/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N` | `[Django Blog]` Unrestricted `.html`/`.svg` Upload & `@csrf_exempt` on `/api/editor/upload/` |
| `SEC-023` | `AMI-68` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | `[Django Blog]` Privilege Escalation on `AuthorProfileSerializer` & `StaticAPIKeyAuthentication` Superuser Backdoor |
| `SEC-024` | `AMI-69` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:H/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` Tar Slip, S3 Restore Path Traversal & BDR Crypto Stream Integrity Flaws |
| `SEC-025` | `AMI-70` | High | `In Progress` (`Approval-Gated`) | `CVSS:4.0/AV:A/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | Unauthenticated Redis, Shared Postgres Superuser, Flat Network & `Blog/Dockerfile` Root User |
| `SEC-026` | `AMI-71` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Nginx Plaintext/HSTS/XFF Spoofing, Staff Lockout Exemption & SQL/Shell Injection in Scripts |
| `SEC-027` | `AMI-72` | High | `In Progress` (`Upstream-Gated`) | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | Vulnerable Production Dependencies in `sayra` (`melipayamak`/`sharp`/`zod`) & `Blog` (`requests`/`urllib3`/`idna`) |
| `SEC-028` | `AMI-73` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N` | `passwordHash` Exposure, Unprotected `POST /gamingCenters`, Login Lockout/`isActive` & Cookie-Only Refresh |
| `SEC-029` | `AMI-74` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N` | Unauthenticated Review Spoofing, Duplicate `NULL`-Station Reviews & Customer Wallet/Name Leak |
| `SEC-030` | `AMI-75` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:H/SC:N/SI:N/SA:N` | Search Algorithmic DoS, Short-Link `maxClicks`/IPv6 Bypass, CSV Injection & Error Disclosure |
| `SEC-031` | `AMI-76` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:L/VA:L/SC:N/SI:N/SA:N` | Inverted `tenantGuard` Order on Waitlist Routes & Cross-Tenant `mediaId` in Advertisements |
| `SEC-032` | `AMI-77` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` `?fields=` Cache Poisoning, ORM Ordering, Weak Passwords, Redis OOM & `ContentType` Oracle |
| `SEC-033` | `AMI-78` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:L/VI:L/VA:L/SC:N/SI:N/SA:N` | CI/CD Hardening, Nginx Upload Headers/Rate Limits, Container Hardening & Prod IPs/CORS |
| `SEC-034` | `AMI-79` | Low | `Done` | `CVSS:4.0/AV:L/AC:H/AT:P/PR:L/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N` | Config & Build Hygiene (`settings.py` test-mode/`STORAGES`, mock-server bind, `SCARF_ANALYTICS`, dev compose) |

---

## 2. Status Notes on Non-`Done` Issues (`3` Items)

- **`AMI-57` (`SEC-012` — `In Progress` / Operator Approval Gate):** Forensic Git audit confirmed `119` tracked files under `backups/` across commits `a7b51775`, `175d5ba4`, and `145ecd2b` (plus tracked `.env.dev` history from `1d4e7742` flagged by Gitleaks). `docker/backup/scripts/backup-db.sh`, `backup-perform.sh`, and `restore.sh` were hardened and verified end-to-end against an ephemeral Compose stack (`restic check --read-data`, DB wipe + `:ro` restore with post-restore `sayra_app`/`blog_app` re-grant, RO-Restic `--no-lock` + `/uploads` canary recovery). Remains `In Progress` pending approved Git history rewrite (`git filter-repo`), off-repo host backup migration, and full production credential rotation.
- **`AMI-70` (`SEC-025` — `In Progress` / Operator Approval Gate):** Authenticated Redis (`--requirepass` + `REDISCLI_AUTH` healthchecks), least-privilege PostgreSQL roles (`sayra_app` / `blog_app`, idempotent `docker/postgres/provision-least-privilege-roles.sql`), and 5-network Compose segmentation (`edge`, `inter_service`, `egress`, `sayra_internal`, `blog_internal`) are implemented and verified live in ephemeral Compose (`NOAUTH`/`PONG`, cross-DB `CONNECT` denial, network isolation). Remains `In Progress` pending coordinated maintenance-window cutover on the live PostgreSQL cluster and production `.env`.
- **`AMI-72` (`SEC-027` — `In Progress` / Upstream-Constrained Residual CVEs):** Direct upgrades were completed and tested (`melipayamak` replaced with native `fetch`, `sharp@^0.35.5`, `zod@^4.6.7`, dev deps moved, dual Node lockfiles synced, `Blog/requirements.txt` compiled to `Django==5.2.19`, `Blog/mock-server` fixed to `0` vulns). `sayra` `npm audit` dropped from `66` (`4` critical, `4` high) to `55` (`0` critical, `1` high), and `Blog` `pip-audit` dropped from `258` CVEs (`25` packages) to `11` CVEs (`2` packages). Remains `In Progress` solely for upstream-constrained packages: `tinymce@6.8.6` (`4` Trivy `HIGH`, pinned by `@adminjs/design-system@4.1.1`), `social-auth-core==4.9.1` (`7` `pip-audit` CVEs, capped `<5.0` by `djoser==2.3.3`), and dev CLI `black==25.1.0` (`4` `pip-audit` CVEs, pinned to match `Blog/.github/workflows/ci.yml`).
