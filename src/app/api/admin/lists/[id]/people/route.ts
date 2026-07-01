import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';
import {
  assertStaticList,
  assertTenantRecords,
} from '@/lib/tenant-references';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = createServiceClient();

    const { id } = await params;
    const body = await request.json();

    if (!body.person_ids || !Array.isArray(body.person_ids)) {
      return NextResponse.json({ error: 'person_ids array is required' }, { status: 400 });
    }

    await Promise.all([
      assertStaticList(id, churchId),
      assertTenantRecords(
        'people',
        body.person_ids,
        churchId,
        'people'
      ),
    ]);

    const inserts = body.person_ids.map((personId: string) => ({
      list_id: id,
      person_id: personId,
      church_id: churchId,
    }));

    // On conflict do nothing is not natively supported by basic insert without upsert constraints in supabase JS sometimes, 
    // but list_id + person_id is a PK, so we can use upsert with ignoreDuplicates: true.
    const { error } = await supabase
      .from('list_people')
      .upsert(inserts, { onConflict: 'list_id,person_id', ignoreDuplicates: true });

    if (error) throw error;
    return NextResponse.json({ data: { success: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
