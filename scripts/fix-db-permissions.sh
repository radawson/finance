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

# First, check if the connection is read-only
echo "Checking if database connection is writable..."
READ_ONLY_CHECK=$(PGPASSWORD="${ADMIN_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -tAc "SELECT pg_is_in_recovery();" 2>/dev/null || echo "error")

if [ "$READ_ONLY_CHECK" = "t" ] || [ "$READ_ONLY_CHECK" = "error" ]; then
    echo ""
    echo "⚠️  WARNING: Database connection appears to be read-only!"
    echo ""
    echo "This could be because:"
    echo "  1. You're connected to a read replica"
    echo "  2. A connection pooler (like PgBouncer) is in transaction mode"
    echo "  3. The database is in recovery/standby mode"
    echo ""
    echo "To fix permissions, you need to connect DIRECTLY to the PRIMARY database server."
    echo ""
    echo "Options:"
    echo "  1. Connect directly to the primary database (bypass pooler):"
    echo "     - Find the primary database server IP/port"
    echo "     - Connect directly: psql -h <PRIMARY_IP> -p <PRIMARY_PORT> -U postgres -d postgres"
    echo ""
    echo "  2. If using PgBouncer, connect in 'session' mode instead of 'transaction' mode:"
    echo "     - Use port 6432 (default PgBouncer admin port) or"
    echo "     - Connect with: psql -h ${DB_HOST} -p 6432 -U postgres -d postgres"
    echo ""
    echo "  3. If you have SSH access to the database server, connect locally:"
    echo "     ssh user@${DB_HOST}"
    echo "     sudo -u postgres psql -d postgres"
    echo ""
    echo "Once connected to a writable database, run these SQL commands:"
    echo ""
    cat <<'SQL_EOF'
GRANT CONNECT ON DATABASE kontado TO kontado;
\c kontado
GRANT USAGE ON SCHEMA public TO kontado;
GRANT CREATE ON SCHEMA public TO kontado;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kontado;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kontado;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kontado;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kontado;
\du kontado
SQL_EOF
    echo ""
    exit 1
fi

# Create a temporary SQL file
SQL_FILE=$(mktemp)
cat > "$SQL_FILE" <<EOF
-- Grant CONNECT privilege on the database
GRANT CONNECT ON DATABASE ${DB_NAME} TO ${DB_USER};

-- Connect to the database
\c ${DB_NAME}

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO ${DB_USER};

-- Grant CREATE privilege on the schema (needed for migrations)
GRANT CREATE ON SCHEMA public TO ${DB_USER};

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
if command -v psql &> /dev/null; then
    echo "Running SQL script..."
    PGPASSWORD="${ADMIN_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${ADMIN_USER}" -d postgres -f "$SQL_FILE"
else
    echo "⚠️  psql not found. Please run the following SQL commands manually:"
    echo ""
    cat "$SQL_FILE"
fi

# Clean up
rm -f "$SQL_FILE"

echo "✅ Done! Please verify the permissions were granted correctly."
