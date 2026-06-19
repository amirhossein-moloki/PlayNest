# Disaster Recovery Plan (DRP) - Playenest

## 1. Overview
This document outlines the procedures for recovering the Playenest platform in the event of various disaster scenarios.

## 2. Recovery Objectives
- **RPO (Recovery Point Objective):**
  - Database: 1 Hour
  - Files/Media: 24 Hours
- **RTO (Recovery Time Objective):**
  - Services Restoration: 30 Minutes
  - Full Data Restoration: 2 Hours (depending on data volume)

## 3. Disaster Scenarios and Recovery Steps

### 3.1. Database (PostgreSQL) Corruption / Accidental Deletion
**Symptoms:** Application errors, missing data, database service failing to start.
**Recovery Steps:**
1. Identify the latest healthy backup in S3 or local `backup_data` volume.
2. If encrypted, decrypt the backup:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in db_backup_XXX.sql.gz.enc -out db_backup_XXX.sql.gz -k $BACKUP_ENCRYPTION_KEY
   ```
3. Run the restore script:
   ```bash
   docker compose exec -it backup /scripts/db-restore.sh /backups/db/db_backup_XXX.sql.gz
   ```

### 3.2. Redis Data Loss
**Symptoms:** Rate limiting issues, session logout, performance degradation.
**Recovery Steps:**
1. Identify the latest Redis backup (`redis_backup_XXX.rdb.gz.enc`).
2. Decrypt the backup:
   ```bash
   openssl enc -d -aes-256-cbc -pbkdf2 -iter 100000 -in redis_backup_XXX.rdb.gz.enc -out redis_backup_XXX.rdb.gz -k $BACKUP_ENCRYPTION_KEY
   ```
3. Decompress: `gunzip redis_backup_XXX.rdb.gz`.
4. Stop Redis: `docker compose stop redis`.
5. Replace `dump.rdb` in the Redis volume with the restored file.
6. Start Redis: `docker compose start redis`.

### 3.2. Media / Storage Failure
**Symptoms:** Broken images, upload failures.
**Recovery Steps:**
1. Decrypt the latest files backup.
2. Run the restore script:
   ```bash
   docker compose exec -it backup /scripts/file-restore.sh /backups/files/files_backup_XXX.tar.gz
   ```
3. Manually move files from `/restore/storage` to the live `app_storage` volume.

### 3.3. Complete Server Loss
**Symptoms:** Server unreachable, all containers down.
**Recovery Steps:**
1. Provision a new server with Docker and Docker Compose installed.
2. Clone the repository.
3. Download `.env` and `docker-compose.yml` from the latest backup (stored in S3).
4. Start the infrastructure: `docker compose up -d`.
5. Restore database and files as described in 3.1 and 3.2.

### 3.4. Ransomware Incident
**Symptoms:** Data encrypted by unauthorized parties, ransom note found.
**Recovery Steps:**
1. Immediately isolate the infected server (disconnect network).
2. Wipe the server or provision a new clean environment.
3. Use **offsite** backups from S3 (which should have versioning or object lock enabled) to restore the system.
4. Rotate all secrets and credentials.

## 4. Verification and Testing
- Backup integrity is checked during the backup process.
- Restore drills should be performed quarterly.
