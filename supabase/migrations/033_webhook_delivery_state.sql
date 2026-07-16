-- 033_webhook_delivery_state.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: webhook deliveries need stable IDs and explicit states so
-- receivers can deduplicate and People can distinguish delivered, retryable,
-- and permanently failed attempts.

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS event_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS delivery_id UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_status_code INTEGER,
  ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.webhook_deliveries
  DROP CONSTRAINT IF EXISTS webhook_deliveries_status_check;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_status_check
  CHECK (status IN ('pending', 'processing', 'delivered', 'retry_scheduled', 'permanently_failed')) NOT VALID;

ALTER TABLE public.webhook_deliveries
  VALIDATE CONSTRAINT webhook_deliveries_status_check;

CREATE UNIQUE INDEX IF NOT EXISTS webhook_deliveries_delivery_id_key
  ON public.webhook_deliveries(delivery_id);

CREATE INDEX IF NOT EXISTS webhook_deliveries_retry_idx
  ON public.webhook_deliveries(status, next_attempt_at)
  WHERE status IN ('pending', 'retry_scheduled');
