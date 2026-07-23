# Production Storage Inventory and Export Plan

<!-- AGENT: DEVOPS -->
<!-- AGENT: BACKEND -->

## Scope

PostgreSQL backups contain `storage.buckets` and `storage.objects` metadata but
not object bytes. Inventory every bucket and export every non-empty bucket. The
known private buckets are:

- `people-photos`
- `payment-proofs`

Both buckets must remain private. The known public asset buckets are
`event-covers` and `payment-qr`. Do not change bucket policy, create new public
access, or copy service-role credentials into client code.

## Safety controls

1. Run from an operator-controlled machine, never Vercel or a browser.
2. Require an explicit production project ref and refuse any other project.
3. Read service credentials from the operator environment without printing
   them, request headers, signed URLs, or connection strings.
4. Default to inventory-only mode. Require a separate `--export` confirmation.
5. Keep object paths and manifests encrypted because paths may contain opaque
   tenant and person identifiers.
6. Use a restrictive temporary directory outside the repository. Encrypt and
   verify every archive before removing all plaintext.
7. Do not send email, invoke webhooks, run cron routes, mutate metadata, or
   delete source objects.

## Inventory procedure

1. List every bucket through the service-role Storage API with bounded pages.
2. Record bucket privacy, limits, MIME restrictions, counts, bytes, and bounded
   timestamps without exposing object paths.
3. Record encrypted manifest entries containing bucket, exact path, size,
   content type, ETag/version where available, and retrieval outcome.
4. Compare the post-export API inventory with the encrypted baseline.
5. Stop on any count mismatch, pagination gap, size mismatch, or cross-bucket
   path anomaly.

The completed rehearsal is recorded in
`docs/PRODUCTION_STORAGE_BACKUP_REHEARSAL_2026-07-23.md`. It found one object in
`event-covers` and zero objects in the other three buckets.

## Export procedure

1. Create a new encrypted export directory outside the repository.
2. Store its encryption key separately with user-only permissions.
3. Download objects through authenticated Storage APIs in bounded batches.
4. Write every response into a restrictive temporary hierarchy that preserves
   exact object keys, then archive and encrypt it.
5. Record per-object plaintext SHA-256 inside the encrypted manifest and
   ciphertext/archive SHA-256 in a non-sensitive external checksum file.
6. Record object count, total bytes, failed count, archive size, completion
   timestamp, and operator identity without recording contact data.
7. Retry individual transient failures with a bounded attempt count. Never
   silently omit a failed object.
8. Refuse absolute paths, traversal paths, duplicate paths, or a destination
   inside the repository.

## Restore drill

1. Restore only into an approved disposable Supabase project or branch.
2. Keep SMTP, webhook, and cron secrets unset.
3. Recreate private buckets and policies from migrations before object upload.
4. Upload objects to their exact scoped paths without making buckets public.
5. Compare object counts, total bytes, and encrypted manifest checksums.
6. Verify owner/admin signed access and cross-tenant denial using synthetic
   accounts. Do not use real recipients or external integrations.
7. Remove synthetic access probes and all decrypted restoration files after
   validation.

## Completed rehearsal

On 2026-07-23, the production export used read-only Supabase Storage API calls.
Four bucket archives and encrypted JSON/CSV manifests passed SHA-256,
decryption, path-safety, count, size, and object-hash verification. The
disposable local restore used the Storage API and preserved bucket privacy and
configuration. Public access, private denial, signed access, and cross-tenant
denial passed. Production Storage and migration history remained unchanged.

The encrypted copy is outside Git but remains on the operator workstation. It
must still be copied to approved off-device storage before it qualifies as an
off-site recovery copy.

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
