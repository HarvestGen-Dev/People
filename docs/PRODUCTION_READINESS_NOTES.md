# Production Readiness Notes

<!-- AGENT: ARCHITECT -->

## Connect Forms

Connect-form submissions use `submit_connect_form` as the transactional boundary.
The function resolves the active form, validates configured tenant references,
checks idempotency, consumes the public rate limit for new submissions, resolves
or creates the canonical person, applies safe empty-field fills, records
conflicting populated values in `person_proposed_updates`, applies tags and
workflow cards idempotently, records a person event, and enqueues matching
webhook deliveries.

`Idempotency-Key` is supported on the public submit route. Replaying the same
key for the same form returns the original response without repeating side
effects.

## Proposed Person Updates

`person_proposed_updates` stores reviewable field conflicts from public and
integration sources. Pending proposals are unique by church, person, field,
source, and proposed value. Anonymous and portal users cannot read proposals.
Administrative review is performed through `review_person_proposed_update`,
which only accepts allowlisted person fields and records reviewer metadata.

## Webhook Delivery

Outbound webhook delivery is database-backed and at-least-once. Business writes
enqueue `webhook_deliveries` rows with stable `event_id` and `delivery_id`.
The worker claims due rows with `FOR UPDATE SKIP LOCKED`, marks them
`processing`, sends the request with a strict timeout, and transitions them to
`delivered`, `retry_scheduled`, or `permanently_failed`.

Retryable failures are network errors, timeouts, HTTP 408, HTTP 425, HTTP 429,
and HTTP 5xx. Most other HTTP 4xx responses are permanent. Manual retry is
restricted to `owner` and `admin`, preserves the original event identity, and
mints a new delivery identity for the retry attempt.

Webhook signatures use:

```text
timestamp + "." + raw_request_body
```

Receivers should deduplicate by `X-People-Event-Id` or
`X-People-Delivery-Id`.

## SSRF Restrictions

Webhook destinations are validated at creation and delivery time. Production
requires HTTPS. Embedded credentials, localhost, private IPv4 ranges,
link-local addresses, multicast/unspecified addresses, metadata hostnames,
unsafe IPv6 ranges, and IPv4-mapped local/private IPv6 forms are rejected.
Redirects are not followed automatically.

The current Node `fetch` path revalidates DNS immediately before delivery and
rejects the destination if any returned address is unsafe, but it does not pin
the subsequent HTTP connection to the already-validated IP. Treat DNS rebinding
as a residual risk until the transport can connect to a pinned address while
preserving TLS hostname verification.

## People Photos

New people-photo uploads use the private `people-photos` bucket. The database
stores `people.photo_path` as `{church_id}/{person_id}/{generated_uuid}.webp`;
`people.photo_url` is legacy-only and must not be written by new photo code.
Signed URLs are generated server-side for 10 minutes after authorization and
are never persisted.

Upload limits are 5 MB compressed input, 4096 px maximum width, 4096 px maximum
height, and 16 megapixels. The Node runtime uses `sharp` to decode JPEG, PNG,
or WebP input, normalize orientation, strip metadata by re-encoding, resize to
fit within 1024 px, and store WebP output. Browser MIME type, file extension,
original filename, and client-supplied storage paths are ignored.

Photo access rules:

- Owner, admin, pastoral, staff, and viewer roles may retrieve tenant person
  photos through the server-authorized route.
- Owner and admin may upload, replace, and remove person photos.
- Legacy `member`, workflow manager, anonymous users, and API-key callers do
  not receive broad photo-directory access.
- Portal users may retrieve only their linked person photo. Household photo
  access remains future work until household permissions are explicit.
- Child photos are private, never public, and follow the same portal own-photo
  restriction.

The application signs photos for the currently rendered people page or list
result set rather than exposing arbitrary path signing. API v1 person responses
return `photo_url: null` so integrations do not receive stale public photo
references. Existing API consumers that used `photo_url` must tolerate `null`;
this PR does not add an authorized integration photo endpoint.

Legacy migration is staged. Migration 039 adds the private path column, makes
the `people-photos` bucket private, disables direct client writes to that
bucket, and adds the service-role-only
`people_photo_reference_inventory` view. Existing `photo_url` values are not
rewritten or deleted. The code can sign legacy Supabase `people-photos` public
URLs only when the decoded object path is tenant/person scoped. External legacy
URLs are deliberately not displayed or proxied by the private-photo code because
they cannot be made private through Supabase bucket policy changes.

Deployment checklist:

1. Back up the database.
2. Inventory objects and non-null legacy `people.photo_url` categories.
3. Deploy code that writes `photo_path` and can read scoped legacy references.
4. Verify legacy URL parsing and authorized signing in staging.
5. Apply migration 039 to make the bucket private.
6. Immediately verify old legacy Supabase photos and new private uploads.
7. Verify one admin upload, one replacement, one removal, and one portal
   own-photo retrieval.
8. Query `people_photo_reference_inventory` as `service_role`.
9. Pilot-copy or reprocess legacy objects for one tenant into private
   tenant/person paths.
10. Update copied records to `photo_path` and clear `photo_url` only after
   verification.
11. Migrate remaining tenants.
12. Monitor missing-object and authorization errors.
13. Remove legacy fallback in a later PR after all tenants are verified.

Rollback plan:

- Schema changes are additive; old code can ignore `photo_path`.
- `photo_url` values are preserved during rollout.
- If the deployment must roll back before legacy migration is complete, restore
  the previous code path. Do not delete private objects.
- Reopening public bucket access is an emergency privacy tradeoff and should
  require explicit approval.

## Tenant Composite Foreign Keys

Current status: audit helpers and staged enforcement constraints are present.

Migrations `040` through `044` add service-role-only audit views, parent
`UNIQUE (church_id, id)` keys, child support indexes, and 28 tenant-aware
composite foreign keys. The foreign keys are intentionally `NOT VALID` until
production data is audited and each relationship is validated in a controlled
rollout.

Audit views:

- `tenant_relationship_integrity_audit`
- `tenant_relationship_integrity_violations`
- `tenant_relationship_integrity_complete_audit`
- `tenant_relationship_integrity_complete_violations`

Several tables contain both `church_id` and foreign resource IDs while the
original foreign keys reference only `id`. New inserts and updates are now
rejected when they try to link tenant-owned records across churches, including
service-role writes. Historical rows should be checked with
`tenant_relationship_integrity_complete_audit` before validation.

Recommended rollout:

1. Back up the database.
2. Run `tenant_relationship_integrity_complete_audit` in production with
   `service_role`.
3. Confirm zero violations for the relationship group being validated.
4. Validate the corresponding `NOT VALID` constraints.
5. Repair or explicitly accept invalid historical rows before validating any
   relationship with nonzero counts.
6. Monitor FK errors from service-role writes after validation.

Do not delete or rewrite production rows automatically.

## Cron

The webhook worker cron route is `POST` only, fails closed when its secret is
missing, limits batch size, and returns a structured summary.

### Missing-Person Pulse Audit

The implementation before migrations `045` through `047` behaved as follows.
The final column describes the replacement now in use.

| Area | Previous behavior | Risk | Replacement |
| --- | --- | --- | --- |
| Authentication | Exact string comparison against `CRON_SECRET` | Comparison was not timing-safe | Fail closed and compare the bearer value with `timingSafeEqual` |
| Locking | Session lock and unlock through separate RPC requests | PostgREST pooling could unlock a different session | Per-configuration `pg_try_advisory_xact_lock` inside the mutation RPC |
| Configuration selection | One query for all active configurations | Invalid scopes were silently skipped or could interrupt work | Validate and record each configuration independently |
| Person eligibility | Exact configured status | Invalid status and threshold were not validated | Exact status with checked supported values and positive elapsed days |
| Activity calculation | Any recent `person_events` row | Comment incorrectly implied attendance-only behavior | Explicitly retain and document any-event behavior |
| Workflow-step selection | Ordered by nonexistent `order_index` | Step lookup failed and card creation was silently skipped | Order by `position`, then `id` |
| Existing-card detection | Counted all historical cards | Completed cards permanently blocked re-entry | Any active card in the workflow suppresses; completed cards permit re-entry |
| Card insertion | One count and one insert per matched person | N+1 calls and race-created duplicates | One `INSERT ... SELECT` per configuration plus a partial unique index |
| Error handling | Several Supabase errors ignored; raw exceptions returned | False counters and internal detail disclosure | Scoped rollback, sanitized history, generic HTTP errors, server-side detail |
| Tenant isolation | Route filters were present but not transactional | Service-role bugs could cross tenants | Explicit predicates plus tenant composite foreign keys |
| Execution history | None | Empty, failed, and abandoned runs were not distinguishable | Aggregate and per-configuration durable run records |
| Database-call count | Up to two requests per matched person | 500 matches required 1,006 Supabase calls | One route-level PostgREST RPC regardless of people count |

Previous route-level Supabase request counts included lock release: three calls
with no active configurations, four for one configuration with no candidate
people, five for one configuration with candidates but no matches, and 1,006
for one configuration with 500 matched people. The new route makes exactly one
RPC request. The function performs bounded work per configuration and never
loads person IDs into Next.js memory.

The local performance harness at
`tests/performance/missing-persons-pulse.sql` uses five churches, 500 people per
church, recent and old events, no-history people, active manual cards, and
completed pulse cards. A representative run scanned 2,500 people, matched
2,000, created 1,875 cards, and skipped 125 active cards in 72.3 ms. An
immediate repeat created no cards in 3.1 ms. `EXPLAIN (ANALYZE, BUFFERS)` for
one 500-person eligibility/anti-join scope completed in 0.385 ms with 21 shared
buffer hits. These are local development measurements, not production latency
guarantees. The plan used the existing people/event indexes; only the partial
active-workflow-card index was added.

### Eligibility Semantics

- A configuration targets exactly one of `active`, `visitor`, `inactive`, or
  `child`. Other statuses are not implicitly included. There is no separate
  archived column.
- Visitors, children, and inactive people are eligible only when that exact
  status is configured.
- A person with no event history is inactive for pulse purposes.
- Every `person_events` type and source counts as activity. The schema does not
  provide a reliable narrower attendance classification, so this preserves the
  established behavior.
- The threshold is elapsed 24-hour periods using `TIMESTAMPTZ`, independent of
  tenant calendar timezone. An event exactly at the UTC cutoff is recent and
  excludes the person; only no event or a latest event strictly before it
  matches.
- Any active card (`completed_at IS NULL`) for the same church, person, and
  workflow suppresses card creation, including manually or otherwise generated
  cards. A completed card permits later re-entry.
- The existing unique `(church_id, workflow_id)` rule allows one pulse
  configuration per workflow. Different workflows/configurations act
  independently for the same person.

### Transaction and Provenance Model

`run_missing_persons_pulse` is the only mutation boundary used by the route.
It is `SECURITY DEFINER`, has an empty `search_path`, and is executable only by
`service_role`. Active configurations are processed in deterministic tenant/ID
order. Each configuration uses a transaction-scoped advisory lock derived from
its configuration ID and a PL/pgSQL exception block as a subtransaction. One
failed configuration rolls back its cards but does not roll back successful
work for another tenant or configuration. All locks release automatically when
the RPC transaction commits or rolls back.

Pulse cards have the minimum provenance needed for operations:
`source = 'missing_persons_pulse'`, `pulse_config_id`, `pulse_run_id`, and
`triggered_at`. Existing cards are marked `source = 'existing'`; they are not
guessed to be manual, tag, event, or connect-form cards. The partial unique
index `workflow_cards_active_pulse_config_person_key` enforces at most one
active pulse card per tenant, configuration, and person. The broader active-card
anti-join still suppresses a new pulse card when an active non-pulse card is in
the same workflow.

Before migration `046`, query both service-role-only audit views:

```sql
select * from public.missing_persons_pulse_existing_active_card_audit;
select * from public.missing_persons_pulse_active_duplicate_audit;
```

Do not delete or complete rows solely because either audit reports them. A
workflow owner must confirm the intended active card first.

### Run History and Response

`missing_persons_pulse_runs` stores invocation-level state and is service-role
only because global runs may summarize multiple tenants.
`missing_persons_pulse_run_configs` stores tenant-scoped outcomes; service role
writes it, while authenticated owners/admins may read only their church rows.
Anonymous, portal, viewer, and other ordinary authenticated access is denied.
Neither table stores person identity or pastoral data. Metadata is limited to
8 KiB and sanitized messages to 256 characters.

Statuses are `running`, `completed`, `completed_with_errors`, `failed`, and
`skipped_locked`. A stale `running` row is identifiable with:

```sql
select run_id, started_at
from public.missing_persons_pulse_runs
where status = 'running'
  and started_at < now() - interval '30 minutes'
order by started_at;
```

A recent tenant-scoped operational query is:

```sql
select run_id, pulse_config_id, status, cards_created,
       sanitized_error_code, started_at, finished_at
from public.missing_persons_pulse_run_configs
where church_id = :church_id
order by started_at desc
limit 50;
```

The route accepts authenticated `GET` for Vercel Cron and authenticated `POST`
for controlled manual execution. Both methods require `Authorization: Bearer
<CRON_SECRET>` and use the same private handler. Vercel invokes `GET` daily
through `vercel.json`. An optional valid UUID in `X-Cron-Run-Id` makes scheduler
retries return the existing run result.
Reusing a run ID with a different tenant scope is rejected with the sanitized
`run_id_scope_conflict` code; the original run and its cards remain unchanged.
Success, partial success, and lock skips return HTTP 200. A lock-only response
uses `status: "skipped_locked"` and `reason: "already_running"`. An all-scope
failure or RPC failure returns HTTP 500 with a generic error code. Raw SQL,
constraint names, stack traces, secrets, storage paths, and person data are
never returned.

### Troubleshooting

- **Cron authorization failed:** confirm `CRON_SECRET` exists in the target
  Vercel environment and that the scheduler sends its bearer value. Rotate the
  secret if log access or request headers may have exposed it.
- **Cron was skipped as already running:** inspect the matching configuration
  history. A single skip is retry-safe. Repeated skips with no long-running RPC
  require checking database sessions and scheduler overlap.
- **No cards were created:** confirm active configurations, exact target
  statuses, workflow steps ordered by `position`, recent person events, and
  existing active workflow cards. Compare `people_scanned`, `people_matched`,
  and `cards_skipped`.
- **Unexpected cards were created:** inspect card `pulse_config_id`,
  `pulse_run_id`, and `triggered_at`, then verify the event cutoff. Do not
  mass-complete or delete generated cards.
- **One configuration failed:** inspect its sanitized history code. Repair the
  workflow/configuration relationship or add its first step, then retry with a
  new run ID.
- **Duplicate pulse card suspected:** run both duplicate audits and confirm
  `completed_at` values. Preserve evidence and reconcile only with the workflow
  owner.
- **Job remains in running state:** confirm no database transaction is still
  active. Transaction locks do not survive rollback or disconnect. Marking
  history is an operator action; do not infer card rollback from a stale row.

### Deployment Sequence

1. Back up the database.
2. Apply migration `045` to add duplicate audits, provenance, history, and
   support indexes.
3. Run both duplicate-card audits with `service_role`.
4. Reconcile only confirmed duplicate active cards with workflow owners.
5. Apply migration `046` to add the active pulse-card uniqueness invariant.
6. Apply migration `047` to install the transactional RPC and grants.
7. Deploy the updated route.
8. Confirm `CRON_SECRET` in staging.
9. Trigger one staging run with a recorded `X-Cron-Run-Id`.
10. Verify aggregate/config history, provenance, and card counts.
11. Trigger the same run ID and confirm the same result is returned.
12. Trigger a new run and confirm active cards are skipped.
13. Send concurrent requests and confirm at most one active pulse card.
14. Enable the scheduler and monitor initial staging runs.
15. Repeat migrations, route deployment, and checks in production.
16. Monitor failed, partial, skipped, and stale-running history during rollout.

### Rollback

Disable the scheduler first. The previous route must not be restored while its
session-level lock can overlap the transactional route; allow the current RPC
to finish, then deploy the prior route only if required. Preserve both history
tables and all provenance columns.

If the uniqueness rule blocks a legitimate emergency workflow operation, drop
only `workflow_cards_active_pulse_config_person_key` after approval and keep the
scheduler disabled. Do not mass-delete pulse-generated cards: operators can
identify a run precisely by `pulse_run_id`, but generated cards may contain
completed or in-progress pastoral work. During any route rollback, retain a
single scheduler invocation and query active cards before retrying so the old
N+1 path does not create duplicates.

Identify a run without exposing person details using:

```sql
select church_id, pulse_config_id, count(*) as cards
from public.workflow_cards
where pulse_run_id = :run_id
group by church_id, pulse_config_id;
```

## Automated Browser Journeys

The local Playwright suite now automates the release-critical browser paths
against migrations through `047`: paid public event registration and approval,
free registration capacity and closed states, public connect-form submission
with idempotent replay, person creation/editing, workflow movement/completion,
developer-tool authorization, representative read-only and workflow-manager
roles, portal/anonymous routing, cross-tenant URL and card-ID tampering, and the
high-risk dashboard, developer, team, list, people, workflow, and registration
Server Component queries. Public registration runs on desktop Chromium, Mobile
Chrome emulation, and a 768x1024 tablet viewport.

Before release, run `npm run verify` and inspect uploaded Playwright traces for
any CI failure. See `docs/E2E_TESTING.md` for setup, safety, cleanup, selectors,
and diagnostics.

The following remain manual or follow-up browser work: paid-proof preview dialog
focus restoration, authorized signed people-photo upload/rendering, invitation
acceptance through emailed links, connect-form proposed-update review (no admin
UI currently exposes proposals), and per-run pulse drill-down beyond the bounded
operational summary. Existing integration tests continue to cover the underlying
transactional and security behavior for these areas.

## Operational Observability

Migration `048` and `/developer/operations` add tenant-scoped registration,
email, webhook, and pulse health for owners/admins. Technical failures that were
previously log-only use a bounded PII-free incident ledger; existing durable
webhook and pulse state remains the source of truth. The browser calls no
service-role function directly. Independent summary failures render as
Unavailable rather than healthy.

Health thresholds, structured event names, Vercel alert recommendations,
operator runbooks, backup verification, restoration drills, deployment,
rollback, and database-outage limitations are maintained in
`docs/OPERATIONAL_OBSERVABILITY.md`. The active release gate is now the first
section of `TodoList.md`; migration-017 evidence remains below it as historical
material.
