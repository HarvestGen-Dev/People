import { createServiceClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single();
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 });

    const { data, error } = await supabase
      .from('lists')
      .select('*')
      .eq('church_id', church.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createServiceClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single();
    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 });

    const body = await request.json();

    const { data, error } = await supabase
      .from('lists')
      .insert({
        church_id: church.id,
        name: body.name,
        type: body.type,
        filters: body.filters || null
      })
      .select('id')
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
