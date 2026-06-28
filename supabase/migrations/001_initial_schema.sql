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
