// <!-- AGENT: FRONTEND -->
import { Topbar } from '@/components/layout/Topbar';
import { TeamManager } from '@/components/settings/TeamManager';
import { requireTenantContext } from '@/lib/tenant-context';
import { getChurchTeam } from '@/lib/team';
import { redirect } from 'next/navigation';

export const metadata = {
  title: 'Team & Invitations | People',
};

export default async function TeamSettingsPage() {
  const tenant = await requireTenantContext();
  if (
    !tenant.isPlatformAdmin &&
    tenant.role !== 'owner' &&
    tenant.role !== 'admin'
  ) {
    redirect('/dashboard');
  }
  const team = await getChurchTeam(tenant.churchId);

  return (
    <>
      <Topbar title="Team & invitations" />
      <div className="mx-auto max-w-6xl p-5 animate-in fade-in-50 duration-300 sm:p-8 lg:p-10">
        <TeamManager
          churchName={tenant.churchName}
          currentRole={tenant.role}
          currentIsPlatformAdmin={tenant.isPlatformAdmin}
          initialMembers={team.members}
          initialInvitations={team.invitations}
          initialClaimRequests={team.claimRequests}
          now={new Date().toISOString()}
        />
      </div>
    </>
  );
}
