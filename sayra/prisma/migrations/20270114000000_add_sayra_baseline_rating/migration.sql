-- AlterTable
ALTER TABLE "GamingCenter"
ADD COLUMN "sayraRating" DOUBLE PRECISION,
ADD COLUMN "sayraReviewComment" TEXT,
ADD COLUMN "sayraRatedAt" TIMESTAMP(3),
ADD COLUMN "sayraRatedByAdminId" TEXT;

-- AddForeignKey
ALTER TABLE "GamingCenter"
ADD CONSTRAINT "GamingCenter_sayraRatedByAdminId_fkey"
FOREIGN KEY ("sayraRatedByAdminId") REFERENCES "PlatformAdmin"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
