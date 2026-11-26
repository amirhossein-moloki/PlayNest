#!/bin/sh
# scripts/wait-for-db.sh

set -eu

host="$1"
shift

is_valid_pg_ident() {
  case "$1" in
    ''|[0-9]*|*[!a-zA-Z0-9_]*)
      return 1
      ;;
    *)
      return 0
      ;;
  esac
}

db_user="${POSTGRES_USER:-playenest_admin}"
main_db="${POSTGRES_DB:-playenest_prod}"
if ! is_valid_pg_ident "$db_user" || ! is_valid_pg_ident "$main_db"; then
  >&2 echo "ERROR: Invalid POSTGRES_USER or POSTGRES_DB identifier."
  exit 1
fi

echo "Waiting for PostgreSQL at $host..."

until pg_isready -h "$host" -U "$db_user" -d "$main_db"; do
  >&2 echo "Postgres is unavailable - sleeping"
  sleep 1
done

>&2 echo "Postgres is up"

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  if [ -z "${POSTGRES_PASSWORD:-}" ]; then
    >&2 echo "ERROR: POSTGRES_PASSWORD environment variable is required when POSTGRES_MULTIPLE_DATABASES is set."
    exit 1
  fi
  OLD_IFS="$IFS"
  IFS=','
  set -- $POSTGRES_MULTIPLE_DATABASES
  IFS="$OLD_IFS"
  for db in "$@"; do
    db=$(printf '%s' "$db" | tr -d '[:space:]')
    [ -z "$db" ] && continue
    if ! is_valid_pg_ident "$db"; then
      >&2 echo "ERROR: Invalid database identifier '$db'."
      exit 1
    fi
    echo "Ensuring database '$db' exists..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql -v ON_ERROR_STOP=1 -h "$host" -U "$db_user" -d "$main_db" -v target_db="$db" -v target_user="$db_user" <<'EOSQL'
SELECT format('CREATE DATABASE %I', :'target_db')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'target_db')\gexec
GRANT ALL PRIVILEGES ON DATABASE :"target_db" TO :"target_user";
EOSQL
  done
fi

>&2 echo "Database setup verified - checking database migrations"

if [ -f "./scripts/migrate.sh" ]; then
  echo "Running database migrations..."
  ./scripts/migrate.sh
elif command -v npx >/dev/null 2>&1; then
  echo "Running prisma migrate deploy..."
  npx prisma migrate deploy
fi

>&2 echo "Database migrations verified - executing command"
exec "$@"
