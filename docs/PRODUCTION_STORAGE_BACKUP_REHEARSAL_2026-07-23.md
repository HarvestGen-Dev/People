# Production Storage Backup Rehearsal - 2026-07-23

<!-- AGENT: DEVOPS -->
<!-- AGENT: BACKEND -->
<!-- AGENT: INTEGRATION -->

## Decision

The production Storage export and disposable local restoration test passed.
This work did not authorize or perform a production migration. Production
remained on migrations `001` through `044`, with `045` through `048` pending.

The encrypted artifacts are outside the repository on the operator workstation.
They are not yet an off-device backup. Copying them to approved encrypted
storage with separate credential custody remains a release blocker.

## Production inventory

Inventory timestamp: `20260723T014303Z` UTC.

| Bucket | Public | Objects | Bytes | File limit | Allowed MIME types |
| --- | --- | ---: | ---: | ---: | --- |
| `event-covers` | Yes | 1 | 12,559 | 5,242,880 | JPEG, PNG, WebP |
| `payment-proofs` | No | 0 | 0 | 5,242,880 | JPEG, PNG, WebP |
| `payment-qr` | Yes | 0 | 0 | 5,242,880 | JPEG, PNG, WebP |
| `people-photos` | No | 0 | 0 | 5,242,880 | WebP |

The linked Storage CLI and service-role Storage API both identified the same
four buckets. A bounded API listing recorded exact object metadata in encrypted
manifests. No object path, signed URL, or person identifier is in this report.

## Export and encryption

The export used read-only Supabase JavaScript Storage API list and download
operations. A single-object probe verified source direction and byte count
before the complete export. Downloads used a maximum of three attempts and
failed closed on missing objects, unsafe paths, duplicate paths, or size
mismatches.

Plaintext existed only in a `0700` temporary directory outside the repository.
Four bucket archives and two path-bearing manifests were encrypted with the
same proven AES-256-CBC, salted PBKDF2 process as the logical database backup.
The separate passphrase remained in protected credential storage with mode
`0600`.

Backup directory:

```text
~/people-hg-storage-backups/production-kpajlysbaftnrrgjwvtr-20260723T014303Z
```

| Encrypted artifact | Bytes |
| --- | ---: |
| `event-covers.tar.enc` | 24,096 |
| `payment-proofs.tar.enc` | 3,616 |
| `payment-qr.tar.enc` | 3,616 |
| `people-photos.tar.enc` | 3,616 |
| `storage-object-manifest.csv.enc` | 528 |
| `storage-object-manifest.json.enc` | 2,112 |

All six SHA-256 checks passed. Every artifact decrypted successfully. Archive
entries were rejected if absolute or traversal-capable, and the extracted file
set, byte count, and SHA-256 values matched the encrypted manifest. All
path-bearing plaintext, download, decryption, and restoration directories were
removed after verification.

## Disposable local restoration

The local Supabase stack was reset through migration `048`. No linked or remote
reset was used. Matching bucket privacy, file limits, and MIME restrictions
were confirmed before upload. Restored objects were uploaded through the local
Storage API, never through Docker volume internals.

| Bucket | Restored objects | Restored bytes | Access result |
| --- | ---: | ---: | --- |
| `event-covers` | 1 | 12,559 | Public read passed |
| `payment-proofs` | 0 | 0 | Private denial passed with a local synthetic probe |
| `payment-qr` | 0 | 0 | Public read passed with a local synthetic probe |
| `people-photos` | 0 | 0 | Private denial passed with a local synthetic probe |

The restored `event-covers` object matched its exported SHA-256. Empty-bucket
probes were removed after access testing. The people-photo integration suite
then passed all eight tests, including signed private retrieval, unauthorized
read denial, portal child scoping, and cross-tenant denial. Its first sandboxed
attempt was blocked by local-network `EPERM`; the permitted local-only rerun
passed `8/8`.

## Final production checks

- A second read-only Storage inventory exactly matched bucket names, privacy,
  object paths, object counts, and byte sizes from the encrypted manifest.
- Production remained at migrations `001` through `044`.
- No production object was uploaded, changed, moved, renamed, or deleted.
- No bucket setting, Storage policy, or Storage database row was changed.
- No S3 access key was generated, so temporary S3 credential cleanup was not
  applicable.
- No production email, webhook, or cron operation ran.

## Remaining blockers

1. Move the encrypted database and Storage backups to approved off-device
   storage, keeping encryption credentials separately controlled.
2. Verify and record the latest managed Supabase backup in the Dashboard.
3. Retain evidence according to an approved backup retention policy.
4. Obtain explicit production migration authorization before applying `045`.
5. Preserve the mandatory duplicate-audit pause between migrations `045` and
   `046`.

