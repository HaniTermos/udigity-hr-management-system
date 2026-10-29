# Backups (policy D19)

Run by the `backup` service in `docker-compose.prod.yml` (image `devops/backup.Dockerfile`, script `backupd.sh`).

| What | When | Where (volume `backups`) | Kept |
|---|---|---|---|
| Logical dump `pg_dump -Fc` (`pg-backup.sh`) | nightly at `BACKUP_TIME` in `TZ` (default 02:30) | `daily/`, `weekly/` (Sunday), `monthly/` (1st) `udigity-<UTC stamp>.dump.age` + `.sha256` | 14 / 8 / 6 |
| Physical base backup `pg_basebackup -Ft -z -X fetch` | weekly on `BASE_BACKUP_DAY` (default Sunday), and on first start | `base/base-<stamp>.tar.gz.age` + `.sha256` | `KEEP_BASE` (2) |
| WAL segments (`archive_command` on `db`) | at least every 15 min (`archive_timeout=900`) when there were writes | `wal/<segment>.age` | back to the oldest kept base backup |

- **Recovery points:** any moment since the oldest kept base backup (7 to 14 days back with the defaults) via base
  backup + WAL; older points only at dump granularity (daily for 14 days, then weekly, then monthly).
- **Encryption:** everything is encrypted with the age **public** key (`AGE_RECIPIENT`) before it is written to the
  `backups` volume; the dump and the base backup are piped straight into `age`, so no plaintext copy touches disk. The
  private key stays offline with the Owner. Raw WAL sits in the `wal_archive` volume for at most about a minute (the
  same disk as the live database, so no extra exposure) until `backupd` encrypts it and deletes the raw copy.
  Chosen over "raw WAL on the server" because it costs one `age` call per segment and keeps the `backups` volume
  uniformly encrypted, so it can be copied off-server as is.
- **Database access:** role `udigity_backup` (`devops/postgres/init/20-backup-role.sh`): `pg_read_all_data` +
  `REPLICATION`, plus `INSERT`/`UPDATE(occurrences)` on `ops_alerts` only. Not the owner, not the app role. Its
  password is in `devops/env/backup.env`.
- **Failures** (dump, base backup, WAL encryption or pruning, failing `archive_command`, missing config) are written to
  `ops_alerts` (one row per kind per 15 min); the worker emails them to `ALERT_EMAIL_TO`. Best effort: if the database
  is down the alert is only in `docker compose logs backup`, and the container turns **unhealthy** when there has been
  no successful nightly dump for 26 h.
- **Commands:** `docker compose -f docker-compose.prod.yml exec backup backupd nightly | base | wal | health`.
- **Same-server exception (Owner, 2026-10-29):** the `backups` volume is on the same server as the database. Losing the
  server or its disk loses the database **and** the backups. Upgrade path: copy the (already encrypted) volume
  off-server, e.g. a host cron `rclone sync $(docker volume inspect -f '{{.Mountpoint}}' udigity_backups) remote:udigity`.
- `restore-drill.sh`: (a) restores a dump, (b) `pitr` restores a base backup + WAL to a point in time, both into a
  throwaway container on a workstation. Runbook and drill log: `devops/DEPLOY.md` section 11.

## Keys

| Option | Setup | Notes |
|---|---|---|
| **age** (used by the container) | `age-keygen -o udigity-backup.agekey` on the Owner's machine; only the `age1...` public key goes in `backup.env` | Tiny, no keyring, no expiry |
| gpg | legacy host-cron mode only (`pg-backup.sh` without `PGHOST`, `BACKUP_ENCRYPTION=gpg`) | Keyring and expiry handling |

The **private key never lives on the server**. Keep two offline copies (password manager plus a USB stick in a safe).
Without it the backups cannot be read.
