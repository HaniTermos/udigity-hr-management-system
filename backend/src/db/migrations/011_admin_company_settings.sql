-- 011 Admin: company settings (SCR-OWN-011; plan.md §6 SET kinds). Owner: BE1. Forward-only.
-- One row (id = 1) holding the Owner-saved values of SET-kind policy keys as JSON. A key that is not
-- present falls back to its env default from shared/flags.ts. Every value is a Demonstration
-- alternative — not approved (docs/policy-defaults.md). Attendance settings are versioned separately
-- (attendance_settings_versions, Increment 3).

CREATE TABLE IF NOT EXISTS company_settings (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  "values" JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof("values") = 'object'),
  version INTEGER NOT NULL DEFAULT 1,
  updated_by UUID REFERENCES employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO company_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- Audit read filters (OWN-010): actor and time range.
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON audit_events(actor_id, created_at);
