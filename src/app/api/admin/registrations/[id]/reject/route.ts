import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
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
      .select('id')
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: 'Registration not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
