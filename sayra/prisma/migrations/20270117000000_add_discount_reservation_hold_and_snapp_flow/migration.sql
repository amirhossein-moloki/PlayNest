-- Migration: 20270117000000_add_discount_reservation_hold_and_snapp_flow
-- Adds voucher reservation hold, redemption lifecycle statuses, financial audit history,
-- and Snapp-like multi-discount discovery support.

-- 1. Create Enum DiscountUsageStatus
DO $$
BEGIN
    CREATE TYPE "DiscountUsageStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'REDEEMED', 'RELEASED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Alter DiscountUsage table
ALTER TABLE "DiscountUsage" ALTER COLUMN "reservationId" DROP NOT NULL;
ALTER TABLE "DiscountUsage" ALTER COLUMN "campaignId" DROP NOT NULL;

ALTER TABLE "DiscountUsage"
    ADD COLUMN IF NOT EXISTS "discountId" TEXT,
    ADD COLUMN IF NOT EXISTS "bookingHoldId" TEXT,
    ADD COLUMN IF NOT EXISTS "originalPrice" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "finalPrice" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "status" "DiscountUsageStatus" NOT NULL DEFAULT 'RESERVED',
    ADD COLUMN IF NOT EXISTS "reservedAt" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN IF NOT EXISTS "redeemedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "releasedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "releaseReason" TEXT,
    ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
    ADD COLUMN IF NOT EXISTS "voucherCode" TEXT,
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill pre-existing usages as REDEEMED
UPDATE "DiscountUsage"
SET "status" = 'REDEEMED',
    "redeemedAt" = "createdAt"
WHERE "status" = 'RESERVED' AND "reservationId" IS NOT NULL;

-- 3. Foreign Keys for DiscountUsage
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DiscountUsage_discountId_fkey'
    ) THEN
        ALTER TABLE "DiscountUsage"
            ADD CONSTRAINT "DiscountUsage_discountId_fkey"
            FOREIGN KEY ("discountId") REFERENCES "Discount"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DiscountUsage_bookingHoldId_fkey'
    ) THEN
        ALTER TABLE "DiscountUsage"
            ADD CONSTRAINT "DiscountUsage_bookingHoldId_fkey"
            FOREIGN KEY ("bookingHoldId") REFERENCES "BookingHold"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- 4. Alter BookingHold table
ALTER TABLE "BookingHold"
    ADD COLUMN IF NOT EXISTS "voucherCode" TEXT,
    ADD COLUMN IF NOT EXISTS "campaignId" TEXT,
    ADD COLUMN IF NOT EXISTS "discountId" TEXT,
    ADD COLUMN IF NOT EXISTS "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "discountFundingSource" "DiscountFundingSource";

-- 5. Indexes
CREATE INDEX IF NOT EXISTS "DiscountUsage_campaignId_customerAccountId_status_idx"
    ON "DiscountUsage"("campaignId", "customerAccountId", "status");
CREATE INDEX IF NOT EXISTS "DiscountUsage_customerAccountId_status_idx"
    ON "DiscountUsage"("customerAccountId", "status");
CREATE INDEX IF NOT EXISTS "DiscountUsage_bookingHoldId_idx"
    ON "DiscountUsage"("bookingHoldId");
CREATE INDEX IF NOT EXISTS "DiscountUsage_status_expiresAt_idx"
    ON "DiscountUsage"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "DiscountUsage_idempotencyKey_idx"
    ON "DiscountUsage"("idempotencyKey");
