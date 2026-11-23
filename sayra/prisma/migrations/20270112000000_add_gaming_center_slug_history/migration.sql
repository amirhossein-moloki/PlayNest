-- CreateTable
CREATE TABLE IF NOT EXISTS "GamingCenterSlugHistory" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamingCenterSlugHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "GamingCenterSlugHistory_slug_key" ON "GamingCenterSlugHistory"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GamingCenterSlugHistory_gamingCenterId_idx" ON "GamingCenterSlugHistory"("gamingCenterId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'GamingCenterSlugHistory_gamingCenterId_fkey'
    ) THEN
        ALTER TABLE "GamingCenterSlugHistory"
            ADD CONSTRAINT "GamingCenterSlugHistory_gamingCenterId_fkey"
            FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
