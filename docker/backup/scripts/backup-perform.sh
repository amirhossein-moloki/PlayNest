#!/bin/bash
set -e

echo "--- Backup Process Started: $(date) ---"

# 1. Initialize Restic repository if it doesn't exist
if ! restic snapshots > /dev/null 2>&1; then
    echo "Initializing Restic repository..."
    restic init
fi

# 2. Perform Database Dump (Backs up all databases listed in POSTGRES_MULTIPLE_DATABASES + MAIN_DB)
echo "Backing up PostgreSQL databases..."
/scripts/backup-db.sh

# 3. Handle Redis (Save RDB to disk before backup for both PlayNest and Blog Redis instances)
echo "Triggering PlayNest Redis BGSAVE..."
redis-cli -h redis BGSAVE || echo "Warning: PlayNest Redis BGSAVE failed, continuing with existing RDB if present."

echo "Triggering Blog Redis BGSAVE..."
redis-cli -h blog_redis BGSAVE || echo "Warning: Blog Redis BGSAVE failed, continuing with existing RDB if present."

# 4. Run Restic Backup
# We back up:
# - /data (Database dumps)
# - /storage (Sayra Media and uploads)
# - /blog_media (Blog Media uploads)
# - /redis_data (PlayNest Redis persistence files)
# - /blog_redis_data (Blog Redis persistence files)
# - /nginx_config (Nginx configuration)
# - /project_root (Docker Compose files, etc.)
# - /config (Environment variables)
BACKUP_PATHS="/data /storage /redis_data /nginx_config /project_root /config"
if [ -d "/blog_media" ]; then
    BACKUP_PATHS="$BACKUP_PATHS /blog_media"
fi
if [ -d "/blog_redis_data" ]; then
    BACKUP_PATHS="$BACKUP_PATHS /blog_redis_data"
fi

echo "Creating Restic snapshot..."
restic backup $BACKUP_PATHS \
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
