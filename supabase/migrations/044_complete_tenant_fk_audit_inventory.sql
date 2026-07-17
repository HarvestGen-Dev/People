-- 044_complete_tenant_fk_audit_inventory.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: migrations 041-043 enforce additional tenant-owned relationships
-- beyond the original audit view. Add complete service-role-only audit views
-- covering every current tenant-owned child -> tenant-owned parent FK.

CREATE OR REPLACE VIEW public.tenant_relationship_integrity_additional_violations AS
SELECT
  'people.household_id->households.id'::TEXT AS relationship_key,
  'people'::TEXT AS child_table,
  jsonb_build_object('id', child.id, 'household_id', child.household_id) AS child_identifier,
  child.church_id AS child_church_id,
  'households'::TEXT AS parent_table,
  child.household_id AS parent_id,
  parent.church_id AS parent_church_id,
  'Review household membership before clearing or moving household_id.'::TEXT AS repair_hint
FROM public.people AS child
JOIN public.households AS parent
  ON parent.id = child.household_id
WHERE child.household_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_claim_requests.person_id->people.id',
  'person_claim_requests',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'user_id', child.user_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review the claim request identity before moving or rejecting it.'
FROM public.person_claim_requests AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_proposed_updates.person_id->people.id',
  'person_proposed_updates',
  jsonb_build_object('id', child.id, 'person_id', child.person_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review the proposed update source before moving or superseding it.'
FROM public.person_proposed_updates AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_roles.person_id->people.id',
  'person_roles',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'role_id', child.role_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review the role assignment before moving or deleting it.'
FROM public.person_roles AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_roles.role_id->roles.id',
  'person_roles',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'role_id', child.role_id),
  child.church_id,
  'roles',
  child.role_id,
  parent.church_id,
  'Replace the role assignment with a tenant-local role after review.'
FROM public.person_roles AS child
JOIN public.roles AS parent
  ON parent.id = child.role_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'tags.target_workflow_id->workflows.id',
  'tags',
  jsonb_build_object('id', child.id, 'target_workflow_id', child.target_workflow_id),
  child.church_id,
  'workflows',
  child.target_workflow_id,
  parent.church_id,
  'Clear or replace the tag workflow target with a tenant-local workflow.'
FROM public.tags AS child
JOIN public.workflows AS parent
  ON parent.id = child.target_workflow_id
WHERE child.target_workflow_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'events.target_workflow_id->workflows.id',
  'events',
  jsonb_build_object('id', child.id, 'target_workflow_id', child.target_workflow_id),
  child.church_id,
  'workflows',
  child.target_workflow_id,
  parent.church_id,
  'Clear or replace the event target workflow with a tenant-local workflow.'
FROM public.events AS child
JOIN public.workflows AS parent
  ON parent.id = child.target_workflow_id
WHERE child.target_workflow_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'workflow_steps.workflow_id->workflows.id',
  'workflow_steps',
  jsonb_build_object('id', child.id, 'workflow_id', child.workflow_id),
  child.church_id,
  'workflows',
  child.workflow_id,
  parent.church_id,
  'Move or recreate the workflow step under a tenant-local workflow.'
FROM public.workflow_steps AS child
JOIN public.workflows AS parent
  ON parent.id = child.workflow_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'workflow_pulse_configs.workflow_id->workflows.id',
  'workflow_pulse_configs',
  jsonb_build_object('id', child.id, 'workflow_id', child.workflow_id),
  child.church_id,
  'workflows',
  child.workflow_id,
  parent.church_id,
  'Move or recreate the pulse config under a tenant-local workflow.'
FROM public.workflow_pulse_configs AS child
JOIN public.workflows AS parent
  ON parent.id = child.workflow_id
WHERE child.church_id <> parent.church_id;

COMMENT ON VIEW public.tenant_relationship_integrity_additional_violations IS
  'Service-role-only detail view for tenant relationships added to enforcement after the original tenant relationship audit.';

REVOKE ALL ON public.tenant_relationship_integrity_additional_violations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.tenant_relationship_integrity_additional_violations TO service_role;

CREATE OR REPLACE VIEW public.tenant_relationship_integrity_complete_violations AS
SELECT *
FROM public.tenant_relationship_integrity_violations
UNION ALL
SELECT *
FROM public.tenant_relationship_integrity_additional_violations;

COMMENT ON VIEW public.tenant_relationship_integrity_complete_violations IS
  'Service-role-only complete detail view of all current tenant-owned child-to-parent relationship violations. Contains IDs only.';

REVOKE ALL ON public.tenant_relationship_integrity_complete_violations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.tenant_relationship_integrity_complete_violations TO service_role;

CREATE OR REPLACE VIEW public.tenant_relationship_integrity_complete_audit AS
WITH relationship_keys(relationship_key) AS (
  VALUES
    ('connect_form_submissions.form_id->connect_forms.id'),
    ('connect_form_submissions.person_id->people.id'),
    ('connect_forms.target_tag_id->tags.id'),
    ('connect_forms.target_workflow_id->workflows.id'),
    ('event_registrations.event_id->events.id'),
    ('event_registrations.person_id->people.id'),
    ('events.target_workflow_id->workflows.id'),
    ('list_people.list_id->lists.id'),
    ('list_people.person_id->people.id'),
    ('notes.person_id->people.id'),
    ('people.household_id->households.id'),
    ('person_claim_requests.person_id->people.id'),
    ('person_events.person_id->people.id'),
    ('person_field_values.field_definition_id->field_definitions.id'),
    ('person_field_values.person_id->people.id'),
    ('person_proposed_updates.person_id->people.id'),
    ('person_roles.person_id->people.id'),
    ('person_roles.role_id->roles.id'),
    ('person_tags.person_id->people.id'),
    ('person_tags.tag_id->tags.id'),
    ('person_user_links.person_id->people.id'),
    ('tags.target_workflow_id->workflows.id'),
    ('webhook_deliveries.webhook_id->webhooks.id'),
    ('workflow_cards.current_step_id->workflow_steps.id'),
    ('workflow_cards.person_id->people.id'),
    ('workflow_cards.workflow_id->workflows.id'),
    ('workflow_pulse_configs.workflow_id->workflows.id'),
    ('workflow_steps.workflow_id->workflows.id')
),
violation_counts AS (
  SELECT
    relationship_key,
    COUNT(*)::INTEGER AS invalid_row_count
  FROM public.tenant_relationship_integrity_complete_violations
  GROUP BY relationship_key
)
SELECT
  relationship_keys.relationship_key,
  COALESCE(violation_counts.invalid_row_count, 0) AS invalid_row_count
FROM relationship_keys
LEFT JOIN violation_counts
  ON violation_counts.relationship_key = relationship_keys.relationship_key
ORDER BY relationship_keys.relationship_key;

COMMENT ON VIEW public.tenant_relationship_integrity_complete_audit IS
  'Service-role-only complete summary of all current tenant-owned child-to-parent relationship violation counts.';

REVOKE ALL ON public.tenant_relationship_integrity_complete_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.tenant_relationship_integrity_complete_audit TO service_role;
