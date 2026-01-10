#!/bin/bash

# Fix database permissions for kontado user
# This script connects to PostgreSQL and grants necessary permissions

set -e

echo "🔧 Fixing database permissions for kontado user..."

# Get database connection details from environment or use defaults
DB_HOST="${DB_HOST:-10.10.13.50}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-kontado}"
DB_USER="${DB_USER:-kontado}"
ADMIN_USER="${ADMIN_USER:-postgres}"

echo "Connecting to database at ${DB_HOST}:${DB_PORT} as ${ADMIN_USER}..."

# Create a temporary SQL file
SQL_FILE=$(mktemp)
cat > "$SQL_FILE" <<EOF
-- Grant CONNECT privilege on the database
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to the database
\c ${DB_NAME}

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO ${DB_USER};

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${DB_USER};

-- Grant all privileges on all existing sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${DB_USER};

-- Grant privileges on future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DB_USER};
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${DB_USER};

-- Verify permissions
\du ${DB_USER}
EOF

# Try to run the SQL script
# You may need to adjust the connection method based on your setup
if command -v psql &> /dev/null; then
    echo "Running SQL script..."
    PGPASSWORD="${ADMIN_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -f "$SQL_FILE"
else
    echo "⚠️  psql not found. Please run the following SQL commands manually:"
    echo ""
    cat "$SQL_FILE"
    echo ""
    echo "Or connect to the database and run:"
    echo "  psql -h ${DB_HOST} -p ${DB_PORT} -U ${ADMIN_USER} -d postgres -f $SQL_FILE"
fi

# Clean up
rm -f "$SQL_FILE"

echo "✅ Done! Please verify the permissions were granted correctly."
