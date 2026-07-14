import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { recordAuditLog } from '@/lib/audit-log';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId, user } = await requireTenantContext({
      requireManager: true,
    });
    const supabase = createServiceClient();

    const { id } = await params;
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

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
