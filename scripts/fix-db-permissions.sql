-- Fix database permissions for kontado user
-- Run this as a PostgreSQL superuser (usually 'postgres')
-- 
-- IMPORTANT: You must connect DIRECTLY to the PRIMARY database server, not through:
--   - A connection pooler (PgBouncer) in transaction mode
--   - A read replica
--   - A proxy that makes connections read-only
--
-- Usage options:
--   1. Direct connection to primary:
--      psql -h <PRIMARY_IP> -p <PRIMARY_PORT> -U postgres -d postgres -f fix-db-permissions.sql
--
--   2. If using PgBouncer, use session mode (port 6432) or connect directly to PostgreSQL
--
--   3. If you have SSH access to the database server:
--      ssh user@10.10.13.50
--      sudo -u postgres psql -d postgres -f /path/to/fix-db-permissions.sql

-- First, grant CONNECT privilege on the database
GRANT CONNECT ON DATABASE kontado TO kontado;

-- Connect to the kontado database
\c kontado

-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO kontado;

-- Grant CREATE privilege on the schema (needed for migrations)
GRANT CREATE ON SCHEMA public TO kontado;

-- Grant all privileges on all existing tables
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO kontado;

-- Grant all privileges on all existing sequences
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO kontado;

-- Grant privileges on future tables and sequences (important for new migrations)
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO kontado;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO kontado;

-- Verify permissions
SELECT 
    grantee, 
    privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'kontado' 
LIMIT 10;

-- Show user info
\du kontado
