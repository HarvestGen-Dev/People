-- <!-- AGENT: ARCHITECT -->
-- Rationale:
-- 1. Enable `pg_trgm` extension and create GIN trigram indexes on `people` (`first_name`, `last_name`, `email`, `phone`, `phone_normalized`)
--    to eliminate full-table sequential scans during directory substring search, reducing query execution time by 10x+.
-- 2. Add composite index on `person_tags(church_id, tag_id, person_id)` to enable fast index-only scans for tag existence filters.
-- 3. Add composite index on `people(church_id, status, last_name, first_name)` for fast paginated status-filtered directory listing.
-- 4. Add composite index on `workflow_cards(church_id, workflow_id, completed_at, due_date)` for fast active-board queries.
-- 5. Introduce `get_people_directory` RPC to combine search, tag existence filtering, status filtering, pagination,
--    window-based total count, and nested tag aggregation into a single database round-trip.
--
-- Rollback plan:
-- 1. DROP FUNCTION IF EXISTS public.get_people_directory(UUID, TEXT, TEXT, UUID, INTEGER, INTEGER);
-- 2. DROP INDEX IF EXISTS public.idx_workflow_cards_church_workflow_completed_due;
-- 3. DROP INDEX IF EXISTS public.idx_people_church_status_name;
-- 4. DROP INDEX IF EXISTS public.idx_person_tags_church_tag_person;
-- 5. DROP INDEX IF EXISTS public.idx_people_phone_norm_trgm;
-- 6. DROP INDEX IF EXISTS public.idx_people_phone_trgm;
-- 7. DROP INDEX IF EXISTS public.idx_people_email_trgm;
-- 8. DROP INDEX IF EXISTS public.idx_people_last_name_trgm;
-- 9. DROP INDEX IF EXISTS public.idx_people_first_name_trgm;

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram substring search indices
CREATE INDEX IF NOT EXISTS idx_people_first_name_trgm
  ON public.people USING gin (first_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_people_last_name_trgm
  ON public.people USING gin (last_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_people_email_trgm
  ON public.people USING gin (email gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_people_phone_trgm
  ON public.people USING gin (phone gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_people_phone_norm_trgm
  ON public.people USING gin (phone_normalized gin_trgm_ops);

-- Composite indices for tenant directory filtering and sorting
CREATE INDEX IF NOT EXISTS idx_people_church_status_name
  ON public.people (church_id, status, last_name, first_name);

CREATE INDEX IF NOT EXISTS idx_person_tags_church_tag_person
  ON public.person_tags (church_id, tag_id, person_id);

CREATE INDEX IF NOT EXISTS idx_workflow_cards_church_workflow_completed_due
  ON public.workflow_cards (church_id, workflow_id, completed_at, due_date);

-- Combined RPC for single round-trip people directory loading
CREATE OR REPLACE FUNCTION public.get_people_directory(
  p_church_id UUID,
  p_search TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_tag_id UUID DEFAULT NULL,
  p_page INTEGER DEFAULT 1,
  p_page_size INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  display_id TEXT,
  first_name VARCHAR,
  last_name VARCHAR,
  email VARCHAR,
  phone VARCHAR,
  status VARCHAR,
  campus VARCHAR,
  photo_url TEXT,
  photo_path TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  person_tags JSONB,
  total_count BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH filtered AS (
    SELECT
      p.id,
      p.display_id,
      p.first_name,
      p.last_name,
      p.email,
      p.phone,
      p.status,
      p.campus,
      p.photo_url,
      p.photo_path,
      p.created_at,
      p.updated_at,
      COUNT(*) OVER() AS full_count
    FROM public.people p
    WHERE p.church_id = p_church_id
      AND (
        p_status IS NULL
        OR p_status = ''
        OR p_status = 'all'
        OR p.status = p_status
      )
      AND (
        p_tag_id IS NULL
        OR EXISTS (
          SELECT 1 FROM public.person_tags pt
          WHERE pt.church_id = p_church_id
            AND pt.person_id = p.id
            AND pt.tag_id = p_tag_id
        )
      )
      AND (
        p_search IS NULL
        OR trim(p_search) = ''
        OR (
          p.first_name ILIKE ('%' || trim(p_search) || '%')
          OR p.last_name ILIKE ('%' || trim(p_search) || '%')
          OR p.email ILIKE ('%' || trim(p_search) || '%')
          OR (p.phone IS NOT NULL AND p.phone ILIKE ('%' || trim(p_search) || '%'))
          OR (p.phone_normalized IS NOT NULL AND p.phone_normalized ILIKE ('%' || trim(p_search) || '%'))
        )
      )
    ORDER BY p.last_name ASC, p.first_name ASC
    OFFSET GREATEST(0, (COALESCE(p_page, 1) - 1) * COALESCE(p_page_size, 50))
    LIMIT LEAST(100, GREATEST(1, COALESCE(p_page_size, 50)))
  ),
  aggregated_tags AS (
    SELECT
      f.id AS person_id,
      COALESCE(
        jsonb_agg(
          jsonb_build_object(
            'person_id', pt.person_id,
            'tag_id', pt.tag_id,
            'created_at', pt.created_at,
            'tag', jsonb_build_object(
              'id', t.id,
              'display_id', t.display_id,
              'name', t.name,
              'color', t.color,
              'target_workflow_id', t.target_workflow_id,
              'created_at', t.created_at
            )
          ) ORDER BY t.name ASC
        ) FILTER (WHERE pt.tag_id IS NOT NULL),
        '[]'::jsonb
      ) AS tags_json
    FROM filtered f
    LEFT JOIN public.person_tags pt
      ON pt.church_id = p_church_id AND pt.person_id = f.id
    LEFT JOIN public.tags t
      ON t.church_id = p_church_id AND t.id = pt.tag_id
    GROUP BY f.id
  )
  SELECT
    f.id,
    f.display_id,
    f.first_name,
    f.last_name,
    f.email,
    f.phone,
    f.status,
    f.campus,
    f.photo_url,
    f.photo_path,
    f.created_at,
    f.updated_at,
    COALESCE(at.tags_json, '[]'::jsonb) AS person_tags,
    f.full_count AS total_count
  FROM filtered f
  LEFT JOIN aggregated_tags at ON at.person_id = f.id
  ORDER BY f.last_name ASC, f.first_name ASC;
$$;

REVOKE ALL ON FUNCTION public.get_people_directory(UUID, TEXT, TEXT, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_people_directory(UUID, TEXT, TEXT, UUID, INTEGER, INTEGER) TO service_role;
