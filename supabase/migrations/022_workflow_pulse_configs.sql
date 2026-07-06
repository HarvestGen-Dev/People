-- 022_workflow_pulse_configs.sql

CREATE TABLE workflow_pulse_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  days_inactive INTEGER NOT NULL DEFAULT 60,
  target_person_status VARCHAR NOT NULL DEFAULT 'active',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, workflow_id)
);

-- RLS
ALTER TABLE workflow_pulse_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage pulse configs"
  ON workflow_pulse_configs FOR ALL
  USING (
    church_id IN (
      SELECT church_id FROM church_memberships 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
