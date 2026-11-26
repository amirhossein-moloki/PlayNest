#!/bin/bash
set -euo pipefail

# Multiple database & least-privilege role initialization script for PostgreSQL container.

is_valid_pg_ident() {
    [[ "$1" =~ ^[a-zA-Z_][a-zA-Z0-9_]{0,62}$ ]]
}

if ! is_valid_pg_ident "$POSTGRES_USER" || ! is_valid_pg_ident "$POSTGRES_DB"; then
    echo "ERROR: Invalid POSTGRES_USER or POSTGRES_DB identifier." >&2
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
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -v target_db="$db" <<'EOSQL'
SELECT format('CREATE DATABASE %I', :'target_db')
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = :'target_db')\gexec
EOSQL
    done
    echo "Multiple databases created successfully."
fi

provision_app_role() {
    local target_db="$1"
    local app_user="$2"
    local app_pass="$3"

    if ! is_valid_pg_ident "$target_db" || ! is_valid_pg_ident "$app_user"; then
        echo "ERROR: Invalid database or role identifier ('$target_db' / '$app_user')." >&2
        exit 1
    fi

    echo "Provisioning least-privilege PostgreSQL role '$app_user' for database '$target_db'..."
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$target_db" \
        -v target_db="$target_db" -v app_user="$app_user" -v app_pass="$app_pass" <<'EOSQL'
SELECT format(
  CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user')
    THEN 'ALTER ROLE %I WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN PASSWORD %L'
    ELSE 'CREATE ROLE %I WITH NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT LOGIN PASSWORD %L'
  END,
  :'app_user', :'app_pass'
)\gexec
REVOKE ALL ON DATABASE :"target_db" FROM PUBLIC;
ALTER DATABASE :"target_db" OWNER TO :"app_user";
GRANT ALL PRIVILEGES ON DATABASE :"target_db" TO :"app_user";
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO :"app_user";
GRANT ALL ON SCHEMA public TO :"app_user";
EOSQL
}

SAYRA_APP_USER="${SAYRA_DB_USER:-sayra_app}"
BLOG_APP_DB="${BLOG_POSTGRES_DB:-blog_prod}"
BLOG_APP_USER="${BLOG_DB_USER:-blog_app}"

if [ -n "${SAYRA_DB_PASSWORD:-}" ]; then
    provision_app_role "$POSTGRES_DB" "$SAYRA_APP_USER" "$SAYRA_DB_PASSWORD"
fi

if [ -n "${BLOG_DB_PASSWORD:-}" ]; then
    provision_app_role "$BLOG_APP_DB" "$BLOG_APP_USER" "$BLOG_DB_PASSWORD"
fi
