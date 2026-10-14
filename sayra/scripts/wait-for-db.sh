#!/bin/sh
# scripts/wait-for-db.sh

set -e

host="$1"
shift

echo "Waiting for PostgreSQL at $host..."

until pg_isready -h "$host" -U "${POSTGRES_USER:-playenest_admin}" -d "${POSTGRES_DB:-playenest_prod}"; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up - checking multiple database initialization"

dbs="${POSTGRES_MULTIPLE_DATABASES:-${PAYLOAD_POSTGRES_DB:-payload_db}}"
if [ -n "$dbs" ]; then
  for db in $(echo "$dbs" | tr ',' ' '); do
    echo "Ensuring database '$db' exists..."
    PGPASSWORD="${POSTGRES_PASSWORD:-change_this_secure_password_in_production}" psql -h "$host" -U "${POSTGRES_USER:-playenest_admin}" -d "${POSTGRES_DB:-playenest_prod}" <<-EOSQL
      SELECT 'CREATE DATABASE "$db"'
      WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
      GRANT ALL PRIVILEGES ON DATABASE "$db" TO "${POSTGRES_USER:-playenest_admin}";
EOSQL
  done
fi

>&2 echo "Database setup verified - checking database migrations"

if [ -f "./scripts/migrate.sh" ]; then
  echo "Running database migrations..."
  ./scripts/migrate.sh
elif [ -x "$(command -v npx)" ]; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

>&2 echo "Database migrations verified - executing command"
exec "$@"
