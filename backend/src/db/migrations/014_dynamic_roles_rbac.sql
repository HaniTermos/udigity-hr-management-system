-- 014 Dynamic Custom Roles & Enterprise RBAC (Wave 3). Owner: BE1.
-- Enables the Business Owner to create custom roles with customizable permissions and data scopes.

CREATE TABLE IF NOT EXISTS custom_roles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES employees(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed core system roles
INSERT INTO custom_roles (id, name, description, is_system) VALUES
  ('owner', 'Business Owner', 'Full unrestricted company-wide access and administration.', true),
  ('call_center', 'Call Center Specialist', 'Cold outreach, call logging, and lead reservation.', true),
  ('data_entry', 'Data Entry Specialist', 'Business directory management and data corrections.', true),
  ('developer', 'Software Engineer', 'Deal scoping, client delivery, and technical execution.', true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  is_system = EXCLUDED.is_system;

-- Role permissions mapping table
CREATE TABLE IF NOT EXISTS role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id VARCHAR(50) NOT NULL REFERENCES custom_roles(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  data_scope VARCHAR(20) NOT NULL DEFAULT 'global' CHECK (data_scope IN ('self', 'department', 'global', 'assigned_only')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, action)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_action ON role_permissions(action);

-- Drop legacy hardcoded role check on employees and bind to custom_roles
ALTER TABLE employees DROP CONSTRAINT IF EXISTS employees_role_check;
ALTER TABLE employees DROP CONSTRAINT IF EXISTS fk_employees_role;
ALTER TABLE employees ADD CONSTRAINT fk_employees_role FOREIGN KEY (role) REFERENCES custom_roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;
