-- Rollback Migration: Safely reverses 20270116000000_add_platform_admin_totp_2fa
-- Preserves existing PlatformAdmin accounts and password hashes.

-- 1. Drop new tables in reverse dependency order
DROP TABLE IF EXISTS "PlatformAdminChallenge";
DROP TABLE IF EXISTS "PlatformAdminRecoveryCode";
DROP TABLE IF EXISTS "PlatformAdminAuthenticator";

-- 2. Drop enums
DROP TYPE IF EXISTS "PlatformAdminChallengePurpose";
DROP TYPE IF EXISTS "PlatformAdminAuthenticatorStatus";

-- 3. Remove Session MFA/metadata columns
ALTER TABLE "Session"
    DROP COLUMN IF EXISTS "lastUsedAt",
    DROP COLUMN IF EXISTS "userAgent",
    DROP COLUMN IF EXISTS "ipAddress",
    DROP COLUMN IF EXISTS "mfaVerifiedAt";

-- 4. Remove PlatformAdmin TOTP/lockout/username indexes & columns
DROP INDEX IF EXISTS "PlatformAdmin_username_idx";
DROP INDEX IF EXISTS "PlatformAdmin_username_lower_key";
DROP INDEX IF EXISTS "PlatformAdmin_username_key";

ALTER TABLE "PlatformAdmin"
    DROP COLUMN IF EXISTS "lockedUntil",
    DROP COLUMN IF EXISTS "failedLoginAttempts",
    DROP COLUMN IF EXISTS "totpLockedUntil",
    DROP COLUMN IF EXISTS "totpFailedAttempts",
    DROP COLUMN IF EXISTS "totpLastUsedStep",
    DROP COLUMN IF EXISTS "totpLastUsedAt",
    DROP COLUMN IF EXISTS "totpEnabledAt",
    DROP COLUMN IF EXISTS "totpSetupCompleted",
    DROP COLUMN IF EXISTS "totpEnabled",
    DROP COLUMN IF EXISTS "totpPendingCreatedAt",
    DROP COLUMN IF EXISTS "totpPendingSecretEncrypted",
    DROP COLUMN IF EXISTS "totpSecretEncrypted",
    DROP COLUMN IF EXISTS "username";

-- Restore NOT NULL on phone only if no rows currently have NULL phone
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "PlatformAdmin" WHERE "phone" IS NULL) THEN
        ALTER TABLE "PlatformAdmin" ALTER COLUMN "phone" SET NOT NULL;
    END IF;
END $$;
