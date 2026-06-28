# SPEC.md — People (HarvestGen Church OS)

## Overview

**People** is the central member relationship management system for Harvest Generation Church. It serves as the single source of truth for all church member data, replacing fragmented data across Shepherd (LMS) and Drip & Brew (Café POS). Every other HarvestGen system connects to People via API keys.

**Mental model:** People is the backbone. Shepherd and Drip & Brew are satellites. They do not own member data — they push events and read profiles via the People API.

**Domain:** `people.harvestgen.org` (Vercel deployment)
**Repo:** `harvestgen-people` (separate repo, not monorepo)

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript strict mode |
| Styling | Tailwind CSS + shadcn/ui | Clean, data-dense admin aesthetic |
| Database | Supabase (Postgres only) | No Supabase Auth — uses custom admin auth |
| ORM | Supabase JS client (`@supabase/supabase-js`) | Server Components use server client |
| Auth | Supabase Auth (Magic Link / OTP) | Admin-only, no public sign-up |
| File Storage | Supabase Storage | Profile photos bucket |
| API | Next.js Route Handlers (`/api/v1/...`) | REST, API-key authenticated |
| Deployment | Vercel | |

---

## Design Language

- **Aesthetic:** Dense, calm, data-first admin. Think Linear meets Notion — not a marketing site.
- **Palette:** Near-white background (`#FAFAFA`), slate sidebar (`#0F172A`), accent teal (`#0D9488`), destructive red (`#DC2626`)
- **Typography:** Inter (body + UI), JetBrains Mono (API keys, IDs, code)
- **Border radius:** 6px across all cards/inputs
- **Motion:** Subtle — only transitions on sidebar collapse and modal open
- **Icons:** `lucide-react`

---

## Database Schema

### Core People

```sql
-- Households (must exist before people for FK)
CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,              -- e.g. "The Tan Family"
  address     TEXT,
  city        TEXT,
  state       TEXT,
  postcode    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- People (the heart of the system)
CREATE TABLE people (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT UNIQUE,
  phone           TEXT,
  gender          TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  birthdate       DATE,
  marital_status  TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  anniversary     DATE,
  photo_url       TEXT,                   -- Supabase Storage URL
  status          TEXT NOT NULL DEFAULT 'visitor'
                  CHECK (status IN ('active', 'visitor', 'inactive', 'child')),
  campus          TEXT DEFAULT 'Bandar Sunway',
  household_id    UUID REFERENCES households(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_people_email ON people(email);
CREATE INDEX idx_people_status ON people(status);
CREATE INDEX idx_people_household ON people(household_id);
```

### Custom Fields

```sql
-- Admin-defined extra fields (e.g. "Cell Group", "Baptism Date", "Ministry Team")
CREATE TABLE field_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,       -- snake_case, used as API key
  field_type  TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  options     JSONB,                       -- for select type: ["Cell A", "Cell B"]
  is_required BOOLEAN DEFAULT FALSE,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE person_field_values (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id             UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  field_definition_id   UUID NOT NULL REFERENCES field_definitions(id) ON DELETE CASCADE,
  value                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (person_id, field_definition_id)
);
```

### Tags

```sql
CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  color       TEXT NOT NULL DEFAULT '#6B7280',   -- hex color for UI badge
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE person_tags (
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  tag_id      UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (person_id, tag_id)
);
```

### Notes

```sql
CREATE TABLE notes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  content         TEXT NOT NULL,
  category        TEXT DEFAULT 'general'
                  CHECK (category IN ('general', 'pastoral', 'prayer', 'follow_up', 'visit')),
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notes_person ON notes(person_id);
```

### Integration Event Log

```sql
-- Immutable log of events pushed by connected systems
CREATE TABLE person_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id     UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  source        TEXT NOT NULL CHECK (source IN ('shepherd', 'drip_brew', 'manual', 'people')),
  event_type    TEXT NOT NULL,
  -- shepherd:  course_enrolled | course_completed | quiz_passed | last_active
  -- drip_brew: order_placed | newcomer_registered | promo_used
  -- manual:    attendance | home_visit | phone_call
  metadata      JSONB DEFAULT '{}',
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_person ON person_events(person_id);
CREATE INDEX idx_events_source ON person_events(source);
CREATE INDEX idx_events_occurred ON person_events(occurred_at DESC);
```

### Workflows (Visitor Follow-up Pipeline)

```sql
CREATE TABLE workflows (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,              -- e.g. "New Visitor Journey"
  description TEXT,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- e.g. "Sent Welcome Message", "Connected to Cell"
  position        INTEGER NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_cards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  workflow_id     UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
  current_step_id UUID REFERENCES workflow_steps(id) ON DELETE SET NULL,
  assigned_to     UUID REFERENCES auth.users(id),
  notes           TEXT,
  due_date        DATE,
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_cards_person ON workflow_cards(person_id);
CREATE INDEX idx_workflow_cards_step ON workflow_cards(current_step_id);
```

### Lists (Smart + Static)

```sql
CREATE TABLE lists (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('smart', 'static')),
  -- smart list filters stored as JSON rule tree:
  -- { "operator": "AND", "rules": [{ "field": "status", "op": "eq", "value": "visitor" }] }
  filters     JSONB,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Static list members only (smart lists are computed at query time)
CREATE TABLE list_people (
  list_id     UUID NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (list_id, person_id)
);
```

### API Keys (Plugin Layer)

```sql
-- API keys issued to connected systems (Shepherd, Drip & Brew, etc.)
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,            -- "Shepherd LMS", "Drip & Brew POS"
  description   TEXT,
  key_hash      TEXT NOT NULL,            -- SHA-256 hash of the raw key
  key_prefix    TEXT NOT NULL,            -- First 12 chars of raw key (for display)
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  -- Available scopes:
  --   people:read       → GET /api/v1/people, GET /api/v1/people/:id
  --   people:write      → POST/PATCH /api/v1/people
  --   people:lookup     → POST /api/v1/people/lookup (find-or-create by email/phone)
  --   events:write      → POST /api/v1/events (push integration events)
  --   events:read       → GET /api/v1/people/:id/events
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,              -- NULL = never expires
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook outbox (People pushes events to connected systems)
CREATE TABLE webhooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  events      TEXT[] NOT NULL,
  -- person.created | person.updated | person.status_changed | event.logged
  secret      TEXT NOT NULL,             -- HMAC-SHA256 signing secret
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id      UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event_type      TEXT NOT NULL,
  payload         JSONB NOT NULL,
  response_status INTEGER,
  error_message   TEXT,
  delivered_at    TIMESTAMPTZ,
  failed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Design (`/api/v1/`)

All endpoints require `Authorization: Bearer <api_key>` header. Scopes are checked per endpoint.

### People Endpoints

| Method | Path | Scope | Description |
|---|---|---|---|
| `GET` | `/api/v1/people` | `people:read` | List people (paginated, filterable) |
| `GET` | `/api/v1/people/:id` | `people:read` | Get single person with all relations |
| `POST` | `/api/v1/people` | `people:write` | Create person |
| `PATCH` | `/api/v1/people/:id` | `people:write` | Update person |
| `POST` | `/api/v1/people/lookup` | `people:lookup` | Find-or-create by email or phone |
| `GET` | `/api/v1/people/:id/events` | `events:read` | Get event log for person |

### Events Endpoint

| Method | Path | Scope | Description |
|---|---|---|---|
| `POST` | `/api/v1/events` | `events:write` | Push an integration event |

### Lookup Payload (critical for integrations)

```json
POST /api/v1/people/lookup
{
  "email": "user@example.com",
  "phone": "+60123456789",
  "first_name": "Wei",
  "last_name": "Lim",
  "source": "drip_brew"
}
```
Returns existing person if email/phone matches, or creates a new `visitor` record.

### Event Payload

```json
POST /api/v1/events
{
  "person_id": "uuid",
  "source": "shepherd",
  "event_type": "course_completed",
  "metadata": {
    "course_id": "uuid",
    "course_name": "Alpha Course Week 3"
  },
  "occurred_at": "2026-06-22T10:00:00Z"
}
```

---

## Application Routes (Admin UI)

```
/                         → Redirect to /people
/login                    → Magic link login
/people                   → People list (table + filters)
/people/new               → Create person form
/people/[id]              → Person profile (overview, notes, events, workflows)
/people/[id]/edit         → Edit person form
/lists                    → Saved lists (smart + static)
/lists/[id]               → List view with member table
/workflows                → All workflow boards
/workflows/[id]           → Kanban board for a single workflow
/settings                 → General settings
/settings/fields          → Custom field definitions CRUD
/settings/tags            → Tag management
/settings/api-keys        → Issue/revoke API keys
/settings/webhooks        → Webhook config
```

---

## File Structure

```
people/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── layout.tsx
│   │   ├── (admin)/
│   │   │   ├── layout.tsx            ← sidebar + topbar shell
│   │   │   ├── page.tsx              ← dashboard (stats: total members, visitors this month, etc.)
│   │   │   ├── people/
│   │   │   │   ├── page.tsx          ← people table
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx      ← profile overview
│   │   │   │       └── edit/page.tsx
│   │   │   ├── lists/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── workflows/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx     ← Kanban board
│   │   │   └── settings/
│   │   │       ├── page.tsx
│   │   │       ├── fields/page.tsx
│   │   │       ├── tags/page.tsx
│   │   │       ├── api-keys/page.tsx
│   │   │       └── webhooks/page.tsx
│   │   └── api/
│   │       └── v1/
│   │           ├── people/
│   │           │   ├── route.ts      ← GET list, POST create
│   │           │   ├── lookup/
│   │           │   │   └── route.ts  ← POST find-or-create
│   │           │   └── [id]/
│   │           │       ├── route.ts  ← GET, PATCH
│   │           │       └── events/
│   │           │           └── route.ts
│   │           └── events/
│   │               └── route.ts      ← POST push event
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── Topbar.tsx
│   │   ├── people/
│   │   │   ├── PersonTable.tsx
│   │   │   ├── PersonForm.tsx
│   │   │   ├── PersonCard.tsx        ← compact summary card
│   │   │   ├── PersonProfile.tsx     ← full profile view
│   │   │   ├── EventTimeline.tsx     ← integration event log
│   │   │   └── NotesList.tsx
│   │   ├── workflows/
│   │   │   ├── KanbanBoard.tsx
│   │   │   └── WorkflowCard.tsx
│   │   └── ui/                       ← shadcn/ui components
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts             ← browser client
│   │   │   └── server.ts             ← server client (cookies)
│   │   ├── api-auth.ts               ← API key validation middleware
│   │   ├── webhooks.ts               ← webhook dispatch helper
│   │   └── types.ts                  ← all TypeScript types
│   └── middleware.ts                 ← protect (admin) routes
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── SPEC.md
├── GEMINI.md
└── AGENTS.md
```

---

## Key Rules & Constraints

1. **No Supabase RLS on the public schema** — all API routes run as service role (server-side only). RLS only protects admin UI routes via Supabase Auth session check in middleware.
2. **API keys are never stored in plaintext** — raw key shown once on creation, then only the SHA-256 hash is stored. Display uses `key_prefix` (first 12 chars).
3. **`person_events` is append-only** — never update or delete event rows. Integrations only `POST` to `/api/v1/events`.
4. **Lookup endpoint is the integration entry point** — connected systems must always call `/lookup` first, never assume a `person_id` exists.
5. **Supabase Storage bucket** `people-photos` — public read, authenticated write.
6. **All monetary/numeric values in metadata** stored as strings to avoid float precision issues.
7. **Timestamps** always `TIMESTAMPTZ`, always UTC. Frontend converts to Malaysia time (UTC+8) for display.
8. **Smart list filters** evaluated at query time via Postgres — no materialised views. Max 5 rules per list to keep queries predictable.