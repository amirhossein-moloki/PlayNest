-- AlterEnum
ALTER TYPE "AdvertisementRequestStatus" ADD VALUE IF NOT EXISTS 'ACTIVE';
ALTER TYPE "AdvertisementRequestStatus" ADD VALUE IF NOT EXISTS 'DELETED';

-- AlterTable
ALTER TABLE "AdvertisementRequest"
ADD COLUMN IF NOT EXISTS "proposedDurationDays" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_priority_idx" ON "AdvertisementRequest"("priority");
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_deletedAt_idx" ON "AdvertisementRequest"("deletedAt");
