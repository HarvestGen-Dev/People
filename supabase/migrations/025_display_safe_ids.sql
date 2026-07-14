-- <!-- AGENT: ARCHITECT -->
-- Add stable human-facing identifiers so database UUID primary keys stay internal.
-- These IDs are for display, URLs, exports, and integration responses. They do
-- not replace UUID primary keys or tenant-scoped foreign keys.

CREATE OR REPLACE FUNCTION public.generate_display_id(p_prefix TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public, extensions, pg_catalog
AS $$
BEGIN
  RETURN upper(p_prefix || '-' || encode(gen_random_bytes(5), 'hex'));
END;
$$;

ALTER TABLE public.churches
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.churches
SET display_id = public.generate_display_id('CHR')
WHERE display_id IS NULL;

ALTER TABLE public.churches
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('CHR');

CREATE UNIQUE INDEX IF NOT EXISTS churches_display_id_key
  ON public.churches(display_id);

ALTER TABLE public.people
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.people
SET display_id = public.generate_display_id('PER')
WHERE display_id IS NULL;

ALTER TABLE public.people
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('PER');

CREATE UNIQUE INDEX IF NOT EXISTS people_church_display_id_key
  ON public.people(church_id, display_id);

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.events
SET display_id = public.generate_display_id('EVT')
WHERE display_id IS NULL;

ALTER TABLE public.events
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('EVT');

CREATE UNIQUE INDEX IF NOT EXISTS events_church_display_id_key
  ON public.events(church_id, display_id);

ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.event_registrations
SET display_id = public.generate_display_id('REG')
WHERE display_id IS NULL;

ALTER TABLE public.event_registrations
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('REG');

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_church_display_id_key
  ON public.event_registrations(church_id, display_id);

ALTER TABLE public.person_events
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.person_events
SET display_id = public.generate_display_id('ACT')
WHERE display_id IS NULL;

ALTER TABLE public.person_events
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('ACT');

CREATE UNIQUE INDEX IF NOT EXISTS person_events_church_display_id_key
  ON public.person_events(church_id, display_id);

ALTER TABLE public.lists
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.lists
SET display_id = public.generate_display_id('LST')
WHERE display_id IS NULL;

ALTER TABLE public.lists
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('LST');

CREATE UNIQUE INDEX IF NOT EXISTS lists_church_display_id_key
  ON public.lists(church_id, display_id);

ALTER TABLE public.workflows
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.workflows
SET display_id = public.generate_display_id('WFL')
WHERE display_id IS NULL;

ALTER TABLE public.workflows
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('WFL');

CREATE UNIQUE INDEX IF NOT EXISTS workflows_church_display_id_key
  ON public.workflows(church_id, display_id);

COMMENT ON COLUMN public.churches.display_id IS
  'Human-facing church identifier. Do not use as a foreign key.';
COMMENT ON COLUMN public.people.display_id IS
  'Human-facing person identifier for URLs, exports, and API responses.';

ALTER TABLE public.tags
  ADD COLUMN IF NOT EXISTS display_id TEXT;

UPDATE public.tags
SET display_id = public.generate_display_id('TAG')
WHERE display_id IS NULL;

ALTER TABLE public.tags
  ALTER COLUMN display_id SET NOT NULL,
  ALTER COLUMN display_id SET DEFAULT public.generate_display_id('TAG');

CREATE UNIQUE INDEX IF NOT EXISTS tags_church_display_id_key
  ON public.tags(church_id, display_id);

COMMENT ON COLUMN public.tags.display_id IS
  'Human-facing tag identifier for API responses.';
COMMENT ON COLUMN public.events.display_id IS
  'Human-facing event identifier for admin URLs and API responses.';
COMMENT ON COLUMN public.event_registrations.display_id IS
  'Human-facing event registration identifier for review screens.';
COMMENT ON COLUMN public.person_events.display_id IS
  'Human-facing activity/event identifier for API responses.';
COMMENT ON COLUMN public.lists.display_id IS
  'Human-facing list identifier for admin URLs and exports.';
COMMENT ON COLUMN public.workflows.display_id IS
  'Human-facing workflow identifier for admin URLs.';
