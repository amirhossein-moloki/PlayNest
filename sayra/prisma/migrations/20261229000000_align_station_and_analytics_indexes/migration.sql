-- Migration: Align Station Catalog Index and Harmonize Analytics Indexes
-- Safe, non-destructive, idempotent migration for PlayNest Sayra production

-- 1. GameStation: Add index on (gamingCenterId, catalogDeviceId) to optimize catalog-based queries
CREATE INDEX IF NOT EXISTS "GameStation_gamingCenterId_catalogDeviceId_idx"
    ON "GameStation"("gamingCenterId", "catalogDeviceId");

-- 2. AnalyticsEvent: Standardize unique index on deduplicationKey and composite query index
-- Ensures compatibility with Prisma's unique constraint model without data loss
DO $$
BEGIN
    -- Only recreate standard unique index if partial unique index exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'AnalyticsEvent'
          AND indexname = 'AnalyticsEvent_deduplicationKey_key'
          AND indexdef LIKE '%WHERE%'
    ) THEN
        DROP INDEX "AnalyticsEvent_deduplicationKey_key";
        CREATE UNIQUE INDEX IF NOT EXISTS "AnalyticsEvent_deduplicationKey_key"
            ON "AnalyticsEvent"("deduplicationKey");
    END IF;

    -- Drop redundant non-unique btree index on deduplicationKey if it exists
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'AnalyticsEvent'
          AND indexname = 'AnalyticsEvent_deduplicationKey_idx'
    ) THEN
        DROP INDEX "AnalyticsEvent_deduplicationKey_idx";
    END IF;
END $$;

-- Add composite query index on AnalyticsEvent (gamingCenterId, eventType, timestamp)
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_gamingCenterId_eventType_timestamp_idx"
    ON "AnalyticsEvent"("gamingCenterId", "eventType", "timestamp");

-- 3. WalletTransaction: Standardize composite unique index on (reservationId, type)
DO $$
BEGIN
    -- Only replace if current index is a partial index
    IF EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE tablename = 'WalletTransaction'
          AND indexname = 'WalletTransaction_reservationId_type_key'
          AND indexdef LIKE '%WHERE%'
    ) THEN
        DROP INDEX "WalletTransaction_reservationId_type_key";
        CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_reservationId_type_key"
            ON "WalletTransaction"("reservationId", "type");
    END IF;
END $$;
