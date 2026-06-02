# Database (Prisma)

This document is generated from `prisma/schema.prisma` and is the source of truth for the data model.

## ERD (Mermaid)

```mermaid
erDiagram
  GamingCenter ||--o{ User : has
  GamingCenter ||--o{ Service : offers
  GamingCenter ||--o{ Shift : schedules
  GamingCenter ||--o{ Booking : owns
  GamingCenter ||--o{ GamingCenterCustomerProfile : has
  GamingCenter ||--o| Settings : config
  GamingCenter ||--o| GamingCenterSiteSettings : site_settings
  GamingCenter ||--o{ GamingCenterPage : pages
  GamingCenter ||--o{ GamingCenterMedia : media
  GamingCenter ||--o{ GamingCenterLink : links
  GamingCenter ||--o{ GamingCenterAddress : addresses
  GamingCenter ||--o{ GamingCenterSlugHistory : slug_history
  GamingCenter ||--o{ Review : reviews
  GamingCenter ||--o| GamingCenterCommissionPolicy : commission_policy
  GamingCenter ||--o{ BookingCommission : booking_commissions

  User ||--o{ Shift : schedules
  User ||--o{ Booking : staff_bookings
  User ||--o{ Booking : created_bookings
  User ||--o{ Booking : canceled_bookings
  User ||--o{ UserService : skills

  Service ||--o{ Booking : bookings
  Service ||--o{ Review : reviews
  Service ||--o{ UserService : staff_services

  CustomerAccount ||--o{ GamingCenterCustomerProfile : profiles
  CustomerAccount ||--o{ Booking : bookings
  CustomerAccount ||--o{ Review : reviews

  GamingCenterCustomerProfile ||--o{ Booking : bookings

  Booking ||--o{ Payment : payments
  Booking ||--o{ Review : reviews
  Booking ||--o| BookingCommission : commission

  BookingCommission ||--o{ CommissionPayment : payments

  GamingCenterPage ||--o{ GamingCenterPageSection : sections
  GamingCenterPage ||--o{ GamingCenterPageSlugHistory : slug_history
```

## Enums

- `UserRole`: `MANAGER`, `RECEPTIONIST`, `STAFF`
- `BookingStatus`: `PENDING`, `CONFIRMED`, `DONE`, `CANCELED`, `NO_SHOW`
- `BookingSource`: `IN_PERSON`, `ONLINE`
- `PaymentMethod`: `CASH`, `CARD`, `ONLINE`
- `PaymentStatus`: `INITIATED`, `PENDING`, `PAID`, `FAILED`, `REFUNDED`, `VOID`, `CANCELED`
- `BookingPaymentState`: `UNPAID`, `PENDING`, `PARTIALLY_PAID`, `PAID`, `REFUNDED`, `OVERPAID`, `FAILED`, `CANCELED`
- `PageStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`
- `PageType`: `HOME`, `ABOUT`, `SERVICES`, `GALLERY`, `TEAM`, `CONTACT`, `CUSTOM`
- `PageSectionType`: `HERO`, `RICH_TEXT`, `HIGHLIGHTS`, `SERVICES_GRID`, `STAFF_GRID`, `GALLERY_GRID`, `TESTIMONIALS`, `CONTACT_CARD`, `MAP`, `FAQ`, `CTA`
- `MediaType`: `IMAGE`, `VIDEO`
- `MediaPurpose`: `COVER`, `GALLERY`, `BEFORE_AFTER`, `LOGO`
- `LinkType`: `INSTAGRAM`, `WHATSAPP`, `TELEGRAM`, `WEBSITE`, `PHONE`, `GOOGLE_MAP`
- `ReviewTarget`: `SALON`, `SERVICE`
- `ReviewStatus`: `PUBLISHED`, `HIDDEN`, `DELETED`
- `RobotsIndex`: `INDEX`, `NOINDEX`
- `RobotsFollow`: `FOLLOW`, `NOFOLLOW`
- `CommissionType`: `PERCENT`, `FIXED`
- `CommissionStatus`: `PENDING`, `ACCRUED`, `CHARGED`, `WAIVED`, `REFUNDED`
- `CommissionPaymentMethod`: `CASH`, `CARD`, `ONLINE`, `TRANSFER`
- `CommissionPaymentStatus`: `PENDING`, `PAID`, `VOID`, `REFUNDED`
- `SessionActorType`: `USER`, `CUSTOMER`
- `OtpPurpose`: `LOGIN`, `SIGNUP`
- `OtpChannel`: `SMS`, `WHATSAPP`
- `IdempotencyStatus`: `IN_PROGRESS`, `COMPLETED`, `FAILED`
- `PaymentProvider`: `MANUAL`, `STRIPE`, `ZARINPAL`

## Models

### GamingCenter

- Fields: `id`, `name`, `isActive`, `slug` (unique), `description`, `seoTitle`, `seoDescription`, `createdAt`, `updatedAt`
- Relations: `users`, `services`, `bookings`, `shifts`, `settings`, `customers`, `siteSettings`, `pages`, `media`, `links`, `addresses`, `slugHistory`, `reviews`, `commissionPolicy`, `bookingCommissions`, `Payment`
- Indexes: `@@index([slug])`

### Settings

- Fields: `gamingCenterId` (unique), `preventOverlaps`, `timeZone`, `workStartTime`, `workEndTime`, `allowOnlineBooking`, `onlineBookingAutoConfirm`, timestamps
- Relation: `gamingCenter`

### User

- Fields: `gamingCenterId`, `fullName`, `phone`, `passwordHash`, `phoneVerifiedAt`, `role`, `isActive`, public profile fields, timestamps
- Relations: `gamingCenter`, `shifts`, bookings relations (staff/creator/canceler), `userServices`
- Unique: `@@unique([gamingCenterId, phone])`
- Indexes: `@@index([gamingCenterId, role])`, `@@index([gamingCenterId, isActive])`, `@@index([gamingCenterId, isPublic])`

### Session

- Fields: `actorType`, `actorId`, `tokenHash` (unique), `revokedAt`, `expiresAt`, timestamps
- Indexes: `@@index([actorType, actorId, expiresAt])`

### PhoneOtp

- Fields: `phone`, `purpose`, `channel`, `codeHash`, `expiresAt`, `consumedAt`, `attempts`, `ip`, `userAgent`, `targetActorType`, `targetActorId`, `createdAt`
- Indexes: `@@index([phone, purpose, expiresAt])`, `@@index([phone, createdAt])`, `@@index([consumedAt])`, `@@index([targetActorType, targetActorId])`

### CustomerAccount

- Fields: `phone` (unique), `fullName`, `phoneVerifiedAt`, timestamps
- Relations: `profiles`, `bookings`, `reviews`
- Indexes: `@@index([phone])`

### GamingCenterCustomerProfile

- Fields: `gamingCenterId`, `customerAccountId`, `displayName`, `note`, timestamps
- Relations: `gamingCenter`, `customerAccount` (onDelete: Cascade), `bookings`
- Unique: `@@unique([gamingCenterId, customerAccountId])`
- Indexes: `@@index([gamingCenterId, displayName])`, `@@index([customerAccountId])`

### Service

- Fields: `gamingCenterId`, `name`, `durationMinutes`, `price`, `currency`, `isActive`, timestamps
- Relations: `gamingCenter`, `bookings`, `reviews`, `userServices`
- Indexes: `@@index([gamingCenterId, isActive])`, `@@index([gamingCenterId, name])`

### UserService (Join)

- Composite PK: `@@id([userId, serviceId])`
- Relations: `user` (onDelete: Cascade), `service` (onDelete: Cascade)
- Indexes: `@@index([serviceId])`, `@@index([userId])`

### Shift

- Fields: `gamingCenterId`, `userId`, `dayOfWeek`, `startTime`, `endTime`, `isActive`, timestamps
- Relations: `gamingCenter`, `user`
- Unique: `@@unique([gamingCenterId, userId, dayOfWeek])`
- Indexes: `@@index([gamingCenterId, dayOfWeek])`

### Booking

- Fields: `gamingCenterId`, `customerProfileId`, `customerAccountId`, `serviceId`, `staffId`, `createdByUserId`, `startAt`, `endAt`, snapshots, `amountDueSnapshot`, `paymentState`, `status`, `source`, `note`, cancel fields, completion fields, timestamps
- Relations: `gamingCenter`, `customerProfile`, `customerAccount`, `service`, `staff`, `createdBy`, `canceledBy`, `payments`, `reviews`, `commission`
- Indexes: `@@index([gamingCenterId, startAt])`, `@@index([gamingCenterId, staffId, startAt])`, `@@index([gamingCenterId, status, startAt])`, `@@index([gamingCenterId, staffId, status, startAt, endAt])`, `@@index([customerAccountId, startAt])`, `@@index([customerProfileId, startAt])`, `@@index([gamingCenterId, paymentState, startAt])`

### Payment

- Fields: `gamingCenterId`, `bookingId`, `amount`, `currency`, `provider`, `providerPaymentId`, `providerCheckoutId`, `status`, `failureReason`, `rawProviderPayload`, `idempotencyKey`, `paidAt`, `method`, `referenceCode`, timestamps
- Relations: `gamingCenter` (onDelete: Cascade), `booking` (onDelete: Cascade)
- Unique: `@@unique([provider, providerPaymentId])`, `@@unique([gamingCenterId, idempotencyKey])`
- Indexes: `@@index([bookingId, paidAt])`, `@@index([status, paidAt])`

### Review

- Fields: `gamingCenterId`, `customerAccountId`, `bookingId`, `target`, `serviceId`, `rating`, `comment`, `status`, timestamps
- Relations: `gamingCenter`, `customerAccount`, `booking` (onDelete: Cascade), `service`
- Unique: `@@unique([bookingId, target, serviceId])`
- Indexes: `@@index([gamingCenterId, status, createdAt])`, `@@index([serviceId, status, createdAt])`, `@@index([bookingId])`, `@@index([customerAccountId, createdAt])`

### GamingCenterCommissionPolicy

- Fields: `gamingCenterId` (unique), `type`, `percentBps`, `fixedAmount`, `currency`, `applyToOnlineOnly`, `minimumFeeAmount`, `isActive`, timestamps
- Relation: `gamingCenter`
- Indexes: `@@index([gamingCenterId, isActive])`

### BookingCommission

- Fields: `bookingId` (unique), `gamingCenterId`, `status`, `baseAmount`, `currency`, `type`, `percentBps`, `fixedAmount`, `commissionAmount`, `calculatedAt`, `chargedAt`, `note`, timestamps
- Relations: `booking` (onDelete: Cascade), `gamingCenter`, `payments`
- Indexes: `@@index([gamingCenterId, status, createdAt])`, `@@index([chargedAt])`

### CommissionPayment

- Fields: `commissionId`, `amount`, `currency`, `status`, `method`, `paidAt`, `referenceCode`, timestamps
- Relation: `commission` (onDelete: Cascade)
- Indexes: `@@index([commissionId, paidAt])`, `@@index([status, paidAt])`

### GamingCenterSiteSettings

- Fields: `gamingCenterId` (unique), `logoUrl`, `faviconUrl`, default SEO/OG fields, `googleSiteVerification`, `analyticsTag`, `robotsIndex`, `robotsFollow`, timestamps
- Relation: `gamingCenter`

### GamingCenterPage

- Fields: `gamingCenterId`, `slug`, `title`, `type`, `status`, `publishedAt`, SEO fields, `canonicalPath`, `robotsIndex`, `robotsFollow`, `structuredDataJson`, timestamps
- Relations: `gamingCenter`, `sections`, `slugHistory`
- Unique: `@@unique([gamingCenterId, slug])`
- Indexes: `@@index([gamingCenterId, status])`, `@@index([gamingCenterId, type])`, `@@index([gamingCenterId, publishedAt])`

### GamingCenterPageSection

- Fields: `pageId`, `type`, `dataJson`, `sortOrder`, `isEnabled`, timestamps
- Relation: `page` (onDelete: Cascade)
- Indexes: `@@index([pageId, sortOrder])`, `@@index([pageId, isEnabled])`, `@@index([pageId, type])`

### GamingCenterMedia

- Fields: `gamingCenterId`, `type`, `purpose`, `url`, `thumbUrl`, `altText`, `category`, `caption`, `sortOrder`, `isActive`, timestamps
- Relation: `gamingCenter`
- Indexes: `@@index([gamingCenterId, purpose, isActive, sortOrder])`, `@@index([gamingCenterId, category])`

### GamingCenterLink

- Fields: `gamingCenterId`, `type`, `label`, `value`, `isPrimary`, `isActive`, timestamps
- Relation: `gamingCenter`
- Indexes: `@@index([gamingCenterId, type])`, `@@index([gamingCenterId, isPrimary])`, `@@index([gamingCenterId, isActive])`

### GamingCenterAddress

- Fields: `gamingCenterId`, `title`, `province`, `city`, `district`, `addressLine`, `postalCode`, `lat`, `lng`, `isPrimary`, timestamps
- Relation: `gamingCenter`
- Indexes: `@@index([gamingCenterId])`, `@@index([gamingCenterId, isPrimary])`, `@@index([province])`, `@@index([city])`

### GamingCenterSlugHistory

- Fields: `gamingCenterId`, `oldSlug`, `createdAt`
- Relation: `gamingCenter` (onDelete: Cascade)
- Unique: `@@unique([oldSlug])`
- Indexes: `@@index([gamingCenterId, createdAt])`

### GamingCenterPageSlugHistory

- Fields: `pageId`, `oldSlug`, `createdAt`
- Relation: `page` (onDelete: Cascade)
- Indexes: `@@index([pageId, createdAt])`, `@@index([oldSlug])`

## Domain Notes

### OTP

- OTPs are stored in `PhoneOtp` with `purpose`, `channel`, hashed `codeHash`, expiration, and `consumedAt` fields.
- OTP verification is used for user login and gamingCenter selection (see `auth.service.ts`).

### Sessions

- Sessions are polymorphic via `SessionActorType` (`USER` or `CUSTOMER`).
- `Session.tokenHash` stores a hashed refresh token for secure storage.

### Booking + Payment

- `Booking` includes snapshot fields that capture service details at booking time.
- `Payment` records are tied to a booking; `Booking.paymentState` tracks overall payment state.

### CMS / SEO

- `GamingCenterPage` + `GamingCenterPageSection` power page builder with `dataJson` blobs.
- Site-wide SEO defaults are stored in `GamingCenterSiteSettings`, while per-page SEO is stored on `GamingCenterPage`.

### Commission

- Commission configuration lives in `GamingCenterCommissionPolicy`.
- Commission per booking is stored in `BookingCommission` and payments in `CommissionPayment`.

## Known Gaps / TODO

- `Session` records are created for login flows, but there is no direct relation to `User`/`CustomerAccount` in the Prisma schema (by design). Documentation assumes actor lookup via `actorType`/`actorId`.

## Implementation Considerations

### Snapshots & Integrity
- **Snapshots** (`serviceNameSnapshot`, `servicePriceSnapshot`, `amountDueSnapshot`) must be populated from the `Service` record at the moment of booking creation. This ensures historical integrity if service prices or names change later.
- `paymentState` on the `Booking` must be re-calculated and updated after every successful `Payment` or `Refund` operation by summing all related payment amounts.

### Booking Overlap Prevention
- **Application Level**: Currently enforced in the application layer by checking the `[startAt, endAt)` time range for the same `staffId` before confirming a booking.
- **Database Level (Future)**: In high-concurrency production environments, using PostgreSQL *Exclusion Constraints* (via `gist` index on time ranges) is recommended to prevent race conditions at the database level.

### Analytics Summary Tables
- The system uses summary tables (`GamingCenterAnalytics`, `StaffAnalytics`, `ServiceAnalytics`) for high-performance dashboard queries.
- These tables are synchronized whenever bookings are created, updated, or completed, and whenever payments or reviews are recorded.

## Source of Truth

- `prisma/schema.prisma`
