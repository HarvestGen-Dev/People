import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();
    
    const { id } = await params;

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
