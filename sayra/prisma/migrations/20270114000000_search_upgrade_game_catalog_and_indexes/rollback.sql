-- Rollback script for 20270114000000_search_upgrade_game_catalog_and_indexes
-- Non-destructive to existing GamingCenter.games arrays and core GamingCenter/GameCatalog records.

-- 1. Drop trigram GIN indexes
DROP INDEX IF EXISTS "GameAlias_normalized_trgm_idx";
DROP INDEX IF EXISTS "GameCatalog_titleEn_trgm_idx";
DROP INDEX IF EXISTS "GameCatalog_titleFa_trgm_idx";
DROP INDEX IF EXISTS "GameCatalog_title_trgm_idx";
DROP INDEX IF EXISTS "Address_district_trgm_idx";
DROP INDEX IF EXISTS "Address_city_trgm_idx";
DROP INDEX IF EXISTS "GamingCenter_slug_trgm_idx";
DROP INDEX IF EXISTS "GamingCenter_name_trgm_idx";

-- 2. Drop added B-tree indexes on Address and GameStation
DROP INDEX IF EXISTS "GameStation_gamingCenterId_isActive_isVip_idx";
DROP INDEX IF EXISTS "GameStation_gamingCenterId_isActive_hourlyPrice_idx";
DROP INDEX IF EXISTS "Address_lat_lng_idx";

-- 3. Drop GameStationGame and GameAlias tables
DROP TABLE IF EXISTS "GameStationGame";
DROP TABLE IF EXISTS "GameAlias";

-- 4. Drop added columns on GamingCenterGame and GameCatalog
ALTER TABLE "GamingCenterGame" DROP COLUMN IF EXISTS "platforms";

DROP INDEX IF EXISTS "GameCatalog_isActive_popularityScore_idx";
DROP INDEX IF EXISTS "GameCatalog_category_isActive_idx";
DROP INDEX IF EXISTS "GameCatalog_normalizedKey_idx";
DROP INDEX IF EXISTS "GameCatalog_slug_key";

ALTER TABLE "GameCatalog" DROP COLUMN IF EXISTS "popularityScore";
ALTER TABLE "GameCatalog" DROP COLUMN IF EXISTS "normalizedKey";
ALTER TABLE "GameCatalog" DROP COLUMN IF EXISTS "category";
ALTER TABLE "GameCatalog" DROP COLUMN IF EXISTS "titleEn";
ALTER TABLE "GameCatalog" DROP COLUMN IF EXISTS "titleFa";
ALTER TABLE "GameCatalog" DROP COLUMN IF EXISTS "slug";
