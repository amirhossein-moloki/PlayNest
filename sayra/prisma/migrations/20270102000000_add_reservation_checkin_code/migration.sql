-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN "checkInCode" TEXT;

-- CreateIndex
CREATE INDEX "Reservation_gamingCenterId_checkInCode_idx" ON "Reservation"("gamingCenterId", "checkInCode");
