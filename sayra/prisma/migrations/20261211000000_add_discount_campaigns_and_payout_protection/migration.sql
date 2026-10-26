-- CreateEnum
CREATE TYPE "DiscountFundingSource" AS ENUM ('PLATFORM', 'CAMPAIGN_BUDGET', 'MERCHANT_FUNDED');

-- CreateEnum
CREATE TYPE "DiscountCodeType" AS ENUM ('PROMO_CODE', 'AUTOMATIC');

-- AlterTable
ALTER TABLE "Reservation"
ADD COLUMN "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "customerPayableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "platformFundedDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "merchantPayoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "discountFundingSource" "DiscountFundingSource",
ADD COLUMN "campaignId" TEXT;

-- AlterTable
ALTER TABLE "AnalyticsReservation"
ADD COLUMN "originalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "customerPayableAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "platformFundedDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "merchantPayoutAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "discountFundingSource" "DiscountFundingSource",
ADD COLUMN "campaignId" TEXT;

-- CreateTable
CREATE TABLE "DiscountCampaign" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "codeType" "DiscountCodeType" NOT NULL DEFAULT 'PROMO_CODE',
    "description" TEXT,
    "targetType" "DiscountTargetType" NOT NULL DEFAULT 'GAMING_CENTER',
    "targetId" TEXT,
    "valueType" "DiscountValueType" NOT NULL DEFAULT 'PERCENTAGE',
    "value" DOUBLE PRECISION NOT NULL,
    "maxDiscountAmount" DOUBLE PRECISION,
    "minReservationAmount" DOUBLE PRECISION,
    "fundingSource" "DiscountFundingSource" NOT NULL DEFAULT 'PLATFORM',
    "totalBudget" DOUBLE PRECISION,
    "usedBudget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxUsageCount" INTEGER,
    "currentUsageCount" INTEGER NOT NULL DEFAULT 0,
    "maxUsagePerUser" INTEGER NOT NULL DEFAULT 1,
    "startAt" TIMESTAMPTZ(6) NOT NULL,
    "endAt" TIMESTAMPTZ(6) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountUsage" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "reservationId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL,
    "fundingSource" "DiscountFundingSource" NOT NULL DEFAULT 'PLATFORM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountUsage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCampaign_code_key" ON "DiscountCampaign"("code");

-- CreateIndex
CREATE INDEX "DiscountCampaign_gamingCenterId_isActive_startAt_endAt_idx" ON "DiscountCampaign"("gamingCenterId", "isActive", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "DiscountCampaign_code_idx" ON "DiscountCampaign"("code");

-- CreateIndex
CREATE INDEX "DiscountUsage_campaignId_customerAccountId_idx" ON "DiscountUsage"("campaignId", "customerAccountId");

-- CreateIndex
CREATE INDEX "DiscountUsage_reservationId_idx" ON "DiscountUsage"("reservationId");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscountCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCampaign" ADD CONSTRAINT "DiscountCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DiscountCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountUsage" ADD CONSTRAINT "DiscountUsage_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
