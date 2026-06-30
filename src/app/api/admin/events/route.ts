import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase
      .from('churches')
      .select('id')
      .eq('slug', churchSlug)
      .single();

    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 });

    const { data: events, error } = await supabase
      .from('events')
      .select('*')
      .eq('church_id', church.id)
      .order('start_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json({ data: events });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
    const { data: church } = await supabase
      .from('churches')
      .select('id')
      .eq('slug', churchSlug)
      .single();

    if (!church) return NextResponse.json({ error: 'Church not found' }, { status: 404 });

    const body = await request.json();
    let slug = body.slug;

    // Validate slug uniqueness
    const checkUniqueSlug = async (testSlug: string): Promise<string> => {
      const { data } = await supabase.from('events').select('id').eq('church_id', church.id).eq('slug', testSlug).maybeSingle();
      if (!data) return testSlug;
      // If taken, append '-2' or increment
      const match = testSlug.match(/-(\d+)$/);
      if (match) {
        const nextNum = parseInt(match[1]) + 1;
        return checkUniqueSlug(testSlug.replace(/-\d+$/, `-${nextNum}`));
      }
      return checkUniqueSlug(`${testSlug}-2`);
    };

    slug = await checkUniqueSlug(slug);

    const eventPayload = {
      ...body,
      church_id: church.id,
      slug,
      created_by: user.email
    };

    const { data, error } = await supabase
      .from('events')
      .insert(eventPayload)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
