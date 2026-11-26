# PlayNest Validated Security Vulnerability Catalog

**Linear Project:** `Backend Security Audit & Remediation` (`P-AMI-4`)  
**Total Confirmed Findings:** `34` (`13` Critical, `14` High, `6` Medium, `1` Low)  
**Linear Status Summary:** `24 Done`, `10 In Progress` (`7` Django ORM/DRF tests awaiting Django CI + `3 Blocked` manual ops / major dependency upgrades)

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
| `SEC-011` | `AMI-56` | Critical | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` IDOR on `POST /api/media/<pk>/purge/` and `/restore/` Enabling Arbitrary Media Deletion |
| `SEC-012` | `AMI-57` | Critical | `In Progress` (`Blocked`) | `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:N/VA:H/SC:N/SI:N/SA:N` | Live Restic Backup Repo Committed to Git & Silent Skipping of Primary Production DB/Uploads |
| `SEC-013` | `AMI-58` | Critical | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Silent Fallback to Hardcoded Public Secrets, Fail-Open Nginx SSR Secret & Prod Zibal Sandbox Default |
| `SEC-014` | `AMI-59` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Tenant `MANAGER` Escalation to `ADMIN` -> Global Tickets & Notification Logs IDOR |
| `SEC-015` | `AMI-60` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:P/VC:L/VI:L/VA:N/SC:H/SI:H/SA:N` | Reflected XSS in CMS Page Editor + Stored XSS in Public CMS Pages & Global Ad Slider |
| `SEC-016` | `AMI-61` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:H/VA:H/SC:L/SI:L/SA:N` | Cross-Tenant Media Deletion + Unrestricted KYC SVG/HTML Upload & Pre-Validation Disk Write |
| `SEC-017` | `AMI-62` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | AdminJS Cookie Signature Bypass, Missing Token Revocation & Missing Refresh Token Rotation |
| `SEC-018` | `AMI-63` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:N/VI:H/VA:N/SC:N/SI:N/SA:N` | Discount Concurrency Races, Silent Quota-Error Swallowing & Free VIP Upgrade via Reschedule |
| `SEC-019` | `AMI-64` | High | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` Mass Assignment on `MediaDetailSerializer`, Unauth `download_media` & Upload Validation Bypass |
| `SEC-020` | `AMI-65` | High | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:H/VI:N/VA:N/SC:N/SI:N/SA:N` | `[Django Blog]` Cache Warmup Bypass Leaking Draft/Private Articles & `related_article_ids` Metadata Leak |
| `SEC-021` | `AMI-66` | High | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:P/VC:L/VI:L/VA:N/SC:H/SI:H/SA:N` | `[Django Blog]` Comment Moderation Bypass, Unsanitized Comment HTML & Broken Block HTML Sanitizer |
| `SEC-022` | `AMI-67` | High | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:H/UI:P/VC:H/VI:H/VA:N/SC:H/SI:H/SA:N` | `[Django Blog]` Unrestricted `.html`/`.svg` Upload & `@csrf_exempt` on `/api/editor/upload/` |
| `SEC-023` | `AMI-68` | High | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | `[Django Blog]` Privilege Escalation on `AuthorProfileSerializer` & `StaticAPIKeyAuthentication` Superuser Backdoor |
| `SEC-024` | `AMI-69` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:H/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` Tar Slip, S3 Restore Path Traversal & BDR Crypto Stream Integrity Flaws |
| `SEC-025` | `AMI-70` | High | `In Progress` (`Blocked`) | `CVSS:4.0/AV:A/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | Unauthenticated Redis, Shared Postgres Superuser, Flat Network & `Blog/Dockerfile` Root User |
| `SEC-026` | `AMI-71` | High | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:N/SC:N/SI:N/SA:N` | Nginx Plaintext/HSTS/XFF Spoofing, Staff Lockout Exemption & SQL/Shell Injection in Scripts |
| `SEC-027` | `AMI-72` | High | `In Progress` (`Blocked`) | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N` | Vulnerable Production Dependencies in `sayra` (`melipayamak`/`sharp`/`zod`) & `Blog` (`requests`/`urllib3`/`idna`) |
| `SEC-028` | `AMI-73` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:L/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N` | `passwordHash` Exposure, Unprotected `POST /gamingCenters`, Login Lockout/`isActive` & Cookie-Only Refresh |
| `SEC-029` | `AMI-74` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N` | Unauthenticated Review Spoofing, Duplicate `NULL`-Station Reviews & Customer Wallet/Name Leak |
| `SEC-030` | `AMI-75` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:H/SC:N/SI:N/SA:N` | Search Algorithmic DoS, Short-Link `maxClicks`/IPv6 Bypass, CSV Injection & Error Disclosure |
| `SEC-031` | `AMI-76` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:L/UI:N/VC:L/VI:L/VA:L/SC:N/SI:N/SA:N` | Inverted `tenantGuard` Order on Waitlist Routes & Cross-Tenant `mediaId` in Advertisements |
| `SEC-032` | `AMI-77` | Medium | `In Progress` | `CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:L/VI:L/VA:H/SC:N/SI:N/SA:N` | `[Django Blog]` `?fields=` Cache Poisoning, ORM Ordering, Weak Passwords, Redis OOM & `ContentType` Oracle |
| `SEC-033` | `AMI-78` | Medium | `Done` | `CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:L/VI:L/VA:L/SC:N/SI:N/SA:N` | CI/CD Hardening, Nginx Upload Headers/Rate Limits, Container Hardening & Prod IPs/CORS |
| `SEC-034` | `AMI-79` | Low | `Done` | `CVSS:4.0/AV:L/AC:H/AT:P/PR:L/UI:N/VC:L/VI:L/VA:N/SC:N/SI:N/SA:N` | Config & Build Hygiene (`settings.py` test-mode/`STORAGES`, mock-server bind, `SCARF_ANALYTICS`, dev compose) |

---

## 2. Status Notes on Non-`Done` Issues (`10` Items)

- **7 Django Blog ORM/DRF Issues (`AMI-56`, `AMI-64`, `AMI-65`, `AMI-66`, `AMI-67`, `AMI-68`, `AMI-77`):** Source patches, `py_compile` checks, pure-Python helper tests (`test_standalone_security.py`), and Django `APITestCase` regression tests (`Blog/tests/security/test_blog_security.py`) are implemented. Issues remain `In Progress` in Linear because the Django runtime/database is unavailable locally to execute `python manage.py test`.
- **3 `Blocked` Manual Operations / Major Upgrade Issues (`AMI-57`, `AMI-70`, `AMI-72`):**
  - `AMI-57` (`SEC-012`): Source/script/Compose fixes are complete; requires operator Git history rewrite (`git filter-repo`) to purge `backups/` history and rotate historical credentials.
  - `AMI-70` (`SEC-025`): `Blog/.dockerignore`, multi-stage non-root `Blog/Dockerfile`, and `docker-compose.yml` `no-new-privileges` / `pids_limit` are complete; requires coordinated live rollout for Redis `--requirepass`, least-privilege PostgreSQL roles (`sayra_app`/`blog_app`), and Docker network segmentation.
  - `AMI-72` (`SEC-027`): `sayra` (`npm audit`: `4` critical, `4` high, `58` moderate across `66` entries — notably `melipayamak@^1.0.5`, `sharp@^0.33.5`, `zod@^3.23.8`, `@adminjs/*`) and `Blog/requirements.txt` (`certifi==2023.7.22`, `idna==3.4`, `requests==2.31.0`, `urllib3==2.1.0`) require SemVer-major code/schema upgrades and online lockfile regeneration.
