// <!-- AGENT: INTEGRATION -->
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { after, before, test } from 'node:test';
import dotenv from 'dotenv';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import ws from 'ws';
import {
  PhotoMigrationError,
  runDryRun,
  runInventory,
  runMigration,
  runRollbackPlan,
  runVerification,
  validateCommandOptions,
  validateProjectBinding,
} from '../../scripts/lib/people-photo-migration.mjs';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!supabaseUrl || !serviceRoleKey || !anonKey) {
  throw new Error('Local Supabase test configuration is missing.');
}
const hostname = new URL(supabaseUrl).hostname;
if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
  throw new Error('People-photo migration tests refuse to run against remote Supabase.');
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch },
  realtime: { transport: ws },
});
const anon = createClient(supabaseUrl, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch },
  realtime: { transport: ws },
});

const suffix = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
const projectRef = 'local';
const churchIds = [];
const storagePaths = new Set();
let workspace;
let mainChurchId;
let otherChurchId;
let uploadFailureChurchId;
let verificationFailureChurchId;
let successPersonId;
let missingPersonId;
let externalPersonId;
let malformedPersonId;
let crossTenantPersonId;
let existingPersonId;
let uploadFailurePersonId;
let verificationFailurePersonId;
let successSourcePath;
let successPublicUrl;
let uploadFailureSourcePath;
let verificationFailureSourcePath;
let crossTenantSourcePath;
let existingPath;
let mainStateFile;
let mainAuditFile;

async function createChurch(label) {
  const { data, error } = await admin
    .from('churches')
    .insert({
      slug: `photo-tool-${label}-${suffix}`,
      name: `Synthetic photo tooling ${label} ${suffix}`,
    })
    .select('id')
    .single();
  if (error) throw error;
  churchIds.push(data.id);
  return data.id;
}

async function createPerson(churchId, label) {
  const { data, error } = await admin
    .from('people')
    .insert({
      church_id: churchId,
      first_name: 'Synthetic',
      last_name: label,
      email: `${label}-${suffix}@test.invalid`,
      status: 'visitor',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function syntheticWebp() {
  return sharp({
    create: {
      width: 40,
      height: 30,
      channels: 3,
      background: { r: 25, g: 105, b: 145 },
    },
  })
    .webp()
    .toBuffer();
}

async function uploadSource(objectPath) {
  const { error } = await admin.storage
    .from('people-photos')
    .upload(objectPath, await syntheticWebp(), {
      contentType: 'image/webp',
      upsert: false,
    });
  if (error) throw error;
  storagePaths.add(objectPath);
}

async function updatePhotoReference(personId, values) {
  const { error } = await admin
    .from('people')
    .update(values)
    .eq('id', personId);
  if (error) throw error;
}

async function personPhotoRow(personId) {
  const { data, error } = await admin
    .from('people')
    .select('photo_url, photo_path')
    .eq('id', personId)
    .single();
  if (error) throw error;
  return data;
}

async function stateDestinationPaths() {
  const paths = [];
  const files = await fs.readdir(workspace).catch(() => []);
  for (const file of files.filter((name) => name.endsWith('.state.json'))) {
    const state = JSON.parse(await fs.readFile(path.join(workspace, file), 'utf8'));
    for (const record of Object.values(state.records ?? {})) {
      if (record.destination_path) paths.push(record.destination_path);
    }
  }
  return paths;
}

before(async () => {
  workspace = await fs.mkdtemp(path.join(os.tmpdir(), 'people-photo-tooling-'));
  await fs.chmod(workspace, 0o700);

  mainChurchId = await createChurch('main');
  otherChurchId = await createChurch('other');
  uploadFailureChurchId = await createChurch('upload-failure');
  verificationFailureChurchId = await createChurch('verification-failure');

  successPersonId = await createPerson(mainChurchId, 'success');
  missingPersonId = await createPerson(mainChurchId, 'missing');
  externalPersonId = await createPerson(mainChurchId, 'external');
  malformedPersonId = await createPerson(mainChurchId, 'malformed');
  crossTenantPersonId = await createPerson(mainChurchId, 'cross-tenant');
  existingPersonId = await createPerson(mainChurchId, 'existing');
  uploadFailurePersonId = await createPerson(
    uploadFailureChurchId,
    'upload-failure'
  );
  verificationFailurePersonId = await createPerson(
    verificationFailureChurchId,
    'verification-failure'
  );

  successSourcePath = `${mainChurchId}/${successPersonId}/legacy.webp`;
  await uploadSource(successSourcePath);
  const { data: publicUrlData } = admin.storage
    .from('people-photos')
    .getPublicUrl(successSourcePath);
  successPublicUrl = publicUrlData.publicUrl;
  await updatePhotoReference(successPersonId, {
    photo_url: successPublicUrl,
    photo_path: null,
  });

  await updatePhotoReference(missingPersonId, {
    photo_url: `${mainChurchId}/${missingPersonId}/missing.webp`,
    photo_path: null,
  });
  await updatePhotoReference(externalPersonId, {
    photo_url: 'https://example.invalid/synthetic-photo.webp',
    photo_path: null,
  });
  await updatePhotoReference(malformedPersonId, {
    photo_url: 'not-a-valid-photo-reference',
    photo_path: null,
  });
  crossTenantSourcePath =
    `${otherChurchId}/${crossTenantPersonId}/wrong-tenant.webp`;
  await updatePhotoReference(crossTenantPersonId, {
    photo_url: crossTenantSourcePath,
    photo_path: null,
  });

  existingPath = `${mainChurchId}/${existingPersonId}/existing.webp`;
  await uploadSource(existingPath);
  await updatePhotoReference(existingPersonId, {
    photo_url: null,
    photo_path: existingPath,
  });

  uploadFailureSourcePath =
    `${uploadFailureChurchId}/${uploadFailurePersonId}/legacy.webp`;
  await uploadSource(uploadFailureSourcePath);
  await updatePhotoReference(uploadFailurePersonId, {
    photo_url: uploadFailureSourcePath,
    photo_path: null,
  });

  verificationFailureSourcePath =
    `${verificationFailureChurchId}/${verificationFailurePersonId}/legacy.webp`;
  await uploadSource(verificationFailureSourcePath);
  await updatePhotoReference(verificationFailurePersonId, {
    photo_url: verificationFailureSourcePath,
    photo_path: null,
  });

  mainStateFile = path.join(workspace, 'main.state.json');
  mainAuditFile = path.join(workspace, 'main.audit.jsonl');
});

after(async () => {
  for (const objectPath of await stateDestinationPaths()) {
    storagePaths.add(objectPath);
  }
  if (storagePaths.size > 0) {
    const { error } = await admin.storage
      .from('people-photos')
      .remove([...storagePaths]);
    if (error) throw error;
  }
  for (const churchId of churchIds) {
    const { error } = await admin.from('churches').delete().eq('id', churchId);
    if (error) throw error;
  }
  await fs.rm(workspace, { recursive: true, force: true });
});

test('count-only inventory and command guards expose no photo references', async () => {
  const inventory = await runInventory({ client: admin, projectRef });
  const church = inventory.churches.find((item) => item.church_id === mainChurchId);
  assert.ok(church);
  assert.deepEqual(church.categories, {
    private_photo_path: 1,
    empty: 0,
    legacy_public_people_photos_url: 1,
    legacy_storage_path: 0,
    external_url: 1,
    malformed_or_unknown: 3,
  });

  const serialized = JSON.stringify(inventory);
  assert.equal(serialized.includes(successPublicUrl), false);
  assert.equal(serialized.includes(successSourcePath), false);
  assert.deepEqual(
    Object.keys(church).sort(),
    ['categories', 'church_id', 'total']
  );

  assert.throws(
    () =>
      validateCommandOptions('migrate', {
        churchId: undefined,
        confirm: true,
        isRemote: false,
      }),
    (error) =>
      error instanceof PhotoMigrationError && error.code === 'church_id_required'
  );
  assert.throws(
    () =>
      validateCommandOptions('migrate', {
        churchId: 'all',
        confirm: true,
        isRemote: true,
        allowRemote: true,
      }),
    (error) =>
      error instanceof PhotoMigrationError &&
      error.code === 'all_tenant_write_rejected'
  );
  assert.throws(
    () =>
      validateCommandOptions('migrate', {
        churchId: mainChurchId,
        confirm: true,
        isRemote: true,
        allowRemote: false,
      }),
    (error) =>
      error instanceof PhotoMigrationError &&
      error.code === 'remote_write_not_confirmed'
  );
  assert.deepEqual(
    validateProjectBinding({ projectRef: 'local', supabaseUrl }),
    { isRemote: false }
  );
});

test('dry-run is read-only and classifies unsupported or unsafe references', async () => {
  const before = await Promise.all([
    personPhotoRow(successPersonId),
    personPhotoRow(missingPersonId),
    personPhotoRow(externalPersonId),
    personPhotoRow(malformedPersonId),
    personPhotoRow(crossTenantPersonId),
    personPhotoRow(existingPersonId),
  ]);
  const dryRunAudit = path.join(workspace, 'dry-run.audit.jsonl');
  const result = await runDryRun({
    client: admin,
    projectRef,
    churchId: mainChurchId,
    supabaseUrl,
    auditFile: dryRunAudit,
  });
  const afterRows = await Promise.all([
    personPhotoRow(successPersonId),
    personPhotoRow(missingPersonId),
    personPhotoRow(externalPersonId),
    personPhotoRow(malformedPersonId),
    personPhotoRow(crossTenantPersonId),
    personPhotoRow(existingPersonId),
  ]);

  assert.deepEqual(afterRows, before);
  assert.equal(result.plan.eligible, 1);
  assert.equal(result.plan.manual_missing_object, 1);
  assert.equal(result.plan.manual_external_url, 1);
  assert.equal(result.plan.manual_malformed_or_unknown, 1);
  assert.equal(result.plan.manual_cross_tenant_or_unscoped_path, 1);
  assert.equal(result.plan.skip_existing_private, 1);

  const audit = await fs.readFile(dryRunAudit, 'utf8');
  assert.equal(audit.includes(successPublicUrl), false);
  assert.equal(audit.includes(successSourcePath), false);
  assert.match(audit, /"source_reference_hash":"[0-9a-f]{64}"/);
});

test('upload and verification failures preserve database and legacy objects', async () => {
  const uploadState = path.join(workspace, 'upload-failure.state.json');
  const uploadAudit = path.join(workspace, 'upload-failure.audit.jsonl');
  const uploadResult = await runMigration({
    client: admin,
    projectRef,
    churchId: uploadFailureChurchId,
    supabaseUrl,
    confirm: true,
    stateFile: uploadState,
    auditFile: uploadAudit,
    testHooks: {
      upload: async () => ({ error: { code: 'synthetic_upload_failure' } }),
    },
  });
  assert.equal(uploadResult.outcomes.upload_failed, 1);
  assert.deepEqual(await personPhotoRow(uploadFailurePersonId), {
    photo_url: uploadFailureSourcePath,
    photo_path: null,
  });
  const originalAfterUploadFailure = await admin.storage
    .from('people-photos')
    .download(uploadFailureSourcePath);
  assert.equal(originalAfterUploadFailure.error, null);

  const verificationState = path.join(
    workspace,
    'verification-failure.state.json'
  );
  const verificationAudit = path.join(
    workspace,
    'verification-failure.audit.jsonl'
  );
  const verificationResult = await runMigration({
    client: admin,
    projectRef,
    churchId: verificationFailureChurchId,
    supabaseUrl,
    confirm: true,
    stateFile: verificationState,
    auditFile: verificationAudit,
    testHooks: {
      verify: async () => ({
        ok: false,
        errorCode: 'synthetic_verification_failure',
      }),
    },
  });
  assert.equal(verificationResult.outcomes.verification_failed, 1);
  assert.deepEqual(await personPhotoRow(verificationFailurePersonId), {
    photo_url: verificationFailureSourcePath,
    photo_path: null,
  });
  const originalAfterVerificationFailure = await admin.storage
    .from('people-photos')
    .download(verificationFailureSourcePath);
  assert.equal(originalAfterVerificationFailure.error, null);

  const state = JSON.parse(await fs.readFile(verificationState, 'utf8'));
  const failedDestination =
    state.records[verificationFailurePersonId].destination_path;
  const removedDestination = await admin.storage
    .from('people-photos')
    .download(failedDestination);
  assert.ok(removedDestination.error);
});

test('successful migration is verified, resumable, private, and rollback-ready', async () => {
  const first = await runMigration({
    client: admin,
    projectRef,
    churchId: mainChurchId,
    supabaseUrl,
    confirm: true,
    stateFile: mainStateFile,
    auditFile: mainAuditFile,
  });
  assert.equal(first.outcomes.migrated, 1);
  assert.equal(first.outcomes.manual_missing_object, 1);
  assert.equal(first.outcomes.manual_external_url, 1);
  assert.equal(first.outcomes.manual_malformed_or_unknown, 1);
  assert.equal(first.outcomes.manual_cross_tenant_or_unscoped_path, 1);
  assert.equal(first.outcomes.skip_existing_private, 1);
  assert.deepEqual(await personPhotoRow(missingPersonId), {
    photo_url: `${mainChurchId}/${missingPersonId}/missing.webp`,
    photo_path: null,
  });
  assert.deepEqual(await personPhotoRow(externalPersonId), {
    photo_url: 'https://example.invalid/synthetic-photo.webp',
    photo_path: null,
  });
  assert.deepEqual(await personPhotoRow(malformedPersonId), {
    photo_url: 'not-a-valid-photo-reference',
    photo_path: null,
  });
  assert.deepEqual(await personPhotoRow(crossTenantPersonId), {
    photo_url: crossTenantSourcePath,
    photo_path: null,
  });
  assert.deepEqual(await personPhotoRow(existingPersonId), {
    photo_url: null,
    photo_path: existingPath,
  });

  const migrated = await personPhotoRow(successPersonId);
  assert.equal(migrated.photo_url, null);
  assert.match(
    migrated.photo_path,
    new RegExp(`^${mainChurchId}/${successPersonId}/[0-9a-f-]+\\.webp$`)
  );
  storagePaths.add(migrated.photo_path);

  const original = await admin.storage
    .from('people-photos')
    .download(successSourcePath);
  assert.equal(original.error, null);
  const destination = await admin.storage
    .from('people-photos')
    .download(migrated.photo_path);
  assert.equal(destination.error, null);
  assert.equal(destination.data.type, 'image/webp');

  const repeated = await runMigration({
    client: admin,
    projectRef,
    churchId: mainChurchId,
    supabaseUrl,
    confirm: true,
    stateFile: mainStateFile,
    auditFile: mainAuditFile,
  });
  assert.equal(repeated.outcomes.already_migrated, 1);
  assert.deepEqual(await personPhotoRow(successPersonId), migrated);

  const verification = await runVerification({
    client: admin,
    projectRef,
    churchId: mainChurchId,
    stateFile: mainStateFile,
  });
  assert.equal(verification.outcomes.verified, 1);

  const rollback = await runRollbackPlan({
    client: admin,
    projectRef,
    churchId: mainChurchId,
    stateFile: mainStateFile,
  });
  assert.equal(rollback.outcomes.rollback_ready, 1);
  assert.equal(rollback.automatic_rollback_performed, false);

  const { data: signed, error: signedError } = await admin.storage
    .from('people-photos')
    .createSignedUrl(migrated.photo_path, 60);
  assert.equal(signedError, null);
  const signedResponse = await fetch(signed.signedUrl);
  assert.equal(signedResponse.status, 200);

  const { data: publicData } = anon.storage
    .from('people-photos')
    .getPublicUrl(migrated.photo_path);
  const anonymousResponse = await fetch(publicData.publicUrl);
  assert.notEqual(anonymousResponse.status, 200);

  const audit = await fs.readFile(mainAuditFile, 'utf8');
  assert.equal(audit.includes(successPublicUrl), false);
  assert.equal(audit.includes(successSourcePath), false);
  assert.equal(audit.includes(migrated.photo_path), false);
  const stateMode = (await fs.stat(mainStateFile)).mode & 0o777;
  const auditMode = (await fs.stat(mainAuditFile)).mode & 0o777;
  assert.equal(stateMode, 0o600);
  assert.equal(auditMode, 0o600);
});
