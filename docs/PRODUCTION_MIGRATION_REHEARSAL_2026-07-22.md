# Production Migration Rehearsal - 2026-07-22

<!-- AGENT: DEVOPS -->
<!-- AGENT: ARCHITECT -->

## Decision

Production migration is **not authorized** by this rehearsal. The production
project `kpajlysbaftnrrgjwvtr` remains at migrations `001` through `044`.
No production schema, data, schedules, functions, secrets, email, webhooks, or
cron jobs were mutated or invoked.

Release blockers:

1. Verify a current managed backup in Supabase Dashboard > Database > Backups.
2. Rotate the production database password. A Supabase CLI dump dry-run printed
   the credential to local diagnostic output; the value is not recorded here.
3. Complete an encrypted export of actual `people-photos` and `payment-proofs`
   Storage objects using `docs/STORAGE_BACKUP_EXPORT_PLAN.md`.
4. Provision a remote staging environment, or explicitly accept the reduced
   hosted-service coverage of the local rehearsal.
5. Obtain separate authorization before applying migration `045` to production.

## Environment discovery

- Repository baseline: `main` at `810a1d4`.
- Supabase project: `People Management System (WIP)`.
- Project role: production; it is the only project used by this application.
- Remote migration ledger: `001` through `044` applied.
- Pending production migrations: `045`, `046`, `047`, and `048`.
- Physical backup capability: WALG enabled; PITR disabled.
- CLI backup listing returned earliest/latest timestamps as `0`; therefore it
  did not prove that a restorable managed backup exists.
- Persistent branch creation was attempted without production data and failed
  with `402 entitlement_required`. No Supabase branch was created.

## Encrypted logical backup

The logical backup was streamed directly from Supabase CLI dump processes into
OpenSSL. No plaintext dump was retained. Encryption uses AES-256-CBC with salt,
PBKDF2, and 600,000 iterations. The passphrase is stored separately with mode
`0600`; it is not in the repository or backup directory.

Backup directory:

```text
~/people-hg-backups/production-kpajlysbaftnrrgjwvtr-20260722T075332Z
```

| Component | Bytes | SHA-256 |
| --- | ---: | --- |
| `roles.sql.enc` | 320 | `058d9b374932d4696efcba75697a51f08fde6d1f98e86a99c6fcc180cc226b1b` |
| `public-schema.sql.enc` | 197440 | `5f3250d1a07d0c0b10c85b9ad3985ea5f247131da474278007a6458c03d6f054` |
| `public-data.sql.enc` | 31680 | `6b4b8f908031d4ac828011a6fa4586ba8937e201c4c4569601571ba416ba86ea` |
| `auth-data.sql.enc` | 23120 | `18be0e2e2b84196f77072fdcb056ef8db2dc4ceed252d1e2f4a4fdcfe476887b` |
| `storage-metadata.sql.enc` | 3680 | `b3ea02fed77c056e905bd84a3b7abf75cb2988dafeca9a1ac3bafc1780522566` |
| `migration-history.sql.enc` | 216352 | `375480ee0d728f7f62524d86dbb64da03f276455e5a70786bb934b9479d97fa2` |

`SHA256SUMS` and `FILE-SIZES.txt` are stored beside the encrypted components.
All six checksums verified and all six files decrypted successfully to
`/dev/null` with the separate passphrase.

The logical backup includes database roles, the public schema, public data,
Auth data, Storage metadata, and `supabase_migrations.schema_migrations`. It
does not contain the binary Storage objects.

## Production-shaped restore

Because remote branching is unavailable and a billable project was not
authorized, the disposable environment was the isolated local Supabase stack.
It was reset to migration `044` without seed data. Encrypted Auth data, Storage
metadata, and public data were streamed directly into the local database.
Roles, schema, and migration-history components were integrity-checked but not
reapplied over Supabase-managed local equivalents.

Aggregate backup-time shape restored locally:

| Metric | Count |
| --- | ---: |
| Churches | 4 |
| People | 10 |
| Auth users | 5 |
| Storage metadata objects | 1 |
| Workflow cards | 0 |
| Pulse configurations | 0 |
| Webhooks | 0 |

No production email, webhook, or cron integration could execute from this
shape. Application verification used local Supabase, local Mailpit, synthetic
`@test.invalid` identities, and test-owned HTTP endpoints.

## Tenant integrity rehearsal

The complete audit covered all 28 tenant relationships and returned zero
violations. All 28 existing composite tenant foreign keys were initially
`NOT VALID`, matching production migration state. After the zero audit, all 28
were validated successfully in the disposable database.

This validates the controlled production approach: audit first, then validate
constraints only when every relationship reports zero invalid rows.

## Migration rehearsal

The local migration ledger began at `044`. Migrations were applied separately;
an unrestricted `supabase db push` was not used.

1. Applied `045_missing_persons_pulse_observability.sql` only.
2. `missing_persons_pulse_existing_active_card_audit`: zero rows.
3. `missing_persons_pulse_active_duplicate_audit`: zero rows.
4. Applied `046_missing_persons_pulse_idempotency.sql`.
5. Applied `047_transactional_missing_persons_pulse.sql`.
6. Applied `048_production_operational_observability.sql`.
7. Reloaded the local PostgREST schema cache.
8. Confirmed migration history `001` through `048` aligned.

The pulse partial unique index exists and both duplicate audits remained empty
after verification. Migration `045` intentionally leaves its two legacy-row
checks and two provenance foreign keys `NOT VALID`; they enforce new writes but
require a separately approved validation step for existing production rows.

## Verification

| Command | Result |
| --- | --- |
| `supabase db lint --local --level warning --fail-on warning` | Passed; no schema errors |
| `npm run test:integration:missing-persons-cron` | Passed; 11 tests |
| `npm run test:integration:operational-observability` | Passed; 5 tests |
| `npm run verify` | Passed |
| Full integration suite | 73 passed |
| Playwright | 17 passed across desktop, mobile, and tablet projects |
| Production build | Passed |

The full suite covered registration, connect forms, people/workflow, portal and
role boundaries, tenant tampering, pulse locking/idempotency, operational
health, responsive registration, and production Server Component routes.

## Production sequence requiring approval

1. Verify and record a current managed backup timestamp in the Dashboard.
2. Rotate the production database password and re-link the CLI securely.
3. Confirm the encrypted logical backup and Storage export are recoverable.
4. Apply migration `045` only.
5. Run both service-role duplicate audits.
6. Stop if either audit returns any row; do not repair automatically.
7. Apply migration `046`.
8. Apply migration `047`.
9. Apply migration `048`.
10. Reload PostgREST schema cache.
11. Verify the compatible application deployment.
12. Run separately authorized, controlled production smoke tests.

## Residual risks

- No hosted staging environment exists, so hosted Auth/API/Storage configuration
  parity was not exercised.
- Managed backup recency is unverified.
- Actual Storage objects have not been exported or restoration-tested.
- AES-CBC encryption is paired with SHA-256 corruption checks but is not an
  authenticated archive format; move the backup and key to separate approved
  secure storage.
- The local verification suite creates synthetic pulse history; those rows are
  local-only and are not evidence of production cron execution.
