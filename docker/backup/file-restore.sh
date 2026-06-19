#!/bin/bash
set -e

BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
    echo "Usage: $0 <backup_file.tar.gz>"
    exit 1
fi

echo "Restoring files from $BACKUP_FILE..."

tar -xzf "$BACKUP_FILE" -C /restore

echo "Files extracted to /restore. Please move them to their respective locations manually to avoid overwriting live data accidentally."
