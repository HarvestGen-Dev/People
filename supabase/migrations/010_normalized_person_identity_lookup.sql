-- <!-- AGENT: ARCHITECT -->
-- Normalize person identity fields for deterministic, case-insensitive lookup.
-- Phone normalization assumes Malaysian local numbers when the value begins
-- with 0; already international numbers remain international.

CREATE OR REPLACE FUNCTION normalize_person_email(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT NULLIF(LOWER(BTRIM(value)), '');
$$;

CREATE OR REPLACE FUNCTION normalize_person_phone(value TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  WITH normalized AS (
    SELECT REGEXP_REPLACE(value, '[^0-9]', '', 'g') AS digits
  )
  SELECT CASE
    WHEN digits = '' THEN NULL
    WHEN digits LIKE '00%' THEN '+' || SUBSTRING(digits FROM 3)
    WHEN digits LIKE '0%' THEN '+60' || SUBSTRING(digits FROM 2)
    WHEN digits LIKE '60%' THEN '+' || digits
    ELSE '+' || digits
  END
  FROM normalized;
$$;

ALTER TABLE people
  ADD COLUMN email_normalized TEXT
    GENERATED ALWAYS AS (normalize_person_email(email)) STORED,
  ADD COLUMN phone_normalized TEXT
    GENERATED ALWAYS AS (normalize_person_phone(phone)) STORED;

-- Fail explicitly rather than silently choosing among pre-existing duplicate
-- case variants. Any reported rows must be reconciled before retrying.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM people
    WHERE email_normalized IS NOT NULL
    GROUP BY church_id, email_normalized
    HAVING COUNT(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Cannot enforce normalized email uniqueness: duplicate church/email rows exist';
  END IF;
END;
$$;

CREATE UNIQUE INDEX people_church_email_normalized_key
  ON people(church_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX idx_people_church_phone_normalized
  ON people(church_id, phone_normalized)
  WHERE phone_normalized IS NOT NULL;

-- Atomic find-or-create for integrations. Advisory locking serializes requests
-- for the same normalized identity without making shared phone numbers unique.
CREATE OR REPLACE FUNCTION lookup_or_create_person(
  p_church_id UUID,
  p_email TEXT,
  p_phone TEXT,
  p_first_name TEXT,
  p_last_name TEXT
)
RETURNS TABLE (
  result_person_id UUID,
  result_found BOOLEAN,
  result_conflict TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_email TEXT := public.normalize_person_email(p_email);
  normalized_phone TEXT := public.normalize_person_phone(p_phone);
  email_match_count INTEGER := 0;
  phone_match_count INTEGER := 0;
  email_person_id UUID;
  phone_person_id UUID;
  created_person_id UUID;
BEGIN
  IF normalized_email IS NULL AND normalized_phone IS NULL THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Email or phone is required';
    RETURN;
  END IF;

  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      p_church_id::TEXT
      || ':'
      || COALESCE(normalized_email, '')
      || ':'
      || COALESCE(normalized_phone, ''),
      0
    )
  );

  IF normalized_email IS NOT NULL THEN
    SELECT
      COUNT(*)::INTEGER,
      (ARRAY_AGG(person.id ORDER BY person.created_at, person.id))[1]
    INTO email_match_count, email_person_id
    FROM public.people AS person
    WHERE person.church_id = p_church_id
      AND person.email_normalized = normalized_email;
  END IF;

  IF normalized_phone IS NOT NULL THEN
    SELECT
      COUNT(*)::INTEGER,
      (ARRAY_AGG(person.id ORDER BY person.created_at, person.id))[1]
    INTO phone_match_count, phone_person_id
    FROM public.people AS person
    WHERE person.church_id = p_church_id
      AND person.phone_normalized = normalized_phone;
  END IF;

  IF email_match_count > 1 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Multiple people match this email address';
    RETURN;
  END IF;

  IF email_person_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.people AS person
      WHERE person.church_id = p_church_id
        AND person.phone_normalized = normalized_phone
        AND person.id <> email_person_id
    ) THEN
      RETURN QUERY SELECT NULL::UUID, FALSE, 'Email and phone match different people';
      RETURN;
    END IF;

    RETURN QUERY SELECT email_person_id, TRUE, NULL::TEXT;
    RETURN;
  END IF;

  IF phone_match_count > 1 THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'Multiple people match this phone number';
    RETURN;
  END IF;

  IF phone_person_id IS NOT NULL THEN
    RETURN QUERY SELECT phone_person_id, TRUE, NULL::TEXT;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.people (
      church_id,
      first_name,
      last_name,
      email,
      phone,
      status,
      campus
    )
    VALUES (
      p_church_id,
      p_first_name,
      p_last_name,
      normalized_email,
      normalized_phone,
      'visitor',
      'Bandar Sunway'
    )
    RETURNING id INTO created_person_id;
  EXCEPTION
    WHEN unique_violation THEN
      IF normalized_email IS NULL THEN
        RAISE;
      END IF;

      SELECT person.id
      INTO created_person_id
      FROM public.people AS person
      WHERE person.church_id = p_church_id
        AND person.email_normalized = normalized_email
      LIMIT 1;

      IF created_person_id IS NULL THEN
        RAISE;
      END IF;

      RETURN QUERY SELECT created_person_id, TRUE, NULL::TEXT;
      RETURN;
  END;

  RETURN QUERY SELECT created_person_id, FALSE, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION lookup_or_create_person(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC;
REVOKE ALL ON FUNCTION lookup_or_create_person(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM anon;
REVOKE ALL ON FUNCTION lookup_or_create_person(UUID, TEXT, TEXT, TEXT, TEXT)
  FROM authenticated;
GRANT EXECUTE ON FUNCTION lookup_or_create_person(UUID, TEXT, TEXT, TEXT, TEXT)
  TO service_role;

-- Rollback plan:
-- 1. Restore application lookup code before dropping the RPC.
-- 2. DROP FUNCTION lookup_or_create_person(UUID, TEXT, TEXT, TEXT, TEXT).
-- 3. DROP INDEX people_church_email_normalized_key and
--    idx_people_church_phone_normalized.
-- 4. DROP generated columns email_normalized and phone_normalized.
-- 5. DROP normalize_person_email(TEXT) and normalize_person_phone(TEXT).
