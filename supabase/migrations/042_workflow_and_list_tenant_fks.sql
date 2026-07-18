-- 042_workflow_and_list_tenant_fks.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: workflow, workflow-step, workflow-config, tag workflow target,
-- and static list memberships must stay inside the same tenant. Constraints
-- are NOT VALID pending production audit and validation.

ALTER TABLE public.workflows
  ADD CONSTRAINT workflows_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.workflow_steps
  ADD CONSTRAINT workflow_steps_church_id_id_key UNIQUE (church_id, id);

ALTER TABLE public.lists
  ADD CONSTRAINT lists_church_id_id_key UNIQUE (church_id, id);

CREATE INDEX IF NOT EXISTS workflow_steps_church_workflow_idx
  ON public.workflow_steps (church_id, workflow_id);

CREATE INDEX IF NOT EXISTS tags_church_target_workflow_idx
  ON public.tags (church_id, target_workflow_id)
  WHERE target_workflow_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS workflow_cards_church_person_idx
  ON public.workflow_cards (church_id, person_id);

CREATE INDEX IF NOT EXISTS workflow_cards_church_workflow_idx
  ON public.workflow_cards (church_id, workflow_id);

CREATE INDEX IF NOT EXISTS workflow_cards_church_current_step_idx
  ON public.workflow_cards (church_id, current_step_id)
  WHERE current_step_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS list_people_church_list_idx
  ON public.list_people (church_id, list_id);

CREATE INDEX IF NOT EXISTS list_people_church_person_idx
  ON public.list_people (church_id, person_id);

ALTER TABLE public.workflow_steps
  ADD CONSTRAINT workflow_steps_church_workflow_fk
  FOREIGN KEY (church_id, workflow_id)
  REFERENCES public.workflows (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.workflow_pulse_configs
  ADD CONSTRAINT workflow_pulse_configs_church_workflow_fk
  FOREIGN KEY (church_id, workflow_id)
  REFERENCES public.workflows (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.tags
  ADD CONSTRAINT tags_church_target_workflow_fk
  FOREIGN KEY (church_id, target_workflow_id)
  REFERENCES public.workflows (church_id, id)
  ON DELETE SET NULL (target_workflow_id)
  NOT VALID;

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_church_workflow_fk
  FOREIGN KEY (church_id, workflow_id)
  REFERENCES public.workflows (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.workflow_cards
  ADD CONSTRAINT workflow_cards_church_current_step_fk
  FOREIGN KEY (church_id, current_step_id)
  REFERENCES public.workflow_steps (church_id, id)
  ON DELETE SET NULL (current_step_id)
  NOT VALID;

ALTER TABLE public.list_people
  ADD CONSTRAINT list_people_church_list_fk
  FOREIGN KEY (church_id, list_id)
  REFERENCES public.lists (church_id, id)
  ON DELETE CASCADE
  NOT VALID;

ALTER TABLE public.list_people
  ADD CONSTRAINT list_people_church_person_fk
  FOREIGN KEY (church_id, person_id)
  REFERENCES public.people (church_id, id)
  ON DELETE CASCADE
  NOT VALID;
