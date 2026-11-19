-- AlterTable Rating
ALTER TABLE "Rating" ADD COLUMN IF NOT EXISTS "replyComment" TEXT;
ALTER TABLE "Rating" ADD COLUMN IF NOT EXISTS "replyAt" TIMESTAMPTZ(6);
ALTER TABLE "Rating" ADD COLUMN IF NOT EXISTS "repliedById" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Rating_repliedById_fkey'
  ) THEN
    ALTER TABLE "Rating" ADD CONSTRAINT "Rating_repliedById_fkey" FOREIGN KEY ("repliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
