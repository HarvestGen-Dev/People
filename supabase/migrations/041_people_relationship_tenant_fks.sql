-- 041_people_relationship_tenant_fks.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: enforce same-tenant relationships for people-centric child
-- tables even when writes use the service role and bypass RLS. Constraints are
-- added as NOT VALID so existing production rows can be audited with migration
-- 040 before validation. New inserts and updates are enforced immediately.

ALTER TABLE public.households
  ADD CONSTRAINT households_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.people
  ADD CONSTRAINT people_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.tags
  ADD CONSTRAINT tags_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.field_definitions
  ADD CONSTRAINT field_definitions_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.roles
  ADD CONSTRAINT roles_church_id_id_key UNIQUE (church_id, id);

CREATE INDEX IF NOT EXISTS people_church_household_idx
  ON public.people (church_id, household_id)
  WHERE household_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS person_tags_church_person_idx
  ON public.person_tags (church_id, person_id);

CREATE INDEX IF NOT EXISTS person_tags_church_tag_idx
  ON public.person_tags (church_id, tag_id);

CREATE INDEX IF NOT EXISTS person_field_values_church_person_idx
  ON public.person_field_values (church_id, person_id);

CREATE INDEX IF NOT EXISTS person_field_values_church_field_definition_idx
  ON public.person_field_values (church_id, field_definition_id);

CREATE INDEX IF NOT EXISTS notes_church_person_idx
  ON public.notes (church_id, person_id);

CREATE INDEX IF NOT EXISTS person_events_church_person_idx
  ON public.person_events (church_id, person_id);

CREATE INDEX IF NOT EXISTS person_claim_requests_church_person_idx
  ON public.person_claim_requests (church_id, person_id);

CREATE INDEX IF NOT EXISTS person_proposed_updates_church_person_idx
  ON public.person_proposed_updates (church_id, person_id);

CREATE INDEX IF NOT EXISTS person_roles_church_role_idx
  ON public.person_roles (church_id, role_id);

ALTER TABLE public.people
  ADD CONSTRAINT people_church_household_fk
  FOREIGN KEY (church_id, household_id)
  REFERENCES public.households (church_id, id)
  ON DELETE SET NULL (household_id)
  NOT VALID;

ALTER TABLE public.person_tags
  ADD CONSTRAINT person_tags_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_tags
  ADD CONSTRAINT person_tags_church_tag_fk
  FOREIGN KEY (church_id, tag_id)
  REFERENCES public.tags (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_field_values
  ADD CONSTRAINT person_field_values_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_field_values
  ADD CONSTRAINT person_field_values_church_field_definition_fk
  FOREIGN KEY (church_id, field_definition_id)
  REFERENCES public.field_definitions (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.notes
  ADD CONSTRAINT notes_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_events
  ADD CONSTRAINT person_events_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_claim_requests
  ADD CONSTRAINT person_claim_requests_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_proposed_updates
  ADD CONSTRAINT person_proposed_updates_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_roles
  ADD CONSTRAINT person_roles_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.person_roles
  ADD CONSTRAINT person_roles_church_role_fk
  FOREIGN KEY (church_id, role_id)
  REFERENCES public.roles (church_id, id)
  ON DELETE CASCADE
  NOT VALID;
