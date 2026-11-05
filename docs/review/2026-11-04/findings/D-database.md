# Agent D — database integrity, runtime roles, concurrency

Tested commit: `cab5ec9` plus the uncommitted Owner work, which this area does not touch. PostgreSQL 17.11, test container `udigity-test-db` (127.0.0.1:55432).
Mode: discovery only. No source was edited.

Throwaway databases: `udigity_test_rev_d` (fresh install, roles, concurrency) and `udigity_test_rev_d_upg` (upgrade path). Both are dropped.
Throwaway login roles: `udigity_api_revd` and `udigity_backup_revd`. They were created with the real `devops/postgres/init/10-app-role.sh` and `20-backup-role.sh`. For the backup script, `PGDATA` pointed at a scratch `pg_hba.conf`, so the container's own hba file was not changed. Both roles disappeared when the cluster was re-initialised (see below).

**Environment incident.** At about 09:04 UTC `udigity-test-db` stopped with `could not write to file "pg_wal/xlogtemp…": No space left on device`. Its data directory is a 512 MB tmpfs (`HostConfig.Tmpfs`) shared by every review agent. My two databases were small, and the crash happened before my synthetic load started. I restarted the container once, before the lead's stop instruction arrived. The restart re-initialised an empty cluster, so every agent's databases were lost. After the instruction I loaded no data. The empty `udigity_test_rev_d` I had just re-migrated is dropped.
Synthetic data created:
- Before the crash, only small amounts: the handful of upgrade-test rows, and about 25 businesses, 300 jobs and 300 outbox rows in the concurrency harness.
- After the lead allowed it again: one EXPLAIN dataset of 20 MB in total, with at most 3,200 rows per table (see D-13). It is dropped.

Scratch scripts are in `C:\Users\Hani\AppData\Local\Temp\claude\a25399f2550b68da\b1ed2321-d7ef-454b-bbf7-54f33e576861\scratchpad\agent-d\`: `schema.sql` (catalog queries), `probe.mts` (privileges as real logins), `legacy.sql` (upgrade-path rows), `race.mts` (concurrency through the full app with supertest) and `synth.sql` (not run).

---

## Summary

| ID | Severity | Release | Confidence | Title |
|---|---|---|---|---|
| D-01 | Medium | Non-blocker | Confirmed | The app role can hard-delete or rewrite every business and history table; D20 and "originals kept" are enforced only for `audit_events`, `call_attempts` and `business_edit_history` |
| D-02 | Medium | Non-blocker | Confirmed | Default privileges silently widen the narrow grants that migrations 980, 981 and 997 intended (days off, schedules and alerts all get DELETE) |
| D-03 | Medium | Non-blocker | Confirmed | Two concurrent ops-alert dispatchers send every alert twice (no claim or lease on `ops_alerts`) |
| D-04 | Low | Non-blocker | Confirmed | Legacy closed deals left by migration 987's `NOT VALID` path cannot be updated; an Owner financial correction returns 500 plus an ops alert |
| D-05 | Low | Non-blocker | Confirmed (code) | The retention and session-cleanup jobs run all their batches in ONE transaction, so the batching does not limit lock time |
| D-06 | Low | Non-blocker | Confirmed (EXPLAIN, 3k rows) | The similar-name check `similarity(normalized_name,$1) >= $2` cannot use the trigram GIN index, so every create or edit scans all businesses |
| D-07 | Low | Non-blocker | Confirmed (code) | Job and outbox completion do not check lease ownership; a job that outlives its lease (`maxLease` is shared by a whole claimed batch) can run twice |
| D-08 | Low | Non-blocker | Confirmed (code) | Network I/O inside or beside open transactions: the ops-alert job holds an idle-in-transaction client during SMTP sends; check-in/out resolve office DNS (≤ 2 s) while holding the employee advisory lock |
| D-09 | Low | Non-blocker | Confirmed | Two `NOT VALID` constraints are never validated, and no migration or runbook step validates them |
| D-10 | Low | Non-blocker | Confirmed | FK `ON UPDATE CASCADE` (employees.role → custom_roles) and `ON DELETE CASCADE` (role_permissions) remain; role-permission edits hard-delete rows |
| D-11 | Low | Non-blocker | Confirmed (code) | Business edits hard-delete `social_accounts` and removed `business_phones` rows (the history row is kept, the row and its id are not) |
| D-12 | Low | Non-blocker | Confirmed | `runtimeRoleProblems` misses some dangerous capabilities (`pg_execute_server_program`/`pg_write_server_files` membership, REPLICATION, CREATE on public) |
| D-13 | Low | Non-blocker | Confirmed (3k-row dataset) | Hot-query plans: all index-driven except the similar-name check (D-06), the outbox claim's outer seq scan, and the retention `event_id` anti-join |

Counts: Critical 0 · High 0 · Medium 3 · Low 10.

---

## D-01 — The app role can hard-delete or rewrite business and history tables

- **Severity** Medium · **Release** Non-blocker · **Confidence** Confirmed
- **Requirement:** policy-baseline D20 / DEC-031: no hard deletes through the normal application; history is preserved; call attempts, attendance events and audit keep their originals. DB defence-in-depth (DEV-R5/AT-2).
- **Location:** `backend/src/db/migrations/012_admin_restricted_app_role.sql:331,340`; `devops/postgres/init/10-app-role.sh` (`GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES`, `ALTER DEFAULT PRIVILEGES … SELECT, INSERT, UPDATE, DELETE`).
- **Reproduction:** fresh migrate as the owner, then the prod init script, then connect as the LOGIN role `udigity_api_revd` (`probe.mts`):
  ```
  ALLOWED  delete businesses (hard delete)
  ALLOWED  delete deals (hard delete)
  ALLOWED  delete employees
  ALLOWED  delete deal_changes (history)
  ALLOWED  update attendance_sessions originals
  REFUSED  update/delete/truncate audit_events: 42501
  ```
  The catalog query (`schema.sql`) shows `udigity_app` with `arwd` on all 56 tables except `audit_events` (ar) and `schema_migrations` (r). Only three triggers exist: `trg_audit_events_append_only`, `trg_business_edit_history_append_only` and `trg_call_attempts_immutable`.
- **Expected vs actual:** History and fact tables should be insert-only for the app: `deal_changes`, `project_changes`, `meeting_changes`, `follow_up_changes`, `outcome_reopenings`, `attendance_corrections`, `employee_schedules`, and the original `check_in_at`/`check_out_at` columns of `attendance_sessions`. Business aggregates (businesses, employees, deals, categories, projects) should be archive-only. Actually, any SQL-injection-class bug or code defect can hard-delete or rewrite them. The app code itself contains no `DELETE FROM` on these tables; see D-11 for the deletes it does run.
- **Root cause:** a blanket DML grant plus blanket default privileges.
- **Proposed fix** (needs Owner approval): a forward migration that runs `REVOKE DELETE` on the business, history and fact tables from `udigity_app`, and `REVOKE UPDATE` on the pure history tables. The same change goes into the init script's repair block. Alternatively, add append-only triggers on the history tables, as was done for `call_attempts`. Keep DELETE only where the app or retention needs it: sessions, idempotency_records, notification_deliveries, reminders, outbox_*, background_jobs, notification_secrets, security_tokens, contact_reservations, worker_heartbeats, business_phones, social_accounts, role_permissions, two_factor_factors.
- **Regression test:** extend `scripts/probe-runtime-role.ts` and `runtimeRole.test.ts` with "DELETE FROM businesses/deals/employees/deal_changes refused".
- **Limitations:** the effect on the retention job's needs has been checked against `retention.ts` only.

## D-02 — Default privileges widen the narrow grants of 980/981/997

- **Severity** Medium · **Release** Non-blocker · **Confidence** Confirmed
- **Location:** `980_attendance_policy_v1.sql:40` (`GRANT SELECT, INSERT, UPDATE ON attendance_days_off` — comment: "never hard-deleted"); `981_attendance_employee_schedules.sql:25` (`GRANT SELECT, INSERT ON employee_schedules` — comment: "Rows are never edited"); `997_ops_alerts.sql:22` (`SELECT, INSERT, UPDATE`).
- **Reproduction:** fresh install, then as the `udigity_api_revd` login: `DELETE FROM attendance_days_off` ALLOWED, `UPDATE employee_schedules` ALLOWED, `DELETE FROM employee_schedules` ALLOWED. The upgrade database shows the same: `has_table_privilege('udigity_app','attendance_days_off','DELETE') = t`, `employee_schedules UPDATE = t`, `ops_alerts DELETE = t`. `pg_default_acl` holds `{udigity_app=arwd/udigity_test}` for tables.
- **Expected vs actual:** the explicit grant reads as the intended privilege set, but the default ACL already granted `arwd` at CREATE TABLE. Each migration's explicit GRANT only adds privileges and never narrows them, so these intentions are not enforced.
- **Answer to the brief's "future tables" question:** new tables DO get grants automatically, as `arwd` (and `rU` on sequences), via `ALTER DEFAULT PRIVILEGES FOR ROLE <migrator>` (012) and the init script (as POSTGRES_USER). This holds only while migrations run as that same owner role. A different migrator role would get no grants and the API would fail with 42501. The prod compose and `migrate.env.example` do use POSTGRES_USER, so this is consistent today. Migrations 980–997 grant explicitly as well; their tables are reachable.
- **Fix:** in each such migration, `REVOKE` what is not intended (for example `REVOKE UPDATE, DELETE ON employee_schedules FROM udigity_app`), or change the default privileges to `SELECT, INSERT` and grant UPDATE/DELETE explicitly per table. Pairs with D-01.

## D-03 — Ops alerts emailed twice by two concurrent dispatchers

- **Severity** Medium · **Release** Non-blocker · **Confidence** Confirmed
- **Location:** `backend/src/modules/notifications/opsAlerts.ts:34-56`. It does a plain `SELECT … WHERE sent_at IS NULL … LIMIT 20`, sends, then runs `UPDATE … sent_at = now()`. It has no `FOR UPDATE SKIP LOCKED`, no lease and no conditional update.
- **Preconditions:** two dispatcher runs overlap. That happens with a second worker instance (`worker.ts` header: "a second instance is safe"), or when a J-14 run outlives its lease (see D-07). The scheduler's (kind, slot) uniqueness only stops the same slot running twice. A long SMTP stall plus the next 60 s slot also overlaps.
- **Reproduction:** `race.mts` T7: 3 unsent `ops_alerts`, `Promise.all([sendOpsAlerts(), sendOpsAlerts()])` with a counting transport (150 ms per send):
  `T7 ops alerts: 3 unsent rows, two concurrent dispatchers -> emails sent 6 (results {"sent":3} {"sent":3})`
- **Expected:** 3 emails.
- **Fix:** claim the rows the way `claimDueEmailDeliveries` does: `UPDATE ops_alerts SET attempts = attempts+1, lease_until = … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED) RETURNING …`. This needs a `lease_until` column. Alternatively, finish with `UPDATE … SET sent_at = now() WHERE id = $1 AND sent_at IS NULL` and send only after winning a claim.
- **Regression test:** the T7 scenario as a vitest test.

## D-04 — Legacy closed deals (`deals_closed_evidence NOT VALID`) cannot be updated

- **Severity** Low (there is no production database yet; this affects the demo/working DB and any database closed before 987) · **Release** Non-blocker · **Confidence** Confirmed
- **Location:** `987_deals_commercial_policy_v1.sql:31-43`; `backend/src/modules/deals/service.ts:870` (`correctFinancials`); `backend/src/middleware/errorHandler.ts` (only 23505 is mapped).
- **Reproduction (upgrade path):** apply migrations 001–972 with psql, one transaction, recording `schema_migrations`. Insert a deal closed under the old rule (`signature_date` + `payment_date`, no `signature_reference`). Run the real migrator for 980–997: all 10 apply. Then:
  ```sql
  SELECT conname, convalidated FROM pg_constraint WHERE NOT convalidated;
  --  attendance_breaks_notes_len | f
  --  deals_closed_evidence       | f
  UPDATE deals SET contract_amount=100, contract_currency='USD' WHERE id='…d1';
  -- ERROR: new row for relation "deals" violates check constraint "deals_closed_evidence"
  UPDATE deals SET assigned_developer_id=…, version=version+1 WHERE id='…d1';   -- same error
  ```
- **Expected vs actual:** the migration comment says existing rows are "kept as they are". They are kept, but they are frozen: any UPDATE that leaves `signature_reference` NULL fails. The Owner's D16 financial-correction path (`correctFinancials`) on such a deal returns **500 INTERNAL_ERROR and raises an `api.error` ops alert**, unless the same request also sets `agreementReference`.
- **Fix:** have `correctFinancials` require `agreementReference` when the stored value is NULL (a 400 with a field error), and map 23514 to a 409/422 in the error handler. Alternatively, have the Owner backfill the references and then `ALTER TABLE deals VALIDATE CONSTRAINT deals_closed_evidence`.
- **Also verified on the upgrade path (OK):** employees role checks 993 → 994: a custom-role employee (`sales_lead`) migrates, and an UPDATE after 994 succeeds (`UPDATE 1`). A signed deal with a date only still passes `deals_signed_has_fact`. 990 backfilled `followers_observed_at`. `access_facts` v5 returns the legacy closed deal and project. A new close of a reference-less signed deal is refused, which is the correct new rule; it also surfaces as 500 if the service does not pre-check, which was not tested.

## D-05 — Retention and session-cleanup jobs run in one transaction

- **Severity** Low · **Confidence** Confirmed (code)
- **Location:** `backend/src/modules/platform/module.ts:46-53` and `identity/module.ts:22-29`. Neither job sets `transactional: false`, so `execute()` uses `runSystemTx` (`platform/service.ts:193-197`). Yet `retention.ts:1-8` says each statement deletes at most 2000 rows "so a run never holds long locks".
- **Actual:** up to 10 passes × 2000 rows × 10 tables (about 200k deletes) commit together. Row locks and the snapshot are held for the whole run, and one failure rolls back everything.
- **Fix:** set `transactional: false` and run each `purge()` pass in its own short transaction, or in autocommit.

## D-06 — The similar-name check scans every business

- **Severity** Low · **Confidence** Confirmed (D-13 Q1/Q1b: the function form stays a Seq Scan even with `enable_seqscan=off`; the `%` operator form uses `idx_businesses_name_trgm`)
- **Location:** `backend/src/modules/businesses/repo.ts:381-391`: `WHERE similarity(normalized_name, $1) >= $2 … ORDER BY similarity(...) DESC`.
- **Root cause:** `idx_businesses_name_trgm` (GIN `gin_trgm_ops`) is used only by operators (`%`, `LIKE`, `<->` with GiST). A function call in WHERE cannot use it, so each create or edit computes trigram similarity over every row.
- **Fix:** `SET LOCAL pg_trgm.similarity_threshold = $2` and `WHERE normalized_name % $1`. Alternatively, a GiST trigram index with `ORDER BY normalized_name <-> $1 LIMIT 20`.
- **Verification command (to run):** `EXPLAIN (ANALYZE, BUFFERS)` on the query with 20k businesses, before and after the change.

## D-07 — Lease expiry lets a job run twice; completion does not check lease ownership

- **Severity** Low · **Confidence** Confirmed (code + T6b)
- **Location:** `platform/service.ts:206-233`. One claim uses `maxLease = max(leaseSeconds of all handlers)` (900 s) for up to 20 jobs, which then run **sequentially**. `markJobDone`/`markOutboxDone` (`platform/repo.ts`) run `UPDATE … WHERE id = $1` without checking the lease.
- **Evidence:** T6: two concurrent `claimJobs` (300 due rows) → `100+200 overlap 0`; two concurrent `claimOutboxEvents` → `200+100 overlap 0`, so SKIP LOCKED works. T6b: 61 s later the rows not yet done are re-claimed (`re-claimed 300`). With a second worker, or once the batch's total runtime passes the lease, a job runs twice. Outbox consumers are protected (`outbox_consumer_runs` is inserted in the same transaction as `handle()`). Jobs depend on each handler being idempotent; J-14 is not (D-03).
- **Fix:** claim per job with that handler's own lease, or renew it. Guard completion with `WHERE id=$1 AND lease_until = $claimedLease`.

## D-08 — Network I/O while holding a connection, transaction or lock

- **Severity** Low · **Confidence** Confirmed (code)
- **Ops alerts:** `notifications/module.ts:59-66` registers J-14 without `transactional: false`. The runner opens `BEGIN` on one pool client, while `sendOpsAlerts` uses other pool connections for SMTP sends. The client sits idle-in-transaction for the whole run: up to 20 alerts × recipients × SMTP timeout.
- **Check-in/out:** `attendance/service.ts:664-671` takes `pg_advisory_xact_lock('attendance:'+id)`, then `officeCheckNow` resolves dynamic-DNS hostnames (`officeDns.ts` `TIMEOUT_MS = 2000`, cached ≤ 5 min) inside the transaction. The cost is bounded at about 2 s per cache miss.
- **Verified OK:** e-mail delivery (J-02) sends outside any transaction (`transactional: false`; the result is written in its own short transaction, `notifications/service.ts:1293`). The deals DTO builders use `inSequence` and never `Promise.all` on a transaction client. The two `Promise.all` uses (`calls/service.ts:974`, `attendance/service.ts:1324`) run on the **pool** (`routes.ts` passes `pool`), not on a single client. The attendance one fans out one query per page row (N+1), which is pool pressure, not a correctness issue.

## D-09 — `NOT VALID` constraints never validated

- **Severity** Low · **Confidence** Confirmed
- `attendance_breaks_notes_len` (971: always added `NOT VALID`, even on an empty table, so it is `convalidated = f` on a **fresh install** too) and `deals_closed_evidence` (987, legacy path; see D-04).
- **Fix:** a follow-up migration that runs `ALTER TABLE … VALIDATE CONSTRAINT` when no violating rows exist (`DO $$ IF NOT EXISTS (violators) THEN VALIDATE`). Same consequence as D-04 for any break with notes over 500 characters written before 971: ending or auto-closing it would fail.

## D-10 — Cascades remaining on the role tables

- **Severity** Low · **Confidence** Confirmed (catalog)
- **Evidence:**
  - `fk_employees_role` employees → custom_roles is `ON UPDATE CASCADE` (014).
  - `role_permissions_role_id_fkey` is `ON DELETE CASCADE`.
  - `custom_roles_created_by_fkey` is `ON DELETE SET NULL`.
  - Every other FK is RESTRICT/NO ACTION.
  - The app never deletes `custom_roles` (S-26: deactivate only).
  - `replaceRolePermissions` (`access/dynamicRepo.ts:156`) hard-deletes and re-inserts the grant rows on each edit. History survives only in the audit event.
- **Fix:** change both FKs to RESTRICT (forward migration). Optionally keep permission history additively.

## D-11 — Business edits hard-delete phone and social rows

- **Severity** Low · **Confidence** Confirmed (code)
- **Location:** `businesses/repo.ts:209` (`DELETE FROM business_phones … NOT (normalized_phone = ANY(...))`) and `:257` (`DELETE FROM social_accounts WHERE business_id = $1`, then re-insert).
- **Effect:** a phone removed from a business no longer takes part in duplicate detection. D20 says archived phones keep participating; a removed phone is not archived, so this needs an Owner call. Social-account ids change on every save. Field-level before/after stays in `business_edit_history`.
- **Proposed:** an Owner decision on whether removed phones stay blocked. If yes, soft-remove with `removed_at` and keep the global unique index.

## D-12 — Gaps in `runtimeRoleProblems`

- **Severity** Low · **Confidence** Confirmed
- **Real-login results (OK):**
  - `udigity_api_revd`: `runtimeRoleProblems = []`. Not superuser, createrole, createdb, bypassrls or replication. SELECT/INSERT/UPDATE on app tables are allowed. UPDATE/DELETE/TRUNCATE `audit_events` → 42501. `ALTER TABLE audit_events DISABLE TRIGGER` → "must be owner". INSERT/DELETE `schema_migrations` → 42501. CREATE TABLE/FUNCTION in public → 42501 (PG15+ default). CREATE SCHEMA → 42501. `SET ROLE udigity_test`, `pg_read_file` and `COPY TO PROGRAM` → refused. TEMP tables allowed (PUBLIC default `T`; harmless).
  - Owner `udigity_test`: the guard refuses with all 7 problems (superuser, createrole, createdb, bypassrls, "owns 56 table(s)", audit change, migrations write).
  - `udigity_backup_revd`: REPLICATION yes, superuser no. Reads every table (pg_read_all_data, including `credentials` and `two_factor_factors` ciphertext — by design for pg_dump). Every write refused except `INSERT ops_alerts` and `UPDATE (occurrences) ops_alerts`. As designed.
- **Gap:** the guard does not check membership in `pg_execute_server_program`/`pg_write_server_files`/`pg_read_server_files`, `rolreplication`, or `has_schema_privilege(current_user,'public','CREATE')`. An operator mis-grant would pass silently.
- **Fix:** add those checks to the query in `shared/runtimeRole.ts`.

## D-13 — Hot-query plans (small dataset)

- **Confidence** Confirmed for the plan shapes. The timings come from a small dataset and are indicative only.
- **Dataset**, loaded after the lead allowed ≤ 3k rows per table: `udigity_test_rev_d` was 20 MB in total. It held 3,000 businesses, each with 1 phone, 1 social account and a calling state; 1,500 open assignments; 300 follow-ups; 150 deals; 50 projects; 75 open correction requests; 2,000 in-app notifications; 2,700 attendance sessions (30 employees × 90 days); 2,000 audit events; and 3,200 outbox events (3,000 done + 200 pending). The database was dropped afterwards. Script: `explain.sql`.

| Query | Plan | Exec time |
|---|---|---|
| Q1 similar-name, function form (`findSimilarNames`) | **Seq Scan** businesses, Rows Removed 3000. With `enable_seqscan=off` it is **still a Seq Scan** (the index is not usable) | 62 ms (cold) |
| Q1b operator form `normalized_name % $1` | Seq at this size; with `enable_seqscan=off`, **Bitmap Index Scan on idx_businesses_name_trgm** (the index is usable) | 11 ms / 33 ms |
| Q2 list/search: `LIKE '%…%'` OR phone EXISTS, plus call-center `access_facts` EXISTS | driven by `idx_calling_assignments_assignee_open` (100 rows), then the pkey; phone subplan via `idx_business_phones_business` | 6.2 ms |
| Q3 `access_facts` single business (`access.check`) | all index lookups (pkey, bcs pkey, `uq_follow_ups_open_business`, `idx_deals_business`) | 0.66 ms |
| Q3b `EXISTS access_facts … has_open_correction` over all businesses | merge semi join, hashed subplan | ~6 ms |
| Q4 outbox claim (`UPDATE … IN (SELECT … FOR UPDATE SKIP LOCKED)`) | `idx_outbox_events_due` for the inner select; outer **Seq Scan outbox_events** (3,200 rows, hashed IN) | 2.7 ms |
| Q5 inbox page / unread count | `idx_notification_deliveries_recipient` (backward / bitmap) | 0.16 ms |
| Q6 attendance employee + 30 days / company 30 days | `idx_attendance_sessions_work_date` | 0.4 / 0.8 ms |
| Q7 retention: done outbox events with no delivery (`d.event_id`) | Seq Scan notification_deliveries (no `event_id` index) | 1.7 ms |

- **Observations:**
  - Q1 confirms D-06.
  - Q4's outer seq scan grows with the retained outbox (30-day window). Rewriting the claim as `UPDATE … FROM (subquery) s WHERE o.id = s.id` or as a CTE gives a pkey lookup.
  - Q7 grows with deliveries × events; an index on `notification_deliveries(event_id)` is recommended.
  - Everything else is index-driven and sub-millisecond at this size.
- Static index review:
  - Business list/search uses `normalized_name LIKE '%…%'` (GIN trigram usable), plus correlated EXISTS on `business_phones` and `social_accounts` (indexed by `business_id`; trigram indexes exist).
  - `access_facts` joins are all on indexed keys (`calling_assignments` and `follow_ups` partial unique indexes, `deals(business_id)`, `projects(business_id)`, `idx_dcr_business_open`).
  - Outbox, job and delivery claims have partial due-indexes.
  - Inbox uses `(recipient_id, created_at)`. Attendance uses `(employee_id, work_date)` and `(work_date)`.
  - 56 FK columns have no leading index, all of them actor/"by" columns (for example `deals.closed_by_id`, `notification_deliveries.event_id`). Low impact, because employees are never deleted (RESTRICT checks would scan). `notification_deliveries.event_id` is the exception: the retention `NOT EXISTS (… d.event_id = o.id)` scans deliveries per outbox event, so an index is recommended there.

---

## Verified OK

- **Fresh install:** migrating an empty DB applies 45 migrations. Re-running prints "Database schema is already up to date" (idempotent). The runner applies all pending files in ONE transaction, so a failure rolls back the whole set. No migration contains non-transactional statements (no `CREATE INDEX CONCURRENTLY`, `VACUUM` or `ALTER TYPE … ADD VALUE`).
- **View replacements:** `CREATE OR REPLACE VIEW access_facts` (900–992) keeps its grants (`udigity_app` SELECT confirmed). The view is not auto-updatable, so the DML grant on it is inert.
- **Upgrade path 972 → 997:** succeeds and keeps data valid (D-04 notes the frozen legacy rows).
- **Types:** money is `NUMERIC(14,2)`/`NUMERIC(12,2)`. No `real`, `double precision`, `money` or `timestamp without time zone` columns exist. Business dates are `DATE` and instants are `timestamptz`.
- **Concurrency** (full app in-process, API pool connected as the real limited login; `race.mts`):
  - T1 duplicate create (same name + phone, two Data Entry users, different keys) ×10: `201,409 DUPLICATE_BLOCKED` every time, 10 rows.
  - T1b same Idempotency-Key double submit: `201` + `409 STATE_CONFLICT` (in-flight claim), 1 row.
  - T2 concurrent PATCH with the same version: `200,409 VERSION_CONFLICT`, final version 2 (no lost update; `findBusiness … FOR UPDATE` before the version check).
  - T3 reservation acquire ×2 by the assignee: `201` + `200` (idempotent re-acquire), 1 active row. Owner + agent while held: `409 RESERVATION_CONFLICT`.
  - T4 password-reset token submitted twice in parallel: `200,400 RESET_LINK_INVALID`, one audit `password_reset.completed` (`FOR UPDATE OF st` plus `used_at IS NULL` re-check).
  - T5 double check-in: `201,409 OPEN_SESSION`, 1 session. Double check-out: `200,409 NO_OPEN_SESSION`. Double break start: `201,409`, 1 open break.
  - T6 job and outbox claiming by two workers: overlap 0 (SKIP LOCKED).
- **Code review of other paths:**
  - Settings: `readCompanySettings(tx, true)` FOR UPDATE plus version check, and `writeCompanySettings` compare-and-set.
  - Custom roles: `updateRole … WHERE version = $5`, and the replace runs after the row lock. `version` is optional in the schema, so clients that omit it get last-write-wins; that is Low and owned by Agent C/B.
  - Project provisioning: `projects.deal_id UNIQUE` plus `ON CONFLICT (deal_id) DO NOTHING`, so at most one project per deal.
  - Deals: `accepted_attempt_id UNIQUE` plus `ON CONFLICT DO NOTHING`.
  - Assignments and reservations: partial unique indexes plus `ON CONFLICT … DO NOTHING`.
  - Attendance: advisory lock plus partial unique `uq_attendance_sessions_one_open`.
- **Pool lifecycle:** `withTransaction` always releases the client (`finally`), and ROLLBACK errors are swallowed. `runSystemNoTx` releases too. The migrator's owner pool is ended.
- **Retention vs D20:** `retention.ts` never touches audit, business, call-attempt, attendance or deal data. It purges operational rows only: sessions after 90 d, reservations without attempts after 90 d, notifications after 180 d (this includes unread in-app rows older than 180 d), jobs/outbox after 30 d, and tokens/secrets after 30 d. All of this falls under OQ-19 "current retention settings" (decisions.md line 130). RESTRICT FKs are respected: deliveries are purged before outbox events, and pending enrollment tokens are kept. `invalidateCredentialsForReactivation` deletes `two_factor_factors`, which matches D20 "do not restore … MFA secrets".
