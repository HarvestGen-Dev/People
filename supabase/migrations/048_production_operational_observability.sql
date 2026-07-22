-- 048_production_operational_observability.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: registration and SMTP failures are otherwise log-only, while
-- webhook and pulse health is spread across internal tables. This migration
-- adds a bounded, PII-free incident ledger and service-role-only tenant
-- summaries without exposing raw payloads or error text to browser clients.

CREATE TABLE public.operational_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL CHECK (event_name IN (
    'registration.submit.failed',
    'registration.approval.failed',
    'registration.rejection.failed',
    'email.send.failed'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('warning', 'error', 'critical')),
  resource_type TEXT CHECK (
    resource_type IS NULL OR (
      char_length(resource_type) BETWEEN 1 AND 64
      AND resource_type ~ '^[a-z][a-z0-9_]*$'
    )
  ),
  resource_id UUID,
  request_id TEXT CHECK (request_id IS NULL OR char_length(request_id) <= 128),
  error_code TEXT NOT NULL CHECK (char_length(error_code) BETWEEN 1 AND 64),
  retryable BOOLEAN NOT NULL DEFAULT FALSE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  resolved_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::text) <= 4096
  ),
  CONSTRAINT operational_incidents_resolution_time_check
    CHECK (resolved_at IS NULL OR resolved_at >= occurred_at)
);

CREATE INDEX operational_incidents_church_event_occurred_idx
  ON public.operational_incidents (church_id, event_name, occurred_at DESC);

CREATE INDEX operational_incidents_active_church_event_idx
  ON public.operational_incidents (church_id, event_name, occurred_at DESC)
  WHERE resolved_at IS NULL;

CREATE INDEX event_registrations_operational_status_idx
  ON public.event_registrations (church_id, status, created_at DESC);

CREATE INDEX event_registrations_email_claim_idx
  ON public.event_registrations (church_id, confirmation_email_claimed_at)
  WHERE confirmation_email_sent_at IS NULL;

CREATE INDEX webhook_deliveries_operational_status_idx
  ON public.webhook_deliveries (church_id, status, created_at DESC);

ALTER TABLE public.operational_incidents ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.operational_incidents FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.operational_incidents TO service_role;

CREATE OR REPLACE FUNCTION public.get_operational_registration_health(
  p_church_id UUID,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'pending_review_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.status = 'pending_review'
    ),
    'oldest_pending_at', (
      SELECT min(registration.created_at)
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.status = 'pending_review'
    ),
    'payment_review_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      JOIN public.events AS event
        ON event.church_id = registration.church_id
       AND event.id = registration.event_id
      WHERE registration.church_id = p_church_id
        AND registration.status = 'pending_review'
        AND event.price > 0
    ),
    'recent_24h_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.created_at >= p_now - interval '24 hours'
    ),
    'recent_7d_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.created_at >= p_now - interval '7 days'
    ),
    'submission_failures_24h', (
      SELECT count(*)::INTEGER
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name = 'registration.submit.failed'
        AND incident.occurred_at >= p_now - interval '24 hours'
    ),
    'approval_failures_24h', (
      SELECT count(*)::INTEGER
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name IN (
          'registration.approval.failed',
          'registration.rejection.failed'
        )
        AND incident.resolved_at IS NULL
        AND incident.occurred_at >= p_now - interval '24 hours'
    ),
    'technical_failures_7d', (
      SELECT count(*)::INTEGER
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name LIKE 'registration.%'
        AND incident.occurred_at >= p_now - interval '7 days'
    ),
    'oldest_active_failure_at', (
      SELECT min(incident.occurred_at)
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name IN (
          'registration.approval.failed',
          'registration.rejection.failed'
        )
        AND incident.resolved_at IS NULL
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_operational_email_health(
  p_church_id UUID,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'lease_seconds', 300,
    'eligible_to_send_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.status = 'approved'
        AND registration.confirmation_email_sent_at IS NULL
        AND (
          registration.confirmation_email_claimed_at IS NULL
          OR registration.confirmation_email_claimed_at < p_now - interval '5 minutes'
        )
    ),
    'active_claim_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.confirmation_email_sent_at IS NULL
        AND registration.confirmation_email_claimed_at >= p_now - interval '5 minutes'
    ),
    'stuck_claim_count', (
      SELECT count(*)::INTEGER
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.confirmation_email_sent_at IS NULL
        AND registration.confirmation_email_claimed_at < p_now - interval '5 minutes'
    ),
    'oldest_stuck_claim_at', (
      SELECT min(registration.confirmation_email_claimed_at)
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.confirmation_email_sent_at IS NULL
        AND registration.confirmation_email_claimed_at < p_now - interval '5 minutes'
    ),
    'retryable_failure_count', (
      SELECT count(*)::INTEGER
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name = 'email.send.failed'
        AND incident.retryable
        AND incident.resolved_at IS NULL
    ),
    'smtp_failures_24h', (
      SELECT count(*)::INTEGER
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name = 'email.send.failed'
        AND incident.occurred_at >= p_now - interval '24 hours'
    ),
    'smtp_failures_7d', (
      SELECT count(*)::INTEGER
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name = 'email.send.failed'
        AND incident.occurred_at >= p_now - interval '7 days'
    ),
    'last_success_at', (
      SELECT max(registration.confirmation_email_sent_at)
      FROM public.event_registrations AS registration
      WHERE registration.church_id = p_church_id
        AND registration.confirmation_email_sent_at IS NOT NULL
    ),
    'last_failure_at', (
      SELECT max(incident.occurred_at)
      FROM public.operational_incidents AS incident
      WHERE incident.church_id = p_church_id
        AND incident.event_name = 'email.send.failed'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_operational_webhook_health(
  p_church_id UUID,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'lease_seconds', 60,
    'pending_due_count', (
      SELECT count(*)::INTEGER
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND (
          delivery.status = 'pending'
          OR (
            delivery.status = 'retry_scheduled'
            AND coalesce(delivery.next_attempt_at, p_now) <= p_now
          )
        )
    ),
    'retry_scheduled_count', (
      SELECT count(*)::INTEGER
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.status = 'retry_scheduled'
    ),
    'permanently_failed_count', (
      SELECT count(*)::INTEGER
      FROM public.webhook_deliveries AS failed
      WHERE failed.church_id = p_church_id
        AND failed.status = 'permanently_failed'
        AND NOT EXISTS (
          SELECT 1
          FROM public.webhook_deliveries AS delivered
          WHERE delivered.church_id = failed.church_id
            AND delivered.webhook_id = failed.webhook_id
            AND delivered.event_id = failed.event_id
            AND delivered.status = 'delivered'
            AND delivered.delivered_at > coalesce(failed.failed_at, failed.created_at)
        )
    ),
    'abandoned_processing_count', (
      SELECT count(*)::INTEGER
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.status = 'processing'
        AND delivery.processing_lease_until < p_now
    ),
    'oldest_outstanding_at', (
      SELECT min(delivery.created_at)
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.status IN ('pending', 'retry_scheduled', 'processing')
    ),
    'last_success_at', (
      SELECT max(delivery.delivered_at)
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.status = 'delivered'
    ),
    'last_failure_at', (
      SELECT max(delivery.failed_at)
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.status IN ('retry_scheduled', 'permanently_failed')
    ),
    'failures_24h', (
      SELECT count(*)::INTEGER
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.failed_at >= p_now - interval '24 hours'
    ),
    'failures_7d', (
      SELECT count(*)::INTEGER
      FROM public.webhook_deliveries AS delivery
      WHERE delivery.church_id = p_church_id
        AND delivery.failed_at >= p_now - interval '7 days'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.get_operational_pulse_health(
  p_church_id UUID,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH scoped AS MATERIALIZED (
    SELECT
      config_run.*,
      pulse_run.status AS run_status,
      pulse_run.started_at AS run_started_at,
      pulse_run.finished_at AS run_finished_at
    FROM public.missing_persons_pulse_run_configs AS config_run
    JOIN public.missing_persons_pulse_runs AS pulse_run
      ON pulse_run.run_id = config_run.run_id
    WHERE config_run.church_id = p_church_id
  ),
  latest_run AS (
    SELECT scoped.run_id
    FROM scoped
    ORDER BY scoped.run_started_at DESC, scoped.run_id
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'abandoned_after_seconds', 1800,
    'last_success_at', (
      SELECT max(scoped.finished_at)
      FROM scoped
      WHERE scoped.status = 'completed'
    ),
    'last_partial_at', (
      SELECT max(scoped.run_finished_at)
      FROM scoped
      WHERE scoped.run_status = 'completed_with_errors'
    ),
    'last_failure_at', (
      SELECT max(scoped.finished_at)
      FROM scoped
      WHERE scoped.status = 'failed'
    ),
    'abandoned_running_count', (
      SELECT count(*)::INTEGER
      FROM public.missing_persons_pulse_runs AS abandoned
      WHERE abandoned.status = 'running'
        AND abandoned.started_at < p_now - interval '30 minutes'
        AND (
          abandoned.scope_church_id = p_church_id
          OR EXISTS (
            SELECT 1
            FROM public.missing_persons_pulse_run_configs AS abandoned_config
            WHERE abandoned_config.run_id = abandoned.run_id
              AND abandoned_config.church_id = p_church_id
          )
        )
    ),
    'lock_skips_24h', (
      SELECT count(*)::INTEGER
      FROM scoped
      WHERE scoped.status = 'skipped_locked'
        AND scoped.started_at >= p_now - interval '24 hours'
        AND scoped.started_at > coalesce(
          (SELECT max(success.finished_at) FROM scoped AS success WHERE success.status = 'completed'),
          '-infinity'::TIMESTAMPTZ
        )
    ),
    'lock_skips_7d', (
      SELECT count(*)::INTEGER
      FROM scoped
      WHERE scoped.status = 'skipped_locked'
        AND scoped.started_at >= p_now - interval '7 days'
        AND scoped.started_at > coalesce(
          (SELECT max(success.finished_at) FROM scoped AS success WHERE success.status = 'completed'),
          '-infinity'::TIMESTAMPTZ
        )
    ),
    'latest_run_failed_configs', (
      SELECT count(*)::INTEGER
      FROM scoped
      WHERE scoped.run_id = (SELECT latest_run.run_id FROM latest_run)
        AND scoped.status = 'failed'
    ),
    'latest_success_cards_created', (
      SELECT coalesce(sum(scoped.cards_created), 0)::INTEGER
      FROM scoped
      WHERE scoped.run_id = (
        SELECT successful.run_id
        FROM scoped AS successful
        WHERE successful.status = 'completed'
        ORDER BY successful.run_started_at DESC
        LIMIT 1
      )
    ),
    'latest_run_at', (
      SELECT max(scoped.run_started_at)
      FROM scoped
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_operational_registration_health(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_operational_email_health(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_operational_webhook_health(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_operational_pulse_health(UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_operational_registration_health(UUID, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_operational_email_health(UUID, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_operational_webhook_health(UUID, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_operational_pulse_health(UUID, TIMESTAMPTZ)
  TO service_role;

COMMENT ON TABLE public.operational_incidents IS
  'PII-free technical incident evidence for failures not represented by durable workflow state.';
COMMENT ON FUNCTION public.get_operational_email_health(UUID, TIMESTAMPTZ) IS
  'Tenant email health using the five-minute confirmation claim lease from approval processing.';
COMMENT ON FUNCTION public.get_operational_webhook_health(UUID, TIMESTAMPTZ) IS
  'Tenant webhook health using the 60-second worker lease and durable delivery states.';
COMMENT ON FUNCTION public.get_operational_pulse_health(UUID, TIMESTAMPTZ) IS
  'Tenant pulse health; running executions older than 30 minutes are considered abandoned.';
