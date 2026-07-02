// <!-- AGENT: BACKEND -->
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { adminApiError, requireTenantContext } from '@/lib/tenant-context';

export async function PATCH(request: Request) {
  try {
    await requireTenantContext({ requireManager: true });
    const body = (await request.json()) as {
      request_id?: string;
      decision?: 'approve' | 'reject';
    };

    if (!body.request_id || !['approve', 'reject'].includes(body.decision || '')) {
      return NextResponse.json(
        { error: 'request_id and a valid decision are required' },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('review_person_claim', {
      p_request_id: body.request_id,
      p_approve: body.decision === 'approve',
    });

    if (error) throw error;
    return NextResponse.json({ data: { link_id: data || null } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
