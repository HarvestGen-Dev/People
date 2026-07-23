# People-Photo Migration Operator Runbook

<!-- AGENT: DEVOPS -->

This runbook is for an explicitly approved single-tenant pilot. It does not
authorize a production migration by itself.

## Prerequisites

1. Confirm the target project reference and environment.
2. Confirm a current encrypted database backup and Storage export.
3. Confirm the `people-photos` bucket is private.
4. Load `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from
   protected operator configuration.
5. Disable shell tracing with `set +x`.
6. Keep output and recovery files outside the repository.
7. Select one small tenant only after count-only inventory review.

Never paste credentials into a command or committed file.

## Count-Only Inventory

```bash
set +x
npm run people-photos:migrate -- \
  inventory \
  --project-ref <project-ref>
```

Review category counts only. Do not select a pilot based on names or raw
references. External, malformed, missing, and unsafe path cases require manual
review.

## Tenant Dry-Run

```bash
npm run people-photos:migrate -- \
  dry-run \
  --project-ref <project-ref> \
  --church-id <church-uuid> \
  --output "$HOME/people-hg-photo-pilot/dry-run.audit.jsonl"
```

Dry-run downloads and decodes eligible source objects but does not upload,
update, clear, or delete anything. Confirm:

- `eligible` is the expected small pilot count.
- Every unsupported outcome has an owner for manual review.
- Existing private references are skipped.
- Missing objects remain unresolved.
- The PII-free audit contains no URLs or object paths.

Use `--limit <number>` and `--resume-from <uuid>` for bounded review. The
resume identifier is an opaque database ID and must not be placed in committed
evidence.

## Pilot Migration

Take a fresh database and Storage backup immediately before the write.

Local rehearsal:

```bash
npm run people-photos:migrate -- \
  migrate \
  --project-ref local \
  --church-id <church-uuid> \
  --confirm
```

Approved remote pilot:

```bash
npm run people-photos:migrate -- \
  migrate \
  --project-ref <project-ref> \
  --church-id <church-uuid> \
  --confirm \
  --allow-remote
```

The command refuses missing tenant scope, all-tenant writes, project mismatch,
missing confirmation, and unconfirmed remote writes.

Record only aggregate outcomes in release evidence. Do not copy the protected
state, audit contents, URLs, paths, or person IDs into Git.

## Resume

An interrupted migration can be resumed with the same checkpoint:

```bash
npm run people-photos:migrate -- \
  migrate \
  --project-ref <project-ref> \
  --church-id <church-uuid> \
  --confirm \
  --allow-remote \
  --state-file <protected-state-file> \
  --output <protected-audit-file>
```

The tool verifies any previously uploaded destination before continuing. A
record already migrated to the verified destination is reported as
`already_migrated`; no duplicate destination is created for that checkpoint.

## Verification

```bash
npm run people-photos:migrate -- \
  verify \
  --project-ref <project-ref> \
  --church-id <church-uuid> \
  --state-file <protected-state-file>
```

Then verify through the application:

1. Owner/admin people list renders the migrated photo.
2. Person profile renders the migrated photo.
3. A linked portal user can retrieve only their own photo.
4. Signed access succeeds and expires as expected.
5. Anonymous public access fails.
6. A user from another tenant cannot retrieve the person or photo.
7. The bucket remains private.
8. The original legacy object still exists.

Monitor Storage and application errors before selecting another tenant.

## Rollback Planning

```bash
npm run people-photos:migrate -- \
  rollback-plan \
  --project-ref <project-ref> \
  --church-id <church-uuid> \
  --state-file <protected-state-file>
```

`rollback-plan` performs no writes. Stop if any record reports source missing,
destination invalid, or database drift.

For an approved rollback:

1. Pause further photo migration.
2. Preserve the database backup, source objects, destination objects, and
   recovery checkpoint.
3. Review each affected row against the protected checkpoint.
4. Restore legacy fallback references only through a separately reviewed,
   tenant-scoped procedure.
5. Do not delete the destination automatically.
6. Do not make the bucket public.
7. Re-run application access checks.

## Stop Conditions

Stop the pilot immediately for:

- Project-reference mismatch.
- Tenant scope mismatch.
- Unexpected eligible count.
- Any cross-tenant or unscoped source.
- Source download or decode failure.
- Destination hash or metadata mismatch.
- Conditional database update conflict.
- Unexpected anonymous access.
- Missing original object.
- Credential, URL, object-path, or person-data exposure in console or evidence.

Do not remove legacy fallback support in the pilot PR.
