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

Current status: audit helpers added; enforcement constraints still pending.

Migration `040` exposes service-role-only audit views:

- `tenant_relationship_integrity_audit`
- `tenant_relationship_integrity_violations`

Several tables contain both `church_id` and foreign resource IDs while the
original foreign keys reference only `id`. The audited candidates are
`person_tags`, `person_field_values`, `notes`, `person_events`,
`workflow_cards`, `list_people`, `event_registrations`, `person_user_links`,
connect-form tag/workflow/submission references, and `webhook_deliveries`.

Recommended rollout:

1. Run cross-tenant violation queries in production.
2. Add parent `UNIQUE (church_id, id)` constraints where missing.
3. Add supporting child indexes.
4. Add composite foreign keys as `NOT VALID`.
5. Repair or explicitly accept invalid historical rows.
6. Validate constraints during a controlled maintenance window.

Do not delete or rewrite production rows automatically.

## Cron

The webhook worker cron route is `POST` only, fails closed when its secret is
missing, limits batch size, and returns a structured summary. The missing-persons
pulse cron route already uses a secret and advisory lock but still has a known
N+1 workflow-card insertion path and returns raw exception messages on failure.
Add focused cron integration tests before broadening its behavior.
