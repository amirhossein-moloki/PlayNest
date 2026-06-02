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

## Payments

### POST `/gamingCenters/:gamingCenterId/bookings/:bookingId/payments/init`

- **Auth**: required
- **Roles**: `MANAGER`, `RECEPTIONIST`, `STAFF`
- **Headers**: `Idempotency-Key`
- **Body**: none (params validation only via `InitPaymentValidators`)
- **Response**: `201 Created`:

```json
{
  "success": true,
  "data": {
    "paymentId": "...",
    "paymentStatus": "INITIATED",
    "checkoutUrl": "https://sandbox.zarinpal.com/pg/StartPay/..."
  }
}
```

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
