// <!-- AGENT: BACKEND -->
import 'server-only';

import { cache } from 'react';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { User } from '@supabase/supabase-js';
import { createClient, createServiceClient } from '@/lib/supabase/server';

export type TenantRole =
  | 'owner'
  | 'admin'
  | 'pastoral'
  | 'workflow_manager'
  | 'staff'
  | 'viewer'
  | 'member';
export const DEVELOPER_TOOL_ROLES = ['owner', 'admin'] as const;

export type TenantContext = {
  user: User;
  churchId: string;
  churchName: string;
  churchSlug: string;
  role: TenantRole;
  isPlatformAdmin: boolean;
};

type TenantContextOptions = {
  churchId?: string;
  requireManager?: boolean;
  requireDeveloperTools?: boolean;
  requireWorkflowManager?: boolean;
  requireOwner?: boolean;
  requireSelectedChurch?: boolean;
};

type MembershipRow = {
  church_id: string;
  role: TenantRole;
  churches:
    | { id: string; name: string; slug: string }
    | { id: string; name: string; slug: string }[];
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: 400 | 401 | 403 | 404 | 409
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

export class TenantContextError extends ApiRequestError {
  constructor(message: string, status: 401 | 403) {
    super(message, status);
    this.name = 'TenantContextError';
  }
}

export class TenantSelectionRequiredError extends TenantContextError {
  constructor(message = 'Select a church before viewing tenant operations') {
    super(message, 403);
    this.name = 'TenantSelectionRequiredError';
  }
}

// <!-- AGENT: BACKEND -->
// Request-scoped session user resolution. React.cache ensures auth.getUser() is called
// at most once per incoming HTTP request render lifecycle, preventing redundant network trips
// across layout, page, and subcomponents while strictly never caching across requests or users.
const getSessionUser = cache(async (): Promise<User | null> => {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();
  return user ?? null;
});

type BaseTenantData = {
  user: User;
  isPlatformAdmin: boolean;
  platformChurch: { id: string; name: string; slug: string } | null;
  membership: MembershipRow | null;
  selectedChurchId: string | undefined;
};

// <!-- AGENT: BACKEND -->
// Request-scoped base tenant authorization resolver.
// Fetches platform admin status and church memberships in parallel instead of sequentially.
const resolveBaseTenantData = cache(
  async (targetChurchId?: string): Promise<BaseTenantData> => {
    const user = await getSessionUser();
    if (!user) {
      throw new TenantContextError('Unauthorized', 401);
    }

    const cookieStore = await cookies();
    const selectedChurchId =
      targetChurchId ?? cookieStore.get('people_church_id')?.value;

    const serviceClient = createServiceClient();

    let membershipQuery = serviceClient
      .from('church_memberships')
      .select('church_id, role, churches!inner(id, name, slug)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    if (selectedChurchId) {
      membershipQuery = membershipQuery.eq('church_id', selectedChurchId);
    }

    // Parallelize platform admin check and membership lookup
    const [platformRes, membershipRes] = await Promise.all([
      serviceClient
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle(),
      membershipQuery.limit(1).maybeSingle(),
    ]);

    if (platformRes.error) {
      throw new Error(`Unable to resolve platform access: ${platformRes.error.message}`);
    }

    const isPlatformAdmin = !!platformRes.data;
    let platformChurch: { id: string; name: string; slug: string } | null = null;

    if (isPlatformAdmin) {
      let churchQuery = serviceClient
        .from('churches')
        .select('id, name, slug');

      churchQuery = selectedChurchId
        ? churchQuery.eq('id', selectedChurchId)
        : churchQuery.order('created_at', { ascending: true }).limit(1);

      const { data, error: churchError } = await churchQuery.maybeSingle();
      if (churchError) {
        throw new Error(`Unable to resolve platform church: ${churchError.message}`);
      }
      platformChurch = data;
    }

    if (!isPlatformAdmin && membershipRes.error) {
      throw new Error(`Unable to resolve tenant membership: ${membershipRes.error.message}`);
    }

    return {
      user,
      isPlatformAdmin,
      platformChurch,
      membership: (membershipRes.data as unknown as MembershipRow) ?? null,
      selectedChurchId,
    };
  }
);

export async function requireTenantContext(
  options: TenantContextOptions = {}
): Promise<TenantContext> {
  const base = await resolveBaseTenantData(options.churchId);

  if (base.isPlatformAdmin) {
    if (options.requireSelectedChurch && !base.selectedChurchId) {
      throw new TenantSelectionRequiredError();
    }

    if (!base.platformChurch) {
      if (options.requireSelectedChurch) {
        throw new TenantSelectionRequiredError(
          'The selected church is unavailable; select another church'
        );
      }
      throw new TenantContextError('No church is available to manage', 403);
    }

    return {
      user: base.user,
      churchId: base.platformChurch.id,
      churchName: base.platformChurch.name,
      churchSlug: base.platformChurch.slug,
      role: 'owner',
      isPlatformAdmin: true,
    };
  }

  if (!base.membership) {
    throw new TenantContextError(
      base.selectedChurchId
        ? 'You do not have access to the selected church'
        : 'No church membership was found for this account',
      403
    );
  }

  const membership = base.membership;
  const church = Array.isArray(membership.churches)
    ? membership.churches[0]
    : membership.churches;

  if (!church) {
    throw new Error('Membership church could not be resolved');
  }

  if (options.requireOwner && membership.role !== 'owner') {
    throw new TenantContextError('Church owner access is required', 403);
  }

  if (
    (options.requireManager || options.requireDeveloperTools) &&
    membership.role !== 'owner' &&
    membership.role !== 'admin'
  ) {
    throw new TenantContextError(
      options.requireDeveloperTools
        ? 'Owner or administrator access is required for developer tools'
        : 'Church administrator access is required',
      403
    );
  }

  if (
    options.requireWorkflowManager &&
    membership.role !== 'owner' &&
    membership.role !== 'admin' &&
    membership.role !== 'workflow_manager'
  ) {
    throw new TenantContextError('Workflow manager access is required', 403);
  }

  return {
    user: base.user,
    churchId: membership.church_id,
    churchName: church.name,
    churchSlug: church.slug,
    role: membership.role,
    isPlatformAdmin: false,
  };
}

export function getTenantContextError(
  error: unknown
): { error: string; status: 400 | 401 | 403 | 404 | 409 } | null {
  if (!(error instanceof ApiRequestError)) return null;
  return { error: error.message, status: error.status };
}

export function adminApiError(error: unknown): NextResponse {
  const tenantError = getTenantContextError(error);
  if (tenantError) {
    return NextResponse.json(
      { error: tenantError.error },
      { status: tenantError.status }
    );
  }

  return NextResponse.json(
    { error: error instanceof Error ? error.message : 'Internal server error' },
    { status: 500 }
  );
}
