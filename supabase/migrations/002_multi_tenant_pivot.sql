-- 002_multi_tenant_pivot.sql

-- 1. Create the churches (tenants) table
CREATE TABLE churches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Insert a default tenant for existing data
INSERT INTO churches (id, slug, name) 
VALUES ('00000000-0000-0000-0000-000000000001', 'harvestgen', 'Harvest Generation Church');

-- 2. Add church_id to all existing tables

-- households
ALTER TABLE households ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE households SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE households ALTER COLUMN church_id SET NOT NULL;

-- people
ALTER TABLE people ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE people SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE people ALTER COLUMN church_id SET NOT NULL;

-- Drop old unique constraint on email, create compound constraint
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_email_key;
ALTER TABLE people ADD CONSTRAINT people_church_email_key UNIQUE (church_id, email);

-- field_definitions
ALTER TABLE field_definitions ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE field_definitions SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE field_definitions ALTER COLUMN church_id SET NOT NULL;
ALTER TABLE field_definitions DROP CONSTRAINT IF EXISTS field_definitions_slug_key;
ALTER TABLE field_definitions ADD CONSTRAINT field_definitions_church_slug_key UNIQUE (church_id, slug);

-- person_field_values
ALTER TABLE person_field_values ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE person_field_values SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE person_field_values ALTER COLUMN church_id SET NOT NULL;

-- tags
ALTER TABLE tags ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE tags SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE tags ALTER COLUMN church_id SET NOT NULL;
ALTER TABLE tags DROP CONSTRAINT IF EXISTS tags_name_key;
ALTER TABLE tags ADD CONSTRAINT tags_church_name_key UNIQUE (church_id, name);

-- person_tags
ALTER TABLE person_tags ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE person_tags SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE person_tags ALTER COLUMN church_id SET NOT NULL;

-- notes
ALTER TABLE notes ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE notes SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE notes ALTER COLUMN church_id SET NOT NULL;

-- person_events
ALTER TABLE person_events ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE person_events SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE person_events ALTER COLUMN church_id SET NOT NULL;

-- workflows
ALTER TABLE workflows ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE workflows SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE workflows ALTER COLUMN church_id SET NOT NULL;

-- workflow_steps
ALTER TABLE workflow_steps ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE workflow_steps SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE workflow_steps ALTER COLUMN church_id SET NOT NULL;

-- workflow_cards
ALTER TABLE workflow_cards ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE workflow_cards SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE workflow_cards ALTER COLUMN church_id SET NOT NULL;

-- lists
ALTER TABLE lists ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE lists SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE lists ALTER COLUMN church_id SET NOT NULL;

-- list_people
ALTER TABLE list_people ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE list_people SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE list_people ALTER COLUMN church_id SET NOT NULL;

-- api_keys
ALTER TABLE api_keys ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE api_keys SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE api_keys ALTER COLUMN church_id SET NOT NULL;

-- webhooks
ALTER TABLE webhooks ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE webhooks SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE webhooks ALTER COLUMN church_id SET NOT NULL;

-- webhook_deliveries
ALTER TABLE webhook_deliveries ADD COLUMN church_id UUID REFERENCES churches(id) ON DELETE CASCADE;
UPDATE webhook_deliveries SET church_id = '00000000-0000-0000-0000-000000000001';
ALTER TABLE webhook_deliveries ALTER COLUMN church_id SET NOT NULL;

-- 3. Enable RLS (Optional/Foundation for future)
-- By default, Next.js server actions/API use Service Role (which bypasses RLS), 
-- but enabling it ensures safety if anon/authenticated keys are ever used directly on client.
ALTER TABLE churches ENABLE ROW LEVEL SECURITY;
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_field_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE list_people ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Note: No actual RLS policies are created yet since we use Service Role for everything in the backend right now.
-- We will implement application-level tenant isolation (e.g. `.eq('church_id', tenantId)`) 
-- or create generic RLS policies when switching away from Service Role.

-- Added to allow authenticated users to read and write all data since we are using createClient() in server components
CREATE POLICY "Allow authenticated users all access on churches" ON churches FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on households" ON households FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on people" ON people FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on field_definitions" ON field_definitions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on person_field_values" ON person_field_values FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on tags" ON tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on person_tags" ON person_tags FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on notes" ON notes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on person_events" ON person_events FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on workflows" ON workflows FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on workflow_steps" ON workflow_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on workflow_cards" ON workflow_cards FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on lists" ON lists FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on list_people" ON list_people FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on api_keys" ON api_keys FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on webhooks" ON webhooks FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow authenticated users all access on webhook_deliveries" ON webhook_deliveries FOR ALL TO authenticated USING (true) WITH CHECK (true);
