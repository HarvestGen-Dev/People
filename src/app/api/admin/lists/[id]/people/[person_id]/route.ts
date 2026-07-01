import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string, person_id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const { id, person_id } = await params;

    const { error } = await supabase
      .from('list_people')
      .delete()
      .eq('list_id', id)
      .eq('person_id', person_id)
      .eq('church_id', churchId);

    if (error) throw error;
    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
