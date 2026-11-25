-- Security remediation constraints for SEC-006 (AMI-51):
-- Ensure customer wallet balances cannot go negative or drop below reserved withdrawal amounts,
-- and enforce idempotency on wallet charge credits at the database layer.

ALTER TABLE "CustomerAccount"
  DROP CONSTRAINT IF EXISTS "CustomerAccount_walletBalance_nonnegative_chk",
  ADD CONSTRAINT "CustomerAccount_walletBalance_nonnegative_chk" CHECK ("walletBalance" >= 0);

ALTER TABLE "CustomerAccount"
  DROP CONSTRAINT IF EXISTS "CustomerAccount_reservedBalance_nonnegative_chk",
  ADD CONSTRAINT "CustomerAccount_reservedBalance_nonnegative_chk" CHECK ("reservedBalance" >= 0);

ALTER TABLE "CustomerAccount"
  DROP CONSTRAINT IF EXISTS "CustomerAccount_wallet_gte_reserved_chk",
  ADD CONSTRAINT "CustomerAccount_wallet_gte_reserved_chk" CHECK ("walletBalance" >= "reservedBalance");

CREATE UNIQUE INDEX IF NOT EXISTS "WalletTransaction_walletChargeId_unique_idx"
  ON "WalletTransaction" ("walletChargeId")
  WHERE "walletChargeId" IS NOT NULL;
