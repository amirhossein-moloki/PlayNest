-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "trackingCode" TEXT,
ADD COLUMN "checkedInAt" TIMESTAMPTZ(6),
ADD COLUMN "checkedInByUserId" TEXT;

-- Backfill tracking code for existing reservations
UPDATE "Reservation"
SET "trackingCode" = UPPER(SUBSTRING(MD5("id" || RANDOM()::text || clock_timestamp()::text) FROM 1 FOR 8))
WHERE "trackingCode" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Reservation_trackingCode_key" ON "Reservation"("trackingCode");

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_trackingCode_idx" ON "Reservation"("gamingCenterId", "trackingCode");

-- AddForeignKey
ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_checkedInByUserId_fkey" FOREIGN KEY ("checkedInByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
