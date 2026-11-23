-- Migration: Wave 2 Performance Indexes & Duplicate Index Cleanup (AMI-36)
--
-- ZERO-DOWNTIME PRODUCTION WORKFLOW:
-- Prisma `migrate deploy` wraps migration files in a transaction block, which forbids `CONCURRENTLY`.
-- In live production, run the non-blocking concurrent script BEFORE `npx prisma migrate deploy`:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f prisma/scripts/20270111_wave2_indexes_concurrently.sql
--   npx prisma migrate deploy
-- Because every statement below uses IF NOT EXISTS / IF EXISTS, `migrate deploy` then completes
-- as an instant, lock-free metadata synchronization no-op while fresh environments still apply cleanly.

-- 1. Operational & Public Discovery Composite / Functional Indexes
CREATE INDEX IF NOT EXISTS "Reservation_gc_station_status_start_end_idx"
  ON "Reservation" ("gamingCenterId", "stationId", "status", "startTime", "endTime");

CREATE INDEX IF NOT EXISTS "Payment_gamingCenterId_createdAt_idx"
  ON "Payment" ("gamingCenterId", "createdAt");

CREATE INDEX IF NOT EXISTS "Reservation_customerAccountId_status_idx"
  ON "Reservation" ("customerAccountId", "status");

CREATE INDEX IF NOT EXISTS "GameStation_gamingCenterId_isActive_stationType_idx"
  ON "GameStation" ("gamingCenterId", "isActive", "stationType");

CREATE INDEX IF NOT EXISTS "GamingCenter_isActive_verificationStatus_createdAt_idx"
  ON "GamingCenter" ("isActive", "verificationStatus", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Address_lower_trim_city_idx"
  ON "Address" ((LOWER(TRIM("city"))));

-- 2. Incremental AnalyticsIngestionService Cursor Indexes (updatedAt / createdAt, id)
CREATE INDEX IF NOT EXISTS "Reservation_updatedAt_id_idx"
  ON "Reservation" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "Payment_updatedAt_id_idx"
  ON "Payment" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "GameStation_updatedAt_id_idx"
  ON "GameStation" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "GamingCenter_updatedAt_id_idx"
  ON "GamingCenter" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "CustomerAccount_updatedAt_id_idx"
  ON "CustomerAccount" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "GamingSession_updatedAt_id_idx"
  ON "GamingSession" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "Refund_updatedAt_id_idx"
  ON "Refund" ("updatedAt", "id");

CREATE INDEX IF NOT EXISTS "LedgerEntry_createdAt_id_idx"
  ON "LedgerEntry" ("createdAt", "id");

-- 3. Drop 8 Provably Duplicate B-Tree Indexes (redundant with @unique or wider left-prefix composites)
DROP INDEX IF EXISTS "GamingCenter_slug_idx";
DROP INDEX IF EXISTS "NotificationLog_idempotencyKey_idx";
DROP INDEX IF EXISTS "DiscountCampaign_code_idx";
DROP INDEX IF EXISTS "Category_gamingCenterId_slug_idx";
DROP INDEX IF EXISTS "Tag_gamingCenterId_slug_idx";
DROP INDEX IF EXISTS "Series_gamingCenterId_slug_idx";
DROP INDEX IF EXISTS "Address_gamingCenterId_idx";
DROP INDEX IF EXISTS "GamingCenterClosure_gamingCenterId_idx";
