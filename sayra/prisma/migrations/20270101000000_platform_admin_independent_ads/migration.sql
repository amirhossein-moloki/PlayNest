-- CreateEnum
CREATE TYPE "AdvertisementType" AS ENUM ('GAMING_CENTER', 'GLOBAL_PROMOTION', 'CATEGORY', 'CUSTOM_LINK');

-- AlterTable
ALTER TABLE "AdvertisementRequest"
  ADD COLUMN "adType" "AdvertisementType" NOT NULL DEFAULT 'GAMING_CENTER',
  ADD COLUMN "category" TEXT,
  ALTER COLUMN "gamingCenterId" DROP NOT NULL,
  ALTER COLUMN "ownerId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "AdvertisementRequest_adType_idx" ON "AdvertisementRequest"("adType");
