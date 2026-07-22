// <!-- AGENT: INTEGRATION -->
import { spawnSync } from 'node:child_process';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertSafeE2EEnvironment } from './supabase-admin';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function assertUuid(value: string) {
  if (!UUID_PATTERN.test(value)) throw new Error(`Unsafe cleanup identifier: ${value}`);
  return value;
}

export async function removeStorageObjects(
  admin: SupabaseClient,
  objects: Array<{ bucket: string; path: string }>
) {
  const byBucket = new Map<string, string[]>();
  for (const object of objects) {
    byBucket.set(object.bucket, [...(byBucket.get(object.bucket) ?? []), object.path]);
  }

  for (const [bucket, paths] of byBucket) {
    if (paths.length === 0) continue;
    const { data, error } = await admin.storage.from(bucket).remove(paths);
    if (error) throw new Error(`Unable to clean ${bucket} storage: ${error.message}`);
    const removed = new Set((data ?? []).map((item) => item.name));
    const missing = paths.filter((path) => !removed.has(path));
    if (missing.length > 0) {
      throw new Error(`Storage cleanup did not confirm removal: ${missing.join(', ')}`);
    }
  }
}

export async function removeRateLimitScopes(
  admin: SupabaseClient,
  scopes: string[]
) {
  for (const scope of scopes) {
    const { error } = await admin
      .from('public_rate_limits')
      .delete()
      .like('subject', `%:${scope}`);
    if (error) throw new Error(`Unable to clean rate-limit scope ${scope}: ${error.message}`);
  }
}

export function removeChurches(churchIds: string[]) {
  if (churchIds.length === 0) return;
  assertSafeE2EEnvironment();
  const ids = churchIds.map(assertUuid);
  const databaseUrl =
    process.env.SUPABASE_DB_URL ??
    'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  const databaseHost = new URL(databaseUrl.replace(/^postgresql:/, 'http:')).hostname;
  if (!['127.0.0.1', 'localhost', '::1'].includes(databaseHost)) {
    throw new Error(`Refusing direct cleanup against non-local database host ${databaseHost}`);
  }

  const sql = `
    BEGIN;
    ALTER TABLE public.person_events DISABLE TRIGGER person_events_append_only;
    ALTER TABLE public.audit_log DISABLE TRIGGER audit_log_append_only;
    DELETE FROM public.churches WHERE id = ANY(ARRAY[${ids.map((id) => `'${id}'::uuid`).join(',')}]);
    ALTER TABLE public.audit_log ENABLE TRIGGER audit_log_append_only;
    ALTER TABLE public.person_events ENABLE TRIGGER person_events_append_only;
    COMMIT;
  `;
  const result = spawnSync('psql', [databaseUrl, '--set', 'ON_ERROR_STOP=1', '--command', sql], {
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`Tenant cleanup failed: ${result.stderr || result.stdout}`);
  }
}

export async function removeAuthUsers(admin: SupabaseClient, userIds: string[]) {
  for (const userId of userIds) {
    const { error } = await admin.auth.admin.deleteUser(assertUuid(userId));
    if (error) throw new Error(`Unable to clean Auth user ${userId}: ${error.message}`);
  }
}
