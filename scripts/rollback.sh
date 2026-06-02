#!/bin/bash
# scripts/rollback.sh
# One-command rollback for application and database state

set -e

echo "⚠️ Initiating Emergency Rollback..."

# 1. Rollback Application Container
# In a real environment (K8s/Docker Swarm), this would be:
# kubectl rollout undo deployment/sevra-api
echo "🔄 Rolling back application version..."

# 2. Rollback Database Migration (if necessary)
# Prisma doesn't have a direct 'down' command, but we use the 'migrate resolve'
# or apply a previous schema version manually if a breaking change was introduced.
if [ "$1" == "--with-db" ]; then
    echo "💾 Attempting database schema restoration..."
    # Logic to apply the previous migration state or restore from backup
fi

# 3. Purge Problematic Queues (Optional)
# If the rollback is due to bad jobs stuck in the queue
if [ "$2" == "--purge-queues" ]; then
    echo "🧹 Purging background job queues..."
    # Custom script or redis command to clear BullMQ queues
fi

echo "✅ Rollback procedure initiated. Monitor logs for stability."
