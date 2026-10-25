-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCESSFUL', 'FAILED', 'AMBIGUOUS');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT_COLLECTION', 'REFUND_DISBURSEMENT', 'COMPENSATING_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'DISCREPANCY_AMOUNT', 'DISCREPANCY_STATUS', 'MISSING_PROVIDER_REF', 'UNCONFIRMED_PROVIDER_STATE');

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "failureReason" TEXT,
    "providerRefundId" TEXT,
    "idempotencyKey" TEXT,
    "rawPayload" JSONB,
    "requestedById" TEXT,
    "processedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerEntry" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT,
    "refundId" TEXT,
    "entryType" "LedgerEntryType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReconciliationRecord" (
    "id" TEXT NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "status" "ReconciliationStatus" NOT NULL,
    "details" JSONB,
    "reconciledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReconciliationRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Refund_paymentId_status_idx" ON "Refund"("paymentId", "status");

-- CreateIndex
CREATE INDEX "Refund_gamingCenterId_status_createdAt_idx" ON "Refund"("gamingCenterId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Refund_providerRefundId_idx" ON "Refund"("providerRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_gamingCenterId_idempotencyKey_key" ON "Refund"("gamingCenterId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_idempotencyKey_key" ON "LedgerEntry"("idempotencyKey");

-- CreateIndex
CREATE INDEX "LedgerEntry_gamingCenterId_createdAt_idx" ON "LedgerEntry"("gamingCenterId", "createdAt");

-- CreateIndex
CREATE INDEX "LedgerEntry_paymentId_idx" ON "LedgerEntry"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerEntry_refundId_idx" ON "LedgerEntry"("refundId");

-- CreateIndex
CREATE INDEX "LedgerEntry_entryType_idx" ON "LedgerEntry"("entryType");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_gamingCenterId_status_reconciledAt_idx" ON "ReconciliationRecord"("gamingCenterId", "status", "reconciledAt");

-- CreateIndex
CREATE INDEX "ReconciliationRecord_paymentId_idx" ON "ReconciliationRecord"("paymentId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerEntry" ADD CONSTRAINT "LedgerEntry_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationRecord" ADD CONSTRAINT "ReconciliationRecord_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
