# People API — Integration Guide

Base URL: https://people.harvestgen.org/api/v1
Auth: Authorization: Bearer <api_key>

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
