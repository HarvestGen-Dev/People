-- 020_event_target_workflow.sql

-- Add target_workflow_id to events to automatically add attendees to a workflow
ALTER TABLE events ADD COLUMN IF NOT EXISTS target_workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL;
