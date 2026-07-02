// <!-- AGENT: BACKEND -->
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

const ALLOWED_SCOPES = new Set([
  'people:read',
  'people:write',
  'people:lookup',
  'events:read',
  'events:write',
]);

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const body = await request.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description =
      typeof body.description === 'string' ? body.description.trim() : '';
    const scopes = Array.isArray(body.scopes)
      ? [...new Set(body.scopes.filter((scope: unknown): scope is string => (
          typeof scope === 'string' && ALLOWED_SCOPES.has(scope)
        )))]
      : [];

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }
    if (
      Array.isArray(body.scopes) &&
      scopes.length !== new Set(body.scopes).size
    ) {
      return NextResponse.json({ error: 'One or more scopes are invalid' }, { status: 400 });
    }

    let expiresAt: string | null = null;
    if (body.expires_at) {
      const parsedExpiry = new Date(body.expires_at);
      if (
        Number.isNaN(parsedExpiry.getTime()) ||
        parsedExpiry.getTime() <= Date.now()
      ) {
        return NextResponse.json(
          { error: 'Expiration must be a valid future date' },
          { status: 400 }
        );
      }
      expiresAt = parsedExpiry.toISOString();
    }

    // Generate API key
    const random = crypto.randomBytes(16).toString('hex');
    const rawKey = `people_k1_${random}`;
    const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const prefix = rawKey.substring(0, 18);

    const { data, error } = await supabase
      .from('api_keys')
      .insert({
        church_id: churchId,
        name,
        description: description || null,
        key_hash: keyHash,
        key_prefix: prefix,
        scopes,
        expires_at: expiresAt,
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
