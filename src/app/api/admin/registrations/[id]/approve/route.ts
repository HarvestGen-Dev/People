import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';
import { recordAuditLog } from '@/lib/audit-log';
import { createServiceClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { getOperationalRequestId } from '@/lib/observability/request-id';
import { logOperationalEvent, OPERATIONAL_EVENTS } from '@/lib/observability/logger';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = getOperationalRequestId(request);
  let churchIdForLog: string | undefined;
  let registrationIdForLog: string | undefined;
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });
    churchIdForLog = churchId;

    const { id } = await params;
    registrationIdForLog = id;
    const supabase = createServiceClient();
    
    // Call the shared approval logic
    const result = await approveRegistration(id, churchId, user.email || null, requestId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const { data: registration } = await supabase
      .from('event_registrations')
      .select('display_id, email, event_id')
      .eq('id', id)
      .eq('church_id', churchId)
      .maybeSingle();

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'registration.approved',
      resourceType: 'registration',
      resourceDisplayId: registration?.display_id || null,
      metadata: registration
        ? {
            email: registration.email,
          }
        : null,
      request,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    const response = adminApiError(error);
    if (response.status >= 500) {
      logOperationalEvent({
        event: OPERATIONAL_EVENTS.registrationApprovalFailed,
        severity: 'error',
        outcome: 'route_failed',
        requestId,
        churchId: churchIdForLog,
        resourceType: 'event_registration',
        resourceId: registrationIdForLog,
        errorCode: 'approval_route_failed',
        retryable: true,
      }, error);
      return NextResponse.json(
        { error: 'Unable to approve registration.', request_id: requestId },
        { status: 500 }
      );
    }
    return response;
  }
}
