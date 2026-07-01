import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  adminApiError,
  requireTenantContext,
} from '@/lib/tenant-context';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext();
    const supabase = await createClient();

    const { id } = await params;
    const { data, error } = await supabase
      .from('events')
      .select('*')
      .eq('id', id)
      .eq('church_id', churchId)
      .single();
    if (error) throw error;
    
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { id } = await params;
    const body = await request.json();

    // Check slug uniqueness if slug changed
    if (body.slug) {
      const { data: existing } = await supabase.from('events').select('id').eq('church_id', churchId).eq('slug', body.slug).neq('id', id).maybeSingle();
      if (existing) {
        return NextResponse.json({ error: 'Slug is already in use by another event' }, { status: 400 });
      }
    }

    delete body.church_id;
    const { data, error } = await supabase
      .from('events')
      .update(body)
      .eq('id', id)
      .eq('church_id', churchId)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { churchId } = await requireTenantContext({ requireManager: true });
    const supabase = await createClient();

    const { id } = await params;
    const { error } = await supabase
      .from('events')
      .delete()
      .eq('id', id)
      .eq('church_id', churchId);
    if (error) throw error;
    
    return NextResponse.json({ data: { deleted: true } });
  } catch (error: unknown) {
    return adminApiError(error);
  }
}
