# Playenest Backup & Recovery Strategy

This document outlines the architecture, policies, and technical implementation of the backup system for the Playenest platform.

---

## 1. Architecture Overview

The backup system is built on **Restic**, a modern, fast, and secure backup tool that supports deduplication, encryption, and multiple storage backends.

### Key Components:
- **Backup Agent:** A dedicated sidecar container running Restic and cron jobs.
- **Logical DB Dumps:** Consistent PostgreSQL dumps using `pg_dump`.
- **Redis Persistence:** Scheduled `BGSAVE` and snapshotting of the Redis RDB file.
- **Restic Repository:** Encrypted and deduplicated storage of all snapshots.
- **S3 Integration (Optional):** Support for offsite backups to AWS S3 or any S3-compatible storage.

---

## 2. Backup Scope

The following critical components are protected:

| Component | Method | Frequency |
| :--- | :--- | :--- |
| **PostgreSQL DB** | Logical `pg_dump` + Restic snapshot | Hourly |
| **Redis Data** | `BGSAVE` + Restic snapshot of `/redis_data` | Daily |
| **Media & Uploads**| Restic snapshot of `/storage` volume | Daily |
| **Configuration** | Restic snapshot of `.env` and Project Root | Hourly |
| **Nginx Config** | Restic snapshot of `/nginx_config` | Daily |

---

## 3. Recovery Objectives (RPO/RTO)

| Objective | Target | Justification |
| :--- | :--- | :--- |
| **RPO (Recovery Point)** | 1 Hour | Achieved via hourly logical DB dumps and Restic snapshots. |
| **RTO (Recovery Time)** | < 1 Hour | Achieved via automated restore scripts and Docker-based deployment. |

---

## 4. Retention Policy

We maintain a layered retention strategy to balance storage costs and recovery depth:

- **Hourly:** Keep last 24 snapshots.
- **Daily:** Keep last 7 days.
- **Weekly:** Keep last 4 weeks.
- **Monthly:** Keep last 12 months.

---

## 5. Security & Integrity

- **Encryption:** All backups are encrypted at rest using AES-256 via Restic.
- **Integrity Checks:** Automatic daily `restic check` to identify potential corruption.
- **Deduplication:** Only changed blocks are stored, significantly reducing storage usage.

---

## 6. Monitoring & Alerts

- **Healthcheck:** The `backup` container includes a healthcheck that fails if no successful backup has occurred in the last 2 hours.
- **Logs:** All operations are logged to `/var/log/backup.log`.
