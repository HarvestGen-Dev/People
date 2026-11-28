// <!-- AGENT: BACKEND -->
import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';
import { TenantContextError } from '@/lib/tenant-context';
import { loadConfiguredChurch } from '@/lib/single-church';

export async function isPlatformAdminUser(userId: string): Promise<boolean> {
  const serviceClient = createServiceClient();
  const { data, error } = await serviceClient
    .from('platform_admins')
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve platform access: ${error.message}`);
  }

  return !!data;
}

export async function requirePlatformAdmin(): Promise<{ user: User }> {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    throw new TenantContextError('Unauthorized', 401);
  }

  if (!(await isPlatformAdminUser(user.id))) {
    throw new TenantContextError('Platform administrator access is required', 403);
  }

  return { user };
}

export async function resolveAuthenticatedHome(userId: string): Promise<string> {
  const serviceClient = createServiceClient();
  const configuredChurch = await loadConfiguredChurch();
  let membershipQuery = serviceClient.from('church_memberships').select('id').eq('user_id', userId);
  let personLinkQuery = serviceClient.from('person_user_links').select('id').eq('user_id', userId);
  if (configuredChurch) {
    membershipQuery = membershipQuery.eq('church_id', configuredChurch.id);
    personLinkQuery = personLinkQuery.eq('church_id', configuredChurch.id);
  }
  const [{ data: platformAdmin }, { data: membership }, { data: personLink }] =
    await Promise.all([
      serviceClient
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', userId)
        .maybeSingle(),
      membershipQuery.limit(1).maybeSingle(),
      personLinkQuery.limit(1).maybeSingle(),
    ]);

  if (platformAdmin) return configuredChurch ? '/dashboard' : '/platform';
  if (membership) return '/dashboard';
  if (personLink) return '/portal';
  return '/claim-pending';
}
