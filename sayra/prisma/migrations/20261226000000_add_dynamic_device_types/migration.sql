-- CreateTable DeviceType
CREATE TABLE IF NOT EXISTS "DeviceType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "category" "GameStationType" NOT NULL DEFAULT 'PC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceType_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceType_name_key" ON "DeviceType"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "DeviceType_slug_key" ON "DeviceType"("slug");
CREATE INDEX IF NOT EXISTS "DeviceType_isActive_idx" ON "DeviceType"("isActive");
CREATE INDEX IF NOT EXISTS "DeviceType_category_idx" ON "DeviceType"("category");

-- Add deviceTypeId to DeviceCatalog
ALTER TABLE "DeviceCatalog" ADD COLUMN IF NOT EXISTS "deviceTypeId" TEXT;
CREATE INDEX IF NOT EXISTS "DeviceCatalog_deviceTypeId_idx" ON "DeviceCatalog"("deviceTypeId");

-- Add foreign key constraint for DeviceCatalog -> DeviceType
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'DeviceCatalog_deviceTypeId_fkey'
    ) THEN
        ALTER TABLE "DeviceCatalog" ADD CONSTRAINT "DeviceCatalog_deviceTypeId_fkey"
            FOREIGN KEY ("deviceTypeId") REFERENCES "DeviceType"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Add deviceTypeId to GameStation
ALTER TABLE "GameStation" ADD COLUMN IF NOT EXISTS "deviceTypeId" TEXT;
CREATE INDEX IF NOT EXISTS "GameStation_deviceTypeId_idx" ON "GameStation"("deviceTypeId");

-- Add foreign key constraint for GameStation -> DeviceType
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'GameStation_deviceTypeId_fkey'
    ) THEN
        ALTER TABLE "GameStation" ADD CONSTRAINT "GameStation_deviceTypeId_fkey"
            FOREIGN KEY ("deviceTypeId") REFERENCES "DeviceType"("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
