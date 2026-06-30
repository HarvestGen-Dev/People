import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids)) {
      return NextResponse.json({ error: 'ids array is required' }, { status: 400 });
    }

    // Since Supabase doesn't support bulk update easily via REST API in one call,
    // we do sequential updates. In production for many rows, consider a stored procedure.
    for (let i = 0; i < ids.length; i++) {
      await supabase
        .from('field_definitions')
        .update({ position: i })
        .eq('id', ids[i]);
    }

    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
