# Play-Nest Analytics — Final Data Model and Migrations

## Overview
This document documents all Analytics-related database structures, Prisma models, watermarks, staging/shadow tables, and migration history in the Play-Nest platform (`sayra`).

The primary schema definition is located at `sayra/prisma/schema.prisma`.
Database migrations are stored in `sayra/prisma/migrations/`.

---

## 1. Analytics Migration History

### Migration: `20261210000000_add_analytics_infrastructure`
- **Path:** `sayra/prisma/migrations/20261210000000_add_analytics_infrastructure/migration.sql`
- **Purpose:** Created the dedicated shadow analytics tables, watermark tracking table, and ingestion run history table to decouple heavy analytics read aggregations from transactional core tables.
- **Verification Status:** Applied and active in schema. Prisma Client generated successfully.

---

## 2. Infrastructure & Ingestion Watermark Structures

### `AnalyticsWatermark`
- **Purpose:** Tracks the high-watermark timestamp for incremental data extraction per entity.
- **Fields:**
  - `entity` (`String`, `@id`): Entity name (e.g. `Tenant`, `Customer`, `Station`, `Reservation`, `GamingSession`, `Payment`, `LedgerEntry`, `Refund`).
  - `lastIngestedAt` (`DateTime`, `@db.Timestamptz(6)`): High watermark cutoff.
  - `lastSourceId` (`String?`): Optional cursor tracking.
  - `updatedAt` (`DateTime`, `@db.Timestamptz(6)`).

### `AnalyticsIngestionRun`
- **Purpose:** Audit log of all ingestion pipeline runs, record counts, durations, and errors.
- **Fields:**
  - `id` (`String`, `@id`, `@default(cuid())`).
  - `entity` (`String`).
  - `status` (`String`): `IN_PROGRESS`, `SUCCESS`, `FAILED`.
  - `startedAt` (`DateTime`), `completedAt` (`DateTime?`).
  - `recordsRead` (`Int`), `recordsIngested` (`Int`), `durationMs` (`Int?`).
  - `watermarkBefore` (`DateTime?`), `watermarkAfter` (`DateTime?`).
  - `errorMessage` (`String?`, `@db.Text`).
- **Indexes:** `[entity, startedAt]`, `[status, startedAt]`.

---

## 3. Shadow Analytics Domain Entities

Shadow analytics tables store synchronized copies of transactional records optimized for fast query performance and isolation.

### `AnalyticsTenant`
- **Primary Key:** `id` (`String`).
- **Fields:** `name`, `slug`, `isActive`, `pcCount`, `consoleCount`, `hourlyRate`, `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[slug]`, `[isActive]`.

### `AnalyticsCustomer`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String?`), `phone` (`String`), `fullName` (`String?`), `walletBalance` (`Int`), `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[phone]`, `[gamingCenterId]`.

### `AnalyticsStation`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String`), `name` (`String`), `stationType` (`GameStationType`), `isVip` (`Boolean`), `hourlyPrice` (`Float`), `isActive` (`Boolean`), `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[gamingCenterId, isActive]`.

### `AnalyticsReservation`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String`), `customerAccountId` (`String`), `stationId` (`String`), `startTime` (`DateTime`), `endTime` (`DateTime`), `totalHours` (`Float`), `totalPrice` (`Float`), `discountAmount` (`Float`), `paymentState` (`ReservationPaymentState`), `status` (`ReservationStatus`), `source` (`ReservationSource`), `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[gamingCenterId, startTime]`, `[gamingCenterId, status, startTime]`, `[customerAccountId, startTime]`.

### `AnalyticsGamingSession`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String?`), `reservationId` (`String`), `stationId` (`String`), `startTime` (`DateTime`), `endTime` (`DateTime?`), `actualHours` (`Float`), `status` (`GamingSessionStatus`), `pausedMinutes` (`Int`), `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[reservationId]`, `[stationId, startTime]`, `[gamingCenterId]`.

### `AnalyticsPayment`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String`), `reservationId` (`String?`), `amount` (`Int`), `currency` (`String`), `provider` (`PaymentProvider`), `status` (`PaymentStatus`), `method` (`PaymentMethod`), `paidAt` (`DateTime?`), `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[gamingCenterId, status, paidAt]`, `[reservationId]`.

### `AnalyticsLedgerEntry`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String`), `paymentId` (`String?`), `refundId` (`String?`), `entryType` (`LedgerEntryType`), `amount` (`Int`), `currency` (`String`), `sourceCreatedAt`, `ingestedAt`.
- **Indexes:** `[gamingCenterId, sourceCreatedAt]`, `[paymentId]`, `[entryType]`.

### `AnalyticsRefund`
- **Primary Key:** `id` (`String`).
- **Fields:** `gamingCenterId` (`String`), `paymentId` (`String`), `amount` (`Int`), `currency` (`String`), `status` (`RefundStatus`), `processedAt` (`DateTime?`), `sourceCreatedAt`, `sourceUpdatedAt`, `ingestedAt`.
- **Indexes:** `[gamingCenterId, status, sourceCreatedAt]`, `[paymentId]`.

---

## 4. Pre-calculated Aggregate Analytics Models

In addition to shadow tables, pre-aggregated models exist for fast dashboard widget loads:

### `GamingCenterAnalytics`
- **Composite Primary Key:** `[gamingCenterId, date]`
- **Fields:** `totalReservations`, `completedReservations`, `canceledReservations`, `revenue`, `realizedCash`, `peakHours` (`Json`), `occupancyRate` (`Float`).

### `StaffAnalytics`
- **Composite Primary Key:** `[gamingCenterId, staffId, date]`
- **Fields:** `completedReservations`, `revenue`, `totalRating`, `ratingCount`, `reservationsHandled`, `cancellationRate`.

### `StationAnalytics`
- **Composite Primary Key:** `[gamingCenterId, stationId, date]`
- **Fields:** `completedReservations`, `revenue`, `totalHoursBooked`, `utilizationRate`.
