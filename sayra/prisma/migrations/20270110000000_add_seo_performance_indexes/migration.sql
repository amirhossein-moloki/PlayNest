-- Add composite and functional indexes for public listing, sitemap, and case-insensitive city lookups
CREATE INDEX IF NOT EXISTS "GamingCenter_isActive_verificationStatus_createdAt_idx"
  ON "GamingCenter" ("isActive", "verificationStatus", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "Address_lower_trim_city_idx"
  ON "Address" ((LOWER(TRIM("city"))));
