// <!-- AGENT: INTEGRATION -->
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import WebSocket from 'ws';

dotenv.config({ path: '.env.local', quiet: true });

type ClientOptions = NonNullable<Parameters<typeof createClient>[2]>;
type RealtimeTransport = NonNullable<ClientOptions['realtime']>['transport'];

const nodeWebSocket = WebSocket as unknown as RealtimeTransport;

function isLocalHostname(hostname: string) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '::1';
}

export function assertSafeE2EEnvironment() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!rawUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for E2E tests');
  }

  const url = new URL(rawUrl);
  if (!isLocalHostname(url.hostname) && process.env.E2E_ALLOW_REMOTE_SUPABASE !== 'true') {
    throw new Error(
      `Refusing to run destructive E2E setup against non-local Supabase host ${url.hostname}. ` +
        'Set E2E_ALLOW_REMOTE_SUPABASE=true only for a dedicated disposable test project.'
    );
  }
}

export function createAdminClient(): SupabaseClient {
  assertSafeE2EEnvironment();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for E2E tests'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch },
    realtime: { transport: nodeWebSocket },
  });
}

export async function insertOne<T extends Record<string, unknown>>(
  admin: SupabaseClient,
  table: string,
  values: Record<string, unknown>,
  columns = '*'
): Promise<T> {
  const { data, error } = await admin
    .from(table)
    .insert(values)
    .select(columns)
    .single();

  if (error) throw new Error(`Unable to seed ${table}: ${error.message}`);
  return data as unknown as T;
}

export async function requireQuery<T>(
  operation: PromiseLike<{ data: T; error: { message: string } | null }>,
  label: string
): Promise<NonNullable<T>> {
  const { data, error } = await operation;
  if (error) throw new Error(`${label}: ${error.message}`);
  if (data === null) throw new Error(`${label}: no data returned`);
  return data as NonNullable<T>;
}

export async function requireCount(
  operation: PromiseLike<{ count: number | null; error: { message: string } | null }>,
  label: string
): Promise<number> {
  const { count, error } = await operation;
  if (error) throw new Error(`${label}: ${error.message}`);
  return count ?? 0;
}
