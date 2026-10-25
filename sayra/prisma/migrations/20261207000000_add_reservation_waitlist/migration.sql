-- CreateEnum
CREATE TYPE "WaitlistStatus" AS ENUM ('ACTIVE', 'OFFERED', 'CONVERTED', 'CANCELLED', 'EXPIRED', 'CLOSED');

-- CreateEnum
CREATE TYPE "WaitlistOfferStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED');

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'WAITLIST_OFFER_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'WAITLIST_OFFER_EXPIRED';
ALTER TYPE "NotificationType" ADD VALUE 'WAITLIST_ENTRY_CANCELLED';

-- CreateTable
CREATE TABLE "WaitlistEntry" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "status" "WaitlistStatus" NOT NULL DEFAULT 'ACTIVE',
    "note" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "convertedReservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaitlistOffer" (
    "id" TEXT NOT NULL,
    "waitlistEntryId" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "offeredStartTime" TIMESTAMPTZ(6) NOT NULL,
    "offeredEndTime" TIMESTAMPTZ(6) NOT NULL,
    "status" "WaitlistOfferStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WaitlistOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistEntry_gamingCenterId_stationId_status_startTime_end_idx" ON "WaitlistEntry"("gamingCenterId", "stationId", "status", "startTime", "endTime");

-- CreateIndex
CREATE INDEX "WaitlistEntry_customerAccountId_status_idx" ON "WaitlistEntry"("customerAccountId", "status");

-- CreateIndex
CREATE INDEX "WaitlistEntry_status_createdAt_idx" ON "WaitlistEntry"("status", "createdAt");

-- CreatePartialUniqueIndex for active entry duplicate constraint
CREATE UNIQUE INDEX "WaitlistEntry_customer_station_time_active_key" ON "WaitlistEntry"("customerAccountId", "stationId", "startTime", "endTime") WHERE "status" = 'ACTIVE';

-- CreateIndex
CREATE INDEX "WaitlistOffer_waitlistEntryId_status_idx" ON "WaitlistOffer"("waitlistEntryId", "status");

-- CreateIndex
CREATE INDEX "WaitlistOffer_gamingCenterId_status_expiresAt_idx" ON "WaitlistOffer"("gamingCenterId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "WaitlistOffer_status_expiresAt_idx" ON "WaitlistOffer"("status", "expiresAt");

-- CreatePartialUniqueIndex for pending offer constraint
CREATE UNIQUE INDEX "WaitlistOffer_entry_pending_key" ON "WaitlistOffer"("waitlistEntryId") WHERE "status" = 'PENDING';

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistEntry" ADD CONSTRAINT "WaitlistEntry_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_waitlistEntryId_fkey" FOREIGN KEY ("waitlistEntryId") REFERENCES "WaitlistEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaitlistOffer" ADD CONSTRAINT "WaitlistOffer_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
