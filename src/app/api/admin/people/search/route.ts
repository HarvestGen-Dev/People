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

    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ data: [] });
    }

    const { data, error } = await supabase
      .from('people')
      .select('id, first_name, last_name, email, phone, status')
      .eq('church_id', church.id)
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
      .limit(20);

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
