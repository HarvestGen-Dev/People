import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { evaluateSmartList } from '@/lib/lists/evaluate';

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single();
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 });

    const body = await request.json();
    if (!body.filters) return NextResponse.json({ error: 'Missing filters' }, { status: 400 });

    const evalResult = await evaluateSmartList(body.filters, church.id, { limit: 10 });

    return NextResponse.json({
      data: {
        people: evalResult.people,
        total: evalResult.total
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
