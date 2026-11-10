-- CreateEnum
CREATE TYPE "BookingHoldStatus" AS ENUM ('ACTIVE', 'CONVERTED', 'EXPIRED', 'RELEASED');

-- CreateTable
CREATE TABLE "BookingHold" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 60,
    "playerCount" INTEGER NOT NULL DEFAULT 1,
    "totalAmount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "status" "BookingHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "idempotencyKey" TEXT,
    "convertedGroupBookingId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingHold_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookingHoldItem" (
    "id" TEXT NOT NULL,
    "bookingHoldId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "staffId" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountId" TEXT,
    "stationSnapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookingHoldItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN "bookingHoldId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "BookingHold_gamingCenterId_idempotencyKey_key" ON "BookingHold"("gamingCenterId", "idempotencyKey");
CREATE INDEX "BookingHold_gamingCenterId_status_expiresAt_idx" ON "BookingHold"("gamingCenterId", "status", "expiresAt");
CREATE INDEX "BookingHold_status_expiresAt_idx" ON "BookingHold"("status", "expiresAt");
CREATE INDEX "BookingHold_customerAccountId_status_idx" ON "BookingHold"("customerAccountId", "status");
CREATE INDEX "BookingHold_gamingCenterId_startTime_idx" ON "BookingHold"("gamingCenterId", "startTime");

-- CreateIndex
CREATE INDEX "BookingHoldItem_bookingHoldId_idx" ON "BookingHoldItem"("bookingHoldId");
CREATE INDEX "BookingHoldItem_stationId_idx" ON "BookingHoldItem"("stationId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingHoldId_key" ON "Payment"("bookingHoldId");

-- AddForeignKey
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BookingHold" ADD CONSTRAINT "BookingHold_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingHoldItem" ADD CONSTRAINT "BookingHoldItem_bookingHoldId_fkey" FOREIGN KEY ("bookingHoldId") REFERENCES "BookingHold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingHoldItem" ADD CONSTRAINT "BookingHoldItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingHoldId_fkey" FOREIGN KEY ("bookingHoldId") REFERENCES "BookingHold"("id") ON DELETE CASCADE ON UPDATE CASCADE;
