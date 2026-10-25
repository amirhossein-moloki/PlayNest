-- AlterTable
ALTER TABLE "CommissionPolicy" ADD COLUMN "monthlyTarget" INTEGER,
ADD COLUMN "maxPercentBps" INTEGER NOT NULL DEFAULT 10000;

-- AlterTable
ALTER TABLE "Earning" ADD COLUMN "targetPeriod" TEXT,
ADD COLUMN "targetReached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "targetContribution" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Earning_gamingCenterId_targetPeriod_idx" ON "Earning"("gamingCenterId", "targetPeriod");
