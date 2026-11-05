-- Review fix 2026-11-04 (FIX-DB): database integrity, least privilege and duplicate history.
-- Findings D-01, D-02, D-06, D-09, D-10, D-11 (S-27), D-13 of docs/review/2026-11-04/findings/D-database.md.
-- Safe on a fresh install and on an upgrade with data: additive objects, a backfill that cannot conflict,
-- privilege changes, and NOT VALID constraints validated only when every existing row passes.
-- No row is changed or removed.

-- ---------------------------------------------------------------------------------------------
-- D-11 / S-27 (Owner 2026-11-04): a phone removed from a business by an edit is kept as history and
-- still blocks duplicates, like an archived business (D20). `business_phones` keeps holding the
-- CURRENT numbers (every reader stays unchanged); `business_phone_registry` holds every number a
-- business has ever had, current and removed. Its primary key is the global uniqueness guarantee:
-- a number belongs to one business forever (the Owner resolves real shared-number cases, D11).
-- The registry is written only by the trigger below (SECURITY DEFINER); the app role may only read it.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS business_phone_registry (
  normalized_phone  VARCHAR(20) PRIMARY KEY,
  business_id       UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  first_added_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- NULL while the number is one of the business's current phones; set when an edit removes it.
  removed_at        TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_business_phone_registry_business ON business_phone_registry(business_id);

-- Backfill the current numbers (already globally unique through uq_business_phones_normalized).
INSERT INTO business_phone_registry (normalized_phone, business_id, first_added_at)
SELECT normalized_phone, business_id, created_at FROM business_phones
ON CONFLICT (normalized_phone) DO NOTHING;

CREATE OR REPLACE FUNCTION business_phone_registry_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public AS $$
DECLARE
  claimed UUID;
BEGIN
  IF TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND (NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone
                                              OR NEW.business_id IS DISTINCT FROM OLD.business_id)) THEN
    UPDATE business_phone_registry SET removed_at = now()
     WHERE normalized_phone = OLD.normalized_phone AND business_id = OLD.business_id AND removed_at IS NULL;
  END IF;
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (NEW.normalized_phone IS DISTINCT FROM OLD.normalized_phone
                                              OR NEW.business_id IS DISTINCT FROM OLD.business_id)) THEN
    -- A business may take back a number it removed earlier; any other business is refused.
    INSERT INTO business_phone_registry (normalized_phone, business_id) VALUES (NEW.normalized_phone, NEW.business_id)
    ON CONFLICT (normalized_phone) DO UPDATE SET removed_at = NULL
     WHERE business_phone_registry.business_id = EXCLUDED.business_id
    RETURNING business_id INTO claimed;
    IF claimed IS NULL THEN
      -- Same constraint name as the current-phone index, so the API shapes it as DUPLICATE_BLOCKED.
      RAISE EXCEPTION 'this phone number belongs to another business (kept as history)'
        USING ERRCODE = 'unique_violation', CONSTRAINT = 'uq_business_phones_normalized';
    END IF;
  END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION business_phone_registry_sync() FROM PUBLIC;

DROP TRIGGER IF EXISTS trg_business_phone_registry_sync ON business_phones;
CREATE TRIGGER trg_business_phone_registry_sync
  AFTER INSERT OR UPDATE OF normalized_phone, business_id OR DELETE ON business_phones
  FOR EACH ROW EXECUTE FUNCTION business_phone_registry_sync();

-- ---------------------------------------------------------------------------------------------
-- D-06: the similar-name warning (D11, pg_trgm threshold 0.6) through the trigram GIN index.
-- `similarity(a, b) >= t` cannot use idx_businesses_name_trgm; the `%` operator can. The function's
-- SET clause scopes the threshold to this call (it never leaks into the pooled session), and the
-- explicit `>=` keeps the exact "at least the threshold" semantics of the previous query.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION businesses_similar_names(p_name TEXT, p_threshold REAL, p_exclude UUID, p_limit INTEGER)
RETURNS TABLE (match_id UUID, match_name TEXT, match_branch TEXT, match_similarity DOUBLE PRECISION, match_archived BOOLEAN)
LANGUAGE plpgsql SET pg_trgm.similarity_threshold = 0.3 SET search_path = pg_catalog, public AS $$
BEGIN
  -- Index prefilter a hair below the threshold (float rounding); the exact rule is the `>=` below.
  PERFORM set_config('pg_trgm.similarity_threshold', GREATEST(p_threshold - 0.0001, 0)::text, true);
  RETURN QUERY
    SELECT b.id, b.name::text, b.branch::text, round(similarity(b.normalized_name, p_name)::numeric, 3)::float8,
           b.archived_at IS NOT NULL
      FROM businesses b
     WHERE b.normalized_name % p_name
       AND similarity(b.normalized_name, p_name) >= p_threshold
       AND b.normalized_name <> p_name
       AND (p_exclude IS NULL OR b.id <> p_exclude)
     ORDER BY similarity(b.normalized_name, p_name) DESC, b.created_at
     LIMIT p_limit;
END;
$$;

-- ---------------------------------------------------------------------------------------------
-- D-13: indexes for the retention anti-joins and the foreign-key checks of the rows it purges.
-- ---------------------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_notification_deliveries_event ON notification_deliveries(event_id);
CREATE INDEX IF NOT EXISTS idx_two_factor_factors_pending_token
  ON two_factor_factors(pending_enrollment_token_id) WHERE pending_enrollment_token_id IS NOT NULL;

-- ---------------------------------------------------------------------------------------------
-- D-10: no cascades on the role tables. Custom roles are deactivated, never deleted or renamed (S-26),
-- so RESTRICT changes no app path; it stops a manual id change or delete from rewriting employees
-- or silently dropping permission rows.
-- ---------------------------------------------------------------------------------------------
ALTER TABLE employees DROP CONSTRAINT IF EXISTS fk_employees_role;
ALTER TABLE employees ADD CONSTRAINT fk_employees_role FOREIGN KEY (role) REFERENCES custom_roles(id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_id_fkey;
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES custom_roles(id)
  ON DELETE RESTRICT;
ALTER TABLE custom_roles DROP CONSTRAINT IF EXISTS custom_roles_created_by_fkey;
ALTER TABLE custom_roles ADD CONSTRAINT custom_roles_created_by_fkey FOREIGN KEY (created_by) REFERENCES employees(id)
  ON DELETE RESTRICT;

-- ---------------------------------------------------------------------------------------------
-- D-09: validate every NOT VALID check constraint whose existing rows all pass (a fresh install's
-- attendance_breaks_notes_len, for example). A constraint that legacy rows still violate (e.g.
-- deals_closed_evidence on a database closed before 987) stays NOT VALID and is reported; it is still
-- enforced for every new or updated row. Re-check later with:
--   SELECT conrelid::regclass, conname FROM pg_constraint WHERE NOT convalidated;
-- ---------------------------------------------------------------------------------------------
DO $$
DECLARE
  c RECORD;
BEGIN
  FOR c IN SELECT con.conrelid::regclass AS rel, con.conname
             FROM pg_constraint con JOIN pg_namespace n ON n.oid = con.connamespace
            WHERE n.nspname = 'public' AND NOT con.convalidated AND con.contype IN ('c', 'f')
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', c.rel, c.conname);
    EXCEPTION WHEN check_violation OR foreign_key_violation THEN
      RAISE NOTICE 'constraint % on % kept NOT VALID: existing rows violate it', c.conname, c.rel;
    END;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------------------------
-- D20 "attendance events preserve originals; corrections are additive". Corrections and adjustments
-- write effective_* and the additive correction rows; the original check-in facts never change, the
-- original check-out is written once, and sessions/breaks are never deleted.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION attendance_sessions_keep_originals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'attendance sessions are never deleted (D20)' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.employee_id IS DISTINCT FROM OLD.employee_id
     OR NEW.work_date IS DISTINCT FROM OLD.work_date OR NEW.origin IS DISTINCT FROM OLD.origin
     OR NEW.check_in_at IS DISTINCT FROM OLD.check_in_at
     OR NEW.check_in_verification IS DISTINCT FROM OLD.check_in_verification
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.check_out_at IS NOT NULL AND NEW.check_out_at IS DISTINCT FROM OLD.check_out_at) THEN
    RAISE EXCEPTION 'original attendance facts are immutable; record a correction instead (D20)'
      USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_attendance_sessions_keep_originals ON attendance_sessions;
CREATE TRIGGER trg_attendance_sessions_keep_originals
  BEFORE UPDATE OR DELETE ON attendance_sessions
  FOR EACH ROW EXECUTE FUNCTION attendance_sessions_keep_originals();

CREATE OR REPLACE FUNCTION attendance_breaks_keep_originals() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'attendance breaks are never deleted (D20)' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id OR NEW.session_id IS DISTINCT FROM OLD.session_id
     OR NEW.employee_id IS DISTINCT FROM OLD.employee_id OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR (OLD.ended_at IS NOT NULL AND NEW.ended_at IS DISTINCT FROM OLD.ended_at) THEN
    RAISE EXCEPTION 'original break facts are immutable (D20)' USING ERRCODE = 'integrity_constraint_violation';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_attendance_breaks_keep_originals ON attendance_breaks;
CREATE TRIGGER trg_attendance_breaks_keep_originals
  BEFORE UPDATE OR DELETE ON attendance_breaks
  FOR EACH ROW EXECUTE FUNCTION attendance_breaks_keep_originals();

-- ---------------------------------------------------------------------------------------------
-- D-01 / D-02: least privilege for the runtime group role `udigity_app`.
-- One function holds the whole grant policy, so the migration and the repair block of
-- devops/postgres/init/10-app-role.sh apply exactly the same set (a restore or a re-run of the
-- init script can no longer widen it again).
--   * DELETE only where the application or the retention job really deletes (grep `DELETE FROM`):
--     operational rows, the current phone/social rows of a business edit, permission rows of a role
--     edit, MFA factors on reactivation (D20). Business, people, deal, project and history tables:
--     archive/deactivate only (D20), so no DELETE.
--   * Append-only history/fact tables: no UPDATE either (the app only inserts them).
--   * The phone registry: read only (the trigger writes it).
--   * audit_events: SELECT + INSERT (012); schema_migrations: SELECT (012).
--   * New tables get SELECT, INSERT, UPDATE by default; a migration that needs DELETE grants it
--     explicitly AND adds the table to the list below.
-- ---------------------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udigity_apply_app_grants() RETURNS void
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
DECLARE
  t TEXT;
  delete_tables TEXT[] := ARRAY[
    'sessions', 'idempotency_records', 'notification_deliveries', 'reminders', 'outbox_consumer_runs',
    'outbox_events', 'background_jobs', 'notification_secrets', 'security_tokens', 'contact_reservations',
    'worker_heartbeats', 'business_phones', 'social_accounts', 'role_permissions', 'two_factor_factors'];
  append_only_tables TEXT[] := ARRAY[
    'business_edit_history', 'call_attempts', 'deal_changes', 'project_changes', 'meeting_changes',
    'follow_up_changes', 'outcome_reopenings', 'employee_schedules', 'attendance_settings_versions',
    'attendance_exceptions', 'export_records'];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN
    RAISE NOTICE 'udigity_app role missing: grants skipped (DEV-R5)';
    RETURN;
  END IF;
  GRANT USAGE ON SCHEMA public TO udigity_app;
  GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO udigity_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO udigity_app;
  REVOKE DELETE, TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM udigity_app;
  FOREACH t IN ARRAY delete_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('GRANT DELETE ON public.%I TO udigity_app', t);
    END IF;
  END LOOP;
  FOREACH t IN ARRAY append_only_tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('REVOKE UPDATE ON public.%I FROM udigity_app', t);
    END IF;
  END LOOP;
  REVOKE INSERT, UPDATE ON business_phone_registry FROM udigity_app;
  REVOKE UPDATE ON audit_events FROM udigity_app;
  REVOKE INSERT, UPDATE ON schema_migrations FROM udigity_app;
  -- Default privileges of the role that creates the tables (the migrator): no DELETE by default.
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE DELETE, TRUNCATE ON TABLES FROM udigity_app', current_user);
  EXECUTE format('ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public GRANT SELECT, INSERT, UPDATE ON TABLES TO udigity_app', current_user);
END;
$$;
REVOKE ALL ON FUNCTION udigity_apply_app_grants() FROM PUBLIC;

DO $$
BEGIN
  PERFORM udigity_apply_app_grants();
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'app grants skipped (insufficient privilege); run SELECT udigity_apply_app_grants() as the owner';
END $$;
