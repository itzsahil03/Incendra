#!/bin/bash
set -e

if [ -z "$POSTGRES_MULTIPLE_DATABASES" ]; then
    echo "POSTGRES_MULTIPLE_DATABASES not set, skipping multi-db creation"
    exit 0
fi

echo "Multiple database creation requested: $POSTGRES_MULTIPLE_DATABASES"

for db in $(echo "$POSTGRES_MULTIPLE_DATABASES" | tr ',' ' '); do
    db_trimmed=$(echo "$db" | xargs)
    if [ -z "$db_trimmed" ]; then
        continue
    fi
    echo "Creating database: $db_trimmed"
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" <<-EOSQL
        CREATE DATABASE "$db_trimmed";
        GRANT ALL PRIVILEGES ON DATABASE "$db_trimmed" TO "$POSTGRES_USER";
EOSQL
done

echo "All databases created successfully"