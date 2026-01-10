-- Fix database permissions for kontado user
-- Run this as a PostgreSQL superuser (usually 'postgres')
-- 
-- Usage:
--   psql -h 10.10.13.50 -p 5432 -U postgres -d postgres -f fix-db-permissions.sql
--   (You'll be prompted for the postgres user password)

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
