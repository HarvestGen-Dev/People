-- 024_performance_optimization_indexes.sql

-- For scaling to 500+ concurrent users, we need to ensure all high-traffic
-- join columns and lookup paths are covered by B-Tree indices.

-- Core lookups
CREATE INDEX IF NOT EXISTS idx_workflow_cards_workflow_id ON workflow_cards(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_person_id ON workflow_cards(person_id);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_current_step_id ON workflow_cards(current_step_id);

-- Tenant lookup optimizations
CREATE INDEX IF NOT EXISTS idx_person_events_church_id ON person_events(church_id);
CREATE INDEX IF NOT EXISTS idx_tags_church_id ON tags(church_id);

-- Date based indices for dashboards and cron jobs
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_workflow_cards_due_date ON workflow_cards(due_date);
CREATE INDEX IF NOT EXISTS idx_person_events_created_at ON person_events(created_at);

-- Connect forms lookup
CREATE INDEX IF NOT EXISTS idx_connect_forms_church_id ON connect_forms(church_id);
