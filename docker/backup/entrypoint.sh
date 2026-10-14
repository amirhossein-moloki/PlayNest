#!/bin/bash
set -e

# Setup cron tasks
echo "$BACKUP_CRON /scripts/backup-perform.sh >> /var/log/backup.log 2>&1" > /etc/crontabs/root
echo "30 2 * * * /scripts/maintenance.sh >> /var/log/backup.log 2>&1" >> /etc/crontabs/root

# Initialize log file and last_success_backup timestamp marker on startup
touch /var/log/backup.log
date +%s > /var/log/last_success_backup

echo "Backup agent started with schedule: $BACKUP_CRON"

# Start crond in foreground
crond -f -l 2
