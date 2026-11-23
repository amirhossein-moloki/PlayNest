-- Wave 2 (AMI-36): Zero-Downtime Rollback Script
-- Run OUTSIDE any transaction block to revert Wave 2 index changes:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/20270111_wave2_indexes_rollback.sql
--
SET statement_timeout = 0;

-- 1. Drop the 12 newly added Wave 2 indexes
DROP INDEX CONCURRENTLY IF EXISTS "Reservation_gc_station_status_start_end_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Payment_gamingCenterId_createdAt_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Reservation_customerAccountId_status_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GameStation_gamingCenterId_isActive_stationType_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Reservation_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Payment_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GameStation_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GamingCenter_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "CustomerAccount_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GamingSession_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Refund_updatedAt_id_idx";
DROP INDEX CONCURRENTLY IF EXISTS "LedgerEntry_createdAt_id_idx";

-- 2. Restore the 8 dropped indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GamingCenter_slug_idx"
  ON "GamingCenter" ("slug");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "NotificationLog_idempotencyKey_idx"
  ON "NotificationLog" ("idempotencyKey");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "DiscountCampaign_code_idx"
  ON "DiscountCampaign" ("code");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Category_gamingCenterId_slug_idx"
  ON "Category" ("gamingCenterId", "slug");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Tag_gamingCenterId_slug_idx"
  ON "Tag" ("gamingCenterId", "slug");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Series_gamingCenterId_slug_idx"
  ON "Series" ("gamingCenterId", "slug");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Address_gamingCenterId_idx"
  ON "Address" ("gamingCenterId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GamingCenterClosure_gamingCenterId_idx"
  ON "GamingCenterClosure" ("gamingCenterId");
