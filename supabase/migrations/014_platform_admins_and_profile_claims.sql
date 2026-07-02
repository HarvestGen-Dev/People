-- <!-- AGENT: ARCHITECT -->
-- Add platform administration and verified-email profile claiming without
-- granting imported congregants church-wide dashboard access.

CREATE TABLE platform_admins (
  user_id     UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Bootstrap the existing installation's earliest owner as the first platform
-- administrator. Subsequent additions remain explicit and auditable.
INSERT INTO platform_admins (user_id)
SELECT membership.user_id
FROM church_memberships AS membership
WHERE membership.role = 'owner'
ORDER BY membership.created_at, membership.user_id
LIMIT 1
ON CONFLICT (user_id) DO NOTHING;

CREATE TABLE platform_audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  church_id   UUID REFERENCES churches(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_platform_audit_log_created
  ON platform_audit_log(created_at DESC);

CREATE INDEX idx_platform_audit_log_church
  ON platform_audit_log(church_id, created_at DESC);

ALTER TABLE people
  ADD COLUMN allow_self_claim BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE person_user_links (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id    UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id    UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_method TEXT NOT NULL DEFAULT 'verified_email'
               CHECK (claim_method IN ('verified_email', 'admin_approved')),
  claimed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id),
  UNIQUE (church_id, user_id)
);

CREATE INDEX idx_person_user_links_user
  ON person_user_links(user_id);

CREATE TABLE person_claim_requests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id   UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL CHECK (email = LOWER(BTRIM(email))),
  status      TEXT NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (person_id, user_id),
  CHECK (
    (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (status IN ('approved', 'rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  )
);

CREATE INDEX idx_person_claim_requests_church_status
  ON person_claim_requests(church_id, status, created_at DESC);

CREATE OR REPLACE FUNCTION prevent_last_church_owner_removal()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF OLD.role = 'owner'
    AND (
      TG_OP = 'DELETE'
      OR (TG_OP = 'UPDATE' AND NEW.role <> 'owner')
    )
    AND (
      SELECT COUNT(*)
      FROM public.church_memberships AS membership
      WHERE membership.church_id = OLD.church_id
        AND membership.role = 'owner'
    ) <= 1
    AND EXISTS (
      SELECT 1
      FROM public.churches AS church
      WHERE church.id = OLD.church_id
    )
  THEN
    RAISE EXCEPTION 'A church must retain at least one owner';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER church_memberships_retain_owner
  BEFORE DELETE OR UPDATE OF role ON church_memberships
  FOR EACH ROW
  EXECUTE FUNCTION prevent_last_church_owner_removal();

ALTER TABLE church_invitations
  DROP CONSTRAINT church_invitations_role_check;

ALTER TABLE church_invitations
  ADD CONSTRAINT church_invitations_role_check
  CHECK (role IN ('owner', 'admin', 'member'));

ALTER TABLE church_invitations
  ADD COLUMN revoked_at TIMESTAMPTZ,
  ADD COLUMN sent_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION is_platform_admin(p_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins AS administrator
    WHERE administrator.user_id = p_user_id
  );
$$;

REVOKE ALL ON FUNCTION is_platform_admin(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_platform_admin(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION is_platform_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_platform_admin(UUID) TO service_role;

CREATE OR REPLACE FUNCTION is_church_member(p_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.church_id = p_church_id
        AND membership.user_id = auth.uid()
    );
$$;

CREATE OR REPLACE FUNCTION can_manage_church(p_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.church_id = p_church_id
        AND membership.user_id = auth.uid()
        AND membership.role IN ('owner', 'admin')
    );
$$;

CREATE OR REPLACE FUNCTION is_church_owner(p_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    public.is_platform_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.church_memberships AS membership
      WHERE membership.church_id = p_church_id
        AND membership.user_id = auth.uid()
        AND membership.role = 'owner'
    );
$$;

CREATE OR REPLACE FUNCTION claim_person_profile()
RETURNS TABLE (
  claim_status TEXT,
  result_link_id UUID,
  result_person_id UUID,
  result_church_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  current_user_id UUID := auth.uid();
  verified_email TEXT;
  matching_count INTEGER := 0;
  matched_person_id UUID;
  matched_church_id UUID;
  matched_allow_self_claim BOOLEAN;
  existing_link public.person_user_links%ROWTYPE;
  created_link public.person_user_links%ROWTYPE;
BEGIN
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT public.normalize_person_email(account.email)
  INTO verified_email
  FROM auth.users AS account
  WHERE account.id = current_user_id
    AND account.email_confirmed_at IS NOT NULL;

  IF verified_email IS NULL THEN
    RETURN QUERY SELECT 'verification_required', NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  SELECT link.*
  INTO existing_link
  FROM public.person_user_links AS link
  WHERE link.user_id = current_user_id
  ORDER BY link.claimed_at
  LIMIT 1;

  IF existing_link.id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      'claimed',
      existing_link.id,
      existing_link.person_id,
      existing_link.church_id;
    RETURN;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    (ARRAY_AGG(person.id ORDER BY person.created_at, person.id))[1],
    (ARRAY_AGG(person.church_id ORDER BY person.created_at, person.id))[1],
    (ARRAY_AGG(person.allow_self_claim ORDER BY person.created_at, person.id))[1]
  INTO
    matching_count,
    matched_person_id,
    matched_church_id,
    matched_allow_self_claim
  FROM public.people AS person
  WHERE person.email_normalized = verified_email;

  IF matching_count = 0 THEN
    RETURN QUERY SELECT 'no_match', NULL::UUID, NULL::UUID, NULL::UUID;
    RETURN;
  END IF;

  IF matching_count = 1 AND matched_allow_self_claim THEN
    PERFORM 1
    FROM public.people AS person
    WHERE person.id = matched_person_id
    FOR UPDATE;

    IF EXISTS (
      SELECT 1
      FROM public.person_user_links AS link
      WHERE link.person_id = matched_person_id
        AND link.user_id <> current_user_id
    ) THEN
      RETURN QUERY
      SELECT 'already_claimed', NULL::UUID, matched_person_id, matched_church_id;
      RETURN;
    END IF;

    INSERT INTO public.person_user_links (
      church_id,
      person_id,
      user_id,
      claim_method
    )
    VALUES (
      matched_church_id,
      matched_person_id,
      current_user_id,
      'verified_email'
    )
    ON CONFLICT (church_id, user_id)
    DO UPDATE SET user_id = EXCLUDED.user_id
    RETURNING * INTO created_link;

    RETURN QUERY
    SELECT 'claimed', created_link.id, created_link.person_id, created_link.church_id;
    RETURN;
  END IF;

  INSERT INTO public.person_claim_requests (
    church_id,
    person_id,
    user_id,
    email
  )
  SELECT
    person.church_id,
    person.id,
    current_user_id,
    verified_email
  FROM public.people AS person
  WHERE person.email_normalized = verified_email
    AND NOT EXISTS (
      SELECT 1
      FROM public.person_user_links AS link
      WHERE link.person_id = person.id
    )
  ON CONFLICT (person_id, user_id) DO NOTHING;

  RETURN QUERY SELECT 'approval_required', NULL::UUID, NULL::UUID, NULL::UUID;
END;
$$;

REVOKE ALL ON FUNCTION claim_person_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION claim_person_profile() FROM anon;
GRANT EXECUTE ON FUNCTION claim_person_profile() TO authenticated;

CREATE OR REPLACE FUNCTION review_person_claim(
  p_request_id UUID,
  p_approve BOOLEAN
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  reviewer_id UUID := auth.uid();
  request_row public.person_claim_requests%ROWTYPE;
  created_link_id UUID;
BEGIN
  SELECT request.*
  INTO request_row
  FROM public.person_claim_requests AS request
  WHERE request.id = p_request_id
    AND request.status = 'pending'
  FOR UPDATE;

  IF request_row.id IS NULL THEN
    RAISE EXCEPTION 'Pending claim request was not found';
  END IF;

  IF reviewer_id IS NULL OR NOT public.can_manage_church(request_row.church_id) THEN
    RAISE EXCEPTION 'Church manager access is required';
  END IF;

  IF p_approve THEN
    INSERT INTO public.person_user_links (
      church_id,
      person_id,
      user_id,
      claim_method
    )
    VALUES (
      request_row.church_id,
      request_row.person_id,
      request_row.user_id,
      'admin_approved'
    )
    RETURNING id INTO created_link_id;
  END IF;

  UPDATE public.person_claim_requests
  SET
    status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
    reviewed_by = reviewer_id,
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = request_row.id;

  RETURN created_link_id;
END;
$$;

REVOKE ALL ON FUNCTION review_person_claim(UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION review_person_claim(UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION review_person_claim(UUID, BOOLEAN) TO authenticated;

ALTER TABLE platform_admins ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_user_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE person_claim_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY platform_admins_select_self
  ON platform_admins
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY platform_audit_log_select_platform
  ON platform_audit_log
  FOR SELECT
  TO authenticated
  USING ((SELECT is_platform_admin(auth.uid())));

CREATE POLICY person_user_links_select_authorized
  ON person_user_links
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT can_manage_church(church_id))
  );

CREATE POLICY person_claim_requests_select_authorized
  ON person_claim_requests
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT can_manage_church(church_id))
  );

CREATE POLICY people_select_linked_self
  ON people
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM person_user_links AS link
      WHERE link.person_id = people.id
        AND link.user_id = (SELECT auth.uid())
    )
  );

-- Existing invitations remain valid. Revoked invitations are rejected by the
-- application and the acceptance RPC is hardened here as defense in depth.
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
    AND invitation.revoked_at IS NULL
    AND invitation.expires_at > NOW()
  FOR UPDATE OF invitation;

  IF invitation_id IS NULL THEN
    RAISE EXCEPTION 'Invitation is invalid, expired, revoked, or issued to another email';
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

-- Bootstrap after this migration:
-- INSERT INTO platform_admins (user_id)
-- SELECT id FROM auth.users WHERE LOWER(email) = LOWER('owner@example.com');
--
-- Rollback plan:
-- 1. Remove portal and platform application routes.
-- 2. Restore accept_church_invitation from migration 008.
-- 3. Restore is_church_member/can_manage_church/is_church_owner from migration 009.
-- 4. DROP FUNCTION review_person_claim(UUID, BOOLEAN), claim_person_profile(),
--    and is_platform_admin(UUID).
-- 5. Drop church_memberships_retain_owner and its trigger function.
-- 6. Drop the added people SELECT policy and the four tables created here.
-- 7. Drop people.allow_self_claim and invitation revoked_at/sent_at columns.
-- 8. Restore the invitation role CHECK to ('admin', 'member').
