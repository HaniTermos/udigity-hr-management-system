-- 010 Identity: SEC-3 (threat model AU-8, AU-9, AU-13). Owner: BE1. Forward-only, non-destructive.
--
-- AU-13: TOTP secrets are stored encrypted (AES-256-GCM, key from env TOTP_ENC_KEY, key id per row).
--        The legacy plaintext column stays (no column drop) but becomes nullable; the application
--        encrypts any remaining plaintext secret on first use / via the bootstrap CLI and then
--        clears the plaintext value (the ciphertext holds the same value: lossless).
-- AU-8:  Owner first enrollment needs a one-time enrollment token (security_tokens purpose
--        'two_factor_enrollment', SHA-256 hashed, 24 h, single use), issued by the operator CLI or by
--        another Owner with a completed 2FA session plus fresh re-authentication.
-- AU-9:  Single-use recovery codes, bcrypt-hashed, shown once.

-- ---------------------------------------------------------------------------
-- AU-13 encrypted TOTP secret
-- ---------------------------------------------------------------------------
ALTER TABLE two_factor_factors
  ADD COLUMN IF NOT EXISTS secret_ciphertext TEXT,
  ADD COLUMN IF NOT EXISTS secret_key_id VARCHAR(40),
  -- AU-8: the enrollment token bound at enroll/start and consumed at enroll/confirm.
  ADD COLUMN IF NOT EXISTS pending_enrollment_token_id UUID REFERENCES security_tokens(id) ON DELETE RESTRICT;

ALTER TABLE two_factor_factors ALTER COLUMN secret DROP NOT NULL;

ALTER TABLE two_factor_factors DROP CONSTRAINT IF EXISTS two_factor_factors_secret_present;
ALTER TABLE two_factor_factors ADD CONSTRAINT two_factor_factors_secret_present
  CHECK (secret IS NOT NULL OR secret_ciphertext IS NOT NULL);

ALTER TABLE two_factor_factors DROP CONSTRAINT IF EXISTS two_factor_factors_key_id_present;
ALTER TABLE two_factor_factors ADD CONSTRAINT two_factor_factors_key_id_present
  CHECK (secret_ciphertext IS NULL OR secret_key_id IS NOT NULL);

-- ---------------------------------------------------------------------------
-- AU-8 enrollment tokens (security_tokens gains a purpose and issuer columns)
-- ---------------------------------------------------------------------------
ALTER TABLE security_tokens DROP CONSTRAINT IF EXISTS security_tokens_purpose_check;
ALTER TABLE security_tokens ADD CONSTRAINT security_tokens_purpose_check
  CHECK (purpose IN ('password_reset', 'credential_setup', 'two_factor_enrollment'));

ALTER TABLE security_tokens
  ADD COLUMN IF NOT EXISTS issued_by UUID REFERENCES employees(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS issued_via VARCHAR(20);

ALTER TABLE security_tokens DROP CONSTRAINT IF EXISTS security_tokens_issued_via_check;
ALTER TABLE security_tokens ADD CONSTRAINT security_tokens_issued_via_check
  CHECK (issued_via IS NULL OR issued_via IN ('cli', 'owner_session', 'seed', 'system'));

CREATE INDEX IF NOT EXISTS idx_security_tokens_purpose_open
  ON security_tokens(employee_id, purpose) WHERE used_at IS NULL AND superseded_at IS NULL;

-- ---------------------------------------------------------------------------
-- AU-9 recovery codes (OQ-12; count = flag auth.recoveryCodeCount, default 10)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS two_factor_recovery_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
  batch_id UUID NOT NULL,
  code_hash VARCHAR(100) NOT NULL,
  used_at TIMESTAMPTZ,
  used_session_id UUID,
  superseded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_recovery_codes_open
  ON two_factor_recovery_codes(employee_id) WHERE used_at IS NULL AND superseded_at IS NULL;
