#!/bin/bash
set -euo pipefail

CRON_EXPR="${BACKUP_CRON:-0 * * * *}"
if [[ ! "$CRON_EXPR" =~ ^[0-9*,/-]+([[:space:]]+[0-9*,/-]+){4}$ ]]; then
    echo "ERROR: Invalid BACKUP_CRON format." >&2
    exit 1
fi

# Setup cron tasks using validated cron schedule
printf '%s /scripts/backup-perform.sh >> /var/log/backup.log 2>&1\n' "$CRON_EXPR" > /etc/crontabs/root
printf '30 2 * * * /scripts/maintenance.sh >> /var/log/backup.log 2>&1\n' >> /etc/crontabs/root

# Initialize log file (do not forge last_success_backup on startup before an actual backup succeeds)
touch /var/log/backup.log

echo "Backup agent started with schedule: $CRON_EXPR"

# Start crond in foreground
crond -f -l 2
