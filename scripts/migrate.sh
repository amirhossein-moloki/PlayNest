#!/bin/bash
# scripts/migrate.sh
# Safely apply database migrations in production/staging environments

set -e

echo "🚀 Starting database migration..."

# Check environment
if [ -z "$DATABASE_URL" ]; then
  echo "❌ Error: DATABASE_URL is not set."
  exit 1
fi

# Run Prisma migration
# --force is used here because in production/staging we want to apply the schema
# but in a controlled deployment pipeline. Note: migrate deploy does NOT reset the DB.
npx prisma migrate deploy

echo "✅ Migration completed successfully."
