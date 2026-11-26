#!/bin/bash
set -euo pipefail

# Multiple database initialization script for PostgreSQL container
# Creates additional databases if specified in POSTGRES_MULTIPLE_DATABASES (comma-separated)

is_valid_pg_ident() {
    [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]]
}

if ! is_valid_pg_ident "$POSTGRES_USER"; then
    echo "ERROR: Invalid POSTGRES_USER identifier." >&2
    exit 1
fi

if [ -n "${POSTGRES_MULTIPLE_DATABASES:-}" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in ${POSTGRES_MULTIPLE_DATABASES//,/ }; do
        if ! is_valid_pg_ident "$db"; then
            echo "ERROR: Refusing invalid database identifier '$db'." >&2
            exit 1
        fi
        echo "Creating database '$db' if not exists..."
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v target_db="$db" -v target_user="$POSTGRES_USER" <<'EOSQL'
SELECT format('CREATE DATABASE %I', :'target_db')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'target_db')\gexec
GRANT ALL PRIVILEGES ON DATABASE :"target_db" TO :"target_user";
EOSQL
    done
    echo "Multiple databases created successfully."
fi
