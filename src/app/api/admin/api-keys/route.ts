// <!-- AGENT: BACKEND -->
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { recordAuditLog } from '@/lib/audit-log';
import { z } from 'zod';
import { readJsonObject, validationErrorResponse } from '@/lib/validation';

const ALLOWED_SCOPES = new Set([
  'people:read',
  'people:write',
  'people:lookup',
  'events:read',
  'events:write',
]);

const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).optional().nullable(),
  scopes: z.array(z.enum([
    'people:read',
    'people:write',
    'people:lookup',
    'events:read',
    'events:write',
  ])).max(10),
  expires_at: z.string().datetime().optional().nullable(),
}).strict();

export async function POST(request: Request) {
  try {
    const { churchId, user } = await requireTenantContext({ requireDeveloperTools: true });
    const supabase = await createClient();

    const body = await readJsonObject(request);
    if (body instanceof NextResponse) return body;
    const parsed = apiKeyCreateSchema.safeParse(body);
    if (!parsed.success) return validationErrorResponse(parsed.error);
    const { name, scopes: parsedScopes } = parsed.data;
    const description = parsed.data.description?.trim() || '';
    const scopes = [...new Set(parsedScopes)].filter((scope) => ALLOWED_SCOPES.has(scope));

    let expiresAt: string | null = null;
    if (parsed.data.expires_at) {
      const parsedExpiry = new Date(parsed.data.expires_at);
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

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'api_key.created',
      resourceType: 'api_key',
      resourceDisplayId: data.key_prefix,
      metadata: {
        name: data.name,
        scopes: data.scopes,
        expires_at: data.expires_at,
      },
      request,
    });
    
    // Return the raw key ONCE
    return NextResponse.json({ data: { apiKey: data, rawKey } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
