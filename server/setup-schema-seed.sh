#!/bin/bash

# ===========================
# Database Schema Setup Script
# ===========================

echo "🗄️  Setting up Libero database schema..."
echo ""

# Load environment variables from .env (in parent directory)
if [ -f ../.env ]; then
    export $(grep -v '^#' ../.env | grep -v '^$' | xargs)
else
    echo "❌ Error: .env file not found in parent directory!"
    exit 1
fi

# Database credentials from .env
DB_HOST="${DB_HOST}"
DB_NAME="${DB_NAME}"

# We need ROOT access to drop tables/apply schema (App user has restricted permissions)
echo "🔒 Administrative access required for schema changes."
read -sp "Enter MySQL ROOT password: " DB_ROOT_PASSWORD
echo ""
DB_USER="root"
DB_PASSWORD="$DB_ROOT_PASSWORD"

# Check if schema-seed.sql exists
if [ ! -f "sql/schema-seed.sql" ]; then
    echo "❌ Error: sql/schema-seed.sql not found!"
    exit 1
fi

echo "🗑️  Dropping all database objects (tables, views, triggers, procedures, functions, events)..."

# Generate and execute all drop statements in a single session with FK checks disabled
echo "  Generating drop statements..."
docker exec mysql-container mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -N -B -e "
SET SESSION group_concat_max_len = 1000000;

SELECT CONCAT(
  'SET FOREIGN_KEY_CHECKS = 0; ',
  IFNULL((SELECT GROUP_CONCAT(CONCAT('DROP TRIGGER IF EXISTS \`', TRIGGER_NAME, '\`;') SEPARATOR ' ') FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE()), ''),
  IFNULL((SELECT GROUP_CONCAT(CONCAT('DROP EVENT IF EXISTS \`', EVENT_NAME, '\`;') SEPARATOR ' ') FROM information_schema.EVENTS WHERE EVENT_SCHEMA = DATABASE()), ''),
  IFNULL((SELECT GROUP_CONCAT(CONCAT('DROP PROCEDURE IF EXISTS \`', ROUTINE_NAME, '\`;') SEPARATOR ' ') FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'PROCEDURE'), ''),
  IFNULL((SELECT GROUP_CONCAT(CONCAT('DROP FUNCTION IF EXISTS \`', ROUTINE_NAME, '\`;') SEPARATOR ' ') FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = DATABASE() AND ROUTINE_TYPE = 'FUNCTION'), ''),
  IFNULL((SELECT GROUP_CONCAT(CONCAT('DROP VIEW IF EXISTS \`', TABLE_NAME, '\`;') SEPARATOR ' ') FROM information_schema.VIEWS WHERE TABLE_SCHEMA = DATABASE()), ''),
  IFNULL((SELECT GROUP_CONCAT(CONCAT('DROP TABLE IF EXISTS \`', TABLE_NAME, '\`;') SEPARATOR ' ') FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'), ''),
  'SET FOREIGN_KEY_CHECKS = 1;'
) AS drop_stmt;
" 2>/dev/null | docker exec -i mysql-container mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME 2>/dev/null

if [ $? -eq 0 ]; then
    echo "  ✅ All database objects dropped successfully!"
else
    echo "  ⚠️  Some drops may have failed (this is OK if database was empty)"
fi

echo "📝 Applying schema from sql/schema-seed.sql..."
# Apply the schema with UTF-8 encoding for Greek characters
docker exec -i mysql-container mysql --default-character-set=utf8mb4 -u $DB_USER -p$DB_PASSWORD $DB_NAME < sql/schema-seed.sql

if [ $? -eq 0 ]; then
    echo "✅ Schema applied successfully!"
    echo ""
    echo "Verifying tables..."
    docker exec -i mysql-container mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME -e "SHOW TABLES;"
    echo ""
    echo "📋 Next step: Run ./setup-admin.sh to create the admin user or the backup .sql file with the bets folder (has bets images ) if you lost everything" 
else
    echo "❌ Error applying schema"
    exit 1
fi
