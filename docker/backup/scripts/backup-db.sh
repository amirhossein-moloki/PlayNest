#!/bin/bash
set -euo pipefail
umask 077

echo "Starting database dump..."

mkdir -p /data/db

is_valid_pg_ident() {
  [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]]
}

MAIN_USER="${POSTGRES_USER:-playenest_admin}"
MAIN_DB="${POSTGRES_DB:-playenest_prod}"
if ! is_valid_pg_ident "$MAIN_USER" || ! is_valid_pg_ident "$MAIN_DB"; then
  echo "ERROR: Invalid POSTGRES_USER or POSTGRES_DB identifier." >&2
  exit 1
fi

DB_LIST="$MAIN_DB"
if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
  DB_LIST="$DB_LIST ${POSTGRES_MULTIPLE_DATABASES//,/ }"
fi

UNIQUE_DBS=$(printf '%s\n' $DB_LIST | sort -u)

cleanup() {
  rm -f /tmp/db_dump_*.sql /tmp/db_dump_*.sql.gz
}
trap cleanup EXIT

for db in $UNIQUE_DBS; do
  if ! is_valid_pg_ident "$db"; then
    echo "ERROR: Invalid database identifier '$db'." >&2
    exit 1
  fi
  echo "Backing up database '$db'..."
  TMP_DUMP=$(mktemp /tmp/db_dump_XXXXXX)
  PGPASSWORD="$POSTGRES_PASSWORD" pg_dump -h "$POSTGRES_HOST" -p "${POSTGRES_PORT:-5432}" -U "$MAIN_USER" -- "$db" > "$TMP_DUMP"
  gzip -f "$TMP_DUMP"
  mv "${TMP_DUMP}.gz" "/data/db/dump_${db}.sql.gz"
  echo "Database '$db' dump completed: /data/db/dump_${db}.sql.gz"
done

if [ ! -s "/data/db/dump_${MAIN_DB}.sql.gz" ]; then
  echo "ERROR: Primary database dump '/data/db/dump_${MAIN_DB}.sql.gz' is missing or empty!" >&2
  exit 1
fi

# Maintain backward compatibility copy for latest.sql.gz (main DB dump)
cp "/data/db/dump_${MAIN_DB}.sql.gz" /data/db/latest.sql.gz
