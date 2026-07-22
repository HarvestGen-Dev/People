# Production Storage Inventory and Export Plan

<!-- AGENT: DEVOPS -->
<!-- AGENT: BACKEND -->

## Scope

PostgreSQL backups contain `storage.buckets` and `storage.objects` metadata but
not object bytes. Export these private buckets separately:

- `people-photos`
- `payment-proofs`

Both buckets must remain private. Do not change bucket policy, create public
URLs, or copy service-role credentials into client code.

## Safety controls

1. Run from an operator-controlled machine, never Vercel or a browser.
2. Require an explicit production project ref and refuse any other project.
3. Read service credentials from the operator environment without printing
   them, request headers, signed URLs, or connection strings.
4. Default to inventory-only mode. Require a separate `--export` confirmation.
5. Keep object paths and manifests encrypted because paths may contain opaque
   tenant and person identifiers.
6. Stream each object directly into an encrypted archive; do not retain a
   plaintext mirror.
7. Do not send email, invoke webhooks, run cron routes, mutate metadata, or
   delete source objects.

## Inventory procedure

1. Query aggregate bucket counts and bytes from `storage.objects` using a
   read-only database connection.
2. List each bucket through the service-role Storage API with bounded pages.
3. Record encrypted manifest entries containing bucket, exact path, size,
   content type, ETag/version where available, and retrieval outcome.
4. Compare API totals with database metadata totals.
5. Stop on any count mismatch, pagination gap, or cross-bucket path anomaly.

At logical-backup time, encrypted Storage metadata contained one object in
total. A fresh production inventory is still required before export; the
backup-time aggregate is not a substitute for listing both buckets.

## Export procedure

1. Create a new encrypted export directory outside the repository.
2. Store its encryption key separately with user-only permissions.
3. Download objects through authenticated Storage APIs in bounded batches.
4. Stream every response into the encrypted archive.
5. Record per-object plaintext SHA-256 inside the encrypted manifest and
   ciphertext/archive SHA-256 in a non-sensitive external checksum file.
6. Record object count, total bytes, failed count, archive size, completion
   timestamp, and operator identity without recording contact data.
7. Retry individual transient failures with a bounded attempt count. Never
   silently omit a failed object.

## Restore drill

1. Restore only into an approved disposable Supabase project or branch.
2. Keep SMTP, webhook, and cron secrets unset.
3. Recreate private buckets and policies from migrations before object upload.
4. Upload objects to their exact scoped paths without making buckets public.
5. Compare object counts, total bytes, and encrypted manifest checksums.
6. Verify owner/admin signed access and cross-tenant denial using synthetic
   accounts. Do not use real recipients or external integrations.
7. Delete the disposable environment after evidence review and retention
   approval.

## Completion evidence

Record only aggregate, PII-free evidence in the repository:

- inventory timestamp;
- bucket counts and total bytes;
- encrypted archive filename, size, and SHA-256;
- failed-object count;
- restore target and validation result;
- operator and reviewer approval.

Keep encrypted object manifests, object paths, signed URLs, and archive keys
outside Git.
