-- 036_webhook_worker_claims.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: durable webhook delivery needs atomic claiming, leases for crashed
-- workers, bounded retries, and sanitized response excerpts.

ALTER TABLE public.webhook_deliveries
  ADD COLUMN IF NOT EXISTS processing_lease_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS response_excerpt TEXT;

CREATE INDEX IF NOT EXISTS webhook_deliveries_worker_claim_idx
  ON public.webhook_deliveries(status, next_attempt_at, processing_lease_until, created_at)
  WHERE status IN ('pending', 'retry_scheduled', 'processing');

CREATE OR REPLACE FUNCTION public.claim_webhook_deliveries(
  p_batch_size INTEGER DEFAULT 10,
  p_lease_seconds INTEGER DEFAULT 60
)
RETURNS TABLE (
  id UUID,
  church_id UUID,
  webhook_id UUID,
  webhook_url TEXT,
  webhook_secret TEXT,
  event_type TEXT,
  event_id UUID,
  delivery_id UUID,
  payload JSONB,
  attempt_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF p_batch_size < 1 OR p_batch_size > 50 THEN
    RAISE EXCEPTION 'invalid_batch_size';
  END IF;

  RETURN QUERY
  WITH candidates AS (
    SELECT delivery.id
    FROM public.webhook_deliveries AS delivery
    JOIN public.webhooks AS webhook
      ON webhook.id = delivery.webhook_id
     AND webhook.church_id = delivery.church_id
    WHERE webhook.is_active = TRUE
      AND (
        delivery.status = 'pending'
        OR (
          delivery.status = 'retry_scheduled'
          AND COALESCE(delivery.next_attempt_at, NOW()) <= NOW()
        )
        OR (
          delivery.status = 'processing'
          AND delivery.processing_lease_until IS NOT NULL
          AND delivery.processing_lease_until < NOW()
        )
      )
    ORDER BY
      COALESCE(delivery.next_attempt_at, delivery.created_at),
      delivery.created_at
    LIMIT p_batch_size
    FOR UPDATE OF delivery SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.webhook_deliveries AS delivery
    SET
      status = 'processing',
      attempt_count = delivery.attempt_count + 1,
      last_attempted_at = NOW(),
      processing_lease_until = NOW() + make_interval(secs => p_lease_seconds),
      next_attempt_at = NULL
    FROM candidates
    WHERE delivery.id = candidates.id
    RETURNING delivery.*
  )
  SELECT
    claimed.id,
    claimed.church_id,
    claimed.webhook_id,
    webhook.url AS webhook_url,
    webhook.secret AS webhook_secret,
    claimed.event_type,
    claimed.event_id,
    claimed.delivery_id,
    claimed.payload,
    claimed.attempt_count
  FROM claimed
  JOIN public.webhooks AS webhook
    ON webhook.id = claimed.webhook_id
   AND webhook.church_id = claimed.church_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_webhook_deliveries(INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_webhook_deliveries(INTEGER, INTEGER) TO service_role;
