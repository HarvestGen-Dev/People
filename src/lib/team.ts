// <!-- AGENT: BACKEND -->
import 'server-only';
import { createServiceClient } from '@/lib/supabase/server';
import type { TenantRole } from '@/lib/tenant-context';

export type TeamMemberSummary = {
  id: string;
  userId: string;
  email: string;
  role: TenantRole;
  joinedAt: string;
};

export type InvitationSummary = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  expiresAt: string;
  acceptedAt: string | null;
  createdAt: string;
};

export async function getChurchTeam(churchId: string): Promise<{
  members: TeamMemberSummary[];
  invitations: InvitationSummary[];
}> {
  const supabase = createServiceClient();
  const [{ data: memberships, error: membershipError }, {
    data: invitations,
    error: invitationError,
  }] = await Promise.all([
    supabase
      .from('church_memberships')
      .select('id, user_id, role, created_at')
      .eq('church_id', churchId)
      .order('created_at', { ascending: true }),
    supabase
      .from('church_invitations')
      .select('id, email, role, expires_at, accepted_at, created_at')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false }),
  ]);

  if (membershipError) throw membershipError;
  if (invitationError) throw invitationError;

  const members = await Promise.all(
    (memberships || []).map(async (membership) => {
      const {
        data: { user },
      } = await supabase.auth.admin.getUserById(membership.user_id);

      return {
        id: membership.id,
        userId: membership.user_id,
        email: user?.email || 'Unknown account',
        role: membership.role as TenantRole,
        joinedAt: membership.created_at,
      };
    })
  );

  return {
    members,
    invitations: (invitations || []).map((invitation) => ({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role as 'admin' | 'member',
      expiresAt: invitation.expires_at,
      acceptedAt: invitation.accepted_at,
      createdAt: invitation.created_at,
    })),
  };
}
