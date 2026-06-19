# Disaster Recovery Runbook

This runbook provides exact steps to recover from various failure scenarios in the Playenest infrastructure.

---

## Scenario 1: Database Corruption (PostgreSQL or Redis)

**Symptom:** Application errors, connection failures, or data loss.

**Steps:**
1.  Stop the `app` container: `docker compose stop app`.
2.  Execute the restore script inside the `backup` container:
    ```bash
    docker compose exec backup /scripts/restore.sh latest
    ```
3.  Restart the application: `docker compose start app`.

---

## Scenario 2: Accidental Deletion of Media Files

**Symptom:** Images or uploads missing (404) from the website.

**Steps:**
1.  Identify the snapshot ID: `docker compose exec backup restic snapshots`.
2.  Restore only the storage path:
    ```bash
    docker compose exec backup restic restore [SNAPSHOT_ID] --target /restore --path /storage
    docker compose exec backup cp -rp /restore/storage/* /storage/
    ```

---

## Scenario 3: Complete Server Loss (Disaster)

**Symptom:** Server unreachable, hardware failure.

**Steps:**
1.  Provision a new server with Docker.
2.  Clone the repository.
3.  Mount your offsite backup (e.g., S3) as the Restic repository.
4.  Run recovery:
    ```bash
    docker compose up -d db redis backup
    docker compose exec backup /scripts/restore.sh latest
    ```
5.  Deploy the full stack: `docker compose up -d`.

---

## Scenario 4: Ransomware Incident

**Steps:**
1.  **Isolate:** Shut down the server.
2.  **Recover:** Provision a clean environment and restore from a snapshot taken *before* the infection using Restic's immutable snapshots.

---

## Scenario 5: Infrastructure Misconfiguration

**Symptom:** Nginx fails to start or Docker Compose errors.

**Steps:**
1.  Restore the configuration:
    ```bash
    docker compose exec backup /scripts/restore.sh latest
    ```
    This will restore `/nginx_config` and `/project_root` (Compose files).

---

## Verification Task: Periodic DR Drills

Every quarter, perform a "Dry Run" restore to a separate environment to ensure data integrity and process familiarity.
