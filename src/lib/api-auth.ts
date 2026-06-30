import { NextRequest } from 'next/server';
import { createServiceClient } from './supabase/server';
import { ApiKey } from './types';

export async function validateApiKey(
  request: NextRequest,
  requiredScope: string
): Promise<{ error?: string; status?: number; apiKey?: ApiKey }> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Missing or invalid Authorization header', status: 401 };
  }

  const rawKey = authHeader.split(' ')[1];

  // Hash the key using Web Crypto API
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

  const supabase = createServiceClient();
  const { data: apiKeyData, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .single();

  if (error || !apiKeyData) {
    return { error: 'Invalid API key', status: 401 };
  }

  const apiKey = apiKeyData as ApiKey;

  if (!apiKey.is_active) {
    return { error: 'API key is revoked or inactive', status: 401 };
  }

  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return { error: 'API key has expired', status: 401 };
  }

  if (!apiKey.scopes.includes(requiredScope)) {
    return { error: `Forbidden: requires scope '${requiredScope}'`, status: 403 };
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', apiKey.id)
    .then();

  return { apiKey };
}
