-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OnboardingStep') THEN
        CREATE TYPE "OnboardingStep" AS ENUM ('INITIAL', 'OTP_PENDING', 'AUTHENTICATED', 'LOCATION_PENDING', 'WORKING_HOURS_PENDING', 'MEDIA_PENDING', 'PREVIEW', 'COMPLETED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'GamingCenterVerificationStatus') THEN
        CREATE TYPE "GamingCenterVerificationStatus" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'APPROVED', 'REJECTED');
    END IF;
END $$;

-- AlterTable GamingCenter
ALTER TABLE "GamingCenter" ADD COLUMN IF NOT EXISTS "verificationStatus" "GamingCenterVerificationStatus" NOT NULL DEFAULT 'NOT_SUBMITTED';
ALTER TABLE "GamingCenter" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "GamingCenter" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "GamingCenter" ADD COLUMN IF NOT EXISTS "closedDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
ALTER TABLE "GamingCenter" ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran';

CREATE INDEX IF NOT EXISTS "GamingCenter_verificationStatus_idx" ON "GamingCenter"("verificationStatus");

-- CreateTable GameCenterOnboarding
CREATE TABLE IF NOT EXISTS "GameCenterOnboarding" (
    "id" TEXT NOT NULL,
    "step" "OnboardingStep" NOT NULL DEFAULT 'INITIAL',
    "managerId" TEXT,
    "managerFullName" TEXT,
    "managerPhone" TEXT NOT NULL,
    "gameCenterName" TEXT NOT NULL,
    "gamingCenterId" TEXT,
    "provinceId" TEXT,
    "cityId" TEXT,
    "address" TEXT,
    "latitude" DECIMAL(65,30),
    "longitude" DECIMAL(65,30),
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Tehran',
    "openingTime" TEXT,
    "closingTime" TEXT,
    "closedDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "logoMediaId" TEXT,
    "galleryMediaIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GameCenterOnboarding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GameCenterOnboarding_gamingCenterId_key" ON "GameCenterOnboarding"("gamingCenterId");
CREATE INDEX IF NOT EXISTS "GameCenterOnboarding_managerPhone_idx" ON "GameCenterOnboarding"("managerPhone");
CREATE INDEX IF NOT EXISTS "GameCenterOnboarding_step_idx" ON "GameCenterOnboarding"("step");

-- CreateTable GamingCenterVerification
CREATE TABLE IF NOT EXISTS "GamingCenterVerification" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "status" "GamingCenterVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "nationalCardUrl" TEXT NOT NULL,
    "idWithSelfieUrl" TEXT NOT NULL,
    "businessLicenseUrl" TEXT NOT NULL,
    "reviewerAdminId" TEXT,
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamingCenterVerification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GamingCenterVerification_gamingCenterId_idx" ON "GamingCenterVerification"("gamingCenterId");
CREATE INDEX IF NOT EXISTS "GamingCenterVerification_status_idx" ON "GamingCenterVerification"("status");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameCenterOnboarding_gamingCenterId_fkey') THEN
        ALTER TABLE "GameCenterOnboarding" ADD CONSTRAINT "GameCenterOnboarding_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GamingCenterVerification_gamingCenterId_fkey') THEN
        ALTER TABLE "GamingCenterVerification" ADD CONSTRAINT "GamingCenterVerification_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GamingCenterVerification_reviewerAdminId_fkey') THEN
        ALTER TABLE "GamingCenterVerification" ADD CONSTRAINT "GamingCenterVerification_reviewerAdminId_fkey" FOREIGN KEY ("reviewerAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
