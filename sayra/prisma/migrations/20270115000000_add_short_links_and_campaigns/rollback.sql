-- Rollback Migration: Safely reverses 20270115000000_add_short_links_and_campaigns without affecting existing tables/rows.

-- 1. Remove AdvertisementRequest -> ShortLink foreign key and column
ALTER TABLE "AdvertisementRequest" DROP CONSTRAINT IF EXISTS "AdvertisementRequest_shortLinkId_fkey";
DROP INDEX IF EXISTS "AdvertisementRequest_shortLinkId_idx";
ALTER TABLE "AdvertisementRequest" DROP COLUMN IF EXISTS "shortLinkId";

-- 2. Drop new short-link tables in reverse dependency order
DROP TABLE IF EXISTS "ShortLinkDomainRule";
DROP TABLE IF EXISTS "ShortLinkDailyStat";
DROP TABLE IF EXISTS "ShortLinkClick";
DROP TABLE IF EXISTS "ShortLinkChangeLog";
DROP TABLE IF EXISTS "ShortLink";
DROP TABLE IF EXISTS "ShortLinkCampaign";

-- 3. Drop enums added by this migration
DROP TYPE IF EXISTS "AllowedDomainRuleType";
DROP TYPE IF EXISTS "ShortLinkCampaignStatus";
DROP TYPE IF EXISTS "ShortLinkClickClassification";
DROP TYPE IF EXISTS "ShortLinkTargetCategory";
DROP TYPE IF EXISTS "ShortLinkOwnerType";
DROP TYPE IF EXISTS "ShortLinkStatus";
