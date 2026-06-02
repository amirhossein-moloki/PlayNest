# Sevra

Sevra is an Express + TypeScript API backed by PostgreSQL and Prisma. The API is mounted under `/api/v1` and is organized by feature modules (auth, salons, services, staff, shifts, availability, bookings, payments, CMS, public, webhooks).

## Documentation

The authoritative documentation lives in `docs/` and is generated from the current codebase:

- `docs/README.md` — documentation map
- `docs/architecture.md` — system structure and project map
- `docs/database.md` — Prisma models, enums, and relationships
- `docs/api.md` — route-by-route API reference
- `docs/API_GUIDE_FA.md` — راهنمای فارسی API (Persian API Guide)
- `docs/auth.md` — OTP/session auth flow
- `docs/cms-seo.md` — CMS and SEO behavior
- `docs/payments-commission-webhooks.md` — payment flow, commission data model, webhooks
- `docs/onboarding.md` — local setup and environment variables

## Phase 7: Quality & Release Readiness (New)

- `docs/QA_VALIDATION_REPORT.md` — summary of final QA activities
- `docs/RELEASE_READINESS_REPORT.md` — release assessment and recommendation
- `docs/RELEASE_READINESS_ASSESSMENT.md` — detailed environmental readiness check
- `docs/E2E_TESTING_GUIDE.md` — guide for running and maintaining E2E tests
- `docs/COVERAGE_ANALYSIS_REPORT.md` — detailed code coverage findings
- `docs/PERFORMANCE_REPORT.md` — API performance benchmarks
- `docs/SECURITY_REVIEW_SUMMARY.md` — security controls and findings
