# Backup container (compose service "backup"): nightly encrypted pg_dump, weekly base backup, WAL encryption/pruning.
# Build context: repository root. No secrets in the image: the age PUBLIC key and the backup role password come from
# devops/env/backup.env at run time. Same major version as the db service so pg_dump/pg_basebackup match the server.
FROM postgres:17-alpine
RUN apk add --no-cache age bash tzdata \
 && install -d -o postgres -g postgres -m 700 /backups /wal
COPY devops/backup/backupd.sh devops/backup/pg-backup.sh /opt/backup/
RUN chmod 755 /opt/backup/*.sh && ln -s /opt/backup/backupd.sh /usr/local/bin/backupd
USER postgres
ENTRYPOINT ["/opt/backup/backupd.sh"]
CMD ["loop"]
