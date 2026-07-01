import { createClient } from '@/lib/supabase/server';
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
    const supabase = await createClient();

    const { id } = await params;
    const body = await request.json();
    
    const { error } = await supabase
      .from('event_registrations')
      .update({
        status: 'rejected',
        rejection_reason: body.reason || null,
        reviewed_by: user.email,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
