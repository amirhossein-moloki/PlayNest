# PlayNest Backend URL Shortener, Link Management, Campaigns & QR Code Architecture

## 1. Overview & Separation from SEO Slug History

This document describes the **backend-only** URL Shortener, Link Management, Click Analytics, Marketing Campaign, Domain Governance, and QR Code Generation subsystem implemented inside `sayra/`.

### Clear Architectural Separation from Existing Slug Redirects
PlayNest already maintains two SEO slug history models:
- `GamingCenterSlugHistory` (`gamingCenter` canonical URL slug changes)
- `PageSlugHistory` (CMS page SEO slug changes)

The URL shortener system does **not** overload or duplicate SEO slug history:
- Dedicated public namespaces (`/r/:code`, `/s/:code`, `/api/v1/short-links/r/:code`) isolate short-code resolution from gaming center and page slugs (`RESERVED_SHORT_CODES` also prevents collisions with platform route segments such as `admin`, `api`, `auth`, `blog`, `search`, `gamingcenters`, `short-links`, `r`, `s`).
- `ShortLink` stores short aliases, destination URLs, lifecycle states, click counters, UTM defaults, campaign relations, and QR preferences, while `ShortLinkChangeLog` + `AuditLog` maintain an immutable audit trail when destinations or statuses change.
- Printed QR codes always encode the immutable `shortUrl` (`/r/<code>`), so changing `destinationUrl` updates redirects immediately while existing QR prints remain valid without re-printing.

---

## 2. Database Schema & Indexing (`sayra/prisma/schema.prisma`)

Migration: `sayra/prisma/migrations/20270115000000_add_short_links_and_campaigns/migration.sql`  
Rollback: `sayra/prisma/migrations/20270115000000_add_short_links_and_campaigns/rollback.sql`

### Enums
- `ShortLinkStatus`: `ACTIVE`, `INACTIVE`, `EXPIRED`, `ARCHIVED`
- `ShortLinkOwnerType`: `PLATFORM`, `GAMING_CENTER`, `USER`
- `ShortLinkTargetCategory`: `GAMING_CENTER`, `ADVERTISEMENT`, `TOURNAMENT`, `ARTICLE`, `EVENT`, `PROMOTION`, `EXTERNAL`, `OTHER`
- `ShortLinkClickClassification`: `VALID`, `DUPLICATE`, `BOT`, `SUSPICIOUS`
- `ShortLinkCampaignStatus`: `DRAFT`, `ACTIVE`, `PAUSED`, `ENDED`, `ARCHIVED`
- `AllowedDomainRuleType`: `ALLOW`, `BLOCK`

### Models & Key Indexes
1. **`ShortLinkCampaign`**:
   - Fields: `id`, `name`, `slug`, `description`, `ownerType`, `gamingCenterId`, `createdByUserId`, `createdByAdminId`, `status`, `adSource`, `utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `startsAt`, `endsAt`, `deletedAt`, `createdAt`, `updatedAt`.
   - Uniqueness & Indexes:
     - `@@unique([gamingCenterId, slug])` for per-center campaign slugs.
     - Partial unique index `ShortLinkCampaign_global_slug_unique` on `(slug)` `WHERE "gamingCenterId" IS NULL AND "deletedAt" IS NULL` to enforce uniqueness across platform-wide campaigns (where PostgreSQL treats `NULL`s as distinct in composite unique constraints).
     - Composite indexes on `(gamingCenterId, status)`, `(ownerType, status)`, `(startsAt, endsAt)`.

2. **`ShortLink`**:
   - Fields: `id`, `code`, `normalizedCode` (unique, case-insensitive lookup key), `isCustomCode`, `destinationUrl`, `destinationHost`, `title`, `description`, `targetCategory`, `targetEntityId`, `ownerType`, `gamingCenterId`, `ownerUserId`, `createdByUserId`, `createdByAdminId`, `campaignId`, UTM fields (`utmSource`, `utmMedium`, `utmCampaign`, `utmTerm`, `utmContent`, `appendUtmParams`), lifecycle (`status`, `redirectStatusCode` `301|302`, `expiresAt`, `maxClicks`), `qrConfig` (`Json?`), `metadata` (`Json?`), counters (`totalClicks`, `validClicks`, `uniqueClicks`, `duplicateClicks`, `botClicks`, `suspiciousClicks`, `lastClickedAt`), `deletedAt`, `createdAt`, `updatedAt`.
   - Indexes: `@@unique([normalizedCode])`, `(gamingCenterId, status, deletedAt)`, `(campaignId, deletedAt)`, `(ownerUserId, deletedAt)`, `(targetCategory, targetEntityId)`, `(destinationHost)`, `(expiresAt)`.

3. **`ShortLinkChangeLog`**:
   - Tracks `LINK_CREATED`, `LINK_UPDATED`, `DESTINATION_CHANGED`, `STATUS_CHANGED`, `LINK_DELETED` with `previousDestinationUrl`, `newDestinationUrl`, `changes` JSON diff, `actorType`, `actorUserId` / `actorAdminId`, `ipHash`, and `userAgent`.
   - Indexed on `(shortLinkId, createdAt DESC)`.

4. **`ShortLinkClick`**:
   - Stores per-click telemetry: `shortLinkId`, `campaignId`, `gamingCenterId`, `clickedAt`, `classification`, `isUniqueVisitor`, `visitorHash` (salted daily HMAC), `deviceType`, `os`, `browser`, `countryCode`, `region`, sanitized `referrer` (query/hash stripped), `referrerDomain`, `trafficSource`, UTM tags, `botReason`.
   - **Privacy**: Zero raw IP addresses are persisted anywhere in `ShortLinkClick`, `ShortLinkDailyStat`, `ShortLinkChangeLog`, or `AuditLog`.
   - Indexed on `(shortLinkId, clickedAt DESC)`, `(campaignId, clickedAt DESC)`, `(gamingCenterId, clickedAt DESC)`, `(shortLinkId, classification, clickedAt)`, `(visitorHash, clickedAt)`.

5. **`ShortLinkDailyStat`**:
   - Daily aggregated rollups per `(shortLinkId, date)` with atomic increments for `totalClicks`, `validClicks`, `uniqueClicks`, `duplicateClicks`, `botClicks`, `suspiciousClicks`.

6. **`ShortLinkDomainRule`**:
   - Platform-admin managed domain allowlist/blocklist (`domain` unique, `ruleType`, `includeSubdomains`, `isActive`, `description`, `createdByAdminId`).

7. **`AdvertisementRequest` Integration**:
   - Added nullable FK `shortLinkId` (`onDelete: SetNull`, indexed) on `AdvertisementRequest` linking banner ads to managed short links.

---

## 3. Code Architecture & Responsibilities

| File | Responsibility |
| --- | --- |
| `sayra/src/modules/short-links/shortCode.ts` | CSPRNG Base58 code generation (unambiguous alphabet), `normalizeShortCode`, format & `RESERVED_SHORT_CODES` validation, `buildShortUrl`. |
| `sayra/src/modules/short-links/urlSecurity.ts` | Open Redirect / SSRF / private & obfuscated IPv4/IPv6 blocking, Punycode (`xn--`) checks, shortener-chain blocking, redirect loop detection, DB/Redis cached domain rules (`BLOCK` > `ALLOW`), `isDestinationBlockedForRedirect`, UTM merge composition. |
| `sayra/src/modules/short-links/clickClassifier.ts` | Salted HMAC-SHA256 `visitorHash` (daily scoped) & `ipBucketHash`, bot/crawler/HTTP-client detection, device/OS/browser extraction, referrer sanitization & source classification, geo header extraction. |
| `sayra/src/modules/short-links/qrCode.generator.ts` | Self-contained ISO/IEC 18004 pure-TS QR encoder (Versions 1–10 Byte mode, GF(256) Reed-Solomon ECC L/M/Q/H, BCH info, 8-mask penalty scoring) + SVG builder + `sharp` PNG rasterizer with pure-TS `zlib` PNG fallback. |
| `sayra/src/modules/short-links/shortLinkCache.ts` | Redis hot cache (`300s` TTL), negative sentinel cache (`30s` TTL), in-process singleflight deduplication, cache invalidation, and atomic duplicate/unique/burst click signal tracking (with bounded in-memory fallback when Redis `INCR`/`SET NX` is unavailable). |
| `sayra/src/modules/short-links/shortLinks.repo.ts` | Prisma data access layer, transactional creation/updates with `ShortLinkChangeLog`, atomic click & daily stat updates, campaign & domain rule queries. |
| `sayra/src/modules/short-links/clickAnalytics.service.ts` | Non-blocking redirect telemetry pipeline, BullMQ `short-link-clicks` dispatch in non-test runtimes with inline fallback and `flushPendingClickAnalytics()`. |
| `sayra/src/modules/short-links/shortLinks.service.ts` | Domain rules, ownership & multi-tenant RBAC checks, high-speed redirect resolver, link/campaign CRUD, analytics & link-comparison aggregation, QR generation, and audit logging. |
| `sayra/src/modules/short-links/shortLinks.validators.ts` | Zod request validation schemas and query parsers (`parseOptionalBoolean`). |
| `sayra/src/modules/short-links/shortLinks.controller.ts` | Thin Express handlers enforcing actor & tenant extraction, security redirect headers (`Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy`), and QR content headers. |
| `sayra/src/modules/short-links/shortLinks.routes.ts` | Express routers for public redirect, scoped, gaming-center tenant, and platform-admin scopes (with `/domains` mounted prior to wildcard `/:linkId`). |
| `sayra/src/jobs/producers/shortLinkClicks.producer.ts` & `sayra/src/jobs/workers/shortLinkClicks.worker.ts` | BullMQ asynchronous worker registered in `sayra/src/jobs/workers/index.ts` under queue `short-link-clicks`. |

---

## 4. API Endpoints Reference

Full OpenAPI 3.0 contracts are documented in `sayra/src/docs/openapi.yaml` and `sayra/openapi.yml` (symlinked at `/openapi.yml`).

### Public Fast Redirects (No Auth)
- `GET /r/:code`
- `GET /s/:code`
- `GET /api/v1/short-links/r/:code`

**Redirect Responses**:
- `301` / `302` (`Location` with merged UTM parameters, `Cache-Control: no-store, no-cache, must-revalidate, private`, `X-Robots-Tag: noindex, nofollow`)
- `404` (`SHORT_LINK_NOT_FOUND`): Malformed code, reserved word, missing, or soft-deleted link
- `410` (`SHORT_LINK_INACTIVE` | `SHORT_LINK_ARCHIVED` | `SHORT_LINK_EXPIRED` | `SHORT_LINK_MAX_CLICKS_REACHED`)
- `429` (`RATE_LIMIT_EXCEEDED`)
- `451` (`SHORT_LINK_DESTINATION_BLOCKED`): Destination domain dynamically blocked or unsafe at redirect time

### Scoped Short Links & Campaigns (JWT Authenticated Non-Customer Actors)
- Links: `POST|GET /api/v1/short-links`, `GET|PATCH|DELETE /api/v1/short-links/:linkId`, `PATCH .../destination`, `PATCH .../status`, `GET .../history`, `GET .../stats`, `GET .../qr`
- Campaigns (Manager/Admin/PlatformAdmin): `POST|GET /api/v1/short-link-campaigns`, `GET|PATCH|DELETE /api/v1/short-link-campaigns/:campaignId`, `PATCH .../status`, `GET .../stats`

### Gaming Center Tenant Routes (`authMiddleware` + `tenantGuard` + `requireRole(['MANAGER', 'ADMIN'])`)
- `POST|GET /api/v1/gamingCenters/:gamingCenterId/short-links`
- `GET|PATCH|DELETE /api/v1/gamingCenters/:gamingCenterId/short-links/:linkId`
- `PATCH /api/v1/gamingCenters/:gamingCenterId/short-links/:linkId/destination`
- `PATCH /api/v1/gamingCenters/:gamingCenterId/short-links/:linkId/status`
- `GET /api/v1/gamingCenters/:gamingCenterId/short-links/:linkId/history`
- `GET /api/v1/gamingCenters/:gamingCenterId/short-links/:linkId/stats` (`granularity=day|hour`, `from`, `to`)
- `GET /api/v1/gamingCenters/:gamingCenterId/short-links/:linkId/qr` (`format=svg|png|json|dataurl`, `size`, `margin`, `ecc`, `fg`, `bg`, `download`)
- `POST|GET /api/v1/gamingCenters/:gamingCenterId/short-link-campaigns`
- `GET|PATCH|DELETE /api/v1/gamingCenters/:gamingCenterId/short-link-campaigns/:campaignId`
- `PATCH /api/v1/gamingCenters/:gamingCenterId/short-link-campaigns/:campaignId/status`
- `GET /api/v1/gamingCenters/:gamingCenterId/short-link-campaigns/:campaignId/stats`

### Platform Admin & Domain Security Governance (`requirePlatformAdmin`)
- Domain Rules: `GET|POST /api/v1/platform-admin/short-links/domains`, `PATCH|DELETE /api/v1/platform-admin/short-links/domains/:ruleId`
- Global Links & Campaigns: Same 10 link routes + 7 campaign routes under `/api/v1/platform-admin/short-links*` and `/api/v1/platform-admin/short-link-campaigns*` (plus `includeDeleted=true` and `gamingCenterId` filtering).

### Advertisement Integration
- `POST /api/v1/gamingCenters/:gamingCenterId/advertisements` accepts `shortLinkId` or `autoCreateShortLink: true` (auto-creating a `GAMING_CENTER` link in `ADVERTISEMENT` category) and returns `shortLinkId` & `shortUrl`.
- `PATCH /api/v1/gamingCenters/:gamingCenterId/advertisements/:id` accepts `shortLinkId` (or `null` to disconnect).
- Public slider endpoints (`/api/v1/public/advertisements/slider`, `/api/v1/public/gamingCenters/:slug/advertisements/slider`) include `shortLinkId` & `shortUrl`.

---

## 5. RBAC & Multi-Tenant Isolation Matrix

| Role / Actor Type | Scoped `/short-links` | `/short-link-campaigns` | `/gamingCenters/:id/short-links*` | `/platform-admin/short-links*` |
| --- | --- | --- | --- | --- |
| `CUSTOMER` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| `USER` (`STAFF`) | Own `USER`-owned links only (Center links return `404`) | `403 Forbidden` | `403 Forbidden` | `403 Forbidden` |
| `USER` (`MANAGER` / `ADMIN`) | Own gaming center links only (cross-tenant returns `404`) | Own gaming center campaigns only | Own center only (cross-tenant returns `404`) | `403 Forbidden` |
| `PLATFORM_ADMIN` / Superuser | All links | All campaigns | Any center | Full access + Domain Rules |

---

## 6. Security, Privacy & Redirect Performance Design

1. **URL Validation & SSRF / Open Redirect Protection**:
   - Enforces HTTP/HTTPS schemes only; blocks control characters, leading `//` or `\\`, embedded URL credentials (`user:pass@`), `localhost`, `.local`, `.internal`, RFC1918 private IPs, loopback `127.0.0.0/8` & `::1`, cloud metadata `169.254.169.254`, and obfuscated decimal/hex/octal IPs (`0x7f000001`, `2130706433`).
   - Blocks Punycode (`xn--`) homograph domains and known third-party URL shorteners (`bit.ly`, `tinyurl.com`, `t.co`, etc.) unless explicitly allowlisted by platform admins.
   - Blocks redirect loops targeting PlayNest's own `/r/`, `/s/`, or `/api/v1/short-links/r/` paths, while keeping external allowlisted paths (e.g. `instagram.com/s/...`) unrestricted.
   - Configurable policy via `SHORT_LINK_EXTERNAL_POLICY` (`ALLOWLIST_ONLY` default or `BLOCKLIST_ONLY`), where explicit `BLOCK` rules always supersede `ALLOW` rules.
2. **Nginx Edge Proxy (`docker/nginx/conf.d/app.conf.template`)**:
   - Proxies `/r/` and `/s/` on the main PlayNest virtual host directly to `http://sayra_backend` with tight upstream timeouts (`10s` connect / `15s` read) and `limit_req zone=api_limit burst=200 nodelay`.
3. **Click Classification & Privacy**:
   - `BOT`: Matched against crawler/preview/headless/HTTP-client UA signatures or missing UA.
   - `SUSPICIOUS`: IP bucket exceeds `SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE` within 60 seconds.
   - `DUPLICATE`: Same link + daily salted `visitorHash` seen within `SHORT_LINK_DEDUP_WINDOW_SECONDS`.
   - `VALID`: Remaining legitimate clicks; `isUniqueVisitor` uses a 24h UTC-date-scoped HMAC (`HMAC-SHA256(SHORT_LINK_PRIVACY_SALT, linkId:utcDate:ip:ua)`).

---

## 7. Environment Variables (`sayra/src/config/env.ts`)

| Variable | Default | Purpose |
| --- | --- | --- |
| `SHORT_LINK_BASE_URL` | `https://sayra-booking.ir/r` | Base prefix for returned `shortUrl` and QR encoding |
| `SHORT_LINK_CODE_LENGTH` | `7` | Auto-generated Base58 code length (`6..12`) |
| `SHORT_LINK_EXTERNAL_POLICY` | `ALLOWLIST_ONLY` | `ALLOWLIST_ONLY` or `BLOCKLIST_ONLY` external domain mode |
| `SHORT_LINK_ALLOWED_DOMAINS` | `""` | Comma-separated external domains permitted via env |
| `SHORT_LINK_PRIVACY_SALT` | `undefined` (falls back to `JWT_ACCESS_SECRET`) | Dedicated HMAC salt for visitor & IP hashing |
| `SHORT_LINK_DEDUP_WINDOW_SECONDS` | `300` | Window classifying repeat visitor clicks as `DUPLICATE` |
| `SHORT_LINK_BURST_MAX_CLICKS_PER_MINUTE` | `20` | IP bucket threshold flagging `SUSPICIOUS` burst clicks |
| `SHORT_LINK_MAX_PER_CENTER` | `500` | Maximum active short links per gaming center |
| `SHORT_LINK_REDIRECT_RATE_LIMIT_MAX` | `120` | Redirect requests/min per IP before `429` |
| `SHORT_LINK_CREATE_RATE_LIMIT_MAX` | `30` | Link creation requests/min before `429` |

---

## 8. Migration & Rollback Commands

```bash
# Apply migration (with DATABASE_URL set)
cd sayra && npx prisma migrate deploy && npx prisma generate

# Rollback manually if required
psql "$DATABASE_URL" -f sayra/prisma/migrations/20270115000000_add_short_links_and_campaigns/rollback.sql
```

---

## 9. Verification & Benchmark Results

All verification checks ran cleanly after final code, OpenAPI, and test edits:

1. **Prisma Schema Validation & Client Generation**:
   - Command: `cd sayra && DATABASE_URL="postgresql://postgres:postgres@localhost:5432/playnest" npx prisma validate && npx prisma generate`
   - Result: Passed (Prisma Client `v5.22.0` generated cleanly in `830ms`; note DDL migration file `sayra/prisma/migrations/20270115000000_add_short_links_and_campaigns/migration.sql` was verified syntactically and generated for PostgreSQL deployment, not executed against a live DB inside the sandbox).
2. **TypeScript Compilation (`npm run build`)**:
   - Result: Exited `0` (`tsc --ignoreDeprecations 5.0` + asset copy).
3. **ESLint Static Analysis**:
   - Scope: `src/modules/short-links/`, `src/jobs/producers/shortLinkClicks.producer.ts`, `src/jobs/workers/shortLinkClicks.worker.ts`, `src/modules/advertisement/`, `src/modules/public/advertisements.public.controller.ts`, `src/common/middleware/rateLimit.ts`, `src/app.ts`, `src/routes/index.ts`, `tests/unit/short-links/`, `tests/api/short-links/`.
   - Result: Exited `0` (`0` errors, `0` warnings).
4. **OpenAPI 3.0 Synchronization (`sayra/src/docs/openapi.yaml` & `sayra/openapi.yml`)**:
   - Python `pyyaml` check: Passed on both files (`335 paths`, `439 operationIds`, `153 schemas`, `0` broken `$ref`, `0` duplicate `operationId`, `0` missing path params).
   - `npx jest tests/api/openapi.spec.ts --no-cache` (`yamljs` parser): `12/12` assertions passed.
5. **ShortLinks, Advertisements & OpenAPI Jest Suite**:
   - Command: `cd sayra && npx jest tests/unit/short-links/ tests/api/short-links/ tests/api/advertisement/advertisement.owner.spec.ts tests/api/public/public.advertisements.spec.ts tests/api/platform-admin/platform-admin.ad-requests.spec.ts tests/api/openapi.spec.ts --no-cache`
   - Result: `6/6` suites passed, `70/70` tests passed (`45.832 s`; mocked Redis + Prisma in-memory stateful store).
   - Cached Redirect Benchmark (`500` cached `GET /r/:code` requests with `prisma.shortLink.findUnique` call count `= 0`): `470.2 ms` (`1063 req/s`).
6. **Search & Filter Regression Jest Suite**:
   - Command: `cd sayra && npx jest tests/unit/common/searchText.spec.ts tests/unit/common/operatingHours.spec.ts tests/api/search/search.api.spec.ts tests/api/gamingCenters/gamingCenters.filters.spec.ts --no-cache`
   - Result: `4/4` suites passed, `34/34` tests passed (`29.751 s`).

