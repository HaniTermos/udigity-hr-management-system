-- 980 Attendance v1 policy (docs/policy-baseline-2026-10-29.md D1, D5, D6, D18). Owner: BE1.
-- Forward-only, additive: new columns with safe defaults, one new table, one widened CHECK. Nothing is
-- dropped or rewritten; shift_end and the break tables stay (shift end is now derived as start + 9 h,
-- break tracking is switched off by the CFG flag attendance.breaksEnabled).

-- D1: a settings version counts as configured only after the Owner explicitly confirmed the holiday
-- list (possibly empty). Versions saved before this migration stay unconfirmed until re-saved.
ALTER TABLE attendance_settings_versions ADD COLUMN IF NOT EXISTS holidays_confirmed BOOLEAN NOT NULL DEFAULT false;

-- D6: an Owner may complete a missing work summary (reason recorded). NULL = written by the employee.
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS summary_written_by UUID REFERENCES employees(id) ON DELETE RESTRICT;
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS summary_completion_reason TEXT;

-- D18: employee reminder at shift end + 1 h (`missing_checkout_reminder`), beside the +6 h flag.
-- Widening the kind list keeps every existing row valid.
ALTER TABLE attendance_exceptions DROP CONSTRAINT IF EXISTS attendance_exceptions_kind_check;
ALTER TABLE attendance_exceptions ADD CONSTRAINT attendance_exceptions_kind_check
  CHECK (kind IN ('missing_checkin', 'missing_checkout', 'missing_checkout_reminder', 'not_configured'));

-- D1: Owner-approved employee days off. Cancel is additive (cancelled_* columns); never hard-deleted.
CREATE TABLE IF NOT EXISTS attendance_days_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(btrim(reason)) BETWEEN 1 AND 1000),
  created_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES employees(id) ON DELETE RESTRICT,
  cancel_reason TEXT CHECK (cancel_reason IS NULL OR char_length(cancel_reason) <= 1000),
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date),
  CHECK ((cancelled_at IS NULL) = (cancelled_by IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_attendance_days_off_employee ON attendance_days_off(employee_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_attendance_days_off_active ON attendance_days_off(start_date, end_date) WHERE cancelled_at IS NULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN
    GRANT SELECT, INSERT, UPDATE ON attendance_days_off TO udigity_app;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'attendance_days_off grants skipped (insufficient privilege)';
END $$;
