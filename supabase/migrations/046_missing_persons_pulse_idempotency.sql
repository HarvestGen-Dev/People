-- 046_missing_persons_pulse_idempotency.sql
-- <!-- AGENT: ARCHITECT -->
-- Apply only after the service-role duplicate audit in migration 045 reports no
-- duplicate active pulse cards. Existing cards are never repaired implicitly.

CREATE UNIQUE INDEX workflow_cards_active_pulse_config_person_key
  ON public.workflow_cards (church_id, pulse_config_id, person_id)
  WHERE source = 'missing_persons_pulse'
    AND completed_at IS NULL;
