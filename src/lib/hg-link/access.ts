// <!-- AGENT: BACKEND -->
import 'server-only';

import {
  ApiRequestError,
  requireTenantContext,
  type TenantContext,
  type TenantRole,
} from '@/lib/tenant-context';

/** Roles that may read and manage HG Link submissions (faith and pastoral information). */
export const SUBMISSION_ROLES: readonly TenantRole[] = ['owner', 'admin', 'pastoral', 'workflow_manager'];

export function canViewSubmissions(role: TenantRole, isPlatformAdmin: boolean): boolean {
  return isPlatformAdmin || SUBMISSION_ROLES.includes(role);
}

/** Owner/admin only: editing and publishing public content and forms. */
export async function requireHgLinkEditor(): Promise<TenantContext> {
  return requireTenantContext({ requireManager: true });
}

export async function requireSubmissionAccess(): Promise<TenantContext> {
  const context = await requireTenantContext();
  if (!canViewSubmissions(context.role, context.isPlatformAdmin)) {
    throw new ApiRequestError('You do not have access to HG Link submissions', 403);
  }
  return context;
}

/**
 * Browser-based CSRF defence for cookie-authenticated mutations: if an Origin
 * header is present it must match this host. Non-browser clients send none.
 */
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin) return;
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
  let originHost = '';
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ApiRequestError('Invalid origin', 403);
  }
  if (originHost !== host) throw new ApiRequestError('Cross-site requests are not allowed', 403);
}
