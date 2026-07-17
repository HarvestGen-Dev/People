-- 043_event_connect_portal_integration_tenant_fks.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: event, public connect-form, portal profile-link, and webhook
-- delivery references must not cross tenant boundaries. Constraints are NOT
-- VALID so production can audit historical rows before validation.

ALTER TABLE public.events
  ADD CONSTRAINT events_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.connect_forms
  ADD CONSTRAINT connect_forms_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.webhooks
  ADD CONSTRAINT webhooks_church_id_id_key UNIQUE (church_id, id);

CREATE INDEX IF NOT EXISTS events_church_target_workflow_idx
  ON public.events (church_id, target_workflow_id)
  WHERE target_workflow_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS event_registrations_church_person_idx
  ON public.event_registrations (church_id, person_id)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS person_user_links_church_person_idx
  ON public.person_user_links (church_id, person_id);

CREATE INDEX IF NOT EXISTS connect_forms_church_target_tag_idx
  ON public.connect_forms (church_id, target_tag_id)
  WHERE target_tag_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS connect_forms_church_target_workflow_idx
  ON public.connect_forms (church_id, target_workflow_id)
  WHERE target_workflow_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS connect_form_submissions_church_form_idx
  ON public.connect_form_submissions (church_id, form_id);

CREATE INDEX IF NOT EXISTS connect_form_submissions_church_person_idx
  ON public.connect_form_submissions (church_id, person_id)
  WHERE person_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS webhook_deliveries_church_webhook_idx
  ON public.webhook_deliveries (church_id, webhook_id);

ALTER TABLE public.events
  ADD CONSTRAINT events_church_target_workflow_fk
  FOREIGN KEY (church_id, target_workflow_id)
  REFERENCES public.workflows (church_id, id)
  ON DELETE SET NULL (target_workflow_id)
  NOT VALID;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_church_event_fk
  FOREIGN KEY (church_id, event_id)
  REFERENCES public.events (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.event_registrations
  ADD CONSTRAINT event_registrations_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE SET NULL (person_id)
  NOT VALID;

ALTER TABLE public.person_user_links
  ADD CONSTRAINT person_user_links_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.connect_forms
  ADD CONSTRAINT connect_forms_church_target_tag_fk
  FOREIGN KEY (church_id, target_tag_id)
  REFERENCES public.tags (church_id, id)
  ON DELETE SET NULL (target_tag_id)
  NOT VALID;

ALTER TABLE public.connect_forms
  ADD CONSTRAINT connect_forms_church_target_workflow_fk
  FOREIGN KEY (church_id, target_workflow_id)
  REFERENCES public.workflows (church_id, id)
  ON DELETE SET NULL (target_workflow_id)
  NOT VALID;

ALTER TABLE public.connect_form_submissions
  ADD CONSTRAINT connect_form_submissions_church_form_fk
  FOREIGN KEY (church_id, form_id)
  REFERENCES public.connect_forms (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.connect_form_submissions
  ADD CONSTRAINT connect_form_submissions_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE SET NULL (person_id)
  NOT VALID;

ALTER TABLE public.webhook_deliveries
  ADD CONSTRAINT webhook_deliveries_church_webhook_fk
  FOREIGN KEY (church_id, webhook_id)
  REFERENCES public.webhooks (church_id, id)
  ON DELETE CASCADE
  NOT VALID;
