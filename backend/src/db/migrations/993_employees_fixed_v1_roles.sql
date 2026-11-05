-- 993_employees_fixed_v1_roles.sql — MOD-employees / MOD-access (BE2). Approved v1 policy
-- (docs/policy-baseline-2026-10-29.md "Fixed v1 scope"): four roles only, no custom-role management.
-- Additive: custom_roles / role_permissions rows are KEPT (turned off in code, not dropped). New and updated
-- employee rows must carry one of the four roles; existing rows are not re-checked (NOT VALID), so nothing
-- fails to migrate if a custom-role employee exists. `fk_employees_role` (014) stays as it is.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'employees_role_v1_check' AND conrelid = 'employees'::regclass) THEN
    ALTER TABLE employees ADD CONSTRAINT employees_role_v1_check
      CHECK (role IN ('owner', 'data_entry', 'call_center', 'developer')) NOT VALID;
  END IF;
END $$;
