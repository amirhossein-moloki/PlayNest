-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AdvertisementRequestStatus') THEN
        CREATE TYPE "AdvertisementRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "AdvertisementRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bannerUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'IMAGE',
    "destinationUrl" TEXT,
    "durationDays" INTEGER NOT NULL DEFAULT 30,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "gamingCenterId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "mediaId" TEXT,
    "status" "AdvertisementRequestStatus" NOT NULL DEFAULT 'PENDING',
    "decisionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdvertisementRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_gamingCenterId_idx" ON "AdvertisementRequest"("gamingCenterId");
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_ownerId_idx" ON "AdvertisementRequest"("ownerId");
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_status_idx" ON "AdvertisementRequest"("status");
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_startDate_endDate_idx" ON "AdvertisementRequest"("startDate", "endDate");
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_createdAt_idx" ON "AdvertisementRequest"("createdAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisementRequest_gamingCenterId_fkey') THEN
        ALTER TABLE "AdvertisementRequest" ADD CONSTRAINT "AdvertisementRequest_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisementRequest_ownerId_fkey') THEN
        ALTER TABLE "AdvertisementRequest" ADD CONSTRAINT "AdvertisementRequest_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisementRequest_mediaId_fkey') THEN
        ALTER TABLE "AdvertisementRequest" ADD CONSTRAINT "AdvertisementRequest_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "Media"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'AdvertisementRequest_reviewedById_fkey') THEN
        ALTER TABLE "AdvertisementRequest" ADD CONSTRAINT "AdvertisementRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
