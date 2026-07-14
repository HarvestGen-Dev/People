-- <!-- AGENT: ARCHITECT -->
-- Tenant-scoped append-only audit log for high-value administrative actions.
-- Rollback plan:
-- 1. DROP TRIGGER audit_log_append_only ON public.audit_log;
-- 2. DROP FUNCTION public.prevent_audit_log_mutation();
-- 3. DROP TABLE public.audit_log;

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES public.churches(id) ON DELETE CASCADE,
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_display_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_log_church_created_idx
  ON public.audit_log(church_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_church_action_idx
  ON public.audit_log(church_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_church_resource_idx
  ON public.audit_log(church_id, resource_type, resource_display_id, created_at DESC);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_managers ON public.audit_log;
CREATE POLICY audit_log_select_managers
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING ((SELECT public.can_manage_church(church_id)));

DROP POLICY IF EXISTS audit_log_insert_managers ON public.audit_log;
CREATE POLICY audit_log_insert_managers
  ON public.audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.can_manage_church(church_id)));

CREATE OR REPLACE FUNCTION public.prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only';
END;
$$;

DROP TRIGGER IF EXISTS audit_log_append_only ON public.audit_log;
CREATE TRIGGER audit_log_append_only
  BEFORE UPDATE OR DELETE ON public.audit_log
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_log_mutation();

REVOKE UPDATE, DELETE ON public.audit_log FROM anon;
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE UPDATE, DELETE ON public.audit_log FROM service_role;
