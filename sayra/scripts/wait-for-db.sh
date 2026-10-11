#!/bin/sh
# scripts/wait-for-db.sh

set -e

host="$1"
shift

echo "Waiting for PostgreSQL at $host..."

until pg_isready -h "$host" -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - executing command"
exec "$@"
