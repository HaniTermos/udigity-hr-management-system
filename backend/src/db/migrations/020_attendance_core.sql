-- 020 Attendance core (MOD-attendance, Increment 3). Owner: BE1. Forward-only, non-destructive.
-- SM-ATTENDANCE-001, SM-CORRECTION-001, WF-ATT-001..003, WF-ADMIN-001, DEC-007..012, DEC-022, DEC-026.
-- Every policy value stored here is a Demonstration alternative — not approved (docs/policy-defaults.md).
--
-- Rules carried by the schema:
--  * One Open session per employee (IC-04): partial unique index.
--  * Originals are never overwritten (DEC-011): check_in_at / check_out_at are written once; corrections
--    write effective_* columns plus an attendance_corrections row beside the session.
--  * Punctuality, duration-vs-9 h and missing check-in/checkout are derived at read time, never stored as state.
--  * Settings are versioned (append-only rows) and apply to future sessions: each session records the version.

-- Attendance settings versions (WF-ADMIN-001). Append-only: a save inserts a new row.
CREATE TABLE IF NOT EXISTS attendance_settings_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version_no INTEGER NOT NULL UNIQUE CHECK (version_no >= 1),
  timezone TEXT NOT NULL CHECK (length(timezone) BETWEEN 1 AND 64),
  working_days TEXT[] NOT NULL,
  shift_start CHAR(5) NOT NULL CHECK (shift_start ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  shift_end CHAR(5) NOT NULL CHECK (shift_end ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  grace_minutes INTEGER NOT NULL CHECK (grace_minutes BETWEEN 0 AND 240),
  verification_mode TEXT NOT NULL CHECK (verification_mode IN ('ip', 'geofence', 'ipOrLocation', 'ipAndLocation', 'disabled')),
  office_ips TEXT[] NOT NULL DEFAULT '{}',
  holidays DATE[] NOT NULL DEFAULT '{}',
  summary_required BOOLEAN NOT NULL,
  summary_min_length INTEGER NOT NULL CHECK (summary_min_length BETWEEN 0 AND 2000),
  missing_checkout_flag_hours INTEGER NOT NULL CHECK (missing_checkout_flag_hours BETWEEN 0 AND 72),
  reason TEXT,
  created_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Remote attendance exceptions (DEC-010): per employee per company-local date range.
CREATE TABLE IF NOT EXISTS remote_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('requested', 'granted', 'rejected', 'revoked')),
  reason TEXT NOT NULL,
  requested_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  decided_by UUID REFERENCES employees(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS idx_remote_exceptions_employee ON remote_exceptions(employee_id, start_date, end_date);

-- Attendance sessions (SM-ATTENDANCE-001; DEC-026 states closed_provisional / pending_review).
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'closed_provisional', 'pending_review')),
  origin TEXT NOT NULL DEFAULT 'check_in' CHECK (origin IN ('check_in', 'retroactive')),
  work_date DATE NOT NULL,
  check_in_at TIMESTAMPTZ NOT NULL,
  check_out_at TIMESTAMPTZ,
  checkout_attempted_at TIMESTAMPTZ,
  effective_check_in_at TIMESTAMPTZ NOT NULL,
  effective_check_out_at TIMESTAMPTZ,
  check_out_unknown BOOLEAN NOT NULL DEFAULT false,
  adjusted BOOLEAN NOT NULL DEFAULT false,
  remote BOOLEAN NOT NULL DEFAULT false,
  remote_exception_id UUID REFERENCES remote_exceptions(id) ON DELETE RESTRICT,
  check_in_verification JSONB NOT NULL DEFAULT '{}'::jsonb,
  check_out_verification JSONB,
  checkout_failure_reason TEXT,
  summary_work_completed TEXT,
  summary_outstanding TEXT,
  summary_blockers TEXT,
  summary_notes TEXT,
  settings_version_id UUID REFERENCES attendance_settings_versions(id) ON DELETE RESTRICT,
  missing_checkout_flagged_at TIMESTAMPTZ,
  review_resolved_at TIMESTAMPTZ,
  review_resolved_by UUID REFERENCES employees(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (check_out_at IS NULL OR check_out_at >= check_in_at),
  CHECK (effective_check_out_at IS NULL OR effective_check_out_at >= effective_check_in_at)
);
-- IC-04: at most one Open session per employee (two devices at once → one wins).
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_sessions_one_open ON attendance_sessions(employee_id) WHERE state = 'open';
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_employee_date ON attendance_sessions(employee_id, work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_work_date ON attendance_sessions(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_review ON attendance_sessions(state) WHERE state IN ('closed_provisional', 'pending_review');

-- Corrections beside the original (DEC-011). Alt B request lifecycle + Owner direct / retroactive (N-2).
CREATE TABLE IF NOT EXISTS attendance_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  kind TEXT NOT NULL CHECK (kind IN ('request', 'direct', 'retroactive')),
  status TEXT NOT NULL CHECK (status IN ('submitted', 'approved', 'rejected', 'withdrawn', 'applied')),
  proposed_check_in_at TIMESTAMPTZ,
  proposed_check_out_at TIMESTAMPTZ,
  proposed_check_out_unknown BOOLEAN NOT NULL DEFAULT false,
  previous_check_in_at TIMESTAMPTZ,
  previous_check_out_at TIMESTAMPTZ,
  reason TEXT NOT NULL,
  closed_session_provisionally BOOLEAN NOT NULL DEFAULT false,
  decided_by UUID REFERENCES employees(id) ON DELETE RESTRICT,
  decided_at TIMESTAMPTZ,
  decision_reason TEXT,
  created_by UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- One open (Submitted) request per session (SM-CORRECTION-001, Proposed).
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_corrections_open
  ON attendance_corrections(session_id) WHERE status = 'submitted' AND session_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_employee ON attendance_corrections(employee_id, created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_corrections_status ON attendance_corrections(status);

-- J-04 detections (WF-ATT-003 Part 1). One row per (kind, work date, employee); employee is NULL for
-- the "not_configured" marker. Never closes a session.
CREATE TABLE IF NOT EXISTS attendance_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('missing_checkin', 'missing_checkout', 'not_configured')),
  work_date DATE NOT NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  session_id UUID REFERENCES attendance_sessions(id) ON DELETE RESTRICT,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_exceptions
  ON attendance_exceptions(kind, work_date, COALESCE(employee_id, '00000000-0000-0000-0000-000000000000'::uuid));
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_date ON attendance_exceptions(work_date);

-- DEV-R5: the restricted app role gets DML on the new tables through default privileges (012). Repeat
-- the grant explicitly when the group exists, so databases migrated before 012's defaults also work.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'udigity_app') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON attendance_settings_versions, remote_exceptions, attendance_sessions,
      attendance_corrections, attendance_exceptions TO udigity_app;
  END IF;
EXCEPTION WHEN insufficient_privilege THEN
  RAISE NOTICE 'attendance grants skipped (insufficient privilege)';
END $$;
