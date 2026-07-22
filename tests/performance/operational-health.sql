-- <!-- AGENT: INTEGRATION -->
-- Local-only, rollback-only operational summary benchmark.
\timing on
BEGIN;

INSERT INTO public.churches (id, name, slug)
VALUES ('f0000000-0000-4000-8000-000000000001', 'Operational Perf', 'operational-perf');

INSERT INTO public.events (id, church_id, slug, name, start_at, status, price)
VALUES (
  'f1000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'perf-event',
  'Perf Event',
  now() + interval '1 day',
  'published',
  10
);

INSERT INTO public.event_registrations (
  church_id, event_id, first_name, last_name, email, guests, status,
  created_at, confirmation_email_claimed_at
)
SELECT
  'f0000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'Synthetic',
  'Perf',
  'perf-' || n || '@test.invalid',
  0,
  CASE
    WHEN n % 3 = 0 THEN 'approved'::public.registration_status
    ELSE 'pending_review'::public.registration_status
  END,
  now() - (n || ' minutes')::interval,
  CASE WHEN n % 6 = 0 THEN now() - interval '10 minutes' ELSE NULL END
FROM generate_series(1, 500) AS n;

INSERT INTO public.operational_incidents (
  church_id, event_name, severity, resource_type, error_code, retryable, occurred_at
)
SELECT
  'f0000000-0000-4000-8000-000000000001',
  CASE
    WHEN n % 2 = 0 THEN 'email.send.failed'
    ELSE 'registration.submit.failed'
  END,
  'error',
  'event',
  'perf_failure',
  true,
  now() - (n || ' minutes')::interval
FROM generate_series(1, 100) AS n;

INSERT INTO public.webhooks (id, church_id, name, url, events, secret)
VALUES (
  'f2000000-0000-4000-8000-000000000001',
  'f0000000-0000-4000-8000-000000000001',
  'Perf Webhook',
  'https://example.test',
  ARRAY['person.created'],
  'synthetic'
);

INSERT INTO public.webhook_deliveries (
  church_id, webhook_id, event_type, payload, status, attempt_count,
  failed_at, next_attempt_at, delivered_at
)
SELECT
  'f0000000-0000-4000-8000-000000000001',
  'f2000000-0000-4000-8000-000000000001',
  'person.created',
  '{}'::jsonb,
  CASE
    WHEN n % 3 = 0 THEN 'permanently_failed'
    WHEN n % 3 = 1 THEN 'retry_scheduled'
    ELSE 'delivered'
  END,
  n % 7,
  CASE WHEN n % 3 <> 2 THEN now() - (n || ' minutes')::interval ELSE NULL END,
  CASE WHEN n % 3 = 1 THEN now() + interval '5 minutes' ELSE NULL END,
  CASE WHEN n % 3 = 2 THEN now() - (n || ' minutes')::interval ELSE NULL END
FROM generate_series(1, 500) AS n;

ANALYZE public.event_registrations;
ANALYZE public.operational_incidents;
ANALYZE public.webhook_deliveries;

\echo registration_health
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_operational_registration_health(
  'f0000000-0000-4000-8000-000000000001', now()
);

\echo email_health
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_operational_email_health(
  'f0000000-0000-4000-8000-000000000001', now()
);

\echo webhook_health
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_operational_webhook_health(
  'f0000000-0000-4000-8000-000000000001', now()
);

\echo pulse_health
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_operational_pulse_health(
  'f0000000-0000-4000-8000-000000000001', now()
);

ROLLBACK;
