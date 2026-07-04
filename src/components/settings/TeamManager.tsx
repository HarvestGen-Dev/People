'use client';

// <!-- AGENT: FRONTEND -->
import { Users, Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { TenantRole } from '@/lib/tenant-context';
import type {
  ClaimRequestSummary,
  InvitationSummary,
  TeamMemberSummary,
} from '@/lib/team';

import { useTeamManager } from '@/hooks/useTeamManager';
import { TeamMembersList } from './team-manager/TeamMembersList';
import { PendingInvitations } from './team-manager/PendingInvitations';
import { ClaimRequestsList } from './team-manager/ClaimRequestsList';
import { InvitationHistory } from './team-manager/InvitationHistory';
import { TeamManagerDialogs } from './team-manager/TeamManagerDialogs';

export function TeamManager({
  churchName,
  currentRole,
  currentIsPlatformAdmin,
  initialMembers,
  initialInvitations,
  initialClaimRequests,
  now,
}: {
  churchName: string;
  currentRole: TenantRole;
  currentIsPlatformAdmin: boolean;
  initialMembers: TeamMemberSummary[];
  initialInvitations: InvitationSummary[];
  initialClaimRequests: ClaimRequestSummary[];
  now: string;
}) {
  const {
    claimRequests,
    isInviteOpen,
    setIsInviteOpen,
    resendPromptId,
    setResendPromptId,
    isSaving,
    busyInvitationId,
    busyClaimId,
    email,
    setEmail,
    role,
    setRole,
    expiresInDays,
    setExpiresInDays,
    createdInvitation,
    setCreatedInvitation,
    pendingInvitations,
    historyInvitations,
    handleInvite,
    revokeInvitation,
    resendInvitation,
    reviewClaim,
  } = useTeamManager(initialInvitations, initialClaimRequests, now);

  return (
    <div className="space-y-8">
      <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.17em] text-emerald-700">
            Access management
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.035em] text-slate-950">
            Team & invitations
          </h1>
          <p className="mt-2 max-w-2xl text-slate-500">
            Control who can access {churchName} and issue secure, expiring
            signup links.
          </p>
        </div>
        <Button
          onClick={() => setIsInviteOpen(true)}
          className="h-11 rounded-xl bg-emerald-700 px-5 font-bold hover:bg-emerald-800"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Invite teammate
        </Button>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ['Team members', initialMembers.length, Users, 'bg-emerald-100 text-emerald-700'],
          ['Pending invites', pendingInvitations.length, Mail, 'bg-sky-100 text-sky-700'],
          ['Your role', currentRole, ShieldCheck, 'bg-amber-100 text-amber-700'],
        ].map(([label, value, StatIcon, color]) => {
          const Icon = StatIcon as typeof Users;
          return (
            <div
              key={String(label)}
              className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className={`grid h-11 w-11 place-items-center rounded-xl ${String(color)}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-xl font-bold capitalize text-slate-950">
                  {String(value)}
                </div>
                <div className="text-xs text-slate-500">{String(label)}</div>
              </div>
            </div>
          );
        })}
      </section>

      <TeamMembersList members={initialMembers} />

      <PendingInvitations
        pendingInvitations={pendingInvitations}
        currentIsPlatformAdmin={currentIsPlatformAdmin}
        busyInvitationId={busyInvitationId}
        resendInvitation={resendInvitation}
        revokeInvitation={revokeInvitation}
      />

      <ClaimRequestsList
        claimRequests={claimRequests}
        busyClaimId={busyClaimId}
        reviewClaim={reviewClaim}
      />

      <InvitationHistory historyInvitations={historyInvitations} />

      <TeamManagerDialogs
        isInviteOpen={isInviteOpen}
        setIsInviteOpen={setIsInviteOpen}
        resendPromptId={resendPromptId}
        setResendPromptId={setResendPromptId}
        isSaving={isSaving}
        email={email}
        setEmail={setEmail}
        role={role}
        setRole={setRole}
        expiresInDays={expiresInDays}
        setExpiresInDays={setExpiresInDays}
        createdInvitation={createdInvitation}
        setCreatedInvitation={setCreatedInvitation}
        currentRole={currentRole}
        handleInvite={handleInvite}
        resendInvitation={resendInvitation}
      />
    </div>
  );
}
