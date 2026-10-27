-- AlterTable
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ(6);
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "groupBookingId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "GroupBooking" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "customerProfileId" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "startTime" TIMESTAMPTZ(6) NOT NULL,
    "endTime" TIMESTAMPTZ(6) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentState" "ReservationPaymentState" NOT NULL DEFAULT 'UNPAID',
    "status" "ReservationStatus" NOT NULL DEFAULT 'CONFIRMED',
    "note" TEXT,
    "canceledAt" TIMESTAMPTZ(6),
    "cancelReason" TEXT,
    "canceledByUserId" TEXT,
    "expiresAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GroupBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "GroupBookingItem" (
    "id" TEXT NOT NULL,
    "groupBookingId" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "reservationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupBookingItem_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "groupBookingId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GroupBooking_gamingCenterId_startTime_idx" ON "GroupBooking"("gamingCenterId", "startTime");
CREATE INDEX IF NOT EXISTS "GroupBooking_customerAccountId_startTime_idx" ON "GroupBooking"("customerAccountId", "startTime");
CREATE INDEX IF NOT EXISTS "GroupBooking_customerProfileId_startTime_idx" ON "GroupBooking"("customerProfileId", "startTime");
CREATE INDEX IF NOT EXISTS "GroupBooking_gamingCenterId_status_startTime_idx" ON "GroupBooking"("gamingCenterId", "status", "startTime");
CREATE INDEX IF NOT EXISTS "GroupBooking_status_expiresAt_idx" ON "GroupBooking"("status", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GroupBookingItem_reservationId_key" ON "GroupBookingItem"("reservationId");
CREATE INDEX IF NOT EXISTS "GroupBookingItem_groupBookingId_idx" ON "GroupBookingItem"("groupBookingId");
CREATE INDEX IF NOT EXISTS "GroupBookingItem_stationId_idx" ON "GroupBookingItem"("stationId");

CREATE INDEX IF NOT EXISTS "Reservation_groupBookingId_idx" ON "Reservation"("groupBookingId");
CREATE INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Reservation_groupBookingId_fkey') THEN
        ALTER TABLE "Reservation" ADD CONSTRAINT "Reservation_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBooking_gamingCenterId_fkey') THEN
        ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBooking_customerProfileId_fkey') THEN
        ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_customerProfileId_fkey" FOREIGN KEY ("customerProfileId") REFERENCES "CustomerProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBooking_customerAccountId_fkey') THEN
        ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBooking_createdByUserId_fkey') THEN
        ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBooking_canceledByUserId_fkey') THEN
        ALTER TABLE "GroupBooking" ADD CONSTRAINT "GroupBooking_canceledByUserId_fkey" FOREIGN KEY ("canceledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBookingItem_groupBookingId_fkey') THEN
        ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBookingItem_stationId_fkey') THEN
        ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GroupBookingItem_reservationId_fkey') THEN
        ALTER TABLE "GroupBookingItem" ADD CONSTRAINT "GroupBookingItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Payment_groupBookingId_fkey') THEN
        ALTER TABLE "Payment" ADD CONSTRAINT "Payment_groupBookingId_fkey" FOREIGN KEY ("groupBookingId") REFERENCES "GroupBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
