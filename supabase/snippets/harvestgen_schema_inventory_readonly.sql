-- <!-- AGENT: ARCHITECT -->
-- Catalog inventory for Phase 2. Run against an approved target as a read-only
-- operation. No table rows, function bodies, credentials or Auth data are read.
BEGIN TRANSACTION READ ONLY;

SELECT n.nspname AS schema_name, c.relname AS relation_name, c.relkind,
       c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_catalog.pg_class AS c
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'booking', 'storage')
  AND c.relkind IN ('r', 'p', 'v', 'm')
ORDER BY 1, 2;

SELECT table_schema, table_name, ordinal_position, column_name, data_type,
       udt_schema, udt_name, is_nullable, is_generated
FROM information_schema.columns
WHERE table_schema IN ('public', 'booking', 'storage')
ORDER BY 1, 2, 3;

SELECT n.nspname AS schema_name, c.relname AS relation_name, k.conname, k.contype,
       k.condeferrable, k.condeferred, k.convalidated,
       NULLIF(k.confrelid, 0)::regclass::text AS referenced_relation
FROM pg_catalog.pg_constraint AS k
JOIN pg_catalog.pg_class AS c ON c.oid = k.conrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'booking', 'storage')
ORDER BY 1, 2, 3;

SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_catalog.pg_policies
WHERE schemaname IN ('public', 'booking', 'storage')
ORDER BY 1, 2, 3;

SELECT n.nspname AS schema_name, p.oid::regprocedure::text AS signature,
       p.prosecdef AS security_definer, pg_catalog.pg_get_userbyid(p.proowner) AS owner,
       ARRAY(
         SELECT item FROM unnest(p.proconfig) AS settings(item)
         WHERE item LIKE 'search_path=%'
       ) AS configured_search_path,
       pg_catalog.has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
       pg_catalog.has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute,
       pg_catalog.has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_execute
FROM pg_catalog.pg_proc AS p
JOIN pg_catalog.pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public', 'booking')
ORDER BY 1, 2;

SELECT table_schema, table_name, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema IN ('public', 'booking', 'storage')
  AND grantee IN ('PUBLIC', 'anon', 'authenticated', 'service_role')
ORDER BY 1, 2, 3, 4;

SELECT n.nspname AS schema_name, r.rolname AS role,
       pg_catalog.has_schema_privilege(r.oid, n.oid, 'USAGE') AS can_use,
       pg_catalog.has_schema_privilege(r.oid, n.oid, 'CREATE') AS can_create
FROM pg_catalog.pg_namespace AS n
CROSS JOIN pg_catalog.pg_roles AS r
WHERE n.nspname IN ('public', 'booking', 'storage')
  AND r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY 1, 2;

SELECT n.nspname AS schema_name, c.relname AS relation_name, t.tgname, t.tgenabled,
       t.tgfoid::regprocedure::text AS trigger_function
FROM pg_catalog.pg_trigger AS t
JOIN pg_catalog.pg_class AS c ON c.oid = t.tgrelid
JOIN pg_catalog.pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'booking', 'storage') AND NOT t.tgisinternal
ORDER BY 1, 2, 3;

SELECT e.extname, e.extversion, n.nspname AS installed_schema
FROM pg_catalog.pg_extension AS e
JOIN pg_catalog.pg_namespace AS n ON n.oid = e.extnamespace
ORDER BY 1;

SELECT to_regclass('supabase_migrations.schema_migrations') AS migration_history_relation;

ROLLBACK;
