# Tenant Composite Foreign-Key Audit And Enforcement

<!-- AGENT: ARCHITECT -->

## Purpose

Tenant isolation cannot depend only on application code remembering to add:

```ts
.eq('church_id', churchId)
```

The server often uses the Supabase service role for trusted workflows, and the
service role bypasses RLS. Tenant-aware composite foreign keys make PostgreSQL
reject cross-tenant relationships even when a service-role write contains the
wrong `church_id` or resource ID.

Migrations `040` through `044` implement a staged rollout:

- `040_tenant_fk_audit_helpers.sql` adds service-role-only audit views for the
  first high-risk tenant relationships.
- `041_people_relationship_tenant_fks.sql` adds parent composite keys,
  supporting indexes, and `NOT VALID` people relationship FKs.
- `042_workflow_and_list_tenant_fks.sql` adds workflow and list relationship
  parent keys, indexes, and `NOT VALID` FKs.
- `043_event_connect_portal_integration_tenant_fks.sql` adds event,
  connect-form, portal-link, and webhook-delivery parent keys, indexes, and
  `NOT VALID` FKs.
- `044_complete_tenant_fk_audit_inventory.sql` extends the audit views so the
  service-role audit inventory covers every currently enforced relationship.

The constraints are `NOT VALID` by design. They reject new invalid inserts and
updates immediately, while allowing production teams to audit historical rows
before running `VALIDATE CONSTRAINT`.

## Audit Views

Run as `service_role`:

```sql
SELECT *
FROM public.tenant_relationship_integrity_complete_audit
ORDER BY relationship_key;
```

For repair planning, inspect ID-only detail rows:

```sql
SELECT *
FROM public.tenant_relationship_integrity_complete_violations
ORDER BY relationship_key, child_table;
```

The original migration `040` views remain available:

- `tenant_relationship_integrity_audit`
- `tenant_relationship_integrity_violations`

The complete views added by migration `044` are preferred for operational
checks. All audit views revoke access from `PUBLIC`, `anon`, and ordinary
`authenticated` users, and grant `SELECT` only to `service_role`. They expose
IDs, relationship metadata, tenant IDs, and repair hints. They do not expose
note bodies, webhook payloads, secrets, names, emails, or other person PII.

## Current Local Result

After a fresh local rebuild through migration `044`, all audited relationships
returned `invalid_row_count = 0`.

## Relationship Matrix

| Child table | Child columns | Parent table | Previous FK | Cross-tenant possible before this PR | Current local violations | Proposed invariant | Supporting index | Migration risk |
| --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| `people` | `(church_id, household_id)` | `households` | `household_id -> households.id` | Yes | 0 | Person household must be in same church. | `people_church_household_idx` | Nullable; old delete action preserved with `SET NULL (household_id)`. |
| `person_tags` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Tag assignment person must be in same church. | `person_tags_church_person_idx` | Low; join row cascades with person. |
| `person_tags` | `(church_id, tag_id)` | `tags` | `tag_id -> tags.id` | Yes | 0 | Tag assignment tag must be in same church. | `person_tags_church_tag_idx` | Low; join row cascades with tag. |
| `person_field_values` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Custom field value person must be in same church. | `person_field_values_church_person_idx` | Medium; historical data can contain user-entered values. |
| `person_field_values` | `(church_id, field_definition_id)` | `field_definitions` | `field_definition_id -> field_definitions.id` | Yes | 0 | Custom field definition must be in same church. | `person_field_values_church_field_definition_idx` | Medium; validate after audit. |
| `notes` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Note person must be in same church. | `notes_church_person_idx` | Medium; notes may contain sensitive pastoral data. |
| `person_events` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Person event must reference same-church person. | `person_events_church_person_idx` | Medium; append-only history. |
| `person_claim_requests` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Claim request person must be in same church. | `person_claim_requests_church_person_idx` | Medium; identity-sensitive portal flow. |
| `person_proposed_updates` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Proposed update person must be in same church. | `person_proposed_updates_church_person_idx` | Low; review queue data. |
| `person_roles` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Role assignment person must be in same church. | Existing unique `(church_id, person_id, role_id)` | Low; existing unique index covers prefix. |
| `person_roles` | `(church_id, role_id)` | `roles` | `role_id -> roles.id` | Yes | 0 | Assigned role must be in same church. | `person_roles_church_role_idx` | Low. |
| `workflow_steps` | `(church_id, workflow_id)` | `workflows` | `workflow_id -> workflows.id` | Yes | 0 | Step workflow must be in same church. | `workflow_steps_church_workflow_idx` | Low; steps cascade with workflow. |
| `workflow_pulse_configs` | `(church_id, workflow_id)` | `workflows` | `workflow_id -> workflows.id` | Yes | 0 | Pulse config workflow must be in same church. | Existing unique `(church_id, workflow_id)` | Low. |
| `tags` | `(church_id, target_workflow_id)` | `workflows` | `target_workflow_id -> workflows.id` | Yes | 0 | Tag workflow target must be in same church. | `tags_church_target_workflow_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `events` | `(church_id, target_workflow_id)` | `workflows` | `target_workflow_id -> workflows.id` | Yes | 0 | Event workflow target must be in same church. | `events_church_target_workflow_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `workflow_cards` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Card person must be in same church. | `workflow_cards_church_person_idx` | Medium; active workflow state. |
| `workflow_cards` | `(church_id, workflow_id)` | `workflows` | `workflow_id -> workflows.id` | Yes | 0 | Card workflow must be in same church. | `workflow_cards_church_workflow_idx` | Medium; active workflow state. |
| `workflow_cards` | `(church_id, current_step_id)` | `workflow_steps` | `current_step_id -> workflow_steps.id` | Yes | 0 | Card current step must be in same church. | `workflow_cards_church_current_step_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `list_people` | `(church_id, list_id)` | `lists` | `list_id -> lists.id` | Yes | 0 | List membership list must be in same church. | `list_people_church_list_idx` | Low; join row cascades. |
| `list_people` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | List membership person must be in same church. | `list_people_church_person_idx` | Low; join row cascades. |
| `event_registrations` | `(church_id, event_id)` | `events` | `event_id -> events.id` | Yes | 0 | Registration event must be in same church. | Existing `idx_event_registrations_church_event_created_at` | Medium; externally submitted records. |
| `event_registrations` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Linked registration person must be in same church. | `event_registrations_church_person_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `person_user_links` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Portal link person must be in same church. | `person_user_links_church_person_idx` | High sensitivity; do not repair blindly. |
| `connect_forms` | `(church_id, target_tag_id)` | `tags` | `target_tag_id -> tags.id` | Yes | 0 | Form target tag must be in same church. | `connect_forms_church_target_tag_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `connect_forms` | `(church_id, target_workflow_id)` | `workflows` | `target_workflow_id -> workflows.id` | Yes | 0 | Form target workflow must be in same church. | `connect_forms_church_target_workflow_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `connect_form_submissions` | `(church_id, form_id)` | `connect_forms` | `form_id -> connect_forms.id` | Yes | 0 | Submission form must be in same church. | `connect_form_submissions_church_form_idx` | Medium; public idempotent submissions. |
| `connect_form_submissions` | `(church_id, person_id)` | `people` | `person_id -> people.id` | Yes | 0 | Submission person must be in same church. | `connect_form_submissions_church_person_idx` | Nullable; old delete action preserved with `SET NULL`. |
| `webhook_deliveries` | `(church_id, webhook_id)` | `webhooks` | `webhook_id -> webhooks.id` | Yes | 0 | Delivery webhook must be in same church. | `webhook_deliveries_church_webhook_idx` | Medium; delivery history cascades with webhook per existing semantics. |

## Parent Composite Keys

The composite unique constraints below exist primarily to support same-tenant
foreign keys. `id` remains globally unique, so these constraints do not change
valid application behavior:

- `households_church_id_id_key`
- `people_church_id_id_key`
- `tags_church_id_id_key`
- `field_definitions_church_id_id_key`
- `roles_church_id_id_key`
- `workflows_church_id_id_key`
- `workflow_steps_church_id_id_key`
- `lists_church_id_id_key`
- `events_church_id_id_key`
- `connect_forms_church_id_id_key`
- `webhooks_church_id_id_key`

## Constraint Validation State

All 28 composite foreign keys are currently `NOT VALID`. This is intentional:

- New and updated rows are enforced immediately by PostgreSQL, including
  service-role writes.
- Historical rows remain queryable until production audit confirms that each
  relationship has zero violations.
- Validation can be performed relationship-by-relationship or migration
  group-by-migration group after audit.

Validate only after the complete audit returns zero violations:

```sql
ALTER TABLE public.person_tags
  VALIDATE CONSTRAINT person_tags_church_person_fk;
```

Repeat per constraint during a controlled rollout.

## RLS Review Notes

Composite foreign keys do not replace RLS. The touched tables still use
membership helpers such as `is_church_member(church_id)` and
`can_manage_church(church_id)`, and service-layer code should keep explicit
tenant filters.

During local catalog review, two older policies are broad at the role level
(`roles = {public}`) but gated by membership/admin expressions:

- `connect_forms`: public active-form read remains intentional for published
  public forms; administrative policies still gate by membership role.
- `workflow_pulse_configs`: admin-only expression remains in the policy body.

No RLS broadening is introduced by this tenant-FK rollout.

## Deployment Plan

1. Back up the database.
2. Apply migration `040` if it is not already present.
3. Query `tenant_relationship_integrity_complete_audit` with `service_role`.
4. Confirm zero violations for the first group before applying validation.
5. Apply migrations `041` through `044`.
6. Monitor application logs for FK errors from service-role writes.
7. Validate low-risk constraints first, then workflow/event/portal constraints.
8. Do not validate a relationship while audit rows remain.
9. Repeat audit after validation.

## Rollback Plan

The migrations are additive. If a new constraint blocks an unexpected write:

1. Keep the audit views in place.
2. Drop only the specific unvalidated composite FK that is blocking the write.
3. Keep the parent composite unique constraint and supporting index unless they
   create a demonstrated issue.
4. Repair the service-layer bug or data issue.
5. Re-add the FK as `NOT VALID`.

Dropping a constraint does not repair invalid data. If audit rows exist, treat
them as production data incidents and resolve them through controlled
relationship-specific repair scripts, not blanket updates.

## Repair Rule

Do not automatically rewrite production rows. Every violation should be
reviewed by relationship type. Notes, portal links, registrations, claim
requests, proposed updates, and webhook deliveries are sensitive because a
simple `church_id` update can move private or externally visible data into the
wrong tenant context.
