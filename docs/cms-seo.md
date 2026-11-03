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

## Known Gaps / TODO

- Private CMS links/addresses routes are placeholders (501).
- Admin UI route is not protected by authentication in the route definition.

## Source of Truth

- `src/modules/cms/*.routes.ts`
- `src/modules/cms/*.validators.ts`
- `src/modules/public/*.public.controller.ts`
- `src/modules/public/public.routes.ts`
- `prisma/schema.prisma`
