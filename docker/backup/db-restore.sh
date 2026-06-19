#!/bin/bash
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.sql.gz>"
    exit 1
fi

echo "Starting database restoration from $BACKUP_FILE..."

# Drop and recreate schema or rely on pg_dump --clean if it was used.
# Since we didn't use --clean, we might want to be careful.
# For a full DR, we assume a fresh DB or we drop the public schema.

gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"

echo "Restoration completed successfully."
