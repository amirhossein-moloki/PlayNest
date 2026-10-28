# CMS, Public Site, SEO

This document covers the CMS models and routes in the current codebase.

## Data Model Overview

### Page Builder

- `GamingCenterPage` stores page metadata, SEO fields, and status.
- `GamingCenterPageSection` stores structured JSON content in `dataJson` (validated per `PageSectionType`).
- `GamingCenterPageSlugHistory` records old slugs for 301 redirects.

### Media / Links / Addresses

- `GamingCenterMedia` stores assets with `purpose` (e.g., `LOGO`, `GALLERY`) and optional SEO `altText`.
- `GamingCenterLink` stores social/contact links.
- `GamingCenterAddress` stores address information and geo coordinates.

### Site-wide SEO

- `GamingCenterSiteSettings` holds defaults such as `defaultSeoTitle`, `defaultOgImageUrl`, robots settings, and analytics fields.

## Private CMS Routes (Manager Only)

Mounted under `/api/v1/gamingCenters/:gamingCenterId`.

### Pages

- `GET /pages` — list pages with optional filters (`status`, `type`, `limit`, `offset`).
- `GET /pages/:pageId` — fetch a single page.
- `POST /pages` — create page with required `sections[]`.
- `PATCH /pages/:pageId` — update page fields and optional sections.

Key validation details (`pages.validators.ts`):

- `slug` must be lowercase and URL safe.
- `canonicalPath` must begin with `/`.
- `sections[].dataJson` is validated per `PageSectionType` via `validateSectionData`.

### Media

- `POST /media` — create media.
- `PATCH /media/:mediaId` — update media.
- `altText` is required for `LOGO` and `COVER` purposes.

### Links & Addresses

- All private routes currently return `501` placeholders.

### Site Settings

- `GET /site-settings`
- `PUT /site-settings` — partial updates; at least one field required.

## CMS Admin UI (HTML)

- `GET /api/v1/admin/gamingCenters/:gamingCenterId/pages` returns a static HTML admin interface.
- No auth middleware is applied in the route definition.

## Public CMS Routes

Mounted under `/api/v1/public/gamingCenters/:gamingCenterSlug`.

- `GET /pages/:pageSlug`
  - Returns HTML for published pages.
  - Uses `ETag`/`Last-Modified` and handles 304 responses.
  - Redirects (301) if slug exists in `GamingCenterPageSlugHistory`.
- `GET /media`
  - Returns JSON `{ data: media[] }`.
  - Adds `Cache-Control` with 5 minute TTL and stale-while-revalidate.
- `GET /links`
  - Returns JSON `{ data: links[] }`.
- `GET /addresses`
  - Returns JSON `{ data: addresses[] }`.

## Payload CMS Editorial Articles & Content Builder

Payload CMS manages global editorial articles (`ArticlesCollection` in `payload/src/collections/Articles.ts`).

### Data Model & SEO
- **Fields**: `title`, `slug` (unique), `status` (`draft` | `published`), `publishedAt`, `featuredVenues` (`sayraVenueId[]`), `heroMedia` (upload), `content` (Lexical rich-text AST), `seo` (`title`, `description`, `keywords`).
- **Access Control**: Public users can read only published articles (`status = published`). Authenticated Payload users have full CRUD access.

### Lexical RichText AST & Custom Blocks
The article body is rendered via Payload's `@payloadcms/richtext-lexical` editor enhanced with `BlocksFeature`. Stored content consists of a Lexical JSON AST containing node structures and embedded custom block objects under `node.fields`.

### Verified Content Blocks (24 Total)
All 24 content blocks implemented in `payload/src/blocks/index.ts` and rendered via `payload/src/components/ArticleRenderer.tsx`:

1. `imageBlock`: Single image with caption, alt text, and aspect ratio (`auto`, `16/9`, `4/3`, `1/1`).
2. `galleryBlock`: Image gallery grid, carousel, or masonry layout (2-4 columns).
3. `tableBlock`: Structured data table with header row support and caption.
4. `calloutBlock`: Highlighted notice box with tone (`info`, `warning`, `success`, `danger`, `tip`).
5. `ctaBlock`: Call to action banner with headline, description, button text/URL, and style variant.
6. `tableOfContentsBlock`: Auto-generated document outline up to max depth (H2-H4).
7. `venueCardBlock`: Featured gaming center card linked via `sayraVenueId` with key highlights and booking CTA.
8. `mapBlock`: Interactive or embedded map with lat/long coordinates, address, and zoom level.
9. `eventListBlock`: Tournament or venue event list filtered by venue ID or explicit event selections.
10. `calendarBlock`: Venue event calendar view linked to a gaming center.
11. `bannerBlock`: Promotional banner with message, link, and style (`promo`, `announcement`, `alert`).
12. `videoBlock`: Embedded video player (MP4/HLS) or video embed with autoplay toggle.
13. `faqBlock`: Frequently Asked Questions accordions list (`question`, `answer`).
14. `quoteBlock`: Pull quote with author name and title.
15. `statsBlock`: Key performance indicators / stats display (`value`, `label`, `subtext`).
16. `cardGridBlock`: Grid layout of feature cards with icons, descriptions, and links.
17. `comparisonBlock`: Multi-column comparison table for gaming gear or venue tiers.
18. `stepsBlock`: Numbered step-by-step instructional guide.
19. `downloadBlock`: Resource download card with file URL, file size, and file type.
20. `relatedContentBlock`: Related articles links (`auto` or `manual` selection).
21. `articleMetadataBlock`: Reading time in minutes, author profile, and related article links.
22. `embedBlock`: Third-party embeds (YouTube, Twitch, Twitter, Custom embed code).
23. `codeBlock`: Syntax-highlighted code snippet (`language`, `code`, `filename`).
24. `customExtensionBlock`: Flexible JSON extension payload for custom component rendering.

### Frontend Display Routes & Rendering
- **Articles Overview Page**: `payload/app/(app)/articles/page.tsx` (`GET /articles`)
- **Article Detail Page**: `payload/app/(app)/articles/[slug]/page.tsx` (`GET /articles/[slug]`)
- **Renderer Component**: `ArticleRenderer` (`payload/src/components/ArticleRenderer.tsx`) dynamically switch-renders Lexical AST nodes and all 24 content blocks.

## How to Add a New Content Block
1. Define the block configuration using `Block` type from Payload in `payload/src/blocks/index.ts`.
2. Add the block definition to `ALL_ARTICLE_BLOCKS` array in `payload/src/blocks/index.ts`.
3. Add a corresponding rendering switch case in `payload/src/components/ArticleRenderer.tsx` (and component implementation in `payload/src/components/blocks/`).
4. Update the block schema in `payload/src/docs/payload-openapi.yaml` and `payload/src/docs/payload-openapi.json`.
5. Run OpenAPI validation script: `npx @stoplight/spectral-cli lint payload/src/docs/payload-openapi.yaml --ruleset sayra/.spectral.yaml`.

## Known Gaps / TODO

- Private CMS links/addresses routes are placeholders (501).
- Admin UI route is not protected by authentication in the route definition.

## Source of Truth

- `src/modules/cms/*.routes.ts`
- `src/modules/cms/*.validators.ts`
- `src/modules/public/*.public.controller.ts`
- `src/modules/public/public.routes.ts`
- `prisma/schema.prisma`
