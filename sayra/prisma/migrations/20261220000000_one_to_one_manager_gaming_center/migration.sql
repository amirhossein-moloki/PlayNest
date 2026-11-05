-- 1-to-1 Manager and GamingCenter Relationship Migration
-- Add managerId to GamingCenter with unique constraint and foreign key to User

ALTER TABLE "GamingCenter" ADD COLUMN IF NOT EXISTS "managerId" TEXT;

-- Create unique index on managerId if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'GamingCenter_managerId_key' AND n.nspname = 'public'
    ) THEN
        CREATE UNIQUE INDEX "GamingCenter_managerId_key" ON "GamingCenter"("managerId");
    END IF;
END $$;

-- Add foreign key constraint to User(id)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GamingCenter_managerId_fkey'
    ) THEN
        ALTER TABLE "GamingCenter" ADD CONSTRAINT "GamingCenter_managerId_fkey"
            FOREIGN KEY ("managerId") REFERENCES "User"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Backfill existing managers if any: for gaming centers without managerId, pick an active manager user from User table
DO $$
BEGIN
    UPDATE "GamingCenter" gc
    SET "managerId" = u.id
    FROM (
        SELECT DISTINCT ON ("gamingCenterId") id, "gamingCenterId"
        FROM "User"
        WHERE role = 'MANAGER' AND "isActive" = true
        ORDER BY "gamingCenterId", "createdAt" ASC
    ) u
    WHERE gc.id = u."gamingCenterId" AND gc."managerId" IS NULL;
END $$;
