#!/bin/bash

LEVEL=$1
MESSAGE=$2
WEBHOOK_URL=${BACKUP_ALERT_WEBHOOK_URL}

echo "[$LEVEL] $MESSAGE"

if [ -n "$WEBHOOK_URL" ]; then
    PAYLOAD=$(printf '{"text": "[%s] Backup System: %s"}' "$LEVEL" "$MESSAGE")
    curl -X POST -H 'Content-type: application/json' --data "$PAYLOAD" "$WEBHOOK_URL" || echo "Failed to send alert to webhook"
fi
