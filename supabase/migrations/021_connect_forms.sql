-- 021_connect_forms.sql

CREATE TABLE connect_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  slug VARCHAR NOT NULL,
  title VARCHAR NOT NULL,
  description TEXT,
  target_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  target_tag_id UUID REFERENCES tags(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, slug)
);

-- Add target_workflow_id to tags to trigger workflows when a tag is applied
ALTER TABLE tags ADD COLUMN IF NOT EXISTS target_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE connect_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view connect forms in their church"
  ON connect_forms FOR SELECT
  USING (
    church_id IN (
      SELECT church_id FROM church_memberships WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Platform admins can view all connect forms"
  ON connect_forms FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM platform_admins WHERE user_id = auth.uid())
  );

CREATE POLICY "Public can view active connect forms"
  ON connect_forms FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage connect forms"
  ON connect_forms FOR ALL
  USING (
    church_id IN (
      SELECT church_id FROM church_memberships 
      WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
    )
  );
