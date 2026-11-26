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
    TMP_SQL=$(mktemp /tmp/restore_db_XXXXXX)
    gunzip -c "$archive_path" > "$TMP_SQL"

    PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -v target_db="$target_db" <<'EOSQL'
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE datname = :'target_db' AND pid <> pg_backend_pid();
DROP DATABASE IF EXISTS :"target_db";
CREATE DATABASE :"target_db";
EOSQL

    PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" < "$TMP_SQL"

    local app_role=""
    if [ "$target_db" = "${POSTGRES_DB:-playenest_prod}" ]; then
        app_role="${SAYRA_DB_USER:-sayra_app}"
    elif [ "$target_db" = "${BLOG_POSTGRES_DB:-blog_prod}" ]; then
        app_role="${BLOG_DB_USER:-blog_app}"
    fi
    if [ -n "$app_role" ]; then
        if ! is_valid_pg_ident "$app_role"; then
            echo "ERROR: Refusing unsafe role identifier '$app_role'." >&2
            exit 1
        fi
        local role_exists
        role_exists=$(PGPASSWORD="$POSTGRES_PASSWORD" psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '$app_role'" -h "$POSTGRES_HOST" -p "$DB_PORT" -U "$DB_USER" postgres)
        if [ "$role_exists" = "1" ]; then
            echo "Re-applying least-privilege ownership for role '$app_role' on '$target_db'..."
            PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$POSTGRES_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$target_db" \
                -v target_db="$target_db" -v app_role="$app_role" <<'EOSQL'
REVOKE ALL ON DATABASE :"target_db" FROM PUBLIC;
ALTER DATABASE :"target_db" OWNER TO :"app_role";
GRANT ALL PRIVILEGES ON DATABASE :"target_db" TO :"app_role";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO :"app_role";
GRANT ALL ON SCHEMA public TO :"app_role";
SELECT format('ALTER TABLE %I.%I OWNER TO %I', n.nspname, c.relname, :'app_role')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v', 'm', 'f')\gexec
SELECT format('ALTER SEQUENCE %I.%I OWNER TO %I', n.nspname, c.relname, :'app_role')
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'S'
  AND NOT EXISTS (
    SELECT 1 FROM pg_depend d
    WHERE d.objid = c.oid AND d.classid = 'pg_class'::regclass AND d.deptype = 'a'
  )\gexec
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO :"app_role";
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO :"app_role";
EOSQL
        fi
    fi

    rm -f "$TMP_SQL"
    TMP_SQL=""
    echo "Restoration of database '$target_db' complete."
}

echo "--- Recovery Process Started: $(date) ---"
echo "Target Snapshot: $SNAPSHOT_ID"

# 1. Restore files from Restic (use --no-lock automatically when repository mount is read-only)
echo "Restoring files from Restic..."
mkdir -p /restore
RESTIC_RESTORE_FLAGS=()
if [ -n "${RESTIC_REPOSITORY:-}" ] && [ -d "$RESTIC_REPOSITORY" ] && [ ! -w "$RESTIC_REPOSITORY" ]; then
    RESTIC_RESTORE_FLAGS+=(--no-lock)
fi
restic "${RESTIC_RESTORE_FLAGS[@]}" restore "$SNAPSHOT_ID" --target /restore

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

restore_tree_if_writable() {
    local src="$1"
    local dst="$2"
    local label="$3"

    if [ ! -d "$src" ]; then
        return 0
    fi
    if [ ! -w "$dst" ]; then
        echo "WARNING: Skipping $label restore because mount '$dst' is read-only. Re-run with a read-write mount for $dst to restore these files." >&2
        return 0
    fi
    for existing in "$dst"/*; do
        if [ -e "$existing" ] && [ ! -w "$existing" ]; then
            echo "WARNING: Skipping $label restore because '$existing' inside '$dst' is a read-only mount. Re-run with a read-write mount to restore these files." >&2
            return 0
        fi
    done
    if [ -z "$(ls -A "$src" 2>/dev/null)" ]; then
        echo "No $label files in snapshot to restore."
        return 0
    fi
    echo "Restoring $label..."
    cp -rp "$src"/. "$dst"/
    echo "$label restoration complete."
}

# 3. Restore Redis (PlayNest & Blog)
restore_tree_if_writable "/restore/redis_data" "/redis_data" "PlayNest Redis data"
restore_tree_if_writable "/restore/blog_redis_data" "/blog_redis_data" "Blog Redis data"

# 4. Restore Storage/Media (Sayra & Blog)
restore_tree_if_writable "/restore/storage" "/storage" "Sayra storage/media files"
restore_tree_if_writable "/restore/uploads" "/uploads" "Sayra upload files"
restore_tree_if_writable "/restore/blog_media" "/blog_media" "Blog media files"

# 5. Restore Nginx Config
restore_tree_if_writable "/restore/nginx_config" "/nginx_config" "Nginx configuration"

# 6. Restore Project Root (Compose files, etc.)
restore_tree_if_writable "/restore/project_root" "/project_root" "project configuration"

# Cleanup
rm -rf /restore
echo "--- Recovery Process Finished: $(date) ---"
echo "IMPORTANT: Restart all containers to ensure they pick up restored data and configurations."
