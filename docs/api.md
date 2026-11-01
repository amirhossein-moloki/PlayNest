# API Reference

Base URL: `/api/v1`

This document is generated from route files in `src/routes/index.ts` and `src/modules/**/**.routes.ts`. It does not assume any behavior not present in code.

## API Standards

### Naming
- Paths: `lowercase`, kebab-case for multiple words.
- JSON Keys: `camelCase`.

### Timezone
- All dates are sent and received in **ISO 8601** format in **UTC**.
- GamingCenter-specific local time is handled by the application using `Settings.timeZone`.

### Idempotency
- Required for sensitive operations: **Public Bookings** and **Payments**.
- Header: `Idempotency-Key: <string>` (16-128 chars).
- Scope: Key + GamingCenter + Path.
- TTL: 24 hours.

## Response Envelope

Most JSON APIs use `responseMiddleware` which wraps responses like:

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": { "requestId": "..." }
}
```

Errors follow:

```json
{
  "success": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable message",
    "details": {}
  },
  "meta": { "requestId": "..." }
}
```

All JSON routes use the envelope below.

## Auth

### POST `/auth/user/otp/request`

- **Auth**: public
- **Rate limiting**: `publicApiRateLimiter`
- **Body** (`requestOtpSchema`)
  - `phone` (string, min length 10)
- **Response**: `{ "success": true, "data": { "message": "..." } }`

Example request:

```json
{ "phone": "09123456789" }
```

### POST `/auth/user/otp/verify`

- **Auth**: public
- **Body** (`verifyOtpSchema`)
  - `phone` (string, min length 10)
  - `code` (string, length 6)
- **Response**: `{ "success": true, "data": { "gamingCenters": [{ "id": "...", "name": "..." }] } }`

### POST `/auth/user/login/otp`

- **Auth**: public
- **Body** (`loginWithOtpSchema`)
  - `phone` (string)
  - `gamingCenterId` (string, CUID)
- **Response**: `{ "success": true, "data": { "user": "...", "tokens": "..." } }`

### POST `/auth/platform-admin/login`

- **Auth**: public
- **Body** (`platformAdminLoginSchema`)
  - `phone` (string)
  - `password` (string)
- **Response**: `{ "success": true, "data": { "user": "...", "tokens": "..." } }`

### POST `/auth/login`

- **Auth**: public
- **Body** (`loginSchema`)
  - `phone` (string)
  - `password` (string, required when `actorType=USER`)
  - `actorType` (`USER` or `CUSTOMER`)
  - `gamingCenterId` (required when `actorType=USER`)
- **Response**: `{ "success": true, "data": { "user": "...", "tokens": "..." } }`

### POST `/auth/refresh`

- **Auth**: public
- **Body** (`refreshSchema`)
  - `refreshToken` (string)
- **Response**: `{ "success": true, "data": { "accessToken": "..." } }`

### POST `/auth/logout`

- **Auth**: required (Bearer access token)
- **Response**: `{ "success": true, "data": { "message": "..." } }`

### GET `/auth/me`

- **Auth**: required (Bearer access token)
- **Response**: `{ "success": true, "data": { "id": "...", "role": "..." } }`

## Platform Admin

All routes under `/api/v1/platform-admin` are protected by `authMiddleware` and `requirePlatformAdmin` (or global superuser).

### GET `/platform-admin/dashboard`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Response**: HTML Platform Admin Web Dashboard.

### GET `/platform-admin/gaming-centers`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Query**: `page`, `limit`, `search`
- **Response**: List of all gaming centers across the platform.

### PATCH `/platform-admin/gaming-centers/:id/status`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Body**: `{ "isActive": boolean, "subscriptionStatus": string }`
- **Response**: `{ "success": true, "data": { ... } }`

### GET `/platform-admin/users`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Query**: `page`, `limit`, `gamingCenterId`, `role`, `search`, `isActive`
- **Response**: Paginated list of users across all centers.

### PATCH `/platform-admin/users/:id/status`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Body**: `{ "isActive": boolean }`
- **Response**: `{ "success": true, "data": { ... } }`

### POST `/platform-admin/users/:id/reset-password`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Body**: `{ "newPassword": "..." }`
- **Response**: `{ "success": true, "data": { ... } }`

### POST `/platform-admin/users/:id/revoke-sessions`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Response**: `{ "success": true, "data": { ... } }`

### GET `/platform-admin/customers`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Query**: `page`, `limit`, `search`
- **Response**: Paginated list of customers across all centers.

### GET `/platform-admin/operations/overview`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Response**: System-wide operational overview metrics.

### GET `/platform-admin/financials/overview`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Response**: System-wide financial metrics and ledger balances.

### GET `/platform-admin/audit-logs`
- **Auth**: required (`PLATFORM_ADMIN`)
- **Query**: `page`, `limit`, `gamingCenterId`, `action`, `entity`, `userId`, `startDate`, `endDate`
- **Response**: Paginated system-wide audit logs.

## Health

### GET `/health`

- **Auth**: public
- **Response**: `{ "success": true, "data": { "status": "ok" } }`

## GamingCenters

### GET `/gamingCenters`

- **Auth**: public
- **Response**: `{ "success": true, "data": [ ... ] }`

### GET `/gamingCenters/:id`

- **Auth**: public
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### POST `/gamingCenters`

- **Auth**: required
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### PATCH `/gamingCenters/:id`

- **Auth**: required
- **Roles**: `MANAGER`
- **Tenant guard**: gamingCenter ID must match the authenticated user.
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### DELETE `/gamingCenters/:id`

- **Auth**: required
- **Roles**: `MANAGER`
- **Tenant guard**: gamingCenter ID must match the authenticated user.
- **Response**: `{ "success": true, "data": { "...": "..." } }`

## Services

### POST `/gamingCenters/:gamingCenterId/services`

- **Auth**: required
- **Roles**: `MANAGER`
- **Body** (`createServiceSchema`): `name`, `durationMinutes`, `price`, `currency`, `isActive?`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### GET `/gamingCenters/:gamingCenterId/services`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`, `STAFF`
- **Response**: `{ "success": true, "data": [ ... ] }`

### GET `/gamingCenters/:gamingCenterId/services/:serviceId`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`, `STAFF`
- **Params**: `serviceId` (CUID)
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### PATCH `/gamingCenters/:gamingCenterId/services/:serviceId`

- **Auth**: required
- **Roles**: `MANAGER`
- **Body** (`updateServiceSchema`): any of `name`, `durationMinutes`, `price`, `currency`, `isActive`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### DELETE `/gamingCenters/:gamingCenterId/services/:serviceId`

- **Auth**: required
- **Roles**: `MANAGER`
- **Params**: `serviceId` (CUID)
- **Response**: `204 No Content`

### GET `/public/gamingCenters/:gamingCenterSlug/services`

- **Auth**: public
- **Behavior**: forcibly sets `isActive=true` before querying.
- **Response**: `{ "success": true, "data": [ ... ] }`

## Staff / Users

### POST `/gamingCenters/:gamingCenterId/staff`

- **Auth**: required
- **Roles**: `MANAGER`
- **Body** (`createUserSchema`): `fullName`, `phone` (Iranian format `09xxxxxxxxx`), `role`, optional public profile fields.
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### GET `/gamingCenters/:gamingCenterId/staff`

- **Auth**: required
- **Response**: `{ "success": true, "data": [ ... ] }`

### GET `/gamingCenters/:gamingCenterId/staff/:userId`

- **Auth**: required
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### PUT `/gamingCenters/:gamingCenterId/staff/:userId`

- **Auth**: required
- **Roles**: `MANAGER`
- **Body** (`updateUserSchema`): fields such as `fullName`, `role`, `isActive`, public profile fields.
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### DELETE `/gamingCenters/:gamingCenterId/staff/:userId`

- **Auth**: required
- **Roles**: `MANAGER`
- **Response**: `204 No Content`

## Shifts

### PUT `/gamingCenters/:gamingCenterId/staff/:userId/shifts`

- **Auth**: required
- **Roles**: `MANAGER`
- **Body** (`upsertShiftsSchema`): array of shift objects
  - `dayOfWeek` (0-6)
  - `startTime` (HH:MM)
  - `endTime` (HH:MM)
  - `isActive` (boolean)
- **Response**: `{ "success": true, "data": [ ... ] }`

## Availability (Public)

### GET `/public/gamingCenters/:gamingCenterSlug/availability/slots`

- **Auth**: public
- **Query** (`getAvailabilityQuerySchema`):
  - `serviceId` (CUID, required)
  - `staffId` (CUID, optional)
  - `startDate` (date string)
  - `endDate` (date string, must be > startDate)
- **Response**: `{ "success": true, "data": [ ... ] }`

Example response:

```json
{
  "success": true,
  "data": [
    {
      "time": "2024-08-01T09:00:00.000Z",
      "staff": { "id": "ck...", "fullName": "Ava" }
    }
  ]
}
```

## Bookings (Private)

### POST `/gamingCenters/:gamingCenterId/bookings`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`
- **Body** (`createBookingSchema`): `customer`, `serviceId`, `staffId`, `startAt`, `note?`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### GET `/gamingCenters/:gamingCenterId/bookings`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`, `STAFF`
- **Query** (`listBookingsQuerySchema`): `page`, `pageSize`, `sortBy`, `sortOrder`, `status`, `staffId`, `customerProfileId`, `dateFrom`, `dateTo`
- **Response**: `{ "success": true, "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 0 } }`

### GET `/gamingCenters/:gamingCenterId/bookings/:bookingId`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`, `STAFF`
- **Params**: `bookingId` (CUID)
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### PATCH `/gamingCenters/:gamingCenterId/bookings/:bookingId`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`
- **Body** (`updateBookingSchema`): any of `serviceId`, `staffId`, `startAt`, `note`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### POST `/gamingCenters/:gamingCenterId/bookings/:bookingId/confirm`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### POST `/gamingCenters/:gamingCenterId/bookings/:bookingId/cancel`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`
- **Body** (`cancelBookingSchema`): `reason?`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### POST `/gamingCenters/:gamingCenterId/bookings/:bookingId/complete`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

### POST `/gamingCenters/:gamingCenterId/bookings/:bookingId/no-show`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`
- **Response**: `{ "success": true, "data": { "...": "..." } }`

## Bookings (Public)

### POST `/public/gamingCenters/:gamingCenterSlug/bookings`

- **Auth**: public
- **Headers**: `Idempotency-Key` (16-128 chars)
- **Body** (`createPublicBookingSchema`):
  - `serviceId`, `staffId`, `startAt`
  - `customer`: `{ fullName, phone, email? }`
  - `note?`
- **Response**: `{ "success": true, "data": { "...": "..." } }`
- **Note**: service implementation is a placeholder.

## Payments & Refunds

### Scoped to Reservation:
- **POST** `/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/init` - Initialize online gateway payment (`MANAGER`, `SUPERVISOR`, `STAFF`).
- **GET** `/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/verify` - Gateway callback verification URL.
- **POST** `/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/verify` - Manual or programmatic payment verification.
- **GET** `/gamingCenters/:gamingCenterId/reservation/:reservationId/payments/status` - Inquire payment status.

### Payments Management:
- **POST** `/gamingCenters/:gamingCenterId/payments/:paymentId/refunds` - Initiate partial or full refund (`MANAGER`, `ADMIN`).
- **GET** `/gamingCenters/:gamingCenterId/payments/:paymentId/refunds/:refundId` - Get refund details.
- **GET** `/gamingCenters/:gamingCenterId/payments/:paymentId/refunds` - List all refunds for a payment.
- **GET** `/gamingCenters/:gamingCenterId/payments/ledger` - View double-entry financial ledger history (`MANAGER`, `ADMIN`).
- **POST** `/gamingCenters/:gamingCenterId/payments/reconcile` - Run financial reconciliation check (`MANAGER`, `ADMIN`).

## Expenses

Mounted under `/api/v1/gamingCenters/:gamingCenterId/expenses` (`MANAGER`, `ADMIN`).

- **POST** `/` - Record a new center operating expense.
- **GET** `/` - List expenses with filters for `category`, `status`, `startDate`, `endDate`.
- **GET** `/:id` - Get expense details by ID.
- **PATCH** `/:id` - Update expense details.
- **POST** `/:id/approve` - Approve draft expense.
- **DELETE** `/:id` - Void or remove expense record.

## CMS (Private)

All CMS routes require auth + `MANAGER` role + tenant guard.

### Pages

- **GET** `/gamingCenters/:gamingCenterId/pages`
  - Query: `status?`, `type?`, `limit?`, `offset?`
- **GET** `/gamingCenters/:gamingCenterId/pages/:pageId`
- **POST** `/gamingCenters/:gamingCenterId/pages`
  - Body: page metadata + `sections[]` (see `createPageSchema`)
- **PATCH** `/gamingCenters/:gamingCenterId/pages/:pageId`
  - Body: any editable page fields

### Media

- **POST** `/gamingCenters/:gamingCenterId/media`
  - Body: media metadata (see `createMediaSchema`)
- **PATCH** `/gamingCenters/:gamingCenterId/media/:mediaId`
  - Body: partial media update (see `updateMediaSchema`)

### Links

- All routes currently return `501` (placeholder).

### Addresses

- All routes currently return `501` (placeholder).

### Site Settings

- **GET** `/gamingCenters/:gamingCenterId/site-settings`
- **PUT** `/gamingCenters/:gamingCenterId/site-settings`
  - Body: partial SEO/site settings update (see `updateSiteSettingsSchema`)

## CMS Admin UI

### GET `/admin/gamingCenters/:gamingCenterId/pages`

- Returns a static HTML admin UI for CMS pages.
- Not protected by auth in the route itself.

## Blog & Article APIs

PlayNest supports a dual-engine blog system:
1. **Sayra Tenant-Scoped Blog Engine**: Multi-tenant blog system scoped to individual gaming centers.
2. **Payload CMS Global Editorial Engine**: Global editorial articles collection with rich-text content blocks.

### Sayra Private Blog Routes (Tenant-Scoped)

All private blog routes are mounted under `/api/v1/gamingCenters/:gamingCenterId/blog` and require authentication + tenant guard.

#### Posts & Series
- **POST** `/posts` - Create blog post (Authors: `STAFF`, `SUPERVISOR`, `MANAGER`, `ADMIN`).
- **GET** `/posts` - List blog posts for gaming center (Supports pagination, `search`, `status`, `categoryId`, `authorId`, `isActive`).
- **GET** `/posts/:id` - Get blog post by ID.
- **PATCH** `/posts/:id` - Update blog post (Authors can edit own post; Manager/Admin can edit any).
- **DELETE** `/posts/:id` - Delete blog post (`MANAGER`, `ADMIN`).
- **POST** `/posts/series` - Create post series (`MANAGER`, `ADMIN`).
- **GET** `/posts/series` - List post series.
- **GET** `/posts/series/:id` - Get post series by ID with ordered posts.
- **PATCH** `/posts/series/:id` - Update post series (`MANAGER`, `ADMIN`).

#### Comments & Reactions
- **POST** `/comments` - Post comment on article/post.
- **GET** `/comments` - List comments for moderation (`ADMIN`, `MANAGER`, `SUPERVISOR`).
- **GET** `/comments/tree` - Get nested comment tree for post.
- **PATCH** `/comments/:id` - Update author's comment.
- **DELETE** `/comments/:id` - Delete comment.
- **PATCH** `/comments/:id/moderate` - Moderate comment status (`PENDING`, `APPROVED`, `REJECTED`, `FLAGGED`, `SPAM`).
- **PATCH** `/comments/:id/pin` - Pin or unpin comment on post.
- **POST** `/comments/:id/flag` - Flag comment.
- **POST** `/reactions/toggle` - Toggle reaction (`LIKE`, `DISLIKE`, `LOVE`, `FIRE`, `CLAP`, `LAUGH`, `SAD`, `THINKING`) on post or comment.
- **GET** `/reactions/aggregates` - Get aggregated reaction counts.

#### Taxonomy & Navigation
- **POST** `/taxonomy/categories` - Create category (`MANAGER`, `ADMIN`).
- **GET** `/taxonomy/categories` - List categories.
- **GET** `/taxonomy/categories/:id` - Get category by ID.
- **PATCH** `/taxonomy/categories/:id` - Update category (`MANAGER`, `ADMIN`).
- **DELETE** `/taxonomy/categories/:id` - Delete category (`MANAGER`, `ADMIN`).
- **POST** `/taxonomy/tags` - Create tag (`MANAGER`, `ADMIN`).
- **GET** `/taxonomy/tags` - List tags.
- **GET** `/taxonomy/tags/:id` - Get tag by ID.
- **PATCH** `/taxonomy/tags/:id` - Update tag (`MANAGER`, `ADMIN`).
- **DELETE** `/taxonomy/tags/:id` - Delete tag (`MANAGER`, `ADMIN`).
- **GET** `/navigation/tree/:location` - Get navigation menu tree (`HEADER`, `FOOTER`, `SIDEBAR`, `MOBILE_DRAWER`).
- **POST** `/navigation/menus` - Create navigation menu (`MANAGER`, `ADMIN`).
- **POST** `/navigation/items` - Add navigation menu item (`MANAGER`, `ADMIN`).
- **PATCH** `/navigation/items/:id` - Update navigation item (`MANAGER`, `ADMIN`).
- **DELETE** `/navigation/items/:id` - Delete navigation item (`MANAGER`, `ADMIN`).

### Sayra Public Blog Routes

Mounted under `/api/v1/public/gamingCenters/:gamingCenterSlug/blog` (No auth required).

- **GET** `/posts` - Public list published blog posts.
- **GET** `/posts/:id` - Public get blog post by ID or slug.
- **GET** `/series` - Public list post series.
- **GET** `/series/:id` - Public get post series by ID.
- **GET** `/comments/tree` - Public get comment tree.
- **GET** `/reactions/aggregates` - Public get reaction counts.
- **GET** `/navigation/tree/:location` - Public get menu tree.
- **GET** `/categories` - Public list categories.
- **GET** `/categories/:id` - Public get category by ID.
- **GET** `/tags` - Public list tags.
- **GET** `/tags/:id` - Public get tag by ID.

### Payload CMS Articles REST API

Mounted on Payload CMS server (`/api/articles`):

- **GET** `/api/articles` - Paginated articles list (Query params: `depth`, `page`, `limit`, `where[status][equals]=published`). Unauthenticated users receive only published articles.
- **GET** `/api/articles/:id` - Get article by ID or slug.
- **POST** `/api/articles` - Create article document (Requires auth).
- **PATCH** `/api/articles/:id` - Update article document (Requires auth).
- **DELETE** `/api/articles/:id` - Delete article document (Requires auth).

### OpenAPI Specs & Interactive Swagger UI
- **Sayra OpenAPI Spec**: `/openapi.yaml`, `/openapi.json`
- **Sayra Swagger UI**: `/api-docs`, `/swagger`, `/docs`
- **Payload OpenAPI Spec**: `/payload-openapi.yaml`, `/payload-openapi.json`
- **Payload Swagger UI**: `/payload-api-docs`

## Public CMS

### GET `/public/gamingCenters/:gamingCenterSlug/pages/:pageSlug`

- Returns HTML for the requested page.
- Supports `ETag` and `If-Modified-Since` for caching.
- Redirects (301) if the slug exists in `GamingCenterPageSlugHistory`.

### GET `/public/gamingCenters/:gamingCenterSlug/media`

- Returns JSON: `{ success: true, data: media[] }`
- Adds `Cache-Control: public, max-age=300, stale-while-revalidate=300`

### GET `/public/gamingCenters/:gamingCenterSlug/links`

- Returns JSON: `{ success: true, data: links[] }`

### GET `/public/gamingCenters/:gamingCenterSlug/addresses`

- Returns JSON: `{ success: true, data: addresses[] }`

## Webhooks

### POST `/webhooks/payments/:provider`
- **Auth**: signature-based (HMAC SHA-256) using `X-Signature` header.
- **Body**: raw JSON; middleware uses `express.json({ verify })` to capture the raw body.
- **Response**: `{ success: true, data: { message: 'Webhook received and processed.' } }`

## Known Gaps / TODO

- Payments route path includes a duplicated `/bookings` segment due to how routers are mounted.
- CMS links and addresses private routes return `501` placeholders.
- CMS Admin UI route is not protected by auth middleware.

## Source of Truth

- `src/routes/index.ts`
- `src/modules/**/**.routes.ts`
- `src/modules/**/**.validators.ts`
- `src/modules/**/**.controller.ts`
- `src/common/middleware/response.ts`
