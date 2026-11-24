-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationEventType') THEN
        CREATE TYPE "IntegrationEventType" AS ENUM (
            'GAMING_CENTER_UPDATED',
            'GAMING_CENTER_STATUS_CHANGED',
            'GAMING_CENTER_ADDRESS_CHANGED',
            'GAMING_CENTER_MEDIA_CHANGED',
            'GAMING_CENTER_PRICING_CHANGED',
            'GAMING_CENTER_AMENITIES_CHANGED',
            'GAMING_CENTER_REVIEW_CHANGED'
        );
    END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IntegrationOutboxStatus') THEN
        CREATE TYPE "IntegrationOutboxStatus" AS ENUM (
            'PENDING',
            'PROCESSING',
            'DELIVERED',
            'FAILED',
            'DEAD_LETTER'
        );
    END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "IntegrationOutboxEvent" (
    "id" TEXT NOT NULL,
    "eventType" "IntegrationEventType" NOT NULL,
    "gamingCenterId" TEXT NOT NULL,
    "gamingCenterSlug" TEXT,
    "city" TEXT,
    "payload" JSONB NOT NULL,
    "status" "IntegrationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextRetryAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationOutboxEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Address_city_district_idx" ON "Address"("city", "district");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationOutboxEvent_idempotencyKey_key" ON "IntegrationOutboxEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationOutboxEvent_status_nextRetryAt_idx" ON "IntegrationOutboxEvent"("status", "nextRetryAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationOutboxEvent_gamingCenterId_createdAt_idx" ON "IntegrationOutboxEvent"("gamingCenterId", "createdAt");
