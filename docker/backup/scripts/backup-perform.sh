#!/bin/bash
set -e

echo "--- Backup Process Started: $(date) ---"

# 1. Initialize Restic repository if it doesn't exist
if ! restic snapshots > /dev/null 2>&1; then
    echo "Initializing Restic repository..."
    restic init
fi

# 2. Perform Database Dump
echo "Backing up PostgreSQL database..."
/scripts/backup-db.sh

# 3. Handle Redis (Save RDB to disk before backup)
echo "Triggering Redis BGSAVE..."
redis-cli -h redis BGSAVE || echo "Warning: Redis BGSAVE failed, continuing with existing RDB if present."

# 4. Run Restic Backup
# We back up:
# - /data (Database dumps)
# - /storage (Media and uploads)
# - /redis_data (Redis persistence files)
# - /nginx_config (Nginx configuration)
# - /project_root (Docker Compose files, etc.)
# - /config (Environment variables)
echo "Creating Restic snapshot..."
restic backup /data /storage /redis_data /nginx_config /project_root /config \
    --tag "automated" \
    --host "playenest-app"

# 5. Update health marker
if [ $? -eq 0 ]; then
    echo "Backup successful!"
    date +%s > /var/log/last_success_backup
else
    echo "Backup FAILED!"
    exit 1
fi

echo "--- Backup Process Finished: $(date) ---"
