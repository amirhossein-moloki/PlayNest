#!/bin/bash
set -euo pipefail
umask 077

echo "--- Backup Process Started: $(date) ---"

# 1. Initialize Restic repository if it doesn't exist
if ! restic snapshots > /dev/null 2>&1; then
    echo "Initializing Restic repository..."
    restic init
fi

# 2. Perform Database Dump (Backs up primary MAIN_DB + all POSTGRES_MULTIPLE_DATABASES)
echo "Backing up PostgreSQL databases..."
/scripts/backup-db.sh

# 3. Trigger synchronous Redis RDB persistence before snapshot (using REDISCLI_AUTH env, never -a CLI arg)
trigger_redis_bgsave_and_wait() {
    local host="$1"
    local label="$2"
    local auth_pass="${3:-}"
    local before_save
    if ! before_save=$(REDISCLI_AUTH="$auth_pass" redis-cli --no-auth-warning -h "$host" LASTSAVE 2>/dev/null); then
        echo "Warning: $label Redis LASTSAVE unreachable, skipping BGSAVE wait."
        return 0
    fi
    if ! REDISCLI_AUTH="$auth_pass" redis-cli --no-auth-warning -h "$host" BGSAVE >/dev/null 2>&1; then
        echo "Warning: $label Redis BGSAVE failed, continuing with existing RDB if present."
        return 0
    fi
    local waited=0
    while [ "$waited" -lt 60 ]; do
        local current_save
        current_save=$(REDISCLI_AUTH="$auth_pass" redis-cli --no-auth-warning -h "$host" LASTSAVE 2>/dev/null || echo "$before_save")
        if [ "$current_save" -gt "$before_save" ] 2>/dev/null; then
            echo "$label Redis BGSAVE persisted (LASTSAVE=$current_save)."
            return 0
        fi
        sleep 1
        waited=$((waited + 1))
    done
    echo "Warning: $label Redis BGSAVE timed out after 60s."
}

echo "Triggering PlayNest Redis BGSAVE..."
trigger_redis_bgsave_and_wait "redis" "PlayNest" "${SAYRA_REDIS_PASSWORD:-}"

echo "Triggering Blog Redis BGSAVE..."
trigger_redis_bgsave_and_wait "blog_redis" "Blog" "${BLOG_REDIS_PASSWORD:-}"

# 4. Run Restic Backup (includes DB dumps, Sayra /storage + /uploads, Blog media, Redis data, Nginx & compose config)
BACKUP_PATHS=(/data /storage /redis_data /nginx_config /project_root /config)
if [ -d "/uploads" ]; then
    BACKUP_PATHS+=(/uploads)
fi
if [ -d "/blog_media" ]; then
    BACKUP_PATHS+=(/blog_media)
fi
if [ -d "/blog_redis_data" ]; then
    BACKUP_PATHS+=(/blog_redis_data)
fi

echo "Creating Restic snapshot..."
restic backup "${BACKUP_PATHS[@]}" \
    --tag "automated" \
    --host "playenest-app"

# 5. Update health marker ONLY after Restic backup exits cleanly
echo "Backup successful!"
date +%s > /var/log/last_success_backup

echo "--- Backup Process Finished: $(date) ---"
