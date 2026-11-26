#!/bin/bash
set -euo pipefail
umask 077

# Usage: ./restore.sh [snapshot_id]
SNAPSHOT_ID="${1:-latest}"
if [[ ! "$SNAPSHOT_ID" =~ ^[a-zA-Z0-9_-]+$ ]]; then
    echo "ERROR: Invalid snapshot ID." >&2
    exit 1
fi

is_valid_pg_ident() {
    [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]]
}

DB_USER="${POSTGRES_USER:-playenest_admin}"
DB_PORT="${POSTGRES_PORT:-5432}"
if ! is_valid_pg_ident "$DB_USER"; then
    echo "ERROR: Invalid POSTGRES_USER identifier." >&2
    exit 1
fi

TMP_SQL=""
cleanup() {
    if [ -n "$TMP_SQL" ]; then
        rm -f "$TMP_SQL"
    fi
}
trap cleanup EXIT

restore_pg_database() {
    local target_db="$1"
    local archive_path="$2"

    if ! is_valid_pg_ident "$target_db"; then
        echo "ERROR: Refusing unsafe database identifier '$target_db'." >&2
        exit 1
    fi

    echo "Restoring database '$target_db' from $archive_path..."
    TMP_SQL=$(mktemp /tmp/restore_db_XXXXXX.sql)
    gunzip -c "$archive_path" > "$TMP_SQL"

    PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v target_db="$target_db" <<'EOSQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'target_db' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS :"target_db";
CREATE DATABASE :"target_db";
EOSQL

    PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" < "$TMP_SQL"
    rm -f "$TMP_SQL"
    TMP_SQL=""
    echo "Restoration of database '$target_db' complete."
}

echo "--- Recovery Process Started: $(date) ---"
echo "Target Snapshot: $SNAPSHOT_ID"

# 1. Restore files from Restic
echo "Restoring files from Restic..."
mkdir -p /restore
restic restore "$SNAPSHOT_ID" --target /restore

# 2. Restore PostgreSQL Database
if [ -d "/restore/data/db" ]; then
    echo "Found PostgreSQL dump directory. Restoring databases..."
    restored_any=false

    for dump_file in /restore/data/db/dump_*.sql.gz; do
        if [ -f "$dump_file" ]; then
            restored_any=true
            db_name=$(basename "$dump_file" | sed -E 's/^dump_(.*)\.sql\.gz$/\1/')
            restore_pg_database "$db_name" "$dump_file"
        fi
    done

    # Fallback for legacy backups containing only latest.sql.gz
    if [ "$restored_any" = false ] && [ -f "/restore/data/db/latest.sql.gz" ]; then
        MAIN_DB="${POSTGRES_DB:-playenest_prod}"
        echo "Found legacy PostgreSQL dump (latest.sql.gz). Restoring '$MAIN_DB'..."
        restore_pg_database "$MAIN_DB" "/restore/data/db/latest.sql.gz"
        echo "PostgreSQL legacy restoration complete."
    fi
fi

# 3. Restore Redis (PlayNest & Blog)
if [ -d "/restore/redis_data" ]; then
    echo "Restoring PlayNest Redis data..."
    cp -rp /restore/redis_data/* /redis_data/
    echo "PlayNest Redis restoration complete."
fi

if [ -d "/restore/blog_redis_data" ]; then
    echo "Restoring Blog Redis data..."
    cp -rp /restore/blog_redis_data/* /blog_redis_data/
    echo "Blog Redis restoration complete."
fi

# 4. Restore Storage/Media (Sayra & Blog)
if [ -d "/restore/storage" ]; then
    echo "Restoring Sayra storage/media files..."
    cp -rp /restore/storage/* /storage/
    echo "Sayra storage restoration complete."
fi

if [ -d "/restore/uploads" ]; then
    echo "Restoring Sayra upload files..."
    cp -rp /restore/uploads/* /uploads/
    echo "Sayra uploads restoration complete."
fi

if [ -d "/restore/blog_media" ]; then
    echo "Restoring Blog media files..."
    cp -rp /restore/blog_media/* /blog_media/
    echo "Blog media restoration complete."
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
