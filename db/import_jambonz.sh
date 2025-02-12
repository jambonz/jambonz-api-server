#!/bin/bash
# This script imports the SQL dump file into the target MySQL server.
# It first drops the existing 'jambones' database (if it exists),
# recreates it, and then imports the dump file.

# Configuration variables
TARGET_HOST=
DB_USER=
DB_PASS=
DB_NAME=
IMPORT_FILE="jambones_export.sql"

# Drop the existing database (if any) and create a new one
echo "Dropping and recreating database '$DB_NAME' on $TARGET_HOST..."
mysql -h "$TARGET_HOST" -u "$DB_USER" -p"$DB_PASS" -e "DROP DATABASE IF EXISTS \`$DB_NAME\`; CREATE DATABASE \`$DB_NAME\`;"

if [ $? -ne 0 ]; then
    echo "Error dropping/creating database '$DB_NAME'."
    exit 1
fi

# Import the SQL dump into the newly created database
echo "Importing dump file '$IMPORT_FILE' into database '$DB_NAME'..."
mysql -h "$TARGET_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$IMPORT_FILE"

if [ $? -eq 0 ]; then
    echo "Database import successful."
else
    echo "Error importing the database."
    exit 1
fi
