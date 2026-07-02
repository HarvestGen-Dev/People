-- 013_performance_indices.sql

-- 1. Index on people(church_id)
CREATE INDEX IF NOT EXISTS idx_people_church_id ON people(church_id);

-- 2. Indices on other high-traffic multi-tenant tables
CREATE INDEX IF NOT EXISTS idx_events_church_id ON events(church_id);
CREATE INDEX IF NOT EXISTS idx_event_registrations_church_id ON event_registrations(church_id);
CREATE INDEX IF NOT EXISTS idx_workflows_church_id ON workflows(church_id);

-- 3. Composite indices for frequent combined filters on people
CREATE INDEX IF NOT EXISTS idx_people_church_status ON people(church_id, status);
CREATE INDEX IF NOT EXISTS idx_people_church_created ON people(church_id, created_at DESC);
