# Production Operational Observability

<!-- AGENT: DEVOPS -->
<!-- AGENT: BACKEND -->
<!-- AGENT: ARCHITECT -->

## Scope and access

Owners, administrators, and platform administrators with a selected church can
open `/developer/operations`. Every summary is explicitly scoped to that
church. Workflow managers, pastoral users, staff, viewers, legacy members,
portal users, and anonymous users cannot access the page. The browser never
receives a service-role credential and cannot execute the summary functions.

The page loads four independent service-role RPCs. If one fails, that section
is **Unavailable**, not healthy. Data is read on each Server Component render;
there is no client polling or raw-log browser endpoint.

## Operational inventory

| Workflow | Success | Retry or waiting | Terminal/technical failure | Durable evidence | Previous gap |
| --- | --- | --- | --- | --- | --- |
| Public registration | Registration row created | `pending_review` is a normal human queue | RPC or route failure | Registration plus PII-free technical incident | Technical failures were log-only |
| Approval/rejection | Approved/rejected row and audit log | Approval is idempotently retryable | Transaction, follow-up load, or rejection mutation failure | Business state plus unresolved incident | Technical review failures were log-only |
| Confirmation email | `confirmation_email_sent_at` | Unclaimed/expired approved row is eligible | SMTP rejection or send-marker failure | Claim state plus PII-free incident | Released claims erased SMTP failure history |
| Webhook | `delivered` | `pending`, `retry_scheduled`, leased `processing` | `permanently_failed` | `webhook_deliveries` | Required raw-row inspection |
| Missing-person pulse | Completed config/run history | One `skipped_locked` is expected | Failed/partial config or abandoned run | Pulse run/config tables | No combined admin surface |

An administrator rejection is a business outcome, not a technical failure. A
pending registration is a queue, not an incident. An email claim younger than
five minutes is normal. A webhook scheduled for retry remains recoverable. A
single pulse lock skip is normal concurrency control.

## Data model and security

Migration `048_production_operational_observability.sql` adds
`operational_incidents` only for failures that cannot be derived after the
business transaction finishes:

- `registration.submit.failed`
- `registration.approval.failed`
- `registration.rejection.failed`
- `email.send.failed`

Rows contain church ID, opaque resource/request IDs, severity, a bounded error
code, retryability, timestamps, and at most 4 KiB of scalar metadata. They do
not contain raw errors, names, email addresses, phone numbers, message bodies,
webhook payloads, notes, credentials, authorization headers, or Storage paths.
RLS is enabled. Access is revoked from `PUBLIC`, `anon`, and `authenticated`;
`service_role` alone can read and write.

Each failed retry creates a separate immutable incident occurrence so operators
can distinguish an isolated failure from a recurring one. A successful
approval, rejection, or confirmation send resolves all matching unresolved
incidents for that tenant, event, and opaque resource ID. Registration
submission failures without a durable registration remain historical
occurrences and are active only inside the bounded health window.

The schema does not automatically delete incidents. The expected operational
retention is 90 days; until a reviewed retention job is added, operators should
monitor table growth and preserve aggregate release evidence before any
tenant-scoped service-role archival or deletion. Do not delete unresolved
incidents merely to make the dashboard healthy. The
`(church_id, event_name, occurred_at)` index supports bounded history queries,
and a partial index with the same tenant/event/time ordering supports unresolved
incident scans. Resource-specific resolution remains tenant/event-scoped and
uses the bounded unresolved set. There is intentionally no uniqueness
constraint because separate retries are separate operational evidence.

The service-only tenant summaries are:

- `get_operational_registration_health`
- `get_operational_email_health`
- `get_operational_webhook_health`
- `get_operational_pulse_health`

Each uses `SECURITY DEFINER`, `search_path = ''`, schema-qualified references,
and explicit `p_church_id`. Complete database outages remain log-only because
no database incident write can survive unavailable PostgreSQL. Public failures
before tenant resolution are also log-only rather than assigned by guesswork.
Platform administrators must select an existing church through the platform
administration route before this page loads; the generic first-church fallback
is disabled for operational health.

## Health thresholds

All recent windows are 24 hours and seven days. Timestamps use `TIMESTAMPTZ`
and elapsed UTC time.

| Area | Warning | Critical |
| --- | --- | --- |
| Registrations | Any technical failure in 24h or oldest pending >=24h | >=3 review failures, >=5 submission failures in 24h, or pending >=72h |
| Email | Any stuck claim, SMTP failure, or eligible unsent confirmation | >=3 stuck claims or >=3 SMTP failures in 24h |
| Webhooks | Any retry/permanent failure or >=5 due deliveries | Any abandoned processing lease or >=3 unresolved permanent failures |
| Pulse | >=3 lock skips since the latest success in 24h, latest scoped failures, or partial newer than success | >=10 unsuperseded lock skips, abandoned run, or failure newer than success |

Unknown takes precedence in the overall result. A later successful webhook with
the same webhook/event identity supersedes an earlier permanent failure. A
successful confirmation send resolves its SMTP incident. Successful review
retries resolve the matching approval/rejection incident.

## Structured events and alert readiness

Server logs are one-line JSON. Filter by the exact `event` value:

| Event | Suggested condition | Immediate action | Escalate when |
| --- | --- | --- | --- |
| `registration.submit.failed` | Error, >=5/10m | Check DB/RPC and recent deploy | Multiple tenants or sustained 10m |
| `registration.approval.failed` | Error, >=3/10m | Inspect state by correlation ID | Retry fails or integrity is uncertain |
| `registration.rejection.failed` | Error, >=3/10m | Check update and RLS | Review remains blocked |
| `email.claim.stuck` | Warning, any observed | Confirm no approval is active | Claim remains beyond 10m |
| `email.send.failed` | Error, >=3/10m; config failure once | Verify SMTP and Brevo sender | Failure persists after correction |
| `email.send.completed` | Info, no alert | Correlate a prior failure | Not applicable |
| `webhook.delivery.retry_scheduled` | Warning, >=10/15m | Check endpoint and 429/5xx | Age exceeds backoff |
| `webhook.delivery.permanently_failed` | Error, any | Correct endpoint, then safe retry | Repeated or multiple endpoints |
| `webhook.worker.failed` | Error/critical, any | Check worker secret, RPC, DB | Next run also fails |
| `missing_persons.run.failed` | Error, any | Inspect sanitized history | No later success |
| `missing_persons.run.partial` | Warning, >=2/24h | Repair failed config | Same config repeats |
| `missing_persons.run.skipped_locked` | Warning, >=3/24h | Check scheduler overlap | No later success |
| `missing_persons.run.abandoned` | Critical, any | Confirm database session state | Row persists |
| `operational.summary.failed` | Error, any | Check migration, schema cache, and service role | Section remains unavailable |

Never include authorization headers, cookies, SMTP values, payloads, email
bodies, person contact data, or pastoral content in alerts. DNS failures,
receiver maintenance, and intentional concurrency tests are expected false
positives. Vercel alert and retention features vary by plan; this repository
does not claim these alerts are configured.

## Operator runbook

### Registration submission failed

Inspect `registration.submit.failed` by request ID, database health, and recent
deploys. Retry only after dependencies recover. Do not manually insert a
registration or copy payment-proof paths. Escalate across events or tenants.

### Approval or rejection failed

Inspect the structured event, registration state, audit log, and person-event
count. Retry the existing action. Do not rewrite status, linkage, or audit rows.
Escalate if state appears partial or a retry fails.

### Confirmation email was not sent

Check `email.send.failed`, Brevo sender/domain verification, and email health.
Retry through the existing approval flow. Do not mark the email sent manually.
Escalate after SMTP correction if sending still fails.

### Email claim appears stuck

Confirm it is older than the actual five-minute lease and no request is active.
A normal retry can reclaim it. Do not clear a live claim timestamp. Escalate
after ten minutes or when several claims accumulate.

### Webhook is retrying or permanently failed

Inspect destination health, status, attempt count, and next attempt in webhook
settings. Allow normal backoff or fix the receiver, then use the existing
single-delivery retry for a terminal row. Do not edit counters, payloads, or
states. Escalate repeated terminal failures.

### Pulse cron failed, skipped repeatedly, or remains running

Inspect aggregate/config history, scheduler overlap, and workflow steps. A run
older than 30 minutes is abandoned only after checking active sessions. Retry
with a new run ID after repair. Do not insert cards, rewrite provenance/history,
or release advisory locks manually. Escalate any abandoned row or no later
success.

### Operational dashboard is unavailable

Check the Server Component log, PostgREST schema cache, migration `048`, and the
service-role environment variable. Do not interpret unavailable as zero and do
not grant RPCs to browser roles. Escalate if schema reload and healthy database
access do not restore the section.

## Backup and restoration readiness

Use the backup capability included with the production Supabase plan and verify
the latest successful backup timestamp before release. Database backup does not
replace an object inventory/export for private `people-photos` and
`payment-proofs`. Never test restoration against production.

At least quarterly, restore into a disposable project and validate:

1. Auth IDs match memberships and portal links.
2. `tenant_relationship_complete_audit` is empty and composite FKs validate.
3. Private photos/payment proofs exist and signed access is tenant-scoped.
4. Workflow cards, provenance, registration states, and person events agree.
5. Pulse history and operational incidents remain service-role protected.
6. Core Playwright journeys pass against the restored environment.

The DevOps reviewer records backup timestamp, restore target, validation counts,
failures, and reviewer approval without including credentials or unnecessary
PII.

## Deployment and rollback

Back up first, apply migration `048` in staging, reload the PostgREST schema
cache, deploy, and exercise healthy/warning/critical summaries. Confirm
owner/admin access, restricted-role denial, structured events, and one success
for email, webhook, and pulse before production.

Rollback starts by disabling schedulers when job health is implicated. The
application can return to the prior release while retaining additive incidents
and summaries. To remove migration `048`, remove page usage first, then
revoke/drop its functions, indexes, and table after exporting needed evidence.
Never delete business rows as an observability rollback.

## Query performance

Summaries use tenant-leading predicates and bounded 24-hour/seven-day windows.
Migration `048` adds only missing indexes for registration status, unsent email
claims, webhook status, and incident event/time access. The page performs four
RPCs in parallel and renders no unbounded detail list. Capture
`EXPLAIN (ANALYZE, BUFFERS)` with realistic local data before release; do not run
performance experiments on production without database-owner approval.

Run the repeatable local benchmark with:

```bash
psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f tests/performance/operational-health.sql
```

The script inserts 500 synthetic registrations, 500 webhook deliveries, and
100 incidents inside one transaction, runs all four summaries with
`EXPLAIN (ANALYZE, BUFFERS)`, and rolls everything back.
