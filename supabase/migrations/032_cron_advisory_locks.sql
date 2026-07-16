-- 032_cron_advisory_locks.sql
-- <!-- AGENT: DEVOPS -->
-- Rationale: mutation-performing cron routes need an application-level lock to
-- avoid overlapping executions when a scheduler retries or invokes in parallel.

CREATE OR REPLACE FUNCTION public.try_cron_advisory_lock(p_lock_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_try_advisory_lock(hashtext(p_lock_name));
$$;

REVOKE ALL ON FUNCTION public.try_cron_advisory_lock(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.try_cron_advisory_lock(TEXT) TO service_role;

CREATE OR REPLACE FUNCTION public.release_cron_advisory_lock(p_lock_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT pg_advisory_unlock(hashtext(p_lock_name));
$$;

REVOKE ALL ON FUNCTION public.release_cron_advisory_lock(TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_cron_advisory_lock(TEXT) TO service_role;
