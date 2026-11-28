# HG shared platform database

This folder is the Supabase project for the **shared HG database**: one Supabase Pro
project holding People, HG Claims, Shepherd (LMS) and Drip & Brew, each in its own
Postgres schema. It is separate from People's own `supabase/` folder, which still
describes the current People-only project and keeps deploying as before.

Design: [HG Platform Architecture Proposal](https://claude.ai/artifact/Cud54DziBpWp48jFgXG7Az) · Jira: KAN-18, KAN-22, KAN-33, HC-2, DMD-14, DB-8

## What is in here

| Path | What it is |
| --- | --- |
| `supabase/migrations/` | 143 migrations, in the order they must run |
| `supabase/config.toml` | Supabase CLI config; the API exposes `core`, `people`, `office`, `claims`, `lms`, `pos` |
| `MIGRATION_MAP.csv` | Each original app migration and the platform file it became |
| `tools/convert.py` | Regenerates the 139 converted files from the four app repos |
| `tools/verify/` | Rebuilds the originals and the platform chain locally and compares them |

## Migration order

| Versions | Schema | Source | Files |
| --- | --- | --- | --- |
| `20261201000000` | all | Hand-written: creates the schemas and their API grants | 1 |
| `2026120101xxxx` | `people` | people-hg 001–052 | 52 |
| `2026120102xxxx` | `claims` (+ `claims_private`) | HG-Claims | 31 |
| `2026120103xxxx` | `lms` (+ `lms_private`) | lms-hg | 54 |
| `2026120104xxxx` | `pos` | drip-n-brew (2) + live drift fix (1, hand-written) | 3 |
| `20261201090000` | `auth` | Hand-written: removes the Claims and Shepherd sign-up triggers | 1 |
| `20261201090100` | `people`, `pos` | Hand-written: pins search_path on 5 functions | 1 |

## What the converter changed

Each app migration was rewritten only to move it out of `public`:

- `public.x` → `<schema>.x`, and `public` in `search_path` settings, `GRANT … ON SCHEMA`,
  `ALTER DEFAULT PRIVILEGES IN SCHEMA` and catalog lookups such as `'public'::regnamespace`.
- Claims' `private` schema → `claims_private`; Shepherd's `app_private` → `lms_private`.
- `pg_trgm` is created in the `extensions` schema instead of the app schema.
- Each file starts with `SET search_path TO <schema>, extensions;` so unqualified
  `CREATE TABLE` statements land in the right schema.

Nothing else in the SQL was edited. The comments and the order inside each file are unchanged.

## Verification (24 Nov 2026)

`tools/verify/verify.sh` was run on PostgreSQL 16 with a stand-in for Supabase's
`auth` and `storage` schemas:

- All four original migration histories apply cleanly, and so does the full platform chain.
- **Claims, Shepherd and Drip & Brew:** every table, column, default, constraint, index,
  RLS policy, trigger, view, type, grant and function body matches the original
  exactly once schema names are accounted for.
- **People:** the same, except that `pg_trgm`'s helper functions now live in `extensions`.
- The only other differences are the five search_path pins listed above and, for Drip & Brew,
  the live-drift additions in `20261201040003` (see Live schema drift).
- `public` is left empty. All 7 storage buckets (`avatars`, `event-covers`, `payment-proofs`,
  `payment-qr`, `people-photos`, `receipts`, `study-notes`) and all 20 storage policies are present,
  and the storage policies point at the right schemas.

It has **not** yet been run on a real Supabase stack. Before applying it to the new
project, run `supabase db reset` locally (Docker) and `supabase db lint` (KAN-31).

## Live schema drift

The live databases were compared with their repos on 24 Nov 2026 using the Supabase
schema diagrams. The diagrams are partial, so finish this check with full
`supabase db dump` exports before cutover.

| App | Live object missing from repo migrations | Handled in |
| --- | --- | --- |
| Drip & Brew | `settings` table (shop status, category order, inventory report config) | `20261201040003_pos_live_schema_drift.sql` |
| Drip & Brew | `products.display_order` (menu layout) | same file |
| Drip & Brew | `products.category` (legacy single category; live shows NOT NULL) | same file, nullable until the dump confirms its default |
| People, Claims, Shepherd | None found in the visible parts of the diagrams | Re-check with full dumps |

`20261201040003` is reconstructed from the diagram and the app's code, and is the only
migration here not derived from a repo. Replace it with the exact definitions from the
live dump before applying.

## Behaviour changes to know about

1. **Sign-up triggers are removed.** In their own projects, Claims created a profile and
   Shepherd created a user for every new `auth.users` row. In one shared Auth, that would
   give every People sign-up a Shepherd account. The trigger functions are kept so they
   can be re-wired to fire on access grants (HC-3, DMD-15). Until then, Claims and
   Shepherd users must be provisioned by the migration scripts or by People.
2. **API schema names change.** The apps' Supabase clients must select their schema,
   e.g. `createClient(url, key, { db: { schema: 'claims' } })`. Storage, Auth and Edge
   Function calls are unaffected. This is the app-side work in KAN-33, HC-2, DMD-14 and DB-8.
3. **RPC names are unchanged** but live in the app's schema (`claims.some_rpc`), so call
   them through the schema-scoped client.

## Changing it

Until each app is cut over, keep writing new migrations in the app's own repo and
regenerate this folder:

```sh
python3 platform/tools/convert.py <folder with the four repos> platform/supabase/migrations
# convert.py does not touch the four hand-written files (2026120100…, 20261201040003, 2026120109…)
platform/tools/verify/verify.sh <folder with the four repos>
```

After an app's cutover, freeze its old migration folder and write new migrations here
only, using the next free version in its hour slot or a new timestamp.
