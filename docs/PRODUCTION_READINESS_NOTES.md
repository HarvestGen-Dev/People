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

Current status: not production-complete.

The historical schema stores `people.photo_url`, and the admin upload route
still writes a permanent public URL returned by `getPublicUrl`. Migration 012
also leaves the `people-photos` bucket public. This does not meet the target
model for private people photos.

Required next phase:

- inventory existing `people.photo_url` values and storage objects;
- make `people-photos` private after migration planning;
- store tenant/person-scoped object paths, not permanent URLs;
- add an image processing dependency or service that verifies signatures,
  decodes, enforces dimensions, strips EXIF, and re-encodes;
- generate short-lived signed URLs only after tenant and portal authorization;
- update list/profile rendering to avoid arbitrary path signing and N+1 URL
  generation.

## Tenant Composite Foreign Keys

Current status: audit required before constraints.

Several tables contain both `church_id` and foreign resource IDs while the
original foreign keys reference only `id`. The important candidates are
`person_tags`, `person_field_values`, `notes`, `person_events`,
`workflow_cards`, `list_people`, `event_registrations`, connect-form target
tag/workflow references, `webhook_deliveries`, and `person_user_links`.

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
