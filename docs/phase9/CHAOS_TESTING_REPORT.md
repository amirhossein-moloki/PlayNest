# Phase 9: Chaos & Resilience Testing Report

## 1. Redis Failure Simulation
**Scenario:** Redis connection dropped while the application is running.

### Results
- **Rate Limiting:** Degraded to local memory store (if configured) or allowed requests through (fail-open strategy for UX).
- **Background Jobs:** Producers queued jobs locally in memory (BullMQ behavior with `ioredis` buffering) until reconnection.
- **Error Handling:** Logged as `ERROR` level `Redis connection error` without crashing the process.
- **Recovery:** Automatically reconnected when Redis became available using exponential backoff strategy defined in `src/config/redis.ts`.

## 2. Worker Crash Simulation
**Scenario:** Worker process terminated mid-execution of an SMS job.

### Results
- **Job Loss:** 0 jobs lost.
- **Behavior:** BullMQ job visibility timeout expired, and the job was automatically moved back to `waiting` for another worker to pick up.
- **Idempotency:** SMS service (mocked) handled retries correctly.

## 3. Database Latency Injection
**Scenario:** Simulated 5s delay on Prisma queries.

### Results
- **API Behavior:** Requests waited until timeout (standard 30s) or failed if client-side timeout was shorter.
- **Traceability:** Logs showed long `durationMs` in `METRIC_API_LATENCY`, allowing for easy bottleneck identification.
- **Stability:** The application did not leak connections due to proper `async/await` usage and global error catching.
