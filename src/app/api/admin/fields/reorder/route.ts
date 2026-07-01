import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import { assertTenantRecords } from '@/lib/tenant-references';

export async function PATCH(request: Request) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    await assertTenantRecords(
      'field_definitions',
      ids,
      churchId,
      'custom fields'
    );

    // Since Supabase doesn't support bulk update easily via REST API in one call,
    // we do sequential updates. In production for many rows, consider a stored procedure.
    for (let i = 0; i < ids.length; i++) {
      await supabase
        .from('field_definitions')
        .update({ position: i })
        .eq('id', ids[i])
        .eq('church_id', churchId);
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
