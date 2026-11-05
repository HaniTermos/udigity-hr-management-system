-- Review fix (D-03): ops alerts are claimed with a lease so two dispatchers never email the same alert.
-- Additive only.
ALTER TABLE ops_alerts ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
