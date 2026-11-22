-- Split legacy PLAYSTATION enum member into 'PLAYSTATION 4' and 'PLAYSTATION 5'

-- 1. Create new enum type with exact labels
CREATE TYPE "GameStationType_new" AS ENUM (
  'PC',
  'PLAYSTATION 4',
  'PLAYSTATION 5',
  'XBOX',
  'SWITCH',
  'VR'
);

-- 2. Drop column defaults that reference the old enum type
ALTER TABLE "DeviceType" ALTER COLUMN "category" DROP DEFAULT;
ALTER TABLE "DeviceCatalog" ALTER COLUMN "deviceType" DROP DEFAULT;
ALTER TABLE "GameCatalog" ALTER COLUMN "supportedPlatforms" DROP DEFAULT;
ALTER TABLE "GameStation" ALTER COLUMN "stationType" DROP DEFAULT;
ALTER TABLE "DiscountCampaign" ALTER COLUMN "applicableDeviceTypes" DROP DEFAULT;
ALTER TABLE "AnalyticsStation" ALTER COLUMN "stationType" DROP DEFAULT;

-- 3. Alter all columns using GameStationType (no subqueries allowed inside USING)
ALTER TABLE "DeviceType"
  ALTER COLUMN "category" TYPE "GameStationType_new"
  USING (
    CASE
      WHEN "category"::text = 'PLAYSTATION' THEN 'PLAYSTATION 5'::"GameStationType_new"
      ELSE "category"::text::"GameStationType_new"
    END
  );

ALTER TABLE "DeviceCatalog"
  ALTER COLUMN "deviceType" TYPE "GameStationType_new"
  USING (
    CASE
      WHEN "deviceType"::text = 'PLAYSTATION' THEN
        CASE
          WHEN "name" LIKE '%۴%' OR "name" LIKE '%4%' OR lower("name") LIKE '%ps4%'
            THEN 'PLAYSTATION 4'::"GameStationType_new"
          ELSE 'PLAYSTATION 5'::"GameStationType_new"
        END
      ELSE "deviceType"::text::"GameStationType_new"
    END
  );

ALTER TABLE "GameStation"
  ALTER COLUMN "stationType" TYPE "GameStationType_new"
  USING (
    CASE
      WHEN "stationType"::text = 'PLAYSTATION' THEN
        CASE
          WHEN lower("name") LIKE '%ps4%' THEN 'PLAYSTATION 4'::"GameStationType_new"
          ELSE 'PLAYSTATION 5'::"GameStationType_new"
        END
      ELSE "stationType"::text::"GameStationType_new"
    END
  );

ALTER TABLE "GameCatalog"
  ALTER COLUMN "supportedPlatforms" TYPE "GameStationType_new"[]
  USING (
    CASE
      WHEN "supportedPlatforms" IS NULL THEN NULL
      WHEN cardinality("supportedPlatforms") = 0 THEN ARRAY[]::"GameStationType_new"[]
      ELSE array_replace("supportedPlatforms"::text[], 'PLAYSTATION', 'PLAYSTATION 5')::"GameStationType_new"[]
    END
  );

ALTER TABLE "DiscountCampaign"
  ALTER COLUMN "applicableDeviceTypes" TYPE "GameStationType_new"[]
  USING (
    CASE
      WHEN "applicableDeviceTypes" IS NULL THEN NULL
      WHEN cardinality("applicableDeviceTypes") = 0 THEN ARRAY[]::"GameStationType_new"[]
      ELSE array_replace("applicableDeviceTypes"::text[], 'PLAYSTATION', 'PLAYSTATION 5')::"GameStationType_new"[]
    END
  );

ALTER TABLE "AnalyticsStation"
  ALTER COLUMN "stationType" TYPE "GameStationType_new"
  USING (
    CASE
      WHEN "stationType"::text = 'PLAYSTATION' THEN 'PLAYSTATION 5'::"GameStationType_new"
      ELSE "stationType"::text::"GameStationType_new"
    END
  );

-- 4. Swap old enum type out and rename new enum type into place
DROP TYPE "GameStationType";
ALTER TYPE "GameStationType_new" RENAME TO "GameStationType";

-- 5. Restore column defaults
ALTER TABLE "DeviceType" ALTER COLUMN "category" SET DEFAULT 'PC'::"GameStationType";
ALTER TABLE "DeviceCatalog" ALTER COLUMN "deviceType" SET DEFAULT 'PC'::"GameStationType";
ALTER TABLE "GameCatalog" ALTER COLUMN "supportedPlatforms" SET DEFAULT ARRAY['PC']::"GameStationType"[];
ALTER TABLE "GameStation" ALTER COLUMN "stationType" SET DEFAULT 'PC'::"GameStationType";
ALTER TABLE "DiscountCampaign" ALTER COLUMN "applicableDeviceTypes" SET DEFAULT ARRAY[]::"GameStationType"[];
ALTER TABLE "AnalyticsStation" ALTER COLUMN "stationType" SET DEFAULT 'PC'::"GameStationType";

-- 6. Post-swap data alignment
-- 6a. Align GameStation rows linked to PLAYSTATION 4 DeviceCatalog items
UPDATE "GameStation" gs
SET "stationType" = 'PLAYSTATION 4'::"GameStationType"
FROM "DeviceCatalog" dc
WHERE gs."catalogDeviceId" = dc."id"
  AND dc."deviceType" = 'PLAYSTATION 4'::"GameStationType"
  AND gs."stationType" = 'PLAYSTATION 5'::"GameStationType";

-- 6b. Align cross-gen GameCatalog entries (keep PS5-only/next-gen titles on PLAYSTATION 5 only)
UPDATE "GameCatalog"
SET "supportedPlatforms" = array_append("supportedPlatforms", 'PLAYSTATION 4'::"GameStationType")
WHERE 'PLAYSTATION 5'::"GameStationType" = ANY("supportedPlatforms")
  AND NOT ('PLAYSTATION 4'::"GameStationType" = ANY("supportedPlatforms"))
  AND lower("title") !~ '(spider.*man\s*2|gta\s*vi|taken\s*8|tekken\s*8)';

-- 6c. Align DiscountCampaign rows containing PLAYSTATION 5
UPDATE "DiscountCampaign"
SET "applicableDeviceTypes" = array_append("applicableDeviceTypes", 'PLAYSTATION 4'::"GameStationType")
WHERE 'PLAYSTATION 5'::"GameStationType" = ANY("applicableDeviceTypes")
  AND NOT ('PLAYSTATION 4'::"GameStationType" = ANY("applicableDeviceTypes"));

-- 6d. Split DeviceType 'PlayStation' into 'PLAYSTATION 5' and ensure 'PLAYSTATION 4' exists
UPDATE "DeviceType"
SET
  "name" = 'PLAYSTATION 5',
  "slug" = 'playstation-5',
  "category" = 'PLAYSTATION 5'::"GameStationType",
  "extraControllerEnabled" = true,
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "category" = 'PLAYSTATION 5'::"GameStationType"
  AND (lower("slug") = 'playstation' OR lower("name") = 'playstation');

INSERT INTO "DeviceType" (
  "id",
  "name",
  "slug",
  "category",
  "isActive",
  "extraControllerEnabled",
  "createdAt",
  "updatedAt"
)
SELECT
  'dt_playstation_4',
  'PLAYSTATION 4',
  'playstation-4',
  'PLAYSTATION 4'::"GameStationType",
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "DeviceType" WHERE "category" = 'PLAYSTATION 4'::"GameStationType"
);
