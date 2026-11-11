-- AlterTable Settings
ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "reservationConfirmationTimeoutMinutes" INTEGER NOT NULL DEFAULT 30;

-- AlterTable Reservation
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "confirmationExpiresAt" TIMESTAMPTZ(6);

-- AlterTable GroupBooking
ALTER TABLE "GroupBooking" ADD COLUMN IF NOT EXISTS "confirmationExpiresAt" TIMESTAMPTZ(6);

-- CreateTable GamingCenterSchedule
CREATE TABLE IF NOT EXISTS "GamingCenterSchedule" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "isClosed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingCenterSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable GamingCenterClosure
CREATE TABLE IF NOT EXISTS "GamingCenterClosure" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "title" TEXT,
    "reason" TEXT,
    "startDate" TIMESTAMPTZ(6) NOT NULL,
    "endDate" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingCenterClosure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GamingCenterSchedule_gamingCenterId_dayOfWeek_key" ON "GamingCenterSchedule"("gamingCenterId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "GamingCenterSchedule_gamingCenterId_idx" ON "GamingCenterSchedule"("gamingCenterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GamingCenterClosure_gamingCenterId_startDate_endDate_idx" ON "GamingCenterClosure"("gamingCenterId", "startDate", "endDate");
CREATE INDEX IF NOT EXISTS "GamingCenterClosure_gamingCenterId_idx" ON "GamingCenterClosure"("gamingCenterId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_status_confirmationExpiresAt_idx" ON "Reservation"("status", "confirmationExpiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GroupBooking_status_confirmationExpiresAt_idx" ON "GroupBooking"("status", "confirmationExpiresAt");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GamingCenterSchedule_gamingCenterId_fkey'
    ) THEN
        ALTER TABLE "GamingCenterSchedule" ADD CONSTRAINT "GamingCenterSchedule_gamingCenterId_fkey"
            FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GamingCenterClosure_gamingCenterId_fkey'
    ) THEN
        ALTER TABLE "GamingCenterClosure" ADD CONSTRAINT "GamingCenterClosure_gamingCenterId_fkey"
            FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
