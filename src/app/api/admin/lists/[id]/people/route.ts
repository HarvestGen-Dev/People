import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    if (!body.person_ids || !Array.isArray(body.person_ids)) {
      return NextResponse.json({ error: 'person_ids array is required' }, { status: 400 });
    }

    const inserts = body.person_ids.map((personId: string) => ({
      list_id: id,
      person_id: personId
    }));

    // On conflict do nothing is not natively supported by basic insert without upsert constraints in supabase JS sometimes, 
    // but list_id + person_id is a PK, so we can use upsert with ignoreDuplicates: true.
    const { error } = await supabase
      .from('list_people')
      .upsert(inserts, { onConflict: 'list_id,person_id', ignoreDuplicates: true });

    if (error) throw error;
    return NextResponse.json({ data: { success: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
