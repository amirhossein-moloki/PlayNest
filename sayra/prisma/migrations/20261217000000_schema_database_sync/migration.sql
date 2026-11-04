-- Non-destructive Schema and Database Synchronization Migration

-- 1. Enum updates (safe, idempotent)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'ReservationStatus' AND pg_enum.enumlabel = 'EXPIRED'
    ) THEN
        ALTER TYPE "ReservationStatus" ADD VALUE 'EXPIRED';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'NotificationDispatchStatus' AND pg_enum.enumlabel = 'CANCELLED'
    ) THEN
        ALTER TYPE "NotificationDispatchStatus" ADD VALUE 'CANCELLED';
    END IF;
END $$;

-- 2. Create Catalog Tables
CREATE TABLE IF NOT EXISTS "DeviceCatalog" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deviceType" "GameStationType" NOT NULL DEFAULT 'PC',
    "coverImageUrl" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceCatalog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "DeviceCatalog_deviceType_isActive_idx" ON "DeviceCatalog"("deviceType", "isActive");
CREATE INDEX IF NOT EXISTS "DeviceCatalog_isActive_idx" ON "DeviceCatalog"("isActive");

CREATE TABLE IF NOT EXISTS "GameCatalog" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "coverImageUrl" TEXT NOT NULL,
    "supportedPlatforms" "GameStationType"[] DEFAULT ARRAY['PC']::"GameStationType"[],
    "genre" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameCatalog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GameCatalog_isActive_idx" ON "GameCatalog"("isActive");

-- 3. GameStation catalog integration & coverImageUrl
ALTER TABLE "GameStation" ADD COLUMN IF NOT EXISTS "catalogDeviceId" TEXT;
ALTER TABLE "GameStation" ADD COLUMN IF NOT EXISTS "coverImageUrl" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GameStation_catalogDeviceId_fkey'
    ) THEN
        ALTER TABLE "GameStation" ADD CONSTRAINT "GameStation_catalogDeviceId_fkey"
            FOREIGN KEY ("catalogDeviceId") REFERENCES "DeviceCatalog"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Reservation UTM tracking fields
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmCampaign" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmMedium" TEXT;
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "utmSource" TEXT;

-- 5. GroupBookingItem fields
ALTER TABLE "GroupBookingItem" ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "GroupBookingItem" ADD COLUMN IF NOT EXISTS "price" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "GroupBookingItem" ADD COLUMN IF NOT EXISTS "staffId" TEXT;
ALTER TABLE "GroupBookingItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 6. Notification table schema harmonization with data preservation
DO $$
BEGIN
    -- If 'read' column exists and 'isRead' does not, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'read'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'isRead'
    ) THEN
        ALTER TABLE "Notification" RENAME COLUMN "read" TO "isRead";
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'isRead'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "isRead" BOOLEAN NOT NULL DEFAULT false;
    END IF;

    -- If 'data' column exists and 'metadata' does not, rename it
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'data'
    ) AND NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE "Notification" RENAME COLUMN "data" TO "metadata";
    ELSIF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Notification' AND column_name = 'metadata'
    ) THEN
        ALTER TABLE "Notification" ADD COLUMN "metadata" JSONB;
    END IF;
END $$;

DROP INDEX IF EXISTS "Notification_userId_read_idx";
CREATE INDEX IF NOT EXISTS "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt");

-- 7. Payment reservationId nullable relaxation (for multi-item / group booking support)
ALTER TABLE "Payment" ALTER COLUMN "reservationId" DROP NOT NULL;
CREATE INDEX IF NOT EXISTS "Payment_groupBookingId_paidAt_idx" ON "Payment"("groupBookingId", "paidAt");

-- 8. StationMaintenance additional operational fields
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceSeverity') THEN
        CREATE TYPE "MaintenanceSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MaintenanceStatus') THEN
        CREATE TYPE "MaintenanceStatus" AS ENUM ('REPORTED', 'IN_MAINTENANCE', 'REPAIRED', 'CANCELLED');
    END IF;
END $$;

ALTER TABLE "StationMaintenance" ADD COLUMN IF NOT EXISTS "breakdownType" TEXT;
ALTER TABLE "StationMaintenance" ADD COLUMN IF NOT EXISTS "gamingCenterId" TEXT;
ALTER TABLE "StationMaintenance" ADD COLUMN IF NOT EXISTS "repairedAt" TIMESTAMPTZ(6);
ALTER TABLE "StationMaintenance" ADD COLUMN IF NOT EXISTS "reportedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "StationMaintenance" ADD COLUMN IF NOT EXISTS "severity" "MaintenanceSeverity" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "StationMaintenance" ADD COLUMN IF NOT EXISTS "status" "MaintenanceStatus" NOT NULL DEFAULT 'REPORTED';

CREATE INDEX IF NOT EXISTS "StationMaintenance_stationId_startTime_idx" ON "StationMaintenance"("stationId", "startTime");
CREATE INDEX IF NOT EXISTS "StationMaintenance_gamingCenterId_status_idx" ON "StationMaintenance"("gamingCenterId", "status");

-- 9. AnalyticsEvent deduplicationKey uniqueness & performance indexes
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AnalyticsEvent_deduplicationKey_key'
    ) THEN
        CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsEvent_deduplicationKey_key" ON "AnalyticsEvent"("deduplicationKey") WHERE "deduplicationKey" IS NOT NULL;
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_sessionId_idx" ON "AnalyticsEvent"("sessionId");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_timestamp_idx" ON "AnalyticsEvent"("timestamp");

-- 10. GamingCenterExpense indexes alignment
CREATE INDEX IF NOT EXISTS "GamingCenterExpense_gamingCenterId_status_expenseDate_idx" ON "GamingCenterExpense"("gamingCenterId", "status", "expenseDate");
CREATE INDEX IF NOT EXISTS "GamingCenterExpense_gamingCenterId_category_idx" ON "GamingCenterExpense"("gamingCenterId", "category");

-- 11. WalletTransaction unique constraint alignment
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_reservationId_type_key" ON "WalletTransaction"("reservationId", "type") WHERE "reservationId" IS NOT NULL;

-- 12. User role default harmonization
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'MANAGER';
