# Backup container (compose service "backup"): nightly encrypted pg_dump, weekly base backup, WAL encryption/pruning.
# Build context: repository root. No secrets in the image: the age PUBLIC key and the backup role password come from
# devops/env/backup.env at run time. Same major version as the db service so pg_dump/pg_basebackup match the server.
# G-05: pinned by digest; keep it identical to the db service in docker-compose.prod.yml (pg_dump/pg_basebackup must match the server major).
FROM postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b
RUN apk add --no-cache age bash tzdata \
 && install -d -o postgres -g postgres -m 700 /backups /wal
COPY devops/backup/backupd.sh devops/backup/pg-backup.sh /opt/backup/
RUN chmod 755 /opt/backup/*.sh && ln -s /opt/backup/backupd.sh /usr/local/bin/backupd
USER postgres
ENTRYPOINT ["/opt/backup/backupd.sh"]
CMD ["loop"]
