-- Enable pg_trgm extension for accelerated Persian/English trigram & fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1. Extend GameCatalog with bilingual titles, slug, category, normalizedKey, popularityScore
ALTER TABLE "GameCatalog" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "GameCatalog" ADD COLUMN IF NOT EXISTS "titleFa" TEXT;
ALTER TABLE "GameCatalog" ADD COLUMN IF NOT EXISTS "titleEn" TEXT;
ALTER TABLE "GameCatalog" ADD COLUMN IF NOT EXISTS "category" TEXT;
ALTER TABLE "GameCatalog" ADD COLUMN IF NOT EXISTS "normalizedKey" TEXT;
ALTER TABLE "GameCatalog" ADD COLUMN IF NOT EXISTS "popularityScore" INTEGER NOT NULL DEFAULT 0;

-- 2. Extend GamingCenterGame with center-specific allowed platforms
ALTER TABLE "GamingCenterGame"
  ADD COLUMN IF NOT EXISTS "platforms" "GameStationType"[] NOT NULL DEFAULT ARRAY[]::"GameStationType"[];

-- 3. Create GameAlias table for multi-language titles, abbreviations, and alternative names
CREATE TABLE IF NOT EXISTS "GameAlias" (
    "id" TEXT NOT NULL,
    "gameCatalogId" TEXT NOT NULL,
    "alias" TEXT NOT NULL,
    "normalized" TEXT NOT NULL,
    "locale" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameAlias_pkey" PRIMARY KEY ("id")
);

-- 4. Create GameStationGame table for station-level game support
CREATE TABLE IF NOT EXISTS "GameStationGame" (
    "id" TEXT NOT NULL,
    "stationId" TEXT NOT NULL,
    "gameCatalogId" TEXT NOT NULL,
    "playMode" "GamePlayMode" NOT NULL DEFAULT 'OFFLINE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameStationGame_pkey" PRIMARY KEY ("id")
);

-- 5. Safe non-destructive backfill for existing GameCatalog rows
UPDATE "GameCatalog"
SET
  "titleEn" = COALESCE("titleEn", "title"),
  "normalizedKey" = COALESCE(
    "normalizedKey",
    LOWER(REGEXP_REPLACE(TRIM("title"), '[^a-zA-Z0-9\u0600-\u06FF]+', '', 'g'))
  )
WHERE "titleEn" IS NULL OR "normalizedKey" IS NULL;

-- Generate collision-safe slugs for existing GameCatalog rows missing a slug
WITH ranked_slugs AS (
  SELECT
    "id",
    TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(TRIM("title"), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g'))) AS base_slug,
    ROW_NUMBER() OVER (
      PARTITION BY TRIM(BOTH '-' FROM LOWER(REGEXP_REPLACE(TRIM("title"), '[^a-zA-Z0-9\u0600-\u06FF]+', '-', 'g')))
      ORDER BY "createdAt" ASC, "id" ASC
    ) AS rn
  FROM "GameCatalog"
  WHERE "slug" IS NULL
)
UPDATE "GameCatalog" g
SET "slug" = CASE
  WHEN rs.base_slug = '' OR rs.base_slug IS NULL THEN 'game-' || LEFT(g."id", 10)
  WHEN rs.rn = 1 AND NOT EXISTS (SELECT 1 FROM "GameCatalog" existing WHERE existing."slug" = rs.base_slug) THEN rs.base_slug
  ELSE rs.base_slug || '-' || LEFT(g."id", 8)
END
FROM ranked_slugs rs
WHERE g."id" = rs."id" AND g."slug" IS NULL;

-- Backfill canonical alias for existing GameCatalog titles
INSERT INTO "GameAlias" ("id", "gameCatalogId", "alias", "normalized", "locale", "createdAt")
SELECT
  'alias_' || md5(g."id" || ':' || g."title"),
  g."id",
  g."title",
  LOWER(REGEXP_REPLACE(TRIM(g."title"), '[-_/.:,;!?()[\]{}''"]+', ' ', 'g')),
  NULL,
  CURRENT_TIMESTAMP
FROM "GameCatalog" g
WHERE TRIM(g."title") <> ''
ON CONFLICT ("gameCatalogId", "normalized") DO NOTHING;

-- Backfill GamingCenterGame links from legacy GamingCenter.games string array when exact title matches GameCatalog
INSERT INTO "GamingCenterGame" ("id", "gamingCenterId", "gameCatalogId", "playMode", "platforms", "createdAt", "updatedAt")
SELECT
  'gcg_' || md5(gc."id" || ':' || gcat."id"),
  gc."id",
  gcat."id",
  'OFFLINE'::"GamePlayMode",
  ARRAY[]::"GameStationType"[],
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "GamingCenter" gc
CROSS JOIN LATERAL unnest(gc."games") AS legacy_title
INNER JOIN "GameCatalog" gcat
  ON LOWER(TRIM(gcat."title")) = LOWER(TRIM(legacy_title))
ON CONFLICT ("gamingCenterId", "gameCatalogId") DO NOTHING;

-- 6. Foreign Keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameAlias_gameCatalogId_fkey') THEN
    ALTER TABLE "GameAlias"
      ADD CONSTRAINT "GameAlias_gameCatalogId_fkey"
      FOREIGN KEY ("gameCatalogId") REFERENCES "GameCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameStationGame_stationId_fkey') THEN
    ALTER TABLE "GameStationGame"
      ADD CONSTRAINT "GameStationGame_stationId_fkey"
      FOREIGN KEY ("stationId") REFERENCES "GameStation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GameStationGame_gameCatalogId_fkey') THEN
    ALTER TABLE "GameStationGame"
      ADD CONSTRAINT "GameStationGame_gameCatalogId_fkey"
      FOREIGN KEY ("gameCatalogId") REFERENCES "GameCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 7. Unique & B-tree Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "GameCatalog_slug_key" ON "GameCatalog"("slug");
CREATE INDEX IF NOT EXISTS "GameCatalog_normalizedKey_idx" ON "GameCatalog"("normalizedKey");
CREATE INDEX IF NOT EXISTS "GameCatalog_category_isActive_idx" ON "GameCatalog"("category", "isActive");
CREATE INDEX IF NOT EXISTS "GameCatalog_isActive_popularityScore_idx" ON "GameCatalog"("isActive", "popularityScore" DESC);

CREATE UNIQUE INDEX IF NOT EXISTS "GameAlias_gameCatalogId_normalized_key" ON "GameAlias"("gameCatalogId", "normalized");
CREATE INDEX IF NOT EXISTS "GameAlias_normalized_idx" ON "GameAlias"("normalized");
CREATE INDEX IF NOT EXISTS "GameAlias_gameCatalogId_idx" ON "GameAlias"("gameCatalogId");

CREATE UNIQUE INDEX IF NOT EXISTS "GameStationGame_stationId_gameCatalogId_key" ON "GameStationGame"("stationId", "gameCatalogId");
CREATE INDEX IF NOT EXISTS "GameStationGame_stationId_isActive_idx" ON "GameStationGame"("stationId", "isActive");
CREATE INDEX IF NOT EXISTS "GameStationGame_gameCatalogId_isActive_idx" ON "GameStationGame"("gameCatalogId", "isActive");

CREATE INDEX IF NOT EXISTS "Address_lat_lng_idx" ON "Address"("lat", "lng");
CREATE INDEX IF NOT EXISTS "GameStation_gamingCenterId_isActive_hourlyPrice_idx" ON "GameStation"("gamingCenterId", "isActive", "hourlyPrice");
CREATE INDEX IF NOT EXISTS "GameStation_gamingCenterId_isActive_isVip_idx" ON "GameStation"("gamingCenterId", "isActive", "isVip");

-- 8. Trigram GIN Indexes for fast ILIKE & fuzzy search on Persian/English text
CREATE INDEX IF NOT EXISTS "GamingCenter_name_trgm_idx" ON "GamingCenter" USING GIN ("name" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "GamingCenter_slug_trgm_idx" ON "GamingCenter" USING GIN ("slug" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Address_city_trgm_idx" ON "Address" USING GIN ("city" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Address_district_trgm_idx" ON "Address" USING GIN ("district" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "GameCatalog_title_trgm_idx" ON "GameCatalog" USING GIN ("title" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "GameCatalog_titleFa_trgm_idx" ON "GameCatalog" USING GIN ("titleFa" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "GameCatalog_titleEn_trgm_idx" ON "GameCatalog" USING GIN ("titleEn" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "GameAlias_normalized_trgm_idx" ON "GameAlias" USING GIN ("normalized" gin_trgm_ops);
