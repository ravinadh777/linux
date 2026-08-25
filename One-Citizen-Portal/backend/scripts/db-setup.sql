-- oneCitizen — one-time PostgreSQL bootstrap.
-- Creates the application role + database used by PERSISTENCE_DRIVER=postgres.
-- Run once as a superuser (adjust the password to match backend/.env), e.g.:
--
--   psql -U postgres -h 127.0.0.1 -f backend/scripts/db-setup.sql
--
-- Tables/indexes are created automatically by the app on boot (DB_AUTO_MIGRATE),
-- and identities/clients are seeded from data/seed on first run (DB_SEED).

-- Idempotent role creation.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'onecitizen') THEN
    CREATE ROLE onecitizen WITH LOGIN PASSWORD 'onecitizen';
  END IF;
END
$$;

-- Database (CREATE DATABASE cannot run inside a DO block / transaction).
-- If it already exists this line errors harmlessly — ignore "already exists".
CREATE DATABASE onecitizen OWNER onecitizen;

GRANT ALL PRIVILEGES ON DATABASE onecitizen TO onecitizen;
