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
  role: TenantRole;
  expiresAt: string;
  acceptedAt: string | null;
  revokedAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type ClaimRequestSummary = {
  id: string;
  email: string;
  personId: string;
  personName: string;
  createdAt: string;
};

export async function getChurchTeam(churchId: string): Promise<{
  members: TeamMemberSummary[];
  invitations: InvitationSummary[];
  claimRequests: ClaimRequestSummary[];
}> {
  const supabase = createServiceClient();
  const [{ data: memberships, error: membershipError }, {
    data: invitations,
    error: invitationError,
  }, {
    data: claimRequests,
    error: claimRequestError,
  }] = await Promise.all([
    supabase
      .from('church_memberships')
      .select('id, user_id, role, created_at')
      .eq('church_id', churchId)
      .order('created_at', { ascending: true }),
    supabase
      .from('church_invitations')
      .select('id, email, role, expires_at, accepted_at, revoked_at, sent_at, created_at')
      .eq('church_id', churchId)
      .order('created_at', { ascending: false }),
    supabase
      .from('person_claim_requests')
      .select('id, email, person_id, created_at, people(first_name, last_name)')
      .eq('church_id', churchId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true }),
  ]);

  if (membershipError) throw membershipError;
  if (invitationError) throw invitationError;
  if (claimRequestError) throw claimRequestError;

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
      role: invitation.role as TenantRole,
      expiresAt: invitation.expires_at,
      acceptedAt: invitation.accepted_at,
      revokedAt: invitation.revoked_at,
      sentAt: invitation.sent_at,
      createdAt: invitation.created_at,
    })),
    claimRequests: (claimRequests || []).map((request) => {
      const person = Array.isArray(request.people)
        ? request.people[0]
        : request.people;
      return {
        id: request.id,
        email: request.email,
        personId: request.person_id,
        personName: person
          ? `${person.first_name} ${person.last_name}`.trim()
          : 'Unknown profile',
        createdAt: request.created_at,
      };
    }),
  };
}
