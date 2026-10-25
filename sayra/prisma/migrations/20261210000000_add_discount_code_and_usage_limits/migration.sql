-- AlterTable
ALTER TABLE "Discount" ADD COLUMN "code" TEXT,
ADD COLUMN "maxUses" INTEGER,
ADD COLUMN "usedCount" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "Discount_gamingCenterId_code_key" ON "Discount"("gamingCenterId", "code");
