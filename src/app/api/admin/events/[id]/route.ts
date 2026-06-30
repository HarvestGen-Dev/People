import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { data, error } = await supabase.from('events').select('*').eq('id', id).single();
    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = await request.json();

    // Check slug uniqueness if slug changed
    if (body.slug) {
      const churchSlug = user.user_metadata?.church_slug || 'harvestgen';
      const { data: church } = await supabase.from('churches').select('id').eq('slug', churchSlug).single();
      
      if (church) {
        const { data: existing } = await supabase.from('events').select('id').eq('church_id', church.id).eq('slug', body.slug).neq('id', id).maybeSingle();
        if (existing) {
          return NextResponse.json({ error: 'Slug is already in use by another event' }, { status: 400 });
        }
      }
    }

    const { data, error } = await supabase
      .from('events')
      .update(body)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (error) throw error;
    
    return NextResponse.json({ data: { deleted: true } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
