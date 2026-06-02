# Playenest

Playenest is a specialized Gamenet Reservation & Management system. It is an Express + TypeScript API backed by PostgreSQL and Prisma. The API is mounted under `/api/v1` and is organized by feature modules (auth, gaming centers, stations, staff, shifts, availability, reservations, payments, CMS, public, webhooks, wallet).

## Project Overview

Playenest provides a comprehensive solution for gaming centers to manage their stations (PC, Console, VR), handle online and walk-in reservations, manage staff shifts, and provide a public site for customers to book sessions.

## Documentation

The authoritative documentation lives in `docs/` and is updated for the Gamenet system:

- `docs/README.md` — documentation map
- `docs/architecture.md` — system structure and project map
- `docs/database.md` — Prisma models, enums, and relationships (GamingCenter, Station, etc.)
- `docs/api.md` — route-by-route API reference for Playenest
- `docs/API_GUIDE_FA.md` — راهنمای فارسی API (Persian API Guide for Playenest)
- `docs/auth.md` — OTP/session auth flow for Users and Customers
- `docs/cms-seo.md` — CMS and SEO behavior for Gaming Center pages
- `docs/payments-commission-webhooks.md` — payment flow, commission data model, webhooks
- `docs/onboarding.md` — local setup and environment variables

## Key Features

- **Gaming Center Management**: Manage multiple gaming centers with their own settings, stations, and staff.
- **Station Management**: Detailed control over PCs, Consoles (PlayStation, Xbox), and VR stations.
- **Smart Reservation Engine**: Prevents overlaps and manages session statuses (Active, Paused, Completed).
- **Staff Management**: Role-based access (Manager, Supervisor, Staff) and shift scheduling.
- **Wallet & Membership**: Integrated wallet for customers and membership tiers.
- **CMS & SEO**: Build public pages for gaming centers with SEO optimization.
- **Payments**: Integrated with Zarinpal for online payments.

## Phase Updates

The project has transitioned from a GamingCenter system to a full-featured Gamenet management platform. All core modules have been refactored to support Gamenet-specific logic like hourly rates, VIP stations, and gaming sessions.
