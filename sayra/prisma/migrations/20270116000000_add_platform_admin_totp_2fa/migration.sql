-- Migration: 20270116000000_add_platform_admin_totp_2fa
-- Adds mandatory TOTP 2FA support, multi-device authenticator enrollment,
-- single-use hashed recovery codes, ephemeral 2FA challenge/setup tokens,
-- and username login support for PlatformAdmin without altering existing user OTP flows.

-- 1. Create Enums
DO $$
BEGIN
    CREATE TYPE "PlatformAdminAuthenticatorStatus" AS ENUM ('PENDING', 'ACTIVE', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    CREATE TYPE "PlatformAdminChallengePurpose" AS ENUM ('TOTP_VERIFY', 'TOTP_SETUP');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- 2. Alter PlatformAdmin table (non-destructive; preserves all existing rows and password hashes)
ALTER TABLE "PlatformAdmin" ALTER COLUMN "phone" DROP NOT NULL;

ALTER TABLE "PlatformAdmin"
    ADD COLUMN IF NOT EXISTS "username" TEXT,
    ADD COLUMN IF NOT EXISTS "totpSecretEncrypted" TEXT,
    ADD COLUMN IF NOT EXISTS "totpPendingSecretEncrypted" TEXT,
    ADD COLUMN IF NOT EXISTS "totpPendingCreatedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "totpEnabled" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "totpSetupCompleted" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "totpEnabledAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "totpLastUsedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "totpLastUsedStep" INTEGER,
    ADD COLUMN IF NOT EXISTS "totpFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "totpLockedUntil" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMPTZ;

-- Safe non-destructive username backfill for pre-existing PlatformAdmin accounts
UPDATE "PlatformAdmin"
SET "username" = COALESCE(
    NULLIF(LOWER(BTRIM("email")), ''),
    NULLIF(BTRIM("phone"), ''),
    'admin_' || "id"
)
WHERE "username" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_username_key" ON "PlatformAdmin"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_username_lower_key" ON "PlatformAdmin"(LOWER("username")) WHERE "username" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PlatformAdmin_username_idx" ON "PlatformAdmin"("username");

-- 3. Alter Session table for MFA verification timestamp & session metadata
ALTER TABLE "Session"
    ADD COLUMN IF NOT EXISTS "mfaVerifiedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "ipAddress" TEXT,
    ADD COLUMN IF NOT EXISTS "userAgent" TEXT,
    ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMPTZ;

-- 4. Create PlatformAdminAuthenticator table (multi-device TOTP support)
CREATE TABLE IF NOT EXISTS "PlatformAdminAuthenticator" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT 'Authenticator App',
    "issuer" TEXT NOT NULL DEFAULT 'PlayNest',
    "secretEncrypted" TEXT NOT NULL,
    "status" "PlatformAdminAuthenticatorStatus" NOT NULL DEFAULT 'PENDING',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMPTZ,
    "lastUsedAt" TIMESTAMPTZ,
    "lastUsedStep" INTEGER,
    "pendingExpiresAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminAuthenticator_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformAdminAuthenticator_platformAdminId_status_idx"
    ON "PlatformAdminAuthenticator"("platformAdminId", "status");
CREATE INDEX IF NOT EXISTS "PlatformAdminAuthenticator_platformAdminId_isPrimary_idx"
    ON "PlatformAdminAuthenticator"("platformAdminId", "isPrimary");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PlatformAdminAuthenticator_platformAdminId_fkey'
    ) THEN
        ALTER TABLE "PlatformAdminAuthenticator"
            ADD CONSTRAINT "PlatformAdminAuthenticator_platformAdminId_fkey"
            FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 5. Create PlatformAdminRecoveryCode table (single-use hashed backup codes)
CREATE TABLE IF NOT EXISTS "PlatformAdminRecoveryCode" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminRecoveryCode_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformAdminRecoveryCode_platformAdminId_usedAt_revokedAt_idx"
    ON "PlatformAdminRecoveryCode"("platformAdminId", "usedAt", "revokedAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PlatformAdminRecoveryCode_platformAdminId_fkey'
    ) THEN
        ALTER TABLE "PlatformAdminRecoveryCode"
            ADD CONSTRAINT "PlatformAdminRecoveryCode_platformAdminId_fkey"
            FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 6. Create PlatformAdminChallenge table (ephemeral 2FA challenge/setup state)
CREATE TABLE IF NOT EXISTS "PlatformAdminChallenge" (
    "id" TEXT NOT NULL,
    "platformAdminId" TEXT NOT NULL,
    "purpose" "PlatformAdminChallengePurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "consumedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdminChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdminChallenge_tokenHash_key"
    ON "PlatformAdminChallenge"("tokenHash");
CREATE INDEX IF NOT EXISTS "PlatformAdminChallenge_platformAdminId_purpose_expiresAt_idx"
    ON "PlatformAdminChallenge"("platformAdminId", "purpose", "expiresAt");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PlatformAdminChallenge_platformAdminId_fkey'
    ) THEN
        ALTER TABLE "PlatformAdminChallenge"
            ADD CONSTRAINT "PlatformAdminChallenge_platformAdminId_fkey"
            FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id")
            ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
