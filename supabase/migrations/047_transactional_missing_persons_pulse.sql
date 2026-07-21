-- 047_transactional_missing_persons_pulse.sql
-- <!-- AGENT: BACKEND -->
-- Each configuration is isolated in a PL/pgSQL subtransaction and protected by
-- a transaction-scoped advisory lock. Person matching and card creation are a
-- single set-based statement per configuration.

CREATE OR REPLACE FUNCTION public.get_missing_persons_pulse_run_result(
  p_run_id UUID
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT jsonb_build_object(
    'run_id', pulse_run.run_id,
    'status', pulse_run.status,
    'configs_processed', pulse_run.configs_processed,
    'configs_failed', pulse_run.configs_failed,
    'configs_skipped', pulse_run.configs_skipped,
    'people_scanned', pulse_run.people_scanned,
    'people_matched', pulse_run.people_matched,
    'cards_created', pulse_run.cards_created,
    'cards_skipped', pulse_run.cards_skipped,
    'reason', CASE
      WHEN pulse_run.status = 'skipped_locked' THEN 'already_running'
      ELSE NULL
    END,
    'error_code', pulse_run.sanitized_error_code
  )
  FROM public.missing_persons_pulse_runs AS pulse_run
  WHERE pulse_run.run_id = p_run_id;
$$;

CREATE OR REPLACE FUNCTION public.run_missing_persons_pulse(
  p_run_id UUID,
  p_church_id UUID DEFAULT NULL,
  p_now TIMESTAMPTZ DEFAULT clock_timestamp()
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  pulse_config RECORD;
  first_step_id UUID;
  first_step_days INTEGER;
  run_started_at TIMESTAMPTZ := clock_timestamp();
  config_started_at TIMESTAMPTZ;
  effective_now TIMESTAMPTZ := COALESCE(p_now, clock_timestamp());
  new_run_count INTEGER := 0;
  processed_count INTEGER := 0;
  failed_count INTEGER := 0;
  skipped_count INTEGER := 0;
  total_people_scanned INTEGER := 0;
  total_people_matched INTEGER := 0;
  total_cards_created INTEGER := 0;
  total_cards_skipped INTEGER := 0;
  config_people_scanned INTEGER := 0;
  config_people_matched INTEGER := 0;
  config_cards_created INTEGER := 0;
  config_cards_skipped INTEGER := 0;
  config_error_code TEXT;
  config_error_message TEXT;
  final_status TEXT;
  existing_scope_church_id UUID;
BEGIN
  IF p_run_id IS NULL THEN
    RAISE EXCEPTION USING
      ERRCODE = '22004',
      MESSAGE = 'run_id_required';
  END IF;

  INSERT INTO public.missing_persons_pulse_runs (
    run_id,
    scope_church_id,
    status,
    started_at
  )
  VALUES (
    p_run_id,
    p_church_id,
    'running',
    run_started_at
  )
  ON CONFLICT (run_id) DO NOTHING;

  GET DIAGNOSTICS new_run_count = ROW_COUNT;

  IF new_run_count = 0 THEN
    SELECT pulse_run.scope_church_id
    INTO existing_scope_church_id
    FROM public.missing_persons_pulse_runs AS pulse_run
    WHERE pulse_run.run_id = p_run_id;

    IF existing_scope_church_id IS DISTINCT FROM p_church_id THEN
      RETURN jsonb_build_object(
        'run_id', p_run_id,
        'status', 'failed',
        'configs_processed', 0,
        'configs_failed', 0,
        'configs_skipped', 0,
        'people_scanned', 0,
        'people_matched', 0,
        'cards_created', 0,
        'cards_skipped', 0,
        'reason', NULL,
        'error_code', 'run_id_scope_conflict'
      );
    END IF;

    RETURN public.get_missing_persons_pulse_run_result(p_run_id);
  END IF;

  BEGIN
    FOR pulse_config IN
      SELECT
        config.id,
        config.church_id,
        config.workflow_id,
        config.days_inactive,
        config.target_person_status
      FROM public.workflow_pulse_configs AS config
      WHERE config.is_active
        AND (p_church_id IS NULL OR config.church_id = p_church_id)
      ORDER BY config.church_id, config.id
      FOR SHARE OF config
    LOOP
      config_started_at := clock_timestamp();
      config_people_scanned := 0;
      config_people_matched := 0;
      config_cards_created := 0;
      config_cards_skipped := 0;
      config_error_code := NULL;
      config_error_message := NULL;
      first_step_id := NULL;
      first_step_days := NULL;

      IF NOT pg_try_advisory_xact_lock(
        hashtextextended('missing-persons-pulse:' || pulse_config.id::text, 0)
      ) THEN
        skipped_count := skipped_count + 1;

        INSERT INTO public.missing_persons_pulse_run_configs (
          run_id,
          church_id,
          pulse_config_id,
          status,
          started_at,
          finished_at,
          duration_ms,
          sanitized_error_code,
          sanitized_error_message
        )
        VALUES (
          p_run_id,
          pulse_config.church_id,
          pulse_config.id,
          'skipped_locked',
          config_started_at,
          clock_timestamp(),
          GREATEST(
            0,
            floor(extract(epoch FROM (clock_timestamp() - config_started_at)) * 1000)::BIGINT
          ),
          'already_running',
          'Another execution is processing this pulse configuration.'
        );

        CONTINUE;
      END IF;

      BEGIN
        IF pulse_config.days_inactive <= 0 THEN
          config_error_code := 'invalid_inactivity_threshold';
          config_error_message := 'The pulse configuration has an invalid inactivity threshold.';
        ELSIF pulse_config.target_person_status NOT IN (
          'active',
          'visitor',
          'inactive',
          'child'
        ) THEN
          config_error_code := 'invalid_target_status';
          config_error_message := 'The pulse configuration has an invalid target status.';
        ELSIF NOT EXISTS (
          SELECT 1
          FROM public.workflows AS workflow
          WHERE workflow.id = pulse_config.workflow_id
            AND workflow.church_id = pulse_config.church_id
        ) THEN
          config_error_code := 'invalid_workflow_reference';
          config_error_message := 'The pulse configuration workflow is unavailable.';
        ELSE
          SELECT
            step.id,
            step.default_days_to_complete
          INTO first_step_id, first_step_days
          FROM public.workflow_steps AS step
          WHERE step.church_id = pulse_config.church_id
            AND step.workflow_id = pulse_config.workflow_id
          ORDER BY step.position, step.id
          LIMIT 1;

          IF first_step_id IS NULL THEN
            config_error_code := 'missing_workflow_step';
            config_error_message := 'The pulse workflow has no available first step.';
          ELSE
            WITH candidates AS MATERIALIZED (
              SELECT person.id
              FROM public.people AS person
              WHERE person.church_id = pulse_config.church_id
                AND person.status = pulse_config.target_person_status
            ),
            matched AS MATERIALIZED (
              SELECT candidate.id
              FROM candidates AS candidate
              WHERE NOT EXISTS (
                SELECT 1
                FROM public.person_events AS person_event
                WHERE person_event.church_id = pulse_config.church_id
                  AND person_event.person_id = candidate.id
                  AND person_event.occurred_at >= (
                    effective_now - make_interval(days => pulse_config.days_inactive)
                  )
              )
            ),
            insertable AS MATERIALIZED (
              SELECT matched_person.id
              FROM matched AS matched_person
              WHERE NOT EXISTS (
                SELECT 1
                FROM public.workflow_cards AS active_card
                WHERE active_card.church_id = pulse_config.church_id
                  AND active_card.workflow_id = pulse_config.workflow_id
                  AND active_card.person_id = matched_person.id
                  AND active_card.completed_at IS NULL
              )
            ),
            inserted AS (
              INSERT INTO public.workflow_cards (
                church_id,
                person_id,
                workflow_id,
                current_step_id,
                due_date,
                notes,
                source,
                pulse_config_id,
                pulse_run_id,
                triggered_at
              )
              SELECT
                pulse_config.church_id,
                insertable_person.id,
                pulse_config.workflow_id,
                first_step_id,
                CASE
                  WHEN first_step_days IS NULL THEN NULL
                  ELSE
                    (effective_now AT TIME ZONE 'UTC')::date
                    + first_step_days
                END,
                format(
                  'Added automatically by missing-person pulse after %s elapsed days without a person event.',
                  pulse_config.days_inactive
                ),
                'missing_persons_pulse',
                pulse_config.id,
                p_run_id,
                effective_now
              FROM insertable AS insertable_person
              ON CONFLICT DO NOTHING
              RETURNING id
            )
            SELECT
              (SELECT count(*)::INTEGER FROM candidates),
              (SELECT count(*)::INTEGER FROM matched),
              (SELECT count(*)::INTEGER FROM inserted)
            INTO
              config_people_scanned,
              config_people_matched,
              config_cards_created;

            config_cards_skipped := config_people_matched - config_cards_created;
          END IF;
        END IF;
      EXCEPTION
        WHEN foreign_key_violation THEN
          config_error_code := 'tenant_reference_rejected';
          config_error_message := 'A tenant-scoped relationship was rejected.';
        WHEN unique_violation THEN
          config_error_code := 'card_idempotency_conflict';
          config_error_message := 'A concurrent card operation prevented this configuration from completing.';
        WHEN OTHERS THEN
          config_error_code := 'config_execution_failed';
          config_error_message := 'The pulse configuration could not be processed.';
      END;

      IF config_error_code IS NOT NULL THEN
        failed_count := failed_count + 1;

        INSERT INTO public.missing_persons_pulse_run_configs (
          run_id,
          church_id,
          pulse_config_id,
          status,
          started_at,
          finished_at,
          duration_ms,
          sanitized_error_code,
          sanitized_error_message
        )
        VALUES (
          p_run_id,
          pulse_config.church_id,
          pulse_config.id,
          'failed',
          config_started_at,
          clock_timestamp(),
          GREATEST(
            0,
            floor(extract(epoch FROM (clock_timestamp() - config_started_at)) * 1000)::BIGINT
          ),
          config_error_code,
          config_error_message
        );
      ELSE
        processed_count := processed_count + 1;
        total_people_scanned := total_people_scanned + config_people_scanned;
        total_people_matched := total_people_matched + config_people_matched;
        total_cards_created := total_cards_created + config_cards_created;
        total_cards_skipped := total_cards_skipped + config_cards_skipped;

        INSERT INTO public.missing_persons_pulse_run_configs (
          run_id,
          church_id,
          pulse_config_id,
          status,
          started_at,
          finished_at,
          duration_ms,
          people_scanned,
          people_matched,
          cards_created,
          cards_skipped
        )
        VALUES (
          p_run_id,
          pulse_config.church_id,
          pulse_config.id,
          'completed',
          config_started_at,
          clock_timestamp(),
          GREATEST(
            0,
            floor(extract(epoch FROM (clock_timestamp() - config_started_at)) * 1000)::BIGINT
          ),
          config_people_scanned,
          config_people_matched,
          config_cards_created,
          config_cards_skipped
        );
      END IF;
    END LOOP;

    final_status := CASE
      WHEN failed_count > 0 AND processed_count = 0 THEN 'failed'
      WHEN failed_count > 0 THEN 'completed_with_errors'
      WHEN skipped_count > 0 AND processed_count = 0 THEN 'skipped_locked'
      ELSE 'completed'
    END;

    UPDATE public.missing_persons_pulse_runs
    SET
      status = final_status,
      finished_at = clock_timestamp(),
      duration_ms = GREATEST(
        0,
        floor(extract(epoch FROM (clock_timestamp() - run_started_at)) * 1000)::BIGINT
      ),
      configs_processed = processed_count,
      configs_failed = failed_count,
      configs_skipped = skipped_count,
      people_scanned = total_people_scanned,
      people_matched = total_people_matched,
      cards_created = total_cards_created,
      cards_skipped = total_cards_skipped,
      sanitized_error_code = CASE
        WHEN final_status = 'failed' THEN 'all_configurations_failed'
        ELSE NULL
      END,
      sanitized_error_message = CASE
        WHEN final_status = 'failed' THEN 'No pulse configuration completed successfully.'
        ELSE NULL
      END
    WHERE run_id = p_run_id;
  EXCEPTION
    WHEN OTHERS THEN
      UPDATE public.missing_persons_pulse_runs
      SET
        status = 'failed',
        finished_at = clock_timestamp(),
        duration_ms = GREATEST(
          0,
          floor(extract(epoch FROM (clock_timestamp() - run_started_at)) * 1000)::BIGINT
        ),
        configs_processed = processed_count,
        configs_failed = failed_count,
        configs_skipped = skipped_count,
        people_scanned = total_people_scanned,
        people_matched = total_people_matched,
        cards_created = total_cards_created,
        cards_skipped = total_cards_skipped,
        sanitized_error_code = 'run_execution_failed',
        sanitized_error_message = 'The pulse run could not be completed.'
      WHERE run_id = p_run_id;
  END;

  RETURN public.get_missing_persons_pulse_run_result(p_run_id);
END;
$$;

REVOKE ALL ON FUNCTION public.get_missing_persons_pulse_run_result(UUID)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.run_missing_persons_pulse(UUID, UUID, TIMESTAMPTZ)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_missing_persons_pulse_run_result(UUID)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.run_missing_persons_pulse(UUID, UUID, TIMESTAMPTZ)
  TO service_role;
