// <!-- AGENT: BACKEND -->
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {
  generatePeoplePhotoPath,
  isTenantScopedPeoplePhotoPath,
  legacyPeoplePhotoPathFromUrl,
  processPeoplePhotoBuffer,
} from '../../src/lib/people/photo-processing.mjs';

export const PEOPLE_PHOTOS_BUCKET = 'people-photos';
export const INVENTORY_CATEGORIES = [
  'private_photo_path',
  'empty',
  'legacy_public_people_photos_url',
  'legacy_storage_path',
  'external_url',
  'malformed_or_unknown',
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[^/]+$/;
const PAGE_SIZE = 500;
const STATE_VERSION = 1;

export class PhotoMigrationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'PhotoMigrationError';
    this.code = code;
  }
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function nowIso() {
  return new Date().toISOString();
}

function increment(counts, key) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function safeErrorCode(error, fallback = 'operation_failed') {
  if (error instanceof PhotoMigrationError) return error.code;
  return fallback;
}

export function isLocalSupabaseUrl(supabaseUrl) {
  const hostname = new URL(supabaseUrl).hostname;
  return hostname === '127.0.0.1' || hostname === 'localhost';
}

export function validateProjectBinding({ projectRef, supabaseUrl }) {
  if (!projectRef) {
    throw new PhotoMigrationError(
      'project_ref_required',
      'An explicit --project-ref is required.'
    );
  }

  const url = new URL(supabaseUrl);
  if (isLocalSupabaseUrl(supabaseUrl)) {
    if (projectRef !== 'local') {
      throw new PhotoMigrationError(
        'project_ref_mismatch',
        'Local Supabase requires --project-ref local.'
      );
    }
    return { isRemote: false };
  }

  const expectedRef = url.hostname.endsWith('.supabase.co')
    ? url.hostname.slice(0, -'.supabase.co'.length)
    : null;
  if (!expectedRef || expectedRef !== projectRef) {
    throw new PhotoMigrationError(
      'project_ref_mismatch',
      'The explicit project reference does not match the configured Supabase URL.'
    );
  }

  return { isRemote: true };
}

export function validateCommandOptions(command, options) {
  const tenantCommands = new Set(['dry-run', 'migrate', 'verify', 'rollback-plan']);
  if (tenantCommands.has(command)) {
    if (options.churchId === 'all') {
      throw new PhotoMigrationError(
        'all_tenant_write_rejected',
        'All-tenant operations are not supported.'
      );
    }
    if (!options.churchId || !UUID_PATTERN.test(options.churchId)) {
      throw new PhotoMigrationError(
        'church_id_required',
        `${command} requires one explicit tenant UUID.`
      );
    }
  }

  if (command === 'migrate') {
    if (!options.confirm) {
      throw new PhotoMigrationError(
        'confirmation_required',
        'Migration requires the explicit --confirm flag.'
      );
    }
    if (options.isRemote && !options.allowRemote) {
      throw new PhotoMigrationError(
        'remote_write_not_confirmed',
        'Remote migration also requires --allow-remote.'
      );
    }
  }
}

export function classifyPhotoReference(row) {
  if (row.photo_path !== null && row.photo_path !== undefined) {
    return 'private_photo_path';
  }
  if (row.photo_url === null || row.photo_url === undefined || row.photo_url.trim() === '') {
    return 'empty';
  }
  if (row.photo_url.includes('/storage/v1/object/public/people-photos/')) {
    return 'legacy_public_people_photos_url';
  }
  if (LEGACY_PATH_PATTERN.test(row.photo_url)) {
    return 'legacy_storage_path';
  }
  if (/^https?:\/\//.test(row.photo_url)) {
    return 'external_url';
  }
  return 'malformed_or_unknown';
}

function resolveLegacySource(row, supabaseUrl) {
  const category = classifyPhotoReference(row);
  if (category === 'private_photo_path') {
    const valid = isTenantScopedPeoplePhotoPath(
      row.photo_path,
      row.church_id,
      row.id
    );
    return {
      category,
      outcome: valid ? 'skip_existing_private' : 'manual_invalid_private_path',
    };
  }
  if (category === 'empty') {
    return { category, outcome: 'skip_empty' };
  }
  if (category === 'external_url') {
    return { category, outcome: 'manual_external_url' };
  }
  if (category === 'malformed_or_unknown') {
    return { category, outcome: 'manual_malformed_or_unknown' };
  }

  let sourcePath = row.photo_url;
  if (category === 'legacy_public_people_photos_url') {
    let legacyUrl;
    try {
      legacyUrl = new URL(row.photo_url);
    } catch {
      return { category, outcome: 'manual_malformed_or_unknown' };
    }
    if (
      legacyUrl.origin !== new URL(supabaseUrl).origin ||
      legacyUrl.username ||
      legacyUrl.password ||
      legacyUrl.search ||
      legacyUrl.hash
    ) {
      return { category, outcome: 'manual_untrusted_legacy_url' };
    }
    sourcePath = legacyPeoplePhotoPathFromUrl(row.photo_url);
  }

  if (
    !sourcePath ||
    !isTenantScopedPeoplePhotoPath(sourcePath, row.church_id, row.id)
  ) {
    return { category, outcome: 'manual_cross_tenant_or_unscoped_path' };
  }

  return {
    category,
    outcome: 'eligible',
    sourcePath,
  };
}

function resourceRef(projectRef, churchId, personId) {
  return sha256(`${projectRef}:${churchId}:${personId}`);
}

function referenceHash(value) {
  return value ? sha256(value) : null;
}

function auditRecord({
  operationId,
  projectRef,
  churchId,
  personId,
  category,
  outcome,
  sourcePath,
  destinationPath,
  errorCode,
}) {
  return {
    timestamp: nowIso(),
    operation_id: operationId,
    project_ref: projectRef,
    church_id: churchId,
    resource_ref: resourceRef(projectRef, churchId, personId),
    category,
    outcome,
    source_reference_hash: referenceHash(sourcePath),
    destination_reference_hash: referenceHash(destinationPath),
    error_code: errorCode ?? null,
  };
}

function assertOutputOutsideRepository(filePath, repositoryRoot = process.cwd()) {
  const resolved = path.resolve(filePath);
  const root = path.resolve(repositoryRoot);
  if (resolved === root || resolved.startsWith(`${root}${path.sep}`)) {
    throw new PhotoMigrationError(
      'unsafe_output_path',
      'Migration state and audit files must be outside the repository.'
    );
  }
}

async function ensurePrivateParent(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true, mode: 0o700 });
  await fs.chmod(path.dirname(filePath), 0o700);
}

async function appendAudit(filePath, record) {
  if (!filePath) return;
  assertOutputOutsideRepository(filePath);
  await ensurePrivateParent(filePath);
  await fs.appendFile(filePath, `${JSON.stringify(record)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
  await fs.chmod(filePath, 0o600);
}

async function writeState(filePath, state) {
  assertOutputOutsideRepository(filePath);
  await ensurePrivateParent(filePath);
  const temporaryPath = `${filePath}.${crypto.randomUUID()}.tmp`;
  await fs.writeFile(
    temporaryPath,
    `${JSON.stringify({ ...state, updated_at: nowIso() }, null, 2)}\n`,
    { encoding: 'utf8', mode: 0o600 }
  );
  await fs.rename(temporaryPath, filePath);
  await fs.chmod(filePath, 0o600);
}

async function readState(filePath, { projectRef, churchId }) {
  assertOutputOutsideRepository(filePath);
  let state;
  try {
    state = JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw new PhotoMigrationError('state_read_failed', 'Recovery state could not be read.');
  }

  if (
    state.version !== STATE_VERSION ||
    state.project_ref !== projectRef ||
    state.church_id !== churchId ||
    typeof state.records !== 'object' ||
    state.records === null
  ) {
    throw new PhotoMigrationError(
      'state_scope_mismatch',
      'Recovery state does not match the selected project and tenant.'
    );
  }
  return state;
}

export function defaultMigrationPaths({ projectRef, churchId, operationId }) {
  const root = path.join(
    os.homedir(),
    '.local',
    'state',
    'people-hg-photo-migration',
    projectRef,
    churchId
  );
  return {
    stateFile: path.join(root, `${operationId}.state.json`),
    auditFile: path.join(root, `${operationId}.audit.jsonl`),
  };
}

async function assertTenantExists(client, churchId) {
  const { data, error } = await client
    .from('churches')
    .select('id')
    .eq('id', churchId)
    .maybeSingle();
  if (error) {
    throw new PhotoMigrationError('tenant_lookup_failed', 'Tenant lookup failed.');
  }
  if (!data) {
    throw new PhotoMigrationError('tenant_not_found', 'Selected tenant was not found.');
  }
}

async function listTenantPeople(client, churchId, { limit, resumeFrom } = {}) {
  const rows = [];
  let from = 0;

  while (true) {
    let query = client
      .from('people')
      .select('id, church_id, photo_url, photo_path')
      .eq('church_id', churchId)
      .order('id', { ascending: true });
    if (resumeFrom) query = query.gt('id', resumeFrom);
    const remaining = limit ? limit - rows.length : PAGE_SIZE;
    if (remaining <= 0) break;
    const pageSize = Math.min(PAGE_SIZE, remaining);
    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      throw new PhotoMigrationError(
        'people_lookup_failed',
        'Tenant photo references could not be loaded.'
      );
    }
    rows.push(...data);
    if (data.length < pageSize || (limit && rows.length >= limit)) break;
    from += pageSize;
  }

  return rows;
}

async function downloadObject(client, objectPath) {
  const { data, error } = await client.storage
    .from(PEOPLE_PHOTOS_BUCKET)
    .download(objectPath);
  if (error || !data) return { error: 'object_missing_or_unreadable' };
  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type,
  };
}

async function verifyObject(client, objectPath, expectedHash) {
  const downloaded = await downloadObject(client, objectPath);
  if ('error' in downloaded) return { ok: false, errorCode: downloaded.error };
  if (downloaded.contentType !== 'image/webp') {
    return { ok: false, errorCode: 'object_content_type_invalid' };
  }
  if (sha256(downloaded.buffer) !== expectedHash) {
    return { ok: false, errorCode: 'object_hash_mismatch' };
  }

  try {
    const metadata = await sharp(downloaded.buffer, {
      failOn: 'warning',
    }).metadata();
    if (
      metadata.format !== 'webp' ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 1024 ||
      metadata.height > 1024
    ) {
      return { ok: false, errorCode: 'object_metadata_invalid' };
    }
  } catch {
    return { ok: false, errorCode: 'object_decode_failed' };
  }

  return { ok: true };
}

async function removeDestinationObject(client, objectPath) {
  const { error } = await client.storage
    .from(PEOPLE_PHOTOS_BUCKET)
    .remove([objectPath]);
  return error ? { ok: false } : { ok: true };
}

async function analyzeCandidate(client, row, supabaseUrl) {
  const resolved = resolveLegacySource(row, supabaseUrl);
  if (resolved.outcome !== 'eligible') return resolved;

  const downloaded = await downloadObject(client, resolved.sourcePath);
  if ('error' in downloaded) {
    return {
      category: resolved.category,
      outcome: 'manual_missing_object',
      sourcePath: resolved.sourcePath,
    };
  }
  const processed = await processPeoplePhotoBuffer(downloaded.buffer);
  if ('error' in processed) {
    return {
      category: resolved.category,
      outcome: 'manual_invalid_image',
      sourcePath: resolved.sourcePath,
    };
  }

  return {
    category: resolved.category,
    outcome: 'eligible',
    sourcePath: resolved.sourcePath,
    processed: processed.photo,
    processedHash: sha256(processed.photo.buffer),
  };
}

export async function runInventory({ client, projectRef }) {
  const { data, error } = await client
    .from('people_photo_reference_inventory')
    .select('church_id, category, people_count')
    .order('church_id', { ascending: true })
    .order('category', { ascending: true });
  if (error) {
    throw new PhotoMigrationError(
      'inventory_failed',
      'Count-only photo inventory could not be loaded.'
    );
  }

  const churches = new Map();
  const totals = Object.fromEntries(INVENTORY_CATEGORIES.map((category) => [category, 0]));
  for (const row of data) {
    if (!INVENTORY_CATEGORIES.includes(row.category)) {
      throw new PhotoMigrationError(
        'inventory_category_invalid',
        'Inventory returned an unsupported category.'
      );
    }
    const church = churches.get(row.church_id) ?? {
      church_id: row.church_id,
      total: 0,
      categories: Object.fromEntries(
        INVENTORY_CATEGORIES.map((category) => [category, 0])
      ),
    };
    church.categories[row.category] = row.people_count;
    church.total += row.people_count;
    totals[row.category] += row.people_count;
    churches.set(row.church_id, church);
  }

  return {
    command: 'inventory',
    mode: 'read_only_count_only',
    project_ref: projectRef,
    church_count: churches.size,
    totals,
    churches: [...churches.values()],
  };
}

export async function runDryRun({
  client,
  projectRef,
  churchId,
  supabaseUrl,
  limit,
  resumeFrom,
  auditFile,
}) {
  await assertTenantExists(client, churchId);
  const operationId = crypto.randomUUID();
  const rows = await listTenantPeople(client, churchId, { limit, resumeFrom });
  const categoryCounts = {};
  const plan = {};

  for (const row of rows) {
    const analysis = await analyzeCandidate(client, row, supabaseUrl);
    increment(categoryCounts, analysis.category);
    increment(plan, analysis.outcome);
    await appendAudit(
      auditFile,
      auditRecord({
        operationId,
        projectRef,
        churchId,
        personId: row.id,
        category: analysis.category,
        outcome: analysis.outcome,
        sourcePath: analysis.sourcePath,
      })
    );
  }

  return {
    command: 'dry-run',
    mode: 'read_only',
    project_ref: projectRef,
    church_id: churchId,
    operation_id: operationId,
    people_examined: rows.length,
    category_counts: categoryCounts,
    plan,
    next_resume_from: rows.at(-1)?.id ?? null,
  };
}

async function getCurrentPerson(client, churchId, personId) {
  const { data, error } = await client
    .from('people')
    .select('id, church_id, photo_url, photo_path')
    .eq('church_id', churchId)
    .eq('id', personId)
    .maybeSingle();
  if (error) {
    throw new PhotoMigrationError('person_lookup_failed', 'Person lookup failed.');
  }
  return data;
}

async function recordOutcome({
  auditFile,
  operationId,
  projectRef,
  churchId,
  row,
  analysis,
  outcome,
  destinationPath,
  errorCode,
}) {
  await appendAudit(
    auditFile,
    auditRecord({
      operationId,
      projectRef,
      churchId,
      personId: row.id,
      category: analysis.category,
      outcome,
      sourcePath: analysis.sourcePath,
      destinationPath,
      errorCode,
    })
  );
}

export async function runMigration({
  client,
  projectRef,
  churchId,
  supabaseUrl,
  confirm,
  isRemote = false,
  allowRemote = false,
  stateFile,
  auditFile,
  limit,
  resumeFrom,
  testHooks = {},
}) {
  validateCommandOptions('migrate', {
    churchId,
    confirm,
    isRemote,
    allowRemote,
  });
  await assertTenantExists(client, churchId);
  const existingState = await readState(stateFile, { projectRef, churchId });
  const operationId = existingState?.operation_id ?? crypto.randomUUID();
  const state = existingState ?? {
    version: STATE_VERSION,
    operation_id: operationId,
    project_ref: projectRef,
    church_id: churchId,
    created_at: nowIso(),
    updated_at: nowIso(),
    records: {},
  };
  await writeState(stateFile, state);

  const rows = await listTenantPeople(client, churchId, { limit, resumeFrom });
  const outcomes = {};

  for (const initialRow of rows) {
    let row = initialRow;
    const checkpoint = state.records[row.id];
    if (
      checkpoint?.destination_path &&
      row.photo_path === checkpoint.destination_path &&
      row.photo_url === null
    ) {
      const verified = await verifyObject(
        client,
        checkpoint.destination_path,
        checkpoint.processed_sha256
      );
      const outcome = verified.ok ? 'already_migrated' : 'manual_state_drift';
      if (verified.ok) {
        checkpoint.status = 'migrated';
        checkpoint.completed_at = checkpoint.completed_at ?? nowIso();
        await writeState(stateFile, state);
      }
      increment(outcomes, outcome);
      await recordOutcome({
        auditFile,
        operationId,
        projectRef,
        churchId,
        row,
        analysis: {
          category: checkpoint.category,
          sourcePath: checkpoint.source_path,
        },
        outcome,
        destinationPath: checkpoint.destination_path,
        errorCode: verified.ok ? null : verified.errorCode,
      });
      continue;
    }

    const analysis = await analyzeCandidate(client, row, supabaseUrl);
    if (analysis.outcome !== 'eligible') {
      increment(outcomes, analysis.outcome);
      await recordOutcome({
        auditFile,
        operationId,
        projectRef,
        churchId,
        row,
        analysis,
        outcome: analysis.outcome,
      });
      continue;
    }

    let record = state.records[row.id];
    if (
      record &&
      (record.source_path !== analysis.sourcePath ||
        record.processed_sha256 !== analysis.processedHash)
    ) {
      increment(outcomes, 'manual_source_changed');
      await recordOutcome({
        auditFile,
        operationId,
        projectRef,
        churchId,
        row,
        analysis,
        outcome: 'manual_source_changed',
        errorCode: 'source_changed',
      });
      continue;
    }

    if (!record || !record.destination_path) {
      record = {
        category: analysis.category,
        source_path: analysis.sourcePath,
        destination_path: generatePeoplePhotoPath(churchId, row.id),
        processed_sha256: analysis.processedHash,
        status: 'uploading',
        started_at: nowIso(),
        completed_at: null,
        error_code: null,
      };
      state.records[row.id] = record;
      await writeState(stateFile, state);
    }

    let destinationVerified = await verifyObject(
      client,
      record.destination_path,
      record.processed_sha256
    );
    if (!destinationVerified.ok) {
      const uploadResult = testHooks.upload
        ? await testHooks.upload({
            path: record.destination_path,
            buffer: analysis.processed.buffer,
          })
        : await client.storage
            .from(PEOPLE_PHOTOS_BUCKET)
            .upload(record.destination_path, analysis.processed.buffer, {
              contentType: 'image/webp',
              upsert: false,
            });

      if (uploadResult?.error) {
        destinationVerified = await verifyObject(
          client,
          record.destination_path,
          record.processed_sha256
        );
        if (!destinationVerified.ok) {
          record.status = 'upload_failed';
          record.error_code = 'destination_upload_failed';
          await writeState(stateFile, state);
          increment(outcomes, 'upload_failed');
          await recordOutcome({
            auditFile,
            operationId,
            projectRef,
            churchId,
            row,
            analysis,
            outcome: 'upload_failed',
            destinationPath: record.destination_path,
            errorCode: record.error_code,
          });
          continue;
        }
      }
    }

    record.status = 'uploaded';
    record.error_code = null;
    await writeState(stateFile, state);

    destinationVerified = testHooks.verify
      ? await testHooks.verify({
          client,
          path: record.destination_path,
          expectedHash: record.processed_sha256,
        })
      : await verifyObject(client, record.destination_path, record.processed_sha256);
    if (!destinationVerified.ok) {
      const cleanup = await removeDestinationObject(client, record.destination_path);
      record.status = 'verification_failed';
      record.error_code = cleanup.ok
        ? destinationVerified.errorCode
        : 'verification_failed_cleanup_failed';
      await writeState(stateFile, state);
      increment(outcomes, 'verification_failed');
      await recordOutcome({
        auditFile,
        operationId,
        projectRef,
        churchId,
        row,
        analysis,
        outcome: 'verification_failed',
        destinationPath: record.destination_path,
        errorCode: record.error_code,
      });
      continue;
    }

    const { data: updated, error: updateError } = await client
      .from('people')
      .update({
        photo_path: record.destination_path,
        photo_url: null,
      })
      .eq('church_id', churchId)
      .eq('id', row.id)
      .is('photo_path', null)
      .eq('photo_url', row.photo_url)
      .select('id, church_id, photo_url, photo_path')
      .maybeSingle();

    if (updateError) {
      record.status = 'uploaded';
      record.error_code = 'database_update_failed';
      await writeState(stateFile, state);
      increment(outcomes, 'database_update_failed');
      await recordOutcome({
        auditFile,
        operationId,
        projectRef,
        churchId,
        row,
        analysis,
        outcome: 'database_update_failed',
        destinationPath: record.destination_path,
        errorCode: record.error_code,
      });
      continue;
    }

    row = updated ?? (await getCurrentPerson(client, churchId, row.id));
    if (
      !row ||
      row.photo_path !== record.destination_path ||
      row.photo_url !== null
    ) {
      await removeDestinationObject(client, record.destination_path);
      record.status = 'database_conflict';
      record.error_code = 'database_row_changed_destination_removed';
      await writeState(stateFile, state);
      increment(outcomes, 'database_row_changed');
      await recordOutcome({
        auditFile,
        operationId,
        projectRef,
        churchId,
        row: initialRow,
        analysis,
        outcome: 'database_row_changed',
        destinationPath: record.destination_path,
        errorCode: record.error_code,
      });
      continue;
    }

    record.status = 'migrated';
    record.completed_at = nowIso();
    record.error_code = null;
    await writeState(stateFile, state);
    increment(outcomes, 'migrated');
    await recordOutcome({
      auditFile,
      operationId,
      projectRef,
      churchId,
      row,
      analysis,
      outcome: 'migrated',
      destinationPath: record.destination_path,
    });
  }

  return {
    command: 'migrate',
    mode: 'write_tenant_scoped',
    project_ref: projectRef,
    church_id: churchId,
    operation_id: operationId,
    people_examined: rows.length,
    outcomes,
    next_resume_from: rows.at(-1)?.id ?? null,
    state_file: stateFile,
    audit_file: auditFile,
  };
}

export async function runVerification({
  client,
  projectRef,
  churchId,
  stateFile,
}) {
  await assertTenantExists(client, churchId);
  const state = await readState(stateFile, { projectRef, churchId });
  if (!state) {
    throw new PhotoMigrationError(
      'state_not_found',
      'A recovery state file is required for verification.'
    );
  }

  const outcomes = {};
  for (const [personId, record] of Object.entries(state.records)) {
    if (record.status !== 'migrated') {
      increment(outcomes, 'not_migrated');
      continue;
    }
    const row = await getCurrentPerson(client, churchId, personId);
    if (
      !row ||
      row.photo_path !== record.destination_path ||
      row.photo_url !== null
    ) {
      increment(outcomes, 'database_mismatch');
      continue;
    }
    const verified = await verifyObject(
      client,
      record.destination_path,
      record.processed_sha256
    );
    increment(outcomes, verified.ok ? 'verified' : 'object_verification_failed');
  }

  return {
    command: 'verify',
    mode: 'read_only',
    project_ref: projectRef,
    church_id: churchId,
    operation_id: state.operation_id,
    outcomes,
  };
}

export async function runRollbackPlan({
  client,
  projectRef,
  churchId,
  stateFile,
}) {
  await assertTenantExists(client, churchId);
  const state = await readState(stateFile, { projectRef, churchId });
  if (!state) {
    throw new PhotoMigrationError(
      'state_not_found',
      'A recovery state file is required for rollback planning.'
    );
  }

  const outcomes = {};
  for (const [personId, record] of Object.entries(state.records)) {
    if (record.status !== 'migrated') {
      increment(outcomes, 'not_migrated');
      continue;
    }
    const row = await getCurrentPerson(client, churchId, personId);
    const source = await downloadObject(client, record.source_path);
    const destination = await verifyObject(
      client,
      record.destination_path,
      record.processed_sha256
    );
    if (
      row?.photo_path === record.destination_path &&
      row.photo_url === null &&
      !('error' in source) &&
      destination.ok
    ) {
      increment(outcomes, 'rollback_ready');
    } else if ('error' in source) {
      increment(outcomes, 'source_missing');
    } else if (!destination.ok) {
      increment(outcomes, 'destination_invalid');
    } else {
      increment(outcomes, 'database_drift');
    }
  }

  return {
    command: 'rollback-plan',
    mode: 'read_only_no_changes',
    project_ref: projectRef,
    church_id: churchId,
    operation_id: state.operation_id,
    outcomes,
    automatic_rollback_performed: false,
  };
}

export function sanitizeCliError(error) {
  return {
    error: safeErrorCode(error),
    message:
      error instanceof PhotoMigrationError
        ? error.message
        : 'Photo migration tooling failed. Review protected operator logs.',
  };
}
