// <!-- AGENT: BACKEND -->
import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';

type AuditMetadata =
  | Record<string, string | number | boolean | null | string[] | number[]>
  | null;

type AuditLogInput = {
  churchId: string;
  actor: Pick<User, 'id' | 'email'>;
  action: string;
  resourceType: string;
  resourceDisplayId?: string | null;
  metadata?: AuditMetadata;
  request?: Request;
};

function requestIp(request?: Request): string | null {
  const forwardedFor = request?.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || null;

  return (
    request?.headers.get('x-real-ip') ||
    request?.headers.get('cf-connecting-ip') ||
    null
  );
}

export async function recordAuditLog({
  churchId,
  actor,
  action,
  resourceType,
  resourceDisplayId,
  metadata,
  request,
}: AuditLogInput): Promise<void> {
  const supabase = createServiceClient();

  const { error } = await supabase.from('audit_log').insert({
    church_id: churchId,
    actor_user_id: actor.id,
    actor_email: actor.email || null,
    action,
    resource_type: resourceType,
    resource_display_id: resourceDisplayId || null,
    ip_address: requestIp(request),
    user_agent: request?.headers.get('user-agent') || null,
    metadata: metadata || {},
  });

  if (error) {
    console.error('Failed to record audit log:', error);
  }
}
