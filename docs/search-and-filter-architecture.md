# PlayNest Search & Filter System Architecture

> Last updated: 2026-11-24  
> Scope: Sayra (Node.js/TypeScript/Prisma/PostgreSQL/Redis), Blog (Django/DRF/PostgreSQL/Redis), AdminJS & Platform Admin UI, OpenAPI 3.0 contracts.

---

## 1. Current-State Audit Findings (Before Redesign)

An end-to-end audit across **Sayra**, **Blog**, **Nginx**, and **Prisma schemas** identified the following critical architectural, correctness, and security defects:

1. **No Game-to-Center/Station Verification in Search**:
   - `GET /api/public/gamecenters` had no `game` filter at all.
   - `GET /api/v1/gamingCenters` matched `game` loosely against legacy `GamingCenter.games` string arrays or unnormalized substrings without verifying an active `GameCatalog` entry, active `GamingCenterGame`, compatible hardware `GameStation`, or station-level `GameStationGame` support.
2. **Public Visibility & Activity Bypass in `GET /api/v1/gamingCenters`**:
   - Public callers could pass `verificationStatus` or `isActive` query params to bypass the public `APPROVED + isActive=true` boundary.
3. **Post-Pagination Memory Filtering & Broken Totals (`GET /api/v1/gamingCenters`)**:
   - `isOpen` and `minStationCount` were evaluated in JavaScript *after* Prisma `skip`/`take`, producing under-filled pages and inflated `total` / `totalPages`.
4. **Incorrect `minRating` and Price Filter Semantics**:
   - `minRating` used `ratings: { some: { rating: { gte } } }`, returning any center with *a single* high review even when its true average was low.
   - `minHourlyRate` / `maxHourlyRate` queried scalar `GamingCenter.hourlyRate` only, ignoring station pricing and active `GamingCenterDiscount` / `PlatformCampaign` effective prices.
5. **`checkIsOpen` Ignored Schedules, Closed Days, Overnight Tails & Closures**:
   - Checked `openingTime`/`closingTime` naively without `GamingCenterSchedule`, `closedDays`, post-midnight overnight shift tails, or active `GamingCenterClosure` records.
6. **Zod Boolean Coercion Trap (`z.coerce.boolean()`)**:
   - `z.coerce.boolean()` coerced `"false"` -> `Boolean("false") === true`, affecting `isVip` in `station.validator.ts` and `isActive` in `cms/media.validators.ts` and `query.validators.ts`.
7. **Persian / Arabic / ZWNJ / Typo Mismatch**:
   - Arabic `ي`/`ك`/`ة`/`أ`/`إ`/`آ`, Persian/Arabic-Indic digits (`۰-۹`, `٠-٩`), ZWNJ (`\u200c`), and common typos (`فیفا ۲۶` vs `فيفا 26`, `FC 26` vs `fc26`, `پلی‌استیشن` vs `پلی استیشن`) failed to match across Sayra and Blog.
8. **Blog Security & Filter Defects**:
   - `ArticleViewSet.get_queryset` did not enforce `visibility="public"` on unauthenticated `list`, `similar`, `same-category`, or `related_articles`, allowing guests to read `private`/`unlisted` items.
   - `ArticleFilter.filter_is_hot` ignored editorial `Article.is_hot=True`.
   - `ArticleCreateUpdateSerializer.slug` lacked `allow_unicode=True`, rejecting Persian slugs.
   - `CategoryViewSet`, `TagViewSet`, and `SeriesViewSet` lacked normalized search and search-aware cache keys.
9. **Frontend Repository Boundary & Short Links**:
   - Zero-cost short-link audit confirmed no URL shortener exists anywhere in the repo.
   - No standalone public web frontend repository exists in this workspace (`docker/nginx/conf.d/app.conf.template` serves a placeholder on `/`). The public frontend search UX contract is specified in [frontend-search-ux-contract.md](./frontend-search-ux-contract.md), while internal AdminJS & Platform Admin HTML panels were upgraded directly.

---

## 2. Database & Catalog Architecture (`GameCatalog`, `GameAlias`, `GameStationGame`)

Implemented in [sayra/prisma/schema.prisma](../sayra/prisma/schema.prisma) and forward/rollback SQL migrations:
- Forward migration: [migration.sql](../sayra/prisma/migrations/20270114000000_search_upgrade_game_catalog_and_indexes/migration.sql)
- Safe non-destructive rollback: [rollback.sql](../sayra/prisma/migrations/20270114000000_search_upgrade_game_catalog_and_indexes/rollback.sql)
- Seed/backfill script: [backfill-game-catalog.ts](../sayra/scripts/backfill-game-catalog.ts) (`npm run backfill:game-catalog`)

### Key Schema Additions
- **`GameCatalog`**: `slug` (unique), `titleFa`, `titleEn`, `category`, `normalizedKey`, `popularityScore` (default `0`).
- **`GameAlias`**: `(gameCatalogId, alias, normalized, locale)` with unique constraint `(gameCatalogId, normalized)` and GIN `pg_trgm` + B-tree indexes.
- **`GameStationGame`**: explicit station-level association `(stationId, gameCatalogId, playMode, isActive)` so individual PCs/PS5s can declare or restrict specific games.
- **`GamingCenterGame.platforms`**: `GameStationType[]` allowing a center to scope a game to specific hardware platforms (falling back to station/catalog platform intersection when unspecified).
- **Performance Indexes**: PostgreSQL `pg_trgm` GIN indexes on `GameCatalog`, `GameAlias`, `GamingCenter`, and `Address` (`city`, `district`, `province`), plus composite B-tree indexes on `Address (latitude, longitude)` and `GameStation (gamingCenterId, isActive, stationType, hourlyPrice)`.

### Strict Game Verification Rule (No Free-Text False Positives)
A gaming center matches a game query **only** when:
1. The query resolves to one or more active `GameCatalog` records (by ID, slug, bilingual title, or normalized `GameAlias`), **and**
2. The center has an active `GamingCenterGame` record (or legacy `games` link bridged during backfill) AND at least one **active `GameStation`** supporting that game either:
   - Explicitly via an active `GameStationGame` mapping for `(stationId, gameCatalogId)`, **or**
   - Implicitly via platform compatibility when the station has no restrictive explicit game list and `station.stationType` is in the allowed platforms `(centerGame.platforms || game.supportedPlatforms)`.
Mentioning a game name inside `GamingCenter.description` or `GamingCenter.name` alone **never** qualifies a center as supporting that game in game searches.

### Platform Admin Duplicate Management & Merge
- `GET /api/v1/platform-admin/catalog/games/duplicates`: groups active games sharing a `normalizedKey` or normalized `GameAlias`.
- `POST /api/v1/platform-admin/catalog/games/merge`: atomically merges source games into a canonical `targetGameId` inside `prisma.$transaction`, migrating `GamingCenterGame`, `GameStationGame`, legacy `GamingCenter.games[]`, merging `supportedPlatforms` and aliases, and optionally deactivating (`deactivateSources: true`) or deleting sources, followed by cache invalidation.
- `PUT /api/v1/platform-admin/catalog/games/:id/aliases`: replaces custom aliases cleanly while preserving canonical titles.

---

## 3. Text Normalization, Matching, Operating Hours & Availability

### Bilingual Text & Typo Engine ([searchText.ts](../sayra/src/common/utils/searchText.ts))
- **`normalizeSearchText`**: maps Arabic `ي/ى/ئ -> ی`, `ك -> ک`, `ة/ۀ -> ه`, `أ/إ/آ -> ا`, `ؤ -> و`, strips tashkeel/tatweel, converts Persian (`۰-۹`) and Arabic-Indic (`٠-٩`) digits to ASCII `0-9`, converts ZWNJ (`\u200c`) and punctuation to single spaces, and lowercases Latin characters.
- **`toCompactSearchKey`**: spaceless key aligning `FC 26` <-> `fc26`, `GTA 5` <-> `gta5`, `گیم نت` <-> `گیم‌نت` <-> `گیمنت`.
- **`scoreTextMatch`**: tiered exact (`100`) / compact (`95`) / prefix (`90`) / whole-word (`86`) / substring (`76`) / guarded fuzzy (`50..66`). **Guarded fuzzy matching** enforces `compactQuery.length >= 4`, length-ratio `>= 0.5`, Damerau-Levenshtein edit distance `<= 1` (len 4–6) or `<= 2` (len >= 7), or 3-gram Dice similarity `>= 0.45`. Short queries (`< 4` chars like `"vr"`, `"pc"`, `"fc"`) never trigger loose fuzzy matches.
- **Coordinate Safety**: `isValidCoordinatePair` rejects nulls, `NaN`, out-of-range values, and placeholder `(0, 0)` coordinates; `getGeoBoundingBox` + `calculateHaversineDistanceKm` provide accurate radius filtering & distances.
- **Search Device Aliases**: `parseSearchDeviceAlias` maps friendly query terms (`ps5`, `پی اس ۵`, `playstation 5`, `xbox`, `vr`, `pc`) to `GameStationType` solely in public search/filter validators while keeping CRUD `station-type.ts` strict.

### Schedule & Closure Engine ([operatingHours.ts](../sayra/src/common/utils/operatingHours.ts))
- **`evaluateCenterOpenStatus`**: single shared evaluator used across `/api/public/search/*`, `/api/public/gamecenters`, and `/api/v1/gamingCenters`. Evaluates timezone-aware local time (`Asia/Tehran` default via `resolveValidTimeZone`), active `GamingCenterClosure` windows, per-day `GamingCenterSchedule` overrides, `closedDays`, 24-hour schedules (`opening === closing` or `00:00`–`24:00`), overnight shifts (`14:00`–`02:00`), and post-midnight tails from the previous day's overnight shift.
- **`isIntervalWithinOperatingHours`**: validates arbitrary `[startTime, endTime)` slot search windows cleanly.

### Batched Availability Filtering (`search.service.ts`)
When `availableNow=true` or `date` + `startTime` + `durationHours` is requested, candidate stations' conflicts are queried in **3 batched DB queries total** (`Reservation`, active `BookingHold`, `StationMaintenance`) rather than N+1 per-center queries.

---

## 4. Ranking Formula & Public Discovery Unification

### Multi-Factor Relevance + New-Center-Safe Credibility ([search.ranking.ts](../sayra/src/modules/search/search.ranking.ts))
`computeSearchRelevanceScore` computes a transparent breakdown in `[0, 100]`:
- **Text match (`0..30`)**: normalized center/slug/city/district/address match.
- **Game support (`0..25`)**: catalog/alias match score (`0..20`) + `+5` online play bonus when `playMode=ONLINE` is supported.
- **Device compatibility (`0..10`)**: proportion/presence of active matching stations.
- **Location / Geo proximity (`0..10`)**: Haversine decay over `radiusKm * 1.25`, or city/neighborhood/province text match.
- **Bayesian credibility (`0..15`)**: uses center `bayesianScore` when `validReviewsCount > 0`, and falls back to `globalAverageC` (prior `3.5`) when `validReviewsCount === 0`, guaranteeing newly registered centers with zero reviews remain discoverable rather than dropping to the bottom.
- **Operational readiness (`0..10`)**: `+4` open now + `+3` online booking enabled + `+3` available matching station in checked window.

### Unified Public Endpoints ([search.routes.ts](../sayra/src/modules/search/search.routes.ts))
- `GET /api/public/search/gamecenters` (also `/api/v1/public/search/gamecenters`): combined search, game/station details, `availabilitySummary`, `facets` (`cities`, `deviceTypes`, `amenities`, `games`, `priceRange`, `openNowCount`), and `suggestions` (`DID_YOU_MEAN_GAME`, `RELAX_FILTER`, `NEARBY_CITY`).
- `GET /api/public/search/suggest`: grouped typeahead across bilingual games, active approved gaming centers, cities/neighborhoods, and hardware devices.
- `GET /api/public/search/games`: catalog search with active center counts.
- `GET /api/v1/gamingCenters` & `GET /api/public/gamecenters`: upgraded to share normalized text variants, catalog game resolution, effective discounted station pricing, real `rating.groupBy` averages, `evaluateCenterOpenStatus`, valid coordinate filtering, accurate pre-pagination counts, and enforced `isActive=true, verificationStatus=APPROVED` security locks.

---

## 5. Caching, Concurrency & Security

- **In-Process Singleflight (`withPublicCache` in [publicCache.ts](../sayra/src/common/utils/publicCache.ts))**: deduplicates concurrent cold cache rebuilds under identical keys via an `inFlight` promise map, eliminating stampedes alongside Redis TTLs (`20s` for time-sensitive `isOpen`/`availableNow` queries, `60s` for general searches).
- **Versioned Game Index Cache**: `gameIndex.service.ts` caches active catalog games + aliases in memory and Redis keyed by `getGameIndexVersion()`. All catalog, station-game, center, discount, closure, schedule, and review mutations invoke `invalidateAllPublicDiscoveryCaches()`.
- **Validation & Data Protection**: Zod schemas strictly validate prices (`minPrice <= maxPrice`), coordinates (incomplete or `(0, 0)` return `400`), boolean parsing (`parseOptionalBoolean()`), and explicit public DTO projection ensures private fields (`ownerId`, `phone`, `email`, `commissionRate`, `passwordHash`) are never returned.

---

## 6. Verification Status

*(Updated upon completion of final verification runs — see Section 6 once test suite results are recorded.)*
