#!/bin/bash
# This script exports the 'jambones' database (schema and data)
# from the source MySQL server into a file.

# Configuration variables
SOURCE_HOST=
DB_USER=
DB_PASS=
DB_NAME=
EXPORT_FILE="jambones_export.sql"

# Export the database using mysqldump
echo "Exporting database '$DB_NAME' from $SOURCE_HOST..."
mysqldump -h "$SOURCE_HOST" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" > "$EXPORT_FILE"

# Check for errors
if [ $? -eq 0 ]; then
    echo "Database export successful. Export file created: $EXPORT_FILE"
else
    echo "Error exporting database '$DB_NAME'."
    exit 1
fi