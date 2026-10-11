#!/bin/sh
# scripts/entrypoint.sh

set -e

# Run database migrations if wait-for-db/migrate script is needed
if [ -f "./scripts/migrate.sh" ]; then
  echo "Running database migrations..."
  ./scripts/migrate.sh
fi

echo "Starting Application Server as PID 1..."
exec "$@"
