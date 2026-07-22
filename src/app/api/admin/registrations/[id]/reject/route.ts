import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit-log';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { getOperationalRequestId } from '@/lib/observability/request-id';
import { recordOperationalIncident, resolveOperationalIncidents } from '@/lib/observability/incidents';
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
    const supabase = createServiceClient();

    const { id } = await params;
    registrationIdForLog = id;
    const body = await request.json();
    
    const { data, error } = await supabase
      .from('event_registrations')
      .update({
        status: 'rejected',
        rejection_reason: body.reason || null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('church_id', churchId)
      .select('display_id, email, rejection_reason')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    await recordAuditLog({
      churchId,
      actor: user,
      action: 'registration.rejected',
      resourceType: 'registration',
      resourceDisplayId: data.display_id,
      metadata: {
        email: data.email,
        has_reason: Boolean(data.rejection_reason),
      },
      request,
    });

    await resolveOperationalIncidents({
      churchId,
      event: OPERATIONAL_EVENTS.registrationRejectionFailed,
      resourceId: id,
    });

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    const response = adminApiError(error);
    if (response.status >= 500 && churchIdForLog) {
      logOperationalEvent({
        event: OPERATIONAL_EVENTS.registrationRejectionFailed,
        severity: 'error',
        outcome: 'transaction_failed',
        requestId,
        churchId: churchIdForLog,
        resourceType: 'event_registration',
        resourceId: registrationIdForLog,
        errorCode: 'rejection_failed',
        retryable: true,
      }, error);
      await recordOperationalIncident({
        churchId: churchIdForLog,
        event: OPERATIONAL_EVENTS.registrationRejectionFailed,
        severity: 'error',
        resourceType: 'event_registration',
        resourceId: registrationIdForLog,
        requestId,
        errorCode: 'rejection_failed',
        retryable: true,
        error,
      });
      return NextResponse.json(
        { error: 'Unable to reject registration.', request_id: requestId },
        { status: 500 }
      );
    }
    return response;
  }
}
