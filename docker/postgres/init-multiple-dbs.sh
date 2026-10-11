#!/bin/bash
set -e

# Multiple database initialization script for PostgreSQL container
# Creates additional databases if specified in POSTGRES_MULTIPLE_DATABASES (comma-separated)

if [ -n "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"
    for db in $(echo $POSTGRES_MULTIPLE_DATABASES | tr ',' ' '); do
        echo "Creating database '$db' if not exists..."
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
            SELECT 'CREATE DATABASE "$db"'
            WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$db')\gexec
            GRANT ALL PRIVILEGES ON DATABASE "$db" TO "$POSTGRES_USER";
EOSQL
    done
    echo "Multiple databases created successfully."
fi
