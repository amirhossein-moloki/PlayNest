# Production Release & Operational Deployment Checklist

**Application:** Sayra Backend (`sayra/`)
**Target Release:** v1.0.0-GA
**Author:** Jules (Senior Software Architect)

---

## 1. Environmental Prerequisites Checklist

- [ ] **Node.js Runtime:** Verified Node.js >= 20.x (recommended Node.js 22 LTS).
- [ ] **PostgreSQL Database:** PostgreSQL 15 server initialized with `playenest_prod` database and `btree_gist` extension enabled.
- [ ] **Redis Instance:** Redis 7 server accessible via `REDIS_URL`.
- [ ] **Environment Variables:** Production `.env` configured with strong secrets (no defaults):
  - [ ] `NODE_ENV=production`
  - [ ] `JWT_ACCESS_SECRET` (min 32 random characters)
  - [ ] `JWT_REFRESH_SECRET` (min 32 random characters)
  - [ ] `DATABASE_URL` pointing to PostgreSQL 15 instance
  - [ ] `REDIS_URL` pointing to Redis instance
  - [ ] `CORS_ORIGIN` restricted to specific production client domain(s)
  - [ ] `ZARINPAL_MERCHANT_ID` and `ZARINPAL_SANDBOX=false`
  - [ ] `SMSIR_API_KEY` and `SMSIR_LINE_NUMBER` for live SMS notifications

---

## 2. Pre-Deployment Database Procedures

1. **Apply Prisma Database Migrations:**
   ```bash
   cd sayra
   npx prisma migrate deploy
   ```
2. **Verify Database Exclusion Constraints & Indexes:**
   - Confirm `Reservation_no_overlap_active` EXCLUDE constraint is active in PostgreSQL.
3. **Optional Seeding:**
   ```bash
   npx prisma db seed
   ```

---

## 3. Deployment Build & Service Startup

1. **Build Container Image / Dist Artifacts:**
   ```bash
   cd sayra
   npm run build
   ```
2. **Start Backend Container / Node Process:**
   ```bash
   npm run start
   ```
3. **Verify Background Worker Processes:**
   - Confirm `ReservationExpiryWorker`, `ReservationRemindersWorker`, and `WaitlistExpiryWorker` start without error.

---

## 4. Post-Deployment Operational Verification

- [ ] **Health Endpoint Check:**
  `GET /health` returns `200 OK` with status `UP` for database and Redis dependencies.
- [ ] **Metrics Endpoint Check:**
  `GET /metrics` returns valid Prometheus application metrics.
- [ ] **Swagger Documentation Check:**
  `GET /api-docs` loads Swagger UI cleanly.
- [ ] **Authentication Check:**
  Login endpoint `POST /api/v1/auth/login` generates valid JWT access and refresh tokens.

---

## 5. Rollback & Emergency Contingency

- In case of deployment failure, consult `docs/DISASTER_RECOVERY_RUNBOOK.md` and `docs/BACKUP_RECOVERY_STRATEGY.md`.
- Database rollbacks require restoring the PostgreSQL snapshot created immediately before executing `prisma migrate deploy`.
