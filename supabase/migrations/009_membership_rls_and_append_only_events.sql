-- <!-- AGENT: ARCHITECT -->
-- Replace permissive and session-setting RLS policies with authorization based
-- on church_memberships. Ordinary members have read access; owners and admins
-- can manage tenant data.

CREATE OR REPLACE FUNCTION is_church_member(p_church_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
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
  SELECT EXISTS (
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
  SELECT EXISTS (
    SELECT 1
    FROM public.church_memberships AS membership
    WHERE membership.church_id = p_church_id
      AND membership.user_id = auth.uid()
      AND membership.role = 'owner'
  );
$$;

REVOKE ALL ON FUNCTION is_church_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_church_member(UUID) FROM anon;
REVOKE ALL ON FUNCTION can_manage_church(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION can_manage_church(UUID) FROM anon;
REVOKE ALL ON FUNCTION is_church_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION is_church_owner(UUID) FROM anon;

GRANT EXECUTE ON FUNCTION is_church_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_manage_church(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION is_church_owner(UUID) TO authenticated;

-- Remove the policies introduced by migrations 002, 003, 005, and 007.
DROP POLICY IF EXISTS "Allow authenticated users all access on churches" ON churches;
DROP POLICY IF EXISTS "Allow authenticated users all access on households" ON households;
DROP POLICY IF EXISTS "Allow authenticated users all access on people" ON people;
DROP POLICY IF EXISTS "Allow authenticated users all access on field_definitions" ON field_definitions;
DROP POLICY IF EXISTS "Allow authenticated users all access on person_field_values" ON person_field_values;
DROP POLICY IF EXISTS "Allow authenticated users all access on tags" ON tags;
DROP POLICY IF EXISTS "Allow authenticated users all access on person_tags" ON person_tags;
DROP POLICY IF EXISTS "Allow authenticated users all access on notes" ON notes;
DROP POLICY IF EXISTS "Allow authenticated users all access on person_events" ON person_events;
DROP POLICY IF EXISTS "Allow authenticated users all access on workflows" ON workflows;
DROP POLICY IF EXISTS "Allow authenticated users all access on workflow_steps" ON workflow_steps;
DROP POLICY IF EXISTS "Allow authenticated users all access on workflow_cards" ON workflow_cards;
DROP POLICY IF EXISTS "Allow authenticated users all access on lists" ON lists;
DROP POLICY IF EXISTS "Allow authenticated users all access on list_people" ON list_people;
DROP POLICY IF EXISTS "Allow authenticated users all access on api_keys" ON api_keys;
DROP POLICY IF EXISTS "Allow authenticated users all access on webhooks" ON webhooks;
DROP POLICY IF EXISTS "Allow authenticated users all access on webhook_deliveries" ON webhook_deliveries;
DROP POLICY IF EXISTS "Tenant isolation for roles" ON roles;
DROP POLICY IF EXISTS "Tenant isolation for person_roles" ON person_roles;
DROP POLICY IF EXISTS "events_isolation" ON events;
DROP POLICY IF EXISTS "event_registrations_isolation" ON event_registrations;
DROP POLICY IF EXISTS "Allow authenticated users all access on events" ON events;
DROP POLICY IF EXISTS "Allow authenticated users all access on event_registrations" ON event_registrations;
DROP POLICY IF EXISTS "Users can read their own church memberships" ON church_memberships;

CREATE POLICY churches_select_members
  ON churches
  FOR SELECT
  TO authenticated
  USING ((SELECT is_church_member(id)));

CREATE POLICY churches_update_managers
  ON churches
  FOR UPDATE
  TO authenticated
  USING ((SELECT can_manage_church(id)))
  WITH CHECK ((SELECT can_manage_church(id)));

CREATE POLICY church_memberships_select_authorized
  ON church_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT can_manage_church(church_id))
  );

-- Standard tenant data: all members can read, while managers can create,
-- update, and delete.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'households',
    'people',
    'field_definitions',
    'person_field_values',
    'tags',
    'person_tags',
    'notes',
    'workflows',
    'workflow_steps',
    'workflow_cards',
    'lists',
    'list_people',
    'roles',
    'person_roles',
    'events',
    'event_registrations'
  ]
  LOOP
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.is_church_member(church_id)))',
      table_name || '_select_members',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_manage_church(church_id)))',
      table_name || '_insert_managers',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.can_manage_church(church_id))) WITH CHECK ((SELECT public.can_manage_church(church_id)))',
      table_name || '_update_managers',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.can_manage_church(church_id)))',
      table_name || '_delete_managers',
      table_name
    );
  END LOOP;
END;
$$;

-- API keys and webhook configuration contain credentials and are visible only
-- to church managers.
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['api_keys', 'webhooks']
  LOOP
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((SELECT public.can_manage_church(church_id)))',
      table_name || '_select_managers',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT public.can_manage_church(church_id)))',
      table_name || '_insert_managers',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((SELECT public.can_manage_church(church_id))) WITH CHECK ((SELECT public.can_manage_church(church_id)))',
      table_name || '_update_managers',
      table_name
    );
    EXECUTE FORMAT(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((SELECT public.can_manage_church(church_id)))',
      table_name || '_delete_managers',
      table_name
    );
  END LOOP;
END;
$$;

CREATE POLICY webhook_deliveries_select_managers
  ON webhook_deliveries
  FOR SELECT
  TO authenticated
  USING ((SELECT can_manage_church(church_id)));

-- Invitations stay service-role-only because their token hashes should not be
-- exposed through the authenticated PostgREST API.

CREATE POLICY person_events_select_members
  ON person_events
  FOR SELECT
  TO authenticated
  USING ((SELECT is_church_member(church_id)));

CREATE POLICY person_events_insert_managers
  ON person_events
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT can_manage_church(church_id)));

CREATE OR REPLACE FUNCTION prevent_person_event_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'person_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS person_events_append_only ON person_events;
CREATE TRIGGER person_events_append_only
  BEFORE UPDATE OR DELETE ON person_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_person_event_mutation();

REVOKE UPDATE, DELETE ON person_events FROM anon;
REVOKE UPDATE, DELETE ON person_events FROM authenticated;
REVOKE UPDATE, DELETE ON person_events FROM service_role;

-- Rollback plan:
-- 1. DROP TRIGGER person_events_append_only ON person_events and restore table
--    UPDATE/DELETE grants if event mutation is intentionally reintroduced.
-- 2. Drop policies ending in _members, _managers, or _authorized.
-- 3. Restore the authenticated policies from migrations 002, 003, 005, and
--    the self-membership SELECT policy from migration 007.
-- 4. Drop is_church_member, can_manage_church, and is_church_owner.
