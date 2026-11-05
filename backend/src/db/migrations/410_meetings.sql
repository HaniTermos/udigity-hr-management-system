-- 410 MOD-meetings (owner BE4; Increment 5, promoted from the Increment 2 draft).
-- Depends on: 400_deals_core (deals), employees. SM-MEETING-001: Scheduled, Held, Cancelled, Missed (Missed = Proposed).
-- Rescheduled is an event (R-13), not a state.

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE RESTRICT,
  status VARCHAR(20) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','held','cancelled','missed')),
  title VARCHAR(200),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  location VARCHAR(300),                -- address or link, free text
  agenda TEXT,
  discovery_notes TEXT,                 -- recorded on Held; attached to the deal
  cancel_reason TEXT,
  outcome_recorded_at TIMESTAMPTZ,
  outcome_recorded_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  reschedule_count INTEGER NOT NULL DEFAULT 0,   -- convenience counter; history is meeting_changes
  created_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT meetings_end_after_start CHECK (ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT meetings_cancel_reason CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_meetings_deal ON meetings (deal_id);
CREATE INDEX IF NOT EXISTS idx_meetings_starts ON meetings (starts_at);
CREATE INDEX IF NOT EXISTS idx_meetings_status_starts ON meetings (status, starts_at);

-- >= 1 attendee is enforced in the service (same transaction). Attendees are employees.
-- Attendance alone grants no access (OI-29).
CREATE TABLE IF NOT EXISTS meeting_attendees (
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  removed_at TIMESTAMPTZ,
  PRIMARY KEY (meeting_id, employee_id)
);
CREATE INDEX IF NOT EXISTS idx_meeting_attendees_employee ON meeting_attendees (employee_id);

CREATE TABLE IF NOT EXISTS meeting_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE RESTRICT,
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN
    ('scheduled','rescheduled','held','missed','cancelled','notes_updated')),
  before_value JSONB,     -- previous starts_at/ends_at/location/attendee ids/notes
  after_value JSONB,
  reason TEXT,
  actor_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_meeting_changes_meeting ON meeting_changes (meeting_id, created_at);
