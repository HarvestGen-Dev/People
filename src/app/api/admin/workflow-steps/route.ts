import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';

export async function POST(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const body = await request.json();
    await assertTenantRecords(
      'workflows',
      [body.workflow_id],
      churchId,
      'workflows'
    );

    const { data, error } = await supabase
      .from('workflow_steps')
      .insert({
        church_id: churchId,
        workflow_id: body.workflow_id,
        name: body.name,
        position: body.position || 0
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
