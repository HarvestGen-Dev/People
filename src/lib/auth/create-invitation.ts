// <!-- AGENT: BACKEND -->
import 'server-only';

import { createHash, randomBytes } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { sendChurchInvitationEmail } from '@/lib/email/send-invitation';

export type InvitationRole = 'owner' | 'admin' | 'member';

export async function createChurchInvitation(input: {
  churchId: string;
  churchName: string;
  email: string;
  role: InvitationRole;
  expiresInDays: number;
  invitedBy: string;
  appUrl: string;
}) {
  const serviceClient = createServiceClient();
  const normalizedEmail = input.email.trim().toLowerCase();
  const now = new Date().toISOString();

  const { data: existingInvitation, error: existingInvitationError } =
    await serviceClient
      .from('church_invitations')
      .select('id')
      .eq('church_id', input.churchId)
      .eq('email', normalizedEmail)
      .is('accepted_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now)
      .limit(1)
      .maybeSingle();

  if (existingInvitationError) throw existingInvitationError;
  if (existingInvitation) {
    throw new Error('A valid pending invitation already exists for this email');
  }

  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: invitation, error: invitationError } = await serviceClient
    .from('church_invitations')
    .insert({
      church_id: input.churchId,
      email: normalizedEmail,
      token_hash: tokenHash,
      role: input.role,
      invited_by: input.invitedBy,
      expires_at: expiresAt,
    })
    .select('id, church_id, email, role, expires_at, created_at')
    .single();

  if (invitationError) throw invitationError;

  const inviteUrl = `${input.appUrl.replace(/\/$/, '')}/signup?invite=${encodeURIComponent(rawToken)}`;
  const delivery = await sendChurchInvitationEmail({
    email: normalizedEmail,
    churchName: input.churchName,
    inviteUrl,
    expiresAt,
  });

  if (delivery.sent) {
    await serviceClient
      .from('church_invitations')
      .update({ sent_at: new Date().toISOString() })
      .eq('id', invitation.id);
  }

  return {
    invitation,
    inviteUrl,
    emailSent: delivery.sent,
    emailError: delivery.error,
  };
}
