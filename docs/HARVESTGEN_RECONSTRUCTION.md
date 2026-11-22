# HarvestGen application reconstruction

The handoff is the specification. The original module source was unavailable. People remains the CRM foundation at the starting revision `33cba3b`.

## Local previews

Use Node 24. Run the commands in separate terminals.

| Runtime | Working directory | Commands | Route |
| --- | --- | --- | --- |
| People | Repository root | `npm ci`, then `npm run dev` | `http://localhost:3000/preview/church-office/events` |
| Booking Room | `booking-room/` | `npm ci`, then `npm run dev -- --hostname 127.0.0.1 --port 3001` | `http://127.0.0.1:3001/preview` |
| HG Links | People app (repository root) | `npm run dev` | `http://localhost:3000/link/<church-slug>` |

The calendar previews use fictional data and reset on reload. Booking Room has month and room views, a reservation form with in-memory recurrence through the 12-month window and a fictional booking list. Church Office has Internal Calendar, Public Calendar and filtered Tables. Calendar actions can edit or cancel selected rooms in a fictional occurrence, and publication applies to that occurrence. Table edits and cancellations apply to individual room rows. Recurrence scopes and live reads and writes are pending. The protected Church Office routes require the verified administrator in the HarvestGen workspace and show the status of the integration.

HG Links uses the People database for editable pages and form submissions. See [HG Links setup](HG_LINK.md) for configuration and publishing.

## Remaining decisions

1. Per-church onboarding and administrator policy, including where horizon-extension alerts should go.
2. Series controls for booking owners.
3. Public webpage or subscription feed only, and the room rename/archive/deletion policy.

Database design, migrations, credentials, production runtime configuration and integration testing belong to subsequent phases.

## Approved architecture direction

Booking Room serves multiple churches. The target is a dedicated `booking` schema in the existing People Supabase project. People stays in `public`. Ongoing recurrence is the default, with an optional finite last-start date.

### Tenant and identity boundaries

- Resolve a booking church from an explicit church slug checked on the server. Resolve rooms and booking IDs within that church. People dashboard membership, booking ownership, and platform administration remain distinct.
- Open OTP accounts may access booking for churches that explicitly enable open booking. Confirm each church's onboarding and public access policy before enabling it. A verified booking session never creates a People membership or person link.
- Scope the verified HarvestGen administrator email to HarvestGen. Define how additional churches appoint administrators before enabling their administration. Church Office continues to require the verified email and selected HarvestGen People context.
- Store the verified Auth user UUID on user-created bookings. Preserve null ownership for historical and staff-created reservations unless an approved, auditable owner assignment is available. Contact addresses never confer ownership.
- Put `church_id` on rooms, recurrence series, event occurrences, and reservations. Use composite references including `church_id` for all tenant-owned relations. Apply RLS, minimal grants, and server-side scope checks on every privileged operation. Service-role credentials are shared in scope and remain server-only.
- Keep the booking schema outside the Data API's exposed schemas unless the approved server access path requires exposure. If RPCs require it, explicitly scope grants and qualify every object in fixed-search-path functions. Share only the feed projection that each route needs.

### Scheduling and horizon

- Preserve the per-room exclusion constraint on confirmed half-open ranges and use a local Kuala Lumpur wall-clock schedule as the recurrence source. Persist stable occurrence keys, original ordering, shared event identity and revisions separately from mutable start/end times. A cancellation remains recorded to prevent later expansion from recreating it.
- Prepare a finite window of confirmed occurrences transactionally. Advance the window using a retryable worker with deterministic occurrence keys, ordered locks, and the same exclusion constraint and transaction rules as user creation. Retry operations must converge without duplicate inserts.
- An ongoing rule represents intent beyond the confirmed window. Keep the displayed reservation guarantee tied to the confirmed window. Confirm up to 12 months ahead and use the same cutoff for all bookings. If extending a series encounters a conflict, skip that occurrence in full, retain a durable exception so retries cannot recreate it, and alert a church administrator. A conflict in the initial user submission still rolls back the entire request.
- Let scoped edits affect both confirmed rows and the rules that generate future rows. Preserve the original ordinal when an occurrence is moved. Explicitly handle series splits, cancellation tombstones, and publication inheritance during worker retries.

### Migration and rollback gates

1. Inventory deployed schemas, policies, grants, functions, triggers, extensions, migration history, Auth templates and Storage settings using authorized read-only access. Confirm whether a current booking database exists and establish a trusted export and church attribution for any data to preserve.
2. Propose sequential root migrations after reconciling production drift. Create the schema additively, with tenant-safe constraints and restricted RPCs. Reconcile Auth IDs explicitly if importing records; preserve unmatched ownership as null. Exercise both email OTP and People link templates before switching either flow.
3. Verify imported counts, referential integrity, representative event history, cross-tenant denial, ordinary-user RPC denial, and parallel conflicts on a disposable restore or staging copy. Document database and Storage backups and verify restoration.
4. Cut over only after authorization and rehearsal. Keep legacy storage available during transition and coordinate a single write authority. Roll back by pausing booking writes and the horizon worker, restoring the previous application and connection configuration, and reconciling writes accepted after cutover before resuming. Retain new schema data during rollback for reconciliation.

## Verification record

- Booking Room on Node 24: four recurrence tests passed. Lint, typecheck, and production build passed. The development preview returned the expected HTML.
- People on Node 24: lint and typecheck passed after regenerating route types. The local production-mode webpack build passed with placeholder Supabase values. The default Turbopack build was stopped during compilation. The Church Office development preview returned the expected HTML.
- HG Connect on Node 24: syntax check and five-asset build passed. Loopback HTTP checks passed for the home and serving pages. The private environment path returned 404 and the serving endpoint returned the preview's 503.
- Browser interaction, accessibility, authenticated tenant access, database and migration tests, OTP, ICS interoperability, and SMTP delivery are pending. The installation audit reported dependency vulnerabilities for both Next.js packages. Review the findings before release.

## Live catalog spot-check — 15 November 2026 (Kuala Lumpur)

Read-only Supabase Dashboard queries on the People project’s main branch showed no `booking` schema, no relation matching the expected room/booking/reservation names, and no matching booking routine in `public`. This check covered the People project only. A separate legacy booking database remains unverified.

The newest migration visible in the dashboard was `048_production_operational_observability`. The local checkout also contains `049_production_scalability_performance.sql`, which was absent from the dashboard list. All 36 ordinary or partitioned tables in `public` had RLS enabled. Policy effectiveness and cross-tenant denial still require tests. The `btree_gist` extension was absent. The `payment-proofs` bucket was private with a 5 MiB size limit and JPEG, PNG, and WebP MIME restrictions.

The project overview displayed “No backups.” Confirm backup availability and restore evidence separately before a production migration. No production writes or settings changes were made.
