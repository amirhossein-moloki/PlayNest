-- AlterTable GamingCenterVerification
ALTER TABLE "GamingCenterVerification" ADD COLUMN IF NOT EXISTS "ownerFullName" TEXT;
ALTER TABLE "GamingCenterVerification" ADD COLUMN IF NOT EXISTS "phoneNumber" TEXT;
ALTER TABLE "GamingCenterVerification" ADD COLUMN IF NOT EXISTS "gamingCenterName" TEXT;
ALTER TABLE "GamingCenterVerification" ALTER COLUMN "nationalCardUrl" DROP NOT NULL;
ALTER TABLE "GamingCenterVerification" ALTER COLUMN "idWithSelfieUrl" DROP NOT NULL;
