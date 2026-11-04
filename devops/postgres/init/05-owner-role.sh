#!/bin/sh
# Gap 8 (V13.2-b): migrations must NOT run as a superuser. This creates the schema-owner role the migrate job uses.
#
#   POSTGRES_USER  = udigity_admin : the bootstrap SUPERUSER. Used by the init scripts, for the nightly pg_dump and for hands-on
#                    administration inside the db container. No application, migration or API credential refers to it.
#   OWNER_DB_USER  = udigity_owner : LOGIN, NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS. Owns the database
#                    and the public schema, so it can CREATE tables/functions/triggers/indexes and the TRUSTED extensions the
#                    migrations use (pgcrypto, pg_trgm), and nothing else: no other database, no roles, no files, no server settings.
#                    MIGRATION_DATABASE_URL (migrate.env) connects as this role.
#
# Runs first (05- sorts before 10-app-role.sh and 20-backup-role.sh) on the first start of an EMPTY data directory.
# Idempotent: re-run by hand to rotate the password or repair ownership (devops/DEPLOY.md section 8):
#   docker compose -f docker-compose.prod.yml exec db sh /docker-entrypoint-initdb.d/05-owner-role.sh
# No `exit`: the entrypoint sources this file.
set -eu

: "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${OWNER_DB_USER:?OWNER_DB_USER is required in postgres.env}" "${OWNER_DB_PASSWORD:?OWNER_DB_PASSWORD is required in postgres.env}"
case "$OWNER_DB_USER" in "$POSTGRES_USER"|"${APP_DB_USER:-}"|"${BACKUP_DB_USER:-udigity_backup}"|udigity_app|postgres)
  echo "OWNER_DB_USER must be its own role (not the bootstrap superuser, the app, the backup or the group role)" >&2; false ;; esac

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv ou OWNER_DB_USER
\getenv opw OWNER_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN', :'ou')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'ou') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS INHERIT', :'ou', :'opw') \gexec
-- Database owner: may CREATE in the database (needed for trusted extensions) and owns the public schema (PostgreSQL 15+:
-- pg_database_owner). The explicit schema statements keep this true for a database that was created before this script.
SELECT format('ALTER DATABASE %I OWNER TO %I', current_database(), :'ou') \gexec
SELECT format('ALTER SCHEMA public OWNER TO %I', :'ou') \gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'ou') \gexec
-- Hand over objects that already exist and belong to the bootstrap superuser (only relevant when this script is run by
-- hand on an older database; a fresh cluster has none). Skips quietly when there is nothing to do.
SELECT format('ALTER TABLE %s OWNER TO %I', c.oid::regclass, :'ou') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind IN ('r','p') AND pg_get_userbyid(c.relowner) = current_user \gexec
SELECT format('ALTER SEQUENCE %s OWNER TO %I', c.oid::regclass, :'ou') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'S' AND pg_get_userbyid(c.relowner) = current_user \gexec
SELECT format('ALTER VIEW %s OWNER TO %I', c.oid::regclass, :'ou') FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
 WHERE n.nspname = 'public' AND c.relkind = 'v' AND pg_get_userbyid(c.relowner) = current_user \gexec
SELECT format('ALTER FUNCTION %s OWNER TO %I', p.oid::regprocedure, :'ou') FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public' AND pg_get_userbyid(p.proowner) = current_user
   AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e') \gexec
SQL
echo "owner role ready: $OWNER_DB_USER (owns the database, not a superuser)"
