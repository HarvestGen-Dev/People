// <!-- AGENT: BACKEND -->
import 'server-only';

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

export async function requireTenantContext(
  options: TenantContextOptions = {}
): Promise<TenantContext> {
  const sessionClient = await createClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    throw new TenantContextError('Unauthorized', 401);
  }

  const cookieStore = await cookies();
  const selectedChurchId =
    options.churchId ?? cookieStore.get('people_church_id')?.value;

  const serviceClient = createServiceClient();
  const { data: platformAdministrator, error: platformError } =
    await serviceClient
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', user.id)
      .maybeSingle();

  if (platformError) {
    throw new Error(`Unable to resolve platform access: ${platformError.message}`);
  }

  if (platformAdministrator) {
    let churchQuery = serviceClient
      .from('churches')
      .select('id, name, slug');

    churchQuery = selectedChurchId
      ? churchQuery.eq('id', selectedChurchId)
      : churchQuery.order('created_at', { ascending: true }).limit(1);

    const { data: platformChurch, error: churchError } =
      await churchQuery.maybeSingle();

    if (churchError) {
      throw new Error(`Unable to resolve platform church: ${churchError.message}`);
    }

    if (!platformChurch) {
      throw new TenantContextError('No church is available to manage', 403);
    }

    return {
      user,
      churchId: platformChurch.id,
      churchName: platformChurch.name,
      churchSlug: platformChurch.slug,
      role: 'owner',
      isPlatformAdmin: true,
    };
  }

  let query = serviceClient
    .from('church_memberships')
    .select('church_id, role, churches!inner(id, name, slug)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true });

  if (selectedChurchId) {
    query = query.eq('church_id', selectedChurchId);
  }

  const { data, error } = await query.limit(1).maybeSingle();

  if (error) {
    throw new Error(`Unable to resolve tenant membership: ${error.message}`);
  }

  if (!data) {
    throw new TenantContextError(
      selectedChurchId
        ? 'You do not have access to the selected church'
        : 'No church membership was found for this account',
      403
    );
  }

  const membership = data as MembershipRow;
  const church = Array.isArray(membership.churches)
    ? membership.churches[0]
    : membership.churches;

  if (!church) {
    throw new Error('Membership church could not be resolved');
  }

  if (
    options.requireOwner &&
    membership.role !== 'owner'
  ) {
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
    throw new TenantContextError(
      'Workflow manager access is required',
      403
    );
  }

  return {
    user,
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
