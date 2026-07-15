-- <!-- AGENT: ARCHITECT -->
-- Speed up duplicate profile review by finding candidate groups in Postgres
-- instead of loading every person record into the Next.js server process.
-- Rollback plan:
-- 1. DROP FUNCTION public.get_duplicate_people_candidates(UUID);
-- 2. DROP INDEX public.idx_people_church_normalized_name;

CREATE INDEX IF NOT EXISTS idx_people_church_normalized_name
  ON public.people(church_id, lower(btrim(first_name)), lower(btrim(last_name)));

CREATE OR REPLACE FUNCTION public.get_duplicate_people_candidates(p_church_id UUID)
RETURNS TABLE (
  group_key TEXT,
  reason TEXT,
  confidence TEXT,
  id UUID,
  display_id TEXT,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  phone TEXT,
  phone_normalized TEXT,
  status TEXT,
  campus TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SET search_path = public, pg_catalog
AS $$
  WITH phone_keys AS (
    SELECT person.phone_normalized AS group_key
    FROM public.people AS person
    WHERE person.church_id = p_church_id
      AND person.phone_normalized IS NOT NULL
    GROUP BY person.phone_normalized
    HAVING COUNT(*) > 1
  ),
  name_keys AS (
    SELECT
      lower(btrim(person.first_name)) || ' ' || lower(btrim(person.last_name)) AS group_key
    FROM public.people AS person
    WHERE person.church_id = p_church_id
      AND length(lower(btrim(person.first_name)) || ' ' || lower(btrim(person.last_name))) >= 4
    GROUP BY lower(btrim(person.first_name)), lower(btrim(person.last_name))
    HAVING COUNT(*) > 1
  ),
  duplicate_matches AS (
    SELECT
      phone_keys.group_key,
      'shared_phone'::TEXT AS reason,
      'high'::TEXT AS confidence
    FROM phone_keys

    UNION ALL

    SELECT
      name_keys.group_key,
      'same_name'::TEXT AS reason,
      'medium'::TEXT AS confidence
    FROM name_keys
  )
  SELECT
    duplicate_matches.group_key,
    duplicate_matches.reason,
    duplicate_matches.confidence,
    person.id,
    person.display_id,
    person.first_name,
    person.last_name,
    person.email,
    person.phone,
    person.phone_normalized,
    person.status,
    person.campus,
    person.created_at,
    person.updated_at
  FROM duplicate_matches
  JOIN public.people AS person
    ON person.church_id = p_church_id
    AND (
      (
        duplicate_matches.reason = 'shared_phone'
        AND person.phone_normalized = duplicate_matches.group_key
      )
      OR (
        duplicate_matches.reason = 'same_name'
        AND lower(btrim(person.first_name)) || ' ' || lower(btrim(person.last_name)) = duplicate_matches.group_key
      )
    )
  ORDER BY
    CASE duplicate_matches.confidence WHEN 'high' THEN 0 ELSE 1 END,
    duplicate_matches.group_key,
    person.updated_at DESC,
    person.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_duplicate_people_candidates(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_duplicate_people_candidates(UUID) TO service_role;
