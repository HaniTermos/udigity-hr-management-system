#!/bin/sh
# Create (or refresh) the limited runtime role for the API and worker (DEV-R5 / AT-2, migration 012).
#
#   POSTGRES_USER  = udigity_owner : superuser + table owner; used ONLY for migrations and backups
#   udigity_app    = NOLOGIN group  : the grants of migration 012 (DML everywhere, audit_events SELECT+INSERT only)
#   APP_DB_USER    = udigity_api    : LOGIN member of udigity_app; the role DATABASE_URL connects as. Not a superuser.
#
# Runs automatically on the first start of an EMPTY data directory (docker-entrypoint-initdb.d).
# Idempotent: for an existing database, or after a restore, run it by hand (see devops/DEPLOY.md section 8):
#   docker compose -f docker-compose.prod.yml exec db sh /docker-entrypoint-initdb.d/10-app-role.sh
# It re-applies the grants when the tables already exist, so it also repairs a restored dump.
set -eu

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${APP_DB_USER:?APP_DB_USER is required in postgres.env}" "${APP_DB_PASSWORD:?APP_DB_PASSWORD is required in postgres.env}"
[ "$APP_DB_USER" != "$POSTGRES_USER" ] || { echo "APP_DB_USER must differ from POSTGRES_USER (the owner/superuser)" >&2; exit 1; }

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv app_user APP_DB_USER
\getenv app_pw APP_DB_PASSWORD

-- Group role (migration 012 creates it too when missing; creating it here first keeps the order independent).
SELECT 'CREATE ROLE udigity_app NOLOGIN NOINHERIT'
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') \gexec
ALTER ROLE udigity_app NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;

-- Login role: created if missing, password and attributes refreshed every run (password rotation).
SELECT format('CREATE ROLE %I LOGIN', :'app_user')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_user') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT', :'app_user', :'app_pw') \gexec
SELECT format('GRANT udigity_app TO %I', :'app_user') \gexec

-- Grants (the block of migration 012). Skipped on a fresh database: migration 012 applies them then.
SELECT to_regclass('public.audit_events') IS NOT NULL AS tables_exist \gset
\if :tables_exist
  GRANT USAGE ON SCHEMA public TO udigity_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO udigity_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO udigity_app;
  REVOKE UPDATE, DELETE, TRUNCATE ON audit_events FROM udigity_app;
  GRANT SELECT, INSERT ON audit_events TO udigity_app;
  REVOKE INSERT, UPDATE, DELETE ON schema_migrations FROM udigity_app;
  -- Review D-01/D-02: migration 998 holds the least-privilege policy (no DELETE on business/history
  -- tables, append-only history tables). Re-apply it so a restore or a re-run never widens the grants.
  SELECT to_regprocedure('public.udigity_apply_app_grants()') IS NOT NULL AS has_grant_policy \gset
  \if :has_grant_policy
    SELECT public.udigity_apply_app_grants();
  \endif
\endif
SELECT format('GRANT CONNECT ON DATABASE %I TO udigity_app', current_database()) \gexec
-- No DELETE by default (D20 archive-only, review D-02); a migration grants DELETE per table when needed.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE DELETE, TRUNCATE ON TABLES FROM udigity_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO udigity_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO udigity_app;
SQL
echo "app role ready: $APP_DB_USER (member of udigity_app, not superuser)"
