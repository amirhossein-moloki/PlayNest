-- Migration: Allow Gaming Center Managers to Create and Manage Tickets
-- Alter Ticket table: make customerAccountId nullable, add userId and gamingCenterId columns with foreign keys and indexes

-- 1. Make customerAccountId nullable
ALTER TABLE "Ticket" ALTER COLUMN "customerAccountId" DROP NOT NULL;

-- 2. Add userId and gamingCenterId columns if they don't exist
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "userId" TEXT;
ALTER TABLE "Ticket" ADD COLUMN IF NOT EXISTS "gamingCenterId" TEXT;

-- 3. Create indexes
CREATE INDEX IF NOT EXISTS "Ticket_userId_idx" ON "Ticket"("userId");
CREATE INDEX IF NOT EXISTS "Ticket_gamingCenterId_idx" ON "Ticket"("gamingCenterId");

-- 4. Add Foreign Keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Ticket_userId_fkey'
    ) THEN
        ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Ticket_gamingCenterId_fkey'
    ) THEN
        ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_gamingCenterId_fkey"
            FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
