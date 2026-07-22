# End-to-End Testing

<!-- AGENT: INTEGRATION -->

The Playwright suite runs only against a disposable local Supabase stack and the
real local Next.js application. It exercises browser UI, Server Components,
route handlers, Auth, Storage, RLS, and tenant-aware foreign keys without API
mocks.

## Prerequisites

```bash
npm ci
npx playwright install --with-deps chromium
supabase start
supabase db reset --local --yes
```

Create `.env.local` from `supabase status -o env` with
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`SUPABASE_SERVICE_ROLE_KEY`. The suite fails before seeding when the Supabase
hostname is not `localhost`, `127.0.0.1`, or `::1`. The only override is
`E2E_ALLOW_REMOTE_SUPABASE=true`, which is reserved for an explicitly approved,
disposable test project and must never target production.

All generated emails use `@test.invalid`, all names are visibly synthetic, and
the Playwright server starts a local in-memory SMTP sink on port `3218`. Tests must not use real
church, person, phone, or payment information.

## Commands

```bash
npm run test:e2e
npm run test:e2e:journeys
npm run test:e2e:responsive
npx playwright test tests/e2e/business-journeys.spec.ts
npx playwright test --project=mobile-chrome
npx playwright show-report
```

Desktop Chromium runs the complete suite. Mobile Chrome and the 768x1024 tablet
project run only `responsive-registration.spec.ts`, keeping expensive admin
journeys single-run. The suite remains serial with one worker because local
Auth, rate-limit rows, and Storage cleanup are intentionally conservative.

## Isolation And Cleanup

Each suite creates unique church slugs, users, people, forms, workflows, events,
and storage paths. Cleanup removes tracked Storage objects and exact rate-limit
scopes, deletes only recorded church IDs in a local PostgreSQL transaction, and
then removes exact Auth user IDs. Cleanup errors fail the run. The helper never
uses unscoped table deletes or shared seed data.

Authentication is performed through the login UI. Storage state is not shared
between tenants because doing so would obscure tenant-selection and stale-cookie
failures. New role fixtures belong in `tests/e2e/helpers/seed-tenant.ts`; add the
role to `TestRole`, create a unique user, and assert both visible controls and a
direct protected route or mutation.

For a new tenant-isolation case, seed the resource in Church B, authenticate a
Church A user, tamper with the URL or identifier directly, and assert both the
denial status and absence of Church B names, contact details, notes, and raw
errors.

## Diagnostics And Policy

Failure traces, screenshots, and video are written under `test-results/`;
the local HTML report is under `playwright-report/`. Both are ignored by Git.
CI retries once to collect a second diagnostic attempt and uploads these folders
only on failure. A retry is not acceptance for a flaky test: reproduce the
failure locally, replace arbitrary timing with an event or state wait, and keep
the test quarantined only with an owner and tracked issue.
