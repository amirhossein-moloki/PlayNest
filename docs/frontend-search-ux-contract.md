# PlayNest Frontend Search & Filter UX Integration Contract

> **Workspace Scope Note**: This workspace contains backend services (**Sayra** & **Blog**), **Platform Admin HTML/AdminJS panels**, and Nginx reverse-proxy templates (`docker/nginx/conf.d/app.conf.template`, where `/` currently renders a placeholder). No external Next.js/React public frontend repository is present in `/home/amir/github-projects/PlayNest`. This document defines the complete, API-backed UI/UX integration contract for the PlayNest public web & mobile frontend.

---

## 1. API Endpoints Consumed by Frontend

Both prefix styles are mounted and cache-enabled:
- **Search & Autocomplete**: `/api/public/search/suggest`, `/api/public/search/gamecenters`, `/api/public/search/games`
- **Public Discovery & Bookings**: `/api/public/gamecenters`, `/api/public/gamecenters/rankings`, `/api/public/gamecenters/:id`, `/api/public/gamingCenters/:slug/stations`, `/api/public/gamingCenters/:slug/availability/slots`

All responses wrap payloads in `{ success: true, data: ... }` and carry CDN-friendly `Cache-Control` headers.

---

## 2. Autocomplete & Typeahead UX (`/api/public/search/suggest`)

1. **Debouncing & Request Cancellation**:
   - Trigger `GET /api/public/search/suggest?q=<input>&city=<selectedCity>&limit=5` after **250ms debounce** when normalized input length is `>= 1` (minimum 2 characters recommended before auto-opening full dropdown on slow networks; `minLength: 1` is supported server-side).
   - Cancel stale in-flight requests using `AbortController` so rapid Persian/English typing never overwrites newer results with slower older responses.
2. **Grouped Suggestion Dropdown (RTL-first)**:
   Display 4 clear visual sections when non-empty:
   - **بازی‌ها (`data.games`)**: cover thumbnail (`coverImageUrl`), Persian/English title (`titleFa || title` + `titleEn` subtitle), supported platform badges (`PS5`, `PC`, ...), and active center count badge (`"در ۱۲ گیم‌نت"`). Clicking selects `gameId` / `game` filter and navigates/updates search!
   - **گیم‌نت‌ها (`data.gameCenters`)**: small cover photo (`coverUrl`), name, city + neighborhood, star rating (`ratingAverage`), green `"باز"` / muted `"بسته"` pill (`isOpenNow`), navigating directly to `detailUrl`.
   - **شهرها و محله‌ها (`data.locations.cities`, `data.locations.neighborhoods`)**: clicking applies `city` and/or `neighborhood` filter chips.
   - **دستگاه‌ها (`data.devices`)**: quick shortcut chips for `PC`, `PLAYSTATION 5`, `PLAYSTATION 4`, `XBOX`, `SWITCH`, `VR`.

---

## 3. Combined Filter State & URL Synchronization

Keep the entire filter state synchronized with URL search params (`URLSearchParams`) so browser Back/Forward, shareable search links, and page transitions preserve every filter:

| Control | Query Param(s) | Example |
| :--- | :--- | :--- |
| Free-text query | `q` | `q=گیم نت vip` |
| Selected Game | `gameId` (preferred from suggest) or `game` / `gameSlug` | `game=FC 26` |
| Location | `city`, `province`, `neighborhood` | `city=تهران&neighborhood=ونک` |
| Hardware | `deviceType` (comma-separated or repeated; accepts `PS5`, `PC`, `PLAYSTATION 5`) | `deviceType=PLAYSTATION 5,PC` |
| Amenities | `amenities` (`food_service`, `vip`, `online_booking`, `online_games`, `extra_controllers`) | `amenities=vip,online_booking` |
| Open Status | `isOpen=true` (or `status=open_now`) | `isOpen=true` |
| Playable Mode | `playMode` (`ONLINE` / `OFFLINE`) | `playMode=ONLINE` |
| Effective Price Range | `minPrice`, `maxPrice` (Tomans / IRT after active discounts) | `minPrice=50000&maxPrice=250000` |
| Rating | `minRating` (`0..5`) | `minRating=4` |
| Time Availability | `availableNow=true` OR (`date=YYYY-MM-DD&startTime=HH:mm&durationHours=2`) | `availableNow=true` |
| Geo Proximity | `lat`, `lng`, `radiusKm` | `lat=35.75&lng=51.41&radiusKm=10` |
| Sorting | `sort` (`relevance`, `bayesian`, `rating`, `reviews`, `price_asc`, `price_desc`, `distance`, `newest`) | `sort=relevance` |
| Pagination | `page`, `limit` (`page` resets to `1` whenever any filter changes; kept when navigating pages) | `page=2&limit=20` |

### Active Filter Chips & Facet Counts
- Render removable chips (`Chip ×`) above results for every active param (`game`, `city`, `neighborhood`, `deviceType`, `amenities`, `minPrice..maxPrice`, `minRating`, `isOpen`, `availableNow`) plus a `"حذف همه فیلترها"` button.
- Render dynamic result counts next to sidebar/drawer checkboxes from `data.facets` (`cities`, `deviceTypes`, `amenities`, `games`, `openNowCount`), and set price slider min/max bounds from `data.facets.priceRange`.
- Display total matched results header directly from `data.meta.total` (Persian numerals in UI: `"۲۴ گیم‌نت یافت شد"`).

---

## 4. Result Cards: Center + Game + Station Compatibility

When rendering each item from `data.data` (`SearchGameCenterItem`):
1. **Header & Status**:
   - Name, cover image, city/neighborhood badge, `distanceKm` badge when geo search is active (`"۲.۴ کیلومتر"`).
   - Live status badge derived from `activityStatus.isOpenNow` / `isTemporarilyClosed` (`"باز است"`, `"بسته موقت تا ..."`).
   - Rating summary (`rating.average` & `rating.validReviewsCount`), plus subtle `"جدید در پلی‌نست"` badge when `validReviewsCount === 0` so new centers look trustworthy without hiding them.
   - Pricing: show discounted `pricing.finalPrice` (and strikethrough `hourlyRate` + discount badge when `pricing.hasActiveDiscount` is true).
2. **Matched Games & Station Verification Strip (`item.matchedGames`)**:
   - Whenever a game filter (`q` matching a game, `game`, `gameId`, `gameSlug`) is active, display for each matched game:
     - Platforms supported at this center: `availablePlatforms` (`PLAYSTATION 5`, `PC`, ...).
     - Play mode badge: `ONLINE` / `OFFLINE`.
     - **Station-level expand/preview (`game.stations`)**: station name (`PS5 VIP 1`), hardware type, VIP badge, discounted `finalPrice`, active status (`isActive`), online reservation capability (`isBookable`), and slot availability indicator (`isAvailableInWindow`: green `"آماده رزرو"` when `true`, amber/gray `"تکمیل در این بازه"` when `false`).
   - Action CTA: `"مشاهده ایستگاه‌ها و رزرو"` (links to `item.detailUrl` carrying selected `gameId` / `date` / `startTime` so the center booking screen pre-highlights compatible stations).

---

## 5. Zero-Result State & Alternative Suggestions (`data.suggestions`)

Never render an empty dead-end screen when `data.data.length === 0`. Render an actionable recovery panel using `data.suggestions`:
- `DID_YOU_MEAN_GAME`: show `"آیا منظورتان بازی «<label>» بود؟"` button -> clicking sets `gameId = suggestedValue` and clears the mistyped text query.
- `RELAX_FILTER`: show `"حذف فیلتر ... (حدود X نتیجه)"` -> clicking removes `filterKey` (`isOpen`, `maxPrice`, `amenities`, `deviceType`, etc.).
- `NEARBY_CITY`: show `"نمایش گیم‌نت‌ها در <suggestedValue> (X مورد)"` -> clicking switches `city = suggestedValue` (or clears city filter).
- Fallback: `"پاک کردن فیلترها و نمایش بهترین گیم‌نت‌ها"` calling `sort=bayesian`.

---

## 6. Responsive Layout & Visual Alignment (PlayNest RTL)

- **Typography & Direction**: Full RTL (`dir="rtl"`), Vazirmatn / IRANSans font stack, Persian localized numbers for display with ASCII query params sent to APIs.
- **Desktop (`>= 1024px`)**: Sticky top search bar + autocomplete, left/right 280px sticky filter sidebar (`facets`), top sort & count bar, responsive 2–3 column card grid + optional split map view (consuming `geoLocation` coordinates from approved results).
- **Mobile (`< 1024px`)**: Compact sticky search bar + horizontal scrollable quick-filter chips (`باز است`, `PS5`, `VIP`, `رزرو آنلاین`, `ارزان‌ترین`), bottom-sheet `"فیلترها"` drawer with sticky `"اعمال فیلتر (N نتیجه)"` CTA, and single-column full-width cards with touch-friendly `44px+` tap targets.
