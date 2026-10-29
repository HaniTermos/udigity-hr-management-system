#!/bin/sh
# Dedicated login role for the backup container (policy D19: backup credentials separate from app access).
#
#   BACKUP_DB_USER (default udigity_backup): pg_read_all_data (pg_dump) + REPLICATION (pg_basebackup), not a superuser,
#   owns nothing, cannot write any table except INSERT/UPDATE(occurrences) on ops_alerts (failure alerts).
#   Password: BACKUP_DB_PASSWORD from devops/env/backup.env (the db service loads that file when it exists).
#
# Runs on the first start of an EMPTY data directory, before the migrations exist; so after the first `migrate`
# (and after any restore) run it again by hand to add the ops_alerts grant. Idempotent:
#   docker compose -f docker-compose.prod.yml exec db sh /docker-entrypoint-initdb.d/20-backup-role.sh
# Skipped when BACKUP_DB_PASSWORD is not set (e.g. the local smoke test). No `exit`: the entrypoint sources this file.
set -eu

if [ -z "${BACKUP_DB_PASSWORD:-}" ]; then
  echo "BACKUP_DB_PASSWORD not set: backup role skipped"
else
  : "${POSTGRES_USER:?}" "${POSTGRES_DB:?}" "${PGDATA:?}"
  BACKUP_DB_USER="${BACKUP_DB_USER:-udigity_backup}"; export BACKUP_DB_USER
  case "$BACKUP_DB_USER" in "$POSTGRES_USER"|"${APP_DB_USER:-}"|udigity_app)
    echo "BACKUP_DB_USER must differ from the owner and the app roles" >&2; false ;; esac

  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'SQL'
\getenv bu BACKUP_DB_USER
\getenv bpw BACKUP_DB_PASSWORD
SELECT format('CREATE ROLE %I LOGIN', :'bu') WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'bu') \gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE REPLICATION NOBYPASSRLS INHERIT', :'bu', :'bpw') \gexec
SELECT format('GRANT pg_read_all_data TO %I', :'bu') \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', current_database(), :'bu') \gexec
SELECT to_regclass('public.ops_alerts') IS NOT NULL AS has_alerts \gset
\if :has_alerts
  SELECT format('GRANT INSERT, UPDATE (occurrences) ON ops_alerts TO %I', :'bu') \gexec
\else
  \echo 'ops_alerts not created yet: re-run this script after the first migrate'
\endif
SQL

  # pg_basebackup uses a replication connection, which "host all all all" does not cover.
  HBA_LINE="host replication $BACKUP_DB_USER all scram-sha-256"
  grep -qxF "$HBA_LINE" "$PGDATA/pg_hba.conf" || echo "$HBA_LINE" >> "$PGDATA/pg_hba.conf"
  psql -q --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -c 'SELECT pg_reload_conf()' >/dev/null
  echo "backup role ready: $BACKUP_DB_USER (read-only + replication, not superuser)"
fi
