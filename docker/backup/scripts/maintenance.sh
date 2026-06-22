#!/bin/bash
set -e

echo "--- Maintenance Started: $(date) ---"

# 1. Prune old snapshots based on retention policy
echo "Pruning old backups..."
restic forget \
    --keep-hourly ${RETENTION_HOURLY:-24} \
    --keep-daily ${RETENTION_DAILY:-7} \
    --keep-weekly ${RETENTION_WEEKLY:-4} \
    --keep-monthly ${RETENTION_MONTHLY:-12} \
    --prune

# 2. Check repository integrity
echo "Checking repository integrity..."
restic check

echo "--- Maintenance Finished: $(date) ---"
