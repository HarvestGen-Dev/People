# Private People-Photo Migration

<!-- AGENT: ARCHITECT -->
<!-- AGENT: BACKEND -->
<!-- AGENT: DEVOPS -->

## Target Model

New people photos are stored in the private `people-photos` Supabase Storage
bucket. The database stores only `people.photo_path` in this format:

```text
{church_id}/{person_id}/{generated_uuid}.webp
```

Signed URLs are generated only after server-side authorization, expire after
10 minutes, and are never stored by the migration tooling.

## Operator Tool

Use:

```bash
npm run people-photos:migrate -- <command> --project-ref <project-ref>
```

Supported commands are:

- `inventory`: read-only, count-only, and the default command.
- `dry-run --church-id <uuid>`: validates one tenant without database or
  Storage writes.
- `migrate --church-id <uuid> --confirm`: writes one selected local tenant.
- `migrate --church-id <uuid> --confirm --allow-remote`: writes one explicitly
  selected remote tenant.
- `verify --church-id <uuid>`: verifies database state, object hashes, WebP
  metadata, and the protected checkpoint.
- `rollback-plan --church-id <uuid>`: reports rollback readiness without
  changing database or Storage state.

Every command requires an explicit project reference. The tool validates that
the reference matches the configured Supabase URL. Remote write mode requires
both `--confirm` and `--allow-remote`; all-tenant writes are rejected.

See [PEOPLE_PHOTO_MIGRATION_RUNBOOK.md](./PEOPLE_PHOTO_MIGRATION_RUNBOOK.md)
for the complete pilot procedure.

## Inventory

The default command reads the existing service-role-only
`people_photo_reference_inventory` view. Output contains tenant IDs and counts
only. It does not include church names, person identity, URLs, or Storage paths.

The categories remain:

- `private_photo_path`
- `empty`
- `legacy_public_people_photos_url`
- `legacy_storage_path`
- `external_url`
- `malformed_or_unknown`

The count view remains the inventory source of truth. Tenant dry-run performs a
second, stricter per-record check before planning a migration. It validates the
configured Supabase origin and exact church/person path ownership. A value
counted as `malformed_or_unknown` is never migrated merely because it resembles
a path; it must pass the strict dry-run checks or remain manual review.

## Processing and Verification

The tool uses the same image processor as normal admin uploads:

- Maximum compressed input: 5 MB.
- Maximum input width and height: 4096 px.
- Maximum decoded pixels: 16 million.
- Accepted decoded formats: JPEG, PNG, and WebP.
- Animated and multi-page images are rejected.
- Orientation is normalized.
- Metadata is stripped by re-encoding.
- Output is WebP, constrained to 1024 px, at quality 82.

For an eligible record the tool:

1. Resolves the legacy object without using a public or signed URL.
2. Confirms exact tenant/person ownership.
3. Downloads through the service-role Storage client.
4. Decodes and re-encodes with the shared processor.
5. Creates a new generated tenant/person-scoped path.
6. Uploads without overwrite.
7. Downloads the destination and verifies its SHA-256 and WebP metadata.
8. Conditionally updates the same tenant/person row only if the legacy
   reference has not changed.
9. Sets `photo_path` and clears `photo_url`.
10. Leaves the source object unchanged.

Any download, decode, upload, verification, or database conflict leaves the
legacy database reference unchanged. A newly uploaded destination may remain
as a resumable checkpoint after a database failure, but the original object is
never deleted.

## Recovery State and Audit

Migration creates two files outside the repository:

- A protected `0600` recovery state containing the minimum Storage references
  needed for resume and rollback review.
- A `0600` PII-free JSONL audit containing hashed references, category,
  outcome, operation ID, tenant ID, and sanitized error code.

The audit contains no names, email addresses, phone numbers, URLs, object
paths, signed URLs, or credentials. The recovery state is operationally
sensitive and must be backed up with the pilot evidence, never committed, and
removed only after the rollback window closes.

Pass the same `--state-file` to resume an interrupted run. If omitted during a
new migration, the tool creates a protected checkpoint under:

```text
~/.local/state/people-hg-photo-migration/
```

## Unsupported Values

These outcomes remain manual review and are never migrated automatically:

- External URLs.
- Malformed or unknown values.
- Public URLs from an unexpected origin.
- URLs containing credentials, query strings, or fragments.
- Missing or unreadable objects.
- Invalid or oversized image content.
- Cross-tenant or unscoped paths.
- Existing invalid private paths.
- Source references that changed after checkpoint creation.

Request a fresh upload from an authorized administrator when ownership or image
integrity cannot be proven.

## Rollback

`rollback-plan` is deliberately read-only. It confirms that:

- The migrated database row still references the verified destination.
- `photo_url` remains cleared.
- The original legacy source still exists.
- The destination still matches the recorded hash.

The tool does not automatically clear `photo_path`, restore a legacy reference,
delete a destination, or reopen the bucket. A rollback must be reviewed using
the protected checkpoint and current database backup. Preserve both source and
destination objects during the rollback window.

Legacy fallback support remains in the application until every tenant is
inventoried, migrated or manually resolved, verified, and monitored.
