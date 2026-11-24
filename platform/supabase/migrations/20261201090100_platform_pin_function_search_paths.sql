-- HG shared platform: pin search_path on functions that relied on the caller's.
-- In single-app projects these resolved table names through `public`. In the shared
-- project they must resolve to their own schema no matter which app or job calls them.

ALTER FUNCTION people.enforce_registration_status_transition() SET search_path = people, extensions;
ALTER FUNCTION pos.generate_order_number() SET search_path = pos, extensions;
ALTER FUNCTION pos.get_daily_analytics(integer) SET search_path = pos, extensions;
ALTER FUNCTION pos.get_monthly_analytics() SET search_path = pos, extensions;
ALTER FUNCTION pos.get_weekly_analytics() SET search_path = pos, extensions;
