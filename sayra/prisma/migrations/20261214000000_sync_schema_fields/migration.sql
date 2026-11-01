-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CancellationCategory') THEN
        CREATE TYPE "CancellationCategory" AS ENUM ('CUSTOMER_CANCEL', 'CENTER_CANCEL', 'PAYMENT_FAILED', 'CAPACITY_UNAVAILABLE', 'TECHNICAL_ISSUE', 'SCHEDULE_CONFLICT', 'OPERATIONAL_ISSUE', 'EMERGENCY', 'OTHER', 'UNKNOWN');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'CancellationActor') THEN
        CREATE TYPE "CancellationActor" AS ENUM ('CUSTOMER', 'STAFF', 'SYSTEM');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PaymentProvider') THEN
        CREATE TYPE "PaymentProvider" AS ENUM ('MANUAL', 'STRIPE', 'ZARINPAL');
    END IF;
END $$;

-- AlterTable Reservation
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "cancelCategory" "CancellationCategory";
ALTER TABLE "Reservation" ADD COLUMN IF NOT EXISTS "cancelActor" "CancellationActor";

-- AlterTable Payment
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "provider" "PaymentProvider" NOT NULL DEFAULT 'MANUAL';
