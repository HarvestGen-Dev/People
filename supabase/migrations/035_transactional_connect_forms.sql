-- 035_transactional_connect_forms.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: public connect-form submissions need one transactional database
-- boundary for identity resolution, safe profile merge, proposed updates,
-- idempotency, tag/workflow automation, person events, and webhook outbox rows.

CREATE TABLE IF NOT EXISTS public.person_proposed_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  display_id TEXT NOT NULL UNIQUE DEFAULT public.generate_display_id('PPU'),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  current_value TEXT,
  proposed_value TEXT NOT NULL,
  source TEXT NOT NULL,
  source_reference TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),
  resolution_note TEXT,
  CONSTRAINT person_proposed_updates_field_check
    CHECK (field_name IN ('first_name', 'last_name', 'email', 'phone', 'gender', 'birthdate', 'campus')),
  CONSTRAINT person_proposed_updates_source_check
    CHECK (source IN ('connect_form', 'portal_profile', 'event_registration', 'shepherd', 'drip_and_brew', 'csv_import', 'admin')),
  CONSTRAINT person_proposed_updates_status_check
    CHECK (status IN ('pending', 'accepted', 'rejected', 'superseded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS person_proposed_updates_pending_unique
  ON public.person_proposed_updates(church_id, person_id, field_name, source, proposed_value)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS person_proposed_updates_church_status_idx
  ON public.person_proposed_updates(church_id, status, submitted_at DESC);

ALTER TABLE public.person_proposed_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS person_proposed_updates_select_managers ON public.person_proposed_updates;
CREATE POLICY person_proposed_updates_select_managers
  ON public.person_proposed_updates
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_church(church_id)));

DROP POLICY IF EXISTS person_proposed_updates_insert_service ON public.person_proposed_updates;
CREATE POLICY person_proposed_updates_insert_service
  ON public.person_proposed_updates
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.can_manage_church(church_id)));

DROP POLICY IF EXISTS person_proposed_updates_update_managers ON public.person_proposed_updates;
CREATE POLICY person_proposed_updates_update_managers
  ON public.person_proposed_updates
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.can_manage_church(church_id)))
  WITH CHECK ((SELECT public.can_manage_church(church_id)));

CREATE TABLE IF NOT EXISTS public.connect_form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  form_id UUID NOT NULL REFERENCES public.connect_forms(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (church_id, form_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS connect_form_submissions_person_idx
  ON public.connect_form_submissions(church_id, person_id, created_at DESC);

ALTER TABLE public.connect_form_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS connect_form_submissions_managers ON public.connect_form_submissions;
CREATE POLICY connect_form_submissions_managers
  ON public.connect_form_submissions
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_church(church_id)));

CREATE OR REPLACE FUNCTION public.review_person_proposed_update(
  p_church_id UUID,
  p_proposal_id UUID,
  p_decision TEXT,
  p_resolution_note TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  proposal public.person_proposed_updates%ROWTYPE;
  reviewer UUID := auth.uid();
BEGIN
  IF reviewer IS NULL OR NOT public.can_manage_church(p_church_id) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_decision NOT IN ('accepted', 'rejected') THEN
    RAISE EXCEPTION 'invalid_decision';
  END IF;

  SELECT *
  INTO proposal
  FROM public.person_proposed_updates
  WHERE id = p_proposal_id
    AND church_id = p_church_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'proposal_not_found';
  END IF;

  IF proposal.status <> 'pending' THEN
    RETURN jsonb_build_object('success', true, 'status', proposal.status, 'already_reviewed', true);
  END IF;

  IF p_decision = 'accepted' THEN
    CASE proposal.field_name
      WHEN 'first_name' THEN
        UPDATE public.people SET first_name = proposal.proposed_value WHERE id = proposal.person_id AND church_id = p_church_id;
      WHEN 'last_name' THEN
        UPDATE public.people SET last_name = proposal.proposed_value WHERE id = proposal.person_id AND church_id = p_church_id;
      WHEN 'email' THEN
        UPDATE public.people SET email = proposal.proposed_value WHERE id = proposal.person_id AND church_id = p_church_id;
      WHEN 'phone' THEN
        UPDATE public.people SET phone = proposal.proposed_value WHERE id = proposal.person_id AND church_id = p_church_id;
      WHEN 'gender' THEN
        UPDATE public.people SET gender = proposal.proposed_value WHERE id = proposal.person_id AND church_id = p_church_id;
      WHEN 'birthdate' THEN
        UPDATE public.people SET birthdate = proposal.proposed_value::DATE WHERE id = proposal.person_id AND church_id = p_church_id;
      WHEN 'campus' THEN
        UPDATE public.people SET campus = proposal.proposed_value WHERE id = proposal.person_id AND church_id = p_church_id;
      ELSE
        RAISE EXCEPTION 'unsupported_field';
    END CASE;
  END IF;

  UPDATE public.person_proposed_updates
  SET
    status = p_decision,
    reviewed_at = NOW(),
    reviewed_by = reviewer,
    resolution_note = p_resolution_note
  WHERE id = proposal.id;

  RETURN jsonb_build_object('success', true, 'status', p_decision);
END;
$$;

REVOKE ALL ON FUNCTION public.review_person_proposed_update(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.review_person_proposed_update(UUID, UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_connect_form(
  p_slug TEXT,
  p_idempotency_key TEXT,
  p_rate_limit_subject TEXT,
  p_first_name TEXT,
  p_last_name TEXT,
  p_email TEXT,
  p_phone TEXT,
  p_gender TEXT,
  p_birthdate DATE,
  p_campus TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  form_row public.connect_forms%ROWTYPE;
  existing_submission public.connect_form_submissions%ROWTYPE;
  lookup_row RECORD;
  person_row public.people%ROWTYPE;
  first_step RECORD;
  response JSONB;
  event_type TEXT;
  event_id UUID := gen_random_uuid();
  webhook_payload JSONB;
  rate_limit_result RECORD;
BEGIN
  IF p_slug IS NULL OR btrim(p_slug) = '' THEN
    RAISE EXCEPTION 'form_slug_required';
  END IF;

  IF p_idempotency_key IS NULL OR btrim(p_idempotency_key) = '' OR length(p_idempotency_key) > 160 THEN
    RAISE EXCEPTION 'idempotency_key_required';
  END IF;

  SELECT *
  INTO form_row
  FROM public.connect_forms
  WHERE slug = p_slug
    AND is_active = TRUE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'form_not_found');
  END IF;

  IF form_row.target_tag_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tags
    WHERE id = form_row.target_tag_id
      AND church_id = form_row.church_id
  ) THEN
    RAISE EXCEPTION 'connect_form_cross_tenant_tag';
  END IF;

  IF form_row.target_workflow_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.workflows
    WHERE id = form_row.target_workflow_id
      AND church_id = form_row.church_id
  ) THEN
    RAISE EXCEPTION 'connect_form_cross_tenant_workflow';
  END IF;

  SELECT *
  INTO rate_limit_result
  FROM public.consume_public_rate_limit(
    'public:connect-form-submit',
    p_rate_limit_subject,
    10,
    60 * 60
  );

  IF NOT rate_limit_result.allowed THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'rate_limited',
      'reset_at', rate_limit_result.reset_at
    );
  END IF;

  INSERT INTO public.connect_form_submissions (
    church_id,
    form_id,
    idempotency_key
  )
  VALUES (
    form_row.church_id,
    form_row.id,
    p_idempotency_key
  )
  ON CONFLICT (church_id, form_id, idempotency_key) DO NOTHING;

  SELECT *
  INTO existing_submission
  FROM public.connect_form_submissions
  WHERE church_id = form_row.church_id
    AND form_id = form_row.id
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF existing_submission.response_json IS NOT NULL THEN
    RETURN existing_submission.response_json;
  END IF;

  SELECT *
  INTO lookup_row
  FROM public.lookup_or_create_person(
    form_row.church_id,
    p_email,
    p_phone,
    p_first_name,
    p_last_name
  );

  IF lookup_row.result_conflict IS NOT NULL THEN
    response := jsonb_build_object(
      'success', false,
      'code', 'identity_conflict',
      'message', lookup_row.result_conflict
    );

    UPDATE public.connect_form_submissions
    SET response_json = response, updated_at = NOW()
    WHERE id = existing_submission.id;

    RETURN response;
  END IF;

  SELECT *
  INTO person_row
  FROM public.people
  WHERE id = lookup_row.result_person_id
    AND church_id = form_row.church_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'person_resolution_failed';
  END IF;

  IF NOT lookup_row.result_found THEN
    UPDATE public.people
    SET
      gender = COALESCE(gender, p_gender),
      birthdate = COALESCE(birthdate, p_birthdate),
      campus = COALESCE(NULLIF(campus, ''), p_campus, campus)
    WHERE id = person_row.id
      AND church_id = form_row.church_id;
  ELSE
    IF p_first_name IS NOT NULL AND p_first_name <> person_row.first_name THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'first_name', person_row.first_name, p_first_name, 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;
    IF p_last_name IS NOT NULL AND p_last_name <> person_row.last_name THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'last_name', person_row.last_name, p_last_name, 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_email IS NOT NULL AND person_row.email IS NULL THEN
      UPDATE public.people SET email = public.normalize_person_email(p_email) WHERE id = person_row.id AND church_id = form_row.church_id;
    ELSIF p_email IS NOT NULL AND public.normalize_person_email(p_email) IS DISTINCT FROM person_row.email_normalized THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'email', person_row.email, public.normalize_person_email(p_email), 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_phone IS NOT NULL AND person_row.phone IS NULL THEN
      UPDATE public.people SET phone = public.normalize_person_phone(p_phone) WHERE id = person_row.id AND church_id = form_row.church_id;
    ELSIF p_phone IS NOT NULL AND public.normalize_person_phone(p_phone) IS DISTINCT FROM person_row.phone_normalized THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'phone', person_row.phone, public.normalize_person_phone(p_phone), 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_gender IS NOT NULL AND person_row.gender IS NULL THEN
      UPDATE public.people SET gender = p_gender WHERE id = person_row.id AND church_id = form_row.church_id;
    ELSIF p_gender IS NOT NULL AND p_gender IS DISTINCT FROM person_row.gender THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'gender', person_row.gender, p_gender, 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_birthdate IS NOT NULL AND person_row.birthdate IS NULL THEN
      UPDATE public.people SET birthdate = p_birthdate WHERE id = person_row.id AND church_id = form_row.church_id;
    ELSIF p_birthdate IS NOT NULL AND p_birthdate IS DISTINCT FROM person_row.birthdate THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'birthdate', person_row.birthdate::TEXT, p_birthdate::TEXT, 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;

    IF p_campus IS NOT NULL AND (person_row.campus IS NULL OR person_row.campus = '') THEN
      UPDATE public.people SET campus = p_campus WHERE id = person_row.id AND church_id = form_row.church_id;
    ELSIF p_campus IS NOT NULL AND p_campus IS DISTINCT FROM person_row.campus THEN
      INSERT INTO public.person_proposed_updates (church_id, person_id, field_name, current_value, proposed_value, source, source_reference)
      VALUES (form_row.church_id, person_row.id, 'campus', person_row.campus, p_campus, 'connect_form', p_idempotency_key)
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;

  IF form_row.target_tag_id IS NOT NULL THEN
    INSERT INTO public.person_tags (church_id, person_id, tag_id)
    VALUES (form_row.church_id, person_row.id, form_row.target_tag_id)
    ON CONFLICT (person_id, tag_id) DO NOTHING;
  END IF;

  IF form_row.target_workflow_id IS NOT NULL THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(form_row.church_id::TEXT || ':' || person_row.id::TEXT || ':' || form_row.target_workflow_id::TEXT, 0));

    SELECT id, default_days_to_complete
    INTO first_step
    FROM public.workflow_steps
    WHERE church_id = form_row.church_id
      AND workflow_id = form_row.target_workflow_id
    ORDER BY position ASC
    LIMIT 1;

    IF first_step.id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.workflow_cards
      WHERE church_id = form_row.church_id
        AND workflow_id = form_row.target_workflow_id
        AND person_id = person_row.id
        AND completed_at IS NULL
    ) THEN
      INSERT INTO public.workflow_cards (
        church_id,
        workflow_id,
        current_step_id,
        person_id,
        due_date,
        notes
      )
      VALUES (
        form_row.church_id,
        form_row.target_workflow_id,
        first_step.id,
        person_row.id,
        CASE
          WHEN first_step.default_days_to_complete IS NULL THEN NULL
          ELSE (CURRENT_DATE + first_step.default_days_to_complete)
        END,
        'Added automatically via Connect Form: ' || p_slug
      );
    END IF;
  END IF;

  INSERT INTO public.person_events (
    church_id,
    person_id,
    source,
    event_type,
    metadata
  )
  VALUES (
    form_row.church_id,
    person_row.id,
    'people',
    'connect_form_submitted',
    jsonb_build_object(
      'form_id', form_row.id,
      'form_slug', p_slug,
      'idempotency_key', p_idempotency_key,
      'found_existing_person', lookup_row.result_found
    )
  );

  event_type := CASE WHEN lookup_row.result_found THEN 'person.updated' ELSE 'person.created' END;
  webhook_payload := jsonb_build_object(
    'event', event_type,
    'event_id', event_id,
    'timestamp', NOW(),
    'data', jsonb_build_object('id', person_row.id)
  );

  INSERT INTO public.webhook_deliveries (
    church_id,
    webhook_id,
    event_id,
    delivery_id,
    event_type,
    payload,
    status,
    attempt_count
  )
  SELECT
    form_row.church_id,
    webhook.id,
    event_id,
    gen_random_uuid(),
    event_type,
    webhook_payload,
    'pending',
    0
  FROM public.webhooks AS webhook
  WHERE webhook.church_id = form_row.church_id
    AND webhook.is_active = TRUE
    AND webhook.events @> ARRAY[event_type];

  response := jsonb_build_object(
    'success', true,
    'person_id', person_row.id,
    'found', lookup_row.result_found,
    'idempotency_key', p_idempotency_key
  );

  UPDATE public.connect_form_submissions
  SET
    person_id = person_row.id,
    response_json = response,
    updated_at = NOW()
  WHERE id = existing_submission.id;

  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_connect_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_connect_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO service_role;
