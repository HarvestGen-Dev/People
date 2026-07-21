-- 045_missing_persons_pulse_observability.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: pulse-generated cards need durable provenance and cron executions
-- need tenant-safe operational history before concurrency constraints are added.

ALTER TABLE public.workflow_pulse_configs
  ADD CONSTRAINT workflow_pulse_configs_church_id_id_key
  UNIQUE (church_id, id);

ALTER TABLE public.workflow_pulse_configs
  ADD CONSTRAINT workflow_pulse_configs_church_id_id_workflow_id_key
  UNIQUE (church_id, id, workflow_id);

ALTER TABLE public.workflow_pulse_configs
  ADD CONSTRAINT workflow_pulse_configs_days_inactive_check
  CHECK (days_inactive > 0)
  NOT VALID;

ALTER TABLE public.workflow_pulse_configs
  ADD CONSTRAINT workflow_pulse_configs_target_status_check
  CHECK (target_person_status IN ('active', 'visitor', 'inactive', 'child'))
  NOT VALID;

CREATE TABLE public.missing_persons_pulse_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE,
  job_name TEXT NOT NULL DEFAULT 'missing_persons_pulse'
    CHECK (job_name = 'missing_persons_pulse'),
  scope_church_id UUID REFERENCES public.churches(id) ON DELETE SET NULL,
  status TEXT NOT NULL
    CHECK (status IN (
      'running',
      'completed',
      'completed_with_errors',
      'failed',
      'skipped_locked'
    )),
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at TIMESTAMPTZ,
  duration_ms BIGINT CHECK (duration_ms IS NULL OR duration_ms >= 0),
  configs_processed INTEGER NOT NULL DEFAULT 0 CHECK (configs_processed >= 0),
  configs_failed INTEGER NOT NULL DEFAULT 0 CHECK (configs_failed >= 0),
  configs_skipped INTEGER NOT NULL DEFAULT 0 CHECK (configs_skipped >= 0),
  people_scanned INTEGER NOT NULL DEFAULT 0 CHECK (people_scanned >= 0),
  people_matched INTEGER NOT NULL DEFAULT 0 CHECK (people_matched >= 0),
  cards_created INTEGER NOT NULL DEFAULT 0 CHECK (cards_created >= 0),
  cards_skipped INTEGER NOT NULL DEFAULT 0 CHECK (cards_skipped >= 0),
  sanitized_error_code TEXT CHECK (
    sanitized_error_code IS NULL OR char_length(sanitized_error_code) <= 64
  ),
  sanitized_error_message TEXT CHECK (
    sanitized_error_message IS NULL OR char_length(sanitized_error_message) <= 256
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::text) <= 8192
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE public.missing_persons_pulse_run_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.missing_persons_pulse_runs(run_id)
    ON DELETE CASCADE,
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  pulse_config_id UUID,
  status TEXT NOT NULL
    CHECK (status IN ('completed', 'failed', 'skipped_locked')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  finished_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  duration_ms BIGINT NOT NULL DEFAULT 0 CHECK (duration_ms >= 0),
  people_scanned INTEGER NOT NULL DEFAULT 0 CHECK (people_scanned >= 0),
  people_matched INTEGER NOT NULL DEFAULT 0 CHECK (people_matched >= 0),
  cards_created INTEGER NOT NULL DEFAULT 0 CHECK (cards_created >= 0),
  cards_skipped INTEGER NOT NULL DEFAULT 0 CHECK (cards_skipped >= 0),
  sanitized_error_code TEXT CHECK (
    sanitized_error_code IS NULL OR char_length(sanitized_error_code) <= 64
  ),
  sanitized_error_message TEXT CHECK (
    sanitized_error_message IS NULL OR char_length(sanitized_error_message) <= 256
  ),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb CHECK (
    jsonb_typeof(metadata) = 'object'
    AND octet_length(metadata::text) <= 8192
  ),
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  CONSTRAINT missing_persons_pulse_run_configs_run_config_key
    UNIQUE (run_id, pulse_config_id),
  CONSTRAINT missing_persons_pulse_run_configs_church_config_fk
    FOREIGN KEY (church_id, pulse_config_id)
    REFERENCES public.workflow_pulse_configs(church_id, id)
    ON DELETE SET NULL (pulse_config_id)
);

CREATE INDEX missing_persons_pulse_runs_status_started_idx
  ON public.missing_persons_pulse_runs (status, started_at DESC);

CREATE INDEX missing_persons_pulse_run_configs_church_started_idx
  ON public.missing_persons_pulse_run_configs (church_id, started_at DESC);

ALTER TABLE public.workflow_cards
  ADD COLUMN source TEXT NOT NULL DEFAULT 'existing',
  ADD COLUMN pulse_config_id UUID,
  ADD COLUMN pulse_run_id UUID,
  ADD COLUMN triggered_at TIMESTAMPTZ;

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_source_format_check
  CHECK (
    char_length(source) BETWEEN 1 AND 64
    AND source ~ '^[a-z][a-z0-9_]*$'
  );

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_pulse_provenance_check
  CHECK (
    (
      source = 'missing_persons_pulse'
      AND pulse_config_id IS NOT NULL
      AND pulse_run_id IS NOT NULL
      AND triggered_at IS NOT NULL
    )
    OR
    (
      source <> 'missing_persons_pulse'
      AND pulse_config_id IS NULL
      AND pulse_run_id IS NULL
      AND triggered_at IS NULL
    )
  );

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_church_pulse_config_workflow_fk
  FOREIGN KEY (church_id, pulse_config_id, workflow_id)
  REFERENCES public.workflow_pulse_configs (church_id, id, workflow_id)
  ON DELETE NO ACTION
  DEFERRABLE INITIALLY DEFERRED
  NOT VALID;

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_pulse_run_fk
  FOREIGN KEY (pulse_run_id)
  REFERENCES public.missing_persons_pulse_runs (run_id)
  ON DELETE RESTRICT
  NOT VALID;

CREATE INDEX workflow_cards_active_church_workflow_person_idx
  ON public.workflow_cards (church_id, workflow_id, person_id)
  WHERE completed_at IS NULL;

CREATE VIEW public.missing_persons_pulse_existing_active_card_audit
WITH (security_invoker = true)
AS
SELECT
  card.church_id,
  card.workflow_id,
  card.person_id,
  count(*)::INTEGER AS active_card_count,
  array_agg(card.id ORDER BY card.created_at, card.id) AS card_ids
FROM public.workflow_cards AS card
WHERE card.completed_at IS NULL
GROUP BY card.church_id, card.workflow_id, card.person_id
HAVING count(*) > 1;

CREATE VIEW public.missing_persons_pulse_active_duplicate_audit
WITH (security_invoker = true)
AS
SELECT
  card.church_id,
  card.pulse_config_id,
  card.person_id,
  count(*)::INTEGER AS active_card_count,
  array_agg(card.id ORDER BY card.triggered_at, card.id) AS card_ids
FROM public.workflow_cards AS card
WHERE card.source = 'missing_persons_pulse'
  AND card.completed_at IS NULL
GROUP BY card.church_id, card.pulse_config_id, card.person_id
HAVING count(*) > 1;

ALTER TABLE public.missing_persons_pulse_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.missing_persons_pulse_run_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY missing_persons_pulse_run_configs_admin_select
  ON public.missing_persons_pulse_run_configs
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_church(church_id)));

REVOKE ALL ON TABLE public.missing_persons_pulse_runs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.missing_persons_pulse_run_configs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.missing_persons_pulse_existing_active_card_audit
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON TABLE public.missing_persons_pulse_active_duplicate_audit
  FROM PUBLIC, anon, authenticated;

GRANT ALL ON TABLE public.missing_persons_pulse_runs TO service_role;
GRANT ALL ON TABLE public.missing_persons_pulse_run_configs TO service_role;
GRANT SELECT ON TABLE public.missing_persons_pulse_run_configs TO authenticated;
GRANT SELECT ON TABLE public.missing_persons_pulse_existing_active_card_audit TO service_role;
GRANT SELECT ON TABLE public.missing_persons_pulse_active_duplicate_audit TO service_role;
