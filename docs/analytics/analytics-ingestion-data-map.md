# Play-Nest Analytics Phase 1 Data Ingestion Map

## Entity Mappings

### 1. GamingCenter (Tenants / Branches)
- **Source**: `GamingCenter`
- **Destination**: `AnalyticsTenant`
- **Primary Key**: `id`
- **Tenant ID**: `id` (Self)
- **Extraction Strategy**: Incremental on `updatedAt` with lookback.
- **Fields Mapped**:
  - `id` -> `id`
  - `name` -> `name`
  - `slug` -> `slug`
  - `isActive` -> `isActive`
  - `pcCount` -> `pcCount`
  - `consoleCount` -> `consoleCount`
  - `hourlyRate` -> `hourlyRate`
  - `createdAt` -> `createdAt`
  - `updatedAt` -> `updatedAt`

### 2. CustomerAccount & Profile (Customers)
- **Source**: `CustomerAccount` joined with `CustomerProfile`
- **Destination**: `AnalyticsCustomer`
- **Primary Key**: `id` (Matches `CustomerAccount.id`)
- **Tenant ID**: `gamingCenterId` (from profile linkage or primary profile)
- **Extraction Strategy**: Incremental on `updatedAt`.
- **Fields Mapped**:
  - `id` -> `id`
  - `phone` -> `phone`
  - `fullName` -> `fullName`
  - `walletBalance` -> `walletBalance`
  - `createdAt` -> `createdAt`
  - `updatedAt` -> `updatedAt`

### 3. GameStation (Stations / Equipment)
- **Source**: `GameStation`
- **Destination**: `AnalyticsStation`
- **Primary Key**: `id`
- **Tenant ID**: `gamingCenterId`
- **Extraction Strategy**: Incremental on `updatedAt`.
- **Fields Mapped**:
  - `id` -> `id`
  - `gamingCenterId` -> `gamingCenterId`
  - `name` -> `name`
  - `stationType` -> `stationType`
  - `isVip` -> `isVip`
  - `hourlyPrice` -> `hourlyPrice`
  - `isActive` -> `isActive`
  - `createdAt` -> `createdAt`
  - `updatedAt` -> `updatedAt`

### 4. Reservation (Reservations & Bookings)
- **Source**: `Reservation`
- **Destination**: `AnalyticsReservation`
- **Primary Key**: `id`
- **Tenant ID**: `gamingCenterId`
- **Extraction Strategy**: Incremental on `updatedAt` with 2-hour lookback.
- **Fields Mapped**:
  - `id` -> `id`
  - `gamingCenterId` -> `gamingCenterId`
  - `customerAccountId` -> `customerAccountId`
  - `stationId` -> `stationId`
  - `startTime` -> `startTime`
  - `endTime` -> `endTime`
  - `totalHours` -> `totalHours`
  - `totalPrice` -> `totalPrice`
  - `discountAmount` -> `discountAmount`
  - `paymentState` -> `paymentState`
  - `status` -> `status`
  - `source` -> `source`
  - `createdAt` -> `createdAt`
  - `updatedAt` -> `updatedAt`

### 5. GamingSession (Live Station Sessions)
- **Source**: `GamingSession`
- **Destination**: `AnalyticsGamingSession`
- **Primary Key**: `id`
- **Tenant ID**: Linked via `Reservation.gamingCenterId`
- **Extraction Strategy**: Incremental on `updatedAt` with lookback.
- **Fields Mapped**:
  - `id` -> `id`
  - `reservationId` -> `reservationId`
  - `stationId` -> `stationId`
  - `startTime` -> `startTime`
  - `endTime` -> `endTime`
  - `actualHours` -> `actualHours`
  - `status` -> `status`
  - `pausedMinutes` -> `pausedMinutes`
  - `createdAt` -> `createdAt`
  - `updatedAt` -> `updatedAt`

### 6. Payment (Financial Payments)
- **Source**: `Payment`
- **Destination**: `AnalyticsPayment`
- **Primary Key**: `id`
- **Tenant ID**: `gamingCenterId`
- **Extraction Strategy**: Incremental on `updatedAt` with lookback.
- **Fields Mapped**:
  - `id` -> `id`
  - `gamingCenterId` -> `gamingCenterId`
  - `reservationId` -> `reservationId`
  - `amount` -> `amount`
  - `currency` -> `currency`
  - `provider` -> `provider`
  - `status` -> `status`
  - `method` -> `method`
  - `paidAt` -> `paidAt`
  - `createdAt` -> `createdAt`
  - `updatedAt` -> `updatedAt`

### 7. LedgerEntry & Refund (Financial History & Disburse)
- **Source**: `LedgerEntry` & `Refund`
- **Destination**: `AnalyticsLedgerEntry` & `AnalyticsRefund`
- **Primary Key**: `id`
- **Tenant ID**: `gamingCenterId`
- **Extraction Strategy**: Incremental on `createdAt` / `updatedAt`.
