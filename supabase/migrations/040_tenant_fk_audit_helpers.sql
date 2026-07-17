-- 040_tenant_fk_audit_helpers.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: before adding tenant-composite foreign keys, expose a
-- service-role-only audit surface that reports existing cross-tenant
-- relationships without rewriting or deleting data.

CREATE OR REPLACE VIEW public.tenant_relationship_integrity_violations AS
SELECT
  'person_tags.person_id->people.id'::TEXT AS relationship_key,
  'person_tags'::TEXT AS child_table,
  jsonb_build_object('person_id', child.person_id, 'tag_id', child.tag_id) AS child_identifier,
  child.church_id AS child_church_id,
  'people'::TEXT AS parent_table,
  child.person_id AS parent_id,
  parent.church_id AS parent_church_id,
  'Set person_tags.church_id to the person church or remove the invalid tag assignment after review.'::TEXT AS repair_hint
FROM public.person_tags AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_tags.tag_id->tags.id',
  'person_tags',
  jsonb_build_object('person_id', child.person_id, 'tag_id', child.tag_id),
  child.church_id,
  'tags',
  child.tag_id,
  parent.church_id,
  'Set person_tags.church_id to the tag church only if the person also belongs to that church; otherwise remove the invalid tag assignment.'
FROM public.person_tags AS child
JOIN public.tags AS parent
  ON parent.id = child.tag_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_field_values.person_id->people.id',
  'person_field_values',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'field_definition_id', child.field_definition_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review whether the field value belongs to this person; then repair church_id or delete the invalid field value.'
FROM public.person_field_values AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_field_values.field_definition_id->field_definitions.id',
  'person_field_values',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'field_definition_id', child.field_definition_id),
  child.church_id,
  'field_definitions',
  child.field_definition_id,
  parent.church_id,
  'Review whether the field definition belongs to this tenant; then repair church_id or move the value to a tenant-local field definition.'
FROM public.person_field_values AS child
JOIN public.field_definitions AS parent
  ON parent.id = child.field_definition_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'notes.person_id->people.id',
  'notes',
  jsonb_build_object('id', child.id, 'person_id', child.person_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review note ownership before changing church_id because notes may contain sensitive pastoral information.'
FROM public.notes AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_events.person_id->people.id',
  'person_events',
  jsonb_build_object('id', child.id, 'person_id', child.person_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review event provenance before repairing immutable person event history.'
FROM public.person_events AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'workflow_cards.person_id->people.id',
  'workflow_cards',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'workflow_id', child.workflow_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Move or recreate the workflow card in the person tenant after reviewing workflow state.'
FROM public.workflow_cards AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'workflow_cards.workflow_id->workflows.id',
  'workflow_cards',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'workflow_id', child.workflow_id),
  child.church_id,
  'workflows',
  child.workflow_id,
  parent.church_id,
  'Move or recreate the workflow card in a tenant-local workflow after reviewing workflow state.'
FROM public.workflow_cards AS child
JOIN public.workflows AS parent
  ON parent.id = child.workflow_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'workflow_cards.current_step_id->workflow_steps.id',
  'workflow_cards',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'current_step_id', child.current_step_id),
  child.church_id,
  'workflow_steps',
  child.current_step_id,
  parent.church_id,
  'Set the card to a tenant-local workflow step or clear current_step_id after review.'
FROM public.workflow_cards AS child
JOIN public.workflow_steps AS parent
  ON parent.id = child.current_step_id
WHERE child.current_step_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'list_people.list_id->lists.id',
  'list_people',
  jsonb_build_object('list_id', child.list_id, 'person_id', child.person_id),
  child.church_id,
  'lists',
  child.list_id,
  parent.church_id,
  'Remove the invalid list membership or recreate it in a tenant-local list.'
FROM public.list_people AS child
JOIN public.lists AS parent
  ON parent.id = child.list_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'list_people.person_id->people.id',
  'list_people',
  jsonb_build_object('list_id', child.list_id, 'person_id', child.person_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Remove the invalid list membership or recreate it for a tenant-local person.'
FROM public.list_people AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'event_registrations.event_id->events.id',
  'event_registrations',
  jsonb_build_object('id', child.id, 'event_id', child.event_id, 'person_id', child.person_id),
  child.church_id,
  'events',
  child.event_id,
  parent.church_id,
  'Review registration ownership before moving it to the event tenant or deleting it.'
FROM public.event_registrations AS child
JOIN public.events AS parent
  ON parent.id = child.event_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'event_registrations.person_id->people.id',
  'event_registrations',
  jsonb_build_object('id', child.id, 'event_id', child.event_id, 'person_id', child.person_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review whether the registration should remain anonymous, link to a tenant-local person, or be moved.'
FROM public.event_registrations AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.person_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'person_user_links.person_id->people.id',
  'person_user_links',
  jsonb_build_object('id', child.id, 'person_id', child.person_id, 'user_id', child.user_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Do not move blindly; revoke and recreate the portal link after verifying the user and person identity.'
FROM public.person_user_links AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'connect_forms.target_tag_id->tags.id',
  'connect_forms',
  jsonb_build_object('id', child.id, 'target_tag_id', child.target_tag_id),
  child.church_id,
  'tags',
  child.target_tag_id,
  parent.church_id,
  'Clear or replace the connect form target tag with a tenant-local tag.'
FROM public.connect_forms AS child
JOIN public.tags AS parent
  ON parent.id = child.target_tag_id
WHERE child.target_tag_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'connect_forms.target_workflow_id->workflows.id',
  'connect_forms',
  jsonb_build_object('id', child.id, 'target_workflow_id', child.target_workflow_id),
  child.church_id,
  'workflows',
  child.target_workflow_id,
  parent.church_id,
  'Clear or replace the connect form target workflow with a tenant-local workflow.'
FROM public.connect_forms AS child
JOIN public.workflows AS parent
  ON parent.id = child.target_workflow_id
WHERE child.target_workflow_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'connect_form_submissions.form_id->connect_forms.id',
  'connect_form_submissions',
  jsonb_build_object('id', child.id, 'form_id', child.form_id, 'person_id', child.person_id),
  child.church_id,
  'connect_forms',
  child.form_id,
  parent.church_id,
  'Review submission provenance before moving it to the form tenant or deleting it.'
FROM public.connect_form_submissions AS child
JOIN public.connect_forms AS parent
  ON parent.id = child.form_id
WHERE child.church_id <> parent.church_id

UNION ALL
SELECT
  'connect_form_submissions.person_id->people.id',
  'connect_form_submissions',
  jsonb_build_object('id', child.id, 'form_id', child.form_id, 'person_id', child.person_id),
  child.church_id,
  'people',
  child.person_id,
  parent.church_id,
  'Review submission identity before linking to a different tenant-local person.'
FROM public.connect_form_submissions AS child
JOIN public.people AS parent
  ON parent.id = child.person_id
WHERE child.person_id IS NOT NULL
  AND child.church_id <> parent.church_id

UNION ALL
SELECT
  'webhook_deliveries.webhook_id->webhooks.id',
  'webhook_deliveries',
  jsonb_build_object('id', child.id, 'webhook_id', child.webhook_id, 'delivery_id', child.delivery_id),
  child.church_id,
  'webhooks',
  child.webhook_id,
  parent.church_id,
  'Do not replay blindly; move delivery metadata only if the webhook tenant is confirmed.'
FROM public.webhook_deliveries AS child
JOIN public.webhooks AS parent
  ON parent.id = child.webhook_id
WHERE child.church_id <> parent.church_id;

COMMENT ON VIEW public.tenant_relationship_integrity_violations IS
  'Service-role-only detail view of tenant-crossing child/parent relationships. Contains IDs only, no person names, emails, note bodies, payloads, or secrets.';

REVOKE ALL ON public.tenant_relationship_integrity_violations FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.tenant_relationship_integrity_violations TO service_role;

CREATE OR REPLACE VIEW public.tenant_relationship_integrity_audit AS
WITH relationship_metadata AS (
  SELECT *
  FROM (
    VALUES
      ('person_tags.person_id->people.id', 'person_tags', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'person_tags_church_person_idx', 'person_tags_church_person_fk', 'Current FK references people(id), so service-role mistakes can cross tenants.', 'Low lock risk at expected scale; add supporting index before NOT VALID FK.'),
      ('person_tags.tag_id->tags.id', 'person_tags', '(church_id, tag_id)', 'tags', '(church_id, id)', 'tags_church_id_id_key', 'person_tags_church_tag_idx', 'person_tags_church_tag_fk', 'Current FK references tags(id), so service-role mistakes can cross tenants.', 'Low lock risk at expected scale; add supporting index before NOT VALID FK.'),
      ('person_field_values.person_id->people.id', 'person_field_values', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'person_field_values_church_person_idx', 'person_field_values_church_person_fk', 'Current FK references people(id), so field values can cross tenants.', 'Low lock risk; existing person_id index is not tenant-leading.'),
      ('person_field_values.field_definition_id->field_definitions.id', 'person_field_values', '(church_id, field_definition_id)', 'field_definitions', '(church_id, id)', 'field_definitions_church_id_id_key', 'person_field_values_church_field_definition_idx', 'person_field_values_church_field_definition_fk', 'Current FK references field_definitions(id), so values can use another tenant field definition.', 'Low lock risk; add tenant-leading child index.'),
      ('notes.person_id->people.id', 'notes', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'notes_church_person_idx', 'notes_church_person_fk', 'Current FK references people(id), so sensitive notes can cross tenants.', 'Prioritize after audit because notes may contain sensitive pastoral context.'),
      ('person_events.person_id->people.id', 'person_events', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'person_events_church_person_idx', 'person_events_church_person_fk', 'Current FK references people(id), so immutable event history can cross tenants.', 'Validate after audit; do not rewrite immutable history automatically.'),
      ('workflow_cards.person_id->people.id', 'workflow_cards', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'workflow_cards_church_person_idx', 'workflow_cards_church_person_fk', 'Current FK references people(id), so cards can attach to another tenant person.', 'Low lock risk; add tenant-leading child index.'),
      ('workflow_cards.workflow_id->workflows.id', 'workflow_cards', '(church_id, workflow_id)', 'workflows', '(church_id, id)', 'workflows_church_id_id_key', 'workflow_cards_church_workflow_idx', 'workflow_cards_church_workflow_fk', 'Current FK references workflows(id), so cards can attach to another tenant workflow.', 'Low lock risk; existing workflow_id index is not tenant-leading.'),
      ('workflow_cards.current_step_id->workflow_steps.id', 'workflow_cards', '(church_id, current_step_id)', 'workflow_steps', '(church_id, id)', 'workflow_steps_church_id_id_key', 'workflow_cards_church_current_step_idx', 'workflow_cards_church_current_step_fk', 'Nullable current step references workflow_steps(id), so cards can point at another tenant step.', 'Use nullable composite FK after adding partial or full tenant-leading index.'),
      ('list_people.list_id->lists.id', 'list_people', '(church_id, list_id)', 'lists', '(church_id, id)', 'lists_church_id_id_key', 'list_people_church_list_idx', 'list_people_church_list_fk', 'Current FK references lists(id), so memberships can cross tenant lists.', 'Low lock risk; static list table is small at target scale.'),
      ('list_people.person_id->people.id', 'list_people', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'list_people_church_person_idx', 'list_people_church_person_fk', 'Current FK references people(id), so memberships can cross tenant people.', 'Low lock risk; static list table is small at target scale.'),
      ('event_registrations.event_id->events.id', 'event_registrations', '(church_id, event_id)', 'events', '(church_id, id)', 'events_church_id_id_key', 'event_registrations_church_event_idx', 'event_registrations_church_event_fk', 'Current FK references events(id), so registrations can attach to another tenant event.', 'Existing church/event indexes reduce validation risk.'),
      ('event_registrations.person_id->people.id', 'event_registrations', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'event_registrations_church_person_idx', 'event_registrations_church_person_fk', 'Nullable person reference can point to another tenant person.', 'Use nullable composite FK after adding tenant-leading child index.'),
      ('person_user_links.person_id->people.id', 'person_user_links', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'person_user_links_church_person_idx', 'person_user_links_church_person_fk', 'Current FK references people(id), so portal links can cross tenants.', 'High security priority; validate after confirming zero violations.'),
      ('connect_forms.target_tag_id->tags.id', 'connect_forms', '(church_id, target_tag_id)', 'tags', '(church_id, id)', 'tags_church_id_id_key', 'connect_forms_church_target_tag_idx', 'connect_forms_church_target_tag_fk', 'Nullable target tag can point to another tenant tag.', 'Use nullable composite FK; table is small.'),
      ('connect_forms.target_workflow_id->workflows.id', 'connect_forms', '(church_id, target_workflow_id)', 'workflows', '(church_id, id)', 'workflows_church_id_id_key', 'connect_forms_church_target_workflow_idx', 'connect_forms_church_target_workflow_fk', 'Nullable target workflow can point to another tenant workflow.', 'Use nullable composite FK; table is small.'),
      ('connect_form_submissions.form_id->connect_forms.id', 'connect_form_submissions', '(church_id, form_id)', 'connect_forms', '(church_id, id)', 'connect_forms_church_id_id_key', 'connect_form_submissions_church_form_idx', 'connect_form_submissions_church_form_fk', 'Current FK references connect_forms(id), so submissions can attach to another tenant form.', 'Add tenant-leading child index before validation.'),
      ('connect_form_submissions.person_id->people.id', 'connect_form_submissions', '(church_id, person_id)', 'people', '(church_id, id)', 'people_church_id_id_key', 'connect_form_submissions_church_person_fk_uses_existing_idx', 'connect_form_submissions_church_person_fk', 'Nullable person reference can point to another tenant person.', 'Existing (church_id, person_id, created_at) index can support validation.'),
      ('webhook_deliveries.webhook_id->webhooks.id', 'webhook_deliveries', '(church_id, webhook_id)', 'webhooks', '(church_id, id)', 'webhooks_church_id_id_key', 'webhook_deliveries_church_webhook_idx', 'webhook_deliveries_church_webhook_fk', 'Current FK references webhooks(id), so deliveries can attach to another tenant endpoint.', 'High integration-security priority; add tenant-leading child index before validation.')
  ) AS metadata(
    relationship_key,
    child_table,
    proposed_child_columns,
    parent_table,
    proposed_parent_columns,
    required_parent_unique_constraint,
    proposed_child_index,
    proposed_composite_fk,
    current_risk,
    validation_lock_notes
  )
),
violation_counts AS (
  SELECT
    relationship_key,
    COUNT(*)::INTEGER AS invalid_row_count
  FROM public.tenant_relationship_integrity_violations
  GROUP BY relationship_key
)
SELECT
  metadata.relationship_key,
  metadata.child_table,
  metadata.proposed_child_columns,
  metadata.parent_table,
  metadata.proposed_parent_columns,
  metadata.required_parent_unique_constraint,
  metadata.proposed_child_index,
  metadata.proposed_composite_fk,
  COALESCE(violation_counts.invalid_row_count, 0) AS invalid_row_count,
  metadata.current_risk,
  metadata.validation_lock_notes
FROM relationship_metadata AS metadata
LEFT JOIN violation_counts
  ON violation_counts.relationship_key = metadata.relationship_key
ORDER BY metadata.relationship_key;

COMMENT ON VIEW public.tenant_relationship_integrity_audit IS
  'Service-role-only summary of tenant-linked relationships that need staged composite tenant foreign keys. invalid_row_count must be zero before validating a corresponding constraint.';

REVOKE ALL ON public.tenant_relationship_integrity_audit FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.tenant_relationship_integrity_audit TO service_role;
