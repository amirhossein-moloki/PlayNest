-- AlterTable
ALTER TABLE "DiscountCampaign"
ADD COLUMN "applicableStationIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "minCompletedReservations" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "applicableDaysOfWeek" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "dailyStartTime" TEXT,
ADD COLUMN "dailyEndTime" TEXT;
