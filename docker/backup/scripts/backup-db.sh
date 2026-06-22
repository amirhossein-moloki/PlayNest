#!/bin/bash
set -e

# Configuration
DUMP_FILE="/tmp/db_dump_$(date +%Y%m%d_%H%M%S).sql"
COMPRESSED_FILE="${DUMP_FILE}.gz"

echo "Starting database dump..."

# Use pg_dump to create a consistent logical backup
PGPASSWORD=$POSTGRES_PASSWORD pg_dump -h $POSTGRES_HOST -p $POSTGRES_PORT -U $POSTGRES_USER $POSTGRES_DB > $DUMP_FILE

# Compress the dump
gzip $DUMP_FILE

echo "Database dump completed: $COMPRESSED_FILE"

# Move to the data directory for restic to pick up
mkdir -p /data/db
mv $COMPRESSED_FILE /data/db/latest.sql.gz

# Cleanup old temporary files if any
rm -f /tmp/db_dump_*.sql /tmp/db_dump_*.sql.gz
