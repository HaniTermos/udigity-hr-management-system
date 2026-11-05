-- 300 MOD-assignment: calling_assignments  (owner BE3; Increment 4, activated from the Increment 2 draft)
-- Depends on: employees (001), businesses (BE2, 2xx). Forward-only, non-destructive. FKs RESTRICT (arch-b section 4).
-- SM-ASSIGNMENT-001: Unassigned = no open row. The open row (ended_at IS NULL) is the current assignment. NEW_LEAD is not stored (C-02).

CREATE TABLE IF NOT EXISTS calling_assignments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  assignee_id   UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_by   UUID REFERENCES employees(id) ON DELETE RESTRICT,
  source        VARCHAR(20) NOT NULL DEFAULT 'manual'
                CHECK (source IN ('manual', 'work_list', 'automatic')),
  reason        VARCHAR(500),
  started_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at      TIMESTAMPTZ,
  ended_by      UUID REFERENCES employees(id) ON DELETE RESTRICT,
  end_reason    VARCHAR(20) CHECK (end_reason IN ('reassigned', 'unassigned')),
  version       INTEGER NOT NULL DEFAULT 1,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT calling_assignments_end_consistent
    CHECK ((ended_at IS NULL AND end_reason IS NULL AND ended_by IS NULL)
        OR (ended_at IS NOT NULL AND end_reason IS NOT NULL))
);

-- Exactly one open assignment per business (the database is the arbiter of the race, S-4).
CREATE UNIQUE INDEX IF NOT EXISTS uq_calling_assignments_open_business
  ON calling_assignments(business_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calling_assignments_assignee_open
  ON calling_assignments(assignee_id) WHERE ended_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_calling_assignments_business_history
  ON calling_assignments(business_id, started_at DESC);
