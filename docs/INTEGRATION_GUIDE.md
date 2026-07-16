# People API — Integration Guide

Base URL: https://people.harvestgen.org/api/v1
Auth: Authorization: Bearer <api_key>

<!-- AGENT: BACKEND -->
## Administrator onboarding

People accounts are invitation-only. A signed-in church owner or administrator
can create a single-use invitation that expires after seven days:

```bash
curl -X POST https://people.harvestgen.org/api/admin/invitations \
  -H "Content-Type: application/json" \
  -H "Cookie: <authenticated-session-cookie>" \
  -d '{
    "email": "admin@example.com",
    "role": "member",
    "expires_in_days": 7
  }'
```

The response contains `invite_url`. It is the only response that exposes the
raw invitation token; the database stores only its SHA-256 hash. Only church
owners can issue invitations with the `admin` role. Include `church_id` when
the current user administers more than one church.

## Quick Start

### Step 1: Get an API key
Go to People → Settings → API Keys and create a key with the scopes you need.

### Step 2: Identify your user
Always call `/people/lookup` first to get a `person_id`:

```bash
curl -X POST https://people.harvestgen.org/api/v1/people/lookup \
  -H "Authorization: Bearer people_k1_your_key" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "source": "shepherd"}'
```

### Lookup behavior

<!-- AGENT: INTEGRATION -->

- Emails are trimmed and matched case-insensitively.
- Malaysian local phones such as `012-345 6789` match their `+60` form.
- A new unmatched identity creates a person with `visitor` status.
- Concurrent requests for the same identity return one person.
- HTTP `409` with `code: "identity_conflict"` means either multiple people
  share the supplied phone or the email and phone match different people.
  Do not choose a record automatically; send the case for manual resolution.

### Step 3: Push an event
```bash
curl -X POST https://people.harvestgen.org/api/v1/events \
  -H "Authorization: Bearer people_k1_your_key" \
  -H "Content-Type: application/json" \
  -d '{
    "person_id": "uuid-from-step-2",
    "source": "shepherd",
    "event_type": "course_completed",
    "metadata": { "course_name": "Alpha Week 1" }
  }'
```

## Event registration semantics

Public event registrations count the primary registrant automatically. The
`additional_guest_count` field is the number of guests in addition to the
registrant, so claimed capacity is `1 + additional_guest_count`. The legacy
`guests` field remains accepted for compatibility and has the same
additional-guest meaning. Multiple family members may register for the same
event using the same email address when their attendee names differ.

## Webhook delivery contract

People treats business-critical outbound webhooks as at-least-once delivery.
Receivers must handle duplicate delivery and deduplicate with the stable IDs in
the request headers:

```text
X-People-Event
X-People-Event-Id
X-People-Delivery-Id
X-People-Timestamp
X-People-Signature
```

The signature is HMAC-SHA256 over:

```text
timestamp + "." + raw_request_body
```

Only HTTP 2xx responses are recorded as delivered. HTTP 429 and 5xx responses
are retryable; most other 4xx responses are treated as permanent failures.
Webhook endpoints must not target localhost, private networks, link-local
addresses, or metadata services.

## Shepherd Integration

Scopes needed: `people:lookup`, `events:write`

Events to push:
- `course_enrolled` when a member enrolls in a course
- `course_completed` when a member finishes a course
- `quiz_passed` when a member passes a quiz
- `last_active` periodically to track engagement (weekly cron job)

## Drip & Brew Integration

Scopes needed: `people:lookup`, `events:write`

Events to push:
- `newcomer_registered` when someone fills in the newcomer form at the café
- `order_placed` when an order is completed (include order_id, amount in metadata)
- `promo_used` when a newcomer promo is redeemed
