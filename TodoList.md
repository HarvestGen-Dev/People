# People HG — Verification Todo List

Use this document to coordinate the final review before deploying migration `017` or releasing the event-registration changes.

## Status legend

- `[ ]` Not started
- `[~]` In progress
- `[x]` Completed with evidence
- `[!]` Blocked

When completing an item, add the reviewer's name, date, and a link or short copy of the relevant test output. Do not mark an item complete based only on reading the code.

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
    supabase status
    npm run test:integration:events
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

- [ ] Confirm the target Supabase project and environment before running any command.
- [ ] Take a database backup before applying migration `017` outside local development.
- [ ] Apply and validate migration `017` in staging before production.
- [ ] Confirm production Site URL and allowed redirect URLs do not point to `localhost`.
- [ ] Confirm invitation and authentication links redirect to the deployed application domain.
- [ ] Confirm SMTP credentials and sender-domain verification are configured in the deployment environment.
- [ ] Confirm `SMTP_HOST`, `SMTP_PORT`, `BREVO_SMTP_USER`, and `BREVO_SMTP_KEY` are documented and present where required.
- [ ] Confirm the `payment-proofs` bucket is private and accepts only the intended image MIME types and size limits.
- [ ] Verify Storage policies prevent cross-church reads and writes.
- [ ] Verify a payment-proof object must exist under the expected church/event path before registration succeeds.
- [ ] Review RLS policies for:
  - `churches`
  - `church_memberships`
  - `people`
  - `event_registrations`
  - `person_events`
  - `invitations`
  - `platform_admins`
- [ ] Verify ordinary authenticated users cannot invoke service-role-only RPCs.
- [ ] Verify an admin from one church cannot read or approve another church's registration.
- [ ] Verify platform-admin membership is intentional and limited to approved accounts.
- [ ] Confirm logs and dashboards exist for failed registrations, failed approvals, stuck email claims, and SMTP errors.

## Integration-test validation

<!-- AGENT: INTEGRATION -->

- [ ] Confirm test authentication uses real Supabase SSR cookies.
- [ ] Assert every sign-in, insert, upload, update, and cleanup operation checks its returned error.
- [ ] Confirm uploaded payment proofs use an allowed image content type.
- [ ] Confirm teardown removes exact Storage object paths and all generated Auth users.
- [ ] Add a timeout to every external wait: Supabase setup, Next.js startup, SMTP connections, and HTTP requests.
- [ ] Capture spawned Next.js stdout/stderr and immediately fail if the child process exits.
- [ ] Verify the transactional rollback test forces failure after person and `person_events` creation, then confirms both are rolled back.
- [ ] Verify the identity-conflict test matches one person's email and another person's phone.
- [ ] Verify concurrent final-seat registrations cannot exceed capacity.
- [ ] Verify concurrent approval creates exactly one `person_events` row.
- [ ] Verify concurrent SMTP attempts produce one delivery during the active claim lease.
- [ ] Verify an expired claim permits a retry.
- [ ] Verify an SMTP failure releases the claim.
- [ ] Verify missing SMTP configuration does not mark confirmation as sent.

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

- [ ] Attempt tenant-ID and registration-ID tampering through the browser and direct HTTP requests.
- [ ] Attempt payment-proof path reuse and cross-event/cross-church proof substitution.
- [ ] Verify public endpoints have a production-grade distributed rate limit; the current in-memory limiter resets on deployment and is not shared between instances.
- [ ] Verify error responses do not expose SQL, storage paths, credentials, or internal stack traces.
- [ ] Verify email HTML safely handles user-controlled and event-controlled text.
- [ ] Verify audit records identify who approved or rejected each registration.
- [ ] Verify rejected registrations release capacity as intended.
- [ ] Verify approved registrations cannot be moved back to pending or rejected through direct database/API calls.

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

