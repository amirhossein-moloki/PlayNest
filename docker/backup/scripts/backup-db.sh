#!/bin/bash
set -e

# Configuration
DUMP_FILE="/tmp/db_dump_$(date +%Y%m%d_%H%M%S).sql"
COMPRESSED_FILE="${DUMP_FILE}.gz"

echo "Starting database dump..."

mkdir -p /data/db

# Determine all target databases to dump
MAIN_DB="${POSTGRES_DB:-playenest_prod}"
PAYLOAD_DB="${PAYLOAD_POSTGRES_DB:-payload_db}"

# Build list of unique databases
DB_LIST="$MAIN_DB $PAYLOAD_DB"
if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
  DB_LIST="$DB_LIST $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' ')"
fi

UNIQUE_DBS=$(echo "$DB_LIST" | tr ' ' '\n' | sort -u)

for db in $UNIQUE_DBS; do
  echo "Backing up database '$db'..."
  TMP_DUMP="/tmp/db_dump_${db}_$(date +%Y%m%d_%H%M%S).sql"
  PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h $POSTGRES_HOST -p ${POSTGRES_PORT:-5432} -U $POSTGRES_USER $db > "$TMP_DUMP"
  gzip "$TMP_DUMP"
  mv "${TMP_DUMP}.gz" "/data/db/dump_${db}.sql.gz"
  echo "Database '$db' dump completed: /data/db/dump_${db}.sql.gz"
done

# Maintain backward compatibility link/copy for latest.sql.gz (main DB dump)
if [ -f "/data/db/dump_${MAIN_DB}.sql.gz" ]; then
  cp "/data/db/dump_${MAIN_DB}.sql.gz" /data/db/latest.sql.gz
fi

# Cleanup old temporary files if any
rm -f /tmp/db_dump_*.sql /tmp/db_dump_*.sql.gz
