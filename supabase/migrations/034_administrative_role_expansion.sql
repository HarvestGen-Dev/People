-- 034_administrative_role_expansion.sql
-- <!-- AGENT: ARCHITECT -->
-- Rationale: portal users are represented by person_user_links, while tenant
-- administration needs explicit roles. Keep legacy member rows valid for
-- compatibility, but permit the planned pastoral, staff, and viewer roles.

ALTER TABLE public.church_memberships
  DROP CONSTRAINT IF EXISTS church_memberships_role_check;

ALTER TABLE public.church_memberships
  ADD CONSTRAINT church_memberships_role_check
  CHECK (role IN ('owner', 'admin', 'pastoral', 'workflow_manager', 'staff', 'viewer', 'member'));

ALTER TABLE public.church_invitations
  DROP CONSTRAINT IF EXISTS church_invitations_role_check;

ALTER TABLE public.church_invitations
  ADD CONSTRAINT church_invitations_role_check
  CHECK (role IN ('owner', 'admin', 'pastoral', 'workflow_manager', 'staff', 'viewer', 'member'));
