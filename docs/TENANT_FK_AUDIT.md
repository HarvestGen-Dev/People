# Tenant Composite Foreign-Key Audit

<!-- AGENT: ARCHITECT -->

## Purpose

Tenant isolation should not depend only on application code remembering to add:

```ts
.eq('church_id', churchId)
```

Migration `040_tenant_fk_audit_helpers.sql` adds audit-only database views that
find cross-tenant child/parent relationships before composite foreign keys are
introduced. It does not add constraints, rewrite data, or delete data.

## Audit Views

Run as `service_role`:

```sql
SELECT *
FROM public.tenant_relationship_integrity_audit
ORDER BY relationship_key;
```

For repair planning, inspect ID-only detail rows:

```sql
SELECT *
FROM public.tenant_relationship_integrity_violations
ORDER BY relationship_key;
```

Both views are unavailable to `anon` and ordinary `authenticated` users. They
contain IDs and repair hints only. They do not expose note bodies, webhook
payloads, secrets, names, emails, or other person PII.

## Initial Local Result

After applying migration `040` locally, all audited relationships returned
`invalid_row_count = 0` in the current local dataset.

## Relationships Audited

| Relationship | Current risk | Proposed parent key | Proposed composite FK |
| --- | --- | --- | --- |
| `person_tags.person_id -> people.id` | Tag assignment can point to a person from another tenant. | `people (church_id, id)` | `person_tags (church_id, person_id)` |
| `person_tags.tag_id -> tags.id` | Tag assignment can use a tag from another tenant. | `tags (church_id, id)` | `person_tags (church_id, tag_id)` |
| `person_field_values.person_id -> people.id` | Field value can point to a person from another tenant. | `people (church_id, id)` | `person_field_values (church_id, person_id)` |
| `person_field_values.field_definition_id -> field_definitions.id` | Field value can use another tenant's custom field definition. | `field_definitions (church_id, id)` | `person_field_values (church_id, field_definition_id)` |
| `notes.person_id -> people.id` | Sensitive notes can attach to another tenant's person. | `people (church_id, id)` | `notes (church_id, person_id)` |
| `person_events.person_id -> people.id` | Immutable event history can attach to another tenant's person. | `people (church_id, id)` | `person_events (church_id, person_id)` |
| `workflow_cards.person_id -> people.id` | Workflow card can attach to another tenant's person. | `people (church_id, id)` | `workflow_cards (church_id, person_id)` |
| `workflow_cards.workflow_id -> workflows.id` | Workflow card can use another tenant's workflow. | `workflows (church_id, id)` | `workflow_cards (church_id, workflow_id)` |
| `workflow_cards.current_step_id -> workflow_steps.id` | Workflow card can point at another tenant's step. | `workflow_steps (church_id, id)` | `workflow_cards (church_id, current_step_id)` |
| `list_people.list_id -> lists.id` | Static membership can attach to another tenant's list. | `lists (church_id, id)` | `list_people (church_id, list_id)` |
| `list_people.person_id -> people.id` | Static membership can attach to another tenant's person. | `people (church_id, id)` | `list_people (church_id, person_id)` |
| `event_registrations.event_id -> events.id` | Registration can attach to another tenant's event. | `events (church_id, id)` | `event_registrations (church_id, event_id)` |
| `event_registrations.person_id -> people.id` | Registration can attach to another tenant's person. | `people (church_id, id)` | `event_registrations (church_id, person_id)` |
| `person_user_links.person_id -> people.id` | Portal account can link to a person from another tenant. | `people (church_id, id)` | `person_user_links (church_id, person_id)` |
| `connect_forms.target_tag_id -> tags.id` | Public form can apply another tenant's tag. | `tags (church_id, id)` | `connect_forms (church_id, target_tag_id)` |
| `connect_forms.target_workflow_id -> workflows.id` | Public form can create cards in another tenant's workflow. | `workflows (church_id, id)` | `connect_forms (church_id, target_workflow_id)` |
| `connect_form_submissions.form_id -> connect_forms.id` | Submission can attach to another tenant's form. | `connect_forms (church_id, id)` | `connect_form_submissions (church_id, form_id)` |
| `connect_form_submissions.person_id -> people.id` | Submission can attach to another tenant's person. | `people (church_id, id)` | `connect_form_submissions (church_id, person_id)` |
| `webhook_deliveries.webhook_id -> webhooks.id` | Delivery can attach to another tenant's webhook endpoint. | `webhooks (church_id, id)` | `webhook_deliveries (church_id, webhook_id)` |

## Enforcement Rollout

Do not add every constraint in one migration. Use small groups:

1. `041_people_relationship_tenant_fks.sql`
   - `person_tags`
   - `person_field_values`
   - `notes`
   - `person_events`
2. `042_workflow_and_list_tenant_fks.sql`
   - `workflow_cards`
   - `list_people`
3. `043_event_portal_and_integration_tenant_fks.sql`
   - `event_registrations`
   - `person_user_links`
   - `connect_forms`
   - `connect_form_submissions`
   - `webhook_deliveries`

For each group:

1. Confirm every relevant `invalid_row_count` is zero in staging.
2. Add parent `UNIQUE (church_id, id)` constraints where missing.
3. Add tenant-leading child indexes.
4. Add composite foreign keys as `NOT VALID`.
5. Validate constraints after data audit.
6. Add service-role tests proving cross-tenant inserts are rejected.

At the intended scale of about 500 people per congregation, normal transactional
index creation is acceptable. Avoid `CREATE INDEX CONCURRENTLY` inside Supabase
migrations unless the migration execution method is explicitly adjusted to run
outside a transaction.

## Repair Rule

Do not automatically rewrite production rows. Every violation should be
reviewed by relationship type. Notes, portal links, registrations, and webhook
deliveries are especially sensitive because a simple `church_id` update can
move private or externally visible data into the wrong tenant context.
