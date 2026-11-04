-- CreateEnums
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignScopeType') THEN
        CREATE TYPE "CampaignScopeType" AS ENUM ('GLOBAL', 'SPECIFIC_GAMECENTERS', 'SPECIFIC_DEVICE_TYPES');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignTargetAudience') THEN
        CREATE TYPE "CampaignTargetAudience" AS ENUM ('ALL_USERS', 'NEW_USERS', 'LOYAL_USERS', 'SPECIFIC_USERS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CampaignStatus') THEN
        CREATE TYPE "CampaignStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SCHEDULED', 'EXPIRED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ReviewApprovalPolicy') THEN
        CREATE TYPE "ReviewApprovalPolicy" AS ENUM ('AUTO', 'MANUAL');
    END IF;
END $$;

-- AlterTable DiscountCampaign
ALTER TABLE "DiscountCampaign"
ADD COLUMN IF NOT EXISTS "title" TEXT,
ADD COLUMN IF NOT EXISTS "discountType" "DiscountValueType",
ADD COLUMN IF NOT EXISTS "discountValue" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "minOrderAmount" DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS "scopeType" "CampaignScopeType" DEFAULT 'GLOBAL',
ADD COLUMN IF NOT EXISTS "applicableGamecenterIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "applicableDeviceTypes" "GameStationType"[] DEFAULT ARRAY[]::"GameStationType"[],
ADD COLUMN IF NOT EXISTS "targetAudience" "CampaignTargetAudience" DEFAULT 'ALL_USERS',
ADD COLUMN IF NOT EXISTS "specificUserIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN IF NOT EXISTS "totalUsageLimit" INTEGER,
ADD COLUMN IF NOT EXISTS "perUserUsageLimit" INTEGER,
ADD COLUMN IF NOT EXISTS "status" "CampaignStatus" DEFAULT 'ACTIVE',
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ(6);

-- CreateIndexes
CREATE INDEX IF NOT EXISTS "DiscountCampaign_status_idx" ON "DiscountCampaign"("status");
CREATE INDEX IF NOT EXISTS "DiscountCampaign_deletedAt_idx" ON "DiscountCampaign"("deletedAt");

-- CreateTable PlatformSetting
CREATE TABLE IF NOT EXISTS "PlatformSetting" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "siteTitle" TEXT NOT NULL DEFAULT 'PlayNest',
    "supportPhone" TEXT NOT NULL DEFAULT '02188888888',
    "supportEmail" TEXT NOT NULL DEFAULT 'support@playnest.com',
    "centralAddress" TEXT NOT NULL DEFAULT 'Tehran, Iran',
    "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
    "maintenanceMessage" TEXT NOT NULL DEFAULT 'Site is undergoing maintenance. Please check back later.',
    "platformCommissionPercent" DOUBLE PRECISION NOT NULL DEFAULT 5.0,
    "maxAdvanceBookingDays" INTEGER NOT NULL DEFAULT 14,
    "onlinePaymentTimeoutMinutes" INTEGER NOT NULL DEFAULT 15,
    "cancellationPenaltyPercent" DOUBLE PRECISION NOT NULL DEFAULT 10.0,
    "freeCancellationHours" INTEGER NOT NULL DEFAULT 2,
    "autoSendBookingSms" BOOLEAN NOT NULL DEFAULT true,
    "autoSendReminderSms" BOOLEAN NOT NULL DEFAULT true,
    "welcomeSmsTemplate" TEXT NOT NULL DEFAULT 'Welcome to PlayNest, {name}!',
    "bookingConfirmationSmsTemplate" TEXT NOT NULL DEFAULT 'Your booking #{id} at {center} is confirmed.',
    "bookingReminderSmsTemplate" TEXT NOT NULL DEFAULT 'Reminder: Your booking #{id} starts in {hours} hours.',
    "reviewApprovalPolicy" "ReviewApprovalPolicy" NOT NULL DEFAULT 'AUTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSetting_pkey" PRIMARY KEY ("id")
);
