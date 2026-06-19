#!/bin/bash
set -e

BACKUP_DIR="/backups/files"
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
FILENAME="files_backup_$TIMESTAMP.tar.gz"

echo "Archiving storage and configuration..."

# We archive /app/storage and specific config files
tar -czf "$BACKUP_DIR/$FILENAME" \
    -C /app storage \
    -C /config .env docker-compose.yml docker/nginx

echo "Archive completed: $BACKUP_DIR/$FILENAME"
echo "$FILENAME" > /tmp/last_files_backup
