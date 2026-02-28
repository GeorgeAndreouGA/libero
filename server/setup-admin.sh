#!/bin/bash

# ===========================
# Admin User Setup Script
# ===========================
# Creates or updates the default admin user
# Run this after restoring a backup to ensure admin credentials are correct

echo "🔐 Setting up Admin User..."
echo ""

# Load environment variables from .env (in parent directory)
if [ -f ../.env ]; then
    export $(grep -v '^#' ../.env | grep -v '^$' | xargs)
else
    echo "❌ Error: .env file not found in parent directory!"
    exit 1
fi

# Database credentials from .env
DB_NAME="${DB_NAME}"

# We need ROOT access
echo "🔒 Administrative access required."
read -sp "Enter MySQL ROOT password: " DB_ROOT_PASSWORD
echo ""
DB_USER="root"
DB_PASSWORD="$DB_ROOT_PASSWORD"

# Get admin credentials from .env
ADMIN_EMAIL="${ADMIN_EMAIL}"
ADMIN_PASSWORD="${ADMIN_PASSWORD}"

if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "❌ Error: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file!"
    exit 1
fi

# Generate bcrypt hash using Node.js and bcryptjs
echo "Generating password hash..."
ADMIN_PASSWORD_HASH=$(docker exec libero-app-prod node -e "
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('$ADMIN_PASSWORD', 12);
  console.log(hash);
")

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to generate password hash"
    echo "   Make sure libero-app-prod container is running"
    exit 1
fi

echo "Creating/updating admin user with email: $ADMIN_EMAIL"

# Insert or update admin user
docker exec -i mysql-container mysql -u $DB_USER -p$DB_PASSWORD $DB_NAME <<EOF
INSERT INTO \`users\` (
  \`id\`, 
  \`email\`,
  \`username\`, 
  \`password_hash\`, 
  \`full_name\`,
  \`role\`, 
  \`status\`, 
  \`date_of_birth\`,
  \`age_verified\`,
  \`email_verified\`, 
  \`created_at\`
) VALUES (
  'admin-user-default-001',
  '$ADMIN_EMAIL',
  'grandmaster',
  '$ADMIN_PASSWORD_HASH',
  'System Administrator',
  'admin',
  'active',
  '1990-01-01',
  TRUE,
  TRUE,
  NOW()
) ON DUPLICATE KEY UPDATE
  \`email\` = VALUES(\`email\`),
  \`password_hash\` = VALUES(\`password_hash\`),
  \`username\` = VALUES(\`username\`),
  \`role\` = 'admin',
  \`status\` = 'active',
  \`email_verified\` = TRUE;
EOF

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Admin user created/updated successfully!"
    echo ""
    echo "📋 Admin credentials:"
    echo "   Email: $ADMIN_EMAIL"
    echo "   Password: [hidden - check your .env file]"
    echo ""
    echo "⚠️  IMPORTANT: Keep your .env file secure and never commit it to version control!"
else
    echo "❌ Error creating admin user"
    exit 1
fi
