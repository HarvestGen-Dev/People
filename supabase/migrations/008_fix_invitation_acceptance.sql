-- <!-- AGENT: ARCHITECT -->
-- Fix PL/pgSQL ambiguity between the church_id output parameter and the
-- church_memberships.church_id column in the invitation acceptance upsert.

CREATE OR REPLACE FUNCTION accept_church_invitation(
  p_token_hash TEXT,
  p_user_id UUID
)
RETURNS TABLE (church_id UUID, church_slug TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  invitation_id UUID;
  invitation_church_id UUID;
  invitation_role TEXT;
  resolved_church_slug TEXT;
BEGIN
  SELECT
    invitation.id,
    invitation.church_id,
    invitation.role
  INTO
    invitation_id,
    invitation_church_id,
    invitation_role
  FROM public.church_invitations AS invitation
  JOIN auth.users AS invited_user
    ON invited_user.id = p_user_id
    AND LOWER(invited_user.email) = invitation.email
  WHERE invitation.token_hash = p_token_hash
    AND invitation.accepted_at IS NULL
    AND invitation.expires_at > NOW()
  FOR UPDATE OF invitation;

  IF invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, or issued to another email';
  END IF;

  INSERT INTO public.church_memberships (church_id, user_id, role)
  VALUES (invitation_church_id, p_user_id, invitation_role)
  ON CONFLICT ON CONSTRAINT church_memberships_church_id_user_id_key
  DO UPDATE SET
    role = EXCLUDED.role,
    updated_at = NOW();

  UPDATE public.church_invitations
  SET
    accepted_at = NOW(),
    accepted_by = p_user_id
  WHERE id = invitation_id;

  SELECT slug
  INTO resolved_church_slug
  FROM public.churches
  WHERE id = invitation_church_id;

  RETURN QUERY
  SELECT invitation_church_id, resolved_church_slug;
END;
$$;

REVOKE ALL ON FUNCTION accept_church_invitation(TEXT, UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION accept_church_invitation(TEXT, UUID) FROM anon;
REVOKE ALL ON FUNCTION accept_church_invitation(TEXT, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION accept_church_invitation(TEXT, UUID) TO service_role;

-- Rollback plan: restore the function body from migration 007 after correcting
-- the ambiguous ON CONFLICT target.
