# Production Migration Cutover - 2026-07-23

<!-- AGENT: DEVOPS -->
<!-- AGENT: BACKEND -->
<!-- AGENT: INTEGRATION -->

## Database deployment

Production Supabase project `kpajlysbaftnrrgjwvtr` was upgraded from migration
`044` through `048` using the controlled migration sequence rehearsed in
`docs/PRODUCTION_MIGRATION_REHEARSAL_2026-07-22.md`.

1. Migration `045` was applied by itself.
2. Both pulse duplicate audits returned zero rows.
3. Migration `046` was applied by itself.
4. Migration `047` was applied by itself.
5. Migration `048` was applied by itself.
6. The PostgREST schema cache was reloaded.
7. The final remote migration ledger reported `001` through `048`.
8. All 28 tenant relationships reported zero violations.
9. Both pulse duplicate audits still returned zero rows.
10. All four operational-health RPCs executed successfully through PostgREST.

No duplicate workflow records were repaired, deleted, merged, or otherwise
modified during the deployment.

## Scheduler hold

The rollout stopped before scheduler enablement because Vercel Cron invokes its
configured endpoint with `GET`, while the deployed route accepted only `POST`.
The scheduler remained disabled and administrative processing remained paused.

This compatibility patch routes authenticated `GET` and `POST` requests through
one shared handler. Both methods retain the same `CRON_SECRET` validation,
optional run ID validation, transactional RPC, response validation, and
privacy-safe operational logging.

Production currently has zero pulse configurations. A production
configuration-lock contention test is therefore not applicable. Do not create
synthetic production configurations to force contention. Advisory transaction
locking, duplicate prevention, retry safety, and lock release remain covered by
the local integration and production-shaped rehearsal tests.

## Remaining production verification

Keep the scheduler disabled until the compatibility patch is deployed and all
of the following pass:

1. Missing, incorrect, and valid `GET` authorization checks.
2. Valid `GET` replay with the same run ID.
3. Authenticated `POST` compatibility.
4. Run-history and structured-log review.
5. Owner/admin application smoke tests.
6. Owner/admin operational-health rendering.
7. Restricted-role operational-health denial.

Do not record credentials, request headers, person data, or connection strings
in deployment evidence.

