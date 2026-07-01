import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const body = await request.json();

    // Generate API key
    const random = crypto.randomBytes(16).toString('hex');
    const rawKey = `people_k1_${random}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.substring(0, 18);

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        church_id: churchId,
        name: body.name,
        description: body.description || null,
        key_hash: keyHash,
        key_prefix: prefix,
        scopes: body.scopes || [],
        expires_at: body.expires_at || null,
        is_active: true,
      })
      .select('id, name, key_prefix, scopes, is_active, expires_at, last_used_at, created_at')
      .single();

    if (error) throw error;
    
    // Return the raw key ONCE
    return NextResponse.json({ data: { apiKey: data, rawKey } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
