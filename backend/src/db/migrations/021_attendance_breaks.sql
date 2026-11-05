-- 021 Attendance Breaks Engine (MOD-attendance, Wave 2). Owner: BE1.
-- Supports employee pause/resume break timer, active counter, shift limit monitoring,
-- and auto-close upon session checkout.

CREATE TABLE IF NOT EXISTS attendance_breaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  break_type TEXT NOT NULL DEFAULT 'unpaid' CHECK (break_type IN ('paid', 'unpaid')),
  notes TEXT,
  auto_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ended_at IS NULL OR ended_at >= started_at),
  CHECK (duration_seconds IS NULL OR duration_seconds >= 0)
);

-- At most one active break per attendance session.
CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_breaks_active ON attendance_breaks(session_id) WHERE ended_at IS NULL;

-- Query performance indices for session history and employee analytics.
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_session ON attendance_breaks(session_id);
CREATE INDEX IF NOT EXISTS idx_attendance_breaks_employee ON attendance_breaks(employee_id, started_at);
