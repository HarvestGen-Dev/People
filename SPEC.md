# SPEC.md — People (HarvestGen Church OS / Multi-Tenant SaaS)

## Overview

**People** is a multi-tenant Church Relationship Management (CRM) SaaS. It serves as the central source of truth for all church member data across multiple churches. Systems like Shepherd (LMS) and Drip & Brew (Café POS) act as satellite integrations that push events and read profiles via the API.

**Mental model:** People is a multi-tenant backbone. Each church is an isolated tenant. Satellites connect via API keys bound to a specific tenant.

**Domain:** `people.harvestgen.org` (Vercel deployment)
**Repo:** `harvestgen-people`

---

## Tech Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 14 (App Router) | TypeScript strict mode, SSR routing |
| Styling | Tailwind CSS + shadcn/ui | Clean, data-dense admin aesthetic |
| Database | Supabase (PostgreSQL) | **Row-Level Security (RLS)** for multi-tenancy per church |
| Auth | Supabase Auth (or Clerk) | Multi-org auth supporting per-church roles |
| File Storage | Supabase Storage | Scoped by tenant |
| API | Next.js Route Handlers (`/api/v1/...`) | REST, API-key authenticated (keys bound to tenant) |
| Deployment | Vercel | |

---

## Database Schema (Multi-Tenant)

All core tables include a `church_id` to ensure strict tenant isolation via Row-Level Security (RLS).

### Churches (Tenants)

```sql
CREATE TABLE churches (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,       -- e.g. "harvestgen"
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
```

### Core People

```sql
CREATE TABLE households (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  address     TEXT,
  city        TEXT,
  state       TEXT,
  postcode    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE people (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  first_name      TEXT NOT NULL,
  last_name       TEXT NOT NULL,
  email           TEXT,                   -- Unique per church (enforced via unique constraint)
  phone           TEXT,
  gender          TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  birthdate       DATE,
  marital_status  TEXT CHECK (marital_status IN ('single', 'married', 'divorced', 'widowed')),
  anniversary     DATE,
  photo_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'visitor'
                  CHECK (status IN ('active', 'visitor', 'inactive', 'child')),
  campus          TEXT,                   -- E.g. "Bandar Sunway"
  household_id    UUID REFERENCES households(id) ON DELETE SET NULL,
  metadata        JSONB DEFAULT '{}',     -- For unstructured CSV imports & API payloads
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, email)
);

CREATE INDEX idx_people_tenant_email ON people(church_id, email);
CREATE INDEX idx_people_tenant_status ON people(church_id, status);
```

### Custom Fields & Tags

```sql
CREATE TABLE field_definitions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  field_type  TEXT NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'boolean', 'select')),
  options     JSONB,
  is_required BOOLEAN DEFAULT FALSE,
  position    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, slug)
);

CREATE TABLE tags (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#6B7280',
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, name)
);
```

### Roles & Scheduling (For Axiom / Planning Center Sync)

```sql
CREATE TABLE roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  category    TEXT, -- e.g., 'Worship', 'Production', 'Host Team'
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, name)
);

CREATE TABLE person_roles (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  role_id     UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (church_id, person_id, role_id)
);
```

*(Note: `person_field_values`, `person_tags`, `notes`, `workflows`, `lists`, `person_events`, etc., all receive `church_id` columns and compound constraints to isolate data per tenant.)*

### API Keys (Tenant Bound)

```sql
CREATE TABLE api_keys (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id     UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  key_hash      TEXT NOT NULL,
  key_prefix    TEXT NOT NULL,
  scopes        TEXT[] NOT NULL DEFAULT '{}',
  last_used_at  TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ,
  is_active     BOOLEAN DEFAULT TRUE,
  created_by    UUID REFERENCES auth.users(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## API Design (`/api/v1/`)

All endpoints require `Authorization: Bearer <api_key>`. The API Key resolution intrinsically determines the `church_id` context. Integrations never need to pass `church_id` directly in payloads.

---

## The Multi-Tenant Pivot Plan

1. **Schema Migration:** Introduce the `churches` table. Add `church_id` to all existing tables (`people`, `households`, `api_keys`, etc.).
2. **Row-Level Security (RLS):** Enable RLS on all tables to enforce isolation `where church_id = current_setting('app.current_tenant_id')`.
3. **API Auth Update:** Update `src/lib/api-auth.ts` to return the `church_id` associated with the API key, and pass it downstream to all database mutations.
4. **Middleware Update:** Inject tenant resolution via URL subdomains (e.g. `churchslug.people.harvestgen.org`) or user org selection.

---

## Key Rules & Constraints

1. **Multi-Tenant First:** No query is ever executed without filtering by `church_id`.
2. **API keys are never stored in plaintext.**
3. **`person_events` is append-only.**
4. **All monetary/numeric values in metadata** stored as strings.