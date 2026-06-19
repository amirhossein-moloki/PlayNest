#!/bin/bash
set -e

# Configuration
BACKUP_ROOT="/backups"
ENCRYPTION_KEY=${BACKUP_ENCRYPTION_KEY}
S3_BUCKET=${BACKUP_S3_BUCKET}
S3_ENDPOINT=${BACKUP_S3_ENDPOINT:-"https://s3.amazonaws.com"}

handle_error() {
    /scripts/notify.sh "CRITICAL" "Backup failed on $(hostname) at $(date). Check logs for details."
    exit 1
}

trap handle_error ERR

if [ -z "$ENCRYPTION_KEY" ]; then
    echo "ERROR: BACKUP_ENCRYPTION_KEY is not set."
    exit 1
fi

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# 1. Run Component Backups
/scripts/db-backup.sh
/scripts/file-backup.sh

DB_BACKUP=$(cat /tmp/last_db_backup)
REDIS_BACKUP=$(cat /tmp/last_redis_backup || echo "")
FILE_BACKUP=$(cat /tmp/last_files_backup)

# 2. Encrypt Backups
echo "Encrypting backups..."
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$BACKUP_ROOT/db/$DB_BACKUP" -out "$BACKUP_ROOT/db/$DB_BACKUP.enc" -k "$ENCRYPTION_KEY"
openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$BACKUP_ROOT/files/$FILE_BACKUP" -out "$BACKUP_ROOT/files/$FILE_BACKUP.enc" -k "$ENCRYPTION_KEY"

if [ -n "$REDIS_BACKUP" ]; then
    openssl enc -aes-256-cbc -salt -pbkdf2 -iter 100000 -in "$BACKUP_ROOT/redis/$REDIS_BACKUP" -out "$BACKUP_ROOT/redis/$REDIS_BACKUP.enc" -k "$ENCRYPTION_KEY"
fi

# 3. Upload to S3 (if configured)
if [ -n "$S3_BUCKET" ]; then
    echo "Uploading to S3..."
    aws --endpoint-url "$S3_ENDPOINT" s3 cp "$BACKUP_ROOT/db/$DB_BACKUP.enc" "s3://$S3_BUCKET/db/$DB_BACKUP.enc"
    aws --endpoint-url "$S3_ENDPOINT" s3 cp "$BACKUP_ROOT/files/$FILE_BACKUP.enc" "s3://$S3_BUCKET/files/$FILE_BACKUP.enc"
    if [ -n "$REDIS_BACKUP" ]; then
        aws --endpoint-url "$S3_ENDPOINT" s3 cp "$BACKUP_ROOT/redis/$REDIS_BACKUP.enc" "s3://$S3_BUCKET/redis/$REDIS_BACKUP.enc"
    fi
    echo "Upload completed."
else
    echo "S3_BUCKET not set, skipping upload."
fi

# 4. Cleanup Local (Keep last 7 days)
find "$BACKUP_ROOT" -type f -mtime +7 -delete

/scripts/notify.sh "INFO" "Backup completed successfully at $(date). DB: $DB_BACKUP, Files: $FILE_BACKUP"
echo "Master backup process finished successfully at $(date)"
