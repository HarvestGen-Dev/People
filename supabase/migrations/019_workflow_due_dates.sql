-- 019_workflow_due_dates.sql

-- Add default_days_to_complete to workflow_steps
ALTER TABLE workflow_steps ADD COLUMN IF NOT EXISTS default_days_to_complete INTEGER DEFAULT 3;

-- Create an index on due_date for fast querying of overdue cards
-- due_date already exists on workflow_cards as DATE type
CREATE INDEX IF NOT EXISTS idx_workflow_cards_due_date ON workflow_cards(due_date);
