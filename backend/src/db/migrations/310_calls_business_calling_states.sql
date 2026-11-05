-- 310 MOD-calls: business_calling_states  (owner BE3; Increment 4, activated from the Increment 2 draft)
-- Depends on: businesses (BE2, 200), employees (001).
-- 1:1 with businesses. Holds the current calling outcome (WF-CALL-003 section 2.3.1 table; R-10 keeps it a table), the D2
-- "callback to be scheduled" marker and last_touchpoint_at (DEC-001 Alt B input; read by BE2's access_facts view).
-- BE2 creates the row through calls.service.initCallingState(tx, businessId) inside the same transaction as the business insert.
-- Any change to a column read by access_facts (last_touchpoint_at) needs a REQUEST to BE2 in the same increment (plan 3.1).

CREATE TABLE IF NOT EXISTS business_calling_states (
  business_id            UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE RESTRICT,
  outcome                VARCHAR(30) NOT NULL DEFAULT 'pending'
                         CHECK (outcome IN ('pending', 'on_hold', 'needs_another_call', 'rejected', 'accepted')),
  outcome_changed_at     TIMESTAMPTZ,
  outcome_changed_by     UUID REFERENCES employees(id) ON DELETE RESTRICT,
  rejection_reason       VARCHAR(1000),
  callback_marker        BOOLEAN NOT NULL DEFAULT false,
  callback_marker_set_at TIMESTAMPTZ,
  last_touchpoint_at     TIMESTAMPTZ,
  version                INTEGER NOT NULL DEFAULT 1,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- A Rejected business never keeps a callback marker (B1).
  CONSTRAINT business_calling_states_rejected_no_marker CHECK (NOT (outcome = 'rejected' AND callback_marker))
);

CREATE INDEX IF NOT EXISTS idx_bcs_outcome ON business_calling_states(outcome);
CREATE INDEX IF NOT EXISTS idx_bcs_marker ON business_calling_states(business_id) WHERE callback_marker;
