#!/bin/bash

# ===========================
# MySQL Database Setup Script
# ===========================
# This script creates the database and LEAST PRIVILEGE users for Libero app

echo "🗄️  Setting up MySQL database for Libero..."
echo ""

# Load environment variables from .env file
ENV_FILE="../.env"
if [ -f "$ENV_FILE" ]; then
    echo "📂 Loading configuration from $ENV_FILE"
    export $(grep -v '^#' "$ENV_FILE" | grep -v '^$' | xargs)
else
    echo "⚠️  Warning: .env file not found at $ENV_FILE"
    echo "   Using default values..."
fi

# MySQL root password
if [ -z "$DB_ROOT_PASSWORD" ]; then
    read -sp "Enter MySQL root password: " ROOT_PASSWORD
    echo ""
else
    ROOT_PASSWORD="$DB_ROOT_PASSWORD"
    echo "✓ Using DB_ROOT_PASSWORD from .env"
fi

# Database configuration (from .env or defaults)
DB_NAME="${DB_NAME:-libero}"

# Least Privilege User (App)
APP_USER="${DB_USER:-libero_app}"
APP_PASSWORD="${DB_PASSWORD:-libero_password_2024}"

# Read-Only User (Reporting)
READONLY_USER="${DB_READONLY_USER:-libero_readonly}"
READONLY_PASSWORD="${DB_READONLY_PASSWORD:-libero_readonly_2024}"

echo ""
echo "Creating database and users with these settings:"
echo "  Database: $DB_NAME"
echo "  App User: $APP_USER (CRUD Only)"
echo "  ReadOnly User: $READONLY_USER (SELECT Only)"
echo ""

# Create database and user
docker exec -i mysql-container mysql -u root -p"$ROOT_PASSWORD" <<EOF
-- Create database
CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 1. Create Application User (Least Privilege - CRUD only)
CREATE USER IF NOT EXISTS '$APP_USER'@'%' IDENTIFIED BY '$APP_PASSWORD';
ALTER USER '$APP_USER'@'%' IDENTIFIED BY '$APP_PASSWORD';
GRANT SELECT, INSERT, UPDATE, DELETE ON $DB_NAME.* TO '$APP_USER'@'%';

-- 2. Create Read-Only User (Reporting)
CREATE USER IF NOT EXISTS '$READONLY_USER'@'%' IDENTIFIED BY '$READONLY_PASSWORD';
ALTER USER '$READONLY_USER'@'%' IDENTIFIED BY '$READONLY_PASSWORD';
GRANT SELECT ON $DB_NAME.* TO '$READONLY_USER'@'%';

-- Flush privileges
FLUSH PRIVILEGES;

-- Show databases
SHOW DATABASES;

-- Show users
SELECT User, Host FROM mysql.user WHERE User IN ('$APP_USER', '$READONLY_USER');
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Database setup completed successfully!"
    echo ""
    echo "📝 Update your .env file with these values:"
    echo ""
    echo "DB_USER=$APP_USER"
    echo "DB_PASSWORD=$APP_PASSWORD"
    echo "DB_NAME=$DB_NAME"
    echo "DATABASE_URL=mysql://$APP_USER:$APP_PASSWORD@mysql-container:3307/$DB_NAME"
    echo ""
else
    echo ""
    echo "❌ Error setting up database. Please check your root password."
    exit 1
fi
