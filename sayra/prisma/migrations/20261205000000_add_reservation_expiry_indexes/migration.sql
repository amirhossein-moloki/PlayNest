-- CreateIndex
CREATE INDEX IF NOT EXISTS "Reservation_status_expiresAt_idx" ON "Reservation"("status", "expiresAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GroupBooking_status_expiresAt_idx" ON "GroupBooking"("status", "expiresAt");
