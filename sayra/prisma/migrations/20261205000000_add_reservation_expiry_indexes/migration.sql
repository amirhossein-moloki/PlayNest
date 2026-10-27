ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ(6);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'GroupBooking') THEN
        ALTER TABLE "GroupBooking" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMPTZ(6);
        CREATE INDEX IF NOT EXISTS "GroupBooking_status_expiresAt_idx" ON "GroupBooking"("status", "expiresAt");
    END IF;
END $$;
