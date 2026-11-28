// <!-- AGENT: FRONTEND -->
import { createServiceClient } from '@/lib/supabase/server';
import { requirePlatformAdmin } from '@/lib/platform-auth';
import { redirect } from 'next/navigation';
import { configuredChurchSlug } from '@/lib/single-church';
import { requireTenantContext } from '@/lib/tenant-context';
import {
  PlatformAdminManager,
  type PlatformChurch,
} from '@/components/platform/PlatformAdminManager';

export const metadata = {
  title: 'Platform Administration | HarvestGen People',
};

export default async function PlatformPage() {
  if (configuredChurchSlug()) {
    await requireTenantContext();
    redirect('/dashboard');
  }
  await requirePlatformAdmin();
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('churches')
    .select('id, name, slug, created_at, church_memberships(role)')
    .order('name');

  if (error) throw error;

  const churches: PlatformChurch[] = (data || []).map((church) => ({
    id: church.id,
    name: church.name,
    slug: church.slug,
    createdAt: church.created_at,
    ownerCount: (church.church_memberships || []).filter(
      (membership) => membership.role === 'owner'
    ).length,
  }));

  return <PlatformAdminManager initialChurches={churches} />;
}
