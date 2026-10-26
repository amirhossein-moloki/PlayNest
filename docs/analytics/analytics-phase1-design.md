# Play-Nest Analytics Phase 1 Architecture & Design

## 1. Architectural Overview & Context
Phase 1 of Play-Nest Analytics establishes an isolated, reliable, and idempotent ingestion pipeline that extracts operational data from Play-Nest's primary transactional engine (`sayra`) into dedicated analytical tables.

```
Operational PostgreSQL (sayra)
  ├── GamingCenter (Tenants)
  ├── CustomerAccount / CustomerProfile
  ├── GameStation
  ├── Reservation
  ├── GamingSession
  ├── Payment
  ├── LedgerEntry
  └── Refund
         │
         ▼ (Incremental Extraction via Watermarks & 2h Lookback)
  [ AnalyticsIngestionService ]
         │
         ▼ (Idempotent Persistence & Batch Processing)
Analytical Tables (playenest_prod / Analytics Schema)
  ├── AnalyticsWatermark
  ├── AnalyticsIngestionRun
  ├── AnalyticsTenant
  ├── AnalyticsCustomer
  ├── AnalyticsStation
  ├── AnalyticsReservation
  ├── AnalyticsGamingSession
  ├── AnalyticsPayment
  ├── AnalyticsLedgerEntry
  └── AnalyticsRefund
```

## 2. Key Technology Decisions
- **Database Isolation**: Analytical storage resides in analytical tables within the primary PostgreSQL database instance (`playenest_prod`), organized with an explicit `Analytics` prefix (`AnalyticsTenant`, `AnalyticsReservation`, etc.) to guarantee zero transactional locks on operational business paths.
- **Worker/Scheduler Architecture**: Driven by BullMQ / scheduled background jobs (`AnalyticsIngestionWorker`), executing periodically (default: every 1 hour) with Redis-backed atomic lock distribution to prevent overlapping runs.
- **Watermark Mechanism**: Each source entity tracks `lastIngestedAt` and `lastSourceId`. Watermarks advance only after full batch transaction commits.
- **Idempotency & Upserts**: Every analytical entity uses source primary keys (`id`) as primary keys in analytical tables. All writes perform atomic `upsert` / `ON CONFLICT` updates.
- **Bounded Lookback Window**: A 2-hour sliding window is applied to incremental extraction queries (`updatedAt >= watermark - 2 hours`) to safely process late-arriving modifications and status changes.

## 3. Financial Data Integrity Rules
- Operational financial tables (`Payment`, `LedgerEntry`, `Refund`) are mirrored without altering payment states or revenue definitions.
- Payment attempts, refunds, and ledger collection entries maintain distinct analytical entities.
- Currency, amounts, and idempotency keys are retained identically to source records.

## 4. Tenant Isolation & Security
- `gamingCenterId` is preserved on all analytical models.
- Multi-tenant query isolation is enforced across analytical reads and API queries.
- Raw customer passwords/tokens are excluded from analytical extraction.
