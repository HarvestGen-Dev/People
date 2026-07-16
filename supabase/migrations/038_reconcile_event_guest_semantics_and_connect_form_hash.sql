-- 038_reconcile_event_guest_semantics_and_connect_form_hash.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale:
-- 1. Migration 031 may already have executed in shared environments. Do not
--    guess historical event-registration guest semantics in a later migration.
--    Preserve current values and expose an audit surface for manual review.
-- 2. Connect-form idempotency keys must be scoped to the form and request body.
--    Reusing the same key with materially different input is a conflict.

CREATE OR REPLACE VIEW public.event_registration_guest_semantics_audit AS
SELECT
  registration.id,
  registration.church_id,
  registration.event_id,
  registration.first_name,
  registration.last_name,
  registration.email,
  registration.status,
  registration.guests AS current_stored_guests,
  1 + registration.guests AS claimed_spots_under_additional_guest_semantics,
  GREATEST(registration.guests - 1, 0) AS possible_legacy_reconciled_guest_value,
  registration.created_at,
  registration.updated_at
FROM public.event_registrations AS registration
WHERE registration.guests > 0;

COMMENT ON VIEW public.event_registration_guest_semantics_audit IS
  'Audit-only view for potentially ambiguous historical event_registrations.guests rows. This migration intentionally does not rewrite data. If a row is externally confirmed to have stored total-attendee semantics, repair it with a controlled UPDATE against explicit registration IDs, for example: UPDATE public.event_registrations SET guests = GREATEST(guests - 1, 0) WHERE id IN (...confirmed legacy ids...) AND guests > 0;';

REVOKE ALL ON public.event_registration_guest_semantics_audit FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.event_registration_guest_semantics_audit TO service_role;

ALTER TABLE public.connect_form_submissions
  ADD COLUMN IF NOT EXISTS request_body_hash TEXT;

ALTER TABLE public.connect_form_submissions
  DROP CONSTRAINT IF EXISTS connect_form_submissions_request_body_hash_check;

ALTER TABLE public.connect_form_submissions
  ADD CONSTRAINT connect_form_submissions_request_body_hash_check
  CHECK (request_body_hash IS NULL OR request_body_hash ~ '^[a-f0-9]{64}$') NOT VALID;

ALTER TABLE public.connect_form_submissions
  VALIDATE CONSTRAINT connect_form_submissions_request_body_hash_check;

CREATE OR REPLACE FUNCTION public.submit_connect_form(
  p_slug TEXT,
  p_idempotency_key TEXT,
  p_request_body_hash TEXT,
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

  IF p_request_body_hash IS NULL OR p_request_body_hash !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'request_body_hash_required';
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

  INSERT INTO public.connect_form_submissions (
    church_id,
    form_id,
    idempotency_key,
    request_body_hash
  )
  VALUES (
    form_row.church_id,
    form_row.id,
    p_idempotency_key,
    p_request_body_hash
  )
  ON CONFLICT (church_id, form_id, idempotency_key) DO NOTHING;

  SELECT *
  INTO existing_submission
  FROM public.connect_form_submissions
  WHERE church_id = form_row.church_id
    AND form_id = form_row.id
    AND idempotency_key = p_idempotency_key
  FOR UPDATE;

  IF existing_submission.request_body_hash IS NOT NULL
    AND existing_submission.request_body_hash <> p_request_body_hash THEN
    RETURN jsonb_build_object('success', false, 'code', 'idempotency_conflict');
  END IF;

  IF existing_submission.request_body_hash IS NULL THEN
    UPDATE public.connect_form_submissions
    SET request_body_hash = p_request_body_hash, updated_at = NOW()
    WHERE id = existing_submission.id;
  END IF;

  IF existing_submission.response_json IS NOT NULL THEN
    RETURN existing_submission.response_json;
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

REVOKE ALL ON FUNCTION public.submit_connect_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_connect_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.submit_connect_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT) FROM PUBLIC, anon, authenticated, service_role;
DROP FUNCTION IF EXISTS public.submit_connect_form(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT);
