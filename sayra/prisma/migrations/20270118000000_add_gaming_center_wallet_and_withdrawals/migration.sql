-- Additive Migration: Gaming Center Wallet & Commission-Free Manager Withdrawals
-- Note: Platform commission is deducted once on reservation completion, crediting net payout
-- directly into GamingCenter.walletBalance. Withdrawals apply 0% commission.

-- 1. Add wallet fields and CHECK constraints to GamingCenter
ALTER TABLE "GamingCenter"
  ADD COLUMN IF NOT EXISTS "walletBalance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "reservedBalance" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lastWithdrawalRequestAt" TIMESTAMPTZ(6);

ALTER TABLE "GamingCenter"
  DROP CONSTRAINT IF EXISTS "GamingCenter_walletBalance_nonnegative_chk",
  ADD CONSTRAINT "GamingCenter_walletBalance_nonnegative_chk" CHECK ("walletBalance" >= 0);

ALTER TABLE "GamingCenter"
  DROP CONSTRAINT IF EXISTS "GamingCenter_reservedBalance_nonnegative_chk",
  ADD CONSTRAINT "GamingCenter_reservedBalance_nonnegative_chk" CHECK ("reservedBalance" >= 0);

ALTER TABLE "GamingCenter"
  DROP CONSTRAINT IF EXISTS "GamingCenter_wallet_gte_reserved_chk",
  ADD CONSTRAINT "GamingCenter_wallet_gte_reserved_chk" CHECK ("walletBalance" >= "reservedBalance");

-- 2. Enum GamingCenterWalletTransactionType
DO $$ BEGIN
  CREATE TYPE "GamingCenterWalletTransactionType" AS ENUM (
    'RESERVATION_SETTLEMENT',
    'SETTLEMENT_REVERSAL',
    'WITHDRAWAL_HOLD',
    'WITHDRAWAL_REFUND',
    'WITHDRAWAL_PAID',
    'MANUAL_ADJUSTMENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. GamingCenterWithdrawalRequest table
CREATE TABLE IF NOT EXISTS "GamingCenterWithdrawalRequest" (
  "id"                TEXT NOT NULL,
  "gamingCenterId"    TEXT NOT NULL,
  "requestedByUserId" TEXT,
  "amount"            INTEGER NOT NULL,
  "currency"          TEXT NOT NULL DEFAULT 'IRR',
  "status"            "WithdrawalRequestStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason"   TEXT,
  "paymentReference"  TEXT,
  "bankDetails"       JSONB,
  "note"              TEXT,
  "reviewerAdminId"   TEXT,
  "approvedAt"        TIMESTAMPTZ(6),
  "processedAt"       TIMESTAMPTZ(6),
  "paidAt"            TIMESTAMPTZ(6),
  "rejectedAt"        TIMESTAMPTZ(6),
  "cancelledAt"       TIMESTAMPTZ(6),
  "createdAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GamingCenterWithdrawalRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamingCenterWithdrawalRequest_amount_positive_chk" CHECK ("amount" > 0),
  CONSTRAINT "GamingCenterWithdrawalRequest_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GamingCenterWithdrawalRequest_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GamingCenterWithdrawalRequest_reviewerAdminId_fkey" FOREIGN KEY ("reviewerAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "GamingCenterWithdrawalRequest_gamingCenterId_createdAt_idx"
  ON "GamingCenterWithdrawalRequest" ("gamingCenterId", "createdAt");

CREATE INDEX IF NOT EXISTS "GamingCenterWithdrawalRequest_status_createdAt_idx"
  ON "GamingCenterWithdrawalRequest" ("status", "createdAt");

CREATE INDEX IF NOT EXISTS "GamingCenterWithdrawalRequest_status_approvedAt_idx"
  ON "GamingCenterWithdrawalRequest" ("status", "approvedAt");

CREATE INDEX IF NOT EXISTS "GamingCenterWithdrawalRequest_requestedByUserId_idx"
  ON "GamingCenterWithdrawalRequest" ("requestedByUserId");

-- 4. GamingCenterWalletTransaction table
CREATE TABLE IF NOT EXISTS "GamingCenterWalletTransaction" (
  "id"                  TEXT NOT NULL,
  "gamingCenterId"      TEXT NOT NULL,
  "grossAmount"         INTEGER NOT NULL DEFAULT 0,
  "commissionAmount"    INTEGER NOT NULL DEFAULT 0,
  "amount"              INTEGER NOT NULL,
  "currency"            TEXT NOT NULL DEFAULT 'IRR',
  "type"                "GamingCenterWalletTransactionType" NOT NULL,
  "reservationId"       TEXT,
  "earningId"           TEXT,
  "withdrawalRequestId" TEXT,
  "idempotencyKey"      TEXT,
  "note"                TEXT,
  "metadata"            JSONB,
  "createdAt"           TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GamingCenterWalletTransaction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamingCenterWalletTransaction_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "GamingCenterWalletTransaction_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GamingCenterWalletTransaction_earningId_fkey" FOREIGN KEY ("earningId") REFERENCES "Earning"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GamingCenterWalletTransaction_withdrawalRequestId_fkey" FOREIGN KEY ("withdrawalRequestId") REFERENCES "GamingCenterWithdrawalRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "GamingCenterWalletTransaction_idempotencyKey_key"
  ON "GamingCenterWalletTransaction" ("idempotencyKey");

CREATE INDEX IF NOT EXISTS "GamingCenterWalletTransaction_gamingCenterId_createdAt_idx"
  ON "GamingCenterWalletTransaction" ("gamingCenterId", "createdAt");

CREATE INDEX IF NOT EXISTS "GamingCenterWalletTransaction_gamingCenterId_type_idx"
  ON "GamingCenterWalletTransaction" ("gamingCenterId", "type");

CREATE INDEX IF NOT EXISTS "GamingCenterWalletTransaction_reservationId_idx"
  ON "GamingCenterWalletTransaction" ("reservationId");

CREATE INDEX IF NOT EXISTS "GamingCenterWalletTransaction_earningId_idx"
  ON "GamingCenterWalletTransaction" ("earningId");

CREATE INDEX IF NOT EXISTS "GamingCenterWalletTransaction_withdrawalRequestId_idx"
  ON "GamingCenterWalletTransaction" ("withdrawalRequestId");
