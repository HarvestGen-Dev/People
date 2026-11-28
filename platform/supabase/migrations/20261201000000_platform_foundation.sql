-- HG shared platform: foundation
-- Creates one schema per app plus the shared schemas from the architecture design
-- (https://claude.ai/artifact/Cud54DziBpWp48jFgXG7Az, KAN-22).
-- App migrations that follow create their tables inside these schemas.

CREATE SCHEMA IF NOT EXISTS core;         -- shared identity and access (KAN-23)
CREATE SCHEMA IF NOT EXISTS people;       -- People
CREATE SCHEMA IF NOT EXISTS office;       -- Office dashboard (KAN-47)
CREATE SCHEMA IF NOT EXISTS claims;       -- HG Claims
CREATE SCHEMA IF NOT EXISTS lms;          -- Shepherd
CREATE SCHEMA IF NOT EXISTS pos;          -- Drip & Brew
CREATE SCHEMA IF NOT EXISTS integration;  -- event outbox, never exposed to the Data API (KAN-32)

-- Exposed app schemas behave like Supabase's default `public` schema:
-- API roles may use the schema, and new objects get the same default grants that
-- Supabase gives objects in `public`. Row Level Security in each app's migrations
-- remains the access control, exactly as it was when the apps used `public`.
GRANT USAGE ON SCHEMA core, people, office, claims, lms, pos TO anon, authenticated, service_role;

DO $grants$
DECLARE s text;
BEGIN
  FOREACH s IN ARRAY ARRAY['core', 'people', 'office', 'claims', 'lms', 'pos'] LOOP
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON TABLES TO anon, authenticated, service_role', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT ALL ON SEQUENCES TO anon, authenticated, service_role', s);
    EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role', s);
  END LOOP;
END
$grants$;

-- The outbox is server-side only.
REVOKE ALL ON SCHEMA integration FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA integration TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA integration GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA integration GRANT ALL ON SEQUENCES TO service_role;
