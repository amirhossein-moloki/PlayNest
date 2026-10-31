-- AlterEnum
ALTER TYPE "SessionActorType" ADD VALUE IF NOT EXISTS 'PLATFORM_ADMIN';

-- CreateTable
CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSuperuser" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_phone_key" ON "PlatformAdmin"("phone");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_email_key" ON "PlatformAdmin"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformAdmin_phone_idx" ON "PlatformAdmin"("phone");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "PlatformAdmin_isActive_idx" ON "PlatformAdmin"("isActive");

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "platformAdminId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditLog_platformAdminId_idx" ON "AuditLog"("platformAdminId");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'AuditLog_platformAdminId_fkey'
    ) THEN
        ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_platformAdminId_fkey" FOREIGN KEY ("platformAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
