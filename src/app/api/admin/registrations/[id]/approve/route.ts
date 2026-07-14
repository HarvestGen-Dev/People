import { NextResponse } from 'next/server';
import { approveRegistration } from '@/lib/events/approve-registration';
import { recordAuditLog } from '@/lib/audit-log';
import { createServiceClient } from '@/lib/supabase/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });

    const { id } = await params;
    const supabase = createServiceClient();
    
    // Call the shared approval logic
    const result = await approveRegistration(id, churchId, user.email || null);

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
    return adminApiError(error);
  }
}
