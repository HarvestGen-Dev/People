-- <!-- AGENT: ARCHITECT -->
-- Tenant authorization is represented by church_memberships instead of mutable
-- auth user metadata. New accounts can only join a church through a hashed,
-- expiring, single-use invitation.

CREATE TABLE church_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('owner', 'admin', 'member')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (church_id, user_id)
);

CREATE INDEX idx_church_memberships_user
  ON church_memberships(user_id);

CREATE TABLE church_invitations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (email = LOWER(BTRIM(email))),
  token_hash  TEXT NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  role        TEXT NOT NULL DEFAULT 'member'
              CHECK (role IN ('admin', 'member')),
  invited_by  UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  expires_at  TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  accepted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at),
  CHECK (
    (accepted_at IS NULL AND accepted_by IS NULL)
    OR (accepted_at IS NOT NULL AND accepted_by IS NOT NULL)
  )
);

CREATE INDEX idx_church_invitations_church
  ON church_invitations(church_id, created_at DESC);

CREATE INDEX idx_church_invitations_email
  ON church_invitations(church_id, email);

-- Preserve access for existing users. Metadata is used only for this one-time
-- migration; church_memberships is authoritative after the backfill.
WITH resolved_users AS (
  SELECT
    users.id AS user_id,
    users.created_at,
    COALESCE(
      metadata_church.id,
      '00000000-0000-0000-0000-000000000001'::UUID
    ) AS church_id
  FROM auth.users AS users
  LEFT JOIN churches AS metadata_church
    ON metadata_church.slug = users.raw_user_meta_data ->> 'church_slug'
),
ranked_users AS (
  SELECT
    user_id,
    church_id,
    ROW_NUMBER() OVER (
      PARTITION BY church_id
      ORDER BY created_at ASC, user_id ASC
    ) AS membership_rank
  FROM resolved_users
)
INSERT INTO church_memberships (church_id, user_id, role)
SELECT
  church_id,
  user_id,
  CASE WHEN membership_rank = 1 THEN 'owner' ELSE 'admin' END
FROM ranked_users
ON CONFLICT (church_id, user_id) DO NOTHING;

ALTER TABLE church_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE church_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own church memberships"
  ON church_memberships
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Invitation acceptance is atomic. The function verifies the invited address
-- against auth.users, locks the invitation, creates the membership, and marks
-- the token as consumed in one transaction.
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
  ON CONFLICT (church_id, user_id)
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

-- Rollback plan:
-- 1. Restore the previous signup path before dropping these objects.
-- 2. DROP FUNCTION accept_church_invitation(TEXT, UUID);
-- 3. DROP TABLE church_invitations;
-- 4. DROP TABLE church_memberships;
