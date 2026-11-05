-- 002 Identity hardening (Increment 1). Forward-only, non-destructive:
-- no table or column is dropped and no row is deleted.
-- Covers: session state/end reason/idle expiry/hashed token/CSRF nonce, failed-attempt
-- counters and lockout, TOTP replay guard, security_tokens, audit session/request/before/after,
-- employee optimistic version, and ON DELETE RESTRICT on every FK to employees (arch-b §4).

-- ---------------------------------------------------------------------------
-- Sessions (ADR-003, SM-SESSION-001)
-- ---------------------------------------------------------------------------
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS state VARCHAR(40) NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS end_reason VARCHAR(40),
  ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idle_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS token_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS csrf_nonce VARCHAR(64),
  ADD COLUMN IF NOT EXISTS factor_fail_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rotated_from UUID;

-- New sessions store only token_hash; the legacy plaintext column becomes optional.
ALTER TABLE sessions ALTER COLUMN token DROP NOT NULL;

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_state_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_state_check
  CHECK (state IN ('pending_2fa_enrollment', 'pending_2fa_verification', 'active', 'ended'));

ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_end_reason_check;
ALTER TABLE sessions ADD CONSTRAINT sessions_end_reason_check
  CHECK (end_reason IS NULL OR end_reason IN (
    'logout', 'revoked', 'idle_expired', 'absolute_expired', 'pending_expired',
    'rotated', 'factor_threshold', 'password_reset', 'account_deactivated', 'migration_002'
  ));

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);

-- Sessions created before 002 hold a plaintext token. End them (rows are kept, not deleted);
-- users sign in again and get a hashed-token session.
UPDATE sessions
SET state = 'ended',
    end_reason = COALESCE(end_reason, CASE WHEN revoked_at IS NOT NULL THEN 'revoked' ELSE 'migration_002' END),
    ended_at = COALESCE(ended_at, revoked_at, CURRENT_TIMESTAMP),
    revoked_at = COALESCE(revoked_at, CURRENT_TIMESTAMP)
WHERE token_hash IS NULL AND state <> 'ended';

-- ---------------------------------------------------------------------------
-- Failed-attempt counters and lockout (MOD-identity, SEQ-01)
-- ---------------------------------------------------------------------------
ALTER TABLE credentials
  ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

ALTER TABLE two_factor_factors
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_used_step BIGINT,
  ADD COLUMN IF NOT EXISTS failed_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_window_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS locked_until TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Security tokens: hashed, single-use, expiring (ERD-1 SecurityToken)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS security_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  purpose VARCHAR(40) NOT NULL CHECK (purpose IN ('password_reset', 'credential_setup')),
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  superseded_at TIMESTAMPTZ,
  requested_ip VARCHAR(100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_security_tokens_employee ON security_tokens(employee_id);

-- ---------------------------------------------------------------------------
-- Employees: optimistic version (IC-16, SEQ-03)
-- ---------------------------------------------------------------------------
ALTER TABLE employees ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- Audit (ADR-008, arch-a §5)
-- ---------------------------------------------------------------------------
ALTER TABLE audit_events
  ADD COLUMN IF NOT EXISTS session_id UUID,
  ADD COLUMN IF NOT EXISTS request_id VARCHAR(100),
  ADD COLUMN IF NOT EXISTS before_state JSONB,
  ADD COLUMN IF NOT EXISTS after_state JSONB,
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS source_workflow VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_audit_events_entity ON audit_events(entity_type, entity_id);

-- Append-only by construction: refuse UPDATE and DELETE on audit rows.
-- (The INSERT/SELECT-only DB grant is an operations step; see the status report.)
CREATE OR REPLACE FUNCTION audit_events_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only (% refused)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_events_append_only ON audit_events;
CREATE TRIGGER trg_audit_events_append_only
  BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_append_only();

-- ---------------------------------------------------------------------------
-- Foreign keys to employees: RESTRICT, no cascade, no SET NULL (arch-b §4, C6, C9)
-- ---------------------------------------------------------------------------
ALTER TABLE credentials
  DROP CONSTRAINT IF EXISTS credentials_employee_id_fkey,
  ADD CONSTRAINT credentials_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE two_factor_factors
  DROP CONSTRAINT IF EXISTS two_factor_factors_employee_id_fkey,
  ADD CONSTRAINT two_factor_factors_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE sessions
  DROP CONSTRAINT IF EXISTS sessions_employee_id_fkey,
  ADD CONSTRAINT sessions_employee_id_fkey
    FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE RESTRICT;

ALTER TABLE audit_events
  DROP CONSTRAINT IF EXISTS audit_events_actor_id_fkey,
  ADD CONSTRAINT audit_events_actor_id_fkey
    FOREIGN KEY (actor_id) REFERENCES employees(id) ON DELETE RESTRICT;
