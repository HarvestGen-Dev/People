-- <!-- AGENT: ARCHITECT -->
-- Allow an invited church user to supply their own profile information during
-- signup. The invitation remains the authorization boundary, and creation plus
-- account linking is atomic so a pre-imported person record is not required.

ALTER TABLE public.person_user_links
  DROP CONSTRAINT person_user_links_claim_method_check;

ALTER TABLE public.person_user_links
  ADD CONSTRAINT person_user_links_claim_method_check
  CHECK (claim_method IN ('verified_email', 'admin_approved', 'invitation'));

CREATE OR REPLACE FUNCTION public.create_invited_person_profile(
  p_token_hash TEXT,
  p_user_id UUID,
  p_first_name TEXT,
  p_last_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_gender TEXT DEFAULT NULL,
  p_birthdate DATE DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  invitation_church_id UUID;
  invitation_email TEXT;
  existing_person_id UUID;
  existing_link_user_id UUID;
  created_person_id UUID;
BEGIN
  IF NULLIF(BTRIM(p_first_name), '') IS NULL
    OR NULLIF(BTRIM(p_last_name), '') IS NULL THEN
    RAISE EXCEPTION 'First name and last name are required';
  END IF;

  IF LENGTH(BTRIM(p_first_name)) > 100
    OR LENGTH(BTRIM(p_last_name)) > 100 THEN
    RAISE EXCEPTION 'First name and last name must be 100 characters or fewer';
  END IF;

  IF p_gender IS NOT NULL
    AND p_gender NOT IN ('male', 'female', 'other', 'prefer_not_to_say') THEN
    RAISE EXCEPTION 'Invalid gender';
  END IF;

  SELECT invitation.church_id, invitation.email
  INTO invitation_church_id, invitation_email
  FROM public.church_invitations AS invitation
  JOIN auth.users AS invited_user
    ON invited_user.id = p_user_id
    AND public.normalize_person_email(invited_user.email) = invitation.email
  WHERE invitation.token_hash = p_token_hash
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > NOW()
    AND (
      invitation.accepted_at IS NULL
      OR invitation.accepted_by = p_user_id
    )
  FOR UPDATE OF invitation;

  IF invitation_church_id IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, revoked, or issued to another email';
  END IF;

  SELECT link.person_id
  INTO existing_person_id
  FROM public.person_user_links AS link
  WHERE link.church_id = invitation_church_id
    AND link.user_id = p_user_id
  LIMIT 1;

  IF existing_person_id IS NOT NULL THEN
    RETURN existing_person_id;
  END IF;

  SELECT person.id
  INTO existing_person_id
  FROM public.people AS person
  WHERE person.church_id = invitation_church_id
    AND person.email_normalized = invitation_email
  FOR UPDATE;

  IF existing_person_id IS NOT NULL THEN
    SELECT link.user_id
    INTO existing_link_user_id
    FROM public.person_user_links AS link
    WHERE link.person_id = existing_person_id;

    IF existing_link_user_id IS NOT NULL
      AND existing_link_user_id <> p_user_id THEN
      RAISE EXCEPTION 'This church profile is already linked to another account';
    END IF;

    INSERT INTO public.person_user_links (
      church_id,
      person_id,
      user_id,
      claim_method
    )
    VALUES (
      invitation_church_id,
      existing_person_id,
      p_user_id,
      'invitation'
    )
    ON CONFLICT (church_id, user_id) DO NOTHING;

    RETURN existing_person_id;
  END IF;

  INSERT INTO public.people (
    church_id,
    first_name,
    last_name,
    email,
    phone,
    gender,
    birthdate,
    status,
    allow_self_claim
  )
  VALUES (
    invitation_church_id,
    BTRIM(p_first_name),
    BTRIM(p_last_name),
    invitation_email,
    NULLIF(BTRIM(p_phone), ''),
    p_gender,
    p_birthdate,
    'visitor',
    FALSE
  )
  RETURNING id INTO created_person_id;

  INSERT INTO public.person_user_links (
    church_id,
    person_id,
    user_id,
    claim_method
  )
  VALUES (
    invitation_church_id,
    created_person_id,
    p_user_id,
    'invitation'
  );

  RETURN created_person_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_invited_person_profile(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_invited_person_profile(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE
) FROM anon;
REVOKE ALL ON FUNCTION public.create_invited_person_profile(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE
) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.create_invited_person_profile(
  TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE
) TO service_role;

-- Rollback:
-- 1. DROP FUNCTION public.create_invited_person_profile(
--      TEXT, UUID, TEXT, TEXT, TEXT, TEXT, DATE
--    );
-- 2. Update or remove person_user_links rows whose claim_method is
--    'invitation'.
-- 3. Restore person_user_links_claim_method_check to
--    ('verified_email', 'admin_approved').
