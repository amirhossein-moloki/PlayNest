-- Migration: Add Customer Wallet Withdrawal System and In-App Notifications
-- Safe, idempotent, non-destructive migration for PlayNest Sayra

-- 1. Safely add new values to WalletTransactionType enum if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'WalletTransactionType' AND pg_enum.enumlabel = 'WITHDRAWAL_HOLD'
    ) THEN
        ALTER TYPE "WalletTransactionType" ADD VALUE 'WITHDRAWAL_HOLD';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'WalletTransactionType' AND pg_enum.enumlabel = 'WITHDRAWAL_REFUND'
    ) THEN
        ALTER TYPE "WalletTransactionType" ADD VALUE 'WITHDRAWAL_REFUND';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
        WHERE pg_type.typname = 'WalletTransactionType' AND pg_enum.enumlabel = 'WITHDRAWAL_PAID'
    ) THEN
        ALTER TYPE "WalletTransactionType" ADD VALUE 'WITHDRAWAL_PAID';
    END IF;
END $$;

-- 2. Safely create WithdrawalRequestStatus enum if not already present
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'WithdrawalRequestStatus'
    ) THEN
        CREATE TYPE "WithdrawalRequestStatus" AS ENUM (
            'PENDING',
            'APPROVED',
            'REJECTED',
            'PROCESSING',
            'PAID',
            'FAILED',
            'CANCELLED'
        );
    END IF;
END $$;

-- 3. Safely add columns to CustomerAccount
ALTER TABLE "CustomerAccount"
    ADD COLUMN IF NOT EXISTS "reservedBalance" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lastWithdrawalRequestAt" TIMESTAMPTZ(6);

-- 4. Create WithdrawalRequest table
CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'IRR',
    "status" "WithdrawalRequestStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "paymentReference" TEXT,
    "bankDetails" JSONB,
    "note" TEXT,
    "reviewerAdminId" TEXT,
    "approvedAt" TIMESTAMPTZ(6),
    "processedAt" TIMESTAMPTZ(6),
    "paidAt" TIMESTAMPTZ(6),
    "rejectedAt" TIMESTAMPTZ(6),
    "cancelledAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WithdrawalRequest_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WithdrawalRequest_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WithdrawalRequest_reviewerAdminId_fkey" FOREIGN KEY ("reviewerAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- Indexes for WithdrawalRequest
CREATE INDEX IF NOT EXISTS "WithdrawalRequest_customerAccountId_createdAt_idx"
    ON "WithdrawalRequest"("customerAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "WithdrawalRequest_status_createdAt_idx"
    ON "WithdrawalRequest"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "WithdrawalRequest_status_approvedAt_idx"
    ON "WithdrawalRequest"("status", "approvedAt");

-- 5. Add withdrawalRequestId column and foreign key to WalletTransaction
ALTER TABLE "WalletTransaction"
    ADD COLUMN IF NOT EXISTS "withdrawalRequestId" TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_withdrawalRequestId_fkey'
    ) THEN
        ALTER TABLE "WalletTransaction"
            ADD CONSTRAINT "WalletTransaction_withdrawalRequestId_fkey"
            FOREIGN KEY ("withdrawalRequestId") REFERENCES "WithdrawalRequest"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "WalletTransaction_withdrawalRequestId_idx"
    ON "WalletTransaction"("withdrawalRequestId");

-- 6. Create CustomerNotification table
CREATE TABLE IF NOT EXISTS "CustomerNotification" (
    "id" TEXT NOT NULL,
    "customerAccountId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'GENERAL',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerNotification_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CustomerNotification_customerAccountId_fkey" FOREIGN KEY ("customerAccountId") REFERENCES "CustomerAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Indexes for CustomerNotification
CREATE INDEX IF NOT EXISTS "CustomerNotification_customerAccountId_isRead_createdAt_idx"
    ON "CustomerNotification"("customerAccountId", "isRead", "createdAt");

CREATE INDEX IF NOT EXISTS "CustomerNotification_customerAccountId_createdAt_idx"
    ON "CustomerNotification"("customerAccountId", "createdAt");
