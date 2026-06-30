-- 003_roles_and_scheduling.sql
-- Adds the roles and person_roles tables for Axiom and Planning Center Sync integration

CREATE TABLE IF NOT EXISTS roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT, -- e.g., 'Worship', 'Production', 'Host Team'
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, name)
);

CREATE TABLE IF NOT EXISTS person_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, person_id, role_id)
);

-- Enable Row Level Security
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_roles ENABLE ROW LEVEL SECURITY;

-- Optional: You would add RLS policies here ensuring people can only read/write roles for their tenant.
-- For example, if you rely on the app schema setting `app.current_tenant_id`:

CREATE POLICY "Tenant isolation for roles" 
  ON roles 
  USING (church_id = current_setting('app.current_tenant_id', true)::uuid);

CREATE POLICY "Tenant isolation for person_roles" 
  ON person_roles 
  USING (church_id = current_setting('app.current_tenant_id', true)::uuid);
