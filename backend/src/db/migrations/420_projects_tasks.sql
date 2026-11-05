-- 420 MOD-projects (owner BE4; Increment 5, promoted from the Increment 2 draft).
-- Depends on: 400_deals_core (deals), businesses, employees.
-- DEC-019 project statuses; OQ-07 N:M developers; OQ-09 milestone = task attribute; OQ-10 open tasks warn only;
-- OQ-11 no Cancelled project status. ONE task table (no work-item duplicate).
-- Task statuses: todo, in_progress, done, cancelled.
-- "Waiting for client" is a PROJECT status. A task-level client wait is the boolean client_dependency
-- (UI "Client dependency" chip), never a task status.

CREATE SEQUENCE IF NOT EXISTS project_code_seq START 1;

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE DEFAULT ('PRJ-' || lpad(nextval('project_code_seq')::text, 4, '0')),
  -- DEC-017: at most one project per deal. Makes E-14 provisioning retries idempotent.
  deal_id UUID NOT NULL UNIQUE REFERENCES deals(id) ON DELETE RESTRICT,
  -- denormalised from the deal so the access-facts view (BE2) needs no join through deals
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE RESTRICT,
  name VARCHAR(200) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'scheduled'
    CHECK (status IN ('scheduled','in_progress','waiting_for_client','blocked','delivered','completed')),
  status_note TEXT,                      -- current dependency note (waiting_for_client) / blocker reason (blocked)
  start_date DATE,
  target_date DATE,
  delivered_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,              -- read by the access-facts view (DEC-002 row 4)
  provisioned_by VARCHAR(20) NOT NULL DEFAULT 'auto' CHECK (provisioned_by IN ('auto','manual')),
  provisioned_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,   -- NULL = System (auto)
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT projects_dates CHECK (target_date IS NULL OR start_date IS NULL OR target_date >= start_date),
  CONSTRAINT projects_note_required CHECK (status NOT IN ('waiting_for_client','blocked') OR status_note IS NOT NULL),
  CONSTRAINT projects_completed_at CHECK ((status = 'completed') = (completed_at IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS idx_projects_business ON projects (business_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);

-- OQ-07: one or more Developers per project, assigned by Owner only (OQ-08).
-- History kept; current = unassigned_at IS NULL.
CREATE TABLE IF NOT EXISTS project_developer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  developer_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pda_current ON project_developer_assignments (project_id, developer_id) WHERE unassigned_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pda_developer_current ON project_developer_assignments (developer_id) WHERE unassigned_at IS NULL;

-- Status + schedule + assignment history (one table, same shape).
CREATE TABLE IF NOT EXISTS project_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  change_type VARCHAR(30) NOT NULL CHECK (change_type IN
    ('provisioned','status_changed','schedule_changed','developer_assigned','developer_unassigned')),
  before_value JSONB,
  after_value JSONB,
  note TEXT,
  open_task_count INTEGER,               -- set when Delivered/Completed is saved with open tasks (P7 warning acknowledged)
  actor_id UUID REFERENCES employees(id) ON DELETE RESTRICT,   -- NULL = System
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_project_changes_project ON project_changes (project_id, created_at);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done','cancelled')),
  owner_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  due_date DATE,
  is_milestone BOOLEAN NOT NULL DEFAULT false,            -- OQ-09
  client_dependency BOOLEAN NOT NULL DEFAULT false,       -- chip, NOT a status
  client_dependency_note VARCHAR(500),
  sort_order INTEGER NOT NULL DEFAULT 0,                  -- position within a board column
  completed_at TIMESTAMPTZ,
  completed_by_id UUID REFERENCES employees(id) ON DELETE RESTRICT,
  cancel_reason TEXT,
  created_by_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tasks_done_has_completion CHECK ((status = 'done') = (completed_at IS NOT NULL)),
  CONSTRAINT tasks_cancel_reason CHECK (status <> 'cancelled' OR cancel_reason IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_tasks_project_status ON tasks (project_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_owner_open ON tasks (owner_id) WHERE status IN ('todo','in_progress');

-- F3 / J-07: provisioning bookkeeping, owned by MOD-projects.
-- A closed deal with no projects row => derived "Closed deal without project".
-- Row is created on the first failed attempt and resolved when the project exists.
CREATE TABLE IF NOT EXISTS project_provisioning_states (
  deal_id UUID PRIMARY KEY REFERENCES deals(id) ON DELETE RESTRICT,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error_code VARCHAR(60),           -- code only, never a message containing data
  last_attempt_at TIMESTAMPTZ,
  next_attempt_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pps_unresolved ON project_provisioning_states (next_attempt_at) WHERE resolved_at IS NULL;
