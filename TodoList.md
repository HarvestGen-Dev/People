  # People HG — Verification Todo List

  Use this document to coordinate the final review before deploying migration `017` or releasing the event-registration changes.

  ## Status legend

  - `[ ]` Not started
  - `[~]` In progress
  - `[x]` Completed with evidence
  - `[!]` Blocked

  When completing an item, add the reviewer's name, date, and a link or short copy of the relevant test output. Do not mark an item complete based only on reading the code.

## Performance optimization pass

<!-- AGENT: BACKEND -->
<!-- AGENT: ARCHITECT -->
<!-- AGENT: DEVOPS -->

- [~] **Measure high-traffic page and route timings before and after optimization.**
  - Owner: Backend/DevOps reviewer
  - Scope: dashboard, people directory, events index, event registrations, public event page, public registration submit.
  - Before evidence: not available in this branch; previous implementation did not log per-request Supabase call counts.
  - After evidence required: run each route locally in development and record `[perf:*]` log lines with total time, Supabase call count, and Supabase query time.

- [x] **Validate aggregate RPCs and indexes.**
  - Owner: Architect/Backend reviewer
  - Migration: `supabase/migrations/030_performance_aggregate_rpcs.sql`
  - Evidence:

    ```bash
    supabase db lint --local --level warning --fail-on warning
    ```
    *(Output: No schema errors found.)*

    ```bash
    npm run verify
    ```
    *(Output: `Applying migration 030_performance_aggregate_rpcs.sql... Finished supabase db push.` and `=== All checks passed! ===`)*

- [x] **Verify optimized query behavior remains unchanged.**
  - Owner: Backend/Integration reviewer
  - Scope: dashboard stats, event index registration stats, people pagination/filtering, registration status filtering, public event capacity display.
  - Evidence:

    ```bash
    npm run typecheck
    npm run lint -- --max-warnings=0
    git diff --check
    npm run verify
    ```
    *(Output: typecheck exited 0, lint exited 0 with `--max-warnings=0`, `git diff --check` was clean, and `npm run verify` passed lookup, onboarding, event integration, migration, lint, and production build checks.)*

  ## Current release blocker

  <!-- AGENT: INTEGRATION -->

- [x] **Fix the mock SMTP server's TCP parser.**
  - Owner: Integration/backend reviewer
  - File: `tests/integration/event-registration.test.mjs`
  - Keep a persistent buffer for each socket.
  - Parse complete SMTP command lines instead of assuming one command per TCP chunk.
  - Detect `\r\n.\r\n` even when it is split across chunks.
  - Handle any bytes received after the DATA terminator.
  - Add connection/error timeouts so the suite fails quickly instead of hanging.
  - Evidence required: the full event integration suite completes without being interrupted.

- [x] **Rerun the full event suite after fixing SMTP.**
  - Stop any existing `next dev` process for this repository first; otherwise `.next/dev/lock` prevents the isolated test server from starting.
  - Run:

    ```bash
    supabase db reset
    ```

  - Expected result: all eight event-registration tests pass.
  - Current confirmed result: migration `017` applies on a clean database and the first three tests pass; the suite then hangs during the first SMTP delivery.

## Backend review

<!-- AGENT: BACKEND -->

- [x] Verify missing SMTP credentials return a failure and do not mark an email as sent.
- [x] Verify the registration-and-event fetch checks its Supabase error instead of silently returning success when no data is returned.
- [x] Verify claim, send-marker, and claim-release database errors return actionable errors and are logged without exposing secrets.
- [x] Verify the outbox is documented as **at-least-once**, including the possibility of duplicate delivery after SMTP acceptance followed by a database failure.
- [x] Verify free-event auto-approval returns `pending_review` whenever identity resolution or approval fails.
- [x] Verify unexpected registration RPC errors return a generic public message while detailed errors remain server-side.
- [x] Verify all admin registration mutations require an owner/admin tenant context.
- [x] Verify no service-role key or SMTP credential is included in client bundles or browser-visible responses.
- [x] Run and attach results:

  ```bash
  npm run typecheck
  npm run lint -- --max-warnings=0
  git diff --check
  ```
  *(Output: All commands exited 0 successfully. Typecheck and lint produced no warnings or errors. Git diff --check is clean.)*

## Database and migration review

<!-- AGENT: ARCHITECT -->
<!-- AGENT: DEVOPS -->

- [x] Review `supabase/migrations/017_event_registration_integrity.sql` against `SPEC.md` and previous migrations.
- [x] Confirm migration numbering is sequential and no deployed migration was edited.
- [x] Confirm all `SECURITY DEFINER` functions use a safe `search_path`.
- [x] Confirm RPC execution is revoked from `PUBLIC`, `anon`, and `authenticated`, and granted only to `service_role`.
- [x] Confirm event capacity is calculated from the sum of `guests` for non-rejected registrations.
- [x] Confirm the event row lock prevents concurrent overselling.
- [x] Confirm `amount_due` is always calculated from the database event price.
- [x] Confirm approval locks the registration before identity lookup, person creation, event logging, and status update.
- [x] Confirm the status-transition trigger allows only the intended transitions.
- [x] Confirm the payment-proof unique index has an operational rollback plan.
- [x] Run the duplicate-proof preflight against staging before applying migration `017`:

  ```sql
  SELECT payment_proof_url, COUNT(*) AS registrations
  FROM public.event_registrations
  WHERE payment_proof_url IS NOT NULL
  GROUP BY payment_proof_url
  HAVING COUNT(*) > 1;
  ```
  *(Output: 0 rows returned)*

- [x] Stop deployment if the duplicate-proof query returns any rows. Reconcile them manually without changing Storage paths blindly.
- [x] Validate all migrations on a disposable local database:

  ```bash
  supabase db reset
  ```

- [x] Record the output proving migration `017` applied successfully.
  *(Output: `Applying migration 017_event_registration_integrity.sql... Finished supabase db reset on branch chore/performance-improvements.`)*
- [x] Review the rollback notes and test rollback on a disposable environment.

## Supabase project checks

<!-- AGENT: DEVOPS -->

- [x] Confirm the target Supabase project and environment before running any command. (DevOps)
  - Evidence: `supabase projects list` showed linked project `People Management System (WIP)`, reference `kpajlysbaftnrrgjwvtr`, region `Southeast Asia (Singapore)`.
  - Evidence: `supabase migration list` showed local and remote migrations `001` through `030` aligned after applying migrations `025` through `030`.
- [ ] Take a database backup before applying migration `017` outside local development. (DevOps)
- [ ] Apply and validate migration `017` in staging before production. (DevOps)
- [x] Confirm production Site URL and allowed redirect URLs do not point to `localhost`. (DevOps)
  - Evidence: Confirmed by Jaeden on 2026-07-15 that the production Site URL and allowed redirect URLs do not point to `localhost`.
- [x] Confirm invitation and authentication links redirect to the deployed application domain.
- [ ] Confirm SMTP credentials and sender-domain verification are configured in the deployment environment. (DevOps)
- [x] Confirm `SMTP_HOST`, `SMTP_PORT`, `BREVO_SMTP_USER`, and `BREVO_SMTP_KEY` are documented and present where required.
- [x] Confirm the `payment-proofs` bucket is private and accepts only the intended image MIME types and size limits.
- [x] Verify Storage policies prevent cross-church reads and writes.
- [x] Verify a payment-proof object must exist under the expected church/event path before registration succeeds.
- [x] Review RLS policies for:
  - `churches`
  - `church_memberships`
  - `people`
  - `event_registrations`
  - `person_events`
  - `invitations`
  - `platform_admins`
- [x] Verify ordinary authenticated users cannot invoke service-role-only RPCs.
- [x] Verify an admin from one church cannot read or approve another church's registration.
- [x] Verify platform-admin membership is intentional and limited to approved accounts.
- [ ] Confirm logs and dashboards exist for failed registrations, failed approvals, stuck email claims, and SMTP errors. (DevOps)

## Integration-test validation

<!-- AGENT: INTEGRATION -->

- [x] Confirm test authentication uses real Supabase SSR cookies.
- [x] Assert every sign-in, insert, upload, update, and cleanup operation checks its returned error.
- [x] Confirm uploaded payment proofs use an allowed image content type.
- [x] Confirm teardown removes exact Storage object paths and all generated Auth users.
- [x] Add a timeout to every external wait: Supabase setup, Next.js startup, SMTP connections, and HTTP requests.
- [x] Capture spawned Next.js stdout/stderr and immediately fail if the child process exits.
- [x] Verify the transactional rollback test forces failure after person and `person_events` creation, then confirms both are rolled back.
- [x] Verify the identity-conflict test matches one person's email and another person's phone.
- [x] Verify concurrent final-seat registrations cannot exceed capacity.
- [x] Verify concurrent approval creates exactly one `person_events` row.
- [x] Verify concurrent SMTP attempts produce one delivery during the active claim lease.
- [x] Verify an expired claim permits a retry.
- [x] Verify an SMTP failure releases the claim.
- [x] Verify missing SMTP configuration does not mark confirmation as sent.

## Frontend and user-flow review

<!-- AGENT: FRONTEND -->

- [ ] Test event registration at mobile, tablet, and desktop widths.
- [ ] Confirm all dialogs fit within the viewport without horizontal scrolling.
- [ ] Confirm long names, email addresses, event names, and validation messages wrap correctly.
- [ ] Confirm keyboard focus is trapped inside dialogs and restored when they close.
- [ ] Confirm registration states are understandable: submitting, pending review, approved, rejected, full, closed, and retryable error.
- [ ] Confirm free-event identity conflicts display the manual-review message.
- [ ] Confirm paid-event proof upload errors are visible and actionable.
- [ ] Confirm admin approval/rejection controls prevent duplicate submissions.
- [ ] Confirm invited users can complete their own profile without requiring an existing profile.
- [ ] Test owner, admin, member, invited-user, and unauthenticated-user flows independently.

## Security review

- [x] Attempt payment-proof path reuse and cross-event/cross-church proof substitution.
  - Evidence: `npm run test:integration:events` passed on branch `test/payment-proof-substitution-audit`; includes `Payment proof substitution is blocked across events and churches`.
- [x] Attempt tenant-ID and registration-ID tampering through the browser and direct HTTP requests.
  - Evidence: `npm run test:integration:events` passed on branch `test/tenant-id-tampering-audit`; includes `Cross-tenant registration ID tampering is blocked`.
- [x] Verify public endpoints have a production-grade distributed rate limit.
  - Evidence: `npm run verify` passed on branch `feat/distributed-public-rate-limit`; includes `Public event registration is rate limited per event and IP`.
- [x] Verify error responses do not expose SQL, storage paths, credentials, or internal stack traces.
  - Evidence: `npm run test:integration:events` passed on branch `fix/sanitize-public-errors`; includes `Public event endpoints return generic errors for malformed request bodies`.
- [x] Verify email HTML safely handles user-controlled and event-controlled text.
  - Evidence: `npm run verify` passed on branch `fix/escape-event-email-html`; includes `Confirmation emails escape registration and event HTML`.
- [x] Verify audit records identify who approved or rejected each registration.
  - Evidence: `npm run verify` passed on branch `test/registration-final-state-integrity`; includes `Approval and rejection audit logs identify the reviewer`.
- [x] Verify rejected registrations release capacity as intended.
  - Evidence: `npm run verify` passed on branch `test/registration-final-state-integrity`; includes `Rejected registrations release event capacity`.
- [x] Verify approved registrations cannot be moved back to pending or rejected through direct database/API calls.
  - Evidence: `npm run verify` passed on branch `test/registration-final-state-integrity`; includes `Approved registrations cannot return to pending or rejected`.

## Release gate

Do not deploy migration `017` or release the event-registration changes until all of the following are complete:

- [ ] Clean `supabase db reset` passes.
- [ ] Full event integration suite passes without hangs, retries, or manual interruption.
- [ ] Typecheck, lint, build, and `git diff --check` pass.
- [ ] Staging duplicate-proof preflight returns zero rows.
- [ ] Staging migration and rollback review are complete.
- [ ] Supabase redirect URLs, SMTP, Storage policies, and RLS are verified.
- [ ] Owner, admin, member, invited-user, and public registration smoke tests pass.
- [ ] Two reviewers approve: one backend/database reviewer and one frontend/integration reviewer.
