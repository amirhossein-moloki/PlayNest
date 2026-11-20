-- 1. Alter PaymentMethod enum to add WALLET if not already present
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type
    JOIN pg_enum ON pg_enum.enumtypid = pg_type.oid
    WHERE pg_type.typname = 'PaymentMethod' AND pg_enum.enumlabel = 'WALLET'
  ) THEN
    ALTER TYPE "PaymentMethod" ADD VALUE 'WALLET';
  END IF;
END $$;

-- 2. Add walletAmount column to Payment table
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "walletAmount" INTEGER NOT NULL DEFAULT 0;

-- 3. Add paymentId and idempotencyKey columns to WalletTransaction
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;
ALTER TABLE "WalletTransaction" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;

-- 4. Add foreign key from WalletTransaction to Payment
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'WalletTransaction_paymentId_fkey'
  ) THEN
    ALTER TABLE "WalletTransaction"
      ADD CONSTRAINT "WalletTransaction_paymentId_fkey"
      FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Update indexes on WalletTransaction
CREATE INDEX IF NOT EXISTS "WalletTransaction_paymentId_idx" ON "WalletTransaction"("paymentId");
CREATE INDEX IF NOT EXISTS "WalletTransaction_idempotencyKey_idx" ON "WalletTransaction"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "WalletTransaction_reservationId_type_idx" ON "WalletTransaction"("reservationId", "type");

-- Replace old composite unique constraint on (reservationId, type) with (paymentId, type)
DROP INDEX IF EXISTS "WalletTransaction_reservationId_type_key";
CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_paymentId_type_key"
  ON "WalletTransaction"("paymentId", "type") WHERE "paymentId" IS NOT NULL;
