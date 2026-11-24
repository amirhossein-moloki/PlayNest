-- Additive Migration: Backend URL Shortener, Campaigns, Click Analytics & Domain Security Rules
-- Zero data loss / safe for live deployment and rollback.

-- 1. Enums
DO $$ BEGIN
  CREATE TYPE "ShortLinkStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ShortLinkOwnerType" AS ENUM ('PLATFORM', 'GAMING_CENTER', 'USER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ShortLinkTargetCategory" AS ENUM (
    'GAMING_CENTER',
    'GAME',
    'RESERVATION',
    'ADVERTISEMENT',
    'CAMPAIGN',
    'INVITE',
    'SOCIAL',
    'NOTIFICATION',
    'EXTERNAL',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ShortLinkClickClassification" AS ENUM ('VALID', 'DUPLICATE', 'BOT', 'SUSPICIOUS');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ShortLinkCampaignStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'ENDED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AllowedDomainRuleType" AS ENUM ('ALLOW', 'BLOCK');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. ShortLinkCampaign
CREATE TABLE IF NOT EXISTS "ShortLinkCampaign" (
  "id"               TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "slug"             TEXT NOT NULL,
  "description"      TEXT,
  "ownerType"        "ShortLinkOwnerType" NOT NULL DEFAULT 'PLATFORM',
  "gamingCenterId"   TEXT,
  "createdByUserId"  TEXT,
  "createdByAdminId" TEXT,
  "status"           "ShortLinkCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
  "adSource"         TEXT,
  "utmSource"        TEXT,
  "utmMedium"        TEXT,
  "utmCampaign"      TEXT,
  "utmTerm"          TEXT,
  "utmContent"       TEXT,
  "startsAt"         TIMESTAMPTZ(6),
  "endsAt"           TIMESTAMPTZ(6),
  "deletedAt"        TIMESTAMPTZ(6),
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShortLinkCampaign_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortLinkCampaign_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortLinkCampaign_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShortLinkCampaign_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortLinkCampaign_gamingCenterId_slug_key"
  ON "ShortLinkCampaign"("gamingCenterId", "slug");
CREATE UNIQUE INDEX IF NOT EXISTS "ShortLinkCampaign_global_slug_unique"
  ON "ShortLinkCampaign"("slug")
  WHERE "gamingCenterId" IS NULL AND "deletedAt" IS NULL;
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_gamingCenterId_status_idx"
  ON "ShortLinkCampaign"("gamingCenterId", "status");
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_ownerType_status_idx"
  ON "ShortLinkCampaign"("ownerType", "status");
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_startsAt_endsAt_idx"
  ON "ShortLinkCampaign"("startsAt", "endsAt");
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_createdByUserId_idx"
  ON "ShortLinkCampaign"("createdByUserId");
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_createdByAdminId_idx"
  ON "ShortLinkCampaign"("createdByAdminId");
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_deletedAt_idx"
  ON "ShortLinkCampaign"("deletedAt");
CREATE INDEX IF NOT EXISTS "ShortLinkCampaign_createdAt_idx"
  ON "ShortLinkCampaign"("createdAt");

-- 3. ShortLink
CREATE TABLE IF NOT EXISTS "ShortLink" (
  "id"                 TEXT NOT NULL,
  "code"               TEXT NOT NULL,
  "normalizedCode"     TEXT NOT NULL,
  "isCustomCode"       BOOLEAN NOT NULL DEFAULT false,
  "destinationUrl"     TEXT NOT NULL,
  "destinationHost"    TEXT NOT NULL,
  "title"              TEXT,
  "description"        TEXT,
  "targetCategory"     "ShortLinkTargetCategory" NOT NULL DEFAULT 'OTHER',
  "targetEntityId"     TEXT,
  "ownerType"          "ShortLinkOwnerType" NOT NULL DEFAULT 'PLATFORM',
  "gamingCenterId"     TEXT,
  "ownerUserId"        TEXT,
  "createdByUserId"    TEXT,
  "createdByAdminId"   TEXT,
  "campaignId"         TEXT,
  "utmSource"          TEXT,
  "utmMedium"          TEXT,
  "utmCampaign"        TEXT,
  "utmTerm"            TEXT,
  "utmContent"         TEXT,
  "appendUtmParams"    BOOLEAN NOT NULL DEFAULT true,
  "status"             "ShortLinkStatus" NOT NULL DEFAULT 'ACTIVE',
  "redirectStatusCode" INTEGER NOT NULL DEFAULT 302,
  "expiresAt"          TIMESTAMPTZ(6),
  "maxClicks"          INTEGER,
  "qrConfig"           JSONB,
  "metadata"           JSONB,
  "totalClicks"        INTEGER NOT NULL DEFAULT 0,
  "validClicks"        INTEGER NOT NULL DEFAULT 0,
  "uniqueClicks"       INTEGER NOT NULL DEFAULT 0,
  "duplicateClicks"    INTEGER NOT NULL DEFAULT 0,
  "botClicks"          INTEGER NOT NULL DEFAULT 0,
  "suspiciousClicks"   INTEGER NOT NULL DEFAULT 0,
  "lastClickedAt"      TIMESTAMPTZ(6),
  "deletedAt"          TIMESTAMPTZ(6),
  "createdAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShortLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortLink_gamingCenterId_fkey" FOREIGN KEY ("gamingCenterId") REFERENCES "GamingCenter"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortLink_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShortLink_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShortLink_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShortLink_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ShortLinkCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortLink_code_key" ON "ShortLink"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "ShortLink_normalizedCode_key" ON "ShortLink"("normalizedCode");
CREATE INDEX IF NOT EXISTS "ShortLink_gamingCenterId_status_createdAt_idx"
  ON "ShortLink"("gamingCenterId", "status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ShortLink_ownerUserId_status_idx"
  ON "ShortLink"("ownerUserId", "status");
CREATE INDEX IF NOT EXISTS "ShortLink_createdByUserId_idx"
  ON "ShortLink"("createdByUserId");
CREATE INDEX IF NOT EXISTS "ShortLink_createdByAdminId_idx"
  ON "ShortLink"("createdByAdminId");
CREATE INDEX IF NOT EXISTS "ShortLink_campaignId_status_idx"
  ON "ShortLink"("campaignId", "status");
CREATE INDEX IF NOT EXISTS "ShortLink_targetCategory_targetEntityId_idx"
  ON "ShortLink"("targetCategory", "targetEntityId");
CREATE INDEX IF NOT EXISTS "ShortLink_destinationHost_idx"
  ON "ShortLink"("destinationHost");
CREATE INDEX IF NOT EXISTS "ShortLink_status_expiresAt_idx"
  ON "ShortLink"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "ShortLink_deletedAt_idx"
  ON "ShortLink"("deletedAt");

-- 4. ShortLinkChangeLog
CREATE TABLE IF NOT EXISTS "ShortLinkChangeLog" (
  "id"                     TEXT NOT NULL,
  "shortLinkId"            TEXT NOT NULL,
  "action"                 TEXT NOT NULL,
  "actorType"              "SessionActorType" NOT NULL,
  "actorUserId"            TEXT,
  "actorAdminId"           TEXT,
  "previousDestinationUrl" TEXT,
  "newDestinationUrl"      TEXT,
  "changes"                JSONB,
  "ipHash"                 TEXT,
  "userAgent"              TEXT,
  "createdAt"              TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShortLinkChangeLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortLinkChangeLog_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ShortLinkChangeLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ShortLinkChangeLog_actorAdminId_fkey" FOREIGN KEY ("actorAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ShortLinkChangeLog_shortLinkId_createdAt_idx"
  ON "ShortLinkChangeLog"("shortLinkId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "ShortLinkChangeLog_actorUserId_idx"
  ON "ShortLinkChangeLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "ShortLinkChangeLog_actorAdminId_idx"
  ON "ShortLinkChangeLog"("actorAdminId");

-- 5. ShortLinkClick
CREATE TABLE IF NOT EXISTS "ShortLinkClick" (
  "id"              TEXT NOT NULL,
  "shortLinkId"     TEXT NOT NULL,
  "campaignId"      TEXT,
  "gamingCenterId"  TEXT,
  "clickedAt"       TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "classification"  "ShortLinkClickClassification" NOT NULL DEFAULT 'VALID',
  "isUniqueVisitor" BOOLEAN NOT NULL DEFAULT false,
  "visitorHash"     TEXT NOT NULL,
  "deviceType"      TEXT NOT NULL DEFAULT 'unknown',
  "os"              TEXT NOT NULL DEFAULT 'unknown',
  "browser"         TEXT NOT NULL DEFAULT 'unknown',
  "countryCode"     TEXT,
  "region"          TEXT,
  "referrer"        TEXT,
  "referrerDomain"  TEXT,
  "trafficSource"   TEXT NOT NULL DEFAULT 'direct',
  "utmSource"       TEXT,
  "utmMedium"       TEXT,
  "utmCampaign"     TEXT,
  "utmTerm"         TEXT,
  "utmContent"      TEXT,
  "botReason"       TEXT,

  CONSTRAINT "ShortLinkClick_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortLinkClick_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "ShortLinkClick_shortLinkId_clickedAt_idx"
  ON "ShortLinkClick"("shortLinkId", "clickedAt" DESC);
CREATE INDEX IF NOT EXISTS "ShortLinkClick_shortLinkId_classification_clickedAt_idx"
  ON "ShortLinkClick"("shortLinkId", "classification", "clickedAt" DESC);
CREATE INDEX IF NOT EXISTS "ShortLinkClick_campaignId_clickedAt_idx"
  ON "ShortLinkClick"("campaignId", "clickedAt" DESC);
CREATE INDEX IF NOT EXISTS "ShortLinkClick_gamingCenterId_clickedAt_idx"
  ON "ShortLinkClick"("gamingCenterId", "clickedAt" DESC);
CREATE INDEX IF NOT EXISTS "ShortLinkClick_shortLinkId_visitorHash_clickedAt_idx"
  ON "ShortLinkClick"("shortLinkId", "visitorHash", "clickedAt");
CREATE INDEX IF NOT EXISTS "ShortLinkClick_clickedAt_idx"
  ON "ShortLinkClick"("clickedAt");

-- 6. ShortLinkDailyStat
CREATE TABLE IF NOT EXISTS "ShortLinkDailyStat" (
  "id"               TEXT NOT NULL,
  "shortLinkId"      TEXT NOT NULL,
  "date"             DATE NOT NULL,
  "totalClicks"      INTEGER NOT NULL DEFAULT 0,
  "validClicks"      INTEGER NOT NULL DEFAULT 0,
  "uniqueClicks"     INTEGER NOT NULL DEFAULT 0,
  "duplicateClicks"  INTEGER NOT NULL DEFAULT 0,
  "botClicks"        INTEGER NOT NULL DEFAULT 0,
  "suspiciousClicks" INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShortLinkDailyStat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortLinkDailyStat_shortLinkId_fkey" FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortLinkDailyStat_shortLinkId_date_key"
  ON "ShortLinkDailyStat"("shortLinkId", "date");
CREATE INDEX IF NOT EXISTS "ShortLinkDailyStat_date_idx"
  ON "ShortLinkDailyStat"("date");

-- 7. ShortLinkDomainRule
CREATE TABLE IF NOT EXISTS "ShortLinkDomainRule" (
  "id"                TEXT NOT NULL,
  "domain"            TEXT NOT NULL,
  "ruleType"          "AllowedDomainRuleType" NOT NULL DEFAULT 'ALLOW',
  "includeSubdomains" BOOLEAN NOT NULL DEFAULT true,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "description"       TEXT,
  "createdByAdminId"  TEXT,
  "createdAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShortLinkDomainRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShortLinkDomainRule_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "PlatformAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "ShortLinkDomainRule_domain_key"
  ON "ShortLinkDomainRule"("domain");
CREATE INDEX IF NOT EXISTS "ShortLinkDomainRule_ruleType_isActive_idx"
  ON "ShortLinkDomainRule"("ruleType", "isActive");
CREATE INDEX IF NOT EXISTS "ShortLinkDomainRule_createdByAdminId_idx"
  ON "ShortLinkDomainRule"("createdByAdminId");

-- 8. Connect AdvertisementRequest to ShortLink cleanly (nullable, preserves existing data)
ALTER TABLE "AdvertisementRequest" ADD COLUMN IF NOT EXISTS "shortLinkId" TEXT;
CREATE INDEX IF NOT EXISTS "AdvertisementRequest_shortLinkId_idx"
  ON "AdvertisementRequest"("shortLinkId");
DO $$ BEGIN
  ALTER TABLE "AdvertisementRequest"
    ADD CONSTRAINT "AdvertisementRequest_shortLinkId_fkey"
    FOREIGN KEY ("shortLinkId") REFERENCES "ShortLink"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
