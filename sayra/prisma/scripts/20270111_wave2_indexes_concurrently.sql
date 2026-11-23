-- Wave 2 (AMI-36): Zero-Downtime Production Index Deployment Script
-- Run OUTSIDE any transaction block (before `npx prisma migrate deploy`):
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/20270111_wave2_indexes_concurrently.sql
--   npx prisma migrate deploy
--
-- Disable statement_timeout in this maintenance session so large concurrent index builds never time out.
SET statement_timeout = 0;

-- 1. Operational & Public Discovery Composite / Functional Indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Reservation_gc_station_status_start_end_idx"
  ON "Reservation" ("gamingCenterId", "stationId", "status", "startTime", "endTime");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_gamingCenterId_createdAt_idx"
  ON "Payment" ("gamingCenterId", "createdAt");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Reservation_customerAccountId_status_idx"
  ON "Reservation" ("customerAccountId", "status");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GameStation_gamingCenterId_isActive_stationType_idx"
  ON "GameStation" ("gamingCenterId", "isActive", "stationType");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GamingCenter_isActive_verificationStatus_createdAt_idx"
  ON "GamingCenter" ("isActive", "verificationStatus", "createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Address_lower_trim_city_idx"
  ON "Address" ((LOWER(TRIM("city"))));

-- 2. Incremental AnalyticsIngestionService Cursor Indexes (updatedAt / createdAt, id)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Reservation_updatedAt_id_idx"
  ON "Reservation" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Payment_updatedAt_id_idx"
  ON "Payment" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GameStation_updatedAt_id_idx"
  ON "GameStation" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GamingCenter_updatedAt_id_idx"
  ON "GamingCenter" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "CustomerAccount_updatedAt_id_idx"
  ON "CustomerAccount" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "GamingSession_updatedAt_id_idx"
  ON "GamingSession" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "Refund_updatedAt_id_idx"
  ON "Refund" ("updatedAt", "id");

CREATE INDEX CONCURRENTLY IF NOT EXISTS "LedgerEntry_createdAt_id_idx"
  ON "LedgerEntry" ("createdAt", "id");

-- 3. Drop 8 Provably Duplicate B-Tree Indexes (redundant with @unique or wider left-prefix composites)
DROP INDEX CONCURRENTLY IF EXISTS "GamingCenter_slug_idx";
DROP INDEX CONCURRENTLY IF EXISTS "NotificationLog_idempotencyKey_idx";
DROP INDEX CONCURRENTLY IF EXISTS "DiscountCampaign_code_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Category_gamingCenterId_slug_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Tag_gamingCenterId_slug_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Series_gamingCenterId_slug_idx";
DROP INDEX CONCURRENTLY IF EXISTS "Address_gamingCenterId_idx";
DROP INDEX CONCURRENTLY IF EXISTS "GamingCenterClosure_gamingCenterId_idx";
