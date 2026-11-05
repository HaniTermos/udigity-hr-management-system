-- 994_custom_roles_on.sql — MOD-access / MOD-employees (BE2). Owner decision 2026-10-29: custom roles are ON again
-- (supersedes DEC-032 "four fixed roles, no custom-role management").
--   * Drops the NOT VALID four-role CHECK added by 993 (relaxes a constraint only; no data change). The FK
--     `fk_employees_role` → custom_roles (014) stays: an employee role must be a known role id.
--   * D20 (no hard deletes in the normal app): a custom role is DEACTIVATED, not deleted. `deactivated_at` set =
--     kept for history, no longer assignable, its grants are not honoured. Additive column.

ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_v1_check;

ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ;
ALTER TABLE custom_roles ADD COLUMN IF NOT EXISTS deactivated_by UUID REFERENCES employees(id) ON DELETE RESTRICT;
