-- 051_hg_link.sql
-- <!-- AGENT: ARCHITECT -->
-- HG Link: admin-editable public page (draft/published revisions), versioned
-- form definitions, form-specific answers, and follow-up tracking.
--
-- Design notes
--  * Page content is a validated JSON snapshot per revision, so publish and
--    restore are atomic and published content never changes while a draft is edited.
--  * Forms reuse connect_forms / connect_form_submissions (no parallel tables).
--  * All writes go through service-role route handlers that check tenant role.
--    RLS only grants SELECT to church managers; clients cannot write directly.
--
-- Rollback (manual):
--   DROP FUNCTION public.hg_link_restore(UUID, UUID, UUID);
--   DROP FUNCTION public.hg_link_publish(UUID, UUID);
--   DROP FUNCTION public.hg_link_save_draft(UUID, JSONB, UUID);
--   DROP TABLE public.hg_link_revisions;
--   ALTER TABLE public.connect_form_submissions DROP COLUMN answers, ... (see below)
--   ALTER TABLE public.connect_forms DROP COLUMN kind, ... (see below)
--   and re-create the 050 submit_connect_form signature.

CREATE TABLE IF NOT EXISTS public.hg_link_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'archived')),
  version INTEGER,
  content JSONB NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  CONSTRAINT hg_link_revisions_version_check
    CHECK ((status = 'draft' AND version IS NULL) OR (status <> 'draft' AND version IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS hg_link_one_draft_per_church
  ON public.hg_link_revisions (church_id) WHERE status = 'draft';
CREATE UNIQUE INDEX IF NOT EXISTS hg_link_one_published_per_church
  ON public.hg_link_revisions (church_id) WHERE status = 'published';
CREATE UNIQUE INDEX IF NOT EXISTS hg_link_version_unique
  ON public.hg_link_revisions (church_id, version) WHERE version IS NOT NULL;
CREATE INDEX IF NOT EXISTS hg_link_revisions_church_created_idx
  ON public.hg_link_revisions (church_id, created_at DESC);

ALTER TABLE public.hg_link_revisions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS hg_link_revisions_select_managers ON public.hg_link_revisions;
CREATE POLICY hg_link_revisions_select_managers
  ON public.hg_link_revisions
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_church(church_id)));

GRANT SELECT ON public.hg_link_revisions TO authenticated;
GRANT ALL ON public.hg_link_revisions TO service_role;

CREATE OR REPLACE FUNCTION public.hg_link_save_draft(
  p_church_id UUID,
  p_content JSONB,
  p_user_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  draft_id UUID;
BEGIN
  INSERT INTO public.hg_link_revisions (church_id, status, content, created_by)
  VALUES (p_church_id, 'draft', p_content, p_user_id)
  ON CONFLICT (church_id) WHERE status = 'draft'
  DO UPDATE SET content = EXCLUDED.content, created_by = EXCLUDED.created_by, created_at = NOW()
  RETURNING id INTO draft_id;
  RETURN draft_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.hg_link_publish(
  p_church_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  draft public.hg_link_revisions%ROWTYPE;
  next_version INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('hg_link:' || p_church_id::TEXT, 0));

  SELECT * INTO draft
  FROM public.hg_link_revisions
  WHERE church_id = p_church_id AND status = 'draft'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'no_draft');
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.hg_link_revisions WHERE church_id = p_church_id;

  UPDATE public.hg_link_revisions
  SET status = 'archived'
  WHERE church_id = p_church_id AND status = 'published';

  UPDATE public.hg_link_revisions
  SET status = 'published', version = next_version, published_at = NOW(), created_by = p_user_id
  WHERE id = draft.id;

  RETURN jsonb_build_object('success', true, 'revision_id', draft.id, 'version', next_version);
END;
$$;

-- Restoring clones an earlier revision into a new published revision so history is preserved.
CREATE OR REPLACE FUNCTION public.hg_link_restore(
  p_church_id UUID,
  p_revision_id UUID,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  source public.hg_link_revisions%ROWTYPE;
  next_version INTEGER;
  new_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('hg_link:' || p_church_id::TEXT, 0));

  SELECT * INTO source
  FROM public.hg_link_revisions
  WHERE id = p_revision_id AND church_id = p_church_id AND status IN ('published', 'archived');

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'revision_not_found');
  END IF;

  SELECT COALESCE(MAX(version), 0) + 1 INTO next_version
  FROM public.hg_link_revisions WHERE church_id = p_church_id;

  UPDATE public.hg_link_revisions
  SET status = 'archived'
  WHERE church_id = p_church_id AND status = 'published';

  INSERT INTO public.hg_link_revisions (church_id, status, version, content, created_by, published_at)
  VALUES (p_church_id, 'published', next_version, source.content, p_user_id, NOW())
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('success', true, 'revision_id', new_id, 'version', next_version, 'restored_from', source.version);
END;
$$;

REVOKE ALL ON FUNCTION public.hg_link_save_draft(UUID, JSONB, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hg_link_publish(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.hg_link_restore(UUID, UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hg_link_save_draft(UUID, JSONB, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.hg_link_publish(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.hg_link_restore(UUID, UUID, UUID) TO service_role;

-- Form definitions: draft_definition is edited freely; definition is what the public sees.
ALTER TABLE public.connect_forms
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'custom'
    CHECK (kind IN ('newcomer', 'new_christian', 'baptism', 'serve', 'custom')),
  ADD COLUMN IF NOT EXISTS definition JSONB,
  ADD COLUMN IF NOT EXISTS draft_definition JSONB,
  ADD COLUMN IF NOT EXISTS definition_version INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notify_email TEXT;

-- Answers and follow-up tracking live with the submission, never on the person profile.
ALTER TABLE public.connect_form_submissions
  ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS form_version INTEGER,
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'new'
    CHECK (follow_up_status IN ('new', 'contacted', 'in_progress', 'completed')),
  ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS connect_form_submissions_followup_idx
  ON public.connect_form_submissions (church_id, follow_up_status, created_at DESC)
  WHERE person_id IS NOT NULL;

-- connect_forms now holds draft definitions and a notification address, so the
-- blanket anonymous SELECT policy from 021 must go. Public pages read forms
-- server-side with the service role and an explicit (church_id, slug) filter.
DROP POLICY IF EXISTS "Public can view active connect forms" ON public.connect_forms;

-- Submission answers can contain pastoral information: only church managers may read
-- them through RLS (the existing policy). Role-limited staff access is enforced in
-- the route handlers, which use the service role.

DROP FUNCTION IF EXISTS public.submit_connect_form(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT);

CREATE OR REPLACE FUNCTION public.submit_connect_form(
  p_church_id UUID,
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
  p_campus TEXT,
  p_answers JSONB DEFAULT '{}'::JSONB,
  p_form_version INTEGER DEFAULT NULL
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
  IF p_church_id IS NULL THEN
    RAISE EXCEPTION 'church_id_required';
  END IF;

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
  WHERE church_id = p_church_id
    AND slug = p_slug
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
    answers = COALESCE(p_answers, '{}'::JSONB),
    form_version = p_form_version,
    updated_at = NOW()
  WHERE id = existing_submission.id;

  RETURN response;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_connect_form(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_connect_form(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, DATE, TEXT, JSONB, INTEGER) TO service_role;
