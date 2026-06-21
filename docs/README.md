# Playenest Documentation Map

This folder contains documentation generated directly from the current Playenest codebase. Each document includes a **Source of Truth** section that points to the exact files used.

## Contents

- [Architecture](architecture.md)
- [Database](database.md)
- [PRD (English)](playenest-prd.md)
- [PRD (Persian)](MVP-GamingCenter-Platform-FA.md)
- [API Reference](api.md)
- [API List (Persian)](API_LIST.md)
- [Authentication](auth.md)
- [Local Setup Guide (Persian)](LOCAL_SETUP_GUIDE_FA.md)
- [CMS + SEO](cms-seo.md)
- [Payments, Commission, Webhooks](payments-commission-webhooks.md)
- [Onboarding](onboarding.md)
- [Frontend Requirements](FRONTEND_REQUIREMENTS.md)
- [Page Builder Status](page_builder_status.md)
- [Media Strategy](media-url-strategy.md)
- [CI/CD](ci.md)
- [Roadmap / Todo](todo.md)

## Notes

- The API is mounted under `/api/v1` in `src/app.ts`.
- Routes are composed in `src/routes/index.ts` and module-specific `*.routes.ts` files.
- If a section of documentation is listed as a **Known Gap / TODO**, it means the code does not fully implement or expose that behavior yet.

## Source of Truth

- `src/app.ts`
- `src/routes/index.ts`
