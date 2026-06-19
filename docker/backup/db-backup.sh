#!/bin/bash
set -e

DB_BACKUP_DIR="/backups/db"
REDIS_BACKUP_DIR="/backups/redis"
mkdir -p "$DB_BACKUP_DIR" "$REDIS_BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# --- PostgreSQL Backup ---
DB_FILENAME="db_backup_$TIMESTAMP.sql.gz"
echo "Starting database backup..."
pg_dump "$DATABASE_URL" | gzip > "$DB_BACKUP_DIR/$DB_FILENAME"
echo "$DB_FILENAME" > /tmp/last_db_backup

# --- Redis Backup ---
# We assume Redis RDB is at /data/dump.rdb (mapped to /redis-data)
REDIS_FILENAME="redis_backup_$TIMESTAMP.rdb.gz"
if [ -f "/redis-data/dump.rdb" ]; then
    echo "Archiving Redis RDB..."
    gzip -c "/redis-data/dump.rdb" > "$REDIS_BACKUP_DIR/$REDIS_FILENAME"
    echo "$REDIS_FILENAME" > /tmp/last_redis_backup
else
    echo "WARNING: Redis dump.rdb not found at /redis-data/dump.rdb"
    touch /tmp/last_redis_backup # Empty file to avoid master script failure
fi

echo "Database and Redis backup completed."
