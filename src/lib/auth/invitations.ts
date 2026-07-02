// <!-- AGENT: BACKEND -->
import { createHash } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';

export type InvitationDetails = {
  churchId: string;
  churchName: string;
  churchSlug: string;
  email: string;
  expiresAt: string;
};

export function hashInvitationToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function getValidInvitation(
  token: string
): Promise<InvitationDetails | null> {
  if (!token || token.length < 32) return null;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('church_invitations')
    .select('church_id, email, expires_at, churches(name, slug)')
    .eq('token_hash', hashInvitationToken(token))
    .is('accepted_at', null)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();

  if (error || !data) return null;

  const church = Array.isArray(data.churches)
    ? data.churches[0]
    : data.churches;

  if (!church) return null;

  return {
    churchId: data.church_id,
    churchName: church.name,
    churchSlug: church.slug,
    email: data.email,
    expiresAt: data.expires_at,
  };
}
