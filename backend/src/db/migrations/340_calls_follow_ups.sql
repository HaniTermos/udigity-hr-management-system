-- 340 MOD-calls: follow_ups, follow_up_changes  (owner BE3; Increment 4, activated from the Increment 2 draft)
-- Depends on: businesses, employees, call_attempts (330).
-- SM-FOLLOWUP-001 (stored states: scheduled / completed / cancelled; due and overdue are derived from time).
-- B3-Q04: at most one open follow-up per business (partial unique index). D4: Rejected cancels open follow-ups in the same save.

CREATE TABLE IF NOT EXISTS follow_ups (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  responsible_id          UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  scheduled_for           TIMESTAMPTZ NOT NULL,
  purpose                 VARCHAR(500),
  state                   VARCHAR(12) NOT NULL DEFAULT 'scheduled'
                          CHECK (state IN ('scheduled', 'completed', 'cancelled')),
  created_by              UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  created_by_attempt_id   UUID REFERENCES call_attempts(id) ON DELETE RESTRICT,
  completed_by_attempt_id UUID REFERENCES call_attempts(id) ON DELETE RESTRICT,
  completed_at            TIMESTAMPTZ,
  completion_note         VARCHAR(1000),
  cancelled_at            TIMESTAMPTZ,
  cancel_reason           VARCHAR(500),
  cancel_source           VARCHAR(30)
                          CHECK (cancel_source IN ('user', 'reassignment', 'outcome_rejected')),
  version                 INTEGER NOT NULL DEFAULT 1,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT follow_ups_state_consistent CHECK (
    (state = 'scheduled' AND completed_at IS NULL AND cancelled_at IS NULL)
 OR (state = 'completed' AND completed_at IS NOT NULL AND cancelled_at IS NULL)
 OR (state = 'cancelled' AND cancelled_at IS NOT NULL AND completed_at IS NULL AND cancel_source IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_follow_ups_open_business ON follow_ups(business_id) WHERE state = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_follow_ups_responsible_open ON follow_ups(responsible_id, scheduled_for) WHERE state = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_follow_ups_calendar ON follow_ups(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_follow_ups_business ON follow_ups(business_id, created_at DESC);

-- Deferred FK from 330 (call_attempts.fulfils_follow_up_id). Adding a constraint does not UPDATE rows,
-- so the append-only trigger on call_attempts is not triggered.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_call_attempts_fulfils_follow_up') THEN
    ALTER TABLE call_attempts
      ADD CONSTRAINT fk_call_attempts_fulfils_follow_up
      FOREIGN KEY (fulfils_follow_up_id) REFERENCES follow_ups(id) ON DELETE RESTRICT;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS follow_up_changes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follow_up_id       UUID NOT NULL REFERENCES follow_ups(id) ON DELETE RESTRICT,
  kind               VARCHAR(20) NOT NULL
                     CHECK (kind IN ('scheduled', 'rescheduled', 'reassigned', 'completed', 'cancelled')),
  old_scheduled_for  TIMESTAMPTZ,
  new_scheduled_for  TIMESTAMPTZ,
  old_responsible_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  new_responsible_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  reason             VARCHAR(500),
  changed_by         UUID REFERENCES employees(id) ON DELETE RESTRICT,
  changed_at         TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_follow_up_changes_follow_up ON follow_up_changes(follow_up_id, changed_at);
