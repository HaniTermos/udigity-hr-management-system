-- 988_projects_cancelled.sql — MOD-projects (BE4). Approved v1 policy (docs/policy-baseline-2026-10-29.md §D17).
-- Forward-only, additive: "Cancellation requires an Owner reason and preserves history" (supersedes OQ-11).
-- The status CHECK is replaced by a superset; tasks, history and the deal are never touched by a cancel.

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check CHECK (status IN
  ('scheduled','in_progress','waiting_for_client','blocked','delivered','completed','cancelled'));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancel_reason TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS cancelled_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_cancelled_has_reason;
ALTER TABLE projects ADD CONSTRAINT projects_cancelled_has_reason
  CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL) AND (status <> 'cancelled' OR cancel_reason IS NOT NULL));
