-- <!-- AGENT: INTEGRATION -->
-- Local-only performance harness. All rows are rolled back.
\timing on
BEGIN;

INSERT INTO public.churches (id, slug, name)
SELECT
  md5('pulse-perf-church-' || church_number)::uuid,
  'pulse-perf-' || church_number,
  'Pulse Performance ' || church_number
FROM generate_series(1, 5) AS church_number;

INSERT INTO public.workflows (id, church_id, name)
SELECT
  md5('pulse-perf-workflow-' || church_number)::uuid,
  md5('pulse-perf-church-' || church_number)::uuid,
  'Pulse Performance Workflow ' || church_number
FROM generate_series(1, 5) AS church_number;

INSERT INTO public.workflow_steps (
  id,
  church_id,
  workflow_id,
  name,
  position,
  default_days_to_complete
)
SELECT
  md5('pulse-perf-step-' || church_number)::uuid,
  md5('pulse-perf-church-' || church_number)::uuid,
  md5('pulse-perf-workflow-' || church_number)::uuid,
  'Follow up',
  1,
  3
FROM generate_series(1, 5) AS church_number;

INSERT INTO public.workflow_pulse_configs (
  id,
  church_id,
  workflow_id,
  days_inactive,
  target_person_status,
  is_active
)
SELECT
  md5('pulse-perf-config-' || church_number)::uuid,
  md5('pulse-perf-church-' || church_number)::uuid,
  md5('pulse-perf-workflow-' || church_number)::uuid,
  30,
  'active',
  true
FROM generate_series(1, 5) AS church_number;

-- Keep the harness deterministic when a developer database contains fixtures.
UPDATE public.workflow_pulse_configs
SET is_active = false
WHERE church_id NOT IN (
  SELECT md5('pulse-perf-church-' || church_number)::uuid
  FROM generate_series(1, 5) AS church_number
);

INSERT INTO public.people (id, church_id, first_name, last_name, status)
SELECT
  md5('pulse-perf-person-' || church_number || '-' || person_number)::uuid,
  md5('pulse-perf-church-' || church_number)::uuid,
  'Performance',
  church_number || '-' || person_number,
  'active'
FROM generate_series(1, 5) AS church_number
CROSS JOIN generate_series(1, 500) AS person_number;

-- People 1-100 have recent activity; 101-200 have old activity; 201-500
-- have no activity history. Any person event type counts as activity.
INSERT INTO public.person_events (
  church_id,
  person_id,
  source,
  event_type,
  occurred_at
)
SELECT
  md5('pulse-perf-church-' || church_number)::uuid,
  md5('pulse-perf-person-' || church_number || '-' || person_number)::uuid,
  'manual',
  'performance_activity',
  CASE
    WHEN person_number <= 100 THEN '2026-06-10T12:00:00Z'::timestamptz
    ELSE '2026-04-01T12:00:00Z'::timestamptz
  END
FROM generate_series(1, 5) AS church_number
CROSS JOIN generate_series(1, 200) AS person_number;

INSERT INTO public.missing_persons_pulse_runs (
  run_id,
  status,
  started_at,
  finished_at,
  duration_ms
)
VALUES (
  md5('pulse-perf-historical-run')::uuid,
  'completed',
  '2026-01-01T00:00:00Z',
  '2026-01-01T00:00:01Z',
  1000
);

-- 25 active non-pulse cards per church suppress creation.
INSERT INTO public.workflow_cards (
  church_id,
  person_id,
  workflow_id,
  current_step_id,
  source
)
SELECT
  md5('pulse-perf-church-' || church_number)::uuid,
  md5('pulse-perf-person-' || church_number || '-' || person_number)::uuid,
  md5('pulse-perf-workflow-' || church_number)::uuid,
  md5('pulse-perf-step-' || church_number)::uuid,
  'existing'
FROM generate_series(1, 5) AS church_number
CROSS JOIN generate_series(101, 125) AS person_number;

-- 25 completed pulse cards per church demonstrate that history permits re-entry.
INSERT INTO public.workflow_cards (
  church_id,
  person_id,
  workflow_id,
  current_step_id,
  completed_at,
  source,
  pulse_config_id,
  pulse_run_id,
  triggered_at
)
SELECT
  md5('pulse-perf-church-' || church_number)::uuid,
  md5('pulse-perf-person-' || church_number || '-' || person_number)::uuid,
  md5('pulse-perf-workflow-' || church_number)::uuid,
  md5('pulse-perf-step-' || church_number)::uuid,
  '2026-01-02T00:00:00Z',
  'missing_persons_pulse',
  md5('pulse-perf-config-' || church_number)::uuid,
  md5('pulse-perf-historical-run')::uuid,
  '2026-01-01T00:00:00Z'
FROM generate_series(1, 5) AS church_number
CROSS JOIN generate_series(126, 150) AS person_number;

ANALYZE public.people;
ANALYZE public.person_events;
ANALYZE public.workflow_cards;

-- Principal eligibility/anti-join shape for one 500-person tenant.
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
WITH candidates AS MATERIALIZED (
  SELECT person.id
  FROM public.people AS person
  WHERE person.church_id = md5('pulse-perf-church-1')::uuid
    AND person.status = 'active'
),
matched AS MATERIALIZED (
  SELECT candidate.id
  FROM candidates AS candidate
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.person_events AS person_event
    WHERE person_event.church_id = md5('pulse-perf-church-1')::uuid
      AND person_event.person_id = candidate.id
      AND person_event.occurred_at >= '2026-05-16T12:00:00Z'
  )
),
insertable AS MATERIALIZED (
  SELECT matched_person.id
  FROM matched AS matched_person
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.workflow_cards AS active_card
    WHERE active_card.church_id = md5('pulse-perf-church-1')::uuid
      AND active_card.workflow_id = md5('pulse-perf-workflow-1')::uuid
      AND active_card.person_id = matched_person.id
      AND active_card.completed_at IS NULL
  )
)
SELECT
  (SELECT count(*) FROM candidates) AS people_scanned,
  (SELECT count(*) FROM matched) AS people_matched,
  (SELECT count(*) FROM insertable) AS people_insertable;

SELECT public.run_missing_persons_pulse(
  md5('pulse-perf-first-run')::uuid,
  NULL,
  '2026-06-15T12:00:00Z'
) AS first_run;

SELECT public.run_missing_persons_pulse(
  md5('pulse-perf-repeat-run')::uuid,
  NULL,
  '2026-06-15T12:00:00Z'
) AS repeated_run;

SELECT count(*) AS active_pulse_cards
FROM public.workflow_cards
WHERE source = 'missing_persons_pulse'
  AND completed_at IS NULL
  AND church_id IN (
    SELECT md5('pulse-perf-church-' || church_number)::uuid
    FROM generate_series(1, 5) AS church_number
  );

ROLLBACK;
