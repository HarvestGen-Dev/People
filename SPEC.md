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
| Framework | Next.js 16 (App Router) | TypeScript strict mode, SSR routing |
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

### Church Memberships & Invitations

<!-- AGENT: ARCHITECT -->

`church_memberships` is the authorization source of truth connecting Supabase
users to tenants. The `church_slug` value in auth user metadata may be retained
temporarily for display or routing compatibility, but it must not grant access.

```sql
CREATE TABLE church_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (church_id, user_id)
);
```

New accounts are invitation-only. Invitations are tenant-bound, expire, are
single-use, and store a SHA-256 token hash rather than the raw invitation token.
Only owners and administrators may issue invitations; only owners may invite
administrators.

RLS resolves access through `church_memberships`:

- Owners and administrators can read and mutate ordinary tenant data.
- Members can read ordinary tenant data but cannot mutate it.
- API keys, webhooks, and webhook deliveries are manager-only.
- Invitation rows are service-role-only so token hashes are never exposed.
- Church and membership creation remain service-mediated operations.

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
  email_normalized TEXT GENERATED ALWAYS AS (normalize_person_email(email)) STORED,
  phone_normalized TEXT GENERATED ALWAYS AS (normalize_person_phone(phone)) STORED,
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
CREATE UNIQUE INDEX people_church_email_normalized_key
  ON people(church_id, email_normalized)
  WHERE email_normalized IS NOT NULL;
CREATE INDEX idx_people_church_phone_normalized
  ON people(church_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;
```

Email identity is trimmed and case-insensitive. Malaysian local phone numbers
beginning with `0` normalize to `+60`; punctuation and spacing are ignored.
Phones are indexed but not unique because multiple people may legitimately
share one number.

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

`POST /people/lookup` is atomic and concurrency-safe. It returns an existing
person when email or phone has one unambiguous match, creates a visitor when no
match exists, and returns HTTP `409` with code `identity_conflict` when a phone
matches multiple people or email and phone identify different people.

### Admin tenant resolution

<!-- AGENT: BACKEND -->

Authenticated admin routes and Server Components resolve tenant context through
`src/lib/tenant-context.ts`. The resolver validates the Supabase session, then
verifies `church_memberships` using the service client. It never grants access
from auth user metadata.

For users with multiple memberships, the optional `people_church_id` cookie
selects an active church only after membership verification. Without a valid
selection, the resolver uses the user's earliest membership. Every service-role
query must still include the resolved `church_id`.

All mutation handlers must validate referenced IDs before writing. People,
households, tags, custom fields, lists, workflows, workflow steps, cards, and
assignees must belong to the resolved church. A request containing any missing
or cross-tenant reference is rejected as a whole with HTTP `400`.

---

## The Multi-Tenant Pivot

1. **Schema Migration:** Introduce the `churches` table. Add `church_id` to all existing tables (`people`, `households`, `api_keys`, etc.).
2. **Row-Level Security (RLS):** Enable RLS on all tables and resolve tenant access through `church_memberships` and `auth.uid()`.
3. **API Auth Update:** Update `src/lib/api-auth.ts` to return the `church_id` associated with the API key, and pass it downstream to all database mutations.
4. **Middleware Update:** Inject tenant resolution via URL subdomains (e.g. `churchslug.people.harvestgen.org`) or user org selection.

---

## Key Rules & Constraints

1. **Multi-Tenant First:** No query is ever executed without filtering by `church_id`.
2. **API keys are never stored in plaintext.**
3. **`person_events` is append-only.**
4. **All monetary/numeric values in metadata** stored as strings.
