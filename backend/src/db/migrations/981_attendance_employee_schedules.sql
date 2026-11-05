-- 981 Attendance: per-employee schedules and office dynamic-DNS hostnames (Owner decisions 2026-10-29).
-- Owner: BE1. Forward-only, additive.

-- An employee's own start time and/or working days. Rows are never edited: a change (or "use company
-- default", both values NULL) is a new row from `effective_from`, so past sessions keep the schedule that
-- applied on their work date. Duration (9 h), grace, holidays and the timezone stay company-wide.
CREATE TABLE IF NOT EXISTS employee_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  effective_from DATE NOT NULL,
  shift_start CHAR(5) CHECK (shift_start IS NULL OR shift_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  working_days TEXT[] CHECK (working_days IS NULL OR cardinality(working_days) BETWEEN 1 AND 7),
  reason TEXT CHECK (reason IS NULL OR char_length(reason) <= 500),
  created_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_employee_schedules_employee ON employee_schedules(employee_id, effective_from DESC, created_at DESC);

-- The office has no static public IP: the allowlist may name dynamic-DNS hostnames resolved at check time.
ALTER TABLE attendance_settings_versions ADD COLUMN IF NOT EXISTS office_hostnames TEXT[] NOT NULL DEFAULT '{}';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN
    GRANT SELECT, INSERT ON employee_schedules TO udigity_app;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'employee_schedules grants skipped (insufficient privilege)';
END $$;
