-- Migration: Add Customer Wallet Online Charging with Zibal Gateway
-- Safe, idempotent, non-destructive migration for PlayNest Sayra

-- 1. Safely create WalletChargeStatus enum if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'WalletChargeStatus'
    ) THEN
        CREATE TYPE "WalletChargeStatus" AS ENUM (
            'PENDING',
            'PROCESSING',
            'PAID',
            'FAILED',
            'CANCELLED'
        );
    END IF;
END $$;

-- 2. Create WalletCharge table
CREATE TABLE IF NOT EXISTS "WalletCharge" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "provider" "PaymentProvider" NOT NULL DEFAULT 'ZIBAL',
    "status" "WalletChargeStatus" NOT NULL DEFAULT 'PENDING',
    "trackId" TEXT,
    "refNumber" TEXT,
    "failureReason" TEXT,
    "idempotencyKey" TEXT,
    "rawProviderPayload" JSONB,
    "paidAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletCharge_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WalletCharge_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes and unique constraints for WalletCharge
CREATE UNIQUE INDEX IF NOT EXISTS "WalletCharge_trackId_key"
    ON "WalletCharge"("trackId")
    WHERE "trackId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WalletCharge_customerAccountId_idempotencyKey_key"
    ON "WalletCharge"("customerAccountId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "WalletCharge_customerAccountId_createdAt_idx"
    ON "WalletCharge"("customerAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "WalletCharge_status_createdAt_idx"
    ON "WalletCharge"("status", "createdAt");

-- 3. Add walletChargeId column and foreign key to WalletTransaction
ALTER TABLE "WalletTransaction"
    ADD COLUMN IF NOT EXISTS "walletChargeId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_walletChargeId_fkey'
    ) THEN
        ALTER TABLE "WalletTransaction"
            ADD CONSTRAINT "WalletTransaction_walletChargeId_fkey"
            FOREIGN KEY ("walletChargeId") REFERENCES "WalletCharge"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WalletTransaction_walletChargeId_idx"
    ON "WalletTransaction"("walletChargeId");
