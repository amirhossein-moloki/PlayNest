#!/bin/bash
set -e

# Usage: ./restore.sh [snapshot_id]
SNAPSHOT_ID=${1:-latest}

echo "--- Recovery Process Started: $(date) ---"
echo "Target Snapshot: $SNAPSHOT_ID"

# 1. Restore files from Restic
echo "Restoring files from Restic..."
mkdir -p /restore
restic restore $SNAPSHOT_ID --target /restore

# 2. Restore PostgreSQL Database
if [ -f "/restore/data/db/latest.sql.gz" ]; then
    echo "Found PostgreSQL dump. Restoring..."
    gunzip -c /restore/data/db/latest.sql.gz > /tmp/restore_db.sql
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$POSTGRES_DB' AND pid <> pg_backend_pid();"
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS \"$POSTGRES_DB\";"
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d postgres -c "CREATE DATABASE \"$POSTGRES_DB\";"
    PGPASSWORD=$POSTGRES_PASSWORD psql -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER -d $POSTGRES_DB < /tmp/restore_db.sql
    rm /tmp/restore_db.sql
    echo "PostgreSQL restoration complete."
fi

# 3. Restore Redis
if [ -d "/restore/redis_data" ]; then
    echo "Restoring Redis data..."
    cp -rp /restore/redis_data/* /redis_data/
    echo "Redis restoration complete."
fi

# 4. Restore Storage/Media
if [ -d "/restore/storage" ]; then
    echo "Restoring storage/media files..."
    cp -rp /restore/storage/* /storage/
    echo "Storage restoration complete."
fi

# 5. Restore Nginx Config
if [ -d "/restore/nginx_config" ]; then
    echo "Restoring Nginx configuration..."
    cp -rp /restore/nginx_config/* /nginx_config/
    echo "Nginx config restoration complete."
fi

# 6. Restore Project Root (Compose files, etc.)
if [ -d "/restore/project_root" ]; then
    echo "Restoring project configuration..."
    cp -rp /restore/project_root/* /project_root/
    echo "Project configuration restoration complete."
fi

# Cleanup
rm -rf /restore
echo "--- Recovery Process Finished: $(date) ---"
echo "IMPORTANT: Restart all containers to ensure they pick up restored data and configurations."
